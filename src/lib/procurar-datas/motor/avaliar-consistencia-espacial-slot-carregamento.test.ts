import { describe, expect, it } from 'vitest'
import { avaliarConsistenciaEspacialSlotV2 } from './avaliar-consistencia-espacial-slot'

const resumoBase = {
  linhasRecebidas: 0,
  linhasDaData: 0,
  linhasDaEquipe: 0,
  pontosValidos: 0,
  pontosDescartados: 0,
  semEndereco: 0,
  semCoordenadas: 0,
  eventosOperacionaisNaoEspaciais: 0,
  tempoOperacionalNaoEspacialMin: 0,
  eventosDesconhecidosSemEndereco: 0,
  tempoDesconhecidoSemEnderecoMin: 0,
}

describe('avaliarConsistenciaEspacialSlotV2 - carregamento operacional', () => {
  it('bloqueia evento desconhecido sem endereco classificado pelo parser', () => {
    const resultado = avaliarConsistenciaEspacialSlotV2({
      disponibilidade: { tempoUtilizadoMin: 60, disponivelMin: 360 },
      resumoAgenda: {
        ...resumoBase,
        linhasDaData: 1,
        linhasDaEquipe: 1,
        pontosDescartados: 1,
        semEndereco: 1,
        eventosDesconhecidosSemEndereco: 1,
        tempoDesconhecidoSemEnderecoMin: 30,
      },
    })

    expect(resultado.estado).toBe('evento-desconhecido-sem-endereco')
    expect(resultado.bloqueado).toBe(true)
    expect(resultado.rotaSimplesPermitida).toBe(false)
  })

  it('permite rota simples quando tempo utilizado e explicado por carregamento operacional', () => {
    const resultado = avaliarConsistenciaEspacialSlotV2({
      disponibilidade: { tempoUtilizadoMin: 30, disponivelMin: 390, capacidadeTotalMin: 420 },
      resumoAgenda: {
        ...resumoBase,
        linhasDaData: 1,
        linhasDaEquipe: 1,
        eventosOperacionaisNaoEspaciais: 1,
        tempoOperacionalNaoEspacialMin: 30,
      },
    })

    expect(resultado).toMatchObject({
      estado: 'rota-simples-com-carregamento',
      bloqueado: false,
      rotaSimplesPermitida: true,
      eventosOperacionaisNaoEspaciais: 1,
      tempoOperacionalNaoEspacialMin: 30,
    })
  })
})
