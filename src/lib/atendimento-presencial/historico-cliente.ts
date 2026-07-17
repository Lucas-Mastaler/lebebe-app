import { gerarVariacoesTelefone } from '@/lib/digisac/sgi-sync'
import { getDepartamentoLabel, getResultadoLabel, type DepartamentoInteresse, type ResultadoAtendimento } from './ficha-schema'

type SupabaseLike = {
  from: (table: string) => unknown
}

type QueryBuilder = PromiseLike<{ data: unknown; error: unknown }> & {
  select: (columns: string) => QueryBuilder
  eq: (column: string, value: unknown) => QueryBuilder
  in: (column: string, values: unknown[]) => QueryBuilder
  neq: (column: string, value: unknown) => QueryBuilder
  order: (column: string, options?: { ascending?: boolean }) => QueryBuilder
  limit: (count: number) => QueryBuilder
}

export type HistoricoAtendimentoClienteDTO = {
  id: string
  data: string | null
  unidade: string | null
  consultora: string | null
  resultado: string | null
  departamentos: string[]
  produtosInteresse: string[]
  numeroLancamento: number | null
}

export type HistoricoVendaSgiDTO = {
  numeroLancamento: string
  data: string | null
  filial: string | null
  vendedor: string | null
  status: string | null
  departamentos: string[]
  itens: string[]
  produtos: Array<{
    nome: string
    quantidade: number | null
    valorTotal: number | null
    departamento: string | null
    subgrupo: string | null
  }>
  valorTotal: number | null
  formasPagamento: string[]
}

type DocumentoSgiRow = {
  id: string
  numero_lancamento: string | number | null
  data_fechamento: string | null
  filial: string | null
  vendedor: string | null
  status: string | null
  valor_total: number | null
}

type ProdutoSgiRow = {
  documento_saida_id: string
  produto: string | null
  quantidade: number | null
  valor_total: number | null
  departamento_classificado: string | null
  subgrupo_classificado: string | null
}

type PagamentoSgiRow = {
  documento_saida_id: string
  forma_pagamento: string | null
}

export function gerarVariacoesTelefoneHistorico(telefoneNormalizado: string | null | undefined, telefoneNormalizadoDdi?: string | null) {
  const variacoes = new Set<string>()
  for (const telefone of [telefoneNormalizado, telefoneNormalizadoDdi]) {
    if (!telefone) continue
    gerarVariacoesTelefone(telefone).forEach((item) => variacoes.add(item))
  }
  return Array.from(variacoes).filter(Boolean)
}

function agruparPorDocumento<T extends { documento_saida_id: string }>(rows: T[]) {
  const map = new Map<string, T[]>()
  for (const row of rows) {
    const atuais = map.get(row.documento_saida_id) ?? []
    atuais.push(row)
    map.set(row.documento_saida_id, atuais)
  }
  return map
}

