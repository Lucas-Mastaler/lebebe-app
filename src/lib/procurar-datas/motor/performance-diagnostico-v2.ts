export type TipoUsoOsrmPerformanceV2 =
  | 'matriz-table'
  | 'deposito-destino'
  | 'rota-base'
  | 'delta-insercao'
  | 'fallback-publico'
  | 'outro'

export type StatusOsrmPerformanceV2 = 'sucesso' | 'erro' | 'timeout' | 'fallback'

export type EtapaPerformanceV2 =
  | 'rota-pesquisar-compat-async'
  | 'orquestrador'
  | 'pesquisar-datas-v2'
  | 'adaptador-payload-legado'
  | 'frete-dist-km-deposito-destino'
  | 'config'
  | 'janela-datas'
  | 'agenda-disponibilidade'
  | 'geocodificacao-cache'
  | 'mapa-km-adicional-slots'
  | 'geracao-candidatos'
  | 'recorte'
  | 'redis-progresso'
  | 'osrm-total'

export interface RegistroEtapaPerformanceV2 {
  nome: EtapaPerformanceV2 | string
  duracaoMs: number
}

export interface ResumoOsrmPorTipoPerformanceV2 {
  total: number
  sucesso: number
  erro: number
  timeout: number
  fallback: number
  tempoTotalMs: number
  tempoMedioMs: number | null
  tempoMinMs: number | null
  tempoMaxMs: number | null
  tempoP95Ms: number | null
}

export interface ContadoresPerformanceV2 {
  slotsAvaliados: number
  slotsComPontos: number
  slotsSemPontos: number
  slotsComKm: number
  slotsComFallbackHaversine: number
  candidatosAntesRecorte: number
  candidatosElegiveis: number
  candidatosFinais: number
  candidatosDescartadosPorMotivo: Record<string, number>
  candidatosPorTipoAntesRecorte: Record<string, number>
  candidatosPorTipoFinal: Record<string, number>
  buscaNormaisAntesRecorte: number
  buscaEspecialAntesRecorte: number
  buscaPremiumAntesRecorte: number
  buscaHoraMarcadaAntesRecorte: number
  extrasRemovidosPorDataPosterior: number
}

export interface DiagnosticoPerformanceV2 {
  habilitado: true
  versao: 1
  temposMs: Record<string, number>
  etapas: RegistroEtapaPerformanceV2[]
  osrm: {
    total: ResumoOsrmPorTipoPerformanceV2
    porTipo: Partial<Record<TipoUsoOsrmPerformanceV2, ResumoOsrmPorTipoPerformanceV2>>
    observacoes: string[]
  }
  contadores: ContadoresPerformanceV2
  cache: {
    hashesConsultados: number
    hitsSupabase: number
    enderecosSemHash: number
    observacao: string
  }
  fluxo: {
    pollingAguardaResultado: boolean
    postAguardaOrquestradorCompleto: boolean
    continuaDepoisDeTresNormaisEExtras: boolean | null
    horaMarcadaGeradaAntesRecorte: number
    janelaProcessadaInteira: boolean | null
    sleepsRetriesTimeoutsConfirmadosNoCodigo: string[]
  }
  tspMatriz: {
    usaOsrmTableMatriz: boolean
    deltaInsercaoUsaMatriz: boolean
    tspImplementado: false
    avaliacaoTecnica: string
    riscoEquivalenciaLegado: string
  }
}

type ChamadaOsrmPerformanceV2 = {
  tipo: TipoUsoOsrmPerformanceV2
  status: StatusOsrmPerformanceV2
  duracaoMs: number
}

function arredondarMs(ms: number): number {
  return Math.max(0, Math.round(ms))
}

function resumirChamadas(chamadas: ChamadaOsrmPerformanceV2[]): ResumoOsrmPorTipoPerformanceV2 {
  const duracoes = chamadas.map((c) => c.duracaoMs).sort((a, b) => a - b)
  const tempoTotalMs = duracoes.reduce((acc, v) => acc + v, 0)
  const p95Index = duracoes.length > 0 ? Math.ceil(duracoes.length * 0.95) - 1 : -1
  return {
    total: chamadas.length,
    sucesso: chamadas.filter((c) => c.status === 'sucesso').length,
    erro: chamadas.filter((c) => c.status === 'erro').length,
    timeout: chamadas.filter((c) => c.status === 'timeout').length,
    fallback: chamadas.filter((c) => c.status === 'fallback').length,
    tempoTotalMs,
    tempoMedioMs: duracoes.length > 0 ? Math.round(tempoTotalMs / duracoes.length) : null,
    tempoMinMs: duracoes.length > 0 ? duracoes[0] : null,
    tempoMaxMs: duracoes.length > 0 ? duracoes[duracoes.length - 1] : null,
    tempoP95Ms: p95Index >= 0 ? duracoes[p95Index] : null,
  }
}

