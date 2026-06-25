import { describe, it, expect } from 'vitest'
import { ehEnderecoDificilRodoviaOuRural, validarResultadoGoogle } from './google-geocoding'
import type { ValidarEnderecoRequest } from './contratos'

function formBase(overrides: Partial<ValidarEnderecoRequest> = {}): ValidarEnderecoRequest {
  return {
    logradouro: '',
    numero: '',
    bairro: '',
    cidade: '',
    uf: '',
    cep: '',
    ...overrides,
  }
}

describe('ehEnderecoDificilRodoviaOuRural', () => {
  it('retorna true para BR com numero', () => {
    expect(
      ehEnderecoDificilRodoviaOuRural(formBase({ logradouro: 'BR-116', numero: 'KM 102' }))
    ).toBe(true)
  })

  it('retorna true para BR com espaco e KM', () => {
    expect(
      ehEnderecoDificilRodoviaOuRural(formBase({ logradouro: 'BR 277', numero: 'KM 80' }))
    ).toBe(true)
  })

  it('retorna true para Rodovia com KM', () => {
    expect(
      ehEnderecoDificilRodoviaOuRural(
        formBase({ logradouro: 'Rodovia Régis Bittencourt', numero: 'KM 115' })
      )
    ).toBe(true)
  })

  it('retorna true para Estrada Rural', () => {
    expect(
      ehEnderecoDificilRodoviaOuRural(
        formBase({ logradouro: 'Estrada Rural', numero: '123', bairro: 'Zona Rural' })
      )
    ).toBe(true)
  })

  it('retorna true para Zona Rural', () => {
    expect(
      ehEnderecoDificilRodoviaOuRural(formBase({ bairro: 'Zona Rural' }))
    ).toBe(true)
  })

  it('retorna false para rua urbana comum', () => {
    expect(
      ehEnderecoDificilRodoviaOuRural(
        formBase({ logradouro: 'Rua XV de Novembro', numero: '100', bairro: 'Centro' })
      )
    ).toBe(false)
  })

  it('retorna false para avenida urbana comum', () => {
    expect(
      ehEnderecoDificilRodoviaOuRural(
        formBase({
          logradouro: 'Avenida Marechal Floriano Peixoto',
          numero: '5865',
          bairro: 'Hauer',
        })
      )
    ).toBe(false)
  })

  it('retorna false para rua residencial comum', () => {
    expect(
      ehEnderecoDificilRodoviaOuRural(
        formBase({ logradouro: 'Rua Nicola Pelanda', numero: '100', bairro: 'Umbara' })
      )
    ).toBe(false)
  })

  it('retorna false para endereco vazio', () => {
    expect(ehEnderecoDificilRodoviaOuRural(formBase())).toBe(false)
  })
})

