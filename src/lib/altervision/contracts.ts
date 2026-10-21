export const STORE_IDS = { marechal: 1510, portao: 1546, bigorrilho: 1512 } as const
export const FLOW_TIMEZONE = 'America/Sao_Paulo'
export type FlowSource = 'hourly' | 'daily' | 'adjusted'
export type ExternalState = 'not_configured' | 'mapping_pending' | 'ok' | 'partial' | 'auth_error' | 'rate_limited' | 'timeout' | 'unavailable' | 'invalid_response'
export type HourCount = { storeId: number; day: string; hour: number; count: number }
export type DayCount = { storeId: number; day: string; count: number }
export type IdentifierResolution = { timezone: typeof FLOW_TIMEZONE } & Record<FlowSource, Record<string, number>>
export type ExternalFlow = {
  state: ExternalState
  hourly: HourCount[]
  daily: DayCount[]
  adjusted: DayCount[]
  fetchedAt: string | null
  warnings: string[]
  retryAt?: string
}
export class AltervisionError extends Error {
  constructor(public readonly state: ExternalState, public readonly retryAt?: string) {
    super('Falha na consulta AlterVision: ' + state)
  }
}
export function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}
export function validDay(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value
}
export function parseResolution(raw: string | undefined): IdentifierResolution | null {
  if (!raw?.trim()) return null
  let input: unknown
  try { input = JSON.parse(raw) } catch { throw new AltervisionError('mapping_pending') }
  if (!object(input) || input.timezone !== FLOW_TIMEZONE) throw new AltervisionError('mapping_pending')
  const output = { timezone: FLOW_TIMEZONE } as IdentifierResolution
  for (const source of ['hourly', 'daily', 'adjusted'] as const) {
    const map = input[source]
    if (!object(map)) throw new AltervisionError('mapping_pending')
    const seen = new Set<number>()
    output[source] = {}
    for (const [identifier, id] of Object.entries(map)) {
      if (!identifier.trim() || typeof id !== 'number' || !Object.values(STORE_IDS).some(value => value === id) || seen.has(id)) {
        throw new AltervisionError('mapping_pending')
      }
      seen.add(id)
      output[source][identifier] = id
    }
  }
  return output
}
function count(value: unknown): value is number { return typeof value === 'number' && Number.isInteger(value) && value >= 0 }
export function parseHourly(input: unknown, mapping: Record<string, number>) {
  if (!Array.isArray(input)) throw new AltervisionError('invalid_response')
  const rows: HourCount[] = []; let unknown = false
  const seen = new Set<string>()
  for (const row of input) {
    if (!object(row) || !validDay(row.day) || !Number.isInteger(row.hour) || Number(row.hour) < 0 || Number(row.hour) > 23
      || !count(row.count) || !['string', 'number'].includes(typeof row.store_identifier)) throw new AltervisionError('invalid_response')
    const storeId = Object.hasOwn(mapping, String(row.store_identifier)) ? mapping[String(row.store_identifier)] : undefined
    if (!storeId) { unknown = true; continue }
    const key = `${storeId}/${row.day}/${row.hour}`
    if (seen.has(key)) throw new AltervisionError('invalid_response')
    seen.add(key); rows.push({ storeId, day: row.day, hour: Number(row.hour), count: row.count })
  }
  return { rows, unknown }
}
export function parseDaily(input: unknown, mapping: Record<string, number>) {
  if (!object(input)) throw new AltervisionError('invalid_response')
  const rows: DayCount[] = []; let unknown = false
  for (const [day, stores] of Object.entries(input)) {
    if (!validDay(day) || !object(stores)) throw new AltervisionError('invalid_response')
    for (const [identifier, value] of Object.entries(stores)) {
      if (!count(value)) throw new AltervisionError('invalid_response')
      const storeId = Object.hasOwn(mapping, identifier) ? mapping[identifier] : undefined
      if (!storeId) { unknown = true; continue }
      rows.push({ storeId, day, count: value })
    }
  }
  return { rows, unknown }
}
