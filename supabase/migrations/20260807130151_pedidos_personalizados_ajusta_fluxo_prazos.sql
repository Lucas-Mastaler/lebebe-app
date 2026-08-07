create or replace function public.transicionar_pedido_personalizado(
  p_pedido_id uuid,
  p_expected_version integer,
  p_usuario_id uuid,
  p_status_destino text,
  p_numero_pedido_compra text default null,
  p_data_pedido_fornecedor date default null,
  p_comprador text default null,
  p_data_entrega date default null,
  p_justificativa text default null
)
returns table(evento_id uuid, status text, version integer)
language plpgsql
security invoker
set search_path = pg_catalog, public
as $function$
declare
  v_pedido public.pedidos_personalizados_pedidos%rowtype;
  v_evento_id uuid := gen_random_uuid();
  v_nova_version integer;
  v_numero_pedido_compra text;
  v_data_pedido_fornecedor date;
  v_comprador text;
  v_data_entrega date;
  v_justificativa text;
begin
  if p_usuario_id is null or not exists (
    select 1 from public.usuarios_permitidos as usuario
    where usuario.id = p_usuario_id and usuario.ativo = true
  ) then
    raise exception 'USUARIO_INVALIDO' using errcode = '42501';
  end if;

  if p_expected_version is null or p_expected_version < 1 then
    raise exception 'VERSAO_INVALIDA' using errcode = '22023';
  end if;

  select pedido.* into v_pedido
  from public.pedidos_personalizados_pedidos as pedido
  where pedido.id = p_pedido_id
  for update;

  if not found then raise exception 'PEDIDO_NAO_ENCONTRADO' using errcode = 'P0002'; end if;
  if v_pedido.version <> p_expected_version then raise exception 'CONFLITO_VERSAO' using errcode = 'P0003'; end if;

  if not (
    (v_pedido.status = 'CADASTRADO' and p_status_destino in ('AGUARDANDO LAYOUT','CANCELADO'))
    or (v_pedido.status = 'AGUARDANDO LAYOUT' and p_status_destino in (U&'AGUARDANDO APROVA\00C7\00C3O DO CLIENTE','CANCELADO'))
    or (v_pedido.status = U&'AGUARDANDO APROVA\00C7\00C3O DO CLIENTE'
        and p_status_destino in (U&'EM PRODU\00C7\00C3O','AGUARDANDO LAYOUT','CANCELADO'))
    or (v_pedido.status = U&'EM PRODU\00C7\00C3O' and p_status_destino in ('RECEBIDO','CANCELADO'))
  ) then raise exception 'TRANSICAO_STATUS_INVALIDA' using errcode = 'P0001'; end if;

  if p_status_destino in (U&'AGUARDANDO APROVA\00C7\00C3O DO CLIENTE',U&'EM PRODU\00C7\00C3O')
     and not exists (
       select 1 from public.pedidos_personalizados_moriah_tapetes as tapete
       join public.pedidos_personalizados_anexos as anexo on anexo.tapete_id = tapete.id
       where tapete.pedido_id = p_pedido_id
     )
  then raise exception 'ANEXO_LAYOUT_OBRIGATORIO' using errcode = '23514'; end if;

  v_numero_pedido_compra := coalesce(p_numero_pedido_compra, v_pedido.numero_pedido_compra);
  v_data_pedido_fornecedor := coalesce(p_data_pedido_fornecedor, v_pedido.data_pedido_fornecedor);
  v_comprador := coalesce(nullif(btrim(p_comprador), ''), v_pedido.comprador);
  v_data_entrega := coalesce(p_data_entrega, v_pedido.data_entrega);
  v_justificativa := nullif(btrim(p_justificativa), '');

  if v_pedido.status = 'CADASTRADO' and p_status_destino = 'AGUARDANDO LAYOUT' and (
    v_numero_pedido_compra is null or v_numero_pedido_compra !~ '^[0-9]{1,5}$'
    or v_data_pedido_fornecedor is null or v_comprador is null
    or char_length(btrim(v_comprador)) not between 2 and 40
  ) then raise exception 'CAMPOS_LAYOUT_OBRIGATORIOS' using errcode = '23514'; end if;

  if p_status_destino = U&'EM PRODU\00C7\00C3O' and (
    v_numero_pedido_compra is null or v_numero_pedido_compra !~ '^[0-9]{1,5}$'
    or v_data_pedido_fornecedor is null or v_comprador is null
    or char_length(btrim(v_comprador)) not between 2 and 40
  ) then raise exception 'CAMPOS_PRODUCAO_OBRIGATORIOS' using errcode = '23514'; end if;

  if p_status_destino = U&'EM PRODU\00C7\00C3O' and v_data_entrega is null
  then raise exception 'DATA_ENTREGA_OBRIGATORIA' using errcode = '23514'; end if;

  if p_status_destino = 'CANCELADO' and (
    v_justificativa is null or char_length(v_justificativa) > 500
  ) then raise exception 'JUSTIFICATIVA_CANCELAMENTO_OBRIGATORIA' using errcode = '23514'; end if;

  if p_status_destino <> 'CANCELADO' and v_justificativa is not null
  then raise exception 'JUSTIFICATIVA_NAO_PERMITIDA' using errcode = '22023'; end if;

  update public.pedidos_personalizados_pedidos as pedido
  set status = p_status_destino,
      numero_pedido_compra = case when v_pedido.status = 'CADASTRADO' and p_status_destino = 'AGUARDANDO LAYOUT' then v_numero_pedido_compra else pedido.numero_pedido_compra end,
      data_pedido_fornecedor = case when v_pedido.status = 'CADASTRADO' and p_status_destino = 'AGUARDANDO LAYOUT' then v_data_pedido_fornecedor else pedido.data_pedido_fornecedor end,
      comprador = case when v_pedido.status = 'CADASTRADO' and p_status_destino = 'AGUARDANDO LAYOUT' then v_comprador else pedido.comprador end,
      data_entrega = case when p_status_destino = U&'EM PRODU\00C7\00C3O' then v_data_entrega else pedido.data_entrega end,
      version = pedido.version + 1,
      updated_by = p_usuario_id
  where pedido.id = p_pedido_id
  returning pedido.version into v_nova_version;

  insert into public.pedidos_personalizados_status_historico (
    id,pedido_id,status_anterior,status_novo,usuario_id,unidade_id,
    version_anterior,version_nova,justificativa
  ) values (
    v_evento_id,p_pedido_id,v_pedido.status,p_status_destino,p_usuario_id,
    v_pedido.unidade_id,v_pedido.version,v_nova_version,
    case when p_status_destino = 'CANCELADO' then v_justificativa else null end
  );

  return query select v_evento_id,p_status_destino,v_nova_version;
