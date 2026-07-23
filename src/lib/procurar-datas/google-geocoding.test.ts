import { afterEach, describe, it, expect } from 'vitest'
import {
  consultarGoogleGeocodingEnderecoDificil,
  ehEnderecoDificilRodoviaOuRural,
  validarResultadoGoogle,
} from './google-geocoding'
import type { ValidarEnderecoRequest } from './contratos'

afterEach(() => {
  delete process.env.GOOGLE_GEOCODING_API_KEY
})

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

  it('retorna true para ROD. abreviado', () => {
    expect(
      ehEnderecoDificilRodoviaOuRural(
        formBase({ logradouro: 'ROD. GUMERCINDO BOZA', numero: '20823', bairro: 'CENTRO', cidade: 'CAMPO MAGRO', uf: 'PR' })
      )
    ).toBe(true)
  })

  it('retorna true para Rod. com mixed case', () => {
    expect(
      ehEnderecoDificilRodoviaOuRural(
        formBase({ logradouro: 'Rod. Gumercindo Boza', numero: '20823' })
      )
    ).toBe(true)
  })

  it('retorna true para ROD sem ponto', () => {
    expect(
      ehEnderecoDificilRodoviaOuRural(
        formBase({ logradouro: 'ROD GUMERCINDO BOZA', numero: '20823' })
      )
    ).toBe(true)
  })

  it('retorna true para RODOV. abreviado', () => {
    expect(
      ehEnderecoDificilRodoviaOuRural(
        formBase({ logradouro: 'RODOV. DOS MINERIOS', numero: '100' })
      )
    ).toBe(true)
  })

  it('retorna true para BR-116', () => {
    expect(
      ehEnderecoDificilRodoviaOuRural(formBase({ logradouro: 'BR-116' }))
    ).toBe(true)
  })

  it('retorna true para BR 116', () => {
    expect(
      ehEnderecoDificilRodoviaOuRural(formBase({ logradouro: 'BR 116' }))
    ).toBe(true)
  })

  it('retorna true para BR116', () => {
    expect(
      ehEnderecoDificilRodoviaOuRural(formBase({ logradouro: 'BR116' }))
    ).toBe(true)
  })

  it('retorna true para PR-090', () => {
    expect(
      ehEnderecoDificilRodoviaOuRural(formBase({ logradouro: 'PR-090', numero: '100', cidade: 'CAMPO MAGRO', uf: 'PR' }))
    ).toBe(true)
  })

  it('retorna true para PR 090', () => {
    expect(
      ehEnderecoDificilRodoviaOuRural(formBase({ logradouro: 'PR 090', numero: '100', cidade: 'CAMPO MAGRO', uf: 'PR' }))
    ).toBe(true)
  })

  it('retorna true para KM 12', () => {
    expect(
      ehEnderecoDificilRodoviaOuRural(formBase({ logradouro: 'KM 12', numero: '1' }))
    ).toBe(true)
  })

  it('retorna true para Estrada Rural', () => {
    expect(
      ehEnderecoDificilRodoviaOuRural(
        formBase({ logradouro: 'Estrada Rural', numero: '123' })
      )
    ).toBe(true)
  })

  it('retorna true para Zona Rural', () => {
    expect(
      ehEnderecoDificilRodoviaOuRural(formBase({ bairro: 'Zona Rural' }))
    ).toBe(true)
  })

  it('retorna false para Rua Rodrigues Alves', () => {
    expect(
      ehEnderecoDificilRodoviaOuRural(
        formBase({ logradouro: 'Rua Rodrigues Alves', numero: '100', bairro: 'Centro' })
      )
    ).toBe(false)
  })

  it('retorna false para Rua Rodolfo Senff', () => {
    expect(
      ehEnderecoDificilRodoviaOuRural(
        formBase({ logradouro: 'Rua Rodolfo Senff', numero: '100', bairro: 'Centro' })
      )
    ).toBe(false)
  })

  it('retorna false para Avenida Republica Argentina', () => {
    expect(
      ehEnderecoDificilRodoviaOuRural(
        formBase({ logradouro: 'Avenida Republica Argentina', numero: '100', bairro: 'Centro' })
      )
    ).toBe(false)
  })

  it('retorna false para Rua Pedro Siemens', () => {
    expect(
      ehEnderecoDificilRodoviaOuRural(
        formBase({ logradouro: 'Rua Pedro Siemens', numero: '100', bairro: 'Centro' })
      )
    ).toBe(false)
  })

  it('retorna false para endereco urbano com UF PR e numero de 3 digitos (nao confunde com rodovia estadual)', () => {
    expect(
      ehEnderecoDificilRodoviaOuRural(
        formBase({ logradouro: 'Rua XV de Novembro', numero: '100', bairro: 'Centro', cidade: 'Curitiba', uf: 'PR' })
      )
    ).toBe(false)
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

  it('aceita endereco urbano sem street_number quando CEP, logradouro, cidade e UF sao fortes', () => {
    const form = formBase({
      logradouro: 'Rua Tenente Francisco Ferreira de Souza',
      numero: '20',
      bairro: 'Hauer',
      cidade: 'Curitiba',
      uf: 'PR',
      cep: '81630-010',
    })

    const result: Parameters<typeof validarResultadoGoogle>[0] = {
      geometry: {
        location: { lat: -25.475, lng: -49.255 },
        location_type: 'ROOFTOP',
      },
      formatted_address: 'Rua Tenente Francisco Ferreira de Souza - Hauer, Curitiba - PR, 81630-010, Brasil',
      address_components: [
        { long_name: 'Rua Tenente Francisco Ferreira de Souza', short_name: 'R. Ten. Francisco Ferreira de Souza', types: ['route'] },
        { long_name: 'Hauer', short_name: 'Hauer', types: ['sublocality', 'political'] },
        { long_name: 'Curitiba', short_name: 'Curitiba', types: ['administrative_area_level_2', 'political'] },
        { long_name: 'Parana', short_name: 'PR', types: ['administrative_area_level_1', 'political'] },
        { long_name: 'Brasil', short_name: 'BR', types: ['country'] },
        { long_name: '81630-010', short_name: '81630-010', types: ['postal_code'] },
      ],
      types: ['street_address'],
      partial_match: false,
    }

    const diag = validarResultadoGoogle(result, form)

    expect(diag.valido).toBe(true)
    expect(diag.numeroObrigatorio).toBe(false)
    expect(diag.resultado?.match).toBe('aproximado_confiavel')
    expect(diag.resultado?.numeroOk).toBe(false)
  })

  it('resolve bairro por segmento do formatted_address quando sublocality e termo generico', () => {
    const form = formBase({
      logradouro: 'Rua Cornelius Pries',
      numero: '100',
      bairro: 'Xaxim',
      cidade: 'Curitiba',
      uf: 'PR',
      cep: '81830-020',
    })

    const result: Parameters<typeof validarResultadoGoogle>[0] = {
      geometry: {
        location: { lat: -25.50907, lng: -49.26718 },
        location_type: 'ROOFTOP',
      },
      formatted_address: 'Rua Cornelius Pries - Casa, Xaxim, Curitiba - PR, 81830-020, Brasil',
      address_components: [
        { long_name: 'Rua Cornelius Pries', short_name: 'R. Cornelius Pries', types: ['route'] },
        { long_name: 'Casa', short_name: 'Casa', types: ['sublocality', 'political'] },
        { long_name: 'Curitiba', short_name: 'Curitiba', types: ['administrative_area_level_2', 'political'] },
        { long_name: 'Parana', short_name: 'PR', types: ['administrative_area_level_1', 'political'] },
        { long_name: 'Brasil', short_name: 'BR', types: ['country'] },
        { long_name: '81830-020', short_name: '81830-020', types: ['postal_code'] },
      ],
      types: ['street_address'],
      partial_match: false,
    }

    const diag = validarResultadoGoogle(result, form)

    expect(diag.valido).toBe(true)
    expect(diag.bairroOk).toBe(true)
    expect(diag.bairroRecebido).toBe('Xaxim')
    expect((diag.resultado?.address as { suburb?: string } | undefined)?.suburb).toBe('Xaxim')
  })

  it('nao devolve Casa como bairro confirmado quando Google tem apenas termo generico', () => {
    const form = formBase({
      logradouro: 'Rua Cornelius Pries',
      numero: '100',
      bairro: 'Xaxim',
      cidade: 'Curitiba',
      uf: 'PR',
      cep: '81830-020',
    })

    const result: Parameters<typeof validarResultadoGoogle>[0] = {
      geometry: {
        location: { lat: -25.50907, lng: -49.26718 },
        location_type: 'ROOFTOP',
      },
      formatted_address: 'Rua Cornelius Pries - Casa, Curitiba - PR, 81830-020, Brasil',
      address_components: [
        { long_name: 'Rua Cornelius Pries', short_name: 'R. Cornelius Pries', types: ['route'] },
        { long_name: 'Casa', short_name: 'Casa', types: ['sublocality', 'political'] },
        { long_name: 'Curitiba', short_name: 'Curitiba', types: ['administrative_area_level_2', 'political'] },
        { long_name: 'Parana', short_name: 'PR', types: ['administrative_area_level_1', 'political'] },
        { long_name: 'Brasil', short_name: 'BR', types: ['country'] },
        { long_name: '81830-020', short_name: '81830-020', types: ['postal_code'] },
      ],
      types: ['street_address'],
      partial_match: false,
    }

    const diag = validarResultadoGoogle(result, form)

    expect(diag.valido).toBe(true)
    expect(diag.bairroOk).toBe(true)
    expect(diag.bairroRecebido).toBe('')
    expect((diag.resultado?.address as { suburb?: string } | undefined)?.suburb).toBe('')
  })

  it('prioriza cep_mismatch sobre numero ausente no Google', () => {
    const form = formBase({
      logradouro: 'Rua Tenente Francisco Ferreira de Souza',
      numero: '20',
      bairro: 'Hauer',
      cidade: 'Curitiba',
      uf: 'PR',
      cep: '81630-010',
    })

    const result: Parameters<typeof validarResultadoGoogle>[0] = {
      geometry: {
        location: { lat: -25.475, lng: -49.255 },
        location_type: 'ROOFTOP',
      },
      formatted_address: 'Rua Tenente Francisco Ferreira de Souza - Hauer, Curitiba - PR, 81670-000, Brasil',
      address_components: [
        { long_name: 'Rua Tenente Francisco Ferreira de Souza', short_name: 'R. Ten. Francisco Ferreira de Souza', types: ['route'] },
        { long_name: 'Hauer', short_name: 'Hauer', types: ['sublocality', 'political'] },
        { long_name: 'Curitiba', short_name: 'Curitiba', types: ['administrative_area_level_2', 'political'] },
        { long_name: 'Parana', short_name: 'PR', types: ['administrative_area_level_1', 'political'] },
        { long_name: 'Brasil', short_name: 'BR', types: ['country'] },
        { long_name: '81670-000', short_name: '81670-000', types: ['postal_code'] },
      ],
      types: ['street_address'],
      partial_match: false,
    }

    const diag = validarResultadoGoogle(result, form)

    expect(diag.valido).toBe(false)
    expect(diag.motivo).toBe('cep_mismatch')
  })
})

