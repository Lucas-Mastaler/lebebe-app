import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buscarMensagensContatoPaginado } from './mensagens-contato'

const fetchDigisacMock = vi.hoisted(() => vi.fn())

vi.mock('./clienteDigisac', () => ({
  fetchDigisac: fetchDigisacMock,
}))

function msg(id: string, timestamp: string) {
  return {
    id,
    contactId: 'contact-1',
    timestamp,
    type: 'chat',
    text: `mensagem ${id}`,
    visible: true,
    isComment: false,
  }
}

describe('buscarMensagensContatoPaginado', () => {
  beforeEach(() => {
    fetchDigisacMock.mockReset()
  })

  it('pagina mensagens por contactId ate a ultima pagina', async () => {
    fetchDigisacMock
      .mockResolvedValueOnce({ data: [msg('2', '2026-07-07T11:00:00Z')], total: 2, currentPage: 1, lastPage: 2 })
      .mockResolvedValueOnce({ data: [msg('1', '2026-07-07T10:00:00Z')], total: 2, currentPage: 2, lastPage: 2 })

    const resultado = await buscarMensagensContatoPaginado('contact-1', {
      inicioISO: '2026-07-07T00:00:00Z',
      fimISO: '2026-07-08T00:00:00Z',
      perPage: 1,
    })

    expect(fetchDigisacMock).toHaveBeenCalledTimes(2)
    expect(fetchDigisacMock.mock.calls[0][0]).toContain('where%5BcontactId%5D=contact-1')
    expect(resultado.mensagens.map((m) => m.id)).toEqual(['1', '2'])
    expect(resultado.totalApi).toBe(2)
  })

  it('filtra mensagens fora da janela temporal', async () => {
    fetchDigisacMock.mockResolvedValueOnce({
      data: [
        msg('antes', '2026-06-01T10:00:00Z'),
        msg('dentro', '2026-07-07T10:00:00Z'),
        msg('depois', '2026-07-08T10:00:00Z'),
      ],
      total: 3,
      currentPage: 1,
      lastPage: 1,
    })

    const resultado = await buscarMensagensContatoPaginado('contact-1', {
      inicioISO: '2026-07-01T00:00:00Z',
      fimISO: '2026-07-07T23:59:59Z',
    })

    expect(resultado.mensagens.map((m) => m.id)).toEqual(['dentro'])
  })

  it('marca truncado quando atinge maxPages antes do lastPage', async () => {
    fetchDigisacMock.mockResolvedValueOnce({
      data: [msg('1', '2026-07-07T10:00:00Z')],
      total: 3,
      currentPage: 1,
      lastPage: 3,
    })

    const resultado = await buscarMensagensContatoPaginado('contact-1', {
      inicioISO: '2026-07-01T00:00:00Z',
      fimISO: '2026-07-08T00:00:00Z',
      perPage: 1,
      maxPages: 1,
    })

    expect(resultado.paginasBuscadas).toBe(1)
    expect(resultado.truncado).toBe(true)
  })

  it('respeita maxMessages', async () => {
    fetchDigisacMock.mockResolvedValueOnce({
      data: [
        msg('1', '2026-07-07T10:00:00Z'),
        msg('2', '2026-07-07T11:00:00Z'),
      ],
      total: 2,
      currentPage: 1,
      lastPage: 1,
    })

    const resultado = await buscarMensagensContatoPaginado('contact-1', {
      inicioISO: '2026-07-01T00:00:00Z',
      fimISO: '2026-07-08T00:00:00Z',
      maxMessages: 1,
    })

    expect(resultado.mensagens).toHaveLength(1)
    expect(resultado.truncado).toBe(true)
  })

  it('deduplica por id entre paginas', async () => {
    fetchDigisacMock
      .mockResolvedValueOnce({ data: [msg('1', '2026-07-07T10:00:00Z')], total: 2, currentPage: 1, lastPage: 2 })
      .mockResolvedValueOnce({ data: [msg('1', '2026-07-07T10:00:00Z')], total: 2, currentPage: 2, lastPage: 2 })

    const resultado = await buscarMensagensContatoPaginado('contact-1', {
      inicioISO: '2026-07-01T00:00:00Z',
      fimISO: '2026-07-08T00:00:00Z',
      perPage: 1,
    })

    expect(resultado.mensagens.map((m) => m.id)).toEqual(['1'])
  })
})
