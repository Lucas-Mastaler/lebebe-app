import { describe, expect, it } from 'vitest'
import {
  arredondarAreaCobradaParaCimaCincoCentesimos,
  calcularAreaCobradaCentesimosM2,
  classificarProdutoMoriah,
  converterMedidaMetrosParaCentimetros,
  formatarAreaMetrosQuadrados,
  formatarMedidaMetros,
  mascararMedidaMetros,
  validarDimensoesPorFormato,
  verificarMedidaRecomendada,
} from './medidas'

describe('medidas Moriah', () => {
  it.each([
    ['1', '0,01'],
    ['10', '0,10'],
    ['95', '0,95'],
    ['195', '1,95'],
    ['200', '2,00'],
    ['1500', '15,00'],
    ['1,95', '1,95'],
    ['1.95', '1,95'],
    ['1,9', '0,19'],
    ['', ''],
  ])('aplica máscara decimal fixa a %s como %s', (entrada, esperado) => {
    expect(mascararMedidaMetros(entrada)).toBe(esperado)
  })

  it('preserva entrada inválida para permitir mensagem de validação', () => {
    expect(mascararMedidaMetros('abc')).toBe('abc')
    expect(mascararMedidaMetros('1501')).toBe('15,01')
  })

  it.each([
    ['0,10', 10],
    ['0.10', 10],
    ['1', 100],
    ['1,5', 150],
    ['1.50', 150],
    ['15,00', 1500],
    [' 0,95 ', 95],
    ['1,95', 195],
    ['2,00', 200],
  ])('converte %s para %i cm sem ponto flutuante', (entrada, esperado) => {
    expect(converterMedidaMetrosParaCentimetros(entrada)).toMatchObject({ valido: true, dados: esperado })
  })

  it.each(['0,099', '0,949', '0,951', '1,949', '1,951', '15,001', '1e2', 'NaN', 'Infinity', '-1', '+1', 'abc'])
    ('rejeita sintaxe inválida %s sem arredondar', (entrada) => {
      expect(converterMedidaMetrosParaCentimetros(entrada)).toMatchObject({
        valido: false,
        erros: [{ codigo: 'MEDIDA_INVALIDA' }],
      })
    })

  it('rejeita tipo não textual e limites fora de 0,10 a 15,00 m', () => {
    expect(converterMedidaMetrosParaCentimetros(Number.NaN).erros[0].codigo).toBe('MEDIDA_INVALIDA')
    expect(converterMedidaMetrosParaCentimetros('0,09').erros[0].codigo).toBe('MEDIDA_FORA_DO_LIMITE')
    expect(converterMedidaMetrosParaCentimetros('15,01').erros[0].codigo).toBe('MEDIDA_FORA_DO_LIMITE')
    expect(converterMedidaMetrosParaCentimetros('0,09').erros[0].mensagem).toBe('A medida mínima é 0,10 m.')
    expect(converterMedidaMetrosParaCentimetros('15,01').erros[0].mensagem).toBe('A medida máxima é 15,00 m.')
  })

  it('trata múltiplos de 5 cm como recomendados', () => {
    expect(verificarMedidaRecomendada(95)).toBeNull()
    expect(verificarMedidaRecomendada(195)).toBeNull()
  })

  it('retorna aviso não bloqueante para outras medidas', () => {
    expect(verificarMedidaRecomendada(203)).toMatchObject({ codigo: 'MEDIDA_FORA_INTERVALO_RECOMENDADO' })
    expect(verificarMedidaRecomendada(207)?.mensagem).toContain('variação de até 2%')
  })

  it('valida dimensões específicas de cada formato', () => {
    expect(validarDimensoesPorFormato('REDONDO', 200, null).valido).toBe(true)
    expect(validarDimensoesPorFormato('REDONDO', 200, 200).erros[0].codigo).toBe('DIMENSOES_INCOMPATIVEIS')
    expect(validarDimensoesPorFormato('RETANGULAR', 200, null).valido).toBe(false)
    expect(validarDimensoesPorFormato('ORGANICO', 200, null).valido).toBe(false)
    expect(validarDimensoesPorFormato('INVALIDO', 200, 200).erros[0].codigo).toBe('FORMATO_INVALIDO')
    expect(validarDimensoesPorFormato('RETANGULAR', 9, 1501).valido).toBe(false)
  })
})

