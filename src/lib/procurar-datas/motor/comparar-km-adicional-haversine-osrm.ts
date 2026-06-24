// ─────────────────────────────────────────────────────────────────────────────
// motor/comparar-km-adicional-haversine-osrm.ts
//   Helper assíncrono para comparar kmAdicionalNaRotaM por Haversine vs OSRM.
//
//   Proposito:
//     Diagnosticar a diferenca entre aproximacao Haversine e OSRM Table API
//     de forma isolada, controlada e auditavel.
//
//   Fluxo:
//     1. Calcula delta por Haversine (sincrono)
//     2. Prepara matriz OSRM via buscarMatrizOSRM injetado (assincrono)
//     3. Calcula delta por OSRM via matriz (sincrono)
//     4. Compara resultados e gera estatisticas
//
//   IMPORTANTE:
//     - NAO chama OSRM real diretamente (usa buscarMatrizOSRM injetado).
//     - NAO usa fetch diretamente.
//     - NAO usa process.env.
//     - NAO integrado na rota /api/procurar-datas/v2/diagnostico nesta etapa.
//     - NAO altera frontend, producao, candidatos, classificacao.
//     - NAO substitui kmAdicionalNaRotaDiagnosticoM.
// ─────────────────────────────────────────────────────────────────────────────

import { calcularDeltaInsercaoRotaDiagnosticoV2 } from './calcular-delta-insercao-rota'
import { calcularDeltaInsercaoRotaComMatrizDiagnosticoV2 } from './calcular-delta-insercao-matriz'
import {
  prepararMatrizOSRMDiagnosticoV2,
  criarCalculadorDistanciaPorCoordenadas,
  type BuscarMatrizOSRM,
  type PontoRotaOSRM,
} from './preparar-matriz-osrm-diagnostico'
import type { Coordenada } from './distancia'

// ─── Tipos de entrada ─────────────────────────────────────────────────────────

/** Ponto da agenda com coordenadas e metadados opcionais. */
export type PontoAgendaComparativo = {
  loc: Coordenada
  addr?: string
  eventTitle?: string
  team?: string
  id?: string
}

/** Origem ou destino com identificacao opcional. */
export type LocalizacaoComparativa = Coordenada & {
  descricao?: string
  id?: string
}

export type CompararKmAdicionalHaversineVsOSRMInput = {
  /** Origem da rota (deposito ou casa da equipe). */
  origem: LocalizacaoComparativa

  /** Destino do cliente. */
  destino: LocalizacaoComparativa

  /** Pontos da agenda ja filtrados pela data/equipe. */
  pontosAgenda: PontoAgendaComparativo[]

  /**
   * Funcao injetada que acessa OSRM (ou mock nos testes).
   * Recebe coordenadas, retorna matriz de distancias.
   */
  buscarMatrizOSRM: BuscarMatrizOSRM

  /** Modo fixo desta versao. */
  modo?: 'comparacao-haversine-osrm-diagnostico'
}

// ─── Tipos de saída ───────────────────────────────────────────────────────────

export type ComparacaoKmResultado = {
  /** kmAdicionalNaRotaM calculado por Haversine (metros). */
  kmHaversineM: number | null

  /** kmAdicionalNaRotaM calculado por OSRM (metros). */
  kmOsrmM: number | null

  /** Diferenca absoluta |OSRM - Haversine| em metros. */
  diferencaAbsolutaM: number | null

  /**
   * Diferenca percentual (OSRM - Haversine) / Haversine * 100.
   * null se Haversine for 0 ou invalido.
   */
  diferencaPercentual: number | null

  /** true se OSRM > Haversine, false se OSRM < Haversine, null se incomparavel. */
  osrmMaiorQueHaversine: boolean | null
}

