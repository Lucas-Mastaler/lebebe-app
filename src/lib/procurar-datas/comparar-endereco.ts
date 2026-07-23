import { normalizarTexto } from './endereco-cache'
import { resolverBairroGeografico, resolverMunicipioGeografico } from './geografia/resolver-componente-geografico'

export type DivergenciaEndereco = 'nenhuma' | 'bairro' | 'cidade' | 'uf'

export type ResultadoComparacaoEndereco = {
  divergencia: DivergenciaEndereco
  bairroForm: string
  bairroProvider: string
  cidadeForm: string
  cidadeProvider: string
  ufForm: string
  ufProvider: string
}

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

function ufCompativel(ufForm: string, ufProvider: string): boolean {
  if (!ufForm || !ufProvider) return false
  if (ufForm === ufProvider) return true
  if (ufProvider === UF_NOMES[ufForm]) return true
  return false
}

/**
 * Compara bairro, cidade e UF do endereço textual (CEP) com os dados
 * retornados pela geocodificacao (provider).
 *
 * - Usa normalizarTexto (remove acentos, uppercase, pontuacao, espacos extras).
 * - Bairro ausente no provider nao bloqueia (divergencia = 'nenhuma').
 * - Cidade ou UF ausentes nao sao tratados aqui — o backend ja rejeita
 *   resultados sem cidade/UF. Se chegar vazio, considera divergencia.
 */
export function compararEnderecoCEPComGeocodificacao(
  form: { bairro: string; cidade: string; uf: string },
  addressProvider: Record<string, unknown> | undefined,
): ResultadoComparacaoEndereco {
  const bairroForm = normalizarTexto(form.bairro)
  const cidadeForm = normalizarTexto(form.cidade)
  const ufForm = normalizarTexto(form.uf)

  const provider = (addressProvider?.address && typeof addressProvider.address === 'object'
    ? addressProvider.address
    : addressProvider) as Record<string, unknown> | undefined
  const displayName = String(addressProvider?.display_name ?? addressProvider?.display ?? addressProvider?.enderecoCompleto ?? '')

  const bairroResolvido = resolverBairroGeografico({
    bairroEsperado: form.bairro,
    address: {
      suburb: String(provider?.suburb ?? ''),
      neighbourhood: String(provider?.neighbourhood ?? ''),
      city_district: String(provider?.city_district ?? ''),
      quarter: String(provider?.quarter ?? ''),
    },
    displayName,
  })
  const cidadeResolvida = resolverMunicipioGeografico({
    cidadeEsperada: form.cidade,
    address: {
      city: String(provider?.city ?? ''),
      town: String(provider?.town ?? ''),
      municipality: String(provider?.municipality ?? ''),
      county: String(provider?.county ?? ''),
    },
    displayName,
  })

  const bairroProvider = bairroResolvido.valorCanonico ?? ''
  const cidadeProvider = cidadeResolvida.valorCanonico ?? normalizarTexto(
    String(provider?.city ?? provider?.town ?? provider?.municipality ?? ''),
  )
  const ufProvider = normalizarTexto(
    String(provider?.state ?? provider?.state_code ?? ''),
  ).replace(/^BR-/, '').replace(/^BR\s+/, '')

  // UF divergente tem prioridade maxima
  // Se ufProvider ausente, nao diverge — o backend ja rejeita resultados sem UF
  if (ufForm && ufProvider && !ufCompativel(ufForm, ufProvider)) {
    return { divergencia: 'uf', bairroForm, bairroProvider, cidadeForm, cidadeProvider, ufForm, ufProvider }
  }

  // Cidade divergente
  // Se cidadeProvider ausente, nao diverge — o backend ja rejeita resultados sem cidade
  if (cidadeForm && cidadeProvider && normalizarTexto(cidadeProvider) !== cidadeForm) {
    return { divergencia: 'cidade', bairroForm, bairroProvider, cidadeForm, cidadeProvider, ufForm, ufProvider }
  }

  // Bairro divergente apenas quando o provider trouxe bairro oficial/confiavel, nao generico e nao ambiguo.
  if (
    bairroForm &&
    bairroProvider &&
    bairroResolvido.bairroOficialCuritiba &&
    !bairroResolvido.termoGenerico &&
    !bairroResolvido.ambiguo &&
    bairroResolvido.divergenciaReal
  ) {
    return { divergencia: 'bairro', bairroForm, bairroProvider, cidadeForm, cidadeProvider, ufForm, ufProvider }
  }

  return { divergencia: 'nenhuma', bairroForm, bairroProvider, cidadeForm, cidadeProvider, ufForm, ufProvider }
}
