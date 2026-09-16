'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import Link from 'next/link'
import { Loader2, Phone, Package, CreditCard, User, MessageCircle, RefreshCw, CheckCircle2, AlertCircle, Clock, TrendingUp, Users, Activity, Tag, MessageSquarePlus, Eye, Store, Brain, ChevronDown, ChevronUp, HelpCircle, ExternalLink } from 'lucide-react'
import { montarUrlHistoricoTicket } from '@/lib/digisac/urls'
import {
  Alert, Badge, Dialog, DialogBody, DialogContent, DialogHeader, Progress, ResponsiveTable,
  Section as DsSection, Textarea,
} from '@/components/design-system'
import { getSectionToneAt } from '@/lib/design-system/section-tones'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import {
  Tooltip, TooltipTrigger, TooltipContent
} from '@/components/ui/tooltip'
import type { SgiDocumento, SgiVendaDetalhe, SgiVendaClienteResumo } from '@/types/sgi'
import type { Agendamento } from '@/types'

interface DigisacSyncStatus {
  jobId: string | null
  status: 'nao_encontrado' | 'pendente' | 'processando' | 'concluido' | 'erro' | 'ignorado_cache_valido'
  tipoSincronizacao?: string
  resultadoJson?: {
    totalHistorico?: number
    totalNovosOuAtualizados?: number
    totalJanela90Dias?: number
    totalCicloVenda?: number
    inicioCicloVenda?: string
    fimCicloVenda?: string
    vendaAnterior?: string | null
    primeiroChamadoCiclo?: string | null
    totalAtivos?: number
    totalReceptivos?: number
    totalIndefinidos?: number
    totalInteracoes?: number
    ultimaAtualizacao?: string
    filtroPorCampo?: string
    semChamados?: boolean
    errosVariacoes?: string[]
    resultadoCache?: {
      ultimaAtualizacao?: string
      totalHistorico?: number
      totalJanela90Dias?: number
      totalCicloVenda?: number
      inicioCicloVenda?: string
      fimCicloVenda?: string
      vendaAnterior?: string | null
      primeiroChamadoCiclo?: string | null
      totalAtivos?: number
      totalReceptivos?: number
      totalIndefinidos?: number
      totalInteracoes?: number
    }
  } | null
  erroMensagem?: string | null
  finalizadoEm?: string | null
  solicitadoEm?: string | null
}

function DeptoChip({ depto }: { depto: string }) {
  const tone = ({
    'Móveis': 'info',
    'P. Pesada': 'warning',
    Roupas: 'brand',
    Enxoval: 'success',
    'Puericultura leve': 'info',
  } as const)[depto] ?? 'neutral'

  return <Badge tone={tone}>{depto}</Badge>
}

function VendaStatusBadge({ status }: { status: string | null | undefined }) {
  const normalized = status?.toLowerCase() ?? ''
  const tone = normalized.includes('conclu') ? 'success'
    : normalized.includes('canc') ? 'danger'
      : normalized.includes('pend') ? 'warning'
        : 'neutral'

  return <Badge tone={tone}>{status ?? '—'}</Badge>
}

function DigisacStatusBadge({ status }: { status: string | null | undefined }) {
  const tone = status === 'concluido' || status === 'ignorado_cache_valido' ? 'success'
    : status === 'erro' ? 'danger'
      : status === 'processando' || status === 'pendente' ? 'info'
        : 'neutral'
  const label = status === 'concluido' ? 'Sincronizado'
    : status === 'ignorado_cache_valido' ? 'Cache válido'
      : status === 'erro' ? 'Erro'
        : status === 'pendente' ? 'Pendente'
          : status === 'processando' ? 'Processando'
            : status ?? '—'

  return <Badge tone={tone}>{label}</Badge>
}

function TipoChamadoBadge({ tipo }: { tipo: string | null | undefined }) {
  const tone = tipo === 'ativo' ? 'info' : tipo === 'receptivo' ? 'success' : 'neutral'
  const label = tipo === 'ativo' ? 'Ativo' : tipo === 'receptivo' ? 'Receptivo' : 'Indefinido'

  return <Badge tone={tone}>{label}</Badge>
}

function formatDias(dias: number | null | undefined): string {
  if (dias == null) return '—'
  if (dias < 1) return '< 1 dia'
  return `${dias} dia${dias !== 1 ? 's' : ''}`
}

function brl(value: number | null | undefined): string {
  if (value == null) return '—'
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatData(iso: string | null | undefined): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  } catch {
    return iso
  }
}

// Exibe datas de negócio (ciclo de venda) sem conversão UTC→local
// Evita que 2026-01-01T00:00:00Z vire 31/12/2025 no fuso -03:00
function formatDataNegocio(iso: string | null | undefined): string {
  if (!iso) return '—'
  try {
    // Extrai apenas a parte YYYY-MM-DD sem interpretar timezone
    const parte = iso.split('T')[0]
    const [y, m, d] = parte.split('-')
    return `${d}/${m}/${y}`
  } catch {
    return iso
  }
}

// Formata data apenas (sem hora)
function formatDataSimples(iso: string | null | undefined): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric'
    })
  } catch {
    return iso
  }
}

// ─── Seção de observações inline (fora do ModalDetalheVenda para isolar re-renders) ──────────

type ObsItem = { id: string; observacao: string; criado_por: string | null; created_at: string; numero_lancamento?: string }

