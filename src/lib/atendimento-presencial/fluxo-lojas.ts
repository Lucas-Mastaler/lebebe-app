import { FLOW_TIMEZONE, STORE_IDS, validDay, type ExternalFlow } from '@/lib/altervision/contracts'
import { normalizarNomeConsultora } from './ficha-schema'
import { consultoraDeHomologacao } from './registros'
import { TABLE_PAGE_SIZE } from '@/lib/design-system/pagination'

export type FlowUnit = { id: string; chave: string; nome: string }
export type FlowFilters = { de: string; ate: string; unidadeId: string; horaDe: number; horaAte: number; tipo: string; consultora: string; situacao: string }
export type FlowRow = { id: string; unidade_id: string; status: string; versao_fluxo: number | null; tipo_atendimento: string | null; cliente_id: string | null; iniciado_em: string; concluido_em: string | null; consultora_nome: string | null; resultado_atendimento: string | null; motivo_visita: string | null }
export type FlowRecord = { id: string; unidadeId: string; filial: string; iniciadoEm: string; concluidoEm: string | null; consultora: string; tipo: 'cliente' | 'nao_cliente'; resultado: string | null; motivo: string | null; duracaoMinutos: number | null; conclusaoOutroDia: boolean }
export type Comparison = { chave: string; label: string; unidadeId?: string; hora?: number; grupos: number | null; gruposObservados: number; clientes: number; naoClientes: number; total: number; diferenca: number | null; cobertura: 'complete' | 'partial' | 'missing'; horasComDado: number; horasEsperadas: number }
export type FlowDashboard = { filtros: FlowFilters; unidades: FlowUnit[]; consultoras: string[]; resumo: Comparison; porFilial: Comparison[]; porHora: Comparison[]; externo: Omit<ExternalFlow, 'hourly' | 'daily' | 'adjusted'>; diario: Array<{ dia: string; unidadeId: string; medido: number | null; ajustado: number | null; somaHoraria: number | null; divergente: boolean }>; avisos: string[]; pranchetasAtualizadasEm: string }

