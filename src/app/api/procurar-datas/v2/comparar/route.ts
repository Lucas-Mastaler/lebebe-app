// ─────────────────────────────────────────────────────────────────────────────
// GET /api/procurar-datas/v2/comparar
//
// Rota diagnóstica de comparação estrutural entre fixtures reais do legado
// e o contrato esperado do v2.
//
// NÃO FAZ:
//   - Não chama Apps Script
//   - Não chama /api/procurar-datas/pesquisar
//   - Não chama OSRM
//   - Não chama Google Calendar
//   - Não consulta Supabase
//   - Não altera produção
//   - Não é usada pelo frontend
//   - Não compara datas finais como se v2 já fosse equivalente operacional
//
// Lê fixtures do sistema de arquivos local (docs/fixtures/procurar-datas/legado/).
// Retorna comparação estrutural de cada fixture disponível.
//
// POST /api/procurar-datas/v2/comparar
//
// Rota comparadora ao vivo: executa legado e v2 lado a lado com o mesmo payload
// e retorna relatório comparativo estruturado. NÃO altera produção, NÃO altera
// frontend, NÃO altera /api/procurar-datas/pesquisar. Legado chama ApiPesquisarDatasApp
// (Apps Script síncrono). V2 chama pesquisarDatasV2 diretamente.
//
// ACESSO: somente usuários comerciais autorizados (mesmo padrão das rotas atuais).
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server'
import path from 'path'
import fs from 'fs'
import { validarAcessoProcurarDatas, respostaErroProcurarDatas } from '@/lib/procurar-datas/api'
import { compararFixtureLegadoComContratoV2 } from '@/lib/procurar-datas/motor/comparacao-legado-v2'
import {
  adaptarCandidatoV2ParaContratoLegadoDiagnostico,
  type CandidatoLegadoDiagnosticoV2,
} from '@/lib/procurar-datas/motor/adaptador-candidato-legado'
import type { CandidatoPreliminarV2 } from '@/lib/procurar-datas/motor/candidato'
import { chamarAppsScriptProcurarDatas, isTimeoutError } from '@/lib/procurar-datas/apps-script'
import { pesquisarDatasV2 } from '@/lib/procurar-datas/motor/pesquisar-datas-v2'
import type { PesquisarDatasRequest } from '@/lib/procurar-datas/contratos'

export const runtime = 'nodejs'
export const maxDuration = 300

const FIXTURES_DISPONIVEIS = [
  'caso-normal-simples-2026-06-12',
  'caso-premium-ou-especial-2026-06-12',
] as const

const DATA_REFERENCIA_ADAPTER_V2 = '2026-06-12'

type TipoCandidatoSintetico = CandidatoPreliminarV2['tipo']

export interface DiagnosticoAdapterV2Comparar {
  executado: true
  modo: 'sintetico'
  formatoDateISO: 'legado-gmt3'
  aviso: string
  dataReferenciaISO: string
  quantidadeCandidatosAdaptados: number
  tiposDemonstrados: TipoCandidatoSintetico[]
  amostra: CandidatoLegadoDiagnosticoV2[]
}

function carregarFixture(
  nomeFixture: string
): { ok: true; dados: unknown } | { ok: false; erro: string } {
  try {
    const caminhoAbsoluto = path.resolve(
      process.cwd(),
      'docs',
      'fixtures',
      'procurar-datas',
      'legado',
      `${nomeFixture}.json`
    )
    const conteudo = fs.readFileSync(caminhoAbsoluto, 'utf-8')
    return { ok: true, dados: JSON.parse(conteudo) as unknown }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return { ok: false, erro: msg }
  }
}

