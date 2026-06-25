import { describe, expect, it } from 'vitest'
import {
  calcularTempoServicoMinutos,
  formatarMinutosParaHHMM,
  normalizarOpcaoTempoServico,
} from './tempo-servico'

describe('tempo-servico', () => {
  it('retorna 0 para nenhum item selecionado e formata 00:00', () => {
    const minutos = calcularTempoServicoMinutos({})
    expect(minutos).toBe(0)
    expect(formatarMinutosParaHHMM(minutos)).toBe('00:00')
  })

  it('calcula roupeiros sozinhos', () => {
    expect(calcularTempoServicoMinutos({ roupeiro: '4 PTS (DIVERSOS)' })).toBe(120)
    expect(formatarMinutosParaHHMM(120)).toBe('02:00')

    expect(calcularTempoServicoMinutos({ roupeiro: '2 PTS' })).toBe(100)
    expect(formatarMinutosParaHHMM(100)).toBe('01:40')

    expect(calcularTempoServicoMinutos({ roupeiro: '3 PTS' })).toBe(100)
    expect(formatarMinutosParaHHMM(100)).toBe('01:40')
  })

  it('calcula comoda sozinha', () => {
    expect(calcularTempoServicoMinutos({ comoda: 'SIM' })).toBe(50)
    expect(calcularTempoServicoMinutos({ comoda: '2 COMODAS' })).toBe(105)
    expect(calcularTempoServicoMinutos({ comoda: '2 C\u00d4MODAS' })).toBe(105)
  })

  it('calcula berco/cama sozinho', () => {
    expect(calcularTempoServicoMinutos({ berco: 'DIVERSOS' })).toBe(40)
    expect(calcularTempoServicoMinutos({ berco: 'FORMARE' })).toBe(90)
    expect(calcularTempoServicoMinutos({ berco: 'MAXX' })).toBe(75)
    expect(calcularTempoServicoMinutos({ berco: '2 CAMAS' })).toBe(75)
  })

  it('calcula painel com modulos', () => {
    expect(calcularTempoServicoMinutos({ painel: '1 PAINEL E 2 MODULOS' })).toBe(180)
    expect(calcularTempoServicoMinutos({ painel: '2 PAINEIS E 1 MODULO' })).toBe(240)
    expect(calcularTempoServicoMinutos({ painel: '2 PAIN\u00c9IS E 1 M\u00d3DULO' })).toBe(240)
  })

  it('calcula poltronas sozinhas ou como adicional', () => {
    expect(calcularTempoServicoMinutos({ poltrona: '2 POLTRONAS' })).toBe(45)
    expect(calcularTempoServicoMinutos({ roupeiro: '4 PTS (DIVERSOS)', poltrona: '2 POLTRONAS' })).toBe(135)
  })

  it('aplica +30 real do codigo legado em quarto completo com roupeiro comum', () => {
    // DIVERSOS 40 + COMODA 50 + ROUPEIRO_4 120 + acrescimo real 30 - desconto 60 = 180.
    expect(calcularTempoServicoMinutos({ berco: 'DIVERSOS', comoda: 'SIM', roupeiro: '4 PTS (DIVERSOS)' })).toBe(180)
  })

  it('nao aplica +30 em FORMARE/MAXX + comoda + roupeiro tutto/provence', () => {
    // FORMARE 90 + COMODA 50 + TUTTO 150 - desconto 75 = 215.
    expect(calcularTempoServicoMinutos({ berco: 'FORMARE', comoda: 'SIM', roupeiro: '4 PTS (TUTTO)' })).toBe(215)

    // MAXX 75 + COMODA 50 + DESLIZANTE_TUTTO 135 - desconto 75 = 185.
    expect(calcularTempoServicoMinutos({ berco: 'MAXX', comoda: 'SIM', roupeiro: 'DESLIZANTE TUTTO' })).toBe(185)
  })

  it('normaliza valores vazios e marcadores sem selecao', () => {
    expect(normalizarOpcaoTempoServico('N\u00c3O')).toBe('')
    expect(normalizarOpcaoTempoServico('NAO')).toBe('')
    expect(normalizarOpcaoTempoServico('N\u00c3\u0192O')).toBe('')
    expect(normalizarOpcaoTempoServico('Selecione')).toBe('')
    expect(normalizarOpcaoTempoServico(null)).toBe('')
    expect(normalizarOpcaoTempoServico(undefined)).toBe('')

    expect(calcularTempoServicoMinutos({
      berco: 'N\u00c3O',
      comoda: 'Selecione',
      roupeiro: null,
      poltrona: undefined,
      painel: '',
    })).toBe(0)
  })
})
