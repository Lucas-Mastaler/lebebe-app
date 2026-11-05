import { FICHA_OBSERVACOES_MAX_CHARS, FICHA_PRODUTOS_MAX_ITENS, FICHA_PRODUTO_MAX_CHARS, normalizarNomeConsultora, validarNumeroLancamento, type FichaDadosRascunho } from './ficha-schema'
import { chaveProduto, produtoNaoTrabalhado, estruturarProduto, QUANTIDADE_PRODUTO_MAX, type ProdutoAtendimento, type ProdutoCompativel } from './produtos'

export const CANAIS_DIGITAIS = ['whatsapp', 'telefone', 'outro'] as const
export type CanalDigital = typeof CANAIS_DIGITAIS[number]
export type SituacaoNegociacao = 'aberta' | 'venda' | 'perda'
export type ResumoNegociacao = { origemId: string; situacao: SituacaoNegociacao; canal: string | null; encerradoEm: string | null; atendimentoId: string | null; rascunhos?: number }
export function explicarConflitoNegociacao(code: string, message: string) {
  if (message.includes('negociacao_encerrada')) return 'Esta negociação já foi encerrada com uma venda ou perda concluída. Consulte o histórico para ver o registro. Seus rascunhos continuam salvos.'
  if (message.includes('lancamento_ja_utilizado') || message.includes('venda_digital_existente') || (code === '23505' && message.includes('numero_lancamento'))) return 'Este número de lançamento já está registrado nesta filial. Confira o lançamento antes de continuar.'
  if (message.includes('atendimento_ja_associado') || message.includes('origem_ja_associada')) return 'Este atendimento já está vinculado a uma negociação. Consulte o vínculo antes de continuar.'
  if (code === '23505') return 'Esta ação pode já estar registrada. Reabra a negociação e confira o histórico antes de tentar novamente. Um rascunho em aberto não causa esse bloqueio.'
  return 'Esta tela ficou desatualizada após uma alteração na negociação. Reabra a negociação para carregar os dados atuais. Os rascunhos existentes continuam salvos.'
}
export function efeitoVinculacao(resultado: string) {
  return resultado === 'sim' ? 'Esta venda encerrará a negociação.' : resultado === 'nao' ? 'Este atendimento encerrará a negociação como perdida.' : 'Este retorno será vinculado e a negociação continuará aberta.'
}
export function mensagemAtualizacao(acao: string, resultado?: { resultado?: string }) {
  if (acao === 'associar') return resultado?.resultado === 'sim' ? 'Negociação encerrada com venda.' : resultado?.resultado === 'nao' ? 'Negociação encerrada como perdida.' : 'Retorno vinculado. Negociação continua aberta.'
  const mensagens: Record<string, string> = { vincular: 'Negociação encerrada com venda.', retorno: 'Atendimento presencial vinculado. O rascunho não encerra a negociação.', rascunho: 'Rascunho digital salvo.', concluir: 'Venda digital registrada. Negociação encerrada com venda.', corrigir: 'Venda digital corrigida.', anular: 'Venda digital anulada. Negociação reaberta.', perda: 'Negociação encerrada como perdida.', desvincular: 'Vínculo removido. Negociação reaberta.', corrigir_vinculo: 'Vínculo corrigido.' }
  return mensagens[acao] || 'Atualização concluída.'
}
export type VendaDigital = {
  clienteId: string; negociacaoId: string; unidadeId: string; consultora: string
  canal: CanalDigital; canalOutro?: string; fechadoEm: string; numeroLancamento: number
  produtos: ProdutoAtendimento[]; observacoes: string
}
type ValidacaoDigital = { ok: true; dados: VendaDigital } | { ok: false; field: string; message: string }
const uuid = (valor: unknown): valor is string => typeof valor === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(valor)

