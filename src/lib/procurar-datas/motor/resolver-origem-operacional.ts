// ─────────────────────────────────────────────────────────────────────────────
// motor/resolver-origem-operacional.ts
//
// Helper puro para escolher a origem operacional correta (depósito ou casa da equipe)
// com base no dia da semana e na equipe.
//
// REGRAS (confirmadas no legado CEP-APIBACK.gs):
//   - Dias úteis (seg-sex): usar depósito (LAT DEPOSITO, LNG DEPOSITO)
//   - Sábado: usar casa da equipe correspondente (E1 → LAT/LNG CASA E1, E2 → LAT/LNG CASA E2)
//   - Domingo: não há entregas (legado não processa domingos)
//
// VALIDAÇÕES:
//   - Coordenadas devem ser números finitos (não NaN, não Infinity)
//   - Equipe deve ser 'EQUIPE 1' ou 'EQUIPE 2' (normalizada)
//   - No sábado, se coordenada da casa estiver ausente → erro controlado (ok: false)
//   - Não há fallback silencioso para depósito no sábado
//   - Não há fallback para 0 ou coordenada inventada
//
// NÃO FAZ:
//   - Não chama OSRM, Supabase, APIs externas
//   - Não lê planilha ou banco
//   - Não altera estado global
//   - Não calcula distâncias
// ─────────────────────────────────────────────────────────────────────────────

import type { ConfigNormalizada } from '../config-service'

// ─── Tipos ───────────────────────────────────────────────────────────────────

export type EquipeNormalizada = 'EQUIPE 1' | 'EQUIPE 2'

export interface Coordenada {
  lat: number
  lng: number
}

export interface OrigemOperacionalOk {
  ok: true
  origem: Coordenada
  tipo: 'deposito' | 'casa-e1' | 'casa-e2'
  contexto: {
    dataISO: string
    equipe: EquipeNormalizada
    ehSabado: boolean
  }
}

export interface OrigemOperacionalErro {
  ok: false
  erro: string
  origem: null
  tipo: null
  contexto: {
    dataISO: string
    equipe: string | null
    ehSabado: boolean | null
  }
}

export type OrigemOperacionalResult = OrigemOperacionalOk | OrigemOperacionalErro

export interface ResolverOrigemOperacionalInput {
  dataISO: string // YYYY-MM-DD
  equipe: string // será normalizada
  config: Pick<
    ConfigNormalizada,
    | 'latDeposito'
    | 'lngDeposito'
    | 'latCasaE1'
    | 'lngCasaE1'
    | 'latCasaE2'
    | 'lngCasaE2'
  >
}

// ─── Helpers internos ────────────────────────────────────────────────────────

/**
 * Normaliza o identificador da equipe.
 * Retorna 'EQUIPE 1' | 'EQUIPE 2' ou null se inválido.
 */
function normalizarEquipe(equipeRaw: string): EquipeNormalizada | null {
  const limpo = equipeRaw.trim().toUpperCase()

  // Aceita variações: "EQUIPE 1", "E1", "EQP 1", "EQUPE 1", "1"
  const e1Patterns = ['EQUIPE 1', 'E1', 'EQP 1', 'EQUPE 1', 'TEAM 1', '1']
  const e2Patterns = ['EQUIPE 2', 'E2', 'EQP 2', 'EQUPE 2', 'TEAM 2', '2']

  if (e1Patterns.includes(limpo)) return 'EQUIPE 1'
  if (e2Patterns.includes(limpo)) return 'EQUIPE 2'

  // Tenta extrair número do final
  const matchNumero = limpo.match(/(\d)$/)
  if (matchNumero) {
    const num = parseInt(matchNumero[1], 10)
    if (num === 1) return 'EQUIPE 1'
    if (num === 2) return 'EQUIPE 2'
  }

  return null
}

/**
 * Determina se uma data YYYY-MM-DD é sábado.
 * Retorna false para datas inválidas (tratado como erro externo).
 */
function ehSabado(dataISO: string): boolean | null {
  const match = dataISO.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return null

  const [_, yyyy, mm, dd] = match
  const data = new Date(Number(yyyy), Number(mm) - 1, Number(dd))

  // Verifica se a data é válida (não rolou para outro dia)
  if (
    data.getFullYear() !== Number(yyyy) ||
    data.getMonth() !== Number(mm) - 1 ||
    data.getDate() !== Number(dd)
  ) {
    return null
  }

  // getDay(): 0 = domingo, 6 = sábado
  return data.getDay() === 6
}

