-- Pedidos Personalizados / Lebebe Exclusive: criação manual e retomável no SGI.
-- A integração é enfileirada pelo App e consumida por um worker outbound na VPS.

create table public.pedidos_personalizados_lebebe_exclusive_sgi (
  pedido_id uuid primary key
    references public.pedidos_personalizados_pedidos(id) on delete restrict,
  status_integracao text not null default 'PENDENTE',
  etapa text not null default 'NAO_INICIADO',
  modelo_produto_id_sgi text not null default '39879',
  modelo_nome_esperado text not null
    default U&'LEBEBE EXCLUSIVE (MODELO PADR\00C3O - N\00C3O USAR)',
  unidade_snapshot text not null,
  numero_lancamento_snapshot text not null,
  nome_produto_sgi text not null,
  custo_enviado numeric(14,2) not null,
  preco_enviado numeric(14,2) not null,
  produto_id_sgi text,
  codigo_sgi text,
  procedimento_custo_sgi text,
  numero_lancamento_entrada_sgi text,
  documento_entrada_id_sgi text,
  procedimento_finalizacao_sgi text,
  tabela_preco_id_sgi text,
  item_tabela_preco_id_sgi text,
  claim_token uuid,
  claim_expira_em timestamptz,
  tentativas integer not null default 0,
  erro_codigo text,
  erro_mensagem text,
  eventos jsonb not null default '[]'::jsonb,
  solicitado_por uuid not null
    references public.usuarios_permitidos(id) on delete restrict,
  ultima_solicitacao_por uuid not null
    references public.usuarios_permitidos(id) on delete restrict,
  solicitado_em timestamptz not null default now(),
  iniciado_em timestamptz,
  concluido_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pp_lex_sgi_status_check check (
    status_integracao in ('PENDENTE', 'PROCESSANDO', 'ERRO', 'CONCLUIDO')
  ),
  constraint pp_lex_sgi_etapa_check check (
    etapa in (
      'NAO_INICIADO',
      'PRODUTO_DUPLICADO',
      'PRODUTO_RENOMEADO',
      'CUSTO_CRIADO',
      'CUSTO_FINALIZADO',
      'PRECO_ATUALIZADO',
      'CONCLUIDO'
    )
  ),
  constraint pp_lex_sgi_modelo_check check (
    modelo_produto_id_sgi = '39879'
    and modelo_nome_esperado = U&'LEBEBE EXCLUSIVE (MODELO PADR\00C3O - N\00C3O USAR)'
  ),
  constraint pp_lex_sgi_lancamento_check check (
    numero_lancamento_snapshot ~ '^[0-9]{1,6}$'
  ),
  constraint pp_lex_sgi_nome_check check (
    nome_produto_sgi = btrim(nome_produto_sgi)
    and nome_produto_sgi ~ U&'^LEBEBE EXCLUSIVE \\(.+ [0-9]{1,6}\\)$'
    and char_length(nome_produto_sgi) <= 120
  ),
  constraint pp_lex_sgi_valores_check check (
    custo_enviado > 0 and preco_enviado > 0
  ),
  constraint pp_lex_sgi_claim_check check (
    (claim_token is null and claim_expira_em is null)
    or (claim_token is not null and claim_expira_em is not null and status_integracao = 'PROCESSANDO')
  ),
  constraint pp_lex_sgi_tentativas_check check (tentativas >= 0),
  constraint pp_lex_sgi_erro_check check (
    (status_integracao = 'ERRO' and erro_codigo is not null and erro_mensagem is not null)
    or (status_integracao <> 'ERRO' and erro_codigo is null and erro_mensagem is null)
  ),
  constraint pp_lex_sgi_conclusao_check check (
    status_integracao <> 'CONCLUIDO'
    or (
      etapa = 'CONCLUIDO'
      and produto_id_sgi is not null
      and codigo_sgi is not null
      and concluido_em is not null
    )
  ),
  constraint pp_lex_sgi_eventos_check check (
    jsonb_typeof(eventos) = 'array' and jsonb_array_length(eventos) <= 100
  )
);

create unique index idx_pp_lex_sgi_produto_id
  on public.pedidos_personalizados_lebebe_exclusive_sgi (produto_id_sgi)
  where produto_id_sgi is not null;