/** Sem regras de visita presencial: não coleta telefone, crianças ou essenciais. */
export function validarVendaDigital(valor: unknown, agora = new Date()): ValidacaoDigital {
  const falha = (field: string, message: string): ValidacaoDigital => ({ ok: false, field, message })
  if (!valor || typeof valor !== 'object' || Array.isArray(valor)) return falha('formulario', 'Revise a venda digital.')
  const p = valor as Record<string, unknown>
  for (const field of ['clienteId', 'negociacaoId', 'unidadeId']) if (!uuid(p[field])) return falha(field, 'Identifique a cliente, a negociação e a filial.')
  if (!CANAIS_DIGITAIS.includes(p.canal as CanalDigital)) return falha('canal', 'Informe o canal do fechamento.')
  const canalOutro = typeof p.canalOutro === 'string' ? p.canalOutro.trim() : ''
  if (p.canal === 'outro' && (canalOutro.length < 2 || canalOutro.length > 120)) return falha('canalOutro', 'Descreva o canal em até 120 caracteres.')
  const consultora = normalizarNomeConsultora(p.consultora)
  if (consultora.length < 2 || consultora.length > 30 || !/^[A-Z]+(?: [A-Z]+)*$/.test(consultora)) return falha('consultora', 'Informe o nome da consultora, até 30 caracteres.')
  const data = typeof p.fechadoEm === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/.test(p.fechadoEm) ? new Date(p.fechadoEm) : new Date(NaN)
  if (typeof p.fechadoEm === 'string') {
    const dia = p.fechadoEm.slice(0, 10)
    const calendario = new Date(`${dia}T12:00:00Z`)
    if (!Number.isFinite(calendario.getTime()) || calendario.toISOString().slice(0, 10) !== dia) return falha('fechadoEm', 'Informe uma data válida.')
  }
  if (!Number.isFinite(data.getTime()) || data > agora) return falha('fechadoEm', 'Informe a data real do fechamento, sem data futura.')
  const lancamento = validarNumeroLancamento(p.numeroLancamento)
  if (!lancamento.ok) return falha('numeroLancamento', lancamento.message)
  if (!Array.isArray(p.produtos) || p.produtos.length > FICHA_PRODUTOS_MAX_ITENS) return falha('produtos', 'Revise a lista de produtos.')
  const produtos: ProdutoAtendimento[] = []
  const nomes = new Set<string>()
  for (const produto of p.produtos) {
    if (!produto || typeof produto !== 'object' || Array.isArray(produto)) return falha('produtos', 'Revise os produtos vendidos.')
    const item = produto as Record<string, unknown>
    const descricao = typeof item.descricao === 'string' ? chaveProduto(item.descricao) : ''
    if (!descricao || Array.from(descricao).length > FICHA_PRODUTO_MAX_CHARS || nomes.has(descricao)) return falha('produtos', 'Revise nomes e produtos repetidos.')
    if (produtoNaoTrabalhado({ descricao, quantidade: null, vendido: null })) {
      if (item.quantidade !== null || (item.vendido !== null && item.vendido !== false)) return falha('produtos', 'O marcador de produto não trabalhado não pode registrar venda ou quantidade.')
      nomes.add(descricao)
      produtos.push({ descricao, quantidade: null, vendido: null })
      continue
    }
    if (typeof item.vendido !== 'boolean') return falha('produtos', 'Confirme quais produtos foram vendidos.')
    if (item.quantidade !== null && (!Number.isInteger(item.quantidade) || Number(item.quantidade) < 1 || Number(item.quantidade) > QUANTIDADE_PRODUTO_MAX)) return falha('produtos', 'Informe quantidades inteiras válidas.')
    if (item.vendido && (item.quantidade === null || produtoNaoTrabalhado({ descricao, quantidade: null, vendido: false }))) return falha('produtos', 'Informe a quantidade de cada produto vendido.')
    nomes.add(descricao)
    produtos.push({ descricao, quantidade: item.quantidade as number | null, vendido: item.vendido })
  }
  if (!produtos.some(p => p.vendido)) return falha('produtos', 'Marque pelo menos um produto vendido.')
  if (p.observacoes !== undefined && typeof p.observacoes !== 'string') return falha('observacoes', 'Revise as observações.')
  const observacoes = typeof p.observacoes === 'string' ? p.observacoes.trim() : ''
  if (Array.from(observacoes).length > FICHA_OBSERVACOES_MAX_CHARS) return falha('observacoes', 'Use até 2000 caracteres.')
  return { ok: true, dados: { clienteId: p.clienteId as string, negociacaoId: p.negociacaoId as string, unidadeId: p.unidadeId as string,
    consultora, canal: p.canal as CanalDigital, ...(p.canal === 'outro' ? { canalOutro } : {}), fechadoEm: data.toISOString(),
    numeroLancamento: lancamento.numeroLancamento!, produtos, observacoes } }
}

/** Não transporta lançamento, resultado, motivos ou confirmações de outra visita. */
export function prepararFichaRetorno(origem: FichaDadosRascunho): FichaDadosRascunho {
  const interesses: ProdutoCompativel[] = origem.produtosInteresse.filter(p => estruturarProduto(p).vendido !== true)
    .map(p => ({ ...estruturarProduto(p), vendido: false }))
  return {
    versaoFluxo: 2, tipoAtendimento: 'cliente', versaoProdutos: 2,
    versaoEssenciais: 1, essenciais: {}, etapaAtual: 'ficha',
    consultoraNome: origem.consultoraNome,
    cliente: origem.cliente ? { ...origem.cliente } : undefined,
    criancas: origem.criancas.map(c => ({ ...c })),
    departamentos: [...origem.departamentos], produtosInteresse: interesses, motivosResultado: [],
  }
}

/** O estado de rascunhos não participa desta decisão, por D-060. */
export function decidirConclusaoRetorno(situacao: SituacaoNegociacao, resultado: 'sim' | 'nao' | 'negociacao', independente: boolean) {
  if (independente) return 'independente' as const
  if (situacao !== 'aberta') return 'confirmar_independente' as const
  return resultado === 'negociacao' ? 'manter_aberta' as const : 'encerrar' as const
}
