// ─────────────────────────────────────────────────────────────────────────────
// motor/calcular-delta-insercao-rota.ts
//   Helper puro de aproximacao diagnostica para kmAdicionalNaRotaM
//
//   Calcula o melhor ponto de insercao de um novo destino em uma rota
//   existente, usando Haversine como aproximacao.
//
//   NAO e o calculo fiel do legado (que usa OSRM batch).
//   NAO deve ser usado em producao.
//   NAO faz I/O externo.
//
//   Regras:
//   - Se nao houver pontos validos na agenda: delta = dist(origem, destino)
//     (rota simples origem -> destino)
//   - Se houver pontos validos: testa insercao em todas as posicoes
//     (antes do primeiro, entre pares, depois do ultimo)
//   - Insercao no fim aberto: dist(ultimo, destino)
//     (nao subtrai retorno ao deposito — contrato atual nao o confirma)
//   - Delta de insercao no meio:
//     dist(antes, destino) + dist(destino, depois) - dist(antes, depois)
//   - Arredonda metros com Math.round
//   - Nunca retorna 0 silencioso para erro → retorna null com aviso
// ─────────────────────────────────────────────────────────────────────────────

import { haversineKm } from './distancia'
import type { Coordenada } from './distancia'

// ─── Tipos de entrada ─────────────────────────────────────────────────────────

/** Coordenada com descricao opcional para auditoria. */
export type LocalizacaoDescrita = Coordenada & { descricao?: string }

/** Ponto da agenda com coordenadas para montar rota. */
export type PontoAgendaDelta = {
  loc: Coordenada
  addr?: string
  eventTitle?: string
  team?: string
}

export type CalcularDeltaInsercaoRotaInput = {
  /** Origem da rota (deposito ou casa da equipe). */
  origem: LocalizacaoDescrita

  /** Destino do cliente. */
  destino: LocalizacaoDescrita

  /** Pontos da agenda ja filtrados pela data/equipe. */
  pontosAgenda: PontoAgendaDelta[]

  /** Modo de calculo. Apenas haversine-diagnostico nesta versao. */
  modo?: 'haversine-diagnostico'

  /** Se true, retorna candidatosInsercao e pontosRotaBase na saida. */
  incluirDetalhes?: boolean
}

// ─── Tipos de saida ──────────────────────────────────────────────────────────

