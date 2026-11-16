import { createElement } from 'react'
import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { NotasDoRecebimento } from './NotasDoRecebimento'

describe('NotasDoRecebimento', () => {
  it('mostra cada nota e a soma dos volumes declarados', () => {
    const html = renderToStaticMarkup(createElement(NotasDoRecebimento, { notas: [
      { nfe_id: '1', nfe: { numero_nf: '101', volumes_total: 20, is_os: false } },
      { nfe_id: '2', nfe: { numero_nf: '102', volumes_total: 15, is_os: true } },
    ] }))
    expect(html).toContain('101')
    expect(html).toContain('102')
    expect(html).toContain('35')
    expect(html).toContain('20 vol.')
    expect(html).toContain('15 vol.')
  })
  it('não apresenta total como completo quando falta o volume de uma nota', () => {
    const html = renderToStaticMarkup(createElement(NotasDoRecebimento, { notas: [
      { nfe_id: '1', nfe: { numero_nf: '101', volumes_total: 20, is_os: false } },
      { nfe_id: '2', nfe: { numero_nf: '102', volumes_total: null, is_os: false } },
    ] }))
    expect(html).toContain('não informado')
    expect(html).toContain('O total não está disponível')
  })
})
