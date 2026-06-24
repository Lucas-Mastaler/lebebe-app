// ─────────────────────────────────────────────────────────────────────────────
// calcular-delta-insercao-equivalencia.test.ts
//
//   Prova matematica de que calcularDeltaInsercaoRotaComMatrizDiagnosticoV2,
//   quando recebe a mesma logica Haversine injetada, produz resultados
//   identicos ao calcularDeltaInsercaoRotaDiagnosticoV2.
//
//   Isso valida que o contrato de injecao esta correto e prepara o caminho
//   para OSRM controlado (basta substituir a funcao injetada).
//
//   NAO chama OSRM.
//   NAO faz I/O externo.
//   NAO usa process.env.
//   NAO depende de data atual.
//   NAO muta inputs.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest'
import { calcularDeltaInsercaoRotaDiagnosticoV2, type PontoAgendaDelta } from './calcular-delta-insercao-rota'
import { calcularDeltaInsercaoRotaComMatrizDiagnosticoV2, type PontoRotaMatriz } from './calcular-delta-insercao-matriz'
import { haversineKm, type Coordenada } from './distancia'

// ─── Adaptador Haversine → funcao injetavel ───────────────────────────────────
//
// Reproduz exatamente o que distanciaMetros() faz no helper Haversine:
//   Math.round(haversineKm(a, b) * 1000)
//
// Retorna null se qualquer coordenada for invalida (nunca ocorre com inputs
// ja validados pelo helper, mas a assinatura exige number | null).

