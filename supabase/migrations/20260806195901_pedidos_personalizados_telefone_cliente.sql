-- Pedidos Personalizados: telefone normalizado do cliente.
-- Preserva pedidos legados com NULL e estende atomicamente as RPCs comerciais.

do $$
begin
  if to_regclass('public.pedidos_personalizados_pedidos') is null then
    raise exception 'PEDIDOS_PERSONALIZADOS_TABELA_AUSENTE';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'pedidos_personalizados_pedidos'
      and column_name = 'telefone_normalizado'
  ) then
    raise exception 'PEDIDOS_PERSONALIZADOS_TELEFONE_JA_EXISTE';
  end if;
end
$$;

alter table public.pedidos_personalizados_pedidos
  add column telefone_normalizado text;

alter table public.pedidos_personalizados_pedidos
  add constraint pedidos_personalizados_pedidos_telefone_normalizado_check
  check (
    telefone_normalizado is null
    or telefone_normalizado ~ '^[0-9]{10,11}$'
  );

create index idx_pedidos_personalizados_pedidos_telefone_normalizado
  on public.pedidos_personalizados_pedidos (telefone_normalizado)
  where telefone_normalizado is not null;

create function public.criar_pedido_personalizado_moriah(
  p_usuario_id uuid,
  p_idempotency_key uuid,
  p_fornecedor_id uuid,
  p_unidade_id uuid,
  p_consultora text,
  p_cliente text,
  p_telefone_normalizado text,
  p_tapetes jsonb,
  p_numero_lancamento text default null,
  p_data_entrega date default null,
  p_data_pedido_fornecedor date default null,
  p_numero_pedido_compra text default null,
  p_comprador text default null
)
returns table (
  pedido_id uuid,
  version integer,
  reutilizado boolean,
  tapetes jsonb
)
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_resultado record;
  v_telefone_atual text;
begin
  if p_telefone_normalizado is null
     or p_telefone_normalizado !~ '^[0-9]{10,11}$'
     or left(p_telefone_normalizado, 2) = '00' then
    raise exception 'TELEFONE_INVALIDO' using errcode = '22023';
  end if;

  select * into v_resultado
  from public.criar_pedido_personalizado_moriah(
    p_usuario_id,
    p_idempotency_key,
    p_fornecedor_id,
    p_unidade_id,
    p_consultora,
    p_cliente,
    p_tapetes,
    p_numero_lancamento,
    p_data_entrega,
    p_data_pedido_fornecedor,
    p_numero_pedido_compra,
    p_comprador
  );

  select pedido.telefone_normalizado
    into v_telefone_atual
  from public.pedidos_personalizados_pedidos as pedido
  where pedido.id = v_resultado.pedido_id
  for update;

  if v_telefone_atual is not null and v_telefone_atual <> p_telefone_normalizado then
    raise exception 'IDEMPOTENCY_PAYLOAD_DIVERGENTE' using errcode = '22023';
  end if;

  update public.pedidos_personalizados_pedidos as pedido
  set telefone_normalizado = p_telefone_normalizado
  where pedido.id = v_resultado.pedido_id
    and pedido.telefone_normalizado is distinct from p_telefone_normalizado;

  return query
  select
    v_resultado.pedido_id::uuid,
    v_resultado.version::integer,
    v_resultado.reutilizado::boolean,
    v_resultado.tapetes::jsonb;
end;
$$;

create function public.atualizar_pedido_personalizado_comercial_moriah(
  p_pedido_id uuid,
  p_expected_version integer,
  p_usuario_id uuid,
  p_unidade_id uuid,
  p_consultora text,
  p_cliente text,
  p_telefone_normalizado text,
  p_tapetes jsonb
)
returns table (
  version integer,
  tapetes jsonb
)
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_resultado record;
begin
  if p_telefone_normalizado is null
     or p_telefone_normalizado !~ '^[0-9]{10,11}$'
     or left(p_telefone_normalizado, 2) = '00' then
    raise exception 'TELEFONE_INVALIDO' using errcode = '22023';
  end if;

  select * into v_resultado
  from public.atualizar_pedido_personalizado_comercial_moriah(
    p_pedido_id,
    p_expected_version,
    p_usuario_id,
    p_unidade_id,
    p_consultora,
    p_cliente,
    p_tapetes
  );

  update public.pedidos_personalizados_pedidos as pedido
  set telefone_normalizado = p_telefone_normalizado
  where pedido.id = p_pedido_id;

  return query
  select v_resultado.version::integer, v_resultado.tapetes::jsonb;
end;
$$;

revoke all on function public.criar_pedido_personalizado_moriah(
  uuid, uuid, uuid, uuid, text, text, text, jsonb, text, date, date, text, text
) from public, anon, authenticated;
grant execute on function public.criar_pedido_personalizado_moriah(
  uuid, uuid, uuid, uuid, text, text, text, jsonb, text, date, date, text, text
) to service_role;

revoke all on function public.atualizar_pedido_personalizado_comercial_moriah(
  uuid, integer, uuid, uuid, text, text, text, jsonb
) from public, anon, authenticated;
grant execute on function public.atualizar_pedido_personalizado_comercial_moriah(
  uuid, integer, uuid, uuid, text, text, text, jsonb
) to service_role;
