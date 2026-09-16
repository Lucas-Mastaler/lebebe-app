-- Evolução aditiva do fluxo SGI Exclusive. Não altera registros existentes.
alter table public.pedidos_personalizados_lebebe_exclusive_sgi
  add column cliente_snapshot text,
  add column operacao_pendente text,
  add column lancamento_aplicado_em timestamptz,
  add column status_renomeacao text not null default 'NAO_SOLICITADA',
  add column erro_renomeacao_codigo text,
  add column erro_renomeacao_mensagem text;

alter table public.pedidos_personalizados_lebebe_exclusive_sgi
  drop constraint pp_lex_sgi_lancamento_check,
  drop constraint pp_lex_sgi_nome_check,
  drop constraint pp_lex_sgi_claim_check,
  add constraint pp_lex_sgi_operacao_check check (
    operacao_pendente is null
    or operacao_pendente in ('CRIAR_PRODUTO', 'RENOMEAR_PRODUTO')
  ),
  add constraint pp_lex_sgi_lancamento_check check (
    numero_lancamento_snapshot is null
    or numero_lancamento_snapshot ~ '^[0-9]{1,6}$'
  ),
  add constraint pp_lex_sgi_status_renomeacao_check check (
    status_renomeacao in ('NAO_SOLICITADA', 'PENDENTE', 'PROCESSANDO', 'ERRO', 'CONCLUIDO')
  ),
  add constraint pp_lex_sgi_erro_renomeacao_check check (
    (status_renomeacao = 'ERRO' and erro_renomeacao_codigo is not null and erro_renomeacao_mensagem is not null)
    or (status_renomeacao <> 'ERRO' and erro_renomeacao_codigo is null and erro_renomeacao_mensagem is null)
  ),
  add constraint pp_lex_sgi_claim_check check (
    (claim_token is null and claim_expira_em is null)
    or (
      claim_token is not null and claim_expira_em is not null
      and (status_integracao = 'PROCESSANDO' or status_renomeacao = 'PROCESSANDO')
    )
  ),
  add constraint pp_lex_sgi_nome_check check (
    nome_produto_sgi = btrim(nome_produto_sgi)
    and char_length(nome_produto_sgi) <= 120
    and (
      nome_produto_sgi ~ '^LEBEBE EXCLUSIVE \\(.+\\)$'
      or nome_produto_sgi ~ '^LEBEBE EXCLUSIVE \\(.+ [0-9]{1,6} .+\\)$'
    )
  );

alter table public.pedidos_personalizados_lebebe_exclusive_sgi
  alter column numero_lancamento_snapshot drop not null;

create index idx_pp_lex_sgi_renomeacao_fila
  on public.pedidos_personalizados_lebebe_exclusive_sgi (solicitado_em, pedido_id)
  where status_renomeacao = 'PENDENTE';

comment on column public.pedidos_personalizados_lebebe_exclusive_sgi.cliente_snapshot
  is 'Nome normalizado e congelado na primeira solicitação SGI.';
comment on column public.pedidos_personalizados_lebebe_exclusive_sgi.operacao_pendente
  is 'Operação explícita reivindicada pelo worker; criação ou renomeação final.';
comment on column public.pedidos_personalizados_lebebe_exclusive_sgi.status_renomeacao
  is 'Estado independente da renomeação posterior; não altera a conclusão da criação.';

-- As RPCs preservam as assinaturas publicadas. A criação e a renomeação têm
-- estados separados para que um produto concluído permaneça concluído enquanto
-- a alteração de descrição aguarda o worker.
create or replace function public.solicitar_produto_sgi_lebebe_exclusive(
  p_pedido_id uuid, p_usuario_id uuid
)
returns setof public.pedidos_personalizados_lebebe_exclusive_sgi
language plpgsql security invoker set search_path = pg_catalog, public
as $function$
declare
  v_pedido public.pedidos_personalizados_pedidos%rowtype;
  v_fornecedor text; v_unidade text; v_cliente text; v_custo numeric(14,2); v_preco numeric(14,2);
  v_integracao public.pedidos_personalizados_lebebe_exclusive_sgi%rowtype;
