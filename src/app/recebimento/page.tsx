'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Package, Plus, Calendar, Truck, ChevronRight, Upload, FileText, Weight, X, Hash, Download, AlertCircle, Loader2, Search, Mail, Database, TrendingUp, BarChart3, Clock, Users, Eye } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { isMaticEmail } from '@/lib/auth/matic-emails'

interface Recebimento {
  id: string
  periodo_inicio: string
  periodo_fim: string
  data_inicio: string
  data_fim: string | null
  motorista: string | null
  quantos_chapas: number | null
  obs: string | null
  status: string
  total_previsto: number
  total_recebido: number
  total_itens: number
  peso_total: number
  qtd_os: number
  numeros_os: string[]
  recebimento_nfes: Array<{
    nfe_id: string
    nfe: { numero_nf: string; data_emissao: string; peso_total: number; volumes_total: number; is_os: boolean } | null
  }>
}

type TabType = 'recebimentos' | 'notas' | 'divergencias' | 'dashboard'

export default function RecebimentoPage() {
  const router = useRouter()
  const [recebimentos, setRecebimentos] = useState<Recebimento[]>([])
  const [loading, setLoading] = useState(true)
  const [authorized, setAuthorized] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [activeTab, setActiveTab] = useState<TabType>('recebimentos')
  const [prefilledDates, setPrefilledDates] = useState<{ inicio: string; fim: string } | null>(null)

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

  const loadRecebimentos = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/recebimento')
      if (res.ok) {
        const data = await res.json()
        setRecebimentos(data)
      }
    } catch (err) {
      console.error('Erro ao carregar recebimentos:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (authorized) loadRecebimentos()
  }, [authorized, loadRecebimentos])

  if (!authorized) return null

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Package className="w-7 h-7 text-[#00A5E6]" />
          <h1 className="text-2xl font-bold text-slate-800">Recebimento Matic</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowImport(true)} className="gap-2">
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Importar NFe</span>
          </Button>
          <Button onClick={() => setShowCreate(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Novo Recebimento</span>
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl border border-slate-200 mb-6">
        <div className="flex border-b border-slate-200">
          <button
            onClick={() => setActiveTab('recebimentos')}
            className={`flex-1 px-6 py-3 text-sm font-medium transition-colors ${
              activeTab === 'recebimentos'
                ? 'text-[#00A5E6] border-b-2 border-[#00A5E6]'
                : 'text-slate-600 hover:text-slate-800'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <Package className="w-4 h-4" />
              Recebimentos
            </div>
          </button>
          <button
            onClick={() => setActiveTab('notas')}
            className={`flex-1 px-6 py-3 text-sm font-medium transition-colors ${
              activeTab === 'notas'
                ? 'text-[#00A5E6] border-b-2 border-[#00A5E6]'
                : 'text-slate-600 hover:text-slate-800'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <FileText className="w-4 h-4" />
              Notas Vinculadas
            </div>
          </button>
          <button
            onClick={() => setActiveTab('divergencias')}
            className={`flex-1 px-6 py-3 text-sm font-medium transition-colors ${
              activeTab === 'divergencias'
                ? 'text-[#00A5E6] border-b-2 border-[#00A5E6]'
                : 'text-slate-600 hover:text-slate-800'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <AlertCircle className="w-4 h-4" />
              Divergências
            </div>
          </button>
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`flex-1 px-6 py-3 text-sm font-medium transition-colors ${
              activeTab === 'dashboard'
                ? 'text-[#00A5E6] border-b-2 border-[#00A5E6]'
                : 'text-slate-600 hover:text-slate-800'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Dashboard
            </div>
          </button>
        </div>
      </div>

      {showImport && (
        <ImportNFeModal
          onClose={() => setShowImport(false)}
          onSuccess={() => { setShowImport(false); loadRecebimentos() }}
          onStartRecebimento={(dates) => {
            setPrefilledDates(dates)
            setShowImport(false)
            setShowCreate(true)
          }}
        />
      )}

      {showCreate && (
        <CreateRecebimentoModal
          onClose={() => {
            setShowCreate(false)
            setPrefilledDates(null)
          }}
          onSuccess={(id) => { router.push(`/recebimento/${id}`) }}
          initialDates={prefilledDates}
        />
      )}

      {/* Tab Content */}
      {activeTab === 'recebimentos' && (
        loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#00A5E6]" />
          </div>
        ) : recebimentos.length === 0 ? (
          <div className="text-center py-20 text-slate-500">
            <Package className="w-16 h-16 mx-auto mb-4 text-slate-300" />
            <p className="text-lg font-medium">Nenhum recebimento encontrado</p>
            <p className="text-sm mt-1">Importe NFs e crie um novo recebimento</p>
          </div>
        ) : (
          <div className="space-y-3">
            {recebimentos.map((rec) => (
              <RecebimentoCard key={rec.id} rec={rec} onReload={loadRecebimentos} />
            ))}
          </div>
        )
      )}

      {activeTab === 'notas' && <NotasVinculadasTab />}

      {activeTab === 'divergencias' && <DivergenciasListagemTab />}

      {activeTab === 'dashboard' && <DashboardTab recebimentos={recebimentos} />}
    </div>
  )
}

// =========================================================
// Recebimento Card
// =========================================================

function RecebimentoCard({ rec, onReload }: { rec: Recebimento; onReload: () => void }) {
  const router = useRouter()
  const [showCancelarModal, setShowCancelarModal] = useState(false)
  const [showDetailsModal, setShowDetailsModal] = useState(false)
  const [canceling, setCanceling] = useState(false)
  const [hasDivergencias, setHasDivergencias] = useState(false)
  const [divergenciasPorNF, setDivergenciasPorNF] = useState<Map<string, number>>(new Map())
  const pct = rec.total_previsto > 0 ? Math.round((rec.total_recebido / rec.total_previsto) * 100) : 0
  const isFechado = rec.status === 'fechado'
  const isCancelado = rec.status === 'cancelado'
  const nfes = rec.recebimento_nfes || []
  const pesoTotal = rec.peso_total || 0
  const qtdOS = rec.qtd_os || 0

  useEffect(() => {
    async function checkDivergencias() {
      try {
        const res = await fetch(`/api/recebimento/${rec.id}`)
        if (res.ok) {
          const data = await res.json()
          const itensComDivergencia = data.itens?.filter((item: any) => item.divergencia_tipo) || []
          setHasDivergencias(itensComDivergencia.length > 0)
          
          // Contar divergências por NF
          const countMap = new Map<string, number>()
          for (const item of itensComDivergencia) {
            const nf = item.numero_nf
            if (nf) {
              countMap.set(nf, (countMap.get(nf) || 0) + 1)
            }
          }
          setDivergenciasPorNF(countMap)
        }
      } catch (err) {
        console.error('Erro ao verificar divergências:', err)
      }
    }
    if (isFechado) {
      checkDivergencias()
    }
  }, [rec.id, isFechado])

  async function handleCancelar() {
    setCanceling(true)
    try {
      const res = await fetch(`/api/recebimento/${rec.id}/cancelar`, { method: 'POST' })
      if (res.ok) {
        setShowCancelarModal(false)
        onReload()
      } else {
        const data = await res.json()
        alert(data.error || 'Erro ao cancelar')
      }
    } catch (err) {
      console.error('Erro ao cancelar:', err)
      alert('Erro de conexão')
    } finally {
      setCanceling(false)
    }
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 hover:border-[#00A5E6]/40 hover:shadow-md transition-all">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
            isFechado
              ? 'bg-green-100 text-green-700'
              : isCancelado
              ? 'bg-red-100 text-red-700'
              : 'bg-amber-100 text-amber-700'
          }`}>
            {isFechado ? 'FECHADO' : isCancelado ? 'CANCELADO' : 'ABERTO'}
          </span>
          {qtdOS > 0 && (
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700" title={rec.numeros_os?.join(', ')}>
              OS: {rec.numeros_os?.slice(0, 2).join(', ')}{rec.numeros_os && rec.numeros_os.length > 2 ? '...' : ''}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!isFechado && !isCancelado && (
            <button
              onClick={(e) => { e.stopPropagation(); setShowCancelarModal(true); }}
              className="p-1.5 rounded-lg hover:bg-red-50 transition-colors"
              title="Cancelar recebimento"
            >
              <X className="w-4 h-4 text-red-500" />
            </button>
          )}
          <button onClick={() => router.push(`/recebimento/${rec.id}`)} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
            <ChevronRight className="w-4 h-4 text-slate-400" />
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 text-sm text-slate-600 mb-2">
        <Calendar className="w-4 h-4 text-slate-400" />
        <span>{formatDate(rec.periodo_inicio)} — {formatDate(rec.periodo_fim)}</span>
      </div>

      {rec.motorista && (
        <div className="flex items-center gap-2 text-sm text-slate-600 mb-2">
          <Truck className="w-4 h-4 text-slate-400" />
          <span>{rec.motorista}</span>
        </div>
      )}

      {/* NFs e Peso */}
      <div className="flex items-start gap-3 mb-3 text-xs">
        <div className="flex-1">
          <div className="flex items-center gap-1 text-slate-500 mb-1">
            <FileText className="w-3.5 h-3.5" />
            <span className="font-medium">NFs ({nfes.length})</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {nfes.slice(0, 5).map((nfeLink, i) => (
              <span key={i} className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded font-mono">
                {nfeLink.nfe?.numero_nf || '?'}
              </span>
            ))}
            {nfes.length > 5 && (
              <span className="text-[10px] text-slate-400 px-1">+{nfes.length - 5}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 text-slate-500">
            <Weight className="w-3.5 h-3.5" />
            <span className="font-mono text-xs">{pesoTotal.toFixed(0)}kg</span>
          </div>
          {nfes.length > 0 && (
            <div className="flex items-center gap-1">
              {hasDivergencias && (
                <div className="relative" title="Há divergências neste recebimento">
                  <AlertCircle className="w-4 h-4 text-amber-500" />
                </div>
              )}
              <button
                onClick={(e) => { e.stopPropagation(); setShowDetailsModal(true); }}
                className="p-1 rounded-lg hover:bg-slate-100 transition-colors"
                title="Ver detalhes das NFs"
              >
                <Eye className="w-4 h-4 text-slate-400 hover:text-[#00A5E6]" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Progress */}
      <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
        <span>{rec.total_itens} itens</span>
        <span>{rec.total_recebido}/{rec.total_previsto} volumes ({pct}%)</span>
      </div>
      <div className="w-full bg-slate-100 rounded-full h-2">
        <div
          className={`h-2 rounded-full transition-all ${
            pct >= 100 ? 'bg-green-500' : pct > 0 ? 'bg-amber-400' : 'bg-slate-200'
          }`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>

      {/* Modal Detalhes NFes */}
      {showDetailsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowDetailsModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-2xl p-6 shadow-xl max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <FileText className="w-5 h-5 text-[#00A5E6]" />
                Notas Fiscais do Recebimento
              </h3>
              <button onClick={() => setShowDetailsModal(false)} className="p-1 hover:bg-slate-100 rounded-lg transition-colors">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <div className="space-y-3">
              {nfes.map((nfeLink, i) => {
                const nfNumero = nfeLink.nfe?.numero_nf || '?'
                const qtdDivergencias = divergenciasPorNF.get(nfNumero) || 0
                return (
                <div key={i} className={`border rounded-lg p-4 ${
                  qtdDivergencias > 0 ? 'border-amber-300 bg-amber-50' : 'border-slate-200'
                }`}>
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-bold text-slate-800">NF {nfNumero}</span>
                      {nfeLink.nfe?.is_os && (
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                          OS
                        </span>
                      )}
                      {qtdDivergencias > 0 && (
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-500 text-white flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          {qtdDivergencias} diverg{qtdDivergencias > 1 ? 'ências' : 'ência'}
                        </span>
                      )}
                    </div>
                    <span className="text-sm text-slate-500">{formatDate(nfeLink.nfe?.data_emissao || '')}</span>
                  </div>
                  <div className="flex gap-4 text-sm text-slate-600">
                    <span className="flex items-center gap-1">
                      <Weight className="w-4 h-4 text-slate-400" />
                      {nfeLink.nfe?.peso_total ? `${nfeLink.nfe.peso_total.toFixed(0)} kg` : '-'}
                    </span>
                    <span className="flex items-center gap-1">
                      <Package className="w-4 h-4 text-slate-400" />
                      {nfeLink.nfe?.volumes_total || 0} volumes
                    </span>
                  </div>
                </div>
              )
              })}
            </div>
            <div className="mt-4">
              <Button onClick={() => setShowDetailsModal(false)} className="w-full">
                Fechar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Cancelar */}
      {showCancelarModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowCancelarModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <X className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="font-bold text-slate-800">Cancelar Recebimento</h3>
                <p className="text-xs text-slate-500">Esta ação não pode ser desfeita</p>
              </div>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setShowCancelarModal(false)} className="flex-1" disabled={canceling}>Voltar</Button>
              <Button onClick={handleCancelar} className="flex-1 bg-red-600 hover:bg-red-700" disabled={canceling}>
                {canceling ? 'Cancelando...' : 'Confirmar'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// =========================================================
// Create Modal
// =========================================================

function CreateRecebimentoModal({
  onClose,
  onSuccess,
  initialDates,
}: {
  onClose: () => void
  onSuccess: (id: string) => void
  initialDates?: { inicio: string; fim: string } | null
}) {
  const [periodoInicio, setPeriodoInicio] = useState(initialDates?.inicio || '')
  const [periodoFim, setPeriodoFim] = useState(initialDates?.fim || '')
  const [obs, setObs] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleCreate() {
    if (!periodoInicio || !periodoFim) {
      setError('Informe o período')
      return
    }
    setSaving(true)
    setError('')

    try {
      const res = await fetch('/api/recebimento', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          periodo_inicio: periodoInicio,
          periodo_fim: periodoFim,
          obs: obs || null,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Erro ao criar recebimento')
        setSaving(false)
        return
      }

      onSuccess(data.id)
    } catch {
      setError('Erro de conexão')
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-slate-800 mb-4">Novo Recebimento</h2>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-slate-600 block mb-1">Período Início</label>
              <input
                type="date"
                value={periodoInicio}
                onChange={e => setPeriodoInicio(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00A5E6]/30 focus:border-[#00A5E6]"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-600 block mb-1">Período Fim</label>
              <input
                type="date"
                value={periodoFim}
                onChange={e => setPeriodoFim(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00A5E6]/30 focus:border-[#00A5E6]"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-slate-600 block mb-1">Observações</label>
            <textarea
              value={obs}
              onChange={e => setObs(e.target.value)}
              rows={2}
              placeholder="Observações opcionais..."
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00A5E6]/30 focus:border-[#00A5E6] resize-none"
            />
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <div className="flex gap-3 pt-2">
            <Button variant="outline" onClick={onClose} className="flex-1" disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleCreate} className="flex-1" disabled={saving}>
              {saving ? 'Criando...' : 'Criar Recebimento'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

// =========================================================
// Import NFe Modal (XML ou Busca por Data)
// =========================================================

type ImportMode = 'xml' | 'data'

interface NfItem {
  n_item: string
  codigo_produto: string
  descricao: string
  quantidade: string
  ncm: string
  cfop: string
}

interface Nf {
  message_id: string
  numero_nf: string
  data_emissao: string
  peso_total: string
  volumes_total: string
  itens: NfItem[]
}

interface ImportResult {
  ok: boolean
  query?: string
  total_mensagens?: number
  total_salvas?: number
  nfs?: Nf[]
  erros?: Array<{ message_id: string; erro: string }>
  erro?: string
}

function ImportNFeModal({
  onClose,
  onSuccess,
  onStartRecebimento,
}: {
  onClose: () => void
  onSuccess: () => void
  onStartRecebimento: (dates: { inicio: string; fim: string }) => void
}) {
  const [mode, setMode] = useState<ImportMode>('data')
  const [files, setFiles] = useState<FileList | null>(null)
  const [uploading, setUploading] = useState(false)
  const [xmlResults, setXmlResults] = useState<Array<{ file: string; status: string; numero_nf?: string; error?: string }> | null>(null)
  
  const [inicio, setInicio] = useState('')
  const [fim, setFim] = useState('')
  const [importing, setImporting] = useState(false)
  const [dateResult, setDateResult] = useState<ImportResult | null>(null)
  const [errorMsg, setErrorMsg] = useState('')

  async function handleUploadXML() {
    if (!files || files.length === 0) return

    setUploading(true)
    const formData = new FormData()
    for (let i = 0; i < files.length; i++) {
      formData.append('xml', files[i])
    }

    try {
      const res = await fetch('/api/recebimento/importar-xml', {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()
      setXmlResults(data.results || [])
    } catch {
      setXmlResults([{ file: 'erro', status: 'erro', error: 'Falha na conexão' }])
    } finally {
      setUploading(false)
    }
  }

  function validateDates(): string | null {
    if (!inicio || !fim) return 'Preencha as datas de início e fim.'
    if (fim < inicio) return 'Data fim deve ser maior ou igual à data início.'
    const dInicio = new Date(inicio + 'T00:00:00')
    const dFim = new Date(fim + 'T00:00:00')
    const diffDays = (dFim.getTime() - dInicio.getTime()) / (1000 * 60 * 60 * 24)
    if (diffDays > 90) return 'Janela máxima de 90 dias.'
    return null
  }

  async function handleImportByDate() {
    setErrorMsg('')
    const validationError = validateDates()
    if (validationError) {
      setErrorMsg(validationError)
      return
    }

    setImporting(true)
    try {
      const res = await fetch('/api/nfe/importar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inicio, fim }),
      })

      const data: ImportResult = await res.json()

      if (res.status !== 200 || !data.ok) {
        setErrorMsg(data.erro || `Erro HTTP ${res.status}`)
        return
      }

      setDateResult(data)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setErrorMsg(`Erro de conexão: ${msg}`)
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-2xl p-6 shadow-xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
          <Download className="w-5 h-5 text-[#00A5E6]" />
          Importar NF-e
        </h2>

        {/* Mode Selector */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setMode('data')}
            className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              mode === 'data'
                ? 'bg-[#00A5E6] text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <Calendar className="w-4 h-4" />
              Buscar por Data
            </div>
          </button>
          <button
            onClick={() => setMode('xml')}
            className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              mode === 'xml'
                ? 'bg-[#00A5E6] text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <Upload className="w-4 h-4" />
              Upload XML
            </div>
          </button>
        </div>

        {/* Mode: Buscar por Data */}
        {mode === 'data' && !dateResult && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Data Início
                </label>
                <input
                  type="date"
                  value={inicio}
                  onChange={e => setInicio(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#00A5E6] focus:border-transparent outline-none"
                  disabled={importing}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Data Fim
                </label>
                <input
                  type="date"
                  value={fim}
                  onChange={e => setFim(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#00A5E6] focus:border-transparent outline-none"
                  disabled={importing}
                />
              </div>
            </div>

            {errorMsg && (
              <div className="flex items-start gap-2 text-red-600 text-sm bg-red-50 rounded-lg px-3 py-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div className="flex gap-3">
              <Button variant="outline" onClick={onClose} className="flex-1" disabled={importing}>
                Cancelar
              </Button>
              <Button onClick={handleImportByDate} className="flex-1" disabled={importing}>
                {importing ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Buscando...</>
                ) : (
                  <><Search className="w-4 h-4 mr-2" />Buscar NFs</>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Mode: Date - Results */}
        {mode === 'data' && dateResult && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-slate-50 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-slate-700 flex items-center justify-center gap-1">
                  <Mail className="w-5 h-5 text-slate-400" />
                  {dateResult.total_mensagens ?? 0}
                </p>
                <p className="text-xs text-slate-500">Mensagens</p>
              </div>
              <div className="bg-slate-50 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-slate-700 flex items-center justify-center gap-1">
                  <FileText className="w-5 h-5 text-slate-400" />
                  {dateResult.nfs?.length ?? 0}
                </p>
                <p className="text-xs text-slate-500">NFs</p>
              </div>
              <div className="bg-slate-50 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-green-600 flex items-center justify-center gap-1">
                  <Database className="w-5 h-5 text-green-400" />
                  {dateResult.total_salvas ?? 0}
                </p>
                <p className="text-xs text-slate-500">Salvas</p>
              </div>
            </div>

            {dateResult.nfs && dateResult.nfs.length > 0 && (
              <div className="max-h-60 overflow-y-auto space-y-2">
                {dateResult.nfs.map((nf, idx) => (
                  <div key={`${nf.numero_nf}-${idx}`} className="border border-slate-200 rounded-lg p-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-800">NF {nf.numero_nf}</span>
                      <span className="text-xs text-slate-500">{nf.data_emissao.substring(0, 10)}</span>
                    </div>
                    <div className="flex gap-3 text-xs text-slate-600 mt-1">
                      <span>{nf.volumes_total} volumes</span>
                      <span>{parseFloat(nf.peso_total).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} kg</span>
                      <span>{nf.itens?.length || 0} itens</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-3">
              {dateResult.total_salvas && dateResult.total_salvas > 0 && (
                <Button
                  onClick={() => onStartRecebimento({ inicio, fim })}
                  className="flex-1 bg-[#00A5E6] hover:bg-[#0090cc]"
                >
                  <Package className="w-4 h-4 mr-2" />
                  Iniciar Recebimento das Notas
                </Button>
              )}
              <Button
                onClick={onSuccess}
                variant="outline"
                className="flex-1 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 hover:border-red-300"
              >
                Fechar
              </Button>
            </div>
          </div>
        )}

        {/* Mode: Upload XML */}
        {mode === 'xml' && !xmlResults && (
          <div className="space-y-4">
            <div className="border-2 border-dashed border-slate-300 rounded-xl p-6 text-center">
              <Upload className="w-8 h-8 mx-auto text-slate-400 mb-2" />
              <p className="text-sm text-slate-500 mb-3">Selecione os arquivos XML das NF-e</p>
              <input
                type="file"
                accept=".xml"
                multiple
                onChange={e => setFiles(e.target.files)}
                className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-[#00A5E6]/10 file:text-[#00A5E6] hover:file:bg-[#00A5E6]/20"
              />
            </div>

            {files && files.length > 0 && (
              <p className="text-sm text-slate-600">{files.length} arquivo(s) selecionado(s)</p>
            )}

            <div className="flex gap-3">
              <Button variant="outline" onClick={onClose} className="flex-1" disabled={uploading}>
                Cancelar
              </Button>
              <Button
                onClick={handleUploadXML}
                className="flex-1"
                disabled={uploading || !files || files.length === 0}
              >
                {uploading ? 'Importando...' : 'Importar'}
              </Button>
            </div>
          </div>
        )}

        {/* Mode: XML - Results */}
        {mode === 'xml' && xmlResults && (
          <div className="space-y-4">
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {xmlResults.map((r, i) => (
                <div
                  key={i}
                  className={`flex items-center justify-between text-sm px-3 py-2 rounded-lg ${
                    r.status === 'ok' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                  }`}
                >
                  <span className="truncate flex-1">{r.file}</span>
                  <span className="font-medium ml-2">
                    {r.status === 'ok' ? `NF ${r.numero_nf}` : r.error}
                  </span>
                </div>
              ))}
            </div>
            <Button onClick={onSuccess} className="w-full">Fechar</Button>
          </div>
        )}
      </div>
    </div>
  )
}

// =========================================================
// Helpers
// =========================================================

// =========================================================
// Notas Vinculadas Tab
// =========================================================

function NotasVinculadasTab() {
  const [nfes, setNfes] = useState<Array<{
    id: string
    numero_nf: string
    data_emissao: string
    peso_total: number
    volumes_total: number
    is_os: boolean
    created_at: string
  }>>([])
  const [loading, setLoading] = useState(true)
  const [selectedNfe, setSelectedNfe] = useState<string | null>(null)
  const [nfeItens, setNfeItens] = useState<Array<{
    codigo_produto: string
    descricao: string
    quantidade: number
  }>>([])
  const [loadingItens, setLoadingItens] = useState(false)

  useEffect(() => {
    async function loadNfes() {
      setLoading(true)
      try {
        const supabase = createClient()
        const { data, error } = await supabase
          .from('nfe')
          .select('id, numero_nf, data_emissao, peso_total, volumes_total, is_os, created_at')
          .order('data_emissao', { ascending: false })
          .limit(100)
        
        if (!error && data) {
          setNfes(data)
        }
      } catch (err) {
        console.error('Erro ao carregar NFes:', err)
      } finally {
        setLoading(false)
      }
    }
    loadNfes()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-[#00A5E6]" />
      </div>
    )
  }

  async function loadNfeItens(nfeId: string) {
    setLoadingItens(true)
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('nfe_itens')
        .select('codigo_produto, descricao, quantidade')
        .eq('nfe_id', nfeId)
        .order('n_item', { ascending: true })
      
      if (!error && data) {
        setNfeItens(data)
      }
    } catch (err) {
      console.error('Erro ao carregar itens da NFe:', err)
    } finally {
      setLoadingItens(false)
    }
  }

  const selectedNfeData = nfes.find(n => n.id === selectedNfe)

  return (
    <div className="space-y-3">
      {nfes.length === 0 ? (
        <div className="text-center py-20 text-slate-500">
          <FileText className="w-16 h-16 mx-auto mb-4 text-slate-300" />
          <p className="text-lg font-medium">Nenhuma NF-e importada</p>
          <p className="text-sm mt-1">Importe NFs para começar</p>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4">
            <p className="text-sm text-slate-600">
              Total: <span className="font-bold text-slate-800">{nfes.length}</span> NF-e(s) importadas
            </p>
          </div>
          {nfes.map((nfe) => (
            <div
              key={nfe.id}
              className="bg-white rounded-xl border border-slate-200 p-4 hover:border-[#00A5E6]/40 hover:shadow-md transition-all cursor-pointer"
              onClick={() => {
                setSelectedNfe(nfe.id)
                loadNfeItens(nfe.id)
              }}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg font-bold text-slate-800">NF {nfe.numero_nf}</span>
                    {nfe.is_os && (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                        OS
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-4 text-sm text-slate-600">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-4 h-4 text-slate-400" />
                      {formatDate(nfe.data_emissao)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Package className="w-4 h-4 text-slate-400" />
                      {nfe.volumes_total} volumes
                    </span>
                    <span className="flex items-center gap-1">
                      <Weight className="w-4 h-4 text-slate-400" />
                      {nfe.peso_total.toFixed(0)} kg
                    </span>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-400" />
              </div>
            </div>
          ))}
        </>
      )}

      {/* Modal Itens da NFe */}
      {selectedNfe && selectedNfeData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setSelectedNfe(null)}>
          <div className="bg-white rounded-2xl w-full max-w-3xl p-6 shadow-xl max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-[#00A5E6]" />
                  Itens da NF {selectedNfeData.numero_nf}
                </h3>
                <p className="text-sm text-slate-500 mt-1">
                  {formatDate(selectedNfeData.data_emissao)} • {nfeItens.length} itens
                </p>
              </div>
              <button onClick={() => setSelectedNfe(null)} className="p-1 hover:bg-slate-100 rounded-lg transition-colors">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            {loadingItens ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-[#00A5E6]" />
              </div>
            ) : nfeItens.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                <Package className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                <p className="text-sm">Nenhum item encontrado</p>
              </div>
            ) : (
              <div className="space-y-2">
                {nfeItens.map((item, idx) => (
                  <div key={idx} className="border border-slate-200 rounded-lg p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-mono text-sm font-bold text-slate-800">{item.codigo_produto}</span>
                          <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded">#{idx + 1}</span>
                        </div>
                        <p className="text-sm text-slate-600">{item.descricao}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-slate-500">Quantidade</p>
                        <p className="text-lg font-bold text-slate-800">{item.quantidade}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-4">
              <Button onClick={() => setSelectedNfe(null)} className="w-full">
                Fechar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// =========================================================
// Dashboard Tab
// =========================================================

function DashboardTab({ recebimentos }: { recebimentos: Recebimento[] }) {
  const recebimentosFechados = recebimentos.filter(r => r.status === 'fechado')
  
  const totalRecebimentos = recebimentosFechados.length
  const kgTotais = recebimentosFechados.reduce((sum, r) => sum + (r.peso_total || 0), 0)
  const volumesTotais = recebimentosFechados.reduce((sum, r) => sum + r.total_recebido, 0)
  
  const temposMedios = recebimentosFechados
    .filter(r => r.data_inicio && r.data_fim)
    .map(r => {
      const inicio = new Date(r.data_inicio).getTime()
      const fim = new Date(r.data_fim!).getTime()
      return (fim - inicio) / (1000 * 60 * 60)
    })
  
  const tempoTotal = temposMedios.reduce((sum, t) => sum + t, 0)
  const tempoMedio = temposMedios.length > 0 ? tempoTotal / temposMedios.length : 0
  
  const kgMedio = totalRecebimentos > 0 ? kgTotais / totalRecebimentos : 0
  const volumesMedio = totalRecebimentos > 0 ? volumesTotais / totalRecebimentos : 0
  
  const chapasTotais = recebimentosFechados
    .filter(r => r.quantos_chapas)
    .reduce((sum, r) => sum + (r.quantos_chapas || 0), 0)
  const chapasMedia = recebimentosFechados.filter(r => r.quantos_chapas).length > 0
    ? chapasTotais / recebimentosFechados.filter(r => r.quantos_chapas).length
    : 0

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-[#00A5E6]" />
          Métricas Gerais
        </h3>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Package className="w-5 h-5 text-blue-600" />
              <p className="text-xs font-medium text-blue-700">Recebimentos</p>
            </div>
            <p className="text-3xl font-bold text-blue-900">{totalRecebimentos}</p>
            <p className="text-xs text-blue-600 mt-1">Fechados</p>
          </div>

          <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Weight className="w-5 h-5 text-green-600" />
              <p className="text-xs font-medium text-green-700">Peso Total</p>
            </div>
            <p className="text-3xl font-bold text-green-900">{kgTotais.toFixed(0)}</p>
            <p className="text-xs text-green-600 mt-1">kg</p>
          </div>

          <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-5 h-5 text-purple-600" />
              <p className="text-xs font-medium text-purple-700">Tempo Médio</p>
            </div>
            <p className="text-3xl font-bold text-purple-900">{tempoMedio.toFixed(1)}</p>
            <p className="text-xs text-purple-600 mt-1">horas</p>
          </div>

          <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-5 h-5 text-orange-600" />
              <p className="text-xs font-medium text-orange-700">Chapas Média</p>
            </div>
            <p className="text-3xl font-bold text-orange-900">{chapasMedia.toFixed(1)}</p>
            <p className="text-xs text-orange-600 mt-1">por recebimento</p>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-[#00A5E6]" />
            Médias por Recebimento
          </h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
              <span className="text-sm text-slate-600">Peso Médio</span>
              <span className="text-lg font-bold text-slate-800">{kgMedio.toFixed(0)} kg</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
              <span className="text-sm text-slate-600">Volumes Médios</span>
              <span className="text-lg font-bold text-slate-800">{volumesMedio.toFixed(0)}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
              <span className="text-sm text-slate-600">Tempo Total</span>
              <span className="text-lg font-bold text-slate-800">{tempoTotal.toFixed(1)} h</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-[#00A5E6]" />
            Status dos Recebimentos
          </h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
              <span className="text-sm text-green-700 font-medium">Fechados</span>
              <span className="text-lg font-bold text-green-800">
                {recebimentos.filter(r => r.status === 'fechado').length}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 bg-amber-50 rounded-lg">
              <span className="text-sm text-amber-700 font-medium">Abertos</span>
              <span className="text-lg font-bold text-amber-800">
                {recebimentos.filter(r => r.status === 'aberto').length}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
              <span className="text-sm text-red-700 font-medium">Cancelados</span>
              <span className="text-lg font-bold text-red-800">
                {recebimentos.filter(r => r.status === 'cancelado').length}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// =========================================================
// Divergências Listagem Tab
// =========================================================

function DivergenciasListagemTab() {
  const [problemasPendentes, setProblemasPendentes] = useState<Array<{
    id: string
    descricao: string
    recebimento_id: string
    created_at: string
  }>>([])
  const [loading, setLoading] = useState(true)
  const [resolvendo, setResolvendo] = useState<Set<string>>(new Set())

  useEffect(() => {
    loadProblemas()
  }, [])

  async function loadProblemas() {
    setLoading(true)
    try {
      const res = await fetch('/api/recebimento/problemas-pendentes')
      if (res.ok) {
        const data = await res.json()
        setProblemasPendentes(data)
      }
    } catch (err) {
      console.error('Erro ao carregar problemas:', err)
    } finally {
      setLoading(false)
    }
  }

  async function marcarComoResolvido(problemaId: string) {
    setResolvendo(prev => new Set(prev).add(problemaId))
    try {
      const res = await fetch('/api/recebimento/problemas-pendentes/resolver', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ problema_ids: [problemaId] }),
      })
      if (res.ok) {
        await loadProblemas()
      }
    } catch (err) {
      console.error('Erro ao resolver problema:', err)
    } finally {
      setResolvendo(prev => {
        const newSet = new Set(prev)
        newSet.delete(problemaId)
        return newSet
      })
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#00A5E6]" />
      </div>
    )
  }

  if (problemasPendentes.length === 0) {
    return (
      <div className="text-center py-16 bg-white rounded-xl border border-slate-200">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Package className="w-8 h-8 text-green-600" />
        </div>
        <h3 className="text-lg font-semibold text-slate-800 mb-2">Nenhum problema pendente</h3>
        <p className="text-sm text-slate-500">Todos os problemas foram resolvidos!</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
        <h3 className="font-semibold text-amber-900 mb-1 flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          Problemas pendentes de recebimentos anteriores
        </h3>
        <p className="text-sm text-amber-700 mb-4">
          {problemasPendentes.length} problema{problemasPendentes.length !== 1 ? 's' : ''} aguardando resolução
        </p>
        <div className="space-y-3">
          {problemasPendentes.map(problema => (
            <div key={problema.id} className="bg-white rounded-lg p-4 border border-amber-200">
              <p className="text-sm text-slate-700 mb-3">{problema.descricao}</p>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">
                  Criado em: {new Date(problema.created_at).toLocaleDateString('pt-BR')} às{' '}
                  {new Date(problema.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </span>
                <Button
                  size="sm"
                  onClick={() => marcarComoResolvido(problema.id)}
                  disabled={resolvendo.has(problema.id)}
                  className="bg-green-600 hover:bg-green-700 text-xs h-8"
                >
                  {resolvendo.has(problema.id) ? 'Marcando...' : 'Marcar como resolvido'}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// =========================================================
// Helpers
// =========================================================

function formatDate(dateStr: string): string {
  if (!dateStr) return ''
  const [y, m, d] = dateStr.split('-')
  return `${d}/${m}/${y}`
}
