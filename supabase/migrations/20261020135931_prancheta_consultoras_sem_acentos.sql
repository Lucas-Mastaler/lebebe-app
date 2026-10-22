BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

DO $preflight$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'unaccent'
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_ts_dict d
    JOIN pg_namespace n ON n.oid = d.dictnamespace
    WHERE d.dictname = 'unaccent' AND n.nspname = 'extensions'
  ) THEN
    RAISE EXCEPTION 'Preflight: dicionario unaccent indisponivel';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = 'public.atendimento_presencial_atendimentos'::regclass AND tgname = 'atendimento_presencial_canonizar_consultora' AND tgenabled = 'O')
     OR NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = 'public.atendimento_presencial_clientes'::regclass AND tgname = 'atendimento_presencial_canonizar_consultora' AND tgenabled = 'O')
     OR NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = 'public.atendimento_presencial_atendimentos'::regclass AND tgname = 'trg_atendimento_presencial_clientes_preencher_origem' AND tgenabled = 'O')
     OR NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = 'public.atendimento_presencial_atendimentos'::regclass AND tgname = 'trg_atendimento_presencial_atendimentos_touch' AND tgenabled = 'O')
     OR NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = 'public.atendimento_presencial_clientes'::regclass AND tgname = 'trg_atendimento_presencial_clientes_touch' AND tgenabled = 'O') THEN
    RAISE EXCEPTION 'Preflight: triggers da Prancheta divergentes';
  END IF;
END
$preflight$;

CREATE TEMP TABLE prancheta_consultoras_integridade ON COMMIT DROP AS
SELECT 'atendimentos'::text entidade, hash FROM (
  SELECT md5(coalesce(jsonb_agg(
    (to_jsonb(a) - ARRAY['consultora_nome','version','updated_at','dados_rascunho'])
    || jsonb_build_object('dados_rascunho', a.dados_rascunho - 'consultoraNome')
    ORDER BY a.id
  )::text, '[]')) hash
  FROM public.atendimento_presencial_atendimentos a
) a
UNION ALL
SELECT 'clientes', hash FROM (
  SELECT md5(coalesce(jsonb_agg(
    to_jsonb(c) - ARRAY['origem_consultora_nome','version','updated_at']
    ORDER BY c.id
  )::text, '[]')) hash
  FROM public.atendimento_presencial_clientes c
) c;

CREATE OR REPLACE FUNCTION public.atendimento_presencial_canonizar_consultora()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public, extensions
AS $function$
BEGIN
  IF TG_TABLE_NAME = 'atendimento_presencial_atendimentos' THEN
    NEW.consultora_nome := nullif(
      upper(extensions.unaccent(
        'extensions.unaccent'::regdictionary,
        regexp_replace(btrim(NEW.consultora_nome), '[[:space:]]+', ' ', 'g')
      )),
      ''
    );

    IF jsonb_typeof(NEW.dados_rascunho->'consultoraNome') = 'string' THEN
      NEW.dados_rascunho := jsonb_set(
        NEW.dados_rascunho,
        '{consultoraNome}',
        to_jsonb(
          upper(
            extensions.unaccent(
              'extensions.unaccent'::regdictionary,
              regexp_replace(
                btrim(NEW.dados_rascunho->>'consultoraNome'),
                '[[:space:]]+',
                ' ',
                'g'
              )
            )
          )
        )
      );
    END IF;
  ELSE
    NEW.origem_consultora_nome := nullif(
      upper(extensions.unaccent(
        'extensions.unaccent'::regdictionary,
        regexp_replace(btrim(NEW.origem_consultora_nome), '[[:space:]]+', ' ', 'g')
      )),
      ''
    );
  END IF;

  RETURN NEW;
END
$function$;
REVOKE ALL ON FUNCTION public.atendimento_presencial_canonizar_consultora() FROM PUBLIC, anon, authenticated;

ALTER TABLE public.atendimento_presencial_atendimentos
  DISABLE TRIGGER trg_atendimento_presencial_clientes_preencher_origem;

UPDATE public.atendimento_presencial_atendimentos
SET consultora_nome = nullif(
      upper(extensions.unaccent(
        'extensions.unaccent'::regdictionary,
        regexp_replace(btrim(consultora_nome), '[[:space:]]+', ' ', 'g')
      )),
      ''
    ),
    dados_rascunho = CASE
      WHEN jsonb_typeof(dados_rascunho->'consultoraNome') = 'string' THEN
        jsonb_set(
          dados_rascunho,
          '{consultoraNome}',
          to_jsonb(
            upper(
              extensions.unaccent(
                'extensions.unaccent'::regdictionary,
                regexp_replace(
                  btrim(dados_rascunho->>'consultoraNome'),
                  '[[:space:]]+',
                  ' ',
                  'g'
                )
              )
            )
          )
        )
      ELSE dados_rascunho
    END
