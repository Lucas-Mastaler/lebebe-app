'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarDays, Download, AlertCircle, Package, Loader2, FileText, Search, Truck, Weight, Mail, Hash, Database } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { isMaticEmail } from '@/lib/auth/matic-emails'

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

export default function ImportarNfePage() {
  const router = useRouter()
  const [authorized, setAuthorized] = useState(false)
  const [loading, setLoading] = useState(true)
  const [importing, setImporting] = useState(false)
  const [inicio, setInicio] = useState('')
  const [fim, setFim] = useState('')
  const [result, setResult] = useState<ImportResult | null>(null)
  const [errorMsg, setErrorMsg] = useState('')

  // Auth check
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

  function validate(): string | null {
    if (!inicio || !fim) return 'Preencha as datas de início e fim.'
    if (fim < inicio) return 'Data fim deve ser maior ou igual à data início.'
    const dInicio = new Date(inicio + 'T00:00:00')
    const dFim = new Date(fim + 'T00:00:00')
    const diffDays = (dFim.getTime() - dInicio.getTime()) / (1000 * 60 * 60 * 24)
    if (diffDays > 90) return 'Janela máxima de 90 dias.'
    return null
  }

  async function handleImport() {
    setErrorMsg('')

    const validationError = validate()
    if (validationError) {
      setErrorMsg(validationError)
      return
    }

    setImporting(true)
    console.log('[NFE][UI] request', { inicio, fim })

    try {
      const res = await fetch('/api/nfe/importar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inicio, fim }),
      })

      console.log('[NFE][UI] response status', res.status)

      const data: ImportResult = await res.json()

      console.log('[NFE][UI] payload ok', data.ok, 'nfs', data.nfs?.length, 'erros', data.erros?.length)

      if (res.status !== 200 || !data.ok) {
        setErrorMsg(data.erro || `Erro HTTP ${res.status}`)
        return
      }

      setResult(data)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[NFE][UI] fetch error', msg)
      setErrorMsg(`Erro de conexão: ${msg}`)
    } finally {
      setImporting(false)
    }
  }

  // ─── Render ───────────────────────────────────────────

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
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <Download className="w-6 h-6 text-[#00A5E6]" />
          Importar NFe Matic
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Busca NFs no Gmail por período (backend)
        </p>
      </div>

      {/* Date form */}
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
          <div className="flex items-start gap-2 text-red-600 text-sm bg-red-50 rounded-lg px-3 py-2 mb-4">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
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
              Buscando NFs...
            </>
          ) : (
            <>
              <Search className="w-4 h-4 mr-2" />
              Buscar NFs
            </>
          )}
        </Button>
      </div>

      {/* Results */}
      {result && (
        <div className="space-y-4">
          {/* Stats summary */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <h3 className="text-sm font-semibold text-slate-600 mb-3">Resumo</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-slate-50 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-slate-700 flex items-center justify-center gap-1">
                  <Mail className="w-5 h-5 text-slate-400" />
                  {result.total_mensagens ?? 0}
                </p>
                <p className="text-xs text-slate-500">Mensagens</p>
              </div>
              <div className="bg-slate-50 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-slate-700 flex items-center justify-center gap-1">
                  <Hash className="w-5 h-5 text-slate-400" />
                  {result.nfs?.length ?? 0}
                </p>
                <p className="text-xs text-slate-500">NFs</p>
              </div>
              <div className="bg-slate-50 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-green-600 flex items-center justify-center gap-1">
                  <Database className="w-5 h-5 text-green-400" />
                  {result.total_salvas ?? 0}
                </p>
                <p className="text-xs text-slate-500">Salvas no BD</p>
              </div>
              <div className="bg-slate-50 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-slate-700 flex items-center justify-center gap-1">
                  <AlertCircle className="w-5 h-5 text-slate-400" />
                  {result.erros?.length ?? 0}
                </p>
                <p className="text-xs text-slate-500">Erros</p>
              </div>
            </div>
          </div>

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

          {/* NF list */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <h3 className="text-lg font-semibold text-slate-800 mb-4">
              NFs encontradas: {result.nfs?.length || 0}
            </h3>

            {result.nfs && result.nfs.length > 0 ? (
              <div className="space-y-3">
                {result.nfs.map((nf, idx) => (
                  <div
                    key={`${nf.numero_nf}-${idx}`}
                    className="border border-slate-200 rounded-xl p-4 hover:bg-slate-50 transition-colors"
                  >
                    {/* NF header */}
                    <div className="flex items-start justify-between mb-2">
                      <span className="text-lg font-bold text-slate-800">NF {nf.numero_nf}</span>
                      <span className="text-sm text-slate-500">{nf.data_emissao}</span>
                    </div>

                    {/* NF details */}
                    <div className="flex flex-wrap gap-4 text-sm text-slate-600 mb-2">
                      <span className="flex items-center gap-1">
                        <Package className="w-4 h-4 text-slate-400" />
                        {nf.volumes_total} volumes
                      </span>
                      <span className="flex items-center gap-1">
                        <Weight className="w-4 h-4 text-slate-400" />
                        {nf.peso_total} kg
                      </span>
                      <span className="flex items-center gap-1">
                        <Truck className="w-4 h-4 text-slate-400" />
                        {nf.itens?.length || 0} itens
                      </span>
                    </div>

                    {/* Items (collapsed) */}
                    {nf.itens && nf.itens.length > 0 && (
                      <details className="mt-2">
                        <summary className="text-xs text-[#00A5E6] cursor-pointer hover:underline">
                          Ver {nf.itens.length} itens
                        </summary>
                        <div className="mt-2 space-y-1">
                          {nf.itens.map(item => (
                            <div key={item.n_item} className="flex items-center gap-2 text-xs text-slate-600 bg-slate-50 rounded px-2 py-1">
                              <span className="font-mono text-slate-400 w-6 text-right">{item.n_item}.</span>
                              <span className="font-semibold min-w-[50px]">{item.codigo_produto}</span>
                              <span className="flex-1 truncate">{item.descricao}</span>
                              <span className="text-slate-400 text-[10px]">{item.ncm}</span>
                              <span className="text-slate-400 text-[10px]">{item.cfop}</span>
                              <span className="font-medium text-slate-700">&times;{item.quantidade}</span>
                            </div>
                          ))}
                        </div>
                      </details>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-slate-500">
                <Package className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                <p className="text-sm">Nenhuma NF encontrada no período.</p>
              </div>
            )}
          </div>

          {/* Erros */}
          {result.erros && result.erros.length > 0 && (
            <div className="bg-red-50 rounded-2xl border border-red-200 p-6">
              <h3 className="text-sm font-semibold text-red-700 mb-2 flex items-center gap-1">
                <AlertCircle className="w-4 h-4" />
                Erros ({result.erros.length})
              </h3>
              <div className="max-h-48 overflow-y-auto space-y-1">
                {result.erros.map((err, i) => (
                  <div key={i} className="text-xs text-red-600 bg-white rounded px-2 py-1">
                    <span className="font-medium">[{err.message_id}]</span> {err.erro}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
