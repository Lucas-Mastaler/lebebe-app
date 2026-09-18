import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  calcularEncerramentoPorInatividade,
  encerrarTimerParaFinalizacao,
  pausarTimerManualmente,
  registrarAtividadeConferencia,
  retomarTimerManualmente,
  verificarInatividade,
} from './timer-activity'

// =========================================================
// Fake Supabase — cliente stateful em memória sobre a tabela `recebimentos`,
// suficiente para exercitar leitura + update condicional (guarda otimista)
// exatamente como os helpers reais fazem.
// =========================================================

interface EstadoFake {
  id: string
  timer_rodando: boolean
  timer_segundos_totais: number
  timer_ultima_acao: string | null
  ultima_atividade_conferencia: string | null
}

function criarSupabaseFake(inicial: Partial<EstadoFake> = {}) {
  const estado: EstadoFake = {
    id: 'rec-1',
    timer_rodando: false,
    timer_segundos_totais: 0,
    timer_ultima_acao: null,
    ultima_atividade_conferencia: null,
    ...inicial,
  }

  function readChain() {
    return {
      eq: () => readChain(),
      single: async () => ({ data: { ...estado }, error: null }),
    }
  }

  function writeChain(payload: Record<string, unknown>, conds: Array<[string, unknown]>) {
    const chain = {
      eq: (campo: string, valor: unknown) => writeChain(payload, [...conds, [campo, valor]]),
      select: async (_cols?: string) => {
        const bateCondicoes = conds
          .filter(([campo]) => campo !== 'id')
          .every(([campo, valor]) => (estado as unknown as Record<string, unknown>)[campo] === valor)
        if (bateCondicoes) Object.assign(estado, payload)
        return { data: bateCondicoes ? [{ id: estado.id }] : [], error: null }
      },
      then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) => {
        Object.assign(estado, payload)
        return Promise.resolve({ data: null, error: null }).then(resolve, reject)
      },
    }
    return chain
  }

  // Suporte mínimo a `recebimento_pausas`: só o necessário para exercitar
  // criarPausaSeNecessaria através de registrarAtividadeConferencia — a
  // cobertura completa da tabela de pausas vive em pausas-revisao.test.ts.
  const pausas: Array<Record<string, unknown>> = []
  let proximoIdPausa = 1

  const supabase = {
    from: (table: string) => {
      if (table === 'recebimento_pausas') {
        return {
          insert: (payload: Record<string, unknown>) => ({
            select: () => ({
              single: async () => {
                const conflito = pausas.some(p => p.recebimento_id === payload.recebimento_id && p.ultima_atividade === payload.ultima_atividade)
                if (conflito) return { data: null, error: { code: '23505', message: 'duplicate key' } }
                const nova = { id: `pausa-${proximoIdPausa++}`, status: 'pendente', decisao: null, periodo_trabalhado_inicio: null, periodo_trabalhado_fim: null, ...payload }
                pausas.push(nova)
                return { data: { ...nova }, error: null }
              },
            }),
          }),
          select: () => ({
            eq: () => ({
              eq: () => ({
                single: async () => ({ data: pausas[0] ?? null, error: null }),
              }),
            }),
          }),
        }
      }
      if (table !== 'recebimentos') throw new Error(`Sem mock para tabela ${table}`)
      return {
        select: () => readChain(),
        update: (payload: Record<string, unknown>) => writeChain(payload, []),
      }
    },
  }

  return { supabase: supabase as never, estado, pausas }
}

function iso(dataBase: string): string {
  return new Date(dataBase).toISOString()
}

