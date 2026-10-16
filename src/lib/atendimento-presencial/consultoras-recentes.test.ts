import { describe, expect, it } from 'vitest'
import { nomesConsultorasRecentes } from './consultoras-recentes'

const rows = (...nomes: Array<string | null>) => nomes.map((consultora_nome) => ({ consultora_nome }))
describe('ultimas consultoras por ordem de uso', () => {
  it('nao sugere os nomes reservados a homologacao', () => {
    expect(nomesConsultorasRecentes(rows('HOMOLOGACAO Lucas', 'Ana'))).toEqual(['Ana'])
  })
  it('trata vazio, um nome e quatro nomes', () => {
    expect(nomesConsultorasRecentes([])).toEqual([])
    expect(nomesConsultorasRecentes(rows('Ana'))).toEqual(['Ana'])
    expect(nomesConsultorasRecentes(rows('Zelia', 'Ana', 'Carla', 'Bia'))).toEqual(['Zelia', 'Ana', 'Carla', 'Bia'])
  })
  it('limita a quatro distintos, preservando ordem recente e grafia mais recente', () => {
    expect(nomesConsultorasRecentes(rows('  Ana   Clara ', 'ana clara', null, '', 'Bia', 'BIA', 'Carla', 'Dora', 'Eva')))
      .toEqual(['Ana Clara', 'Bia', 'Carla', 'Dora'])
  })
  it('repeticoes nao ocupam posicoes nem escondem nomes antigos', () => {
    expect(nomesConsultorasRecentes(rows(...Array(200).fill('Ana'), 'Bia', 'Carla', 'Dora'))).toEqual(['Ana', 'Bia', 'Carla', 'Dora'])
  })
})
