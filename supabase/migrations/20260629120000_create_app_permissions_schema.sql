-- ============================================================
-- MIGRATION: create_app_permissions_schema
-- Fase 1 do plano de gestao de permissoes por modulo/tela
-- Documento de referencia: docs/ia/plano-fase-0-7-modelagem-permissoes-usuarios.md
--
-- Cria as 4 tabelas de controle granular de permissoes:
--   app_modulos
--   app_permissoes_usuario
--   app_janelas_acesso_usuario
--   app_auditoria_permissoes
--
-- Convencao de dias da semana: 0=domingo, 1=segunda, ..., 6=sabado (ISO-like: 0-6)
--
-- ROLLBACK (nao executar automaticamente):
--   DROP TABLE IF EXISTS public.app_auditoria_permissoes CASCADE;
--   DROP TABLE IF EXISTS public.app_janelas_acesso_usuario CASCADE;
--   DROP TABLE IF EXISTS public.app_permissoes_usuario CASCADE;
--   DROP TABLE IF EXISTS public.app_modulos CASCADE;
-- ============================================================


-- ============================================================
-- 1. TABELA: app_modulos
-- Catalogo de todos os modulos/telas controlaveis do sistema.
-- Fonte de verdade para o frontend e para o sistema de permissoes.
-- Superadmin sempre tem acesso a tudo, independentemente desta tabela.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.app_modulos (
    id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    chave          text        UNIQUE NOT NULL,
    nome           text        NOT NULL,
    descricao      text,
    rota_base      text,
    categoria      text,
    publico        boolean     NOT NULL DEFAULT false,
    somente_superadmin boolean NOT NULL DEFAULT false,
    ativo          boolean     NOT NULL DEFAULT true,
    ordem          integer,
    created_at     timestamptz NOT NULL DEFAULT now(),
    updated_at     timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE  public.app_modulos IS 'Catalogo de modulos/telas controlaveis do sistema para gestao de permissoes granulares.';
COMMENT ON COLUMN public.app_modulos.chave IS 'Identificador estavel do modulo (ex: dashboard, recebimento). Nunca alterar apos criacao.';
COMMENT ON COLUMN public.app_modulos.publico IS 'Se true, modulo e acessivel sem login (ex: horarios_agendamentos). Nao entra no controle de permissao.';
COMMENT ON COLUMN public.app_modulos.somente_superadmin IS 'Se true, apenas superadmins podem acessar. Controle por role, nao por permissao granular.';

CREATE INDEX IF NOT EXISTS idx_app_modulos_chave   ON public.app_modulos(chave);
CREATE INDEX IF NOT EXISTS idx_app_modulos_ativo    ON public.app_modulos(ativo);
CREATE INDEX IF NOT EXISTS idx_app_modulos_publico  ON public.app_modulos(publico);
CREATE INDEX IF NOT EXISTS idx_app_modulos_ordem    ON public.app_modulos(ordem);

CREATE TRIGGER update_app_modulos_updated_at
    BEFORE UPDATE ON public.app_modulos
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();


-- ============================================================
-- 2. TABELA: app_permissoes_usuario
-- Overrides de acesso por usuario e modulo.
-- Semantica:
--   - Sem linha = usa default do role (superadmin: tudo; user: modulos padrao).
--   - Com linha permitido=true  = acesso liberado explicitamente.
--   - Com linha permitido=false = acesso bloqueado explicitamente.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.app_permissoes_usuario (
    id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id   uuid        NOT NULL REFERENCES public.usuarios_permitidos(id) ON DELETE CASCADE,
    modulo_id    uuid        NOT NULL REFERENCES public.app_modulos(id) ON DELETE CASCADE,
    permitido    boolean     NOT NULL DEFAULT true,
    concedido_por uuid       REFERENCES public.usuarios_permitidos(id),
    motivo       text,
    created_at   timestamptz NOT NULL DEFAULT now(),
    updated_at   timestamptz NOT NULL DEFAULT now(),
    UNIQUE (usuario_id, modulo_id)
);

COMMENT ON TABLE  public.app_permissoes_usuario IS 'Overrides de permissao por usuario e modulo. Ausencia de linha = usa default do role.';
COMMENT ON COLUMN public.app_permissoes_usuario.permitido IS 'true = acesso liberado; false = acesso bloqueado. Substitui o default do role para este modulo.';
COMMENT ON COLUMN public.app_permissoes_usuario.concedido_por IS 'ID do superadmin que concedeu ou revogou a permissao.';
COMMENT ON COLUMN public.app_permissoes_usuario.motivo IS 'Justificativa opcional para o override de permissao.';

CREATE INDEX IF NOT EXISTS idx_app_permissoes_usuario_id  ON public.app_permissoes_usuario(usuario_id);
CREATE INDEX IF NOT EXISTS idx_app_permissoes_modulo_id   ON public.app_permissoes_usuario(modulo_id);
CREATE INDEX IF NOT EXISTS idx_app_permissoes_permitido   ON public.app_permissoes_usuario(permitido);

CREATE TRIGGER update_app_permissoes_usuario_updated_at
    BEFORE UPDATE ON public.app_permissoes_usuario
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();


-- ============================================================
-- 3. TABELA: app_janelas_acesso_usuario
-- Janela de horario e dias da semana permitidos por usuario.
-- Convencao de dias_semana: 0=domingo, 1=segunda, ..., 6=sabado.
-- Timezone: sempre 'America/Sao_Paulo' por padrao (BRT).
-- Restricao: hora_fim > hora_inicio (janela nao cruza meia-noite nesta versao).
-- Superadmins ignoram esta tabela por design.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.app_janelas_acesso_usuario (
    id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id   uuid        NOT NULL REFERENCES public.usuarios_permitidos(id) ON DELETE CASCADE,
    dias_semana  smallint[]  NOT NULL,
    hora_inicio  time        NOT NULL,
    hora_fim     time        NOT NULL,
    timezone     text        NOT NULL DEFAULT 'America/Sao_Paulo',
    ativo        boolean     NOT NULL DEFAULT true,
    created_at   timestamptz NOT NULL DEFAULT now(),
    updated_at   timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT chk_janela_hora_fim_maior_inicio CHECK (hora_fim > hora_inicio),
    CONSTRAINT chk_janela_dias_validos CHECK (
        dias_semana <@ ARRAY[0,1,2,3,4,5,6]::smallint[]
        AND array_length(dias_semana, 1) >= 1
    )
);

COMMENT ON TABLE  public.app_janelas_acesso_usuario IS 'Janela de horario e dias da semana de acesso por usuario. Superadmins ignoram esta tabela.';
COMMENT ON COLUMN public.app_janelas_acesso_usuario.dias_semana IS 'Dias permitidos: 0=domingo, 1=segunda, 2=terca, 3=quarta, 4=quinta, 5=sexta, 6=sabado.';
COMMENT ON COLUMN public.app_janelas_acesso_usuario.hora_inicio IS 'Hora de inicio do acesso (inclusive). No timezone especificado.';
COMMENT ON COLUMN public.app_janelas_acesso_usuario.hora_fim IS 'Hora de fim do acesso (exclusive). Deve ser maior que hora_inicio (sem cruzar meia-noite nesta versao).';
COMMENT ON COLUMN public.app_janelas_acesso_usuario.timezone IS 'Timezone da janela. Padrao: America/Sao_Paulo (BRT).';
COMMENT ON COLUMN public.app_janelas_acesso_usuario.ativo IS 'Se false, janela ignorada e comportamento padrao e usado (auto-logout 19h).';

CREATE INDEX IF NOT EXISTS idx_app_janelas_usuario_id ON public.app_janelas_acesso_usuario(usuario_id);
CREATE INDEX IF NOT EXISTS idx_app_janelas_ativo       ON public.app_janelas_acesso_usuario(ativo);

CREATE TRIGGER update_app_janelas_acesso_usuario_updated_at
    BEFORE UPDATE ON public.app_janelas_acesso_usuario
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();


-- ============================================================
-- 4. TABELA: app_auditoria_permissoes
-- Log append-only de alteracoes de permissoes.
-- Nao registrar secrets, tokens, senhas ou dados sensiveis.
-- Nao possui updated_at: registro imutavel por design.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.app_auditoria_permissoes (
    id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    ator_usuario_id  uuid        REFERENCES public.usuarios_permitidos(id),
    alvo_usuario_id  uuid        REFERENCES public.usuarios_permitidos(id),
    acao             text        NOT NULL,
    entidade         text        NOT NULL,
    entidade_id      uuid,
    antes            jsonb,
    depois           jsonb,
    metadata         jsonb,
    created_at       timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE  public.app_auditoria_permissoes IS 'Log append-only de alteracoes de permissoes de usuarios. Registro imutavel.';
COMMENT ON COLUMN public.app_auditoria_permissoes.ator_usuario_id IS 'Superadmin que executou a acao. NULL se acao foi automatica.';
COMMENT ON COLUMN public.app_auditoria_permissoes.alvo_usuario_id IS 'Usuario cujas permissoes foram alteradas.';
COMMENT ON COLUMN public.app_auditoria_permissoes.acao IS 'Ex: PERMISSAO_LIBERADA, PERMISSAO_BLOQUEADA, PERMISSAO_REMOVIDA, JANELA_DEFINIDA, JANELA_REMOVIDA.';
COMMENT ON COLUMN public.app_auditoria_permissoes.entidade IS 'Tabela/entidade afetada: app_permissoes_usuario, app_janelas_acesso_usuario.';
COMMENT ON COLUMN public.app_auditoria_permissoes.entidade_id IS 'ID do registro afetado na entidade.';
COMMENT ON COLUMN public.app_auditoria_permissoes.antes IS 'Estado anterior. Nao registrar secrets ou tokens.';
COMMENT ON COLUMN public.app_auditoria_permissoes.depois IS 'Estado posterior. Nao registrar secrets ou tokens.';
COMMENT ON COLUMN public.app_auditoria_permissoes.metadata IS 'Dados extras opcionais (IP, user_agent, etc). Nao registrar secrets ou tokens.';

CREATE INDEX IF NOT EXISTS idx_app_auditoria_perm_ator        ON public.app_auditoria_permissoes(ator_usuario_id);
CREATE INDEX IF NOT EXISTS idx_app_auditoria_perm_alvo        ON public.app_auditoria_permissoes(alvo_usuario_id);
CREATE INDEX IF NOT EXISTS idx_app_auditoria_perm_acao        ON public.app_auditoria_permissoes(acao);
CREATE INDEX IF NOT EXISTS idx_app_auditoria_perm_created_at  ON public.app_auditoria_permissoes(created_at DESC);


-- ============================================================
-- 5. RLS + REVOKE GRANTS
-- Padrao do projeto (Fase 0.3): REVOKE ALL de anon e authenticated.
-- Acesso via service role apenas (API routes server-side).
-- Nao criar policies permissivas para usuarios comuns nesta fase.
-- ============================================================

ALTER TABLE public.app_modulos                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_permissoes_usuario        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_janelas_acesso_usuario    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_auditoria_permissoes      ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.app_modulos               FROM anon;
REVOKE ALL ON TABLE public.app_modulos               FROM authenticated;
REVOKE ALL ON TABLE public.app_permissoes_usuario    FROM anon;
REVOKE ALL ON TABLE public.app_permissoes_usuario    FROM authenticated;
REVOKE ALL ON TABLE public.app_janelas_acesso_usuario FROM anon;
REVOKE ALL ON TABLE public.app_janelas_acesso_usuario FROM authenticated;
REVOKE ALL ON TABLE public.app_auditoria_permissoes  FROM anon;
REVOKE ALL ON TABLE public.app_auditoria_permissoes  FROM authenticated;

-- Nota: sem policies para authenticated nesta fase.
-- O acesso sera exclusivamente via service role nas API routes futuras.
-- Policies serao adicionadas em fase posterior conforme necessidade real.


-- ============================================================
-- 6. SEED: app_modulos
-- Modulos iniciais do sistema.
-- ON CONFLICT (chave) DO NOTHING: idempotente, nunca sobrescreve.
-- ============================================================

INSERT INTO public.app_modulos (chave, nome, descricao, rota_base, categoria, publico, somente_superadmin, ativo, ordem)
VALUES
    -- Modulos internos padrao (user e superadmin)
    ('dashboard',              'DASHBOARD',              'Painel principal do sistema',                              '/dashboard',              'interno', false, false, true, 10),
    ('agendamentos',           'AGENDAMENTOS',           'Consulta e gestao de agendamentos',                        '/agendamentos',           'interno', false, false, true, 20),
    ('procurar_datas',         'PROCURAR DATAS',         'Motor de busca de datas de entrega disponiveis',           '/procurar-datas',         'interno', false, false, true, 30),
    ('chamados_finalizados',   'CHAMADOS FINALIZADOS',   'Listagem e pesquisa de chamados encerrados',               '/chamados-finalizados',   'interno', false, false, true, 40),
    ('inteligencia_comercial', 'INTELIGENCIA COMERCIAL', 'Analise comercial de vendas e clientes',                   '/inteligencia-comercial', 'interno', false, false, true, 50),
    ('pos_venda',              'POS VENDA',              'Modulo de pos-venda',                                      '/pos-venda',              'interno', false, false, true, 60),
    -- Modulo controlado por whitelist Matic (regra nao migrada nesta fase)
    ('recebimento',            'RECEBIMENTO',            'Recebimento de mercadorias (Matic). Controle futuro.',     '/recebimento',            'interno', false, false, true, 70),
    -- Modulos exclusivos de superadmin (somente_superadmin=true, nao entram em permissao granular)
    ('superadmin',             'SUPERADMIN',             'Gestao de usuarios e auditoria do sistema',                '/superadmin',             'admin',   false, true,  true, 90),
    ('configuracoes',          'CONFIGURACOES',          'Configuracoes avancadas do sistema',                       '/configuracoes',          'admin',   false, true,  true, 91),
    -- Modulo publico (publico=true, fora do modelo de permissao)
    ('horarios_agendamentos',  'HORARIOS AGENDAMENTOS',  'Consulta publica de horarios disponiveis (sem login)',     '/horarios-agendamentos',  'publico', true,  false, true, 100)
ON CONFLICT (chave) DO NOTHING;
