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
  AlertCircle,
  X,
  Play,
  Pause,
  Filter,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { isMaticEmail } from '@/lib/auth/matic-emails'
import { OSItemCard } from './OSItemCard'
import { toast } from 'sonner'
import { fetchWithRetry } from '@/lib/fetch-with-retry'

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
  numero_nf: string | null
  nf_sources?: string[]
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
  timer_segundos_totais: number
  timer_rodando: boolean
  timer_ultima_acao: string | null
  ultima_atividade_conferencia: string | null
  numero_recebimento?: number
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
  const [activeTab, setActiveTab] = useState<'itens' | 'os' | 'divergencias'>('itens')
  const [statusFilter, setStatusFilter] = useState<'tudo' | 'incompleto' | 'conferido'>('tudo')
  const [corredorFilter, setCorredorFilter] = useState<'todos' | 'A' | 'B' | 'sem_local'>('todos')
  const [timerRunning, setTimerRunning] = useState(false)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
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
        // Load timer state from database
        setTimerRunning(data.timer_rodando || false)
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

  // Polling for real-time updates (every 30 seconds) - only if recebimento is open and not editing
  useEffect(() => {
    if (!recebimento || recebimento.status !== 'aberto') return
    // Pause polling if user is editing (modal open)
    if (localModal || divModal) return
    
    const interval = setInterval(() => {
      loadRecebimento()
    }, 30000)
    
    return () => clearInterval(interval)
  }, [recebimento, loadRecebimento, localModal, divModal])

  // Calculate elapsed seconds from database
  useEffect(() => {
    if (!recebimento) return
    
    const calculateElapsed = () => {
      const base = recebimento.timer_segundos_totais || 0
      
      if (recebimento.timer_rodando && recebimento.timer_ultima_acao) {
        const lastAction = new Date(recebimento.timer_ultima_acao)
        const now = new Date()
        const elapsed = Math.floor((now.getTime() - lastAction.getTime()) / 1000)
        return base + elapsed
      }
      
      return base
    }
    
    // Initial calculation
    setElapsedSeconds(calculateElapsed())
    
    // Update every second if timer is running
    if (recebimento.timer_rodando) {
      const interval = setInterval(() => {
        setElapsedSeconds(calculateElapsed())
      }, 1000)
      return () => clearInterval(interval)
    }
  }, [recebimento])
  
  // Toggle timer and save to database
  const toggleTimer = useCallback(async () => {
    const newState = !timerRunning
    setTimerRunning(newState)
    
    try {
      await fetch(`/api/recebimento/${recebimentoId}/timer`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timer_rodando: newState })
      })
      // Reload to get updated timer state
      loadRecebimento()
    } catch (err) {
      console.error('Erro ao atualizar timer:', err)
      setTimerRunning(!newState) // Revert on error
    }
  }, [timerRunning, recebimentoId, loadRecebimento])
  
  // Check for inactivity and auto-pause timer (every minute)
  useEffect(() => {
    if (!recebimento || recebimento.status !== 'aberto') return
    
    const checkInactivity = async () => {
      try {
        const res = await fetch(`/api/recebimento/${recebimentoId}/check-inactivity`, {
          method: 'POST'
        })
        if (res.ok) {
          const data = await res.json()
          // If timer was auto-paused, reload to update UI
          if (data.auto_paused) {
            console.log('[LOG] Timer pausado automaticamente por inatividade')
            loadRecebimento()
          }
        }
      } catch (err) {
        console.error('Erro ao verificar inatividade:', err)
      }
    }
    
    // Check every minute
    const interval = setInterval(checkInactivity, 60000)
    return () => clearInterval(interval)
  }, [recebimento, recebimentoId, loadRecebimento])

  if (!authorized || loading) {
    return (
      <div className="max-w-7xl mx-auto p-4 space-y-4 animate-pulse">
        {/* Header skeleton */}
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="h-6 bg-slate-200 rounded w-48"></div>
            <div className="h-10 w-32 bg-slate-200 rounded"></div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-16 bg-slate-100 rounded"></div>
            ))}
          </div>
        </div>
        
        {/* Filters skeleton */}
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex gap-2 mb-3">
            <div className="h-8 w-24 bg-slate-200 rounded"></div>
            <div className="h-8 w-24 bg-slate-200 rounded"></div>
          </div>
          <div className="h-10 bg-slate-100 rounded"></div>
        </div>
        
        {/* Items skeleton */}
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="h-5 bg-slate-200 rounded w-40 mb-3"></div>
              <div className="grid grid-cols-4 gap-2">
                {[1, 2, 3, 4].map(j => (
                  <div key={j} className="h-12 bg-slate-100 rounded"></div>
                ))}
              </div>
            </div>
          ))}
        </div>
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

  // Calculate counters for filters
  const baseItems = activeTab === 'itens' ? itensNormais : itensOS
  const totalCount = baseItems.length
  const incompletoCount = baseItems.filter(item => item.volumes_recebidos_total < item.volumes_previstos_total).length
  const conferidoCount = baseItems.filter(item => item.volumes_recebidos_total >= item.volumes_previstos_total).length
  
  // Filter items by search - dynamic multi-word search
  const filtered = baseItems
    .filter(item => {
      if (!search) return true
      const searchTerms = search.toLowerCase().trim().split(/\s+/)
      const codigo = item.nfe_item?.codigo_produto?.toLowerCase() || ''
      const refs = ((item as any).refs_display?.toLowerCase()) || ''
      const desc = item.sku_descricao?.toLowerCase() || ''
      const osNum = item.os_numero?.toLowerCase() || ''
      const fullText = `${codigo} ${refs} ${desc} ${osNum}`
      
      return searchTerms.every(term => fullText.includes(term))
    })
    .filter(item => {
      if (statusFilter === 'tudo') return true
      const isComplete = item.volumes_recebidos_total >= item.volumes_previstos_total
      if (statusFilter === 'conferido') return isComplete
      if (statusFilter === 'incompleto') return !isComplete
      return true
    })
    .filter(item => {
      if (corredorFilter === 'todos') return true
      if (corredorFilter === 'sem_local') {
        const corredor = item.corredor_final || item.sku_corredor_sugerido
        const nivel = item.nivel_final || item.sku_nivel_sugerido
        const prateleira = item.prateleira_final || item.sku_prateleira_sugerida
        return !corredor || !nivel || !prateleira
      }
      const corredor = item.corredor_final || item.sku_corredor_sugerido
      return corredor === corredorFilter
    })
    .sort((a, b) => {
      // 1. Ordenar por corredor (A, B, OS)
      const corredorA = a.corredor_final || a.sku_corredor_sugerido || ''
      const corredorB = b.corredor_final || b.sku_corredor_sugerido || ''
      
      if (corredorA !== corredorB) {
        return corredorA.localeCompare(corredorB)
      }
      
      // 2. Ordenar por prateleira (numérica)
      const prateleiraA = a.prateleira_final || a.sku_prateleira_sugerida || ''
      const prateleiraB = b.prateleira_final || b.sku_prateleira_sugerida || ''
      
      if (prateleiraA !== prateleiraB) {
        const numA = parseInt(prateleiraA) || 0
        const numB = parseInt(prateleiraB) || 0
        if (numA !== numB) {
          return numA - numB
        }
        return prateleiraA.localeCompare(prateleiraB)
      }
      
      // 3. Ordenar por nome alfabético
      const nomeA = a.sku_descricao?.toLowerCase() || ''
      const nomeB = b.sku_descricao?.toLowerCase() || ''
      return nomeA.localeCompare(nomeB)
    })

  // Check if can finalize
  const canFinalize = recebimento.itens.every(item => {
    const complete = item.volumes_recebidos_total >= item.volumes_previstos_total
    return complete || !!item.divergencia_tipo
  })

  // Format timer display
  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className="max-w-2xl mx-auto pb-24">
      {/* Header */}
      <div className="flex items-center gap-2 sm:gap-3 mb-4">
        <button onClick={() => router.push('/recebimento')} className="p-1.5 sm:p-2 -ml-2 rounded-xl hover:bg-slate-100 flex-shrink-0">
          <ArrowLeft className="w-5 h-5 text-slate-600" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
            <h1 className="text-base sm:text-lg font-bold text-slate-800 truncate">Conferência</h1>
            {recebimento.numero_recebimento && (
              <span className="text-xs text-slate-400 font-mono">#{recebimento.numero_recebimento}</span>
            )}
            {!isFechado && !isCancelado && (
              <div className="flex items-center gap-1 sm:gap-1.5 bg-slate-100 rounded-lg px-1.5 sm:px-2 py-1">
                <button
                  onClick={toggleTimer}
                  className="p-0.5 sm:p-1 hover:bg-slate-200 rounded transition-colors"
                  aria-label={timerRunning ? 'Pausar' : 'Iniciar'}
                >
                  {timerRunning ? (
                    <Pause className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-slate-600" />
                  ) : (
                    <Play className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-slate-600" />
                  )}
                </button>
                <span className="text-[10px] sm:text-xs font-mono font-semibold text-slate-700">
                  {formatTime(elapsedSeconds)}
                </span>
              </div>
            )}
          </div>
          <p className="text-xs text-slate-500">
            {recebimento.nfes?.length || 0} NF(s) • {recebimento.itens.length} itens
            {recebimento.motorista && ` • ${recebimento.motorista}`}
          </p>
        </div>
        {isFechado ? (
          <span className="text-[10px] sm:text-xs font-semibold px-2 sm:px-3 py-1 rounded-full bg-green-100 text-green-700 flex-shrink-0">
            FECHADO
          </span>
        ) : isCancelado ? (
          <span className="text-[10px] sm:text-xs font-semibold px-2 sm:px-3 py-1 rounded-full bg-red-100 text-red-700 flex-shrink-0">
            CANCELADO
          </span>
        ) : (
          <div className="flex gap-1.5 sm:gap-2 flex-shrink-0">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowCancelar(true)}
              className="text-[10px] sm:text-xs px-2 sm:px-3"
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={() => setShowFinalizar(true)}
              disabled={!canFinalize}
              className="text-[10px] sm:text-xs px-2 sm:px-3"
            >
              Finalizar
            </Button>
          </div>
        )}
      </div>
      {/* Sticky Filters Container (Mobile Optimized) */}
      <div className="sticky top-0 md:top-16 z-30 bg-white/95 backdrop-blur-md pt-2 pb-2 border-b border-slate-200 shadow-sm mb-4 -mx-4 px-4 sm:-mx-6 sm:px-6">
        {/* Row 1: Search & Progress Badge */}
        <div className="flex items-center gap-2 mb-2">
          {/* Progress Badge */}
          <div className="flex-shrink-0 flex flex-col items-center justify-center bg-slate-50 border border-slate-200 rounded-xl px-2.5 sm:px-3 h-10 relative overflow-hidden">
            <div 
              className={`absolute inset-0 transition-all duration-300 ${
                pctGeral >= 100 ? 'bg-green-500/35' : pctGeral > 0 ? 'bg-amber-400/35' : ''
              }`}
              style={{ width: `${Math.min(pctGeral, 100)}%` }}
            />
            <span className="relative z-10 text-[11px] sm:text-xs font-bold text-slate-800 tabular-nums">
              {recebimento.total_recebido}/{recebimento.total_previsto}
            </span>
          </div>

          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder={activeTab === 'itens' ? 'Buscar produto... (use espaços para múltiplos termos)' : 'Buscar OS...'}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-8 h-10 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#00A5E6]/20 focus:border-[#00A5E6] text-base bg-slate-50"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 hover:bg-slate-100 rounded p-1 transition-colors">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            )}
          </div>
        </div>

        {/* Row 2: Scrollable Filters */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 sm:-mx-6 sm:px-6 pb-0.5">
          {/* Group 1: Tabs */}
          <div className="flex items-center gap-1 p-1 bg-slate-100/70 rounded-xl shrink-0">
            <button
              onClick={() => setActiveTab('itens')}
              className={`px-3 py-1.5 rounded-lg font-medium text-[11px] transition-all ${
                activeTab === 'itens' ? 'bg-[#00A5E6] text-white shadow-sm' : 'text-slate-600'
              }`}
            >
              Itens ({itensNormais.length})
            </button>
            <button
              onClick={() => setActiveTab('os')}
              className={`px-3 py-1.5 rounded-lg font-medium text-[11px] transition-all ${
                activeTab === 'os' ? 'bg-[#00A5E6] text-white shadow-sm' : 'text-slate-600'
              }`}
            >
              OS ({itensOS.length})
            </button>
            <button
              onClick={() => setActiveTab('divergencias')}
              className={`px-3 py-1.5 rounded-lg font-medium text-[11px] transition-all ${
                activeTab === 'divergencias' ? 'bg-amber-600 text-white shadow-sm' : 'text-slate-600'
              }`}
              title="Itens com problemas neste recebimento (faltou, sobrou, avaria)"
            >
              Divergências
            </button>
          </div>

          {/* Group 2: Status */}
          <div className="flex items-center gap-1 p-1 bg-slate-100/70 rounded-xl shrink-0">
            <button
              onClick={() => setStatusFilter('tudo')}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all ${
                statusFilter === 'tudo' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-600'
              }`}
            >
              Tudo <span className="opacity-75">({totalCount})</span>
            </button>
            <button
              onClick={() => setStatusFilter('incompleto')}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all ${
                statusFilter === 'incompleto' ? 'bg-amber-500 text-white shadow-sm' : 'text-slate-600'
              }`}
            >
              Incompleto <span className="opacity-75">({incompletoCount})</span>
            </button>
            <button
              onClick={() => setStatusFilter('conferido')}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all ${
                statusFilter === 'conferido' ? 'bg-green-500 text-white shadow-sm' : 'text-slate-600'
              }`}
            >
              Conferido <span className="opacity-75">({conferidoCount})</span>
            </button>
          </div>

          {/* Group 3: Corredor */}
          {activeTab === 'itens' && (
            <div className="flex items-center gap-1 p-1 bg-slate-100/70 rounded-xl shrink-0">
              <span className="text-[10px] uppercase font-bold text-slate-400 px-1">Corredor</span>
              <button
                onClick={() => setCorredorFilter('todos')}
                className={`px-2 py-1.5 rounded-lg text-[11px] font-medium transition-all ${
                  corredorFilter === 'todos' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-600'
                }`}
              >
                Todos
              </button>
              <button
                onClick={() => setCorredorFilter('A')}
                className={`px-2 py-1.5 rounded-lg text-[11px] font-bold transition-all ${
                  corredorFilter === 'A' ? 'bg-orange-600 text-white shadow-sm' : 'text-orange-600'
                }`}
              >
                A
              </button>
              <button
                onClick={() => setCorredorFilter('B')}
                className={`px-2 py-1.5 rounded-lg text-[11px] font-bold transition-all ${
                  corredorFilter === 'B' ? 'bg-blue-700 text-white shadow-sm' : 'text-blue-700'
                }`}
              >
                B
              </button>
              <button
                onClick={() => setCorredorFilter('sem_local')}
                className={`px-2 py-1.5 rounded-lg text-[11px] font-medium transition-all whitespace-nowrap ${
                  corredorFilter === 'sem_local' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-600'
                }`}
              >
                Sem local
              </button>
            </div>
          )}
        </div>
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
        ) : activeTab === 'os' ? (
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
        ) : (
          <DivergenciasTab recebimentoId={recebimentoId} itens={recebimento.itens} onReload={loadRecebimento} />
        )}

        {filtered.length === 0 && activeTab !== 'divergencias' && (
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
    
    // Optimistic update - save previous state for rollback
    const volume = item.recebimento_item_volumes.find(v => v.volume_numero === volumeNumero)
    const prevQtdRecebida = volume?.qtd_recebida || 0
    const prevTotalRecebido = item.volumes_recebidos_total
    
    // Apply optimistic update
    const newQtdRecebida = Math.max(0, prevQtdRecebida + delta)
    const newTotalRecebido = prevTotalRecebido - prevQtdRecebida + newQtdRecebida
    onVolumeUpdate(item.id, volumeNumero, newQtdRecebida, newTotalRecebido)
    
    try {
      const res = await fetchWithRetry(
        `/api/recebimento/${recebimentoId}/item/${item.id}/volume/${volumeNumero}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ delta }),
        },
        3, // 3 retries
        500 // 500ms initial delay
      )
      
      if (res.ok) {
        const data = await res.json()
        // Update with server response to ensure consistency
        onVolumeUpdate(item.id, volumeNumero, data.qtd_recebida, data.item_total_recebido)
      } else {
        // Rollback on error
        onVolumeUpdate(item.id, volumeNumero, prevQtdRecebida, prevTotalRecebido)
        toast.error('Não foi possível atualizar o volume. Tente novamente.')
      }
    } catch (err) {
      console.error('Erro ao atualizar volume:', err)
      // Rollback on error
      onVolumeUpdate(item.id, volumeNumero, prevQtdRecebida, prevTotalRecebido)
      toast.error('Erro de conexão ao atualizar volume')
    } finally {
      setLoadingVolume(null)
    }
  }

  return (
    <div className={`rounded-xl border-2 p-4 transition-all ${bgColor}`}>
      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
            <p className="text-xs font-mono text-slate-500">{(item as any).refs_display || item.nfe_item?.codigo_produto}</p>
            {item.nf_sources && item.nf_sources.length > 0 ? (
              item.nf_sources.map(nf => (
                <span key={nf} className="text-[10px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded font-mono">
                  NF {nf}
                </span>
              ))
            ) : item.numero_nf && (
              <span className="text-[10px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded font-mono">
                NF {item.numero_nf}
              </span>
            )}
            {item.nf_sources && item.nf_sources.length > 1 && (
              <span 
                className="text-[10px] bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded font-semibold cursor-help" 
                title={`Agrupado de ${item.nf_sources.length} NFs: ${item.nf_sources.join(', ')}`}
              >
                📦 {item.nf_sources.length} NFs
              </span>
            )}
          </div>
          <p className="font-semibold text-sm text-slate-800 leading-tight">
            {item.sku_descricao || item.nfe_item?.descricao}
          </p>
        </div>
        {status === 'concluido' && (
          <div className="ml-2 p-1 rounded-full bg-green-100">
            <CheckCircle2 className="w-4 h-4 text-green-600" />
          </div>
        )}
      </div>

      {/* Local info */}
      <div className="flex items-center gap-2 text-xs mb-3">
        <MapPin className="w-3.5 h-3.5 text-slate-500" />
        <span className={`font-bold ${
          (item.corredor_final || item.sku_corredor_sugerido) === 'A' ? 'text-orange-600' :
          (item.corredor_final || item.sku_corredor_sugerido) === 'B' ? 'text-blue-700' :
          'text-slate-600'
        }`}>
          {item.corredor_final || item.sku_corredor_sugerido || '—'}
          {' / '}
          {(item.prateleira_final || item.sku_prateleira_sugerida) || '—'}
          {' / '}
          {item.nivel_final || item.sku_nivel_sugerido || '—'}
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
        <span>Total: <span className={`${
          item.volumes_previstos_total >= 7 ? 'px-1.5 py-0.5 rounded bg-red-100 text-red-700 font-semibold' :
          item.volumes_previstos_total >= 4 ? 'px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 font-semibold' :
          ''
        }`}>{item.volumes_recebidos_total}/{item.volumes_previstos_total}</span></span>
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
                  <span className={`text-sm font-bold ${
                    volComplete ? 'text-green-700' :
                    vol.qtd_prevista >= 7 ? 'px-1.5 py-0.5 rounded bg-red-100 text-red-700' :
                    vol.qtd_prevista >= 4 ? 'px-1.5 py-0.5 rounded bg-orange-100 text-orange-700' :
                    'text-slate-700'
                  }`}>
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
        toast.success('Local salvo com sucesso')
        await onSave(corredor, nivel, prateleira, volumesPorItem)
      } else {
        const errorText = await res.text()
        console.error('Erro ao salvar:', errorText)
        toast.error('Não foi possível salvar o local. Verifique os dados.')
      }
    } catch (err) {
      console.error('Erro ao salvar local:', err)
      toast.error('Erro de conexão ao salvar local')
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
        toast.success(tipo ? 'Divergência registrada' : 'Divergência removida')
        onSave(tipo || null, obs || null)
      } else {
        toast.error('Não foi possível salvar a divergência')
      }
    } catch (err) {
      console.error('Erro ao salvar divergência:', err)
      toast.error('Erro de conexão ao salvar divergência')
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

interface ProblemaPendente {
  id: string
  descricao: string
  recebimento_id: string
  created_at: string
}

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
  const [problemasPendentes, setProblemasPendentes] = useState<ProblemaPendente[]>([])
  const [problemasResolvidos, setProblemasResolvidos] = useState<Set<string>>(new Set())
  const [formData, setFormData] = useState({
    quemFinalizou: '',
    quantidadeChapas: '',
    motoristaAjudou: 'Sim',
    problemaProximosCarregamentos: '',
    outrosProblemas: '',
  })

  // Buscar problemas pendentes de recebimentos anteriores
  useEffect(() => {
    async function loadProblemasPendentes() {
      try {
        const res = await fetch(`/api/recebimento/problemas-pendentes?apenas_nao_resolvidos=true`)
        if (res.ok) {
          const data = await res.json()
          setProblemasPendentes(data)
        }
      } catch (err) {
        console.error('Erro ao carregar problemas pendentes:', err)
      }
    }
    loadProblemasPendentes()
  }, [])

  async function handleFinalizar() {
    // Validação básica
    if (!formData.quemFinalizou.trim()) {
      setError('Por favor, preencha quem está finalizando o recebimento')
      return
    }
    
    setSaving(true)
    setError('')
    try {
      // Primeiro finalizar o recebimento
      const res = await fetch(`/api/recebimento/${recebimentoId}/finalizar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quem_finalizou: formData.quemFinalizou,
          quantidade_chapas: parseInt(formData.quantidadeChapas) || 0,
          motorista_ajudou: formData.motoristaAjudou,
          problema_proximos_carregamentos: formData.problemaProximosCarregamentos,
          outros_problemas: formData.outrosProblemas,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Erro ao finalizar')
        setSaving(false)
        return
      }
      
      // Feedback sobre envio para planilha via toast
      const sheetsStatus = data.sheets_status || 'not_configured'
      const sheetsError = data.sheets_error || null
      
      if (sheetsStatus === 'success') {
        toast.success('Dados enviados para a planilha do Google!', { duration: 5000 })
      } else if (sheetsStatus === 'error') {
        toast.error(`Erro ao enviar para planilha: ${sheetsError}`, { duration: 8000 })
      } else if (sheetsStatus === 'not_configured') {
        toast.warning('Planilha não configurada. Recebimento finalizado sem registro na planilha.', { duration: 6000 })
      }
      
      // Marcar problemas como resolvidos
      if (problemasResolvidos.size > 0) {
        await fetch('/api/recebimento/problemas-pendentes/resolver', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            problema_ids: Array.from(problemasResolvidos),
          }),
        })
      }
      
      setSaving(false)
      toast.success('Recebimento finalizado com sucesso!')
      
      // Aguardar 1.5 segundos antes de redirecionar
      setTimeout(() => {
        onSuccess()
      }, 1500)
    } catch {
      setError('Erro de conexão')
      toast.error('Erro de conexão ao finalizar recebimento')
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-xl my-8" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <h3 className="font-bold text-slate-800">Finalizar Recebimento</h3>
            <p className="text-xs text-slate-500">Preencha as informações para registro</p>
          </div>
        </div>

        {error && <p className="text-sm text-red-500 mb-4 p-3 bg-red-50 rounded-lg">{error}</p>}

        <div className="space-y-4 mb-6">
          {/* Problemas pendentes de recebimentos anteriores */}
          {problemasPendentes.length > 0 && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <h4 className="text-sm font-semibold text-amber-900 mb-2 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                Problemas do último recebimento
              </h4>
              <div className="space-y-2">
                {problemasPendentes.map((problema) => (
                  <label key={problema.id} className="flex items-start gap-2 text-sm text-amber-800 cursor-pointer hover:bg-amber-100 p-2 rounded">
                    <input
                      type="checkbox"
                      checked={problemasResolvidos.has(problema.id)}
                      onChange={(e) => {
                        const newSet = new Set(problemasResolvidos)
                        if (e.target.checked) {
                          newSet.add(problema.id)
                        } else {
                          newSet.delete(problema.id)
                        }
                        setProblemasResolvidos(newSet)
                      }}
                      className="mt-0.5 rounded border-amber-300"
                      disabled={saving}
                    />
                    <span className="flex-1">{problema.descricao}</span>
                  </label>
                ))}
              </div>
              <p className="text-xs text-amber-700 mt-2">✓ Marque os problemas que foram resolvidos</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Quem está finalizando? *</label>
            <input
              type="text"
              value={formData.quemFinalizou}
              onChange={(e) => setFormData({ ...formData, quemFinalizou: e.target.value })}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500"
              placeholder="Ex: LUCAS"
              disabled={saving}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Quantidade de chapas</label>
            <input
              type="number"
              value={formData.quantidadeChapas}
              onChange={(e) => setFormData({ ...formData, quantidadeChapas: e.target.value })}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500"
              placeholder="0"
              min="0"
              disabled={saving}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Motorista ajudou?</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, motoristaAjudou: 'Sim' })}
                className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all ${
                  formData.motoristaAjudou === 'Sim'
                    ? 'bg-green-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
                disabled={saving}
              >
                Sim
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, motoristaAjudou: 'Não' })}
                className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all ${
                  formData.motoristaAjudou === 'Não'
                    ? 'bg-red-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
                disabled={saving}
              >
                Não
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Algum problema que deve ser resolvido nos próximos carregamentos?
            </label>
            <p className="text-xs text-slate-500 mb-2">
              Faltou algum volume, não veio alguma assistência, etc... Anote o que aconteceu, colocando número da NF ou os que faltou.
            </p>
            <textarea
              value={formData.problemaProximosCarregamentos}
              onChange={(e) => setFormData({ ...formData, problemaProximosCarregamentos: e.target.value })}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 resize-none"
              rows={3}
              placeholder="Descreva problemas que devem ser resolvidos..."
              disabled={saving}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Outros tipos de problemas</label>
            <p className="text-xs text-slate-500 mb-2">
              Problemas que não precisam ser resolvidos nos próximos carregamentos, como por exemplo: Muitas caixas abertas, falar com a fábrica pra ajustar o processo interno.
            </p>
            <textarea
              value={formData.outrosProblemas}
              onChange={(e) => setFormData({ ...formData, outrosProblemas: e.target.value })}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 resize-none"
              rows={3}
              placeholder="Outros problemas ou observações..."
              disabled={saving}
            />
          </div>
        </div>

        <div className="flex gap-3">
          <Button variant="outline" onClick={onClose} className="flex-1" disabled={saving}>Cancelar</Button>
          <Button onClick={handleFinalizar} className="flex-1 bg-green-600 hover:bg-green-700" disabled={saving}>
            {saving ? 'Finalizando...' : 'Finalizar'}
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
        toast.error(data.error || 'Não foi possível cancelar o recebimento')
        setSaving(false)
        return
      }
      toast.success('Recebimento cancelado com sucesso')
      onSuccess()
    } catch {
      setError('Erro de conexão')
      toast.error('Erro de conexão ao cancelar recebimento')
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

// =========================================================
// Divergências Tab
// =========================================================

function DivergenciasTab({
  recebimentoId,
  itens,
  onReload,
}: {
  recebimentoId: string
  itens: RecebimentoItem[]
  onReload: () => void
}) {
  const [problemasPendentes, setProblemasPendentes] = useState<ProblemaPendente[]>([])
  const [resolvendo, setResolvendo] = useState<Set<string>>(new Set())

  useEffect(() => {
    loadProblemas()
  }, [])

  async function loadProblemas() {
    try {
      const res = await fetch('/api/recebimento/problemas-pendentes?apenas_nao_resolvidos=true')
      if (res.ok) {
        const data = await res.json()
        setProblemasPendentes(data)
      }
    } catch (err) {
      console.error('Erro ao carregar problemas:', err)
      toast.error('Não foi possível carregar os problemas pendentes')
    }
  }

  async function marcarComoResolvido(problemaId: string) {
    setResolvendo(prev => new Set(prev).add(problemaId))
    
    // Remover localmente para feedback imediato (optimistic update)
    setProblemasPendentes(prev => prev.filter(p => p.id !== problemaId))
    
    try {
      const res = await fetch('/api/recebimento/problemas-pendentes/resolver', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ problema_ids: [problemaId] }),
      })
      if (res.ok) {
        toast.success('Problema marcado como resolvido')
      } else {
        // Reverter se falhar
        await loadProblemas()
        toast.error('Não foi possível marcar o problema como resolvido')
      }
    } catch (err) {
      console.error('Erro ao resolver problema:', err)
      // Reverter se falhar
      await loadProblemas()
      toast.error('Erro de conexão ao marcar problema como resolvido')
    } finally {
      setResolvendo(prev => {
        const newSet = new Set(prev)
        newSet.delete(problemaId)
        return newSet
      })
    }
  }

  const itensDivergentes = itens.filter(item => item.divergencia_tipo)

  return (
    <div className="space-y-4">
      {/* Problemas pendentes de outros recebimentos */}
      {problemasPendentes.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <h3 className="font-semibold text-amber-900 mb-3 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            Problemas de recebimentos anteriores ({problemasPendentes.length})
          </h3>
          <div className="space-y-2">
            {problemasPendentes.map(problema => (
              <div key={problema.id} className="bg-white rounded-lg p-3 border border-amber-200">
                <p className="text-sm text-slate-700 mb-2">{problema.descricao}</p>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">
                    {new Date(problema.created_at).toLocaleDateString('pt-BR')}
                  </span>
                  <Button
                    size="sm"
                    onClick={() => marcarComoResolvido(problema.id)}
                    disabled={resolvendo.has(problema.id)}
                    className="bg-green-600 hover:bg-green-700 text-xs h-7"
                  >
                    {resolvendo.has(problema.id) ? 'Marcando...' : 'Marcar como resolvido'}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Itens com divergência neste recebimento */}
      {itensDivergentes.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-orange-600" />
            Itens com divergência neste recebimento ({itensDivergentes.length})
          </h3>
          <div className="space-y-2">
            {itensDivergentes.map(item => (
              <div key={item.id} className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <p className="font-medium text-slate-800 text-sm">
                      {item.nfe_item?.codigo_produto} - {item.sku_descricao || item.nfe_item?.descricao}
                    </p>
                    {item.numero_nf && (
                      <p className="text-xs text-slate-500">NF: {item.numero_nf}</p>
                    )}
                  </div>
                  <span className="px-2 py-1 bg-orange-100 text-orange-800 text-xs font-medium rounded">
                    {item.divergencia_tipo}
                  </span>
                </div>
                {item.divergencia_obs && (
                  <p className="text-sm text-slate-600 bg-white p-2 rounded border border-slate-200">
                    {item.divergencia_obs}
                  </p>
                )}
                <div className="mt-2 flex items-center gap-4 text-xs text-slate-500">
                  <span>Previsto: {item.volumes_previstos_total} vol</span>
                  <span>Recebido: {item.volumes_recebidos_total} vol</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {problemasPendentes.length === 0 && itensDivergentes.length === 0 && (
        <div className="text-center py-12">
          <CheckCircle2 className="w-12 h-12 text-green-600 mx-auto mb-3" />
          <p className="text-slate-600 font-medium">Nenhuma divergência encontrada</p>
          <p className="text-sm text-slate-400">Todos os itens estão corretos!</p>
        </div>
      )}
    </div>
  )
}
