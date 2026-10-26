import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { deveExibirCustoInterno, podeVerCustoInterno } from './custo-interno'

describe('autorização de custo interno', () => {
  it.each([
    ['consultora', false],
    ['supervisora_loja', false],
    ['gestao', true],
    ['pos_venda', true],
  ])('perfil %s', (perfilChave, esperado) => {
    expect(podeVerCustoInterno({ acessoTotal: false, perfilChave })).toBe(esperado)
  })

  it('libera superadmin pelo acesso total e nega perfil ausente ou falha', () => {
    expect(podeVerCustoInterno({ acessoTotal: true, perfilChave: null })).toBe(true)
    expect(podeVerCustoInterno({ acessoTotal: false, perfilChave: null })).toBe(false)
    expect(podeVerCustoInterno(null)).toBe(false)
    expect(podeVerCustoInterno(undefined)).toBe(false)
  })

  it('não exibe custo enquanto a permissão carrega ou falha', () => {
    const base = { acessoTotal: true, perfilChave: null }
    expect(deveExibirCustoInterno({ ...base, loading: true, error: false })).toBe(false)
    expect(deveExibirCustoInterno({ ...base, loading: false, error: true })).toBe(false)
    expect(deveExibirCustoInterno({ ...base, loading: false, error: false })).toBe(true)
    expect(deveExibirCustoInterno({
      loading: false, error: false, acessoTotal: false, perfilChave: 'consultora',
    })).toBe(false)
  })

  it('a gestão só renderiza custo depois da permissão confirmada', () => {
    const componente = readFileSync(
      path.resolve('src/components/pedidos-personalizados/GestaoPedidosPersonalizados.tsx'),
      'utf8',
    )
    expect(componente).toContain('deveExibirCustoInterno')
    expect(componente).toContain('loading: carregandoPermissoes')
    expect(componente).toContain('error: erroPermissoes')
    expect(componente).toContain("...(exibirCusto ? [{ key: 'custoUnitario'")
    expect(componente).toContain("{exibirCusto ? ` · Custo:")
    expect(componente).toContain('{exibirCusto ? <div><dt className="text-slate-500">Custo</dt>')
    expect(componente).toContain('Preço unit.')
    expect(componente).toContain('Venda:')
  })
})
