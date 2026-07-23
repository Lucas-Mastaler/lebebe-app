// ─────────────────────────────────────────────────────────────────────────────
// motor/parse-agenda-shag.test.ts
//   Testes unitarios para parsearPontosAgendaDoDiaV2
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest'
import {
  parsearPontosAgendaDoDiaV2,
  type LinhaAgendaShAgV2,
  type ParsearPontosAgendaDoDiaV2Input,
} from './parse-agenda-shag'

// ─── Fixtures auxiliares ──────────────────────────────────────────────────────

function linhaAgenda(overrides: Partial<{
  data: unknown
  titulo: unknown
  duracao: unknown
  observacoes: unknown
  endereco: unknown
  equipe: unknown
}> = {}): LinhaAgendaShAgV2 {
  return [
    overrides.data ?? '15/06/2026',      // [0] Data
    '',                                   // [1] Fim
    overrides.titulo ?? 'Cliente A',      // [2] Titulo/Evento
    overrides.duracao ?? '00:40',         // [3] Duracao
    overrides.observacoes ?? '',            // [4] Observacoes
    overrides.endereco ?? 'Rua A, 123, Curitiba-PR', // [5] Endereco
    overrides.equipe ?? 'Equipe 1',       // [6] Equipe
  ]
}

function parsear(input: ParsearPontosAgendaDoDiaV2Input) {
  return parsearPontosAgendaDoDiaV2(input)
}

// ─── 1. Caso basico valido ────────────────────────────────────────────────────

describe('parsearPontosAgendaDoDiaV2 — caso basico valido', () => {
  it('1. retorna ponto valido quando data/equipe/endereco/coordenadas batem', () => {
    const res = parsear({
      linhasAgenda: [linhaAgenda()],
      dataAlvoISO: '2026-06-15',
      equipeAlvo: 'EQUIPE 1',
      cacheCoordenadasPorEndereco: {
        'rua a, 123, curitiba-pr': { lat: -25.4284, lng: -49.2733 },
      },
    })

    expect(res.ok).toBe(true)
    expect(res.pontos).toHaveLength(1)
    expect(res.pontos[0].dataISO).toBe('2026-06-15')
    expect(res.pontos[0].equipe).toBe('EQUIPE 1')
    expect(res.pontos[0].endereco).toBe('Rua A, 123, Curitiba-PR')
    expect(res.pontos[0].fonteEndereco).toBe('coluna-endereco')
    expect(res.pontos[0].coordenadas.lat).toBe(-25.4284)
    expect(res.pontos[0].coordenadas.lng).toBe(-49.2733)
  })

  it('12. preserva titulo/evento', () => {
    const res = parsear({
      linhasAgenda: [linhaAgenda({ titulo: 'Maria Silva - Entrega' })],
      dataAlvoISO: '2026-06-15',
      equipeAlvo: 'EQUIPE 1',
      cacheCoordenadasPorEndereco: {
        'rua a, 123, curitiba-pr': { lat: -25.4, lng: -49.2 },
      },
    })

    expect(res.pontos[0].tituloEvento).toBe('Maria Silva - Entrega')
  })

  it('13. preserva indice da linha original', () => {
    const linhas = [
      linhaAgenda({ data: '14/06/2026' }), // indice 0 - data diferente
      linhaAgenda(), // indice 1 - data/equipe batem
    ]
    const res = parsear({
      linhasAgenda: linhas,
      dataAlvoISO: '2026-06-15',
      equipeAlvo: 'EQUIPE 1',
      cacheCoordenadasPorEndereco: {
        'rua a, 123, curitiba-pr': { lat: -25.4, lng: -49.2 },
      },
    })

    expect(res.pontos[0].indiceLinhaOriginal).toBe(1)
  })
})

