// ─────────────────────────────────────────────────────────────────────────────
// motor/entrada.test.ts  —  Testes do normalizador de entrada v2
//
// Cenários cobertos:
//   1. Entrada completa válida
//   2. Entrada sem CEP
//   3. Entrada sem endereço completo
//   4. Entrada com destLat/destLng válidos
//   5. Entrada usando fallback lat/lng se destLat/destLng ausentes
//   6. Entrada com coordenadas inválidas (NaN, null, string vazia)
//   7. Latitude fora do intervalo [-90, 90]
//   8. Longitude fora do intervalo [-180, 180]
//   9. Tempo "00:40" → 40 minutos
//  10. Tempo vazio ou inválido → null com aviso
//  11. Data YYYY-MM-DD válida
//  12. Data inválida → null com aviso
//  13. isRural e isCondominio ausentes → false
//  14. Não muta o objeto original
//  15. Campos extras no payload não quebram
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest'
import { normalizarEntradaPesquisaV2, type EntradaPesquisaV2 } from './entrada'
import type { PesquisarDatasRequest } from '../contratos'

describe('normalizarEntradaPesquisaV2', () => {
  // 1. Entrada completa válida
  it('normaliza entrada completa válida', () => {
    const input: PesquisarDatasRequest = {
      cep: '80000-000',
      enderecoCompleto: 'Rua Exemplo, 123, Curitiba - PR',
      lat: -25.42,
      lng: -49.27,
      destLat: -25.43,
      destLng: -49.28,
      tempoNecessario: '00:40',
      dataInicial: '2026-06-13',
      isRural: false,
      isCondominio: false,
    }

    const result = normalizarEntradaPesquisaV2(input)

    expect(result.cep).toBe('80000-000')
    expect(result.enderecoCompleto).toBe('Rua Exemplo, 123, Curitiba - PR')
    expect(result.dataInicialISO).toBe('2026-06-13')
    expect(result.tempoNecessarioTexto).toBe('00:40')
    expect(result.tempoNecessarioMin).toBe(40)
    expect(result.coordenadasDestino).toEqual({ lat: -25.43, lng: -49.28 })
    expect(result.coordenadasOrigemInformada).toEqual({ lat: -25.42, lng: -49.27 })
    expect(result.isRural).toBe(false)
    expect(result.isCondominio).toBe(false)
    expect(result.temEnderecoMinimo).toBe(true)
    expect(result.temCoordenadasDestino).toBe(true)
    expect(result.avisos).toHaveLength(0)
  })

  // 2. Entrada sem CEP
  it('retorna null para CEP e gera aviso quando CEP está ausente', () => {
    const input: PesquisarDatasRequest = {
      enderecoCompleto: 'Rua Exemplo, 123',
      lat: -25.42,
      lng: -49.27,
      destLat: -25.43,
      destLng: -49.28,
      tempoNecessario: '00:40',
      dataInicial: '2026-06-13',
    }

    const result = normalizarEntradaPesquisaV2(input)

    expect(result.cep).toBeNull()
    expect(result.avisos).toContain('CEP ausente.')
    expect(result.temEnderecoMinimo).toBe(true) // endereço completo existe
  })

  // 3. Entrada sem endereço completo
  it('retorna null para enderecoCompleto e gera aviso quando ausente', () => {
    const input: PesquisarDatasRequest = {
      cep: '80000-000',
      lat: -25.42,
      lng: -49.27,
      destLat: -25.43,
      destLng: -49.28,
      tempoNecessario: '00:40',
      dataInicial: '2026-06-13',
    }

    const result = normalizarEntradaPesquisaV2(input)

    expect(result.enderecoCompleto).toBeNull()
    expect(result.avisos).toContain('Endereço completo ausente.')
    expect(result.temEnderecoMinimo).toBe(true) // CEP existe
  })

  // 4. Entrada com destLat/destLng válidos
  it('usa destLat/destLng como coordenadas de destino preferencialmente', () => {
    const input: PesquisarDatasRequest = {
      lat: -25.0,
      lng: -49.0,
      destLat: -25.5,
      destLng: -49.5,
      tempoNecessario: '01:00',
      dataInicial: '2026-07-01',
    }

    const result = normalizarEntradaPesquisaV2(input)

    expect(result.coordenadasDestino).toEqual({ lat: -25.5, lng: -49.5 })
    expect(result.coordenadasOrigemInformada).toEqual({ lat: -25.0, lng: -49.0 })
  })

  // 5. Entrada usando fallback lat/lng se destLat/destLng ausentes
  it('usa lat/lng como fallback quando destLat/destLng não existem', () => {
    const input: PesquisarDatasRequest = {
      cep: '80000-000',
      enderecoCompleto: 'Rua Exemplo, 123',
      lat: -25.1,
      lng: -49.1,
      tempoNecessario: '01:00',
      dataInicial: '2026-07-01',
    }

    const result = normalizarEntradaPesquisaV2(input)

    expect(result.coordenadasDestino).toEqual({ lat: -25.1, lng: -49.1 })
    expect(result.coordenadasOrigemInformada).toEqual({ lat: -25.1, lng: -49.1 })
    expect(result.avisos).toHaveLength(0)
  })

  // 6. Entrada com coordenadas inválidas (NaN, null, undefined)
  it('retorna null para coordenadas quando valores são inválidos', () => {
    const input: PesquisarDatasRequest = {
      lat: null,
      lng: undefined,
      destLat: NaN,
      destLng: null,
      tempoNecessario: '01:00',
      dataInicial: '2026-07-01',
    }

    const result = normalizarEntradaPesquisaV2(input)

    expect(result.coordenadasDestino).toBeNull()
    expect(result.coordenadasOrigemInformada).toBeNull()
    expect(result.avisos).toContain('Coordenadas de destino ausentes ou inválidas.')
    expect(result.temCoordenadasDestino).toBe(false)
  })

  // 7. Latitude fora do intervalo
  it('rejeita latitude fora do intervalo [-90, 90]', () => {
    const input: PesquisarDatasRequest = {
      destLat: 91,
      destLng: -49.0,
      tempoNecessario: '01:00',
      dataInicial: '2026-07-01',
    }

    const result = normalizarEntradaPesquisaV2(input)

    expect(result.coordenadasDestino).toBeNull()
    expect(result.avisos).toContain('Coordenadas de destino ausentes ou inválidas.')
  })

  // 8. Longitude fora do intervalo
  it('rejeita longitude fora do intervalo [-180, 180]', () => {
    const input: PesquisarDatasRequest = {
      destLat: -25.0,
      destLng: 181,
      tempoNecessario: '01:00',
      dataInicial: '2026-07-01',
    }

    const result = normalizarEntradaPesquisaV2(input)

    expect(result.coordenadasDestino).toBeNull()
    expect(result.avisos).toContain('Coordenadas de destino ausentes ou inválidas.')
  })

  // 9. Tempo "00:40" → 40
  it('converte tempo "00:40" para 40 minutos', () => {
    const input: PesquisarDatasRequest = {
      tempoNecessario: '00:40',
      dataInicial: '2026-07-01',
      destLat: -25.0,
      destLng: -49.0,
    }

    const result = normalizarEntradaPesquisaV2(input)

    expect(result.tempoNecessarioTexto).toBe('00:40')
    expect(result.tempoNecessarioMin).toBe(40)
    expect(result.avisos).not.toContain('Tempo necessário ausente ou inválido.')
  })

  // 10. Tempo vazio ou inválido → null com aviso
  it('retorna null para tempo inválido e gera aviso', () => {
    const input: PesquisarDatasRequest = {
      tempoNecessario: 'abc',
      dataInicial: '2026-07-01',
      destLat: -25.0,
      destLng: -49.0,
    }

    const result = normalizarEntradaPesquisaV2(input)

    expect(result.tempoNecessarioMin).toBeNull()
    expect(result.avisos).toContain('Tempo necessário ausente ou inválido.')
  })

  it('retorna null para tempo vazio e gera aviso', () => {
    const input: PesquisarDatasRequest = {
      tempoNecessario: '',
      dataInicial: '2026-07-01',
      destLat: -25.0,
      destLng: -49.0,
    }

    const result = normalizarEntradaPesquisaV2(input)

    expect(result.tempoNecessarioTexto).toBeNull()
    expect(result.tempoNecessarioMin).toBeNull()
    expect(result.avisos).toContain('Tempo necessário ausente ou inválido.')
  })

  // 11. Data YYYY-MM-DD válida
  it('aceita data no formato YYYY-MM-DD', () => {
    const input: PesquisarDatasRequest = {
      dataInicial: '2026-12-31',
      destLat: -25.0,
      destLng: -49.0,
    }

    const result = normalizarEntradaPesquisaV2(input)

    expect(result.dataInicialISO).toBe('2026-12-31')
    expect(result.avisos).not.toContain('Data inicial ausente ou inválida.')
  })

  // 12. Data inválida → null com aviso
  it('retorna null para data inválida e gera aviso', () => {
    const input: PesquisarDatasRequest = {
      dataInicial: '13/06/2026',
      destLat: -25.0,
      destLng: -49.0,
    }

    const result = normalizarEntradaPesquisaV2(input)

    expect(result.dataInicialISO).toBeNull()
    expect(result.avisos).toContain('Data inicial ausente ou inválida.')
  })

  it('retorna null para data vazia e gera aviso', () => {
    const input: PesquisarDatasRequest = {
      dataInicial: '',
      destLat: -25.0,
      destLng: -49.0,
    }

    const result = normalizarEntradaPesquisaV2(input)

    expect(result.dataInicialISO).toBeNull()
    expect(result.avisos).toContain('Data inicial ausente ou inválida.')
  })

  // 13. isRural e isCondominio ausentes → false
  it('retorna false para isRural e isCondominio quando ausentes', () => {
    const input: PesquisarDatasRequest = {
      destLat: -25.0,
      destLng: -49.0,
      tempoNecessario: '01:00',
      dataInicial: '2026-07-01',
    }

    const result = normalizarEntradaPesquisaV2(input)

    expect(result.isRural).toBe(false)
    expect(result.isCondominio).toBe(false)
  })

  it('retorna true para isRural e isCondominio quando explicitamente true', () => {
    const input: PesquisarDatasRequest = {
      destLat: -25.0,
      destLng: -49.0,
      tempoNecessario: '01:00',
      dataInicial: '2026-07-01',
      isRural: true,
      isCondominio: true,
    }

    const result = normalizarEntradaPesquisaV2(input)

    expect(result.isRural).toBe(true)
    expect(result.isCondominio).toBe(true)
  })

  // 14. Não muta o objeto original
  it('não muta o objeto de entrada', () => {
    const input: PesquisarDatasRequest = {
      cep: '80000-000',
      enderecoCompleto: 'Rua Exemplo',
      lat: -25.0,
      lng: -49.0,
      destLat: -25.1,
      destLng: -49.1,
      tempoNecessario: '02:30',
      dataInicial: '2026-06-13',
      isRural: false,
      isCondominio: false,
    }

    const clone = { ...input }
    normalizarEntradaPesquisaV2(input)

    expect(input).toEqual(clone)
  })

  // 15. Campos extras no payload não devem quebrar
  it('ignora campos extras no payload sem erro', () => {
    const input = {
      cep: '80000-000',
      enderecoCompleto: 'Rua Exemplo',
      lat: -25.0,
      lng: -49.0,
      destLat: -25.1,
      destLng: -49.1,
      tempoNecessario: '01:00',
      dataInicial: '2026-07-01',
      isRural: false,
      isCondominio: false,
      campoExtra: 'valor qualquer',
      outroExtra: 123,
    } as PesquisarDatasRequest

    const result = normalizarEntradaPesquisaV2(input)

    expect(result.cep).toBe('80000-000')
    expect(result.tempoNecessarioMin).toBe(60)
    expect(result.avisos).toHaveLength(0)
  })

  // Bônus: trim em CEP e endereço
  it('faz trim em CEP e endereço completo', () => {
    const input: PesquisarDatasRequest = {
      cep: '  80000-000  ',
      enderecoCompleto: '  Rua Exemplo, 123  ',
      destLat: -25.0,
      destLng: -49.0,
      tempoNecessario: '01:00',
      dataInicial: '2026-07-01',
    }

    const result = normalizarEntradaPesquisaV2(input)

    expect(result.cep).toBe('80000-000')
    expect(result.enderecoCompleto).toBe('Rua Exemplo, 123')
    expect(result.avisos).toHaveLength(0)
  })
})
