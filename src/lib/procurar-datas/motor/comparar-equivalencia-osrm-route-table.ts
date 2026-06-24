// ─────────────────────────────────────────────────────────────────────────────
// motor/comparar-equivalencia-osrm-route-table.ts
//   Helper assíncrono para comparar equivalência entre OSRM /route e /table.
//
//   Propósito:
//     Diagnosticar se o cálculo de delta de inserção via OSRM /table (v2)
//     produz resultado equivalente ao cálculo via OSRM /route por pares (legado).
//
//   Conceito:
//     Legado Apps Script usa getDrivingKm() que chama OSRM /route/v1/driving
//     para cada par de coordenadas (prev→novo, novo→next, prev→next).
//
//     V2 usa prepararMatrizOSRMDiagnosticoV2() que chama OSRM /table/v1/driving
//     para obter uma matriz completa de distâncias.
//
//     Este helper executa AMBOS os métodos para o mesmo conjunto de 3 pontos
//     (prev, novo, next) e compara os resultados.
//
//   IMPORTANTE:
//     - NÃO altera produção, candidatos, classificação.
//     - NÃO alimenta kmAdicionalNaRotaDiagnosticoM.
//     - Diagnóstico puro para validar equivalência antes de usar OSRM v2 em produção.
//     - Tolerância inicial proposta: <= 10m (ajustável).
//
//   Diferenças esperadas:
//     - /route calcula rota otimizada para cada par isoladamente.
//     - /table calcula rotas otimizadas considerando todos os pontos juntos.
//     - Em áreas urbanas, a diferença deve ser pequena (< 1%).
//     - Cache do legado (4 decimais) não é replicado aqui.
// ─────────────────────────────────────────────────────────────────────────────

import type { Coordenada } from './distancia'

// ─── Tipos de entrada ─────────────────────────────────────────────────────────

export type PontoComId = Coordenada & {
  id: string
  descricao?: string
}

/** Função que calcula distância via OSRM /route para um par de pontos. */
export type BuscarRotaOSRM = (
  de: Coordenada,
  para: Coordenada
) => Promise<{ distanciaM: number | null; ok: boolean; erro?: string }>

/** Função que calcula distância via OSRM /table (matriz). */
export type BuscarMatrizOSRM = (
  coordenadas: Coordenada[]
) => Promise<{ distances: (number | null)[][]; ok: boolean; erro?: string }>

export type CompararEquivalenciaOsrmRouteTableInput = {
  /** Ponto anterior na rota (prev). */
  prev: PontoComId

  /** Novo ponto a ser inserido (novo). */
  novo: PontoComId

  /** Próximo ponto na rota (next). */
  next: PontoComId

  /** Função injetada para OSRM /route por par. */
  buscarRotaOSRM: BuscarRotaOSRM

  /** Função injetada para OSRM /table matriz. */
  buscarMatrizOSRM: BuscarMatrizOSRM

  /** Tolerância em metros para considerar equivalente. Default: 10m. */
  toleranciaM?: number

  /** Modo fixo desta versão. */
  modo?: 'equivalencia-osrm-route-vs-table-diagnostico'
}

// ─── Tipos de saída ──────────────────────────────────────────────────────────

export type ResultadoParcial = {
  /** Distância prev → novo em metros. */
  prevNovoM: number | null

  /** Distância novo → next em metros. */
  novoNextM: number | null

  /** Distância prev → next em metros. */
  prevNextM: number | null

  /** Delta de inserção = prevNovo + novoNext - prevNext (em metros). */
  deltaM: number | null

  /** true se todas as 3 distâncias foram obtidas com sucesso. */
  completo: boolean
}

export type ComparacaoResultado = {
  /** Diferença absoluta |deltaRoute - deltaTable| em metros (sempre >= 0 quando comparacao existe). */
  diferencaAbsolutaM: number

  /**
   * Diferença percentual (deltaTable - deltaRoute) / deltaRoute * 100.
   * null se deltaRoute for 0 ou inválido.
   */
  diferencaPercentual: number | null

  /** true se table > route, false se table < route, null se incomparável. */
  tableMaiorQueRoute: boolean | null

  /** true se dentro da tolerância (|diff| <= toleranciaM). */
  equivalente: boolean

  /** Tolerância usada para comparação (metros). */
  toleranciaM: number
}

