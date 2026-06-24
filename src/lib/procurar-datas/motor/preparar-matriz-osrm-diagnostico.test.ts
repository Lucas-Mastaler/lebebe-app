import { describe, it, expect, vi } from 'vitest'
import {
  prepararMatrizOSRMDiagnosticoV2,
  criarCalculadorDistanciaPorMatriz,
  criarCalculadorDistanciaPorCoordenadas,
  type PontoRotaOSRM,
  type ResultadoMatrizOSRM,
} from './preparar-matriz-osrm-diagnostico'
import { calcularDeltaInsercaoRotaComMatrizDiagnosticoV2 } from './calcular-delta-insercao-matriz'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const PONTO_A: PontoRotaOSRM = { id: 'a', lat: -25.45, lng: -49.29, descricao: 'Origem' }
const PONTO_B: PontoRotaOSRM = { id: 'b', lat: -25.43, lng: -49.27, descricao: 'Ponto B' }
const PONTO_C: PontoRotaOSRM = { id: 'c', lat: -25.42, lng: -49.26, descricao: 'Ponto C' }

// Retorno mock de OSRM para 3 pontos: distances[i][j] em metros
function mockOSRM3Pontos(override?: Partial<ResultadoMatrizOSRM>) {
  return vi.fn().mockResolvedValue({
    distances: [
      [0, 1500, 2800],
      [1500, 0, 900],
      [2800, 900, 0],
    ],
    ...override,
  })
}

// ─── Testes ───────────────────────────────────────────────────────────────────

