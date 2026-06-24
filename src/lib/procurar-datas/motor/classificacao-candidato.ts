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
  horaMarcadaHorasAMais?: number | null
}

/** Entrada para classificação de um cenário operacional. */
export interface ClassificarCandidatoOperacionalV2Input {
  dataISO: string
  diaSemana: number
  ehSabado: boolean
  ehDomingo: boolean
  slotTemPontos?: boolean

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
  horaMarcada?: boolean
  elegivelHoraMarcada?: boolean
  motivos: string[]
  avisos: string[]
  detalhes: {
    equipe: string
    dataISO: string
    diaSemana: number
    ehSabado: boolean
    ehDomingo: boolean
    slotTemPontos: boolean
    ativa: boolean
    disponivelMin: number
    suficienteParaServico: boolean
    tempoNecessarioMin: number | null
    distanciaKm: number | null
    kmAdicionalNaRotaM: number | null
    limiteBaseM: number | null
    limiteEspecialM: number | null
    limitePremiumM: number | null
    horaMarcada?: boolean
    elegivelHoraMarcada?: boolean
    motivoHoraMarcada?: string | null
    slotAvailMin?: number | null
    serviceMin?: number | null
    horaMarcadaHorasAMais?: number | null
    limiteMinimoHoraMarcadaMin?: number | null
    horaMarcadaCalculadaPorTempo?: boolean
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

  // distanciaKm é opcional para equivalência com legado
  // Legado usa apenas bestKm (kmAdicionalNaRotaM) para classificar normal/especial/premium
  // Se distanciaKm estiver ausente, avisa mas não bloqueia (continua com kmAdicionalNaRotaM)
  if (input.distanciaKm === null || !Number.isFinite(input.distanciaKm)) {
    avisos.push('Distância base (origem → destino) ausente. Classificação baseada apenas em km adicional de rota.')
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
  const kmAdicionalMaxNaRotaM = input.config.kmAdicionalMaxNaRotaM
  const guardaEspecialM = input.config.kmAdicionalMaxNaRotaEspecialM
  const guardaPremiumM = input.config.kmAdicionalMaxNaRotaPremiumM
  const maxSemanaM = input.config.kmMaximoNaSemanaM
  const maxSabadoM = input.config.kmMaximoNoSabadoM

  if (
    kmAdicionalMaxNaRotaM === null || !Number.isFinite(kmAdicionalMaxNaRotaM) || kmAdicionalMaxNaRotaM < 0 ||
    guardaEspecialM === null || !Number.isFinite(guardaEspecialM) || guardaEspecialM < 0 ||
    guardaPremiumM === null || !Number.isFinite(guardaPremiumM) || guardaPremiumM < 0 ||
    maxSemanaM === null || !Number.isFinite(maxSemanaM) || maxSemanaM < 0 ||
    maxSabadoM === null || !Number.isFinite(maxSabadoM) || maxSabadoM < 0
  ) {
    motivos.push('Configuração de distância ausente ou inválida.')
    return resultado('indisponivel', false, motivos, avisos, input)
  }

  const slotTemPontos = input.slotTemPontos ?? true
  const limiteBaseM = slotTemPontos
    ? kmAdicionalMaxNaRotaM
    : input.ehSabado
      ? maxSabadoM
      : maxSemanaM
  const limiteEspecialM = limiteBaseM + 5000
  const limitePremiumM = limiteBaseM + 10000

  // ── 2. Validação de limites máximos de semana/sábado (apenas se distanciaKm disponível)
  // Legado não valida isso antes da classificação normal/especial/premium
  // Esta validação só é aplicada se distanciaKm estiver disponível
  if (input.distanciaKm !== null && Number.isFinite(input.distanciaKm)) {
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
  }

  // ── 3. Avisos de condomínio/rural (não bloqueiam) ────────────────────────

  if (input.isCondominio) {
    avisos.push('Atendimento em condomínio informado.')
  }
  if (input.isRural) {
    avisos.push('Atendimento rural informado.')
  }

  // ── 4. Hora marcada ──────────────────────────────────────────────────────

  // Hora marcada e calculada como flag diagnostica nao exclusiva em resultado().

  // ── 5. Normal ────────────────────────────────────────────────────────────

  if (kmAdicionalM <= limiteBaseM) {
    return resultado('normal', true, motivos, avisos, input)
  }

  // ── 6. Especial ────────────────────────────────────────────────────────────

  if (guardaEspecialM > 0 && kmAdicionalM <= limiteEspecialM) {
    return resultado('especial', true, motivos, avisos, input)
  }

  // ── 7. Premium ─────────────────────────────────────────────────────────────

  if (guardaPremiumM > 0 && kmAdicionalM <= limitePremiumM) {
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
  const limites = calcularLimitesDiagnosticos(input)
  const kmAdicionalNaRotaM =
    input.kmAdicionalNaRotaM !== undefined &&
    input.kmAdicionalNaRotaM !== null &&
    Number.isFinite(input.kmAdicionalNaRotaM)
      ? input.kmAdicionalNaRotaM
      : null
  const horaMarcada = calcularHoraMarcadaDiagnostico(
    input,
    limites.limiteBaseM,
    kmAdicionalNaRotaM,
    tipo,
    elegivel
  )

  return {
    tipo,
    elegivel,
    horaMarcada: horaMarcada.elegivelHoraMarcada,
    elegivelHoraMarcada: horaMarcada.elegivelHoraMarcada,
    motivos: [...motivos],
    avisos: [...avisos],
    detalhes: {
      equipe: input.equipe,
      dataISO: input.dataISO,
      diaSemana: input.diaSemana,
      ehSabado: input.ehSabado,
      ehDomingo: input.ehDomingo,
      slotTemPontos: input.slotTemPontos ?? true,
      ativa: input.ativa,
      disponivelMin: input.disponivelMin,
      suficienteParaServico: input.suficienteParaServico,
      tempoNecessarioMin: input.tempoNecessarioMin,
      distanciaKm: input.distanciaKm,
      kmAdicionalNaRotaM,
      limiteBaseM: limites.limiteBaseM,
      limiteEspecialM: limites.limiteEspecialM,
      limitePremiumM: limites.limitePremiumM,
      horaMarcada: horaMarcada.elegivelHoraMarcada,
      elegivelHoraMarcada: horaMarcada.elegivelHoraMarcada,
      motivoHoraMarcada: horaMarcada.motivoHoraMarcada,
      slotAvailMin: horaMarcada.slotAvailMin,
      serviceMin: horaMarcada.serviceMin,
      horaMarcadaHorasAMais: horaMarcada.horaMarcadaHorasAMais,
      limiteMinimoHoraMarcadaMin: horaMarcada.limiteMinimoHoraMarcadaMin,
      horaMarcadaCalculadaPorTempo: horaMarcada.horaMarcadaCalculadaPorTempo,
    },
  }
}

function calcularHoraMarcadaDiagnostico(
  input: ClassificarCandidatoOperacionalV2Input,
  limiteBaseM: number | null,
  kmAdicionalNaRotaM: number | null,
  tipo: TipoClassificacaoCandidatoV2,
  elegivel: boolean
): {
  elegivelHoraMarcada: boolean
  motivoHoraMarcada: string | null
  slotAvailMin: number | null
  serviceMin: number | null
  horaMarcadaHorasAMais: number | null
  limiteMinimoHoraMarcadaMin: number | null
  horaMarcadaCalculadaPorTempo: boolean
} {
  const slotAvailMin = Number.isFinite(input.disponivelMin) ? input.disponivelMin : null
  const serviceMin =
    input.tempoNecessarioMin !== null && Number.isFinite(input.tempoNecessarioMin)
      ? input.tempoNecessarioMin
      : null
  const horasAMais = input.config.horaMarcadaHorasAMais
  const horaMarcadaHorasAMais =
    typeof horasAMais === 'number' && Number.isFinite(horasAMais) ? horasAMais : null
  const limiteMinimoHoraMarcadaMin =
    serviceMin !== null && horaMarcadaHorasAMais !== null && horaMarcadaHorasAMais > 0
      ? serviceMin + horaMarcadaHorasAMais * 60
      : null

  if (horaMarcadaHorasAMais === null) {
    return {
      elegivelHoraMarcada: false,
      motivoHoraMarcada: 'Config HORA MARCADA HORAS A MAIS ausente ou invalida.',
      slotAvailMin,
      serviceMin,
      horaMarcadaHorasAMais,
      limiteMinimoHoraMarcadaMin,
      horaMarcadaCalculadaPorTempo: false,
    }
  }

  if (horaMarcadaHorasAMais <= 0) {
    return {
      elegivelHoraMarcada: false,
      motivoHoraMarcada: 'HORA MARCADA HORAS A MAIS menor ou igual a zero no legado nao ativa hora marcada.',
      slotAvailMin,
      serviceMin,
      horaMarcadaHorasAMais,
      limiteMinimoHoraMarcadaMin,
      horaMarcadaCalculadaPorTempo: false,
    }
  }

  if (slotAvailMin === null || serviceMin === null || limiteMinimoHoraMarcadaMin === null) {
    return {
      elegivelHoraMarcada: false,
      motivoHoraMarcada: 'Tempo disponivel ou tempo necessario ausente para hora marcada.',
      slotAvailMin,
      serviceMin,
      horaMarcadaHorasAMais,
      limiteMinimoHoraMarcadaMin,
      horaMarcadaCalculadaPorTempo: false,
    }
  }

  if (limiteBaseM === null || kmAdicionalNaRotaM === null) {
    return {
      elegivelHoraMarcada: false,
      motivoHoraMarcada: 'Limite normal ou km adicional ausente para hora marcada.',
      slotAvailMin,
      serviceMin,
      horaMarcadaHorasAMais,
      limiteMinimoHoraMarcadaMin,
      horaMarcadaCalculadaPorTempo: false,
    }
  }

  if (kmAdicionalNaRotaM > limiteBaseM) {
    return {
      elegivelHoraMarcada: false,
      motivoHoraMarcada: 'Km adicional fora do limite normal para hora marcada.',
      slotAvailMin,
      serviceMin,
      horaMarcadaHorasAMais,
      limiteMinimoHoraMarcadaMin,
      horaMarcadaCalculadaPorTempo: false,
    }
  }

  if (slotAvailMin < limiteMinimoHoraMarcadaMin) {
    return {
      elegivelHoraMarcada: false,
      motivoHoraMarcada: 'Tempo disponivel insuficiente para hora marcada.',
      slotAvailMin,
      serviceMin,
      horaMarcadaHorasAMais,
      limiteMinimoHoraMarcadaMin,
      horaMarcadaCalculadaPorTempo: false,
    }
  }

  // Cálculo bruto de tempo indica janela suficiente
  const horaMarcadaCalculadaPorTempo = true

  // Bloquear hora marcada se candidato for indisponível
  if (tipo === 'indisponivel' || !elegivel) {
    return {
      elegivelHoraMarcada: false,
      motivoHoraMarcada: 'Candidato indisponivel; hora marcada final bloqueada.',
      slotAvailMin,
      serviceMin,
      horaMarcadaHorasAMais,
      limiteMinimoHoraMarcadaMin,
      horaMarcadaCalculadaPorTempo,
    }
  }

  return {
    elegivelHoraMarcada: true,
    motivoHoraMarcada: null,
    slotAvailMin,
    serviceMin,
    horaMarcadaHorasAMais,
    limiteMinimoHoraMarcadaMin,
    horaMarcadaCalculadaPorTempo,
  }
}

function calcularLimitesDiagnosticos(input: ClassificarCandidatoOperacionalV2Input): {
  limiteBaseM: number | null
  limiteEspecialM: number | null
  limitePremiumM: number | null
} {
  const baseRotaM = input.config.kmAdicionalMaxNaRotaM
  const maxSemanaM = input.config.kmMaximoNaSemanaM
  const maxSabadoM = input.config.kmMaximoNoSabadoM

  if (
    baseRotaM === null || !Number.isFinite(baseRotaM) || baseRotaM < 0 ||
    maxSemanaM === null || !Number.isFinite(maxSemanaM) || maxSemanaM < 0 ||
    maxSabadoM === null || !Number.isFinite(maxSabadoM) || maxSabadoM < 0
  ) {
    return { limiteBaseM: null, limiteEspecialM: null, limitePremiumM: null }
  }

  const slotTemPontos = input.slotTemPontos ?? true
  const limiteBaseM = slotTemPontos
    ? baseRotaM
    : input.ehSabado
      ? maxSabadoM
      : maxSemanaM

  return {
    limiteBaseM,
    limiteEspecialM: limiteBaseM + 5000,
    limitePremiumM: limiteBaseM + 10000,
  }
}
