'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import {
  RefreshCw, AlertTriangle, CheckCircle, Pause, Play, Save,
  ChevronLeft, ChevronRight, Eye, AlertCircle,
  Bot, Clock, Hash, ShieldAlert, Info, ExternalLink,
  Users, UserCheck, Send, Undo2, XCircle, Phone, Store,
} from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import {
  PageContainer, PageHeader, FilterPanel, FilterFieldGroup, useFilterState, FormField,
  Input, DateField, Button, IconButton, Card, CardHeader, CardContent, KpiCard, KpiSection,
  Section, Badge, Alert, EmptyState, LoadingLeBebe, Spinner, ResponsiveTable, useDelayedVisibility,
  Dialog, DialogContent, DialogHeader, DialogBody, DialogFooter, Textarea,
} from '@/components/design-system'
import { validateDateRange, parseBrDate, dateToIso } from '@/lib/design-system/dates'
import { TABLE_PAGE_SIZE } from '@/lib/design-system/pagination'
import type {
  StatusGestaoHubVendas,
  ResumoLojaHubVendas,
  ListagemFilasHubVendas,
  DetalheFilaHubVendas,
  ContagemPorLojaHubVendas,
  FilaListadaHubVendas,
} from '@/lib/digisac/hub-vendas/gestao'
import { formatarPercentualHubVendas, LIMITE_DIARIO_MAXIMO } from '@/lib/digisac/hub-vendas/gestao'
import { montarUrlHistoricoTicket } from '@/lib/digisac/urls'

const POLLING_INTERVAL_MS = 60_000

type LojaFiltro = '' | 'portao' | 'bigorrilho' | 'hauer_marechal'
type PeriodoHubVendas = { de: string; ate: string }
type PeriodoRascunhoBr = { de: string; ate: string }
type FiltrosFilasHubVendas = {
  loja: LojaFiltro
  status: string
  cliente: string
  telefoneParcial: string
  somenteErros: boolean
  somenteAnaliseManual: boolean
  somenteResultadoIncerto: boolean
}