WHERE consultora_nome IS DISTINCT FROM nullif(
        upper(extensions.unaccent(
          'extensions.unaccent'::regdictionary,
          regexp_replace(btrim(consultora_nome), '[[:space:]]+', ' ', 'g')
        )),
        ''
      )
   OR (
     jsonb_typeof(dados_rascunho->'consultoraNome') = 'string'
     AND dados_rascunho->>'consultoraNome' IS DISTINCT FROM upper(
       extensions.unaccent(
         'extensions.unaccent'::regdictionary,
         regexp_replace(
           btrim(dados_rascunho->>'consultoraNome'),
           '[[:space:]]+',
           ' ',
           'g'
         )
       )
     )
   );

ALTER TABLE public.atendimento_presencial_atendimentos
  ENABLE TRIGGER trg_atendimento_presencial_clientes_preencher_origem;

UPDATE public.atendimento_presencial_clientes
SET origem_consultora_nome = nullif(
      upper(extensions.unaccent(
        'extensions.unaccent'::regdictionary,
        regexp_replace(btrim(origem_consultora_nome), '[[:space:]]+', ' ', 'g')
      )),
      ''
    )
WHERE origem_consultora_nome IS DISTINCT FROM nullif(
  upper(extensions.unaccent(
    'extensions.unaccent'::regdictionary,
    regexp_replace(btrim(origem_consultora_nome), '[[:space:]]+', ' ', 'g')
  )),
  ''
);

DO $verify$
BEGIN
  IF (SELECT hash FROM prancheta_consultoras_integridade WHERE entidade = 'atendimentos')
       IS DISTINCT FROM (
         SELECT md5(coalesce(jsonb_agg(
           (to_jsonb(a) - ARRAY['consultora_nome','version','updated_at','dados_rascunho'])
           || jsonb_build_object('dados_rascunho', a.dados_rascunho - 'consultoraNome')
           ORDER BY a.id
         )::text, '[]'))
         FROM public.atendimento_presencial_atendimentos a
       )
     OR (SELECT hash FROM prancheta_consultoras_integridade WHERE entidade = 'clientes')
       IS DISTINCT FROM (
         SELECT md5(coalesce(jsonb_agg(
           to_jsonb(c) - ARRAY['origem_consultora_nome','version','updated_at']
           ORDER BY c.id
         )::text, '[]'))
         FROM public.atendimento_presencial_clientes c
       ) THEN
    RAISE EXCEPTION 'Integridade divergente: campos fora da normalizacao de consultoras';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.atendimento_presencial_atendimentos
    WHERE consultora_nome IS DISTINCT FROM nullif(
      upper(extensions.unaccent(
        'extensions.unaccent'::regdictionary,
        regexp_replace(btrim(consultora_nome), '[[:space:]]+', ' ', 'g')
      )),
      ''
    )
       OR (
         jsonb_typeof(dados_rascunho->'consultoraNome') = 'string'
         AND dados_rascunho->>'consultoraNome' IS DISTINCT FROM upper(
           extensions.unaccent(
             'extensions.unaccent'::regdictionary,
             regexp_replace(
               btrim(dados_rascunho->>'consultoraNome'),
               '[[:space:]]+',
               ' ',
               'g'
             )
           )
         )
       )
  ) OR EXISTS (
    SELECT 1 FROM public.atendimento_presencial_clientes
    WHERE origem_consultora_nome IS DISTINCT FROM nullif(
      upper(extensions.unaccent(
        'extensions.unaccent'::regdictionary,
        regexp_replace(btrim(origem_consultora_nome), '[[:space:]]+', ' ', 'g')
      )),
      ''
    )
  ) THEN
    RAISE EXCEPTION 'Preflight final: nomes de consultora ainda nao canonicos';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.atendimento_presencial_atendimentos'::regclass
      AND tgname = 'trg_atendimento_presencial_clientes_preencher_origem'
      AND tgenabled = 'O'
  ) THEN
    RAISE EXCEPTION 'Preflight final: trigger de origem nao foi reabilitado';
  END IF;
END
$verify$;

NOTIFY pgrst, 'reload schema';
COMMIT;