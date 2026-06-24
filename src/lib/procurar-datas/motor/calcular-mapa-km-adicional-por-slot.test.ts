// ─────────────────────────────────────────────────────────────────────────────
// calcular-mapa-km-adicional-por-slot.test.ts
//
// Testes unitários de calcularMapaKmAdicionalPorSlotControladoV2.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  calcularMapaKmAdicionalPorSlotControladoV2,
  type SlotInputMapaKmAdicional,
  type CalcularMapaKmAdicionalPorSlotInput,
} from './calcular-mapa-km-adicional-por-slot'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const CONFIG_ORIGEM = {
  latDeposito: -25.4876648,
  lngDeposito: -49.2692262,
  latCasaE1: -25.494297,
  lngCasaE1: -49.277091,
  latCasaE2: -25.494297,
  lngCasaE2: -49.277091,
}

const CONFIG_FILTRO_EARLY = {
  kmMaxEntrePontosKm: 8,
  kmAdicionalMaxNaRotaPremiumM: 10000,
}

const DESTINO = { lat: -25.42, lng: -49.27, descricao: 'destino-teste' }

const SLOT_E1_SEG: SlotInputMapaKmAdicional = {
  dataISO: '2026-06-15',
  equipe: 'EQUIPE 1',
  linhasAgenda: [],
}

const SLOT_E2_SEG: SlotInputMapaKmAdicional = {
  dataISO: '2026-06-15',
  equipe: 'EQUIPE 2',
  linhasAgenda: [],
}

const SLOT_E1_TER: SlotInputMapaKmAdicional = {
  dataISO: '2026-06-16',
  equipe: 'EQUIPE 1',
  linhasAgenda: [],
}

// ─── Mock de calcularKmAdicionalRealControladoV2 ──────────────────────────────

const calcularKmRealMock = vi.hoisted(() =>
  vi.fn().mockResolvedValue({
    ok: true,
    modo: 'km-adicional-real-controlado-diagnostico',
    kmAdicionalNaRotaM: 3500,
    origemKmAdicionalNaRotaM: 'osrm-table-diagnostico',
    origemOperacional: {
      ok: true,
      origem: { lat: -25.4876648, lng: -49.2692262 },
      tipo: 'deposito',
      contexto: { dataISO: '2026-06-15', equipe: 'EQUIPE 1', ehSabado: false },
    },
    parseAgenda: { ok: true, resumo: { pontosValidos: 0 }, avisos: [], erros: [], descartados: [] },
    matrizOSRM: { ok: true, resumo: { distanciasValidas: 4 }, avisos: [], erros: [] },
    deltaInsercao: {
      ok: true,
      modo: 'matriz-distancia-diagnostico',
      kmAdicionalNaRotaM: 3500,
      melhorInsercao: null,
      resumo: {},
      avisos: [],
      erros: [],
      descartados: [],
    },
    avisos: ['mock ok'],
    erros: [],
    descartados: [],
  })
)

vi.mock('./calcular-km-adicional-real-controlado', () => ({
  calcularKmAdicionalRealControladoV2: calcularKmRealMock,
}))

// ─── buscarMatrizOSRM stub ────────────────────────────────────────────────────

const buscarMatrizOSRMStub = vi.fn()

function montarInput(
  slots: SlotInputMapaKmAdicional[],
  overrides: Partial<CalcularMapaKmAdicionalPorSlotInput> = {}
): CalcularMapaKmAdicionalPorSlotInput {
  return {
    slots,
    destino: DESTINO,
    configOrigem: CONFIG_ORIGEM,
    buscarMatrizOSRM: buscarMatrizOSRMStub,
    ...overrides,
  }
}

// ─── Testes ───────────────────────────────────────────────────────────────────