export async function buscarVendasSgiPorTelefone(
  supabase: SupabaseLike,
  params: { telefoneNormalizado: string | null; telefoneNormalizadoDdi?: string | null; limit?: number }
): Promise<{ vendas: HistoricoVendaSgiDTO[]; telefoneDisponivel: boolean }> {
  const variacoes = gerarVariacoesTelefoneHistorico(params.telefoneNormalizado, params.telefoneNormalizadoDdi)
  if (variacoes.length === 0) return { vendas: [], telefoneDisponivel: false }

  const contatosNormalizados = supabase.from('sgi_documentos_saida_contatos') as QueryBuilder
  const contatosDdi = supabase.from('sgi_documentos_saida_contatos') as QueryBuilder
  const [porTelefoneNormalizado, porTelefoneDdi] = await Promise.all([
    contatosNormalizados.select('documento_saida_id, numero_lancamento').in('telefone_normalizado', variacoes),
    contatosDdi.select('documento_saida_id, numero_lancamento').in('telefone_normalizado_ddi', variacoes),
  ])

  if (porTelefoneNormalizado.error || porTelefoneDdi.error) {
    throw new Error('Erro ao consultar contatos de vendas no SGI')
  }

  const contatos = [
    ...((porTelefoneNormalizado.data ?? []) as Array<{ documento_saida_id?: string | null }>),
    ...((porTelefoneDdi.data ?? []) as Array<{ documento_saida_id?: string | null }>),
  ]
  const documentoIds = Array.from(new Set(contatos.map((item) => item.documento_saida_id).filter((id): id is string => Boolean(id))))
  if (documentoIds.length === 0) return { vendas: [], telefoneDisponivel: true }

  const documentosQuery = supabase.from('sgi_documentos_saida') as QueryBuilder
  const { data: docsData, error: docsError } = await documentosQuery
    .select('id, numero_lancamento, data_fechamento, filial, vendedor, status, valor_total')
    .in('id', documentoIds)
    .order('data_fechamento', { ascending: false })
    .limit(params.limit ?? 10)

  if (docsError) throw new Error('Erro ao consultar documentos de vendas no SGI')

  const documentos = (docsData ?? []) as DocumentoSgiRow[]
  const idsLimitados = documentos.map((doc) => doc.id)
  if (idsLimitados.length === 0) return { vendas: [], telefoneDisponivel: true }

  const produtosQuery = supabase.from('sgi_documentos_saida_produtos') as QueryBuilder
  const pagamentosQuery = supabase.from('sgi_documentos_saida_pagamentos') as QueryBuilder
  const [produtosResult, pagamentosResult] = await Promise.all([
    produtosQuery.select('documento_saida_id, produto, quantidade, valor_total, departamento_classificado, subgrupo_classificado').in('documento_saida_id', idsLimitados),
    pagamentosQuery.select('documento_saida_id, forma_pagamento').in('documento_saida_id', idsLimitados),
  ])

  if (produtosResult.error || pagamentosResult.error) {
    throw new Error('Erro ao consultar detalhes de vendas no SGI')
  }

  const produtosPorDocumento = agruparPorDocumento((produtosResult.data ?? []) as ProdutoSgiRow[])
  const pagamentosPorDocumento = agruparPorDocumento((pagamentosResult.data ?? []) as PagamentoSgiRow[])

  return {
    telefoneDisponivel: true,
    vendas: documentos.map((doc) => {
      const produtos = produtosPorDocumento.get(doc.id) ?? []
      const pagamentos = pagamentosPorDocumento.get(doc.id) ?? []
      const produtosFormatados = produtos
        .filter((produto) => Boolean(produto.produto))
        .map((produto) => ({
          nome: produto.produto ?? '',
          quantidade: produto.quantidade,
          valorTotal: produto.valor_total,
          departamento: produto.departamento_classificado,
          subgrupo: produto.subgrupo_classificado,
        }))
      const departamentos = Array.from(new Set(produtosFormatados
        .map((produto) => produto.departamento)
        .filter((item): item is string => Boolean(item && item !== 'Nao classificado' && item !== 'Não classificado'))))
      return {
        numeroLancamento: String(doc.numero_lancamento ?? ''),
        data: doc.data_fechamento,
        filial: doc.filial,
        vendedor: doc.vendedor,
        status: doc.status,
        departamentos,
        valorTotal: doc.valor_total,
        itens: produtosFormatados.map((produto) => `${produto.quantidade ?? 1}x ${produto.nome}`),
        produtos: produtosFormatados,
        formasPagamento: Array.from(new Set(pagamentos.map((pagamento) => pagamento.forma_pagamento).filter((item): item is string => Boolean(item)))),
      }
    }),
  }
}

export function serializarHistoricoAtendimento(params: {
  row: {
    id: string
    concluido_em?: string | null
    resultado_atendimento?: string | null
    numero_lancamento?: number | null
    consultora_usuario_id: string
    unidade_id: string
  }
  unidadeNome: string | null
  consultoraEmail: string | null
  departamentos: string[]
  produtosInteresse: string[]
}): HistoricoAtendimentoClienteDTO {
  return {
    id: params.row.id,
    data: params.row.concluido_em ?? null,
    unidade: params.unidadeNome,
    consultora: params.consultoraEmail,
    resultado: getResultadoLabel(params.row.resultado_atendimento as ResultadoAtendimento | undefined),
    departamentos: params.departamentos.map((item) => getDepartamentoLabel(item as DepartamentoInteresse)),
    produtosInteresse: params.produtosInteresse,
    numeroLancamento: params.row.numero_lancamento ?? null,
  }
}
