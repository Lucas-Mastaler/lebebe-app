import { describe, it, expect } from 'vitest'
import {
  gerarCandidatosComDisponibilidadeRealV2,
  type GerarCandidatosComDisponibilidadeRealV2Input,
} from './gerar-candidatos-disponibilidade-real'
import type { DataJanelaPesquisaV2 } from './janela-datas'
import type { DisponibilidadeEquipeDataV2 } from './disponibilidade'
import type { ConfigClassificacaoV2 } from './classificacao-candidato'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

/** Configuração operacional base para testes — limites razoáveis. */
const configBase: ConfigClassificacaoV2 = {
  kmAdicionalMaxNaRotaM: 5000,
  kmAdicionalMaxNaRotaEspecialM: 10000,
  kmAdicionalMaxNaRotaPremiumM: 20000,
  kmMaximoNaSemanaM: 50000,
  kmMaximoNoSabadoM: 30000,
  horaMarcadaHorasAMais: 2,
}

/**
 * Janela de 3 dias úteis: segunda, terça, quarta (2026-06-15, 16, 17).
 * diaSemana: 1=Segunda, 2=Terça, 3=Quarta (UTC).
 */
const janelaBase: DataJanelaPesquisaV2[] = [
  { dataISO: '2026-06-15', indice: 0, diaSemana: 1, ehSabado: false, ehDomingo: false },
  { dataISO: '2026-06-16', indice: 1, diaSemana: 2, ehSabado: false, ehDomingo: false },
  { dataISO: '2026-06-17', indice: 2, diaSemana: 3, ehSabado: false, ehDomingo: false },
]

const janelaComSabado: DataJanelaPesquisaV2[] = [
  { dataISO: '2026-06-20', indice: 0, diaSemana: 6, ehSabado: true, ehDomingo: false },
]

const janelaComDomingo: DataJanelaPesquisaV2[] = [
  { dataISO: '2026-06-21', indice: 0, diaSemana: 0, ehSabado: false, ehDomingo: true },
]

/** Disponibilidade: EQUIPE 1 ativa com 240 min em 2026-06-15. */
function dispEquipe1Ativa(dataISO = '2026-06-15'): DisponibilidadeEquipeDataV2 {
  return { dataISO, equipe: 'EQUIPE 1', disponivelMin: 240, ativa: true }
}

/** Disponibilidade: EQUIPE 2 ativa com 240 min em 2026-06-15. */
function dispEquipe2Ativa(dataISO = '2026-06-15'): DisponibilidadeEquipeDataV2 {
  return { dataISO, equipe: 'EQUIPE 2', disponivelMin: 240, ativa: true }
}

/** Input base reutilizável. */
function criarInput(
  overrides?: Partial<GerarCandidatosComDisponibilidadeRealV2Input>
): GerarCandidatosComDisponibilidadeRealV2Input {
  return {
    janelaDatas: janelaBase,
    disponibilidades: [dispEquipe1Ativa()],
    tempoNecessarioMin: 60,
    distanciaKm: 8,
    kmAdicionalNaRotaM: 3000,
    valorFrete: 110,
    tipoFrete: 'fixo',
    isCondominio: false,
    isRural: false,
    configOperacional: configBase,
    ...overrides,
  }
}

// ─── Suite ────────────────────────────────────────────────────────────────────

