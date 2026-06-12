import { describe, it, expect } from 'vitest'
import {
  filtrarDisponibilidadePorJanelaV2,
  type FiltrarDisponibilidadePorJanelaV2Input,
  type DisponibilidadeEquipeDataV2,
} from './disponibilidade'
import type { DataJanelaPesquisaV2 } from './janela-datas'

describe('filtrarDisponibilidadePorJanelaV2', () => {
  const janelaBase: DataJanelaPesquisaV2[] = [
    { dataISO: '2026-06-13', indice: 0, diaSemana: 6, ehSabado: true, ehDomingo: false },
    { dataISO: '2026-06-14', indice: 1, diaSemana: 0, ehSabado: false, ehDomingo: true },
    { dataISO: '2026-06-15', indice: 2, diaSemana: 1, ehSabado: false, ehDomingo: false },
  ]

  // 1. Janela vazia → ok: false
  it('rejeita janela vazia', () => {
    const input: FiltrarDisponibilidadePorJanelaV2Input = {
      janela: [],
      disponibilidades: [],
      tempoNecessarioMin: 120,
    }

    const result = filtrarDisponibilidadePorJanelaV2(input)

    expect(result.ok).toBe(false)
    expect(result.datas).toHaveLength(0)
    expect(result.avisos).toContain('Janela de datas vazia.')
  })

  // 2. Disponibilidades vazias → datas com equipes: [] e aviso
  it('retorna datas com equipes vazias quando não há disponibilidades', () => {
    const input: FiltrarDisponibilidadePorJanelaV2Input = {
      janela: janelaBase,
      disponibilidades: [],
      tempoNecessarioMin: 120,
    }

    const result = filtrarDisponibilidadePorJanelaV2(input)

    expect(result.ok).toBe(true)
    expect(result.datas).toHaveLength(3)
    expect(result.datas[0].equipes).toHaveLength(0)
    expect(result.avisos).toContain('Nenhuma disponibilidade válida encontrada para as datas da janela.')
  })

  // 3. Agrupa disponibilidade por dataISO
  it('agrupa disponibilidades por dataISO corretamente', () => {
    const input: FiltrarDisponibilidadePorJanelaV2Input = {
      janela: janelaBase,
      disponibilidades: [
        { dataISO: '2026-06-13', equipe: 'EQUIPE 1', disponivelMin: 240 },
        { dataISO: '2026-06-14', equipe: 'EQUIPE 1', disponivelMin: 180 },
        { dataISO: '2026-06-14', equipe: 'EQUIPE 2', disponivelMin: 120 },
      ],
      tempoNecessarioMin: 120,
    }

    const result = filtrarDisponibilidadePorJanelaV2(input)

    expect(result.ok).toBe(true)
    expect(result.datas[0].equipes).toHaveLength(1) // 13/06
    expect(result.datas[1].equipes).toHaveLength(2) // 14/06
    expect(result.datas[2].equipes).toHaveLength(0) // 15/06
  })

  // 4. Normaliza EQUIPE 01 para EQUIPE 1
  it('normaliza "EQUIPE 01" para "EQUIPE 1"', () => {
    const input: FiltrarDisponibilidadePorJanelaV2Input = {
      janela: [janelaBase[0]],
      disponibilidades: [
        { dataISO: '2026-06-13', equipe: 'EQUIPE 01', disponivelMin: 240 },
      ],
      tempoNecessarioMin: 120,
    }

    const result = filtrarDisponibilidadePorJanelaV2(input)

    expect(result.datas[0].equipes[0].equipe).toBe('EQUIPE 1')
  })

  // 5. Ignora ou avisa equipe inválida
  it('ignora equipe inválida e adiciona aviso', () => {
    const input: FiltrarDisponibilidadePorJanelaV2Input = {
      janela: [janelaBase[0]],
      disponibilidades: [
        { dataISO: '2026-06-13', equipe: 'EQUIPE 3', disponivelMin: 240 },
      ],
      tempoNecessarioMin: 120,
    }

    const result = filtrarDisponibilidadePorJanelaV2(input)

    expect(result.datas[0].equipes).toHaveLength(0)
    expect(result.avisos).toContain('Equipe "EQUIPE 3" ignorada — não foi possível normalizar.')
  })

  // 6. Marca suficienteParaServico: true quando disponivelMin >= tempoNecessarioMin
  it('marca suficienteParaServico: true quando disponível >= tempo necessário', () => {
    const input: FiltrarDisponibilidadePorJanelaV2Input = {
      janela: [janelaBase[0]],
      disponibilidades: [
        { dataISO: '2026-06-13', equipe: 'EQUIPE 1', disponivelMin: 240 },
      ],
      tempoNecessarioMin: 120,
    }

    const result = filtrarDisponibilidadePorJanelaV2(input)

    expect(result.datas[0].equipes[0].suficienteParaServico).toBe(true)
  })

  // 7. Marca suficienteParaServico: false quando insuficiente
  it('marca suficienteParaServico: false quando disponível < tempo necessário', () => {
    const input: FiltrarDisponibilidadePorJanelaV2Input = {
      janela: [janelaBase[0]],
      disponibilidades: [
        { dataISO: '2026-06-13', equipe: 'EQUIPE 1', disponivelMin: 60 },
      ],
      tempoNecessarioMin: 120,
    }

    const result = filtrarDisponibilidadePorJanelaV2(input)

    expect(result.datas[0].equipes[0].suficienteParaServico).toBe(false)
  })

  // 8. tempoNecessarioMin: null não quebra e gera aviso
  it('lida com tempoNecessarioMin: null sem quebrar', () => {
    const input: FiltrarDisponibilidadePorJanelaV2Input = {
      janela: [janelaBase[0]],
      disponibilidades: [
        { dataISO: '2026-06-13', equipe: 'EQUIPE 1', disponivelMin: 240 },
      ],
      tempoNecessarioMin: null,
    }

    const result = filtrarDisponibilidadePorJanelaV2(input)

    expect(result.ok).toBe(true)
    expect(result.datas[0].equipes[0].suficienteParaServico).toBe(false)
    expect(result.avisos).toContain(
      'Tempo necessário ausente ou inválido. Todas as equipes serão marcadas como insuficientes.'
    )
  })

  // 9. Equipe inativa aparece com ativa: false e suficienteParaServico: false
  it('mantém equipe inativa com ativa: false e suficienteParaServico: false', () => {
    const input: FiltrarDisponibilidadePorJanelaV2Input = {
      janela: [janelaBase[0]],
      disponibilidades: [
        { dataISO: '2026-06-13', equipe: 'EQUIPE 1', disponivelMin: 240, ativa: false },
      ],
      tempoNecessarioMin: 120,
    }

    const result = filtrarDisponibilidadePorJanelaV2(input)

    expect(result.datas[0].equipes[0].ativa).toBe(false)
    expect(result.datas[0].equipes[0].suficienteParaServico).toBe(false)
    expect(result.datas[0].equipes[0].disponivelMin).toBe(240)
  })

  // 10. Mantém data da janela mesmo sem disponibilidade
  it('mantém data da janela mesmo sem disponibilidade', () => {
    const input: FiltrarDisponibilidadePorJanelaV2Input = {
      janela: janelaBase,
      disponibilidades: [
        { dataISO: '2026-06-13', equipe: 'EQUIPE 1', disponivelMin: 240 },
      ],
      tempoNecessarioMin: 120,
    }

    const result = filtrarDisponibilidadePorJanelaV2(input)

    expect(result.datas).toHaveLength(3)
    expect(result.datas[0].equipes).toHaveLength(1)
    expect(result.datas[1].equipes).toHaveLength(0)
    expect(result.datas[2].equipes).toHaveLength(0)
  })

  // 11. Mantém ordem cronológica
  it('preserva ordem cronológica da janela', () => {
    const input: FiltrarDisponibilidadePorJanelaV2Input = {
      janela: janelaBase,
      disponibilidades: [
        { dataISO: '2026-06-15', equipe: 'EQUIPE 1', disponivelMin: 240 },
        { dataISO: '2026-06-13', equipe: 'EQUIPE 1', disponivelMin: 240 },
      ],
      tempoNecessarioMin: 120,
    }

    const result = filtrarDisponibilidadePorJanelaV2(input)

    expect(result.datas[0].dataISO).toBe('2026-06-13')
    expect(result.datas[1].dataISO).toBe('2026-06-14')
    expect(result.datas[2].dataISO).toBe('2026-06-15')
  })

  // 12. Ordena equipes por nome
  it('ordena equipes por nome normalizado', () => {
    const input: FiltrarDisponibilidadePorJanelaV2Input = {
      janela: [janelaBase[0]],
      disponibilidades: [
        { dataISO: '2026-06-13', equipe: 'EQUIPE 2', disponivelMin: 120 },
        { dataISO: '2026-06-13', equipe: 'EQUIPE 1', disponivelMin: 240 },
      ],
      tempoNecessarioMin: 120,
    }

    const result = filtrarDisponibilidadePorJanelaV2(input)

    expect(result.datas[0].equipes[0].equipe).toBe('EQUIPE 1')
    expect(result.datas[0].equipes[1].equipe).toBe('EQUIPE 2')
  })

  // 13. Não muta input
  it('não muta os objetos de entrada', () => {
    const janelaCopia = structuredClone(janelaBase)
    const disponibilidades: DisponibilidadeEquipeDataV2[] = [
      { dataISO: '2026-06-13', equipe: 'EQUIPE 1', disponivelMin: 240 },
    ]

    const input: FiltrarDisponibilidadePorJanelaV2Input = {
      janela: janelaBase,
      disponibilidades,
      tempoNecessarioMin: 120,
    }

    filtrarDisponibilidadePorJanelaV2(input)

    expect(input.janela).toEqual(janelaCopia)
    expect(input.disponibilidades).toEqual(disponibilidades)
  })

  // 14. Campos extras não quebram
  it('ignora campos extras em disponibilidades', () => {
    const input: FiltrarDisponibilidadePorJanelaV2Input = {
      janela: [janelaBase[0]],
      disponibilidades: [
        {
          dataISO: '2026-06-13',
          equipe: 'EQUIPE 1',
          disponivelMin: 240,
          ativa: true,
          motivoIndisponibilidade: null,
          // @ts-expect-error campo extra
          campoExtra: 'ignorado',
        },
      ],
      tempoNecessarioMin: 120,
    }

    const result = filtrarDisponibilidadePorJanelaV2(input)

    expect(result.ok).toBe(true)
    expect(result.datas[0].equipes).toHaveLength(1)
  })

  // 15. Considera somente disponibilidades dentro da janela
  it('ignora disponibilidades fora da janela', () => {
    const input: FiltrarDisponibilidadePorJanelaV2Input = {
      janela: [janelaBase[0]],
      disponibilidades: [
        { dataISO: '2026-06-13', equipe: 'EQUIPE 1', disponivelMin: 240 },
        { dataISO: '2026-06-20', equipe: 'EQUIPE 1', disponivelMin: 240 }, // fora da janela
      ],
      tempoNecessarioMin: 120,
    }

    const result = filtrarDisponibilidadePorJanelaV2(input)

    expect(result.datas[0].equipes).toHaveLength(1)
    expect(result.datas[0].equipes[0].disponivelMin).toBe(240)
  })

  // 16. Duplicidade da mesma equipe/data: manter maior disponivelMin
  it('mantém maior disponivelMin quando há duplicidade de equipe/data', () => {
    const input: FiltrarDisponibilidadePorJanelaV2Input = {
      janela: [janelaBase[0]],
      disponibilidades: [
        { dataISO: '2026-06-13', equipe: 'EQUIPE 1', disponivelMin: 120 },
        { dataISO: '2026-06-13', equipe: 'EQUIPE 1', disponivelMin: 240 },
      ],
      tempoNecessarioMin: 120,
    }

    const result = filtrarDisponibilidadePorJanelaV2(input)

    expect(result.datas[0].equipes).toHaveLength(1)
    expect(result.datas[0].equipes[0].disponivelMin).toBe(240)
    expect(result.avisos.some((a) => a.includes('Duplicidade'))).toBe(true)
  })

  // 17. Duplicidade com ativa: false em um dos registros → marca inativa
  it('marca inativa se algum registro duplicado for inativo', () => {
    const input: FiltrarDisponibilidadePorJanelaV2Input = {
      janela: [janelaBase[0]],
      disponibilidades: [
        { dataISO: '2026-06-13', equipe: 'EQUIPE 1', disponivelMin: 240, ativa: true },
        { dataISO: '2026-06-13', equipe: 'EQUIPE 1', disponivelMin: 120, ativa: false },
      ],
      tempoNecessarioMin: 120,
    }

    const result = filtrarDisponibilidadePorJanelaV2(input)

    expect(result.datas[0].equipes[0].ativa).toBe(false)
    expect(result.datas[0].equipes[0].disponivelMin).toBe(240) // maior min
  })

  // 18. motivoIndisponibilidade é preservado
  it('preserva motivoIndisponibilidade quando presente', () => {
    const input: FiltrarDisponibilidadePorJanelaV2Input = {
      janela: [janelaBase[0]],
      disponibilidades: [
        {
          dataISO: '2026-06-13',
          equipe: 'EQUIPE 1',
          disponivelMin: 240,
          ativa: false,
          motivoIndisponibilidade: 'Férias da equipe',
        },
      ],
      tempoNecessarioMin: 120,
    }

    const result = filtrarDisponibilidadePorJanelaV2(input)

    expect(result.datas[0].equipes[0].motivoIndisponibilidade).toBe('Férias da equipe')
  })

  // 19. disponibilidades com dados fora da janela e inválidos não geram aviso se houver pelo menos uma válida
  it('ignora silenciosamente disponibilidades fora da janela quando há válidas', () => {
    const input: FiltrarDisponibilidadePorJanelaV2Input = {
      janela: [janelaBase[0]],
      disponibilidades: [
        { dataISO: '2026-06-13', equipe: 'EQUIPE 1', disponivelMin: 240 },
        { dataISO: '2026-06-20', equipe: 'EQUIPE 1', disponivelMin: 240 }, // fora
      ],
      tempoNecessarioMin: 120,
    }

    const result = filtrarDisponibilidadePorJanelaV2(input)

    expect(result.ok).toBe(true)
    expect(result.datas[0].equipes).toHaveLength(1)
    // Não deve ter aviso de "nenhuma disponibilidade válida"
    expect(result.avisos).not.toContain(
      'Nenhuma disponibilidade válida encontrada para as datas da janela.'
    )
  })
})
