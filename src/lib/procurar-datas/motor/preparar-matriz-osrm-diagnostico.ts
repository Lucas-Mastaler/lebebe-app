// ─────────────────────────────────────────────────────────────────────────────
// motor/preparar-matriz-osrm-diagnostico.ts
//   Adaptador assincrono que prepara uma matriz de distancias em metros
//   a partir de um backend OSRM injetado (mockavel nos testes, real no futuro).
//
//   Fluxo:
//     1. buscarMatrizOSRM(coordenadas) [async, injetado] → ResultadoMatrizOSRM
//     2. prepararMatrizOSRMDiagnosticoV2()               → matrizMetros
//     3. criarCalculadorDistanciaPorMatriz(matrizMetros) → (de, para) => number | null
//     4. helper de delta [sincrono, inalterado]          → kmAdicionalNaRotaM
//
//   DIAGNOSTICO.
//   NAO chama OSRM real diretamente.
//   NAO usa fetch diretamente — recebe buscarMatrizOSRM por injecao.
//   NAO chama Supabase.
//   NAO chama Google Sheets.
//   NAO chama Apps Script.
//   NAO faz geocoding.
//   NAO usa process.env.
//   NAO depende de data/hora atual.
//   NAO altera rotas, frontend, producao, candidatos ou classificacao.
//   NAO substitui kmAdicionalNaRotaDiagnosticoM.
// ─────────────────────────────────────────────────────────────────────────────

import type { Coordenada } from './distancia'

// ─── Tipos de entrada ─────────────────────────────────────────────────────────

/** Ponto para solicitar distancias ao OSRM. Requer id unico para montar matriz. */
export type PontoRotaOSRM = {
  /** Identificador unico obrigatorio para montar a matriz por chave. */
  id: string
  lat: number
  lng: number
  descricao?: string
}

/**
 * Formato esperado do retorno do backend OSRM.
 * Tabela de distancias: distances[i][j] = metros de pontos[i] para pontos[j].
 * null = distancia indisponivel para o par.
 */
export type ResultadoMatrizOSRM = {
  /** Distancias na mesma ordem dos pontos enviados. */
  distances: (number | null)[][]
}

/**
 * Funcao injetada que acessa o OSRM (ou mock).
 * Recebe coordenadas na mesma ordem que os pontos validos.
 * Retorna ResultadoMatrizOSRM ou lanca erro.
 */
export type BuscarMatrizOSRM = (
  coordenadas: Coordenada[]
) => Promise<ResultadoMatrizOSRM>

export type PrepararMatrizOSRMInput = {
  /** Pontos para calcular matriz de distancias. */
  pontos: PontoRotaOSRM[]

  /** Funcao injetada que acessa OSRM (ou mock nos testes). */
  buscarMatrizOSRM: BuscarMatrizOSRM

  /** Modo fixo desta versao. */
  modo?: 'osrm-mockavel-diagnostico'
}

// ─── Tipos de saida ───────────────────────────────────────────────────────────

export type PontoDescartadoOSRM = {
  id?: string
  indice: number
  motivo: string
}

export type PrepararMatrizOSRMOutput = {
  ok: boolean

  /** Sempre 'osrm-mockavel-diagnostico' nesta versao. */
  modo: 'osrm-mockavel-diagnostico'

  /**
   * Matriz de distancias em metros indexada por id.
   * matrizMetros[idDe][idPara] = metros | null
   * Vazia se ok=false ou pontos insuficientes.
   */
  matrizMetros: Record<string, Record<string, number | null>>

  /** Avisos informativos. */
  avisos: string[]

  /** Erros criticos que impediram o calculo parcial ou total. */
  erros: string[]

  /** Pontos descartados por coordenada invalida. */
  descartados: PontoDescartadoOSRM[]

  resumo: {
    pontosRecebidos: number
    pontosValidos: number
    pontosInvalidos: number
    distanciasRecebidas: number
    distanciasValidas: number
    distanciasInvalidas: number
  }
}

// ─── Helpers internos ────────────────────────────────────────────────────────

function coordenadaValida(p: PontoRotaOSRM): boolean {
  return Number.isFinite(p.lat) && Number.isFinite(p.lng)
}

function distanciaValida(v: number | null): v is number {
  return v !== null && Number.isFinite(v) && v >= 0
}

// ─── Funcao principal ─────────────────────────────────────────────────────────

