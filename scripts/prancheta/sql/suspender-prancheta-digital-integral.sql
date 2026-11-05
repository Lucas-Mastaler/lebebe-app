-- LOCAL: execução remota exige autorização específica. Dados e leitura preservados.
BEGIN;
UPDATE public.atendimento_presencial_digital_config SET ativo=false WHERE id;
REVOKE EXECUTE ON FUNCTION public.atendimento_presencial_digital_criar(uuid,uuid,uuid,uuid,jsonb,text,text,timestamptz) FROM service_role;
COMMIT;
-- Reativar somente após diagnóstico: GRANT EXECUTE + config ativo=true coordenados.
