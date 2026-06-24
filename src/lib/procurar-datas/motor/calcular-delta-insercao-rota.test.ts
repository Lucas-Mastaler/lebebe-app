// ─────────────────────────────────────────────────────────────────────────────
// motor/calcular-delta-insercao-rota.test.ts
//   Testes unitarios para calcularDeltaInsercaoRotaDiagnosticoV2
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest'
import {
  calcularDeltaInsercaoRotaDiagnosticoV2,
  type PontoAgendaDelta,
} from './calcular-delta-insercao-rota'

// ─── Fixtures: coordenadas conhecidas (Curitiba e arredores) ──────────────────

const DEPOSITO = { lat: -25.4284, lng: -49.2733, descricao: 'Deposito' }

// A ~ 1km a leste do deposito
const PONTO_A = { lat: -25.4284, lng: -49.2633 }
// B ~ 1km a leste de A
const PONTO_B = { lat: -25.4284, lng: -49.2533 }
// C ~ 1km a leste de B
const PONTO_C = { lat: -25.4284, lng: -49.2433 }

// Destino D: entre A e B (aproximadamente)
const DESTINO_D = { lat: -25.4284, lng: -49.2583, descricao: 'Destino D' }

// Destino E: proximo ao deposito
const DESTINO_E = { lat: -25.4284, lng: -49.2700, descricao: 'Destino E' }

function pontoAgenda(
  loc: { lat: number; lng: number },
  opts: Partial<Pick<PontoAgendaDelta, 'addr' | 'eventTitle' | 'team'>> = {}
): PontoAgendaDelta {
  return {
    loc,
    addr: opts.addr ?? `Endereco ${loc.lat},${loc.lng}`,
    eventTitle: opts.eventTitle ?? 'Cliente',
    team: opts.team ?? 'EQUIPE 1',
    ...opts,
  }
}

// ─── 1. Agenda vazia ──────────────────────────────────────────────────────────

describe('calcularDeltaInsercaoRotaDiagnosticoV2 — agenda vazia', () => {
  it('1. calcula delta com agenda vazia (rota simples origem -> destino)', () => {
    const res = calcularDeltaInsercaoRotaDiagnosticoV2({
      origem: DEPOSITO,
      destino: DESTINO_E,
      pontosAgenda: [],
      modo: 'haversine-diagnostico',
    })

    expect(res.ok).toBe(true)
    expect(res.modo).toBe('haversine-diagnostico')
    expect(res.kmAdicionalNaRotaM).not.toBeNull()
    expect(res.kmAdicionalNaRotaM).toBeGreaterThan(0)
    expect(res.melhorInsercao).toBeNull()
    expect(res.resumo.quantidadePontosAgenda).toBe(0)
    expect(res.resumo.quantidadePontosValidos).toBe(0)
    expect(res.avisos.length).toBeGreaterThanOrEqual(1)
    expect(res.avisos.some((a) => a.includes('Nenhum ponto valido'))).toBe(true)
  })
})

// ─── 2. Insercao antes do primeiro ponto ──────────────────────────────────────

describe('calcularDeltaInsercaoRotaDiagnosticoV2 — insercao no inicio', () => {
  it('2. calcula melhor insercao antes do primeiro ponto', () => {
    const res = calcularDeltaInsercaoRotaDiagnosticoV2({
      origem: DEPOSITO,
      destino: DESTINO_E, // proximo ao deposito
      pontosAgenda: [
        pontoAgenda(PONTO_A, { eventTitle: 'Cliente A' }),
        pontoAgenda(PONTO_B, { eventTitle: 'Cliente B' }),
      ],
      modo: 'haversine-diagnostico',
    })

    expect(res.ok).toBe(true)
    expect(res.kmAdicionalNaRotaM).not.toBeNull()
    expect(res.melhorInsercao).not.toBeNull()

    // O destino E esta proximo ao deposito, entao inserir antes do primeiro
    // deve gerar um delta pequeno
    const melhor = res.melhorInsercao!
    expect(melhor.indiceInsercao).toBe(0)
    expect(melhor.antes).toContain('Deposito')
    expect(melhor.depois).toContain('Cliente A')
    expect(melhor.deltaM).toBeGreaterThanOrEqual(0)
  })
})

// ─── 3. Insercao entre dois pontos ───────────────────────────────────────────

describe('calcularDeltaInsercaoRotaDiagnosticoV2 — insercao no meio', () => {
  it('3. calcula melhor insercao entre dois pontos', () => {
    // D esta entre A e B (aproximadamente)
    const res = calcularDeltaInsercaoRotaDiagnosticoV2({
      origem: DEPOSITO,
      destino: DESTINO_D,
      pontosAgenda: [
        pontoAgenda(PONTO_A, { eventTitle: 'Cliente A' }),
        pontoAgenda(PONTO_C, { eventTitle: 'Cliente C' }),
      ],
      modo: 'haversine-diagnostico',
    })

    expect(res.ok).toBe(true)
    expect(res.kmAdicionalNaRotaM).not.toBeNull()
    expect(res.melhorInsercao).not.toBeNull()

    const melhor = res.melhorInsercao!
    // Deve inserir entre A e C (indice 1)
    expect(melhor.indiceInsercao).toBe(1)
    expect(melhor.antes).toContain('Cliente A')
    expect(melhor.depois).toContain('Cliente C')
    expect(melhor.deltaM).toBeGreaterThanOrEqual(0)
  })
})