/**
 * Prepara uma matriz de distancias em metros a partir de um backend OSRM
 * injetado (mockavel nos testes, real no futuro).
 *
 * ASSINCRONO — o backend OSRM e rede/HTTP.
 * O helper de delta (calcularDeltaInsercaoRotaComMatrizDiagnosticoV2)
 * permanece sincrono e recebe a funcao gerada por criarCalculadorDistanciaPorMatriz.
 *
 * Regras:
 *   - Pontos com coordenada invalida sao descartados antes de chamar o OSRM.
 *   - Se restar menos de 2 pontos validos: ok=false, matriz vazia, erro claro.
 *   - Distancias negativas, NaN, Infinity: tratadas como null com aviso.
 *   - Nunca usa fallback silencioso 0.
 *   - Nao muta o input.
 */
export async function prepararMatrizOSRMDiagnosticoV2(
  input: PrepararMatrizOSRMInput
): Promise<PrepararMatrizOSRMOutput> {
  const avisos: string[] = []
  const erros: string[] = []
  const descartados: PontoDescartadoOSRM[] = []

  const matrizVazia: Record<string, Record<string, number | null>> = {}

  const resumoBase = {
    pontosRecebidos: input.pontos.length,
    pontosValidos: 0,
    pontosInvalidos: 0,
    distanciasRecebidas: 0,
    distanciasValidas: 0,
    distanciasInvalidas: 0,
  }

  // ── 1. Validar e filtrar pontos ───────────────────────────────────────────
  const pontosValidos: PontoRotaOSRM[] = []

  for (let i = 0; i < input.pontos.length; i++) {
    const p = input.pontos[i]
    if (!coordenadaValida(p)) {
      descartados.push({
        id: p.id,
        indice: i,
        motivo: `Coordenada invalida: lat=${p.lat}, lng=${p.lng}`,
      })
      continue
    }
    pontosValidos.push(p)
  }

  resumoBase.pontosValidos = pontosValidos.length
  resumoBase.pontosInvalidos = descartados.length

  if (descartados.length > 0) {
    avisos.push(
      `${descartados.length} ponto(s) descartado(s) por coordenada invalida.`
    )
  }

  // ── 2. Verificar minimo de pontos ────────────────────────────────────────
  if (pontosValidos.length < 2) {
    erros.push(
      `Pontos validos insuficientes para montar matriz (${pontosValidos.length} valido(s), minimo 2).`
    )
    return {
      ok: false,
      modo: 'osrm-mockavel-diagnostico',
      matrizMetros: matrizVazia,
      avisos,
      erros,
      descartados,
      resumo: resumoBase,
    }
  }

  // ── 3. Chamar o backend OSRM injetado ────────────────────────────────────
  const coordenadas: Coordenada[] = pontosValidos.map((p) => ({
    lat: p.lat,
    lng: p.lng,
  }))

  let resultadoOSRM: ResultadoMatrizOSRM
  try {
    resultadoOSRM = await input.buscarMatrizOSRM(coordenadas)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    erros.push(`Erro ao chamar buscarMatrizOSRM: ${msg}`)
    return {
      ok: false,
      modo: 'osrm-mockavel-diagnostico',
      matrizMetros: matrizVazia,
      avisos,
      erros,
      descartados,
      resumo: resumoBase,
    }
  }

  // ── 4. Validar estrutura do retorno ──────────────────────────────────────
  if (
    !resultadoOSRM ||
    !Array.isArray(resultadoOSRM.distances) ||
    resultadoOSRM.distances.length !== pontosValidos.length
  ) {
    erros.push(
      `Retorno do OSRM invalido: distances ausente ou com tamanho incorreto.`
    )
    return {
      ok: false,
      modo: 'osrm-mockavel-diagnostico',
      matrizMetros: matrizVazia,
      avisos,
      erros,
      descartados,
      resumo: resumoBase,
    }
  }

  // ── 5. Montar matriz por id ───────────────────────────────────────────────
  const matriz: Record<string, Record<string, number | null>> = {}
  let distanciasRecebidas = 0
  let distanciasValidas = 0
  let distanciasInvalidas = 0

  for (let i = 0; i < pontosValidos.length; i++) {
    const idDe = pontosValidos[i].id
    if (!matriz[idDe]) matriz[idDe] = {}

    const linha = resultadoOSRM.distances[i]
    if (!Array.isArray(linha) || linha.length !== pontosValidos.length) {
      avisos.push(
        `Linha ${i} da matriz OSRM invalida ou com tamanho incorreto. Linha preenchida com null.`
      )
      for (let j = 0; j < pontosValidos.length; j++) {
        const idPara = pontosValidos[j].id
        matriz[idDe][idPara] = null
        distanciasInvalidas++
        distanciasRecebidas++
      }
      continue
    }

    for (let j = 0; j < pontosValidos.length; j++) {
      const idPara = pontosValidos[j].id
      distanciasRecebidas++

      const v = linha[j]
      if (!distanciaValida(v)) {
        if (v !== null) {
          avisos.push(
            `Distancia invalida de '${idDe}' para '${idPara}': ${v}. Tratada como null.`
          )
        }
        matriz[idDe][idPara] = null
        distanciasInvalidas++
      } else {
        matriz[idDe][idPara] = Math.round(v)
        distanciasValidas++
      }
    }
  }

  resumoBase.distanciasRecebidas = distanciasRecebidas
  resumoBase.distanciasValidas = distanciasValidas
  resumoBase.distanciasInvalidas = distanciasInvalidas

  avisos.push(
    `Matriz montada: ${pontosValidos.length} pontos, ${distanciasValidas}/${distanciasRecebidas} distancias validas.`
  )

  return {
    ok: true,
    modo: 'osrm-mockavel-diagnostico',
    matrizMetros: matriz,
    avisos,
    erros,
    descartados,
    resumo: resumoBase,
  }
}