function contarPorTipo<T extends { tipo: string }>(itens: T[]): Record<string, number> {
  const out: Record<string, number> = {}
  for (const item of itens) {
    out[item.tipo] = (out[item.tipo] ?? 0) + 1
  }
  return out
}

export class MedidorPerformanceV2 {
  private readonly inicioMs: number
  private readonly now: () => number
  private etapas: RegistroEtapaPerformanceV2[] = []
  private chamadasOsrm: ChamadaOsrmPerformanceV2[] = []
  private contadores: ContadoresPerformanceV2 = {
    slotsAvaliados: 0,
    slotsComPontos: 0,
    slotsSemPontos: 0,
    slotsComKm: 0,
    slotsComFallbackHaversine: 0,
    candidatosAntesRecorte: 0,
    candidatosElegiveis: 0,
    candidatosFinais: 0,
    candidatosDescartadosPorMotivo: {},
    candidatosPorTipoAntesRecorte: {},
    candidatosPorTipoFinal: {},
    buscaNormaisAntesRecorte: 0,
    buscaEspecialAntesRecorte: 0,
    buscaPremiumAntesRecorte: 0,
    buscaHoraMarcadaAntesRecorte: 0,
    extrasRemovidosPorDataPosterior: 0,
  }
  private cache = {
    hashesConsultados: 0,
    hitsSupabase: 0,
    enderecosSemHash: 0,
  }
  private janelaProcessadaInteira: boolean | null = null

  constructor(now: () => number = () => Date.now()) {
    this.now = now
    this.inicioMs = now()
  }

  medir<T>(nome: EtapaPerformanceV2 | string, fn: () => T): T {
    const inicio = this.now()
    try {
      return fn()
    } finally {
      this.registrarEtapa(nome, this.now() - inicio)
    }
  }

  async medirAsync<T>(nome: EtapaPerformanceV2 | string, fn: () => Promise<T>): Promise<T> {
    const inicio = this.now()
    try {
      return await fn()
    } finally {
      this.registrarEtapa(nome, this.now() - inicio)
    }
  }

  registrarEtapa(nome: EtapaPerformanceV2 | string, duracaoMs: number): void {
    this.etapas.push({ nome, duracaoMs: arredondarMs(duracaoMs) })
  }

  registrarOsrm(
    tipo: TipoUsoOsrmPerformanceV2,
    status: StatusOsrmPerformanceV2,
    duracaoMs: number
  ): void {
    this.chamadasOsrm.push({ tipo, status, duracaoMs: arredondarMs(duracaoMs) })
  }

  async medirOsrm<T>(
    tipo: TipoUsoOsrmPerformanceV2,
    fn: () => Promise<T>,
    classificar: (resultado: T) => StatusOsrmPerformanceV2 = () => 'sucesso'
  ): Promise<T> {
    const inicio = this.now()
    try {
      const resultado = await fn()
      this.registrarOsrm(tipo, classificar(resultado), this.now() - inicio)
      return resultado
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      const status = msg.toLowerCase().includes('timeout') ? 'timeout' : 'erro'
      this.registrarOsrm(tipo, status, this.now() - inicio)
      throw error
    }
  }

  registrarSlots(input: {
    slotsAvaliados: number
    slotsComPontos: number
    slotsSemPontos: number
    slotsComKm: number
    slotsComFallbackHaversine: number
  }): void {
    this.contadores.slotsAvaliados = input.slotsAvaliados
    this.contadores.slotsComPontos = input.slotsComPontos
    this.contadores.slotsSemPontos = input.slotsSemPontos
    this.contadores.slotsComKm = input.slotsComKm
    this.contadores.slotsComFallbackHaversine = input.slotsComFallbackHaversine
  }

  registrarCache(input: {
    hashesConsultados: number
    hitsSupabase: number
    enderecosSemHash: number
  }): void {
    this.cache = input
  }

  registrarCandidatosAntesRecorte(candidatos: Array<{ tipo: string; elegivel: boolean; elegivelHoraMarcada?: boolean }>): void {
    const porTipo = contarPorTipo(candidatos)
    this.contadores.candidatosAntesRecorte = candidatos.length
    this.contadores.candidatosElegiveis = candidatos.filter((c) => c.elegivel).length
    this.contadores.candidatosPorTipoAntesRecorte = porTipo
    this.contadores.buscaNormaisAntesRecorte = porTipo.normal ?? 0
    this.contadores.buscaEspecialAntesRecorte = porTipo.especial ?? 0
    this.contadores.buscaPremiumAntesRecorte = porTipo.premium ?? 0
    this.contadores.buscaHoraMarcadaAntesRecorte =
      (porTipo['hora-marcada'] ?? 0) + candidatos.filter((c) => c.elegivelHoraMarcada).length
  }

