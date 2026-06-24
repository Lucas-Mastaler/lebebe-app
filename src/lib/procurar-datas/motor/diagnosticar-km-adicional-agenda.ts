// ─────────────────────────────────────────────────────────────────────────────
// motor/diagnosticar-km-adicional-agenda.ts
//   Orquestrador diagnostico puro: shAg -> pontos agenda -> delta insercao
//
//   Composicao de dois helpers ja auditados:
//     1. parsearPontosAgendaDoDiaV2   (parse-agenda-shag.ts)
//     2. calcularDeltaInsercaoRotaDiagnosticoV2  (calcular-delta-insercao-rota.ts)
//
//   Pipeline:
//     linhasAgenda (shAg brutas)
//       -> parsearPontosAgendaDoDiaV2 (filtra data/equipe, extrai endereco, injeta coords)
//       -> PontoAgendaV2[] (pontos validos com coordenadas)
//       -> calcularDeltaInsercaoRotaDiagnosticoV2 (melhor insercao Haversine)
//       -> kmAdicionalNaRotaM diagnostico (metros)
//
//   APROXIMACAO DIAGNOSTICA — usa Haversine, nao OSRM.
//   NAO deve ser usado em producao.
//   NAO representa o calculo fiel do legado.
//   NAO integrado a nenhuma rota nesta versao.
//
//   NAO FAZ:
//     - Leitura de planilha, Google Sheets, Apps Script
//     - Chamadas ao Supabase
//     - Chamadas OSRM ou qualquer HTTP
//     - Geocoding (coordenadas injetadas via cache)
//     - Uso de process.env ou data/hora atual
//     - Mutacao do input
// ─────────────────────────────────────────────────────────────────────────────

import {
  parsearPontosAgendaDoDiaV2,
  type ParsearPontosAgendaDoDiaV2Output,
  type PontoAgendaDescartadoV2,
} from './parse-agenda-shag'

import {
  calcularDeltaInsercaoRotaDiagnosticoV2,
  type CalcularDeltaInsercaoRotaOutput,
  type PontoDescartadoDelta,
} from './calcular-delta-insercao-rota'

import { normalizarEquipe } from './equipe'

// ─── Tipos de entrada ─────────────────────────────────────────────────────────

export type DiagnosticarKmAdicionalAgendaInput = {
  /** Linhas brutas da planilha AGENDA (shAg). Cada linha deve ter 7 colunas. */
  linhasAgenda: unknown[][]

  /** Data alvo no formato YYYY-MM-DD. */
  dataISO: string

  /** String de equipe (sera normalizada internamente). */
  equipe: string

  /** Origem da rota (deposito ou casa da equipe no sabado). */
  origem: { lat: number; lng: number; descricao?: string }

  /** Destino do cliente. */
  destino: { lat: number; lng: number; descricao?: string }

  /**
   * Cache de coordenadas por endereco normalizado.
   * Chave: endereco normalizado (lowercase, virgula+espaco).
   * Valor: { lat, lng }.
   */
  cacheCoordenadasPorEndereco: Record<string, { lat: number; lng: number }>

  /** Modo de calculo. Apenas haversine-diagnostico nesta versao. */
  modo?: 'haversine-diagnostico'
}

// ─── Tipos de saida ───────────────────────────────────────────────────────────

/** Descarte unificado com indicacao de origem. */
export type DescarteUnificado =
  | {
      origem: 'parse-agenda'
      descarte: PontoAgendaDescartadoV2
    }
  | {
      origem: 'delta-insercao'
      descarte: PontoDescartadoDelta
    }

export type DiagnosticarKmAdicionalAgendaOutput = {
  ok: boolean

  /** Sempre 'haversine-diagnostico' nesta versao. */
  modo: 'haversine-diagnostico'

  /** Data alvo usada no filtro. */
  dataISO: string

  /** Equipe normalizada usada no filtro. */
  equipe: string

  /**
   * Menor delta de insercao encontrado em metros (arredondado).
   * null se nao foi possivel calcular.
   */
  kmAdicionalNaRotaM: number | null

  /**
   * Indica a origem do valor calculado.
   * 'agenda-shag-haversine-diagnostico' quando calculado com sucesso.
   * null quando nao calculado.
   */
  origemKmAdicionalNaRotaM: 'agenda-shag-haversine-diagnostico' | null

  /** Resumo auditavel do parse da agenda. */
  parseAgenda: {
    ok: boolean
    resumo: ParsearPontosAgendaDoDiaV2Output['resumo']
    avisos: string[]
    erros: string[]
  }

  /** Resumo auditavel do delta de insercao. null se nao executado. */
  deltaInsercao: {
    ok: boolean
    melhorInsercao: CalcularDeltaInsercaoRotaOutput['melhorInsercao']
    resumo: CalcularDeltaInsercaoRotaOutput['resumo']
    avisos: string[]
  } | null

  /** Todos os avisos consolidados (parse + delta). */
  avisos: string[]

  /** Todos os descartes, diferenciando origem (parse-agenda ou delta-insercao). */
  descartados: DescarteUnificado[]
}

// ─── Funcao principal ─────────────────────────────────────────────────────────

