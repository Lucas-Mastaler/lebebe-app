'use client'

import { FormEvent, useMemo, useRef, useState } from 'react'
import { CheckCircle2, ClipboardCopy, Filter, Loader2, Save, Search, X } from 'lucide-react'
import { toast } from 'sonner'
import { aplicarMascaraTelefoneBR } from '@/lib/atendimento-presencial/telefone'
import type { ProdutoCatalogoLebebeExclusive, UnidadePedidoPersonalizado } from '@/lib/pedidos-personalizados'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { OpcoesNovoPedido } from './novo-pedido-modelo'
import type { PedidoDetalhe } from './gestao-modelo'

type ItemSelecionado = ProdutoCatalogoLebebeExclusive & {
  quantidade: number
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
  onFornecedorChange: (fornecedor: 'moriah_tapetes' | 'lebebe_exclusive') => void
  pedidoInicial?: PedidoDetalhe
  onAtualizado?: () => Promise<void> | void
}

const IDENTIFICACAO_INICIAL: Identificacao = {
  unidade: '', consultora: '', cliente: '', telefone: '', numeroLancamento: '',
}

function formatarMoeda(valor: number) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
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

export function FormularioLebebeExclusive({ opcoes, onFornecedorChange, pedidoInicial, onAtualizado }: Props) {
  const [identificacao, setIdentificacao] = useState<Identificacao>(() => pedidoInicial ? {
    unidade: pedidoInicial.unidade.chave,
    consultora: pedidoInicial.consultora,
    cliente: pedidoInicial.cliente,
    telefone: aplicarMascaraTelefoneBR(pedidoInicial.telefone ?? ''),
    numeroLancamento: pedidoInicial.numeroLancamento ?? '',
  } : IDENTIFICACAO_INICIAL)
  const [filtros, setFiltros] = useState({ colecao: '', descricao: '', referencia: '' })
  const [resultados, setResultados] = useState<ProdutoCatalogoLebebeExclusive[]>([])
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

  function atualizarSelecionado(produto: ProdutoCatalogoLebebeExclusive, mudanca: Partial<Pick<ItemSelecionado, 'quantidade' | 'nomeOuLetra'>>) {
    setSelecionados((atuais) => {
      const proximos = new Map(atuais)
      const atual = proximos.get(produto.id) ?? { ...produto, quantidade: 1, nomeOuLetra: '' }
      proximos.set(produto.id, { ...atual, ...mudanca })
      return proximos
    })
    setErro(null)
  }

  function alternarProduto(produto: ProdutoCatalogoLebebeExclusive, marcado: boolean) {
    setSelecionados((atuais) => {
      const proximos = new Map(atuais)
      if (marcado) proximos.set(produto.id, { ...produto, quantidade: 1, nomeOuLetra: '' })
      else proximos.delete(produto.id)
      return proximos
    })
  }

  async function pesquisar(event?: FormEvent) {
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
      const response = await fetch(`/api/pedidos-personalizados/catalogo/lebebe-exclusive?${params}`, { cache: 'no-store' })
      if (!response.ok) throw new Error(await lerErro(response))
      const body = await response.json() as { ok?: boolean; itens?: ProdutoCatalogoLebebeExclusive[] }
      if (body.ok !== true || !Array.isArray(body.itens)) throw new Error('A resposta do catálogo não pôde ser confirmada.')
      setResultados(body.itens)
      setPesquisou(true)
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : 'Não foi possível pesquisar o catálogo.')
    } finally {
      setBuscando(false)
    }
  }

  function validarAntesDeSalvar() {
    if (!fornecedor) return 'O fornecedor Lebebe Exclusive está indisponível.'
    if (!identificacao.unidade) return 'Selecione a unidade.'
    if (identificacao.consultora.trim().length < 2) return 'Informe a consultora.'
    if (!identificacao.cliente.trim()) return 'Informe o cliente.'
    if (identificacao.telefone.replace(/\D/g, '').length < 10) return 'Informe um telefone válido.'
    if (identificacao.numeroLancamento && !/^\d{1,6}$/.test(identificacao.numeroLancamento)) return 'Use até 6 dígitos no lançamento.'
    if (selecionados.size === 0) return 'Selecione ao menos um produto.'
    if ([...selecionados.values()].some((item) => !Number.isInteger(item.quantidade) || item.quantidade < 1)) return 'Revise as quantidades dos produtos.'
    return null
  }

  async function salvar(event: FormEvent) {
    event.preventDefault()
    if (salvandoRef.current || pedidoSalvo) return
    const problema = validarAntesDeSalvar()
    if (problema) {
      setErro(problema)
      toast.error(problema)
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
          ...identificacao,
          numeroLancamento: identificacao.numeroLancamento || null,
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
      `UNIDADE: ${opcoes.unidades.find((item) => item.chave === identificacao.unidade)?.nome ?? ''}`,
      `CONSULTORA: ${identificacao.consultora.trim().toLocaleUpperCase('pt-BR')}`,
      `CLIENTE: ${identificacao.cliente.trim().toLocaleUpperCase('pt-BR')}`,
      ...(identificacao.numeroLancamento ? [`LANÇAMENTO: ${identificacao.numeroLancamento}`] : []),
    ]
    for (const [indice, item] of [...selecionados.values()].entries()) {
      linhas.push('', `ITEM ${indice + 1}`, `PRODUTO: ${item.descricao}`, `REFERÊNCIA: ${item.referencia}`, `QUANTIDADE: ${item.quantidade}`)
      if (item.nomeOuLetra.trim()) linhas.push(`NOME OU LETRA: ${item.nomeOuLetra.trim().toLocaleUpperCase('pt-BR')}`)
    }
    return linhas.join('\n')
  }, [identificacao, opcoes.unidades, selecionados])

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
        <p className="mt-1">Preencha a identificação, pesquise manualmente por coleção, descrição ou referência e selecione os produtos. O custo não é exibido nesta tela.</p>
      </section>

      <section className="rounded-2xl border bg-white p-4 shadow-sm sm:p-6" aria-labelledby="identificacao-exclusive">
        <h2 id="identificacao-exclusive" className="text-lg font-bold">Identificação</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div><label className="mb-1 block text-sm font-medium" htmlFor="fornecedor-exclusive">Fornecedor *</label><Select value="lebebe_exclusive" disabled={bloqueado || Boolean(pedidoInicial)} onValueChange={(valor) => onFornecedorChange(valor as 'moriah_tapetes' | 'lebebe_exclusive')}><SelectTrigger id="fornecedor-exclusive" className="h-11"><SelectValue /></SelectTrigger><SelectContent>{opcoes.fornecedores.map((item) => <SelectItem key={item.id} value={item.chave}>{item.nome}</SelectItem>)}</SelectContent></Select></div>
          <div><label className="mb-1 block text-sm font-medium" htmlFor="unidade-exclusive">Unidade *</label><Select value={identificacao.unidade} disabled={bloqueado} onValueChange={(unidade) => setIdentificacao((atual) => ({ ...atual, unidade: unidade as UnidadePedidoPersonalizado }))}><SelectTrigger id="unidade-exclusive" className="h-11" aria-invalid={!identificacao.unidade}><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent>{opcoes.unidades.map((item) => <SelectItem key={item.chave} value={item.chave}>{item.nome}</SelectItem>)}</SelectContent></Select></div>
          <div><label className="mb-1 block text-sm font-medium" htmlFor="lancamento-exclusive">Lançamento</label><Input id="lancamento-exclusive" disabled={bloqueado} inputMode="numeric" maxLength={6} value={identificacao.numeroLancamento} onChange={(event) => setIdentificacao((atual) => ({ ...atual, numeroLancamento: event.target.value.replace(/\D/g, '').slice(0, 6) }))} /></div>
          <div><label className="mb-1 block text-sm font-medium" htmlFor="consultora-exclusive">Consultora *</label><Input id="consultora-exclusive" disabled={bloqueado} maxLength={20} aria-invalid={identificacao.consultora.trim().length < 2} value={identificacao.consultora} onChange={(event) => setIdentificacao((atual) => ({ ...atual, consultora: event.target.value }))} /></div>
          <div><label className="mb-1 block text-sm font-medium" htmlFor="cliente-exclusive">Cliente *</label><Input id="cliente-exclusive" disabled={bloqueado} maxLength={40} aria-invalid={!identificacao.cliente.trim()} value={identificacao.cliente} onChange={(event) => setIdentificacao((atual) => ({ ...atual, cliente: event.target.value }))} /></div>
          <div><label className="mb-1 block text-sm font-medium" htmlFor="telefone-exclusive">Telefone *</label><Input id="telefone-exclusive" disabled={bloqueado} inputMode="tel" aria-invalid={identificacao.telefone.replace(/\D/g, '').length < 10} placeholder="(41) 99999-9999" value={identificacao.telefone} onChange={(event) => setIdentificacao((atual) => ({ ...atual, telefone: aplicarMascaraTelefoneBR(event.target.value) }))} /></div>
        </div>
      </section>

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
          <Button type="button" variant="outline" disabled={bloqueado || buscando} onClick={() => { setFiltros({ colecao: '', descricao: '', referencia: '' }); setResultados([]); setPesquisou(false); setErro(null) }}><X />Limpar filtros</Button>
          <Button type="button" variant="outline" disabled={selecionados.size === 0} onClick={() => setMostrarSelecionados((atual) => !atual)}><Search />{mostrarSelecionados ? 'Voltar aos resultados' : `Mostrar selecionados (${selecionados.size})`}</Button>
        </div>

        {!pesquisou && !mostrarSelecionados && <p className="mt-6 rounded-xl border border-dashed p-6 text-center text-sm text-slate-500">Informe os filtros para pesquisar. O catálogo completo não é carregado automaticamente.</p>}
        {pesquisou && resultados.length === 0 && !mostrarSelecionados && <p className="mt-6 rounded-xl border border-dashed p-6 text-center text-sm text-slate-500">Nenhum produto encontrado.</p>}
        {mostrarSelecionados && selecionados.size === 0 && <p className="mt-6 rounded-xl border border-dashed p-6 text-center text-sm text-slate-500">Nenhum produto selecionado.</p>}

        {itensExibidos.length > 0 && <div className="mt-5 overflow-x-auto rounded-xl border">
          <table className="min-w-[1050px] w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-600"><tr><th className="p-3">Selecionar</th><th className="p-3">Coleção</th><th className="p-3">Descrição</th><th className="p-3">Referência</th><th className="p-3 text-right">Preço Unit.</th><th className="p-3">Quantidade</th><th className="p-3">Nome ou Letra</th><th className="p-3 text-right">Valor Total</th></tr></thead>
            <tbody>{itensExibidos.map((produto) => {
              const selecionado = selecionados.get(produto.id)
              return <tr key={produto.id} className="border-t align-top">
                <td className="p-3"><input type="checkbox" className="size-5" disabled={bloqueado} checked={Boolean(selecionado)} onChange={(event) => alternarProduto(produto, event.target.checked)} aria-label={`Selecionar ${produto.descricao}`} /></td>
                <td className="p-3 font-medium">{produto.colecao}</td><td className="p-3">{produto.descricao}</td><td className="p-3 font-mono">{produto.referencia}</td><td className="p-3 text-right font-medium">{formatarMoeda(produto.precoUnitario)}</td>
                <td className="p-3"><Input className="w-24" inputMode="numeric" min={1} type="number" disabled={bloqueado || !selecionado} value={selecionado?.quantidade ?? 1} onChange={(event) => atualizarSelecionado(produto, { quantidade: Math.max(1, Number.parseInt(event.target.value || '1', 10)) })} /></td>
                <td className="p-3"><Input className="min-w-48" maxLength={200} disabled={bloqueado || !selecionado} value={selecionado?.nomeOuLetra ?? ''} onChange={(event) => atualizarSelecionado(produto, { nomeOuLetra: event.target.value })} /></td>
                <td className="p-3 text-right font-bold">{selecionado ? formatarMoeda(produto.precoUnitario * selecionado.quantidade) : '—'}</td>
              </tr>
            })}</tbody>
          </table>
        </div>}

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <Button type="button" variant="outline" disabled={selecionados.size === 0} onClick={() => setMostrarSelecionados((atual) => !atual)}><Search />{mostrarSelecionados ? 'Voltar aos resultados' : `Mostrar selecionados (${selecionados.size})`}</Button>
          <p className="text-lg font-bold">Total: {formatarMoeda(total)}</p>
        </div>
      </section>

      {resumo && <section className="rounded-2xl border bg-white p-4 sm:p-6"><div className="flex items-center justify-between gap-3"><h2 className="font-bold">Resumo para o fornecedor</h2><Button type="button" variant="outline" onClick={() => void copiarResumo()}><ClipboardCopy />{copiado ? 'Copiado' : 'Copiar'}</Button></div><pre className="mt-4 whitespace-pre-wrap rounded-xl bg-slate-50 p-4 text-sm">{resumo}</pre></section>}
      {erro && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{erro}</div>}
      {pedidoSalvo && <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5"><div className="flex gap-3"><CheckCircle2 className="text-emerald-600" /><div><h2 className="font-bold text-emerald-900">{pedidoInicial ? 'Rascunho atualizado' : 'Orçamento salvo'}</h2><p className="text-sm text-emerald-800">Status {pedidoSalvo.status}; versão {pedidoSalvo.version}; {selecionados.size} produto(s). A venda ainda não foi fechada.</p></div></div></section>}
      <div className="sticky bottom-3 flex justify-end rounded-2xl border bg-white/95 p-3 shadow-lg backdrop-blur"><Button type="submit" className="min-h-12" disabled={bloqueado}>{salvando ? <Loader2 className="animate-spin" /> : <Save />}{salvando ? 'Salvando...' : pedidoSalvo ? 'Salvo' : pedidoInicial ? 'Salvar rascunho' : 'Salvar orçamento'}</Button></div>
    </form>
  )
}