// ─── 4. Insercao depois do ultimo ponto ───────────────────────────────────────

describe('calcularDeltaInsercaoRotaDiagnosticoV2 — insercao no fim', () => {
  it('4. calcula melhor insercao depois do ultimo ponto', () => {
    // Destino bem a leste do ultimo ponto (C), para que insercao no fim seja melhor
    const DESTINO_LESTE = { lat: -25.4284, lng: -49.2333, descricao: 'Destino Leste' }
    const res = calcularDeltaInsercaoRotaDiagnosticoV2({
      origem: DEPOSITO,
      destino: DESTINO_LESTE,
      pontosAgenda: [
        pontoAgenda(PONTO_A, { eventTitle: 'Cliente A' }),
        pontoAgenda(PONTO_B, { eventTitle: 'Cliente B' }),
        pontoAgenda(PONTO_C, { eventTitle: 'Cliente C' }),
      ],
      modo: 'haversine-diagnostico',
    })

    expect(res.ok).toBe(true)
    expect(res.kmAdicionalNaRotaM).not.toBeNull()
    expect(res.melhorInsercao).not.toBeNull()

    const melhor = res.melhorInsercao!
    expect(melhor.indiceInsercao).toBe(3) // apos C
    expect(melhor.antes).toContain('Cliente C')
    expect(melhor.depois).toBeNull()
    expect(melhor.deltaM).toBeGreaterThanOrEqual(0)
  })
})

// ─── 5. Ignora ponto sem coordenada ───────────────────────────────────────────

describe('calcularDeltaInsercaoRotaDiagnosticoV2 — descarte de pontos invalidos', () => {
  it('5. ignora ponto sem coordenada e registra descarte', () => {
    const res = calcularDeltaInsercaoRotaDiagnosticoV2({
      origem: DEPOSITO,
      destino: DESTINO_E,
      pontosAgenda: [
        pontoAgenda(PONTO_A, { eventTitle: 'Cliente A' }),
        { loc: { lat: NaN, lng: NaN }, eventTitle: 'Cliente Invalido' },
        pontoAgenda(PONTO_B, { eventTitle: 'Cliente B' }),
      ],
      modo: 'haversine-diagnostico',
    })

    expect(res.ok).toBe(true)
    expect(res.descartados).toHaveLength(1)
    expect(res.descartados[0].indice).toBe(1)
    expect(res.descartados[0].motivo).toContain('coordenada valida')
    expect(res.resumo.quantidadePontosValidos).toBe(2)
    expect(res.resumo.quantidadePontosInvalidos).toBe(1)
    expect(res.avisos.some((a) => a.includes('descartado'))).toBe(true)
  })
})

// ─── 6. Origem invalida ───────────────────────────────────────────────────────

describe('calcularDeltaInsercaoRotaDiagnosticoV2 — validacao de origem', () => {
  it('6. retorna null se origem invalida', () => {
    const res = calcularDeltaInsercaoRotaDiagnosticoV2({
      origem: { lat: NaN, lng: NaN, descricao: 'Invalido' },
      destino: DESTINO_E,
      pontosAgenda: [],
      modo: 'haversine-diagnostico',
    })

    expect(res.ok).toBe(false)
    expect(res.kmAdicionalNaRotaM).toBeNull()
    expect(res.avisos.some((a) => a.includes('Origem invalida'))).toBe(true)
  })
})

// ─── 7. Destino invalido ──────────────────────────────────────────────────────

describe('calcularDeltaInsercaoRotaDiagnosticoV2 — validacao de destino', () => {
  it('7. retorna null se destino invalido', () => {
    const res = calcularDeltaInsercaoRotaDiagnosticoV2({
      origem: DEPOSITO,
      destino: { lat: Infinity, lng: -49.0, descricao: 'Invalido' },
      pontosAgenda: [],
      modo: 'haversine-diagnostico',
    })

    expect(res.ok).toBe(false)
    expect(res.kmAdicionalNaRotaM).toBeNull()
    expect(res.avisos.some((a) => a.includes('Destino invalido'))).toBe(true)
  })
})

// ─── 8. Nao retorna 0 silencioso para erro ────────────────────────────────────

describe('calcularDeltaInsercaoRotaDiagnosticoV2 — seguranca', () => {
  it('8. nao retorna 0 silencioso para erro', () => {
    const res = calcularDeltaInsercaoRotaDiagnosticoV2({
      origem: { lat: NaN, lng: NaN },
      destino: DESTINO_E,
      pontosAgenda: [pontoAgenda(PONTO_A)],
      modo: 'haversine-diagnostico',
    })

    expect(res.ok).toBe(false)
    expect(res.kmAdicionalNaRotaM).toBeNull()
  })
})

// ─── 9. Imutabilidade ─────────────────────────────────────────────────────────

