// ─────────────────────────────────────────────────────────────────────────────
// motor/osrm-route-client-diagnostico.ts
//   Adaptador HTTP que implementa chamada OSRM /route/v1/driving/{coords}
//   para um par de pontos (ponto-a-ponto, como o legado).
//
//   Propósito:
//     Fornecer implementação real de OSRM /route para ser usada no diagnóstico
//     de equivalência OSRM /route vs /table.
//
//   IMPORTANTE:
//     - OSRM usa ordem lng,lat (longitude primeiro), não lat,lng.
//     - Endpoint: {baseUrl}/route/v1/driving/{lng1},{lat1};{lng2},{lat2}
//     - Parâmetros: overview=false&alternatives=false&steps=false
//     - Retorno: routes[0].distance em metros.
//
//   DIAGNOSTICO.
//   NÃO está integrado na rota /api/procurar-datas/v2/diagnostico diretamente.
//   NÃO altera rotas, frontend, produção, candidatos ou classificação.
//   NÃO substitui kmAdicionalNaRotaDiagnosticoM.
//   NÃO usa process.env (baseUrl é recebido por config).
//   NÃO faz retry — apenas timeout e erro explícito.
//   Nos testes: fetch é sempre injetado via fetchImpl.
// ─────────────────────────────────────────────────────────────────────────────

import type { Coordenada } from './distancia'

// ─── Tipos de configuração ─────────────────────────────────────────────────────

export type ConfigOSRMRouteClient = {
  /**
   * URL base do servidor OSRM, sem trailing slash.
   * Ex: 'https://router.project-osrm.org' ou 'http://localhost:5000'.
   * Recebido por config — nunca por process.env.
   */
  baseUrl: string

  /**
   * Implementação de fetch a ser usada.
   * Se omitida, usa o fetch global do ambiente (Node 18+ / browser).
   * Nos testes, sempre injetar um mock para não chamar OSRM real.
   */
  fetchImpl?: typeof fetch

  /**
   * Timeout em milissegundos para a chamada HTTP.
   * Default: 5000ms.
   */
  timeoutMs?: number

  /**
   * Perfil OSRM. Default: 'driving'.
   */
  profile?: 'driving'

  /**
   * Logger opcional para auditar chamadas.
   */
  log?: (msg: string, extra?: unknown) => void
}

export type ResultadoRotaOSRM = {
  /** Distância da rota em metros (routes[0].distance). */
  distanciaM: number | null

  /** true se obteve distância válida. */
  ok: boolean

  /** Mensagem de erro se falhou. */
  erro?: string
}

// ─── Helpers internos ─────────────────────────────────────────────────────────

/**
 * Monta a URL da OSRM Route API para um par de coordenadas.
 * OSRM usa ordem lng,lat.
 */
function montarUrlOSRMRoute(
  baseUrl: string,
  de: Coordenada,
  para: Coordenada,
  profile: string
): string {
  const coords = `${de.lng},${de.lat};${para.lng},${para.lat}`
  return `${baseUrl}/route/v1/${profile}/${coords}?overview=false&alternatives=false&steps=false`
}

// ─── Formato de resposta bruta da OSRM Route API ─────────────────────────────

type RotaOSRM = {
  distance: number
  duration: number
}

type RespostaOSRMRoute = {
  code: string
  routes?: RotaOSRM[]
  message?: string
}

// ─── Função principal ─────────────────────────────────────────────────────────

/**
 * Cria uma função que calcula distância via OSRM /route para um par de pontos.
 *
 * Retorna uma função assíncrona que:
 *   1. Monta URL: {baseUrl}/route/v1/driving/{lng1},{lat1};{lng2},{lat2}
 *   2. Chama fetchImpl com AbortController para timeout.
 *   3. Valida HTTP status, JSON, code 'Ok' e presença de routes[0].distance.
 *   4. Retorna distância em metros.
 */
export function criarBuscarRotaOSRMRouteDiagnosticoV2(
  config: ConfigOSRMRouteClient
): (de: Coordenada, para: Coordenada) => Promise<ResultadoRotaOSRM> {
  const profile = config.profile ?? 'driving'
  const timeoutMs = config.timeoutMs ?? 5000
  const fetchFn = config.fetchImpl ?? fetch
  const log = config.log

  return async (de: Coordenada, para: Coordenada): Promise<ResultadoRotaOSRM> => {
    // ── Validação de entrada ─────────────────────────────────────────────────
    if (!Number.isFinite(de.lat) || !Number.isFinite(de.lng)) {
      return { distanciaM: null, ok: false, erro: 'Coordenada "de" inválida' }
    }
    if (!Number.isFinite(para.lat) || !Number.isFinite(para.lng)) {
      return { distanciaM: null, ok: false, erro: 'Coordenada "para" inválida' }
    }

    // ── Montar URL e chamar ──────────────────────────────────────────────────
    const url = montarUrlOSRMRoute(config.baseUrl, de, para, profile)
    log?.(`OSRM Route API: GET ${url}`)

    // ── Timeout via AbortController ───────────────────────────────────────────
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)

    let response: Response
    try {
      response = await fetchFn(url, { signal: controller.signal })
    } catch (e) {
      clearTimeout(timer)
      const msg = e instanceof Error ? e.message : String(e)
      if (msg.includes('abort') || msg.includes('Abort') || (e instanceof Error && e.name === 'AbortError')) {
        return { distanciaM: null, ok: false, erro: `Timeout após ${timeoutMs}ms` }
      }
      return { distanciaM: null, ok: false, erro: `Erro de rede: ${msg}` }
    }
    clearTimeout(timer)

    // ── Validar HTTP status ───────────────────────────────────────────────────
    if (!response.ok) {
      log?.(`OSRM Route HTTP error`, { status: response.status })
      return { distanciaM: null, ok: false, erro: `HTTP ${response.status}` }
    }

    // ── Parsear JSON ───────────────────────────────────────────────────────────
    let data: RespostaOSRMRoute
    try {
      data = await response.json() as RespostaOSRMRoute
    } catch {
      return { distanciaM: null, ok: false, erro: 'Resposta não é JSON válido' }
    }

    log?.(`OSRM Route resposta`, { code: data.code })

    // ── Validar code ────────────────────────────────────────────────────────
    if (data.code !== 'Ok') {
      return {
        distanciaM: null,
        ok: false,
        erro: `Code=${data.code}: ${data.message ?? 'sem mensagem'}`,
      }
    }

    // ── Validar e extrair distância ───────────────────────────────────────────
    if (!data.routes || !Array.isArray(data.routes) || data.routes.length === 0) {
      return { distanciaM: null, ok: false, erro: 'Sem routes na resposta' }
    }

    const route = data.routes[0]
    if (typeof route.distance !== 'number' || !Number.isFinite(route.distance) || route.distance < 0) {
      return { distanciaM: null, ok: false, erro: 'Distância inválida na rota' }
    }

    // Distância em metros
    return { distanciaM: Math.round(route.distance), ok: true }
  }
}
