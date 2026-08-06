import { describe, it, expect } from 'vitest'
import {
  verificarToleranciaTempoNormal,
  TOLERANCIA_TEMPONORMAL_MAX_MIN,
  type VerificarToleranciaTempoNormalInput,
} from './tolerancia-tempo-normal'

// Helper para criar input base
function criarInput(
  props: Partial<VerificarToleranciaTempoNormalInput> = {}
): VerificarToleranciaTempoNormalInput {
  return {
    suficienteParaServico: false,
    disponivelMin: 100,
    tempoNecessarioMin: 120,
    diaSemana: 1, // segunda-feira
    tipoClassificacao: 'normal',
    ...props,
  }
}

describe('verificarToleranciaTempoNormal', () => {
  // 11.1 Dentro do limite em dia permitido
  it('11.1 aplica tolerância quando falta 15min em dia útil não-quarta (NORMAL)', () => {
    const result = verificarToleranciaTempoNormal(
      criarInput({ disponivelMin: 105, tempoNecessarioMin: 120, diaSemana: 1 })
    )
    expect(result.aplicaTolerancia).toBe(true)
    expect(result.diferencaMin).toBe(15)
    expect(result.motivo).toContain('Tolerância')
  })

  // 11.2 No limite exato (30 min)
  it('11.2 aplica tolerância quando falta exatamente 30min (limite inclusivo)', () => {
    const result = verificarToleranciaTempoNormal(
      criarInput({ disponivelMin: 90, tempoNecessarioMin: 120, diaSemana: 2 })
    )
    expect(result.aplicaTolerancia).toBe(true)
    expect(result.diferencaMin).toBe(30)
  })

  // 11.3 Acima do limite (31 min)
  it('11.3 rejeita tolerância quando falta 31min (acima do limite)', () => {
    const result = verificarToleranciaTempoNormal(
      criarInput({ disponivelMin: 89, tempoNecessarioMin: 120, diaSemana: 2 })
    )
    expect(result.aplicaTolerancia).toBe(false)
    expect(result.diferencaMin).toBe(31)
    expect(result.motivo).toContain('excede limite')
  })

  // 11.4 Tempo suficiente
  it('11.4 não aplica tolerância quando tempo é suficiente', () => {
    const result = verificarToleranciaTempoNormal(
      criarInput({ suficienteParaServico: true })
    )
    expect(result.aplicaTolerancia).toBe(false)
    expect(result.motivo).toContain('Tempo suficiente')
  })

  // 11.5 Quarta com falta pequena
  it('11.5 rejeita tolerância na quarta-feira mesmo com falta de 1min', () => {
    const result = verificarToleranciaTempoNormal(
      criarInput({ disponivelMin: 119, tempoNecessarioMin: 120, diaSemana: 3 })
    )
    expect(result.aplicaTolerancia).toBe(false)
    expect(result.diferencaMin).toBe(1)
    expect(result.motivo).toContain('Quarta-feira')
  })

  // 11.6 Quarta com tempo suficiente
  it('11.6 não aplica tolerância na quarta com tempo suficiente', () => {
    const result = verificarToleranciaTempoNormal(
      criarInput({ suficienteParaServico: true, diaSemana: 3 })
    )
    expect(result.aplicaTolerancia).toBe(false)
    expect(result.motivo).toContain('Tempo suficiente')
  })

  // 11.7 Especial
  it('11.7 rejeita tolerância para classificação ESPECIAL', () => {
    const result = verificarToleranciaTempoNormal(
      criarInput({ tipoClassificacao: 'especial', disponivelMin: 100, tempoNecessarioMin: 120 })
    )
    expect(result.aplicaTolerancia).toBe(false)
    expect(result.motivo).toContain('especial')
  })

  // 11.8 Premium
  it('11.8 rejeita tolerância para classificação PREMIUM', () => {
    const result = verificarToleranciaTempoNormal(
      criarInput({ tipoClassificacao: 'premium', disponivelMin: 100, tempoNecessarioMin: 120 })
    )
    expect(result.aplicaTolerancia).toBe(false)
    expect(result.motivo).toContain('premium')
  })

  // 11.9 Classificação indefinida (indisponivel)
  it('11.9 rejeita tolerância para classificação indisponivel', () => {
    const result = verificarToleranciaTempoNormal(
      criarInput({ tipoClassificacao: 'indisponivel', disponivelMin: 100, tempoNecessarioMin: 120 })
    )
    expect(result.aplicaTolerancia).toBe(false)
    expect(result.motivo).toContain('indisponivel')
  })

  // 11.10 Distância inválida (tipoClassificacao indisponivel por km null)
  it('11.10 rejeita tolerância quando classificação é indisponivel (km null)', () => {
    const result = verificarToleranciaTempoNormal(
      criarInput({ tipoClassificacao: 'indisponivel', disponivelMin: 100, tempoNecessarioMin: 120 })
    )
    expect(result.aplicaTolerancia).toBe(false)
  })

  // 11.11 Quarta confirmada (diaSemana=3)
  it('11.11 rejeita tolerância para diaSemana=3 (quarta confirmada)', () => {
    const result = verificarToleranciaTempoNormal(
      criarInput({ diaSemana: 3, disponivelMin: 100, tempoNecessarioMin: 120 })
    )
    expect(result.aplicaTolerancia).toBe(false)
    expect(result.motivo).toContain('Quarta-feira')
  })

  // 11.12 Sábado (diaSemana=6) — bloqueado por decisão aprovada
  it('11.12 rejeita tolerância no sábado (diaSemana=6)', () => {
    const result = verificarToleranciaTempoNormal(
      criarInput({ diaSemana: 6, disponivelMin: 100, tempoNecessarioMin: 120 })
    )
    expect(result.aplicaTolerancia).toBe(false)
    expect(result.diferencaMin).toBe(20)
    expect(result.motivo).toContain('Sábado')
  })

  // 11.13 Constante de limite
  it('11.13 constante de limite é 30 minutos', () => {
    expect(TOLERANCIA_TEMPONORMAL_MAX_MIN).toBe(30)
  })

  // 11.14 Múltiplas equipes — helper é por equipe, não agregado
  it('11.14 helper decide por equipe (não agrega equipes)', () => {
    // Cada chamada é independente — simula duas equipes com disponibilidade diferente
    const equipe1 = verificarToleranciaTempoNormal(
      criarInput({ disponivelMin: 115, tempoNecessarioMin: 120, diaSemana: 1 })
    )
    const equipe2 = verificarToleranciaTempoNormal(
      criarInput({ disponivelMin: 80, tempoNecessarioMin: 120, diaSemana: 1 })
    )
    expect(equipe1.aplicaTolerancia).toBe(true) // falta 5min
    expect(equipe2.aplicaTolerancia).toBe(false) // falta 40min
  })

  // 11.15 Tolerância não cumulativa — função decide uma vez
  it('11.15 tolerância é decidida uma única vez (não cumulativa)', () => {
    const result = verificarToleranciaTempoNormal(
      criarInput({ disponivelMin: 100, tempoNecessarioMin: 120, diaSemana: 1 })
    )
    // Resultado é determinístico — mesma entrada sempre mesma saída
    const result2 = verificarToleranciaTempoNormal(
      criarInput({ disponivelMin: 100, tempoNecessarioMin: 120, diaSemana: 1 })
    )
    expect(result).toEqual(result2)
    expect(result.aplicaTolerancia).toBe(true)
  })

  // Casos adicionais de robustez

  it('rejeita tolerância quando tempoNecessarioMin é null', () => {
    const result = verificarToleranciaTempoNormal(
      criarInput({ tempoNecessarioMin: null })
    )
    expect(result.aplicaTolerancia).toBe(false)
    expect(result.motivo).toContain('Tempo necessário ausente')
  })

  it('rejeita tolerância quando tempoNecessarioMin é NaN', () => {
    const result = verificarToleranciaTempoNormal(
      criarInput({ tempoNecessarioMin: NaN })
    )
    expect(result.aplicaTolerancia).toBe(false)
  })

  it('rejeita tolerância quando disponivelMin é NaN', () => {
    const result = verificarToleranciaTempoNormal(
      criarInput({ disponivelMin: NaN })
    )
    expect(result.aplicaTolerancia).toBe(false)
    expect(result.motivo).toContain('Tempo disponível ausente')
  })

  it('rejeita tolerância quando diferença é exatamente 0 (tempo suficiente)', () => {
    const result = verificarToleranciaTempoNormal(
      criarInput({ disponivelMin: 120, tempoNecessarioMin: 120, suficienteParaServico: false })
    )
    expect(result.aplicaTolerancia).toBe(false)
    expect(result.diferencaMin).toBe(0)
    expect(result.motivo).toContain('diferença <= 0')
  })

  it('aplica tolerância na sexta-feira (diaSemana=5)', () => {
    const result = verificarToleranciaTempoNormal(
      criarInput({ diaSemana: 5, disponivelMin: 100, tempoNecessarioMin: 120 })
    )
    expect(result.aplicaTolerancia).toBe(true)
  })

  it('aplica tolerância na terça-feira (diaSemana=2)', () => {
    const result = verificarToleranciaTempoNormal(
      criarInput({ diaSemana: 2, disponivelMin: 110, tempoNecessarioMin: 120 })
    )
    expect(result.aplicaTolerancia).toBe(true)
    expect(result.diferencaMin).toBe(10)
  })

  it('rejeita tolerância no domingo (diaSemana=0) — classificação indisponivel', () => {
    // Domingo bloqueia antes da classificação, então tipoClassificacao seria indisponivel
    const result = verificarToleranciaTempoNormal(
      criarInput({ diaSemana: 0, tipoClassificacao: 'indisponivel', disponivelMin: 100, tempoNecessarioMin: 120 })
    )
    expect(result.aplicaTolerancia).toBe(false)
    expect(result.motivo).toContain('indisponivel')
  })

  it('rejeita tolerância para hora-marcada', () => {
    const result = verificarToleranciaTempoNormal(
      criarInput({ tipoClassificacao: 'hora-marcada', disponivelMin: 100, tempoNecessarioMin: 120 })
    )
    expect(result.aplicaTolerancia).toBe(false)
    expect(result.motivo).toContain('hora-marcada')
  })
})
