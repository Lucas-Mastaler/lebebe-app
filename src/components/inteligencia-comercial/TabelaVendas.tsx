'use client'

import { useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Eye, MessageCircle, MessageSquare, HelpCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table, TableHeader, TableRow, TableHead,
  TableBody, TableCell
} from '@/components/ui/table'
import {
  Tooltip, TooltipTrigger, TooltipContent
} from '@/components/ui/tooltip'
import type { SgiDocumento } from '@/types/sgi'

// ─── Helpers visuais ──────────────────────────────────────────────────────────

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

// Determina o estado visual Digisac da linha
type DigisacRowState = 'neutro' | 'ok' | 'sem_conversa' | 'sem_ciclo' | 'erro' | 'processando'

function getDigisacRowState(venda: SgiDocumento): DigisacRowState {
  const s = venda.digisac_status
  if (!s) return 'neutro'
  if (s === 'erro') return 'erro'
  if (s === 'pendente' || s === 'processando') return 'processando'

  const sincronizado = s === 'concluido' || s === 'ignorado_cache_valido'
  if (!sincronizado) return 'neutro'

  // Prioridade 1: se tem chamado no ciclo, não pode ser "sem conversa"
  const chamadosCiclo = venda.digisac_chamados_ciclo ?? 0
  if (chamadosCiclo > 0) return 'ok'

  // Prioridade 2: se tem histórico, mas não no ciclo
  const totalHistorico = venda.digisac_total_historico ?? 0
  if (totalHistorico > 0) return 'sem_ciclo'

  // Prioridade 3: sincronizado e realmente sem nenhuma conversa histórica
  return 'sem_conversa'
}

function rowHighlightCls(state: DigisacRowState): string {
  switch (state) {
    case 'sem_conversa': return 'bg-red-50 hover:bg-red-100'
    case 'sem_ciclo':    return 'bg-amber-50 hover:bg-amber-100'
    case 'erro':         return 'bg-red-50 hover:bg-red-100'
    case 'processando':  return 'bg-sky-50 hover:bg-sky-100'
    default:             return 'hover:bg-slate-50'
  }
}

function DigisacStatusCell({ venda }: { venda: SgiDocumento }) {
  const state = getDigisacRowState(venda)
  const sync = venda.digisac_ultima_sync
  const title = sync ? `Sync: ${new Date(sync).toLocaleDateString('pt-BR')}` : undefined
  switch (state) {
    case 'neutro':
      return <span className="text-slate-300 text-xs">—</span>
    case 'ok':
      return (
        <span className="flex items-center gap-1 text-xs text-emerald-600" title={title}>
          <MessageCircle className="w-3 h-3" />
          <span>Sincronizado</span>
        </span>
      )
    case 'sem_conversa':
      return <span className="text-xs text-red-600 font-medium" title={title}>Sem conversa</span>
    case 'sem_ciclo':
      return <span className="text-xs text-amber-600 font-medium" title={title}>Sem chamado no ciclo</span>
    case 'erro':
      return <span className="text-xs text-red-500 font-medium">Erro</span>
    case 'processando':
      return <span className="text-xs text-sky-500 animate-pulse">⧓ Processando</span>
  }
}

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


interface TabelaVendasProps {
  vendas: SgiDocumento[]
  total: number
  page: number
  isLoading?: boolean
  onPageChange: (page: number) => void
  onVerDetalhe: (venda: SgiDocumento) => void
  onObsClick?: (venda: SgiDocumento) => void
}

