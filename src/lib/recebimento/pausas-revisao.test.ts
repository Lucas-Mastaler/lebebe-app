import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  aplicarDecisaoPausa,
  avaliarPausaRevisavel,
  calcularSegundosReintegrados,
  calcularTempoExibido,
  criarPausaSeNecessaria,
  existePausaPendente,
  somarSegundosReintegrados,
  validarPeriodoTrabalhadoEditado,
} from './pausas-revisao'

const JANELA_INATIVIDADE_MS = 5 * 60 * 1000 // mesmo valor de JANELA_INATIVIDADE_MINUTOS em timer-activity.ts

function iso(d: string): string {
  return new Date(d).toISOString()
}

describe('avaliarPausaRevisavel — regra dos 15 minutos', () => {
  it('4min sem interação: não cria pausa', () => {
    const r = avaliarPausaRevisavel(new Date('2026-01-01T10:00:00Z'), new Date('2026-01-01T10:04:00Z'), JANELA_INATIVIDADE_MS)
    expect(r).toBeNull()
  })

  it('5min sem interação: não cria pausa (comportamento automático já existente)', () => {
    const r = avaliarPausaRevisavel(new Date('2026-01-01T10:00:00Z'), new Date('2026-01-01T10:05:00Z'), JANELA_INATIVIDADE_MS)
    expect(r).toBeNull()
  })

  it('10min sem interação: pausa automática, sem revisão (não cria pendência)', () => {
    const r = avaliarPausaRevisavel(new Date('2026-01-01T10:00:00Z'), new Date('2026-01-01T10:10:00Z'), JANELA_INATIVIDADE_MS)
    expect(r).toBeNull()
  })

  it('14m59s sem interação: sem revisão', () => {
    const r = avaliarPausaRevisavel(new Date('2026-01-01T10:00:00Z'), new Date('2026-01-01T10:14:59Z'), JANELA_INATIVIDADE_MS)
    expect(r).toBeNull()
  })

  it('15min EXATOS sem interação: sem revisão (fronteira confirmada — limite estritamente ">15min")', () => {
    const r = avaliarPausaRevisavel(new Date('2026-01-01T10:00:00Z'), new Date('2026-01-01T10:15:00Z'), JANELA_INATIVIDADE_MS)
    expect(r).toBeNull()
  })

  it('15min01s sem interação: cria pausa revisável', () => {
    const r = avaliarPausaRevisavel(new Date('2026-01-01T10:00:00Z'), new Date('2026-01-01T10:15:01Z'), JANELA_INATIVIDADE_MS)
    expect(r).not.toBeNull()
  })

  it('47min sem interação: cria pausa revisável de 42min (não 47min — primeiros 5min já são do automático)', () => {
    const r = avaliarPausaRevisavel(new Date('2026-01-01T10:00:00Z'), new Date('2026-01-01T10:47:00Z'), JANELA_INATIVIDADE_MS)
    expect(r).not.toBeNull()
    expect(r?.inicioPausa).toBe(iso('2026-01-01T10:05:00Z'))
    expect(r?.fimPausa).toBe(iso('2026-01-01T10:47:00Z'))
    expect(r?.duracaoPausaSegundos).toBe(42 * 60)
  })

  it('os primeiros 5 minutos nunca entram na pausa (inicio_pausa sempre = ultima_atividade + 5min)', () => {
    const r = avaliarPausaRevisavel(new Date('2026-01-01T10:00:00Z'), new Date('2026-01-01T11:00:00Z'), JANELA_INATIVIDADE_MS)
    expect(r?.inicioPausa).toBe(iso('2026-01-01T10:05:00Z'))
    expect(r?.duracaoPausaSegundos).toBe(55 * 60) // 11:00 - 10:05, não 60min
  })
})