// ─── Calculador de distancia a partir da matriz ───────────────────────────────

/**
 * Cria uma funcao sincrona compativel com calcularDistanciaM de
 * calcularDeltaInsercaoRotaComMatrizDiagnosticoV2, a partir de uma matriz
 * pre-computada por prepararMatrizOSRMDiagnosticoV2.
 *
 * A funcao busca por { id } nas coordenadas recebidas.
 * Se o ponto nao tiver id ou nao estiver na matriz, retorna null.
 *
 * Uso tipico:
 *   const result = await prepararMatrizOSRMDiagnosticoV2(input)
 *   if (!result.ok) ...
 *   const calcularDistanciaM = criarCalculadorDistanciaPorMatriz(result.matrizMetros)
 *   const delta = calcularDeltaInsercaoRotaComMatrizDiagnosticoV2({ ..., calcularDistanciaM })
 *
 * Limitacao: requer que os objetos passados ao helper de delta contenham id.
 * Para uso com p.loc (sem id), use criarCalculadorDistanciaPorCoordenadas.
 */
export function criarCalculadorDistanciaPorMatriz(
  matrizMetros: Record<string, Record<string, number | null>>
): (de: Coordenada & { id?: string }, para: Coordenada & { id?: string }) => number | null {
  return (de, para) => {
    const idDe = (de as { id?: string }).id
    const idPara = (para as { id?: string }).id
    if (!idDe || !idPara) return null
    const linha = matrizMetros[idDe]
    if (!linha) return null
    const valor = linha[idPara]
    if (valor === undefined) return null
    return valor
  }
}

/**
 * Versao alternativa de criarCalculadorDistanciaPorMatriz que indexa por
 * chave "lat,lng" em vez de id.
 *
 * Necessaria quando calcularDeltaInsercaoRotaComMatrizDiagnosticoV2 passa
 * p.loc (que e Coordenada sem id) para a funcao de distancia.
 *
 * Recebe a lista de pontos originais para montar o indice lat,lng → id.
 * A busca na matriz continua sendo por id, mas a funcao aceita coordenadas
 * sem id e resolve o id pelo indice de lat/lng.
 *
 * Uso tipico:
 *   const calcularDistanciaM = criarCalculadorDistanciaPorCoordenadas(
 *     result.matrizMetros,
 *     pontosOriginais   // mesmos pontos passados para prepararMatrizOSRMDiagnosticoV2
 *   )
 */
export function criarCalculadorDistanciaPorCoordenadas(
  matrizMetros: Record<string, Record<string, number | null>>,
  pontos: PontoRotaOSRM[]
): (de: Coordenada, para: Coordenada) => number | null {
  const indicePorChave: Record<string, string> = {}
  for (const p of pontos) {
    if (Number.isFinite(p.lat) && Number.isFinite(p.lng)) {
      indicePorChave[`${p.lat},${p.lng}`] = p.id
    }
  }
  return (de, para) => {
    const idDe = indicePorChave[`${de.lat},${de.lng}`]
    const idPara = indicePorChave[`${para.lat},${para.lng}`]
    if (!idDe || !idPara) return null
    const linha = matrizMetros[idDe]
    if (!linha) return null
    const valor = linha[idPara]
    if (valor === undefined) return null
    return valor
  }
}
