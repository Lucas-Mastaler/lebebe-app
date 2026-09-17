'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Package, Plus, Calendar, Truck, ChevronRight, Upload, FileText, Weight, X, Download,
  Search, Mail, Database, TrendingUp, BarChart3, Clock, Users, Eye, CheckCircle2, Edit,
  AlertCircle,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { isMaticEmail } from '@/lib/auth/matic-emails'
import { toast } from 'sonner'
import { dateToIso, parseBrDate } from '@/lib/design-system/dates'
import {
  PageContainer, PageHeader, Button, IconButton, Card, CardHeader, CardContent,
  Badge, Alert, EmptyState, Spinner, SkeletonRows, Progress,
  FilterPanel, FilterFieldGroup, useFilterState, FormField, Input, DateField, Textarea,
  Dialog, DialogContent, DialogHeader, DialogBody, ConfirmDialog,
  Tabs, TabsContent, SegmentedTabsList, SegmentedTabsTrigger,
  KpiCard,
} from '@/components/design-system'

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
  numero_recebimento?: number
  recebimento_nfes: Array<{
    nfe_id: string
    nfe: { numero_nf: string; data_emissao: string; peso_total: number; volumes_total: number; is_os: boolean } | null
  }>
}

type TabType = 'recebimentos' | 'notas' | 'divergencias' | 'dashboard'

type FiltrosRecebimento = {
  dataInicio: string
  dataFim: string
  numeroNf: string
}

const FILTROS_VAZIOS: FiltrosRecebimento = { dataInicio: '', dataFim: '', numeroNf: '' }

