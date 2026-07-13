import { normalizarTexto } from './endereco-cache'

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
  addressProvider: Record<string, string> | undefined,
): ResultadoComparacaoEndereco {
  const bairroForm = normalizarTexto(form.bairro)
  const cidadeForm = normalizarTexto(form.cidade)
  const ufForm = normalizarTexto(form.uf)

  const bairroProvider = normalizarTexto(
    String(addressProvider?.suburb ?? addressProvider?.neighbourhood ?? ''),
  )
  const cidadeProvider = normalizarTexto(
    String(addressProvider?.city ?? addressProvider?.town ?? addressProvider?.municipality ?? ''),
  )
  const ufProvider = normalizarTexto(
    String(addressProvider?.state ?? addressProvider?.state_code ?? ''),
  ).replace(/^BR-/, '').replace(/^BR\s+/, '')

  // UF divergente tem prioridade maxima
  // Se ufProvider ausente, nao diverge — o backend ja rejeita resultados sem UF
  if (ufForm && ufProvider && !ufCompativel(ufForm, ufProvider)) {
    return { divergencia: 'uf', bairroForm, bairroProvider, cidadeForm, cidadeProvider, ufForm, ufProvider }
  }

  // Cidade divergente
  // Se cidadeProvider ausente, nao diverge — o backend ja rejeita resultados sem cidade
  if (cidadeForm && cidadeProvider && cidadeForm !== cidadeProvider) {
    return { divergencia: 'cidade', bairroForm, bairroProvider, cidadeForm, cidadeProvider, ufForm, ufProvider }
  }

  // Bairro divergente (apenas se ambos presentes)
  if (bairroForm && bairroProvider && bairroForm !== bairroProvider) {
    return { divergencia: 'bairro', bairroForm, bairroProvider, cidadeForm, cidadeProvider, ufForm, ufProvider }
  }

  return { divergencia: 'nenhuma', bairroForm, bairroProvider, cidadeForm, cidadeProvider, ufForm, ufProvider }
}
