import { describe, expect, it } from 'vitest'
import { decidirConclusaoRetorno, prepararFichaRetorno, validarVendaDigital } from './negociacoes'
import type { FichaDadosRascunho } from './ficha-schema'

const id = '10000000-0000-4000-8000-000000000001'
const agora = new Date('2026-11-04T18:00:00Z')
const venda = { clienteId: id, negociacaoId: id, unidadeId: id, consultora: 'ANA', canal: 'whatsapp',
  fechadoEm: '2026-11-04T14:00:00-03:00', numeroLancamento: '123456', observacoes: '',
  produtos: [{ descricao: 'Berço', quantidade: 2, vendido: true }] }

describe('venda digital sem visita presencial', () => {
  it('valida sem crianças, telefone ou essenciais e reutiliza normalização/lançamento', () => {
    const resultado = validarVendaDigital(venda, agora)
    expect(resultado.ok).toBe(true)
    if (!resultado.ok) throw new Error(resultado.message)
    expect(resultado.dados.produtos[0]).toEqual({ descricao: 'BERCO', quantidade: 2, vendido: true })
    expect(resultado.dados.numeroLancamento).toBe(123456)
    expect(resultado.dados.fechadoEm).toBe('2026-11-04T17:00:00.000Z')
    expect(resultado.dados).not.toHaveProperty('criancas')
  })
  it.each([{ produtos: [] }, { produtos: [{ descricao: 'BERCO', quantidade: 1, vendido: false }] }])('exige produto vendido', ({ produtos }) => {
    expect(validarVendaDigital({ ...venda, produtos }, agora)).toMatchObject({ ok: false, field: 'produtos' })
  })
  it.each([null, undefined, 0, -1, 1.5, 2147483648, '2'])('rejeita quantidade vendida inválida %s', quantidade => {
    expect(validarVendaDigital({ ...venda, produtos: [{ descricao: 'BERCO', quantidade, vendido: true }] }, agora).ok).toBe(false)
  })
  it.each(['R1234567', 1000000, 0, ''])('preserva contrato de lançamento %s', numeroLancamento => {
    expect(validarVendaDigital({ ...venda, numeroLancamento }, agora)).toMatchObject({ ok: false, field: 'numeroLancamento' })
  })
  it('não vende o marcador de produto não trabalhado', () => {
    expect(validarVendaDigital({ ...venda, produtos: [{ descricao: 'PRODUTO QUE NÃO TRABALHAMOS', quantidade: 1, vendido: true }] }, agora).ok).toBe(false)
  })
  it('preserva marcador sem quantidade/venda junto de um produto vendido', () => {
    const marcador = { descricao: 'PRODUTO QUE NÃO TRABALHAMOS', quantidade: null, vendido: null }
    const resultado = validarVendaDigital({ ...venda, produtos: [...venda.produtos, marcador] }, agora)
    expect(resultado).toMatchObject({ ok: true, dados: { produtos: [{ descricao: 'BERCO', quantidade: 2, vendido: true }, { descricao: 'PRODUTO QUE NAO TRABALHAMOS', quantidade: null, vendido: null }] } })
    expect(validarVendaDigital({ ...venda, produtos: [marcador] }, agora)).toMatchObject({ ok: false, field: 'produtos' })
  })
  it('exige canal e descrição do outro canal', () => {
    expect(validarVendaDigital({ ...venda, canal: '' }, agora)).toMatchObject({ ok: false, field: 'canal' })
    expect(validarVendaDigital({ ...venda, canal: 'outro' }, agora)).toMatchObject({ ok: false, field: 'canalOutro' })
  })
  it('rejeita data futura ou sem fuso', () => {
    expect(validarVendaDigital({ ...venda, fechadoEm: '2026-11-05T14:00:00Z' }, agora).ok).toBe(false)
    expect(validarVendaDigital({ ...venda, fechadoEm: '2026-11-04T14:00' }, agora).ok).toBe(false)
  })
})

it('prepara retorno sem copiar venda, lançamento, motivos ou confirmações; preserva identidades', () => {
  const origem: FichaDadosRascunho = { versaoFluxo: 2, tipoAtendimento: 'cliente', versaoEssenciais: 1,
    essenciais: { c: { banheira: 'nao' } }, resultadoAtendimento: 'negociacao', motivosResultado: ['outro'],
    motivoOutro: 'Anterior', observacoes: 'Anterior', departamentos: ['moveis'], etapaAtual: 'ficha',
    criancas: [{ id: 'c', situacao: 'ja_nasceu', criancaPermanenteId: id, vinculoClienteId: id, dataReferenciaNascimento: '2026-10-01' }],
    produtosInteresse: [{ descricao: 'BERCO', quantidade: 2, vendido: false }, { descricao: 'BANHEIRA', quantidade: 1, vendido: true }] }
  const retorno = prepararFichaRetorno(origem)
  expect(retorno.produtosInteresse).toEqual([{ descricao: 'BERCO', quantidade: 2, vendido: false }])
  expect(retorno.essenciais).toEqual({})
  expect(retorno.resultadoAtendimento).toBeUndefined()
  expect(retorno.motivosResultado).toEqual([])
  expect(retorno.observacoes).toBeUndefined()
  expect(retorno.criancas[0].criancaPermanenteId).toBe(id)
  expect(retorno.criancas[0]).not.toBe(origem.criancas[0])
  expect(origem.essenciais).toEqual({ c: { banheira: 'nao' } })
})

it('rascunhos não participam da exclusividade comercial; encerramento concorrente pede confirmação', () => {
  expect(decidirConclusaoRetorno('aberta', 'negociacao', false)).toBe('manter_aberta')
  expect(decidirConclusaoRetorno('aberta', 'sim', false)).toBe('encerrar')
  expect(decidirConclusaoRetorno('venda', 'sim', false)).toBe('confirmar_independente')
  expect(decidirConclusaoRetorno('venda', 'sim', true)).toBe('independente')
  expect(decidirConclusaoRetorno('perda', 'negociacao', true)).toBe('independente')
})
