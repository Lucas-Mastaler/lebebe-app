import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'
import { IdadeCriancaSelector } from '@/app/atendimento-presencial/prancheta/IdadeCriancaSelector'

vi.mock('@/components/design-system', () => ({ Button: 'button' }))

it.each([['meses', 11], ['anos', 6]] as const)('oferece valores de %s por toque e destaca a escolha', (unidade, limite) => {
  const html = renderToStaticMarkup(createElement(IdadeCriancaSelector, { unidade, valor: limite, onChange: vi.fn() }))
  expect(html.match(/<button/g)).toHaveLength(limite + 2)
  expect(html).toContain(`aria-pressed="true"`)
  expect(html).toContain(`>${limite}</button>`)
  expect(html).not.toContain('<input')
  expect(html).not.toContain('<select')
})

it('trocar unidade limpa a idade anterior, enquanto tocar em um valor mantém a unidade', () => {
  const onChange = vi.fn()
  const tree = IdadeCriancaSelector({ unidade: 'anos', valor: 5, onChange })
  const [unidades, valores] = tree.props.children
  unidades.props.children[0].props.onClick()
  expect(onChange).toHaveBeenLastCalledWith({ idadeUnidade: 'meses', idadeValor: undefined })
  valores.props.children[1].props.onClick()
  expect(onChange).toHaveBeenLastCalledWith({ idadeUnidade: 'anos', idadeValor: 2 })
})