describe('calcularEncerramentoPorInatividade (regra pura)', () => {
  it('menos de 5 minutos: não expira', () => {
    const resultado = calcularEncerramentoPorInatividade(
      {
        timer_rodando: true,
        timer_segundos_totais: 0,
        timer_ultima_acao: iso('2026-01-01T10:00:00Z'),
        ultima_atividade_conferencia: iso('2026-01-01T10:00:00Z'),
      },
      new Date('2026-01-01T10:04:59Z')
    )
    expect(resultado.expirou).toBe(false)
    expect(resultado.timer_segundos_totais).toBe(0)
  })

  it('exatamente 5 minutos: expira e fecha no limite', () => {
    const resultado = calcularEncerramentoPorInatividade(
      {
        timer_rodando: true,
        timer_segundos_totais: 0,
        timer_ultima_acao: iso('2026-01-01T10:00:00Z'),
        ultima_atividade_conferencia: iso('2026-01-01T10:00:00Z'),
      },
      new Date('2026-01-01T10:05:00Z')
    )
    expect(resultado.expirou).toBe(true)
    expect(resultado.timer_segundos_totais).toBe(300)
    expect(resultado.timer_ultima_acao).toBe(iso('2026-01-01T10:05:00Z'))
  })

  it('verificação aos 20 minutos: acumula só até o minuto 5, não os 20', () => {
    const resultado = calcularEncerramentoPorInatividade(
      {
        timer_rodando: true,
        timer_segundos_totais: 100,
        timer_ultima_acao: iso('2026-01-01T10:00:00Z'),
        ultima_atividade_conferencia: iso('2026-01-01T10:00:00Z'),
      },
      new Date('2026-01-01T10:20:00Z')
    )
    expect(resultado.expirou).toBe(true)
    // 100s prévios + 5min (300s) do segmento — nunca os 20min inteiros
    expect(resultado.timer_segundos_totais).toBe(400)
    expect(resultado.timer_ultima_acao).toBe(iso('2026-01-01T10:05:00Z'))
  })

  it('timer não rodando: nunca expira', () => {
    const resultado = calcularEncerramentoPorInatividade(
      { timer_rodando: false, timer_segundos_totais: 50, timer_ultima_acao: iso('2026-01-01T10:00:00Z'), ultima_atividade_conferencia: iso('2026-01-01T10:00:00Z') },
      new Date('2026-01-02T10:00:00Z')
    )
    expect(resultado.expirou).toBe(false)
    expect(resultado.timer_segundos_totais).toBe(50)
  })
})

describe('registrarAtividadeConferencia', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('timer desligado + primeira atividade: inicia', async () => {
    vi.setSystemTime(new Date('2026-01-01T10:00:00Z'))
    const { supabase, estado } = criarSupabaseFake({ timer_rodando: false, timer_segundos_totais: 0 })

    await registrarAtividadeConferencia(supabase, 'rec-1')

    expect(estado.timer_rodando).toBe(true)
    expect(estado.timer_ultima_acao).toBe('2026-01-01T10:00:00.000Z')
    expect(estado.ultima_atividade_conferencia).toBe('2026-01-01T10:00:00.000Z')
    expect(estado.timer_segundos_totais).toBe(0)
  })

  it('atividade enquanto já rodando (dentro da janela): só renova última atividade', async () => {
    vi.setSystemTime(new Date('2026-01-01T10:00:00Z'))
    const { supabase, estado } = criarSupabaseFake({
      timer_rodando: true,
      timer_segundos_totais: 0,
      timer_ultima_acao: iso('2026-01-01T10:00:00Z'),
      ultima_atividade_conferencia: iso('2026-01-01T10:00:00Z'),
    })

    vi.setSystemTime(new Date('2026-01-01T10:03:00Z'))
    await registrarAtividadeConferencia(supabase, 'rec-1')

    expect(estado.timer_rodando).toBe(true)
    expect(estado.timer_ultima_acao).toBe(iso('2026-01-01T10:00:00Z')) // segmento não reaberto
    expect(estado.ultima_atividade_conferencia).toBe('2026-01-01T10:03:00.000Z')
    expect(estado.timer_segundos_totais).toBe(0)
  })

  it('timer abandonado por horas + nova atividade: fecha o intervalo antigo no limite e inicia outro', async () => {
    vi.setSystemTime(new Date('2026-01-01T14:00:00Z'))
    const { supabase, estado } = criarSupabaseFake({
      timer_rodando: true,
      timer_segundos_totais: 0,
      timer_ultima_acao: iso('2026-01-01T14:00:00Z'),
      ultima_atividade_conferencia: iso('2026-01-01T14:00:00Z'),
    })

    // Nenhuma verificação rodou (aba fechada); usuário só volta às 17:00.
    vi.setSystemTime(new Date('2026-01-01T17:00:00Z'))
    await registrarAtividadeConferencia(supabase, 'rec-1')

    // Segmento antigo fechado em 14:05 (5min), não em 17:00 (3h depois).
    expect(estado.timer_segundos_totais).toBe(300)
    expect(estado.timer_rodando).toBe(true)
    expect(estado.timer_ultima_acao).toBe('2026-01-01T17:00:00.000Z')
    expect(estado.ultima_atividade_conferencia).toBe('2026-01-01T17:00:00.000Z')
  })
})

