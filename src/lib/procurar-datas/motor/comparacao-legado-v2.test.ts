import { describe, it, expect } from 'vitest'
import {
  compararFixtureLegadoComContratoV2,
  compararPayloadLegadoComV2Diagnostico,
  gerarComparacaoKeyV2Diagnostico,
} from './comparacao-legado-v2'
import fixtureNormalSimples from '../../../../docs/fixtures/procurar-datas/legado/caso-normal-simples-2026-06-12.json'
import fixturePremiumOuEspecial from '../../../../docs/fixtures/procurar-datas/legado/caso-premium-ou-especial-2026-06-12.json'

describe('compararFixtureLegadoComContratoV2', () => {
  // ── Fixture normal simples ─────────────────────────────────────────────────

  describe('fixture normal simples', () => {
    it('1. retorna ok: true', () => {
      const resultado = compararFixtureLegadoComContratoV2({
        nomeFixture: 'caso-normal-simples-2026-06-12',
        fixtureLegado: fixtureNormalSimples,
      })
      expect(resultado.ok).toBe(true)
      expect(resultado.diferencas).toHaveLength(0)
    })

    it('3. identifica payload.candidates com 3 candidatos', () => {
      const resultado = compararFixtureLegadoComContratoV2({
        nomeFixture: 'caso-normal-simples-2026-06-12',
        fixtureLegado: fixtureNormalSimples,
      })
      expect(resultado.resumo.quantidadePayloadCandidates).toBe(3)
    })

    it('4. identifica progress.normais com 3 candidatos', () => {
      const resultado = compararFixtureLegadoComContratoV2({
        nomeFixture: 'caso-normal-simples-2026-06-12',
        fixtureLegado: fixtureNormalSimples,
      })
      expect(resultado.resumo.quantidadeNormais).toBe(3)
    })

    it('5. identifica progress.extras com 0 candidatos', () => {
      const resultado = compararFixtureLegadoComContratoV2({
        nomeFixture: 'caso-normal-simples-2026-06-12',
        fixtureLegado: fixtureNormalSimples,
      })
      expect(resultado.resumo.quantidadeExtras).toBe(0)
    })

    it('6. valida que candidates === normais + extras (3 === 3 + 0)', () => {
      const resultado = compararFixtureLegadoComContratoV2({
        nomeFixture: 'caso-normal-simples-2026-06-12',
        fixtureLegado: fixtureNormalSimples,
      })
      expect(resultado.contratoLegado.candidatesBatemComNormaisMaisExtras).toBe(true)
    })

    it('7. extrai tipos observados (lista não vazia)', () => {
      const resultado = compararFixtureLegadoComContratoV2({
        nomeFixture: 'caso-normal-simples-2026-06-12',
        fixtureLegado: fixtureNormalSimples,
      })
      expect(resultado.resumo.tiposLegado.length).toBeGreaterThan(0)
    })

    it('8. confirma "normal" na fixture normal simples', () => {
      const resultado = compararFixtureLegadoComContratoV2({
        nomeFixture: 'caso-normal-simples-2026-06-12',
        fixtureLegado: fixtureNormalSimples,
      })
      expect(resultado.resumo.tiposLegado).toContain('normal')
    })

    it('10. valida campos mínimos dos candidatos', () => {
      const resultado = compararFixtureLegadoComContratoV2({
        nomeFixture: 'caso-normal-simples-2026-06-12',
        fixtureLegado: fixtureNormalSimples,
      })
      const campoDivergencias = resultado.diferencas.filter((d) =>
        d.includes('campo obrigatório')
      )
      expect(campoDivergencias).toHaveLength(0)
    })

    it('17. valida que normais têm isExtra === false', () => {
      const resultado = compararFixtureLegadoComContratoV2({
        nomeFixture: 'caso-normal-simples-2026-06-12',
        fixtureLegado: fixtureNormalSimples,
      })
      const divergenciasIsExtra = resultado.diferencas.filter(
        (d) => d.includes('normais[') && d.includes('isExtra')
      )
      expect(divergenciasIsExtra).toHaveLength(0)
    })

    it('19. valida ranks numéricos', () => {
      const resultado = compararFixtureLegadoComContratoV2({
        nomeFixture: 'caso-normal-simples-2026-06-12',
        fixtureLegado: fixtureNormalSimples,
      })
      expect(resultado.contratoLegado.ranksSaoNumericos).toBe(true)
    })
  })

  // ── Fixture premium ou especial ────────────────────────────────────────────

  describe('fixture premium ou especial', () => {
    it('2. retorna ok: true', () => {
      const resultado = compararFixtureLegadoComContratoV2({
        nomeFixture: 'caso-premium-ou-especial-2026-06-12',
        fixtureLegado: fixturePremiumOuEspecial,
      })
      expect(resultado.ok).toBe(true)
      expect(resultado.diferencas).toHaveLength(0)
    })

    it('3b. identifica payload.candidates com 5 candidatos', () => {
      const resultado = compararFixtureLegadoComContratoV2({
        nomeFixture: 'caso-premium-ou-especial-2026-06-12',
        fixtureLegado: fixturePremiumOuEspecial,
      })
      expect(resultado.resumo.quantidadePayloadCandidates).toBe(5)
    })

    it('4b. identifica progress.normais com 3 candidatos', () => {
      const resultado = compararFixtureLegadoComContratoV2({
        nomeFixture: 'caso-premium-ou-especial-2026-06-12',
        fixtureLegado: fixturePremiumOuEspecial,
      })
      expect(resultado.resumo.quantidadeNormais).toBe(3)
    })

    it('5b. identifica progress.extras com 2 candidatos', () => {
      const resultado = compararFixtureLegadoComContratoV2({
        nomeFixture: 'caso-premium-ou-especial-2026-06-12',
        fixtureLegado: fixturePremiumOuEspecial,
      })
      expect(resultado.resumo.quantidadeExtras).toBe(2)
    })

    it('6b. valida que candidates === normais + extras (5 === 3 + 2)', () => {
      const resultado = compararFixtureLegadoComContratoV2({
        nomeFixture: 'caso-premium-ou-especial-2026-06-12',
        fixtureLegado: fixturePremiumOuEspecial,
      })
      expect(resultado.contratoLegado.candidatesBatemComNormaisMaisExtras).toBe(true)
    })

    it('9. confirma "premium", "especial" e "normal" na fixture premium/especial', () => {
      const resultado = compararFixtureLegadoComContratoV2({
        nomeFixture: 'caso-premium-ou-especial-2026-06-12',
        fixtureLegado: fixturePremiumOuEspecial,
      })
      expect(resultado.resumo.tiposLegado).toContain('normal')
      expect(resultado.resumo.tiposLegado).toContain('premium')
      expect(resultado.resumo.tiposLegado).toContain('especial')
    })

    it('17b. valida que normais têm isExtra === false', () => {
      const resultado = compararFixtureLegadoComContratoV2({
        nomeFixture: 'caso-premium-ou-especial-2026-06-12',
        fixtureLegado: fixturePremiumOuEspecial,
      })
      const divergenciasIsExtra = resultado.diferencas.filter(
        (d) => d.includes('normais[') && d.includes('isExtra')
      )
      expect(divergenciasIsExtra).toHaveLength(0)
    })

    it('18. valida que extras têm isExtra === true', () => {
      const resultado = compararFixtureLegadoComContratoV2({
        nomeFixture: 'caso-premium-ou-especial-2026-06-12',
        fixtureLegado: fixturePremiumOuEspecial,
      })
      const divergenciasIsExtra = resultado.diferencas.filter(
        (d) => d.includes('extras[') && d.includes('isExtra')
      )
      expect(divergenciasIsExtra).toHaveLength(0)
    })

    it('19b. valida ranks numéricos', () => {
      const resultado = compararFixtureLegadoComContratoV2({
        nomeFixture: 'caso-premium-ou-especial-2026-06-12',
        fixtureLegado: fixturePremiumOuEspecial,
      })
      expect(resultado.contratoLegado.ranksSaoNumericos).toBe(true)
    })
  })

  // ── Detecção de campos ausentes ────────────────────────────────────────────

  describe('campos mínimos', () => {
    it('11. detecta candidato sem campo obrigatório (dateDM e weekday ausentes)', () => {
      const fixtureAlterada = {
        responseInicio: { body: { status: 'started' } },
        responseDone: {
          body: {
            progress: {
              status: 'done',
              payload: {
                candidates: [
                  {
                    dateISO: '2026-06-23T03:00:00.000Z',
                    tipo: 'normal',
                    isExtra: false,
                    frete: 'R$ 110',
                    rank: 1,
                    team: 'EQUIPE 1',
                    daysLeftTxt: '11 d',
                    encomenda: 'Não',
                    avisoHoraMarcada: '',
                    // dateDM e weekday ausentes propositalmente
                  },
                ],
              },
              normais: [],
              extras: [],
            },
          },
        },
      }
      const resultado = compararFixtureLegadoComContratoV2({
        nomeFixture: 'caso-sem-campo',
        fixtureLegado: fixtureAlterada,
      })
      expect(resultado.ok).toBe(false)
      expect(resultado.diferencas.some((d) => d.includes('campo obrigatório'))).toBe(true)
    })
  })

  // ── Detecção de erros estruturais ──────────────────────────────────────────

  describe('detecção de erros estruturais', () => {
    it('12. detecta fixture sem responseDone', () => {
      const fixtureIncompleta = {
        responseInicio: { body: { status: 'started' } },
      }
      const resultado = compararFixtureLegadoComContratoV2({
        nomeFixture: 'caso-sem-response-done',
        fixtureLegado: fixtureIncompleta,
      })
      expect(resultado.ok).toBe(false)
      expect(resultado.contratoLegado.temResponseDone).toBe(false)
      expect(resultado.diferencas.some((d) => d.includes('responseDone'))).toBe(true)
    })

    it('13. detecta status final diferente de "done"', () => {
      const fixtureComErro = {
        responseInicio: { body: { status: 'started' } },
        responseDone: {
          body: {
            progress: {
              status: 'error',
              payload: null,
              normais: [],
              extras: [],
            },
          },
        },
      }
      const resultado = compararFixtureLegadoComContratoV2({
        nomeFixture: 'caso-status-error',
        fixtureLegado: fixtureComErro,
      })
      expect(resultado.ok).toBe(false)
      expect(
        resultado.diferencas.some((d) => d.includes('status') && d.includes('done'))
      ).toBe(true)
    })

    it('14. não muta input', () => {
      const fixtureOriginal = JSON.parse(JSON.stringify(fixtureNormalSimples)) as unknown
      compararFixtureLegadoComContratoV2({
        nomeFixture: 'caso-normal-simples-2026-06-12',
        fixtureLegado: fixtureOriginal,
      })
      expect(JSON.stringify(fixtureOriginal)).toBe(JSON.stringify(fixtureNormalSimples))
    })

    it('20. detecta divergência de quantidade entre candidates e normais + extras', () => {
      const fixtureComDivergencia = {
        responseInicio: { body: { status: 'started' } },
        responseDone: {
          body: {
            progress: {
              status: 'done',
              payload: {
                candidates: [
                  {
                    dateISO: '2026-06-23T03:00:00.000Z',
                    dateDM: '23/06',
                    weekday: 'Terça',
                    tipo: 'normal',
                    isExtra: false,
                    frete: 'R$ 110',
                    rank: 1,
                    team: 'EQUIPE 1',
                    daysLeftTxt: '11 d',
                    encomenda: 'Não',
                    avisoHoraMarcada: '',
                  },
                  {
                    dateISO: '2026-06-24T03:00:00.000Z',
                    dateDM: '24/06',
                    weekday: 'Quarta',
                    tipo: 'normal',
                    isExtra: false,
                    frete: 'R$ 110',
                    rank: 2,
                    team: 'EQUIPE 1',
                    daysLeftTxt: '12 d',
                    encomenda: 'Não',
                    avisoHoraMarcada: '',
                  },
                ],
              },
              normais: [
                {
                  dateISO: '2026-06-23T03:00:00.000Z',
                  dateDM: '23/06',
                  weekday: 'Terça',
                  tipo: 'normal',
                  isExtra: false,
                  frete: 'R$ 110',
                  rank: 1,
                  team: 'EQUIPE 1',
                  daysLeftTxt: '11 d',
                  encomenda: 'Não',
                  avisoHoraMarcada: '',
                },
              ],
              extras: [],
            },
          },
        },
      }
      const resultado = compararFixtureLegadoComContratoV2({
        nomeFixture: 'caso-divergencia-qtd',
        fixtureLegado: fixtureComDivergencia,
      })
      expect(resultado.ok).toBe(false)
      expect(resultado.contratoLegado.candidatesBatemComNormaisMaisExtras).toBe(false)
      expect(resultado.diferencas.some((d) => d.includes('normais.length'))).toBe(true)
    })
  })

  // ── Limites do helper — o que não valida ──────────────────────────────────

  describe('limites do helper — o que não valida', () => {
    it('15. não exige igualdade de datas com v2', () => {
      const resultado = compararFixtureLegadoComContratoV2({
        nomeFixture: 'caso-normal-simples-2026-06-12',
        fixtureLegado: fixtureNormalSimples,
      })
      expect('datasV2' in resultado).toBe(false)
      expect('datasIguaisComV2' in resultado).toBe(false)
    })

    it('16. não cria score/ranking novo', () => {
      const resultado = compararFixtureLegadoComContratoV2({
        nomeFixture: 'caso-normal-simples-2026-06-12',
        fixtureLegado: fixtureNormalSimples,
      })
      expect('score' in resultado).toBe(false)
      expect('ranking' in resultado).toBe(false)
      expect('scoreV2' in resultado).toBe(false)
    })
  })
})

