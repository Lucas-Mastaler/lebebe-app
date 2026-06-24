// ─────────────────────────────────────────────────────────────────────────────
// motor/parse-disponibilidade-tempo-disponivel.test.ts
//   Testes unitários para parsearDisponibilidadeTempoDisponivelV2
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest'
import {
  parsearDisponibilidadeTempoDisponivelV2,
  type LinhaTempoDisponivelV2,
  type ParsearDisponibilidadeTempoDisponivelV2Input,
} from './parse-disponibilidade-tempo-disponivel'

// ─── Fixture auxiliar ─────────────────────────────────────────────────────────

function parsear(input: ParsearDisponibilidadeTempoDisponivelV2Input) {
  return parsearDisponibilidadeTempoDisponivelV2(input)
}

function linhaDisponivel(overrides: Partial<LinhaTempoDisponivelV2> = {}): LinhaTempoDisponivelV2 {
  return {
    data: '23/06/2026',
    equipe: 'Equipe 1',
    tempoUtilizado: '06:00',
    tempoDisponivel: '01:00',
    tempoExcedido: '',
    status: 'disponível',
    ...overrides,
  }
}

// ─── 1. Tempo disponível ──────────────────────────────────────────────────────

describe('parsearDisponibilidadeTempoDisponivelV2 — tempo disponível', () => {
  it('1. parseia "01:00" para 60 minutos', () => {
    const res = parsear({ linhas: [linhaDisponivel({ tempoDisponivel: '01:00' })] })
    expect(res.disponibilidades[0].disponivelMin).toBe(60)
  })

  it('9. parseia "00:00" para 0 minutos', () => {
    const res = parsear({ linhas: [linhaDisponivel({ tempoDisponivel: '00:00', status: 'disponível' })] })
    expect(res.disponibilidades[0].disponivelMin).toBe(0)
  })

  it('10. parseia "02:15" para 135 minutos', () => {
    const res = parsear({ linhas: [linhaDisponivel({ tempoDisponivel: '02:15' })] })
    expect(res.disponibilidades[0].disponivelMin).toBe(135)
  })

  it('parseia "06:30" para 390 minutos', () => {
    const res = parsear({ linhas: [linhaDisponivel({ tempoDisponivel: '06:30' })] })
    expect(res.disponibilidades[0].disponivelMin).toBe(390)
  })
})

// ─── 2. Parsing de data ───────────────────────────────────────────────────────

