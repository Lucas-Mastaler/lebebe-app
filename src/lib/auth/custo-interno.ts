const PERFIS_SEM_CUSTO_INTERNO = new Set(['consultora', 'supervisora_loja'])

/**
 * Superadmin entra por `acessoTotal`, mesmo sem chave de perfil.
 * Perfil ausente ou desconhecido não libera custo.
 * Um perfil identificado fora da lista restrita continua autorizado.
 */
export function podeVerCustoInterno(
  autorizacao: { acessoTotal: boolean; perfilChave: string | null } | null | undefined,
) {
  if (!autorizacao?.acessoTotal && !autorizacao?.perfilChave) return false
  if (autorizacao.acessoTotal) return true
  return !PERFIS_SEM_CUSTO_INTERNO.has(autorizacao.perfilChave ?? '')
}

/** Enquanto a permissão carrega ou falha, a interface não mostra custo. */
export function deveExibirCustoInterno(estado: {
  loading: boolean
  error: boolean
  acessoTotal: boolean
  perfilChave: string | null
}) {
  if (estado.loading || estado.error) return false
  return podeVerCustoInterno(estado)
}
