-- =========================================================
-- MIGRATION 019: SGI Inteligência Comercial — Base de Dados
--
-- Cria a estrutura inicial para armazenar os dados parseados
-- do relatório SGI Documentos de Saída, gerado pela automação
-- VPS (Python + Selenium + parser HTML → JSON).
--
-- Escopo desta migration:
--   1. sgi_importacoes_documentos_saida  (rastreamento de imports)
--   2. sgi_documentos_saida              (venda/documento principal)
--   3. sgi_documentos_saida_contatos     (telefones por venda)
--   4. sgi_documentos_saida_produtos     (itens por venda)
--   5. sgi_documentos_saida_pagamentos   (formas de pagamento por venda)
--
-- Fora do escopo (migrations futuras):
--   - Histórico / vínculo com Digisac
--   - Análise IA / fila de análise
--   - Tela /inteligencia-comercial
--
-- Não aplicar manualmente antes de revisar o conteúdo.
-- O importador VPS deve usar service_role key (bypassa RLS).
-- =========================================================


-- =========================================================
-- FUNÇÃO: is_comercial_user()
--
-- Controla acesso RLS ao módulo de inteligência comercial.
--
-- Versão 1: libera qualquer usuário ativo em usuarios_permitidos,
-- independentemente de role ('user' ou 'superadmin').
-- Futuramente, esta função pode ser refinada para restringir
-- por role específica (ex: 'comercial') ou whitelist de emails,
-- sem necessidade de alterar as policies das tabelas.
--
-- Usa SECURITY DEFINER para bypassar o RLS ao consultar
-- usuarios_permitidos (evita recursão infinita).
-- =========================================================
CREATE OR REPLACE FUNCTION is_comercial_user()
RETURNS BOOLEAN AS $$
DECLARE
  user_email TEXT;
  tem_acesso BOOLEAN;
