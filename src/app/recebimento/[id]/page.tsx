'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import {
  ArrowLeft,
  Search,
  CheckCircle2,
  Plus,
  Minus,
  MapPin,
  AlertTriangle,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { isMaticEmail } from '@/lib/auth/matic-emails'
import { OSItemCard } from './OSItemCard'

// =========================================================
// Types
// =========================================================

interface Volume {
  id: string
  volume_numero: number
  qtd_prevista: number
  qtd_recebida: number
}

interface NfeItem {
  codigo_produto: string
  descricao: string
  quantidade: number
  volumes_por_item: number
}

interface RecebimentoItem {
  id: string
  recebimento_id: string
  nfe_item_id: string
  volumes_previstos_total: number
  volumes_recebidos_total: number
  volumes_por_item: number
  corredor_final: string | null
  nivel_final: string | null
  prateleira_final: string | null
  divergencia_tipo: string | null
  divergencia_obs: string | null
  avaria_foto_url: string | null
  is_os: boolean
  os_numero: string | null
  nfe_item: NfeItem | null
  recebimento_item_volumes: Volume[]
  status_calculado: string
  sku_descricao: string
  sku_corredor_sugerido: string | null
  sku_nivel_sugerido: string | null
  sku_prateleira_sugerida: string | null
}

interface RecebimentoDetail {
  id: string
  periodo_inicio: string
  periodo_fim: string
  data_inicio: string
  data_fim: string | null
  motorista: string | null
  status: string
  total_previsto: number
  total_recebido: number
  itens: RecebimentoItem[]
  nfes: Array<{ nfe_id: string; nfe: { numero_nf: string } | null }>
}

// =========================================================
// Main Page
// =========================================================

