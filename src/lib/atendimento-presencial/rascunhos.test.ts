import { describe, expect, it } from 'vitest'
import {
  calcularExpiracaoRascunho,
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
      dados: { notaTecnica: 'teste' },
    })
    expect(validarDadosRascunho({ campoLivre: 'x' })).toMatchObject({ ok: false, field: 'dadosRascunho' })
    expect(validarDadosRascunho({ notaTecnica: 'x'.repeat(1001) })).toMatchObject({ ok: false, field: 'notaTecnica' })
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
})
