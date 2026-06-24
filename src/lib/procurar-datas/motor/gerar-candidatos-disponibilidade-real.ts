// ─────────────────────────────────────────────────────────────────────────────
// motor/gerar-candidatos-disponibilidade-real.ts
//
// Helper puro: transforma disponibilidade real já parseada em candidatos
// diagnósticos v2.
//
// Orquestra a cadeia de helpers puros existentes:
//   1. filtrarDisponibilidadePorJanelaV2   (disponibilidade.ts)
//   2. classificarCandidatoOperacionalV2   (classificacao-candidato.ts)
//   3. montarCandidatoPreliminarV2         (candidato.ts)
//   4. ordenarCandidatosDiagnosticosV2     (ordenacao-candidatos.ts)
//
// Escopo: exclusivamente diagnóstico.
//
// NÃO FAZ:
//   - Não lê planilha, Supabase, Apps Script, OSRM, Google Calendar
//   - Não calcula distância via OSRM (usa distanciaKm/kmAdicionalNaRotaM do input)
//   - Não recalcula frete
//   - Não aplica ranking final de produção
//   - Não cria side effects
//   - Não muta input
// ─────────────────────────────────────────────────────────────────────────────

import {
  filtrarDisponibilidadePorJanelaV2,
  type DisponibilidadeEquipeDataV2,
  type DisponibilidadeJanelaV2,
} from './disponibilidade'
import {
  classificarCandidatoOperacionalV2,
  type ConfigClassificacaoV2,
  type ClassificacaoCandidatoOperacionalV2,
} from './classificacao-candidato'
import {
  montarCandidatoPreliminarV2,
  type CandidatoPreliminarV2,
} from './candidato'
import {
  ordenarCandidatosDiagnosticosV2,
  type OrdenarCandidatosDiagnosticosV2Output,
} from './ordenacao-candidatos'
import type { DataJanelaPesquisaV2 } from './janela-datas'
import { normalizarEquipe } from './equipe'

// ─── Tipos ───────────────────────────────────────────────────────────────────

/**
 * Entrada para gerarCandidatosComDisponibilidadeRealV2.
 *
 * Valores de distância e frete são diagnósticos — devem vir pré-calculados
 * (ex: Haversine diagnóstico, OSRM quando disponível, ou null para indicar
 * ausência). Este helper não resolve OSRM nem calcula frete internamente.
 */
export interface GerarCandidatosComDisponibilidadeRealV2Input {
  /** Janela de datas já gerada por gerarJanelaDatasPesquisaV2(). */
  janelaDatas: DataJanelaPesquisaV2[]

  /** Disponibilidades reais já parseadas (ex: por parsearDisponibilidadeTempoDisponivelV2()). */
  disponibilidades: DisponibilidadeEquipeDataV2[]

  /** Minutos mínimos necessários para o serviço. */
  tempoNecessarioMin: number | null

  /**
   * Distância do destino em km (diagnóstico, não OSRM real).
   * null → candidatos classificarão como indisponivel com motivo de distância ausente.
   */
  distanciaKm?: number | null

  /**
   * Distância adicional na rota em metros (diagnóstico).
   * null → candidatos classificarão como indisponivel com motivo de distância adicional ausente.
   */
  kmAdicionalNaRotaM?: number | null

  /** Valor de frete pré-calculado para todos os candidatos (diagnóstico). */
  valorFrete?: number | null

  /** Tipo de frete descritivo (diagnóstico). */
  tipoFrete?: string | null

  /** Flags de tipo de endereço. */
  isCondominio?: boolean
  isRural?: boolean
  /** Mapa diagnostico ${dataISO}::${equipe} -> slotTemPontos. */
  slotTemPontosPorDataEquipe?: Record<string, boolean>

  /**
   * Mapa opcional de kmAdicionalNaRotaM por slot (dataISO::equipeNormalizada -> km em metros).
   * Se fornecido, cada candidato recebe o km específico do seu slot.
   * Se não fornecido ou slot não encontrado, usa kmAdicionalNaRotaM global.
   */
  mapaKmAdicionalPorSlot?: Record<string, number | null>

  /** Configuração operacional para classificação de candidatos. */
  configOperacional: ConfigClassificacaoV2
}

/**
 * Resumo quantitativo da geração de candidatos.
 */
export interface ResumoGeracaoCandidatosV2 {
  datasNaJanela: number
  disponibilidadesRecebidas: number
  equipesSuficientesTotal: number
  candidatosMontados: number
  candidatosElegiveis: number
  candidatosIndisponiveis: number
  candidatosNormal: number
  candidatosEspecial: number
  candidatosPremium: number
  candidatosHoraMarcada: number
}

