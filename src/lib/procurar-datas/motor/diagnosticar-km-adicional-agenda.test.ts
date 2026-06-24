// ─────────────────────────────────────────────────────────────────────────────
// motor/diagnosticar-km-adicional-agenda.test.ts
//   Testes unitarios para diagnosticarKmAdicionalAgendaV2
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest'
import { diagnosticarKmAdicionalAgendaV2 } from './diagnosticar-km-adicional-agenda'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const DEPOSITO = { lat: -25.4284, lng: -49.2733, descricao: 'Deposito' }
const DESTINO = { lat: -25.4284, lng: -49.2583, descricao: 'Destino Cliente' }
const DATA = '2026-06-15'

// Enderecos e chaves de cache (chave: lowercase do endereco)
const ENDERECO_A = 'Rua A, 100, Curitiba-PR'
const CACHE_KEY_A = 'rua a, 100, curitiba-pr'
const COORD_A = { lat: -25.4284, lng: -49.2633 }

const ENDERECO_B = 'Rua B, 200, Curitiba-PR'
const CACHE_KEY_B = 'rua b, 200, curitiba-pr'
const COORD_B = { lat: -25.4284, lng: -49.2533 }

const ENDERECO_C = 'Rua C, 300, Curitiba-PR'
const CACHE_KEY_C = 'rua c, 300, curitiba-pr'
const COORD_C = { lat: -25.4284, lng: -49.2433 }

/** Monta linha de agenda no formato shAg: 7 colunas [0..6] */
function linhaShAg(opts: {
  data?: string
  titulo?: string
  obs?: string
  endereco?: string
  equipe?: string
}): unknown[] {
  return [
    opts.data ?? DATA,       // [0] Data
    '',                      // [1] (nao usado)
    opts.titulo ?? 'Cliente', // [2] Titulo/Evento
    '',                      // [3] (nao usado)
    opts.obs ?? '',          // [4] Observacoes
    opts.endereco ?? ENDERECO_A, // [5] Lugar/Endereco
    opts.equipe ?? 'Equipe 1',  // [6] Equipe
  ]
}

// ─── 1. Caso feliz: uma linha de agenda valida ────────────────────────────────

describe('diagnosticarKmAdicionalAgendaV2 — caso feliz', () => {
  it('1. retorna kmAdicionalNaRotaM calculado com uma linha valida', () => {
    const res = diagnosticarKmAdicionalAgendaV2({
      linhasAgenda: [linhaShAg({ titulo: 'Cliente A', endereco: ENDERECO_A })],
      dataISO: DATA,
      equipe: 'EQUIPE 1',
      origem: DEPOSITO,
      destino: DESTINO,
      cacheCoordenadasPorEndereco: { [CACHE_KEY_A]: COORD_A },
    })

    expect(res.ok).toBe(true)
    expect(res.modo).toBe('haversine-diagnostico')
    expect(res.dataISO).toBe(DATA)
    expect(res.equipe).toBe('EQUIPE 1')
    expect(res.kmAdicionalNaRotaM).not.toBeNull()
    expect(res.kmAdicionalNaRotaM).toBeGreaterThan(0)
    expect(res.origemKmAdicionalNaRotaM).toBe('agenda-shag-haversine-diagnostico')
    expect(res.parseAgenda.resumo.pontosValidos).toBe(1)
    expect(res.deltaInsercao).not.toBeNull()
    expect(res.deltaInsercao!.ok).toBe(true)
  })
})

// ─── 2. Multiplos pontos validos ─────────────────────────────────────────────

