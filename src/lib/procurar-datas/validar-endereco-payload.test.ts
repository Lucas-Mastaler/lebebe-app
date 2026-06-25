import { describe, expect, it } from 'vitest'
import { validarPayloadEndereco } from './validar-endereco-payload'

describe('validarPayloadEndereco', () => {
  it('exige numero antes de qualquer consulta externa', () => {
    expect(
      validarPayloadEndereco({
        logradouro: 'Rua Fortaleza',
        numero: '',
        bairro: 'Hauer',
        cidade: 'Curitiba',
        uf: 'PR',
      })
    ).toBe('Informe logradouro, numero, bairro, cidade e UF.')
  })

  it('aceita payload completo', () => {
    expect(
      validarPayloadEndereco({
        logradouro: 'Rua Fortaleza',
        numero: '1210',
        bairro: 'Hauer',
        cidade: 'Curitiba',
        uf: 'PR',
      })
    ).toBeNull()
  })
})
