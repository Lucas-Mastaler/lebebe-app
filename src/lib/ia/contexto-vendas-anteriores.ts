import { gerarVariacoesTelefone } from '@/lib/digisac/sgi-sync'

export const LIMITE_VENDAS_ANTERIORES_IA = 5

type SupabaseLike = {
  // O helper usa apenas o subset encadeavel do Supabase; manter amplo evita acoplar ao tipo gerado.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from: (table: string) => any
}

type VendaRow = {
  id?: string | null
  numero_lancamento?: string | null
  numero_documento?: string | null
  emissao_texto?: string | null
  data_fechamento?: string | null
  cliente?: string | null
  filial?: string | null
  vendedor?: string | null
  operacao?: string | null
  status?: string | null
  valor_total?: number | string | null
  valor_total_texto?: string | null
}

type ContatoRow = {
  numero_lancamento?: string | null
  telefone_normalizado?: string | null
  telefone_normalizado_ddi?: string | null
}

type ProdutoRow = {
  numero_lancamento?: string | null
  codigo?: string | null
  produto?: string | null
  quantidade?: number | string | null
  quantidade_texto?: string | null
  valor_total?: number | string | null
  valor_total_texto?: string | null
  departamento_classificado?: string | null
  subgrupo_classificado?: string | null
}

export type ProdutoVendaAnteriorIA = {
  codigo: string | null
  produto: string | null
  quantidade: number | string | null
  quantidadeTexto: string | null
  valorTotal: number | string | null
  valorTotalTexto: string | null
  departamento: string | null
  subgrupo: string | null
}

export type VendaAnteriorIA = {
  numeroLancamento: string
  numeroDocumento: string | null
  dataEmissao: string | null
  dataFechamento: string | null
  cliente: string | null
  filial: string | null
  vendedor: string | null
  operacao: string | null
  status: string | null
  valorTotal: number | string | null
  valorTotalTexto: string | null
  compraConfirmada: boolean
  produtos: ProdutoVendaAnteriorIA[]
}

export type ContextoVendasAnterioresIA = {
  criterioIdentificacao: 'telefone'
  limiteVendas: number
  vendas: VendaAnteriorIA[]
  totalProdutosHistoricos: number
}

