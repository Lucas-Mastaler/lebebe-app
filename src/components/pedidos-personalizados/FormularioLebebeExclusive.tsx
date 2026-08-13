'use client'

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { CheckCircle2, ChevronLeft, ChevronRight, Filter, Loader2, Save, Search, X } from 'lucide-react'
import { toast } from 'sonner'
import { aplicarMascaraTelefoneBR } from '@/lib/atendimento-presencial/telefone'
import type { ProdutoCatalogoLebebeExclusive, UnidadePedidoPersonalizado } from '@/lib/pedidos-personalizados'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { OpcoesNovoPedido } from './novo-pedido-modelo'
import type { PedidoDetalhe } from './gestao-modelo'
import { PreviaMensagem } from './PreviaMensagem'

type ItemSelecionado = ProdutoCatalogoLebebeExclusive & {
  quantidade: number
  nomeOuLetra: string
}

type RascunhoItem = {
  quantidade: string
  nomeOuLetra: string
}

type Identificacao = {
  unidade: '' | UnidadePedidoPersonalizado
  consultora: string
  cliente: string
  telefone: string
  numeroLancamento: string
}

type Props = {
  opcoes: OpcoesNovoPedido
  pedidoInicial?: PedidoDetalhe
  onAtualizado?: () => Promise<void> | void
  identificacaoExterna?: Identificacao
  onDadosEspecificosChange?: (preenchidos: boolean) => void
  onBloqueioTrocaFornecedorChange?: (bloqueado: boolean) => void
  onValidacaoIdentificacaoInvalida?: () => void
  ocultarIdentificacao?: boolean
}

const IDENTIFICACAO_INICIAL: Identificacao = {
  unidade: '', consultora: '', cliente: '', telefone: '', numeroLancamento: '',
}

function formatarMoeda(valor: number) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function quantidadeItemLebebeExclusiveEhValida(valor: string) {
  return /^\d+$/.test(valor) && Number(valor) > 0
}

export function paginasVisiveisLebebeExclusive(paginaAtual: number, totalPaginas: number) {
  if (totalPaginas <= 7) return Array.from({ length: totalPaginas }, (_, indice) => indice + 1)
  const paginas = new Set([1, totalPaginas, paginaAtual - 1, paginaAtual, paginaAtual + 1])
  const ordenadas = [...paginas].filter((pagina) => pagina >= 1 && pagina <= totalPaginas).sort((a, b) => a - b)
  return ordenadas.flatMap((pagina, indice) => indice > 0 && pagina - ordenadas[indice - 1] > 1 ? ['…', pagina] : [pagina])
}

async function lerErro(response: Response) {
  try {
    const body = await response.json() as { mensagem?: unknown }
    if (typeof body.mensagem === 'string') return body.mensagem
  } catch {
    // A resposta técnica não é exibida integralmente.
  }
  if (response.status === 401) return 'Sua sessão expirou. Entre novamente.'
  if (response.status === 403) return 'Você não possui acesso a esta operação.'
  return 'Não foi possível concluir a operação agora.'
}

