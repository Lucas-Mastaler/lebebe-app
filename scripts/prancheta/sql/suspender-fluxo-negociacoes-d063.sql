-- Recuperação não destrutiva D-063. LOCAL; execução remota exige autorização.
-- Suspende apenas novas associações. Não apaga relações, eventos ou registros.
BEGIN;
SET LOCAL lock_timeout='5s';
REVOKE EXECUTE ON FUNCTION public.atendimento_presencial_negociacao_associar_atendimento(uuid,uuid,uuid,uuid,integer) FROM service_role;
COMMIT;
-- Após diagnóstico: GRANT EXECUTE da mesma função ao service_role.
-- Não reaplicar a migration inicial nem restaurar writers que ignorem os vínculos.
