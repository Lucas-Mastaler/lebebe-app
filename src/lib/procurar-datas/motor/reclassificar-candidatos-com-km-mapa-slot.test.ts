import { describe, it, expect } from 'vitest'
import {
  reclassificarCandidatosComKmMapaSlotDiagnosticoV2,
  type CandidatoParaReclassificacao,
  type ReclassificarCandidatosComKmMapaSlotInput,
} from './reclassificar-candidatos-com-km-mapa-slot'
import type { ConfigClassificacaoV2 } from './classificacao-candidato'

// Config padrão: base 5km, especial 10km, premium 15km, semana 16km, sábado 20km
const configBase: ConfigClassificacaoV2 = {
  kmAdicionalMaxNaRotaM: 5000,
  kmAdicionalMaxNaRotaEspecialM: 10000,
  kmAdicionalMaxNaRotaPremiumM: 15000,
  kmMaximoNaSemanaM: 16000,
  kmMaximoNoSabadoM: 20000,
  horaMarcadaHorasAMais: 2,
}

function criarCandidato(
  overrides: Partial<CandidatoParaReclassificacao> = {}
): CandidatoParaReclassificacao {
  return {
    dataISO: '2026-06-15',
    equipe: 'EQUIPE 1',
    diaSemana: 1,
    ehSabado: false,
    ehDomingo: false,
    ativa: true,
    disponivelMin: 240,
    suficienteParaServico: true,
    distanciaKm: 5,
    kmAdicionalNaRotaM: 3000,
    kmAdicionalAplicadoPorMapaSlot: true,
    origemKmAdicionalNaRotaM: 'mapa-slot-diagnostico',
    slotKeyKmAdicional: '2026-06-15::EQUIPE 1',
    tipo: 'normal',
    elegivel: true,
    motivos: [],
    ...overrides,
  }
}

function criarInput(
  candidatos: CandidatoParaReclassificacao[],
  overrides: Partial<Omit<ReclassificarCandidatosComKmMapaSlotInput, 'candidatos'>> = {}
): ReclassificarCandidatosComKmMapaSlotInput {
  return {
    candidatos,
    config: { ...configBase },
    tempoNecessarioMin: 40,
    ...overrides,
  }
}

