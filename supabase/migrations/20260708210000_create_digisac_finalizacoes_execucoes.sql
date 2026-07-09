-- Tabela de rastreabilidade das execucoes de finalizacoes automaticas (cron e manual).
-- Registra inicio, fim, status, totais e detalhes sanitizados de cada execucao.
-- Nao armazena secrets, tokens, senhas ou payloads sensiveis completos.

CREATE TABLE IF NOT EXISTS public.digisac_finalizacoes_execucoes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  origem text NOT NULL CHECK (origem IN ('cron', 'manual')),
  status text NOT NULL CHECK (status IN ('sucesso', 'erro', 'parcial', 'sem_itens', 'em_andamento')),
  iniciado_em timestamptz NOT NULL,
  finalizado_em timestamptz,
  duracao_ms integer,
  total_encontrados integer NOT NULL DEFAULT 0,
  total_elegiveis integer NOT NULL DEFAULT 0,
  total_finalizados integer NOT NULL DEFAULT 0,
  total_ignorados integer NOT NULL DEFAULT 0,
  total_erros integer NOT NULL DEFAULT 0,
  mensagem text,
  erro text,
  detalhes jsonb,
  request_id text
);

ALTER TABLE public.digisac_finalizacoes_execucoes ENABLE ROW LEVEL SECURITY;

-- Apenas service_role tem acesso (usado pelo backend Next.js via createServiceClient)
CREATE POLICY "service_role_all" ON public.digisac_finalizacoes_execucoes
  FOR ALL TO service_role USING (true) WITH CHECK (true);
