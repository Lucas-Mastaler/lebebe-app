import { describe, expect, it } from 'vitest'
import {
  montarPayloadEdicaoAtendimento,
  normalizarDetalheParaFichaEdicao,
  normalizarObservacoesRegistro,
  serializarClienteRegistro,
  type RegistroAtendimentoDetalheDTO,
} from './registros'
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

  it('normaliza detalhe concluido para edicao e monta payload sem campos fora do rascunho', () => {
    const detalhe = {
      atendimento: {
        id: 'atendimento-1',
        clienteId: 'cliente-1',
        consultoraUsuarioId: 'usuario-1',
        unidadeId: 'unidade-1',
        status: 'concluido',
        draftClientId: 'draft-1',
        dadosRascunho: {
          criancas: [],
          departamentos: [],
          produtosInteresse: [],
          motivosResultado: [],
          etapaAtual: 'revisao',
        },
        resultadoAtendimento: 'nao',
        motivoOutro: 'Comparando lista',
        observacoes: 'Nova observacao',
        numeroLancamento: null,
        viradaCartaoDia: 15,
        viradaCartaoMes: 8,
        concluidoEm: '2026-07-16T12:00:00.000Z',
        iniciadoEm: '2026-07-16T11:00:00.000Z',
        ultimaAtividadeEm: '2026-07-16T12:00:00.000Z',
        expiraEm: '2026-07-21T12:00:00.000Z',
        version: 4,
        criadoPor: 'usuario-1',
        atualizadoPor: 'usuario-1',
        createdAt: '2026-07-16T11:00:00.000Z',
        updatedAt: '2026-07-16T12:00:00.000Z',
        expirado: false,
      },
      cliente: null,
      criancas: [
        {
          id: 'crianca-db-1',
          ordem: 2,
          local_id: 'crianca-local-1',
          situacao: 'ja_nasceu',
          nome: null,
          nome_nao_informado: true,
          sexo: 'menina',
          idade_unidade: 'meses',
          idade_valor: 6,
          data_prevista_nascimento: null,
        },
      ],
      departamentos: [{ id: 'dep-1', ordem: 1, departamento: 'moveis' }],
      produtosInteresse: [{ id: 'prod-1', ordem: 1, descricao: 'Berco' }],
      motivos: [
        { id: 'mot-1', ordem: 1, motivo: 'virada_cartao', complemento: null },
        { id: 'mot-2', ordem: 2, motivo: 'outro', complemento: 'Comparando lista' },
      ],
      historico: [],
    } satisfies RegistroAtendimentoDetalheDTO

    const ficha = normalizarDetalheParaFichaEdicao(detalhe)
    const payload = montarPayloadEdicaoAtendimento({
      detalhe,
      ficha,
      numeroLancamento: null,
    })

    expect(ficha.criancas[0]).toMatchObject({
      id: 'crianca-local-1',
      nomeNaoInformado: true,
      idadeUnidade: 'meses',
      idadeValor: 6,
    })
    expect(ficha.motivosResultado).toEqual(['virada_cartao', 'outro'])
    expect(payload).toMatchObject({
      version: 4,
      clienteId: 'cliente-1',
      numeroLancamento: null,
    })
    expect(payload.dadosRascunho).not.toHaveProperty('clienteId')
    expect(payload.dadosRascunho).not.toHaveProperty('etapaAtual')
    expect(payload.dadosRascunho).not.toHaveProperty('notaTecnica')
  })
})
