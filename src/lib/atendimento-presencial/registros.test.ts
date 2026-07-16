import { describe, expect, it } from 'vitest'
import { normalizarObservacoesRegistro, serializarClienteRegistro } from './registros'
import type { AtendimentoPresencialDTO } from './rascunhos-shared'

describe('registros atendimento presencial', () => {
  it('usa observacoes finais do atendimento concluido, preservando acentos e quebras de linha', () => {
    const atendimento = {
      observacoes: 'Preferencia por móveis claros.\nVoltar contato após almoço.',
    } as Pick<AtendimentoPresencialDTO, 'observacoes'>

    expect(normalizarObservacoesRegistro(atendimento)).toBe('Preferencia por móveis claros.\nVoltar contato após almoço.')
  })

  it('nao tenta recuperar observacoes vazias do dados_rascunho concluido', () => {
    const atendimento = {
      observacoes: '   ',
    } as Pick<AtendimentoPresencialDTO, 'observacoes'>

    expect(normalizarObservacoesRegistro(atendimento)).toBeNull()
  })

  it('normaliza cliente vinculada historica sem depender de status ativo', () => {
    expect(serializarClienteRegistro({
      id: 'cliente-1',
      nome: 'Cliente Inativa',
      telefone_informado: '(41) 99999-0000',
      parentesco: 'mae',
      parentesco_outro: null,
    })).toEqual({
      id: 'cliente-1',
      nome: 'Cliente Inativa',
      telefone: '(41) 99999-0000',
      parentesco: 'mae',
      parentescoOutro: null,
    })
  })
})