export default function ConferenciaPage() {
  const router = useRouter()
  const params = useParams()
  const recebimentoId = params.id as string

  const [recebimento, setRecebimento] = useState<RecebimentoDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [authorized, setAuthorized] = useState(false)
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState<'itens' | 'os'>('itens')
  const [showFinalizar, setShowFinalizar] = useState(false)
  const [showCancelar, setShowCancelar] = useState(false)
  const [localModal, setLocalModal] = useState<RecebimentoItem | null>(null)
  const [divModal, setDivModal] = useState<RecebimentoItem | null>(null)

  useEffect(() => {
    async function checkAuth() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user?.email && isMaticEmail(user.email)) {
        setAuthorized(true)
      } else {
        router.push('/dashboard')
      }
    }
    checkAuth()
  }, [router])

  const loadRecebimento = useCallback(async () => {
    try {
      const res = await fetch(`/api/recebimento/${recebimentoId}`)
      if (res.ok) {
        const data = await res.json()
        setRecebimento(data)
      }
    } catch (err) {
      console.error('Erro ao carregar recebimento:', err)
    } finally {
      setLoading(false)
    }
  }, [recebimentoId])

  useEffect(() => {
    if (authorized) loadRecebimento()
  }, [authorized, loadRecebimento])

  // Polling for real-time updates (every 5 seconds) - only if recebimento is open and not editing
  useEffect(() => {
    if (!recebimento || recebimento.status !== 'aberto') return
    // Pause polling if user is editing (modal open)
    if (localModal || divModal) return
    
    const interval = setInterval(() => {
      loadRecebimento()
    }, 5000)
    
    return () => clearInterval(interval)
  }, [recebimento, loadRecebimento, localModal, divModal])

  if (!authorized || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#00A5E6]" />
      </div>
    )
  }

  if (!recebimento) {
    return (
      <div className="text-center py-20 text-slate-500">
        <p>Recebimento não encontrado</p>
        <Button variant="outline" onClick={() => router.push('/recebimento')} className="mt-4">
          Voltar
        </Button>
      </div>
    )
  }

  const isFechado = recebimento.status === 'fechado'
  const isCancelado = recebimento.status === 'cancelado'
  const pctGeral = recebimento.total_previsto > 0
    ? Math.round((recebimento.total_recebido / recebimento.total_previsto) * 100)
    : 0

  // Separate normal items from OS items
  const itensNormais = recebimento.itens.filter(item => !item.is_os)
  const itensOS = recebimento.itens.filter(item => item.is_os)

  // Filter items by search
  const filtered = (activeTab === 'itens' ? itensNormais : itensOS).filter(item => {
    if (!search) return true
    const q = search.toLowerCase()
    const codigo = item.nfe_item?.codigo_produto?.toLowerCase() || ''
    const desc = item.sku_descricao?.toLowerCase() || ''
    const osNum = item.os_numero?.toLowerCase() || ''
    return codigo.includes(q) || desc.includes(q) || osNum.includes(q)
  })

  // Check if can finalize
  const canFinalize = recebimento.itens.every(item => {
    const complete = item.volumes_recebidos_total >= item.volumes_previstos_total
    return complete || !!item.divergencia_tipo
  })

  return (
    <div className="max-w-2xl mx-auto pb-24">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => router.push('/recebimento')} className="p-2 -ml-2 rounded-xl hover:bg-slate-100">
          <ArrowLeft className="w-5 h-5 text-slate-600" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold text-slate-800 truncate">Conferência</h1>
          <p className="text-xs text-slate-500">
            {recebimento.nfes?.length || 0} NF(s) • {recebimento.itens.length} itens
            {recebimento.motorista && ` • ${recebimento.motorista}`}
          </p>
        </div>
        {isFechado ? (
          <span className="text-xs font-semibold px-3 py-1 rounded-full bg-green-100 text-green-700">
            FECHADO
          </span>
        ) : isCancelado ? (
          <span className="text-xs font-semibold px-3 py-1 rounded-full bg-red-100 text-red-700">
            CANCELADO
          </span>
        ) : (
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowCancelar(true)}
              className="text-xs"
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={() => setShowFinalizar(true)}
              disabled={!canFinalize}
              className="text-xs"
            >
              Finalizar
            </Button>
          </div>
        )}
      </div>

      {/* Progress bar (sticky) */}
      <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm -mx-6 px-6 py-3 border-b border-slate-100 mb-4">
        <div className="flex items-center justify-between text-sm mb-1.5">
          <span className="font-medium text-slate-700">Progresso Geral</span>
          <span className="font-bold text-slate-800">
            {recebimento.total_recebido}/{recebimento.total_previsto}
            <span className="text-slate-400 font-normal ml-1">({pctGeral}%)</span>
          </span>
        </div>
        <div className="w-full bg-slate-100 rounded-full h-3">
          <div
            className={`h-3 rounded-full transition-all duration-300 ${
              pctGeral >= 100 ? 'bg-green-500' : pctGeral > 0 ? 'bg-amber-400' : 'bg-slate-200'
            }`}
            style={{ width: `${Math.min(pctGeral, 100)}%` }}
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setActiveTab('itens')}
          className={`flex-1 py-2.5 px-4 rounded-xl font-medium text-sm transition-all ${
            activeTab === 'itens'
              ? 'bg-[#00A5E6] text-white shadow-sm'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          Itens ({itensNormais.length})
        </button>
        <button
          onClick={() => setActiveTab('os')}
          className={`flex-1 py-2.5 px-4 rounded-xl font-medium text-sm transition-all ${
            activeTab === 'os'
              ? 'bg-[#00A5E6] text-white shadow-sm'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          O.S ({itensOS.length})
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder={activeTab === 'itens' ? 'Buscar produto...' : 'Buscar OS...'}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#00A5E6]/20 focus:border-[#00A5E6]"
        />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2">
            <X className="w-4 h-4 text-slate-400" />
          </button>
        )}
      </div>

      {/* Items list */}
      <div className="space-y-3">
        {activeTab === 'itens' ? (
          <>
            {filtered.map(item => (
              <ItemCard
                key={item.id}
                item={item}
                recebimentoId={recebimentoId}
                isFechado={isFechado || isCancelado}
                onVolumeUpdate={(itemId, volumeNumero, newQtd, newTotal) => {
                  setRecebimento(prev => {
                    if (!prev) return prev
                    const newItens = prev.itens.map(it => {
                      if (it.id !== itemId) return it
                      const newVolumes = it.recebimento_item_volumes.map(v =>
                        v.volume_numero === volumeNumero ? { ...v, qtd_recebida: newQtd } : v
                      )
                      const newStatus = newTotal >= it.volumes_previstos_total ? 'concluido'
                        : newTotal > 0 ? 'parcial' : 'pendente'
                      return {
                        ...it,
                        volumes_recebidos_total: newTotal,
                        recebimento_item_volumes: newVolumes,
                        status_calculado: newStatus,
                      }
                    })
                    const totalRec = newItens.reduce((s, i) => s + i.volumes_recebidos_total, 0)
                    return { ...prev, itens: newItens, total_recebido: totalRec }
                  })
                }}
                onLocalClick={() => setLocalModal(item)}
                onDivClick={() => setDivModal(item)}
              />
            ))}
          </>
        ) : (
          <>
            {filtered.map(item => (
              <OSItemCard
                key={item.id}
                item={item}
                recebimentoId={recebimentoId}
                isFechado={isFechado || isCancelado}
                onVolumeUpdate={(itemId: string, newRecebido: number, _newTotal: number) => {
                  setRecebimento(prev => {
                    if (!prev) return prev
                    const newItens = prev.itens.map(it =>
                      it.id === itemId ? { ...it, volumes_recebidos_total: newRecebido } : it
                    )
                    const totalRec = newItens.reduce((s, i) => s + i.volumes_recebidos_total, 0)
                    return { ...prev, itens: newItens, total_recebido: totalRec }
                  })
                }}
              />
            ))}
          </>
        )}

        {filtered.length === 0 && (
          <p className="text-center py-10 text-slate-400 text-sm">Nenhum item encontrado</p>
        )}
      </div>

      {/* Finalizar Modal */}
      {showFinalizar && (
        <FinalizarModal
          recebimentoId={recebimentoId}
          onClose={() => setShowFinalizar(false)}
          onSuccess={() => router.push('/recebimento')}
        />
      )}

      {/* Cancelar Modal */}
      {showCancelar && (
        <CancelarModal
          recebimentoId={recebimentoId}
          onClose={() => setShowCancelar(false)}
          onSuccess={() => {
            setRecebimento(prev => prev ? { ...prev, status: 'cancelado' } : prev)
            setShowCancelar(false)
          }}
        />
      )}

      {/* Local Modal */}
      {localModal && (
        <LocalModal
          item={localModal}
          recebimentoId={recebimentoId}
          onClose={() => setLocalModal(null)}
          onSave={async (corredor, nivel, prateleira, volumesPorItem) => {
            setLocalModal(null)
            // Reload data from server to get new volumes created/deleted
            await loadRecebimento()
          }}
        />
      )}

      {/* Divergência Modal */}
      {divModal && (
        <DivergenciaModal
          item={divModal}
          recebimentoId={recebimentoId}
          onClose={() => setDivModal(null)}
          onSave={(tipo, obs) => {
            setRecebimento(prev => {
              if (!prev) return prev
              return {
                ...prev,
                itens: prev.itens.map(it =>
                  it.id === divModal.id
                    ? { ...it, divergencia_tipo: tipo, divergencia_obs: obs }
                    : it
                ),
              }
            })
            setDivModal(null)
          }}
        />
      )}
    </div>
  )
}

