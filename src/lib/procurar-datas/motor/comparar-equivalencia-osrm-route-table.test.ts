// ─────────────────────────────────────────────────────────────────────────────
// motor/comparar-equivalencia-osrm-route-table.test.ts
//   Testes unitários para o helper de equivalência OSRM /route vs /table.
//
//   Propósito:
//     Validar que o helper compara corretamente os dois métodos de cálculo
//     de distância OSRM para um cenário de 3 pontos (prev, novo, next).
//
//   Estratégia:
//     - Usar mocks injetados para simular OSRM /route e /table.
//     - Testar cenários: equivalência perfeita, diferença acima da tolerância,
//       falha parcial, falha total, coordenadas inválidas.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, vi } from 'vitest'
import {
  compararEquivalenciaOsrmRouteTableDiagnosticoV2,
  type CompararEquivalenciaOsrmRouteTableInput,
  type BuscarRotaOSRM,
  type BuscarMatrizOSRM,
} from './comparar-equivalencia-osrm-route-table'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const coords = {
  prev: { lat: -25.4284, lng: -49.2733, id: 'prev', descricao: 'Praça Tiradentes' },
  novo: { lat: -25.442, lng: -49.2407, id: 'novo', descricao: 'Jardim Botânico' },
  next: { lat: -25.4235, lng: -49.3076, id: 'next', descricao: 'Parque Barigui' },
}

// ─── Mocks ────────────────────────────────────────────────────────────────────

function criarMockRotaOSRMSucesso(distanciasM: { prevNovo: number; novoNext: number; prevNext: number }): BuscarRotaOSRM {
  return async (de, para) => {
    if (de.lat === coords.prev.lat && para.lat === coords.novo.lat) {
      return { distanciaM: distanciasM.prevNovo, ok: true }
    }
    if (de.lat === coords.novo.lat && para.lat === coords.next.lat) {
      return { distanciaM: distanciasM.novoNext, ok: true }
    }
    if (de.lat === coords.prev.lat && para.lat === coords.next.lat) {
      return { distanciaM: distanciasM.prevNext, ok: true }
    }
    return { distanciaM: null, ok: false, erro: 'Par não reconhecido' }
  }
}

function criarMockMatrizOSRMSucesso(distanciasM: { prevNovo: number; novoNext: number; prevNext: number }): BuscarMatrizOSRM {
  return async () => {
    // Matriz 3x3: [prev, novo, next]
    // distances[i][j] = distância do ponto i para o ponto j
    const d = [
      [0, distanciasM.prevNovo, distanciasM.prevNext],
      [distanciasM.prevNovo, 0, distanciasM.novoNext],
      [distanciasM.prevNext, distanciasM.novoNext, 0],
    ]
    return { distances: d, ok: true }
  }
}

function criarMockRotaOSRMFalha(): BuscarRotaOSRM {
  return async () => ({ distanciaM: null, ok: false, erro: 'OSRM /route falhou' })
}

function criarMockMatrizOSRMFalha(): BuscarMatrizOSRM {
  return async () => ({ distances: [], ok: false, erro: 'OSRM /table falhou' })
}

// ─── Testes ───────────────────────────────────────────────────────────────────