export function FormularioLebebeExclusive({
  opcoes,
  pedidoInicial,
  onAtualizado,
  identificacaoExterna,
  onDadosEspecificosChange,
  onBloqueioTrocaFornecedorChange,
  onValidacaoIdentificacaoInvalida,
  ocultarIdentificacao = false,
}: Props) {
  const [identificacao, setIdentificacao] = useState<Identificacao>(() => pedidoInicial ? {
    unidade: pedidoInicial.unidade.chave,
    consultora: pedidoInicial.consultora,
    cliente: pedidoInicial.cliente,
    telefone: aplicarMascaraTelefoneBR(pedidoInicial.telefone ?? ''),
    numeroLancamento: pedidoInicial.numeroLancamento ?? '',
  } : IDENTIFICACAO_INICIAL)
  const [filtros, setFiltros] = useState({ colecao: '', descricao: '', referencia: '' })
  const [resultados, setResultados] = useState<ProdutoCatalogoLebebeExclusive[]>([])
  const [paginacao, setPaginacao] = useState({ pagina: 1, totalRegistros: 0, totalPaginas: 0 })
  const [selecionados, setSelecionados] = useState<Map<string, ItemSelecionado>>(() => new Map(
    (pedidoInicial?.itens ?? []).map((item) => [item.produtoId, {
      id: item.produtoId,
      colecao: item.colecao,
      descricao: item.descricao,
      referencia: item.referencia,
      precoUnitario: item.precoUnitario,
      quantidade: item.quantidade,
      nomeOuLetra: item.nomeOuLetra ?? '',
    }])
  ))
  const [rascunhosItens, setRascunhosItens] = useState<Map<string, RascunhoItem>>(() => new Map(
    (pedidoInicial?.itens ?? []).map((item) => [item.produtoId, {
      quantidade: String(item.quantidade),
      nomeOuLetra: item.nomeOuLetra ?? '',
    }])
  ))
  const [mostrarSelecionados, setMostrarSelecionados] = useState(false)
  const [pesquisou, setPesquisou] = useState(false)
  const [buscando, setBuscando] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [pedidoSalvo, setPedidoSalvo] = useState<{ pedidoId: string; status: string; version: number } | null>(null)
  const [copiado, setCopiado] = useState(false)
  const idempotencyKey = useRef(crypto.randomUUID())
  const salvandoRef = useRef(false)

  const itensExibidos = useMemo(() => mostrarSelecionados ? [...selecionados.values()] : resultados, [mostrarSelecionados, resultados, selecionados])
  const total = useMemo(
    () => [...selecionados.values()].reduce((soma, item) => soma + item.precoUnitario * item.quantidade, 0),
    [selecionados]
  )
  const fornecedor = opcoes.fornecedores.find((item) => item.chave === 'lebebe_exclusive')
  const identificacaoAtual = identificacaoExterna ?? identificacao
  const possuiDadosEspecificos = selecionados.size > 0 || Object.values(filtros).some((valor) => valor.trim() !== '')

  useEffect(() => {
    onDadosEspecificosChange?.(possuiDadosEspecificos)
    return () => onDadosEspecificosChange?.(false)
  }, [onDadosEspecificosChange, possuiDadosEspecificos])

  useEffect(() => {
    onBloqueioTrocaFornecedorChange?.(pedidoSalvo !== null)
    return () => onBloqueioTrocaFornecedorChange?.(false)
  }, [onBloqueioTrocaFornecedorChange, pedidoSalvo])

  function quantidadeValida(valor: string) {
    return quantidadeItemLebebeExclusiveEhValida(valor)
  }

  function atualizarQuantidade(produto: ProdutoCatalogoLebebeExclusive, quantidade: string) {
    const quantidadeLimpa = quantidade.trim()
    const rascunhoAtual = rascunhosItens.get(produto.id)
    setRascunhosItens((atuais) => {
      const proximos = new Map(atuais)
      const atual = proximos.get(produto.id) ?? { quantidade: '', nomeOuLetra: selecionados.get(produto.id)?.nomeOuLetra ?? '' }
      proximos.set(produto.id, { ...atual, quantidade })
      return proximos
    })
    setSelecionados((atuais) => {
      const proximos = new Map(atuais)
      if (!quantidadeValida(quantidadeLimpa)) {
        proximos.delete(produto.id)
        return proximos
      }
      const atual = proximos.get(produto.id) ?? { ...produto, quantidade: Number(quantidadeLimpa), nomeOuLetra: rascunhoAtual?.nomeOuLetra ?? '' }
      proximos.set(produto.id, { ...atual, quantidade: Number(quantidadeLimpa) })
      return proximos
    })
    setErro(null)
  }

  function atualizarNomeOuLetra(produto: ProdutoCatalogoLebebeExclusive, nomeOuLetra: string) {
    setRascunhosItens((atuais) => {
      const proximos = new Map(atuais)
      const atual = proximos.get(produto.id) ?? { quantidade: selecionados.get(produto.id)?.quantidade?.toString() ?? '', nomeOuLetra: '' }
      proximos.set(produto.id, { ...atual, nomeOuLetra })
      return proximos
    })
    setSelecionados((atuais) => {
      const proximos = new Map(atuais)
      const atual = proximos.get(produto.id)
      if (atual) proximos.set(produto.id, { ...atual, nomeOuLetra })
      return proximos
    })
  }

  async function pesquisar(event?: FormEvent, pagina = 1) {
    event?.preventDefault()
    if (buscando || pedidoSalvo) return
    const preenchidos = Object.values(filtros).map((valor) => valor.trim()).filter(Boolean)
    if (!preenchidos.some((valor) => valor.length >= 3) || preenchidos.some((valor) => valor.length < 3)) {
      setErro('Informe ao menos 3 caracteres em cada filtro preenchido.')
      setPesquisou(false)
      return
    }
    setBuscando(true)
    setErro(null)
    setMostrarSelecionados(false)
    try {
      const params = new URLSearchParams()
      for (const [campo, valor] of Object.entries(filtros)) if (valor.trim()) params.set(campo, valor.trim())
      params.set('pagina', String(pagina))
      const response = await fetch(`/api/pedidos-personalizados/catalogo/lebebe-exclusive?${params}`, { cache: 'no-store' })
      if (!response.ok) throw new Error(await lerErro(response))
      const body = await response.json() as { ok?: boolean; itens?: ProdutoCatalogoLebebeExclusive[]; pagina?: number; totalRegistros?: number; totalPaginas?: number }
      if (body.ok !== true || !Array.isArray(body.itens) || typeof body.pagina !== 'number' || !Number.isInteger(body.pagina) || typeof body.totalRegistros !== 'number' || !Number.isInteger(body.totalRegistros) || typeof body.totalPaginas !== 'number' || !Number.isInteger(body.totalPaginas)) throw new Error('A resposta do catálogo não pôde ser confirmada.')
      setResultados(body.itens)
      setPaginacao({ pagina: body.pagina, totalRegistros: body.totalRegistros, totalPaginas: body.totalPaginas })
      setPesquisou(true)
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : 'Não foi possível pesquisar o catálogo.')
    } finally {
      setBuscando(false)
    }
  }

  function validarIdentificacaoAntesDeSalvar() {
    if (!identificacaoAtual.unidade) return 'Selecione a unidade.'
    if (identificacaoAtual.consultora.trim().length < 2) return 'Informe a consultora.'
    if (!identificacaoAtual.cliente.trim()) return 'Informe o cliente.'
    if (identificacaoAtual.telefone.replace(/\D/g, '').length < 10) return 'Informe um telefone válido.'
    if (identificacaoAtual.numeroLancamento && !/^\d{1,6}$/.test(identificacaoAtual.numeroLancamento)) return 'Use até 6 dígitos no lançamento.'
    return null
  }

  function validarAntesDeSalvar() {
    if (!fornecedor) return 'O fornecedor Lebebe Exclusive está indisponível.'
    const problemaIdentificacao = validarIdentificacaoAntesDeSalvar()
    if (problemaIdentificacao) return problemaIdentificacao
    if (selecionados.size === 0) return 'Selecione ao menos um produto.'
    if ([...selecionados.values()].some((item) => !Number.isInteger(item.quantidade) || item.quantidade < 1)) return 'Revise as quantidades dos produtos.'
    return null
  }

  async function salvar(event: FormEvent) {
    event.preventDefault()
    if (salvandoRef.current || pedidoSalvo) return
    const problemaIdentificacao = validarIdentificacaoAntesDeSalvar()
    const problema = validarAntesDeSalvar()
    if (problema) {
      setErro(problema)
      toast.error(problema)
      if (problemaIdentificacao) onValidacaoIdentificacaoInvalida?.()
      document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
      return
    }
    salvandoRef.current = true
    setSalvando(true)
    setErro(null)
    try {
      const response = await fetch(pedidoInicial
        ? `/api/pedidos-personalizados/pedidos/${pedidoInicial.id}/comercial`
        : '/api/pedidos-personalizados/pedidos', {
        method: pedidoInicial ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(pedidoInicial
            ? { expectedVersion: pedidoInicial.version }
            : { idempotencyKey: idempotencyKey.current }),
          fornecedor: 'lebebe_exclusive',
          ...identificacaoAtual,
          numeroLancamento: identificacaoAtual.numeroLancamento || null,
          itens: [...selecionados.values()].map((item, indice) => ({
            produtoId: item.id,
            ordem: indice + 1,
            quantidade: item.quantidade,
            nomeOuLetra: item.nomeOuLetra.trim() || null,
          })),
        }),
      })
      if (!response.ok) throw new Error(await lerErro(response))
      const body = await response.json() as { ok?: boolean; pedidoId?: string; status?: string; version?: number; quantidadeItens?: number }
      const respostaValida = pedidoInicial
        ? body.ok === true && Number.isInteger(body.version)
        : body.ok === true && Boolean(body.pedidoId) && body.status === 'RASCUNHO'
          && Number.isInteger(body.version) && body.quantidadeItens === selecionados.size
      if (!respostaValida) {
        throw new Error('O pedido foi salvo, mas a confirmação dos itens falhou. Tente novamente com a mesma chave.')
      }
      setPedidoSalvo({
        pedidoId: body.pedidoId ?? pedidoInicial!.id,
        status: body.status ?? pedidoInicial!.status,
        version: body.version!,
      })
      toast.success(pedidoInicial ? 'Rascunho atualizado.' : 'Orçamento salvo como rascunho.')
      await onAtualizado?.()
    } catch (falha) {
      const mensagem = falha instanceof Error ? falha.message : 'Não foi possível salvar o pedido.'
      setErro(mensagem)
      toast.error(mensagem)
    } finally {
      salvandoRef.current = false
      setSalvando(false)
    }
  }

  const resumo = useMemo(() => {
    if (selecionados.size === 0) return ''
    const linhas = [
      'FORNECEDOR: LEBEBE EXCLUSIVE',
      `UNIDADE: ${opcoes.unidades.find((item) => item.chave === identificacaoAtual.unidade)?.nome ?? ''}`,
      `CONSULTORA: ${identificacaoAtual.consultora.trim().toLocaleUpperCase('pt-BR')}`,
      `CLIENTE: ${identificacaoAtual.cliente.trim().toLocaleUpperCase('pt-BR')}`,
      ...(identificacaoAtual.numeroLancamento ? [`LANÇAMENTO: ${identificacaoAtual.numeroLancamento}`] : []),
    ]
    for (const [indice, item] of [...selecionados.values()].entries()) {
      linhas.push('', `ITEM ${indice + 1}`, `PRODUTO: ${item.descricao}`, `REFERÊNCIA: ${item.referencia}`, `QUANTIDADE: ${item.quantidade}`)
      if (item.nomeOuLetra.trim()) linhas.push(`NOME OU LETRA: ${item.nomeOuLetra.trim().toLocaleUpperCase('pt-BR')}`)
    }
    return linhas.join('\n')
  }, [identificacaoAtual, opcoes.unidades, selecionados])

  async function copiarResumo() {
    if (!resumo) return
    await navigator.clipboard.writeText(resumo)
    setCopiado(true)
    toast.success('Resumo copiado.')
  }

  const bloqueado = salvando || pedidoSalvo !== null

  return (
    <form className="space-y-6" onSubmit={salvar} noValidate>
      <section className="rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-950 sm:p-5">
        <h2 className="font-bold">Como montar o orçamento Lebebe Exclusive</h2>
        <p className="mt-1">Pesquise manualmente por coleção, descrição ou referência. Um produto entra no pedido quando a quantidade é maior que zero. O custo não é exibido nesta tela.</p>
      </section>

      {!ocultarIdentificacao && <section className="rounded-2xl border bg-white p-4 shadow-sm sm:p-6" aria-labelledby="identificacao-exclusive">
        <h2 id="identificacao-exclusive" className="text-lg font-bold">Identificação</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div><label className="mb-1 block text-sm font-medium" htmlFor="unidade-exclusive">Unidade *</label><Select value={identificacao.unidade} disabled={bloqueado} onValueChange={(unidade) => setIdentificacao((atual) => ({ ...atual, unidade: unidade as UnidadePedidoPersonalizado }))}><SelectTrigger id="unidade-exclusive" className="h-11" aria-invalid={!identificacao.unidade}><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent>{opcoes.unidades.map((item) => <SelectItem key={item.chave} value={item.chave}>{item.nome}</SelectItem>)}</SelectContent></Select></div>
          <div><label className="mb-1 block text-sm font-medium" htmlFor="consultora-exclusive">Consultora *</label><Input id="consultora-exclusive" disabled={bloqueado} maxLength={20} aria-invalid={identificacao.consultora.trim().length < 2} value={identificacao.consultora} onChange={(event) => setIdentificacao((atual) => ({ ...atual, consultora: event.target.value }))} /></div>
          <div><label className="mb-1 block text-sm font-medium" htmlFor="lancamento-exclusive">Lançamento</label><Input id="lancamento-exclusive" disabled={bloqueado} inputMode="numeric" maxLength={6} value={identificacao.numeroLancamento} onChange={(event) => setIdentificacao((atual) => ({ ...atual, numeroLancamento: event.target.value.replace(/\D/g, '').slice(0, 6) }))} /></div>
          <div><label className="mb-1 block text-sm font-medium" htmlFor="cliente-exclusive">Cliente *</label><Input id="cliente-exclusive" disabled={bloqueado} maxLength={40} aria-invalid={!identificacao.cliente.trim()} value={identificacao.cliente} onChange={(event) => setIdentificacao((atual) => ({ ...atual, cliente: event.target.value }))} /></div>
          <div><label className="mb-1 block text-sm font-medium" htmlFor="telefone-exclusive">Telefone *</label><Input id="telefone-exclusive" disabled={bloqueado} inputMode="tel" aria-invalid={identificacao.telefone.replace(/\D/g, '').length < 10} placeholder="(41) 99999-9999" value={identificacao.telefone} onChange={(event) => setIdentificacao((atual) => ({ ...atual, telefone: aplicarMascaraTelefoneBR(event.target.value) }))} /></div>
        </div>
      </section>}

      <section className="rounded-2xl border bg-white p-4 shadow-sm sm:p-6" aria-labelledby="catalogo-exclusive">
        <h2 id="catalogo-exclusive" className="text-lg font-bold">Produtos</h2>
        <p className="mt-1 text-sm text-slate-500">A busca só acontece ao pressionar Enter ou Filtrar. Cada filtro preenchido precisa ter 3 caracteres.</p>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <Input aria-label="Coleção" placeholder="Coleção" disabled={bloqueado} value={filtros.colecao} onChange={(event) => setFiltros({ ...filtros, colecao: event.target.value })} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); void pesquisar() } }} />
          <Input aria-label="Descrição" placeholder="Descrição" disabled={bloqueado} value={filtros.descricao} onChange={(event) => setFiltros({ ...filtros, descricao: event.target.value })} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); void pesquisar() } }} />
          <Input aria-label="Referência" placeholder="Referência" disabled={bloqueado} value={filtros.referencia} onChange={(event) => setFiltros({ ...filtros, referencia: event.target.value })} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); void pesquisar() } }} />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button type="button" disabled={bloqueado || buscando} onClick={() => void pesquisar()}>{buscando ? <Loader2 className="animate-spin" /> : <Filter />}Filtrar</Button>
          <Button type="button" variant="outline" disabled={bloqueado || buscando} onClick={() => { setFiltros({ colecao: '', descricao: '', referencia: '' }); setResultados([]); setPaginacao({ pagina: 1, totalRegistros: 0, totalPaginas: 0 }); setPesquisou(false); setErro(null) }}><X />Limpar filtros</Button>
          <Button type="button" variant="outline" disabled={selecionados.size === 0} onClick={() => setMostrarSelecionados((atual) => !atual)}><Search />{mostrarSelecionados ? 'Voltar aos resultados' : `Mostrar selecionados (${selecionados.size})`}</Button>
        </div>

        {!pesquisou && !mostrarSelecionados && <p className="mt-6 rounded-xl border border-dashed p-6 text-center text-sm text-slate-500">Informe os filtros para pesquisar. O catálogo completo não é carregado automaticamente.</p>}
        {pesquisou && resultados.length === 0 && !mostrarSelecionados && <p className="mt-6 rounded-xl border border-dashed p-6 text-center text-sm text-slate-500">Nenhum produto encontrado.</p>}
        {mostrarSelecionados && selecionados.size === 0 && <p className="mt-6 rounded-xl border border-dashed p-6 text-center text-sm text-slate-500">Nenhum produto selecionado.</p>}

        {itensExibidos.length > 0 && <div className="mt-5 rounded-xl border">
          <table className="hidden w-full table-fixed text-left text-sm lg:table">
            <colgroup><col className="w-[15%]" /><col className="w-[25%]" /><col className="w-[10%]" /><col className="w-[12%]" /><col className="w-[10%]" /><col className="w-[16%]" /><col className="w-[12%]" /></colgroup>
            <thead className="bg-slate-50 text-xs uppercase text-slate-600"><tr><th className="p-2.5">Coleção</th><th className="p-2.5">Descrição</th><th className="p-2.5">Referência</th><th className="p-2.5 text-right">Preço Unit.</th><th className="p-2.5">Quantidade</th><th className="p-2.5">Nome ou Letra</th><th className="p-2.5 text-right">Valor Total</th></tr></thead>
            <tbody>{itensExibidos.map((produto) => {
              const selecionado = selecionados.get(produto.id)
              const rascunho = rascunhosItens.get(produto.id)
              const quantidade = rascunho?.quantidade ?? selecionado?.quantidade.toString() ?? ''
              const quantidadeInvalida = quantidade.trim() !== '' && !quantidadeValida(quantidade.trim())
              const nomeOuLetra = rascunho?.nomeOuLetra ?? selecionado?.nomeOuLetra ?? ''
              return <tr key={produto.id} className="border-t align-top">
                <td className="break-words p-2.5 font-medium">{produto.colecao}</td><td className="break-words p-2.5">{produto.descricao}</td><td className="break-all p-2.5 font-mono">{produto.referencia}</td><td className="p-2.5 text-right font-medium whitespace-nowrap">{formatarMoeda(produto.precoUnitario)}</td>
                <td className="p-2.5"><Input className="w-full min-w-0" inputMode="numeric" min={1} type="number" disabled={bloqueado} value={quantidade} aria-invalid={quantidadeInvalida} onChange={(event) => atualizarQuantidade(produto, event.target.value)} />{quantidadeInvalida && <p className="mt-1 text-xs text-red-600">Use um inteiro maior que zero.</p>}</td>
                <td className="p-2.5"><Input className="w-full min-w-0" maxLength={200} disabled={bloqueado} value={nomeOuLetra} onChange={(event) => atualizarNomeOuLetra(produto, event.target.value)} /></td>
                <td className="p-2.5 text-right font-bold whitespace-nowrap">{selecionado ? formatarMoeda(produto.precoUnitario * selecionado.quantidade) : '—'}</td>
              </tr>
            })}</tbody>
          </table>
          <div className="space-y-3 p-3 lg:hidden">{itensExibidos.map((produto) => {
            const selecionado = selecionados.get(produto.id)
            const rascunho = rascunhosItens.get(produto.id)
            const quantidade = rascunho?.quantidade ?? selecionado?.quantidade.toString() ?? ''
            const quantidadeInvalida = quantidade.trim() !== '' && !quantidadeValida(quantidade.trim())
            const nomeOuLetra = rascunho?.nomeOuLetra ?? selecionado?.nomeOuLetra ?? ''
            return <article key={produto.id} className="rounded-lg border p-3"><div className="grid gap-2 text-sm"><p className="font-medium">{produto.descricao}</p><p><span className="text-slate-500">Coleção: </span>{produto.colecao}</p><p><span className="text-slate-500">Referência: </span>{produto.referencia}</p><p><span className="text-slate-500">Preço unitário: </span>{formatarMoeda(produto.precoUnitario)}</p></div><div className="mt-3 grid gap-3 sm:grid-cols-2"><label className="grid gap-1 text-sm font-medium">Quantidade<Input inputMode="numeric" min={1} type="number" disabled={bloqueado} value={quantidade} aria-invalid={quantidadeInvalida} onChange={(event) => atualizarQuantidade(produto, event.target.value)} />{quantidadeInvalida && <span className="text-xs font-normal text-red-600">Use um inteiro maior que zero.</span>}</label><label className="grid gap-1 text-sm font-medium">Nome ou Letra<Input maxLength={200} disabled={bloqueado} value={nomeOuLetra} onChange={(event) => atualizarNomeOuLetra(produto, event.target.value)} /></label></div><p className="mt-3 text-right font-bold">Valor total: {selecionado ? formatarMoeda(produto.precoUnitario * selecionado.quantidade) : '—'}</p></article>
          })}</div>
        </div>}

        {!mostrarSelecionados && paginacao.totalPaginas > 1 && <nav className="mt-4 flex flex-wrap items-center justify-center gap-2" aria-label="Paginação dos resultados">
          <Button type="button" variant="outline" size="sm" disabled={buscando || paginacao.pagina === 1} onClick={() => void pesquisar(undefined, paginacao.pagina - 1)}><ChevronLeft />Anterior</Button>
          {paginasVisiveisLebebeExclusive(paginacao.pagina, paginacao.totalPaginas).map((pagina, indice) => typeof pagina === 'string'
            ? <span key={`reticencias-${indice}`} className="px-1 text-sm text-slate-500">…</span>
            : <Button key={pagina} type="button" size="sm" variant={pagina === paginacao.pagina ? 'default' : 'outline'} disabled={buscando} aria-current={pagina === paginacao.pagina ? 'page' : undefined} onClick={() => void pesquisar(undefined, pagina)}>{pagina}</Button>)}
          <Button type="button" variant="outline" size="sm" disabled={buscando || paginacao.pagina === paginacao.totalPaginas} onClick={() => void pesquisar(undefined, paginacao.pagina + 1)}>Próxima<ChevronRight /></Button>
          <p className="basis-full text-center text-sm text-slate-500">Página {paginacao.pagina} de {paginacao.totalPaginas} · {paginacao.totalRegistros} resultados</p>
        </nav>}

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <Button type="button" variant="outline" disabled={selecionados.size === 0} onClick={() => setMostrarSelecionados((atual) => !atual)}><Search />{mostrarSelecionados ? 'Voltar aos resultados' : `Mostrar selecionados (${selecionados.size})`}</Button>
          <p className="text-lg font-bold">Itens selecionados: {selecionados.size} | Total: {formatarMoeda(total)}</p>
        </div>
      </section>

      {pedidoInicial
        ? resumo && <section className="rounded-2xl border bg-white p-4 sm:p-6"><div className="flex items-center justify-between gap-3"><h2 className="font-bold">Resumo para o fornecedor</h2><Button type="button" variant="outline" onClick={() => void copiarResumo()}>{copiado ? 'Copiado' : 'Copiar'}</Button></div><pre className="mt-4 whitespace-pre-wrap rounded-xl bg-slate-50 p-4 text-sm">{resumo}</pre></section>
        : <PreviaMensagem mensagem={resumo || null} copiada={copiado} onCopiar={() => void copiarResumo()} orientacaoObservacoes />}
      {erro && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{erro}</div>}
      {pedidoSalvo && <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5"><div className="flex gap-3"><CheckCircle2 className="text-emerald-600" /><div><h2 className="font-bold text-emerald-900">{pedidoInicial ? 'Rascunho atualizado' : 'Orçamento salvo'}</h2><p className="text-sm text-emerald-800">Status {pedidoSalvo.status}; versão {pedidoSalvo.version}; {selecionados.size} produto(s). A venda ainda não foi fechada.</p></div></div></section>}
      <div className="sticky bottom-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-white/95 p-3 shadow-lg backdrop-blur"><p className="text-sm font-bold text-slate-900 sm:text-base">Itens selecionados: {selecionados.size} | Total: {formatarMoeda(total)}</p><Button type="submit" className="min-h-12" disabled={bloqueado}>{salvando ? <Loader2 className="animate-spin" /> : <Save />}{salvando ? 'Salvando...' : pedidoSalvo ? 'Salvo' : pedidoInicial ? 'Salvar rascunho' : 'Salvar orçamento'}</Button></div>
    </form>
  )
}
