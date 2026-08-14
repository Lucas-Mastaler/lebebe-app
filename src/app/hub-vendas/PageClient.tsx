'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import {
  RefreshCw, AlertTriangle, CheckCircle, Pause, Play, Save,
  Search, ChevronLeft, ChevronRight, X, Eye, AlertCircle,
  Bot, Clock, Hash, ShieldAlert, Loader2, Info,
  ExternalLink,
} from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type {
  StatusGestaoHubVendas,
  ResumoLojaHubVendas,
  ListagemFilasHubVendas,
  DetalheFilaHubVendas,
  ContagemPorLojaHubVendas,
} from '@/lib/digisac/hub-vendas/gestao'
import { formatarPercentualHubVendas, LIMITE_DIARIO_MAXIMO } from '@/lib/digisac/hub-vendas/gestao'
import { montarUrlHistoricoTicket } from '@/lib/digisac/urls'

const POLLING_INTERVAL_MS = 60_000

type LojaFiltro = '' | 'portao' | 'bigorrilho' | 'hauer_marechal'
type PeriodoHubVendas = { de: string; ate: string }
type FiltrosFilasHubVendas = {
  loja: LojaFiltro
  status: string
  cliente: string
  telefoneParcial: string
  somenteErros: boolean
  somenteAnaliseManual: boolean
  somenteResultadoIncerto: boolean
}

function adicionarPeriodo(params: URLSearchParams, periodo: PeriodoHubVendas | null) {
  if (!periodo) return
  params.set('dataInicio', periodo.de)
  params.set('dataFim', periodo.ate)
}

async function buscarStatusHubVendas(
  periodo: PeriodoHubVendas | null,
  somenteHistorico = false
): Promise<StatusGestaoHubVendas> {
  const params = new URLSearchParams()
  adicionarPeriodo(params, periodo)
  if (somenteHistorico) params.set('somenteHistorico', 'true')
  const sufixo = params.size > 0 ? `?${params.toString()}` : ''
  const res = await fetch(`/api/hub-vendas/status${sufixo}`)
  const data = await res.json()
  if (!res.ok || !data.ok) throw new Error(data.message || data.error || 'Erro ao carregar status')
  return data as StatusGestaoHubVendas
}

async function buscarFilasHubVendas(
  pagina: number,
  filtros: FiltrosFilasHubVendas,
  periodo: PeriodoHubVendas | null
): Promise<ListagemFilasHubVendas> {
  const params = new URLSearchParams()
  params.set('pagina', String(pagina))
  params.set('porPagina', '20')
  if (filtros.loja) params.set('loja', filtros.loja)
  if (filtros.status) params.set('status', filtros.status)
  if (filtros.cliente) params.set('cliente', filtros.cliente)
  if (filtros.telefoneParcial) params.set('telefoneParcial', filtros.telefoneParcial)
  if (filtros.somenteErros) params.set('somenteErros', 'true')
  if (filtros.somenteAnaliseManual) params.set('somenteAnaliseManual', 'true')
  if (filtros.somenteResultadoIncerto) params.set('somenteResultadoIncerto', 'true')
  adicionarPeriodo(params, periodo)

  const res = await fetch(`/api/hub-vendas/filas?${params.toString()}`)
  const data = await res.json()
  if (!res.ok || !data.ok) throw new Error(data.message || data.error || 'Erro ao carregar filas')
  return data as ListagemFilasHubVendas
}

function mesclarResumoHistorico(
  statusAtual: StatusGestaoHubVendas,
  statusHistorico: StatusGestaoHubVendas
): StatusGestaoHubVendas {
  return {
    ...statusAtual,
    resumo: {
      ...statusAtual.resumo,
      leadsRegistrados: statusHistorico.resumo.leadsRegistrados,
      candidatosElegiveis: statusHistorico.resumo.candidatosElegiveis,
      convertidos: statusHistorico.resumo.convertidos,
      convertidosPorLoja: statusHistorico.resumo.convertidosPorLoja,
      recuperacaoEnviadaTotal: statusHistorico.resumo.recuperacaoEnviadaTotal,
      recuperacaoEnviadaPorLoja: statusHistorico.resumo.recuperacaoEnviadaPorLoja,
      recuperados: statusHistorico.resumo.recuperados,
      recuperadosPorLoja: statusHistorico.resumo.recuperadosPorLoja,
      perdidos: statusHistorico.resumo.perdidos,
      perdidosPorLoja: statusHistorico.resumo.perdidosPorLoja,
      filaManual: statusHistorico.resumo.filaManual,
      enviadaHoje: statusHistorico.resumo.enviadaHoje,
    },
  }
}

