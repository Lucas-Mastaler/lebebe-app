// ─────────────────────────────────────────────────────────────────────────────
// motor/reclassificar-candidatos-com-km-mapa-slot.ts
//
// Helper puro de diagnóstico.
//
// Reclassifica candidatos diagnósticos que tiveram kmAdicionalNaRotaM
// aplicado pelo mapa por slot, chamando classificarCandidatoOperacionalV2
// com o novo valor e comparando tipo/elegivel antes × depois.
//
// REGRAS:
//   - Só reclassifica candidatos com kmAdicionalAplicadoPorMapaSlot === true.
//   - Candidatos sem km aplicado são preservados sem reclassificação.
//   - kmAdicionalNaRotaDiagnosticoM nunca é parâmetro — isolamento garantido.
//   - Requer config de classificação e dados operacionais do candidato.
//
// NÃO FAZ:
//   - Não chama OSRM, Supabase, Apps Script ou qualquer I/O.
//   - Não altera produção, frontend, ranking final.
// ─────────────────────────────────────────────────────────────────────────────

import {
  classificarCandidatoOperacionalV2,
  type ConfigClassificacaoV2,
  type TipoClassificacaoCandidatoV2,
} from './classificacao-candidato'

// ─── Tipos de entrada ─────────────────────────────────────────────────────────

export type CandidatoParaReclassificacao = {
  dataISO: string
  equipe: string
  diaSemana?: number
  ehSabado?: boolean
  ehDomingo?: boolean
  slotTemPontos?: boolean
  ativa?: boolean
  disponivelMin?: number
  suficienteParaServico?: boolean
  tempoNecessarioMin?: number | null
  distanciaKm?: number | null
  kmAdicionalNaRotaM: number | null
  kmAdicionalAplicadoPorMapaSlot?: boolean
  origemKmAdicionalNaRotaM?: string
  slotKeyKmAdicional?: string | null
  tipo?: string
  elegivel?: boolean
  motivos?: string[]
  isCondominio?: boolean
  isRural?: boolean
  horaMarcada?: boolean
  elegivelHoraMarcada?: boolean
  [key: string]: unknown
}

export type ReclassificarCandidatosComKmMapaSlotInput = {
  candidatos: CandidatoParaReclassificacao[]
  config: ConfigClassificacaoV2
  tempoNecessarioMin: number | null
}

// ─── Tipos de saída ───────────────────────────────────────────────────────────

export type CandidatoReclassificado = {
  dataISO: string
  equipe: string
  slotKeyKmAdicional: string | null
  kmAdicionalNaRotaM: number | null
  slotTemPontos: boolean
  limiteBaseM: number | null
  limiteEspecialM: number | null
  limitePremiumM: number | null
  origemKmAdicionalNaRotaM: string
  kmAdicionalAplicadoPorMapaSlot: boolean
  tipoAntes: string
  elegivelAntes: boolean
  tipoDepois: TipoClassificacaoCandidatoV2
  elegivelDepois: boolean
  horaMarcadaAntes: boolean
  horaMarcadaDepois: boolean
  mudouHoraMarcada: boolean
  slotAvailMin: number | null
  serviceMin: number | null
  horaMarcadaHorasAMais: number | null
  limiteMinimoHoraMarcadaMin: number | null
  horaMarcadaCalculadaPorTempo: boolean | null
  mudouTipo: boolean
  mudouElegibilidade: boolean
  motivosAntes: string[]
  motivosDepois: string[]
}

export type ReclassificarCandidatosComKmMapaSlotOutput = {
  ok: boolean
  modo: 'reclassificacao-com-km-mapa-slot-diagnostico'
  candidatos: CandidatoReclassificado[]
  contadores: {
    candidatosRecebidos: number
    candidatosComKmAplicado: number
    candidatosSemKmAplicado: number
    candidatosReclassificados: number
    candidatosComTipoAlterado: number
    candidatosComElegibilidadeAlterada: number
    candidatosComErro: number
    candidatosSemChaveNoMapa: number
  }
  avisos: string[]
  erros: string[]
}

// ─── Implementação ────────────────────────────────────────────────────────────

