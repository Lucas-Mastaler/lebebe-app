-- A coluna de saída `version` também torna ambíguo o RETURNING da RPC.
-- Nomear a tabela alvo mantém o incremento já corrigido e torna o retorno
-- inequívoco, sem alterar nenhuma regra de transição.
do $migration$
declare
  v_definicao text;
begin
  select pg_get_functiondef(
    'public.transicionar_pedido_personalizado(uuid,integer,uuid,text,text,text,date,text,date,text)'::regprocedure
  ) into v_definicao;

  if position('returning version into v_version' in v_definicao) = 0 then
    raise exception 'TRANSICAO_PEDIDO_RETURNING_VERSION_NAO_ENCONTRADO';
  end if;

  v_definicao := replace(
    v_definicao,
    'update public.pedidos_personalizados_pedidos set',
    'update public.pedidos_personalizados_pedidos as pedido set'
  );
  v_definicao := replace(
    v_definicao,
    'returning version into v_version',
    'returning pedido.version into v_version'
  );

  execute v_definicao;
end;
$migration$;
