import { describe, expect, it } from 'vitest'
import { operacaoHubVendasPrecisaAtencao, type SinaisEstadoOperacionalHubVendas } from './estado-operacional'

const semProblema: SinaisEstadoOperacionalHubVendas = {
  automacaoPausada: false,
  errosPendentes: 0,
  resultadoIncerto: 0,
  analiseManual: 0,
  conexoesPausadas: 0,
}

describe('estado operacional Hub/Vendas', () => {
  it('permanece saudavel com resumo diario ou teste, porque esses avisos nao sao sinais', () => {
    expect(operacaoHubVendasPrecisaAtencao(semProblema)).toBe(false)
  })

  it('pede atencao quando ha erro de fila ainda pendente, mesmo que nao seja de hoje', () => {
    expect(operacaoHubVendasPrecisaAtencao({ ...semProblema, errosPendentes: 1 })).toBe(true)
  })

  it('pede atencao quando ha resultado de envio incerto', () => {
    expect(operacaoHubVendasPrecisaAtencao({ ...semProblema, resultadoIncerto: 2 })).toBe(true)
  })

  it('pede atencao quando ha fila em analise manual', () => {
    expect(operacaoHubVendasPrecisaAtencao({ ...semProblema, analiseManual: 1 })).toBe(true)
  })

  it('pede atencao quando uma loja esta pausada', () => {
    expect(operacaoHubVendasPrecisaAtencao({ ...semProblema, conexoesPausadas: 1 })).toBe(true)
  })

  it('pede atencao quando a automacao esta pausada', () => {
    expect(operacaoHubVendasPrecisaAtencao({ ...semProblema, automacaoPausada: true })).toBe(true)
  })
})
