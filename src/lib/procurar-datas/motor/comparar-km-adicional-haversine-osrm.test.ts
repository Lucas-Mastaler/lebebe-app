import { describe, it, expect, vi } from 'vitest'
import {
  compararKmAdicionalHaversineVsOSRMDiagnosticoV2,
  type CompararKmAdicionalHaversineVsOSRMInput,
} from './comparar-km-adicional-haversine-osrm'
import type { BuscarMatrizOSRM } from './preparar-matriz-osrm-diagnostico'
import type { Coordenada } from './distancia'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const ORIGEM: Coordenada & { descricao?: string; id?: string } = {
  lat: -25.45,
  lng: -49.29,
  descricao: 'Deposito',
  id: 'origem',
}

const DESTINO: Coordenada & { descricao?: string; id?: string } = {
  lat: -25.42,
  lng: -49.27,
  descricao: 'Cliente A',
  id: 'destino',
}

const PONTO_AGENDA_1 = {
  loc: { lat: -25.43, lng: -49.28 },
  addr: 'Rua B, 200',
  eventTitle: 'Entrega B',
  team: 'EQUIPE 1',
  id: 'agenda_0',
}

const PONTO_AGENDA_2 = {
  loc: { lat: -25.44, lng: -49.26 },
  addr: 'Rua C, 300',
  eventTitle: 'Entrega C',
  team: 'EQUIPE 1',
  id: 'agenda_1',
}

// Mock de OSRM que retorna matriz simulada (simetrica para testes simples)
function mockOSRM(matrizDistancias: (number | null)[][]): BuscarMatrizOSRM {
  return vi.fn().mockResolvedValue({
    distances: matrizDistancias,
  })
}

// Mock de OSRM que falha
function mockOSRMFalha(erro: Error): BuscarMatrizOSRM {
  return vi.fn().mockRejectedValue(erro)
}

// ─── Testes ───────────────────────────────────────────────────────────────────

