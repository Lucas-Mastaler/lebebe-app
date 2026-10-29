import { describe, expect, it } from 'vitest'
import { analisarFiltroEssenciaisRegistro, filtrarAtendimentosPorEssenciais } from './filtro-essenciais-registros'

describe('filtro histórico de Produtos Essenciais em Registros', () => {
  it('exige produto válido e distingue resposta atual da fase do atendimento', () => {
    expect(analisarFiltroEssenciaisRegistro({ produtos: [], situacao: 'sim' })).toMatchObject({ ok: false })
    expect(analisarFiltroEssenciaisRegistro({ produtos: ['invalido'], situacao: '' })).toMatchObject({ ok: false })
    expect(analisarFiltroEssenciaisRegistro({ produtos: ['poltrona'], situacao: 'nao_informado' })).toMatchObject({ ok: true, filtro: { produtos: ['poltrona'] } })
  })

  it('usa apenas o snapshot daquela visita e não confunde produto fora da fase com ausência de resposta', () => {
    const resultado = filtrarAtendimentosPorEssenciais({
      atendimentos: [{ id: 'antigo', versao_essenciais: null }, { id: 'novo', versao_essenciais: 1 }],
      criancas: [{ atendimento_id: 'antigo', nome: 'Alice' }],
      snapshots: [
        { atendimento_id: 'novo', crianca_id: 'criança-1', nome: 'Bia', respostas: [{ produto: 'poltrona', resposta: 'nao', confirmada: true }, { produto: 'berco', resposta: 'sim', confirmada: false }] },
      ],
      filtro: { produtos: ['poltrona', 'berco'], situacao: 'sim' },
    })
    expect(Array.from(resultado.keys())).toEqual([])
    const resultadoAnd = filtrarAtendimentosPorEssenciais({
      atendimentos: [{ id: 'novo', versao_essenciais: 1 }], criancas: [],
      snapshots: [{ atendimento_id: 'novo', crianca_id: 'criança-1', nome: 'Bia', respostas: [{ produto: 'poltrona', resposta: 'sim', confirmada: true }, { produto: 'berco', resposta: 'sim', confirmada: true }] }],
      filtro: { produtos: ['poltrona', 'berco'], situacao: 'sim' },
    })
    expect(resultadoAnd.get('novo')).toHaveLength(2)
  })

  it('trata respostas antigas não confirmadas e atendimentos anteriores à coleta como não informado', () => {
    const resultado = filtrarAtendimentosPorEssenciais({
      atendimentos: [{ id: 'parcial', versao_essenciais: 1 }, { id: 'legado', versao_essenciais: null }],
      criancas: [{ atendimento_id: 'legado', nome: null, nome_nao_informado: true }],
      snapshots: [{ atendimento_id: 'parcial', crianca_id: 'criança-1', nome: 'Bia', respostas: [{ produto: 'poltrona', resposta: 'sim', confirmada: false }, { produto: 'berco', resposta: 'nao', confirmada: false }] }],
      filtro: { produtos: ['poltrona', 'berco'], situacao: 'nao_informado' },
    })
    expect(Array.from(resultado.keys()).sort()).toEqual(['legado', 'parcial'])
    expect(resultado.get('legado')?.[0].resposta).toBe('nao_informado')
    expect(resultado.get('parcial')?.[0].resposta).toBe('nao_informado')
  })

  it('exige todos os produtos na mesma resposta histórica e não mistura atendimentos', () => {
    const resultado = filtrarAtendimentosPorEssenciais({
      atendimentos: [{ id: 'visita-a', versao_essenciais: 1 }, { id: 'visita-b', versao_essenciais: 1 }],
      criancas: [],
      snapshots: [
        { atendimento_id: 'visita-a', crianca_id: 'crianca-1', nome: 'Bia', respostas: [{ produto: 'berco', resposta: 'nao', confirmada: true }] },
        { atendimento_id: 'visita-b', crianca_id: 'crianca-1', nome: 'Bia', respostas: [{ produto: 'comoda', resposta: 'nao', confirmada: true }] },
      ],
      filtro: { produtos: ['berco', 'comoda'], situacao: 'nao' },
    })

    expect(Array.from(resultado.keys())).toEqual([])
  })

  it('inclui somente atendimentos em que todos os produtos estão como Não informado', () => {
    const resultado = filtrarAtendimentosPorEssenciais({
      atendimentos: [{ id: 'todos-nao-informados', versao_essenciais: 1 }, { id: 'um-informado', versao_essenciais: 1 }],
      criancas: [],
      snapshots: [
        { atendimento_id: 'todos-nao-informados', crianca_id: 'crianca-1', nome: 'Bia', respostas: [{ produto: 'berco', resposta: 'sim', confirmada: false }, { produto: 'comoda', resposta: 'nao', confirmada: false }] },
        { atendimento_id: 'um-informado', crianca_id: 'crianca-2', nome: 'Ana', respostas: [{ produto: 'berco', resposta: 'nao', confirmada: true }, { produto: 'comoda', resposta: 'sim', confirmada: false }] },
      ],
      filtro: { produtos: ['berco', 'comoda'], situacao: 'nao_informado' },
    })

    expect(Array.from(resultado.keys())).toEqual(['todos-nao-informados'])
    expect(resultado.get('todos-nao-informados')).toHaveLength(2)
  })
})
