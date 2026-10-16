import type { AtendimentoPresencialDTO } from './rascunhos-shared'
import type { FichaDadosRascunho } from './ficha-schema'

export type AutosaveStatus = 'alterado' | 'aguardando' | 'salvando' | 'salvo' | 'offline' | 'erro' | 'conflito'

export type AutosavePayload = {
  dadosRascunho: FichaDadosRascunho
  clienteId: string | null
}

export type AutosaveSaveResult =
  | { ok: true; rascunho: AtendimentoPresencialDTO }
  | { ok: false; status: 409; message: string; rascunho: AtendimentoPresencialDTO | null }
  | { ok: false; status: number; message: string; rascunho?: AtendimentoPresencialDTO | null }

type AutosaveQueueOptions = {
  draftId: string
  initialVersion: number
  initialRascunho: AtendimentoPresencialDTO
  initialSavedPayload: string
  recoveryBases?: string[]
  debounceMs?: number
  save: (params: { payload: AutosavePayload; expectedVersion: number }) => Promise<AutosaveSaveResult>
  onStatus?: (status: AutosaveStatus) => void
  onSaved?: (params: { payload: AutosavePayload; payloadSerializado: string; rascunho: AtendimentoPresencialDTO }) => void
  onConflict?: (params: { payload: AutosavePayload; servidor: AtendimentoPresencialDTO | null; payloadIgual: boolean }) => void
  onLog?: (message: string) => void
  getOnline?: () => boolean
  setTimer?: (callback: () => void, delay: number) => ReturnType<typeof setTimeout>
  clearTimer?: (timer: ReturnType<typeof setTimeout>) => void
}

export function serializarPayloadAutosave(payload: AutosavePayload) {
  // JSONB nao preserva a ordem das chaves, inclusive dentro das criancas e inputs.
  function ordenar(valor: unknown): unknown {
    if (Array.isArray(valor)) return valor.map(ordenar)
    if (valor && typeof valor === 'object') return Object.fromEntries(Object.entries(valor).sort(([a], [b]) => a.localeCompare(b)).map(([chave, item]) => [chave, ordenar(item)]))
    return valor
  }
  const dados = payload.dadosRascunho
  return JSON.stringify(ordenar({
    dadosRascunho: {
      versaoFluxo: dados.versaoFluxo,
      tipoAtendimento: dados.tipoAtendimento,
      motivoVisita: dados.motivoVisita,
      observacaoNaoFechamento: dados.observacaoNaoFechamento,
      entradasFormulario: dados.entradasFormulario,
      cliente: dados.cliente,
      consultoraNome: dados.consultoraNome,
      criancas: dados.criancas,
      departamentos: dados.departamentos,
      produtosInteresse: dados.produtosInteresse,
      resultadoAtendimento: dados.resultadoAtendimento,
      motivosResultado: dados.motivosResultado,
      lojasMotivos: dados.lojasMotivos,
      motivoOutro: dados.motivoOutro,
      viradaCartaoDia: dados.viradaCartaoDia,
      viradaCartaoMes: dados.viradaCartaoMes,
      observacoes: dados.observacoes,
      etapaAtual: dados.etapaAtual,
      notaTecnica: dados.notaTecnica,
    },
    clienteId: payload.clienteId,
  }))
}

export function payloadAutosaveIgual(a: AutosavePayload, b: AutosavePayload) {
  return serializarPayloadAutosave(a) === serializarPayloadAutosave(b)
}

export class AutosaveSerialQueue {
  private readonly draftId: string
  private readonly debounceMs: number
  private readonly save: AutosaveQueueOptions['save']
  private readonly onStatus: NonNullable<AutosaveQueueOptions['onStatus']>
  private readonly onSaved?: AutosaveQueueOptions['onSaved']
  private readonly onConflict?: AutosaveQueueOptions['onConflict']
  private readonly onLog?: AutosaveQueueOptions['onLog']
  private readonly getOnline: NonNullable<AutosaveQueueOptions['getOnline']>
  private readonly setTimer: NonNullable<AutosaveQueueOptions['setTimer']>
  private readonly clearTimer: NonNullable<AutosaveQueueOptions['clearTimer']>

  private currentVersion: number
  private currentRascunho: AtendimentoPresencialDTO
  private lastSavedPayload: string
  private latestPayload: AutosavePayload | null = null
  private timer: ReturnType<typeof setTimeout> | null = null
  private saveInFlight = false
  private processing: Promise<{ ok: true; rascunho: AtendimentoPresencialDTO } | { ok: false; status: AutosaveStatus; message: string }> | null = null
  private pendingSave = false
  private stopped = false
  private conflict = false
  private retryTimer: ReturnType<typeof setTimeout> | null = null
  private retryCount = 0
  private envioSemConfirmacao: string | null = null
  private payloadEmEnvio: string | null = null
  private recoveryBases: string[]

