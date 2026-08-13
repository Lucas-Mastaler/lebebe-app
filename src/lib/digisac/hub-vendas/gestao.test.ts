import { describe, it, expect, vi } from 'vitest'
import {
  validarLimiteDiario,
  mascararTelefone,
  contarPorLoja,
  LIMITE_DIARIO_MAXIMO,
  alterarLimiteDiarioHubVendas,
  pausarAutomacaoHubVendas,
  reativarAutomacaoHubVendas,
  cancelarFilaAgendadaHubVendas,
  reprocessarFilaErroHubVendas,
  liberarAnaliseManualHubVendas,
  COLUNAS_TEMPORAIS_HUB_VENDAS,
  formatarPercentualHubVendas,
  calcularResumoCoorteLeadsHubVendas,
  filtrarLeadsPorDataEntradaHubVendas,
} from './gestao'

describe('colunas temporais dos KPIs Hub/Vendas', () => {
  it('usa data de entrada para a coorte de leads e mantém eventos das filas', () => {
    expect(COLUNAS_TEMPORAIS_HUB_VENDAS).toEqual({
      leadsRegistrados: 'data_entrada_hub',
      candidatosElegiveis: 'data_entrada_hub',
      convertidos: 'data_entrada_hub',
      recuperacaoEnviada: 'data_entrada_hub',
      recuperados: 'data_entrada_hub',
      perdidos: 'data_entrada_hub',
      filaManual: 'data_entrada_hub',
      filas: 'programado_para',
      enviados: 'enviado_em',
    })
    expect(Object.values(COLUNAS_TEMPORAIS_HUB_VENDAS)).not.toContain('updated_at')
  })

  it('calcula percentual com uma casa decimal e protege denominador zero', () => {
    expect(formatarPercentualHubVendas(20, 50)).toBe('40,0% do total')
    expect(formatarPercentualHubVendas(20, 0)).toBe('0,0% do total')
  })
})

describe('resumo da coorte de leads Hub/Vendas', () => {
  const periodo = {
    inicioIso: '2026-08-09T03:00:00.000Z',
    fimIso: '2026-08-14T03:00:00.000Z',
  }
  const opcoes = {
    limiteElegibilidadeIso: '2026-08-01T00:00:00.000Z',
    limitePosRecuperacaoIso: '2026-08-01T00:00:00.000Z',
  }

  it('seleciona somente pela entrada e classifica o status atual dos mesmos leads', () => {
    const leads = filtrarLeadsPorDataEntradaHubVendas([
      {
        status: 'convertido_organicamente',
        dataEntradaHub: '2026-08-10T10:00:00.000Z',
        dataRecuperacaoEnviada: null,
        lojaPrincipal: 'portao',
        conexaoRecuperacaoId: null,
      },
      {
        status: 'encerrado',
        dataEntradaHub: '2026-08-12T10:00:00.000Z',
        dataRecuperacaoEnviada: null,
        lojaPrincipal: null,
        conexaoRecuperacaoId: 'c60d720f-5ad5-4a1b-bedb-e51495dee686',
      },
      {
        status: 'fila_manual',
        dataEntradaHub: '2026-08-08T23:59:59.999Z',
        dataRecuperacaoEnviada: null,
        lojaPrincipal: null,
        conexaoRecuperacaoId: null,
      },
    ], periodo)

    const resumo = calcularResumoCoorteLeadsHubVendas(leads, opcoes)

    expect(resumo.leadsRegistrados).toBe(2)
    expect(resumo.convertidos.total).toBe(1)
    expect(resumo.convertidos.porLoja.find((loja) => loja.loja === 'portao')?.total).toBe(1)
    expect(resumo.perdidos.total).toBe(1)
    expect(resumo.filaManual).toBe(0)
  })

  it('preserva todos os registros quando não há filtro e aplica as janelas de elegibilidade', () => {
    const leads = [
      {
        status: 'aguardando_conversao',
        dataEntradaHub: '2026-08-10T10:00:00.000Z',
        dataRecuperacaoEnviada: null,
        lojaPrincipal: null,
        conexaoRecuperacaoId: null,
      },
      {
        status: 'recuperacao_enviada',
        dataEntradaHub: '2026-08-10T11:00:00.000Z',
        dataRecuperacaoEnviada: '2026-08-10T11:30:00.000Z',
        lojaPrincipal: null,
        conexaoRecuperacaoId: 'c60d720f-5ad5-4a1b-bedb-e51495dee686',
      },
      {
        status: 'recuperado',
        dataEntradaHub: '2026-07-01T10:00:00.000Z',
        dataRecuperacaoEnviada: null,
        lojaPrincipal: null,
        conexaoRecuperacaoId: 'c60d720f-5ad5-4a1b-bedb-e51495dee686',
      },
    ]

    const resumo = calcularResumoCoorteLeadsHubVendas(
      filtrarLeadsPorDataEntradaHubVendas(leads),
      opcoes
    )

    expect(resumo.leadsRegistrados).toBe(3)
    expect(resumo.candidatosElegiveis).toBe(1)
    expect(resumo.recuperacaoEnviada.total).toBe(1)
    expect(resumo.recuperados.total).toBe(1)
  })
})

