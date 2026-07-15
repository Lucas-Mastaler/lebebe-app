import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const migrationPath = path.join(
  process.cwd(),
  'supabase',
  'migrations',
  '20260715180000_create_atendimento_presencial_atendimentos.sql'
)

describe('migration atendimento presencial rascunhos', () => {
  const sql = readFileSync(migrationPath, 'utf8')

  it('cria somente a tabela basica de atendimentos da fase 3', () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.atendimento_presencial_atendimentos')
    expect(sql).not.toContain('atendimento_presencial_criancas')
    expect(sql).not.toContain('atendimento_presencial_fechamentos')
    expect(sql).not.toContain('atendimento_presencial_produtos')
  })

  it('define campos obrigatorios do rascunho', () => {
    expect(sql).toContain('cliente_id uuid REFERENCES public.atendimento_presencial_clientes(id) ON DELETE SET NULL')
    expect(sql).toContain('consultora_usuario_id uuid NOT NULL REFERENCES public.usuarios_permitidos(id)')
    expect(sql).toContain('unidade_id uuid NOT NULL REFERENCES public.app_unidades(id)')
    expect(sql).toContain("status text NOT NULL DEFAULT 'rascunho'")
    expect(sql).toContain('dados_rascunho jsonb NOT NULL')
    expect(sql).toContain("expira_em timestamptz NOT NULL DEFAULT (now() + interval '5 days')")
  })

  it('protege idempotencia, concorrencia e expiracao', () => {
    expect(sql).toContain('CREATE UNIQUE INDEX IF NOT EXISTS uq_atendimento_presencial_atendimentos_draft_client_id')
    expect(sql).toContain('version integer NOT NULL DEFAULT 1')
    expect(sql).toContain('CHECK (version >= 1)')
    expect(sql).toContain('CHECK (expira_em >= ultima_atividade_em)')
    expect(sql).toContain('idx_atendimento_presencial_atendimentos_criado_por')
    expect(sql).toContain('idx_atendimento_presencial_atendimentos_atualizado_por')
    expect(sql).toContain('LANGUAGE plpgsql SET search_path = public')
  })

  it('ativa RLS e nega acesso direto', () => {
    expect(sql).toContain('ALTER TABLE public.atendimento_presencial_atendimentos ENABLE ROW LEVEL SECURITY')
    expect(sql).toContain('REVOKE ALL ON public.atendimento_presencial_atendimentos FROM anon, authenticated')
    expect(sql).toContain('CREATE POLICY atendimento_presencial_atendimentos_no_direct_select')
    expect(sql).toContain('USING (false)')
    expect(sql).toContain('GRANT ALL ON public.atendimento_presencial_atendimentos TO service_role')
  })
})