function criarCandidatoV2Sintetico(
  overrides: Pick<CandidatoPreliminarV2, 'id' | 'tipo' | 'dataISO' | 'indice' | 'diaSemana' | 'ehSabado' | 'ehDomingo' | 'frete' | 'distancia'> &
    Partial<Pick<CandidatoPreliminarV2, 'equipe' | 'elegivel' | 'operacional' | 'motivos' | 'avisos'>>
): CandidatoPreliminarV2 {
  const elegivel = overrides.elegivel ?? true
  const tipo = overrides.tipo

  return {
    id: overrides.id,
    elegivel,
    tipo,
    dataISO: overrides.dataISO,
    indice: overrides.indice,
    diaSemana: overrides.diaSemana,
    ehSabado: overrides.ehSabado,
    ehDomingo: overrides.ehDomingo,
    equipe: overrides.equipe ?? 'EQUIPE 1',
    operacional: overrides.operacional ?? {
      ativa: true,
      disponivelMin: 240,
      suficienteParaServico: true,
      tempoNecessarioMin: 60,
    },
    distancia: overrides.distancia,
    frete: overrides.frete,
    motivos: overrides.motivos ?? [],
    avisos: overrides.avisos ?? [],
    diagnostico: {
      origem: 'v2-preliminar',
      classificacaoTipo: tipo,
      classificacaoElegivel: elegivel,
    },
    limites: {
      limiteBaseM: null,
      limiteEspecialM: null,
      limitePremiumM: null,
    },
  }
}

function criarCandidatosV2SinteticosParaAdapter(): CandidatoPreliminarV2[] {
  return [
    criarCandidatoV2Sintetico({
      id: 'v2-sintetico-2026-06-23-equipe-1-normal',
      tipo: 'normal',
      dataISO: '2026-06-23',
      indice: 1,
      diaSemana: 2,
      ehSabado: false,
      ehDomingo: false,
      distancia: { distanciaKm: 8, kmAdicionalNaRotaM: 3000 },
      frete: { valorFrete: 110, tipoFrete: 'fixo' },
    }),
    criarCandidatoV2Sintetico({
      id: 'v2-sintetico-2026-06-30-equipe-1-premium',
      tipo: 'premium',
      dataISO: '2026-06-30',
      indice: 2,
      diaSemana: 2,
      ehSabado: false,
      ehDomingo: false,
      distancia: { distanciaKm: 24, kmAdicionalNaRotaM: 12000 },
      frete: { valorFrete: 320, tipoFrete: 'premium' },
      motivos: ['Candidato sintetico para demonstrar adapter premium.'],
    }),
    criarCandidatoV2Sintetico({
      id: 'v2-sintetico-2026-07-24-equipe-1-especial',
      tipo: 'especial',
      dataISO: '2026-07-24',
      indice: 3,
      diaSemana: 5,
      ehSabado: false,
      ehDomingo: false,
      distancia: { distanciaKm: 18, kmAdicionalNaRotaM: 8000 },
      frete: { valorFrete: 220, tipoFrete: 'especial' },
      motivos: ['Candidato sintetico para demonstrar adapter especial.'],
    }),
    criarCandidatoV2Sintetico({
      id: 'v2-sintetico-2026-07-25-equipe-2-hora-marcada',
      tipo: 'hora-marcada',
      dataISO: '2026-07-25',
      indice: 4,
      diaSemana: 6,
      ehSabado: true,
      ehDomingo: false,
      equipe: 'EQUIPE 2',
      distancia: { distanciaKm: 12, kmAdicionalNaRotaM: 5000 },
      frete: { valorFrete: 200, tipoFrete: 'hora-marcada' },
      avisos: ['Hora marcada ainda nao foi verificada por fixture real.'],
    }),
  ]
}

