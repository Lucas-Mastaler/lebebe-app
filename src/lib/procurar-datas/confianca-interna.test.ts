import { describe, expect, it, vi } from 'vitest'
import { calcularConfiancaInternaEndereco } from './confianca-interna'

describe('calcularConfiancaInternaEndereco', () => {
  it('retorna 0.95 para exato com numero confirmado e todos os campos ok', () => {
    const result = calcularConfiancaInternaEndereco({
      match: 'exato',
      numeroOk: true,
      logradouroOk: true,
      cidadeOk: true,
      ufOk: true,
      cepOk: true,
      bairroOk: true,
      provider: 'locationiq',
      providerImportance: 0.0001,
    })

    expect(result.confidence).toBe(0.95)
    expect(result.classificacao).toBe('exato')
    expect(result.motivo).toBe('exato_numero_confirmado')
  })

  it('retorna 0.95 mesmo quando importance do provider e baixa (0.0001)', () => {
    const result = calcularConfiancaInternaEndereco({
      match: 'exato',
      numeroOk: true,
      logradouroOk: true,
      cidadeOk: true,
      ufOk: true,
      cepOk: true,
      bairroOk: true,
      provider: 'locationiq',
      providerImportance: 0.0001,
    })

    expect(result.confidence).toBeGreaterThanOrEqual(0.95)
    expect(result.confidence).toBeLessThanOrEqual(1)
  })

  it('retorna 0.97 para Google ROOFTOP sem partial_match', () => {
    const result = calcularConfiancaInternaEndereco({
      match: 'exato',
      numeroOk: true,
      logradouroOk: true,
      cidadeOk: true,
      ufOk: true,
      cepOk: true,
      bairroOk: true,
      partialMatch: false,
      locationType: 'ROOFTOP',
      provider: 'google_geocoding',
      providerImportance: null,
    })

    expect(result.confidence).toBe(0.97)
    expect(result.motivo).toBe('exato_rooftop')
  })

  it('reduz confianca quando bairro divergente', () => {
    const result = calcularConfiancaInternaEndereco({
      match: 'exato',
      numeroOk: true,
      logradouroOk: true,
      cidadeOk: true,
      ufOk: true,
      cepOk: true,
      bairroOk: false,
      provider: 'locationiq',
      providerImportance: 0.5,
    })

    expect(result.confidence).toBeCloseTo(0.90, 10)
    expect(result.motivo).toBe('exato_bairro_divergente')
  })

  it('reduz confianca quando Google partial_match', () => {
    const result = calcularConfiancaInternaEndereco({
      match: 'exato',
      numeroOk: true,
      logradouroOk: true,
      cidadeOk: true,
      ufOk: true,
      cepOk: true,
      bairroOk: true,
      partialMatch: true,
      locationType: 'ROOFTOP',
      provider: 'google_geocoding',
      providerImportance: null,
    })

    expect(result.confidence).toBeCloseTo(0.85, 10)
    expect(result.motivo).toBe('exato_partial_match')
  })

  it('retorna 0.80 para aproximado confiavel sem numero', () => {
    const result = calcularConfiancaInternaEndereco({
      match: 'aproximado_confiavel',
      numeroOk: false,
      logradouroOk: true,
      cidadeOk: true,
      ufOk: true,
      cepOk: 'na',
      bairroOk: 'na',
      provider: 'locationiq',
      providerImportance: 0.0001,
    })

    expect(result.confidence).toBe(0.80)
    expect(result.classificacao).toBe('aproximado_confiavel')
  })

  it('aumenta confianca para aproximado confiavel com CEP ok', () => {
    const result = calcularConfiancaInternaEndereco({
      match: 'aproximado_confiavel',
      numeroOk: false,
      logradouroOk: true,
      cidadeOk: true,
      ufOk: true,
      cepOk: true,
      bairroOk: true,
      provider: 'locationiq',
      providerImportance: 0.0001,
    })

    expect(result.confidence).toBeCloseTo(0.85, 10)
    expect(result.motivo).toBe('aproximado_confiavel_cep_ok')
  })

  it('reduz confianca para aproximado com partial_match', () => {
    const result = calcularConfiancaInternaEndereco({
      match: 'aproximado_confiavel',
      numeroOk: false,
      logradouroOk: true,
      cidadeOk: true,
      ufOk: true,
      cepOk: true,
      bairroOk: true,
      partialMatch: true,
      provider: 'google_geocoding',
      providerImportance: null,
    })

    expect(result.confidence).toBe(0.80)
    expect(result.motivo).toBe('aproximado_partial_match')
  })

  it('retorna 0.80 para Apps Script sem validacao estrutural completa', () => {
    const result = calcularConfiancaInternaEndereco({
      provider: 'appsscript',
      providerImportance: null,
    })

    expect(result.confidence).toBe(0.80)
    expect(result.classificacao).toBe('sem_validacao_estrutural')
    expect(result.motivo).toBe('sem_validacao_estrutural_completa')
  })

  it('confidence sempre entre 0 e 1', () => {
    const cases = [
      { match: 'exato', numeroOk: true, logradouroOk: true, cidadeOk: true, ufOk: true, cepOk: true, bairroOk: true, partialMatch: true, locationType: 'APPROXIMATE' },
      { match: 'aproximado_confiavel', numeroOk: false, logradouroOk: true, cidadeOk: true, ufOk: true, cepOk: false, bairroOk: false, partialMatch: true },
      { match: 'exato', numeroOk: true, logradouroOk: true, cidadeOk: true, ufOk: true, cepOk: true, bairroOk: false, partialMatch: true, locationType: 'ROOFTOP' },
    ]

    for (const params of cases) {
      const result = calcularConfiancaInternaEndereco({ ...params, provider: 'test' })
      expect(result.confidence).toBeGreaterThanOrEqual(0)
      expect(result.confidence).toBeLessThanOrEqual(1)
    }
  })

  it('importance baixa nao invalida resultado exato', () => {
    const result = calcularConfiancaInternaEndereco({
      match: 'exato',
      numeroOk: true,
      logradouroOk: true,
      cidadeOk: true,
      ufOk: true,
      cepOk: true,
      bairroOk: true,
      provider: 'locationiq',
      providerImportance: 0.0001,
    })

    expect(result.confidence).toBeGreaterThanOrEqual(0.70)
    expect(result.classificacao).toBe('exato')
  })

  it('importance alta nao aumenta confianca alem do limite', () => {
    const result = calcularConfiancaInternaEndereco({
      match: 'exato',
      numeroOk: true,
      logradouroOk: true,
      cidadeOk: true,
      ufOk: true,
      cepOk: true,
      bairroOk: true,
      provider: 'locationiq',
      providerImportance: 1.0,
    })

    expect(result.confidence).toBe(0.95)
  })
})