/**
 * Valida se uma coordenada é um número finito válido.
 */
function coordenadaValida(lat: unknown, lng: unknown): boolean {
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    !Number.isNaN(lat) &&
    !Number.isNaN(lng)
  )
}

// ─── Função principal ───────────────────────────────────────────────────────

/**
 * Resolve a origem operacional (coordenadas) para uma data e equipe.
 *
 * Regras (confirmadas no legado):
 *   - Dias úteis: usar depósito
 *   - Sábado: usar casa da equipe correspondente
 *   - Não há fallback automático — coordenada ausente = erro explícito
 *
 * @param input.dataISO Data no formato YYYY-MM-DD
 * @param input.equipe Identificador da equipe (será normalizado)
 * @param input.config Subset de ConfigNormalizada com as coordenadas
 * @returns OrigemOperacionalResult com ok: true + coordenada ou ok: false + erro
 */
export function resolverOrigemOperacionalV2(
  input: ResolverOrigemOperacionalInput
): OrigemOperacionalResult {
  const { dataISO, equipe: equipeRaw, config } = input

  // ── 1. Validar data e determinar se é sábado ────────────────────────────────
  const ehSabadoResult = ehSabado(dataISO)
  if (ehSabadoResult === null) {
    return {
      ok: false,
      erro: `Data inválida ou formato incorreto: "${dataISO}". Esperado YYYY-MM-DD.`,
      origem: null,
      tipo: null,
      contexto: {
        dataISO,
        equipe: equipeRaw || null,
        ehSabado: null,
      },
    }
  }

  // ── 2. Normalizar equipe ──────────────────────────────────────────────────
  const equipe = normalizarEquipe(equipeRaw)
  if (equipe === null) {
    return {
      ok: false,
      erro: `Equipe inválida: "${equipeRaw}". Esperado "EQUIPE 1", "EQUIPE 2" ou variações (E1, E2, etc.).`,
      origem: null,
      tipo: null,
      contexto: {
        dataISO,
        equipe: equipeRaw || null,
        ehSabado: ehSabadoResult,
      },
    }
  }

  // ── 3. Escolher origem conforme dia e equipe ────────────────────────────────
  if (ehSabadoResult) {
    // Sábado: usar casa da equipe
    if (equipe === 'EQUIPE 1') {
      if (!coordenadaValida(config.latCasaE1, config.lngCasaE1)) {
        return {
          ok: false,
          erro: `Coordenadas da casa da Equipe 1 ausentes ou inválidas (LAT CASA E1: ${config.latCasaE1}, LNG CASA E1: ${config.lngCasaE1}).`,
          origem: null,
          tipo: null,
          contexto: {
            dataISO,
            equipe,
            ehSabado: true,
          },
        }
      }
      return {
        ok: true,
        origem: { lat: config.latCasaE1, lng: config.lngCasaE1 },
        tipo: 'casa-e1',
        contexto: { dataISO, equipe, ehSabado: true },
      }
    } else {
      // EQUIPE 2
      if (!coordenadaValida(config.latCasaE2, config.lngCasaE2)) {
        return {
          ok: false,
          erro: `Coordenadas da casa da Equipe 2 ausentes ou inválidas (LAT CASA E2: ${config.latCasaE2}, LNG CASA E2: ${config.lngCasaE2}).`,
          origem: null,
          tipo: null,
          contexto: {
            dataISO,
            equipe,
            ehSabado: true,
          },
        }
      }
      return {
        ok: true,
        origem: { lat: config.latCasaE2, lng: config.lngCasaE2 },
        tipo: 'casa-e2',
        contexto: { dataISO, equipe, ehSabado: true },
      }
    }
  } else {
    // Dia útil: usar depósito
    if (!coordenadaValida(config.latDeposito, config.lngDeposito)) {
      return {
        ok: false,
        erro: `Coordenadas do depósito ausentes ou inválidas (LAT DEPOSITO: ${config.latDeposito}, LNG DEPOSITO: ${config.lngDeposito}).`,
        origem: null,
        tipo: null,
        contexto: {
          dataISO,
          equipe,
          ehSabado: false,
        },
      }
    }
    return {
      ok: true,
      origem: { lat: config.latDeposito, lng: config.lngDeposito },
      tipo: 'deposito',
      contexto: { dataISO, equipe, ehSabado: false },
    }
  }
}