export function reclassificarCandidatosComKmMapaSlotDiagnosticoV2(
  input: ReclassificarCandidatosComKmMapaSlotInput
): ReclassificarCandidatosComKmMapaSlotOutput {
  const avisos: string[] = [
    'Reclassificacao de candidatos diagnosticos com kmAdicionalNaRotaM do mapa por slot.',
    'Apenas diagnostico. Nao afeta producao, frontend ou ranking final.',
    'kmAdicionalNaRotaDiagnosticoM global do body nao e parametro — isolamento garantido por interface.',
  ]
  const erros: string[] = []

  let candidatosComKmAplicado = 0
  let candidatosSemKmAplicado = 0
  let candidatosReclassificados = 0
  let candidatosComTipoAlterado = 0
  let candidatosComElegibilidadeAlterada = 0
  let candidatosComErro = 0
  let candidatosSemChaveNoMapa = 0

  const resultados: CandidatoReclassificado[] = []

  for (const c of input.candidatos) {
    const tipoAntes = typeof c.tipo === 'string' ? c.tipo : 'desconhecido'
    const elegivelAntes = typeof c.elegivel === 'boolean' ? c.elegivel : false
    const horaMarcadaAntes =
      typeof c.elegivelHoraMarcada === 'boolean'
        ? c.elegivelHoraMarcada
        : typeof c.horaMarcada === 'boolean'
          ? c.horaMarcada
          : false
    const motivosAntes = Array.isArray(c.motivos) ? [...c.motivos] : []
    const aplicado = c.kmAdicionalAplicadoPorMapaSlot === true
    const slotTemPontos = typeof c.slotTemPontos === 'boolean' ? c.slotTemPontos : true
    const origemKm = typeof c.origemKmAdicionalNaRotaM === 'string'
      ? c.origemKmAdicionalNaRotaM
      : 'desconhecida'
    const slotKey = typeof c.slotKeyKmAdicional === 'string'
      ? c.slotKeyKmAdicional
      : null

    // Candidatos sem km aplicado pelo mapa — preservar sem reclassificar
    if (!aplicado) {
      if (origemKm === 'sem-chave-no-mapa') {
        candidatosSemChaveNoMapa++
      }
      candidatosSemKmAplicado++
      resultados.push({
        dataISO: c.dataISO,
        equipe: c.equipe,
        slotKeyKmAdicional: slotKey,
        kmAdicionalNaRotaM: c.kmAdicionalNaRotaM,
        slotTemPontos,
        limiteBaseM: null,
        limiteEspecialM: null,
        limitePremiumM: null,
        origemKmAdicionalNaRotaM: origemKm,
        kmAdicionalAplicadoPorMapaSlot: false,
        tipoAntes,
        elegivelAntes,
        tipoDepois: tipoAntes as TipoClassificacaoCandidatoV2,
        elegivelDepois: elegivelAntes,
        horaMarcadaAntes,
        horaMarcadaDepois: horaMarcadaAntes,
        mudouHoraMarcada: false,
        slotAvailMin: typeof c.disponivelMin === 'number' ? c.disponivelMin : null,
        serviceMin:
          typeof c.tempoNecessarioMin === 'number'
            ? c.tempoNecessarioMin
            : input.tempoNecessarioMin,
        horaMarcadaHorasAMais:
          typeof input.config.horaMarcadaHorasAMais === 'number'
            ? input.config.horaMarcadaHorasAMais
            : null,
        limiteMinimoHoraMarcadaMin: null,
        horaMarcadaCalculadaPorTempo: null,
        mudouTipo: false,
        mudouElegibilidade: false,
        motivosAntes,
        motivosDepois: motivosAntes,
      })
      continue
    }

    candidatosComKmAplicado++

    // Reclassificar com o kmAdicionalNaRotaM do mapa
    try {
      const classificacao = classificarCandidatoOperacionalV2({
        dataISO: c.dataISO,
        diaSemana: typeof c.diaSemana === 'number' ? c.diaSemana : 1,
        ehSabado: typeof c.ehSabado === 'boolean' ? c.ehSabado : false,
        ehDomingo: typeof c.ehDomingo === 'boolean' ? c.ehDomingo : false,
        slotTemPontos,
        equipe: c.equipe,
        ativa: typeof c.ativa === 'boolean' ? c.ativa : true,
        disponivelMin: typeof c.disponivelMin === 'number' ? c.disponivelMin : 240,
        suficienteParaServico:
          typeof c.suficienteParaServico === 'boolean' ? c.suficienteParaServico : true,
        motivoIndisponibilidade: null,
        tempoNecessarioMin: input.tempoNecessarioMin,
        distanciaKm: typeof c.distanciaKm === 'number' ? c.distanciaKm : null,
        kmAdicionalNaRotaM: c.kmAdicionalNaRotaM,
        isCondominio: typeof c.isCondominio === 'boolean' ? c.isCondominio : false,
        isRural: typeof c.isRural === 'boolean' ? c.isRural : false,
        config: input.config,
      })

      candidatosReclassificados++

      const mudouTipo = classificacao.tipo !== tipoAntes
      const mudouElegibilidade = classificacao.elegivel !== elegivelAntes
      const horaMarcadaDepois = classificacao.elegivelHoraMarcada === true
      const mudouHoraMarcada = horaMarcadaDepois !== horaMarcadaAntes

      if (mudouTipo) candidatosComTipoAlterado++
      if (mudouElegibilidade) candidatosComElegibilidadeAlterada++

      resultados.push({
        dataISO: c.dataISO,
        equipe: c.equipe,
        slotKeyKmAdicional: slotKey,
        kmAdicionalNaRotaM: c.kmAdicionalNaRotaM,
        slotTemPontos,
        limiteBaseM: classificacao.detalhes.limiteBaseM,
        limiteEspecialM: classificacao.detalhes.limiteEspecialM,
        limitePremiumM: classificacao.detalhes.limitePremiumM,
        origemKmAdicionalNaRotaM: origemKm,
        kmAdicionalAplicadoPorMapaSlot: true,
        tipoAntes,
        elegivelAntes,
        tipoDepois: classificacao.tipo,
        elegivelDepois: classificacao.elegivel,
        horaMarcadaAntes,
        horaMarcadaDepois,
        mudouHoraMarcada,
        slotAvailMin: classificacao.detalhes.slotAvailMin ?? null,
        serviceMin: classificacao.detalhes.serviceMin ?? null,
        horaMarcadaHorasAMais: classificacao.detalhes.horaMarcadaHorasAMais ?? null,
        limiteMinimoHoraMarcadaMin: classificacao.detalhes.limiteMinimoHoraMarcadaMin ?? null,
        horaMarcadaCalculadaPorTempo: classificacao.detalhes.horaMarcadaCalculadaPorTempo ?? null,
        mudouTipo,
        mudouElegibilidade,
        motivosAntes,
        motivosDepois: classificacao.motivos,
      })
    } catch (err) {
      candidatosComErro++
      const msg = err instanceof Error ? err.message : String(err)
      erros.push(`Erro ao reclassificar candidato ${c.dataISO}/${c.equipe}: ${msg}`)

      resultados.push({
        dataISO: c.dataISO,
        equipe: c.equipe,
        slotKeyKmAdicional: slotKey,
        kmAdicionalNaRotaM: c.kmAdicionalNaRotaM,
        slotTemPontos,
        limiteBaseM: null,
        limiteEspecialM: null,
        limitePremiumM: null,
        origemKmAdicionalNaRotaM: origemKm,
        kmAdicionalAplicadoPorMapaSlot: true,
        tipoAntes,
        elegivelAntes,
        tipoDepois: tipoAntes as TipoClassificacaoCandidatoV2,
        elegivelDepois: elegivelAntes,
        horaMarcadaAntes,
        horaMarcadaDepois: horaMarcadaAntes,
        mudouHoraMarcada: false,
        slotAvailMin: typeof c.disponivelMin === 'number' ? c.disponivelMin : null,
        serviceMin:
          typeof c.tempoNecessarioMin === 'number'
            ? c.tempoNecessarioMin
            : input.tempoNecessarioMin,
        horaMarcadaHorasAMais:
          typeof input.config.horaMarcadaHorasAMais === 'number'
            ? input.config.horaMarcadaHorasAMais
            : null,
        limiteMinimoHoraMarcadaMin: null,
        horaMarcadaCalculadaPorTempo: null,
        mudouTipo: false,
        mudouElegibilidade: false,
        motivosAntes,
        motivosDepois: [`Erro na reclassificacao: ${msg}`],
      })
    }
  }

  return {
    ok: erros.length === 0,
    modo: 'reclassificacao-com-km-mapa-slot-diagnostico',
    candidatos: resultados,
    contadores: {
      candidatosRecebidos: input.candidatos.length,
      candidatosComKmAplicado,
      candidatosSemKmAplicado,
      candidatosReclassificados,
      candidatosComTipoAlterado,
      candidatosComElegibilidadeAlterada,
      candidatosComErro,
      candidatosSemChaveNoMapa,
    },
    avisos,
    erros,
  }
}
