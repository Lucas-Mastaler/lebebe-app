import { buscarEnderecoNoGeoCache, salvarEnderecoNoGeoCache } from '../endereco-cache'
import { buscarEnderecoLocationIq } from '../locationiq'
import { consultarGoogleGeocodingEnderecoDificil } from '../google-geocoding'
import {
  extrairEnderecoAgendaShAgV2,
  normalizarChaveEnderecoAgendaV2,
  type LinhaAgendaShAgV2,
} from './parse-agenda-shag'
import { normalizarEquipe } from './equipe'
import { montarFormGeoCachePorEnderecoAgenda } from './cache-coordenadas-agenda-diagnostico'

type Coordenada = { lat: number; lng: number }

export type ResolverCoordenadasAgendaProducaoInput = {
  linhasAgenda: LinhaAgendaShAgV2[]
  datasAlvoISO: string[]
  equipesAlvo: string[]
  cacheCoordenadasPorEndereco: Record<string, Coordenada>
  maxGeocodificacoesExternas?: number
}

export type ResolverCoordenadasAgendaProducaoOutput = {
  cacheCoordenadasPorEndereco: Record<string, Coordenada>
  enderecosComEnderecoSemCoordenada: number
  resolvidosPorCache: number
  resolvidosPorFallback: number
  aindaSemCoordenada: number
  semPayloadEstruturado: number
  geocodificacoesExternasTentadas: number
  avisos: string[]
}

function dataISODeAgendaRaw(value: unknown): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const year = value.getFullYear()
    const month = String(value.getMonth() + 1).padStart(2, '0')
    const day = String(value.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }
  if (typeof value !== 'string') return null
  const texto = value.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(texto)) return texto
  const br = texto.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (!br) return null
  return `${br[3]}-${br[2].padStart(2, '0')}-${br[1].padStart(2, '0')}`
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

export async function resolverCoordenadasAgendaProducao(
  input: ResolverCoordenadasAgendaProducaoInput
): Promise<ResolverCoordenadasAgendaProducaoOutput> {
  const cacheCoordenadasPorEndereco = input.cacheCoordenadasPorEndereco
  const datasAlvo = new Set(input.datasAlvoISO)
  const equipesAlvo = new Set(input.equipesAlvo.map((equipe) => normalizarEquipe(equipe)).filter(Boolean))
  const maxGeocodificacoesExternas = Math.max(0, input.maxGeocodificacoesExternas ?? 5)
  const avisos: string[] = []
  const enderecosTentados = new Set<string>()

  let enderecosComEnderecoSemCoordenada = 0
  let resolvidosPorCache = 0
  let resolvidosPorFallback = 0
  let aindaSemCoordenada = 0
  let semPayloadEstruturado = 0
  let geocodificacoesExternasTentadas = 0

  for (const linha of input.linhasAgenda) {
    if (!Array.isArray(linha)) continue

    const dataISO = dataISODeAgendaRaw(linha[0])
    if (!dataISO || !datasAlvo.has(dataISO)) continue

    const equipe = normalizarEquipe(linha[6])
    if (!equipe || !equipesAlvo.has(equipe)) continue

    const extracao = extrairEnderecoAgendaShAgV2(linha)
    if (!extracao) continue

    const chaveCache = normalizarChaveEnderecoAgendaV2(extracao.endereco)
    if (coordenadaValida(cacheCoordenadasPorEndereco[chaveCache])) continue
    if (enderecosTentados.has(chaveCache)) continue
    enderecosTentados.add(chaveCache)
    enderecosComEnderecoSemCoordenada++

    const form = montarFormGeoCachePorEnderecoAgenda(extracao.endereco)
    if (!form) {
      semPayloadEstruturado++
      aindaSemCoordenada++
      continue
    }

    try {
      const cache = await buscarEnderecoNoGeoCache(form)
      if (cache.status === 'hit' && coordenadaValida({ lat: cache.resultado.lat, lng: cache.resultado.lng })) {
        cacheCoordenadasPorEndereco[chaveCache] = {
          lat: cache.resultado.lat as number,
          lng: cache.resultado.lng as number,
        }
        resolvidosPorCache++
        continue
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      avisos.push(`Agenda producao: erro ao consultar geo_cache por campos (${msg}).`)
    }

    if (geocodificacoesExternasTentadas >= maxGeocodificacoesExternas) {
      aindaSemCoordenada++
      continue
    }

    geocodificacoesExternasTentadas++

    try {
      const locationIq = await buscarEnderecoLocationIq(form)
      if (locationIq.status === 'success' && coordenadaValida({ lat: locationIq.resultado.lat, lng: locationIq.resultado.lng })) {
        const cacheSave = await salvarEnderecoNoGeoCache(form, locationIq.resultado)
        if (!cacheSave.ok) avisos.push(`Agenda producao: coordenada resolvida por LocationIQ, mas cache nao foi salvo (${cacheSave.erro}).`)
        cacheCoordenadasPorEndereco[chaveCache] = {
          lat: locationIq.resultado.lat as number,
          lng: locationIq.resultado.lng as number,
        }
        resolvidosPorFallback++
        continue
      }

      const google = await consultarGoogleGeocodingEnderecoDificil(form, { permitirEnderecoComum: true })
      if (google.status === 'success' && coordenadaValida({ lat: google.resultado.lat, lng: google.resultado.lng })) {
        const cacheSave = await salvarEnderecoNoGeoCache(form, google.resultado)
        if (!cacheSave.ok) avisos.push(`Agenda producao: coordenada resolvida por Google, mas cache nao foi salvo (${cacheSave.erro}).`)
        cacheCoordenadasPorEndereco[chaveCache] = {
          lat: google.resultado.lat as number,
          lng: google.resultado.lng as number,
        }
        resolvidosPorFallback++
        continue
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      avisos.push(`Agenda producao: fallback de geocodificacao falhou (${msg}).`)
    }

    aindaSemCoordenada++
  }

  if (enderecosComEnderecoSemCoordenada > 0) {
    avisos.push(
      `Agenda producao: ${enderecosComEnderecoSemCoordenada} endereco(s) real(is) da agenda estavam sem coordenada no cache inicial; ` +
      `${resolvidosPorCache} resolvido(s) por geo_cache seguro, ${resolvidosPorFallback} por fallback e ${aindaSemCoordenada} permaneceram sem coordenada.`
    )
  }
  if (geocodificacoesExternasTentadas >= maxGeocodificacoesExternas && aindaSemCoordenada > 0) {
    avisos.push(`Agenda producao: limite de ${maxGeocodificacoesExternas} geocodificacao(oes) externa(s) por busca atingido.`)
  }
  if (semPayloadEstruturado > 0) {
    avisos.push(`Agenda producao: ${semPayloadEstruturado} endereco(s) sem payload estruturado suficiente para geocodificacao segura.`)
  }

  return {
    cacheCoordenadasPorEndereco,
    enderecosComEnderecoSemCoordenada,
    resolvidosPorCache,
    resolvidosPorFallback,
    aindaSemCoordenada,
    semPayloadEstruturado,
    geocodificacoesExternasTentadas,
    avisos,
  }
}
