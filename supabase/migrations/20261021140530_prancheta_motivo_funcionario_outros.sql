-- D-049. Amplia os motivos de não cliente com Funcionário e guarda a descrição de Outros.
-- Sem backfill: os registros históricos de Outros permanecem com a descrição nula.
-- Aplicar junto com o código. A função passa a exigir a descrição nas conclusões novas de Outros.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

DO $preflight$
DECLARE
  def_entrega text;
  def_concluir text;
  def_editar text;
  fluxo text;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'atendimento_presencial_atendimentos' AND column_name = 'motivo_visita_outro'
  ) THEN
    RAISE EXCEPTION 'preflight_motivo_visita_outro_ja_existe';
  END IF;

  SELECT md5(replace(pg_get_functiondef(p.oid), E'\r\n', E'\n')) INTO def_entrega
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'atendimento_presencial_normalizar_payload_entrega5' AND p.pronargs = 2;
  SELECT md5(replace(pg_get_functiondef(p.oid), E'\r\n', E'\n')) INTO def_concluir
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'atendimento_presencial_concluir' AND p.pronargs = 6;
  SELECT md5(replace(pg_get_functiondef(p.oid), E'\r\n', E'\n')) INTO def_editar
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'atendimento_presencial_editar_concluido' AND p.pronargs = 6;

  IF def_entrega IS DISTINCT FROM 'b2ff0c22581625617b011b0fa1cf2ea9' THEN RAISE EXCEPTION 'preflight_entrega5_divergente'; END IF;
  IF def_concluir IS DISTINCT FROM '10dd14d9bb4da30fd9c8e6b3fd21e867' THEN RAISE EXCEPTION 'preflight_concluir_divergente'; END IF;
  IF def_editar IS DISTINCT FROM 'f91ce0618e2e28a1bc687911681961e3' THEN RAISE EXCEPTION 'preflight_editar_divergente'; END IF;

  SELECT pg_get_constraintdef(oid) INTO fluxo
  FROM pg_constraint
  WHERE conrelid = 'public.atendimento_presencial_atendimentos'::regclass
    AND conname = 'atendimento_presencial_atendimentos_fluxo_check';
  IF fluxo IS NULL OR position('''curriculo''::text]))' IN fluxo) = 0 OR position('funcionario' IN fluxo) > 0 THEN
    RAISE EXCEPTION 'preflight_fluxo_check_divergente';
  END IF;
END
$preflight$;

ALTER TABLE public.atendimento_presencial_atendimentos
  ADD COLUMN motivo_visita_outro text;

COMMENT ON COLUMN public.atendimento_presencial_atendimentos.motivo_visita_outro IS
  'Descrição obrigatória nas conclusões novas quando o motivo da visita é Outros. Letras e espaços, até 30 caracteres. Nulo no histórico anterior e nos demais motivos.';

ALTER TABLE public.atendimento_presencial_atendimentos
  ADD CONSTRAINT atendimento_presencial_atendimentos_motivo_visita_outro_check CHECK (
    motivo_visita_outro IS NULL
    OR (
      motivo_visita = 'outros'
      AND char_length(motivo_visita_outro) BETWEEN 1 AND 30
      AND motivo_visita_outro ~ '^[A-Za-z\xC0-\xD6\xD8-\xF6\xF8-\xFF]+( [A-Za-z\xC0-\xD6\xD8-\xF6\xF8-\xFF]+)*$'
    )
  );

DO $checks$
DECLARE
  definicao text;
  atual text;
BEGIN
  SELECT pg_get_constraintdef(oid) INTO atual
  FROM pg_constraint
  WHERE conrelid = 'public.atendimento_presencial_atendimentos'::regclass
    AND conname = 'atendimento_presencial_atendimentos_fluxo_check';
  definicao := replace(atual, '''curriculo''::text]))', '''curriculo''::text, ''funcionario''::text]))');
  IF definicao = atual THEN RAISE EXCEPTION 'fluxo_check_nao_alterado'; END IF;
  EXECUTE 'ALTER TABLE public.atendimento_presencial_atendimentos DROP CONSTRAINT atendimento_presencial_atendimentos_fluxo_check';
  EXECUTE format('ALTER TABLE public.atendimento_presencial_atendimentos ADD CONSTRAINT atendimento_presencial_atendimentos_fluxo_check %s', definicao);
END
$checks$;

CREATE OR REPLACE FUNCTION pg_temp.prancheta_substituir_uma(definicao text, antigo text, novo text)
RETURNS text
LANGUAGE plpgsql
AS $troca$
DECLARE
  ocorrencias integer;
