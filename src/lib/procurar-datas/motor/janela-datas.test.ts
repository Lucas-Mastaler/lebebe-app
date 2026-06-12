import { describe, it, expect } from 'vitest'
import {
  gerarJanelaDatasPesquisaV2,
  type GerarJanelaDatasPesquisaV2Input,
} from './janela-datas'

describe('gerarJanelaDatasPesquisaV2', () => {
  // 1. Gera janela com data inicial válida
  it('gera janela com data inicial válida', () => {
    const input: GerarJanelaDatasPesquisaV2Input = {
      dataInicialISO: '2026-06-13',
      diasPesquisaAgenda: 3,
    }

    const result = gerarJanelaDatasPesquisaV2(input)

    expect(result.ok).toBe(true)
    expect(result.datas).toHaveLength(3)
    expect(result.avisos).toHaveLength(0)
  })

  // 2. Inclui a própria data inicial como índice 0
  it('inclui a própria data inicial como índice 0', () => {
    const input: GerarJanelaDatasPesquisaV2Input = {
      dataInicialISO: '2026-06-13',
      diasPesquisaAgenda: 5,
    }

    const result = gerarJanelaDatasPesquisaV2(input)

    expect(result.datas[0].dataISO).toBe('2026-06-13')
    expect(result.datas[0].indice).toBe(0)
  })

  // 3. Gera quantidade correta de dias
  it('gera exatamente a quantidade de dias solicitada', () => {
    const input: GerarJanelaDatasPesquisaV2Input = {
      dataInicialISO: '2026-06-01',
      diasPesquisaAgenda: 10,
    }

    const result = gerarJanelaDatasPesquisaV2(input)

    expect(result.datas).toHaveLength(10)
  })

  // 4. Marca sábado corretamente
  it('marca sábado corretamente (diaSemana === 6)', () => {
    // 2026-06-13 é sábado
    const input: GerarJanelaDatasPesquisaV2Input = {
      dataInicialISO: '2026-06-13',
      diasPesquisaAgenda: 3,
    }

    const result = gerarJanelaDatasPesquisaV2(input)

    const sabado = result.datas.find((d) => d.dataISO === '2026-06-13')
    expect(sabado).toBeDefined()
    expect(sabado!.ehSabado).toBe(true)
    expect(sabado!.diaSemana).toBe(6)
    expect(sabado!.ehDomingo).toBe(false)
  })

  // 5. Marca domingo corretamente
  it('marca domingo corretamente (diaSemana === 0)', () => {
    // 2026-06-14 é domingo
    const input: GerarJanelaDatasPesquisaV2Input = {
      dataInicialISO: '2026-06-14',
      diasPesquisaAgenda: 3,
    }

    const result = gerarJanelaDatasPesquisaV2(input)

    const domingo = result.datas.find((d) => d.dataISO === '2026-06-14')
    expect(domingo).toBeDefined()
    expect(domingo!.ehDomingo).toBe(true)
    expect(domingo!.diaSemana).toBe(0)
    expect(domingo!.ehSabado).toBe(false)
  })

  // 6. Mantém ordem cronológica
  it('mantém ordem cronológica estrita', () => {
    const input: GerarJanelaDatasPesquisaV2Input = {
      dataInicialISO: '2026-06-10',
      diasPesquisaAgenda: 7,
    }

    const result = gerarJanelaDatasPesquisaV2(input)

    for (let i = 1; i < result.datas.length; i++) {
      const anterior = result.datas[i - 1].dataISO
      const atual = result.datas[i].dataISO
      expect(new Date(atual).getTime()).toBeGreaterThan(new Date(anterior).getTime())
    }
  })

  // 7. Rejeita data ausente
  it('rejeita data inicial ausente', () => {
    const input: GerarJanelaDatasPesquisaV2Input = {
      dataInicialISO: null,
      diasPesquisaAgenda: 3,
    }

    const result = gerarJanelaDatasPesquisaV2(input)

    expect(result.ok).toBe(false)
    expect(result.datas).toHaveLength(0)
    expect(result.avisos).toContain('Data inicial ausente.')
  })

  // 8. Rejeita data inválida
  it('rejeita data inicial em formato inválido', () => {
    const input: GerarJanelaDatasPesquisaV2Input = {
      dataInicialISO: '13/06/2026',
      diasPesquisaAgenda: 3,
    }

    const result = gerarJanelaDatasPesquisaV2(input)

    expect(result.ok).toBe(false)
    expect(result.datas).toHaveLength(0)
    expect(result.avisos).toContain('Data inicial inválida. Use formato YYYY-MM-DD.')
  })

  // 9. Rejeita diasPesquisaAgenda zero
  it('rejeita quantidade de dias igual a zero', () => {
    const input: GerarJanelaDatasPesquisaV2Input = {
      dataInicialISO: '2026-06-13',
      diasPesquisaAgenda: 0,
    }

    const result = gerarJanelaDatasPesquisaV2(input)

    expect(result.ok).toBe(false)
    expect(result.datas).toHaveLength(0)
    expect(result.avisos).toContain('Quantidade de dias deve ser maior que zero.')
  })

  // 10. Rejeita diasPesquisaAgenda negativo
  it('rejeita quantidade de dias negativa', () => {
    const input: GerarJanelaDatasPesquisaV2Input = {
      dataInicialISO: '2026-06-13',
      diasPesquisaAgenda: -5,
    }

    const result = gerarJanelaDatasPesquisaV2(input)

    expect(result.ok).toBe(false)
    expect(result.datas).toHaveLength(0)
    expect(result.avisos).toContain('Quantidade de dias deve ser maior que zero.')
  })

  // 11. Normaliza diasPesquisaAgenda decimal (arredonda para baixo)
  it('normaliza quantidade de dias decimal arredondando para baixo', () => {
    const input: GerarJanelaDatasPesquisaV2Input = {
      dataInicialISO: '2026-06-13',
      diasPesquisaAgenda: 5.9,
    }

    const result = gerarJanelaDatasPesquisaV2(input)

    expect(result.ok).toBe(true)
    expect(result.datas).toHaveLength(5)
    expect(result.avisos).toContain('Quantidade de dias decimal foi arredondada para baixo.')
  })

  // 12. Limita janela muito alta a 180 dias com aviso
  it('limita janela a 180 dias quando solicitado valor acima do limite', () => {
    const input: GerarJanelaDatasPesquisaV2Input = {
      dataInicialISO: '2026-06-13',
      diasPesquisaAgenda: 500,
    }

    const result = gerarJanelaDatasPesquisaV2(input)

    expect(result.ok).toBe(true)
    expect(result.datas).toHaveLength(180)
    expect(result.avisos).toContain('Quantidade de dias limitada a 180 para segurança.')
  })

  // 13. Não muta o objeto de entrada
  it('não muta o objeto de entrada', () => {
    const input: GerarJanelaDatasPesquisaV2Input = {
      dataInicialISO: '2026-06-13',
      diasPesquisaAgenda: 3,
    }

    const copia = { ...input }
    gerarJanelaDatasPesquisaV2(input)

    expect(input).toEqual(copia)
  })

  // 14. Não depende do horário atual (determinístico)
  it('produz o mesmo resultado independentemente do horário de execução', () => {
    const input: GerarJanelaDatasPesquisaV2Input = {
      dataInicialISO: '2026-06-13',
      diasPesquisaAgenda: 3,
    }

    const r1 = gerarJanelaDatasPesquisaV2(input)
    const r2 = gerarJanelaDatasPesquisaV2(input)

    expect(r1).toEqual(r2)
  })

  // 15. Funciona em virada de mês
  it('funciona corretamente na virada de mês', () => {
    const input: GerarJanelaDatasPesquisaV2Input = {
      dataInicialISO: '2026-06-30',
      diasPesquisaAgenda: 3,
    }

    const result = gerarJanelaDatasPesquisaV2(input)

    expect(result.ok).toBe(true)
    expect(result.datas).toHaveLength(3)
    expect(result.datas[0].dataISO).toBe('2026-06-30')
    expect(result.datas[1].dataISO).toBe('2026-07-01')
    expect(result.datas[2].dataISO).toBe('2026-07-02')
  })

  // 16. Funciona em virada de ano
  it('funciona corretamente na virada de ano', () => {
    const input: GerarJanelaDatasPesquisaV2Input = {
      dataInicialISO: '2026-12-30',
      diasPesquisaAgenda: 4,
    }

    const result = gerarJanelaDatasPesquisaV2(input)

    expect(result.ok).toBe(true)
    expect(result.datas).toHaveLength(4)
    expect(result.datas[0].dataISO).toBe('2026-12-30')
    expect(result.datas[1].dataISO).toBe('2026-12-31')
    expect(result.datas[2].dataISO).toBe('2027-01-01')
    expect(result.datas[3].dataISO).toBe('2027-01-02')
  })
})
