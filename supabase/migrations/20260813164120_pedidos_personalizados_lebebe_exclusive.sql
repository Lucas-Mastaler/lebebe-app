-- Pedidos Personalizados: status globais e estruturas da Lebebe Exclusive.
-- O catálogo é carregado posteriormente pela RPC transacional criada ao fim.

alter table public.pedidos_personalizados_pedidos
  alter column status set default 'RASCUNHO';

alter table public.pedidos_personalizados_pedidos
  drop constraint pedidos_personalizados_pedidos_status_check;

alter table public.pedidos_personalizados_pedidos
  add constraint pedidos_personalizados_pedidos_status_check
  check (status in (
    'RASCUNHO',
    'VENDA FECHADA',
    'AGUARDANDO LAYOUT',
    U&'AGUARDANDO APROVA\00C7\00C3O DO CLIENTE',
    U&'EM PRODU\00C7\00C3O',
    'RECEBIDO',
    'CANCELADO'
  ));

alter table public.pedidos_personalizados_status_historico
  drop constraint pedidos_personalizados_status_historico_status_anterior_check,
  drop constraint pedidos_personalizados_status_historico_status_novo_check;

alter table public.pedidos_personalizados_status_historico
  add constraint pedidos_personalizados_status_historico_status_anterior_check
    check (status_anterior in (
      'RASCUNHO', 'VENDA FECHADA', 'AGUARDANDO LAYOUT',
      U&'AGUARDANDO APROVA\00C7\00C3O DO CLIENTE', U&'EM PRODU\00C7\00C3O',
      'RECEBIDO', 'CANCELADO'
    )),
  add constraint pedidos_personalizados_status_historico_status_novo_check
    check (status_novo in (
      'RASCUNHO', 'VENDA FECHADA', 'AGUARDANDO LAYOUT',
      U&'AGUARDANDO APROVA\00C7\00C3O DO CLIENTE', U&'EM PRODU\00C7\00C3O',
      'RECEBIDO', 'CANCELADO'
    ));

create table public.pedidos_personalizados_lebebe_exclusive_catalogo (
  produto_id uuid primary key
    references public.pedidos_personalizados_produtos(id) on delete cascade,
  colecao text not null,
  referencia text not null,
  preco_unitario numeric(12,2) not null,
  custo_unitario numeric(12,2) not null,
  colecao_busca text not null,
  descricao_busca text not null,
  referencia_busca text not null,
  linha_origem integer not null,
  arquivo_origem_sha256 text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pedidos_personalizados_lebebe_exclusive_catalogo_colecao_check
    check (colecao = btrim(colecao) and char_length(colecao) between 1 and 80),
  constraint pedidos_personalizados_lebebe_exclusive_catalogo_referencia_check
    check (referencia = btrim(referencia) and char_length(referencia) between 1 and 100),
  constraint pedidos_personalizados_lebebe_exclusive_catalogo_preco_check
    check (preco_unitario > 0),
  constraint pedidos_personalizados_lebebe_exclusive_catalogo_custo_check
    check (custo_unitario > 0),
  constraint pedidos_personalizados_lebebe_exclusive_catalogo_busca_check
    check (
      colecao_busca = btrim(colecao_busca) and colecao_busca <> ''
      and descricao_busca = btrim(descricao_busca) and descricao_busca <> ''
      and referencia_busca = btrim(referencia_busca) and referencia_busca <> ''
    ),
  constraint pedidos_personalizados_lebebe_exclusive_catalogo_linha_check
    check (linha_origem >= 2),
  constraint pedidos_personalizados_lebebe_exclusive_catalogo_hash_check
    check (arquivo_origem_sha256 ~ '^[A-F0-9]{64}$'),
  constraint pedidos_personalizados_lebebe_exclusive_catalogo_origem_unique
    unique (arquivo_origem_sha256, linha_origem)
);

