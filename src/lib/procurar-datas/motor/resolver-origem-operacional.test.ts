// ─────────────────────────────────────────────────────────────────────────────
// resolver-origem-operacional.test.ts
//
// Testes unitários para o helper resolverOrigemOperacionalV2.
// Cobre: dias úteis vs sábado, equipes E1/E2, coordenadas inválidas/ausentes,
// validação de data, normalização de equipe, conversão de strings do Supabase.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest'
import {
  resolverOrigemOperacionalV2,
  ResolverOrigemOperacionalInput,
} from './resolver-origem-operacional'

// ─── Fixtures ────────────────────────────────────────────────────────────────

const CONFIG_VALIDA = {
  latDeposito: -25.4876648,
  lngDeposito: -49.2692262,
  latCasaE1: -25.494297,
  lngCasaE1: -49.277091,
  latCasaE2: -25.494297,
  lngCasaE2: -49.277091,
}

const CONFIG_CASA_E1_INVALIDA = {
  ...CONFIG_VALIDA,
  latCasaE1: NaN,
  lngCasaE1: NaN,
}

const CONFIG_CASA_E2_INVALIDA = {
  ...CONFIG_VALIDA,
  latCasaE2: NaN,
  lngCasaE2: NaN,
}

const CONFIG_DEPOSITO_INVALIDO = {
  ...CONFIG_VALIDA,
  latDeposito: NaN,
  lngDeposito: NaN,
}

