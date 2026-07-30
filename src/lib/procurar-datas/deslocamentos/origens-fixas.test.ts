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

    it('resolve loja Marechal/Hauer com endereco completo', () => {
      const res = resolverOrigemFixa('Av. Mal. Floriano Peixoto, 5636 - Hauer, Curitiba - PR, 81630-000')
      expect(res.ok).toBe(true)
      if (!res.ok) return
      expect(res.label).toBe('LOJA_MARECHAL_HAUER')
      expect(res.lat).toBe(-25.477376)
      expect(res.lng).toBe(-49.249524)
      expect(res.display).toContain('Marechal Floriano Peixoto')
      expect(res.display).toContain('Hauer')
    })

    it('resolve loja Marechal/Hauer sem acento', () => {
      const res = resolverOrigemFixa('Av Mal Floriano Peixoto 5636 Hauer Curitiba PR 81630-000')
      expect(res.ok).toBe(true)
      if (!res.ok) return
      expect(res.label).toBe('LOJA_MARECHAL_HAUER')
    })

    it('resolve loja Marechal/Hauer com Avenida completo', () => {
      const res = resolverOrigemFixa('Avenida Marechal Floriano Peixoto, 5636, Hauer, Curitiba - PR')
      expect(res.ok).toBe(true)
      if (!res.ok) return
      expect(res.label).toBe('LOJA_MARECHAL_HAUER')
    })

    it('nao confunde loja Marechal/Hauer com numero diferente', () => {
      const res = resolverOrigemFixa('Av. Mal. Floriano Peixoto, 9999, Hauer, Curitiba - PR')
      expect(res.ok).toBe(false)
    })

    it('resolve loja Portao sem bairro', () => {
      const res = resolverOrigemFixa('Av. Rep. Argentina, 2777, Curitiba - PR, 80610-260')
      expect(res.ok).toBe(true)
      if (!res.ok) return
      expect(res.label).toBe('LOJA_PORTAO')
      expect(res.lat).toBe(-25.470662)
      expect(res.lng).toBe(-49.294289)
      expect(res.display).toContain('República Argentina')
    })

    it('resolve loja Portao sem acento', () => {
      const res = resolverOrigemFixa('Av Rep Argentina 2777 Curitiba PR 80610-260')
      expect(res.ok).toBe(true)
      if (!res.ok) return
      expect(res.label).toBe('LOJA_PORTAO')
    })

    it('resolve loja Portao com bairro', () => {
      const res = resolverOrigemFixa('Avenida República Argentina, 2777, Portão, Curitiba - PR')
      expect(res.ok).toBe(true)
      if (!res.ok) return
      expect(res.label).toBe('LOJA_PORTAO')
    })

    it('resolve loja Portao com Portao sem acento', () => {
      const res = resolverOrigemFixa('Avenida Republica Argentina, 2777, Portao, Curitiba - PR')
      expect(res.ok).toBe(true)
      if (!res.ok) return
      expect(res.label).toBe('LOJA_PORTAO')
    })

    it('nao confunde loja Portao com numero diferente', () => {
      const res = resolverOrigemFixa('Av. Rep. Argentina, 1234, Curitiba - PR')
      expect(res.ok).toBe(false)
    })

    it('resolve loja Bigorrilho somente com rua, numero e CEP', () => {
      const res = resolverOrigemFixa('Av. Cândido Hartmann, 456, 80730-440')
      expect(res.ok).toBe(true)
      if (!res.ok) return
      expect(res.label).toBe('LOJA_BIGORRILHO')
      expect(res.lat).toBe(-25.431229)
      expect(res.lng).toBe(-49.291418)
      expect(res.display).toContain('Cândido Hartmann')
    })

    it('resolve loja Bigorrilho sem acento', () => {
      const res = resolverOrigemFixa('Av Candido Hartmann 456 80730-440')
      expect(res.ok).toBe(true)
      if (!res.ok) return
      expect(res.label).toBe('LOJA_BIGORRILHO')
    })

    it('resolve loja Bigorrilho com bairro', () => {
      const res = resolverOrigemFixa('Avenida Cândido Hartmann, 456, Bigorrilho, Curitiba - PR')
      expect(res.ok).toBe(true)
      if (!res.ok) return
      expect(res.label).toBe('LOJA_BIGORRILHO')
    })

    it('resolve loja Bigorrilho com Bigorrilho sem acento', () => {
      const res = resolverOrigemFixa('Avenida Candido Hartmann, 456, Bigorrilho, Curitiba - PR')
      expect(res.ok).toBe(true)
      if (!res.ok) return
      expect(res.label).toBe('LOJA_BIGORRILHO')
    })

    it('nao confunde loja Bigorrilho com numero diferente', () => {
      const res = resolverOrigemFixa('Av. Cândido Hartmann, 789, 80730-440')
      expect(res.ok).toBe(false)
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
