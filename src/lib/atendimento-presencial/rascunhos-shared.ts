import type { FichaDadosRascunho } from './ficha-schema'

export type PerfilAtendimento = 'consultora' | 'supervisora_loja' | 'gestao' | 'superadmin' | string

export type UnidadeAtendimento = {
  id: string
  chave: string
  nome: string
}

export type ConsultoraAtendimento = {
  id: string
  email: string
  nome: string
  unidadeIds: string[]
}

export type StatusAtendimentoPresencial = 'rascunho' | 'concluido'

export type AtendimentoPresencialDTO = {
  id: string
  clienteId: string | null
  consultoraUsuarioId: string
  unidadeId: string
  status: StatusAtendimentoPresencial
  draftClientId: string
  dadosRascunho: FichaDadosRascunho
  resultadoAtendimento: string | null
  motivoOutro: string | null
  observacoes: string | null
  numeroLancamento: number | null
  concluidoEm: string | null
  iniciadoEm: string
  ultimaAtividadeEm: string
  expiraEm: string
  version: number
  criadoPor: string
  atualizadoPor: string
  createdAt: string
  updatedAt: string
  expirado: boolean
}

export type ContextoAtendimento = {
  perfil: PerfilAtendimento
  usuarioId: string
  acessoTotal: boolean
  unidadesPermitidas: UnidadeAtendimento[]
}

export function filtrarUnidadesPorConsultora(params: {
  unidades: UnidadeAtendimento[]
  consultoras: ConsultoraAtendimento[]
  consultoraUsuarioId: string
}) {
  if (!params.consultoraUsuarioId) return params.unidades
  const consultora = params.consultoras.find((item) => item.id === params.consultoraUsuarioId)
  if (!consultora) return []
  const unidadeIds = new Set(consultora.unidadeIds)
  return params.unidades.filter((unidade) => unidadeIds.has(unidade.id))
}

export function filtrarConsultorasPorUnidade(params: {
  consultoras: ConsultoraAtendimento[]
  unidadeId: string
}) {
  if (!params.unidadeId) return params.consultoras
  return params.consultoras.filter((consultora) => consultora.unidadeIds.includes(params.unidadeId))
}
