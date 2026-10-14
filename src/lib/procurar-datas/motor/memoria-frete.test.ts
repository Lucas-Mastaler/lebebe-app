import { describe, expect, it } from 'vitest'
import { lerMemoriaFretePesquisa, type MemoriaFretePesquisaV1 } from './memoria-frete'
import { montarFretesLegadoPorDistKm } from './montar-fretes-legado-por-dist-km'

function criarMemoria(): MemoriaFretePesquisaV1 {
  const resultado = montarFretesLegadoPorDistKm({
    candidatos: [{ dataISO: '2026-11-28', equipe: 'EQUIPE 1', tipo: 'normal', rank: 1,
      elegivel: true, horaMarcada: false, kmAdicionalNaRotaM: 38806, origemKmAdicional: 'slot' }],
    distKm: 38.948, isRural: true, isCondominio: false,
    params: { kmMaxViagem: 150, kmMaxValorFixo: 10, kmMaxLongaCidade: 25, kmMaxNaoViagem: 40,
      valorSemanaAte10km: 90, valorSabadoAte10km: 140, fatorMultiplicadorKmViagem: 2.05,
      multiplicadorKmNaoViagem: 3, valorDiaApos25kmSemana: 50, valorDiaApos25kmSabado: 100, precoCondominioAdicional: 50 },
    valorAdicionalEspecial: 70, valorAdicionalPremium: 120, horaMarcadaValorAdicional: 80,
  })
  return { versao: 1, formula: 'legado-frete-v1', origemGeografica: 'deposito',
    origem: { lat: -25.493498, lng: -49.276551 }, destino: { lat: -25.685488, lng: -49.545854 },
    distKm: 38.948, distM: 38948, fonteDistancia: 'osrm-route-deposito-destino',
    valorInicialInformado: 330, valorInicialAplicadoComoPiso: false, encomendaInformada: true, encomendaInfluenciaPreco: false,
    candidatos: resultado.memorias.map((c) => ({ ...c, freteApresentado: resultado.fretes[0].frete })),
  }
}

describe('memória de frete versionada', () => {
  it('lê as etapas e parâmetros preservados após serialização JSON', () => {
    const memoria = criarMemoria()
    expect(lerMemoriaFretePesquisa(JSON.parse(JSON.stringify(memoria)))).toEqual(memoria)
    expect(memoria.candidatos[0].resultado.valorFrete).toBe(450)
    expect(memoria.candidatos[0].etapas.find((etapa) => etapa.descricao === 'Subtotal antes do arredondamento')?.valor).toBeCloseTo(368.5934)
  })
  it.each([undefined, null, {}, { versao: 2 }])('não inventa memória para registro ausente ou incompatível', (value) => {
    expect(lerMemoriaFretePesquisa(value)).toBeNull()
  })
  it('rejeita parâmetros incompletos e etapas incompatíveis com o total', () => {
    const memoria = criarMemoria()
    const semParametros = JSON.parse(JSON.stringify(memoria))
    delete semParametros.candidatos[0].entrada.params.valorSabadoAte10km
    expect(lerMemoriaFretePesquisa(semParametros)).toBeNull()
    memoria.candidatos[0].etapas.at(-1)!.valor = 999
    expect(lerMemoriaFretePesquisa(memoria)).toBeNull()
  })
})
