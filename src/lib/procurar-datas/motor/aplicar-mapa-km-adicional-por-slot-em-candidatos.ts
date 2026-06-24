// ─────────────────────────────────────────────────────────────────────────────
// motor/aplicar-mapa-km-adicional-por-slot-em-candidatos.ts
//
// Helper puro de diagnóstico.
//
// Aplica kmAdicionalNaRotaM do mapa por slot em candidatos diagnósticos
// resolvendo a chave ${dataISO}::${equipeNormalizada}.
//
// REGRAS:
//   - Se mapa[slotKey] for número finito: aplica no candidato.
//   - Se não houver chave no mapa: não aplica valor global; registra aviso.
//   - Se candidato não tiver dataISO ou equipe: não aplica; registra aviso.
//   - Preserva todos os demais campos do candidato.
//   - kmAdicionalNaRotaDiagnosticoM nunca é parâmetro — isolamento garantido.
//
// NÃO FAZ:
//   - Não chama OSRM, Supabase, Apps Script ou qualquer I/O.
//   - Não altera produção, frontend, ranking final.
//   - Não reclassifica candidatos — apenas injeta o valor no campo.
// ─────────────────────────────────────────────────────────────────────────────

import { normalizarEquipe } from './equipe'

// ─── Tipos de entrada ─────────────────────────────────────────────────────────

export type CandidatoDiagnosticoParaAplicacaoMapa = {
  dataISO: string
  equipe: string
  kmAdicionalNaRotaM: number | null
  [key: string]: unknown
}

export type AplicarMapaKmAdicionalPorSlotEmCandidatosInput = {
  candidatos: CandidatoDiagnosticoParaAplicacaoMapa[]
  mapaKmAdicionalPorSlot: Record<string, number | null>
}

// ─── Tipos de saída ───────────────────────────────────────────────────────────

export type CandidatoDiagnosticoComMapaKm = CandidatoDiagnosticoParaAplicacaoMapa & {
  slotKeyKmAdicional: string | null
  origemKmAdicionalNaRotaM: 'mapa-slot-diagnostico' | 'sem-chave-no-mapa' | 'sem-data-equipe'
  kmAdicionalAplicadoPorMapaSlot: boolean
}

export type AplicarMapaKmAdicionalPorSlotEmCandidatosOutput = {
  ok: boolean
  modo: 'aplicacao-mapa-km-por-slot-em-candidatos-diagnostico'
  candidatos: CandidatoDiagnosticoComMapaKm[]
  contadores: {
    candidatosRecebidos: number
    candidatosComSlotKey: number
    candidatosComKmAplicado: number
    candidatosSemChaveNoMapa: number
    candidatosSemDataOuEquipe: number
  }
  avisos: string[]
  erros: string[]
}

// ─── Implementação ────────────────────────────────────────────────────────────

export function aplicarMapaKmAdicionalPorSlotEmCandidatosDiagnosticoV2(
  input: AplicarMapaKmAdicionalPorSlotEmCandidatosInput
): AplicarMapaKmAdicionalPorSlotEmCandidatosOutput {
  const avisos: string[] = [
    'Aplicacao de mapa de kmAdicionalNaRotaM por slot em candidatos diagnosticos.',
    'Apenas diagnostico. Nao afeta producao, frontend ou ranking final.',
    'kmAdicionalNaRotaDiagnosticoM global do body nao e parametro — isolamento garantido por interface.',
  ]
  const erros: string[] = []

  let candidatosComSlotKey = 0
  let candidatosComKmAplicado = 0
  let candidatosSemChaveNoMapa = 0
  let candidatosSemDataOuEquipe = 0

  const candidatosResultado: CandidatoDiagnosticoComMapaKm[] = []

  for (const candidato of input.candidatos) {
    const dataISO =
      typeof candidato.dataISO === 'string' ? candidato.dataISO.trim() : ''
    const equipeRaw =
      typeof candidato.equipe === 'string' ? candidato.equipe.trim() : ''

    // Normalizar equipe — mesma lógica do mapa por slot para garantir chave idêntica.
    // Equipes no candidato sintético podem ter sufixo " (sintético)" — precisamos normalizar
    // apenas a parte antes do sufixo para encontrar a chave corretamente.
    const equipeParaNormalizar = equipeRaw.replace(/\s*\(.*\)$/, '').trim()
    const equipeNormalizada = normalizarEquipe(equipeParaNormalizar)

    if (!dataISO || !equipeNormalizada) {
      candidatosSemDataOuEquipe++
      avisos.push(
        `Candidato sem data/equipe valida: dataISO="${dataISO}" equipe="${equipeRaw}". kmAdicionalNaRotaM nao alterado.`
      )
      candidatosResultado.push({
        ...candidato,
        slotKeyKmAdicional: null,
        origemKmAdicionalNaRotaM: 'sem-data-equipe',
        kmAdicionalAplicadoPorMapaSlot: false,
      })
      continue
    }

    const slotKey = `${dataISO}::${equipeNormalizada}`
    candidatosComSlotKey++

    if (!(slotKey in input.mapaKmAdicionalPorSlot)) {
      candidatosSemChaveNoMapa++
      avisos.push(
        `Candidato sem chave no mapa: slotKey="${slotKey}". kmAdicionalNaRotaM nao alterado.`
      )
      candidatosResultado.push({
        ...candidato,
        slotKeyKmAdicional: slotKey,
        origemKmAdicionalNaRotaM: 'sem-chave-no-mapa',
        kmAdicionalAplicadoPorMapaSlot: false,
      })
      continue
    }

    const kmDoMapa = input.mapaKmAdicionalPorSlot[slotKey]

    if (typeof kmDoMapa === 'number' && Number.isFinite(kmDoMapa)) {
      candidatosComKmAplicado++
      candidatosResultado.push({
        ...candidato,
        kmAdicionalNaRotaM: kmDoMapa,
        slotKeyKmAdicional: slotKey,
        origemKmAdicionalNaRotaM: 'mapa-slot-diagnostico',
        kmAdicionalAplicadoPorMapaSlot: true,
      })
    } else {
      // Chave existe no mapa mas valor é null — registra aviso, mantém original
      candidatosSemChaveNoMapa++
      avisos.push(
        `Candidato com chave no mapa mas valor null: slotKey="${slotKey}". kmAdicionalNaRotaM nao alterado.`
      )
      candidatosResultado.push({
        ...candidato,
        slotKeyKmAdicional: slotKey,
        origemKmAdicionalNaRotaM: 'sem-chave-no-mapa',
        kmAdicionalAplicadoPorMapaSlot: false,
      })
    }
  }

  const ok = erros.length === 0

  return {
    ok,
    modo: 'aplicacao-mapa-km-por-slot-em-candidatos-diagnostico',
    candidatos: candidatosResultado,
    contadores: {
      candidatosRecebidos: input.candidatos.length,
      candidatosComSlotKey,
      candidatosComKmAplicado,
      candidatosSemChaveNoMapa,
      candidatosSemDataOuEquipe,
    },
    avisos,
    erros,
  }
}
