import type { ResolucaoVendasSgi } from './vendas-sgi-diagnostico'
import { gerarVariacoesTelefoneHistorico, resolverTelefoneHistorico } from './historico-cliente'

type ClienteTelefone = Parameters<typeof resolverTelefoneHistorico>[0]
type RpcClient = {
  rpc: (name: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { code?: string } | null }>
}

// O escopo vem exclusivamente da autenticação server-side, nunca de query/body.
export async function resolverVendasSgi(
  supabase: RpcClient,
  params: {
    clienteId: string
    usuarioId: string
    perfil: string
    unidades: Array<{ id: string }>
    cliente: ClienteTelefone
    atendimentoId?: string
  },
): Promise<ResolucaoVendasSgi & { telefoneDisponivel: boolean }> {
  const inicio = Date.now()
  const telefone = resolverTelefoneHistorico(params.cliente)
  const { data, error } = await supabase.rpc('atendimento_presencial_resolver_vendas_sgi', {
    p_cliente_id: params.clienteId,
    p_usuario_id: params.usuarioId,
    p_perfil: params.perfil,
    p_unidades: params.unidades.map(unidade => unidade.id),
    p_variacoes_telefone: gerarVariacoesTelefoneHistorico(telefone.telefoneNormalizado, telefone.telefoneNormalizadoDDI),
    p_atendimento_id: params.atendimentoId ?? null,
  })
  if (error) {
    console.error('[ATENDIMENTO SGI] Falha no resolvedor', { codigo: error.code, duracaoMs: Date.now() - inicio })
    throw new Error('Não foi possível consultar as vendas do SGI.')
  }
  // Falha explícita: não transformar falha de contrato em histórico vazio.
  const resultado = data as ResolucaoVendasSgi | null
  if (!resultado || !Array.isArray(resultado.vendas) || !resultado.diagnosticos || typeof resultado.diagnosticos !== 'object') {
    throw new Error('Resposta inválida na consulta de vendas SGI.')
  }
  console.info('[ATENDIMENTO SGI] Consulta concluída', {
    duracaoMs: Date.now() - inicio,
    atendimentosAnalisados: Object.values(resultado.diagnosticos).reduce((total, quantidade) => total + (quantidade ?? 0), 0),
    vendas: resultado.vendas.length,
    porTelefone: resultado.vendas.filter(venda => venda.origemAssociacao === 'telefone').length,
    porPrancheta: resultado.vendas.filter(venda => venda.origemAssociacao === 'prancheta').length,
    diagnosticos: resultado.diagnosticos,
  })
  return { ...resultado, telefoneDisponivel: telefone.valido }
}
