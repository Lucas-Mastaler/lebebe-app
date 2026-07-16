import { describe, expect, it } from 'vitest'
import {
  calcularExpiracaoRascunho,
  filtrarConsultorasPorUnidade,
  filtrarUnidadesPorConsultora,
  isUuid,
  rascunhoExpirado,
  unidadePermitida,
  usuarioPodeAcessarRascunho,
  validarDadosRascunho,
} from './rascunhos'

describe('rascunhos atendimento presencial', () => {
  it('valida UUID do draft client id', () => {
    expect(isUuid('123e4567-e89b-12d3-a456-426614174000')).toBe(true)
    expect(isUuid('draft-local')).toBe(false)
  })

  it('valida payload permitido do rascunho', () => {
    expect(validarDadosRascunho({ notaTecnica: ' teste ' })).toEqual({
      ok: true,
      dados: {
        criancas: [],
        departamentos: [],
        produtosInteresse: [],
        motivosResultado: [],
        etapaAtual: 'ficha',
      },
    })
    expect(validarDadosRascunho({ campoLivre: 'x' })).toMatchObject({ ok: false, field: 'dadosRascunho' })
    expect(validarDadosRascunho({ departamentos: ['invalido'] })).toMatchObject({
      ok: true,
      dados: { departamentos: [] },
    })
  })

  it('calcula expiracao em cinco dias desde a atividade', () => {
    const base = new Date('2026-07-15T12:00:00.000Z')
    expect(calcularExpiracaoRascunho(base).toISOString()).toBe('2026-07-20T12:00:00.000Z')
  })

  it('identifica rascunho expirado', () => {
    expect(rascunhoExpirado('2026-07-15T12:00:00.000Z', new Date('2026-07-15T12:00:01.000Z'))).toBe(true)
    expect(rascunhoExpirado('2026-07-15T12:00:00.000Z', new Date('2026-07-15T11:59:59.000Z'))).toBe(false)
  })

  it('valida escopo de rascunho por perfil', () => {
    const row = { consultora_usuario_id: 'u1', unidade_id: 'loja-1' }
    const unidades = [{ id: 'loja-1', chave: 'loja_1', nome: 'Loja 1' }]

    expect(usuarioPodeAcessarRascunho({ row, authUserId: 'u1', perfil: 'consultora', unidadesPermitidas: [] })).toBe(true)
    expect(usuarioPodeAcessarRascunho({ row, authUserId: 'u2', perfil: 'consultora', unidadesPermitidas: [] })).toBe(false)
    expect(usuarioPodeAcessarRascunho({ row, authUserId: 'u2', perfil: 'supervisora_loja', unidadesPermitidas: unidades })).toBe(true)
    expect(usuarioPodeAcessarRascunho({ row, authUserId: 'u2', perfil: 'gestao', unidadesPermitidas: [] })).toBe(false)
    expect(usuarioPodeAcessarRascunho({ row, authUserId: 'u2', perfil: 'superadmin', unidadesPermitidas: [] })).toBe(true)
  })

  it('valida unidade permitida', () => {
    expect(unidadePermitida('loja-1', [{ id: 'loja-1', chave: 'loja_1', nome: 'Loja 1' }])).toBe(true)
    expect(unidadePermitida('loja-2', [{ id: 'loja-1', chave: 'loja_1', nome: 'Loja 1' }])).toBe(false)
  })

  it('filtra unidades pela consultora selecionada', () => {
    const unidades = [
      { id: 'loja-1', chave: 'loja_1', nome: 'Loja 1' },
      { id: 'loja-2', chave: 'loja_2', nome: 'Loja 2' },
    ]
    const consultoras = [
      { id: 'c1', email: 'c1@example.com', nome: 'c1@example.com', unidadeIds: ['loja-2'] },
      { id: 'c2', email: 'c2@example.com', nome: 'c2@example.com', unidadeIds: [] },
    ]

    expect(filtrarUnidadesPorConsultora({ unidades, consultoras, consultoraUsuarioId: 'c1' })).toEqual([unidades[1]])
    expect(filtrarUnidadesPorConsultora({ unidades, consultoras, consultoraUsuarioId: 'c2' })).toEqual([])
    expect(filtrarUnidadesPorConsultora({ unidades, consultoras, consultoraUsuarioId: '' })).toEqual(unidades)
  })

  it('filtra consultoras pela unidade selecionada', () => {
    const consultoras = [
      { id: 'c1', email: 'c1@example.com', nome: 'c1@example.com', unidadeIds: ['loja-1', 'loja-2'] },
      { id: 'c2', email: 'c2@example.com', nome: 'c2@example.com', unidadeIds: ['loja-2'] },
      { id: 'c3', email: 'c3@example.com', nome: 'c3@example.com', unidadeIds: [] },
    ]

    expect(filtrarConsultorasPorUnidade({ consultoras, unidadeId: 'loja-1' }).map((item) => item.id)).toEqual(['c1'])
    expect(filtrarConsultorasPorUnidade({ consultoras, unidadeId: 'loja-2' }).map((item) => item.id)).toEqual(['c1', 'c2'])
    expect(filtrarConsultorasPorUnidade({ consultoras, unidadeId: '' })).toEqual(consultoras)
  })
})