  getBasesRecuperacao() {
    return [...new Set([this.lastSavedPayload, this.payloadEmEnvio, this.envioSemConfirmacao, ...this.recoveryBases].filter((payload): payload is string => payload !== null))]
  }

  hasPending() {
    return this.saveInFlight || this.pendingSave || this.conflict
  }

  constructor(options: AutosaveQueueOptions) {
    this.recoveryBases = options.recoveryBases ?? []
    this.draftId = options.draftId
    this.currentVersion = options.initialVersion
    this.currentRascunho = options.initialRascunho
    this.lastSavedPayload = options.initialSavedPayload
    this.debounceMs = options.debounceMs ?? 900
    this.save = options.save
    this.onStatus = options.onStatus ?? (() => undefined)
    this.onSaved = options.onSaved
    this.onConflict = options.onConflict
    this.onLog = options.onLog
    this.getOnline = options.getOnline ?? (() => true)
    this.setTimer = options.setTimer ?? ((callback, delay) => setTimeout(callback, delay))
    this.clearTimer = options.clearTimer ?? ((timer) => clearTimeout(timer))
  }

  getVersion() {
    return this.currentVersion
  }

  getRascunho() {
    return this.currentRascunho
  }

  getLastSavedPayload() {
    return this.lastSavedPayload
  }

  setLastSavedPayload(payloadSerializado: string) {
    this.lastSavedPayload = payloadSerializado
  }

  stop() {
    this.stopped = true
    this.cancelDebounce()
    this.cancelRetry()
  }

  resume() {
    if (!this.conflict) this.stopped = false
  }

  cancelDebounce() {
    if (!this.timer) return
    this.clearTimer(this.timer)
    this.timer = null
  }

  enqueue(payload: AutosavePayload) {
    this.latestPayload = payload
    if (this.stopped || this.conflict) return
    const payloadSerializado = serializarPayloadAutosave(payload)
    this.cancelDebounce()
    this.cancelRetry()
    this.retryCount = 0
    this.pendingSave = this.saveInFlight || payloadSerializado !== this.lastSavedPayload
    if (!this.pendingSave) {
      this.onStatus('salvo')
      return
    }
    this.onStatus(this.getOnline() ? 'salvando' : 'offline')
    if (this.saveInFlight) return
    this.timer = this.setTimer(() => {
      this.timer = null
      void this.processarFilaAutosave()
    }, this.debounceMs)
  }

  async flushNow(payload?: AutosavePayload) {
    if (payload) {
      this.latestPayload = payload
      if (serializarPayloadAutosave(payload) !== this.lastSavedPayload) this.pendingSave = true
    }
    this.cancelDebounce()
    this.cancelRetry()
    this.retryCount = 0
    return this.processarFilaAutosave()
  }

  private cancelRetry() {
    if (this.retryTimer !== null) this.clearTimer(this.retryTimer)
    this.retryTimer = null
  }

  private falhar(message: string, transient: boolean) {
    this.pendingSave = true
    const status: AutosaveStatus = this.getOnline() ? 'erro' : 'offline'
    this.onStatus(status)
    this.onLog?.(`[AUTOSAVE] falha draft=${this.draftId.slice(0, 8)} retry=${this.retryCount}`)
    if (transient && this.getOnline() && !this.stopped && this.retryCount < 2) {
      const delay = [1000, 3000][this.retryCount++]
      this.retryTimer = this.setTimer(() => {
        this.retryTimer = null
        void this.processarFilaAutosave()
      }, delay)
    }
    return { ok: false as const, status, message }
  }

  private processarFilaAutosave(): Promise<{ ok: true; rascunho: AtendimentoPresencialDTO } | { ok: false; status: AutosaveStatus; message: string }> {
    if (this.processing) return this.processing
    this.processing = this.executarFilaAutosave().finally(() => {
      this.processing = null
    })
    return this.processing
  }