describe('consultarGoogleGeocodingEnderecoDificil', () => {
  it('mantem skip para endereco comum por padrao', async () => {
    const result = await consultarGoogleGeocodingEnderecoDificil(
      formBase({ logradouro: 'Rua XV de Novembro', numero: '100', cidade: 'Curitiba', uf: 'PR' }),
      { fetchFn: (() => { throw new Error('nao deveria chamar') }) as unknown as typeof fetch }
    )

    expect(result).toEqual({ status: 'skipped', motivo: 'endereco_nao_e_dificil' })
  })

  it('permite Google como fallback geral para endereco comum quando a rota habilita', async () => {
    process.env.GOOGLE_GEOCODING_API_KEY = 'test-key'

    const fetchFn = (async () => ({
      ok: true,
      json: async () => ({
        status: 'OK',
        results: [
          {
            geometry: {
              location: { lat: -25.475, lng: -49.255 },
              location_type: 'ROOFTOP',
            },
            formatted_address: 'Rua XV de Novembro, 100 - Centro, Curitiba - PR, 80020-310, Brasil',
            address_components: [
              { long_name: '100', short_name: '100', types: ['street_number'] },
              { long_name: 'Rua XV de Novembro', short_name: 'R. XV de Novembro', types: ['route'] },
              { long_name: 'Centro', short_name: 'Centro', types: ['sublocality', 'political'] },
              { long_name: 'Curitiba', short_name: 'Curitiba', types: ['administrative_area_level_2', 'political'] },
              { long_name: 'Parana', short_name: 'PR', types: ['administrative_area_level_1', 'political'] },
              { long_name: 'Brasil', short_name: 'BR', types: ['country'] },
              { long_name: '80020-310', short_name: '80020-310', types: ['postal_code'] },
            ],
            types: ['street_address'],
            partial_match: false,
          },
        ],
      }),
    })) as unknown as typeof fetch

    const result = await consultarGoogleGeocodingEnderecoDificil(
      formBase({
        logradouro: 'Rua XV de Novembro',
        numero: '100',
        bairro: 'Centro',
        cidade: 'Curitiba',
        uf: 'PR',
        cep: '80020-310',
      }),
      { fetchFn, permitirEnderecoComum: true }
    )

    expect(result.status).toBe('success')
  })
})
