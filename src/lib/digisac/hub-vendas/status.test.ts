import { describe, expect, it } from 'vitest'
import { obterStatusHubVendas } from './status'

function criarSupabaseFake() {
  class Builder {
    private table: string
    private inValues: string[] = []

    constructor(table: string) {
      this.table = table
    }

    select() {
      return this
    }

    in(_column: string, values: string[]) {
      this.inValues = values
      return this
    }

    order() {
      return this
    }

    limit() {
      return this
    }

    then(resolve: (value: unknown) => void) {
      if (this.table === 'hub_vendas_config') {
        const config = [
          { chave: 'automacao', valor: { ativa: false, pausada: true, motivo: 'fase' } },
          {
            chave: 'parametros',
            valor: {
              limite_diario_por_conexao: 2,
              limite_por_execucao: 1,
              modo_ativacao_gradual: true,
              reserva_timeout_minutos: 10,
              envio_timeout_minutos: 15,
              timezone: 'America/Sao_Paulo',
            },
          },
          {
            chave: 'pausas_conexoes',
            valor: {
              conexao_a: { pausada: true, erros_consecutivos: 3 },
              conexao_b: { pausada: false, erros_consecutivos: 0 },
            },
          },
        ].filter((row) => this.inValues.includes(row.chave))
        resolve({ data: config, error: null })
        return
      }
      resolve({ data: [{ updated_at: '2026-07-31T12:00:00.000Z' }], error: null })
    }
  }

  return {
    from(table: string) {
      return new Builder(table)
    },
    rpc() {
      return Promise.resolve({
        data: [
          { status: 'agendado', total: 2 },
          { status: 'resultado_incerto', total: 1 },
          { status: 'enviado_hoje', total: 3 },
        ],
        error: null,
      })
    },
  }
}

describe('obterStatusHubVendas', () => {
  it('retorna contadores e parametros sem PII', async () => {
    const status = await obterStatusHubVendas(criarSupabaseFake() as never)

    expect(status).toMatchObject({
      ok: true,
      automacao: { ativa: false, pausada: true },
      filas: { agendada: 2, enviadaHoje: 3, resultadoIncerto: 1 },
      conexoes: { pausadas: 1, errosConsecutivos: { conexao_a: 3, conexao_b: 0 } },
      parametros: { limiteDiarioPorConexao: 2, limitePorExecucao: 1, modoAtivacaoGradual: true },
      ultimoProcessamento: '2026-07-31T12:00:00.000Z',
    })
  })
})
