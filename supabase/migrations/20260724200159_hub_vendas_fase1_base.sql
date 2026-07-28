-- Hub/Vendas recuperacao - Fase 1: banco, permissoes e base estrutural.
-- Nao cria webhook, cron, tela, rota de API ou envio de mensagens.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN (
          'hub_vendas_leads',
          'hub_vendas_recuperacao_fila',
          'hub_vendas_config',
          'hub_vendas_eventos_processados'
        )
  ) THEN
    RAISE EXCEPTION 'hub_vendas_schema_parcial_existente';
  END IF;
END;
$$;

CREATE TABLE public.hub_vendas_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  telefone_normalizado_ddi text NOT NULL,
  telefone_normalizado text NOT NULL,
  ciclo_numero integer NOT NULL,
  data_entrada_hub timestamptz NOT NULL,
  digisac_message_id_saudacao text,
  digisac_contact_id_hub text,
  digisac_ticket_id_hub text,
  nome_contato_hub text,
  status text NOT NULL DEFAULT 'aguardando_conversao',
  loja_principal text,
  lojas_chamadas text[] NOT NULL DEFAULT '{}'::text[],
  chamou_mais_de_uma_loja boolean NOT NULL DEFAULT false,
  data_conversao timestamptz,
  data_cliente_em_atendimento timestamptz,
  motivo_bloqueio_recuperacao text,
  conexao_recuperacao_id text,
  data_recuperacao_enviada timestamptz,
  data_recuperacao_respondida timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT hub_vendas_leads_telefone_ddi_check
    CHECK (telefone_normalizado_ddi ~ '^55[0-9]{10,11}$'),
  CONSTRAINT hub_vendas_leads_telefone_check
    CHECK (
      telefone_normalizado ~ '^[0-9]{10,11}$'
      AND telefone_normalizado_ddi = ('55' || telefone_normalizado)
    ),
  CONSTRAINT hub_vendas_leads_ciclo_check
    CHECK (ciclo_numero > 0),
  CONSTRAINT hub_vendas_leads_status_check
    CHECK (status IN (
      'aguardando_conversao',
      'convertido_organicamente',
      'cliente_em_atendimento',
      'encaminhado_recuperacao',
      'recuperacao_enviada',
      'recuperado',
      'fila_manual',
      'encerrado'
    )),
  CONSTRAINT hub_vendas_leads_loja_principal_check
    CHECK (loja_principal IS NULL OR loja_principal IN ('portao', 'bigorrilho', 'hauer_marechal')),
  CONSTRAINT hub_vendas_leads_lojas_chamadas_check
    CHECK (
      lojas_chamadas <@ ARRAY['portao', 'bigorrilho', 'hauer_marechal']::text[]
    ),
  CONSTRAINT hub_vendas_leads_mais_de_uma_loja_check
    CHECK (chamou_mais_de_uma_loja = (cardinality(lojas_chamadas) > 1)),
  CONSTRAINT hub_vendas_leads_conexao_recuperacao_check
    CHECK (
      conexao_recuperacao_id IS NULL
      OR conexao_recuperacao_id IN (
        'c60d720f-5ad5-4a1b-bedb-e51495dee686',
        '0973f84b-8294-4615-9657-ba95b6346246',
        '1352c41b-80a9-4e74-b9d9-4c5e7aed060e'
      )
    ),
  CONSTRAINT hub_vendas_leads_telefone_ciclo_unique
    UNIQUE (telefone_normalizado_ddi, ciclo_numero)
);

CREATE INDEX idx_hub_vendas_leads_status_entrada
  ON public.hub_vendas_leads (status, data_entrada_hub);

CREATE INDEX idx_hub_vendas_leads_telefone_ddi
  ON public.hub_vendas_leads (telefone_normalizado_ddi);

CREATE INDEX idx_hub_vendas_leads_contact_hub
  ON public.hub_vendas_leads (digisac_contact_id_hub)
  WHERE digisac_contact_id_hub IS NOT NULL;

CREATE INDEX idx_hub_vendas_leads_ticket_hub
  ON public.hub_vendas_leads (digisac_ticket_id_hub)
  WHERE digisac_ticket_id_hub IS NOT NULL;

CREATE INDEX idx_hub_vendas_leads_conversao
  ON public.hub_vendas_leads (data_conversao)
  WHERE data_conversao IS NOT NULL;