describe('calcularSegundosReintegrados — fonte determinística, nunca persistida', () => {
  const pausaBase = {
    duracao_pausa_segundos: 42 * 60,
    periodo_trabalhado_inicio: null,
    periodo_trabalhado_fim: null,
  }

  it('pendente: 0', () => {
    expect(calcularSegundosReintegrados({ ...pausaBase, status: 'pendente', decisao: null })).toBe(0)
  })

  it('trabalhando (SIM): reintegra a pausa inteira', () => {
    expect(calcularSegundosReintegrados({ ...pausaBase, status: 'revisado', decisao: 'trabalhando' })).toBe(42 * 60)
  })

  it('pausado (NÃO): reintegra 0', () => {
    expect(calcularSegundosReintegrados({ ...pausaBase, status: 'revisado', decisao: 'pausado' })).toBe(0)
  })

  it('editado: reintegra só o período informado', () => {
    const pausa = {
      ...pausaBase,
      status: 'revisado',
      decisao: 'editado',
      periodo_trabalhado_inicio: iso('2026-01-01T10:05:00Z'),
      periodo_trabalhado_fim: iso('2026-01-01T10:25:00Z'),
    }
    expect(calcularSegundosReintegrados(pausa)).toBe(20 * 60)
  })

  it('reversibilidade: mudar trabalhando -> pausado -> editado recalcula sem depender de estado anterior', () => {
    const trabalhando = { ...pausaBase, status: 'revisado', decisao: 'trabalhando' }
    const pausado = { ...pausaBase, status: 'revisado', decisao: 'pausado' }
    const editado = { ...pausaBase, status: 'revisado', decisao: 'editado', periodo_trabalhado_inicio: iso('2026-01-01T10:05:00Z'), periodo_trabalhado_fim: iso('2026-01-01T10:25:00Z') }

    expect(calcularSegundosReintegrados(trabalhando)).toBe(42 * 60)
    expect(calcularSegundosReintegrados(pausado)).toBe(0)
    expect(calcularSegundosReintegrados(editado)).toBe(20 * 60)
  })
})

describe('somarSegundosReintegrados — várias pausas', () => {
  it('soma corretamente uma pausa SIM e uma NÃO', () => {
    const pausas = [
      { status: 'revisado', decisao: 'trabalhando', duracao_pausa_segundos: 30 * 60, periodo_trabalhado_inicio: null, periodo_trabalhado_fim: null },
      { status: 'revisado', decisao: 'pausado', duracao_pausa_segundos: 25 * 60, periodo_trabalhado_inicio: null, periodo_trabalhado_fim: null },
    ]
    expect(somarSegundosReintegrados(pausas)).toBe(30 * 60)
  })

  it('soma três pausas: SIM + NÃO + EDITADA', () => {
    const pausas = [
      { status: 'revisado', decisao: 'trabalhando', duracao_pausa_segundos: 40 * 60, periodo_trabalhado_inicio: null, periodo_trabalhado_fim: null },
      { status: 'revisado', decisao: 'pausado', duracao_pausa_segundos: 25 * 60, periodo_trabalhado_inicio: null, periodo_trabalhado_fim: null },
      { status: 'revisado', decisao: 'editado', duracao_pausa_segundos: 45 * 60, periodo_trabalhado_inicio: iso('2026-01-01T15:20:00Z'), periodo_trabalhado_fim: iso('2026-01-01T15:40:00Z') },
    ]
    expect(somarSegundosReintegrados(pausas)).toBe(40 * 60 + 20 * 60)
  })

  it('pausa pendente no meio da lista não entra na soma', () => {
    const pausas = [
      { status: 'revisado', decisao: 'trabalhando', duracao_pausa_segundos: 10 * 60, periodo_trabalhado_inicio: null, periodo_trabalhado_fim: null },
      { status: 'pendente', decisao: null, duracao_pausa_segundos: 999 * 60, periodo_trabalhado_inicio: null, periodo_trabalhado_fim: null },
    ]
    expect(somarSegundosReintegrados(pausas)).toBe(10 * 60)
  })
})

describe('existePausaPendente', () => {
  it('true quando há ao menos uma pendente', () => {
    expect(existePausaPendente([{ status: 'revisado' }, { status: 'pendente' }])).toBe(true)
  })
  it('false quando todas revisadas', () => {
    expect(existePausaPendente([{ status: 'revisado' }, { status: 'revisado' }])).toBe(false)
  })
  it('false para lista vazia', () => {
    expect(existePausaPendente([])).toBe(false)
  })
})