describe('parsearDisponibilidadeTempoDisponivelV2 — data', () => {
  it('2. parseia "05/12/2026" para "2026-12-05"', () => {
    const res = parsear({ linhas: [linhaDisponivel({ data: '05/12/2026' })] })
    expect(res.disponibilidades[0].dataISO).toBe('2026-12-05')
  })

  it('parseia "23/06/2026" para "2026-06-23"', () => {
    const res = parsear({ linhas: [linhaDisponivel({ data: '23/06/2026' })] })
    expect(res.disponibilidades[0].dataISO).toBe('2026-06-23')
  })

  it('parseia "01/01/2027" para "2027-01-01"', () => {
    const res = parsear({ linhas: [linhaDisponivel({ data: '01/01/2027' })] })
    expect(res.disponibilidades[0].dataISO).toBe('2027-01-01')
  })

  it('aceita Date object como fonte secundária', () => {
    const d = new Date(2026, 5, 23) // 23/06/2026 (mês 0-based)
    const res = parsear({ linhas: [linhaDisponivel({ data: d })] })
    expect(res.disponibilidades[0].dataISO).toBe('2026-06-23')
  })

  // ── Formatos reais da planilha: DD/MM (texto) ──

  it('parseia "15/06 (segunda-feira)" com dataInicialISO=2026-06-15 → 2026-06-15', () => {
    const res = parsear({
      linhas: [linhaDisponivel({ data: '15/06 (segunda-feira)' })],
      dataInicialISO: '2026-06-15',
    })
    expect(res.disponibilidades[0].dataISO).toBe('2026-06-15')
    expect(res.erros).toHaveLength(0)
  })

  it('parseia "23/06 (terça-feira)" com dataInicialISO=2026-06-15 → 2026-06-23', () => {
    const res = parsear({
      linhas: [linhaDisponivel({ data: '23/06 (terça-feira)' })],
      dataInicialISO: '2026-06-15',
    })
    expect(res.disponibilidades[0].dataISO).toBe('2026-06-23')
  })

  it('parseia "05/12 (sábado)" com dataInicialISO=2026-06-15 → 2026-12-05', () => {
    const res = parsear({
      linhas: [linhaDisponivel({ data: '05/12 (sábado)' })],
      dataInicialISO: '2026-06-15',
    })
    expect(res.disponibilidades[0].dataISO).toBe('2026-12-05')
  })

  it('virada de ano: "05/01 (segunda-feira)" com dataInicialISO=2026-12-15 → 2027-01-05', () => {
    const res = parsear({
      linhas: [linhaDisponivel({ data: '05/01 (segunda-feira)' })],
      dataInicialISO: '2026-12-15',
    })
    expect(res.disponibilidades[0].dataISO).toBe('2027-01-05')
  })

  it('virada de ano: "15/01" com dataInicialISO=2026-12-15 → 2027-01-15', () => {
    const res = parsear({
      linhas: [linhaDisponivel({ data: '15/01' })],
      dataInicialISO: '2026-12-15',
    })
    expect(res.disponibilidades[0].dataISO).toBe('2027-01-15')
  })

  it('mesmo ano: "20/12" com dataInicialISO=2026-12-15 → 2026-12-20', () => {
    const res = parsear({
      linhas: [linhaDisponivel({ data: '20/12' })],
      dataInicialISO: '2026-12-15',
    })
    expect(res.disponibilidades[0].dataISO).toBe('2026-12-20')
  })

  it('DD/MM sem dataInicialISO → erro controlado', () => {
    const res = parsear({ linhas: [linhaDisponivel({ data: '15/06 (segunda-feira)' })] })
    expect(res.disponibilidades).toHaveLength(0)
    expect(res.erros[0]).toMatch(/data sem ano e dataInicialISO ausente/)
  })

  it('data inválida "32/06 (segunda-feira)" com dataInicialISO → ignorada', () => {
    const res = parsear({
      linhas: [linhaDisponivel({ data: '32/06 (segunda-feira)' })],
      dataInicialISO: '2026-06-15',
    })
    expect(res.disponibilidades).toHaveLength(0)
    expect(res.erros[0]).toMatch(/data inválida/)
  })

  it('data inválida "15/13 (segunda-feira)" com dataInicialISO → ignorada', () => {
    const res = parsear({
      linhas: [linhaDisponivel({ data: '15/13 (segunda-feira)' })],
      dataInicialISO: '2026-06-15',
    })
    expect(res.disponibilidades).toHaveLength(0)
    expect(res.erros[0]).toMatch(/data inválida/)
  })

  it('DD/MM/YYYY continua funcionando sem dataInicialISO', () => {
    const res = parsear({ linhas: [linhaDisponivel({ data: '05/12/2026' })] })
    expect(res.disponibilidades[0].dataISO).toBe('2026-12-05')
    expect(res.erros).toHaveLength(0)
  })

  it('29/02 em ano bissexto inferido (2024) → aceita', () => {
    const res = parsear({
      linhas: [linhaDisponivel({ data: '29/02' })],
      dataInicialISO: '2024-02-01',
    })
    expect(res.disponibilidades[0].dataISO).toBe('2024-02-29')
  })

  it('29/02 em ano não bissexto inferido (2025) → rejeita', () => {
    const res = parsear({
      linhas: [linhaDisponivel({ data: '29/02' })],
      dataInicialISO: '2025-02-01',
    })
    expect(res.disponibilidades).toHaveLength(0)
    expect(res.erros[0]).toMatch(/data inválida/)
  })
})