const FILTROS_FILAS_VAZIOS: FiltrosFilasHubVendas = {
  loja: '',
  status: '',
  cliente: '',
  telefoneParcial: '',
  somenteErros: false,
  somenteAnaliseManual: false,
  somenteResultadoIncerto: false,
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
  params.set('porPagina', String(TABLE_PAGE_SIZE))
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
  const periodoFilters = useFilterState<PeriodoRascunhoBr>({ de: '', ate: '' })
  const [carregandoPeriodo, setCarregandoPeriodo] = useState(false)
  const [erroPeriodo, setErroPeriodo] = useState<string | null>(null)
  const [periodoAplicado, setPeriodoAplicado] = useState<PeriodoHubVendas | null>(null)
  const [status, setStatus] = useState<StatusGestaoHubVendas | null>(null)
  const [loadingStatus, setLoadingStatus] = useState(true)
  const mostrarLoadingInicial = useDelayedVisibility(loadingStatus && !status)
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
  const filasFilters = useFilterState<FiltrosFilasHubVendas>(FILTROS_FILAS_VAZIOS)
  const consultaPeriodoEmAndamento = useRef(false)

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
  async function executarBuscaFilas(pag: number, filtrosParam: FiltrosFilasHubVendas) {
    if (consultaPeriodoEmAndamento.current) return
    setLoadingFilas(true)
    setErroFilas(null)
    try {
      setFilas(await buscarFilasHubVendas(pag, filtrosParam, periodoAplicado))
    } catch (error) {
      setErroFilas(error instanceof Error ? error.message : 'Erro de conexão ao carregar filas')
    } finally {
      setLoadingFilas(false)
    }
  }

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
  const executarBuscaFilasAtual = useRef(executarBuscaFilas)
  useEffect(() => {
    carregarStatusAtual.current = carregarStatus
    executarBuscaFilasAtual.current = executarBuscaFilas
  })

  // ---------------------------------------------------------------------------
  // Polling e carregamento inicial
  // ---------------------------------------------------------------------------
  useEffect(() => {
    carregarStatusAtual.current()
    void executarBuscaFilasAtual.current(1, FILTROS_FILAS_VAZIOS)
    carregarAlertas()
    carregarResumo()
    const interval = setInterval(() => {
      carregarStatusAtual.current()
    }, POLLING_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [carregarAlertas, carregarResumo])

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
        buscarFilasHubVendas(1, filasFilters.applied, periodo),
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
    const { de, ate } = periodoFilters.draft
    if (!de || !ate) {
      setErroPeriodo('Informe as datas De e Até.')
      return
    }
    const validacao = validateDateRange(de, ate)
    if (!validacao.ok) {
      setErroPeriodo(validacao.message ?? 'Datas inválidas.')
      return
    }
    const deIso = dateToIso(parseBrDate(de)!)
    const ateIso = dateToIso(parseBrDate(ate)!)
    periodoFilters.apply()
    void atualizarPeriodo({ de: deIso, ate: ateIso })
  }

  function limparPeriodo() {
    if (consultaPeriodoEmAndamento.current) return
    void atualizarPeriodo(null).then((limpezaAplicada) => {
      if (limpezaAplicada) periodoFilters.clear()
    })
  }

  function aplicarFiltrosFila() {
    if (consultaPeriodoEmAndamento.current) return
    filasFilters.apply()
    setPagina(1)
    void executarBuscaFilas(1, filasFilters.draft)
  }

  function limparFiltrosFila() {
    if (consultaPeriodoEmAndamento.current) return
    filasFilters.clear()
    setPagina(1)
    void executarBuscaFilas(1, FILTROS_FILAS_VAZIOS)
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
        void executarBuscaFilas(pagina, filasFilters.applied)
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
      <PageContainer>
        <div className="flex min-h-[60vh] items-center justify-center">
          {mostrarLoadingInicial && <LoadingLeBebe size={80} label="Carregando Gestão Hub/Vendas" />}
        </div>
      </PageContainer>
    )
  }

  if (erroStatus && !status) {
    return (
      <PageContainer>
        <EmptyState
          icon={<AlertCircle className="size-5" />}
          title="Não foi possível carregar a Gestão Hub/Vendas"
          description={erroStatus}
          action={<Button onClick={() => carregarStatus()}>Tentar novamente</Button>}
          className="min-h-[60vh] justify-center"
        />
      </PageContainer>
    )
  }

  if (!status) return null

  const automacaoAtiva = status.automacao.ativa && !status.automacao.pausada

  return (
    <PageContainer className="space-y-6">
      <PageHeader
        icon={<Bot className="size-6" />}
        title="Gestão Hub/Vendas"
        description="Monitoramento e configuração da automação"
        action={
          <div className="flex flex-col items-end gap-1">
            <Button
              variant="secondary"
              onClick={() => { carregarStatus(true); void executarBuscaFilas(pagina, filasFilters.applied) }}
              loading={atualizandoStatus}
            >
              <RefreshCw className="size-4" />
              {atualizandoStatus ? 'Atualizando...' : 'Atualizar agora'}
            </Button>
            {ultimaAtualizacaoStatus && <span className="text-xs text-slate-400">Atualizado às {ultimaAtualizacaoStatus}</span>}
            {feedbackStatus && (
              <span className={`text-xs ${feedbackStatus.tipo === 'sucesso' ? 'text-emerald-600' : 'text-destructive'}`}>
                {feedbackStatus.texto}
              </span>
            )}
          </div>
        }
      />

      {/* Filtro global de período */}
      <FilterPanel title="Período" dirty={periodoFilters.dirty} onApply={aplicarPeriodo} onClear={limparPeriodo} applyDisabled={carregandoPeriodo}>
        <FilterFieldGroup label="Intervalo de datas" icon={<Clock className="size-4 text-slate-400" />}>
          <FormField id="hub-vendas-periodo-de" label="De">
            {(f) => <DateField {...f} value={periodoFilters.draft.de} onChange={(v) => periodoFilters.setField('de', v)} disabled={carregandoPeriodo} />}
          </FormField>
          <FormField id="hub-vendas-periodo-ate" label="Até">
            {(f) => <DateField {...f} value={periodoFilters.draft.ate} onChange={(v) => periodoFilters.setField('ate', v)} disabled={carregandoPeriodo} />}
          </FormField>
        </FilterFieldGroup>
        {erroPeriodo && <Alert tone="danger">{erroPeriodo}</Alert>}
        {carregandoPeriodo && <p className="text-xs text-slate-500" role="status">Carregando dados do período...</p>}
        {periodoAplicado && !erroPeriodo && !carregandoPeriodo && (
          <p className="text-xs text-sky-700">
            Período aplicado: {formatarDataBrasileira(periodoAplicado.de)} até {formatarDataBrasileira(periodoAplicado.ate)} · America/Sao_Paulo
          </p>
        )}
      </FilterPanel>

      <Alert tone="warning">Dados confiáveis a partir de 13/08/2026</Alert>

      {/* Estado geral da automação */}
      <Card>
        <CardContent>
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
            <div className="flex items-center gap-4">
              <div className={`rounded-xl p-3 ${automacaoAtiva ? 'bg-success/10' : 'bg-warning/10'}`}>
                {automacaoAtiva ? <CheckCircle className="size-7 text-emerald-600" /> : <Pause className="size-7 text-amber-600" />}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold text-slate-800">
                    {automacaoAtiva ? 'Automação ativa' : 'Automação pausada'}
                  </span>
                  <Badge tone={automacaoAtiva ? 'success' : 'warning'}>{automacaoAtiva ? 'EM EXECUÇÃO' : 'PAUSADA'}</Badge>
                </div>
                {status.automacao.motivo && <p className="mt-0.5 text-sm text-slate-500">Motivo: {status.automacao.motivo}</p>}
                <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
                  {status.automacao.atualizadoEm && <span>Atualizado: {formatarData(status.automacao.atualizadoEm)}</span>}
                  {status.ultimoProcessamento && <span>Último processamento: {formatarData(status.ultimoProcessamento)}</span>}
                  <span>Timezone: {status.parametros.timezone}</span>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              {automacaoAtiva ? (
                <Button variant="secondary" onClick={() => setModalPausa(true)}>
                  <Pause className="size-4" />
                  Pausar automação
                </Button>
              ) : (
                <Button variant="primary" onClick={() => setModalReativar(true)}>
                  <Play className="size-4" />
                  Reativar automação
                </Button>
              )}
            </div>
          </div>

          {/* Parâmetros */}
          <div className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-100 pt-4 md:grid-cols-3 lg:grid-cols-6">
            <ParametroItem icon={<Hash className="size-4" />} label="Limite por execução" valor={String(status.parametros.limitePorExecucao)} />
            <ParametroItem icon={<Hash className="size-4" />} label="Limite diário/loja" valor={String(status.parametros.limiteDiarioPorConexao)} />
            <ParametroItem icon={<Clock className="size-4" />} label="Timeout reserva" valor={`${status.parametros.reservaTimeoutMinutos}min`} />
            <ParametroItem icon={<Clock className="size-4" />} label="Timeout envio" valor={`${status.parametros.envioTimeoutMinutos}min`} />
            <ParametroItem icon={<CheckCircle className="size-4" />} label="Ativação gradual" valor={status.parametros.modoAtivacaoGradual ? 'Sim' : 'Não'} />
            <ParametroItem icon={<Clock className="size-4" />} label="Timezone" valor={status.parametros.timezone} />
          </div>
        </CardContent>
      </Card>

      {/* Resultados da coorte de leads */}
      <KpiSection
        kpis={
          <>
            <KpiCard
              label="Leads registrados"
              value={status.resumo.leadsRegistrados}
              icon={<Users className="size-4" />}
              labelAction={<KpiTooltip label="Leads registrados" texto="Total de clientes que já entraram em contato pela nossa Central de Atendimento." />}
            />
            <KpiCard
              label="Candidatos elegíveis"
              value={status.resumo.candidatosElegiveis}
              icon={<UserCheck className="size-4" />}
              tone="info"
              detail={formatarPercentualHubVendas(status.resumo.candidatosElegiveis, status.resumo.leadsRegistrados)}
              labelAction={<KpiTooltip label="Candidatos elegíveis" texto="Clientes que ainda podem receber uma mensagem de recuperação." />}
            />
            <KpiCard
              label="Convertidos organicamente"
              value={status.resumo.convertidos}
              icon={<CheckCircle className="size-4" />}
              tone="success"
              detail={
                <>
                  <p>{formatarPercentualHubVendas(status.resumo.convertidos, status.resumo.leadsRegistrados)}</p>
                  <p className="truncate" title={formatarDetalhePorLoja(status.resumo.convertidosPorLoja)}>{formatarDetalhePorLoja(status.resumo.convertidosPorLoja)}</p>
                </>
              }
              labelAction={<KpiTooltip label="Convertidos organicamente" texto="Clientes que procuraram uma das lojas por conta própria, antes de receber uma mensagem de recuperação." />}
            />
            <KpiCard
              label="Recuperação enviada / aguardando"
              value={status.resumo.recuperacaoEnviadaTotal}
              icon={<Send className="size-4" />}
              tone="info"
              detail={
                <>
                  <p>{formatarPercentualHubVendas(status.resumo.recuperacaoEnviadaTotal, status.resumo.leadsRegistrados)}</p>
                  <p className="truncate" title={formatarDetalhePorLoja(status.resumo.recuperacaoEnviadaPorLoja)}>{formatarDetalhePorLoja(status.resumo.recuperacaoEnviadaPorLoja)}</p>
                </>
              }
              labelAction={<KpiTooltip label="Recuperação enviada / aguardando" texto="Clientes que receberam nossa mensagem de recuperação e ainda estão dentro do prazo para responder." />}
            />
            <KpiCard
              label="Recuperados"
              value={status.resumo.recuperados}
              icon={<Undo2 className="size-4" />}
              tone="success"
              detail={
                <>
                  <p>{formatarPercentualHubVendas(status.resumo.recuperados, status.resumo.leadsRegistrados)}</p>
                  <p className="truncate" title={formatarDetalhePorLoja(status.resumo.recuperadosPorLoja)}>{formatarDetalhePorLoja(status.resumo.recuperadosPorLoja)}</p>
                </>
              }
              labelAction={<KpiTooltip label="Recuperados" texto="Clientes que responderam depois de receber nossa mensagem de recuperação." />}
            />
            <KpiCard
              label="Perdidos"
              value={status.resumo.perdidos}
              icon={<XCircle className="size-4" />}
              detail={
                <>
                  <p>{formatarPercentualHubVendas(status.resumo.perdidos, status.resumo.leadsRegistrados)}</p>
                  <p className="truncate" title={formatarDetalhePorLoja(status.resumo.perdidosPorLoja)}>{formatarDetalhePorLoja(status.resumo.perdidosPorLoja)}</p>
                </>
              }
              labelAction={<KpiTooltip label="Perdidos" texto="Clientes que receberam a mensagem de recuperação, mas não responderam dentro do prazo." />}
            />
            <KpiCard
              label="Fila manual"
              value={status.resumo.filaManual}
              icon={<Clock className="size-4" />}
              tone="warning"
              detail={formatarPercentualHubVendas(status.resumo.filaManual, status.resumo.leadsRegistrados)}
              labelAction={<KpiTooltip label="Fila manual" texto="Clientes que poderiam receber recuperação, mas não entraram na fila ou não tiveram a recuperação concluída dentro do prazo." />}
            />
          </>
        }
      >
        <p className="-mt-2 text-xs text-slate-500">
          {periodoAplicado
            ? 'Considera quem entrou no Hub no período selecionado e mostra o estado atual desses mesmos leads.'
            : 'Considera todos os leads registrados e mostra o estado atual de cada um.'}
        </p>
      </KpiSection>

      {/* Movimentação */}
      <KpiSection
        kpis={
          <KpiCard
            label={periodoAplicado ? 'Enviados no período' : 'Enviados hoje'}
            value={status.resumo.enviadaHoje}
            icon={<Send className="size-4" />}
            tone="success"
          />
        }
      />

      {/* Operação atual */}
      <KpiSection
        kpis={
          <>
            <KpiCard label="Filas agendadas" value={status.resumo.agendada} icon={<Clock className="size-4" />} tone="info" />
            <KpiCard label="Filas reservadas" value={status.resumo.reservada} icon={<Hash className="size-4" />} tone="info" />
            <KpiCard label="Enviando" value={status.resumo.enviando} icon={<Send className="size-4" />} tone="info" />
            <KpiCard label="Canceladas" value={status.resumo.cancelada} icon={<XCircle className="size-4" />} />
            <KpiCard
              label="Erros hoje"
              value={status.resumo.erroHoje}
              icon={<AlertCircle className="size-4" />}
              tone={status.resumo.erroHoje > 0 ? 'danger' : 'neutral'}
              detail={status.resumo.erro > status.resumo.erroHoje
                ? `${status.resumo.erro - status.resumo.erroHoje} erro(s) anterior(es) pendente(s)`
                : undefined}
              labelAction={<KpiTooltip label="Erros hoje" texto="Filas em erro programadas para hoje. Erros de dias anteriores que ainda estão pendentes aparecem à parte e podem ser reprocessados na lista de filas." />}
            />
            <KpiCard label="Resultado incerto" value={status.resumo.resultadoIncerto} icon={<AlertTriangle className="size-4" />} tone={status.resumo.resultadoIncerto > 0 ? 'warning' : 'neutral'} />
            <KpiCard label="Análise manual" value={status.resumo.analiseManual} icon={<ShieldAlert className="size-4" />} tone={status.resumo.analiseManual > 0 ? 'warning' : 'neutral'} />
          </>
        }
      >
        <p className="-mt-2 text-xs text-slate-500">Estado atual das filas, limites e alertas da automação, independente do período selecionado.</p>
      </KpiSection>

      {status.resumo.conexoesPausadas > 0 && (
        <Alert tone="warning">
          <ShieldAlert className="mr-1 inline size-4" />
          {status.resumo.conexoesPausadas} conexão(ões) pausada(s) por erro automático.
        </Alert>
      )}

      {/* Alertas e resumo operacional */}
      <Card>
        <CardHeader
          title="Alertas e resumo operacional"
          action={
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => { carregarAlertas(true); carregarResumo(true) }}
                loading={atualizandoAlertas}
              >
                <RefreshCw className="size-3.5" />
                {atualizandoAlertas ? 'Atualizando...' : 'Atualizar'}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => { setFeedbackTeste(null); setModalTesteAlerta(true) }}
                disabled={enviandoTeste}
              >
                <ShieldAlert className="size-3.5" />
                Enviar alerta de teste
              </Button>
            </div>
          }
        />
        <CardContent className="space-y-4">
          {(ultimaAtualizacaoAlertas || feedbackAlertas) && (
            <div className="flex items-center gap-3 text-xs">
              {ultimaAtualizacaoAlertas && <span className="text-slate-400">Atualizado às {ultimaAtualizacaoAlertas}</span>}
              {feedbackAlertas && (
                <span className={feedbackAlertas.tipo === 'sucesso' ? 'text-emerald-600' : 'text-destructive'}>{feedbackAlertas.texto}</span>
              )}
            </div>
          )}
          {feedbackTeste && <Alert tone={feedbackTeste.tipo === 'sucesso' ? 'success' : 'danger'}>{feedbackTeste.texto}</Alert>}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Section title="Resumo diário" icon={<Clock className="size-4" />} tone="section-1">
              {loadingAlertas ? (
                <p className="text-xs text-slate-400">Carregando...</p>
              ) : statusResumo.ultimoResumoEm ? (
                <div className="space-y-1 text-xs">
                  <p className="text-slate-700"><span className="text-slate-400">Data:</span> {statusResumo.ultimoResumoDataLocal ?? '—'}</p>
                  <p className="text-slate-700"><span className="text-slate-400">Enviado:</span> {formatarData(statusResumo.ultimoResumoEm)}</p>
                  <p className="text-slate-700">
                    <span className="text-slate-400">Status:</span>{' '}
                    <span className={statusResumo.ultimoResumoStatus === 'enviado' ? 'text-emerald-600' : 'text-destructive'}>{statusResumo.ultimoResumoStatus ?? '—'}</span>
                  </p>
                </div>
              ) : (
                <p className="text-xs text-slate-400">Nenhum resumo enviado ainda.</p>
              )}
            </Section>

            <Section title="Alertas (24h)" icon={<AlertCircle className="size-4" />} tone="section-2">
              {loadingAlertas ? (
                <p className="text-xs text-slate-400">Carregando...</p>
              ) : (
                <div className="space-y-1 text-xs">
                  <p className="text-2xl font-bold text-slate-800">{alertas.total24h}</p>
                  {alertas.ultimoAlertaEm && <p className="text-slate-500">Último: {formatarData(alertas.ultimoAlertaEm)}</p>}
                  {alertas.ultimoTipo && <p className="text-slate-500">Tipo: {alertas.ultimoTipo}</p>}
                </div>
              )}
            </Section>

            <Section title="Estado operacional" icon={<CheckCircle className="size-4" />} tone="section-3">
              <div className="text-xs">
                {alertas.total24h === 0 && status.resumo.erroHoje === 0 && status.resumo.resultadoIncerto === 0 ? (
                  <Badge tone="success">Saudável</Badge>
                ) : (
                  <Badge tone="warning">Com atenção</Badge>
                )}
              </div>
            </Section>
          </div>

          {/* Alertas recentes */}
          {alertas.ultimos.length > 0 && (
            <div className="border-t border-slate-100 pt-4">
              <h3 className="mb-2 text-xs font-semibold text-slate-600">Alertas recentes</h3>
              <div className="max-h-40 space-y-1.5 overflow-y-auto">
                {alertas.ultimos.map((alerta, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-slate-600">
                    <Badge tone={alerta.status === 'enviado' ? 'success' : alerta.status === 'deduplicado' ? 'neutral' : 'danger'}>{alerta.status}</Badge>
                    <span className="font-medium">{alerta.tipo}</span>
                    <span className="text-slate-400">{formatarData(alerta.enviadoEm)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cards por loja */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-slate-700">Por loja</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {status.lojas.map((loja) => (
            <CardLoja key={loja.loja} loja={loja} />
          ))}
        </div>
      </section>

      {/* Configuração do limite */}
      <Card>
        <CardHeader title="Limite diário por loja" />
        <CardContent>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <FormField id="hub-vendas-limite" label="Valor (aplicado a cada loja)" helper={`Este limite é aplicado individualmente a cada loja. Exemplo: limite 10 permite até 10 envios em Portão, 10 em Bigorrilho e 10 em Hauer por dia. Máximo seguro: ${LIMITE_DIARIO_MAXIMO}.`} className="max-w-xs flex-1">
              {(f) => (
                <Input
                  {...f}
                  type="number"
                  min={0}
                  max={LIMITE_DIARIO_MAXIMO}
                  value={novoLimite}
                  onChange={(e) => setNovoLimite(e.target.value)}
                  placeholder="Ex: 10"
                />
              )}
            </FormField>
            <Button onClick={salvarLimite} loading={salvandoLimite} disabled={novoLimite === String(status.parametros.limiteDiarioPorConexao)}>
              <Save className="size-4" />
              Salvar limite
            </Button>
          </div>
          {feedbackLimite && <Alert tone={feedbackLimite.tipo === 'sucesso' ? 'success' : 'danger'} className="mt-3">{feedbackLimite.texto}</Alert>}
        </CardContent>
      </Card>

      {/* Filtros + Tabela de filas */}
      <section className="space-y-4">
        <div>
          <h2 className="mb-1 text-sm font-semibold text-slate-700">{periodoAplicado ? 'Filas e envios do período' : 'Filas e envios'}</h2>
          <p className="text-xs text-slate-500">As filas usam a data programada; os envios usam a data de envio.</p>
        </div>

        <FilterPanel title="Filtros de filas e envios" dirty={filasFilters.dirty} onApply={aplicarFiltrosFila} onClear={limparFiltrosFila} applyDisabled={loadingFilas}>
          <FilterFieldGroup label="Cliente e telefone" icon={<Phone className="size-4 text-slate-400" />}>
            <FormField id="hub-vendas-filtro-cliente" label="Cliente">
              {(f) => <Input {...f} value={filasFilters.draft.cliente} onChange={(e) => filasFilters.setField('cliente', e.target.value)} placeholder="Nome do cliente" />}
            </FormField>
            <FormField id="hub-vendas-filtro-telefone" label="Telefone parcial">
              {(f) => <Input {...f} value={filasFilters.draft.telefoneParcial} onChange={(e) => filasFilters.setField('telefoneParcial', e.target.value)} placeholder="Telefone parcial" />}
            </FormField>
          </FilterFieldGroup>

          <FilterFieldGroup label="Loja e status" icon={<Store className="size-4 text-slate-400" />}>
            <FormField id="hub-vendas-filtro-loja" label="Loja">
              {(f) => (
                <Select value={filasFilters.draft.loja || 'all'} onValueChange={(v) => filasFilters.setField('loja', (v === 'all' ? '' : v) as LojaFiltro)}>
                  <SelectTrigger id={f.id} className="w-full"><SelectValue placeholder="Todas as lojas" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as lojas</SelectItem>
                    <SelectItem value="portao">Portão</SelectItem>
                    <SelectItem value="bigorrilho">Bigorrilho</SelectItem>
                    <SelectItem value="hauer_marechal">Hauer</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </FormField>
            <FormField id="hub-vendas-filtro-status" label="Status">
              {(f) => (
                <Select value={filasFilters.draft.status || 'all'} onValueChange={(v) => filasFilters.setField('status', v === 'all' ? '' : v)}>
                  <SelectTrigger id={f.id} className="w-full"><SelectValue placeholder="Todos os status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os status</SelectItem>
                    <SelectItem value="agendado">Agendado</SelectItem>
                    <SelectItem value="reservado">Reservado</SelectItem>
                    <SelectItem value="enviando">Enviando</SelectItem>
                    <SelectItem value="enviado">Enviado</SelectItem>
                    <SelectItem value="erro">Erro</SelectItem>
                    <SelectItem value="resultado_incerto">Resultado incerto</SelectItem>
                    <SelectItem value="analise_manual">Análise manual</SelectItem>
                    <SelectItem value="cancelado">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </FormField>
          </FilterFieldGroup>

          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <Checkbox checked={filasFilters.draft.somenteErros} onCheckedChange={(c) => filasFilters.setField('somenteErros', c === true)} />
              Somente erros
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <Checkbox checked={filasFilters.draft.somenteAnaliseManual} onCheckedChange={(c) => filasFilters.setField('somenteAnaliseManual', c === true)} />
              Análise manual
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <Checkbox checked={filasFilters.draft.somenteResultadoIncerto} onCheckedChange={(c) => filasFilters.setField('somenteResultadoIncerto', c === true)} />
              Resultado incerto
            </label>
          </div>
        </FilterPanel>

        <ResponsiveTable<FilaListadaHubVendas>
          columns={[
            { key: 'data', header: 'Data/hora', width: 'compact', render: (fila) => <span className="text-xs text-slate-600">{formatarData(fila.programadoPara)}</span> },
            { key: 'cliente', header: 'Cliente', width: 'content', render: (fila) => fila.nomeContatoHub || '—' },
            { key: 'telefone', header: 'Telefone', width: 'compact', className: 'font-mono text-xs text-slate-600', render: (fila) => fila.telefoneMascarado || '—' },
            { key: 'loja', header: 'Loja', width: 'standard', render: (fila) => fila.conexaoDestinoNome || fila.loja || '—' },
            { key: 'status', header: 'Status', width: 'compact', render: (fila) => <BadgeStatus status={fila.status} /> },
            {
              key: 'protocoloVenda',
              header: 'Protocolo Venda',
              width: 'compact',
              className: 'font-mono text-xs',
              render: (fila) => fila.digisacProtocoloHub && fila.digisacTicketIdHub ? (
                <a href={montarUrlHistoricoTicket(fila.digisacTicketIdHub)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 hover:underline">
                  {fila.digisacProtocoloHub}
                  <ExternalLink className="size-3" />
                </a>
              ) : '—',
            },
            {
              key: 'protocoloRecuperacao',
              header: 'Protocolo Recuperação',
              width: 'compact',
              className: 'font-mono text-xs',
              render: (fila) => fila.digisacProtocolo && fila.digisacTicketId ? (
                <a href={montarUrlHistoricoTicket(fila.digisacTicketId)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 hover:underline">
                  {fila.digisacProtocolo}
                  <ExternalLink className="size-3" />
                </a>
              ) : '—',
            },
            { key: 'tentativas', header: 'Tent.', width: 'compact', className: 'text-center', render: (fila) => fila.tentativasEnvio },
            { key: 'erro', header: 'Erro', className: 'max-w-[200px] truncate text-xs text-destructive', render: (fila) => <span title={fila.erro || ''}>{fila.erro || '—'}</span> },
          ]}
          rows={filas?.filas ?? []}
          rowKey={(fila) => fila.id}
          firstColumnSticky
          loading={loadingFilas}
          error={erroFilas ?? undefined}
          emptyTitle="Nenhuma fila encontrada"
          rowActions={(fila) => (
            <IconButton variant="ghost" aria-label="Ver detalhes" onClick={() => abrirDetalhe(fila.id)}>
              <Eye className="size-4" />
            </IconButton>
          )}
          renderMobileCard={(fila) => (
            <div className="space-y-1 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-800">{fila.nomeContatoHub || '—'}</span>
                <BadgeStatus status={fila.status} />
              </div>
              <p className="text-xs text-slate-500">{formatarData(fila.programadoPara)} · {fila.conexaoDestinoNome || fila.loja || '—'}</p>
              <p className="font-mono text-xs text-slate-500">{fila.telefoneMascarado || '—'}</p>
              {fila.erro && <p className="text-xs text-destructive">{fila.erro}</p>}
            </div>
          )}
        />

        {filas && filas.filas.length > 0 && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-500">{filas.total} registro(s) — Página {filas.pagina} de {filas.totalPaginas}</span>
            <div className="flex gap-2">
              <IconButton
                variant="ghost"
                aria-label="Página anterior"
                onClick={() => { const p = Math.max(1, pagina - 1); setPagina(p); void executarBuscaFilas(p, filasFilters.applied) }}
                disabled={pagina <= 1}
              >
                <ChevronLeft className="size-4" />
              </IconButton>
              <IconButton
                variant="ghost"
                aria-label="Próxima página"
                onClick={() => { const p = Math.min(filas.totalPaginas, pagina + 1); setPagina(p); void executarBuscaFilas(p, filasFilters.applied) }}
                disabled={pagina >= filas.totalPaginas}
              >
                <ChevronRight className="size-4" />
              </IconButton>
            </div>
          </div>
        )}
      </section>

      {/* Modal Pausa */}
      <ModalConfirmacao
        open={modalPausa}
        onOpenChange={(open) => { setModalPausa(open); if (!open) setMotivoPausa('') }}
        titulo="Pausar automação"
        descricao="A automação será pausada. Os crons da VPS continuarão executando mas não processarão filas. Filas já agendadas não serão canceladas."
        motivo={motivoPausa}
        setMotivo={setMotivoPausa}
        processando={processandoPausa}
        onConfirmar={confirmarPausa}
        textoBotao="Pausar"
      />

      {/* Modal Reativar */}
      <ModalConfirmacao
        open={modalReativar}
        onOpenChange={(open) => { setModalReativar(open); if (!open) setMotivoReativar('') }}
        titulo="Reativar automação"
        descricao="A automação será reativada. Os metadados de pausa serão limpos. Os próximos ciclos da VPS retomarão o processamento normalmente."
        motivo={motivoReativar}
        setMotivo={setMotivoReativar}
        processando={processandoPausa}
        onConfirmar={confirmarReativar}
        textoBotao="Reativar"
      />

      {/* Modal Detalhe */}
      <ModalDetalhe
        detalhe={detalhe}
        onClose={() => setDetalhe(null)}
        onAcao={(acao, titulo) => { if (detalhe) { setModalAcao({ filaId: detalhe.fila.id, acao, titulo }); setMotivoAcao('') } }}
      />

      {/* Loading detalhe */}
      {loadingDetalhe && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <Spinner className="size-8 text-white" label="Carregando detalhes" />
        </div>
      )}

      {/* Modal Ação Manual */}
      <ModalConfirmacao
        open={modalAcao !== null}
        onOpenChange={(open) => { if (!open) { setModalAcao(null); setMotivoAcao('') } }}
        titulo={modalAcao?.titulo ?? ''}
        descricao="Confirme a ação manual. Esta operação será registrada na auditoria."
        motivo={motivoAcao}
        setMotivo={setMotivoAcao}
        processando={processandoAcao}
        onConfirmar={executarAcaoManual}
        textoBotao="Confirmar"
        destructive
      />

      {/* Modal Teste de Alerta */}
      <Dialog open={modalTesteAlerta} onOpenChange={setModalTesteAlerta}>
        <DialogContent className="max-w-md">
          <DialogHeader title="Enviar alerta de teste" />
          <DialogBody>
            <p className="text-sm text-slate-600">Enviar um alerta de teste para o contato técnico do Hub/Vendas? Esta ação não afeta clientes ou filas.</p>
            <ul className="mt-4 space-y-1 text-xs text-slate-500">
              <li>• A mensagem será enviada apenas ao contato técnico</li>
              <li>• Não será enviada para cliente</li>
              <li>• Nenhuma fila será criada</li>
              <li>• Nenhum lead será alterado</li>
              <li>• Nenhum limite será alterado</li>
              <li>• A automação não será pausada</li>
            </ul>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setModalTesteAlerta(false)} disabled={enviandoTeste}>
              Cancelar
            </Button>
            <Button type="button" onClick={enviarTesteAlerta} loading={enviandoTeste}>
              <ShieldAlert className="size-4" />
              Enviar teste
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
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

/**
 * Ícone de ajuda com tooltip explicativo do KPI. O Radix Tooltip (ui/tooltip.tsx) é
 * hover-first e ignora touch por design (fecha ao toque em vez de abrir). Para funcionar
 * em mobile, o estado é controlado manualmente e o toque é interceptado na fase de captura
 * (antes de chegar no botão do Radix), evitando que o pointerdown/click internos do Radix
 * fechem o tooltip que acabamos de abrir. Mouse continua usando o hover nativo do Radix.
 */
function KpiTooltip({ label, texto }: { label: string; texto: string }) {
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
  const saldoCor = saldo > 0 ? 'text-emerald-600' : 'text-slate-400'
  return (
    <Card className={loja.pausada ? 'border-amber-200 bg-warning/5' : undefined}>
      <CardContent>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold text-slate-800">{loja.nomeExibicao}</h3>
          <Badge tone={loja.pausada ? 'warning' : 'success'}>{loja.pausada ? 'PAUSADA' : 'ATIVA'}</Badge>
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
          <div className="mt-3 flex items-center gap-1.5 text-xs text-destructive">
            <AlertTriangle className="size-3.5" />
            {loja.errosConsecutivos} erro(s) consecutivo(s)
          </div>
        )}
        <div className="mt-3 grid grid-cols-3 gap-1 border-t border-slate-100 pt-3 text-xs">
          <span className="text-slate-500">Agendada: <strong className="text-slate-700">{loja.filas.agendada}</strong></span>
          <span className="text-slate-500">Reservada: <strong className="text-slate-700">{loja.filas.reservada}</strong></span>
          <span className="text-slate-500">Enviando: <strong className="text-slate-700">{loja.filas.enviando}</strong></span>
          <span className="text-slate-500">Erro hoje: <strong className={loja.filas.erroHoje > 0 ? 'text-destructive' : 'text-slate-700'}>{loja.filas.erroHoje}</strong></span>
          <span className="text-slate-500">Incerto: <strong className={loja.filas.resultadoIncerto > 0 ? 'text-amber-600' : 'text-slate-700'}>{loja.filas.resultadoIncerto}</strong></span>
          <span className="text-slate-500">Manual: <strong className={loja.filas.analiseManual > 0 ? 'text-violet-600' : 'text-slate-700'}>{loja.filas.analiseManual}</strong></span>
        </div>
        {loja.filas.erro > loja.filas.erroHoje && (
          <p className="mt-2 text-xs text-slate-500">
            {loja.filas.erro - loja.filas.erroHoje} erro(s) anterior(es) pendente(s)
          </p>
        )}
      </CardContent>
    </Card>
  )
}

function BadgeStatus({ status }: { status: string }) {
  const map: Record<string, { label: string; tone: 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'brand' }> = {
    agendado: { label: 'Agendado', tone: 'info' },
    reservado: { label: 'Reservado', tone: 'info' },
    enviando: { label: 'Enviando', tone: 'info' },
    enviado: { label: 'Enviado', tone: 'success' },
    erro: { label: 'Erro', tone: 'danger' },
    resultado_incerto: { label: 'Incerto', tone: 'warning' },
    analise_manual: { label: 'Manual', tone: 'warning' },
    cancelado: { label: 'Cancelado', tone: 'neutral' },
    expirado: { label: 'Expirado', tone: 'neutral' },
  }
  const info = map[status] ?? { label: status, tone: 'neutral' as const }
  return <Badge tone={info.tone}>{info.label}</Badge>
}

function ModalConfirmacao({
  open, onOpenChange, titulo, descricao, motivo, setMotivo, processando, onConfirmar, textoBotao, destructive = false,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  titulo: string
  descricao: string
  motivo: string
  setMotivo: (v: string) => void
  processando: boolean
  onConfirmar: () => void
  textoBotao: string
  destructive?: boolean
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader title={titulo} description={descricao} />
        <DialogBody>
          <FormField id="modal-confirmacao-motivo" label="Motivo (opcional)">
            {(f) => <Textarea {...f} value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={3} placeholder="Descreva o motivo..." />}
          </FormField>
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={processando}>
            Cancelar
          </Button>
          <Button type="button" variant={destructive ? 'destructive' : 'primary'} loading={processando} onClick={onConfirmar}>
            {textoBotao}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ModalDetalhe({
  detalhe, onClose, onAcao,
}: {
  detalhe: DetalheFilaHubVendas | null
  onClose: () => void
  onAcao: (acao: 'cancelar_agendada' | 'reprocessar_erro' | 'liberar_analise_manual', titulo: string) => void
}) {
  const f = detalhe?.fila
  return (
    <Dialog open={detalhe !== null} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader title="Detalhes da fila" />
        <DialogBody>
          {f && (
            <>
              <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
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
                <Alert tone="danger" title="Erro" className="mt-3">
                  {f.erro}
                  {f.categoriaErro && <span className="mt-1 block text-xs">Categoria: {f.categoriaErro}</span>}
                </Alert>
              )}
              {f.motivoCancelamento && (
                <div className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
                  <strong>Motivo cancelamento:</strong> {f.motivoCancelamento}
                </div>
              )}
              {f.resultado && (
                <div className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
                  <strong>Resultado:</strong> {f.resultado}
                </div>
              )}

              {/* Ações manuais */}
              <div className="mt-5 border-t border-slate-100 pt-4">
                <h4 className="mb-2 text-sm font-semibold text-slate-700">Ações manuais</h4>
                <div className="flex flex-wrap gap-2">
                  {f.status === 'agendado' && (
                    <Button variant="destructive" size="sm" onClick={() => onAcao('cancelar_agendada', 'Cancelar fila agendada')}>Cancelar fila</Button>
                  )}
                  {f.status === 'erro' && (
                    <Button variant="secondary" size="sm" onClick={() => onAcao('reprocessar_erro', 'Reprocessar fila com erro')}>Reprocessar</Button>
                  )}
                  {f.status === 'analise_manual' && (
                    <Button variant="secondary" size="sm" onClick={() => onAcao('liberar_analise_manual', 'Liberar análise manual')}>Liberar (cancelar)</Button>
                  )}
                  {!['agendado', 'erro', 'analise_manual'].includes(f.status) && (
                    <span className="text-xs text-slate-400">Nenhuma ação manual disponível para este status.</span>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogBody>
      </DialogContent>
    </Dialog>
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
