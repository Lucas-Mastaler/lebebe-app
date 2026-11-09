import { describe, expect, it } from 'vitest'
import { lerFormularioPromocao, validarCamposPromocao } from './formulario'

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0])

function requisicao(campos: Record<string, string>, arquivos: File[] = []) {
  const form = new FormData()
  Object.entries(campos).forEach(([k, v]) => form.set(k, v))
  arquivos.forEach((a) => form.append('arquivos', a))
  return new Request('http://x/api', { method: 'POST', body: form })
}

describe('validação do formulário de promoção', () => {
  it('rejeita título vazio, datas inválidas e fim < início', () => {
    expect(() => validarCamposPromocao('  ', '2026-11-01', '2026-11-02')).toThrow()
    expect(() => validarCamposPromocao('Black', '2026-13-01', '2026-11-02')).toThrow()
    expect(() => validarCamposPromocao('Black', '2026-11-05', '2026-11-04')).toThrow()
    expect(validarCamposPromocao(' Black ', '2026-11-05', '2026-11-05')).toEqual({ titulo: 'Black', inicio: '2026-11-05', fim: '2026-11-05' })
  })

  it('aceita imagem válida e rejeita mime divergente / tipo não suportado', async () => {
    const ok = await lerFormularioPromocao(requisicao({ titulo: 'A', inicio: '2026-11-01', fim: '2026-11-02' }, [new File([PNG], 'a.png', { type: 'image/png' })]))
    expect(ok.arquivos[0].mimeType).toBe('image/png')
    await expect(lerFormularioPromocao(requisicao({ titulo: 'A', inicio: '2026-11-01', fim: '2026-11-02' }, [new File([PNG], 'a.jpg', { type: 'image/jpeg' })]))).rejects.toMatchObject({ status: 422 })
    await expect(lerFormularioPromocao(requisicao({ titulo: 'A', inicio: '2026-11-01', fim: '2026-11-02' }, [new File(['texto'], 'a.txt', { type: 'text/plain' })]))).rejects.toMatchObject({ status: 415 })
  })

  it('limita a quantidade de arquivos', async () => {
    const muitos = Array.from({ length: 11 }, (_, i) => new File([PNG], `${i}.png`, { type: 'image/png' }))
    await expect(lerFormularioPromocao(requisicao({ titulo: 'A', inicio: '2026-11-01', fim: '2026-11-02' }, muitos))).rejects.toMatchObject({ codigo: 'ARQUIVOS_DEMAIS' })
  })
})
