import { describe, expect, it } from 'vitest'
import { formatarVendaFechadaHistorico, montarUrlHistoricoCliente } from './HistoricoClienteModal'

describe('HistoricoClienteModal helpers', () => {
  it('monta a URL do historico sem atendimento atual quando nao informado', () => {
    expect(montarUrlHistoricoCliente('cliente-1')).toBe('/api/atendimento-presencial/clientes/cliente-1/historico')
  })

  it('inclui atendimentoAtualId apenas quando informado', () => {
    expect(montarUrlHistoricoCliente('cliente-1', 'atendimento-2')).toBe(
      '/api/atendimento-presencial/clientes/cliente-1/historico?atendimentoAtualId=atendimento-2'
    )
  })

  it('formata o resultado do atendimento como resposta clara para venda fechada', () => {
    expect(formatarVendaFechadaHistorico('sim')).toBe('Sim')
    expect(formatarVendaFechadaHistorico('nao')).toBe('Nao')
    expect(formatarVendaFechadaHistorico('negociacao')).toBe('Em negociacao')
    expect(formatarVendaFechadaHistorico(null)).toBe('Nao informado')
  })
})
