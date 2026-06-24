import { describe, expect, it } from 'vitest'
import { otimizarRotaBaseLegado } from './otimizar-rota-base-legado'

const DEPOSITO = { lat: -25.4876648, lng: -49.2692262 }
const RIO_IVAI = {
  loc: { lat: -25.4665832, lng: -49.1853016 },
  addr: 'Rua Rio Ivai, 269, Weissopolis, Pinhais - PR, 83322-370',
}
const SAO_JOSE = {
  loc: { lat: -25.4352613, lng: -49.2415798 },
  addr: 'Avenida Sao Jose, 814, Cristo Rei, Curitiba - PR, 80050-350',
}

describe('otimizarRotaBaseLegado', () => {
  it('ordena 03/07 por greedy Haversine a partir do deposito', () => {
    const resultado = otimizarRotaBaseLegado({
      origem: DEPOSITO,
      pontos: [RIO_IVAI, SAO_JOSE],
    })

    expect(resultado.criterioOrdenacao).toBe('greedy-haversine')
    expect(resultado.twoOptExecutado).toBe(false)
    expect(resultado.twoOptAplicado).toBe(false)
    expect(resultado.ordemOriginal).toEqual([RIO_IVAI.addr, SAO_JOSE.addr])
    expect(resultado.ordemOtimizada).toEqual([
      'DEPOSITO',
      SAO_JOSE.addr,
      RIO_IVAI.addr,
    ])
    expect(resultado.pontosOrdenados.map((p) => p.addr)).toEqual([
      SAO_JOSE.addr,
      RIO_IVAI.addr,
    ])
  })

  it('preserva rota simples para zero ou um ponto', () => {
    expect(
      otimizarRotaBaseLegado({ origem: DEPOSITO, pontos: [] }).ordemOtimizada
    ).toEqual(['DEPOSITO'])

    expect(
      otimizarRotaBaseLegado({ origem: DEPOSITO, pontos: [RIO_IVAI] }).ordemOtimizada
    ).toEqual(['DEPOSITO', RIO_IVAI.addr])
  })
})
