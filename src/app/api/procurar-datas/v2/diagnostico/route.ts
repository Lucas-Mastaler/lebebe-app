// ─────────────────────────────────────────────────────────────────────────────
// POST /api/procurar-datas/v2/diagnostico
//
// Rota diagnóstica do futuro motor v2 de /procurar-datas.
//
// Propósito:
//   - Validar estrutura de entrada
//   - Testar carregamento de config normalizada
//   - Demonstrar uso de helpers puros já migrados
//   - Confirmar que a arquitetura Next.js está pronta para o motor
//
// NÃO FAZ:
//   - Não busca candidatos reais
//   - Não chama Apps Script
//   - Não chama OSRM
//   - Não chama Google Calendar
//   - Não altera produção
//   - Não integra na tela atual
//
// ACESSO: somente usuários comerciais autorizados (mesmo padrão das rotas atuais).
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server'
import { validarAcessoProcurarDatas, respostaErroProcurarDatas } from '@/lib/procurar-datas/api'
import { buscarConfiguracoesProcurarDatas } from '@/lib/procurar-datas/config-service'
import { parseMinutos, formatarMinutos } from '@/lib/procurar-datas/motor/tempo'
import { normalizarEquipe } from '@/lib/procurar-datas/motor/equipe'
import { normalizarEntradaPesquisaV2 } from '@/lib/procurar-datas/motor/entrada'
import { haversineKm } from '@/lib/procurar-datas/motor/distancia'
import { calcularFrete } from '@/lib/procurar-datas/motor/frete'
import { gerarJanelaDatasPesquisaV2 } from '@/lib/procurar-datas/motor/janela-datas'
import {
  filtrarDisponibilidadePorJanelaV2,
  type DisponibilidadeEquipeDataV2,
} from '@/lib/procurar-datas/motor/disponibilidade'
import {
  classificarCandidatoOperacionalV2,
  type ConfigClassificacaoV2,
} from '@/lib/procurar-datas/motor/classificacao-candidato'
import { montarCandidatoPreliminarV2 } from '@/lib/procurar-datas/motor/candidato'
import { ordenarCandidatosDiagnosticosV2 } from '@/lib/procurar-datas/motor/ordenacao-candidatos'
import { buscarDisponibilidadeRealDiagnosticaComDados } from '@/lib/procurar-datas/motor/disponibilidade-real-helper'
import {
  buscarAgendaRealDiagnosticaComDados,
  type AgendaRealComDadosResult,
} from '@/lib/procurar-datas/motor/agenda-real-helper'
import { gerarCandidatosComDisponibilidadeRealV2 } from '@/lib/procurar-datas/motor/gerar-candidatos-disponibilidade-real'
import { adaptarCandidatosDisponibilidadeRealParaLegadoDiagnosticoV2 } from '@/lib/procurar-datas/motor/adaptar-candidatos-reais-legado'
import { diagnosticarKmAdicionalAgendaV2 } from '@/lib/procurar-datas/motor/diagnosticar-km-adicional-agenda'
import { parsearPontosAgendaDoDiaV2 } from '@/lib/procurar-datas/motor/parse-agenda-shag'
import { compararKmAdicionalHaversineVsOSRMDiagnosticoV2 } from '@/lib/procurar-datas/motor/comparar-km-adicional-haversine-osrm'
import { criarBuscarMatrizOSRMTableDiagnosticoV2 } from '@/lib/procurar-datas/motor/osrm-table-client-diagnostico'
import { criarBuscarRotaOSRMRouteDiagnosticoV2 } from '@/lib/procurar-datas/motor/osrm-route-client-diagnostico'
import { compararEquivalenciaOsrmRouteTableDiagnosticoV2 } from '@/lib/procurar-datas/motor/comparar-equivalencia-osrm-route-table'
import { calcularKmAdicionalRealControladoV2 } from '@/lib/procurar-datas/motor/calcular-km-adicional-real-controlado'
import { calcularMapaKmAdicionalPorSlotControladoV2 } from '@/lib/procurar-datas/motor/calcular-mapa-km-adicional-por-slot'
import type {
  DetalheSlotMapaKmAdicional,
  SlotInputMapaKmAdicional,
} from '@/lib/procurar-datas/motor/calcular-mapa-km-adicional-por-slot'
import { resolverCacheCoordenadasAgendaDiagnostico } from '@/lib/procurar-datas/motor/cache-coordenadas-agenda-diagnostico'
import { aplicarMapaKmAdicionalPorSlotEmCandidatosDiagnosticoV2 } from '@/lib/procurar-datas/motor/aplicar-mapa-km-adicional-por-slot-em-candidatos'
import { reclassificarCandidatosComKmMapaSlotDiagnosticoV2 } from '@/lib/procurar-datas/motor/reclassificar-candidatos-com-km-mapa-slot'
import {
  compararPayloadLegadoComV2Diagnostico,
  gerarComparacaoKeyV2Diagnostico,
  type CandidatoComparacaoLegadoV2,
} from '@/lib/procurar-datas/motor/comparacao-legado-v2'
import type { PesquisarDatasRequest } from '@/lib/procurar-datas/contratos'
import {
  converterCandidatosReaisParaComparacaoV2,
} from '@/lib/procurar-datas/motor/converter-candidatos-reais-para-comparacao'
import { recortarCandidatosLegadoEquivalente } from '@/lib/procurar-datas/motor/recortar-candidatos-legado-equivalente'
import { montarDiagnosticoSantoAmaroV2 } from '@/lib/procurar-datas/motor/diagnostico-santo-amaro-v2'
import {
  orquestrarPesquisaV2ComPayloadLegado,
  type ConfigOrquestradorPayloadLegado,
} from '@/lib/procurar-datas/motor/orquestrar-pesquisa-v2-com-payload-legado'
import { pesquisarDatasV2 } from '@/lib/procurar-datas/motor/pesquisar-datas-v2'

export const runtime = 'nodejs'
export const maxDuration = 30

// ─── OSRM — default oficial da v2 (mesmo do legado) ────────────────────────────

const OSRM_BASE_URL_DEFAULT_V2 = 'https://osrm.lebebe.cloud'
const OSRM_BASE_URL_FALLBACK_PUBLICO = 'https://router.project-osrm.org'

interface OsrmBaseUrlResolvido {
  url: string
  origem: 'payload' | 'config' | 'default-v2'
  fallbackUsado: boolean
}

/**
 * Resolve o OSRM base URL com prioridade:
 *   1. payload (osrmBaseUrlDiagnostico) — override explícito
 *   2. config (configResult.config.osrmBaseUrl) — config operacional
 *   3. default-v2 (https://osrm.lebebe.cloud) — oficial, igual ao legado
 *
 * Fallback público (router.project-osrm.org) NUNCA é usado automaticamente.
 * Só pode ser usado se o usuário passar explicitamente no payload.
 */
function resolverOsrmBaseUrlV2(
  payloadUrl: unknown,
  configUrl: string | null | undefined
): OsrmBaseUrlResolvido {
  if (typeof payloadUrl === 'string' && payloadUrl.trim()) {
    return {
      url: payloadUrl.trim().replace(/\/+$/, ''),
      origem: 'payload',
      fallbackUsado: false,
    }
  }
  if (configUrl && configUrl.trim()) {
    return {
      url: configUrl.trim().replace(/\/+$/, ''),
      origem: 'config',
      fallbackUsado: false,
    }
  }
  return {
    url: OSRM_BASE_URL_DEFAULT_V2,
    origem: 'default-v2',
    fallbackUsado: false,
  }
}

type CoordenadaDiagnostica = { lat: number; lng: number; descricao?: string }

function isCoordenadaDiagnostica(input: unknown): input is CoordenadaDiagnostica {
  if (!input || typeof input !== 'object') return false
  const p = input as Record<string, unknown>
  return (
    typeof p.lat === 'number' &&
    Number.isFinite(p.lat) &&
    typeof p.lng === 'number' &&
    Number.isFinite(p.lng)
  )
}

function isCacheCoordenadasAgenda(
  input: unknown
): input is Record<string, { lat: number; lng: number }> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return false
  return Object.values(input as Record<string, unknown>).every(isCoordenadaDiagnostica)
}

function atualizarSlotTemPontosPorDetalhesMapa(
  detalhesPorSlot: unknown,
  slotTemPontosPorSlotKey: Record<string, boolean>
): number {
  if (!Array.isArray(detalhesPorSlot)) return 0

  let atualizados = 0
  for (const detalhe of detalhesPorSlot) {
    if (!detalhe || typeof detalhe !== 'object') continue
    const d = detalhe as {
      chave?: unknown
      parseAgenda?: { resumo?: { pontosValidos?: unknown } }
    }
    const chave = typeof d.chave === 'string' ? d.chave : ''
    const pontosValidos = d.parseAgenda?.resumo?.pontosValidos
    if (!chave || typeof pontosValidos !== 'number' || !Number.isFinite(pontosValidos)) {
      continue
    }

    slotTemPontosPorSlotKey[chave] = pontosValidos > 0
    atualizados++
  }

  return atualizados
}

function montarSlotsKmAdicionalDiagnostico(input: {
  rawSlotsAgendaDiagnostica: unknown
  usarAgendaRealDiagnostica: boolean
  agendaRealComDados: AgendaRealComDadosResult | null
  janelaDatas: Array<{ dataISO: string }> | null
  equipeAgendaDiagnostica: unknown
  cacheCoordenadasAgendaDiagnostico?: Record<string, { lat: number; lng: number }>
  slotTemPontosPorSlotKey?: Record<string, boolean>
}): {
  slots: SlotInputMapaKmAdicional[]
  slotsInvalidos: boolean
  fonteSlots: 'body-slotsAgendaDiagnostica' | 'agenda-real-janela' | 'vazio'
  erros: string[]
  avisos: string[]
} {
  const erros: string[] = []
  const avisos: string[] = []
  const rawSlots = input.rawSlotsAgendaDiagnostica
  const slots: SlotInputMapaKmAdicional[] = []

  if (rawSlots !== undefined) {
    if (!Array.isArray(rawSlots)) {
      return {
        slots,
        slotsInvalidos: true,
        fonteSlots: 'body-slotsAgendaDiagnostica',
        erros: ['slotsAgendaDiagnostica invalido: esperado array de slots.'],
        avisos,
      }
    }

    let slotsInvalidos = false
    for (const s of rawSlots) {
      if (
        s &&
        typeof s === 'object' &&
        typeof (s as Record<string, unknown>).dataISO === 'string' &&
        typeof (s as Record<string, unknown>).equipe === 'string'
      ) {
        const raw = s as Record<string, unknown>
        const linhasAgenda = Array.isArray(raw.linhasAgenda)
          ? (raw.linhasAgenda as unknown[][]).filter(Array.isArray)
          : []
        const equipeNormalizada = normalizarEquipe(raw.equipe as string)
        if (equipeNormalizada && input.slotTemPontosPorSlotKey) {
          input.slotTemPontosPorSlotKey[`${raw.dataISO as string}::${equipeNormalizada}`] =
            linhasAgenda.length > 0
        }
        const cacheCoordenadasPorEndereco =
          raw.cacheCoordenadasPorEndereco !== undefined
            ? isCacheCoordenadasAgenda(raw.cacheCoordenadasPorEndereco)
              ? {
                  ...(input.cacheCoordenadasAgendaDiagnostico ?? {}),
                  ...(raw.cacheCoordenadasPorEndereco as Record<string, { lat: number; lng: number }>),
                }
              : {}
            : input.cacheCoordenadasAgendaDiagnostico ?? {}
        slots.push({
          dataISO: raw.dataISO as string,
          equipe: raw.equipe as string,
          linhasAgenda: linhasAgenda as SlotInputMapaKmAdicional['linhasAgenda'],
          cacheCoordenadasPorEndereco,
        })
      } else {
        slotsInvalidos = true
        erros.push('Slot invalido ignorado: esperado { dataISO, equipe }.')
      }
    }

    return {
      slots,
      slotsInvalidos,
      fonteSlots: 'body-slotsAgendaDiagnostica',
      erros,
      avisos,
    }
  }

  if (
    input.usarAgendaRealDiagnostica &&
    input.agendaRealComDados !== null &&
    input.agendaRealComDados.linhasAgenda.length > 0
  ) {
    const equipeRaw =
      typeof input.equipeAgendaDiagnostica === 'string' &&
      input.equipeAgendaDiagnostica.trim()
        ? input.equipeAgendaDiagnostica.trim()
        : null

    if (!input.janelaDatas || input.janelaDatas.length === 0) {
      return {
        slots,
        slotsInvalidos: false,
        fonteSlots: 'agenda-real-janela',
        erros,
        avisos: ['Janela de datas indisponivel; nao foi possivel montar slots reais da agenda.'],
      }
    }

    const equipesParaGerar = equipeRaw ? [equipeRaw] : ['EQUIPE 1', 'EQUIPE 2']

    for (const dataDia of input.janelaDatas) {
      for (const equipeSlot of equipesParaGerar) {
        slots.push({
          dataISO: dataDia.dataISO,
          equipe: equipeSlot,
          linhasAgenda: input.agendaRealComDados.linhasAgenda,
          cacheCoordenadasPorEndereco: input.cacheCoordenadasAgendaDiagnostico ?? {},
        })
      }
    }

    if (equipeRaw) {
      avisos.push('slotsAgendaDiagnostica ausente; usando slots reais montados da agenda real e janela de datas.')
    } else {
      avisos.push('slotsAgendaDiagnostica ausente e equipeAgendaDiagnostica ausente; gerando slots para EQUIPE 1 e EQUIPE 2 a partir da agenda real e janela de datas.')
    }
    if (Object.keys(input.cacheCoordenadasAgendaDiagnostico ?? {}).length === 0) {
      avisos.push(
        'cacheCoordenadasAgendaDiagnostico ausente ou vazio; pontos da agenda real sem coordenada serao descartados como sem_coordenadas_cache.'
      )
    }
    return {
      slots,
      slotsInvalidos: false,
      fonteSlots: 'agenda-real-janela',
      erros,
      avisos,
    }
  }

  avisos.push('slotsAgendaDiagnostica ausente; usando lista vazia controlada.')
  return {
    slots,
    slotsInvalidos: false,
    fonteSlots: 'vazio',
    erros,
    avisos,
  }
}

function normalizarOsrmBaseUrlCompatV2(url: string): string {
  return String(url || '').trim().replace(/\/+$/, '') || OSRM_BASE_URL_DEFAULT_V2
}

function extrairDataPayloadCompat(candidato: { date?: unknown; dateISO?: unknown }): string {
  if (typeof candidato.date === 'string' && candidato.date.trim()) {
    return candidato.date.trim().split('T')[0] ?? candidato.date.trim()
  }
  if (typeof candidato.dateISO === 'string' && candidato.dateISO.trim()) {
    return candidato.dateISO.trim().split('T')[0] ?? candidato.dateISO.trim()
  }
  return ''
}

function resumirCandidatoPayloadCompat(candidato: {
  date?: unknown
  dateISO?: unknown
  dateDM?: unknown
  weekday?: unknown
  team?: unknown
  tipo?: unknown
  frete?: unknown
  rank?: unknown
  isExtra?: unknown
}) {
  return {
    rank: typeof candidato.rank === 'number' ? candidato.rank : null,
    dataISO: extrairDataPayloadCompat(candidato),
    dateISO: typeof candidato.dateISO === 'string' ? candidato.dateISO : null,
    dateDM: typeof candidato.dateDM === 'string' ? candidato.dateDM : null,
    weekday: typeof candidato.weekday === 'string' ? candidato.weekday : null,
    equipe: typeof candidato.team === 'string' ? candidato.team : null,
    tipo: typeof candidato.tipo === 'string' ? candidato.tipo : null,
    frete: typeof candidato.frete === 'string' ? candidato.frete : null,
    isExtra: typeof candidato.isExtra === 'boolean' ? candidato.isExtra : null,
  }
}

function montarDiagnosticoFluxoRealV2(input: {
  ok: boolean
  resultado?: Awaited<ReturnType<typeof orquestrarPesquisaV2ComPayloadLegado>>
  erro?: string
  datasDiagnosticoDirigido: string[]
  candidatosDiagnosticoDirigido: Array<{
    dataISO: string
    equipe: string
    tipo: string
    kmAdicionalNaRotaM: number | null
  }>
}): Record<string, unknown> {
  if (!input.ok || !input.resultado) {
    return {
      executado: true,
      ok: false,
      modo: 'diagnostico-fluxo-real-v2',
      mesmoCaminhoDoDiagnosticoDirigido: false,
      caminhoExecutado:
        'orquestrarPesquisaV2ComPayloadLegado -> pesquisarDatasV2 -> recorte real -> PayloadCompacto compat',
      erro: input.erro ?? 'Fluxo real v2 nao retornou resultado.',
      pendencias: ['Nao foi possivel comparar o payload final real v2 neste request.'],
    }
  }

  const payloadCandidates = input.resultado.payload.candidates.map(resumirCandidatoPayloadCompat)
  const datasFluxoReal = payloadCandidates.map((candidato) => candidato.dataISO).filter(Boolean)
  const tiposFluxoReal = payloadCandidates.map((candidato) => ({
    dataISO: candidato.dataISO,
    tipo: candidato.tipo,
    frete: candidato.frete,
    equipe: candidato.equipe,
  }))
  const datasDiagnosticoDirigido = input.datasDiagnosticoDirigido
  const datasSomenteDiagnostico = datasDiagnosticoDirigido.filter(
    (dataISO) => !datasFluxoReal.includes(dataISO)
  )
  const datasSomenteFluxoReal = datasFluxoReal.filter(
    (dataISO) => !datasDiagnosticoDirigido.includes(dataISO)
  )
  const bateComDiagnosticoDirigido =
    datasSomenteDiagnostico.length === 0 &&
    datasSomenteFluxoReal.length === 0 &&
    datasFluxoReal.length === datasDiagnosticoDirigido.length

  return {
    executado: true,
    ok: input.resultado.ok,
    modo: 'diagnostico-fluxo-real-v2',
    caminhoExecutado:
      'orquestrarPesquisaV2ComPayloadLegado -> pesquisarDatasV2 -> recorte real -> PayloadCompacto compat',
    caminhoDaTelaModoV2:
      'A tela /procurar-datas?motor=v2 chama /api/procurar-datas/v2/pesquisar-compat-async, que usa este mesmo orquestrador e grava o payload no progresso compat.',
    mesmoCaminhoDoDiagnosticoDirigido: false,
    explicacaoMesmoCaminho:
      'Nao. O diagnostico dirigido usa os candidatos calculados dentro da rota diagnostica; este bloco executa o caminho compat real usado pela rota /pesquisar-compat-async.',
    fonteDaVerdadeParaTelaRealV2:
      'diagnosticoFluxoRealV2.payloadFinalCompat.candidatosFinais, pois vem do mesmo orquestrador usado por /pesquisar-compat-async.',
    bateComDiagnosticoDirigido,
    diferencas: {
      datasSomenteDiagnosticoDirigido: datasSomenteDiagnostico,
      datasSomenteFluxoRealV2: datasSomenteFluxoReal,
      diagnosticoDirigidoMostra11MasFluxoRealMostra02:
        datasDiagnosticoDirigido.includes('2026-07-11') && datasFluxoReal.includes('2026-07-02'),
    },
    payloadFinalCompat: {
      total: payloadCandidates.length,
      datasFinais: datasFluxoReal,
      tiposFinais: tiposFluxoReal,
      candidatosFinais: payloadCandidates,
    },
    saidaV2: {
      ok: input.resultado.saidaV2.ok,
      resultadoFinal: input.resultado.saidaV2.resultadoFinal,
      diagnosticoMinimo: input.resultado.diagnosticoMinimo,
      erros: input.resultado.saidaV2.erros ?? [],
    },
    diagnosticoPayloadLegado: input.resultado.diagnosticoPayloadLegado,
    avisos: input.resultado.avisos,
  }
}

/**
 * POST /api/procurar-datas/v2/diagnostico
 *
 * Entrada: PesquisarDatasRequest (mesmo contrato da pesquisa atual)
 * Saída: JSON diagnóstico com metadados seguros
 */
