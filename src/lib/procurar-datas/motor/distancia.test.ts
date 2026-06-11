// ─────────────────────────────────────────────────────────────────────────────
// motor/distancia.test.ts  —  Testes unitários para cálculo de distância
//
// Cobre os comportamentos de haversine() e haversineKm() (paridade com Apps Script)
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest'
import { haversine, haversineKm, type Coordenada } from './distancia'

describe('haversine', () => {
  it('mesmo ponto → 0 km', () => {
    expect(haversine(0, 0, 0, 0)).toBe(0)
  })

  it('mesmo ponto com valores → 0 km', () => {
    expect(haversine(-23.5505, -46.6333, -23.5505, -46.6333)).toBe(0)
  })

  it('distância conhecida simples (equador)', () => {
    // 1 grau no equador ≈ 111.19 km (valor real da fórmula)
    const dist = haversine(0, 0, 0, 1)
    expect(dist).toBeCloseTo(111.19, 1)
  })

  it('distância conhecida São Paulo → Rio de Janeiro', () => {
    // Aproximadamente 360.75 km em linha reta (valor real da fórmula)
    const sp = { lat: -23.5505, lng: -46.6333 }
    const rj = { lat: -22.9068, lng: -43.1729 }
    const dist = haversine(sp.lat, sp.lng, rj.lat, rj.lng)
    expect(dist).toBeCloseTo(360.75, 0)
  })

  it('coordenadas negativas', () => {
    const dist = haversine(-10, -20, -30, -40)
    expect(dist).toBeGreaterThan(0)
  })

  it('coordenadas com zero', () => {
    const dist = haversine(0, 0, 10, 10)
    expect(dist).toBeGreaterThan(0)
  })

  it('ordem correta dos parâmetros', () => {
    const dist1 = haversine(-23.5505, -46.6333, -22.9068, -43.1729)
    const dist2 = haversine(-22.9068, -43.1729, -23.5505, -46.6333)
    expect(dist1).toBeCloseTo(dist2, 5)
  })

  it('não arredonda (valor bruto)', () => {
    // Verifica que o valor é o bruto da fórmula, não arredondado
    const dist = haversine(0, 0, 0, 1)
    expect(dist).not.toBe(Math.round(dist))
  })
})

describe('haversineKm', () => {
  it('mesmo ponto → 0 km', () => {
    const p: Coordenada = { lat: 0, lng: 0 }
    expect(haversineKm(p, p)).toBe(0)
  })

  it('mesmo ponto com valores → 0 km', () => {
    const p: Coordenada = { lat: -23.5505, lng: -46.6333 }
    expect(haversineKm(p, p)).toBe(0)
  })

  it('distância conhecida São Paulo → Rio de Janeiro', () => {
    const sp: Coordenada = { lat: -23.5505, lng: -46.6333 }
    const rj: Coordenada = { lat: -22.9068, lng: -43.1729 }
    const dist = haversineKm(sp, rj)
    expect(dist).toBeCloseTo(360.75, 0)
  })

  it('paridade com haversine (mesmo resultado)', () => {
    const a: Coordenada = { lat: -23.5505, lng: -46.6333 }
    const b: Coordenada = { lat: -22.9068, lng: -43.1729 }
    const dist1 = haversineKm(a, b)
    const dist2 = haversine(a.lat, a.lng, b.lat, b.lng)
    expect(dist1).toBeCloseTo(dist2, 10)
  })

  it('coordenadas negativas', () => {
    const a: Coordenada = { lat: -10, lng: -20 }
    const b: Coordenada = { lat: -30, lng: -40 }
    const dist = haversineKm(a, b)
    expect(dist).toBeGreaterThan(0)
  })

  it('unidade em km (não metros)', () => {
    // Distância equatorial de 1 grau ≈ 111 km, não 111.000 metros
    const a: Coordenada = { lat: 0, lng: 0 }
    const b: Coordenada = { lat: 0, lng: 1 }
    const dist = haversineKm(a, b)
    expect(dist).toBeGreaterThan(100)
    expect(dist).toBeLessThan(200)
  })
})