export default function RecebimentoPage() {
  const router = useRouter()
  const [recebimentos, setRecebimentos] = useState<Recebimento[]>([])
  const [loading, setLoading] = useState(false)
  const [authorized, setAuthorized] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [activeTab, setActiveTab] = useState<TabType>('recebimentos')
  const [prefilledDates, setPrefilledDates] = useState<{ inicio: string; fim: string } | null>(null)
  const filtros = useFilterState<FiltrosRecebimento>(FILTROS_VAZIOS)

  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalItems, setTotalItems] = useState(0)
  const itemsPerPage = 20

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

  const loadRecebimentos = useCallback(async (page: number, valores: FiltrosRecebimento) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: itemsPerPage.toString(),
      })

      const dataInicioDate = parseBrDate(valores.dataInicio)
      const dataFimDate = parseBrDate(valores.dataFim)
      if (dataInicioDate) params.append('data_inicio', dateToIso(dataInicioDate))
      if (dataFimDate) params.append('data_fim', dateToIso(dataFimDate))
      if (valores.numeroNf) params.append('numero_nf', valores.numeroNf)

      const res = await fetch(`/api/recebimento?${params.toString()}`)
      if (res.ok) {
        const response = await res.json()
        setRecebimentos(response.data || [])
        setTotalPages(response.pagination?.totalPages || 1)
        setTotalItems(response.pagination?.total || 0)
        setCurrentPage(page)
      } else {
        toast.error('Erro ao carregar recebimentos')
      }
    } catch (err) {
      console.error('Erro ao carregar recebimentos:', err)
      toast.error('Erro de conexão ao carregar recebimentos')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (authorized) loadRecebimentos(1, FILTROS_VAZIOS)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authorized])

  function aplicarFiltros() {
    filtros.apply()
    void loadRecebimentos(1, filtros.draft)
  }

  function limparFiltros() {
    filtros.clear()
    void loadRecebimentos(1, FILTROS_VAZIOS)
  }

  if (!authorized) return null

  return (
    <PageContainer>
      <PageHeader
        icon={<Package className="size-6" />}
        title="Recebimento Matic"
        action={
          <>
            <Button variant="secondary" onClick={() => router.push('/recebimento/produtos')}>
              <Edit className="size-4" />
              <span className="hidden sm:inline">Produtos</span>
            </Button>
            <Button variant="secondary" onClick={() => setShowImport(true)}>
              <Download className="size-4" />
              <span className="hidden sm:inline">Importar NFe</span>
            </Button>
            <Button onClick={() => setShowCreateModal(true)}>
              <Plus className="size-4" />
              <span className="hidden sm:inline">Novo Recebimento</span>
            </Button>
          </>
        }
      />

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabType)} className="mt-6">
        <SegmentedTabsList>
          <SegmentedTabsTrigger value="recebimentos" title="Lista de todos os recebimentos (abertos, fechados e cancelados)">
            <Package className="size-4" />
            <span className="hidden xs:inline">Recebimentos</span>
          </SegmentedTabsTrigger>
          <SegmentedTabsTrigger value="notas" title="Notas fiscais importadas no sistema">
            <FileText className="size-4" />
            <span className="hidden xs:inline">Notas Vinculadas</span>
          </SegmentedTabsTrigger>
          <SegmentedTabsTrigger value="divergencias" title="Problemas anotados em recebimentos anteriores para resolver nos próximos carregamentos">
            <AlertCircle className="size-4" />
            <span className="hidden xs:inline">Problemas Pendentes</span>
          </SegmentedTabsTrigger>
          <SegmentedTabsTrigger value="dashboard" title="Métricas e estatísticas dos recebimentos">
            <BarChart3 className="size-4" />
            <span className="hidden xs:inline">Dashboard</span>
          </SegmentedTabsTrigger>
        </SegmentedTabsList>

        <TabsContent value="recebimentos" className="mt-6 space-y-4">
          <FilterPanel dirty={filtros.dirty} onApply={aplicarFiltros} onClear={limparFiltros}>
            <FilterFieldGroup label="Filtros">
              <FormField id="filtro-data-inicio" label="Data Início">
                {(f) => (
                  <DateField
                    id={f.id}
                    value={filtros.draft.dataInicio}
                    onChange={(v) => filtros.setField('dataInicio', v)}
                    aria-invalid={f['aria-invalid']}
                  />
                )}
              </FormField>
              <FormField id="filtro-data-fim" label="Data Fim">
                {(f) => (
                  <DateField
                    id={f.id}
                    value={filtros.draft.dataFim}
                    onChange={(v) => filtros.setField('dataFim', v)}
                    aria-invalid={f['aria-invalid']}
                  />
                )}
              </FormField>
              <FormField id="filtro-numero-nf" label="Número NF (busca dinâmica)">
                {(f) => (
                  <div className="relative">
                    <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      id={f.id}
                      aria-invalid={f['aria-invalid']}
                      value={filtros.draft.numeroNf}
                      onChange={(e) => filtros.setField('numeroNf', e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') aplicarFiltros() }}
                      placeholder="Ex: 12345"
                      className="pl-9"
                    />
                  </div>
                )}
              </FormField>
            </FilterFieldGroup>
          </FilterPanel>

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <Card key={i} className="p-4">
                  <SkeletonRows rows={3} />
                </Card>
              ))}
            </div>
          ) : recebimentos.length === 0 ? (
            <Card>
              <EmptyState
                icon={<Package className="size-5" />}
                title="Nenhum recebimento encontrado"
                description="Ajuste os filtros ou crie um novo recebimento"
              />
            </Card>
          ) : (
            <>
              <div className="space-y-3">
                {recebimentos.map((rec) => (
                  <RecebimentoCard key={rec.id} rec={rec} onReload={() => loadRecebimentos(currentPage, filtros.applied)} />
                ))}
              </div>

              {totalPages > 1 && (
                <Card className="flex items-center justify-between p-4">
                  <p className="text-sm text-slate-600">
                    Mostrando {((currentPage - 1) * itemsPerPage) + 1}-{Math.min(currentPage * itemsPerPage, totalItems)} de {totalItems}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      onClick={() => loadRecebimentos(currentPage - 1, filtros.applied)}
                      disabled={currentPage === 1}
                    >
                      Anterior
                    </Button>
                    <div className="flex items-center gap-2 px-3">
                      <span className="text-sm font-medium text-slate-700">
                        Página {currentPage} de {totalPages}
                      </span>
                    </div>
                    <Button
                      variant="secondary"
                      onClick={() => loadRecebimentos(currentPage + 1, filtros.applied)}
                      disabled={currentPage >= totalPages}
                    >
                      Próxima
                    </Button>
                  </div>
                </Card>
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="notas" className="mt-6">
          <NotasVinculadasTab />
        </TabsContent>

        <TabsContent value="divergencias" className="mt-6">
          <DivergenciasListagemTab />
        </TabsContent>

        <TabsContent value="dashboard" className="mt-6">
          <DashboardTab recebimentos={recebimentos} />
        </TabsContent>
      </Tabs>

      {showCreateModal && (
        <CreateRecebimentoModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={(id) => {
            setShowCreateModal(false)
            router.push(`/recebimento/${id}`)
          }}
          initialDates={prefilledDates}
        />
      )}

      {showImport && (
        <ImportNFeModal
          onClose={() => setShowImport(false)}
          onSuccess={() => {
            setShowImport(false)
            loadRecebimentos(currentPage, filtros.applied)
          }}
          onStartRecebimento={(dates) => {
            setPrefilledDates(dates)
            setShowImport(false)
            setShowCreateModal(true)
          }}
        />
      )}
    </PageContainer>
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
  const [divergenciasDetalhes, setDivergenciasDetalhes] = useState<Map<string, Array<{
    codigo_produto: string
    descricao: string
    tipo: string
    obs: string
  }>>>(new Map())
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
          const itensComDivergencia = data.itens?.filter((item: { divergencia_tipo?: unknown }) => item.divergencia_tipo) || []
          setHasDivergencias(itensComDivergencia.length > 0)

          // Contar divergências por NF e armazenar detalhes
          const countMap = new Map<string, number>()
          type DivergenciaDetalhe = {
            codigo_produto: string
            descricao: string
            tipo: string
            obs: string
          }
          const detalhesMap = new Map<string, DivergenciaDetalhe[]>()

          for (const item of itensComDivergencia) {
            const nf = item.numero_nf
            if (nf) {
              countMap.set(nf, (countMap.get(nf) || 0) + 1)

              const detalhes = detalhesMap.get(nf) || []
              detalhes.push({
                codigo_produto: item.nfe_item?.codigo_produto || '?',
                descricao: item.sku_descricao || item.nfe_item?.descricao || 'Sem descrição',
                tipo: String(item.divergencia_tipo || ''),
                obs: item.divergencia_obs || ''
              })
              detalhesMap.set(nf, detalhes)
            }
          }

          setDivergenciasPorNF(countMap)
          setDivergenciasDetalhes(detalhesMap)
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
        toast.error(data.error || 'Erro ao cancelar')
      }
    } catch (err) {
      console.error('Erro ao cancelar:', err)
      toast.error('Erro de conexão')
    } finally {
      setCanceling(false)
    }
  }

  return (
    <Card className="p-4 transition-all hover:border-primary/40 hover:shadow-md">
      <div className="mb-3 flex items-start justify-between">
        <div className="flex items-center gap-2">
          <Badge tone={isFechado ? 'success' : isCancelado ? 'danger' : 'warning'}>
            {isFechado ? 'FECHADO' : isCancelado ? 'CANCELADO' : 'ABERTO'}
          </Badge>
          {rec.numero_recebimento && (
            <span className="font-mono text-xs text-slate-400">#{rec.numero_recebimento}</span>
          )}
          {qtdOS > 0 && (
            <Badge tone="info" title={rec.numeros_os?.join(', ')}>
              OS: {rec.numeros_os?.slice(0, 2).join(', ')}{rec.numeros_os && rec.numeros_os.length > 2 ? '...' : ''}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1">
          {!isFechado && !isCancelado && (
            <IconButton
              variant="ghost"
              aria-label="Cancelar recebimento"
              title="Cancelar recebimento"
              className="text-red-500 hover:bg-red-50 hover:text-red-600"
              onClick={(e) => { e.stopPropagation(); setShowCancelarModal(true) }}
            >
              <X className="size-4" />
            </IconButton>
          )}
          <IconButton
            variant="ghost"
            aria-label="Ver recebimento"
            onClick={() => router.push(`/recebimento/${rec.id}`)}
          >
            <ChevronRight className="size-4" />
          </IconButton>
        </div>
      </div>

      <div className="mb-2 flex items-center gap-2 text-sm text-slate-600">
        <Calendar className="size-4 text-slate-400" />
        <span>{formatDate(rec.periodo_inicio)} — {formatDate(rec.periodo_fim)}</span>
      </div>

      {rec.motorista && (
        <div className="mb-2 flex items-center gap-2 text-sm text-slate-600">
          <Truck className="size-4 text-slate-400" />
          <span>{rec.motorista}</span>
        </div>
      )}

      {/* NFs e Peso */}
      <div className="mb-3 flex items-start gap-3 text-xs">
        <div className="flex-1">
          <div className="mb-1 flex items-center gap-1 text-slate-500">
            <FileText className="size-3.5" />
            <span className="font-medium">NFs ({nfes.length})</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {nfes.slice(0, 5).map((nfeLink, i) => (
              <span key={i} className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px]">
                {nfeLink.nfe?.numero_nf || '?'}
              </span>
            ))}
            {nfes.length > 5 && (
              <span className="px-1 text-[10px] text-slate-400">+{nfes.length - 5}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 text-slate-500">
            <Weight className="size-3.5" />
            <span className="font-mono text-xs">{pesoTotal.toFixed(0)}kg</span>
          </div>
          {nfes.length > 0 && (
            <div className="flex items-center gap-1">
              {hasDivergencias && (
                <div className="relative" title="Há divergências neste recebimento">
                  <AlertCircle className="size-4 text-amber-500" />
                </div>
              )}
              <IconButton
                variant="ghost"
                aria-label="Ver detalhes das NFs"
                title="Ver detalhes das NFs"
                onClick={(e) => { e.stopPropagation(); setShowDetailsModal(true) }}
              >
                <Eye className="size-4" />
              </IconButton>
            </div>
          )}
        </div>
      </div>

      {/* Progress */}
      <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
        <span>{rec.total_itens} itens</span>
        <span>{rec.total_recebido}/{rec.total_previsto} volumes ({pct}%)</span>
      </div>
      <Progress
        value={pct}
        tone={pct >= 100 ? 'success' : pct > 0 ? 'warning' : 'neutral'}
        label={`Progresso do recebimento: ${rec.total_recebido} de ${rec.total_previsto} volumes`}
      />

      {/* Modal Detalhes NFes */}
      <Dialog open={showDetailsModal} onOpenChange={setShowDetailsModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader title="Notas Fiscais do Recebimento" />
          <DialogBody>
            <div className="space-y-3">
              {nfes.map((nfeLink, i) => {
                const nfNumero = nfeLink.nfe?.numero_nf || '?'
                const qtdDivergencias = divergenciasPorNF.get(nfNumero) || 0
                return (
                  <div key={i} className={`rounded-lg border p-4 ${
                    qtdDivergencias > 0 ? 'border-amber-300 bg-amber-50' : 'border-slate-200'
                  }`}>
                    <div className="mb-2 flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-bold text-slate-800">NF {nfNumero}</span>
                        {nfeLink.nfe?.is_os && <Badge tone="info">OS</Badge>}
                        {qtdDivergencias > 0 && (
                          <Badge tone="warning">
                            {qtdDivergencias} diverg{qtdDivergencias > 1 ? 'ências' : 'ência'}
                          </Badge>
                        )}
                      </div>
                      <span className="text-sm text-slate-500">{formatDate(nfeLink.nfe?.data_emissao || '')}</span>
                    </div>
                    <div className="mb-3 flex gap-4 text-sm text-slate-600">
                      <span className="flex items-center gap-1">
                        <Weight className="size-4 text-slate-400" />
                        {nfeLink.nfe?.peso_total ? `${nfeLink.nfe.peso_total.toFixed(0)} kg` : '-'}
                      </span>
                      <span className="flex items-center gap-1">
                        <Package className="size-4 text-slate-400" />
                        {nfeLink.nfe?.volumes_total || 0} volumes
                      </span>
                    </div>

                    {qtdDivergencias > 0 && divergenciasDetalhes.get(nfNumero) && (
                      <div className="mt-3 border-t border-amber-300 pt-3">
                        <h4 className="mb-2 text-sm font-semibold text-amber-900">Itens com divergência:</h4>
                        <div className="space-y-2">
                          {divergenciasDetalhes.get(nfNumero)!.map((div, idx) => (
                            <div key={idx} className="rounded border border-amber-200 bg-white p-2 text-xs">
                              <div className="mb-1 font-medium text-slate-800">
                                {div.codigo_produto} - {div.descricao}
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge tone="warning">{div.tipo}</Badge>
                                {div.obs && <span className="text-slate-600">{div.obs}</span>}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </DialogBody>
        </DialogContent>
      </Dialog>

      {/* Modal Cancelar */}
      <ConfirmDialog
        open={showCancelarModal}
        onOpenChange={setShowCancelarModal}
        title="Cancelar Recebimento"
        description="Esta ação não pode ser desfeita"
        confirmLabel={canceling ? 'Cancelando...' : 'Confirmar'}
        cancelLabel="Voltar"
        destructive
        loading={canceling}
        onConfirm={handleCancelar}
      />
    </Card>
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
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [nfesPreview, setNfesPreview] = useState<Array<{id: string; numero_nf: string; data_emissao: string; volumes_total: number}>>([])
  const [selectedNfes, setSelectedNfes] = useState<Set<string>>(new Set())

  async function handleBuscarNfes() {
    const inicioDate = parseBrDate(periodoInicio)
    const fimDate = parseBrDate(periodoFim)
    if (!inicioDate || !fimDate) {
      setError('Informe o período')
      return
    }
    setLoadingPreview(true)
    setError('')

    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('nfe')
        .select('id, numero_nf, data_emissao, volumes_total')
        .gte('data_emissao', dateToIso(inicioDate))
        .lte('data_emissao', dateToIso(fimDate))
        .order('numero_nf', { ascending: false })

      if (error) {
        toast.error('Erro ao buscar NFs: ' + error.message)
      } else if (!data || data.length === 0) {
        toast.warning('Nenhuma NF encontrada no período selecionado')
        setNfesPreview([])
        setSelectedNfes(new Set())
      } else {
        setNfesPreview(data)
        // Selecionar todas por padrão
        setSelectedNfes(new Set(data.map(nf => nf.id)))
        toast.success(`${data.length} NF(s) encontrada(s)`)
      }
    } catch (err) {
      console.error('Erro ao buscar NFes:', err)
      toast.error('Erro de conexão ao buscar NFs')
    } finally {
      setLoadingPreview(false)
    }
  }

  function toggleNfe(nfeId: string) {
    setSelectedNfes(prev => {
      const newSet = new Set(prev)
      if (newSet.has(nfeId)) {
        newSet.delete(nfeId)
      } else {
        newSet.add(nfeId)
      }
      return newSet
    })
  }

  // Auto-buscar NFes quando ambas as datas estiverem completas
  useEffect(() => {
    const inicioDate = parseBrDate(periodoInicio)
    const fimDate = parseBrDate(periodoFim)
    if (inicioDate && fimDate && nfesPreview.length === 0 && !loadingPreview) {
      handleBuscarNfes()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodoInicio, periodoFim])

  async function handleCreate() {
    const inicioDate = parseBrDate(periodoInicio)
    const fimDate = parseBrDate(periodoFim)
    if (!inicioDate || !fimDate) {
      setError('Informe o período')
      return
    }

    if (nfesPreview.length > 0 && selectedNfes.size === 0) {
      setError('Selecione pelo menos uma NF')
      return
    }

    setSaving(true)
    setError('')

    try {
      const res = await fetch('/api/recebimento', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          periodo_inicio: dateToIso(inicioDate),
          periodo_fim: dateToIso(fimDate),
          obs: obs || null,
          nfe_ids: nfesPreview.length > 0 ? Array.from(selectedNfes) : undefined,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Erro ao criar recebimento')
        toast.error(data.error || 'Erro ao criar recebimento')
        setSaving(false)
        return
      }

      toast.success('Recebimento criado com sucesso!')
      onSuccess(data.id)
    } catch {
      setError('Erro de conexão')
      toast.error('Erro de conexão ao criar recebimento')
      setSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="max-w-md">
        <DialogHeader title="Novo Recebimento" />
        <DialogBody>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <FormField id="periodo-inicio" label="Período Início" required>
                {(f) => (
                  <DateField id={f.id} value={periodoInicio} onChange={setPeriodoInicio} aria-invalid={f['aria-invalid']} disabled={saving} />
                )}
              </FormField>
              <FormField id="periodo-fim" label="Período Fim" required>
                {(f) => (
                  <DateField id={f.id} value={periodoFim} onChange={setPeriodoFim} aria-invalid={f['aria-invalid']} disabled={saving} />
                )}
              </FormField>
            </div>

            <Button
              variant="secondary"
              onClick={handleBuscarNfes}
              className="w-full"
              disabled={loadingPreview || saving}
              loading={loadingPreview}
            >
              Buscar NFs no Período
            </Button>

            {/* Preview de NFs */}
            {nfesPreview.length > 0 && (
              <div className="max-h-60 overflow-y-auto rounded-lg border border-slate-200 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-700">
                    {nfesPreview.length} NF(s) encontrada(s)
                  </p>
                  <button
                    onClick={() => {
                      if (selectedNfes.size === nfesPreview.length) {
                        setSelectedNfes(new Set())
                      } else {
                        setSelectedNfes(new Set(nfesPreview.map(nf => nf.id)))
                      }
                    }}
                    className="text-xs text-primary hover:underline"
                  >
                    {selectedNfes.size === nfesPreview.length ? 'Desmarcar Todas' : 'Marcar Todas'}
                  </button>
                </div>
                <div className="space-y-1">
                  {nfesPreview.map(nf => (
                    <label key={nf.id} className="flex cursor-pointer items-center gap-2 rounded p-2 hover:bg-slate-50">
                      <input
                        type="checkbox"
                        checked={selectedNfes.has(nf.id)}
                        onChange={() => toggleNfe(nf.id)}
                        className="size-4 rounded border-slate-300 text-primary focus:ring-primary"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-800">
                          NF {nf.numero_nf}
                        </p>
                        <p className="text-xs text-slate-500">
                          {new Date(nf.data_emissao).toLocaleDateString('pt-BR')} • {nf.volumes_total} vol
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  {selectedNfes.size} de {nfesPreview.length} selecionada(s)
                </p>
              </div>
            )}

            <FormField id="obs" label="Observações">
              {(f) => (
                <Textarea
                  id={f.id}
                  value={obs}
                  onChange={e => setObs(e.target.value)}
                  rows={2}
                  placeholder="Observações opcionais..."
                  aria-invalid={f['aria-invalid']}
                />
              )}
            </FormField>

            {error && <Alert tone="danger">{error}</Alert>}
          </div>
        </DialogBody>
        <div className="flex shrink-0 gap-3 border-t border-slate-100 px-6 py-4">
          <Button variant="secondary" onClick={onClose} className="flex-1" disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleCreate} className="flex-1" disabled={saving || loadingPreview} loading={saving}>
            Criar Recebimento
          </Button>
        </div>
      </DialogContent>
    </Dialog>
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
    const inicioDate = parseBrDate(inicio)
    const fimDate = parseBrDate(fim)
    if (!inicioDate || !fimDate) return 'Preencha as datas de início e fim.'
    if (fimDate < inicioDate) return 'Data fim deve ser maior ou igual à data início.'
    const diffDays = (fimDate.getTime() - inicioDate.getTime()) / (1000 * 60 * 60 * 24)
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
      const inicioDate = parseBrDate(inicio)!
      const fimDate = parseBrDate(fim)!
      const res = await fetch('/api/nfe/importar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inicio: dateToIso(inicioDate), fim: dateToIso(fimDate) }),
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
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader title={<span className="flex items-center gap-2"><Download className="size-5 text-primary" />Importar NF-e</span>} />
        <DialogBody>
          {/* Mode Selector */}
          <div className="mb-6 flex gap-2">
            <Button
              variant={mode === 'data' ? 'primary' : 'secondary'}
              onClick={() => setMode('data')}
              className="flex-1"
            >
              <Calendar className="size-4" />
              Buscar por Data
            </Button>
            <Button
              variant={mode === 'xml' ? 'primary' : 'secondary'}
              onClick={() => setMode('xml')}
              className="flex-1"
            >
              <Upload className="size-4" />
              Upload XML
            </Button>
          </div>

          {/* Mode: Buscar por Data */}
          {mode === 'data' && !dateResult && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <FormField id="import-data-inicio" label="Data Início" required>
                  {(f) => <DateField id={f.id} value={inicio} onChange={setInicio} aria-invalid={f['aria-invalid']} disabled={importing} />}
                </FormField>
                <FormField id="import-data-fim" label="Data Fim" required>
                  {(f) => <DateField id={f.id} value={fim} onChange={setFim} aria-invalid={f['aria-invalid']} disabled={importing} />}
                </FormField>
              </div>

              {errorMsg && <Alert tone="danger">{errorMsg}</Alert>}
            </div>
          )}

          {/* Mode: Date - Results */}
          {mode === 'data' && dateResult && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="rounded-xl bg-slate-50 p-3 text-center">
                  <p className="flex items-center justify-center gap-1 text-2xl font-bold text-slate-700">
                    <Mail className="size-5 text-slate-400" />
                    {dateResult.total_mensagens ?? 0}
                  </p>
                  <p className="text-xs text-slate-500">Mensagens</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3 text-center">
                  <p className="flex items-center justify-center gap-1 text-2xl font-bold text-slate-700">
                    <FileText className="size-5 text-slate-400" />
                    {dateResult.nfs?.length ?? 0}
                  </p>
                  <p className="text-xs text-slate-500">NFs</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3 text-center">
                  <p className="flex items-center justify-center gap-1 text-2xl font-bold text-emerald-600">
                    <Database className="size-5 text-emerald-400" />
                    {dateResult.total_salvas ?? 0}
                  </p>
                  <p className="text-xs text-slate-500">Salvas</p>
                </div>
              </div>

              {dateResult.nfs && dateResult.nfs.length > 0 && (
                <div className="max-h-60 space-y-2 overflow-y-auto">
                  {dateResult.nfs.map((nf, idx) => (
                    <div key={`${nf.numero_nf}-${idx}`} className="rounded-lg border border-slate-200 p-3 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-800">NF {nf.numero_nf}</span>
                        <span className="text-xs text-slate-500">{nf.data_emissao.substring(0, 10)}</span>
                      </div>
                      <div className="mt-1 flex gap-3 text-xs text-slate-600">
                        <span>{nf.volumes_total} volumes</span>
                        <span>{parseFloat(nf.peso_total).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} kg</span>
                        <span>{nf.itens?.length || 0} itens</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Mode: Upload XML */}
          {mode === 'xml' && !xmlResults && (
            <div className="space-y-4">
              <div className="rounded-xl border-2 border-dashed border-slate-300 p-6 text-center">
                <Upload className="mx-auto mb-2 size-8 text-slate-400" />
                <p className="mb-3 text-sm text-slate-500">Selecione os arquivos XML das NF-e</p>
                <input
                  type="file"
                  accept=".xml"
                  multiple
                  onChange={e => setFiles(e.target.files)}
                  className="block w-full text-sm text-slate-500 file:mr-4 file:rounded-lg file:border-0 file:bg-primary/10 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-primary hover:file:bg-primary/20"
                />
              </div>

              {files && files.length > 0 && (
                <p className="text-sm text-slate-600">{files.length} arquivo(s) selecionado(s)</p>
              )}
            </div>
          )}

          {/* Mode: XML - Results */}
          {mode === 'xml' && xmlResults && (
            <div className="max-h-60 space-y-2 overflow-y-auto">
              {xmlResults.map((r, i) => (
                <div
                  key={i}
                  className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm ${
                    r.status === 'ok' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                  }`}
                >
                  <span className="flex-1 truncate">{r.file}</span>
                  <span className="ml-2 font-medium">
                    {r.status === 'ok' ? `NF ${r.numero_nf}` : r.error}
                  </span>
                </div>
              ))}
            </div>
          )}
        </DialogBody>

        <div className="flex shrink-0 gap-3 border-t border-slate-100 px-6 py-4">
          {mode === 'data' && !dateResult && (
            <>
              <Button variant="secondary" onClick={onClose} className="flex-1" disabled={importing}>
                Cancelar
              </Button>
              <Button onClick={handleImportByDate} className="flex-1" disabled={importing} loading={importing}>
                <Search className="size-4" />
                Buscar NFs
              </Button>
            </>
          )}
          {mode === 'data' && dateResult && (
            <>
              {dateResult.total_salvas && dateResult.total_salvas > 0 && (
                <Button onClick={() => onStartRecebimento({ inicio, fim })} className="flex-1">
                  <Package className="size-4" />
                  Iniciar Recebimento das Notas
                </Button>
              )}
              <Button onClick={onSuccess} variant="secondary" className="flex-1 text-red-600 hover:bg-red-50 hover:text-red-700">
                Fechar
              </Button>
            </>
          )}
          {mode === 'xml' && !xmlResults && (
            <>
              <Button variant="secondary" onClick={onClose} className="flex-1" disabled={uploading}>
                Cancelar
              </Button>
              <Button
                onClick={handleUploadXML}
                className="flex-1"
                disabled={uploading || !files || files.length === 0}
                loading={uploading}
              >
                Importar
              </Button>
            </>
          )}
          {mode === 'xml' && xmlResults && (
            <Button onClick={onSuccess} className="flex-1">Fechar</Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

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
    is_vinculada: boolean
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
          .select(`
            id,
            numero_nf,
            data_emissao,
            peso_total,
            volumes_total,
            is_os,
            created_at,
            recebimento_nfes(nfe_id)
          `)
          .order('numero_nf', { ascending: false })
          .limit(500)

        if (!error && data) {
          // Marcar NFes vinculadas
          const nfesWithVinculo = data.map(nf => {
            const nfWithRecebimento = nf as { recebimento_nfes?: unknown[] };
            return {
              ...nf,
              is_vinculada: (nfWithRecebimento.recebimento_nfes?.length ?? 0) > 0,
              recebimento_nfes: undefined // Remove do objeto final
            };
          });
          setNfes(nfesWithVinculo);
        } else if (error) {
          toast.error('Erro ao carregar notas fiscais')
        }
      } catch (err) {
        console.error('Erro ao carregar NFes:', err)
        toast.error('Erro de conexão ao carregar notas fiscais')
      } finally {
        setLoading(false)
      }
    }
    loadNfes()
  }, [])

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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size={32} />
      </div>
    )
  }

  const selectedNfeData = nfes.find(n => n.id === selectedNfe)

  return (
    <div className="space-y-3">
      {nfes.length === 0 ? (
        <Card>
          <EmptyState
            icon={<FileText className="size-5" />}
            title="Nenhuma NF-e importada"
            description="Importe NFs para começar"
          />
        </Card>
      ) : (
        <>
          <Card className="mb-4 p-4">
            <p className="text-sm text-slate-600">
              Total: <span className="font-bold text-slate-800">{nfes.length}</span> NF-e(s) importadas
            </p>
          </Card>
          {nfes.map((nfe) => (
            <Card
              key={nfe.id}
              className="cursor-pointer p-4 transition-all hover:border-primary/40 hover:shadow-md"
              onClick={() => {
                setSelectedNfe(nfe.id)
                loadNfeItens(nfe.id)
              }}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="mb-2 flex items-center gap-2">
                    <span className="text-lg font-bold text-slate-800">NF {nfe.numero_nf}</span>
                    {nfe.is_os && <Badge tone="info">OS</Badge>}
                    {nfe.is_vinculada ? (
                      <Badge tone="success" title="Vinculada a um recebimento">✓ Vinculada</Badge>
                    ) : (
                      <Badge tone="neutral" title="Não vinculada a nenhum recebimento">Não Vinculada</Badge>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-4 text-sm text-slate-600">
                    <span className="flex items-center gap-1">
                      <Calendar className="size-4 text-slate-400" />
                      {formatDate(nfe.data_emissao)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Package className="size-4 text-slate-400" />
                      {nfe.volumes_total} volumes
                    </span>
                    <span className="flex items-center gap-1">
                      <Weight className="size-4 text-slate-400" />
                      {nfe.peso_total.toFixed(0)} kg
                    </span>
                  </div>
                </div>
                <ChevronRight className="size-5 text-slate-400" />
              </div>
            </Card>
          ))}
        </>
      )}

      {/* Modal Itens da NFe */}
      <Dialog open={Boolean(selectedNfe && selectedNfeData)} onOpenChange={(open) => { if (!open) setSelectedNfe(null) }}>
        <DialogContent className="max-w-3xl">
          <DialogHeader
            title={<span className="flex items-center gap-2"><FileText className="size-5 text-primary" />Itens da NF {selectedNfeData?.numero_nf}</span>}
            description={selectedNfeData ? `${formatDate(selectedNfeData.data_emissao)} • ${nfeItens.length} itens` : undefined}
          />
          <DialogBody>
            {loadingItens ? (
              <div className="flex items-center justify-center py-12">
                <Spinner size={32} />
              </div>
            ) : nfeItens.length === 0 ? (
              <EmptyState icon={<Package className="size-5" />} title="Nenhum item encontrado" />
            ) : (
              <div className="space-y-2">
                {nfeItens.map((item, idx) => (
                  <div key={idx} className="rounded-lg border border-slate-200 p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="mb-1 flex items-center gap-2">
                          <span className="font-mono text-sm font-bold text-slate-800">{item.codigo_produto}</span>
                          <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">#{idx + 1}</span>
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
          </DialogBody>
        </DialogContent>
      </Dialog>
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
      <Card>
        <CardHeader icon={<TrendingUp className="size-4" />} title="Métricas Gerais" />
        <CardContent>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <KpiCard tone="info" icon={<Package className="size-4" />} label="Recebimentos" value={totalRecebimentos} detail="Fechados" />
            <KpiCard tone="success" icon={<Weight className="size-4" />} label="Peso Total" value={`${kgTotais.toFixed(0)} kg`} />
            <KpiCard tone="brand" icon={<Clock className="size-4" />} label="Tempo Médio" value={`${tempoMedio.toFixed(1)} h`} />
            <KpiCard tone="warning" icon={<Users className="size-4" />} label="Chapas Média" value={chapasMedia.toFixed(1)} detail="Por recebimento" />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader icon={<BarChart3 className="size-4" />} title="Médias por Recebimento" />
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between rounded-lg bg-slate-50 p-3">
              <span className="text-sm text-slate-600">Peso Médio</span>
              <span className="text-lg font-bold text-slate-800">{kgMedio.toFixed(0)} kg</span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-slate-50 p-3">
              <span className="text-sm text-slate-600">Volumes Médios</span>
              <span className="text-lg font-bold text-slate-800">{volumesMedio.toFixed(0)}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-slate-50 p-3">
              <span className="text-sm text-slate-600">Tempo Total</span>
              <span className="text-lg font-bold text-slate-800">{tempoTotal.toFixed(1)} h</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader icon={<TrendingUp className="size-4" />} title="Status dos Recebimentos" />
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between rounded-lg bg-emerald-50 p-3">
              <span className="text-sm font-medium text-emerald-700">Fechados</span>
              <Badge tone="success">{recebimentos.filter(r => r.status === 'fechado').length}</Badge>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-amber-50 p-3">
              <span className="text-sm font-medium text-amber-700">Abertos</span>
              <Badge tone="warning">{recebimentos.filter(r => r.status === 'aberto').length}</Badge>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-red-50 p-3">
              <span className="text-sm font-medium text-red-700">Cancelados</span>
              <Badge tone="danger">{recebimentos.filter(r => r.status === 'cancelado').length}</Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// =========================================================
// Divergências Listagem Tab
// =========================================================

function DivergenciasListagemTab() {
  const [problemas, setProblemas] = useState<Array<{
    id: string
    descricao: string
    recebimento_id: string
    created_at: string
    resolvido: boolean
    resolvido_em: string | null
    recebimento: {
      periodo_inicio: string
      periodo_fim: string
      recebimento_nfes: Array<{
        nfe: { numero_nf: string } | null
      }>
    } | null
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
        setProblemas(data)
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
        <Spinner size={32} />
      </div>
    )
  }

  const problemasPendentes = problemas.filter(p => !p.resolvido)
  const problemasResolvidos = problemas.filter(p => p.resolvido)

  if (problemas.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={<CheckCircle2 className="size-5" />}
          title="Nenhum problema registrado"
          description="Nenhum problema foi reportado ainda."
        />
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Problemas Pendentes */}
      {problemasPendentes.length > 0 && (
        <Card>
          <CardHeader
            icon={<AlertCircle className="size-4" />}
            title="Problemas Pendentes"
            description={`${problemasPendentes.length} problema${problemasPendentes.length !== 1 ? 's' : ''} aguardando resolução`}
          />
          <CardContent className="space-y-3">
            {problemasPendentes.map(problema => {
              const nfs = problema.recebimento?.recebimento_nfes?.map(rn => rn.nfe?.numero_nf).filter(Boolean) || []
              return (
                <div key={problema.id} className="rounded-lg border border-amber-200 bg-white p-4">
                  <p className="mb-2 text-sm font-medium text-slate-800">{problema.descricao}</p>

                  {problema.recebimento && (
                    <div className="mb-3 rounded bg-slate-50 p-2 text-xs">
                      <div className="mb-1 flex items-center gap-2 text-slate-600">
                        <Calendar className="size-3" />
                        <span>
                          Recebimento: {formatDate(problema.recebimento.periodo_inicio)} — {formatDate(problema.recebimento.periodo_fim)}
                        </span>
                      </div>
                      {nfs.length > 0 && (
                        <div className="flex items-center gap-2 text-slate-600">
                          <FileText className="size-3" />
                          <span>NFs: {nfs.join(', ')}</span>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">
                      {new Date(problema.created_at).toLocaleDateString('pt-BR')} às{' '}
                      {new Date(problema.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <Button
                      size="sm"
                      onClick={() => marcarComoResolvido(problema.id)}
                      disabled={resolvendo.has(problema.id)}
                      loading={resolvendo.has(problema.id)}
                      className="bg-emerald-600 text-white hover:bg-emerald-700"
                    >
                      Marcar como resolvido
                    </Button>
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>
      )}

      {/* Problemas Resolvidos */}
      {problemasResolvidos.length > 0 && (
        <Card>
          <CardHeader
            icon={<CheckCircle2 className="size-4" />}
            title="Problemas Resolvidos"
            description={`${problemasResolvidos.length} problema${problemasResolvidos.length !== 1 ? 's' : ''} já resolvido${problemasResolvidos.length !== 1 ? 's' : ''}`}
          />
          <CardContent className="space-y-3">
            {problemasResolvidos.map(problema => {
              const nfs = problema.recebimento?.recebimento_nfes?.map(rn => rn.nfe?.numero_nf).filter(Boolean) || []
              return (
                <div key={problema.id} className="rounded-lg border border-emerald-200 bg-white p-4 opacity-75">
                  <p className="mb-2 text-sm font-medium text-slate-800">{problema.descricao}</p>

                  {problema.recebimento && (
                    <div className="mb-3 rounded bg-slate-50 p-2 text-xs">
                      <div className="mb-1 flex items-center gap-2 text-slate-600">
                        <Calendar className="size-3" />
                        <span>
                          Recebimento: {formatDate(problema.recebimento.periodo_inicio)} — {formatDate(problema.recebimento.periodo_fim)}
                        </span>
                      </div>
                      {nfs.length > 0 && (
                        <div className="flex items-center gap-2 text-slate-600">
                          <FileText className="size-3" />
                          <span>NFs: {nfs.join(', ')}</span>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>
                      Criado: {new Date(problema.created_at).toLocaleDateString('pt-BR')}
                    </span>
                    {problema.resolvido_em && (
                      <span className="font-medium text-emerald-700">
                        Resolvido: {new Date(problema.resolvido_em).toLocaleDateString('pt-BR')}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>
      )}
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
