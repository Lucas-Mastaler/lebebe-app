import { describe, expect, it } from 'vitest'
import {
  ALIASES_BAIRROS_CURITIBA,
  ALIASES_MUNICIPIOS_RMC,
  BAIRROS_CURITIBA,
  METADADOS_BAIRROS_CURITIBA,
  METADADOS_MUNICIPIOS_RMC,
  MUNICIPIOS_RMC,
  normalizarComponenteGeografico,
  resolverBairroCuritibaCanonico,
  resolverMunicipioRmcCanonico,
  validarVocabularioGeografico,
} from './vocabulario-geografico'
import { resolverBairroGeografico, resolverMunicipioGeografico } from './resolver-componente-geografico'

describe('vocabulario geografico local', () => {
  it('mantem exatamente 75 bairros oficiais unicos de Curitiba', () => {
    const validacao = validarVocabularioGeografico()
    expect(METADADOS_BAIRROS_CURITIBA.quantidadeEsperada).toBe(75)
    expect(BAIRROS_CURITIBA).toHaveLength(75)
    expect(validacao.bairrosUnicos).toBe(75)
  })

  it('mantem exatamente 29 municipios unicos da RMC', () => {
    const validacao = validarVocabularioGeografico()
    expect(METADADOS_MUNICIPIOS_RMC.quantidadeEsperada).toBe(29)
    expect(MUNICIPIOS_RMC).toHaveLength(29)
    expect(validacao.municipiosUnicos).toBe(29)
  })

  it('nao permite aliases colididos', () => {
    expect(validarVocabularioGeografico().aliasesColididos).toEqual([])
  })

  it('todos os canonicos retornam sua grafia oficial', () => {
    for (const bairro of BAIRROS_CURITIBA) {
      expect(resolverBairroCuritibaCanonico(bairro)).toBe(bairro)
    }
    for (const municipio of MUNICIPIOS_RMC) {
      expect(resolverMunicipioRmcCanonico(municipio)).toBe(municipio)
    }
  })

  it('acentos caixa espacos e pontuacao simples nao impedem comparacao', () => {
    expect(resolverBairroCuritibaCanonico('  agua   verde. ')).toBe('Água Verde')
    expect(resolverBairroCuritibaCanonico('sitio cercado')).toBe('Sítio Cercado')
    expect(resolverMunicipioRmcCanonico('Sao Jose dos Pinhais')).toBe('São José dos Pinhais')
    expect(resolverMunicipioRmcCanonico('Itaperucu')).toBe('Itaperuçu')
    expect(resolverMunicipioRmcCanonico('Bocaiuva do Sul')).toBe('Bocaiúva do Sul')
    expect(resolverMunicipioRmcCanonico('Pien')).toBe('Piên')
    expect(resolverMunicipioRmcCanonico('Araucaria')).toBe('Araucária')
  })

  it('aliases controlados resolvem para canonicos sem criar novos itens', () => {
    expect(Object.values(ALIASES_BAIRROS_CURITIBA).every((v) => BAIRROS_CURITIBA.includes(v as (typeof BAIRROS_CURITIBA)[number]))).toBe(true)
    expect(Object.values(ALIASES_MUNICIPIOS_RMC).every((v) => MUNICIPIOS_RMC.includes(v as (typeof MUNICIPIOS_RMC)[number]))).toBe(true)
    expect(resolverBairroCuritibaCanonico('CIC')).toBe('Cidade Industrial')
    expect(resolverBairroCuritibaCanonico('Alto da Rua XV')).toBe('Alto da XV')
    expect(resolverBairroCuritibaCanonico('Vila Isabel')).toBe('Vila Izabel')
    expect(resolverMunicipioRmcCanonico('Dr. Ulysses')).toBe('Doutor Ulysses')
  })
})