describe('validarLimiteDiario', () => {
  it('aceita valor inteiro positivo dentro do máximo', () => {
    const r = validarLimiteDiario(10)
    expect(r.ok).toBe(true)
    expect(r.valor).toBe(10)
    expect(r.erro).toBeNull()
  })

  it('aceita zero', () => {
    const r = validarLimiteDiario(0)
    expect(r.ok).toBe(true)
    expect(r.valor).toBe(0)
  })

  it('aceita valor igual ao máximo seguro', () => {
    const r = validarLimiteDiario(LIMITE_DIARIO_MAXIMO)
    expect(r.ok).toBe(true)
    expect(r.valor).toBe(LIMITE_DIARIO_MAXIMO)
  })

  it('rejeita valor acima do máximo seguro', () => {
    const r = validarLimiteDiario(LIMITE_DIARIO_MAXIMO + 1)
    expect(r.ok).toBe(false)
    expect(r.valor).toBeNull()
    expect(r.erro).toContain('máximo')
  })

  it('rejeita valor negativo', () => {
    const r = validarLimiteDiario(-1)
    expect(r.ok).toBe(false)
    expect(r.erro).toContain('negativo')
  })

  it('rejeita valor decimal', () => {
    const r = validarLimiteDiario(5.5)
    expect(r.ok).toBe(false)
    expect(r.erro).toContain('inteiro')
  })

  it('rejeita NaN', () => {
    const r = validarLimiteDiario(NaN)
    expect(r.ok).toBe(false)
  })

  it('rejeita Infinity', () => {
    const r = validarLimiteDiario(Infinity)
    expect(r.ok).toBe(false)
  })

  it('aceita string numérica inteira positiva', () => {
    const r = validarLimiteDiario('15')
    expect(r.ok).toBe(true)
    expect(r.valor).toBe(15)
  })

  it('rejeita string vazia', () => {
    const r = validarLimiteDiario('')
    expect(r.ok).toBe(false)
    expect(r.erro).toContain('vazio')
  })

  it('rejeita string apenas com espaços', () => {
    const r = validarLimiteDiario('   ')
    expect(r.ok).toBe(false)
    expect(r.erro).toContain('vazio')
  })

  it('rejeita string não numérica', () => {
    const r = validarLimiteDiario('abc')
    expect(r.ok).toBe(false)
    expect(r.erro).toContain('número inteiro')
  })

  it('rejeita string decimal', () => {
    const r = validarLimiteDiario('10.5')
    expect(r.ok).toBe(false)
    expect(r.erro).toContain('número inteiro')
  })

  it('rejeita string negativa', () => {
    const r = validarLimiteDiario('-5')
    expect(r.ok).toBe(false)
    expect(r.erro).toContain('negativo')
  })

  it('rejeita string acima do máximo', () => {
    const r = validarLimiteDiario(String(LIMITE_DIARIO_MAXIMO + 1))
    expect(r.ok).toBe(false)
    expect(r.erro).toContain('máximo')
  })

  it('rejeita tipo inválido (objeto)', () => {
    const r = validarLimiteDiario({ valor: 10 })
    expect(r.ok).toBe(false)
    expect(r.erro).toContain('Tipo')
  })

  it('rejeita tipo inválido (array)', () => {
    const r = validarLimiteDiario([10])
    expect(r.ok).toBe(false)
  })

  it('rejeita null', () => {
    const r = validarLimiteDiario(null)
    expect(r.ok).toBe(false)
  })

  it('rejeita undefined', () => {
    const r = validarLimiteDiario(undefined)
    expect(r.ok).toBe(false)
  })
})

