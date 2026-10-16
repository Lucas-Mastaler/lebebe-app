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

it('compara conteudo sem depender da ordem das chaves de JSONB', () => {
  const a: AutosavePayload = { ...payloadBase, dadosRascunho: { ...payloadBase.dadosRascunho, criancas: [{ id: 'crianca-teste', situacao: 'gestacao', nome: 'Maria', sexo: 'menina' }] } }
  const b: AutosavePayload = { ...a, dadosRascunho: { ...a.dadosRascunho, criancas: [{ sexo: 'menina', nome: 'Maria', situacao: 'gestacao', id: 'crianca-teste' }] } }
  expect(serializarPayloadAutosave(a)).toBe(serializarPayloadAutosave(b))
})

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
  recoveryBases?: string[]
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
    initialSavedPayload: serializarPayloadAutosave(payloadBase),
    recoveryBases: params?.recoveryBases,
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

it('salva alteracao isolada e remocao do nome da loja sem perder o outro complemento', async () => {
  const { fila, save } = criarFila()
  const comLojas: AutosavePayload = {
    ...payloadBase,
    dadosRascunho: { ...payloadBase.dadosRascunho, resultadoAtendimento: 'nao', motivosResultado: ['outra_loja_fisica', 'outra_loja_internet'], lojasMotivos: { outra_loja_fisica: 'Loja A', outra_loja_internet: 'Internet' } },
  }
  expect((await fila.flushNow(comLojas)).ok).toBe(true)
  const alterado: AutosavePayload = { ...comLojas, dadosRascunho: { ...comLojas.dadosRascunho, lojasMotivos: { outra_loja_fisica: 'Loja B', outra_loja_internet: 'Internet' } } }
  fila.enqueue(alterado)
  expect((await fila.flushNow()).ok).toBe(true)
  const removido: AutosavePayload = { ...alterado, dadosRascunho: { ...alterado.dadosRascunho, lojasMotivos: { outra_loja_internet: 'Internet' } } }
  fila.enqueue(removido)
  expect((await fila.flushNow()).ok).toBe(true)
  expect(save.mock.calls.map(([params]) => params.payload.dadosRascunho.lojasMotivos)).toEqual([
    comLojas.dadosRascunho.lojasMotivos,
    alterado.dadosRascunho.lojasMotivos,
    removido.dadosRascunho.lojasMotivos,
  ])
  const reordenado: AutosavePayload = { ...alterado, dadosRascunho: { ...alterado.dadosRascunho, lojasMotivos: { outra_loja_internet: 'Internet', outra_loja_fisica: 'Loja B' } } }
  expect(serializarPayloadAutosave(alterado)).toBe(serializarPayloadAutosave(reordenado))
})

it('reconcilia resposta perdida da propria aba antes de salvar a edicao seguinte', async () => {
  const a = payloadComProduto('Primeira edicao')
  const b = payloadComProduto('Segunda edicao')
  const save = vi.fn()
    .mockRejectedValueOnce(new Error('Resposta perdida'))
    .mockResolvedValueOnce({ ok: false, status: 409, message: 'Versao', rascunho: rascunho(2, a) })
    .mockResolvedValueOnce({ ok: true, rascunho: rascunho(3, b) })
  const onConflict = vi.fn()
  const { fila } = criarFila({ save, onConflict })
  expect((await fila.flushNow(a)).ok).toBe(false)
  expect((await fila.flushNow(b)).ok).toBe(true)
  expect(save.mock.calls.map(([params]) => params.expectedVersion)).toEqual([1, 1, 2])
  expect(onConflict).not.toHaveBeenCalled()
  expect(fila.hasPending()).toBe(false)
})

it('retomada reconhece envio da sessao anterior que terminou depois da recarga', async () => {
  const a = payloadComProduto('Em voo ao recarregar')
  const b = payloadComProduto('Digitado antes de recarregar')
  const save = vi.fn()
    .mockResolvedValueOnce({ ok: false, status: 409, message: 'Versao', rascunho: rascunho(2, a) })
    .mockResolvedValueOnce({ ok: true, rascunho: rascunho(3, b) })
  const onConflict = vi.fn()
  const { fila } = criarFila({ save, onConflict, recoveryBases: [serializarPayloadAutosave(a)] })
  expect((await fila.flushNow(b)).ok).toBe(true)
  expect(onConflict).not.toHaveBeenCalled()
  expect(fila.getLastSavedPayload()).toBe(serializarPayloadAutosave(b))
})

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


