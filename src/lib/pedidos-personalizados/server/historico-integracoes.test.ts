import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

describe('integrações do histórico por telefone', () => {
  it.each([
    'src/app/api/atendimento-presencial/clientes/[id]/historico/route.ts',
    'src/app/api/sgi/vendas/[numero_lancamento]/route.ts',
  ])('exige gestão e delega o cruzamento exato e escopado em %s', (arquivo) => {
    const fonte = readFileSync(path.resolve(arquivo), 'utf8')
    expect(fonte).toContain("carregarContextoPedidosPersonalizados(['pedidos_personalizados_gestao'])")
    expect(fonte).toContain('buscarPedidosPersonalizadosPorTelefones')
    expect(fonte).toContain('contextoPedidos.contexto.unidades.map((unidade) => unidade.id)')
    expect(fonte).not.toMatch(/\.like\(['"]telefone_normalizado|\.ilike\(['"]telefone_normalizado/)
  })

  it.each([
    'src/components/atendimento-presencial/HistoricoClienteModal.tsx',
    'src/components/inteligencia-comercial/ModalDetalheVenda.tsx',
  ])('expõe somente o resumo operacional e o link protegido em %s', (arquivo) => {
    const fonte = readFileSync(path.resolve(arquivo), 'utf8')
    expect(fonte).toContain('pedidosPersonalizados')
    expect(fonte).toContain('/pedidos-personalizados?pedidoId=')
    expect(fonte).not.toContain('caminhoObjeto')
    expect(fonte).not.toContain('urlAssinada')
  })
})
