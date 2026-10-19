import { describe, expect, it } from 'vitest'
import { nomesConsultorasRecentes } from './consultoras-recentes'

const rows = (...nomes: Array<string | null>) => nomes.map((consultora_nome) => ({ consultora_nome }))
describe('ultimas consultoras por ordem de uso', () => {
  it('nao sugere os nomes reservados a homologacao', () => {
    expect(nomesConsultorasRecentes(rows('HOMOLOGACAO Lucas', 'ANA'))).toEqual(['ANA'])
  })
  it('trata vazio, um nome e quatro nomes', () => {
    expect(nomesConsultorasRecentes([])).toEqual([])
    expect(nomesConsultorasRecentes(rows('ANA'))).toEqual(['ANA'])
    expect(nomesConsultorasRecentes(rows('ZELIA', 'ANA', 'CARLA', 'BIA'))).toEqual(['ZELIA', 'ANA', 'CARLA', 'BIA'])
  })
  it('limita a quatro distintos, preservando ordem recente e grafia mais recente', () => {
    expect(nomesConsultorasRecentes(rows('  Ana   Clara ', 'ana clara', null, '', 'BIA', 'BIA', 'CARLA', 'DORA', 'EVA')))
      .toEqual(['ANA CLARA', 'BIA', 'CARLA', 'DORA'])
  })
  it('repeticoes nao ocupam posicoes nem escondem nomes antigos', () => {
    expect(nomesConsultorasRecentes(rows(...Array(200).fill('ANA'), 'BIA', 'CARLA', 'DORA'))).toEqual(['ANA', 'BIA', 'CARLA', 'DORA'])
  })
})