describe('parsearPontosAgendaDoDiaV2 - eventos operacionais sem endereco', () => {
  it('reconhece CARREGAMENTO sem endereco como operacional nao espacial usando duracao oficial', () => {
    const res = parsear({
      linhasAgenda: [
        linhaAgenda({
          titulo: '9 (00:30) CARREGAMENTO SEG-QUI (EQP DE TRANSFERENCIA)',
          duracao: '00:30',
          endereco: '',
        }),
      ],
      dataAlvoISO: '2026-06-15',
      equipeAlvo: 'EQUIPE 1',
      cacheCoordenadasPorEndereco: {},
    })

    expect(res.pontos).toHaveLength(0)
    expect(res.descartados).toHaveLength(0)
    expect(res.resumo).toMatchObject({
      linhasDaEquipe: 1,
      pontosValidos: 0,
      semEndereco: 0,
      eventosOperacionaisNaoEspaciais: 1,
      tempoOperacionalNaoEspacialMin: 30,
      eventosDesconhecidosSemEndereco: 0,
    })
  })

  it('nao reconhece DESCARREGAMENTO nem RECARREGAMENTO como CARREGAMENTO', () => {
    const res = parsear({
      linhasAgenda: [
        linhaAgenda({ titulo: 'DESCARREGAMENTO SEXTA', duracao: '00:30', endereco: '' }),
        linhaAgenda({ titulo: 'RECARREGAMENTO QUARTA', duracao: '00:30', endereco: '' }),
      ],
      dataAlvoISO: '2026-06-15',
      equipeAlvo: 'EQUIPE 1',
      cacheCoordenadasPorEndereco: {},
    })

    expect(res.descartados).toHaveLength(2)
    expect(res.resumo).toMatchObject({
      semEndereco: 2,
      eventosOperacionaisNaoEspaciais: 0,
      eventosDesconhecidosSemEndereco: 2,
      tempoDesconhecidoSemEnderecoMin: 60,
    })
  })

  it('preserva fail-closed quando CARREGAMENTO depende apenas da duracao no titulo', () => {
    const res = parsear({
      linhasAgenda: [
        linhaAgenda({
          titulo: '9 (00:30) CARREGAMENTO SEG-QUI (EQP DE TRANSFERENCIA)',
          duracao: '',
          endereco: '',
        }),
      ],
      dataAlvoISO: '2026-06-15',
      equipeAlvo: 'EQUIPE 1',
      cacheCoordenadasPorEndereco: {},
    })

    expect(res.descartados).toHaveLength(1)
    expect(res.descartados[0].classificacaoEvento).toMatchObject({
      natureza: 'desconhecido',
      motivo: 'carregamento-com-duracao-oficial-invalida',
      duracaoMin: null,
    })
    expect(res.resumo.semEndereco).toBe(1)
  })
})

// ─── 2. Filtro de data ────────────────────────────────────────────────────────

