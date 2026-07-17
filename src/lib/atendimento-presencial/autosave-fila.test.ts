import { describe, expect, it, vi, type Mock } from 'vitest'
import { AutosaveSerialQueue, serializarPayloadAutosave, type AutosavePayload, type AutosaveSaveResult } from './autosave-fila'
import type { AtendimentoPresencialDTO } from './rascunhos-shared'

const payloadBase: AutosavePayload = {
  clienteId: 'cliente-1',
  dadosRascunho: {
    criancas: [],
    departamentos: ['p_pesada'],
    produtosInteresse: [],
    motivosResultado: [],
    etapaAtual: 'ficha',
  },
}

function rascunho(version: number, payload: AutosavePayload = payloadBase): AtendimentoPresencialDTO {
  return {
    id: 'rascunho-1',
    clienteId: payload.clienteId,
    consultoraUsuarioId: 'consultora-1',
    unidadeId: 'unidade-1',
    status: 'rascunho',
    draftClientId: 'draft-1',
    dadosRascunho: payload.dadosRascunho,
    resultadoAtendimento: null,
    motivoOutro: null,
    observacoes: null,
    numeroLancamento: null,
    concluidoEm: null,
    iniciadoEm: '2026-07-15T12:00:00.000Z',
    ultimaAtividadeEm: '2026-07-15T12:00:00.000Z',
    expiraEm: '2026-07-20T12:00:00.000Z',
    version,
    criadoPor: 'usuario-1',
    atualizadoPor: 'usuario-1',
    createdAt: '2026-07-15T12:00:00.000Z',
    updatedAt: '2026-07-15T12:00:00.000Z',
    expirado: false,
  }
}

function payloadComProduto(produto: string): AutosavePayload {
  return {
    ...payloadBase,
    dadosRascunho: {
      ...payloadBase.dadosRascunho,
      produtosInteresse: [produto],
    },
  }
}

function criarFila(params?: {
  save?: (params: { payload: AutosavePayload; expectedVersion: number }) => Promise<AutosaveSaveResult>
  online?: () => boolean
  onSaved?: Mock
  onConflict?: Mock
}) {
  const timers: Array<() => void> = []
  const status = vi.fn()
  const logs = vi.fn()
  const save = params?.save ?? vi.fn(async ({ payload, expectedVersion }) => ({
    ok: true as const,
    rascunho: rascunho(expectedVersion + 1, payload),
  }))

  const fila = new AutosaveSerialQueue({
    draftId: 'draft-1',
    initialVersion: 1,
    initialRascunho: rascunho(1),
    initialSavedPayload: JSON.stringify(payloadBase),
    debounceMs: 10,
    save,
    getOnline: params?.online ?? (() => true),
    onStatus: status,
    onSaved: params?.onSaved,
    onConflict: params?.onConflict,
    onLog: logs,
    setTimer: (callback) => {
      timers.push(callback)
      return callback as unknown as ReturnType<typeof setTimeout>
    },
    clearTimer: (timer) => {
      const index = timers.indexOf(timer as unknown as () => void)
      if (index >= 0) timers.splice(index, 1)
    },
  })

  return { fila, save: vi.mocked(save), timers, status, logs }
}

