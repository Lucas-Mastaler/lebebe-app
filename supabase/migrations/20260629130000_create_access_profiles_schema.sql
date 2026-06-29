-- ============================================================
-- MIGRATION: create_access_profiles_schema
-- Fase 1B — perfis de acesso reutilizaveis por usuario
-- Referencia: docs/ia/plano-fase-0-7-modelagem-permissoes-usuarios.md
--
-- Cria 4 tabelas novas:
--   app_perfis_acesso
--   app_usuarios_perfis
--   app_permissoes_perfil
--   app_janelas_acesso_perfil
--
-- Regras de resolucao de permissao (futura implementacao em API):
--   1. superadmin -> acesso total (ignora tabelas de perfil)
--   2. usuario inativo -> bloqueado
--   3. modulo publico -> acessivel sem regra
--   4. excecao individual em app_permissoes_usuario -> prevalece
--   5. sem excecao individual -> usa permissao do perfil (app_permissoes_perfil)
--   6. sem perfil ou sem permissao no perfil -> bloqueia
--
-- ROLLBACK (nao executar automaticamente):
--   DROP TABLE IF EXISTS public.app_janelas_acesso_perfil CASCADE;
--   DROP TABLE IF EXISTS public.app_permissoes_perfil CASCADE;
--   DROP TABLE IF EXISTS public.app_usuarios_perfis CASCADE;
--   DROP TABLE IF EXISTS public.app_perfis_acesso CASCADE;
-- ============================================================