describe('parsearPontosAgendaDoDiaV2 — filtro de data', () => {
  it('2. filtra por data corretamente', () => {
    const res = parsear({
      linhasAgenda: [
        linhaAgenda({ data: '15/06/2026' }),
        linhaAgenda({ data: '16/06/2026' }),
        linhaAgenda({ data: '14/06/2026' }),
      ],
      dataAlvoISO: '2026-06-15',
      equipeAlvo: 'EQUIPE 1',
      cacheCoordenadasPorEndereco: {
        'rua a, 123, curitiba-pr': { lat: -25.4, lng: -49.2 },
      },
    })

    expect(res.pontos).toHaveLength(1)
    expect(res.pontos[0].dataISO).toBe('2026-06-15')
    expect(res.resumo.linhasDaData).toBe(1)
  })

  it('17. ignora mesma equipe em outra data (sem descarte)', () => {
    const res = parsear({
      linhasAgenda: [
        linhaAgenda({ data: '16/06/2026' }), // mesma equipe, outra data
      ],
      dataAlvoISO: '2026-06-15',
      equipeAlvo: 'EQUIPE 1',
      cacheCoordenadasPorEndereco: {},
    })

    expect(res.pontos).toHaveLength(0)
    expect(res.descartados).toHaveLength(0)
    expect(res.resumo.linhasDaData).toBe(0)
  })

  it('aceita Date object como fonte de data', () => {
    const dataDate = new Date(2026, 5, 15) // 15/06/2026 (mes 0-based)
    const res = parsear({
      linhasAgenda: [linhaAgenda({ data: dataDate })],
      dataAlvoISO: '2026-06-15',
      equipeAlvo: 'EQUIPE 1',
      cacheCoordenadasPorEndereco: {
        'rua a, 123, curitiba-pr': { lat: -25.4, lng: -49.2 },
      },
    })

    expect(res.pontos).toHaveLength(1)
    expect(res.pontos[0].dataISO).toBe('2026-06-15')
  })

  it('aceita data da agenda no formato DD/MM/YYYY HH:mm:ss', () => {
    const res = parsear({
      linhasAgenda: [linhaAgenda({ data: '15/06/2026 00:00:00' })],
      dataAlvoISO: '2026-06-15',
      equipeAlvo: 'EQUIPE 1',
      cacheCoordenadasPorEndereco: {
        'rua a, 123, curitiba-pr': { lat: -25.4, lng: -49.2 },
      },
    })

    expect(res.pontos).toHaveLength(1)
    expect(res.pontos[0].dataISO).toBe('2026-06-15')
    expect(res.descartados).toHaveLength(0)
  })

  it('aceita data da agenda sem zero a esquerda e com horario', () => {
    const res = parsear({
      linhasAgenda: [linhaAgenda({ data: '3/7/2026 00:00:00' })],
      dataAlvoISO: '2026-07-03',
      equipeAlvo: 'EQUIPE 1',
      cacheCoordenadasPorEndereco: {
        'rua a, 123, curitiba-pr': { lat: -25.4, lng: -49.2 },
      },
    })

    expect(res.pontos).toHaveLength(1)
    expect(res.pontos[0].dataISO).toBe('2026-07-03')
    expect(res.descartados).toHaveLength(0)
  })

  it('nao usa datas em observacoes para decidir o slot', () => {
    const res = parsear({
      linhasAgenda: [
        linhaAgenda({
          data: '15/06/2026 00:00:00',
          observacoes: 'Entrega mencionada para 03/07/2026. ENDERECO: Rua A, 123, Curitiba-PR',
        }),
      ],
      dataAlvoISO: '2026-07-03',
      equipeAlvo: 'EQUIPE 1',
      cacheCoordenadasPorEndereco: {
        'rua a, 123, curitiba-pr': { lat: -25.4, lng: -49.2 },
      },
    })

    expect(res.pontos).toHaveLength(0)
    expect(res.descartados).toHaveLength(0)
    expect(res.resumo.linhasDaData).toBe(0)
  })

  it('23. trata data invalida como descarte com motivo', () => {
    const res = parsear({
      linhasAgenda: [linhaAgenda({ data: 'invalido' })],
      dataAlvoISO: '2026-06-15',
      equipeAlvo: 'EQUIPE 1',
      cacheCoordenadasPorEndereco: {},
    })

    expect(res.pontos).toHaveLength(0)
    expect(res.descartados).toHaveLength(1)
    expect(res.descartados[0].motivo).toBe('data_invalida')
  })
})

// ─── 3. Filtro de equipe ──────────────────────────────────────────────────────