create table public.pedidos_personalizados_lebebe_exclusive_itens (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null
    references public.pedidos_personalizados_pedidos(id) on delete cascade,
  produto_id uuid not null
    references public.pedidos_personalizados_produtos(id) on delete restrict,
  ordem integer not null,
  quantidade integer not null,
  nome_ou_letra text,
  colecao_snapshot text not null,
  descricao_snapshot text not null,
  referencia_snapshot text not null,
  preco_unitario_snapshot numeric(12,2) not null,
  custo_unitario_snapshot numeric(12,2) not null,
  total_venda numeric(14,2) generated always as
    ((preco_unitario_snapshot * quantidade)::numeric(14,2)) stored,
  total_custo numeric(14,2) generated always as
    ((custo_unitario_snapshot * quantidade)::numeric(14,2)) stored,
  created_by uuid not null
    references public.usuarios_permitidos(id) on delete restrict,
  updated_by uuid not null
    references public.usuarios_permitidos(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pedidos_personalizados_lebebe_exclusive_itens_pedido_ordem_unique
    unique (pedido_id, ordem) deferrable initially immediate,
  constraint pedidos_personalizados_lebebe_exclusive_itens_pedido_produto_unique
    unique (pedido_id, produto_id),
  constraint pedidos_personalizados_lebebe_exclusive_itens_ordem_check
    check (ordem >= 1),
  constraint pedidos_personalizados_lebebe_exclusive_itens_quantidade_check
    check (quantidade >= 1),
  constraint pedidos_personalizados_lebebe_exclusive_itens_nome_check
    check (
      nome_ou_letra is null
      or (nome_ou_letra = btrim(nome_ou_letra) and char_length(nome_ou_letra) between 1 and 200)
    ),
  constraint pedidos_personalizados_lebebe_exclusive_itens_snapshot_check
    check (
      colecao_snapshot = btrim(colecao_snapshot) and colecao_snapshot <> ''
      and descricao_snapshot = btrim(descricao_snapshot) and descricao_snapshot <> ''
      and referencia_snapshot = btrim(referencia_snapshot) and referencia_snapshot <> ''
      and preco_unitario_snapshot > 0
      and custo_unitario_snapshot > 0
    )
);

create index idx_pedidos_personalizados_lebebe_exclusive_itens_produto
  on public.pedidos_personalizados_lebebe_exclusive_itens (produto_id);

create trigger trg_pedidos_personalizados_lebebe_exclusive_catalogo_touch
  before update on public.pedidos_personalizados_lebebe_exclusive_catalogo
  for each row execute function public.pedidos_personalizados_touch_updated_at();

create trigger trg_pedidos_personalizados_lebebe_exclusive_itens_touch
  before update on public.pedidos_personalizados_lebebe_exclusive_itens
  for each row execute function public.pedidos_personalizados_touch_updated_at();

alter table public.pedidos_personalizados_lebebe_exclusive_catalogo enable row level security;
alter table public.pedidos_personalizados_lebebe_exclusive_itens enable row level security;

revoke all on table public.pedidos_personalizados_lebebe_exclusive_catalogo
  from public, anon, authenticated;
revoke all on table public.pedidos_personalizados_lebebe_exclusive_itens
  from public, anon, authenticated;
grant select, insert, update, delete
  on table public.pedidos_personalizados_lebebe_exclusive_catalogo to service_role;
grant select, insert, update, delete
  on table public.pedidos_personalizados_lebebe_exclusive_itens to service_role;

-- Preserva a edição Moriah já existente e apenas troca o antigo CADASTRADO
-- pelos dois estados aprovados que antecedem o layout.
do $migration$
declare
  v_definicao text;
begin
  select pg_get_functiondef(
    'public.atualizar_pedido_personalizado_comercial_moriah(uuid,integer,uuid,uuid,text,text,jsonb)'::regprocedure
  ) into v_definicao;

  if (select count(*) from regexp_matches(v_definicao, '''CADASTRADO''', 'g')) <> 1 then
    raise exception 'DEFINICAO_COMERCIAL_MORIAH_INESPERADA';
  end if;

  execute replace(v_definicao, '''CADASTRADO''', '''RASCUNHO'', ''VENDA FECHADA''');
end;
$migration$;

-- A edição administrativa não cria transições: o status recebido pela API
-- deve permanecer igual ao atual. A lista aceita os sete estados vigentes.
create or replace function public.atualizar_pedido_personalizado_administrativo(
  p_pedido_id uuid,
  p_expected_version integer,
  p_usuario_id uuid,
  p_numero_lancamento text,
  p_data_entrega date,
  p_data_pedido_fornecedor date,
  p_numero_pedido_compra text,
  p_comprador text,
  p_status text,
  p_layout_tapetes jsonb default '[]'::jsonb
)
returns table (version integer)
language plpgsql
security invoker
set search_path = pg_catalog, public
as $function$
declare
  v_pedido public.pedidos_personalizados_pedidos%rowtype;
  v_layout jsonb;
  v_nova_version integer;
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
  if p_status <> v_pedido.status then
    raise exception 'ALTERACAO_STATUS_FORA_DO_FLUXO' using errcode = 'P0001';
  end if;
  if p_status not in (
    'RASCUNHO', 'VENDA FECHADA', 'AGUARDANDO LAYOUT',
    U&'AGUARDANDO APROVA\00C7\00C3O DO CLIENTE', U&'EM PRODU\00C7\00C3O',
    'RECEBIDO', 'CANCELADO'
  ) then raise exception 'STATUS_INVALIDO' using errcode = '22023'; end if;
  if p_layout_tapetes is null or jsonb_typeof(p_layout_tapetes) <> 'array' then
    raise exception 'LAYOUT_INVALIDO' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_layout_tapetes) as item(value)
    where item.value->>'tapete_id' is null
       or item.value->>'tapete_id' !~* '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
       or jsonb_typeof(item.value->'teve_alteracao_layout') <> 'boolean'
       or ((item.value->>'teve_alteracao_layout')::boolean = false
           and item.value->>'quantidade_alteracoes_layout' is not null)
       or ((item.value->>'teve_alteracao_layout')::boolean = true and (
           item.value->>'quantidade_alteracoes_layout' is null
           or item.value->>'quantidade_alteracoes_layout' !~ '^[0-9]+$'
           or (item.value->>'quantidade_alteracoes_layout')::integer < 1))
  ) or exists (
    select 1 from jsonb_array_elements(p_layout_tapetes) as item(value)
    group by item.value->>'tapete_id' having count(*) > 1
  ) then raise exception 'LAYOUT_INVALIDO' using errcode = '22023'; end if;
  if exists (
    select 1 from jsonb_array_elements(p_layout_tapetes) as item(value)
    where not exists (
      select 1 from public.pedidos_personalizados_moriah_tapetes as tapete
      where tapete.id = (item.value->>'tapete_id')::uuid
        and tapete.pedido_id = p_pedido_id
    )
  ) then raise exception 'TAPETE_NAO_PERTENCE_AO_PEDIDO' using errcode = '23514'; end if;

  update public.pedidos_personalizados_pedidos
  set numero_lancamento = p_numero_lancamento,
      data_entrega = p_data_entrega,
      data_pedido_fornecedor = p_data_pedido_fornecedor,
      numero_pedido_compra = p_numero_pedido_compra,
      comprador = p_comprador,
      version = pedidos_personalizados_pedidos.version + 1,
      updated_by = p_usuario_id
  where id = p_pedido_id
  returning pedidos_personalizados_pedidos.version into v_nova_version;

  for v_layout in select item.value from jsonb_array_elements(p_layout_tapetes) as item(value)
  loop
    update public.pedidos_personalizados_moriah_tapetes
    set teve_alteracao_layout = (v_layout->>'teve_alteracao_layout')::boolean,
        quantidade_alteracoes_layout = nullif(v_layout->>'quantidade_alteracoes_layout', '')::integer,
        updated_by = p_usuario_id
    where id = (v_layout->>'tapete_id')::uuid;
  end loop;

  return query select v_nova_version;