function normalizarStatus(status: string | null): string {
  return (status ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

function statusIndicaCompraConfirmada(status: string | null): boolean {
  const s = normalizarStatus(status)
  return s.includes('finalizado') || s.includes('concluido') || s.includes('concluida')
}

function formatarDataPtBr(raw: string | null): string {
  if (!raw) return 'Nao informada'
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return raw
  return d.toLocaleDateString('pt-BR')
}

function formatarValor(valor: number | string | null, texto: string | null): string {
  if (texto) return texto
  if (valor == null || valor === '') return 'Nao informado'
  const n = Number(valor)
  if (Number.isNaN(n)) return String(valor)
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function coletarVariacoes(contatos: ContatoRow[]): string[] {
  const variacoes = new Set<string>()
  for (const contato of contatos) {
    if (contato.telefone_normalizado) {
      gerarVariacoesTelefone(contato.telefone_normalizado).forEach((v) => variacoes.add(v))
    }
    if (contato.telefone_normalizado_ddi) {
      gerarVariacoesTelefone(contato.telefone_normalizado_ddi).forEach((v) => variacoes.add(v))
    }
  }
  return Array.from(variacoes)
}

export async function buscarContextoVendasAnterioresIA(
  supabase: SupabaseLike,
  numeroLancamento: string,
  limiteVendas = LIMITE_VENDAS_ANTERIORES_IA
): Promise<ContextoVendasAnterioresIA> {
  const numeroAtual = numeroLancamento.trim()

  const { data: vendaAtualRaw } = await supabase
    .from('sgi_documentos_saida')
    .select('numero_lancamento, data_fechamento')
    .eq('numero_lancamento', numeroAtual)
    .maybeSingle()
  const vendaAtual = (vendaAtualRaw ?? null) as VendaRow | null

  const { data: contatosRaw } = await supabase
    .from('sgi_documentos_saida_contatos')
    .select('numero_lancamento, telefone_normalizado, telefone_normalizado_ddi')
    .eq('numero_lancamento', numeroAtual)

  const variacoesTelefone = coletarVariacoes((contatosRaw ?? []) as ContatoRow[])
  if (variacoesTelefone.length === 0) {
    return { criterioIdentificacao: 'telefone', limiteVendas, vendas: [], totalProdutosHistoricos: 0 }
  }

  const [porTelefone, porDdi] = await Promise.all([
    supabase
      .from('sgi_documentos_saida_contatos')
      .select('numero_lancamento, telefone_normalizado, telefone_normalizado_ddi')
      .in('telefone_normalizado', variacoesTelefone),
    supabase
      .from('sgi_documentos_saida_contatos')
      .select('numero_lancamento, telefone_normalizado, telefone_normalizado_ddi')
      .in('telefone_normalizado_ddi', variacoesTelefone),
  ])

  const lancamentosRelacionados = [
    ...((porTelefone.data ?? []) as ContatoRow[]),
    ...((porDdi.data ?? []) as ContatoRow[]),
  ]
    .map((c) => String(c.numero_lancamento ?? '').trim())
    .filter((n) => n && n !== numeroAtual)

  const lancamentosUnicos = Array.from(new Set(lancamentosRelacionados))
  if (lancamentosUnicos.length === 0) {
    return { criterioIdentificacao: 'telefone', limiteVendas, vendas: [], totalProdutosHistoricos: 0 }
  }

  const { data: vendasRaw } = await supabase
    .from('sgi_documentos_saida')
    .select('id, numero_lancamento, numero_documento, emissao_texto, data_fechamento, cliente, filial, vendedor, operacao, status, valor_total, valor_total_texto')
    .in('numero_lancamento', lancamentosUnicos)
    .order('data_fechamento', { ascending: false, nullsFirst: false })
    .limit(50)

  const dataAtualMs = vendaAtual?.data_fechamento ? new Date(vendaAtual.data_fechamento).getTime() : null
  const vendasAnteriores = ((vendasRaw ?? []) as VendaRow[])
    .filter((v) => {
      if (!v.numero_lancamento || String(v.numero_lancamento).trim() === numeroAtual) return false
      if (!v.data_fechamento || dataAtualMs == null || Number.isNaN(dataAtualMs)) return true
      const dataVendaMs = new Date(v.data_fechamento).getTime()
      return Number.isNaN(dataVendaMs) || dataVendaMs < dataAtualMs
    })
    .slice(0, limiteVendas)

  const lancamentosHistoricos = vendasAnteriores.map((v) => String(v.numero_lancamento).trim())
  if (lancamentosHistoricos.length === 0) {
    return { criterioIdentificacao: 'telefone', limiteVendas, vendas: [], totalProdutosHistoricos: 0 }
  }

  const { data: produtosRaw } = await supabase
    .from('sgi_documentos_saida_produtos')
    .select('numero_lancamento, codigo, produto, quantidade, quantidade_texto, valor_total, valor_total_texto, departamento_classificado, subgrupo_classificado')
    .in('numero_lancamento', lancamentosHistoricos)

  const produtosPorVenda = new Map<string, ProdutoVendaAnteriorIA[]>()
  for (const p of (produtosRaw ?? []) as ProdutoRow[]) {
    const numero = String(p.numero_lancamento ?? '').trim()
    if (!numero) continue
    const lista = produtosPorVenda.get(numero) ?? []
    lista.push({
      codigo: p.codigo ?? null,
      produto: p.produto ?? null,
      quantidade: p.quantidade ?? null,
      quantidadeTexto: p.quantidade_texto ?? null,
      valorTotal: p.valor_total ?? null,
      valorTotalTexto: p.valor_total_texto ?? null,
      departamento: p.departamento_classificado ?? null,
      subgrupo: p.subgrupo_classificado ?? null,
    })
    produtosPorVenda.set(numero, lista)
  }

  const vendas = vendasAnteriores.map((v) => {
    const numero = String(v.numero_lancamento).trim()
    return {
      numeroLancamento: numero,
      numeroDocumento: v.numero_documento ?? null,
      dataEmissao: v.emissao_texto ?? null,
      dataFechamento: v.data_fechamento ?? null,
      cliente: v.cliente ?? null,
      filial: v.filial ?? null,
      vendedor: v.vendedor ?? null,
      operacao: v.operacao ?? null,
      status: v.status ?? null,
      valorTotal: v.valor_total ?? null,
      valorTotalTexto: v.valor_total_texto ?? null,
      compraConfirmada: statusIndicaCompraConfirmada(v.status ?? null),
      produtos: produtosPorVenda.get(numero) ?? [],
    }
  })

  return {
    criterioIdentificacao: 'telefone',
    limiteVendas,
    vendas,
    totalProdutosHistoricos: vendas.reduce((total, venda) => total + venda.produtos.length, 0),
  }
}

export function montarBlocoVendasAnterioresIA(contexto: ContextoVendasAnterioresIA): string {
  if (contexto.vendas.length === 0) {
    return `## VENDAS ANTERIORES DO CLIENTE - CONTEXTO HISTORICO

Nenhuma venda anterior do mesmo cliente foi encontrada pelo criterio atual (${contexto.criterioIdentificacao}).
Nao presuma que produtos citados na conversa foram comprados anteriormente sem evidencia nos dados fornecidos.`
  }

  const vendas = contexto.vendas.map((venda) => {
    const produtos = venda.produtos.length > 0
      ? venda.produtos.map((p) => {
        const detalhes = [
          p.codigo ? `codigo ${p.codigo}` : null,
          p.quantidadeTexto || p.quantidade != null ? `qtd ${p.quantidadeTexto ?? p.quantidade}` : null,
          `valor ${formatarValor(p.valorTotal, p.valorTotalTexto)}`,
          p.departamento ? `departamento ${p.departamento}` : null,
          p.subgrupo ? `subgrupo ${p.subgrupo}` : null,
        ].filter(Boolean).join('; ')
        return `- ${p.produto ?? 'Produto sem nome'}${detalhes ? ` (${detalhes})` : ''}`
      }).join('\n')
      : '- Nenhum produto encontrado nesta venda anterior.'

    return `Venda anterior #${venda.numeroLancamento}
Numero do documento: ${venda.numeroDocumento ?? 'Nao informado'}
Data de emissao: ${venda.dataEmissao ?? 'Nao informada'}
Data de fechamento: ${formatarDataPtBr(venda.dataFechamento)}
Filial: ${venda.filial ?? 'Nao informada'}
Vendedor: ${venda.vendedor ?? 'Nao informado'}
Operacao: ${venda.operacao ?? 'Nao informada'}
Status: ${venda.status ?? 'Nao informado'}
Compra confirmada pelo status: ${venda.compraConfirmada ? 'sim' : 'nao'}
Valor total: ${formatarValor(venda.valorTotal, venda.valorTotalTexto)}

Produtos registrados nesta venda anterior:
${produtos}`
  }).join('\n\n')

  return `## VENDAS ANTERIORES DO CLIENTE - CONTEXTO HISTORICO

Estas vendas nao fazem parte da venda atual.
Use apenas para entender referencias da conversa, entregas combinadas, produtos ja comprados, suporte pos-compra, montagem, retirada e continuidade do atendimento.
Nao classifique automaticamente produtos dessas vendas como oportunidade nao fechada da venda atual.
Use produtos historicos como compra confirmada somente quando "Compra confirmada pelo status" for "sim".
Se um produto citado na conversa aparece aqui como compra confirmada, trate a mencao como contexto historico/logistico, salvo evidencia clara de novo interesse comercial atual.
Nao diga "produto nao comprado" apenas porque ele nao consta na venda atual; verifique tambem as vendas anteriores relevantes.
Se houver duvida de correspondencia entre produto citado e produto historico, reduza a confianca e explique a incerteza.
Limite aplicado: ultimas ${contexto.limiteVendas} vendas anteriores por telefone, ordenadas da mais recente para a mais antiga.

${vendas}`
}
