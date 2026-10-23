import { describe, expect, it } from 'vitest'
import { chaveValida, lerXmlRecebimento, XML_MAX_BYTES } from './xml-upload'
import { xmlDeTeste } from './xml-upload.fixture'
import { parsearNFe } from './nfe-parser'

const ler = (xml: string) => lerXmlRecebimento(new TextEncoder().encode(xml))
describe('XML manual de recebimento', () => {
  it('extrai nota, números dos itens, código com zeros, descrição e quantidades', async () => {
    const nota = await lerXmlRecebimento(xmlDeTeste().bytes)
    expect(nota).toMatchObject({ numero_nf: '371272', data_emissao: '2026-10-23', peso_total: 10.5, volumes_total: 5, is_os: false })
    expect(nota.itens).toEqual([{ n_item: 1, codigo_produto: '000123', descricao: 'PRODUTO DE TESTE & CIA', quantidade: 2 }, { n_item: 2, codigo_produto: '456', descricao: 'OUTRO PRODUTO DE TESTE', quantidade: 3 }])
  })
  it('preserva a saída e a identificação de OS do parser reutilizado', async () => {
    const xml = xmlDeTeste().xml.replace('VENDA TESTE', 'ASSIST.TECNICA').replace('OBSERVACAO DE TESTE', 'PRODUTOS: 871; O.S.: 1234; OC: 4321; S/PEDIDO: 7654; OS: 1234')
    const parsed = await parsearNFe(xml, 'origem')
    const nota = await ler(xml)
    expect(nota.is_os).toBe(true)
    expect(nota.assistencias).toEqual(['1234', '4321', '7654'])
    expect(parsed.message_id).toBe('origem')
    expect(parsed.itens[0]).toMatchObject({ n_item: '1', codigo_produto: '000123', quantidade: '2.0000' })
  })
  it('aceita NFe sem envelope e namespace prefixado', async () => {
    const xml = xmlDeTeste().xml
    const nfe = xml.slice(xml.indexOf('<NFe>'), xml.indexOf('</NFe>') + 6).replace('<NFe>', '<NFe xmlns="http://www.portalfiscal.inf.br/nfe">')
    expect((await ler(nfe)).numero_nf).toBe('371272')
    expect((await ler(xml.replace(/<(\/?)([A-Za-z][\w]*)/g, '<$1n:$2').replace('xmlns=', 'xmlns:n='))).itens).toHaveLength(2)
  })
  it('soma os blocos de transporte sem alterar produtos ou quantidades', async () => {
    expect(await ler(xmlDeTeste().xml.replace('</transp>', '<vol><qVol>2</qVol><pesoL>1</pesoL></vol></transp>'))).toMatchObject({ volumes_total: 7, peso_total: 11.5 })
  })
  it.each([
    ['XML malformado', (s: string) => s.replace('</NFe>', '')],
    ['documento não fiscal', () => '<teste><nNF>123</nNF></teste>'],
    ['sem produtos', (s: string) => s.replace(/<det[\s\S]*?<\/det>/g, '')],
    ['sem código', (s: string) => s.replace('<cProd>000123</cProd>', '<cProd/>')],
    ['sem descrição', (s: string) => s.replace('<xProd>PRODUTO DE TESTE &amp; CIA</xProd>', '<xProd/>')],
    ['sem número de item', (s: string) => s.replace('nItem="1"', '')],
    ['item duplicado', (s: string) => s.replace('nItem="2"', 'nItem="1"')],
    ['quantidade fracionária', (s: string) => s.replace('2.0000', '2.5')],
    ['quantidade negativa', (s: string) => s.replace('2.0000', '-1')],
    ['sem quantidade', (s: string) => s.replace('<qCom>2.0000</qCom>', '')],
    ['data impossível', (s: string) => s.replace('2026-10-23', '2026-02-30')],
    ['sem data', (s: string) => s.replace(/<dhEmi>.*?<\/dhEmi>/, '')],
    ['sem chave', (s: string) => s.replace(/Id="NFe\d+"/, '')],
    ['número divergente', (s: string) => s.replace('<nNF>000371272', '<nNF>371273')],
    ['série divergente', (s: string) => s.replace('<serie>1', '<serie>2')],
    ['emitente divergente', (s: string) => s.replace('<CNPJ>00000000000000', '<CNPJ>11111111111111')],
    ['outro modelo', (s: string) => s.replace('<mod>55', '<mod>65')],
    ['protocolo inválido', (s: string) => s.replace('<cStat>100', '<cStat>101')],
    ['namespace inválido', (s: string) => s.replace('http://www.portalfiscal.inf.br/nfe', 'http://invalido')],
    ['DTD', (s: string) => '<!DOCTYPE NFe []>' + s],
    ['entidade externa', (s: string) => '<!ENTITY teste SYSTEM "file:///teste">' + s],
  ])('rejeita %s antes de persistir', async (_nome, alterar) => { await expect(ler(alterar(xmlDeTeste().xml))).rejects.toThrow() })
  it('rejeita codificação inválida, arquivo vazio e arquivo maior que o limite', async () => {
    for (const bytes of [new Uint8Array([0xff]), new Uint8Array(), new Uint8Array(XML_MAX_BYTES + 1)]) await expect(lerXmlRecebimento(bytes)).rejects.toThrow()
  })
  it('valida o dígito da chave', () => {
    expect(chaveValida(xmlDeTeste().chave)).toBe(true)
    expect(chaveValida(xmlDeTeste().chave.slice(0, 43) + ((Number(xmlDeTeste().chave[43]) + 1) % 10))).toBe(false)
  })
})
