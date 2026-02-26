'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarDays, Download, AlertCircle, Package, Loader2, FileText, Search, Truck, Weight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { isMaticEmail } from '@/lib/auth/matic-emails'

const APPSCRIPT_URL = process.env.NEXT_PUBLIC_APPSCRIPT_IMPORT_URL || ''

interface NfItem {
  n_item: number
  codigo_produto: string
  descricao: string
  quantidade: number
}

interface Nf {
  numero_nf: string
  data_emissao: string
  peso_total: number
  volumes_total: number
  is_os: boolean
  os_oc: string[]
  itens: NfItem[]
}

interface ImportResult {
  ok: boolean
  inicio?: string
  fim?: string
  query?: string
  nfs?: Nf[]
  erros?: Array<{ etapa: string; message: string; emailMessageId?: string }>
  stats?: { threads: number; mensagens: number; anexos_xml: number; nfs: number }
  error?: string
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
  const popupRef = useRef<Window | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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

  // Cleanup helper
  function cleanup() {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    if (popupRef.current && !popupRef.current.closed) {
      popupRef.current.close()
    }
    popupRef.current = null
  }

  // postMessage listener — registered once, cleaned up on unmount
  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      console.log('[NFE][POSTMESSAGE] recebido', event.data)

      // Validate payload shape first
      const msg = event.data
      if (!msg || msg.source !== 'appscript-nfe') return

      const payload = msg.data as ImportResult
      console.log('[NFE][POSTMESSAGE] payload ok?', payload?.ok)

      if (!payload.ok) {
        setErrorMsg(payload.error || 'Erro retornado pelo Apps Script.')
      } else {
        setResult(payload)
      }

      setImporting(false)
      cleanup()
    }

    window.addEventListener('message', handleMessage)
    return () => {
      window.removeEventListener('message', handleMessage)
      cleanup()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleImport() {
    setErrorMsg('')
    setResult(null)

    if (!APPSCRIPT_URL) {
      setErrorMsg('NEXT_PUBLIC_APPSCRIPT_IMPORT_URL não configurada.')
      return
    }

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

    // Clean previous attempt
    cleanup()
    setImporting(true)

    console.log('[NFE][POPUP] abrindo popup')

    // 1) Open popup (top-level window → Google auth cookies ARE sent)
    const popupName = 'nfe_popup'
    const popup = window.open('about:blank', popupName, 'width=520,height=680')
    if (!popup) {
      setErrorMsg('Popup bloqueado pelo navegador. Permita popups para este site.')
      setImporting(false)
      return
    }
    popupRef.current = popup

    // 2) Create form targeting the popup — 3 flat fields, no payload JSON
    const form = document.createElement('form')
    form.method = 'POST'
    form.action = APPSCRIPT_URL
    form.target = popupName

    const addField = (name: string, value: string) => {
      const input = document.createElement('input')
      input.type = 'hidden'
      input.name = name
      input.value = value
      form.appendChild(input)
    }

    addField('callback_origin', window.location.origin)
    addField('inicio', inicio)
    addField('fim', fim)

    console.log('[NFE][POPUP] enviando form', { inicio, fim, callback_origin: window.location.origin })

    // 3) Submit form into the popup
    document.body.appendChild(form)
    form.submit()
    form.remove()

    // 4) Timeout: 60s
    timeoutRef.current = setTimeout(() => {
      setErrorMsg(
        'Timeout (60s): sem resposta do Apps Script. ' +
        'Verifique se você está logado no Google Workspace (lebebe.com.br) neste navegador.'
      )
      setImporting(false)
      cleanup()
    }, 60_000)
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
          Busca NFs no Gmail por período via Apps Script
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
                <p className="text-2xl font-bold text-slate-700">{result.stats?.threads ?? '-'}</p>
                <p className="text-xs text-slate-500">Threads</p>
              </div>
              <div className="bg-slate-50 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-slate-700">{result.stats?.mensagens ?? '-'}</p>
                <p className="text-xs text-slate-500">Mensagens</p>
              </div>
              <div className="bg-slate-50 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-slate-700">{result.stats?.anexos_xml ?? '-'}</p>
                <p className="text-xs text-slate-500">XMLs</p>
              </div>
              <div className="bg-slate-50 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-slate-700">{result.stats?.nfs ?? result.nfs?.length ?? 0}</p>
                <p className="text-xs text-slate-500">NFs</p>
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
                {result.nfs.map(nf => (
                  <div
                    key={nf.numero_nf}
                    className="border border-slate-200 rounded-xl p-4 hover:bg-slate-50 transition-colors"
                  >
                    {/* NF header */}
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <span className="text-lg font-bold text-slate-800">NF {nf.numero_nf}</span>
                        {nf.is_os && (
                          <span className="ml-2 bg-amber-100 text-amber-800 text-xs font-medium px-2 py-0.5 rounded-lg">
                            OS
                          </span>
                        )}
                      </div>
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

                    {/* OS/OC */}
                    {nf.os_oc && nf.os_oc.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-2">
                        {nf.os_oc.map(os => (
                          <span key={os} className="bg-amber-50 text-amber-700 text-xs font-medium px-2 py-0.5 rounded">
                            OS/OC {os}
                          </span>
                        ))}
                      </div>
                    )}

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
                              <span className="font-medium text-slate-700">×{item.quantidade}</span>
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
                    <span className="font-medium">[{err.etapa}]</span> {err.message}
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
