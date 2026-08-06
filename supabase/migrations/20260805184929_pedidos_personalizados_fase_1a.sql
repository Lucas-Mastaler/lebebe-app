-- Pedidos Personalizados - Fase 1A.
-- Modulos ocultos da navegacao, estrutura relacional e catalogos iniciais.
-- Nao cria paginas, APIs, RPCs, Storage ou regras de calculo.

DO $$
DECLARE
  v_tabelas_existentes text[];
BEGIN
  SELECT array_agg(table_name ORDER BY table_name)
    INTO v_tabelas_existentes
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_name IN (
      'pedidos_personalizados_fornecedores',
      'pedidos_personalizados_produtos',
      'pedidos_personalizados_pedidos',
      'pedidos_personalizados_moriah_tapetes',
      'pedidos_personalizados_cores',
      'pedidos_personalizados_tapete_cores'
    );

  IF v_tabelas_existentes IS NOT NULL THEN
    RAISE EXCEPTION
      'pedidos_personalizados_schema_existente: %',
      array_to_string(v_tabelas_existentes, ', ');
  END IF;

  IF to_regclass('public.app_modulos') IS NULL
     OR to_regclass('public.app_unidades') IS NULL
     OR to_regclass('public.usuarios_permitidos') IS NULL THEN
    RAISE EXCEPTION 'pedidos_personalizados_dependencias_ausentes';
  END IF;

  IF (
    SELECT count(*)
    FROM public.app_unidades
    WHERE chave IN ('bigorrilho', 'portao', 'marechal', 'feira')
      AND ativo = true
  ) <> 4 THEN
    RAISE EXCEPTION 'pedidos_personalizados_unidades_obrigatorias_ausentes_ou_inativas';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.app_modulos
    WHERE chave = 'pedidos_personalizados_novo'
      AND (
        nome IS DISTINCT FROM 'NOVO PEDIDO PERSONALIZADO'
        OR rota_base IS DISTINCT FROM '/pedidos-personalizados/novo'
        OR categoria IS DISTINCT FROM 'pedidos_personalizados'
        OR publico IS DISTINCT FROM false
        OR somente_superadmin IS DISTINCT FROM false
        OR ativo IS DISTINCT FROM true
        OR ordem IS DISTINCT FROM 66
      )
  ) OR EXISTS (
    SELECT 1
    FROM public.app_modulos
    WHERE chave = 'pedidos_personalizados_gestao'
      AND (
        nome IS DISTINCT FROM 'PEDIDOS PERSONALIZADOS'
        OR rota_base IS DISTINCT FROM '/pedidos-personalizados'
        OR categoria IS DISTINCT FROM 'pedidos_personalizados'
        OR publico IS DISTINCT FROM false
        OR somente_superadmin IS DISTINCT FROM false
        OR ativo IS DISTINCT FROM true
        OR ordem IS DISTINCT FROM 67
      )
  ) THEN
    RAISE EXCEPTION 'pedidos_personalizados_modulo_existente_incompativel';
  END IF;
END;
$$;

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
VALUES
  (
    'pedidos_personalizados_novo',
    'NOVO PEDIDO PERSONALIZADO',
    'Cadastro de pedidos personalizados',
    '/pedidos-personalizados/novo',
    'pedidos_personalizados',
    false,
    false,
    true,
    66
  ),
  (
    'pedidos_personalizados_gestao',
    'PEDIDOS PERSONALIZADOS',
    'Gestao de pedidos personalizados',
    '/pedidos-personalizados',
    'pedidos_personalizados',
    false,
    false,
    true,
    67
  )
ON CONFLICT (chave) DO NOTHING;

