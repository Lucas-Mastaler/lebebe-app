import { describe, expect, it } from 'vitest'
import { computeFieldError, initialFieldValidationState, onBlurTouched, requiredSuffix } from './validation'

const validateEmail = (v: string) => (/.+@.+\..+/.test(v) ? '' : 'Informe um e-mail válido.')

describe('computeFieldError (VAL=C — progressiva)', () => {
  it('nunca mostra erro antes do campo ser tocado', () => {
    expect(computeFieldError(initialFieldValidationState, '', validateEmail)).toBe('')
    expect(computeFieldError(initialFieldValidationState, 'invalido', validateEmail)).toBe('')
  })

  it('mostra erro após blur se o valor for inválido', () => {
    const touched = onBlurTouched()
    expect(computeFieldError(touched, 'invalido', validateEmail)).toBe('Informe um e-mail válido.')
  })

  it('erro some em tempo real assim que o valor fica válido, sem precisar de novo blur', () => {
    const touched = onBlurTouched()
    expect(computeFieldError(touched, 'a@b.com', validateEmail)).toBe('')
  })
})

describe('requiredSuffix (REQ=C — os dois marcados)', () => {
  it('obrigatório sempre leva *', () => {
    expect(requiredSuffix(true)).toEqual({ text: ' *', kind: 'required' })
  })

  it('opcional sempre leva (opcional)', () => {
    expect(requiredSuffix(false)).toEqual({ text: ' (opcional)', kind: 'optional' })
  })
})
