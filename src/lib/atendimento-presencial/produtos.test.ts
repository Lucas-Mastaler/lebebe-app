import { describe, expect, it } from 'vitest'
import { calcularPv, chaveProduto, estruturarProduto, incrementarProduto, produtoNaoTrabalhado, PRODUTO_NAO_TRABALHAMOS, QUANTIDADE_PRODUTO_MAX } from './produtos'
import { validarFichaDadosRascunho, migrarFichaDadosRascunho } from './ficha-schema'
import { serializarPayloadAutosave } from './autosave-fila'
import { normalizarDetalheParaFichaEdicao } from './registros'

const item = (descricao: string, quantidade: number | null = 1, vendido: boolean | null = false) => ({ descricao, quantidade, vendido })
const dados = { criancas: [], departamentos: [], produtosInteresse: [item('BERÇO')], motivosResultado: [], etapaAtual: 'ficha' as const, versaoProdutos: 2 as const }

describe('Produtos estruturados e PV', () => {
  it('compara nomes exatos sem acentos, caixa e espaços; mantém produtos diferentes', () => {
    for (const nome of ['BERÇO', 'berco', ' Berço  ', 'bêrÇó']) expect(chaveProduto(nome)).toBe('BERCO')
    expect(chaveProduto('  CAMA   BABÁ ')).toBe('CAMA BABA')
    expect(chaveProduto('BERÇO BRANCO')).not.toBe(chaveProduto('BERÇO'))
  })
  it('incrementa sem alterar grafia/venda e respeita integer', () => {
    expect(incrementarProduto(item('Berço', 2, true))).toEqual(item('Berço', 3, true))
    expect(incrementarProduto('berço')).toEqual(item('berço', 1, null))
    expect(incrementarProduto(item('x', QUANTIDADE_PRODUTO_MAX))).toEqual(item('x', QUANTIDADE_PRODUTO_MAX))
  })
  it.each([0, 3, 5, 6])('PV %i usa peças vendidas, sem interesse ou marcador', valor => {
    expect(calcularPv([item('BERÇO', valor || 1, valor > 0), item('POLTRONA', 20), item(PRODUTO_NAO_TRABALHAMOS, null, null)], 2)).toEqual({ valor, informado: true, incompleto: false })
  })
  it('exemplo aprovado soma 3 peças', () => {
    expect(calcularPv([item('BERÇO', 1, true), item('CÔMODA', 1, true), item('POLTRONA', 2), item('NANINHA', 1, true)], 2).valor).toBe(3)
  })
  it('distingue zero novo, histórico desconhecido e informação parcial', () => {
    expect(calcularPv([], 2)).toEqual({ valor: 0, informado: true, incompleto: false })
    expect(calcularPv([]).informado).toBe(false)
    expect(calcularPv(['Berço']).informado).toBe(false)
    expect(calcularPv(['Berço', item('CAMA', 2, true)], 2)).toEqual({ valor: 2, informado: true, incompleto: true })
    expect(estruturarProduto('Berço')).toEqual(item('Berço', null, null))
    expect(produtoNaoTrabalhado('produto que nao trabalhamos')).toBe(true)
  })
  it('normaliza e retoma os dois formatos sem converter histórico', () => {
    expect(migrarFichaDadosRascunho(dados)).toMatchObject(dados)
    expect(migrarFichaDadosRascunho({ ...dados, versaoProdutos: undefined, produtosInteresse: ['Berço'] }).produtosInteresse).toEqual(['Berço'])
    expect(migrarFichaDadosRascunho({ ...dados, produtosInteresse: [item('Berço', null, null), item('berco', null, null)] }).produtosInteresse).toHaveLength(2)
  })
  it.each([item('X', 0), item('X', 1.5), item('X', QUANTIDADE_PRODUTO_MAX + 1), item('X', null, true), item(PRODUTO_NAO_TRABALHAMOS), item('', 1), { descricao: 'x', quantidade: 1 }, { ...item('x'), extra: true }])('rejeita produto inválido %j', produto => {
    expect(validarFichaDadosRascunho({ ...dados, produtosInteresse: [produto] }).ok).toBe(false)
  })
  it('não aceita objetos sem versão e mantém o teto de linhas', () => {
    expect(validarFichaDadosRascunho({ ...dados, versaoProdutos: undefined }).ok).toBe(false)
    expect(validarFichaDadosRascunho({ ...dados, produtosInteresse: Array.from({ length: 21 }, (_, i) => item(String(i))) }).ok).toBe(false)
  })
  it('preserva linhas com nomes iguais após edição, inclusive quantidade/venda distintas', () => {
    const produtosInteresse = [item('BERÇO NATURE', 3, true), item('BERÇO NATURE', 2, false)]
    const resultado = validarFichaDadosRascunho({ ...dados, produtosInteresse })
    expect(resultado.ok && resultado.dados.produtosInteresse).toEqual(produtosInteresse)
    expect(calcularPv(produtosInteresse, 2).valor).toBe(3)
  })
  it('autosave percebe alterações isoladas de quantidade, venda e versão', () => {
    const serializar = (d: typeof dados) => serializarPayloadAutosave({ dadosRascunho: d, clienteId: null })
    expect(serializar(dados)).not.toBe(serializar({ ...dados, produtosInteresse: [item('BERÇO', 2)] }))
    expect(serializar(dados)).not.toBe(serializar({ ...dados, produtosInteresse: [item('BERÇO', 1, true)] }))
  })
  it('editor preserva descrições e metadados', () => {
    const detalhe = { atendimento: { versaoProdutos: 2 }, criancas: [], departamentos: [], produtosInteresse: [{ id: '1', descricao: 'Berço', quantidade: 3, vendido: true }], motivos: [] } as unknown as Parameters<typeof normalizarDetalheParaFichaEdicao>[0]
    expect(normalizarDetalheParaFichaEdicao(detalhe)).toMatchObject({ versaoProdutos: 2, produtosInteresse: [item('Berço', 3, true)] })
  })
})
