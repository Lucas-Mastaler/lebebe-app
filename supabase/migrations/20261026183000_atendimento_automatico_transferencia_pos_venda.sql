-- Uma reserva por sessao impede duas transferencias Digisac simultaneas.
-- O trigger impede que um update concorrente apague uma transferencia ja aceita.

CREATE UNIQUE INDEX IF NOT EXISTS idx_atendimento_auto_eventos_transferencia_pos_venda
  ON public.atendimento_automatico_eventos (sessao_id)
  WHERE tipo = 'transferencia_pos_venda';

CREATE OR REPLACE FUNCTION public.preservar_transferencia_pos_venda_aceita()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF OLD.metadata IS NOT NULL
     AND OLD.metadata #>> '{transferencia_pos_venda,status}' = 'aceita'
     AND COALESCE(NEW.metadata #>> '{transferencia_pos_venda,status}', '') IS DISTINCT FROM 'aceita'
  THEN
    NEW.metadata := jsonb_set(
      COALESCE(NEW.metadata, '{}'::jsonb),
      '{transferencia_pos_venda}',
      OLD.metadata -> 'transferencia_pos_venda',
      true
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS preservar_transferencia_pos_venda_aceita
  ON public.atendimento_automatico_sessoes;

CREATE TRIGGER preservar_transferencia_pos_venda_aceita
  BEFORE UPDATE ON public.atendimento_automatico_sessoes
  FOR EACH ROW
  EXECUTE FUNCTION public.preservar_transferencia_pos_venda_aceita();
