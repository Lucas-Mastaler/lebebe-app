import { describe, expect, it, vi } from 'vitest'
import { calcularKmAdicionalRealControladoV2 } from './calcular-km-adicional-real-controlado'
import type { BuscarMatrizOSRM, ResultadoMatrizOSRM } from './preparar-matriz-osrm-diagnostico'
import type { Coordenada } from './distancia'

const CONFIG_ORIGEM = {
  latDeposito: -25.5,
  lngDeposito: -49.3,
  latCasaE1: -25.49,
  lngCasaE1: -49.28,
  latCasaE2: -25.48,
  lngCasaE2: -49.27,
}

const DESTINO = { lat: -25.42, lng: -49.27, descricao: 'Destino' }

function linhaAgenda(titulo: string, endereco: string, equipe = 'EQUIPE 1', data = '2026-06-15') {
  return [data, '', titulo, '', '', endereco, equipe]
}

function buscarMatrizPorCoordenada(tabela: Record<string, number | null>): BuscarMatrizOSRM {
  return vi.fn(async (coordenadas) => {
    const distances = coordenadas.map((de: Coordenada) =>
      coordenadas.map((para: Coordenada) => tabela[`${de.lat},${de.lng}->${para.lat},${para.lng}`] ?? 9999)
    )
    return { distances }
  })
}

function buscarMatrizCompleta(valor: number): BuscarMatrizOSRM {
  return vi.fn(async (coordenadas) => ({
    distances: coordenadas.map(() => coordenadas.map(() => valor)),
  }))
}

function cacheAgenda() {
  return {
    'rua a, 100 - curitiba - pr, 80000-000': { lat: -25.44, lng: -49.28 },
    'rua b, 200 - curitiba - pr, 80000-000': { lat: -25.43, lng: -49.275 },
    'rua c, 300 - curitiba - pr, 80000-000': { lat: -25.425, lng: -49.265 },
  }
}