export type CompararKmAdicionalHaversineVsOSRMOutput = {
  /** true se ambos os calculos retornaram valores validos. */
  ok: boolean

  /** Sempre 'comparacao-haversine-osrm-diagnostico'. */
  modo: 'comparacao-haversine-osrm-diagnostico'

  /** Resultado do calculo Haversine. */
  haversine: ReturnType<typeof calcularDeltaInsercaoRotaDiagnosticoV2>

  /** Resultado do calculo OSRM via matriz. */
  osrm: ReturnType<typeof calcularDeltaInsercaoRotaComMatrizDiagnosticoV2> | null

  /** Resumo da matriz OSRM preparada (null se falhou). */
  matrizOSRM: Awaited<ReturnType<typeof prepararMatrizOSRMDiagnosticoV2>> | null

  /** Comparacao numerica entre os metodos. */
  comparacao: ComparacaoKmResultado | null

  /** Avisos informativos. */
  avisos: string[]

  /** Erros criticos que impediram a comparacao. */
  erros: string[]
}

// ─── Helpers internos ────────────────────────────────────────────────────────

function gerarIdDeterministico(prefixo: string, indice: number): string {
  return `${prefixo}_${indice}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function calcularComparacao(
  kmHaversineM: number | null,
  kmOsrmM: number | null
): ComparacaoKmResultado | null {
  // Se algum for null, comparacao eh null
  if (kmHaversineM === null || kmOsrmM === null) {
    return null
  }

  const diferencaAbsolutaM = Math.abs(kmOsrmM - kmHaversineM)

  // Evitar divisao por zero
  let diferencaPercentual: number | null = null
  if (kmHaversineM !== 0) {
    diferencaPercentual = Number(((kmOsrmM - kmHaversineM) / kmHaversineM * 100).toFixed(2))
  }

  return {
    kmHaversineM,
    kmOsrmM,
    diferencaAbsolutaM,
    diferencaPercentual,
    osrmMaiorQueHaversine: kmOsrmM > kmHaversineM,
  }
}

// ─── Funcao principal ─────────────────────────────────────────────────────────

/**
 * Compara o calculo de kmAdicionalNaRotaM entre Haversine e OSRM.
 *
 * DIAGNOSTICO.
 * NAO deve ser usado em producao.
 * NAO chama OSRM real diretamente (usa buscarMatrizOSRM injetado).
 *
 * Regras:
 *   - Se Haversine falhar e OSRM falhar: ok=false.
 *   - Se Haversine funcionar e OSRM falhar: ok=false (comparacao incompleta).
 *   - Se Haversine falhar e OSRM funcionar: ok=false (comparacao incompleta).
 *   - Se ambos funcionarem: ok=true.
 *   - Nunca usa fallback silencioso 0.
 *   - Se valor for null, comparacao fica null.
 *   - Diferenca percentual evita divisao por zero.
 *   - Nao muta input.
 */
export async function compararKmAdicionalHaversineVsOSRMDiagnosticoV2(
  input: CompararKmAdicionalHaversineVsOSRMInput
): Promise<CompararKmAdicionalHaversineVsOSRMOutput> {
  const avisos: string[] = []
  const erros: string[] = []

  // ── 1. Calcular Haversine (sincrono) ────────────────────────────────────
  const resultadoHaversine = calcularDeltaInsercaoRotaDiagnosticoV2({
    origem: input.origem,
    destino: input.destino,
    pontosAgenda: input.pontosAgenda,
    modo: 'haversine-diagnostico',
  })

  if (!resultadoHaversine.ok) {
    erros.push('Haversine: calculo falhou.')
    erros.push(...resultadoHaversine.avisos)
  } else {
    avisos.push(`Haversine: kmAdicionalNaRotaM = ${resultadoHaversine.kmAdicionalNaRotaM}m`)
  }

  // ── 2. Montar pontos para OSRM (origem + destino + agenda) ────────────────
  const pontosOSRM: PontoRotaOSRM[] = []

  // Origem
  if (Number.isFinite(input.origem.lat) && Number.isFinite(input.origem.lng)) {
    pontosOSRM.push({
      id: input.origem.id ?? 'origem',
      lat: input.origem.lat,
      lng: input.origem.lng,
      descricao: input.origem.descricao ?? 'origem',
    })
  }

  // Destino
  if (Number.isFinite(input.destino.lat) && Number.isFinite(input.destino.lng)) {
    pontosOSRM.push({
      id: input.destino.id ?? 'destino',
      lat: input.destino.lat,
      lng: input.destino.lng,
      descricao: input.destino.descricao ?? 'destino',
    })
  }

  // Pontos da agenda (validos)
  for (let i = 0; i < input.pontosAgenda.length; i++) {
    const p = input.pontosAgenda[i]
    if (Number.isFinite(p.loc.lat) && Number.isFinite(p.loc.lng)) {
      pontosOSRM.push({
        id: p.id ?? `agenda_${i}`,
        lat: p.loc.lat,
        lng: p.loc.lng,
        descricao: p.eventTitle ?? p.addr ?? `ponto_${i}`,
      })
    }
  }

  // ── 3. Preparar matriz OSRM (assincrono) ───────────────────────────────────
  let resultadoOSRM: ReturnType<typeof calcularDeltaInsercaoRotaComMatrizDiagnosticoV2> | null = null
  let matrizOSRM: Awaited<ReturnType<typeof prepararMatrizOSRMDiagnosticoV2>> | null = null

  if (pontosOSRM.length >= 2) {
    try {
      matrizOSRM = await prepararMatrizOSRMDiagnosticoV2({
        pontos: pontosOSRM,
        buscarMatrizOSRM: input.buscarMatrizOSRM,
        modo: 'osrm-mockavel-diagnostico',
      })

      if (matrizOSRM.ok) {
        // Criar funcao de distancia por coordenadas (nao por id)
        const calcularDistanciaM = criarCalculadorDistanciaPorCoordenadas(
          matrizOSRM.matrizMetros,
          pontosOSRM
        )

        // Adaptar pontos da agenda para o formato do helper de matriz
        const pontosAgendaMatriz = input.pontosAgenda
          .filter((p) => Number.isFinite(p.loc.lat) && Number.isFinite(p.loc.lng))
          .map((p) => ({
            loc: p.loc,
            addr: p.addr,
            eventTitle: p.eventTitle,
            team: p.team,
            id: p.id,
          }))

        resultadoOSRM = calcularDeltaInsercaoRotaComMatrizDiagnosticoV2({
          origem: { ...input.origem, id: input.origem.id ?? 'origem' },
          destino: { ...input.destino, id: input.destino.id ?? 'destino' },
          pontosAgenda: pontosAgendaMatriz,
          calcularDistanciaM,
          modo: 'matriz-distancia-diagnostico',
        })

        if (!resultadoOSRM.ok) {
          erros.push('OSRM: calculo do delta falhou.')
          erros.push(...resultadoOSRM.erros)
        } else {
          avisos.push(`OSRM: kmAdicionalNaRotaM = ${resultadoOSRM.kmAdicionalNaRotaM}m`)
        }
      } else {
        erros.push('OSRM: preparacao da matriz falhou.')
        erros.push(...matrizOSRM.erros)
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      erros.push(`OSRM: excecao ao preparar matriz: ${msg}`)
    }
  } else {
    erros.push(`OSRM: pontos insuficientes (${pontosOSRM.length}), minimo 2.`)
  }

  // ── 4. Calcular comparacao ────────────────────────────────────────────────
  const kmHaversineM = resultadoHaversine.ok ? resultadoHaversine.kmAdicionalNaRotaM : null
  const kmOsrmM = resultadoOSRM?.ok ? resultadoOSRM.kmAdicionalNaRotaM : null

  const comparacao = calcularComparacao(kmHaversineM, kmOsrmM)

  if (comparacao) {
    avisos.push(
      `Comparacao: diferenca absoluta = ${comparacao.diferencaAbsolutaM}m, ` +
      `percentual = ${comparacao.diferencaPercentual ?? 'N/A'}%, ` +
      `OSRM maior = ${comparacao.osrmMaiorQueHaversine}`
    )
  }

  // ── 5. Determinar ok ────────────────────────────────────────────────────────
  const ok = resultadoHaversine.ok && (resultadoOSRM?.ok ?? false)

  if (!ok) {
    erros.push('Comparacao incompleta: Haversine ou OSRM retornou erro.')
  }

  return {
    ok,
    modo: 'comparacao-haversine-osrm-diagnostico',
    haversine: resultadoHaversine,
    osrm: resultadoOSRM,
    matrizOSRM,
    comparacao,
    avisos,
    erros,
  }
}