end;
$function$;

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
  v_fornecedor_chave text;
  v_evento_id uuid := gen_random_uuid();
  v_nova_version integer;
  v_numero_pedido_compra text;
  v_data_pedido_fornecedor date;
  v_comprador text;
  v_data_entrega date;
  v_data_recebimento date;
  v_justificativa text;
  v_preenche_dados_compra boolean;
begin
  if p_usuario_id is null or not exists (
    select 1 from public.usuarios_permitidos as usuario
    where usuario.id = p_usuario_id and usuario.ativo = true
  ) then raise exception 'USUARIO_INVALIDO' using errcode = '42501'; end if;
  if p_expected_version is null or p_expected_version < 1 then
    raise exception 'VERSAO_INVALIDA' using errcode = '22023';
  end if;

  select pedido.*
    into v_pedido
  from public.pedidos_personalizados_pedidos as pedido
  where pedido.id = p_pedido_id
  for update;

  if not found then raise exception 'PEDIDO_NAO_ENCONTRADO' using errcode = 'P0002'; end if;
  if v_pedido.version <> p_expected_version then
    raise exception 'CONFLITO_VERSAO' using errcode = 'P0003';
  end if;

  select chave into v_fornecedor_chave
  from public.pedidos_personalizados_fornecedores
  where id = v_pedido.fornecedor_id;

  if not (
    (v_pedido.status = 'RASCUNHO' and p_status_destino in ('VENDA FECHADA', 'CANCELADO'))
    or (v_fornecedor_chave = 'moriah_tapetes' and (
      (v_pedido.status = 'VENDA FECHADA' and p_status_destino in ('AGUARDANDO LAYOUT', 'CANCELADO'))
      or (v_pedido.status = 'AGUARDANDO LAYOUT' and p_status_destino in (U&'AGUARDANDO APROVA\00C7\00C3O DO CLIENTE', 'CANCELADO'))
      or (v_pedido.status = U&'AGUARDANDO APROVA\00C7\00C3O DO CLIENTE' and p_status_destino in (U&'EM PRODU\00C7\00C3O', 'AGUARDANDO LAYOUT', 'CANCELADO'))
      or (v_pedido.status = U&'EM PRODU\00C7\00C3O' and p_status_destino in ('RECEBIDO', 'CANCELADO'))
    ))
    or (v_fornecedor_chave = 'lebebe_exclusive' and (
      (v_pedido.status = 'VENDA FECHADA' and p_status_destino in (U&'EM PRODU\00C7\00C3O', 'CANCELADO'))
      or (v_pedido.status = U&'EM PRODU\00C7\00C3O' and p_status_destino in ('RECEBIDO', 'CANCELADO'))
    ))
  ) then raise exception 'TRANSICAO_STATUS_INVALIDA' using errcode = 'P0001'; end if;

  if v_fornecedor_chave = 'moriah_tapetes'
     and p_status_destino in (U&'AGUARDANDO APROVA\00C7\00C3O DO CLIENTE', U&'EM PRODU\00C7\00C3O')
     and not exists (
       select 1 from public.pedidos_personalizados_moriah_tapetes as tapete
       join public.pedidos_personalizados_anexos as anexo on anexo.tapete_id = tapete.id
       where tapete.pedido_id = p_pedido_id
     )
  then raise exception 'ANEXO_LAYOUT_OBRIGATORIO' using errcode = '23514'; end if;

  v_numero_pedido_compra := coalesce(p_numero_pedido_compra, v_pedido.numero_pedido_compra);
  v_data_pedido_fornecedor := coalesce(p_data_pedido_fornecedor, v_pedido.data_pedido_fornecedor);
  v_comprador := coalesce(nullif(btrim(p_comprador), ''), v_pedido.comprador);
  v_data_entrega := case when p_status_destino = U&'EM PRODU\00C7\00C3O'
    then coalesce(p_data_entrega, v_pedido.data_entrega) else v_pedido.data_entrega end;
  v_data_recebimento := case when p_status_destino = 'RECEBIDO' then p_data_entrega else null end;
  v_justificativa := nullif(btrim(p_justificativa), '');
  v_preenche_dados_compra :=
    (v_fornecedor_chave = 'moriah_tapetes' and v_pedido.status = 'VENDA FECHADA' and p_status_destino = 'AGUARDANDO LAYOUT')
    or (v_fornecedor_chave = 'lebebe_exclusive' and v_pedido.status = 'VENDA FECHADA' and p_status_destino = U&'EM PRODU\00C7\00C3O');

  if v_preenche_dados_compra and (
    v_numero_pedido_compra is null or v_numero_pedido_compra !~ '^[0-9]{1,5}$'
    or v_data_pedido_fornecedor is null or v_comprador is null
    or char_length(btrim(v_comprador)) not between 2 and 40
  ) then raise exception 'CAMPOS_PRODUCAO_OBRIGATORIOS' using errcode = '23514'; end if;
  if p_status_destino = U&'EM PRODU\00C7\00C3O' and (
    v_numero_pedido_compra is null or v_numero_pedido_compra !~ '^[0-9]{1,5}$'
    or v_data_pedido_fornecedor is null or v_comprador is null
    or char_length(btrim(v_comprador)) not between 2 and 40
  ) then raise exception 'CAMPOS_PRODUCAO_OBRIGATORIOS' using errcode = '23514'; end if;
  if p_status_destino = U&'EM PRODU\00C7\00C3O' and v_data_entrega is null then
    raise exception 'DATA_ENTREGA_OBRIGATORIA' using errcode = '23514';
  end if;
  if p_status_destino = 'RECEBIDO' and v_data_recebimento is null then
    raise exception 'DATA_RECEBIMENTO_OBRIGATORIA' using errcode = '23514';
  end if;
  if p_status_destino = 'CANCELADO' and (v_justificativa is null or char_length(v_justificativa) > 500) then
    raise exception 'JUSTIFICATIVA_CANCELAMENTO_OBRIGATORIA' using errcode = '23514';
  end if;
  if p_status_destino <> 'CANCELADO' and v_justificativa is not null then
    raise exception 'JUSTIFICATIVA_NAO_PERMITIDA' using errcode = '22023';
  end if;

  update public.pedidos_personalizados_pedidos as pedido
  set status = p_status_destino,
      numero_pedido_compra = case when v_preenche_dados_compra then v_numero_pedido_compra else pedido.numero_pedido_compra end,
      data_pedido_fornecedor = case when v_preenche_dados_compra then v_data_pedido_fornecedor else pedido.data_pedido_fornecedor end,
      comprador = case when v_preenche_dados_compra then v_comprador else pedido.comprador end,
      data_entrega = case when p_status_destino = U&'EM PRODU\00C7\00C3O' then v_data_entrega else pedido.data_entrega end,
      version = pedido.version + 1,
      updated_by = p_usuario_id
  where pedido.id = p_pedido_id
  returning pedido.version into v_nova_version;

  insert into public.pedidos_personalizados_status_historico (
    id, pedido_id, status_anterior, status_novo, usuario_id, unidade_id,
    version_anterior, version_nova, justificativa, data_recebimento
  ) values (
    v_evento_id, p_pedido_id, v_pedido.status, p_status_destino, p_usuario_id,
    v_pedido.unidade_id, v_pedido.version, v_nova_version,
    case when p_status_destino = 'CANCELADO' then v_justificativa else null end,
    v_data_recebimento
  );
  return query select v_evento_id, p_status_destino, v_nova_version;
