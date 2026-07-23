import {
  buscarEnderecoNoGeoCache,
  buscarEnderecosNoGeoCacheEmLote,
  salvarEnderecoNoGeoCache,
  type GeoCacheRow,
} from '../endereco-cache'
import { buscarEnderecoLocationIq } from '../locationiq'
import { consultarGoogleGeocodingEnderecoDificil } from '../google-geocoding'
import {
  extrairEnderecoAgendaShAgV2,
  normalizarChaveEnderecoAgendaV2,
  type LinhaAgendaShAgV2,
} from './parse-agenda-shag'
import { normalizarEquipe } from './equipe'
import { montarFormGeoCachePorEnderecoAgenda } from './cache-coordenadas-agenda-diagnostico'
import type { MedidorPerformanceV2 } from './performance-diagnostico-v2'

type Coordenada = { lat: number; lng: number }
type EnderecoPendenteAgenda = {
  chaveCache: string
  form: NonNullable<ReturnType<typeof montarFormGeoCachePorEnderecoAgenda>>
}

export type ResolverCoordenadasAgendaProducaoInput = {
  linhasAgenda: LinhaAgendaShAgV2[]
  datasAlvoISO: string[]
  equipesAlvo: string[]
  cacheCoordenadasPorEndereco: Record<string, Coordenada>
  maxGeocodificacoesExternas?: number
  medidorPerformance?: MedidorPerformanceV2
}

export type ResolverCoordenadasAgendaProducaoOutput = {
  cacheCoordenadasPorEndereco: Record<string, Coordenada>
  enderecosComEnderecoSemCoordenada: number
  resolvidosPorCache: number
  resolvidosPorFallback: number
  aindaSemCoordenada: number
  semPayloadEstruturado: number
  geocodificacoesExternasTentadas: number
  eventosComEndereco: number
  enderecosUnicos: number
  duplicatasEliminadas: number
  consultasCacheAntesEstimadas: number
  consultasCacheDepois: number
  chunksCache: number
  cacheHitsLote: number
  cacheMissesLote: number
  fallbacksExecutados: number
  fallbacksConcorrencia: number
  avisos: string[]
}

const GEO_CACHE_FALLBACK_CONCORRENCIA = 4

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

async function mapearComConcorrencia<T, R>(
  itens: T[],
  limite: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const resultados = new Array<R>(itens.length)
  let proximo = 0
  const workers = Array.from({ length: Math.min(Math.max(1, limite), itens.length) }, async () => {
    while (proximo < itens.length) {
      const index = proximo++
      resultados[index] = await fn(itens[index])
    }
  })
  await Promise.all(workers)
  return resultados
}

