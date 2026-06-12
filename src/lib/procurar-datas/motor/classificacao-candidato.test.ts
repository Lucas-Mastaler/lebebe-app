import { describe, it, expect } from 'vitest'
import {
  classificarCandidatoOperacionalV2,
  type ClassificarCandidatoOperacionalV2Input,
  type ConfigClassificacaoV2,
  type TipoClassificacaoCandidatoV2,
} from './classificacao-candidato'

// Config padrão para testes (valores em METROS, conforme config-service)
const configBase: ConfigClassificacaoV2 = {
  kmAdicionalMaxNaRotaM: 5000,       // 5 km
  kmAdicionalMaxNaRotaEspecialM: 10000, // 10 km
  kmAdicionalMaxNaRotaPremiumM: 15000, // 15 km
  kmMaximoNaSemanaM: 16000,          // 16 km
  kmMaximoNoSabadoM: 20000,          // 20 km
}

describe('classificarCandidatoOperacionalV2', () => {
  // Helper para criar input válido
  function criarInput(props: Partial<ClassificarCandidatoOperacionalV2Input> = {}): ClassificarCandidatoOperacionalV2Input {
    return {
      dataISO: '2026-06-15',
      diaSemana: 1,
      ehSabado: false,
      ehDomingo: false,
      equipe: 'EQUIPE 1',
      ativa: true,
      disponivelMin: 240,
      suficienteParaServico: true,
      tempoNecessarioMin: 40,
      distanciaKm: 5,
      kmAdicionalNaRotaM: 3000,
      config: { ...configBase },
      ...props,
    }
  }

  // 1. Equipe inativa → indisponivel
  it('classifica como indisponível quando equipe inativa', () => {
    const input = criarInput({ ativa: false, motivoIndisponibilidade: 'Férias' })
    const result = classificarCandidatoOperacionalV2(input)

    expect(result.tipo).toBe('indisponivel')
    expect(result.elegivel).toBe(false)
    expect(result.motivos).toContain('Equipe inativa.')
    expect(result.motivos).toContain('Motivo: Férias.')
  })

  // 2. Tempo insuficiente → indisponivel
  it('classifica como indisponível quando tempo insuficiente', () => {
    const input = criarInput({ suficienteParaServico: false })
    const result = classificarCandidatoOperacionalV2(input)

    expect(result.tipo).toBe('indisponivel')
    expect(result.elegivel).toBe(false)
    expect(result.motivos).toContain('Tempo disponível insuficiente para o serviço.')
  })

  // 3. tempoNecessarioMin null → indisponivel
  it('classifica como indisponível quando tempoNecessarioMin é null', () => {
    const input = criarInput({ tempoNecessarioMin: null })
    const result = classificarCandidatoOperacionalV2(input)

    expect(result.tipo).toBe('indisponivel')
    expect(result.elegivel).toBe(false)
    expect(result.motivos).toContain('Tempo necessário ausente ou inválido.')
  })

  // 4. distanciaKm null → indisponivel
  it('classifica como indisponível quando distanciaKm é null', () => {
    const input = criarInput({ distanciaKm: null })
    const result = classificarCandidatoOperacionalV2(input)

    expect(result.tipo).toBe('indisponivel')
    expect(result.elegivel).toBe(false)
    expect(result.motivos).toContain('Distância ausente ou inválida.')
  })

  // 5. Domingo → indisponivel
  it('classifica como indisponível quando é domingo', () => {
    const input = criarInput({ ehDomingo: true, ehSabado: false, diaSemana: 0 })
    const result = classificarCandidatoOperacionalV2(input)

    expect(result.tipo).toBe('indisponivel')
    expect(result.elegivel).toBe(false)
    expect(result.motivos).toContain('Domingo não elegível para atendimento.')
  })

  // 6. Equipe vazia/inválida → indisponivel
  it('classifica como indisponível quando equipe é vazia', () => {
    const input = criarInput({ equipe: '' })
    const result = classificarCandidatoOperacionalV2(input)

    expect(result.tipo).toBe('indisponivel')
    expect(result.elegivel).toBe(false)
    expect(result.motivos).toContain('Equipe ausente ou inválida.')
  })

  it('classifica como indisponível quando equipe não é string', () => {
    const input = criarInput({ equipe: 123 as unknown as string })
    const result = classificarCandidatoOperacionalV2(input)

    expect(result.tipo).toBe('indisponivel')
    expect(result.elegivel).toBe(false)
  })

  // 7. Config essencial ausente → indisponivel
  it('classifica como indisponível quando config essencial é null', () => {
    const input = criarInput({
      config: {
        kmAdicionalMaxNaRotaM: null,
        kmAdicionalMaxNaRotaEspecialM: null,
        kmAdicionalMaxNaRotaPremiumM: null,
        kmMaximoNaSemanaM: null,
        kmMaximoNoSabadoM: null,
      },
    })
    const result = classificarCandidatoOperacionalV2(input)

    expect(result.tipo).toBe('indisponivel')
    expect(result.elegivel).toBe(false)
    expect(result.motivos).toContain('Configuração de distância ausente ou inválida.')
  })

  // 8. Hora marcada válida → hora-marcada
  it('classifica como hora-marcada quando horaMarcada é true', () => {
    const input = criarInput({ horaMarcada: true })
    const result = classificarCandidatoOperacionalV2(input)

    expect(result.tipo).toBe('hora-marcada')
    expect(result.elegivel).toBe(true)
    expect(result.motivos).toContain('Atendimento classificado como hora marcada.')
  })

  // 9. Cenário normal em dia de semana
  it('classifica como normal em dia de semana dentro do limite base', () => {
    const input = criarInput({ kmAdicionalNaRotaM: 3000 }) // 3km < 5km base
    const result = classificarCandidatoOperacionalV2(input)

    expect(result.tipo).toBe('normal')
    expect(result.elegivel).toBe(true)
    expect(result.motivos).toHaveLength(0)
  })

  // 10. Cenário normal em sábado usando limite de sábado
  it('classifica como normal em sábado respeitando limite de sábado', () => {
    const input = criarInput({
      ehSabado: true,
      diaSemana: 6,
      kmAdicionalNaRotaM: 3000,
    })
    const result = classificarCandidatoOperacionalV2(input)

    expect(result.tipo).toBe('normal')
    expect(result.elegivel).toBe(true)
  })

  // 11. Fora do limite normal, mas dentro do especial
  it('classifica como especial quando km adicional está entre normal e especial', () => {
    const input = criarInput({ kmAdicionalNaRotaM: 7000 }) // 7km > 5km base, < 10km especial
    const result = classificarCandidatoOperacionalV2(input)

    expect(result.tipo).toBe('especial')
    expect(result.elegivel).toBe(true)
  })

  // 12. Fora do especial, mas dentro do premium
  it('classifica como premium quando km adicional está entre especial e premium', () => {
    const input = criarInput({ kmAdicionalNaRotaM: 12000 }) // 12km > 10km especial, < 15km premium
    const result = classificarCandidatoOperacionalV2(input)

    expect(result.tipo).toBe('premium')
    expect(result.elegivel).toBe(true)
  })

  // 13. Fora do premium → indisponivel
  it('classifica como indisponível quando km adicional está acima do premium', () => {
    const input = criarInput({ kmAdicionalNaRotaM: 18000 }) // 18km > 15km premium
    const result = classificarCandidatoOperacionalV2(input)

    expect(result.tipo).toBe('indisponivel')
    expect(result.elegivel).toBe(false)
    expect(result.motivos).toContain('Distância adicional fora dos limites configurados.')
  })

  // 14. Condomínio adiciona aviso, mas não bloqueia
  it('adiciona aviso de condomínio sem bloquear', () => {
    const input = criarInput({ isCondominio: true })
    const result = classificarCandidatoOperacionalV2(input)

    expect(result.tipo).toBe('normal')
    expect(result.elegivel).toBe(true)
    expect(result.avisos).toContain('Atendimento em condomínio informado.')
  })

  // 15. Rural adiciona aviso, mas não bloqueia
  it('adiciona aviso de rural sem bloquear', () => {
    const input = criarInput({ isRural: true })
    const result = classificarCandidatoOperacionalV2(input)

    expect(result.tipo).toBe('normal')
    expect(result.elegivel).toBe(true)
    expect(result.avisos).toContain('Atendimento rural informado.')
  })

  // 16. Mantém detalhes coerentes na saída
  it('mantém detalhes coerentes na saída', () => {
    const input = criarInput({
      dataISO: '2026-06-13',
      diaSemana: 6,
      ehSabado: true,
      equipe: 'EQUIPE 2',
      ativa: true,
      disponivelMin: 180,
      suficienteParaServico: true,
      tempoNecessarioMin: 60,
      distanciaKm: 8,
      kmAdicionalNaRotaM: 4000,
    })
    const result = classificarCandidatoOperacionalV2(input)

    expect(result.detalhes.dataISO).toBe('2026-06-13')
    expect(result.detalhes.diaSemana).toBe(6)
    expect(result.detalhes.ehSabado).toBe(true)
    expect(result.detalhes.equipe).toBe('EQUIPE 2')
    expect(result.detalhes.disponivelMin).toBe(180)
    expect(result.detalhes.suficienteParaServico).toBe(true)
    expect(result.detalhes.tempoNecessarioMin).toBe(60)
    expect(result.detalhes.distanciaKm).toBe(8)
    expect(result.detalhes.kmAdicionalNaRotaM).toBe(4000)
  })

  // 17. Não muta input
  it('não muta o objeto de entrada', () => {
    const input = criarInput()
    const copia = { ...input, config: { ...input.config } }
    classificarCandidatoOperacionalV2(input)

    expect(input).toEqual(copia)
  })

  // 18. kmAdicionalNaRotaM inválido/null → indisponivel
  it('classifica como indisponível quando kmAdicionalNaRotaM é null', () => {
    const input = criarInput({ kmAdicionalNaRotaM: null })
    const result = classificarCandidatoOperacionalV2(input)

    expect(result.tipo).toBe('indisponivel')
    expect(result.motivos).toContain('Distância adicional na rota ausente ou inválida.')
  })

  it('classifica como indisponível quando kmAdicionalNaRotaM é undefined', () => {
    const input = criarInput({ kmAdicionalNaRotaM: undefined })
    const result = classificarCandidatoOperacionalV2(input)

    expect(result.tipo).toBe('indisponivel')
    expect(result.motivos).toContain('Distância adicional na rota ausente ou inválida.')
  })

  // 19. Distância acima do máximo semanal → indisponivel
  it('classifica como indisponível quando distância acima do máximo semanal', () => {
    // distanciaKm = 20 → 20000m > kmMaximoNaSemanaM = 16000m
    const input = criarInput({ distanciaKm: 20, ehSabado: false })
    const result = classificarCandidatoOperacionalV2(input)

    expect(result.tipo).toBe('indisponivel')
    expect(result.motivos).toContain('Distância acima do limite máximo da semana.')
  })

  // 20. Distância acima do máximo de sábado → indisponivel
  it('classifica como indisponível quando distância acima do máximo de sábado', () => {
    // distanciaKm = 25 → 25000m > kmMaximoNoSabadoM = 20000m
    const input = criarInput({ distanciaKm: 25, ehSabado: true, diaSemana: 6 })
    const result = classificarCandidatoOperacionalV2(input)

    expect(result.tipo).toBe('indisponivel')
    expect(result.motivos).toContain('Distância acima do limite máximo de sábado.')
  })

  // 21. Sábado dentro do limite de sábado mas acima do limite de semana
  it('usa limite de sábado em sábado, não limite de semana', () => {
    // distanciaKm = 18 → 18000m > 16000m (limite semana), mas < 20000m (limite sábado)
    const input = criarInput({
      distanciaKm: 18,
      ehSabado: true,
      diaSemana: 6,
      kmAdicionalNaRotaM: 3000,
    })
    const result = classificarCandidatoOperacionalV2(input)

    expect(result.tipo).toBe('normal')
    expect(result.elegivel).toBe(true)
  })

  // 22. Equipe inativa sem motivo
  it('classifica como indisponível sem motivo quando equipe inativa sem motivo', () => {
    const input = criarInput({ ativa: false, motivoIndisponibilidade: null })
    const result = classificarCandidatoOperacionalV2(input)

    expect(result.tipo).toBe('indisponivel')
    expect(result.motivos).toContain('Equipe inativa.')
    expect(result.motivos.some((m) => m.includes('Motivo:'))).toBe(false)
  })

  // 23. kmMaximoNaSemanaM null → indisponivel
  it('classifica como indisponível quando kmMaximoNaSemanaM é null', () => {
    const input = criarInput({
      config: {
        ...configBase,
        kmMaximoNaSemanaM: null,
      },
    })
    const result = classificarCandidatoOperacionalV2(input)

    expect(result.tipo).toBe('indisponivel')
    expect(result.elegivel).toBe(false)
    expect(result.motivos).toContain('Configuração de distância ausente ou inválida.')
  })

  // 24. kmMaximoNoSabadoM null → indisponivel
  it('classifica como indisponível quando kmMaximoNoSabadoM é null', () => {
    const input = criarInput({
      config: {
        ...configBase,
        kmMaximoNoSabadoM: null,
      },
    })
    const result = classificarCandidatoOperacionalV2(input)

    expect(result.tipo).toBe('indisponivel')
    expect(result.elegivel).toBe(false)
    expect(result.motivos).toContain('Configuração de distância ausente ou inválida.')
  })

  // 25. kmMaximoNaSemanaM NaN → indisponivel
  it('classifica como indisponível quando kmMaximoNaSemanaM é NaN', () => {
    const input = criarInput({
      config: {
        ...configBase,
        kmMaximoNaSemanaM: NaN,
      },
    })
    const result = classificarCandidatoOperacionalV2(input)

    expect(result.tipo).toBe('indisponivel')
    expect(result.elegivel).toBe(false)
    expect(result.motivos).toContain('Configuração de distância ausente ou inválida.')
  })

  // 26. kmMaximoNoSabadoM NaN → indisponivel
  it('classifica como indisponível quando kmMaximoNoSabadoM é NaN', () => {
    const input = criarInput({
      config: {
        ...configBase,
        kmMaximoNoSabadoM: NaN,
      },
    })
    const result = classificarCandidatoOperacionalV2(input)

    expect(result.tipo).toBe('indisponivel')
    expect(result.elegivel).toBe(false)
    expect(result.motivos).toContain('Configuração de distância ausente ou inválida.')
  })

  // 27. kmMaximoNaSemanaM negativo → indisponivel
  it('classifica como indisponível quando kmMaximoNaSemanaM é negativo', () => {
    const input = criarInput({
      config: {
        ...configBase,
        kmMaximoNaSemanaM: -1,
      },
    })
    const result = classificarCandidatoOperacionalV2(input)

    expect(result.tipo).toBe('indisponivel')
    expect(result.elegivel).toBe(false)
    expect(result.motivos).toContain('Configuração de distância ausente ou inválida.')
  })

  // 28. kmMaximoNoSabadoM negativo → indisponivel
  it('classifica como indisponível quando kmMaximoNoSabadoM é negativo', () => {
    const input = criarInput({
      config: {
        ...configBase,
        kmMaximoNoSabadoM: -1,
      },
    })
    const result = classificarCandidatoOperacionalV2(input)

    expect(result.tipo).toBe('indisponivel')
    expect(result.elegivel).toBe(false)
    expect(result.motivos).toContain('Configuração de distância ausente ou inválida.')
  })

  // 29. Cenário válido de dia de semana continua classificando corretamente
  it('classifica como normal em dia de semana com config válida', () => {
    const input = criarInput({ ehSabado: false, kmAdicionalNaRotaM: 3000 })
    const result = classificarCandidatoOperacionalV2(input)

    expect(result.tipo).toBe('normal')
    expect(result.elegivel).toBe(true)
  })

  // 30. Cenário válido de sábado continua classificando corretamente
  it('classifica como normal em sábado com config válida', () => {
    const input = criarInput({ ehSabado: true, diaSemana: 6, kmAdicionalNaRotaM: 3000 })
    const result = classificarCandidatoOperacionalV2(input)

    expect(result.tipo).toBe('normal')
    expect(result.elegivel).toBe(true)
  })

  // 31. Exatamente no limite base → normal
  it('classifica como normal quando km adicional está exatamente no limite base', () => {
    const input = criarInput({ kmAdicionalNaRotaM: 5000 }) // exatamente 5km
    const result = classificarCandidatoOperacionalV2(input)

    expect(result.tipo).toBe('normal')
    expect(result.elegivel).toBe(true)
  })

  // 32. Exatamente no limite especial → especial
  it('classifica como especial quando km adicional está exatamente no limite especial', () => {
    const input = criarInput({ kmAdicionalNaRotaM: 10000 }) // exatamente 10km
    const result = classificarCandidatoOperacionalV2(input)

    expect(result.tipo).toBe('especial')
    expect(result.elegivel).toBe(true)
  })

  // 33. Exatamente no limite premium → premium
  it('classifica como premium quando km adicional está exatamente no limite premium', () => {
    const input = criarInput({ kmAdicionalNaRotaM: 15000 }) // exatamente 15km
    const result = classificarCandidatoOperacionalV2(input)

    expect(result.tipo).toBe('premium')
    expect(result.elegivel).toBe(true)
  })
})
