// Dados inventados; usados somente em testes com banco e Drive simulados.
import { gzipSync } from 'node:zlib'
import { xmlDeTeste } from './xml-upload.fixture'

export const CNPJ_DFE_TESTE = '12345678000195'
export function xmlDfeDeTeste() {
  const fixture = xmlDeTeste()
  const xml = fixture.xml.replace('<ide>', '<ide><tpAmb>2</tpAmb>').replace('</emit>', `</emit><dest><CNPJ>${CNPJ_DFE_TESTE}</CNPJ><xNome>DESTINATARIO FICTICIO</xNome></dest>`).replace('<infProt>', '<infProt><tpAmb>2</tpAmb>')
  return { ...fixture, xml, bytes: Buffer.from(xml) }
}
export function soapDeTeste(cStat = '138', docs: Array<{ schema: string; xml: string }> = [{ schema: 'procNFe_v4.00.xsd', xml: xmlDfeDeTeste().xml }], ambiente = '2') {
  return `<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope"><soap:Body><nfeDistDFeInteresseResponse xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe"><nfeDistDFeInteresseResult><retDistDFeInt xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.01"><tpAmb>${ambiente}</tpAmb><cStat>${cStat}</cStat><xMotivo>MENSAGEM INTERNA NAO EXIBIR</xMotivo><loteDistDFeInt>${docs.map(doc => `<docZip NSU="000000000000001" schema="${doc.schema}">${gzipSync(doc.xml).toString('base64')}</docZip>`).join('')}</loteDistDFeInt></retDistDFeInt></nfeDistDFeInteresseResult></nfeDistDFeInteresseResponse></soap:Body></soap:Envelope>`
}
