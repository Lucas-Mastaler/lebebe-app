'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Eye, Search, MapPin, Settings, ListChecks, CalendarCheck, CheckCircle2, AlertCircle, Cpu, Hash } from 'lucide-react'
import { formatarDataBrasileira, formatarDiasAteData, extrairResumoPreAgendamento } from '@/lib/procurar-datas/formatar-apresentacao'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  PageContainer,
  PageHeader,
  FilterPanel,
  FilterFieldGroup,
  useFilterState,
  FormField,
  DateField,
  Input,
  Button,
  Card,
  CardContent,
  Section,
  Badge,
  Alert,
  ResponsiveTable,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogBody,
} from '@/components/design-system'
import { parseBrDate, dateToIso, dateToBr } from '@/lib/design-system/dates'

type PreAgendamentoResumo = {
  id: string
  createdAt: string
  dataPreAgendada: string | null
  tipoResultado: string | null
  status: string
  erroMensagem: string | null
}

type AuditoriaItem = {
  id: string
  createdAt: string
  usuarioEmail: string
  cep: string | null
  numeroResidencia: string | null
  logradouro: string | null
  bairro: string | null
  cidade: string | null
  uf: string | null
  tempoNecessario: string | null
  valorInicialMinimo: number | null
  fretesResultados: string[]
  resultadosQuantidade: number
  status: string
  duracaoMs: number | null
  preAgendamento: PreAgendamentoResumo | null
  preAgendamentosQuantidade: number
}

type PesquisaDetalhe = {
  id: string
  created_at: string
  usuario_id: string | null
  usuario_email: string
  client_token: string | null
  run_id: string | null
  motor_versao: string
  origem: string
  cep: string | null
  numero_residencia: string | null
  logradouro: string | null
  bairro: string | null
  cidade: string | null
  uf: string | null
  endereco_completo: string | null
  latitude: number | string | null
  longitude: number | string | null
  parametros_json: Record<string, unknown>
  resultados_json: unknown
  status: string
  erro_mensagem: string | null
  duracao_ms: number | null
  started_at: string | null
  finished_at: string | null
}

type PreAgendamentoDetalhe = {
  id: string
  created_at: string
  pesquisa_auditoria_id: string | null
  usuario_id: string | null
  usuario_email: string
  client_token: string | null
  run_id: string | null
  data_pre_agendada: string | null
  tipo_resultado: string | null
  resultado_escolhido_json: unknown
  payload_pre_agendamento_json: unknown
  status: string
  erro_mensagem: string | null
}

type ListagemResponse = {
  ok: true
  items: AuditoriaItem[]
  total: number
  page: number
  limit: number
}

type DetalheResponse = {
  ok: true
  pesquisa: PesquisaDetalhe
  preAgendamentos: PreAgendamentoDetalhe[]
}

/**
 * Datas ficam em exibição `dd/mm/aaaa` (mesma convenção do `DateField`
 * oficial, DAT=A) — a conversão para `YYYY-MM-DD` (formato exigido pela
 * API `/api/procurar-datas/auditoria`) acontece só no momento do fetch,
 * mesmo padrão já usado em `/pos-venda/importar-nfe` e
 * `/procurar-datas/performance`.
 */
type Filtros = {
  dataInicial: string
  dataFinal: string
  email: string
  cep: string
  cidade: string
  uf: string
  status: string
  tevePreAgendamento: string
  dataPreAgendada: string
  rua: string
}

const LIMIT = 20
const DATE_FIELDS = ['dataInicial', 'dataFinal', 'dataPreAgendada'] as const

function filtrosIniciais(): Filtros {
  const hoje = new Date()
  const inicio = new Date()
  inicio.setDate(hoje.getDate() - 7)

  return {
    dataInicial: dateToBr(inicio),
    dataFinal: dateToBr(hoje),
    email: '',
    cep: '',
    cidade: '',
    uf: '',
    status: '',
    tevePreAgendamento: 'todos',
    dataPreAgendada: '',
    rua: '',
  }
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'America/Sao_Paulo',
  }).format(date)
}