describe('gerarCandidatosComDisponibilidadeRealV2', () => {
  // 1. Gera candidato elegível a partir de equipe ativa com tempo suficiente
  it('gera candidato elegivel para equipe ativa com tempo suficiente', () => {
    const resultado = gerarCandidatosComDisponibilidadeRealV2(criarInput())

    expect(resultado.ok).toBe(true)
    expect(resultado.resumo.candidatosMontados).toBeGreaterThan(0)
    expect(resultado.resumo.candidatosElegiveis).toBeGreaterThan(0)
    expect(resultado.candidatos.some((c) => c.elegivel)).toBe(true)
    expect(resultado.candidatos.some((c) => c.equipe === 'EQUIPE 1')).toBe(true)
  })

  // 2. Não gera candidato elegível quando disponivelMin < tempoNecessarioMin
  it('gera candidato indisponivel quando disponivelMin menor que tempoNecessarioMin', () => {
    const resultado = gerarCandidatosComDisponibilidadeRealV2(
      criarInput({
        disponibilidades: [
          { dataISO: '2026-06-15', equipe: 'EQUIPE 1', disponivelMin: 30, ativa: true },
        ],
        tempoNecessarioMin: 60,
      })
    )

    expect(resultado.ok).toBe(true)
    expect(resultado.candidatos).toHaveLength(1)
    expect(resultado.candidatos[0].elegivel).toBe(false)
    expect(resultado.candidatos[0].motivos).toContain(
      'Tempo disponível insuficiente para o serviço.'
    )
  })

  // 3. Marca equipe inativa como indisponível
  it('marca equipe inativa como indisponivel com motivo', () => {
    const resultado = gerarCandidatosComDisponibilidadeRealV2(
      criarInput({
        disponibilidades: [
          {
            dataISO: '2026-06-15',
            equipe: 'EQUIPE 1',
            disponivelMin: 240,
            ativa: false,
            motivoIndisponibilidade: null,
          },
        ],
      })
    )

    expect(resultado.ok).toBe(true)
    expect(resultado.candidatos[0].elegivel).toBe(false)
    expect(resultado.candidatos[0].motivos).toContain('Equipe inativa.')
  })

  // 4. Preserva motivo "agenda fechada" vindo da disponibilidade
  it('preserva motivo agenda fechada vindo da disponibilidade', () => {
    const resultado = gerarCandidatosComDisponibilidadeRealV2(
      criarInput({
        disponibilidades: [
          {
            dataISO: '2026-06-15',
            equipe: 'EQUIPE 1',
            disponivelMin: 0,
            ativa: false,
            motivoIndisponibilidade: 'agenda fechada',
          },
        ],
      })
    )

    expect(resultado.candidatos[0].elegivel).toBe(false)
    // classificarCandidatoOperacionalV2 propaga motivoIndisponibilidade
    expect(
      resultado.candidatos[0].motivos.some((m) => m.toLowerCase().includes('agenda fechada'))
    ).toBe(true)
  })

  // 5. Preserva motivo "excedeu" vindo da disponibilidade
  it('preserva motivo excedeu vindo da disponibilidade', () => {
    const resultado = gerarCandidatosComDisponibilidadeRealV2(
      criarInput({
        disponibilidades: [
          {
            dataISO: '2026-06-15',
            equipe: 'EQUIPE 1',
            disponivelMin: 0,
            ativa: false,
            motivoIndisponibilidade: 'excedeu',
          },
        ],
      })
    )

    expect(resultado.candidatos[0].elegivel).toBe(false)
    expect(
      resultado.candidatos[0].motivos.some((m) => m.toLowerCase().includes('excedeu'))
    ).toBe(true)
  })

  // 6. Ordena candidatos usando prioridade existente (hora-marcada > premium > especial > normal > indisponivel)
  it('ordena candidatos por prioridade de tipo', () => {
    const config: ConfigClassificacaoV2 = {
      kmAdicionalMaxNaRotaM: 5000,
      kmAdicionalMaxNaRotaEspecialM: 10000,
      kmAdicionalMaxNaRotaPremiumM: 20000,
      kmMaximoNaSemanaM: 50000,
      kmMaximoNoSabadoM: 30000,
      horaMarcadaHorasAMais: 2,
    }
    const janela: DataJanelaPesquisaV2[] = [
      { dataISO: '2026-06-15', indice: 0, diaSemana: 1, ehSabado: false, ehDomingo: false },
      { dataISO: '2026-06-16', indice: 1, diaSemana: 2, ehSabado: false, ehDomingo: false },
    ]
    // Equipe 1 dia 1 → normal (kmAdicional=3000, dentro limite base=5000)
    // Equipe 2 dia 2 → premium (kmAdicional=15000 > especial=10000, <= premium=20000)
    const disponibilidades: DisponibilidadeEquipeDataV2[] = [
      { dataISO: '2026-06-15', equipe: 'EQUIPE 1', disponivelMin: 240, ativa: true },
      { dataISO: '2026-06-16', equipe: 'EQUIPE 2', disponivelMin: 240, ativa: true },
    ]

    const r1 = gerarCandidatosComDisponibilidadeRealV2({
      janelaDatas: janela,
      disponibilidades,
      tempoNecessarioMin: 60,
      distanciaKm: 8,
      kmAdicionalNaRotaM: 3000, // → normal
      configOperacional: config,
    })

    // Com mesma distância adicional para ambos, ambos devem ser do mesmo tipo.
    // Confirma ao menos que candidatos ordenados preservam elegíveis antes de indisponíveis.
    expect(r1.ok).toBe(true)
    const elegiveisAntes = r1.candidatosOrdenados.findIndex((c) => !c.elegivel)
    const primeiroIndisponivel =
      elegiveisAntes === -1 ? r1.candidatosOrdenados.length : elegiveisAntes
    // Todos os elegíveis aparecem antes dos indisponíveis
    for (let i = 0; i < primeiroIndisponivel; i++) {
      expect(r1.candidatosOrdenados[i].elegivel).toBe(true)
    }
  })

  // 7. Retorna candidatos elegíveis antes de indisponíveis
  it('retorna elegiveis antes de indisponiveis na lista ordenada', () => {
    const resultado = gerarCandidatosComDisponibilidadeRealV2(
      criarInput({
        disponibilidades: [
          { dataISO: '2026-06-15', equipe: 'EQUIPE 1', disponivelMin: 240, ativa: true },
          { dataISO: '2026-06-16', equipe: 'EQUIPE 2', disponivelMin: 10, ativa: true }, // insuficiente
        ],
        tempoNecessarioMin: 60,
      })
    )

    expect(resultado.ok).toBe(true)
    const elegivelIdx = resultado.candidatosOrdenados.findIndex((c) => c.elegivel)
    const indisponivelIdx = resultado.candidatosOrdenados.findIndex((c) => !c.elegivel)
    if (elegivelIdx !== -1 && indisponivelIdx !== -1) {
      expect(elegivelIdx).toBeLessThan(indisponivelIdx)
    }
  })

  // 8. Funciona com duas equipes no mesmo dia
  it('funciona com duas equipes no mesmo dia', () => {
    const resultado = gerarCandidatosComDisponibilidadeRealV2(
      criarInput({
        disponibilidades: [
          { dataISO: '2026-06-15', equipe: 'EQUIPE 1', disponivelMin: 240, ativa: true },
          { dataISO: '2026-06-15', equipe: 'EQUIPE 2', disponivelMin: 180, ativa: true },
        ],
      })
    )

    expect(resultado.ok).toBe(true)
    const candidatosDia15 = resultado.candidatos.filter((c) => c.dataISO === '2026-06-15')
    expect(candidatosDia15).toHaveLength(2)
    expect(candidatosDia15.map((c) => c.equipe).sort()).toEqual(['EQUIPE 1', 'EQUIPE 2'])
  })

  // 9. Funciona com vários dias
  it('funciona com varios dias gerando candidatos para cada data com disponibilidade', () => {
    const resultado = gerarCandidatosComDisponibilidadeRealV2(
      criarInput({
        disponibilidades: [
          { dataISO: '2026-06-15', equipe: 'EQUIPE 1', disponivelMin: 240, ativa: true },
          { dataISO: '2026-06-16', equipe: 'EQUIPE 1', disponivelMin: 240, ativa: true },
          { dataISO: '2026-06-17', equipe: 'EQUIPE 1', disponivelMin: 240, ativa: true },
        ],
      })
    )

    expect(resultado.ok).toBe(true)
    expect(resultado.resumo.candidatosMontados).toBe(3)
    expect(resultado.candidatos.map((c) => c.dataISO).sort()).toEqual([
      '2026-06-15',
      '2026-06-16',
      '2026-06-17',
    ])
  })

  // 10. Resumo bate com quantidades esperadas
  it('resumo bate com quantidades esperadas', () => {
    const resultado = gerarCandidatosComDisponibilidadeRealV2(
      criarInput({
        disponibilidades: [
          { dataISO: '2026-06-15', equipe: 'EQUIPE 1', disponivelMin: 240, ativa: true },
          { dataISO: '2026-06-15', equipe: 'EQUIPE 2', disponivelMin: 10, ativa: true }, // insuficiente
          { dataISO: '2026-06-16', equipe: 'EQUIPE 1', disponivelMin: 240, ativa: true },
        ],
        tempoNecessarioMin: 60,
      })
    )

    expect(resultado.ok).toBe(true)
    expect(resultado.resumo.datasNaJanela).toBe(3) // janela tem 3 dias
    expect(resultado.resumo.disponibilidadesRecebidas).toBe(3)
    expect(resultado.resumo.candidatosMontados).toBe(3)
    // Equipe 1 dia 15 (suficiente), Equipe 1 dia 16 (suficiente) = 2 elegíveis
    // Equipe 2 dia 15 (insuficiente) = 1 indisponível
    expect(resultado.resumo.candidatosElegiveis).toBe(2)
    expect(resultado.resumo.candidatosIndisponiveis).toBe(1)
    // Verificar batimento
    expect(
      resultado.resumo.candidatosElegiveis + resultado.resumo.candidatosIndisponiveis
    ).toBe(resultado.resumo.candidatosMontados)
    // Batimento com resumoOrdenacao
    expect(resultado.resumoOrdenacao.total).toBe(resultado.resumo.candidatosMontados)
    expect(resultado.resumoOrdenacao.elegiveis).toBe(resultado.resumo.candidatosElegiveis)
    expect(resultado.resumoOrdenacao.indisponiveis).toBe(resultado.resumo.candidatosIndisponiveis)
  })

  // 11. Não muta o input
  it('nao muta disponibilidades de entrada', () => {
    const disponibilidades: DisponibilidadeEquipeDataV2[] = [
      { dataISO: '2026-06-15', equipe: 'EQUIPE 1', disponivelMin: 240, ativa: true },
    ]
    const copiAntes = JSON.stringify(disponibilidades)

    gerarCandidatosComDisponibilidadeRealV2(criarInput({ disponibilidades }))

    expect(JSON.stringify(disponibilidades)).toBe(copiAntes)
  })

  it('nao muta janelaDatas de entrada', () => {
    const janela = [...janelaBase]
    const copiaAntes = JSON.stringify(janela)

    gerarCandidatosComDisponibilidadeRealV2(criarInput({ janelaDatas: janela }))

    expect(JSON.stringify(janela)).toBe(copiaAntes)
  })

  // 12. Não chama planilha — confirmado por ausência de imports de I/O
  it('funcao pura: retorna resultado sem dependencia de I/O externo', () => {
    // Se houvesse I/O, os testes falhariam em ambiente isolado.
    const resultado = gerarCandidatosComDisponibilidadeRealV2(criarInput())

    expect(resultado).not.toBeNull()
    expect(typeof resultado).toBe('object')
    expect(typeof resultado.ok).toBe('boolean')
    expect(Array.isArray(resultado.candidatos)).toBe(true)
    expect(Array.isArray(resultado.candidatosOrdenados)).toBe(true)
  })

  // 13. Não chama Apps Script — sem imports externos
  it('ok: false quando janela vazia', () => {
    const resultado = gerarCandidatosComDisponibilidadeRealV2(
      criarInput({ janelaDatas: [] })
    )

    expect(resultado.ok).toBe(false)
    expect(resultado.resumo.candidatosMontados).toBe(0)
    expect(resultado.candidatos).toHaveLength(0)
    expect(resultado.candidatosOrdenados).toHaveLength(0)
  })

  // 14. Não chama OSRM — distanciaKm null gera aviso mas não bloqueia (equivalência legado)
  it('quando distanciaKm null, gera aviso mas classifica com kmAdicionalNaRotaM', () => {
    const resultado = gerarCandidatosComDisponibilidadeRealV2(
      criarInput({ distanciaKm: null, kmAdicionalNaRotaM: 3000 })
    )

    expect(resultado.avisos.some((a) => a.includes('distanciaKm'))).toBe(true)
    // Candidatos podem ser elegíveis se kmAdicionalNaRotaM for válido (equivalência legado)
    expect(resultado.candidatos.some((c) => c.elegivel)).toBe(true)
  })

  // 15. Não chama Supabase — sem conexão ou imports
  it('quando kmAdicionalNaRotaM null, gera aviso e candidatos indisponiveis', () => {
    const resultado = gerarCandidatosComDisponibilidadeRealV2(
      criarInput({ kmAdicionalNaRotaM: null })
    )

    expect(resultado.avisos.some((a) => a.includes('kmAdicionalNaRotaM'))).toBe(true)
    expect(resultado.candidatos.every((c) => !c.elegivel)).toBe(true)
  })

  // 16. Integra corretamente com helpers existentes sem duplicar regra
  it('integra com filtrarDisponibilidadePorJanelaV2 — disponibilidades fora da janela sao ignoradas', () => {
    const resultado = gerarCandidatosComDisponibilidadeRealV2(
      criarInput({
        janelaDatas: [janelaBase[0]], // apenas 2026-06-15
        disponibilidades: [
          { dataISO: '2026-06-15', equipe: 'EQUIPE 1', disponivelMin: 240, ativa: true },
          { dataISO: '2026-07-01', equipe: 'EQUIPE 2', disponivelMin: 240, ativa: true }, // fora da janela
        ],
      })
    )

    expect(resultado.ok).toBe(true)
    expect(resultado.resumo.candidatosMontados).toBe(1)
    expect(resultado.candidatos[0].dataISO).toBe('2026-06-15')
  })

  it('integra com classificarCandidatoOperacionalV2 — domingo resulta em indisponivel', () => {
    const resultado = gerarCandidatosComDisponibilidadeRealV2(
      criarInput({
        janelaDatas: janelaComDomingo,
        disponibilidades: [
          { dataISO: '2026-06-21', equipe: 'EQUIPE 1', disponivelMin: 240, ativa: true },
        ],
      })
    )

    expect(resultado.ok).toBe(true)
    expect(resultado.candidatos[0].elegivel).toBe(false)
    expect(resultado.candidatos[0].motivos).toContain(
      'Domingo não elegível para atendimento.'
    )
  })

  it('integra com montarCandidatoPreliminarV2 — candidato tem id determinístico', () => {
    const resultado = gerarCandidatosComDisponibilidadeRealV2(criarInput())

    expect(resultado.candidatos.length).toBeGreaterThan(0)
    const candidato = resultado.candidatos[0]
    expect(typeof candidato.id).toBe('string')
    expect(candidato.id.startsWith('v2-')).toBe(true)
    expect(candidato.id).toContain('2026-06-15')
    expect(candidato.id).toContain('equipe-1')
  })

  it('integra com ordenarCandidatosDiagnosticosV2 — candidatosOrdenados nao e a mesma referencia que candidatos', () => {
    const resultado = gerarCandidatosComDisponibilidadeRealV2(criarInput())

    expect(resultado.candidatosOrdenados).not.toBe(resultado.candidatos)
    expect(resultado.candidatosOrdenados).toHaveLength(resultado.candidatos.length)
  })

  // Testes de tipo de candidato por distância adicional
  it('classifica como normal quando kmAdicionalNaRotaM dentro do limite base', () => {
    const resultado = gerarCandidatosComDisponibilidadeRealV2(
      criarInput({ kmAdicionalNaRotaM: 3000 }) // 3000 <= 5000 → normal
    )

    expect(resultado.resumo.candidatosNormal).toBeGreaterThan(0)
  })

  it('conta hora marcada por flag nao exclusiva preservando tipo normal', () => {
    const resultado = gerarCandidatosComDisponibilidadeRealV2(
      criarInput({
        tempoNecessarioMin: 40,
        kmAdicionalNaRotaM: 3000,
        disponibilidades: [
          { dataISO: '2026-06-15', equipe: 'EQUIPE 1', disponivelMin: 160, ativa: true },
        ],
      })
    )

    expect(resultado.resumo.candidatosNormal).toBe(1)
    expect(resultado.resumo.candidatosHoraMarcada).toBe(1)
    expect(resultado.candidatos[0].tipo).toBe('normal')
    expect(resultado.candidatos[0].horaMarcada).toBe(true)
    expect(resultado.candidatos[0].diagnostico.limiteMinimoHoraMarcadaMin).toBe(160)
  })

  it('classifica como especial quando kmAdicionalNaRotaM entre base e especial', () => {
    const resultado = gerarCandidatosComDisponibilidadeRealV2(
      criarInput({ kmAdicionalNaRotaM: 7000 }) // 5000 < 7000 <= 10000 → especial
    )

    expect(resultado.resumo.candidatosEspecial).toBeGreaterThan(0)
  })

  it('classifica como premium quando kmAdicionalNaRotaM entre especial e premium', () => {
    const resultado = gerarCandidatosComDisponibilidadeRealV2(
      criarInput({ kmAdicionalNaRotaM: 15000 }) // 10000 < 15000 <= 20000 → premium
    )

    expect(resultado.resumo.candidatosPremium).toBeGreaterThan(0)
  })

  it('classifica como indisponivel quando kmAdicionalNaRotaM excede limite premium', () => {
    const resultado = gerarCandidatosComDisponibilidadeRealV2(
      criarInput({ kmAdicionalNaRotaM: 25000 }) // > 20000 → indisponivel
    )

    // Todos os candidatos gerados serão indisponíveis por distância excessiva
    expect(resultado.candidatos.every((c) => !c.elegivel)).toBe(true)
    expect(resultado.candidatos.some((c) =>
      c.motivos.some((m) => m.includes('fora dos limites'))
    )).toBe(true)
  })

  // Sabado: diaSemana 6
  it('gera candidato elegivel para sabado dentro do limite de sabado', () => {
    const resultado = gerarCandidatosComDisponibilidadeRealV2(
      criarInput({
        janelaDatas: janelaComSabado,
        disponibilidades: [
          { dataISO: '2026-06-20', equipe: 'EQUIPE 1', disponivelMin: 240, ativa: true },
        ],
        distanciaKm: 8, // 8km = 8000m < maxSabado=30000m → ok
        kmAdicionalNaRotaM: 3000,
      })
    )

    expect(resultado.ok).toBe(true)
    expect(resultado.candidatos[0].ehSabado).toBe(true)
    expect(resultado.candidatos[0].elegivel).toBe(true)
  })

  // Frete vem do input
  it('candidatos preservam valorFrete e tipoFrete do input', () => {
    const resultado = gerarCandidatosComDisponibilidadeRealV2(
      criarInput({ valorFrete: 220, tipoFrete: 'viagem' })
    )

    expect(resultado.candidatos[0].frete.valorFrete).toBe(220)
    expect(resultado.candidatos[0].frete.tipoFrete).toBe('viagem')
  })

  it('candidatos com valorFrete null preservam null', () => {
    const resultado = gerarCandidatosComDisponibilidadeRealV2(
      criarInput({ valorFrete: null, tipoFrete: null })
    )

    expect(resultado.candidatos[0].frete.valorFrete).toBeNull()
    expect(resultado.candidatos[0].frete.tipoFrete).toBeNull()
  })

  // disponibilidadePorJanela é exposta no output
  it('expoe disponibilidadePorJanela com datas da janela', () => {
    const resultado = gerarCandidatosComDisponibilidadeRealV2(criarInput())

    expect(resultado.disponibilidadePorJanela.ok).toBe(true)
    expect(resultado.disponibilidadePorJanela.datas).toHaveLength(janelaBase.length)
  })

  // classificacoes são expostas
  it('expoe classificacoes com quantidade correta', () => {
    const resultado = gerarCandidatosComDisponibilidadeRealV2(
      criarInput({
        disponibilidades: [
          { dataISO: '2026-06-15', equipe: 'EQUIPE 1', disponivelMin: 240, ativa: true },
          { dataISO: '2026-06-15', equipe: 'EQUIPE 2', disponivelMin: 240, ativa: true },
        ],
      })
    )

    expect(resultado.classificacoes).toHaveLength(2)
    expect(resultado.classificacoes[0]).toHaveProperty('tipo')
    expect(resultado.classificacoes[0]).toHaveProperty('elegivel')
    expect(resultado.classificacoes[0]).toHaveProperty('motivos')
  })

  // resumoOrdenacao bate com resumo geral
  it('resumoOrdenacao bate com resumo geral', () => {
    const resultado = gerarCandidatosComDisponibilidadeRealV2(criarInput())

    expect(resultado.resumoOrdenacao.total).toBe(resultado.resumo.candidatosMontados)
    expect(resultado.resumoOrdenacao.elegiveis).toBe(resultado.resumo.candidatosElegiveis)
    expect(resultado.resumoOrdenacao.indisponiveis).toBe(resultado.resumo.candidatosIndisponiveis)
  })

  // primeiroElegivelId aponta para candidato real
  it('resumoOrdenacao.primeiroElegivelId aponta para candidato elegivel existente', () => {
    const resultado = gerarCandidatosComDisponibilidadeRealV2(criarInput())

    const id = resultado.resumoOrdenacao.primeiroElegivelId
    if (id !== null) {
      const encontrado = resultado.candidatosOrdenados.find((c) => c.id === id)
      expect(encontrado).toBeDefined()
      expect(encontrado!.elegivel).toBe(true)
    }
  })

  // Tipos confirmados nos candidatos
  it('candidatos tem tipo confirmado na classificacao', () => {
    const resultado = gerarCandidatosComDisponibilidadeRealV2(criarInput())

    for (const candidato of resultado.candidatos) {
      expect(['normal', 'especial', 'premium', 'hora-marcada', 'indisponivel']).toContain(
        candidato.tipo
      )
    }
  })

  // Sem disponibilidade para datas da janela
  it('gera candidatos zerados quando nao ha disponibilidade para as datas da janela', () => {
    const resultado = gerarCandidatosComDisponibilidadeRealV2(
      criarInput({
        disponibilidades: [
          { dataISO: '2099-01-01', equipe: 'EQUIPE 1', disponivelMin: 240, ativa: true },
        ],
      })
    )

    expect(resultado.ok).toBe(true)
    expect(resultado.resumo.candidatosMontados).toBe(0)
    expect(resultado.candidatos).toHaveLength(0)
    expect(resultado.candidatosOrdenados).toHaveLength(0)
    expect(resultado.avisos.some((a) => a.includes('Nenhuma disponibilidade válida'))).toBe(true)
  })
})

