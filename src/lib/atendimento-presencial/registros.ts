import { MOTIVOS_VISITA, MOTIVOS_VISITA_HISTORICOS, normalizarNomeConsultora } from './ficha-schema'
import type { AtendimentoPresencialDTO } from './rascunhos-shared'

import type {
  DepartamentoInteresse,
  FichaDadosRascunho,
  MotivoResultado,
  MotivoVisita,
  ResultadoAtendimento,
  SexoCrianca,
  SituacaoCrianca,
  UnidadeIdadeCrianca,
} from './ficha-schema'
import { mapearSnapshotEssenciaisParaEdicao } from './essenciais-edicao'
import type { ConfirmacoesEssenciaisEdicao } from './essenciais-edicao'

export const SITUACOES_VENDA = [
  { chave: 'sim', label: 'Venda fechada', tone: 'success' },
  { chave: 'negociacao', label: 'Em negociação', tone: 'warning' },
  { chave: 'nao', label: 'Venda perdida', tone: 'danger' },
] as const

export function situacaoVendaRegistro(resultado: string | null | undefined) {
  return SITUACOES_VENDA.find((item) => item.chave === resultado)
    ?? { label: 'Não informado', tone: 'neutral' as const }
}

// Marcador operacional em campo existente; não muda o contrato de persistência.
export function consultoraDeHomologacao(nome: string | null | undefined) {
  return normalizarNomeConsultora(nome).toUpperCase().startsWith('HOMOLOGACAO ')
}

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
  essenciaisCorrespondencias?: import('./filtro-essenciais-registros').CorrespondenciaEssencialRegistro[]
  versaoFluxo?: number | null
  tipoAtendimento?: 'cliente' | 'nao_cliente' | null
  motivoVisita?: string | null
  criancasNomes?: string[]
  criancasResumo?: Array<{ nome: string; parentesco: string | null }>
  departamentos?: string[]
  observacoes?: string | null
  telefoneRecusaConfirmada?: boolean | null
  id: string
  clienteId: string | null
  clienteNome: string
  clienteTelefone: string | null
  consultoraUsuarioId: string
  consultoraEmail: string
  consultoraNomeManual: string | null
  unidadeId: string
  unidadeNome: string
  resultadoAtendimento: 'sim' | 'nao' | 'negociacao' | null
  numeroLancamento: number | null
  viradaCartaoDia: number | null
  viradaCartaoMes: number | null
  iniciadoEm?: string
  concluidoEm: string | null
}

export type RegistroAtendimentoDetalheDTO = {
  essenciais?: import('./essenciais').SnapshotEssenciais[]
  vendaSgi?: import('./historico-cliente').HistoricoVendaSgiDTO | null
  diagnosticosSgi?: import('./vendas-sgi-diagnostico').ResolucaoVendasSgi['diagnosticos']
  atendimento: AtendimentoRegistroDTO
  cliente: ClienteRegistroAtendimentoDTO | null
  criancas: Array<{ id: string; ordem?: number | null; local_id?: string | null; presente_ja_nasceu?: boolean | null; data_referencia_nascimento?: string | null; crianca_permanente_id?: string | null; parentesco_vinculo?: string | null; situacao: string; nome: string | null; nome_nao_informado?: boolean | null; sexo: string | null; idade_unidade: string | null; idade_valor: number | null; data_prevista_nascimento: string | null }>
  departamentos: Array<{ id: string; ordem?: number | null; departamento: string }>
  produtosInteresse: Array<{ id: string; ordem?: number | null; descricao: string; quantidade?: number | null; vendido?: boolean | null }>
  motivos: Array<{ id: string; ordem?: number | null; motivo: MotivoResultado; complemento: string | null }>
  historico: Array<{
    id: string; acao: string; created_at: string; perfil?: string | null; role?: string | null; usuario_id?: string | null; snapshot?: Record<string, unknown> | null
    essenciaisAlterados?: Array<{ criancaId: string; produto: string; respostaAnterior: 'sim' | 'nao'; respostaNova: 'sim' | 'nao'; confirmadaAnterior: boolean; confirmadaNova: boolean }>
  }>
  podeEditar?: boolean
  motivoBloqueio?: string | null
  limiteEdicaoEm?: string | null
}