describe('regressoes de autosave interrompido', () => {
  it('nao indica salvo quando usuario volta ao valor anterior durante PATCH', async () => {
    let resolver!: (value: AutosaveSaveResult) => void
    const save = vi.fn().mockImplementationOnce(() => new Promise<AutosaveSaveResult>((resolve) => { resolver = resolve }))
      .mockImplementation(async ({ payload, expectedVersion }) => ({ ok: true, rascunho: rascunho(expectedVersion + 1, payload) }))
    const { fila, status } = criarFila({ save })
    const primeiro = fila.flushNow(payloadComProduto('B'))
    fila.enqueue(payloadBase)
    expect(status).not.toHaveBeenLastCalledWith('salvo')
    resolver({ ok: true, rascunho: rascunho(2, payloadComProduto('B')) })
    await primeiro
    expect(save).toHaveBeenLastCalledWith({ payload: payloadBase, expectedVersion: 2 })
    expect(status).toHaveBeenLastCalledWith('salvo')
  })

  it('409 equivalente confirma somente o envio antigo e salva a edicao posterior', async () => {
    let resolver!: (value: AutosaveSaveResult) => void
    const save = vi.fn().mockImplementationOnce(() => new Promise<AutosaveSaveResult>((resolve) => { resolver = resolve }))
      .mockImplementation(async ({ payload, expectedVersion }) => ({ ok: true, rascunho: rascunho(expectedVersion + 1, payload) }))
    const { fila, status } = criarFila({ save })
    const primeiro = fila.flushNow(payloadComProduto('B'))
    fila.enqueue(payloadComProduto('C'))
    resolver({ ok: false, status: 409, message: 'Conflito', rascunho: rascunho(4, payloadComProduto('B')) })
    await primeiro
    expect(save).toHaveBeenLastCalledWith({ payload: payloadComProduto('C'), expectedVersion: 4 })
    expect(fila.getVersion()).toBe(5)
    expect(status.mock.calls.filter(([s]) => s === 'salvo')).toHaveLength(1)
  })

  it('conflito real preserva o payload mais recente e bloqueia flush', async () => {
    let resolver!: (value: AutosaveSaveResult) => void
    const onConflict = vi.fn()
    const { fila, save } = criarFila({ onConflict, save: vi.fn(() => new Promise<AutosaveSaveResult>((resolve) => { resolver = resolve })) })
    const primeiro = fila.flushNow(payloadComProduto('B'))
    fila.enqueue(payloadComProduto('C'))
    resolver({ ok: false, status: 409, message: 'Conflito', rascunho: rascunho(4, payloadComProduto('Servidor')) })
    await primeiro
    expect(onConflict).toHaveBeenCalledWith(expect.objectContaining({ payload: payloadComProduto('C') }))
    expect(await fila.flushNow()).toMatchObject({ ok: false, status: 'conflito' })
    expect(save).toHaveBeenCalledTimes(1)
  })

  it('falha HTTP preserva pendencia para tentativa manual sem novo payload', async () => {
    const save = vi.fn().mockResolvedValueOnce({ ok: false, status: 422, message: 'Invalido' })
      .mockImplementation(async ({ payload, expectedVersion }) => ({ ok: true, rascunho: rascunho(expectedVersion + 1, payload) }))
    const { fila, timers } = criarFila({ save })
    expect(await fila.flushNow(payloadComProduto('B'))).toMatchObject({ ok: false })
    expect(fila.hasPending()).toBe(true)
    expect(timers).toHaveLength(0)
    expect(await fila.flushNow()).toMatchObject({ ok: true })
    expect(save).toHaveBeenCalledTimes(2)
  })

  it('recupera erro transitorio com tentativa automatica e mesma versao', async () => {
    const save = vi.fn().mockResolvedValueOnce({ ok: false, status: 503, message: 'Temporario' })
      .mockImplementation(async ({ payload, expectedVersion }) => ({ ok: true, rascunho: rascunho(expectedVersion + 1, payload) }))
    const { fila, timers, status } = criarFila({ save })
    await fila.flushNow(payloadComProduto('B'))
    expect(timers).toHaveLength(1)
    await timers[0]()
    await Promise.resolve()
    expect(save).toHaveBeenLastCalledWith({ payload: payloadComProduto('B'), expectedVersion: 1 })
    expect(status).toHaveBeenLastCalledWith('salvo')
  })

  it('limita a duas novas tentativas e nao repete erro definitivo', async () => {
    const { fila, save, timers } = criarFila({ save: vi.fn(async () => ({ ok: false as const, status: 503, message: 'Temporario' })) })
    await fila.flushNow(payloadComProduto('B'))
    await timers[0](); await Promise.resolve(); await Promise.resolve()
    await timers[1](); await Promise.resolve(); await Promise.resolve()
    expect(save).toHaveBeenCalledTimes(3)
    expect(timers).toHaveLength(2)
    expect(fila.hasPending()).toBe(true)
  })

  it('salva crianca sem mudar a etapa ficha', async () => {
    const { fila, save } = criarFila()
    const payload = { ...payloadBase, dadosRascunho: { ...payloadBase.dadosRascunho, criancas: [{ id: 'crianca-teste', situacao: 'gestacao' as const, nome: 'Teste' }] } }
    await fila.flushNow(payload)
    expect(save).toHaveBeenCalledWith({ payload, expectedVersion: 1 })
    expect(fila.getRascunho().dadosRascunho.etapaAtual).toBe('ficha')
  })

  it('saida antes do debounce pode enviar com flush sem duplicar PATCH', async () => {
    const { fila, save, timers } = criarFila()
    fila.enqueue(payloadComProduto('B'))
    await fila.flushNow()
    expect(timers).toHaveLength(0)
    expect(save).toHaveBeenCalledTimes(1)
  })
})
