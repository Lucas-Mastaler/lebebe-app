import { describe, expect, it, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => mockSupabase,
}))

vi.mock('@/lib/digisac/clienteDigisac', () => ({
  fetchDigisacRaw: vi.fn(),
  sanitizarDigisacParaLog: (s: string) => s,
}))

const { fetchDigisacRaw } = await import('@/lib/digisac/clienteDigisac')

const alertasState: Array<Record<string, unknown>> = []

const configData = [
  {
    chave: 'automacao',
    valor: { ativa: true, pausada: false, motivo: null },
  },
  {
    chave: 'parametros',
    valor: {
      timezone: 'America/Sao_Paulo',
      limite_diario_por_conexao: 2,
      limite_por_execucao: 1,
    },
  },
  {
    chave: 'pausas_conexoes',
    valor: {
      'c60d720f-5ad5-4a1b-bedb-e51495dee686': { nome: 'Portao', pausada: false, erros_consecutivos: 0 },
      '0973f84b-8294-4615-9657-ba95b6346246': { nome: 'Bigorrilho', pausada: false, erros_consecutivos: 0 },
      '1352c41b-80a9-4e74-b9d9-4c5e7aed060e': { nome: 'Hauer', pausada: false, erros_consecutivos: 0 },
    },
  },
]

function chainCount(count: number) {
  const obj: Record<string, unknown> = {}
  obj.eq = () => obj
  obj.gte = () => obj
  obj.lt = () => Promise.resolve({ count, error: null })
  obj.then = (resolve: (v: unknown) => void) => {
    Promise.resolve({ count, error: null }).then(resolve)
  }
  return obj
}

const mockSupabase = {
  from(table: string) {
    if (table === 'hub_vendas_config') {
      return {
        select: () => ({
          in: (_col: string, keys: string[]) => ({
            then: (resolve: (v: unknown) => void) => {
              resolve({ data: configData.filter((r) => keys.includes(r.chave)), error: null })
            },
          }),
        }),
      }
    }
    if (table === 'hub_vendas_recuperacao_fila') {
      return {
        select: () => chainCount(1),
      }
    }
    if (table === 'hub_vendas_leads') {
      return {
        select: () => ({
          gte: () => ({
            lt: () => Promise.resolve({ count: 3, error: null }),
          }),
        }),
      }
    }
    if (table === 'hub_vendas_alertas') {
      return {
        select: () => {
          const obj: Record<string, unknown> = {}
          const eqFilters: Record<string, unknown> = {}
          obj.eq = (col: string, val: unknown) => {
            eqFilters[col] = val
            return obj
          }
          obj.gte = () => obj
          obj.lt = () => obj
          obj.order = () => ({
            limit: () => Promise.resolve({ data: alertasState.slice(0, 1), error: null }),
          })
          obj.limit = () => {
            // Filtrar por eq filters
            const filtered = alertasState.filter((a) => {
              return Object.entries(eqFilters).every(([k, v]) => a[k] === v)
            })
            return Promise.resolve({ data: filtered.slice(0, 1), error: null })
          }
          obj.then = (resolve: (v: unknown) => void) => {
            const filtered = alertasState.filter((a) => {
              return Object.entries(eqFilters).every(([k, v]) => a[k] === v)
            })
            Promise.resolve({ data: filtered.slice(0, 1), error: null }).then(resolve)
          }
          return obj
        },
        insert: (row: Record<string, unknown>) => {
          alertasState.push(row)
          return Promise.resolve({ error: null })
        },
      }
    }
    return { select: () => chainCount(0) }
  },
  rpc: (fn: string) => {
    if (fn === 'hub_vendas_status_contadores') {
      return Promise.resolve({
        data: [
          { status: 'agendado', total: 1 },
          { status: 'enviado', total: 3 },
          { status: 'erro', total: 0 },
          { status: 'resultado_incerto', total: 0 },
          { status: 'analise_manual', total: 0 },
          { status: 'cancelado', total: 0 },
        ],
        error: null,
      })
    }
    return Promise.resolve({ data: [], error: null })
  },
}

const { enviarResumoDiarioHubVendas, gerarTextoResumoDiario } = await import('./resumo-diario')

