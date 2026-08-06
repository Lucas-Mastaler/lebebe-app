'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { AlertCircle, ChevronLeft, ChevronRight, ClipboardList, Eye, Loader2, PackageCheck, Pencil, RefreshCw, Search, ShoppingBag, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CardTapete } from './CardTapete'
import { AnexosTapete } from './AnexosTapete'
import {
  adicionarTapete,
  avaliarFormulario,
  carregarOpcoesNovoPedido,
  enviarAnexoGestao,
  moverItem,
  removerAnexoGestaoApi,
  removerTapete,
  solicitarUrlAnexo,
  substituirAnexoGestao,
  validarArquivoAnexo,
} from './novo-pedido-modelo'
import type { AnexoFormulario, EstadoNovoPedido, OpcoesNovoPedido, TapeteFormulario } from './novo-pedido-modelo'
import {
  FILTROS_VAZIOS,
  atualizarAdministrativoGestao,
  atualizarComercialGestao,
  carregarDetalheGestao,
  detalheParaAdministrativo,
  detalheParaFormulario,
  listarPedidosGestao,
  mensagemErroGestao,
  payloadAtualizacaoAdministrativa,
  payloadAtualizacaoComercial,
  validarAdministrativo,
} from './gestao-modelo'
import type { ErrosAdministrativos, EstadoAdministrativo, FiltrosGestao, PaginaPedidos, PedidoDetalhe, TapeteDetalhe } from './gestao-modelo'

const STATUS_BLOQUEADOS = new Set(['EM PRODUÇÃO', 'RECEBIDO'])

function formatarData(valor: string) {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(valor))
}

function dataIsoParaExibicao(valor: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valor)
  return match ? `${match[3]}/${match[2]}/${match[1]}` : valor
}

function formatarArea(valor: number) {
  return `${(valor / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m²`
}

function erroStatus(error: unknown) {
  return typeof error === 'object' && error !== null && 'status' in error ? Number((error as { status: unknown }).status) : null
}

function classeStatus(status: string) {
  if (status === 'RECEBIDO') return 'border-emerald-200 bg-emerald-50 text-emerald-700'
  if (status === 'EM PRODUÇÃO') return 'border-violet-200 bg-violet-50 text-violet-700'
  if (status.includes('AGUARDANDO')) return 'border-amber-200 bg-amber-50 text-amber-800'
  return 'border-sky-200 bg-sky-50 text-sky-700'
}

function CampoAdministrativo({
  id,
  label,
  erro,
  className,
  children,
}: {
  id: string
  label: string
  erro?: string
  className?: string
  children: ReactNode
}) {
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1 block text-sm font-medium">{label}</label>
      {children}
      {erro && <p id={`${id}-erro`} className="mt-1 text-sm text-red-600">{erro}</p>}
    </div>
  )
}