describe('mascararTelefone', () => {
  it('retorna null para null', () => {
    expect(mascararTelefone(null)).toBeNull()
  })

  it('retorna null para string vazia', () => {
    expect(mascararTelefone('')).toBeNull()
  })

  it('mascara telefone brasileiro com DDI + DDD (12+ dígitos)', () => {
    const r = mascararTelefone('554184426528')
    expect(r).toBe('+55 41 ****-6528')
  })

  it('mascara telefone com 10 dígitos', () => {
    const r = mascararTelefone('5541844265')
    expect(r).toBe('+55 ** ****-4265')
  })

  it('mascara telefone curto (8 dígitos)', () => {
    const r = mascararTelefone('84426528')
    expect(r).toBe('** ****-6528')
  })

  it('preserva apenas dígitos, ignorando formatação', () => {
    const r = mascararTelefone('+55 (41) 8442-6528')
    expect(r).toBe('+55 41 ****-6528')
  })

  it('retorna *** para telefone muito curto', () => {
    const r = mascararTelefone('123')
    expect(r).toBe('***')
  })
})

describe('contarPorLoja', () => {
  it('conta valores agrupando pela loja resolvida, ignorando nulos e desconhecidos', () => {
    const r = contarPorLoja(
      ['portao', 'portao', 'bigorrilho', null, 'loja_inexistente', 'hauer_marechal'],
      (valor) => (['portao', 'bigorrilho', 'hauer_marechal'].includes(valor) ? (valor as 'portao') : null)
    )
    expect(r.total).toBe(4)
    expect(r.porLoja).toEqual([
      { loja: 'portao', nomeExibicao: 'Portão', total: 2 },
      { loja: 'bigorrilho', nomeExibicao: 'Bigorrilho', total: 1 },
      { loja: 'hauer_marechal', nomeExibicao: 'Hauer', total: 1 },
    ])
  })

  it('retorna todas as lojas com total zero quando não há valores', () => {
    const r = contarPorLoja([], () => null)
    expect(r.total).toBe(0)
    expect(r.porLoja.every((item) => item.total === 0)).toBe(true)
    expect(r.porLoja).toHaveLength(3)
  })
})


