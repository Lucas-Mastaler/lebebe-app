'use client'

import { ChevronLeft, ChevronRight, Eye, MessageCircle, MessageSquare } from 'lucide-react'
import { Badge, Button, ResponsiveTable } from '@/components/design-system'
import { TABLE_PAGE_SIZE } from '@/lib/design-system/pagination'
import type { RowTone } from '@/lib/design-system/row-tones'
import type { SgiDocumento } from '@/types/sgi'

type DigisacRowState = 'neutro' | 'ok' | 'sem_conversa' | 'sem_ciclo' | 'erro' | 'processando'

function getDigisacRowState(venda: SgiDocumento): DigisacRowState {
  const status = venda.digisac_status
  if (!status) return 'neutro'
  if (status === 'erro') return 'erro'
  if (status === 'pendente' || status === 'processando') return 'processando'
  if (status !== 'concluido' && status !== 'ignorado_cache_valido') return 'neutro'
  if ((venda.digisac_chamados_ciclo ?? 0) > 0) return 'ok'
  return (venda.digisac_total_historico ?? 0) > 0 ? 'sem_ciclo' : 'sem_conversa'
}

function getDigisacRowTone(venda: SgiDocumento): RowTone | undefined {
  const state = getDigisacRowState(venda)
  if (state === 'sem_conversa' || state === 'erro') return 'dangerSubtle'
  if (state === 'sem_ciclo') return 'warning'
  return state === 'processando' ? 'info' : undefined
}

function brl(value: number | null | undefined): string {
  return value == null ? '—' : value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatData(iso: string | null | undefined): string {
  if (!iso) return '—'
  try { return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) } catch { return iso }
}

function formatDias(dias: number | null | undefined): string {
  if (dias == null) return '—'
  return dias < 1 ? '< 1 dia' : `${dias} dia${dias !== 1 ? 's' : ''}`
}

function statusBadge(status: string | null) {
  if (!status) return '—'
  const lower = status.toLowerCase()
  return <Badge tone={lower === 'finalizado' ? 'success' : lower === 'cancelado' ? 'danger' : 'neutral'}>{status}</Badge>
}

function DigisacStatusCell({ venda }: { venda: SgiDocumento }) {
  const state = getDigisacRowState(venda)
  const title = venda.digisac_ultima_sync ? `Sync: ${new Date(venda.digisac_ultima_sync).toLocaleDateString('pt-BR')}` : undefined
  if (state === 'neutro') return '—'
  if (state === 'ok') return <span className="inline-flex items-center gap-1 text-success" title={title}><MessageCircle className="size-3" />Sincronizado</span>
  if (state === 'sem_conversa') return <Badge tone="danger" title={title}>Sem conversa</Badge>
  if (state === 'sem_ciclo') return <Badge tone="warning" title={title}>Sem chamado no ciclo</Badge>
  if (state === 'erro') return <Badge tone="danger">Erro</Badge>
  return <Badge tone="info">Processando</Badge>
}

function mobileValue(label: string, value: React.ReactNode) {
  return <div><p className="text-xs text-slate-500">{label}</p><div className="mt-0.5 text-sm text-slate-800">{value}</div></div>
}

interface TabelaVendasProps {
  vendas: SgiDocumento[]
  total: number
  page: number
  isLoading?: boolean
  onPageChange: (page: number) => void
  onVerDetalhe: (venda: SgiDocumento) => void
  onObsClick?: (venda: SgiDocumento) => void
}

