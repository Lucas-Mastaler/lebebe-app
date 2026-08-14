-- Regressão transacional dos fluxos vigentes por fornecedor.
-- Usa catálogos reais, cria somente dados sintéticos e desfaz tudo ao final.
begin;

do $tests$
declare
  v_usuario uuid;
  v_unidade uuid;
  v_moriah uuid;
  v_exclusive uuid;
  v_produto_moriah uuid;
  v_produto_exclusive uuid;
  v_pedido_moriah uuid;
  v_pedido_exclusive uuid;
  v_tapete uuid;
  v_anexo uuid := gen_random_uuid();
  v_version integer;
  v_preco numeric(12,2);
  v_custo numeric(12,2);
  v_status text;
begin
  select id into v_usuario
  from public.usuarios_permitidos
  where ativo = true
  order by created_at
  limit 1;

  select id into v_unidade
  from public.app_unidades
  where ativo = true
  order by nome
  limit 1;

  select id into v_moriah
  from public.pedidos_personalizados_fornecedores
  where chave = 'moriah_tapetes' and disponivel = true;

  select id into v_exclusive
  from public.pedidos_personalizados_fornecedores
  where chave = 'lebebe_exclusive' and disponivel = true;

  select id into v_produto_moriah
  from public.pedidos_personalizados_produtos
  where fornecedor_id = v_moriah and ativo = true
  order by ordem
  limit 1;

  select c.produto_id, c.preco_unitario, c.custo_unitario
    into v_produto_exclusive, v_preco, v_custo
  from public.pedidos_personalizados_lebebe_exclusive_catalogo c
  join public.pedidos_personalizados_produtos p on p.id = c.produto_id
  where p.ativo = true
  order by c.linha_origem
  limit 1;

  if v_usuario is null or v_unidade is null or v_moriah is null
     or v_exclusive is null or v_produto_moriah is null
     or v_produto_exclusive is null then
    raise exception 'FIXTURES_CATALOGO_NAO_ENCONTRADAS';
  end if;

  -- Moriah: RASCUNHO -> VENDA FECHADA -> layout/aprovacao -> producao -> recebido.
  select r.pedido_id, r.version, (r.tapetes->0->>'id')::uuid
    into v_pedido_moriah, v_version, v_tapete
  from public.criar_pedido_personalizado_moriah(
    v_usuario, gen_random_uuid(), v_moriah, v_unidade,
    'VALIDACAO SQL', 'CLIENTE SINTETICO', '41999999999',
    jsonb_build_array(jsonb_build_object(
      'ordem', 1, 'formato', 'REDONDO', 'tipo', 'PERSONALIZADO',
      'dimensao_1_cm', 100, 'dimensao_2_cm', null,
      'area_cobrada_centesimos_m2', 100,
      'produto_id', v_produto_moriah,
      'nome_colecao_catalogo', null, 'referencia_catalogo', null,
      'observacoes', null, 'cores', '[]'::jsonb
    )),
    null, null, null, null, null
  ) r;

  if v_version <> 1 or (select status from public.pedidos_personalizados_pedidos where id = v_pedido_moriah) <> 'RASCUNHO' then
    raise exception 'RASCUNHO_MORIAH_INVALIDO';
  end if;

  insert into public.pedidos_personalizados_anexos (
    id, tapete_id, slot, caminho_objeto, nome_original, mime_type,
    tamanho_bytes, created_by, updated_by
  ) values (
    v_anexo, v_tapete, 1,
    v_usuario::text || '/' || v_pedido_moriah::text || '/' || v_tapete::text || '/' || v_anexo::text || '.pdf',
    'layout.pdf', 'application/pdf', 1, v_usuario, v_usuario
  );

  begin
    perform public.transicionar_pedido_personalizado(
      v_pedido_moriah, v_version, v_usuario, 'VENDA FECHADA',
      null, null, null, null, null, null
    );
    raise exception 'LANCAMENTO_MORIAH_NAO_EXIGIDO';
  exception when sqlstate '23514' then
    if sqlerrm <> 'NUMERO_LANCAMENTO_OBRIGATORIO' then raise; end if;
  end;

  if (select status from public.pedidos_personalizados_pedidos where id = v_pedido_moriah) <> 'RASCUNHO'
     or (select version from public.pedidos_personalizados_pedidos where id = v_pedido_moriah) <> v_version
     or (select numero_lancamento from public.pedidos_personalizados_pedidos where id = v_pedido_moriah) is not null then
    raise exception 'FALHA_LANCAMENTO_MORIAH_ALTEROU_PARCIALMENTE';
  end if;

  select r.version into v_version from public.transicionar_pedido_personalizado(
    v_pedido_moriah, v_version, v_usuario, 'VENDA FECHADA',
    '000001', null, null, null, null, null
  ) r;
  select r.version into v_version from public.transicionar_pedido_personalizado(v_pedido_moriah, v_version, v_usuario, 'AGUARDANDO LAYOUT', null, '123', current_date, 'VALIDADOR', null, null) r;
  select r.version into v_version from public.transicionar_pedido_personalizado(v_pedido_moriah, v_version, v_usuario, U&'AGUARDANDO APROVA\00C7\00C3O DO CLIENTE', null, null, null, null, null, null) r;
  select r.version into v_version from public.transicionar_pedido_personalizado(v_pedido_moriah, v_version, v_usuario, 'AGUARDANDO LAYOUT', null, null, null, null, null, null) r;
  select r.version into v_version from public.transicionar_pedido_personalizado(v_pedido_moriah, v_version, v_usuario, U&'AGUARDANDO APROVA\00C7\00C3O DO CLIENTE', null, null, null, null, null, null) r;
  select r.version into v_version from public.transicionar_pedido_personalizado(v_pedido_moriah, v_version, v_usuario, U&'EM PRODU\00C7\00C3O', null, null, null, null, current_date + 7, null) r;
  select r.version into v_version from public.transicionar_pedido_personalizado(v_pedido_moriah, v_version, v_usuario, 'RECEBIDO', null, null, null, null, current_date, null) r;

  if v_version <> 8
     or (select status from public.pedidos_personalizados_pedidos where id = v_pedido_moriah) <> 'RECEBIDO'
     or (select numero_lancamento from public.pedidos_personalizados_pedidos where id = v_pedido_moriah) <> '000001'
     or (select count(*) from public.pedidos_personalizados_status_historico where pedido_id = v_pedido_moriah) <> 7 then
    raise exception 'FLUXO_MORIAH_INVALIDO';
  end if;

  -- Exclusive: snapshots e fluxo sem estados de layout.
  select r.pedido_id, r.version
    into v_pedido_exclusive, v_version
  from public.criar_pedido_personalizado_lebebe_exclusive(
    v_usuario, gen_random_uuid(), v_exclusive, v_unidade,
    'VALIDACAO SQL', 'CLIENTE SINTETICO', '41999999999', null,
    jsonb_build_array(jsonb_build_object(
      'produto_id', v_produto_exclusive, 'ordem', 1,
      'quantidade', 2, 'nome_ou_letra', 'TESTE'
    ))
  ) r;

  if v_version <> 1 or (select status from public.pedidos_personalizados_pedidos where id = v_pedido_exclusive) <> 'RASCUNHO' then
    raise exception 'RASCUNHO_EXCLUSIVE_INVALIDO';
  end if;

  update public.pedidos_personalizados_lebebe_exclusive_catalogo
  set preco_unitario = preco_unitario + 1, custo_unitario = custo_unitario + 1
  where produto_id = v_produto_exclusive;

  if not exists (
    select 1
    from public.pedidos_personalizados_lebebe_exclusive_itens i
    where i.pedido_id = v_pedido_exclusive
      and i.preco_unitario_snapshot = v_preco
      and i.custo_unitario_snapshot = v_custo
      and i.total_venda = v_preco * 2
      and i.total_custo = v_custo * 2
  ) then raise exception 'SNAPSHOTS_EXCLUSIVE_INVALIDOS'; end if;

  select r.version into v_version from public.transicionar_pedido_personalizado(
    v_pedido_exclusive, v_version, v_usuario, 'VENDA FECHADA',
    '000002', null, null, null, null, null
  ) r;

  begin
    perform public.transicionar_pedido_personalizado(v_pedido_exclusive, v_version, v_usuario, 'AGUARDANDO LAYOUT', null, null, null, null, null, null);
    raise exception 'LAYOUT_EXCLUSIVE_NAO_REJEITADO';
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'TRANSICAO_STATUS_INVALIDA' then raise; end if;
  end;

  select r.version into v_version from public.transicionar_pedido_personalizado(v_pedido_exclusive, v_version, v_usuario, U&'EM PRODU\00C7\00C3O', null, '456', current_date, 'VALIDADOR', current_date + 7, null) r;
  select r.version into v_version from public.transicionar_pedido_personalizado(v_pedido_exclusive, v_version, v_usuario, 'RECEBIDO', null, null, null, null, current_date, null) r;
  select status into v_status from public.pedidos_personalizados_pedidos where id = v_pedido_exclusive;

  if v_status <> 'RECEBIDO' or v_version <> 4
     or (select numero_lancamento from public.pedidos_personalizados_pedidos where id = v_pedido_exclusive) <> '000002' then
    raise exception 'FLUXO_EXCLUSIVE_INVALIDO';
  end if;
end
$tests$;

select 'pedidos_personalizados_lebebe_exclusive_transacional_ok' as resultado;
rollback;