describe('validarPeriodoTrabalhadoEditado', () => {
  const pausa = { inicio_pausa: iso('2026-01-01T10:05:00Z'), fim_pausa: iso('2026-01-01T10:47:00Z') }

  it('aceita período totalmente dentro da janela', () => {
    const r = validarPeriodoTrabalhadoEditado(pausa, { inicio: iso('2026-01-01T10:10:00Z'), fim: iso('2026-01-01T10:30:00Z') })
    expect(r.valido).toBe(true)
  })

  it('rejeita início antes da janela (09:50 < 10:05)', () => {
    const r = validarPeriodoTrabalhadoEditado(pausa, { inicio: iso('2026-01-01T09:50:00Z'), fim: iso('2026-01-01T10:30:00Z') })
    expect(r.valido).toBe(false)
  })

  it('rejeita fim depois da janela (11:00 > 10:47)', () => {
    const r = validarPeriodoTrabalhadoEditado(pausa, { inicio: iso('2026-01-01T10:20:00Z'), fim: iso('2026-01-01T11:00:00Z') })
    expect(r.valido).toBe(false)
  })

  it('rejeita início >= fim', () => {
    const r = validarPeriodoTrabalhadoEditado(pausa, { inicio: iso('2026-01-01T10:20:00Z'), fim: iso('2026-01-01T10:20:00Z') })
    expect(r.valido).toBe(false)
  })

  it('rejeita sem início', () => {
    const r = validarPeriodoTrabalhadoEditado(pausa, { inicio: null, fim: iso('2026-01-01T10:30:00Z') })
    expect(r.valido).toBe(false)
  })

  it('rejeita sem fim', () => {
    const r = validarPeriodoTrabalhadoEditado(pausa, { inicio: iso('2026-01-01T10:10:00Z'), fim: null })
    expect(r.valido).toBe(false)
  })
})

// =========================================================
// Testes de integração (Supabase fake em memória)
// =========================================================

interface EstadoPausaFake {
  id: string
  recebimento_id: string
  ultima_atividade: string
  inicio_pausa: string
  fim_pausa: string
  duracao_pausa_segundos: number
  status: string
  decisao: string | null
  periodo_trabalhado_inicio: string | null
  periodo_trabalhado_fim: string | null
}

function criarSupabaseFake() {
  const linhas: EstadoPausaFake[] = []
  let proximoId = 1

  function selectChain(filtros: Array<[string, unknown]>) {
    return {
      eq: (campo: string, valor: unknown) => selectChain([...filtros, [campo, valor]]),
      single: async () => {
        const encontrada = linhas.find(l => filtros.every(([c, v]) => (l as unknown as Record<string, unknown>)[c] === v))
        return { data: encontrada ?? null, error: null }
      },
      order: () => ({
        then: (resolve: (v: unknown) => unknown) => {
          const resultado = linhas.filter(l => filtros.every(([c, v]) => (l as unknown as Record<string, unknown>)[c] === v))
          return Promise.resolve({ data: resultado, error: null }).then(resolve)
        },
      }),
    }
  }

  function updateChain(payload: Record<string, unknown>, filtros: Array<[string, unknown]>) {
    return {
      eq: (campo: string, valor: unknown) => updateChain(payload, [...filtros, [campo, valor]]),
      select: () => ({
        single: async () => {
          const idx = linhas.findIndex(l => filtros.every(([c, v]) => (l as unknown as Record<string, unknown>)[c] === v))
          if (idx === -1) return { data: null, error: null }
          Object.assign(linhas[idx], payload)
          return { data: { ...linhas[idx] }, error: null }
        },
      }),
    }
  }

  return {
    from: (table: string) => {
      if (table !== 'recebimento_pausas') throw new Error(`Sem mock para tabela ${table}`)
      return {
        select: () => selectChain([]),
        insert: (payload: Record<string, unknown>) => ({
          select: () => ({
            single: async () => {
              const conflito = linhas.some(l => l.recebimento_id === payload.recebimento_id && l.ultima_atividade === payload.ultima_atividade)
              if (conflito) {
                return { data: null, error: { code: '23505', message: 'duplicate key' } }
              }
              const nova: EstadoPausaFake = {
                id: `pausa-${proximoId++}`,
                recebimento_id: payload.recebimento_id as string,
                ultima_atividade: payload.ultima_atividade as string,
                inicio_pausa: payload.inicio_pausa as string,
                fim_pausa: payload.fim_pausa as string,
                duracao_pausa_segundos: payload.duracao_pausa_segundos as number,
                status: (payload.status as string) ?? 'pendente',
                decisao: null,
                periodo_trabalhado_inicio: null,
                periodo_trabalhado_fim: null,
              }
              linhas.push(nova)
              return { data: { ...nova }, error: null }
            },
          }),
        }),
        update: (payload: Record<string, unknown>) => updateChain(payload, []),
      }
    },
    _linhas: linhas,
  }
}

