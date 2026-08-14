'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { AlertCircle, ArrowRight, CalendarRange, CheckCircle2, ChevronLeft, ChevronRight, ClipboardList, Clock, Eye, Loader2, PackageCheck, Pencil, RefreshCw, Search, ShoppingBag, SlidersHorizontal, UserSearch, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CardTapete } from './CardTapete'
import { AnexosTapete } from './AnexosTapete'
import { PreviaMensagem } from './PreviaMensagem'
import { FormularioLebebeExclusive, paginasVisiveisLebebeExclusive } from './FormularioLebebeExclusive'
import { aplicarMascaraTelefoneBR, formatarTelefone } from '@/lib/atendimento-presencial/telefone'
import {
  destinosPermitidosStatus,
  operacoesAnexoGestao,
  permiteEdicaoAdministrativa,
  permiteEdicaoComercial,
} from '@/lib/pedidos-personalizados/status-fluxo'
import { TIPO_TAPETE_PARA_EXIBICAO } from '@/lib/pedidos-personalizados'
import type { StatusPedidoPersonalizado } from '@/lib/pedidos-personalizados'
import {
  adicionarTapete,
  avaliarFormulario,
  carregarOpcoesNovoPedido,
  enviarAnexoGestao,
  moverItem,
  problemasPorCampo,
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
  contarPedidosGestaoPorStatus,
  detalheParaAdministrativo,
  detalheParaFormulario,
  deveExibirAcaoProdutoSgi,
  gerarResumoFornecedorDetalhe,
  listarPedidosGestao,
  mensagemErroGestao,
  payloadAtualizacaoAdministrativa,
  payloadAtualizacaoComercial,
  camposComerciaisPendentesTransicao,
  requisitosPendentesTransicao,
  solicitarProdutoSgiGestao,
  transicionarStatusGestao,
  validarAdministrativo,
} from './gestao-modelo'
import type { ContagensStatusGestao, ErrosAdministrativos, EstadoAdministrativo, EstadoTransicaoGestao, FiltrosGestao, PaginaPedidos, PedidoDetalhe, TapeteDetalhe } from './gestao-modelo'
import { dataOperacionalBrasil } from '@/lib/pedidos-personalizados/prazo'

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
  if (status === 'CANCELADO') return 'border-red-200 bg-red-50 text-red-700'
  if (status === 'RECEBIDO') return 'border-emerald-200 bg-emerald-50 text-emerald-700'
  if (status === 'EM PRODUÇÃO') return 'border-violet-200 bg-violet-50 text-violet-700'
  if (status === 'AGUARDANDO APROVAÇÃO DO CLIENTE') return 'border-orange-200 bg-orange-50 text-orange-800'
  if (status === 'AGUARDANDO LAYOUT') return 'border-amber-200 bg-amber-50 text-amber-800'
  if (status === 'VENDA FECHADA') return 'border-sky-200 bg-sky-50 text-sky-700'
  return 'border-slate-300 bg-slate-100 text-slate-700'
}

/** Reaproveita as duas primeiras classes (borda/fundo) de classeStatus() para tingir o cabeçalho do card com a mesma cor do status, sem duplicar o mapeamento. */
function tonsStatusCartao(status: string) {
  const [borda, fundo] = classeStatus(status).split(' ')
  return `${borda} ${fundo}`
}

function formatarDataRecebimento(valor: string) {
  return dataIsoParaExibicao(valor)
}

function hojeIsoBrasil() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())
}

function classePrazo(situacao: string) {
  if (situacao === 'ATRASADO') return 'border-red-200 bg-red-50 text-red-700'
  if (situacao === 'PRESTES A VENCER') return 'border-amber-200 bg-amber-50 text-amber-800'
  return 'border-emerald-200 bg-emerald-50 text-emerald-700'
}

function classePrazoBorda(situacao: string) {
  if (situacao === 'ATRASADO') return 'border-l-4 border-l-red-400'
  if (situacao === 'PRESTES A VENCER') return 'border-l-4 border-l-amber-400'
  return ''
}

function filtrosVazios(filtros: FiltrosGestao) {
  return Object.values(filtros).every((valor) => !valor)
}

