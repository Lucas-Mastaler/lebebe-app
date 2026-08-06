import { describe, expect, it, vi, beforeEach } from 'vitest'

// Mocks
vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => mockSupabase,
}))

vi.mock('@/lib/digisac/clienteDigisac', () => ({
  fetchDigisacRaw: vi.fn(),
  sanitizarDigisacParaLog: (s: string) => s
    .replace(/Bearer\s+\S+/g, 'Bearer [redacted]')
    .replace(/password\s+\S+/gi, 'password [redacted]')
    .replace(/55\d{10,11}/g, '[telefone_redacted]'),
}))

const { fetchDigisacRaw } = await import('@/lib/digisac/clienteDigisac')

// Mock supabase com tabela hub_vendas_alertas
const alertasState: Array<Record<string, unknown>> = []

function chainSelect() {
  const obj: Record<string, unknown> = {}
  obj.eq = () => obj
  obj.gte = () => obj
  obj.lt = () => obj
  obj.order = () => obj
  obj.limit = () => Promise.resolve({ data: alertasState.filter((a) => a.status === 'enviado').slice(0, 1), error: null })
  obj.then = (resolve: (v: unknown) => void) => {
    Promise.resolve({ data: alertasState.filter((a) => a.status === 'enviado').slice(0, 1), error: null }).then(resolve)
  }
  return obj
}

const mockSupabase = {
  from(table: string) {
    if (table === 'hub_vendas_alertas') {
      return {
        select: () => chainSelect(),
        insert: (row: Record<string, unknown>) => {
          alertasState.push(row)
          return Promise.resolve({ error: null })
        },
      }
    }
    return {
      select: () => chainSelect(),
      insert: () => Promise.resolve({ error: null }),
    }
  },
  rpc: () => Promise.resolve({ data: [], error: null }),
}

// Importar depois dos mocks
const {
  enviarAlertaOperacionalHubVendas,
  alertarConexaoPausadaAutomatica,
  alertarErroEnvio,
  alertarResultadoIncerto,
  alertarAnaliseManual,
  alertarTesteManual,
} = await import('./alertas')

