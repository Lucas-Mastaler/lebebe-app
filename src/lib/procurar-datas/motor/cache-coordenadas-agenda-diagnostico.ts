import { createHash } from 'crypto'
import { createServiceClient } from '@/lib/supabase/service'
import {
  extrairEnderecoAgendaShAgV2,
  normalizarChaveEnderecoAgendaV2,
  type LinhaAgendaShAgV2,
} from './parse-agenda-shag'
import type { ValidarEnderecoRequest } from '../contratos'

type Coordenada = { lat: number; lng: number }

type GeoCacheRow = {
  chave_endereco: string | null
  lat: string | number | null
  lng: string | number | null
}

export type ResolverCacheCoordenadasAgendaDiagnosticoInput = {
  linhasAgenda: LinhaAgendaShAgV2[]
  cacheInjetado?: Record<string, Coordenada>
  supabaseTable?: string | null
}

export type ResolverCacheCoordenadasAgendaDiagnosticoOutput = {
  cacheCoordenadasPorEndereco: Record<string, Coordenada>
  hashesConsultados: number
  hitsSupabase: number
  enderecosSemHash: number
  avisos: string[]
}

type EnderecoParaCache = {
  endereco: string
  chaveParser: string
  hashLegado: string
}

export function montarFormGeoCachePorEnderecoAgenda(endereco: string): ValidarEnderecoRequest | null {
  let texto = endereco.replace(/\n/g, ', ').replace(/\s+/g, ' ').replace(/,+/g, ',').trim()
  if (texto.toUpperCase().startsWith('ENDERECO:')) texto = texto.substring(9).trim()

  const cepMatch = texto.match(/\b(\d{5})-?(\d{3})\b/)
  const cep = cepMatch ? `${cepMatch[1]}${cepMatch[2]}` : ''
  if (cepMatch) texto = texto.replace(cepMatch[0], '').replace(/[,\-\s]+$/, '').trim()

  let cidade = ''
  let uf = ''
  const cidadeUfMatch = texto.match(/,\s*([^,]+?)\s*-\s*([A-Za-z]{2})\s*$/)
  if (cidadeUfMatch) {
    cidade = cidadeUfMatch[1].trim()
    uf = cidadeUfMatch[2].trim().toUpperCase()
    texto = texto.substring(0, texto.length - cidadeUfMatch[0].length).replace(/[,\-\s]+$/, '').trim()
  }

  const partes = texto.split(/\s*,\s*/).map((parte) => parte.trim()).filter(Boolean)
  if (!cidade && partes.length >= 4) {
    const possivelCidade = partes.pop()
    cidade = possivelCidade ?? ''
  }
  if (!uf) uf = 'PR'

  const logradouro = partes[0] ?? ''
  const numero = partes[1] ?? ''
  const bairro = partes[2] ?? ''

  if (!logradouro || !numero || !bairro || !cidade || uf.length !== 2) return null

  return {
    logradouro,
    numero,
    bairro,
    cidade,
    uf,
    cep,
  }
}

function coordenadaValida(input: unknown): input is Coordenada {
  if (!input || typeof input !== 'object') return false
  const p = input as Record<string, unknown>
  return (
    typeof p.lat === 'number' &&
    Number.isFinite(p.lat) &&
    typeof p.lng === 'number' &&
    Number.isFinite(p.lng)
  )
}

function limparParteEndereco(parte: string): string {
  return parte.replace(/^[\-,\s]+/, '').replace(/[,\-\s]+$/, '').trim()
}

function montarFormLegadoPorEndereco(endereco: string): {
  logradouro: string
  bairro: string
  cidade: string
  uf: string
} | null {
  let addr = endereco.replace(/\n/g, ', ').replace(/\s+/g, ' ').replace(/,+/g, ',').trim()
  if (addr.toUpperCase().startsWith('ENDERECO:')) addr = addr.substring(9).trim()
  addr = addr.replace(/,?\s*\b\d{5}-?\d{3}\b/, '').trim()
  addr = addr.replace(/\bPARAN[ÁA]\b/i, '').trim()
  addr = addr.replace(/[,\-\s]+$/, '').trim()

  let uf = 'PR'
  const ufMatch = addr.match(/[,\-]\s*([A-Za-z]{2})\s*$/)
  if (ufMatch) {
    uf = ufMatch[1].toUpperCase()
    addr = addr.substring(0, addr.length - ufMatch[0].length).replace(/[,\-\s]+$/, '').trim()
  }

  const partes = addr.split(/\s*,\s*/).map(limparParteEndereco).filter(Boolean)
  if (partes.length === 0) return null

  let cidade = 'Curitiba'
  let bairro = ''
  const ultimaParte = partes[partes.length - 1]
  if (ultimaParte && !/^\d+[A-Za-z]?(?:\s*-.*)?$/.test(ultimaParte)) {
    cidade = ultimaParte
  }
  if (partes.length >= 3) {
    bairro = partes[partes.length - 2]
  }

  const logradouro = limparParteEndereco(partes[0] ?? '')
  if (logradouro.length < 3 || cidade.length < 3 || uf.length !== 2) return null

  return {
    logradouro,
    bairro: limparParteEndereco(bairro),
    cidade: limparParteEndereco(cidade),
    uf,
  }
}