export function TabelaVendas({ vendas, total, page, isLoading, onPageChange, onVerDetalhe, onObsClick }: TabelaVendasProps) {
  const totalPages = Math.max(1, Math.ceil(total / TABLE_PAGE_SIZE))
  const columns = [
    { key: 'lancamento', header: 'Nº Lanç.', width: 'compact' as const, render: (v: SgiDocumento) => <Button variant="ghost" size="sm" className="h-auto cursor-pointer px-0 font-mono text-primary" onClick={() => onVerDetalhe(v)}>#{v.numero_lancamento}</Button> },
    { key: 'cliente', header: 'Cliente', width: 'content' as const, render: (v: SgiDocumento) => v.cliente ?? '—' },
    { key: 'telefone', header: 'Telefone', width: 'compact' as const, render: (v: SgiDocumento) => v.telefone_principal ?? '—' },
    { key: 'fechamento', header: 'Data fechamento', width: 'compact' as const, render: (v: SgiDocumento) => formatData(v.data_fechamento) },
    { key: 'filial', header: 'Filial', width: 'standard' as const, render: (v: SgiDocumento) => v.filial ?? '—' },
    { key: 'vendedor', header: 'Vendedor', width: 'standard' as const, render: (v: SgiDocumento) => v.vendedor ?? '—' },
    { key: 'operacao', header: 'Operação', width: 'standard' as const, render: (v: SgiDocumento) => v.operacao ?? '—' },
    { key: 'status', header: 'Status', width: 'compact' as const, render: (v: SgiDocumento) => statusBadge(v.status) },
    { key: 'valor', header: 'Valor total', width: 'compact' as const, className: 'text-right', render: (v: SgiDocumento) => brl(v.valor_total) },
    { key: 'recebido', header: 'Valor recebido', width: 'compact' as const, className: 'text-right', render: (v: SgiDocumento) => brl(v.valor_pago_novo) },
    { key: 'troca', header: 'Créd. troca', width: 'compact' as const, className: 'text-right', render: (v: SgiDocumento) => brl(v.valor_credito_troca) },
    { key: 'pendente', header: 'Pendente', width: 'compact' as const, className: 'text-right', render: (v: SgiDocumento) => brl(v.valor_pendente_pagamento) },
    { key: 'desconto', header: 'Desc. %', width: 'compact' as const, className: 'text-right', render: (v: SgiDocumento) => v.percentual_desconto == null ? '—' : `${Number(v.percentual_desconto).toFixed(2).replace('.', ',')}%` },
    { key: 'frete', header: 'Frete', width: 'compact' as const, className: 'text-right', render: (v: SgiDocumento) => brl(v.valor_frete) },
    { key: 'chamados', header: 'Cham. ciclo', width: 'compact' as const, render: (v: SgiDocumento) => v.digisac_chamados_ciclo ?? '—' },
    { key: 'interacoes', header: 'Interações', width: 'compact' as const, render: (v: SgiDocumento) => v.digisac_interacoes_ciclo ?? '—' },
    { key: 'contato', header: '1º contato', width: 'compact' as const, render: (v: SgiDocumento) => v.digisac_primeiro_contato === 'ativo' ? <Badge tone="info">Ativo</Badge> : v.digisac_primeiro_contato === 'receptivo' ? <Badge tone="neutral">Receptivo</Badge> : '—' },
    { key: 'dias', header: 'Dias fech.', width: 'compact' as const, render: (v: SgiDocumento) => formatDias(v.digisac_dias_ate_fechamento) },
    { key: 'influentes', header: 'Cham. influente IA', width: 'compact' as const, render: (v: SgiDocumento) => v.digisac_chamados_influentes_ia ?? '—' },
    { key: 'nascimento', header: 'Nascimento bebê', width: 'compact' as const, render: (v: SgiDocumento) => v.previsao_nascimento_bebe ?? '—' },
    { key: 'bebe', header: 'Nome bebê', width: 'content' as const, render: (v: SgiDocumento) => v.nome_bebe ?? '—' },
    { key: 'departamentos', header: 'Depto.', width: 'wide' as const, render: (v: SgiDocumento) => v.departamentos_venda?.join(' · ') || '—' },
    { key: 'subgrupos', header: 'Subgrupo', width: 'wide' as const, render: (v: SgiDocumento) => v.subgrupos_venda?.join(' · ') || '—' },
    { key: 'digisac', header: 'Digisac', width: 'content' as const, render: (v: SgiDocumento) => <DigisacStatusCell venda={v} /> },
  ]

  return <div className="space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm text-slate-600">{total === 0 ? 'Nenhuma venda encontrada' : `${total.toLocaleString('pt-BR')} venda${total !== 1 ? 's' : ''} encontrada${total !== 1 ? 's' : ''}`}</p>{total > 0 && <p className="text-xs text-slate-500">Página {page} de {totalPages}</p>}</div>
    <ResponsiveTable columns={columns} rows={vendas} rowKey={(v) => v.id} firstColumnSticky loading={isLoading} emptyTitle="Nenhuma venda encontrada" emptyDescription="Não há vendas para os filtros selecionados." rowTone={getDigisacRowTone}
      rowActions={(v) => <div className="flex justify-end gap-1"><Button variant="ghost" size="icon" aria-label="Observações" onClick={() => onObsClick?.(v)}><MessageSquare /></Button><Button variant="ghost" size="icon" aria-label="Ver detalhes" onClick={() => onVerDetalhe(v)}><Eye /></Button></div>}
      renderMobileCard={(v) => <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-start justify-between gap-3"><div><p className="font-mono font-semibold text-primary">#{v.numero_lancamento}</p><p className="mt-1 font-medium text-slate-900">{v.cliente ?? '—'}</p></div>{statusBadge(v.status)}</div><div className="mt-4 grid grid-cols-2 gap-3">{mobileValue('Fechamento', formatData(v.data_fechamento))}{mobileValue('Valor total', brl(v.valor_total))}{mobileValue('Filial', v.filial ?? '—')}{mobileValue('Digisac', <DigisacStatusCell venda={v} />)}</div><div className="mt-4 flex justify-end gap-2"><Button variant="ghost" size="sm" onClick={() => onObsClick?.(v)}><MessageSquare />Observações</Button><Button variant="secondary" size="sm" onClick={() => onVerDetalhe(v)}><Eye />Detalhes</Button></div></article>}
    />
    {totalPages > 1 && <div className="flex items-center justify-between"><Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}><ChevronLeft />Anterior</Button><span className="text-xs text-slate-500">{page} / {totalPages}</span><Button variant="secondary" size="sm" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>Próxima<ChevronRight /></Button></div>}
  </div>
}
