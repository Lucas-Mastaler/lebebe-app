'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { Loader2, Phone, Package, CreditCard, User, Building2, Calendar, MessageCircle, RefreshCw, CheckCircle2, AlertCircle, Clock } from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import type { SgiDocumento, SgiVendaDetalhe } from '@/types/sgi'

interface DigisacSyncStatus {
  jobId: string | null
  status: 'nao_encontrado' | 'pendente' | 'processando' | 'concluido' | 'erro' | 'ignorado_cache_valido'
  tipoSincronizacao?: string
  resultadoJson?: {
    totalHistorico?: number
    totalNovosOuAtualizados?: number
    totalJanela90Dias?: number
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

interface ModalDetalheVendaProps {
  venda: SgiDocumento | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ModalDetalheVenda({ venda, open, onOpenChange }: ModalDetalheVendaProps) {
  const [detalhe, setDetalhe] = useState<SgiVendaDetalhe | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [digisacStatus, setDigisacStatus] = useState<DigisacSyncStatus | null>(null)
  const [digisacLoading, setDigisacLoading] = useState(false)
  const [digisacError, setDigisacError] = useState<string | null>(null)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

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
    fetchDigisacStatus(venda.numero_lancamento)
  }, [open, venda?.numero_lancamento, fetchDigisacStatus, stopPolling])

  // Cleanup polling ao fechar
  useEffect(() => {
    if (!open) stopPolling()
  }, [open, stopPolling])

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

  function Section({ icon: Icon, title, children, variant = 'default' }: {
    icon: React.ElementType
    title: string
    children: React.ReactNode
    variant?: 'default' | 'blue' | 'green' | 'amber' | 'purple' | 'rose'
  }) {
    const variantStyles = {
      default: 'bg-slate-50 border-slate-200',
      blue: 'bg-sky-50 border-sky-200',
      green: 'bg-emerald-50 border-emerald-200',
      amber: 'bg-amber-50 border-amber-200',
      purple: 'bg-violet-50 border-violet-200',
      rose: 'bg-rose-50 border-rose-200',
    }

    const iconColors = {
      default: 'text-slate-600',
      blue: 'text-sky-600',
      green: 'text-emerald-600',
      amber: 'text-amber-600',
      purple: 'text-violet-600',
      rose: 'text-rose-600',
    }

    const titleColors = {
      default: 'text-slate-800',
      blue: 'text-sky-800',
      green: 'text-emerald-800',
      amber: 'text-amber-800',
      purple: 'text-violet-800',
      rose: 'text-rose-800',
    }

    return (
      <div className={`rounded-lg border p-4 space-y-3 ${variantStyles[variant]}`}>
        <div className="flex items-center gap-2 border-b border-current/20 pb-2">
          <Icon className={`w-4 h-4 ${iconColors[variant]}`} />
          <h4 className={`text-sm font-semibold ${titleColors[variant]}`}>{title}</h4>
        </div>
        {children}
      </div>
    )
  }

  function Row({ label, value }: { label: string; value: React.ReactNode }) {
    return (
      <div className="flex items-start gap-2 text-sm">
        <span className="text-slate-600 min-w-[160px] text-xs font-medium">{label}</span>
        <span className="text-slate-900 text-xs font-medium">{value ?? '—'}</span>
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
                        <th className="text-left py-1.5 pr-4">Local</th>
                        <th className="text-right py-1.5 pr-4">Qtd</th>
                        <th className="text-right py-1.5">Valor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detalhe.produtos.map(p => (
                        <tr key={p.id} className="border-b border-slate-50">
                          <td className="py-1.5 pr-4 font-mono text-slate-600">{p.codigo ?? '—'}</td>
                          <td className="py-1.5 pr-4 max-w-[200px] truncate" title={p.produto ?? undefined}>{p.produto ?? '—'}</td>
                          <td className="py-1.5 pr-4 text-slate-500">{p.local_estocagem ?? '—'}</td>
                          <td className="py-1.5 pr-4 text-right">{p.quantidade_texto ?? p.quantidade ?? '—'}</td>
                          <td className="py-1.5 text-right font-medium">{brl(p.valor_total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Section>

            {/* Digisac */}
            <Section icon={MessageCircle} title="Digisac — Histórico de Chamados" variant="purple">
              <DigisacSyncPanel
                status={digisacStatus}
                loading={digisacLoading}
                error={digisacError}
                onSincronizar={() => iniciarSincronizacao(false)}
                onForcar={() => iniciarSincronizacao(true)}
              />
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
  const totalJanela = resultado?.totalJanela90Dias ?? 0
  const totalAtivos = cacheData?.totalAtivos ?? 0
  const totalReceptivos = cacheData?.totalReceptivos ?? 0
  const totalIndefinidos = cacheData?.totalIndefinidos ?? 0
  const totalInteracoes = cacheData?.totalInteracoes ?? 0
  const ultimaAtualizacao = cacheData?.ultimaAtualizacao ?? status?.finalizadoEm ?? null
  const filtroCampo = resultado?.filtroPorCampo

  const isCacheValido = status?.status === 'ignorado_cache_valido'
  const isConcluido = status?.status === 'concluido' || isCacheValido
  const semChamados = isConcluido && (resultado?.semChamados === true || totalHistorico === 0)
  const isProcessando = status?.status === 'processando' || status?.status === 'pendente' || loading
  const isErro = status?.status === 'erro'
  const naoEncontrado = !status || status.status === 'nao_encontrado'

  return (
    <div className="space-y-3">
      {/* Linha de status */}
      <div className="flex flex-wrap items-center gap-2">
        {isProcessando && (
          <span className="flex items-center gap-1.5 text-xs text-sky-600 font-medium">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Sincronizando...
          </span>
        )}
        {isConcluido && !isProcessando && !semChamados && (
          <span className="flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
            <CheckCircle2 className="w-3.5 h-3.5" />
            {isCacheValido ? 'Cache válido' : 'Sincronizado'}
          </span>
        )}
        {semChamados && !isProcessando && (
          <span className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
            <MessageCircle className="w-3.5 h-3.5" />
            Nenhum chamado encontrado
          </span>
        )}
        {isErro && (
          <span className="flex items-center gap-1.5 text-xs text-red-600 font-medium">
            <AlertCircle className="w-3.5 h-3.5" />
            Erro na sincronização
          </span>
        )}
        {naoEncontrado && !loading && (
          <span className="flex items-center gap-1.5 text-xs text-slate-400">
            <Clock className="w-3.5 h-3.5" />
            Nunca sincronizado
          </span>
        )}
        {ultimaAtualizacao && (
          <span className="text-xs text-slate-400 ml-auto">
            Atualizado em {new Date(ultimaAtualizacao).toLocaleString('pt-BR', {
              day: '2-digit', month: '2-digit', year: 'numeric',
              hour: '2-digit', minute: '2-digit',
            })}
          </span>
        )}
      </div>

      {error && (
        <p className="text-xs text-red-600">{error}</p>
      )}

      {isErro && status?.erroMensagem && (
        <p className="text-xs text-red-500 bg-red-50 rounded px-2 py-1">{status.erroMensagem}</p>
      )}

      {/* Resumo */}
      {isConcluido && totalHistorico > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          <StatCard label="Histórico total" value={totalHistorico} />
          <StatCard label="Janela 90 dias" value={totalJanela} highlight />
          <StatCard label="Interações" value={totalInteracoes} />
          <StatCard label="Ativos" value={totalAtivos} color="text-sky-700" />
          <StatCard label="Receptivos" value={totalReceptivos} color="text-violet-700" />
          <StatCard label="Indefinidos" value={totalIndefinidos} color="text-slate-500" />
        </div>
      )}

      {filtroCampo === 'startedAt' && (
        <p className="text-xs text-amber-600 bg-amber-50 rounded px-2 py-1">
          ⚠ API Digisac não suporta filtro por updatedAt. Usando startedAt como fallback — alterações em chamados antigos podem não ter sido capturadas.
        </p>
      )}

      {/* Botões */}
      <div className="flex gap-2 pt-1">
        <Button
          size="sm"
          variant="outline"
          disabled={isProcessando}
          onClick={onSincronizar}
          className="text-xs h-7"
        >
          {isProcessando ? (
            <><Loader2 className="w-3 h-3 mr-1.5 animate-spin" />Sincronizando...</>
          ) : (
            <><MessageCircle className="w-3 h-3 mr-1.5" />{naoEncontrado ? 'Sincronizar Digisac' : 'Atualizar'}</>
          )}
        </Button>
        {!naoEncontrado && (
          <Button
            size="sm"
            variant="ghost"
            disabled={isProcessando}
            onClick={onForcar}
            className="text-xs h-7 text-slate-500"
          >
            <RefreshCw className="w-3 h-3 mr-1.5" />
            Forçar atualização
          </Button>
        )}
      </div>
    </div>
  )
}

function StatCard({
  label, value, highlight, color,
}: {
  label: string
  value: number
  highlight?: boolean
  color?: string
}) {
  return (
    <div className={`rounded-lg px-3 py-2 text-center ${highlight ? 'bg-emerald-50' : 'bg-slate-50'}`}>
      <p className={`text-lg font-bold ${color ?? (highlight ? 'text-emerald-700' : 'text-slate-800')}`}>{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  )
}
