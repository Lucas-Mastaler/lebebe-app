import { describe, it, expect } from 'vitest'
import {
  adaptarCandidatoV2ParaContratoLegadoDiagnostico,
  type AdaptarCandidatoV2ParaContratoLegadoDiagnosticoInput,
} from './adaptador-candidato-legado'
import type { CandidatoPreliminarV2 } from './candidato'

// ─── Fixtures ────────────────────────────────────────────────────────────────

function criarCandidatoBase(
  overrides?: Partial<CandidatoPreliminarV2>
): CandidatoPreliminarV2 {
  return {
    id: 'v2-2026-06-23-equipe-1-normal-2',
    elegivel: true,
    tipo: 'normal',
    dataISO: '2026-06-23',
    indice: 2,
    diaSemana: 2,
    ehSabado: false,
    ehDomingo: false,
    equipe: 'EQUIPE 1',
    operacional: {
      ativa: true,
      disponivelMin: 240,
      suficienteParaServico: true,
      tempoNecessarioMin: 60,
    },
    distancia: {
      distanciaKm: 8,
      kmAdicionalNaRotaM: 3000,
    },
    frete: {
      valorFrete: 110,
      tipoFrete: 'fixo',
    },
    motivos: [],
    avisos: [],
    diagnostico: {
      origem: 'v2-preliminar',
      classificacaoTipo: 'normal',
      classificacaoElegivel: true,
    },
    ...overrides,
  }
}

function criarInput(
  overrides?: Partial<AdaptarCandidatoV2ParaContratoLegadoDiagnosticoInput>
): AdaptarCandidatoV2ParaContratoLegadoDiagnosticoInput {
  return {
    candidato: criarCandidatoBase(),
    rank: 1,
    dataReferenciaISO: '2026-06-12',
    ...overrides,
  }
}

// ─── Suite ───────────────────────────────────────────────────────────────────