describe('alertas Hub/Vendas', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    alertasState.length = 0
    process.env.DIGISAC_BOT_USER_ID = 'bot-user-test-id'
    process.env.HUB_VENDAS_ALERTAS_CONTACT_ID = 'contact-test-id'
    process.env.HUB_VENDAS_ALERTAS_SERVICE_ID = 'service-test-id'
  })

  it('envia alerta como bot com origin=bot e userId do bot', async () => {
    let capturedBody: Record<string, unknown> | null = null
    vi.mocked(fetchDigisacRaw).mockImplementationOnce(async (_endpoint: string, options?: RequestInit) => {
      capturedBody = JSON.parse(options!.body as string)
      return {
        ok: true,
        text: () => Promise.resolve(JSON.stringify({ id: 'msg-1' })),
      } as Response
    })

    await enviarAlertaOperacionalHubVendas({
      tipo: 'erro_envio',
      chaveDeduplicacao: 'fila:abc',
      texto: 'HUB/VENDAS — ❌ ERRO DE ENVIO',
    })

    expect(capturedBody).toBeTruthy()
    expect(capturedBody!.origin).toBe('bot')
    expect(capturedBody!.userId).toBe('bot-user-test-id')
    expect(capturedBody!.fromMe).toBe(true)
    expect(capturedBody!.contactId).toBe('contact-test-id')
    expect(capturedBody!.serviceId).toBe('service-test-id')
  })

  it('usa contato e serviço técnicos corretos', async () => {
    let capturedBody: Record<string, unknown> | null = null
    vi.mocked(fetchDigisacRaw).mockImplementationOnce(async (_endpoint: string, options?: RequestInit) => {
      capturedBody = JSON.parse(options!.body as string)
      return { ok: true, text: () => Promise.resolve('{}') } as Response
    })

    await enviarAlertaOperacionalHubVendas({
      tipo: 'conexao_pausada_automatica',
      chaveDeduplicacao: 'conexao:xyz',
      texto: 'alerta teste',
    })

    expect(capturedBody!.contactId).toBe('contact-test-id')
    expect(capturedBody!.serviceId).toBe('service-test-id')
  })

  it('deduplica alerta repetido dentro da janela', async () => {
    // Primeiro envio
    vi.mocked(fetchDigisacRaw).mockImplementationOnce(async () => ({
      ok: true,
      text: () => Promise.resolve('{}'),
    }) as Response)

    await enviarAlertaOperacionalHubVendas({
      tipo: 'erro_envio',
      chaveDeduplicacao: 'fila:dedup-test',
      texto: 'primeiro alerta',
    })

    // Simular que o alerta já foi enviado (inserir na state)
    alertasState.push({
      tipo: 'erro_envio',
      chave_deduplicacao: 'fila:dedup-test',
      status: 'enviado',
      enviado_em: new Date().toISOString(),
    })

    // Segundo envio — deve ser deduplicado
    const fetchSpy = vi.mocked(fetchDigisacRaw)
    fetchSpy.mockClear()

    await enviarAlertaOperacionalHubVendas({
      tipo: 'erro_envio',
      chaveDeduplicacao: 'fila:dedup-test',
      texto: 'segundo alerta',
    })

    // fetchDigisacRaw não deve ter sido chamado (deduplicado)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('falha do alerta não propaga erro nem altera fila do cliente', async () => {
    vi.mocked(fetchDigisacRaw).mockImplementationOnce(async () => ({
      ok: false,
      status: 500,
      text: () => Promise.resolve('erro interno'),
    }) as unknown as Response)

    // Não deve lançar erro
    const resultado = await enviarAlertaOperacionalHubVendas({
      tipo: 'erro_envio',
      chaveDeduplicacao: 'fila:falha-test',
      texto: 'alerta com falha',
    })

    expect(resultado.ok).toBe(false)
  })

  it('alertarConexaoPausadaAutomatica envia com tipo correto', async () => {
    let capturedBody: Record<string, unknown> | null = null
    vi.mocked(fetchDigisacRaw).mockImplementationOnce(async (_endpoint: string, options?: RequestInit) => {
      capturedBody = JSON.parse(options!.body as string)
      return { ok: true, text: () => Promise.resolve('{}') } as Response
    })

    await alertarConexaoPausadaAutomatica({
      serviceId: 'c60d720f-5ad5-4a1b-bedb-e51495dee686',
      errosConsecutivos: 3,
      motivo: '3 erros consecutivos',
    })

    expect(capturedBody).toBeTruthy()
    expect(capturedBody!.origin).toBe('bot')
    // O texto deve conter "CONEXÃO PAUSADA"
    expect(String(capturedBody!.text)).toContain('CONEXÃO PAUSADA')
  })

  it('alertarErroEnvio inclui loja e fila abreviada', async () => {
    let capturedBody: Record<string, unknown> | null = null
    vi.mocked(fetchDigisacRaw).mockImplementationOnce(async (_endpoint: string, options?: RequestInit) => {
      capturedBody = JSON.parse(options!.body as string)
      return { ok: true, text: () => Promise.resolve('{}') } as Response
    })

    await alertarErroEnvio({
      filaId: '12345678-1234-1234-1234-123456789012',
      serviceId: 'c60d720f-5ad5-4a1b-bedb-e51495dee686',
      tentativa: 2,
      erro: 'mensagem_api_erro status=500',
      retryAgendado: true,
    })

    expect(capturedBody).toBeTruthy()
    const texto = String(capturedBody!.text)
    expect(texto).toContain('Portão')
    expect(texto).toContain('12345678')
    expect(texto).toContain('ERRO DE ENVIO')
  })

  it('alertarResultadoIncerto envia com tipo correto', async () => {
    let capturedBody: Record<string, unknown> | null = null
    vi.mocked(fetchDigisacRaw).mockImplementationOnce(async (_endpoint: string, options?: RequestInit) => {
      capturedBody = JSON.parse(options!.body as string)
      return { ok: true, text: () => Promise.resolve('{}') } as Response
    })

    await alertarResultadoIncerto({
      filaId: 'abcdef12-1234-1234-1234-123456789012',
      serviceId: '0973f84b-8294-4615-9657-ba95b6346246',
      erro: 'timeout',
    })

    expect(capturedBody).toBeTruthy()
    expect(String(capturedBody!.text)).toContain('RESULTADO INCERTO')
    expect(String(capturedBody!.text)).toContain('Bigorrilho')
  })

  it('alertarAnaliseManual envia com tipo correto', async () => {
    let capturedBody: Record<string, unknown> | null = null
    vi.mocked(fetchDigisacRaw).mockImplementationOnce(async (_endpoint: string, options?: RequestInit) => {
      capturedBody = JSON.parse(options!.body as string)
      return { ok: true, text: () => Promise.resolve('{}') } as Response
    })

    await alertarAnaliseManual({
      filaId: 'abcdef12-1234-1234-1234-123456789012',
      serviceId: '1352c41b-80a9-4e74-b9d9-4c5e7aed060e',
      categoria: 'placeholder_nao_resolvido',
    })

    expect(capturedBody).toBeTruthy()
    expect(String(capturedBody!.text)).toContain('ANÁLISE MANUAL')
    expect(String(capturedBody!.text)).toContain('Hauer')
  })

  it('não inclui tokens Bearer no texto do alerta', async () => {
    let capturedBody: Record<string, unknown> | null = null
    vi.mocked(fetchDigisacRaw).mockImplementationOnce(async (_endpoint: string, options?: RequestInit) => {
      capturedBody = JSON.parse(options!.body as string)
      return { ok: true, text: () => Promise.resolve('{}') } as Response
    })

    await alertarErroEnvio({
      filaId: '12345678-1234-1234-1234-123456789012',
      serviceId: 'c60d720f-5ad5-4a1b-bedb-e51495dee686',
      tentativa: 1,
      erro: 'Bearer abc123 secret token',
      retryAgendado: false,
    })

    const texto = String(capturedBody!.text)
    // O sanitizador deve remover tokens Bearer
    expect(texto).not.toContain('Bearer abc123')
  })

  it('registra alerta enviado com status = enviado', async () => {
    vi.mocked(fetchDigisacRaw).mockImplementationOnce(async () => ({
      ok: true,
      text: () => Promise.resolve('{}'),
    }) as Response)

    await enviarAlertaOperacionalHubVendas({
      tipo: 'erro_envio',
      chaveDeduplicacao: 'fila:status-test',
      texto: 'alerta',
    })

    const ultimo = alertasState[alertasState.length - 1]
    expect(ultimo.status).toBe('enviado')
    expect(ultimo.tipo).toBe('erro_envio')
  })

  it('registra alerta falho com status = falha', async () => {
    vi.mocked(fetchDigisacRaw).mockImplementationOnce(async () => ({
      ok: false,
      status: 500,
      text: () => Promise.resolve('erro'),
    }) as unknown as Response)

    await enviarAlertaOperacionalHubVendas({
      tipo: 'erro_envio',
      chaveDeduplicacao: 'fila:falha-test',
      texto: 'alerta',
    })

    const ultimo = alertasState[alertasState.length - 1]
    expect(ultimo.status).toBe('falha')
  })

  it('não cria registro ao deduplicar alerta', async () => {
    const inseridosAntes = alertasState.length

    // Simula alerta ja enviado
    alertasState.push({
      tipo: 'erro_envio',
      chave_deduplicacao: 'fila:nao-duplicar',
      status: 'enviado',
      enviado_em: new Date().toISOString(),
    })

    const fetchSpy = vi.mocked(fetchDigisacRaw)
    fetchSpy.mockClear()

    await enviarAlertaOperacionalHubVendas({
      tipo: 'erro_envio',
      chaveDeduplicacao: 'fila:nao-duplicar',
      texto: 'alerta',
    })

    // Nao chamou fetch nem inseriu novo registro
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(alertasState.length).toBe(inseridosAntes + 1)
    expect(alertasState[alertasState.length - 1].chave_deduplicacao).toBe('fila:nao-duplicar')
    expect(alertasState[alertasState.length - 1].status).not.toBe('deduplicado')
  })

  it('nunca tenta inserir status = deduplicado', async () => {
    const inseridosAntes = alertasState.length

    // Simula alerta ja enviado para deduplicar
    alertasState.push({
      tipo: 'erro_envio',
      chave_deduplicacao: 'fila:sem-deduplicado-status',
      status: 'enviado',
      enviado_em: new Date().toISOString(),
    })

    await enviarAlertaOperacionalHubVendas({
      tipo: 'erro_envio',
      chaveDeduplicacao: 'fila:sem-deduplicado-status',
      texto: 'alerta',
    })

    // Nenhum registro com status deduplicado deve existir
    expect(alertasState.some((a) => a.status === 'deduplicado')).toBe(false)
    expect(alertasState.length).toBe(inseridosAntes + 1)
  })

  it('metadata do alerta nao contem dados sensiveis', async () => {
    vi.mocked(fetchDigisacRaw).mockImplementationOnce(async () => ({
      ok: true,
      text: () => Promise.resolve('{}'),
    }) as Response)

    await enviarAlertaOperacionalHubVendas({
      tipo: 'erro_envio',
      chaveDeduplicacao: 'fila:metadata-seguro',
      texto: 'alerta',
      metadata: {
        erro: 'Bearer token-abc-123',
        telefone: '5541999999999',
        serviceId: 'c60d720f-5ad5-4a1b-bedb-e51495dee686',
      },
    })

    const ultimo = alertasState[alertasState.length - 1]
    const metadata = JSON.stringify(ultimo.metadata)
    expect(metadata).not.toContain('Bearer')
    expect(metadata).not.toContain('token-abc-123')
    expect(metadata).not.toContain('5541999999999')
  })

  it('alertarTesteManual envia como bot com tipo teste_manual', async () => {
    let capturedBody: Record<string, unknown> | null = null
    vi.mocked(fetchDigisacRaw).mockImplementationOnce(async (_endpoint: string, options?: RequestInit) => {
      capturedBody = JSON.parse(options!.body as string)
      return { ok: true, text: () => Promise.resolve('{}') } as Response
    })

    const resultado = await alertarTesteManual()
    expect(resultado.ok).toBe(true)
    expect(capturedBody).toBeTruthy()
    expect(capturedBody!.origin).toBe('bot')
    expect(capturedBody!.fromMe).toBe(true)
    expect(capturedBody!.userId).toBe('bot-user-test-id')
    expect(capturedBody!.contactId).toBe('contact-test-id')
    expect(capturedBody!.serviceId).toBe('service-test-id')

    const ultimo = alertasState[alertasState.length - 1]
    expect(ultimo.tipo).toBe('teste_manual')
    expect(ultimo.status).toBe('enviado')
  })

  it('alertarTesteManual falha registra status = falha', async () => {
    vi.mocked(fetchDigisacRaw).mockImplementationOnce(async () => ({
      ok: false,
      status: 500,
      text: () => Promise.resolve('erro'),
    }) as unknown as Response)

    const resultado = await alertarTesteManual()
    expect(resultado.ok).toBe(false)

    const ultimo = alertasState[alertasState.length - 1]
    expect(ultimo.tipo).toBe('teste_manual')
    expect(ultimo.status).toBe('falha')
  })

  it('alertarTesteManual não cria fila nem altera lead/config', async () => {
    vi.mocked(fetchDigisacRaw).mockImplementationOnce(async () => ({
      ok: true,
      text: () => Promise.resolve('{}'),
    }) as Response)

    await alertarTesteManual()

    // O mock do supabase não tem update/delete em filas/leads/config
    // Apenas insert em hub_vendas_alertas é chamado
    const registrosAlertas = alertasState.filter((a) => a.tipo === 'teste_manual')
    expect(registrosAlertas.length).toBe(1)
  })

  it('alertarTesteManual metadata não contém dados sensíveis', async () => {
    vi.mocked(fetchDigisacRaw).mockImplementationOnce(async () => ({
      ok: true,
      text: () => Promise.resolve('{}'),
    }) as Response)

    await alertarTesteManual()

    const ultimo = alertasState[alertasState.length - 1]
    const metadata = JSON.stringify(ultimo.metadata)
    expect(metadata).not.toContain('Bearer')
    expect(metadata).not.toContain('token')
    expect(metadata).not.toContain('secret')
    expect(metadata).not.toContain('Authorization')
    expect(metadata).not.toMatch(/55\d{10,11}/)
  })

  it('alertarTesteManual texto não contém dados sensíveis', async () => {
    let capturedBody: Record<string, unknown> | null = null
    vi.mocked(fetchDigisacRaw).mockImplementationOnce(async (_endpoint: string, options?: RequestInit) => {
      capturedBody = JSON.parse(options!.body as string)
      return { ok: true, text: () => Promise.resolve('{}') } as Response
    })

    await alertarTesteManual()

    const texto = String(capturedBody!.text)
    expect(texto).toContain('TESTE DE ALERTA')
    expect(texto).not.toContain('Bearer')
    expect(texto).not.toContain('token')
    expect(texto).not.toContain('secret')
    expect(texto).not.toContain('Authorization')
  })

  it('alertarTesteManual deduplicação curta por minuto', async () => {
    // Primeiro envio
    vi.mocked(fetchDigisacRaw).mockImplementationOnce(async () => ({
      ok: true,
      text: () => Promise.resolve('{}'),
    }) as Response)
    await alertarTesteManual()

    // Segundo envio no mesmo minuto — deve deduplicar
    const fetchSpy = vi.mocked(fetchDigisacRaw)
    fetchSpy.mockClear()

    const resultado = await alertarTesteManual()
    expect(resultado.ok).toBe(true)
    if (resultado.ok) {
      expect(resultado.deduplicado).toBe(true)
    }
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})
