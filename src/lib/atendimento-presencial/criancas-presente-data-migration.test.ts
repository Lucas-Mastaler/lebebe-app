import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const migrationPath = join(
  process.cwd(),
  'supabase/migrations/20260722203000_atendimento_presencial_criancas_presente_data.sql',
)

describe('migration de criancas do atendimento presencial', () => {
  it('permite data prevista para presente de outra pessoa sem permitir idade', () => {
    const sql = readFileSync(migrationPath, 'utf8')

    expect(sql).toContain('drop constraint if exists atendimento_presencial_criancas_condicional_check')
    expect(sql).toContain('add constraint atendimento_presencial_criancas_condicional_check')
    expect(sql).toContain("situacao = 'presente_outra_pessoa' and idade_unidade is null and idade_valor is null")
    expect(sql).not.toContain("situacao = 'presente_outra_pessoa' and data_prevista_nascimento is null")
    expect(sql).toContain("situacao = 'nao_informado' and data_prevista_nascimento is null")
  })
})