// ─── 3–5. Normalização de equipe ──────────────────────────────────────────────

describe('parsearDisponibilidadeTempoDisponivelV2 — equipe', () => {
  it('3. normaliza "Equipe 1" para "EQUIPE 1"', () => {
    const res = parsear({ linhas: [linhaDisponivel({ equipe: 'Equipe 1' })] })
    expect(res.disponibilidades[0].equipe).toBe('EQUIPE 1')
  })

  it('4. normaliza "Equipe 01" para "EQUIPE 1"', () => {
    const res = parsear({ linhas: [linhaDisponivel({ equipe: 'Equipe 01' })] })
    expect(res.disponibilidades[0].equipe).toBe('EQUIPE 1')
  })

  it('5. normaliza "Equipe 2" para "EQUIPE 2"', () => {
    const res = parsear({ linhas: [linhaDisponivel({ equipe: 'Equipe 2' })] })
    expect(res.disponibilidades[0].equipe).toBe('EQUIPE 2')
  })

  it('normaliza "EQUIPE 1" para "EQUIPE 1"', () => {
    const res = parsear({ linhas: [linhaDisponivel({ equipe: 'EQUIPE 1' })] })
    expect(res.disponibilidades[0].equipe).toBe('EQUIPE 1')
  })

  it('normaliza "EQP 2" para "EQUIPE 2"', () => {
    const res = parsear({ linhas: [linhaDisponivel({ equipe: 'EQP 2' })] })
    expect(res.disponibilidades[0].equipe).toBe('EQUIPE 2')
  })
})

// ─── 6–8. Status ─────────────────────────────────────────────────────────────

describe('parsearDisponibilidadeTempoDisponivelV2 — status', () => {
  it('6. "agenda fechada" → ativa: false, motivoIndisponibilidade: "agenda fechada"', () => {
    const res = parsear({
      linhas: [linhaDisponivel({ tempoDisponivel: '00:00', status: 'agenda fechada' })],
    })
    expect(res.disponibilidades[0].ativa).toBe(false)
    expect(res.disponibilidades[0].motivoIndisponibilidade).toBe('agenda fechada')
  })

  it('7. "excedeu" → ativa: false, motivoIndisponibilidade: "excedeu"', () => {
    const res = parsear({
      linhas: [linhaDisponivel({ tempoDisponivel: '00:00', status: 'excedeu' })],
    })
    expect(res.disponibilidades[0].ativa).toBe(false)
    expect(res.disponibilidades[0].motivoIndisponibilidade).toBe('excedeu')
  })

  it('8. "disponível" → ativa: true, motivoIndisponibilidade: null', () => {
    const res = parsear({ linhas: [linhaDisponivel({ status: 'disponível' })] })
    expect(res.disponibilidades[0].ativa).toBe(true)
    expect(res.disponibilidades[0].motivoIndisponibilidade).toBeNull()
  })

  it('aceita status com maiúsculas "DISPONÍVEL"', () => {
    const res = parsear({ linhas: [linhaDisponivel({ status: 'DISPONÍVEL' })] })
    expect(res.disponibilidades[0].ativa).toBe(true)
  })

  it('aceita status "Agenda Fechada" (case insensitive)', () => {
    const res = parsear({
      linhas: [linhaDisponivel({ tempoDisponivel: '00:00', status: 'Agenda Fechada' })],
    })
    expect(res.disponibilidades[0].motivoIndisponibilidade).toBe('agenda fechada')
  })
})

// ─── 11–13. Linhas inválidas ──────────────────────────────────────────────────