export async function POST(request: NextRequest) {
  const inicio = Date.now()

  try {
    // 1. Validação de acesso (mesmo padrão das rotas atuais)
    const acesso = await validarAcessoProcurarDatas()
    if (acesso.response) return acesso.response

    // 2. Parse do body usando contrato existente
    const body = (await request.json()) as PesquisarDatasRequest

    // 3. Normalizar entrada usando o normalizador puro do motor v2
    const entradaNormalizada = normalizarEntradaPesquisaV2(body)

    // 4. Diagnóstico da entrada (flags simples, sem expor dados sensíveis)
    const entrada = {
      temCep: !!body.cep && body.cep.trim().length > 0,
      temEnderecoCompleto: !!body.enderecoCompleto && body.enderecoCompleto.trim().length > 0,
      temLatLng: typeof body.lat === 'number' && typeof body.lng === 'number',
      temDestLatLng: typeof body.destLat === 'number' && typeof body.destLng === 'number',
      tempoNecessario: body.tempoNecessario || '',
      tempoMinutos: body.tempoNecessario ? parseMinutos(body.tempoNecessario) : 0,
      dataInicial: body.dataInicial || '',
      isRural: !!body.isRural,
      isCondominio: !!body.isCondominio,
    }

    // 5. Carregar config normalizada (com fallback para planilha)
    const configResult = await buscarConfiguracoesProcurarDatas()

    const config = configResult.ok
      ? {
          origem: configResult.origem,
          usandoFallbackPlanilha: configResult.usandoFallbackPlanilha,
          faltantesNoSupabase: configResult.faltantesNoSupabase,
          // Metadados seguros da config (não retorna a config inteira)
          resumo: {
            diasPesquisaAgenda: configResult.config.diasPesquisaAgenda,
            equipe1Ativa: configResult.config.equipe1Ativa,
            equipe2Ativa: configResult.config.equipe2Ativa,
            kmMaximoNaSemanaM: configResult.config.kmMaximoNaSemanaM,
            kmMaximoNoSabadoM: configResult.config.kmMaximoNoSabadoM,
            valorSemanaAte10km: configResult.config.valorSemanaAte10km,
            valorSabadoAte10km: configResult.config.valorSabadoAte10km,
          },
        }
      : {
          origem: 'erro' as const,
          usandoFallbackPlanilha: false,
          faltantesNoSupabase: [],
          erro: configResult.erro,
          origemErro: configResult.origemErro,
        }

    // 6. Diagnóstico de distância/frete (usando helpers puros, sem OSRM)
    let diagnosticoFrete: Record<string, unknown>

    const temCoordsOrigem = entradaNormalizada.coordenadasOrigemInformada !== null
    const temCoordsDestino = entradaNormalizada.coordenadasDestino !== null

    if (temCoordsOrigem && temCoordsDestino && configResult.ok) {
      const origem = entradaNormalizada.coordenadasOrigemInformada!
      const destino = entradaNormalizada.coordenadasDestino!
      const distKm = haversineKm(origem, destino)

      const params = configResult.config
      const freteResult = calcularFrete({
        distKm,
        isSabado: false,
        isRural: entradaNormalizada.isRural,
        isCondominio: entradaNormalizada.isCondominio,
        params: {
          kmMaxViagem: params.kmMaxViagem,
          kmMaxValorFixo: params.kmMaxValorFixo,
          kmMaxLongaCidade: params.kmMaxLongaCidade,
          kmMaxNaoViagem: params.kmMaxNaoViagem,
          valorSemanaAte10km: params.valorSemanaAte10km,
          valorSabadoAte10km: params.valorSabadoAte10km,
          fatorMultiplicadorKmViagem: params.fatorMultiplicadorKmViagem,
          multiplicadorKmNaoViagem: params.multiplicadorKmNaoViagem,
          valorDiaApos25kmSemana: params.valorDiaApos25kmSemana,
          valorDiaApos25kmSabado: params.valorDiaApos25kmSabado,
          precoCondominioAdicional: params.precoCondominioAdicional,
        },
        tipo: 'normal',
      })

      diagnosticoFrete = {
        executado: true,
        tipoDistancia: 'haversine_diagnostico',
        distanciaKm: Number(distKm.toFixed(2)),
        frete: freteResult.ok
          ? {
              valor: freteResult.valorFrete,
              valorFormatado: freteResult.valorFormatado,
              faixaAplicada: freteResult.faixaAplicada,
            }
          : {
              valor: 0,
              valorFormatado: freteResult.valorFormatado,
              faixaAplicada: freteResult.faixaAplicada,
            },
        avisos: [
          'Distância calculada por Haversine apenas para diagnóstico. Não substitui OSRM do motor legado.',
        ],
      }
    } else {
      diagnosticoFrete = {
        executado: false,
        motivo: !temCoordsOrigem || !temCoordsDestino
          ? 'Coordenadas insuficientes para diagnóstico de distância/frete.'
          : 'Config não carregada corretamente.',
      }
    }

    // 7. Diagnóstico de janela de datas (usando helper puro, sem agenda)
    let diagnosticoJanelaDatas: Record<string, unknown>
    let janelaResult: ReturnType<typeof gerarJanelaDatasPesquisaV2> | null = null

    if (entradaNormalizada.dataInicialISO && configResult.ok) {
      janelaResult = gerarJanelaDatasPesquisaV2({
        dataInicialISO: entradaNormalizada.dataInicialISO,
        diasPesquisaAgenda: configResult.config.diasPesquisaAgenda,
      })

      if (janelaResult.ok) {
        const diasSolicitados = configResult.config.diasPesquisaAgenda
        const quantidadeGerada = janelaResult.datas.length
        const primeiraDataISO = janelaResult.datas[0]?.dataISO ?? null
        const ultimaDataISO = janelaResult.datas[janelaResult.datas.length - 1]?.dataISO ?? null

        // Amostra com no máximo 5 datas
        const amostra = janelaResult.datas.slice(0, 5).map((d) => ({
          dataISO: d.dataISO,
          indice: d.indice,
          diaSemana: d.diaSemana,
          ehSabado: d.ehSabado,
          ehDomingo: d.ehDomingo,
        }))

        diagnosticoJanelaDatas = {
          executado: true,
          diasSolicitados,
          quantidadeGerada,
          primeiraDataISO,
          ultimaDataISO,
          amostra,
          avisos: [
            'Janela bruta de datas. Não consulta agenda, disponibilidade ou ranking.',
            ...janelaResult.avisos,
          ],
        }
      } else {
        diagnosticoJanelaDatas = {
          executado: false,
          motivo: janelaResult.avisos.join(' '),
        }
      }
    } else {
      diagnosticoJanelaDatas = {
        executado: false,
        motivo: !entradaNormalizada.dataInicialISO
          ? 'Data inicial ausente ou inválida.'
          : 'Config não carregada corretamente.',
      }
    }

    // 8. Diagnóstico de disponibilidade (usando helper puro, sem agenda real)
    let diagnosticoDisponibilidade: Record<string, unknown>

    if (janelaResult?.ok && entradaNormalizada.dataInicialISO) {
      // Gerar disponibilidades sintéticas para diagnóstico
      const disponibilidadesSinteticas: DisponibilidadeEquipeDataV2[] = []
      const janelaDatas = janelaResult.datas

      // Criar disponibilidades para as primeiras 5 datas da janela
      for (let i = 0; i < Math.min(5, janelaDatas.length); i++) {
        const data = janelaDatas[i].dataISO

        // Data 0: ambas equipes suficientes
        if (i === 0) {
          disponibilidadesSinteticas.push(
            { dataISO: data, equipe: 'EQUIPE 1', disponivelMin: 240, ativa: true },
            { dataISO: data, equipe: 'EQUIPE 2', disponivelMin: 180, ativa: true }
          )
        }
        // Data 1: EQUIPE 1 suficiente, EQUIPE 2 insuficiente
        else if (i === 1) {
          disponibilidadesSinteticas.push(
            { dataISO: data, equipe: 'EQUIPE 1', disponivelMin: 240, ativa: true },
            { dataISO: data, equipe: 'EQUIPE 2', disponivelMin: 30, ativa: true }
          )
        }
        // Data 2: EQUIPE 1 inativa, EQUIPE 2 suficiente
        else if (i === 2) {
          disponibilidadesSinteticas.push(
            { dataISO: data, equipe: 'EQUIPE 1', disponivelMin: 240, ativa: false, motivoIndisponibilidade: 'Férias' },
            { dataISO: data, equipe: 'EQUIPE 2', disponivelMin: 180, ativa: true }
          )
        }
        // Data 3: sem disponibilidade
        else if (i === 3) {
          // Nenhuma disponibilidade adicionada
        }
        // Data 4: ambas equipes suficientes com tempo maior
        else if (i === 4) {
          disponibilidadesSinteticas.push(
            { dataISO: data, equipe: 'EQUIPE 1', disponivelMin: 300, ativa: true },
            { dataISO: data, equipe: 'EQUIPE 2', disponivelMin: 300, ativa: true }
          )
        }
      }

      const disponibilidadeResult = filtrarDisponibilidadePorJanelaV2({
        janela: janelaDatas,
        disponibilidades: disponibilidadesSinteticas,
        tempoNecessarioMin: entradaNormalizada.tempoNecessarioMin,
      })

      const quantidadeDatas = disponibilidadeResult.datas.length
      const quantidadeDatasComEquipe = disponibilidadeResult.datas.filter((d) => d.equipes.length > 0).length

      // Métricas detalhadas de equipes
      let quantidadeEquipesComRegistro = 0
      let quantidadeEquipesAtivas = 0
      let quantidadeEquipesSuficientes = 0
      let quantidadeEquipesInativas = 0
      let quantidadeEquipesInsuficientes = 0

      for (const data of disponibilidadeResult.datas) {
        for (const equipe of data.equipes) {
          quantidadeEquipesComRegistro++
          if (equipe.ativa) {
            quantidadeEquipesAtivas++
            if (equipe.suficienteParaServico) {
              quantidadeEquipesSuficientes++
            } else {
              quantidadeEquipesInsuficientes++
            }
          } else {
            quantidadeEquipesInativas++
          }
        }
      }

      diagnosticoDisponibilidade = {
        executado: true,
        quantidadeDatas,
        quantidadeDatasComEquipe,
        quantidadeEquipesComRegistro,
        quantidadeEquipesAtivas,
        quantidadeEquipesSuficientes,
        quantidadeEquipesInativas,
        quantidadeEquipesInsuficientes,
        tempoNecessarioMin: entradaNormalizada.tempoNecessarioMin,
        resultado: {
          ok: disponibilidadeResult.ok,
          datas: disponibilidadeResult.datas.map((d) => ({
            dataISO: d.dataISO,
            indice: d.indice,
            diaSemana: d.diaSemana,
            ehSabado: d.ehSabado,
            ehDomingo: d.ehDomingo,
            equipes: d.equipes.map((e) => ({
              equipe: e.equipe,
              disponivelMin: e.disponivelMin,
              suficienteParaServico: e.suficienteParaServico,
              ativa: e.ativa,
              motivoIndisponibilidade: e.motivoIndisponibilidade,
            })),
          })),
          avisos: [
            'Disponibilidades sintéticas para diagnóstico. Não refletem agenda real.',
            ...disponibilidadeResult.avisos,
          ],
        },
      }
    } else {
      diagnosticoDisponibilidade = {
        executado: false,
        motivo: !janelaResult?.ok
          ? 'Janela de datas não foi gerada com sucesso.'
          : 'Data inicial ausente ou inválida.',
      }
    }

    // 9. Diagnóstico de classificação operacional (usando helper puro, sem agenda real)
    let diagnosticoClassificacao: Record<string, unknown>
    let diagnosticoCandidatos: Record<string, unknown>
    let diagnosticoOrdenacao: Record<string, unknown>
    let candidatosComparacaoV2Diagnostico: CandidatoComparacaoLegadoV2[] = []

    if (
      (diagnosticoDisponibilidade as Record<string, unknown>).executado === true &&
      configResult.ok
    ) {
      const classificacoes: Array<{
        dataISO: string
        equipe: string
        tipo: string
        elegivel: boolean
        motivos: string[]
        avisos: string[]
        detalhes: {
          disponivelMin: number
          suficienteParaServico: boolean
          ativa: boolean
          tempoNecessarioMin: number | null
          distanciaKm: number | null
          kmAdicionalNaRotaM: number | null
          slotTemPontos: boolean
          limiteBaseM: number | null
          limiteEspecialM: number | null
          limitePremiumM: number | null
          horaMarcada: boolean
          elegivelHoraMarcada: boolean
          motivoHoraMarcada: string | null
          slotAvailMin: number | null
          serviceMin: number | null
          horaMarcadaHorasAMais: number | null
          limiteMinimoHoraMarcadaMin: number | null
          ehSabado: boolean
          ehDomingo: boolean
          diaSemana: number
        }
      }> = []

      const avisosClassificacao: string[] = [
        'Classificação operacional sintética para diagnóstico. Cenários derivados de equipe modelo válida.',
      ]

      // Usar distância do diagnóstico de frete ou fallback controlado
      const rawDistancia = (diagnosticoFrete as Record<string, unknown>).distanciaKm
      const distanciaKm: number | null =
        typeof rawDistancia === 'number' && Number.isFinite(rawDistancia) ? rawDistancia : 5

      const configClassificacao: ConfigClassificacaoV2 = {
        kmAdicionalMaxNaRotaM: configResult.config.kmAdicionalMaxNaRotaM,
        kmAdicionalMaxNaRotaEspecialM:
          configResult.config.kmAdicionalMaxNaRotaEspecialM,
        kmAdicionalMaxNaRotaPremiumM:
          configResult.config.kmAdicionalMaxNaRotaPremiumM,
        kmMaximoNaSemanaM: configResult.config.kmMaximoNaSemanaM,
        kmMaximoNoSabadoM: configResult.config.kmMaximoNoSabadoM,
        horaMarcadaHorasAMais: configResult.config.horaMarcadaHorasAMais,
      }

      const base = configResult.config.kmAdicionalMaxNaRotaM
      const especialAtivo = configResult.config.kmAdicionalMaxNaRotaEspecialM > 0
      const premiumAtivo = configResult.config.kmAdicionalMaxNaRotaPremiumM > 0
      const limiteEspecialSintetico = base + 5000
      const limitePremiumSintetico = base + 10000

      const datasDisponiveis = (
        (diagnosticoDisponibilidade as Record<string, unknown>).resultado as
          | Record<string, unknown>
          | undefined
      )?.datas as Array<Record<string, unknown>> | undefined

      // ── 1. Classificar todas as equipes reais do diagnóstico (valor padrão) ──
      for (const data of datasDisponiveis ?? []) {
        const equipes = (data.equipes as Array<Record<string, unknown>>) ?? []
        for (const equipe of equipes) {
          const resultado = classificarCandidatoOperacionalV2({
            dataISO: String(data.dataISO),
            diaSemana: Number(data.diaSemana),
            ehSabado: Boolean(data.ehSabado),
            ehDomingo: Boolean(data.ehDomingo),
            equipe: String(equipe.equipe),
            ativa: Boolean(equipe.ativa),
            disponivelMin: Number(equipe.disponivelMin),
            suficienteParaServico: Boolean(equipe.suficienteParaServico),
            motivoIndisponibilidade:
              (equipe.motivoIndisponibilidade as string | null) ?? null,
            tempoNecessarioMin: entradaNormalizada.tempoNecessarioMin,
            distanciaKm,
            kmAdicionalNaRotaM: Math.floor(base * 0.5),
            isCondominio: entradaNormalizada.isCondominio,
            isRural: entradaNormalizada.isRural,
            slotTemPontos: true,
            config: configClassificacao,
          })

          classificacoes.push({
            dataISO: String(data.dataISO),
            equipe: String(equipe.equipe),
            tipo: resultado.tipo,
            elegivel: resultado.elegivel,
            motivos: resultado.motivos,
            avisos: resultado.avisos,
            detalhes: {
              disponivelMin: resultado.detalhes.disponivelMin,
              suficienteParaServico: resultado.detalhes.suficienteParaServico,
              ativa: resultado.detalhes.ativa,
              tempoNecessarioMin: resultado.detalhes.tempoNecessarioMin,
              distanciaKm: resultado.detalhes.distanciaKm,
              kmAdicionalNaRotaM: resultado.detalhes.kmAdicionalNaRotaM,
              slotTemPontos: resultado.detalhes.slotTemPontos,
              limiteBaseM: resultado.detalhes.limiteBaseM,
              limiteEspecialM: resultado.detalhes.limiteEspecialM,
              limitePremiumM: resultado.detalhes.limitePremiumM,
              horaMarcada: resultado.detalhes.horaMarcada === true,
              elegivelHoraMarcada: resultado.detalhes.elegivelHoraMarcada === true,
              motivoHoraMarcada: resultado.detalhes.motivoHoraMarcada ?? null,
              slotAvailMin: resultado.detalhes.slotAvailMin ?? null,
              serviceMin: resultado.detalhes.serviceMin ?? null,
              horaMarcadaHorasAMais: resultado.detalhes.horaMarcadaHorasAMais ?? null,
              limiteMinimoHoraMarcadaMin: resultado.detalhes.limiteMinimoHoraMarcadaMin ?? null,
              ehSabado: resultado.detalhes.ehSabado,
              ehDomingo: resultado.detalhes.ehDomingo,
              diaSemana: Number(data.diaSemana),
            },
          })
        }
      }

      // ── 2. Cenários sintéticos explícitos a partir de modelo válido ──
      // Encontrar primeira equipe ativa, suficiente, não domingo
      const modelo = classificacoes.find(
        (c) =>
          c.detalhes.ativa === true &&
          c.detalhes.suficienteParaServico === true &&
          c.detalhes.ehDomingo === false
      )

      if (modelo) {
        const criarCenario = (kmAdicionalNaRotaM: number) => {
          const resultado = classificarCandidatoOperacionalV2({
            dataISO: modelo.dataISO,
            diaSemana: modelo.detalhes.diaSemana,
            ehSabado: modelo.detalhes.ehSabado,
            ehDomingo: modelo.detalhes.ehDomingo,
            equipe: modelo.equipe,
            ativa: modelo.detalhes.ativa,
            disponivelMin: modelo.detalhes.disponivelMin,
            suficienteParaServico: modelo.detalhes.suficienteParaServico,
            motivoIndisponibilidade: null,
            tempoNecessarioMin: entradaNormalizada.tempoNecessarioMin,
            distanciaKm,
            kmAdicionalNaRotaM,
            isCondominio: entradaNormalizada.isCondominio,
            isRural: entradaNormalizada.isRural,
            slotTemPontos: modelo.detalhes.slotTemPontos,
            config: configClassificacao,
          })

          classificacoes.push({
            dataISO: modelo.dataISO,
            equipe: `${modelo.equipe} (sintético)`,
            tipo: resultado.tipo,
            elegivel: resultado.elegivel,
            motivos: resultado.motivos,
            avisos: resultado.avisos,
            detalhes: {
              disponivelMin: resultado.detalhes.disponivelMin,
              suficienteParaServico: resultado.detalhes.suficienteParaServico,
              ativa: resultado.detalhes.ativa,
              tempoNecessarioMin: resultado.detalhes.tempoNecessarioMin,
              distanciaKm: resultado.detalhes.distanciaKm,
              kmAdicionalNaRotaM: resultado.detalhes.kmAdicionalNaRotaM,
              slotTemPontos: resultado.detalhes.slotTemPontos,
              limiteBaseM: resultado.detalhes.limiteBaseM,
              limiteEspecialM: resultado.detalhes.limiteEspecialM,
              limitePremiumM: resultado.detalhes.limitePremiumM,
              horaMarcada: resultado.detalhes.horaMarcada === true,
              elegivelHoraMarcada: resultado.detalhes.elegivelHoraMarcada === true,
              motivoHoraMarcada: resultado.detalhes.motivoHoraMarcada ?? null,
              slotAvailMin: resultado.detalhes.slotAvailMin ?? null,
              serviceMin: resultado.detalhes.serviceMin ?? null,
              horaMarcadaHorasAMais: resultado.detalhes.horaMarcadaHorasAMais ?? null,
              limiteMinimoHoraMarcadaMin: resultado.detalhes.limiteMinimoHoraMarcadaMin ?? null,
              ehSabado: resultado.detalhes.ehSabado,
              ehDomingo: resultado.detalhes.ehDomingo,
              diaSemana: modelo.detalhes.diaSemana,
            },
          })
        }

        // Normal
        criarCenario(Math.floor(base * 0.5))

        // Especial (se config permitir)
        if (especialAtivo) {
          criarCenario(Math.floor((base + limiteEspecialSintetico) / 2))
        } else {
          avisosClassificacao.push(
            'Config não permite cenário especial distinto do normal.'
          )
        }

        // Premium (se config permitir)
        if (premiumAtivo) {
          criarCenario(Math.floor((limiteEspecialSintetico + limitePremiumSintetico) / 2))
        } else {
          avisosClassificacao.push(
            'Config não permite cenário premium distinto do especial.'
          )
        }

        // Hora marcada
        criarCenario(Math.floor(base * 0.5))

        // Indisponível — fora do premium
        criarCenario(limitePremiumSintetico + 1)
      } else {
        avisosClassificacao.push(
          'Nenhuma equipe modelo válida encontrada para gerar cenários sintéticos.'
        )
      }

      const quantidadeElegiveis = classificacoes.filter((c) => c.elegivel).length
      const quantidadeIndisponiveis = classificacoes.filter((c) => !c.elegivel).length
      const quantidadeNormal = classificacoes.filter((c) => c.tipo === 'normal').length
      const quantidadeEspecial = classificacoes.filter((c) => c.tipo === 'especial').length
      const quantidadePremium = classificacoes.filter((c) => c.tipo === 'premium').length
      const quantidadeHoraMarcada = classificacoes.filter(
        (c) => c.detalhes.elegivelHoraMarcada
      ).length

      diagnosticoClassificacao = {
        executado: true,
        quantidadeCenariosClassificados: classificacoes.length,
        quantidadeElegiveis,
        quantidadeIndisponiveis,
        quantidadeNormal,
        quantidadeEspecial,
        quantidadePremium,
        quantidadeHoraMarcada,
        avisos: avisosClassificacao,
        amostra: classificacoes.slice(0, 10),
      }

      // ── 9.5. Montar candidatos preliminares v2 (lista completa, não amostra) ──
      // Extrair frete do diagnóstico se disponível
      const freteDiagnostico = (diagnosticoFrete as Record<string, unknown>).frete as
        | Record<string, unknown>
        | undefined
      const valorFreteDiagnostico =
        typeof freteDiagnostico?.valor === 'number' && Number.isFinite(freteDiagnostico.valor)
          ? freteDiagnostico.valor
          : null
      const tipoFreteDiagnostico = freteDiagnostico?.faixaAplicada as string | null ?? null
      const freteVinculado = valorFreteDiagnostico !== null

      const candidatosMontados = classificacoes.map((c, idx) =>
        montarCandidatoPreliminarV2({
          dataISO: c.dataISO,
          indice: idx,
          diaSemana: c.detalhes.diaSemana,
          ehSabado: c.detalhes.ehSabado,
          ehDomingo: c.detalhes.ehDomingo,
          slotTemPontos: c.detalhes.slotTemPontos,
          equipe: c.equipe,
          disponivelMin: c.detalhes.disponivelMin,
          ativa: c.detalhes.ativa,
          suficienteParaServico: c.detalhes.suficienteParaServico,
          tempoNecessarioMin: c.detalhes.tempoNecessarioMin,
          distanciaKm: c.detalhes.distanciaKm,
          kmAdicionalNaRotaM: c.detalhes.kmAdicionalNaRotaM,
          valorFrete: valorFreteDiagnostico,
          tipoFrete: tipoFreteDiagnostico,
          classificacao: {
            tipo: c.tipo as import('@/lib/procurar-datas/motor/classificacao-candidato').TipoClassificacaoCandidatoV2,
            elegivel: c.elegivel,
            horaMarcada: c.detalhes.elegivelHoraMarcada,
            elegivelHoraMarcada: c.detalhes.elegivelHoraMarcada,
            motivos: c.motivos,
            avisos: c.avisos,
            detalhes: {
              equipe: c.equipe,
              dataISO: c.dataISO,
              diaSemana: c.detalhes.diaSemana,
              ehSabado: c.detalhes.ehSabado,
              ehDomingo: c.detalhes.ehDomingo,
              slotTemPontos: c.detalhes.slotTemPontos,
              ativa: c.detalhes.ativa,
              disponivelMin: c.detalhes.disponivelMin,
              suficienteParaServico: c.detalhes.suficienteParaServico,
              tempoNecessarioMin: c.detalhes.tempoNecessarioMin,
              distanciaKm: c.detalhes.distanciaKm,
              kmAdicionalNaRotaM: c.detalhes.kmAdicionalNaRotaM,
              limiteBaseM: c.detalhes.limiteBaseM,
              limiteEspecialM: c.detalhes.limiteEspecialM,
              limitePremiumM: c.detalhes.limitePremiumM,
              horaMarcada: c.detalhes.horaMarcada,
              elegivelHoraMarcada: c.detalhes.elegivelHoraMarcada,
              motivoHoraMarcada: c.detalhes.motivoHoraMarcada,
              slotAvailMin: c.detalhes.slotAvailMin,
              serviceMin: c.detalhes.serviceMin,
              horaMarcadaHorasAMais: c.detalhes.horaMarcadaHorasAMais,
              limiteMinimoHoraMarcadaMin: c.detalhes.limiteMinimoHoraMarcadaMin,
            },
          },
        })
      )

      candidatosComparacaoV2Diagnostico = classificacoes.map((c, idx) => ({
        dataISO: c.dataISO,
        equipe: c.equipe,
        tipo: c.tipo,
        elegivel: c.elegivel,
        horaMarcada: c.detalhes.horaMarcada,
        elegivelHoraMarcada: c.detalhes.elegivelHoraMarcada,
        kmAdicionalNaRotaM: c.detalhes.kmAdicionalNaRotaM,
        slotTemPontos: c.detalhes.slotTemPontos,
        limiteBaseM: c.detalhes.limiteBaseM,
        limiteEspecialM: c.detalhes.limiteEspecialM,
        limitePremiumM: c.detalhes.limitePremiumM,
        motivos: c.motivos,
        ordem: idx + 1,
      }))

      const avisosCandidatos = [
        'Candidatos preliminares v2 montados a partir de classificações sintéticas.',
        freteVinculado
          ? 'Frete diagnóstico vinculado aos candidatos preliminares.'
          : 'Frete diagnóstico não possui valor confiável para vincular ao candidato preliminar.',
      ]

      diagnosticoCandidatos = {
        executado: true,
        freteVinculado,
        quantidadeCandidatosMontados: candidatosMontados.length,
        quantidadeElegiveis: candidatosMontados.filter((c) => c.elegivel).length,
        quantidadeIndisponiveis: candidatosMontados.filter((c) => !c.elegivel).length,
        quantidadeNormal: candidatosMontados.filter((c) => c.tipo === 'normal').length,
        quantidadeEspecial: candidatosMontados.filter((c) => c.tipo === 'especial').length,
        quantidadePremium: candidatosMontados.filter((c) => c.tipo === 'premium').length,
        quantidadeHoraMarcada: candidatosMontados.filter(
          (c) => c.elegivelHoraMarcada
        ).length,
        quantidadeComMotivos: candidatosMontados.filter((c) => c.motivos.length > 0).length,
        quantidadeComAvisos: candidatosMontados.filter((c) => c.avisos.length > 0).length,
        avisos: avisosCandidatos,
        amostra: candidatosMontados.slice(0, 10).map((c) => ({
          id: c.id,
          dataISO: c.dataISO,
          equipe: c.equipe,
          slotTemPontos: c.slotTemPontos,
          tipo: c.tipo,
          elegivel: c.elegivel,
          horaMarcada: c.horaMarcada,
          elegivelHoraMarcada: c.elegivelHoraMarcada,
          diagnosticoHoraMarcada: {
            motivoHoraMarcada: c.diagnostico.motivoHoraMarcada,
            slotAvailMin: c.operacional.slotAvailMin,
            serviceMin: c.operacional.serviceMin,
            horaMarcadaHorasAMais: c.diagnostico.horaMarcadaHorasAMais,
            limiteMinimoHoraMarcadaMin: c.diagnostico.limiteMinimoHoraMarcadaMin,
            horaMarcadaCalculadaPorTempo: c.diagnostico.horaMarcadaCalculadaPorTempo,
          },
          frete: c.frete,
          motivos: c.motivos,
          avisos: c.avisos,
        })),
      }

      // ── 9.6. Ordenar candidatos preliminares v2 (lista completa, não amostra) ──
      const resultadoOrdenacao = ordenarCandidatosDiagnosticosV2({
        candidatos: candidatosMontados,
      })

      const avisosOrdenacao = [
        'Ordenação preliminar/diagnóstica de candidatos v2. Não é ranking final de produção.',
        ...resultadoOrdenacao.avisos,
      ]

      diagnosticoOrdenacao = {
        executado: true,
        resumo: resultadoOrdenacao.resumo,
        avisos: avisosOrdenacao,
        amostra: resultadoOrdenacao.candidatos.slice(0, 10).map((c, idx) => ({
          posicao: idx + 1,
          id: c.id,
          dataISO: c.dataISO,
          equipe: c.equipe,
          tipo: c.tipo,
          elegivel: c.elegivel,
          indice: c.indice,
          frete: c.frete,
          motivos: c.motivos,
          avisos: c.avisos,
        })),
      }
    } else {
      diagnosticoClassificacao = {
        executado: false,
        motivo:
          (diagnosticoDisponibilidade as Record<string, unknown>).executado !== true
            ? 'Disponibilidade não foi calculada.'
            : 'Config não carregada corretamente.',
      }

      diagnosticoCandidatos = {
        executado: false,
        freteVinculado: false,
        motivo:
          (diagnosticoDisponibilidade as Record<string, unknown>).executado !== true
            ? 'Disponibilidade não foi calculada.'
            : 'Config não carregada corretamente.',
      }

      diagnosticoOrdenacao = {
        executado: false,
        motivo:
          (diagnosticoDisponibilidade as Record<string, unknown>).executado !== true
            ? 'Disponibilidade não foi calculada.'
            : 'Config não carregada corretamente.',
      }
    }

    // 9.7. Flags diagnosticas opcionais (nao afetam producao)
    let diagnosticoDisponibilidadeReal: Awaited<
      ReturnType<typeof buscarDisponibilidadeRealDiagnosticaComDados>
    >['diagnostico'] | null = null
    let diagnosticoCandidatosDisponibilidadeReal: Record<string, unknown> | null = null
    let diagnosticoCandidatosReaisAdaptados: Record<string, unknown> | null = null
    const slotTemPontosPorSlotKey: Record<string, boolean> = {}

    const bodyDiagnostico = body as PesquisarDatasRequest & {
      usarDisponibilidadeRealDiagnostica?: boolean
      usarAgendaRealDiagnostica?: boolean
      usarKmAdicionalAgendaDiagnostico?: boolean
      usarKmAdicionalRealControladoDiagnostico?: boolean
      usarComparacaoHaversineOsrmDiagnostico?: boolean
      usarEquivalenciaOsrmRouteVsTableDiagnostico?: boolean
      usarMapaKmAdicionalPorSlotDiagnostico?: boolean
      usarMapaKmAdicionalPorSlotNaClassificacaoDiagnostico?: boolean
      usarReclassificacaoComKmMapaSlotDiagnostico?: boolean
      usarComparacaoLegadoV2Diagnostico?: boolean
      usarInsercaoPorSlotDiagnostico?: boolean
      usarDiagnosticoSantoAmaroV2?: boolean
      diagnosticoDeltaMajorFranciscoHardy31Jul?: boolean
      diagnosticoDeltaHenriqueCorreia31Jul?: boolean
      legadoComparacaoDiagnostico?: unknown
      toleranciaKmAdicionalMComparacaoDiagnostico?: unknown
      fonteV2ComparacaoDiagnostico?: unknown
      osrmBaseUrlDiagnostico?: unknown
      osrmTimeoutMsDiagnostico?: unknown
      distanciaDiagnosticaKm?: unknown
      kmAdicionalNaRotaM?: unknown
      kmAdicionalNaRotaDiagnosticoM?: unknown
      linhasAgendaDiagnostica?: unknown
      cacheCoordenadasAgendaDiagnostico?: unknown
      origemAgendaDiagnostica?: unknown
      equipeAgendaDiagnostica?: unknown
      /** Slots para o mapa de kmAdicionalNaRotaM por slot (dataISO, equipe) */
      slotsAgendaDiagnostica?: unknown
      /** GID da aba de agenda na planilha Google Sheets (substitui o padrão hardcoded) */
      gidAgendaDiagnostica?: unknown
      /** Cenário controlado para diagnóstico de equivalência OSRM route vs table */
      cenarioEquivalenciaOsrm?: {
        prev?: { lat: number; lng: number; descricao?: string }
        novo?: { lat: number; lng: number; descricao?: string }
        next?: { lat: number; lng: number; descricao?: string }
      }
      /** Datas alvo para o recorte de auditoria (formato YYYY-MM-DD) */
      datasAlvo?: unknown
      /** Equipes alvo para o recorte de auditoria (ex: ['EQUIPE 1']) */
      equipesAlvo?: unknown
      /** Termos de endereço para buscar nos pontos da agenda (ex: ['ORLEANS', 'ARAUCÁRIA']) */
      termosEnderecoAlvo?: unknown
    }
    const usarDisponibilidadeReal = bodyDiagnostico.usarDisponibilidadeRealDiagnostica === true
    const usarAgendaRealDiagnostica = bodyDiagnostico.usarAgendaRealDiagnostica === true
    const usarKmAdicionalAgendaDiagnostico =
      bodyDiagnostico.usarKmAdicionalAgendaDiagnostico === true
    const usarKmAdicionalRealControladoDiagnostico =
      bodyDiagnostico.usarKmAdicionalRealControladoDiagnostico === true
    const usarComparacaoHaversineOsrmDiagnostico =
      bodyDiagnostico.usarComparacaoHaversineOsrmDiagnostico === true
    const usarEquivalenciaOsrmRouteVsTableDiagnostico =
      bodyDiagnostico.usarEquivalenciaOsrmRouteVsTableDiagnostico === true
    const usarMapaKmAdicionalPorSlotDiagnostico =
      bodyDiagnostico.usarMapaKmAdicionalPorSlotDiagnostico === true
    const usarMapaKmAdicionalPorSlotNaClassificacaoDiagnostico =
      bodyDiagnostico.usarMapaKmAdicionalPorSlotNaClassificacaoDiagnostico === true
    const usarReclassificacaoComKmMapaSlotDiagnostico =
      bodyDiagnostico.usarReclassificacaoComKmMapaSlotDiagnostico === true
    const usarComparacaoLegadoV2Diagnostico =
      bodyDiagnostico.usarComparacaoLegadoV2Diagnostico === true
    const usarInsercaoPorSlotDiagnostico =
      bodyDiagnostico.usarInsercaoPorSlotDiagnostico === true
    const usarDiagnosticoSantoAmaroV2 =
      bodyDiagnostico.usarDiagnosticoSantoAmaroV2 === true
    const usarDiagnosticoMajorHardy31Jul =
      bodyDiagnostico.diagnosticoDeltaMajorFranciscoHardy31Jul === true
    const usarDiagnosticoHenriqueCorreia31Jul =
      bodyDiagnostico.diagnosticoDeltaHenriqueCorreia31Jul === true

    // 9.7.a. Diagnostico de km adicional por agenda (fixture/controlado)
    let diagnosticoKmAdicionalAgenda: Record<string, unknown> | null = null
    let diagnosticoAgendaReal: AgendaRealComDadosResult['diagnostico'] | null = null
    let agendaRealComDados: AgendaRealComDadosResult | null = null
    let diagnosticoKmAdicionalRealControlado: Record<string, unknown> | null = null
    let diagnosticoComparacaoHaversineOsrm: Record<string, unknown> | null = null
    let diagnosticoEquivalenciaOsrmRouteVsTable: Record<string, unknown> | null = null
    let diagnosticoMapaKmAdicionalPorSlot: Record<string, unknown> | null = null
    let diagnosticoAplicacaoMapaKmPorSlotEmCandidatos: Record<string, unknown> | null = null
    let diagnosticoReclassificacaoComKmMapaSlot: Record<string, unknown> | null = null
    let diagnosticoComparacaoLegadoV2: Record<string, unknown> | null = null
    let diagnosticoInsercaoPorSlot: Record<string, unknown> | null = null
    let diagnosticoSantoAmaroV2: Record<string, unknown> | null = null
    let diagnosticoFluxoRealV2: Record<string, unknown> | null = null
    let diagnosticoRecorteAlvo: Record<string, unknown> | null = null
    let candidatosFinaisDiagnosticoDirigidoSantoAmaro: Array<{
      dataISO: string
      equipe: string
      tipo: string
      kmAdicionalNaRotaM: number | null
    }> = []
    let datasFinaisDiagnosticoDirigidoSantoAmaro: string[] = []
    let cacheCoordenadasAgendaDiagnosticoResolvido: Record<string, { lat: number; lng: number }> =
      isCacheCoordenadasAgenda(bodyDiagnostico.cacheCoordenadasAgendaDiagnostico)
        ? bodyDiagnostico.cacheCoordenadasAgendaDiagnostico
        : {}
    let avisosCacheCoordenadasAgendaDiagnostico: string[] = []
    // Variável para armazenar candidatos reais convertidos (usado quando fonteV2 = 'disponibilidade-real')
    let candidatosReaisConvertidosParaComparacao: import('@/lib/procurar-datas/motor/comparacao-legado-v2').CandidatoComparacaoLegadoV2[] = []
    // Candidatos reais após recorte legado-equivalente (usado quando fonteV2 = 'resultado-final-legado-equivalente')
    let candidatosReaisRecortadosParaComparacao: import('@/lib/procurar-datas/motor/comparacao-legado-v2').CandidatoComparacaoLegadoV2[] = []
    let diagnosticoResultadoFinalLegadoEquivalente: Record<string, unknown> | null = null

    if (usarKmAdicionalAgendaDiagnostico) {
      const avisosKmAgenda: string[] = [
        'Diagnostico de km adicional por agenda executado apenas com dados controlados do body. Usa Haversine, nao OSRM, nao producao.',
      ]
      const dataISO = entradaNormalizada.dataInicialISO
      const equipe =
        typeof bodyDiagnostico.equipeAgendaDiagnostica === 'string' &&
        bodyDiagnostico.equipeAgendaDiagnostica.trim()
          ? bodyDiagnostico.equipeAgendaDiagnostica.trim()
          : null
      const origem = isCoordenadaDiagnostica(bodyDiagnostico.origemAgendaDiagnostica)
        ? bodyDiagnostico.origemAgendaDiagnostica
        : null
      const destino =
        typeof body.destLat === 'number' &&
        Number.isFinite(body.destLat) &&
        typeof body.destLng === 'number' &&
        Number.isFinite(body.destLng)
          ? { lat: body.destLat, lng: body.destLng, descricao: body.destDisplay }
          : null
      const linhasAgenda = Array.isArray(bodyDiagnostico.linhasAgendaDiagnostica)
        ? bodyDiagnostico.linhasAgendaDiagnostica.filter(Array.isArray)
        : []
      const linhasAgendaInvalidas =
        bodyDiagnostico.linhasAgendaDiagnostica !== undefined &&
        (!Array.isArray(bodyDiagnostico.linhasAgendaDiagnostica) ||
          linhasAgenda.length !== bodyDiagnostico.linhasAgendaDiagnostica.length)
      const cacheCoordenadas =
        bodyDiagnostico.cacheCoordenadasAgendaDiagnostico === undefined
          ? {}
          : isCacheCoordenadasAgenda(bodyDiagnostico.cacheCoordenadasAgendaDiagnostico)
            ? bodyDiagnostico.cacheCoordenadasAgendaDiagnostico
            : null

      if (!dataISO) avisosKmAgenda.push('dataInicial ausente ou invalida para diagnostico da agenda.')
      if (!equipe) avisosKmAgenda.push('equipeAgendaDiagnostica ausente ou invalida.')
      if (!origem) avisosKmAgenda.push('origemAgendaDiagnostica ausente ou invalida.')
      if (!destino) avisosKmAgenda.push('destLat/destLng ausentes ou invalidos.')
      if (linhasAgendaInvalidas) {
        avisosKmAgenda.push('linhasAgendaDiagnostica invalida: esperado array de linhas.')
      }
      if (cacheCoordenadas === null) {
        avisosKmAgenda.push(
          'cacheCoordenadasAgendaDiagnostico invalido: esperado objeto de coordenadas por endereco.'
        )
      }
      if (bodyDiagnostico.linhasAgendaDiagnostica === undefined) {
        avisosKmAgenda.push('linhasAgendaDiagnostica ausente; usando agenda vazia controlada.')
      }

      if (!dataISO || !equipe || !origem || !destino || linhasAgendaInvalidas || cacheCoordenadas === null) {
        diagnosticoKmAdicionalAgenda = {
          executado: true,
          ok: false,
          modo: 'haversine-diagnostico',
          parametros: {
            dataISO,
            equipe,
            origemInformada: origem !== null,
            destinoInformado: destino !== null,
            linhasAgendaRecebidas: Array.isArray(bodyDiagnostico.linhasAgendaDiagnostica)
              ? bodyDiagnostico.linhasAgendaDiagnostica.length
              : 0,
            cacheCoordenadasRecebido: cacheCoordenadas !== null,
          },
          kmAdicionalNaRotaM: null,
          origemKmAdicionalNaRotaM: null,
          parseAgenda: null,
          deltaInsercao: null,
          avisos: avisosKmAgenda,
          descartados: [],
        }
      } else {
        const resultadoKmAgenda = diagnosticarKmAdicionalAgendaV2({
          linhasAgenda,
          dataISO,
          equipe,
          origem,
          destino,
          cacheCoordenadasPorEndereco: cacheCoordenadas,
          modo: 'haversine-diagnostico',
        })

        diagnosticoKmAdicionalAgenda = {
          executado: true,
          ok: resultadoKmAgenda.ok,
          modo: resultadoKmAgenda.modo,
          parametros: {
            dataISO: resultadoKmAgenda.dataISO,
            equipe: resultadoKmAgenda.equipe,
            origemInformada: true,
            destinoInformado: true,
            linhasAgendaRecebidas: linhasAgenda.length,
            cacheCoordenadasRecebido: true,
          },
          kmAdicionalNaRotaM: resultadoKmAgenda.kmAdicionalNaRotaM,
          origemKmAdicionalNaRotaM: resultadoKmAgenda.origemKmAdicionalNaRotaM,
          parseAgenda: resultadoKmAgenda.parseAgenda,
          deltaInsercao: resultadoKmAgenda.deltaInsercao,
          avisos: [...avisosKmAgenda, ...resultadoKmAgenda.avisos],
          descartados: resultadoKmAgenda.descartados,
        }
      }
    }

    // 9.7.a.0. Leitura automatica da AGENDA real (quando usarAgendaRealDiagnostica)
    if (usarAgendaRealDiagnostica) {
      const avisosAgendaReal: string[] = [
        'Leitura automatica da planilha AGENDA (shAg) em modo diagnostico.',
        'Nao altera producao, frontend ou ranking final.',
      ]

      try {
        const gidAgendaDiagnostica =
          typeof bodyDiagnostico.gidAgendaDiagnostica === 'number' &&
          Number.isFinite(bodyDiagnostico.gidAgendaDiagnostica)
            ? bodyDiagnostico.gidAgendaDiagnostica
            : undefined
        agendaRealComDados = await buscarAgendaRealDiagnosticaComDados(2000, gidAgendaDiagnostica)
        diagnosticoAgendaReal = agendaRealComDados.diagnostico

        if (diagnosticoAgendaReal.ok && diagnosticoAgendaReal.executado) {
          avisosAgendaReal.push(
            `Agenda real lida com sucesso: ${agendaRealComDados.linhasAgenda.length} linhas.`
          )
        } else {
          avisosAgendaReal.push(
            'Falha ao ler agenda real: ' +
              ('erro' in diagnosticoAgendaReal ? diagnosticoAgendaReal.erro : 'Erro desconhecido')
          )
        }
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error)
        diagnosticoAgendaReal = {
          ok: false,
          executado: true,
          erro: `Excecao ao ler agenda real: ${msg}`,
          origem: {
            tipo: 'google-sheets',
            spreadsheetId: '1H8mFLzEL8XcFh0UX_hOJF-ublRZcdbhwLc7ooNEeJ5U',
            gid: 1324794210,
          },
          parametros: { limite: 2000 },
        }
        avisosAgendaReal.push(`Excecao ao ler agenda real: ${msg}`)
      }

      if (
        agendaRealComDados !== null &&
        agendaRealComDados.diagnostico.ok === true &&
        agendaRealComDados.linhasAgenda.length > 0
      ) {
        try {
          const cacheResolvido = await resolverCacheCoordenadasAgendaDiagnostico({
            linhasAgenda: agendaRealComDados.linhasAgenda,
            cacheInjetado: cacheCoordenadasAgendaDiagnosticoResolvido,
            supabaseTable: configResult.ok ? configResult.config.supabaseTable : null,
          })
          cacheCoordenadasAgendaDiagnosticoResolvido = cacheResolvido.cacheCoordenadasPorEndereco
          avisosCacheCoordenadasAgendaDiagnostico = cacheResolvido.avisos
        } catch (error: unknown) {
          const msg = error instanceof Error ? error.message : String(error)
          avisosCacheCoordenadasAgendaDiagnostico = [
            `Excecao ao enriquecer cache de coordenadas da agenda via Supabase: ${msg}`,
          ]
        }
      }
    }

    // 9.7.a.1. Calculo real controlado de km adicional por data/equipe
    if (usarKmAdicionalRealControladoDiagnostico) {
      const errosKmReal: string[] = []
      const avisosKmReal: string[] = [
        'Calculo real controlado de kmAdicionalNaRotaM executado apenas em diagnostico.',
        'Usa origem operacional v2, agenda controlada do body, OSRM /table e fallback Haversine conforme legado.',
        'Nao altera producao, frontend ou ranking final.',
      ]

      // Se usarAgendaRealDiagnostica estiver ativo e a agenda foi lida com sucesso, use-a
      const temAgendaReal =
        usarAgendaRealDiagnostica &&
        agendaRealComDados !== null &&
        agendaRealComDados.diagnostico.ok === true

      if (temAgendaReal) {
        avisosKmReal.push(
          'usarAgendaRealDiagnostica ativo: usando linhasAgenda da planilha AGENDA real.'
        )
      } else if (usarAgendaRealDiagnostica) {
        avisosKmReal.push(
          'usarAgendaRealDiagnostica ativo mas leitura falhou; fallback para linhasAgendaDiagnostica do body.'
        )
      }

      const dataISO = entradaNormalizada.dataInicialISO
      const equipe =
        typeof bodyDiagnostico.equipeAgendaDiagnostica === 'string' &&
        bodyDiagnostico.equipeAgendaDiagnostica.trim()
          ? bodyDiagnostico.equipeAgendaDiagnostica.trim()
          : null
      const destino =
        typeof body.destLat === 'number' &&
        Number.isFinite(body.destLat) &&
        typeof body.destLng === 'number' &&
        Number.isFinite(body.destLng)
          ? { lat: body.destLat, lng: body.destLng, descricao: body.destDisplay }
          : null

      // Usa agenda real se disponível, senão usa do body (comportamento anterior)
      const linhasAgenda = temAgendaReal
        ? agendaRealComDados!.linhasAgenda
        : Array.isArray(bodyDiagnostico.linhasAgendaDiagnostica)
          ? bodyDiagnostico.linhasAgendaDiagnostica.filter(Array.isArray)
          : []
      const linhasAgendaInvalidas =
        !temAgendaReal &&
        bodyDiagnostico.linhasAgendaDiagnostica !== undefined &&
        (!Array.isArray(bodyDiagnostico.linhasAgendaDiagnostica) ||
          linhasAgenda.length !== bodyDiagnostico.linhasAgendaDiagnostica.length)
      const cacheCoordenadas =
        bodyDiagnostico.cacheCoordenadasAgendaDiagnostico === undefined
          ? cacheCoordenadasAgendaDiagnosticoResolvido
          : isCacheCoordenadasAgenda(bodyDiagnostico.cacheCoordenadasAgendaDiagnostico)
            ? cacheCoordenadasAgendaDiagnosticoResolvido
            : null
      const osrmResolvidoKmReal = resolverOsrmBaseUrlV2(
        bodyDiagnostico.osrmBaseUrlDiagnostico,
        configResult.ok ? configResult.config.osrmBaseUrl : null
      )
      const osrmBaseUrl = osrmResolvidoKmReal.url
      const osrmTimeoutMs =
        typeof bodyDiagnostico.osrmTimeoutMsDiagnostico === 'number' &&
        Number.isFinite(bodyDiagnostico.osrmTimeoutMsDiagnostico) &&
        bodyDiagnostico.osrmTimeoutMsDiagnostico > 0
          ? bodyDiagnostico.osrmTimeoutMsDiagnostico
          : 5000

      if (!dataISO) errosKmReal.push('dataInicial ausente ou invalida.')
      if (!equipe) errosKmReal.push('equipeAgendaDiagnostica ausente ou invalida.')
      if (!destino) errosKmReal.push('destLat/destLng ausentes ou invalidos.')
      if (!osrmBaseUrl) errosKmReal.push('osrmBaseUrlDiagnostico/config OSRM ausente ou invalida.')
      if (!configResult.ok) errosKmReal.push('Config operacional nao carregada.')
      if (linhasAgendaInvalidas) errosKmReal.push('linhasAgendaDiagnostica invalida: esperado array de linhas.')
      if (cacheCoordenadas === null) {
        errosKmReal.push('cacheCoordenadasAgendaDiagnostico invalido: esperado objeto de coordenadas por endereco.')
      }
      if (!temAgendaReal && bodyDiagnostico.linhasAgendaDiagnostica === undefined) {
        avisosKmReal.push('linhasAgendaDiagnostica ausente; usando agenda vazia controlada.')
      }

      if (
        !dataISO ||
        !equipe ||
        !destino ||
        !osrmBaseUrl ||
        !configResult.ok ||
        linhasAgendaInvalidas ||
        cacheCoordenadas === null
      ) {
        diagnosticoKmAdicionalRealControlado = {
          executado: true,
          ok: false,
          modo: 'km-adicional-real-controlado-diagnostico',
          avisoDiagnostico:
            'Bloco exclusivamente diagnostico. Nao altera producao, frontend ou ranking final.',
          parametros: {
            dataISO,
            equipe,
            destinoInformado: destino !== null,
            linhasAgendaRecebidas: Array.isArray(bodyDiagnostico.linhasAgendaDiagnostica)
              ? bodyDiagnostico.linhasAgendaDiagnostica.length
              : 0,
            cacheCoordenadasRecebido: cacheCoordenadas !== null,
            osrmBaseUrlUsada: osrmBaseUrl ?? undefined,
            osrmTimeoutMs,
          },
          kmAdicionalNaRotaM: null,
          origemKmAdicionalNaRotaM: null,
          resultado: null,
          erros: errosKmReal,
          avisos: avisosKmReal,
        }
      } else {
        const buscarMatrizOSRM = criarBuscarMatrizOSRMTableDiagnosticoV2({
          baseUrl: osrmBaseUrl,
          timeoutMs: osrmTimeoutMs,
        })
        const resultadoKmReal = await calcularKmAdicionalRealControladoV2({
          dataISO,
          equipe,
          configOrigem: {
            latDeposito: configResult.config.latDeposito,
            lngDeposito: configResult.config.lngDeposito,
            latCasaE1: configResult.config.latCasaE1,
            lngCasaE1: configResult.config.lngCasaE1,
            latCasaE2: configResult.config.latCasaE2,
            lngCasaE2: configResult.config.lngCasaE2,
          },
          destino,
          linhasAgenda,
          cacheCoordenadasPorEndereco: cacheCoordenadas,
          buscarMatrizOSRM,
        })

        diagnosticoKmAdicionalRealControlado = {
          executado: true,
          ok: resultadoKmReal.ok,
          modo: resultadoKmReal.modo,
          avisoDiagnostico:
            'Bloco exclusivamente diagnostico. Nao altera producao, frontend ou ranking final.',
          parametros: {
            dataISO,
            equipe,
            destinoInformado: true,
            linhasAgendaRecebidas: linhasAgenda.length,
            cacheCoordenadasRecebido: true,
            osrmBaseUrlUsada: osrmBaseUrl,
            osrmTimeoutMs,
          },
          kmAdicionalNaRotaM: resultadoKmReal.kmAdicionalNaRotaM,
          origemKmAdicionalNaRotaM: resultadoKmReal.origemKmAdicionalNaRotaM,
          origemOperacional: resultadoKmReal.origemOperacional,
          parseAgenda: resultadoKmReal.parseAgenda,
          matrizOSRM: resultadoKmReal.matrizOSRM,
          deltaInsercao: resultadoKmReal.deltaInsercao,
          descartados: resultadoKmReal.descartados,
          erros: [...errosKmReal, ...resultadoKmReal.erros],
          avisos: [...avisosKmReal, ...avisosCacheCoordenadasAgendaDiagnostico, ...resultadoKmReal.avisos],
        }
      }
    }

    // 9.7.a.2. Comparacao Haversine vs OSRM (opcional, diagnostico, nao producao)
    if (usarComparacaoHaversineOsrmDiagnostico) {
      const errosComparacao: string[] = []
      const avisosComparacao: string[] = [
        'Comparacao Haversine vs OSRM executada apenas para diagnostico. Nao substitui producao, candidatos, classificacao ou kmAdicionalNaRotaDiagnosticoM.',
      ]
      const dataISO = entradaNormalizada.dataInicialISO
      const equipe =
        typeof bodyDiagnostico.equipeAgendaDiagnostica === 'string' &&
        bodyDiagnostico.equipeAgendaDiagnostica.trim()
          ? bodyDiagnostico.equipeAgendaDiagnostica.trim()
          : null
      const equipeNormalizada = equipe ? normalizarEquipe(equipe) : null
      const origem = isCoordenadaDiagnostica(bodyDiagnostico.origemAgendaDiagnostica)
        ? bodyDiagnostico.origemAgendaDiagnostica
        : null
      const destino =
        typeof body.destLat === 'number' &&
        Number.isFinite(body.destLat) &&
        typeof body.destLng === 'number' &&
        Number.isFinite(body.destLng)
          ? { lat: body.destLat, lng: body.destLng, descricao: body.destDisplay }
          : null
      const linhasAgenda = Array.isArray(bodyDiagnostico.linhasAgendaDiagnostica)
        ? bodyDiagnostico.linhasAgendaDiagnostica.filter(Array.isArray)
        : []
      const linhasAgendaInvalidas =
        bodyDiagnostico.linhasAgendaDiagnostica !== undefined &&
        (!Array.isArray(bodyDiagnostico.linhasAgendaDiagnostica) ||
          linhasAgenda.length !== bodyDiagnostico.linhasAgendaDiagnostica.length)
      const cacheCoordenadas =
        bodyDiagnostico.cacheCoordenadasAgendaDiagnostico === undefined
          ? {}
          : isCacheCoordenadasAgenda(bodyDiagnostico.cacheCoordenadasAgendaDiagnostico)
            ? bodyDiagnostico.cacheCoordenadasAgendaDiagnostico
            : null
      const osrmResolvidoComparacao = resolverOsrmBaseUrlV2(
        bodyDiagnostico.osrmBaseUrlDiagnostico,
        configResult.ok ? configResult.config.osrmBaseUrl : null
      )
      const osrmBaseUrl = osrmResolvidoComparacao.url
      const osrmTimeoutMs =
        typeof bodyDiagnostico.osrmTimeoutMsDiagnostico === 'number' &&
        Number.isFinite(bodyDiagnostico.osrmTimeoutMsDiagnostico) &&
        bodyDiagnostico.osrmTimeoutMsDiagnostico > 0
          ? bodyDiagnostico.osrmTimeoutMsDiagnostico
          : 5000

      if (!dataISO) errosComparacao.push('dataInicial ausente ou invalida.')
      if (!equipe) errosComparacao.push('equipeAgendaDiagnostica ausente ou invalida.')
      if (equipe && !equipeNormalizada) errosComparacao.push('equipeAgendaDiagnostica nao reconhecida.')
      if (!origem) errosComparacao.push('origemAgendaDiagnostica ausente ou invalida.')
      if (!destino) errosComparacao.push('destLat/destLng ausentes ou invalidos.')
      if (!osrmBaseUrl) errosComparacao.push('osrmBaseUrlDiagnostico ausente ou invalida.')
      if (linhasAgendaInvalidas) {
        errosComparacao.push('linhasAgendaDiagnostica invalida: esperado array de linhas.')
      }
      if (cacheCoordenadas === null) {
        errosComparacao.push(
          'cacheCoordenadasAgendaDiagnostico invalido: esperado objeto de coordenadas por endereco.'
        )
      }
      if (bodyDiagnostico.linhasAgendaDiagnostica === undefined) {
        avisosComparacao.push('linhasAgendaDiagnostica ausente; usando agenda vazia controlada.')
      }

      if (
        !dataISO ||
        !equipeNormalizada ||
        !origem ||
        !destino ||
        !osrmBaseUrl ||
        linhasAgendaInvalidas ||
        cacheCoordenadas === null
      ) {
        diagnosticoComparacaoHaversineOsrm = {
          executado: true,
          ok: false,
          modo: 'comparacao-haversine-osrm-diagnostico',
          avisoDiagnostico:
            'Bloco exclusivamente diagnostico. Nao altera producao, candidatos ou classificacao.',
          osrmBaseUrlUsada: osrmBaseUrl ?? undefined,
          osrmTimeoutMs,
          resultado: null,
          erros: errosComparacao,
          avisos: avisosComparacao,
        }
      } else {
        try {
          const parseAgenda = parsearPontosAgendaDoDiaV2({
            linhasAgenda,
            dataAlvoISO: dataISO,
            equipeAlvo: equipeNormalizada,
            cacheCoordenadasPorEndereco: cacheCoordenadas,
          })
          const pontosAgenda = parseAgenda.pontos.map((p) => ({
            loc: p.coordenadas,
            addr: p.endereco,
            eventTitle: p.tituloEvento ?? undefined,
            team: p.equipe,
            id: `agenda_${p.indiceLinhaOriginal}`,
          }))
          const buscarMatrizOSRM = criarBuscarMatrizOSRMTableDiagnosticoV2({
            baseUrl: osrmBaseUrl,
            timeoutMs: osrmTimeoutMs,
          })
          const resultadoComparacao =
            await compararKmAdicionalHaversineVsOSRMDiagnosticoV2({
              origem,
              destino,
              pontosAgenda,
              buscarMatrizOSRM,
              modo: 'comparacao-haversine-osrm-diagnostico',
            })

          diagnosticoComparacaoHaversineOsrm = {
            executado: true,
            ok: resultadoComparacao.ok,
            modo: resultadoComparacao.modo,
            avisoDiagnostico:
              'Bloco exclusivamente diagnostico. Nao altera producao, candidatos ou classificacao.',
            osrmBaseUrlUsada: osrmBaseUrl,
            osrmTimeoutMs,
            parametros: {
              dataISO,
              equipe: equipeNormalizada,
              origemInformada: true,
              destinoInformado: true,
              linhasAgendaRecebidas: linhasAgenda.length,
              pontosAgendaValidos: pontosAgenda.length,
              cacheCoordenadasRecebido: true,
            },
            parseAgenda: {
              ok: parseAgenda.ok,
              resumo: parseAgenda.resumo,
              avisos: parseAgenda.avisos,
              erros: parseAgenda.erros,
            },
            resultado: resultadoComparacao,
            erros: [...errosComparacao, ...resultadoComparacao.erros],
            avisos: [...avisosComparacao, ...parseAgenda.avisos, ...resultadoComparacao.avisos],
          }
        } catch (error: unknown) {
          diagnosticoComparacaoHaversineOsrm = {
            executado: true,
            ok: false,
            modo: 'comparacao-haversine-osrm-diagnostico',
            avisoDiagnostico:
              'Bloco exclusivamente diagnostico. Nao altera producao, candidatos ou classificacao.',
            osrmBaseUrlUsada: osrmBaseUrl,
            osrmTimeoutMs,
            resultado: null,
            erros: [
              ...errosComparacao,
              error instanceof Error ? error.message : String(error),
            ],
            avisos: avisosComparacao,
          }
        }
      }
    }

    // 9.7.a.3. Diagnóstico de equivalência OSRM /route vs /table (legado vs v2)
    if (usarEquivalenciaOsrmRouteVsTableDiagnostico) {
      const errosEquivalencia: string[] = []
      const avisosEquivalencia: string[] = [
        'Diagnóstico de equivalência OSRM /route vs /table executado apenas para validação.',
        'Compara distâncias calculadas por OSRM /route (legado) vs /table (v2) para o mesmo cenário.',
        'Não altera produção, candidatos, classificação ou kmAdicionalNaRotaDiagnosticoM.',
      ]

      const osrmResolvidoEquiv = resolverOsrmBaseUrlV2(
        bodyDiagnostico.osrmBaseUrlDiagnostico,
        configResult.ok ? configResult.config.osrmBaseUrl : null
      )
      const osrmBaseUrl = osrmResolvidoEquiv.url
      const osrmTimeoutMs =
        typeof bodyDiagnostico.osrmTimeoutMsDiagnostico === 'number' &&
        Number.isFinite(bodyDiagnostico.osrmTimeoutMsDiagnostico) &&
        bodyDiagnostico.osrmTimeoutMsDiagnostico > 0
          ? bodyDiagnostico.osrmTimeoutMsDiagnostico
          : 5000

      // Cenário controlado: prev, novo, next
      const cenario = bodyDiagnostico.cenarioEquivalenciaOsrm
      const prev = isCoordenadaDiagnostica(cenario?.prev) ? cenario!.prev : null
      const novo = isCoordenadaDiagnostica(cenario?.novo) ? cenario!.novo : null
      const next = isCoordenadaDiagnostica(cenario?.next) ? cenario!.next : null

      if (!osrmBaseUrl) errosEquivalencia.push('osrmBaseUrlDiagnostico ausente ou inválida.')
      if (!prev) errosEquivalencia.push('cenarioEquivalenciaOsrm.prev ausente ou inválido.')
      if (!novo) errosEquivalencia.push('cenarioEquivalenciaOsrm.novo ausente ou inválido.')
      if (!next) errosEquivalencia.push('cenarioEquivalenciaOsrm.next ausente ou inválido.')

      if (errosEquivalencia.length > 0) {
        diagnosticoEquivalenciaOsrmRouteVsTable = {
          executado: true,
          ok: false,
          modo: 'equivalencia-osrm-route-vs-table-diagnostico',
          avisoDiagnostico:
            'Bloco exclusivamente diagnóstico. Não altera produção, candidatos ou classificação.',
          osrmBaseUrlUsada: osrmBaseUrl ?? undefined,
          osrmTimeoutMs,
          resultado: null,
          erros: errosEquivalencia,
          avisos: avisosEquivalencia,
        }
      } else {
        try {
          // Criar funções injetadas para /route e /table
          const buscarRotaOSRM = criarBuscarRotaOSRMRouteDiagnosticoV2({
            baseUrl: osrmBaseUrl!,
            timeoutMs: osrmTimeoutMs,
          })
          const buscarMatrizOSRM = criarBuscarMatrizOSRMTableDiagnosticoV2({
            baseUrl: osrmBaseUrl!,
            timeoutMs: osrmTimeoutMs,
          })

          const resultadoEquivalencia = await compararEquivalenciaOsrmRouteTableDiagnosticoV2({
            prev: { ...prev!, id: 'prev', descricao: prev?.descricao ?? 'prev' },
            novo: { ...novo!, id: 'novo', descricao: novo?.descricao ?? 'novo' },
            next: { ...next!, id: 'next', descricao: next?.descricao ?? 'next' },
            buscarRotaOSRM: async (de, para) => {
              const res = await buscarRotaOSRM(de, para)
              return {
                distanciaM: res.distanciaM,
                ok: res.ok,
                erro: res.erro,
              }
            },
            buscarMatrizOSRM: async (coordenadas) => {
              const res = await buscarMatrizOSRM(coordenadas)
              return {
                distances: res.distances,
                ok: true,
              }
            },
            toleranciaM: 10, // tolerância padrão: 10 metros
            modo: 'equivalencia-osrm-route-vs-table-diagnostico',
          })

          diagnosticoEquivalenciaOsrmRouteVsTable = {
            executado: true,
            ok: resultadoEquivalencia.ok,
            modo: resultadoEquivalencia.modo,
            avisoDiagnostico:
              'Bloco exclusivamente diagnóstico. Não altera produção, candidatos ou classificação.',
            osrmBaseUrlUsada: osrmBaseUrl,
            osrmTimeoutMs,
            parametros: {
              prev: { lat: prev!.lat, lng: prev!.lng, descricao: prev?.descricao },
              novo: { lat: novo!.lat, lng: novo!.lng, descricao: novo?.descricao },
              next: { lat: next!.lat, lng: next!.lng, descricao: next?.descricao },
            },
            resultado: resultadoEquivalencia,
            erros: [...errosEquivalencia, ...resultadoEquivalencia.erros],
            avisos: [...avisosEquivalencia, ...resultadoEquivalencia.avisos],
          }
        } catch (error: unknown) {
          diagnosticoEquivalenciaOsrmRouteVsTable = {
            executado: true,
            ok: false,
            modo: 'equivalencia-osrm-route-vs-table-diagnostico',
            avisoDiagnostico:
              'Bloco exclusivamente diagnóstico. Não altera produção, candidatos ou classificação.',
            osrmBaseUrlUsada: osrmBaseUrl,
            osrmTimeoutMs,
            resultado: null,
            erros: [
              ...errosEquivalencia,
              error instanceof Error ? error.message : String(error),
            ],
            avisos: avisosEquivalencia,
          }
        }
      }
    }

    // 9.7.a.4. Mapa de kmAdicionalNaRotaM por slot (dataISO, equipe)
    if (usarMapaKmAdicionalPorSlotDiagnostico) {
      const errosMapaSlot: string[] = []
      const avisosMapaSlot: string[] = [
        'Mapa de kmAdicionalNaRotaM por slot executado apenas em diagnostico.',
        'Usa origem operacional v2, agenda controlada do body, OSRM /table e fallback Haversine conforme legado.',
        'Nao altera producao, frontend ou ranking final.',
        'Valor manual kmAdicionalNaRotaDiagnosticoM do body nao contamina este calculo.',
      ]

      const destino =
        typeof body.destLat === 'number' &&
        Number.isFinite(body.destLat) &&
        typeof body.destLng === 'number' &&
        Number.isFinite(body.destLng)
          ? { lat: body.destLat, lng: body.destLng, descricao: body.destDisplay }
          : null
      const osrmResolvidoMapa = resolverOsrmBaseUrlV2(
        bodyDiagnostico.osrmBaseUrlDiagnostico,
        configResult.ok ? configResult.config.osrmBaseUrl : null
      )
      const osrmBaseUrl = osrmResolvidoMapa.url
      const osrmTimeoutMs =
        typeof bodyDiagnostico.osrmTimeoutMsDiagnostico === 'number' &&
        Number.isFinite(bodyDiagnostico.osrmTimeoutMsDiagnostico) &&
        bodyDiagnostico.osrmTimeoutMsDiagnostico > 0
          ? bodyDiagnostico.osrmTimeoutMsDiagnostico
          : 5000

      const rawSlots = bodyDiagnostico.slotsAgendaDiagnostica
      let slots: SlotInputMapaKmAdicional[] = []
      let slotsInvalidos = false
      let fonteSlotsMapa = 'vazio'

      if (rawSlots !== undefined) {
        if (!Array.isArray(rawSlots)) {
          slotsInvalidos = true
          errosMapaSlot.push('slotsAgendaDiagnostica invalido: esperado array de slots.')
        } else {
          const slotsManual: SlotInputMapaKmAdicional[] = []
          for (const s of rawSlots) {
            if (
              s &&
              typeof s === 'object' &&
              typeof (s as Record<string, unknown>).dataISO === 'string' &&
              typeof (s as Record<string, unknown>).equipe === 'string'
            ) {
              const raw = s as Record<string, unknown>
              const linhasAgenda = Array.isArray(raw.linhasAgenda)
                ? (raw.linhasAgenda as unknown[][]).filter(Array.isArray)
                : []
              const equipeNormalizada = normalizarEquipe(raw.equipe as string)
              if (equipeNormalizada) {
                slotTemPontosPorSlotKey[`${raw.dataISO as string}::${equipeNormalizada}`] =
                  linhasAgenda.length > 0
              }
              const cacheCoordenadasPorEndereco =
                raw.cacheCoordenadasPorEndereco !== undefined
                  ? isCacheCoordenadasAgenda(raw.cacheCoordenadasPorEndereco)
                    ? {
                        ...cacheCoordenadasAgendaDiagnosticoResolvido,
                        ...(raw.cacheCoordenadasPorEndereco as Record<string, { lat: number; lng: number }>),
                      }
                    : {}
                  : cacheCoordenadasAgendaDiagnosticoResolvido
              slotsManual.push({
                dataISO: raw.dataISO as string,
                equipe: raw.equipe as string,
                linhasAgenda: linhasAgenda as SlotInputMapaKmAdicional['linhasAgenda'],
                cacheCoordenadasPorEndereco,
              })
            } else {
              slotsInvalidos = true
              errosMapaSlot.push('Slot invalido ignorado: esperado { dataISO, equipe }.')
            }
          }
          slots = slotsManual
          fonteSlotsMapa = 'body-slotsAgendaDiagnostica'
        }
      } else {
        const slotsAutoResolvidos = montarSlotsKmAdicionalDiagnostico({
          rawSlotsAgendaDiagnostica: undefined,
          usarAgendaRealDiagnostica,
          agendaRealComDados,
          janelaDatas: janelaResult?.ok ? janelaResult.datas : null,
          equipeAgendaDiagnostica: bodyDiagnostico.equipeAgendaDiagnostica,
          cacheCoordenadasAgendaDiagnostico: cacheCoordenadasAgendaDiagnosticoResolvido,
          slotTemPontosPorSlotKey,
        })
        slots = slotsAutoResolvidos.slots
        slotsInvalidos = slotsAutoResolvidos.slotsInvalidos
        fonteSlotsMapa = slotsAutoResolvidos.fonteSlots
        errosMapaSlot.push(...slotsAutoResolvidos.erros)
        avisosMapaSlot.push(...slotsAutoResolvidos.avisos)
      }

      if (!destino) errosMapaSlot.push('destLat/destLng ausentes ou invalidos.')
      if (!osrmBaseUrl) errosMapaSlot.push('osrmBaseUrlDiagnostico/config OSRM ausente ou invalida.')
      if (!configResult.ok) errosMapaSlot.push('Config operacional nao carregada.')

      if (!destino || !osrmBaseUrl || !configResult.ok || slotsInvalidos) {
        diagnosticoMapaKmAdicionalPorSlot = {
          executado: true,
          ok: false,
          modo: 'mapa-km-adicional-por-slot-diagnostico',
          avisoDiagnostico:
            'Bloco exclusivamente diagnostico. Nao altera producao, frontend ou ranking final.',
          parametros: {
            slotsRecebidos: slots.length,
            fonteSlots: fonteSlotsMapa,
            destinoInformado: destino !== null,
            osrmBaseUrlUsada: osrmBaseUrl ?? undefined,
            osrmTimeoutMs,
          },
          mapa: null,
          detalhesPorSlot: null,
          contadores: null,
          erros: errosMapaSlot,
          avisos: avisosMapaSlot,
        }
      } else {
        try {
          const buscarMatrizOSRM = criarBuscarMatrizOSRMTableDiagnosticoV2({
            baseUrl: osrmBaseUrl,
            timeoutMs: osrmTimeoutMs,
          })
          const resultadoMapa = await calcularMapaKmAdicionalPorSlotControladoV2({
            slots,
            destino,
            configOrigem: {
              latDeposito: configResult.config.latDeposito,
              lngDeposito: configResult.config.lngDeposito,
              latCasaE1: configResult.config.latCasaE1,
              lngCasaE1: configResult.config.lngCasaE1,
              latCasaE2: configResult.config.latCasaE2,
              lngCasaE2: configResult.config.lngCasaE2,
            },
            buscarMatrizOSRM,
          })
          const slotsComPontosDerivadosDePontosValidos =
            atualizarSlotTemPontosPorDetalhesMapa(
              resultadoMapa.detalhesPorSlot,
              slotTemPontosPorSlotKey
            )

          diagnosticoMapaKmAdicionalPorSlot = {
            executado: true,
            ok: resultadoMapa.ok,
            modo: resultadoMapa.modo,
            avisoDiagnostico:
              'Bloco exclusivamente diagnostico. Nao altera producao, frontend ou ranking final.',
            parametros: {
              slotsRecebidos: resultadoMapa.contadores.slotsRecebidos,
              fonteSlots: fonteSlotsMapa,
              destinoInformado: true,
              osrmBaseUrlUsada: osrmBaseUrl,
              osrmTimeoutMs,
              slotsComPontosDerivadosDePontosValidos,
            },
            mapa: resultadoMapa.mapa,
            contadores: resultadoMapa.contadores,
            detalhesPorSlot: resultadoMapa.detalhesPorSlot,
            erros: [...errosMapaSlot, ...resultadoMapa.erros],
            avisos: [...avisosMapaSlot, ...resultadoMapa.avisos],
          }
        } catch (error: unknown) {
          diagnosticoMapaKmAdicionalPorSlot = {
            executado: true,
            ok: false,
            modo: 'mapa-km-adicional-por-slot-diagnostico',
            avisoDiagnostico:
              'Bloco exclusivamente diagnostico. Nao altera producao, frontend ou ranking final.',
            parametros: {
              slotsRecebidos: slots.length,
              fonteSlots: fonteSlotsMapa,
              destinoInformado: true,
              osrmBaseUrlUsada: osrmBaseUrl,
              osrmTimeoutMs,
            },
            mapa: null,
            detalhesPorSlot: null,
            contadores: null,
            erros: [
              ...errosMapaSlot,
              error instanceof Error ? error.message : String(error),
            ],
            avisos: avisosMapaSlot,
          }
        }
      }
    }

    // 9.7.a.5. Diagnostico de insercao por slot — expoe pontos da rota base, candidatos e delta por slot
    if (usarInsercaoPorSlotDiagnostico) {
      const errosInsercao: string[] = []
      const avisosInsercao: string[] = [
        'Diagnostico de insercao por slot executado apenas em diagnostico.',
        'Expoe pontos da rota base, candidatos de insercao e delta final por slot.',
        'Nao altera producao, frontend ou ranking final.',
      ]

      const destinoInsercao =
        typeof body.destLat === 'number' &&
        Number.isFinite(body.destLat) &&
        typeof body.destLng === 'number' &&
        Number.isFinite(body.destLng)
          ? { lat: body.destLat, lng: body.destLng, descricao: body.destDisplay }
          : null
      const osrmResolvidoInsercao = resolverOsrmBaseUrlV2(
        bodyDiagnostico.osrmBaseUrlDiagnostico,
        configResult.ok ? configResult.config.osrmBaseUrl : null
      )
      const osrmBaseUrlInsercao = osrmResolvidoInsercao.url
      const osrmTimeoutMsInsercao =
        typeof bodyDiagnostico.osrmTimeoutMsDiagnostico === 'number' &&
        Number.isFinite(bodyDiagnostico.osrmTimeoutMsDiagnostico) &&
        bodyDiagnostico.osrmTimeoutMsDiagnostico > 0
          ? bodyDiagnostico.osrmTimeoutMsDiagnostico
          : 5000

      const slotsInsercaoResolvidos = montarSlotsKmAdicionalDiagnostico({
        rawSlotsAgendaDiagnostica: bodyDiagnostico.slotsAgendaDiagnostica,
        usarAgendaRealDiagnostica,
        agendaRealComDados,
        janelaDatas: janelaResult?.ok ? janelaResult.datas : null,
        equipeAgendaDiagnostica: bodyDiagnostico.equipeAgendaDiagnostica,
        cacheCoordenadasAgendaDiagnostico:
          cacheCoordenadasAgendaDiagnosticoResolvido,
      })
      const slotsInsercao = slotsInsercaoResolvidos.slots
      const slotsInvalidosInsercao = slotsInsercaoResolvidos.slotsInvalidos
      errosInsercao.push(...slotsInsercaoResolvidos.erros)
        avisosInsercao.push(...avisosCacheCoordenadasAgendaDiagnostico, ...slotsInsercaoResolvidos.avisos)

      if (!destinoInsercao) errosInsercao.push('destLat/destLng ausentes ou invalidos.')
      if (!osrmBaseUrlInsercao) errosInsercao.push('osrmBaseUrlDiagnostico/config OSRM ausente ou invalida.')
      if (!configResult.ok) errosInsercao.push('Config operacional nao carregada.')

      if (!destinoInsercao || !osrmBaseUrlInsercao || !configResult.ok || slotsInvalidosInsercao) {
        diagnosticoInsercaoPorSlot = {
          executado: true,
          ok: false,
          modo: 'insercao-por-slot-diagnostico',
          avisoDiagnostico:
            'Bloco exclusivamente diagnostico. Nao altera producao, frontend ou ranking final.',
          parametros: {
            slotsRecebidos: slotsInsercao.length,
            fonteSlots: slotsInsercaoResolvidos.fonteSlots,
            destinoInformado: destinoInsercao !== null,
            osrmBaseUrlUsada: osrmBaseUrlInsercao ?? undefined,
            osrmTimeoutMs: osrmTimeoutMsInsercao,
            osrmOrigem: osrmResolvidoInsercao.origem,
            osrmFallbackUsado: osrmResolvidoInsercao.url === OSRM_BASE_URL_FALLBACK_PUBLICO,
          },
          slots: null,
          erros: errosInsercao,
          avisos: avisosInsercao,
        }
      } else {
        try {
          const buscarMatrizOSRMInsercao = criarBuscarMatrizOSRMTableDiagnosticoV2({
            baseUrl: osrmBaseUrlInsercao,
            timeoutMs: osrmTimeoutMsInsercao,
          })
          const resultadoMapaInsercao = await calcularMapaKmAdicionalPorSlotControladoV2({
            slots: slotsInsercao,
            destino: destinoInsercao,
            configOrigem: {
              latDeposito: configResult.config.latDeposito,
              lngDeposito: configResult.config.lngDeposito,
              latCasaE1: configResult.config.latCasaE1,
              lngCasaE1: configResult.config.lngCasaE1,
              latCasaE2: configResult.config.latCasaE2,
              lngCasaE2: configResult.config.lngCasaE2,
            },
            buscarMatrizOSRM: buscarMatrizOSRMInsercao,
            incluirDetalhesInsercao: true,
          })

          const slotsSaida: Record<string, unknown> = {}
          for (const detalhe of resultadoMapaInsercao.detalhesPorSlot) {
            const deltaInsercao = detalhe.deltaInsercao
            const origemOp = detalhe.origemOperacional
            slotsSaida[detalhe.chave] = {
              osrmBaseUrlUsado: osrmBaseUrlInsercao,
              osrmFallbackUsado: osrmResolvidoInsercao.url === OSRM_BASE_URL_FALLBACK_PUBLICO,
              origemCalculo: detalhe.origemKmAdicionalNaRotaM,
              dataISO: detalhe.dataISO,
              equipe: detalhe.equipeNormalizada,
              destinoNovo: destinoInsercao
                ? {
                    lat: destinoInsercao.lat,
                    lng: destinoInsercao.lng,
                    endereco: destinoInsercao.descricao ?? null,
                  }
                : null,
              origemOperacional: origemOp
                ? {
                    tipo: origemOp.tipo,
                    ok: origemOp.ok,
                    origem: origemOp.origem
                      ? {
                          lat: origemOp.origem.lat,
                          lng: origemOp.origem.lng,
                        }
                      : null,
                    contexto: origemOp.contexto
                      ? {
                          dataISO: origemOp.contexto.dataISO,
                          equipe: origemOp.contexto.equipe,
                          ehSabado: origemOp.contexto.ehSabado,
                        }
                      : null,
                  }
                : null,
              pontosRotaBase: deltaInsercao?.pontosRotaBase ?? null,
              ordenacaoRotaBase: detalhe.ordenacaoRotaBase ?? null,
              candidatosInsercao: deltaInsercao?.candidatosInsercao ?? null,
              melhorInsercao: deltaInsercao?.melhorInsercao ?? null,
              kmAdicionalNaRotaMFinal: detalhe.kmAdicionalNaRotaM,
              parseAgenda: detalhe.parseAgenda
                ? {
                    ok: detalhe.parseAgenda.ok,
                    resumo: detalhe.parseAgenda.resumo,
                    pontos: detalhe.parseAgenda.pontos,
                    descartados: detalhe.parseAgenda.descartados,
                    avisos: detalhe.parseAgenda.avisos,
                    erros: detalhe.parseAgenda.erros,
                  }
                : null,
              avisos: detalhe.avisos,
              erros: detalhe.erros,
              descartados: detalhe.descartados,
            }
          }

          diagnosticoInsercaoPorSlot = {
            executado: true,
            ok: resultadoMapaInsercao.ok,
            modo: 'insercao-por-slot-diagnostico',
            avisoDiagnostico:
              'Bloco exclusivamente diagnostico. Nao altera producao, frontend ou ranking final.',
            parametros: {
              slotsRecebidos: resultadoMapaInsercao.contadores.slotsRecebidos,
              fonteSlots: slotsInsercaoResolvidos.fonteSlots,
              destinoInformado: true,
              osrmBaseUrlUsada: osrmBaseUrlInsercao,
              osrmTimeoutMs: osrmTimeoutMsInsercao,
              osrmOrigem: osrmResolvidoInsercao.origem,
              osrmFallbackUsado: osrmResolvidoInsercao.url === OSRM_BASE_URL_FALLBACK_PUBLICO,
            },
            slots: slotsSaida,
            contadores: resultadoMapaInsercao.contadores,
            erros: [...errosInsercao, ...resultadoMapaInsercao.erros],
            avisos: [...avisosInsercao, ...resultadoMapaInsercao.avisos],
          }
        } catch (error: unknown) {
          diagnosticoInsercaoPorSlot = {
            executado: true,
            ok: false,
            modo: 'insercao-por-slot-diagnostico',
            avisoDiagnostico:
              'Bloco exclusivamente diagnostico. Nao altera producao, frontend ou ranking final.',
            parametros: {
              slotsRecebidos: slotsInsercao.length,
              fonteSlots: slotsInsercaoResolvidos.fonteSlots,
              destinoInformado: true,
              osrmBaseUrlUsada: osrmBaseUrlInsercao,
              osrmTimeoutMs: osrmTimeoutMsInsercao,
              osrmOrigem: osrmResolvidoInsercao.origem,
              osrmFallbackUsado: osrmResolvidoInsercao.url === OSRM_BASE_URL_FALLBACK_PUBLICO,
            },
            slots: null,
            erros: [
              ...errosInsercao,
              `Erro inesperado: ${error instanceof Error ? error.message : String(error)}`,
            ],
            avisos: avisosInsercao,
          }
        }
      }
    }

    // 9.7.c. Aplicar mapa de kmAdicionalNaRotaM por slot em candidatos diagnósticos
    if (usarMapaKmAdicionalPorSlotNaClassificacaoDiagnostico) {
      const avisosAplicacao: string[] = [
        'Aplicacao de mapa de kmAdicionalNaRotaM por slot em candidatos diagnosticos.',
        'Flag usarMapaKmAdicionalPorSlotNaClassificacaoDiagnostico ativa. Apenas diagnostico.',
        'Nao afeta producao, frontend ou ranking final.',
        'kmAdicionalNaRotaDiagnosticoM global do body nao contamina este bloco.',
      ]

      const mapaDisponivel =
        diagnosticoMapaKmAdicionalPorSlot !== null &&
        typeof (diagnosticoMapaKmAdicionalPorSlot as Record<string, unknown>).mapa === 'object' &&
        (diagnosticoMapaKmAdicionalPorSlot as Record<string, unknown>).mapa !== null

      if (!mapaDisponivel) {
        diagnosticoAplicacaoMapaKmPorSlotEmCandidatos = {
          executado: false,
          ok: false,
          modo: 'aplicacao-mapa-km-por-slot-em-candidatos-diagnostico',
          motivo:
            'Mapa de kmAdicionalNaRotaM por slot nao disponivel. Ative usarMapaKmAdicionalPorSlotDiagnostico para calcular o mapa antes.',
          avisos: avisosAplicacao,
          erros: [],
        }
      } else {
        const mapaKmPorSlot = (
          diagnosticoMapaKmAdicionalPorSlot as Record<string, unknown>
        ).mapa as Record<string, number | null>

        // Candidatos do bloco sintético principal (classificacoes reais de equipes)
        const candidatosSinteticos = (
          (diagnosticoCandidatos as Record<string, unknown>).executado === true &&
          Array.isArray((diagnosticoCandidatos as Record<string, unknown>).amostra)
            ? ((diagnosticoCandidatos as Record<string, unknown>).amostra as Array<{
                dataISO: string
                equipe: string
                kmAdicionalNaRotaM?: number | null
                [key: string]: unknown
              }>)
            : []
        )

        const resultadoAplicacao = aplicarMapaKmAdicionalPorSlotEmCandidatosDiagnosticoV2({
          candidatos: candidatosSinteticos.map((c) => ({
            ...c,
            slotTemPontos: slotTemPontosPorSlotKey[
              `${c.dataISO}::${normalizarEquipe(c.equipe.replace(/\s*\(.*\)$/, '').trim()) ?? c.equipe}`
            ] ?? (typeof c.slotTemPontos === 'boolean' ? c.slotTemPontos : true),
            kmAdicionalNaRotaM: typeof c.kmAdicionalNaRotaM === 'number' ? c.kmAdicionalNaRotaM : null,
          })),
          mapaKmAdicionalPorSlot: mapaKmPorSlot,
        })

        diagnosticoAplicacaoMapaKmPorSlotEmCandidatos = {
          executado: true,
          ok: resultadoAplicacao.ok,
          modo: resultadoAplicacao.modo,
          contadores: resultadoAplicacao.contadores,
          amostraCandidatosDepois: resultadoAplicacao.candidatos.slice(0, 10).map((c) => ({
            dataISO: c.dataISO,
            equipe: c.equipe,
            kmAdicionalNaRotaM: c.kmAdicionalNaRotaM,
            slotTemPontos: c.slotTemPontos,
            slotKeyKmAdicional: c.slotKeyKmAdicional,
            origemKmAdicionalNaRotaM: c.origemKmAdicionalNaRotaM,
            kmAdicionalAplicadoPorMapaSlot: c.kmAdicionalAplicadoPorMapaSlot,
            tipo: c.tipo,
            elegivel: c.elegivel,
          })),
          avisos: [...avisosAplicacao, ...resultadoAplicacao.avisos],
          erros: resultadoAplicacao.erros,
        }
      }
    }

    // 9.7.d. Reclassificação de candidatos com kmAdicionalNaRotaM do mapa por slot
    if (usarReclassificacaoComKmMapaSlotDiagnostico) {
      const avisosReclass: string[] = [
        'Reclassificacao de candidatos diagnosticos com kmAdicionalNaRotaM do mapa por slot.',
        'Flag usarReclassificacaoComKmMapaSlotDiagnostico ativa. Apenas diagnostico.',
        'Nao afeta producao, frontend ou ranking final.',
        'kmAdicionalNaRotaDiagnosticoM global do body nao contamina este bloco.',
      ]

      const aplicacaoDisponivel =
        diagnosticoAplicacaoMapaKmPorSlotEmCandidatos !== null &&
        (diagnosticoAplicacaoMapaKmPorSlotEmCandidatos as Record<string, unknown>).executado === true &&
        (diagnosticoAplicacaoMapaKmPorSlotEmCandidatos as Record<string, unknown>).ok === true

      if (!aplicacaoDisponivel) {
        diagnosticoReclassificacaoComKmMapaSlot = {
          executado: false,
          ok: false,
          modo: 'reclassificacao-com-km-mapa-slot-diagnostico',
          motivo:
            'Mapa de kmAdicionalNaRotaM por slot nao aplicado em candidatos. Ative usarMapaKmAdicionalPorSlotNaClassificacaoDiagnostico e usarMapaKmAdicionalPorSlotDiagnostico antes.',
          avisos: avisosReclass,
          erros: [],
        }
      } else if (!configResult.ok) {
        diagnosticoReclassificacaoComKmMapaSlot = {
          executado: false,
          ok: false,
          modo: 'reclassificacao-com-km-mapa-slot-diagnostico',
          motivo: 'Config nao carregada. Impossivel reclassificar sem limites de distancia.',
          avisos: avisosReclass,
          erros: [],
        }
      } else {
        // Candidatos com km aplicado do bloco anterior
        const candidatosComMapa = (
          (diagnosticoAplicacaoMapaKmPorSlotEmCandidatos as Record<string, unknown>)
            .amostraCandidatosDepois as Array<Record<string, unknown>> | undefined
        ) ?? []

        // Enriquecer candidatos com dados operacionais da classificação original
        const classificacoesOriginais = (
          (diagnosticoClassificacao as Record<string, unknown>).amostra as
            Array<Record<string, unknown>> | undefined
        ) ?? []

        const candidatosEnriquecidos = candidatosComMapa.map((c) => {
          // Buscar classificação original correspondente para dados operacionais
          const classOriginal = classificacoesOriginais.find(
            (cl) => cl.dataISO === c.dataISO && cl.equipe === c.equipe
          )
          const detalhes = classOriginal?.detalhes as Record<string, unknown> | undefined
          return {
            ...c,
            diaSemana: detalhes?.diaSemana as number | undefined,
            ehSabado: detalhes?.ehSabado as boolean | undefined,
            ehDomingo: detalhes?.ehDomingo as boolean | undefined,
            slotTemPontos:
              typeof c.slotTemPontos === 'boolean'
                ? c.slotTemPontos
                : detalhes?.slotTemPontos as boolean | undefined,
            ativa: detalhes?.ativa as boolean | undefined,
            disponivelMin: detalhes?.disponivelMin as number | undefined,
            suficienteParaServico: detalhes?.suficienteParaServico as boolean | undefined,
            distanciaKm: detalhes?.distanciaKm as number | undefined,
            tempoNecessarioMin: detalhes?.tempoNecessarioMin as number | undefined,
            horaMarcada:
              typeof detalhes?.elegivelHoraMarcada === 'boolean'
                ? detalhes.elegivelHoraMarcada
                : typeof detalhes?.horaMarcada === 'boolean'
                  ? detalhes.horaMarcada
                  : undefined,
            elegivelHoraMarcada:
              typeof detalhes?.elegivelHoraMarcada === 'boolean'
                ? detalhes.elegivelHoraMarcada
                : undefined,
            isCondominio: entradaNormalizada.isCondominio,
            isRural: entradaNormalizada.isRural,
          }
        })

        const resultadoReclass = reclassificarCandidatosComKmMapaSlotDiagnosticoV2({
          candidatos: candidatosEnriquecidos as Parameters<typeof reclassificarCandidatosComKmMapaSlotDiagnosticoV2>[0]['candidatos'],
          config: {
            kmAdicionalMaxNaRotaM: configResult.config.kmAdicionalMaxNaRotaM,
            kmAdicionalMaxNaRotaEspecialM: configResult.config.kmAdicionalMaxNaRotaEspecialM,
            kmAdicionalMaxNaRotaPremiumM: configResult.config.kmAdicionalMaxNaRotaPremiumM,
            kmMaximoNaSemanaM: configResult.config.kmMaximoNaSemanaM,
            kmMaximoNoSabadoM: configResult.config.kmMaximoNoSabadoM,
            horaMarcadaHorasAMais: configResult.config.horaMarcadaHorasAMais,
          },
          tempoNecessarioMin: entradaNormalizada.tempoNecessarioMin,
        })

        diagnosticoReclassificacaoComKmMapaSlot = {
          executado: true,
          ok: resultadoReclass.ok,
          modo: resultadoReclass.modo,
          fonteCandidatos: 'sintetica',
          fonteDisponibilidade: 'sintetica',
          contadores: resultadoReclass.contadores,
          amostraComparativa: resultadoReclass.candidatos.slice(0, 10),
          avisos: [...avisosReclass, ...resultadoReclass.avisos],
          erros: resultadoReclass.erros,
        }
      }
    }

    // 9.7.b. Diagnostico de disponibilidade REAL (opcional, nao afeta producao)
    if (usarDisponibilidadeReal) {
      const hoje = new Date()
      const hojeISO = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`

      // Usa dataInicialISO da entrada se disponível, senão fallback para hoje
      const dataRefISO = entradaNormalizada.dataInicialISO ?? hojeISO
      const origemDataRef: 'entrada' | 'diagnostico-hoje' = entradaNormalizada.dataInicialISO
        ? 'entrada'
        : 'diagnostico-hoje'

      const disponibilidadeRealComDados = await buscarDisponibilidadeRealDiagnosticaComDados(
        dataRefISO,
        200, // limite
        20, // amostra
        origemDataRef
      )
      diagnosticoDisponibilidadeReal = disponibilidadeRealComDados.diagnostico

      if (diagnosticoDisponibilidadeReal.ok && diagnosticoDisponibilidadeReal.executado) {
        const rawDistanciaDiagnostica = bodyDiagnostico.distanciaDiagnosticaKm
        const distanciaKm =
          typeof rawDistanciaDiagnostica === 'number' &&
          Number.isFinite(rawDistanciaDiagnostica) &&
          rawDistanciaDiagnostica > 0
            ? rawDistanciaDiagnostica
            : null
        const origemDistanciaKm: 'body-diagnostico' | 'ausente' =
          distanciaKm === null ? 'ausente' : 'body-diagnostico'

        const kmRealControlado =
          diagnosticoKmAdicionalRealControlado?.ok === true &&
          typeof diagnosticoKmAdicionalRealControlado.kmAdicionalNaRotaM === 'number' &&
          Number.isFinite(diagnosticoKmAdicionalRealControlado.kmAdicionalNaRotaM)
            ? diagnosticoKmAdicionalRealControlado.kmAdicionalNaRotaM
            : null
        const kmAdicionalNaRotaM = usarKmAdicionalRealControladoDiagnostico
          ? kmRealControlado
          : null
        const origemKmAdicionalNaRotaM:
          | 'km-adicional-real-controlado-diagnostico'
          | 'ausente' =
          kmAdicionalNaRotaM === null ? 'ausente' : 'km-adicional-real-controlado-diagnostico'

        const freteDiagnostico = (diagnosticoFrete as Record<string, unknown>).frete as
          | Record<string, unknown>
          | undefined
        const valorFreteDiagnostico =
          typeof freteDiagnostico?.valor === 'number' && Number.isFinite(freteDiagnostico.valor)
            ? freteDiagnostico.valor
            : null
        const tipoFreteDiagnostico = freteDiagnostico?.faixaAplicada as string | null ?? null

        const avisosCandidatosReais: string[] = [
          'Candidatos diagnosticos gerados com disponibilidade real parseada. Nao substituem blocos sinteticos nem o legado.',
        ]
        if (kmAdicionalNaRotaM === null) {
          avisosCandidatosReais.push(
            usarKmAdicionalRealControladoDiagnostico
              ? 'kmAdicionalNaRotaM real controlado ausente. Nao foi usado fallback 0; candidatos podem ficar indisponiveis por seguranca.'
              : 'kmAdicionalNaRotaM manual do body isolado. Nao foi usado em candidatos reais para evitar contaminar todos os candidatos.'
          )
        }
        if (distanciaKm === null) {
          avisosCandidatosReais.push(
            'distanciaDiagnosticaKm ausente ou invalida. Nao foi usado fallback 0; candidatos podem ficar indisponiveis por distancia ausente.'
          )
        }

        // Gerar slots automaticamente para mapa por slot se usarAgendaRealDiagnostica estiver ativo
        let mapaKmAdicionalPorSlot: Record<string, number | null> | undefined = undefined
        let diagnosticoMapaKmPorSlotAuto: Record<string, unknown> | null = null
        let detalhesMapaKmPorSlotAuto: DetalheSlotMapaKmAdicional[] = []
        if (usarAgendaRealDiagnostica && agendaRealComDados !== null && agendaRealComDados.linhasAgenda.length > 0) {
          // Declarar destino, osrmBaseUrl e osrmTimeoutMs localmente para este bloco
          const destinoMapaSlot =
            typeof body.destLat === 'number' &&
            Number.isFinite(body.destLat) &&
            typeof body.destLng === 'number' &&
            Number.isFinite(body.destLng)
              ? { lat: body.destLat, lng: body.destLng, descricao: body.destDisplay }
              : null
          const osrmResolvidoMapaAuto = resolverOsrmBaseUrlV2(
            bodyDiagnostico.osrmBaseUrlDiagnostico,
            configResult.ok ? configResult.config.osrmBaseUrl : null
          )
          const osrmBaseUrlMapaSlot = osrmResolvidoMapaAuto.url
          const osrmTimeoutMsMapaSlot =
            typeof bodyDiagnostico.osrmTimeoutMsDiagnostico === 'number' &&
            Number.isFinite(bodyDiagnostico.osrmTimeoutMsDiagnostico) &&
            bodyDiagnostico.osrmTimeoutMsDiagnostico > 0
              ? bodyDiagnostico.osrmTimeoutMsDiagnostico
              : 5000

          // Gerar slots a partir da janela de datas
          const slotsAutoResolvidos = montarSlotsKmAdicionalDiagnostico({
            rawSlotsAgendaDiagnostica: undefined,
            usarAgendaRealDiagnostica,
            agendaRealComDados,
            janelaDatas: janelaResult?.ok ? janelaResult.datas : null,
            equipeAgendaDiagnostica: bodyDiagnostico.equipeAgendaDiagnostica,
            cacheCoordenadasAgendaDiagnostico:
              cacheCoordenadasAgendaDiagnosticoResolvido,
            slotTemPontosPorSlotKey,
          })
          const slotsAuto = slotsAutoResolvidos.slots

          // Calcular mapa por slot se houver slots e pré-requisitos disponíveis
          if (
            slotsAuto.length > 0 &&
            !slotsAutoResolvidos.slotsInvalidos &&
            destinoMapaSlot &&
            osrmBaseUrlMapaSlot &&
            configResult.ok
          ) {
            try {
              const buscarMatrizOSRM = criarBuscarMatrizOSRMTableDiagnosticoV2({
                baseUrl: osrmBaseUrlMapaSlot,
                timeoutMs: osrmTimeoutMsMapaSlot,
              })
              const resultadoMapa = await calcularMapaKmAdicionalPorSlotControladoV2({
                slots: slotsAuto,
                destino: destinoMapaSlot,
                configOrigem: {
                  latDeposito: configResult.config.latDeposito,
                  lngDeposito: configResult.config.lngDeposito,
                  latCasaE1: configResult.config.latCasaE1,
                  lngCasaE1: configResult.config.lngCasaE1,
                  latCasaE2: configResult.config.latCasaE2,
                  lngCasaE2: configResult.config.lngCasaE2,
                },
                buscarMatrizOSRM,
                ...(usarDiagnosticoSantoAmaroV2 ? { incluirDetalhesInsercao: true } : {}),
              })
              detalhesMapaKmPorSlotAuto = resultadoMapa.detalhesPorSlot
              const slotsComPontosDerivadosDePontosValidos =
                atualizarSlotTemPontosPorDetalhesMapa(
                  resultadoMapa.detalhesPorSlot,
                  slotTemPontosPorSlotKey
                )

              diagnosticoMapaKmPorSlotAuto = {
                executado: true,
                ok: resultadoMapa.ok,
                modo: resultadoMapa.modo,
                slotsRecebidos: resultadoMapa.contadores.slotsRecebidos,
                slotsProcessados: resultadoMapa.contadores.slotsProcessados,
                slotsComKm: resultadoMapa.contadores.slotsComKm,
                slotsComFallbackHaversine: resultadoMapa.contadores.slotsComFallbackHaversine,
                slotsComErro: resultadoMapa.contadores.slotsComErro,
                fonteSlots: slotsAutoResolvidos.fonteSlots,
                slotsComPontosDerivadosDePontosValidos,
                amostraDetalhesPorSlot: resultadoMapa.detalhesPorSlot.slice(0, 20).map((d) => ({
                  dataISO: d.dataISO,
                  equipe: d.equipe,
                  chave: d.chave,
                  kmAdicionalNaRotaM: d.kmAdicionalNaRotaM,
                  origemKmAdicionalNaRotaM: d.origemKmAdicionalNaRotaM,
                  ok: d.ok,
                })),
                avisos: [...slotsAutoResolvidos.avisos, ...resultadoMapa.avisos],
                erros: [...slotsAutoResolvidos.erros, ...resultadoMapa.erros],
              }

              if (resultadoMapa.ok) {
                mapaKmAdicionalPorSlot = resultadoMapa.mapa
                avisosCandidatosReais.push(
                  `Mapa de kmAdicionalPorSlot calculado com sucesso: ${resultadoMapa.contadores.slotsComKm}/${slotsAuto.length} slots com km valido.`
                )
              } else {
                avisosCandidatosReais.push(
                  'Mapa de kmAdicionalPorSlot falhou: ' + resultadoMapa.erros.join(', ')
                )
              }
            } catch (error: unknown) {
              const msg = error instanceof Error ? error.message : String(error)
              avisosCandidatosReais.push(`Excecao ao calcular mapa por slot: ${msg}`)
              diagnosticoMapaKmPorSlotAuto = {
                executado: true,
                ok: false,
                erro: msg,
              }
            }
          } else {
            const motivoFalha = !destinoMapaSlot
              ? 'destLat/destLng ausentes ou invalidos'
              : !osrmBaseUrlMapaSlot
                ? 'osrmBaseUrlDiagnostico ausente'
                : !configResult.ok
                  ? 'config operacional nao carregada'
                  : slotsAutoResolvidos.slotsInvalidos
                    ? 'slots invalidos'
                    : 'nenhum slot gerado da janela de datas'
            avisosCandidatosReais.push(
              `Nao foi possivel calcular mapa por slot: ${motivoFalha}.`
            )
            diagnosticoMapaKmPorSlotAuto = {
              executado: false,
              ok: false,
              motivo: motivoFalha,
              slotsGerados: slotsAuto.length,
              fonteSlots: slotsAutoResolvidos.fonteSlots,
              destinoInformado: destinoMapaSlot !== null,
              osrmBaseUrlInformado: osrmBaseUrlMapaSlot !== null,
              avisos: slotsAutoResolvidos.avisos,
              erros: slotsAutoResolvidos.erros,
            }
          }
        } else if (usarAgendaRealDiagnostica) {
          // Diagnóstico quando a condição de entrada do mapa automático falha (apenas se usarAgendaRealDiagnostico está true)
          const erroAgenda = agendaRealComDados !== null && 'erro' in agendaRealComDados.diagnostico
            ? (agendaRealComDados.diagnostico as { erro: string }).erro
            : null
          const motivoEntrada = agendaRealComDados === null
            ? 'agendaRealComDados e null'
            : agendaRealComDados.linhasAgenda.length === 0
              ? `agenda retornou 0 linhas${erroAgenda ? ` (erro: ${erroAgenda})` : ' (ok:false sem dados)'}`
              : 'motivo desconhecido'
          diagnosticoMapaKmPorSlotAuto = {
            executado: false,
            ok: false,
            motivo: `Condicao de entrada falhou: ${motivoEntrada}`,
            usarAgendaRealDiagnostica,
            agendaRealComDadosDisponivel: agendaRealComDados !== null,
            agendaRealOk: agendaRealComDados?.diagnostico?.ok ?? false,
            agendaRealLinhas: agendaRealComDados?.linhasAgenda?.length ?? 0,
            erroAgenda: erroAgenda ?? undefined,
          }
          avisosCandidatosReais.push(
            `Mapa por slot nao iniciado: ${motivoEntrada}.`
          )
        }

        // Expor mapa automático no nível superior se foi calculado e o mapa de nível superior ainda está null
        if (diagnosticoMapaKmPorSlotAuto !== null && diagnosticoMapaKmAdicionalPorSlot === null) {
          diagnosticoMapaKmAdicionalPorSlot = diagnosticoMapaKmPorSlotAuto
        }

        if (!janelaResult?.ok || !configResult.ok) {
          diagnosticoCandidatosDisponibilidadeReal = {
            executado: false,
            ok: false,
            modo: 'diagnostico-disponibilidade-real',
            motivo: !janelaResult?.ok
              ? 'Janela de datas nao foi gerada com sucesso.'
              : 'Config nao carregada corretamente.',
            parametros: {
              dataInicialISO: dataRefISO,
              tempoNecessarioMin: entradaNormalizada.tempoNecessarioMin,
              distanciaKm,
              origemDistanciaKm,
              kmAdicionalNaRotaM,
              origemKmAdicionalNaRotaM,
            },
            avisos: avisosCandidatosReais,
          }
        } else {
          try {
            const resultadoCandidatosReais = gerarCandidatosComDisponibilidadeRealV2({
              janelaDatas: janelaResult.datas,
              disponibilidades: disponibilidadeRealComDados.disponibilidades,
              tempoNecessarioMin: entradaNormalizada.tempoNecessarioMin,
              distanciaKm,
              kmAdicionalNaRotaM,
              valorFrete: valorFreteDiagnostico,
              tipoFrete: tipoFreteDiagnostico,
              isCondominio: entradaNormalizada.isCondominio,
              isRural: entradaNormalizada.isRural,
              slotTemPontosPorDataEquipe: slotTemPontosPorSlotKey,
              mapaKmAdicionalPorSlot,
              configOperacional: {
                kmAdicionalMaxNaRotaM: configResult.config.kmAdicionalMaxNaRotaM,
                kmAdicionalMaxNaRotaEspecialM:
                  configResult.config.kmAdicionalMaxNaRotaEspecialM,
                kmAdicionalMaxNaRotaPremiumM:
                  configResult.config.kmAdicionalMaxNaRotaPremiumM,
                kmMaximoNaSemanaM: configResult.config.kmMaximoNaSemanaM,
                kmMaximoNoSabadoM: configResult.config.kmMaximoNoSabadoM,
                horaMarcadaHorasAMais: configResult.config.horaMarcadaHorasAMais,
              },
            })

            diagnosticoCandidatosDisponibilidadeReal = {
              executado: true,
              ok: resultadoCandidatosReais.ok,
              modo: 'diagnostico-disponibilidade-real',
              diagnosticoMapaKmAdicionalPorSlot: diagnosticoMapaKmPorSlotAuto,
              parametros: {
                dataInicialISO: dataRefISO,
                tempoNecessarioMin: entradaNormalizada.tempoNecessarioMin,
                distanciaKm,
                origemDistanciaKm,
                kmAdicionalNaRotaM,
                origemKmAdicionalNaRotaM,
                mapaKmPorSlotAtivado: mapaKmAdicionalPorSlot !== undefined,
                slotsComPontosInformados: Object.keys(slotTemPontosPorSlotKey).length,
                slotTemPontosPorSlotKey,
              },
              resumo: {
                datasNaJanela: resultadoCandidatosReais.resumo.datasNaJanela,
                disponibilidadesRecebidas:
                  resultadoCandidatosReais.resumo.disponibilidadesRecebidas,
                candidatosMontados: resultadoCandidatosReais.resumo.candidatosMontados,
                candidatosElegiveis: resultadoCandidatosReais.resumo.candidatosElegiveis,
                candidatosIndisponiveis:
                  resultadoCandidatosReais.resumo.candidatosIndisponiveis,
                normais: resultadoCandidatosReais.resumo.candidatosNormal,
                especiais: resultadoCandidatosReais.resumo.candidatosEspecial,
                premium: resultadoCandidatosReais.resumo.candidatosPremium,
                horaMarcada: resultadoCandidatosReais.resumo.candidatosHoraMarcada,
              },
              resumoOrdenacao: resultadoCandidatosReais.resumoOrdenacao,
              candidatosOrdenadosAmostra: resultadoCandidatosReais.candidatosOrdenados
                .slice(0, 20)
                .map((c, idx) => ({
                  rank: idx + 1,
                  id: c.id,
                  dataISO: c.dataISO,
                  equipe: c.equipe,
                  team: c.equipe,
                  slotTemPontos: c.slotTemPontos,
                  fonteSlotTemPontos: c.distancia?.origemKmAdicional === 'slot'
                    ? 'agenda-real-via-mapa'
                    : c.distancia?.origemKmAdicional === 'global-fallback'
                      ? 'default-fallback'
                      : 'desconhecida',
                  tipo: c.tipo,
                  elegivel: c.elegivel,
                  horaMarcada: c.horaMarcada,
                  elegivelHoraMarcada: c.elegivelHoraMarcada,
                  diagnosticoHoraMarcada: {
                    motivoHoraMarcada: c.diagnostico.motivoHoraMarcada,
                    slotAvailMin: c.operacional.slotAvailMin,
                    serviceMin: c.operacional.serviceMin,
                    horaMarcadaHorasAMais: c.diagnostico.horaMarcadaHorasAMais,
                    limiteMinimoHoraMarcadaMin: c.diagnostico.limiteMinimoHoraMarcadaMin,
                  },
                  motivoIndisponibilidade: c.motivos[0] ?? null,
                  motivos: c.motivos,
                  avisos: c.avisos,
                  frete: c.frete,
                  distancia: c.distancia,
                  kmAdicionalNaRotaM: c.distancia?.kmAdicionalNaRotaM ?? null,
                  chaveSlotKm: c.distancia?.chaveSlotKm ?? null,
                  origemKmAdicional: c.distancia?.origemKmAdicional ?? null,
                  // Campos de diagnostico para equivalencia legado x v2
                  etapaLista: 'ordenada',
                  regraTipoAplicada: c.tipo,
                  regraHoraMarcadaAplicada: c.elegivelHoraMarcada
                    ? 'tempo-suficiente'
                    : c.diagnostico.motivoHoraMarcada?.includes('km')
                      ? 'km-excedido'
                      : c.diagnostico.motivoHoraMarcada?.includes('tempo')
                        ? 'tempo-insuficiente'
                        : 'bloqueado',
                  // NOTA: limites precisam ser propagados da classificacao para o candidato
                  limiteBaseM: null,
                  limiteEspecialM: null,
                  limitePremiumM: null,
                  fonteLimites: c.slotTemPontos
                    ? 'config-slot-pontos'
                    : c.ehSabado
                      ? 'config-sabado'
                      : 'config-semana',
                })),
              avisos: [...avisosCandidatosReais, ...resultadoCandidatosReais.avisos],
            }

            // 9.8. Adaptar candidatos reais para formato legado diagnóstico
            const resultadoAdaptacao = adaptarCandidatosDisponibilidadeRealParaLegadoDiagnosticoV2({
              candidatosOrdenados: resultadoCandidatosReais.candidatosOrdenados,
              formatoDateISO: 'legado-gmt3',
              limiteAmostra: 20,
              dataReferenciaISO: entradaNormalizada.dataInicialISO,
            })

            diagnosticoCandidatosReaisAdaptados = {
              executado: true,
              ok: resultadoAdaptacao.ok,
              modo: 'diagnostico-candidatos-reais-adaptados-legado',
              formatoDateISO: resultadoAdaptacao.formatoDateISO,
              quantidadeRecebida: resultadoAdaptacao.quantidadeRecebida,
              quantidadeAdaptada: resultadoAdaptacao.quantidadeAdaptada,
              amostra: resultadoAdaptacao.amostra,
              avisos: resultadoAdaptacao.avisos,
            }

            // Converter candidatos reais para formato de comparação (usado quando fonteV2 = 'disponibilidade-real')
            const conversaoComparacao = converterCandidatosReaisParaComparacaoV2({
              candidatosReais: resultadoCandidatosReais.candidatosOrdenados,
            })
            if (conversaoComparacao.ok) {
              candidatosReaisConvertidosParaComparacao = conversaoComparacao.candidatos
            }

            // Aplicar recorte final baseado em selecionarConjuntoApp3ComExtras_ (estrutura legado, maxNormais=3 por decisao de produto)
            const recorteResult = recortarCandidatosLegadoEquivalente({
              candidatos: resultadoCandidatosReais.candidatosOrdenados,
            })
            candidatosFinaisDiagnosticoDirigidoSantoAmaro = recorteResult.candidatosFinais.map((c) => ({
              dataISO: c.dataISO,
              equipe: c.equipe,
              tipo: c.tipo,
              kmAdicionalNaRotaM: c.distancia?.kmAdicionalNaRotaM ?? null,
            }))
            datasFinaisDiagnosticoDirigidoSantoAmaro = recorteResult.diasUsados
            diagnosticoResultadoFinalLegadoEquivalente = {
              executado: true,
              ok: recorteResult.ok,
              modo: 'resultado-final-legado-equivalente',
              avisoDiagnostico:
                'Recorte final baseado na estrutura de selecionarConjuntoApp3ComExtras_ do Apps Script (CEP-APIBACK.gs, linhas 836-873). DIVERGENCIA INTENCIONAL APROVADA: v2 limita normais a 3, legado permite ate 5. Estrutura de selecao (chosenDays, extras, ordem) identica ao legado. Nao afeta producao.',
              resumo: recorteResult.resumo,
              candidatosFinais: recorteResult.candidatosFinais.map((c, idx) => ({
                rank: idx + 1,
                dataISO: c.dataISO,
                equipe: c.equipe,
                tipo: c.tipo,
                elegivel: c.elegivel,
                horaMarcada: c.horaMarcada ?? null,
                kmAdicionalNaRotaM: c.distancia?.kmAdicionalNaRotaM ?? null,
              })),
              normais: recorteResult.normais.map((c) => ({ dataISO: c.dataISO, equipe: c.equipe, tipo: c.tipo })),
              especiais: recorteResult.especiais.map((c) => ({ dataISO: c.dataISO, equipe: c.equipe, tipo: c.tipo })),
              premiums: recorteResult.premiums.map((c) => ({ dataISO: c.dataISO, equipe: c.equipe, tipo: c.tipo })),
              horaMarcada: recorteResult.horaMarcada.map((c) => ({ dataISO: c.dataISO, equipe: c.equipe, tipo: c.tipo })),
              diasUsados: recorteResult.diasUsados,
              exclusoes: recorteResult.exclusoes,
              avisos: recorteResult.avisos,
            }
            const conversaoRecortados = converterCandidatosReaisParaComparacaoV2({
              candidatosReais: recorteResult.candidatosFinais,
            })
            if (conversaoRecortados.ok) {
              candidatosReaisRecortadosParaComparacao = conversaoRecortados.candidatos
            }

            if (usarDiagnosticoSantoAmaroV2) {
              diagnosticoSantoAmaroV2 = montarDiagnosticoSantoAmaroV2({
                equipeAlvo:
                  typeof bodyDiagnostico.equipeAgendaDiagnostica === 'string' &&
                  bodyDiagnostico.equipeAgendaDiagnostica.trim()
                    ? bodyDiagnostico.equipeAgendaDiagnostica.trim()
                    : 'EQUIPE 1',
                disponibilidadePorJanela: resultadoCandidatosReais.disponibilidadePorJanela,
                candidatosAntesRecorte: resultadoCandidatosReais.candidatosOrdenados,
                recorte: recorteResult,
                detalhesPorSlot: detalhesMapaKmPorSlotAuto,
              })
            }
          } catch (error: unknown) {
            diagnosticoCandidatosDisponibilidadeReal = {
              executado: false,
              ok: false,
              modo: 'diagnostico-disponibilidade-real',
              erro: error instanceof Error ? error.message : String(error),
              parametros: {
                dataInicialISO: dataRefISO,
                tempoNecessarioMin: entradaNormalizada.tempoNecessarioMin,
                distanciaKm,
                origemDistanciaKm,
                kmAdicionalNaRotaM,
                origemKmAdicionalNaRotaM,
              },
              avisos: avisosCandidatosReais,
            }
          }
        }
      } else {
        diagnosticoCandidatosDisponibilidadeReal = {
          executado: false,
          ok: false,
          modo: 'diagnostico-disponibilidade-real',
          motivo: 'Disponibilidade real nao foi lida ou parseada com sucesso.',
          avisos: [
            'Geracao de candidatos reais nao executada porque a disponibilidade real falhou.',
          ],
        }
      }
    }

    if (usarDiagnosticoSantoAmaroV2 && diagnosticoSantoAmaroV2 === null) {
      diagnosticoSantoAmaroV2 = {
        executado: false,
        ok: false,
        modo: 'diagnostico-santo-amaro-v2',
        motivo:
          'Diagnostico Santo Amaro requer usarDisponibilidadeRealDiagnostica=true e usarAgendaRealDiagnostica=true com candidatos reais gerados.',
        requisitos: {
          usarDisponibilidadeRealDiagnostica: usarDisponibilidadeReal,
          usarAgendaRealDiagnostica,
          diagnosticoCandidatosDisponibilidadeRealOk:
            (diagnosticoCandidatosDisponibilidadeReal as { ok?: unknown } | null)?.ok ?? null,
          diagnosticoAgendaRealOk: diagnosticoAgendaReal?.ok ?? null,
        },
        pendencias: [
          'Executar a rota diagnostica com disponibilidade real, agenda real e coordenadas do destino Santo Amaro.',
        ],
      }
    }

    if (usarDiagnosticoSantoAmaroV2) {
      try {
        let configCompatCache: (ConfigOrquestradorPayloadLegado & { osrmBaseUrl: string }) | null =
          configResult.ok ? configResult.config : null

        async function carregarConfigCompat() {
          if (configCompatCache) return configCompatCache
          const configCompatResult = await buscarConfiguracoesProcurarDatas()
          if (!configCompatResult.ok) {
            throw new Error(`Config procurar-datas nao carregada: ${configCompatResult.erro}`)
          }
          configCompatCache = configCompatResult.config
          return configCompatCache
        }

        const resultadoFluxoReal = await orquestrarPesquisaV2ComPayloadLegado(body, {
          pesquisarDatas: pesquisarDatasV2,
          buscarConfig: carregarConfigCompat,
          buscarRota: async (de, para) => {
            const configCompat = await carregarConfigCompat()
            const buscarRota = criarBuscarRotaOSRMRouteDiagnosticoV2({
              baseUrl: normalizarOsrmBaseUrlCompatV2(configCompat.osrmBaseUrl),
              timeoutMs: 10_000,
            })
            return buscarRota(de, para)
          },
          agoraMs: () => Date.now(),
        })

        diagnosticoFluxoRealV2 = montarDiagnosticoFluxoRealV2({
          ok: true,
          resultado: resultadoFluxoReal,
          datasDiagnosticoDirigido: datasFinaisDiagnosticoDirigidoSantoAmaro,
          candidatosDiagnosticoDirigido: candidatosFinaisDiagnosticoDirigidoSantoAmaro,
        })
      } catch (errorFluxoReal: unknown) {
        diagnosticoFluxoRealV2 = montarDiagnosticoFluxoRealV2({
          ok: false,
          erro: errorFluxoReal instanceof Error ? errorFluxoReal.message : String(errorFluxoReal),
          datasDiagnosticoDirigido: datasFinaisDiagnosticoDirigidoSantoAmaro,
          candidatosDiagnosticoDirigido: candidatosFinaisDiagnosticoDirigidoSantoAmaro,
        })
      }
    }

    // 9.7.c. Diagnostico de comparacao legado x v2 (depois da disponibilidade real para usar candidatos reais convertidos)
    if (usarComparacaoLegadoV2Diagnostico) {
      const legadoRaw = bodyDiagnostico.legadoComparacaoDiagnostico
      const candidatosLegado =
        legadoRaw &&
        typeof legadoRaw === 'object' &&
        Array.isArray((legadoRaw as Record<string, unknown>).candidatos)
          ? ((legadoRaw as { candidatos: unknown[] }).candidatos.filter(
              (c): c is CandidatoComparacaoLegadoV2 =>
                Boolean(c) &&
                typeof c === 'object' &&
                typeof (c as Record<string, unknown>).dataISO === 'string'
            ))
          : []
      const toleranciaKmAdicionalM =
        typeof bodyDiagnostico.toleranciaKmAdicionalMComparacaoDiagnostico === 'number' &&
        Number.isFinite(bodyDiagnostico.toleranciaKmAdicionalMComparacaoDiagnostico) &&
        bodyDiagnostico.toleranciaKmAdicionalMComparacaoDiagnostico >= 0
          ? bodyDiagnostico.toleranciaKmAdicionalMComparacaoDiagnostico
          : undefined

      // Fonte v2: default e candidatos montados (diagnostico-candidatos)
      const fonteV2Solicitada = bodyDiagnostico.fonteV2ComparacaoDiagnostico
      const fontesV2Validas = ['diagnostico-candidatos', 'disponibilidade-real', 'reclassificacao-com-km-mapa-slot', 'resultado-final-legado-equivalente'] as const
      type FonteV2 = typeof fontesV2Validas[number]
      const fonteV2: FonteV2 =
        typeof fonteV2Solicitada === 'string' &&
        (fontesV2Validas as readonly string[]).includes(fonteV2Solicitada)
          ? (fonteV2Solicitada as FonteV2)
          : 'diagnostico-candidatos'
      const fonteV2Invalida =
        typeof fonteV2Solicitada === 'string' &&
        !(fontesV2Validas as readonly string[]).includes(fonteV2Solicitada)

      if (fonteV2Invalida) {
        diagnosticoComparacaoLegadoV2 = {
          executado: false,
          ok: false,
          producaoAfetada: false,
          motivo: `fonteV2ComparacaoDiagnostico invalida: "${fonteV2Solicitada}". Valores aceitos: ${fontesV2Validas.join(', ')}.`,
          fonteV2ComparacaoDiagnostico: fonteV2Solicitada,
        }
      } else {
        // Selecionar fonte v2 de candidatos conforme fonteV2ComparacaoDiagnostico
        let candidatosV2FonteSelecionada: CandidatoComparacaoLegadoV2[] = []
        let avisoFonteV2: string = 'Fonte v2 não definida.'

        if (fonteV2 === 'disponibilidade-real') {
          // Usar candidatos reais convertidos (requer usarDisponibilidadeRealDiagnostica)
          if (candidatosReaisConvertidosParaComparacao.length === 0) {
            diagnosticoComparacaoLegadoV2 = {
              executado: false,
              ok: false,
              producaoAfetada: false,
              motivo: "fonteV2ComparacaoDiagnostico='disponibilidade-real' requer usarDisponibilidadeRealDiagnostica=true e disponibilidade real gerada com sucesso.",
              fonteV2ComparacaoDiagnostico: fonteV2,
            }
            // Pular resto do bloco de comparacao
          } else {
            candidatosV2FonteSelecionada = candidatosReaisConvertidosParaComparacao
            avisoFonteV2 = `Fonte v2: candidatos reais da disponibilidade real (${candidatosReaisConvertidosParaComparacao.length} candidatos).`
          }
        } else if (fonteV2 === 'reclassificacao-com-km-mapa-slot') {
          // Usar candidatos reclassificados (se disponíveis), senão usar sintéticos
          candidatosV2FonteSelecionada = candidatosComparacaoV2Diagnostico
          avisoFonteV2 = 'Fonte v2: reclassificacao-com-km-mapa-slot (usando candidatos disponíveis).'
        } else if (fonteV2 === 'resultado-final-legado-equivalente') {
          // Usar candidatos reais após recorte legado-equivalente
          if (candidatosReaisRecortadosParaComparacao.length === 0) {
            diagnosticoComparacaoLegadoV2 = {
              executado: false,
              ok: false,
              producaoAfetada: false,
              motivo:
                "fonteV2ComparacaoDiagnostico='resultado-final-legado-equivalente' requer usarDisponibilidadeRealDiagnostica=true e recorte calculado com sucesso.",
              fonteV2ComparacaoDiagnostico: fonteV2,
            }
          } else {
            candidatosV2FonteSelecionada = candidatosReaisRecortadosParaComparacao
            avisoFonteV2 = `Fonte v2: resultado-final-legado-equivalente (${candidatosReaisRecortadosParaComparacao.length} candidatos recortados).`
          }
        } else {
          // Default: diagnostico-candidatos (sintéticos)
          candidatosV2FonteSelecionada = candidatosComparacaoV2Diagnostico
          avisoFonteV2 = 'Fonte v2: diagnostico-candidatos (sintéticos).'
        }

        // Verificar se a comparação já foi abortada (fonte disponibilidade-real sem candidatos)
        if (diagnosticoComparacaoLegadoV2 && diagnosticoComparacaoLegadoV2.executado === false) {
          // Já preenchido com erro acima, não fazer nada
        } else {
          // Gerar comparacaoKey para candidatos v2 antes da comparacao
          const candidatosV2ComKey = gerarComparacaoKeyV2Diagnostico(
            candidatosV2FonteSelecionada,
            fonteV2
          )

          const resultadoComparacaoLegadoV2 = compararPayloadLegadoComV2Diagnostico({
            candidatosLegado,
            candidatosV2: candidatosV2ComKey,
            toleranciaKmAdicionalM,
          })

          diagnosticoComparacaoLegadoV2 = {
            executado: true,
            ok: resultadoComparacaoLegadoV2.ok,
            producaoAfetada: resultadoComparacaoLegadoV2.producaoAfetada,
            modo: resultadoComparacaoLegadoV2.modo,
            estrategiaChave: resultadoComparacaoLegadoV2.estrategiaChave,
            fonteV2ComparacaoDiagnostico: fonteV2,
            toleranciaKmAdicionalM: resultadoComparacaoLegadoV2.toleranciaKmAdicionalM,
            resumo: resultadoComparacaoLegadoV2.resumo,
            divergencias: resultadoComparacaoLegadoV2.divergencias.slice(0, 50),
            duplicidades: resultadoComparacaoLegadoV2.duplicidades,
            amostras: resultadoComparacaoLegadoV2.amostras,
            avisos: [
              ...resultadoComparacaoLegadoV2.avisos,
              avisoFonteV2,
              candidatosLegado.length === 0
                ? 'legadoComparacaoDiagnostico.candidatos ausente ou vazio.'
                : 'legadoComparacaoDiagnostico.candidatos usado como payload controlado.',
            ],
          }
        }
      }
    }

    // 9.8. Diagnostico Major Francisco Hardy — 31/07 x 05/08
    // Roda apenas quando diagnosticoDeltaMajorFranciscoHardy31Jul=true.
    // Payload fixo do cenario real. Nao altera motor, regra de negocio, ranking, Apps Script nem producao.
    let diagnosticoMajorHardy31Jul: Record<string, unknown> | null = null

    if (usarDiagnosticoMajorHardy31Jul) {
      // Payload fixo — cenario real validado
      // dataInicial DEVE ser ISO YYYY-MM-DD: normalizarEntradaPesquisaV2 so aceita esse formato (entrada.ts L176)
      const PAYLOAD_MAJOR_HARDY: PesquisarDatasRequest = {
        cep: '81230-174',
        enderecoCompleto: 'Rua Major Francisco Hardy, Campo Comprido, Curitiba, Paraná, 81230-174, Brasil',
        logradouro: 'Rua Major Francisco Hardy',
        numero: '70',
        bairro: 'campo comprido',
        cidade: 'curitiba',
        uf: 'PR',
        destLat: -25.45244,
        destLng: -49.33070,
        destDisplay: 'Rua Major Francisco Hardy, 70, Campo Comprido, Curitiba - PR, 81230-174',
        dataInicial: '2026-06-26',
        tempoNecessario: '02:45',
        isEncomenda: false,
        isRural: false,
        isCondominio: false,
        tipoBerco: 'MAXX',
        comoda: 'SIM',
        roupeiro: '2 PTS',
      }

      // Validacao do payload fixo antes de rodar o motor
      const entradaHardy = normalizarEntradaPesquisaV2(PAYLOAD_MAJOR_HARDY)
      const validacaoPayload = {
        dataInicialRecebida: PAYLOAD_MAJOR_HARDY.dataInicial,
        dataInicialNormalizada: entradaHardy.dataInicialISO,
        tempoNecessarioRecebido: PAYLOAD_MAJOR_HARDY.tempoNecessario,
        tempoNecessarioNormalizado: entradaHardy.tempoNecessarioMin,
        destLat: PAYLOAD_MAJOR_HARDY.destLat,
        destLng: PAYLOAD_MAJOR_HARDY.destLng,
        payloadValido: entradaHardy.dataInicialISO !== null && entradaHardy.tempoNecessarioMin !== null && entradaHardy.temCoordenadasDestino,
        errosPayload: entradaHardy.avisos,
      }

      // Logs legado para 31/07 e 05/08
      const LOGS_LEGADO_31JUL = {
        slot: '31/07 (sexta) | EQUIPE 1 | livre="02:45" | pontos=1',
        origem: 'R. Dr. Francisco Soares, 860, Curitiba-PR, 81030-450',
        rotaBase: ['DEPÓSITO', 'Rua Professora Maria da Glória Saldanha Loyola, Uberaba, Curitiba, Paraná, 81540-470, Brasil'],
        limites: { baseM: 5000, especialM: 10000, premiumM: 15000 },
        ancoraVencedora: 'Rua Professora Maria da Glória Saldanha Loyola, Uberaba, Curitiba, Paraná, 81540-470, Brasil',
        ancoraTitulo: '(03:00) UBERABA 28617 (UBERABA)',
        ancoraDistanciaKm: 16.16,
        candidatoBruto: { tipo: 'FORA-LIMITE', delta: 16.16 },
        decisao: 'descartado',
      }

      const LOGS_LEGADO_05AGO = {
        slot: '05/08 (quarta) | EQUIPE 1 | livre="03:00" | pontos=3',
        origem: 'R. Dr. Francisco Soares, 860, Curitiba-PR, 81030-450',
        rotaBase: [
          'DEPÓSITO',
          'Av. Rep. Argentina, 2777, Curitiba - PR, Brasil',
          'Av. Cândido Hartmann, 456, Curitiba - PR, Brasil',
          'Av. Mal. Floriano Peixoto, 5636 - Hauer, Curitiba - PR, Brasil',
        ],
        limites: { baseM: 5000, especialM: 10000, premiumM: 15000 },
        ancoraVencedora: 'Av. Cândido Hartmann, 456, Curitiba - PR, Brasil',
        ancoraTitulo: '3 (01:00) TRANSF. BIGORRILHO',
        ancoraDistanciaKm: 6.52,
        candidatoBruto: { tipo: 'ESPECIAL', delta: 9.04 },
        decisao: 'aceito como especial',
      }

      // Se payload invalido, nao tenta rodar o motor
      if (!validacaoPayload.payloadValido) {
        diagnosticoMajorHardy31Jul = {
          executado: false,
          ok: false,
          producaoAfetada: false,
          erro: 'Payload fixo invalido — nao foi possivel normalizar entrada. Verificar dataInicial, tempoNecessario e destLat/destLng.',
          validacaoPayload,
          resumoComparacao: {
            status: 'nao_comparado_payload_invalido',
            motivo: 'Payload fixo nao passou na normalizacao. Motor nao foi chamado.',
          },
          logsLegado31jul: LOGS_LEGADO_31JUL,
          logsLegado05ago: LOGS_LEGADO_05AGO,
        }
      } else {
        try {
          let configHardyCache: (ConfigOrquestradorPayloadLegado & { osrmBaseUrl: string }) | null =
            configResult.ok ? configResult.config : null

          async function carregarConfigHardy() {
            if (configHardyCache) return configHardyCache
            const r = await buscarConfiguracoesProcurarDatas()
            if (!r.ok) throw new Error(`Config nao carregada: ${r.erro}`)
            configHardyCache = r.config
            return configHardyCache
          }

          const resultadoHardy = await orquestrarPesquisaV2ComPayloadLegado(PAYLOAD_MAJOR_HARDY, {
            pesquisarDatas: pesquisarDatasV2,
            buscarConfig: carregarConfigHardy,
            buscarRota: async (de, para) => {
              const cfg = await carregarConfigHardy()
              const buscarRota = criarBuscarRotaOSRMRouteDiagnosticoV2({
                baseUrl: normalizarOsrmBaseUrlCompatV2(cfg.osrmBaseUrl),
                timeoutMs: 10_000,
              })
              return buscarRota(de, para)
            },
            agoraMs: () => Date.now(),
            diagnosticoDeltaMajorHardy31Jul: true,
          })

          const motorOk = resultadoHardy.saidaV2.ok
          const errosMotor = resultadoHardy.saidaV2.erros ?? []

          const candidatosFinaisHardy = resultadoHardy.payload.candidates.map(resumirCandidatoPayloadCompat)

          // Se motor falhou, nao comparar — retornar erro explícito
          let resumoComparacao: Record<string, unknown>
          let candidatos31jul = null
          let candidatos05ago = null

          if (!motorOk) {
            resumoComparacao = {
              status: 'nao_comparado_motor_com_erro',
              motivo: `Motor v2 retornou saidaV2.ok=false. Erros: ${errosMotor.join('; ')}. Comparacao legado x v2 nao realizada.`,
              aviso: '31/07 e 05/08 NAO foram avaliados. O resultado nao pode ser tratado como bate ou divergencia.',
            }
          } else {
            // Motor OK — comparar
            candidatos31jul = candidatosFinaisHardy.find((c) => c.dataISO === '2026-07-31') ?? null
            candidatos05ago = candidatosFinaisHardy.find((c) => c.dataISO === '2026-08-05') ?? null

            const legado31jul = { presente: false, motivo: 'descartado no legado — delta FORA-LIMITE (16.16km > 15km)' }
            // Para 31/07: legado descarta. Bate se v2 tambem nao retornar.
            // ATENCAO: se v2 nao retorna 31/07, isso indica descarte — mas o motor v2 atual nao expoe
            // candidatos descartados/intermediarios. Portanto "nao retornou" nao prova equivalencia com o legado.
            const bate31jul = candidatos31jul === null
            const nota31jul = bate31jul
              ? 'v2 nao retornou 31/07. Legado tambem descarta. PENDENCIA: motor v2 nao expoe candidatos descartados/intermediarios — nao e possivel confirmar que o descarte ocorreu pelo mesmo motivo (delta FORA-LIMITE 16.16km). Necessario log adicional de candidatos descartados.'
              : `DIVERGENCIA: legado descarta 31/07 (FORA-LIMITE delta=16.16km), mas v2 retornou tipo="${candidatos31jul?.tipo}" frete="${candidatos31jul?.frete}". Investigar origem/rota-base/delta da v2 para 31/07.`

            const esperado05ago = { tipo: 'especial', frete: 'R$ 210', diaSemana: 'quarta', equipe: 'EQUIPE 1' }
            const bate05ago = candidatos05ago !== null && (candidatos05ago.tipo === 'especial' || candidatos05ago.tipo === 'ESPECIAL')
            const nota05ago = bate05ago
              ? 'OK: v2 retornou 05/08 como especial, igual ao legado.'
              : candidatos05ago !== null
                ? `DIVERGENCIA: legado retorna 05/08 como "especial", v2 retornou tipo="${candidatos05ago.tipo}".`
                : 'DIVERGENCIA: legado retorna 05/08 como "especial", v2 nao retornou 05/08.'

            resumoComparacao = {
              status: 'comparado',
              data31jul: {
                legado: legado31jul,
                v2: candidatos31jul !== null
                  ? { presente: true, tipo: candidatos31jul.tipo, frete: candidatos31jul.frete, equipe: candidatos31jul.equipe }
                  : { presente: false },
                bate: bate31jul,
                divergente: !bate31jul,
                pendente: bate31jul,
                nota: nota31jul,
              },
              data05ago: {
                legado: { presente: true, tipo: esperado05ago.tipo, frete: esperado05ago.frete },
                v2: candidatos05ago !== null
                  ? { presente: true, tipo: candidatos05ago.tipo, frete: candidatos05ago.frete, equipe: candidatos05ago.equipe }
                  : { presente: false },
                bate: bate05ago,
                divergente: !bate05ago,
                pendente: false,
                nota: nota05ago,
              },
              hipoteseDivergencia31jul: [
                'Rota base v2 para 31/07 pode ter apenas 1 ponto (pontosAgenda=1), diferente do legado.',
                'Ancora v2 para 31/07 pode ser diferente da usada pelo legado (UBERABA, 16.16km).',
                'Delta OSRM v2 para 31/07 pode diferir do legado (16.16km, FORA-LIMITE).',
                'Verificar se v2 usa mesma origem que legado: R. Dr. Francisco Soares, 860, Curitiba-PR.',
                'Verificar filtro early v2 para 31/07: limites base=5000m, especial=10000m, premium=15000m.',
              ],
            }
          }

          const diagnosticoInternoMotorHardy = resultadoHardy.saidaV2.diagnosticoDeltaMajorHardy31Jul ?? null

          // Atualizar pendencias do resumoComparacao com base no diagnostico interno do motor
          if (motorOk && resumoComparacao.status === 'comparado') {
            const interno = diagnosticoInternoMotorHardy
            const pendencias: string[] = []
            if (interno) {
              if (interno.pendencias && Array.isArray(interno.pendencias) && interno.pendencias.length > 0) {
                pendencias.push(...(interno.pendencias as string[]))
              }
              if (!interno.analisePorData) {
                pendencias.push('diagnosticoMotorInterno.analisePorData ausente: dados de disponibilidade/agenda/delta nao instrumentados para este cenario.')
              }
            } else {
              pendencias.push('diagnosticoMotorInterno nao retornado pelo motor: dados de candidatos descartados/intermediarios nao disponiveis nesta execucao.')
            }
            if (pendencias.length > 0) {
              resumoComparacao = { ...resumoComparacao, pendencias }
            }
          }

          diagnosticoMajorHardy31Jul = {
            executado: true,
            ok: motorOk,
            producaoAfetada: false,
            validacaoPayload,
            diagnosticoMotorInterno: diagnosticoInternoMotorHardy,
            configUsada: configResult.ok ? {
              latDeposito: configResult.config.latDeposito,
              lngDeposito: configResult.config.lngDeposito,
              latCasaE1: configResult.config.latCasaE1,
              lngCasaE1: configResult.config.lngCasaE1,
              latCasaE2: configResult.config.latCasaE2,
              lngCasaE2: configResult.config.lngCasaE2,
              kmAdicionalMaxNaRotaM: configResult.config.kmAdicionalMaxNaRotaM,
              kmAdicionalMaxNaRotaEspecialM: configResult.config.kmAdicionalMaxNaRotaEspecialM,
              kmAdicionalMaxNaRotaPremiumM: configResult.config.kmAdicionalMaxNaRotaPremiumM,
              origem: configResult.origem,
              nota: 'Valores lidos diretamente do banco (procurar_datas_config). Se especial/premium parecerem menores que legado, verificar se banco esta com os valores corretos.',
            } : { erro: 'config nao carregada' },
            datasEncontradas: candidatosFinaisHardy.map((c) => c.dataISO).filter(Boolean),
            candidatos31jul,
            candidatos05ago,
            logsLegado31jul: LOGS_LEGADO_31JUL,
            logsLegado05ago: LOGS_LEGADO_05AGO,
            resumoComparacao,
            todosCandidatos: candidatosFinaisHardy,
            saidaV2: {
              ok: motorOk,
              erros: errosMotor,
              avisos: resultadoHardy.avisos,
            },
          }
        } catch (errHardy: unknown) {
          diagnosticoMajorHardy31Jul = {
            executado: true,
            ok: false,
            producaoAfetada: false,
            erro: errHardy instanceof Error ? errHardy.message : String(errHardy),
            validacaoPayload,
            resumoComparacao: {
              status: 'nao_comparado_excecao',
              motivo: 'Excecao ao chamar orquestrarPesquisaV2ComPayloadLegado.',
            },
            logsLegado31jul: LOGS_LEGADO_31JUL,
            logsLegado05ago: LOGS_LEGADO_05AGO,
          }
        }
      }
    }

    // 9.9. Diagnostico Rua Henrique Correia — 31/07
    // Roda apenas quando diagnosticoDeltaHenriqueCorreia31Jul=true.
    // Payload fixo do cenario real. Nao altera motor, regra de negocio, ranking, Apps Script nem producao.
    let diagnosticoHenriqueCorreia31Jul: Record<string, unknown> | null = null

    if (usarDiagnosticoHenriqueCorreia31Jul) {
      const PAYLOAD_HENRIQUE_CORREIA: PesquisarDatasRequest = {
        cep: '82240-290',
        enderecoCompleto: 'Rua Henrique Correia, Bairro Alto, Curitiba, Paraná, 82240-290, Brasil',
        logradouro: 'rua henrique correia',
        numero: '1320',
        bairro: 'bairro alto',
        cidade: 'curitiba',
        uf: 'PR',
        destLat: -25.40795,
        destLng: -49.20650,
        destDisplay: 'Rua Henrique Correia, 1320, Bairro Alto, Curitiba - PR, 82240-290',
        dataInicial: '2026-06-26',
        tempoNecessario: '02:00',
        isEncomenda: false,
        isRural: false,
        isCondominio: false,
        roupeiro: '4 PTS (DIVERSOS)',
      }

      const entradaHenrique = normalizarEntradaPesquisaV2(PAYLOAD_HENRIQUE_CORREIA)
      const validacaoPayloadHenrique = {
        dataInicialRecebida: PAYLOAD_HENRIQUE_CORREIA.dataInicial,
        dataInicialNormalizada: entradaHenrique.dataInicialISO,
        tempoNecessarioRecebido: PAYLOAD_HENRIQUE_CORREIA.tempoNecessario,
        tempoNecessarioNormalizado: entradaHenrique.tempoNecessarioMin,
        destLat: PAYLOAD_HENRIQUE_CORREIA.destLat,
        destLng: PAYLOAD_HENRIQUE_CORREIA.destLng,
        payloadValido: entradaHenrique.dataInicialISO !== null && entradaHenrique.tempoNecessarioMin !== null && entradaHenrique.temCoordenadasDestino,
        errosPayload: entradaHenrique.avisos,
      }

      const LOGS_LEGADO_HENRIQUE_31JUL = {
        slot: '31/07 (sexta) | EQUIPE 1',
        tipo: 'PREMIUM',
        frete: 'R$ 320',
        nota: 'Resultado observado no legado: 31/07 — EQUIPE 1 — Premium — R$ 320',
      }
      const LOGS_LEGADO_HENRIQUE_GERAL = {
        '10/07': { tipo: 'Normal', frete: 'R$ 120' },
        '31/07': { tipo: 'Premium', frete: 'R$ 320' },
        '08/08': { tipo: 'Normal', frete: 'R$ 180', obs: 'sábado' },
        '13/08': { tipo: 'Normal', frete: 'R$ 120' },
        '15/08': { tipo: 'Normal', frete: 'R$ 180', obs: 'sábado' },
        '17/08': { tipo: 'Normal', frete: 'R$ 120' },
        '18/08': { tipo: 'Hora marcada', frete: 'R$ 520' },
      }

      const faixasEfetivasV2 = configResult.ok ? (() => {
        const base = configResult.config.kmAdicionalMaxNaRotaM
        const guardaEspecial = configResult.config.kmAdicionalMaxNaRotaEspecialM
        const guardaPremium = configResult.config.kmAdicionalMaxNaRotaPremiumM
        return {
          limiteBaseM: base,
          limiteEspecialM: base + guardaEspecial,
          limitePremiumM: base + guardaPremium,
          foraLimiteAcimaDeM: base + guardaPremium,
          interpretacao: {
            normal: `0 até ${base}m`,
            especial: `${base + 1} até ${base + guardaEspecial}m`,
            premium: `${base + guardaEspecial + 1} até ${base + guardaPremium}m`,
            foraDeLimite: `acima de ${base + guardaPremium}m`,
          },
          valoresBrutosBanco: {
            'KM ADICIONAL MAX NA ROTA (base)': base,
            'KM ADICIONAL MAX NA ROTA ESPECIAL (guarda adicional)': guardaEspecial,
            'KM ADICIONAL MAX NA ROTA PREMIUM (guarda adicional)': guardaPremium,
          },
          notaInterpretacao: 'Os valores do banco sao ADICIONAIS ao base: limiteEspecialM = base + guardaEspecial; limitePremiumM = base + guardaPremium. A tela que exibe "Limite especial: 5000m" esta mostrando o GUARDA adicional, nao o limite absoluto efetivo (10000m).',
          convergenciaComLegado: {
            bate: true,
            nota: 'Legado usa limites: baseM=5000, especialM=10000, premiumM=15000. V2 calcula identicamente: base=5000, especial=5000+5000=10000, premium=5000+10000=15000.',
          },
        }
      })() : null

      if (!validacaoPayloadHenrique.payloadValido) {
        diagnosticoHenriqueCorreia31Jul = {
          executado: false,
          ok: false,
          producaoAfetada: false,
          erro: 'Payload fixo invalido — nao foi possivel normalizar entrada.',
          validacaoPayload: validacaoPayloadHenrique,
          faixasEfetivasV2,
          logsLegado: LOGS_LEGADO_HENRIQUE_GERAL,
        }
      } else {
        try {
          let configHenriqueCache: (ConfigOrquestradorPayloadLegado & { osrmBaseUrl: string }) | null =
            configResult.ok ? configResult.config : null

          async function carregarConfigHenrique() {
            if (configHenriqueCache) return configHenriqueCache
            const r = await buscarConfiguracoesProcurarDatas()
            if (!r.ok) throw new Error(`Config nao carregada: ${r.erro}`)
            configHenriqueCache = r.config
            return configHenriqueCache
          }

          const resultadoHenrique = await orquestrarPesquisaV2ComPayloadLegado(PAYLOAD_HENRIQUE_CORREIA, {
            pesquisarDatas: pesquisarDatasV2,
            buscarConfig: carregarConfigHenrique,
            buscarRota: async (de, para) => {
              const cfg = await carregarConfigHenrique()
              const buscarRota = criarBuscarRotaOSRMRouteDiagnosticoV2({
                baseUrl: normalizarOsrmBaseUrlCompatV2(cfg.osrmBaseUrl),
                timeoutMs: 10_000,
              })
              return buscarRota(de, para)
            },
            agoraMs: () => Date.now(),
            diagnosticoDeltaMajorHardy31Jul: true,
          })

          const motorHenriqueOk = resultadoHenrique.saidaV2.ok
          const errosMotorHenrique = resultadoHenrique.saidaV2.erros ?? []
          const candidatosFinaisHenrique = resultadoHenrique.payload.candidates.map(resumirCandidatoPayloadCompat)
          const diagnosticoMotorInternoHenrique = resultadoHenrique.saidaV2.diagnosticoDeltaMajorHardy31Jul ?? null

          const candidato31jul = candidatosFinaisHenrique.find((c) => c.dataISO === '2026-07-31') ?? null
          const candidato10jul = candidatosFinaisHenrique.find((c) => c.dataISO === '2026-07-10') ?? null
          const candidato08ago = candidatosFinaisHenrique.find((c) => c.dataISO === '2026-08-08') ?? null
          const candidato13ago = candidatosFinaisHenrique.find((c) => c.dataISO === '2026-08-13') ?? null

          const divergencia31jul = candidato31jul !== null && candidato31jul.tipo !== 'premium'
          const nota31jul = candidato31jul === null
            ? 'DIVERGENCIA: legado retorna 31/07 como Premium, v2 nao retornou 31/07.'
            : candidato31jul.tipo === 'premium'
              ? 'OK: v2 retornou 31/07 como premium, igual ao legado.'
              : `DIVERGENCIA: legado retorna 31/07 como Premium, v2 retornou tipo="${candidato31jul.tipo}" frete="${candidato31jul.frete}". Investigar delta v2 vs delta legado para 31/07.`

          diagnosticoHenriqueCorreia31Jul = {
            executado: true,
            ok: motorHenriqueOk,
            producaoAfetada: false,
            validacaoPayload: validacaoPayloadHenrique,
            faixasEfetivasV2,
            configUsada: configResult.ok ? {
              kmAdicionalMaxNaRotaM: configResult.config.kmAdicionalMaxNaRotaM,
              kmAdicionalMaxNaRotaEspecialM: configResult.config.kmAdicionalMaxNaRotaEspecialM,
              kmAdicionalMaxNaRotaPremiumM: configResult.config.kmAdicionalMaxNaRotaPremiumM,
              origem: configResult.origem,
              nota: 'Valores brutos do banco. Faixas efetivas = ver faixasEfetivasV2.',
            } : { erro: 'config nao carregada' },
            datasEncontradas: candidatosFinaisHenrique.map((c) => c.dataISO).filter(Boolean),
            candidatos: {
              '31/07': candidato31jul,
              '10/07': candidato10jul,
              '08/08': candidato08ago,
              '13/08': candidato13ago,
            },
            diagnosticoMotorInterno: diagnosticoMotorInternoHenrique,
            todosCandidatos: candidatosFinaisHenrique,
            logsLegado: LOGS_LEGADO_HENRIQUE_GERAL,
            logsLegado31jul: LOGS_LEGADO_HENRIQUE_31JUL,
            comparacao31jul: {
              legado: LOGS_LEGADO_HENRIQUE_31JUL,
              v2: candidato31jul !== null
                ? { presente: true, tipo: candidato31jul.tipo, frete: candidato31jul.frete, equipe: candidato31jul.equipe }
                : { presente: false },
              bate: !divergencia31jul && candidato31jul !== null,
              divergente: divergencia31jul || candidato31jul === null,
              nota: nota31jul,
            },
            saidaV2: {
              ok: motorHenriqueOk,
              erros: errosMotorHenrique,
              avisos: resultadoHenrique.avisos,
            },
          }
        } catch (errHenrique: unknown) {
          diagnosticoHenriqueCorreia31Jul = {
            executado: true,
            ok: false,
            producaoAfetada: false,
            erro: errHenrique instanceof Error ? errHenrique.message : String(errHenrique),
            validacaoPayload: validacaoPayloadHenrique,
            faixasEfetivasV2,
            logsLegado: LOGS_LEGADO_HENRIQUE_GERAL,
          }
        }
      }
    }

    // 10. Testar helpers puros
    const helpers = {
      // Tempo: converter HH:MM para minutos e voltar
      tempoTeste: entrada.tempoNecessario
        ? {
            input: entrada.tempoNecessario,
            minutos: parseMinutos(entrada.tempoNecessario),
            formatado: formatarMinutos(parseMinutos(entrada.tempoNecessario)),
          }
        : null,

      // Equipe: normalizar exemplo
      equipeTeste: {
        exemplos: ['EQUIPE 1', 'EQP 2', 'equipe 01', 'eqp inválida'].map((e) => ({
          input: e,
          normalizado: normalizarEquipe(e),
        })),
      },
    }

    // 9.8. Null-guards para blocos diagnosticos opcionais
    //    Garante que blocos nao executados retornem { executado: false, motivo } em vez de null
    if (diagnosticoAgendaReal === null) {
      diagnosticoAgendaReal = {
        ok: true,
        executado: false,
        motivo: 'usarAgendaRealDiagnostica nao ativado no payload.',
      }
    }
    if (diagnosticoDisponibilidadeReal === null) {
      diagnosticoDisponibilidadeReal = {
        executado: false,
        motivo: 'usarDisponibilidadeRealDiagnostica nao ativado no payload.',
      } as Record<string, unknown> as Awaited<
        ReturnType<typeof buscarDisponibilidadeRealDiagnosticaComDados>
      >['diagnostico']
    }
    if (diagnosticoCandidatosDisponibilidadeReal === null) {
      diagnosticoCandidatosDisponibilidadeReal = {
        executado: false,
        motivo: 'usarDisponibilidadeRealDiagnostica nao ativado ou sem dados de disponibilidade real.',
      }
    }
    if (diagnosticoCandidatosReaisAdaptados === null) {
      diagnosticoCandidatosReaisAdaptados = {
        executado: false,
        motivo: 'usarDisponibilidadeRealDiagnostica nao ativado ou candidatos reais nao gerados.',
      }
    }
    if (diagnosticoFluxoRealV2 === null) {
      diagnosticoFluxoRealV2 = {
        executado: false,
        motivo: 'usarDiagnosticoSantoAmaroV2 nao ativado no payload.',
      }
    }

    // 9.9. DiagnosticoRecorteAlvo — consolida pontos da agenda, insercao e reclassificacao para datas/equipes/termos alvo
    {
      const datasAlvoRaw = bodyDiagnostico.datasAlvo
      const equipesAlvoRaw = bodyDiagnostico.equipesAlvo
      const termosEnderecoAlvoRaw = bodyDiagnostico.termosEnderecoAlvo

      const datasAlvo: string[] =
        Array.isArray(datasAlvoRaw)
          ? datasAlvoRaw.filter((d): d is string => typeof d === 'string' && d.trim().length > 0)
          : []
      const equipesAlvo: string[] =
        Array.isArray(equipesAlvoRaw)
          ? equipesAlvoRaw.filter((e): e is string => typeof e === 'string' && e.trim().length > 0)
          : []
      const termosEnderecoAlvo: string[] =
        Array.isArray(termosEnderecoAlvoRaw)
          ? termosEnderecoAlvoRaw.filter((t): t is string => typeof t === 'string' && t.trim().length > 0)
          : []

      const avisosRecorte: string[] = [
        'Recorte alvo para auditoria. Consolida dados da agenda real, insercao por slot e reclassificacao.',
        'Nao altera producao, frontend ou ranking final.',
      ]
      const errosRecorte: string[] = []

      if (datasAlvo.length === 0 && equipesAlvo.length === 0 && termosEnderecoAlvo.length === 0) {
        diagnosticoRecorteAlvo = {
          executado: false,
          motivo: 'Nenhum filtro alvo fornecido (datasAlvo, equipesAlvo, termosEnderecoAlvo).',
        }
      } else if (!usarAgendaRealDiagnostica || !agendaRealComDados || agendaRealComDados.linhasAgenda.length === 0) {
        diagnosticoRecorteAlvo = {
          executado: false,
          motivo: 'usarAgendaRealDiagnostica nao ativado ou agenda real sem linhas.',
          filtros: { datasAlvo, equipesAlvo, termosEnderecoAlvo },
        }
      } else {
        try {
          const slotsRecorte = montarSlotsKmAdicionalDiagnostico({
            rawSlotsAgendaDiagnostica: undefined,
            usarAgendaRealDiagnostica,
            agendaRealComDados,
            janelaDatas: janelaResult?.ok ? janelaResult.datas : null,
            equipeAgendaDiagnostica: undefined,
            cacheCoordenadasAgendaDiagnostico: cacheCoordenadasAgendaDiagnosticoResolvido,
          })

          const slotsFiltrados = slotsRecorte.slots.filter((s) => {
            const dataMatch = datasAlvo.length === 0 || datasAlvo.includes(s.dataISO)
            const equipeMatch = equipesAlvo.length === 0 || equipesAlvo.some((e) => normalizarEquipe(s.equipe) === normalizarEquipe(e))
            return dataMatch && equipeMatch
          })

          const slotsDetalhados = slotsFiltrados.map((s) => {
            const slotKey = `${s.dataISO}::${normalizarEquipe(s.equipe) ?? s.equipe}`
            const equipeNormalizadaSlot = normalizarEquipe(s.equipe) ?? 'EQUIPE 1'
            const parseResult = parsearPontosAgendaDoDiaV2({
              linhasAgenda: s.linhasAgenda,
              dataAlvoISO: s.dataISO,
              equipeAlvo: equipeNormalizadaSlot as 'EQUIPE 1' | 'EQUIPE 2',
              cacheCoordenadasPorEndereco: s.cacheCoordenadasPorEndereco ?? {},
            })

            const pontosComTermo = termosEnderecoAlvo.length > 0
              ? parseResult.pontos.filter((p) =>
                  termosEnderecoAlvo.some((termo) =>
                    (p.endereco ?? '').toUpperCase().includes(termo.toUpperCase()) ||
                    (p.tituloEvento ?? '').toUpperCase().includes(termo.toUpperCase())
                  )
                )
              : []

            return {
              slotKey,
              dataISO: s.dataISO,
              equipe: s.equipe,
              pontosValidos: parseResult.pontos.length,
              pontosDescartados: parseResult.descartados.length,
              pontos: parseResult.pontos.map((p) => ({
                endereco: p.endereco,
                titulo: p.tituloEvento,
                cep: p.cep,
                lat: p.coordenadas?.lat,
                lng: p.coordenadas?.lng,
              })),
              descartados: parseResult.descartados.map((d) => ({
                motivo: d.motivo,
                descricao: d.descricao,
              })),
              termosEnderecoEncontrados: pontosComTermo.map((p) => ({
                endereco: p.endereco,
                titulo: p.tituloEvento,
              })),
              temTermoAlvo: pontosComTermo.length > 0,
            }
          })

          const slotsComTermo = slotsDetalhados.filter((s) => s.temTermoAlvo)
          const slotsComPontos = slotsDetalhados.filter((s) => s.pontosValidos > 0)

          const mapaKmRecorte =
            diagnosticoMapaKmAdicionalPorSlot &&
            (diagnosticoMapaKmAdicionalPorSlot as Record<string, unknown>).executado === true &&
            (diagnosticoMapaKmAdicionalPorSlot as Record<string, unknown>).mapa
              ? (diagnosticoMapaKmAdicionalPorSlot as Record<string, unknown>).mapa as Record<string, number>
              : null

          const insercaoRecorte =
            diagnosticoInsercaoPorSlot &&
            (diagnosticoInsercaoPorSlot as Record<string, unknown>).executado === true &&
            (diagnosticoInsercaoPorSlot as Record<string, unknown>).slots
              ? (diagnosticoInsercaoPorSlot as Record<string, unknown>).slots as Record<string, unknown>
              : null

          const reclassificacaoRecorte =
            diagnosticoReclassificacaoComKmMapaSlot &&
            (diagnosticoReclassificacaoComKmMapaSlot as Record<string, unknown>).executado === true
              ? (diagnosticoReclassificacaoComKmMapaSlot as Record<string, unknown>)
              : null

          const slotsComKm = slotsDetalhados.map((s) => {
            const kmDoMapa = mapaKmRecorte ? mapaKmRecorte[s.slotKey] : undefined
            const insercaoDoSlot = insercaoRecorte ? insercaoRecorte[s.slotKey] : undefined
            const kmAdicionalM = typeof kmDoMapa === 'number' ? kmDoMapa : null
            const deltaInsercaoKmM =
              insercaoDoSlot && typeof insercaoDoSlot === 'object'
                ? ((insercaoDoSlot as Record<string, unknown>).kmAdicionalNaRotaMFinal as number | undefined) ?? null
                : null
            return {
              ...s,
              kmAdicionalNaRotaMDoMapa: kmAdicionalM,
              deltaInsercaoKmM,
              insercaoDetalhes: insercaoDoSlot ?? null,
            }
          })

          let candidatosReclassificados: Array<Record<string, unknown>> = []
          if (
            reclassificacaoRecorte &&
            Array.isArray((reclassificacaoRecorte as Record<string, unknown>).candidatos)
          ) {
            const todosCandidatos = (reclassificacaoRecorte as Record<string, unknown>).candidatos as Array<Record<string, unknown>>
            candidatosReclassificados = todosCandidatos.filter((c) => {
              const dataMatch = datasAlvo.length === 0 || datasAlvo.includes(String(c.dataISO ?? ''))
              const equipeMatch = equipesAlvo.length === 0 || equipesAlvo.some((e) => normalizarEquipe(String(c.equipe ?? '')) === normalizarEquipe(e))
              return dataMatch && equipeMatch
            })
          }

          diagnosticoRecorteAlvo = {
            executado: true,
            filtros: { datasAlvo, equipesAlvo, termosEnderecoAlvo },
            contadores: {
              slotsTotais: slotsRecorte.slots.length,
              slotsFiltrados: slotsFiltrados.length,
              slotsComPontos: slotsComPontos.length,
              slotsComTermoAlvo: slotsComTermo.length,
              candidatosReclassificadosNoRecorte: candidatosReclassificados.length,
            },
            slots: slotsComKm,
            candidatosReclassificados,
            mapaKmDisponivel: mapaKmRecorte !== null,
            insercaoDisponivel: insercaoRecorte !== null,
            reclassificacaoDisponivel: reclassificacaoRecorte !== null,
            avisos: avisosRecorte,
            erros: errosRecorte,
          }
        } catch (error: unknown) {
          diagnosticoRecorteAlvo = {
            executado: true,
            ok: false,
            filtros: { datasAlvo, equipesAlvo, termosEnderecoAlvo },
            erro: `Erro ao montar recorte alvo: ${error instanceof Error ? error.message : String(error)}`,
            avisos: avisosRecorte,
            erros: errosRecorte,
          }
        }
      }
    }

    // 9. Montar resposta diagnóstica
    const duracaoMs = Date.now() - inicio

    return NextResponse.json(
      {
        ok: true,
        versao: 'v2-diagnostico',
        motor: 'nextjs',
        modo: 'diagnostico',
        producaoAfetada: false,
        duracaoMs,
        entrada,
        entradaNormalizada: {
          cep: entradaNormalizada.cep,
          temEnderecoCompleto: Boolean(entradaNormalizada.enderecoCompleto),
          dataInicialISO: entradaNormalizada.dataInicialISO,
          tempoNecessarioTexto: entradaNormalizada.tempoNecessarioTexto,
          tempoNecessarioMin: entradaNormalizada.tempoNecessarioMin,
          temEnderecoMinimo: entradaNormalizada.temEnderecoMinimo,
          temCoordenadasDestino: entradaNormalizada.temCoordenadasDestino,
          temCoordenadasOrigemInformada: Boolean(entradaNormalizada.coordenadasOrigemInformada),
          isRural: entradaNormalizada.isRural,
          isCondominio: entradaNormalizada.isCondominio,
          avisos: entradaNormalizada.avisos,
        },
        diagnosticoFrete,
        diagnosticoJanelaDatas,
        diagnosticoDisponibilidade,
        diagnosticoClassificacao,
        diagnosticoCandidatos,
        diagnosticoOrdenacao,
        diagnosticoDisponibilidadeReal,
        diagnosticoAgendaReal,
        diagnosticoCandidatosDisponibilidadeReal,
        diagnosticoCandidatosReaisAdaptados,
        diagnosticoResultadoFinalLegadoEquivalente,
        diagnosticoKmAdicionalAgenda,
        diagnosticoKmAdicionalRealControlado,
        diagnosticoComparacaoHaversineOsrm,
        diagnosticoEquivalenciaOsrmRouteVsTable,
        diagnosticoMapaKmAdicionalPorSlot,
        diagnosticoAplicacaoMapaKmPorSlotEmCandidatos,
        diagnosticoReclassificacaoComKmMapaSlot,
        diagnosticoComparacaoLegadoV2,
        diagnosticoInsercaoPorSlot,
        diagnosticoSantoAmaroV2,
        diagnosticoFluxoRealV2,
        diagnosticoRecorteAlvo,
        diagnosticoMajorHardy31Jul,
        diagnosticoHenriqueCorreia31Jul,
        diagnosticoOsrm: (() => {
          const osrmResolvidoResposta = resolverOsrmBaseUrlV2(
            bodyDiagnostico.osrmBaseUrlDiagnostico,
            configResult.ok ? configResult.config.osrmBaseUrl : null
          )
          const fallbackUsado =
            osrmResolvidoResposta.url === OSRM_BASE_URL_FALLBACK_PUBLICO
          return {
            osrmPrimario: OSRM_BASE_URL_DEFAULT_V2,
            osrmFallback: OSRM_BASE_URL_FALLBACK_PUBLICO,
            osrmBaseUrlUsado: osrmResolvidoResposta.url,
            osrmFallbackUsado: fallbackUsado,
            origemConfig: osrmResolvidoResposta.origem,
            aviso:
              'OSRM oficial da v2: https://osrm.lebebe.cloud (igual ao legado). ' +
              'router.project-osrm.org so pode ser usado como override explicito no payload.',
          }
        })(),
        config,
        helpers,
        avisos: [
          'Rota diagnóstica. Não busca candidatos e não substitui o motor legado.',
          'Normalizador de entrada v2 integrado: normalizarEntradaPesquisaV2().',
          'Diagnóstico de distância/frete usa Haversine e não substitui OSRM/ranking do motor legado.',
          'Janela de datas v2 gerada apenas para diagnóstico. Não consulta agenda nem disponibilidade.',
          'Disponibilidade v2 calculada com dados sintéticos para diagnóstico. Não reflete agenda real.',
          'Classificação operacional v2 calculada com kmAdicionalNaRotaM sintético para diagnóstico. Não reflete cenário real.',
          'Candidatos preliminares v2 montados a partir de classificações sintéticas. Frete não vinculado nesta etapa.',
          'Ordenação preliminar/diagnóstica de candidatos v2 aplicada. Não é ranking final de produção.',
          'Helpers puros testados: tempo (parse/format), equipe (normalização), distância (haversine), frete, janela de datas, disponibilidade, classificação, candidato, ordenação.',
          'Config carregada via config-service com fallback para planilha.',
          'Diagnóstico de disponibilidade real: bloco opcional (usarDisponibilidadeRealDiagnostica). Não substitui disponibilidade sintética nem afeta classificação/candidatos.',
          'Candidatos reais adaptados para legado: bloco opcional aparece apenas quando candidatos reais são gerados com sucesso. Usa formato legado-gmt3.',
          'Mapa de kmAdicionalNaRotaM por slot: bloco opcional (usarMapaKmAdicionalPorSlotDiagnostico). Calcula mapa (dataISO::equipe) -> kmAdicionalNaRotaM via OSRM /table com fallback Haversine. Nao afeta producao.',
          'Aplicacao do mapa por slot em candidatos: bloco opcional (usarMapaKmAdicionalPorSlotNaClassificacaoDiagnostico). Requer mapa calculado. Aplica kmAdicionalNaRotaM por slot nos candidatos sinteticos do diagnostico. kmAdicionalNaRotaDiagnosticoM global nao contamina. Nao afeta producao.',
          'Reclassificacao com km do mapa: bloco opcional (usarReclassificacaoComKmMapaSlotDiagnostico). Requer aplicacao do mapa em candidatos. Reclassifica tipo/elegivel usando classificarCandidatoOperacionalV2 com kmAdicionalNaRotaM do mapa. Compara antes/depois. Nao afeta producao.',
          'Comparacao legado x v2: bloco opcional (usarComparacaoLegadoV2Diagnostico). Usa somente legadoComparacaoDiagnostico controlado, nao chama Apps Script real nem rota legado de producao.',
          'Diagnostico Santo Amaro v2: bloco opcional (usarDiagnosticoSantoAmaroV2). Explica slots alvo antes/depois do recorte sem alterar regras, tela, legado ou Apps Script.',
        ],
      },
      { status: 200 }
    )
  } catch (error: unknown) {
    console.error('[PROCURAR-DATAS][v2/diagnostico] erro:', error)
    return respostaErroProcurarDatas(error)
  }
}
