import type { EnderecoValidado, ValidarEnderecoRequest } from './contratos'
import { normalizarCep, normalizarNumeroEndereco, normalizarTexto } from './endereco-cache'
import { calcularConfiancaInternaEndereco } from './confianca-interna'
import { resolverBairroGeografico, resolverMunicipioGeografico } from './geografia/resolver-componente-geografico'

export type GoogleGeocodingEvent =
  | { tipo: 'google_fallback_skip_not_difficult' }
  | { tipo: 'google_fallback_start' }
  | { tipo: 'google_fallback_missing_key' }
  | { tipo: 'google_fallback_success' }
  | { tipo: 'google_fallback_rejected'; motivo: string }
  | { tipo: 'google_fallback_error'; motivo: string }
  | { tipo: 'google_fallback_query'; query: string; cidade: string; uf: string; cep: string }
  | { tipo: 'google_fallback_response'; status: string; total: number; errorMessage?: string }
  | { tipo: 'google_candidate'; idx: number; motivos: string; lat: number; lng: number; formatted: string; placeId: string; locationType: string; partialMatch: boolean; route: string; streetNumber: string; bairroCandidate: string; cityCandidate: string; citySource: string; formattedCityMatch: boolean; stateCandidate: string; postcode: string; cidadeOk: boolean; ufOk: boolean; logradouroOk: boolean; numeroOk: boolean; bairroOk: boolean; cepOk: boolean }
  | { tipo: 'google_summary'; total: number; aceitos: number; rejeitados: number; motivos: string }
  | { tipo: 'google_reject_detail'; motivo: string; esperadoCidade: string; recebidoCidade: string; formatted: string; componentsResumo: string }

export type ResultadoGoogleGeocoding =
  | { status: 'success'; resultado: EnderecoValidado }
  | { status: 'failed'; motivo: string }
  | { status: 'skipped'; motivo: string }

const UF_NOMES: Record<string, string> = {
  AC: 'ACRE',
  AL: 'ALAGOAS',
  AP: 'AMAPA',
  AM: 'AMAZONAS',
  BA: 'BAHIA',
  CE: 'CEARA',
  DF: 'DISTRITO FEDERAL',
  ES: 'ESPIRITO SANTO',
  GO: 'GOIAS',
  MA: 'MARANHAO',
  MT: 'MATO GROSSO',
  MS: 'MATO GROSSO DO SUL',
  MG: 'MINAS GERAIS',
  PA: 'PARA',
  PB: 'PARAIBA',
  PR: 'PARANA',
  PE: 'PERNAMBUCO',
  PI: 'PIAUI',
  RJ: 'RIO DE JANEIRO',
  RN: 'RIO GRANDE DO NORTE',
  RS: 'RIO GRANDE DO SUL',
  RO: 'RONDONIA',
  RR: 'RORAIMA',
  SC: 'SANTA CATARINA',
  SP: 'SAO PAULO',
  SE: 'SERGIPE',
  TO: 'TOCANTINS',
}

export function ehEnderecoDificilRodoviaOuRural(form: ValidarEnderecoRequest): boolean {
  const texto = normalizarTexto(
    [
      String(form.logradouro ?? ''),
      String(form.numero ?? ''),
      String(form.bairro ?? ''),
      String(form.cidade ?? ''),
      String(form.uf ?? ''),
      String(form.cep ?? ''),
    ].join(' ')
  )

  if (texto.length === 0) return false

  const padroesRurais = [
    /\bZONA\s+RURAL\b/,
    /\bAREA\s+RURAL\b/,
  ]

  if (padroesRurais.some((p) => p.test(texto))) return true

  const padroesRodovia = [
    /\bBR\s*-?\s*\d{2,3}\b/,
    /\bBR\d{2,3}\b/,
    /\bRODOVIA\b/,
    /\bRODOV\b/,
    /\bROD\b/,
    /\bESTRADA\b/,
    /\bESTR\b/,
    /\bEST\b/,
    /\bKM\s*\d+/,
    /\bKM\b/,
    /\bQUILOMETRO\b/,
    /\bQUILOMETRO\s*\d+/,
  ]

  if (padroesRodovia.some((p) => p.test(texto))) return true

  // Rodovias estaduais (UF + numero) — apenas no logradouro para evitar falso positivo
  const logradouroNorm = normalizarTexto(String(form.logradouro ?? ''))
  const padraoRodoviaEstadual = /\b(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)[-\s]?\d{2,3}\b/

  return padraoRodoviaEstadual.test(logradouroNorm)
}