begin
  if p_usuario_id is null or not exists (select 1 from public.usuarios_permitidos u where u.id=p_usuario_id and u.ativo) then
    raise exception 'USUARIO_INVALIDO' using errcode='42501';
  end if;
  select p.* into v_pedido from public.pedidos_personalizados_pedidos p where p.id=p_pedido_id for update;
  if not found then raise exception 'PEDIDO_NAO_ENCONTRADO' using errcode='P0002'; end if;
  select chave into v_fornecedor from public.pedidos_personalizados_fornecedores where id=v_pedido.fornecedor_id;
  if v_fornecedor <> 'lebebe_exclusive' then raise exception 'FORNECEDOR_NAO_SUPORTADO' using errcode='23514'; end if;

  select i.* into v_integracao from public.pedidos_personalizados_lebebe_exclusive_sgi i where i.pedido_id=p_pedido_id for update;
  if found then
    if v_integracao.status_integracao='ERRO' then
      if v_integracao.erro_codigo='DUPLICACAO_INDETERMINADA' then raise exception 'REVISAO_TECNICA_OBRIGATORIA' using errcode='23514'; end if;
      update public.pedidos_personalizados_lebebe_exclusive_sgi
      set status_integracao='PENDENTE', operacao_pendente='CRIAR_PRODUTO', claim_token=null, claim_expira_em=null,
          erro_codigo=null, erro_mensagem=null, ultima_solicitacao_por=p_usuario_id, solicitado_em=now()
      where pedido_id=p_pedido_id returning * into v_integracao;
    elsif v_integracao.status_renomeacao='ERRO' and v_integracao.lancamento_aplicado_em is null and v_integracao.produto_id_sgi is not null then
      update public.pedidos_personalizados_lebebe_exclusive_sgi
      set status_renomeacao='PENDENTE', operacao_pendente='RENOMEAR_PRODUTO', claim_token=null, claim_expira_em=null,
          erro_renomeacao_codigo=null, erro_renomeacao_mensagem=null, ultima_solicitacao_por=p_usuario_id, solicitado_em=now()
      where pedido_id=p_pedido_id returning * into v_integracao;
    end if;
    return next v_integracao; return;
  end if;
  if v_pedido.status <> 'VENDA FECHADA' then raise exception 'STATUS_NAO_ELEGIVEL' using errcode='23514'; end if;
  select case u.chave when 'bigorrilho' then 'BIGORRILHO' when 'portao' then U&'PORT\00C3O' when 'marechal' then 'MARECHAL' when 'feira' then 'FEIRA' end
    into v_unidade from public.app_unidades u where u.id=v_pedido.unidade_id and u.ativo;
  if v_unidade is null then raise exception 'UNIDADE_NAO_PERMITIDA' using errcode='23514'; end if;
  v_cliente:=nullif(btrim(v_pedido.cliente),'');
  if v_cliente is null then raise exception 'CLIENTE_OBRIGATORIO' using errcode='23514'; end if;
  select sum(i.total_custo)::numeric(14,2), sum(i.total_venda)::numeric(14,2) into v_custo,v_preco from public.pedidos_personalizados_lebebe_exclusive_itens i where i.pedido_id=p_pedido_id;
  if v_custo is null or v_preco is null or v_custo<=0 or v_preco<=0 then raise exception 'ITENS_EXCLUSIVE_OBRIGATORIOS' using errcode='23514'; end if;
  insert into public.pedidos_personalizados_lebebe_exclusive_sgi(
    pedido_id,unidade_snapshot,cliente_snapshot,numero_lancamento_snapshot,nome_produto_sgi,custo_enviado,preco_enviado,
    operacao_pendente,solicitado_por,ultima_solicitacao_por,eventos
  ) values (
    p_pedido_id,v_unidade,v_cliente,null,'LEBEBE EXCLUSIVE ('||v_unidade||' '||v_cliente||')',v_custo,v_preco,
    'CRIAR_PRODUTO',p_usuario_id,p_usuario_id,jsonb_build_array(jsonb_build_object('tipo','CRIACAO_SOLICITADA','em',clock_timestamp()))
  ) returning * into v_integracao;
  return next v_integracao;
end;
$function$;

