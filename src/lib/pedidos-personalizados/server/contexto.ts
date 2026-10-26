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
import { podeVerCustoInterno } from '@/lib/auth/custo-interno'
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
  /** Ausente significa omissão de custo. O carregamento real sempre define o valor. */
  podeVerCustoInterno?: boolean
  metricasPerformance?: MetricasPerformanceContexto
}

export type MetricasPerformanceContexto = {
  autenticacaoMs: number
  permissaoMs: number
  janelaMs: number
  clienteSupabaseMs: number
  unidadesMs: number
}

export type ResultadoContextoPedidos =
  | { ok: true; contexto: ContextoPedidosPersonalizados }
  | { ok: false; response: Response }

type AuthSucesso = RequireAuthenticatedUserSuccess & {
  allowedUser: AllowedUser
  moduleKey: ModuleKey
}

type AutenticacaoConfirmada = RequireAuthenticatedUserSuccess & {
  allowedUser: AllowedUser
}

async function exigirUmDosModulos(modulos: readonly ModuleKey[]) {
  const inicioAutenticacao = performance.now()
  const autenticacao = await requireAuthenticatedUser({
    requireAllowedUser: true,
    requireActive: true,
  })
  const autenticacaoMs = performance.now() - inicioAutenticacao
  if (!autenticacao.ok) return { ...autenticacao, autenticacaoMs, permissaoMs: 0 }

  let primeiraResposta: Response | null = null
  const inicioPermissao = performance.now()

  for (const modulo of modulos) {
    const resultado = await requireModuleAccess(modulo, autenticacao as AutenticacaoConfirmada)
    if (resultado.ok) return {
      ok: true as const,
      auth: resultado as AuthSucesso,
      autenticacaoMs,
      permissaoMs: performance.now() - inicioPermissao,
    }

    primeiraResposta ??= resultado.response
    if (resultado.response.status !== 403) {
      return { ok: false as const, response: resultado.response, autenticacaoMs, permissaoMs: performance.now() - inicioPermissao }
    }
  }

  return {
    ok: false as const,
    response: primeiraResposta ?? jsonErro('ACESSO_NEGADO', 'Acesso negado.', 403),
    autenticacaoMs,
    permissaoMs: performance.now() - inicioPermissao,
  }
}

async function resolverPodeVerCustoInterno(
  supabase: ReturnType<typeof createServiceClient>,
  allowedUser: AllowedUser,
) {
  if (allowedUser.role === 'superadmin') return true
  try {
    const { data, error } = await supabase
      .from('app_usuarios_perfis')
      .select('app_perfis_acesso!inner(chave, ativo)')
      .eq('usuario_id', allowedUser.id)
      .maybeSingle()
    if (error || !data) return false
    const bruto = data.app_perfis_acesso as { chave: string; ativo: boolean } | { chave: string; ativo: boolean }[] | null
    const perfil = Array.isArray(bruto) ? bruto[0] : bruto
    if (!perfil || perfil.ativo !== true || typeof perfil.chave !== 'string') return false
    return podeVerCustoInterno({ acessoTotal: false, perfilChave: perfil.chave })
  } catch {
    return false
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
  modulos: readonly ModuleKey[],
  opcoes: { carregarUnidades?: boolean } = {},
): Promise<ResultadoContextoPedidos> {
  const acesso = await exigirUmDosModulos(modulos)
  if (!acesso.ok) return acesso

  const inicioJanela = performance.now()
  const janela = await checkAccessWindowForUser({
    usuarioId: acesso.auth.allowedUser.id,
    role: acesso.auth.allowedUser.role as 'user' | 'superadmin',
  })
  const janelaMs = performance.now() - inicioJanela
  if (!janela.ok) {
    return {
      ok: false,
      response: jsonErro('FORA_DA_JANELA', 'Fora da janela de acesso.', 403),
    }
  }

  try {
    const inicioCliente = performance.now()
    const supabase = createServiceClient()
    const clienteSupabaseMs = performance.now() - inicioCliente
    const inicioUnidades = performance.now()
    const [unidades, verCusto] = await Promise.all([
      opcoes.carregarUnidades === false
        ? Promise.resolve([])
        : listarUnidadesPermitidas(supabase, acesso.auth.allowedUser),
      resolverPodeVerCustoInterno(supabase, acesso.auth.allowedUser),
    ])
    const unidadesMs = performance.now() - inicioUnidades
    return {
      ok: true,
      contexto: {
        supabase,
        allowedUser: acesso.auth.allowedUser,
        moduloAutorizado: acesso.auth.moduleKey,
        unidades,
        podeVerCustoInterno: verCusto,
        metricasPerformance: {
          autenticacaoMs: acesso.autenticacaoMs,
          permissaoMs: acesso.permissaoMs,
          janelaMs,
          clienteSupabaseMs,
          unidadesMs,
        },
      },
    }
  } catch {
    return {
      ok: false,
      response: jsonErro('ERRO_INTERNO', 'Erro ao processar requisição.', 500),
    }
  }
}
