-- ============================================================
-- MIGRATION: add_updated_at_triggers_atendimento_automatico
-- Aplicada via MCP Supabase em 2026-07-07 (version 20260707203049).
--
-- Adiciona triggers de updated_at nas tabelas que possuem a coluna:
--   atendimento_automatico_sessoes
--   atendimento_automatico_bloqueios
--
-- (atendimento_automatico_mensagens e atendimento_automatico_eventos
--  nao possuem updated_at, logo nao recebem trigger)
--
-- Reutiliza a funcao compartilhada update_updated_at_column().
-- ============================================================

DROP TRIGGER IF EXISTS update_atendimento_automatico_sessoes_updated_at
  ON public.atendimento_automatico_sessoes;

CREATE TRIGGER update_atendimento_automatico_sessoes_updated_at
    BEFORE UPDATE ON public.atendimento_automatico_sessoes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_atendimento_automatico_bloqueios_updated_at
  ON public.atendimento_automatico_bloqueios;

CREATE TRIGGER update_atendimento_automatico_bloqueios_updated_at
    BEFORE UPDATE ON public.atendimento_automatico_bloqueios
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