const CONFIG_COORDENADAS_ZERO = {
  ...CONFIG_VALIDA,
  latDeposito: 0,
  lngDeposito: 0,
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function criarInput(
  dataISO: string,
  equipe: string,
  config = CONFIG_VALIDA
): ResolverOrigemOperacionalInput {
  return { dataISO, equipe, config }
}

// ─── Testes ──────────────────────────────────────────────────────────────────

describe('resolverOrigemOperacionalV2', () => {
  // ── Casos de sucesso ─────────────────────────────────────────────────────

  describe('dias úteis (segunda a sexta)', () => {
    it('deve retornar depósito para EQUIPE 1 em segunda-feira', () => {
      const input = criarInput('2026-06-15', 'EQUIPE 1') // seg
      const result = resolverOrigemOperacionalV2(input)

      expect(result.ok).toBe(true)
      expect(result.origem).toEqual({
        lat: CONFIG_VALIDA.latDeposito,
        lng: CONFIG_VALIDA.lngDeposito,
      })
      expect(result.tipo).toBe('deposito')
      expect(result.contexto.ehSabado).toBe(false)
    })

    it('deve retornar depósito para EQUIPE 2 em sexta-feira', () => {
      const input = criarInput('2026-06-19', 'EQUIPE 2') // sex
      const result = resolverOrigemOperacionalV2(input)

      expect(result.ok).toBe(true)
      expect(result.origem).toEqual({
        lat: CONFIG_VALIDA.latDeposito,
        lng: CONFIG_VALIDA.lngDeposito,
      })
      expect(result.tipo).toBe('deposito')
    })

    it('deve retornar depósito para variação "E1" em terça-feira', () => {
      const input = criarInput('2026-06-16', 'E1') // ter
      const result = resolverOrigemOperacionalV2(input)

      expect(result.ok).toBe(true)
      expect(result.tipo).toBe('deposito')
      expect(result.contexto.equipe).toBe('EQUIPE 1')
    })

    it('deve retornar depósito para variação "Equipe 2" (case insensitive)', () => {
      const input = criarInput('2026-06-17', 'equipe 2') // qua
      const result = resolverOrigemOperacionalV2(input)

      expect(result.ok).toBe(true)
      expect(result.tipo).toBe('deposito')
      expect(result.contexto.equipe).toBe('EQUIPE 2')
    })
  })

  describe('sábados', () => {
    it('deve retornar casa E1 para EQUIPE 1 no sábado', () => {
      const input = criarInput('2026-06-20', 'EQUIPE 1') // sáb
      const result = resolverOrigemOperacionalV2(input)

      expect(result.ok).toBe(true)
      expect(result.origem).toEqual({
        lat: CONFIG_VALIDA.latCasaE1,
        lng: CONFIG_VALIDA.lngCasaE1,
      })
      expect(result.tipo).toBe('casa-e1')
      expect(result.contexto.ehSabado).toBe(true)
    })

    it('deve retornar casa E2 para EQUIPE 2 no sábado', () => {
      const input = criarInput('2026-06-20', 'EQUIPE 2') // sáb
      const result = resolverOrigemOperacionalV2(input)

      expect(result.ok).toBe(true)
      expect(result.origem).toEqual({
        lat: CONFIG_VALIDA.latCasaE2,
        lng: CONFIG_VALIDA.lngCasaE2,
      })
      expect(result.tipo).toBe('casa-e2')
    })

    it('deve aceitar variação "E2" para casa da equipe 2 no sábado', () => {
      const input = criarInput('2026-06-20', 'E2')
      const result = resolverOrigemOperacionalV2(input)

      expect(result.ok).toBe(true)
      expect(result.tipo).toBe('casa-e2')
      expect(result.contexto.equipe).toBe('EQUIPE 2')
    })

    it('deve aceitar variação "EQP 1" para casa da equipe 1 no sábado', () => {
      const input = criarInput('2026-06-20', 'EQP 1')
      const result = resolverOrigemOperacionalV2(input)

      expect(result.ok).toBe(true)
      expect(result.tipo).toBe('casa-e1')
      expect(result.contexto.equipe).toBe('EQUIPE 1')
    })
  })

  // ── Erros: coordenadas ausentes/inválidas ─────────────────────────────────

  describe('erros quando coordenadas estão ausentes ou inválidas', () => {
    it('deve retornar erro quando depósito tem coordenadas NaN em dia útil', () => {
      const input = criarInput('2026-06-15', 'EQUIPE 1', CONFIG_DEPOSITO_INVALIDO)
      const result = resolverOrigemOperacionalV2(input)

      expect(result.ok).toBe(false)
      expect((result as { erro: string }).erro).toContain('Coordenadas do depósito ausentes ou inválidas')
      expect(result.origem).toBeNull()
    })

    it('deve retornar erro quando casa E1 tem coordenadas NaN no sábado', () => {
      const input = criarInput('2026-06-20', 'EQUIPE 1', CONFIG_CASA_E1_INVALIDA)
      const result = resolverOrigemOperacionalV2(input)

      expect(result.ok).toBe(false)
      expect((result as { erro: string }).erro).toContain('Coordenadas da casa da Equipe 1 ausentes ou inválidas')
      expect(result.origem).toBeNull()
    })

    it('deve retornar erro quando casa E2 tem coordenadas NaN no sábado', () => {
      const input = criarInput('2026-06-20', 'EQUIPE 2', CONFIG_CASA_E2_INVALIDA)
      const result = resolverOrigemOperacionalV2(input)

      expect(result.ok).toBe(false)
      expect((result as { erro: string }).erro).toContain('Coordenadas da casa da Equipe 2 ausentes ou inválidas')
      expect(result.origem).toBeNull()
    })

    it('deve aceitar coordenada 0,0 (zero) como válida se finita', () => {
      const input = criarInput('2026-06-15', 'EQUIPE 1', CONFIG_COORDENADAS_ZERO)
      const result = resolverOrigemOperacionalV2(input)

      // 0 é um número finito válido, embora geográficamente improvável
      expect(result.ok).toBe(true)
      expect(result.origem).toEqual({ lat: 0, lng: 0 })
    })

    it('deve retornar erro quando coordenadas são Infinity', () => {
      const config = {
        ...CONFIG_VALIDA,
        latDeposito: Infinity,
        lngDeposito: -49.2692262,
      }
      const input = criarInput('2026-06-15', 'EQUIPE 1', config)
      const result = resolverOrigemOperacionalV2(input)

      expect(result.ok).toBe(false)
      expect((result as { erro: string }).erro).toContain('Coordenadas do depósito ausentes ou inválidas')
    })
  })

  // ── Erros: equipe inválida ────────────────────────────────────────────────

  describe('erros quando equipe é inválida', () => {
    it('deve retornar erro para equipe "EQUIPE 3"', () => {
      const input = criarInput('2026-06-15', 'EQUIPE 3')
      const result = resolverOrigemOperacionalV2(input)

      expect(result.ok).toBe(false)
      expect((result as { erro: string }).erro).toContain('Equipe inválida')
      expect(result.contexto.equipe).toBe('EQUIPE 3')
    })

    it('deve retornar erro para equipe vazia', () => {
      const input = criarInput('2026-06-15', '')
      const result = resolverOrigemOperacionalV2(input)

      expect(result.ok).toBe(false)
      expect((result as { erro: string }).erro).toContain('Equipe inválida')
    })

    it('deve retornar erro para equipe com texto aleatório', () => {
      const input = criarInput('2026-06-15', 'FULANO DE TAL')
      const result = resolverOrigemOperacionalV2(input)

      expect(result.ok).toBe(false)
      expect((result as { erro: string }).erro).toContain('Equipe inválida')
    })
  })

  // ── Erros: data inválida ─────────────────────────────────────────────────

  describe('erros quando data é inválida', () => {
    it('deve retornar erro para formato DD/MM/YYYY (não suportado)', () => {
      const input = criarInput('20/06/2026', 'EQUIPE 1')
      const result = resolverOrigemOperacionalV2(input)

      expect(result.ok).toBe(false)
      expect((result as { erro: string }).erro).toContain('Data inválida')
    })

    it('deve retornar erro para data não existente (31/02)', () => {
      const input = criarInput('2026-02-31', 'EQUIPE 1')
      const result = resolverOrigemOperacionalV2(input)

      // 2026 não é bissexto, fevereiro tem 28 dias
      expect(result.ok).toBe(false)
      expect((result as { erro: string }).erro).toContain('Data inválida')
    })

    it('deve retornar erro para string vazia', () => {
      const input = criarInput('', 'EQUIPE 1')
      const result = resolverOrigemOperacionalV2(input)

      expect(result.ok).toBe(false)
      expect((result as { erro: string }).erro).toContain('Data inválida')
    })
  })

  // ── Conversão de strings do Supabase ─────────────────────────────────────

  describe('conversão de strings do Supabase para números', () => {
    it('deve aceitar strings numéricas no lugar de números (como vem do Supabase)', () => {
      // Simula o que acontece quando config-service normaliza valores string
      const configComoDoSupabase = {
        latDeposito: -25.4876648,
        lngDeposito: -49.2692262,
        latCasaE1: -25.494297,
        lngCasaE1: -49.277091,
        latCasaE2: -25.494297,
        lngCasaE2: -49.277091,
      }
      const input = criarInput('2026-06-15', 'EQUIPE 1', configComoDoSupabase as any)
      const result = resolverOrigemOperacionalV2(input)

      expect(result.ok).toBe(true)
      expect(result.origem?.lat).toBe(-25.4876648)
    })
  })

  // ── Edge cases ────────────────────────────────────────────────────────────

  describe('edge cases e comportamentos específicos', () => {
    it('deve retornar origem null quando ok é false', () => {
      const input = criarInput('2026-06-15', 'EQUIPE INVALIDA')
      const result = resolverOrigemOperacionalV2(input)

      expect(result.ok).toBe(false)
      expect(result.origem).toBeNull()
      expect(result.tipo).toBeNull()
    })

    it('deve preservar dataISO no contexto mesmo em erro', () => {
      const input = criarInput('2026-06-15', '')
      const result = resolverOrigemOperacionalV2(input)

      expect(result.contexto.dataISO).toBe('2026-06-15')
    })

    it('deve detectar domingo como dia útil (não sábado) usando depósito', () => {
      // Domingo 21/06/2026
      const input = criarInput('2026-06-21', 'EQUIPE 1')
      const result = resolverOrigemOperacionalV2(input)

      // Domingo é getDay() === 0, então ehSabado = false
      expect(result.ok).toBe(true)
      expect(result.contexto.ehSabado).toBe(false)
      expect(result.tipo).toBe('deposito')
    })

    it('deve aceitar "1" como EQUIPE 1', () => {
      const input = criarInput('2026-06-15', '1')
      const result = resolverOrigemOperacionalV2(input)

      expect(result.ok).toBe(true)
      expect(result.contexto.equipe).toBe('EQUIPE 1')
    })

    it('deve aceitar "2" como EQUIPE 2', () => {
      const input = criarInput('2026-06-15', '2')
      const result = resolverOrigemOperacionalV2(input)

      expect(result.ok).toBe(true)
      expect(result.contexto.equipe).toBe('EQUIPE 2')
    })
  })
})