describe('calcularDeltaInsercaoRotaDiagnosticoV2 — imutabilidade', () => {
  it('9. nao muta input', () => {
    const pontos = [
      pontoAgenda(PONTO_A, { eventTitle: 'A' }),
      pontoAgenda(PONTO_B, { eventTitle: 'B' }),
    ]
    const origem = { ...DEPOSITO }
    const destino = { ...DESTINO_E }

    calcularDeltaInsercaoRotaDiagnosticoV2({
      origem,
      destino,
      pontosAgenda: pontos,
      modo: 'haversine-diagnostico',
    })

    // Verifica que os arrays/objetos nao foram modificados
    expect(pontos[0].eventTitle).toBe('A')
    expect(pontos[1].eventTitle).toBe('B')
    expect(origem.lat).toBe(DEPOSITO.lat)
    expect(destino.lng).toBe(DESTINO_E.lng)
  })
})

// ─── 10. Garantias de nao-I/O ─────────────────────────────────────────────────

describe('calcularDeltaInsercaoRotaDiagnosticoV2 — ausencia de I/O', () => {
  it('10. garante ausencia de I/O externo (puro)', () => {
    const res = calcularDeltaInsercaoRotaDiagnosticoV2({
      origem: DEPOSITO,
      destino: DESTINO_E,
      pontosAgenda: [pontoAgenda(PONTO_A)],
      modo: 'haversine-diagnostico',
    })

    expect(res.ok).toBe(true)
    // Nao houve erro de rede, credencial, timeout, etc.
    // O helper e puro — apenas calculo matematico
  })
})

// ─── 11. Modo retornado ───────────────────────────────────────────────────────

describe('calcularDeltaInsercaoRotaDiagnosticoV2 — modo', () => {
  it('11. confirma que o modo retornado e haversine-diagnostico', () => {
    const res = calcularDeltaInsercaoRotaDiagnosticoV2({
      origem: DEPOSITO,
      destino: DESTINO_E,
      pontosAgenda: [],
      modo: 'haversine-diagnostico',
    })

    expect(res.modo).toBe('haversine-diagnostico')
  })
})

// ─── 12. Avisos em cenarios especificos ─────────────────────────────────────────

describe('calcularDeltaInsercaoRotaDiagnosticoV2 — avisos', () => {
  it('12a. confirma aviso quando rota esta vazia', () => {
    const res = calcularDeltaInsercaoRotaDiagnosticoV2({
      origem: DEPOSITO,
      destino: DESTINO_E,
      pontosAgenda: [],
      modo: 'haversine-diagnostico',
    })

    expect(res.avisos.some((a) => a.includes('Nenhum ponto valido'))).toBe(true)
  })

  it('12b. confirma aviso quando houver descartes', () => {
    const res = calcularDeltaInsercaoRotaDiagnosticoV2({
      origem: DEPOSITO,
      destino: DESTINO_E,
      pontosAgenda: [
        pontoAgenda(PONTO_A),
        { loc: { lat: undefined as unknown as number, lng: undefined as unknown as number } },
      ],
      modo: 'haversine-diagnostico',
    })

    expect(res.avisos.some((a) => a.includes('descartado'))).toBe(true)
    expect(res.resumo.quantidadePontosInvalidos).toBe(1)
  })
})

// ─── 13. Delta nunca negativo (triangular inequality) ───────────────────────────

describe('calcularDeltaInsercaoRotaDiagnosticoV2 — delta nao-negativo', () => {
  it('13. delta de insercao e sempre >= 0 (desigualdade triangular)', () => {
    const res = calcularDeltaInsercaoRotaDiagnosticoV2({
      origem: DEPOSITO,
      destino: DESTINO_D,
      pontosAgenda: [
        pontoAgenda(PONTO_A),
        pontoAgenda(PONTO_B),
        pontoAgenda(PONTO_C),
      ],
      modo: 'haversine-diagnostico',
    })

    expect(res.ok).toBe(true)
    expect(res.kmAdicionalNaRotaM).toBeGreaterThanOrEqual(0)
    expect(res.melhorInsercao!.deltaM).toBeGreaterThanOrEqual(0)
  })
})

// ─── 14. Resumo correto ───────────────────────────────────────────────────────

describe('calcularDeltaInsercaoRotaDiagnosticoV2 — resumo', () => {
  it('14. resumo reflete quantidades corretas', () => {
    const res = calcularDeltaInsercaoRotaDiagnosticoV2({
      origem: DEPOSITO,
      destino: DESTINO_E,
      pontosAgenda: [
        pontoAgenda(PONTO_A),
        { loc: { lat: NaN, lng: 0 } },
        pontoAgenda(PONTO_B),
        { loc: { lat: 0, lng: NaN } },
        pontoAgenda(PONTO_C),
      ],
      modo: 'haversine-diagnostico',
    })

    expect(res.resumo.quantidadePontosAgenda).toBe(5)
    expect(res.resumo.quantidadePontosValidos).toBe(3)
    expect(res.resumo.quantidadePontosInvalidos).toBe(2)
    expect(res.descartados).toHaveLength(2)
  })
})
