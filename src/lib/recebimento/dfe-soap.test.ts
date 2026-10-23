import { describe, expect, it } from 'vitest'
import { interpretarDfe, montarSoap, ENDPOINTS_DFE } from './dfe-soap'
import { CNPJ_DFE_TESTE, soapDeTeste, xmlDfeDeTeste } from './dfe.fixture'
import { lerXmlRecebimento } from './xml-upload'
import { erroChave, normalizarChave } from './nfe-chave'

const fixture = xmlDfeDeTeste()
const identidade = { chaveEsperada: fixture.chave, cnpjDestinatario: CNPJ_DFE_TESTE, ambiente: '2' as const }
describe('distribuição oficial pontual', () => {
  it('gera somente consChNFe, sem NSU ou manifestação', () => {
    const body = montarSoap({ cnpj: CNPJ_DFE_TESTE, uf: '35', ambiente: '2' }, fixture.chave)
    expect(body).toContain(`<consChNFe><chNFe>${fixture.chave}</chNFe></consChNFe>`)
    expect(body).toContain('versao="1.01"')
    expect(body).not.toMatch(/distNSU|consNSU|evento|210210|210200/)
    expect(ENDPOINTS_DFE['1']).toContain('https://www1.nfe.fazenda.gov.br/')
    expect(ENDPOINTS_DFE['2']).toContain('https://hom.nfe.fazenda.gov.br/')
  })
  it('recupera bytes originais completos, com produtos e destinatário validado', async () => {
    const doc = await interpretarDfe(soapDeTeste(), '2', fixture.chave)
    expect(doc.tipo).toBe('completo')
    if (doc.tipo !== 'completo') throw new Error('expected full')
    expect(Buffer.from(doc.bytes).equals(fixture.bytes)).toBe(true)
    const nota = await lerXmlRecebimento(doc.bytes, identidade)
    expect(nota.numero_nf).toBe('371272')
    expect(nota.itens[0]).toMatchObject({ codigo_produto: '000123', quantidade: 2 })
  })
  it('resumo indica manifestação, sem fabricar produtos', async () => {
    expect(await interpretarDfe(soapDeTeste('138', [{ schema: 'resNFe_v1.01.xsd', xml: `<resNFe><chNFe>${fixture.chave}</chNFe></resNFe>` }]), '2', fixture.chave)).toEqual({ tipo: 'resumo', cStat: '138' })
  })
  it('evento isolado não é documento completo nem comprova manifestação', async () => {
    expect(await interpretarDfe(soapDeTeste('138', [{ schema: 'procEventoNFe_v1.00.xsd', xml: '<evento/>' }]), '2', fixture.chave)).toEqual({ tipo: 'indisponivel', cStat: '138' })
  })
  it.each(['137', '632', '653', '654'])('trata indisponibilidade %s', async code => {
    expect((await interpretarDfe(soapDeTeste(code, []), '2', fixture.chave)).tipo).toBe('indisponivel')
  })
  it.each(['280', '281', '282', '283', '284', '285', '286', '593', '631', '634'])('autenticação %s sem mensagem técnica', async code => {
    await expect(interpretarDfe(soapDeTeste(code, []), '2', fixture.chave)).rejects.toMatchObject({ estado: 'autenticacao', codigo: code })
  })
  it.each(['108', '109'])('temporário %s', async code => {
    await expect(interpretarDfe(soapDeTeste(code), '2', fixture.chave)).rejects.toMatchObject({ estado: 'temporario', retryAfter: 60 })
  })
  it('bloqueio 656 exige hora sem retry automático', async () => {
    await expect(interpretarDfe(soapDeTeste('656'), '2', fixture.chave)).rejects.toMatchObject({ estado: 'limite', retryAfter: 3600, codigo: '656' })
  })
  it('rejeição explícita de manifestação é distinta de resumo', async () => {
    expect(await interpretarDfe(soapDeTeste('633', []), '2', fixture.chave)).toEqual({ tipo: 'manifestacao_necessaria', cStat: '633' })
  })
  it('rejeição desconhecida é segura', async () => {
    await expect(interpretarDfe(soapDeTeste('641'), '2', fixture.chave)).rejects.toMatchObject({ estado: 'rejeitada', codigo: '641' })
  })
  it.each([
    ['SOAP inválido', '<soap>'],
    ['DTD', '<!DOCTYPE a><ret/>'],
    ['Fault', '<Envelope><Body><Fault>SEGREDO</Fault></Body></Envelope>'],
    ['ambiente divergente', soapDeTeste('138', undefined, '1')],
    ['base64 inválido', soapDeTeste().replace(/(<docZip[^>]*>)[^<]+/, '$1@@@')],
    ['gzip inválido', soapDeTeste().replace(/(<docZip[^>]*>)[^<]+/, '$1dGVzdGU=')],
    ['sem documentos', soapDeTeste('138', [])],
    ['gzip excessivo', soapDeTeste('138', [{ schema: 'procNFe_v4.00.xsd', xml: 'a'.repeat(2 * 1024 * 1024 + 1) }])],
    ['dois completos', soapDeTeste('138', Array.from({ length: 2 }, () => ({ schema: 'procNFe_v4.00.xsd', xml: fixture.xml })))],
    ['resumo de outra chave', soapDeTeste('138', [{ schema: 'resNFe_v1.01.xsd', xml: '<resNFe><chNFe>outra</chNFe></resNFe>' }])],
  ])('rejeita %s', async (_, xml) => {
    await expect(interpretarDfe(xml, '2', fixture.chave)).rejects.toMatchObject({ estado: 'documento_invalido' })
  })
  it.each([
    ['chave', { ...identidade, chaveEsperada: '0'.repeat(44) }, fixture.xml],
    ['destinatário', { ...identidade, cnpjDestinatario: '99999999000199' }, fixture.xml],
    ['ambiente', { ...identidade, ambiente: '1' as const }, fixture.xml],
    ['protocolo ausente', identidade, fixture.xml.replace(/<protNFe>[\s\S]*<\/protNFe>/, '')],
    ['protocolo ambiente', identidade, fixture.xml.replace('<infProt><tpAmb>2', '<infProt><tpAmb>1')],
  ])('importador rejeita %s antes do banco', async (_, expected, xml) => {
    await expect(lerXmlRecebimento(Buffer.from(xml), expected)).rejects.toMatchObject({ code: 'xml_invalido' })
  })
  it('normaliza apenas espaços e aceita DV válido', () => {
    expect(normalizarChave(` ${fixture.chave.slice(0, 22)} \n${fixture.chave.slice(22)} `)).toBe(fixture.chave)
    expect(erroChave(fixture.chave)).toBe('')
    expect(erroChave('a' + fixture.chave.slice(1))).not.toBe('')
    expect(erroChave(fixture.chave.slice(0, 43))).not.toBe('')
    expect(erroChave(fixture.chave.slice(0, 43) + ((Number(fixture.chave[43]) + 1) % 10))).not.toBe('')
  })
})