end;
$function$;

create function public.atualizar_pedido_personalizado_comercial_moriah(
  p_pedido_id uuid,
  p_expected_version integer,
  p_usuario_id uuid,
  p_unidade_id uuid,
  p_consultora text,
  p_cliente text,
  p_telefone_normalizado text,
  p_numero_lancamento text,
  p_tapetes jsonb
)
returns table(version integer, tapetes jsonb)
language plpgsql
security invoker
set search_path = pg_catalog, public
as $function$
declare
  v_resultado record;
begin
  if p_numero_lancamento is not null and p_numero_lancamento !~ '^[0-9]{1,6}$' then
    raise exception 'NUMERO_LANCAMENTO_INVALIDO' using errcode = '22023';
  end if;

  select * into v_resultado
  from public.atualizar_pedido_personalizado_comercial_moriah(
    p_pedido_id, p_expected_version, p_usuario_id, p_unidade_id,
    p_consultora, p_cliente, p_telefone_normalizado, p_tapetes
  );

  update public.pedidos_personalizados_pedidos as pedido
  set numero_lancamento = p_numero_lancamento
  where pedido.id = p_pedido_id;

  return query select v_resultado.version::integer, v_resultado.tapetes::jsonb;
end;
$function$;

revoke all on function public.atualizar_pedido_personalizado_comercial_moriah(
  uuid, integer, uuid, uuid, text, text, text, text, jsonb
) from public, anon, authenticated;
grant execute on function public.atualizar_pedido_personalizado_comercial_moriah(
  uuid, integer, uuid, uuid, text, text, text, text, jsonb
) to service_role;
