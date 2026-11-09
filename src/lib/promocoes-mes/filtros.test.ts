import { describe, expect, it } from 'vitest'
import { escaparLike, lerFiltrosPromocoes } from './filtros'

const q = (s: string) => new URLSearchParams(s)

describe('filtros da listagem de promoções', () => {
  it('usa padrões quando nada é informado', () => {
    expect(lerFiltrosPromocoes(q(''))).toEqual({ titulo: '', inicioDe: '', fimAte: '', situacao: '', page: 1, pageSize: 10 })
  })

  it('lê título, datas, situação e paginação', () => {
    expect(lerFiltrosPromocoes(q('titulo=%20black%20&inicioDe=2026-11-01&fimAte=2026-11-30&situacao=VIGENTE&page=3&pageSize=20')))
      .toEqual({ titulo: 'black', inicioDe: '2026-11-01', fimAte: '2026-11-30', situacao: 'VIGENTE', page: 3, pageSize: 20 })
  })

  it('rejeita data, situação inválidas (422) e limita página/tamanho', () => {
    expect(() => lerFiltrosPromocoes(q('inicioDe=2026-13-01'))).toThrowError()
    expect(() => lerFiltrosPromocoes(q('fimAte=abc'))).toThrowError()
    expect(() => lerFiltrosPromocoes(q('situacao=OUTRA'))).toThrowError()
    const f = lerFiltrosPromocoes(q('page=-4&pageSize=9999'))
    expect(f.page).toBe(1)
    expect(f.pageSize).toBe(50)
  })

  it('escapa curingas do LIKE', () => {
    expect(escaparLike('50%_off\\')).toBe('50\\%\\_off\\\\')
  })
})
