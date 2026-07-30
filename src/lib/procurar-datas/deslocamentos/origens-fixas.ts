import type { EnderecoValidado } from '../contratos'

export type OrigemFixa = {
  label: 'DEPOSITO_LEBEBE' | 'LOJA_LEBEBE' | 'LOJA_MARECHAL_HAUER' | 'LOJA_PORTAO' | 'LOJA_BIGORRILHO'
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
  {
    label: 'LOJA_MARECHAL_HAUER',
    aliases: [
      'Av. Mal. Floriano Peixoto, 5636 - Hauer, Curitiba - PR, 81630-000',
      'Av Mal Floriano Peixoto 5636 Hauer Curitiba PR 81630-000',
      'Avenida Marechal Floriano Peixoto, 5636, Hauer, Curitiba - PR',
    ],
    tokensObrigatorios: ['FLORIANO', 'PEIXOTO'],
    numero: '5636',
    lat: -25.477376,
    lng: -49.249524,
    display: '5636, Avenida Marechal Floriano Peixoto, Hauer, Curitiba, Paraná, 81630-000, Brasil',
  },
  {
    label: 'LOJA_PORTAO',
    aliases: [
      'Av. Rep. Argentina, 2777, Curitiba - PR, 80610-260',
      'Av Rep Argentina 2777 Curitiba PR 80610-260',
      'Avenida República Argentina, 2777, Portão, Curitiba - PR',
      'Avenida Republica Argentina, 2777, Portao, Curitiba - PR',
    ],
    tokensObrigatorios: ['ARGENTINA', '2777'],
    numero: '2777',
    lat: -25.470662,
    lng: -49.294289,
    display: '2777, Avenida República Argentina, Portão, Curitiba, Paraná, 80610-260, Brasil',
  },
  {
    label: 'LOJA_BIGORRILHO',
    aliases: [
      'Av. Cândido Hartmann, 456, 80730-440',
      'Av Candido Hartmann 456 80730-440',
      'Avenida Cândido Hartmann, 456, Bigorrilho, Curitiba - PR',
      'Avenida Candido Hartmann, 456, Bigorrilho, Curitiba - PR',
    ],
    tokensObrigatorios: ['HARTMANN'],
    numero: '456',
    lat: -25.431229,
    lng: -49.291418,
    display: '456, Avenida Cândido Hartmann, Bigorrilho, Curitiba, Paraná, 80730-440, Brasil',
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