end;
$function$;

create or replace function public.importar_catalogo_lebebe_exclusive(
  p_arquivo_sha256 text,
  p_itens jsonb
)
returns table(total_importado integer)
language plpgsql
security invoker
set search_path = pg_catalog, public
as $function$
declare
  v_fornecedor_id uuid;
  v_item jsonb;
  v_produto_id uuid;
  v_total integer := 0;
begin
  if p_arquivo_sha256 is null or p_arquivo_sha256 !~ '^[A-F0-9]{64}$' then
    raise exception 'HASH_ARQUIVO_INVALIDO' using errcode = '22023';
  end if;
  if p_itens is null or jsonb_typeof(p_itens) <> 'array' or jsonb_array_length(p_itens) <> 3077 then
    raise exception 'QUANTIDADE_CATALOGO_INVALIDA' using errcode = '22023';
  end if;

  select id into v_fornecedor_id
  from public.pedidos_personalizados_fornecedores
  where chave = 'lebebe_exclusive'
  for update;
  if not found then raise exception 'FORNECEDOR_NAO_ENCONTRADO' using errcode = 'P0002'; end if;

  if exists (
    select 1 from jsonb_array_elements(p_itens) as item(value)
    group by item.value->>'codigo' having count(*) > 1
  ) or exists (
    select 1 from jsonb_array_elements(p_itens) as item(value)
    group by item.value->>'linha_origem' having count(*) > 1
  ) then raise exception 'CATALOGO_DUPLICADO' using errcode = '23505'; end if;

  for v_item in
    select item.value from jsonb_array_elements(p_itens) as item(value)
    order by (item.value->>'ordem')::integer
  loop
    if v_item->>'codigo' !~ '^LEX-[A-F0-9]{32}$'
       or v_item->>'descricao' is null or btrim(v_item->>'descricao') = ''
       or v_item->>'colecao' is null or btrim(v_item->>'colecao') = ''
       or v_item->>'referencia' is null or btrim(v_item->>'referencia') = ''
       or v_item->>'ordem' !~ '^[0-9]+$'
       or v_item->>'linha_origem' !~ '^[0-9]+$'
       or v_item->>'preco_unitario' !~ '^[0-9]+(\.[0-9]{1,2})?$'
       or v_item->>'custo_unitario' !~ '^[0-9]+(\.[0-9]{1,2})?$'
       or v_item->>'colecao_busca' is null or btrim(v_item->>'colecao_busca') = ''
       or v_item->>'descricao_busca' is null or btrim(v_item->>'descricao_busca') = ''
       or v_item->>'referencia_busca' is null or btrim(v_item->>'referencia_busca') = ''
    then raise exception 'ITEM_CATALOGO_INVALIDO' using errcode = '22023'; end if;

    insert into public.pedidos_personalizados_produtos (
      fornecedor_id, codigo, descricao, ativo, ordem
    ) values (
      v_fornecedor_id, v_item->>'codigo', v_item->>'descricao', true,
      (v_item->>'ordem')::integer
    )
    on conflict (fornecedor_id, codigo) do update
      set descricao = excluded.descricao, ativo = true, ordem = excluded.ordem
    returning id into v_produto_id;

    insert into public.pedidos_personalizados_lebebe_exclusive_catalogo (
      produto_id, colecao, referencia, preco_unitario, custo_unitario,
      colecao_busca, descricao_busca, referencia_busca,
      linha_origem, arquivo_origem_sha256
    ) values (
      v_produto_id, v_item->>'colecao', v_item->>'referencia',
      (v_item->>'preco_unitario')::numeric(12,2),
      (v_item->>'custo_unitario')::numeric(12,2),
      v_item->>'colecao_busca', v_item->>'descricao_busca', v_item->>'referencia_busca',
      (v_item->>'linha_origem')::integer, p_arquivo_sha256
    )
    on conflict (produto_id) do update set
      colecao = excluded.colecao,
      referencia = excluded.referencia,
      preco_unitario = excluded.preco_unitario,
      custo_unitario = excluded.custo_unitario,
      colecao_busca = excluded.colecao_busca,
      descricao_busca = excluded.descricao_busca,
      referencia_busca = excluded.referencia_busca,
      linha_origem = excluded.linha_origem,
      arquivo_origem_sha256 = excluded.arquivo_origem_sha256;
    v_total := v_total + 1;
  end loop;

  update public.pedidos_personalizados_fornecedores
  set disponivel = true
  where id = v_fornecedor_id;

  return query select v_total;