function haversineInjetado(de: Coordenada, para: Coordenada): number | null {
  if (
    !Number.isFinite(de.lat) ||
    !Number.isFinite(de.lng) ||
    !Number.isFinite(para.lat) ||
    !Number.isFinite(para.lng)
  ) {
    return null
  }
  return Math.round(haversineKm(de, para) * 1000)
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const ORIGEM = { lat: -25.45, lng: -49.29, descricao: 'Deposito' }
const DESTINO = { lat: -25.42, lng: -49.27, descricao: 'Cliente' }

const PONTO_A: PontoAgendaDelta & PontoRotaMatriz = { loc: { lat: -25.445, lng: -49.285 }, addr: 'Rua A', eventTitle: 'ENTREGA A' }
const PONTO_B: PontoAgendaDelta & PontoRotaMatriz = { loc: { lat: -25.435, lng: -49.275 }, addr: 'Rua B', eventTitle: 'ENTREGA B' }
const PONTO_C: PontoAgendaDelta & PontoRotaMatriz = { loc: { lat: -25.425, lng: -49.265 }, addr: 'Rua C', eventTitle: 'ENTREGA C' }

// Ponto com coordenada invalida (descartado por ambos os helpers)
const PONTO_INVALIDO: PontoAgendaDelta & PontoRotaMatriz = { loc: { lat: NaN, lng: -49.28 }, addr: 'Invalido' }

// ─── Helper para comparar os dois resultados ─────────────────────────────────

function rodarAmbos(
  pontosAgenda: (PontoAgendaDelta & PontoRotaMatriz)[]
) {
  const inputBase = { origem: ORIGEM, destino: DESTINO }

  const resultadoHaversine = calcularDeltaInsercaoRotaDiagnosticoV2({
    ...inputBase,
    pontosAgenda,
    modo: 'haversine-diagnostico',
  })

  const resultadoMatriz = calcularDeltaInsercaoRotaComMatrizDiagnosticoV2({
    ...inputBase,
    pontosAgenda,
    calcularDistanciaM: haversineInjetado,
    modo: 'matriz-distancia-diagnostico',
  })

  return { resultadoHaversine, resultadoMatriz }
}

// ─── Testes de equivalencia ───────────────────────────────────────────────────

describe('Equivalencia matematica: Haversine original vs Matriz com Haversine injetado', () => {

  // ── 1. Agenda vazia ─────────────────────────────────────────────────────────
  it('1. agenda vazia: ok, kmAdicionalNaRotaM e melhorInsercao identicos', () => {
    const { resultadoHaversine, resultadoMatriz } = rodarAmbos([])

    expect(resultadoMatriz.ok).toBe(resultadoHaversine.ok)
    expect(resultadoMatriz.kmAdicionalNaRotaM).toBe(resultadoHaversine.kmAdicionalNaRotaM)
    expect(resultadoMatriz.melhorInsercao).toBeNull()
    expect(resultadoHaversine.melhorInsercao).toBeNull()
    // Confirmar que o valor nao e 0 em caso de erro
    expect(resultadoMatriz.kmAdicionalNaRotaM).not.toBe(0)
  })

  // ── 2. Um ponto valido ──────────────────────────────────────────────────────
  it('2. um ponto valido: ok, kmAdicionalNaRotaM, indiceInsercao e deltaM identicos', () => {
    const { resultadoHaversine, resultadoMatriz } = rodarAmbos([PONTO_A])

    expect(resultadoMatriz.ok).toBe(resultadoHaversine.ok)
    expect(resultadoMatriz.kmAdicionalNaRotaM).toBe(resultadoHaversine.kmAdicionalNaRotaM)
    expect(resultadoMatriz.melhorInsercao?.indiceInsercao).toBe(
      resultadoHaversine.melhorInsercao?.indiceInsercao
    )
    expect(resultadoMatriz.melhorInsercao?.deltaM).toBe(resultadoHaversine.melhorInsercao?.deltaM)
    expect(resultadoMatriz.melhorInsercao?.custoOriginalM).toBe(
      resultadoHaversine.melhorInsercao?.custoOriginalM
    )
    expect(resultadoMatriz.melhorInsercao?.custoComDestinoM).toBe(
      resultadoHaversine.melhorInsercao?.custoComDestinoM
    )
  })

  // ── 3–5. Multiplos pontos — melhor insercao em todas as posicoes ────────────
  it('3. multiplos pontos (3): kmAdicionalNaRotaM e melhorInsercao identicos', () => {
    const { resultadoHaversine, resultadoMatriz } = rodarAmbos([PONTO_A, PONTO_B, PONTO_C])

    expect(resultadoMatriz.ok).toBe(resultadoHaversine.ok)
    expect(resultadoMatriz.kmAdicionalNaRotaM).toBe(resultadoHaversine.kmAdicionalNaRotaM)
    expect(resultadoMatriz.melhorInsercao?.indiceInsercao).toBe(
      resultadoHaversine.melhorInsercao?.indiceInsercao
    )
    expect(resultadoMatriz.melhorInsercao?.deltaM).toBe(resultadoHaversine.melhorInsercao?.deltaM)
    expect(resultadoMatriz.melhorInsercao?.custoOriginalM).toBe(
      resultadoHaversine.melhorInsercao?.custoOriginalM
    )
    expect(resultadoMatriz.melhorInsercao?.custoComDestinoM).toBe(
      resultadoHaversine.melhorInsercao?.custoComDestinoM
    )
  })

  it('4. dois pontos onde melhor insercao pode ser no inicio (origem proxima ao destino)', () => {
    // Destino muito proximo da origem → inserção antes do P0 tende a ser melhor
    const destinoProximoOrigem = { lat: -25.451, lng: -49.291, descricao: 'Perto da origem' }
    const pontos = [PONTO_C] // ponto C distante do destino

    const hav = calcularDeltaInsercaoRotaDiagnosticoV2({
      origem: ORIGEM,
      destino: destinoProximoOrigem,
      pontosAgenda: pontos,
      modo: 'haversine-diagnostico',
    })
    const mat = calcularDeltaInsercaoRotaComMatrizDiagnosticoV2({
      origem: ORIGEM,
      destino: destinoProximoOrigem,
      pontosAgenda: pontos,
      calcularDistanciaM: haversineInjetado,
      modo: 'matriz-distancia-diagnostico',
    })

    expect(mat.ok).toBe(hav.ok)
    expect(mat.kmAdicionalNaRotaM).toBe(hav.kmAdicionalNaRotaM)
    expect(mat.melhorInsercao?.indiceInsercao).toBe(hav.melhorInsercao?.indiceInsercao)
    expect(mat.melhorInsercao?.deltaM).toBe(hav.melhorInsercao?.deltaM)
  })

  it('5. dois pontos onde melhor insercao pode ser no fim aberto (destino apos ultimo ponto)', () => {
    // Destino na direcao do ultimo ponto → fim aberto tende a ser melhor
    const destinoAposC = { lat: -25.41, lng: -49.255, descricao: 'Apos C' }
    const pontos = [PONTO_A, PONTO_C]

    const hav = calcularDeltaInsercaoRotaDiagnosticoV2({
      origem: ORIGEM,
      destino: destinoAposC,
      pontosAgenda: pontos,
      modo: 'haversine-diagnostico',
    })
    const mat = calcularDeltaInsercaoRotaComMatrizDiagnosticoV2({
      origem: ORIGEM,
      destino: destinoAposC,
      pontosAgenda: pontos,
      calcularDistanciaM: haversineInjetado,
      modo: 'matriz-distancia-diagnostico',
    })

    expect(mat.ok).toBe(hav.ok)
    expect(mat.kmAdicionalNaRotaM).toBe(hav.kmAdicionalNaRotaM)
    expect(mat.melhorInsercao?.indiceInsercao).toBe(hav.melhorInsercao?.indiceInsercao)
    expect(mat.melhorInsercao?.deltaM).toBe(hav.melhorInsercao?.deltaM)
  })

  // ── 6. Ponto invalido descartado ────────────────────────────────────────────
  it('6. ponto invalido: ambos descartam, kmAdicionalNaRotaM identico', () => {
    const { resultadoHaversine, resultadoMatriz } = rodarAmbos([PONTO_A, PONTO_INVALIDO])

    expect(resultadoMatriz.ok).toBe(resultadoHaversine.ok)
    expect(resultadoMatriz.kmAdicionalNaRotaM).toBe(resultadoHaversine.kmAdicionalNaRotaM)
    // Ambos descartam 1 ponto
    expect(resultadoMatriz.descartados).toHaveLength(1)
    expect(resultadoHaversine.descartados).toHaveLength(1)
    // Resumo de pontos validos/invalidos identico
    expect(resultadoMatriz.resumo.quantidadePontosValidos).toBe(
      resultadoHaversine.resumo.quantidadePontosValidos
    )
    expect(resultadoMatriz.resumo.quantidadePontosInvalidos).toBe(
      resultadoHaversine.resumo.quantidadePontosInvalidos
    )
  })

  // ── 7. Origem invalida ──────────────────────────────────────────────────────
  it('7. origem invalida: ambos retornam ok=false, kmAdicionalNaRotaM=null', () => {
    const origemInvalida = { lat: NaN, lng: -49.29 }

    const hav = calcularDeltaInsercaoRotaDiagnosticoV2({
      origem: origemInvalida,
      destino: DESTINO,
      pontosAgenda: [PONTO_A],
      modo: 'haversine-diagnostico',
    })
    const mat = calcularDeltaInsercaoRotaComMatrizDiagnosticoV2({
      origem: origemInvalida,
      destino: DESTINO,
      pontosAgenda: [PONTO_A],
      calcularDistanciaM: haversineInjetado,
      modo: 'matriz-distancia-diagnostico',
    })

    expect(mat.ok).toBe(false)
    expect(hav.ok).toBe(false)
    expect(mat.kmAdicionalNaRotaM).toBeNull()
    expect(hav.kmAdicionalNaRotaM).toBeNull()
  })

  // ── 8. Destino invalido ─────────────────────────────────────────────────────
  it('8. destino invalido: ambos retornam ok=false, kmAdicionalNaRotaM=null', () => {
    const destinoInvalido = { lat: -25.42, lng: NaN }

    const hav = calcularDeltaInsercaoRotaDiagnosticoV2({
      origem: ORIGEM,
      destino: destinoInvalido,
      pontosAgenda: [PONTO_A],
      modo: 'haversine-diagnostico',
    })
    const mat = calcularDeltaInsercaoRotaComMatrizDiagnosticoV2({
      origem: ORIGEM,
      destino: destinoInvalido,
      pontosAgenda: [PONTO_A],
      calcularDistanciaM: haversineInjetado,
      modo: 'matriz-distancia-diagnostico',
    })

    expect(mat.ok).toBe(false)
    expect(hav.ok).toBe(false)
    expect(mat.kmAdicionalNaRotaM).toBeNull()
    expect(hav.kmAdicionalNaRotaM).toBeNull()
  })

  // ── 9. Verificacao de resumo de pontos ──────────────────────────────────────
  it('9. resumo de quantidades de pontos identico (validos e invalidos)', () => {
    const { resultadoHaversine, resultadoMatriz } = rodarAmbos([PONTO_A, PONTO_B, PONTO_INVALIDO])

    expect(resultadoMatriz.resumo.quantidadePontosAgenda).toBe(
      resultadoHaversine.resumo.quantidadePontosAgenda
    )
    expect(resultadoMatriz.resumo.quantidadePontosValidos).toBe(
      resultadoHaversine.resumo.quantidadePontosValidos
    )
    expect(resultadoMatriz.resumo.quantidadePontosInvalidos).toBe(
      resultadoHaversine.resumo.quantidadePontosInvalidos
    )
  })

  // ── 10. Confirmar que valores sao exatamente iguais (sem tolerancia) ─────────
  it('10. valores sao exatamente iguais — sem tolerancia de arredondamento necessaria', () => {
    // Testa varios cenarios em sequencia para garantir igualdade exata
    const cenarios = [
      [],
      [PONTO_A],
      [PONTO_B],
      [PONTO_C],
      [PONTO_A, PONTO_B],
      [PONTO_B, PONTO_C],
      [PONTO_A, PONTO_B, PONTO_C],
    ]

    for (const pontos of cenarios) {
      const { resultadoHaversine, resultadoMatriz } = rodarAmbos(pontos)
      expect(resultadoMatriz.kmAdicionalNaRotaM).toBe(resultadoHaversine.kmAdicionalNaRotaM)
      if (resultadoHaversine.melhorInsercao && resultadoMatriz.melhorInsercao) {
        expect(resultadoMatriz.melhorInsercao.deltaM).toBe(
          resultadoHaversine.melhorInsercao.deltaM
        )
        expect(resultadoMatriz.melhorInsercao.indiceInsercao).toBe(
          resultadoHaversine.melhorInsercao.indiceInsercao
        )
        expect(resultadoMatriz.melhorInsercao.custoOriginalM).toBe(
          resultadoHaversine.melhorInsercao.custoOriginalM
        )
        expect(resultadoMatriz.melhorInsercao.custoComDestinoM).toBe(
          resultadoHaversine.melhorInsercao.custoComDestinoM
        )
      }
    }
  })

  // ── 11. Confirmar modos distintos mas comportamento identico ─────────────────
  it('11. modos sao distintos (haversine-diagnostico vs matriz-distancia-diagnostico)', () => {
    const { resultadoHaversine, resultadoMatriz } = rodarAmbos([PONTO_A])

    expect(resultadoHaversine.modo).toBe('haversine-diagnostico')
    expect(resultadoMatriz.modo).toBe('matriz-distancia-diagnostico')
    // Mas o resultado numerico e o mesmo
    expect(resultadoMatriz.kmAdicionalNaRotaM).toBe(resultadoHaversine.kmAdicionalNaRotaM)
  })
})
