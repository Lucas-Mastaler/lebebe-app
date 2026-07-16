-- Fase 5: definitive persistence for completed Atendimento Presencial records.
-- This migration has not been applied yet. It replaces only the pending Fase 5 SQL.

ALTER TABLE public.atendimento_presencial_atendimentos
  ADD COLUMN IF NOT EXISTS resultado_atendimento text,
  ADD COLUMN IF NOT EXISTS motivo_outro text,
  ADD COLUMN IF NOT EXISTS observacoes text,
  ADD COLUMN IF NOT EXISTS numero_lancamento integer,
  ADD COLUMN IF NOT EXISTS concluido_em timestamptz;

ALTER TABLE public.atendimento_presencial_atendimentos
  DROP CONSTRAINT IF EXISTS atendimento_presencial_atendimentos_status_check,
  DROP CONSTRAINT IF EXISTS atendimento_presencial_atendimentos_resultado_check,
  DROP CONSTRAINT IF EXISTS atendimento_presencial_atendimentos_numero_lancamento_check,
  DROP CONSTRAINT IF EXISTS atendimento_presencial_atendimentos_motivo_outro_check,
  DROP CONSTRAINT IF EXISTS atendimento_presencial_atendimentos_observacoes_check,
  DROP CONSTRAINT IF EXISTS atendimento_presencial_atendimentos_conclusao_check,
  DROP CONSTRAINT IF EXISTS atendimento_presencial_atendimentos_dados_check;

ALTER TABLE public.atendimento_presencial_atendimentos
  ADD CONSTRAINT atendimento_presencial_atendimentos_status_check
    CHECK (status IN ('rascunho', 'concluido')),
  ADD CONSTRAINT atendimento_presencial_atendimentos_resultado_check
    CHECK (resultado_atendimento IS NULL OR resultado_atendimento IN ('sim', 'nao', 'negociacao')),
  ADD CONSTRAINT atendimento_presencial_atendimentos_numero_lancamento_check
    CHECK (numero_lancamento IS NULL OR numero_lancamento BETWEEN 1 AND 999999),
  ADD CONSTRAINT atendimento_presencial_atendimentos_motivo_outro_check
    CHECK (motivo_outro IS NULL OR char_length(btrim(motivo_outro)) BETWEEN 1 AND 120),
  ADD CONSTRAINT atendimento_presencial_atendimentos_observacoes_check
    CHECK (observacoes IS NULL OR char_length(observacoes) <= 2000),
  ADD CONSTRAINT atendimento_presencial_atendimentos_dados_check
    CHECK (
      jsonb_typeof(dados_rascunho) = 'object'
      AND pg_column_size(dados_rascunho) <= 16384
    ),
  ADD CONSTRAINT atendimento_presencial_atendimentos_conclusao_check
    CHECK (
      (
        status = 'rascunho'
        AND concluido_em IS NULL
        AND resultado_atendimento IS NULL
        AND motivo_outro IS NULL
        AND observacoes IS NULL
        AND numero_lancamento IS NULL
      )
      OR
      (
        status = 'concluido'
        AND cliente_id IS NOT NULL
        AND resultado_atendimento IS NOT NULL
        AND concluido_em IS NOT NULL
        AND (
          (resultado_atendimento = 'sim' AND numero_lancamento IS NOT NULL)
          OR
          (resultado_atendimento IN ('nao', 'negociacao') AND numero_lancamento IS NULL)
        )
      )
    );