CREATE TABLE public.pedidos_personalizados_fornecedores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chave text NOT NULL,
  nome text NOT NULL,
  disponivel boolean NOT NULL DEFAULT false,
  ordem integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pedidos_personalizados_fornecedores_chave_unique UNIQUE (chave),
  CONSTRAINT pedidos_personalizados_fornecedores_nome_unique UNIQUE (nome),
  CONSTRAINT pedidos_personalizados_fornecedores_ordem_unique UNIQUE (ordem),
  CONSTRAINT pedidos_personalizados_fornecedores_chave_check
    CHECK (chave ~ '^[a-z0-9_]{2,50}$'),
  CONSTRAINT pedidos_personalizados_fornecedores_nome_check
    CHECK (
      nome = btrim(nome)
      AND char_length(nome) BETWEEN 2 AND 80
    ),
  CONSTRAINT pedidos_personalizados_fornecedores_ordem_check
    CHECK (ordem >= 1)
);

CREATE TABLE public.pedidos_personalizados_produtos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fornecedor_id uuid NOT NULL
    REFERENCES public.pedidos_personalizados_fornecedores(id) ON DELETE RESTRICT,
  codigo text NOT NULL,
  descricao text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  ordem integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pedidos_personalizados_produtos_fornecedor_codigo_unique
    UNIQUE (fornecedor_id, codigo),
  CONSTRAINT pedidos_personalizados_produtos_fornecedor_ordem_unique
    UNIQUE (fornecedor_id, ordem),
  CONSTRAINT pedidos_personalizados_produtos_codigo_check
    CHECK (
      codigo = btrim(codigo)
      AND char_length(codigo) BETWEEN 1 AND 40
    ),
  CONSTRAINT pedidos_personalizados_produtos_descricao_check
    CHECK (
      descricao = btrim(descricao)
      AND char_length(descricao) BETWEEN 1 AND 300
    ),
  CONSTRAINT pedidos_personalizados_produtos_ordem_check
    CHECK (ordem >= 1)
);

CREATE TABLE public.pedidos_personalizados_pedidos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fornecedor_id uuid NOT NULL
    REFERENCES public.pedidos_personalizados_fornecedores(id) ON DELETE RESTRICT,
  unidade_id uuid NOT NULL
    REFERENCES public.app_unidades(id) ON DELETE RESTRICT,
  consultora text NOT NULL,
  cliente text NOT NULL,
  numero_lancamento text,
  data_entrega date,
  data_pedido_fornecedor date,
  numero_pedido_compra text,
  comprador text,
  status text NOT NULL DEFAULT 'CADASTRADO',
  version integer NOT NULL DEFAULT 1,
  created_by uuid NOT NULL
    REFERENCES public.usuarios_permitidos(id) ON DELETE RESTRICT,
  updated_by uuid NOT NULL
    REFERENCES public.usuarios_permitidos(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pedidos_personalizados_pedidos_consultora_check
    CHECK (char_length(btrim(consultora)) BETWEEN 2 AND 20),
  CONSTRAINT pedidos_personalizados_pedidos_cliente_check
    CHECK (char_length(btrim(cliente)) BETWEEN 1 AND 40),
  CONSTRAINT pedidos_personalizados_pedidos_numero_lancamento_check
    CHECK (
      numero_lancamento IS NULL
      OR numero_lancamento ~ '^[0-9]{1,20}$'
    ),
  CONSTRAINT pedidos_personalizados_pedidos_numero_pedido_compra_check
    CHECK (
      numero_pedido_compra IS NULL
      OR numero_pedido_compra ~ '^[0-9]{1,20}$'
    ),
  CONSTRAINT pedidos_personalizados_pedidos_comprador_check
    CHECK (
      comprador IS NULL
      OR char_length(btrim(comprador)) BETWEEN 2 AND 40
    ),
  CONSTRAINT pedidos_personalizados_pedidos_status_check
    CHECK (status IN (
      'CADASTRADO',
      'AGUARDANDO LAYOUT',
      U&'AGUARDANDO APROVA\00C7\00C3O DO CLIENTE',
      U&'EM PRODU\00C7\00C3O',
      'RECEBIDO'
    )),
  CONSTRAINT pedidos_personalizados_pedidos_version_check
    CHECK (version >= 1)
);

