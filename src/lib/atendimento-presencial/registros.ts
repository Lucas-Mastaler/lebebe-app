import type { AtendimentoPresencialDTO } from './rascunhos-shared'
import type {
  DepartamentoInteresse,
  FichaDadosRascunho,
  MotivoResultado,
  ResultadoAtendimento,
  SexoCrianca,
  SituacaoCrianca,
  UnidadeIdadeCrianca,
} from './ficha-schema'

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
  viradaCartaoDia: number | null
  viradaCartaoMes: number | null
  concluidoEm: string | null
}

export type RegistroAtendimentoDetalheDTO = {
  atendimento: AtendimentoRegistroDTO
  cliente: ClienteRegistroAtendimentoDTO | null
  criancas: Array<{ id: string; ordem?: number | null; local_id?: string | null; situacao: string; nome: string | null; nome_nao_informado?: boolean | null; sexo: string | null; idade_unidade: string | null; idade_valor: number | null; data_prevista_nascimento: string | null }>
  departamentos: Array<{ id: string; ordem?: number | null; departamento: string }>
  produtosInteresse: Array<{ id: string; ordem?: number | null; descricao: string }>
  motivos: Array<{ id: string; ordem?: number | null; motivo: MotivoResultado; complemento: string | null }>
  historico: Array<{ id: string; acao: string; created_at: string; perfil?: string | null; role?: string | null; usuario_id?: string | null; snapshot?: Record<string, unknown> | null }>
  podeEditar?: boolean
  motivoBloqueio?: string | null
  limiteEdicaoEm?: string | null
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

function ordenarPorOrdem<T extends { ordem?: number | null }>(itens: T[]) {
  return [...itens].sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0))
}

export function normalizarDetalheParaFichaEdicao(detalhe: Pick<
  RegistroAtendimentoDetalheDTO,
  'atendimento' | 'criancas' | 'departamentos' | 'produtosInteresse' | 'motivos'
>): FichaDadosRascunho {
  const motivosResultado = ordenarPorOrdem(detalhe.motivos).map((item) => item.motivo)
  const motivoOutro = detalhe.motivos.find((item) => item.motivo === 'outro')?.complemento?.trim()

  return {
    criancas: ordenarPorOrdem(detalhe.criancas).map((crianca) => ({
      id: crianca.local_id?.trim() || crianca.id,
      situacao: crianca.situacao as SituacaoCrianca,
      nome: crianca.nome?.trim() || undefined,
      nomeNaoInformado: crianca.nome_nao_informado === true ? true : undefined,
      sexo: crianca.sexo ? crianca.sexo as SexoCrianca : undefined,
      dataPrevistaNascimento: crianca.data_prevista_nascimento ?? undefined,
      idadeUnidade: crianca.idade_unidade ? crianca.idade_unidade as UnidadeIdadeCrianca : undefined,
      idadeValor: crianca.idade_valor ?? undefined,
    })),
    departamentos: ordenarPorOrdem(detalhe.departamentos).map((item) => item.departamento as DepartamentoInteresse),
    produtosInteresse: ordenarPorOrdem(detalhe.produtosInteresse).map((item) => item.descricao),
    resultadoAtendimento: detalhe.atendimento.resultadoAtendimento ?? undefined,
    motivosResultado,
    motivoOutro: motivoOutro || undefined,
    viradaCartaoDia: detalhe.atendimento.viradaCartaoDia ?? undefined,
    viradaCartaoMes: detalhe.atendimento.viradaCartaoMes ?? undefined,
    observacoes: detalhe.atendimento.observacoes ?? undefined,
    etapaAtual: 'revisao',
  }
}

export function montarPayloadEdicaoAtendimento(params: {
  detalhe: RegistroAtendimentoDetalheDTO
  ficha: FichaDadosRascunho
  numeroLancamento: number | null
}) {
  const { etapaAtual, notaTecnica, ...dadosRascunho } = params.ficha
  void etapaAtual
  void notaTecnica

  return {
    version: params.detalhe.atendimento.version,
    clienteId: params.detalhe.atendimento.clienteId,
    dadosRascunho,
    numeroLancamento: params.numeroLancamento,
  }
}
