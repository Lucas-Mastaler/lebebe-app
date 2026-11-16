ALTER TABLE public.recebimentos
  DROP CONSTRAINT recebimentos_correcao_manual_consistente,
  ADD CONSTRAINT recebimentos_correcao_manual_consistente CHECK (
    (tempo_correcao_manual = false AND tempo_manual_inicio IS NULL AND tempo_manual_fim IS NULL)
    OR
    (
      tempo_correcao_manual = true
      AND (
        (tempo_manual_inicio IS NULL AND tempo_manual_fim IS NULL)
        OR
        (
          tempo_manual_inicio IS NOT NULL
          AND tempo_manual_fim IS NOT NULL
          AND tempo_manual_fim > tempo_manual_inicio
        )
      )
    )
  );

