-- ============================================================
-- 020_ia_analise_chamados.sql
-- Tabelas para análise IA dos chamados Digisac por venda
-- ============================================================

-- ── 1. Fila de análise por venda ────────────────────────────

CREATE TABLE IF NOT EXISTS public.ia_analise_comercial_fila (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_lancamento text NOT NULL,
  documento_saida_id uuid REFERENCES public.sgi_documentos_saida(id),
  status text NOT NULL DEFAULT 'pendente',
  total_chamados int NOT NULL DEFAULT 0,
  chamados_processados int NOT NULL DEFAULT 0,
  chamados_com_erro int NOT NULL DEFAULT 0,
  solicitado_por text,
  erro_mensagem text,
  iniciado_em timestamptz,
  finalizado_em timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Apenas 1 job ativo por venda
CREATE UNIQUE INDEX ia_fila_unica_ativa
  ON public.ia_analise_comercial_fila(numero_lancamento)
  WHERE status IN ('pendente', 'processando');

ALTER TABLE public.ia_analise_comercial_fila ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ia_fila_select_comercial"
  ON public.ia_analise_comercial_fila
  FOR SELECT
  TO authenticated
  USING (public.is_comercial_user());

-- ── 2. Resultado por chamado individual ─────────────────────

CREATE TABLE IF NOT EXISTS public.digisac_chamados_analise_ia (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_lancamento text NOT NULL,
  digisac_ticket_id text NOT NULL,
  fila_id uuid REFERENCES public.ia_analise_comercial_fila(id),
  status text NOT NULL DEFAULT 'pendente',
  -- saída da IA
  resumo_chamado text,
  influencia_compra text,
  grau_influencia text,
  motivo_influencia text,
  produtos_mencionados jsonb DEFAULT '[]',
  objecoes_identificadas jsonb DEFAULT '[]',
  intencao_cliente text,
  sentimento_cliente text,
  pontos_de_atencao jsonb DEFAULT '[]',
  confianca_analise text,
  -- controle
  transcript_truncado boolean DEFAULT false,
  transcript_tamanho_chars int,
  total_mensagens int,
  tokens_usados int,
  erro_mensagem text,
  modelo_ia text,
  analisado_em timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (numero_lancamento, digisac_ticket_id)
);

ALTER TABLE public.digisac_chamados_analise_ia ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ia_chamados_select_comercial"
  ON public.digisac_chamados_analise_ia
  FOR SELECT
  TO authenticated
  USING (public.is_comercial_user());

-- ── 3. Resumo consolidado por venda ─────────────────────────

CREATE TABLE IF NOT EXISTS public.venda_analise_comercial_ia (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_lancamento text NOT NULL UNIQUE,
  documento_saida_id uuid REFERENCES public.sgi_documentos_saida(id),
  fila_id uuid REFERENCES public.ia_analise_comercial_fila(id),
  -- saída consolidada
  resumo_geral text,
  chamados_que_influenciaram jsonb DEFAULT '[]',
  chamados_sem_influencia jsonb DEFAULT '[]',
  principais_motivos_compra jsonb DEFAULT '[]',
  principais_objecoes jsonb DEFAULT '[]',
  produtos_de_interesse jsonb DEFAULT '[]',
  oportunidades_melhoria jsonb DEFAULT '[]',
  conclusao_comercial text,
  total_chamados_analisados int DEFAULT 0,
  modelo_ia text,
  gerado_em timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.venda_analise_comercial_ia ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ia_consolidado_select_comercial"
  ON public.venda_analise_comercial_ia
  FOR SELECT
  TO authenticated
  USING (public.is_comercial_user());
