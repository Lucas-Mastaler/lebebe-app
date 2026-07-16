import { NextResponse } from 'next/server'
import { checkAccessWindowForUser } from '@/lib/auth/access-window'
import { requireModuleAccess } from '@/lib/auth/module-access'
import type { AllowedUser } from '@/lib/auth/api-auth'
import {
  migrarFichaDadosRascunho,
  validarFichaDadosRascunho,
  type FichaDadosRascunho,
} from './ficha-schema'
import type {
  AtendimentoPresencialDTO,
  PerfilAtendimento,
  StatusAtendimentoPresencial,
  UnidadeAtendimento,
} from './rascunhos-shared'

export {
  filtrarConsultorasPorUnidade,
  filtrarUnidadesPorConsultora,
} from './rascunhos-shared'
export type {
  AtendimentoPresencialDTO,
  ConsultoraAtendimento,
  ContextoAtendimento,
  PerfilAtendimento,
  StatusAtendimentoPresencial,
  UnidadeAtendimento,
} from './rascunhos-shared'

export const DRAFT_EXPIRATION_DAYS = 5
export const DRAFT_PAYLOAD_MAX_BYTES = 4096

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export type AtendimentoPresencialRow = {
  id: string
  cliente_id: string | null
  consultora_usuario_id: string
  unidade_id: string
  status: StatusAtendimentoPresencial
  draft_client_id: string
  dados_rascunho: DadosRascunho
  resultado_atendimento?: string | null
  motivo_outro?: string | null
  observacoes?: string | null
  numero_lancamento?: number | null
  concluido_em?: string | null
  iniciado_em: string
  ultima_atividade_em: string
  expira_em: string
  version: number
  criado_por: string
  atualizado_por: string
  created_at: string
  updated_at: string
}

export type DadosRascunho = FichaDadosRascunho

export type ValidacaoRascunho =
  | { ok: true; dados: DadosRascunho }
  | { ok: false; message: string; field: string }

export function isUuid(valor: unknown): valor is string {
  return typeof valor === 'string' && UUID_RE.test(valor)
}

export function calcularExpiracaoRascunho(base = new Date()) {
  const expira = new Date(base)
  expira.setDate(expira.getDate() + DRAFT_EXPIRATION_DAYS)
  return expira
}

export function rascunhoExpirado(expiraEm: string | null | undefined, now = new Date()) {
  if (!expiraEm) return true
  return new Date(expiraEm).getTime() <= now.getTime()
}

export function validarDadosRascunho(valor: unknown): ValidacaoRascunho {
  return validarFichaDadosRascunho(valor)
}

export function serializarAtendimentoPresencial(row: AtendimentoPresencialRow): AtendimentoPresencialDTO {
  return {
    id: row.id,
    clienteId: row.cliente_id,
    consultoraUsuarioId: row.consultora_usuario_id,
    unidadeId: row.unidade_id,
    status: row.status,
    draftClientId: row.draft_client_id,
    dadosRascunho: migrarFichaDadosRascunho(row.dados_rascunho),
    resultadoAtendimento: row.resultado_atendimento ?? null,
    motivoOutro: row.motivo_outro ?? null,
    observacoes: row.observacoes ?? null,
    numeroLancamento: row.numero_lancamento ?? null,
    concluidoEm: row.concluido_em ?? null,
    iniciadoEm: row.iniciado_em,
    ultimaAtividadeEm: row.ultima_atividade_em,
    expiraEm: row.expira_em,
    version: row.version,
    criadoPor: row.criado_por,
    atualizadoPor: row.atualizado_por,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    expirado: rascunhoExpirado(row.expira_em),
  }
}

