export type ProdutoAtendimento = {
  descricao: string
  quantidade: number | null
  vendido: boolean | null
}

export type ProdutoCompativel = string | ProdutoAtendimento
export const PRODUTO_NAO_TRABALHAMOS = 'PRODUTO QUE NÃO TRABALHAMOS'
export const QUANTIDADE_PRODUTO_MAX = 2147483647
export const META_PV = 5

export function chaveProduto(descricao: string) {
  return descricao.trim().replace(/\s+/gu, ' ').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleUpperCase('pt-BR')
}

export function produtoNaoTrabalhado(produto: ProdutoCompativel) {
  return chaveProduto(descricaoProduto(produto)) === chaveProduto(PRODUTO_NAO_TRABALHAMOS)
}

export function descricaoProduto(produto: ProdutoCompativel) {
  return typeof produto === 'string' ? produto : produto.descricao
}

export function estruturarProduto(produto: ProdutoCompativel): ProdutoAtendimento {
  return typeof produto === 'string' ? { descricao: produto, quantidade: null, vendido: null } : { ...produto }
}

export function calcularPv(produtos: ProdutoCompativel[], versaoProdutos?: number | null) {
  const itens = produtos.filter(p => !produtoNaoTrabalhado(p)).map(estruturarProduto)
  const conhecidos = itens.filter(p => p.vendido !== null && p.quantidade !== null)
  const valor = itens.reduce((soma, p) => soma + (p.vendido === true ? p.quantidade ?? 0 : 0), 0)
  const informado = conhecidos.length > 0 || (itens.length === 0 && versaoProdutos === 2)
  return { valor, informado, incompleto: conhecidos.length !== itens.length }
}

export function incrementarProduto(produto: ProdutoCompativel): ProdutoAtendimento {
  const item = estruturarProduto(produto)
  return produtoNaoTrabalhado(item) ? item : { ...item, quantidade: Math.min(QUANTIDADE_PRODUTO_MAX, (item.quantidade ?? 0) + 1) }
}