function normalizarEnderecoParaCacheLegado(form: {
  logradouro: string
  bairro: string
  cidade: string
  uf: string
}): string {
  const partes: string[] = []
  const logradouro = String(form.logradouro || '').trim().replace(/\s+/g, ' ')
  const bairro = String(form.bairro || '').trim()
  const cidade = String(form.cidade || '').trim()
  const uf = String(form.uf || '').trim().toUpperCase()

  if (logradouro) partes.push(logradouro)
  if (bairro) partes.push(bairro)
  if (cidade && uf) partes.push(`${cidade} - ${uf}`)
  else if (cidade) partes.push(cidade)
  else if (uf) partes.push(uf)
  partes.push('BRASIL')

  return partes
    .join(', ')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9,\-\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function hashEnderecoLegado(enderecoNormalizado: string): string {
  return createHash('sha1').update(enderecoNormalizado).digest('hex')
}

function montarEnderecosParaCache(linhasAgenda: LinhaAgendaShAgV2[]): {
  enderecos: EnderecoParaCache[]
  enderecosSemHash: number
} {
  const porChaveParser = new Map<string, EnderecoParaCache>()
  let enderecosSemHash = 0

  for (const linha of linhasAgenda) {
    const extracao = extrairEnderecoAgendaShAgV2(linha)
    if (!extracao) continue

    const form = montarFormLegadoPorEndereco(extracao.endereco)
    if (!form) {
      enderecosSemHash++
      continue
    }

    const chaveParser = normalizarChaveEnderecoAgendaV2(extracao.endereco)
    if (porChaveParser.has(chaveParser)) continue

    porChaveParser.set(chaveParser, {
      endereco: extracao.endereco,
      chaveParser,
      hashLegado: hashEnderecoLegado(normalizarEnderecoParaCacheLegado(form)),
    })
  }

  return {
    enderecos: [...porChaveParser.values()],
    enderecosSemHash,
  }
}

export async function resolverCacheCoordenadasAgendaDiagnostico(
  input: ResolverCacheCoordenadasAgendaDiagnosticoInput
): Promise<ResolverCacheCoordenadasAgendaDiagnosticoOutput> {
  const cacheCoordenadasPorEndereco: Record<string, Coordenada> = {
    ...(input.cacheInjetado ?? {}),
  }
  const avisos: string[] = []
  const { enderecos, enderecosSemHash } = montarEnderecosParaCache(input.linhasAgenda)
  const faltantes = enderecos.filter((e) => !coordenadaValida(cacheCoordenadasPorEndereco[e.chaveParser]))

  if (enderecosSemHash > 0) {
    avisos.push(`${enderecosSemHash} endereco(s) da agenda sem dados minimos para chave de cache Supabase.`)
  }
  if (faltantes.length === 0) {
    return {
      cacheCoordenadasPorEndereco,
      hashesConsultados: 0,
      hitsSupabase: 0,
      enderecosSemHash,
      avisos,
    }
  }

  const supabaseTable = input.supabaseTable?.trim()
  if (!supabaseTable) {
    avisos.push('SUPABASE_TABLE ausente; cache de coordenadas da agenda real nao foi enriquecido.')
    return {
      cacheCoordenadasPorEndereco,
      hashesConsultados: 0,
      hitsSupabase: 0,
      enderecosSemHash,
      avisos,
    }
  }

  const hashParaEnderecos = new Map<string, EnderecoParaCache[]>()
  for (const endereco of faltantes) {
    const enderecosDoHash = hashParaEnderecos.get(endereco.hashLegado) ?? []
    enderecosDoHash.push(endereco)
    hashParaEnderecos.set(endereco.hashLegado, enderecosDoHash)
  }
  const { data, error } = await createServiceClient()
    .from(supabaseTable)
    .select('chave_endereco,lat,lng')
    .in('chave_endereco', [...hashParaEnderecos.keys()])

  if (error) {
    avisos.push(`Erro ao consultar cache Supabase de coordenadas da agenda: ${error.message}`)
    return {
      cacheCoordenadasPorEndereco,
      hashesConsultados: hashParaEnderecos.size,
      hitsSupabase: 0,
      enderecosSemHash,
      avisos,
    }
  }

  let hitsSupabase = 0
  for (const row of (data ?? []) as GeoCacheRow[]) {
    if (!row.chave_endereco) continue
    const enderecos = hashParaEnderecos.get(row.chave_endereco)
    if (!enderecos || enderecos.length === 0) continue

    const lat = Number(row.lat)
    const lng = Number(row.lng)
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue

    for (const endereco of enderecos) {
      cacheCoordenadasPorEndereco[endereco.chaveParser] = { lat, lng }
    }
    hitsSupabase++
  }

  if (hitsSupabase > 0) {
    avisos.push(`Cache Supabase de coordenadas da agenda: ${hitsSupabase}/${hashParaEnderecos.size} hit(s).`)
  }
  if (hitsSupabase < hashParaEnderecos.size) {
    avisos.push(`Cache Supabase de coordenadas da agenda: ${hashParaEnderecos.size - hitsSupabase} endereco(s) sem hit.`)
  }

  return {
    cacheCoordenadasPorEndereco,
    hashesConsultados: hashParaEnderecos.size,
    hitsSupabase,
    enderecosSemHash,
    avisos,
  }
}
