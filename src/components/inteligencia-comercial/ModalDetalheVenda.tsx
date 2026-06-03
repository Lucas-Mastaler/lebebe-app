'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { Loader2, Phone, Package, CreditCard, User, MessageCircle, RefreshCw, CheckCircle2, AlertCircle, Clock, TrendingUp, Users, Activity, Tag, MessageSquarePlus, Eye, Store } from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import type { SgiDocumento, SgiVendaDetalhe, SgiVendaClienteResumo } from '@/types/sgi'

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

const DEPTO_CLS: Record<string, string> = {
  'Móveis':           'bg-blue-50 text-blue-700 border-blue-100',
  'P. Pesada':        'bg-orange-50 text-orange-700 border-orange-100',
  'Roupas':           'bg-pink-50 text-pink-700 border-pink-100',
  'Enxoval':          'bg-green-50 text-green-700 border-green-100',
  'Puericultura leve':'bg-violet-50 text-violet-700 border-violet-100',
  'Outros':           'bg-slate-100 text-slate-500 border-slate-200',
  'Não classificado': 'bg-slate-50 text-slate-400 border-slate-100',
}

function DeptoChip({ depto }: { depto: string }) {
  const cls = DEPTO_CLS[depto] ?? 'bg-slate-50 text-slate-500 border-slate-100'
  return (
    <span className={`inline-block text-[10px] font-medium px-1.5 py-0.5 rounded border ${cls}`}>
      {depto}
    </span>
  )
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

  // ── estado local para observações inline ──────────────────────
  const [novaObs, setNovaObs] = useState('')
  const [savingObs, setSavingObs] = useState(false)
  const [obsLista, setObsLista] = useState<{ id: string; observacao: string; criado_por: string | null; created_at: string }[]>([])
  const [obsCarregada, setObsCarregada] = useState(false)

  useEffect(() => {
    if (!open || !venda?.numero_lancamento) { setObsCarregada(false); setObsLista([]); return }
    fetch(`/api/sgi/observacoes?numeroLancamento=${venda.numero_lancamento}`)
      .then(r => r.json())
      .then(d => { setObsLista(d.observacoes ?? []); setObsCarregada(true) })
      .catch(() => setObsCarregada(true))
  }, [open, venda?.numero_lancamento])

  async function handleSalvarObs() {
    if (!novaObs.trim() || !venda?.numero_lancamento) return
    setSavingObs(true)
    try {
      const res = await fetch('/api/sgi/observacoes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ numeroLancamento: venda.numero_lancamento, observacao: novaObs }),
      })
      const data = await res.json()
      if (res.ok) { setObsLista(prev => [data.observacao, ...prev]); setNovaObs('') }
    } finally {
      setSavingObs(false)
    }
  }

  function Section({ icon: Icon, title, children, variant = 'default' }: {
    icon: React.ElementType
    title: string
    children: React.ReactNode
    variant?: 'default' | 'blue' | 'green' | 'amber' | 'brown' | 'purple' | 'rose'
  }) {
    const cfg = {
      default: { bg: 'bg-white', border: 'border-slate-200', accent: 'border-l-slate-400', icon: 'text-slate-500', title: 'text-slate-700', divider: 'border-slate-100' },
      blue:    { bg: 'bg-sky-50/60', border: 'border-sky-200', accent: 'border-l-sky-500', icon: 'text-sky-600', title: 'text-sky-800', divider: 'border-sky-100' },
      green:   { bg: 'bg-emerald-50/60', border: 'border-emerald-200', accent: 'border-l-emerald-500', icon: 'text-emerald-600', title: 'text-emerald-800', divider: 'border-emerald-100' },
      amber:   { bg: 'bg-amber-50/60', border: 'border-amber-200', accent: 'border-l-amber-500', icon: 'text-amber-600', title: 'text-amber-800', divider: 'border-amber-100' },
      brown:   { bg: 'bg-orange-50/60', border: 'border-orange-200', accent: 'border-l-orange-600', icon: 'text-orange-700', title: 'text-orange-900', divider: 'border-orange-100' },
      purple:  { bg: 'bg-violet-50/60', border: 'border-violet-200', accent: 'border-l-violet-500', icon: 'text-violet-600', title: 'text-violet-800', divider: 'border-violet-100' },
      rose:    { bg: 'bg-rose-50/60', border: 'border-rose-200', accent: 'border-l-rose-500', icon: 'text-rose-600', title: 'text-rose-800', divider: 'border-rose-100' },
    }[variant]

    return (
      <div className={`rounded-xl border border-l-4 p-4 space-y-3 ${cfg.bg} ${cfg.border} ${cfg.accent}`}>
        <div className={`flex items-center gap-2 pb-2.5 border-b ${cfg.divider}`}>
          <Icon className={`w-4 h-4 ${cfg.icon}`} />
          <h4 className={`text-sm font-semibold ${cfg.title}`}>{title}</h4>
        </div>
        {children}
      </div>
    )
  }

  function Row({ label, value }: { label: string; value: React.ReactNode }) {
    return (
      <div className="flex items-start gap-2">
        <span className="text-slate-500 min-w-[160px] text-xs">{label}</span>
        <span className="text-slate-800 text-xs font-medium flex-1">{value ?? '—'}</span>
      </div>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!w-[95vw] !sm:w-[85vw] !lg:w-[70vw] !max-w-none max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base">
            Venda #{venda?.numero_lancamento}
            {venda?.cliente && (
              <span className="ml-2 text-slate-500 font-normal text-sm">— {venda.cliente}</span>
            )}
          </DialogTitle>
        </DialogHeader>

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
            <Section icon={User} title="Dados da Venda" variant="blue">
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
                <Row label="Valor pago novo" value={<span className="text-green-700">{brl(detalhe.valor_pago_novo)}</span>} />
                <Row label="Crédito de troca" value={<span className="text-violet-700">{brl(detalhe.valor_credito_troca)}</span>} />
                <Row label="Pendente de pagamento" value={<span className="text-amber-700">{brl(detalhe.valor_pendente_pagamento)}</span>} />
              </div>
            </Section>

            {/* Contatos */}
            <Section icon={Phone} title={`Contatos (${detalhe.contatos_lista.length})`} variant="green">
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
            <Section icon={Package} title={`Produtos (${detalhe.produtos.length})`} variant="amber">
              {detalhe.produtos.length === 0 ? (
                <p className="text-xs text-slate-400">Nenhum produto registrado.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 text-slate-500">
                        <th className="text-left py-1.5 pr-4">Código</th>
                        <th className="text-left py-1.5 pr-4">Produto</th>
                        <th className="text-left py-1.5 pr-4">Depto.</th>
                        <th className="text-left py-1.5 pr-4">Subgrupo</th>
                        <th className="text-right py-1.5 pr-4">Qtd</th>
                        <th className="text-right py-1.5">Valor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detalhe.produtos.map(p => (
                        <tr key={p.id} className="border-b border-slate-50">
                          <td className="py-1.5 pr-4 font-mono text-slate-600">{p.codigo ?? '—'}</td>
                          <td className="py-1.5 pr-4 max-w-[180px] truncate" title={p.produto ?? undefined}>{p.produto ?? '—'}</td>
                          <td className="py-1.5 pr-4">
                            {p.departamento_classificado && p.departamento_classificado !== 'Não classificado'
                              ? <DeptoChip depto={p.departamento_classificado} />
                              : <span className="text-slate-300 text-[10px]">—</span>}
                          </td>
                          <td className="py-1.5 pr-4 text-[10px] text-slate-500">{p.subgrupo_classificado && p.subgrupo_classificado !== 'Não classificado' ? p.subgrupo_classificado : '—'}</td>
                          <td className="py-1.5 pr-4 text-right">{p.quantidade_texto ?? p.quantidade ?? '—'}</td>
                          <td className="py-1.5 text-right font-medium">{brl(p.valor_total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Section>

            {/* Vendas do Cliente */}
            <Section icon={Store} title={`Vendas do cliente (${detalhe.vendasCliente?.length ?? 0})`} variant="brown">
              {!detalhe.vendasCliente || detalhe.vendasCliente.length === 0 ? (
                <p className="text-xs text-slate-400">Nenhuma venda encontrada para este cliente.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 text-slate-500">
                        <th className="text-left py-1.5 pr-3">Nº Lançamento</th>
                        <th className="text-left py-1.5 pr-3">Data fechamento</th>
                        <th className="text-left py-1.5 pr-3">Filial</th>
                        <th className="text-left py-1.5 pr-3">Vendedor</th>
                        <th className="text-left py-1.5 pr-3">Operação</th>
                        <th className="text-left py-1.5 pr-3">Status</th>
                        <th className="text-right py-1.5 pr-3">Valor total</th>
                        <th className="text-center py-1.5 pr-3">Cham. ciclo</th>
                        <th className="text-left py-1.5 pr-3">Digisac</th>
                        <th className="text-center py-1.5">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detalhe.vendasCliente.map((v) => (
                        <tr key={v.numero_lancamento} className={`border-b border-slate-50 ${v.venda_atual ? 'bg-amber-50/50' : ''}`}>
                          <td className="py-1.5 pr-3">
                            <div className="flex items-center gap-1">
                              <span className="font-mono font-semibold text-slate-700">#{v.numero_lancamento}</span>
                              {v.venda_atual && (
                                <span className="text-[10px] bg-amber-200 text-amber-800 px-1.5 py-0.5 rounded-full font-medium">
                                  Atual
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-1.5 pr-3 text-slate-600">{formatDataSimples(v.data_fechamento)}</td>
                          <td className="py-1.5 pr-3 text-slate-600">{v.filial ?? '—'}</td>
                          <td className="py-1.5 pr-3 text-slate-600">{v.vendedor ?? '—'}</td>
                          <td className="py-1.5 pr-3 text-slate-600">{v.operacao ?? '—'}</td>
                          <td className="py-1.5 pr-3">
                            <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${
                              v.status?.toLowerCase().includes('conclu') ? 'bg-green-100 text-green-700' :
                              v.status?.toLowerCase().includes('canc') ? 'bg-red-100 text-red-700' :
                              v.status?.toLowerCase().includes('pend') ? 'bg-amber-100 text-amber-700' :
                              'bg-slate-100 text-slate-600'
                            }`}>
                              {v.status ?? '—'}
                            </span>
                          </td>
                          <td className="py-1.5 pr-3 text-right font-medium">{brl(v.valor_total)}</td>
                          <td className="py-1.5 pr-3 text-center">
                            {v.digisac_chamados_ciclo != null ? (
                              <span className="text-emerald-600 font-medium">{v.digisac_chamados_ciclo}</span>
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>
                          <td className="py-1.5 pr-3">
                            {v.digisac_status ? (
                              <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                v.digisac_status === 'concluido' || v.digisac_status === 'ignorado_cache_valido' ? 'bg-emerald-100 text-emerald-700' :
                                v.digisac_status === 'erro' ? 'bg-red-100 text-red-700' :
                                v.digisac_status === 'processando' || v.digisac_status === 'pendente' ? 'bg-sky-100 text-sky-700' :
                                'bg-slate-100 text-slate-600'
                              }`}>
                                {v.digisac_status === 'concluido' ? 'Sincronizado' :
                                 v.digisac_status === 'ignorado_cache_valido' ? 'Cache válido' :
                                 v.digisac_status === 'erro' ? 'Erro' :
                                 v.digisac_status === 'pendente' ? 'Pendente' :
                                 v.digisac_status === 'processando' ? 'Processando' :
                                 v.digisac_status}
                              </span>
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>
                          <td className="py-1.5 text-center">
                            {!v.venda_atual && (
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                className="h-6 w-6"
                                onClick={() => abrirVendaCliente(v)}
                                title="Ver detalhes da venda"
                              >
                                <Eye className="w-3.5 h-3.5 text-slate-500" />
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Section>

            {/* Digisac */}
            <Section icon={MessageCircle} title="Digisac — Histórico de Chamados" variant="purple">
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
              />
            </Section>

            {/* Observações Comerciais */}
            <Section icon={MessageSquarePlus} title="Observações Comerciais" variant="default">
              <div className="space-y-2">
                <div className="flex gap-2">
                  <textarea
                    className="flex-1 text-sm border border-slate-200 rounded-lg p-2 resize-none focus:outline-none focus:ring-2 focus:ring-sky-200 placeholder:text-slate-400"
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
                {!obsCarregada ? (
                  <p className="text-xs text-slate-400">Carregando...</p>
                ) : obsLista.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">Nenhuma observação ainda.</p>
                ) : (
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {obsLista.map(o => (
                      <div key={o.id} className="bg-slate-50 rounded-lg px-3 py-2 border border-slate-100">
                        <p className="text-xs text-slate-700">{o.observacao}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">{o.criado_por} · {new Date(o.created_at).toLocaleDateString('pt-BR')}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Section>

            {/* Pagamentos */}
            <Section icon={CreditCard} title={`Pagamentos (${detalhe.pagamentos.length})`} variant="rose">
              {detalhe.pagamentos.length === 0 ? (
                <p className="text-xs text-slate-400">Nenhum pagamento registrado.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 text-slate-500">
                        <th className="text-left py-1.5 pr-4">Forma</th>
                        <th className="text-right py-1.5 pr-4">Parcelas</th>
                        <th className="text-right py-1.5 pr-4">%</th>
                        <th className="text-right py-1.5 pr-4">Valor</th>
                        <th className="text-left py-1.5 pr-4">NSU</th>
                        <th className="text-left py-1.5">Autorização</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detalhe.pagamentos.map(p => (
                        <tr key={p.id} className="border-b border-slate-50">
                          <td className="py-1.5 pr-4 max-w-[180px] truncate" title={p.forma_pagamento ?? undefined}>{p.forma_pagamento ?? '—'}</td>
                          <td className="py-1.5 pr-4 text-right">{p.numero_parcelas_texto ?? p.numero_parcelas ?? '—'}</td>
                          <td className="py-1.5 pr-4 text-right">{p.percentual_texto ?? (p.percentual != null ? `${p.percentual}%` : '—')}</td>
                          <td className="py-1.5 pr-4 text-right font-medium">{brl(p.valor)}</td>
                          <td className="py-1.5 pr-4 font-mono text-slate-500">{p.nsu ?? '—'}</td>
                          <td className="py-1.5 font-mono text-slate-500">{p.numero_autorizacao ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Section>

          </div>
        )}
      </DialogContent>

      {/* Modal Secundário - Venda do Cliente */}
      <Dialog open={modalSecundarioAberto} onOpenChange={setModalSecundarioAberto}>
        <DialogContent className="!w-[90vw] !sm:w-[80vw] !lg:w-[65vw] !max-w-none max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base">
              Venda #{vendaSecundaria?.numero_lancamento}
              {vendaSecundaria?.cliente && (
                <span className="ml-2 text-slate-500 font-normal text-sm">— {vendaSecundaria.cliente}</span>
              )}
            </DialogTitle>
          </DialogHeader>

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
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-slate-100 text-slate-500">
                          <th className="text-left py-1 pr-2">Código</th>
                          <th className="text-left py-1 pr-2">Produto</th>
                          <th className="text-left py-1 pr-2">Depto.</th>
                          <th className="text-right py-1">Valor</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detalheSecundario.produtos.slice(0, 5).map((p) => (
                          <tr key={p.id} className="border-b border-slate-50">
                            <td className="py-1 pr-2 font-mono text-slate-600">{p.codigo ?? '—'}</td>
                            <td className="py-1 pr-2 max-w-[150px] truncate" title={p.produto ?? undefined}>{p.produto ?? '—'}</td>
                            <td className="py-1 pr-2">
                              {p.departamento_classificado && p.departamento_classificado !== 'Não classificado'
                                ? <DeptoChip depto={p.departamento_classificado} />
                                : <span className="text-slate-300 text-[10px]">—</span>}
                            </td>
                            <td className="py-1 text-right font-medium">{brl(p.valor_total)}</td>
                          </tr>
                        ))}
                        {detalheSecundario.produtos.length > 5 && (
                          <tr>
                            <td colSpan={4} className="py-1 text-center text-xs text-slate-400">
                              +{detalheSecundario.produtos.length - 5} produtos...
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
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
}: {
  status: DigisacSyncStatus | null
  loading: boolean
  error: string | null
  onSincronizar: () => void
  onForcar: () => void
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
        {isProcessando && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-sky-100 text-sky-700">
            <Loader2 className="w-3 h-3 animate-spin" />
            Sincronizando...
          </span>
        )}
        {temDados && !isProcessando && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
            <CheckCircle2 className="w-3 h-3" />
            {isCacheValido ? 'Cache válido' : 'Sincronizado'}
          </span>
        )}
        {semChamados && !isProcessando && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-500">
            <MessageCircle className="w-3 h-3" />
            Nenhum chamado encontrado
          </span>
        )}
        {isErro && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
            <AlertCircle className="w-3 h-3" />
            Erro na sincronização
          </span>
        )}
        {naoEncontrado && !loading && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-400">
            <Clock className="w-3 h-3" />
            Nunca sincronizado
          </span>
        )}
        {ultimaAtualizacao && (
          <span className="text-xs text-slate-400 ml-auto">
            {new Date(ultimaAtualizacao).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </div>

      {/* ── Mensagens de erro ───────────────────────────────── */}
      {error && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
      )}
      {isErro && status?.erroMensagem && (
        <p className="text-xs text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2 font-mono">{status.erroMensagem}</p>
      )}
      {filtroCampo === 'startedAt' && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          ⚠ API Digisac não suporta filtro por <code className="font-mono">updatedAt</code>. Usando <code className="font-mono">startedAt</code> — alterações em chamados antigos podem não ter sido capturadas.
        </p>
      )}

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
