import { beforeEach, describe, expect, it, vi } from 'vitest'
import { POST } from './route'
import { validateMaticUser } from '@/lib/auth/matic-auth'
import { createClient } from '@/lib/supabase/server'
import { encerrarTimerParaFinalizacao } from '@/lib/recebimento/timer-activity'
import { enviarRecebimentoParaPlanilha } from '@/lib/google/sheets-service'
import { dispararAutomacaoBaixaEncomendas } from '@/lib/integracoes/automacao-vps'

vi.mock('@/lib/auth/matic-auth', () => ({ validateMaticUser: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/recebimento/timer-activity', () => ({ encerrarTimerParaFinalizacao: vi.fn() }))
vi.mock('@/lib/google/sheets-service', () => ({ enviarRecebimentoParaPlanilha: vi.fn() }))
vi.mock('@/lib/integracoes/automacao-vps', () => ({ dispararAutomacaoBaixaEncomendas: vi.fn() }))

const recebimentoId = 'rec-1'

// Builder genérico (mesmo padrão de src/app/api/recebimento/[id]/route.test.ts):
// suporta tanto leitura terminada em .single() quanto update/insert awaited
// diretamente via .then(). `onUpdate` captura o payload de qualquer .update().
function builder(result: unknown, onUpdate?: (payload: Record<string, unknown>) => void) {
  const chain: Record<string, unknown> = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    in: vi.fn(() => chain),
    not: vi.fn(() => chain),
    or: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    order: vi.fn(() => chain),
    insert: vi.fn(() => chain),
    upsert: vi.fn(() => chain),
    update: vi.fn((payload: Record<string, unknown>) => {
      onUpdate?.(payload)
      return chain
    }),
    single: vi.fn(() => Promise.resolve(result)),
    then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
      Promise.resolve(result).then(resolve, reject),
  }
  return chain
}

function mockSupabase(queues: Record<string, unknown[]>, updatePayloads: Array<{ tabela: string } & Record<string, unknown>>) {
  vi.mocked(createClient).mockResolvedValue({
    from: vi.fn((table: string) => {
      const queue = queues[table]
      if (!queue || queue.length === 0) throw new Error(`Sem mock para tabela ${table}`)
      return builder(queue.shift(), (payload) => updatePayloads.push({ tabela: table, ...payload }))
    }),
  } as never)
}

// Cenário mínimo: recebimento sem itens/OS/NFes pendentes, só para exercitar
// a decisão de tempo (automático vs. fallback manual) na finalização — as
// demais regras (volumes, OS, matic_sku, divergências) não são o foco desta
// suíte e já têm cobertura própria.
function queuesBase() {
  return {
    recebimentos: [
      { data: { status: 'aberto', data_inicio: '2026-01-01T00:00:00Z', motorista: null, timer_segundos_totais: 0 }, error: null },
      { error: null }, // update final
    ],
    recebimento_nfes: [
      { data: [], error: null }, // nfeLinks
      { data: [], error: null }, // nfesData
    ],
    recebimento_itens: [
      { data: [], error: null }, // itens
      { data: [], error: null }, // itensCompletos
      { data: [], error: null }, // itensDivergencias
      { data: [], error: null }, // itensRecebidos
    ],
    recebimento_os: [
      { data: [], error: null }, // osTracking
    ],
    recebimento_pausas: [
      { data: [], error: null }, // listarPausas — sem pausas por padrão
    ],
  }
}

function requestBody(body: Record<string, unknown> = {}) {
  return new Request(`https://example.com/api/recebimento/${recebimentoId}/finalizar`, {
    method: 'POST',
    body: JSON.stringify(body),
  }) as never
}

describe('POST /api/recebimento/[id]/finalizar — fallback manual de tempo (>12h)', () => {
  const updatePayloads: Array<{ tabela: string } & Record<string, unknown>> = []

  beforeEach(() => {
    vi.clearAllMocks()
    updatePayloads.length = 0
    vi.mocked(validateMaticUser).mockResolvedValue({ authorized: true, email: 'teste@lebebe.com.br' } as never)
    vi.mocked(enviarRecebimentoParaPlanilha).mockResolvedValue({ sucesso: true } as never)
    vi.mocked(dispararAutomacaoBaixaEncomendas).mockResolvedValue(undefined as never)
  })

  it('automático 8h: finaliza normalmente, sem exigir fallback', async () => {
    vi.mocked(encerrarTimerParaFinalizacao).mockResolvedValue(8 * 3600)
    mockSupabase(queuesBase(), updatePayloads)

    const response = await POST(requestBody(), { params: Promise.resolve({ id: recebimentoId }) })

    expect(response.status).toBe(200)
    const updateFinal = updatePayloads.find(p => p.tabela === 'recebimentos')
    expect(updateFinal).toMatchObject({ timer_segundos_totais: 8 * 3600, tempo_correcao_manual: false, timer_rodando: false })
    expect(enviarRecebimentoParaPlanilha).toHaveBeenCalledWith(expect.objectContaining({ tempo_total_formatado: '08:00:00' }))
  })

  it('exatamente 12h: finaliza normalmente (sem fallback)', async () => {
    vi.mocked(encerrarTimerParaFinalizacao).mockResolvedValue(12 * 3600)
    mockSupabase(queuesBase(), updatePayloads)

    const response = await POST(requestBody(), { params: Promise.resolve({ id: recebimentoId }) })

    expect(response.status).toBe(200)
  })

  it('12h + 1s sem correção manual: exige fallback e NÃO finaliza', async () => {
    vi.mocked(encerrarTimerParaFinalizacao).mockResolvedValue(12 * 3600 + 1)
    mockSupabase(queuesBase(), updatePayloads)

    const response = await POST(requestBody(), { params: Promise.resolve({ id: recebimentoId }) })
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.requer_correcao_manual).toBe(true)
    expect(body.tempo_calculado_segundos).toBe(12 * 3600 + 1)
    expect(enviarRecebimentoParaPlanilha).not.toHaveBeenCalled()
    expect(updatePayloads.find(p => p.tabela === 'recebimentos')).toBeUndefined()
  })

  it('18h sem correção manual: exige fallback (API não permite bypass do frontend)', async () => {
    vi.mocked(encerrarTimerParaFinalizacao).mockResolvedValue(18 * 3600)
    mockSupabase(queuesBase(), updatePayloads)

    // Corpo idêntico ao de uma finalização "normal" — sem nenhum campo de
    // correção manual, simulando um cliente que ignore a exigência do fallback.
    const response = await POST(requestBody({ quem_finalizou: 'Teste' }), { params: Promise.resolve({ id: recebimentoId }) })

    expect(response.status).toBe(400)
    expect(updatePayloads.find(p => p.tabela === 'recebimentos')).toBeUndefined()
  })

  it('fallback sem início: rejeita', async () => {
    vi.mocked(encerrarTimerParaFinalizacao).mockResolvedValue(18 * 3600)
    mockSupabase(queuesBase(), updatePayloads)

    const response = await POST(
      requestBody({ correcao_manual_fim: '2026-01-01T16:00:00Z' }),
      { params: Promise.resolve({ id: recebimentoId }) }
    )
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.requer_correcao_manual).toBe(true)
  })

  it('fallback sem fim: rejeita', async () => {
    vi.mocked(encerrarTimerParaFinalizacao).mockResolvedValue(18 * 3600)
    mockSupabase(queuesBase(), updatePayloads)

    const response = await POST(
      requestBody({ correcao_manual_inicio: '2026-01-01T08:00:00Z' }),
      { params: Promise.resolve({ id: recebimentoId }) }
    )

    expect(response.status).toBe(400)
  })

  it('fim anterior ao início: rejeita', async () => {
    vi.mocked(encerrarTimerParaFinalizacao).mockResolvedValue(18 * 3600)
    mockSupabase(queuesBase(), updatePayloads)

    const response = await POST(
      requestBody({
        correcao_manual_inicio: '2026-01-01T16:00:00Z',
        correcao_manual_fim: '2026-01-01T08:00:00Z',
      }),
      { params: Promise.resolve({ id: recebimentoId }) }
    )

    expect(response.status).toBe(400)
  })

  it('início = fim (duração zero): rejeita', async () => {
    vi.mocked(encerrarTimerParaFinalizacao).mockResolvedValue(18 * 3600)
    mockSupabase(queuesBase(), updatePayloads)

    const response = await POST(
      requestBody({
        correcao_manual_inicio: '2026-01-01T08:00:00Z',
        correcao_manual_fim: '2026-01-01T08:00:00Z',
      }),
      { params: Promise.resolve({ id: recebimentoId }) }
    )

    expect(response.status).toBe(400)
  })

  it('correção manual >12h: rejeita — o fallback não aceita outro valor irreal', async () => {
    vi.mocked(encerrarTimerParaFinalizacao).mockResolvedValue(18 * 3600)
    mockSupabase(queuesBase(), updatePayloads)

    const response = await POST(
      requestBody({
        correcao_manual_inicio: '2026-01-01T00:00:00Z',
        correcao_manual_fim: '2026-01-02T13:00:00Z', // 13h
      }),
      { params: Promise.resolve({ id: recebimentoId }) }
    )

    expect(response.status).toBe(400)
    expect(updatePayloads.find(p => p.tabela === 'recebimentos')).toBeUndefined()
  })

  it('correção manual válida de 8h: aceita, finaliza e marca tempo_correcao_manual', async () => {
    vi.mocked(encerrarTimerParaFinalizacao).mockResolvedValue(18 * 3600)
    mockSupabase(queuesBase(), updatePayloads)

    const response = await POST(
      requestBody({
        correcao_manual_inicio: '2026-01-01T08:00:00Z',
        correcao_manual_fim: '2026-01-01T16:00:00Z',
      }),
      { params: Promise.resolve({ id: recebimentoId }) }
    )

    expect(response.status).toBe(200)
    const updateFinal = updatePayloads.find(p => p.tabela === 'recebimentos')
    expect(updateFinal).toMatchObject({
      timer_segundos_totais: 8 * 3600,
      tempo_correcao_manual: true,
      tempo_manual_inicio: '2026-01-01T08:00:00.000Z',
      tempo_manual_fim: '2026-01-01T16:00:00.000Z',
      timer_rodando: false,
    })
  })

  it('automático 18h + manual 08:00–15:30 (7h30): duração final = 7h30, planilha recebe 7h30', async () => {
    vi.mocked(encerrarTimerParaFinalizacao).mockResolvedValue(18 * 3600)
    mockSupabase(queuesBase(), updatePayloads)

    const response = await POST(
      requestBody({
        correcao_manual_inicio: '2026-01-01T08:00:00Z',
        correcao_manual_fim: '2026-01-01T15:30:00Z',
      }),
      { params: Promise.resolve({ id: recebimentoId }) }
    )

    expect(response.status).toBe(200)
    expect(enviarRecebimentoParaPlanilha).toHaveBeenCalledWith(expect.objectContaining({ tempo_total_formatado: '07:30:00' }))
    const updateFinal = updatePayloads.find(p => p.tabela === 'recebimentos')
    expect(updateFinal).toMatchObject({ timer_segundos_totais: 7.5 * 3600 })
  })

  it('timer fica parado (timer_rodando=false) depois da finalização, com ou sem correção manual', async () => {
    vi.mocked(encerrarTimerParaFinalizacao).mockResolvedValue(5 * 3600)
    mockSupabase(queuesBase(), updatePayloads)

    await POST(requestBody(), { params: Promise.resolve({ id: recebimentoId }) })

    const updateFinal = updatePayloads.find(p => p.tabela === 'recebimentos')
    expect(updateFinal?.timer_rodando).toBe(false)
  })
})

