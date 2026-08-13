import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = fs.readFileSync(
  path.join(process.cwd(), 'supabase/migrations/20260813130000_hub_vendas_periodo_protocolo_timestamps.sql'),
  'utf8'
)

describe('migration Hub/Vendas período, protocolo e timestamps', () => {
  it('cria somente os campos novos aprovados', () => {
    expect(migration).toContain('ADD COLUMN data_encerrado timestamptz NULL')
    expect(migration).toContain('ADD COLUMN data_fila_manual timestamptz NULL')
    expect(migration).toContain('ADD COLUMN digisac_protocolo text NULL')
  })

  it('faz backfill apenas dos status corretos com campo nulo', () => {
    expect(migration).toMatch(/SET data_encerrado = updated_at[\s\S]*status = 'encerrado'[\s\S]*data_encerrado IS NULL/)
    expect(migration).toMatch(/SET data_fila_manual = updated_at[\s\S]*status = 'fila_manual'[\s\S]*data_fila_manual IS NULL/)
  })

  it('RPC de fila manual grava timestamp próprio e mantém filtro idempotente por status', () => {
    expect(migration).toContain("status = 'fila_manual',")
    expect(migration).toContain('data_fila_manual = now()')
    expect(migration).toContain("WHERE lead.status = 'aguardando_conversao'")
  })
})
