import { parseStringPromise } from 'xml2js'
import { parsearNFe } from './nfe-parser'
import { XML_MAX_BYTES } from './xml-upload-contract'
export { XML_MAX_BYTES, XML_MAX_FILES } from './xml-upload-contract'

export class XmlImportError extends Error {
  constructor(public readonly code: string, message: string) { super(message) }
}

export interface NotaXml {
  numero_nf: string
  chave_acesso: string
  data_emissao: string
  peso_total: number
  volumes_total: number
  obs: string
  is_os: boolean
  itens: Array<{ n_item: number; codigo_produto: string; descricao: string; quantidade: number }>
  assistencias: string[]
}

function exigir(ok: unknown, message: string): asserts ok {
  if (!ok) throw new XmlImportError('xml_invalido', message)
}

export function chaveValida(chave: string): boolean {
  if (!/^\d{44}$/.test(chave)) return false
  let soma = 0
  for (let i = 42, peso = 2; i >= 0; i--, peso = peso === 9 ? 2 : peso + 1) soma += Number(chave[i]) * peso
  const resto = 11 - soma % 11
  return Number(chave[43]) === (resto >= 10 ? 0 : resto)
}

export async function lerXmlRecebimento(bytes: Uint8Array): Promise<NotaXml> {
  exigir(bytes.length > 0 && bytes.length <= XML_MAX_BYTES, 'Selecione um XML de até 2 MB.')
  let xml: string
  try { xml = new TextDecoder('utf-8', { fatal: true }).decode(bytes) }
  catch { throw new XmlImportError('xml_invalido', 'O XML deve usar a codificação UTF-8.') }
  exigir(!/<!DOCTYPE|<!ENTITY/i.test(xml), 'XML com DTD ou entidades não é permitido.')
  let documento
  try {
    documento = await parseStringPromise(xml, { explicitArray: false, ignoreAttrs: false, tagNameProcessors: [(name: string) => name.replace(/^.*:/, '')] })
  } catch { throw new XmlImportError('xml_invalido', 'Arquivo XML inválido. Confira o documento enviado.') }
  const raiz = documento?.nfeProc ?? documento?.NFe
  const nfe = documento?.nfeProc?.NFe ?? documento?.NFe
  const inf = nfe?.infNFe
  exigir(inf && !Array.isArray(inf) && !Array.isArray(nfe), 'Envie uma NF-e completa, com os produtos. Resumos e eventos não são aceitos.')
  const namespaces = [raiz?.$, nfe?.$, inf?.$].flatMap(attrs => Object.entries(attrs ?? {}).filter(([k]) => k === 'xmlns' || k.startsWith('xmlns:')).map(([, v]) => v))
  exigir(namespaces.includes('http://www.portalfiscal.inf.br/nfe'), 'O arquivo não possui o formato de NF-e esperado.')
  const chave = String(inf.$?.Id ?? '').replace(/^NFe/, '')
  exigir(chaveValida(chave), 'Chave de acesso inválida ou ausente no XML.')
  const ide = inf.ide
  exigir(ide && !Array.isArray(ide) && String(ide.mod) === '55', 'O documento deve ser uma NF-e modelo 55.')
  const numeroRaw = String(ide.nNF ?? '')
  exigir(/^\d{1,9}$/.test(numeroRaw) && Number(numeroRaw) > 0, 'Número da NF-e inválido ou ausente.')
  const numero = numeroRaw.replace(/^0+/, '')
  exigir(/^\d{1,3}$/.test(String(ide.serie)) && String(ide.serie).padStart(3, '0') === chave.slice(22, 25)
    && numero.padStart(9, '0') === chave.slice(25, 34) && chave.slice(20, 22) === '55'
    && String(inf.emit?.CNPJ) === chave.slice(6, 20), 'A chave de acesso diverge dos dados da NF-e.')
  const protocolo = documento?.nfeProc?.protNFe?.infProt
  exigir(!protocolo || (String(protocolo.chNFe) === chave && ['100', '150'].includes(String(protocolo.cStat))), 'O protocolo da NF-e está inválido ou não indica autorização.')
  const parsed = await parsearNFe(xml, '')
  const data = parsed.data_emissao.slice(0, 10)
  exigir(/^\d{4}-\d{2}-\d{2}$/.test(data) && !Number.isNaN(Date.parse(data)) && new Date(data).toISOString().slice(0, 10) === data, 'Data de emissão inválida ou ausente.')
  exigir(chave.slice(2, 6) === data.slice(2, 4) + data.slice(5, 7), 'A data de emissão diverge da chave de acesso.')
  exigir(parsed.itens.length > 0, 'A NF-e precisa conter produtos para o recebimento.')
  const numeros = new Set<number>()
  const itens = parsed.itens.map(item => {
    const n_item = Number(item.n_item)
    const quantidade = Number(item.quantidade)
    exigir(Number.isSafeInteger(n_item) && n_item > 0 && n_item <= 990 && !numeros.has(n_item), 'Numeração dos itens inválida ou repetida.')
    numeros.add(n_item)
    exigir(item.codigo_produto.trim() && item.descricao.trim(), `O item ${n_item} precisa ter código e descrição.`)
    exigir(Number.isSafeInteger(quantidade) && quantidade > 0 && quantidade <= 2147483647, `A quantidade do item ${n_item} deve ser um número inteiro positivo.`)
    return { n_item, codigo_produto: item.codigo_produto, descricao: item.descricao, quantidade }
  })
  const volumes = Array.isArray(inf.transp?.vol) ? inf.transp.vol : [inf.transp?.vol ?? {}]
  let peso_total = 0, volumes_total = 0
  for (const vol of volumes) {
    const peso = Number(vol.pesoB ?? vol.pesoL ?? 0), qtd = Number(vol.qVol ?? 0)
    exigir(Number.isFinite(peso) && peso >= 0 && Number.isSafeInteger(qtd) && qtd >= 0, 'Peso ou quantidade de volumes inválidos.')
    peso_total += peso; volumes_total += qtd
  }
  exigir(Number.isSafeInteger(volumes_total) && volumes_total <= 2147483647 && Number.isFinite(peso_total), 'Totais de transporte inválidos.')
  return { numero_nf: numero, chave_acesso: chave, data_emissao: data, peso_total, volumes_total, obs: parsed.obs, is_os: parsed.is_os, itens, assistencias: parsed.assistencias }
}