describe('POST /api/recebimento/[id]/finalizar — pausas revisáveis', () => {
  const updatePayloads: Array<{ tabela: string } & Record<string, unknown>> = []

  beforeEach(() => {
    vi.clearAllMocks()
    updatePayloads.length = 0
    vi.mocked(validateMaticUser).mockResolvedValue({ authorized: true, email: 'teste@lebebe.com.br' } as never)
    vi.mocked(enviarRecebimentoParaPlanilha).mockResolvedValue({ sucesso: true } as never)
    vi.mocked(dispararAutomacaoBaixaEncomendas).mockResolvedValue(undefined as never)
  })

  function queuesComPausas(pausas: Array<Record<string, unknown>>): Record<string, unknown[]> {
    const queues: Record<string, unknown[]> = queuesBase()
    queues.recebimento_pausas = [{ data: pausas, error: null }]
    return queues
  }

  it('pausa pendente: bloqueia a finalização ANTES de tocar no timer (ordem correta — sem estado parcial)', async () => {
    vi.mocked(encerrarTimerParaFinalizacao).mockResolvedValue(3 * 3600)
    mockSupabase(queuesComPausas([{ id: 'p1', status: 'pendente', decisao: null, duracao_pausa_segundos: 2520 }]), updatePayloads)

    const response = await POST(requestBody(), { params: Promise.resolve({ id: recebimentoId }) })
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.requer_revisao_pausas).toBe(true)
    // Auditoria §2: o gate de pausas roda ANTES de encerrarTimerParaFinalizacao
    // — o timer não pode ser alterado/reconciliado antes de sabermos se a
    // finalização vai de fato acontecer.
    expect(encerrarTimerParaFinalizacao).not.toHaveBeenCalled()
    // Nenhuma escrita em recebimentos (status, timer, bake-in) pode ter
    // ocorrido — o recebimento continua exatamente como estava.
    expect(updatePayloads.find(p => p.tabela === 'recebimentos')).toBeUndefined()
  })

  it('todas as pausas revisadas: finaliza normalmente somando a contribuição de cada uma', async () => {
    vi.mocked(encerrarTimerParaFinalizacao).mockResolvedValue(3 * 3600) // 3h automático
    mockSupabase(
      queuesComPausas([
        { id: 'p1', status: 'revisado', decisao: 'trabalhando', duracao_pausa_segundos: 42 * 60, periodo_trabalhado_inicio: null, periodo_trabalhado_fim: null },
        { id: 'p2', status: 'revisado', decisao: 'pausado', duracao_pausa_segundos: 25 * 60, periodo_trabalhado_inicio: null, periodo_trabalhado_fim: null },
        {
          id: 'p3', status: 'revisado', decisao: 'editado', duracao_pausa_segundos: 45 * 60,
          periodo_trabalhado_inicio: '2026-01-01T15:20:00.000Z', periodo_trabalhado_fim: '2026-01-01T15:40:00.000Z',
        },
      ]),
      updatePayloads
    )

    const response = await POST(requestBody(), { params: Promise.resolve({ id: recebimentoId }) })

    // 3h automático + 42min (trabalhando) + 0 (pausado) + 20min (editado) = 4h02
    const esperado = 3 * 3600 + 42 * 60 + 20 * 60
    expect(response.status).toBe(200)
    const updateFinal = updatePayloads.find(p => p.tabela === 'recebimentos')
    expect(updateFinal).toMatchObject({ timer_segundos_totais: esperado })
    expect(enviarRecebimentoParaPlanilha).toHaveBeenCalledWith(expect.objectContaining({ tempo_total_formatado: '04:02:00' }))
  })

  it('sem pausas: comportamento idêntico ao já existente (regressão)', async () => {
    vi.mocked(encerrarTimerParaFinalizacao).mockResolvedValue(8 * 3600)
    mockSupabase(queuesComPausas([]), updatePayloads)

    const response = await POST(requestBody(), { params: Promise.resolve({ id: recebimentoId }) })

    expect(response.status).toBe(200)
    const updateFinal = updatePayloads.find(p => p.tabela === 'recebimentos')
    expect(updateFinal).toMatchObject({ timer_segundos_totais: 8 * 3600 })
  })

  it('automático + pausas reintegradas ultrapassa 12h: aciona o fallback manual já existente', async () => {
    vi.mocked(encerrarTimerParaFinalizacao).mockResolvedValue(11 * 3600) // automático sozinho já é <=12h
    mockSupabase(
      queuesComPausas([
        { id: 'p1', status: 'revisado', decisao: 'trabalhando', duracao_pausa_segundos: 90 * 60, periodo_trabalhado_inicio: null, periodo_trabalhado_fim: null }, // +1h30 -> 12h30 total
      ]),
      updatePayloads
    )

    const response = await POST(requestBody(), { params: Promise.resolve({ id: recebimentoId }) })
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.requer_correcao_manual).toBe(true)
    expect(body.tempo_calculado_segundos).toBe(11 * 3600 + 90 * 60)
  })

  it('correção manual >12h continua funcionando por cima da reintegração de pausas', async () => {
    vi.mocked(encerrarTimerParaFinalizacao).mockResolvedValue(11 * 3600)
    mockSupabase(
      queuesComPausas([
        { id: 'p1', status: 'revisado', decisao: 'trabalhando', duracao_pausa_segundos: 90 * 60, periodo_trabalhado_inicio: null, periodo_trabalhado_fim: null },
      ]),
      updatePayloads
    )

    const response = await POST(
      requestBody({ correcao_manual_inicio: '2026-01-01T08:00:00Z', correcao_manual_fim: '2026-01-01T16:00:00Z' }),
      { params: Promise.resolve({ id: recebimentoId }) }
    )

    expect(response.status).toBe(200)
    const updateFinal = updatePayloads.find(p => p.tabela === 'recebimentos')
    expect(updateFinal).toMatchObject({ timer_segundos_totais: 8 * 3600, tempo_correcao_manual: true })
  })

  it('dashboard/Sheets usam a duração oficial já com pausas reintegradas', async () => {
    vi.mocked(encerrarTimerParaFinalizacao).mockResolvedValue(2 * 3600)
    mockSupabase(
      queuesComPausas([
        { id: 'p1', status: 'revisado', decisao: 'trabalhando', duracao_pausa_segundos: 42 * 60, periodo_trabalhado_inicio: null, periodo_trabalhado_fim: null },
      ]),
      updatePayloads
    )

    await POST(requestBody(), { params: Promise.resolve({ id: recebimentoId }) })

    // 2h + 42min = 2h42
    expect(enviarRecebimentoParaPlanilha).toHaveBeenCalledWith(expect.objectContaining({ tempo_total_formatado: '02:42:00' }))
  })

  it('recebimento já fechado: rejeita antes até de checar pausas — impede reaplicar a soma numa finalização repetida', async () => {
    const queues = queuesComPausas([
      { id: 'p1', status: 'revisado', decisao: 'trabalhando', duracao_pausa_segundos: 42 * 60, periodo_trabalhado_inicio: null, periodo_trabalhado_fim: null },
    ])
    queues.recebimentos = [{ data: { status: 'fechado', data_inicio: '2026-01-01T00:00:00Z', motorista: null, timer_segundos_totais: 4 * 3600 }, error: null }]
    mockSupabase(queues, updatePayloads)

    const response = await POST(requestBody(), { params: Promise.resolve({ id: recebimentoId }) })

    expect(response.status).toBe(400)
    expect(encerrarTimerParaFinalizacao).not.toHaveBeenCalled()
    expect(updatePayloads.find(p => p.tabela === 'recebimentos')).toBeUndefined()
  })
})