describe('resumo diário Hub/Vendas', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    alertasState.length = 0
    process.env.DIGISAC_BOT_USER_ID = 'bot-user-test-id'
    process.env.HUB_VENDAS_ALERTAS_CONTACT_ID = 'contact-test-id'
    process.env.HUB_VENDAS_ALERTAS_SERVICE_ID = 'service-test-id'
  })

  it('gera texto com consolidacao por loja e limite', async () => {
    const texto = await gerarTextoResumoDiario(mockSupabase as never)
    expect(texto).toContain('RESUMO DIÁRIO')
    expect(texto).toContain('Portão')
    expect(texto).toContain('Bigorrilho')
    expect(texto).toContain('Hauer')
    // Cada loja deve mostrar enviados/limite
    expect(texto).toContain('/2 enviados')
    expect(texto).toContain('Total enviado:')
  })

  it('mostra saldo restante por loja', async () => {
    const texto = await gerarTextoResumoDiario(mockSupabase as never)
    // Com 1 enviado e limite 2, saldo = 1
    // O formato mostra "X/2 enviados"
    expect(texto).toMatch(/\d+\/2 enviados/)
  })

  it('mostra erros e pendências', async () => {
    const texto = await gerarTextoResumoDiario(mockSupabase as never)
    expect(texto).toContain('Erros:')
    expect(texto).toContain('Cancelados:')
    expect(texto).toContain('Resultado incerto:')
    expect(texto).toContain('Análise manual:')
    expect(texto).toContain('Conexões pausadas:')
  })

  it('funciona sem envios (não trata como erro)', async () => {
    // Mock retornando 0 enviados
    const supabaseSemEnvio = {
      ...mockSupabase,
      from(table: string) {
        if (table === 'hub_vendas_recuperacao_fila') {
          return {
            select: () => chainCount(0),
          }
        }
        return mockSupabase.from(table)
      },
    }

    const texto = await gerarTextoResumoDiario(supabaseSemEnvio as never)
    expect(texto).toContain('Nenhuma mensagem de recuperação foi enviada hoje.')
  })

  it('envia como bot com origin=bot', async () => {
    let capturedBody: Record<string, unknown> | null = null
    vi.mocked(fetchDigisacRaw).mockImplementationOnce(async (_endpoint: string, options?: RequestInit) => {
      capturedBody = JSON.parse(options!.body as string)
      return { ok: true, text: () => Promise.resolve('{}') } as Response
    })

    await enviarResumoDiarioHubVendas({ supabase: mockSupabase as never })

    expect(capturedBody).toBeTruthy()
    expect(capturedBody!.origin).toBe('bot')
    expect(capturedBody!.userId).toBe('bot-user-test-id')
    expect(capturedBody!.contactId).toBe('contact-test-id')
    expect(capturedBody!.serviceId).toBe('service-test-id')
  })

  it('não duplica resumo da mesma data (idempotente)', async () => {
    // Calcular a chave exata que a função vai usar
    const { obterPartesDataLocal } = await import('./tempo')
    const partes = obterPartesDataLocal(new Date(), 'America/Sao_Paulo')
    const pad = (n: number) => String(n).padStart(2, '0')
    const chaveEsperada = `${partes.ano}-${pad(partes.mes)}-${pad(partes.dia)}`

    // Simular que já foi enviado
    alertasState.push({
      tipo: 'resumo_diario',
      chave_deduplicacao: chaveEsperada,
      status: 'enviado',
      enviado_em: new Date().toISOString(),
    })

    const fetchSpy = vi.mocked(fetchDigisacRaw)
    fetchSpy.mockClear()

    const resultado = await enviarResumoDiarioHubVendas({ supabase: mockSupabase as never })

    // Não deve chamar fetchDigisacRaw (já enviado)
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(resultado.ok).toBe(true)
    if (resultado.ok) {
      expect(resultado.deduplicado).toBe(true)
      expect(resultado.enviado).toBe(false)
    }
  })

  it('envia ao contato e serviço técnicos corretos', async () => {
    let capturedBody: Record<string, unknown> | null = null
    vi.mocked(fetchDigisacRaw).mockImplementationOnce(async (_endpoint: string, options?: RequestInit) => {
      capturedBody = JSON.parse(options!.body as string)
      return { ok: true, text: () => Promise.resolve('{}') } as Response
    })

    await enviarResumoDiarioHubVendas({ supabase: mockSupabase as never })

    expect(capturedBody!.contactId).toBe('contact-test-id')
    expect(capturedBody!.serviceId).toBe('service-test-id')
  })

  it('não altera filas ou leads', async () => {
    vi.mocked(fetchDigisacRaw).mockImplementationOnce(async () => ({
      ok: true,
      text: () => Promise.resolve('{}'),
    }) as Response)

    await enviarResumoDiarioHubVendas({ supabase: mockSupabase as never })

    // O resumo só faz select e insert em hub_vendas_alertas
    // Não deve fazer update/delete em filas ou leads
    // (verificado pela estrutura do mock que não tem update/delete)
  })

  it('resumo enviado cria registro com status = enviado', async () => {
    vi.mocked(fetchDigisacRaw).mockImplementationOnce(async () => ({
      ok: true,
      text: () => Promise.resolve('{}'),
    }) as Response)

    await enviarResumoDiarioHubVendas({ supabase: mockSupabase as never })

    const ultimo = alertasState[alertasState.length - 1]
    expect(ultimo.tipo).toBe('resumo_diario')
    expect(ultimo.status).toBe('enviado')
  })

  it('resumo com falha nao bloqueia tentativa futura', async () => {
    const { obterPartesDataLocal } = await import('./tempo')
    const partes = obterPartesDataLocal(new Date(), 'America/Sao_Paulo')
    const pad = (n: number) => String(n).padStart(2, '0')
    const chaveEsperada = `${partes.ano}-${pad(partes.mes)}-${pad(partes.dia)}`

    // Simular falha anterior
    alertasState.push({
      tipo: 'resumo_diario',
      chave_deduplicacao: chaveEsperada,
      status: 'falha',
      enviado_em: new Date().toISOString(),
    })

    // A funcao verifica somente status='enviado', entao falha anterior permite novo envio
    let capturedBody: Record<string, unknown> | null = null
    vi.mocked(fetchDigisacRaw).mockImplementationOnce(async (_endpoint: string, options?: RequestInit) => {
      capturedBody = JSON.parse(options!.body as string)
      return { ok: true, text: () => Promise.resolve('{}') } as Response
    })

    const resultado = await enviarResumoDiarioHubVendas({ supabase: mockSupabase as never })

    expect(resultado.ok).toBe(true)
    if (resultado.ok) {
      expect(resultado.enviado).toBe(true)
    }
    expect(capturedBody).toBeTruthy()
  })

  it('registro unico do resumo por data local', async () => {
    const { obterPartesDataLocal } = await import('./tempo')
    const partes = obterPartesDataLocal(new Date(), 'America/Sao_Paulo')
    const pad = (n: number) => String(n).padStart(2, '0')
    const chaveEsperada = `${partes.ano}-${pad(partes.mes)}-${pad(partes.dia)}`

    // Simular resumo ja enviado
    alertasState.push({
      tipo: 'resumo_diario',
      chave_deduplicacao: chaveEsperada,
      status: 'enviado',
      enviado_em: new Date().toISOString(),
    })

    const enviadosAntes = alertasState.filter((a) => a.status === 'enviado' && a.tipo === 'resumo_diario').length

    await enviarResumoDiarioHubVendas({ supabase: mockSupabase as never })

    const enviadosDepois = alertasState.filter((a) => a.status === 'enviado' && a.tipo === 'resumo_diario').length
    expect(enviadosDepois).toBe(enviadosAntes)
  })

  it('metadata do resumo nao contem dados sensiveis', async () => {
    vi.mocked(fetchDigisacRaw).mockImplementationOnce(async () => ({
      ok: true,
      text: () => Promise.resolve('{}'),
    }) as Response)

    await enviarResumoDiarioHubVendas({ supabase: mockSupabase as never })

    const ultimo = alertasState[alertasState.length - 1]
    const metadata = JSON.stringify(ultimo.metadata)
    expect(metadata).not.toContain('Bearer')
    expect(metadata).not.toContain('Authorization')
    expect(metadata).not.toContain('token')
    expect(metadata).not.toContain('secret')
    expect(metadata).not.toMatch(/55\d{10,11}/)
  })
})
