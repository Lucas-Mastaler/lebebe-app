// ─────────────────────────────────────────────────────────────────────────────
// motor/entrada.ts  —  Normalizador puro de entrada do motor v2 (sem I/O)
//
// Transforma o payload da pesquisa atual (PesquisarDatasRequest) em uma
// estrutura limpa, validada e previsível para o futuro motor Next.js.
//
// NÃO FAZ:
//   - Leitura de planilha, Supabase, ou qualquer I/O
//   - Nenhuma alteração em APIs existentes ou frontend
//   - Não chama Apps Script, OSRM, Google Calendar
//   - Não busca candidatos
// ─────────────────────────────────────────────────────────────────────────────

import type { PesquisarDatasRequest } from '../contratos'
import { parseMinutos } from './tempo'

// ─── Tipos ───────────────────────────────────────────────────────────────────

/** Par de coordenadas geográficas validadas. */
export interface CoordenadaValidada {
  lat: number
  lng: number
}

/** Estrutura normalizada de entrada para o motor v2. */
export interface EntradaPesquisaV2 {
  cep: string | null
  enderecoCompleto: string | null
  dataInicialISO: string | null
  tempoNecessarioTexto: string | null
  tempoNecessarioMin: number | null
  coordenadasDestino: CoordenadaValidada | null
  coordenadasOrigemInformada: CoordenadaValidada | null
  isRural: boolean
  isCondominio: boolean
  temEnderecoMinimo: boolean
  temCoordenadasDestino: boolean
  avisos: string[]
}

// ─── Helpers internos ───────────────────────────────────────────────────────

/**
 * Verifica se um valor é um número finito válido (não null, undefined,
 * NaN, Infinity, string vazia).
 */
function isNumeroValido(v: unknown): v is number {
  return typeof v === 'number' && !isNaN(v) && isFinite(v)
}

/**
 * Extrai um par de coordenadas válidas do payload.
 * Retorna null se lat ou lng forem inválidos ou estiverem fora dos ranges.
 */
function extrairCoordenadasValidas(
  lat: unknown,
  lng: unknown
): CoordenadaValidada | null {
  if (!isNumeroValido(lat) || !isNumeroValido(lng)) return null
  if (lat < -90 || lat > 90) return null
  if (lng < -180 || lng > 180) return null
  return { lat, lng }
}

/**
 * Valida se uma string está no formato YYYY-MM-DD.
 * Não converte timezone — apenas verifica formato e valores numéricos.
 */
function isDataISOValida(str: string): boolean {
  const m = str.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return false
  const ano = Number(m[1])
  const mes = Number(m[2])
  const dia = Number(m[3])
  if (mes < 1 || mes > 12) return false
  if (dia < 1 || dia > 31) return false
  // Não valida dias por mês (30/31/fevereiro) — suficiente para normalização
  return true
}

/**
 * Converte valor para boolean seguro.
 * Valores truthy → true; falsy (incluindo undefined) → false.
 */
function paraBooleanSeguro(v: unknown): boolean {
  return v === true
}

// ─── Função principal ───────────────────────────────────────────────────────

/**
 * Normaliza o payload da pesquisa atual para uma estrutura limpa
 * e previsível, pronta para consumo pelo futuro motor v2.
 *
 * Recebe: PesquisarDatasRequest (mesmo contrato da rota /pesquisar)
 * Retorna: EntradaPesquisaV2 com avisos sobre campos ausentes/inválidos
 *
 * Não lança erros. Campos problemáticos são sinalizados via `avisos`.
 * Não muta o objeto de entrada.
 */
export function normalizarEntradaPesquisaV2(
  input: PesquisarDatasRequest
): EntradaPesquisaV2 {
  const avisos: string[] = []

  // 1. CEP
  const cepBruto = input.cep
  const cep =
    typeof cepBruto === 'string' && cepBruto.trim().length > 0
      ? cepBruto.trim()
      : null
  if (!cep) avisos.push('CEP ausente.')

  // 2. Endereço completo
  const enderecoBruto = input.enderecoCompleto
  const enderecoCompleto =
    typeof enderecoBruto === 'string' && enderecoBruto.trim().length > 0
      ? enderecoBruto.trim()
      : null
  if (!enderecoCompleto) avisos.push('Endereço completo ausente.')

  const temEnderecoMinimo = cep !== null || enderecoCompleto !== null

  // 3. Coordenadas de destino (preferencial: destLat/destLng)
  let coordenadasDestino = extrairCoordenadasValidas(
    input.destLat,
    input.destLng
  )

  // Fallback: lat/lng se destLat/destLng não existirem
  if (!coordenadasDestino) {
    coordenadasDestino = extrairCoordenadasValidas(input.lat, input.lng)
  }

  const temCoordenadasDestino = coordenadasDestino !== null
  if (!temCoordenadasDestino) {
    avisos.push('Coordenadas de destino ausentes ou inválidas.')
  }

  // 4. Coordenadas de origem (apenas informativas — não obrigatórias)
  const coordenadasOrigemInformada = extrairCoordenadasValidas(
    input.lat,
    input.lng
  )

  // 5. Tempo necessário
  const tempoNecessarioTexto =
    typeof input.tempoNecessario === 'string' &&
    input.tempoNecessario.trim().length > 0
      ? input.tempoNecessario.trim()
      : null

  let tempoNecessarioMin: number | null = null
  if (tempoNecessarioTexto) {
    const minutos = parseMinutos(tempoNecessarioTexto)
    // parseMinutos retorna 0 para string vazia; aqui já garantimos não-vazio.
    // Consideramos inválido se retornar 0 para string não-vazia (ex: "abc" → 0)
    // ou se o formato não for HH:MM com horas > 0 ou minutos > 0.
    if (minutos > 0) {
      tempoNecessarioMin = minutos
    } else {
      tempoNecessarioMin = null
      avisos.push('Tempo necessário ausente ou inválido.')
    }
  } else {
    avisos.push('Tempo necessário ausente ou inválido.')
  }

  // 6. Data inicial (YYYY-MM-DD)
  const dataInicialBruta = input.dataInicial
  let dataInicialISO: string | null = null
  if (
    typeof dataInicialBruta === 'string' &&
    dataInicialBruta.trim().length > 0
  ) {
    const limpa = dataInicialBruta.trim()
    if (isDataISOValida(limpa)) {
      dataInicialISO = limpa
    } else {
      avisos.push('Data inicial ausente ou inválida.')
    }
  } else {
    avisos.push('Data inicial ausente ou inválida.')
  }

  // 7. Flags booleanas
  const isRural = paraBooleanSeguro(input.isRural)
  const isCondominio = paraBooleanSeguro(input.isCondominio)

  return {
    cep,
    enderecoCompleto,
    dataInicialISO,
    tempoNecessarioTexto,
    tempoNecessarioMin,
    coordenadasDestino,
    coordenadasOrigemInformada,
    isRural,
    isCondominio,
    temEnderecoMinimo,
    temCoordenadasDestino,
    avisos,
  }
}
