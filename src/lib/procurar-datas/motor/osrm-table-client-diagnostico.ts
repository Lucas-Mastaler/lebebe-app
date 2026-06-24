// ─────────────────────────────────────────────────────────────────────────────
// motor/osrm-table-client-diagnostico.ts
//   Adaptador HTTP que implementa o contrato BuscarMatrizOSRM usando a
//   OSRM Table API (endpoint /table/v1/driving/{coords}?annotations=distance).
//
//   Proposito:
//     Fornecer uma implementacao real de BuscarMatrizOSRM para ser injetada em
//     prepararMatrizOSRMDiagnosticoV2, substituindo o mock dos testes quando
//     houver acesso ao servidor OSRM.
//
//   IMPORTANTE — OSRM usa ordem lng,lat, nao lat,lng.
//   Esta implementacao converte corretamente antes de montar a URL.
//
//   DIAGNOSTICO.
//   NAO esta integrado na rota /api/procurar-datas/v2/diagnostico.
//   NAO altera rotas, frontend, producao, candidatos ou classificacao.
//   NAO substitui kmAdicionalNaRotaDiagnosticoM.
//   NAO usa process.env (baseUrl e recebido por config).
//   NAO faz retry — apenas timeout e erro explícito.
//   Nos testes: fetch e sempre injetado via fetchImpl, nunca chamado real.
// ─────────────────────────────────────────────────────────────────────────────

import type { BuscarMatrizOSRM, ResultadoMatrizOSRM } from './preparar-matriz-osrm-diagnostico'
import type { Coordenada } from './distancia'

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type ConfigOSRMTableClient = {
  /**
   * URL base do servidor OSRM, sem trailing slash.
   * Ex: 'https://router.project-osrm.org' ou 'http://localhost:5000'.
   * Recebido por config — nunca por process.env.
   */
  baseUrl: string

  /**
   * Implementacao de fetch a ser usada.
   * Se omitida, usa o fetch global do ambiente (Node 18+ / browser).
   * Nos testes, sempre injetar um mock para nao chamar OSRM real.
   */
  fetchImpl?: typeof fetch

  /**
   * Timeout em milissegundos para a chamada HTTP.
   * Default: 5000ms.
   * Se ultrapassado, a chamada e abortada e um erro e lancado.
   */
  timeoutMs?: number

  /**
   * Perfil OSRM. Default: 'driving'.
   * Fixo nesta versao diagnostica.
   */
  profile?: 'driving'

  /**
   * Annotation a solicitar. Default: 'distance'.
   * OSRM retorna distances em metros.
   */
  annotations?: 'distance'

  /**
   * Logger opcional para auditar chamadas e respostas sem I/O externo obrigatorio.
   * Nao usa console diretamente.
   */
  log?: (msg: string, extra?: unknown) => void
}

// ─── Formato de resposta bruta da OSRM Table API ─────────────────────────────

type RespostaOSRMTable = {
  code: string
  distances?: (number | null)[][]
  message?: string
}

// ─── Helpers internos ─────────────────────────────────────────────────────────

/**
 * Monta a string de coordenadas no formato OSRM: lng,lat separados por ;
 * OSRM usa ordem lng,lat (longitude primeiro), nao lat,lng.
 */
function montarCoordsOSRM(coordenadas: Coordenada[]): string {
  return coordenadas.map((c) => `${c.lng},${c.lat}`).join(';')
}

/**
 * Monta a URL completa da Table API.
 * Ex: https://router.project-osrm.org/table/v1/driving/-49.29,-25.45;-49.27,-25.43?annotations=distance
 */
function montarUrlOSRMTable(
  baseUrl: string,
  coordenadas: Coordenada[],
  profile: string,
  annotations: string
): string {
  const coords = montarCoordsOSRM(coordenadas)
  return `${baseUrl}/table/v1/${profile}/${coords}?annotations=${annotations}`
}

// ─── Funcao principal ─────────────────────────────────────────────────────────