describe('verificarInatividade', () => {
  it('retorna true quando efetivamente pausa agora', async () => {
    const { supabase, estado } = criarSupabaseFake({
      timer_rodando: true,
      timer_segundos_totais: 0,
      timer_ultima_acao: iso('2020-01-01T00:00:00Z'),
      ultima_atividade_conferencia: iso('2020-01-01T00:00:00Z'),
    })

    const pausou = await verificarInatividade(supabase, 'rec-1')

    expect(pausou).toBe(true)
    expect(estado.timer_rodando).toBe(false)
  })

  it('retorna false quando ainda dentro da janela ativa', async () => {
    const { supabase } = criarSupabaseFake({
      timer_rodando: true,
      timer_segundos_totais: 0,
      timer_ultima_acao: new Date().toISOString(),
      ultima_atividade_conferencia: new Date().toISOString(),
    })

    const pausou = await verificarInatividade(supabase, 'rec-1')
    expect(pausou).toBe(false)
  })

  it('retorna false quando o timer já não estava rodando', async () => {
    const { supabase } = criarSupabaseFake({ timer_rodando: false })
    const pausou = await verificarInatividade(supabase, 'rec-1')
    expect(pausou).toBe(false)
  })
})

describe('pausarTimerManualmente', () => {
  it('pausa manual antes de 5 minutos: acumula normalmente até o clique', async () => {
    const { supabase, estado } = criarSupabaseFake({
      timer_rodando: true,
      timer_segundos_totais: 0,
      timer_ultima_acao: iso('2026-01-01T10:00:00Z'),
      ultima_atividade_conferencia: iso('2026-01-01T10:02:00Z'),
    })

    await pausarTimerManualmente(supabase, 'rec-1', new Date('2026-01-01T10:03:00Z'))

    expect(estado.timer_rodando).toBe(false)
    expect(estado.timer_segundos_totais).toBe(180) // 10:00 -> 10:03
  })

  it('pausa manual atrasada (depois do limite de 5min): não passa do limite', async () => {
    const { supabase, estado } = criarSupabaseFake({
      timer_rodando: true,
      timer_segundos_totais: 0,
      timer_ultima_acao: iso('2026-01-01T10:00:00Z'),
      ultima_atividade_conferencia: iso('2026-01-01T10:00:00Z'),
    })

    // Usuário só clica pausar às 10:30, bem depois da janela de 5min expirar.
    await pausarTimerManualmente(supabase, 'rec-1', new Date('2026-01-01T10:30:00Z'))

    expect(estado.timer_rodando).toBe(false)
    expect(estado.timer_segundos_totais).toBe(300) // só os 5 minutos, não 30
  })
})

describe('retomarTimerManualmente', () => {
  it('inicia novo segmento preservando o total anterior, sem reabrir o antigo', async () => {
    const { supabase, estado } = criarSupabaseFake({
      timer_rodando: false,
      timer_segundos_totais: 500,
      timer_ultima_acao: iso('2026-01-01T09:00:00Z'),
      ultima_atividade_conferencia: iso('2026-01-01T09:00:00Z'),
    })

    await retomarTimerManualmente(supabase, 'rec-1', new Date('2026-01-01T11:00:00Z'))

    expect(estado.timer_rodando).toBe(true)
    expect(estado.timer_segundos_totais).toBe(500) // preservado, não recalculado
    expect(estado.timer_ultima_acao).toBe(iso('2026-01-01T11:00:00Z'))
    expect(estado.ultima_atividade_conferencia).toBe(iso('2026-01-01T11:00:00Z'))
  })
})