export type CompararEquivalenciaOsrmRouteTableOutput = {
  /** true se ambos os métodos retornaram deltas válidos. */
  ok: boolean

  /** Sempre 'equivalencia-osrm-route-vs-table-diagnostico'. */
  modo: 'equivalencia-osrm-route-vs-table-diagnostico'

  /** Resultado usando OSRM /route por pares (legado). */
  route: ResultadoParcial | null

  /** Resultado usando OSRM /table matriz (v2). */
  table: ResultadoParcial | null

  /** Comparação numérica entre os métodos. */
  comparacao: ComparacaoResultado | null

  /** Latência total da operação em ms. */
  latenciaMs: number

  /** Avisos informativos. */
  avisos: string[]

  /** Erros críticos que impediram a comparação. */
  erros: string[]
}

// ─── Helpers internos ────────────────────────────────────────────────────────

function calcularDelta(
  prevNovoM: number | null,
  novoNextM: number | null,
  prevNextM: number | null
): { deltaM: number | null; completo: boolean } {
  if (prevNovoM === null || novoNextM === null || prevNextM === null) {
    return { deltaM: null, completo: false }
  }
  const deltaM = Math.round(prevNovoM + novoNextM - prevNextM)
  return { deltaM, completo: true }
}

function calcularComparacao(
  deltaRouteM: number | null,
  deltaTableM: number | null,
  toleranciaM: number
): ComparacaoResultado | null {
  if (deltaRouteM === null || deltaTableM === null) {
    return null
  }

  const diferencaAbsolutaM = Math.abs(deltaTableM - deltaRouteM)

  let diferencaPercentual: number | null = null
  if (deltaRouteM !== 0) {
    diferencaPercentual = Number(((deltaTableM - deltaRouteM) / deltaRouteM * 100).toFixed(2))
  }

  return {
    diferencaAbsolutaM,
    diferencaPercentual,
    tableMaiorQueRoute: deltaTableM > deltaRouteM,
    equivalente: diferencaAbsolutaM <= toleranciaM,
    toleranciaM,
  } as ComparacaoResultado
}

// ─── Função principal ─────────────────────────────────────────────────────────

/**
 * Compara equivalência entre OSRM /route (legado) e /table (v2).
 *
 * Executa ambos os métodos para os mesmos 3 pontos (prev, novo, next)
 * e retorna comparação detalhada.
 *
 * NÃO altera produção, candidatos, classificação.
 * Diagnóstico puro para validar equivalência.
 */
