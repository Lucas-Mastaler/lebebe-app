// Documento inventado para testes. Nunca enviar à pasta operacional de XMLs.
export function xmlDeTeste() {
  const base = '3526100000000000000055001000371272100000001'
  let soma = 0
  for (let i = 42, peso = 2; i >= 0; i--, peso = peso === 9 ? 2 : peso + 1) soma += Number(base[i]) * peso
  const resto = 11 - soma % 11
  const chave = base + (resto >= 10 ? 0 : resto)
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
  <nfeProc xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00"><NFe><infNFe Id="NFe${chave}" versao="4.00">
  <ide><mod>55</mod><serie>1</serie><nNF>000371272</nNF><dhEmi>2026-10-23T09:00:00-03:00</dhEmi><natOp>VENDA TESTE</natOp></ide>
  <emit><CNPJ>00000000000000</CNPJ><xNome>FORNECEDOR FICTICIO</xNome></emit>
  <det nItem="1"><prod><cProd>000123</cProd><xProd>PRODUTO DE TESTE &amp; CIA</xProd><qCom>2.0000</qCom></prod></det>
  <det nItem="2"><prod><cProd>456</cProd><xProd>OUTRO PRODUTO DE TESTE</xProd><qCom>3.0000</qCom></prod></det>
  <transp><vol><qVol>5</qVol><pesoB>10.5</pesoB></vol></transp><infAdic><infCpl>OBSERVACAO DE TESTE</infCpl></infAdic>
  </infNFe></NFe><protNFe><infProt><chNFe>${chave}</chNFe><cStat>100</cStat></infProt></protNFe></nfeProc>`
  return { xml, chave, bytes: new TextEncoder().encode(xml) }
}
