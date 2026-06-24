-- Migration: adiciona campos de negociacoes comerciais ao consolidado da IA
-- Todos os campos sao jsonb nullable, sem default, sem constraint, sem NOT NULL
-- Compatibilidade total com analises antigas (null tratado como [] no parser)

ALTER TABLE public.venda_analise_comercial_ia
  ADD COLUMN IF NOT EXISTS negociacoes_prazo     jsonb,
  ADD COLUMN IF NOT EXISTS negociacoes_frete     jsonb,
  ADD COLUMN IF NOT EXISTS negociacoes_desconto  jsonb,
  ADD COLUMN IF NOT EXISTS negociacoes_pagamento jsonb,
  ADD COLUMN IF NOT EXISTS valores_citados       jsonb;
