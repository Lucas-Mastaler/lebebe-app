import { describe, expect, it } from 'vitest'
import {
  aplicarMascaraTelefoneBR,
  formatarTelefone,
  mascararTelefoneParaLog,
  normalizarTelefone,
  validarTelefone,
} from './telefone'

describe('telefone atendimento presencial', () => {
  it('normaliza telefone celular formatado sem alterar o nono digito', () => {
    const result = normalizarTelefone('(41) 98414-8660')

    expect(result.valido).toBe(true)
    expect(result.telefoneNormalizado).toBe('41984148660')
    expect(result.telefoneNormalizadoDDI).toBe('5541984148660')
  })

  it('normaliza telefone com DDI 55', () => {
    const result = normalizarTelefone('+55 (41) 98414-8660')

    expect(result.valido).toBe(true)
    expect(result.telefoneNormalizado).toBe('41984148660')
    expect(result.telefoneNormalizadoDDI).toBe('5541984148660')
  })

  it('aceita telefone fixo brasileiro plausivel', () => {
    const result = normalizarTelefone('41 3333-4444')

    expect(result.valido).toBe(true)
    expect(result.telefoneNormalizado).toBe('4133334444')
  })

  it('rejeita vazio, poucos digitos e digitos em excesso', () => {
    expect(normalizarTelefone('').motivoInvalido).toBe('telefone_vazio')
    expect(normalizarTelefone(null).motivoInvalido).toBe('telefone_vazio')
    expect(normalizarTelefone('12345').motivoInvalido).toBe('digitos_insuficientes')
    expect(normalizarTelefone('554198414866099').motivoInvalido).toBe('digitos_excedentes')
  })

  it('remove caracteres invalidos sem aceitar quantidade invalida', () => {
    const result = normalizarTelefone('abc (41) 98414-8660 ramal 12')

    expect(result.valido).toBe(false)
    expect(result.motivoInvalido).toBe('digitos_excedentes')
  })

  it('formata telefone nacional para exibicao', () => {
    expect(formatarTelefone('41984148660')).toBe('(41) 98414-8660')
    expect(formatarTelefone('4133334444')).toBe('(41) 3333-4444')
  })

  it('valida telefone e mascara para logs', () => {
    expect(validarTelefone('41984148660')).toBe(true)
    expect(mascararTelefoneParaLog('(41) 98414-8660')).toBe('***8660')
    expect(mascararTelefoneParaLog(null)).toBe('telefone_ausente')
  })

  it('aplica mascara visual para telefone fixo com 10 digitos', () => {
    expect(aplicarMascaraTelefoneBR('4133334444')).toBe('(41) 3333-4444')
  })

  it('aplica mascara visual para celular com 11 digitos', () => {
    expect(aplicarMascaraTelefoneBR('41999628888')).toBe('(41) 99962-8888')
  })

  it('aplica mascara progressiva durante digitacao', () => {
    expect(aplicarMascaraTelefoneBR('4')).toBe('(4')
    expect(aplicarMascaraTelefoneBR('41')).toBe('(41')
    expect(aplicarMascaraTelefoneBR('419')).toBe('(41) 9')
    expect(aplicarMascaraTelefoneBR('41996428707')).toBe('(41) 99642-8707')
  })

  it('aceita colagem formatada e com DDI exibindo formato nacional', () => {
    expect(aplicarMascaraTelefoneBR('(41) 99642-8707')).toBe('(41) 99642-8707')
    expect(aplicarMascaraTelefoneBR('+55 (41) 99642-8707')).toBe('(41) 99642-8707')
  })

  it('remove caracteres invalidos e limita excesso de digitos', () => {
    expect(aplicarMascaraTelefoneBR('abc +55 (41) 99642-8707 ramal 123')).toBe('(41) 99642-8707')
  })

  it('mantem campo vazio e permite apagamento', () => {
    expect(aplicarMascaraTelefoneBR('')).toBe('')
    expect(aplicarMascaraTelefoneBR(null)).toBe('')
  })
})
