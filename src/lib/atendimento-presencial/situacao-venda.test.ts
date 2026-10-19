import { describe, expect, it } from 'vitest'
import { SITUACOES_VENDA, situacaoVendaRegistro } from './registros'
describe('situação da venda', () => {
  it.each(SITUACOES_VENDA)('apresenta $label com tom semântico', ({ chave, label, tone }) => {
    expect(situacaoVendaRegistro(chave)).toMatchObject({ label, tone })
  })
  it.each([null, undefined, '', 'legado_desconhecido'])('não inventa resultado para %s', (valor) => {
    expect(situacaoVendaRegistro(valor)).toEqual({ label: 'Não informado', tone: 'neutral' })
  })
})