describe('resolverBairroGeografico', () => {
  it('caso real: suburb Casa e neighbourhood Xaxim resolve Xaxim sem divergencia', () => {
    const r = resolverBairroGeografico({
      bairroEsperado: 'Xaxim',
      address: { suburb: 'Casa', neighbourhood: 'Xaxim' },
      displayName: 'Rua Cornelius Pries, Casa, Xaxim, Curitiba, Paraná, Brasil',
    })
    expect(r.valorCanonico).toBe('Xaxim')
    expect(r.origem).toBe('neighbourhood')
    expect(r.matchEsperado).toBe(true)
    expect(r.divergenciaReal).toBe(false)
    expect(r.termoGenerico).toBe(false)
  })

  it('usa bairro do display quando aparece como segmento completo', () => {
    const r = resolverBairroGeografico({
      bairroEsperado: 'Xaxim',
      address: { suburb: 'Casa' },
      displayName: 'Rua Cornelius Pries, Casa, Xaxim, Curitiba, Paraná, Brasil',
    })
    expect(r.valorCanonico).toBe('Xaxim')
    expect(r.origem).toBe('display_name')
    expect(r.divergenciaReal).toBe(false)
  })

  it('somente termo generico fica indeterminado e nao inventa o bairro esperado', () => {
    const r = resolverBairroGeografico({
      bairroEsperado: 'Xaxim',
      address: { suburb: 'Casa' },
      displayName: 'Rua Cornelius Pries, Casa, Curitiba, Paraná, Brasil',
    })
    expect(r.valorCanonico).toBeNull()
    expect(r.indeterminado).toBe(true)
    expect(r.termoGenerico).toBe(true)
    expect(r.divergenciaReal).toBe(false)
  })

  it('divergencia verdadeira continua sendo divergencia', () => {
    const r = resolverBairroGeografico({
      bairroEsperado: 'Xaxim',
      address: { suburb: 'Centro' },
      displayName: 'Rua XV de Novembro, Centro, Curitiba, Paraná, Brasil',
    })
    expect(r.valorCanonico).toBe('Centro')
    expect(r.divergenciaReal).toBe(true)
  })

  it('provider sem bairro confiavel nao alerta', () => {
    const r = resolverBairroGeografico({
      bairroEsperado: 'Xaxim',
      address: {},
      displayName: 'Rua Cornelius Pries, Curitiba, Paraná, Brasil',
    })
    expect(r.valorCanonico).toBeNull()
    expect(r.indeterminado).toBe(true)
    expect(r.divergenciaReal).toBe(false)
  })

  it('bairro esperado prevalece quando outro campo contem bairro diferente', () => {
    const r = resolverBairroGeografico({
      bairroEsperado: 'Xaxim',
      address: { suburb: 'Casa', neighbourhood: 'Xaxim', city_district: 'Boqueirão' },
    })
    expect(r.valorCanonico).toBe('Xaxim')
    expect(r.matchEsperado).toBe(true)
    expect(r.ambiguo).toBe(false)
  })

  it('dois bairros oficiais sem match esperado ficam ambiguos', () => {
    const r = resolverBairroGeografico({
      bairroEsperado: 'Hauer',
      address: { neighbourhood: 'Xaxim', city_district: 'Boqueirão' },
    })
    expect(r.valorCanonico).toBeNull()
    expect(r.ambiguo).toBe(true)
    expect(r.divergenciaReal).toBe(false)
  })

  it('preserva aliases e nao descarta Sitio Cercado como generico', () => {
    expect(resolverBairroGeografico({ bairroEsperado: 'Cidade Industrial', address: { suburb: 'CIC' } }).valorCanonico).toBe('Cidade Industrial')
    expect(resolverBairroGeografico({ bairroEsperado: 'Alto da XV', address: { suburb: 'Alto da Rua XV' } }).divergenciaReal).toBe(false)
    expect(resolverBairroGeografico({ bairroEsperado: 'Vila Izabel', address: { suburb: 'Vila Isabel' } }).divergenciaReal).toBe(false)
    const sitio = resolverBairroGeografico({ bairroEsperado: 'Sítio Cercado', address: { suburb: 'Sítio Cercado' } })
    expect(sitio.valorCanonico).toBe('Sítio Cercado')
    expect(sitio.termoGenerico).toBe(false)
  })

  it('Residencial Xaxim nao vira bairro oficial por substring', () => {
    const r = resolverBairroGeografico({ bairroEsperado: 'Xaxim', address: { suburb: 'Residencial Xaxim' } })
    expect(r.valorCanonico).toBeNull()
    expect(r.indeterminado).toBe(true)
  })
})