const JANELA_MS = 5 * 60 * 1000

describe('criarPausaSeNecessaria — idempotência (integração)', () => {
  it('cria a pausa quando a lacuna justifica', async () => {
    const fake = criarSupabaseFake()
    const pausa = await criarPausaSeNecessaria(
      fake as never,
      'rec-1',
      new Date('2026-01-01T10:00:00Z'),
      new Date('2026-01-01T10:47:00Z'),
      JANELA_MS
    )
    expect(pausa).not.toBeNull()
    expect(pausa?.status).toBe('pendente')
    expect(fake._linhas).toHaveLength(1)
  })

  it('não cria nada quando a lacuna é <=15min', async () => {
    const fake = criarSupabaseFake()
    const pausa = await criarPausaSeNecessaria(
      fake as never,
      'rec-1',
      new Date('2026-01-01T10:00:00Z'),
      new Date('2026-01-01T10:10:00Z'),
      JANELA_MS
    )
    expect(pausa).toBeNull()
    expect(fake._linhas).toHaveLength(0)
  })

  it('a mesma lacuna (mesma ultima_atividade) não gera duplicata — relê a existente', async () => {
    const fake = criarSupabaseFake()
    const primeira = await criarPausaSeNecessaria(fake as never, 'rec-1', new Date('2026-01-01T10:00:00Z'), new Date('2026-01-01T10:47:00Z'), JANELA_MS)
    const segunda = await criarPausaSeNecessaria(fake as never, 'rec-1', new Date('2026-01-01T10:00:00Z'), new Date('2026-01-01T10:50:00Z'), JANELA_MS)

    expect(fake._linhas).toHaveLength(1)
    expect(segunda?.id).toBe(primeira?.id)
  })

  it('duas requests concorrentes para o mesmo gap não duplicam a pausa', async () => {
    const fake = criarSupabaseFake()
    const [a, b] = await Promise.all([
      criarPausaSeNecessaria(fake as never, 'rec-1', new Date('2026-01-01T10:00:00Z'), new Date('2026-01-01T10:47:00Z'), JANELA_MS),
      criarPausaSeNecessaria(fake as never, 'rec-1', new Date('2026-01-01T10:00:00Z'), new Date('2026-01-01T10:47:05Z'), JANELA_MS),
    ])
    expect(fake._linhas).toHaveLength(1)
    expect(a?.id).toBe(b?.id)
  })

  it('gaps diferentes (ultima_atividade diferente) no mesmo recebimento geram pausas distintas', async () => {
    const fake = criarSupabaseFake()
    const p1 = await criarPausaSeNecessaria(fake as never, 'rec-1', new Date('2026-01-01T11:00:00Z'), new Date('2026-01-01T11:40:00Z'), JANELA_MS)
    const p2 = await criarPausaSeNecessaria(fake as never, 'rec-1', new Date('2026-01-01T13:10:00Z'), new Date('2026-01-01T13:35:00Z'), JANELA_MS)

    expect(fake._linhas).toHaveLength(2)
    expect(p1?.id).not.toBe(p2?.id)
  })
})