describe('validarResultadoGoogle', () => {
  it('aceita resultado forte de BR/Rodovia com cidade no formatted_address', () => {
    const form = formBase({
      logradouro: 'RODOVIA BR-116',
      numero: '15480',
      bairro: 'XAXIM',
      cidade: 'CURITIBA',
      uf: 'PR',
      cep: '81690-200',
    })

    const result: Parameters<typeof validarResultadoGoogle>[0] = {
      geometry: {
        location: { lat: -25.4914322, lng: -49.2730973 },
        location_type: 'ROOFTOP',
      },
      formatted_address: 'BR-116, 15480 - Fanny, Curitiba - PR, 81690-200, Brasil',
      address_components: [
        { long_name: '15480', short_name: '15480', types: ['street_number'] },
        { long_name: 'BR-116', short_name: 'BR-116', types: ['route'] },
        { long_name: 'Fanny', short_name: 'Fanny', types: ['sublocality', 'political'] },
        { long_name: 'Curitiba', short_name: 'Curitiba', types: ['administrative_area_level_2', 'political'] },
        { long_name: 'Paraná', short_name: 'PR', types: ['administrative_area_level_1', 'political'] },
        { long_name: 'Brasil', short_name: 'BR', types: ['country'] },
        { long_name: '81690-200', short_name: '81690-200', types: ['postal_code'] },
      ],
      types: ['street_address'],
      partial_match: false,
      place_id: 'ChIJ1234567890',
    }

    const diag = validarResultadoGoogle(result, form)

    expect(diag.valido).toBe(true)
    expect(diag.cidadeOk).toBe(true)
    expect(diag.formattedCityMatch).toBe(true)
    expect(diag.cidadeSource).toBe('administrative_area_level_2')
    expect(diag.ufOk).toBe(true)
    expect(diag.logradouroOk).toBe(true)
    expect(diag.numeroOk).toBe(true)
    expect(diag.cepOk).toBe(true)
    expect(diag.bairroOk).toBe(true)
  })

  it('aceita endereco dificil quando sublocality e bairro mas cidade vem de formatted_address', () => {
    const form = formBase({
      logradouro: 'RODOVIA BR-116',
      numero: '15480',
      bairro: 'XAXIM',
      cidade: 'CURITIBA',
      uf: 'PR',
      cep: '81690200',
    })

    const result: Parameters<typeof validarResultadoGoogle>[0] = {
      geometry: {
        location: { lat: -25.4914322, lng: -49.2730973 },
        location_type: 'ROOFTOP',
      },
      formatted_address: 'BR-116, 15480 - Fanny, Curitiba - PR, 81690-200, Brasil',
      address_components: [
        { long_name: '15480', short_name: '15480', types: ['street_number'] },
        { long_name: 'BR-116', short_name: 'BR-116', types: ['route'] },
        { long_name: 'Fanny', short_name: 'Fanny', types: ['sublocality', 'political'] },
        { long_name: 'Fanny', short_name: 'Fanny', types: ['locality', 'political'] },
        { long_name: 'Curitiba', short_name: 'Curitiba', types: ['administrative_area_level_2', 'political'] },
        { long_name: 'Paraná', short_name: 'PR', types: ['administrative_area_level_1', 'political'] },
        { long_name: 'Brasil', short_name: 'BR', types: ['country'] },
        { long_name: '81690-200', short_name: '81690-200', types: ['postal_code'] },
      ],
      types: ['street_address'],
      partial_match: false,
      place_id: 'ChIJ1234567890',
    }

    const diag = validarResultadoGoogle(result, form)

    expect(diag.valido).toBe(true)
    expect(diag.cidadeOk).toBe(true)
    expect(diag.bairroOk).toBe(true)
  })

  it('rejeita cidade incompativel quando nao ha combinacao forte', () => {
    const form = formBase({
      logradouro: 'RODOVIA BR-116',
      numero: '15480',
      cidade: 'SAO PAULO',
      uf: 'PR',
      cep: '81690200',
    })

    const result: Parameters<typeof validarResultadoGoogle>[0] = {
      geometry: {
        location: { lat: -25.4914322, lng: -49.2730973 },
        location_type: 'ROOFTOP',
      },
      formatted_address: 'BR-116, 15480 - Fanny, Curitiba - PR, 81690-200, Brasil',
      address_components: [
        { long_name: '15480', short_name: '15480', types: ['street_number'] },
        { long_name: 'BR-116', short_name: 'BR-116', types: ['route'] },
        { long_name: 'Fanny', short_name: 'Fanny', types: ['sublocality', 'political'] },
        { long_name: 'Curitiba', short_name: 'Curitiba', types: ['administrative_area_level_2', 'political'] },
        { long_name: 'Paraná', short_name: 'PR', types: ['administrative_area_level_1', 'political'] },
        { long_name: 'Brasil', short_name: 'BR', types: ['country'] },
        { long_name: '81690-200', short_name: '81690-200', types: ['postal_code'] },
      ],
      types: ['street_address'],
      partial_match: false,
    }

    const diag = validarResultadoGoogle(result, form)

    expect(diag.valido).toBe(false)
    expect(diag.motivo).toBe('cidade_incompativel')
  })
})