function formatDate(value: string | null | undefined) {
  if (!value) return '-'
  const date = new Date(`${value}T12:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' }).format(date)
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function asResultados(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.filter((item): item is Record<string, unknown> => item !== null && typeof item === 'object' && !Array.isArray(item))
    : []
}

function texto(value: unknown) {
  if (value === null || value === undefined || value === '') return '-'
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function formatValorInicialMinimo(value: unknown): string {
  if (value === null || value === undefined || value === '') return '-'
  if (typeof value === 'number') {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
  }
  if (typeof value === 'string') {
    const num = Number(value)
    if (!Number.isNaN(num)) {
      return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(num)
    }
    return value
  }
  return '-'
}

/** Converte um filtro de data (`dd/mm/aaaa`) para `YYYY-MM-DD`; ignora valor incompleto/inválido. */
function paramData(display: string): string | null {
  if (!display) return null
  const parsed = parseBrDate(display)
  return parsed ? dateToIso(parsed) : null
}

function montarParams(pagina: number, filtrosAtuais: Filtros): URLSearchParams {
  const params = new URLSearchParams()
  params.set('page', String(pagina))
  params.set('limit', String(LIMIT))

  for (const campo of DATE_FIELDS) {
    const iso = paramData(filtrosAtuais[campo])
    if (iso) params.set(campo, iso)
  }

  Object.entries(filtrosAtuais).forEach(([key, value]) => {
    if ((DATE_FIELDS as readonly string[]).includes(key)) return
    if (value && value !== 'todos') params.set(key, value)
  })

  return params
}

function Campo({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="rounded-lg border border-slate-100 bg-white px-3 py-2">
      <dt className="text-xs font-medium uppercase text-slate-500">{label}</dt>
      <dd className="mt-1 break-words text-sm text-slate-900">{texto(value)}</dd>
    </div>
  )
}

function JsonResumo({ value }: { value: unknown }) {
  const record = asRecord(value)
  const entries = Object.entries(record).slice(0, 12)

  if (entries.length === 0) {
    return <p className="text-sm text-slate-500">Sem dados resumidos.</p>
  }

  return (
    <dl className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {entries.map(([key, val]) => (
        <Campo key={key} label={key} value={val} />
      ))}
    </dl>
  )
}

function PreAgendamentoResumo({ payload }: { payload: unknown }) {
  const resumo = extrairResumoPreAgendamento(payload)

  if (!resumo) {
    return (
      <div className="rounded-lg border border-slate-100 bg-white p-3">
        <p className="mb-2 text-xs text-slate-400">Formato inesperado — exibindo JSON bruto:</p>
        <pre className="overflow-x-auto rounded-md bg-slate-50 p-2 text-xs text-slate-600">{JSON.stringify(payload, null, 2)}</pre>
      </div>
    )
  }

  return (
    <dl className="grid grid-cols-1 gap-3 md:grid-cols-2">
      <Campo label="Equipe" value={resumo.equipe} />
      <Campo label="Tipo" value={resumo.tipo} />
      <Campo label="Frete" value={resumo.frete} />
      <Campo label="Data escolhida" value={resumo.dataEscolhida} />
      <Campo label="CEP" value={resumo.cep} />
      <Campo label="Região/label" value={resumo.regiaoLabel} />
      <Campo label="Tempo necessário" value={resumo.tempoNecessario} />
      <Campo label="Endereço" value={resumo.endereco} />
      <Campo label="Autoria" value={resumo.autoriaEmail !== '-' ? resumo.autoriaEmail : '-'} />
    </dl>
  )
}

export default function PageClient() {
  const filtros = useFilterState<Filtros>(filtrosIniciais())
  const [items, setItems] = useState<AuditoriaItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [detalhe, setDetalhe] = useState<DetalheResponse | null>(null)
  const [detalheLoading, setDetalheLoading] = useState(false)
  const [detalheOpen, setDetalheOpen] = useState(false)

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / LIMIT)), [total])

  const carregar = useCallback(async (pagina: number, filtrosAtuais: Filtros) => {
    setLoading(true)
    setError(null)

    const params = montarParams(pagina, filtrosAtuais)

    try {
      const res = await fetch(`/api/procurar-datas/auditoria?${params.toString()}`)
      if (!res.ok) throw new Error(`Erro ${res.status}`)
      const data = await res.json() as ListagemResponse
      setItems(data.items)
      setTotal(data.total)
      setPage(data.page)
    } catch (err) {
      setItems([])
      setTotal(0)
      setError(err instanceof Error ? err.message : 'Erro ao consultar auditoria')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    carregar(1, filtros.applied)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function abrirDetalhe(id: string) {
    setDetalheOpen(true)
    setDetalhe(null)
    setDetalheLoading(true)

    try {
      const res = await fetch(`/api/procurar-datas/auditoria?id=${encodeURIComponent(id)}`)
      if (!res.ok) throw new Error(`Erro ${res.status}`)
      const data = await res.json() as DetalheResponse
      setDetalhe(data)
    } catch {
      setDetalhe(null)
    } finally {
      setDetalheLoading(false)
    }
  }

  const ruaDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function pesquisar() {
    filtros.apply()
    carregar(1, filtros.draft)
  }

  function limpar() {
    const novos = filtrosIniciais()
    filtros.clear()
    carregar(1, novos)
  }

  /** Rua pesquisada preserva a busca ao vivo (debounce 250ms) já existente antes da migração — os demais campos continuam manuais (FLT-EXEC=MANUAL). */
  function alterarRua(value: string) {
    filtros.setField('rua', value)
    if (ruaDebounceRef.current) clearTimeout(ruaDebounceRef.current)
    ruaDebounceRef.current = setTimeout(() => {
      const atualizados = { ...filtros.draft, rua: value }
      filtros.apply()
      carregar(1, atualizados)
    }, 250)
  }

  return (
    <PageContainer>
      <PageHeader
        icon={<Search className="size-6" />}
        eyebrow="Procurar datas"
        title="Auditoria Procurar Datas"
        description="Consulta operacional read-only de pesquisas e pré-agendamentos."
      />

      <div className="mt-6">
        <FilterPanel dirty={filtros.dirty} onApply={pesquisar} onClear={limpar}>
          <FilterFieldGroup label="Período">
            <FormField id="filtro-data-inicial" label="Data inicial">
              {(f) => <DateField {...f} value={filtros.draft.dataInicial} onChange={(v) => filtros.setField('dataInicial', v)} />}
            </FormField>
            <FormField id="filtro-data-final" label="Data final">
              {(f) => <DateField {...f} value={filtros.draft.dataFinal} onChange={(v) => filtros.setField('dataFinal', v)} />}
            </FormField>
          </FilterFieldGroup>

          <FilterFieldGroup label="Busca">
            <FormField id="filtro-email" label="Usuário/email">
              {(f) => <Input {...f} value={filtros.draft.email} onChange={(e) => filtros.setField('email', e.target.value)} placeholder="email" />}
            </FormField>
            <FormField id="filtro-cep" label="CEP">
              {(f) => <Input {...f} value={filtros.draft.cep} onChange={(e) => filtros.setField('cep', e.target.value)} placeholder="00000000" />}
            </FormField>
            <FormField id="filtro-cidade" label="Cidade">
              {(f) => <Input {...f} value={filtros.draft.cidade} onChange={(e) => filtros.setField('cidade', e.target.value)} placeholder="Cidade" />}
            </FormField>
            <FormField id="filtro-uf" label="UF">
              {(f) => (
                <Input
                  {...f}
                  value={filtros.draft.uf}
                  onChange={(e) => filtros.setField('uf', e.target.value.toUpperCase().slice(0, 2))}
                  placeholder="PR"
                />
              )}
            </FormField>
            <FormField id="filtro-rua" label="Rua pesquisada" helper="Busca automática ao digitar.">
              {(f) => <Input {...f} value={filtros.draft.rua} onChange={(e) => alterarRua(e.target.value)} placeholder="Ex: Rua Raul" />}
            </FormField>
          </FilterFieldGroup>

          <FilterFieldGroup label="Status e pré-agendamento">
            <FormField id="filtro-status" label="Status">
              {(f) => (
                <Select value={filtros.draft.status || 'TODOS'} onValueChange={(v) => filtros.setField('status', v === 'TODOS' ? '' : v)}>
                  <SelectTrigger id={f.id} className="w-full" aria-invalid={f['aria-invalid']}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TODOS">Todos</SelectItem>
                    <SelectItem value="success">success</SelectItem>
                    <SelectItem value="error">error</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </FormField>
            <FormField id="filtro-pre-agendamento" label="Pré-agendamento">
              {(f) => (
                <Select value={filtros.draft.tevePreAgendamento} onValueChange={(v) => filtros.setField('tevePreAgendamento', v)}>
                  <SelectTrigger id={f.id} className="w-full" aria-invalid={f['aria-invalid']}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="sim">Sim</SelectItem>
                    <SelectItem value="nao">Não</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </FormField>
            <FormField id="filtro-data-pre-agendada" label="Data pré-agendada">
              {(f) => <DateField {...f} value={filtros.draft.dataPreAgendada} onChange={(v) => filtros.setField('dataPreAgendada', v)} />}
            </FormField>
          </FilterFieldGroup>
        </FilterPanel>
      </div>

      {error && (
        <Alert tone="danger" className="mt-4">
          {error}
        </Alert>
      )}

      <div className="mt-6">
        <ResponsiveTable<AuditoriaItem>
          columns={[
            { key: 'dataHora', header: 'Data/hora', width: 'compact', render: (item) => formatDateTime(item.createdAt) },
            { key: 'usuario', header: 'Usuário', width: 'content', render: (item) => item.usuarioEmail },
            { key: 'cep', header: 'CEP', width: 'compact', render: (item) => item.cep ?? '-' },
            { key: 'numero', header: 'Número', width: 'compact', render: (item) => item.numeroResidencia ?? '-' },
            { key: 'rua', header: 'Rua pesquisada', width: 'wide', render: (item) => item.logradouro ?? '-' },
            { key: 'bairro', header: 'Bairro', width: 'compact', render: (item) => item.bairro ?? '-' },
            { key: 'cidadeUf', header: 'Cidade/UF', width: 'compact', render: (item) => `${item.cidade ?? '-'} / ${item.uf ?? '-'}` },
            { key: 'tempo', header: 'Tempo', width: 'compact', render: (item) => item.tempoNecessario ?? '-' },
            {
              key: 'valores',
              header: 'Valores',
              width: 'content',
              render: (item) => (item.fretesResultados.length > 0 ? item.fretesResultados.join(', ') : texto(item.valorInicialMinimo)),
            },
            { key: 'resultados', header: 'Resultados', width: 'compact', className: 'text-center', render: (item) => item.resultadosQuantidade },
            { key: 'status', header: 'Status', width: 'compact', render: (item) => item.status },
            {
              key: 'preAgendamento',
              header: 'Pré-agendamento',
              width: 'content',
              render: (item) =>
                item.preAgendamento
                  ? `${formatDate(item.preAgendamento.dataPreAgendada)} · ${item.preAgendamento.tipoResultado ?? '-'}`
                  : 'Não',
            },
          ]}
          rows={items}
          rowKey={(item) => item.id}
          firstColumnSticky
          loading={loading}
          emptyTitle="Nenhum registro encontrado."
          rowActions={(item) => (
            <Button variant="secondary" size="sm" onClick={() => abrirDetalhe(item.id)}>
              <Eye className="size-4" />
              Ver
            </Button>
          )}
          renderMobileCard={(item) => (
            <div className="space-y-1.5 text-sm">
              <p className="font-medium text-slate-800">{item.usuarioEmail}</p>
              <p className="text-xs text-slate-500">
                {formatDateTime(item.createdAt)} • {item.status}
              </p>
              <p className="text-xs text-slate-500">
                {item.cep ?? '-'}, {item.numeroResidencia ?? '-'} — {item.logradouro ?? '-'}
              </p>
              <p className="text-xs text-slate-500">{item.bairro ?? '-'} — {item.cidade ?? '-'}/{item.uf ?? '-'}</p>
              <p className="text-xs text-slate-500">
                {item.fretesResultados.length > 0 ? item.fretesResultados.join(', ') : texto(item.valorInicialMinimo)}
              </p>
              <p className="text-xs text-slate-500">
                Pré-agendamento:{' '}
                {item.preAgendamento
                  ? `${formatDate(item.preAgendamento.dataPreAgendada)} · ${item.preAgendamento.tipoResultado ?? '-'}`
                  : 'Não'}
              </p>
            </div>
          )}
        />

        <div className="mt-3 flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
          <span>{total} registros · Página {page} de {totalPages}</span>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={loading || page <= 1}
              onClick={() => carregar(page - 1, filtros.applied)}
            >
              Anterior
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={loading || page >= totalPages}
              onClick={() => carregar(page + 1, filtros.applied)}
            >
              Próxima
            </Button>
          </div>
        </div>
      </div>

      <Dialog open={detalheOpen} onOpenChange={setDetalheOpen}>
        <DialogContent className="!w-[94vw] !max-w-4xl">
          <DialogHeader title="Detalhe da pesquisa" description="Resumo visual dos dados operacionais salvos na auditoria da busca." />
          <DialogBody>
            {detalheLoading ? (
              <p className="text-sm text-slate-500">Carregando detalhe...</p>
            ) : detalhe?.pesquisa ? (
              <DetalhePesquisa detalhe={detalhe} />
            ) : (
              <p className="text-sm text-red-600">Não foi possível carregar o detalhe.</p>
            )}
          </DialogBody>
        </DialogContent>
      </Dialog>
    </PageContainer>
  )
}

function DetalhePesquisa({ detalhe }: { detalhe: DetalheResponse }) {
  const pesquisa = detalhe.pesquisa
  const parametros = asRecord(pesquisa.parametros_json)
  const resultados = asResultados(pesquisa.resultados_json)

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={pesquisa.status === 'success' ? 'success' : pesquisa.status === 'error' ? 'danger' : 'neutral'}>
          {pesquisa.status === 'success' ? <CheckCircle2 className="mr-1 inline size-3.5" /> : <AlertCircle className="mr-1 inline size-3.5" />}
          {pesquisa.status === 'success' ? 'Sucesso' : pesquisa.status === 'error' ? 'Erro' : pesquisa.status}
        </Badge>
        <Badge tone={pesquisa.motor_versao === 'v2' ? 'info' : 'neutral'}>
          <Cpu className="mr-1 inline size-3.5" />
          Motor {pesquisa.motor_versao}
        </Badge>
        {pesquisa.duracao_ms !== null && (
          <Badge tone="neutral">{(pesquisa.duracao_ms / 1000).toFixed(1)}s</Badge>
        )}
      </div>

      <Section title="Dados gerais" icon={<Hash className="size-4" />} tone="section-1">
        <dl className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <Campo label="ID da pesquisa" value={pesquisa.id} />
          <Campo label="Timestamp" value={formatDateTime(pesquisa.created_at)} />
          <Campo label="Usuário" value={pesquisa.usuario_email} />
          <Campo label="Client token" value={pesquisa.client_token} />
          <Campo label="Run ID" value={pesquisa.run_id} />
          <Campo label="Status" value={pesquisa.status} />
          <Campo label="Duração" value={pesquisa.duracao_ms ? `${(pesquisa.duracao_ms / 1000).toFixed(1)} s` : null} />
          <Campo label="Motor" value={pesquisa.motor_versao} />
          <Campo label="Origem" value={pesquisa.origem} />
        </dl>
      </Section>

      <Section title="Endereço" icon={<MapPin className="size-4" />} tone="section-2">
        <dl className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <Campo label="CEP" value={pesquisa.cep} />
          <Campo label="Número" value={pesquisa.numero_residencia} />
          <Campo label="Logradouro" value={pesquisa.logradouro} />
          <Campo label="Bairro" value={pesquisa.bairro} />
          <Campo label="Cidade" value={pesquisa.cidade} />
          <Campo label="UF" value={pesquisa.uf} />
          <Campo label="Endereço completo" value={pesquisa.endereco_completo} />
          <Campo label="Latitude" value={pesquisa.latitude} />
          <Campo label="Longitude" value={pesquisa.longitude} />
        </dl>
      </Section>

      <Section title="Parâmetros usados" icon={<Settings className="size-4" />} tone="section-3">
        <dl className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <Campo label="Data inicial" value={parametros.dataInicial} />
          <Campo label="Encomenda" value={parametros.encomenda} />
          <Campo label="Área rural" value={parametros.areaRural} />
          <Campo label="Condomínio" value={parametros.condominio} />
          <Campo label="Berço/cama" value={parametros.bercoCama} />
          <Campo label="Cômoda" value={parametros.comoda} />
          <Campo label="Roupeiro" value={parametros.roupeiro} />
          <Campo label="Poltrona" value={parametros.poltrona} />
          <Campo label="Painel" value={parametros.painel} />
          <Campo label="Tempo necessário" value={parametros.tempoNecessario} />
          <Campo label="Valor inicial mínimo" value={formatValorInicialMinimo(parametros.valorInicialMinimo)} />
        </dl>
      </Section>

      <Section title="Resultados exibidos" icon={<ListChecks className="size-4" />} tone="section-1">
        {resultados.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhum resultado salvo.</p>
        ) : (
          <ResponsiveTable
            columns={[
              { key: 'data', header: 'Data', width: 'compact', render: (r) => formatarDataBrasileira(r.date ?? r.dateISO ?? r.dateDM) },
              { key: 'dia', header: 'Dia', width: 'compact', render: (r) => texto(r.weekday) },
              { key: 'equipe', header: 'Equipe', width: 'compact', render: (r) => texto(r.team) },
              {
                key: 'tipo',
                header: 'Tipo',
                width: 'compact',
                render: (r) => <Badge tone="info">{texto(r.tipo)}</Badge>,
              },
              { key: 'frete', header: 'Frete/valor', width: 'content', render: (r) => texto(r.frete ?? r.valor) },
              {
                key: 'faltam',
                header: 'Faltam',
                width: 'compact',
                render: (r) => formatarDiasAteData(r.date ?? r.dateISO, pesquisa.created_at),
              },
              { key: 'encomenda', header: 'Encomenda', width: 'compact', render: (r) => texto(r.encomenda) },
              { key: 'rank', header: 'Rank', width: 'compact', className: 'text-center', render: (r) => texto(r.rank) },
            ]}
            rows={resultados}
            rowKey={(r) => `${texto(r.date)}-${texto(r.team)}-${texto(r.rank)}`}
            firstColumnSticky
            renderMobileCard={(r) => (
              <div className="space-y-1 text-sm">
                <p className="font-medium text-slate-800">{formatarDataBrasileira(r.date ?? r.dateISO ?? r.dateDM)} — {texto(r.weekday)}</p>
                <p className="text-xs text-slate-500">Equipe: {texto(r.team)} • Tipo: {texto(r.tipo)}</p>
                <p className="text-xs text-slate-500">Frete: {texto(r.frete ?? r.valor)} • Rank: {texto(r.rank)}</p>
              </div>
            )}
            emptyTitle="Nenhum resultado salvo."
          />
        )}
      </Section>

      <Section title="Pré-agendamento vinculado" icon={<CalendarCheck className="size-4" />} tone="section-2">
        {detalhe.preAgendamentos.length === 0 ? (
          <Alert tone="success">Sem pré-agendamento vinculado.</Alert>
        ) : (
          <div className="space-y-4">
            {detalhe.preAgendamentos.map((pre) => (
              <Card key={pre.id}>
                <CardContent>
                  <div className="mb-3 flex items-center gap-2">
                    <Badge tone={pre.status === 'done' || pre.status === 'success' ? 'success' : pre.status === 'error' ? 'danger' : 'warning'}>
                      {pre.status}
                    </Badge>
                    <span className="text-xs text-slate-400">{formatDateTime(pre.created_at)}</span>
                  </div>
                  <dl className="grid grid-cols-1 gap-3 md:grid-cols-4">
                    <Campo label="Data escolhida" value={formatDate(pre.data_pre_agendada)} />
                    <Campo label="Tipo" value={pre.tipo_resultado} />
                    <Campo label="Status" value={pre.status} />
                    <Campo label="Criado em" value={formatDateTime(pre.created_at)} />
                  </dl>
                  <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
                    <Section title="Resultado escolhido" variant="subsection">
                      <JsonResumo value={pre.resultado_escolhido_json} />
                    </Section>
                    <Section title="Payload resumido" variant="subsection">
                      <PreAgendamentoResumo payload={pre.payload_pre_agendamento_json} />
                    </Section>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </Section>
    </div>
  )
}
