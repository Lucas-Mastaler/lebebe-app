-- Adds the operational lost-sale reason without replacing current validator behavior.
DO $migration$
DECLARE
  constraint_def text;
  function_def text;
  updated_function_def text;
BEGIN
  SELECT pg_get_constraintdef(oid)
    INTO constraint_def
    FROM pg_constraint
   WHERE conrelid = 'public.atendimento_presencial_motivos'::regclass
     AND conname = 'atendimento_presencial_motivos_motivo_check';

  IF constraint_def IS NULL OR position('''outro''::text' IN constraint_def) = 0
     OR position('cliente_retira' IN constraint_def) > 0 THEN
    RAISE EXCEPTION 'preflight_motivo_check_divergente';
  END IF;

  EXECUTE 'ALTER TABLE public.atendimento_presencial_motivos DROP CONSTRAINT atendimento_presencial_motivos_motivo_check';
  EXECUTE format(
    'ALTER TABLE public.atendimento_presencial_motivos ADD CONSTRAINT atendimento_presencial_motivos_motivo_check %s',
    replace(constraint_def, '''outro''::text', '''outro''::text, ''cliente_retira''::text')
  );

  SELECT pg_get_functiondef(p.oid)
    INTO function_def
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
     AND p.proname = 'atendimento_presencial_normalizar_payload_entrega5'
     AND p.pronargs = 2;

  IF function_def IS NULL OR position('''inicio_gestacao'',' IN function_def) = 0
     OR position('''cliente_retira''' IN function_def) > 0 THEN
    RAISE EXCEPTION 'preflight_normalizador_motivos_divergente';
  END IF;

  updated_function_def := replace(
    function_def,
    '''inicio_gestacao'',',
    '''inicio_gestacao'', ''cliente_retira'', '
  );
  IF updated_function_def = function_def THEN
    RAISE EXCEPTION 'normalizador_motivo_nao_alterado';
  END IF;
  EXECUTE updated_function_def;
END
$migration$;
