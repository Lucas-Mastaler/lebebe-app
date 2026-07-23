import { describe, expect, it } from 'vitest'
import { classificarEventoAgendaV2 } from './classificar-evento-agenda'

describe('classificarEventoAgendaV2', () => {
  it.each([
    ['9 (00:30) CARREGAMENTO SEG-QUI (EQP DE TRANSFERENCIA)', '00:30', 30],
    ['0 (01:00) CARREGAMENTO QUARTA TRANSFERENCIA', '01:00', 60],
    ['9 (00:45) CARREGAMENTO SEXTA', '00:45', 45],
  ])('reconhece CARREGAMENTO operacional por palavra isolada e duracao oficial valida: %s', (
    titulo,
    duracaoOficial,
    duracaoMin
  ) => {
    const resultado = classificarEventoAgendaV2({
      titulo,
      duracaoOficial,
      temEndereco: false,
    })

    expect(resultado).toMatchObject({
      natureza: 'operacional-nao-espacial',
      motivo: 'carregamento-reconhecido',
      duracaoMin,
      consomeDisponibilidade: true,
      requerEndereco: false,
      entraNaRota: false,
      permiteRotaSimplesSemOutrosPontos: true,
    })
  })

  it.each([
    ['DESCARREGAMENTO SEXTA', '00:30'],
    ['RECARREGAMENTO QUARTA', '00:30'],
    ['CARREGAMENTO 90 MIN', '01:30'],
    ['CARREGAMENTO 120 MIN', '02:00'],
    ['CARREGAMENTO ZERO', '00:00'],
    ['CARREGAMENTO SEM DURACAO', ''],
    ['CARREGAMENTO DURACAO INVALIDA', null],
    ['EVENTO DESCONHECIDO 30MIN', '00:30'],
    ['', '00:30'],
  ])('mantem fail-closed para titulo/duracao fora da regra: %s', (titulo, duracaoOficial) => {
    const resultado = classificarEventoAgendaV2({
      titulo,
      duracaoOficial,
      temEndereco: false,
    })

    expect(resultado.natureza).toBe('desconhecido')
    expect(resultado.requerEndereco).toBe(true)
    expect(resultado.entraNaRota).toBe(false)
    expect(resultado.permiteRotaSimplesSemOutrosPontos).toBe(false)
  })

  it('nao usa a duracao embutida no titulo quando a duracao oficial esta ausente', () => {
    const resultado = classificarEventoAgendaV2({
      titulo: '9 (00:30) CARREGAMENTO SEG-QUI (EQP DE TRANSFERENCIA)',
      duracaoOficial: '',
      temEndereco: false,
    })

    expect(resultado).toMatchObject({
      natureza: 'desconhecido',
      motivo: 'carregamento-com-duracao-oficial-invalida',
      duracaoMin: null,
    })
  })

  it('classifica evento com endereco como servico espacial e exige rota', () => {
    const resultado = classificarEventoAgendaV2({
      titulo: 'ENTREGA CLIENTE',
      duracaoOficial: '00:40',
      temEndereco: true,
    })

    expect(resultado).toMatchObject({
      natureza: 'servico-espacial',
      motivo: 'endereco-presente',
      duracaoMin: 40,
      requerEndereco: true,
      entraNaRota: true,
    })
  })
})