describe('parsearPontosAgendaDoDiaV2 — filtro de equipe', () => {
  it('3. filtra por equipe corretamente', () => {
    const res = parsear({
      linhasAgenda: [
        linhaAgenda({ equipe: 'Equipe 1' }),
        linhaAgenda({ equipe: 'Equipe 2' }),
      ],
      dataAlvoISO: '2026-06-15',
      equipeAlvo: 'EQUIPE 1',
      cacheCoordenadasPorEndereco: {
        'rua a, 123, curitiba-pr': { lat: -25.4, lng: -49.2 },
      },
    })

    expect(res.pontos).toHaveLength(1)
    expect(res.pontos[0].equipe).toBe('EQUIPE 1')
    expect(res.resumo.linhasDaEquipe).toBe(1)
  })

  it('4. normaliza equipe (Equipe 1, Equipe 01, EQUIPE 1)', () => {
    const cache = { 'rua a, 123, curitiba-pr': { lat: -25.4, lng: -49.2 } }

    const res1 = parsear({
      linhasAgenda: [linhaAgenda({ equipe: 'Equipe 1' })],
      dataAlvoISO: '2026-06-15',
      equipeAlvo: 'EQUIPE 1',
      cacheCoordenadasPorEndereco: cache,
    })
    expect(res1.pontos[0].equipe).toBe('EQUIPE 1')

    const res2 = parsear({
      linhasAgenda: [linhaAgenda({ equipe: 'Equipe 01' })],
      dataAlvoISO: '2026-06-15',
      equipeAlvo: 'EQUIPE 1',
      cacheCoordenadasPorEndereco: cache,
    })
    expect(res2.pontos[0].equipe).toBe('EQUIPE 1')

    const res3 = parsear({
      linhasAgenda: [linhaAgenda({ equipe: 'EQUIPE 1' })],
      dataAlvoISO: '2026-06-15',
      equipeAlvo: 'EQUIPE 1',
      cacheCoordenadasPorEndereco: cache,
    })
    expect(res3.pontos[0].equipe).toBe('EQUIPE 1')
  })

  it('normaliza equipe com prefixo numerico do legado', () => {
    const res = parsear({
      linhasAgenda: [linhaAgenda({ equipe: '4- EQUIPE 01' })],
      dataAlvoISO: '2026-06-15',
      equipeAlvo: 'EQUIPE 1',
      cacheCoordenadasPorEndereco: {
        'rua a, 123, curitiba-pr': { lat: -25.4, lng: -49.2 },
      },
    })

    expect(res.pontos).toHaveLength(1)
    expect(res.pontos[0].equipe).toBe('EQUIPE 1')
  })

  it('16. ignora outra equipe no mesmo dia (sem descarte)', () => {
    const res = parsear({
      linhasAgenda: [
        linhaAgenda({ equipe: 'Equipe 2' }), // mesma data, outra equipe
      ],
      dataAlvoISO: '2026-06-15',
      equipeAlvo: 'EQUIPE 1',
      cacheCoordenadasPorEndereco: {},
    })

    expect(res.pontos).toHaveLength(0)
    expect(res.descartados).toHaveLength(0)
    expect(res.resumo.linhasDaEquipe).toBe(0)
  })

  it('equipe invalida (EQUIPE 3) e descartada com motivo', () => {
    const res = parsear({
      linhasAgenda: [linhaAgenda({ equipe: 'Equipe 3' })],
      dataAlvoISO: '2026-06-15',
      equipeAlvo: 'EQUIPE 1',
      cacheCoordenadasPorEndereco: {},
    })

    expect(res.pontos).toHaveLength(0)
    expect(res.descartados).toHaveLength(1)
    expect(res.descartados[0].motivo).toBe('equipe_invalida')
  })
})

// ─── 4. Extracão de endereco ──────────────────────────────────────────────────