describe('fila serial de autosave presencial', () => {
  it('serializa resultado canonico e virada de cartao para detectar mudanca antes da conclusao', () => {
    const payload: AutosavePayload = {
      clienteId: 'cliente-1',
      dadosRascunho: {
        criancas: [],
        departamentos: ['p_pesada'],
        produtosInteresse: [],
        resultadoAtendimento: 'nao',
        motivosResultado: ['virada_cartao'],
        viradaCartaoDia: 20,
        viradaCartaoMes: 7,
        etapaAtual: 'revisao',
      },
    }

    expect(JSON.parse(serializarPayloadAutosave(payload))).toMatchObject({
      dadosRascunho: {
        resultadoAtendimento: 'nao',
        motivosResultado: ['virada_cartao'],
        viradaCartaoDia: 20,
        viradaCartaoMes: 7,
      },
    })
  })

  it('salva uma alteracao usando a versao inicial', async () => {
    const { fila, save } = criarFila()

    const result = await fila.flushNow(payloadComProduto('Carrinho'))

    expect(result.ok).toBe(true)
    expect(save).toHaveBeenCalledTimes(1)
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ expectedVersion: 1 }))
    expect(fila.getVersion()).toBe(2)
  })

  it('consolida dez alteracoes rapidas em um unico debounce com payload final', async () => {
    const { fila, save, timers } = criarFila()

    for (let index = 0; index < 10; index += 1) {
      fila.enqueue(payloadComProduto(`Produto ${index}`))
    }

    expect(timers).toHaveLength(1)
    await timers[0]()

    expect(save).toHaveBeenCalledTimes(1)
    expect(save).toHaveBeenCalledWith(expect.objectContaining({
      payload: payloadComProduto('Produto 9'),
    }))
  })

  it('enfileira alteracao durante PATCH e usa a versao retornada no segundo PATCH', async () => {
    let resolvePrimeiro: () => void = () => {
      throw new Error('resolver nao inicializado')
    }
    const save = vi.fn(({ payload, expectedVersion }: { payload: AutosavePayload; expectedVersion: number }) => {
      if (expectedVersion === 1) {
        return new Promise<AutosaveSaveResult>((resolve) => {
          resolvePrimeiro = () => resolve({ ok: true, rascunho: rascunho(2, payload) })
        })
      }
      return Promise.resolve({ ok: true as const, rascunho: rascunho(expectedVersion + 1, payload) })
    })
    const { fila } = criarFila({ save })

    const primeiro = fila.flushNow(payloadComProduto('Intermediario'))
    fila.enqueue(payloadComProduto('Final'))
    expect(save).toHaveBeenCalledTimes(1)

    resolvePrimeiro()
    await primeiro

    expect(save).toHaveBeenCalledTimes(2)
    expect(save).toHaveBeenLastCalledWith(expect.objectContaining({
      expectedVersion: 2,
      payload: payloadComProduto('Final'),
    }))
    expect(fila.getVersion()).toBe(3)
  })

  it('nao cria dois PATCH simultaneos', async () => {
    let chamadasEmAndamento = 0
    let maxSimultaneas = 0
    const save = vi.fn(async ({ payload, expectedVersion }: { payload: AutosavePayload; expectedVersion: number }) => {
      chamadasEmAndamento += 1
      maxSimultaneas = Math.max(maxSimultaneas, chamadasEmAndamento)
      await Promise.resolve()
      chamadasEmAndamento -= 1
      return { ok: true as const, rascunho: rascunho(expectedVersion + 1, payload) }
    })
    const { fila } = criarFila({ save })

    await Promise.all([
      fila.flushNow(payloadComProduto('A')),
      fila.flushNow(payloadComProduto('B')),
      fila.flushNow(payloadComProduto('C')),
    ])

    expect(maxSimultaneas).toBe(1)
    expect(save).toHaveBeenCalledTimes(2)
    expect(save).toHaveBeenLastCalledWith(expect.objectContaining({ payload: payloadComProduto('C') }))
  })

  it('resolve conflito falso quando servidor ja contem o mesmo payload', async () => {
    const payload = payloadComProduto('Ja salvo')
    const onSaved = vi.fn()
    const onConflict = vi.fn()
    const { fila, status } = criarFila({
      onSaved,
      onConflict,
      save: vi.fn(async () => ({
        ok: false as const,
        status: 409,
        message: 'Conflito de versao',
        rascunho: rascunho(6, payload),
      })),
    })

    const result = await fila.flushNow(payload)

    expect(result.ok).toBe(true)
    expect(fila.getVersion()).toBe(6)
    expect(onSaved).toHaveBeenCalled()
    expect(onConflict).not.toHaveBeenCalled()
    expect(status).toHaveBeenLastCalledWith('salvo')
  })

  it('mantem conflito real sem retry automatico', async () => {
    const onConflict = vi.fn()
    const { fila, save, status } = criarFila({
      onConflict,
      save: vi.fn(async () => ({
        ok: false as const,
        status: 409,
        message: 'Conflito de versao',
        rascunho: rascunho(6, payloadComProduto('Servidor')),
      })),
    })

    const result = await fila.flushNow(payloadComProduto('Local'))
    fila.enqueue(payloadComProduto('Nova tentativa'))

    expect(result).toMatchObject({ ok: false, status: 'conflito' })
    expect(save).toHaveBeenCalledTimes(1)
    expect(onConflict).toHaveBeenCalledWith(expect.objectContaining({ payloadIgual: false }))
    expect(status).toHaveBeenLastCalledWith('conflito')
  })

  it('bloqueia conclusao offline sem consumir a versao', async () => {
    const { fila, save, status } = criarFila({ online: () => false })

    const result = await fila.flushNow(payloadComProduto('Offline'))

    expect(result).toMatchObject({ ok: false, status: 'offline' })
    expect(save).not.toHaveBeenCalled()
    expect(fila.getVersion()).toBe(1)
    expect(status).toHaveBeenLastCalledWith('offline')
  })
})