function ChipStatus({
  rotulo,
  contagem,
  ativo,
  carregando,
  classeCor,
  onClick,
}: {
  rotulo: string
  contagem: number
  ativo: boolean
  carregando: boolean
  classeCor: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={ativo}
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${classeCor} ${ativo ? 'ring-2 ring-[#00A5E6] ring-offset-1 ring-offset-white' : 'opacity-70 hover:opacity-100'}`}
    >
      {rotulo}
      <span className="font-mono text-[11px] font-bold tabular-nums">{carregando ? '···' : contagem}</span>
    </button>
  )
}

/** Degradê compartilhado por todo botão de avanço de status (card, gatilho dentro do pedido e confirmação no modal). */
const CLASSE_DEGRADE_AVANCO_STATUS = 'h-auto min-h-11 min-w-0 max-w-full whitespace-normal break-words border-0 bg-gradient-to-r from-[#00A5E6] to-emerald-500 bg-[length:135%_100%] bg-left py-2 text-center leading-snug text-white transition-[background-position] duration-300 hover:bg-right'

/**
 * Rótulo contextual reaproveitado tanto no atalho do card quanto no botão que abre o modal dentro do
 * pedido: `destinosPermitidosStatus` sempre lista o caminho "para frente" antes de Cancelado (ver
 * `status-fluxo.ts`), então o primeiro item da lista é sempre a próxima fase — usado como sugestão
 * padrão também dentro do modal (`montarEstadoTransicao`). O rótulo mostra sempre essa fase, nunca um
 * texto genérico; se o usuário quiser outra transição (ex. Cancelado), troca pelo campo Destino já
 * dentro do modal.
 */
function BotaoAvancoStatus({
  status,
  fornecedor,
  onClick,
  disabled,
  className,
  variant,
}: {
  status: StatusPedidoPersonalizado
  fornecedor: { chave: string } | null | undefined
  onClick: () => void
  disabled?: boolean
  className?: string
  variant?: 'default' | 'outline'
}) {
  const destinos = destinosPermitidosStatus(status, fornecedor?.chave === 'lebebe_exclusive' ? 'lebebe_exclusive' : 'moriah_tapetes')
  if (destinos.length === 0) return null
  const proximaFase = destinos[0]
  const classeDegrade = variant === 'outline' ? '' : CLASSE_DEGRADE_AVANCO_STATUS
  return (
    <Button type="button" variant={variant} disabled={disabled} onClick={onClick} className={`${classeDegrade} ${className ?? ''}`}>
      Avançar para {proximaFase}
      <ArrowRight aria-hidden="true" />
    </Button>
  )
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
  const [contagens, setContagens] = useState<ContagensStatusGestao | null>(null)
  const [carregandoContagens, setCarregandoContagens] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [detalhe, setDetalhe] = useState<PedidoDetalhe | null>(null)
  const [carregandoDetalhe, setCarregandoDetalhe] = useState(false)
  const [editando, setEditando] = useState(false)
  const [editandoAdministrativo, setEditandoAdministrativo] = useState(false)
  const [administrativo, setAdministrativo] = useState<EstadoAdministrativo | null>(null)
  const [errosAdministrativos, setErrosAdministrativos] = useState<ErrosAdministrativos>({})
  const [conflitoAdministrativo, setConflitoAdministrativo] = useState(false)
  const [alterandoStatus, setAlterandoStatus] = useState(false)
  const [transicao, setTransicao] = useState<EstadoTransicaoGestao>({
    destino: '', numeroPedidoCompra: '', dataPedidoFornecedor: '', comprador: '', dataEntrega: '', dataRecebimento: '', justificativa: '',
  })
  const [numeroLancamentoTransicao, setNumeroLancamentoTransicao] = useState('')
  const [transicaoOrigemCard, setTransicaoOrigemCard] = useState(false)
  const [produtoSgiOrigemCard, setProdutoSgiOrigemCard] = useState(false)
  const [formulario, setFormulario] = useState<EstadoNovoPedido | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [confirmandoProdutoSgi, setConfirmandoProdutoSgi] = useState(false)
  const [solicitandoProdutoSgi, setSolicitandoProdutoSgi] = useState(false)
  const [resumoCopiado, setResumoCopiado] = useState(false)
  const [operacaoAnexo, setOperacaoAnexo] = useState<{ chaveLocal: string; slot: 1 | 2; tipo: 'upload' | 'substituicao' | 'remocao' | 'abertura' } | null>(null)
  const mutacaoRef = useRef(false)
  const detalheInicialRef = useRef(false)

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
    if (detalheInicialRef.current) return
    detalheInicialRef.current = true
    const pedidoId = new URLSearchParams(window.location.search).get('pedidoId')
    if (pedidoId) void abrirDetalhe(pedidoId)
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    void carregarLista(controller.signal)
    return () => controller.abort()
  }, [carregarLista])

  useEffect(() => {
    const pendente = resultado?.itens.some((item) => item.produtoSgi?.status === 'PENDENTE' || item.produtoSgi?.status === 'PROCESSANDO')
    if (!pendente) return

    const controller = new AbortController()
    const intervalId = window.setInterval(() => {
      void carregarLista(controller.signal)
    }, 5000)

    return () => {
      controller.abort()
      window.clearInterval(intervalId)
    }
  }, [resultado, carregarLista])

  useEffect(() => {
    const pedidoId = detalhe?.id
    const status = detalhe?.produtoSgi?.status
    if (!pedidoId || (status !== 'PENDENTE' && status !== 'PROCESSANDO')) return

    let cancelado = false
    const intervalId = window.setInterval(() => {
      void carregarDetalheGestao(pedidoId).then((pedido) => {
        if (cancelado) return
        setDetalhe(pedido)
        if (pedido.produtoSgi?.status === 'CONCLUIDO') {
          toast.success('Produto criado no SGI.')
          window.clearInterval(intervalId)
        }
        if (pedido.produtoSgi?.status === 'ERRO') window.clearInterval(intervalId)
      }).catch(() => undefined)
    }, 5000)

    return () => {
      cancelado = true
      window.clearInterval(intervalId)
    }
  }, [detalhe])

  const carregarContagens = useCallback(async (signal?: AbortSignal) => {
    setCarregandoContagens(true)
    try {
      const dados = await contarPedidosGestaoPorStatus(filtrosAplicados, signal)
      setContagens(dados.contagens)
    } catch {
      if (signal?.aborted) return
    } finally {
      if (!signal?.aborted) setCarregandoContagens(false)
    }
    // Os contadores não dependem do status ativo (eles mostram todos os
    // status ao mesmo tempo); a lista de dependências ignora
    // filtrosAplicados.status de propósito, para não refazer a contagem só
    // porque o usuário trocou de chip.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    filtrosAplicados.cliente, filtrosAplicados.consultora, filtrosAplicados.numeroLancamento,
    filtrosAplicados.unidade, filtrosAplicados.dataInicial, filtrosAplicados.dataFinal,
    filtrosAplicados.dataPedidoFornecedorInicial, filtrosAplicados.dataPedidoFornecedorFinal,
    filtrosAplicados.dataEntregaInicial, filtrosAplicados.dataEntregaFinal,
    filtrosAplicados.situacaoPrazo, filtrosAplicados.tipoTapete,
  ])

  useEffect(() => {
    const controller = new AbortController()
    void carregarContagens(controller.signal)
    return () => controller.abort()
  }, [carregarContagens])

  const telefoneLegadoNulo = detalhe?.telefone === null || detalhe?.telefone === undefined
  const avaliacaoEdicao = useMemo(() => {
    if (!formulario || !opcoes) return null
    const avaliacao = avaliarFormulario(formulario, opcoes)
    if (!telefoneLegadoNulo || formulario.telefone.trim()) return avaliacao
    const errosFiltrados = avaliacao.validacao.erros.filter(
      (item) => !(item.campo === 'telefone' && (item.codigo === 'TELEFONE_OBRIGATORIO' || item.codigo === 'TELEFONE_INVALIDO'))
    )
    return {
      validacao: { ...avaliacao.validacao, erros: errosFiltrados, valido: errosFiltrados.length === 0 },
      mensagem: avaliacao.mensagem,
    }
  }, [formulario, opcoes, telefoneLegadoNulo])
  const resumoFornecedor = useMemo(() => detalhe ? gerarResumoFornecedorDetalhe(detalhe) : null, [detalhe])
  const exigeLancamentoNaTransicao = detalhe
    ? camposComerciaisPendentesTransicao(detalhe, transicao.destino).includes('numeroLancamento')
    : false
  const pendenciasTransicao = useMemo(
    () => detalhe
      ? requisitosPendentesTransicao(
          exigeLancamentoNaTransicao ? { ...detalhe, numeroLancamento: numeroLancamentoTransicao || null } : detalhe,
          transicao
        )
      : ['Pedido não carregado.'],
    [detalhe, transicao, exigeLancamentoNaTransicao, numeroLancamentoTransicao]
  )

  async function copiarResumoFornecedor() {
    if (!resumoFornecedor) return
    try {
      await navigator.clipboard.writeText(resumoFornecedor)
      setResumoCopiado(true)
      toast.success('Resumo copiado para a área de transferência.')
      window.setTimeout(() => setResumoCopiado(false), 2000)
    } catch {
      toast.error('Não foi possível copiar o resumo.')
    }
  }

  function aplicarFiltroStatusChip(status: '' | StatusPedidoPersonalizado) {
    setFiltros((atual) => ({ ...atual, status }))
    setFiltrosAplicados((atual) => ({ ...atual, status }))
    setPagina(1)
  }

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
      setTransicaoOrigemCard(false)
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

  function montarEstadoTransicao(pedido: PedidoDetalhe): EstadoTransicaoGestao {
    const destino = destinosPermitidosStatus(
      pedido.status,
      pedido.fornecedor?.chave === 'lebebe_exclusive' ? 'lebebe_exclusive' : 'moriah_tapetes'
    )[0] ?? ''
    return {
      destino,
      numeroPedidoCompra: pedido.numeroPedidoCompra ?? '',
      dataPedidoFornecedor: pedido.dataPedidoFornecedor ?? '',
      comprador: pedido.comprador ?? '',
      dataEntrega: pedido.dataEntrega ?? '',
      dataRecebimento: hojeIsoBrasil(),
      justificativa: '',
    }
  }

  function abrirTransicao() {
    if (!detalhe) return
    setTransicao(montarEstadoTransicao(detalhe))
    setNumeroLancamentoTransicao(detalhe.numeroLancamento ?? '')
    setAlterandoStatus(true)
  }

  async function abrirTransicaoPeloCard(id: string) {
    if (carregandoDetalhe) return
    setTransicaoOrigemCard(true)
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
      setTransicao(montarEstadoTransicao(pedido))
      setNumeroLancamentoTransicao(pedido.numeroLancamento ?? '')
      setAlterandoStatus(true)
    } catch (error) {
      toast.error(mensagemErroGestao(error))
      setTransicaoOrigemCard(false)
    } finally {
      setCarregandoDetalhe(false)
    }
  }

  function fecharTransicao() {
    setAlterandoStatus(false)
    if (transicaoOrigemCard) {
      setDetalhe(null)
      setFormulario(null)
      setAdministrativo(null)
      setTransicaoOrigemCard(false)
    }
  }

  async function confirmarTransicao() {
    if (!detalhe || !transicao.destino || salvando || pendenciasTransicao.length > 0) return
    setSalvando(true)
    try {
      await transicionarStatusGestao(detalhe.id, detalhe.version, {
        statusDestino: transicao.destino,
        numeroLancamento: exigeLancamentoNaTransicao ? numeroLancamentoTransicao : null,
        numeroPedidoCompra: detalhe.status === 'VENDA FECHADA' && ['AGUARDANDO LAYOUT', 'EM PRODUÇÃO'].includes(transicao.destino) ? transicao.numeroPedidoCompra : null,
        dataPedidoFornecedor: detalhe.status === 'VENDA FECHADA' && ['AGUARDANDO LAYOUT', 'EM PRODUÇÃO'].includes(transicao.destino) ? transicao.dataPedidoFornecedor : null,
        comprador: detalhe.status === 'VENDA FECHADA' && ['AGUARDANDO LAYOUT', 'EM PRODUÇÃO'].includes(transicao.destino) ? transicao.comprador : null,
        dataEntrega: transicao.destino === 'EM PRODU\u00c7\u00c3O' ? transicao.dataEntrega : null,
        dataRecebimento: transicao.destino === 'RECEBIDO' ? transicao.dataRecebimento : null,
        justificativa: transicao.destino === 'CANCELADO' ? transicao.justificativa : null,
      })
      await recarregarDetalhe()
      await carregarLista()
      fecharTransicao()
      toast.success('Status atualizado.')
    } catch (error) {
      toast.error(mensagemErroGestao(error))
      if (erroStatus(error) === 409) await recarregarDetalhe().catch(() => undefined)
    } finally {
      setSalvando(false)
    }
  }

  async function abrirProdutoSgiPeloCard(id: string) {
    if (carregandoDetalhe) return
    setProdutoSgiOrigemCard(true)
    setCarregandoDetalhe(true)
    try {
      const pedido = await carregarDetalheGestao(id)
      setDetalhe(pedido)
      setFormulario(detalheParaFormulario(pedido))
      setAdministrativo(detalheParaAdministrativo(pedido))
      setConfirmandoProdutoSgi(true)
    } catch (error) {
      setProdutoSgiOrigemCard(false)
      toast.error(mensagemErroGestao(error))
    } finally {
      setCarregandoDetalhe(false)
    }
  }

  async function confirmarCriacaoProdutoSgi() {
    if (!detalhe || solicitandoProdutoSgi) return
    setSolicitandoProdutoSgi(true)
    try {
      const produtoSgi = await solicitarProdutoSgiGestao(detalhe.id)
      setDetalhe((atual) => atual ? { ...atual, produtoSgi } : atual)
      setConfirmandoProdutoSgi(false)
      await carregarLista()
      if (produtoSgiOrigemCard) {
        setDetalhe(null)
        setFormulario(null)
        setAdministrativo(null)
        setProdutoSgiOrigemCard(false)
      }
      toast.success(produtoSgi.status === 'CONCLUIDO'
        ? 'Produto já estava criado no SGI.'
        : produtoSgi.tentativas > 0 ? 'Retomada enviada para a fila.' : 'Criação enviada para a fila.')
    } catch (error) {
      toast.error(mensagemErroGestao(error))
    } finally {
      setSolicitandoProdutoSgi(false)
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

  const totalContagens = contagens ? Object.values(contagens).reduce((soma, valor) => soma + valor, 0) : 0

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-sky-100 bg-gradient-to-br from-sky-50 via-white to-indigo-50 p-4 shadow-sm sm:p-5" aria-labelledby="filtros-pedidos">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 id="filtros-pedidos" className="font-bold text-slate-900">Filtros</h2><p className="text-sm text-slate-500">Preencha os campos e clique em Atualizar para aplicar.</p></div><Button type="button" variant="ghost" onClick={() => { setFiltros(FILTROS_VAZIOS); setFiltrosAplicados(FILTROS_VAZIOS); setPagina(1) }}><X />Limpar</Button></div>
        <div className="space-y-5">
          <div>
            <div className="mb-2 flex items-center gap-1.5"><UserSearch className="size-4 text-slate-400" aria-hidden="true" /><h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Busca</h3></div>
            <div className="grid items-end gap-3 sm:grid-cols-3">
              <Input aria-label="Filtrar por cliente" placeholder="Cliente" value={filtros.cliente} onChange={(e) => setFiltros({ ...filtros, cliente: e.target.value })} />
              <Input aria-label="Filtrar por consultora" placeholder="Consultora" value={filtros.consultora} onChange={(e) => setFiltros({ ...filtros, consultora: e.target.value })} />
              <Input aria-label="Filtrar por lançamento" placeholder="Nº lançamento" inputMode="numeric" value={filtros.numeroLancamento} onChange={(e) => setFiltros({ ...filtros, numeroLancamento: e.target.value.replace(/\D/g, '').slice(0, 6) })} />
            </div>
          </div>
          <div>
            <div className="mb-2 flex items-center gap-1.5"><CalendarRange className="size-4 text-slate-400" aria-hidden="true" /><h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Datas</h3></div>
            <div className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div><label htmlFor="data-inicial" className="mb-1 block text-xs font-medium text-slate-600">Cadastro inicial</label><Input id="data-inicial" type="date" value={filtros.dataInicial} onChange={(e) => setFiltros({ ...filtros, dataInicial: e.target.value })} /></div>
              <div><label htmlFor="data-final" className="mb-1 block text-xs font-medium text-slate-600">Cadastro final</label><Input id="data-final" type="date" value={filtros.dataFinal} onChange={(e) => setFiltros({ ...filtros, dataFinal: e.target.value })} /></div>
              <div><label htmlFor="pedido-fornecedor-inicial" className="mb-1 block text-xs font-medium text-slate-600">Data do pedido ao fornecedor — início</label><Input id="pedido-fornecedor-inicial" type="date" value={filtros.dataPedidoFornecedorInicial} onChange={(e) => setFiltros({ ...filtros, dataPedidoFornecedorInicial: e.target.value })} /></div>
              <div><label htmlFor="pedido-fornecedor-final" className="mb-1 block text-xs font-medium text-slate-600">Data do pedido ao fornecedor — fim</label><Input id="pedido-fornecedor-final" type="date" value={filtros.dataPedidoFornecedorFinal} onChange={(e) => setFiltros({ ...filtros, dataPedidoFornecedorFinal: e.target.value })} /></div>
              <div><label htmlFor="entrega-inicial" className="mb-1 block text-xs font-medium text-slate-600">Previsão de entrega — início</label><Input id="entrega-inicial" type="date" value={filtros.dataEntregaInicial} onChange={(e) => setFiltros({ ...filtros, dataEntregaInicial: e.target.value })} /></div>
              <div><label htmlFor="entrega-final" className="mb-1 block text-xs font-medium text-slate-600">Previsão de entrega — fim</label><Input id="entrega-final" type="date" value={filtros.dataEntregaFinal} onChange={(e) => setFiltros({ ...filtros, dataEntregaFinal: e.target.value })} /></div>
            </div>
          </div>
          <div>
            <div className="mb-2 flex items-center gap-1.5"><SlidersHorizontal className="size-4 text-slate-400" aria-hidden="true" /><h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Classificação</h3></div>
            <div className="grid items-end gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-5">
              <Select value={filtros.unidade || 'TODAS'} onValueChange={(v) => setFiltros({ ...filtros, unidade: v === 'TODAS' ? '' : v as FiltrosGestao['unidade'] })}><SelectTrigger className="w-full" aria-label="Filtrar por unidade"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="TODAS">Todas as unidades</SelectItem>{opcoes?.unidades.map((u) => <SelectItem key={u.chave} value={u.chave}>{u.nome}</SelectItem>)}</SelectContent></Select>
              <Select value={filtros.status || 'TODOS'} onValueChange={(v) => setFiltros({ ...filtros, status: v === 'TODOS' ? '' : v as FiltrosGestao['status'] })}><SelectTrigger className="w-full" aria-label="Filtrar por status"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="TODOS">Todos os status</SelectItem>{opcoes?.status?.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select>
              <Select value={filtros.situacaoPrazo || 'TODOS'} onValueChange={(v) => setFiltros({ ...filtros, situacaoPrazo: v === 'TODOS' ? '' : v as FiltrosGestao['situacaoPrazo'] })}><SelectTrigger className="w-full" aria-label="Filtrar por situação do prazo"><SelectValue placeholder="Situação do prazo" /></SelectTrigger><SelectContent><SelectItem value="TODOS">Todos os prazos</SelectItem><SelectItem value="NO PRAZO">No prazo</SelectItem><SelectItem value="PRESTES A VENCER">Prestes a vencer</SelectItem><SelectItem value="ATRASADO">Atrasado</SelectItem></SelectContent></Select>
              <Select value={filtros.tipoTapete || 'TODOS'} onValueChange={(v) => setFiltros({ ...filtros, tipoTapete: v === 'TODOS' ? '' : v as FiltrosGestao['tipoTapete'] })}><SelectTrigger className="w-full" aria-label="Filtrar por tipo de tapete"><SelectValue placeholder="Tipo" /></SelectTrigger><SelectContent><SelectItem value="TODOS">Todos os tipos</SelectItem><SelectItem value="CATALOGO">{TIPO_TAPETE_PARA_EXIBICAO.CATALOGO}</SelectItem><SelectItem value="PERSONALIZADO">{TIPO_TAPETE_PARA_EXIBICAO.PERSONALIZADO}</SelectItem></SelectContent></Select>
              <Button type="button" className="w-full" onClick={() => { setPagina(1); setFiltrosAplicados({ ...filtros }) }}><Search />Atualizar</Button>
            </div>
          </div>
        </div>
      </section>

      <section aria-label="Pedidos por status" className="flex flex-wrap gap-2">
        <ChipStatus
          rotulo="Todos"
          contagem={totalContagens}
          ativo={!filtrosAplicados.status}
          carregando={carregandoContagens}
          classeCor="border-slate-300 bg-white text-slate-700"
          onClick={() => aplicarFiltroStatusChip('')}
        />
        {(opcoes?.status ?? []).map((status) => (
          <ChipStatus
            key={status}
            rotulo={status}
            contagem={contagens?.[status] ?? 0}
            ativo={filtrosAplicados.status === status}
            carregando={carregandoContagens}
            classeCor={classeStatus(status)}
            onClick={() => aplicarFiltroStatusChip(status)}
          />
        ))}
      </section>

      {erro && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700"><AlertCircle className="mr-2 inline size-5" />{erro}</div>}

      {carregando && !resultado && <div role="status" className="rounded-2xl border bg-white p-10 text-center"><Loader2 className="mx-auto mb-2 animate-spin" />Carregando pedidos...</div>}

      {resultado && (resultado.itens.length > 0 ? (
        <section className="space-y-3">
          {carregando && <p className="flex items-center gap-1.5 text-xs font-medium text-slate-500"><Loader2 className="size-3.5 animate-spin" aria-hidden="true" />Atualizando...</p>}
          <div className={`grid gap-4 transition-opacity md:grid-cols-2 xl:grid-cols-3 ${carregando ? 'pointer-events-none opacity-60' : ''}`} aria-label="Pedidos encontrados">
            {resultado.itens.map((item) => (
              <article key={item.id} className={`flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md ${classePrazoBorda(item.situacaoPrazo ?? '')}`}>
                <div className={`border-b p-5 ${tonsStatusCartao(item.status)}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold uppercase tracking-wide text-sky-700">{item.fornecedor?.nome ?? 'MORIAH TAPETES'}</p>
                      <h2 className="mt-1 truncate text-lg font-bold text-slate-900">{item.cliente}</h2>
                      <p className="text-sm text-slate-600">{item.unidade.nome} · {item.consultora}</p>
                    </div>
                    <span className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold ${classeStatus(item.status)}`}>{item.status}</span>
                  </div>
                </div>
                <div className="flex flex-1 flex-col p-5">
                  {item.dataEntrega && (
                    <div className="mb-4 flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm">
                      <Clock className="size-4 shrink-0 text-slate-400" aria-hidden="true" />
                      <span className="text-slate-600">Previsão: <span className="font-semibold text-slate-900">{dataIsoParaExibicao(item.dataEntrega)}</span></span>
                      {item.situacaoPrazo && <span className={`ml-auto shrink-0 rounded-full border px-2 py-0.5 text-xs font-bold ${classePrazo(item.situacaoPrazo)}`}>{item.situacaoPrazo}</span>}
                    </div>
                  )}
                  <dl className="mb-5 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                    <div><dt className="text-slate-500">Nº de lançamento</dt><dd className="font-semibold text-slate-900">{item.numeroLancamento ?? '—'}</dd></div>
                    <div><dt className="text-slate-500">Telefone</dt><dd className="font-semibold text-slate-900">{item.telefone ? formatarTelefone(item.telefone) : 'Não informado'}</dd></div>
                    <div><dt className="text-slate-500">Nº do pedido de compra</dt><dd className="font-semibold text-slate-900">{item.numeroPedidoCompra ?? '—'}</dd></div>
                    <div><dt className="text-slate-500">Pedido ao fornecedor</dt><dd className="font-medium">{item.dataPedidoFornecedor ? dataIsoParaExibicao(item.dataPedidoFornecedor) : '—'}</dd></div>
                    {item.status === 'RECEBIDO' && item.recebidoEm && <div><dt className="text-slate-500">Recebido em</dt><dd className="font-medium">{formatarDataRecebimento(item.recebidoEm)}</dd></div>}
                    <div><dt className="text-slate-500">Comprador</dt><dd className="font-medium">{item.comprador ?? '—'}</dd></div>
                    <div><dt className="text-slate-500">{item.fornecedor?.chave === 'lebebe_exclusive' ? 'Itens' : 'Tapetes'}</dt><dd className="font-medium">{item.fornecedor?.chave === 'lebebe_exclusive' ? item.quantidadeItens : item.quantidadeTapetes}</dd></div>
                    {item.fornecedor?.chave !== 'lebebe_exclusive' && <div><dt className="text-slate-500">Tipo</dt><dd className="font-medium">{item.tiposTapetes.map((tipo) => TIPO_TAPETE_PARA_EXIBICAO[tipo]).join(' + ') || '—'}</dd></div>}
                    <div><dt className="text-slate-500">Produtos</dt><dd className="font-medium">{item.fornecedor?.chave === 'lebebe_exclusive' ? item.referenciasProdutos.join(', ') || '—' : item.codigosProdutos.join(', ') || '—'}</dd></div>
                    <div><dt className="text-slate-500">Cadastro</dt><dd className="font-medium">{formatarData(item.createdAt)}</dd></div>
                  </dl>
                  {item.fornecedor?.chave === 'lebebe_exclusive' && item.produtoSgi && (
                    <div className={`mb-4 rounded-lg border px-3 py-2 text-sm ${
                      item.produtoSgi.status === 'CONCLUIDO'
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                        : item.produtoSgi.status === 'ERRO'
                          ? 'border-red-200 bg-red-50 text-red-900'
                          : 'border-sky-200 bg-sky-50 text-sky-900'
                    }`}>
                      <p className="font-bold">{item.produtoSgi.status === 'CONCLUIDO' ? 'Produto SGI criado' : item.produtoSgi.status === 'ERRO' ? 'Erro ao criar produto SGI' : 'Criando produto SGI...'}</p>
                      <p className="mt-1 break-words">{item.produtoSgi.codigoSgi ? `${item.produtoSgi.codigoSgi} - ` : ''}{item.produtoSgi.nomeProduto}</p>
                    </div>
                  )}
                  <div className="mt-auto flex flex-col gap-2">
                    {deveExibirAcaoProdutoSgi(item) && (
                        <Button
                          type="button"
                          className="min-h-11"
                          disabled={carregandoDetalhe || item.produtoSgi?.status === 'PENDENTE' || item.produtoSgi?.status === 'PROCESSANDO'}
                          onClick={() => void abrirProdutoSgiPeloCard(item.id)}
                        >
                          {item.produtoSgi?.status === 'PENDENTE' || item.produtoSgi?.status === 'PROCESSANDO'
                            ? <><Loader2 className="animate-spin" />Criando produto SGI...</>
                            : item.produtoSgi?.status === 'ERRO'
                              ? <><RefreshCw />Tentar novamente</>
                              : <><ShoppingBag />Criar produto SGI</>}
                        </Button>
                      )}
                    <BotaoAvancoStatus
                      status={item.status}
                      fornecedor={item.fornecedor}
                      disabled={carregandoDetalhe}
                      className="min-h-11 font-semibold shadow-sm"
                      onClick={() => void abrirTransicaoPeloCard(item.id)}
                    />
                    <Button type="button" className="min-h-11" variant="outline" onClick={() => void abrirDetalhe(item.id)}><Eye />Ver pedido</Button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : carregando ? (
        <div role="status" className="rounded-2xl border bg-white p-10 text-center text-slate-500"><Loader2 className="mx-auto mb-2 animate-spin" />Atualizando pedidos...</div>
      ) : (
        <div className="rounded-2xl border border-dashed bg-white p-10 text-center text-slate-600">
          {filtrosVazios(filtrosAplicados)
            ? 'Nenhum pedido personalizado foi cadastrado ainda para o seu escopo de unidades.'
            : 'Nenhum pedido encontrado com os filtros atuais. Tente ajustar ou limpar os filtros.'}
        </div>
      ))}

      {resultado && resultado.totalPaginas > 1 && (
        <nav className="flex flex-wrap items-center justify-center gap-2" aria-label="Paginação">
          <Button type="button" variant="outline" size="sm" disabled={pagina === 1 || carregando} onClick={() => setPagina((p) => p - 1)}><ChevronLeft />Anterior</Button>
          {paginasVisiveisLebebeExclusive(pagina, resultado.totalPaginas).map((p, indice) => typeof p === 'string'
            ? <span key={`reticencias-${indice}`} className="px-1 text-sm text-slate-500">…</span>
            : <Button key={p} type="button" size="sm" variant={p === pagina ? 'default' : 'outline'} disabled={carregando} aria-current={p === pagina ? 'page' : undefined} onClick={() => setPagina(p)}>{p}</Button>)}
          <Button type="button" variant="outline" size="sm" disabled={pagina === resultado.totalPaginas || carregando} onClick={() => setPagina((p) => p + 1)}>Próxima<ChevronRight /></Button>
          <p className="basis-full text-center text-sm text-slate-500">Página {resultado.pagina} de {resultado.totalPaginas} · {resultado.totalRegistros} registro(s)</p>
        </nav>
      )}

      <Dialog
        open={(carregandoDetalhe || detalhe !== null) && !editandoAdministrativo && !transicaoOrigemCard && !produtoSgiOrigemCard}
        onOpenChange={(aberto) => {
          if (!aberto && !salvando && !operacaoAnexo) {
            setDetalhe(null)
            setFormulario(null)
            setAdministrativo(null)
            setEditando(false)
          }
        }}
      >
        <DialogContent className="flex h-[calc(100dvh-1rem)] max-h-[calc(100dvh-1rem)] !w-[calc(100vw-1rem)] !max-w-[1400px] flex-col gap-0 overflow-hidden p-0 sm:h-[90vh] sm:max-h-[90vh] sm:!w-[90vw] lg:!w-[80vw]">
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
                      <div><dt className="text-slate-500">Telefone</dt><dd className="font-medium">{detalhe.telefone ? formatarTelefone(detalhe.telefone) : 'Não informado'}</dd></div>
                      <div><dt className="text-slate-500">Lançamento</dt><dd className="font-medium">{detalhe.numeroLancamento ?? '—'}</dd></div>
                      <div className="sm:col-span-2 xl:col-span-1 2xl:col-span-2"><dt className="text-slate-500">Fornecedor</dt><dd className="font-medium">{detalhe.fornecedor?.nome ?? '—'}</dd></div>
                    </dl>
                  </section>

                  <section className="rounded-xl border border-amber-100 bg-amber-50/40 p-4" aria-labelledby="dados-administrativos-titulo">
                    <h3 id="dados-administrativos-titulo" className="mb-3 flex items-center gap-2 font-semibold text-slate-900"><ClipboardList className="size-4 text-amber-700" />Dados administrativos</h3>
                    <dl className="grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                      <div><dt className="text-slate-500">Status</dt><dd className="font-medium">{detalhe.status}</dd></div>
                      <div><dt className="text-slate-500">Nº do pedido de compra</dt><dd className="font-medium">{detalhe.numeroPedidoCompra ?? '—'}</dd></div>
                      <div><dt className="text-slate-500">Data do pedido ao fornecedor</dt><dd className="font-medium">{detalhe.dataPedidoFornecedor ? dataIsoParaExibicao(detalhe.dataPedidoFornecedor) : '—'}</dd></div>
                      <div><dt className="text-slate-500">Previsão de Data de entrega do fornecedor</dt><dd className="font-medium">{detalhe.dataEntrega ? dataIsoParaExibicao(detalhe.dataEntrega) : '—'}</dd></div>
                      <div><dt className="text-slate-500">Comprador</dt><dd className="font-medium">{detalhe.comprador ?? '—'}</dd></div>
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

              {!editando && (
                <section className="rounded-xl border border-slate-200 bg-white p-4" aria-labelledby="historico-status-titulo">
                  <h3 id="historico-status-titulo" className="font-semibold text-slate-900">Histórico de status</h3>
                  {detalhe.historico.length === 0 ? (
                    <p className="mt-2 text-sm text-slate-500">A trilha começa nas transições realizadas a partir desta funcionalidade.</p>
                  ) : (
                    <ol className="mt-4 space-y-3 border-l-2 border-slate-200 pl-4">
                      {detalhe.historico.map((evento) => (
                        <li key={evento.id} className="text-sm">
                          <p className="font-semibold text-slate-900">{evento.statusAnterior} para {evento.statusNovo}</p>
                          <p className="text-slate-500">{formatarData(evento.createdAt)} · {evento.usuario?.email ?? 'Usuário do sistema'}</p>
                          {evento.justificativa && <p className="mt-1 whitespace-pre-wrap text-slate-700">{evento.justificativa}</p>}
                        </li>
                      ))}
                    </ol>
                  )}
                </section>
              )}

              {editando ? detalhe.fornecedor?.chave === 'lebebe_exclusive' ? (
                <FormularioLebebeExclusive
                  opcoes={opcoes}
                  pedidoInicial={detalhe}
                  onAtualizado={async () => {
                    await recarregarDetalhe()
                    await carregarLista()
                    setEditando(false)
                  }}
                />
              ) : (
                <div className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <div><label htmlFor="gestao-unidade" className="mb-1 block text-sm font-medium">Unidade</label><Select value={formulario.unidade} onValueChange={(v) => setFormulario({ ...formulario, unidade: v as EstadoNovoPedido['unidade'] })}><SelectTrigger id="gestao-unidade" aria-invalid={problemasPorCampo(avaliacaoEdicao?.validacao.erros ?? [], 'unidade').length > 0}><SelectValue /></SelectTrigger><SelectContent>{opcoes.unidades.map((u) => <SelectItem key={u.chave} value={u.chave}>{u.nome}</SelectItem>)}</SelectContent></Select>{problemasPorCampo(avaliacaoEdicao?.validacao.erros ?? [], 'unidade')[0] && <p role="alert" className="mt-1 text-sm text-red-600">{problemasPorCampo(avaliacaoEdicao?.validacao.erros ?? [], 'unidade')[0]}</p>}</div>
                    <div><label htmlFor="gestao-consultora" className="mb-1 block text-sm font-medium">Consultora</label><Input id="gestao-consultora" maxLength={20} value={formulario.consultora} onChange={(e) => setFormulario({ ...formulario, consultora: e.target.value })} aria-invalid={problemasPorCampo(avaliacaoEdicao?.validacao.erros ?? [], 'consultora').length > 0} />{problemasPorCampo(avaliacaoEdicao?.validacao.erros ?? [], 'consultora')[0] && <p role="alert" className="mt-1 text-sm text-red-600">{problemasPorCampo(avaliacaoEdicao?.validacao.erros ?? [], 'consultora')[0]}</p>}</div>
                    <div><label htmlFor="gestao-cliente" className="mb-1 block text-sm font-medium">Cliente</label><Input id="gestao-cliente" maxLength={40} value={formulario.cliente} onChange={(e) => setFormulario({ ...formulario, cliente: e.target.value })} aria-invalid={problemasPorCampo(avaliacaoEdicao?.validacao.erros ?? [], 'cliente').length > 0} />{problemasPorCampo(avaliacaoEdicao?.validacao.erros ?? [], 'cliente')[0] && <p role="alert" className="mt-1 text-sm text-red-600">{problemasPorCampo(avaliacaoEdicao?.validacao.erros ?? [], 'cliente')[0]}</p>}</div>
                    <div><label htmlFor="gestao-telefone" className="mb-1 block text-sm font-medium">Telefone do cliente</label><Input id="gestao-telefone" inputMode="tel" autoComplete="tel" placeholder="(41) 99999-9999" value={formulario.telefone} onChange={(e) => setFormulario({ ...formulario, telefone: aplicarMascaraTelefoneBR(e.target.value) })} aria-invalid={problemasPorCampo(avaliacaoEdicao?.validacao.erros ?? [], 'telefone').length > 0} />{problemasPorCampo(avaliacaoEdicao?.validacao.erros ?? [], 'telefone')[0] && <p role="alert" className="mt-1 text-sm text-red-600">{problemasPorCampo(avaliacaoEdicao?.validacao.erros ?? [], 'telefone')[0]}</p>}{telefoneLegadoNulo && !formulario.telefone.trim() && <p className="mt-1 text-xs text-amber-600">Telefone não cadastrado neste pedido legado. Preencha se quiser atualizar.</p>}</div>
                    <div><label htmlFor="gestao-lancamento" className="mb-1 block text-sm font-medium">Lançamento</label><Input id="gestao-lancamento" inputMode="numeric" maxLength={6} value={formulario.numeroLancamento} onChange={(e) => setFormulario({ ...formulario, numeroLancamento: e.target.value.replace(/\D/g, '').slice(0, 6) })} aria-invalid={problemasPorCampo(avaliacaoEdicao?.validacao.erros ?? [], 'numeroLancamento').length > 0} />{problemasPorCampo(avaliacaoEdicao?.validacao.erros ?? [], 'numeroLancamento')[0] && <p role="alert" className="mt-1 text-sm text-red-600">{problemasPorCampo(avaliacaoEdicao?.validacao.erros ?? [], 'numeroLancamento')[0]}</p>}</div>
                  </div>
                  {formulario.tapetes.map((tapete, indice) => <CardTapete key={tapete.chaveLocal} tapete={tapete} indice={indice} total={formulario.tapetes.length} produtos={opcoes.produtos} cores={opcoes.cores} erros={avaliacaoEdicao?.validacao.erros ?? []} camposTocados={new Set()} tentouSalvar disabled={salvando} onChange={(v) => atualizarTapete(indice, v)} onMover={(d) => setFormulario({ ...formulario, tapetes: moverItem(formulario.tapetes, indice, d) })} onRemover={() => setFormulario(removerTapete(formulario, tapete.chaveLocal))} onLimiteCores={() => toast.error('Máximo de 6 cores por tapete.')} onTocar={() => undefined} />)}
                  <Button type="button" variant="outline" disabled={formulario.tapetes.length >= 10} onClick={() => setFormulario(adicionarTapete(formulario, crypto.randomUUID()))}>Adicionar tapete</Button>
                  {(avaliacaoEdicao?.validacao.erros.length ?? 0) > 0 && <div role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700"><ul className="list-disc space-y-1 pl-5">{avaliacaoEdicao?.validacao.erros.map((erro, indice) => <li key={`${erro.campo}-${erro.codigo}-${indice}`}>{erro.mensagem}</li>)}</ul></div>}
                </div>
              ) : detalhe.fornecedor?.chave === 'lebebe_exclusive' ? (
                <section className="space-y-4" aria-labelledby="produtos-exclusive-titulo">
                  <div className="flex flex-wrap items-center justify-between gap-3"><h3 id="produtos-exclusive-titulo" className="flex items-center gap-2 font-semibold text-slate-900"><PackageCheck className="size-5 text-violet-700" />Produtos do pedido</h3><p className="text-sm font-semibold">Venda: {detalhe.itens.reduce((soma, item) => soma + item.totalVenda, 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} · Custo: {detalhe.itens.reduce((soma, item) => soma + item.totalCusto, 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p></div>
                  <div className="overflow-x-auto rounded-xl border">
                    <table className="min-w-[920px] w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-600"><tr><th className="p-3">Coleção</th><th className="p-3">Descrição</th><th className="p-3">Referência</th><th className="p-3">Qtd.</th><th className="p-3">Nome ou letra</th><th className="p-3 text-right">Preço unit.</th><th className="p-3 text-right">Custo unit.</th><th className="p-3 text-right">Total</th></tr></thead><tbody>{detalhe.itens.map((item) => <tr key={item.id} className="border-t"><td className="p-3 font-medium">{item.colecao}</td><td className="p-3">{item.descricao}</td><td className="p-3 font-mono">{item.referencia}</td><td className="p-3">{item.quantidade}</td><td className="p-3">{item.nomeOuLetra || '—'}</td><td className="p-3 text-right">{item.precoUnitario.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td><td className="p-3 text-right">{item.custoUnitario.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td><td className="p-3 text-right font-bold">{item.totalVenda.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td></tr>)}</tbody></table>
                  </div>
                  <section className={`rounded-xl border p-4 ${
                    detalhe.produtoSgi?.status === 'CONCLUIDO'
                      ? 'border-emerald-200 bg-emerald-50'
                      : detalhe.produtoSgi?.status === 'ERRO'
                        ? 'border-red-200 bg-red-50'
                        : 'border-sky-200 bg-sky-50'
                  }`} aria-labelledby="produto-sgi-titulo">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 id="produto-sgi-titulo" className="flex items-center gap-2 font-semibold text-slate-900">
                          <ShoppingBag className="size-5" />Produto no SGI
                        </h3>
                        <p className="mt-1 break-words text-sm font-medium text-slate-800">
                          {detalhe.produtoSgi?.nomeProduto ?? `LEBEBE EXCLUSIVE (${detalhe.unidade.nome} ${detalhe.numeroLancamento ?? '—'})`}
                        </p>
                      </div>
                      <span className="rounded-full border border-current/20 bg-white/70 px-3 py-1 text-xs font-bold">
                        {detalhe.produtoSgi?.status ?? 'NÃO INICIADO'}
                      </span>
                    </div>
                    <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
                      <div><dt className="text-slate-500">Custo</dt><dd className="font-semibold">{(detalhe.produtoSgi?.custo ?? detalhe.itens.reduce((soma, item) => soma + item.totalCusto, 0)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</dd></div>
                      <div><dt className="text-slate-500">Preço</dt><dd className="font-semibold">{(detalhe.produtoSgi?.preco ?? detalhe.itens.reduce((soma, item) => soma + item.totalVenda, 0)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</dd></div>
                      <div><dt className="text-slate-500">Etapa</dt><dd className="font-semibold">{(detalhe.produtoSgi?.etapa ?? 'NAO_INICIADO').replaceAll('_', ' ')}</dd></div>
                      <div><dt className="text-slate-500">Código SGI</dt><dd className="font-semibold">{detalhe.produtoSgi?.codigoSgi ?? '—'}</dd></div>
                    </dl>
                    {detalhe.produtoSgi?.status === 'ERRO' && (
                      <p role="alert" className="mt-3 text-sm font-medium text-red-800">{detalhe.produtoSgi.erroMensagem ?? 'A criação não foi concluída. Tente retomar.'}</p>
                    )}
                    {detalhe.produtoSgi?.status === 'CONCLUIDO' && (
                      <p className="mt-3 text-sm font-medium text-emerald-800">
                        {detalhe.produtoSgi.codigoSgi} - {detalhe.produtoSgi.nomeProduto} · Produto {detalhe.produtoSgi.produtoIdSgi} criado e validado no SGI.
                      </p>
                    )}
                  </section>
                </section>
              ) : (
                <section className="space-y-4" aria-labelledby="tapetes-titulo">
                  <h3 id="tapetes-titulo" className="flex items-center gap-2 font-semibold text-slate-900"><PackageCheck className="size-5 text-violet-700" />Tapetes, cores, anexos e alterações de layout</h3>
                  {detalhe.tapetes.map((tapete) => (
                    <section key={tapete.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                      <div className="border-b border-slate-100 pb-4">
                        <h4 className="font-bold text-slate-950">Tapete {tapete.ordem} · {tapete.formato}</h4>
                        <p className="mt-1 text-xs font-bold uppercase tracking-wide text-sky-700">{TIPO_TAPETE_PARA_EXIBICAO[tapete.tipo]}</p>
                        <p className="mt-1 break-words text-sm text-slate-600">{tapete.produto.codigo} — {tapete.produto.descricao}</p>
                      </div>

                      <div className={`mt-4 grid gap-4 ${tapete.tipo === 'PERSONALIZADO' ? 'lg:grid-cols-2' : ''}`}>
                        <section className="rounded-xl border border-sky-100 bg-sky-50/60 p-4" aria-label={`Medidas do tapete ${tapete.ordem}`}>
                          <h5 className="text-xs font-bold uppercase tracking-wide text-sky-800">Medidas</h5>
                          <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                            <div>
                              <dt className="text-slate-500">{tapete.formato === 'REDONDO' ? 'Diâmetro' : tapete.formato === 'ORGANICO' ? 'Maior largura' : 'Largura'}</dt>
                              <dd className="font-semibold text-slate-900">{(tapete.dimensao1Cm / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m</dd>
                            </div>
                            {tapete.dimensao2Cm !== null && (
                              <div>
                                <dt className="text-slate-500">{tapete.formato === 'ORGANICO' ? 'Maior comprimento' : 'Comprimento'}</dt>
                                <dd className="font-semibold text-slate-900">{(tapete.dimensao2Cm / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m</dd>
                              </div>
                            )}
                            <div className="rounded-lg bg-white px-3 py-2 sm:col-span-2">
                              <dt className="text-xs font-bold uppercase tracking-wide text-sky-700">Área cobrada</dt>
                              <dd className="mt-1 text-lg font-bold text-slate-950">{formatarArea(tapete.areaCobradaCentesimosM2)}</dd>
                            </div>
                          </dl>
                        </section>

                        {tapete.tipo === 'PERSONALIZADO' && (
                          <section className="rounded-xl border border-violet-100 bg-violet-50/50 p-4" aria-label={`Cores do tapete ${tapete.ordem}`}>
                            <h5 className="text-xs font-bold uppercase tracking-wide text-violet-800">Cores</h5>
                            {tapete.cores.length ? (
                              <ul className="mt-3 space-y-2">
                                {tapete.cores.map((cor) => (
                                  <li key={cor.id} className="flex min-w-0 items-start gap-2 text-sm text-slate-800">
                                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-violet-600" aria-hidden="true" />
                                    <span className="break-words">{cor.numero} — {cor.codigo} — {cor.nome}</span>
                                  </li>
                                ))}
                              </ul>
                            ) : <p className="mt-3 text-sm text-slate-500">Nenhuma cor selecionada.</p>}
                          </section>
                        )}
                      </div>

                      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                        <div><dt className="text-slate-500">Coleção</dt><dd className="break-words font-medium">{tapete.nomeColecaoCatalogo || '—'}</dd></div>
                        <div><dt className="text-slate-500">Cor/Referência</dt><dd className="break-words font-medium">{tapete.referenciaCatalogo || '—'}</dd></div>
                        <div className="sm:col-span-2"><dt className="text-slate-500">Observações</dt><dd className="whitespace-pre-wrap break-words">{tapete.observacoes || '—'}</dd></div>
                      </dl>

                      <section className="mt-5 border-t border-slate-200 pt-4" aria-label={`Alterações de layout do tapete ${tapete.ordem}`}>
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Alterações de layout</p>
                        <p className="mt-1 text-sm font-medium">{tapete.teveAlteracaoLayout ? `Sim (${tapete.quantidadeAlteracoesLayout ?? 0})` : 'Não'}</p>
                      </section>

                      <div className="mt-6 border-t border-slate-200 pt-5">
                        <AnexosTapete tapete={{ ...detalheParaFormulario(detalhe).tapetes.find((item) => item.tapeteId === tapete.id)!, anexos: tapete.anexos }} ordem={tapete.ordem} bloqueado={operacaoAnexo !== null} operacao={operacaoAnexo} errosPorSlot={{}} podeAdicionar={operacoesAnexoGestao(detalhe.status).adicionar} podeSubstituir={operacoesAnexoGestao(detalhe.status).substituir} podeRemover={operacoesAnexoGestao(detalhe.status).remover} onUpload={(slot, arquivo) => uploadGestao(tapete, slot, arquivo)} onAbrir={(anexo) => executarAnexo(tapete, anexo.slot, 'abertura', async () => { const { url } = await solicitarUrlAnexo(anexo.anexoId); window.open(url, '_blank', 'noopener,noreferrer') })} onSubstituir={(anexo, arquivo) => substituirGestao(tapete, anexo, arquivo)} onRemover={(anexo) => removerGestao(tapete, anexo)} />
                      </div>
                    </section>
                  ))}
                </section>
              )}

              {!editando && resumoFornecedor && (
                <PreviaMensagem
                  mensagem={resumoFornecedor}
                  copiada={resumoCopiado}
                  onCopiar={() => void copiarResumoFornecedor()}
                  titulo="Resumo para o fornecedor"
                  subtitulo="Gerado a partir dos dados atuais deste pedido."
                  rotuloBotao="COPIAR RESUMO"
                />
              )}
            </div>
          )}
          {detalhe && formulario && opcoes && (
            <DialogFooter className="shrink-0 border-t bg-white px-4 py-3 sm:px-6">
              <Button type="button" variant="outline" disabled={salvando || operacaoAnexo !== null} onClick={() => { setDetalhe(null); setFormulario(null); setAdministrativo(null) }}>Fechar</Button>
              {editando ? detalhe.fornecedor?.chave === 'lebebe_exclusive' ? null : (
                <>
                  <Button type="button" variant="ghost" disabled={salvando} onClick={() => { setFormulario(detalheParaFormulario(detalhe)); setEditando(false) }}>Cancelar edição</Button>
                  <Button type="button" disabled={salvando} onClick={() => void salvarComercial()}>{salvando ? <Loader2 className="animate-spin" /> : <Pencil />}Salvar dados comerciais</Button>
                </>
              ) : (
                <>
                  {deveExibirAcaoProdutoSgi(detalhe) && (
                      <Button
                        type="button"
                        variant={detalhe.produtoSgi?.status === 'ERRO' ? 'destructive' : 'default'}
                        disabled={solicitandoProdutoSgi || detalhe.produtoSgi?.status === 'PENDENTE' || detalhe.produtoSgi?.status === 'PROCESSANDO'}
                        onClick={() => setConfirmandoProdutoSgi(true)}
                      >
                        {detalhe.produtoSgi?.status === 'PENDENTE' || detalhe.produtoSgi?.status === 'PROCESSANDO'
                          ? <><Loader2 className="animate-spin" />Criando no SGI</>
                          : detalhe.produtoSgi?.status === 'ERRO'
                            ? <><RefreshCw />Tentar novamente no SGI</>
                            : <><ShoppingBag />Criar produto no SGI</>}
                      </Button>
                    )}
                  <Button type="button" disabled={!permiteEdicaoComercial(detalhe.status, detalhe.fornecedor?.chave === 'lebebe_exclusive' ? 'lebebe_exclusive' : 'moriah_tapetes')} onClick={() => setEditando(true)}><Pencil />Editar dados comerciais</Button>
                  <Button type="button" variant="secondary" disabled={!permiteEdicaoAdministrativa(detalhe.status)} onClick={() => { setAdministrativo(detalheParaAdministrativo(detalhe)); setErrosAdministrativos({}); setConflitoAdministrativo(false); setEditandoAdministrativo(true) }}><Pencil />Editar dados administrativos</Button>
                  <BotaoAvancoStatus status={detalhe.status} fornecedor={detalhe.fornecedor} onClick={abrirTransicao} className="font-semibold shadow-sm" />
                </>
              )}
              <Button type="button" variant="ghost" disabled={salvando} onClick={() => void recarregarDetalhe()}><RefreshCw />Recarregar</Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={confirmandoProdutoSgi} onOpenChange={(aberto) => {
        if (solicitandoProdutoSgi) return
        setConfirmandoProdutoSgi(aberto)
        if (!aberto && produtoSgiOrigemCard) {
          setDetalhe(null)
          setFormulario(null)
          setAdministrativo(null)
          setProdutoSgiOrigemCard(false)
        }
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Criar produto no sistema?</DialogTitle>
            <DialogDescription>
              Será criado um novo produto no SGI para este pedido. Depois da criação, use o código gerado para lançar a venda no sistema.
            </DialogDescription>
          </DialogHeader>
          {detalhe && (
            <div className="rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm">
              <p className="text-xs font-bold uppercase tracking-wide text-sky-800">Produto que será criado</p>
              <p className="mt-1 break-words font-semibold text-slate-950">
                {detalhe.produtoSgi?.nomeProduto ?? `LEBEBE EXCLUSIVE (${detalhe.unidade.nome} ${detalhe.numeroLancamento ?? '—'})`}
              </p>
              <p className="mt-4 text-xs font-bold uppercase tracking-wide text-sky-800">Preço de venda</p>
              <p className="mt-1 font-bold text-slate-950">
                {(detalhe.produtoSgi?.preco ?? detalhe.itens.reduce((soma, item) => soma + item.totalVenda, 0)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </p>
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" disabled={solicitandoProdutoSgi} onClick={() => setConfirmandoProdutoSgi(false)}>Cancelar</Button>
            <Button type="button" disabled={!detalhe || solicitandoProdutoSgi} onClick={() => void confirmarCriacaoProdutoSgi()}>
              {solicitandoProdutoSgi ? <><Loader2 className="animate-spin" />Enviando</> : detalhe?.produtoSgi?.status === 'ERRO' ? 'Tentar novamente' : 'Criar produto SGI'}
            </Button>
          </DialogFooter>
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
              <div className="grid gap-4 sm:grid-cols-2">
                <CampoAdministrativo id="admin-pedido-compra" label="Número do pedido de compra" erro={errosAdministrativos.numeroPedidoCompra}>
                  <Input id="admin-pedido-compra" disabled={detalhe?.status === 'EM PRODUÇÃO'} inputMode="numeric" maxLength={5} value={administrativo.numeroPedidoCompra} aria-invalid={Boolean(errosAdministrativos.numeroPedidoCompra)} aria-describedby={errosAdministrativos.numeroPedidoCompra ? 'admin-pedido-compra-erro' : undefined} onChange={(e) => atualizarCampoAdministrativo('numeroPedidoCompra', e.target.value.replace(/\D/g, '').slice(0, 5))} />
                </CampoAdministrativo>
                <CampoAdministrativo id="admin-data-fornecedor" label="Data do pedido ao fornecedor" erro={errosAdministrativos.dataPedidoFornecedor}>
                  <Input id="admin-data-fornecedor" disabled={detalhe?.status === 'EM PRODUÇÃO'} type="date" max={dataOperacionalBrasil()} value={administrativo.dataPedidoFornecedor} aria-invalid={Boolean(errosAdministrativos.dataPedidoFornecedor)} aria-describedby={errosAdministrativos.dataPedidoFornecedor ? 'admin-data-fornecedor-erro' : undefined} onChange={(e) => atualizarCampoAdministrativo('dataPedidoFornecedor', e.target.value)} />
                </CampoAdministrativo>
                <CampoAdministrativo id="admin-data-entrega" label="Previsão de Data de entrega do fornecedor" erro={errosAdministrativos.dataEntrega}>
                  <Input id="admin-data-entrega" type="date" value={administrativo.dataEntrega} aria-invalid={Boolean(errosAdministrativos.dataEntrega)} aria-describedby={errosAdministrativos.dataEntrega ? 'admin-data-entrega-erro' : undefined} onChange={(e) => atualizarCampoAdministrativo('dataEntrega', e.target.value)} />
                </CampoAdministrativo>
                <CampoAdministrativo id="admin-comprador" label="Comprador" erro={errosAdministrativos.comprador} className="sm:col-span-2">
                  <Input id="admin-comprador" disabled={detalhe?.status === 'EM PRODUÇÃO'} maxLength={40} value={administrativo.comprador} aria-invalid={Boolean(errosAdministrativos.comprador)} aria-describedby={errosAdministrativos.comprador ? 'admin-comprador-erro' : undefined} onChange={(e) => atualizarCampoAdministrativo('comprador', e.target.value)} />
                </CampoAdministrativo>
              </div>
              <div className="grid gap-3 rounded-xl bg-slate-50 p-4 text-sm sm:grid-cols-2">
                <div><p className="text-slate-500">Status atual</p><p className="font-semibold">{detalhe.status}</p><p className="mt-1 text-xs text-slate-500">Use a ação Alterar status para seguir o fluxo aprovado.</p></div>
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

      <Dialog open={alterandoStatus} onOpenChange={(aberto) => { if (!aberto && !salvando) fecharTransicao() }}>
        <DialogContent className="flex max-h-[calc(100dvh-1rem)] max-w-xl flex-col overflow-hidden p-0 sm:max-h-[90vh]">
          <DialogHeader className="shrink-0 border-b px-6 py-5">
            <DialogTitle>Alterar status</DialogTitle>
            <DialogDescription>{detalhe?.status === 'RASCUNHO' && transicao.destino === 'VENDA FECHADA' ? 'Confirma que esta venda foi fechada?' : 'Confirme a transição. A versão e o histórico serão atualizados de forma atômica.'}</DialogDescription>
          </DialogHeader>
          {detalhe && <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
            <div className="flex flex-wrap items-center gap-2 rounded-lg bg-slate-50 p-3 text-sm">
              <span className="rounded-full border border-slate-300 bg-white px-2.5 py-1 font-semibold text-slate-700">{detalhe.status}</span>
              <ArrowRight className="size-4 shrink-0 text-slate-400" aria-hidden="true" />
              <span className="rounded-full border border-sky-300 bg-sky-50 px-2.5 py-1 font-semibold text-sky-800">{transicao.destino || 'Selecione o destino'}</span>
            </div>
            <div><label htmlFor="status-destino" className="mb-1 block text-sm font-medium">Destino</label><Select value={transicao.destino} onValueChange={(destino) => setTransicao((atual) => ({ ...atual, destino: destino as StatusPedidoPersonalizado }))}><SelectTrigger id="status-destino"><SelectValue /></SelectTrigger><SelectContent>{destinosPermitidosStatus(detalhe.status, detalhe.fornecedor?.chave === 'lebebe_exclusive' ? 'lebebe_exclusive' : 'moriah_tapetes').map((status) => <SelectItem key={status} value={status}>{status}</SelectItem>)}</SelectContent></Select></div>
            {exigeLancamentoNaTransicao && <div>
              <label htmlFor="transicao-numero-lancamento" className="mb-1 block text-sm font-medium">Número de lançamento</label>
              <Input id="transicao-numero-lancamento" inputMode="numeric" maxLength={6} value={numeroLancamentoTransicao} onChange={(e) => setNumeroLancamentoTransicao(e.target.value.replace(/\D/g, '').slice(0, 6))} />
              <p className="mt-1 text-xs text-slate-500">Necessário para fechar a venda. Fica salvo junto aos dados comerciais do pedido.</p>
            </div>}
            {detalhe.status === 'VENDA FECHADA' && ['AGUARDANDO LAYOUT', 'EM PRODUÇÃO'].includes(transicao.destino) && <div className="grid gap-3 sm:grid-cols-2">
              <div><label htmlFor="transicao-pedido" className="mb-1 block text-sm font-medium">Nº do pedido de compra</label><Input id="transicao-pedido" inputMode="numeric" maxLength={5} value={transicao.numeroPedidoCompra} onChange={(e) => setTransicao({ ...transicao, numeroPedidoCompra: e.target.value.replace(/\D/g, '').slice(0, 5) })} /></div>
              <div><label htmlFor="transicao-data-fornecedor" className="mb-1 block text-sm font-medium">Data do pedido ao fornecedor</label><Input id="transicao-data-fornecedor" type="date" max={dataOperacionalBrasil()} value={transicao.dataPedidoFornecedor} onChange={(e) => setTransicao({ ...transicao, dataPedidoFornecedor: e.target.value })} /></div>
              <div className="sm:col-span-2"><label htmlFor="transicao-comprador" className="mb-1 block text-sm font-medium">Comprador</label><Input id="transicao-comprador" maxLength={40} value={transicao.comprador} onChange={(e) => setTransicao({ ...transicao, comprador: e.target.value })} /></div>
            </div>}
            {transicao.destino === 'EM PRODU\u00c7\u00c3O' && <div className="space-y-3"><div><label htmlFor="transicao-data-entrega" className="mb-1 block text-sm font-medium">Previsão de Data de entrega do fornecedor</label><Input id="transicao-data-entrega" type="date" value={transicao.dataEntrega} onChange={(e) => setTransicao({ ...transicao, dataEntrega: e.target.value })} /></div><p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Ao entrar em produção, os dados comerciais ficam bloqueados.</p></div>}
            {transicao.destino === 'RECEBIDO' && <div><label htmlFor="transicao-data-recebimento" className="mb-1 block text-sm font-medium">Data de recebimento</label><Input id="transicao-data-recebimento" type="date" value={transicao.dataRecebimento} onChange={(e) => setTransicao({ ...transicao, dataRecebimento: e.target.value })} /><p className="mt-1 text-xs text-slate-500">A data de hoje é sugerida, mas pode ser alterada.</p></div>}
            {transicao.destino === 'CANCELADO' && <div><label htmlFor="transicao-justificativa" className="mb-1 block text-sm font-medium">Justificativa</label><textarea id="transicao-justificativa" required maxLength={500} rows={4} className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm" value={transicao.justificativa} onChange={(e) => setTransicao({ ...transicao, justificativa: e.target.value })} /><p className="text-right text-xs text-slate-500">{transicao.justificativa.length}/500</p></div>}
            {pendenciasTransicao.length > 0 && <div role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"><p className="font-semibold">Para confirmar, falta:</p><ul className="mt-2 list-disc space-y-1 pl-5">{pendenciasTransicao.map((pendencia) => <li key={pendencia}>{pendencia}</li>)}</ul></div>}
          </div>}
          <DialogFooter className="shrink-0 flex-col-reverse gap-2 border-t bg-white px-6 py-4 sm:flex-col sm:items-stretch">
            <Button type="button" variant="outline" className="w-full" disabled={salvando} onClick={fecharTransicao}>Cancelar</Button>
            <Button
              type="button"
              disabled={salvando || pendenciasTransicao.length > 0}
              onClick={() => void confirmarTransicao()}
              className={`w-full ${detalhe && transicao.destino && transicao.destino === (destinosPermitidosStatus(detalhe.status, detalhe.fornecedor?.chave === 'lebebe_exclusive' ? 'lebebe_exclusive' : 'moriah_tapetes')[0] ?? '') ? CLASSE_DEGRADE_AVANCO_STATUS : ''}`}
            >
              {salvando ? <Loader2 className="animate-spin" /> : null}
              {!salvando && detalhe && transicao.destino && transicao.destino === (destinosPermitidosStatus(detalhe.status, detalhe.fornecedor?.chave === 'lebebe_exclusive' ? 'lebebe_exclusive' : 'moriah_tapetes')[0] ?? '')
                ? <>Avançar para {transicao.destino}<ArrowRight /></>
                : 'Confirmar transição'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