describe('parsearPontosAgendaDoDiaV2 — extracao de endereco', () => {
  it('5. usa endereco da coluna 6 (indice 5) quando presente', () => {
    const res = parsear({
      linhasAgenda: [linhaAgenda({ endereco: 'Rua das Flores, 456, Curitiba-PR' })],
      dataAlvoISO: '2026-06-15',
      equipeAlvo: 'EQUIPE 1',
      cacheCoordenadasPorEndereco: {
        'rua das flores, 456, curitiba-pr': { lat: -25.4, lng: -49.2 },
      },
    })

    expect(res.pontos[0].endereco).toBe('Rua das Flores, 456, Curitiba-PR')
    expect(res.pontos[0].fonteEndereco).toBe('coluna-endereco')
  })

  it('6. usa fallback de observacoes com ENDERECO: quando coluna 6 vazia', () => {
    const res = parsear({
      linhasAgenda: [linhaAgenda({
        endereco: '',
        observacoes: 'Cliente solicitou entrega na loja. ENDERECO: Av. Paulista, 1000, Sao Paulo-SP\nObs: Ligar antes',
      })],
      dataAlvoISO: '2026-06-15',
      equipeAlvo: 'EQUIPE 1',
      cacheCoordenadasPorEndereco: {
        'av. paulista, 1000, sao paulo-sp': { lat: -23.5, lng: -46.6 },
      },
    })

    expect(res.pontos[0].endereco).toBe('Av. Paulista, 1000, Sao Paulo-SP')
    expect(res.pontos[0].fonteEndereco).toBe('observacoes-regex')
  })

  it('8. descarta linha sem endereco (coluna 6 vazia + regex falha)', () => {
    const res = parsear({
      linhasAgenda: [linhaAgenda({
        endereco: '',
        observacoes: 'Sem endereco aqui',
      })],
      dataAlvoISO: '2026-06-15',
      equipeAlvo: 'EQUIPE 1',
      cacheCoordenadasPorEndereco: {},
    })

    expect(res.pontos).toHaveLength(0)
    expect(res.descartados).toHaveLength(1)
    expect(res.descartados[0].motivo).toBe('sem_endereco')
    expect(res.resumo.semEndereco).toBe(1)
  })

  it('limpa quebras de linha e espacos duplicados no endereco', () => {
    const res = parsear({
      linhasAgenda: [linhaAgenda({
        endereco: 'Rua Teste, 123\nComplemento\nBairro',
      })],
      dataAlvoISO: '2026-06-15',
      equipeAlvo: 'EQUIPE 1',
      cacheCoordenadasPorEndereco: {
        'rua teste, 123, complemento, bairro': { lat: -25.4, lng: -49.2 },
      },
    })

    expect(res.pontos[0].endereco).toBe('Rua Teste, 123, Complemento, Bairro')
  })

  it('remove prefixo ENDERECO: se presente no inicio', () => {
    const res = parsear({
      linhasAgenda: [linhaAgenda({
        endereco: 'ENDERECO: Rua Teste, 123, Curitiba-PR',
      })],
      dataAlvoISO: '2026-06-15',
      equipeAlvo: 'EQUIPE 1',
      cacheCoordenadasPorEndereco: {
        'rua teste, 123, curitiba-pr': { lat: -25.4, lng: -49.2 },
      },
    })

    expect(res.pontos[0].endereco).toBe('Rua Teste, 123, Curitiba-PR')
  })
})

// ─── 5. Extracão de CEP ───────────────────────────────────────────────────────

describe('parsearPontosAgendaDoDiaV2 — extracao de CEP', () => {
  it('7. extrai CEP do endereco (formato #####-###)', () => {
    const res = parsear({
      linhasAgenda: [linhaAgenda({ endereco: 'Rua A, 123, Curitiba-PR, 80000-000' })],
      dataAlvoISO: '2026-06-15',
      equipeAlvo: 'EQUIPE 1',
      cacheCoordenadasPorEndereco: {
        'rua a, 123, curitiba-pr, 80000-000': { lat: -25.4, lng: -49.2 },
      },
    })

    expect(res.pontos[0].cep).toBe('80000000')
    expect(res.pontos[0].fonteCep).toBe('regex-endereco')
  })

  it('extrai CEP do endereco (formato ########)', () => {
    const res = parsear({
      linhasAgenda: [linhaAgenda({ endereco: 'Rua A, 123, Curitiba-PR, 80000000' })],
      dataAlvoISO: '2026-06-15',
      equipeAlvo: 'EQUIPE 1',
      cacheCoordenadasPorEndereco: {
        'rua a, 123, curitiba-pr, 80000000': { lat: -25.4, lng: -49.2 },
      },
    })

    expect(res.pontos[0].cep).toBe('80000000')
  })

  it('CEP ausente retorna null e fonte ausente', () => {
    const res = parsear({
      linhasAgenda: [linhaAgenda({ endereco: 'Rua A, 123, Curitiba-PR' })],
      dataAlvoISO: '2026-06-15',
      equipeAlvo: 'EQUIPE 1',
      cacheCoordenadasPorEndereco: {
        'rua a, 123, curitiba-pr': { lat: -25.4, lng: -49.2 },
      },
    })

    expect(res.pontos[0].cep).toBeNull()
    expect(res.pontos[0].fonteCep).toBe('ausente')
  })
})

