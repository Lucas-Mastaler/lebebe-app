import { createHash } from 'crypto'
import { createServiceClient } from '@/lib/supabase/service'
import type { EnderecoValidado, ValidarEnderecoRequest } from './contratos'

export type GeoCacheRow = {
  chave_endereco: string
  endereco_completo: string | null
  logradouro: string | null
  numero: string | null
  bairro: string | null
  cidade: string | null
  uf: string | null
  cep: string | null
  lat: string | number
  lng: string | number
  provider: string | null
  confidence: string | number | null
  updated_at?: string | null
}

export type ResultadoBuscaGeoCache =
  | { status: 'hit'; resultado: EnderecoValidado; motivo: 'match_seguro' }
  | { status: 'miss'; motivo: string; candidatosAvaliados?: number; confidence?: number | null }

export type EntradaBuscaGeoCacheLote = {
  chave: string
  form: ValidarEnderecoRequest
}

export type ResultadoBuscaGeoCacheLote = {
  resultadosPorChave: Record<string, ResultadoBuscaGeoCache>
  candidatosPorChave: Record<string, GeoCacheRow[]>
  hashesConsultados: number
  chunks: number
  registrosRetornados: number
}

const SELECT_COLS =
  'chave_endereco,endereco_completo,logradouro,numero,bairro,cidade,uf,cep,lat,lng,provider,confidence,updated_at'

export const GEO_CACHE_CONFIDENCE_MINIMA_HIT_SEGURO = 0.7
export const GEO_CACHE_BATCH_HASH_CHUNK_SIZE = 100

export function normalizarTexto(valor: string | null | undefined): string {
  return String(valor ?? '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9,\-\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function normalizarNumeroEndereco(valor: string | null | undefined): string {
  return String(valor ?? '').replace(/\D/g, '')
}

export function normalizarCep(valor: string | null | undefined): string {
  return String(valor ?? '').replace(/\D/g, '')
}

export function termoLogradouroParaBusca(logradouro: string): string {
  return logradouro
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/^(av\.?|avenida|r\.?|rua|al\.?|alameda|trav\.?|travessa|rod\.?|rodovia|est\.?|estrada)\s+/i, '')
    .trim()
}

export function normalizarLogradouroParaComparacao(logradouro: string | null | undefined): string {
  return normalizarTexto(termoLogradouroParaBusca(String(logradouro ?? '')))
}

export function montarEnderecoDisplayProcurarDatas(form: ValidarEnderecoRequest): string {
  const logradouro = String(form.logradouro ?? '').trim().replace(/\s+/g, ' ')
  const numero = String(form.numero ?? '').trim()
  const bairro = String(form.bairro ?? '').trim()
  const cidade = String(form.cidade ?? '').trim()
  const uf = String(form.uf ?? '').trim().toUpperCase()

  const partes = [logradouro]
  if (numero) partes.push(numero)
  if (bairro) partes.push(bairro)
  if (cidade) partes.push(uf ? `${cidade} - ${uf}` : cidade)
  partes.push('Brasil')

  return partes.filter(Boolean).join(', ')
}

export function montarHashEnderecoLegado(form: ValidarEnderecoRequest): string {
  const logradouro = String(form.logradouro ?? '').trim().replace(/\s+/g, ' ')
  const bairro = String(form.bairro ?? '').trim()
  const cidade = String(form.cidade ?? '').trim()
  const uf = String(form.uf ?? '').trim().toUpperCase()

  const partes = []
  if (logradouro) partes.push(logradouro)
  if (bairro) partes.push(bairro)
  if (cidade && uf) partes.push(`${cidade} - ${uf}`)
  else if (cidade) partes.push(cidade)
  else if (uf) partes.push(uf)
  partes.push('BRASIL')

  return createHash('sha1').update(normalizarTexto(partes.join(', '))).digest('hex')
}

export function montarHashEnderecoComNumero(form: ValidarEnderecoRequest): string {
  return createHash('sha1').update(normalizarTexto(montarEnderecoDisplayProcurarDatas(form))).digest('hex')
}

function rowParaEnderecoValidado(row: GeoCacheRow, displayFallback: string): EnderecoValidado | null {
  const lat = Number(row.lat)
  const lng = Number(row.lng)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null

  const enderecoCompleto = row.endereco_completo || displayFallback
  return {
    ok: true,
    lat,
    lng,
    enderecoCompleto,
    display: enderecoCompleto,
    display_name: enderecoCompleto,
    cep: row.cep || '',
    provider: 'supabase',
    providerOriginal: row.provider || null,
    confidence: row.confidence == null ? 1 : Number(row.confidence),
    cache: 'geo_cache',
    chaveEndereco: row.chave_endereco,
    address: {
      road: row.logradouro || '',
      house_number: row.numero || '',
      suburb: row.bairro || '',
      city: row.cidade || '',
      state: row.uf || '',
      postcode: row.cep || '',
    },
  }
}