describe('parsearDisponibilidadeTempoDisponivelV2 — linhas inválidas', () => {
  it('11. data inválida: linha ignorada e erro registrado', () => {
    const res = parsear({ linhas: [linhaDisponivel({ data: 'data-errada' })] })
    expect(res.disponibilidades).toHaveLength(0)
    expect(res.erros).toHaveLength(1)
    expect(res.erros[0]).toMatch(/Linha 1: data inválida/)
    expect(res.resumo.linhasIgnoradas).toBe(1)
    expect(res.resumo.linhasValidas).toBe(0)
  })

  it('11b. data no formato YYYY-MM-DD (não esperado nesta etapa) → ignorada', () => {
    const res = parsear({ linhas: [linhaDisponivel({ data: '2026-06-23' })] })
    expect(res.disponibilidades).toHaveLength(0)
    expect(res.erros[0]).toMatch(/data inválida/)
  })

  it('12. equipe inválida: linha ignorada e erro registrado', () => {
    const res = parsear({ linhas: [linhaDisponivel({ equipe: 'EQUIPE 3' })] })
    expect(res.disponibilidades).toHaveLength(0)
    expect(res.erros[0]).toMatch(/Linha 1: equipe inválida/)
    expect(res.resumo.linhasIgnoradas).toBe(1)
  })

  it('12b. equipe vazia: linha ignorada', () => {
    const res = parsear({ linhas: [linhaDisponivel({ equipe: '' })] })
    expect(res.disponibilidades).toHaveLength(0)
    expect(res.erros[0]).toMatch(/equipe inválida/)
  })

  it('13. tempo disponível inválido (texto livre): linha ignorada e erro registrado', () => {
    const res = parsear({ linhas: [linhaDisponivel({ tempoDisponivel: '1 hora' })] })
    expect(res.disponibilidades).toHaveLength(0)
    expect(res.erros[0]).toMatch(/Linha 1: tempo disponível inválido/)
    expect(res.resumo.linhasIgnoradas).toBe(1)
  })

  it('13b. tempo disponível undefined: linha ignorada', () => {
    const res = parsear({ linhas: [linhaDisponivel({ tempoDisponivel: undefined })] })
    expect(res.disponibilidades).toHaveLength(0)
    expect(res.erros[0]).toMatch(/tempo disponível inválido/)
  })
})

// ─── 14. Linha vazia ──────────────────────────────────────────────────────────

describe('parsearDisponibilidadeTempoDisponivelV2 — linha vazia', () => {
  it('14. linha completamente vazia: ignorada sem erro', () => {
    const linhaVazia: LinhaTempoDisponivelV2 = {
      data: '',
      equipe: '',
      tempoDisponivel: '',
    }
    const res = parsear({ linhas: [linhaVazia] })
    expect(res.disponibilidades).toHaveLength(0)
    expect(res.erros).toHaveLength(0)
    expect(res.resumo.linhasIgnoradas).toBe(1)
    expect(res.resumo.linhasValidas).toBe(0)
  })

  it('linha com todos campos undefined: ignorada sem erro', () => {
    const linhaVazia: LinhaTempoDisponivelV2 = {
      data: undefined,
      equipe: undefined,
      tempoDisponivel: undefined,
    }
    const res = parsear({ linhas: [linhaVazia] })
    expect(res.erros).toHaveLength(0)
    expect(res.resumo.linhasIgnoradas).toBe(1)
  })
})

// ─── 15–16. Status vazio ─────────────────────────────────────────────────────