describe('compararEquivalenciaOsrmRouteTableDiagnosticoV2', () => {
  it('deve retornar equivalente=true quando route e table retornam mesmas distâncias (dentro da tolerância)', async () => {
    const distancias = { prevNovo: 3500, novoNext: 4200, prevNext: 6800 }
    const input: CompararEquivalenciaOsrmRouteTableInput = {
      prev: coords.prev,
      novo: coords.novo,
      next: coords.next,
      buscarRotaOSRM: criarMockRotaOSRMSucesso(distancias),
      buscarMatrizOSRM: criarMockMatrizOSRMSucesso(distancias),
      toleranciaM: 10,
    }

    const resultado = await compararEquivalenciaOsrmRouteTableDiagnosticoV2(input)

    expect(resultado.ok).toBe(true)
    expect(resultado.modo).toBe('equivalencia-osrm-route-vs-table-diagnostico')
    expect(resultado.route).not.toBeNull()
    expect(resultado.table).not.toBeNull()
    expect(resultado.comparacao).not.toBeNull()
    expect(resultado.comparacao!.equivalente).toBe(true)
    expect(resultado.comparacao!.diferencaAbsolutaM).toBe(0)
    expect(resultado.comparacao!.diferencaPercentual).toBe(0)
    expect(resultado.route!.deltaM).toBe(Math.round(3500 + 4200 - 6800)) // 900
    expect(resultado.table!.deltaM).toBe(Math.round(3500 + 4200 - 6800)) // 900
  })

  it('deve retornar equivalente=false quando diferença está acima da tolerância', async () => {
    const distanciasRoute = { prevNovo: 3500, novoNext: 4200, prevNext: 6800 }
    const distanciasTable = { prevNovo: 3600, novoNext: 4300, prevNext: 6900 } // +100m em cada
    const input: CompararEquivalenciaOsrmRouteTableInput = {
      prev: coords.prev,
      novo: coords.novo,
      next: coords.next,
      buscarRotaOSRM: criarMockRotaOSRMSucesso(distanciasRoute),
      buscarMatrizOSRM: criarMockMatrizOSRMSucesso(distanciasTable),
      toleranciaM: 10, // tolerância menor que a diferença
    }

    const resultado = await compararEquivalenciaOsrmRouteTableDiagnosticoV2(input)

    expect(resultado.ok).toBe(true)
    expect(resultado.comparacao).not.toBeNull()
    expect(resultado.comparacao!.equivalente).toBe(false)
    expect(resultado.comparacao!.diferencaAbsolutaM).toBeGreaterThan(10)
    expect(resultado.avisos.some(a => a.includes('Diferença acima da tolerância'))).toBe(true)
  })

  it('deve retornar ok=false quando route falha completamente', async () => {
    const distancias = { prevNovo: 3500, novoNext: 4200, prevNext: 6800 }
    const input: CompararEquivalenciaOsrmRouteTableInput = {
      prev: coords.prev,
      novo: coords.novo,
      next: coords.next,
      buscarRotaOSRM: criarMockRotaOSRMFalha(),
      buscarMatrizOSRM: criarMockMatrizOSRMSucesso(distancias),
      toleranciaM: 10,
    }

    const resultado = await compararEquivalenciaOsrmRouteTableDiagnosticoV2(input)

    expect(resultado.ok).toBe(false)
    expect(resultado.route).not.toBeNull()
    expect(resultado.route!.completo).toBe(false)
    expect(resultado.table).not.toBeNull()
    expect(resultado.table!.completo).toBe(true)
    expect(resultado.comparacao).toBeNull()
    expect(resultado.erros.some(e => e.includes('route'))).toBe(true)
  })

  it('deve retornar ok=false quando table falha completamente', async () => {
    const distancias = { prevNovo: 3500, novoNext: 4200, prevNext: 6800 }
    const input: CompararEquivalenciaOsrmRouteTableInput = {
      prev: coords.prev,
      novo: coords.novo,
      next: coords.next,
      buscarRotaOSRM: criarMockRotaOSRMSucesso(distancias),
      buscarMatrizOSRM: criarMockMatrizOSRMFalha(),
      toleranciaM: 10,
    }

    const resultado = await compararEquivalenciaOsrmRouteTableDiagnosticoV2(input)

    expect(resultado.ok).toBe(false)
    expect(resultado.route).not.toBeNull()
    expect(resultado.route!.completo).toBe(true)
    expect(resultado.table).not.toBeNull()
    expect(resultado.table!.completo).toBe(false)
    expect(resultado.comparacao).toBeNull()
    expect(resultado.erros.some(e => e.includes('table'))).toBe(true)
  })

  it('deve retornar erros quando coordenadas são inválidas', async () => {
    const input: CompararEquivalenciaOsrmRouteTableInput = {
      prev: { lat: NaN, lng: -49.2733, id: 'prev', descricao: 'inválido' },
      novo: coords.novo,
      next: coords.next,
      buscarRotaOSRM: criarMockRotaOSRMSucesso({ prevNovo: 3500, novoNext: 4200, prevNext: 6800 }),
      buscarMatrizOSRM: criarMockMatrizOSRMSucesso({ prevNovo: 3500, novoNext: 4200, prevNext: 6800 }),
      toleranciaM: 10,
    }

    const resultado = await compararEquivalenciaOsrmRouteTableDiagnosticoV2(input)

    expect(resultado.ok).toBe(false)
    expect(resultado.route).toBeNull()
    expect(resultado.table).toBeNull()
    expect(resultado.comparacao).toBeNull()
    expect(resultado.erros.length).toBeGreaterThan(0)
  })

  it('deve calcular delta correto: prevNovo + novoNext - prevNext', async () => {
    const distancias = { prevNovo: 5000, novoNext: 6000, prevNext: 8000 }
    const input: CompararEquivalenciaOsrmRouteTableInput = {
      prev: coords.prev,
      novo: coords.novo,
      next: coords.next,
      buscarRotaOSRM: criarMockRotaOSRMSucesso(distancias),
      buscarMatrizOSRM: criarMockMatrizOSRMSucesso(distancias),
      toleranciaM: 10,
    }

    const resultado = await compararEquivalenciaOsrmRouteTableDiagnosticoV2(input)

    const deltaEsperado = Math.round(5000 + 6000 - 8000) // 3000
    expect(resultado.route!.deltaM).toBe(deltaEsperado)
    expect(resultado.table!.deltaM).toBe(deltaEsperado)
  })

  it('deve retornar diferencaPercentual null quando deltaRoute é zero', async () => {
    // Caso onde prevNovo + novoNext = prevNext (delta = 0)
    const distancias = { prevNovo: 3000, novoNext: 4000, prevNext: 7000 }
    const input: CompararEquivalenciaOsrmRouteTableInput = {
      prev: coords.prev,
      novo: coords.novo,
      next: coords.next,
      buscarRotaOSRM: criarMockRotaOSRMSucesso(distancias),
      buscarMatrizOSRM: criarMockMatrizOSRMSucesso(distancias),
      toleranciaM: 10,
    }

    const resultado = await compararEquivalenciaOsrmRouteTableDiagnosticoV2(input)

    expect(resultado.ok).toBe(true)
    expect(resultado.comparacao!.diferencaPercentual).toBeNull()
    expect(resultado.route!.deltaM).toBe(0)
  })

  it('deve usar tolerância padrão de 10m quando não especificada', async () => {
    const distancias = { prevNovo: 3500, novoNext: 4200, prevNext: 6800 }
    const input: CompararEquivalenciaOsrmRouteTableInput = {
      prev: coords.prev,
      novo: coords.novo,
      next: coords.next,
      buscarRotaOSRM: criarMockRotaOSRMSucesso(distancias),
      buscarMatrizOSRM: criarMockMatrizOSRMSucesso(distancias),
      // toleranciaM omitida
    }

    const resultado = await compararEquivalenciaOsrmRouteTableDiagnosticoV2(input)

    expect(resultado.comparacao!.toleranciaM).toBe(10)
  })

  it('deve reportar tableMaiorQueRoute corretamente', async () => {
    const distanciasRoute = { prevNovo: 3500, novoNext: 4200, prevNext: 6800 }
    const distanciasTable = { prevNovo: 3600, novoNext: 4300, prevNext: 6900 } // table > route
    const input: CompararEquivalenciaOsrmRouteTableInput = {
      prev: coords.prev,
      novo: coords.novo,
      next: coords.next,
      buscarRotaOSRM: criarMockRotaOSRMSucesso(distanciasRoute),
      buscarMatrizOSRM: criarMockMatrizOSRMSucesso(distanciasTable),
      toleranciaM: 1000, // alta para não marcar como não equivalente
    }

    const resultado = await compararEquivalenciaOsrmRouteTableDiagnosticoV2(input)

    expect(resultado.comparacao!.tableMaiorQueRoute).toBe(true)
  })

  it('deve incluir avisos diagnósticos em todos os resultados', async () => {
    const distancias = { prevNovo: 3500, novoNext: 4200, prevNext: 6800 }
    const input: CompararEquivalenciaOsrmRouteTableInput = {
      prev: coords.prev,
      novo: coords.novo,
      next: coords.next,
      buscarRotaOSRM: criarMockRotaOSRMSucesso(distancias),
      buscarMatrizOSRM: criarMockMatrizOSRMSucesso(distancias),
      toleranciaM: 10,
    }

    const resultado = await compararEquivalenciaOsrmRouteTableDiagnosticoV2(input)

    expect(resultado.avisos.length).toBeGreaterThan(0)
    expect(resultado.avisos.some(a => a.includes('diagnóstico') || a.includes('validação'))).toBe(true)
  })
})
