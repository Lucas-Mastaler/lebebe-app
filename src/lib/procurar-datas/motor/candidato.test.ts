import { describe, it, expect } from 'vitest'
import {
  montarCandidatoPreliminarV2,
  type MontarCandidatoPreliminarV2Input,
} from './candidato'
import type { ClassificacaoCandidatoOperacionalV2 } from './classificacao-candidato'

// ─── Fixtures ────────────────────────────────────────────────────────────────

function criarClassificacao(
  tipo: ClassificacaoCandidatoOperacionalV2['tipo'],
  elegivel: boolean,
  overrides?: Partial<ClassificacaoCandidatoOperacionalV2>
): ClassificacaoCandidatoOperacionalV2 {
  return {
    tipo,
    elegivel,
    motivos: elegivel ? [] : ['Motivo de teste.'],
    avisos: [],
    detalhes: {
      equipe: 'EQUIPE 1',
      dataISO: '2026-06-13',
      diaSemana: 6,
      ehSabado: true,
      ehDomingo: false,
      ativa: true,
      disponivelMin: 240,
      suficienteParaServico: true,
      tempoNecessarioMin: 60,
      distanciaKm: 8,
      kmAdicionalNaRotaM: 3000,
    },
    ...overrides,
  }
}

function criarInput(
  overrides?: Partial<MontarCandidatoPreliminarV2Input>
): MontarCandidatoPreliminarV2Input {
  return {
    dataISO: '2026-06-13',
    indice: 0,
    diaSemana: 6,
    ehSabado: true,
    ehDomingo: false,
    equipe: 'EQUIPE 1',
    disponivelMin: 240,
    ativa: true,
    suficienteParaServico: true,
    tempoNecessarioMin: 60,
    distanciaKm: 8,
    kmAdicionalNaRotaM: 3000,
    valorFrete: 150,
    tipoFrete: 'fixo',
    classificacao: criarClassificacao('normal', true),
    ...overrides,
  }
}

// ─── Suite ───────────────────────────────────────────────────────────────────