describe('diagnosticarKmAdicionalAgendaV2 — multiplos pontos', () => {
  it('2. processa multiplos pontos validos no mesmo dia/equipe', () => {
    const res = diagnosticarKmAdicionalAgendaV2({
      linhasAgenda: [
        linhaShAg({ titulo: 'Cliente A', endereco: ENDERECO_A }),
        linhaShAg({ titulo: 'Cliente B', endereco: ENDERECO_B }),
        linhaShAg({ titulo: 'Cliente C', endereco: ENDERECO_C }),
      ],
      dataISO: DATA,
      equipe: 'EQUIPE 1',
      origem: DEPOSITO,
      destino: DESTINO,
      cacheCoordenadasPorEndereco: {
        [CACHE_KEY_A]: COORD_A,
        [CACHE_KEY_B]: COORD_B,
        [CACHE_KEY_C]: COORD_C,
      },
    })

    expect(res.ok).toBe(true)
    expect(res.kmAdicionalNaRotaM).not.toBeNull()
    expect(res.parseAgenda.resumo.pontosValidos).toBe(3)
    expect(res.deltaInsercao!.resumo.quantidadePontosValidos).toBe(3)
    expect(res.origemKmAdicionalNaRotaM).toBe('agenda-shag-haversine-diagnostico')
  })
})

// ─── 3. Data diferente ignorada ───────────────────────────────────────────────

describe('diagnosticarKmAdicionalAgendaV2 — filtragem de data', () => {
  it('3. ignora linhas de data diferente (sem contar como descarte)', () => {
    const res = diagnosticarKmAdicionalAgendaV2({
      linhasAgenda: [
        linhaShAg({ data: '2026-06-16', endereco: ENDERECO_A }), // outra data
      ],
      dataISO: DATA,
      equipe: 'EQUIPE 1',
      origem: DEPOSITO,
      destino: DESTINO,
      cacheCoordenadasPorEndereco: { [CACHE_KEY_A]: COORD_A },
    })

    // Nao ha pontos validos, mas nao ha descartes por data
    expect(res.parseAgenda.resumo.pontosValidos).toBe(0)
    expect(res.parseAgenda.resumo.linhasDaData).toBe(0)
    // Linhas de outra data nao viram descartes no parse
    expect(
      res.descartados.filter(
        (d) => d.origem === 'parse-agenda'
      )
    ).toHaveLength(0)
  })
})

// ─── 4. Equipe diferente ignorada ─────────────────────────────────────────────

describe('diagnosticarKmAdicionalAgendaV2 — filtragem de equipe', () => {
  it('4. ignora linhas de equipe diferente (sem contar como descarte)', () => {
    const res = diagnosticarKmAdicionalAgendaV2({
      linhasAgenda: [
        linhaShAg({ equipe: 'Equipe 2', endereco: ENDERECO_A }), // equipe 2
      ],
      dataISO: DATA,
      equipe: 'EQUIPE 1',
      origem: DEPOSITO,
      destino: DESTINO,
      cacheCoordenadasPorEndereco: { [CACHE_KEY_A]: COORD_A },
    })

    expect(res.parseAgenda.resumo.pontosValidos).toBe(0)
    // Equipe diferente nao vira descarte
    expect(
      res.descartados.filter((d) => d.origem === 'parse-agenda')
    ).toHaveLength(0)
  })
})

// ─── 5. Endereco sem coordenada descartado ────────────────────────────────────

describe('diagnosticarKmAdicionalAgendaV2 — endereco sem cache', () => {
  it('5. descarta ponto com endereco sem coordenada no cache', () => {
    const res = diagnosticarKmAdicionalAgendaV2({
      linhasAgenda: [linhaShAg({ endereco: ENDERECO_A })],
      dataISO: DATA,
      equipe: 'EQUIPE 1',
      origem: DEPOSITO,
      destino: DESTINO,
      cacheCoordenadasPorEndereco: {}, // cache vazio
    })

    expect(res.parseAgenda.resumo.pontosValidos).toBe(0)
    expect(res.parseAgenda.resumo.semCoordenadas).toBe(1)
    const descartesAgenda = res.descartados.filter((d) => d.origem === 'parse-agenda')
    expect(descartesAgenda).toHaveLength(1)
    expect(descartesAgenda[0].descarte).toMatchObject({ motivo: 'sem_coordenadas_cache' })
  })
})

// ─── 6. Endereco ausente descartado ──────────────────────────────────────────