function ObservacoesInline({ numeroLancamento, open }: { numeroLancamento: string; open: boolean }) {
  const [novaObs, setNovaObs] = useState('')
  const [savingObs, setSavingObs] = useState(false)
  const [obsLista, setObsLista] = useState<ObsItem[]>([])
  const [obsCliente, setObsCliente] = useState<ObsItem[]>([])
  const [obsCarregada, setObsCarregada] = useState(false)
  const [mostrarCliente, setMostrarCliente] = useState(false)

  useEffect(() => {
    if (!open || !numeroLancamento) {
      setObsCarregada(false)
      setObsLista([])
      setObsCliente([])
      setMostrarCliente(false)
      return
    }
    Promise.all([
      fetch(`/api/sgi/observacoes?numeroLancamento=${numeroLancamento}`).then(r => r.json()),
      fetch(`/api/sgi/observacoes/cliente?numeroLancamento=${numeroLancamento}`).then(r => r.json()),
    ]).then(([d1, d2]) => {
      setObsLista(d1.observacoes ?? [])
      setObsCliente(d2.observacoes ?? [])
      setObsCarregada(true)
    }).catch(() => setObsCarregada(true))
  }, [open, numeroLancamento])

  async function handleSalvarObs() {
    if (!novaObs.trim() || !numeroLancamento) return
    setSavingObs(true)
    try {
      const res = await fetch('/api/sgi/observacoes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ numeroLancamento, observacao: novaObs }),
      })
      const data = await res.json()
      if (res.ok) { setObsLista(prev => [data.observacao, ...prev]); setNovaObs('') }
    } finally {
      setSavingObs(false)
    }
  }

  return (
    <div className="space-y-2">
      {/* Campo nova observação */}
      <div className="flex gap-2">
        <Textarea
          className="flex-1 resize-none"
          rows={2}
          placeholder="Adicionar observação..."
          value={novaObs}
          onChange={e => setNovaObs(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSalvarObs() }}
        />
        <Button size="sm" className="self-end" onClick={handleSalvarObs} disabled={savingObs || !novaObs.trim()}>
          {savingObs ? <Loader2 className="w-3 h-3 animate-spin" /> : <Tag className="w-3 h-3" />}
        </Button>
      </div>

      {/* Observações deste lançamento */}
      {!obsCarregada ? (
        <p className="text-xs text-slate-400">Carregando...</p>
      ) : obsLista.length === 0 ? (
        <p className="text-xs text-slate-400 italic">Nenhuma observação ainda.</p>
      ) : (
        <div className="space-y-1.5 max-h-48 overflow-y-auto">
          {obsLista.map(o => (
            <div key={o.id} className="bg-slate-50 rounded-lg px-3 py-2 border border-slate-100">
              <p className="text-xs text-slate-700 whitespace-pre-wrap break-words">{o.observacao}</p>
              <p className="text-[10px] text-slate-400 mt-0.5">{o.criado_por} · {new Date(o.created_at).toLocaleDateString('pt-BR')}</p>
            </div>
          ))}
        </div>
      )}

      {/* Histórico do cliente — outras vendas */}
      {obsCarregada && obsCliente.length > 0 && (
        <div className="border-t border-slate-100 pt-2">
          <button
            className="flex items-center gap-1 text-[10px] font-semibold text-slate-500 uppercase tracking-wide hover:text-slate-700"
            onClick={() => setMostrarCliente(v => !v)}
          >
            <ChevronDown className={`w-3 h-3 transition-transform ${mostrarCliente ? 'rotate-180' : ''}`} />
            Histórico do cliente — outras vendas ({obsCliente.length})
          </button>
          {mostrarCliente && (
            <div className="mt-1.5 space-y-1.5 max-h-40 overflow-y-auto">
              {obsCliente.map(o => (
                <div key={o.id} className="p-2 bg-amber-50 border border-amber-100 rounded-lg">
                  <p className="text-[10px] text-amber-700 font-medium mb-0.5">Lançamento #{o.numero_lancamento}</p>
                  <p className="text-xs text-slate-700 whitespace-pre-wrap break-words">{o.observacao}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">{o.criado_por} · {new Date(o.created_at).toLocaleDateString('pt-BR')}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── ModalDetalheVenda ────────────────────────────────────────────────────────

interface ModalDetalheVendaProps {
  venda: SgiDocumento | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSyncCompleted?: () => void
}

export function ModalDetalheVenda({ venda, open, onOpenChange, onSyncCompleted }: ModalDetalheVendaProps) {
  const [detalhe, setDetalhe] = useState<SgiVendaDetalhe | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [digisacStatus, setDigisacStatus] = useState<DigisacSyncStatus | null>(null)
  const [digisacLoading, setDigisacLoading] = useState(false)
  const [digisacError, setDigisacError] = useState<string | null>(null)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const syncedInSession = useRef(false)

  // Estado para modal secundário de venda do cliente
  const [vendaSecundaria, setVendaSecundaria] = useState<SgiVendaClienteResumo | null>(null)
  const [detalheSecundario, setDetalheSecundario] = useState<SgiVendaDetalhe | null>(null)
  const [loadingSecundario, setLoadingSecundario] = useState(false)
  const [modalSecundarioAberto, setModalSecundarioAberto] = useState(false)

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current)
      pollingRef.current = null
    }
  }, [])

  const fetchDigisacStatus = useCallback(async (numeroLancamento: string) => {
    try {
      const r = await fetch(`/api/sgi/digisac/sync-status?numeroLancamento=${encodeURIComponent(numeroLancamento)}`)
      if (!r.ok) return
      const data: DigisacSyncStatus = await r.json()
      setDigisacStatus(data)
      if (data.status !== 'pendente' && data.status !== 'processando') {
        stopPolling()
        setDigisacLoading(false)
      }
    } catch {
      stopPolling()
      setDigisacLoading(false)
    }
  }, [stopPolling])

  // Handler para abrir modal secundário com detalhes da venda do cliente
  const abrirVendaCliente = useCallback(async (vendaCliente: SgiVendaClienteResumo) => {
    if (vendaCliente.venda_atual) {
      // Se for a venda atual, apenas mostra um aviso ou não faz nada
      // Opcional: scroll para o topo do modal atual
      return
    }

    setVendaSecundaria(vendaCliente)
    setModalSecundarioAberto(true)
    setLoadingSecundario(true)

    try {
      const r = await fetch(`/api/sgi/vendas/${encodeURIComponent(vendaCliente.numero_lancamento)}`)
      if (!r.ok) throw new Error(`Erro ${r.status}`)
      const data: SgiVendaDetalhe = await r.json()
      setDetalheSecundario(data)
    } catch (err) {
      console.error('[ModalDetalheVenda] Erro ao carregar venda secundária:', err)
    } finally {
      setLoadingSecundario(false)
    }
  }, [])

  const fecharModalSecundario = useCallback(() => {
    setModalSecundarioAberto(false)
    setDetalheSecundario(null)
    setVendaSecundaria(null)
  }, [])

  const iniciarSincronizacao = useCallback(async (forcarAtualizacao: boolean) => {
    if (!venda?.numero_lancamento) return
    setDigisacLoading(true)
    setDigisacError(null)
    stopPolling()

    try {
      // 1. Cria o job
      const r1 = await fetch('/api/sgi/digisac/sincronizar-venda', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ numeroLancamento: venda.numero_lancamento, forcarAtualizacao }),
      })
      const job = await r1.json()

      if (!r1.ok) {
        setDigisacError(job.error ?? 'Erro ao criar job')
        setDigisacLoading(false)
        return
      }

      setDigisacStatus({ jobId: job.jobId, status: job.status })

      // Se cache válido, apenas atualiza status
      if (job.status === 'ignorado_cache_valido') {
        setDigisacStatus({
          jobId: job.jobId,
          status: 'ignorado_cache_valido',
          resultadoJson: { resultadoCache: job.resultadoCache, ...job.resultadoCache },
        })
        setDigisacLoading(false)
        return
      }

      // Job criado com sucesso OU já estava pendente — sempre dispara processamento
      if (job.status === 'pendente') {
        // 2. Dispara processamento
        const r2 = await fetch('/api/sgi/digisac/processar-fila', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jobId: job.jobId }),
        })
        const resultado = await r2.json()

        if (!r2.ok) {
          setDigisacError(resultado.error ?? 'Erro ao processar job')
          setDigisacLoading(false)
          return
        }

        setDigisacStatus({
          jobId: job.jobId,
          status: resultado.status,
          tipoSincronizacao: resultado.origemDados,
          resultadoJson: resultado,
          finalizadoEm: resultado.ultimaAtualizacao,
        })
        setDigisacLoading(false)
        if (resultado.status === 'concluido') syncedInSession.current = true
      }
    } catch {
      setDigisacError('Erro de conexão')
      setDigisacLoading(false)
    }
  }, [venda?.numero_lancamento, stopPolling])

  // Busca status Digisac ao abrir o modal
  useEffect(() => {
    if (!open || !venda?.numero_lancamento) {
      setDigisacStatus(null)
      setDigisacError(null)
      stopPolling()
      return
    }
    syncedInSession.current = false
    fetchDigisacStatus(venda.numero_lancamento)
  }, [open, venda?.numero_lancamento, fetchDigisacStatus, stopPolling])

  // Cleanup polling ao fechar + trigger refresh da tabela se houve sync
  useEffect(() => {
    if (!open) {
      stopPolling()
      if (syncedInSession.current) {
        syncedInSession.current = false
        onSyncCompleted?.()
      }
    }
  }, [open, stopPolling, onSyncCompleted])

  useEffect(() => {
    if (!open || !venda?.numero_lancamento) {
      setDetalhe(null)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)

    fetch(`/api/sgi/vendas/${encodeURIComponent(venda.numero_lancamento)}`)
      .then(r => {
        if (!r.ok) throw new Error(`Erro ${r.status}`)
        return r.json()
      })
      .then(data => {
        if (!cancelled) setDetalhe(data)
      })
      .catch(err => {
        if (!cancelled) setError(err.message ?? 'Erro ao carregar detalhe')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [open, venda?.numero_lancamento])

  // ── estado local para Análise IA ──────────────────────────────
  interface IaChamadoAnalise {
    id: string
    digisac_ticket_id: string
    protocolo: string | null
    data_chamado: string | null
    tipo_chamado: string | null
    ordem_ciclo: number | null
    telefone: string | null
    department_nome: string | null
    user_nome: string | null
    status: string
    resumo_chamado: string | null
    influencia_compra: string | null
    grau_influencia: string | null
    motivo_influencia: string | null
    produtos_mencionados: string[]
    objecoes_identificadas: string[]
    intencao_cliente: string | null
    sentimento_cliente: string | null
    pontos_de_atencao: string[]
    confianca_analise: string | null
    transcript_truncado: boolean
    total_mensagens: number | null
    modelo_ia: string | null
    erro_mensagem: string | null
    analisado_em: string | null
    nome_bebe?: string | null
    previsao_nascimento_bebe?: string | null
  }
  interface IaConsolidado {
    resumo_geral: string | null
    chamados_que_influenciaram: { ticket_id: string; protocolo: string | null; resumo: string }[]
    chamados_sem_influencia: { ticket_id: string; protocolo: string | null; resumo: string }[]
    principais_motivos_compra: string[]
    principais_objecoes: string[]
    produtos_de_interesse: string[]
    oportunidades_melhoria: string[]
    conclusao_comercial: string | null
    nome_bebe?: string | null
    previsao_nascimento_bebe?: string | null
    produtos_fechados?: string[] | null
    produtos_interesse_nao_fechados?: string[] | null
    tipo_fechamento?: string | null
    confianca_tipo_fechamento?: string | null
    evidencias_tipo_fechamento?: string[] | null
    negociacoes_prazo?: Array<{
      tipo: 'prazo'
      resumo: string
      data_prometida: string | null
      evidencia: string
      chamado_numero: number | null
      protocolo: string | null
      confianca: string
    }> | null
    negociacoes_frete?: Array<{
      tipo: 'frete'
      valor_original: string | null
      valor_negociado: string | null
      resumo: string
      evidencia: string
      chamado_numero: number | null
      protocolo: string | null
      confianca: string
    }> | null
    negociacoes_desconto?: Array<{
      tipo: 'desconto'
      valor_original: string | null
      valor_final: string | null
      percentual: string | null
      resumo: string
      evidencia: string
      chamado_numero: number | null
      protocolo: string | null
      confianca: string
    }> | null
    negociacoes_pagamento?: Array<{
      tipo: 'pagamento'
      forma: string | null
      houve_link_pagamento: boolean
      link_usado_confirmado: boolean
      resumo: string
      evidencia: string
      chamado_numero: number | null
      protocolo: string | null
      confianca: string
    }> | null
    valores_citados?: Array<{
      valor: string
      contexto: string
      tipo_valor: string
      chamado_numero: number | null
      protocolo: string | null
      confianca: string
    }> | null
    total_chamados_analisados: number
    modelo_ia: string | null
    gerado_em: string | null
  }

  interface DigisacChamadoCiclo {
    digisac_ticket_id: string
    protocolo: string | null
    data_inicio: string | null
    tipo_chamado: string | null
    telefone: string | null
    telefone_ddi: string | null
    departamento: string | null
  }
  interface IaJob {
    id: string
    status: string
    totalChamados: number
    chamadosProcessados: number
    chamadosComErro: number
    finalizadoEm: string | null
  }

  const [digisacChamadosCiclo, setDigisacChamadosCiclo] = useState<DigisacChamadoCiclo[]>([])
  const [digisacChamadosCicloAberto, setDigisacChamadosCicloAberto] = useState(false)
  const [digisacChamadosCicloLoading, setDigisacChamadosCicloLoading] = useState(false)

  const carregarChamadosCiclo = useCallback(async (numeroLancamento: string) => {
    setDigisacChamadosCicloLoading(true)
    try {
      const r = await fetch(`/api/sgi/digisac/chamados-ciclo?numeroLancamento=${encodeURIComponent(numeroLancamento)}`)
      if (r.ok) {
        const data = await r.json()
        setDigisacChamadosCiclo(data.chamados ?? [])
      }
    } catch { /* silencioso */ } finally {
      setDigisacChamadosCicloLoading(false)
    }
  }, [])

  const [iaJob, setIaJob] = useState<IaJob | null>(null)
  const [iaChamados, setIaChamados] = useState<IaChamadoAnalise[]>([])
  const [iaConsolidado, setIaConsolidado] = useState<IaConsolidado | null>(null)
  const [iaProcessando, setIaProcessando] = useState(false)
  const [iaPausado, setIaPausado] = useState(false)
  const [iaErro, setIaErro] = useState<string | null>(null)
  const iaCanceladoRef = useRef(false)
  const iaFilaIdRef = useRef<string | null>(null)
  const [iaChamadoExpandido, setIaChamadoExpandido] = useState<string | null>(null)

  // ── estado local para Agendamentos Futuros ───────────────────
  const [agendamentosFuturos, setAgendamentosFuturos] = useState<Agendamento[]>([])
  const [agendamentosLoading, setAgendamentosLoading] = useState(false)
  const [agendamentosCarregado, setAgendamentosCarregado] = useState(false)
  const [agendamentoExpandido, setAgendamentoExpandido] = useState<string | null>(null)

  const carregarStatusIA = useCallback(async (numeroLancamento: string) => {
    try {
      const r = await fetch(`/api/sgi/ia/analise-status?numeroLancamento=${encodeURIComponent(numeroLancamento)}`)
      if (!r.ok) return
      const data = await r.json()
      if (data.job) setIaJob(data.job)
      if (data.chamados) setIaChamados(data.chamados)
      // Sempre sobrescreve iaConsolidado, inclusive quando null,
      // para não exibir consolidado antigo durante reanálise
      setIaConsolidado(data.consolidado ?? null)
    } catch {
      // silencioso
    }
  }, [])

  useEffect(() => {
    if (!open || !venda?.numero_lancamento) {
      setIaJob(null)
      setIaChamados([])
      setIaConsolidado(null)
      setIaProcessando(false)
      setIaPausado(false)
      setIaErro(null)
      iaFilaIdRef.current = null
      setDigisacChamadosCiclo([])
      setDigisacChamadosCicloAberto(false)
      setAgendamentosFuturos([])
      setAgendamentosCarregado(false)
      setAgendamentoExpandido(null)
      return
    }
    carregarStatusIA(venda.numero_lancamento)
  }, [open, venda?.numero_lancamento, carregarStatusIA])

  // Carrega agendamentos futuros ao abrir o modal
  useEffect(() => {
    if (!open || !venda?.numero_lancamento) return
    let cancelled = false
    setAgendamentosLoading(true)
    setAgendamentosCarregado(false)
    fetch(`/api/sgi/agendamentos-futuros?numeroLancamento=${encodeURIComponent(venda.numero_lancamento)}`)
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(data => { if (!cancelled) { setAgendamentosFuturos(data.agendamentos ?? []); setAgendamentosCarregado(true) } })
      .catch(() => { if (!cancelled) setAgendamentosCarregado(true) })
      .finally(() => { if (!cancelled) setAgendamentosLoading(false) })
    return () => { cancelled = true }
  }, [open, venda?.numero_lancamento])

  const executarLoop = useCallback(async (filaId: string) => {
    iaCanceladoRef.current = false
    setIaProcessando(true)
    setIaPausado(false)
    setIaErro(null)

    try {
      while (!iaCanceladoRef.current) {
        const r2 = await fetch('/api/sgi/ia/processar-proximo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jobId: filaId }),
        })
        const data2 = await r2.json()

        const prog = data2.progresso
        if (prog) {
          setIaJob(prev => prev ? {
            ...prev,
            chamadosProcessados: prog.processados,
            chamadosComErro: prog.comErro,
            status: data2.concluido ? 'concluido' : 'processando',
            finalizadoEm: data2.concluido ? new Date().toISOString() : prev.finalizadoEm,
          } : prev)
        }

        if (data2.concluido) {
          setIaProcessando(false)
          break
        }

        if (!r2.ok && !data2.erroChamado) {
          setIaErro(data2.error ?? 'Erro ao processar chamado')
          break
        }
      }

      if (iaCanceladoRef.current) {
        setIaPausado(true)
      }

      await carregarStatusIA(venda!.numero_lancamento)
    } catch (err) {
      setIaErro(err instanceof Error ? err.message : 'Erro inesperado')
    } finally {
      setIaProcessando(false)
    }
  }, [venda, carregarStatusIA])

  const iniciarAnaliseIA = useCallback(async (reanalisar = false) => {
    if (!venda?.numero_lancamento) return
    setIaErro(null)
    setIaProcessando(true)

    const r1 = await fetch('/api/sgi/ia/iniciar-analise', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ numeroLancamento: venda.numero_lancamento, reanalisar }),
    }).catch(() => null)

    if (!r1) { setIaErro('Erro de conexão'); setIaProcessando(false); return }
    const data1 = await r1.json()

    if (!r1.ok) {
      setIaErro(data1.error ?? 'Erro ao iniciar análise')
      setIaProcessando(false)
      return
    }

    const filaId: string = data1.filaId ?? data1.filaId
    const totalChamados: number = data1.totalChamados ?? iaJob?.totalChamados ?? 0

    iaFilaIdRef.current = filaId
    setIaJob(prev => ({
      id: filaId,
      status: 'processando',
      totalChamados,
      chamadosProcessados: data1.jaEmAndamento ? (prev?.chamadosProcessados ?? 0) : 0,
      chamadosComErro: data1.jaEmAndamento ? (prev?.chamadosComErro ?? 0) : 0,
      finalizadoEm: null,
    }))
    // Limpa dados do job anterior para não misturar com o novo processamento
    if (reanalisar) {
      setIaChamados([])
      setIaConsolidado(null)
    }

    await executarLoop(filaId)
  }, [venda?.numero_lancamento, iaJob, executarLoop])

  const continuarAnaliseIA = useCallback(async () => {
    const filaId = iaFilaIdRef.current ?? iaJob?.id
    if (!filaId) return
    iaFilaIdRef.current = filaId
    setIaProcessando(true)
    setIaPausado(false)
    setIaErro(null)
    await executarLoop(filaId)
  }, [iaJob, executarLoop])

  const digisacSincronizado = digisacStatus?.status === 'concluido' || digisacStatus?.status === 'ignorado_cache_valido'
  const chamadosCiclo = digisacStatus?.resultadoJson?.totalCicloVenda ?? digisacStatus?.resultadoJson?.resultadoCache?.totalCicloVenda ?? 0
  const podeAnalisarIA = digisacSincronizado && chamadosCiclo > 0

  // Chamados influentes IA: Sim ou Parcialmente, só se há análise concluída
  const temAnaliseIa = iaJob?.status === 'concluido' || (iaChamados.length > 0 && iaChamados.some(c => c.status === 'concluido'))
  const chamadosInfluentesIa: number | null = temAnaliseIa
    ? iaChamados.filter(c => c.status === 'concluido' && (c.influencia_compra === 'Sim' || c.influencia_compra === 'Parcialmente')).length
    : null

  let sectionIndex = 0

  function Section({ icon: Icon, title, children }: {
    icon: React.ElementType
    title: string
    children: React.ReactNode
  }) {
    return (
      <DsSection
        icon={<Icon className="h-4 w-4" />}
        title={title}
        tone={getSectionToneAt(sectionIndex++)}
      >
        {children}
      </DsSection>
    )
  }

  function Row({ label, value, tooltip }: { label: string; value: React.ReactNode; tooltip?: string }) {
    return (
      <div className="flex items-start gap-2">
        <span className="text-slate-500 min-w-[160px] text-xs flex items-center gap-1">
          {label}
          {tooltip && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="cursor-help text-slate-400 hover:text-slate-600">
                  <HelpCircle className="w-3 h-3" />
                </span>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs text-xs">
                {tooltip}
              </TooltipContent>
            </Tooltip>
          )}
        </span>
        <span className="text-slate-800 text-xs font-medium flex-1">{value ?? '—'}</span>
      </div>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="!w-[95vw] !sm:w-[85vw] !lg:w-[70vw] !max-w-none"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader title={<>
            Venda #{venda?.numero_lancamento}
            {venda?.cliente && (
              <span className="ml-2 text-slate-500 font-normal text-sm">— {venda.cliente}</span>
            )}
          </>} />
        <DialogBody>

        {loading && (
          <div className="space-y-4 py-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-lg" />
            ))}
          </div>
        )}

        {error && (
          <div className="text-sm text-red-600 py-4">{error}</div>
        )}

        {!loading && !error && detalhe && (
          <div className="space-y-6 py-2">
            {/* Dados principais */}
            <Section icon={User} title="Dados da Venda">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-1.5">
                <Row label="Nº Lançamento" value={detalhe.numero_lancamento} />
                <Row label="Nº Documento" value={detalhe.numero_documento} />
                <Row label="Cliente" value={detalhe.cliente} />
                <Row label="Filial" value={detalhe.filial} />
                <Row label="Vendedor" value={detalhe.vendedor} />
                <Row label="Operação" value={detalhe.operacao} />
                <Row label="Status" value={detalhe.status} />
                <Row label="Reserva" value={detalhe.reserva} />
                <Row label="Emissão" value={detalhe.emissao_texto} />
                <Row label="Data fechamento" value={formatData(detalhe.data_fechamento)} />
              </div>
              {venda?.departamentos_venda && venda.departamentos_venda.length > 0 && (
                <div className="pt-2 border-t border-sky-100 mt-1 flex items-start gap-2">
                  <span className="text-slate-500 min-w-[160px] text-xs">Departamentos</span>
                  <div className="flex flex-wrap gap-1">
                    {venda.departamentos_venda.map(d => <DeptoChip key={d} depto={d} />)}
                  </div>
                </div>
              )}
              {venda?.subgrupos_venda && venda.subgrupos_venda.length > 0 && (
                <div className="flex items-start gap-2">
                  <span className="text-slate-500 min-w-[160px] text-xs">Subgrupos</span>
                  <span className="text-xs text-slate-600">{venda.subgrupos_venda.join(' · ')}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-1.5 pt-2 border-t border-slate-100 mt-2">
                <Row label="Valor mercadorias" value={brl(detalhe.valor_mercadorias)} />
                <Row label="Valor descontos" value={brl(detalhe.valor_descontos)} />
                <Row label="Desconto %" value={detalhe.percentual_desconto_texto ?? (detalhe.percentual_desconto != null ? `${detalhe.percentual_desconto}%` : '—')} />
                <Row label="Frete" value={brl(detalhe.valor_frete)} />
                <Row label="Valor total" value={<span className="font-bold">{brl(detalhe.valor_total)}</span>} />
                <Row label="Valor recebido" value={<span className="text-green-700">{brl(detalhe.valor_pago_novo)}</span>} tooltip="Valor efetivamente recebido na venda em dinheiro, cartão, PIX, boleto ou link de pagamento. Não considera crédito de troca como novo recebimento." />
                <Row label="Crédito de troca" value={<span className="text-violet-700">{brl(detalhe.valor_credito_troca)}</span>} />
                <Row label="Pendente de pagamento" value={<span className="text-amber-700">{brl(detalhe.valor_pendente_pagamento)}</span>} />
              </div>
            </Section>

            {/* Contatos */}
            <Section icon={Phone} title={`Contatos (${detalhe.contatos_lista.length})`}>
              {detalhe.contatos_lista.length === 0 ? (
                <p className="text-xs text-slate-400">Nenhum contato registrado.</p>
              ) : (
                <div className="space-y-1.5">
                  {detalhe.contatos_lista.map(c => (
                    <div key={c.id} className="flex items-center gap-3 text-xs bg-white/60 rounded-lg px-3 py-2 border border-emerald-100">
                      <span className="font-mono text-slate-700">{c.telefone_normalizado ?? c.telefone_original ?? '—'}</span>
                      {c.telefone_normalizado_ddi && (
                        <span className="text-slate-400">DDI: {c.telefone_normalizado_ddi}</span>
                      )}
                      {c.principal && (
                        <span className="ml-auto text-xs bg-sky-100 text-sky-700 px-2 py-0.5 rounded-full font-medium">
                          Principal
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Section>

            {/* Produtos */}
            <Section icon={Package} title={`Produtos (${detalhe.produtos.length})`}>
              {detalhe.produtos.length === 0 ? (
                <p className="text-xs text-slate-400">Nenhum produto registrado.</p>
              ) : (
                <ResponsiveTable
                  columns={[
                    { key: 'codigo', header: 'Código', width: 'compact', render: (p) => <span className="font-mono">{p.codigo ?? '—'}</span> },
                    { key: 'produto', header: 'Produto', width: 'content', render: (p) => p.produto ?? '—' },
                    { key: 'departamento', header: 'Depto.', width: 'compact', render: (p) => p.departamento_classificado && p.departamento_classificado !== 'Não classificado' ? <DeptoChip depto={p.departamento_classificado} /> : '—' },
                    { key: 'subgrupo', header: 'Subgrupo', width: 'standard', render: (p) => p.subgrupo_classificado && p.subgrupo_classificado !== 'Não classificado' ? p.subgrupo_classificado : '—' },
                    { key: 'quantidade', header: 'Qtd', width: 'compact', className: 'text-right', render: (p) => p.quantidade_texto ?? p.quantidade ?? '—' },
                    { key: 'valor', header: 'Valor', width: 'compact', className: 'text-right', render: (p) => <span className="font-medium">{brl(p.valor_total)}</span> },
                  ]}
                  rows={detalhe.produtos}
                  rowKey={(p) => p.id}
                  firstColumnSticky
                  emptyTitle="Nenhum produto registrado"
                  renderMobileCard={(p) => <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><p className="font-medium text-slate-900">{p.produto ?? '—'}</p><p className="mt-1 font-mono text-xs text-slate-500">{p.codigo ?? '—'}</p><div className="mt-3 grid grid-cols-2 gap-3 text-sm"><div><p className="text-xs text-slate-500">Departamento</p><div className="mt-1">{p.departamento_classificado && p.departamento_classificado !== 'Não classificado' ? <DeptoChip depto={p.departamento_classificado} /> : '—'}</div></div><div><p className="text-xs text-slate-500">Quantidade</p><p>{p.quantidade_texto ?? p.quantidade ?? '—'}</p></div><div><p className="text-xs text-slate-500">Subgrupo</p><p>{p.subgrupo_classificado && p.subgrupo_classificado !== 'Não classificado' ? p.subgrupo_classificado : '—'}</p></div><div><p className="text-xs text-slate-500">Valor</p><p className="font-medium">{brl(p.valor_total)}</p></div></div></article>}
                />
              )}
            </Section>

            {/* Vendas do Cliente */}
            <Section icon={Store} title={`Vendas do cliente (${detalhe.vendasCliente?.length ?? 0})`}>
              {!detalhe.vendasCliente || detalhe.vendasCliente.length === 0 ? (
                <p className="text-xs text-slate-400">Nenhuma venda encontrada para este cliente.</p>
              ) : (
                <ResponsiveTable
                  columns={[
                    { key: 'lancamento', header: 'Nº lançamento', width: 'content', render: (v) => <div className="flex items-center gap-1"><span className="font-mono font-semibold">#{v.numero_lancamento}</span>{v.venda_atual && <Badge tone="warning">Atual</Badge>}</div> },
                    { key: 'data', header: 'Data fechamento', width: 'standard', render: (v) => formatDataSimples(v.data_fechamento) },
                    { key: 'filial', header: 'Filial', width: 'standard', render: (v) => v.filial ?? '—' },
                    { key: 'vendedor', header: 'Vendedor', width: 'wide', render: (v) => v.vendedor ?? '—' },
                    { key: 'operacao', header: 'Operação', width: 'standard', render: (v) => v.operacao ?? '—' },
                    { key: 'status', header: 'Status', width: 'content', render: (v) => <VendaStatusBadge status={v.status} /> },
                    { key: 'valor', header: 'Valor total', width: 'compact', className: 'text-right', render: (v) => <span className="font-medium">{brl(v.valor_total)}</span> },
                    { key: 'chamados', header: 'Cham. ciclo', width: 'compact', className: 'text-center', render: (v) => v.digisac_chamados_ciclo ?? '—' },
                    { key: 'digisac', header: 'Digisac', width: 'content', render: (v) => <DigisacStatusBadge status={v.digisac_status} /> },
                    { key: 'acoes', header: 'Ações', width: 'compact', className: 'text-center', render: (v) => !v.venda_atual && <Button variant="ghost" size="icon-sm" className="h-6 w-6" onClick={() => abrirVendaCliente(v)} title="Ver detalhes da venda"><Eye className="w-3.5 h-3.5" /></Button> },
                  ]}
                  rows={detalhe.vendasCliente}
                  rowKey={(v) => v.numero_lancamento}
                  firstColumnSticky
                  rowTone={(v) => v.venda_atual ? 'warning' : undefined}
                  emptyTitle="Nenhuma venda encontrada para este cliente"
                  renderMobileCard={(v) => <article className="rounded-2xl border border-border bg-card p-4 shadow-sm"><div className="flex items-start justify-between gap-3"><p className="font-mono font-semibold">#{v.numero_lancamento}</p>{v.venda_atual && <Badge tone="warning">Atual</Badge>}</div><div className="mt-3 grid grid-cols-2 gap-3 text-sm"><div><p className="text-xs text-muted-foreground">Fechamento</p><p>{formatDataSimples(v.data_fechamento)}</p></div><div><p className="text-xs text-muted-foreground">Valor</p><p className="font-medium">{brl(v.valor_total)}</p></div><div><p className="text-xs text-muted-foreground">Status</p><div className="mt-1"><VendaStatusBadge status={v.status} /></div></div><div><p className="text-xs text-muted-foreground">Digisac</p><div className="mt-1"><DigisacStatusBadge status={v.digisac_status} /></div></div></div>{!v.venda_atual && <Button variant="ghost" size="sm" className="mt-3" onClick={() => abrirVendaCliente(v)}><Eye className="mr-1 size-3.5" />Ver detalhes</Button>}</article>}
                />
              )}
            </Section>

            {detalhe.pedidosPersonalizados && (
              <Section icon={Package} title={`Pedidos personalizados (${detalhe.pedidosPersonalizados.length})`}>
                {detalhe.pedidosPersonalizados.length === 0 ? (
                  <p className="text-xs text-slate-400">Nenhum pedido personalizado encontrado pelo telefone normalizado.</p>
                ) : (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {detalhe.pedidosPersonalizados.map((pedido) => (
                      <article key={pedido.id} className="rounded-lg border border-amber-100 bg-white p-3 text-xs shadow-sm">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <p className="font-semibold text-slate-900">{formatDataSimples(pedido.createdAt)} · {pedido.unidade}</p>
                            <p className="mt-0.5 text-slate-500">{pedido.status}</p>
                          </div>
                          <Button asChild variant="ghost" size="sm" className="h-8">
                            <Link href={`/pedidos-personalizados?pedidoId=${pedido.id}`}>Abrir detalhe</Link>
                          </Button>
                        </div>
                        <dl className="mt-3 grid grid-cols-2 gap-2 text-slate-600">
                          <div><dt className="text-[10px] uppercase text-slate-400">Lançamento</dt><dd className="font-medium">{pedido.numeroLancamento ?? '—'}</dd></div>
                          <div><dt className="text-[10px] uppercase text-slate-400">Pedido de compra</dt><dd className="font-medium">{pedido.numeroPedidoCompra ?? '—'}</dd></div>
                          <div><dt className="text-[10px] uppercase text-slate-400">Tapetes</dt><dd className="font-medium">{pedido.quantidadeTapetes}</dd></div>
                          <div><dt className="text-[10px] uppercase text-slate-400">Pedido ao fornecedor</dt><dd className="font-medium">{formatDataSimples(pedido.dataPedidoFornecedor)}</dd></div>
                          <div><dt className="text-[10px] uppercase text-slate-400">Entrega</dt><dd className="font-medium">{formatDataSimples(pedido.dataEntrega)}</dd></div>
                        </dl>
                      </article>
                    ))}
                  </div>
                )}
              </Section>
            )}

            {/* Digisac */}
            <Section icon={MessageCircle} title="Digisac — Histórico de Chamados">
              {venda?.digisac_dias_ate_fechamento != null && (
                <div className="flex items-center gap-2 pb-2 border-b border-violet-100">
                  <span className="text-xs text-slate-500">Dias até fechamento</span>
                  <span className="text-sm font-semibold text-violet-700">{formatDias(venda.digisac_dias_ate_fechamento)}</span>
                  <span className="text-[10px] text-slate-400">(desde 1º chamado do ciclo)</span>
                </div>
              )}
              <DigisacSyncPanel
                status={digisacStatus}
                loading={digisacLoading}
                error={digisacError}
                onSincronizar={() => iniciarSincronizacao(false)}
                onForcar={() => iniciarSincronizacao(true)}
                chamadosInfluentesIa={chamadosInfluentesIa}
              />
              {/* Botão Ver detalhes dos chamados do ciclo */}
              {(digisacStatus?.status === 'concluido' || digisacStatus?.status === 'ignorado_cache_valido') && (
                <div className="mt-3 pt-3 border-t border-violet-100">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-slate-600">Considerados nesta venda</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      type="button"
                      className="text-xs h-7 text-violet-700 hover:bg-violet-50"
                      onClick={() => {
                        if (!digisacChamadosCicloAberto && digisacChamadosCiclo.length === 0 && venda?.numero_lancamento) {
                          carregarChamadosCiclo(venda.numero_lancamento)
                        }
                        setDigisacChamadosCicloAberto(v => !v)
                      }}
                    >
                      {digisacChamadosCicloAberto ? <ChevronUp className="w-3 h-3 mr-1" /> : <ChevronDown className="w-3 h-3 mr-1" />}
                      Ver detalhes
                    </Button>
                  </div>
                  {digisacChamadosCicloAberto && (
                    digisacChamadosCicloLoading ? (
                      <p className="text-xs text-slate-400">Carregando...</p>
                    ) : digisacChamadosCiclo.length === 0 ? (
                      <p className="text-xs text-slate-400 italic">Nenhum chamado considerado no ciclo desta venda.</p>
                    ) : (
                      <ResponsiveTable
                        columns={[
                          { key: 'data', header: 'Data de início', width: 'content', render: (c) => c.data_inicio ? new Date(c.data_inicio).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—' },
                          { key: 'tipo', header: 'Tipo', width: 'content', render: (c) => <TipoChamadoBadge tipo={c.tipo_chamado} /> },
                          { key: 'telefone', header: 'Telefone', width: 'content', render: (c) => <span className="font-mono">{c.telefone ?? c.telefone_ddi ?? '—'}</span> },
                          { key: 'protocolo', header: 'Protocolo', width: 'content', render: (c) => c.protocolo ? <a href={montarUrlHistoricoTicket(c.digisac_ticket_id)} target="_blank" rel="noopener noreferrer" className="inline-flex cursor-pointer items-center gap-1 text-primary hover:underline"><span className="font-mono">{c.protocolo}</span><ExternalLink className="size-3" /></a> : '—' },
                        ]}
                        rows={digisacChamadosCiclo}
                        rowKey={(c) => c.digisac_ticket_id}
                        firstColumnSticky
                        emptyTitle="Nenhum chamado considerado no ciclo desta venda"
                        renderMobileCard={(c) => <article className="rounded-2xl border border-border bg-card p-4 shadow-sm"><div className="flex items-start justify-between gap-3"><TipoChamadoBadge tipo={c.tipo_chamado} /><span className="font-mono text-xs">{c.protocolo ?? '—'}</span></div><div className="mt-3 space-y-2 text-sm"><p><span className="text-xs text-muted-foreground">Início</span><br />{c.data_inicio ? new Date(c.data_inicio).toLocaleString('pt-BR') : '—'}</p><p><span className="text-xs text-muted-foreground">Telefone</span><br /><span className="font-mono">{c.telefone ?? c.telefone_ddi ?? '—'}</span></p></div></article>}
                      />
                    )
                  )}
                </div>
              )}

              {/* Agendamentos futuros */}
              <div className="mt-4 pt-4 border-t border-violet-100">
                <div className="flex items-center gap-2 mb-3">
                  <Clock className="w-3.5 h-3.5 text-violet-500" />
                  <span className="text-xs font-semibold text-violet-700">Agendamentos futuros</span>
                  {agendamentosCarregado && (
                    <span className="ml-auto text-[10px] text-slate-400">
                      {agendamentosFuturos.length === 0 ? 'Nenhum' : `${agendamentosFuturos.length} encontrado${agendamentosFuturos.length !== 1 ? 's' : ''}`}
                    </span>
                  )}
                </div>

                {agendamentosLoading && (
                  <div className="space-y-1.5">
                    <div className="h-6 bg-violet-100/60 rounded animate-pulse" />
                    <div className="h-6 bg-violet-100/40 rounded animate-pulse" />
                  </div>
                )}

                {!agendamentosLoading && agendamentosCarregado && agendamentosFuturos.length === 0 && (
                  <p className="text-xs text-slate-400 italic">
                    Nenhum agendamento futuro encontrado para este cliente.
                  </p>
                )}

                {!agendamentosLoading && agendamentosFuturos.length > 0 && (
                  <div className="space-y-3">
                    <ResponsiveTable
                      columns={[
                        { key: 'loja', header: 'Loja', width: 'standard', render: (ag) => ag.loja || '—' },
                        { key: 'consultora', header: 'Consultora', width: 'standard', render: (ag) => ag.consultora || '—' },
                        { key: 'whatsapp', header: 'Nome WhatsApp', width: 'content', render: (ag) => ag.nomeWhatsapp || '—' },
                        { key: 'digisac', header: 'Nome Digisac', width: 'content', render: (ag) => ag.nomeDigisac || '—' },
                        { key: 'mensagem', header: 'Mensagem', width: 'wide', render: (ag) => ag.mensagemAgendada || '—' },
                        { key: 'comentario', header: 'Comentário', width: 'wide', render: (ag) => ag.comentario || '—' },
                        { key: 'tags', header: 'Tags', width: 'content', render: (ag) => ag.tags ? <Badge tone="brand">{ag.tags}</Badge> : '—' },
                        { key: 'agendado', header: 'Agendado', width: 'compact', render: (ag) => ag.agendadoDia || '—' },
                      ]}
                      rows={agendamentosFuturos}
                      rowKey={(ag) => ag.id}
                      firstColumnSticky
                      rowActions={(ag) => <Button variant="ghost" size="sm" onClick={() => setAgendamentoExpandido(agendamentoExpandido === ag.id ? null : ag.id)}>{agendamentoExpandido === ag.id ? 'Fechar' : 'Detalhes'}</Button>}
                      renderMobileCard={(ag) => <article><div className="flex items-start justify-between gap-3"><div><p className="font-medium">{ag.nomeWhatsapp || ag.nomeDigisac || '—'}</p><p className="mt-1 text-xs text-muted-foreground">{ag.agendadoDia || '—'}</p></div>{ag.tags && <Badge tone="brand">{ag.tags}</Badge>}</div><div className="mt-3 space-y-2 text-sm"><p><span className="text-muted-foreground">Loja:</span> {ag.loja || '—'}</p><p><span className="text-muted-foreground">Consultora:</span> {ag.consultora || '—'}</p><p className="break-words"><span className="text-muted-foreground">Mensagem:</span> {ag.mensagemAgendada || '—'}</p></div></article>}
                    />
                    {agendamentoExpandido && (() => {
                      const ag = agendamentosFuturos.find((item) => item.id === agendamentoExpandido)
                      if (!ag) return null
                      return <div className="grid grid-cols-1 gap-x-6 gap-y-1.5 rounded-xl border border-border bg-muted/30 p-3 text-xs sm:grid-cols-3"><div><span className="text-muted-foreground">Status:</span> <span className="font-medium">{ag.statusLabel || '—'}</span></div><div><span className="text-muted-foreground">Status chamado:</span> <span className="font-medium">{ag.statusChamado || '—'}</span></div><div><span className="text-muted-foreground">Último chamado fechado:</span> <span className="font-medium">{ag.ultimoChamadoFechado || '—'}</span></div><div><span className="text-muted-foreground">Abrir ticket?</span> <span className="font-medium">{ag.abrirTicketLabel || '—'}</span></div><div><span className="text-muted-foreground">Notificar?</span> <span className="font-medium">{ag.notificarLabel || '—'}</span></div><div><span className="text-muted-foreground">Agendado:</span> <span className="font-medium">{ag.agendadoHora || '—'}</span></div><div className="sm:col-span-3"><span className="text-muted-foreground">Comentário:</span> <span className="font-medium">{ag.comentario || '—'}</span></div><div className="sm:col-span-3"><span className="text-muted-foreground">Mensagem agendada:</span> <span className="font-medium whitespace-pre-wrap break-words">{ag.mensagemAgendada || '—'}</span></div></div>
                    })()}
                  </div>
                )}
              </div>
            </Section>

            {/* Análise IA dos Chamados */}
            <Section icon={Brain} title="Análise IA dos Chamados">
              <IaAnalisePanel
                job={iaJob}
                chamados={iaChamados}
                consolidado={iaConsolidado}
                processando={iaProcessando}
                pausado={iaPausado}
                erro={iaErro}
                podeAnalisar={podeAnalisarIA}
                chamadoExpandido={iaChamadoExpandido}
                onExpandirChamado={setIaChamadoExpandido}
                onAnalisar={() => iniciarAnaliseIA(false)}
                onReanalisar={() => iniciarAnaliseIA(true)}
                onContinuar={continuarAnaliseIA}
                onCancelar={() => { iaCanceladoRef.current = true }}
              />
            </Section>

            {/* Pagamentos */}
            <Section icon={CreditCard} title={`Pagamentos (${detalhe.pagamentos.length})`}>
              {detalhe.pagamentos.length === 0 ? (
                <p className="text-xs text-slate-400">Nenhum pagamento registrado.</p>
              ) : (
                <ResponsiveTable
                  columns={[
                    { key: 'forma', header: 'Forma', width: 'content', render: (p) => p.forma_pagamento ?? '—' },
                    { key: 'parcelas', header: 'Parcelas', width: 'compact', className: 'text-right', render: (p) => p.numero_parcelas_texto ?? p.numero_parcelas ?? '—' },
                    { key: 'percentual', header: '%', width: 'compact', className: 'text-right', render: (p) => p.percentual_texto ?? (p.percentual != null ? `${p.percentual}%` : '—') },
                    { key: 'valor', header: 'Valor', width: 'compact', className: 'text-right', render: (p) => <span className="font-medium">{brl(p.valor)}</span> },
                    { key: 'nsu', header: 'NSU', width: 'compact', render: (p) => <span className="font-mono">{p.nsu ?? '—'}</span> },
                    { key: 'autorizacao', header: 'Autorização', width: 'compact', render: (p) => <span className="font-mono">{p.numero_autorizacao ?? '—'}</span> },
                  ]}
                  rows={detalhe.pagamentos}
                  rowKey={(p) => p.id}
                  firstColumnSticky
                  emptyTitle="Nenhum pagamento registrado"
                  renderMobileCard={(p) => <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><p className="font-medium text-slate-900">{p.forma_pagamento ?? '—'}</p><div className="mt-3 grid grid-cols-2 gap-3 text-sm"><div><p className="text-xs text-slate-500">Parcelas</p><p>{p.numero_parcelas_texto ?? p.numero_parcelas ?? '—'}</p></div><div><p className="text-xs text-slate-500">Valor</p><p className="font-medium">{brl(p.valor)}</p></div><div><p className="text-xs text-slate-500">%</p><p>{p.percentual_texto ?? (p.percentual != null ? `${p.percentual}%` : '—')}</p></div><div><p className="text-xs text-slate-500">NSU</p><p className="font-mono">{p.nsu ?? '—'}</p></div></div></article>}
                />
              )}
            </Section>

            {/* Observações Comerciais */}
            <Section icon={MessageSquarePlus} title="Observações Comerciais">
              <ObservacoesInline numeroLancamento={venda?.numero_lancamento ?? ''} open={open} />
            </Section>

          </div>
        )}
        </DialogBody>
      </DialogContent>

      {/* Modal Secundário - Venda do Cliente */}
      <Dialog open={modalSecundarioAberto} onOpenChange={setModalSecundarioAberto}>
        <DialogContent className="!w-[90vw] !sm:w-[80vw] !lg:w-[65vw] !max-w-none">
          <DialogHeader title={<>
              Venda #{vendaSecundaria?.numero_lancamento}
              {vendaSecundaria?.cliente && (
                <span className="ml-2 text-slate-500 font-normal text-sm">— {vendaSecundaria.cliente}</span>
              )}
            </>} />
          <DialogBody>

          {loadingSecundario && (
            <div className="space-y-4 py-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-16 rounded-lg" />
              ))}
            </div>
          )}

          {!loadingSecundario && detalheSecundario && (
            <div className="space-y-4 py-2">
              {/* Dados da venda */}
              <div className="rounded-xl border border-slate-200 p-3 space-y-2 bg-slate-50/50">
                <h4 className="text-xs font-semibold text-slate-700">Dados da Venda</h4>
                <div className="grid grid-cols-2 gap-y-1 text-xs">
                  <div><span className="text-slate-500">Nº Lançamento:</span> <span className="font-mono font-medium">{detalheSecundario.numero_lancamento}</span></div>
                  <div><span className="text-slate-500">Data fechamento:</span> {formatData(detalheSecundario.data_fechamento)}</div>
                  <div><span className="text-slate-500">Cliente:</span> {detalheSecundario.cliente}</div>
                  <div><span className="text-slate-500">Filial:</span> {detalheSecundario.filial}</div>
                  <div><span className="text-slate-500">Vendedor:</span> {detalheSecundario.vendedor}</div>
                  <div><span className="text-slate-500">Status:</span> {detalheSecundario.status}</div>
                  <div><span className="text-slate-500">Valor total:</span> <span className="font-semibold">{brl(detalheSecundario.valor_total)}</span></div>
                </div>
              </div>

              {/* Produtos */}
              {detalheSecundario.produtos.length > 0 && (
                <div className="rounded-xl border border-slate-200 p-3 space-y-2 bg-slate-50/50">
                  <h4 className="text-xs font-semibold text-slate-700">Produtos ({detalheSecundario.produtos.length})</h4>
                  <ResponsiveTable
                    columns={[
                      { key: 'codigo', header: 'Código', width: 'compact', render: (p) => <span className="font-mono">{p.codigo ?? '—'}</span> },
                      { key: 'produto', header: 'Produto', width: 'content', render: (p) => p.produto ?? '—' },
                      { key: 'departamento', header: 'Depto.', width: 'content', render: (p) => p.departamento_classificado && p.departamento_classificado !== 'Não classificado' ? <DeptoChip depto={p.departamento_classificado} /> : '—' },
                      { key: 'valor', header: 'Valor', width: 'compact', className: 'text-right', render: (p) => <span className="font-medium">{brl(p.valor_total)}</span> },
                    ]}
                    rows={detalheSecundario.produtos.slice(0, 5)}
                    rowKey={(p) => p.id}
                    firstColumnSticky
                    renderMobileCard={(p) => <article><p className="font-medium">{p.produto ?? '—'}</p><p className="mt-1 font-mono text-xs text-muted-foreground">{p.codigo ?? '—'}</p><div className="mt-3 flex items-center justify-between gap-3"><div>{p.departamento_classificado && p.departamento_classificado !== 'Não classificado' ? <DeptoChip depto={p.departamento_classificado} /> : '—'}</div><span className="font-medium">{brl(p.valor_total)}</span></div></article>}
                  />
                  {detalheSecundario.produtos.length > 5 && <p className="text-center text-xs text-muted-foreground">+{detalheSecundario.produtos.length - 5} produtos...</p>}
                </div>
              )}

              {/* Digisac resumo */}
              {detalheSecundario.digisac_chamados_ciclo != null && (
                <div className="rounded-xl border border-violet-200 bg-violet-50/30 p-3 space-y-2">
                  <h4 className="text-xs font-semibold text-violet-700 flex items-center gap-1">
                    <MessageCircle className="w-3.5 h-3.5" />
                    Digisac
                  </h4>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="bg-white rounded p-2 text-center">
                      <div className="text-lg font-bold text-violet-600">{detalheSecundario.digisac_chamados_ciclo}</div>
                      <div className="text-[10px] text-slate-500">Chamados no ciclo</div>
                    </div>
                    <div className="bg-white rounded p-2 text-center">
                      <div className="text-lg font-bold text-violet-600">{detalheSecundario.digisac_interacoes_ciclo ?? '—'}</div>
                      <div className="text-[10px] text-slate-500">Interações</div>
                    </div>
                    <div className="bg-white rounded p-2 text-center">
                      <div className="text-lg font-bold text-violet-600">{detalheSecundario.digisac_dias_ate_fechamento ?? '—'}</div>
                      <div className="text-[10px] text-slate-500">Dias até fechamento</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end pt-2">
            <Button variant="outline" size="sm" onClick={fecharModalSecundario}>
              Fechar
            </Button>
          </div>
          </DialogBody>
        </DialogContent>
      </Dialog>
    </Dialog>
  )
}

function DigisacSyncPanel({
  status,
  loading,
  error,
  onSincronizar,
  onForcar,
  chamadosInfluentesIa,
}: {
  status: DigisacSyncStatus | null
  loading: boolean
  error: string | null
  onSincronizar: () => void
  onForcar: () => void
  chamadosInfluentesIa: number | null
}) {
  const resultado = status?.resultadoJson
  const cacheData = resultado?.resultadoCache ?? resultado

  const totalHistorico = cacheData?.totalHistorico ?? 0
  const totalCiclo = resultado?.totalCicloVenda ?? cacheData?.totalCicloVenda ?? resultado?.totalJanela90Dias ?? cacheData?.totalJanela90Dias ?? 0
  const inicioCiclo = resultado?.inicioCicloVenda ?? cacheData?.inicioCicloVenda ?? null
  const fimCiclo = resultado?.fimCicloVenda ?? cacheData?.fimCicloVenda ?? null
  const vendaAnterior = resultado?.vendaAnterior ?? cacheData?.vendaAnterior ?? null
  const primeiroChamadoCiclo = resultado?.primeiroChamadoCiclo ?? cacheData?.primeiroChamadoCiclo ?? null
  const totalAtivos = cacheData?.totalAtivos ?? 0
  const totalReceptivos = cacheData?.totalReceptivos ?? 0
  const totalIndefinidos = cacheData?.totalIndefinidos ?? 0
  const totalInteracoes = cacheData?.totalInteracoes ?? 0
  const ultimaAtualizacao = cacheData?.ultimaAtualizacao ?? status?.finalizadoEm ?? null
  const filtroCampo = resultado?.filtroPorCampo

  const isCacheValido = status?.status === 'ignorado_cache_valido'
  const isConcluido = status?.status === 'concluido' || isCacheValido
  const semChamados = isConcluido && totalHistorico === 0
  const isProcessando = status?.status === 'processando' || status?.status === 'pendente' || loading
  const isErro = status?.status === 'erro'
  const naoEncontrado = !status || status.status === 'nao_encontrado'
  const temDados = isConcluido && totalHistorico > 0

  return (
    <div className="space-y-4">

      {/* ── Linha de status ─────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        {isProcessando && <Badge tone="info"><Loader2 className="mr-1 size-3 animate-spin" />Sincronizando...</Badge>}
        {temDados && !isProcessando && <Badge tone="success"><CheckCircle2 className="mr-1 size-3" />{isCacheValido ? 'Cache válido' : 'Sincronizado'}</Badge>}
        {semChamados && !isProcessando && <Badge tone="neutral"><MessageCircle className="mr-1 size-3" />Nenhum chamado encontrado</Badge>}
        {isErro && <Badge tone="danger"><AlertCircle className="mr-1 size-3" />Erro na sincronização</Badge>}
        {naoEncontrado && !loading && <Badge tone="neutral"><Clock className="mr-1 size-3" />Nunca sincronizado</Badge>}
        {ultimaAtualizacao && (
          <span className="text-xs text-slate-400 ml-auto">
            {new Date(ultimaAtualizacao).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </div>

      {/* ── Mensagens de erro ───────────────────────────────── */}
      {error && <Alert tone="danger" title="Não foi possível sincronizar o Digisac.">{error}</Alert>}
      {isErro && status?.erroMensagem && <Alert tone="danger" title="Erro na sincronização"><span className="font-mono">{status.erroMensagem}</span></Alert>}
      {filtroCampo === 'startedAt' && <Alert tone="warning" title="Filtro limitado pela API Digisac">A API não suporta <code className="font-mono">updatedAt</code>; está sendo usado <code className="font-mono">startedAt</code>, portanto alterações em chamados antigos podem não ter sido capturadas.</Alert>}

      {/* ── Blocos de dados ─────────────────────────────────── */}
      {temDados && (
        <div className="space-y-3">

          {/* Histórico geral do cliente */}
          <div className="rounded-xl border border-violet-200 bg-violet-50/50 p-3 space-y-2">
            <div className="flex items-center gap-1.5 mb-1">
              <Users className="w-3.5 h-3.5 text-violet-500" />
              <span className="text-xs font-semibold text-violet-700">Histórico geral do cliente</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <StatBlock value={totalHistorico} label="Total chamados" color="violet" />
              <StatBlock value={totalInteracoes} label="Interações" color="violet" />
              <StatBlock value={totalAtivos} label="Ativos" color="sky" />
              <StatBlock value={totalReceptivos} label="Receptivos" color="purple" />
            </div>
          </div>

          {/* Considerados nesta venda */}
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3 space-y-2">
            <div className="flex items-center gap-1.5 mb-1">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
              <span className="text-xs font-semibold text-emerald-700">Considerados nesta venda</span>
              <span className="ml-1 text-xs text-emerald-500">(desde a venda anterior até o fechamento)</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <StatBlock value={totalCiclo} label="Chamados no ciclo" color="emerald" large />
              {chamadosInfluentesIa != null ? (
                <StatBlock value={chamadosInfluentesIa} label="Cham. influentes IA" color="emerald" />
              ) : (
                <div className="rounded-lg border border-slate-100 bg-white p-2 text-center">
                  <span className="block text-lg font-bold text-slate-300">—</span>
                  <span className="text-[10px] text-slate-400">Cham. influentes IA</span>
                </div>
              )}
              <StatBlock value={totalIndefinidos} label="Indefinidos" color="slate" />
            </div>
            {(inicioCiclo || fimCiclo || vendaAnterior) && (
              <div className="mt-2 pt-2 border-t border-emerald-100 space-y-1">
                {/* Venda anterior ou mensagem quando não há */}
                {vendaAnterior ? (
                  <p className="text-xs text-emerald-600">
                    Venda anterior: <span className="font-mono font-semibold">#{vendaAnterior}</span>
                  </p>
                ) : (
                  inicioCiclo && (
                    <p className="text-xs text-slate-500">
                      Venda anterior: <span className="text-slate-400">Nenhuma venda anterior encontrada desde {formatDataNegocio(inicioCiclo)}</span>
                    </p>
                  )
                )}
                {/* Período considerado */}
                {inicioCiclo && fimCiclo && (
                  <p className="text-xs text-slate-500">
                    Período considerado: {formatDataNegocio(inicioCiclo)} até {formatDataNegocio(fimCiclo)}
                  </p>
                )}
                {/* Primeiro chamado do ciclo */}
                {primeiroChamadoCiclo ? (
                  <p className="text-xs text-emerald-600">
                    Primeiro chamado do ciclo: <span className="font-medium">{formatData(primeiroChamadoCiclo)}</span>
                  </p>
                ) : (
                  <p className="text-xs text-slate-400">
                    Primeiro chamado do ciclo: —
                  </p>
                )}
              </div>
            )}
          </div>

        </div>
      )}

      {/* ── Botões ──────────────────────────────────────────── */}
      <div className="flex gap-2 pt-1">
        <Button
          size="sm"
          variant="outline"
          type="button"
          disabled={isProcessando}
          onClick={onSincronizar}
          className="text-xs h-8 border-violet-300 text-violet-700 hover:bg-violet-50"
        >
          {isProcessando ? (
            <><Loader2 className="w-3 h-3 mr-1.5 animate-spin" />Sincronizando...</>
          ) : (
            <><Activity className="w-3 h-3 mr-1.5" />{naoEncontrado ? 'Sincronizar com Digisac' : 'Atualizar'}</>
          )}
        </Button>
        {!naoEncontrado && (
          <Button
            size="sm"
            variant="ghost"
            type="button"
            disabled={isProcessando}
            onClick={onForcar}
            className="text-xs h-8 text-slate-500 hover:text-violet-700"
          >
            <RefreshCw className="w-3 h-3 mr-1.5" />
            Forçar atualização
          </Button>
        )}
      </div>
    </div>
  )
}

// ── Badges da análise IA ─────────────────────────────────────

function InfluenciaBadge({ influencia }: { influencia: string | null }) {
  if (!influencia) return <span className="text-muted-foreground">—</span>

  const tone = influencia === 'Sim' ? 'success'
    : influencia === 'Parcialmente' ? 'warning'
      : influencia === 'Não' ? 'danger'
        : 'neutral'
  return <Badge tone={tone}>{influencia}</Badge>
}

function GrauInfluenciaBadge({ grau }: { grau: string | null }) {
  if (!grau) return <span className="text-muted-foreground">—</span>

  const tone = grau === 'Alto' ? 'danger'
    : grau === 'Médio' ? 'warning'
      : grau === 'Baixo' ? 'info'
        : 'neutral'
  return <Badge tone={tone}>{grau}</Badge>
}

function IaAnalisePanel({
  job,
  chamados,
  consolidado,
  processando,
  pausado,
  erro,
  podeAnalisar,
  chamadoExpandido,
  onExpandirChamado,
  onAnalisar,
  onReanalisar,
  onContinuar,
  onCancelar,
}: {
  job: { id: string; status: string; totalChamados: number; chamadosProcessados: number; chamadosComErro: number; finalizadoEm: string | null } | null
  chamados: {
    id: string; digisac_ticket_id: string; protocolo: string | null; data_chamado: string | null
    tipo_chamado: string | null; ordem_ciclo: number | null; telefone: string | null
    department_nome: string | null; user_nome: string | null
    status: string; resumo_chamado: string | null; influencia_compra: string | null
    grau_influencia: string | null; motivo_influencia: string | null
    produtos_mencionados: string[]; objecoes_identificadas: string[]
    intencao_cliente: string | null; sentimento_cliente: string | null
    pontos_de_atencao: string[]; confianca_analise: string | null
    transcript_truncado: boolean; total_mensagens: number | null
    modelo_ia: string | null; erro_mensagem: string | null; analisado_em: string | null
    nome_bebe?: string | null; previsao_nascimento_bebe?: string | null
  }[]
  consolidado: {
    resumo_geral: string | null; conclusao_comercial: string | null
    principais_motivos_compra: string[]; principais_objecoes: string[]
    produtos_de_interesse: string[]; oportunidades_melhoria: string[]
    nome_bebe?: string | null; previsao_nascimento_bebe?: string | null
    produtos_fechados?: string[] | null
    produtos_interesse_nao_fechados?: string[] | null
    tipo_fechamento?: string | null
    confianca_tipo_fechamento?: string | null
    evidencias_tipo_fechamento?: string[] | null
    negociacoes_prazo?: Array<{ tipo: 'prazo'; resumo: string; data_prometida: string | null; evidencia: string; chamado_numero: number | null; protocolo: string | null; confianca: string }> | null
    negociacoes_frete?: Array<{ tipo: 'frete'; valor_original: string | null; valor_negociado: string | null; resumo: string; evidencia: string; chamado_numero: number | null; protocolo: string | null; confianca: string }> | null
    negociacoes_desconto?: Array<{ tipo: 'desconto'; valor_original: string | null; valor_final: string | null; percentual: string | null; resumo: string; evidencia: string; chamado_numero: number | null; protocolo: string | null; confianca: string }> | null
    negociacoes_pagamento?: Array<{ tipo: 'pagamento'; forma: string | null; houve_link_pagamento: boolean; link_usado_confirmado: boolean; resumo: string; evidencia: string; chamado_numero: number | null; protocolo: string | null; confianca: string }> | null
    valores_citados?: Array<{ valor: string; contexto: string; tipo_valor: string; chamado_numero: number | null; protocolo: string | null; confianca: string }> | null
    total_chamados_analisados: number; modelo_ia: string | null; gerado_em: string | null
  } | null
  processando: boolean
  pausado: boolean
  erro: string | null
  podeAnalisar: boolean
  chamadoExpandido: string | null
  onExpandirChamado: (id: string | null) => void
  onAnalisar: () => void
  onReanalisar: () => void
  onContinuar: () => void
  onCancelar: () => void
}) {
  const [resumoExpandido, setResumoExpandido] = useState<string | null>(null)
  const [conversaExpandida, setConversaExpandida] = useState<string | null>(null)
  const [conversaLoading, setConversaLoading] = useState(false)
  const [conversaErro, setConversaErro] = useState<string | null>(null)
  const [conversaCache, setConversaCache] = useState<Record<string, { id: string; text: string; isFromMe: boolean; timestamp: number | null }[]>>({})

  const protocoloToTicketId = new Map<string, string>()
  for (const c of chamados) {
    if (c.protocolo && c.digisac_ticket_id) {
      protocoloToTicketId.set(c.protocolo, c.digisac_ticket_id)
    }
  }

  function renderProtocoloLink(protocolo: string | null, ticketId?: string | null) {
    if (!protocolo) return <span className="text-slate-400">—</span>
    const uuid = ticketId ?? protocoloToTicketId.get(protocolo)
    if (!uuid) return <span className="font-mono text-slate-500">{protocolo}</span>
    return (
      <a
        href={montarUrlHistoricoTicket(uuid)}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 hover:underline font-mono"
      >
        {protocolo}
        <ExternalLink className="w-3 h-3" />
      </a>
    )
  }

  function formatarTimestampMensagem(ts: number | null): string | null {
    if (ts === null || ts === undefined) return null
    // Tenta unix seconds (Digisac retorna segundos)
    const dSec = new Date(ts * 1000)
    if (!isNaN(dSec.getTime()) && dSec.getFullYear() > 2000 && dSec.getFullYear() < 2100) {
      return dSec.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    }
    // Fallback: tenta como milissegundos
    const dMs = new Date(ts)
    if (!isNaN(dMs.getTime()) && dMs.getFullYear() > 2000 && dMs.getFullYear() < 2100) {
      return dMs.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    }
    return null
  }

  const nunca = !job
  const emAndamento = processando
  const concluido = !processando && !pausado && job?.status === 'concluido'
  const temErros = (job?.chamadosComErro ?? 0) > 0

  // Progresso seguro: nunca exibe número maior que total
  const total = job?.totalChamados ?? 0
  const processados = Math.min(job?.chamadosProcessados ?? 0, total)
  const porcentagem = total > 0 ? (processados / total) * 100 : 0
  // Chamado sendo processado agora = próximo após os já concluídos, limitado ao total
  const chamadoAtual = Math.min(processados + 1, total)
  const chamadoSelecionado = chamados.find((chamado) => chamado.id === chamadoExpandido)

  return (
    <div className="space-y-4">

      {/* ── Status unificado ── */}
      <div className="flex flex-wrap items-center gap-2">
        {emAndamento && <Badge tone="info"><Loader2 className="mr-1 size-3 animate-spin" />Processando chamado {chamadoAtual} de {total}</Badge>}
        {pausado && !emAndamento && <Badge tone="warning"><Clock className="mr-1 size-3" />Análise pausada — {processados} de {total} processados</Badge>}
        {concluido && !temErros && <Badge tone="success"><CheckCircle2 className="mr-1 size-3" />Análise concluída — {job!.totalChamados} chamados analisados</Badge>}
        {concluido && temErros && <Badge tone="warning"><AlertCircle className="mr-1 size-3" />Análise concluída com {job!.chamadosComErro} erro{job!.chamadosComErro > 1 ? 's' : ''}</Badge>}
        {!emAndamento && !pausado && !concluido && job?.status === 'erro' && <Badge tone="danger"><AlertCircle className="mr-1 size-3" />Erro na análise</Badge>}
        {!emAndamento && !pausado && !concluido && (job?.status === 'pendente' || job?.status === 'processando') && <Badge tone="warning"><AlertCircle className="mr-1 size-3" />Análise incompleta — reanalise para atualizar</Badge>}
        {nunca && !processando && !pausado && <Badge tone="neutral"><Brain className="mr-1 size-3" />Nunca analisado</Badge>}
        {job?.finalizadoEm && concluido && (
          <span className="text-xs text-slate-400">
            {new Date(job.finalizadoEm).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
        {Boolean(job || chamados.length > 0 || consolidado) && (
          <Button
            size="sm"
            variant="outline"
            type="button"
            onClick={onReanalisar}
            disabled={processando}
            className="ml-auto text-xs h-7 border-indigo-300 text-indigo-700 hover:bg-indigo-50"
          >
            <RefreshCw className="w-3 h-3 mr-1" />
            {processando ? 'Reanalisando...' : 'Reanalisar IA'}
          </Button>
        )}
      </div>

      {/* ── Barra de progresso (só durante processamento) ── */}
      {emAndamento && job && (
        <Progress value={porcentagem} label={`Processando chamado ${chamadoAtual} de ${total}`} />
      )}

      {/* ── Erro global ── */}
      {erro && <Alert tone="danger" title="Não foi possível concluir a análise.">{erro}</Alert>}

      {/* ── Alerta: não pode analisar ── */}
      {!podeAnalisar && nunca && !processando && <Alert tone="info">Sincronize o Digisac primeiro e certifique-se de que há chamados no ciclo da venda.</Alert>}

      {/* ── Tabela de chamados ── */}
      {chamados.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-foreground">Chamados do ciclo</p>
          <ResponsiveTable
            columns={[
              { key: 'ordem', header: 'Nº', width: 'compact', render: (c) => <span className="font-semibold text-primary">{c.ordem_ciclo ?? '—'}</span> },
              { key: 'protocolo', header: 'Protocolo', width: 'content', render: (c) => renderProtocoloLink(c.protocolo, c.digisac_ticket_id) },
              { key: 'tipo', header: 'Tipo', width: 'content', render: (c) => <TipoChamadoBadge tipo={c.tipo_chamado} /> },
              { key: 'data', header: 'Data', width: 'compact', render: (c) => c.data_chamado ? new Date(c.data_chamado).toLocaleDateString('pt-BR') : '—' },
              { key: 'departamento', header: 'Loja/Depto.', width: 'content', render: (c) => c.department_nome ?? '—' },
              { key: 'consultora', header: 'Consultora', width: 'content', render: (c) => c.user_nome ?? '—' },
              { key: 'telefone', header: 'Telefone', width: 'content', render: (c) => <span className="font-mono">{c.telefone ?? '—'}</span> },
              { key: 'resumo', header: 'Resumo', width: 'wide', render: (c) => {
                if (c.status === 'erro') return <span className="text-destructive">Erro: {c.erro_mensagem?.slice(0, 60)}</span>
                if (c.status === 'pendente' || c.status === 'processando') return <span className="italic text-muted-foreground">{c.status === 'processando' ? 'Analisando...' : 'Aguardando...'}</span>
                if (!c.resumo_chamado) return <span className="italic text-muted-foreground">Resumo não disponível.</span>
                if (c.resumo_chamado.length <= 160) return c.resumo_chamado
                return <div className="space-y-1"><span>{resumoExpandido === c.id ? c.resumo_chamado : <span className="line-clamp-2">{c.resumo_chamado}</span>}</span><Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={() => setResumoExpandido(resumoExpandido === c.id ? null : c.id)}>{resumoExpandido === c.id ? 'Ocultar resumo' : 'Ver resumo completo'}</Button></div>
              } },
              { key: 'influencia', header: 'Influenciou?', width: 'content', render: (c) => <InfluenciaBadge influencia={c.influencia_compra} /> },
              { key: 'grau', header: 'Grau', width: 'content', render: (c) => <GrauInfluenciaBadge grau={c.grau_influencia} /> },
            ]}
            rows={chamados}
            rowKey={(c) => c.id}
            firstColumnSticky
            renderMobileCard={(c) => <article><div className="flex items-start justify-between gap-3"><div><p className="font-semibold text-primary">Nº {c.ordem_ciclo ?? '—'}</p><p className="mt-1 font-mono text-xs text-muted-foreground">{renderProtocoloLink(c.protocolo, c.digisac_ticket_id)}</p></div><TipoChamadoBadge tipo={c.tipo_chamado} /></div><div className="mt-3 grid grid-cols-2 gap-3 text-sm"><p><span className="text-xs text-muted-foreground">Data</span><br />{c.data_chamado ? new Date(c.data_chamado).toLocaleDateString('pt-BR') : '—'}</p><p><span className="text-xs text-muted-foreground">Telefone</span><br /><span className="font-mono">{c.telefone ?? '—'}</span></p><p><span className="text-xs text-muted-foreground">Influenciou?</span><br /><span className="mt-1 inline-block"><InfluenciaBadge influencia={c.influencia_compra} /></span></p><p><span className="text-xs text-muted-foreground">Grau</span><br /><span className="mt-1 inline-block"><GrauInfluenciaBadge grau={c.grau_influencia} /></span></p></div><p className="mt-3 text-sm"><span className="text-xs text-muted-foreground">Resumo</span><br />{c.resumo_chamado ?? 'Resumo não disponível.'}</p></article>}
            rowActions={(c) => c.status === 'concluido' ? <Button variant="ghost" size="sm" onClick={() => onExpandirChamado(chamadoExpandido === c.id ? null : c.id)}>{chamadoExpandido === c.id ? <ChevronUp className="mr-1 size-3.5" /> : <ChevronDown className="mr-1 size-3.5" />}{chamadoExpandido === c.id ? 'Fechar' : 'Ver detalhes'}</Button> : null}
          />
          {chamadoSelecionado && (
            <div className="rounded-xl border border-border bg-muted/30 p-4 text-sm space-y-3">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3"><p><span className="text-xs font-semibold text-muted-foreground">Data de início</span><br />{chamadoSelecionado.data_chamado ? new Date(chamadoSelecionado.data_chamado).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}</p><p><span className="text-xs font-semibold text-muted-foreground">Tipo</span><br /><span className="mt-1 inline-block"><TipoChamadoBadge tipo={chamadoSelecionado.tipo_chamado} /></span></p><p><span className="text-xs font-semibold text-muted-foreground">Telefone</span><br /><span className="font-mono">{chamadoSelecionado.telefone ?? '—'}</span></p></div>
              {chamadoSelecionado.motivo_influencia && <p><span className="font-semibold">Motivo: </span>{chamadoSelecionado.motivo_influencia}</p>}
              {chamadoSelecionado.intencao_cliente && <p><span className="font-semibold">Intenção: </span>{chamadoSelecionado.intencao_cliente}</p>}
              {chamadoSelecionado.sentimento_cliente && <p><span className="font-semibold">Sentimento: </span>{chamadoSelecionado.sentimento_cliente}</p>}
              {chamadoSelecionado.produtos_mencionados.length > 0 && <p><span className="font-semibold">Produtos: </span>{chamadoSelecionado.produtos_mencionados.join(', ')}</p>}
              {chamadoSelecionado.objecoes_identificadas.length > 0 && <p><span className="font-semibold">Objeções: </span>{chamadoSelecionado.objecoes_identificadas.join(', ')}</p>}
              {chamadoSelecionado.pontos_de_atencao.length > 0 && <p><span className="font-semibold">Pontos de atenção: </span>{chamadoSelecionado.pontos_de_atencao.join(', ')}</p>}
              {(chamadoSelecionado.nome_bebe || chamadoSelecionado.previsao_nascimento_bebe) && <div className="rounded-md border border-info/20 bg-info/10 p-3"><span className="text-xs font-semibold text-info">Bebê: </span>{chamadoSelecionado.nome_bebe && <span className="mr-2">Nome: {chamadoSelecionado.nome_bebe}</span>}{chamadoSelecionado.previsao_nascimento_bebe && <span>Previsão: {chamadoSelecionado.previsao_nascimento_bebe}</span>}</div>}
              <div className="flex flex-wrap gap-3 border-t border-border pt-3 text-xs text-muted-foreground">{chamadoSelecionado.confianca_analise && <span>Confiança: {chamadoSelecionado.confianca_analise}</span>}{chamadoSelecionado.total_mensagens != null && <span>{chamadoSelecionado.total_mensagens} mensagens</span>}{chamadoSelecionado.transcript_truncado && <span className="text-warning">transcript truncado</span>}{chamadoSelecionado.modelo_ia && <span>modelo: {chamadoSelecionado.modelo_ia}</span>}</div>
            </div>
          )}
        </div>
      )}

      {/* ── Histórico do atendimento ── */}
      {chamados.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-indigo-700">Histórico do atendimento</p>
          <div className="space-y-1">
            {chamados.map((c) => (
              <div key={`hist-${c.id}`} className="flex flex-wrap items-center gap-2 text-xs">
                <span className="font-semibold text-indigo-600">Nº {c.ordem_ciclo ?? '—'}</span>
                <span className="font-mono text-slate-600">{renderProtocoloLink(c.protocolo, c.digisac_ticket_id)}</span>
                {c.status === 'concluido' ? (
                  <button
                    onClick={async () => {
                      if (conversaExpandida === c.digisac_ticket_id) {
                        setConversaExpandida(null)
                        return
                      }
                      setConversaExpandida(c.digisac_ticket_id)
                      setConversaErro(null)
                      if (conversaCache[c.digisac_ticket_id]) return
                      setConversaLoading(true)
                      try {
                        const r = await fetch(`/api/sgi/digisac/mensagens?ticketId=${encodeURIComponent(c.digisac_ticket_id)}`)
                        if (!r.ok) throw new Error('Erro ao buscar conversa')
                        const data = await r.json()
                        setConversaCache(prev => ({ ...prev, [c.digisac_ticket_id]: data.mensagens ?? [] }))
                      } catch {
                        setConversaErro('Não foi possível carregar a conversa.')
                      } finally {
                        setConversaLoading(false)
                      }
                    }}
                    className="text-indigo-500 hover:text-indigo-700 text-[10px]"
                  >
                    {conversaExpandida === c.digisac_ticket_id ? 'Ocultar conversa' : 'Ver conversa'}
                  </button>
                ) : c.status === 'erro' ? (
                  <span className="text-[10px] text-red-500 italic">Erro na análise</span>
                ) : (
                  <span className="text-[10px] text-slate-400 italic">Aguardando análise</span>
                )}
                {c.status === 'concluido' && conversaExpandida === c.digisac_ticket_id && (
                  <div className="w-full mt-1">
                    {conversaLoading ? (
                      <div className="flex items-center gap-1.5 text-slate-400 text-[10px] py-1">
                        <Loader2 className="w-3 h-3 animate-spin" /> Carregando conversa...
                      </div>
                    ) : conversaErro ? (
                      <p className="text-red-500 text-[10px] py-1">{conversaErro}</p>
                    ) : (conversaCache[c.digisac_ticket_id] ?? []).length === 0 ? (
                      <p className="text-slate-400 text-[10px] italic py-1">Nenhuma mensagem encontrada.</p>
                    ) : (
                      <div className="max-h-60 overflow-y-auto bg-slate-50 border border-slate-100 rounded-lg p-2 space-y-1.5">
                        {[...(conversaCache[c.digisac_ticket_id] ?? [])].sort((a, b) => {
                          if (a.timestamp === null && b.timestamp === null) return 0
                          if (a.timestamp === null) return 1
                          if (b.timestamp === null) return -1
                          return a.timestamp - b.timestamp
                        }).map((m) => (
                          <div key={m.id} className={`text-[11px] leading-relaxed ${m.isFromMe ? 'text-right' : 'text-left'}`}>
                            <span className={`inline-block px-2 py-1 rounded-lg max-w-[85%] ${m.isFromMe ? 'bg-indigo-100 text-indigo-800' : 'bg-white text-slate-700 border border-slate-100'}`}>
                              {m.text || '(mensagem sem texto)'}
                              {m.timestamp !== null && (
                                <span className="block text-[8px] text-slate-400 mt-0.5">
                                  {formatarTimestampMensagem(m.timestamp) ?? 'Data não disponível'}
                                </span>
                              )}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Resumo consolidado da venda ── */}
      {consolidado && (
        <div className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-4 space-y-2">
          <p className="text-sm font-semibold text-indigo-700 flex items-center gap-1">
            <Brain className="w-3.5 h-3.5" /> Resumo consolidado da venda
          </p>
          {consolidado.resumo_geral
            ? <p className="text-sm text-slate-700 leading-relaxed">{consolidado.resumo_geral}</p>
            : <p className="text-xs text-slate-400 italic">Resumo consolidado não disponível.</p>
          }
          {consolidado.modelo_ia && (
            <p className="text-xs text-slate-400 pt-1 border-t border-indigo-100">modelo: {consolidado.modelo_ia}</p>
          )}
        </div>
      )}

      {/* ── Avaliação comercial ── */}
      {consolidado && (
        <div className="rounded-xl border border-indigo-100 bg-white p-4 space-y-2">
          <p className="text-sm font-semibold text-indigo-700 flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5" /> Avaliação comercial
          </p>
          {consolidado.conclusao_comercial
            ? <p className="text-sm text-indigo-800 leading-relaxed">{consolidado.conclusao_comercial}</p>
            : <p className="text-xs text-slate-400 italic">Avaliação comercial não disponível.</p>
          }
        </div>
      )}

      {/* ── Dados do bebê ── */}
      {consolidado && (consolidado.nome_bebe || consolidado.previsao_nascimento_bebe) && (
        <div className="rounded-xl border border-pink-200 bg-pink-50/60 p-4 space-y-2">
          <p className="text-sm font-semibold text-pink-700">Dados do bebê</p>
          {consolidado.nome_bebe && (
            <p className="text-sm text-slate-700">Nome: <span className="font-medium">{consolidado.nome_bebe}</span></p>
          )}
          {consolidado.previsao_nascimento_bebe && (
            <p className="text-sm text-slate-700">Previsão de nascimento: <span className="font-medium">{consolidado.previsao_nascimento_bebe}</span></p>
          )}
        </div>
      )}

      {/* ── Análise detalhada ── */}
      {consolidado && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-4">
          <p className="text-sm font-semibold text-slate-700">Análise detalhada</p>

          <div>
            <p className="text-xs font-semibold text-slate-500 mb-1">Principais motivos para fechamento</p>
            {consolidado.principais_motivos_compra.length > 0
              ? <ul className="space-y-1">
                  {consolidado.principais_motivos_compra.map((m, i) => (
                    <li key={`motivo-${i}`} className="text-sm text-slate-700 flex gap-1"><span className="text-indigo-400">•</span>{m}</li>
                  ))}
                </ul>
              : <p className="text-xs text-slate-400 italic">Nenhum item identificado.</p>
            }
          </div>

          <div>
            <p className="text-xs font-semibold text-slate-500 mb-1">Produtos de interesse</p>
            {consolidado.produtos_de_interesse.length > 0
              ? <ul className="space-y-1">
                  {consolidado.produtos_de_interesse.map((p, i) => (
                    <li key={`produto-${i}`} className="text-sm text-slate-700 flex gap-1"><span className="text-emerald-400">•</span>{p}</li>
                  ))}
                </ul>
              : <p className="text-xs text-slate-400 italic">Nenhum item identificado.</p>
            }
          </div>

          {(consolidado.produtos_fechados ?? []).length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-500 mb-1">Produtos fechados</p>
              <ul className="space-y-1">
                {(consolidado.produtos_fechados ?? []).map((p, i) => (
                  <li key={`pfech-${i}`} className="text-sm text-slate-700 flex gap-1"><span className="text-teal-500">✓</span>{p}</li>
                ))}
              </ul>
            </div>
          )}

          {(consolidado.produtos_interesse_nao_fechados ?? []).length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-500 mb-1">Produtos de interesse não fechados / oportunidades de produto</p>
              <ul className="space-y-1">
                {(consolidado.produtos_interesse_nao_fechados ?? []).map((p, i) => (
                  <li key={`pnfech-${i}`} className="text-sm text-slate-700 flex gap-1"><span className="text-orange-400">◦</span>{p}</li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <p className="text-xs font-semibold text-slate-500 mb-1">Objeções da venda</p>
            {consolidado.principais_objecoes.length > 0
              ? <ul className="space-y-1">
                  {consolidado.principais_objecoes.map((o, i) => (
                    <li key={`objecao-${i}`} className="text-sm text-slate-700 flex gap-1"><span className="text-amber-400">•</span>{o}</li>
                  ))}
                </ul>
              : <p className="text-xs text-slate-400 italic">Nenhum item identificado.</p>
            }
          </div>

          <div>
            <p className="text-xs font-semibold text-slate-500 mb-1">Oportunidades comerciais</p>
            {consolidado.oportunidades_melhoria.length > 0
              ? <ul className="space-y-1">
                  {consolidado.oportunidades_melhoria.map((o, i) => (
                    <li key={`oportunidade-${i}`} className="text-sm text-slate-700 flex gap-1"><span className="text-violet-400">•</span>{o}</li>
                  ))}
                </ul>
              : <p className="text-xs text-slate-400 italic">Nenhum item identificado.</p>
            }
          </div>

          {consolidado.tipo_fechamento && (
            <div className="rounded-lg border border-slate-100 bg-slate-50 p-3 space-y-2">
              <p className="text-xs font-semibold text-slate-500">Tipo de fechamento</p>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-slate-700 font-medium">{consolidado.tipo_fechamento}</span>
                {consolidado.confianca_tipo_fechamento && (
                  <Badge tone={consolidado.confianca_tipo_fechamento === 'Alta' ? 'success' : consolidado.confianca_tipo_fechamento === 'Média' ? 'warning' : 'neutral'}>
                    Confiança: {consolidado.confianca_tipo_fechamento}
                  </Badge>
                )}
              </div>
              {(consolidado.evidencias_tipo_fechamento ?? []).length > 0 && (
                <ul className="space-y-1 pt-1">
                  {(consolidado.evidencias_tipo_fechamento ?? []).map((e, i) => (
                    <li key={`evid-${i}`} className="text-xs text-slate-500 flex gap-1"><span className="text-slate-400">—</span>{e}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* ── Negociações comerciais ── */}
          {(() => {
            const prazo = consolidado.negociacoes_prazo ?? []
            const frete = consolidado.negociacoes_frete ?? []
            const desconto = consolidado.negociacoes_desconto ?? []
            const pagamento = consolidado.negociacoes_pagamento ?? []
            const valores = consolidado.valores_citados ?? []
            const temDados = prazo.length > 0 || frete.length > 0 || desconto.length > 0 || pagamento.length > 0 || valores.length > 0
            return (
              <div className="rounded-lg border border-slate-100 bg-slate-50 p-3 space-y-3">
                <p className="text-xs font-semibold text-slate-500">Negociações comerciais</p>
                {!temDados && (
                  <p className="text-xs text-slate-400 italic">Nenhuma negociação comercial identificada.</p>
                )}

                {prazo.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-slate-500">Prazo</p>
                    {prazo.map((item, i) => (
                      <div key={`prazo-${i}`} className="text-xs text-slate-700 bg-white rounded border border-slate-100 p-2 space-y-0.5">
                        <p className="font-medium">{item.resumo}</p>
                        {item.data_prometida && <p className="text-slate-500">Data prometida: <span className="font-medium">{item.data_prometida}</span></p>}
                        <p className="text-slate-400 italic">{item.evidencia}</p>
                        {(item.chamado_numero != null || item.protocolo) && (
                          <p className="text-slate-400">Chamado Nº {item.chamado_numero ?? '?'}{item.protocolo ? ' — ' : ''}{item.protocolo && renderProtocoloLink(item.protocolo)}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {frete.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-slate-500">Frete</p>
                    {frete.map((item, i) => (
                      <div key={`frete-${i}`} className="text-xs text-slate-700 bg-white rounded border border-slate-100 p-2 space-y-0.5">
                        <p className="font-medium">{item.resumo}</p>
                        {item.valor_original && <p className="text-slate-500">Valor original: {item.valor_original}</p>}
                        {item.valor_negociado && <p className="text-slate-500">Valor negociado: {item.valor_negociado}</p>}
                        <p className="text-slate-400 italic">{item.evidencia}</p>
                        {(item.chamado_numero != null || item.protocolo) && (
                          <p className="text-slate-400">Chamado Nº {item.chamado_numero ?? '?'}{item.protocolo ? ' — ' : ''}{item.protocolo && renderProtocoloLink(item.protocolo)}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {desconto.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-slate-500">Desconto</p>
                    {desconto.map((item, i) => (
                      <div key={`desc-${i}`} className="text-xs text-slate-700 bg-white rounded border border-slate-100 p-2 space-y-0.5">
                        <p className="font-medium">{item.resumo}</p>
                        {item.valor_original && <p className="text-slate-500">Valor original: {item.valor_original}</p>}
                        {item.valor_final && <p className="text-slate-500">Valor final: {item.valor_final}</p>}
                        {item.percentual && <p className="text-slate-500">Percentual: {item.percentual}</p>}
                        <p className="text-slate-400 italic">{item.evidencia}</p>
                        {(item.chamado_numero != null || item.protocolo) && (
                          <p className="text-slate-400">Chamado Nº {item.chamado_numero ?? '?'}{item.protocolo ? ' — ' : ''}{item.protocolo && renderProtocoloLink(item.protocolo)}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {pagamento.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-slate-500">Pagamento</p>
                    {pagamento.map((item, i) => (
                      <div key={`pag-${i}`} className="text-xs text-slate-700 bg-white rounded border border-slate-100 p-2 space-y-0.5">
                        <p className="font-medium">{item.resumo}</p>
                        {item.forma && <p className="text-slate-500">Forma: {item.forma}</p>}
                        <p className="text-slate-500">
                          Link:{' '}
                          {!item.houve_link_pagamento
                            ? 'não mencionado'
                            : item.link_usado_confirmado
                              ? 'enviado e usado/confirmado'
                              : 'oferecido/sugerido — não confirmado como enviado ou usado'}
                        </p>
                        <p className="text-slate-400 italic">{item.evidencia}</p>
                        {(item.chamado_numero != null || item.protocolo) && (
                          <p className="text-slate-400">Chamado Nº {item.chamado_numero ?? '?'}{item.protocolo ? ' — ' : ''}{item.protocolo && renderProtocoloLink(item.protocolo)}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {valores.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-slate-500">Valores citados</p>
                    {valores.map((item, i) => (
                      <div key={`val-${i}`} className="text-xs text-slate-700 bg-white rounded border border-slate-100 p-2 space-y-0.5">
                        <p className="font-medium">{item.valor} <span className="text-slate-400 font-normal">— {item.contexto}</span></p>
                        <p className="text-slate-400">Tipo: {item.tipo_valor}</p>
                        {(item.chamado_numero != null || item.protocolo) && (
                          <p className="text-slate-400">Chamado Nº {item.chamado_numero ?? '?'}{item.protocolo ? ' — ' : ''}{item.protocolo && renderProtocoloLink(item.protocolo)}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })()}
        </div>
      )}

      {/* ── Botões ── */}
      <div className="flex gap-2 pt-1 flex-wrap">
        {/* Ainda não iniciado */}
        {nunca && !emAndamento && podeAnalisar && (
          <Button size="sm" variant="outline" type="button" onClick={onAnalisar}
            disabled={processando}
            className="text-xs h-8 border-indigo-300 text-indigo-700 hover:bg-indigo-50">
            {processando ? (
              <><Loader2 className="w-3 h-3 mr-1.5 animate-spin" />Analisando...</>
            ) : (
              <><Brain className="w-3 h-3 mr-1.5" />Analisar com IA</>
            )}
          </Button>
        )}
        {/* Pausado: continuar ou reanalisar */}
        {pausado && !emAndamento && (
          <>
            <Button size="sm" variant="outline" type="button" onClick={onContinuar}
              disabled={processando}
              className="text-xs h-8 border-indigo-300 text-indigo-700 hover:bg-indigo-50">
              {processando ? (
                <><Loader2 className="w-3 h-3 mr-1.5 animate-spin" />Continuando...</>
              ) : (
                <><Brain className="w-3 h-3 mr-1.5" />Continuar análise</>
              )}
            </Button>
            <Button size="sm" variant="ghost" type="button" onClick={onReanalisar}
              disabled={processando}
              className="text-xs h-8 text-slate-500">
              <RefreshCw className="w-3 h-3 mr-1.5" />Reanalisar do zero
            </Button>
          </>
        )}
        {/* Concluído, com erro, stale ou inconsistente: reanalisar */}
        {!emAndamento && !pausado && Boolean(job || chamados.length > 0 || consolidado) && (
          <Button size="sm" variant="outline" type="button" onClick={onReanalisar}
            disabled={processando}
            className="text-xs h-8 border-indigo-300 text-indigo-700 hover:bg-indigo-50">
            {processando ? (
              <><Loader2 className="w-3 h-3 mr-1.5 animate-spin" />Reanalisando...</>
            ) : (
              <><RefreshCw className="w-3 h-3 mr-1.5" />Reanalisar IA</>
            )}
          </Button>
        )}
        {/* Em andamento: cancelar */}
        {emAndamento && (
          <Button size="sm" variant="ghost" type="button" onClick={onCancelar}
            className="text-xs h-8 text-slate-500">
            Pausar
          </Button>
        )}
      </div>
    </div>
  )
}

function StatBlock({
  value,
  label,
  color = 'slate',
  large,
}: {
  value: number
  label: string
  color?: 'violet' | 'sky' | 'purple' | 'emerald' | 'slate'
  large?: boolean
}) {
  const colors = {
    violet:  { bg: 'bg-white border-violet-100',  num: 'text-violet-700' },
    sky:     { bg: 'bg-white border-sky-100',      num: 'text-sky-600' },
    purple:  { bg: 'bg-white border-purple-100',   num: 'text-purple-600' },
    emerald: { bg: 'bg-white border-emerald-200',  num: 'text-emerald-700' },
    slate:   { bg: 'bg-white border-slate-100',    num: 'text-slate-500' },
  }[color]
  return (
    <div className={`rounded-lg border px-3 py-2 text-center ${colors.bg}`}>
      <p className={`font-bold ${large ? 'text-2xl' : 'text-xl'} ${colors.num}`}>{value}</p>
      <p className="text-xs text-slate-400 mt-0.5">{label}</p>
    </div>
  )
}
