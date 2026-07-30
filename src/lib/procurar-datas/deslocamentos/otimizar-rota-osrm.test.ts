import { describe, expect, it } from 'vitest'
import { otimizarRotaDeslocamentosPorMatrizOSRM } from './otimizar-rota-osrm'

describe('otimizarRotaDeslocamentosPorMatrizOSRM', () => {
  it('ordena por matriz sem retornar para a origem', () => {
    const resultado = otimizarRotaDeslocamentosPorMatrizOSRM({
      quantidadeParadas: 3,
      distances: [
        [0, 1000, 3000, 2000],
        [1000, 0, 700, 900],
        [3000, 700, 0, 400],
        [2000, 900, 400, 0],
      ],
      durations: [
        [0, 60, 180, 120],
        [60, 0, 42, 54],
        [180, 42, 0, 24],
        [120, 54, 24, 0],
      ],
    })

    expect(resultado).toMatchObject({
      ok: true,
      ordemParadas: [0, 1, 2],
      distanciaTotalM: 2100,
      duracaoTotalSegundos: 126,
    })
  })

  it('nao soma trecho de retorno para a origem', () => {
    const resultado = otimizarRotaDeslocamentosPorMatrizOSRM({
      quantidadeParadas: 1,
      distances: [
        [0, 500],
        [9999, 0],
      ],
    })

    expect(resultado).toMatchObject({
      ok: true,
      ordemParadas: [0],
      distanciaTotalM: 500,
    })
  })

  it('falha sem fallback zero quando a matriz nao permite rota completa', () => {
    const resultado = otimizarRotaDeslocamentosPorMatrizOSRM({
      quantidadeParadas: 2,
      distances: [
        [0, 1000, null],
        [1000, 0, null],
        [null, null, 0],
      ],
    })

    expect(resultado).toEqual({
      ok: false,
      erro: 'matriz_distancias_sem_rota_completa',
      avisos: [],
    })
  })
})