end;
$function$;

revoke all on function public.importar_catalogo_lebebe_exclusive(text, jsonb)
  from public, anon, authenticated;
grant execute on function public.importar_catalogo_lebebe_exclusive(text, jsonb)
  to service_role;

revoke all on function public.atualizar_pedido_personalizado_administrativo(
  uuid, integer, uuid, text, date, date, text, text, text, jsonb
) from public, anon, authenticated;
grant execute on function public.atualizar_pedido_personalizado_administrativo(
  uuid, integer, uuid, text, date, date, text, text, text, jsonb
) to service_role;

revoke all on function public.transicionar_pedido_personalizado(
  uuid, integer, uuid, text, text, date, text, date, text
) from public, anon, authenticated;
grant execute on function public.transicionar_pedido_personalizado(
  uuid, integer, uuid, text, text, date, text, date, text
) to service_role;

do $validation$
begin
  if exists (
    select 1 from public.pedidos_personalizados_pedidos where status = 'CADASTRADO'
  ) or exists (
    select 1 from public.pedidos_personalizados_status_historico
    where status_anterior = 'CADASTRADO' or status_novo = 'CADASTRADO'
  ) then raise exception 'STATUS_CADASTRADO_REMANESCENTE'; end if;

  if (
    select count(*) from pg_class as tabela
    join pg_namespace as esquema on esquema.oid = tabela.relnamespace
    where esquema.nspname = 'public'
      and tabela.relname in (
        'pedidos_personalizados_lebebe_exclusive_catalogo',
        'pedidos_personalizados_lebebe_exclusive_itens'
      )
      and tabela.relrowsecurity = true
  ) <> 2 then raise exception 'RLS_LEBEBE_EXCLUSIVE_INVALIDA'; end if;

  if exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename in (
        'pedidos_personalizados_lebebe_exclusive_catalogo',
        'pedidos_personalizados_lebebe_exclusive_itens'
      )
  ) then raise exception 'POLICY_LEBEBE_EXCLUSIVE_INDEVIDA'; end if;
end;
$validation$;