export function TabelaVendas({
  vendas, total, page, isLoading, onPageChange, onVerDetalhe, onObsClick
}: TabelaVendasProps) {
  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE))

  // Drag-to-scroll state
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const isMouseDown = useRef(false)
  const isDraggingRef = useRef(false)
  const dragStartX = useRef(0)
  const scrollStartLeft = useRef(0)

  const DRAG_THRESHOLD = 5

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement
    // Don't start drag if clicking on interactive elements
    if (
      target.closest('button') ||
      target.closest('a') ||
      target.closest('input') ||
      target.closest('select') ||
      target.closest('textarea') ||
      target.closest('[role="button"]')
    ) {
      return
    }
    isMouseDown.current = true
    isDraggingRef.current = false
    dragStartX.current = e.clientX
    scrollStartLeft.current = scrollRef.current?.scrollLeft ?? 0
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isMouseDown.current || !scrollRef.current) return

    const deltaX = e.clientX - dragStartX.current

    // Only start drag after threshold is exceeded
    if (!isDraggingRef.current && Math.abs(deltaX) > DRAG_THRESHOLD) {
      isDraggingRef.current = true
      setIsDragging(true)
    }

    if (isDraggingRef.current) {
      e.preventDefault()
      scrollRef.current.scrollLeft = scrollStartLeft.current - deltaX
    }
  }

  // Log de diagnóstico — remover após validar
  const handleDragLog = () => {
    if (scrollRef.current) {
      console.log('[TABELA-DRAG]', {
        scrollWidth: scrollRef.current.scrollWidth,
        clientWidth: scrollRef.current.clientWidth,
        scrollLeft: scrollRef.current.scrollLeft,
      })
    }
  }

  const handleMouseUp = () => {
    isMouseDown.current = false
    isDraggingRef.current = false
    setIsDragging(false)
  }

  const handleMouseLeave = () => {
    isMouseDown.current = false
    isDraggingRef.current = false
    setIsDragging(false)
  }

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

      <div
        ref={scrollRef}
        className={cn(
          "overflow-x-auto",
          isDragging ? "cursor-grabbing select-none" : "cursor-grab"
        )}
        onMouseDown={(e) => { handleMouseDown(e); handleDragLog() }}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
      >
        <Table className="min-w-[2600px]">
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
            <TableHead className="text-xs text-right">
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex items-center gap-1 cursor-help">
                    Valor recebido
                    <HelpCircle className="w-3 h-3 text-slate-400" />
                  </span>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs text-xs">
                  Valor efetivamente recebido na venda em dinheiro, cartão, PIX, boleto ou link de pagamento. Não considera crédito de troca como novo recebimento.
                </TooltipContent>
              </Tooltip>
            </TableHead>
            <TableHead className="text-xs text-right">Créd. Troca</TableHead>
            <TableHead className="text-xs text-right">Pendente</TableHead>
            <TableHead className="text-xs text-right">Desc. %</TableHead>
            <TableHead className="text-xs text-right">Frete</TableHead>
            <TableHead className="text-xs text-center" title="Chamados Digisac no ciclo da venda (desde a venda anterior até esta)">Cham. ciclo</TableHead>
            <TableHead className="text-xs text-center" title="Interações no ciclo da venda">Interações</TableHead>
            <TableHead className="text-xs text-center" title="Primeiro tipo de contato no ciclo da venda">1º Contato</TableHead>
            <TableHead className="text-xs text-center" title="Dias entre o primeiro chamado do ciclo e o fechamento da venda">Dias fech.</TableHead>
            <TableHead className="text-xs text-center" title="Chamados do ciclo classificados pela IA como Sim ou Parcialmente influentes">Cham. Influente IA</TableHead>
            <TableHead className="text-xs" title="Previsão de nascimento do bebê identificada pela IA">Nascimento Bebê</TableHead>
            <TableHead className="text-xs" title="Nome do bebê identificado pela IA">Nome Bebê</TableHead>
            <TableHead className="text-xs" title="Departamento(s) dos produtos da venda">Depto.</TableHead>
            <TableHead className="text-xs" title="Subgrupo(s) dos produtos da venda">Subgrupo</TableHead>
            <TableHead className="text-xs" title="Status sincronização Digisac">Digisac</TableHead>
            <TableHead className="text-xs w-8" title="Observações comerciais">Obs.</TableHead>
            <TableHead className="text-xs w-10 text-center" title="Abrir detalhes da venda">Detalhes</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {vendas.length === 0 ? (
            <TableRow>
              <TableCell colSpan={23} className="text-center text-slate-400 py-12 text-sm">
                Nenhuma venda encontrada para os filtros selecionados.
              </TableCell>
            </TableRow>
          ) : (
            vendas.map(venda => {
              const rowState = getDigisacRowState(venda)
              return (
              <TableRow key={venda.id} className={rowHighlightCls(rowState)}>
                <TableCell className="font-mono text-xs font-semibold text-sky-700">
                  <button
                    type="button"
                    className="hover:underline cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation()
                      onVerDetalhe(venda)
                    }}
                  >
                    #{venda.numero_lancamento}
                  </button>
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
                <TableCell className="text-xs text-center font-medium">
                  {venda.digisac_chamados_ciclo != null ? (
                    <span className={venda.digisac_chamados_ciclo > 0 ? 'text-sky-700' : 'text-slate-400'}>
                      {venda.digisac_chamados_ciclo}
                    </span>
                  ) : '—'}
                </TableCell>
                <TableCell className="text-xs text-center">
                  {venda.digisac_interacoes_ciclo != null ? (
                    <span className={venda.digisac_interacoes_ciclo > 0 ? 'text-slate-700' : 'text-slate-400'}>
                      {venda.digisac_interacoes_ciclo}
                    </span>
                  ) : '—'}
                </TableCell>
                <TableCell className="text-xs text-center">
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
                <TableCell className="text-xs text-center">
                  {formatDias(venda.digisac_dias_ate_fechamento)}
                </TableCell>
                <TableCell className="text-xs text-center font-medium">
                  {venda.digisac_chamados_influentes_ia != null ? (
                    <span className={venda.digisac_chamados_influentes_ia > 0 ? 'text-emerald-700' : 'text-slate-400'}>
                      {venda.digisac_chamados_influentes_ia}
                    </span>
                  ) : (
                    <span className="text-slate-300">—</span>
                  )}
                </TableCell>
                <TableCell className="text-xs text-slate-600">
                  {venda.previsao_nascimento_bebe
                    ? <span className="text-pink-700 font-medium">{venda.previsao_nascimento_bebe}</span>
                    : <span className="text-slate-300">—</span>
                  }
                </TableCell>
                <TableCell className="text-xs max-w-[120px] truncate" title={venda.nome_bebe ?? undefined}>
                  {venda.nome_bebe
                    ? <span className="text-pink-700 font-medium">{venda.nome_bebe}</span>
                    : <span className="text-slate-300">—</span>
                  }
                </TableCell>
                <TableCell className="text-xs">
                  <div className="flex flex-wrap gap-0.5">
                    {(venda.departamentos_venda && venda.departamentos_venda.length > 0)
                      ? venda.departamentos_venda.map((d) => <DeptoChip key={d} depto={d} />)
                      : <span className="text-slate-300">—</span>}
                  </div>
                </TableCell>
                <TableCell className="text-xs max-w-[220px]">
                  <div className="flex flex-wrap gap-1">
                    {venda.subgrupos_venda && venda.subgrupos_venda.length > 0
                      ? venda.subgrupos_venda.map((s, i) => (
                          <span key={i} className="text-slate-600 text-[10px] leading-tight" title={s}>
                            {s}
                            {i < (venda.subgrupos_venda?.length ?? 0) - 1 && <span className="text-slate-400 mx-0.5">·</span>}
                          </span>
                        ))
                      : <span className="text-slate-300">—</span>}
                  </div>
                </TableCell>
                <TableCell className="text-xs">
                  <DigisacStatusCell venda={venda} />
                </TableCell>
                <TableCell>
                  {onObsClick && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={e => { e.stopPropagation(); onObsClick(venda) }}
                      title="Observações"
                      className={(venda.total_observacoes ?? 0) > 0 ? 'text-sky-600' : 'text-slate-300'}
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </TableCell>
                <TableCell className="text-center">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={e => { e.stopPropagation(); onVerDetalhe(venda) }}
                    title="Ver detalhe"
                    className="cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                  </Button>
                </TableCell>
              </TableRow>
              )
            })
          )}
        </TableBody>
      </Table>
      </div>

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
