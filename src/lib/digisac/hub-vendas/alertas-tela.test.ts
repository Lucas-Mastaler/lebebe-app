import { describe, expect, it } from 'vitest'
import { obterResumoAlertasTela } from './alertas'

type AlertaLinha = {
  tipo: string
  status: string
  enviado_em: string
  chave_deduplicacao: string
}

function criarSupabaseAlertas(linhas: AlertaLinha[]) {
  return {
    from(table: string) {
      if (table !== 'hub_vendas_alertas') throw new Error(`tabela inesperada: ${table}`)
      return {
        select(_colunas: string, opcoes?: { count?: 'exact'; head?: boolean }) {
          const filtros: Array<(linha: AlertaLinha) => boolean> = []
          let limite = Number.POSITIVE_INFINITY
          const executar = () => {
            const filtradas = linhas
              .filter((linha) => filtros.every((filtro) => filtro(linha)))
              .sort((a, b) => b.enviado_em.localeCompare(a.enviado_em))
            if (opcoes?.head) return { data: null, count: filtradas.length, error: null }
            return { data: filtradas.slice(0, limite), error: null }
          }
          const cadeia: Record<string, unknown> = {
            eq(coluna: keyof AlertaLinha, valor: string) {
              filtros.push((linha) => linha[coluna] === valor)
              return cadeia
            },
            gte(coluna: keyof AlertaLinha, valor: string) {
              filtros.push((linha) => linha[coluna] >= valor)
              return cadeia
            },
            order() {
              return cadeia
            },
            limit(quantidade: number) {
              limite = quantidade
              return Promise.resolve(executar())
            },
            then(resolver: (valor: unknown) => void) {
              resolver(executar())
            },
          }
          return cadeia
        },
      }
    },
  }
}

describe('resumo de alertas da tela Hub/Vendas', () => {
  it('conta todos os enviados das ultimas 24 horas e limita so a lista', async () => {
    const agora = Date.now()
    const linhas: AlertaLinha[] = [
      {
        tipo: 'falha_recente',
        status: 'falha',
        enviado_em: new Date(agora).toISOString(),
        chave_deduplicacao: 'falha-recente',
      },
      ...Array.from({ length: 12 }, (_, indice) => ({
        tipo: indice === 0 ? 'teste_manual' : 'resumo_diario',
        status: 'enviado',
        enviado_em: new Date(agora - (indice + 1) * 60_000).toISOString(),
        chave_deduplicacao: `enviado-${indice}`,
      })),
      {
        tipo: 'erro_envio',
        status: 'enviado',
        enviado_em: new Date(agora - 48 * 60 * 60 * 1000).toISOString(),
        chave_deduplicacao: 'antigo',
      },
    ]

    const resumo = await obterResumoAlertasTela(criarSupabaseAlertas(linhas) as never)

    expect(resumo.total24h).toBe(12)
    expect(resumo.ultimos).toHaveLength(10)
    expect(resumo.ultimos.some((alerta) => alerta.chaveDeduplicacao === 'antigo')).toBe(false)
    expect(resumo.ultimoTipo).toBe('teste_manual')
    expect(resumo.ultimos[0]?.tipo).toBe('falha_recente')
    expect(resumo.ultimos[0]?.status).toBe('falha')
  })
})