export type MelhorInsercao = {
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

export type PontoDescartadoDelta = {
  /** Indice no array de entrada. */
  indice: number

  /** Motivo do descarte. */
  motivo: string
}

export type CandidatoInsercaoDetalhado = MelhorInsercao & {
  /** Distancia do ponto anterior ao destino novo (m). */
  trechoAnteriorNovoM: number
  /** Distancia do destino novo ao ponto proximo (m). */
  trechoNovoProximoM: number
  /** Distancia original do trecho anterior→proximo (m). */
  trechoAnteriorProximoM: number
}

export type PontoRotaBaseDiagnostico = {
  indice: number
  tipo: 'origem' | 'agenda'
  label: string
  lat: number
  lng: number
  endereco?: string
}

export type CalcularDeltaInsercaoRotaOutput = {
  ok: boolean

  /** Sempre 'haversine-diagnostico' nesta versao. */
  modo: 'haversine-diagnostico'

  /**
   * Menor delta encontrado em metros (arredondado).
   * null se nao foi possivel calcular (origem/destino invalidos).
   */
  kmAdicionalNaRotaM: number | null

  /** Detalhes da melhor insercao encontrada. null se nao aplicavel. */
  melhorInsercao: MelhorInsercao | null

  /** Resumo para auditoria. */
  resumo: {
    quantidadePontosAgenda: number
    quantidadePontosValidos: number
    quantidadePontosInvalidos: number
  }

  /** Avisos informativos. */
  avisos: string[]

  /** Pontos da entrada descartados por falta de coordenada. */
  descartados: PontoDescartadoDelta[]

  /** Todos os candidatos de insercao testados. Presente quando incluirDetalhes=true. */
  candidatosInsercao?: CandidatoInsercaoDetalhado[]

  /** Pontos da rota base (origem + pontos validos). Presente quando incluirDetalhes=true. */
  pontosRotaBase?: PontoRotaBaseDiagnostico[]
}

// ─── Helpers internos ───────────────────────────────────────────────────────

function coordenadaValida(c: unknown): c is Coordenada {
  if (!c || typeof c !== 'object') return false
  const p = c as Record<string, unknown>
  const lat = Number(p.lat)
  const lng = Number(p.lng)
  return Number.isFinite(lat) && Number.isFinite(lng)
}

function distanciaMetros(a: Coordenada, b: Coordenada): number {
  return Math.round(haversineKm(a, b) * 1000)
}

function identificarPonto(p: PontoAgendaDelta): string {
  if (p.eventTitle && p.addr) return `${p.eventTitle} | ${p.addr}`
  if (p.eventTitle) return p.eventTitle
  if (p.addr) return p.addr
  return JSON.stringify(p.loc)
}

// ─── Funcao principal ─────────────────────────────────────────────────────────

/**
 * Calcula o delta de insercao aproximado de um destino em uma rota existente.
 *
 * APROXIMACAO DIAGNOSTICA — usa Haversine, nao OSRM.
 * Nao deve ser usado em producao.
 *
 * Regras:
 *   - Agenda vazia ou sem pontos validos:
 *       kmAdicionalNaRotaM = distancia(origem, destino) em metros
 *       (rota simples origem -> destino)
 *   - Agenda com pontos validos:
 *       Testa insercao em todas as posicoes (inicio, meio, fim)
 *       Escolhe a que gera menor delta
 *   - Insercao no fim aberto (apos ultimo ponto):
 *       delta = distancia(ultimo, destino)
 *       (nao subtrai retorno ao deposito — nao confirmado no contrato)
 *   - Pontos da entrada sem coordenada valida sao descartados com motivo.
 *   - Origem ou destino invalidos: ok=false, kmAdicionalNaRotaM=null.
 *   - Nunca retorna 0 silencioso para erro.
 */
export function calcularDeltaInsercaoRotaDiagnosticoV2(
  input: CalcularDeltaInsercaoRotaInput
): CalcularDeltaInsercaoRotaOutput {
  const avisos: string[] = []
  const descartados: PontoDescartadoDelta[] = []

  // ── 1. Validar origem ────────────────────────────────────────────────────
  if (!coordenadaValida(input.origem)) {
    avisos.push('Origem invalida: coordenadas ausentes ou nao numericas.')
    return {
      ok: false,
      modo: 'haversine-diagnostico',
      kmAdicionalNaRotaM: null,
      melhorInsercao: null,
      resumo: {
        quantidadePontosAgenda: input.pontosAgenda.length,
        quantidadePontosValidos: 0,
        quantidadePontosInvalidos: input.pontosAgenda.length,
      },
      avisos,
      descartados,
    }
  }

  // ── 2. Validar destino ───────────────────────────────────────────────────
  if (!coordenadaValida(input.destino)) {
    avisos.push('Destino invalido: coordenadas ausentes ou nao numericas.')
    return {
      ok: false,
      modo: 'haversine-diagnostico',
      kmAdicionalNaRotaM: null,
      melhorInsercao: null,
      resumo: {
        quantidadePontosAgenda: input.pontosAgenda.length,
        quantidadePontosValidos: 0,
        quantidadePontosInvalidos: input.pontosAgenda.length,
      },
      avisos,
      descartados,
    }
  }

  // ── 3. Filtrar pontos da agenda ──────────────────────────────────────────
  const pontosValidos: PontoAgendaDelta[] = []
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

  // ── 4. Sem pontos validos: rota simples origem -> destino ────────────────
  if (pontosValidos.length === 0) {
    const deltaM = distanciaMetros(input.origem, input.destino)
    avisos.push(
      'Nenhum ponto valido na agenda. Considerando rota simples origem -> destino.'
    )
    return {
      ok: true,
      modo: 'haversine-diagnostico',
      kmAdicionalNaRotaM: deltaM,
      melhorInsercao: null,
      resumo: {
        quantidadePontosAgenda: input.pontosAgenda.length,
        quantidadePontosValidos: 0,
        quantidadePontosInvalidos: descartados.length,
      },
      avisos,
      descartados,
    }
  }

  // ── 5. Com pontos validos: calcular melhor insercao ──────────────────────
  const candidatos: CandidatoInsercaoDetalhado[] = []

  // 5a. Insercao antes do primeiro ponto (origem -> destino -> ponto0)
  const primeiro = pontosValidos[0]
  const distOrigemPrimeiro = distanciaMetros(input.origem, primeiro.loc)
  const distOrigemDestino = distanciaMetros(input.origem, input.destino)
  const distDestinoPrimeiro = distanciaMetros(input.destino, primeiro.loc)
  candidatos.push({
    indiceInsercao: 0,
    antes: input.origem.descricao ?? 'origem',
    depois: identificarPonto(primeiro),
    custoOriginalM: distOrigemPrimeiro,
    custoComDestinoM: distOrigemDestino + distDestinoPrimeiro,
    deltaM: distOrigemDestino + distDestinoPrimeiro - distOrigemPrimeiro,
    trechoAnteriorNovoM: distOrigemDestino,
    trechoNovoProximoM: distDestinoPrimeiro,
    trechoAnteriorProximoM: distOrigemPrimeiro,
  })

  // 5b. Insercao entre cada par de pontos consecutivos
  for (let i = 0; i < pontosValidos.length - 1; i++) {
    const pAtual = pontosValidos[i]
    const pProximo = pontosValidos[i + 1]
    const distAtualProximo = distanciaMetros(pAtual.loc, pProximo.loc)
    const distAtualDestino = distanciaMetros(pAtual.loc, input.destino)
    const distDestinoProximo = distanciaMetros(input.destino, pProximo.loc)
    candidatos.push({
      indiceInsercao: i + 1,
      antes: identificarPonto(pAtual),
      depois: identificarPonto(pProximo),
      custoOriginalM: distAtualProximo,
      custoComDestinoM: distAtualDestino + distDestinoProximo,
      deltaM: distAtualDestino + distDestinoProximo - distAtualProximo,
      trechoAnteriorNovoM: distAtualDestino,
      trechoNovoProximoM: distDestinoProximo,
      trechoAnteriorProximoM: distAtualProximo,
    })
  }

  // 5c. Insercao no fim aberto (ultimo ponto -> destino)
  const ultimo = pontosValidos[pontosValidos.length - 1]
  const distUltimoDestino = distanciaMetros(ultimo.loc, input.destino)
  candidatos.push({
    indiceInsercao: pontosValidos.length,
    antes: identificarPonto(ultimo),
    depois: null,
    custoOriginalM: 0,
    custoComDestinoM: distUltimoDestino,
    deltaM: distUltimoDestino,
    trechoAnteriorNovoM: distUltimoDestino,
    trechoNovoProximoM: 0,
    trechoAnteriorProximoM: 0,
  })

  // Escolhe menor delta
  let melhor = candidatos[0]
  for (const c of candidatos) {
    if (c.deltaM < melhor.deltaM) {
      melhor = c
    }
  }

  avisos.push(
    `Melhor insercao encontrada: posicao ${melhor.indiceInsercao}, delta ${melhor.deltaM}m (aproximacao Haversine).`
  )

  return {
    ok: true,
    modo: 'haversine-diagnostico',
    kmAdicionalNaRotaM: melhor.deltaM,
    melhorInsercao: melhor,
    resumo: {
      quantidadePontosAgenda: input.pontosAgenda.length,
      quantidadePontosValidos: pontosValidos.length,
      quantidadePontosInvalidos: descartados.length,
    },
    avisos,
    descartados,
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