CREATE TABLE public.pedidos_personalizados_moriah_tapetes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id uuid NOT NULL
    REFERENCES public.pedidos_personalizados_pedidos(id) ON DELETE CASCADE,
  ordem integer NOT NULL,
  formato text NOT NULL,
  dimensao_1_cm integer NOT NULL,
  dimensao_2_cm integer,
  area_cobrada_centesimos_m2 integer NOT NULL,
  produto_id uuid NOT NULL
    REFERENCES public.pedidos_personalizados_produtos(id) ON DELETE RESTRICT,
  nome_colecao_catalogo text,
  referencia_catalogo text,
  observacoes text,
  teve_alteracao_layout boolean NOT NULL DEFAULT false,
  quantidade_alteracoes_layout integer,
  created_by uuid NOT NULL
    REFERENCES public.usuarios_permitidos(id) ON DELETE RESTRICT,
  updated_by uuid NOT NULL
    REFERENCES public.usuarios_permitidos(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pedidos_personalizados_moriah_tapetes_pedido_ordem_unique
    UNIQUE (pedido_id, ordem),
  CONSTRAINT pedidos_personalizados_moriah_tapetes_ordem_check
    CHECK (ordem BETWEEN 1 AND 10),
  CONSTRAINT pedidos_personalizados_moriah_tapetes_formato_check
    CHECK (formato IN ('REDONDO', 'RETANGULAR', 'ORGANICO')),
  CONSTRAINT pedidos_personalizados_moriah_tapetes_dimensao_1_check
    CHECK (dimensao_1_cm BETWEEN 10 AND 1500),
  CONSTRAINT pedidos_personalizados_moriah_tapetes_dimensao_2_check
    CHECK (dimensao_2_cm IS NULL OR dimensao_2_cm BETWEEN 10 AND 1500),
  CONSTRAINT pedidos_personalizados_moriah_tapetes_dimensoes_formato_check
    CHECK (
      (formato = 'REDONDO' AND dimensao_2_cm IS NULL)
      OR (
        formato IN ('RETANGULAR', 'ORGANICO')
        AND dimensao_2_cm IS NOT NULL
      )
    ),
  CONSTRAINT pedidos_personalizados_moriah_tapetes_area_check
    CHECK (area_cobrada_centesimos_m2 BETWEEN 1 AND 22500),
  CONSTRAINT pedidos_personalizados_moriah_tapetes_colecao_check
    CHECK (
      nome_colecao_catalogo IS NULL
      OR char_length(btrim(nome_colecao_catalogo)) BETWEEN 1 AND 80
    ),
  CONSTRAINT pedidos_personalizados_moriah_tapetes_referencia_check
    CHECK (
      referencia_catalogo IS NULL
      OR referencia_catalogo ~ '^[A-Za-z0-9-]{1,40}$'
    ),
  CONSTRAINT pedidos_personalizados_moriah_tapetes_observacoes_check
    CHECK (observacoes IS NULL OR char_length(observacoes) <= 500),
  CONSTRAINT pedidos_personalizados_moriah_tapetes_layout_check
    CHECK (
      (
        teve_alteracao_layout = false
        AND quantidade_alteracoes_layout IS NULL
      )
      OR (
        teve_alteracao_layout = true
        AND quantidade_alteracoes_layout >= 1
      )
    )
);

CREATE TABLE public.pedidos_personalizados_cores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fornecedor_id uuid NOT NULL
    REFERENCES public.pedidos_personalizados_fornecedores(id) ON DELETE RESTRICT,
  numero text NOT NULL,
  codigo text NOT NULL,
  nome text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  ordem integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pedidos_personalizados_cores_fornecedor_numero_unique
    UNIQUE (fornecedor_id, numero),
  CONSTRAINT pedidos_personalizados_cores_fornecedor_codigo_unique
    UNIQUE (fornecedor_id, codigo),
  CONSTRAINT pedidos_personalizados_cores_fornecedor_ordem_unique
    UNIQUE (fornecedor_id, ordem),
  CONSTRAINT pedidos_personalizados_cores_numero_check
    CHECK (numero ~ '^[0-9]{1,10}$'),
  CONSTRAINT pedidos_personalizados_cores_codigo_check
    CHECK (codigo ~ '^[A-Za-z0-9-]{1,40}$'),
  CONSTRAINT pedidos_personalizados_cores_nome_check
    CHECK (
      nome = btrim(nome)
      AND char_length(nome) BETWEEN 1 AND 80
    ),
  CONSTRAINT pedidos_personalizados_cores_ordem_check
    CHECK (ordem >= 1)
);

