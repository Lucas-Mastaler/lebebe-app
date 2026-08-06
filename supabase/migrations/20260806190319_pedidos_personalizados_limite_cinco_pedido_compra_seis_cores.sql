do $$
begin
  if exists (
    select 1
    from public.pedidos_personalizados_pedidos
    where numero_pedido_compra is not null
      and numero_pedido_compra !~ '^[0-9]{1,5}$'
  ) then
    raise exception 'PEDIDOS_PERSONALIZADOS_NUMERO_PEDIDO_COMPRA_INCOMPATIVEL';
  end if;

  if exists (
    select 1
    from public.pedidos_personalizados_tapete_cores
    group by tapete_id
    having count(*) > 6
  ) then
    raise exception 'PEDIDOS_PERSONALIZADOS_TAPETE_ACIMA_LIMITE_CORES';
  end if;
end
$$;

alter table public.pedidos_personalizados_pedidos
  drop constraint pedidos_personalizados_pedidos_numero_pedido_compra_check,
  add constraint pedidos_personalizados_pedidos_numero_pedido_compra_check
    check (
      numero_pedido_compra is null
      or numero_pedido_compra ~ '^[0-9]{1,5}$'
    );

alter table public.pedidos_personalizados_tapete_cores
  drop constraint pedidos_personalizados_tapete_cores_ordem_check,
  add constraint pedidos_personalizados_tapete_cores_ordem_check
    check (ordem between 1 and 6);