describe('resolverMunicipioGeografico', () => {
  it('resolve Curitiba em city, municipality e display', () => {
    expect(resolverMunicipioGeografico({ cidadeEsperada: 'Curitiba', address: { city: 'Curitiba' } }).valorCanonico).toBe('Curitiba')
    expect(resolverMunicipioGeografico({ cidadeEsperada: 'Curitiba', address: { municipality: 'Curitiba' } }).valorCanonico).toBe('Curitiba')
    expect(resolverMunicipioGeografico({ cidadeEsperada: 'Curitiba', displayName: 'Rua X, Centro, Curitiba, Paraná, Brasil' }).valorCanonico).toBe('Curitiba')
  })

  it('nao usa county estatistico como cidade se nao corresponder a municipio conhecido', () => {
    const r = resolverMunicipioGeografico({
      cidadeEsperada: 'Curitiba',
      address: { county: 'Região Geográfica Imediata de Curitiba' },
    })
    expect(r.valorCanonico).toBeNull()
    expect(r.termoNaoMunicipal).toBe(true)
    expect(r.divergenciaReal).toBe(false)
  })

  it('detecta divergencia real de municipio', () => {
    const r = resolverMunicipioGeografico({
      cidadeEsperada: 'Curitiba',
      address: { city: 'São José dos Pinhais' },
    })
    expect(r.valorCanonico).toBe('São José dos Pinhais')
    expect(r.divergenciaReal).toBe(true)
  })

  it('aceita municipio fora da RMC quando bate exatamente com esperado', () => {
    const r = resolverMunicipioGeografico({
      cidadeEsperada: 'Londrina',
      address: { city: 'Londrina' },
    })
    expect(r.valorCanonico).toBe('Londrina')
    expect(r.municipioRmc).toBe(false)
    expect(r.matchEsperado).toBe(true)
  })

  it('cidade fora da RMC divergente continua divergencia', () => {
    const r = resolverMunicipioGeografico({
      cidadeEsperada: 'Londrina',
      address: { city: 'Maringá' },
    })
    expect(r.valorCanonico).toBe('Maringá')
    expect(r.indeterminado).toBe(false)
    expect(r.divergenciaReal).toBe(true)
  })

  it('ausencia e multiplos municipios conflitantes ficam indeterminados', () => {
    expect(resolverMunicipioGeografico({ cidadeEsperada: 'Curitiba', address: {} }).indeterminado).toBe(true)
    const ambiguo = resolverMunicipioGeografico({
      cidadeEsperada: 'Lapa',
      address: { city: 'Curitiba', municipality: 'Pinhais' },
    })
    expect(ambiguo.ambiguo).toBe(true)
    expect(ambiguo.divergenciaReal).toBe(false)
  })

  it('normalizacao municipal cobre acentos e aliases controlados', () => {
    expect(normalizarComponenteGeografico(' São   José dos Pinhais. ')).toBe('SAO JOSE DOS PINHAIS')
    expect(resolverMunicipioGeografico({ cidadeEsperada: 'Pinhais', address: { city: 'Pinhais' } }).matchEsperado).toBe(true)
    expect(resolverMunicipioGeografico({ cidadeEsperada: 'Doutor Ulysses', address: { city: 'Dr. Ulysses' } }).valorCanonico).toBe('Doutor Ulysses')
  })
})
