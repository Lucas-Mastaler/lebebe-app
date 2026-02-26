'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarDays, Download, AlertCircle, CheckCircle2, Package, Loader2, FileText, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { isMaticEmail } from '@/lib/auth/matic-emails'

interface ImportResult {
  ok: boolean
  query?: string
  nfs_total?: number
  nfs_importadas?: string[]
  nfs_atualizadas?: string[]
  itens_total?: number
  skus_sem_cadastro?: string[]
  erros?: Array<{ etapa: string; message: string }>
  error?: string
}

export default function ImportarNfeMaticPage() {
  const router = useRouter()
  const [authorized, setAuthorized] = useState(false)
  const [loading, setLoading] = useState(true)
  const [importing, setImporting] = useState(false)
  const [inicio, setInicio] = useState('')
  const [fim, setFim] = useState('')
  const [result, setResult] = useState<ImportResult | null>(null)
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    async function checkAuth() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user?.email || !isMaticEmail(user.email)) {
        router.push('/dashboard')
        return
      }
      setAuthorized(true)
      setLoading(false)
    }
    checkAuth()
  }, [router])

  async function handleImport() {
    setErrorMsg('')
    setResult(null)

    if (!inicio || !fim) {
      setErrorMsg('Preencha as datas de início e fim.')
      return
    }

    if (inicio > fim) {
      setErrorMsg('Data início deve ser menor ou igual à data fim.')
      return
    }

    const dInicio = new Date(inicio + 'T00:00:00')
    const dFim = new Date(fim + 'T23:59:59')
    const diffDays = (dFim.getTime() - dInicio.getTime()) / (1000 * 60 * 60 * 24)
    if (diffDays > 90) {
      setErrorMsg('Janela máxima de 90 dias.')
      return
    }

    setImporting(true)

    try {
      const res = await fetch('/api/matic/importar-via-appscript', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inicio, fim }),
      })

      const data: ImportResult = await res.json()
      setResult(data)

      if (!data.ok) {
        setErrorMsg(data.error || 'Erro desconhecido na importação.')
      }
    } catch (err) {
      setErrorMsg('Erro de conexão: ' + String(err))
    } finally {
      setImporting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    )
  }

  if (!authorized) return null

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <Download className="w-6 h-6 text-[#00A5E6]" />
          Importar NFe Matic
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Busca NFs no Gmail por período e importa para o sistema
        </p>
      </div>

      {/* Form */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              <CalendarDays className="w-4 h-4 inline mr-1" />
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
              <CalendarDays className="w-4 h-4 inline mr-1" />
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
          <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 rounded-lg px-3 py-2 mb-4">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {errorMsg}
          </div>
        )}

        <Button
          onClick={handleImport}
          disabled={importing}
          className="w-full sm:w-auto bg-[#00A5E6] hover:bg-[#0090cc] text-white"
        >
          {importing ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Importando...
            </>
          ) : (
            <>
              <Search className="w-4 h-4 mr-2" />
              Importar NFs
            </>
          )}
        </Button>
      </div>

      {/* Results */}
      {result && result.ok && (
        <div className="space-y-4">
          {/* Query usada */}
          {result.query && (
            <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4">
              <h3 className="text-sm font-semibold text-slate-600 mb-1 flex items-center gap-1">
                <FileText className="w-4 h-4" />
                Query Gmail
              </h3>
              <p className="text-xs text-slate-500 font-mono break-all">{result.query}</p>
            </div>
          )}

          {/* Resumo */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <h3 className="text-lg font-semibold text-slate-800 mb-4">Resumo da Importação</h3>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
              <div className="bg-blue-50 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-blue-700">{result.nfs_total || 0}</p>
                <p className="text-xs text-blue-600">NFs Total</p>
              </div>
              <div className="bg-green-50 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-green-700">{result.nfs_importadas?.length || 0}</p>
                <p className="text-xs text-green-600">Novas</p>
              </div>
              <div className="bg-amber-50 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-amber-700">{result.nfs_atualizadas?.length || 0}</p>
                <p className="text-xs text-amber-600">Atualizadas</p>
              </div>
              <div className="bg-purple-50 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-purple-700">{result.itens_total || 0}</p>
                <p className="text-xs text-purple-600">Itens</p>
              </div>
            </div>

            {/* NFs importadas */}
            {result.nfs_importadas && result.nfs_importadas.length > 0 && (
              <div className="mb-4">
                <h4 className="text-sm font-semibold text-green-700 mb-2 flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4" />
                  NFs Importadas (novas)
                </h4>
                <div className="flex flex-wrap gap-2">
                  {result.nfs_importadas.map(nf => (
                    <span key={nf} className="bg-green-100 text-green-800 text-xs font-medium px-2.5 py-1 rounded-lg">
                      {nf}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* NFs atualizadas */}
            {result.nfs_atualizadas && result.nfs_atualizadas.length > 0 && (
              <div className="mb-4">
                <h4 className="text-sm font-semibold text-amber-700 mb-2 flex items-center gap-1">
                  <Package className="w-4 h-4" />
                  NFs Atualizadas
                </h4>
                <div className="flex flex-wrap gap-2">
                  {result.nfs_atualizadas.map(nf => (
                    <span key={nf} className="bg-amber-100 text-amber-800 text-xs font-medium px-2.5 py-1 rounded-lg">
                      {nf}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* SKUs sem cadastro */}
            {result.skus_sem_cadastro && result.skus_sem_cadastro.length > 0 && (
              <div className="mb-4">
                <h4 className="text-sm font-semibold text-red-700 mb-2 flex items-center gap-1">
                  <AlertCircle className="w-4 h-4" />
                  SKUs sem cadastro no matic_sku
                </h4>
                <p className="text-xs text-slate-500 mb-2">
                  Estes produtos não têm volumes_por_item definido. Cadastre-os para conferência correta.
                </p>
                <div className="flex flex-wrap gap-2">
                  {result.skus_sem_cadastro.map(sku => (
                    <span key={sku} className="bg-red-100 text-red-800 text-xs font-medium px-2.5 py-1 rounded-lg">
                      {sku}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Erros */}
            {result.erros && result.erros.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-red-700 mb-2 flex items-center gap-1">
                  <AlertCircle className="w-4 h-4" />
                  Erros ({result.erros.length})
                </h4>
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {result.erros.map((err, i) => (
                    <div key={i} className="text-xs text-red-600 bg-red-50 rounded px-2 py-1">
                      <span className="font-medium">[{err.etapa}]</span> {err.message}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Nenhuma NF encontrada */}
            {result.nfs_total === 0 && (
              <div className="text-center py-6 text-slate-500">
                <Package className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                <p className="text-sm">Nenhuma NF encontrada no período selecionado.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