// =========================================================
// Item Card
// =========================================================

function ItemCard({
  item,
  recebimentoId,
  isFechado,
  onVolumeUpdate,
  onLocalClick,
  onDivClick,
}: {
  item: RecebimentoItem
  recebimentoId: string
  isFechado: boolean
  onVolumeUpdate: (itemId: string, volumeNumero: number, newQtd: number, newTotal: number) => void
  onLocalClick: () => void
  onDivClick: () => void
}) {
  const [loadingVolume, setLoadingVolume] = useState<number | null>(null)

  const status = item.status_calculado
  const bgColor =
    status === 'concluido' ? 'border-green-300 bg-green-50/50'
      : status === 'parcial' ? 'border-amber-300 bg-amber-50/30'
        : 'border-slate-200 bg-white'

  const totalPct = item.volumes_previstos_total > 0
    ? Math.round((item.volumes_recebidos_total / item.volumes_previstos_total) * 100)
    : 0

  async function handleDelta(volumeNumero: number, delta: number) {
    if (isFechado) return
    setLoadingVolume(volumeNumero)
    try {
      const res = await fetch(
        `/api/recebimento/${recebimentoId}/item/${item.id}/volume/${volumeNumero}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ delta }),
        }
      )
      if (res.ok) {
        const data = await res.json()
        onVolumeUpdate(item.id, volumeNumero, data.qtd_recebida, data.item_total_recebido)
      }
    } catch (err) {
      console.error('Erro ao atualizar volume:', err)
    } finally {
      setLoadingVolume(null)
    }
  }

  return (
    <div className={`rounded-xl border-2 p-4 transition-all ${bgColor}`}>
      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-mono text-slate-500">{item.nfe_item?.codigo_produto}</p>
          <p className="font-semibold text-sm text-slate-800 leading-tight mt-0.5">
            {item.sku_descricao || item.nfe_item?.descricao}
          </p>
        </div>
        {status === 'concluido' && (
          <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 ml-2" />
        )}
      </div>

      {/* Local info */}
      <div className="flex items-center gap-2 text-xs text-slate-500 mb-3">
        <MapPin className="w-3.5 h-3.5" />
        <span>
          {item.corredor_final || item.sku_corredor_sugerido || '—'}
          {' / '}
          {item.nivel_final || item.sku_nivel_sugerido || '—'}
          {(item.prateleira_final || item.sku_prateleira_sugerida) && (
            <> / {item.prateleira_final || item.sku_prateleira_sugerida}</>
          )}
        </span>
        <span className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded font-medium">
          {item.recebimento_item_volumes.length}vol
        </span>
        {item.divergencia_tipo && (
          <span className="ml-auto px-2 py-0.5 rounded-full bg-red-100 text-red-600 font-medium">
            {item.divergencia_tipo}
          </span>
        )}
      </div>

      {/* Progress */}
      <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
        <span>Total: {item.volumes_recebidos_total}/{item.volumes_previstos_total}</span>
        <span>{totalPct}%</span>
      </div>
      <div className="w-full bg-slate-100 rounded-full h-1.5 mb-3">
        <div
          className={`h-1.5 rounded-full transition-all ${
            totalPct >= 100 ? 'bg-green-500' : totalPct > 0 ? 'bg-amber-400' : 'bg-slate-200'
          }`}
          style={{ width: `${Math.min(totalPct, 100)}%` }}
        />
      </div>

      {/* Volume badges - horizontal row with individual tap buttons */}
      <div className="space-y-2">
        {item.recebimento_item_volumes.map(vol => {
          const volComplete = vol.qtd_recebida >= vol.qtd_prevista
          const volProgress = vol.qtd_prevista > 0 ? (vol.qtd_recebida / vol.qtd_prevista) * 100 : 0
          
          return (
            <div key={vol.id} className="flex items-center gap-2">
              {/* Volume badge */}
              <div className={`flex-shrink-0 w-14 h-10 rounded-lg flex items-center justify-center font-bold text-xs ${
                volComplete ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'
              }`}>
                V{vol.volume_numero}
              </div>
              
              {/* Progress bar */}
              <div className="flex-1 h-10 rounded-lg border-2 border-slate-200 overflow-hidden relative bg-white">
                <div 
                  className={`absolute inset-y-0 left-0 transition-all ${
                    volComplete ? 'bg-green-200' : 'bg-blue-100'
                  }`}
                  style={{ width: `${volProgress}%` }}
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className={`text-sm font-bold ${volComplete ? 'text-green-700' : 'text-slate-700'}`}>
                    {vol.qtd_recebida}/{vol.qtd_prevista}
                  </span>
                </div>
              </div>
              
              {/* +/- Buttons */}
              {!isFechado && (
                <div className="flex gap-1">
                  {/* - Button (only show if volume has items) */}
                  {vol.qtd_recebida > 0 && (
                    <button
                      onClick={() => handleDelta(vol.volume_numero, -1)}
                      disabled={loadingVolume === vol.volume_numero}
                      className="flex-shrink-0 w-10 h-10 rounded-lg bg-slate-100 hover:bg-slate-200 disabled:opacity-30 flex items-center justify-center transition-all shadow-sm active:scale-95"
                    >
                      <span className="text-slate-600 font-bold text-lg">−</span>
                    </button>
                  )}
                  
                  {/* + Button */}
                  <button
                    onClick={() => handleDelta(vol.volume_numero, 1)}
                    disabled={volComplete || loadingVolume === vol.volume_numero}
                    className="flex-shrink-0 w-10 h-10 rounded-lg bg-[#00A5E6] hover:bg-[#0090cc] disabled:opacity-30 disabled:bg-slate-200 flex items-center justify-center transition-all shadow-sm active:scale-95"
                  >
                    {volComplete ? (
                      <CheckCircle2 className="w-5 h-5 text-green-600" />
                    ) : (
                      <Plus className="w-5 h-5 text-white" />
                    )}
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Actions */}
      {!isFechado && (
        <div className="flex gap-2 mt-3">
          <button
            onClick={onLocalClick}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
          >
            <MapPin className="w-3.5 h-3.5" />
            Local
          </button>
          <button
            onClick={onDivClick}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            Divergência
          </button>
        </div>
      )}
    </div>
  )
}

// =========================================================
// Local Modal
// =========================================================

function LocalModal({
  item,
  recebimentoId,
  onClose,
  onSave,
}: {
  item: RecebimentoItem
  recebimentoId: string
  onClose: () => void
  onSave: (corredor: string, nivel: string, prateleira: string, volumesPorItem: number) => Promise<void>
}) {
  const [corredor, setCorredor] = useState(item.corredor_final || item.sku_corredor_sugerido || '')
  const [nivel, setNivel] = useState(item.nivel_final || item.sku_nivel_sugerido || '')
  const [prateleira, setPrateleira] = useState(item.prateleira_final || item.sku_prateleira_sugerida || '')
  const [volumesPorItem, setVolumesPorItem] = useState(item.volumes_por_item || 1)
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch(`/api/recebimento/${recebimentoId}/item/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          corredor_final: corredor, 
          nivel_final: nivel,
          prateleira_final: prateleira,
          volumes_por_item: volumesPorItem 
        }),
      })
      if (res.ok) {
        await onSave(corredor, nivel, prateleira, volumesPorItem)
      } else {
        console.error('Erro ao salvar:', await res.text())
      }
    } catch (err) {
      console.error('Erro ao salvar local:', err)
    } finally {
      setSaving(false)
    }
  }

  const corredores = ['A', 'B', 'OS']
  const niveis = ['ACIMA', 'MEIO', 'ABAIXO']

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-md p-6 shadow-xl" onClick={e => e.stopPropagation()}>
        <h3 className="font-bold text-slate-800 mb-1">Local de Estocagem</h3>
        <p className="text-xs text-slate-500 mb-4">{item.nfe_item?.codigo_produto} — {item.sku_descricao}</p>

        <div className="mb-4">
          <label className="text-sm font-medium text-slate-600 block mb-2">Corredor</label>
          <div className="flex gap-2">
            {corredores.map(c => (
              <button
                key={c}
                onClick={() => setCorredor(c)}
                className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all ${
                  corredor === c
                    ? 'bg-[#00A5E6] text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-4">
          <label className="text-sm font-medium text-slate-600 block mb-2">Nível</label>
          <div className="flex gap-2">
            {niveis.map(n => (
              <button
                key={n}
                onClick={() => setNivel(n)}
                className={`flex-1 py-3 rounded-xl font-bold text-xs transition-all ${
                  nivel === n
                    ? 'bg-[#00A5E6] text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-4">
          <label className="text-sm font-medium text-slate-600 block mb-2">
            Prateleira
            <span className="text-xs text-slate-400 ml-1">(número da prateleira)</span>
          </label>
          <input
            type="text"
            placeholder="Ex: 1, 2, 15, 30..."
            value={prateleira}
            onChange={e => setPrateleira(e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#00A5E6]/30 focus:border-[#00A5E6]"
          />
        </div>

        <div className="mb-6">
          <label className="text-sm font-medium text-slate-600 block mb-2">
            Volumes por Item
            <span className="text-xs text-slate-400 ml-1">(quantos volumes cada unidade tem)</span>
          </label>
          <input
            type="number"
            min="1"
            max="20"
            value={volumesPorItem}
            onChange={e => setVolumesPorItem(Math.max(1, parseInt(e.target.value) || 1))}
            className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#00A5E6]/30 focus:border-[#00A5E6]"
          />
        </div>

        <div className="flex gap-3">
          <Button variant="outline" onClick={onClose} className="flex-1" disabled={saving}>Cancelar</Button>
          <Button onClick={handleSave} className="flex-1" disabled={saving}>
            {saving ? 'Salvando...' : 'Salvar'}
          </Button>
        </div>
      </div>
    </div>
  )
}

// =========================================================
// Divergência Modal
// =========================================================

function DivergenciaModal({
  item,
  recebimentoId,
  onClose,
  onSave,
}: {
  item: RecebimentoItem
  recebimentoId: string
  onClose: () => void
  onSave: (tipo: string | null, obs: string | null) => void
}) {
  const [tipo, setTipo] = useState(item.divergencia_tipo || '')
  const [obs, setObs] = useState(item.divergencia_obs || '')
  const [saving, setSaving] = useState(false)

  const tipos = [
    { value: 'faltou', label: 'Faltou', color: 'bg-red-100 text-red-700 border-red-300' },
    { value: 'sobrou', label: 'Sobrou', color: 'bg-blue-100 text-blue-700 border-blue-300' },
    { value: 'avaria', label: 'Avaria', color: 'bg-amber-100 text-amber-700 border-amber-300' },
  ]

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch(`/api/recebimento/${recebimentoId}/item/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          divergencia_tipo: tipo || null,
          divergencia_obs: obs || null,
        }),
      })
      if (res.ok) {
        onSave(tipo || null, obs || null)
      }
    } catch (err) {
      console.error('Erro ao salvar divergência:', err)
    } finally {
      setSaving(false)
    }
  }

  function handleClear() {
    setTipo('')
    setObs('')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-md p-6 shadow-xl" onClick={e => e.stopPropagation()}>
        <h3 className="font-bold text-slate-800 mb-1">Registrar Divergência</h3>
        <p className="text-xs text-slate-500 mb-4">{item.nfe_item?.codigo_produto} — {item.sku_descricao}</p>

        <div className="mb-4">
          <label className="text-sm font-medium text-slate-600 block mb-2">Tipo</label>
          <div className="flex gap-2">
            {tipos.map(t => (
              <button
                key={t.value}
                onClick={() => setTipo(tipo === t.value ? '' : t.value)}
                className={`flex-1 py-3 rounded-xl font-bold text-sm border-2 transition-all ${
                  tipo === t.value ? t.color : 'bg-slate-50 text-slate-500 border-slate-200'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-6">
          <label className="text-sm font-medium text-slate-600 block mb-1">Observação</label>
          <textarea
            value={obs}
            onChange={e => setObs(e.target.value)}
            rows={3}
            placeholder="Descreva a divergência..."
            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00A5E6]/30 focus:border-[#00A5E6] resize-none"
          />
        </div>

        {(tipo || obs) && (
          <button onClick={handleClear} className="text-xs text-red-500 hover:underline mb-3 block">
            Limpar divergência
          </button>
        )}

        <div className="flex gap-3">
          <Button variant="outline" onClick={onClose} className="flex-1" disabled={saving}>Cancelar</Button>
          <Button onClick={handleSave} className="flex-1" disabled={saving}>
            {saving ? 'Salvando...' : 'Salvar'}
          </Button>
        </div>
      </div>
    </div>
  )
}

// =========================================================
// Finalizar Modal
// =========================================================

function FinalizarModal({
  recebimentoId,
  onClose,
  onSuccess,
}: {
  recebimentoId: string
  onClose: () => void
  onSuccess: () => void
}) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleFinalizar() {
    setSaving(true)
    setError('')
    try {
      const res = await fetch(`/api/recebimento/${recebimentoId}/finalizar`, {
        method: 'POST',
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Erro ao finalizar')
        setSaving(false)
        return
      }
      onSuccess()
    } catch {
      setError('Erro de conexão')
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <h3 className="font-bold text-slate-800">Finalizar Recebimento</h3>
            <p className="text-xs text-slate-500">Esta ação não pode ser desfeita</p>
          </div>
        </div>

        {error && <p className="text-sm text-red-500 mb-3">{error}</p>}

        <div className="flex gap-3">
          <Button variant="outline" onClick={onClose} className="flex-1" disabled={saving}>Cancelar</Button>
          <Button onClick={handleFinalizar} className="flex-1 bg-green-600 hover:bg-green-700" disabled={saving}>
            {saving ? 'Finalizando...' : 'Confirmar'}
          </Button>
        </div>
      </div>
    </div>
  )
}

// =========================================================
// Cancelar Modal
// =========================================================

function CancelarModal({
  recebimentoId,
  onClose,
  onSuccess,
}: {
  recebimentoId: string
  onClose: () => void
  onSuccess: () => void
}) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleCancelar() {
    setSaving(true)
    setError('')
    try {
      const res = await fetch(`/api/recebimento/${recebimentoId}/cancelar`, {
        method: 'POST',
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Erro ao cancelar')
        setSaving(false)
        return
      }
      onSuccess()
    } catch {
      setError('Erro de conexão')
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
            <X className="w-5 h-5 text-red-600" />
          </div>
          <div>
            <h3 className="font-bold text-slate-800">Cancelar Recebimento</h3>
            <p className="text-xs text-slate-500">O recebimento ficará marcado como cancelado</p>
          </div>
        </div>

        {error && <p className="text-sm text-red-500 mb-3">{error}</p>}

        <div className="flex gap-3">
          <Button variant="outline" onClick={onClose} className="flex-1" disabled={saving}>Voltar</Button>
          <Button onClick={handleCancelar} className="flex-1 bg-red-600 hover:bg-red-700" disabled={saving}>
            {saving ? 'Cancelando...' : 'Confirmar Cancelamento'}
          </Button>
        </div>
      </div>
    </div>
  )
}