describe('prepararMatrizOSRMDiagnosticoV2', () => {

  // ── 1. Monta matriz válida com 3 pontos ──────────────────────────────────
  it('1. monta matriz valida com 3 pontos', async () => {
    const resultado = await prepararMatrizOSRMDiagnosticoV2({
      pontos: [PONTO_A, PONTO_B, PONTO_C],
      buscarMatrizOSRM: mockOSRM3Pontos(),
    })

    expect(resultado.ok).toBe(true)
    expect(resultado.modo).toBe('osrm-mockavel-diagnostico')
    expect(resultado.matrizMetros['a']['b']).toBe(1500)
    expect(resultado.matrizMetros['a']['c']).toBe(2800)
    expect(resultado.matrizMetros['b']['c']).toBe(900)
    expect(resultado.matrizMetros['b']['a']).toBe(1500)
    expect(resultado.matrizMetros['c']['b']).toBe(900)
    expect(resultado.resumo.pontosValidos).toBe(3)
    expect(resultado.resumo.distanciasValidas).toBe(9) // 3x3
    expect(resultado.erros).toHaveLength(0)
  })

  // ── 2. criarCalculadorDistanciaPorMatriz retorna distância correta A→B ───
  it('2. criarCalculadorDistanciaPorMatriz retorna distancia correta A→B', async () => {
    const resultado = await prepararMatrizOSRMDiagnosticoV2({
      pontos: [PONTO_A, PONTO_B],
      buscarMatrizOSRM: vi.fn().mockResolvedValue({
        distances: [[0, 1234], [1234, 0]],
      }),
    })
    expect(resultado.ok).toBe(true)

    const fn = criarCalculadorDistanciaPorMatriz(resultado.matrizMetros)
    const distAB = fn(
      { lat: PONTO_A.lat, lng: PONTO_A.lng, id: 'a' },
      { lat: PONTO_B.lat, lng: PONTO_B.lng, id: 'b' }
    )
    expect(distAB).toBe(1234)
  })

  // ── 3. Retorna null quando par não existe na matriz ──────────────────────
  it('3. retorna null quando par nao existe na matriz', async () => {
    const resultado = await prepararMatrizOSRMDiagnosticoV2({
      pontos: [PONTO_A, PONTO_B],
      buscarMatrizOSRM: vi.fn().mockResolvedValue({
        distances: [[0, 500], [500, 0]],
      }),
    })
    const fn = criarCalculadorDistanciaPorMatriz(resultado.matrizMetros)

    // par com id inexistente na matriz
    const distAZ = fn(
      { lat: PONTO_A.lat, lng: PONTO_A.lng, id: 'a' },
      { lat: 0, lng: 0, id: 'z' }
    )
    expect(distAZ).toBeNull()

    // ponto sem id
    const distSemId = fn(
      { lat: PONTO_A.lat, lng: PONTO_A.lng },
      { lat: PONTO_B.lat, lng: PONTO_B.lng }
    )
    expect(distSemId).toBeNull()
  })

  // ── 4. Descarta ponto com coordenada inválida ────────────────────────────
  it('4. descarta ponto com coordenada invalida (NaN)', async () => {
    const pontoInvalido: PontoRotaOSRM = { id: 'x', lat: NaN, lng: -49.27 }
    const resultado = await prepararMatrizOSRMDiagnosticoV2({
      pontos: [PONTO_A, pontoInvalido, PONTO_B],
      buscarMatrizOSRM: vi.fn().mockResolvedValue({
        distances: [[0, 500], [500, 0]],
      }),
    })
    expect(resultado.ok).toBe(true)
    expect(resultado.descartados).toHaveLength(1)
    expect(resultado.descartados[0].id).toBe('x')
    expect(resultado.descartados[0].motivo).toContain('Coordenada invalida')
    expect(resultado.resumo.pontosInvalidos).toBe(1)
    expect(resultado.resumo.pontosValidos).toBe(2)
    expect(Object.keys(resultado.matrizMetros)).not.toContain('x')
  })

  // ── 5. Trata distância negativa como inválida → null ─────────────────────
  it('5. trata distancia negativa como invalida e coloca null', async () => {
    const resultado = await prepararMatrizOSRMDiagnosticoV2({
      pontos: [PONTO_A, PONTO_B],
      buscarMatrizOSRM: vi.fn().mockResolvedValue({
        distances: [[0, -500], [-500, 0]],
      }),
    })
    expect(resultado.ok).toBe(true)
    expect(resultado.matrizMetros['a']['b']).toBeNull()
    expect(resultado.matrizMetros['b']['a']).toBeNull()
    expect(resultado.resumo.distanciasInvalidas).toBeGreaterThan(0)
    expect(resultado.avisos.some((a) => a.includes('invalida'))).toBe(true)
  })

  // ── 6. Trata NaN como inválido ───────────────────────────────────────────
  it('6. trata NaN como invalido e coloca null', async () => {
    const resultado = await prepararMatrizOSRMDiagnosticoV2({
      pontos: [PONTO_A, PONTO_B],
      buscarMatrizOSRM: vi.fn().mockResolvedValue({
        distances: [[0, NaN], [NaN, 0]],
      }),
    })
    expect(resultado.ok).toBe(true)
    expect(resultado.matrizMetros['a']['b']).toBeNull()
    expect(resultado.resumo.distanciasInvalidas).toBeGreaterThan(0)
  })

  // ── 7. Trata Infinity como inválido ─────────────────────────────────────
  it('7. trata Infinity como invalido e coloca null', async () => {
    const resultado = await prepararMatrizOSRMDiagnosticoV2({
      pontos: [PONTO_A, PONTO_B],
      buscarMatrizOSRM: vi.fn().mockResolvedValue({
        distances: [[0, Infinity], [Infinity, 0]],
      }),
    })
    expect(resultado.ok).toBe(true)
    expect(resultado.matrizMetros['a']['b']).toBeNull()
    expect(resultado.resumo.distanciasInvalidas).toBeGreaterThan(0)
  })

  // ── 8. Nunca retorna 0 como fallback de erro ─────────────────────────────
  it('8. nao retorna 0 como fallback em erro: kmAdicionalNaRotaM null, nao 0', async () => {
    // Mock que retorna null para todas as distancias uteis
    const resultado = await prepararMatrizOSRMDiagnosticoV2({
      pontos: [PONTO_A, PONTO_B],
      buscarMatrizOSRM: vi.fn().mockResolvedValue({
        distances: [[0, null], [null, 0]],
      }),
    })
    expect(resultado.ok).toBe(true)
    expect(resultado.matrizMetros['a']['b']).toBeNull()
    expect(resultado.matrizMetros['b']['a']).toBeNull()

    const fn = criarCalculadorDistanciaPorMatriz(resultado.matrizMetros)
    const dist = fn(
      { lat: PONTO_A.lat, lng: PONTO_A.lng, id: 'a' },
      { lat: PONTO_B.lat, lng: PONTO_B.lng, id: 'b' }
    )
    expect(dist).toBeNull()
    expect(dist).not.toBe(0)
  })

  // ── 9. Propaga erro do mock OSRM como ok=false ───────────────────────────
  it('9. propaga erro lancado por buscarMatrizOSRM como ok=false', async () => {
    const mockFalho = vi.fn().mockRejectedValue(new Error('OSRM timeout'))
    const resultado = await prepararMatrizOSRMDiagnosticoV2({
      pontos: [PONTO_A, PONTO_B],
      buscarMatrizOSRM: mockFalho,
    })
    expect(resultado.ok).toBe(false)
    expect(resultado.erros.some((e) => e.includes('OSRM timeout'))).toBe(true)
    expect(resultado.matrizMetros).toEqual({})
  })

  // ── 10. Não chama OSRM real (confirma uso de mock) ───────────────────────
  it('10. nao chama OSRM real: buscarMatrizOSRM e chamada com coordenadas corretas', async () => {
    const mock = vi.fn().mockResolvedValue({
      distances: [[0, 700], [700, 0]],
    })
    await prepararMatrizOSRMDiagnosticoV2({
      pontos: [PONTO_A, PONTO_B],
      buscarMatrizOSRM: mock,
    })
    expect(mock).toHaveBeenCalledTimes(1)
    const coordsPassadas = mock.mock.calls[0][0]
    expect(coordsPassadas).toHaveLength(2)
    expect(coordsPassadas[0]).toEqual({ lat: PONTO_A.lat, lng: PONTO_A.lng })
    expect(coordsPassadas[1]).toEqual({ lat: PONTO_B.lat, lng: PONTO_B.lng })
  })

  // ── 11. Não usa fetch real nem process.env ──────────────────────────────
  it('11. helper puro: sem fetch real, sem process.env', async () => {
    const mock = vi.fn().mockResolvedValue({ distances: [[0, 300], [300, 0]] })
    await expect(
      prepararMatrizOSRMDiagnosticoV2({
        pontos: [PONTO_A, PONTO_B],
        buscarMatrizOSRM: mock,
      })
    ).resolves.not.toThrow()
  })

  // ── 12. Não muta input ──────────────────────────────────────────────────
  it('12. nao muta o array de pontos do input', async () => {
    const pontos = [{ ...PONTO_A }, { ...PONTO_B }]
    const copiaAntes = JSON.stringify(pontos)
    const mock = vi.fn().mockResolvedValue({ distances: [[0, 400], [400, 0]] })
    await prepararMatrizOSRMDiagnosticoV2({ pontos, buscarMatrizOSRM: mock })
    expect(JSON.stringify(pontos)).toBe(copiaAntes)
  })

  // ── 13. Menos de 2 pontos válidos → ok=false ────────────────────────────
  it('13. menos de 2 pontos validos retorna ok=false e erro claro', async () => {
    const mock = vi.fn().mockResolvedValue({ distances: [] })

    // 1 ponto valido
    const r1 = await prepararMatrizOSRMDiagnosticoV2({
      pontos: [PONTO_A],
      buscarMatrizOSRM: mock,
    })
    expect(r1.ok).toBe(false)
    expect(r1.erros.some((e) => e.includes('insuficientes'))).toBe(true)
    expect(mock).not.toHaveBeenCalled()

    // 0 pontos
    const r0 = await prepararMatrizOSRMDiagnosticoV2({
      pontos: [],
      buscarMatrizOSRM: mock,
    })
    expect(r0.ok).toBe(false)
    expect(mock).not.toHaveBeenCalled()
  })

  // ── 14. Modo correto em todas as saídas ─────────────────────────────────
  it('14. modo: osrm-mockavel-diagnostico em todas as saidas', async () => {
    const mockFalho = vi.fn().mockRejectedValue(new Error('x'))
    const r1 = await prepararMatrizOSRMDiagnosticoV2({
      pontos: [PONTO_A],
      buscarMatrizOSRM: mockFalho,
    })
    expect(r1.modo).toBe('osrm-mockavel-diagnostico')

    const r2 = await prepararMatrizOSRMDiagnosticoV2({
      pontos: [PONTO_A, PONTO_B],
      buscarMatrizOSRM: vi.fn().mockResolvedValue({ distances: [[0, 500], [500, 0]] }),
    })
    expect(r2.modo).toBe('osrm-mockavel-diagnostico')
  })

  // ── 15. Integração com calcularDeltaInsercaoRotaComMatrizDiagnosticoV2 ───
  it('15. integracao: calcularDeltaInsercaoRotaComMatrizDiagnosticoV2 com funcao da matriz OSRM mockada', async () => {
    // Setup: origem=a, destino=b, ponto da agenda=c
    const ORIGEM = { ...PONTO_A, descricao: 'Origem' }
    const DESTINO = { ...PONTO_B, descricao: 'Destino' }
    const PONTO_ROTA = { ...PONTO_C }

    // Mock OSRM para 3 pontos: a, b, c
    const resultado = await prepararMatrizOSRMDiagnosticoV2({
      pontos: [ORIGEM, DESTINO, PONTO_ROTA],
      buscarMatrizOSRM: vi.fn().mockResolvedValue({
        distances: [
          //  a     b     c
          [    0, 1500, 2800], // a
          [ 1500,    0,  900], // b
          [ 2800,  900,    0], // c
        ],
      }),
    })

    expect(resultado.ok).toBe(true)

    // criarCalculadorDistanciaPorCoordenadas e necessario aqui porque o helper de delta
    // passa p.loc (Coordenada sem id) para calcularDistanciaM.
    const pontosMapa = [ORIGEM, DESTINO, PONTO_ROTA]
    const calcularDistanciaM = criarCalculadorDistanciaPorCoordenadas(resultado.matrizMetros, pontosMapa)

    const delta = calcularDeltaInsercaoRotaComMatrizDiagnosticoV2({
      origem: { lat: ORIGEM.lat, lng: ORIGEM.lng, descricao: ORIGEM.descricao },
      destino: { lat: DESTINO.lat, lng: DESTINO.lng, descricao: DESTINO.descricao },
      pontosAgenda: [{ loc: { lat: PONTO_ROTA.lat, lng: PONTO_ROTA.lng } }],
      calcularDistanciaM,
    })

    expect(delta.ok).toBe(true)
    expect(delta.modo).toBe('matriz-distancia-diagnostico')
    expect(typeof delta.kmAdicionalNaRotaM).toBe('number')
    expect(delta.kmAdicionalNaRotaM).not.toBeNull()
    expect(delta.kmAdicionalNaRotaM).not.toBe(0)
    // Confirma que a funcao de distancia retornou valores coerentes
    expect(delta.resumo.quantidadeDistanciasCalculadas).toBeGreaterThan(0)
    expect(delta.resumo.quantidadeDistanciasInvalidas).toBe(0)
  })

  // ── 16. Retorno OSRM com formato inválido → ok=false ────────────────────
  it('16. retorno OSRM com distances de tamanho errado retorna ok=false', async () => {
    const resultado = await prepararMatrizOSRMDiagnosticoV2({
      pontos: [PONTO_A, PONTO_B],
      buscarMatrizOSRM: vi.fn().mockResolvedValue({
        distances: [[0, 500]], // so 1 linha para 2 pontos
      }),
    })
    expect(resultado.ok).toBe(false)
    expect(resultado.erros.some((e) => e.includes('invalido'))).toBe(true)
  })
})