describe('acoes administrativas transacionais', () => {
  function criarSupabaseFake(resposta?: unknown, erro?: { message: string }) {
    return {
      rpc: vi.fn().mockResolvedValue({ data: resposta, error: erro ?? null })
    }
  }

  it('alterar limite chama RPC com parametros corretos', async () => {
    const supabase = criarSupabaseFake({
      ok: true,
      valor_anterior: 10,
      valor_novo: 20,
      atualizado_em: '2026-08-06T18:00:00.000Z'
    })
    const r = await alterarLimiteDiarioHubVendas(20, 'admin@example.com', supabase as never)
    expect(supabase.rpc).toHaveBeenCalledWith('hub_vendas_alterar_limite_diario', {
      p_email: 'admin@example.com',
      p_novo_limite: 20
    })
    expect(r).toMatchObject({
      ok: true,
      valorAnterior: 10,
      valorNovo: 20
    })
  })

  it('pausar automacao chama RPC com parametros corretos', async () => {
    const supabase = criarSupabaseFake({
      ok: true,
      pausada: true,
      motivo: 'manutencao',
      atualizado_em: '2026-08-06T18:00:00.000Z'
    })
    const r = await pausarAutomacaoHubVendas('manutencao', 'admin@example.com', supabase as never)
    expect(supabase.rpc).toHaveBeenCalledWith('hub_vendas_pausar_automacao', {
      p_email: 'admin@example.com',
      p_motivo: 'manutencao'
    })
    expect(r.pausada).toBe(true)
    expect(r.motivo).toBe('manutencao')
  })

  it('reativar automacao chama RPC com parametros corretos', async () => {
    const supabase = criarSupabaseFake({
      ok: true,
      pausada: false,
      motivo: 'retomada',
      atualizado_em: '2026-08-06T18:00:00.000Z'
    })
    const r = await reativarAutomacaoHubVendas('retomada', 'admin@example.com', supabase as never)
    expect(supabase.rpc).toHaveBeenCalledWith('hub_vendas_reativar_automacao', {
      p_email: 'admin@example.com',
      p_motivo: 'retomada'
    })
    expect(r.pausada).toBe(false)
    expect(r.motivo).toBe('retomada')
  })

  it('cancelar fila chama RPC com parametros corretos', async () => {
    const supabase = criarSupabaseFake({
      ok: true,
      fila_id: '123e4567-e89b-12d3-a456-426614174000',
      status: 'cancelado'
    })
    const r = await cancelarFilaAgendadaHubVendas('123e4567-e89b-12d3-a456-426614174000', 'motivo', 'admin@example.com', supabase as never)
    expect(supabase.rpc).toHaveBeenCalledWith('hub_vendas_cancelar_fila_agendada', {
      p_email: 'admin@example.com',
      p_fila_id: '123e4567-e89b-12d3-a456-426614174000',
      p_motivo: 'motivo'
    })
    expect(r.status).toBe('cancelado')
  })

  it('reprocessar fila chama RPC com parametros corretos', async () => {
    const supabase = criarSupabaseFake({
      ok: true,
      fila_id: '123e4567-e89b-12d3-a456-426614174000',
      status: 'agendado'
    })
    const r = await reprocessarFilaErroHubVendas('123e4567-e89b-12d3-a456-426614174000', 'admin@example.com', supabase as never)
    expect(supabase.rpc).toHaveBeenCalledWith('hub_vendas_reprocessar_fila_erro', {
      p_email: 'admin@example.com',
      p_fila_id: '123e4567-e89b-12d3-a456-426614174000'
    })
    expect(r.status).toBe('agendado')
  })

  it('liberar analise manual chama RPC com parametros corretos', async () => {
    const supabase = criarSupabaseFake({
      ok: true,
      fila_id: '123e4567-e89b-12d3-a456-426614174000',
      status: 'cancelado'
    })
    const r = await liberarAnaliseManualHubVendas('123e4567-e89b-12d3-a456-426614174000', 'motivo', 'admin@example.com', supabase as never)
    expect(supabase.rpc).toHaveBeenCalledWith('hub_vendas_liberar_analise_manual', {
      p_email: 'admin@example.com',
      p_fila_id: '123e4567-e89b-12d3-a456-426614174000',
      p_motivo: 'motivo'
    })
    expect(r.status).toBe('cancelado')
  })

  it('propaga erro da RPC sem alterar dados', async () => {
    const supabase = criarSupabaseFake(undefined, { message: 'transicao invalida' })
    await expect(
      cancelarFilaAgendadaHubVendas('123e4567-e89b-12d3-a456-426614174000', 'motivo', 'admin@example.com', supabase as never)
    ).rejects.toThrow('transicao invalida')
  })
})
