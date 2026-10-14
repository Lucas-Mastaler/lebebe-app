-- Fase 5: transições operacionais Decorisi.
-- O fechamento da venda permanece exclusivamente em
-- fechar_pedido_personalizado_decorisi, que congela a cotação e o snapshot.
create or replace function public.transicionar_pedido_personalizado_decorisi(
  p_pedido_id uuid,
  p_expected_version integer,
  p_usuario_id uuid,
  p_status_destino text,
  p_numero_pedido_compra text default null,
  p_data_pedido_fornecedor date default null,
  p_comprador text default null,
  p_data_entrega date default null,
  p_data_recebimento date default null,
  p_justificativa text default null
) returns table(evento_id uuid, status text, version integer)
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_pedido public.pedidos_personalizados_pedidos%rowtype;
  v_status_atual text;
  v_evento uuid := gen_random_uuid();
  v_nova_version integer;
begin
  if p_usuario_id is null or not exists (
    select 1 from public.usuarios_permitidos
    where id = p_usuario_id and ativo = true
  ) then
    raise exception 'USUARIO_INVALIDO' using errcode = '42501';
  end if;

  select * into v_pedido
  from public.pedidos_personalizados_pedidos
  where id = p_pedido_id
  for update;
  if not found then raise exception 'PEDIDO_NAO_ENCONTRADO' using errcode = 'P0002'; end if;

  perform public.decorisi_exigir_escopo(p_usuario_id, v_pedido.unidade_id);
  if not exists (
    select 1 from public.pedidos_personalizados_fornecedores
    where id = v_pedido.fornecedor_id and chave = 'decorisi'
  ) then
    raise exception 'PEDIDO_NAO_ENCONTRADO' using errcode = 'P0002';
  end if;
  if public.decorisi_fornecedor_para_usuario(p_usuario_id) is null then
    raise exception 'ACESSO_NEGADO' using errcode = '42501';
  end if;
  if p_expected_version is null or v_pedido.version <> p_expected_version then
    raise exception 'CONFLITO_VERSAO' using errcode = 'P0003';
  end if;

  v_status_atual := v_pedido.status;
  if p_status_destino is null or not (
    (v_status_atual = 'RASCUNHO' and p_status_destino = 'CANCELADO')
    or (v_status_atual = 'VENDA FECHADA' and p_status_destino in ('AGUARDANDO LAYOUT', 'CANCELADO'))
    or (v_status_atual = 'AGUARDANDO LAYOUT' and p_status_destino in ('AGUARDANDO APROVAÇÃO DO CLIENTE', 'CANCELADO'))
    or (v_status_atual = 'AGUARDANDO APROVAÇÃO DO CLIENTE' and p_status_destino in ('EM PRODUÇÃO', 'AGUARDANDO LAYOUT', 'CANCELADO'))
    or (v_status_atual = 'EM PRODUÇÃO' and p_status_destino in ('RECEBIDO', 'CANCELADO'))
  ) then
    raise exception 'TRANSICAO_STATUS_INVALIDA' using errcode = 'P0001';
  end if;

  if p_status_destino = 'CANCELADO'
     and (nullif(btrim(p_justificativa), '') is null or char_length(btrim(p_justificativa)) > 500) then
    raise exception 'JUSTIFICATIVA_CANCELAMENTO_OBRIGATORIA' using errcode = '23514';
  end if;
  if p_status_destino <> 'CANCELADO' and nullif(btrim(p_justificativa), '') is not null then
    raise exception 'JUSTIFICATIVA_NAO_PERMITIDO' using errcode = '22023';
  end if;
  if p_status_destino in ('AGUARDANDO APROVAÇÃO DO CLIENTE', 'EM PRODUÇÃO')
     and exists (
       select 1
       from public.pedidos_personalizados_decorisi_itens i
       where i.pedido_id = p_pedido_id and i.classificacao = 'PERSONALIZADO'
       and not exists (select 1 from public.pedidos_personalizados_decorisi_anexos a where a.item_id = i.id)
     ) then
    raise exception 'ANEXO_LAYOUT_OBRIGATORIO' using errcode = '23514';
  end if;
  if v_status_atual = 'VENDA FECHADA' and p_status_destino = 'AGUARDANDO LAYOUT'
     and (p_numero_pedido_compra is null or p_numero_pedido_compra !~ '^[0-9]{1,5}$'
       or p_data_pedido_fornecedor is null
       or p_comprador is null or char_length(btrim(p_comprador)) not between 2 and 40) then
    raise exception 'CAMPOS_LAYOUT_OBRIGATORIOS' using errcode = '23514';
  end if;
  if p_status_destino = 'EM PRODUÇÃO' and p_data_entrega is null then
    raise exception 'DATA_ENTREGA_OBRIGATORIA' using errcode = '23514';
  end if;
  if p_status_destino = 'RECEBIDO' and p_data_recebimento is null then
    raise exception 'DATA_RECEBIMENTO_OBRIGATORIA' using errcode = '23514';
  end if;

  update public.pedidos_personalizados_pedidos as p
  set status = p_status_destino,
      numero_pedido_compra = case when v_status_atual = 'VENDA FECHADA' and p_status_destino = 'AGUARDANDO LAYOUT' then p_numero_pedido_compra else numero_pedido_compra end,
      data_pedido_fornecedor = case when v_status_atual = 'VENDA FECHADA' and p_status_destino = 'AGUARDANDO LAYOUT' then p_data_pedido_fornecedor else data_pedido_fornecedor end,
      comprador = case when v_status_atual = 'VENDA FECHADA' and p_status_destino = 'AGUARDANDO LAYOUT' then nullif(btrim(p_comprador), '') else comprador end,
      data_entrega = case when p_status_destino = 'EM PRODUÇÃO' then p_data_entrega else data_entrega end,
      version = p.version + 1,
      updated_by = p_usuario_id
  where id = p_pedido_id
  returning p.version into v_nova_version;

  if v_status_atual = 'AGUARDANDO APROVAÇÃO DO CLIENTE' and p_status_destino = 'AGUARDANDO LAYOUT' then
    update public.pedidos_personalizados_decorisi_itens
    set layout_alteracoes = layout_alteracoes + 1, updated_by = p_usuario_id, updated_at = now()
    where pedido_id = p_pedido_id and classificacao = 'PERSONALIZADO';
  end if;

  insert into public.pedidos_personalizados_status_historico(
    id, pedido_id, status_anterior, status_novo, usuario_id, unidade_id,
    version_anterior, version_nova, justificativa, data_recebimento
  ) values (
    v_evento, p_pedido_id, v_status_atual, p_status_destino, p_usuario_id, v_pedido.unidade_id,
    v_pedido.version, v_nova_version,
    case when p_status_destino = 'CANCELADO' then nullif(btrim(p_justificativa), '') else null end,
    case when p_status_destino = 'RECEBIDO' then p_data_recebimento else null end
  );

  return query select v_evento, p_status_destino, v_nova_version;
