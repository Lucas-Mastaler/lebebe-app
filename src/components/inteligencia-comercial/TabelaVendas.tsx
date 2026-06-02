'use client'

import { ChevronLeft, ChevronRight, Eye, MessageCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table, TableHeader, TableRow, TableHead,
  TableBody, TableCell
} from '@/components/ui/table'
import type { SgiDocumento } from '@/types/sgi'

const PER_PAGE = 25

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

function statusBadge(status: string | null) {
  if (!status) return <span className="text-slate-400 text-xs">—</span>
  const lower = status.toLowerCase()
  const cls =
    lower === 'finalizado'
      ? 'bg-green-100 text-green-700'
      : lower === 'cancelado'
        ? 'bg-red-100 text-red-700'
        : 'bg-slate-100 text-slate-600'
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cls}`}>
      {status}
    </span>
  )
}

function digisacStatusBadge(status: string | null, ultimaSync: string | null) {
  if (!status) return <span className="text-slate-300 text-xs">—</span>
  if (status === 'concluido' || status === 'ignorado_cache_valido') {
    return (
      <span className="flex items-center gap-1 text-xs text-emerald-600" title={ultimaSync ? `Sync: ${new Date(ultimaSync).toLocaleDateString('pt-BR')}` : undefined}>
        <MessageCircle className="w-3 h-3" />
      </span>
    )
  }
  if (status === 'pendente' || status === 'processando') {
    return <span className="text-xs text-sky-500 animate-pulse">⟳</span>
  }
  if (status === 'erro') {
    return <span className="text-xs text-red-500" title="Erro na sync">!</span>
  }
  return <span className="text-slate-300 text-xs">—</span>
}

interface TabelaVendasProps {
  vendas: SgiDocumento[]
  total: number
  page: number
  isLoading?: boolean
  onPageChange: (page: number) => void
  onVerDetalhe: (venda: SgiDocumento) => void
}

export function TabelaVendas({
  vendas, total, page, isLoading, onPageChange, onVerDetalhe
}: TabelaVendasProps) {
  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE))

  if (isLoading) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="p-4 space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-10 rounded-lg" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
        <span className="text-sm text-slate-600">
          {total === 0
            ? 'Nenhuma venda encontrada'
            : `${total.toLocaleString('pt-BR')} venda${total !== 1 ? 's' : ''} encontrada${total !== 1 ? 's' : ''}`}
        </span>
        {total > 0 && (
          <span className="text-xs text-slate-400">
            Página {page} de {totalPages}
          </span>
        )}
      </div>

      <Table>
        <TableHeader>
          <TableRow className="bg-slate-50">
            <TableHead className="text-xs">Nº Lanç.</TableHead>
            <TableHead className="text-xs">Cliente</TableHead>
            <TableHead className="text-xs">Telefone</TableHead>
            <TableHead className="text-xs">Data Fechamento</TableHead>
            <TableHead className="text-xs">Filial</TableHead>
            <TableHead className="text-xs">Vendedor</TableHead>
            <TableHead className="text-xs">Operação</TableHead>
            <TableHead className="text-xs">Status</TableHead>
            <TableHead className="text-xs text-right">Valor Total</TableHead>
            <TableHead className="text-xs text-right" title="Valor pago em vendas novas (exclui trocas/devoluções)">Pago Novo</TableHead>
            <TableHead className="text-xs text-right">Créd. Troca</TableHead>
            <TableHead className="text-xs text-right">Pendente</TableHead>
            <TableHead className="text-xs text-right">Desc. %</TableHead>
            <TableHead className="text-xs text-right">Frete</TableHead>
            <TableHead className="text-xs text-right" title="Chamados Digisac no ciclo da venda (desde a venda anterior até esta)">Cham. ciclo</TableHead>
            <TableHead className="text-xs text-right" title="Interações no ciclo da venda">Interações</TableHead>
            <TableHead className="text-xs" title="Primeiro tipo de contato no ciclo">1º Contato</TableHead>
            <TableHead className="text-xs" title="Status sincronização Digisac">Digisac</TableHead>
            <TableHead className="text-xs w-10"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {vendas.length === 0 ? (
            <TableRow>
              <TableCell colSpan={20} className="text-center text-slate-400 py-12 text-sm">
                Nenhuma venda encontrada para os filtros selecionados.
              </TableCell>
            </TableRow>
          ) : (
            vendas.map(venda => (
              <TableRow key={venda.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => onVerDetalhe(venda)}>
                <TableCell className="font-mono text-xs font-semibold text-sky-700">
                  #{venda.numero_lancamento}
                </TableCell>
                <TableCell className="text-xs max-w-[150px] truncate" title={venda.cliente ?? undefined}>
                  {venda.cliente ?? '—'}
                </TableCell>
                <TableCell className="text-xs font-mono text-slate-600">
                  {venda.telefone_principal ?? '—'}
                </TableCell>
                <TableCell className="text-xs text-slate-600">
                  {formatData(venda.data_fechamento)}
                </TableCell>
                <TableCell className="text-xs max-w-[120px] truncate" title={venda.filial ?? undefined}>
                  {venda.filial ?? '—'}
                </TableCell>
                <TableCell className="text-xs max-w-[120px] truncate" title={venda.vendedor ?? undefined}>
                  {venda.vendedor ?? '—'}
                </TableCell>
                <TableCell className="text-xs max-w-[120px] truncate" title={venda.operacao ?? undefined}>
                  {venda.operacao ?? '—'}
                </TableCell>
                <TableCell>{statusBadge(venda.status)}</TableCell>
                <TableCell className="text-xs text-right font-medium">{brl(venda.valor_total)}</TableCell>
                <TableCell className="text-xs text-right text-green-700 font-medium">{brl(venda.valor_pago_novo)}</TableCell>
                <TableCell className="text-xs text-right text-violet-700">{brl(venda.valor_credito_troca)}</TableCell>
                <TableCell className="text-xs text-right text-amber-700">{brl(venda.valor_pendente_pagamento)}</TableCell>
                <TableCell className="text-xs text-right">
                  {venda.percentual_desconto != null
                    ? `${Number(venda.percentual_desconto).toFixed(2).replace('.', ',')}%`
                    : '—'}
                </TableCell>
                <TableCell className="text-xs text-right">{brl(venda.valor_frete)}</TableCell>
                <TableCell className="text-xs text-right font-medium">
                  {venda.digisac_chamados_ciclo != null ? (
                    <span className={venda.digisac_chamados_ciclo > 0 ? 'text-sky-700' : 'text-slate-400'}>
                      {venda.digisac_chamados_ciclo}
                    </span>
                  ) : '—'}
                </TableCell>
                <TableCell className="text-xs text-right">
                  {venda.digisac_interacoes_ciclo != null ? (
                    <span className={venda.digisac_interacoes_ciclo > 0 ? 'text-slate-700' : 'text-slate-400'}>
                      {venda.digisac_interacoes_ciclo}
                    </span>
                  ) : '—'}
                </TableCell>
                <TableCell className="text-xs">
                  {venda.digisac_primeiro_contato ? (
                    <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                      venda.digisac_primeiro_contato === 'ativo' ? 'bg-sky-50 text-sky-700' :
                      venda.digisac_primeiro_contato === 'receptivo' ? 'bg-violet-50 text-violet-700' :
                      'bg-slate-50 text-slate-500'
                    }`}>
                      {venda.digisac_primeiro_contato === 'ativo' ? 'Ativo' :
                       venda.digisac_primeiro_contato === 'receptivo' ? 'Receptivo' : 'Indef.'}
                    </span>
                  ) : '—'}
                </TableCell>
                <TableCell className="text-xs">
                  {digisacStatusBadge(venda.digisac_status ?? null, venda.digisac_ultima_sync ?? null)}
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={e => { e.stopPropagation(); onVerDetalhe(venda) }}
                    title="Ver detalhe"
                  >
                    <Eye className="w-3.5 h-3.5" />
                  </Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {totalPages > 1 && (
        <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
          >
            <ChevronLeft className="w-4 h-4" />
            Anterior
          </Button>
          <span className="text-xs text-slate-500">
            {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
          >
            Próxima
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  )
}
