import {
  requireAuthenticatedUser,
  type AllowedUser,
  type RequireAuthenticatedUserSuccess,
} from '@/lib/auth/api-auth'
import { checkAccessWindowForUser } from '@/lib/auth/access-window'
import { requireModuleAccess, type ModuleKey } from '@/lib/auth/module-access'
import { createServiceClient } from '@/lib/supabase/service'
import { UNIDADE_PARA_EXIBICAO, UNIDADES_PEDIDO_PERSONALIZADO } from '../constantes'
import type { UnidadePedidoPersonalizado } from '../tipos'
import { jsonErro } from './http'

export type UnidadeEscopoPedido = {
  id: string
  chave: UnidadePedidoPersonalizado
  nome: string
  nomeExibicao: string
}

export type ContextoPedidosPersonalizados = {
  supabase: ReturnType<typeof createServiceClient>
  allowedUser: AllowedUser
  moduloAutorizado: ModuleKey
  unidades: UnidadeEscopoPedido[]
}

export type ResultadoContextoPedidos =
  | { ok: true; contexto: ContextoPedidosPersonalizados }
  | { ok: false; response: Response }

type AuthSucesso = RequireAuthenticatedUserSuccess & {
  allowedUser: AllowedUser
  moduleKey: ModuleKey
}

async function exigirUmDosModulos(modulos: readonly ModuleKey[]) {
  const autenticacao = await requireAuthenticatedUser({
    requireAllowedUser: true,
    requireActive: true,
  })
  if (!autenticacao.ok) return autenticacao

  let primeiraResposta: Response | null = null

  for (const modulo of modulos) {
    const resultado = await requireModuleAccess(modulo)
    if (resultado.ok) return { ok: true as const, auth: resultado as AuthSucesso }

    primeiraResposta ??= resultado.response
    if (resultado.response.status !== 403) {
      return { ok: false as const, response: resultado.response }
    }
  }

  return {
    ok: false as const,
    response: primeiraResposta ?? jsonErro('ACESSO_NEGADO', 'Acesso negado.', 403),
  }
}

function ehUnidadePermitida(chave: string): chave is UnidadePedidoPersonalizado {
  return UNIDADES_PEDIDO_PERSONALIZADO.includes(chave as UnidadePedidoPersonalizado)
}

async function listarUnidadesPermitidas(
  supabase: ReturnType<typeof createServiceClient>,
  allowedUser: AllowedUser
): Promise<UnidadeEscopoPedido[]> {
  if (allowedUser.role === 'superadmin') {
    const { data, error } = await supabase
      .from('app_unidades')
      .select('id, chave, nome, ativo')
      .eq('ativo', true)
      .in('chave', [...UNIDADES_PEDIDO_PERSONALIZADO])
      .order('nome', { ascending: true })

    if (error) throw error
    return (data ?? [])
      .filter((unidade) => ehUnidadePermitida(unidade.chave))
      .map((unidade) => ({
        id: unidade.id,
        chave: unidade.chave as UnidadePedidoPersonalizado,
        nome: unidade.nome,
        nomeExibicao: UNIDADE_PARA_EXIBICAO[unidade.chave as UnidadePedidoPersonalizado],
      }))
  }

  const { data, error } = await supabase
    .from('app_usuarios_unidades')
    .select('unidade_id, app_unidades!inner(id, chave, nome, ativo)')
    .eq('usuario_id', allowedUser.id)
    .order('created_at', { ascending: true })

  if (error) throw error

  type UnidadeRelacionada = { id: string; chave: string; nome: string; ativo: boolean }
  const rows = (data ?? []) as unknown as Array<{ app_unidades: UnidadeRelacionada }>
  return rows
    .map((row) => row.app_unidades)
    .filter((unidade) => unidade.ativo && ehUnidadePermitida(unidade.chave))
    .map((unidade) => ({
      id: unidade.id,
      chave: unidade.chave as UnidadePedidoPersonalizado,
      nome: unidade.nome,
      nomeExibicao: UNIDADE_PARA_EXIBICAO[unidade.chave as UnidadePedidoPersonalizado],
    }))
}

export async function carregarContextoPedidosPersonalizados(
  modulos: readonly ModuleKey[]
): Promise<ResultadoContextoPedidos> {
  const acesso = await exigirUmDosModulos(modulos)
  if (!acesso.ok) return acesso

  const janela = await checkAccessWindowForUser({
    usuarioId: acesso.auth.allowedUser.id,
    role: acesso.auth.allowedUser.role as 'user' | 'superadmin',
  })
  if (!janela.ok) {
    return {
      ok: false,
      response: jsonErro('FORA_DA_JANELA', 'Fora da janela de acesso.', 403),
    }
  }

  try {
    const supabase = createServiceClient()
    const unidades = await listarUnidadesPermitidas(supabase, acesso.auth.allowedUser)
    return {
      ok: true,
      contexto: {
        supabase,
        allowedUser: acesso.auth.allowedUser,
        moduloAutorizado: acesso.auth.moduleKey,
        unidades,
      },
    }
  } catch {
    return {
      ok: false,
      response: jsonErro('ERRO_INTERNO', 'Erro ao processar requisição.', 500),
    }
  }
}