create or replace function public.reivindicar_produto_sgi_lebebe_exclusive()
returns setof public.pedidos_personalizados_lebebe_exclusive_sgi
language plpgsql security invoker set search_path = pg_catalog, public
as $function$
declare v_id uuid; v_i public.pedidos_personalizados_lebebe_exclusive_sgi%rowtype;
begin
  update public.pedidos_personalizados_lebebe_exclusive_sgi i set
    status_integracao=case when i.status_integracao='PROCESSANDO' then 'ERRO' else i.status_integracao end,
    status_renomeacao=case when i.status_renomeacao='PROCESSANDO' then 'ERRO' else i.status_renomeacao end,
    operacao_pendente=null, claim_token=null, claim_expira_em=null,
    erro_codigo=case when i.status_integracao='PROCESSANDO' then 'CLAIM_EXPIRADO' else i.erro_codigo end,
    erro_mensagem=case when i.status_integracao='PROCESSANDO' then 'O worker foi interrompido; solicite a retomada.' else i.erro_mensagem end,
    erro_renomeacao_codigo=case when i.status_renomeacao='PROCESSANDO' then 'CLAIM_EXPIRADO' else i.erro_renomeacao_codigo end,
    erro_renomeacao_mensagem=case when i.status_renomeacao='PROCESSANDO' then 'O worker foi interrompido; solicite a retomada.' else i.erro_renomeacao_mensagem end
  where i.claim_expira_em <= now() and (i.status_integracao='PROCESSANDO' or i.status_renomeacao='PROCESSANDO');
  select i.pedido_id into v_id from public.pedidos_personalizados_lebebe_exclusive_sgi i
  where (i.operacao_pendente='CRIAR_PRODUTO' and i.status_integracao='PENDENTE') or (i.operacao_pendente='RENOMEAR_PRODUTO' and i.status_renomeacao='PENDENTE')
  order by i.solicitado_em,i.pedido_id for update skip locked limit 1;
  if not found then return; end if;
  update public.pedidos_personalizados_lebebe_exclusive_sgi i set
    status_integracao=case when i.operacao_pendente='CRIAR_PRODUTO' then 'PROCESSANDO' else i.status_integracao end,
    status_renomeacao=case when i.operacao_pendente='RENOMEAR_PRODUTO' then 'PROCESSANDO' else i.status_renomeacao end,
    claim_token=gen_random_uuid(),claim_expira_em=now()+interval '30 minutes',tentativas=i.tentativas+1,iniciado_em=coalesce(i.iniciado_em,now())
  where i.pedido_id=v_id returning * into v_i;
  return next v_i;
end;
$function$;