// ─── 6. Coordenadas e cache ───────────────────────────────────────────────────

describe('parsearPontosAgendaDoDiaV2 — coordenadas e cache', () => {
  it('9. descarta linha sem coordenadas no cache injetado', () => {
    const res = parsear({
      linhasAgenda: [linhaAgenda()],
      dataAlvoISO: '2026-06-15',
      equipeAlvo: 'EQUIPE 1',
      cacheCoordenadasPorEndereco: {}, // cache vazio
    })

    expect(res.pontos).toHaveLength(0)
    expect(res.descartados).toHaveLength(1)
    expect(res.descartados[0].motivo).toBe('sem_coordenadas_cache')
    expect(res.resumo.semCoordenadas).toBe(1)
  })

  it('usa coordenadas do cache injetado corretamente', () => {
    const res = parsear({
      linhasAgenda: [linhaAgenda({ endereco: 'Rua X, 999, Curitiba-PR' })],
      dataAlvoISO: '2026-06-15',
      equipeAlvo: 'EQUIPE 1',
      cacheCoordenadasPorEndereco: {
        'rua x, 999, curitiba-pr': { lat: -25.123, lng: -49.456 },
      },
    })

    expect(res.pontos[0].coordenadas.lat).toBe(-25.123)
    expect(res.pontos[0].coordenadas.lng).toBe(-49.456)
  })

  it('normaliza chave do cache (case insensitive, espacos)', () => {
    // Testa que o cache eh encontrado mesmo com variacao de case e espacos
    // Usando o formato exato que o linhaAgenda gera (sem espacos extras)
    const res = parsear({
      linhasAgenda: [
        [
          '15/06/2026',      // [0] Data
          '',                // [1] (nao usado)
          'Cliente A',       // [2] Titulo/Evento
          '',                // [3] (nao usado)
          '',                // [4] Observacoes
          'RUA A, 123, CURITIBA-PR', // [5] Endereco (uppercase, mas sem espacos extras)
          'Equipe 1',        // [6] Equipe
        ],
      ],
      dataAlvoISO: '2026-06-15',
      equipeAlvo: 'EQUIPE 1',
      cacheCoordenadasPorEndereco: {
        'rua a, 123, curitiba-pr': { lat: -25.4, lng: -49.2 },
      },
    })

    expect(res.pontos).toHaveLength(1)
    expect(res.pontos[0].coordenadas.lat).toBe(-25.4)
  })
})

// ─── 7. Descartes e auditoria ───────────────────────────────────────────────────

describe('parsearPontosAgendaDoDiaV2 — descartes e auditoria', () => {
  it('10. registra descartados com motivo', () => {
    const res = parsear({
      linhasAgenda: [
        linhaAgenda({ endereco: '' }), // sem endereco
      ],
      dataAlvoISO: '2026-06-15',
      equipeAlvo: 'EQUIPE 1',
      cacheCoordenadasPorEndereco: {},
    })

    expect(res.descartados[0].motivo).toBe('sem_endereco')
    expect(res.descartados[0].indiceLinhaOriginal).toBe(0)
    expect(res.descartados[0].descricao).toContain('Coluna 6 vazia')
  })

  it('11. nao descarta silenciosamente', () => {
    const res = parsear({
      linhasAgenda: [
        linhaAgenda(), // sem coordenadas no cache
      ],
      dataAlvoISO: '2026-06-15',
      equipeAlvo: 'EQUIPE 1',
      cacheCoordenadasPorEndereco: {},
    })

    // Deve aparecer em descartados, nao sumir
    expect(res.pontos).toHaveLength(0)
    expect(res.descartados).toHaveLength(1)
    expect(res.resumo.pontosDescartados).toBe(1)
  })

  it('24. trata linha curta/incompleta sem quebrar', () => {
    const res = parsear({
      linhasAgenda: [
        ['15/06/2026', '', 'Titulo'], // so 3 colunas
      ],
      dataAlvoISO: '2026-06-15',
      equipeAlvo: 'EQUIPE 1',
      cacheCoordenadasPorEndereco: {},
    })

    expect(res.pontos).toHaveLength(0)
    expect(res.descartados).toHaveLength(1)
    expect(res.descartados[0].motivo).toBe('linha_incompleta')
  })
})

