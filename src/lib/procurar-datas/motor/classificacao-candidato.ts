// ─────────────────────────────────────────────────────────────────────────────
// motor/classificacao-candidato.ts  —  Classificação pura de cenário operacional
//
// Recebe um cenário de atendimento (equipe, data, distância, config) e retorna
// a classificação operacional: normal, especial, premium, hora-marcada, indisponivel.
//
// NÃO FAZ:
//   - Consulta agenda, planilha, Supabase, OSRM, Apps Script, Google Calendar
//   - Nenhuma alteração em APIs existentes ou frontend
//   - Não gera candidatos finais nem aplica ranking
//   - Não consulta disponibilidade real
// ─────────────────────────────────────────────────────────────────────────────

// ─── Tipos ───────────────────────────────────────────────────────────────────

/** Classificação operacional possível de um cenário de atendimento. */
export type TipoClassificacaoCandidatoV2 =
  | 'normal'
  | 'especial'
  | 'premium'
  | 'hora-marcada'
  | 'indisponivel'

/** Configuração mínima necessária para classificação. */
export interface ConfigClassificacaoV2 {
  kmAdicionalMaxNaRotaM: number | null
  kmAdicionalMaxNaRotaEspecialM: number | null
  kmAdicionalMaxNaRotaPremiumM: number | null
  kmMaximoNaSemanaM: number | null
  kmMaximoNoSabadoM: number | null
}

/** Entrada para classificação de um cenário operacional. */
export interface ClassificarCandidatoOperacionalV2Input {
  dataISO: string
  diaSemana: number
  ehSabado: boolean
  ehDomingo: boolean

  equipe: string
  ativa: boolean
  disponivelMin: number
  suficienteParaServico: boolean
  motivoIndisponibilidade?: string | null

  tempoNecessarioMin: number | null

  /** Distância do destino em km (não metros). */
  distanciaKm: number | null
  /** Distância adicional na rota em metros (não km). */
  kmAdicionalNaRotaM?: number | null

  isCondominio?: boolean
  isRural?: boolean
  horaMarcada?: boolean

  config: ConfigClassificacaoV2
}

/** Saída da classificação. */
export interface ClassificacaoCandidatoOperacionalV2 {
  tipo: TipoClassificacaoCandidatoV2
  elegivel: boolean
  motivos: string[]
  avisos: string[]
  detalhes: {
    equipe: string
    dataISO: string
    diaSemana: number
    ehSabado: boolean
    ehDomingo: boolean
    ativa: boolean
    disponivelMin: number
    suficienteParaServico: boolean
    tempoNecessarioMin: number | null
    distanciaKm: number | null
    kmAdicionalNaRotaM: number | null
  }
}

// ─── Constantes ──────────────────────────────────────────────────────────────

/** km → metros. */
const KM_PARA_METROS = 1000

// ─── Função principal ────────────────────────────────────────────────────────

/**
 * Classifica um cenário operacional para atendimento.
 *
 * Ordem de prioridade:
 *   1. Validações bloqueantes → indisponivel
 *   2. Hora marcada (quando marcada e não bloqueada)
 *   3. Normal (dentro do limite base)
 *   4. Especial (dentro do limite especial)
 *   5. Premium (dentro do limite premium)
 *   6. Indisponível (fora de todos os limites)
 *
 * Unidades:
 *   - distanciaKm  → km
 *   - kmAdicionalNaRotaM → metros
 *   - config com sufixo M → metros
 *   - comparações internas usam METROS para evitar erro de unidade
 *
 * Não lança erros. Problemas são sinalizados via `motivos` e `avisos`.
 * Não muta o objeto de entrada.
 * Totalmente determinístico — sem I/O, sem logs.
 */
