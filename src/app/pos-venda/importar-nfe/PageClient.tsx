'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Download, AlertCircle, Package, FileText, Search, Truck, Weight, Mail, Hash, Database } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { isMaticEmail } from '@/lib/auth/matic-emails'
import {
  PageContainer,
  PageHeader,
  FormPageContent,
  Card,
  CardHeader,
  CardContent,
  FormField,
  DateField,
  Button,
  KpiCard,
  Alert,
  EmptyState,
  LoadingLeBebe,
} from '@/components/design-system'
import { validateDateRange, parseBrDate, dateToIso } from '@/lib/design-system/dates'

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
    const rangeCheck = validateDateRange(inicio, fim)
    if (!rangeCheck.ok) return rangeCheck.message ?? 'Datas inválidas.'
    const dInicio = parseBrDate(inicio)
    const dFim = parseBrDate(fim)
    if (!dInicio || !dFim) return 'Datas inválidas.'
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

    const dInicio = parseBrDate(inicio)!
    const dFim = parseBrDate(fim)!

    setImporting(true)
    console.log('[NFE][UI] request', { inicio, fim })

    try {
      const res = await fetch('/api/nfe/importar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inicio: dateToIso(dInicio), fim: dateToIso(dFim) }),
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
      <PageContainer>
        <div className="flex min-h-[60vh] items-center justify-center">
          <LoadingLeBebe size={64} label="Verificando acesso" />
        </div>
      </PageContainer>
    )
  }

  if (!authorized) return null

  return (
    <PageContainer>
      <FormPageContent className="max-w-3xl space-y-6">
        <PageHeader
          icon={<Download className="size-6" />}
          title="Importar NFe Matic"
          description="Busca NFs no Gmail por período (backend)"
        />

        {/* Date form */}
        <Card>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField id="nfe-inicio" label="Data Início">
                {(f) => <DateField {...f} value={inicio} onChange={setInicio} disabled={importing} />}
              </FormField>
              <FormField id="nfe-fim" label="Data Fim">
                {(f) => <DateField {...f} value={fim} onChange={setFim} disabled={importing} />}
              </FormField>
            </div>

            {errorMsg && <Alert tone="danger">{errorMsg}</Alert>}

            <Button onClick={handleImport} loading={importing} className="w-full sm:w-auto">
              <Search className="size-4" />
              {importing ? 'Buscando NFs...' : 'Buscar NFs'}
            </Button>
          </CardContent>
        </Card>

        {/* Results */}
        {result && (
          <div className="space-y-4">
            {/* Stats summary */}
            <Card>
              <CardHeader title="Resumo" />
              <CardContent>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <KpiCard label="Mensagens" value={result.total_mensagens ?? 0} icon={<Mail className="size-4" />} />
                  <KpiCard label="NFs" value={result.nfs?.length ?? 0} icon={<Hash className="size-4" />} />
                  <KpiCard
                    label="Salvas no BD"
                    value={result.total_salvas ?? 0}
                    icon={<Database className="size-4" />}
                    tone="success"
                  />
                  <KpiCard
                    label="Erros"
                    value={result.erros?.length ?? 0}
                    icon={<AlertCircle className="size-4" />}
                    tone={result.erros && result.erros.length > 0 ? 'danger' : 'neutral'}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Query usada */}
            {result.query && (
              <Card>
                <CardContent>
                  <p className="mb-1 flex items-center gap-1 text-sm font-semibold text-slate-600">
                    <FileText className="size-4" />
                    Query Gmail
                  </p>
                  <p className="font-mono text-xs break-all text-slate-500">{result.query}</p>
                </CardContent>
              </Card>
            )}

            {/* NF list */}
            <Card>
              <CardHeader title={`NFs encontradas: ${result.nfs?.length || 0}`} />
              <CardContent>
                {result.nfs && result.nfs.length > 0 ? (
                  <div className="space-y-3">
                    {result.nfs.map((nf, idx) => (
                      <div
                        key={`${nf.numero_nf}-${idx}`}
                        className="rounded-xl border border-slate-200 p-4 transition-colors hover:bg-slate-50"
                      >
                        {/* NF header */}
                        <div className="mb-2 flex items-start justify-between">
                          <span className="text-lg font-bold text-slate-800">NF {nf.numero_nf}</span>
                          <span className="text-sm text-slate-500">{nf.data_emissao}</span>
                        </div>

                        {/* NF details */}
                        <div className="mb-2 flex flex-wrap gap-4 text-sm text-slate-600">
                          <span className="flex items-center gap-1">
                            <Package className="size-4 text-slate-400" />
                            {nf.volumes_total} volumes
                          </span>
                          <span className="flex items-center gap-1">
                            <Weight className="size-4 text-slate-400" />
                            {nf.peso_total} kg
                          </span>
                          <span className="flex items-center gap-1">
                            <Truck className="size-4 text-slate-400" />
                            {nf.itens?.length || 0} itens
                          </span>
                        </div>

                        {/* Items (collapsed) */}
                        {nf.itens && nf.itens.length > 0 && (
                          <details className="mt-2">
                            <summary className="cursor-pointer text-xs text-primary hover:underline">
                              Ver {nf.itens.length} itens
                            </summary>
                            <div className="mt-2 space-y-1">
                              {nf.itens.map(item => (
                                <div
                                  key={item.n_item}
                                  className="flex items-center gap-2 rounded bg-slate-50 px-2 py-1 text-xs text-slate-600"
                                >
                                  <span className="w-6 text-right font-mono text-slate-400">{item.n_item}.</span>
                                  <span className="min-w-[50px] font-semibold">{item.codigo_produto}</span>
                                  <span className="flex-1 truncate">{item.descricao}</span>
                                  <span className="text-[10px] text-slate-400">{item.ncm}</span>
                                  <span className="text-[10px] text-slate-400">{item.cfop}</span>
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
                  <EmptyState icon={<Package className="size-5" />} title="Nenhuma NF encontrada no período." />
                )}
              </CardContent>
            </Card>

            {/* Erros */}
            {result.erros && result.erros.length > 0 && (
              <Alert tone="danger" title={`Erros (${result.erros.length})`}>
                <div className="max-h-48 space-y-1 overflow-y-auto">
                  {result.erros.map((err, i) => (
                    <div key={i} className="rounded bg-white px-2 py-1 text-xs text-red-600">
                      <span className="font-medium">[{err.message_id}]</span> {err.erro}
                    </div>
                  ))}
                </div>
              </Alert>
            )}
          </div>
        )}
      </FormPageContent>
    </PageContainer>
  )
}
