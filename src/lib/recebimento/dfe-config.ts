import forge from 'node-forge'
import { createPublicKey, X509Certificate } from 'node:crypto'
import { DfeError } from './dfe-contract'

export interface ConfigDfe { cnpj: string; uf: string; ambiente: '1' | '2'; key: string; cert: string }
const UFS = new Set('11 12 13 14 15 16 17 21 22 23 24 25 26 27 28 29 31 32 33 35 41 42 43 50 51 52 53'.split(' '))

// ICP-Brasil: CNPJ do titular em subjectAltName/otherName, OID 2.16.76.1.3.3.
function cnpjsDoCertificado(cert: forge.pki.Certificate): string[] {
  const extension = cert.getExtension('subjectAltName') as { value?: string } | null
  if (!extension?.value) return []
  const found: string[] = []
  function visit(node: forge.asn1.Asn1) {
    if (!Array.isArray(node.value)) return
    const oid = node.value.find(child => child.type === forge.asn1.Type.OID && typeof child.value === 'string')
    if (oid && typeof oid.value === 'string' && forge.asn1.derToOid(oid.value) === '2.16.76.1.3.3') {
      const strings = (n: forge.asn1.Asn1): string[] => typeof n.value === 'string' ? [n.value] : n.value.flatMap(strings)
      found.push(...node.value.filter(child => child !== oid).flatMap(strings).filter(value => /^[A-Z0-9]{12}\d{2}$/.test(value)))
    }
    node.value.forEach(visit)
  }
  visit(forge.asn1.fromDer(extension.value))
  return found
}

export function carregarConfigDfe(env: NodeJS.ProcessEnv = process.env, now = new Date()): ConfigDfe {
  const { NFE_DFE_A1_PFX_BASE64: base64, NFE_DFE_A1_PASSWORD: password, NFE_DFE_CNPJ: cnpj, NFE_DFE_UF_AUTOR: uf, NFE_DFE_AMBIENTE: ambiente } = env
  if (!base64 || password === undefined || !cnpj || !uf || !ambiente) throw new DfeError('configuracao', 'A consulta fiscal ainda não foi configurada. Solicite a configuração do certificado A1 e do CNPJ autorizado.')
  if (!/^[A-Z0-9]{12}\d{2}$/.test(cnpj) || !UFS.has(uf) || !['1', '2'].includes(ambiente)) throw new DfeError('configuracao', 'Confira o CNPJ, o código da UF e o ambiente da configuração fiscal.')
  if (base64.length > 100_000 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(base64)) throw new DfeError('configuracao', 'O certificado A1 configurado não está no formato esperado.')
  try {
    const pfx = forge.pkcs12.pkcs12FromAsn1(forge.asn1.fromDer(Buffer.from(base64, 'base64').toString('binary')), false, password)
    const bags = pfx.safeContents.flatMap(content => content.safeBags)
    const keys = bags.flatMap(bag => bag.key ? [bag.key] : [])
    const certs = bags.flatMap(bag => bag.cert ? [bag.cert] : [])
    if (keys.length !== 1) throw new Error('private_key')
    const key = forge.pki.privateKeyToPem(keys[0])
    const publicKey = createPublicKey(key).export({ type: 'spki', format: 'der' })
    const leaf = certs.find(cert => new X509Certificate(forge.pki.certificateToPem(cert)).publicKey.export({ type: 'spki', format: 'der' }).equals(publicKey))
    if (!leaf) throw new Error('certificate')
    if (now < leaf.validity.notBefore || now >= leaf.validity.notAfter) throw new DfeError('autenticacao', 'O certificado A1 está vencido ou ainda não é válido. Solicite a renovação ou conferência.', 503)
    if (!cnpjsDoCertificado(leaf).some(value => value.slice(0, 8) === cnpj.slice(0, 8))) throw new DfeError('autenticacao', 'O certificado A1 não corresponde à empresa configurada para a consulta.', 503)
    return { cnpj, uf, ambiente: ambiente as '1' | '2', key, cert: [leaf, ...certs.filter(cert => cert !== leaf)].map(cert => forge.pki.certificateToPem(cert)).join('\n') }
  } catch (error) {
    if (error instanceof DfeError) throw error
    throw new DfeError('autenticacao', 'Não foi possível abrir o certificado A1. Solicite a conferência do arquivo e da senha.', 503)
  }
}
