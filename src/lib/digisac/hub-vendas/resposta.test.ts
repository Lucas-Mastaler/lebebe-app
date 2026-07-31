import { describe, expect, it, vi } from 'vitest'
import { registrarLogRespostaRecuperacaoHubVendas } from './resposta'

function criarSupabaseFake(rows: unknown[]) {
  class Builder {
    select() {
      return this
    }

    eq() {
      return this
    }

    limit() {
      return this
    }

    then(resolve: (value: unknown) => void) {
      resolve({ data: rows, error: null })
    }
  }

  return {
    from() {
      return new Builder()
    },
  }
}

describe('registrarLogRespostaRecuperacaoHubVendas', () => {
  it('correlaciona por ticket sem criar lead ou fila', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined)
    const supabase = criarSupabaseFake([
      {
        id: '11111111-1111-4111-8111-111111111111',
        lead_id: '22222222-2222-4222-8222-222222222222',
        conexao_destino_id: 'c60d720f-5ad5-4a1b-bedb-e51495dee686',
        digisac_ticket_id: 'ticket-1',
        status: 'enviado',
      },
    ])

    await expect(registrarLogRespostaRecuperacaoHubVendas({
      supabase: supabase as never,
      ticketId: 'ticket-1',
      serviceId: 'c60d720f-5ad5-4a1b-bedb-e51495dee686',
    })).resolves.toMatchObject({ encontrada: true })

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('resposta recebida em ticket de recuperacao'))
    logSpy.mockRestore()
  })
})