/**
 * Saída de gerarCandidatosComDisponibilidadeRealV2.
 */
export interface GerarCandidatosComDisponibilidadeRealV2Output {
  ok: boolean
  resumo: ResumoGeracaoCandidatosV2
  /** Resultado do filtro de disponibilidade por janela. */
  disponibilidadePorJanela: DisponibilidadeJanelaV2
  /** Classificações geradas antes da montagem dos candidatos. */
  classificacoes: ClassificacaoCandidatoOperacionalV2[]
  /** Candidatos montados (antes da ordenação). */
  candidatos: CandidatoPreliminarV2[]
  /** Candidatos após ordenação diagnóstica (elegíveis primeiro). */
  candidatosOrdenados: CandidatoPreliminarV2[]
  /** Resumo da ordenação. */
  resumoOrdenacao: OrdenarCandidatosDiagnosticosV2Output['resumo']
  /** Avisos acumulados de todas as etapas. */
  avisos: string[]
}

// ─── Função principal ─────────────────────────────────────────────────────────

/**
 * Gera candidatos diagnósticos v2 a partir de disponibilidade real já parseada.
 *
 * Pipeline:
 *   1. filtrarDisponibilidadePorJanelaV2  → DataDisponivelV2[] com equipes enriquecidas
 *   2. Para cada data × equipe:
 *      - classificarCandidatoOperacionalV2 → ClassificacaoCandidatoOperacionalV2
 *      - montarCandidatoPreliminarV2       → CandidatoPreliminarV2
 *   3. ordenarCandidatosDiagnosticosV2    → lista ordenada por elegibilidade e tipo
 *
 * Regras:
 *   - Não lê planilha, não chama Apps Script, OSRM, Supabase, Google Calendar
 *   - distanciaKm / kmAdicionalNaRotaM null → candidato classifica como indisponivel
 *   - Não muta nenhum objeto de entrada
 *   - Não lança erros — problemas são sinalizados em `avisos`
 *   - `ok: false` apenas se janela vazia (sem datas para processar)
 */
