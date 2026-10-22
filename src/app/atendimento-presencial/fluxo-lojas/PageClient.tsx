'use client'
import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { ArrowRight, BarChart3, ChevronDown, ChevronUp, ClipboardCheck, Clock3, RefreshCw, Search, Store } from 'lucide-react'
import {
  Alert, Badge, Button, Card, CardContent, DateField,
  EmptyState, FilterFieldGroup, FilterPanel, FormField, PageContainer, PageHeader, ResponsiveTable, Spinner, useAsyncAction, useFilterState,
} from '@/components/design-system'
import { DetalhesAtendimentoDialog, type DetalheAtendimentoLoadingSummary } from '@/components/atendimento-presencial/DetalhesAtendimentoDialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { localParts, readFlowFilters, type Comparison, type FlowDashboard, type FlowRecord } from '@/lib/atendimento-presencial/fluxo-lojas'
import { getMotivoVisitaLabel, situacaoVendaRegistro, type RegistroAtendimentoDetalheDTO } from '@/lib/atendimento-presencial/registros'
import { parseBrDate } from '@/lib/design-system/dates'
import { FlowChart } from './FlowCharts'
import { FlowOverview } from './FlowOverview'
import { FlowAudit } from './FlowAudit'
import { differenceText, friendlyWarning } from './flow-text'
import { retainLastMeasurement } from '@/lib/atendimento-presencial/fluxo-lojas-stale'