export function cacheRowCompativelComEndereco(row: GeoCacheRow, form: ValidarEnderecoRequest): boolean {
  const numeroForm = normalizarNumeroEndereco(form.numero)
  const numeroRow = normalizarNumeroEndereco(row.numero)
  if (!numeroForm || !numeroRow || numeroForm !== numeroRow) return false

  const logradouroForm = normalizarLogradouroParaComparacao(form.logradouro)
  const logradouroRow = normalizarLogradouroParaComparacao(row.logradouro)
  if (!logradouroForm || !logradouroRow || logradouroForm !== logradouroRow) return false

  const bairroForm = normalizarTexto(form.bairro)
  const bairroRow = normalizarTexto(row.bairro)
  if (!bairroForm || !bairroRow || bairroForm !== bairroRow) return false

  const cidadeForm = normalizarTexto(form.cidade)
  const cidadeRow = normalizarTexto(row.cidade)
  if (!cidadeForm || !cidadeRow || cidadeForm !== cidadeRow) return false

  const ufForm = normalizarTexto(form.uf)
  const ufRow = normalizarTexto(row.uf)
  if (!ufForm || !ufRow || ufForm !== ufRow) return false

  const cepForm = normalizarCep(form.cep)
  const cepRow = normalizarCep(row.cep)
  if (cepForm && cepRow && cepForm !== cepRow) return false

  return true
}

export function cacheRowConfidenceAceitavel(row: GeoCacheRow): boolean {
  if (row.confidence == null) return true
  const confidence = Number(row.confidence)
  if (!Number.isFinite(confidence)) return true
  return confidence >= GEO_CACHE_CONFIDENCE_MINIMA_HIT_SEGURO
}

function deduplicarRows(rows: GeoCacheRow[]): GeoCacheRow[] {
  const porChave = new Map<string, GeoCacheRow>()
  for (const row of rows) {
    if (!porChave.has(row.chave_endereco)) porChave.set(row.chave_endereco, row)
  }
  return [...porChave.values()]
}

function selecionarHitSeguro(rows: GeoCacheRow[], form: ValidarEnderecoRequest): GeoCacheRow | null {
  const compativeis = deduplicarRows(rows).filter((row) => (
    cacheRowCompativelComEndereco(row, form) &&
    cacheRowConfidenceAceitavel(row)
  ))
  if (compativeis.length !== 1) return null
  return compativeis[0]
}

function montarMissGeoCache(candidatos: GeoCacheRow[], form: ValidarEnderecoRequest): ResultadoBuscaGeoCache {
  const compativeis = deduplicarRows(candidatos).filter((row) => cacheRowCompativelComEndereco(row, form))
  const compativeisComConfidenceBaixa = compativeis.filter((row) => !cacheRowConfidenceAceitavel(row))
  const maiorConfidenceBaixa = compativeisComConfidenceBaixa.reduce<number | null>((maior, row) => {
    const confidence = Number(row.confidence)
    if (!Number.isFinite(confidence)) return maior
    return maior == null || confidence > maior ? confidence : maior
  }, null)
  return {
    status: 'miss',
    motivo: compativeisComConfidenceBaixa.length > 0 ? 'confidence_baixa' : compativeis.length > 1 ? 'cache_ambiguo' : 'sem_match_seguro',
    candidatosAvaliados: candidatos.length,
    confidence: maiorConfidenceBaixa,
  }
}

function selecionarResultadoGeoCache(candidatos: GeoCacheRow[], form: ValidarEnderecoRequest): ResultadoBuscaGeoCache {
  const display = montarEnderecoDisplayProcurarDatas(form)
  const hitSeguro = selecionarHitSeguro(candidatos, form)
  if (!hitSeguro) return montarMissGeoCache(candidatos, form)

  const resultado = rowParaEnderecoValidado(hitSeguro, display)
  if (!resultado) return { status: 'miss', motivo: 'coordenadas_invalidas', candidatosAvaliados: candidatos.length }
  return { status: 'hit', resultado, motivo: 'match_seguro' }
}