export function gerarDiagnosticoAdapterV2Comparar(): DiagnosticoAdapterV2Comparar {
  const candidatosSinteticos = criarCandidatosV2SinteticosParaAdapter()
  const amostra = candidatosSinteticos.map((candidato, index) =>
    adaptarCandidatoV2ParaContratoLegadoDiagnostico({
      candidato,
      rank: index + 1,
      dataReferenciaISO: DATA_REFERENCIA_ADAPTER_V2,
      formatoDateISO: 'legado-gmt3',
    })
  )

  return {
    executado: true,
    modo: 'sintetico',
    formatoDateISO: 'legado-gmt3' as const,
    aviso:
      'Candidatos v2 adaptados sao sinteticos/diagnosticos. Nao comparam equivalencia operacional real.',
    dataReferenciaISO: DATA_REFERENCIA_ADAPTER_V2,
    quantidadeCandidatosAdaptados: amostra.length,
    tiposDemonstrados: candidatosSinteticos.map((candidato) => candidato.tipo),
    amostra,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST — tipos e lógica de comparação ao vivo
// ─────────────────────────────────────────────────────────────────────────────

export interface CandidatoNormalizado {
  dataISO?: string
  equipe?: string
  tipo?: string
  rank?: number
  horaMarcada?: boolean
  kmAdicionalNaRotaM?: number | null
}

export interface DivergenciaComparacao {
  tipo: string
  severidade: 'info' | 'aviso' | 'critico'
  descricao: string
  legado?: unknown
  v2?: unknown
}

export interface ResultadoLegadoComparar {
  ok: boolean
  tempoMs: number
  erro?: string
  tipoErro?: 'timeout' | 'apps-script-erro' | 'payload-invalido'
  resultadoBruto?: unknown
  resultadoNormalizado?: {
    candidatos: CandidatoNormalizado[]
    resumo?: Record<string, unknown>
  }
}

export interface ResultadoV2Comparar {
  ok: boolean
  tempoMs: number
  erro?: string
  resultadoBruto?: unknown
  resultadoNormalizado?: {
    candidatos: CandidatoNormalizado[]
    resumo?: {
      totalRecortados?: number
      normaisRecortados?: number
      especiaisRecortados?: number
      premiumsRecortados?: number
      horaMarcadaRecortados?: number
      maxNormaisAplicado?: number
    }
  }
}

export interface ComparacaoLegadoV2Vivo {
  datasIguais: boolean
  tiposIguais: boolean
  equipesIguais: boolean
  quantidadeIgual: boolean
  divergencias: DivergenciaComparacao[]
  resumo: {
    quantidadeLegado: number
    quantidadeV2: number
    normaisLegado: number
    normaisV2: number
    extrasLegado: number
    extrasV2: number
    diferencaQuantidade: number
  }
}

export interface ComparacaoVivoOutput {
  ok: boolean
  modo: 'v2-comparar-legado'
  aviso: string
  entradaNormalizada?: unknown
  legado: ResultadoLegadoComparar
  v2: ResultadoV2Comparar
  comparacao: ComparacaoLegadoV2Vivo
  diagnosticoMinimo: {
    osrmBaseUrlUsadoV2?: string
    osrmFallbackUsadoV2?: boolean
    v2ParalelaNaoAfetaProducao: true
    frontendInalterado: true
    pesquisarLegadoInalterada: true
    avisos: string[]
  }
}

type CandidatoLegadoBruto = {
  dateISO?: string
  team?: string
  tipo?: string
  isExtra?: boolean
  rank?: number
  avisoHoraMarcada?: string
  [key: string]: unknown
}

type PayloadLegadoBruto = {
  ok?: boolean
  payload?: {
    candidates?: CandidatoLegadoBruto[]
    cep?: string
    startFromISO?: string
    [key: string]: unknown
  }
  error?: string
}

function normalizarDataLegado(dateISO: string | undefined): string | undefined {
  if (!dateISO) return undefined
  // Legado retorna formato "YYYY-MM-DDT03:00:00.000Z" (GMT-3)
  if (dateISO.length === 10) return dateISO
  return dateISO.substring(0, 10)
}

function normalizarCandidatosLegado(candidates: CandidatoLegadoBruto[]): CandidatoNormalizado[] {
  return candidates.map((c, idx) => ({
    dataISO: normalizarDataLegado(c.dateISO),
    equipe: typeof c.team === 'string' ? c.team : undefined,
    tipo: typeof c.tipo === 'string' ? c.tipo : undefined,
    rank: typeof c.rank === 'number' ? c.rank : idx + 1,
    horaMarcada: typeof c.avisoHoraMarcada === 'string' ? c.avisoHoraMarcada.length > 0 : false,
    kmAdicionalNaRotaM: null,
  }))
}

function normalizarCandidatosV2(
  candidatos: Array<{
    dataISO: string
    equipe: string
    tipo: string
    rank: number
    horaMarcada: boolean
    kmAdicionalNaRotaM: number | null
  }>
): CandidatoNormalizado[] {
  return candidatos.map((c) => ({
    dataISO: c.dataISO,
    equipe: c.equipe,
    tipo: c.tipo,
    rank: c.rank,
    horaMarcada: c.horaMarcada,
    kmAdicionalNaRotaM: c.kmAdicionalNaRotaM,
  }))
}

function contarTipos(candidatos: CandidatoNormalizado[]): {
  normais: number
  extras: number
} {
  let normais = 0
  let extras = 0
  for (const c of candidatos) {
    if (c.tipo === 'normal') normais++
    else extras++
  }
  return { normais, extras }
}

type ResumoV2Opcional = {
  totalRecortados?: number
  normaisRecortados?: number
  especiaisRecortados?: number
  premiumsRecortados?: number
  horaMarcadaRecortados?: number
  maxNormaisAplicado?: number
} | undefined

export function compararResultadosVivo(
  candidatosLegado: CandidatoNormalizado[],
  candidatosV2: CandidatoNormalizado[],
  resumoV2?: ResumoV2Opcional
): ComparacaoLegadoV2Vivo {
  const divergencias: DivergenciaComparacao[] = []

  const datasLegado = candidatosLegado.map((c) => c.dataISO).filter(Boolean) as string[]
  const datasV2 = candidatosV2.map((c) => c.dataISO).filter(Boolean) as string[]

  const datasLegadoSet = new Set(datasLegado)
  const datasV2Set = new Set(datasV2)

  const datasIguais =
    datasLegado.length === datasV2.length &&
    datasLegado.every((d) => datasV2Set.has(d))

  const tiposLegadoPorData = new Map(candidatosLegado.map((c) => [c.dataISO, c.tipo]))
  const tiposV2PorData = new Map(candidatosV2.map((c) => [c.dataISO, c.tipo]))
  const equipesLegadoPorData = new Map(candidatosLegado.map((c) => [c.dataISO, c.equipe]))
  const equipesV2PorData = new Map(candidatosV2.map((c) => [c.dataISO, c.equipe]))

  let tiposIguais = true
  let equipesIguais = true
  const quantidadeIgual = candidatosLegado.length === candidatosV2.length

  // Datas apenas no legado
  for (const data of datasLegado) {
    if (!datasV2Set.has(data)) {
      const tipoLegado = tiposLegadoPorData.get(data)
      if (tipoLegado === 'normal') {
        const maxNormaisV2 = resumoV2?.maxNormaisAplicado ?? 3
        const normaisLegado = candidatosLegado.filter((c) => c.tipo === 'normal').length
        if (normaisLegado > maxNormaisV2) {
          divergencias.push({
            tipo: 'data-apenas-no-legado-divergencia-esperada-maxnormais',
            severidade: 'info',
            descricao: `Data ${data} (normal) presente no legado mas ausente na v2. Divergencia esperada: legado pode ter mais de ${maxNormaisV2} normais; v2 limita a ${maxNormaisV2}.`,
            legado: data,
            v2: null,
          })
        } else {
          divergencias.push({
            tipo: 'data-apenas-no-legado',
            severidade: 'aviso',
            descricao: `Data ${data} presente no legado mas ausente na v2.`,
            legado: data,
            v2: null,
          })
        }
      } else {
        divergencias.push({
          tipo: 'data-apenas-no-legado',
          severidade: 'aviso',
          descricao: `Data ${data} (tipo=${tipoLegado ?? 'desconhecido'}) presente no legado mas ausente na v2.`,
          legado: data,
          v2: null,
        })
      }
    }
  }

  // Datas apenas na v2
  for (const data of datasV2) {
    if (!datasLegadoSet.has(data)) {
      divergencias.push({
        tipo: 'data-apenas-na-v2',
        severidade: 'aviso',
        descricao: `Data ${data} presente na v2 mas ausente no legado.`,
        legado: null,
        v2: data,
      })
    }
  }

  // Datas em comum: comparar tipo e equipe
  for (const data of datasLegado) {
    if (!datasV2Set.has(data)) continue
    const tipoL = tiposLegadoPorData.get(data)
    const tipoV = tiposV2PorData.get(data)
    if (tipoL !== tipoV) {
      tiposIguais = false
      divergencias.push({
        tipo: 'tipo-divergente',
        severidade: 'aviso',
        descricao: `Data ${data}: tipo legado=${tipoL} v2=${tipoV}.`,
        legado: tipoL,
        v2: tipoV,
      })
    }
    const equipeL = equipesLegadoPorData.get(data)
    const equipeV = equipesV2PorData.get(data)
    if (equipeL && equipeV && equipeL !== equipeV) {
      equipesIguais = false
      divergencias.push({
        tipo: 'equipe-divergente',
        severidade: 'aviso',
        descricao: `Data ${data}: equipe legado=${equipeL} v2=${equipeV}.`,
        legado: equipeL,
        v2: equipeV,
      })
    }
  }

  // Datas duplicadas na v2
  if (new Set(datasV2).size !== datasV2.length) {
    divergencias.push({
      tipo: 'datas-duplicadas-v2',
      severidade: 'critico',
      descricao: 'V2 retornou datas duplicadas no recorte final.',
      v2: datasV2,
    })
  }

  // maxNormais v2 violado
  const maxNormaisAplicado = resumoV2?.maxNormaisAplicado ?? 3
  const normaisV2Contados = resumoV2?.normaisRecortados
  if (typeof normaisV2Contados === 'number' && normaisV2Contados > maxNormaisAplicado) {
    divergencias.push({
      tipo: 'maxnormais-violado-v2',
      severidade: 'critico',
      descricao: `V2 retornou ${normaisV2Contados} normais mas maxNormaisAplicado=${maxNormaisAplicado}.`,
      v2: normaisV2Contados,
    })
  }

  const tiposL = contarTipos(candidatosLegado)
  const tiposV = contarTipos(candidatosV2)

  return {
    datasIguais,
    tiposIguais,
    equipesIguais,
    quantidadeIgual,
    divergencias,
    resumo: {
      quantidadeLegado: candidatosLegado.length,
      quantidadeV2: candidatosV2.length,
      normaisLegado: tiposL.normais,
      normaisV2: tiposV.normais,
      extrasLegado: tiposL.extras,
      extrasV2: tiposV.extras,
      diferencaQuantidade: candidatosV2.length - candidatosLegado.length,
    },
  }
}

async function executarLegado(body: PesquisarDatasRequest): Promise<ResultadoLegadoComparar> {
  const inicio = Date.now()
  try {
    const resultado = await chamarAppsScriptProcurarDatas<PayloadLegadoBruto>(
      'ApiPesquisarDatasApp',
      [body],
      { rota: 'v2/comparar-legado', timeoutMs: 300_000 }
    )

    const tempoMs = Date.now() - inicio

    if (!resultado?.ok) {
      return {
        ok: false,
        tempoMs,
        tipoErro: 'apps-script-erro',
        erro: resultado?.error ?? 'Legado retornou ok=false sem detalhe.',
        resultadoBruto: resultado,
      }
    }

    const candidates = (resultado.payload?.candidates ?? []) as CandidatoLegadoBruto[]
    if (!Array.isArray(candidates)) {
      return {
        ok: false,
        tempoMs,
        tipoErro: 'payload-invalido',
        erro: 'Legado retornou payload sem candidates array.',
        resultadoBruto: resultado,
      }
    }

    const candidatosNormalizados = normalizarCandidatosLegado(candidates)
    const normais = candidatosNormalizados.filter((c) => c.tipo === 'normal').length
    const extras = candidatosNormalizados.filter((c) => c.tipo !== 'normal').length

    return {
      ok: true,
      tempoMs,
      resultadoBruto: resultado,
      resultadoNormalizado: {
        candidatos: candidatosNormalizados,
        resumo: {
          totalCandidatos: candidates.length,
          normais,
          extras,
        },
      },
    }
  } catch (error: unknown) {
    const tempoMs = Date.now() - inicio
    if (isTimeoutError(error)) {
      return {
        ok: false,
        tempoMs,
        tipoErro: 'timeout',
        erro: `Legado estourou timeout apos ${Math.round(tempoMs / 1000)}s. ApiPesquisarDatasApp pode levar ate 300s em casos complexos.`,
      }
    }
    const msg = error instanceof Error ? error.message : String(error)
    return {
      ok: false,
      tempoMs,
      tipoErro: 'apps-script-erro',
      erro: msg,
    }
  }
}

async function executarV2(body: PesquisarDatasRequest): Promise<ResultadoV2Comparar> {
  const inicio = Date.now()
  try {
    const resultado = await pesquisarDatasV2(body)
    const tempoMs = Date.now() - inicio

    if (!resultado.ok) {
      return {
        ok: false,
        tempoMs,
        erro: resultado.erros?.join('; ') ?? 'V2 retornou ok=false.',
        resultadoBruto: resultado,
      }
    }

    const candidatosNormalizados = normalizarCandidatosV2(resultado.resultadoFinal.candidatosFinais)

    return {
      ok: true,
      tempoMs,
      resultadoBruto: resultado,
      resultadoNormalizado: {
        candidatos: candidatosNormalizados,
        resumo: resultado.resultadoFinal.resumo,
      },
    }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    return {
      ok: false,
      tempoMs: Date.now() - inicio,
      erro: msg,
    }
  }
}

/**
 * POST /api/procurar-datas/v2/comparar
 *
 * Executa legado (ApiPesquisarDatasApp via Apps Script) e v2 (pesquisarDatasV2)
 * lado a lado com o mesmo payload e retorna relatório comparativo estruturado.
 * Não altera produção, não altera frontend, não altera /api/procurar-datas/pesquisar.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const inicio = Date.now()
  console.log('[PROCURAR_DATAS][v2/comparar] POST inicio')

  try {
    const acesso = await validarAcessoProcurarDatas()
    if (acesso.response) return acesso.response

    const body = (await request.json()) as PesquisarDatasRequest

    // Executar legado e v2 em paralelo
    const [resultadoLegado, resultadoV2] = await Promise.all([
      executarLegado(body),
      executarV2(body),
    ])

    const candidatosLegado = resultadoLegado.resultadoNormalizado?.candidatos ?? []
    const candidatosV2 = resultadoV2.resultadoNormalizado?.candidatos ?? []
    const resumoV2 = resultadoV2.resultadoNormalizado?.resumo

    // Quando o legado falhou, não comparar dados — evita N avisos espúrios de "data-apenas-na-v2"
    const legadoFalhou = !resultadoLegado.ok
    const comparacao = legadoFalhou
      ? compararResultadosVivo([], [], undefined)
      : compararResultadosVivo(candidatosLegado, candidatosV2, resumoV2)

    // Divergência crítica: legado deu timeout
    if (resultadoLegado.tipoErro === 'timeout') {
      comparacao.divergencias.push({
        tipo: 'legado-timeout',
        severidade: 'critico',
        descricao: `Legado estourou timeout (${Math.round(resultadoLegado.tempoMs / 1000)}s). Comparacao de dados nao foi realizada. V2 respondeu ok=${resultadoV2.ok}.`,
        legado: resultadoLegado.erro,
        v2: resultadoV2.ok ? `${resultadoV2.resultadoNormalizado?.candidatos?.length ?? 0} candidatos` : resultadoV2.erro,
      })
    }

    // Divergência crítica: legado falhou por erro Apps Script (nao timeout)
    if (legadoFalhou && resultadoLegado.tipoErro !== 'timeout') {
      comparacao.divergencias.push({
        tipo: 'legado-erro',
        severidade: 'critico',
        descricao: `Legado falhou com tipoErro=${resultadoLegado.tipoErro ?? 'desconhecido'}. Comparacao de dados nao foi realizada.`,
        legado: resultadoLegado.erro,
        v2: resultadoV2.ok ? `${resultadoV2.resultadoNormalizado?.candidatos?.length ?? 0} candidatos` : resultadoV2.erro,
      })
    }

    // Divergência crítica: legado ok e v2 falhou
    if (resultadoLegado.ok && !resultadoV2.ok) {
      comparacao.divergencias.push({
        tipo: 'v2-falhou-legado-ok',
        severidade: 'critico',
        descricao: 'Legado executou com sucesso mas v2 falhou.',
        legado: resultadoLegado.ok,
        v2: resultadoV2.erro,
      })
    }

    const v2Raw = resultadoV2.resultadoBruto as import('@/lib/procurar-datas/motor/pesquisar-datas-v2').PesquisarDatasV2Output | undefined
    const osrmBaseUrlUsadoV2 = v2Raw?.diagnosticoMinimo?.osrmBaseUrlUsado
    const osrmFallbackUsadoV2 = v2Raw?.diagnosticoMinimo?.osrmFallbackUsado ?? false

    // Divergência crítica: OSRM fallback público ativado na v2
    if (osrmFallbackUsadoV2) {
      comparacao.divergencias.push({
        tipo: 'osrm-fallback-publico-v2',
        severidade: 'critico',
        descricao: 'V2 utilizou fallback OSRM público. Resultado pode divergir do OSRM dedicado.',
        v2: osrmBaseUrlUsadoV2,
      })
    }

    const avisosComparacao: string[] = []
    avisosComparacao.push('POST /api/procurar-datas/v2/comparar: rota comparadora ao vivo. Nao altera producao, frontend ou /api/procurar-datas/pesquisar.')
    if (v2Raw?.diagnosticoMinimo?.avisos?.length) {
      avisosComparacao.push(...v2Raw.diagnosticoMinimo.avisos)
    }

    const saida: ComparacaoVivoOutput = {
      ok: resultadoLegado.ok || resultadoV2.ok,
      modo: 'v2-comparar-legado',
      aviso: 'Rota comparadora ao vivo. Nao altera producao, frontend ou Apps Script.',
      legado: resultadoLegado,
      v2: resultadoV2,
      comparacao,
      diagnosticoMinimo: {
        osrmBaseUrlUsadoV2,
        osrmFallbackUsadoV2,
        v2ParalelaNaoAfetaProducao: true,
        frontendInalterado: true,
        pesquisarLegadoInalterada: true,
        avisos: avisosComparacao,
      },
    }

    console.log(
      `[PROCURAR_DATAS][v2/comparar] POST fim legadoOk=${resultadoLegado.ok} v2Ok=${resultadoV2.ok} divergencias=${comparacao.divergencias.length} duracaoMs=${Date.now() - inicio}`
    )

    return NextResponse.json(saida, { status: 200 })
  } catch (error: unknown) {
    console.error(`[PROCURAR_DATAS][v2/comparar] POST erro duracaoMs=${Date.now() - inicio}`, error)
    return respostaErroProcurarDatas(error)
  }
}

/**
 * GET /api/procurar-datas/v2/comparar
 *
 * Lê as fixtures reais/controladas do legado do sistema de arquivos local
 * e retorna a comparação estrutural de cada uma.
 *
 * Modo: "fixtures" — não chama Apps Script, não compara equivalência operacional final.
 */
export async function GET() {
  try {
    const acesso = await validarAcessoProcurarDatas()
    if (acesso.response) return acesso.response

    const comparacoes: ReturnType<typeof compararFixtureLegadoComContratoV2>[] = []
    const errosCarregamento: string[] = []

    for (const nomeFixture of FIXTURES_DISPONIVEIS) {
      const resultado = carregarFixture(nomeFixture)
      if (!resultado.ok) {
        errosCarregamento.push(
          `Falha ao carregar fixture "${nomeFixture}": ${resultado.erro}`
        )
        continue
      }
      comparacoes.push(
        compararFixtureLegadoComContratoV2({
          nomeFixture,
          fixtureLegado: resultado.dados,
        })
      )
    }

    const todasOk = comparacoes.length > 0 && comparacoes.every((c) => c.ok)
    const diagnosticoAdapterV2 = gerarDiagnosticoAdapterV2Comparar()

    return NextResponse.json(
      {
        ok: todasOk,
        versao: 'v2-comparar',
        modo: 'fixtures',
        producaoAfetada: false,
        comparacoes: comparacoes.map((c) => ({
          nomeFixture: c.nomeFixture,
          ok: c.ok,
          resumo: c.resumo,
          contratoLegado: c.contratoLegado,
          diferencas: c.diferencas,
          avisos: c.avisos,
        })),
        diagnosticoAdapterV2,
        errosCarregamento,
        avisos: [
          'diagnosticoAdapterV2 usa candidatos v2 sinteticos apenas para demonstrar formato adaptado ao contrato legado.',
          'Nao ha comparacao operacional final entre datas reais do legado e candidatos v2.',
          'v2 ainda nao usa disponibilidade real nem OSRM real neste bloco.',
          'Hora marcada ainda nao foi verificada por fixture real.',
          'Comparação estrutural baseada em fixtures. Não chama Apps Script e não compara equivalência operacional final.',
          'Fixtures carregadas do sistema de arquivos local (docs/fixtures/procurar-datas/legado/).',
          'v2 ainda usa disponibilidade sintética, Haversine diagnóstico e não consulta agenda real.',
          'Esta rota é diagnóstica. Não é usada pelo frontend e não substitui o motor legado.',
        ],
      },
      { status: 200 }
    )
  } catch (error: unknown) {
    console.error('[PROCURAR-DATAS][v2/comparar] erro:', error)
    return respostaErroProcurarDatas(error)
  }
}