CREATE TABLE public.pedidos_personalizados_tapete_cores (
  tapete_id uuid NOT NULL
    REFERENCES public.pedidos_personalizados_moriah_tapetes(id) ON DELETE CASCADE,
  cor_id uuid NOT NULL
    REFERENCES public.pedidos_personalizados_cores(id) ON DELETE RESTRICT,
  ordem integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pedidos_personalizados_tapete_cores_pkey
    PRIMARY KEY (tapete_id, cor_id),
  CONSTRAINT pedidos_personalizados_tapete_cores_tapete_ordem_unique
    UNIQUE (tapete_id, ordem),
  CONSTRAINT pedidos_personalizados_tapete_cores_ordem_check
    CHECK (ordem BETWEEN 1 AND 8)
);

CREATE INDEX idx_pedidos_personalizados_pedidos_fornecedor
  ON public.pedidos_personalizados_pedidos (fornecedor_id);

CREATE INDEX idx_pedidos_personalizados_pedidos_unidade_created_at
  ON public.pedidos_personalizados_pedidos (unidade_id, created_at DESC);

CREATE INDEX idx_pedidos_personalizados_pedidos_status_created_at
  ON public.pedidos_personalizados_pedidos (status, created_at DESC);

CREATE INDEX idx_pedidos_personalizados_pedidos_numero_lancamento
  ON public.pedidos_personalizados_pedidos (numero_lancamento)
  WHERE numero_lancamento IS NOT NULL;

CREATE INDEX idx_pedidos_personalizados_pedidos_numero_pedido_compra
  ON public.pedidos_personalizados_pedidos (numero_pedido_compra)
  WHERE numero_pedido_compra IS NOT NULL;

CREATE INDEX idx_pedidos_personalizados_pedidos_created_by
  ON public.pedidos_personalizados_pedidos (created_by);

CREATE INDEX idx_pedidos_personalizados_pedidos_updated_by
  ON public.pedidos_personalizados_pedidos (updated_by);

CREATE INDEX idx_pedidos_personalizados_moriah_tapetes_produto
  ON public.pedidos_personalizados_moriah_tapetes (produto_id);

CREATE INDEX idx_pedidos_personalizados_moriah_tapetes_created_by
  ON public.pedidos_personalizados_moriah_tapetes (created_by);

CREATE INDEX idx_pedidos_personalizados_moriah_tapetes_updated_by
  ON public.pedidos_personalizados_moriah_tapetes (updated_by);

CREATE INDEX idx_pedidos_personalizados_tapete_cores_cor
  ON public.pedidos_personalizados_tapete_cores (cor_id);

CREATE FUNCTION public.pedidos_personalizados_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.pedidos_personalizados_touch_updated_at()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pedidos_personalizados_touch_updated_at()
  TO service_role;

CREATE TRIGGER trg_pedidos_personalizados_fornecedores_touch
  BEFORE UPDATE ON public.pedidos_personalizados_fornecedores
  FOR EACH ROW
  EXECUTE FUNCTION public.pedidos_personalizados_touch_updated_at();

CREATE TRIGGER trg_pedidos_personalizados_produtos_touch
  BEFORE UPDATE ON public.pedidos_personalizados_produtos
  FOR EACH ROW
  EXECUTE FUNCTION public.pedidos_personalizados_touch_updated_at();

CREATE TRIGGER trg_pedidos_personalizados_pedidos_touch
  BEFORE UPDATE ON public.pedidos_personalizados_pedidos
  FOR EACH ROW
  EXECUTE FUNCTION public.pedidos_personalizados_touch_updated_at();