describe('montarCandidatoPreliminarV2', () => {
  // 1. monta candidato elegível normal
  it('monta candidato elegível do tipo normal', () => {
    const input = criarInput({
      classificacao: criarClassificacao('normal', true),
    })
    const candidato = montarCandidatoPreliminarV2(input)

    expect(candidato.elegivel).toBe(true)
    expect(candidato.tipo).toBe('normal')
    expect(candidato.equipe).toBe('EQUIPE 1')
    expect(candidato.dataISO).toBe('2026-06-13')
  })

  // 2. monta candidato premium
  it('monta candidato do tipo premium', () => {
    const input = criarInput({
      classificacao: criarClassificacao('premium', true),
    })
    const candidato = montarCandidatoPreliminarV2(input)

    expect(candidato.tipo).toBe('premium')
    expect(candidato.elegivel).toBe(true)
  })

  // 3. monta candidato hora-marcada
  it('monta candidato do tipo hora-marcada', () => {
    const input = criarInput({
      classificacao: criarClassificacao('hora-marcada', true, {
        motivos: ['Atendimento classificado como hora marcada.'],
      }),
    })
    const candidato = montarCandidatoPreliminarV2(input)

    expect(candidato.tipo).toBe('hora-marcada')
    expect(candidato.elegivel).toBe(true)
    expect(candidato.motivos).toContain(
      'Atendimento classificado como hora marcada.'
    )
  })

  // 4. monta candidato indisponível preservando motivos
  it('monta candidato indisponível preservando motivos da classificação', () => {
    const input = criarInput({
      classificacao: criarClassificacao('indisponivel', false, {
        motivos: ['Equipe inativa.', 'Tempo insuficiente.'],
      }),
    })
    const candidato = montarCandidatoPreliminarV2(input)

    expect(candidato.tipo).toBe('indisponivel')
    expect(candidato.elegivel).toBe(false)
    expect(candidato.motivos).toContain('Equipe inativa.')
    expect(candidato.motivos).toContain('Tempo insuficiente.')
  })

  // 5. copia elegivel e tipo da classificação
  it('copia elegivel e tipo diretamente da classificação', () => {
    const input = criarInput({
      classificacao: criarClassificacao('especial', true),
    })
    const candidato = montarCandidatoPreliminarV2(input)

    expect(candidato.elegivel).toBe(input.classificacao.elegivel)
    expect(candidato.tipo).toBe(input.classificacao.tipo)
  })

  // 6. cria ID determinístico
  it('cria ID determinístico com base em data, equipe, tipo e índice', () => {
    const input = criarInput({
      dataISO: '2026-06-13',
      equipe: 'EQUIPE 1',
      indice: 3,
      classificacao: criarClassificacao('normal', true),
    })
    const candidato = montarCandidatoPreliminarV2(input)

    expect(candidato.id).toBe('v2-2026-06-13-equipe-1-normal-3')
  })

  // 7. ID normaliza equipe com espaço/acentuação/caracteres estranhos
  it('normaliza equipe com espaço, acento e caractere estranho no ID', () => {
    const input = criarInput({
      dataISO: '2026-06-14',
      equipe: 'Eqüipe Áéì!@# 2',
      indice: 7,
      classificacao: criarClassificacao('premium', true),
    })
    const candidato = montarCandidatoPreliminarV2(input)

    expect(candidato.id).toBe('v2-2026-06-14-equipe-aei-2-premium-7')
  })

  // 8. preserva dados de data
  it('preserva dados de data (dataISO, indice, diaSemana, ehSabado, ehDomingo)', () => {
    const input = criarInput({
      dataISO: '2026-06-15',
      indice: 2,
      diaSemana: 1,
      ehSabado: false,
      ehDomingo: false,
    })
    const candidato = montarCandidatoPreliminarV2(input)

    expect(candidato.dataISO).toBe('2026-06-15')
    expect(candidato.indice).toBe(2)
    expect(candidato.diaSemana).toBe(1)
    expect(candidato.ehSabado).toBe(false)
    expect(candidato.ehDomingo).toBe(false)
  })

  // 9. preserva dados de equipe
  it('preserva nome da equipe', () => {
    const input = criarInput({ equipe: 'EQUIPE BETA' })
    const candidato = montarCandidatoPreliminarV2(input)

    expect(candidato.equipe).toBe('EQUIPE BETA')
  })

  // 10. preserva dados operacionais
  it('preserva dados operacionais (ativa, disponivelMin, suficienteParaServico, tempoNecessarioMin)', () => {
    const input = criarInput({
      ativa: false,
      disponivelMin: 30,
      suficienteParaServico: false,
      tempoNecessarioMin: 120,
    })
    const candidato = montarCandidatoPreliminarV2(input)

    expect(candidato.operacional.ativa).toBe(false)
    expect(candidato.operacional.disponivelMin).toBe(30)
    expect(candidato.operacional.suficienteParaServico).toBe(false)
    expect(candidato.operacional.tempoNecessarioMin).toBe(120)
  })

  // 11. preserva dados de distância
  it('preserva dados de distância (distanciaKm, kmAdicionalNaRotaM)', () => {
    const input = criarInput({
      distanciaKm: 12.5,
      kmAdicionalNaRotaM: 5000,
    })
    const candidato = montarCandidatoPreliminarV2(input)

    expect(candidato.distancia.distanciaKm).toBe(12.5)
    expect(candidato.distancia.kmAdicionalNaRotaM).toBe(5000)
  })

  // 12. preserva dados de frete
  it('preserva dados de frete (valorFrete, tipoFrete)', () => {
    const input = criarInput({
      valorFrete: 220,
      tipoFrete: 'viagem',
    })
    const candidato = montarCandidatoPreliminarV2(input)

    expect(candidato.frete.valorFrete).toBe(220)
    expect(candidato.frete.tipoFrete).toBe('viagem')
  })

  // 13. preserva avisos da classificação
  it('preserva avisos da classificação', () => {
    const input = criarInput({
      classificacao: criarClassificacao('normal', true, {
        avisos: ['Atendimento rural informado.'],
      }),
    })
    const candidato = montarCandidatoPreliminarV2(input)

    expect(candidato.avisos).toContain('Atendimento rural informado.')
  })

  // 14. preserva motivos da classificação
  it('preserva motivos da classificação', () => {
    const input = criarInput({
      classificacao: criarClassificacao('indisponivel', false, {
        motivos: ['Distância fora do limite.'],
      }),
    })
    const candidato = montarCandidatoPreliminarV2(input)

    expect(candidato.motivos).toContain('Distância fora do limite.')
  })

  // 15. não duplica motivos/avisos
  it('não duplica motivos ou avisos quando há sobreposição', () => {
    const input = criarInput({
      classificacao: criarClassificacao('normal', true, {
        motivos: ['Motivo comum.', 'Motivo comum.'],
        avisos: ['Aviso único.', 'Aviso único.'],
      }),
    })
    const candidato = montarCandidatoPreliminarV2(input)

    expect(candidato.motivos.filter((m) => m === 'Motivo comum.').length).toBe(1)
    expect(candidato.avisos.filter((a) => a === 'Aviso único.').length).toBe(1)
  })

  // 16. valorFrete ausente vira null
  it('converte valorFrete ausente para null', () => {
    const input = criarInput()
    delete (input as unknown as Record<string, unknown>).valorFrete
    const candidato = montarCandidatoPreliminarV2(input)

    expect(candidato.frete.valorFrete).toBeNull()
  })

  // 17. tipoFrete ausente vira null
  it('converte tipoFrete ausente para null', () => {
    const input = criarInput()
    delete (input as unknown as Record<string, unknown>).tipoFrete
    const candidato = montarCandidatoPreliminarV2(input)

    expect(candidato.frete.tipoFrete).toBeNull()
  })

  // 18. dados essenciais ausentes retornam indisponivel
  it('retorna indisponivel quando dataISO está ausente', () => {
    const input = criarInput({ dataISO: '' })
    const candidato = montarCandidatoPreliminarV2(input)

    expect(candidato.tipo).toBe('indisponivel')
    expect(candidato.elegivel).toBe(false)
    expect(candidato.motivos).toContain('Data ISO ausente ou inválida.')
  })

  it('retorna indisponivel quando equipe está ausente', () => {
    const input = criarInput({ equipe: '' })
    const candidato = montarCandidatoPreliminarV2(input)

    expect(candidato.tipo).toBe('indisponivel')
    expect(candidato.elegivel).toBe(false)
    expect(candidato.motivos).toContain('Equipe ausente ou inválida.')
  })

  it('retorna indisponivel quando classificação está ausente', () => {
    const input = criarInput()
    ;(input as unknown as Record<string, unknown>).classificacao = undefined
    const candidato = montarCandidatoPreliminarV2(input)

    expect(candidato.tipo).toBe('indisponivel')
    expect(candidato.elegivel).toBe(false)
    expect(candidato.motivos).toContain('Classificação ausente ou inválida.')
  })

  // 19. não muta input
  it('não muta o objeto de entrada', () => {
    const input = criarInput()
    const original = JSON.stringify(input)
    montarCandidatoPreliminarV2(input)

    expect(JSON.stringify(input)).toBe(original)
  })

  // 20. não cria ranking/score/campo de prioridade
  it('não cria campos de ranking, score ou prioridade', () => {
    const input = criarInput()
    const candidato = montarCandidatoPreliminarV2(input)

    expect(candidato).not.toHaveProperty('rank')
    expect(candidato).not.toHaveProperty('score')
    expect(candidato).not.toHaveProperty('prioridade')
  })
})