export async function resolverCoordenadasAgendaProducao(
  input: ResolverCoordenadasAgendaProducaoInput
): Promise<ResolverCoordenadasAgendaProducaoOutput> {
  const perf = input.medidorPerformance
  const cacheCoordenadasPorEndereco = input.cacheCoordenadasPorEndereco
  const datasAlvo = new Set(input.datasAlvoISO)
  const equipesAlvo = new Set(input.equipesAlvo.map((equipe) => normalizarEquipe(equipe)).filter(Boolean))
  const maxGeocodificacoesExternas = Math.max(0, input.maxGeocodificacoesExternas ?? 5)
  const avisos: string[] = []
  const enderecosTentados = new Set<string>()
  const pendentesPorChave = new Map<string, EnderecoPendenteAgenda>()

  let enderecosComEnderecoSemCoordenada = 0
  let resolvidosPorCache = 0
  let resolvidosPorFallback = 0
  let aindaSemCoordenada = 0
  let semPayloadEstruturado = 0
  let geocodificacoesExternasTentadas = 0
  let eventosComEndereco = 0
  let consultasCacheDepois = 0
  let chunksCache = 0
  let cacheHitsLote = 0
  let cacheMissesLote = 0
  let fallbacksExecutados = 0

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
    eventosComEndereco++
    if (enderecosTentados.has(chaveCache)) continue
    enderecosTentados.add(chaveCache)
    enderecosComEnderecoSemCoordenada++

    const form = montarFormGeoCachePorEnderecoAgenda(extracao.endereco)
    if (!form) {
      semPayloadEstruturado++
      aindaSemCoordenada++
      continue
    }

    pendentesPorChave.set(chaveCache, { chaveCache, form })
  }

  const pendentesIniciais = [...pendentesPorChave.values()]
  let candidatosHashPorChave: Record<string, GeoCacheRow[]> = {}

  if (pendentesIniciais.length > 0) {
    try {
      const lote = await (perf?.medirAsync('geocodificacao-agenda-cache-lote', () =>
        buscarEnderecosNoGeoCacheEmLote(
          pendentesIniciais.map((p) => ({ chave: p.chaveCache, form: p.form }))
        )
      ) ?? buscarEnderecosNoGeoCacheEmLote(
        pendentesIniciais.map((p) => ({ chave: p.chaveCache, form: p.form }))
      ))
      consultasCacheDepois += lote.chunks
      chunksCache = lote.chunks
      candidatosHashPorChave = lote.candidatosPorChave

      for (const pendente of pendentesIniciais) {
        const cache = lote.resultadosPorChave[pendente.chaveCache]
        if (cache?.status === 'hit' && coordenadaValida({ lat: cache.resultado.lat, lng: cache.resultado.lng })) {
          cacheCoordenadasPorEndereco[pendente.chaveCache] = {
            lat: cache.resultado.lat as number,
            lng: cache.resultado.lng as number,
          }
          resolvidosPorCache++
          cacheHitsLote++
          pendentesPorChave.delete(pendente.chaveCache)
        } else {
          cacheMissesLote++
        }
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      avisos.push(`Agenda producao: erro ao consultar geo_cache em lote (${msg}).`)
    }
  }

  for (const pendente of [...pendentesPorChave.values()]) {
    try {
      const cache = await (perf?.medirAsync('geocodificacao-agenda-cache-campos', () =>
        buscarEnderecoNoGeoCache(pendente.form, {
          candidatosIniciais: candidatosHashPorChave[pendente.chaveCache] ?? [],
          pularConsultaHash: true,
        })
      ) ?? buscarEnderecoNoGeoCache(pendente.form, {
        candidatosIniciais: candidatosHashPorChave[pendente.chaveCache] ?? [],
        pularConsultaHash: true,
      }))
      consultasCacheDepois++
      if (cache.status === 'hit' && coordenadaValida({ lat: cache.resultado.lat, lng: cache.resultado.lng })) {
        cacheCoordenadasPorEndereco[pendente.chaveCache] = {
          lat: cache.resultado.lat as number,
          lng: cache.resultado.lng as number,
        }
        resolvidosPorCache++
        pendentesPorChave.delete(pendente.chaveCache)
        continue
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      avisos.push(`Agenda producao: erro ao consultar geo_cache por campos (${msg}).`)
    }
  }

  const pendentesFallback = [...pendentesPorChave.values()].slice(0, maxGeocodificacoesExternas)
  const limiteAtingido = pendentesPorChave.size > pendentesFallback.length
  geocodificacoesExternasTentadas = pendentesFallback.length
  fallbacksExecutados = pendentesFallback.length

  await mapearComConcorrencia(pendentesFallback, GEO_CACHE_FALLBACK_CONCORRENCIA, async (pendente) => {
    try {
      const locationIq = await (perf?.medirAsync('geocodificacao-agenda-externa', () =>
        buscarEnderecoLocationIq(pendente.form)
      ) ?? buscarEnderecoLocationIq(pendente.form))
      if (locationIq.status === 'success' && coordenadaValida({ lat: locationIq.resultado.lat, lng: locationIq.resultado.lng })) {
        const cacheSave = await salvarEnderecoNoGeoCache(pendente.form, locationIq.resultado)
        if (!cacheSave.ok) avisos.push(`Agenda producao: coordenada resolvida por LocationIQ, mas cache nao foi salvo (${cacheSave.erro}).`)
        cacheCoordenadasPorEndereco[pendente.chaveCache] = {
          lat: locationIq.resultado.lat as number,
          lng: locationIq.resultado.lng as number,
        }
        resolvidosPorFallback++
        pendentesPorChave.delete(pendente.chaveCache)
        return
      }

      const google = await (perf?.medirAsync('geocodificacao-agenda-externa', () =>
        consultarGoogleGeocodingEnderecoDificil(pendente.form, { permitirEnderecoComum: true })
      ) ?? consultarGoogleGeocodingEnderecoDificil(pendente.form, { permitirEnderecoComum: true }))
      if (google.status === 'success' && coordenadaValida({ lat: google.resultado.lat, lng: google.resultado.lng })) {
        const cacheSave = await salvarEnderecoNoGeoCache(pendente.form, google.resultado)
        if (!cacheSave.ok) avisos.push(`Agenda producao: coordenada resolvida por Google, mas cache nao foi salvo (${cacheSave.erro}).`)
        cacheCoordenadasPorEndereco[pendente.chaveCache] = {
          lat: google.resultado.lat as number,
          lng: google.resultado.lng as number,
        }
        resolvidosPorFallback++
        pendentesPorChave.delete(pendente.chaveCache)
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      avisos.push(`Agenda producao: fallback de geocodificacao falhou (${msg}).`)
    }
  })

  aindaSemCoordenada = pendentesPorChave.size

  if (enderecosComEnderecoSemCoordenada > 0) {
    avisos.push(
      `Agenda producao: ${enderecosComEnderecoSemCoordenada} endereco(s) real(is) da agenda estavam sem coordenada no cache inicial; ` +
      `${resolvidosPorCache} resolvido(s) por geo_cache seguro, ${resolvidosPorFallback} por fallback e ${aindaSemCoordenada} permaneceram sem coordenada. ` +
      `Cache: ${eventosComEndereco} evento(s) com endereco, ${enderecosTentados.size} unico(s), ${Math.max(0, eventosComEndereco - enderecosTentados.size)} duplicata(s) eliminada(s), ` +
      `${enderecosTentados.size} consulta(s) antiga(s) estimada(s), ${consultasCacheDepois} consulta(s) atual(is), ${chunksCache} chunk(s), ${cacheHitsLote} hit(s) em lote, ${cacheMissesLote} miss(es) em lote. ` +
      `Fallback: ${fallbacksExecutados} executado(s), concorrencia ${GEO_CACHE_FALLBACK_CONCORRENCIA}.`
    )
  }
  if (limiteAtingido && aindaSemCoordenada > 0) {
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
    eventosComEndereco,
    enderecosUnicos: enderecosTentados.size,
    duplicatasEliminadas: Math.max(0, eventosComEndereco - enderecosTentados.size),
    consultasCacheAntesEstimadas: enderecosTentados.size,
    consultasCacheDepois,
    chunksCache,
    cacheHitsLote,
    cacheMissesLote,
    fallbacksExecutados,
    fallbacksConcorrencia: GEO_CACHE_FALLBACK_CONCORRENCIA,
    avisos,
  }
}
