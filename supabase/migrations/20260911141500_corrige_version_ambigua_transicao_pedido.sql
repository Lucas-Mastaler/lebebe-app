-- Corrige a ambiguidade entre a coluna retornada `version` e a coluna da tabela
-- na RPC de transição. A definição atual é preservada integralmente; só a
-- expressão de incremento recebe a referência explícita do registro bloqueado.
do $migration$
declare
  v_definicao text;
begin
  select pg_get_functiondef(
    'public.transicionar_pedido_personalizado(uuid,integer,uuid,text,text,text,date,text,date,text)'::regprocedure
  ) into v_definicao;

  if position('version=version+1' in v_definicao) = 0 then
    raise exception 'TRANSICAO_PEDIDO_VERSION_INCREMENTO_NAO_ENCONTRADO';
  end if;

  execute replace(
    v_definicao,
    'version=version+1',
    'version=v_p.version+1'
  );
end;
$migration$;