CREATE TRIGGER trg_pedidos_personalizados_moriah_tapetes_touch
  BEFORE UPDATE ON public.pedidos_personalizados_moriah_tapetes
  FOR EACH ROW
  EXECUTE FUNCTION public.pedidos_personalizados_touch_updated_at();

CREATE TRIGGER trg_pedidos_personalizados_cores_touch
  BEFORE UPDATE ON public.pedidos_personalizados_cores
  FOR EACH ROW
  EXECUTE FUNCTION public.pedidos_personalizados_touch_updated_at();

ALTER TABLE public.pedidos_personalizados_fornecedores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pedidos_personalizados_produtos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pedidos_personalizados_pedidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pedidos_personalizados_moriah_tapetes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pedidos_personalizados_cores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pedidos_personalizados_tapete_cores ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.pedidos_personalizados_fornecedores
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.pedidos_personalizados_produtos
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.pedidos_personalizados_pedidos
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.pedidos_personalizados_moriah_tapetes
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.pedidos_personalizados_cores
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.pedidos_personalizados_tapete_cores
  FROM PUBLIC, anon, authenticated;

GRANT ALL ON TABLE public.pedidos_personalizados_fornecedores TO service_role;
GRANT ALL ON TABLE public.pedidos_personalizados_produtos TO service_role;
GRANT ALL ON TABLE public.pedidos_personalizados_pedidos TO service_role;
GRANT ALL ON TABLE public.pedidos_personalizados_moriah_tapetes TO service_role;
GRANT ALL ON TABLE public.pedidos_personalizados_cores TO service_role;
GRANT ALL ON TABLE public.pedidos_personalizados_tapete_cores TO service_role;

INSERT INTO public.pedidos_personalizados_fornecedores (
  chave,
  nome,
  disponivel,
  ordem
)
VALUES
  ('moriah_tapetes', 'MORIAH TAPETES', true, 1),
  ('decorisi', 'DECORISI', false, 2),
  ('lebebe_exclusive', 'LEBEBE EXCLUSIVE', false, 3);

INSERT INTO public.pedidos_personalizados_produtos (
  fornecedor_id,
  codigo,
  descricao,
  ativo,
  ordem
)
SELECT
  fornecedor.id,
  produto.codigo,
  produto.descricao,
  true,
  produto.ordem
FROM public.pedidos_personalizados_fornecedores AS fornecedor
CROSS JOIN (
  VALUES
    (
      '21157'::text,
      U&'TAPETE PERSONALIZADO MORIAH M\00B2 (UMA MEDIDA PADR\00C3O at\00E9 1,95 OU 0,95 CM)'::text,
      1
    ),
    (
      '21158'::text,
      U&'TAPETE PERSONALIZADO MORIAH ESPECIAL M\00B2 (SEM EMENDA)'::text,
      2
    ),
    (
      '21159'::text,
      U&'TAPETE PERSONALIZADO MORIAH ESPECIAL M\00B2 (2 MEDIDAS ACIMA DE 2M COM EMENDA)'::text,
      3
    )
) AS produto(codigo, descricao, ordem)
WHERE fornecedor.chave = 'moriah_tapetes';

INSERT INTO public.pedidos_personalizados_cores (
  fornecedor_id,
  numero,
  codigo,
  nome,
  ativo,
  ordem
)
SELECT
  fornecedor.id,
  cor.numero,
  cor.codigo,
  cor.nome,
  true,
  cor.ordem
