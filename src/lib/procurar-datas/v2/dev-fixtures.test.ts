import { describe, expect, it } from 'vitest'
import { CENARIOS_DEV_V2, K13_FIXTURE, K14_FIXTURE, K15_FIXTURE } from './dev-fixtures'
import type { PesquisarDatasRequest } from '../contratos'

describe('dev-fixtures v2 /procurar-datas', () => {
  it('K13 fixture é um PesquisarDatasRequest válido com coordenadas', () => {
    const fixture: PesquisarDatasRequest = K13_FIXTURE
    expect(fixture.cep).toBe('81830-020')
    expect(fixture.dataInicial).toBe('2026-08-14')
    expect(fixture.destLat).toBeDefined()
    expect(fixture.destLng).toBeDefined()
    expect(fixture.tempoNecessario).toBe('00:40')
  })

  it('K14 fixture é um PesquisarDatasRequest válido com coordenadas', () => {
    const fixture: PesquisarDatasRequest = K14_FIXTURE
    expect(fixture.cep).toBe('81925-370')
    expect(fixture.dataInicial).toBe('2026-06-25')
    expect(fixture.destLat).toBeDefined()
    expect(fixture.destLng).toBeDefined()
  })

  it('K15 fixture é um PesquisarDatasRequest válido com coordenadas', () => {
    const fixture: PesquisarDatasRequest = K15_FIXTURE
    expect(fixture.cep).toBe('83800-000')
    expect(fixture.dataInicial).toBe('2026-07-10')
    expect(fixture.destLat).toBeDefined()
    expect(fixture.destLng).toBeDefined()
  })

  it('CENARIOS_DEV_V2 contém K13, K14 e K15 nessa ordem', () => {
    const ids = CENARIOS_DEV_V2.map((c) => c.id)
    expect(ids).toEqual(['K13', 'K14', 'K15'])
    expect(CENARIOS_DEV_V2.every((c) => c.nome && c.descricao && c.payload)).toBe(true)
  })

  it('todos os fixtures preenchem campos obrigatórios para o POST v2', () => {
    const fixtures = [K13_FIXTURE, K14_FIXTURE, K15_FIXTURE]
    for (const fixture of fixtures) {
      expect(fixture.dataInicial).toBeTruthy()
      expect(fixture.tempoNecessario).toBeTruthy()
      expect(typeof fixture.destLat).toBe('number')
      expect(typeof fixture.destLng).toBe('number')
    }
  })
})
