-- Entrada manual: metadados aditivos; nenhuma nota/item histórico é regravado.
alter table public.nfe
  add column xml_chave_acesso text,
  add column xml_sha256 text,
  add column xml_drive_file_id text,
  add column xml_drive_status text check (xml_drive_status in ('pendente', 'salvo'));
create unique index nfe_xml_chave_acesso_unique on public.nfe (xml_chave_acesso) where xml_chave_acesso is not null;

create function public.importar_xml_recebimento(p_nota jsonb, p_sha256 text)
returns jsonb
language plpgsql security invoker
set search_path = ''
as $$
declare
  v_nf public.nfe%rowtype;
  v_numero text := p_nota->>'numero_nf';
  v_chave text := p_nota->>'chave_acesso';
  v_item jsonb;
  v_itens jsonb;
  v_existentes jsonb;
  v_os jsonb;
  v_os_existentes jsonb;
  v_volumes integer;
  v_nova boolean := false;
begin
  if auth.uid() is null or not coalesce(public.is_matic_user(), false) then
    raise exception using errcode = '42501', message = 'Acesso negado';
  end if;
  if v_numero is null or v_numero !~ '^[1-9][0-9]{0,8}$'
    or v_chave is null or v_chave !~ '^[0-9]{44}$'
    or ltrim(substr(v_chave, 26, 9), '0') <> v_numero
    or substr(v_chave, 21, 2) <> '55'
    or p_sha256 is null or p_sha256 !~ '^[a-f0-9]{64}$'
    or nullif(p_nota->>'data_emissao', '') is null
    or jsonb_typeof(p_nota->'itens') is distinct from 'array'
    or jsonb_typeof(p_nota->'assistencias') is distinct from 'array' then
    raise exception 'XML_DADOS_INVALIDOS';
  end if;
  if jsonb_array_length(p_nota->'itens') = 0 or jsonb_array_length(p_nota->'itens') > 990 then raise exception 'XML_ITENS_INVALIDOS'; end if;
  if (p_nota->>'peso_total')::numeric < 0 or (p_nota->>'volumes_total')::integer < 0 then raise exception 'XML_TOTAIS_INVALIDOS'; end if;
  for v_item in select value from jsonb_array_elements(p_nota->'itens') loop
    if coalesce(v_item->>'n_item', '') !~ '^[1-9][0-9]{0,2}$'
      or coalesce(v_item->>'quantidade', '') !~ '^[1-9][0-9]*$'
      or nullif(btrim(v_item->>'codigo_produto'), '') is null
      or nullif(btrim(v_item->>'descricao'), '') is null then raise exception 'XML_ITEM_INVALIDO'; end if;
  end loop;
  if (select count(*) <> count(distinct value->>'n_item') from jsonb_array_elements(p_nota->'itens')) then raise exception 'XML_ITEM_REPETIDO'; end if;

  -- A trava dura apenas a transação fiscal. Nenhuma chamada Google ocorre aqui.
  perform pg_advisory_xact_lock(hashtextextended('recebimento-xml:' || v_numero, 0));
  insert into public.nfe(numero_nf, data_emissao, peso_total, volumes_total, obs, is_os, xml_chave_acesso, xml_sha256, xml_drive_status)
  values(v_numero, (p_nota->>'data_emissao')::date, (p_nota->>'peso_total')::numeric, (p_nota->>'volumes_total')::integer,
    nullif(p_nota->>'obs', ''), (p_nota->>'is_os')::boolean, v_chave, p_sha256, 'pendente')
  on conflict (numero_nf) do nothing returning * into v_nf;
  v_nova := found;

  if not v_nova then
    select * into strict v_nf from public.nfe where numero_nf = v_numero for update;
    if (v_nf.xml_chave_acesso is not null and v_nf.xml_chave_acesso <> v_chave)
      or (v_nf.xml_sha256 is not null and v_nf.xml_sha256 <> p_sha256) then raise exception 'XML_CONFLITO_IDENTIDADE'; end if;
    -- Compara campos fiscais, sem exigir igualdade do SKU aprendido ou do status operacional.
    select jsonb_agg(jsonb_build_object('n_item', i.n_item, 'codigo_produto', i.codigo_produto, 'descricao', i.descricao, 'quantidade', i.quantidade) order by i.n_item)
      into v_existentes from public.nfe_itens i where i.nfe_id = v_nf.id;
    select jsonb_agg(jsonb_build_object('n_item', (x->>'n_item')::integer, 'codigo_produto', x->>'codigo_produto', 'descricao', x->>'descricao', 'quantidade', (x->>'quantidade')::integer) order by (x->>'n_item')::integer)
      into v_itens from jsonb_array_elements(p_nota->'itens') x;
    select coalesce(jsonb_agg(os_oc_numero order by os_oc_numero), '[]'::jsonb) into v_os_existentes from public.nfe_assistencias where nfe_id = v_nf.id;
    select coalesce(jsonb_agg(x order by x), '[]'::jsonb) into v_os from (select distinct value #>> '{}' as x from jsonb_array_elements(p_nota->'assistencias')) s;
    if v_nf.data_emissao <> (p_nota->>'data_emissao')::date
      or coalesce(v_nf.peso_total, 0) <> (p_nota->>'peso_total')::numeric
      or coalesce(v_nf.volumes_total, 0) <> (p_nota->>'volumes_total')::integer
      or coalesce(v_nf.obs, '') <> coalesce(p_nota->>'obs', '')
      or v_nf.is_os <> (p_nota->>'is_os')::boolean
      or v_existentes is distinct from v_itens or v_os_existentes is distinct from v_os then raise exception 'XML_CONFLITO_DADOS'; end if;
    update public.nfe set xml_chave_acesso = v_chave, xml_sha256 = p_sha256, xml_drive_status = coalesce(xml_drive_status, 'pendente') where id = v_nf.id returning * into v_nf;
  else
    for v_item in select value from jsonb_array_elements(p_nota->'itens') loop
      -- Mesma prioridade operacional: código exato > ref_meia > ref_inteira.
      select s.volumes_por_item into v_volumes from public.matic_sku s
        where s.codigo_produto = v_item->>'codigo_produto'
          or coalesce(nullif(ltrim(btrim(s.ref_meia), '0'), ''), '0') = coalesce(nullif(ltrim(btrim(v_item->>'codigo_produto'), '0'), ''), '0')
          or coalesce(nullif(ltrim(btrim(s.ref_inteira), '0'), ''), '0') = coalesce(nullif(ltrim(btrim(v_item->>'codigo_produto'), '0'), ''), '0')
        order by case when s.codigo_produto = v_item->>'codigo_produto' then 0
          when coalesce(nullif(ltrim(btrim(s.ref_meia), '0'), ''), '0') = coalesce(nullif(ltrim(btrim(v_item->>'codigo_produto'), '0'), ''), '0') then 1 else 2 end, s.codigo_produto
        limit 1;
      v_volumes := coalesce(nullif(v_volumes, 0), 1);
      insert into public.nfe_itens(nfe_id, n_item, codigo_produto, descricao, quantidade, volumes_por_item, volumes_previstos_total, status)
        values(v_nf.id, (v_item->>'n_item')::integer, v_item->>'codigo_produto', v_item->>'descricao', (v_item->>'quantidade')::integer, v_volumes, (v_item->>'quantidade')::integer * v_volumes, 'pendente');
    end loop;
    insert into public.nfe_assistencias(nfe_id, os_oc_numero)
      select v_nf.id, x from (select distinct value #>> '{}' as x from jsonb_array_elements(p_nota->'assistencias')) s;
  end if;
  return jsonb_build_object('nfe_id', v_nf.id, 'numero_nf', v_nf.numero_nf, 'banco', case when v_nova then 'cadastrada' else 'existente' end, 'drive_file_id', v_nf.xml_drive_file_id);
end;
$$;
revoke all on function public.importar_xml_recebimento(jsonb, text) from public, anon;
grant execute on function public.importar_xml_recebimento(jsonb, text) to authenticated;
