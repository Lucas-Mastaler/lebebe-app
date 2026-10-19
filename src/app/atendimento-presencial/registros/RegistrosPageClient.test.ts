import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import Registros from './RegistrosPageClient'
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: vi.fn(), push: vi.fn() }), useSearchParams: () => new URLSearchParams('tab=finalizados') }))
describe('registros salvos — renderização', () => {
  it('renomeia aba preservando identificador e apresenta filtro e rascunhos separados', () => {
    const html = renderToStaticMarkup(createElement(Registros, { podeVerRegistros: true, podeVerRascunhos: true }))
    expect(html).toContain('Atendimentos Salvos')
    expect(html).not.toContain('Atendimentos finalizados')
    expect(html).toContain('Rascunhos')
    expect(html).toContain('filtro-situacao-venda')
    expect(html).toContain('Situação da Venda')
    // Radix preenche SelectValue após hidratação; SSR comprova controle e label.
    expect(html).toContain('role="combobox"')
  })
  it('preserva ocultação por permissão', () => {
    const html = renderToStaticMarkup(createElement(Registros, { podeVerRegistros: false, podeVerRascunhos: true }))
    expect(html).not.toContain('Atendimentos Salvos')
    expect(html).toContain('Rascunhos')
  })
})