describe('encerrarTimerParaFinalizacao', () => {
  it('timer já pausado: retorna o total como está', async () => {
    const { supabase } = criarSupabaseFake({
      timer_rodando: false,
      timer_segundos_totais: 720,
      timer_ultima_acao: iso('2026-01-01T10:00:00Z'),
      ultima_atividade_conferencia: iso('2026-01-01T10:00:00Z'),
    })

    const total = await encerrarTimerParaFinalizacao(supabase, 'rec-1', new Date('2026-01-01T12:00:00Z'))
    expect(total).toBe(720)
  })

  it('timer legitimamente ativo: soma até o momento da finalização', async () => {
    const { supabase } = criarSupabaseFake({
      timer_rodando: true,
      timer_segundos_totais: 480,
      timer_ultima_acao: iso('2026-01-01T10:30:00Z'),
      ultima_atividade_conferencia: iso('2026-01-01T10:32:00Z'),
    })

    // Finaliza às 10:34 — última atividade foi 10:32, ainda dentro da janela de 5min.
    const total = await encerrarTimerParaFinalizacao(supabase, 'rec-1', new Date('2026-01-01T10:34:00Z'))
    expect(total).toBe(480 + 4 * 60) // 720s = 12min
  })

  it('timer stale/abandonado ao finalizar: soma só até o limite de 5min, não até agora', async () => {
    const { supabase } = criarSupabaseFake({
      timer_rodando: true,
      timer_segundos_totais: 0,
      timer_ultima_acao: iso('2026-01-01T08:00:00Z'),
      ultima_atividade_conferencia: iso('2026-01-01T08:00:00Z'),
    })

    // Recebimento fica aberto e é finalizado só 3 dias depois, sem nenhuma atividade.
    const total = await encerrarTimerParaFinalizacao(supabase, 'rec-1', new Date('2026-01-04T08:00:00Z'))
    expect(total).toBe(300) // só os 5 minutos, não 3 dias
  })
})

describe('Cenário obrigatório da auditoria (dois intervalos, 8min + 4min = 12min)', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('10:00 e 10:03 (atividade), pausa em 10:08, 10:30 e 10:32 (atividade), finaliza 10:34 => 12min', async () => {
    const { supabase, estado } = criarSupabaseFake({ timer_rodando: false, timer_segundos_totais: 0 })

    vi.setSystemTime(new Date('2026-01-01T10:00:00Z'))
    await registrarAtividadeConferencia(supabase, 'rec-1')

    vi.setSystemTime(new Date('2026-01-01T10:03:00Z'))
    await registrarAtividadeConferencia(supabase, 'rec-1')

    // Nenhuma atividade depois. Simula o check-inactivity rodando às 10:08 (ou depois).
    vi.setSystemTime(new Date('2026-01-01T10:09:00Z'))
    const pausouAgora = await verificarInatividade(supabase, 'rec-1')
    expect(pausouAgora).toBe(true)
    expect(estado.timer_segundos_totais).toBe(8 * 60) // fechado em 10:08, não 10:09

    vi.setSystemTime(new Date('2026-01-01T10:30:00Z'))
    await registrarAtividadeConferencia(supabase, 'rec-1')

    vi.setSystemTime(new Date('2026-01-01T10:32:00Z'))
    await registrarAtividadeConferencia(supabase, 'rec-1')

    const total = await encerrarTimerParaFinalizacao(supabase, 'rec-1', new Date('2026-01-01T10:34:00Z'))
    expect(total).toBe(12 * 60)
  })
})

