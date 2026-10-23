import forge from 'node-forge'
import { beforeAll, describe, expect, it } from 'vitest'
import { carregarConfigDfe } from './dfe-config'
import { CNPJ_DFE_TESTE } from './dfe.fixture'

let env: NodeJS.ProcessEnv
function certificado(cnpj: string | null = CNPJ_DFE_TESTE, inicio = '2026-01-01', fim = '2027-01-01') {
  const keys = forge.pki.rsa.generateKeyPair(1024) // Teste offline, nunca usado em TLS real.
  const cert = forge.pki.createCertificate()
  cert.publicKey = keys.publicKey
  cert.serialNumber = '01'
  cert.validity.notBefore = new Date(inicio)
  cert.validity.notAfter = new Date(fim)
  cert.setSubject([{ name: 'commonName', value: 'CERTIFICADO FICTICIO PARA TESTE' }])
  cert.setIssuer(cert.subject.attributes)
  if (cnpj) {
    const a = forge.asn1
    const value = a.toDer(a.create(a.Class.UNIVERSAL, a.Type.SEQUENCE, true, [a.create(a.Class.CONTEXT_SPECIFIC, 0, true, [a.create(a.Class.UNIVERSAL, a.Type.OID, false, a.oidToDer('2.16.76.1.3.3').getBytes()), a.create(a.Class.CONTEXT_SPECIFIC, 0, true, [a.create(a.Class.UNIVERSAL, a.Type.UTF8, false, cnpj)])])])).getBytes()
    cert.setExtensions([{ id: '2.5.29.17', value }])
  }
  cert.sign(keys.privateKey, forge.md.sha256.create())
  return Buffer.from(forge.asn1.toDer(forge.pkcs12.toPkcs12Asn1(keys.privateKey, cert, 'senha-ficticia', { algorithm: '3des' })).getBytes(), 'binary').toString('base64')
}
const now = new Date('2026-10-23')
describe('A1 somente no servidor', () => {
  beforeAll(() => { env = { NODE_ENV: 'test', NFE_DFE_A1_PFX_BASE64: certificado(), NFE_DFE_A1_PASSWORD: 'senha-ficticia', NFE_DFE_CNPJ: CNPJ_DFE_TESTE, NFE_DFE_UF_AUTOR: '35', NFE_DFE_AMBIENTE: '2' } })
  it('abre PFX, confere CNPJ ICP-Brasil e extrai par de chaves', () => {
    expect(carregarConfigDfe(env, now)).toMatchObject({ cnpj: CNPJ_DFE_TESTE, uf: '35', ambiente: '2', key: expect.stringContaining('PRIVATE KEY'), cert: expect.stringContaining('CERTIFICATE') })
  })
  it('aceita filial com mesma raiz do certificado', () => {
    expect(carregarConfigDfe({ ...env, NFE_DFE_CNPJ: '12345678000276' }, now).cnpj).toBe('12345678000276')
  })
  it.each(['NFE_DFE_A1_PFX_BASE64', 'NFE_DFE_A1_PASSWORD', 'NFE_DFE_CNPJ', 'NFE_DFE_UF_AUTOR', 'NFE_DFE_AMBIENTE'])('bloqueia ausência de %s', field => {
    expect(() => carregarConfigDfe({ ...env, [field]: undefined }, now)).toThrow(/configura/)
  })
  it('nunca usa produção por padrão', () => { expect(() => carregarConfigDfe({ ...env, NFE_DFE_AMBIENTE: '3' }, now)).toThrow(/ambiente/) })
  it('rejeita CNPJ/UF malformados antes do PFX', () => {
    expect(() => carregarConfigDfe({ ...env, NFE_DFE_CNPJ: '<empresa>' }, now)).toThrow(/CNPJ/)
    expect(() => carregarConfigDfe({ ...env, NFE_DFE_UF_AUTOR: '99' }, now)).toThrow(/UF/)
  })
  it('senha inválida não vaza senha nem stack fiscal', () => {
    expect(() => carregarConfigDfe({ ...env, NFE_DFE_A1_PASSWORD: 'SEGREDO' }, now)).toThrow('Não foi possível abrir o certificado A1. Solicite a conferência do arquivo e da senha.')
  })
  it('certificado expirado e ainda não válido', () => {
    expect(() => carregarConfigDfe(env, new Date('2028-01-01'))).toThrow(/vencido/)
    expect(() => carregarConfigDfe(env, new Date('2025-01-01'))).toThrow(/ainda não/)
  })
  it('empresa diferente bloqueia sem consulta', () => { expect(() => carregarConfigDfe({ ...env, NFE_DFE_CNPJ: '99999999000199' }, now)).toThrow(/não corresponde/) })
  it('não aceita CN em lugar do identificador ICP-Brasil', () => { expect(() => carregarConfigDfe({ ...env, NFE_DFE_A1_PFX_BASE64: certificado(null) }, now)).toThrow(/não corresponde/) })
  it.each(['@@@', 'dGVzdGU=', 'A'.repeat(100004)])('PFX inválido falha sem revelar conteúdo', pfx => { expect(() => carregarConfigDfe({ ...env, NFE_DFE_A1_PFX_BASE64: pfx }, now)).toThrow(/certificado A1/) })
})