  registrarRecorte(input: {
    candidatosFinais: Array<{ tipo: string }>
    exclusoes: Array<{ motivo: string }>
    extrasRemovidosPorDataPosterior: number
  }): void {
    this.contadores.candidatosFinais = input.candidatosFinais.length
    this.contadores.candidatosPorTipoFinal = contarPorTipo(input.candidatosFinais)
    this.contadores.extrasRemovidosPorDataPosterior = input.extrasRemovidosPorDataPosterior
    const motivos: Record<string, number> = {}
    for (const exclusao of input.exclusoes) {
      motivos[exclusao.motivo] = (motivos[exclusao.motivo] ?? 0) + 1
    }
    this.contadores.candidatosDescartadosPorMotivo = motivos
  }

  registrarJanelaProcessadaInteira(valor: boolean): void {
    this.janelaProcessadaInteira = valor
  }

  finalizar(): DiagnosticoPerformanceV2 {
    const temposMs: Record<string, number> = {}
    for (const etapa of this.etapas) {
      temposMs[etapa.nome] = (temposMs[etapa.nome] ?? 0) + etapa.duracaoMs
    }
    const osrmTotal = resumirChamadas(this.chamadasOsrm)
    temposMs['osrm-total'] = osrmTotal.tempoTotalMs

    const porTipo: Partial<Record<TipoUsoOsrmPerformanceV2, ResumoOsrmPorTipoPerformanceV2>> = {}
    for (const tipo of new Set(this.chamadasOsrm.map((c) => c.tipo))) {
      porTipo[tipo] = resumirChamadas(this.chamadasOsrm.filter((c) => c.tipo === tipo))
    }

    return {
      habilitado: true,
      versao: 1,
      temposMs: {
        totalMedido: arredondarMs(this.now() - this.inicioMs),
        ...temposMs,
      },
      etapas: this.etapas,
      osrm: {
        total: osrmTotal,
        porTipo,
        observacoes: [
          'matriz-table conta chamadas HTTP OSRM /table executadas por slot com pontos suficientes.',
          'deposito-destino conta a chamada OSRM /route usada para frete legado.',
          'Fallback Haversine e contado por slot quando a origem do km adicional indica fallback.',
        ],
      },
      contadores: this.contadores,
      cache: {
        ...this.cache,
        observacao: 'Cache de coordenadas da agenda via resolverCacheCoordenadasAgendaDiagnostico.',
      },
      fluxo: {
        pollingAguardaResultado: false,
        postAguardaOrquestradorCompleto: true,
        continuaDepoisDeTresNormaisEExtras:
          this.contadores.candidatosAntesRecorte > this.contadores.candidatosFinais,
        horaMarcadaGeradaAntesRecorte: this.contadores.buscaHoraMarcadaAntesRecorte,
        janelaProcessadaInteira: this.janelaProcessadaInteira,
        sleepsRetriesTimeoutsConfirmadosNoCodigo: [
          'OSRM /table usa AbortController com timeoutMs=5000 e nao faz retry.',
          'OSRM /route deposito-destino usa AbortController com timeoutMs=10000 na rota compat async e nao faz retry.',
          'progresso-compat apenas le Redis; o POST salva done depois do orquestrador completo.',
        ],
      },
      tspMatriz: {
        usaOsrmTableMatriz: true,
        deltaInsercaoUsaMatriz: true,
        tspImplementado: false,
        avaliacaoTecnica:
          'O fluxo atual ja usa OSRM table para montar matriz de distancias por slot e calcula delta de insercao com essa matriz. TSP completo nao foi implementado; a rota base usa heuristica legado/2-opt em otimizarRotaBaseLegado antes do delta.',
        riscoEquivalenciaLegado:
          'Trocar a ordenacao por TSP/biblioteca externa pode mudar a regra operacional do legado. A frente segura e primeiro reduzir chamadas repetidas ou reaproveitar matrizes mantendo a mesma heuristica e o mesmo delta.',
      },
    }
  }
}

export function criarMedidorPerformanceV2(
  habilitado: boolean,
  now?: () => number
): MedidorPerformanceV2 | undefined {
  return habilitado ? new MedidorPerformanceV2(now) : undefined
}