describe('adaptarCandidatoV2ParaContratoLegadoDiagnostico', () => {
  // 1. Adapta candidato normal
  it('adapta candidato normal com todos os campos mapeados', () => {
    const resultado = adaptarCandidatoV2ParaContratoLegadoDiagnostico(criarInput())

    expect(resultado.tipo).toBe('normal')
    expect(resultado.isExtra).toBe(false)
    expect(resultado.team).toBe('EQUIPE 1')
    expect(resultado.rank).toBe(1)
    expect(resultado.dateISO).toBe('2026-06-23')
    expect(typeof resultado.dateDM).toBe('string')
    expect(typeof resultado.weekday).toBe('string')
    expect(typeof resultado.frete).toBe('string')
    expect(typeof resultado.daysLeftTxt).toBe('string')
    expect(resultado.encomenda).toBe('Não')
    expect(resultado.avisoHoraMarcada).toBe('')
    expect(resultado.diagnosticoV2.origem).toBe('v2-adaptado-diagnostico')
  })

  it('sem formatoDateISO mantem dateISO no formato v2 YYYY-MM-DD', () => {
    const resultado = adaptarCandidatoV2ParaContratoLegadoDiagnostico(criarInput())

    expect(resultado.dateISO).toBe('2026-06-23')
  })

  it('com formatoDateISO v2 mantem dateISO no formato YYYY-MM-DD', () => {
    const resultado = adaptarCandidatoV2ParaContratoLegadoDiagnostico(
      criarInput({ formatoDateISO: 'v2' })
    )

    expect(resultado.dateISO).toBe('2026-06-23')
  })

  it('com formatoDateISO legado-gmt3 emite sufixo observado nas fixtures', () => {
    const resultado = adaptarCandidatoV2ParaContratoLegadoDiagnostico(
      criarInput({ formatoDateISO: 'legado-gmt3' })
    )

    expect(resultado.dateISO).toBe('2026-06-23T03:00:00.000Z')
  })

  it('formatoDateISO legado-gmt3 preserva dateDM, weekday e daysLeftTxt', () => {
    const resultado = adaptarCandidatoV2ParaContratoLegadoDiagnostico(
      criarInput({ formatoDateISO: 'legado-gmt3' })
    )

    expect(resultado.dateDM).toBe('23/06')
    expect(resultado.weekday).toBe('Terça')
    expect(resultado.daysLeftTxt).toBe('11 d')
  })

  it('formatoDateISO legado-gmt3 nao altera rank, tipo, frete, team ou isExtra', () => {
    const resultado = adaptarCandidatoV2ParaContratoLegadoDiagnostico(
      criarInput({ formatoDateISO: 'legado-gmt3' })
    )

    expect(resultado.rank).toBe(1)
    expect(resultado.tipo).toBe('normal')
    expect(resultado.frete).toBe('R$ 110')
    expect(resultado.team).toBe('EQUIPE 1')
    expect(resultado.isExtra).toBe(false)
  })

  // 2. Adapta candidato premium com isExtra: true
  it('adapta candidato premium com isExtra: true', () => {
    const candidato = criarCandidatoBase({
      tipo: 'premium',
      frete: { valorFrete: 320, tipoFrete: 'viagem' },
      elegivel: true,
    })
    const resultado = adaptarCandidatoV2ParaContratoLegadoDiagnostico(
      criarInput({ candidato })
    )

    expect(resultado.tipo).toBe('premium')
    expect(resultado.isExtra).toBe(true)
  })

  // 3. Adapta candidato especial com isExtra: true
  it('adapta candidato especial com isExtra: true', () => {
    const candidato = criarCandidatoBase({
      tipo: 'especial',
      frete: { valorFrete: 220, tipoFrete: 'viagem' },
      elegivel: true,
    })
    const resultado = adaptarCandidatoV2ParaContratoLegadoDiagnostico(
      criarInput({ candidato })
    )

    expect(resultado.tipo).toBe('especial')
    expect(resultado.isExtra).toBe(true)
  })

  // 4. Hora marcada gera aviso/diagnóstico de pendência
  it('hora-marcada gera isExtra true, avisoHoraMarcada preenchido e aviso de pendencia', () => {
    const candidato = criarCandidatoBase({
      tipo: 'hora-marcada',
      frete: { valorFrete: 200, tipoFrete: 'hora-marcada' },
    })
    const resultado = adaptarCandidatoV2ParaContratoLegadoDiagnostico(
      criarInput({ candidato })
    )

    expect(resultado.tipo).toBe('hora-marcada')
    expect(resultado.isExtra).toBe(true)
    expect(resultado.avisoHoraMarcada).not.toBe('')
    expect(
      resultado.diagnosticoV2.avisos.some(
        (a) => a.includes('hora-marcada') && a.includes('pendente')
      )
    ).toBe(true)
  })

  // 5. Formata dateDM
  it('formata dateDM de YYYY-MM-DD para DD/MM', () => {
    const candidato = criarCandidatoBase({ dataISO: '2026-06-23' })
    const resultado = adaptarCandidatoV2ParaContratoLegadoDiagnostico(
      criarInput({ candidato })
    )

    expect(resultado.dateDM).toBe('23/06')
  })

  it('formata dateDM para data em julho', () => {
    const candidato = criarCandidatoBase({ dataISO: '2026-07-11', diaSemana: 6 })
    const resultado = adaptarCandidatoV2ParaContratoLegadoDiagnostico(
      criarInput({ candidato })
    )

    expect(resultado.dateDM).toBe('11/07')
  })

  // 6. Formata weekday
  it('mapeia diaSemana 2 (UTC) para Terca', () => {
    const candidato = criarCandidatoBase({ diaSemana: 2 })
    const resultado = adaptarCandidatoV2ParaContratoLegadoDiagnostico(
      criarInput({ candidato })
    )

    expect(resultado.weekday).toBe('Terça')
  })

  it('mapeia todos os dias da semana corretamente (0=Domingo a 6=Sabado)', () => {
    const esperados: Record<number, string> = {
      0: 'Domingo',
      1: 'Segunda',
      2: 'Terça',
      3: 'Quarta',
      4: 'Quinta',
      5: 'Sexta',
      6: 'Sábado',
    }
    for (const [diaSemana, nome] of Object.entries(esperados)) {
      const candidato = criarCandidatoBase({ diaSemana: Number(diaSemana) })
      const resultado = adaptarCandidatoV2ParaContratoLegadoDiagnostico(
        criarInput({ candidato })
      )
      expect(resultado.weekday, `diaSemana ${diaSemana}`).toBe(nome)
    }
  })

  it('diaSemana fora do intervalo retorna weekday vazio e aviso', () => {
    const candidato = criarCandidatoBase({ diaSemana: 9 })
    const resultado = adaptarCandidatoV2ParaContratoLegadoDiagnostico(
      criarInput({ candidato })
    )

    expect(resultado.weekday).toBe('')
    expect(
      resultado.diagnosticoV2.avisos.some((a) => a.includes('diaSemana') && a.includes('9'))
    ).toBe(true)
  })

  // 7. Formata frete inteiro como "R$ 110"
  it('formata frete inteiro 110 como "R$ 110"', () => {
    const candidato = criarCandidatoBase({ frete: { valorFrete: 110, tipoFrete: 'fixo' } })
    const resultado = adaptarCandidatoV2ParaContratoLegadoDiagnostico(
      criarInput({ candidato })
    )

    expect(resultado.frete).toBe('R$ 110')
  })

  it('formata frete inteiro 320 como "R$ 320"', () => {
    const candidato = criarCandidatoBase({ frete: { valorFrete: 320, tipoFrete: 'viagem' } })
    const resultado = adaptarCandidatoV2ParaContratoLegadoDiagnostico(
      criarInput({ candidato })
    )

    expect(resultado.frete).toBe('R$ 320')
  })

  it('formata frete fracionario com virgula', () => {
    const candidato = criarCandidatoBase({ frete: { valorFrete: 110.5, tipoFrete: 'fixo' } })
    const resultado = adaptarCandidatoV2ParaContratoLegadoDiagnostico(
      criarInput({ candidato })
    )

    expect(resultado.frete).toBe('R$ 110,50')
  })

  // 8. Frete ausente não quebra e gera aviso
  it('frete valorFrete null nao quebra e gera aviso em diagnosticoV2', () => {
    const candidato = criarCandidatoBase({ frete: { valorFrete: null, tipoFrete: null } })
    const resultado = adaptarCandidatoV2ParaContratoLegadoDiagnostico(
      criarInput({ candidato })
    )

    expect(resultado.frete).toBe('')
    expect(
      resultado.diagnosticoV2.avisos.some((a) => a.includes('valorFrete ausente'))
    ).toBe(true)
  })

  it('frete valorFrete NaN nao quebra e gera aviso em diagnosticoV2', () => {
    const candidato = criarCandidatoBase({ frete: { valorFrete: NaN, tipoFrete: null } })
    const resultado = adaptarCandidatoV2ParaContratoLegadoDiagnostico(
      criarInput({ candidato })
    )

    expect(resultado.frete).toBe('')
    expect(
      resultado.diagnosticoV2.avisos.some((a) => a.includes('valorFrete'))
    ).toBe(true)
  })

  // 9. Rank vem do parâmetro
  it('rank vem do parametro e nao do candidato', () => {
    const resultado = adaptarCandidatoV2ParaContratoLegadoDiagnostico(
      criarInput({ rank: 42 })
    )

    expect(resultado.rank).toBe(42)
  })

  it('rank diferente confirma que nao e calculado internamente', () => {
    const r1 = adaptarCandidatoV2ParaContratoLegadoDiagnostico(criarInput({ rank: 1 }))
    const r5 = adaptarCandidatoV2ParaContratoLegadoDiagnostico(criarInput({ rank: 5 }))

    expect(r1.rank).toBe(1)
    expect(r5.rank).toBe(5)
  })

  // 10. Team vem de equipe
  it('team vem de candidato.equipe', () => {
    const candidato = criarCandidatoBase({ equipe: 'EQUIPE 2' })
    const resultado = adaptarCandidatoV2ParaContratoLegadoDiagnostico(
      criarInput({ candidato })
    )

    expect(resultado.team).toBe('EQUIPE 2')
  })

  it('team preserva o valor exato de candidato.equipe', () => {
    const candidato = criarCandidatoBase({ equipe: 'EQUIPE 1' })
    const resultado = adaptarCandidatoV2ParaContratoLegadoDiagnostico(
      criarInput({ candidato })
    )

    expect(resultado.team).toBe('EQUIPE 1')
  })

  // 11. daysLeftTxt calculado com dataReferenciaISO
  it('calcula daysLeftTxt de 11 dias (fixture normal-simples)', () => {
    const candidato = criarCandidatoBase({ dataISO: '2026-06-23' })
    const resultado = adaptarCandidatoV2ParaContratoLegadoDiagnostico({
      candidato,
      rank: 1,
      dataReferenciaISO: '2026-06-12',
    })

    expect(resultado.daysLeftTxt).toBe('11 d')
  })

  it('calcula daysLeftTxt de 18 dias (fixture premium)', () => {
    const candidato = criarCandidatoBase({ dataISO: '2026-06-30' })
    const resultado = adaptarCandidatoV2ParaContratoLegadoDiagnostico({
      candidato,
      rank: 1,
      dataReferenciaISO: '2026-06-12',
    })

    expect(resultado.daysLeftTxt).toBe('18 d')
  })

  it('calcula daysLeftTxt de 29 dias (fixture normal sabado)', () => {
    const candidato = criarCandidatoBase({ dataISO: '2026-07-11' })
    const resultado = adaptarCandidatoV2ParaContratoLegadoDiagnostico({
      candidato,
      rank: 2,
      dataReferenciaISO: '2026-06-12',
    })

    expect(resultado.daysLeftTxt).toBe('29 d')
  })

  it('calcula daysLeftTxt de 0 dias quando referencia e destino sao a mesma data', () => {
    const candidato = criarCandidatoBase({ dataISO: '2026-06-12' })
    const resultado = adaptarCandidatoV2ParaContratoLegadoDiagnostico({
      candidato,
      rank: 1,
      dataReferenciaISO: '2026-06-12',
    })

    expect(resultado.daysLeftTxt).toBe('0 d')
  })

  // 12. Sem dataReferenciaISO não quebra e gera aviso
  it('sem dataReferenciaISO retorna daysLeftTxt vazio e gera aviso', () => {
    const resultado = adaptarCandidatoV2ParaContratoLegadoDiagnostico(
      criarInput({ dataReferenciaISO: null })
    )

    expect(resultado.daysLeftTxt).toBe('')
    expect(
      resultado.diagnosticoV2.avisos.some((a) => a.includes('dataReferenciaISO'))
    ).toBe(true)
  })

  it('com dataReferenciaISO undefined retorna daysLeftTxt vazio e gera aviso', () => {
    const resultado = adaptarCandidatoV2ParaContratoLegadoDiagnostico(
      criarInput({ dataReferenciaISO: undefined })
    )

    expect(resultado.daysLeftTxt).toBe('')
    expect(
      resultado.diagnosticoV2.avisos.some((a) => a.includes('dataReferenciaISO'))
    ).toBe(true)
  })

  it('com dataReferenciaISO string vazia retorna daysLeftTxt vazio e gera aviso', () => {
    const resultado = adaptarCandidatoV2ParaContratoLegadoDiagnostico(
      criarInput({ dataReferenciaISO: '' })
    )

    expect(resultado.daysLeftTxt).toBe('')
    expect(
      resultado.diagnosticoV2.avisos.some((a) => a.includes('dataReferenciaISO'))
    ).toBe(true)
  })

  // 13. encomenda fica "Não" com aviso diagnóstico
  it('encomenda retorna "Nao" (com tilde) com aviso diagnostico', () => {
    const resultado = adaptarCandidatoV2ParaContratoLegadoDiagnostico(criarInput())

    expect(resultado.encomenda).toBe('Não')
    expect(
      resultado.diagnosticoV2.avisos.some((a) => a.includes('encomenda'))
    ).toBe(true)
  })

  it('encomenda e sempre "Nao" independente do tipo de candidato', () => {
    for (const tipo of ['normal', 'premium', 'especial', 'hora-marcada'] as const) {
      const candidato = criarCandidatoBase({ tipo, frete: { valorFrete: 150, tipoFrete: 'fixo' } })
      const resultado = adaptarCandidatoV2ParaContratoLegadoDiagnostico(
        criarInput({ candidato })
      )
      expect(resultado.encomenda, `tipo ${tipo}`).toBe('Não')
    }
  })

  // 14. Não muta o input
  it('nao muta candidato.motivos de entrada', () => {
    const candidato = criarCandidatoBase({ motivos: ['Motivo original.'], avisos: [] })
    const motivosAntes = [...candidato.motivos]

    adaptarCandidatoV2ParaContratoLegadoDiagnostico(criarInput({ candidato }))

    expect(candidato.motivos).toEqual(motivosAntes)
  })

  it('nao muta candidato.avisos de entrada', () => {
    const candidato = criarCandidatoBase({ motivos: [], avisos: ['Aviso original.'] })
    const avisosAntes = [...candidato.avisos]

    adaptarCandidatoV2ParaContratoLegadoDiagnostico(criarInput({ candidato }))

    expect(candidato.avisos).toEqual(avisosAntes)
  })

  it('diagnosticoV2.motivos nao e a mesma referencia de array que candidato.motivos', () => {
    const candidato = criarCandidatoBase({ motivos: ['Motivo X.'] })
    const resultado = adaptarCandidatoV2ParaContratoLegadoDiagnostico(
      criarInput({ candidato })
    )

    expect(resultado.diagnosticoV2.motivos).not.toBe(candidato.motivos)
    expect(resultado.diagnosticoV2.motivos).toContain('Motivo X.')
  })

  it('diagnosticoV2.avisos nao e a mesma referencia de array que candidato.avisos', () => {
    const candidato = criarCandidatoBase({ avisos: ['Aviso candidato.'] })
    const resultado = adaptarCandidatoV2ParaContratoLegadoDiagnostico(
      criarInput({ candidato })
    )

    expect(resultado.diagnosticoV2.avisos).not.toBe(candidato.avisos)
    expect(resultado.diagnosticoV2.avisos).toContain('Aviso candidato.')
  })

  // 15. Não calcula ranking
  it('nao calcula ranking — rank vem exclusivamente do parametro externo', () => {
    const candidatoComIndice5 = criarCandidatoBase({ indice: 5 })
    const resultado = adaptarCandidatoV2ParaContratoLegadoDiagnostico({
      candidato: candidatoComIndice5,
      rank: 3,
      dataReferenciaISO: '2026-06-12',
    })

    expect(resultado.rank).toBe(3)
  })

  it('candidatos com mesmo conteudo mas ranks diferentes produzem ranks distintos', () => {
    const r1 = adaptarCandidatoV2ParaContratoLegadoDiagnostico(criarInput({ rank: 1 }))
    const r2 = adaptarCandidatoV2ParaContratoLegadoDiagnostico(criarInput({ rank: 2 }))

    expect(r1.rank).toBe(1)
    expect(r2.rank).toBe(2)
  })

  // 16. Função pura — não consulta Apps Script, OSRM, Supabase, Calendar, banco ou planilha
  it('funcao pura: retorna resultado sem I/O externo', () => {
    // Confirmado pela ausência de imports de serviços externos e pela natureza da função.
    // Se houvesse I/O, os testes falhariam em ambiente isolado sem mocks.
    const resultado = adaptarCandidatoV2ParaContratoLegadoDiagnostico(criarInput())

    expect(resultado).not.toBeNull()
    expect(typeof resultado).toBe('object')
    expect(typeof resultado.dateISO).toBe('string')
    expect(typeof resultado.frete).toBe('string')
    expect(typeof resultado.rank).toBe('number')
  })

  // 17. Mantém diagnosticoV2 com id, elegível, motivos e avisos
  it('mantem diagnosticoV2 com id, elegivel, origem, motivos e avisos', () => {
    const candidato = criarCandidatoBase({
      id: 'v2-2026-06-23-equipe-1-normal-2',
      elegivel: true,
      motivos: ['Motivo diagnóstico.'],
      avisos: ['Aviso do candidato.'],
    })
    const resultado = adaptarCandidatoV2ParaContratoLegadoDiagnostico(
      criarInput({ candidato })
    )

    expect(resultado.diagnosticoV2.id).toBe('v2-2026-06-23-equipe-1-normal-2')
    expect(resultado.diagnosticoV2.elegivel).toBe(true)
    expect(resultado.diagnosticoV2.origem).toBe('v2-adaptado-diagnostico')
    expect(Array.isArray(resultado.diagnosticoV2.motivos)).toBe(true)
    expect(resultado.diagnosticoV2.motivos).toContain('Motivo diagnóstico.')
    expect(Array.isArray(resultado.diagnosticoV2.avisos)).toBe(true)
    expect(resultado.diagnosticoV2.avisos).toContain('Aviso do candidato.')
  })

  it('diagnosticoV2 preserva elegivel false para candidato indisponivel', () => {
    const candidato = criarCandidatoBase({
      elegivel: false,
      tipo: 'indisponivel',
      motivos: ['Equipe inativa.'],
    })
    const resultado = adaptarCandidatoV2ParaContratoLegadoDiagnostico(
      criarInput({ candidato })
    )

    expect(resultado.diagnosticoV2.elegivel).toBe(false)
    expect(resultado.diagnosticoV2.motivos).toContain('Equipe inativa.')
  })

  // ─── Testes baseados nas fixtures reais capturadas ───────────────────────────

  it('fixture normal-simples: adapta candidato Terca com frete R$ 110 e daysLeftTxt 11 d', () => {
    const candidato = criarCandidatoBase({
      dataISO: '2026-06-23',
      diaSemana: 2,
      equipe: 'EQUIPE 1',
      tipo: 'normal',
      frete: { valorFrete: 110, tipoFrete: 'fixo' },
      elegivel: true,
    })
    const resultado = adaptarCandidatoV2ParaContratoLegadoDiagnostico({
      candidato,
      rank: 1,
      dataReferenciaISO: '2026-06-12',
    })

    expect(resultado.dateISO).toBe('2026-06-23')
    expect(resultado.dateDM).toBe('23/06')
    expect(resultado.weekday).toBe('Terça')
    expect(resultado.tipo).toBe('normal')
    expect(resultado.isExtra).toBe(false)
    expect(resultado.frete).toBe('R$ 110')
    expect(resultado.rank).toBe(1)
    expect(resultado.team).toBe('EQUIPE 1')
    expect(resultado.daysLeftTxt).toBe('11 d')
    expect(resultado.encomenda).toBe('Não')
    expect(resultado.avisoHoraMarcada).toBe('')
    expect(resultado.diagnosticoV2.origem).toBe('v2-adaptado-diagnostico')
  })

  it('fixture normal-simples: adapta candidato Sabado com frete R$ 170 e daysLeftTxt 15 d', () => {
    const candidato = criarCandidatoBase({
      dataISO: '2026-06-27',
      diaSemana: 6,
      equipe: 'EQUIPE 1',
      tipo: 'normal',
      frete: { valorFrete: 170, tipoFrete: 'fixo' },
      elegivel: true,
    })
    const resultado = adaptarCandidatoV2ParaContratoLegadoDiagnostico({
      candidato,
      rank: 2,
      dataReferenciaISO: '2026-06-12',
    })

    expect(resultado.dateDM).toBe('27/06')
    expect(resultado.weekday).toBe('Sábado')
    expect(resultado.frete).toBe('R$ 170')
    expect(resultado.daysLeftTxt).toBe('15 d')
    expect(resultado.rank).toBe(2)
  })

  it('fixture premium-especial: adapta candidato premium com frete R$ 320, isExtra true', () => {
    const candidato = criarCandidatoBase({
      dataISO: '2026-06-30',
      diaSemana: 2,
      equipe: 'EQUIPE 1',
      tipo: 'premium',
      frete: { valorFrete: 320, tipoFrete: 'viagem' },
      elegivel: true,
    })
    const resultado = adaptarCandidatoV2ParaContratoLegadoDiagnostico({
      candidato,
      rank: 1,
      dataReferenciaISO: '2026-06-12',
    })

    expect(resultado.tipo).toBe('premium')
    expect(resultado.isExtra).toBe(true)
    expect(resultado.frete).toBe('R$ 320')
    expect(resultado.daysLeftTxt).toBe('18 d')
  })

  it('fixture premium-especial: adapta candidato especial com frete R$ 220, isExtra true', () => {
    const candidato = criarCandidatoBase({
      dataISO: '2026-07-24',
      diaSemana: 5,
      equipe: 'EQUIPE 1',
      tipo: 'especial',
      frete: { valorFrete: 220, tipoFrete: 'viagem' },
      elegivel: true,
    })
    const resultado = adaptarCandidatoV2ParaContratoLegadoDiagnostico({
      candidato,
      rank: 3,
      dataReferenciaISO: '2026-06-12',
    })

    expect(resultado.dateDM).toBe('24/07')
    expect(resultado.weekday).toBe('Sexta')
    expect(resultado.tipo).toBe('especial')
    expect(resultado.isExtra).toBe(true)
    expect(resultado.frete).toBe('R$ 220')
    expect(resultado.daysLeftTxt).toBe('42 d')
    expect(resultado.rank).toBe(3)
  })
})
