import { describe, expect, it } from 'vitest'
import {
  detectarTipoBuscaCliente,
  escaparTermoIlike,
  normalizarTermosBuscaNome,
  normalizarTrechoBuscaTelefone,
} from './clientes'

describe('busca de clientes presenciais', () => {
  it('normaliza busca por nome em multiplos termos', () => {
    expect(normalizarTermosBuscaNome('  Lu   Ma  ')).toEqual(['Lu', 'Ma'])
    expect(normalizarTermosBuscaNome('LUCAS MASTALER')).toEqual(['LUCAS', 'MASTALER'])
  })

  it('classifica busca por nome, telefone, vazia e mista invalida', () => {
    expect(detectarTipoBuscaCliente('LU')).toBe('nome')
    expect(detectarTipoBuscaCliente('lu')).toBe('nome')
    expect(detectarTipoBuscaCliente('(41) 99642-8707')).toBe('telefone')
    expect(detectarTipoBuscaCliente('')).toBe('vazia')
    expect(detectarTipoBuscaCliente('---')).toBe('vazia')
    expect(detectarTipoBuscaCliente('Lu 8707')).toBe('mista_invalida')
  })

  it('normaliza trecho numerico de telefone para busca parcial', () => {
    expect(normalizarTrechoBuscaTelefone('41996428707')).toBe('41996428707')
    expect(normalizarTrechoBuscaTelefone('(41) 99642-8707')).toBe('41996428707')
    expect(normalizarTrechoBuscaTelefone('+55 (41) 99642-8707')).toBe('41996428707')
    expect(normalizarTrechoBuscaTelefone('99642')).toBe('99642')
    expect(normalizarTrechoBuscaTelefone('8707')).toBe('8707')
    expect(normalizarTrechoBuscaTelefone('---')).toBe('')
  })

  it('escapa curingas do ilike sem remover o termo', () => {
    expect(escaparTermoIlike('Lu%_Ma')).toBe('Lu\\%\\_Ma')
  })
})