describe('parsearDisponibilidadeTempoDisponivelV2 — status vazio', () => {
  it('15. status vazio com tempo > 0 → ativa: true com aviso', () => {
    const res = parsear({ linhas: [linhaDisponivel({ status: '' })] })
    expect(res.disponibilidades[0].ativa).toBe(true)
    expect(res.disponibilidades[0].motivoIndisponibilidade).toBeNull()
    expect(res.avisos.some((a) => a.includes('status ausente') && a.includes('> 0'))).toBe(true)
  })

  it('15b. status undefined com tempo > 0 → ativa: true com aviso', () => {
    const res = parsear({ linhas: [linhaDisponivel({ status: undefined })] })
    expect(res.disponibilidades[0].ativa).toBe(true)
    expect(res.avisos.length).toBeGreaterThan(0)
  })

  it('16. status vazio com tempo = 0 → ativa: false, motivo "sem tempo disponível" com aviso', () => {
    const res = parsear({
      linhas: [linhaDisponivel({ tempoDisponivel: '00:00', status: '' })],
    })
    expect(res.disponibilidades[0].ativa).toBe(false)
    expect(res.disponibilidades[0].motivoIndisponibilidade).toBe('sem tempo disponível')
    expect(res.avisos.some((a) => a.includes('status ausente') && a.includes('= 0'))).toBe(true)
  })
})

// ─── 17. Duplicidade ─────────────────────────────────────────────────────────

describe('parsearDisponibilidadeTempoDisponivelV2 — duplicidade', () => {
  it('17. duplicidade: mantém maior disponivelMin e registra aviso', () => {
    const linhas: LinhaTempoDisponivelV2[] = [
      linhaDisponivel({ data: '23/06/2026', equipe: 'Equipe 1', tempoDisponivel: '01:00' }),
      linhaDisponivel({ data: '23/06/2026', equipe: 'Equipe 1', tempoDisponivel: '02:00' }),
    ]
    const res = parsear({ linhas })
    expect(res.disponibilidades).toHaveLength(1)
    expect(res.disponibilidades[0].disponivelMin).toBe(120)
    expect(res.avisos.some((a) => a.includes('duplicidade') && a.includes('EQUIPE 1'))).toBe(true)
    expect(res.resumo.linhasValidas).toBe(2)
  })

  it('duplicidade com menor disponivelMin na segunda linha: mantém o maior (da primeira)', () => {
    const linhas: LinhaTempoDisponivelV2[] = [
      linhaDisponivel({ data: '23/06/2026', equipe: 'Equipe 1', tempoDisponivel: '03:00' }),
      linhaDisponivel({ data: '23/06/2026', equipe: 'Equipe 1', tempoDisponivel: '01:00' }),
    ]
    const res = parsear({ linhas })
    expect(res.disponibilidades[0].disponivelMin).toBe(180)
  })

  it('equipes diferentes na mesma data não são duplicatas', () => {
    const linhas: LinhaTempoDisponivelV2[] = [
      linhaDisponivel({ data: '23/06/2026', equipe: 'Equipe 1', tempoDisponivel: '01:00' }),
      linhaDisponivel({ data: '23/06/2026', equipe: 'Equipe 2', tempoDisponivel: '02:00' }),
    ]
    const res = parsear({ linhas })
    expect(res.disponibilidades).toHaveLength(2)
    expect(res.avisos.filter((a) => a.includes('duplicidade'))).toHaveLength(0)
  })
})

// ─── 18. Não muta input ───────────────────────────────────────────────────────

describe('parsearDisponibilidadeTempoDisponivelV2 — imutabilidade', () => {
  it('18. não muta o array de linhas de entrada', () => {
    const linhas: LinhaTempoDisponivelV2[] = [
      linhaDisponivel(),
      { data: '13/06/2026', equipe: 'Equipe 1', tempoDisponivel: '00:00', status: 'excedeu' },
    ]
    const linhasOriginal = JSON.parse(JSON.stringify(linhas))
    parsear({ linhas })
    expect(linhas).toEqual(linhasOriginal)
  })

  it('não muta os objetos individuais dentro do array', () => {
    const linha = linhaDisponivel()
    const linhaOriginal = { ...linha }
    parsear({ linhas: [linha] })
    expect(linha).toEqual(linhaOriginal)
  })
})

// ─── 19. Preserva ordem ───────────────────────────────────────────────────────

