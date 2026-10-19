-- Preparada localmente. Não aplicada em produção nesta entrega.
-- Telefones antigos são preservados; validação nova só em INSERT/alteração.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid='public.atendimento_presencial_atendimentos'::regclass AND tgname='trg_atendimento_presencial_clientes_preencher_origem') THEN
    RAISE EXCEPTION 'Preflight: trigger de origem divergente';
  END IF;
END $$;
CREATE OR REPLACE FUNCTION public.atendimento_presencial_canonizar_consultora()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF TG_TABLE_NAME = 'atendimento_presencial_atendimentos' THEN
    NEW.consultora_nome := nullif(upper(regexp_replace(btrim(NEW.consultora_nome), '[[:space:]]+', ' ', 'g')), '');
    IF jsonb_typeof(NEW.dados_rascunho->'consultoraNome') = 'string' THEN
      NEW.dados_rascunho := jsonb_set(NEW.dados_rascunho, '{consultoraNome}', to_jsonb(upper(regexp_replace(btrim(NEW.dados_rascunho->>'consultoraNome'), '[[:space:]]+', ' ', 'g'))));
    END IF;
  ELSE
    NEW.origem_consultora_nome := nullif(upper(regexp_replace(btrim(NEW.origem_consultora_nome), '[[:space:]]+', ' ', 'g')), '');
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.atendimento_presencial_canonizar_consultora() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER atendimento_presencial_canonizar_consultora BEFORE INSERT OR UPDATE ON public.atendimento_presencial_atendimentos FOR EACH ROW EXECUTE FUNCTION public.atendimento_presencial_canonizar_consultora();
CREATE TRIGGER atendimento_presencial_canonizar_consultora BEFORE INSERT OR UPDATE ON public.atendimento_presencial_clientes FOR EACH ROW EXECUTE FUNCTION public.atendimento_presencial_canonizar_consultora();
CREATE OR REPLACE FUNCTION public.atendimento_presencial_validar_telefone_cadastro()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog AS $$
BEGIN
  IF NEW.telefone_normalizado IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' THEN
    IF NEW.telefone_normalizado IS NOT DISTINCT FROM OLD.telefone_normalizado
      AND NEW.telefone_informado IS NOT DISTINCT FROM OLD.telefone_informado
      AND NEW.telefone_normalizado_ddi IS NOT DISTINCT FROM OLD.telefone_normalizado_ddi THEN RETURN NEW; END IF;
  END IF;
  IF left(NEW.telefone_normalizado, 2) <> ALL(string_to_array('11 12 13 14 15 16 17 18 19 21 22 24 27 28 31 32 33 34 35 37 38 41 42 43 44 45 46 47 48 49 51 53 54 55 61 62 63 64 65 66 67 68 69 71 73 74 75 77 79 81 82 83 84 85 86 87 88 89 91 92 93 94 95 96 97 98 99', ' '))
    OR substr(NEW.telefone_normalizado, 3) !~ '^([2-5][0-9]{7}|9[0-9]{8})$' THEN
    RAISE EXCEPTION 'telefone_cadastro_formato_brasileiro_invalido' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.atendimento_presencial_validar_telefone_cadastro() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER atendimento_presencial_validar_telefone_cadastro BEFORE INSERT OR UPDATE ON public.atendimento_presencial_clientes FOR EACH ROW EXECUTE FUNCTION public.atendimento_presencial_validar_telefone_cadastro();
CREATE TEMP TABLE prancheta_cadastro_preflight ON COMMIT DROP AS
SELECT 'atendimentos'::text entidade, hash FROM (SELECT md5(coalesce(jsonb_agg((to_jsonb(a) - ARRAY['consultora_nome','version','updated_at','dados_rascunho']) || jsonb_build_object('dados_rascunho', a.dados_rascunho - 'consultoraNome') ORDER BY a.id)::text, '[]')) hash FROM public.atendimento_presencial_atendimentos a) a
UNION ALL SELECT 'clientes', hash FROM (SELECT md5(coalesce(jsonb_agg(to_jsonb(c) - ARRAY['origem_consultora_nome','version','updated_at'] ORDER BY c.id)::text, '[]')) hash FROM public.atendimento_presencial_clientes c) c;
-- Impede o backfill de inferir ou preencher vínculos de origem ausentes.
ALTER TABLE public.atendimento_presencial_atendimentos DISABLE TRIGGER trg_atendimento_presencial_clientes_preencher_origem;
UPDATE public.atendimento_presencial_atendimentos
SET consultora_nome = nullif(upper(regexp_replace(btrim(consultora_nome), '[[:space:]]+', ' ', 'g')), ''),
    dados_rascunho = CASE WHEN jsonb_typeof(dados_rascunho->'consultoraNome')='string'
      THEN jsonb_set(dados_rascunho, '{consultoraNome}', to_jsonb(upper(regexp_replace(btrim(dados_rascunho->>'consultoraNome'), '[[:space:]]+', ' ', 'g')))) ELSE dados_rascunho END
WHERE consultora_nome IS DISTINCT FROM nullif(upper(regexp_replace(btrim(consultora_nome), '[[:space:]]+', ' ', 'g')), '')
   OR (jsonb_typeof(dados_rascunho->'consultoraNome')='string' AND dados_rascunho->>'consultoraNome' IS DISTINCT FROM upper(regexp_replace(btrim(dados_rascunho->>'consultoraNome'), '[[:space:]]+', ' ', 'g')));
ALTER TABLE public.atendimento_presencial_atendimentos ENABLE TRIGGER trg_atendimento_presencial_clientes_preencher_origem;
UPDATE public.atendimento_presencial_clientes
SET origem_consultora_nome = nullif(upper(regexp_replace(btrim(origem_consultora_nome), '[[:space:]]+', ' ', 'g')), '')
WHERE origem_consultora_nome IS DISTINCT FROM nullif(upper(regexp_replace(btrim(origem_consultora_nome), '[[:space:]]+', ' ', 'g')), '');
DO $$ BEGIN
  IF (SELECT hash FROM prancheta_cadastro_preflight WHERE entidade='atendimentos') IS DISTINCT FROM (SELECT md5(coalesce(jsonb_agg((to_jsonb(a) - ARRAY['consultora_nome','version','updated_at','dados_rascunho']) || jsonb_build_object('dados_rascunho', a.dados_rascunho - 'consultoraNome') ORDER BY a.id)::text, '[]')) hash FROM public.atendimento_presencial_atendimentos a)
     OR (SELECT hash FROM prancheta_cadastro_preflight WHERE entidade='clientes') IS DISTINCT FROM (SELECT md5(coalesce(jsonb_agg(to_jsonb(c) - ARRAY['origem_consultora_nome','version','updated_at'] ORDER BY c.id)::text, '[]')) hash FROM public.atendimento_presencial_clientes c) THEN
    RAISE EXCEPTION 'Integridade do backfill divergente; transacao cancelada';
  END IF;
END $$;
NOTIFY pgrst, 'reload schema';
COMMIT;