export function GestaoPedidosPersonalizados() {
  const [opcoes, setOpcoes] = useState<OpcoesNovoPedido | null>(null)
  const [filtros, setFiltros] = useState<FiltrosGestao>(FILTROS_VAZIOS)
  const [filtrosAplicados, setFiltrosAplicados] = useState<FiltrosGestao>(FILTROS_VAZIOS)
  const [pagina, setPagina] = useState(1)
  const [resultado, setResultado] = useState<PaginaPedidos | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [detalhe, setDetalhe] = useState<PedidoDetalhe | null>(null)
  const [carregandoDetalhe, setCarregandoDetalhe] = useState(false)
  const [editando, setEditando] = useState(false)
  const [editandoAdministrativo, setEditandoAdministrativo] = useState(false)
  const [administrativo, setAdministrativo] = useState<EstadoAdministrativo | null>(null)
  const [errosAdministrativos, setErrosAdministrativos] = useState<ErrosAdministrativos>({})
  const [conflitoAdministrativo, setConflitoAdministrativo] = useState(false)
  const [formulario, setFormulario] = useState<EstadoNovoPedido | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [operacaoAnexo, setOperacaoAnexo] = useState<{ chaveLocal: string; slot: 1 | 2; tipo: 'upload' | 'substituicao' | 'remocao' | 'abertura' } | null>(null)
  const mutacaoRef = useRef(false)

  const carregarLista = useCallback(async (signal?: AbortSignal) => {
    setCarregando(true)
    setErro(null)
    try {
      setResultado(await listarPedidosGestao(filtrosAplicados, pagina, signal))
    } catch (error) {
      if (signal?.aborted) return
      setErro(mensagemErroGestao(error))
    } finally {
      if (!signal?.aborted) setCarregando(false)
    }
  }, [filtrosAplicados, pagina])

  useEffect(() => {
    void carregarOpcoesNovoPedido().then(setOpcoes).catch((error) => setErro(mensagemErroGestao(error)))
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPagina(1)
      setFiltrosAplicados(filtros)
    }, 400)
    return () => window.clearTimeout(timer)
  }, [filtros])

  useEffect(() => {
    const controller = new AbortController()
    void carregarLista(controller.signal)
    return () => controller.abort()
  }, [carregarLista])

  const avaliacaoEdicao = useMemo(() => formulario && opcoes ? avaliarFormulario(formulario, opcoes) : null, [formulario, opcoes])

  async function abrirDetalhe(id: string) {
    setCarregandoDetalhe(true)
    setErro(null)
    try {
      const pedido = await carregarDetalheGestao(id)
      setDetalhe(pedido)
      setFormulario(detalheParaFormulario(pedido))
      setAdministrativo(detalheParaAdministrativo(pedido))
      setEditando(false)
      setEditandoAdministrativo(false)
      setConflitoAdministrativo(false)
    } catch (error) {
      toast.error(mensagemErroGestao(error))
    } finally {
      setCarregandoDetalhe(false)
    }
  }

  async function recarregarDetalhe() {
    if (!detalhe) return
    const pedido = await carregarDetalheGestao(detalhe.id)
    setDetalhe(pedido)
    setFormulario(detalheParaFormulario(pedido))
    setAdministrativo(detalheParaAdministrativo(pedido))
    setErrosAdministrativos({})
    setConflitoAdministrativo(false)
    return pedido
  }

  async function salvarComercial() {
    if (!detalhe || !formulario || !opcoes || salvando) return
    if (!avaliacaoEdicao?.validacao.valido) {
      toast.error('Revise os dados comerciais indicados.')
      return
    }
    setSalvando(true)
    try {
      await atualizarComercialGestao(detalhe.id, payloadAtualizacaoComercial(formulario, detalhe.version, opcoes))
      await recarregarDetalhe()
      setEditando(false)
      await carregarLista()
      toast.success('Dados comerciais atualizados.')
    } catch (error) {
      toast.error(mensagemErroGestao(error))
      if (erroStatus(error) === 409) await recarregarDetalhe().catch(() => undefined)
    } finally {
      setSalvando(false)
    }
  }

  async function salvarAdministrativo() {
    if (!detalhe || !administrativo || salvando) return
    const erros = validarAdministrativo(administrativo)
    setErrosAdministrativos(erros)
    if (Object.keys(erros).length > 0) {
      toast.error('Revise os dados administrativos indicados.')
      return
    }
    setSalvando(true)
    setConflitoAdministrativo(false)
    try {
      await atualizarAdministrativoGestao(
        detalhe.id,
        payloadAtualizacaoAdministrativa(detalhe, administrativo)
      )
      await recarregarDetalhe()
      setEditandoAdministrativo(false)
      await carregarLista()
      toast.success('Dados administrativos atualizados.')
    } catch (error) {
      if (erroStatus(error) === 409) setConflitoAdministrativo(true)
      toast.error(mensagemErroGestao(error))
    } finally {
      setSalvando(false)
    }
  }

  function atualizarCampoAdministrativo(
    campo: keyof EstadoAdministrativo,
    valor: string
  ) {
    setAdministrativo((atual) => atual ? { ...atual, [campo]: valor } : atual)
    setErrosAdministrativos((atual) => ({ ...atual, [campo]: undefined }))
  }

  function atualizarTapete(indice: number, tapete: TapeteFormulario) {
    setFormulario((atual) => atual ? { ...atual, tapetes: atual.tapetes.map((item, i) => i === indice ? tapete : item) } : atual)
  }

  function atualizarAnexoNoDetalhe(tapeteId: string, anexo: AnexoFormulario | null, slot: 1 | 2, version: number, layout?: { teve?: boolean; quantidade?: number | null }) {
    setDetalhe((atual) => atual ? {
      ...atual,
      version,
      tapetes: atual.tapetes.map((tapete) => tapete.id === tapeteId ? {
        ...tapete,
        teveAlteracaoLayout: layout?.teve ?? tapete.teveAlteracaoLayout,
        quantidadeAlteracoesLayout: layout?.quantidade === undefined ? tapete.quantidadeAlteracoesLayout : layout.quantidade,
        anexos: anexo
          ? [...tapete.anexos.filter((item) => item.slot !== slot), anexo].sort((a, b) => a.slot - b.slot)
          : tapete.anexos.filter((item) => item.slot !== slot),
      } : tapete),
    } : atual)
  }

  async function executarAnexo(tapete: TapeteDetalhe, slot: 1 | 2, tipo: 'upload' | 'substituicao' | 'remocao' | 'abertura', acao: () => Promise<void>) {
    if (mutacaoRef.current) return
    mutacaoRef.current = true
    setOperacaoAnexo({ chaveLocal: tapete.id, slot, tipo })
    try { await acao() } catch (error) {
      toast.error(mensagemErroGestao(error))
      if (erroStatus(error) === 409) await recarregarDetalhe().catch(() => undefined)
    } finally {
      mutacaoRef.current = false
      setOperacaoAnexo(null)
    }
  }

  async function uploadGestao(tapete: TapeteDetalhe, slot: 1 | 2, arquivo: File) {
    if (!detalhe) return
    const erroArquivo = validarArquivoAnexo(arquivo)
    if (erroArquivo) {
      toast.error(erroArquivo)
      return
    }
    await executarAnexo(tapete, slot, 'upload', async () => {
      const resposta = await enviarAnexoGestao({ pedidoId: detalhe.id, tapeteId: tapete.id, slot, arquivo, expectedVersion: detalhe.version })
      atualizarAnexoNoDetalhe(tapete.id, { anexoId: resposta.anexoId, slot, nomeOriginal: resposta.nomeOriginal, mime: resposta.mime, tamanho: resposta.tamanho, createdAt: resposta.createdAt ?? null }, slot, resposta.version, { teve: resposta.teveAlteracaoLayout, quantidade: resposta.quantidadeAlteracoesLayout })
      toast.success('Anexo incluído e alteração de layout contabilizada.')
    })
  }

  async function substituirGestao(tapete: TapeteDetalhe, anexo: AnexoFormulario, arquivo: File) {
    if (!detalhe) return
    const erroArquivo = validarArquivoAnexo(arquivo)
    if (erroArquivo) {
      toast.error(erroArquivo)
      return
    }
    await executarAnexo(tapete, anexo.slot, 'substituicao', async () => {
      const resposta = await substituirAnexoGestao({ anexoId: anexo.anexoId, arquivo, expectedVersion: detalhe.version })
      atualizarAnexoNoDetalhe(tapete.id, { anexoId: resposta.anexoId, slot: resposta.slot, nomeOriginal: resposta.nomeOriginal, mime: resposta.mime, tamanho: resposta.tamanho, createdAt: resposta.createdAt ?? anexo.createdAt }, anexo.slot, resposta.version, { teve: resposta.teveAlteracaoLayout, quantidade: resposta.quantidadeAlteracoesLayout })
      toast.success('Anexo substituído e alteração de layout contabilizada.')
    })
  }

  async function removerGestao(tapete: TapeteDetalhe, anexo: AnexoFormulario) {
    if (!detalhe) return
    await executarAnexo(tapete, anexo.slot, 'remocao', async () => {
      const resposta = await removerAnexoGestaoApi({ anexoId: anexo.anexoId, expectedVersion: detalhe.version })
      atualizarAnexoNoDetalhe(tapete.id, null, anexo.slot, resposta.version, { teve: resposta.teveAlteracaoLayout, quantidade: resposta.quantidadeAlteracoesLayout })
      toast.success('Anexo removido e alteração de layout contabilizada.')
    })
  }

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-sky-100 bg-gradient-to-br from-sky-50 via-white to-indigo-50 p-4 shadow-sm sm:p-5" aria-labelledby="filtros-pedidos">
        <div className="mb-4 flex items-center justify-between gap-3"><div><h2 id="filtros-pedidos" className="font-bold text-slate-900">Filtros</h2><p className="text-sm text-slate-500">A busca textual é atualizada após uma breve pausa.</p></div><Button type="button" variant="ghost" onClick={() => setFiltros(FILTROS_VAZIOS)}><X />Limpar</Button></div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Input aria-label="Filtrar por cliente" placeholder="Cliente" value={filtros.cliente} onChange={(e) => setFiltros({ ...filtros, cliente: e.target.value })} />
          <Input aria-label="Filtrar por consultora" placeholder="Consultora" value={filtros.consultora} onChange={(e) => setFiltros({ ...filtros, consultora: e.target.value })} />
          <Input aria-label="Filtrar por lançamento" placeholder="Nº lançamento" inputMode="numeric" value={filtros.numeroLancamento} onChange={(e) => setFiltros({ ...filtros, numeroLancamento: e.target.value.replace(/\D/g, '').slice(0, 6) })} />
          <Select value={filtros.unidade || 'TODAS'} onValueChange={(v) => setFiltros({ ...filtros, unidade: v === 'TODAS' ? '' : v as FiltrosGestao['unidade'] })}><SelectTrigger aria-label="Filtrar por unidade"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="TODAS">Todas as unidades</SelectItem>{opcoes?.unidades.map((u) => <SelectItem key={u.chave} value={u.chave}>{u.nome}</SelectItem>)}</SelectContent></Select>
          <Select value={filtros.status || 'TODOS'} onValueChange={(v) => setFiltros({ ...filtros, status: v === 'TODOS' ? '' : v as FiltrosGestao['status'] })}><SelectTrigger aria-label="Filtrar por status"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="TODOS">Todos os status</SelectItem>{opcoes?.status?.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select>
          <div><label htmlFor="data-inicial" className="mb-1 block text-xs font-medium text-slate-600">Cadastro inicial</label><Input id="data-inicial" type="date" value={filtros.dataInicial} onChange={(e) => setFiltros({ ...filtros, dataInicial: e.target.value })} /></div>
          <div><label htmlFor="data-final" className="mb-1 block text-xs font-medium text-slate-600">Cadastro final</label><Input id="data-final" type="date" value={filtros.dataFinal} onChange={(e) => setFiltros({ ...filtros, dataFinal: e.target.value })} /></div>
          <div><label htmlFor="pedido-fornecedor-inicial" className="mb-1 block text-xs font-medium text-slate-600">Data do pedido ao fornecedor — início</label><Input id="pedido-fornecedor-inicial" type="date" value={filtros.dataPedidoFornecedorInicial} onChange={(e) => setFiltros({ ...filtros, dataPedidoFornecedorInicial: e.target.value })} /></div>
          <div><label htmlFor="pedido-fornecedor-final" className="mb-1 block text-xs font-medium text-slate-600">Data do pedido ao fornecedor — fim</label><Input id="pedido-fornecedor-final" type="date" value={filtros.dataPedidoFornecedorFinal} onChange={(e) => setFiltros({ ...filtros, dataPedidoFornecedorFinal: e.target.value })} /></div>
          <div><label htmlFor="entrega-inicial" className="mb-1 block text-xs font-medium text-slate-600">Data de entrega — início</label><Input id="entrega-inicial" type="date" value={filtros.dataEntregaInicial} onChange={(e) => setFiltros({ ...filtros, dataEntregaInicial: e.target.value })} /></div>
          <div><label htmlFor="entrega-final" className="mb-1 block text-xs font-medium text-slate-600">Data de entrega — fim</label><Input id="entrega-final" type="date" value={filtros.dataEntregaFinal} onChange={(e) => setFiltros({ ...filtros, dataEntregaFinal: e.target.value })} /></div>
          <Button type="button" variant="outline" onClick={() => void carregarLista()}><Search />Atualizar</Button>
        </div>
      </section>

      {erro && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700"><AlertCircle className="mr-2 inline size-5" />{erro}</div>}
      {carregando ? <div role="status" className="rounded-2xl border bg-white p-10 text-center"><Loader2 className="mx-auto mb-2 animate-spin" />Carregando pedidos...</div> : resultado?.itens.length ? (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" aria-label="Pedidos encontrados">
          {resultado.itens.map((item) => (
            <article key={item.id} className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md">
              <div className="border-b border-slate-100 bg-gradient-to-r from-sky-50 to-indigo-50 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wide text-sky-700">{item.fornecedor?.nome ?? 'MORIAH TAPETES'}</p>
                    <h2 className="mt-1 truncate text-lg font-bold text-slate-900">{item.cliente}</h2>
                    <p className="text-sm text-slate-600">{item.unidade.nome} · {item.consultora}</p>
                  </div>
                  <span className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold ${classeStatus(item.status)}`}>{item.status}</span>
                </div>
              </div>
              <div className="flex flex-1 flex-col p-5">
                <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                  <div><dt className="text-slate-500">Nº de lançamento</dt><dd className="font-semibold text-slate-900">{item.numeroLancamento ?? '—'}</dd></div>
                  <div><dt className="text-slate-500">Pedido de compra</dt><dd className="font-semibold text-slate-900">{item.numeroPedidoCompra ?? '—'}</dd></div>
                  <div><dt className="text-slate-500">Pedido ao fornecedor</dt><dd className="font-medium">{item.dataPedidoFornecedor ? dataIsoParaExibicao(item.dataPedidoFornecedor) : '—'}</dd></div>
                  <div><dt className="text-slate-500">Data de entrega</dt><dd className="font-medium">{item.dataEntrega ? dataIsoParaExibicao(item.dataEntrega) : '—'}</dd></div>
                  <div><dt className="text-slate-500">Comprador</dt><dd className="font-medium">{item.comprador ?? '—'}</dd></div>
                  <div><dt className="text-slate-500">Tapetes</dt><dd className="font-medium">{item.quantidadeTapetes}</dd></div>
                  <div><dt className="text-slate-500">Produtos</dt><dd className="font-medium">{item.codigosProdutos.join(', ') || '—'}</dd></div>
                  <div><dt className="text-slate-500">Cadastro</dt><dd className="font-medium">{formatarData(item.createdAt)}</dd></div>
                </dl>
                <Button type="button" className="mt-5 min-h-11" variant="outline" onClick={() => void abrirDetalhe(item.id)}><Eye />Ver pedido</Button>
              </div>
            </article>
          ))}
        </section>
      ) : <div className="rounded-2xl border border-dashed bg-white p-10 text-center text-slate-600">Nenhum pedido encontrado com os filtros atuais.</div>}

      {resultado && <nav className="flex items-center justify-center gap-3" aria-label="Paginação"><Button type="button" variant="outline" disabled={pagina <= 1 || carregando} onClick={() => setPagina((p) => p - 1)}><ChevronLeft />Anterior</Button><span className="text-sm text-slate-600">Página {resultado.pagina} de {resultado.totalPaginas} · {resultado.totalRegistros} registro(s)</span><Button type="button" variant="outline" disabled={pagina >= resultado.totalPaginas || carregando} onClick={() => setPagina((p) => p + 1)}>Próxima<ChevronRight /></Button></nav>}

      <Dialog
        open={(carregandoDetalhe || detalhe !== null) && !editandoAdministrativo}
        onOpenChange={(aberto) => {
          if (!aberto && !salvando && !operacaoAnexo) {
            setDetalhe(null)
            setFormulario(null)
            setAdministrativo(null)
            setEditando(false)
          }
        }}
      >
        <DialogContent className="flex max-h-[calc(100dvh-1rem)] !w-[calc(100vw-1rem)] !max-w-[1400px] flex-col gap-0 overflow-hidden p-0 sm:max-h-[90vh] sm:!w-[90vw] lg:!w-[80vw]">
          <DialogHeader className="shrink-0 border-b bg-gradient-to-r from-sky-50 to-indigo-50 px-5 py-4 sm:px-6">
            <DialogTitle>{editando ? 'Editar dados comerciais' : 'Pedido personalizado'}</DialogTitle>
            <DialogDescription>
              {editando ? 'Revise os dados comerciais e os tapetes antes de salvar.' : 'Detalhes comerciais, administrativos, tapetes, cores e anexos.'}
            </DialogDescription>
          </DialogHeader>
          {carregandoDetalhe || !detalhe || !formulario || !opcoes ? (
            <div role="status" className="min-h-0 flex-1 overflow-y-auto p-10 text-center">
              <Loader2 className="mx-auto mb-2 animate-spin" />Carregando detalhe...
            </div>
          ) : (
            <div className="min-h-0 flex-1 space-y-5 overflow-x-hidden overflow-y-auto px-4 py-5 sm:px-6">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-sky-100 bg-gradient-to-r from-sky-50 to-indigo-50 p-4">
                <div><p className="font-bold text-slate-900">{detalhe.cliente}</p><p className="text-sm text-slate-600">{detalhe.fornecedor?.nome} · {detalhe.unidade.nome} · versão {detalhe.version}</p></div>
                <span className={`rounded-full border px-3 py-1 text-sm font-semibold ${classeStatus(detalhe.status)}`}>{detalhe.status}</span>
              </div>

              {!editando && (
                <div className="grid gap-4 xl:grid-cols-3">
                  <section className="rounded-xl border border-sky-100 bg-sky-50/40 p-4" aria-labelledby="dados-comerciais-titulo">
                    <h3 id="dados-comerciais-titulo" className="mb-3 flex items-center gap-2 font-semibold text-slate-900"><ShoppingBag className="size-4 text-sky-700" />Dados comerciais</h3>
                    <dl className="grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                      <div><dt className="text-slate-500">Unidade</dt><dd className="font-medium">{detalhe.unidade.nome}</dd></div>
                      <div><dt className="text-slate-500">Consultora</dt><dd className="font-medium">{detalhe.consultora}</dd></div>
                      <div><dt className="text-slate-500">Cliente</dt><dd className="font-medium">{detalhe.cliente}</dd></div>
                      <div><dt className="text-slate-500">Lançamento</dt><dd className="font-medium">{detalhe.numeroLancamento ?? '—'}</dd></div>
                      <div className="sm:col-span-2 xl:col-span-1 2xl:col-span-2"><dt className="text-slate-500">Fornecedor</dt><dd className="font-medium">{detalhe.fornecedor?.nome ?? '—'}</dd></div>
                    </dl>
                  </section>

                  <section className="rounded-xl border border-amber-100 bg-amber-50/40 p-4" aria-labelledby="dados-administrativos-titulo">
                    <h3 id="dados-administrativos-titulo" className="mb-3 flex items-center gap-2 font-semibold text-slate-900"><ClipboardList className="size-4 text-amber-700" />Dados administrativos</h3>
                    <dl className="grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                      <div><dt className="text-slate-500">Status</dt><dd className="font-medium">{detalhe.status}</dd></div>
                      <div><dt className="text-slate-500">Pedido de compra</dt><dd className="font-medium">{detalhe.numeroPedidoCompra ?? '—'}</dd></div>
                      <div><dt className="text-slate-500">Data do pedido ao fornecedor</dt><dd className="font-medium">{detalhe.dataPedidoFornecedor ? dataIsoParaExibicao(detalhe.dataPedidoFornecedor) : '—'}</dd></div>
                      <div><dt className="text-slate-500">Data de entrega</dt><dd className="font-medium">{detalhe.dataEntrega ? dataIsoParaExibicao(detalhe.dataEntrega) : '—'}</dd></div>
                      <div><dt className="text-slate-500">Comprador</dt><dd className="font-medium">{detalhe.comprador ?? '—'}</dd></div>
                      <div><dt className="text-slate-500">Número do pedido</dt><dd className="text-slate-500">Não disponível no schema</dd></div>
                      <div><dt className="text-slate-500">Data do pedido</dt><dd className="text-slate-500">Não disponível no schema</dd></div>
                    </dl>
                  </section>

                  <section className="rounded-xl border border-violet-100 bg-violet-50/40 p-4" aria-labelledby="dados-tecnicos-titulo">
                    <h3 id="dados-tecnicos-titulo" className="mb-3 flex items-center gap-2 font-semibold text-slate-900"><PackageCheck className="size-4 text-violet-700" />Dados técnicos</h3>
                    <dl className="grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                      <div><dt className="text-slate-500">Criação</dt><dd className="font-medium">{formatarData(detalhe.createdAt)}</dd></div>
                      <div><dt className="text-slate-500">Última atualização</dt><dd className="font-medium">{formatarData(detalhe.updatedAt)}</dd></div>
                      <div><dt className="text-slate-500">Versão</dt><dd className="font-medium">{detalhe.version}</dd></div>
                      <div><dt className="text-slate-500">Identificador interno</dt><dd className="break-all font-mono text-xs">{detalhe.id}</dd></div>
                    </dl>
                  </section>
                </div>
              )}

              {editando ? (
                <div className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <div><label htmlFor="gestao-unidade" className="mb-1 block text-sm font-medium">Unidade</label><Select value={formulario.unidade} onValueChange={(v) => setFormulario({ ...formulario, unidade: v as EstadoNovoPedido['unidade'] })}><SelectTrigger id="gestao-unidade"><SelectValue /></SelectTrigger><SelectContent>{opcoes.unidades.map((u) => <SelectItem key={u.chave} value={u.chave}>{u.nome}</SelectItem>)}</SelectContent></Select></div>
                    <div><label htmlFor="gestao-consultora" className="mb-1 block text-sm font-medium">Consultora</label><Input id="gestao-consultora" maxLength={20} value={formulario.consultora} onChange={(e) => setFormulario({ ...formulario, consultora: e.target.value })} /></div>
                    <div><label htmlFor="gestao-cliente" className="mb-1 block text-sm font-medium">Cliente</label><Input id="gestao-cliente" maxLength={40} value={formulario.cliente} onChange={(e) => setFormulario({ ...formulario, cliente: e.target.value })} /></div>
                  </div>
                  {formulario.tapetes.map((tapete, indice) => <CardTapete key={tapete.chaveLocal} tapete={tapete} indice={indice} total={formulario.tapetes.length} produtos={opcoes.produtos} cores={opcoes.cores} erros={avaliacaoEdicao?.validacao.erros ?? []} camposTocados={new Set()} tentouSalvar disabled={salvando} onChange={(v) => atualizarTapete(indice, v)} onMover={(d) => setFormulario({ ...formulario, tapetes: moverItem(formulario.tapetes, indice, d) })} onRemover={() => setFormulario(removerTapete(formulario, tapete.chaveLocal))} onLimiteCores={() => toast.error('Máximo de 6 cores por tapete.')} onTocar={() => undefined} />)}
                  <Button type="button" variant="outline" disabled={formulario.tapetes.length >= 10} onClick={() => setFormulario(adicionarTapete(formulario, crypto.randomUUID()))}>Adicionar tapete</Button>
                  {(avaliacaoEdicao?.validacao.erros.length ?? 0) > 0 && <div role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">Revise os campos marcados antes de salvar.</div>}
                </div>
              ) : (
                <section className="space-y-4" aria-labelledby="tapetes-titulo">
                  <h3 id="tapetes-titulo" className="flex items-center gap-2 font-semibold text-slate-900"><PackageCheck className="size-5 text-violet-700" />Tapetes, cores, anexos e alterações de layout</h3>
                  {detalhe.tapetes.map((tapete) => <section key={tapete.id} className="overflow-hidden rounded-xl border p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><h4 className="font-bold">Tapete {tapete.ordem} · {tapete.formato}</h4><p className="break-words text-sm text-slate-600">{tapete.produto.codigo} — {tapete.produto.descricao}</p></div><div className="text-right text-sm"><p className="font-semibold">{formatarArea(tapete.areaCobradaCentesimosM2)}</p><p className="text-slate-500">{tapete.dimensao1Cm} cm{tapete.dimensao2Cm ? ` × ${tapete.dimensao2Cm} cm` : ''}</p></div></div><dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2"><div><dt className="text-slate-500">Cores</dt><dd className="break-words">{tapete.cores.map((c) => `${c.numero} — ${c.codigo} — ${c.nome}`).join(', ') || 'Nenhuma'}</dd></div><div><dt className="text-slate-500">Coleção / referência</dt><dd className="break-words">{tapete.nomeColecaoCatalogo || '—'} / {tapete.referenciaCatalogo || '—'}</dd></div><div className="sm:col-span-2"><dt className="text-slate-500">Observações</dt><dd className="whitespace-pre-wrap break-words">{tapete.observacoes || '—'}</dd></div><div><dt className="text-slate-500">Alteração de layout</dt><dd>{tapete.teveAlteracaoLayout ? `Sim (${tapete.quantidadeAlteracoesLayout ?? 0})` : 'Não'}</dd></div></dl><AnexosTapete tapete={{ ...detalheParaFormulario(detalhe).tapetes.find((item) => item.tapeteId === tapete.id)!, anexos: tapete.anexos }} ordem={tapete.ordem} bloqueado={operacaoAnexo !== null} operacao={operacaoAnexo} errosPorSlot={{}} onUpload={(slot, arquivo) => uploadGestao(tapete, slot, arquivo)} onAbrir={(anexo) => executarAnexo(tapete, anexo.slot, 'abertura', async () => { const { url } = await solicitarUrlAnexo(anexo.anexoId); window.open(url, '_blank', 'noopener,noreferrer') })} onSubstituir={(anexo, arquivo) => substituirGestao(tapete, anexo, arquivo)} onRemover={(anexo) => removerGestao(tapete, anexo)} /></section>)}
                </section>
              )}
            </div>
          )}
          {detalhe && formulario && opcoes && (
            <DialogFooter className="shrink-0 border-t bg-white px-4 py-3 sm:px-6">
              <Button type="button" variant="outline" disabled={salvando || operacaoAnexo !== null} onClick={() => { setDetalhe(null); setFormulario(null); setAdministrativo(null) }}>Fechar</Button>
              {editando ? (
                <>
                  <Button type="button" variant="ghost" disabled={salvando} onClick={() => { setFormulario(detalheParaFormulario(detalhe)); setEditando(false) }}>Cancelar edição</Button>
                  <Button type="button" disabled={salvando} onClick={() => void salvarComercial()}>{salvando ? <Loader2 className="animate-spin" /> : <Pencil />}Salvar dados comerciais</Button>
                </>
              ) : (
                <>
                  <Button type="button" disabled={STATUS_BLOQUEADOS.has(detalhe.status)} onClick={() => setEditando(true)}><Pencil />Editar dados comerciais</Button>
                  <Button type="button" variant="secondary" onClick={() => { setAdministrativo(detalheParaAdministrativo(detalhe)); setErrosAdministrativos({}); setConflitoAdministrativo(false); setEditandoAdministrativo(true) }}><Pencil />Editar dados administrativos</Button>
                </>
              )}
              <Button type="button" variant="ghost" disabled={salvando} onClick={() => void recarregarDetalhe()}><RefreshCw />Recarregar</Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={editandoAdministrativo} onOpenChange={(aberto) => { if (!aberto && !salvando) setEditandoAdministrativo(false) }}>
        <DialogContent className="flex max-h-[calc(100dvh-1rem)] !w-[calc(100vw-1rem)] max-w-3xl flex-col gap-0 overflow-hidden p-0 sm:max-h-[90vh] sm:!w-[90vw]">
          <DialogHeader className="shrink-0 border-b bg-gradient-to-r from-amber-50 to-orange-50 px-5 py-4 sm:px-6">
            <DialogTitle>Editar dados administrativos</DialogTitle>
            <DialogDescription>Campos administrativos disponíveis no contrato atual. Versão {detalhe?.version ?? '—'}.</DialogDescription>
          </DialogHeader>
          {detalhe && administrativo && (
            <div className="min-h-0 flex-1 space-y-5 overflow-x-hidden overflow-y-auto px-4 py-5 sm:px-6">
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                Número do pedido e Data do pedido ainda não existem no schema. Pedido de compra e data do pedido ao fornecedor permanecem identificados separadamente.
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <CampoAdministrativo id="admin-lancamento" label="Número de lançamento" erro={errosAdministrativos.numeroLancamento}>
                  <Input id="admin-lancamento" inputMode="numeric" maxLength={6} value={administrativo.numeroLancamento} aria-invalid={Boolean(errosAdministrativos.numeroLancamento)} aria-describedby={errosAdministrativos.numeroLancamento ? 'admin-lancamento-erro' : undefined} onChange={(e) => atualizarCampoAdministrativo('numeroLancamento', e.target.value.replace(/\D/g, '').slice(0, 6))} />
                </CampoAdministrativo>
                <CampoAdministrativo id="admin-pedido-compra" label="Número do pedido de compra" erro={errosAdministrativos.numeroPedidoCompra}>
                  <Input id="admin-pedido-compra" inputMode="numeric" maxLength={5} value={administrativo.numeroPedidoCompra} aria-invalid={Boolean(errosAdministrativos.numeroPedidoCompra)} aria-describedby={errosAdministrativos.numeroPedidoCompra ? 'admin-pedido-compra-erro' : undefined} onChange={(e) => atualizarCampoAdministrativo('numeroPedidoCompra', e.target.value.replace(/\D/g, '').slice(0, 5))} />
                </CampoAdministrativo>
                <CampoAdministrativo id="admin-data-fornecedor" label="Data do pedido ao fornecedor" erro={errosAdministrativos.dataPedidoFornecedor}>
                  <Input id="admin-data-fornecedor" type="date" value={administrativo.dataPedidoFornecedor} aria-invalid={Boolean(errosAdministrativos.dataPedidoFornecedor)} aria-describedby={errosAdministrativos.dataPedidoFornecedor ? 'admin-data-fornecedor-erro' : undefined} onChange={(e) => atualizarCampoAdministrativo('dataPedidoFornecedor', e.target.value)} />
                </CampoAdministrativo>
                <CampoAdministrativo id="admin-data-entrega" label="Data de entrega" erro={errosAdministrativos.dataEntrega}>
                  <Input id="admin-data-entrega" type="date" value={administrativo.dataEntrega} aria-invalid={Boolean(errosAdministrativos.dataEntrega)} aria-describedby={errosAdministrativos.dataEntrega ? 'admin-data-entrega-erro' : undefined} onChange={(e) => atualizarCampoAdministrativo('dataEntrega', e.target.value)} />
                </CampoAdministrativo>
                <CampoAdministrativo id="admin-comprador" label="Comprador" erro={errosAdministrativos.comprador} className="sm:col-span-2">
                  <Input id="admin-comprador" maxLength={40} value={administrativo.comprador} aria-invalid={Boolean(errosAdministrativos.comprador)} aria-describedby={errosAdministrativos.comprador ? 'admin-comprador-erro' : undefined} onChange={(e) => atualizarCampoAdministrativo('comprador', e.target.value)} />
                </CampoAdministrativo>
              </div>
              <div className="grid gap-3 rounded-xl bg-slate-50 p-4 text-sm sm:grid-cols-2">
                <div><p className="text-slate-500">Status atual</p><p className="font-semibold">{detalhe.status}</p><p className="mt-1 text-xs text-slate-500">Somente leitura até existir uma regra aprovada de transições.</p></div>
                <div><p className="text-slate-500">Controle de versão</p><p className="font-semibold">Versão esperada: {detalhe.version}</p><p className="mt-1 text-xs text-slate-500">A atualização é atômica pela RPC administrativa.</p></div>
              </div>
              {conflitoAdministrativo && (
                <div role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
                  <p>Este pedido foi alterado por outra pessoa. Recarregue os dados antes de continuar.</p>
                  <Button type="button" className="mt-3" variant="outline" disabled={salvando} onClick={() => void recarregarDetalhe()}><RefreshCw />Recarregar pedido</Button>
                </div>
              )}
            </div>
          )}
          <DialogFooter className="shrink-0 border-t bg-white px-4 py-3 sm:px-6">
            <Button type="button" variant="outline" disabled={salvando} onClick={() => setEditandoAdministrativo(false)}>Cancelar</Button>
            <Button type="button" disabled={salvando || conflitoAdministrativo || !detalhe || !administrativo} onClick={() => void salvarAdministrativo()}>{salvando ? <Loader2 className="animate-spin" /> : <Pencil />}Salvar dados administrativos</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