describe('calcularKmAdicionalRealControladoV2', () => {
  it('calcula delta simples com tres pontos e retorna metros', async () => {
    const origem = { lat: CONFIG_ORIGEM.latDeposito, lng: CONFIG_ORIGEM.lngDeposito }
    const a = cacheAgenda()['rua a, 100 - curitiba - pr, 80000-000']
    const tabela: Record<string, number> = {
      [`${origem.lat},${origem.lng}->${a.lat},${a.lng}`]: 1000,
      [`${origem.lat},${origem.lng}->${DESTINO.lat},${DESTINO.lng}`]: 700,
      [`${DESTINO.lat},${DESTINO.lng}->${a.lat},${a.lng}`]: 500,
      [`${a.lat},${a.lng}->${DESTINO.lat},${DESTINO.lng}`]: 1400,
    }

    const resultado = await calcularKmAdicionalRealControladoV2({
      dataISO: '2026-06-15',
      equipe: 'EQUIPE 1',
      configOrigem: CONFIG_ORIGEM,
      destino: DESTINO,
      linhasAgenda: [linhaAgenda('A', 'Rua A, 100 - Curitiba - PR, 80000-000')],
      disponibilidade: { tempoUtilizadoMin: 120, disponivelMin: 300, capacidadeTotalMin: 420 },
      cacheCoordenadasPorEndereco: cacheAgenda(),
      buscarMatrizOSRM: buscarMatrizPorCoordenada(tabela),
    })

    expect(resultado.ok).toBe(true)
    expect(resultado.kmAdicionalNaRotaM).toBe(200)
    expect(resultado.origemKmAdicionalNaRotaM).toBe('osrm-table-diagnostico')
    expect(resultado.consistenciaEspacial?.estado).toBe('com-pontos-validos')
    expect(resultado.deltaInsercao?.melhorInsercao?.indiceInsercao).toBe(0)
    expect(Number.isInteger(resultado.kmAdicionalNaRotaM)).toBe(true)
  })

  it('descarta slot com pontos pelo filtro early Haversine legado antes do delta', async () => {
    const buscarMatrizOSRM = vi.fn<BuscarMatrizOSRM>(async (coordenadas) => ({
      distances: coordenadas.map((_, i) => coordenadas.map((__, j) => (i === j ? 0 : 1000))),
    }))

    const resultado = await calcularKmAdicionalRealControladoV2({
      dataISO: '2026-06-15',
      equipe: 'EQUIPE 1',
      configOrigem: CONFIG_ORIGEM,
      configFiltroEarlyLegado: {
        kmMaxEntrePontosKm: 1,
        kmAdicionalMaxNaRotaPremiumM: 1000,
      },
      destino: DESTINO,
      linhasAgenda: [linhaAgenda('A', 'Rua A, 100 - Curitiba - PR, 80000-000')],
      cacheCoordenadasPorEndereco: cacheAgenda(),
      buscarMatrizOSRM,
      incluirDetalhesInsercao: true,
    })

    expect(resultado.ok).toBe(true)
    expect(resultado.kmAdicionalNaRotaM).toBeNull()
    expect(resultado.origemKmAdicionalNaRotaM).toBe('filtrado-early-legado-diagnostico')
    expect(resultado.filtroEarlyLegado).toMatchObject({
      aplicado: true,
      descartado: true,
      motivo: 'haversine-reta',
      limiteHaversineKm: 1.5,
    })
    expect(resultado.deltaInsercao).toBeNull()
  })

  it('descarta slot pela ancora OSRM legado quando distancia da ancora excede limite premium', async () => {
    const c = cacheAgenda()
    const perto = c['rua c, 300 - curitiba - pr, 80000-000']
    const buscarMatrizOSRM = buscarMatrizPorCoordenada({
      [`${perto.lat},${perto.lng}->${DESTINO.lat},${DESTINO.lng}`]: 2500,
    })

    const resultado = await calcularKmAdicionalRealControladoV2({
      dataISO: '2026-06-15',
      equipe: 'EQUIPE 1',
      configOrigem: CONFIG_ORIGEM,
      configFiltroEarlyLegado: {
        kmMaxEntrePontosKm: 1,
        kmAdicionalMaxNaRotaPremiumM: 1000,
      },
      destino: DESTINO,
      linhasAgenda: [linhaAgenda('C', 'Rua C, 300 - Curitiba - PR, 80000-000')],
      cacheCoordenadasPorEndereco: c,
      buscarMatrizOSRM,
    })

    expect(resultado.ok).toBe(true)
    expect(resultado.kmAdicionalNaRotaM).toBeNull()
    expect(resultado.origemKmAdicionalNaRotaM).toBe('filtrado-early-legado-diagnostico')
    expect(resultado.filtroEarlyLegado).toMatchObject({
      aplicado: true,
      descartado: true,
      motivo: 'ancora-osrm-premium',
      ancoraDistanciaKm: 2.5,
      limiteAncoraPremiumKm: 2,
      ancoraCep: '80000000',
    })
  })

  it('escolhe a melhor insercao entre multiplos pontos', async () => {
    const origem = { lat: CONFIG_ORIGEM.latDeposito, lng: CONFIG_ORIGEM.lngDeposito }
    const c = cacheAgenda()
    const a = c['rua a, 100 - curitiba - pr, 80000-000']
    const b = c['rua b, 200 - curitiba - pr, 80000-000']
    const tabela: Record<string, number> = {
      [`${origem.lat},${origem.lng}->${a.lat},${a.lng}`]: 500,
      [`${origem.lat},${origem.lng}->${DESTINO.lat},${DESTINO.lng}`]: 1000,
      [`${DESTINO.lat},${DESTINO.lng}->${a.lat},${a.lng}`]: 1000,
      [`${a.lat},${a.lng}->${b.lat},${b.lng}`]: 900,
      [`${a.lat},${a.lng}->${DESTINO.lat},${DESTINO.lng}`]: 300,
      [`${DESTINO.lat},${DESTINO.lng}->${b.lat},${b.lng}`]: 300,
      [`${b.lat},${b.lng}->${DESTINO.lat},${DESTINO.lng}`]: 800,
    }

    const resultado = await calcularKmAdicionalRealControladoV2({
      dataISO: '2026-06-15',
      equipe: 'Equipe 1',
      configOrigem: CONFIG_ORIGEM,
      destino: DESTINO,
      linhasAgenda: [
        linhaAgenda('A', 'Rua A, 100 - Curitiba - PR, 80000-000'),
        linhaAgenda('B', 'Rua B, 200 - Curitiba - PR, 80000-000'),
      ],
      cacheCoordenadasPorEndereco: c,
      buscarMatrizOSRM: buscarMatrizPorCoordenada(tabela),
    })

    expect(resultado.ok).toBe(true)
    expect(resultado.kmAdicionalNaRotaM).toBe(-300)
    expect(resultado.deltaInsercao?.melhorInsercao?.indiceInsercao).toBe(1)
  })

  it('monta rota base, candidatos e melhor insercao para os dois pontos de 03/07 quando ha cache', async () => {
    const configOrigem0307 = {
      ...CONFIG_ORIGEM,
      latDeposito: -25.4876648,
      lngDeposito: -49.2692262,
    }
    const origem = { lat: configOrigem0307.latDeposito, lng: configOrigem0307.lngDeposito }
    const rioIvai = { lat: -25.4665832, lng: -49.1853016 }
    const saoJose = { lat: -25.4352613, lng: -49.2415798 }
    const enderecoRioIvai = 'Rua Rio Ivai, 269, Weissopolis, Pinhais - PR, 83322-370'
    const enderecoSaoJose = 'Avenida Sao Jose, 814, Cristo Rei, Curitiba - PR, 80050-350'
    const cache = {
      'rua rio ivai, 269, weissopolis, pinhais - pr, 83322-370': rioIvai,
      'avenida sao jose, 814, cristo rei, curitiba - pr, 80050-350': saoJose,
    }
    const tabela: Record<string, number> = {
      [`${origem.lat},${origem.lng}->${DESTINO.lat},${DESTINO.lng}`]: 12000,
      [`${origem.lat},${origem.lng}->${saoJose.lat},${saoJose.lng}`]: 6450,
      [`${origem.lat},${origem.lng}->${rioIvai.lat},${rioIvai.lng}`]: 8740,
      [`${DESTINO.lat},${DESTINO.lng}->${saoJose.lat},${saoJose.lng}`]: 9000,
      [`${DESTINO.lat},${DESTINO.lng}->${rioIvai.lat},${rioIvai.lng}`]: 2430,
      [`${saoJose.lat},${saoJose.lng}->${DESTINO.lat},${DESTINO.lng}`]: 5000,
      [`${saoJose.lat},${saoJose.lng}->${rioIvai.lat},${rioIvai.lng}`]: 2000,
      [`${rioIvai.lat},${rioIvai.lng}->${DESTINO.lat},${DESTINO.lng}`]: 12074,
    }

    const resultado = await calcularKmAdicionalRealControladoV2({
      dataISO: '2026-07-03',
      equipe: 'EQUIPE 1',
      configOrigem: configOrigem0307,
      destino: DESTINO,
      linhasAgenda: [
        linhaAgenda('Rio Ivai', enderecoRioIvai, '4- EQUIPE 01', '03/07/2026 00:00:00'),
        linhaAgenda('Sao Jose', enderecoSaoJose, '4- EQUIPE 01', '03/07/2026 00:00:00'),
      ],
      cacheCoordenadasPorEndereco: cache,
      buscarMatrizOSRM: buscarMatrizPorCoordenada(tabela),
      incluirDetalhesInsercao: true,
    })

    expect(resultado.ok).toBe(true)
    expect(resultado.parseAgenda?.resumo).toMatchObject({
      linhasDaData: 2,
      linhasDaEquipe: 2,
      pontosValidos: 2,
      semCoordenadas: 0,
    })
    expect(resultado.descartados).toHaveLength(0)
    expect(resultado.deltaInsercao?.pontosRotaBase).toHaveLength(3)
    expect(resultado.deltaInsercao?.pontosRotaBase?.map((p) => p.endereco).slice(1)).toEqual([
      enderecoSaoJose,
      enderecoRioIvai,
    ])
    expect(resultado.ordenacaoRotaBase).toMatchObject({
      criterioOrdenacao: 'greedy-haversine',
      twoOptExecutado: false,
      twoOptAplicado: false,
      ordemOriginal: [enderecoRioIvai, enderecoSaoJose],
      ordemOtimizada: ['DEPOSITO', enderecoSaoJose, enderecoRioIvai],
    })
    expect(resultado.deltaInsercao?.candidatosInsercao).toHaveLength(3)
    expect(resultado.deltaInsercao?.melhorInsercao).toBeDefined()
    expect(resultado.kmAdicionalNaRotaM).toBe(5430)
  })

  it('dia util usa deposito e sabado usa casa da equipe', async () => {
    const diaUtil = await calcularKmAdicionalRealControladoV2({
      dataISO: '2026-06-15',
      equipe: 'EQUIPE 1',
      configOrigem: CONFIG_ORIGEM,
      destino: DESTINO,
      linhasAgenda: [],
      disponibilidade: { tempoUtilizadoMin: 0, disponivelMin: 420, capacidadeTotalMin: 420 },
      cacheCoordenadasPorEndereco: {},
      buscarMatrizOSRM: buscarMatrizCompleta(1234),
    })
    const sabado = await calcularKmAdicionalRealControladoV2({
      dataISO: '2026-06-20',
      equipe: 'EQUIPE 2',
      configOrigem: CONFIG_ORIGEM,
      destino: DESTINO,
      linhasAgenda: [],
      disponibilidade: { tempoUtilizadoMin: 0, disponivelMin: 240, capacidadeTotalMin: 240 },
      cacheCoordenadasPorEndereco: {},
      buscarMatrizOSRM: buscarMatrizCompleta(1234),
    })

    expect(diaUtil.origemOperacional.ok && diaUtil.origemOperacional.tipo).toBe('deposito')
    expect(sabado.origemOperacional.ok && sabado.origemOperacional.tipo).toBe('casa-e2')
  })

  it('nao valida rota simples quando ha ponto real da agenda sem coordenada', async () => {
    const resultado = await calcularKmAdicionalRealControladoV2({
      dataISO: '2026-06-15',
      equipe: 'EQUIPE 1',
      configOrigem: CONFIG_ORIGEM,
      destino: DESTINO,
      linhasAgenda: [linhaAgenda('SEM CACHE', 'Rua Sem Cache, 1 - Curitiba - PR, 80000-000')],
      cacheCoordenadasPorEndereco: {},
      buscarMatrizOSRM: buscarMatrizCompleta(4321),
    })

    expect(resultado.ok).toBe(true)
    expect(resultado.parseAgenda?.resumo.semCoordenadas).toBe(1)
    expect(resultado.kmAdicionalNaRotaM).toBeNull()
    expect(resultado.origemKmAdicionalNaRotaM).toBe('agenda-sem-coordenadas-producao')
    expect(resultado.deltaInsercao).toBeNull()
    expect(resultado.consistenciaEspacial?.estado).toBe('agenda-sem-coordenadas')
    expect(resultado.avisos.join(' ')).toContain('Slot bloqueado por inconsistência espacial')
  })

  it('bloqueia rota simples quando a disponibilidade prova ocupacao sem pontos', async () => {
    const buscarMatrizOSRM = vi.fn<BuscarMatrizOSRM>()
    const resultado = await calcularKmAdicionalRealControladoV2({
      dataISO: '2026-07-28',
      equipe: 'EQUIPE 1',
      configOrigem: CONFIG_ORIGEM,
      destino: DESTINO,
      linhasAgenda: [],
      disponibilidade: { tempoUtilizadoMin: 315, disponivelMin: 105, capacidadeTotalMin: 420 },
      cacheCoordenadasPorEndereco: {},
      buscarMatrizOSRM,
    })

    expect(resultado.ok).toBe(true)
    expect(resultado.kmAdicionalNaRotaM).toBeNull()
    expect(resultado.origemKmAdicionalNaRotaM).toBe('slot-espacial-inconsistente')
    expect(resultado.consistenciaEspacial).toMatchObject({
      estado: 'ocupado-sem-pontos',
      bloqueado: true,
      rotaSimplesPermitida: false,
    })
    expect(buscarMatrizOSRM).not.toHaveBeenCalled()
  })

  it('bloqueia somente o slot quando existe evento sem endereco', async () => {
    const buscarMatrizOSRM = vi.fn<BuscarMatrizOSRM>()
    const resultado = await calcularKmAdicionalRealControladoV2({
      dataISO: '2026-07-28',
      equipe: 'EQUIPE 1',
      configOrigem: CONFIG_ORIGEM,
      destino: DESTINO,
      linhasAgenda: [linhaAgenda('EVENTO SEM ENDERECO', '', 'EQUIPE 1', '2026-07-28')],
      disponibilidade: { tempoUtilizadoMin: 60, disponivelMin: 360, capacidadeTotalMin: 420 },
      cacheCoordenadasPorEndereco: {},
      buscarMatrizOSRM,
    })

    expect(resultado.ok).toBe(true)
    expect(resultado.kmAdicionalNaRotaM).toBeNull()
    expect(resultado.consistenciaEspacial?.estado).toBe('agenda-sem-endereco')
    expect(resultado.consistenciaEspacial?.linhasDaEquipe).toBe(1)
    expect(buscarMatrizOSRM).not.toHaveBeenCalled()
  })

  it('falha de OSRM usa fallback Haversine e nao retorna null', async () => {
    const buscarMatrizOSRM = vi.fn<BuscarMatrizOSRM>(async () => {
      throw new Error('OSRM fora')
    })

    const resultado = await calcularKmAdicionalRealControladoV2({
      dataISO: '2026-06-15',
      equipe: 'EQUIPE 1',
      configOrigem: CONFIG_ORIGEM,
      destino: DESTINO,
      linhasAgenda: [],
      disponibilidade: { tempoUtilizadoMin: 0, disponivelMin: 420, capacidadeTotalMin: 420 },
      cacheCoordenadasPorEndereco: {},
      buscarMatrizOSRM,
    })

    expect(resultado.ok).toBe(true)
    expect(resultado.kmAdicionalNaRotaM).toEqual(expect.any(Number))
    expect(resultado.kmAdicionalNaRotaM).not.toBeNull()
    expect(resultado.origemKmAdicionalNaRotaM).toBe('haversine-fallback-legado-diagnostico')
  })

  it('distancias null por par usam fallback Haversine sem retornar null', async () => {
    const buscarMatrizOSRM: BuscarMatrizOSRM = vi.fn(async (coordenadas) => ({
      distances: coordenadas.map(() => coordenadas.map(() => null)),
    }) satisfies ResultadoMatrizOSRM)

    const resultado = await calcularKmAdicionalRealControladoV2({
      dataISO: '2026-06-15',
      equipe: 'EQUIPE 1',
      configOrigem: CONFIG_ORIGEM,
      destino: DESTINO,
      linhasAgenda: [linhaAgenda('A', 'Rua A, 100 - Curitiba - PR, 80000-000')],
      cacheCoordenadasPorEndereco: cacheAgenda(),
      buscarMatrizOSRM,
    })

    expect(resultado.ok).toBe(true)
    expect(resultado.kmAdicionalNaRotaM).toEqual(expect.any(Number))
    expect(resultado.origemKmAdicionalNaRotaM).toBe('haversine-fallback-legado-diagnostico')
  })
})
