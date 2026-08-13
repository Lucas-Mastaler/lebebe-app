-- A venda só pode ser fechada com lançamento persistido e a Exclusive pode
-- corrigir os dados comerciais até a próxima etapa operacional.
do $migration$
declare
  v_definicao text;
  v_trecho_atual text := $$if v_pedido.status <> 'RASCUNHO' then
    raise exception 'EDICAO_COMERCIAL_BLOQUEADA' using errcode = 'P0001';
  end if;$$;
  v_trecho_novo text := $$if v_pedido.status not in ('RASCUNHO', 'VENDA FECHADA') then
    raise exception 'EDICAO_COMERCIAL_BLOQUEADA' using errcode = 'P0001';
  end if;$$;
begin
  select pg_get_functiondef(p.oid) into v_definicao
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'atualizar_pedido_personalizado_comercial_lebebe_exclusive'
    and pg_get_function_identity_arguments(p.oid) =
      'p_pedido_id uuid, p_expected_version integer, p_usuario_id uuid, p_unidade_id uuid, p_consultora text, p_cliente text, p_telefone_normalizado text, p_numero_lancamento text, p_itens jsonb';

  if v_definicao is null or (select count(*) from regexp_matches(v_definicao, 'if v_pedido\.status <> ''RASCUNHO'' then', 'g')) <> 1 then
    raise exception 'DEFINICAO_COMERCIAL_EXCLUSIVE_INESPERADA';
  end if;

  execute replace(v_definicao, v_trecho_atual, v_trecho_novo);
end;
$migration$;

do $migration$
declare
  v_definicao text;
  v_trecho_atual text := $$  if v_fornecedor_chave = 'moriah_tapetes'
     and p_status_destino in (U&'AGUARDANDO APROVA\00C7\00C3O DO CLIENTE', U&'EM PRODU\00C7\00C3O')$$;
  v_trecho_novo text := $$  if v_pedido.status = 'RASCUNHO'
     and p_status_destino = 'VENDA FECHADA'
     and (v_pedido.numero_lancamento is null or btrim(v_pedido.numero_lancamento) !~ '^[0-9]{1,6}$')
  then raise exception 'NUMERO_LANCAMENTO_OBRIGATORIO' using errcode = '23514'; end if;

  if v_fornecedor_chave = 'moriah_tapetes'
     and p_status_destino in (U&'AGUARDANDO APROVA\00C7\00C3O DO CLIENTE', U&'EM PRODU\00C7\00C3O')$$;
begin
  select pg_get_functiondef(p.oid) into v_definicao
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'transicionar_pedido_personalizado'
    and pg_get_function_identity_arguments(p.oid) =
      'p_pedido_id uuid, p_expected_version integer, p_usuario_id uuid, p_status_destino text, p_numero_pedido_compra text, p_data_pedido_fornecedor date, p_comprador text, p_data_entrega date, p_justificativa text';

  if v_definicao is null or (select count(*) from regexp_matches(v_definicao, 'if v_fornecedor_chave = ''moriah_tapetes''', 'g')) <> 1 then
    raise exception 'DEFINICAO_TRANSICAO_PEDIDO_INESPERADA';
  end if;

  execute replace(v_definicao, v_trecho_atual, v_trecho_novo);
end;
$migration$;