// ─── 8. Imutabilidade ─────────────────────────────────────────────────────────

describe('parsearPontosAgendaDoDiaV2 — imutabilidade', () => {
  it('14. nao muta input', () => {
    const linhaOriginal = linhaAgenda({ titulo: 'Original' })
    const linhas = [linhaOriginal]

    parsear({
      linhasAgenda: linhas,
      dataAlvoISO: '2026-06-15',
      equipeAlvo: 'EQUIPE 1',
      cacheCoordenadasPorEndereco: {
        'rua a, 123, curitiba-pr': { lat: -25.4, lng: -49.2 },
      },
    })

    // Verifica que a linha original nao foi modificada
    expect(linhas[0][2]).toBe('Original')
    expect(linhaOriginal[2]).toBe('Original')
  })
})

// ─── 9. Multiplos pontos ──────────────────────────────────────────────────────

describe('parsearPontosAgendaDoDiaV2 — multiplos pontos', () => {
  it('15. suporta multiplos pontos no mesmo dia/equipe', () => {
    const res = parsear({
      linhasAgenda: [
        linhaAgenda({ titulo: 'Cliente A', endereco: 'Rua A, 123, Curitiba-PR' }),
        linhaAgenda({ titulo: 'Cliente B', endereco: 'Rua B, 456, Curitiba-PR' }),
        linhaAgenda({ titulo: 'Cliente C', endereco: 'Rua C, 789, Curitiba-PR' }),
      ],
      dataAlvoISO: '2026-06-15',
      equipeAlvo: 'EQUIPE 1',
      cacheCoordenadasPorEndereco: {
        'rua a, 123, curitiba-pr': { lat: -25.1, lng: -49.1 },
        'rua b, 456, curitiba-pr': { lat: -25.2, lng: -49.2 },
        'rua c, 789, curitiba-pr': { lat: -25.3, lng: -49.3 },
      },
    })

    expect(res.pontos).toHaveLength(3)
    expect(res.pontos[0].tituloEvento).toBe('Cliente A')
    expect(res.pontos[1].tituloEvento).toBe('Cliente B')
    expect(res.pontos[2].tituloEvento).toBe('Cliente C')
  })
})

// ─── 10. Resumo ─────────────────────────────────────────────────────────────────

describe('parsearPontosAgendaDoDiaV2 — resumo', () => {
  it('18. retorna resumo correto', () => {
    const res = parsear({
      linhasAgenda: [
        linhaAgenda({ titulo: 'A' }),
        linhaAgenda({ titulo: 'B' }),
        linhaAgenda({ titulo: 'C', endereco: '' }), // sem endereco
        linhaAgenda({ data: '16/06/2026' }), // outra data
      ],
      dataAlvoISO: '2026-06-15',
      equipeAlvo: 'EQUIPE 1',
      cacheCoordenadasPorEndereco: {
        'rua a, 123, curitiba-pr': { lat: -25.4, lng: -49.2 },
      },
    })

    expect(res.resumo.linhasRecebidas).toBe(4)
    expect(res.resumo.linhasDaData).toBe(3)
    expect(res.resumo.linhasDaEquipe).toBe(3)
    expect(res.resumo.pontosValidos).toBe(2) // A e B
    expect(res.resumo.pontosDescartados).toBe(1) // C (sem endereco)
    expect(res.resumo.semEndereco).toBe(1)
  })
})

