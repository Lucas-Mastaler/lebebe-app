// ─────────────────────────────────────────────────────────────────────────────
// motor/calcular-delta-insercao-matriz.ts
//   Helper puro para calcular delta de insercao usando funcao de distancia
//   injetada.
//
//   Proposito:
//     Permite comparar futuro comportamento OSRM com Haversine diagnostico,
//     pois a logica de insercao e identica — a diferenca esta na fonte de
//     distancias.
//
//   Diferenca em relacao a calcular-delta-insercao-rota.ts:
//     - Nao usa Haversine internamente.
//     - Recebe `calcularDistanciaM: (de, para) => number | null` por injecao.
//     - Trata distancias invalidas (null, negativa, NaN, Infinity) por insercao.
//     - Output tem campo extra `erros` e `resumo` estendido.
//
//   APROXIMACAO DIAGNOSTICA.
//   NAO deve ser usado em producao.
//   NAO chama OSRM real.
//   NAO faz I/O externo.
//   NAO usa process.env.
//   NAO usa geocoding.
//   Prepara contrato para futura integracao com OSRM controlado.
// ─────────────────────────────────────────────────────────────────────────────

import type { Coordenada } from './distancia'

// ─── Tipos de entrada ─────────────────────────────────────────────────────────

/** Ponto de rota com coordenadas e metadados opcionais. */
export type PontoRotaMatriz = {
  loc: Coordenada
  addr?: string
  eventTitle?: string
  team?: string
  id?: string
}

/** Coordenada descrita com id opcional para auditoria. */
export type LocalizacaoDescritaMatriz = Coordenada & {
  descricao?: string
  id?: string
}

export type CalcularDeltaInsercaoMatrizInput = {
  /** Origem da rota (deposito ou casa da equipe). */
  origem: LocalizacaoDescritaMatriz

  /** Destino do cliente. */
  destino: LocalizacaoDescritaMatriz

  /** Pontos da agenda ja filtrados pela data/equipe. */
  pontosAgenda: PontoRotaMatriz[]

  /**
   * Funcao injetada de distancia entre dois pontos, em metros.
   * Retorna null se a distancia nao puder ser calculada.
   * Valores negativos, NaN e Infinity sao tratados como invalidos.
   *
   * Nos testes, pode ser substituida por uma matriz ou stub sintetico.
   * Em integracao futura, pode ser uma chamada OSRM controlada.
   */
  calcularDistanciaM: (de: Coordenada, para: Coordenada) => number | null

  /** Modo de calculo. Apenas 'matriz-distancia-diagnostico' nesta versao. */
  modo?: 'matriz-distancia-diagnostico'

  /** Se true, retorna candidatosInsercao e pontosRotaBase na saida. */
  incluirDetalhes?: boolean
}

// ─── Tipos de saida ───────────────────────────────────────────────────────────

export type MelhorInsercaoMatriz = {
  /** Indice onde o destino seria inserido (0 = antes do primeiro). */
  indiceInsercao: number

  /** Identificacao do ponto anterior (null se insercao no inicio). */
  antes: string | null

  /** Identificacao do ponto posterior (null se insercao no fim aberto). */
  depois: string | null

  /** Distancia original do trecho (m). */
  custoOriginalM: number

  /** Distancia do trecho com destino inserido (m). */
  custoComDestinoM: number

  /** Delta = custoComDestinoM - custoOriginalM (m). */
  deltaM: number
}

export type PontoDescartadoMatriz = {
  /** Indice no array de entrada. */
  indice: number

  /** Motivo do descarte. */
  motivo: string
}

export type CandidatoInsercaoMatrizDetalhado = MelhorInsercaoMatriz & {
  /** Distancia do ponto anterior ao destino novo (m). */
  trechoAnteriorNovoM: number
  /** Distancia do destino novo ao ponto proximo (m). */
  trechoNovoProximoM: number
  /** Distancia original do trecho anterior→proximo (m). */
  trechoAnteriorProximoM: number
}

export type PontoRotaBaseMatrizDiagnostico = {
  indice: number
  tipo: 'origem' | 'agenda'
  label: string
  lat: number
  lng: number
  endereco?: string
}