CREATE TABLE public.hub_vendas_recuperacao_fila (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.hub_vendas_leads(id) ON DELETE CASCADE,
  conexao_destino_id text NOT NULL,
  conexao_destino_nome text,
  status text NOT NULL DEFAULT 'agendado',
  programado_para timestamptz NOT NULL,
  reservado_em timestamptz,
  reservado_por text,
  requisicao_iniciada_em timestamptz,
  requisicao_finalizada_em timestamptz,
  enviado_em timestamptz,
  resultado text,
  erro text,
  categoria_erro text,
  motivo_cancelamento text,
  versao_mensagem integer,
  texto_enviado text,
  hash_texto_enviado text,
  digisac_message_id text,
  digisac_contact_id text,
  digisac_ticket_id text,
  ultima_reconciliacao_em timestamptz,
  quantidade_reconciliacoes integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT hub_vendas_fila_lead_unique UNIQUE (lead_id),
  CONSTRAINT hub_vendas_fila_status_check
    CHECK (status IN (
      'agendado',
      'reservado',
      'enviando',
      'enviado',
      'erro',
      'resultado_incerto',
      'cancelado',
      'expirado',
      'analise_manual'
    )),
  CONSTRAINT hub_vendas_fila_conexao_destino_check
    CHECK (conexao_destino_id IN (
      'c60d720f-5ad5-4a1b-bedb-e51495dee686',
      '0973f84b-8294-4615-9657-ba95b6346246',
      '1352c41b-80a9-4e74-b9d9-4c5e7aed060e'
    )),
  CONSTRAINT hub_vendas_fila_quantidade_reconciliacoes_check
    CHECK (quantidade_reconciliacoes >= 0),
  CONSTRAINT hub_vendas_fila_versao_mensagem_check
    CHECK (versao_mensagem IS NULL OR versao_mensagem BETWEEN 1 AND 5),
  CONSTRAINT hub_vendas_fila_hash_texto_check
    CHECK (hash_texto_enviado IS NULL OR hash_texto_enviado ~ '^[a-f0-9]{64}$')
);

CREATE INDEX idx_hub_vendas_fila_status_programado
  ON public.hub_vendas_recuperacao_fila (status, programado_para);

CREATE INDEX idx_hub_vendas_fila_reservado_em
  ON public.hub_vendas_recuperacao_fila (reservado_em)
  WHERE reservado_em IS NOT NULL;

CREATE INDEX idx_hub_vendas_fila_conexao_enviado
  ON public.hub_vendas_recuperacao_fila (conexao_destino_id, enviado_em);

CREATE INDEX idx_hub_vendas_fila_lead
  ON public.hub_vendas_recuperacao_fila (lead_id);

CREATE INDEX idx_hub_vendas_fila_contact
  ON public.hub_vendas_recuperacao_fila (digisac_contact_id)
  WHERE digisac_contact_id IS NOT NULL;

CREATE INDEX idx_hub_vendas_fila_ticket
  ON public.hub_vendas_recuperacao_fila (digisac_ticket_id)
  WHERE digisac_ticket_id IS NOT NULL;

CREATE TABLE public.hub_vendas_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chave text NOT NULL UNIQUE,
  valor jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT hub_vendas_config_chave_check
    CHECK (chave IN (
      'automacao',
      'parametros',
      'pausas_conexoes',
      'rodizio',
      'mensagens_recuperacao'
    )),
  CONSTRAINT hub_vendas_config_valor_object_check
    CHECK (jsonb_typeof(valor) = 'object')
);

CREATE TABLE public.hub_vendas_eventos_processados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  digisac_message_id text NOT NULL,
  event text NOT NULL,
  service_id text,
  contact_id text,
  ticket_id text,
  tipo_processamento text NOT NULL,
  lead_id uuid REFERENCES public.hub_vendas_leads(id) ON DELETE SET NULL,
  timestamp_evento timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'processando',
  tentativas integer NOT NULL DEFAULT 0,
  erro text,
  resultado jsonb NOT NULL DEFAULT '{}'::jsonb,
  reservado_em timestamptz NOT NULL DEFAULT now(),
  processado_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT hub_vendas_eventos_message_unique UNIQUE (digisac_message_id),
  CONSTRAINT hub_vendas_eventos_status_check
    CHECK (status IN ('processando', 'processado', 'ignorado', 'erro')),
  CONSTRAINT hub_vendas_eventos_tentativas_check
    CHECK (tentativas >= 0),
  CONSTRAINT hub_vendas_eventos_resultado_object_check
    CHECK (jsonb_typeof(resultado) = 'object')
);

CREATE INDEX idx_hub_vendas_eventos_status_reservado
  ON public.hub_vendas_eventos_processados (status, reservado_em);

CREATE INDEX idx_hub_vendas_eventos_lead
  ON public.hub_vendas_eventos_processados (lead_id)
  WHERE lead_id IS NOT NULL;

CREATE INDEX idx_hub_vendas_eventos_timestamp
  ON public.hub_vendas_eventos_processados (timestamp_evento);