export function classificarCandidatoOperacionalV2(
  input: ClassificarCandidatoOperacionalV2Input
): ClassificacaoCandidatoOperacionalV2 {
  const motivos: string[] = []
  const avisos: string[] = []

  // ── 1. Validações bloqueantes ──────────────────────────────────────────────

  if (!input.equipe || typeof input.equipe !== 'string') {
    motivos.push('Equipe ausente ou inválida.')
    return resultado('indisponivel', false, motivos, avisos, input)
  }

  if (!input.ativa) {
    motivos.push('Equipe inativa.')
    if (input.motivoIndisponibilidade) {
      motivos.push(`Motivo: ${input.motivoIndisponibilidade}.`)
    }
    return resultado('indisponivel', false, motivos, avisos, input)
  }

  if (input.suficienteParaServico === false) {
    motivos.push('Tempo disponível insuficiente para o serviço.')
    return resultado('indisponivel', false, motivos, avisos, input)
  }

  if (input.tempoNecessarioMin === null || !Number.isFinite(input.tempoNecessarioMin)) {
    motivos.push('Tempo necessário ausente ou inválido.')
    return resultado('indisponivel', false, motivos, avisos, input)
  }

  if (input.distanciaKm === null || !Number.isFinite(input.distanciaKm)) {
    motivos.push('Distância ausente ou inválida.')
    return resultado('indisponivel', false, motivos, avisos, input)
  }

  if (input.ehDomingo) {
    motivos.push('Domingo não elegível para atendimento.')
    return resultado('indisponivel', false, motivos, avisos, input)
  }

  const kmAdicionalRaw = input.kmAdicionalNaRotaM
  const kmAdicionalM =
    kmAdicionalRaw !== undefined && kmAdicionalRaw !== null && Number.isFinite(kmAdicionalRaw)
      ? kmAdicionalRaw
      : null

  if (kmAdicionalM === null) {
    motivos.push('Distância adicional na rota ausente ou inválida.')
    return resultado('indisponivel', false, motivos, avisos, input)
  }

  // Validar config essencial (todos os limites são obrigatórios)
  const limiteBaseM = input.config.kmAdicionalMaxNaRotaM
  const limiteEspecialM = input.config.kmAdicionalMaxNaRotaEspecialM
  const limitePremiumM = input.config.kmAdicionalMaxNaRotaPremiumM
  const maxSemanaM = input.config.kmMaximoNaSemanaM
  const maxSabadoM = input.config.kmMaximoNoSabadoM

  if (
    limiteBaseM === null || !Number.isFinite(limiteBaseM) || limiteBaseM < 0 ||
    limiteEspecialM === null || !Number.isFinite(limiteEspecialM) || limiteEspecialM < 0 ||
    limitePremiumM === null || !Number.isFinite(limitePremiumM) || limitePremiumM < 0 ||
    maxSemanaM === null || !Number.isFinite(maxSemanaM) || maxSemanaM < 0 ||
    maxSabadoM === null || !Number.isFinite(maxSabadoM) || maxSabadoM < 0
  ) {
    motivos.push('Configuração de distância ausente ou inválida.')
    return resultado('indisponivel', false, motivos, avisos, input)
  }

  // ── 2. Validar limites máximos de semana/sábado ──────────────────────────
  // distanciaKm está em km; limites estão em METROS na config → converter km→m
  const distanciaM = input.distanciaKm * KM_PARA_METROS

  if (input.ehSabado) {
    if (maxSabadoM !== null && Number.isFinite(maxSabadoM) && distanciaM > maxSabadoM) {
      motivos.push('Distância acima do limite máximo de sábado.')
      return resultado('indisponivel', false, motivos, avisos, input)
    }
  } else {
    if (maxSemanaM !== null && Number.isFinite(maxSemanaM) && distanciaM > maxSemanaM) {
      motivos.push('Distância acima do limite máximo da semana.')
      return resultado('indisponivel', false, motivos, avisos, input)
    }
  }

  // ── 3. Avisos de condomínio/rural (não bloqueiam) ────────────────────────

  if (input.isCondominio) {
    avisos.push('Atendimento em condomínio informado.')
  }
  if (input.isRural) {
    avisos.push('Atendimento rural informado.')
  }

  // ── 4. Hora marcada ──────────────────────────────────────────────────────

  if (input.horaMarcada) {
    motivos.push('Atendimento classificado como hora marcada.')
    return resultado('hora-marcada', true, motivos, avisos, input)
  }

  // ── 5. Normal ────────────────────────────────────────────────────────────

  if (kmAdicionalM <= limiteBaseM) {
    return resultado('normal', true, motivos, avisos, input)
  }

  // ── 6. Especial ────────────────────────────────────────────────────────────

  if (kmAdicionalM <= limiteEspecialM) {
    return resultado('especial', true, motivos, avisos, input)
  }

  // ── 7. Premium ─────────────────────────────────────────────────────────────

  if (kmAdicionalM <= limitePremiumM) {
    return resultado('premium', true, motivos, avisos, input)
  }

  // ── 8. Fora de todos os limites ────────────────────────────────────────────

  motivos.push('Distância adicional fora dos limites configurados.')
  return resultado('indisponivel', false, motivos, avisos, input)
}

// ─── Helper interno ───────────────────────────────────────────────────────────

function resultado(
  tipo: TipoClassificacaoCandidatoV2,
  elegivel: boolean,
  motivos: string[],
  avisos: string[],
  input: ClassificarCandidatoOperacionalV2Input
): ClassificacaoCandidatoOperacionalV2 {
  return {
    tipo,
    elegivel,
    motivos: [...motivos],
    avisos: [...avisos],
    detalhes: {
      equipe: input.equipe,
      dataISO: input.dataISO,
      diaSemana: input.diaSemana,
      ehSabado: input.ehSabado,
      ehDomingo: input.ehDomingo,
      ativa: input.ativa,
      disponivelMin: input.disponivelMin,
      suficienteParaServico: input.suficienteParaServico,
      tempoNecessarioMin: input.tempoNecessarioMin,
      distanciaKm: input.distanciaKm,
      kmAdicionalNaRotaM:
        input.kmAdicionalNaRotaM !== undefined &&
        input.kmAdicionalNaRotaM !== null &&
        Number.isFinite(input.kmAdicionalNaRotaM)
          ? input.kmAdicionalNaRotaM
          : null,
    },
  }
}