export type ClienteRegistroRow = {
  id: string
  nome: string
  telefone?: string | null
  telefone_informado?: string | null
  telefone_normalizado?: string | null
  telefone_normalizado_ddi?: string | null
  parentesco?: string | null
  parentesco_outro?: string | null
}

export function serializarClienteRegistro(row: ClienteRegistroRow | null | undefined): ClienteRegistroAtendimentoDTO | null {
  if (!row) return null
  return {
    id: row.id,
    nome: row.nome,
    telefone: row.telefone?.trim() || row.telefone_informado?.trim() || row.telefone_normalizado_ddi || row.telefone_normalizado || null,
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
  'atendimento' | 'criancas' | 'departamentos' | 'produtosInteresse' | 'motivos' | 'essenciais'
>): FichaDadosRascunho {
  const motivosResultado = ordenarPorOrdem(detalhe.motivos).map((item) => item.motivo)
  const motivoOutro = detalhe.motivos.find((item) => item.motivo === 'outro')?.complemento?.trim()
  const essenciaisDoAtendimento = detalhe.atendimento.versaoEssenciais === 1
    ? mapearSnapshotEssenciaisParaEdicao(detalhe.criancas, detalhe.essenciais ?? []).respostas
    : undefined

  return {
    ...(detalhe.atendimento.versaoFluxo === 2 ? {
      versaoFluxo: 2,
      tipoAtendimento: detalhe.atendimento.tipoAtendimento ?? undefined,
      motivoVisita: (detalhe.atendimento.motivoVisita ?? undefined) as MotivoVisita | undefined,
      motivoVisitaOutro: detalhe.atendimento.motivoVisita === 'outros' ? detalhe.atendimento.motivoVisitaOutro?.trim() || undefined : undefined,
      observacaoNaoFechamento: detalhe.atendimento.observacaoNaoFechamento ?? undefined,
    } : {}),
    consultoraNome: detalhe.atendimento.consultoraNomeManual ?? undefined,
    ...(essenciaisDoAtendimento ? { versaoEssenciais: 1 as const, essenciais: essenciaisDoAtendimento } : {}),
    criancas: ordenarPorOrdem(detalhe.criancas).map((crianca) => ({
      id: crianca.local_id?.trim() || crianca.id,
      presenteJaNasceu: crianca.presente_ja_nasceu ?? undefined,
      dataReferenciaNascimento: crianca.data_referencia_nascimento ?? undefined,
      criancaPermanenteId: crianca.crianca_permanente_id ?? undefined,
      vinculoClienteId: crianca.crianca_permanente_id ? detalhe.atendimento.clienteId ?? undefined : undefined,
      parentesco: crianca.parentesco_vinculo ?? undefined,
      situacao: crianca.situacao as SituacaoCrianca,
      nome: crianca.nome?.trim() || undefined,
      nomeNaoInformado: crianca.nome_nao_informado === true ? true : undefined,
      sexo: crianca.sexo ? crianca.sexo as SexoCrianca : undefined,
      dataPrevistaNascimento: crianca.data_prevista_nascimento ?? undefined,
      idadeUnidade: crianca.idade_unidade ? crianca.idade_unidade as UnidadeIdadeCrianca : undefined,
      idadeValor: crianca.idade_valor ?? undefined,
    })),
    departamentos: ordenarPorOrdem(detalhe.departamentos).map((item) => item.departamento as DepartamentoInteresse),
    ...(detalhe.atendimento.versaoProdutos === 2 ? { versaoProdutos: 2 as const } : {}),
    produtosInteresse: ordenarPorOrdem(detalhe.produtosInteresse).map((item) => detalhe.atendimento.versaoProdutos === 2
      ? { descricao: item.descricao, quantidade: item.quantidade ?? null, vendido: item.vendido ?? null } : item.descricao),
    resultadoAtendimento: detalhe.atendimento.resultadoAtendimento ?? undefined,
    motivosResultado,
    lojasMotivos: Object.fromEntries(detalhe.motivos.filter(item => ['outra_loja_fisica', 'outra_loja_internet'].includes(item.motivo) && item.complemento).map(item => [item.motivo, item.complemento!])),
    motivoOutro: motivoOutro || detalhe.atendimento.motivoOutro || undefined,
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
  confirmacoesEssenciais?: ConfirmacoesEssenciaisEdicao
}) {
  const { etapaAtual, notaTecnica, ...dadosRascunho } = params.ficha
  void etapaAtual
  void notaTecnica

  // A versao persistida nunca pode ser removida por um formulario antigo.
  if (params.detalhe.atendimento.versaoFluxo === 2) {
    dadosRascunho.versaoFluxo = 2
    dadosRascunho.tipoAtendimento = params.detalhe.atendimento.tipoAtendimento ?? undefined
    for (const campo of ['motivoVisita', 'motivoVisitaOutro', 'observacaoNaoFechamento'] as const) {
      if (!Object.hasOwn(params.ficha, campo)) {
        Object.assign(dadosRascunho, { [campo]: params.detalhe.atendimento[campo] ?? undefined })
      }
    }
  }

  return {
    version: params.detalhe.atendimento.version,
    clienteId: params.detalhe.atendimento.clienteId,
    dadosRascunho,
    ...(params.detalhe.atendimento.versaoEssenciais === 1 ? { confirmacoesEssenciais: params.confirmacoesEssenciais ?? {} } : {}),
    numeroLancamento: params.numeroLancamento,
    consultoraNome: normalizarNomeConsultora(params.ficha.consultoraNome ?? params.detalhe.atendimento.consultoraNomeManual ?? ''),
  }
}

export function registroNaoCliente(registro: Pick<AtendimentoPresencialDTO, 'versaoFluxo' | 'tipoAtendimento'>) {
  return registro.versaoFluxo === 2 && registro.tipoAtendimento === 'nao_cliente'
}

export function registroSemTelefone(registro: Pick<RegistroAtendimentoResumoDTO, 'versaoFluxo' | 'tipoAtendimento' | 'clienteTelefone'>) {
  return !registroNaoCliente(registro) && !registro.clienteTelefone?.trim()
}

export function getMotivoVisitaLabel(motivo: string | null | undefined) {
  return [...MOTIVOS_VISITA, ...MOTIVOS_VISITA_HISTORICOS].find((item) => item.chave === motivo)?.label ?? motivo ?? 'Não informado'
}

// Somente valores existentes no snapshot; nunca reconstruir historia com dados atuais.
export function descreverContratoHistorico(snapshot: Record<string, unknown> | null | undefined): string[] {
  if (!snapshot) return []
  const linhas: string[] = []
  const desfechosTelefone: Record<string, string> = {
    telefone_informado: 'Telefone informado',
    cliente_recusou: 'Telefone solicitado; cliente não quis informar',
    cliente_ausente_sem_solicitacao: 'Telefone não solicitado; cliente já havia ido embora',
  }
  if (typeof snapshot.telefoneDesfecho === 'string' && desfechosTelefone[snapshot.telefoneDesfecho]) {
    linhas.push(`Telefone: ${desfechosTelefone[snapshot.telefoneDesfecho]}`)
  }
  for (const [key, label] of [
    ['tipoAtendimento', 'Tipo'], ['tipoAtendimentoAnterior', 'Tipo anterior'], ['tipoAtendimentoNovo', 'Tipo novo'],
    ['motivoVisita', 'Motivo da visita'], ['motivoVisitaAnterior', 'Motivo da visita anterior'], ['motivoVisitaNovo', 'Motivo da visita novo'],
    ['motivoVisitaOutro', 'Descrição de Outros'], ['motivoVisitaOutroAnterior', 'Descrição de Outros anterior'], ['motivoVisitaOutroNovo', 'Descrição de Outros nova'],
    ['observacaoNaoFechamento', 'Observação de não fechamento'], ['observacaoNaoFechamentoAnterior', 'Observação de não fechamento anterior'], ['observacaoNaoFechamentoNova', 'Observação de não fechamento nova'],
  ]) {
    const valor = snapshot[key]
    if (typeof valor !== 'string') continue
    const texto = key === 'motivoVisitaOutro' || key.startsWith('motivoVisitaOutro') ? valor
      : key.startsWith('motivoVisita') ? getMotivoVisitaLabel(valor)
      : key.startsWith('tipoAtendimento') ? (valor === 'nao_cliente' ? 'Não cliente' : valor === 'cliente' ? 'Cliente' : valor) : valor
    linhas.push(`${label}: ${texto}`)
  }
  return linhas
}
