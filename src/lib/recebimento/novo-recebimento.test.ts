import { describe, expect, it, vi } from 'vitest'
import { buscarNotasNoPeriodo, conciliarSelecao, type NotaPreview } from './novo-recebimento'

const nota = (id: string): NotaPreview => ({ id, numero_nf: id, data_emissao: '2026-10-23', volumes_total: 2 })
describe('busca única de notas para novo recebimento', () => {
  it('mostra cadastradas antes do e-mail e atualiza sem duplicar fontes', async () => {
    const ler = vi.fn().mockResolvedValueOnce([nota('a')]).mockResolvedValueOnce([nota('a'), nota('b')])
    const mostrar = vi.fn()
    const email = vi.fn(async () => { expect(mostrar).toHaveBeenCalledWith([nota('a')]); return { ok: true } })
    expect(await buscarNotasNoPeriodo({ lerCadastradas: ler, buscarEmail: email, mostrar })).toBe('')
    expect(mostrar.mock.calls).toEqual([[[nota('a')]], [[nota('a'), nota('b')]]])
    expect(email).toHaveBeenCalledTimes(1)
  })
  it('mantém notas cadastradas e as importadas antes de uma falha do e-mail', async () => {
    const mostrar = vi.fn()
    const aviso = await buscarNotasNoPeriodo({ lerCadastradas: vi.fn().mockResolvedValueOnce([nota('a')]).mockResolvedValueOnce([nota('a'), nota('b')]), buscarEmail: vi.fn().mockRejectedValue(new Error()), mostrar })
    expect(aviso).toContain('continuar com as notas já cadastradas')
    expect(mostrar).toHaveBeenLastCalledWith([nota('a'), nota('b')])
  })
  it('retorno não OK também permite usar o cadastro', async () => {
    expect(await buscarNotasNoPeriodo({ lerCadastradas: vi.fn().mockResolvedValue([nota('a')]), buscarEmail: vi.fn().mockResolvedValue({ ok: false }), mostrar: vi.fn() })).toContain('novas notas no e-mail')
  })
  it('anexo com erro não elimina notas que deram certo', async () => {
    const mostrar = vi.fn()
    expect(await buscarNotasNoPeriodo({ lerCadastradas: vi.fn().mockResolvedValue([nota('a')]), buscarEmail: vi.fn().mockResolvedValue({ ok: true, erros: [{}] }), mostrar })).toContain('Alguns anexos')
    expect(mostrar).toHaveBeenLastCalledWith([nota('a')])
  })
  it('falha na atualização mantém a lista inicial', async () => {
    const mostrar = vi.fn()
    expect(await buscarNotasNoPeriodo({ lerCadastradas: vi.fn().mockResolvedValueOnce([nota('a')]).mockRejectedValueOnce(new Error()), buscarEmail: vi.fn().mockResolvedValue({ ok: true }), mostrar })).toContain('Mantivemos as notas')
    expect(mostrar).toHaveBeenCalledTimes(1)
  })
  it('não inicia importação quando o banco não pode ser consultado', async () => {
    const email = vi.fn()
    await expect(buscarNotasNoPeriodo({ lerCadastradas: vi.fn().mockRejectedValue(new Error()), buscarEmail: email, mostrar: vi.fn() })).rejects.toBeDefined()
    expect(email).not.toHaveBeenCalled()
  })
  it('preserva desmarcações e inclui notas novas ao voltar do XML', () => {
    expect([...conciliarSelecao([nota('a'), nota('b')], [nota('a'), nota('b'), nota('c')], new Set(['b']))]).toEqual(['b', 'c'])
    expect([...conciliarSelecao([], [nota('a'), nota('b')], new Set())]).toEqual(['a', 'b'])
    expect([...conciliarSelecao([nota('a'), nota('b')], [nota('b')], new Set(['a']))]).toEqual([])
  })
})