describe('parsearDisponibilidadeTempoDisponivelV2 — ordem', () => {
  it('19. preserva a ordem de entrada das linhas', () => {
    const linhas: LinhaTempoDisponivelV2[] = [
      { data: '23/06/2026', equipe: 'Equipe 1', tempoDisponivel: '01:00', status: 'disponível' },
      { data: '13/06/2026', equipe: 'Equipe 1', tempoDisponivel: '00:00', status: 'excedeu' },
      { data: '12/06/2026', equipe: 'Equipe 2', tempoDisponivel: '00:00', status: 'agenda fechada' },
    ]
    const res = parsear({ linhas })
    expect(res.disponibilidades[0].dataISO).toBe('2026-06-23')
    expect(res.disponibilidades[1].dataISO).toBe('2026-06-13')
    expect(res.disponibilidades[2].dataISO).toBe('2026-06-12')
  })
})

// ─── 20. Resumo ───────────────────────────────────────────────────────────────

describe('parsearDisponibilidadeTempoDisponivelV2 — resumo', () => {
  it('20. calcula resumo corretamente com linhas mistas', () => {
    const linhas: LinhaTempoDisponivelV2[] = [
      linhaDisponivel({ data: '23/06/2026', equipe: 'Equipe 1', tempoDisponivel: '01:00', status: 'disponível' }),
      { data: '13/06/2026', equipe: 'Equipe 1', tempoDisponivel: '00:00', status: 'excedeu' },
      { data: '12/06/2026', equipe: 'Equipe 2', tempoDisponivel: '00:00', status: 'agenda fechada' },
      { data: 'data-invalida', equipe: 'Equipe 1', tempoDisponivel: '01:00', status: 'disponível' },
      { data: '', equipe: '', tempoDisponivel: '' },
    ]
    const res = parsear({ linhas })
    expect(res.resumo.linhasRecebidas).toBe(5)
    expect(res.resumo.linhasValidas).toBe(3)
    expect(res.resumo.linhasIgnoradas).toBe(2)
    expect(res.resumo.disponiveis).toBe(1)
    expect(res.resumo.excedidas).toBe(1)
    expect(res.resumo.agendasFechadas).toBe(1)
  })

  it('resumo com lote vazio', () => {
    const res = parsear({ linhas: [] })
    expect(res.resumo.linhasRecebidas).toBe(0)
    expect(res.resumo.linhasValidas).toBe(0)
    expect(res.resumo.linhasIgnoradas).toBe(0)
    expect(res.resumo.disponiveis).toBe(0)
    expect(res.resumo.agendasFechadas).toBe(0)
    expect(res.resumo.excedidas).toBe(0)
  })
})

// ─── 21. Sem I/O externo ─────────────────────────────────────────────────────

describe('parsearDisponibilidadeTempoDisponivelV2 — sem I/O externo', () => {
  it('21. executa de forma síncrona sem chamadas externas', () => {
    const inicio = Date.now()
    const res = parsear({ linhas: [linhaDisponivel()] })
    const fim = Date.now()
    expect(res).toBeDefined()
    expect(typeof res.ok).toBe('boolean')
    expect(fim - inicio).toBeLessThan(100)
  })

  it('retorna objeto completo sem async/await', () => {
    const res = parsearDisponibilidadeTempoDisponivelV2({ linhas: [] })
    expect(res).not.toBeInstanceOf(Promise)
    expect(Array.isArray(res.disponibilidades)).toBe(true)
    expect(Array.isArray(res.avisos)).toBe(true)
    expect(Array.isArray(res.erros)).toBe(true)
  })
})

// ─── 22. Lote com exemplos reais confirmados ──────────────────────────────────