type GoogleAddressComponent = {
  long_name: string
  short_name: string
  types: string[]
}

type GoogleGeocodingResult = {
  geometry?: {
    location?: {
      lat: number
      lng: number
    }
    location_type?: 'ROOFTOP' | 'RANGE_INTERPOLATED' | 'GEOMETRIC_CENTER' | 'APPROXIMATE'
  }
  formatted_address?: string
  address_components?: GoogleAddressComponent[]
  types?: string[]
  partial_match?: boolean
  place_id?: string
}

type GoogleGeocodingResponse = {
  status?: string
  results?: GoogleGeocodingResult[]
  error_message?: string
}

function componente(
  result: GoogleGeocodingResult,
  ...tipos: string[]
): GoogleAddressComponent | undefined {
  return result.address_components?.find((c) => c.types.some((t) => tipos.includes(t)))
}

function componenteTexto(result: GoogleGeocodingResult, ...tipos: string[]): string {
  return componente(result, ...tipos)?.long_name ?? ''
}

function componenteCurto(result: GoogleGeocodingResult, ...tipos: string[]): string {
  return componente(result, ...tipos)?.short_name ?? ''
}

function componenteTextoPorTipo(result: GoogleGeocodingResult, tipo: string): string {
  return result.address_components?.find((c) => c.types.includes(tipo))?.long_name ?? ''
}

function ufCompativelGoogle(result: GoogleGeocodingResult, uf: string): boolean {
  const ufNorm = normalizarTexto(uf)
  const administrative = componenteCurto(result, 'administrative_area_level_1')
  const stateLong = componenteTexto(result, 'administrative_area_level_1')
  const stateNorm = normalizarTexto(stateLong)
  return (
    normalizarTexto(administrative) === ufNorm ||
    stateNorm === UF_NOMES[ufNorm] ||
    stateNorm === ufNorm
  )
}

function extrairCidadeDoFormatted(formatted: string): string {
  // Tenta capturar padroes comuns: "Cidade - UF" ou "Cidade, UF" ou "Cidade - Estado"
  const match = formatted.match(/,\s*([^,]+?)\s*-\s*[A-Z]{2}\s*,/i) || formatted.match(/,\s*([^,]+?)\s*,\s*(?:[A-Z]{2}|Parana|Paraná|Sao Paulo|São Paulo|Minas Gerais|Rio de Janeiro|Santa Catarina|Rio Grande do Sul|Bahia|Ceará|Ceara|Pernambuco|Goias|Goiás)\s*,/i)
  return match?.[1]?.trim() ?? ''
}

function cidadeRecebidaGoogle(result: GoogleGeocodingResult): { cidade: string; source: string } {
  const admin2 = componenteTextoPorTipo(result, 'administrative_area_level_2')
  const locality = componenteTextoPorTipo(result, 'locality')
  const formatted = extrairCidadeDoFormatted(result.formatted_address ?? '')

  if (admin2) return { cidade: admin2, source: 'administrative_area_level_2' }
  if (locality) return { cidade: locality, source: 'locality' }
  if (formatted) return { cidade: formatted, source: 'formatted_address' }
  return { cidade: '', source: 'none' }
}

function resolverMunicipioGoogle(
  result: GoogleGeocodingResult,
  cidadeEsperada: string
): { cidade: string; source: string; matchEsperado: boolean; divergenciaReal: boolean; ambiguo: boolean; indeterminado: boolean } {
  const admin2 = componenteTextoPorTipo(result, 'administrative_area_level_2')
  const locality = componenteTextoPorTipo(result, 'locality')
  const formatted = extrairCidadeDoFormatted(result.formatted_address ?? '')
  const resolucao = resolverMunicipioGeografico({
    cidadeEsperada,
    displayName: result.formatted_address,
    extras: [
      { fonte: 'administrative_area_level_2', valor: admin2 },
      { fonte: 'locality', valor: locality },
      { fonte: 'formatted_address', valor: formatted },
    ],
  })
  if (resolucao.valorCanonico) {
    return {
      cidade: resolucao.valorCanonico,
      source: resolucao.origem,
      matchEsperado: resolucao.matchEsperado,
      divergenciaReal: resolucao.divergenciaReal,
      ambiguo: resolucao.ambiguo,
      indeterminado: resolucao.indeterminado,
    }
  }
  const legado = cidadeRecebidaGoogle(result)
  return {
    cidade: legado.cidade,
    source: legado.source,
    matchEsperado: !!cidadeEsperada && normalizarTexto(legado.cidade) === normalizarTexto(cidadeEsperada),
    divergenciaReal: false,
    ambiguo: resolucao.ambiguo,
    indeterminado: resolucao.indeterminado,
  }
}

