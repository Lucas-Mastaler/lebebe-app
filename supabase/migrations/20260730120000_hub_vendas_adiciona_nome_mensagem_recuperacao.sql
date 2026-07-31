-- Hub/Vendas recuperacao: adiciona placeholder [NOME] na mensagem ativa direta.
-- Nao altera automacao, pausas, rodizio, filas, leads ou demais versoes.

WITH novo_texto AS (
  SELECT 'Olá, [NOME]!

Aqui é da Le Bébé [LOJA]. Vimos que você entrou em contato com a nossa Central de Atendimento, mas talvez não tenha conseguido falar diretamente com uma das lojas.

Podemos te ajudar por aqui? Qual produto você está procurando?'::text AS texto
)
UPDATE public.hub_vendas_config AS config
SET
  valor = jsonb_set(
    config.valor,
    '{versoes}',
    (
      SELECT jsonb_agg(
        CASE
          WHEN versao.item->>'id' = 'direta'
            THEN jsonb_set(versao.item, '{texto}', to_jsonb(novo_texto.texto), true)
          ELSE versao.item
        END
        ORDER BY versao.ordem
      )
      FROM jsonb_array_elements(config.valor->'versoes') WITH ORDINALITY AS versao(item, ordem)
      CROSS JOIN novo_texto
    ),
    false
  ),
  updated_at = now()
FROM novo_texto
WHERE config.chave = 'mensagens_recuperacao'
  AND jsonb_typeof(config.valor->'versoes') = 'array'
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements(config.valor->'versoes') AS versao(item)
    WHERE versao.item->>'id' = 'direta'
  )
  AND COALESCE((
    SELECT versao.item->>'texto'
    FROM jsonb_array_elements(config.valor->'versoes') AS versao(item)
    WHERE versao.item->>'id' = 'direta'
    LIMIT 1
  ), '') <> novo_texto.texto;
