import { describe, it, expect } from 'vitest'
import { compararFixtureLegadoComContratoV2 } from './comparacao-legado-v2'
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