export default function PageClient() {
  const [periodoRascunho, setPeriodoRascunho] = useState({ de: '', ate: '' })
  const [periodoAplicado, setPeriodoAplicado] = useState<PeriodoHubVendas | null>(null)
  const [carregandoPeriodo, setCarregandoPeriodo] = useState(false)
  const [erroPeriodo, setErroPeriodo] = useState<string | null>(null)
  const [status, setStatus] = useState<StatusGestaoHubVendas | null>(null)
  const [loadingStatus, setLoadingStatus] = useState(true)
  const [erroStatus, setErroStatus] = useState<string | null>(null)

  // Limite
  const [novoLimite, setNovoLimite] = useState('')
  const [salvandoLimite, setSalvandoLimite] = useState(false)
  const [feedbackLimite, setFeedbackLimite] = useState<{ tipo: 'sucesso' | 'erro'; texto: string } | null>(null)

  // Pausa/reativação
  const [modalPausa, setModalPausa] = useState(false)
  const [modalReativar, setModalReativar] = useState(false)
  const [motivoPausa, setMotivoPausa] = useState('')
  const [motivoReativar, setMotivoReativar] = useState('')
  const [processandoPausa, setProcessandoPausa] = useState(false)

  // Filas
  const [filas, setFilas] = useState<ListagemFilasHubVendas | null>(null)
  const [loadingFilas, setLoadingFilas] = useState(false)
  const [erroFilas, setErroFilas] = useState<string | null>(null)
  const [pagina, setPagina] = useState(1)
  const [filtros, setFiltros] = useState<FiltrosFilasHubVendas>({
    loja: '' as LojaFiltro,
    status: '',
    cliente: '',
    telefoneParcial: '',
    somenteErros: false,
    somenteAnaliseManual: false,
    somenteResultadoIncerto: false,
  })
  const debounceCliente = useRef<ReturnType<typeof setTimeout> | null>(null)
  const consultaPeriodoEmAndamento = useRef(false)
  const primeiraBuscaCliente = useRef(true)

  // Detalhe
  const [detalhe, setDetalhe] = useState<DetalheFilaHubVendas | null>(null)
  const [loadingDetalhe, setLoadingDetalhe] = useState(false)
  const [modalAcao, setModalAcao] = useState<{ filaId: string; acao: 'cancelar_agendada' | 'reprocessar_erro' | 'liberar_analise_manual'; titulo: string } | null>(null)
  const [motivoAcao, setMotivoAcao] = useState('')
  const [processandoAcao, setProcessandoAcao] = useState(false)

  // Alertas e resumo operacional
  const [alertas, setAlertas] = useState<{ total24h: number; ultimoAlertaEm: string | null; ultimoTipo: string | null; ultimos: Array<{ tipo: string; status: string; enviadoEm: string; chaveDeduplicacao: string }> }>({ total24h: 0, ultimoAlertaEm: null, ultimoTipo: null, ultimos: [] })
  const [statusResumo, setStatusResumo] = useState<{ ultimoResumoEm: string | null; ultimoResumoDataLocal: string | null; ultimoResumoStatus: string | null }>({ ultimoResumoEm: null, ultimoResumoDataLocal: null, ultimoResumoStatus: null })
  const [loadingAlertas, setLoadingAlertas] = useState(true)

  // Feedback visual dos botões de atualização (independentes)
  const [atualizandoStatus, setAtualizandoStatus] = useState(false)
  const [ultimaAtualizacaoStatus, setUltimaAtualizacaoStatus] = useState<string | null>(null)
  const [feedbackStatus, setFeedbackStatus] = useState<{ tipo: 'sucesso' | 'erro'; texto: string } | null>(null)
  const [atualizandoAlertas, setAtualizandoAlertas] = useState(false)
  const [ultimaAtualizacaoAlertas, setUltimaAtualizacaoAlertas] = useState<string | null>(null)
  const [feedbackAlertas, setFeedbackAlertas] = useState<{ tipo: 'sucesso' | 'erro'; texto: string } | null>(null)

  // Alerta de teste
  const [modalTesteAlerta, setModalTesteAlerta] = useState(false)
  const [enviandoTeste, setEnviandoTeste] = useState(false)
  const [feedbackTeste, setFeedbackTeste] = useState<{ tipo: 'sucesso' | 'erro'; texto: string } | null>(null)

  // ---------------------------------------------------------------------------
  // Carregamento de status
  // ---------------------------------------------------------------------------
  const carregarStatus = useCallback(async (manual = false) => {
    if (consultaPeriodoEmAndamento.current && !manual) return
    if (manual) {
      setAtualizandoStatus(true)
      setFeedbackStatus(null)
    }
    try {
      setErroStatus(null)
      const data = await buscarStatusHubVendas(periodoAplicado)
      setStatus(data)
      setNovoLimite((atual) => atual === '' ? String(data.parametros.limiteDiarioPorConexao) : atual)
      if (manual) {
        const agora = new Date()
        setUltimaAtualizacaoStatus(agora.toLocaleTimeString('pt-BR'))
        setFeedbackStatus({ tipo: 'sucesso', texto: 'Dados atualizados' })
      }
    } catch (error) {
      setErroStatus(error instanceof Error ? error.message : 'Erro de conexão ao carregar status')
      if (manual) setFeedbackStatus({ tipo: 'erro', texto: 'Não foi possível atualizar os dados' })
    } finally {
      setLoadingStatus(false)
      if (manual) setAtualizandoStatus(false)
    }
  }, [periodoAplicado])

  // ---------------------------------------------------------------------------
  // Carregamento de filas
  // ---------------------------------------------------------------------------
  const carregarFilas = useCallback(async (pag: number) => {
    if (consultaPeriodoEmAndamento.current) return
    setLoadingFilas(true)
    setErroFilas(null)
    try {
      setFilas(await buscarFilasHubVendas(pag, filtros, periodoAplicado))
    } catch (error) {
      setErroFilas(error instanceof Error ? error.message : 'Erro de conexão ao carregar filas')
    } finally {
      setLoadingFilas(false)
    }
  }, [filtros, periodoAplicado])

  // ---------------------------------------------------------------------------
  // Carregamento de alertas e resumo operacional
  // ---------------------------------------------------------------------------
  const carregarAlertas = useCallback(async (manual = false) => {
    if (manual) {
      setAtualizandoAlertas(true)
      setFeedbackAlertas(null)
    }
    try {
      const res = await fetch('/api/hub-vendas/alertas')
      const data = await res.json()
      if (data.ok) {
        setAlertas(data.alertas)
        if (manual) {
          const agora = new Date()
          setUltimaAtualizacaoAlertas(agora.toLocaleTimeString('pt-BR'))
        }
      } else if (manual) {
        setFeedbackAlertas({ tipo: 'erro', texto: 'Não foi possível atualizar os dados' })
      }
    } catch {
      if (manual) setFeedbackAlertas({ tipo: 'erro', texto: 'Não foi possível atualizar os dados' })
      // silencioso no automático — nao bloqueia a tela
    } finally {
      setLoadingAlertas(false)
      if (manual) setAtualizandoAlertas(false)
    }
  }, [])

  const carregarResumo = useCallback(async (manual = false) => {
    if (manual) {
      setAtualizandoAlertas(true)
    }
    try {
      const res = await fetch('/api/hub-vendas/resumo')
      const data = await res.json()
      if (data.ok) {
        setStatusResumo(data.resumo)
        if (manual) {
          const agora = new Date()
          setUltimaAtualizacaoAlertas(agora.toLocaleTimeString('pt-BR'))
          setFeedbackAlertas({ tipo: 'sucesso', texto: 'Dados atualizados' })
        }
      } else if (manual) {
        setFeedbackAlertas({ tipo: 'erro', texto: 'Não foi possível atualizar os dados' })
      }
    } catch {
      if (manual) setFeedbackAlertas({ tipo: 'erro', texto: 'Não foi possível atualizar os dados' })
      // silencioso no automático
    } finally {
      if (manual) setAtualizandoAlertas(false)
    }
  }, [])

  const carregarStatusAtual = useRef(carregarStatus)
  const carregarFilasAtual = useRef(carregarFilas)
  useEffect(() => {
    carregarStatusAtual.current = carregarStatus
    carregarFilasAtual.current = carregarFilas
  }, [carregarStatus, carregarFilas])

  // ---------------------------------------------------------------------------
  // Polling e carregamento inicial
  // ---------------------------------------------------------------------------
  useEffect(() => {
    carregarStatusAtual.current()
    carregarFilasAtual.current(1)
    carregarAlertas()
    carregarResumo()
    const interval = setInterval(() => {
      carregarStatusAtual.current()
    }, POLLING_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [carregarAlertas, carregarResumo])

  // Debounce para filtro de cliente
  useEffect(() => {
    if (primeiraBuscaCliente.current) {
      primeiraBuscaCliente.current = false
      return
    }
    if (debounceCliente.current) clearTimeout(debounceCliente.current)
    debounceCliente.current = setTimeout(() => {
      setPagina(1)
      carregarFilasAtual.current(1)
    }, 400)
    return () => {
      if (debounceCliente.current) clearTimeout(debounceCliente.current)
    }
  }, [filtros.cliente])

  // ---------------------------------------------------------------------------
  // Ações
  // ---------------------------------------------------------------------------
  async function atualizarPeriodo(periodo: PeriodoHubVendas | null) {
    if (consultaPeriodoEmAndamento.current) return false
    consultaPeriodoEmAndamento.current = true
    setCarregandoPeriodo(true)
    setErroPeriodo(null)
    try {
      const [novoStatus, novasFilas] = await Promise.all([
        buscarStatusHubVendas(periodo, true),
        buscarFilasHubVendas(1, filtros, periodo),
      ])
      setStatus((atual) => atual ? mesclarResumoHistorico(atual, novoStatus) : novoStatus)
      setNovoLimite((atual) => atual === '' ? String(novoStatus.parametros.limiteDiarioPorConexao) : atual)
      setFilas(novasFilas)
      setPagina(1)
      setPeriodoAplicado(periodo)
      return true
    } catch (error) {
      setErroPeriodo(error instanceof Error ? error.message : 'Não foi possível carregar os dados do período.')
      return false
    } finally {
      consultaPeriodoEmAndamento.current = false
      setCarregandoPeriodo(false)
    }
  }

  function aplicarPeriodo() {
    if (consultaPeriodoEmAndamento.current) return
    if (!periodoRascunho.de || !periodoRascunho.ate) {
      setErroPeriodo('Informe as datas De e Até.')
      return
    }
    if (periodoRascunho.de > periodoRascunho.ate) {
      setErroPeriodo('A data De não pode ser posterior à data Até.')
      return
    }
    void atualizarPeriodo({ ...periodoRascunho })
  }

  function limparPeriodo() {
    if (consultaPeriodoEmAndamento.current) return
    void atualizarPeriodo(null).then((limpezaAplicada) => {
      if (limpezaAplicada) setPeriodoRascunho({ de: '', ate: '' })
    })
  }

  async function atualizarFiltrosFila(proximosFiltros: FiltrosFilasHubVendas) {
    if (consultaPeriodoEmAndamento.current) return
    setFiltros(proximosFiltros)
    setPagina(1)
    setLoadingFilas(true)
    setErroFilas(null)
    try {
      setFilas(await buscarFilasHubVendas(1, proximosFiltros, periodoAplicado))
    } catch (error) {
      setErroFilas(error instanceof Error ? error.message : 'Erro de conexão ao carregar filas')
    } finally {
      setLoadingFilas(false)
    }
  }

  async function salvarLimite() {
    setSalvandoLimite(true)
    setFeedbackLimite(null)
    try {
      const res = await fetch('/api/hub-vendas/limite', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ limite: Number(novoLimite), confirmado: true }),
      })
      const data = await res.json()
      if (data.ok) {
        setFeedbackLimite({ tipo: 'sucesso', texto: `Limite alterado de ${data.valorAnterior} para ${data.valorNovo}. Próximos ciclos usarão o novo valor.` })
        carregarStatus()
      } else {
        setFeedbackLimite({ tipo: 'erro', texto: data.message || data.error || 'Erro ao salvar limite' })
      }
    } catch {
      setFeedbackLimite({ tipo: 'erro', texto: 'Erro de conexão ao salvar limite' })
    } finally {
      setSalvandoLimite(false)
    }
  }

  async function confirmarPausa() {
    setProcessandoPausa(true)
    try {
      const res = await fetch('/api/hub-vendas/pausar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ motivo: motivoPausa, confirmado: true }),
      })
      const data = await res.json()
      if (data.ok) {
        setModalPausa(false)
        setMotivoPausa('')
        carregarStatus()
      }
    } catch {
      // erro silencioso, modal continua
    } finally {
      setProcessandoPausa(false)
    }
  }

  async function confirmarReativar() {
    setProcessandoPausa(true)
    try {
      const res = await fetch('/api/hub-vendas/reativar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ motivo: motivoReativar, confirmado: true }),
      })
      const data = await res.json()
      if (data.ok) {
        setModalReativar(false)
        setMotivoReativar('')
        carregarStatus()
      }
    } catch {
      // erro silencioso
    } finally {
      setProcessandoPausa(false)
    }
  }

  async function abrirDetalhe(filaId: string) {
    setLoadingDetalhe(true)
    setDetalhe(null)
    try {
      const res = await fetch(`/api/hub-vendas/filas/${filaId}`)
      const data = await res.json()
      if (data.ok) {
        setDetalhe(data)
      }
    } catch {
      // erro silencioso
    } finally {
      setLoadingDetalhe(false)
    }
  }

  async function executarAcaoManual() {
    if (!modalAcao) return
    setProcessandoAcao(true)
    try {
      const res = await fetch(`/api/hub-vendas/filas/${modalAcao.filaId}/acao`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acao: modalAcao.acao, motivo: motivoAcao, confirmado: true }),
      })
      const data = await res.json()
      if (data.ok) {
        setModalAcao(null)
        setMotivoAcao('')
        if (detalhe) abrirDetalhe(detalhe.fila.id)
        carregarFilas(pagina)
        carregarStatus()
      }
    } catch {
      // erro silencioso
    } finally {
      setProcessandoAcao(false)
    }
  }

  async function enviarTesteAlerta() {
    setEnviandoTeste(true)
    setFeedbackTeste(null)
    try {
      const res = await fetch('/api/hub-vendas/alertas/teste', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      const data = await res.json()
      if (data.ok) {
        setModalTesteAlerta(false)
        setFeedbackTeste({
          tipo: 'sucesso',
          texto: data.deduplicado
            ? 'Alerta de teste deduplicado (aguarde 1 minuto para novo teste)'
            : 'Alerta de teste enviado',
        })
        // Atualizar lista de alertas automaticamente
        carregarAlertas(true)
        carregarResumo(true)
      } else {
        setFeedbackTeste({ tipo: 'erro', texto: data.error || 'Falha ao enviar alerta de teste' })
      }
    } catch {
      setFeedbackTeste({ tipo: 'erro', texto: 'Erro de conexão ao enviar alerta de teste' })
    } finally {
      setEnviandoTeste(false)
    }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  if (loadingStatus && !status) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    )
  }

  if (erroStatus && !status) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <AlertCircle className="w-10 h-10 text-red-500" />
        <p className="text-slate-600">{erroStatus}</p>
        <button onClick={() => carregarStatus()} className="px-4 py-2 bg-slate-100 rounded-lg hover:bg-slate-200 text-sm">
          Tentar novamente
        </button>
      </div>
    )
  }

  if (!status) return null

  const automacaoAtiva = status.automacao.ativa && !status.automacao.pausada

  return (
    <div className="flex flex-col space-y-6 p-4 md:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="bg-sky-50 p-2.5 rounded-xl">
            <Bot className="w-6 h-6 text-sky-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800">Gestão Hub/Vendas</h1>
            <p className="text-sm text-slate-500">Monitoramento e configuração da automação</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <button
            onClick={() => { carregarStatus(true); carregarFilas(pagina) }}
            disabled={atualizandoStatus}
            className="flex items-center gap-2 px-4 py-2 bg-slate-100 rounded-lg hover:bg-slate-200 text-sm font-medium text-slate-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`w-4 h-4 ${atualizandoStatus ? 'animate-spin' : ''}`} />
            {atualizandoStatus ? 'Atualizando...' : 'Atualizar agora'}
          </button>
          {ultimaAtualizacaoStatus && (
            <span className="text-xs text-slate-400">Atualizado às {ultimaAtualizacaoStatus}</span>
          )}
          {feedbackStatus && (
            <span className={`text-xs ${feedbackStatus.tipo === 'sucesso' ? 'text-green-600' : 'text-red-600'}`}>
              {feedbackStatus.texto}
            </span>
          )}
        </div>
      </div>

      {/* Filtro global de período — sem valor padrão para preservar o comportamento atual. */}
      <section className="order-1 bg-white border border-slate-200 rounded-xl p-4">
        <div className="flex flex-col md:flex-row md:items-end gap-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 flex-1 max-w-xl">
            <label className="text-xs text-slate-500">
              <span className="block mb-1">De</span>
              <input
                type="date"
                value={periodoRascunho.de}
                onChange={(e) => setPeriodoRascunho((atual) => ({ ...atual, de: e.target.value }))}
                disabled={carregandoPeriodo}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              />
            </label>
            <label className="text-xs text-slate-500">
              <span className="block mb-1">Até</span>
              <input
                type="date"
                value={periodoRascunho.ate}
                onChange={(e) => setPeriodoRascunho((atual) => ({ ...atual, ate: e.target.value }))}
                disabled={carregandoPeriodo}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              />
            </label>
          </div>
          <div className="flex gap-2">
            <button
              onClick={aplicarPeriodo}
              disabled={carregandoPeriodo}
              className="inline-flex items-center gap-2 px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {carregandoPeriodo && <Loader2 className="w-4 h-4 animate-spin" />}
              {carregandoPeriodo ? 'Carregando...' : 'Aplicar'}
            </button>
            {periodoAplicado && (
              <button
                onClick={limparPeriodo}
                disabled={carregandoPeriodo}
                className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed"
              >
                Limpar
              </button>
            )}
          </div>
        </div>
        {erroPeriodo && <p className="text-xs text-red-600 mt-2">{erroPeriodo}</p>}
        {carregandoPeriodo && <p className="text-xs text-slate-500 mt-2" role="status">Carregando dados do período...</p>}
        {periodoAplicado && !erroPeriodo && !carregandoPeriodo && (
          <p className="text-xs text-sky-700 mt-2">
            Período aplicado: {formatarDataBrasileira(periodoAplicado.de)} até {formatarDataBrasileira(periodoAplicado.ate)} · America/Sao_Paulo
          </p>
        )}
      </section>

      <div className="order-1 px-4 py-2 bg-amber-50 border border-amber-100 rounded-xl text-xs font-medium text-amber-700">
        Dados confiáveis a partir de 13/08/2026
      </div>

      {/* Estado geral da automação */}
      <section className="order-4 bg-white border border-slate-200 rounded-xl p-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-xl ${automacaoAtiva ? 'bg-green-50' : 'bg-amber-50'}`}>
              {automacaoAtiva ? (
                <CheckCircle className="w-7 h-7 text-green-600" />
              ) : (
                <Pause className="w-7 h-7 text-amber-600" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold text-slate-800">
                  {automacaoAtiva ? 'Automação ativa' : 'Automação pausada'}
                </span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${automacaoAtiva ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                  {automacaoAtiva ? 'EM EXECUÇÃO' : 'PAUSADA'}
                </span>
              </div>
              {status.automacao.motivo && (
                <p className="text-sm text-slate-500 mt-0.5">Motivo: {status.automacao.motivo}</p>
              )}
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-xs text-slate-400">
                {status.automacao.atualizadoEm && (
                  <span>Atualizado: {formatarData(status.automacao.atualizadoEm)}</span>
                )}
                {status.ultimoProcessamento && (
                  <span>Último processamento: {formatarData(status.ultimoProcessamento)}</span>
                )}
                <span>Timezone: {status.parametros.timezone}</span>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            {automacaoAtiva ? (
              <button
                onClick={() => setModalPausa(true)}
                className="flex items-center gap-2 px-4 py-2 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 text-sm font-medium text-amber-700 transition-colors"
              >
                <Pause className="w-4 h-4" />
                Pausar automação
              </button>
            ) : (
              <button
                onClick={() => setModalReativar(true)}
                className="flex items-center gap-2 px-4 py-2 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 text-sm font-medium text-green-700 transition-colors"
              >
                <Play className="w-4 h-4" />
                Reativar automação
              </button>
            )}
          </div>
        </div>

        {/* Parâmetros */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mt-4 pt-4 border-t border-slate-100">
          <ParametroItem icon={<Hash className="w-4 h-4" />} label="Limite por execução" valor={String(status.parametros.limitePorExecucao)} />
          <ParametroItem icon={<Hash className="w-4 h-4" />} label="Limite diário/loja" valor={String(status.parametros.limiteDiarioPorConexao)} />
          <ParametroItem icon={<Clock className="w-4 h-4" />} label="Timeout reserva" valor={`${status.parametros.reservaTimeoutMinutos}min`} />
          <ParametroItem icon={<Clock className="w-4 h-4" />} label="Timeout envio" valor={`${status.parametros.envioTimeoutMinutos}min`} />
          <ParametroItem
            icon={<CheckCircle className="w-4 h-4" />}
            label="Ativação gradual"
            valor={status.parametros.modoAtivacaoGradual ? 'Sim' : 'Não'}
          />
          <ParametroItem icon={<Clock className="w-4 h-4" />} label="Timezone" valor={status.parametros.timezone} />
        </div>
      </section>

      {/* Resultados da coorte de leads */}
      <section className="order-1">
        <div className="mb-3">
          <h2 className="text-sm font-semibold text-slate-700">
            {periodoAplicado ? 'Resultados dos leads do período' : 'Resultados dos leads'}
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            {periodoAplicado
              ? 'Considera quem entrou no Hub no período selecionado e mostra o estado atual desses mesmos leads.'
              : 'Considera todos os leads registrados e mostra o estado atual de cada um.'}
          </p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <CardResumo
          label="Leads registrados"
          valor={status.resumo.leadsRegistrados}
          cor="neutro"
          tooltip="Total de clientes que já entraram em contato pela nossa Central de Atendimento."
        />
        <CardResumo
          label="Candidatos elegíveis"
          valor={status.resumo.candidatosElegiveis}
          cor="sky"
          tooltip="Clientes que ainda podem receber uma mensagem de recuperação."
          percentual={formatarPercentualHubVendas(status.resumo.candidatosElegiveis, status.resumo.leadsRegistrados)}
        />
        <CardResumo
          label="Convertidos organicamente"
          valor={status.resumo.convertidos}
          cor="green"
          detalhe={formatarDetalhePorLoja(status.resumo.convertidosPorLoja)}
          tooltip="Clientes que procuraram uma das lojas por conta própria, antes de receber uma mensagem de recuperação."
          percentual={formatarPercentualHubVendas(status.resumo.convertidos, status.resumo.leadsRegistrados)}
        />
        <CardResumo
          label="Recuperação enviada / aguardando"
          valor={status.resumo.recuperacaoEnviadaTotal}
          cor="cyan"
          detalhe={formatarDetalhePorLoja(status.resumo.recuperacaoEnviadaPorLoja)}
          tooltip="Clientes que receberam nossa mensagem de recuperação e ainda estão dentro do prazo para responder."
          percentual={formatarPercentualHubVendas(status.resumo.recuperacaoEnviadaTotal, status.resumo.leadsRegistrados)}
        />
        <CardResumo
          label="Recuperados"
          valor={status.resumo.recuperados}
          cor="green"
          detalhe={formatarDetalhePorLoja(status.resumo.recuperadosPorLoja)}
          tooltip="Clientes que responderam depois de receber nossa mensagem de recuperação."
          percentual={formatarPercentualHubVendas(status.resumo.recuperados, status.resumo.leadsRegistrados)}
        />
        <CardResumo
          label="Perdidos"
          valor={status.resumo.perdidos}
          cor="neutro"
          detalhe={formatarDetalhePorLoja(status.resumo.perdidosPorLoja)}
          tooltip="Clientes que receberam a mensagem de recuperação, mas não responderam dentro do prazo."
          percentual={formatarPercentualHubVendas(status.resumo.perdidos, status.resumo.leadsRegistrados)}
        />
        <CardResumo
          label="Fila manual"
          valor={status.resumo.filaManual}
          cor="amber"
          tooltip="Clientes que poderiam receber recuperação, mas não entraram na fila dentro do prazo."
          percentual={formatarPercentualHubVendas(status.resumo.filaManual, status.resumo.leadsRegistrados)}
        />
        </div>
      </section>

      <section className="order-1">
        <div className="mb-3">
          <h2 className="text-sm font-semibold text-slate-700">{periodoAplicado ? 'Movimentação no período' : 'Movimentação atual'}</h2>
          <p className="text-xs text-slate-500 mt-1">{periodoAplicado ? 'Envios e filas programados no período selecionado.' : 'Envios realizados hoje e filas programadas.'}</p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <CardResumo
          label={periodoAplicado ? 'Enviados no período' : 'Enviados hoje'}
          valor={status.resumo.enviadaHoje}
          cor="green"
          tooltip={periodoAplicado ? 'Quantidade de mensagens de recuperação enviadas no período selecionado.' : 'Quantidade de mensagens de recuperação enviadas hoje.'}
        />
        </div>
      </section>

      <section className="order-1">
        <div className="mb-3">
          <h2 className="text-sm font-semibold text-slate-700">Operação atual</h2>
          <p className="text-xs text-slate-500 mt-1">Estado atual das filas, limites e alertas da automação, independente do período selecionado.</p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <CardResumo
          label="Filas agendadas"
          valor={status.resumo.agendada}
          cor="blue"
          tooltip="Clientes com mensagem de recuperação programada, aguardando o horário de envio."
        />
        <CardResumo
          label="Filas reservadas"
          valor={status.resumo.reservada}
          cor="indigo"
          tooltip="Mensagens de recuperação que estão prestes a ser enviadas neste momento."
        />
        <CardResumo
          label="Enviando"
          valor={status.resumo.enviando}
          cor="cyan"
          tooltip="Mensagens de recuperação sendo enviadas agora."
        />
        <CardResumo
          label="Canceladas"
          valor={status.resumo.cancelada}
          cor="neutro"
          tooltip="Envios de recuperação cancelados, geralmente porque o cliente já tinha sido atendido antes do envio."
        />
        <CardResumo
          label="Erros"
          valor={status.resumo.erro}
          cor="red"
          destaque={status.resumo.erro > 0}
          tooltip="Envios de recuperação que falharam e precisam de atenção."
        />
        <CardResumo
          label="Resultado incerto"
          valor={status.resumo.resultadoIncerto}
          cor="amber"
          destaque={status.resumo.resultadoIncerto > 0}
          tooltip="Envios de recuperação cujo resultado não pôde ser confirmado automaticamente."
        />
        <CardResumo
          label="Análise manual"
          valor={status.resumo.analiseManual}
          cor="violet"
          destaque={status.resumo.analiseManual > 0}
          tooltip="Casos que precisam ser conferidos manualmente pela equipe."
        />
        </div>
      </section>

      {status.resumo.conexoesPausadas > 0 && (
        <div className="order-1 flex items-center gap-2 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
          <ShieldAlert className="w-5 h-5 flex-shrink-0" />
          <span>{status.resumo.conexoesPausadas} conexão(ões) pausada(s) por erro automático.</span>
        </div>
      )}

      {/* Alertas e resumo operacional */}
      <section className="order-5 bg-white border border-slate-200 rounded-xl p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
          <h2 className="text-sm font-semibold text-slate-700">Alertas e resumo operacional</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { carregarAlertas(true); carregarResumo(true) }}
              disabled={atualizandoAlertas}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 rounded-lg hover:bg-slate-200 text-xs font-medium text-slate-600 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${atualizandoAlertas ? 'animate-spin' : ''}`} />
              {atualizandoAlertas ? 'Atualizando...' : 'Atualizar'}
            </button>
            <button
              onClick={() => { setFeedbackTeste(null); setModalTesteAlerta(true) }}
              disabled={enviandoTeste}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-50 border border-sky-200 rounded-lg hover:bg-sky-100 text-xs font-medium text-sky-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              Enviar alerta de teste
            </button>
          </div>
        </div>
        {(ultimaAtualizacaoAlertas || feedbackAlertas) && (
          <div className="flex items-center gap-3 mb-3 text-xs">
            {ultimaAtualizacaoAlertas && (
              <span className="text-slate-400">Atualizado às {ultimaAtualizacaoAlertas}</span>
            )}
            {feedbackAlertas && (
              <span className={feedbackAlertas.tipo === 'sucesso' ? 'text-green-600' : 'text-red-600'}>
                {feedbackAlertas.texto}
              </span>
            )}
          </div>
        )}
        {feedbackTeste && (
          <div className={`mb-3 px-3 py-2 rounded-lg text-xs ${feedbackTeste.tipo === 'sucesso' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
            {feedbackTeste.texto}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Resumo diário */}
          <div className="border border-slate-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-slate-400" />
              <span className="text-xs font-semibold text-slate-600">Resumo diário</span>
            </div>
            {loadingAlertas ? (
              <div className="text-xs text-slate-400">Carregando...</div>
            ) : statusResumo.ultimoResumoEm ? (
              <div className="space-y-1 text-xs">
                <div className="text-slate-700">
                  <span className="text-slate-400">Data:</span> {statusResumo.ultimoResumoDataLocal ?? '—'}
                </div>
                <div className="text-slate-700">
                  <span className="text-slate-400">Enviado:</span> {formatarData(statusResumo.ultimoResumoEm)}
                </div>
                <div className="text-slate-700">
                  <span className="text-slate-400">Status:</span>{' '}
                  <span className={statusResumo.ultimoResumoStatus === 'enviado' ? 'text-green-600' : 'text-red-600'}>
                    {statusResumo.ultimoResumoStatus ?? '—'}
                  </span>
                </div>
              </div>
            ) : (
              <div className="text-xs text-slate-400">Nenhum resumo enviado ainda.</div>
            )}
          </div>

          {/* Alertas 24h */}
          <div className="border border-slate-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="w-4 h-4 text-slate-400" />
              <span className="text-xs font-semibold text-slate-600">Alertas (24h)</span>
            </div>
            {loadingAlertas ? (
              <div className="text-xs text-slate-400">Carregando...</div>
            ) : (
              <div className="space-y-1 text-xs">
                <div className="text-2xl font-bold text-slate-800">{alertas.total24h}</div>
                {alertas.ultimoAlertaEm && (
                  <div className="text-slate-500">
                    Último: {formatarData(alertas.ultimoAlertaEm)}
                  </div>
                )}
                {alertas.ultimoTipo && (
                  <div className="text-slate-500">
                    Tipo: {alertas.ultimoTipo}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Estado saudável */}
          <div className="border border-slate-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="w-4 h-4 text-slate-400" />
              <span className="text-xs font-semibold text-slate-600">Estado operacional</span>
            </div>
            <div className="text-xs">
              {alertas.total24h === 0 && status.resumo.erro === 0 && status.resumo.resultadoIncerto === 0 ? (
                <span className="text-green-600 font-medium">✅ Saudável</span>
              ) : (
                <span className="text-amber-600 font-medium">⚠️ Com atenção</span>
              )}
            </div>
          </div>
        </div>

        {/* Alertas recentes */}
        {alertas.ultimos.length > 0 && (
          <div className="mt-4 pt-4 border-t border-slate-100">
            <h3 className="text-xs font-semibold text-slate-600 mb-2">Alertas recentes</h3>
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {alertas.ultimos.map((alerta, i) => (
                <div key={i} className="flex items-center gap-2 text-xs text-slate-600">
                  <span className={`px-1.5 py-0.5 rounded font-medium ${
                    alerta.status === 'enviado' ? 'bg-green-50 text-green-700' :
                    alerta.status === 'deduplicado' ? 'bg-slate-50 text-slate-500' :
                    'bg-red-50 text-red-700'
                  }`}>
                    {alerta.status}
                  </span>
                  <span className="font-medium">{alerta.tipo}</span>
                  <span className="text-slate-400">{formatarData(alerta.enviadoEm)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Cards por loja */}
      <section className="order-2">
        <h2 className="text-sm font-semibold text-slate-700 mb-3">Por loja</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {status.lojas.map((loja) => (
            <CardLoja key={loja.loja} loja={loja} />
          ))}
        </div>
      </section>

      {/* Configuração do limite */}
      <section className="order-6 bg-white border border-slate-200 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-slate-700 mb-3">Limite diário por loja</h2>
        <div className="flex flex-col sm:flex-row sm:items-end gap-3">
          <div className="flex-1 max-w-xs">
            <label className="block text-xs text-slate-500 mb-1">Valor (aplicado a cada loja)</label>
            <input
              type="number"
              min={0}
              max={LIMITE_DIARIO_MAXIMO}
              value={novoLimite}
              onChange={(e) => setNovoLimite(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
              placeholder="Ex: 10"
            />
            <p className="text-xs text-slate-400 mt-1">
              Este limite é aplicado individualmente a cada loja. Exemplo: limite 10 permite até 10 envios em Portão, 10 em Bigorrilho e 10 em Hauer por dia. Máximo seguro: {LIMITE_DIARIO_MAXIMO}.
            </p>
          </div>
          <button
            onClick={salvarLimite}
            disabled={salvandoLimite || novoLimite === String(status.parametros.limiteDiarioPorConexao)}
            className="flex items-center gap-2 px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-colors"
          >
            {salvandoLimite ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Salvar limite
          </button>
        </div>
        {feedbackLimite && (
          <div className={`mt-3 px-3 py-2 rounded-lg text-sm ${feedbackLimite.tipo === 'sucesso' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
            {feedbackLimite.texto}
          </div>
        )}
      </section>

      {/* Filtros + Tabela de filas */}
      <section className="order-3 bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-slate-700 mb-1">{periodoAplicado ? 'Filas e envios do período' : 'Filas e envios'}</h2>
          <p className="text-xs text-slate-500 mb-3">As filas usam a data programada; os envios usam a data de envio.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <select
              value={filtros.loja}
              onChange={(e) => { void atualizarFiltrosFila({ ...filtros, loja: e.target.value as LojaFiltro }) }}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
            >
              <option value="">Todas as lojas</option>
              <option value="portao">Portão</option>
              <option value="bigorrilho">Bigorrilho</option>
              <option value="hauer_marechal">Hauer</option>
            </select>
            <select
              value={filtros.status}
              onChange={(e) => { void atualizarFiltrosFila({ ...filtros, status: e.target.value }) }}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
            >
              <option value="">Todos os status</option>
              <option value="agendado">Agendado</option>
              <option value="reservado">Reservado</option>
              <option value="enviando">Enviando</option>
              <option value="enviado">Enviado</option>
              <option value="erro">Erro</option>
              <option value="resultado_incerto">Resultado incerto</option>
              <option value="analise_manual">Análise manual</option>
              <option value="cancelado">Cancelado</option>
            </select>
            <input
              type="text"
              placeholder="Cliente (nome)"
              value={filtros.cliente}
              onChange={(e) => setFiltros({ ...filtros, cliente: e.target.value })}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
            />
            <input
              type="text"
              placeholder="Telefone parcial"
              value={filtros.telefoneParcial}
              onChange={(e) => { void atualizarFiltrosFila({ ...filtros, telefoneParcial: e.target.value }) }}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
            />
          </div>
          <div className="flex flex-wrap gap-4 mt-3">
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input type="checkbox" checked={filtros.somenteErros} onChange={(e) => { void atualizarFiltrosFila({ ...filtros, somenteErros: e.target.checked }) }} />
              Somente erros
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input type="checkbox" checked={filtros.somenteAnaliseManual} onChange={(e) => { void atualizarFiltrosFila({ ...filtros, somenteAnaliseManual: e.target.checked }) }} />
              Análise manual
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input type="checkbox" checked={filtros.somenteResultadoIncerto} onChange={(e) => { void atualizarFiltrosFila({ ...filtros, somenteResultadoIncerto: e.target.checked }) }} />
              Resultado incerto
            </label>
          </div>
        </div>

        {/* Tabela */}
        {loadingFilas ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
          </div>
        ) : erroFilas ? (
          <div className="flex items-center justify-center py-12 text-red-600 text-sm">{erroFilas}</div>
        ) : !filas || filas.filas.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-400">
            <Search className="w-8 h-8 mb-2" />
            <p className="text-sm">Nenhuma fila encontrada</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-600 text-xs uppercase">
                  <tr>
                    <th className="px-3 py-2 text-left">Data/hora</th>
                    <th className="px-3 py-2 text-left">Cliente</th>
                    <th className="px-3 py-2 text-left">Telefone</th>
                    <th className="px-3 py-2 text-left">Loja</th>
                    <th className="px-3 py-2 text-left">Status</th>
                    <th className="px-3 py-2 text-left">Protocolo Venda</th>
                    <th className="px-3 py-2 text-left">Protocolo Recuperação</th>
                    <th className="px-3 py-2 text-left">Tent.</th>
                    <th className="px-3 py-2 text-left">Erro</th>
                    <th className="px-3 py-2 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filas.filas.map((fila) => (
                    <tr key={fila.id} className="hover:bg-slate-50">
                      <td className="px-3 py-2 text-xs text-slate-600 whitespace-nowrap">{formatarData(fila.programadoPara)}</td>
                      <td className="px-3 py-2 text-slate-700">{fila.nomeContatoHub || '—'}</td>
                      <td className="px-3 py-2 text-slate-600 text-xs font-mono">{fila.telefoneMascarado || '—'}</td>
                      <td className="px-3 py-2 text-slate-600">{fila.conexaoDestinoNome || fila.loja || '—'}</td>
                      <td className="px-3 py-2"><BadgeStatus status={fila.status} /></td>
                      <td className="px-3 py-2 text-xs font-mono whitespace-nowrap">
                        {fila.digisacProtocoloHub && fila.digisacTicketIdHub ? (
                          <a
                            href={montarUrlHistoricoTicket(fila.digisacTicketIdHub)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 hover:underline"
                          >
                            {fila.digisacProtocoloHub}
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        ) : '—'}
                      </td>
                      <td className="px-3 py-2 text-xs font-mono whitespace-nowrap">
                        {fila.digisacProtocolo && fila.digisacTicketId ? (
                          <a
                            href={montarUrlHistoricoTicket(fila.digisacTicketId)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 hover:underline"
                          >
                            {fila.digisacProtocolo}
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        ) : '—'}
                      </td>
                      <td className="px-3 py-2 text-center text-slate-600">{fila.tentativasEnvio}</td>
                      <td className="px-3 py-2 text-xs text-red-600 max-w-[200px] truncate" title={fila.erro || ''}>{fila.erro || '—'}</td>
                      <td className="px-3 py-2 text-center">
                        <button onClick={() => abrirDetalhe(fila.id)} className="p-1.5 hover:bg-slate-200 rounded-lg" title="Ver detalhes">
                          <Eye className="w-4 h-4 text-slate-500" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Paginação */}
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 text-sm">
              <span className="text-slate-500">
                {filas.total} registro(s) — Página {filas.pagina} de {filas.totalPaginas}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => { const p = Math.max(1, pagina - 1); setPagina(p); carregarFilas(p) }}
                  disabled={pagina <= 1}
                  className="p-1.5 border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => { const p = Math.min(filas.totalPaginas, pagina + 1); setPagina(p); carregarFilas(p) }}
                  disabled={pagina >= filas.totalPaginas}
                  className="p-1.5 border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </>
        )}
      </section>

      {/* Modal Pausa */}
      {modalPausa && (
        <ModalConfirmacao
          titulo="Pausar automação"
          descricao="A automação será pausada. Os crons da VPS continuarão executando mas não processarão filas. Filas já agendadas não serão canceladas."
          motivo={motivoPausa}
          setMotivo={setMotivoPausa}
          processando={processandoPausa}
          onConfirmar={confirmarPausa}
          onCancelar={() => { setModalPausa(false); setMotivoPausa('') }}
          corBotao="amber"
          textoBotao="Pausar"
        />
      )}

      {/* Modal Reativar */}
      {modalReativar && (
        <ModalConfirmacao
          titulo="Reativar automação"
          descricao="A automação será reativada. Os metadados de pausa serão limpos. Os próximos ciclos da VPS retomarão o processamento normalmente."
          motivo={motivoReativar}
          setMotivo={setMotivoReativar}
          processando={processandoPausa}
          onConfirmar={confirmarReativar}
          onCancelar={() => { setModalReativar(false); setMotivoReativar('') }}
          corBotao="green"
          textoBotao="Reativar"
        />
      )}

      {/* Modal Detalhe */}
      {detalhe && (
        <ModalDetalhe detalhe={detalhe} onClose={() => setDetalhe(null)} onAcao={(acao, titulo) => { setModalAcao({ filaId: detalhe.fila.id, acao, titulo }); setMotivoAcao('') }} />
      )}

      {/* Loading detalhe */}
      {loadingDetalhe && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <Loader2 className="w-8 h-8 animate-spin text-white" />
        </div>
      )}

      {/* Modal Ação Manual */}
      {modalAcao && (
        <ModalConfirmacao
          titulo={modalAcao.titulo}
          descricao="Confirme a ação manual. Esta operação será registrada na auditoria."
          motivo={motivoAcao}
          setMotivo={setMotivoAcao}
          processando={processandoAcao}
          onConfirmar={executarAcaoManual}
          onCancelar={() => { setModalAcao(null); setMotivoAcao('') }}
          corBotao="red"
          textoBotao="Confirmar"
        />
      )}

      {/* Modal Teste de Alerta */}
      {modalTesteAlerta && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-sky-50 p-2 rounded-lg">
                <ShieldAlert className="w-5 h-5 text-sky-600" />
              </div>
              <h3 className="text-base font-bold text-slate-800">Enviar alerta de teste</h3>
            </div>
            <p className="text-sm text-slate-600 mb-4">
              Enviar um alerta de teste para o contato técnico do Hub/Vendas? Esta ação não afeta clientes ou filas.
            </p>
            <ul className="text-xs text-slate-500 space-y-1 mb-5">
              <li>• A mensagem será enviada apenas ao contato técnico</li>
              <li>• Não será enviada para cliente</li>
              <li>• Nenhuma fila será criada</li>
              <li>• Nenhum lead será alterado</li>
              <li>• Nenhum limite será alterado</li>
              <li>• A automação não será pausada</li>
            </ul>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => { setModalTesteAlerta(false) }}
                disabled={enviandoTeste}
                className="px-4 py-2 bg-slate-100 rounded-lg hover:bg-slate-200 text-sm font-medium text-slate-700 transition-colors disabled:opacity-60"
              >
                Cancelar
              </button>
              <button
                onClick={enviarTesteAlerta}
                disabled={enviandoTeste}
                className="flex items-center gap-2 px-4 py-2 bg-sky-600 rounded-lg hover:bg-sky-700 text-sm font-medium text-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {enviandoTeste ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Enviando teste...
                  </>
                ) : (
                  <>
                    <ShieldAlert className="w-4 h-4" />
                    Enviar teste
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Subcomponentes
// ---------------------------------------------------------------------------

function ParametroItem({ icon, label, valor }: { icon: React.ReactNode; label: string; valor: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-slate-400">{icon}</span>
      <div>
        <p className="text-xs text-slate-400">{label}</p>
        <p className="text-sm font-medium text-slate-700">{valor}</p>
      </div>
    </div>
  )
}

function formatarDetalhePorLoja(porLoja: ContagemPorLojaHubVendas[]): string {
  return porLoja.map((item) => `${item.nomeExibicao} ${item.total}`).join(' · ')
}

function CardResumo({
  label,
  valor,
  cor,
  destaque,
  detalhe,
  tooltip,
  percentual,
}: {
  label: string
  valor: number
  cor: string
  destaque?: boolean
  detalhe?: string
  percentual?: string
  tooltip?: string
}) {
  const cores: Record<string, string> = {
    neutro: 'bg-white border border-slate-200 text-slate-700',
    slate: 'bg-slate-50 text-slate-700',
    sky: 'bg-sky-50 text-sky-700',
    green: 'bg-green-50 text-green-700',
    blue: 'bg-blue-50 text-blue-700',
    indigo: 'bg-indigo-50 text-indigo-700',
    cyan: 'bg-cyan-50 text-cyan-700',
    red: 'bg-red-50 text-red-700',
    amber: 'bg-amber-50 text-amber-700',
    violet: 'bg-violet-50 text-violet-700',
  }
  return (
    <div className={`rounded-xl p-3 ${cores[cor] ?? cores.slate} ${destaque ? 'ring-2 ring-offset-1 ring-red-200' : ''}`}>
      <div className="flex items-center gap-1">
        <p className="text-xs opacity-70">{label}</p>
        {tooltip && <InfoTooltip label={label} texto={tooltip} />}
      </div>
      <p className="text-2xl font-bold mt-0.5">{valor}</p>
      {percentual && <p className="text-[11px] opacity-60 leading-tight">{percentual}</p>}
      {detalhe && <p className="text-[11px] opacity-60 mt-1 truncate" title={detalhe}>{detalhe}</p>}
    </div>
  )
}

/**
 * Ícone de ajuda com tooltip explicativo do KPI. O Radix Tooltip (ui/tooltip.tsx) é
 * hover-first e ignora touch por design (fecha ao toque em vez de abrir). Para funcionar
 * em mobile, o estado é controlado manualmente e o toque é interceptado na fase de captura
 * (antes de chegar no botão do Radix), evitando que o pointerdown/click internos do Radix
 * fechem o tooltip que acabamos de abrir. Mouse continua usando o hover nativo do Radix.
 */
function InfoTooltip({ label, texto }: { label: string; texto: string }) {
  const [open, setOpen] = useState(false)
  const vindoDeToqueRef = useRef(false)

  return (
    <span
      className="inline-flex shrink-0"
      onPointerDownCapture={(e) => {
        if (e.pointerType === 'touch') {
          vindoDeToqueRef.current = true
          e.stopPropagation()
          setOpen((atual) => !atual)
        }
      }}
      onClickCapture={(e) => {
        if (vindoDeToqueRef.current) {
          vindoDeToqueRef.current = false
          e.stopPropagation()
        }
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <Tooltip open={open} onOpenChange={setOpen}>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="shrink-0 opacity-50 hover:opacity-90 focus-visible:opacity-90 outline-none"
            aria-label={`O que significa ${label}`}
          >
            <Info className="w-3 h-3" />
          </button>
        </TooltipTrigger>
        <TooltipContent className="max-w-[220px] text-xs">{texto}</TooltipContent>
      </Tooltip>
    </span>
  )
}

function CardLoja({ loja }: { loja: ResumoLojaHubVendas }) {
  const saldo = loja.saldoRestante
  const saldoCor = saldo > 0 ? 'text-green-600' : 'text-slate-400'
  return (
    <div className={`bg-white border rounded-xl p-4 ${loja.pausada ? 'border-amber-300 bg-amber-50/30' : 'border-slate-200'}`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-slate-800">{loja.nomeExibicao}</h3>
        {loja.pausada ? (
          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">PAUSADA</span>
        ) : (
          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">ATIVA</span>
        )}
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="text-xs text-slate-400">Enviados hoje</p>
          <p className="text-lg font-bold text-slate-700">{loja.enviadosHoje}</p>
        </div>
        <div>
          <p className="text-xs text-slate-400">Limite</p>
          <p className="text-lg font-bold text-slate-700">{loja.limiteDiario}</p>
        </div>
        <div>
          <p className="text-xs text-slate-400">Saldo</p>
          <p className={`text-lg font-bold ${saldoCor}`}>{saldo}</p>
        </div>
      </div>
      {loja.errosConsecutivos > 0 && (
        <div className="flex items-center gap-1.5 mt-3 text-xs text-red-600">
          <AlertTriangle className="w-3.5 h-3.5" />
          {loja.errosConsecutivos} erro(s) consecutivo(s)
        </div>
      )}
      <div className="grid grid-cols-3 gap-1 mt-3 pt-3 border-t border-slate-100 text-xs">
        <span className="text-slate-500">Agendada: <strong className="text-slate-700">{loja.filas.agendada}</strong></span>
        <span className="text-slate-500">Reservada: <strong className="text-slate-700">{loja.filas.reservada}</strong></span>
        <span className="text-slate-500">Enviando: <strong className="text-slate-700">{loja.filas.enviando}</strong></span>
        <span className="text-slate-500">Erro: <strong className={loja.filas.erro > 0 ? 'text-red-600' : 'text-slate-700'}>{loja.filas.erro}</strong></span>
        <span className="text-slate-500">Incerto: <strong className={loja.filas.resultadoIncerto > 0 ? 'text-amber-600' : 'text-slate-700'}>{loja.filas.resultadoIncerto}</strong></span>
        <span className="text-slate-500">Manual: <strong className={loja.filas.analiseManual > 0 ? 'text-violet-600' : 'text-slate-700'}>{loja.filas.analiseManual}</strong></span>
      </div>
    </div>
  )
}

function BadgeStatus({ status }: { status: string }) {
  const map: Record<string, { label: string; cor: string }> = {
    agendado: { label: 'Agendado', cor: 'bg-blue-100 text-blue-700' },
    reservado: { label: 'Reservado', cor: 'bg-indigo-100 text-indigo-700' },
    enviando: { label: 'Enviando', cor: 'bg-cyan-100 text-cyan-700' },
    enviado: { label: 'Enviado', cor: 'bg-green-100 text-green-700' },
    erro: { label: 'Erro', cor: 'bg-red-100 text-red-700' },
    resultado_incerto: { label: 'Incerto', cor: 'bg-amber-100 text-amber-700' },
    analise_manual: { label: 'Manual', cor: 'bg-violet-100 text-violet-700' },
    cancelado: { label: 'Cancelado', cor: 'bg-slate-100 text-slate-600' },
  }
  const info = map[status] ?? { label: status, cor: 'bg-slate-100 text-slate-600' }
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${info.cor}`}>{info.label}</span>
}

function ModalConfirmacao({
  titulo, descricao, motivo, setMotivo, processando, onConfirmar, onCancelar, corBotao, textoBotao,
}: {
  titulo: string
  descricao: string
  motivo: string
  setMotivo: (v: string) => void
  processando: boolean
  onConfirmar: () => void
  onCancelar: () => void
  corBotao: string
  textoBotao: string
}) {
  const cores: Record<string, string> = {
    amber: 'bg-amber-600 hover:bg-amber-700',
    green: 'bg-green-600 hover:bg-green-700',
    red: 'bg-red-600 hover:bg-red-700',
  }
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onCancelar}>
      <div className="bg-white rounded-xl p-6 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-bold text-slate-800 mb-2">{titulo}</h3>
        <p className="text-sm text-slate-600 mb-4">{descricao}</p>
        <label className="block text-xs text-slate-500 mb-1">Motivo (opcional)</label>
        <textarea
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          rows={3}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-400 mb-4"
          placeholder="Descreva o motivo..."
        />
        <div className="flex gap-2 justify-end">
          <button onClick={onCancelar} className="px-4 py-2 bg-slate-100 rounded-lg hover:bg-slate-200 text-sm font-medium text-slate-700">
            Cancelar
          </button>
          <button
            onClick={onConfirmar}
            disabled={processando}
            className={`px-4 py-2 text-white rounded-lg disabled:opacity-50 text-sm font-medium transition-colors ${cores[corBotao] ?? cores.amber}`}
          >
            {processando ? <Loader2 className="w-4 h-4 animate-spin" /> : textoBotao}
          </button>
        </div>
      </div>
    </div>
  )
}

function ModalDetalhe({
  detalhe, onClose, onAcao,
}: {
  detalhe: DetalheFilaHubVendas
  onClose: () => void
  onAcao: (acao: 'cancelar_agendada' | 'reprocessar_erro' | 'liberar_analise_manual', titulo: string) => void
}) {
  const f = detalhe.fila
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-slate-800">Detalhes da fila</h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-lg"><X className="w-5 h-5 text-slate-500" /></button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <CampoDetalhe label="ID" valor={f.id} mono />
          <CampoDetalhe label="Lead ID" valor={f.leadId} mono />
          <CampoDetalhe label="Status" valor={<BadgeStatus status={f.status} />} />
          <CampoDetalhe label="Loja" valor={f.conexaoDestinoNome || f.loja || '—'} />
          <CampoDetalhe label="Cliente" valor={f.nomeContatoHub || '—'} />
          <CampoDetalhe label="Telefone" valor={f.telefoneMascarado || '—'} mono />
          <CampoDetalhe label="Programado para" valor={formatarData(f.programadoPara)} />
          <CampoDetalhe label="Enviado em" valor={f.enviadoEm ? formatarData(f.enviadoEm) : '—'} />
          <CampoDetalhe label="Tentativas" valor={String(f.tentativasEnvio)} />
          <CampoDetalhe label="Versão mensagem" valor={f.versaoMensagem ? String(f.versaoMensagem) : '—'} />
          <CampoDetalhe label="Contact ID" valor={f.digisacContactId || '—'} mono />
          <CampoDetalhe label="Ticket ID" valor={f.digisacTicketId || '—'} mono />
          <CampoDetalhe label="Reservado em" valor={f.reservadoEm ? formatarData(f.reservadoEm) : '—'} />
          <CampoDetalhe label="Reservado por" valor={f.reservadoPor || '—'} />
          <CampoDetalhe label="Req. iniciada" valor={f.requisicaoIniciadaEm ? formatarData(f.requisicaoIniciadaEm) : '—'} />
          <CampoDetalhe label="Req. finalizada" valor={f.requisicaoFinalizadaEm ? formatarData(f.requisicaoFinalizadaEm) : '—'} />
          <CampoDetalhe label="Reconciliações" valor={String(f.quantidadeReconciliacoes)} />
          <CampoDetalhe label="Última reconciliação" valor={f.ultimaReconciliacaoEm ? formatarData(f.ultimaReconciliacaoEm) : '—'} />
          <CampoDetalhe label="Criado em" valor={formatarData(f.createdAt)} />
          <CampoDetalhe label="Atualizado em" valor={formatarData(f.updatedAt)} />
        </div>

        {f.erro && (
          <div className="mt-3 p-3 bg-red-50 rounded-lg text-sm text-red-700">
            <strong>Erro:</strong> {f.erro}
            {f.categoriaErro && <span className="block text-xs mt-1">Categoria: {f.categoriaErro}</span>}
          </div>
        )}
        {f.motivoCancelamento && (
          <div className="mt-3 p-3 bg-slate-50 rounded-lg text-sm text-slate-700">
            <strong>Motivo cancelamento:</strong> {f.motivoCancelamento}
          </div>
        )}
        {f.resultado && (
          <div className="mt-3 p-3 bg-slate-50 rounded-lg text-sm text-slate-700">
            <strong>Resultado:</strong> {f.resultado}
          </div>
        )}

        {/* Ações manuais */}
        <div className="mt-5 pt-4 border-t border-slate-100">
          <h4 className="text-sm font-semibold text-slate-700 mb-2">Ações manuais</h4>
          <div className="flex flex-wrap gap-2">
            {f.status === 'agendado' && (
              <button onClick={() => onAcao('cancelar_agendada', 'Cancelar fila agendada')} className="px-3 py-1.5 bg-red-50 border border-red-200 rounded-lg text-xs font-medium text-red-700 hover:bg-red-100">
                Cancelar fila
              </button>
            )}
            {f.status === 'erro' && (
              <button onClick={() => onAcao('reprocessar_erro', 'Reprocessar fila com erro')} className="px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-lg text-xs font-medium text-amber-700 hover:bg-amber-100">
                Reprocessar
              </button>
            )}
            {f.status === 'analise_manual' && (
              <button onClick={() => onAcao('liberar_analise_manual', 'Liberar análise manual')} className="px-3 py-1.5 bg-violet-50 border border-violet-200 rounded-lg text-xs font-medium text-violet-700 hover:bg-violet-100">
                Liberar (cancelar)
              </button>
            )}
            {!['agendado', 'erro', 'analise_manual'].includes(f.status) && (
              <span className="text-xs text-slate-400">Nenhuma ação manual disponível para este status.</span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function CampoDetalhe({ label, valor, mono }: { label: string; valor: React.ReactNode; mono?: boolean }) {
  return (
    <div>
      <p className="text-xs text-slate-400">{label}</p>
      <p className={`text-sm text-slate-700 ${mono ? 'font-mono text-xs' : ''}`}>{valor}</p>
    </div>
  )
}

function formatarData(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  } catch {
    return iso
  }
}

function formatarDataBrasileira(dataIso: string): string {
  const [ano, mes, dia] = dataIso.split('-')
  return ano && mes && dia ? `${dia}/${mes}/${ano}` : dataIso
}
