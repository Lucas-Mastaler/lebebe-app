'use client'

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, CheckCircle2, ChevronLeft, ChevronRight, Filter, ListChecks, Loader2, Package, PackageX, Save, Search, Sparkles, X } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import { aplicarMascaraTelefoneBR } from '@/lib/atendimento-presencial/telefone'
import type { ProdutoCatalogoLebebeExclusive, UnidadePedidoPersonalizado } from '@/lib/pedidos-personalizados'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { BarraResumoPedidoPersonalizado } from './BarraResumoPedidoPersonalizado'
import type { OpcoesNovoPedido } from './novo-pedido-modelo'
import type { PedidoDetalhe } from './gestao-modelo'
import { PreviaMensagem } from './PreviaMensagem'
import { AvisoPedidoSalvoFixo } from './AvisoPedidoSalvoFixo'

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
  /** Quando informado, a barra fixa passa a usar o padrão visual compartilhado com a Moriah e exibe o botão "Novo pedido" (fluxo de criação). Sem essa prop, mantém a barra própria já usada na edição pela Gestão. */
  onNovoPedido?: () => void
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
  return (await lerErroDetalhado(response)).mensagem
}

type ProblemaRespostaApi = { codigo?: unknown; campo?: unknown; mensagem?: unknown }

export async function lerErroDetalhado(response: Response) {
  try {
    const body = await response.json() as { mensagem?: unknown; problemas?: unknown }
    const problemas = Array.isArray(body.problemas)
      ? body.problemas.filter((item): item is ProblemaRespostaApi => typeof item === 'object' && item !== null)
      : []
    const primeiroProblema = problemas.find((item) => typeof item.mensagem === 'string')
    const mensagem = typeof primeiroProblema?.mensagem === 'string'
      ? primeiroProblema.mensagem
      : typeof body.mensagem === 'string'
        ? body.mensagem
        : null
    if (mensagem) {
      return {
        mensagem,
        campo: typeof primeiroProblema?.campo === 'string' ? primeiroProblema.campo : null,
      }
    }
  } catch {
    // A resposta técnica não é exibida integralmente.
  }
  if (response.status === 401) return { mensagem: 'Sua sessão expirou. Entre novamente.', campo: null }
  if (response.status === 403) return { mensagem: 'Você não possui acesso a esta operação.', campo: null }
  return { mensagem: 'Não foi possível concluir a operação agora.', campo: null }
}

export function montarPayloadLebebeExclusive(params: {
  identificacao: Identificacao
  itens: readonly Pick<ItemSelecionado, 'id' | 'quantidade' | 'nomeOuLetra'>[]
  idempotencyKey?: string
  expectedVersion?: number
}) {
  return {
    ...(params.expectedVersion === undefined
      ? { idempotencyKey: params.idempotencyKey }
      : { expectedVersion: params.expectedVersion }),
    fornecedor: 'lebebe_exclusive' as const,
    unidade: params.identificacao.unidade,
    consultora: params.identificacao.consultora,
    cliente: params.identificacao.cliente,
    telefone: params.identificacao.telefone,
    numeroLancamento: params.identificacao.numeroLancamento || null,
    itens: params.itens.map((item, indice) => ({
      produtoId: item.id,
      ordem: indice + 1,
      quantidade: item.quantidade,
      nomeOuLetra: item.nomeOuLetra.trim() || null,
    })),
  }
}

function EstadoVazioCatalogo({ icone: Icone, texto }: { icone: LucideIcon; texto: string }) {
  return (
    <div className="mt-6 flex flex-col items-center gap-2 rounded-xl border border-dashed border-slate-200 p-6 text-center">
      <Icone className="size-5 text-slate-400" aria-hidden="true" />
      <p className="text-sm text-slate-500">{texto}</p>
    </div>
  )
}

function linhaProdutoClasse(selecionado: boolean) {
  return `border-t align-top transition-colors ${selecionado ? 'border-l-4 border-l-emerald-400 bg-emerald-50/60 hover:bg-emerald-50' : 'hover:bg-slate-50'}`
}

function cardProdutoClasse(selecionado: boolean) {
  return `rounded-lg border p-3 transition-colors ${selecionado ? 'border-l-4 border-emerald-300 bg-emerald-50/60' : 'border-slate-200'}`
}