FROM public.pedidos_personalizados_fornecedores AS fornecedor
CROSS JOIN (
  VALUES
    ('01'::text, '14-4500'::text, 'Gelo'::text, 1),
    ('02'::text, '13-0908'::text, 'Bege'::text, 2),
    ('03'::text, '13-4411'::text, U&'Azul Beb\00EA'::text, 3),
    ('04'::text, '13-0116'::text, U&'Verde Beb\00EA'::text, 4),
    ('05'::text, '12-0736'::text, 'Sunshine'::text, 5),
    ('06'::text, '12-1008'::text, U&'Rosa Beb\00EA'::text, 6),
    ('07'::text, 'K-07'::text, 'Branco'::text, 7),
    ('08'::text, 'K-17'::text, 'Cimento'::text, 8),
    ('09'::text, '14-1209'::text, 'Sisal'::text, 9),
    ('10'::text, '17-4123'::text, U&'N\00E1utico'::text, 10),
    ('11'::text, '14-5706'::text, 'Menta'::text, 11),
    ('12'::text, '14-1031'::text, 'Mostarda'::text, 12),
    ('13'::text, 'DL-46'::text, 'Iogurte'::text, 13),
    ('14'::text, 'K-27'::text, 'Malva'::text, 14),
    ('15'::text, 'K-01'::text, 'Grafite'::text, 15),
    ('16'::text, 'K-05'::text, U&'Avel\00E3'::text, 16),
    ('17'::text, '18-4417'::text, U&'\00CDndigo'::text, 17),
    ('18'::text, '18-0324'::text, 'Oliva'::text, 18),
    ('19'::text, '16-1346'::text, 'Cobre'::text, 19),
    ('20'::text, 'K-25'::text, 'Chiclete'::text, 20),
    ('21'::text, 'K-14'::text, 'Marsala'::text, 21),
    ('22'::text, 'K-03'::text, 'Preto'::text, 22),
    ('23'::text, '17-1410'::text, 'Fendi'::text, 23),
    ('24'::text, '19-4023'::text, 'Marinho'::text, 24),
    ('25'::text, '18-6114'::text, 'Bandeira'::text, 25),
    ('26'::text, '18-1441'::text, 'Terracota'::text, 26),
    ('27'::text, '16-1806'::text, 'Rose'::text, 27),
    ('28'::text, '19-1331'::text, U&'Bord\00F4'::text, 28),
    ('29'::text, 'K-04'::text, 'Marrom'::text, 29),
    ('30'::text, '18-1048'::text, 'Mocca'::text, 30),
    ('31'::text, 'K-20'::text, 'Verde Mata'::text, 31)
) AS cor(numero, codigo, nome, ordem)
WHERE fornecedor.chave = 'moriah_tapetes';

DO $$
BEGIN
  IF (
    SELECT count(*)
    FROM public.app_modulos
    WHERE chave IN (
      'pedidos_personalizados_novo',
      'pedidos_personalizados_gestao'
    )
  ) <> 2 THEN
    RAISE EXCEPTION 'pedidos_personalizados_modulos_incompletos';
  END IF;

  IF (
    SELECT count(*)
    FROM public.pedidos_personalizados_fornecedores
  ) <> 3 OR (
    SELECT count(*)
    FROM public.pedidos_personalizados_fornecedores
    WHERE disponivel = true
      AND chave = 'moriah_tapetes'
  ) <> 1 OR (
    SELECT count(*)
    FROM public.pedidos_personalizados_fornecedores
    WHERE disponivel = true
  ) <> 1 THEN
    RAISE EXCEPTION 'pedidos_personalizados_fornecedores_seed_invalido';
  END IF;

  IF (
    SELECT count(*)
    FROM public.pedidos_personalizados_produtos AS produto
    JOIN public.pedidos_personalizados_fornecedores AS fornecedor
      ON fornecedor.id = produto.fornecedor_id
    WHERE fornecedor.chave = 'moriah_tapetes'
  ) <> 3 THEN
    RAISE EXCEPTION 'pedidos_personalizados_produtos_seed_invalido';
  END IF;

  IF (
    SELECT count(*)
    FROM public.pedidos_personalizados_cores AS cor
    JOIN public.pedidos_personalizados_fornecedores AS fornecedor
      ON fornecedor.id = cor.fornecedor_id
    WHERE fornecedor.chave = 'moriah_tapetes'
  ) <> 31 THEN
    RAISE EXCEPTION 'pedidos_personalizados_cores_seed_invalido';
  END IF;
END;
$$;
