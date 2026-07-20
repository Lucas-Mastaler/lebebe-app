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
  const dados = payload.dadosRascunho
  return JSON.stringify({
    dadosRascunho: {
      cliente: dados.cliente,
      consultoraNome: dados.consultoraNome,
      criancas: dados.criancas,
      departamentos: dados.departamentos,
      produtosInteresse: dados.produtosInteresse,
      resultadoAtendimento: dados.resultadoAtendimento,
      motivosResultado: dados.motivosResultado,
      motivoOutro: dados.motivoOutro,
      viradaCartaoDia: dados.viradaCartaoDia,
      viradaCartaoMes: dados.viradaCartaoMes,
      observacoes: dados.observacoes,
      etapaAtual: dados.etapaAtual,
      notaTecnica: dados.notaTecnica,
    },
    clienteId: payload.clienteId,
  })
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

  constructor(options: AutosaveQueueOptions) {
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
    if (this.stopped || this.conflict) return
    this.latestPayload = payload
    const payloadSerializado = serializarPayloadAutosave(payload)
    if (payloadSerializado === this.lastSavedPayload) {
      this.onStatus('salvo')
      return
    }
    this.pendingSave = true
    this.onStatus(this.getOnline() ? 'aguardando' : 'offline')
    this.cancelDebounce()
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
    return this.processarFilaAutosave()
  }

  private processarFilaAutosave(): Promise<{ ok: true; rascunho: AtendimentoPresencialDTO } | { ok: false; status: AutosaveStatus; message: string }> {
    if (this.processing) return this.processing
    this.processing = this.executarFilaAutosave().finally(() => {
      this.processing = null
    })
    return this.processing
  }

  private async executarFilaAutosave(): Promise<{ ok: true; rascunho: AtendimentoPresencialDTO } | { ok: false; status: AutosaveStatus; message: string }> {
    while (!this.stopped && !this.conflict && this.pendingSave) {
      if (!this.latestPayload) {
        this.pendingSave = false
        break
      }

      const payload = this.latestPayload
      const payloadSerializado = serializarPayloadAutosave(payload)
      if (payloadSerializado === this.lastSavedPayload) {
        this.pendingSave = false
        this.onStatus('salvo')
        break
      }

      if (!this.getOnline()) {
        this.onStatus('offline')
        return { ok: false, status: 'offline', message: 'Sem conexao' }
      }

      this.pendingSave = false
      this.saveInFlight = true
      const expectedVersion = this.currentVersion
      this.onStatus('salvando')
      this.onLog?.(`[AUTOSAVE] inicio draft=${this.draftId.slice(0, 8)} expectedVersion=${expectedVersion}`)

      try {
        const result = await this.save({ payload, expectedVersion })
        this.saveInFlight = false

        if (result.ok) {
          this.currentVersion = result.rascunho.version
          this.currentRascunho = result.rascunho
          this.lastSavedPayload = payloadSerializado
          this.onLog?.(`[AUTOSAVE] sucesso draft=${this.draftId.slice(0, 8)} novaVersion=${result.rascunho.version} pending=${this.pendingSave}`)
          this.onSaved?.({ payload, payloadSerializado, rascunho: result.rascunho })
          this.onStatus(this.pendingSave ? 'aguardando' : 'salvo')
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
          this.onLog?.(`[AUTOSAVE] conflito draft=${this.draftId.slice(0, 8)} serverVersion=${result.rascunho?.version ?? 'n/a'} payloadIgual=${payloadIgual}`)
          this.cancelDebounce()
          this.pendingSave = false
          if (payloadIgual && result.rascunho) {
            this.currentVersion = result.rascunho.version
            this.currentRascunho = result.rascunho
            this.lastSavedPayload = payloadSerializado
            this.onSaved?.({ payload, payloadSerializado, rascunho: result.rascunho })
            this.onStatus('salvo')
            return { ok: true, rascunho: result.rascunho }
          }
          this.conflict = true
          this.stopped = true
          this.onStatus('conflito')
          this.onConflict?.({ payload, servidor: result.rascunho ?? null, payloadIgual })
          return { ok: false, status: 'conflito', message: result.message }
        }

        this.onStatus('erro')
        return { ok: false, status: 'erro', message: result.message }
      } catch (error) {
        this.saveInFlight = false
        const offline = !this.getOnline()
        this.onStatus(offline ? 'offline' : 'erro')
        return {
          ok: false,
          status: offline ? 'offline' : 'erro',
          message: error instanceof Error ? error.message : 'Erro ao salvar',
        }
      }
    }

    return { ok: true, rascunho: this.currentRascunho }
  }
}