create unique index idx_pp_lex_sgi_codigo
  on public.pedidos_personalizados_lebebe_exclusive_sgi (codigo_sgi)
  where codigo_sgi is not null;

create index idx_pp_lex_sgi_fila
  on public.pedidos_personalizados_lebebe_exclusive_sgi (solicitado_em, pedido_id)
  where status_integracao = 'PENDENTE';

create index idx_pp_lex_sgi_solicitado_por
  on public.pedidos_personalizados_lebebe_exclusive_sgi (solicitado_por);

create index idx_pp_lex_sgi_ultima_solicitacao_por
  on public.pedidos_personalizados_lebebe_exclusive_sgi (ultima_solicitacao_por);

create trigger trg_pp_lex_sgi_touch
  before update on public.pedidos_personalizados_lebebe_exclusive_sgi
  for each row execute function public.pedidos_personalizados_touch_updated_at();

alter table public.pedidos_personalizados_lebebe_exclusive_sgi enable row level security;

revoke all on table public.pedidos_personalizados_lebebe_exclusive_sgi
  from public, anon, authenticated;
grant select, insert, update
  on table public.pedidos_personalizados_lebebe_exclusive_sgi to service_role;

create function public.solicitar_produto_sgi_lebebe_exclusive(
  p_pedido_id uuid,
  p_usuario_id uuid
)
returns setof public.pedidos_personalizados_lebebe_exclusive_sgi
language plpgsql
security invoker
set search_path = pg_catalog, public
as $function$
declare
  v_pedido public.pedidos_personalizados_pedidos%rowtype;
  v_fornecedor_chave text;
  v_unidade_chave text;
  v_unidade_snapshot text;
  v_custo numeric(14,2);
  v_preco numeric(14,2);
  v_integracao public.pedidos_personalizados_lebebe_exclusive_sgi%rowtype;
begin
  if p_usuario_id is null or not exists (
    select 1
    from public.usuarios_permitidos as usuario
    where usuario.id = p_usuario_id and usuario.ativo = true
  ) then
    raise exception 'USUARIO_INVALIDO' using errcode = '42501';
  end if;

  select pedido.*
    into v_pedido
  from public.pedidos_personalizados_pedidos as pedido
  where pedido.id = p_pedido_id
  for update;

  if not found then
    raise exception 'PEDIDO_NAO_ENCONTRADO' using errcode = 'P0002';
  end if;

  select fornecedor.chave
    into v_fornecedor_chave
  from public.pedidos_personalizados_fornecedores as fornecedor
  where fornecedor.id = v_pedido.fornecedor_id;

  if v_fornecedor_chave <> 'lebebe_exclusive' then
    raise exception 'FORNECEDOR_NAO_SUPORTADO' using errcode = '23514';
  end if;
  if v_pedido.status <> 'VENDA FECHADA' then
    raise exception 'STATUS_NAO_ELEGIVEL' using errcode = '23514';
  end if;
  if v_pedido.numero_lancamento is null
     or v_pedido.numero_lancamento !~ '^[0-9]{1,6}$'
  then
    raise exception 'NUMERO_LANCAMENTO_OBRIGATORIO' using errcode = '23514';
  end if;

  select unidade.chave
    into v_unidade_chave
  from public.app_unidades as unidade
  where unidade.id = v_pedido.unidade_id and unidade.ativo = true;

  v_unidade_snapshot := case v_unidade_chave
    when 'bigorrilho' then 'BIGORRILHO'
    when 'portao' then U&'PORT\00C3O'
    when 'marechal' then 'MARECHAL'
    when 'feira' then 'FEIRA'
    else null
  end;

  if v_unidade_snapshot is null then
    raise exception 'UNIDADE_NAO_PERMITIDA' using errcode = '23514';
  end if;

  select
    sum(item.total_custo)::numeric(14,2),
    sum(item.total_venda)::numeric(14,2)
    into v_custo, v_preco
  from public.pedidos_personalizados_lebebe_exclusive_itens as item
  where item.pedido_id = p_pedido_id;

  if v_custo is null or v_preco is null or v_custo <= 0 or v_preco <= 0 then
    raise exception 'ITENS_EXCLUSIVE_OBRIGATORIOS' using errcode = '23514';
  end if;

  select integracao.*
    into v_integracao
  from public.pedidos_personalizados_lebebe_exclusive_sgi as integracao
  where integracao.pedido_id = p_pedido_id
  for update;

  if found then
    if v_integracao.status_integracao = 'ERRO' then
      if v_integracao.erro_codigo = 'DUPLICACAO_INDETERMINADA' then
        raise exception 'REVISAO_TECNICA_OBRIGATORIA' using errcode = '23514';
      end if;
      update public.pedidos_personalizados_lebebe_exclusive_sgi as integracao
      set status_integracao = 'PENDENTE',
          claim_token = null,
          claim_expira_em = null,
          erro_codigo = null,
          erro_mensagem = null,
          ultima_solicitacao_por = p_usuario_id,
          solicitado_em = now(),
          eventos = case
            when jsonb_array_length(integracao.eventos) >= 100 then integracao.eventos - 0
            else integracao.eventos
          end || jsonb_build_array(jsonb_build_object(
            'tipo', 'RETRY_SOLICITADO',
            'em', clock_timestamp()
          ))
      where integracao.pedido_id = p_pedido_id
      returning integracao.* into v_integracao;
    end if;

    return next v_integracao;
    return;
  end if;

  insert into public.pedidos_personalizados_lebebe_exclusive_sgi (
    pedido_id,
    unidade_snapshot,
    numero_lancamento_snapshot,
    nome_produto_sgi,
    custo_enviado,
    preco_enviado,
    solicitado_por,
    ultima_solicitacao_por,
    eventos
  ) values (
    p_pedido_id,
    v_unidade_snapshot,
    v_pedido.numero_lancamento,
    'LEBEBE EXCLUSIVE (' || v_unidade_snapshot || ' ' || v_pedido.numero_lancamento || ')',
    v_custo,
    v_preco,
    p_usuario_id,
    p_usuario_id,
    jsonb_build_array(jsonb_build_object(
      'tipo', 'CRIACAO_SOLICITADA',
      'em', clock_timestamp()
    ))
  )
  returning * into v_integracao;

  return next v_integracao;
