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
}

describe('avaliarConsistenciaEspacialSlotV2', () => {
  it.each([
    ['dia útil vazio', '2026-07-27'],
    ['sábado vazio', '2026-07-25'],
  ])('permite rota simples somente em %s com tempoUtilizadoMin=0 (%s)', () => {
    const resultado = avaliarConsistenciaEspacialSlotV2({
      disponibilidade: {
        tempoUtilizadoMin: 0,
        disponivelMin: 420,
        capacidadeTotalMin: 420,
      },
      resumoAgenda: resumoBase,
    })

    expect(resultado).toMatchObject({
      estado: 'dia-realmente-vazio',
      rotaSimplesPermitida: true,
      bloqueado: false,
    })
  })

  it('bloqueia dia parcialmente ocupado sem pontos da agenda', () => {
    const resultado = avaliarConsistenciaEspacialSlotV2({
      disponibilidade: {
        tempoUtilizadoMin: 315,
        disponivelMin: 105,
        capacidadeTotalMin: 420,
      },
      resumoAgenda: resumoBase,
    })

    expect(resultado).toMatchObject({
      estado: 'ocupado-sem-pontos',
      rotaSimplesPermitida: false,
      bloqueado: true,
    })
  })

  it.each([
    ['2026-07-25', 180, 60],
    ['2026-07-28', 315, 105],
    ['2026-07-30', 300, 120],
  ])('bloqueia o slot original %s quando ha %i min utilizados e %i min disponiveis', (
    _dataISO,
    tempoUtilizadoMin,
    disponivelMin
  ) => {
    const resultado = avaliarConsistenciaEspacialSlotV2({
      disponibilidade: { tempoUtilizadoMin, disponivelMin },
      resumoAgenda: resumoBase,
    })

    expect(resultado.estado).toBe('ocupado-sem-pontos')
    expect(resultado.rotaSimplesPermitida).toBe(false)
    expect(resultado.bloqueado).toBe(true)
  })

  it('bloqueia agendamento sem endereço', () => {
    const resultado = avaliarConsistenciaEspacialSlotV2({
      disponibilidade: { tempoUtilizadoMin: 60, disponivelMin: 360 },
      resumoAgenda: {
        ...resumoBase,
        linhasDaData: 1,
        linhasDaEquipe: 1,
        pontosDescartados: 1,
        semEndereco: 1,
      },
    })

    expect(resultado.estado).toBe('agenda-sem-endereco')
    expect(resultado.bloqueado).toBe(true)
  })

  it('bloqueia endereço sem coordenadas', () => {
    const resultado = avaliarConsistenciaEspacialSlotV2({
      disponibilidade: { tempoUtilizadoMin: 60, disponivelMin: 360 },
      resumoAgenda: {
        ...resumoBase,
        linhasDaData: 1,
        linhasDaEquipe: 1,
        pontosDescartados: 1,
        semCoordenadas: 1,
      },
    })

    expect(resultado.estado).toBe('agenda-sem-coordenadas')
    expect(resultado.bloqueado).toBe(true)
  })

  it('aceita agenda com pontos válidos', () => {
    const resultado = avaliarConsistenciaEspacialSlotV2({
      disponibilidade: { tempoUtilizadoMin: 60, disponivelMin: 360 },
      resumoAgenda: {
        ...resumoBase,
        linhasDaData: 1,
        linhasDaEquipe: 1,
        pontosValidos: 1,
      },
    })

    expect(resultado).toMatchObject({
      estado: 'com-pontos-validos',
      bloqueado: false,
      rotaSimplesPermitida: false,
    })
  })

  it('falha fechado quando tempo utilizado não foi confirmado', () => {
    const resultado = avaliarConsistenciaEspacialSlotV2({
      disponibilidade: { tempoUtilizadoMin: null, disponivelMin: 420 },
      resumoAgenda: resumoBase,
    })

    expect(resultado.estado).toBe('capacidade-indeterminada')
    expect(resultado.bloqueado).toBe(true)
  })
})
