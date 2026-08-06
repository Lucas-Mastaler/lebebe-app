import { describe, it, expect, vi } from 'vitest'
import {
  validarLimiteDiario,
  mascararTelefone,
  LIMITE_DIARIO_MAXIMO,
  alterarLimiteDiarioHubVendas,
  pausarAutomacaoHubVendas,
  reativarAutomacaoHubVendas,
  cancelarFilaAgendadaHubVendas,
  reprocessarFilaErroHubVendas,
  liberarAnaliseManualHubVendas,
} from './gestao'

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
    expect(r).toBe('+55 41 ****-****')
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
    expect(r).toBe('+55 41 ****-****')
  })

  it('retorna *** para telefone muito curto', () => {
    const r = mascararTelefone('123')
    expect(r).toBe('***')
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