end;
$$;

revoke all on function public.transicionar_pedido_personalizado_decorisi(uuid, integer, uuid, text, text, date, text, date, date, text) from public, anon, authenticated;
grant execute on function public.transicionar_pedido_personalizado_decorisi(uuid, integer, uuid, text, text, date, text, date, date, text) to service_role;

-- Metadados operacionais podem evoluir sem reabrir a composição financeira.
create or replace function public.decorisi_proteger_composicao() returns trigger
language plpgsql security invoker set search_path = pg_catalog, public as $$
declare v_pedido uuid; v_status text;
begin
  if tg_table_name = 'pedidos_personalizados_decorisi_medidas' then
    select pedido_id into v_pedido from public.pedidos_personalizados_decorisi_itens
    where id = case when tg_op = 'DELETE' then old.item_id else new.item_id end;
    if tg_op = 'DELETE' and v_pedido is null then return old; end if;
  else
    v_pedido := case when tg_op = 'DELETE' then old.pedido_id else new.pedido_id end;
  end if;
  select status into v_status from public.pedidos_personalizados_pedidos where id = v_pedido for update;
  if v_status is distinct from 'RASCUNHO' then
    if tg_op = 'UPDATE' and tg_table_name = 'pedidos_personalizados_decorisi_itens' then
      if v_status = 'AGUARDANDO LAYOUT'
       and new.classificacao = 'PERSONALIZADO'
       and new.layout_alteracoes = old.layout_alteracoes + 1
       and (to_jsonb(new) - array['layout_alteracoes','updated_by','updated_at'])
           = (to_jsonb(old) - array['layout_alteracoes','updated_by','updated_at']) then
      return new;
      end if;
    end if;
    raise exception 'COMPOSICAO_DECORISI_BLOQUEADA' using errcode = '23514';
  end if;
  if tg_op = 'UPDATE' then
    if tg_table_name = 'pedidos_personalizados_decorisi_itens' then
      if old.pedido_id <> new.pedido_id or old.snapshot_comercial is not null and new.snapshot_comercial is distinct from old.snapshot_comercial then
        raise exception 'SNAPSHOT_DECORISI_IMUTAVEL' using errcode = '23514';
      end if;
    elsif old.item_id <> new.item_id then
      raise exception 'ITEM_DECORISI_INVALIDO' using errcode = '23514';
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;

-- As RPCs da Fase 4 eram restritas a rascunhos. O trigger de anexos continua
-- protegendo status terminais, substituição/remoção e último anexo personalizado.
do $$
declare v_assinatura text; v_def text; v_nova text;
begin
  foreach v_assinatura in array array[
    'public.decorisi_preparar_anexo(uuid,uuid,uuid,integer,jsonb)',
    'public.decorisi_remover_anexo(uuid,uuid,uuid,integer,uuid)'
  ] loop
    select pg_get_functiondef(v_assinatura::regprocedure) into v_def;
    v_nova := replace(v_def,
      'if v_p.status<>''RASCUNHO'' then raise exception ''COMPOSICAO_DECORISI_BLOQUEADA'' using errcode=''23514''; end if;',
      'if v_p.status=''CANCELADO'' then raise exception ''COMPOSICAO_DECORISI_BLOQUEADA'' using errcode=''23514''; end if;');
    if v_nova = v_def then raise exception 'DEFINICAO_DECORISI_DIVERGENTE: %', v_assinatura; end if;
    execute v_nova;
  end loop;
end $$;