function cidadeCompativelGoogle(result: GoogleGeocodingResult, cidade: string): boolean {
  const cidadeForm = normalizarTexto(cidade)
  if (!cidadeForm) return false

  const cidadeResolvida = resolverMunicipioGoogle(result, cidade)
  if (cidadeResolvida.matchEsperado) return true
  if (cidadeResolvida.divergenciaReal) return false

  const { cidade: cidadeRecebida } = cidadeRecebidaGoogle(result)
  if (normalizarTexto(cidadeRecebida) === cidadeForm) return true

  // Fallback: nao tratar sublocality/bairro como cidade, mas verificar locality/admin2 se existirem
  const locality = componenteTextoPorTipo(result, 'locality')
  const admin2 = componenteTextoPorTipo(result, 'administrative_area_level_2')
  const formatted = extrairCidadeDoFormatted(result.formatted_address ?? '')

  return [locality, admin2, formatted].some((c) => normalizarTexto(c) === cidadeForm)
}

function paisBrasil(result: GoogleGeocodingResult): boolean {
  const pais = componenteCurto(result, 'country')
  return normalizarTexto(pais) === 'BR' || normalizarTexto(pais).includes('BRASIL')
}

function logradouroCompativelGoogle(result: GoogleGeocodingResult, form: ValidarEnderecoRequest): boolean {
  const logradouroForm = normalizarTexto(String(form.logradouro ?? ''))
  if (!logradouroForm) return false

  const formatted = normalizarTexto(result.formatted_address ?? '')
  const road = componenteTexto(result, 'route')
  const routeNorm = normalizarTexto(road)

  const tokens = logradouroForm
    .replace(/^(AV\.?|AVENIDA|R\.?|RUA|AL\.?|ALAMEDA|TRAV\.?|TRAVESSA|ROD\.?|RODOVIA|EST\.?|ESTRADA|PC\.?|PRACA|LARGO|VIA)\s+/i, '')
    .split(/\s+/)
    .filter((t) => t.length >= 3)

  if (tokens.length === 0) {
    return formatted.includes(logradouroForm) || routeNorm.includes(logradouroForm)
  }

  return tokens.some(
    (t) => formatted.includes(t) || routeNorm.includes(t)
  )
}

function enderecoTemIndicacaoKM(result: GoogleGeocodingResult): boolean {
  const formatted = normalizarTexto(result.formatted_address ?? '')
  return /\bKM\s*\d+/i.test(formatted)
}

function textoContemNumeroIsolado(texto: string, numero: string): boolean {
  if (!numero) return false
  return new RegExp(`(^|\\D)${numero}(\\D|$)`).test(texto)
}

function naoResultadoGenerico(result: GoogleGeocodingResult): boolean {
  const types = result.types ?? []
  const formatted = normalizarTexto(result.formatted_address ?? '')

  const tiposGenericos = [
    'administrative_area_level_1',
    'administrative_area_level_2',
    'administrative_area_level_3',
    'country',
    'political',
  ]

  const soTiposGenericos = types.every((t) => tiposGenericos.includes(t))
  if (soTiposGenericos) return false

  if (formatted.includes('BRASIL') && types.includes('country')) return false

  if (types.includes('administrative_area_level_1') && types.length === 1) return false

  return true
}

function montarEnderecoDisplayGoogle(result: GoogleGeocodingResult, form: ValidarEnderecoRequest): string {
  const formatted = result.formatted_address ?? ''
  if (formatted) return formatted

  const partes = [
    String(form.logradouro ?? '').trim(),
    String(form.numero ?? '').trim(),
    String(form.bairro ?? '').trim(),
    String(form.cidade ?? '').trim(),
    String(form.uf ?? '').trim(),
    'Brasil',
  ].filter(Boolean)

  return partes.join(', ')
}