describe('calcularMapaKmAdicionalPorSlotControladoV2', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    calcularKmRealMock.mockResolvedValue({
      ok: true,
      modo: 'km-adicional-real-controlado-diagnostico',
      kmAdicionalNaRotaM: 3500,
      origemKmAdicionalNaRotaM: 'osrm-table-diagnostico',
      origemOperacional: { ok: true, origem: DESTINO, tipo: 'deposito', contexto: {} },
      parseAgenda: { ok: true, resumo: { pontosValidos: 0 }, avisos: [], erros: [], descartados: [] },
      matrizOSRM: null,
      deltaInsercao: null,
      avisos: [],
      erros: [],
      descartados: [],
    })
  })

  // 1. Lista vazia
  it('1. lista vazia de slots retorna mapa vazio sem chamar helper', async () => {
    const resultado = await calcularMapaKmAdicionalPorSlotControladoV2(montarInput([]))

    expect(resultado.ok).toBe(true)
    expect(resultado.mapa).toEqual({})
    expect(resultado.detalhesPorSlot).toHaveLength(0)
    expect(resultado.contadores.slotsRecebidos).toBe(0)
    expect(resultado.contadores.slotsProcessados).toBe(0)
    expect(calcularKmRealMock).not.toHaveBeenCalled()
    expect(resultado.avisos.join(' ')).toContain('Nenhum slot recebido')
  })

  // 2. Um slot válido retorna mapa com chave correta
  it('2. um slot válido retorna chave dataISO::equipeNormalizada no mapa', async () => {
    const resultado = await calcularMapaKmAdicionalPorSlotControladoV2(
      montarInput([SLOT_E1_SEG])
    )

    expect(resultado.ok).toBe(true)
    expect(resultado.mapa).toHaveProperty('2026-06-15::EQUIPE 1')
    expect(resultado.mapa['2026-06-15::EQUIPE 1']).toBe(3500)
    expect(resultado.detalhesPorSlot).toHaveLength(1)
    expect(resultado.contadores.slotsRecebidos).toBe(1)
    expect(resultado.contadores.slotsProcessados).toBe(1)
    expect(resultado.contadores.slotsComKm).toBe(1)
    expect(calcularKmRealMock).toHaveBeenCalledTimes(1)
  })

  // 3. Múltiplos slots distintos
  it('3. múltiplos slots geram chaves distintas no mapa', async () => {
    calcularKmRealMock
      .mockResolvedValueOnce({ ok: true, kmAdicionalNaRotaM: 1000, origemKmAdicionalNaRotaM: 'osrm-table-diagnostico', avisos: [], erros: [], descartados: [], parseAgenda: { descartados: [] }, deltaInsercao: {} })
      .mockResolvedValueOnce({ ok: true, kmAdicionalNaRotaM: 2000, origemKmAdicionalNaRotaM: 'osrm-table-diagnostico', avisos: [], erros: [], descartados: [], parseAgenda: { descartados: [] }, deltaInsercao: {} })
      .mockResolvedValueOnce({ ok: true, kmAdicionalNaRotaM: 3000, origemKmAdicionalNaRotaM: 'osrm-table-diagnostico', avisos: [], erros: [], descartados: [], parseAgenda: { descartados: [] }, deltaInsercao: {} })

    const resultado = await calcularMapaKmAdicionalPorSlotControladoV2(
      montarInput([SLOT_E1_SEG, SLOT_E2_SEG, SLOT_E1_TER])
    )

    expect(resultado.mapa['2026-06-15::EQUIPE 1']).toBe(1000)
    expect(resultado.mapa['2026-06-15::EQUIPE 2']).toBe(2000)
    expect(resultado.mapa['2026-06-16::EQUIPE 1']).toBe(3000)
    expect(resultado.detalhesPorSlot).toHaveLength(3)
    expect(resultado.contadores.slotsProcessados).toBe(3)
    expect(resultado.contadores.slotsComKm).toBe(3)
    expect(calcularKmRealMock).toHaveBeenCalledTimes(3)
  })

  // 4. Delta positivo (cenário esperado com slot não-zero)
  it('4. cenário com delta positivo: mapa contém km > 0', async () => {
    calcularKmRealMock.mockResolvedValueOnce({
      ok: true,
      kmAdicionalNaRotaM: 7842,
      origemKmAdicionalNaRotaM: 'osrm-table-diagnostico',
      avisos: [],
      erros: [],
      descartados: [],
      parseAgenda: { descartados: [] },
      deltaInsercao: {},
    })

    const resultado = await calcularMapaKmAdicionalPorSlotControladoV2(
      montarInput([SLOT_E1_SEG])
    )

    expect(resultado.mapa['2026-06-15::EQUIPE 1']).toBe(7842)
    expect(resultado.mapa['2026-06-15::EQUIPE 1']).toBeGreaterThan(0)
    expect(resultado.contadores.slotsComKm).toBe(1)
  })

  // 5. Slot com equipe inválida é descartado
  it('5. slot com equipe inválida é descartado e não chama helper', async () => {
    const slotInvalido: SlotInputMapaKmAdicional = {
      dataISO: '2026-06-15',
      equipe: 'EQUIPE INVALIDA',
      linhasAgenda: [],
    }

    const resultado = await calcularMapaKmAdicionalPorSlotControladoV2(
      montarInput([slotInvalido])
    )

    expect(resultado.mapa).toEqual({})
    expect(resultado.contadores.slotsDescartados).toBe(1)
    expect(resultado.contadores.slotsProcessados).toBe(0)
    expect(resultado.erros.join(' ')).toContain('descartado')
    expect(calcularKmRealMock).not.toHaveBeenCalled()
  })

  // 6. Slot com dataISO vazia é descartado
  it('6. slot com dataISO vazia é descartado sem chamar helper', async () => {
    const slotSemData: SlotInputMapaKmAdicional = {
      dataISO: '',
      equipe: 'EQUIPE 1',
      linhasAgenda: [],
    }

    const resultado = await calcularMapaKmAdicionalPorSlotControladoV2(
      montarInput([slotSemData])
    )

    expect(resultado.mapa).toEqual({})
    expect(resultado.contadores.slotsDescartados).toBe(1)
    expect(calcularKmRealMock).not.toHaveBeenCalled()
  })

  // 7. Helper retorna ok:false → slot contado em slotsComErro
  it('7. helper retornando ok:false conta em slotsComErro', async () => {
    calcularKmRealMock.mockResolvedValueOnce({
      ok: false,
      kmAdicionalNaRotaM: null,
      origemKmAdicionalNaRotaM: null,
      avisos: ['falha'],
      erros: ['erro controlado'],
      descartados: [],
      parseAgenda: { descartados: [] },
      deltaInsercao: null,
    })

    const resultado = await calcularMapaKmAdicionalPorSlotControladoV2(
      montarInput([SLOT_E1_SEG])
    )

    expect(resultado.mapa['2026-06-15::EQUIPE 1']).toBeNull()
    expect(resultado.contadores.slotsComErro).toBe(1)
    expect(resultado.contadores.slotsComKm).toBe(0)
    expect(resultado.detalhesPorSlot[0].ok).toBe(false)
    expect(resultado.detalhesPorSlot[0].kmAdicionalNaRotaM).toBeNull()
  })

  // 8. Helper com fallback Haversine é rastreado no contador
  it('8. fallback Haversine é contado em slotsComFallbackHaversine', async () => {
    calcularKmRealMock.mockResolvedValueOnce({
      ok: true,
      kmAdicionalNaRotaM: 4200,
      origemKmAdicionalNaRotaM: 'haversine-fallback-legado-diagnostico',
      avisos: ['Fallback Haversine usado'],
      erros: [],
      descartados: [],
      parseAgenda: { descartados: [] },
      deltaInsercao: {},
    })

    const resultado = await calcularMapaKmAdicionalPorSlotControladoV2(
      montarInput([SLOT_E1_SEG])
    )

    expect(resultado.contadores.slotsComFallbackHaversine).toBe(1)
    expect(resultado.contadores.slotsComKm).toBe(1)
    expect(resultado.mapa['2026-06-15::EQUIPE 1']).toBe(4200)
    expect(resultado.detalhesPorSlot[0].origemKmAdicionalNaRotaM).toBe(
      'haversine-fallback-legado-diagnostico'
    )
  })

  // 9. Mix: um slot válido + um descartado
  it('9. mix de slot válido e slot descartado — mapa contém apenas o válido', async () => {
    const slotInvalido: SlotInputMapaKmAdicional = {
      dataISO: '2026-06-15',
      equipe: '',
      linhasAgenda: [],
    }

    const resultado = await calcularMapaKmAdicionalPorSlotControladoV2(
      montarInput([SLOT_E1_SEG, slotInvalido])
    )

    expect(Object.keys(resultado.mapa)).toHaveLength(1)
    expect(resultado.mapa['2026-06-15::EQUIPE 1']).toBe(3500)
    expect(resultado.contadores.slotsRecebidos).toBe(2)
    expect(resultado.contadores.slotsProcessados).toBe(1)
    expect(resultado.contadores.slotsDescartados).toBe(1)
    expect(calcularKmRealMock).toHaveBeenCalledTimes(1)
  })

  // 10. Helper recebe os parâmetros corretos (destino, configOrigem, buscarMatrizOSRM, linhasAgenda)
  it('10. helper recebe destino, configOrigem, buscarMatrizOSRM e linhasAgenda corretos', async () => {
    const linhasAgendaMock = [[{ some: 'linha' }]] as unknown as SlotInputMapaKmAdicional['linhasAgenda']
    const cacheMock = { 'Rua A': { lat: -25.4, lng: -49.2 } }

    await calcularMapaKmAdicionalPorSlotControladoV2(
      montarInput(
        [{ ...SLOT_E1_SEG, linhasAgenda: linhasAgendaMock, cacheCoordenadasPorEndereco: cacheMock }],
        { configFiltroEarlyLegado: CONFIG_FILTRO_EARLY }
      )
    )

    expect(calcularKmRealMock).toHaveBeenCalledWith(
      expect.objectContaining({
        dataISO: '2026-06-15',
        equipe: 'EQUIPE 1',
        destino: DESTINO,
        configOrigem: CONFIG_ORIGEM,
        configFiltroEarlyLegado: CONFIG_FILTRO_EARLY,
        buscarMatrizOSRM: buscarMatrizOSRMStub,
        linhasAgenda: linhasAgendaMock,
        cacheCoordenadasPorEndereco: cacheMock,
      })
    )
  })

  it('10b. repassa config do filtro early legado para o helper', async () => {
    await calcularMapaKmAdicionalPorSlotControladoV2(
      montarInput([SLOT_E1_SEG], { configFiltroEarlyLegado: CONFIG_FILTRO_EARLY })
    )

    expect(calcularKmRealMock).toHaveBeenCalledWith(
      expect.objectContaining({
        configFiltroEarlyLegado: CONFIG_FILTRO_EARLY,
      })
    )
  })

  it('10c. slot filtrado pelo early legado entra como descartado, nao como erro OSRM', async () => {
    calcularKmRealMock.mockResolvedValueOnce({
      ok: true,
      kmAdicionalNaRotaM: null,
      origemKmAdicionalNaRotaM: 'filtrado-early-legado-diagnostico',
      avisos: ['filtrado'],
      erros: [],
      descartados: [],
      parseAgenda: { descartados: [] },
      deltaInsercao: null,
      filtroEarlyLegado: {
        aplicado: true,
        descartado: true,
        motivo: 'haversine-reta',
      },
    })

    const resultado = await calcularMapaKmAdicionalPorSlotControladoV2(
      montarInput([SLOT_E1_SEG])
    )

    expect(resultado.mapa['2026-06-15::EQUIPE 1']).toBeNull()
    expect(resultado.contadores.slotsDescartados).toBe(1)
    expect(resultado.contadores.slotsComErro).toBe(0)
    expect(resultado.detalhesPorSlot[0].filtroEarlyLegado).toMatchObject({
      descartado: true,
    })
  })

  // 11. Detalhe do slot contém campos de auditoria
  it('11. detalhe do slot expõe chave, equipeNormalizada, avisos, erros e descartados', async () => {
    calcularKmRealMock.mockResolvedValueOnce({
      ok: true,
      kmAdicionalNaRotaM: 5000,
      origemKmAdicionalNaRotaM: 'osrm-table-diagnostico',
      avisos: ['aviso-teste'],
      erros: [],
      descartados: [{ motivo: 'sem_coordenadas_cache' }],
      parseAgenda: { descartados: [{ motivo: 'sem_coordenadas_cache' }] },
      deltaInsercao: {},
      ordenacaoRotaBase: {
        ordemOriginal: [],
        ordemOtimizada: ['DEPOSITO'],
        criterioOrdenacao: 'sem-pontos',
        twoOptExecutado: false,
        twoOptAplicado: false,
      },
    })

    const resultado = await calcularMapaKmAdicionalPorSlotControladoV2(
      montarInput([SLOT_E1_SEG])
    )

    const detalhe = resultado.detalhesPorSlot[0]
    expect(detalhe.chave).toBe('2026-06-15::EQUIPE 1')
    expect(detalhe.dataISO).toBe('2026-06-15')
    expect(detalhe.equipe).toBe('EQUIPE 1')
    expect(detalhe.equipeNormalizada).toBe('EQUIPE 1')
    expect(detalhe.avisos).toContain('aviso-teste')
    expect(detalhe.erros).toEqual([])
    expect(detalhe.descartados).toHaveLength(1)
    expect(detalhe.ordenacaoRotaBase).toMatchObject({ criterioOrdenacao: 'sem-pontos' })
  })

  // 12. modo e ok corretos no output
  it('12. modo sempre é "mapa-km-adicional-por-slot-diagnostico"', async () => {
    const resultado = await calcularMapaKmAdicionalPorSlotControladoV2(montarInput([]))

    expect(resultado.modo).toBe('mapa-km-adicional-por-slot-diagnostico')
  })

  // 13. Output sempre contém o aviso de diagnóstico
  it('13. avisos sempre contém texto de diagnóstico', async () => {
    const resultado = await calcularMapaKmAdicionalPorSlotControladoV2(montarInput([SLOT_E1_SEG]))

    expect(resultado.avisos[0]).toContain('diagnostico')
  })

  // 14. Dois slots mesma data, equipes diferentes → chaves distintas
  it('14. mesma data com equipes diferentes gera duas chaves distintas', async () => {
    calcularKmRealMock
      .mockResolvedValueOnce({ ok: true, kmAdicionalNaRotaM: 100, origemKmAdicionalNaRotaM: 'osrm-table-diagnostico', avisos: [], erros: [], descartados: [], parseAgenda: { descartados: [] }, deltaInsercao: {} })
      .mockResolvedValueOnce({ ok: true, kmAdicionalNaRotaM: 200, origemKmAdicionalNaRotaM: 'osrm-table-diagnostico', avisos: [], erros: [], descartados: [], parseAgenda: { descartados: [] }, deltaInsercao: {} })

    const resultado = await calcularMapaKmAdicionalPorSlotControladoV2(
      montarInput([SLOT_E1_SEG, SLOT_E2_SEG])
    )

    expect(Object.keys(resultado.mapa)).toHaveLength(2)
    expect(resultado.mapa['2026-06-15::EQUIPE 1']).toBe(100)
    expect(resultado.mapa['2026-06-15::EQUIPE 2']).toBe(200)
  })

  // 15. Valor manual kmAdicionalNaRotaDiagnosticoM não contamina — não existe parâmetro para isso
  it('15. helper não aceita nem expõe kmAdicionalNaRotaDiagnosticoM — isolamento garantido', async () => {
    const resultado = await calcularMapaKmAdicionalPorSlotControladoV2(
      montarInput([SLOT_E1_SEG])
    )

    // O resultado nunca deve ter campo kmAdicionalNaRotaDiagnosticoM
    expect((resultado as Record<string, unknown>).kmAdicionalNaRotaDiagnosticoM).toBeUndefined()
  })

  // 16. Contadores corretos com mix ok/erro/fallback
  it('16. contadores refletem corretamente ok, erro e fallback misturados', async () => {
    calcularKmRealMock
      .mockResolvedValueOnce({ ok: true, kmAdicionalNaRotaM: 1000, origemKmAdicionalNaRotaM: 'osrm-table-diagnostico', avisos: [], erros: [], descartados: [], parseAgenda: { descartados: [] }, deltaInsercao: {} })
      .mockResolvedValueOnce({ ok: true, kmAdicionalNaRotaM: 2000, origemKmAdicionalNaRotaM: 'haversine-fallback-legado-diagnostico', avisos: [], erros: [], descartados: [], parseAgenda: { descartados: [] }, deltaInsercao: {} })
      .mockResolvedValueOnce({ ok: false, kmAdicionalNaRotaM: null, origemKmAdicionalNaRotaM: null, avisos: [], erros: ['erro'], descartados: [], parseAgenda: { descartados: [] }, deltaInsercao: null })

    const resultado = await calcularMapaKmAdicionalPorSlotControladoV2(
      montarInput([SLOT_E1_SEG, SLOT_E2_SEG, SLOT_E1_TER])
    )

    expect(resultado.contadores.slotsProcessados).toBe(3)
    expect(resultado.contadores.slotsComKm).toBe(2)
    expect(resultado.contadores.slotsComFallbackHaversine).toBe(1)
    expect(resultado.contadores.slotsComErro).toBe(1)
    expect(resultado.contadores.slotsDescartados).toBe(0)
  })
})