end;
$function$;

create function public.reivindicar_produto_sgi_lebebe_exclusive()
returns setof public.pedidos_personalizados_lebebe_exclusive_sgi
language plpgsql
security invoker
set search_path = pg_catalog, public
as $function$
declare
  v_pedido_id uuid;
  v_integracao public.pedidos_personalizados_lebebe_exclusive_sgi%rowtype;
begin
  update public.pedidos_personalizados_lebebe_exclusive_sgi as integracao
  set status_integracao = 'ERRO',
      claim_token = null,
      claim_expira_em = null,
      erro_codigo = 'CLAIM_EXPIRADO',
      erro_mensagem = 'O worker foi interrompido; solicite a retomada.',
      eventos = case
        when jsonb_array_length(integracao.eventos) >= 100 then integracao.eventos - 0
        else integracao.eventos
      end || jsonb_build_array(jsonb_build_object(
        'tipo', 'CLAIM_EXPIRADO',
        'etapa', integracao.etapa,
        'em', clock_timestamp()
      ))
  where integracao.status_integracao = 'PROCESSANDO'
    and integracao.claim_expira_em <= now();

  select integracao.pedido_id
    into v_pedido_id
  from public.pedidos_personalizados_lebebe_exclusive_sgi as integracao
  where integracao.status_integracao = 'PENDENTE'
  order by integracao.solicitado_em, integracao.pedido_id
  for update skip locked
  limit 1;

  if not found then
    return;
  end if;

  update public.pedidos_personalizados_lebebe_exclusive_sgi as integracao
  set status_integracao = 'PROCESSANDO',
      claim_token = gen_random_uuid(),
      claim_expira_em = now() + interval '30 minutes',
      tentativas = integracao.tentativas + 1,
      iniciado_em = coalesce(integracao.iniciado_em, now()),
      erro_codigo = null,
      erro_mensagem = null,
      eventos = case
        when jsonb_array_length(integracao.eventos) >= 100 then integracao.eventos - 0
        else integracao.eventos
      end || jsonb_build_array(jsonb_build_object(
        'tipo', 'PROCESSAMENTO_INICIADO',
        'tentativa', integracao.tentativas + 1,
        'em', clock_timestamp()
      ))
  where integracao.pedido_id = v_pedido_id
  returning integracao.* into v_integracao;

  return next v_integracao;
