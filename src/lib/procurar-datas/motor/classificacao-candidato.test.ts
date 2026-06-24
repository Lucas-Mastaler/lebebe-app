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
  horaMarcadaHorasAMais: 2,
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

  // 4. distanciaKm null → avisa mas não bloqueia (equivalência legado)
  it('classifica baseado em kmAdicionalNaRotaM quando distanciaKm é null', () => {
    const input = criarInput({ distanciaKm: null, kmAdicionalNaRotaM: 3000 })
    const result = classificarCandidatoOperacionalV2(input)

    expect(result.tipo).toBe('normal')
    expect(result.elegivel).toBe(true)
    expect(result.motivos).not.toContain('Distância ausente ou inválida.')
    expect(result.avisos).toContain('Distância base (origem → destino) ausente. Classificação baseada apenas em km adicional de rota.')
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

    expect(result.tipo).toBe('normal')
    expect(result.elegivel).toBe(true)
    expect(result.horaMarcada).toBe(true)
  })

  it('calcula hora marcada com slotAvailMin, serviceMin e horas adicionais', () => {
    const result = classificarCandidatoOperacionalV2(criarInput({
      disponivelMin: 160,
      tempoNecessarioMin: 40,
      kmAdicionalNaRotaM: 3000,
    }))

    expect(result.tipo).toBe('normal')
    expect(result.horaMarcada).toBe(true)
    expect(result.elegivelHoraMarcada).toBe(true)
    expect(result.detalhes.slotAvailMin).toBe(160)
    expect(result.detalhes.serviceMin).toBe(40)
    expect(result.detalhes.horaMarcadaHorasAMais).toBe(2)
    expect(result.detalhes.limiteMinimoHoraMarcadaMin).toBe(160)
  })

  it('nao marca hora marcada quando falta tempo adicional', () => {
    const result = classificarCandidatoOperacionalV2(criarInput({
      disponivelMin: 159,
      tempoNecessarioMin: 40,
      kmAdicionalNaRotaM: 3000,
    }))

    expect(result.tipo).toBe('normal')
    expect(result.horaMarcada).toBe(false)
    expect(result.elegivelHoraMarcada).toBe(false)
    expect(result.detalhes.motivoHoraMarcada).toContain('Tempo disponivel insuficiente')
  })

  it('marca hora marcada exatamente na borda do tempo minimo', () => {
    const result = classificarCandidatoOperacionalV2(criarInput({
      disponivelMin: 160,
      tempoNecessarioMin: 40,
      kmAdicionalNaRotaM: 3000,
    }))

    expect(result.horaMarcada).toBe(true)
    expect(result.detalhes.limiteMinimoHoraMarcadaMin).toBe(160)
  })

  it('nao ativa hora marcada quando HORA MARCADA HORAS A MAIS e zero', () => {
    const result = classificarCandidatoOperacionalV2(criarInput({
      disponivelMin: 40,
      tempoNecessarioMin: 40,
      kmAdicionalNaRotaM: 3000,
      config: { ...configBase, horaMarcadaHorasAMais: 0 },
    }))

    expect(result.tipo).toBe('normal')
    expect(result.horaMarcada).toBe(false)
    expect(result.detalhes.limiteMinimoHoraMarcadaMin).toBeNull()
    expect(result.detalhes.motivoHoraMarcada).toContain('menor ou igual a zero')
  })

  it('nao marca hora marcada fora do limite normal mesmo com tempo sobrando', () => {
    const result = classificarCandidatoOperacionalV2(criarInput({
      disponivelMin: 240,
      tempoNecessarioMin: 40,
      kmAdicionalNaRotaM: 7000,
    }))

    expect(result.tipo).toBe('especial')
    expect(result.horaMarcada).toBe(false)
    expect(result.detalhes.motivoHoraMarcada).toContain('fora do limite normal')
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

  // 17. Testes de equivalência legado: distanciaKm null + kmAdicionalNaRotaM válido
  describe('equivalência legado - distanciaKm opcional', () => {
    it('classifica como especial com distanciaKm null e kmAdicional dentro do limite especial', () => {
      const input = criarInput({ distanciaKm: null, kmAdicionalNaRotaM: 7000 })
      const result = classificarCandidatoOperacionalV2(input)

      expect(result.tipo).toBe('especial')
      expect(result.elegivel).toBe(true)
      expect(result.avisos).toContain('Distância base (origem → destino) ausente. Classificação baseada apenas em km adicional de rota.')
    })

    it('classifica como normal com distanciaKm null e kmAdicional dentro do limite normal', () => {
      const input = criarInput({ distanciaKm: null, kmAdicionalNaRotaM: 3000 })
      const result = classificarCandidatoOperacionalV2(input)

      expect(result.tipo).toBe('normal')
      expect(result.elegivel).toBe(true)
      expect(result.avisos).toContain('Distância base (origem → destino) ausente. Classificação baseada apenas em km adicional de rota.')
    })

    it('classifica como premium com distanciaKm null e kmAdicional dentro do limite premium', () => {
      const input = criarInput({ distanciaKm: null, kmAdicionalNaRotaM: 12000 })
      const result = classificarCandidatoOperacionalV2(input)

      expect(result.tipo).toBe('premium')
      expect(result.elegivel).toBe(true)
      expect(result.avisos).toContain('Distância base (origem → destino) ausente. Classificação baseada apenas em km adicional de rota.')
    })

    it('classifica como indisponivel com distanciaKm null e kmAdicional acima do premium', () => {
      const input = criarInput({ distanciaKm: null, kmAdicionalNaRotaM: 18000 })
      const result = classificarCandidatoOperacionalV2(input)

      expect(result.tipo).toBe('indisponivel')
      expect(result.elegivel).toBe(false)
      expect(result.motivos).toContain('Distância adicional fora dos limites configurados.')
      expect(result.avisos).toContain('Distância base (origem → destino) ausente. Classificação baseada apenas em km adicional de rota.')
    })

    it('classifica como indisponivel quando kmAdicionalNaRotaM é null', () => {
      const input = criarInput({ distanciaKm: null, kmAdicionalNaRotaM: null })
      const result = classificarCandidatoOperacionalV2(input)

      expect(result.tipo).toBe('indisponivel')
      expect(result.elegivel).toBe(false)
      expect(result.motivos).toContain('Distância adicional na rota ausente ou inválida.')
    })
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
  it.each([
    [5000, 'normal'],
    [5001, 'especial'],
    [10000, 'especial'],
    [10001, 'premium'],
    [15000, 'premium'],
    [15001, 'indisponivel'],
  ] satisfies Array<[number, TipoClassificacaoCandidatoV2]>)(
    'classifica slot com pontos usando base 5000m: km=%s => %s',
    (kmAdicionalNaRotaM, tipoEsperado) => {
      const result = classificarCandidatoOperacionalV2(criarInput({
        slotTemPontos: true,
        kmAdicionalNaRotaM,
        distanciaKm: 5,
        config: {
          kmAdicionalMaxNaRotaM: 5000,
          kmAdicionalMaxNaRotaEspecialM: 5000,
          kmAdicionalMaxNaRotaPremiumM: 10000,
          kmMaximoNaSemanaM: 150000,
          kmMaximoNoSabadoM: 45000,
        },
      }))

      expect(result.tipo).toBe(tipoEsperado)
      expect(result.detalhes.limiteBaseM).toBe(5000)
      expect(result.detalhes.limiteEspecialM).toBe(10000)
      expect(result.detalhes.limitePremiumM).toBe(15000)
    }
  )

  it.each([
    [10000, 'normal'],
    [150000, 'normal'],
    [150001, 'especial'],
    [155000, 'especial'],
    [155001, 'premium'],
    [160000, 'premium'],
    [160001, 'indisponivel'],
  ] satisfies Array<[number, TipoClassificacaoCandidatoV2]>)(
    'classifica slot vazio em dia util usando base 150000m: km=%s => %s',
    (kmAdicionalNaRotaM, tipoEsperado) => {
      const result = classificarCandidatoOperacionalV2(criarInput({
        slotTemPontos: false,
        ehSabado: false,
        diaSemana: 1,
        kmAdicionalNaRotaM,
        distanciaKm: 5,
        config: {
          kmAdicionalMaxNaRotaM: 5000,
          kmAdicionalMaxNaRotaEspecialM: 5000,
          kmAdicionalMaxNaRotaPremiumM: 10000,
          kmMaximoNaSemanaM: 150000,
          kmMaximoNoSabadoM: 45000,
        },
      }))

      expect(result.tipo).toBe(tipoEsperado)
      expect(result.detalhes.limiteBaseM).toBe(150000)
      expect(result.detalhes.limiteEspecialM).toBe(155000)
      expect(result.detalhes.limitePremiumM).toBe(160000)
    }
  )

  it.each([
    [45000, 'normal'],
    [45001, 'especial'],
    [50000, 'especial'],
    [50001, 'premium'],
    [55000, 'premium'],
    [55001, 'indisponivel'],
  ] satisfies Array<[number, TipoClassificacaoCandidatoV2]>)(
    'classifica slot vazio em sabado usando base 45000m: km=%s => %s',
    (kmAdicionalNaRotaM, tipoEsperado) => {
      const result = classificarCandidatoOperacionalV2(criarInput({
        slotTemPontos: false,
        ehSabado: true,
        diaSemana: 6,
        kmAdicionalNaRotaM,
        distanciaKm: 5,
        config: {
          kmAdicionalMaxNaRotaM: 5000,
          kmAdicionalMaxNaRotaEspecialM: 5000,
          kmAdicionalMaxNaRotaPremiumM: 10000,
          kmMaximoNaSemanaM: 150000,
          kmMaximoNoSabadoM: 45000,
        },
      }))

      expect(result.tipo).toBe(tipoEsperado)
      expect(result.detalhes.limiteBaseM).toBe(45000)
      expect(result.detalhes.limiteEspecialM).toBe(50000)
      expect(result.detalhes.limitePremiumM).toBe(55000)
    }
  )

  it('usa especial e premium como guardas de ativacao', () => {
    expect(classificarCandidatoOperacionalV2(criarInput({
      kmAdicionalNaRotaM: 7000,
      config: { ...configBase, kmAdicionalMaxNaRotaEspecialM: 0 },
    })).tipo).toBe('premium')

    expect(classificarCandidatoOperacionalV2(criarInput({
      kmAdicionalNaRotaM: 12000,
      config: { ...configBase, kmAdicionalMaxNaRotaPremiumM: 0 },
    })).tipo).toBe('indisponivel')

    expect(classificarCandidatoOperacionalV2(criarInput({
      kmAdicionalNaRotaM: 7000,
      config: {
        ...configBase,
        kmAdicionalMaxNaRotaEspecialM: 0,
        kmAdicionalMaxNaRotaPremiumM: 0,
      },
    })).tipo).toBe('indisponivel')
  })

  // Testes específicos para hora marcada em candidatos indisponíveis
  describe('hora marcada - bloqueio em candidatos indisponíveis', () => {
    it('candidato normal com tempo suficiente → horaMarcada true', () => {
      const result = classificarCandidatoOperacionalV2(criarInput({
        disponivelMin: 240, // 4 horas
        tempoNecessarioMin: 40, // 40 minutos
        kmAdicionalNaRotaM: 3000, // 3 km (dentro do limite de 5 km)
        config: { ...configBase, horaMarcadaHorasAMais: 2 },
      }))

      expect(result.tipo).toBe('normal')
      expect(result.elegivel).toBe(true)
      expect(result.horaMarcada).toBe(true)
      expect(result.elegivelHoraMarcada).toBe(true)
      expect(result.detalhes.horaMarcadaCalculadaPorTempo).toBe(true)
      expect(result.detalhes.motivoHoraMarcada).toBeNull()
    })

    it('candidato indisponível com tempo suficiente → horaMarcada false (bloqueado)', () => {
      const result = classificarCandidatoOperacionalV2(criarInput({
        ativa: false, // indisponível
        disponivelMin: 240, // 4 horas
        tempoNecessarioMin: 40, // 40 minutos
        kmAdicionalNaRotaM: 3000, // 3 km (dentro do limite de 5 km)
        config: { ...configBase, horaMarcadaHorasAMais: 2 },
      }))

      expect(result.tipo).toBe('indisponivel')
      expect(result.elegivel).toBe(false)
      expect(result.horaMarcada).toBe(false)
      expect(result.elegivelHoraMarcada).toBe(false)
      expect(result.detalhes.horaMarcadaCalculadaPorTempo).toBe(true) // cálculo bruto indica tempo suficiente
      expect(result.detalhes.motivoHoraMarcada).toBe('Candidato indisponivel; hora marcada final bloqueada.')
    })

    it('candidato normal com tempo insuficiente → horaMarcada false', () => {
      const result = classificarCandidatoOperacionalV2(criarInput({
        disponivelMin: 60, // 1 hora
        tempoNecessarioMin: 40, // 40 minutos
        kmAdicionalNaRotaM: 3000, // 3 km (dentro do limite de 5 km)
        config: { ...configBase, horaMarcadaHorasAMais: 2 },
      }))

      expect(result.tipo).toBe('normal')
      expect(result.elegivel).toBe(true)
      expect(result.horaMarcada).toBe(false)
      expect(result.elegivelHoraMarcada).toBe(false)
      expect(result.detalhes.horaMarcadaCalculadaPorTempo).toBe(false)
      expect(result.detalhes.motivoHoraMarcada).toBe('Tempo disponivel insuficiente para hora marcada.')
    })

    it('candidato indisponível com tempo insuficiente → horaMarcada false', () => {
      const result = classificarCandidatoOperacionalV2(criarInput({
        ativa: false, // indisponível
        disponivelMin: 60, // 1 hora
        tempoNecessarioMin: 40, // 40 minutos
        kmAdicionalNaRotaM: 3000, // 3 km (dentro do limite de 5 km)
        config: { ...configBase, horaMarcadaHorasAMais: 2 },
      }))

      expect(result.tipo).toBe('indisponivel')
      expect(result.elegivel).toBe(false)
      expect(result.horaMarcada).toBe(false)
      expect(result.elegivelHoraMarcada).toBe(false)
      expect(result.detalhes.horaMarcadaCalculadaPorTempo).toBe(false)
    })

    it('candidato normal com km acima do limite base → horaMarcada false', () => {
      const result = classificarCandidatoOperacionalV2(criarInput({
        disponivelMin: 240, // 4 horas
        tempoNecessarioMin: 40, // 40 minutos
        kmAdicionalNaRotaM: 6000, // 6 km (acima do limite base de 5 km, mas dentro do especial de 10 km)
        config: { ...configBase, horaMarcadaHorasAMais: 2 },
      }))

      expect(result.tipo).toBe('especial') // km 6000 está no limite especial
      expect(result.elegivel).toBe(true)
      expect(result.horaMarcada).toBe(false) // hora marcada bloqueada por km acima do limite base
      expect(result.elegivelHoraMarcada).toBe(false)
      expect(result.detalhes.horaMarcadaCalculadaPorTempo).toBe(false)
      expect(result.detalhes.motivoHoraMarcada).toBe('Km adicional fora do limite normal para hora marcada.')
    })

    it('candidato especial com tempo suficiente e km dentro do limite base → horaMarcada true (não exclusivo)', () => {
      const result = classificarCandidatoOperacionalV2(criarInput({
        disponivelMin: 240, // 4 horas
        tempoNecessarioMin: 40, // 40 minutos
        kmAdicionalNaRotaM: 4000, // 4 km (dentro do limite base de 5 km)
        config: { ...configBase, horaMarcadaHorasAMais: 2 },
      }))

      expect(result.tipo).toBe('normal') // km 4000 está no limite base
      expect(result.elegivel).toBe(true)
      expect(result.horaMarcada).toBe(true) // hora marcada não é exclusiva
      expect(result.elegivelHoraMarcada).toBe(true)
      expect(result.detalhes.horaMarcadaCalculadaPorTempo).toBe(true)
    })
  })
})