describe('aplicarDecisaoPausa — decisões e mudanças de decisão (integração)', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  async function criarPausaDeTeste() {
    const fake = criarSupabaseFake()
    const pausa = await criarPausaSeNecessaria(fake as never, 'rec-1', new Date('2026-01-01T10:00:00Z'), new Date('2026-01-01T10:47:00Z'), JANELA_MS)
    return { fake, pausaId: pausa!.id }
  }

  it('SIM (trabalhando): marca revisado e a contribuição vira a pausa inteira', async () => {
    const { fake, pausaId } = await criarPausaDeTeste()
    const r = await aplicarDecisaoPausa(fake as never, 'rec-1', pausaId, { decisao: 'trabalhando' })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.pausa.status).toBe('revisado')
      expect(calcularSegundosReintegrados(r.pausa)).toBe(42 * 60)
    }
  })

  it('NÃO (pausado): contribuição vira zero', async () => {
    const { fake, pausaId } = await criarPausaDeTeste()
    const r = await aplicarDecisaoPausa(fake as never, 'rec-1', pausaId, { decisao: 'pausado' })
    expect(r.ok).toBe(true)
    if (r.ok) expect(calcularSegundosReintegrados(r.pausa)).toBe(0)
  })

  it('EDITAR: reintegra só o período informado', async () => {
    const { fake, pausaId } = await criarPausaDeTeste()
    const r = await aplicarDecisaoPausa(fake as never, 'rec-1', pausaId, {
      decisao: 'editado',
      periodoInicio: iso('2026-01-01T10:10:00Z'),
      periodoFim: iso('2026-01-01T10:30:00Z'),
    })
    expect(r.ok).toBe(true)
    if (r.ok) expect(calcularSegundosReintegrados(r.pausa)).toBe(20 * 60)
  })

  it('editar fora da janela: rejeita e não muda o status', async () => {
    const { fake, pausaId } = await criarPausaDeTeste()
    const r = await aplicarDecisaoPausa(fake as never, 'rec-1', pausaId, {
      decisao: 'editado',
      periodoInicio: iso('2026-01-01T09:00:00Z'), // antes da janela
      periodoFim: iso('2026-01-01T10:30:00Z'),
    })
    expect(r.ok).toBe(false)
  })

  it('início >= fim ao editar: rejeita', async () => {
    const { fake, pausaId } = await criarPausaDeTeste()
    const r = await aplicarDecisaoPausa(fake as never, 'rec-1', pausaId, {
      decisao: 'editado',
      periodoInicio: iso('2026-01-01T10:20:00Z'),
      periodoFim: iso('2026-01-01T10:20:00Z'),
    })
    expect(r.ok).toBe(false)
  })

  it('mudar SIM -> NÃO recalcula corretamente (reduz para zero)', async () => {
    const { fake, pausaId } = await criarPausaDeTeste()
    await aplicarDecisaoPausa(fake as never, 'rec-1', pausaId, { decisao: 'trabalhando' })
    const r = await aplicarDecisaoPausa(fake as never, 'rec-1', pausaId, { decisao: 'pausado' })
    expect(r.ok).toBe(true)
    if (r.ok) expect(calcularSegundosReintegrados(r.pausa)).toBe(0)
  })

  it('mudar NÃO -> SIM recalcula corretamente (aumenta para a pausa inteira)', async () => {
    const { fake, pausaId } = await criarPausaDeTeste()
    await aplicarDecisaoPausa(fake as never, 'rec-1', pausaId, { decisao: 'pausado' })
    const r = await aplicarDecisaoPausa(fake as never, 'rec-1', pausaId, { decisao: 'trabalhando' })
    expect(r.ok).toBe(true)
    if (r.ok) expect(calcularSegundosReintegrados(r.pausa)).toBe(42 * 60)
  })

  it('mudar EDITADO -> SIM recalcula corretamente (de 20min para os 42min inteiros) e limpa periodo_trabalhado_*', async () => {
    const { fake, pausaId } = await criarPausaDeTeste()
    await aplicarDecisaoPausa(fake as never, 'rec-1', pausaId, {
      decisao: 'editado',
      periodoInicio: iso('2026-01-01T10:10:00Z'),
      periodoFim: iso('2026-01-01T10:30:00Z'),
    })
    const r = await aplicarDecisaoPausa(fake as never, 'rec-1', pausaId, { decisao: 'trabalhando' })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(calcularSegundosReintegrados(r.pausa)).toBe(42 * 60)
      // Auditoria §3: campos do período editado não podem sobreviver à
      // mudança de decisão — senão um registro "trabalhando" ficaria
      // ambíguo, ainda carregando um intervalo antigo de edição.
      expect(r.pausa.periodo_trabalhado_inicio).toBeNull()
      expect(r.pausa.periodo_trabalhado_fim).toBeNull()
    }
  })

  it('mudar EDITADO -> NÃO limpa periodo_trabalhado_* e reintegra zero', async () => {
    const { fake, pausaId } = await criarPausaDeTeste()
    await aplicarDecisaoPausa(fake as never, 'rec-1', pausaId, {
      decisao: 'editado',
      periodoInicio: iso('2026-01-01T10:10:00Z'),
      periodoFim: iso('2026-01-01T10:30:00Z'),
    })
    const r = await aplicarDecisaoPausa(fake as never, 'rec-1', pausaId, { decisao: 'pausado' })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(calcularSegundosReintegrados(r.pausa)).toBe(0)
      expect(r.pausa.periodo_trabalhado_inicio).toBeNull()
      expect(r.pausa.periodo_trabalhado_fim).toBeNull()
    }
  })

  it('mudar SIM -> EDITADO exige e grava o intervalo válido', async () => {
    const { fake, pausaId } = await criarPausaDeTeste()
    await aplicarDecisaoPausa(fake as never, 'rec-1', pausaId, { decisao: 'trabalhando' })

    const semIntervalo = await aplicarDecisaoPausa(fake as never, 'rec-1', pausaId, { decisao: 'editado' })
    expect(semIntervalo.ok).toBe(false)

    const comIntervalo = await aplicarDecisaoPausa(fake as never, 'rec-1', pausaId, {
      decisao: 'editado',
      periodoInicio: iso('2026-01-01T10:10:00Z'),
      periodoFim: iso('2026-01-01T10:30:00Z'),
    })
    expect(comIntervalo.ok).toBe(true)
    if (comIntervalo.ok) {
      expect(comIntervalo.pausa.periodo_trabalhado_inicio).toBe(iso('2026-01-01T10:10:00Z'))
      expect(comIntervalo.pausa.periodo_trabalhado_fim).toBe(iso('2026-01-01T10:30:00Z'))
      expect(calcularSegundosReintegrados(comIntervalo.pausa)).toBe(20 * 60)
    }
  })

  it('trabalhando e pausado nunca carregam periodo_trabalhado_* preenchido (coerência de registro)', async () => {
    const { fake, pausaId } = await criarPausaDeTeste()

    const sim = await aplicarDecisaoPausa(fake as never, 'rec-1', pausaId, { decisao: 'trabalhando' })
    if (sim.ok) {
      expect(sim.pausa.periodo_trabalhado_inicio).toBeNull()
      expect(sim.pausa.periodo_trabalhado_fim).toBeNull()
    }

    const nao = await aplicarDecisaoPausa(fake as never, 'rec-1', pausaId, { decisao: 'pausado' })
    if (nao.ok) {
      expect(nao.pausa.periodo_trabalhado_inicio).toBeNull()
      expect(nao.pausa.periodo_trabalhado_fim).toBeNull()
    }
  })

  it('repetir a mesma resposta não duplica/altera o tempo (idempotente)', async () => {
    const { fake, pausaId } = await criarPausaDeTeste()
    await aplicarDecisaoPausa(fake as never, 'rec-1', pausaId, { decisao: 'trabalhando' })
    const r = await aplicarDecisaoPausa(fake as never, 'rec-1', pausaId, { decisao: 'trabalhando' })
    expect(r.ok).toBe(true)
    if (r.ok) expect(calcularSegundosReintegrados(r.pausa)).toBe(42 * 60)
    expect(fake._linhas).toHaveLength(1)
  })

  it('pausa resolvida não volta como pendente', async () => {
    const { fake, pausaId } = await criarPausaDeTeste()
    await aplicarDecisaoPausa(fake as never, 'rec-1', pausaId, { decisao: 'trabalhando' })
    expect(fake._linhas[0].status).toBe('revisado')
  })
})

