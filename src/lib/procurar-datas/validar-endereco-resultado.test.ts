import { describe, expect, it } from 'vitest'
import { validarEnderecoProviderDireto } from './validar-endereco-resultado'
import type { EnderecoValidado, ValidarEnderecoRequest } from './contratos'

const FORM_TENENTE: ValidarEnderecoRequest = {
  logradouro: 'Rua Tenente Francisco Ferreira de Souza',
  numero: '20',
  bairro: 'Hauer',
  cidade: 'Curitiba',
  uf: 'PR',
  cep: '81630-010',
}

describe('validarEnderecoProviderDireto', () => {
  it('rejeita retorno com CEP divergente do CEP de entrada', () => {
    const resultado: EnderecoValidado = {
      lat: -25.475,
      lng: -49.255,
      enderecoCompleto: 'Rua Tenente Francisco Ferreira de Souza, Hauer, Curitiba - PR, 81670-000, Brasil',
      cep: '81670-000',
      address: {
        road: 'Rua Tenente Francisco Ferreira de Souza',
        city: 'Curitiba',
        state: 'PR',
        postcode: '81670-000',
      },
    }

    expect(validarEnderecoProviderDireto(resultado, FORM_TENENTE)).toEqual({
      ok: false,
      motivo: 'cep_mismatch',
    })
  })

  it('aceita retorno compativel mesmo sem house_number', () => {
    const resultado: EnderecoValidado = {
      lat: -25.475,
      lng: -49.255,
      enderecoCompleto: 'Rua Tenente Francisco Ferreira de Souza, Hauer, Curitiba - PR, 81630-010, Brasil',
      cep: '81630-010',
      address: {
        road: 'Rua Tenente Francisco Ferreira de Souza',
        city: 'Curitiba',
        state: 'Parana',
        postcode: '81630-010',
      },
    }

    expect(validarEnderecoProviderDireto(resultado, FORM_TENENTE)).toEqual({ ok: true })
  })

  it('rejeita retorno sem coordenadas validas', () => {
    expect(validarEnderecoProviderDireto({ lat: undefined, lng: -49.255 }, FORM_TENENTE)).toEqual({
      ok: false,
      motivo: 'coordenadas_invalidas',
    })
  })
})
