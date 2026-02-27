'use client'

import { useState, useEffect, useRef } from 'react'
import { Package, Plus, Minus, CheckCircle2 } from 'lucide-react'

interface RecebimentoItem {
  id: string
  os_numero: string | null
  volumes_previstos_total: number
  volumes_recebidos_total: number
  sku_descricao: string
}

export function OSItemCard({
  item,
  recebimentoId,
  isFechado,
  onVolumeUpdate,
}: {
  item: RecebimentoItem
  recebimentoId: string
  isFechado: boolean
  onVolumeUpdate: (itemId: string, newRecebido: number, newTotal: number) => void
}) {
  const [loading, setLoading] = useState(false)
  const [localVolumes, setLocalVolumes] = useState(item.volumes_recebidos_total)
  const debounceTimer = useRef<NodeJS.Timeout | null>(null)
  const saveInProgress = useRef(false)

  // Update local state when item changes from parent
  useEffect(() => {
    if (!saveInProgress.current) {
      setLocalVolumes(item.volumes_recebidos_total)
    }
  }, [item.volumes_recebidos_total])

  const isComplete = localVolumes >= item.volumes_previstos_total
  const bgColor = isComplete ? 'border-green-300 bg-green-50/50' : 'border-slate-200 bg-white'
  const totalPct = item.volumes_previstos_total > 0
    ? Math.round((localVolumes / item.volumes_previstos_total) * 100)
    : 0

  async function saveToDatabase(newValue: number) {
    if (!item.os_numero) return
    
    saveInProgress.current = true
    try {
      const res = await fetch(`/api/recebimento/${recebimentoId}/os/${item.os_numero}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          volumes_recebidos: newValue,
          volumes_previstos: item.volumes_previstos_total,
        }),
      })
      
      if (res.ok) {
        onVolumeUpdate(item.id, newValue, newValue)
      }
    } catch (err) {
      console.error('Erro ao salvar OS:', err)
    } finally {
      saveInProgress.current = false
    }
  }

  function handleDelta(delta: number) {
    if (isFechado) return
    
    const newValue = localVolumes + delta
    if (newValue < 0 || newValue > item.volumes_previstos_total) return

    // Update local state immediately for UI responsiveness
    setLocalVolumes(newValue)
    
    // Debounce database save (wait 1.5s after last interaction)
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current)
    }
    
    debounceTimer.current = setTimeout(() => {
      saveToDatabase(newValue)
    }, 1500)
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current)
      }
    }
  }, [])

  return (
    <div className={`rounded-xl border-2 p-4 transition-all ${bgColor}`}>
      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1 min-w-0 flex items-center gap-2">
          <Package className="w-4 h-4 text-blue-500 flex-shrink-0" />
          <div>
            <p className="font-semibold text-sm text-slate-800 leading-tight">
              {item.sku_descricao}
            </p>
            <p className="text-xs text-blue-600 font-medium mt-0.5">
              Ordem de Serviço
            </p>
          </div>
        </div>
        {isComplete && (
          <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 ml-2" />
        )}
      </div>

      {/* Progress */}
      <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
        <span>Volumes: {item.volumes_recebidos_total}/{item.volumes_previstos_total}</span>
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

      {/* Counter */}
      <div className="flex items-center justify-center gap-3">
        {!isFechado && (
          <>
            <button
              onClick={() => handleDelta(-1)}
              disabled={localVolumes <= 0 || loading}
              className="w-12 h-12 rounded-xl bg-slate-200 hover:bg-slate-300 disabled:opacity-30 flex items-center justify-center transition-colors"
            >
              <Minus className="w-5 h-5 text-slate-600" />
            </button>
            <div className="flex flex-col items-center min-w-[80px]">
              <span className="text-2xl font-bold text-slate-800">
                {localVolumes}
              </span>
              <span className="text-xs text-slate-500">
                de {item.volumes_previstos_total}
              </span>
            </div>
            <button
              onClick={() => handleDelta(1)}
              disabled={localVolumes >= item.volumes_previstos_total || loading}
              className="w-12 h-12 rounded-xl bg-[#00A5E6] hover:bg-[#0090cc] disabled:opacity-30 flex items-center justify-center transition-colors shadow-sm active:scale-95"
            >
              <Plus className="w-5 h-5 text-white" />
            </button>
          </>
        )}
        {isFechado && (
          <div className="flex flex-col items-center py-2">
            <span className="text-2xl font-bold text-slate-800">
              {localVolumes}
            </span>
            <span className="text-xs text-slate-500">
              de {item.volumes_previstos_total}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