-- ============================================================
-- 1. TABELA: app_perfis_acesso
-- Perfis reutilizaveis que agrupam permissoes de modulos e janelas de acesso.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.app_perfis_acesso (
    id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    chave       text        UNIQUE NOT NULL,
    nome        text        NOT NULL,
    descricao   text,
    ativo       boolean     NOT NULL DEFAULT true,
    sistema     boolean     NOT NULL DEFAULT false,
    ordem       integer,
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE  public.app_perfis_acesso IS 'Perfis de acesso reutilizaveis. Cada usuario pode ter no maximo um perfil ativo.';
COMMENT ON COLUMN public.app_perfis_acesso.chave IS 'Identificador estavel do perfil (ex: consultora, recebimento). Nunca alterar apos criacao.';
COMMENT ON COLUMN public.app_perfis_acesso.sistema IS 'Se true, perfil e gerenciado pelo sistema e nao deve ser removido manualmente.';

CREATE INDEX IF NOT EXISTS idx_app_perfis_chave  ON public.app_perfis_acesso(chave);
CREATE INDEX IF NOT EXISTS idx_app_perfis_ativo   ON public.app_perfis_acesso(ativo);

CREATE TRIGGER update_app_perfis_acesso_updated_at
    BEFORE UPDATE ON public.app_perfis_acesso
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();


-- ============================================================
-- 2. TABELA: app_usuarios_perfis
-- Vinculo do perfil principal de cada usuario.
-- Um usuario pode ter no maximo um perfil (UNIQUE usuario_id).
-- ============================================================
CREATE TABLE IF NOT EXISTS public.app_usuarios_perfis (
    id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id    uuid        NOT NULL REFERENCES public.usuarios_permitidos(id) ON DELETE CASCADE,
    perfil_id     uuid        NOT NULL REFERENCES public.app_perfis_acesso(id) ON DELETE RESTRICT,
    atribuido_por uuid        REFERENCES public.usuarios_permitidos(id),
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now(),
    UNIQUE (usuario_id)
);

COMMENT ON TABLE  public.app_usuarios_perfis IS 'Perfil principal atribuido a cada usuario. Um usuario tem no maximo um perfil.';
COMMENT ON COLUMN public.app_usuarios_perfis.perfil_id IS 'ON DELETE RESTRICT: nao permite remover um perfil que ainda tenha usuarios vinculados.';
COMMENT ON COLUMN public.app_usuarios_perfis.atribuido_por IS 'ID do superadmin que atribuiu o perfil ao usuario.';

CREATE INDEX IF NOT EXISTS idx_app_usuarios_perfis_usuario_id ON public.app_usuarios_perfis(usuario_id);
CREATE INDEX IF NOT EXISTS idx_app_usuarios_perfis_perfil_id  ON public.app_usuarios_perfis(perfil_id);

CREATE TRIGGER update_app_usuarios_perfis_updated_at
    BEFORE UPDATE ON public.app_usuarios_perfis
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();


-- ============================================================
-- 3. TABELA: app_permissoes_perfil
-- Modulos liberados ou bloqueados por perfil.
-- Semantica: true = libera, false = bloqueia.
-- Ausencia de linha = modulo nao pertence ao perfil (efetivamente bloqueado pelo step 6 da resolucao).
-- ============================================================
CREATE TABLE IF NOT EXISTS public.app_permissoes_perfil (
    id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    perfil_id   uuid        NOT NULL REFERENCES public.app_perfis_acesso(id) ON DELETE CASCADE,
    modulo_id   uuid        NOT NULL REFERENCES public.app_modulos(id) ON DELETE CASCADE,
    permitido   boolean     NOT NULL DEFAULT true,
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now(),
    UNIQUE (perfil_id, modulo_id)
);

COMMENT ON TABLE  public.app_permissoes_perfil IS 'Modulos liberados/bloqueados por perfil. Ausencia de linha = nao incluso no perfil.';
COMMENT ON COLUMN public.app_permissoes_perfil.permitido IS 'true = modulo liberado para o perfil; false = modulo explicitamente bloqueado.';

CREATE INDEX IF NOT EXISTS idx_app_permissoes_perfil_perfil_id ON public.app_permissoes_perfil(perfil_id);
CREATE INDEX IF NOT EXISTS idx_app_permissoes_perfil_modulo_id ON public.app_permissoes_perfil(modulo_id);

CREATE TRIGGER update_app_permissoes_perfil_updated_at
    BEFORE UPDATE ON public.app_permissoes_perfil
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();


-- ============================================================
-- 4. TABELA: app_janelas_acesso_perfil
-- Janelas de horario padrao por perfil, separadas por tipo de dia.
-- Tipos: seg_sex (segunda a sexta), sabado, domingo.
-- Se ativo = false, o perfil nao tem acesso naquele tipo de dia.
-- Se ativo = true, hora_inicio e hora_fim sao obrigatorios e hora_fim > hora_inicio.
-- Superadmins ignoram esta tabela por design.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.app_janelas_acesso_perfil (
    id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    perfil_id   uuid        NOT NULL REFERENCES public.app_perfis_acesso(id) ON DELETE CASCADE,
    tipo        text        NOT NULL CHECK (tipo IN ('seg_sex', 'sabado', 'domingo')),
    ativo       boolean     NOT NULL DEFAULT true,
    hora_inicio time,
    hora_fim    time,
    timezone    text        NOT NULL DEFAULT 'America/Sao_Paulo',
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now(),
    UNIQUE (perfil_id, tipo),
    CONSTRAINT chk_janela_perfil_horas_quando_ativo CHECK (
        (ativo = false)
        OR (ativo = true AND hora_inicio IS NOT NULL AND hora_fim IS NOT NULL AND hora_fim > hora_inicio)
    )
);

COMMENT ON TABLE  public.app_janelas_acesso_perfil IS 'Janelas de horario padrao do perfil por tipo de dia. Superadmins ignoram esta tabela.';
COMMENT ON COLUMN public.app_janelas_acesso_perfil.tipo IS 'Tipo de dia: seg_sex (segunda a sexta), sabado, domingo.';
COMMENT ON COLUMN public.app_janelas_acesso_perfil.ativo IS 'Se false, perfil nao tem acesso naquele tipo de dia (hora_inicio e hora_fim podem ser null).';
COMMENT ON COLUMN public.app_janelas_acesso_perfil.hora_inicio IS 'Obrigatorio quando ativo = true. No timezone especificado.';
COMMENT ON COLUMN public.app_janelas_acesso_perfil.hora_fim IS 'Obrigatorio quando ativo = true. Deve ser maior que hora_inicio.';

CREATE INDEX IF NOT EXISTS idx_app_janelas_perfil_perfil_id ON public.app_janelas_acesso_perfil(perfil_id);
CREATE INDEX IF NOT EXISTS idx_app_janelas_perfil_tipo      ON public.app_janelas_acesso_perfil(tipo);

CREATE TRIGGER update_app_janelas_acesso_perfil_updated_at
    BEFORE UPDATE ON public.app_janelas_acesso_perfil
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();


-- ============================================================
-- 5. RLS + REVOKE GRANTS
-- Padrao do projeto: REVOKE ALL de anon e authenticated.
-- Acesso via service role apenas (API routes server-side).
-- ============================================================
ALTER TABLE public.app_perfis_acesso         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_usuarios_perfis       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_permissoes_perfil     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_janelas_acesso_perfil ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.app_perfis_acesso         FROM anon;
REVOKE ALL ON TABLE public.app_perfis_acesso         FROM authenticated;
REVOKE ALL ON TABLE public.app_usuarios_perfis       FROM anon;
REVOKE ALL ON TABLE public.app_usuarios_perfis       FROM authenticated;
REVOKE ALL ON TABLE public.app_permissoes_perfil     FROM anon;
REVOKE ALL ON TABLE public.app_permissoes_perfil     FROM authenticated;
REVOKE ALL ON TABLE public.app_janelas_acesso_perfil FROM anon;
REVOKE ALL ON TABLE public.app_janelas_acesso_perfil FROM authenticated;


-- ============================================================
-- 6. SEED: app_perfis_acesso — 5 perfis operacionais
-- ON CONFLICT (chave) DO NOTHING: idempotente.
-- ============================================================
INSERT INTO public.app_perfis_acesso (chave, nome, descricao, ativo, sistema, ordem)
VALUES
    ('consultora',       'Consultora',        'Acesso operacional de consultora de vendas',         true, false, 10),
    ('supervisora_loja', 'Supervisora Loja',  'Acesso de supervisao de loja',                        true, false, 20),
    ('pos_venda',        'Pos-venda',         'Acesso ao modulo de pos-venda e atendimento',         true, false, 30),
    ('recebimento',      'Recebimento',       'Acesso ao modulo de recebimento de mercadorias',      true, false, 40),
    ('gestao',           'Gestao',            'Acesso amplo de gestao operacional',                  true, false, 50)
ON CONFLICT (chave) DO NOTHING;


-- ============================================================
-- 7. SEED: app_janelas_acesso_perfil — 3 janelas por perfil (seg_sex, sabado, domingo)
-- Padrao conservador:
--   seg_sex: ativo=true, 08:00-18:00
--   sabado:  ativo=true, 09:00-13:00
--   domingo: ativo=false, sem horario
-- ON CONFLICT (perfil_id, tipo) DO NOTHING: idempotente.
-- ============================================================
INSERT INTO public.app_janelas_acesso_perfil (perfil_id, tipo, ativo, hora_inicio, hora_fim, timezone)
SELECT p.id, j.tipo, j.ativo, j.hora_inicio::time, j.hora_fim::time, 'America/Sao_Paulo'
FROM public.app_perfis_acesso p
CROSS JOIN (
    VALUES
        ('seg_sex', true,  '08:00', '18:00'),
        ('sabado',  true,  '09:00', '13:00'),
        ('domingo', false, NULL,    NULL   )
) AS j(tipo, ativo, hora_inicio, hora_fim)
WHERE p.chave IN ('consultora', 'supervisora_loja', 'pos_venda', 'recebimento', 'gestao')
ON CONFLICT (perfil_id, tipo) DO NOTHING;


-- ============================================================
-- NOTA: Permissoes por perfil (app_permissoes_perfil) NAO sao inseridas nesta migration.
-- Decisao: as permissoes corretas por perfil devem ser validadas com o usuario antes de
-- popular. Serao inseridas via tela de gestao ou migration futura apos decisao.
-- Pendencia registrada em docs/ia/log_progress.md.
-- ============================================================
