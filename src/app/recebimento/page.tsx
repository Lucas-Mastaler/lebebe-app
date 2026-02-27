'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Package, Plus, Calendar, Truck, ChevronRight, Upload, FileText, Weight, X, Hash } from 'lucide-react'
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
    nfe: { numero_nf: string; data_emissao: string; peso_total: number; is_os: boolean } | null
  }>
}

export default function RecebimentoPage() {
  const router = useRouter()
  const [recebimentos, setRecebimentos] = useState<Recebimento[]>([])
  const [loading, setLoading] = useState(true)
  const [authorized, setAuthorized] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [showImport, setShowImport] = useState(false)

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
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Package className="w-7 h-7 text-[#00A5E6]" />
          <h1 className="text-2xl font-bold text-slate-800">Recebimento Matic</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowImport(true)} className="gap-2">
            <Upload className="w-4 h-4" />
            <span className="hidden sm:inline">Importar XML</span>
          </Button>
          <Button onClick={() => setShowCreate(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Novo Recebimento</span>
          </Button>
        </div>
      </div>

      {showImport && (
        <ImportXMLModal
          onClose={() => setShowImport(false)}
          onSuccess={() => { setShowImport(false); loadRecebimentos() }}
        />
      )}

      {showCreate && (
        <CreateRecebimentoModal
          onClose={() => setShowCreate(false)}
          onSuccess={(id) => { router.push(`/recebimento/${id}`) }}
        />
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#00A5E6]" />
        </div>
      ) : recebimentos.length === 0 ? (
        <div className="text-center py-20 text-slate-500">
          <Package className="w-16 h-16 mx-auto mb-4 text-slate-300" />
          <p className="text-lg font-medium">Nenhum recebimento encontrado</p>
          <p className="text-sm mt-1">Importe NFs via XML e crie um novo recebimento</p>
        </div>
      ) : (
        <div className="space-y-3">
          {recebimentos.map((rec) => (
            <RecebimentoCard key={rec.id} rec={rec} onReload={loadRecebimentos} />
          ))}
        </div>
      )}
    </div>
  )
}

// =========================================================
// Recebimento Card
// =========================================================

function RecebimentoCard({ rec, onReload }: { rec: Recebimento; onReload: () => void }) {
  const router = useRouter()
  const [showCancelarModal, setShowCancelarModal] = useState(false)
  const [canceling, setCanceling] = useState(false)
  const pct = rec.total_previsto > 0 ? Math.round((rec.total_recebido / rec.total_previsto) * 100) : 0
  const isFechado = rec.status === 'fechado'
  const isCancelado = rec.status === 'cancelado'
  const nfes = rec.recebimento_nfes || []
  const pesoTotal = rec.peso_total || 0
  const qtdOS = rec.qtd_os || 0

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
        <div className="flex items-center gap-1 text-slate-500">
          <Weight className="w-3.5 h-3.5" />
          <span className="font-mono text-xs">{pesoTotal.toFixed(0)}kg</span>
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
}: {
  onClose: () => void
  onSuccess: (id: string) => void
}) {
  const [periodoInicio, setPeriodoInicio] = useState('')
  const [periodoFim, setPeriodoFim] = useState('')
  const [motorista, setMotorista] = useState('')
  const [chapas, setChapas] = useState('')
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
          motorista: motorista || null,
          quantos_chapas: chapas ? parseInt(chapas) : null,
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
            <label className="text-sm font-medium text-slate-600 block mb-1">Motorista</label>
            <input
              type="text"
              value={motorista}
              onChange={e => setMotorista(e.target.value)}
              placeholder="Nome do motorista"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00A5E6]/30 focus:border-[#00A5E6]"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-slate-600 block mb-1">Qtd. Chapas</label>
            <input
              type="number"
              value={chapas}
              onChange={e => setChapas(e.target.value)}
              placeholder="0"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00A5E6]/30 focus:border-[#00A5E6]"
            />
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
// Import XML Modal
// =========================================================

function ImportXMLModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void
  onSuccess: () => void
}) {
  const [files, setFiles] = useState<FileList | null>(null)
  const [uploading, setUploading] = useState(false)
  const [results, setResults] = useState<Array<{ file: string; status: string; numero_nf?: string; error?: string }> | null>(null)

  async function handleUpload() {
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
      setResults(data.results || [])
    } catch {
      setResults([{ file: 'erro', status: 'erro', error: 'Falha na conexão' }])
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
          <FileText className="w-5 h-5 text-[#00A5E6]" />
          Importar XML de NF-e
        </h2>

        {!results ? (
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
                onClick={handleUpload}
                className="flex-1"
                disabled={uploading || !files || files.length === 0}
              >
                {uploading ? 'Importando...' : 'Importar'}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {results.map((r, i) => (
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

function formatDate(dateStr: string): string {
  if (!dateStr) return ''
  const [y, m, d] = dateStr.split('-')
  return `${d}/${m}/${y}`
}
