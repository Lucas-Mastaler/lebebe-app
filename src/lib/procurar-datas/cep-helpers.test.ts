import { describe, expect, it } from 'vitest'
import { normalizarCep, extrairDigitosCep } from './cep-helpers'

describe('cep-helpers', () => {
  describe('normalizarCep', () => {
    it('formata 8 digitos para 00000-000', () => {
      expect(normalizarCep('01310100')).toBe('01310-100')
      expect(normalizarCep('80010000')).toBe('80010-000')
    })

    it('aceita entrada com hifen ja formatada', () => {
      expect(normalizarCep('01310-100')).toBe('01310-100')
      expect(normalizarCep('80010-000')).toBe('80010-000')
    })

    it('retorna null para CEP com menos de 8 digitos', () => {
      expect(normalizarCep('1234567')).toBeNull()
      expect(normalizarCep('')).toBeNull()
      expect(normalizarCep('abc')).toBeNull()
    })

    it('retorna null para CEP com mais de 8 digitos', () => {
      expect(normalizarCep('123456789')).toBeNull()
    })

    it('remove caracteres nao numericos antes de validar', () => {
      expect(normalizarCep('01.310-100')).toBe('01310-100')
      expect(normalizarCep(' 80010 000 ')).toBe('80010-000')
    })
  })

  describe('extrairDigitosCep', () => {
    it('retorna 8 digitos de um CEP valido', () => {
      expect(extrairDigitosCep('01310-100')).toBe('01310100')
      expect(extrairDigitosCep('80010000')).toBe('80010000')
    })

    it('retorna null para entradas invalidas', () => {
      expect(extrairDigitosCep('')).toBeNull()
      expect(extrairDigitosCep('123')).toBeNull()
      expect(extrairDigitosCep('abcdefgh')).toBeNull()
      expect(extrairDigitosCep('123456789')).toBeNull()
    })

    it('remove separadores antes de contar digitos', () => {
      expect(extrairDigitosCep('01.310-100')).toBe('01310100')
    })
  })
})
