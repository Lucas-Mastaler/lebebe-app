import type { EnderecoValidado } from '../contratos'

export type OrigemFixa = {
  label: 'DEPOSITO_LEBEBE' | 'LOJA_LEBEBE'
  aliases: string[]
  tokensObrigatorios: string[]
  numero: string
  lat: number
  lng: number
  display: string
}

export const ORIGENS_FIXAS: OrigemFixa[] = [
  {
    label: 'DEPOSITO_LEBEBE',
    aliases: [
      'R. Dr. Francisco Soares, 860, Curitiba-PR,',
      'R. Dr. Francisco Soares, 860, Curitiba-PR',
      'Rua Doutor Francisco Soares, 860, Curitiba - PR, 81030-470',
      'Rua Doutor Francisco Soares, 860, Novo Mundo, Curitiba - PR, 81030-470',
      '860, Rua Doutor Francisco Soares, Novo Mundo, Curitiba, PR, 81030-470, Brasil',
    ],
    tokensObrigatorios: ['FRANCISCO', 'SOARES'],
    numero: '860',
    lat: -25.4934984,
    lng: -49.2765509,
    display: '860, Rua Doutor Francisco Soares, Novo Mundo, Curitiba, Paraná, 81030-470, Brasil',
  },
  {
    label: 'LOJA_LEBEBE',
    aliases: [
      'Rua Deputado Néo Martins, 872 - Novo Mundo, Curitiba - PR, 81030-470',
      'Rua Deputado Neo Martins, 872 - Novo Mundo, Curitiba - PR, 81030-470',
      'Rua Deputado Néo Martins, 872, Curitiba - PR, 81030-470',
      'Rua Deputado Neo Martins, 872, Curitiba - PR, 81030-470',
      '872, Rua Deputado Néo Martins, Novo Mundo, Curitiba, PR, 81030-470, Brasil',
    ],
    tokensObrigatorios: ['NEO', 'MARTINS'],
    numero: '872',
    lat: -25.4944568,
    lng: -49.2771426,
    display: '872, Rua Deputado Néo Martins, Novo Mundo, Curitiba, Paraná, 81030-470, Brasil',
  },
]

export function normalizarTextoOrigemFixa(valor: string | null | undefined): string {
  return String(valor ?? '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\bR\.\s*/g, 'RUA ')
    .replace(/\bDR\.\s*/g, 'DOUTOR ')
    .replace(/\bDRA\.\s*/g, 'DOUTORA ')
    .replace(/\bAV\.\s*/g, 'AVENIDA ')
    .replace(/\bAL\.\s*/g, 'ALAMEDA ')
    .replace(/\bTRAV\.\s*/g, 'TRAVESSA ')
    .replace(/\bROD\.\s*/g, 'RODOVIA ')
    .replace(/\bEST\.\s*/g, 'ESTRADA ')
    .replace(/\bPROF\.\s*/g, 'PROFESSOR ')
    .replace(/\bBRASIL\b/g, '')
    .replace(/[^A-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function tokensObrigatoriosPresentes(
  textoNormalizado: string,
  tokensObrigatorios: string[]
): boolean {
  const partes = new Set(textoNormalizado.split(/\s+/).filter(Boolean))
  return tokensObrigatorios.every((token) => partes.has(token))
}

function numeroPresente(textoNormalizado: string, numeroEsperado: string): boolean {
  const numerosEncontrados = new Set(
    (textoNormalizado.match(/\b\d+\b/g) || [])
  )
  return numerosEncontrados.has(numeroEsperado)
}

export type ResultadoResolverOrigemFixa =
  | {
      ok: true
      lat: number
      lng: number
      display: string
      origemRecebida: string
      normalizada: string
      estrategia: 'fixed_known_location'
      label: OrigemFixa['label']
    }
  | {
      ok: false
      origemRecebida: string
      normalizada: string
    }

export function resolverOrigemFixa(origemRecebida: string): ResultadoResolverOrigemFixa {
  const normalizada = normalizarTextoOrigemFixa(origemRecebida)

  if (!normalizada) {
    return { ok: false, origemRecebida, normalizada }
  }

  for (const origem of ORIGENS_FIXAS) {
    if (
      tokensObrigatoriosPresentes(normalizada, origem.tokensObrigatorios) &&
      numeroPresente(normalizada, origem.numero)
    ) {
      return {
        ok: true,
        lat: origem.lat,
        lng: origem.lng,
        display: origem.display,
        origemRecebida,
        normalizada,
        estrategia: 'fixed_known_location',
        label: origem.label,
      }
    }
  }

  return { ok: false, origemRecebida, normalizada }
}

export function origemFixaParaEnderecoValidado(
  resultado: Extract<ResultadoResolverOrigemFixa, { ok: true }>
): EnderecoValidado {
  return {
    ok: true,
    lat: resultado.lat,
    lng: resultado.lng,
    enderecoCompleto: resultado.display,
    display_name: resultado.display,
    display: resultado.display,
    provider: 'fixed_known_location',
    providerOriginal: resultado.label,
    confidence: 1,
    cache: 'none',
  }
}