describe('reclassificarCandidatosComKmMapaSlotDiagnosticoV2', () => {
  it('1. lista vazia retorna ok:true com contadores zerados', () => {
    const result = reclassificarCandidatosComKmMapaSlotDiagnosticoV2(criarInput([]))

    expect(result.ok).toBe(true)
    expect(result.modo).toBe('reclassificacao-com-km-mapa-slot-diagnostico')
    expect(result.candidatos).toHaveLength(0)
    expect(result.contadores.candidatosRecebidos).toBe(0)
    expect(result.contadores.candidatosReclassificados).toBe(0)
    expect(result.erros).toHaveLength(0)
  })

  it('2. candidato com km aplicado e dentro do limite normal permanece normal', () => {
    const c = criarCandidato({ kmAdicionalNaRotaM: 3000, tipo: 'normal', elegivel: true })
    const result = reclassificarCandidatosComKmMapaSlotDiagnosticoV2(criarInput([c]))

    expect(result.ok).toBe(true)
    expect(result.candidatos).toHaveLength(1)
    expect(result.candidatos[0].tipoDepois).toBe('normal')
    expect(result.candidatos[0].elegivelDepois).toBe(true)
    expect(result.candidatos[0].mudouTipo).toBe(false)
    expect(result.candidatos[0].mudouElegibilidade).toBe(false)
    expect(result.contadores.candidatosReclassificados).toBe(1)
    expect(result.contadores.candidatosComTipoAlterado).toBe(0)
  })

  it('3. candidato com km aplicado acima do base mas dentro do especial muda para especial', () => {
    // tipo original era normal (com Math.floor(base * 0.5) = 2500),
    // agora com kmAdicionalNaRotaM = 7000 → especial
    const c = criarCandidato({ kmAdicionalNaRotaM: 7000, tipo: 'normal', elegivel: true })
    const result = reclassificarCandidatosComKmMapaSlotDiagnosticoV2(criarInput([c]))

    expect(result.candidatos[0].tipoAntes).toBe('normal')
    expect(result.candidatos[0].tipoDepois).toBe('especial')
    expect(result.candidatos[0].mudouTipo).toBe(true)
    expect(result.candidatos[0].mudouElegibilidade).toBe(false)
    expect(result.contadores.candidatosComTipoAlterado).toBe(1)
  })

  it('4. candidato com km aplicado acima do premium vira indisponivel', () => {
    const c = criarCandidato({ kmAdicionalNaRotaM: 20000, tipo: 'normal', elegivel: true })
    const result = reclassificarCandidatosComKmMapaSlotDiagnosticoV2(criarInput([c]))

    expect(result.candidatos[0].tipoDepois).toBe('indisponivel')
    expect(result.candidatos[0].elegivelDepois).toBe(false)
    expect(result.candidatos[0].mudouTipo).toBe(true)
    expect(result.candidatos[0].mudouElegibilidade).toBe(true)
    expect(result.contadores.candidatosComElegibilidadeAlterada).toBe(1)
  })

  it('5. candidato sem km aplicado nao e reclassificado', () => {
    const c = criarCandidato({
      kmAdicionalAplicadoPorMapaSlot: false,
      origemKmAdicionalNaRotaM: 'sem-chave-no-mapa',
      kmAdicionalNaRotaM: null,
      tipo: 'normal',
      elegivel: true,
    })
    const result = reclassificarCandidatosComKmMapaSlotDiagnosticoV2(criarInput([c]))

    expect(result.candidatos[0].tipoAntes).toBe('normal')
    expect(result.candidatos[0].tipoDepois).toBe('normal')
    expect(result.candidatos[0].mudouTipo).toBe(false)
    expect(result.contadores.candidatosSemKmAplicado).toBe(1)
    expect(result.contadores.candidatosReclassificados).toBe(0)
    expect(result.contadores.candidatosSemChaveNoMapa).toBe(1)
  })

  it('6. mix de candidatos com e sem km aplicado retorna contadores corretos', () => {
    const candidatos = [
      criarCandidato({ kmAdicionalNaRotaM: 7000, tipo: 'normal', elegivel: true }),
      criarCandidato({
        kmAdicionalAplicadoPorMapaSlot: false,
        origemKmAdicionalNaRotaM: 'sem-chave-no-mapa',
        kmAdicionalNaRotaM: null,
        tipo: 'normal',
        elegivel: true,
      }),
      criarCandidato({ kmAdicionalNaRotaM: 3000, tipo: 'normal', elegivel: true }),
    ]
    const result = reclassificarCandidatosComKmMapaSlotDiagnosticoV2(criarInput(candidatos))

    expect(result.contadores.candidatosRecebidos).toBe(3)
    expect(result.contadores.candidatosComKmAplicado).toBe(2)
    expect(result.contadores.candidatosSemKmAplicado).toBe(1)
    expect(result.contadores.candidatosReclassificados).toBe(2)
    expect(result.contadores.candidatosSemChaveNoMapa).toBe(1)
  })

  it('7. candidato com km aplicado dentro do premium muda de normal para premium', () => {
    const c = criarCandidato({ kmAdicionalNaRotaM: 12000, tipo: 'normal', elegivel: true })
    const result = reclassificarCandidatosComKmMapaSlotDiagnosticoV2(criarInput([c]))

    expect(result.candidatos[0].tipoDepois).toBe('premium')
    expect(result.candidatos[0].mudouTipo).toBe(true)
    expect(result.candidatos[0].elegivelDepois).toBe(true)
  })

  it('8. candidato antes indisponivel com km baixo pode virar normal', () => {
    const c = criarCandidato({ kmAdicionalNaRotaM: 2000, tipo: 'indisponivel', elegivel: false })
    const result = reclassificarCandidatosComKmMapaSlotDiagnosticoV2(criarInput([c]))

    expect(result.candidatos[0].tipoAntes).toBe('indisponivel')
    expect(result.candidatos[0].tipoDepois).toBe('normal')
    expect(result.candidatos[0].elegivelDepois).toBe(true)
    expect(result.candidatos[0].mudouTipo).toBe(true)
    expect(result.candidatos[0].mudouElegibilidade).toBe(true)
  })

  it('9. campos do candidato reclassificado contem todos os campos obrigatorios', () => {
    const c = criarCandidato()
    const result = reclassificarCandidatosComKmMapaSlotDiagnosticoV2(criarInput([c]))
    const r = result.candidatos[0]

    expect(r).toHaveProperty('dataISO')
    expect(r).toHaveProperty('equipe')
    expect(r).toHaveProperty('slotKeyKmAdicional')
    expect(r).toHaveProperty('kmAdicionalNaRotaM')
    expect(r).toHaveProperty('origemKmAdicionalNaRotaM')
    expect(r).toHaveProperty('kmAdicionalAplicadoPorMapaSlot')
    expect(r).toHaveProperty('tipoAntes')
    expect(r).toHaveProperty('elegivelAntes')
    expect(r).toHaveProperty('tipoDepois')
    expect(r).toHaveProperty('elegivelDepois')
    expect(r).toHaveProperty('horaMarcadaAntes')
    expect(r).toHaveProperty('horaMarcadaDepois')
    expect(r).toHaveProperty('mudouHoraMarcada')
    expect(r).toHaveProperty('slotAvailMin')
    expect(r).toHaveProperty('serviceMin')
    expect(r).toHaveProperty('horaMarcadaHorasAMais')
    expect(r).toHaveProperty('limiteMinimoHoraMarcadaMin')
    expect(r).toHaveProperty('mudouTipo')
    expect(r).toHaveProperty('mudouElegibilidade')
    expect(r).toHaveProperty('motivosAntes')
    expect(r).toHaveProperty('motivosDepois')
  })

  it('10. motivosDepois contem motivos da reclassificacao real', () => {
    // km acima do premium → motivos devem incluir distância fora dos limites
    const c = criarCandidato({ kmAdicionalNaRotaM: 20000, tipo: 'normal', elegivel: true })
    const result = reclassificarCandidatosComKmMapaSlotDiagnosticoV2(criarInput([c]))

    expect(result.candidatos[0].motivosDepois).toContain(
      'Distância adicional fora dos limites configurados.'
    )
  })

  it('11. candidato com kmAdicionalNaRotaM null e aplicado=true vira indisponivel', () => {
    const c = criarCandidato({
      kmAdicionalNaRotaM: null,
      kmAdicionalAplicadoPorMapaSlot: true,
      tipo: 'normal',
      elegivel: true,
    })
    const result = reclassificarCandidatosComKmMapaSlotDiagnosticoV2(criarInput([c]))

    // classificarCandidatoOperacionalV2 retorna indisponivel para kmAdicionalNaRotaM null
    expect(result.candidatos[0].tipoDepois).toBe('indisponivel')
    expect(result.candidatos[0].elegivelDepois).toBe(false)
    expect(result.candidatos[0].mudouTipo).toBe(true)
  })

  it('12. domingo com km aplicado permanece indisponivel', () => {
    const c = criarCandidato({
      ehDomingo: true,
      diaSemana: 0,
      kmAdicionalNaRotaM: 3000,
      tipo: 'indisponivel',
      elegivel: false,
    })
    const result = reclassificarCandidatosComKmMapaSlotDiagnosticoV2(criarInput([c]))

    expect(result.candidatos[0].tipoDepois).toBe('indisponivel')
    expect(result.candidatos[0].elegivelDepois).toBe(false)
    expect(result.candidatos[0].mudouTipo).toBe(false)
    expect(result.candidatos[0].mudouElegibilidade).toBe(false)
  })

  it('13. avisos do helper contem mensagem de diagnostico', () => {
    const result = reclassificarCandidatosComKmMapaSlotDiagnosticoV2(criarInput([]))

    expect(result.avisos.some((a) => a.includes('Reclassificacao'))).toBe(true)
    expect(result.avisos.some((a) => a.includes('diagnostico'))).toBe(true)
    expect(result.avisos.some((a) => a.includes('isolamento'))).toBe(true)
  })

  it('14. modo correto retornado', () => {
    const result = reclassificarCandidatosComKmMapaSlotDiagnosticoV2(criarInput([]))
    expect(result.modo).toBe('reclassificacao-com-km-mapa-slot-diagnostico')
  })

  it('15. candidato sem-data-equipe nao reclassificado e contabilizado como sem km aplicado', () => {
    const c = criarCandidato({
      kmAdicionalAplicadoPorMapaSlot: false,
      origemKmAdicionalNaRotaM: 'sem-data-equipe',
      kmAdicionalNaRotaM: null,
    })
    const result = reclassificarCandidatosComKmMapaSlotDiagnosticoV2(criarInput([c]))

    expect(result.contadores.candidatosSemKmAplicado).toBe(1)
    expect(result.contadores.candidatosReclassificados).toBe(0)
    // sem-data-equipe nao conta como sem-chave-no-mapa
    expect(result.contadores.candidatosSemChaveNoMapa).toBe(0)
  })

  it('16. sabado com distancia acima do limite de sabado vira indisponivel', () => {
    const c = criarCandidato({
      ehSabado: true,
      diaSemana: 6,
      distanciaKm: 25, // 25000m > 20000m (limite sábado)
      kmAdicionalNaRotaM: 3000,
      tipo: 'normal',
      elegivel: true,
    })
    const result = reclassificarCandidatosComKmMapaSlotDiagnosticoV2(criarInput([c]))

    expect(result.candidatos[0].tipoDepois).toBe('indisponivel')
    expect(result.candidatos[0].mudouTipo).toBe(true)
  })
  it('17. candidato com slotTemPontos true usa base curta de rota', () => {
    const c = criarCandidato({
      slotTemPontos: true,
      kmAdicionalNaRotaM: 7000,
      tipo: 'normal',
      elegivel: true,
    })
    const result = reclassificarCandidatosComKmMapaSlotDiagnosticoV2(criarInput([c]))

    expect(result.candidatos[0].tipoDepois).toBe('especial')
    expect(result.candidatos[0].slotTemPontos).toBe(true)
    expect(result.candidatos[0].limiteBaseM).toBe(5000)
  })

  it('18. candidato com slotTemPontos false em dia util usa limite maximo da semana como base', () => {
    const c = criarCandidato({
      slotTemPontos: false,
      ehSabado: false,
      diaSemana: 1,
      kmAdicionalNaRotaM: 15000,
      tipo: 'indisponivel',
      elegivel: false,
    })
    const result = reclassificarCandidatosComKmMapaSlotDiagnosticoV2(criarInput([c]))

    expect(result.candidatos[0].tipoDepois).toBe('normal')
    expect(result.candidatos[0].slotTemPontos).toBe(false)
    expect(result.candidatos[0].limiteBaseM).toBe(16000)
  })

  it('19. candidato com slotTemPontos false em sabado usa limite maximo de sabado como base', () => {
    const c = criarCandidato({
      slotTemPontos: false,
      ehSabado: true,
      diaSemana: 6,
      distanciaKm: 5,
      kmAdicionalNaRotaM: 20000,
      tipo: 'indisponivel',
      elegivel: false,
    })
    const result = reclassificarCandidatosComKmMapaSlotDiagnosticoV2(criarInput([c]))

    expect(result.candidatos[0].tipoDepois).toBe('normal')
    expect(result.candidatos[0].slotTemPontos).toBe(false)
    expect(result.candidatos[0].limiteBaseM).toBe(20000)
  })

  it('20. reclassificacao compara hora marcada antes e depois', () => {
    const c = criarCandidato({
      horaMarcada: false,
      elegivelHoraMarcada: false,
      disponivelMin: 160,
      kmAdicionalNaRotaM: 3000,
    })
    const result = reclassificarCandidatosComKmMapaSlotDiagnosticoV2(criarInput([c]))
    const r = result.candidatos[0]

    expect(r.tipoDepois).toBe('normal')
    expect(r.horaMarcadaAntes).toBe(false)
    expect(r.horaMarcadaDepois).toBe(true)
    expect(r.mudouHoraMarcada).toBe(true)
    expect(r.slotAvailMin).toBe(160)
    expect(r.serviceMin).toBe(40)
    expect(r.horaMarcadaHorasAMais).toBe(2)
    expect(r.limiteMinimoHoraMarcadaMin).toBe(160)
  })

  it('21. reclassificacao nao marca hora marcada quando config de horas extras e zero', () => {
    const c = criarCandidato({
      horaMarcada: false,
      elegivelHoraMarcada: false,
      disponivelMin: 240,
      kmAdicionalNaRotaM: 3000,
    })
    const result = reclassificarCandidatosComKmMapaSlotDiagnosticoV2(criarInput([c], {
      config: { ...configBase, horaMarcadaHorasAMais: 0 },
    }))
    const r = result.candidatos[0]

    expect(r.horaMarcadaAntes).toBe(false)
    expect(r.horaMarcadaDepois).toBe(false)
    expect(r.mudouHoraMarcada).toBe(false)
    expect(r.horaMarcadaHorasAMais).toBe(0)
    expect(r.limiteMinimoHoraMarcadaMin).toBeNull()
  })
})
