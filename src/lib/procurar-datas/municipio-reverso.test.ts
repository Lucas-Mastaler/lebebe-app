import { expect, it } from 'vitest'
import { municipioContemPonto } from './municipio-reverso'

const exterior = [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]]
const buraco = [[4, 4], [6, 4], [6, 6], [4, 6], [4, 4]]
it.each([
  [{ lat: 2, lng: 2 }, true], [{ lat: 5, lng: 5 }, false],
  [{ lat: 0, lng: 0 }, false], [{ lat: 5, lng: 0 }, false], [{ lat: 4, lng: 5 }, false],
  [{ lat: 11, lng: 5 }, false], [{ lat: NaN, lng: 5 }, false],
])('confirma cobertura do ponto, rejeitando buraco, limite e ausência: %j', (ponto, esperado) => {
  expect(municipioContemPonto(ponto, { type: 'Polygon', coordinates: [exterior, buraco] })).toBe(esperado)
})
it('aceita multipolígono e mantém ordem GeoJSON lng/lat', () => {
  const geo = { type: 'MultiPolygon', coordinates: [[[[20, 1], [22, 1], [22, 3], [20, 3], [20, 1]]], [exterior]] }
  expect(municipioContemPonto({ lat: 2, lng: 21 }, geo)).toBe(true)
  expect(municipioContemPonto({ lat: 21, lng: 2 }, geo)).toBe(false)
})
it.each([null, {}, { type: 'Point', coordinates: [5, 5] }, { type: 'Polygon', coordinates: [] },
  { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1]]] },
  { type: 'Polygon', coordinates: [[[0, 0], [999, 0], [1, 1], [0, 0]]] },
])('geometria inválida ou centro aproximado não comprova município: %j', (geo) => {
  expect(municipioContemPonto({ lat: 0.5, lng: 0.5 }, geo)).toBe(false)
})