// =========================================================
// Cronômetro ao vivo — mesma fórmula usada em PageClient.tsx:
// automático (base) + soma das pausas revisadas + trecho ativo atual.
// A UI só chama somarSegundosReintegrados; toda a lógica testável de
// verdade já vive aqui, sem depender de nenhum valor persistido derivado.
// =========================================================

function tempoExibidoNaTela(automaticoSegundos: number, pausas: PausaParaCalculo[], trechoAtivoSegundos = 0): number {
  return automaticoSegundos + somarSegundosReintegrados(pausas) + trechoAtivoSegundos
}

type PausaParaCalculo = Parameters<typeof somarSegundosReintegrados>[0][number]

describe('cronômetro ao vivo — automático + pausas revisadas + trecho ativo', () => {
  const automatico = 2 * 3600 // 2h00 conhecido

  it('responder SIM aumenta o total mostrado pela pausa inteira', () => {
    const antes = tempoExibidoNaTela(automatico, [])
    const depois = tempoExibidoNaTela(automatico, [
      { status: 'revisado', decisao: 'trabalhando', duracao_pausa_segundos: 42 * 60, periodo_trabalhado_inicio: null, periodo_trabalhado_fim: null },
    ])
    expect(depois - antes).toBe(42 * 60)
    expect(depois).toBe(2 * 3600 + 42 * 60) // 2h42
  })

  it('responder NÃO não altera o total mostrado', () => {
    const antes = tempoExibidoNaTela(automatico, [])
    const depois = tempoExibidoNaTela(automatico, [
      { status: 'revisado', decisao: 'pausado', duracao_pausa_segundos: 42 * 60, periodo_trabalhado_inicio: null, periodo_trabalhado_fim: null },
    ])
    expect(depois).toBe(antes)
  })

  it('EDITAR adiciona só o período escolhido, não a pausa inteira', () => {
    const total = tempoExibidoNaTela(automatico, [
      {
        status: 'revisado', decisao: 'editado', duracao_pausa_segundos: 42 * 60,
        periodo_trabalhado_inicio: iso('2026-01-01T10:05:00Z'), periodo_trabalhado_fim: iso('2026-01-01T10:25:00Z'),
      },
    ])
    expect(total).toBe(automatico + 20 * 60) // só os 20min editados, não os 42min inteiros
  })

  it('alterar SIM -> NÃO reduz corretamente o total mostrado', () => {
    const comSim = tempoExibidoNaTela(automatico, [
      { status: 'revisado', decisao: 'trabalhando', duracao_pausa_segundos: 42 * 60, periodo_trabalhado_inicio: null, periodo_trabalhado_fim: null },
    ])
    const comNao = tempoExibidoNaTela(automatico, [
      { status: 'revisado', decisao: 'pausado', duracao_pausa_segundos: 42 * 60, periodo_trabalhado_inicio: null, periodo_trabalhado_fim: null },
    ])
    expect(comNao).toBe(comSim - 42 * 60)
    expect(comNao).toBe(automatico)
  })

  it('alterar NÃO -> SIM aumenta corretamente o total mostrado', () => {
    const comNao = tempoExibidoNaTela(automatico, [
      { status: 'revisado', decisao: 'pausado', duracao_pausa_segundos: 42 * 60, periodo_trabalhado_inicio: null, periodo_trabalhado_fim: null },
    ])
    const comSim = tempoExibidoNaTela(automatico, [
      { status: 'revisado', decisao: 'trabalhando', duracao_pausa_segundos: 42 * 60, periodo_trabalhado_inicio: null, periodo_trabalhado_fim: null },
    ])
    expect(comSim).toBe(comNao + 42 * 60)
  })

  it('alterar EDITADO recalcula imediatamente (sem depender da decisão anterior)', () => {
    const editado20 = tempoExibidoNaTela(automatico, [
      {
        status: 'revisado', decisao: 'editado', duracao_pausa_segundos: 42 * 60,
        periodo_trabalhado_inicio: iso('2026-01-01T10:05:00Z'), periodo_trabalhado_fim: iso('2026-01-01T10:25:00Z'),
      },
    ])
    const editado35 = tempoExibidoNaTela(automatico, [
      {
        status: 'revisado', decisao: 'editado', duracao_pausa_segundos: 42 * 60,
        periodo_trabalhado_inicio: iso('2026-01-01T10:05:00Z'), periodo_trabalhado_fim: iso('2026-01-01T10:40:00Z'),
      },
    ])
    expect(editado20).toBe(automatico + 20 * 60)
    expect(editado35).toBe(automatico + 35 * 60)
    expect(editado35).not.toBe(editado20) // recalculado do zero, não incrementado
  })

  it('reload reconstrói o mesmo total apenas a partir dos dados persistidos (nenhum estado local necessário)', () => {
    // Simula duas "sessões" independentes lendo os mesmos registros do banco
    // — devem produzir exatamente o mesmo total, sem nenhum valor em memória.
    const pausasDoBanco: PausaParaCalculo[] = [
      { status: 'revisado', decisao: 'trabalhando', duracao_pausa_segundos: 40 * 60, periodo_trabalhado_inicio: null, periodo_trabalhado_fim: null },
      { status: 'revisado', decisao: 'pausado', duracao_pausa_segundos: 25 * 60, periodo_trabalhado_inicio: null, periodo_trabalhado_fim: null },
    ]
    const sessao1 = tempoExibidoNaTela(automatico, pausasDoBanco)
    const sessao2 = tempoExibidoNaTela(automatico, [...pausasDoBanco]) // nova referência, mesmos dados
    expect(sessao1).toBe(sessao2)
    expect(sessao1).toBe(automatico + 40 * 60)
  })

  it('primeiros 5 minutos nunca são duplicados: automático (5min) + pausa (42min) = 47min, não 52min', () => {
    const automaticoComPrimeiros5min = 5 * 60
    const total = tempoExibidoNaTela(automaticoComPrimeiros5min, [
      { status: 'revisado', decisao: 'trabalhando', duracao_pausa_segundos: 42 * 60, periodo_trabalhado_inicio: null, periodo_trabalhado_fim: null },
    ])
    expect(total).toBe(47 * 60)
    expect(total).not.toBe(52 * 60)
  })

  it('inclui o trecho ativo atual quando o timer está rodando no momento', () => {
    const total = tempoExibidoNaTela(automatico, [
      { status: 'revisado', decisao: 'trabalhando', duracao_pausa_segundos: 42 * 60, periodo_trabalhado_inicio: null, periodo_trabalhado_fim: null },
    ], 10 * 60)
    expect(total).toBe(2 * 3600 + 42 * 60 + 10 * 60) // 2h52
  })
})

