import { describe, expect, it } from 'vitest'
import { confirmar, estaConfirmado, fase, identidade, produtosDaFase, resumo } from './modelo'
import { criarCrianca, criarSimulador } from './simulador'

describe('essenciais experimentais', () => {
  it.each([
    [-1,['berco','comoda','roupeiro','poltrona','kit','coleito','banheira','baba']],
    [0,['coleito','banheira']], [3,['coleito','banheira']], [4,['alimentacao','coleito']],
    [7,['alimentacao','coleito']], [8,['carro','montessori']], [12,['carro','montessori']], [13,[]],
  ] as const)('faixa %i exibe somente os produtos previstos', (meses, produtos) => expect(produtosDaFase(meses)).toEqual(produtos))
  it('não informado é diferente de não e Não pode ser reconfirmado diretamente', () => {
    const inicial = confirmar({}, 'a', 'coleito', 'nao', '1')
    expect(estaConfirmado(undefined, '1')).toBe(false)
    expect(estaConfirmado(inicial.a.coleito, '2')).toBe(false)
    const seguinte = confirmar(inicial, 'a', 'coleito', 'nao', '2')
    expect(estaConfirmado(seguinte.a.coleito, '2')).toBe(true)
    expect(inicial.a.coleito?.atendimento).toBe('1')
  })
  it('Sim permanece válido; correção e crianças independentes', () => {
    let dados = confirmar({}, 'a', 'coleito', 'sim', '1')
    dados = confirmar(dados, 'b', 'coleito', 'nao', '1')
    expect(estaConfirmado(dados.a.coleito, '2')).toBe(true)
    expect(dados.b.coleito?.resposta).toBe('nao')
    dados = confirmar(dados, 'b', 'coleito', 'sim', '2')
    expect(dados.a.coleito?.atendimento).toBe('1')
    expect(dados.b.coleito?.resposta).toBe('sim')
  })
  it('continuidade entre faixas e contadores derivados', () => {
    const dados = confirmar({}, 'a', 'coleito', 'sim', '1')
    expect(produtosDaFase(-1)).toContain('coleito')
    expect(produtosDaFase(2)).toContain('coleito')
    expect(resumo(produtosDaFase(5), dados.a, '2')).toEqual({ total: 2, respondidos: 1, sim: 1, nao: 0 })
    expect(dados.a.coleito?.resposta).toBe('sim')
  })
  it('não deduz idade atual de retrato antigo e usa mês de referência', () => {
    const crianca = criarCrianca(2)
    delete crianca.dataReferenciaNascimento
    expect(fase(crianca, '2026-10-27')).toBe(null)
    crianca.dataReferenciaNascimento = '2025-10-01'
    expect(fase(crianca, '2026-10-27')).toBe(12)
    expect(fase(crianca, '2026-11-01')).toBe(13)
    expect(identidade(crianca)).toBe(crianca.criancaPermanenteId)
  })
  it('transporte desconhecido falha fechado, sem usar fetch real', async () => {
    const sim = criarSimulador()
    const resposta = await sim.fetch('https://producao.invalid/operacao', { method: 'POST', body: '{}' })
    expect(resposta.status).toBe(400)
    const dto = await sim.fetch(`/api/atendimento-presencial/atendimentos/${sim.atual.id}/rascunho`)
    expect((await dto.json()).rascunho.id).toBe(sim.atual.id)
  })
  it('storage e rascunhos são privados a cada instância', () => {
    const a = criarSimulador(), b = criarSimulador()
    a.storage.setItem('teste', 'seguro')
    expect(b.storage.getItem('teste')).toBe(null)
    expect(a.atual.id).not.toBe(b.atual.id)
  })
})