  private async executarFilaAutosave(): Promise<{ ok: true; rascunho: AtendimentoPresencialDTO } | { ok: false; status: AutosaveStatus; message: string }> {
    if (this.conflict) return { ok: false, status: 'conflito', message: 'Conflito de versao. Revise as alteracoes locais antes de continuar.' }
    if (this.stopped) return { ok: false, status: 'erro', message: 'Salvamento interrompido. Alteracoes locais ainda pendentes.' }
    while (!this.stopped && !this.conflict && this.pendingSave) {
      if (!this.latestPayload) {
        this.pendingSave = false
        break
      }

      const payload = this.latestPayload
      const payloadSerializado = serializarPayloadAutosave(payload)
      if (payloadSerializado === this.lastSavedPayload) {
        this.pendingSave = false
        break
      }

      if (!this.getOnline()) {
        this.onStatus('offline')
        return { ok: false, status: 'offline', message: 'Sem conexao' }
      }

      this.pendingSave = false
      this.saveInFlight = true
      this.payloadEmEnvio = payloadSerializado
      const expectedVersion = this.currentVersion
      this.onStatus('salvando')
      this.onLog?.(`[AUTOSAVE] inicio draft=${this.draftId.slice(0, 8)} expectedVersion=${expectedVersion}`)

      try {
        const result = await this.save({ payload, expectedVersion })
        this.saveInFlight = false
        this.payloadEmEnvio = null

        if (result.ok) {
          this.recoveryBases = []
          this.envioSemConfirmacao = null
          this.currentVersion = result.rascunho.version
          this.currentRascunho = result.rascunho
          this.lastSavedPayload = serializarPayloadAutosave({ dadosRascunho: result.rascunho.dadosRascunho, clienteId: result.rascunho.clienteId })
          this.retryCount = 0
          this.pendingSave = !!this.latestPayload && serializarPayloadAutosave(this.latestPayload) !== this.lastSavedPayload
          // O servidor pode normalizar o payload. Nao repetir indefinidamente o mesmo envio.
          if (this.latestPayload === payload && this.pendingSave) {
            this.onSaved?.({ payload, payloadSerializado: this.lastSavedPayload, rascunho: result.rascunho })
            return this.falhar('O servidor nao confirmou todos os campos enviados. Revise os dados.', false)
          }
          this.onLog?.(`[AUTOSAVE] sucesso draft=${this.draftId.slice(0, 8)} novaVersion=${result.rascunho.version} pending=${this.pendingSave}`)
          this.onSaved?.({ payload, payloadSerializado, rascunho: result.rascunho })
          if (this.pendingSave) this.onStatus('salvando')
          continue
        }

        if (result.status === 409) {
          const payloadServidor = result.rascunho
            ? serializarPayloadAutosave({
              dadosRascunho: result.rascunho.dadosRascunho,
              clienteId: result.rascunho.clienteId,
            })
            : null
          const payloadIgual = payloadServidor === payloadSerializado
          // Uma resposta perdida pode ter confirmado o envio anterior desta fila.
          // So rebasear quando o servidor ainda contem nossa ultima base confirmada.
          const servidorNaBase = result.rascunho && result.rascunho.version > this.currentVersion
            && (payloadServidor === this.lastSavedPayload || payloadServidor === this.envioSemConfirmacao
              || (payloadServidor !== null && this.recoveryBases.includes(payloadServidor)))
          this.onLog?.(`[AUTOSAVE] conflito draft=${this.draftId.slice(0, 8)} serverVersion=${result.rascunho?.version ?? 'n/a'} payloadIgual=${payloadIgual}`)
          this.cancelDebounce()
          if ((payloadIgual || servidorNaBase) && result.rascunho) {
            this.envioSemConfirmacao = null
            this.currentVersion = result.rascunho.version
            this.currentRascunho = result.rascunho
            this.lastSavedPayload = payloadServidor!
            this.retryCount = 0
            this.pendingSave = !!this.latestPayload && serializarPayloadAutosave(this.latestPayload) !== this.lastSavedPayload
            if (payloadIgual) this.onSaved?.({ payload, payloadSerializado, rascunho: result.rascunho })
            if (this.pendingSave) this.onStatus('salvando')
            continue
          }
          this.conflict = true
          this.stopped = true
          this.onStatus('conflito')
          this.pendingSave = true
          this.onConflict?.({ payload: this.latestPayload ?? payload, servidor: result.rascunho ?? null, payloadIgual })
          return { ok: false, status: 'conflito', message: result.message }
        }

        if (result.status >= 500 || result.status === 408) this.envioSemConfirmacao = payloadSerializado
        return this.falhar(result.message, result.status >= 500 || result.status === 408 || result.status === 429)
      } catch (error) {
        this.payloadEmEnvio = null
        this.envioSemConfirmacao = payloadSerializado
        this.saveInFlight = false
        return this.falhar(error instanceof Error ? error.message : 'Erro ao salvar', true)
      }
    }

    if (this.pendingSave || this.conflict) return { ok: false, status: 'erro', message: 'Existem alteracoes ainda nao confirmadas.' }
    if (!this.stopped) this.onStatus('salvo')
    return { ok: true, rascunho: this.currentRascunho }
  }
}
