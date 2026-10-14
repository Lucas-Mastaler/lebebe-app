import { describe, expect, it } from 'vitest'
import { calcularPainelDecorisi, calcularPapelDecorisi, subtotalDecorisiCentavos } from './calculos'
import { pesquisarReferenciasPf, produtoComercialDecorisi, REFERENCIAS_PF_DECORISI, referenciaPfValida } from './catalogo'
import { validarItensDecorisi } from './validacao'
import fonte from './referencias-db.json'

describe('Decorisi: cálculo exato por arte', () => {
  it('preserva zero e calcula divisão exata no limite do rolo', () => {
    expect(calcularPapelDecorisi([{ larguraCm: 62, alturaCm: 995 }], 0).quantidade).toBe('1')
    expect(() => calcularPapelDecorisi([{ larguraCm: 62, alturaCm: 996 }], 0)).toThrow('ALTURA_EXCEDE_ROLO')
  })
  it('agrupa larguras iguais e arredonda apenas depois da soma de alturas diferentes', () => {
    const resultado = calcularPapelDecorisi([{ larguraCm: 60, alturaCm: 270 }, { larguraCm: 60, alturaCm: 270 }, { larguraCm: 62, alturaCm: 400 }], 0)
    expect(resultado.grupos).toHaveLength(2)
    expect(resultado.grupos[0]).toMatchObject({ larguraCm: '120', faixasPorRolo: 3 })
    expect(resultado.quantidade).toBe('2')
    expect(calcularPapelDecorisi([{ larguraCm: 186, alturaCm: 270 }], 0).quantidade).toBe('1')
    expect(calcularPapelDecorisi([{ larguraCm: 187, alturaCm: 270 }], 0).quantidade).toBe('2')
  })
  it('não introduz perda de precisão nos cortes de 10m', () => {
    // 3 * (3,28 + 0,00 + 0,05) = 9,99 m.
    expect(calcularPapelDecorisi([{ larguraCm: 186, alturaCm: 328 }], 0).quantidade).toBe('1')
    expect(calcularPapelDecorisi([{ larguraCm: 186, alturaCm: 329 }], 0).quantidade).toBe('2')
  })
  it('soma painéis com quatro decimais e sem incluir margens gratuitas', () => {
    expect(calcularPainelDecorisi([{ larguraCm: 350, alturaCm: 270 }]).quantidade).toBe('9.4500')
    expect(calcularPainelDecorisi([{ larguraCm: 101, alturaCm: 101 }]).quantidade).toBe('1.0201')
    expect(calcularPainelDecorisi([{ larguraCm: 101, alturaCm: 101 }, { larguraCm: 1, alturaCm: 1 }]).quantidade).toBe('1.0202')
  })
  it.each([0, -1, 1.5, NaN, Infinity, 2147483648])('rejeita dimensões inválidas %s', (larguraCm) => {
    expect(() => calcularPainelDecorisi([{ larguraCm, alturaCm: 270 }])).toThrow()
  })
  it('protege limites, repetição e arrays vazios', () => {
    expect(() => calcularPapelDecorisi([], 0)).toThrow()
    expect(() => calcularPapelDecorisi([{ larguraCm: 1, alturaCm: 1 }], -1)).toThrow()
    expect(() => calcularPainelDecorisi(Array.from({ length: 21 }, () => ({ larguraCm: 1, alturaCm: 1 })))).toThrow()
  })
  it('arredonda subtotal monetário sem arredondar área e suporta fração de centavo SGI', () => {
    expect(subtotalDecorisiCentavos('1.0201', '230.00')).toBe('23462')
    expect(subtotalDecorisiCentavos('1', '0.005')).toBe('1')
    expect(subtotalDecorisiCentavos('2', '530.00')).toBe('106000')
    for (const preco of ['NaN', 'Infinity', '-1', '0']) expect(() => subtotalDecorisiCentavos('1', preco)).toThrow()
  })
})
describe('Decorisi: catálogo e rascunhos', () => {
  it('contém 90 referências reais, 12 zeros, e PF200–PF280 pesquisável', () => {
    expect(fonte.registros).toHaveLength(90)
    expect(fonte.registros.filter((r) => Number(r.repeticaoM) === 0)).toHaveLength(12)
    expect(fonte.registros.find((r) => r.referencia === 'DB813')?.repeticaoM).toBe('0.39')
    expect(REFERENCIAS_PF_DECORISI).toHaveLength(81)
    expect(pesquisarReferenciasPf('280')).toEqual(['PF280'])
    expect(referenciaPfValida('PF281')).toBe(false)
    expect(produtoComercialDecorisi('PAPEL', 'PERSONALIZADO').produtoIdSgi).toBe(36566)
  })
  it('permite rascunhos incompletos e evita repetir card da mesma arte de catálogo', () => {
    const item = { tipo: 'PAPEL', classificacao: 'CATALOGO', referencia: 'DB813', medidas: [{ larguraCm: null }] }
    expect(validarItensDecorisi([item])[0].medidas[0].alturaCm).toBeNull()
    expect(() => validarItensDecorisi([item, item])).toThrow('ARTE_CATALOGO_DUPLICADA')
    expect(validarItensDecorisi([{ ...item, classificacao: 'PERSONALIZADO' }, { ...item, classificacao: 'PERSONALIZADO' }])).toHaveLength(2)
  })
  it('normaliza UUID para impedir dois cards com o mesmo ID em caixa diferente', () => {
    const id = 'abcdefab-0000-4000-8000-000000000001'
    const item = { id, tipo: 'PAINEL', classificacao: 'PERSONALIZADO', medidas: [] }
    expect(() => validarItensDecorisi([item, { ...item, id: id.toUpperCase() }])).toThrow('ID_ITEM_DECORISI_INVALIDO')
  })
})
