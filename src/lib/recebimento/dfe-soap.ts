import https from 'node:https'
import { gunzipSync } from 'node:zlib'
import { parseStringPromise } from 'xml2js'
import type { ConfigDfe } from './dfe-config'
import { DfeError } from './dfe-contract'
import { XML_MAX_BYTES } from './xml-upload-contract'

const NS = 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe'
export const ENDPOINTS_DFE = {
  '1': 'https://www1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx',
  '2': 'https://hom.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx',
} as const
export type DocumentoDfe = { tipo: 'completo'; bytes: Uint8Array; cStat: string } | { tipo: 'resumo' | 'manifestacao_necessaria' | 'indisponivel'; cStat: string }

export function montarSoap(config: Pick<ConfigDfe, 'cnpj' | 'uf' | 'ambiente'>, chave: string): string {
  // Valores só chegam aqui após validação estrita; nenhuma URL vem do usuário.
  return `<?xml version="1.0" encoding="utf-8"?><soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope"><soap12:Body><nfeDistDFeInteresse xmlns="${NS}"><nfeDadosMsg><distDFeInt xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.01"><tpAmb>${config.ambiente}</tpAmb><cUFAutor>${config.uf}</cUFAutor><CNPJ>${config.cnpj}</CNPJ><consChNFe><chNFe>${chave}</chNFe></consChNFe></distDFeInt></nfeDadosMsg></nfeDistDFeInteresse></soap12:Body></soap12:Envelope>`
}

export function enviarSoap(config: ConfigDfe, chave: string): Promise<string> {
  const body = montarSoap(config, chave)
  return new Promise((resolve, reject) => {
    const request = https.request(ENDPOINTS_DFE[config.ambiente], {
      method: 'POST', key: config.key, cert: config.cert, minVersion: 'TLSv1.2', rejectUnauthorized: true,
      headers: { 'Content-Type': `application/soap+xml; charset=utf-8; action="${NS}/nfeDistDFeInteresse"`, 'Content-Length': Buffer.byteLength(body) },
    }, response => {
      if (response.statusCode !== 200) {
        response.resume()
        reject(new DfeError(response.statusCode === 401 || response.statusCode === 403 ? 'autenticacao' : 'temporario', response.statusCode === 401 || response.statusCode === 403 ? 'O serviço fiscal recusou a autenticação. Solicite a conferência do certificado e da autorização da empresa.' : 'O serviço fiscal está temporariamente indisponível. Tente mais tarde.', 503, 60))
        return
      }
      const chunks: Buffer[] = []
      let size = 0
      response.on('data', (chunk: Buffer) => {
        size += chunk.length
        if (size > 4 * XML_MAX_BYTES) { response.destroy(); reject(new DfeError('temporario', 'O serviço fiscal retornou uma resposta maior que o permitido. Solicite conferência.')) }
        else chunks.push(chunk)
      })
      response.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
      response.on('error', () => reject(new DfeError('temporario', 'A conexão com o serviço fiscal foi interrompida. Tente mais tarde.', 503, 60)))
    })
    const timeout = setTimeout(() => request.destroy(new Error('timeout')), 25_000)
    request.on('close', () => clearTimeout(timeout))
    request.on('error', (error: NodeJS.ErrnoException) => {
      const certificado = /^(?:ERR_SSL_.*CERTIFICATE.*|ERR_TLS_CERT_ALTNAME_INVALID|CERT_HAS_EXPIRED|CERT_NOT_YET_VALID|DEPTH_ZERO_SELF_SIGNED_CERT|SELF_SIGNED_CERT_IN_CHAIN|UNABLE_TO_VERIFY_LEAF_SIGNATURE|UNABLE_TO_GET_ISSUER_CERT_LOCALLY)$/.test(error.code ?? '')
      reject(new DfeError(certificado ? 'autenticacao' : 'temporario', certificado
        ? 'A conexão fiscal recusou um certificado ou sua cadeia de confiança. Solicite a conferência do A1 e da conexão segura.'
        : 'Não foi possível conectar ao serviço fiscal com o certificado configurado. Solicite conferência ou tente mais tarde.', 503, 60))
    })
    request.end(body)
  })
}

async function parseXml(xml: string) {
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error('DTD')
  return parseStringPromise(xml, { explicitArray: false, ignoreAttrs: false, tagNameProcessors: [(name: string) => name.replace(/^.*:/, '')] })
}

export async function interpretarDfe(soap: string, ambiente: '1' | '2', chave: string): Promise<DocumentoDfe> {
  try {
    if (Buffer.byteLength(soap) > 4 * XML_MAX_BYTES) throw new Error('size')
    const envelope = await parseXml(soap)
    const result = envelope?.Envelope?.Body?.nfeDistDFeInteresseResponse?.nfeDistDFeInteresseResult
    const ret = result?.retDistDFeInt
    if (!ret || Array.isArray(ret) || ret.tpAmb !== ambiente) throw new Error('envelope')
    const codigo = String(ret.cStat)
    if (codigo === '656') throw new DfeError('limite', 'O serviço fiscal bloqueou novas consultas por excesso de uso. Aguarde pelo menos uma hora; não repita as tentativas durante esse período.', 429, 3600, codigo)
    if (['108', '109'].includes(codigo)) throw new DfeError('temporario', 'O serviço fiscal está temporariamente indisponível. Tente mais tarde.', 503, 60, codigo)
    if (['280', '281', '282', '283', '284', '285', '286', '593', '631', '634'].includes(codigo)) throw new DfeError('autenticacao', 'O serviço fiscal recusou o certificado ou a autorização da empresa. Solicite conferência.', 503, 60, codigo)
    if (['137', '632', '653', '654'].includes(codigo)) return { tipo: 'indisponivel', cStat: codigo }
    if (codigo === '633') return { tipo: 'manifestacao_necessaria', cStat: codigo }
    if (codigo !== '138') throw new DfeError('rejeitada', 'O serviço fiscal não autorizou esta consulta. Solicite a conferência da chave e da autorização da empresa.', 422, 60, codigo)
    const docs = ret.loteDistDFeInt?.docZip
    const list = Array.isArray(docs) ? docs : docs ? [docs] : []
    if (!list.length || list.length > 50) throw new Error('documents')
    let completo: Uint8Array | undefined
    let resumo = false
    for (const doc of list) {
      const schema = String(doc.$?.schema ?? '')
      if (!/^(procNFe|resNFe)_v\d+\.\d+\.xsd$/.test(schema)) continue
      const encoded = String(doc._ ?? '').replace(/\s/g, '')
      if (!encoded || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded)) throw new Error('base64')
      const bytes = gunzipSync(Buffer.from(encoded, 'base64'), { maxOutputLength: XML_MAX_BYTES })
      const xml = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
      if (schema.startsWith('procNFe')) {
        if (completo) throw new Error('ambiguous')
        completo = bytes // A identidade completa é validada pelo importador antes de qualquer gravação.
      } else {
        const summary = (await parseXml(xml))?.resNFe
        if (summary?.chNFe !== chave) throw new Error('identity')
        resumo = true
      }
    }
    if (completo) return { tipo: 'completo', bytes: completo, cStat: codigo }
    // Resumo, ausência do completo e rejeição explícita de manifestação são distintos.
    return { tipo: resumo ? 'resumo' : 'indisponivel', cStat: codigo }
  } catch (error) {
    if (error instanceof DfeError) throw error
    throw new DfeError('documento_invalido', 'O serviço fiscal não retornou um XML completo válido para esta consulta. Nenhuma nota foi cadastrada.', 502, 60)
  }
}
