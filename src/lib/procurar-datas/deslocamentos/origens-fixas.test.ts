import { describe, it, expect } from 'vitest'
import { resolverOrigemFixa, normalizarTextoOrigemFixa } from './origens-fixas'

describe('origens-fixas', () => {
  describe('normalizarTextoOrigemFixa', () => {
    it('remove acentos e converte para maiusculas', () => {
      expect(normalizarTextoOrigemFixa('Rua Doutor Francisco Soares')).toBe('RUA DOUTOR FRANCISCO SOARES')
    })

    it('expande abreviacoes comuns e remove Brasil', () => {
      expect(normalizarTextoOrigemFixa('R. Dr. Francisco Soares')).toBe('RUA DOUTOR FRANCISCO SOARES')
      expect(normalizarTextoOrigemFixa('Av. Brasil')).toBe('AVENIDA')
      expect(normalizarTextoOrigemFixa('Al. das Rosas')).toBe('ALAMEDA DAS ROSAS')
    })

    it('remove Brasil e caracteres nao alfanumericos', () => {
      expect(
        normalizarTextoOrigemFixa('860, Rua Doutor Francisco Soares, Novo Mundo, Curitiba, PR, 81030-470, Brasil')
      ).toBe('860 RUA DOUTOR FRANCISCO SOARES NOVO MUNDO CURITIBA PR 81030 470')
    })
  })

  describe('resolverOrigemFixa', () => {
    it('resolve deposito por alias completo sem acento', () => {
      const res = resolverOrigemFixa('Rua Doutor Francisco Soares, 860, Curitiba - PR, 81030-470')
      expect(res.ok).toBe(true)
      if (!res.ok) return
      expect(res.label).toBe('DEPOSITO_LEBEBE')
      expect(res.lat).toBe(-25.4934984)
      expect(res.lng).toBe(-49.2765509)
      expect(res.display).toContain('Doutor Francisco Soares')
    })

    it('resolve deposito por alias abreviado com virgula no final', () => {
      const res = resolverOrigemFixa('R. Dr. Francisco Soares, 860, Curitiba-PR,')
      expect(res.ok).toBe(true)
      if (!res.ok) return
      expect(res.label).toBe('DEPOSITO_LEBEBE')
    })

    it('resolve deposito com ordem invertida e Brasil', () => {
      const res = resolverOrigemFixa('860, Rua Doutor Francisco Soares, Novo Mundo, Curitiba, PR, 81030-470, Brasil')
      expect(res.ok).toBe(true)
      if (!res.ok) return
      expect(res.label).toBe('DEPOSITO_LEBEBE')
    })

    it('resolve loja por alias com acento', () => {
      const res = resolverOrigemFixa('Rua Deputado Néo Martins, 872 - Novo Mundo, Curitiba - PR, 81030-470')
      expect(res.ok).toBe(true)
      if (!res.ok) return
      expect(res.label).toBe('LOJA_LEBEBE')
      expect(res.lat).toBe(-25.4944568)
      expect(res.lng).toBe(-49.2771426)
    })

    it('resolve loja por alias sem acento', () => {
      const res = resolverOrigemFixa('Rua Deputado Neo Martins, 872, Curitiba - PR, 81030-470')
      expect(res.ok).toBe(true)
      if (!res.ok) return
      expect(res.label).toBe('LOJA_LEBEBE')
    })

    it('nao confunde endereco desconhecido com deposito', () => {
      const res = resolverOrigemFixa('Rua XV de Novembro, 860, Curitiba - PR')
      expect(res.ok).toBe(false)
    })

    it('nao confunde deposito com numero diferente', () => {
      const res = resolverOrigemFixa('Rua Doutor Francisco Soares, 999, Curitiba - PR')
      expect(res.ok).toBe(false)
    })

    it('falha com origem vazia', () => {
      const res = resolverOrigemFixa('')
      expect(res.ok).toBe(false)
    })

    it('falha com espacos em branco', () => {
      const res = resolverOrigemFixa('   ')
      expect(res.ok).toBe(false)
    })

    it('preserva origemRecebida e normalizada no resultado', () => {
      const entrada = 'R. Dr. Francisco Soares, 860, Curitiba-PR,'
      const res = resolverOrigemFixa(entrada)
      expect(res.ok).toBe(true)
      if (!res.ok) return
      expect(res.origemRecebida).toBe(entrada)
      expect(res.normalizada).toContain('FRANCISCO')
      expect(res.normalizada).toContain('SOARES')
      expect(res.normalizada).toContain('860')
    })
  })
})