export function gerarCandidatosComDisponibilidadeRealV2(
  input: GerarCandidatosComDisponibilidadeRealV2Input
): GerarCandidatosComDisponibilidadeRealV2Output {
  const avisosGerais: string[] = []

  const distanciaKm = input.distanciaKm ?? null
  const kmAdicionalNaRotaM = input.kmAdicionalNaRotaM ?? null
  const valorFrete = input.valorFrete ?? null
  const tipoFrete = input.tipoFrete ?? null
  const isCondominio = input.isCondominio ?? false
  const isRural = input.isRural ?? false

  if (distanciaKm === null) {
    avisosGerais.push(
      'distanciaKm não fornecida. Candidatos com distância ausente serão classificados como indisponivel.'
    )
  }
  if (kmAdicionalNaRotaM === null) {
    avisosGerais.push(
      'kmAdicionalNaRotaM não fornecida. Candidatos com distância adicional ausente serão classificados como indisponivel.'
    )
  }

  // ── Etapa 1: filtrar disponibilidade por janela ──────────────────────────────
  const disponibilidadePorJanela = filtrarDisponibilidadePorJanelaV2({
    janela: input.janelaDatas,
    disponibilidades: input.disponibilidades,
    tempoNecessarioMin: input.tempoNecessarioMin,
  })

  // Janela vazia = não há datas para processar
  if (!disponibilidadePorJanela.ok) {
    return {
      ok: false,
      resumo: {
        datasNaJanela: 0,
        disponibilidadesRecebidas: input.disponibilidades.length,
        equipesSuficientesTotal: 0,
        candidatosMontados: 0,
        candidatosElegiveis: 0,
        candidatosIndisponiveis: 0,
        candidatosNormal: 0,
        candidatosEspecial: 0,
        candidatosPremium: 0,
        candidatosHoraMarcada: 0,
      },
      disponibilidadePorJanela,
      classificacoes: [],
      candidatos: [],
      candidatosOrdenados: [],
      resumoOrdenacao: {
        total: 0,
        elegiveis: 0,
        indisponiveis: 0,
        primeiroElegivelId: null,
      },
      avisos: [...avisosGerais, ...disponibilidadePorJanela.avisos],
    }
  }

  // ── Etapa 2: classificar + montar candidatos ───────────────────────────────
  const classificacoes: ClassificacaoCandidatoOperacionalV2[] = []
  const candidatos: CandidatoPreliminarV2[] = []

  let equipesSuficientesTotal = 0

  for (const dataDia of disponibilidadePorJanela.datas) {
    for (const equipe of dataDia.equipes) {
      if (equipe.suficienteParaServico) {
        equipesSuficientesTotal++
      }
      const slotKey = `${dataDia.dataISO}::${equipe.equipe}`
      const slotTemPontos = input.slotTemPontosPorDataEquipe?.[slotKey] ?? true

      // Normalizar equipe para chave do mapa (mesma lógica do helper de mapa por slot)
      const equipeNormalizada = normalizarEquipe(equipe.equipe) ?? equipe.equipe
      const slotKeyMapa = `${dataDia.dataISO}::${equipeNormalizada}`

      // Usar km do mapa por slot se disponível, senão usa km global
      const kmDoMapa =
        input.mapaKmAdicionalPorSlot !== undefined &&
        input.mapaKmAdicionalPorSlot[slotKeyMapa] !== null &&
        input.mapaKmAdicionalPorSlot[slotKeyMapa] !== undefined
      const kmAdicionalParaSlot = kmDoMapa
        ? input.mapaKmAdicionalPorSlot![slotKeyMapa]
        : kmAdicionalNaRotaM
      const origemKmAdicional: 'slot' | 'global-fallback' | null = kmDoMapa
        ? 'slot'
        : input.mapaKmAdicionalPorSlot !== undefined
          ? 'global-fallback'
          : null
      const chaveSlotKm = kmDoMapa ? slotKeyMapa : null

      // Classificar o cenário operacional
      const classificacao = classificarCandidatoOperacionalV2({
        dataISO: dataDia.dataISO,
        diaSemana: dataDia.diaSemana,
        ehSabado: dataDia.ehSabado,
        ehDomingo: dataDia.ehDomingo,
        slotTemPontos,

        equipe: equipe.equipe,
        ativa: equipe.ativa,
        disponivelMin: equipe.disponivelMin,
        suficienteParaServico: equipe.suficienteParaServico,
        motivoIndisponibilidade: equipe.motivoIndisponibilidade,

        tempoNecessarioMin: input.tempoNecessarioMin,

        distanciaKm,
        kmAdicionalNaRotaM: kmAdicionalParaSlot,

        isCondominio,
        isRural,

        config: input.configOperacional,
      })

      classificacoes.push(classificacao)

      // Montar candidato preliminar
      const candidato = montarCandidatoPreliminarV2({
        dataISO: dataDia.dataISO,
        indice: dataDia.indice,
        diaSemana: dataDia.diaSemana,
        ehSabado: dataDia.ehSabado,
        ehDomingo: dataDia.ehDomingo,
        slotTemPontos,

        equipe: equipe.equipe,
        disponivelMin: equipe.disponivelMin,
        ativa: equipe.ativa,
        suficienteParaServico: equipe.suficienteParaServico,

        tempoNecessarioMin: input.tempoNecessarioMin,

        distanciaKm,
        kmAdicionalNaRotaM: kmAdicionalParaSlot,
        origemKmAdicional,
        chaveSlotKm,

        valorFrete,
        tipoFrete,

        classificacao,
      })

      candidatos.push(candidato)
    }
  }

  // ── Etapa 3: ordenar candidatos ────────────────────────────────────────────
  const resultadoOrdenacao = ordenarCandidatosDiagnosticosV2({ candidatos })

  // ── Resumo ────────────────────────────────────────────────────────────────
  const candidatosElegiveis = candidatos.filter((c) => c.elegivel).length
  const candidatosIndisponiveis = candidatos.filter((c) => !c.elegivel).length
  const candidatosNormal = candidatos.filter((c) => c.tipo === 'normal').length
  const candidatosEspecial = candidatos.filter((c) => c.tipo === 'especial').length
  const candidatosPremium = candidatos.filter((c) => c.tipo === 'premium').length
  const candidatosHoraMarcada = candidatos.filter((c) => c.elegivelHoraMarcada).length

  const resumo: ResumoGeracaoCandidatosV2 = {
    datasNaJanela: disponibilidadePorJanela.datas.length,
    disponibilidadesRecebidas: input.disponibilidades.length,
    equipesSuficientesTotal,
    candidatosMontados: candidatos.length,
    candidatosElegiveis,
    candidatosIndisponiveis,
    candidatosNormal,
    candidatosEspecial,
    candidatosPremium,
    candidatosHoraMarcada,
  }

  const avisos = [
    ...avisosGerais,
    ...disponibilidadePorJanela.avisos,
    ...resultadoOrdenacao.avisos,
  ]

  return {
    ok: true,
    resumo,
    disponibilidadePorJanela,
    classificacoes,
    candidatos,
    candidatosOrdenados: resultadoOrdenacao.candidatos,
    resumoOrdenacao: resultadoOrdenacao.resumo,
    avisos,
  }
}