CREATE TABLE IF NOT EXISTS public.atendimento_presencial_criancas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  atendimento_id uuid NOT NULL REFERENCES public.atendimento_presencial_atendimentos(id) ON DELETE CASCADE,
  ordem integer NOT NULL,
  local_id text,
  situacao text NOT NULL,
  nome text,
  sexo text,
  data_prevista_nascimento date,
  idade_unidade text,
  idade_valor integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT atendimento_presencial_criancas_ordem_check CHECK (ordem >= 1),
  CONSTRAINT atendimento_presencial_criancas_situacao_check
    CHECK (situacao IN ('gestacao', 'ja_nasceu', 'presente_outra_pessoa', 'nao_informado')),
  CONSTRAINT atendimento_presencial_criancas_sexo_check
    CHECK (sexo IS NULL OR sexo IN ('menina', 'menino', 'nao_informado', 'prefere_nao_informar')),
  CONSTRAINT atendimento_presencial_criancas_idade_unidade_check
    CHECK (idade_unidade IS NULL OR idade_unidade IN ('meses', 'anos')),
  CONSTRAINT atendimento_presencial_criancas_idade_valor_check
    CHECK (
      idade_valor IS NULL
      OR (idade_unidade = 'meses' AND idade_valor BETWEEN 1 AND 11)
      OR (idade_unidade = 'anos' AND idade_valor BETWEEN 1 AND 6)
    ),
  CONSTRAINT atendimento_presencial_criancas_condicional_check
    CHECK (
      (situacao = 'gestacao' AND idade_unidade IS NULL AND idade_valor IS NULL)
      OR (situacao = 'ja_nasceu' AND data_prevista_nascimento IS NULL AND idade_unidade IS NOT NULL AND idade_valor IS NOT NULL)
      OR (situacao IN ('presente_outra_pessoa', 'nao_informado') AND data_prevista_nascimento IS NULL AND idade_unidade IS NULL AND idade_valor IS NULL)
    ),
  CONSTRAINT atendimento_presencial_criancas_nome_check CHECK (nome IS NULL OR char_length(nome) <= 80),
  CONSTRAINT atendimento_presencial_criancas_local_id_check CHECK (local_id IS NULL OR char_length(local_id) <= 80)
);

CREATE TABLE IF NOT EXISTS public.atendimento_presencial_departamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  atendimento_id uuid NOT NULL REFERENCES public.atendimento_presencial_atendimentos(id) ON DELETE CASCADE,
  departamento text NOT NULL,
  ordem integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT atendimento_presencial_departamentos_ordem_check CHECK (ordem >= 1),
  CONSTRAINT atendimento_presencial_departamentos_departamento_check
    CHECK (departamento IN ('p_pesada', 'moveis', 'p_leve', 'enxoval', 'decoracao', 'roupinhas'))
);

CREATE TABLE IF NOT EXISTS public.atendimento_presencial_produtos_interesse (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  atendimento_id uuid NOT NULL REFERENCES public.atendimento_presencial_atendimentos(id) ON DELETE CASCADE,
  descricao text NOT NULL,
  ordem integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT atendimento_presencial_produtos_ordem_check CHECK (ordem >= 1),
  CONSTRAINT atendimento_presencial_produtos_descricao_check
    CHECK (char_length(btrim(descricao)) BETWEEN 1 AND 80)
);

CREATE TABLE IF NOT EXISTS public.atendimento_presencial_motivos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  atendimento_id uuid NOT NULL REFERENCES public.atendimento_presencial_atendimentos(id) ON DELETE CASCADE,
  motivo text NOT NULL,
  complemento text,
  ordem integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT atendimento_presencial_motivos_ordem_check CHECK (ordem >= 1),
  CONSTRAINT atendimento_presencial_motivos_motivo_check
    CHECK (
      motivo IN (
        'qualidade_produto',
        'design_aparencia',
        'cor_acabamento',
        'tamanho_medidas',
        'produto_disponivel',
        'produto_indisponivel',
        'variedade_produtos',
        'preco',
        'desconto',
        'condicao_pagamento',
        'brinde',
        'frete',
        'montagem',
        'prazo_entrega',
        'necessidade_imediata',
        'aguardar_nascimento',
        'ainda_pesquisando',
        'comparacao_concorrente',
        'conversar_outra_pessoa',
        'sem_orcamento',
        'indecisao_produtos',
        'confianca_loja',
        'atendimento',
        'outro'
      )
    ),
  CONSTRAINT atendimento_presencial_motivos_complemento_check
    CHECK (
      (motivo = 'outro' AND complemento IS NOT NULL AND char_length(btrim(complemento)) BETWEEN 1 AND 120)
      OR (motivo <> 'outro' AND complemento IS NULL)
    )
);