describe('área cobrada Moriah', () => {
  it('calcula redondo pelo quadrado do diâmetro, sem pi', () => {
    expect(calcularAreaCobradaCentesimosM2('REDONDO', 200, null).dados).toEqual({
      areaCm2: 40000,
      areaCobradaCentesimosM2: 400,
    })
  })

  it.each([
    ['RETANGULAR', 100, 380, 380],
    ['RETANGULAR', 195, 300, 585],
    ['ORGANICO', 200, 200, 400],
    ['RETANGULAR', 10, 10, 5],
    ['RETANGULAR', 1500, 1500, 22500],
  ] as const)('calcula %s %i x %i como %i centésimos', (formato, d1, d2, esperado) => {
    expect(calcularAreaCobradaCentesimosM2(formato, d1, d2).dados?.areaCobradaCentesimosM2).toBe(esperado)
  })

  it.each([
    ['RETANGULAR', 200, 100, 200], // 2,00 x 1,00 = 2,00 m² -> 2,00 m²
    ['RETANGULAR', 200, 101, 205], // 2,00 x 1,01 = 2,02 m² -> 2,05 m²
    ['RETANGULAR', 200, 104, 210], // 2,00 x 1,04 = 2,08 m² -> 2,10 m²
    ['RETANGULAR', 200, 105, 210], // 2,00 x 1,05 = 2,10 m² -> 2,10 m² (já é múltiplo)
    ['RETANGULAR', 200, 106, 215], // 2,00 x 1,06 = 2,12 m² -> 2,15 m²
  ] as const)('área cobrada de %s %i x %i cm arredonda para %i centésimos (sempre para cima, múltiplo de 0,05 m²)', (formato, d1, d2, esperado) => {
    expect(calcularAreaCobradaCentesimosM2(formato, d1, d2).dados?.areaCobradaCentesimosM2).toBe(esperado)
  })

  it.each([
    [20000, 200], // 2,00 -> 2,00
    [20100, 205], // 2,01 -> 2,05
    [20200, 205], // 2,02 -> 2,05
    [20490, 205], // 2,049 -> 2,05
    [20500, 205], // 2,05 -> 2,05
    [20510, 210], // 2,051 -> 2,10
    [20800, 210], // 2,08 -> 2,10
    [21000, 210], // 2,10 -> 2,10
    [21200, 215], // 2,12 -> 2,15
  ])('arredonda %i cm² para %i centésimos, sempre para cima e sem ruído de ponto flutuante', (areaCm2, esperado) => {
    const resultado = arredondarAreaCobradaParaCimaCincoCentesimos(areaCm2)
    expect(resultado).toBe(esperado)
    expect(Number.isInteger(resultado)).toBe(true)
  })

  it('nunca arredonda para baixo', () => {
    expect(arredondarAreaCobradaParaCimaCincoCentesimos(1)).toBe(5)
    expect(arredondarAreaCobradaParaCimaCincoCentesimos(499)).toBe(5)
  })

  it('mantém o valor quando já é um múltiplo exato de 0,05 m²', () => {
    expect(arredondarAreaCobradaParaCimaCincoCentesimos(500)).toBe(5)
    expect(arredondarAreaCobradaParaCimaCincoCentesimos(2250000)).toBe(22500)
  })

  it('formata área e medida sempre com duas casas em português', () => {
    expect([1, 90, 380, 585, 400].map(formatarAreaMetrosQuadrados)).toEqual([
      '0,01 m²', '0,90 m²', '3,80 m²', '5,85 m²', '4,00 m²',
    ])
    expect(formatarMedidaMetros(10)).toBe('0,10')
    expect(formatarMedidaMetros(1500)).toBe('15,00')
  })

  it('rejeita unidades de formatação inválidas', () => {
    expect(() => formatarAreaMetrosQuadrados(1.5)).toThrow(RangeError)
    expect(() => formatarMedidaMetros(-1)).toThrow(RangeError)
  })
})

describe('classificação automática Moriah', () => {
  it.each([
    ['RETANGULAR', 95, 400, '21157'],
    ['RETANGULAR', 195, 300, '21157'],
    ['RETANGULAR', 205, 195, '21157'],
    ['RETANGULAR', 200, 200, '21158'],
    ['RETANGULAR', 200, 500, '21158'],
    ['RETANGULAR', 199, 500, '21158'],
    ['RETANGULAR', 201, 200, '21158'],
    ['RETANGULAR', 201, 201, '21159'],
    ['RETANGULAR', 300, 400, '21159'],
    ['REDONDO', 95, null, '21157'],
    ['REDONDO', 195, null, '21157'],
    ['REDONDO', 200, null, '21158'],
    ['REDONDO', 250, null, '21158'],
    ['ORGANICO', 201, 201, '21159'],
    ['ORGANICO', 200, 500, '21158'],
  ] as const)('classifica %s %s x %s como %s', (formato, d1, d2, codigo) => {
    expect(classificarProdutoMoriah(formato, d1, d2).codigo).toBe(codigo)
  })

  it('nunca classifica redondo como produto com emenda', () => {
    expect(classificarProdutoMoriah('REDONDO', 1500, null).codigo).toBe('21158')
  })
})