export function localParts(date: string | Date) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: FLOW_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(date))
  const get = (key: string) => parts.find(part => part.type === key)?.value ?? ''
  return { day: `${get('year')}-${get('month')}-${get('day')}`, hour: Number(get('hour')) }
}
export function daysBetween(begin: string, end: string) {
  const result: string[] = []
  for (let day = begin; day <= end;) { result.push(day); const next = new Date(`${day}T12:00:00Z`); next.setUTCDate(next.getUTCDate() + 1); day = next.toISOString().slice(0, 10) }
  return result
}
export function readFlowFilters(params: URLSearchParams, now = new Date()): FlowFilters {
  for (const key of ['de','ate','unidadeId','horaDe','horaAte','tipo','consultora','situacao','page']) {
    if (params.getAll(key).length > 1) throw new Error('Parâmetros de filtro repetidos.')
  }
  const today = localParts(now).day
  const de = params.get('de') || today; const ate = params.get('ate') || de
  if (!validDay(de) || !validDay(ate) || de > ate || (Date.parse(ate) - Date.parse(de)) / 86400000 > 30) throw new Error('Selecione um período válido de até 31 dias.')
  const horaDe = Number(params.get('horaDe') ?? 0); const horaAte = Number(params.get('horaAte') ?? 24)
  if (!Number.isInteger(horaDe) || !Number.isInteger(horaAte) || horaDe < 0 || horaAte > 24 || horaDe >= horaAte) throw new Error('Faixa horária inválida.')
  const tipo = params.get('tipo') ?? ''; const situacao = params.get('situacao') ?? ''
  if (!['', 'cliente', 'nao_cliente'].includes(tipo) || !['', 'sim', 'nao', 'negociacao'].includes(situacao)) throw new Error('Filtro de atendimento inválido.')
  return { de, ate, horaDe, horaAte, unidadeId: params.get('unidadeId') ?? '', tipo, situacao, consultora: normalizarNomeConsultora(params.get('consultora')) }
}
export function mappedUnits(units: FlowUnit[]) { return units.filter(unit => Object.hasOwn(STORE_IDS, unit.chave)) }
export function allowedUnits(perfil: string, all: FlowUnit[], linked: FlowUnit[]) {
  if (perfil === 'superadmin' || perfil === 'gestao') return mappedUnits(all)
  if (perfil === 'supervisora_loja') return mappedUnits(linked)
  return []
}
export function classify(row: FlowRow): FlowRecord['tipo'] | null {
  if (row.versao_fluxo === 2 && ['cliente', 'nao_cliente'].includes(row.tipo_atendimento ?? '')) return row.tipo_atendimento as FlowRecord['tipo']
  if (row.versao_fluxo == null && row.tipo_atendimento == null && row.cliente_id) return 'cliente'
  return null
}
export function selectRecords(rows: FlowRow[], units: FlowUnit[], filters: FlowFilters) {
  const selected: FlowRecord[] = []; let invalid = 0
  const byUnit = new Map(units.map(unit => [unit.id, unit]))
  for (const row of rows) {
    const unit = byUnit.get(row.unidade_id)
    if (!unit || row.status !== 'concluido' || consultoraDeHomologacao(row.consultora_nome)) continue
    const tipo = classify(row)
    if (!tipo || !Number.isFinite(Date.parse(row.iniciado_em))) { invalid++; continue }
    const started = localParts(row.iniciado_em)
    if (started.day < filters.de || started.day > filters.ate || started.hour < filters.horaDe || started.hour >= filters.horaAte
      || (filters.unidadeId && unit.id !== filters.unidadeId) || (filters.tipo && tipo !== filters.tipo)
      || (filters.consultora && normalizarNomeConsultora(row.consultora_nome) !== filters.consultora)
      || (filters.situacao && row.resultado_atendimento !== filters.situacao)) continue
    const finished = row.concluido_em && Number.isFinite(Date.parse(row.concluido_em)) ? row.concluido_em : null
    selected.push({ id: row.id, unidadeId: unit.id, filial: unit.nome, iniciadoEm: row.iniciado_em, concluidoEm: finished,
      consultora: normalizarNomeConsultora(row.consultora_nome) || 'Não informada', tipo, resultado: row.resultado_atendimento, motivo: row.motivo_visita,
      duracaoMinutos: finished ? Math.round((Date.parse(finished) - Date.parse(row.iniciado_em)) / 60000) : null,
      conclusaoOutroDia: Boolean(finished && localParts(finished).day !== started.day) })
  }
  selected.sort((a,b) => b.iniciadoEm.localeCompare(a.iniciadoEm) || b.id.localeCompare(a.id))
  return { selected, invalid }
}
export function pageRecords(records: FlowRecord[], requested: string | null) {
  const input = Number(requested ?? 1)
  if (!Number.isSafeInteger(input) || input < 1) throw new Error('Página inválida.')
  const total = records.length; const pages = Math.max(1, Math.ceil(total / TABLE_PAGE_SIZE)); const page = Math.min(input, pages)
  return { registros: records.slice((page - 1) * TABLE_PAGE_SIZE, page * TABLE_PAGE_SIZE), page, pageSize: TABLE_PAGE_SIZE, total, pages }
}
export function compare(records: FlowRecord[], units: FlowUnit[], filters: FlowFilters, external: ExternalFlow, now = new Date()): FlowDashboard {
  const scope = units.filter(unit => !filters.unidadeId || unit.id === filters.unidadeId)
  const days = daysBetween(filters.de, filters.ate)
  const today = localParts(now)
  const hours = new Map(external.hourly.map(row => [`${row.storeId}/${row.day}/${row.hour}`, row.count]))
  function metric(key: string, label: string, selectedUnits = scope, selectedHour?: number): Comparison {
    let observed = 0; let present = 0; let expected = 0
    for (const unit of selectedUnits) for (const day of days) for (let hour = filters.horaDe; hour < filters.horaAte; hour++) {
      if (selectedHour !== undefined && selectedHour !== hour) continue
      // Horas futuras não são falhas da câmera; a hora corrente ainda pode ser parcial.
      if (day > today.day || (day === today.day && hour > today.hour)) continue
      expected++
      const value = hours.get(`${STORE_IDS[unit.chave as keyof typeof STORE_IDS]}/${day}/${hour}`)
      if (value !== undefined) { present++; observed += value }
    }
    const rows = records.filter(row => selectedUnits.some(unit => unit.id === row.unidadeId) && (selectedHour === undefined || localParts(row.iniciadoEm).hour === selectedHour))
    const currentIncluded = days.includes(today.day) && filters.horaDe <= today.hour && filters.horaAte > today.hour && (selectedHour === undefined || selectedHour === today.hour)
    const mismatch = selectedUnits.some(unit => days.some(day => {
      const storeId = STORE_IDS[unit.chave as keyof typeof STORE_IDS]
      const daily = external.daily.find(row => row.storeId === storeId && row.day === day)
      const received = external.hourly.filter(row => row.storeId === storeId && row.day === day)
      return daily && received.length > 0 && daily.count !== received.reduce((sum,row) => sum + row.count,0)
    }))
    const complete = expected > 0 && present === expected && external.state === 'ok' && !currentIncluded && !mismatch
    const clientes = rows.filter(row => row.tipo === 'cliente').length
    return { chave: key, label, grupos: present ? observed : null, gruposObservados: observed, clientes, naoClientes: rows.length - clientes, total: rows.length,
      diferenca: complete ? observed - rows.length : null, cobertura: complete ? 'complete' : present ? 'partial' : 'missing', horasComDado: present, horasEsperadas: expected }
  }
  const diario = scope.flatMap(unit => days.map(dia => {
    const id = STORE_IDS[unit.chave as keyof typeof STORE_IDS]
    const observed = external.hourly.filter(row => row.storeId === id && row.day === dia)
    const medido = external.daily.find(row => row.storeId === id && row.day === dia)?.count ?? null
    const ajustado = external.adjusted.find(row => row.storeId === id && row.day === dia)?.count ?? null
    const somaHoraria = observed.length ? observed.reduce((sum,row) => sum + row.count,0) : null
    return { dia, unidadeId: unit.id, medido, ajustado, somaHoraria, divergente: medido !== null && somaHoraria !== null && medido !== somaHoraria }
  }))
  const avisoRecorte = Boolean(filters.tipo || filters.consultora || filters.situacao)
  const { hourly: _hourly, daily: _daily, adjusted: _adjusted, ...metadata } = external
  void _hourly; void _daily; void _adjusted
  return { filtros: filters, unidades: units, consultoras: [], resumo: metric('total', 'Total'),
    porFilial: scope.map(unit => ({ ...metric(unit.id, unit.nome, [unit]), unidadeId: unit.id })),
    porHora: Array.from({length: filters.horaAte - filters.horaDe}, (_,index) => { const hour = filters.horaDe + index; return { ...metric(String(hour), `${hour}h–${hour+1}h`, scope, hour), hora: hour } }),
    externo: metadata, diario, avisos: [ ...(avisoRecorte ? ['Comparação com Pranchetas filtradas; o fluxo inclui todos os grupos.'] : []),
      'O horário é o início do preenchimento; não comprova o instante de entrada na loja.',
      ...(records.some(row => row.conclusaoOutroDia) ? ['Há atendimentos concluídos em outro dia; consulte a duração nos registros.'] : []),
      ...(diario.some(row => row.divergente) ? ['Total diário medido diverge da soma das horas recebidas.'] : []) ], pranchetasAtualizadasEm: now.toISOString() }
}