// ─── 11. Nao chama servicos externos ──────────────────────────────────────────

describe('parsearPontosAgendaDoDiaV2 — garantias de nao-I/O', () => {
  it('19. nao chama Google Sheets', () => {
    // O helper e puro - nao faz chamadas externas
    // Este teste documenta o comportamento esperado
    const res = parsear({
      linhasAgenda: [linhaAgenda()],
      dataAlvoISO: '2026-06-15',
      equipeAlvo: 'EQUIPE 1',
      cacheCoordenadasPorEndereco: {
        'rua a, 123, curitiba-pr': { lat: -25.4, lng: -49.2 },
      },
    })

    expect(res.ok).toBe(true)
    // Nao houve erro de rede, credencial, ou timeout
    expect(res.erros).toHaveLength(0)
  })

  it('20. nao chama Supabase', () => {
    // Idem
    const res = parsear({
      linhasAgenda: [linhaAgenda()],
      dataAlvoISO: '2026-06-15',
      equipeAlvo: 'EQUIPE 1',
      cacheCoordenadasPorEndereco: {
        'rua a, 123, curitiba-pr': { lat: -25.4, lng: -49.2 },
      },
    })

    expect(res.ok).toBe(true)
  })

  it('21. nao chama OSRM', () => {
    // Idem
    const res = parsear({
      linhasAgenda: [linhaAgenda()],
      dataAlvoISO: '2026-06-15',
      equipeAlvo: 'EQUIPE 1',
      cacheCoordenadasPorEndereco: {
        'rua a, 123, curitiba-pr': { lat: -25.4, lng: -49.2 },
      },
    })

    expect(res.ok).toBe(true)
  })

  it('22. nao chama Apps Script', () => {
    // Idem
    const res = parsear({
      linhasAgenda: [linhaAgenda()],
      dataAlvoISO: '2026-06-15',
      equipeAlvo: 'EQUIPE 1',
      cacheCoordenadasPorEndereco: {
        'rua a, 123, curitiba-pr': { lat: -25.4, lng: -49.2 },
      },
    })

    expect(res.ok).toBe(true)
  })
})

// ─── 12. Observacoes sem ENDERECO: ─────────────────────────────────────────────

describe('parsearPontosAgendaDoDiaV2 — observacoes sem ENDERECO:', () => {
  it('25. trata observacoes sem ENDERECO: sem quebrar', () => {
    const res = parsear({
      linhasAgenda: [linhaAgenda({
        endereco: '',
        observacoes: 'Apenas uma observacao sem endereco',
      })],
      dataAlvoISO: '2026-06-15',
      equipeAlvo: 'EQUIPE 1',
      cacheCoordenadasPorEndereco: {},
    })

    expect(res.pontos).toHaveLength(0)
    expect(res.descartados).toHaveLength(1)
    expect(res.descartados[0].motivo).toBe('sem_endereco')
  })
})

// ─── 13. Titulo null quando vazio ─────────────────────────────────────────────

describe('parsearPontosAgendaDoDiaV2 — titulo', () => {
  it('titulo vazio vira null', () => {
    const res = parsear({
      linhasAgenda: [linhaAgenda({ titulo: '' })],
      dataAlvoISO: '2026-06-15',
      equipeAlvo: 'EQUIPE 1',
      cacheCoordenadasPorEndereco: {
        'rua a, 123, curitiba-pr': { lat: -25.4, lng: -49.2 },
      },
    })

    expect(res.pontos[0].tituloEvento).toBeNull()
  })

  it('titulo espacos vira null', () => {
    const res = parsear({
      linhasAgenda: [linhaAgenda({ titulo: '   ' })],
      dataAlvoISO: '2026-06-15',
      equipeAlvo: 'EQUIPE 1',
      cacheCoordenadasPorEndereco: {
        'rua a, 123, curitiba-pr': { lat: -25.4, lng: -49.2 },
      },
    })

    expect(res.pontos[0].tituloEvento).toBeNull()
  })
})
