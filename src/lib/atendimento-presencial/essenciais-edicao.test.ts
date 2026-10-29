import { describe, expect, it } from 'vitest'
import { calcularAlteracoesEssenciaisAtendimento, mapearSnapshotEssenciaisParaEdicao } from './essenciais-edicao'
import type { SnapshotEssenciais } from './essenciais'

const criancas = [
  { id: 'db-a', local_id: 'local-a', crianca_permanente_id: 'permanente-a' },
  { id: 'db-b', local_id: 'local-b', crianca_permanente_id: 'permanente-b' },
]

const snapshots: SnapshotEssenciais[] = [
  {
    atendimentoId: 'atendimento-antigo', criancaId: 'permanente-a', nome: 'Alice', fase: 2,
    filial: 'Centro', consultora: 'Ana', registradoEm: '2026-08-01T12:00:00Z',
    respostas: [
      { produto: 'poltrona', resposta: 'nao', confirmada: true },
      { produto: 'coleito', resposta: 'sim', confirmada: false },
    ],
  },
  {
    atendimentoId: 'atendimento-antigo', criancaId: 'permanente-b', nome: 'Bia', fase: 2,
    filial: 'Centro', consultora: 'Ana', registradoEm: '2026-08-01T12:00:00Z',
    respostas: [{ produto: 'poltrona', resposta: 'sim', confirmada: true }],
  },
]

describe('edição histórica de Produtos Essenciais', () => {
  it('carrega apenas snapshots do atendimento e mapeia cada criança', () => {
    const estado = mapearSnapshotEssenciaisParaEdicao(criancas, snapshots)
    expect(estado.respostas).toEqual({
      'local-a': { poltrona: 'nao', coleito: 'sim' },
      'local-b': { poltrona: 'sim' },
    })
    expect(estado.confirmacoes['local-a']).toEqual({ poltrona: true, coleito: false })
    expect(estado.coletadas).toEqual({ 'local-a': true, 'local-b': true })
    expect(estado.fases).toEqual({ 'local-a': 2, 'local-b': 2 })
  })

  it('gera revisões apenas para itens alterados e não consulta nem altera estado atual', () => {
    const resultado = calcularAlteracoesEssenciaisAtendimento({
      criancas,
      snapshots,
      respostas: { 'local-a': { poltrona: 'sim', coleito: 'sim' }, 'local-b': { poltrona: 'sim' } },
      confirmacoes: { 'local-a': { poltrona: true, coleito: false }, 'local-b': { poltrona: true } },
    })
    expect(resultado).toEqual({ ok: true, alteracoes: [{ localId: 'local-a', produto: 'poltrona', resposta: 'sim', confirmada: true }] })
  })

  it('registra a confirmação quando a resposta igual estava apenas como referência anterior', () => {
    const resultado = calcularAlteracoesEssenciaisAtendimento({
      criancas: criancas.slice(0, 1),
      snapshots: snapshots.slice(0, 1),
      respostas: { 'local-a': { coleito: 'sim' } },
      confirmacoes: { 'local-a': { coleito: true } },
    })
    expect(resultado).toEqual({ ok: true, alteracoes: [{ localId: 'local-a', produto: 'coleito', resposta: 'sim', confirmada: true }] })
  })

  it('não retropreenche item de criança sem snapshot no atendimento', () => {
    const resultado = calcularAlteracoesEssenciaisAtendimento({
      criancas: [...criancas, { id: 'db-c', local_id: 'local-c', crianca_permanente_id: 'permanente-c' }],
      snapshots,
      respostas: { 'local-c': { poltrona: 'sim' } },
      confirmacoes: { 'local-c': { poltrona: true } },
    })
    expect(resultado).toMatchObject({ ok: false })
  })
})
