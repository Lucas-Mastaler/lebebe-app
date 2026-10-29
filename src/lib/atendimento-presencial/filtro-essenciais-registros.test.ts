import { describe, expect, it } from 'vitest'
import { analisarFiltroEssenciaisRegistro, filtrarAtendimentosPorEssenciais } from './filtro-essenciais-registros'

describe('filtro histórico de Produtos Essenciais em Registros', () => {
  it('exige produto válido e distingue resposta atual da fase do atendimento', () => {
    expect(analisarFiltroEssenciaisRegistro({ produto: null, situacao: 'sim' })).toMatchObject({ ok: false })
    expect(analisarFiltroEssenciaisRegistro({ produto: 'invalido', situacao: '' })).toMatchObject({ ok: false })
    expect(analisarFiltroEssenciaisRegistro({ produto: 'poltrona', situacao: 'nao_informado' })).toMatchObject({ ok: true, filtro: { produto: 'poltrona' } })
  })

  it('usa apenas o snapshot daquela visita e não confunde produto fora da fase com ausência de resposta', () => {
    const resultado = filtrarAtendimentosPorEssenciais({
      atendimentos: [{ id: 'antigo', versao_essenciais: null }, { id: 'novo', versao_essenciais: 1 }],
      criancas: [{ atendimento_id: 'antigo', nome: 'Alice' }],
      snapshots: [
        { atendimento_id: 'novo', crianca_id: 'criança-1', nome: 'Bia', respostas: [{ produto: 'poltrona', resposta: 'nao', confirmada: true }, { produto: 'berco', resposta: 'sim', confirmada: false }] },
      ],
      filtro: { produto: 'poltrona', situacao: 'nao' },
    })
    expect(Array.from(resultado.keys())).toEqual(['novo'])
    expect(resultado.get('novo')?.[0]).toMatchObject({ criancaNome: 'Bia', resposta: 'nao' })
  })

  it('trata respostas antigas não confirmadas e atendimentos anteriores à coleta como não informado', () => {
    const resultado = filtrarAtendimentosPorEssenciais({
      atendimentos: [{ id: 'parcial', versao_essenciais: 1 }, { id: 'legado', versao_essenciais: null }],
      criancas: [{ atendimento_id: 'legado', nome: null, nome_nao_informado: true }],
      snapshots: [{ atendimento_id: 'parcial', crianca_id: 'criança-1', nome: 'Bia', respostas: [{ produto: 'poltrona', resposta: 'sim', confirmada: false }] }],
      filtro: { produto: 'poltrona', situacao: 'nao_informado' },
    })
    expect(Array.from(resultado.keys()).sort()).toEqual(['legado', 'parcial'])
    expect(resultado.get('legado')?.[0].resposta).toBe('nao_informado')
    expect(resultado.get('parcial')?.[0].resposta).toBe('nao_informado')
  })
})