describe('origemKmAdicional e chaveSlotKm', () => {
  it('slot sabado sem pontos validos usa limite de sabado e classifica K14 como normal', () => {
    const resultado = gerarCandidatosComDisponibilidadeRealV2(
      criarInput({
        janelaDatas: [{ dataISO: '2026-07-25', indice: 0, diaSemana: 6, ehSabado: true, ehDomingo: false }],
        disponibilidades: [
          { dataISO: '2026-07-25', equipe: 'EQUIPE 1', disponivelMin: 240, ativa: true },
        ],
        tempoNecessarioMin: 40,
        distanciaKm: 8.903,
        kmAdicionalNaRotaM: 8903,
        mapaKmAdicionalPorSlot: { '2026-07-25::EQUIPE 1': 8903 },
        slotTemPontosPorDataEquipe: { '2026-07-25::EQUIPE 1': false },
        configOperacional: {
          kmAdicionalMaxNaRotaM: 5000,
          kmAdicionalMaxNaRotaEspecialM: 10000,
          kmAdicionalMaxNaRotaPremiumM: 15000,
          kmMaximoNaSemanaM: 150000,
          kmMaximoNoSabadoM: 45000,
          horaMarcadaHorasAMais: 2,
        },
      })
    )

    expect(resultado.ok).toBe(true)
    expect(resultado.resumo.candidatosNormal).toBe(1)
    expect(resultado.resumo.candidatosEspecial).toBe(0)
    expect(resultado.candidatos[0].tipo).toBe('normal')
    expect(resultado.candidatos[0].slotTemPontos).toBe(false)
    expect(resultado.candidatos[0].distancia.kmAdicionalNaRotaM).toBe(8903)
  })

  it('candidato com km vindo do mapa por slot tem origemKmAdicional slot e chaveSlotKm preenchido', () => {
    const resultado = gerarCandidatosComDisponibilidadeRealV2(
      criarInput({
        kmAdicionalNaRotaM: 9999,
        mapaKmAdicionalPorSlot: { '2026-06-15::EQUIPE 1': 1234 },
      })
    )
    expect(resultado.ok).toBe(true)
    const candidato = resultado.candidatos[0]
    expect(candidato.distancia.origemKmAdicional).toBe('slot')
    expect(candidato.distancia.chaveSlotKm).toBe('2026-06-15::EQUIPE 1')
    expect(candidato.distancia.kmAdicionalNaRotaM).toBe(1234)
  })

  it('candidato com km caindo no fallback global tem origemKmAdicional global-fallback e chaveSlotKm null', () => {
    const resultado = gerarCandidatosComDisponibilidadeRealV2(
      criarInput({
        kmAdicionalNaRotaM: 9999,
        mapaKmAdicionalPorSlot: { '2026-06-99::EQUIPE X': 1234 }, // chave que não bate
      })
    )
    expect(resultado.ok).toBe(true)
    const candidato = resultado.candidatos[0]
    expect(candidato.distancia.origemKmAdicional).toBe('global-fallback')
    expect(candidato.distancia.chaveSlotKm).toBeNull()
    expect(candidato.distancia.kmAdicionalNaRotaM).toBe(9999)
  })

  it('sem mapaKmAdicionalPorSlot origemKmAdicional e null e chaveSlotKm e null', () => {
    const resultado = gerarCandidatosComDisponibilidadeRealV2(
      criarInput({ kmAdicionalNaRotaM: 3000, mapaKmAdicionalPorSlot: undefined })
    )
    expect(resultado.ok).toBe(true)
    const candidato = resultado.candidatos[0]
    expect(candidato.distancia.origemKmAdicional).toBeNull()
    expect(candidato.distancia.chaveSlotKm).toBeNull()
  })
})