function BotaoMostrarSelecionados({ ativo, quantidade, disabled, onClick, className = '' }: { ativo: boolean; quantidade: number; disabled: boolean; onClick: () => void; className?: string }) {
  return (
    <Button
      type="button"
      variant="outline"
      disabled={disabled}
      aria-pressed={ativo}
      onClick={onClick}
      className={`${className} ${ativo ? 'border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100' : ''}`}
    >
      {ativo ? <ArrowLeft /> : <Search />}
      {ativo ? 'Voltar aos produtos' : 'Mostrar selecionados'}
      {!ativo && quantidade > 0 && (
        <span className="ml-0.5 inline-flex min-w-5 items-center justify-center rounded-full bg-emerald-100 px-1.5 text-xs font-semibold text-emerald-700">{quantidade}</span>
      )}
    </Button>
  )
}

function BotaoRemoverProduto({ nome, disabled, onClick, className = '' }: { nome: string; disabled: boolean; onClick: () => void; className?: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={disabled}
          onClick={onClick}
          aria-label={`Remover produto: ${nome}`}
          className={`size-11 shrink-0 text-red-600 hover:bg-red-50 hover:text-red-700 ${className}`}
        >
          <X aria-hidden="true" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>Remover produto</TooltipContent>
    </Tooltip>
  )
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
  onNovoPedido,
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
  const [pulsoFiltrar, setPulsoFiltrar] = useState(false)
  const idempotencyKey = useRef(crypto.randomUUID())
  const salvandoRef = useRef(false)
  const filtroPreenchidoAnteriorRef = useRef(false)
  const ultimaBuscaRef = useRef({ colecao: '', descricao: '', referencia: '' })

  const algumFiltroPreenchido = Object.values(filtros).some((valor) => valor.trim() !== '')
  const filtroPendente = algumFiltroPreenchido
    && (filtros.colecao !== ultimaBuscaRef.current.colecao || filtros.descricao !== ultimaBuscaRef.current.descricao || filtros.referencia !== ultimaBuscaRef.current.referencia)

  useEffect(() => {
    if (!algumFiltroPreenchido || filtroPreenchidoAnteriorRef.current) return
    setPulsoFiltrar(true)
    const timer = setTimeout(() => setPulsoFiltrar(false), 500)
    return () => clearTimeout(timer)
  }, [algumFiltroPreenchido])

  useEffect(() => {
    filtroPreenchidoAnteriorRef.current = algumFiltroPreenchido
  }, [algumFiltroPreenchido])

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

  function removerProduto(produto: ProdutoCatalogoLebebeExclusive) {
    setRascunhosItens((atuais) => {
      const proximos = new Map(atuais)
      proximos.delete(produto.id)
      return proximos
    })
    setSelecionados((atuais) => {
      const proximos = new Map(atuais)
      proximos.delete(produto.id)
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
      ultimaBuscaRef.current = { ...filtros }
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
      const itensSelecionados = [...selecionados.values()]
      const payload = montarPayloadLebebeExclusive({
        identificacao: identificacaoAtual,
        itens: itensSelecionados,
        ...(pedidoInicial
          ? { expectedVersion: pedidoInicial.version }
          : { idempotencyKey: idempotencyKey.current }),
      })
      const response = await fetch(pedidoInicial
        ? `/api/pedidos-personalizados/pedidos/${pedidoInicial.id}/comercial`
        : '/api/pedidos-personalizados/pedidos', {
        method: pedidoInicial ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!response.ok) {
        const falhaApi = await lerErroDetalhado(response)
        if (falhaApi.campo?.startsWith('itens.')) {
          setMostrarSelecionados(true)
          const indice = Number(falhaApi.campo.split('.')[1])
          const produto = Number.isInteger(indice) ? itensSelecionados[indice] : null
          throw new Error(produto ? `${falhaApi.mensagem} Produto: ${produto.descricao}.` : falhaApi.mensagem)
        }
        if (['unidade', 'consultora', 'cliente', 'telefone', 'numeroLancamento'].includes(falhaApi.campo ?? '')) {
          onValidacaoIdentificacaoInvalida?.()
        }
        throw new Error(falhaApi.mensagem)
      }
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
      <div className="flex items-center gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-[#00A5E6]"><Package className="size-5" aria-hidden="true" /></span>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-[#00A5E6]">Lebebe Exclusive</p>
          <h2 className="text-base font-bold text-slate-900 sm:text-lg">Produtos de catálogo</h2>
        </div>
      </div>

      {!ocultarIdentificacao && <section className="rounded-2xl border bg-white p-4 shadow-sm sm:p-6" aria-labelledby="identificacao-exclusive">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-sky-50 text-[#00A5E6]"><Sparkles aria-hidden="true" /></span>
          <div><h2 id="identificacao-exclusive" className="text-lg font-bold text-slate-900">Identificação</h2><p className="text-sm text-slate-500">Dados comerciais do pedido.</p></div>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div><label className="mb-1 block text-sm font-medium" htmlFor="unidade-exclusive">Unidade *</label><Select value={identificacao.unidade} disabled={bloqueado} onValueChange={(unidade) => setIdentificacao((atual) => ({ ...atual, unidade: unidade as UnidadePedidoPersonalizado }))}><SelectTrigger id="unidade-exclusive" className="h-11" aria-invalid={!identificacao.unidade}><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent>{opcoes.unidades.map((item) => <SelectItem key={item.chave} value={item.chave}>{item.nome}</SelectItem>)}</SelectContent></Select></div>
          <div><label className="mb-1 block text-sm font-medium" htmlFor="consultora-exclusive">Consultora *</label><Input id="consultora-exclusive" disabled={bloqueado} maxLength={20} aria-invalid={identificacao.consultora.trim().length < 2} value={identificacao.consultora} onChange={(event) => setIdentificacao((atual) => ({ ...atual, consultora: event.target.value }))} /></div>
          <div><label className="mb-1 block text-sm font-medium" htmlFor="lancamento-exclusive">Lançamento</label><Input id="lancamento-exclusive" disabled={bloqueado} inputMode="numeric" maxLength={6} value={identificacao.numeroLancamento} onChange={(event) => setIdentificacao((atual) => ({ ...atual, numeroLancamento: event.target.value.replace(/\D/g, '').slice(0, 6) }))} /></div>
          <div><label className="mb-1 block text-sm font-medium" htmlFor="cliente-exclusive">Cliente *</label><Input id="cliente-exclusive" disabled={bloqueado} maxLength={40} aria-invalid={!identificacao.cliente.trim()} value={identificacao.cliente} onChange={(event) => setIdentificacao((atual) => ({ ...atual, cliente: event.target.value }))} /></div>
          <div><label className="mb-1 block text-sm font-medium" htmlFor="telefone-exclusive">Telefone *</label><Input id="telefone-exclusive" disabled={bloqueado} inputMode="tel" aria-invalid={identificacao.telefone.replace(/\D/g, '').length < 10} placeholder="(41) 99999-9999" value={identificacao.telefone} onChange={(event) => setIdentificacao((atual) => ({ ...atual, telefone: aplicarMascaraTelefoneBR(event.target.value) }))} /></div>
        </div>
      </section>}

      <section className="rounded-2xl border bg-white p-4 shadow-sm sm:p-6" aria-labelledby="catalogo-exclusive">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-sky-50 text-[#00A5E6]"><Package aria-hidden="true" /></span>
          <div><h2 id="catalogo-exclusive" className="text-lg font-bold text-slate-900">Produtos</h2><p className="text-sm text-slate-500">Pesquise por coleção, descrição ou referência e informe a quantidade para adicionar ao pedido. O custo não é exibido nesta tela.</p></div>
        </div>

        <div className="mt-5">
          <div className="flex items-center gap-1.5">
            <Search className="size-4 text-slate-400" aria-hidden="true" />
            <h3 className="text-sm font-semibold text-slate-700">Pesquisar produtos</h3>
          </div>
          <p className="mt-1 text-xs text-slate-500">Você pode pesquisar usando apenas um dos campos — cada filtro preenchido precisa ter 3 caracteres. A busca só acontece ao pressionar Enter ou Filtrar.</p>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <div>
              <label htmlFor="filtro-colecao-exclusive" className="mb-1 block text-sm font-medium text-slate-700">Coleção</label>
              <Input id="filtro-colecao-exclusive" placeholder="Coleção" disabled={bloqueado} value={filtros.colecao} onChange={(event) => setFiltros({ ...filtros, colecao: event.target.value })} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); void pesquisar() } }} />
            </div>
            <div>
              <label htmlFor="filtro-descricao-exclusive" className="mb-1 block text-sm font-medium text-slate-700">Descrição</label>
              <Input id="filtro-descricao-exclusive" placeholder="Descrição" disabled={bloqueado} value={filtros.descricao} onChange={(event) => setFiltros({ ...filtros, descricao: event.target.value })} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); void pesquisar() } }} />
            </div>
            <div>
              <label htmlFor="filtro-referencia-exclusive" className="mb-1 block text-sm font-medium text-slate-700">Referência</label>
              <Input id="filtro-referencia-exclusive" placeholder="Referência" disabled={bloqueado} value={filtros.referencia} onChange={(event) => setFiltros({ ...filtros, referencia: event.target.value })} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); void pesquisar() } }} />
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button
              type="button"
              disabled={bloqueado || buscando}
              onClick={() => void pesquisar()}
              className={`${filtroPendente ? 'ring-2 ring-offset-2 ring-[#00A5E6]' : ''} ${pulsoFiltrar ? 'animate-in zoom-in-95 duration-500' : ''}`}
            >
              {buscando ? <Loader2 className="animate-spin" /> : <Filter />}Filtrar
            </Button>
            <Button type="button" variant="outline" disabled={bloqueado || buscando} onClick={() => { setFiltros({ colecao: '', descricao: '', referencia: '' }); setResultados([]); setPaginacao({ pagina: 1, totalRegistros: 0, totalPaginas: 0 }); setPesquisou(false); setErro(null) }}><X />Limpar filtros</Button>
            {filtroPendente && <p className="text-xs font-medium text-[#00A5E6]">Filtro preenchido — clique em Filtrar</p>}
            <span className="mx-1 hidden h-6 w-px bg-slate-200 sm:block" aria-hidden="true" />
            <BotaoMostrarSelecionados ativo={mostrarSelecionados} quantidade={selecionados.size} disabled={selecionados.size === 0} onClick={() => setMostrarSelecionados((atual) => !atual)} />
          </div>
        </div>

        {mostrarSelecionados && <p className="mt-4 flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800"><ListChecks className="size-4" aria-hidden="true" />Mostrando {selecionados.size} produto(s) selecionado(s).</p>}
        {buscando && itensExibidos.length > 0 && <p className="mt-4 flex items-center gap-1.5 text-xs font-medium text-slate-500"><Loader2 className="size-3.5 animate-spin" aria-hidden="true" />Atualizando resultados…</p>}

        {buscando && !pesquisou && !mostrarSelecionados && (
          <div className="mt-6 space-y-2" aria-hidden="true">
            <Skeleton className="h-11 w-full" />
            <Skeleton className="h-11 w-full" />
            <Skeleton className="h-11 w-full" />
          </div>
        )}
        {!buscando && !pesquisou && !mostrarSelecionados && <EstadoVazioCatalogo icone={Search} texto="Pesquise por coleção, descrição ou referência para encontrar produtos." />}
        {pesquisou && resultados.length === 0 && !mostrarSelecionados && <EstadoVazioCatalogo icone={PackageX} texto="Nenhum produto encontrado. Tente ajustar os filtros." />}
        {mostrarSelecionados && selecionados.size === 0 && <EstadoVazioCatalogo icone={ListChecks} texto="Você ainda não selecionou produtos. Preencha uma quantidade para adicionar um item ao pedido." />}

        {itensExibidos.length > 0 && <div className={`mt-5 rounded-xl border transition-opacity ${buscando ? 'opacity-60' : ''}`}>
          <table className="hidden w-full table-fixed text-left text-sm lg:table">
            <colgroup><col className="w-[14%]" /><col className="w-[21%]" /><col className="w-[9%]" /><col className="w-[11%]" /><col className="w-[9%]" /><col className="w-[15%]" /><col className="w-[11%]" /><col className="w-[10%]" /></colgroup>
            <thead className="border-b border-slate-200 bg-slate-100 text-xs font-semibold uppercase tracking-wide text-slate-700"><tr><th className="p-2.5">Coleção</th><th className="p-2.5">Descrição</th><th className="p-2.5">Referência</th><th className="p-2.5 text-right">Preço Unit.</th><th className="p-2.5">Quantidade</th><th className="p-2.5">Nome ou Letra</th><th className="p-2.5 text-right">Valor Total</th><th className="p-2.5 text-right"><span className="sr-only">Remover</span></th></tr></thead>
            <tbody>{itensExibidos.map((produto) => {
              const selecionado = selecionados.get(produto.id)
              const rascunho = rascunhosItens.get(produto.id)
              const quantidade = rascunho?.quantidade ?? selecionado?.quantidade.toString() ?? ''
              const quantidadeInvalida = quantidade.trim() !== '' && !quantidadeValida(quantidade.trim())
              const nomeOuLetra = rascunho?.nomeOuLetra ?? selecionado?.nomeOuLetra ?? ''
              return <tr key={produto.id} className={linhaProdutoClasse(Boolean(selecionado))}>
                <td className="break-words p-2.5 font-medium">{produto.colecao}</td><td className="break-words p-2.5">{produto.descricao}</td><td className="break-all p-2.5 font-mono">{produto.referencia}</td><td className="p-2.5 text-right font-medium whitespace-nowrap">{formatarMoeda(produto.precoUnitario)}</td>
                <td className="p-2.5"><Input className="w-full min-w-0" inputMode="numeric" min={1} type="number" disabled={bloqueado} value={quantidade} aria-invalid={quantidadeInvalida} onChange={(event) => atualizarQuantidade(produto, event.target.value)} />{quantidadeInvalida && <p className="mt-1 text-xs text-red-600">Use um inteiro maior que zero.</p>}</td>
                <td className="p-2.5"><Input className="w-full min-w-0" maxLength={200} disabled={bloqueado} value={nomeOuLetra} onChange={(event) => atualizarNomeOuLetra(produto, event.target.value)} /></td>
                <td className={`p-2.5 text-right font-bold whitespace-nowrap ${selecionado ? 'text-emerald-700' : ''}`}>{selecionado ? formatarMoeda(produto.precoUnitario * selecionado.quantidade) : '—'}</td>
                <td className="p-2.5 text-right">{selecionado && <BotaoRemoverProduto nome={produto.descricao} disabled={bloqueado} onClick={() => removerProduto(produto)} />}</td>
              </tr>
            })}</tbody>
          </table>
          <div className="space-y-3 p-3 pb-24 lg:hidden lg:pb-3">{itensExibidos.map((produto) => {
            const selecionado = selecionados.get(produto.id)
            const rascunho = rascunhosItens.get(produto.id)
            const quantidade = rascunho?.quantidade ?? selecionado?.quantidade.toString() ?? ''
            const quantidadeInvalida = quantidade.trim() !== '' && !quantidadeValida(quantidade.trim())
            const nomeOuLetra = rascunho?.nomeOuLetra ?? selecionado?.nomeOuLetra ?? ''
            return <article key={produto.id} className={cardProdutoClasse(Boolean(selecionado))}><div className="flex items-start justify-between gap-2"><div className="grid gap-2 text-sm"><p className="font-medium">{produto.descricao}</p><p><span className="text-slate-500">Coleção: </span>{produto.colecao}</p><p><span className="text-slate-500">Referência: </span>{produto.referencia}</p><p><span className="text-slate-500">Preço unitário: </span>{formatarMoeda(produto.precoUnitario)}</p></div>{selecionado && <BotaoRemoverProduto nome={produto.descricao} disabled={bloqueado} onClick={() => removerProduto(produto)} />}</div><div className="mt-3 grid gap-3 sm:grid-cols-2"><label className="grid gap-1 text-sm font-medium">Quantidade<Input inputMode="numeric" min={1} type="number" disabled={bloqueado} value={quantidade} aria-invalid={quantidadeInvalida} onChange={(event) => atualizarQuantidade(produto, event.target.value)} />{quantidadeInvalida && <span className="text-xs font-normal text-red-600">Use um inteiro maior que zero.</span>}</label><label className="grid gap-1 text-sm font-medium">Nome ou Letra<Input maxLength={200} disabled={bloqueado} value={nomeOuLetra} onChange={(event) => atualizarNomeOuLetra(produto, event.target.value)} /></label></div><p className={`mt-3 text-right font-bold ${selecionado ? 'text-emerald-700' : ''}`}>Valor total: {selecionado ? formatarMoeda(produto.precoUnitario * selecionado.quantidade) : '—'}</p></article>
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

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
          <BotaoMostrarSelecionados ativo={mostrarSelecionados} quantidade={selecionados.size} disabled={selecionados.size === 0} onClick={() => setMostrarSelecionados((atual) => !atual)} />
          <p className="text-sm text-slate-500">{selecionados.size} produto(s) selecionado(s) · {formatarMoeda(total)}</p>
        </div>
      </section>

      {pedidoInicial
        ? resumo && <section className="rounded-2xl border bg-white p-4 sm:p-6"><div className="flex items-center justify-between gap-3"><h2 className="font-bold">Resumo para o fornecedor</h2><Button type="button" variant="outline" onClick={() => void copiarResumo()}>{copiado ? 'Copiado' : 'Copiar'}</Button></div><pre className="mt-4 whitespace-pre-wrap rounded-xl bg-slate-50 p-4 text-sm">{resumo}</pre></section>
        : <PreviaMensagem mensagem={resumo || null} copiada={copiado} onCopiar={() => void copiarResumo()} orientacaoObservacoes />}
      {erro && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{erro}</div>}
      {pedidoSalvo && <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5"><div className="flex gap-3"><CheckCircle2 className="text-emerald-600" /><div><h2 className="font-bold text-emerald-900">{pedidoInicial ? 'Rascunho atualizado' : 'Orçamento salvo'}</h2><p className="text-sm text-emerald-800">Status {pedidoSalvo.status}; versão {pedidoSalvo.version}; {selecionados.size} produto(s). A venda ainda não foi fechada.</p></div></div>{!pedidoInicial && <Button asChild type="button" variant="outline" className="mt-4 min-h-10 border-emerald-300 bg-white text-emerald-800 hover:bg-emerald-100"><Link href="/pedidos-personalizados">Ir para a gestão de pedidos<ArrowRight /></Link></Button>}</section>}
      {onNovoPedido ? (
        <div className="sticky bottom-0 z-20 flex flex-col gap-2">
          <AvisoPedidoSalvoFixo
            disparo={Boolean(pedidoSalvo) && !pedidoInicial}
            titulo="Pedido salvo"
            mensagem="O pedido foi salvo com sucesso. Você pode ir para a gestão de pedidos personalizados."
          />
          <BarraResumoPedidoPersonalizado
            quantidadeItens={selecionados.size}
            totalFormatado={formatarMoeda(total)}
            salvando={salvando}
            podeSalvar={!bloqueado}
            rotuloSalvar={salvando ? 'Salvando...' : pedidoSalvo ? 'Salvo' : pedidoInicial ? 'Salvar rascunho' : 'Salvar orçamento'}
            onNovoPedido={onNovoPedido}
            bloqueadoNovoPedido={salvando}
            acaoSecundaria={
              <BotaoMostrarSelecionados
                ativo={mostrarSelecionados}
                quantidade={selecionados.size}
                disabled={selecionados.size === 0}
                onClick={() => setMostrarSelecionados((atual) => !atual)}
                className="min-h-12 flex-1 sm:flex-none"
              />
            }
          />
        </div>
      ) : (
        <div className="sticky bottom-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-white/95 p-3 shadow-lg backdrop-blur"><p className="text-sm font-bold text-slate-900 sm:text-base">Itens selecionados: <span className="text-emerald-700">{selecionados.size}</span> | Total: {formatarMoeda(total)}</p><Button type="submit" className="min-h-12" disabled={bloqueado}>{salvando ? <Loader2 className="animate-spin" /> : <Save />}{salvando ? 'Salvando...' : pedidoSalvo ? 'Salvo' : pedidoInicial ? 'Salvar rascunho' : 'Salvar orçamento'}</Button></div>
      )}
    </form>
  )
}
