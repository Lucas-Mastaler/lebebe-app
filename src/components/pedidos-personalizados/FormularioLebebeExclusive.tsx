'use client'

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, ChevronLeft, ChevronRight, Filter, ListChecks, Loader2, Package, PackageX, Save, Search, Sparkles, X } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import { aplicarMascaraTelefoneBR } from '@/lib/atendimento-presencial/telefone'
import type { ProdutoCatalogoLebebeExclusive, UnidadePedidoPersonalizado } from '@/lib/pedidos-personalizados'
import { Alert, Button, EmptyState, FormField, Input, ResponsiveTable, Section, SkeletonRows } from '@/components/design-system'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
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
  idempotencyKey: string
}) {
  return {
    idempotencyKey: params.idempotencyKey,
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

/** Payload da rota `/produtos`: só os itens — identificação é editada separadamente por `/comercial`. */
export function montarPayloadProdutosLebebeExclusive(params: {
  itens: readonly Pick<ItemSelecionado, 'id' | 'quantidade' | 'nomeOuLetra'>[]
  expectedVersion: number
}) {
  return {
    expectedVersion: params.expectedVersion,
    itens: params.itens.map((item, indice) => ({
      produtoId: item.id,
      ordem: indice + 1,
      quantidade: item.quantidade,
      nomeOuLetra: item.nomeOuLetra.trim() || null,
    })),
  }
}

function BotaoMostrarSelecionados({ ativo, quantidade, disabled, onClick, className = '' }: { ativo: boolean; quantidade: number; disabled: boolean; onClick: () => void; className?: string }) {
  return (
    <Button
      type="button"
      variant="secondary"
      disabled={disabled}
      aria-pressed={ativo}
      onClick={onClick}
      className={`${className} ${ativo ? 'border border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100' : ''}`}
    >
      {ativo ? <ArrowLeft /> : <Search />}
      {ativo ? 'Voltar aos produtos' : 'Mostrar selecionados'}
      {!ativo && quantidade > 0 && (
        <span className="ml-0.5 inline-flex min-w-5 items-center justify-center rounded-full bg-emerald-100 px-1.5 text-xs font-semibold text-emerald-700">{quantidade}</span>
      )}
    </Button>
  )
}

function BotaoRemoverProduto({ nome, disabled, onClick }: { nome: string; disabled: boolean; onClick: () => void }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="destructive"
          size="icon"
          disabled={disabled}
          onClick={onClick}
          aria-label={`Remover produto: ${nome}`}
          className="size-11 shrink-0"
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
    if (!pedidoInicial) {
      const problemaIdentificacao = validarIdentificacaoAntesDeSalvar()
      if (problemaIdentificacao) return problemaIdentificacao
    }
    if (selecionados.size === 0) return 'Selecione ao menos um produto.'
    if ([...selecionados.values()].some((item) => !Number.isInteger(item.quantidade) || item.quantidade < 1)) return 'Revise as quantidades dos produtos.'
    return null
  }

  async function salvar(event: FormEvent) {
    event.preventDefault()
    if (salvandoRef.current || pedidoSalvo) return
    const problemaIdentificacao = pedidoInicial ? null : validarIdentificacaoAntesDeSalvar()
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
      // Editando (pedidoInicial definido): só produtos — identificação é responsabilidade de
      // "Editar dados comerciais" (rota /comercial), separada desta tela.
      const payload = pedidoInicial
        ? montarPayloadProdutosLebebeExclusive({ itens: itensSelecionados, expectedVersion: pedidoInicial.version })
        : montarPayloadLebebeExclusive({ identificacao: identificacaoAtual, itens: itensSelecionados, idempotencyKey: idempotencyKey.current })
      const response = await fetch(pedidoInicial
        ? `/api/pedidos-personalizados/pedidos/${pedidoInicial.id}/produtos`
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
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Package className="size-5" aria-hidden="true" /></span>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">Lebebe Exclusive</p>
          <h2 className="text-base font-bold text-slate-900 sm:text-lg">Produtos de catálogo</h2>
        </div>
      </div>

      {!ocultarIdentificacao && (
        <Section tone="section-1" icon={<Sparkles className="size-4" />} title="Identificação" description="Dados comerciais do pedido.">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <FormField id="unidade-exclusive" label="Unidade" required>
              {(f) => <Select value={identificacao.unidade} disabled={bloqueado} onValueChange={(unidade) => setIdentificacao((atual) => ({ ...atual, unidade: unidade as UnidadePedidoPersonalizado }))}><SelectTrigger id={f.id} className="h-11" aria-invalid={!identificacao.unidade}><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent>{opcoes.unidades.map((item) => <SelectItem key={item.chave} value={item.chave}>{item.nome}</SelectItem>)}</SelectContent></Select>}
            </FormField>
            <FormField id="consultora-exclusive" label="Consultora" required>
              {(f) => <Input {...f} disabled={bloqueado} maxLength={20} aria-invalid={identificacao.consultora.trim().length < 2} value={identificacao.consultora} onChange={(event) => setIdentificacao((atual) => ({ ...atual, consultora: event.target.value }))} />}
            </FormField>
            <FormField id="lancamento-exclusive" label="Lançamento">
              {(f) => <Input {...f} disabled={bloqueado} inputMode="numeric" maxLength={6} value={identificacao.numeroLancamento} onChange={(event) => setIdentificacao((atual) => ({ ...atual, numeroLancamento: event.target.value.replace(/\D/g, '').slice(0, 6) }))} />}
            </FormField>
            <FormField id="cliente-exclusive" label="Cliente" required>
              {(f) => <Input {...f} disabled={bloqueado} maxLength={40} aria-invalid={!identificacao.cliente.trim()} value={identificacao.cliente} onChange={(event) => setIdentificacao((atual) => ({ ...atual, cliente: event.target.value }))} />}
            </FormField>
            <FormField id="telefone-exclusive" label="Telefone" required>
              {(f) => <Input {...f} disabled={bloqueado} inputMode="tel" aria-invalid={identificacao.telefone.replace(/\D/g, '').length < 10} placeholder="(41) 99999-9999" value={identificacao.telefone} onChange={(event) => setIdentificacao((atual) => ({ ...atual, telefone: aplicarMascaraTelefoneBR(event.target.value) }))} />}
            </FormField>
          </div>
        </Section>
      )}

      <Section tone="section-2" icon={<Package className="size-4" />} title="Produtos" description="Pesquise por coleção, descrição ou referência e informe a quantidade para adicionar ao pedido. O custo não é exibido nesta tela.">
        <div className="mt-1">
          <div className="flex items-center gap-1.5">
            <Search className="size-4 text-slate-400" aria-hidden="true" />
            <h3 className="text-sm font-semibold text-slate-700">Pesquisar produtos</h3>
          </div>
          <p className="mt-1 text-xs text-slate-500">Você pode pesquisar usando apenas um dos campos — cada filtro preenchido precisa ter 3 caracteres. A busca só acontece ao pressionar Enter ou Filtrar.</p>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <FormField id="filtro-colecao-exclusive" label="Coleção">
              {(f) => <Input {...f} placeholder="Coleção" disabled={bloqueado} value={filtros.colecao} onChange={(event) => setFiltros({ ...filtros, colecao: event.target.value })} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); void pesquisar() } }} />}
            </FormField>
            <FormField id="filtro-descricao-exclusive" label="Descrição">
              {(f) => <Input {...f} placeholder="Descrição" disabled={bloqueado} value={filtros.descricao} onChange={(event) => setFiltros({ ...filtros, descricao: event.target.value })} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); void pesquisar() } }} />}
            </FormField>
            <FormField id="filtro-referencia-exclusive" label="Referência">
              {(f) => <Input {...f} placeholder="Referência" disabled={bloqueado} value={filtros.referencia} onChange={(event) => setFiltros({ ...filtros, referencia: event.target.value })} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); void pesquisar() } }} />}
            </FormField>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button
              type="button"
              disabled={bloqueado || buscando}
              loading={buscando}
              onClick={() => void pesquisar()}
              className={`${filtroPendente ? 'ring-2 ring-offset-2 ring-primary' : ''} ${pulsoFiltrar ? 'animate-in zoom-in-95 duration-500' : ''}`}
            >
              <Filter />Filtrar
            </Button>
            <Button type="button" variant="secondary" disabled={bloqueado || buscando} onClick={() => { setFiltros({ colecao: '', descricao: '', referencia: '' }); setResultados([]); setPaginacao({ pagina: 1, totalRegistros: 0, totalPaginas: 0 }); setPesquisou(false); setErro(null) }}><X />Limpar filtros</Button>
            {filtroPendente && <p className="text-xs font-medium text-primary">Filtro preenchido — clique em Filtrar</p>}
            <span className="mx-1 hidden h-6 w-px bg-slate-200 sm:block" aria-hidden="true" />
            <BotaoMostrarSelecionados ativo={mostrarSelecionados} quantidade={selecionados.size} disabled={selecionados.size === 0} onClick={() => setMostrarSelecionados((atual) => !atual)} />
          </div>
        </div>

        {mostrarSelecionados && <p className="mt-4 flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800"><ListChecks className="size-4" aria-hidden="true" />Mostrando {selecionados.size} produto(s) selecionado(s).</p>}
        {buscando && itensExibidos.length > 0 && <p className="mt-4 flex items-center gap-1.5 text-xs font-medium text-slate-500"><Loader2 className="size-3.5 animate-spin" aria-hidden="true" />Atualizando resultados…</p>}

        {buscando && !pesquisou && !mostrarSelecionados && (
          <div className="mt-6" aria-hidden="true">
            <SkeletonRows rows={3} />
          </div>
        )}
        {!buscando && !pesquisou && !mostrarSelecionados && <EmptyState icon={<Search className="size-5" />} title="Pesquise para encontrar produtos" description="Pesquise por coleção, descrição ou referência para encontrar produtos." />}
        {pesquisou && resultados.length === 0 && !mostrarSelecionados && <EmptyState icon={<PackageX className="size-5" />} title="Nenhum produto encontrado" description="Tente ajustar os filtros." />}
        {mostrarSelecionados && selecionados.size === 0 && <EmptyState icon={<ListChecks className="size-5" />} title="Nenhum produto selecionado" description="Preencha uma quantidade para adicionar um item ao pedido." />}

        {itensExibidos.length > 0 && (
          <div className={`mt-5 transition-opacity ${buscando ? 'opacity-60' : ''}`}>
            <ResponsiveTable
              columns={[
                { key: 'colecao', header: 'Coleção', width: 'content', render: (produto) => produto.colecao },
                { key: 'descricao', header: 'Descrição', width: 'wide', render: (produto) => produto.descricao },
                { key: 'referencia', header: 'Referência', width: 'content', className: 'font-mono', render: (produto) => produto.referencia },
                { key: 'precoUnitario', header: 'Preço Unit.', width: 'compact', className: 'text-right', render: (produto) => formatarMoeda(produto.precoUnitario) },
                {
                  key: 'quantidade', header: 'Quantidade', width: 'standard', render: (produto) => {
                    const selecionado = selecionados.get(produto.id)
                    const rascunho = rascunhosItens.get(produto.id)
                    const quantidade = rascunho?.quantidade ?? selecionado?.quantidade.toString() ?? ''
                    const quantidadeInvalida = quantidade.trim() !== '' && !quantidadeValida(quantidade.trim())
                    return (
                      <div>
                        <Input className="w-full min-w-0" inputMode="numeric" min={1} type="number" disabled={bloqueado} value={quantidade} aria-invalid={quantidadeInvalida} onChange={(event) => atualizarQuantidade(produto, event.target.value)} />
                        {quantidadeInvalida && <p className="mt-1 text-xs text-destructive">Use um inteiro maior que zero.</p>}
                      </div>
                    )
                  },
                },
                {
                  key: 'nomeOuLetra', header: 'Nome ou Letra', width: 'wide', render: (produto) => {
                    const selecionado = selecionados.get(produto.id)
                    const rascunho = rascunhosItens.get(produto.id)
                    const nomeOuLetra = rascunho?.nomeOuLetra ?? selecionado?.nomeOuLetra ?? ''
                    return <Input className="w-full min-w-0" maxLength={200} disabled={bloqueado} value={nomeOuLetra} onChange={(event) => atualizarNomeOuLetra(produto, event.target.value)} />
                  },
                },
                {
                  key: 'valorTotal', header: 'Valor Total', width: 'compact', className: 'text-right font-bold', render: (produto) => {
                    const selecionado = selecionados.get(produto.id)
                    return <span className={selecionado ? 'text-emerald-700' : ''}>{selecionado ? formatarMoeda(produto.precoUnitario * selecionado.quantidade) : '—'}</span>
                  },
                },
              ]}
              rows={itensExibidos}
              rowKey={(produto) => produto.id}
              firstColumnSticky
              rowClassName={(produto) => selecionados.has(produto.id) ? 'border-l-4 border-l-emerald-400 bg-emerald-50' : undefined}
              rowActions={(produto) => selecionados.has(produto.id) ? <BotaoRemoverProduto nome={produto.descricao} disabled={bloqueado} onClick={() => removerProduto(produto)} /> : null}
              renderMobileCard={(produto) => {
                const selecionado = selecionados.get(produto.id)
                const rascunho = rascunhosItens.get(produto.id)
                const quantidade = rascunho?.quantidade ?? selecionado?.quantidade.toString() ?? ''
                const quantidadeInvalida = quantidade.trim() !== '' && !quantidadeValida(quantidade.trim())
                const nomeOuLetra = rascunho?.nomeOuLetra ?? selecionado?.nomeOuLetra ?? ''
                return (
                  <div className="space-y-2 text-sm">
                    <p className="font-medium">{produto.descricao}</p>
                    <p><span className="text-slate-500">Coleção: </span>{produto.colecao}</p>
                    <p><span className="text-slate-500">Referência: </span>{produto.referencia}</p>
                    <p><span className="text-slate-500">Preço unitário: </span>{formatarMoeda(produto.precoUnitario)}</p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="grid gap-1 text-sm font-medium">Quantidade<Input inputMode="numeric" min={1} type="number" disabled={bloqueado} value={quantidade} aria-invalid={quantidadeInvalida} onChange={(event) => atualizarQuantidade(produto, event.target.value)} />{quantidadeInvalida && <span className="text-xs font-normal text-destructive">Use um inteiro maior que zero.</span>}</label>
                      <label className="grid gap-1 text-sm font-medium">Nome ou Letra<Input maxLength={200} disabled={bloqueado} value={nomeOuLetra} onChange={(event) => atualizarNomeOuLetra(produto, event.target.value)} /></label>
                    </div>
                    <p className={`text-right font-bold ${selecionado ? 'text-emerald-700' : ''}`}>Valor total: {selecionado ? formatarMoeda(produto.precoUnitario * selecionado.quantidade) : '—'}</p>
                  </div>
                )
              }}
            />
          </div>
        )}

        {!mostrarSelecionados && paginacao.totalPaginas > 1 && <nav className="mt-4 flex flex-wrap items-center justify-center gap-2" aria-label="Paginação dos resultados">
          <Button type="button" variant="secondary" size="sm" disabled={buscando || paginacao.pagina === 1} onClick={() => void pesquisar(undefined, paginacao.pagina - 1)}><ChevronLeft />Anterior</Button>
          {paginasVisiveisLebebeExclusive(paginacao.pagina, paginacao.totalPaginas).map((pagina, indice) => typeof pagina === 'string'
            ? <span key={`reticencias-${indice}`} className="px-1 text-sm text-slate-500">…</span>
            : <Button key={pagina} type="button" size="sm" variant={pagina === paginacao.pagina ? 'primary' : 'secondary'} disabled={buscando} aria-current={pagina === paginacao.pagina ? 'page' : undefined} onClick={() => void pesquisar(undefined, pagina)}>{pagina}</Button>)}
          <Button type="button" variant="secondary" size="sm" disabled={buscando || paginacao.pagina === paginacao.totalPaginas} onClick={() => void pesquisar(undefined, paginacao.pagina + 1)}>Próxima<ChevronRight /></Button>
          <p className="basis-full text-center text-sm text-slate-500">Página {paginacao.pagina} de {paginacao.totalPaginas} · {paginacao.totalRegistros} resultados</p>
        </nav>}

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
          <BotaoMostrarSelecionados ativo={mostrarSelecionados} quantidade={selecionados.size} disabled={selecionados.size === 0} onClick={() => setMostrarSelecionados((atual) => !atual)} />
          <p className="text-sm text-slate-500">{selecionados.size} produto(s) selecionado(s) · {formatarMoeda(total)}</p>
        </div>
      </Section>

      {pedidoInicial
        ? resumo && <Section tone="section-3" title="Resumo para o fornecedor" description="">
            <div className="flex items-center justify-end gap-3"><Button type="button" variant="secondary" onClick={() => void copiarResumo()}>{copiado ? 'Copiado' : 'Copiar'}</Button></div>
            <pre className="mt-2 whitespace-pre-wrap rounded-xl bg-slate-50 p-4 text-sm">{resumo}</pre>
          </Section>
        : <PreviaMensagem mensagem={resumo || null} copiada={copiado} onCopiar={() => void copiarResumo()} orientacaoObservacoes />}
      {erro && <Alert tone="danger">{erro}</Alert>}
      {pedidoSalvo && (
        <Alert tone="success" title={pedidoInicial ? 'Rascunho atualizado' : 'Orçamento salvo'}>
          <p>Status {pedidoSalvo.status}; versão {pedidoSalvo.version}; {selecionados.size} produto(s). A venda ainda não foi fechada.</p>
          {!pedidoInicial && <Button asChild type="button" variant="secondary" className="mt-4 min-h-10"><Link href="/pedidos-personalizados">Ir para a gestão de pedidos<ArrowRight /></Link></Button>}
        </Alert>
      )}
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
        <div className="sticky bottom-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-white/95 p-3 shadow-lg backdrop-blur"><p className="text-sm font-bold text-slate-900 sm:text-base">Itens selecionados: <span className="text-emerald-700">{selecionados.size}</span> | Total: {formatarMoeda(total)}</p><Button type="submit" className="min-h-12" disabled={bloqueado} loading={salvando}><Save />{pedidoSalvo ? 'Salvo' : pedidoInicial ? 'Salvar rascunho' : 'Salvar orçamento'}</Button></div>
      )}
    </form>
  )
}
