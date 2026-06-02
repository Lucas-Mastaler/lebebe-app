'use client'

import { MessageCircle, Play, Square, RotateCcw, CheckCircle2, Clock, AlertCircle, Loader2, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { EstadoLote, LinhaLote, StatusLinha } from '@/hooks/useSyncLote'
import type { SgiDocumento } from '@/types/sgi'

// ─── Badge de status por linha ────────────────────────────────────────────────

function statusIcon(status: StatusLinha) {
  switch (status) {
    case 'aguardando':    return <Clock className="w-3 h-3 text-slate-400" />
    case 'processando':  return <Loader2 className="w-3 h-3 text-sky-500 animate-spin" />
    case 'sincronizado': return <CheckCircle2 className="w-3 h-3 text-emerald-500" />
    case 'cache_valido': return <RefreshCw className="w-3 h-3 text-violet-400" />
    case 'erro':         return <AlertCircle className="w-3 h-3 text-red-500" />
  }
}

function statusLabel(status: StatusLinha) {
  switch (status) {
    case 'aguardando':    return 'Aguardando'
    case 'processando':  return 'Processando...'
    case 'sincronizado': return 'Sincronizado'
    case 'cache_valido': return 'Cache válido'
    case 'erro':         return 'Erro'
  }
}

function statusCls(status: StatusLinha) {
  switch (status) {
    case 'aguardando':    return 'text-slate-400'
    case 'processando':  return 'text-sky-600 font-medium'
    case 'sincronizado': return 'text-emerald-600'
    case 'cache_valido': return 'text-violet-500'
    case 'erro':         return 'text-red-500'
  }
}

// ─── Linha individual ─────────────────────────────────────────────────────────

function LinhaStatus({ linha, isAtual }: { linha: LinhaLote; isAtual: boolean }) {
  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-colors ${
      isAtual ? 'bg-sky-50 border border-sky-100' : 'hover:bg-slate-50'
    }`}>
      <span className="shrink-0">{statusIcon(linha.status)}</span>
      <span className="font-mono text-slate-500 shrink-0">#{linha.numeroLancamento}</span>
      <span className="truncate text-slate-600 max-w-[180px]" title={linha.cliente ?? undefined}>
        {linha.cliente ?? '—'}
      </span>
      <span className={`ml-auto shrink-0 ${statusCls(linha.status)}`}>
        {statusLabel(linha.status)}
      </span>
      {linha.erro && (
        <span className="ml-1 text-red-400 truncate max-w-[120px]" title={linha.erro}>
          {linha.erro}
        </span>
      )}
    </div>
  )
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface SyncLotePanelProps {
  vendas: SgiDocumento[]
  estado: EstadoLote
  onIniciar: (forcar: boolean) => void
  onCancelar: () => void
  onResetar: () => void
}

// ─── Componente principal ─────────────────────────────────────────────────────

export function SyncLotePanel({
  vendas,
  estado,
  onIniciar,
  onCancelar,
  onResetar,
}: SyncLotePanelProps) {
  const { rodando, concluido, total, processados, atualIndex, linhas } = estado

  const pct = total > 0 ? Math.round((processados / total) * 100) : 0
  const atualVenda = atualIndex >= 0 ? linhas[atualIndex] : null

  // ── Estado inicial: só o botão ──
  if (!rodando && !concluido) {
    return (
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5 border-sky-200 text-sky-700 hover:bg-sky-50"
          onClick={() => onIniciar(false)}
          disabled={vendas.length === 0}
          title={vendas.length === 0 ? 'Pesquise vendas primeiro' : undefined}
        >
          <MessageCircle className="w-3.5 h-3.5" />
          Sincronizar Digisac
          {vendas.length > 0 && (
            <span className="ml-0.5 bg-sky-100 text-sky-600 rounded px-1 font-mono text-[10px]">
              {vendas.length}
            </span>
          )}
        </Button>
      </div>
    )
  }

  // ── Em execução ou concluído: painel expandido ──
  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-slate-100 bg-slate-50">
        <MessageCircle className="w-4 h-4 text-sky-600 shrink-0" />
        <div className="flex-1 min-w-0">
          {rodando ? (
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-slate-700">
                Sincronizando Digisac: {processados}/{total}
              </span>
              {atualVenda && (
                <span className="text-xs text-slate-500 truncate">
                  — #{atualVenda.numeroLancamento} {atualVenda.cliente}
                </span>
              )}
            </div>
          ) : (
            <span className="text-sm font-medium text-slate-700">
              Sincronização concluída: {processados}/{total}
            </span>
          )}
        </div>

        {rodando ? (
          <Button size="sm" variant="outline" className="gap-1 text-red-600 border-red-200 hover:bg-red-50 shrink-0" onClick={onCancelar}>
            <Square className="w-3 h-3" />
            Parar
          </Button>
        ) : (
          <div className="flex gap-1.5 shrink-0">
            <Button size="sm" variant="outline" className="gap-1 text-sky-600 border-sky-200 hover:bg-sky-50" onClick={() => onIniciar(false)}>
              <Play className="w-3 h-3" />
              Reprocessar
            </Button>
            <Button size="sm" variant="ghost" className="text-slate-500" onClick={onResetar}>
              <RotateCcw className="w-3.5 h-3.5" />
            </Button>
          </div>
        )}
      </div>

      {/* Barra de progresso */}
      <div className="h-1 bg-slate-100">
        <div
          className={`h-1 transition-all duration-300 ${concluido ? 'bg-emerald-400' : 'bg-sky-400'}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Lista de linhas */}
      {linhas.length > 0 && (
        <div className="max-h-52 overflow-y-auto px-2 py-1.5 space-y-0.5">
          {linhas.map((linha, i) => (
            <LinhaStatus key={linha.numeroLancamento} linha={linha} isAtual={i === atualIndex} />
          ))}
        </div>
      )}

      {/* Sumário final */}
      {concluido && (
        <div className="px-4 py-2 border-t border-slate-100 flex gap-4 text-xs text-slate-500">
          <span className="text-emerald-600 font-medium">
            ✓ {linhas.filter((l) => l.status === 'sincronizado').length} sincronizados
          </span>
          <span className="text-violet-500">
            ↺ {linhas.filter((l) => l.status === 'cache_valido').length} cache válido
          </span>
          {linhas.filter((l) => l.status === 'erro').length > 0 && (
            <span className="text-red-500">
              ✕ {linhas.filter((l) => l.status === 'erro').length} erros
            </span>
          )}
        </div>
      )}
    </div>
  )
}