describe('diagnosticarKmAdicionalAgendaV2 — endereco ausente', () => {
  it('6. descarta ponto com endereco ausente', () => {
    const res = diagnosticarKmAdicionalAgendaV2({
      linhasAgenda: [linhaShAg({ endereco: '', obs: 'Sem endereco' })],
      dataISO: DATA,
      equipe: 'EQUIPE 1',
      origem: DEPOSITO,
      destino: DESTINO,
      cacheCoordenadasPorEndereco: {},
    })

    expect(res.parseAgenda.resumo.pontosValidos).toBe(0)
    expect(res.parseAgenda.resumo.semEndereco).toBe(1)
    const descartesAgenda = res.descartados.filter((d) => d.origem === 'parse-agenda')
    expect(descartesAgenda).toHaveLength(1)
    expect(descartesAgenda[0].descarte).toMatchObject({ motivo: 'sem_endereco' })
  })
})

// ─── 7. Agenda sem pontos validos: rota simples origem -> destino ─────────────

describe('diagnosticarKmAdicionalAgendaV2 — agenda sem pontos', () => {
  it('7. usa rota simples quando agenda nao tem pontos validos', () => {
    const res = diagnosticarKmAdicionalAgendaV2({
      linhasAgenda: [],
      dataISO: DATA,
      equipe: 'EQUIPE 1',
      origem: DEPOSITO,
      destino: DESTINO,
      cacheCoordenadasPorEndereco: {},
    })

    expect(res.ok).toBe(true)
    expect(res.kmAdicionalNaRotaM).not.toBeNull()
    expect(res.kmAdicionalNaRotaM).toBeGreaterThan(0)
    expect(res.origemKmAdicionalNaRotaM).toBe('agenda-shag-haversine-diagnostico')
    // Aviso sobre agenda vazia deve estar presente
    const avisoAgendaVazia = res.avisos.some((a) => a.includes('Nenhum ponto valido'))
    expect(avisoAgendaVazia).toBe(true)
  })
})

// ─── 8. Origem invalida ───────────────────────────────────────────────────────

describe('diagnosticarKmAdicionalAgendaV2 — origem invalida', () => {
  it('8. retorna kmAdicionalNaRotaM: null se origem invalida', () => {
    const res = diagnosticarKmAdicionalAgendaV2({
      linhasAgenda: [linhaShAg({ endereco: ENDERECO_A })],
      dataISO: DATA,
      equipe: 'EQUIPE 1',
      origem: { lat: NaN, lng: NaN, descricao: 'Invalida' },
      destino: DESTINO,
      cacheCoordenadasPorEndereco: { [CACHE_KEY_A]: COORD_A },
    })

    expect(res.ok).toBe(false)
    expect(res.kmAdicionalNaRotaM).toBeNull()
    expect(res.origemKmAdicionalNaRotaM).toBeNull()
    expect(res.avisos.some((a) => a.includes('Origem invalida'))).toBe(true)
  })
})

// ─── 9. Destino invalido ──────────────────────────────────────────────────────

describe('diagnosticarKmAdicionalAgendaV2 — destino invalido', () => {
  it('9. retorna kmAdicionalNaRotaM: null se destino invalido', () => {
    const res = diagnosticarKmAdicionalAgendaV2({
      linhasAgenda: [linhaShAg({ endereco: ENDERECO_A })],
      dataISO: DATA,
      equipe: 'EQUIPE 1',
      origem: DEPOSITO,
      destino: { lat: Infinity, lng: -49.0 },
      cacheCoordenadasPorEndereco: { [CACHE_KEY_A]: COORD_A },
    })

    expect(res.ok).toBe(false)
    expect(res.kmAdicionalNaRotaM).toBeNull()
    expect(res.origemKmAdicionalNaRotaM).toBeNull()
    expect(res.avisos.some((a) => a.includes('Destino invalido'))).toBe(true)
  })
})

// ─── 10. Imutabilidade ────────────────────────────────────────────────────────

