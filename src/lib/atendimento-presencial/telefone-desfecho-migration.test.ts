import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const migrationPath = path.join(
  process.cwd(),
  'supabase',
  'migrations',
  '20261020155331_prancheta_desfecho_telefone.sql',
)

describe('migration de desfecho do telefone', () => {
  const sql = readFileSync(migrationPath, 'utf8')

  it('adiciona valores explícitos sem reclassificar dados antigos', () => {
    const ddlAntesDaRpc = sql.split('CREATE OR REPLACE FUNCTION public.atendimento_presencial_concluir(')[0]
    expect(sql).toContain('ADD COLUMN telefone_desfecho text')
    expect(sql).toContain("telefone_desfecho = 'telefone_informado'")
    expect(sql).toContain("telefone_desfecho = 'cliente_recusou'")
    expect(sql).toContain("telefone_desfecho = 'cliente_ausente_sem_solicitacao'")
    expect(ddlAntesDaRpc).not.toMatch(/UPDATE\s+public\.atendimento_presencial_atendimentos/i)
  })

  it('vincula cada opção à tentativa e mantém a coluna compatível', () => {
    expect(sql).toContain("'solicitadoERecusado', true")
    expect(sql).toContain("'naoSolicitadoClienteAusente', true")
    expect(sql).toContain("v_recusa := null;")
    expect(sql).toContain('telefone_recusa_confirmada = v_recusa')
    expect(sql).toContain('telefone_desfecho = v_telefone_desfecho')
    expect(sql).toContain("'telefoneDesfecho', v_telefone_desfecho")
  })
})