type DiagnosticoValidacaoGoogle = {
  valido: boolean
  motivo?: string
  resultado?: EnderecoValidado
  cidadeOk: boolean
  ufOk: boolean
  logradouroOk: boolean
  numeroOk: boolean
  numeroObrigatorio: boolean
  bairroOk: boolean
  cepOk: boolean
  cidadeRecebida: string
  cidadeSource: string
  formattedCityMatch: boolean
  ufRecebida: string
  logradouroRecebido: string
  bairroRecebido: string
  cepRecebido: string
  locationType: 'ROOFTOP' | 'APPROXIMATE' | 'RANGE_INTERPOLATED' | 'GEOMETRIC_CENTER' | 'UNKNOWN'
  partialMatch: boolean
}

function locationTypeGoogle(result: GoogleGeocodingResult): DiagnosticoValidacaoGoogle['locationType'] {
  const type = result.geometry?.location_type
  if (type === 'ROOFTOP') return 'ROOFTOP'
  if (type === 'RANGE_INTERPOLATED') return 'RANGE_INTERPOLATED'
  if (type === 'GEOMETRIC_CENTER') return 'GEOMETRIC_CENTER'
  if (type === 'APPROXIMATE') return 'APPROXIMATE'
  return 'UNKNOWN'
}

export function validarResultadoGoogle(
  result: GoogleGeocodingResult,
  form: ValidarEnderecoRequest
): DiagnosticoValidacaoGoogle {
  const lat = result.geometry?.location?.lat
  const lng = result.geometry?.location?.lng
  const locationType = locationTypeGoogle(result)
  const partialMatch = result.partial_match ?? false
  const enderecoDificil = ehEnderecoDificilRodoviaOuRural(form)

  const baseDiag = {
    locationType,
    partialMatch,
    numeroObrigatorio: true,
  }

  if (lat === undefined || lng === undefined || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { valido: false, motivo: 'coordenada_invalida', cidadeOk: false, ufOk: false, logradouroOk: false, numeroOk: false, bairroOk: false, cepOk: false, cidadeRecebida: '', cidadeSource: 'none', formattedCityMatch: false, ufRecebida: '', logradouroRecebido: '', bairroRecebido: '', cepRecebido: '', ...baseDiag }
  }

  if (!paisBrasil(result)) {
    return { valido: false, motivo: 'pais_nao_brasil', cidadeOk: false, ufOk: false, logradouroOk: false, numeroOk: false, bairroOk: false, cepOk: false, cidadeRecebida: '', cidadeSource: 'none', formattedCityMatch: false, ufRecebida: '', logradouroRecebido: '', bairroRecebido: '', cepRecebido: '', ...baseDiag }
  }

  if (!naoResultadoGenerico(result)) {
    return { valido: false, motivo: 'resultado_generico', cidadeOk: false, ufOk: false, logradouroOk: false, numeroOk: false, bairroOk: false, cepOk: false, cidadeRecebida: '', cidadeSource: 'none', formattedCityMatch: false, ufRecebida: '', logradouroRecebido: '', bairroRecebido: '', cepRecebido: '', ...baseDiag }
  }

  const ufForm = normalizarTexto(String(form.uf ?? ''))
  const ufRecebida = componenteTexto(result, 'administrative_area_level_1') || ''
  const ufOk = !ufForm || ufCompativelGoogle(result, ufForm)
  if (!ufOk) {
    return { valido: false, motivo: 'uf_incompativel', cidadeOk: false, ufOk, logradouroOk: false, numeroOk: false, bairroOk: false, cepOk: false, cidadeRecebida: '', cidadeSource: 'none', formattedCityMatch: false, ufRecebida, logradouroRecebido: '', bairroRecebido: '', cepRecebido: '', ...baseDiag }
  }

  const cidadeForm = normalizarTexto(String(form.cidade ?? ''))
  const cidadeResolvidaGoogle = resolverMunicipioGoogle(result, String(form.cidade ?? ''))
  const cidadeRecebida = cidadeResolvidaGoogle.cidade
  const cidadeSource = cidadeResolvidaGoogle.source
  const formattedCity = extrairCidadeDoFormatted(result.formatted_address ?? '')
  const formattedCityMatch = !!cidadeForm && normalizarTexto(formattedCity) === cidadeForm
  const cidadeOk = !cidadeForm || cidadeCompativelGoogle(result, cidadeForm) || formattedCityMatch
  if (!cidadeOk) {
    return { valido: false, motivo: 'cidade_incompativel', cidadeOk, ufOk, logradouroOk: false, numeroOk: false, bairroOk: false, cepOk: false, cidadeRecebida, cidadeSource, formattedCityMatch, ufRecebida, logradouroRecebido: '', bairroRecebido: '', cepRecebido: '', ...baseDiag }
  }

  const logradouroForm = normalizarTexto(String(form.logradouro ?? ''))
  const logradouroRecebido = componenteTexto(result, 'route') || ''
  const logradouroOk = !logradouroForm || logradouroCompativelGoogle(result, form)
  if (!logradouroOk) {
    return { valido: false, motivo: 'logradouro_incompativel', cidadeOk, ufOk, logradouroOk, numeroOk: false, bairroOk: false, cepOk: false, cidadeRecebida, cidadeSource, formattedCityMatch, ufRecebida, logradouroRecebido, bairroRecebido: '', cepRecebido: '', ...baseDiag }
  }

  const bairroResolvidoGoogle = resolverBairroGeografico({
    bairroEsperado: form.bairro,
    address: {
      suburb: componenteTextoPorTipo(result, 'sublocality'),
      neighbourhood: componenteTextoPorTipo(result, 'neighborhood'),
    },
    displayName: result.formatted_address,
  })
  const bairroRecebido = bairroResolvidoGoogle.valorCanonico ?? ''
  const bairroForm = normalizarTexto(String(form.bairro ?? ''))
  // Para enderecos dificeis, bairro divergente nao e bloqueio absoluto; e apenas aviso
  const bairroOk = !bairroForm || enderecoDificil || bairroResolvidoGoogle.indeterminado || bairroResolvidoGoogle.matchEsperado

  const cepRecebido = componenteTexto(result, 'postal_code') || ''
  const cepForm = normalizarCep(String(form.cep ?? ''))
  const cepRecebidoNorm = normalizarCep(cepRecebido)
  const cepOk = !cepForm || !cepRecebidoNorm || cepRecebidoNorm === cepForm || cepRecebidoNorm.startsWith(cepForm.slice(0, 5))

  if (!cepOk) {
    return { valido: false, motivo: 'cep_mismatch', ...baseDiag, cidadeOk, ufOk, logradouroOk, numeroOk: false, numeroObrigatorio: true, bairroOk, cepOk, cidadeRecebida, cidadeSource, formattedCityMatch, ufRecebida, logradouroRecebido, bairroRecebido, cepRecebido }
  }

  const numeroForm = normalizarNumeroEndereco(String(form.numero ?? ''))
  const streetNumber = normalizarNumeroEndereco(componenteTexto(result, 'street_number'))
  const formatted = normalizarTexto(result.formatted_address ?? '')
  const routeNorm = normalizarTexto(logradouroRecebido)

  const temNumero =
    !!numeroForm &&
    (streetNumber === numeroForm ||
      textoContemNumeroIsolado(formatted, numeroForm) ||
      textoContemNumeroIsolado(routeNorm, numeroForm) ||
      enderecoTemIndicacaoKM(result))
  const ancoragemUrbanaForteSemNumero =
    !enderecoDificil &&
    !!numeroForm &&
    !temNumero &&
    !!cepForm &&
    !!cepRecebidoNorm &&
    cepOk &&
    cidadeOk &&
    ufOk &&
    logradouroOk &&
    !partialMatch
  const numeroOk = !numeroForm || temNumero || enderecoDificil || ancoragemUrbanaForteSemNumero
  const numeroObrigatorio = !ancoragemUrbanaForteSemNumero

  if (!numeroOk) {
    return { valido: false, motivo: 'numero_nao_encontrado', ...baseDiag, cidadeOk, ufOk, logradouroOk, numeroOk, numeroObrigatorio, bairroOk, cepOk, cidadeRecebida, cidadeSource, formattedCityMatch, ufRecebida, logradouroRecebido, bairroRecebido, cepRecebido }
  }

  const enderecoCompleto = montarEnderecoDisplayGoogle(result, form)
  const postalCode = componenteTexto(result, 'postal_code')
  const cep = postalCode ? normalizarCep(postalCode) : normalizarCep(String(form.cep ?? ''))

  // Para enderecos dificeis, aceitar resultado forte mesmo com bairro divergente
  const sinaisFortes =
    enderecoDificil &&
    locationType === 'ROOFTOP' &&
    !partialMatch &&
    logradouroOk &&
    numeroOk &&
    ufOk &&
    (cidadeOk || formattedCityMatch) &&
    cepOk

  const bairroOkFinal = sinaisFortes ? true : bairroOk

  const confiancaInterna = calcularConfiancaInternaEndereco({
    match: ancoragemUrbanaForteSemNumero ? 'aproximado_confiavel' : 'exato',
    numeroOk: !ancoragemUrbanaForteSemNumero,
    logradouroOk,
    cidadeOk,
    ufOk,
    cepOk,
    bairroOk: bairroOkFinal,
    partialMatch,
    locationType,
    provider: 'google_geocoding',
    providerImportance: null,
  })

  return {
    valido: true,
    resultado: {
      ok: true,
      lat,
      lng,
      enderecoCompleto,
      display: enderecoCompleto,
      display_name: enderecoCompleto,
      cep,
      provider: 'google_geocoding',
      match: ancoragemUrbanaForteSemNumero ? 'aproximado_confiavel' : 'exato',
      numeroOk: !ancoragemUrbanaForteSemNumero,
      numeroObrigatorio,
      motivo: ancoragemUrbanaForteSemNumero ? 'aceito_sem_numero_confirmado' : 'aceito',
      confidence: confiancaInterna.confidence,
      providerImportance: null,
      address: {
        road: componenteTexto(result, 'route') || String(form.logradouro ?? ''),
        house_number: componenteTexto(result, 'street_number') || String(form.numero ?? ''),
        suburb: bairroResolvidoGoogle.valorCanonico ?? '',
        city: cidadeRecebida || String(form.cidade ?? ''),
        state: componenteTexto(result, 'administrative_area_level_1') || String(form.uf ?? ''),
        postcode: postalCode || '',
      },
    },
    ...baseDiag,
    cidadeOk,
    ufOk,
    logradouroOk,
    numeroOk,
    numeroObrigatorio,
    bairroOk: bairroOkFinal,
    cepOk,
    cidadeRecebida,
    cidadeSource,
    formattedCityMatch,
    ufRecebida: componenteTexto(result, 'administrative_area_level_1'),
    logradouroRecebido,
    bairroRecebido,
    cepRecebido,
  }
}

