-- Mantem expira_em >= ultima_atividade_em ao editar atendimento concluido.
-- Preserva a data de conclusao e as regras de autorizacao existentes.
do $migration$
declare
  v_definition text;
begin
  select pg_get_functiondef('public.atendimento_presencial_editar_concluido(uuid,integer,uuid,jsonb,integer,text)'::regprocedure)
    into v_definition;
  if md5(v_definition) <> '3b28d9b3a25887a4e7b490cac803c63e' then
    raise exception 'Definicao da RPC de edicao divergiu da versao auditada; revise antes de aplicar.';
  end if;
  v_definition := replace(
    v_definition,
    '    ultima_atividade_em = now(),',
    E'    ultima_atividade_em = now(),\n    expira_em = now(),'
  );
  execute v_definition;
end;
$migration$;