export async function buscarEnderecosNoGeoCacheEmLote(
  entradas: EntradaBuscaGeoCacheLote[],
  options: { chunkSize?: number } = {}
): Promise<ResultadoBuscaGeoCacheLote> {
  const entradasUnicas = new Map<string, EntradaBuscaGeoCacheLote>()
  for (const entrada of entradas) {
    if (!entradasUnicas.has(entrada.chave)) entradasUnicas.set(entrada.chave, entrada)
  }

  const chavesPorHash = new Map<string, Set<string>>()
  for (const entrada of entradasUnicas.values()) {
    const hashes = [...new Set([montarHashEnderecoComNumero(entrada.form), montarHashEnderecoLegado(entrada.form)])]
    for (const hash of hashes) {
      const chaves = chavesPorHash.get(hash) ?? new Set<string>()
      chaves.add(entrada.chave)
      chavesPorHash.set(hash, chaves)
    }
  }

  const hashes = [...chavesPorHash.keys()]
  const chunkSize = Math.max(1, Math.floor(options.chunkSize ?? GEO_CACHE_BATCH_HASH_CHUNK_SIZE))
  const db = createServiceClient()
  const rows: GeoCacheRow[] = []
  let chunks = 0

  for (let i = 0; i < hashes.length; i += chunkSize) {
    const chunk = hashes.slice(i, i + chunkSize)
    chunks++
    const response = await db.from('geo_cache').select(SELECT_COLS).in('chave_endereco', chunk)
    if (response.error) throw response.error
    rows.push(...((response.data ?? []) as GeoCacheRow[]))
  }

  const rowsPorChave: Record<string, GeoCacheRow[]> = {}
  for (const entrada of entradasUnicas.values()) rowsPorChave[entrada.chave] = []
  for (const row of rows) {
    const chaves = chavesPorHash.get(row.chave_endereco)
    if (!chaves) continue
    for (const chave of chaves) rowsPorChave[chave]?.push(row)
  }

  const resultadosPorChave: Record<string, ResultadoBuscaGeoCache> = {}
  for (const entrada of entradasUnicas.values()) {
    resultadosPorChave[entrada.chave] = selecionarResultadoGeoCache(rowsPorChave[entrada.chave] ?? [], entrada.form)
  }

  return {
    resultadosPorChave,
    candidatosPorChave: rowsPorChave,
    hashesConsultados: hashes.length,
    chunks,
    registrosRetornados: rows.length,
  }
}

export async function buscarEnderecoNoGeoCache(
  form: ValidarEnderecoRequest,
  options: { candidatosIniciais?: GeoCacheRow[]; pularConsultaHash?: boolean } = {}
): Promise<ResultadoBuscaGeoCache> {
  const hashes = [...new Set([montarHashEnderecoComNumero(form), montarHashEnderecoLegado(form)])]
  const db = createServiceClient()

  const candidatos: GeoCacheRow[] = [...(options.candidatosIniciais ?? [])]

  if (!options.pularConsultaHash) {
    const porHash = await db.from('geo_cache').select(SELECT_COLS).in('chave_endereco', hashes).limit(10)
    if (porHash.error) throw porHash.error
    candidatos.push(...((porHash.data ?? []) as GeoCacheRow[]))
  }

  const logradouro = termoLogradouroParaBusca(String(form.logradouro ?? ''))
  const bairro = String(form.bairro ?? '').trim()
  const cidade = String(form.cidade ?? '').trim()
  const uf = String(form.uf ?? '').trim().toUpperCase()
  const numero = String(form.numero ?? '').trim()
  if (!logradouro || !bairro || !cidade || !uf || !numero) {
    return { status: 'miss', motivo: 'payload_incompleto', candidatosAvaliados: candidatos.length }
  }

  const porCampos = await db
    .from('geo_cache')
    .select(SELECT_COLS)
    .ilike('logradouro', `%${logradouro}%`)
    .ilike('bairro', `%${bairro}%`)
    .ilike('cidade', `%${cidade}%`)
    .eq('uf', uf)
    .order('updated_at', { ascending: false })
    .limit(20)

  if (porCampos.error) throw porCampos.error
  candidatos.push(...((porCampos.data ?? []) as GeoCacheRow[]))

  return selecionarResultadoGeoCache(candidatos, form)
}

export async function salvarEnderecoNoGeoCache(
  form: ValidarEnderecoRequest,
  resultado: EnderecoValidado
): Promise<{ ok: true; chaveEndereco: string } | { ok: false; erro: string }> {
  const lat = Number(resultado.lat)
  const lng = Number(resultado.lng)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return { ok: false, erro: 'coordenadas_invalidas' }

  const db = createServiceClient()
  const chaveEndereco = montarHashEnderecoComNumero(form)
  const enderecoCompleto =
    String(resultado.enderecoCompleto ?? resultado.display_name ?? resultado.display ?? '').trim() ||
    montarEnderecoDisplayProcurarDatas(form)

  const { error } = await db.from('geo_cache').upsert(
    {
      chave_endereco: chaveEndereco,
      endereco_completo: enderecoCompleto,
      logradouro: String(form.logradouro ?? '').trim() || null,
      numero: String(form.numero ?? '').trim() || null,
      bairro: String(form.bairro ?? '').trim() || null,
      cidade: String(form.cidade ?? '').trim() || null,
      uf: String(form.uf ?? '').trim().toUpperCase() || null,
      cep: normalizarCep(form.cep) || normalizarCep(resultado.cep as string | undefined) || null,
      lat,
      lng,
      provider: String(resultado.provider ?? 'locationiq'),
      confidence: typeof resultado.confidence === 'number' ? resultado.confidence : null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'chave_endereco' }
  )

  if (error) return { ok: false, erro: error.message }
  return { ok: true, chaveEndereco }
}