describe('compararPayloadLegadoComV2Diagnostico', () => {
  const candidatoBase = {
    dataISO: '2026-06-23T03:00:00.000Z',
    equipe: 'EQUIPE 1',
    tipo: 'normal',
    elegivel: true,
    horaMarcada: false,
    kmAdicionalNaRotaM: 1000,
    slotTemPontos: true,
    limiteBaseM: 2000,
    limiteEspecialM: 5000,
    limitePremiumM: 8000,
    motivos: [],
    ordem: 1,
  }

  it('1. nao diverge quando legado e v2 tem o mesmo candidato', () => {
    const resultado = compararPayloadLegadoComV2Diagnostico({
      candidatosLegado: [candidatoBase],
      candidatosV2: [candidatoBase],
    })
    expect(resultado.ok).toBe(true)
    expect(resultado.divergencias).toHaveLength(0)
    expect(resultado.resumo.presentesNosDois).toBe(1)
  })

  it('2. marca bloqueante quando candidato existe apenas no legado', () => {
    const resultado = compararPayloadLegadoComV2Diagnostico({
      candidatosLegado: [candidatoBase],
      candidatosV2: [],
    })
    expect(resultado.ok).toBe(false)
    expect(resultado.resumo.apenasNoLegado).toBe(1)
    expect(resultado.divergencias[0].tipoDivergencia).toBe('ausente-na-v2')
    expect(resultado.divergencias[0].severidade).toBe('bloqueante')
  })

  it('3. marca bloqueante quando candidato existe apenas na v2', () => {
    const resultado = compararPayloadLegadoComV2Diagnostico({
      candidatosLegado: [],
      candidatosV2: [candidatoBase],
    })
    expect(resultado.ok).toBe(false)
    expect(resultado.resumo.apenasNaV2).toBe(1)
    expect(resultado.divergencias[0].tipoDivergencia).toBe('ausente-no-legado')
    expect(resultado.divergencias[0].severidade).toBe('bloqueante')
  })

  it('4. identifica divergencia bloqueante de tipo', () => {
    const resultado = compararPayloadLegadoComV2Diagnostico({
      candidatosLegado: [candidatoBase],
      candidatosV2: [{ ...candidatoBase, tipo: 'especial' }],
    })
    expect(resultado.resumo.divergenciasTipo).toBe(1)
    expect(resultado.divergencias[0].campo).toBe('tipo')
    expect(resultado.divergencias[0].severidade).toBe('bloqueante')
  })

  it('5. identifica divergencia bloqueante de elegibilidade', () => {
    const resultado = compararPayloadLegadoComV2Diagnostico({
      candidatosLegado: [candidatoBase],
      candidatosV2: [{ ...candidatoBase, elegivel: false }],
    })
    expect(resultado.resumo.divergenciasElegibilidade).toBe(1)
    expect(resultado.divergencias[0].campo).toBe('elegivel')
    expect(resultado.divergencias[0].severidade).toBe('bloqueante')
  })

  it('6. identifica divergencia bloqueante de hora marcada', () => {
    const resultado = compararPayloadLegadoComV2Diagnostico({
      candidatosLegado: [{ ...candidatoBase, horaMarcada: false }],
      candidatosV2: [{ ...candidatoBase, horaMarcada: true }],
    })
    expect(resultado.resumo.divergenciasHoraMarcada).toBe(1)
    expect(resultado.divergencias[0].tipoDivergencia).toBe('hora-marcada')
    expect(resultado.divergencias[0].severidade).toBe('bloqueante')
  })

  it('7. nao diverge km dentro da tolerancia', () => {
    const resultado = compararPayloadLegadoComV2Diagnostico({
      candidatosLegado: [candidatoBase],
      candidatosV2: [{ ...candidatoBase, kmAdicionalNaRotaM: 1002 }],
      toleranciaKmAdicionalM: 2,
    })
    expect(resultado.ok).toBe(true)
    expect(resultado.resumo.divergenciasKm).toBe(0)
  })

  it('8. identifica divergencia de km fora da tolerancia (avaliar, nao bloqueia ok)', () => {
    const resultado = compararPayloadLegadoComV2Diagnostico({
      candidatosLegado: [candidatoBase],
      candidatosV2: [{ ...candidatoBase, kmAdicionalNaRotaM: 1003 }],
      toleranciaKmAdicionalM: 2,
    })
    expect(resultado.resumo.divergenciasKm).toBe(1)
    expect(resultado.divergencias[0].severidade).toBe('avaliar')
    // divergencia "avaliar" nao bloqueia ok (apenas "bloqueante" e comparacaoKey duplicada bloqueiam)
    expect(resultado.ok).toBe(true)
  })

  it('9. trata ordem diferente como informativa', () => {
    const resultado = compararPayloadLegadoComV2Diagnostico({
      candidatosLegado: [candidatoBase],
      candidatosV2: [{ ...candidatoBase, ordem: 2 }],
    })
    expect(resultado.ok).toBe(true)
    expect(resultado.resumo.divergenciasOrdem).toBe(1)
    expect(resultado.divergencias[0].severidade).toBe('informativo')
  })

  it('10. normaliza equipe na chave de comparacao', () => {
    const resultado = compararPayloadLegadoComV2Diagnostico({
      candidatosLegado: [{ ...candidatoBase, equipe: 'Equipe 1' }],
      candidatosV2: [{ ...candidatoBase, equipe: 'equipe_1' }],
    })
    expect(resultado.ok).toBe(true)
    expect(resultado.resumo.presentesNosDois).toBe(1)
    expect(resultado.divergencias).toHaveLength(0)
  })

  it('11. comparacaoKey igual nos dois lados sem divergencia', () => {
    const resultado = compararPayloadLegadoComV2Diagnostico({
      candidatosLegado: [{ ...candidatoBase, comparacaoKey: 'slot-A' }],
      candidatosV2: [{ ...candidatoBase, comparacaoKey: 'slot-A' }],
    })
    expect(resultado.ok).toBe(true)
    expect(resultado.divergencias).toHaveLength(0)
    expect(resultado.resumo.presentesNosDois).toBe(1)
    expect(resultado.resumo.chavesDuplicadasLegado).toBe(0)
    expect(resultado.resumo.chavesDuplicadasV2).toBe(0)
  })

  it('12. comparacaoKey diferente nos dois lados gera ausente-na-v2 e ausente-no-legado', () => {
    const resultado = compararPayloadLegadoComV2Diagnostico({
      candidatosLegado: [{ ...candidatoBase, comparacaoKey: 'slot-A' }],
      candidatosV2: [{ ...candidatoBase, comparacaoKey: 'slot-B' }],
    })
    expect(resultado.ok).toBe(false)
    expect(resultado.resumo.apenasNoLegado).toBe(1)
    expect(resultado.resumo.apenasNaV2).toBe(1)
    expect(resultado.resumo.presentesNosDois).toBe(0)
  })

  it('13. comparacaoKey duplicada no legado retorna duplicidade e ok false', () => {
    const resultado = compararPayloadLegadoComV2Diagnostico({
      candidatosLegado: [
        { ...candidatoBase, comparacaoKey: 'slot-A' },
        { ...candidatoBase, comparacaoKey: 'slot-A', tipo: 'especial' },
      ],
      candidatosV2: [{ ...candidatoBase, comparacaoKey: 'slot-A' }],
    })
    expect(resultado.ok).toBe(false)
    expect(resultado.resumo.chavesDuplicadasLegado).toBe(1)
    expect(resultado.duplicidades.legado).toHaveLength(1)
    expect(resultado.duplicidades.legado[0].chave).toBe('slot-A')
    expect(resultado.duplicidades.legado[0].quantidade).toBe(2)
    expect(resultado.avisos.some((a) => a.includes('ERRO-ENTRADA'))).toBe(true)
  })

  it('14. comparacaoKey duplicada na v2 retorna duplicidade e ok false', () => {
    const resultado = compararPayloadLegadoComV2Diagnostico({
      candidatosLegado: [{ ...candidatoBase, comparacaoKey: 'slot-A' }],
      candidatosV2: [
        { ...candidatoBase, comparacaoKey: 'slot-A' },
        { ...candidatoBase, comparacaoKey: 'slot-A', tipo: 'especial' },
      ],
    })
    expect(resultado.ok).toBe(false)
    expect(resultado.resumo.chavesDuplicadasV2).toBe(1)
    expect(resultado.duplicidades.v2).toHaveLength(1)
    expect(resultado.duplicidades.v2[0].quantidade).toBe(2)
    expect(resultado.avisos.some((a) => a.includes('ERRO-ENTRADA'))).toBe(true)
  })

  it('15. fallback dataISO+equipe continua funcionando sem comparacaoKey', () => {
    const resultado = compararPayloadLegadoComV2Diagnostico({
      candidatosLegado: [candidatoBase],
      candidatosV2: [candidatoBase],
    })
    expect(resultado.ok).toBe(true)
    expect(resultado.estrategiaChave).toBe('dataISO-equipe-fallback')
    expect(resultado.resumo.chavesDuplicadasLegado).toBe(0)
    expect(resultado.resumo.chavesDuplicadasV2).toBe(0)
  })

  it('16. estrategiaChave e comparacaoKey quando todos tem comparacaoKey', () => {
    const resultado = compararPayloadLegadoComV2Diagnostico({
      candidatosLegado: [{ ...candidatoBase, comparacaoKey: 'slot-X' }],
      candidatosV2: [{ ...candidatoBase, comparacaoKey: 'slot-X' }],
    })
    expect(resultado.estrategiaChave).toBe('comparacaoKey')
  })

  it('17. estrategiaChave e mista quando parte tem comparacaoKey e parte nao tem', () => {
    const resultado = compararPayloadLegadoComV2Diagnostico({
      candidatosLegado: [
        { ...candidatoBase, comparacaoKey: 'slot-X' },
        { ...candidatoBase, dataISO: '2026-06-24', equipe: 'EQUIPE 2' },
      ],
      candidatosV2: [
        { ...candidatoBase, comparacaoKey: 'slot-X' },
        { ...candidatoBase, dataISO: '2026-06-24', equipe: 'EQUIPE 2' },
      ],
    })
    expect(resultado.estrategiaChave).toBe('mista')
  })

  it('18. duplicidade por fallback dataISO+equipe gera aviso claro mas nao invalida se nao for comparacaoKey', () => {
    const resultado = compararPayloadLegadoComV2Diagnostico({
      candidatosLegado: [
        candidatoBase,
        { ...candidatoBase, tipo: 'especial' },
      ],
      candidatosV2: [candidatoBase],
    })
    expect(resultado.resumo.chavesDuplicadasLegado).toBe(1)
    expect(resultado.duplicidades.legado).toHaveLength(1)
    expect(resultado.avisos.some((a) => a.includes('[AVISO]'))).toBe(true)
    // Duplicidade por fallback nao invalida sozinha (nao marca ok false por si so)
    // mas como apenasNaV2/apenasNoLegado podem surgir dependendo do caso
    expect(resultado.duplicidades.legado[0].observacao).toContain('preservado indice 0')
  })

  it('19. resumo informa chavesDuplicadasLegado e chavesDuplicadasV2 como zero quando nao ha duplicidade', () => {
    const resultado = compararPayloadLegadoComV2Diagnostico({
      candidatosLegado: [candidatoBase],
      candidatosV2: [candidatoBase],
    })
    expect(resultado.resumo.chavesDuplicadasLegado).toBe(0)
    expect(resultado.resumo.chavesDuplicadasV2).toBe(0)
    expect(resultado.duplicidades.legado).toHaveLength(0)
    expect(resultado.duplicidades.v2).toHaveLength(0)
  })

  it('20. estrategiaChave aparece no resumo do resultado', () => {
    const resultado = compararPayloadLegadoComV2Diagnostico({
      candidatosLegado: [candidatoBase],
      candidatosV2: [candidatoBase],
    })
    expect(resultado).toHaveProperty('estrategiaChave')
    expect(['comparacaoKey', 'dataISO-equipe-fallback', 'mista']).toContain(resultado.estrategiaChave)
  })

  it('21. aviso informa chave usada no cabecalho', () => {
    const resultado = compararPayloadLegadoComV2Diagnostico({
      candidatosLegado: [candidatoBase],
      candidatosV2: [candidatoBase],
    })
    expect(resultado.avisos[0]).toContain('Chave usada:')
  })

  it('22. duplicidades retorna arrays separados por origem legado e v2', () => {
    const resultado = compararPayloadLegadoComV2Diagnostico({
      candidatosLegado: [
        { ...candidatoBase, comparacaoKey: 'dup' },
        { ...candidatoBase, comparacaoKey: 'dup' },
      ],
      candidatosV2: [
        { ...candidatoBase, comparacaoKey: 'dup' },
        { ...candidatoBase, comparacaoKey: 'dup' },
      ],
    })
    expect(resultado.duplicidades.legado).toHaveLength(1)
    expect(resultado.duplicidades.v2).toHaveLength(1)
    expect(resultado.duplicidades.legado[0].origem).toBe('legado')
    expect(resultado.duplicidades.v2[0].origem).toBe('v2')
  })

  it('23. duplicidade por comparacaoKey expoe indices corretos', () => {
    const resultado = compararPayloadLegadoComV2Diagnostico({
      candidatosLegado: [
        { ...candidatoBase, comparacaoKey: 'slot-Z' },
        { ...candidatoBase, comparacaoKey: 'slot-Z' },
        { ...candidatoBase, comparacaoKey: 'slot-Z' },
      ],
      candidatosV2: [{ ...candidatoBase, comparacaoKey: 'slot-Z' }],
    })
    expect(resultado.duplicidades.legado[0].indices).toEqual([0, 1, 2])
    expect(resultado.duplicidades.legado[0].quantidade).toBe(3)
  })
})