BEGIN
  ocorrencias := (length(definicao) - length(replace(definicao, antigo, ''))) / length(antigo);
  IF ocorrencias <> 1 THEN
    RAISE EXCEPTION 'substituicao_inesperada %', ocorrencias;
  END IF;
  RETURN replace(definicao, antigo, novo);
END
$troca$;

DO $entrega$
DECLARE
  definicao text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO definicao
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'atendimento_presencial_normalizar_payload_entrega5' AND p.pronargs = 2;

  definicao := pg_temp.prancheta_substituir_uma(definicao, 'v_visita text;', E'v_visita text;\n  v_visita_outro text;');
  definicao := pg_temp.prancheta_substituir_uma(definicao, '''curriculo'')) then', '''curriculo'',''funcionario'')) then');
  definicao := pg_temp.prancheta_substituir_uma(
    definicao,
    'v_visita := case when v_tipo = ''nao_cliente'' then p_dados->>''motivoVisita'' end;',
    E'v_visita := case when v_tipo = ''nao_cliente'' then p_dados->>''motivoVisita'' end;\n    v_visita_outro := nullif(regexp_replace(btrim(coalesce(p_dados->>''motivoVisitaOutro'', '''')), ''[[:space:]]+'', '' '', ''g''), '''');\n    if v_tipo = ''nao_cliente'' and v_visita = ''outros'' then\n      if v_visita_outro is null or char_length(v_visita_outro) > 30 or v_visita_outro !~ ''^[A-Za-z\\xC0-\\xD6\\xD8-\\xF6\\xF8-\\xFF]+( [A-Za-z\\xC0-\\xD6\\xD8-\\xF6\\xF8-\\xFF]+)*$'' then\n        raise exception ''motivo_visita_outro_invalido'' using errcode = ''23514'';\n      end if;\n    else\n      v_visita_outro := null;\n    end if;'
  );
  definicao := pg_temp.prancheta_substituir_uma(
    definicao,
    'array[''versaoFluxo'',''tipoAtendimento'',''motivoVisita'',''observacaoNaoFechamento'']',
    'array[''versaoFluxo'',''tipoAtendimento'',''motivoVisita'',''observacaoNaoFechamento'',''motivoVisitaOutro'']'
  );
  definicao := pg_temp.prancheta_substituir_uma(
    definicao,
    '''motivoVisita'', v_visita,',
    '''motivoVisita'', v_visita, ''motivoVisitaOutro'', v_visita_outro,'
  );
  EXECUTE definicao;
END
$entrega$;

DO $conclusao$
DECLARE
  definicao text;
  nome text;
BEGIN
  FOREACH nome IN ARRAY ARRAY['atendimento_presencial_concluir', 'atendimento_presencial_editar_concluido'] LOOP
    SELECT pg_get_functiondef(p.oid) INTO definicao
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = nome AND p.pronargs = 6;
    definicao := pg_temp.prancheta_substituir_uma(
      definicao,
      'motivo_visita = v_payload->>''motivoVisita''',
      'motivo_visita = v_payload->>''motivoVisita'', motivo_visita_outro = case when v_payload->>''motivoVisita'' = ''outros'' then v_payload->>''motivoVisitaOutro'' else null end'
    );
    IF nome = 'atendimento_presencial_concluir' THEN
      definicao := pg_temp.prancheta_substituir_uma(
        definicao,
        '''motivoVisita'', v_payload->>''motivoVisita''',
        '''motivoVisita'', v_payload->>''motivoVisita'', ''motivoVisitaOutro'', v_payload->>''motivoVisitaOutro'''
      );
    ELSE
      definicao := pg_temp.prancheta_substituir_uma(
        definicao,
        'or v_row.motivo_visita is distinct from v_payload->>''motivoVisita''',
        'or v_row.motivo_visita is distinct from v_payload->>''motivoVisita'' or v_row.motivo_visita_outro is distinct from v_payload->>''motivoVisitaOutro'''
      );
      definicao := pg_temp.prancheta_substituir_uma(
        definicao,
        '''motivoVisitaNovo'', v_payload->>''motivoVisita''',
        '''motivoVisitaNovo'', v_payload->>''motivoVisita'', ''motivoVisitaOutroAnterior'', v_row.motivo_visita_outro, ''motivoVisitaOutroNovo'', v_payload->>''motivoVisitaOutro'''
      );
    END IF;
    EXECUTE definicao;
  END LOOP;
END
$conclusao$;

COMMIT;