create or replace function public.registrar_checkpoint_produto_sgi_lebebe_exclusive(
  p_pedido_id uuid, p_claim_token uuid, p_status_integracao text, p_etapa text,
  p_produto_id_sgi text default null, p_codigo_sgi text default null,
  p_procedimento_custo_sgi text default null, p_numero_lancamento_entrada_sgi text default null,
  p_documento_entrada_id_sgi text default null, p_procedimento_finalizacao_sgi text default null,
  p_tabela_preco_id_sgi text default null, p_item_tabela_preco_id_sgi text default null,
  p_erro_codigo text default null, p_erro_mensagem text default null, p_evento_detalhes jsonb default '{}'::jsonb
)
returns setof public.pedidos_personalizados_lebebe_exclusive_sgi
language plpgsql security invoker set search_path = pg_catalog, public
as $function$
declare v_i public.pedidos_personalizados_lebebe_exclusive_sgi%rowtype; v_produto text; v_codigo text;
begin
  if p_status_integracao not in ('PROCESSANDO','ERRO','CONCLUIDO') or p_evento_detalhes is null or jsonb_typeof(p_evento_detalhes)<>'object' then
    raise exception 'CHECKPOINT_INVALIDO' using errcode='22023'; end if;
  select * into v_i from public.pedidos_personalizados_lebebe_exclusive_sgi where pedido_id=p_pedido_id for update;
  if not found then raise exception 'INTEGRACAO_NAO_ENCONTRADA' using errcode='P0002'; end if;
  if v_i.claim_token is distinct from p_claim_token or v_i.operacao_pendente is null then raise exception 'CLAIM_INVALIDO' using errcode='42501'; end if;
  if p_status_integracao='ERRO' and (nullif(btrim(p_erro_codigo),'') is null or nullif(btrim(p_erro_mensagem),'') is null) then raise exception 'DETALHE_ERRO_OBRIGATORIO' using errcode='23514'; end if;
  if v_i.operacao_pendente='RENOMEAR_PRODUTO' then
    if p_etapa <> 'CONCLUIDO' then raise exception 'ETAPA_RENOMEACAO_INVALIDA' using errcode='23514'; end if;
    if p_status_integracao='CONCLUIDO' then
      update public.pedidos_personalizados_lebebe_exclusive_sgi set status_renomeacao='CONCLUIDO',operacao_pendente=null,claim_token=null,claim_expira_em=null,
        lancamento_aplicado_em=now(),erro_renomeacao_codigo=null,erro_renomeacao_mensagem=null
      where pedido_id=p_pedido_id returning * into v_i;
    elsif p_status_integracao='ERRO' then
      update public.pedidos_personalizados_lebebe_exclusive_sgi set status_renomeacao='ERRO',operacao_pendente=null,claim_token=null,claim_expira_em=null,
        erro_renomeacao_codigo=btrim(p_erro_codigo),erro_renomeacao_mensagem=btrim(p_erro_mensagem)
      where pedido_id=p_pedido_id returning * into v_i;
    else
      update public.pedidos_personalizados_lebebe_exclusive_sgi set claim_expira_em=now()+interval '30 minutes' where pedido_id=p_pedido_id returning * into v_i;
    end if;
    return next v_i; return;
  end if;
  v_produto:=coalesce(nullif(btrim(p_produto_id_sgi),''),v_i.produto_id_sgi); v_codigo:=coalesce(nullif(btrim(p_codigo_sgi),''),v_i.codigo_sgi);
  if p_status_integracao='CONCLUIDO' and (p_etapa<>'CONCLUIDO' or v_produto is null or v_codigo is null) then raise exception 'CONCLUSAO_INCOMPLETA' using errcode='23514'; end if;
  update public.pedidos_personalizados_lebebe_exclusive_sgi set
    status_integracao=p_status_integracao,etapa=p_etapa,produto_id_sgi=v_produto,codigo_sgi=v_codigo,
    procedimento_custo_sgi=coalesce(nullif(btrim(p_procedimento_custo_sgi),''),procedimento_custo_sgi),
    numero_lancamento_entrada_sgi=coalesce(nullif(btrim(p_numero_lancamento_entrada_sgi),''),numero_lancamento_entrada_sgi),
    documento_entrada_id_sgi=coalesce(nullif(btrim(p_documento_entrada_id_sgi),''),documento_entrada_id_sgi),
    procedimento_finalizacao_sgi=coalesce(nullif(btrim(p_procedimento_finalizacao_sgi),''),procedimento_finalizacao_sgi),
    tabela_preco_id_sgi=coalesce(nullif(btrim(p_tabela_preco_id_sgi),''),tabela_preco_id_sgi),
    item_tabela_preco_id_sgi=coalesce(nullif(btrim(p_item_tabela_preco_id_sgi),''),item_tabela_preco_id_sgi),
    operacao_pendente=case when p_status_integracao in ('ERRO','CONCLUIDO') then null else 'CRIAR_PRODUTO' end,
    claim_token=case when p_status_integracao='PROCESSANDO' then claim_token else null end,
    claim_expira_em=case when p_status_integracao='PROCESSANDO' then now()+interval '30 minutes' else null end,
    erro_codigo=case when p_status_integracao='ERRO' then btrim(p_erro_codigo) else null end,
    erro_mensagem=case when p_status_integracao='ERRO' then btrim(p_erro_mensagem) else null end,
    concluido_em=case when p_status_integracao='CONCLUIDO' then now() else concluido_em end
  where pedido_id=p_pedido_id returning * into v_i;
  return next v_i;
end;
$function$;

-- Corpo integral da RPC vigente, com a exceção explicitamente limitada ao
-- ramo Exclusive. Não há overload: o contrato de dez argumentos é único.
create or replace function public.transicionar_pedido_personalizado(
  p_pedido_id uuid, p_expected_version integer, p_usuario_id uuid, p_status_destino text,
  p_numero_lancamento text default null, p_numero_pedido_compra text default null,
  p_data_pedido_fornecedor date default null, p_comprador text default null,
  p_data_entrega date default null, p_justificativa text default null
)
returns table(evento_id uuid, status text, version integer)
language plpgsql set search_path=pg_catalog,public
as $function$
declare
  v_p public.pedidos_personalizados_pedidos%rowtype; v_f text;
  v_i public.pedidos_personalizados_lebebe_exclusive_sgi%rowtype;
  v_lancamento text; v_evento uuid:=gen_random_uuid(); v_version integer;
  v_numero_pedido_compra text; v_data_pedido_fornecedor date; v_comprador text;
  v_data_entrega date; v_data_recebimento date; v_justificativa text; v_preenche_dados_compra boolean;