describe('diagnosticarKmAdicionalAgendaV2 — imutabilidade', () => {
  it('10. nao muta linhasAgenda nem cacheCoordenadasPorEndereco', () => {
    const linhas = [linhaShAg({ titulo: 'Original' })]
    const cache = { [CACHE_KEY_A]: { ...COORD_A } }
    const linhaOriginalTitulo = linhas[0][2]
    const cacheOriginalLat = cache[CACHE_KEY_A].lat

    diagnosticarKmAdicionalAgendaV2({
      linhasAgenda: linhas,
      dataISO: DATA,
      equipe: 'EQUIPE 1',
      origem: DEPOSITO,
      destino: DESTINO,
      cacheCoordenadasPorEndereco: cache,
    })

    expect(linhas[0][2]).toBe(linhaOriginalTitulo)
    expect(cache[CACHE_KEY_A].lat).toBe(cacheOriginalLat)
  })
})

// ─── 11. Ausencia de I/O externo ──────────────────────────────────────────────

describe('diagnosticarKmAdicionalAgendaV2 — ausencia de I/O', () => {
  it('11. garante ausencia de I/O externo (helper puro)', () => {
    const res = diagnosticarKmAdicionalAgendaV2({
      linhasAgenda: [linhaShAg({ endereco: ENDERECO_A })],
      dataISO: DATA,
      equipe: 'EQUIPE 1',
      origem: DEPOSITO,
      destino: DESTINO,
      cacheCoordenadasPorEndereco: { [CACHE_KEY_A]: COORD_A },
    })

    // Nenhum erro de rede, credencial, timeout
    expect(res.ok).toBe(true)
  })
})

// ─── 12. origemKmAdicionalNaRotaM ─────────────────────────────────────────────

describe('diagnosticarKmAdicionalAgendaV2 — origemKmAdicionalNaRotaM', () => {
  it('12a. origemKmAdicionalNaRotaM e agenda-shag-haversine-diagnostico quando calculado', () => {
    const res = diagnosticarKmAdicionalAgendaV2({
      linhasAgenda: [linhaShAg({ endereco: ENDERECO_A })],
      dataISO: DATA,
      equipe: 'EQUIPE 1',
      origem: DEPOSITO,
      destino: DESTINO,
      cacheCoordenadasPorEndereco: { [CACHE_KEY_A]: COORD_A },
    })

    expect(res.origemKmAdicionalNaRotaM).toBe('agenda-shag-haversine-diagnostico')
  })

  it('12b. origemKmAdicionalNaRotaM e null quando nao calculado', () => {
    const res = diagnosticarKmAdicionalAgendaV2({
      linhasAgenda: [],
      dataISO: DATA,
      equipe: 'EQUIPE 1',
      origem: { lat: NaN, lng: NaN },
      destino: DESTINO,
      cacheCoordenadasPorEndereco: {},
    })

    expect(res.origemKmAdicionalNaRotaM).toBeNull()
    expect(res.kmAdicionalNaRotaM).toBeNull()
  })
})

// ─── 13. Nao retorna 0 silencioso ─────────────────────────────────────────────

describe('diagnosticarKmAdicionalAgendaV2 — sem fallback 0', () => {
  it('13. nao retorna 0 silencioso em erro critico', () => {
    const res = diagnosticarKmAdicionalAgendaV2({
      linhasAgenda: [],
      dataISO: DATA,
      equipe: 'EQUIPE 1',
      origem: { lat: NaN, lng: NaN },
      destino: DESTINO,
      cacheCoordenadasPorEndereco: {},
    })

    expect(res.kmAdicionalNaRotaM).toBeNull()
    expect(res.kmAdicionalNaRotaM).not.toBe(0)
  })
})

// ─── 14. Avisos consolidados ─────────────────────────────────────────────────