export async function compararEquivalenciaOsrmRouteTableDiagnosticoV2(
  input: CompararEquivalenciaOsrmRouteTableInput
): Promise<CompararEquivalenciaOsrmRouteTableOutput> {
  const inicio = Date.now()
  const modo: CompararEquivalenciaOsrmRouteTableOutput['modo'] = 'equivalencia-osrm-route-vs-table-diagnostico'
  const toleranciaM = input.toleranciaM ?? 10 // default: 10 metros

  const avisos: string[] = [
    'Comparação OSRM /route vs /table executada apenas para diagnóstico.',
    'Não altera produção, candidatos, classificação ou kmAdicionalNaRotaDiagnosticoM.',
  ]
  const erros: string[] = []

  // ── Validação de entrada ───────────────────────────────────────────────────
  // Usar Number.isFinite() para rejeitar NaN, Infinity e -Infinity
  if (!input.prev || !Number.isFinite(input.prev.lat) || !Number.isFinite(input.prev.lng)) {
    erros.push('Prev inválido: lat/lng devem ser números finitos.')
  }
  if (!input.novo || !Number.isFinite(input.novo.lat) || !Number.isFinite(input.novo.lng)) {
    erros.push('Novo inválido: lat/lng devem ser números finitos.')
  }
  if (!input.next || !Number.isFinite(input.next.lat) || !Number.isFinite(input.next.lng)) {
    erros.push('Next inválido: lat/lng devem ser números finitos.')
  }

  if (erros.length > 0) {
    return {
      ok: false,
      modo,
      route: null,
      table: null,
      comparacao: null,
      latenciaMs: Date.now() - inicio,
      avisos,
      erros,
    }
  }

  // ── MÉTODO 1: OSRM /route por pares (legado) ────────────────────────────────
  let routeResult: ResultadoParcial | null = null
  const errosRoute: string[] = []

  try {
    // prev → novo
    const resPrevNovo = await input.buscarRotaOSRM(input.prev, input.novo)
    if (!resPrevNovo.ok || resPrevNovo.distanciaM === null) {
      errosRoute.push(`Falha prev→novo: ${resPrevNovo.erro ?? 'distância nula'}`)
    }

    // novo → next
    const resNovoNext = await input.buscarRotaOSRM(input.novo, input.next)
    if (!resNovoNext.ok || resNovoNext.distanciaM === null) {
      errosRoute.push(`Falha novo→next: ${resNovoNext.erro ?? 'distância nula'}`)
    }

    // prev → next
    const resPrevNext = await input.buscarRotaOSRM(input.prev, input.next)
    if (!resPrevNext.ok || resPrevNext.distanciaM === null) {
      errosRoute.push(`Falha prev→next: ${resPrevNext.erro ?? 'distância nula'}`)
    }

    const { deltaM, completo } = calcularDelta(
      resPrevNovo.distanciaM,
      resNovoNext.distanciaM,
      resPrevNext.distanciaM
    )

    routeResult = {
      prevNovoM: resPrevNovo.distanciaM,
      novoNextM: resNovoNext.distanciaM,
      prevNextM: resPrevNext.distanciaM,
      deltaM,
      completo,
    }

    if (!completo) {
      errosRoute.push('Cálculo route incompleto: uma ou mais distâncias falharam.')
    }
  } catch (error: unknown) {
    errosRoute.push(`Erro inesperado route: ${error instanceof Error ? error.message : String(error)}`)
  }

  if (errosRoute.length > 0) {
    avisos.push(`Route: ${errosRoute.length} erro(s) — ver erros[].`)
    erros.push(...errosRoute.map(e => `[route] ${e}`))
  }

  // ── MÉTODO 2: OSRM /table matriz (v2) ───────────────────────────────────────
  let tableResult: ResultadoParcial | null = null
  const errosTable: string[] = []

  try {
    // Ordem dos pontos na matriz: [prev, novo, next]
    const coordenadas = [input.prev, input.novo, input.next]
    const matriz = await input.buscarMatrizOSRM(coordenadas)

    if (!matriz.ok || !matriz.distances || matriz.distances.length !== 3) {
      errosTable.push('Falha ao obter matriz /table ou formato inválido.')
      // Criar resultado vazio para diagnóstico
      tableResult = {
        prevNovoM: null,
        novoNextM: null,
        prevNextM: null,
        deltaM: null,
        completo: false,
      }
    } else {
      // Índices: 0=prev, 1=novo, 2=next
      const prevNovoM = matriz.distances[0][1] // prev (0) → novo (1)
      const novoNextM = matriz.distances[1][2] // novo (1) → next (2)
      const prevNextM = matriz.distances[0][2] // prev (0) → next (2)

      // Validar valores
      if (prevNovoM === null || prevNovoM === undefined) {
        errosTable.push('Matriz retornou null para prev→novo.')
      }
      if (novoNextM === null || novoNextM === undefined) {
        errosTable.push('Matriz retornou null para novo→next.')
      }
      if (prevNextM === null || prevNextM === undefined) {
        errosTable.push('Matriz retornou null para prev→next.')
      }

      const { deltaM, completo } = calcularDelta(prevNovoM, novoNextM, prevNextM)

      tableResult = {
        prevNovoM,
        novoNextM,
        prevNextM,
        deltaM,
        completo,
      }

      if (!completo) {
        errosTable.push('Cálculo table incompleto: uma ou mais distâncias inválidas.')
      }
    }
  } catch (error: unknown) {
    errosTable.push(`Erro inesperado table: ${error instanceof Error ? error.message : String(error)}`)
  }

  if (errosTable.length > 0) {
    avisos.push(`Table: ${errosTable.length} erro(s) — ver erros[].`)
    erros.push(...errosTable.map(e => `[table] ${e}`))
  }

  // ── Comparação ───────────────────────────────────────────────────────────────
  const comparacao = calcularComparacao(
    routeResult?.deltaM ?? null,
    tableResult?.deltaM ?? null,
    toleranciaM
  )

  if (comparacao) {
    if (comparacao.equivalente) {
      avisos.push(`✅ Equivalente dentro da tolerância (≤${toleranciaM}m).`)
    } else {
      avisos.push(`⚠️ Diferença acima da tolerância (${comparacao.diferencaAbsolutaM.toFixed(0)}m > ${toleranciaM}m).`)
    }
  } else {
    avisos.push('⚠️ Comparação não disponível: deltas incompletos.')
  }

  const latenciaMs = Date.now() - inicio
  const ok = routeResult?.completo === true && tableResult?.completo === true

  return {
    ok,
    modo,
    route: routeResult,
    table: tableResult,
    comparacao,
    latenciaMs,
    avisos,
    erros,
  }
}
