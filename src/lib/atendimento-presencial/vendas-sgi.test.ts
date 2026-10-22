import { beforeEach, describe, expect, it, vi } from 'vitest'
import { resolverVendasSgi } from './vendas-sgi'
const params = { clienteId: 'cliente', usuarioId: 'usuario', perfil: 'consultora', unidades: [{ id: 'unidade' }], cliente: { telefone_informado: null, telefone_normalizado: null, telefone_normalizado_ddi: null } }
beforeEach(() => vi.restoreAllMocks())
describe('resolvedor SGI backend', () => {
  it('consulta uma vez com escopo verificado, inclusive sem telefone', async () => {
    const resultado = { vendas: [{ documentoId: 'doc' }], diagnosticos: { associado: 1 } }
    const rpc = vi.fn().mockResolvedValue({ data: resultado, error: null })
    expect(await resolverVendasSgi({ rpc }, { ...params, atendimentoId: 'atendimento' })).toEqual({ ...resultado, telefoneDisponivel: false })
    expect(rpc).toHaveBeenCalledExactlyOnceWith('atendimento_presencial_resolver_vendas_sgi', {
      p_cliente_id: 'cliente', p_usuario_id: 'usuario', p_perfil: 'consultora', p_unidades: ['unidade'], p_variacoes_telefone: [], p_atendimento_id: 'atendimento',
    })
  })
  it('preserva variantes telefônicas atuais', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { vendas: [], diagnosticos: {} }, error: null })
    await resolverVendasSgi({ rpc }, { ...params, cliente: { telefone_informado: null, telefone_normalizado: '41912345678', telefone_normalizado_ddi: '5541912345678' } })
    expect(rpc.mock.calls[0][1].p_variacoes_telefone).toEqual(expect.arrayContaining(['41912345678','5541912345678','4112345678']))
  })
  it('falha de banco é explícita e não registra dados pessoais', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { code: '42501', message: 'detalhe sensível' } })
    await expect(resolverVendasSgi({ rpc }, params)).rejects.toThrow('Não foi possível')
    expect(JSON.stringify(log.mock.calls)).not.toContain('sensível')
    expect(JSON.stringify(log.mock.calls)).not.toContain('cliente')
  })
  it('contrato inválido não vira histórico vazio', async () => {
    await expect(resolverVendasSgi({ rpc: vi.fn().mockResolvedValue({ data: null, error: null }) }, params)).rejects.toThrow('Resposta inválida')
  })
})