// =========================================================
// calcularTempoExibido — fonte única da tela (aberto vs. fechado). Cobre a
// auditoria de dupla contagem: depois do bake-in da finalização,
// timer_segundos_totais JÁ inclui as pausas — somar de novo duplicaria.
// =========================================================

describe('calcularTempoExibido — auditoria de dupla contagem pós-finalização', () => {
  const pausaTrabalhandoUmaHora = {
    status: 'revisado',
    decisao: 'trabalhando',
    duracao_pausa_segundos: 3600,
    periodo_trabalhado_inicio: null,
    periodo_trabalhado_fim: null,
  }

  it('aberto: automático 3h + pausa revisada de 1h => exibição 4h', () => {
    const total = calcularTempoExibido({
      status: 'aberto',
      timer_segundos_totais: 3 * 3600,
      timer_rodando: false,
      timer_ultima_acao: null,
      pausas: [pausaTrabalhandoUmaHora],
    })
    expect(total).toBe(4 * 3600)
  })

  it('fechado: timer_segundos_totais já é 4h (bake-in) => continua mostrando 4h, nunca 5h', () => {
    // Estado real depois da finalização: o backend já gravou
    // timer_segundos_totais = automático(3h) + pausas(1h) = 4h. As linhas de
    // recebimento_pausas continuam existindo (histórico), mas não podem ser
    // somadas de novo.
    const total = calcularTempoExibido({
      status: 'fechado',
      timer_segundos_totais: 4 * 3600,
      timer_rodando: false,
      timer_ultima_acao: null,
      pausas: [pausaTrabalhandoUmaHora],
    })
    expect(total).toBe(4 * 3600)
    expect(total).not.toBe(5 * 3600)
  })

  it('cancelado: mesmo comportamento de fechado — não soma pausas de novo', () => {
    const total = calcularTempoExibido({
      status: 'cancelado',
      timer_segundos_totais: 4 * 3600,
      timer_rodando: false,
      timer_ultima_acao: null,
      pausas: [pausaTrabalhandoUmaHora],
    })
    expect(total).toBe(4 * 3600)
  })

  it('fechado com timer_rodando=true persistido incorretamente: ainda assim não soma trecho ativo nem pausas (fechado é sempre snapshot final)', () => {
    const total = calcularTempoExibido(
      {
        status: 'fechado',
        timer_segundos_totais: 4 * 3600,
        timer_rodando: true, // não deveria acontecer, mas a função é defensiva
        timer_ultima_acao: iso('2026-01-01T10:00:00Z'),
        pausas: [pausaTrabalhandoUmaHora],
      },
      new Date('2026-01-01T10:30:00Z')
    )
    expect(total).toBe(4 * 3600)
  })

  it('aberto sem timer rodando (pausado manualmente): não soma trecho ativo, só automático + pausas', () => {
    const total = calcularTempoExibido({
      status: 'aberto',
      timer_segundos_totais: 3 * 3600,
      timer_rodando: false,
      timer_ultima_acao: iso('2026-01-01T10:00:00Z'),
      pausas: [pausaTrabalhandoUmaHora],
    }, new Date('2026-01-01T10:30:00Z'))
    expect(total).toBe(4 * 3600)
  })
})