end;
$function$;

create function public.registrar_checkpoint_produto_sgi_lebebe_exclusive(
  p_pedido_id uuid,
  p_claim_token uuid,
  p_status_integracao text,
  p_etapa text,
  p_produto_id_sgi text default null,
  p_codigo_sgi text default null,
  p_procedimento_custo_sgi text default null,
  p_numero_lancamento_entrada_sgi text default null,
  p_documento_entrada_id_sgi text default null,
  p_procedimento_finalizacao_sgi text default null,
  p_tabela_preco_id_sgi text default null,
  p_item_tabela_preco_id_sgi text default null,
  p_erro_codigo text default null,
  p_erro_mensagem text default null,
  p_evento_detalhes jsonb default '{}'::jsonb
)
returns setof public.pedidos_personalizados_lebebe_exclusive_sgi
language plpgsql
security invoker
set search_path = pg_catalog, public
as $function$
declare
  v_integracao public.pedidos_personalizados_lebebe_exclusive_sgi%rowtype;
  v_rank_atual integer;
  v_rank_novo integer;
  v_produto_id_sgi text;
  v_codigo_sgi text;
begin
  if p_status_integracao not in ('PROCESSANDO', 'ERRO', 'CONCLUIDO') then
    raise exception 'STATUS_CHECKPOINT_INVALIDO' using errcode = '22023';
  end if;
  if p_etapa not in (
    'NAO_INICIADO', 'PRODUTO_DUPLICADO', 'PRODUTO_RENOMEADO',
    'CUSTO_CRIADO', 'CUSTO_FINALIZADO', 'PRECO_ATUALIZADO', 'CONCLUIDO'
  ) then
    raise exception 'ETAPA_CHECKPOINT_INVALIDA' using errcode = '22023';
  end if;
  if p_evento_detalhes is null or jsonb_typeof(p_evento_detalhes) <> 'object' then
    raise exception 'DETALHES_CHECKPOINT_INVALIDOS' using errcode = '22023';
  end if;
  if p_erro_codigo is not null and char_length(p_erro_codigo) > 80 then
    raise exception 'ERRO_CODIGO_INVALIDO' using errcode = '22023';
  end if;
  if p_erro_mensagem is not null and char_length(p_erro_mensagem) > 500 then
    raise exception 'ERRO_MENSAGEM_INVALIDA' using errcode = '22023';
  end if;

  select integracao.*
    into v_integracao
  from public.pedidos_personalizados_lebebe_exclusive_sgi as integracao
  where integracao.pedido_id = p_pedido_id
  for update;

  if not found then
    raise exception 'INTEGRACAO_NAO_ENCONTRADA' using errcode = 'P0002';
  end if;
  if v_integracao.status_integracao <> 'PROCESSANDO'
     or v_integracao.claim_token is distinct from p_claim_token
  then
    raise exception 'CLAIM_INVALIDO' using errcode = '42501';
  end if;

  v_rank_atual := array_position(array[
    'NAO_INICIADO', 'PRODUTO_DUPLICADO', 'PRODUTO_RENOMEADO',
    'CUSTO_CRIADO', 'CUSTO_FINALIZADO', 'PRECO_ATUALIZADO', 'CONCLUIDO'
  ], v_integracao.etapa);
  v_rank_novo := array_position(array[
    'NAO_INICIADO', 'PRODUTO_DUPLICADO', 'PRODUTO_RENOMEADO',
    'CUSTO_CRIADO', 'CUSTO_FINALIZADO', 'PRECO_ATUALIZADO', 'CONCLUIDO'
  ], p_etapa);

  if v_rank_novo < v_rank_atual then
    raise exception 'REGRESSAO_DE_ETAPA' using errcode = '23514';
  end if;

  v_produto_id_sgi := coalesce(nullif(btrim(p_produto_id_sgi), ''), v_integracao.produto_id_sgi);
  v_codigo_sgi := coalesce(nullif(btrim(p_codigo_sgi), ''), v_integracao.codigo_sgi);

  if v_rank_novo >= 2 and v_produto_id_sgi is null then
    raise exception 'PRODUTO_ID_SGI_OBRIGATORIO' using errcode = '23514';
  end if;
  if p_status_integracao = 'CONCLUIDO'
     and (p_etapa <> 'CONCLUIDO' or v_produto_id_sgi is null or v_codigo_sgi is null)
  then
    raise exception 'CONCLUSAO_INCOMPLETA' using errcode = '23514';
  end if;
  if p_status_integracao = 'ERRO'
     and (nullif(btrim(p_erro_codigo), '') is null or nullif(btrim(p_erro_mensagem), '') is null)
  then
    raise exception 'DETALHE_ERRO_OBRIGATORIO' using errcode = '23514';
  end if;

  update public.pedidos_personalizados_lebebe_exclusive_sgi as integracao
  set status_integracao = p_status_integracao,
      etapa = p_etapa,
      produto_id_sgi = v_produto_id_sgi,
      codigo_sgi = v_codigo_sgi,
      procedimento_custo_sgi = coalesce(nullif(btrim(p_procedimento_custo_sgi), ''), integracao.procedimento_custo_sgi),
      numero_lancamento_entrada_sgi = coalesce(nullif(btrim(p_numero_lancamento_entrada_sgi), ''), integracao.numero_lancamento_entrada_sgi),
      documento_entrada_id_sgi = coalesce(nullif(btrim(p_documento_entrada_id_sgi), ''), integracao.documento_entrada_id_sgi),
      procedimento_finalizacao_sgi = coalesce(nullif(btrim(p_procedimento_finalizacao_sgi), ''), integracao.procedimento_finalizacao_sgi),
      tabela_preco_id_sgi = coalesce(nullif(btrim(p_tabela_preco_id_sgi), ''), integracao.tabela_preco_id_sgi),
      item_tabela_preco_id_sgi = coalesce(nullif(btrim(p_item_tabela_preco_id_sgi), ''), integracao.item_tabela_preco_id_sgi),
      claim_token = case when p_status_integracao = 'PROCESSANDO' then integracao.claim_token else null end,
      claim_expira_em = case
        when p_status_integracao = 'PROCESSANDO' then now() + interval '30 minutes'
        else null
      end,
      erro_codigo = case when p_status_integracao = 'ERRO' then btrim(p_erro_codigo) else null end,
      erro_mensagem = case when p_status_integracao = 'ERRO' then btrim(p_erro_mensagem) else null end,
      concluido_em = case when p_status_integracao = 'CONCLUIDO' then now() else integracao.concluido_em end,
      eventos = case
        when jsonb_array_length(integracao.eventos) >= 100 then integracao.eventos - 0
        else integracao.eventos
      end || jsonb_build_array(jsonb_build_object(
        'tipo', case
          when p_status_integracao = 'ERRO' then 'PROCESSAMENTO_FALHOU'
          when p_status_integracao = 'CONCLUIDO' then 'PROCESSAMENTO_CONCLUIDO'
          else 'CHECKPOINT'
        end,
        'etapa', p_etapa,
        'em', clock_timestamp(),
        'detalhes', p_evento_detalhes
      ))
  where integracao.pedido_id = p_pedido_id
  returning integracao.* into v_integracao;

  return next v_integracao;
end;
$function$;

revoke all on function public.solicitar_produto_sgi_lebebe_exclusive(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.solicitar_produto_sgi_lebebe_exclusive(uuid, uuid)
  to service_role;

revoke all on function public.reivindicar_produto_sgi_lebebe_exclusive()
  from public, anon, authenticated;
grant execute on function public.reivindicar_produto_sgi_lebebe_exclusive()
  to service_role;

revoke all on function public.registrar_checkpoint_produto_sgi_lebebe_exclusive(
  uuid, uuid, text, text, text, text, text, text, text, text, text, text, text, text, jsonb
) from public, anon, authenticated;
grant execute on function public.registrar_checkpoint_produto_sgi_lebebe_exclusive(
  uuid, uuid, text, text, text, text, text, text, text, text, text, text, text, text, jsonb
) to service_role;