CREATE INDEX idx_hub_vendas_eventos_service
  ON public.hub_vendas_eventos_processados (service_id)
  WHERE service_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.hub_vendas_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_hub_vendas_leads_touch
  BEFORE UPDATE ON public.hub_vendas_leads
  FOR EACH ROW
  EXECUTE FUNCTION public.hub_vendas_touch_updated_at();

CREATE TRIGGER trg_hub_vendas_fila_touch
  BEFORE UPDATE ON public.hub_vendas_recuperacao_fila
  FOR EACH ROW
  EXECUTE FUNCTION public.hub_vendas_touch_updated_at();

CREATE TRIGGER trg_hub_vendas_config_touch
  BEFORE UPDATE ON public.hub_vendas_config
  FOR EACH ROW
  EXECUTE FUNCTION public.hub_vendas_touch_updated_at();

CREATE TRIGGER trg_hub_vendas_eventos_touch
  BEFORE UPDATE ON public.hub_vendas_eventos_processados
  FOR EACH ROW
  EXECUTE FUNCTION public.hub_vendas_touch_updated_at();

ALTER TABLE public.hub_vendas_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hub_vendas_recuperacao_fila ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hub_vendas_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hub_vendas_eventos_processados ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.hub_vendas_leads FROM anon, authenticated;
REVOKE ALL ON public.hub_vendas_recuperacao_fila FROM anon, authenticated;
REVOKE ALL ON public.hub_vendas_config FROM anon, authenticated;
REVOKE ALL ON public.hub_vendas_eventos_processados FROM anon, authenticated;

GRANT ALL ON public.hub_vendas_leads TO service_role;
GRANT ALL ON public.hub_vendas_recuperacao_fila TO service_role;
GRANT ALL ON public.hub_vendas_config TO service_role;
GRANT ALL ON public.hub_vendas_eventos_processados TO service_role;

INSERT INTO public.hub_vendas_config (chave, valor)
VALUES
  (
    'automacao',
    jsonb_build_object(
      'ativa', false,
      'pausada', true,
      'motivo', 'Fase 1: base estrutural criada sem ativar envios',
      'pausado_em', now()
    )
  ),
  (
    'parametros',
    '{
      "limite_diario": 15,
      "intervalo_min_seg": 180,
      "intervalo_max_seg": 300,
      "horario_inicio": "09:00",
      "horario_fim": "18:00",
      "timezone": "America/Sao_Paulo",
      "dias_semana": [1, 2, 3, 4, 5, 6],
      "janela_conversao_horas": 24,
      "elegibilidade_horas": 48,
      "ciclo_dias": 14,
      "retencao_eventos_dias": 90,
      "pausa_automatica_erros": 3
    }'::jsonb
  ),
  (
    'pausas_conexoes',
    '{
      "c60d720f-5ad5-4a1b-bedb-e51495dee686": {"nome": "Portao", "pausada": false, "erros_consecutivos": 0},
      "0973f84b-8294-4615-9657-ba95b6346246": {"nome": "Bigorrilho", "pausada": false, "erros_consecutivos": 0},
      "1352c41b-80a9-4e74-b9d9-4c5e7aed060e": {"nome": "Hauer/Marechal", "pausada": false, "erros_consecutivos": 0}
    }'::jsonb
  ),
  (
    'rodizio',
    '{
      "ultima_posicao": null,
      "ultima_conexao_id": null,
      "ordem": [
        "c60d720f-5ad5-4a1b-bedb-e51495dee686",
        "0973f84b-8294-4615-9657-ba95b6346246",
        "1352c41b-80a9-4e74-b9d9-4c5e7aed060e"
      ]
    }'::jsonb
  ),
  (
    'mensagens_recuperacao',
    '{
      "versoes": [
        {
          "id": "direta",
          "nome": "Direta",
          "ordem": 1,
          "ativa": false,
          "texto": "Olá! Aqui é da Le Bébé [LOJA]. Vimos que você entrou em contato com a nossa Central de Atendimento, mas talvez não tenha conseguido falar diretamente com uma das lojas.\n\nPodemos te ajudar por aqui? Qual produto você está procurando?"
        },
        {
          "id": "acolhedora",
          "nome": "Acolhedora",
          "ordem": 2,
          "ativa": false,
          "texto": "Olá! Tudo bem? Aqui é da Le Bébé [LOJA].\n\nRecebemos seu contato pela nossa Central e estamos passando para saber se você conseguiu encontrar o atendimento que precisava.\n\nComo podemos ajudar você hoje?"
        },
        {
          "id": "consultiva",
          "nome": "Consultiva",
          "ordem": 3,
          "ativa": false,
          "texto": "Olá! Aqui é da Le Bébé [LOJA].\n\nVimos seu contato com a nossa Central de Atendimento e gostaríamos de ajudar na sua procura.\n\nVocê está buscando algum produto específico para o bebê ou ainda está conhecendo as opções?"
        },
        {
          "id": "objetiva",
          "nome": "Objetiva",
          "ordem": 4,
          "ativa": false,
          "texto": "Olá! Aqui é da Le Bébé [LOJA].\n\nVocê entrou em contato com a nossa Central de Atendimento e estamos disponíveis para continuar seu atendimento por aqui.\n\nQual produto ou informação você precisa?"
        },
        {
          "id": "leve",
          "nome": "Leve",
          "ordem": 5,
          "ativa": false,
          "texto": "Oi! Tudo bem? Aqui é da Le Bébé [LOJA].\n\nVimos que você passou pela nossa Central e resolvemos chamar para facilitar seu atendimento.\n\nJá sabe o que está procurando ou gostaria de conhecer algumas opções?"
        }
      ]
    }'::jsonb
  )
