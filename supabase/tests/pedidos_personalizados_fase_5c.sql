begin;

do $comercial$
declare
  v_pedido public.pedidos_personalizados_pedidos%rowtype;
  v_tapetes jsonb;
  v_result record;
begin
  select p.* into v_pedido
  from public.pedidos_personalizados_pedidos p
  where p.status = 'RASCUNHO'
  order by p.created_at
  limit 1;
  if v_pedido.id is null then raise exception 'FIXTURE_COMERCIAL_NAO_ENCONTRADA'; end if;

  select jsonb_agg(jsonb_build_object(
    'id', t.id, 'ordem', t.ordem, 'formato', t.formato,
    'dimensao_1_cm', t.dimensao_1_cm, 'dimensao_2_cm', t.dimensao_2_cm,
    'area_cobrada_centesimos_m2', t.area_cobrada_centesimos_m2,
    'produto_id', t.produto_id, 'nome_colecao_catalogo', t.nome_colecao_catalogo,
    'referencia_catalogo', t.referencia_catalogo, 'observacoes', t.observacoes,
    'cores', coalesce((
      select jsonb_agg(jsonb_build_object('cor_id', c.cor_id, 'ordem', c.ordem) order by c.ordem)
      from public.pedidos_personalizados_tapete_cores c where c.tapete_id = t.id
    ), '[]'::jsonb)
  ) order by t.ordem) into v_tapetes
  from public.pedidos_personalizados_moriah_tapetes t
  where t.pedido_id = v_pedido.id;

  select * into v_result
  from public.atualizar_pedido_personalizado_comercial_moriah(
    v_pedido.id, v_pedido.version, v_pedido.created_by, v_pedido.unidade_id,
    v_pedido.consultora, v_pedido.cliente, '41999999999',
    '000999', v_tapetes
  );
  if v_result.version <> v_pedido.version + 1 then raise exception 'VERSION_COMERCIAL_INCORRETA'; end if;
  if (select p.numero_lancamento from public.pedidos_personalizados_pedidos p where p.id = v_pedido.id) <> '000999'
  then raise exception 'LANCAMENTO_COMERCIAL_NAO_ATUALIZADO'; end if;
end
$comercial$;

do $teste$
declare
  v_pedido uuid;
  v_cancel uuid;
  v_usuario uuid;
  v_version integer;
  v_result record;
  v_count integer;
begin
  select p.id, p.created_by, p.version
    into v_pedido, v_usuario, v_version
    from public.pedidos_personalizados_pedidos p
   where p.status = 'RASCUNHO'
     and exists (
       select 1
         from public.pedidos_personalizados_moriah_tapetes t
         join public.pedidos_personalizados_anexos a on a.tapete_id = t.id
        where t.pedido_id = p.id
     )
   order by p.created_at
   limit 1;

  if v_pedido is null then raise exception 'FIXTURE_COM_ANEXO_NAO_ENCONTRADA'; end if;

  select * into v_result from public.transicionar_pedido_personalizado(v_pedido, v_version, v_usuario, 'VENDA FECHADA', null, null, null, null, null);
  select * into v_result from public.transicionar_pedido_personalizado(v_pedido, v_version + 1, v_usuario, 'AGUARDANDO LAYOUT', '00123', current_date, 'ANA', null, null);
  select * into v_result from public.transicionar_pedido_personalizado(v_pedido, v_version + 2, v_usuario, U&'AGUARDANDO APROVA\00C7\00C3O DO CLIENTE', null, null, null, null, null);
  select * into v_result from public.transicionar_pedido_personalizado(v_pedido, v_version + 3, v_usuario, 'AGUARDANDO LAYOUT', null, null, null, null, null);
  select * into v_result from public.transicionar_pedido_personalizado(v_pedido, v_version + 4, v_usuario, U&'AGUARDANDO APROVA\00C7\00C3O DO CLIENTE', null, null, null, null, null);
  select * into v_result from public.transicionar_pedido_personalizado(v_pedido, v_version + 5, v_usuario, U&'EM PRODU\00C7\00C3O', null, null, null, current_date + 10, null);
  select * into v_result from public.transicionar_pedido_personalizado(v_pedido, v_version + 6, v_usuario, 'RECEBIDO', null, null, null, current_date - 1, null);

  if v_result.version <> v_version + 7 then raise exception 'VERSION_FINAL_INCORRETA'; end if;
  if not exists (
    select 1 from public.pedidos_personalizados_pedidos p
    where p.id = v_pedido and p.numero_pedido_compra = '00123'
      and p.data_pedido_fornecedor = current_date and p.comprador = 'ANA'
      and p.data_entrega = current_date + 10
  ) then raise exception 'CAMPOS_DE_ETAPA_INCORRETOS'; end if;
  select count(*) into v_count from public.pedidos_personalizados_status_historico where pedido_id = v_pedido;
  if v_count <> 7 then raise exception 'HISTORICO_INCORRETO:%', v_count; end if;
  if not exists (
    select 1 from public.pedidos_personalizados_status_historico h
    where h.pedido_id = v_pedido and h.status_novo = 'RECEBIDO'
      and h.data_recebimento = current_date - 1 and h.created_at is not null
  ) then raise exception 'DATA_REAL_RECEBIMENTO_AUSENTE'; end if;

  begin
    perform public.transicionar_pedido_personalizado(v_pedido, v_version + 5, v_usuario, 'CANCELADO', null, null, null, null, 'teste');
    raise exception 'CONFLITO_NAO_REJEITADO';
  exception when sqlstate 'P0003' then null;
  end;

  select p.id, p.created_by, p.version
    into v_cancel, v_usuario, v_version
    from public.pedidos_personalizados_pedidos p
   where p.status = 'RASCUNHO' and p.id <> v_pedido
   order by p.created_at
   limit 1;
  if v_cancel is null then raise exception 'FIXTURE_CANCELAMENTO_NAO_ENCONTRADA'; end if;

  select * into v_result from public.transicionar_pedido_personalizado(v_cancel, v_version, v_usuario, 'CANCELADO', null, null, null, null, 'Cancelamento transacional de teste');
  begin
    perform public.transicionar_pedido_personalizado(v_cancel, v_version + 1, v_usuario, 'AGUARDANDO LAYOUT', null, null, null, null, null);
    raise exception 'ESTADO_TERMINAL_NAO_PROTEGIDO';
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'TRANSICAO_STATUS_INVALIDA' then raise; end if;
  end;
end
$teste$;

select 'pedidos_personalizados_fase_5c_transacional_ok' as resultado;
rollback;
