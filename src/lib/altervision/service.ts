import 'server-only'
import { createHash } from 'node:crypto'
import { unstable_cache, revalidateTag } from 'next/cache'
import { createAltervisionClient, parseStores } from './client'
import { AltervisionError, parseDaily, parseHourly, parseResolution, type ExternalFlow, type FlowSource } from './contracts'

export const EXTERNAL_TTL = 300
const active = new Map<string, Promise<unknown>>()
const cooldown = new Map<string, string>()
let concurrent = 0
const queue: Array<() => void> = []
async function limited<T>(operation: () => Promise<T>): Promise<T> {
  if (concurrent >= 2) await new Promise<void>(resolve => queue.push(resolve))
  else concurrent++
  try { return await operation() } finally { const next = queue.shift(); if (next) next(); else concurrent-- }
}
async function single<T>(key: string, operation: () => Promise<T>): Promise<T> {
  const existing = active.get(key)
  if (existing) return existing as Promise<T>
  const promise = operation(); active.set(key, promise)
  try { return await promise } finally { active.delete(key) }
}
export function dateChunks(begin: string, end: string) {
  const chunks: Array<[string, string]> = []
  for (let day = begin; day <= end;) {
    const last = new Date(`${day}T12:00:00Z`); last.setUTCDate(last.getUTCDate() + 6)
    const chunkEnd = last.toISOString().slice(0, 10) < end ? last.toISOString().slice(0, 10) : end
    chunks.push([day, chunkEnd]); const next = new Date(`${chunkEnd}T12:00:00Z`); next.setUTCDate(next.getUTCDate() + 1); day = next.toISOString().slice(0, 10)
  }
  return chunks
}
export async function getExternalFlow(begin: string, end: string, force = false): Promise<ExternalFlow> {
  const empty: ExternalFlow = { state: 'not_configured', hourly: [], daily: [], adjusted: [], fetchedAt: null, warnings: [] }
  const token = process.env.ALTERVISION_BASIC_AUTH_TOKEN
  if (!token?.trim()) return empty
  let resolution
  try { resolution = parseResolution(process.env.ALTERVISION_STORE_IDENTIFIERS_JSON) } catch { return { ...empty, state: 'mapping_pending' } }
  if (!resolution || !Object.keys(resolution.hourly).length) return { ...empty, state: 'mapping_pending' }
  const account = createHash('sha256').update(token).digest('hex').slice(0, 24)
  const contract = createHash('sha256').update(JSON.stringify(resolution)).digest('hex').slice(0, 16)
  const retryAt = cooldown.get(account)
  if (retryAt && Date.parse(retryAt) > Date.now()) return { ...empty, state: 'rate_limited', retryAt }
  const rest = createAltervisionClient(token)
  const controller = new AbortController(); const deadline = setTimeout(() => controller.abort(), 25000)
  const tasks: Array<Promise<{ source: FlowSource; rows: ReturnType<typeof parseHourly>['rows'] | ReturnType<typeof parseDaily>['rows']; unknown: boolean; fetchedAt: string }>> = []
  try {
    // getStores proves account membership, never the meaning of store_identifier.
    const stores = await single(`stores-${account}`, () => unstable_cache(async () => limited(async () => parseStores(await rest('stores', begin, end, controller.signal))), ['altervision-stores-v1', account], { revalidate: EXTERNAL_TTL })())
    const configuredStores = [...Object.values(resolution.hourly), ...Object.values(resolution.daily), ...Object.values(resolution.adjusted)]
    if (configuredStores.some(id => !stores.includes(id))) return { ...empty, state: 'mapping_pending' }
    for (const [from, to] of dateChunks(begin, end)) {
      for (const source of ['hourly', 'daily', 'adjusted'] as const) {
        const key = `av-v1-${account}-${contract}-${source}-${from}-${to}`
        const mapping = resolution[source]
        if (!Object.keys(mapping).length) continue
        if (force) revalidateTag(key, { expire: 0 })
        tasks.push(single(key, () => unstable_cache(async () => limited(async () => {
          if (controller.signal.aborted) throw new AltervisionError('timeout')
          const pendingRetry = cooldown.get(account)
          if (pendingRetry && Date.parse(pendingRetry) > Date.now()) throw new AltervisionError('rate_limited', pendingRetry)
          try {
            const raw = await rest(source, from, to, controller.signal)
            const parsed = source === 'hourly' ? parseHourly(raw, mapping) : parseDaily(raw, mapping)
            if (parsed.rows.some(row => row.day < from || row.day > to)) throw new AltervisionError('invalid_response')
            return { source, ...parsed, fetchedAt: new Date().toISOString() }
          } catch (error) {
            if (error instanceof AltervisionError && error.retryAt) cooldown.set(account, error.retryAt)
            throw error
          }
        }), [key], { revalidate: EXTERNAL_TTL, tags: [key] })()))
      }
    }
    const results = await Promise.allSettled(tasks)
    const output: ExternalFlow = { ...empty, state: 'ok', warnings: ['Disponibilidade dos dispositivos não confirmada.'] }
    if (!Object.keys(resolution.daily).length) output.warnings.push('Total diário medido ainda não mapeado; reconciliação indisponível.')
    if (!Object.keys(resolution.adjusted).length) output.warnings.push('Fluxo ajustado diário ainda não mapeado.')
    let failures = 0
    for (const result of results) {
      if (result.status === 'rejected') {
        failures++; const error = result.reason
        output.state = error instanceof AltervisionError ? error.state : 'unavailable'
        if (error instanceof AltervisionError && error.retryAt) output.retryAt = error.retryAt
        continue
      }
      const { source, rows, unknown, fetchedAt } = result.value
      if (source === 'hourly') output.hourly.push(...rows as ExternalFlow['hourly'])
      else output[source].push(...rows as ExternalFlow['daily'])
      if (unknown) output.warnings.push('Identificadores externos não reconhecidos foram ignorados; cobertura não confirmada.')
      if (!output.fetchedAt || fetchedAt < output.fetchedAt) output.fetchedAt = fetchedAt
    }
    if (failures && failures < results.length) output.state = 'partial'
    if (output.warnings.some(warning => warning.startsWith('Identificadores externos')) && output.state === 'ok') output.state = 'partial'
    if (output.fetchedAt && Date.now() - Date.parse(output.fetchedAt) > EXTERNAL_TTL * 1000) {
      output.state = 'partial'; output.warnings.push('Medição em cache desatualizada; atualização pendente.')
    }
    output.warnings = [...new Set(output.warnings)]
    return output
  } catch (error) {
    if (error instanceof AltervisionError && error.retryAt) cooldown.set(account, error.retryAt)
    return { ...empty, state: error instanceof AltervisionError ? error.state : 'unavailable', retryAt: error instanceof AltervisionError ? error.retryAt : undefined }
  } finally { clearTimeout(deadline) }
}