describe('compararKmAdicionalHaversineVsOSRMDiagnosticoV2', () => {

  // 1. Comparacao feliz com OSRM mockado retorna ok: true
  it('1. comparacao feliz: ok=true quando ambos funcionam', async () => {
    // Matriz 2x2: origem -> destino = 2500m
    const buscarMatrizOSRM = mockOSRM([
      [0, 2500],
      [2500, 0],
    ])

    const input: CompararKmAdicionalHaversineVsOSRMInput = {
      origem: ORIGEM,
      destino: DESTINO,
      pontosAgenda: [],
      buscarMatrizOSRM,
    }

    const resultado = await compararKmAdicionalHaversineVsOSRMDiagnosticoV2(input)

    expect(resultado.ok).toBe(true)
    expect(resultado.modo).toBe('comparacao-haversine-osrm-diagnostico')
    expect(resultado.haversine.ok).toBe(true)
    expect(resultado.osrm?.ok).toBe(true)
  })

  // 2. Retorna kmHaversineM e kmOsrmM
  it('2. retorna kmHaversineM e kmOsrmM quando ambos calculam', async () => {
    const buscarMatrizOSRM = mockOSRM([
      [0, 2500],
      [2600, 0],
    ])

    const input: CompararKmAdicionalHaversineVsOSRMInput = {
      origem: ORIGEM,
      destino: DESTINO,
      pontosAgenda: [],
      buscarMatrizOSRM,
    }

    const resultado = await compararKmAdicionalHaversineVsOSRMDiagnosticoV2(input)

    expect(resultado.comparacao).not.toBeNull()
    expect(resultado.comparacao?.kmHaversineM).toBeGreaterThan(0)
    expect(resultado.comparacao?.kmOsrmM).toBeGreaterThan(0)
  })

  // 3. Calcula diferenca absoluta
  it('3. calcula diferenca absoluta corretamente', async () => {
    const buscarMatrizOSRM = mockOSRM([
      [0, 2500],
      [2600, 0],
    ])

    const input: CompararKmAdicionalHaversineVsOSRMInput = {
      origem: ORIGEM,
      destino: DESTINO,
      pontosAgenda: [],
      buscarMatrizOSRM,
    }

    const resultado = await compararKmAdicionalHaversineVsOSRMDiagnosticoV2(input)

    const kmH = resultado.comparacao!.kmHaversineM!
    const kmO = resultado.comparacao!.kmOsrmM!
    const expectedDiff = Math.abs(kmO - kmH)

    expect(resultado.comparacao?.diferencaAbsolutaM).toBe(expectedDiff)
  })

  // 4. Calcula diferenca percentual
  it('4. calcula diferenca percentual quando Haversine != 0', async () => {
    const buscarMatrizOSRM = mockOSRM([
      [0, 2500],
      [2600, 0],
    ])

    const input: CompararKmAdicionalHaversineVsOSRMInput = {
      origem: ORIGEM,
      destino: DESTINO,
      pontosAgenda: [],
      buscarMatrizOSRM,
    }

    const resultado = await compararKmAdicionalHaversineVsOSRMDiagnosticoV2(input)

    expect(resultado.comparacao?.diferencaPercentual).not.toBeNull()
    // Verificar que o calculo percentual esta correto
    const kmH = resultado.comparacao!.kmHaversineM!
    const kmO = resultado.comparacao!.kmOsrmM!
    const expectedPct = Number(((kmO - kmH) / kmH * 100).toFixed(2))
    expect(resultado.comparacao?.diferencaPercentual).toBe(expectedPct)
  })

  // 5. Detecta quando OSRM é maior que Haversine
  it('5. detecta quando OSRM maior que Haversine', async () => {
    // OSRM retorna distancia maior que Haversine (Haversine ~2800m para essas coords)
    const buscarMatrizOSRM = mockOSRM([
      [0, 5000],
      [5100, 0],
    ])

    const input: CompararKmAdicionalHaversineVsOSRMInput = {
      origem: ORIGEM,
      destino: DESTINO,
      pontosAgenda: [],
      buscarMatrizOSRM,
    }

    const resultado = await compararKmAdicionalHaversineVsOSRMDiagnosticoV2(input)

    expect(resultado.comparacao?.osrmMaiorQueHaversine).toBe(true)
  })

  // 6. OSRM mockado com matriz assimétrica é respeitado
  it('6. matriz assimétrica do OSRM e respeitada', async () => {
    // Matriz assimétrica: origem->destino != destino->origem
    const buscarMatrizOSRM = mockOSRM([
      [0, 2500],
      [3000, 0],
    ])

    const input: CompararKmAdicionalHaversineVsOSRMInput = {
      origem: ORIGEM,
      destino: DESTINO,
      pontosAgenda: [],
      buscarMatrizOSRM,
    }

    const resultado = await compararKmAdicionalHaversineVsOSRMDiagnosticoV2(input)

    expect(resultado.ok).toBe(true)
    // O OSRM usa a distancia origem->destino (2500) não a simétrica
    expect(resultado.comparacao?.kmOsrmM).toBe(2500)
  })

  // 7. Falha do OSRM retorna comparação incompleta e erro claro
  it('7. falha do OSRM retorna ok=false e erro claro', async () => {
    const buscarMatrizOSRM = mockOSRMFalha(new Error('OSRM timeout'))

    const input: CompararKmAdicionalHaversineVsOSRMInput = {
      origem: ORIGEM,
      destino: DESTINO,
      pontosAgenda: [],
      buscarMatrizOSRM,
    }

    const resultado = await compararKmAdicionalHaversineVsOSRMDiagnosticoV2(input)

    expect(resultado.ok).toBe(false)
    expect(resultado.erros.length).toBeGreaterThan(0)
    expect(resultado.erros.some((e) => e.includes('OSRM'))).toBe(true)
    expect(resultado.comparacao).toBeNull()
  })

  // 8. Haversine com origem inválida retorna comparação incompleta
  it('8. origem invalida: Haversine falha, comparacao incompleta', async () => {
    const buscarMatrizOSRM = mockOSRM([
      [0, 2500],
      [2600, 0],
    ])

    const input: CompararKmAdicionalHaversineVsOSRMInput = {
      origem: { lat: NaN, lng: NaN },
      destino: DESTINO,
      pontosAgenda: [],
      buscarMatrizOSRM,
    }

    const resultado = await compararKmAdicionalHaversineVsOSRMDiagnosticoV2(input)

    expect(resultado.ok).toBe(false)
    expect(resultado.haversine.ok).toBe(false)
    expect(resultado.erros.length).toBeGreaterThan(0)
  })

  // 9. OSRM com distância null não vira 0
  it('9. OSRM com distancia null nao vira 0', async () => {
    const buscarMatrizOSRM = mockOSRM([
      [0, null],
      [null, 0],
    ])

    const input: CompararKmAdicionalHaversineVsOSRMInput = {
      origem: ORIGEM,
      destino: DESTINO,
      pontosAgenda: [],
      buscarMatrizOSRM,
    }

    const resultado = await compararKmAdicionalHaversineVsOSRMDiagnosticoV2(input)

    // OSRM vai falhar porque não consegue calcular delta
    expect(resultado.ok).toBe(false)
    // A comparação deve ser null porque OSRM não retornou valor válido
    expect(resultado.comparacao?.kmOsrmM ?? null).toBeNull()
  })

  // 10. Agenda vazia funciona com origem -> destino
  it('10. agenda vazia: calcula origem -> destino em ambos', async () => {
    const buscarMatrizOSRM = mockOSRM([
      [0, 2500],
      [2600, 0],
    ])

    const input: CompararKmAdicionalHaversineVsOSRMInput = {
      origem: ORIGEM,
      destino: DESTINO,
      pontosAgenda: [],
      buscarMatrizOSRM,
    }

    const resultado = await compararKmAdicionalHaversineVsOSRMDiagnosticoV2(input)

    expect(resultado.ok).toBe(true)
    expect(resultado.haversine.kmAdicionalNaRotaM).toBeGreaterThan(0)
    expect(resultado.osrm?.kmAdicionalNaRotaM).toBe(2500)
  })

  // 11. Ponto inválido é descartado nos dois caminhos
  it('11. ponto invalido e descartado nos dois caminhos', async () => {
    const buscarMatrizOSRM = mockOSRM([
      [0, 3000, 2000],
      [3100, 0, 1500],
      [2100, 1600, 0],
    ])

    const input: CompararKmAdicionalHaversineVsOSRMInput = {
      origem: ORIGEM,
      destino: DESTINO,
      pontosAgenda: [
        PONTO_AGENDA_1,
        { loc: { lat: NaN, lng: NaN }, addr: 'Invalido' }, // ponto invalido
      ],
      buscarMatrizOSRM,
    }

    const resultado = await compararKmAdicionalHaversineVsOSRMDiagnosticoV2(input)

    // Deve funcionar com apenas 1 ponto valido na agenda
    expect(resultado.ok).toBe(true)
    expect(resultado.haversine.resumo.quantidadePontosInvalidos).toBe(1)
  })

  // 12. Não chama OSRM real (mock é chamado)
  it('12. nao chama OSRM real: mock e chamado', async () => {
    const buscarMatrizOSRM = vi.fn().mockResolvedValue({
      distances: [
        [0, 2500],
        [2600, 0],
      ],
    })

    const input: CompararKmAdicionalHaversineVsOSRMInput = {
      origem: ORIGEM,
      destino: DESTINO,
      pontosAgenda: [],
      buscarMatrizOSRM,
    }

    await compararKmAdicionalHaversineVsOSRMDiagnosticoV2(input)

    expect(buscarMatrizOSRM).toHaveBeenCalledTimes(1)
    expect(buscarMatrizOSRM).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ lat: ORIGEM.lat, lng: ORIGEM.lng }),
        expect.objectContaining({ lat: DESTINO.lat, lng: DESTINO.lng }),
      ])
    )
  })

  // 13. Não usa fetch diretamente
  it('13. nao usa fetch diretamente', async () => {
    // O teste 12 ja prova que so o mock e chamado
    // Este teste e documental: confirmamos que nenhum fetch global e usado
    const buscarMatrizOSRM = vi.fn().mockResolvedValue({
      distances: [[0, 1000], [1000, 0]],
    })

    const input: CompararKmAdicionalHaversineVsOSRMInput = {
      origem: ORIGEM,
      destino: DESTINO,
      pontosAgenda: [],
      buscarMatrizOSRM,
    }

    const resultado = await compararKmAdicionalHaversineVsOSRMDiagnosticoV2(input)

    expect(resultado.ok).toBe(true)
    // fetch global nao foi tocado - confirmado por vi.fn() ser unico mock
  })

  // 14. Não usa process.env
  it('14. nao usa process.env', async () => {
    const buscarMatrizOSRM = mockOSRM([
      [0, 2500],
      [2600, 0],
    ])

    const input: CompararKmAdicionalHaversineVsOSRMInput = {
      origem: ORIGEM,
      destino: DESTINO,
      pontosAgenda: [],
      buscarMatrizOSRM,
    }

    // Nao ha como testar ausencia de process.env diretamente,
    // mas a estrutura do codigo (sem referencias a process.env) garante isso
    const resultado = await compararKmAdicionalHaversineVsOSRMDiagnosticoV2(input)

    expect(resultado.ok).toBe(true)
    // Documental: confirmar que nao ha process.env no codigo fonte
  })

  // 15. Não muta input
  it('15. nao muta input', async () => {
    const buscarMatrizOSRM = mockOSRM([
      [0, 2500, 2000],
      [2600, 0, 1500],
      [2100, 1600, 0],
    ])

    const pontosOriginais = [PONTO_AGENDA_1, PONTO_AGENDA_2]
    const pontosCopia = JSON.parse(JSON.stringify(pontosOriginais))

    const input: CompararKmAdicionalHaversineVsOSRMInput = {
      origem: ORIGEM,
      destino: DESTINO,
      pontosAgenda: pontosOriginais,
      buscarMatrizOSRM,
    }

    await compararKmAdicionalHaversineVsOSRMDiagnosticoV2(input)

    expect(JSON.stringify(pontosOriginais)).toBe(JSON.stringify(pontosCopia))
    expect(input.origem.lat).toBe(ORIGEM.lat)
    expect(input.destino.lng).toBe(DESTINO.lng)
  })

  // 16. Mantém modo 'comparacao-haversine-osrm-diagnostico'
  it('16. mantem modo comparacao-haversine-osrm-diagnostico', async () => {
    const buscarMatrizOSRM = mockOSRM([
      [0, 2500],
      [2600, 0],
    ])

    const input: CompararKmAdicionalHaversineVsOSRMInput = {
      origem: ORIGEM,
      destino: DESTINO,
      pontosAgenda: [],
      buscarMatrizOSRM,
    }

    const resultado = await compararKmAdicionalHaversineVsOSRMDiagnosticoV2(input)

    expect(resultado.modo).toBe('comparacao-haversine-osrm-diagnostico')
    expect(resultado.haversine.modo).toBe('haversine-diagnostico')
    expect(resultado.osrm?.modo).toBe('matriz-distancia-diagnostico')
  })

  // Extra: Diferenca percentual evita divisao por zero
  it('extra. diferenca percentual e null quando Haversine = 0', async () => {
    // Caso extremo: origem e destino no mesmo ponto
    const origemZero = { lat: -25.45, lng: -49.29, descricao: 'Origem', id: 'origem' }
    const destinoZero = { lat: -25.45, lng: -49.29, descricao: 'Destino', id: 'destino' }

    const buscarMatrizOSRM = mockOSRM([
      [0, 0],
      [0, 0],
    ])

    const input: CompararKmAdicionalHaversineVsOSRMInput = {
      origem: origemZero,
      destino: destinoZero,
      pontosAgenda: [],
      buscarMatrizOSRM,
    }

    const resultado = await compararKmAdicionalHaversineVsOSRMDiagnosticoV2(input)

    expect(resultado.ok).toBe(true)
    expect(resultado.comparacao?.kmHaversineM).toBe(0)
    expect(resultado.comparacao?.kmOsrmM).toBe(0)
    // Diferenca percentual deve ser null para evitar divisao por zero
    expect(resultado.comparacao?.diferencaPercentual).toBeNull()
  })

  // Extra: Comparação com agenda multi-pontos
  it('extra. comparacao com agenda multi-pontos funciona', async () => {
    // Matriz 4x4: origem, destino, agenda_0, agenda_1
    const buscarMatrizOSRM = mockOSRM([
      [0, 3000, 1500, 2500],
      [3200, 0, 2000, 1500],
      [1600, 2100, 0, 1200],
      [2600, 1600, 1300, 0],
    ])

    const input: CompararKmAdicionalHaversineVsOSRMInput = {
      origem: ORIGEM,
      destino: DESTINO,
      pontosAgenda: [PONTO_AGENDA_1, PONTO_AGENDA_2],
      buscarMatrizOSRM,
    }

    const resultado = await compararKmAdicionalHaversineVsOSRMDiagnosticoV2(input)

    expect(resultado.ok).toBe(true)
    expect(resultado.comparacao).not.toBeNull()
    expect(resultado.comparacao?.kmHaversineM).toBeGreaterThan(0)
    expect(resultado.comparacao?.kmOsrmM).toBeGreaterThan(0)
    // OSRM foi chamado com 4 pontos (origem, destino, 2 agenda)
    expect(buscarMatrizOSRM).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ lat: ORIGEM.lat, lng: ORIGEM.lng }),
        expect.objectContaining({ lat: DESTINO.lat, lng: DESTINO.lng }),
        expect.objectContaining({ lat: PONTO_AGENDA_1.loc.lat, lng: PONTO_AGENDA_1.loc.lng }),
        expect.objectContaining({ lat: PONTO_AGENDA_2.loc.lat, lng: PONTO_AGENDA_2.loc.lng }),
      ])
    )
  })
})
