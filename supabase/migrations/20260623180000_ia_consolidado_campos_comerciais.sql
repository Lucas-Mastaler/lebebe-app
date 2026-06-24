-- Migration: adiciona campos comerciais ao consolidado da IA
-- Campos novos sao todos nullable para compatibilidade com analises antigas

ALTER TABLE public.venda_analise_comercial_ia
  ADD COLUMN IF NOT EXISTS produtos_fechados jsonb,
  ADD COLUMN IF NOT EXISTS produtos_interesse_nao_fechados jsonb,
  ADD COLUMN IF NOT EXISTS tipo_fechamento text,
  ADD COLUMN IF NOT EXISTS confianca_tipo_fechamento text,
  ADD COLUMN IF NOT EXISTS evidencias_tipo_fechamento jsonb;