describe('concorrência: check-inactivity não sobrescreve atividade nova', () => {
  it('se timer_ultima_acao mudou entre a leitura e a escrita, a reconciliação não sobrescreve', async () => {
    const { supabase, estado } = criarSupabaseFake({
      timer_rodando: true,
      timer_segundos_totais: 0,
      timer_ultima_acao: iso('2026-01-01T10:00:00Z'),
      ultima_atividade_conferencia: iso('2026-01-01T10:00:00Z'),
    })

    // Simula uma atividade concorrente que já avançou o segmento entre a
    // leitura feita por verificarInatividade (mock não expõe esse instante
    // diretamente, então mutamos o estado "por baixo" para simular a corrida)
    // e a escrita da guarda otimista.
    const originalUpdate = (supabase as { from: (t: string) => { update: (p: Record<string, unknown>) => unknown } }).from
    let primeiraChamada = true
    ;(supabase as { from: typeof originalUpdate }).from = (table: string) => {
      const real = originalUpdate(table) as { update: (p: Record<string, unknown>) => { eq: (c: string, v: unknown) => unknown } }
      return {
        ...real,
        update: (payload: Record<string, unknown>) => {
          if (primeiraChamada) {
            primeiraChamada = false
            // Atividade concorrente muda o estado real antes da guarda ser avaliada.
            estado.timer_ultima_acao = iso('2026-01-01T10:20:00Z')
            estado.ultima_atividade_conferencia = iso('2026-01-01T10:20:00Z')
          }
          return real.update(payload)
        },
      }
    }

    const pausou = await verificarInatividade(supabase, 'rec-1')

    expect(pausou).toBe(false) // esta chamada perdeu a corrida, não pausou
    expect(estado.timer_rodando).toBe(true) // atividade concorrente prevaleceu
    expect(estado.timer_ultima_acao).toBe(iso('2026-01-01T10:20:00Z'))
  })
})

describe('registrarAtividadeConferencia — integração com pausas revisáveis', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('gap <=15min: não cria pausa, pausaCriada é null', async () => {
    vi.setSystemTime(new Date('2026-01-01T10:00:00Z'))
    const { supabase, pausas } = criarSupabaseFake({ timer_rodando: false, timer_segundos_totais: 0 })
    await registrarAtividadeConferencia(supabase, 'rec-1')

    vi.setSystemTime(new Date('2026-01-01T10:10:00Z')) // gap de 10min desde a atividade acima
    const resultado = await registrarAtividadeConferencia(supabase, 'rec-1')

    expect(resultado.pausaCriada).toBeNull()
    expect(pausas).toHaveLength(0)
  })

  it('gap >15min: cria pausa revisável e retorna no resultado', async () => {
    vi.setSystemTime(new Date('2026-01-01T10:00:00Z'))
    const { supabase, pausas, estado } = criarSupabaseFake({ timer_rodando: false, timer_segundos_totais: 0 })
    await registrarAtividadeConferencia(supabase, 'rec-1')

    vi.setSystemTime(new Date('2026-01-01T10:47:00Z'))
    const resultado = await registrarAtividadeConferencia(supabase, 'rec-1')

    expect(resultado.pausaCriada).not.toBeNull()
    expect(resultado.pausaCriada?.inicio_pausa).toBe('2026-01-01T10:05:00.000Z')
    expect(resultado.pausaCriada?.fim_pausa).toBe('2026-01-01T10:47:00.000Z')
    expect(resultado.pausaCriada?.duracao_pausa_segundos).toBe(42 * 60)
    expect(pausas).toHaveLength(1)

    // Os primeiros 5 minutos continuam só no timer automático (300s), nunca
    // duplicados dentro da pausa — a pausa começa exatamente onde o
    // automático parou.
    expect(estado.timer_segundos_totais).toBe(5 * 60)
    expect(resultado.pausaCriada?.duracao_pausa_segundos).not.toBe(47 * 60)
  })

  it('nova atividade sempre inicia o novo segmento, mesmo quando cria uma pausa', async () => {
    vi.setSystemTime(new Date('2026-01-01T10:00:00Z'))
    const { supabase, estado } = criarSupabaseFake({ timer_rodando: false, timer_segundos_totais: 0 })
    await registrarAtividadeConferencia(supabase, 'rec-1')

    vi.setSystemTime(new Date('2026-01-01T10:47:00Z'))
    await registrarAtividadeConferencia(supabase, 'rec-1')

    expect(estado.timer_rodando).toBe(true)
    expect(estado.timer_ultima_acao).toBe('2026-01-01T10:47:00.000Z')
  })
})
