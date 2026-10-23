import { describe, expect, it } from 'vitest'
import { parsearNFe } from './nfe-parser'
import { notaDoEmail } from './email-nfe'
import { xmlDeTeste } from './xml-upload.fixture'

describe('compatibilidade do parser do Gmail', () => {
  it('preserva conversões e códigos originais do e-mail', async () => {
    const nf = await parsearNFe(xmlDeTeste().xml.replace('2.0000', '2.6000'), 'msg')
    expect(notaDoEmail(nf)).toMatchObject({ numero_nf: '371272', volumes_total: 5, peso_total: 10.5, itens: expect.arrayContaining([expect.objectContaining({ codigo_produto: '000123', quantidade: 3 })]) })
  })
  it('não reconhece a mesma nota somente pelo número', async () => {
    const nf = await parsearNFe(xmlDeTeste().xml, 'msg')
    expect(() => notaDoEmail({ ...nf, chave_acesso: '' })).toThrow(/chave de acesso/)
    expect(() => notaDoEmail({ ...nf, numero_nf: '99999' })).toThrow(/chave de acesso/)
  })
})
