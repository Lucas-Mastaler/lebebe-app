import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const migrationPath = path.join(
  process.cwd(),
  'supabase',
  'migrations',
  '20260715170000_create_atendimento_presencial_clientes.sql'
)

describe('migration atendimento presencial clientes', () => {
  const sql = readFileSync(migrationPath, 'utf8')

  it('cria somente a tabela de clientes presenciais desta fase', () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.atendimento_presencial_clientes')
    expect(sql).not.toContain('atendimento_presencial_atendimentos')
    expect(sql).not.toContain('atendimento_presencial_criancas')
    expect(sql).not.toContain('atendimento_presencial_fechamentos')
  })

  it('mantem telefone opcional com unique parcial para clientes ativos', () => {
    expect(sql).toContain('telefone_normalizado text')
    expect(sql).toContain('CREATE UNIQUE INDEX IF NOT EXISTS uq_atendimento_presencial_clientes_telefone_ativo')
    expect(sql).toContain("WHERE status = 'ativo'")
    expect(sql).toContain('AND telefone_normalizado IS NOT NULL')
  })

  it('ativa RLS e bloqueia acesso direto de anon/authenticated', () => {
    expect(sql).toContain('ALTER TABLE public.atendimento_presencial_clientes ENABLE ROW LEVEL SECURITY')
    expect(sql).toContain('REVOKE ALL ON public.atendimento_presencial_clientes FROM anon, authenticated')
    expect(sql).toContain('CREATE POLICY atendimento_presencial_clientes_no_direct_select')
    expect(sql).toContain('USING (false)')
  })

  it('valida parentesco e complemento de outro', () => {
    expect(sql).toContain('atendimento_presencial_clientes_parentesco_check')
    expect(sql).toContain("'avo_masculino'")
    expect(sql).toContain("'avo_feminino'")
    expect(sql).toContain('atendimento_presencial_clientes_parentesco_outro_check')
  })
})