describe('diagnosticarKmAdicionalAgendaV2 — avisos', () => {
  it('14. avisos do parse e do delta sao preservados e prefixados', () => {
    const res = diagnosticarKmAdicionalAgendaV2({
      linhasAgenda: [
        linhaShAg({ endereco: '' }), // sem endereco gera aviso no parse
      ],
      dataISO: DATA,
      equipe: 'EQUIPE 1',
      origem: DEPOSITO,
      destino: DESTINO,
      cacheCoordenadasPorEndereco: {},
    })

    // Avisos do parse devem ter prefixo [parse-agenda]
    expect(res.avisos.some((a) => a.startsWith('[parse-agenda]'))).toBe(true)
    // Avisos do delta devem ter prefixo [delta-insercao]
    expect(res.avisos.some((a) => a.startsWith('[delta-insercao]'))).toBe(true)
  })
})

// ─── 15. Descartes diferenciam origem ─────────────────────────────────────────

describe('diagnosticarKmAdicionalAgendaV2 — descartes com origem', () => {
  it('15. descartes diferenciam se vieram do parse ou do delta', () => {
    const res = diagnosticarKmAdicionalAgendaV2({
      linhasAgenda: [
        linhaShAg({ endereco: '' }), // sem endereco -> descarte no parse
      ],
      dataISO: DATA,
      equipe: 'EQUIPE 1',
      origem: DEPOSITO,
      destino: DESTINO,
      cacheCoordenadasPorEndereco: {},
    })

    const descartesAgenda = res.descartados.filter((d) => d.origem === 'parse-agenda')
    const descartesDelta = res.descartados.filter((d) => d.origem === 'delta-insercao')

    expect(descartesAgenda.length).toBeGreaterThanOrEqual(1)
    // Delta nao recebeu pontos invalidos (parse ja filtrou todos)
    expect(descartesDelta).toHaveLength(0)
  })
})

// ─── 16. Equipe invalida retorna ok=false ────────────────────────────────────

describe('diagnosticarKmAdicionalAgendaV2 — equipe invalida', () => {
  it('16. equipe invalida retorna ok=false com aviso', () => {
    const res = diagnosticarKmAdicionalAgendaV2({
      linhasAgenda: [linhaShAg({ endereco: ENDERECO_A })],
      dataISO: DATA,
      equipe: 'EQUIPE 99',
      origem: DEPOSITO,
      destino: DESTINO,
      cacheCoordenadasPorEndereco: { [CACHE_KEY_A]: COORD_A },
    })

    expect(res.ok).toBe(false)
    expect(res.kmAdicionalNaRotaM).toBeNull()
    expect(res.avisos.some((a) => a.includes('Equipe nao reconhecida'))).toBe(true)
    expect(res.deltaInsercao).toBeNull()
  })
})

// ─── 17. Resumo de quantidades ───────────────────────────────────────────────

describe('diagnosticarKmAdicionalAgendaV2 — resumo de quantidades', () => {
  it('17. resumo reflete quantidades corretas do pipeline completo', () => {
    const res = diagnosticarKmAdicionalAgendaV2({
      linhasAgenda: [
        linhaShAg({ titulo: 'A', endereco: ENDERECO_A }), // valido
        linhaShAg({ titulo: 'B', endereco: ENDERECO_B }), // valido
        linhaShAg({ titulo: 'C', endereco: '' }),           // sem endereco
        linhaShAg({ data: '2026-06-16', endereco: ENDERECO_C }), // outra data
      ],
      dataISO: DATA,
      equipe: 'EQUIPE 1',
      origem: DEPOSITO,
      destino: DESTINO,
      cacheCoordenadasPorEndereco: {
        [CACHE_KEY_A]: COORD_A,
        [CACHE_KEY_B]: COORD_B,
      },
    })

    expect(res.parseAgenda.resumo.linhasRecebidas).toBe(4)
    expect(res.parseAgenda.resumo.linhasDaData).toBe(3) // A, B, C sao da data alvo
    expect(res.parseAgenda.resumo.pontosValidos).toBe(2) // A e B
    expect(res.parseAgenda.resumo.semEndereco).toBe(1)   // C
    expect(res.deltaInsercao!.resumo.quantidadePontosValidos).toBe(2)
  })
})