export async function requireAtendimentoPresencialFichaAccess() {
  const auth = await requireModuleAccess('atendimento_presencial_ficha')

  if (!auth.ok) return auth

  const windowAccess = await checkAccessWindowForUser({
    usuarioId: auth.allowedUser.id,
    role: auth.allowedUser.role as 'user' | 'superadmin',
  })

  if (!windowAccess.ok) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { ok: false, message: 'Fora da janela de acesso' },
        { status: 403 }
      ),
    }
  }

  return {
    ...auth,
    windowAccess,
  }
}

type SupabaseLike = {
  from: (table: string) => unknown
}

type SupabaseSingleQueryBuilder = {
  select: (columns: string) => SupabaseSingleQueryBuilder
  eq: (column: string, value: unknown) => SupabaseSingleQueryBuilder
  single: () => Promise<{ data: unknown; error: unknown }>
}

type SupabaseListQueryBuilder = PromiseLike<{ data: unknown; error: unknown }> & {
  select: (columns: string) => SupabaseListQueryBuilder
  eq: (column: string, value: unknown) => SupabaseListQueryBuilder
  order: (column: string, options?: { ascending?: boolean }) => SupabaseListQueryBuilder
}

export async function carregarPerfilAtendimento(supabase: SupabaseLike, allowedUser: AllowedUser): Promise<PerfilAtendimento | null> {
  if (allowedUser.role === 'superadmin') return 'superadmin'

  const builder = supabase.from('app_usuarios_perfis') as SupabaseSingleQueryBuilder
  const { data, error } = await builder
    .select('perfil_id, app_perfis_acesso!inner(id, chave, nome, ativo)')
    .eq('usuario_id', allowedUser.id)
    .single()

  if (error || !data) return null

  const row = data as { app_perfis_acesso?: { chave?: string; ativo?: boolean } }
  if (row.app_perfis_acesso?.ativo !== true) return null
  return row.app_perfis_acesso.chave ?? null
}

export async function listarUnidadesDoContexto(
  supabase: SupabaseLike,
  allowedUser: AllowedUser,
  perfil: PerfilAtendimento
): Promise<UnidadeAtendimento[]> {
  if (perfil === 'superadmin') {
    const builder = supabase.from('app_unidades') as SupabaseListQueryBuilder
    const { data, error } = await builder
      .select('id, chave, nome, ativo')
      .eq('ativo', true)
      .order('nome', { ascending: true })

    if (error) return []
    return Array.isArray(data) ? data as UnidadeAtendimento[] : []
  }

  const builder = supabase.from('app_usuarios_unidades') as SupabaseListQueryBuilder
  const { data, error } = await builder
    .select('unidade_id, app_unidades!inner(id, chave, nome, ativo)')
    .eq('usuario_id', allowedUser.id)
    .order('created_at', { ascending: true })

  if (error) return []
  const rows = Array.isArray(data) ? data as Array<{ app_unidades: UnidadeAtendimento & { ativo: boolean } }> : []
  return rows
    .map((row) => row.app_unidades)
    .filter((unidade) => unidade.ativo === true)
    .map(({ id, chave, nome }) => ({ id, chave, nome }))
}

export function usuarioPodeAcessarRascunho(params: {
  row: Pick<AtendimentoPresencialRow, 'consultora_usuario_id' | 'unidade_id'>
  authUserId: string
  perfil: PerfilAtendimento
  unidadesPermitidas: UnidadeAtendimento[]
}) {
  if (params.perfil === 'superadmin') return true
  if (params.perfil === 'consultora') return params.row.consultora_usuario_id === params.authUserId
  const unidades = new Set(params.unidadesPermitidas.map((unidade) => unidade.id))
  return unidades.has(params.row.unidade_id)
}

export function unidadePermitida(unidadeId: string, unidadesPermitidas: UnidadeAtendimento[]) {
  return unidadesPermitidas.some((unidade) => unidade.id === unidadeId)
}

export function perfilPodeSelecionarConsultora(perfil: PerfilAtendimento) {
  return perfil === 'supervisora_loja' || perfil === 'gestao' || perfil === 'superadmin'
}
