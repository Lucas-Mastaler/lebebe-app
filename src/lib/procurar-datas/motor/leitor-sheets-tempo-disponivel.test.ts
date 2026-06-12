// ─────────────────────────────────────────────────────────────────────────────
// motor/leitor-sheets-tempo-disponivel.test.ts
//   Testes unitários para converterTabelaTempoDisponivel (helper puro, sem I/O)
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest'
import {
  converterTabelaTempoDisponivel,
  CABECALHO_ESPERADO,
} from './leitor-sheets-tempo-disponivel'

// ─── Fixture ──────────────────────────────────────────────────────────────────

const CABECALHO_REAL = ['DATA', 'EQUIPE', 'TEMPO UTILIZADO', 'TEMPO DISPONÍVEL', 'TEMPO EXCEDIDO', 'STATUS']

const LINHAS_EXEMPLO: string[][] = [
  CABECALHO_REAL,
  ['23/06/2026', 'Equipe 1', '06:00', '01:00', '', 'disponível'],
  ['13/06/2026', 'Equipe 1', '05:45', '00:00', '01:45', 'excedeu'],
  ['12/06/2026', 'Equipe 2', '07:00', '00:00', '', 'agenda fechada'],
]

// ─── Testes ───────────────────────────────────────────────────────────────────

describe('converterTabelaTempoDisponivel', () => {
  it('1. converte 3 linhas de exemplo corretamente', () => {
    const res = converterTabelaTempoDisponivel(LINHAS_EXEMPLO)
    expect(res.linhas).toHaveLength(3)
    expect(res.linhasLidas).toBe(3)
    expect(res.linhasConvertidas).toBe(3)
    expect(res.cabecalhoReconhecido).toBe(true)
  })

  it('2. mapeia campos corretamente na primeira linha de dados', () => {
    const res = converterTabelaTempoDisponivel(LINHAS_EXEMPLO)
    expect(res.linhas[0]).toMatchObject({
      data: '23/06/2026',
      equipe: 'Equipe 1',
      tempoUtilizado: '06:00',
      tempoDisponivel: '01:00',
      tempoExcedido: '',
      status: 'disponível',
    })
  })

  it('3. mapeia campos corretamente na terceira linha de dados', () => {
    const res = converterTabelaTempoDisponivel(LINHAS_EXEMPLO)
    expect(res.linhas[2]).toMatchObject({
      data: '12/06/2026',
      equipe: 'Equipe 2',
      tempoUtilizado: '07:00',
      tempoDisponivel: '00:00',
      tempoExcedido: '',
      status: 'agenda fechada',
    })
  })

  it('4. retorna cabecalhoEncontrado com os valores da primeira linha', () => {
    const res = converterTabelaTempoDisponivel(LINHAS_EXEMPLO)
    expect(res.cabecalhoEncontrado).toEqual(CABECALHO_REAL)
  })

  it('5. tabela vazia retorna linhas: [] e aviso', () => {
    const res = converterTabelaTempoDisponivel([])
    expect(res.linhas).toHaveLength(0)
    expect(res.linhasLidas).toBe(0)
    expect(res.linhasConvertidas).toBe(0)
    expect(res.avisos.length).toBeGreaterThan(0)
    expect(res.cabecalhoReconhecido).toBe(false)
  })

  it('6. tabela com apenas cabeçalho retorna linhas: []', () => {
    const res = converterTabelaTempoDisponivel([CABECALHO_REAL])
    expect(res.linhas).toHaveLength(0)
    expect(res.linhasLidas).toBe(0)
    expect(res.cabecalhoReconhecido).toBe(true)
  })

  it('7. cabeçalho com acento na coluna TEMPO DISPONÍVEL é reconhecido', () => {
    const cab = ['DATA', 'EQUIPE', 'TEMPO UTILIZADO', 'TEMPO DISPONÍVEL', 'TEMPO EXCEDIDO', 'STATUS']
    const res = converterTabelaTempoDisponivel([cab, ['23/06/2026', 'Equipe 1', '06:00', '01:00', '', 'disponível']])
    expect(res.cabecalhoReconhecido).toBe(true)
  })

  it('8. cabeçalho sem acento (TEMPO DISPONIVEL) também é reconhecido', () => {
    const cab = ['DATA', 'EQUIPE', 'TEMPO UTILIZADO', 'TEMPO DISPONIVEL', 'TEMPO EXCEDIDO', 'STATUS']
    const res = converterTabelaTempoDisponivel([cab, ['23/06/2026', 'Equipe 1', '06:00', '01:00', '', 'disponível']])
    expect(res.cabecalhoReconhecido).toBe(true)
  })

  it('9. cabeçalho irreconhecível gera aviso mas conversão continua', () => {
    const cab = ['Col1', 'Col2', 'Col3', 'Col4', 'Col5', 'Col6']
    const res = converterTabelaTempoDisponivel([cab, ['23/06/2026', 'Equipe 1', '06:00', '01:00', '', 'disponível']])
    expect(res.cabecalhoReconhecido).toBe(false)
    expect(res.linhas).toHaveLength(1)
    expect(res.avisos.some((a) => a.includes('Cabeçalho não reconhecido'))).toBe(true)
  })

  it('10. linhas com colunas faltando resultam em string vazia (sem lançar erro)', () => {
    const tabela = [CABECALHO_REAL, ['23/06/2026', 'Equipe 1']]
    const res = converterTabelaTempoDisponivel(tabela)
    expect(res.linhas[0].tempoDisponivel).toBe('')
    expect(res.linhas[0].status).toBe('')
  })

  it('11. não muta a tabela de entrada', () => {
    const tabelaOriginal = JSON.parse(JSON.stringify(LINHAS_EXEMPLO)) as string[][]
    converterTabelaTempoDisponivel(LINHAS_EXEMPLO)
    expect(LINHAS_EXEMPLO).toEqual(tabelaOriginal)
  })

  it('12. CABECALHO_ESPERADO tem 6 colunas na ordem correta', () => {
    expect(CABECALHO_ESPERADO).toHaveLength(6)
    expect(CABECALHO_ESPERADO[0]).toBe('DATA')
    expect(CABECALHO_ESPERADO[3]).toBe('TEMPO DISPONÍVEL')
  })

  it('13. trim é aplicado nos valores das células', () => {
    const tabela = [CABECALHO_REAL, ['  23/06/2026  ', '  Equipe 1  ', '  06:00  ', '  01:00  ', '', '  disponível  ']]
    const res = converterTabelaTempoDisponivel(tabela)
    expect(res.linhas[0].data).toBe('23/06/2026')
    expect(res.linhas[0].equipe).toBe('Equipe 1')
    expect(res.linhas[0].status).toBe('disponível')
  })

  it('14. lote de 100 linhas é convertido sem erro', () => {
    const linhas: string[][] = [CABECALHO_REAL]
    for (let i = 0; i < 100; i++) {
      linhas.push(['23/06/2026', 'Equipe 1', '06:00', '01:00', '', 'disponível'])
    }
    const res = converterTabelaTempoDisponivel(linhas)
    expect(res.linhas).toHaveLength(100)
    expect(res.linhasLidas).toBe(100)
    expect(res.linhasConvertidas).toBe(100)
  })
})
