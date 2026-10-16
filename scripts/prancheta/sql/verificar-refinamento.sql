-- Somente leitura. Executar após aplicação autorizada de D-028.
SELECT column_name,data_type,is_nullable,column_default
FROM information_schema.columns
WHERE table_schema='public' AND table_name='atendimento_presencial_atendimentos'
AND column_name='telefone_recusa_confirmada';
SELECT conname,pg_get_constraintdef(oid)
FROM pg_constraint WHERE conrelid IN ('public.atendimento_presencial_atendimentos'::regclass,'public.atendimento_presencial_motivos'::regclass)
AND conname IN ('atendimento_presencial_atendimentos_fluxo_check','atendimento_presencial_motivos_motivo_check','atendimento_presencial_motivos_complemento_check');
SELECT p.proname,pg_get_function_identity_arguments(p.oid),p.prosecdef,p.proacl
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.proname IN ('atendimento_presencial_concluir','atendimento_presencial_normalizar_payload_ficha','atendimento_presencial_normalizar_payload_entrega5','atendimento_presencial_editar_concluido','atendimento_presencial_telefone_valido');
SELECT telefone_recusa_confirmada,tipo_atendimento,count(*)
FROM public.atendimento_presencial_atendimentos WHERE status='concluido'
GROUP BY telefone_recusa_confirmada,tipo_atendimento;
