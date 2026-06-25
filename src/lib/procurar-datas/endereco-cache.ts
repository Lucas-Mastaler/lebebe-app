import { createHash } from 'crypto'
import { createServiceClient } from '@/lib/supabase/service'
import type { EnderecoValidado, ValidarEnderecoRequest } from './contratos'

type GeoCacheRow = {
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
}

function normalizarTexto(valor: string | null | undefined): string {
  return String(valor ?? '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9,\-\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function termoLogradouroParaBusca(logradouro: string): string {
  return logradouro
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/^(av\.?|avenida|r\.?|rua|al\.?|alameda|trav\.?|travessa|rod\.?|rodovia|est\.?|estrada)\s+/i, '')
    .trim()
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

export async function buscarEnderecoNoGeoCache(form: ValidarEnderecoRequest): Promise<EnderecoValidado | null> {
  const hash = montarHashEnderecoLegado(form)
  const display = montarEnderecoDisplayProcurarDatas(form)
  const db = createServiceClient()

  const selectCols = 'chave_endereco,endereco_completo,logradouro,numero,bairro,cidade,uf,cep,lat,lng,provider,confidence'
  const porHash = await db.from('geo_cache').select(selectCols).eq('chave_endereco', hash).limit(1).maybeSingle()
  if (porHash.error) throw porHash.error
  if (porHash.data) return rowParaEnderecoValidado(porHash.data as GeoCacheRow, display)

  const logradouro = termoLogradouroParaBusca(String(form.logradouro ?? ''))
  const bairro = String(form.bairro ?? '').trim()
  const cidade = String(form.cidade ?? '').trim()
  const uf = String(form.uf ?? '').trim().toUpperCase()
  if (!logradouro || !bairro || !cidade || !uf) return null

  const porCampos = await db
    .from('geo_cache')
    .select(selectCols)
    .ilike('logradouro', `%${logradouro}%`)
    .ilike('bairro', `%${bairro}%`)
    .ilike('cidade', `%${cidade}%`)
    .eq('uf', uf)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (porCampos.error) throw porCampos.error
  return porCampos.data ? rowParaEnderecoValidado(porCampos.data as GeoCacheRow, display) : null
}
