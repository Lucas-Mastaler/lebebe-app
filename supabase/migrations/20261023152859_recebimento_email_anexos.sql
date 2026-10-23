-- Somente comprovantes de anexos importados com sucesso; sem XML ou dados do e-mail.
create table public.nfe_email_anexos (
  origem_sha256 text primary key check (origem_sha256 ~ '^[a-f0-9]{64}$'),
  nfe_id uuid not null references public.nfe(id) on delete cascade,
  importado_em timestamptz not null default now()
);
create index nfe_email_anexos_nfe_id_idx on public.nfe_email_anexos(nfe_id);
alter table public.nfe_email_anexos enable row level security;
revoke all on public.nfe_email_anexos from public, anon, authenticated;
grant select, insert on public.nfe_email_anexos to authenticated;
create policy nfe_email_anexos_select on public.nfe_email_anexos for select to authenticated using ((select public.is_matic_user()));
create policy nfe_email_anexos_insert on public.nfe_email_anexos for insert to authenticated with check ((select public.is_matic_user()));

create function public.importar_anexo_email_recebimento(p_origem_sha256 text, p_nota jsonb, p_sha256 text)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_numero text := p_nota->>'numero_nf';
  v_chave text := p_nota->>'chave_acesso';
  v_nf public.nfe%rowtype;
  v_resultado jsonb;
  v_id uuid;
  v_quantidade integer;
  v_itens jsonb;
  v_existentes jsonb;
  v_os jsonb;
  v_os_existentes jsonb;
begin
  if auth.uid() is null or not coalesce(public.is_matic_user(), false) then raise exception using errcode='42501', message='Acesso negado'; end if;
  if p_origem_sha256 is null or p_origem_sha256 !~ '^[a-f0-9]{64}$'
    or p_sha256 is null or p_sha256 !~ '^[a-f0-9]{64}$'
    or v_numero is null or v_numero !~ '^[1-9][0-9]{0,8}$'
    or v_chave is null or v_chave !~ '^[0-9]{44}$'
    or ltrim(substr(v_chave,26,9),'0') <> v_numero then raise exception 'XML_DADOS_INVALIDOS'; end if;
  -- Mesma trava do upload: duas fontes não criam a mesma nota simultaneamente.
  perform pg_advisory_xact_lock(hashtextextended('recebimento-xml:' || v_numero, 0));
  select a.nfe_id into v_id from public.nfe_email_anexos a where a.origem_sha256=p_origem_sha256;
  if found then
    select * into strict v_nf from public.nfe where id=v_id;
    if v_nf.xml_chave_acesso is distinct from v_chave then raise exception 'XML_CONFLITO_IDENTIDADE'; end if;
    return jsonb_build_object('nfe_id',v_nf.id,'numero_nf',v_nf.numero_nf,'banco','existente');
  end if;

  select count(*) into v_quantidade from public.nfe where xml_chave_acesso=v_chave or ltrim(numero_nf,'0')=v_numero;
  if v_quantidade > 1 then raise exception 'XML_CONFLITO_IDENTIDADE'; end if;
  select * into v_nf from public.nfe where xml_chave_acesso=v_chave or ltrim(numero_nf,'0')=v_numero for update;
  if found then
    if v_nf.xml_chave_acesso is not null and v_nf.xml_chave_acesso<>v_chave then raise exception 'XML_CONFLITO_IDENTIDADE'; end if;
    if not exists(select 1 from public.nfe_itens where nfe_id=v_nf.id) then raise exception 'XML_CADASTRO_INCOMPLETO'; end if;
    if v_nf.xml_chave_acesso is null then
      -- Legado sem chave: só adota a identidade se os dados fiscais conferirem.
      -- Preserva inclusive o número com zeros, IDs, SKU aprendido e recebimentos.
      select jsonb_agg(jsonb_build_object('n_item',n_item,'codigo_produto',codigo_produto,'descricao',descricao,'quantidade',quantidade) order by n_item) into v_existentes from public.nfe_itens where nfe_id=v_nf.id;
      select jsonb_agg(jsonb_build_object('n_item',(x->>'n_item')::integer,'codigo_produto',x->>'codigo_produto','descricao',x->>'descricao','quantidade',(x->>'quantidade')::integer) order by (x->>'n_item')::integer) into v_itens from jsonb_array_elements(p_nota->'itens') x;
      select coalesce(jsonb_agg(os_oc_numero order by os_oc_numero),'[]'::jsonb) into v_os_existentes from public.nfe_assistencias where nfe_id=v_nf.id;
      select coalesce(jsonb_agg(x order by x),'[]'::jsonb) into v_os from (select distinct value #>> '{}' x from jsonb_array_elements(p_nota->'assistencias')) s;
      if v_nf.data_emissao is distinct from (p_nota->>'data_emissao')::date
        or coalesce(v_nf.peso_total,0) is distinct from (p_nota->>'peso_total')::numeric
        or coalesce(v_nf.volumes_total,0) is distinct from (p_nota->>'volumes_total')::integer
        or coalesce(v_nf.obs,'') is distinct from coalesce(p_nota->>'obs','')
        or v_nf.is_os is distinct from (p_nota->>'is_os')::boolean
        or v_existentes is distinct from v_itens or v_os_existentes is distinct from v_os then raise exception 'XML_CONFLITO_DADOS'; end if;
      update public.nfe set xml_chave_acesso=v_chave, xml_sha256=coalesce(xml_sha256,p_sha256) where id=v_nf.id;
    end if;
    v_resultado := jsonb_build_object('nfe_id',v_nf.id,'numero_nf',v_nf.numero_nf,'banco','existente');
  else
    -- Cadastro e cálculo existentes, em transação, sem reenviar arquivo ao Drive.
    v_resultado := public.importar_xml_recebimento(p_nota,p_sha256);
  end if;
  insert into public.nfe_email_anexos(origem_sha256,nfe_id) values(p_origem_sha256,(v_resultado->>'nfe_id')::uuid);
  return v_resultado;
end;
$$;
revoke all on function public.importar_anexo_email_recebimento(text,jsonb,text) from public, anon;
grant execute on function public.importar_anexo_email_recebimento(text,jsonb,text) to authenticated;
