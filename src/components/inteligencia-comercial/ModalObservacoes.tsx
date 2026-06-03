'use client'

import { useCallback, useEffect, useState } from 'react'
import { MessageSquarePlus, Trash2, ChevronDown, ChevronUp, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Observacao {
  id: string
  numero_lancamento: string
  cliente_nome: string | null
  observacao: string
  criado_por: string | null
  created_at: string
}

interface ModalObservacoesProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  numeroLancamento: string
  clienteNome: string | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDt(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

// ─── Item de observação ───────────────────────────────────────────────────────

function ObsItem({
  obs,
  onDelete,
}: {
  obs: Observacao
  onDelete: (id: string) => void
}) {
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    setDeleting(true)
    try {
      await fetch(`/api/sgi/observacoes/${obs.id}`, { method: 'DELETE' })
      onDelete(obs.id)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="flex gap-2 p-3 bg-slate-50 rounded-lg border border-slate-100 group">
      <div className="flex-1 min-w-0">
        <p className="text-sm text-slate-700 whitespace-pre-wrap break-words">{obs.observacao}</p>
        <p className="text-[10px] text-slate-400 mt-1">
          {obs.criado_por} · {formatDt(obs.created_at)}
        </p>
      </div>
      <Button
        variant="ghost"
        size="icon-sm"
        className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 shrink-0"
        onClick={handleDelete}
        disabled={deleting}
        title="Excluir"
      >
        {deleting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
      </Button>
    </div>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────

export function ModalObservacoes({
  open,
  onOpenChange,
  numeroLancamento,
  clienteNome,
}: ModalObservacoesProps) {
  const [obs, setObs] = useState<Observacao[]>([])
  const [obsCliente, setObsCliente] = useState<Observacao[]>([])
  const [texto, setTexto] = useState('')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(false)
  const [mostrarCliente, setMostrarCliente] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const [r1, r2] = await Promise.all([
        fetch(`/api/sgi/observacoes?numeroLancamento=${numeroLancamento}`),
        fetch(`/api/sgi/observacoes/cliente?numeroLancamento=${numeroLancamento}`),
      ])
      const [d1, d2] = await Promise.all([r1.json(), r2.json()])
      setObs(d1.observacoes ?? [])
      setObsCliente(d2.observacoes ?? [])
    } finally {
      setLoading(false)
    }
  }, [numeroLancamento])

  useEffect(() => {
    if (open) carregar()
  }, [open, carregar])

  async function handleSalvar() {
    if (!texto.trim()) return
    setSaving(true)
    setErro(null)
    try {
      const res = await fetch('/api/sgi/observacoes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ numeroLancamento, observacao: texto }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erro ao salvar')
      setObs((prev) => [data.observacao, ...prev])
      setTexto('')
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  function handleDelete(id: string) {
    setObs((prev) => prev.filter((o) => o.id !== id))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-base flex items-center gap-2">
            <MessageSquarePlus className="w-4 h-4 text-sky-600" />
            Observações — #{numeroLancamento}
            {clienteNome && (
              <span className="text-sm font-normal text-slate-500 truncate">{clienteNome}</span>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {/* Nova observação */}
          <div className="space-y-2">
            <textarea
              className="w-full text-sm border border-slate-200 rounded-lg p-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-sky-200 placeholder:text-slate-400"
              rows={3}
              placeholder="Escreva uma observação sobre esta venda..."
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSalvar()
              }}
            />
            {erro && <p className="text-xs text-red-500">{erro}</p>}
            <Button
              size="sm"
              onClick={handleSalvar}
              disabled={saving || !texto.trim()}
              className="gap-1"
            >
              {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <MessageSquarePlus className="w-3 h-3" />}
              Salvar observação
            </Button>
          </div>

          {/* Observações deste lançamento */}
          <div>
            <p className="text-xs font-semibold text-slate-600 mb-2 uppercase tracking-wide">
              Observações deste lançamento {obs.length > 0 && `(${obs.length})`}
            </p>
            {loading ? (
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <Loader2 className="w-3 h-3 animate-spin" /> Carregando...
              </div>
            ) : obs.length === 0 ? (
              <p className="text-xs text-slate-400 italic">Nenhuma observação ainda.</p>
            ) : (
              <div className="space-y-2">
                {obs.map((o) => <ObsItem key={o.id} obs={o} onDelete={handleDelete} />)}
              </div>
            )}
          </div>

          {/* Histórico de outras vendas do cliente */}
          {obsCliente.length > 0 && (
            <div className="border-t border-slate-100 pt-3">
              <button
                className="flex items-center gap-1 text-xs font-semibold text-slate-500 uppercase tracking-wide hover:text-slate-700"
                onClick={() => setMostrarCliente((v) => !v)}
              >
                {mostrarCliente ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                Histórico do cliente — outras vendas ({obsCliente.length})
              </button>
              {mostrarCliente && (
                <div className="mt-2 space-y-2">
                  {obsCliente.map((o) => (
                    <div key={o.id} className="p-3 bg-amber-50 border border-amber-100 rounded-lg">
                      <p className="text-[10px] text-amber-700 font-medium mb-0.5">Lançamento #{o.numero_lancamento}</p>
                      <p className="text-sm text-slate-700 whitespace-pre-wrap break-words">{o.observacao}</p>
                      <p className="text-[10px] text-slate-400 mt-1">{o.criado_por} · {formatDt(o.created_at)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
