import { describe, expect, it, vi } from 'vitest'
import { recuperarFilasAbandonadasHubVendas } from './manutencao'

vi.mock('./alertas', () => ({
  alertarEnvioTravado: vi.fn().mockResolvedValue(undefined),
  alertarReservaLiberada: vi.fn().mockResolvedValue(undefined),
}))

function criarSupabaseFake(rows: unknown[]) {
  const state = {
    rpcParams: null as Record<string, unknown> | null,
  }

  class Builder {
    private inValues: string[] = []

    select() {
      return this
    }

    in(_column: string, values: string[]) {
      this.inValues = values
      return this
    }

    eq() {
      return this
    }

    gte() {
      return this
    }

    lt() {
      return this
    }

    order() {
      return this
    }

    limit() {
      return this
    }

    then(resolve: (value: unknown) => void) {
      if (this.inValues.length > 0) {
        const config = [
          { chave: 'automacao', valor: { ativa: false, pausada: true, motivo: 'fase' } },
          { chave: 'parametros', valor: { reserva_timeout_minutos: 10, envio_timeout_minutos: 15 } },
        ].filter((row) => this.inValues.includes(row.chave))
        resolve({ data: config, error: null })
        return
      }
      resolve({ data: [], error: null })
    }
  }

  return {
    state,
    from() {
      return new Builder()
    },
    rpc(_fn: string, params: Record<string, unknown>) {
      state.rpcParams = params
      return Promise.resolve({ data: rows, error: null })
    },
  }
}

describe('recuperarFilasAbandonadasHubVendas', () => {
  it('executa dry-run sem mutacao e retorna contadores', async () => {
    const supabase = criarSupabaseFake([
      {
        fila_id: '11111111-1111-4111-8111-111111111111',
        lead_id: '22222222-2222-4222-8222-222222222222',
        status_anterior: 'reservado',
        status_novo: 'agendado',
        acao: 'reserva_liberada',
        motivo: 'reserva_abandonada_antes_post',
        conexao_destino_id: 'c60d720f-5ad5-4a1b-bedb-e51495dee686',
      },
      {
        fila_id: '33333333-3333-4333-8333-333333333333',
        lead_id: '44444444-4444-4444-8444-444444444444',
        status_anterior: 'enviando',
        status_novo: 'resultado_incerto',
        acao: 'movido_resultado_incerto',
        motivo: 'envio_abandonado_apos_post',
        conexao_destino_id: 'c60d720f-5ad5-4a1b-bedb-e51495dee686',
      },
    ])

    const resultado = await recuperarFilasAbandonadasHubVendas({
      supabase: supabase as never,
      modoSimulacao: true,
      limite: 500,
      workerId: 'worker-recuperacao',
    })

    expect(supabase.state.rpcParams).toMatchObject({
      p_worker: 'worker-recuperacao',
      p_reserva_timeout_minutos: 10,
      p_envio_timeout_minutos: 15,
      p_limite: 50,
      p_modo_simulacao: true,
    })
    expect(resultado).toMatchObject({
      ok: true,
      totalAnalisado: 2,
      totalReservasLiberadas: 1,
      totalResultadoIncerto: 1,
    })
  })
})
