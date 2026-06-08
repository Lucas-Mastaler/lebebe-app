import { NextResponse } from 'next/server'
import { validateComercialUser } from '@/lib/auth/sgi-auth'
import { classificarVendasPorLancamentos } from '@/lib/sgi/classificar-vendas'

export const runtime = 'nodejs'

/**
 * POST /api/sgi/classificar-vendas
 *
 * Endpoint para classificação manual/admin de TODAS as vendas.
 * Mantido para compatibilidade com uso atual.
 *
 * Agora usa o helper reutilizável classificarVendasPorLancamentos.
 */

export async function POST() {
  const auth = await validateComercialUser()
  if (!auth.authorized) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  console.log('[classificar-vendas] Iniciando classificação completa (todos os produtos)')

  // Chama helper sem filtro de lançamentos → classifica todos
  const resultado = await classificarVendasPorLancamentos({
    numeroLancamentos: undefined,
    somentePendentes: false, // Classifica todos, mesmo já classificados
  })

  if (!resultado.ok) {
    return NextResponse.json(
      { error: 'Erro na classificação', detail: resultado.erros.join('; ') },
      { status: 500 }
    )
  }

  // Mapeia resultado para formato compatível com resposta anterior
  return NextResponse.json({
    ok: true,
    total_produtos: resultado.produtosEncontrados,
    // total_referencia_oficial não está mais no resultado, mantemos compatibilidade
    total_referencia_oficial: resultado.classificadosReferencia + resultado.classificadosKeyword + resultado.naoClassificados,
    classificados_por_referencia: resultado.classificadosReferencia,
    classificados_por_regra: resultado.classificadosKeyword,
    nao_classificados: resultado.naoClassificados,
    vendas_atualizadas: resultado.agregadosAtualizados,
    // exemplos não estão mais disponíveis no novo formato, mantemos arrays vazios para compatibilidade
    exemplos_referencia: [],
    exemplos_regra: [],
    exemplos_nao_classificados: resultado.exemplosNaoClassificados ?? [],
  })
}
