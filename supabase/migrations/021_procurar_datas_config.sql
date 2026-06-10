-- ============================================================
-- 021_procurar_datas_config.sql
-- Fase 2 — Espelho/snapshot das configurações do motor
-- "Procurar Datas" importadas da planilha Google Sheets.
--
-- Fonte oficial ainda é a planilha nesta fase.
-- O motor de busca NÃO usa estas tabelas ainda.
-- Estas tabelas preparam a migração futura (Fase 3 e 4).
-- ============================================================

-- ── 1. Tabela principal de configurações ────────────────────
-- Uma linha por chave. Upsert por chave_upper (normalizada).

CREATE TABLE IF NOT EXISTS public.procurar_datas_config (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identificação da chave
  chave       text        NOT NULL,
  chave_upper text        NOT NULL,    -- sempre UPPERCASE, chave de upsert

  -- Agrupamento (espelha os grupos da tela)
  grupo       text        NOT NULL,
  ordem       smallint    NOT NULL DEFAULT 0,

  -- Valor
  valor       text,                    -- NULL se is_secret = true
  valor_tipo  text        NOT NULL DEFAULT 'text',
  is_secret   boolean     NOT NULL DEFAULT false,
  unidade     text,                    -- informativo: "m", "km", "BRL", etc.

  -- Controle
  ativo       boolean     NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT pdc_chave_upper_unique UNIQUE (chave_upper),
  CONSTRAINT pdc_grupo_check CHECK (grupo IN (
    'geral', 'rota', 'candidatos_precos', 'equipes', 'frete', 'provedores'
  )),
  CONSTRAINT pdc_valor_tipo_check CHECK (valor_tipo IN (
    'text', 'url', 'number', 'distance_m', 'distance_km',
    'currency', 'decimal', 'boolean', 'address', 'secret'
  ))
);

COMMENT ON TABLE public.procurar_datas_config IS
  'Espelho das configurações do motor Procurar Datas importadas da planilha. '
  'Fonte oficial ainda é a planilha (Fase 2). '
  'O motor de busca não consome esta tabela ainda.';

COMMENT ON COLUMN public.procurar_datas_config.chave_upper IS
  'Chave normalizada em UPPERCASE. Usada como chave de upsert (igual ao loadFreightParams do Apps Script).';

COMMENT ON COLUMN public.procurar_datas_config.valor IS
  'NULL para chaves is_secret = true. Secrets reais ficam em variáveis de ambiente.';

COMMENT ON COLUMN public.procurar_datas_config.is_secret IS
  'Se true, valor jamais é salvo nesta tabela. A chave existe apenas para registrar presença.';

CREATE INDEX idx_pdc_grupo  ON public.procurar_datas_config(grupo);
CREATE INDEX idx_pdc_ativo  ON public.procurar_datas_config(ativo);

-- Trigger: atualiza updated_at automaticamente
CREATE OR REPLACE FUNCTION public.set_pdc_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_pdc_updated_at
  BEFORE UPDATE ON public.procurar_datas_config
  FOR EACH ROW EXECUTE FUNCTION public.set_pdc_updated_at();

-- RLS
ALTER TABLE public.procurar_datas_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pdc_select_superadmin"
  ON public.procurar_datas_config
  FOR SELECT TO authenticated
  USING (public.is_superadmin());

-- INSERT/UPDATE/DELETE: apenas via service_role (bypassa RLS automaticamente)


-- ── 2. Snapshots de importação ───────────────────────────────
-- Cada importação manual gera 1 linha imutável.
-- Não sobrescrever snapshots existentes.

CREATE TABLE IF NOT EXISTS public.procurar_datas_config_snapshots (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  origem      text        NOT NULL DEFAULT 'planilha_importacao_manual',
  status      text        NOT NULL DEFAULT 'ok',
  observacao  text,

  -- Payload completo do momento da importação (apenas chaves não-secretas)
  -- Imutável após inserção
  payload     jsonb       NOT NULL DEFAULT '{}',

  -- Contadores
  total_chaves   int      NOT NULL DEFAULT 0,
  chaves_ok      int      NOT NULL DEFAULT 0,
  chaves_vazias  int      NOT NULL DEFAULT 0,

  -- Quem disparou a importação
  criado_por  text,

  created_at  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT pdcs_status_check CHECK (status IN ('ok', 'erro', 'parcial')),
  CONSTRAINT pdcs_origem_check CHECK (origem IN ('planilha_importacao_manual', 'manual'))
);

COMMENT ON TABLE public.procurar_datas_config_snapshots IS
  'Registro imutável de cada importação manual da planilha. '
  'Cada ação do botão "Importar configuração da planilha" gera 1 linha.';

COMMENT ON COLUMN public.procurar_datas_config_snapshots.payload IS
  'JSON das chaves não-secretas no momento da importação. '
  'Secrets aparecem como null no payload. Nunca alterar após inserção.';

CREATE INDEX idx_pdcs_created_at ON public.procurar_datas_config_snapshots(created_at DESC);
CREATE INDEX idx_pdcs_status     ON public.procurar_datas_config_snapshots(status);

-- RLS
ALTER TABLE public.procurar_datas_config_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pdcs_select_superadmin"
  ON public.procurar_datas_config_snapshots
  FOR SELECT TO authenticated
  USING (public.is_superadmin());


-- ── 3. Auditoria de alterações ───────────────────────────────
-- Append-only. Registra cada mudança de valor por chave.

CREATE TABLE IF NOT EXISTS public.procurar_datas_config_auditoria (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  config_id      uuid        REFERENCES public.procurar_datas_config(id),
  chave          text        NOT NULL,    -- redundante para legibilidade histórica

  valor_anterior text,
  valor_novo     text,

  acao           text        NOT NULL,
  origem         text        NOT NULL,
  alterado_por   text,
  snapshot_id    uuid        REFERENCES public.procurar_datas_config_snapshots(id),
  motivo         text,                    -- opcional Fase 2, obrigatório Fase 3+

  created_at     timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT pdca_acao_check CHECK (acao IN (
    'IMPORTADO_DA_PLANILHA',
    'EDITADO_MANUALMENTE',    -- reservado para Fase 3
    'ATIVADO',
    'DESATIVADO',
    'SNAPSHOT_CRIADO'
  )),
  CONSTRAINT pdca_origem_check CHECK (origem IN (
    'planilha_importacao_manual',
    'tela',                   -- reservado para Fase 3
    'api'
  ))
);

COMMENT ON TABLE public.procurar_datas_config_auditoria IS
  'Log append-only de alterações nas configurações. '
  'IMPORTADO_DA_PLANILHA: criado/alterado por importação manual. '
  'EDITADO_MANUALMENTE: reservado para Fase 3 (edição pela tela).';

COMMENT ON COLUMN public.procurar_datas_config_auditoria.valor_anterior IS
  'NULL para chaves is_secret = true. Secrets nunca são registrados nesta coluna.';

COMMENT ON COLUMN public.procurar_datas_config_auditoria.valor_novo IS
  'NULL para chaves is_secret = true. Secrets nunca são registrados nesta coluna.';

CREATE INDEX idx_pdca_config_id  ON public.procurar_datas_config_auditoria(config_id);
CREATE INDEX idx_pdca_created_at ON public.procurar_datas_config_auditoria(created_at DESC);
CREATE INDEX idx_pdca_chave      ON public.procurar_datas_config_auditoria(chave);

-- RLS
ALTER TABLE public.procurar_datas_config_auditoria ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pdca_select_superadmin"
  ON public.procurar_datas_config_auditoria
  FOR SELECT TO authenticated
  USING (public.is_superadmin());
