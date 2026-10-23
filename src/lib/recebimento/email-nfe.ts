import type { NFeData } from './nfe-parser'
import { chaveValida } from './nfe-chave'
import { XmlImportError, type NotaXml } from './xml-upload'

export function notaDoEmail(nf: NFeData): NotaXml {
  const numero = nf.numero_nf.replace(/\D/g, '').replace(/^0+/, '')
  const chave = nf.chave_acesso ?? ''
  if (!chaveValida(chave) || chave.slice(20, 22) !== '55' || chave.slice(25, 34).replace(/^0+/, '') !== numero) {
    throw new XmlImportError('chave_email', 'O XML não possui uma chave de acesso válida para esta nota. Peça ao fornecedor para conferir o arquivo.')
  }
  // Mesmas conversões do importador de e-mail anterior, inclusive o
  // arredondamento de quantidade. Não altera o parser nem as regras do upload.
  return {
    numero_nf: numero, chave_acesso: chave, data_emissao: String(nf.data_emissao).substring(0, 10),
    peso_total: parseFloat(nf.peso_total) || 0, volumes_total: parseInt(nf.volumes_total) || 0,
    obs: nf.obs || '', is_os: nf.is_os, assistencias: nf.assistencias,
    itens: nf.itens.map(item => ({ n_item: parseInt(item.n_item) || 0, codigo_produto: item.codigo_produto,
      descricao: item.descricao, quantidade: Math.round(parseFloat(item.quantidade) || 0) })),
  }
}