describe('gerarComparacaoKeyV2Diagnostico', () => {
  const candidatoBase = {
    dataISO: '2026-06-15',
    equipe: 'EQUIPE 1',
    tipo: 'normal',
    elegivel: true,
    horaMarcada: false,
    kmAdicionalNaRotaM: 1000,
    slotTemPontos: true,
    limiteBaseM: 2000,
    limiteEspecialM: 5000,
    limitePremiumM: 8000,
    motivos: [],
    ordem: 1,
  }

  it('1. gera comparacaoKey no formato dataISO::equipe::fonte::ordemLocal', () => {
    const resultado = gerarComparacaoKeyV2Diagnostico([candidatoBase], 'diagnostico-candidatos')
    expect(resultado[0].comparacaoKey).toBe('2026-06-15::EQUIPE 1::diagnostico-candidatos::1')
  })

  it('2. normaliza equipe na chave (trim, uppercase, espacos unicos)', () => {
    const resultado = gerarComparacaoKeyV2Diagnostico(
      [{ ...candidatoBase, equipe: '  equipe  1  ' }],
      'diagnostico-candidatos'
    )
    expect(resultado[0].comparacaoKey).toBe('2026-06-15::EQUIPE 1::diagnostico-candidatos::1')
  })

  it('3. ordemLocal incrementa para candidatos na mesma dataISO + equipe', () => {
    const resultado = gerarComparacaoKeyV2Diagnostico(
      [
        { ...candidatoBase, tipo: 'normal' },
        { ...candidatoBase, tipo: 'especial' },
        { ...candidatoBase, tipo: 'premium' },
      ],
      'diagnostico-candidatos'
    )
    expect(resultado[0].comparacaoKey).toBe('2026-06-15::EQUIPE 1::diagnostico-candidatos::1')
    expect(resultado[1].comparacaoKey).toBe('2026-06-15::EQUIPE 1::diagnostico-candidatos::2')
    expect(resultado[2].comparacaoKey).toBe('2026-06-15::EQUIPE 1::diagnostico-candidatos::3')
  })

  it('4. ordemLocal reinicia para grupos diferentes (dataISO + equipe)', () => {
    const resultado = gerarComparacaoKeyV2Diagnostico(
      [
        { ...candidatoBase, dataISO: '2026-06-15', equipe: 'EQUIPE 1' },
        { ...candidatoBase, dataISO: '2026-06-15', equipe: 'EQUIPE 1' },
        { ...candidatoBase, dataISO: '2026-06-16', equipe: 'EQUIPE 1' },
        { ...candidatoBase, dataISO: '2026-06-16', equipe: 'EQUIPE 2' },
      ],
      'diagnostico-candidatos'
    )
    expect(resultado[0].comparacaoKey).toBe('2026-06-15::EQUIPE 1::diagnostico-candidatos::1')
    expect(resultado[1].comparacaoKey).toBe('2026-06-15::EQUIPE 1::diagnostico-candidatos::2')
    expect(resultado[2].comparacaoKey).toBe('2026-06-16::EQUIPE 1::diagnostico-candidatos::1')
    expect(resultado[3].comparacaoKey).toBe('2026-06-16::EQUIPE 2::diagnostico-candidatos::1')
  })

  it('5. chave nao inclui tipo para preservar deteccao de divergencia de tipo', () => {
    const resultado = gerarComparacaoKeyV2Diagnostico(
      [
        { ...candidatoBase, tipo: 'normal' },
        { ...candidatoBase, tipo: 'especial' },
      ],
      'diagnostico-candidatos'
    )
    // Chaves sao diferentes por ordemLocal, nao por tipo
    expect(resultado[0].comparacaoKey).not.toContain('normal')
    expect(resultado[1].comparacaoKey).not.toContain('especial')
  })

  it('6. preserva todos os campos originais e adiciona comparacaoKey', () => {
    const resultado = gerarComparacaoKeyV2Diagnostico([candidatoBase], 'diagnostico-candidatos')
    expect(resultado[0].dataISO).toBe(candidatoBase.dataISO)
    expect(resultado[0].equipe).toBe(candidatoBase.equipe)
    expect(resultado[0].tipo).toBe(candidatoBase.tipo)
    expect(resultado[0].elegivel).toBe(candidatoBase.elegivel)
    expect(resultado[0].horaMarcada).toBe(candidatoBase.horaMarcada)
    expect(resultado[0].kmAdicionalNaRotaM).toBe(candidatoBase.kmAdicionalNaRotaM)
    expect(resultado[0].comparacaoKey).toBeDefined()
  })

  it('7. funciona com array vazio', () => {
    const resultado = gerarComparacaoKeyV2Diagnostico([], 'diagnostico-candidatos')
    expect(resultado).toEqual([])
  })
})