const API = '/api/atendimento-presencial/fluxo-lojas'
const REFRESH_MS = 300000
type TableResult = { registros: FlowRecord[]; page: number; pageSize: number; total: number; pages: number }
type DashboardResult = FlowDashboard & { tabela: TableResult }
type UiFilters = { periodo: string; de: string; ate: string; unidadeId: string; horaDe: string; horaAte: string; tipo: string; consultora: string; situacao: string }
function initialFilters(): UiFilters { const day = localParts(new Date()).day.split('-').reverse().join('/'); return { periodo: 'hoje', de: day, ate: day, unidadeId: '', horaDe: '8', horaAte: '22', tipo: '', consultora: '', situacao: '' } }
export function flowParams(filters: UiFilters, now = new Date()) {
  let de: string; let ate: string
  if (filters.periodo !== 'personalizado') {
    const today = localParts(now).day
    const shifted = new Date(`${today}T12:00:00Z`)
    shifted.setUTCDate(shifted.getUTCDate() - (filters.periodo === 'ontem' ? 1 : filters.periodo === '7dias' ? 6 : 0))
    de = shifted.toISOString().slice(0,10); ate = filters.periodo === 'ontem' ? de : today
  } else {
    const begin = parseBrDate(filters.de); const end = parseBrDate(filters.ate)
    if (!begin || !end) throw new Error('Informe as datas no formato DD/MM/AAAA.')
    const iso = (date: Date) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`
    de = iso(begin); ate = iso(end)
  }
  const params = new URLSearchParams({ de, ate, unidadeId: filters.unidadeId, horaDe: filters.horaDe, horaAte: filters.horaAte, tipo: filters.tipo, consultora: filters.consultora, situacao: filters.situacao })
  readFlowFilters(params, now)
  return params
}
function Options({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: Array<[string,string]> }) {
  const id = useId()
  return <FormField id={id} label={label}>{field => <Select value={value || 'todos'} onValueChange={value => onChange(value === 'todos' ? '' : value)}><SelectTrigger {...field} aria-label={label} className="w-full"><SelectValue /></SelectTrigger><SelectContent>{options.map(([value,label]) => <SelectItem key={value || 'todos'} value={value || 'todos'}>{label}</SelectItem>)}</SelectContent></Select>}</FormField>
}
function value(number: number | null) { return number === null ? '—' : number.toLocaleString('pt-BR') }
function stamp(date: string | null) { return date ? new Date(date).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : 'Ainda não consultada' }
function duration(record: FlowRecord) { const n = record.duracaoMinutos; return n === null ? 'Duração não disponível' : `${Math.floor(n / 1440)}d ${Math.floor(n % 1440 / 60)}h ${n % 60}min` }
function Difference({ number }: { number: number | null }) {
  return <Badge tone={number === null || number === 0 ? 'neutral' : number > 0 ? 'warning' : 'info'} className="whitespace-normal text-sm">{differenceText(number)}</Badge>
}
function Measurement({ coverage }: { coverage: Comparison['cobertura'] }) {
  return <Badge tone={coverage === 'complete' ? 'success' : coverage === 'partial' ? 'warning' : 'neutral'}>{coverage === 'complete' ? 'Contagem completa' : coverage === 'partial' ? 'Contagem ainda incompleta' : 'Sem contagem disponível'}</Badge>
}
function RecordType({ row }: { row: FlowRecord }) {
  return <Badge tone={row.tipo === 'cliente' ? 'info' : 'warning'}>{row.tipo === 'cliente' ? 'Cliente' : 'Não cliente'}</Badge>
}
function RecordResult({ row }: { row: FlowRecord }) {
  if (row.tipo === 'nao_cliente') return <Badge tone="neutral">{getMotivoVisitaLabel(row.motivo)}</Badge>
  return <Badge tone={row.resultado === 'sim' ? 'success' : row.resultado === 'negociacao' ? 'warning' : row.resultado === 'nao' ? 'danger' : 'neutral'}>{situacaoVendaRegistro(row.resultado).label}</Badge>
}
function RecordTime({ row }: { row: FlowRecord }) {
  const local = localParts(new Date(row.iniciadoEm))
  return <div className="space-y-1"><p className="text-base font-bold tabular-nums">{new Date(row.iniciadoEm).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' })}</p><p className="text-xs text-muted-foreground">{local.day.split('-').reverse().join('/')} · {duration(row)}</p>{row.conclusaoOutroDia && <Badge tone="warning">Concluído em outro dia</Badge>}</div>
}
const sourceLabels: Record<FlowDashboard['externo']['state'], string> = {
  not_configured: 'A contagem da AlterVision ainda não está disponível. As Pranchetas continuam disponíveis.', mapping_pending: 'Ainda falta confirmar a configuração da contagem de entradas nas lojas.',
  ok: 'Contagem atualizada', partial: 'A contagem ainda está incompleta ou aguardando atualização. Aguarde os dados completos para comparar com as Pranchetas.', auth_error: 'Não foi possível acessar a AlterVision. Peça à equipe responsável para verificar o acesso.', rate_limited: 'A AlterVision pediu uma pausa nas consultas. Aguarde a próxima atualização.', timeout: 'A AlterVision demorou para responder. Tente novamente em instantes.', unavailable: 'AlterVision indisponível.', invalid_response: 'Não foi possível interpretar a contagem enviada pela AlterVision. Peça à equipe responsável para verificar.',
}
export default function PageClient() {
  const [initial] = useState(initialFilters)
  const filters = useFilterState(initial)
  const applied = filters.applied
  const [data, setData] = useState<DashboardResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [hourlyOpen, setHourlyOpen] = useState(false)
  const [selection, setSelection] = useState<Comparison | null>(null)
  const [detail, setDetail] = useState<RegistroAtendimentoDetalheDTO | null>(null)
  const [detailSummary, setDetailSummary] = useState<DetalheAtendimentoLoadingSummary | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)
  const inflight = useRef<AbortController | null>(null)
  const detailFlight = useRef<AbortController | null>(null)
  const generation = useRef(0)
  const lastLoaded = useRef(0)
  const currentPage = useRef(1)
  const lastScope = useRef('')
  const load = useCallback(async (force = false, page = 1, tableOnly = false) => {
    const generationId = ++generation.current
    inflight.current?.abort()
    const controller = new AbortController(); inflight.current = controller
    setLoading(true); setError(null)
    try {
      const params = flowParams(applied); params.set('page', String(page))
      const scope = params.toString().replace(/&page=\d+$/, '')
      if (scope !== lastScope.current) { setData(null); setDetail(null); setDetailSummary(null); setDetailOpen(false) }
      const response = await fetch(`${API}${force ? '/atualizar' : tableOnly ? '/atendimentos' : ''}?${params}`, { method: force ? 'POST' : 'GET', cache: 'no-store', signal: controller.signal })
      const body = await response.json()
      if (generationId !== generation.current) return
      if (!response.ok || !body.ok) {
        if ([401,403].includes(response.status)) { setData(null); setDetail(null); setDetailSummary(null); setDetailOpen(false) }
        throw new Error(body.message ?? 'Não foi possível consultar o comparativo.')
      }
      if (tableOnly) setData(old => old ? { ...old, tabela: body } : null)
      else setData(old => retainLastMeasurement(old,body))
      currentPage.current = tableOnly ? body.page : body.tabela.page
      lastScope.current = scope; lastLoaded.current = Date.now()
    } catch (error) {
      if (!controller.signal.aborted && generationId === generation.current) setError(error instanceof Error ? error.message : 'Falha na consulta.')
    } finally { if (generationId === generation.current) { setLoading(false); inflight.current = null } }
  }, [applied])
  const refresh = useAsyncAction(async () => { if (!inflight.current) await load(true, currentPage.current) })
  useEffect(() => {
    void load()
    const auto = () => { if (!document.hidden && !inflight.current && Date.now() - lastLoaded.current >= REFRESH_MS) void load(false, currentPage.current) }
    const timer = setInterval(auto, REFRESH_MS)
    document.addEventListener('visibilitychange', auto)
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', auto); inflight.current?.abort() }
  }, [load])
  useEffect(() => () => { detailFlight.current?.abort() }, [])
  async function original(id: string) {
    detailFlight.current?.abort(); const controller = new AbortController(); detailFlight.current = controller
    const summaryRow = data?.tabela.registros.find(record => record.id === id)
    setDetailOpen(true); setDetail(null); setDetailError(null); setDetailLoading(true)
    setDetailSummary(summaryRow ? {
      clienteNome: summaryRow.tipo === 'nao_cliente' ? 'Atendimento sem cliente vinculado' : 'Cliente do atendimento',
      consultoraNomeManual: summaryRow.consultora,
      unidadeNome: summaryRow.filial,
      iniciadoEm: summaryRow.iniciadoEm,
      resultadoAtendimento: summaryRow.resultado as RegistroAtendimentoDetalheDTO['atendimento']['resultadoAtendimento'],
      versaoFluxo: summaryRow.tipo === 'nao_cliente' ? 2 : null,
      tipoAtendimento: summaryRow.tipo,
    } : null)
    try {
      const response = await fetch(`${API}/atendimentos/${id}`, { cache: 'no-store', signal: controller.signal }); const body = await response.json()
      if (!response.ok || !body.ok) throw new Error(body.message ?? 'Falha ao consultar atendimento.')
      if (!controller.signal.aborted) {
        setDetail(body.detalhe)
        setDetailSummary({
          clienteNome: body.detalhe.cliente?.nome ?? 'Atendimento sem cliente vinculado',
          consultoraNomeManual: body.detalhe.atendimento.consultoraNomeManual,
          unidadeNome: body.unidadeNome,
          iniciadoEm: body.detalhe.atendimento.iniciadoEm,
          resultadoAtendimento: body.detalhe.atendimento.resultadoAtendimento as RegistroAtendimentoDetalheDTO['atendimento']['resultadoAtendimento'],
          versaoFluxo: body.detalhe.atendimento.versaoFluxo,
          tipoAtendimento: body.detalhe.atendimento.tipoAtendimento,
        })
      }
    } catch (error) { if (!controller.signal.aborted) setDetailError(error instanceof Error ? error.message : 'Falha ao consultar atendimento.') }
    finally { if (!controller.signal.aborted) setDetailLoading(false) }
  }
  function selectUnit(id: string) {
    filters.setField('unidadeId', id); filters.apply(); setSelection(null)
  }
  function selectDay(period: 'hoje' | 'ontem') {
    filters.setField('periodo', period); filters.apply(); setSelection(null)
  }
  function applySelection() {
    if (!selection) return
    if (selection.unidadeId) filters.setField('unidadeId', selection.unidadeId)
    if (selection.hora !== undefined) { filters.setField('horaDe', String(selection.hora)); filters.setField('horaAte', String(selection.hora+1)) }
    filters.apply(); setSelection(null)
  }
  function recordContent(row: FlowRecord) {
    return <div className="space-y-3 text-sm"><div className="flex flex-wrap items-start justify-between gap-2"><RecordTime row={row} /><RecordType row={row} /></div><p className="font-semibold">{row.filial} · {row.consultora}</p><RecordResult row={row} /></div>
  }
  const table = data?.tabela
  return <PageContainer className="space-y-5">
    <PageHeader icon={<BarChart3 />} eyebrow="Atendimento presencial" title="Fluxo das lojas" description="Entradas e Pranchetas, do panorama geral até cada atendimento." action={<Button loading={refresh.loading} disabled={loading} onClick={() => void refresh.run()}><RefreshCw className="size-4" />Atualizar agora</Button>} />
    {data && <>
      <nav aria-label="Trocar filial" className="sticky top-0 z-20 md:top-16 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-sm backdrop-blur-sm">
        <div className="flex min-w-0 max-w-full items-center gap-1 sm:gap-2"><span className="mr-1 hidden items-center gap-2 text-xs sm:flex font-semibold text-slate-500"><Store className="size-4" />VISUALIZAR</span>{[['','Todas as lojas'], ...data.unidades.map(unit => [unit.id,unit.nome])].map(([id,name]) => <Button key={id} variant={applied.unidadeId === id ? 'primary' : 'ghost'} className="min-h-11 px-2 text-xs sm:px-4 sm:text-sm" aria-pressed={applied.unidadeId === id} disabled={loading} onClick={() => selectUnit(id)}>{name}</Button>)}</div>
        <div className="flex flex-wrap items-center gap-2"><div role="group" aria-label="Dia rápido" className="flex gap-1 rounded-lg border border-slate-200 p-1">{(['ontem','hoje'] as const).map(period => <Button key={period} variant={applied.periodo === period ? 'primary' : 'ghost'} className="min-h-11 px-3 text-xs" aria-pressed={applied.periodo === period} disabled={loading} onClick={() => selectDay(period)}>{period === 'ontem' ? 'Ontem' : 'Hoje'}</Button>)}</div><span className="text-xs font-medium text-slate-500">{data.filtros.de.split('-').reverse().join('/')} {data.filtros.de !== data.filtros.ate && `a ${data.filtros.ate.split('-').reverse().join('/')}`} · {data.filtros.horaDe}h–{data.filtros.horaAte}h</span></div>
      </nav>
      {data.avisos.filter(warning => warning.startsWith('Comparação com')).map(warning => <Alert key={warning} tone="info">{friendlyWarning(warning)}</Alert>)}
      <FlowOverview data={data} loading={loading} onUnit={selectUnit} />
    </>}
    <FilterPanel title="Período e filtros" dirty={filters.dirty} applyDisabled={loading} onApply={() => { setSelection(null); filters.apply() }} onClear={() => { setSelection(null); filters.clear() }}>
      <FilterFieldGroup label="Período e horário" icon={<Clock3 />} description="Dia a analisar e faixa de horas do atendimento.">
        <Options label="Período" value={filters.draft.periodo} onChange={value => filters.setField('periodo',value)} options={[[ 'hoje','Hoje'],['ontem','Ontem'],['7dias','Últimos 7 dias'],['personalizado','Personalizado']]} />
        {filters.draft.periodo === 'personalizado' && <FormField id="fluxo-de" label="Data inicial">{field => <DateField {...field} value={filters.draft.de} onChange={value => filters.setField('de',value)} />}</FormField>}
        {filters.draft.periodo === 'personalizado' && <FormField id="fluxo-ate" label="Data final">{field => <DateField {...field} value={filters.draft.ate} onChange={value => filters.setField('ate',value)} />}</FormField>}
        <Options label="A partir das" value={filters.draft.horaDe} onChange={value => filters.setField('horaDe',value)} options={Array.from({length:14},(_,i) => [String(i+8),`${i+8}h`])} />
        <Options label="Até as" value={filters.draft.horaAte} onChange={value => filters.setField('horaAte',value)} options={Array.from({length:14},(_,i) => [String(i+9),`${i+9}h`])} />
      </FilterFieldGroup>
      <FilterFieldGroup label="Atendimento" icon={<Store />} description="Filial, tipo de atendimento, consultora e resultado da venda.">
        <Options label="Filial" value={filters.draft.unidadeId} onChange={value => filters.setField('unidadeId',value)} options={ [['','Todas as lojas disponíveis'],...(data?.unidades ?? []).map(unit => [unit.id,unit.nome] as [string,string])]} />
        <Options label="Tipo de atendimento" value={filters.draft.tipo} onChange={value => filters.setField('tipo',value)} options={[[ '','Todos'],['cliente','Cliente'],['nao_cliente','Não cliente']]} />
        <Options label="Consultora" value={filters.draft.consultora} onChange={value => filters.setField('consultora',value)} options={[[ '','Todas'],...(data?.consultoras ?? []).map(name => [name,name] as [string,string])]} />
        <Options label="Situação da venda" value={filters.draft.situacao} onChange={value => filters.setField('situacao',value)} options={[[ '','Todas'],['sim','Venda fechada'],['negociacao','Em negociação'],['nao','Venda perdida']]} />
      </FilterFieldGroup>
    </FilterPanel>
    {error && <Alert tone="danger" title="Falha na atualização">{error}{data && ' Os dados anteriores permanecem visíveis e podem estar desatualizados.'}</Alert>}
    {loading && <p role="status" className="flex items-center gap-2 text-sm"><Spinner />{data ? 'Atualizando dados…' : 'Carregando dados…'}</p>}
    {data && <>
      <div className="text-xs text-muted-foreground" aria-live="polite"><p>Pranchetas: {stamp(data.pranchetasAtualizadasEm)} · AlterVision: {stamp(data.externo.fetchedAt)}</p><p>Atualização automática a cada 5 minutos enquanto esta página estiver ativa. Horário de Brasília.</p></div>
      {data.externo.state !== 'ok' && <Alert tone="warning" title="Contagem AlterVision">{sourceLabels[data.externo.state]}{data.externo.retryAt && ` Nova tentativa após ${stamp(data.externo.retryAt)}.`}</Alert>}
      <FlowChart rows={data.porHora} onSelect={setSelection} />
      {selection && <Card><CardContent className="flex flex-wrap items-center justify-between gap-3 py-4"><p>Horário escolhido: <strong>{selection.label}</strong></p><Button onClick={applySelection} disabled={loading}>Ver este horário</Button></CardContent></Card>}
      <section aria-label="Entradas e Pranchetas por horário" className="space-y-3"><div className="flex items-center gap-3 border-b border-slate-200 pb-4 pt-3"><span className="rounded-xl bg-info/10 p-3 text-sky-700"><Clock3 className="size-5" /></span><div className="min-w-0 flex-1"><h2 className="text-xl font-bold">Entradas e Pranchetas por horário</h2><p className="mt-1 text-sm text-muted-foreground">Compare as entradas e as Pranchetas preenchidas em cada horário.</p></div><Badge tone="info">{data.porHora.length} faixas</Badge></div>
        <Button variant="secondary" className="min-h-11" aria-expanded={hourlyOpen} aria-controls="flow-hourly-audit" onClick={() => setHourlyOpen(!hourlyOpen)}>{hourlyOpen ? <ChevronUp /> : <ChevronDown />}<Search className="size-4" />{hourlyOpen ? 'Fechar detalhes por horário' : 'Ver detalhes por horário'}</Button>
        {hourlyOpen && <div id="flow-hourly-audit">
        <ResponsiveTable firstColumnSticky rows={data.porHora} rowKey={row => row.chave} columns={[
          {key:'hora',header:'Horário',render:row => row.label}, {key:'grupos',header:'Grupos AlterVision',render:row => value(row.grupos)}, {key:'clientes',header:'Clientes',render:row => row.clientes}, {key:'nao',header:'Não clientes',render:row => row.naoClientes}, {key:'total',header:'Pranchetas',render:row => row.total}, {key:'diferenca',header:'Diferença',render:row => <Difference number={row.diferenca} />}, {key:'estado',header:'Contagem',render:row => <Measurement coverage={row.cobertura} />},
        ]} renderMobileCard={row => <div className="space-y-3"><div className="flex items-center justify-between gap-2"><strong>{row.label}</strong><Measurement coverage={row.cobertura} /></div><div className="grid grid-cols-2 gap-2 text-sm"><p>Grupos: <strong>{value(row.grupos)}</strong></p><p>Pranchetas: <strong>{row.total}</strong></p><p className="text-sky-700">Clientes: {row.clientes}</p><p className="text-amber-800">Não clientes: {row.naoClientes}</p></div><div><Difference number={row.diferenca} /></div></div>} rowActions={row => <Button variant="secondary" size="sm" aria-label={`Ver atendimentos ${row.label}`} onClick={() => setSelection(row)}><Search className="size-4" />Ver atendimentos</Button>} />
        </div>}
      </section>
      <FlowAudit data={data} />
      <section aria-label="Atendimentos do período" className="space-y-3"><div className="flex items-center gap-3 border-b border-slate-200 pb-4 pt-3"><span className="rounded-xl bg-success/10 p-3 text-emerald-700"><ClipboardCheck className="size-5" /></span><div className="min-w-0 flex-1"><h2 className="text-xl font-bold">Atendimentos do período</h2><p className="mt-1 text-sm text-muted-foreground">Atendimentos concluídos que compõem os números acima.</p></div><Badge tone="success">{table?.total ?? 0} registros</Badge></div>
        {table?.total === 0 ? <EmptyState title="Nenhuma Prancheta concluída no período filtrado" description="Revise o período e os filtros aplicados." /> : <ResponsiveTable firstColumnSticky rows={table?.registros ?? []} rowKey={row => row.id} columns={[
          {key:'inicio',header:'Início / duração',render:row => <RecordTime row={row} />},
          {key:'filial',header:'Filial',render:row => row.filial},{key:'consultora',header:'Consultora',render:row => <span className="font-semibold tracking-wide">{row.consultora}</span>},{key:'tipo',header:'Tipo',render:row => <RecordType row={row} />},
          {key:'resultado',header:'Resultado / motivo',render:row => <RecordResult row={row} />},
        ]} renderMobileCard={recordContent} rowActions={row => <Button variant="secondary" size="sm" onClick={() => void original(row.id)}>Ver atendimento<ArrowRight className="size-4" /></Button>} />}
        {table && table.total > 0 && <div className="flex flex-wrap items-center justify-end gap-3"><span className="text-sm">Página {table.page} de {table.pages} · até 20 por página</span><Button variant="secondary" disabled={loading || table.page <= 1} onClick={() => void load(false,table.page-1,true)}>Anterior</Button><Button variant="secondary" disabled={loading || table.page >= table.pages} onClick={() => void load(false,table.page+1,true)}>Próxima</Button></div>}
      </section>

    </>}
    <DetalhesAtendimentoDialog open={detailOpen} onOpenChange={open => { setDetailOpen(open); if (!open) { detailFlight.current?.abort(); setDetail(null); setDetailSummary(null) } }} detalhe={detail} carregando={detailLoading} erro={detailError} resumoCarregamento={detailSummary} unidadeNome={detailSummary?.unidadeNome} leituraSomente />
  </PageContainer>
}
