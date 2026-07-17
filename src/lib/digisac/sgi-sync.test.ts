import { describe, expect, it } from 'vitest'
import { gerarVariacoesTelefone } from './sgi-sync'

describe('gerarVariacoesTelefone', () => {
  const variantesRaquel = [
    '4196246875',
    '41996246875',
    '554196246875',
    '5541996246875',
  ]

  it.each([
    '(41) 9624-6875',
    '4196246875',
    '41996246875',
    '554196246875',
    '5541996246875',
    '  +55 (41) 99624-6875  ',
  ])('gera variantes com e sem DDI/nono digito para %s', (telefone) => {
    expect(gerarVariacoesTelefone(telefone)).toEqual(expect.arrayContaining(variantesRaquel))
  })

  it('mantem telefone fixo com e sem DDI sem inserir nono digito de forma insegura', () => {
    expect(gerarVariacoesTelefone('41 3333-4444')).toEqual([
      '4133334444',
      '554133334444',
    ])
  })

  it('nao transforma numero incompleto em equivalente valido', () => {
    expect(gerarVariacoesTelefone('12345')).toEqual([])
  })

  it('nao aproxima numeros distintos por sufixo curto', () => {
    const telefoneA = gerarVariacoesTelefone('4196246875')
    const telefoneB = gerarVariacoesTelefone('4196246876')

    expect(telefoneA).not.toContain('4196246876')
    expect(telefoneA).not.toContain('41996246876')
    expect(telefoneB).not.toContain('4196246875')
    expect(telefoneB).not.toContain('41996246875')
  })
})