describe('parsearDisponibilidadeTempoDisponivelV2 — exemplos reais da planilha', () => {
  it('22. parseia os três exemplos reais da planilha corretamente', () => {
    const linhas: LinhaTempoDisponivelV2[] = [
      {
        data: '23/06/2026',
        equipe: 'Equipe 1',
        tempoUtilizado: '06:00',
        tempoDisponivel: '01:00',
        tempoExcedido: '',
        status: 'disponível',
      },
      {
        data: '13/06/2026',
        equipe: 'Equipe 1',
        tempoUtilizado: '05:45',
        tempoDisponivel: '00:00',
        tempoExcedido: '01:45',
        status: 'excedeu',
      },
      {
        data: '12/06/2026',
        equipe: 'Equipe 2',
        tempoUtilizado: '07:00',
        tempoDisponivel: '00:00',
        tempoExcedido: '',
        status: 'agenda fechada',
      },
    ]

    const res = parsear({ linhas })

    expect(res.ok).toBe(true)
    expect(res.disponibilidades).toHaveLength(3)
    expect(res.erros).toHaveLength(0)

    expect(res.disponibilidades[0]).toMatchObject({
      dataISO: '2026-06-23',
      equipe: 'EQUIPE 1',
      disponivelMin: 60,
      ativa: true,
      motivoIndisponibilidade: null,
    })

    expect(res.disponibilidades[1]).toMatchObject({
      dataISO: '2026-06-13',
      equipe: 'EQUIPE 1',
      disponivelMin: 0,
      ativa: false,
      motivoIndisponibilidade: 'excedeu',
    })

    expect(res.disponibilidades[2]).toMatchObject({
      dataISO: '2026-06-12',
      equipe: 'EQUIPE 2',
      disponivelMin: 0,
      ativa: false,
      motivoIndisponibilidade: 'agenda fechada',
    })

    expect(res.resumo).toMatchObject({
      linhasRecebidas: 3,
      linhasValidas: 3,
      linhasIgnoradas: 0,
      disponiveis: 1,
      agendasFechadas: 1,
      excedidas: 1,
    })
  })

  it('parseia lote misto com equipes 1 e 2 em datas diferentes', () => {
    const linhas: LinhaTempoDisponivelV2[] = [
      { data: '23/06/2026', equipe: 'Equipe 1', tempoDisponivel: '04:00', status: 'disponível' },
      { data: '23/06/2026', equipe: 'Equipe 2', tempoDisponivel: '03:30', status: 'disponível' },
      { data: '24/06/2026', equipe: 'Equipe 1', tempoDisponivel: '00:00', status: 'agenda fechada' },
    ]
    const res = parsear({ linhas })
    expect(res.disponibilidades).toHaveLength(3)
    expect(res.resumo.disponiveis).toBe(2)
    expect(res.resumo.agendasFechadas).toBe(1)
  })

  it('parseia lote no formato real da planilha (DD/MM com texto) com dataInicialISO → linhasValidas > 0', () => {
    const linhas: LinhaTempoDisponivelV2[] = [
      { data: '15/06 (segunda-feira)', equipe: 'Equipe 1', tempoDisponivel: '01:00', status: 'disponível' },
      { data: '16/06 (terça-feira)', equipe: 'Equipe 1', tempoDisponivel: '00:00', status: 'excedeu' },
      { data: '23/06 (terça-feira)', equipe: 'Equipe 2', tempoDisponivel: '02:30', status: 'disponível' },
      { data: '05/01 (segunda-feira)', equipe: 'Equipe 1', tempoDisponivel: '01:00', status: 'disponível' },
    ]
    const res = parsear({ linhas, dataInicialISO: '2026-06-15' })

    expect(res.ok).toBe(true)
    expect(res.resumo.linhasValidas).toBe(4)
    expect(res.resumo.linhasIgnoradas).toBe(0)
    expect(res.erros).toHaveLength(0)

    expect(res.disponibilidades).toHaveLength(4)
    expect(res.disponibilidades[0].dataISO).toBe('2026-06-15')
    expect(res.disponibilidades[1].dataISO).toBe('2026-06-16')
    expect(res.disponibilidades[2].dataISO).toBe('2026-06-23')
    expect(res.disponibilidades[3].dataISO).toBe('2027-01-05')
  })
})