export type CalcularDeltaInsercaoMatrizOutput = {
  ok: boolean

  /** Sempre 'matriz-distancia-diagnostico' nesta versao. */
  modo: 'matriz-distancia-diagnostico'

  /**
   * Menor delta encontrado em metros (arredondado).
   * null se nao foi possivel calcular (origem/destino invalidos ou todas as
   * insercoes invalidas).
   */
  kmAdicionalNaRotaM: number | null

  /** Detalhes da melhor insercao encontrada. null se nao aplicavel. */
  melhorInsercao: MelhorInsercaoMatriz | null

  /** Resumo para auditoria. */
  resumo: {
    quantidadePontosAgenda: number
    quantidadePontosValidos: number
    quantidadePontosInvalidos: number
    quantidadeDistanciasCalculadas: number
    quantidadeDistanciasInvalidas: number
  }

  /** Avisos informativos. */
  avisos: string[]

  /** Pontos da entrada descartados por falta de coordenada valida. */
  descartados: PontoDescartadoMatriz[]

  /** Erros criticos que impediram o calculo. */
  erros: string[]

  /** Todos os candidatos de insercao testados. Presente quando incluirDetalhes=true. */
  candidatosInsercao?: CandidatoInsercaoMatrizDetalhado[]

  /** Pontos da rota base (origem + pontos validos). Presente quando incluirDetalhes=true. */
  pontosRotaBase?: PontoRotaBaseMatrizDiagnostico[]
}

// ─── Helpers internos ────────────────────────────────────────────────────────

function coordenadaValida(c: unknown): c is Coordenada {
  if (!c || typeof c !== 'object') return false
  const p = c as Record<string, unknown>
  const lat = Number(p.lat)
  const lng = Number(p.lng)
  return Number.isFinite(lat) && Number.isFinite(lng)
}

function distanciaValida(v: number | null): v is number {
  return v !== null && Number.isFinite(v) && v >= 0
}

function identificarPonto(p: PontoRotaMatriz): string {
  if (p.id) return p.id
  if (p.eventTitle && p.addr) return `${p.eventTitle} | ${p.addr}`
  if (p.eventTitle) return p.eventTitle
  if (p.addr) return p.addr
  return JSON.stringify(p.loc)
}

function arredondar(v: number): number {
  return Math.round(v)
}

// ─── Funcao principal ─────────────────────────────────────────────────────────

/**
 * Calcula o delta de insercao de um destino em uma rota existente usando
 * funcao de distancia injetada.
 *
 * APROXIMACAO DIAGNOSTICA — nao usa Haversine internamente, nao chama OSRM.
 * Nao deve ser usado em producao.
 *
 * Regras de calculo (identicas ao helper Haversine):
 *   - Insercao antes do primeiro ponto:
 *       delta = dist(origem, destino) + dist(destino, primeiro) - dist(origem, primeiro)
 *   - Insercao entre pares:
 *       delta = dist(antes, destino) + dist(destino, depois) - dist(antes, depois)
 *   - Insercao no fim aberto (ultimo ponto -> destino):
 *       delta = dist(ultimo, destino)  (sem retorno ao deposito)
 *
 * Se uma distancia retornar null, valor negativo, NaN ou Infinity,
 * a insercao correspondente e ignorada com aviso.
 *
 * Se todas as insercoes forem invalidas: ok=false, kmAdicionalNaRotaM=null.
 * Se agenda vazia: tenta dist(origem, destino) pela funcao injetada.
 * Nunca retorna 0 silencioso para erro.
 */
