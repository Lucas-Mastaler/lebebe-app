import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const novo = readFileSync('supabase/migrations/20261015182000_atendimento_presencial_normalizador_entradas.sql', 'utf8').replace(/\r\n/g, '\n')
const anterior = readFileSync('scripts/prancheta/sql/restaurar-normalizador-entrega1.sql', 'utf8').replace(/\r\n/g, '\n')
const corpo = (sql: string) => sql.split('$function$')[1]

describe('compatibilidade SQL entre entradas de edicao e conclusao', () => {
  it('termina as definicoes SQL antes dos comandos de permissoes', () => {
    for (const sql of [novo, anterior]) {
      expect(sql).toMatch(/\$function\$;\s+REVOKE ALL ON FUNCTION/)
    }
  })

  it('recuperacao corresponde a definicao real consultada no MCP', () => {
    expect(createHash('md5').update(corpo(anterior)).digest('hex')).toBe('ee9af677cf352b44777be96c1f0d26d4')
  })

  it('altera somente o tratamento local de entradasFormulario, preservando todas as validacoes', () => {
    const inicio = corpo(novo).indexOf('  -- Entradas intermediarias')
    const fim = corpo(novo).indexOf('  if exists (', inicio)
    expect(inicio).toBeGreaterThan(0)
    expect(fim).toBeGreaterThan(inicio)
    expect(corpo(novo).slice(0, inicio) + corpo(novo).slice(fim)).toBe(corpo(anterior))
    expect(novo.indexOf('pg_column_size(p_dados) > 16384')).toBeLessThan(novo.indexOf("p_dados := p_dados - 'entradasFormulario'"))
    expect(novo).toContain("jsonb_typeof(p_dados->'entradasFormulario') <> 'object'")
  })

  it('nao altera registros, grants de cliente ou regras de lancamento', () => {
    expect(novo).not.toMatch(/\b(insert into|update public|delete from|alter table|drop)\b/i)
    expect(novo).toContain('FROM PUBLIC, anon, authenticated')
    expect(novo).toContain('TO service_role')
    expect(novo).not.toContain('GRANT EXECUTE ON FUNCTION public.atendimento_presencial_concluir')
    expect(novo).not.toContain('numero_lancamento')
  })
})
