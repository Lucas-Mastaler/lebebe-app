import { describe, expect, it, vi } from 'vitest'
import { executarBackfillProtocolos } from './backfill-protocolos'

describe('backfill de protocolos Hub/Vendas', () => {
  it('preenche protocolos e preserva o lote quando um ticket falha', async () => {
    const salvarProtocolo = vi.fn().mockResolvedValue(undefined)
    const resultado = await executarBackfillProtocolos({
      listarFilas: async () => [
        { id: 'fila-1', digisac_ticket_id: 'ticket-1' },
        { id: 'fila-2', digisac_ticket_id: 'ticket-2' },
        { id: 'fila-3', digisac_ticket_id: 'ticket-3' },
      ],
      buscarTicket: async (ticketId) => {
        if (ticketId === 'ticket-2') throw new Error('digisac_http_404')
        return { protocol: ticketId === 'ticket-1' ? 123456 : '789012' }
      },
      salvarProtocolo,
      registrar: vi.fn(),
    })

    expect(resultado).toMatchObject({ consultados: 3, preenchidos: 2 })
    expect(resultado.falhas).toEqual([{ filaId: 'fila-2', ticketId: 'ticket-2', motivo: 'digisac_http_404' }])
    expect(salvarProtocolo).toHaveBeenCalledTimes(2)
  })

  it('trata protocolo ausente como falha individual', async () => {
    const resultado = await executarBackfillProtocolos({
      listarFilas: async () => [{ id: 'fila-1', digisac_ticket_id: 'ticket-1' }],
      buscarTicket: async () => ({ protocol: null }),
      salvarProtocolo: vi.fn(),
      registrar: vi.fn(),
    })

    expect(resultado.preenchidos).toBe(0)
    expect(resultado.falhas[0].motivo).toBe('protocolo_ausente_na_resposta')
  })
})