CREATE TABLE IF NOT EXISTS public.atendimento_presencial_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  atendimento_id uuid NOT NULL REFERENCES public.atendimento_presencial_atendimentos(id) ON DELETE CASCADE,
  usuario_id uuid NOT NULL REFERENCES public.usuarios_permitidos(id) ON DELETE RESTRICT,
  perfil text,
  role text NOT NULL,
  acao text NOT NULL,
  origem text NOT NULL,
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT atendimento_presencial_historico_acao_check CHECK (acao IN ('concluido')),
  CONSTRAINT atendimento_presencial_historico_origem_check CHECK (origem IN ('api')),
  CONSTRAINT atendimento_presencial_historico_snapshot_check
    CHECK (jsonb_typeof(snapshot) = 'object' AND pg_column_size(snapshot) <= 1024)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_atendimento_presencial_criancas_ordem
  ON public.atendimento_presencial_criancas (atendimento_id, ordem);

CREATE INDEX IF NOT EXISTS idx_atendimento_presencial_criancas_atendimento
  ON public.atendimento_presencial_criancas (atendimento_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_atendimento_presencial_departamentos_valor
  ON public.atendimento_presencial_departamentos (atendimento_id, departamento);

CREATE INDEX IF NOT EXISTS idx_atendimento_presencial_departamentos_atendimento
  ON public.atendimento_presencial_departamentos (atendimento_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_atendimento_presencial_produtos_descricao
  ON public.atendimento_presencial_produtos_interesse (atendimento_id, lower(descricao));

CREATE INDEX IF NOT EXISTS idx_atendimento_presencial_produtos_atendimento
  ON public.atendimento_presencial_produtos_interesse (atendimento_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_atendimento_presencial_motivos_valor
  ON public.atendimento_presencial_motivos (atendimento_id, motivo);

CREATE INDEX IF NOT EXISTS idx_atendimento_presencial_motivos_atendimento
  ON public.atendimento_presencial_motivos (atendimento_id);

CREATE INDEX IF NOT EXISTS idx_atendimento_presencial_historico_atendimento
  ON public.atendimento_presencial_historico (atendimento_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_atendimento_presencial_historico_usuario
  ON public.atendimento_presencial_historico (usuario_id);

CREATE INDEX IF NOT EXISTS idx_atendimento_presencial_atendimentos_concluidos
  ON public.atendimento_presencial_atendimentos (concluido_em DESC)
  WHERE status = 'concluido';

CREATE INDEX IF NOT EXISTS idx_atendimento_presencial_atendimentos_lancamento
  ON public.atendimento_presencial_atendimentos (numero_lancamento)
  WHERE status = 'concluido' AND numero_lancamento IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_atendimento_presencial_atendimentos_unidade_concluido
  ON public.atendimento_presencial_atendimentos (unidade_id, concluido_em DESC)
  WHERE status = 'concluido';

CREATE INDEX IF NOT EXISTS idx_atendimento_presencial_atendimentos_consultora_concluido
  ON public.atendimento_presencial_atendimentos (consultora_usuario_id, concluido_em DESC)
  WHERE status = 'concluido';

DROP FUNCTION IF EXISTS public.atendimento_presencial_concluir(uuid, integer, uuid, text, text, integer);
DROP FUNCTION IF EXISTS public.atendimento_presencial_concluir(uuid, integer, uuid, integer);

CREATE OR REPLACE FUNCTION public.atendimento_presencial_concluir(
  p_atendimento_id uuid,
  p_expected_version integer,
  p_usuario_id uuid,
  p_numero_lancamento integer DEFAULT NULL
)
RETURNS TABLE(id uuid, version integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_row public.atendimento_presencial_atendimentos%ROWTYPE;
  v_dados jsonb;
  v_resultado text;
  v_motivo_outro text;
  v_observacoes text;
  v_numero_lancamento integer;
  v_executor_role text;
  v_executor_perfil text;
  v_updated_id uuid;
  v_updated_version integer;
  v_crianca jsonb;
  v_data_text text;
BEGIN
  SELECT *
    INTO v_row
    FROM public.atendimento_presencial_atendimentos apa
    WHERE apa.id = p_atendimento_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'atendimento_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF v_row.status <> 'rascunho' THEN
    RAISE EXCEPTION 'atendimento_not_draft' USING ERRCODE = 'P0001';
  END IF;

  IF v_row.version <> p_expected_version THEN
    RAISE EXCEPTION 'version_conflict' USING ERRCODE = 'P0003';
  END IF;

  IF v_row.expira_em <= now() THEN
    RAISE EXCEPTION 'rascunho_expirado' USING ERRCODE = 'P0004';
  END IF;

  SELECT up.role
    INTO v_executor_role
    FROM public.usuarios_permitidos up
    WHERE up.id = p_usuario_id
      AND up.ativo = true;

  IF v_executor_role IS NULL THEN
    RAISE EXCEPTION 'executor_invalido' USING ERRCODE = '42501';
  END IF;

  SELECT apa.chave
    INTO v_executor_perfil
    FROM public.app_usuarios_perfis aup
    JOIN public.app_perfis_acesso apa ON apa.id = aup.perfil_id
    WHERE aup.usuario_id = p_usuario_id
      AND apa.ativo = true;

  IF v_executor_role <> 'superadmin' AND v_executor_perfil IS NULL THEN
    RAISE EXCEPTION 'perfil_executor_invalido' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM public.app_unidades au
      WHERE au.id = v_row.unidade_id
        AND au.ativo = true
  ) THEN
    RAISE EXCEPTION 'unidade_inativa' USING ERRCODE = '23514';
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM public.usuarios_permitidos up
      WHERE up.id = v_row.consultora_usuario_id
        AND up.ativo = true
  ) THEN
    RAISE EXCEPTION 'consultora_inativa' USING ERRCODE = '23514';
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM public.app_usuarios_perfis aup
      JOIN public.app_perfis_acesso apa ON apa.id = aup.perfil_id
      WHERE aup.usuario_id = v_row.consultora_usuario_id
        AND apa.chave = 'consultora'
        AND apa.ativo = true
  ) THEN
    RAISE EXCEPTION 'consultora_perfil_invalido' USING ERRCODE = '23514';
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM public.app_usuarios_unidades auu
      WHERE auu.usuario_id = v_row.consultora_usuario_id
        AND auu.unidade_id = v_row.unidade_id
  ) THEN
    RAISE EXCEPTION 'consultora_unidade_invalida' USING ERRCODE = '23514';
  END IF;

  IF v_executor_role = 'superadmin' THEN
    NULL;
  ELSIF v_executor_perfil = 'consultora' THEN
    IF v_row.consultora_usuario_id <> p_usuario_id THEN
      RAISE EXCEPTION 'access_denied' USING ERRCODE = '42501';
    END IF;
    IF NOT EXISTS (
      SELECT 1
        FROM public.app_usuarios_unidades auu
        WHERE auu.usuario_id = p_usuario_id
          AND auu.unidade_id = v_row.unidade_id
    ) THEN
      RAISE EXCEPTION 'access_denied' USING ERRCODE = '42501';
    END IF;
  ELSIF v_executor_perfil IN ('supervisora_loja', 'gestao') THEN
    IF NOT EXISTS (
      SELECT 1
        FROM public.app_usuarios_unidades auu
        WHERE auu.usuario_id = p_usuario_id
          AND auu.unidade_id = v_row.unidade_id
    ) THEN
      RAISE EXCEPTION 'access_denied' USING ERRCODE = '42501';
    END IF;
  ELSE
    RAISE EXCEPTION 'access_denied' USING ERRCODE = '42501';
  END IF;

  IF v_row.cliente_id IS NULL THEN
    RAISE EXCEPTION 'cliente_obrigatoria' USING ERRCODE = '23514';
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM public.atendimento_presencial_clientes apc
      WHERE apc.id = v_row.cliente_id
        AND apc.status = 'ativo'
  ) THEN
    RAISE EXCEPTION 'cliente_inativa' USING ERRCODE = '23514';
  END IF;

  v_dados := v_row.dados_rascunho;

  IF jsonb_typeof(v_dados) <> 'object' THEN
    RAISE EXCEPTION 'dados_rascunho_invalidos' USING ERRCODE = '23514';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM jsonb_object_keys(v_dados) AS chave(valor)
      WHERE chave.valor NOT IN (
        'cliente',
        'criancas',
        'departamentos',
        'produtosInteresse',
        'resultadoAtendimento',
        'motivosResultado',
        'motivoOutro',
        'observacoes',
        'etapaAtual',
        'notaTecnica'
      )
  ) THEN
    RAISE EXCEPTION 'dados_rascunho_chave_invalida' USING ERRCODE = '23514';
  END IF;

  IF jsonb_typeof(v_dados->'resultadoAtendimento') IS DISTINCT FROM 'string' THEN
    RAISE EXCEPTION 'resultado_obrigatorio' USING ERRCODE = '23514';
  END IF;

  IF v_dados ? 'motivoOutro'
     AND jsonb_typeof(v_dados->'motivoOutro') <> 'string' THEN
    RAISE EXCEPTION 'motivo_outro_invalido' USING ERRCODE = '23514';
  END IF;

  IF v_dados ? 'observacoes'
     AND jsonb_typeof(v_dados->'observacoes') <> 'string' THEN
    RAISE EXCEPTION 'observacoes_invalidas' USING ERRCODE = '23514';
  END IF;

  IF jsonb_typeof(v_dados->'etapaAtual') IS DISTINCT FROM 'string' THEN
    RAISE EXCEPTION 'etapa_invalida' USING ERRCODE = '23514';
  END IF;

  IF jsonb_typeof(v_dados->'criancas') IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'criancas_invalidas' USING ERRCODE = '23514';
  END IF;
  IF jsonb_typeof(v_dados->'departamentos') IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'departamentos_invalidos' USING ERRCODE = '23514';
  END IF;
  IF jsonb_typeof(v_dados->'produtosInteresse') IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'produtos_invalidos' USING ERRCODE = '23514';
  END IF;
  IF jsonb_typeof(v_dados->'motivosResultado') IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'motivos_invalidos' USING ERRCODE = '23514';
  END IF;

  IF jsonb_array_length(v_dados->'criancas') > 8 THEN
    RAISE EXCEPTION 'criancas_limite_excedido' USING ERRCODE = '23514';
  END IF;
  IF jsonb_array_length(v_dados->'departamentos') = 0 OR jsonb_array_length(v_dados->'departamentos') > 6 THEN
    RAISE EXCEPTION 'departamento_obrigatorio' USING ERRCODE = '23514';
  END IF;
  IF jsonb_array_length(v_dados->'produtosInteresse') > 20 THEN
    RAISE EXCEPTION 'produtos_limite_excedido' USING ERRCODE = '23514';
  END IF;
  IF jsonb_array_length(v_dados->'motivosResultado') = 0 OR jsonb_array_length(v_dados->'motivosResultado') > 24 THEN
    RAISE EXCEPTION 'motivo_obrigatorio' USING ERRCODE = '23514';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM jsonb_array_elements(v_dados->'departamentos') AS item(value)
      WHERE jsonb_typeof(item.value) <> 'string'
        OR item.value #>> '{}' NOT IN ('p_pesada', 'moveis', 'p_leve', 'enxoval', 'decoracao', 'roupinhas')
  ) THEN
    RAISE EXCEPTION 'departamento_invalido' USING ERRCODE = '23514';
  END IF;

  IF (
    SELECT count(*) <> count(DISTINCT item.value #>> '{}')
      FROM jsonb_array_elements(v_dados->'departamentos') AS item(value)
  ) THEN
    RAISE EXCEPTION 'departamento_duplicado' USING ERRCODE = '23514';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM jsonb_array_elements(v_dados->'produtosInteresse') AS item(value)
      WHERE jsonb_typeof(item.value) <> 'string'
        OR char_length(btrim(item.value #>> '{}')) NOT BETWEEN 1 AND 80
  ) THEN
    RAISE EXCEPTION 'produto_invalido' USING ERRCODE = '23514';
  END IF;

  IF (
    SELECT count(*) <> count(DISTINCT lower(btrim(item.value #>> '{}')))
      FROM jsonb_array_elements(v_dados->'produtosInteresse') AS item(value)
  ) THEN
    RAISE EXCEPTION 'produto_duplicado' USING ERRCODE = '23514';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM jsonb_array_elements(v_dados->'motivosResultado') AS item(value)
      WHERE jsonb_typeof(item.value) <> 'string'
        OR item.value #>> '{}' NOT IN (
          'qualidade_produto',
          'design_aparencia',
          'cor_acabamento',
          'tamanho_medidas',
          'produto_disponivel',
          'produto_indisponivel',
          'variedade_produtos',
          'preco',
          'desconto',
          'condicao_pagamento',
          'brinde',
          'frete',
          'montagem',
          'prazo_entrega',
          'necessidade_imediata',
          'aguardar_nascimento',
          'ainda_pesquisando',
          'comparacao_concorrente',
          'conversar_outra_pessoa',
          'sem_orcamento',
          'indecisao_produtos',
          'confianca_loja',
          'atendimento',
          'outro'
        )
  ) THEN
    RAISE EXCEPTION 'motivo_invalido' USING ERRCODE = '23514';
  END IF;

  IF (
    SELECT count(*) <> count(DISTINCT item.value #>> '{}')
      FROM jsonb_array_elements(v_dados->'motivosResultado') AS item(value)
  ) THEN
    RAISE EXCEPTION 'motivo_duplicado' USING ERRCODE = '23514';
  END IF;

  FOR v_crianca IN SELECT value FROM jsonb_array_elements(v_dados->'criancas') AS item(value)
  LOOP
    IF jsonb_typeof(v_crianca) <> 'object' THEN
      RAISE EXCEPTION 'crianca_invalida' USING ERRCODE = '23514';
    END IF;

    IF jsonb_typeof(v_crianca->'id') IS DISTINCT FROM 'string'
       OR char_length(btrim(v_crianca->>'id')) NOT BETWEEN 4 AND 80 THEN
      RAISE EXCEPTION 'crianca_id_invalido' USING ERRCODE = '23514';
    END IF;

    IF v_crianca->>'situacao' NOT IN ('gestacao', 'ja_nasceu', 'presente_outra_pessoa', 'nao_informado') THEN
      RAISE EXCEPTION 'crianca_situacao_invalida' USING ERRCODE = '23514';
    END IF;

    IF v_crianca ? 'nome'
       AND jsonb_typeof(v_crianca->'nome') <> 'string' THEN
      RAISE EXCEPTION 'crianca_nome_invalido' USING ERRCODE = '23514';
    END IF;

    IF v_crianca ? 'nome'
       AND char_length(btrim(v_crianca->>'nome')) > 80 THEN
      RAISE EXCEPTION 'crianca_nome_invalido' USING ERRCODE = '23514';
    END IF;

    IF v_crianca ? 'sexo'
       AND (
         jsonb_typeof(v_crianca->'sexo') <> 'string'
         OR v_crianca->>'sexo' NOT IN ('menina', 'menino', 'nao_informado', 'prefere_nao_informar')
       ) THEN
      RAISE EXCEPTION 'crianca_sexo_invalido' USING ERRCODE = '23514';
    END IF;

    IF v_crianca->>'situacao' = 'gestacao' THEN
      IF v_crianca ? 'idadeUnidade' OR v_crianca ? 'idadeValor' THEN
        RAISE EXCEPTION 'crianca_idade_indevida' USING ERRCODE = '23514';
      END IF;
      IF v_crianca ? 'dataPrevistaNascimento' THEN
        IF jsonb_typeof(v_crianca->'dataPrevistaNascimento') <> 'string'
           OR v_crianca->>'dataPrevistaNascimento' !~ '^\d{4}-\d{2}-\d{2}$' THEN
          RAISE EXCEPTION 'crianca_data_invalida' USING ERRCODE = '23514';
        END IF;
        v_data_text := v_crianca->>'dataPrevistaNascimento';
        BEGIN
          PERFORM v_data_text::date;
        EXCEPTION WHEN others THEN
          RAISE EXCEPTION 'crianca_data_invalida' USING ERRCODE = '23514';
        END;
      END IF;
    ELSIF v_crianca->>'situacao' = 'ja_nasceu' THEN
      IF v_crianca ? 'dataPrevistaNascimento' THEN
        RAISE EXCEPTION 'crianca_data_indevida' USING ERRCODE = '23514';
      END IF;
      IF jsonb_typeof(v_crianca->'idadeUnidade') IS DISTINCT FROM 'string'
         OR v_crianca->>'idadeUnidade' NOT IN ('meses', 'anos')
         OR jsonb_typeof(v_crianca->'idadeValor') IS DISTINCT FROM 'number'
         OR (v_crianca->>'idadeValor') !~ '^\d+$'
         OR (
           v_crianca->>'idadeUnidade' = 'meses'
           AND (v_crianca->>'idadeValor')::integer NOT BETWEEN 1 AND 11
         )
         OR (
           v_crianca->>'idadeUnidade' = 'anos'
           AND (v_crianca->>'idadeValor')::integer NOT BETWEEN 1 AND 6
         ) THEN
        RAISE EXCEPTION 'crianca_idade_invalida' USING ERRCODE = '23514';
      END IF;
    ELSE
      IF v_crianca ? 'dataPrevistaNascimento'
         OR v_crianca ? 'idadeUnidade'
         OR v_crianca ? 'idadeValor' THEN
        RAISE EXCEPTION 'crianca_dados_condicionais_invalidos' USING ERRCODE = '23514';
      END IF;
    END IF;
  END LOOP;

  v_resultado := v_dados->>'resultadoAtendimento';
  v_motivo_outro := nullif(btrim(v_dados->>'motivoOutro'), '');
  v_observacoes := nullif(btrim(v_dados->>'observacoes'), '');

  IF v_resultado NOT IN ('sim', 'nao', 'negociacao') THEN
    RAISE EXCEPTION 'resultado_obrigatorio' USING ERRCODE = '23514';
  END IF;

  IF v_observacoes IS NOT NULL AND char_length(v_observacoes) > 2000 THEN
    RAISE EXCEPTION 'observacoes_limite_excedido' USING ERRCODE = '23514';
  END IF;

  IF v_motivo_outro IS NOT NULL AND char_length(v_motivo_outro) > 120 THEN
    RAISE EXCEPTION 'motivo_outro_limite_excedido' USING ERRCODE = '23514';
  END IF;

  IF (v_dados->'motivosResultado') ? 'outro' AND v_motivo_outro IS NULL THEN
    RAISE EXCEPTION 'motivo_outro_obrigatorio' USING ERRCODE = '23514';
  END IF;

  IF NOT ((v_dados->'motivosResultado') ? 'outro') AND v_motivo_outro IS NOT NULL THEN
    RAISE EXCEPTION 'motivo_outro_indevido' USING ERRCODE = '23514';
  END IF;

  IF v_resultado = 'sim' THEN
    IF p_numero_lancamento IS NULL OR p_numero_lancamento < 1 OR p_numero_lancamento > 999999 THEN
      RAISE EXCEPTION 'numero_lancamento_obrigatorio' USING ERRCODE = '23514';
    END IF;
    v_numero_lancamento := p_numero_lancamento;
  ELSE
    IF p_numero_lancamento IS NOT NULL THEN
      RAISE EXCEPTION 'numero_lancamento_indevido' USING ERRCODE = '23514';
    END IF;
    v_numero_lancamento := NULL;
  END IF;

  DELETE FROM public.atendimento_presencial_criancas WHERE atendimento_id = p_atendimento_id;
  DELETE FROM public.atendimento_presencial_departamentos WHERE atendimento_id = p_atendimento_id;
  DELETE FROM public.atendimento_presencial_produtos_interesse WHERE atendimento_id = p_atendimento_id;
  DELETE FROM public.atendimento_presencial_motivos WHERE atendimento_id = p_atendimento_id;

  INSERT INTO public.atendimento_presencial_criancas (
    atendimento_id,
    ordem,
    local_id,
    situacao,
    nome,
    sexo,
    data_prevista_nascimento,
    idade_unidade,
    idade_valor
  )
  SELECT
    p_atendimento_id,
    item.ord::integer,
    nullif(btrim(item.value->>'id'), ''),
    item.value->>'situacao',
    nullif(btrim(item.value->>'nome'), ''),
    nullif(item.value->>'sexo', ''),
    CASE
      WHEN item.value->>'situacao' = 'gestacao'
       AND item.value ? 'dataPrevistaNascimento'
      THEN (item.value->>'dataPrevistaNascimento')::date
      ELSE NULL
    END,
    CASE WHEN item.value->>'situacao' = 'ja_nasceu' THEN item.value->>'idadeUnidade' ELSE NULL END,
    CASE WHEN item.value->>'situacao' = 'ja_nasceu' THEN (item.value->>'idadeValor')::integer ELSE NULL END
  FROM jsonb_array_elements(v_dados->'criancas') WITH ORDINALITY AS item(value, ord);

  INSERT INTO public.atendimento_presencial_departamentos (atendimento_id, departamento, ordem)
  SELECT
    p_atendimento_id,
    item.value #>> '{}',
    item.ord::integer
  FROM jsonb_array_elements(v_dados->'departamentos') WITH ORDINALITY AS item(value, ord);

  INSERT INTO public.atendimento_presencial_produtos_interesse (atendimento_id, descricao, ordem)
  SELECT
    p_atendimento_id,
    btrim(item.value #>> '{}'),
    item.ord::integer
  FROM jsonb_array_elements(v_dados->'produtosInteresse') WITH ORDINALITY AS item(value, ord);

  INSERT INTO public.atendimento_presencial_motivos (atendimento_id, motivo, complemento, ordem)
  SELECT
    p_atendimento_id,
    item.value #>> '{}',
    CASE WHEN item.value #>> '{}' = 'outro' THEN v_motivo_outro ELSE NULL END,
    item.ord::integer
  FROM jsonb_array_elements(v_dados->'motivosResultado') WITH ORDINALITY AS item(value, ord);

  UPDATE public.atendimento_presencial_atendimentos apa
    SET status = 'concluido',
        dados_rascunho = jsonb_build_object('schema', 'atendimento_presencial_concluido_v1'),
        resultado_atendimento = v_resultado,
        motivo_outro = v_motivo_outro,
        observacoes = v_observacoes,
        numero_lancamento = v_numero_lancamento,
        concluido_em = now(),
        ultima_atividade_em = now(),
        expira_em = now(),
        atualizado_por = p_usuario_id
    WHERE apa.id = p_atendimento_id
    RETURNING apa.id, apa.version
    INTO v_updated_id, v_updated_version;

  INSERT INTO public.atendimento_presencial_historico (
    atendimento_id,
    usuario_id,
    perfil,
    role,
    acao,
    origem,
    snapshot
  )
  VALUES (
    p_atendimento_id,
    p_usuario_id,
    v_executor_perfil,
    v_executor_role,
    'concluido',
    'api',
    jsonb_build_object(
      'resultadoAtendimento', v_resultado,
      'numeroLancamento', v_numero_lancamento,
      'version', v_updated_version
    )
  );

  RETURN QUERY SELECT v_updated_id, v_updated_version;
END;
$$;

REVOKE ALL ON FUNCTION public.atendimento_presencial_concluir(uuid, integer, uuid, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.atendimento_presencial_concluir(uuid, integer, uuid, integer)
  TO service_role;

DO $$
DECLARE
  tabela text;
  policy_prefix text;
BEGIN
  FOREACH tabela IN ARRAY ARRAY[
    'atendimento_presencial_criancas',
    'atendimento_presencial_departamentos',
    'atendimento_presencial_produtos_interesse',
    'atendimento_presencial_motivos',
    'atendimento_presencial_historico'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tabela);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', tabela);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', tabela);

    policy_prefix := tabela || '_no_direct';
    IF tabela = 'atendimento_presencial_produtos_interesse' THEN
      policy_prefix := 'atendimento_presencial_produtos_no_direct';
    END IF;

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', policy_prefix || '_select', tabela);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', policy_prefix || '_insert', tabela);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', policy_prefix || '_update', tabela);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', policy_prefix || '_delete', tabela);

    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (false)',
      policy_prefix || '_select',
      tabela
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (false)',
      policy_prefix || '_insert',
      tabela
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (false) WITH CHECK (false)',
      policy_prefix || '_update',
      tabela
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (false)',
      policy_prefix || '_delete',
      tabela
    );
  END LOOP;
END;
$$;
