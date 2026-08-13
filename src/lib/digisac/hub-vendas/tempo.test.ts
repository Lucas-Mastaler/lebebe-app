import { describe, expect, it } from 'vitest'
import { ajustarParaHorarioOperacional, obterIntervaloDatasLocaisUtc, obterIntervaloDiaLocalUtc, somarSegundosAjustandoHorario } from './tempo'

const horario = {
  timezone: 'America/Sao_Paulo',
  diasSemana: [1, 2, 3, 4, 5, 6],
  inicio: '09:00',
  fim: '18:00',
}

describe('tempo Hub/Vendas', () => {
  it('ajusta antes das 9h para inicio operacional em Sao Paulo sem offset fixo', () => {
    const resultado = ajustarParaHorarioOperacional(new Date('2026-07-28T10:00:00.000Z'), horario)

    expect(resultado.toISOString()).toBe('2026-07-28T12:00:00.000Z')
  })

  it('pula domingo para segunda-feira as 9h locais', () => {
    const resultado = ajustarParaHorarioOperacional(new Date('2026-08-02T14:00:00.000Z'), horario)

    expect(resultado.toISOString()).toBe('2026-08-03T12:00:00.000Z')
  })

  it('calcula intervalo do dia local por timezone', () => {
    const intervalo = obterIntervaloDiaLocalUtc(new Date('2026-07-28T15:00:00.000Z'), 'America/Sao_Paulo')

    expect(intervalo.inicioUtc.toISOString()).toBe('2026-07-28T03:00:00.000Z')
    expect(intervalo.fimUtc.toISOString()).toBe('2026-07-29T03:00:00.000Z')
  })

  it('ao passar do fim do expediente agenda no proximo dia operacional', () => {
    const resultado = somarSegundosAjustandoHorario(new Date('2026-07-28T20:59:00.000Z'), 180, horario)

    expect(resultado.toISOString()).toBe('2026-07-29T12:00:00.000Z')
  })

  it('converte periodo de um dia para intervalo UTC semiaberto de Sao Paulo', () => {
    const intervalo = obterIntervaloDatasLocaisUtc('2026-08-10', '2026-08-10', 'America/Sao_Paulo')

    expect(intervalo.inicioUtc.toISOString()).toBe('2026-08-10T03:00:00.000Z')
    expect(intervalo.fimUtc.toISOString()).toBe('2026-08-11T03:00:00.000Z')
  })

  it('inclui integralmente a data final em periodos de varios dias', () => {
    const intervalo = obterIntervaloDatasLocaisUtc('2026-08-10', '2026-08-12', 'America/Sao_Paulo')

    expect(intervalo.inicioUtc.toISOString()).toBe('2026-08-10T03:00:00.000Z')
    expect(intervalo.fimUtc.toISOString()).toBe('2026-08-13T03:00:00.000Z')
  })

  it('rejeita data inicial posterior a data final', () => {
    expect(() => obterIntervaloDatasLocaisUtc('2026-08-12', '2026-08-10', 'America/Sao_Paulo'))
      .toThrow('hub_vendas_periodo_invalido')
  })
})