BEGIN
  user_email := auth.jwt() ->> 'email';

  IF user_email IS NULL THEN
    RETURN FALSE;
  END IF;

  -- v1: qualquer usuário ativo no sistema tem acesso ao módulo comercial.
  -- Para restringir futuramente: adicionar filtro de role ou whitelist aqui.
  SELECT EXISTS (
    SELECT 1 FROM usuarios_permitidos
    WHERE LOWER(email) = LOWER(user_email)
      AND ativo = true
  ) INTO tem_acesso;

  RETURN COALESCE(tem_acesso, FALSE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;


-- =========================================================
-- TABELA 1: sgi_importacoes_documentos_saida
-- Rastreia cada execução do parser/automação SGI.
-- Permite auditoria e reprocessamento por importação.
-- =========================================================
CREATE TABLE IF NOT EXISTS sgi_importacoes_documentos_saida (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  arquivo_html_origem  TEXT        NOT NULL,
  arquivo_json_origem  TEXT,
  gerado_em            TIMESTAMPTZ,
  total_vendas         INTEGER     NOT NULL DEFAULT 0,
  total_processadas    INTEGER     NOT NULL DEFAULT 0,
  total_erros          INTEGER     NOT NULL DEFAULT 0,
  status               TEXT        NOT NULL DEFAULT 'pendente',
  erro_mensagem        TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE sgi_importacoes_documentos_saida IS
  'Rastreamento de cada execução do parser SGI Documentos de Saída.';
COMMENT ON COLUMN sgi_importacoes_documentos_saida.arquivo_html_origem IS
  'Nome/path do arquivo HTML exportado do SGI e parseado.';
COMMENT ON COLUMN sgi_importacoes_documentos_saida.status IS
  'Estado da importação: pendente, processando, concluido, erro.';
COMMENT ON COLUMN sgi_importacoes_documentos_saida.total_vendas IS
  'Total de vendas encontradas no JSON pelo parser.';
COMMENT ON COLUMN sgi_importacoes_documentos_saida.total_processadas IS
  'Total de vendas gravadas com sucesso no banco.';
COMMENT ON COLUMN sgi_importacoes_documentos_saida.total_erros IS
  'Total de vendas que falharam ao gravar.';


-- =========================================================
-- TABELA 2: sgi_documentos_saida
-- Tabela principal: uma linha por número de lançamento.
--
-- PREMISSA DE NEGÓCIO: numero_lancamento é único globalmente
-- no relatório SGI Documentos de Saída (todas as filiais).
-- Caso ocorra colisão entre filiais em produção, migrar para
-- UNIQUE (filial, numero_lancamento) via migration adicional.
--
-- Valores monetários são NUMERIC sem CHECK: devoluções e
-- ajustes podem produzir valores negativos ou zero.
--
-- Campos de telefone nesta tabela são ATALHO RÁPIDO apenas.
-- Fonte primária de todos os telefones: sgi_documentos_saida_contatos.
-- =========================================================
CREATE TABLE IF NOT EXISTS sgi_documentos_saida (
  id                          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  importacao_id               UUID        REFERENCES sgi_importacoes_documentos_saida(id),

  -- Identificação do documento
  numero_lancamento           TEXT        NOT NULL,
  numero_lancamento_original  TEXT,
  numero_documento            TEXT,

  -- Cliente
  cliente                     TEXT,
  contatos                    TEXT,

  -- Telefone principal (atalho rápido de consulta).
  -- Para TODOS os telefones da venda, usar sgi_documentos_saida_contatos.
  -- Essa tabela é a fonte primária para integração com Digisac/WhatsApp.
  telefone_principal          TEXT,
  telefone_normalizado        TEXT,

  -- Dados do documento
  filial                      TEXT,
  operacao                    TEXT,
  emissao_texto               TEXT,
  data_fechamento             TIMESTAMPTZ,
  reserva                     TEXT,
  vendedor                    TEXT,
  status                      TEXT,

  -- Valores monetários (NUMERIC, sem CHECK — suporta devoluções e ajustes)
  valor_mercadorias           NUMERIC,
  valor_mercadorias_texto     TEXT,
  valor_descontos             NUMERIC,
  valor_descontos_texto       TEXT,
  percentual_desconto         NUMERIC,
  percentual_desconto_texto   TEXT,
  valor_frete                 NUMERIC,
  valor_frete_texto           TEXT,
  valor_total                 NUMERIC,
  valor_total_texto           TEXT,

  -- Campos calculados pelo importador a partir das formas de pagamento.
  -- valor_credito_troca:      soma onde forma_pagamento ILIKE '%Crédito de Troca%'
  -- valor_pendente_pagamento: soma onde forma_pagamento ILIKE '%Pendente de Pagamento%'
  -- valor_pago_novo:          valor_total - valor_credito_troca
  valor_credito_troca         NUMERIC,
  valor_pendente_pagamento    NUMERIC,
  valor_pago_novo             NUMERIC,

  -- Backup completo do objeto JSON da venda para auditoria e reprocessamento
  raw_json                    JSONB,

  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT sgi_documentos_saida_numero_lancamento_unique
    UNIQUE (numero_lancamento)
);

COMMENT ON TABLE sgi_documentos_saida IS
  'Documentos de saída importados do SGI. Uma linha por numero_lancamento.';
COMMENT ON CONSTRAINT sgi_documentos_saida_numero_lancamento_unique
  ON sgi_documentos_saida IS
  'Premissa de negócio: numero_lancamento é único globalmente no SGI. '
  'Se houver colisão por filial, migrar para UNIQUE(filial, numero_lancamento).';
COMMENT ON COLUMN sgi_documentos_saida.telefone_principal IS
  'Atalho rápido para o telefone principal da venda. '
  'Fonte primária de TODOS os telefones: tabela sgi_documentos_saida_contatos.';
COMMENT ON COLUMN sgi_documentos_saida.telefone_normalizado IS
  'Atalho rápido — telefone sem DDI, como retornado pelo parser. '
  'Versão com DDI disponível em sgi_documentos_saida_contatos.telefone_normalizado_ddi.';
COMMENT ON COLUMN sgi_documentos_saida.raw_json IS
  'Objeto JSON completo da venda como gerado pelo parser. '
  'Preservado para auditoria e reprocessamento.';
COMMENT ON COLUMN sgi_documentos_saida.valor_credito_troca IS
  'Calculado pelo importador: soma de formas de pagamento onde forma_pagamento ILIKE ''%Crédito de Troca%''.';
COMMENT ON COLUMN sgi_documentos_saida.valor_pendente_pagamento IS
  'Calculado pelo importador: soma de formas de pagamento onde forma_pagamento ILIKE ''%Pendente de Pagamento%''.';
COMMENT ON COLUMN sgi_documentos_saida.valor_pago_novo IS
  'Calculado pelo importador: valor_total - valor_credito_troca.';


-- =========================================================
-- TABELA 3: sgi_documentos_saida_contatos
--
-- FONTE PRINCIPAL para busca por telefone e integração Digisac.
-- Armazena TODOS os telefones associados a uma venda,
-- inclusive o telefone principal (principal = true).
--
-- A tabela sgi_documentos_saida.telefone_normalizado é apenas
-- um atalho de leitura rápida; esta tabela é a referência real.
--
-- Regra de normalização DDI (aplicada pelo importador):
--   - Nulo/vazio                     → telefone_normalizado_ddi = NULL
--   - Começa com '55' e len >= 12    → manter como está
--   - len 10 ou 11                   → '55' + telefone_normalizado
--   - Qualquer outro formato         → NULL (inválido)
-- =========================================================
CREATE TABLE IF NOT EXISTS sgi_documentos_saida_contatos (
  id                       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  documento_saida_id       UUID        NOT NULL
    REFERENCES sgi_documentos_saida(id) ON DELETE CASCADE,
  numero_lancamento        TEXT        NOT NULL,
  telefone_original        TEXT,
  telefone_normalizado     TEXT,
  telefone_normalizado_ddi TEXT,
  principal                BOOLEAN     NOT NULL DEFAULT false,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE sgi_documentos_saida_contatos IS
  'Todos os telefones associados a um documento de saída. '
  'Fonte primária para busca por telefone e integração com Digisac/WhatsApp. '
  'sgi_documentos_saida.telefone_normalizado é apenas atalho de leitura rápida.';
COMMENT ON COLUMN sgi_documentos_saida_contatos.telefone_original IS
  'Telefone bruto como extraído do HTML do SGI, antes de qualquer normalização.';
COMMENT ON COLUMN sgi_documentos_saida_contatos.telefone_normalizado IS
  'Telefone normalizado sem DDI, como retornado pelo parser (ex: 41996706105).';
COMMENT ON COLUMN sgi_documentos_saida_contatos.telefone_normalizado_ddi IS
  'Telefone com DDI Brasil (55). '
  'Regra: len 10-11 → "55"+tel; começa com "55" e len>=12 → manter; senão NULL. '
  'Calculado pelo importador, não pelo banco.';
COMMENT ON COLUMN sgi_documentos_saida_contatos.principal IS
  'True para o telefone principal da venda — espelha sgi_documentos_saida.telefone_principal.';


-- =========================================================
-- TABELA 4: sgi_documentos_saida_produtos
-- Itens/produtos de cada documento de saída.
-- codigo pode conter hífen (ex: 6072-4): sempre TEXT.
-- =========================================================
CREATE TABLE IF NOT EXISTS sgi_documentos_saida_produtos (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  documento_saida_id   UUID        NOT NULL
    REFERENCES sgi_documentos_saida(id) ON DELETE CASCADE,
  numero_lancamento    TEXT        NOT NULL,
  codigo               TEXT,
  produto              TEXT,
  local_estocagem      TEXT,
  quantidade           NUMERIC,
  quantidade_texto     TEXT,
  valor_total          NUMERIC,
  valor_total_texto    TEXT,
  -- Categorização futura via IA ou manualmente.
  -- Valores esperados: Móveis, Carrinho/Bebê Conforto, Colchão, Enxoval,
  -- Roupinhas, Acessórios, Assistência, Outros.
  categoria_sugerida   TEXT,
  raw_json             JSONB,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE sgi_documentos_saida_produtos IS
  'Produtos/itens de cada documento de saída SGI.';
COMMENT ON COLUMN sgi_documentos_saida_produtos.codigo IS
  'Código do produto no SGI. Pode conter hífen (ex: 6072-4). Sempre TEXT, nunca NUMERIC.';
COMMENT ON COLUMN sgi_documentos_saida_produtos.categoria_sugerida IS
  'Categoria sugerida. Preenchida futuramente via IA ou manualmente. '
  'Valores: Móveis, Carrinho/Bebê Conforto, Colchão, Enxoval, '
  'Roupinhas, Acessórios, Assistência, Outros.';


-- =========================================================
-- TABELA 5: sgi_documentos_saida_pagamentos
-- Formas de pagamento de cada documento de saída.
-- =========================================================
CREATE TABLE IF NOT EXISTS sgi_documentos_saida_pagamentos (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  documento_saida_id      UUID        NOT NULL
    REFERENCES sgi_documentos_saida(id) ON DELETE CASCADE,
  numero_lancamento       TEXT        NOT NULL,
  forma_pagamento         TEXT,
  numero_parcelas         INTEGER,
  numero_parcelas_texto   TEXT,
  percentual              NUMERIC,
  percentual_texto        TEXT,
  valor                   NUMERIC,
  valor_texto             TEXT,
  nsu                     TEXT,
  numero_autorizacao      TEXT,
  raw_json                JSONB,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE sgi_documentos_saida_pagamentos IS
  'Formas de pagamento de cada documento de saída SGI.';
COMMENT ON COLUMN sgi_documentos_saida_pagamentos.nsu IS
  'Número Sequencial Único da transação de pagamento.';
COMMENT ON COLUMN sgi_documentos_saida_pagamentos.numero_autorizacao IS
  'Número de autorização da operadora do cartão.';


-- =========================================================
-- TRIGGERS: updated_at
--
-- Apenas nas tabelas principais (importacoes e documentos_saida).
-- Tabelas filhas (contatos, produtos, pagamentos) usam estratégia
-- delete + reinsert no importador: updated_at seria sempre igual
-- a created_at, sem valor informativo.
--
-- Reutiliza update_updated_at_column() existente (migration 001).
-- =========================================================
DROP TRIGGER IF EXISTS trg_updated_at_sgi_importacoes
  ON sgi_importacoes_documentos_saida;
CREATE TRIGGER trg_updated_at_sgi_importacoes
  BEFORE UPDATE ON sgi_importacoes_documentos_saida
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_updated_at_sgi_documentos_saida
  ON sgi_documentos_saida;
CREATE TRIGGER trg_updated_at_sgi_documentos_saida
  BEFORE UPDATE ON sgi_documentos_saida
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- =========================================================
-- ÍNDICES
-- =========================================================

-- sgi_documentos_saida
-- (numero_lancamento já possui índice automático via UNIQUE)
CREATE INDEX IF NOT EXISTS idx_sgi_docs_saida_importacao_id
  ON sgi_documentos_saida (importacao_id);
CREATE INDEX IF NOT EXISTS idx_sgi_docs_saida_data_fechamento
  ON sgi_documentos_saida (data_fechamento);
CREATE INDEX IF NOT EXISTS idx_sgi_docs_saida_telefone_principal
  ON sgi_documentos_saida (telefone_principal);
CREATE INDEX IF NOT EXISTS idx_sgi_docs_saida_telefone_normalizado
  ON sgi_documentos_saida (telefone_normalizado);
CREATE INDEX IF NOT EXISTS idx_sgi_docs_saida_filial
  ON sgi_documentos_saida (filial);
CREATE INDEX IF NOT EXISTS idx_sgi_docs_saida_vendedor
  ON sgi_documentos_saida (vendedor);
CREATE INDEX IF NOT EXISTS idx_sgi_docs_saida_status
  ON sgi_documentos_saida (status);

-- sgi_documentos_saida_contatos
-- Fonte principal de busca por telefone e integração Digisac
CREATE INDEX IF NOT EXISTS idx_sgi_contatos_documento_saida_id
  ON sgi_documentos_saida_contatos (documento_saida_id);
CREATE INDEX IF NOT EXISTS idx_sgi_contatos_numero_lancamento
  ON sgi_documentos_saida_contatos (numero_lancamento);
CREATE INDEX IF NOT EXISTS idx_sgi_contatos_telefone_normalizado
  ON sgi_documentos_saida_contatos (telefone_normalizado);
CREATE INDEX IF NOT EXISTS idx_sgi_contatos_telefone_ddi
  ON sgi_documentos_saida_contatos (telefone_normalizado_ddi);

-- sgi_documentos_saida_produtos
CREATE INDEX IF NOT EXISTS idx_sgi_produtos_documento_saida_id
  ON sgi_documentos_saida_produtos (documento_saida_id);
CREATE INDEX IF NOT EXISTS idx_sgi_produtos_numero_lancamento
  ON sgi_documentos_saida_produtos (numero_lancamento);
CREATE INDEX IF NOT EXISTS idx_sgi_produtos_codigo
  ON sgi_documentos_saida_produtos (codigo);

-- sgi_documentos_saida_pagamentos
CREATE INDEX IF NOT EXISTS idx_sgi_pagamentos_documento_saida_id
  ON sgi_documentos_saida_pagamentos (documento_saida_id);
CREATE INDEX IF NOT EXISTS idx_sgi_pagamentos_numero_lancamento
  ON sgi_documentos_saida_pagamentos (numero_lancamento);
CREATE INDEX IF NOT EXISTS idx_sgi_pagamentos_forma_pagamento
  ON sgi_documentos_saida_pagamentos (forma_pagamento);


-- =========================================================
-- RLS — ROW LEVEL SECURITY
-- =========================================================

ALTER TABLE sgi_importacoes_documentos_saida ENABLE ROW LEVEL SECURITY;
ALTER TABLE sgi_documentos_saida             ENABLE ROW LEVEL SECURITY;
ALTER TABLE sgi_documentos_saida_contatos    ENABLE ROW LEVEL SECURITY;
ALTER TABLE sgi_documentos_saida_produtos    ENABLE ROW LEVEL SECURITY;
ALTER TABLE sgi_documentos_saida_pagamentos  ENABLE ROW LEVEL SECURITY;

-- sgi_importacoes_documentos_saida
-- SELECT: qualquer usuário ativo. Escrita: apenas superadmin.
-- O importador VPS usa service_role (bypassa RLS).
CREATE POLICY "sgi_importacoes_select" ON sgi_importacoes_documentos_saida
  FOR SELECT USING (is_comercial_user());
CREATE POLICY "sgi_importacoes_insert" ON sgi_importacoes_documentos_saida
  FOR INSERT WITH CHECK (is_superadmin());
CREATE POLICY "sgi_importacoes_update" ON sgi_importacoes_documentos_saida
  FOR UPDATE USING (is_superadmin()) WITH CHECK (is_superadmin());
CREATE POLICY "sgi_importacoes_delete" ON sgi_importacoes_documentos_saida
  FOR DELETE USING (is_superadmin());

-- sgi_documentos_saida
-- SELECT: qualquer usuário ativo. Escrita: apenas superadmin.
CREATE POLICY "sgi_docs_saida_select" ON sgi_documentos_saida
  FOR SELECT USING (is_comercial_user());
CREATE POLICY "sgi_docs_saida_insert" ON sgi_documentos_saida
  FOR INSERT WITH CHECK (is_superadmin());
CREATE POLICY "sgi_docs_saida_update" ON sgi_documentos_saida
  FOR UPDATE USING (is_superadmin()) WITH CHECK (is_superadmin());
CREATE POLICY "sgi_docs_saida_delete" ON sgi_documentos_saida
  FOR DELETE USING (is_superadmin());

-- sgi_documentos_saida_contatos (filha — sem UPDATE/DELETE via UI)
-- Deleção via CASCADE quando o documento pai é removido.
-- O importador usa service_role (bypassa RLS) para delete+reinsert.
CREATE POLICY "sgi_contatos_select" ON sgi_documentos_saida_contatos
  FOR SELECT USING (is_comercial_user());
CREATE POLICY "sgi_contatos_insert" ON sgi_documentos_saida_contatos
  FOR INSERT WITH CHECK (is_superadmin());

-- sgi_documentos_saida_produtos (filha)
CREATE POLICY "sgi_produtos_select" ON sgi_documentos_saida_produtos
  FOR SELECT USING (is_comercial_user());
CREATE POLICY "sgi_produtos_insert" ON sgi_documentos_saida_produtos
  FOR INSERT WITH CHECK (is_superadmin());

-- sgi_documentos_saida_pagamentos (filha)
CREATE POLICY "sgi_pagamentos_select" ON sgi_documentos_saida_pagamentos
  FOR SELECT USING (is_comercial_user());
CREATE POLICY "sgi_pagamentos_insert" ON sgi_documentos_saida_pagamentos
  FOR INSERT WITH CHECK (is_superadmin());