ON CONFLICT (chave) DO UPDATE
SET
  valor = EXCLUDED.valor,
  updated_at = now();

CREATE OR REPLACE FUNCTION public.selecionar_proxima_conexao_hub_vendas(
  p_conexoes_elegiveis text[]
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  -- Chave de advisory lock do namespace Hub/Vendas recuperacao.
  v_lock_key_1 integer := 20260724;
  v_lock_key_2 integer := 1001;
  v_ordem text[] := ARRAY[
    'c60d720f-5ad5-4a1b-bedb-e51495dee686',
    '0973f84b-8294-4615-9657-ba95b6346246',
    '1352c41b-80a9-4e74-b9d9-4c5e7aed060e'
  ];
  v_posicao_atual integer;
  v_posicao_candidata integer;
  v_conexao_candidata text;
  v_total integer := 3;
  v_offset integer;
BEGIN
  IF p_conexoes_elegiveis IS NULL OR cardinality(p_conexoes_elegiveis) = 0 THEN
    RETURN NULL;
  END IF;

  PERFORM pg_advisory_xact_lock(v_lock_key_1, v_lock_key_2);

  SELECT (valor->>'ultima_posicao')::integer
    INTO v_posicao_atual
    FROM public.hub_vendas_config
    WHERE chave = 'rodizio'
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'hub_vendas_config_rodizio_ausente' USING ERRCODE = 'P0002';
  END IF;

  FOR v_offset IN 1..v_total LOOP
    v_posicao_candidata := (COALESCE(v_posicao_atual, -1) + v_offset) % v_total;
    v_conexao_candidata := v_ordem[v_posicao_candidata + 1];

    IF v_conexao_candidata = ANY (p_conexoes_elegiveis) THEN
      UPDATE public.hub_vendas_config
        SET valor = jsonb_set(
              jsonb_set(valor, '{ultima_posicao}', to_jsonb(v_posicao_candidata), true),
              '{ultima_conexao_id}',
              to_jsonb(v_conexao_candidata),
              true
            ),
            updated_at = now()
        WHERE chave = 'rodizio';

      RETURN v_conexao_candidata;
    END IF;
  END LOOP;

  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.selecionar_proxima_conexao_hub_vendas(text[])
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.selecionar_proxima_conexao_hub_vendas(text[])
  TO service_role;

INSERT INTO public.app_modulos (
  chave,
  nome,
  descricao,
  rota_base,
  categoria,
  publico,
  somente_superadmin,
  ativo,
  ordem
)
VALUES (
  'hub_vendas_recuperacao',
  'HUB VENDAS RECUPERACAO',
  'Recuperacao automatica de leads do Hub/Vendas',
  '/hub-vendas/recuperacao',
  'digisac',
  false,
  false,
  true,
  65
)
ON CONFLICT (chave) DO UPDATE
SET
  nome = EXCLUDED.nome,
  descricao = EXCLUDED.descricao,
  rota_base = EXCLUDED.rota_base,
  categoria = EXCLUDED.categoria,
  publico = EXCLUDED.publico,
  somente_superadmin = EXCLUDED.somente_superadmin,
  ativo = EXCLUDED.ativo,
  ordem = EXCLUDED.ordem,
  updated_at = now();

INSERT INTO public.digisac_conexoes_automacao (
  service_id,
  service_name,
  my_number,
  default_department_id,
  ativo
)
VALUES (
  '4af28025-c210-4336-a560-785d2fb8a778',
  'VENDAS (Hub)',
  NULL,
  NULL,
  true
)
ON CONFLICT (service_id) DO UPDATE
SET
  service_name = EXCLUDED.service_name,
  ativo = EXCLUDED.ativo,
  updated_at = now();
