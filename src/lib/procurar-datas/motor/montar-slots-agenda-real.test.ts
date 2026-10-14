import { describe, expect, it } from 'vitest'
import { montarSlotsAgendaReal, LIMITE_LEITURA_FONTES_V2 } from './montar-slots-agenda-real'

const disponibilidades = [
  { dataISO: '2026-11-28', equipe: 'Equipe 1', tempoUtilizadoMin: 180, disponivelMin: 60, capacidadeTotalMin: 240 },
  { dataISO: '2026-12-03', equipe: 'Equipe 1', tempoUtilizadoMin: 30, disponivelMin: 390, capacidadeTotalMin: 420 },
  { dataISO: '2026-12-05', equipe: 'Equipe 1', tempoUtilizadoMin: 0, disponivelMin: 240, capacidadeTotalMin: 240 },
]
const input = { janelaDatas: disponibilidades.map(({ dataISO }) => ({ dataISO })), disponibilidades,
  linhasAgenda: [], cacheCoordenadasPorEndereco: {}, equipe1Ativa: true, equipe2Ativa: false }

describe('montagem compartilhada de slots da produção e auditoria', () => {
  it('associa os mesmos dados reais de disponibilidade para os três slots', () => {
    const producao = montarSlotsAgendaReal(input)
    const auditoria = montarSlotsAgendaReal({ ...input, janelaDatas: [],
      slotsAlvo: disponibilidades.map(({ dataISO }) => ({ dataISO, equipe: 'EQUIPE 1' })) })
    expect(auditoria).toEqual(producao)
    expect(auditoria.map((slot) => slot.disponibilidade)).toEqual(disponibilidades.map(({ tempoUtilizadoMin, disponivelMin, capacidadeTotalMin }) => ({ tempoUtilizadoMin, disponivelMin, capacidadeTotalMin })))
    expect(LIMITE_LEITURA_FONTES_V2).toBe(2000)
  })
  it('não inventa disponibilidade para outro dia ou outra equipe', () => {
    const slots = montarSlotsAgendaReal({ ...input, slotsAlvo: [
      { dataISO: '2026-12-05', equipe: 'Equipe 2' }, { dataISO: '2026-12-06', equipe: 'Equipe 1' },
    ] })
    expect(slots.every((slot) => slot.disponibilidade === null)).toBe(true)
  })
})
