-- PREPARADA, NÃO APLICADA EM PRODUÇÃO.
-- Cache confirmado via MCP em phsoawbdvhurroryfnok em 09/10/2026:
-- 36565/19075, 36566/19076, 36567/19077, 36568/19078.
-- O onboarding pelo worker existente já ocorreu; não o repetir.
-- Valida identidade/status/preço e preenche apenas vínculos do catálogo Decorisi.
-- Não altera preço, unidade, cache, disponibilidade do fornecedor ou integração VPS.
select public.decorisi_vincular_produtos_sgi();