/**
 * Cria uma funcao compativel com o contrato BuscarMatrizOSRM usando a
 * OSRM Table API real (ou mockada nos testes).
 *
 * Retorna uma funcao assincrona que:
 *   1. Converte coordenadas para formato lng,lat (OSRM).
 *   2. Monta a URL: {baseUrl}/table/v1/{profile}/{coords}?annotations=distance
 *   3. Chama fetchImpl (ou fetch global) com AbortController para timeout.
 *   4. Valida HTTP status, JSON, code 'Ok' e presenca de distances.
 *   5. Retorna ResultadoMatrizOSRM com distances em metros.
 *
 * Erros possiveis (todos lancam Error com mensagem descritiva):
 *   - Timeout: 'OSRM timeout apos Xms'
 *   - HTTP erro: 'OSRM respondeu HTTP {status}'
 *   - JSON invalido: 'OSRM resposta nao e JSON valido'
 *   - code != 'Ok': 'OSRM retornou code={code}: {message}'
 *   - distances ausente: 'OSRM resposta sem campo distances'
 *   - distances malformada: 'OSRM distances com formato invalido'
 *
 * Nos testes, injetar fetchImpl como vi.fn() para evitar chamada HTTP real.
 *
 * Nao faz retry. Nao usa process.env. Nao muta o array de coordenadas.
 */
export function criarBuscarMatrizOSRMTableDiagnosticoV2(
  config: ConfigOSRMTableClient
): BuscarMatrizOSRM {
  const profile = config.profile ?? 'driving'
  const annotations = config.annotations ?? 'distance'
  const timeoutMs = config.timeoutMs ?? 5000
  const fetchFn = config.fetchImpl ?? fetch
  const log = config.log

  return async (coordenadas: Coordenada[]): Promise<ResultadoMatrizOSRM> => {
    // Nao muta o input — apenas le
    const url = montarUrlOSRMTable(config.baseUrl, coordenadas, profile, annotations)

    log?.(`OSRM Table API: GET ${url}`, { n: coordenadas.length })

    // ── Timeout via AbortController ───────────────────────────────────────
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)

    let response: Response
    try {
      response = await fetchFn(url, { signal: controller.signal })
    } catch (e) {
      clearTimeout(timer)
      const msg = e instanceof Error ? e.message : String(e)
      // AbortError vem do controller.abort()
      if (msg.includes('abort') || msg.includes('Abort') || (e instanceof Error && e.name === 'AbortError')) {
        throw new Error(`OSRM timeout apos ${timeoutMs}ms`)
      }
      throw new Error(`OSRM erro de rede: ${msg}`)
    }
    clearTimeout(timer)

    // ── Validar HTTP status ───────────────────────────────────────────────
    if (!response.ok) {
      log?.(`OSRM HTTP error`, { status: response.status })
      throw new Error(`OSRM respondeu HTTP ${response.status}`)
    }

    // ── Parsear JSON ──────────────────────────────────────────────────────
    let data: RespostaOSRMTable
    try {
      data = await response.json() as RespostaOSRMTable
    } catch {
      throw new Error('OSRM resposta nao e JSON valido')
    }

    log?.(`OSRM resposta`, { code: data.code })

    // ── Validar code ──────────────────────────────────────────────────────
    if (data.code !== 'Ok') {
      throw new Error(`OSRM retornou code=${data.code}: ${data.message ?? 'sem mensagem'}`)
    }

    // ── Validar presenca de distances ─────────────────────────────────────
    if (!data.distances) {
      throw new Error('OSRM resposta sem campo distances')
    }

    if (!Array.isArray(data.distances)) {
      throw new Error('OSRM distances com formato invalido')
    }

    // ── Sanitizar distancias ──────────────────────────────────────────────
    // OSRM ja retorna em metros. Preservar null. Tratar NaN/Infinity/negativo.
    const distancesSanitizadas: (number | null)[][] = data.distances.map((linha, i) => {
      if (!Array.isArray(linha)) {
        log?.(`OSRM linha ${i} invalida, substituida por null`, { linha })
        return new Array(coordenadas.length).fill(null) as null[]
      }
      return linha.map((v) => {
        if (v === null) return null
        if (!Number.isFinite(v) || v < 0) {
          log?.(`OSRM distancia invalida: ${v}, substituida por null`)
          return null
        }
        return v
      })
    })

    return { distances: distancesSanitizadas }
  }
}
