-- Criação e edição transacionais dos rascunhos Lebebe Exclusive.

create function public.criar_pedido_personalizado_lebebe_exclusive(
  p_usuario_id uuid,
  p_idempotency_key uuid,
  p_fornecedor_id uuid,
  p_unidade_id uuid,
  p_consultora text,
  p_cliente text,
  p_telefone_normalizado text,
  p_numero_lancamento text,
  p_itens jsonb
)
returns table (
  pedido_id uuid,
  version integer,
  reutilizado boolean,
  itens jsonb
)
language plpgsql
security invoker
set search_path = pg_catalog, public
as $function$
declare
  v_pedido public.pedidos_personalizados_pedidos%rowtype;
  v_item jsonb;
  v_catalogo record;
  v_item_id uuid;
  v_total_itens integer;
  v_itens_retorno jsonb := '[]'::jsonb;
begin
  if p_usuario_id is null or not exists (
    select 1 from public.usuarios_permitidos where id = p_usuario_id and ativo = true
  ) then raise exception 'USUARIO_INVALIDO' using errcode = '42501'; end if;
  if p_idempotency_key is null then
    raise exception 'IDEMPOTENCY_KEY_INVALIDA' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(p_usuario_id::text || ':' || p_idempotency_key::text, 0)
  );

  select * into v_pedido
  from public.pedidos_personalizados_pedidos
  where created_by = p_usuario_id and idempotency_key = p_idempotency_key;

  if found then
    if v_pedido.fornecedor_id <> p_fornecedor_id then
      raise exception 'IDEMPOTENCY_KEY_CONFLITO' using errcode = '23505';
    end if;
    return query
    select v_pedido.id, v_pedido.version, true,
      coalesce((
        select jsonb_agg(jsonb_build_object('id', item.id, 'ordem', item.ordem) order by item.ordem)
        from public.pedidos_personalizados_lebebe_exclusive_itens as item
        where item.pedido_id = v_pedido.id
      ), '[]'::jsonb);
    return;
  end if;

  if not exists (
    select 1 from public.pedidos_personalizados_fornecedores
    where id = p_fornecedor_id and chave = 'lebebe_exclusive' and disponivel = true
  ) then raise exception 'FORNECEDOR_INDISPONIVEL' using errcode = '23514'; end if;
  if not exists (
    select 1 from public.app_unidades
    where id = p_unidade_id and ativo = true
      and chave in ('bigorrilho', 'portao', 'marechal', 'feira')
  ) then raise exception 'UNIDADE_NAO_PERMITIDA' using errcode = '22023'; end if;
  if p_consultora is null or char_length(btrim(p_consultora)) not between 2 and 20 then
    raise exception 'CONSULTORA_INVALIDA' using errcode = '22023';
  end if;
  if p_cliente is null or char_length(btrim(p_cliente)) not between 1 and 40 then
    raise exception 'CLIENTE_INVALIDO' using errcode = '22023';
  end if;
  if p_telefone_normalizado is null
     or p_telefone_normalizado !~ '^[0-9]{10,11}$'
     or left(p_telefone_normalizado, 2) = '00'
  then raise exception 'TELEFONE_INVALIDO' using errcode = '22023'; end if;
  if p_numero_lancamento is not null and p_numero_lancamento !~ '^[0-9]{1,6}$' then
    raise exception 'NUMERO_LANCAMENTO_INVALIDO' using errcode = '22023';
  end if;
  if p_itens is null or jsonb_typeof(p_itens) <> 'array' or jsonb_array_length(p_itens) < 1 then
    raise exception 'ITENS_OBRIGATORIOS' using errcode = '22023';
  end if;

  v_total_itens := jsonb_array_length(p_itens);
  if exists (
    select 1 from jsonb_array_elements(p_itens) as item(value)
    where jsonb_typeof(item.value) <> 'object'
       or item.value->>'produto_id' !~* '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
       or item.value->>'ordem' !~ '^[0-9]+$'
       or (item.value->>'ordem')::integer not between 1 and v_total_itens
       or item.value->>'quantidade' !~ '^[0-9]+$'
       or (item.value->>'quantidade')::integer < 1
       or (item.value->>'nome_ou_letra' is not null and (
         btrim(item.value->>'nome_ou_letra') = ''
         or char_length(btrim(item.value->>'nome_ou_letra')) > 200
       ))
  ) or exists (
    select 1 from jsonb_array_elements(p_itens) as item(value)
    group by item.value->>'ordem' having count(*) > 1
  ) or exists (
    select 1 from jsonb_array_elements(p_itens) as item(value)
    group by item.value->>'produto_id' having count(*) > 1
  ) then raise exception 'ITEM_PEDIDO_INVALIDO' using errcode = '22023'; end if;

  insert into public.pedidos_personalizados_pedidos (
    fornecedor_id, unidade_id, consultora, cliente, telefone_normalizado,
    numero_lancamento, idempotency_key, created_by, updated_by
  ) values (
    p_fornecedor_id, p_unidade_id, btrim(p_consultora), btrim(p_cliente),
    p_telefone_normalizado, p_numero_lancamento, p_idempotency_key,
    p_usuario_id, p_usuario_id
  ) returning * into v_pedido;

  for v_item in
    select item.value from jsonb_array_elements(p_itens) as item(value)
    order by (item.value->>'ordem')::integer
  loop
    select produto.id, produto.descricao, catalogo.colecao, catalogo.referencia,
           catalogo.preco_unitario, catalogo.custo_unitario
      into v_catalogo
    from public.pedidos_personalizados_produtos as produto
    join public.pedidos_personalizados_lebebe_exclusive_catalogo as catalogo
      on catalogo.produto_id = produto.id
    where produto.id = (v_item->>'produto_id')::uuid
      and produto.fornecedor_id = p_fornecedor_id
      and produto.ativo = true;
    if not found then raise exception 'PRODUTO_FORNECEDOR_INVALIDO' using errcode = '23514'; end if;

    insert into public.pedidos_personalizados_lebebe_exclusive_itens (
      pedido_id, produto_id, ordem, quantidade, nome_ou_letra,
      colecao_snapshot, descricao_snapshot, referencia_snapshot,
      preco_unitario_snapshot, custo_unitario_snapshot, created_by, updated_by
    ) values (
      v_pedido.id, v_catalogo.id, (v_item->>'ordem')::integer,
      (v_item->>'quantidade')::integer, nullif(btrim(v_item->>'nome_ou_letra'), ''),
      v_catalogo.colecao, v_catalogo.descricao, v_catalogo.referencia,
      v_catalogo.preco_unitario, v_catalogo.custo_unitario,
      p_usuario_id, p_usuario_id
    ) returning id into v_item_id;

    v_itens_retorno := v_itens_retorno || jsonb_build_array(
      jsonb_build_object('id', v_item_id, 'ordem', (v_item->>'ordem')::integer)
    );
  end loop;

  return query select v_pedido.id, v_pedido.version, false, v_itens_retorno;
