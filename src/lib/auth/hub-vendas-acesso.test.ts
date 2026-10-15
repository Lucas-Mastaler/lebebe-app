import { describe, expect, it } from 'vitest'
import { acessoHubVendasPermiteGerenciamento } from './module-access'

describe('acesso Hub Vendas', () => {
  it('libera gerenciamento para superadmin e para a permissão de gerenciamento', () => {
    expect(acessoHubVendasPermiteGerenciamento({
      acessoTotal: true,
      moduleKey: 'hub_vendas_recuperacao',
    })).toBe(true)
    expect(acessoHubVendasPermiteGerenciamento({
      acessoTotal: false,
      moduleKey: 'hub_vendas_gestao',
    })).toBe(true)
  })

  it('mantém visualização sem os controles de gerenciamento', () => {
    expect(acessoHubVendasPermiteGerenciamento({
      acessoTotal: false,
      moduleKey: 'hub_vendas_recuperacao',
    })).toBe(false)
  })
})
