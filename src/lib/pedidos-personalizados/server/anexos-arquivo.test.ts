import { describe, expect, it } from 'vitest'
import {
  ErroArquivoAnexo,
  LIMITE_ANEXO_BYTES,
  detectarTipoArquivo,
  gerarCaminhoAnexo,
  validarArquivoAnexo,
} from './anexos-arquivo'

const assinaturas = {
  jpeg: { bytes: [0xff, 0xd8, 0xff, 0x00], mime: 'image/jpeg', ext: 'jpg' },
  png: { bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], mime: 'image/png', ext: 'png' },
  webp: { bytes: [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50], mime: 'image/webp', ext: 'webp' },
  pdf: { bytes: [0x25, 0x50, 0x44, 0x46, 0x2d, 0x31], mime: 'application/pdf', ext: 'pdf' },
} as const

describe('validação real de anexos', () => {
  for (const [nome, caso] of Object.entries(assinaturas)) {
    it(`aceita ${nome} pela assinatura`, async () => {
      const arquivo = new File([new Uint8Array(caso.bytes)], `arquivo.${caso.ext}`, { type: caso.mime })
      const resultado = await validarArquivoAnexo(arquivo)
      expect(resultado).toMatchObject({ mimeType: caso.mime, extensao: caso.ext, nomeOriginal: `arquivo.${caso.ext}` })
    })
  }

  it('deriva o tipo da assinatura, não da extensão', async () => {
    const arquivo = new File([new Uint8Array(assinaturas.jpeg.bytes)], 'falso.pdf', { type: 'image/jpeg' })
    expect((await validarArquivoAnexo(arquivo)).extensao).toBe('jpg')
  })

  it('rejeita MIME informado divergente', async () => {
    const arquivo = new File([new Uint8Array(assinaturas.jpeg.bytes)], 'foto.jpg', { type: 'application/pdf' })
    await expect(validarArquivoAnexo(arquivo)).rejects.toMatchObject({ codigo: 'MIME_DIVERGENTE', status: 422 })
  })

  it('rejeita assinatura inválida e ambígua', () => {
    expect(detectarTipoArquivo(new Uint8Array([0x25, 0x50, 0x4e, 0x47]))).toBeNull()
  })

  it('rejeita arquivo vazio', async () => {
    await expect(validarArquivoAnexo(new File([], 'vazio.pdf', { type: 'application/pdf' })))
      .rejects.toMatchObject({ codigo: 'ARQUIVO_VAZIO' })
  })

  it('aceita exatamente 10 MiB', async () => {
    const bytes = new Uint8Array(LIMITE_ANEXO_BYTES)
    bytes.set(assinaturas.jpeg.bytes)
    await expect(validarArquivoAnexo(new File([bytes], 'limite.jpg', { type: 'image/jpeg' }))).resolves.toMatchObject({ tamanhoBytes: LIMITE_ANEXO_BYTES })
  })

  it('rejeita 10 MiB mais um byte', async () => {
    const bytes = new Uint8Array(LIMITE_ANEXO_BYTES + 1)
    bytes.set(assinaturas.jpeg.bytes)
    await expect(validarArquivoAnexo(new File([bytes], 'grande.jpg', { type: 'image/jpeg' }))).rejects.toBeInstanceOf(ErroArquivoAnexo)
  })

  it.each(['a'.repeat(256), '../foto.jpg', 'pasta/foto.jpg', 'pasta\\foto.jpg'])('rejeita nome inseguro: %s', async (nome) => {
    await expect(validarArquivoAnexo(new File([new Uint8Array(assinaturas.jpeg.bytes)], nome, { type: 'image/jpeg' }))).rejects.toMatchObject({ codigo: 'NOME_ARQUIVO_INVALIDO' })
  })

  it('preserva nome Unicode normalizado', async () => {
    const resultado = await validarArquivoAnexo(new File([new Uint8Array(assinaturas.pdf.bytes)], 'Catálogo.pdf', { type: 'application/pdf' }))
    expect(resultado.nomeOriginal).toBe('Catálogo.pdf')
  })
})

describe('caminho privado', () => {
  it('usa quatro UUIDs e extensão derivada sem PII ou nome original', () => {
    const caminho = gerarCaminhoAnexo({
      pedidoId: '11111111-1111-4111-8111-111111111111',
      tapeteId: '22222222-2222-4222-8222-222222222222',
      anexoId: '33333333-3333-4333-8333-333333333333',
      arquivoId: '44444444-4444-4444-8444-444444444444',
      extensao: 'pdf',
    })
    expect(caminho).toBe('11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222/33333333-3333-4333-8333-333333333333/44444444-4444-4444-8444-444444444444.pdf')
    expect(caminho).not.toMatch(/cliente|consultora|\.\.|Catálogo/i)
  })
})