export function calcularDeltaInsercaoRotaComMatrizDiagnosticoV2(
  input: CalcularDeltaInsercaoMatrizInput
): CalcularDeltaInsercaoMatrizOutput {
  const avisos: string[] = []
  const erros: string[] = []
  const descartados: PontoDescartadoMatriz[] = []
  let distanciasCalculadas = 0
  let distanciasInvalidas = 0

  function obterDistancia(de: Coordenada, para: Coordenada): number | null {
    const resultado = input.calcularDistanciaM(de, para)
    if (!distanciaValida(resultado)) {
      distanciasInvalidas++
      return null
    }
    distanciasCalculadas++
    return arredondar(resultado)
  }

  // ── 1. Validar origem ─────────────────────────────────────────────────────
  if (!coordenadaValida(input.origem)) {
    erros.push('Origem invalida: coordenadas ausentes ou nao numericas.')
    return {
      ok: false,
      modo: 'matriz-distancia-diagnostico',
      kmAdicionalNaRotaM: null,
      melhorInsercao: null,
      resumo: {
        quantidadePontosAgenda: input.pontosAgenda.length,
        quantidadePontosValidos: 0,
        quantidadePontosInvalidos: input.pontosAgenda.length,
        quantidadeDistanciasCalculadas: 0,
        quantidadeDistanciasInvalidas: 0,
      },
      avisos,
      descartados,
      erros,
    }
  }

  // ── 2. Validar destino ────────────────────────────────────────────────────
  if (!coordenadaValida(input.destino)) {
    erros.push('Destino invalido: coordenadas ausentes ou nao numericas.')
    return {
      ok: false,
      modo: 'matriz-distancia-diagnostico',
      kmAdicionalNaRotaM: null,
      melhorInsercao: null,
      resumo: {
        quantidadePontosAgenda: input.pontosAgenda.length,
        quantidadePontosValidos: 0,
        quantidadePontosInvalidos: input.pontosAgenda.length,
        quantidadeDistanciasCalculadas: 0,
        quantidadeDistanciasInvalidas: 0,
      },
      avisos,
      descartados,
      erros,
    }
  }

  // ── 3. Filtrar pontos da agenda ───────────────────────────────────────────
  const pontosValidos: PontoRotaMatriz[] = []
  for (let i = 0; i < input.pontosAgenda.length; i++) {
    const p = input.pontosAgenda[i]
    if (!coordenadaValida(p.loc)) {
      descartados.push({
        indice: i,
        motivo: `Ponto sem coordenada valida: loc=${JSON.stringify(p?.loc)}`,
      })
      continue
    }
    pontosValidos.push(p)
  }

  if (descartados.length > 0) {
    avisos.push(
      `${descartados.length} ponto(s) da agenda descartado(s) por coordenada invalida.`
    )
  }

  const pontosInvalidos = descartados.length

  // ── 4. Sem pontos validos: rota simples origem -> destino ─────────────────
  if (pontosValidos.length === 0) {
    const deltaM = obterDistancia(input.origem, input.destino)
    if (deltaM === null) {
      erros.push(
        'Agenda sem pontos validos e distancia origem -> destino retornou valor invalido.'
      )
      return {
        ok: false,
        modo: 'matriz-distancia-diagnostico',
        kmAdicionalNaRotaM: null,
        melhorInsercao: null,
        resumo: {
          quantidadePontosAgenda: input.pontosAgenda.length,
          quantidadePontosValidos: 0,
          quantidadePontosInvalidos: pontosInvalidos,
          quantidadeDistanciasCalculadas: distanciasCalculadas,
          quantidadeDistanciasInvalidas: distanciasInvalidas,
        },
        avisos,
        descartados,
        erros,
      }
    }
    avisos.push(
      'Nenhum ponto valido na agenda. Considerando rota simples origem -> destino.'
    )
    return {
      ok: true,
      modo: 'matriz-distancia-diagnostico',
      kmAdicionalNaRotaM: deltaM,
      melhorInsercao: null,
      resumo: {
        quantidadePontosAgenda: input.pontosAgenda.length,
        quantidadePontosValidos: 0,
        quantidadePontosInvalidos: pontosInvalidos,
        quantidadeDistanciasCalculadas: distanciasCalculadas,
        quantidadeDistanciasInvalidas: distanciasInvalidas,
      },
      avisos,
      descartados,
      erros,
    }
  }

  // ── 5. Com pontos validos: calcular melhor insercao ───────────────────────
  const candidatos: CandidatoInsercaoMatrizDetalhado[] = []

  // 5a. Insercao antes do primeiro ponto (origem -> destino -> ponto0)
  const primeiro = pontosValidos[0]
  const dOrigemPrimeiro = obterDistancia(input.origem, primeiro.loc)
  const dOrigemDestino = obterDistancia(input.origem, input.destino)
  const dDestinoPrimeiro = obterDistancia(input.destino, primeiro.loc)
  if (
    dOrigemPrimeiro !== null &&
    dOrigemDestino !== null &&
    dDestinoPrimeiro !== null
  ) {
    candidatos.push({
      indiceInsercao: 0,
      antes: input.origem.descricao ?? 'origem',
      depois: identificarPonto(primeiro),
      custoOriginalM: dOrigemPrimeiro,
      custoComDestinoM: dOrigemDestino + dDestinoPrimeiro,
      deltaM: dOrigemDestino + dDestinoPrimeiro - dOrigemPrimeiro,
      trechoAnteriorNovoM: dOrigemDestino,
      trechoNovoProximoM: dDestinoPrimeiro,
      trechoAnteriorProximoM: dOrigemPrimeiro,
    })
  } else {
    avisos.push('Insercao antes do primeiro ponto ignorada: distancia invalida.')
  }

  // 5b. Insercao entre cada par de pontos consecutivos
  for (let i = 0; i < pontosValidos.length - 1; i++) {
    const pAtual = pontosValidos[i]
    const pProximo = pontosValidos[i + 1]
    const dAtualProximo = obterDistancia(pAtual.loc, pProximo.loc)
    const dAtualDestino = obterDistancia(pAtual.loc, input.destino)
    const dDestinoProximo = obterDistancia(input.destino, pProximo.loc)
    if (
      dAtualProximo !== null &&
      dAtualDestino !== null &&
      dDestinoProximo !== null
    ) {
      candidatos.push({
        indiceInsercao: i + 1,
        antes: identificarPonto(pAtual),
        depois: identificarPonto(pProximo),
        custoOriginalM: dAtualProximo,
        custoComDestinoM: dAtualDestino + dDestinoProximo,
        deltaM: dAtualDestino + dDestinoProximo - dAtualProximo,
        trechoAnteriorNovoM: dAtualDestino,
        trechoNovoProximoM: dDestinoProximo,
        trechoAnteriorProximoM: dAtualProximo,
      })
    } else {
      avisos.push(
        `Insercao entre posicoes ${i} e ${i + 1} ignorada: distancia invalida.`
      )
    }
  }

  // 5c. Insercao no fim aberto (ultimo ponto -> destino)
  const ultimo = pontosValidos[pontosValidos.length - 1]
  const dUltimoDestino = obterDistancia(ultimo.loc, input.destino)
  if (dUltimoDestino !== null) {
    candidatos.push({
      indiceInsercao: pontosValidos.length,
      antes: identificarPonto(ultimo),
      depois: null,
      custoOriginalM: 0,
      custoComDestinoM: dUltimoDestino,
      deltaM: dUltimoDestino,
      trechoAnteriorNovoM: dUltimoDestino,
      trechoNovoProximoM: 0,
      trechoAnteriorProximoM: 0,
    })
  } else {
    avisos.push('Insercao no fim da rota ignorada: distancia invalida.')
  }

  // ── 6. Verificar se ha candidatos validos ─────────────────────────────────
  if (candidatos.length === 0) {
    erros.push(
      'Todas as posicoes de insercao retornaram distancias invalidas. Nao foi possivel calcular kmAdicionalNaRotaM.'
    )
    return {
      ok: false,
      modo: 'matriz-distancia-diagnostico',
      kmAdicionalNaRotaM: null,
      melhorInsercao: null,
      resumo: {
        quantidadePontosAgenda: input.pontosAgenda.length,
        quantidadePontosValidos: pontosValidos.length,
        quantidadePontosInvalidos: pontosInvalidos,
        quantidadeDistanciasCalculadas: distanciasCalculadas,
        quantidadeDistanciasInvalidas: distanciasInvalidas,
      },
      avisos,
      descartados,
      erros,
    }
  }

  // ── 7. Escolher menor delta ───────────────────────────────────────────────
  let melhor = candidatos[0]
  for (const c of candidatos) {
    if (c.deltaM < melhor.deltaM) {
      melhor = c
    }
  }

  avisos.push(
    `Melhor insercao encontrada: posicao ${melhor.indiceInsercao}, delta ${melhor.deltaM}m (funcao de distancia injetada).`
  )

  return {
    ok: true,
    modo: 'matriz-distancia-diagnostico',
    kmAdicionalNaRotaM: melhor.deltaM,
    melhorInsercao: melhor,
    resumo: {
      quantidadePontosAgenda: input.pontosAgenda.length,
      quantidadePontosValidos: pontosValidos.length,
      quantidadePontosInvalidos: pontosInvalidos,
      quantidadeDistanciasCalculadas: distanciasCalculadas,
      quantidadeDistanciasInvalidas: distanciasInvalidas,
    },
    avisos,
    descartados,
    erros,
    ...(input.incluirDetalhes
      ? {
          candidatosInsercao: candidatos,
          pontosRotaBase: [
            {
              indice: 0,
              tipo: 'origem' as const,
              label: input.origem.descricao ?? 'origem',
              lat: input.origem.lat,
              lng: input.origem.lng,
            },
            ...pontosValidos.map((p, i) => ({
              indice: i + 1,
              tipo: 'agenda' as const,
              label: identificarPonto(p),
              lat: p.loc.lat,
              lng: p.loc.lng,
              endereco: p.addr,
            })),
          ],
        }
      : {}),
  }
}