export async function consultarGoogleGeocodingEnderecoDificil(
  form: ValidarEnderecoRequest,
  options: {
    fetchFn?: typeof fetch
    onEvent?: (event: GoogleGeocodingEvent) => void
    permitirEnderecoComum?: boolean
  } = {}
): Promise<ResultadoGoogleGeocoding> {
  const fetchFn = options.fetchFn ?? fetch

  if (!ehEnderecoDificilRodoviaOuRural(form) && !options.permitirEnderecoComum) {
    options.onEvent?.({ tipo: 'google_fallback_skip_not_difficult' })
    return { status: 'skipped', motivo: 'endereco_nao_e_dificil' }
  }

  const apiKey = process.env.GOOGLE_GEOCODING_API_KEY?.trim()
  if (!apiKey) {
    options.onEvent?.({ tipo: 'google_fallback_missing_key' })
    return { status: 'failed', motivo: 'google_key_ausente' }
  }

  const query = [
    String(form.logradouro ?? '').trim(),
    String(form.numero ?? '').trim(),
    String(form.bairro ?? '').trim(),
    String(form.cidade ?? '').trim(),
    String(form.uf ?? '').trim(),
    'Brasil',
  ]
    .filter(Boolean)
    .join(', ')

  if (!query.trim()) {
    return { status: 'failed', motivo: 'query_vazia' }
  }

  const url = new URL('https://maps.googleapis.com/maps/api/geocode/json')
  url.searchParams.set('address', query)
  url.searchParams.set('key', apiKey)
  url.searchParams.set('region', 'br')
  url.searchParams.set('language', 'pt-BR')

  options.onEvent?.({ tipo: 'google_fallback_query', query, cidade: String(form.cidade ?? ''), uf: String(form.uf ?? ''), cep: String(form.cep ?? '') })
  options.onEvent?.({ tipo: 'google_fallback_start' })

  try {
    const response = await fetchFn(url.toString(), {
      headers: { Accept: 'application/json' },
    })

    if (!response.ok) {
      const motivo = `http_${response.status}`
      options.onEvent?.({ tipo: 'google_fallback_error', motivo })
      return { status: 'failed', motivo }
    }

    const data = (await response.json()) as GoogleGeocodingResponse

    const total = Array.isArray(data.results) ? data.results.length : 0
    const errorMessageTrunc = data.error_message ? data.error_message.slice(0, 120) : undefined
    options.onEvent?.({ tipo: 'google_fallback_response', status: data.status ?? 'UNKNOWN', total, errorMessage: errorMessageTrunc })

    if (data.status !== 'OK' || !Array.isArray(data.results) || data.results.length === 0) {
      const motivo = data.error_message ? `google_api_${data.status}` : `google_status_${data.status}`
      options.onEvent?.({ tipo: 'google_fallback_error', motivo })
      return { status: 'failed', motivo }
    }

    const [resultado] = data.results
    const validacao = validarResultadoGoogle(resultado, form)

    const formattedTrunc = (resultado.formatted_address ?? '').slice(0, 180)
    const placeId = resultado.place_id ?? ''
    const locationType = locationTypeGoogle(resultado)
    const partialMatch = resultado.partial_match ?? false
    const route = componenteTexto(resultado, 'route') || ''
    const streetNumber = componenteTexto(resultado, 'street_number') || ''
    const bairroCandidate = validacao.bairroRecebido
    const cityCandidate = validacao.cidadeRecebida
    const stateCandidate = validacao.ufRecebida
    const postcode = componenteTexto(resultado, 'postal_code') || ''

    const motivos = validacao.valido ? 'aceito' : (validacao.motivo || 'motivo_desconhecido')

    options.onEvent?.({
      tipo: 'google_candidate',
      idx: 0,
      motivos,
      lat: resultado.geometry?.location?.lat ?? 0,
      lng: resultado.geometry?.location?.lng ?? 0,
      formatted: formattedTrunc,
      placeId,
      locationType,
      partialMatch,
      route,
      streetNumber,
      bairroCandidate,
      cityCandidate,
      citySource: validacao.cidadeSource,
      formattedCityMatch: validacao.formattedCityMatch,
      stateCandidate,
      postcode,
      cidadeOk: validacao.cidadeOk,
      ufOk: validacao.ufOk,
      logradouroOk: validacao.logradouroOk,
      numeroOk: validacao.numeroOk,
      bairroOk: validacao.bairroOk,
      cepOk: validacao.cepOk,
    })

    if (!validacao.valido) {
      const motivo = validacao.motivo || 'motivo_desconhecido'
      options.onEvent?.({ tipo: 'google_fallback_rejected', motivo })

      if (motivo === 'cidade_incompativel') {
        const componentsResumo = `city="${cityCandidate}" state="${stateCandidate}" locality="${componenteTextoPorTipo(resultado, 'locality')}" admin2="${componenteTextoPorTipo(resultado, 'administrative_area_level_2')}"`
        options.onEvent?.({
          tipo: 'google_reject_detail',
          motivo: 'cidade_incompativel',
          esperadoCidade: String(form.cidade ?? ''),
          recebidoCidade: cityCandidate,
          formatted: formattedTrunc,
          componentsResumo,
        })
      }

      options.onEvent?.({ tipo: 'google_summary', total: 1, aceitos: 0, rejeitados: 1, motivos: `${motivo}:1` })
      return { status: 'failed', motivo }
    }

    options.onEvent?.({ tipo: 'google_summary', total: 1, aceitos: 1, rejeitados: 0, motivos: 'aceito:1' })
    options.onEvent?.({ tipo: 'google_fallback_success' })
    return { status: 'success', resultado: validacao.resultado! }
  } catch (error) {
    const motivo = error instanceof Error ? error.message : 'erro_desconhecido'
    options.onEvent?.({ tipo: 'google_fallback_error', motivo })
    return { status: 'failed', motivo }
  }
}
