import type { FichaCriancaRascunho } from './ficha-schema'
import { dataAtendimentoLocal } from './idade-aproximada'
import { chaveProduto, type ProdutoCompativel } from './produtos'

export const ESSENCIAIS_VERSAO = 1 as const
export const ESSENCIAIS_HABILITADOS = process.env.NEXT_PUBLIC_PRANCHETA_ESSENCIAIS_V1 === '1'
export const PRODUTOS_ESSENCIAIS = {
  berco: 'Berço', comoda: 'Cômoda', roupeiro: 'Roupeiro', poltrona: 'Poltrona', kit: 'Kit berço',
  coleito: 'Berço Desmontável/Co-leito', banheira: 'Banheira', baba: 'Babá eletrônica',
  carrinho: 'Carrinho', bebe_conforto: 'Bebê conforto', base: 'Base', colchao: 'Colchão',
  alimentacao: 'Cadeira de alimentação', carro: 'Cadeira de carro', montessori: 'Cama montessori',
  carrinho_passeio: 'Carrinho de passeio',
} as const
export type ProdutoEssencial = keyof typeof PRODUTOS_ESSENCIAIS
export type RespostaEssencial = 'sim' | 'nao'
export type EssenciaisRascunho = Record<string, Partial<Record<ProdutoEssencial, RespostaEssencial>>>
export type RespostaAnterior = { resposta: RespostaEssencial; registradoEm: string; atendimentoId: string; filial: string; consultora: string }
export type EstadoEssenciais = Record<string, Partial<Record<ProdutoEssencial, RespostaAnterior>>>
export type SnapshotEssenciais = {
  atendimentoId: string; registradoEm: string; filial: string; consultora: string;
  criancaId: string; nome: string; fase: number | null;
  respostas: { produto: ProdutoEssencial; resposta: RespostaEssencial; confirmada: boolean }[]
}

export function produtosEssenciaisDaFase(meses: number | null): ProdutoEssencial[] {
  if (meses === null || meses < -1 || meses > 12) return []
  if (meses === -1) return ['berco', 'comoda', 'roupeiro', 'poltrona', 'kit', 'coleito', 'banheira', 'baba', 'carrinho', 'bebe_conforto', 'base', 'colchao']
  if (meses <= 3) return ['coleito', 'banheira', 'poltrona']
  if (meses <= 8) return ['alimentacao', 'coleito']
  return ['carro', 'montessori', 'carrinho_passeio']
}

export function faseEssenciais(c: FichaCriancaRascunho, hoje = dataAtendimentoLocal()): number | null {
  if (c.situacao === 'gestacao' || (c.situacao === 'presente_outra_pessoa' && c.presenteJaNasceu === false)) return -1
  if (c.situacao !== 'ja_nasceu' && !(c.situacao === 'presente_outra_pessoa' && c.presenteJaNasceu === true)) return null
  if (c.dataReferenciaNascimento) {
    const [a, m] = hoje.split('-').map(Number)
    const [ano, mes] = c.dataReferenciaNascimento.split('-').map(Number)
    const meses = (a - ano) * 12 + m - mes
    return Number.isInteger(meses) && meses >= 0 ? meses : null
  }
  // Idade de um cadastro antigo sem referência é histórica; exigir nova confirmação.
  if (c.criancaPermanenteId) return null
  if (Number.isInteger(c.idadeValor) && c.idadeValor! >= 0 && c.idadeUnidade) return c.idadeValor! * (c.idadeUnidade === 'anos' ? 12 : 1)
  return null
}

export function rotuloFaseEssenciais(fase: number | null) {
  return fase === null ? 'Fase a confirmar' : fase === -1 ? 'Gestação (ainda não nasceu)' : fase > 12 ? 'Acima de 12 meses' : `${fase} ${fase === 1 ? 'mês' : 'meses'}`
}

export function validarEssenciaisRascunho(valor: unknown, criancas: FichaCriancaRascunho[]): valor is EssenciaisRascunho {
  if (!valor || typeof valor !== 'object' || Array.isArray(valor)) return false
  const ids = new Set(criancas.map(c => c.id))
  return Object.entries(valor).every(([id, respostas]) => ids.has(id) && !!respostas && typeof respostas === 'object' && !Array.isArray(respostas)
    && Object.entries(respostas).every(([produto, resposta]) => Object.hasOwn(PRODUTOS_ESSENCIAIS, produto) && (resposta === 'sim' || resposta === 'nao')))
}

export function respostaEssencial(c: FichaCriancaRascunho, produto: ProdutoEssencial, respostas: EssenciaisRascunho, anteriores: EstadoEssenciais) {
  const atual = respostas[c.id]?.[produto]
  const anterior = c.criancaPermanenteId ? anteriores[c.criancaPermanenteId]?.[produto] : undefined
  return { resposta: atual ?? anterior?.resposta, confirmada: atual !== undefined || anterior?.resposta === 'sim', anterior }
}

export function pendenciaEssenciais(criancas: FichaCriancaRascunho[], respostas: EssenciaisRascunho, anteriores: EstadoEssenciais, hoje?: string) {
  for (const c of criancas) {
    const fase = faseEssenciais(c, hoje)
    if (fase === null) return `Confirme gestação ou idade de ${c.nome || 'cada criança'} antes de continuar.`
    if (produtosEssenciaisDaFase(fase).some(p => !respostaEssencial(c, p, respostas, anteriores).confirmada)) return `Responda ou reconfirme os produtos essenciais de ${c.nome || 'cada criança'}.`
  }
  return null
}

// Inclusão intencional de um interesse: repetir o clique não altera quantidade/venda.
export function incluirEssencialNoInteresse(produtos: ProdutoCompativel[], nome: string, limite = 20) {
  if (produtos.some(p => chaveProduto(typeof p === 'string' ? p : p.descricao) === chaveProduto(nome))) return { produtos, resultado: 'existente' as const }
  if (produtos.length >= limite) return { produtos, resultado: 'limite' as const }
  return { produtos: [...produtos, { descricao: nome, quantidade: 1, vendido: false }], resultado: 'adicionado' as const }
}