end;
$function$;

create function public.atualizar_pedido_personalizado_comercial_lebebe_exclusive(
  p_pedido_id uuid,
  p_expected_version integer,
  p_usuario_id uuid,
  p_unidade_id uuid,
  p_consultora text,
  p_cliente text,
  p_telefone_normalizado text,
  p_numero_lancamento text,
  p_itens jsonb
)
returns table (version integer, itens jsonb)
language plpgsql
security invoker
set search_path = pg_catalog, public
as $function$
declare
  v_pedido public.pedidos_personalizados_pedidos%rowtype;
  v_item jsonb;
  v_catalogo record;
  v_item_id uuid;
  v_total_itens integer;
  v_nova_version integer;
  v_itens_retorno jsonb := '[]'::jsonb;
begin
  if p_usuario_id is null or not exists (
    select 1 from public.usuarios_permitidos where id = p_usuario_id and ativo = true
  ) then raise exception 'USUARIO_INVALIDO' using errcode = '42501'; end if;
  select * into v_pedido from public.pedidos_personalizados_pedidos
  where id = p_pedido_id for update;
  if not found then raise exception 'PEDIDO_NAO_ENCONTRADO' using errcode = 'P0002'; end if;
  if v_pedido.version <> p_expected_version then
    raise exception 'CONFLITO_VERSAO' using errcode = 'P0003';
  end if;
  if v_pedido.status <> 'RASCUNHO' then
    raise exception 'EDICAO_COMERCIAL_BLOQUEADA' using errcode = 'P0001';
  end if;
  if not exists (
    select 1 from public.pedidos_personalizados_fornecedores
    where id = v_pedido.fornecedor_id and chave = 'lebebe_exclusive'
  ) then raise exception 'FORNECEDOR_NAO_SUPORTADO' using errcode = '22023'; end if;
  if not exists (
    select 1 from public.app_unidades
    where id = p_unidade_id and ativo = true
      and chave in ('bigorrilho', 'portao', 'marechal', 'feira')
  ) then raise exception 'UNIDADE_NAO_PERMITIDA' using errcode = '22023'; end if;
  if p_consultora is null or char_length(btrim(p_consultora)) not between 2 and 20 then
    raise exception 'CONSULTORA_INVALIDA' using errcode = '22023';
  end if;
  if p_cliente is null or char_length(btrim(p_cliente)) not between 1 and 40 then
    raise exception 'CLIENTE_INVALIDO' using errcode = '22023';
  end if;
  if p_telefone_normalizado is null
     or p_telefone_normalizado !~ '^[0-9]{10,11}$'
     or left(p_telefone_normalizado, 2) = '00'
  then raise exception 'TELEFONE_INVALIDO' using errcode = '22023'; end if;
  if p_numero_lancamento is not null and p_numero_lancamento !~ '^[0-9]{1,6}$' then
    raise exception 'NUMERO_LANCAMENTO_INVALIDO' using errcode = '22023';
  end if;
  if p_itens is null or jsonb_typeof(p_itens) <> 'array' or jsonb_array_length(p_itens) < 1 then
    raise exception 'ITENS_OBRIGATORIOS' using errcode = '22023';
  end if;

  v_total_itens := jsonb_array_length(p_itens);
  if exists (
    select 1 from jsonb_array_elements(p_itens) as item(value)
    where jsonb_typeof(item.value) <> 'object'
       or item.value->>'produto_id' !~* '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
       or item.value->>'ordem' !~ '^[0-9]+$'
       or (item.value->>'ordem')::integer not between 1 and v_total_itens
       or item.value->>'quantidade' !~ '^[0-9]+$'
       or (item.value->>'quantidade')::integer < 1
       or (item.value->>'nome_ou_letra' is not null and (
         btrim(item.value->>'nome_ou_letra') = ''
         or char_length(btrim(item.value->>'nome_ou_letra')) > 200
       ))
  ) or exists (
    select 1 from jsonb_array_elements(p_itens) as item(value)
    group by item.value->>'ordem' having count(*) > 1
  ) or exists (
    select 1 from jsonb_array_elements(p_itens) as item(value)
    group by item.value->>'produto_id' having count(*) > 1
  ) then raise exception 'ITEM_PEDIDO_INVALIDO' using errcode = '22023'; end if;

  delete from public.pedidos_personalizados_lebebe_exclusive_itens
  where pedido_id = p_pedido_id;

  for v_item in
    select item.value from jsonb_array_elements(p_itens) as item(value)
    order by (item.value->>'ordem')::integer
  loop
    select produto.id, produto.descricao, catalogo.colecao, catalogo.referencia,
           catalogo.preco_unitario, catalogo.custo_unitario
      into v_catalogo
    from public.pedidos_personalizados_produtos as produto
    join public.pedidos_personalizados_lebebe_exclusive_catalogo as catalogo
      on catalogo.produto_id = produto.id
    where produto.id = (v_item->>'produto_id')::uuid
      and produto.fornecedor_id = v_pedido.fornecedor_id
      and produto.ativo = true;
    if not found then raise exception 'PRODUTO_FORNECEDOR_INVALIDO' using errcode = '23514'; end if;

    insert into public.pedidos_personalizados_lebebe_exclusive_itens (
      pedido_id, produto_id, ordem, quantidade, nome_ou_letra,
      colecao_snapshot, descricao_snapshot, referencia_snapshot,
      preco_unitario_snapshot, custo_unitario_snapshot, created_by, updated_by
    ) values (
      p_pedido_id, v_catalogo.id, (v_item->>'ordem')::integer,
      (v_item->>'quantidade')::integer, nullif(btrim(v_item->>'nome_ou_letra'), ''),
      v_catalogo.colecao, v_catalogo.descricao, v_catalogo.referencia,
      v_catalogo.preco_unitario, v_catalogo.custo_unitario,
      p_usuario_id, p_usuario_id
    ) returning id into v_item_id;
    v_itens_retorno := v_itens_retorno || jsonb_build_array(
      jsonb_build_object('id', v_item_id, 'ordem', (v_item->>'ordem')::integer)
    );
  end loop;

  update public.pedidos_personalizados_pedidos
  set unidade_id = p_unidade_id,
      consultora = btrim(p_consultora),
      cliente = btrim(p_cliente),
      telefone_normalizado = p_telefone_normalizado,
      numero_lancamento = p_numero_lancamento,
      version = pedidos_personalizados_pedidos.version + 1,
      updated_by = p_usuario_id
  where id = p_pedido_id
  returning pedidos_personalizados_pedidos.version into v_nova_version;

  return query select v_nova_version, v_itens_retorno;
end;
$function$;

revoke all on function public.criar_pedido_personalizado_lebebe_exclusive(
  uuid, uuid, uuid, uuid, text, text, text, text, jsonb
) from public, anon, authenticated;
grant execute on function public.criar_pedido_personalizado_lebebe_exclusive(
  uuid, uuid, uuid, uuid, text, text, text, text, jsonb
) to service_role;

revoke all on function public.atualizar_pedido_personalizado_comercial_lebebe_exclusive(
  uuid, integer, uuid, uuid, text, text, text, text, jsonb
) from public, anon, authenticated;
grant execute on function public.atualizar_pedido_personalizado_comercial_lebebe_exclusive(
  uuid, integer, uuid, uuid, text, text, text, text, jsonb
) to service_role;
