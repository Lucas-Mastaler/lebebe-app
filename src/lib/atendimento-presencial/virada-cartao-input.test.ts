import { describe, expect, it } from 'vitest'
import { converterViradaCartaoInput } from './ficha-schema'
import { prepararViradaCartaoInput, validarViradaCartaoInput, VIRADA_CARTAO_OBRIGATORIA } from './virada-cartao-input'

describe('entrada da virada do cartão na ficha e na edição', () => {
  it.each(['00', '32', '99', '05/00', '05/13', '05/20', '05/99', '05/2026'])('rejeita %s antes de alterar o valor do formulário', (entrada) => {
    expect(prepararViradaCartaoInput(entrada).erro).toBeTruthy()
  })

  it.each(['', '0', '05', '05/0', '05/1'])('permite preencher e apagar parcialmente: %s', (entrada) => {
    expect(prepararViradaCartaoInput(entrada)).toEqual({ valor: entrada })
  })

  it.each(['01/01', '31/12', '29/02', '30/04', '05/08'])('aceita %s e mantém o contrato numérico', (entrada) => {
    expect(prepararViradaCartaoInput(entrada)).toEqual({ valor: entrada })
    expect(validarViradaCartaoInput(entrada)).toBeUndefined()
    expect(converterViradaCartaoInput(entrada)).not.toBeNull()
  })

  it.each(['31/04', '30/02', '31/06', '05/13'])('explica que %s é uma data inválida', (entrada) => {
    expect(validarViradaCartaoInput(entrada)).toContain('Data inválida')
  })

  it('distingue campo vazio, incompleto e inválido, e limpa o erro ao corrigir', () => {
    expect(validarViradaCartaoInput('')).toBe(VIRADA_CARTAO_OBRIGATORIA)
    expect(validarViradaCartaoInput('05/0')).toContain('Complete')
    expect(validarViradaCartaoInput('31/04')).toContain('Data inválida')
    expect(validarViradaCartaoInput('30/04')).toBeUndefined()
  })

  it('não substitui uma data válida por uma entrada rejeitada', () => {
    let valor = '05/08'
    for (const tentativa of ['32/08', '05/13', '05/2026']) {
      const resultado = prepararViradaCartaoInput(tentativa)
      if (!resultado.erro) valor = resultado.valor
      expect(valor).toBe('05/08')
    }
  })
})