begin
  if p_usuario_id is null or not exists(select 1 from public.usuarios_permitidos u where u.id=p_usuario_id and u.ativo) then raise exception 'USUARIO_INVALIDO' using errcode='42501'; end if;
  select * into v_p from public.pedidos_personalizados_pedidos where id=p_pedido_id for update;
  if not found then raise exception 'PEDIDO_NAO_ENCONTRADO' using errcode='P0002'; end if;
  if v_p.version<>p_expected_version then raise exception 'CONFLITO_VERSAO' using errcode='P0003'; end if;
  select chave into v_f from public.pedidos_personalizados_fornecedores where id=v_p.fornecedor_id;
  if not ((v_p.status='RASCUNHO' and p_status_destino in ('VENDA FECHADA','CANCELADO'))
    or (v_f='lebebe_exclusive' and ((v_p.status='VENDA FECHADA' and p_status_destino in (U&'EM PRODU\00C7\00C3O','CANCELADO')) or (v_p.status=U&'EM PRODU\00C7\00C3O' and p_status_destino in ('RECEBIDO','CANCELADO'))))
    or (v_f='moriah_tapetes' and ((v_p.status='VENDA FECHADA' and p_status_destino in ('AGUARDANDO LAYOUT','CANCELADO')) or (v_p.status='AGUARDANDO LAYOUT' and p_status_destino in (U&'AGUARDANDO APROVA\00C7\00C3O DO CLIENTE','CANCELADO')) or (v_p.status=U&'AGUARDANDO APROVA\00C7\00C3O DO CLIENTE' and p_status_destino in (U&'EM PRODU\00C7\00C3O','AGUARDANDO LAYOUT','CANCELADO')) or (v_p.status=U&'EM PRODU\00C7\00C3O' and p_status_destino in ('RECEBIDO','CANCELADO'))))) then raise exception 'TRANSICAO_STATUS_INVALIDA' using errcode='P0001'; end if;
  v_lancamento:=case when (v_p.status='RASCUNHO' and p_status_destino='VENDA FECHADA') or (v_f='lebebe_exclusive' and v_p.status='VENDA FECHADA' and p_status_destino=U&'EM PRODU\00C7\00C3O') then coalesce(nullif(btrim(p_numero_lancamento),''),v_p.numero_lancamento) else v_p.numero_lancamento end;
  if p_numero_lancamento is not null and not ((v_p.status='RASCUNHO' and p_status_destino='VENDA FECHADA') or (v_f='lebebe_exclusive' and v_p.status='VENDA FECHADA' and p_status_destino=U&'EM PRODU\00C7\00C3O')) then raise exception 'NUMERO_LANCAMENTO_NAO_PERMITIDO' using errcode='22023'; end if;
  if v_f<>'lebebe_exclusive' and v_p.status='RASCUNHO' and p_status_destino='VENDA FECHADA' and (v_lancamento is null or v_lancamento !~ '^[0-9]{1,6}$') then raise exception 'NUMERO_LANCAMENTO_OBRIGATORIO' using errcode='23514'; end if;
  if v_f='lebebe_exclusive' and v_p.status='VENDA FECHADA' and p_status_destino=U&'EM PRODU\00C7\00C3O' then
    if v_lancamento is null or v_lancamento !~ '^[0-9]{1,6}$' then raise exception 'NUMERO_LANCAMENTO_OBRIGATORIO' using errcode='23514'; end if;
    select * into v_i from public.pedidos_personalizados_lebebe_exclusive_sgi where pedido_id=p_pedido_id for update;
    if not found or v_i.status_integracao<>'CONCLUIDO' or v_i.produto_id_sgi is null then raise exception 'PRODUTO_SGI_OBRIGATORIO' using errcode='23514'; end if;
    if v_i.lancamento_aplicado_em is null and v_i.status_renomeacao not in ('PENDENTE','PROCESSANDO') then
      update public.pedidos_personalizados_lebebe_exclusive_sgi set numero_lancamento_snapshot=v_lancamento,
        nome_produto_sgi='LEBEBE EXCLUSIVE ('||unidade_snapshot||' '||v_lancamento||' '||cliente_snapshot||')',status_renomeacao='PENDENTE',operacao_pendente='RENOMEAR_PRODUTO',solicitado_em=now(),claim_token=null,claim_expira_em=null
      where pedido_id=p_pedido_id;
    end if;
  end if;
  if v_f='moriah_tapetes' and p_status_destino in (U&'AGUARDANDO APROVA\00C7\00C3O DO CLIENTE',U&'EM PRODU\00C7\00C3O') and not exists(select 1 from public.pedidos_personalizados_moriah_tapetes t join public.pedidos_personalizados_anexos a on a.tapete_id=t.id where t.pedido_id=p_pedido_id) then raise exception 'ANEXO_LAYOUT_OBRIGATORIO' using errcode='23514'; end if;
  v_numero_pedido_compra:=coalesce(p_numero_pedido_compra,v_p.numero_pedido_compra); v_data_pedido_fornecedor:=coalesce(p_data_pedido_fornecedor,v_p.data_pedido_fornecedor); v_comprador:=coalesce(nullif(btrim(p_comprador),''),v_p.comprador); v_data_entrega:=case when p_status_destino=U&'EM PRODU\00C7\00C3O' then coalesce(p_data_entrega,v_p.data_entrega) else v_p.data_entrega end; v_data_recebimento:=case when p_status_destino='RECEBIDO' then p_data_entrega end; v_justificativa:=nullif(btrim(p_justificativa),'');
  v_preenche_dados_compra:=(v_f='moriah_tapetes' and v_p.status='VENDA FECHADA' and p_status_destino='AGUARDANDO LAYOUT') or (v_f='lebebe_exclusive' and v_p.status='VENDA FECHADA' and p_status_destino=U&'EM PRODU\00C7\00C3O');
  if v_preenche_dados_compra and (v_numero_pedido_compra is null or v_numero_pedido_compra !~ '^[0-9]{1,5}$' or v_data_pedido_fornecedor is null or v_comprador is null or char_length(btrim(v_comprador)) not between 2 and 40) then raise exception 'CAMPOS_PRODUCAO_OBRIGATORIOS' using errcode='23514'; end if;
  if p_status_destino=U&'EM PRODU\00C7\00C3O' and v_data_entrega is null then raise exception 'DATA_ENTREGA_OBRIGATORIA' using errcode='23514'; end if;
  if p_status_destino='RECEBIDO' and v_data_recebimento is null then raise exception 'DATA_RECEBIMENTO_OBRIGATORIA' using errcode='23514'; end if;
  if p_status_destino='CANCELADO' and (v_justificativa is null or char_length(v_justificativa)>500) then raise exception 'JUSTIFICATIVA_CANCELAMENTO_OBRIGATORIA' using errcode='23514'; end if;
  if p_status_destino<>'CANCELADO' and v_justificativa is not null then raise exception 'JUSTIFICATIVA_NAO_PERMITIDO' using errcode='22023'; end if;
  update public.pedidos_personalizados_pedidos set status=p_status_destino,
    numero_lancamento=case when (v_p.status='RASCUNHO' and p_status_destino='VENDA FECHADA') or (v_f='lebebe_exclusive' and p_status_destino=U&'EM PRODU\00C7\00C3O') then v_lancamento else numero_lancamento end,
    numero_pedido_compra=case when v_preenche_dados_compra then v_numero_pedido_compra else numero_pedido_compra end,
    data_pedido_fornecedor=case when v_preenche_dados_compra then v_data_pedido_fornecedor else data_pedido_fornecedor end,
    comprador=case when v_preenche_dados_compra then v_comprador else comprador end,
    data_entrega=case when p_status_destino=U&'EM PRODU\00C7\00C3O' then v_data_entrega else data_entrega end,
    version=version+1,updated_by=p_usuario_id where id=p_pedido_id returning version into v_version;
  insert into public.pedidos_personalizados_status_historico(id,pedido_id,status_anterior,status_novo,usuario_id,unidade_id,version_anterior,version_nova,justificativa,data_recebimento)
  values(v_evento,p_pedido_id,v_p.status,p_status_destino,p_usuario_id,v_p.unidade_id,v_p.version,v_version,case when p_status_destino='CANCELADO' then nullif(btrim(p_justificativa),'') end,case when p_status_destino='RECEBIDO' then p_data_entrega end);
  return query select v_evento,p_status_destino,v_version;
end;
$function$;