/**
 * Orquestrador diagnostico puro: parseia agenda shAg e calcula delta de insercao.
 *
 * APROXIMACAO DIAGNOSTICA — usa Haversine, nao OSRM.
 * Nao deve ser usado em producao.
 *
 * Pipeline:
 *   1. Normaliza equipe de entrada
 *   2. Chama parsearPontosAgendaDoDiaV2 com as linhas brutas
 *   3. Converte PontoAgendaV2[] para PontoAgendaDelta[] (formato do delta)
 *   4. Chama calcularDeltaInsercaoRotaDiagnosticoV2
 *   5. Consolida saida com descartes identificados por origem
 *
 * Se equipe for invalida, retorna ok=false sem calcular.
 * Se origem ou destino forem invalidos, retorna kmAdicionalNaRotaM=null.
 * Se agenda nao tiver pontos validos, usa rota simples origem->destino.
 * Nunca retorna 0 silencioso para erro.
 */
export function diagnosticarKmAdicionalAgendaV2(
  input: DiagnosticarKmAdicionalAgendaInput
): DiagnosticarKmAdicionalAgendaOutput {
  const avisos: string[] = []
  const descartados: DescarteUnificado[] = []

  // ── 1. Normalizar equipe ─────────────────────────────────────────────────
  const equipeNormalizada = normalizarEquipe(input.equipe)

  if (!equipeNormalizada) {
    avisos.push(`Equipe nao reconhecida: "${input.equipe}". Esperado EQUIPE 1 ou EQUIPE 2.`)
    return {
      ok: false,
      modo: 'haversine-diagnostico',
      dataISO: input.dataISO,
      equipe: input.equipe,
      kmAdicionalNaRotaM: null,
      origemKmAdicionalNaRotaM: null,
      parseAgenda: {
        ok: false,
        resumo: {
          linhasRecebidas: input.linhasAgenda.length,
          linhasDaData: 0,
          linhasDaEquipe: 0,
          pontosValidos: 0,
          pontosDescartados: 0,
          semEndereco: 0,
          semCoordenadas: 0,
        },
        avisos,
        erros: [`Equipe invalida: "${input.equipe}"`],
      },
      deltaInsercao: null,
      avisos,
      descartados,
    }
  }

  // ── 2. Parsear agenda ────────────────────────────────────────────────────
  const resultadoParse = parsearPontosAgendaDoDiaV2({
    linhasAgenda: input.linhasAgenda,
    dataAlvoISO: input.dataISO,
    equipeAlvo: equipeNormalizada,
    cacheCoordenadasPorEndereco: input.cacheCoordenadasPorEndereco,
  })

  // Consolida descartes do parse
  for (const d of resultadoParse.descartados) {
    descartados.push({ origem: 'parse-agenda', descarte: d })
  }

  // Consolida avisos do parse
  for (const a of resultadoParse.avisos) {
    avisos.push(`[parse-agenda] ${a}`)
  }
  for (const e of resultadoParse.erros) {
    avisos.push(`[parse-agenda:erro] ${e}`)
  }

  // ── 3. Converter pontos para formato do delta ────────────────────────────
  const pontosParaDelta = resultadoParse.pontos.map((p) => ({
    loc: p.coordenadas,
    addr: p.endereco,
    eventTitle: p.tituloEvento ?? undefined,
    team: p.equipe,
  }))

  // ── 4. Calcular delta de insercao ────────────────────────────────────────
  const resultadoDelta = calcularDeltaInsercaoRotaDiagnosticoV2({
    origem: input.origem,
    destino: input.destino,
    pontosAgenda: pontosParaDelta,
    modo: 'haversine-diagnostico',
  })

  // Consolida descartes do delta
  for (const d of resultadoDelta.descartados) {
    descartados.push({ origem: 'delta-insercao', descarte: d })
  }

  // Consolida avisos do delta
  for (const a of resultadoDelta.avisos) {
    avisos.push(`[delta-insercao] ${a}`)
  }

  // ── 5. Determinar kmAdicionalNaRotaM e origemKmAdicionalNaRotaM ──────────
  const kmAdicionalNaRotaM = resultadoDelta.kmAdicionalNaRotaM
  const origemKmAdicionalNaRotaM: DiagnosticarKmAdicionalAgendaOutput['origemKmAdicionalNaRotaM'] =
    kmAdicionalNaRotaM !== null ? 'agenda-shag-haversine-diagnostico' : null

  const ok = resultadoDelta.ok

  return {
    ok,
    modo: 'haversine-diagnostico',
    dataISO: input.dataISO,
    equipe: equipeNormalizada,
    kmAdicionalNaRotaM,
    origemKmAdicionalNaRotaM,
    parseAgenda: {
      ok: resultadoParse.ok,
      resumo: resultadoParse.resumo,
      avisos: resultadoParse.avisos,
      erros: resultadoParse.erros,
    },
    deltaInsercao: {
      ok: resultadoDelta.ok,
      melhorInsercao: resultadoDelta.melhorInsercao,
      resumo: resultadoDelta.resumo,
      avisos: resultadoDelta.avisos,
    },
    avisos,
    descartados,
  }
}
