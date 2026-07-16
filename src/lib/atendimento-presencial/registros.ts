import type { AtendimentoPresencialDTO } from './rascunhos-shared'
import type { MotivoResultado, ResultadoAtendimento } from './ficha-schema'

export type AtendimentoRegistroDTO = Omit<AtendimentoPresencialDTO, 'resultadoAtendimento'> & {
  resultadoAtendimento: ResultadoAtendimento | null
}

export type ClienteRegistroAtendimentoDTO = {
  id: string
  nome: string
  telefone: string | null
  parentesco: string | null
  parentescoOutro: string | null
}

export type RegistroAtendimentoResumoDTO = {
  id: string
  clienteId: string | null
  clienteNome: string
  clienteTelefone: string | null
  consultoraUsuarioId: string
  consultoraEmail: string
  unidadeId: string
  unidadeNome: string
  resultadoAtendimento: 'sim' | 'nao' | 'negociacao' | null
  numeroLancamento: number | null
  concluidoEm: string | null
}

export type RegistroAtendimentoDetalheDTO = {
  atendimento: AtendimentoRegistroDTO
  cliente: ClienteRegistroAtendimentoDTO | null
  criancas: Array<{ id: string; situacao: string; nome: string | null; sexo: string | null; idade_unidade: string | null; idade_valor: number | null; data_prevista_nascimento: string | null }>
  departamentos: Array<{ id: string; departamento: string }>
  produtosInteresse: Array<{ id: string; descricao: string }>
  motivos: Array<{ id: string; motivo: MotivoResultado; complemento: string | null }>
  historico: Array<{ id: string; acao: string; created_at: string }>
}

export type ClienteRegistroRow = {
  id: string
  nome: string
  telefone?: string | null
  telefone_informado?: string | null
  parentesco?: string | null
  parentesco_outro?: string | null
}

export function serializarClienteRegistro(row: ClienteRegistroRow | null | undefined): ClienteRegistroAtendimentoDTO | null {
  if (!row) return null
  return {
    id: row.id,
    nome: row.nome,
    telefone: row.telefone ?? row.telefone_informado ?? null,
    parentesco: row.parentesco ?? null,
    parentescoOutro: row.parentesco_outro ?? null,
  }
}

export function normalizarObservacoesRegistro(atendimento: Pick<AtendimentoPresencialDTO, 'observacoes'>) {
  return atendimento.observacoes?.trim() ? atendimento.observacoes : null
}
