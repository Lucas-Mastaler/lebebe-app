// ─────────────────────────────────────────────────────────────────────────────
// motor/adaptar-candidatos-reais-legado.ts
//
// Helper puro: transforma candidatos v2 reais já ordenados em uma amostra
// compatível com o contrato legado diagnóstico.
//
// Delega integralmente para adaptarCandidatoV2ParaContratoLegadoDiagnostico.
// Não duplica nenhuma lógica de conversão de campos.
//
// Escopo: exclusivamente diagnóstico.
//
// NÃO FAZ:
//   - Não lê planilha, Supabase, Apps Script, OSRM, Google Calendar
//   - Não recalcula frete
//   - Não recalcula rank internamente além da sequência posicional
//   - Não muta entrada
//   - Não lança erros
//   - Não está integrado em nenhuma rota
// ─────────────────────────────────────────────────────────────────────────────

import {
  adaptarCandidatoV2ParaContratoLegadoDiagnostico,
  type CandidatoLegadoDiagnosticoV2,
  type FormatoDateISOLegadoDiagnostico,
} from './adaptador-candidato-legado'
import type { CandidatoPreliminarV2 } from './candidato'

// ─── Tipos ───────────────────────────────────────────────────────────────────

/**
 * Entrada para adaptarCandidatosDisponibilidadeRealParaLegadoDiagnosticoV2.
 */
export interface AdaptarCandidatosDisponibilidadeRealParaLegadoDiagnosticoV2Input {
  /** Candidatos já ordenados por gerarCandidatosComDisponibilidadeRealV2(). */
  candidatosOrdenados: CandidatoPreliminarV2[]

  /**
   * Formato do campo dateISO na saída.
   * Padrão: 'legado-gmt3' — emite YYYY-MM-DDT03:00:00.000Z, conforme observado
   * nas fixtures reais do legado.
   * Use 'v2' para obter o formato canônico v2 (YYYY-MM-DD).
   */
  formatoDateISO?: FormatoDateISOLegadoDiagnostico

  /**
   * Número máximo de candidatos na amostra.
   * Se omitido ou zero, todos os candidatos são incluídos.
   * Se maior que a quantidade disponível, inclui todos.
   */
  limiteAmostra?: number

  /**
   * Data de referência para cálculo de daysLeftTxt (formato YYYY-MM-DD).
   * Normalmente: data de hoje ou data inicial da pesquisa.
   * Se omitida, daysLeftTxt será string vazia em todos os candidatos (com aviso).
   */
  dataReferenciaISO?: string | null
}

/**
 * Saída de adaptarCandidatosDisponibilidadeRealParaLegadoDiagnosticoV2.
 */
export interface AdaptarCandidatosDisponibilidadeRealParaLegadoDiagnosticoV2Output {
  ok: boolean
  /** Formato de dateISO efetivamente usado na amostra. */
  formatoDateISO: FormatoDateISOLegadoDiagnostico
  /** Quantidade de candidatos recebidos no input. */
  quantidadeRecebida: number
  /** Quantidade de candidatos incluídos na amostra (respeitando limiteAmostra). */
  quantidadeAdaptada: number
  /** Candidatos adaptados para o contrato legado diagnóstico. */
  amostra: CandidatoLegadoDiagnosticoV2[]
  /** Avisos acumulados (lista vazia, candidatos indisponíveis, dataReferenciaISO ausente, etc.). */
  avisos: string[]
}

// ─── Função principal ─────────────────────────────────────────────────────────

/**
 * Adapta candidatos v2 reais já ordenados para o contrato legado diagnóstico.
 *
 * Regras:
 *   - Padrão de formatoDateISO: 'legado-gmt3' (emite T03:00:00.000Z)
 *   - Rank é atribuído sequencialmente: 1, 2, 3, … (posição na amostra)
 *   - limiteAmostra 0 ou omitido → inclui todos
 *   - Candidatos indisponíveis são incluídos (o adapter os aceita)
 *   - Não muta candidatosOrdenados
 *   - ok: false apenas se candidatosOrdenados não for array válido
 *   - Avisos acumulam avisos próprios e avisos vindos do adapter por candidato
 *   - Não faz I/O, não lança erros
 */
export function adaptarCandidatosDisponibilidadeRealParaLegadoDiagnosticoV2(
  input: AdaptarCandidatosDisponibilidadeRealParaLegadoDiagnosticoV2Input
): AdaptarCandidatosDisponibilidadeRealParaLegadoDiagnosticoV2Output {
  const avisos: string[] = []

  // Garante que o input é válido
  if (!Array.isArray(input.candidatosOrdenados)) {
    return {
      ok: false,
      formatoDateISO: 'legado-gmt3',
      quantidadeRecebida: 0,
      quantidadeAdaptada: 0,
      amostra: [],
      avisos: ['candidatosOrdenados não é um array válido.'],
    }
  }

  const formatoDateISO: FormatoDateISOLegadoDiagnostico = input.formatoDateISO ?? 'legado-gmt3'
  const dataReferenciaISO = input.dataReferenciaISO ?? null
  const limite = typeof input.limiteAmostra === 'number' && input.limiteAmostra > 0
    ? input.limiteAmostra
    : null

  const quantidadeRecebida = input.candidatosOrdenados.length

  if (quantidadeRecebida === 0) {
    avisos.push('Lista de candidatos recebida está vazia. Amostra retornada vazia.')
    return {
      ok: true,
      formatoDateISO,
      quantidadeRecebida: 0,
      quantidadeAdaptada: 0,
      amostra: [],
      avisos,
    }
  }

  if (dataReferenciaISO === null) {
    avisos.push(
      'dataReferenciaISO não fornecida. daysLeftTxt será string vazia em todos os candidatos.'
    )
  }

  // Aplica limite
  const fatia = limite !== null
    ? input.candidatosOrdenados.slice(0, limite)
    : input.candidatosOrdenados.slice()

  // Adapta cada candidato delegando integralmente ao adapter existente
  const amostra: CandidatoLegadoDiagnosticoV2[] = []
  for (let i = 0; i < fatia.length; i++) {
    const candidato = fatia[i]
    const rank = i + 1

    const adaptado = adaptarCandidatoV2ParaContratoLegadoDiagnostico({
      candidato,
      rank,
      dataReferenciaISO,
      formatoDateISO,
    })

    amostra.push(adaptado)
  }

  return {
    ok: true,
    formatoDateISO,
    quantidadeRecebida,
    quantidadeAdaptada: amostra.length,
    amostra,
    avisos,
  }
}
