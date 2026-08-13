import { normalizarTelefone } from '@/lib/atendimento-presencial/telefone'
import {
  normalizarCliente,
  normalizarConsultora,
  normalizarNumeroLancamento,
} from '../normalizacao'
import type { ItemPedidoLebebeExclusiveRpc } from '../tipos'
import { ehObjeto, ehUuid } from './http'

const NUMERO_LANCAMENTO = /^\d{1,6}$/
const CAMPOS_COMUNS = new Set([
  'idempotencyKey', 'expectedVersion', 'fornecedor', 'unidade', 'consultora',
  'cliente', 'telefone', 'numeroLancamento', 'itens',
])

export type ProblemaValidacaoLebebeExclusive = {
  codigo: string
  campo: string
  mensagem: string
}

function falhaValidacao(
  codigo: string,
  campo: string,
  mensagem: string,
  problemas: ProblemaValidacaoLebebeExclusive[] = [{ codigo, campo, mensagem }]
) {
  return { ok: false as const, codigo, mensagem, campo, problemas }
}

export function normalizarBuscaCatalogo(valor: string) {
  return valor
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleUpperCase('pt-BR')
    .replace(/\s+/g, ' ')
    .trim()
}

export function normalizarBuscaReferencia(valor: string) {
  return normalizarBuscaCatalogo(valor).replace(/[^A-Z0-9]/g, '')
}

export function validarFiltrosCatalogoLebebeExclusive(url: URL):
  | { ok: true; filtros: { colecao: string | null; descricao: string | null; referencia: string | null; pagina: number } }
  | { ok: false; mensagem: string } {
  const colecao = normalizarBuscaCatalogo(url.searchParams.get('colecao') ?? '') || null
  const descricao = normalizarBuscaCatalogo(url.searchParams.get('descricao') ?? '') || null
  const referencia = normalizarBuscaReferencia(url.searchParams.get('referencia') ?? '') || null
  const paginaTexto = url.searchParams.get('pagina') ?? '1'
  const pagina = Number(paginaTexto)
  if (![colecao, descricao, referencia].some((valor) => valor !== null && valor.length >= 3)) {
    return { ok: false, mensagem: 'Informe ao menos 3 caracteres em um dos filtros.' }
  }
  if ([colecao, descricao, referencia].some((valor) => valor !== null && valor.length < 3)) {
    return { ok: false, mensagem: 'Cada filtro preenchido deve ter ao menos 3 caracteres úteis.' }
  }
  if (!Number.isSafeInteger(pagina) || pagina < 1) {
    return { ok: false, mensagem: 'A página informada é inválida.' }
  }
  return { ok: true, filtros: { colecao, descricao, referencia, pagina } }
}

export type EntradaLebebeExclusiveNormalizada = {
  expectedVersion?: number
  unidade: string
  consultora: string
  cliente: string
  telefoneNormalizado: string
  numeroLancamento: string | null
  itens: ItemPedidoLebebeExclusiveRpc[]
}

export function validarEntradaLebebeExclusive(
  valor: unknown,
  opcoes: { comercial: boolean }
):
  | { ok: true; dados: EntradaLebebeExclusiveNormalizada }
  | { ok: false; codigo: string; mensagem: string; campo: string; problemas: ProblemaValidacaoLebebeExclusive[] } {
  if (!ehObjeto(valor)) {
    return falhaValidacao('PAYLOAD_INVALIDO', 'payload', 'O corpo do pedido deve ser um objeto JSON.')
  }
  const camposNaoPermitidos = Object.keys(valor).filter((campo) => !CAMPOS_COMUNS.has(campo))
  if (camposNaoPermitidos.length > 0) {
    const problemas = camposNaoPermitidos.map((campo) => ({
      codigo: 'CAMPO_NAO_PERMITIDO',
      campo,
      mensagem: `O campo ${campo} não pertence ao pedido Lebebe Exclusive.`,
    }))
    return falhaValidacao('CAMPO_NAO_PERMITIDO', problemas[0].campo, problemas[0].mensagem, problemas)
  }
  if (valor.fornecedor !== 'lebebe_exclusive') return falhaValidacao('FORNECEDOR_INVALIDO', 'fornecedor', 'Selecione o fornecedor Lebebe Exclusive.')
  if (typeof valor.unidade !== 'string') return falhaValidacao('UNIDADE_INVALIDA', 'unidade', 'Selecione uma unidade válida.')
  if (typeof valor.consultora !== 'string') return falhaValidacao('CONSULTORA_INVALIDA', 'consultora', 'Informe a consultora.')
  if (typeof valor.cliente !== 'string') return falhaValidacao('CLIENTE_INVALIDO', 'cliente', 'Informe o cliente.')
  if (typeof valor.telefone !== 'string') return falhaValidacao('TELEFONE_INVALIDO', 'telefone', 'Informe um telefone válido.')
  if (!Array.isArray(valor.itens)) return falhaValidacao('ITENS_INVALIDOS', 'itens', 'Informe os produtos do pedido.')

  const consultora = normalizarConsultora(valor.consultora)
  const cliente = normalizarCliente(valor.cliente)
  const telefone = normalizarTelefone(valor.telefone)
  const numeroLancamento = typeof valor.numeroLancamento === 'string' || valor.numeroLancamento == null
    ? normalizarNumeroLancamento(valor.numeroLancamento as string | null | undefined)
    : '__INVALIDO__'

  if (consultora.length < 2 || consultora.length > 20) {
    return falhaValidacao('CONSULTORA_INVALIDA', 'consultora', 'Informe uma consultora válida.')
  }
  if (cliente.length < 1 || cliente.length > 40) {
    return falhaValidacao('CLIENTE_INVALIDO', 'cliente', 'Informe um cliente válido.')
  }
  if (!telefone.valido || !telefone.telefoneNormalizado) {
    return falhaValidacao('TELEFONE_INVALIDO', 'telefone', 'Informe um telefone válido.')
  }
  if (numeroLancamento === '__INVALIDO__' || (numeroLancamento !== null && !NUMERO_LANCAMENTO.test(numeroLancamento))) {
    return falhaValidacao('NUMERO_LANCAMENTO_INVALIDO', 'numeroLancamento', 'O número de lançamento deve conter somente números, com até 6 dígitos.')
  }
  if (valor.itens.length < 1) {
    return falhaValidacao('ITENS_OBRIGATORIOS', 'itens', 'Selecione ao menos um produto.')
  }

  const ids = new Set<string>()
  const ordens = new Set<number>()
  const itens: ItemPedidoLebebeExclusiveRpc[] = []
  for (const [indice, item] of valor.itens.entries()) {
    if (!ehObjeto(item) || Object.keys(item).some((campo) => !['produtoId', 'ordem', 'quantidade', 'nomeOuLetra'].includes(campo))) {
      return falhaValidacao('ITEM_PEDIDO_INVALIDO', `itens.${indice}`, `Revise os dados do item ${indice + 1}.`)
    }
    const nomeOuLetra = typeof item.nomeOuLetra === 'string' ? item.nomeOuLetra.trim() : null
    if (!ehUuid(item.produtoId) || ids.has(item.produtoId)) {
      return falhaValidacao('PRODUTO_INVALIDO', `itens.${indice}.produtoId`, `Não foi possível identificar o produto do item ${indice + 1}. Atualize a pesquisa e tente novamente.`)
    }
    if (!Number.isInteger(item.ordem) || Number(item.ordem) < 1 || Number(item.ordem) > valor.itens.length || ordens.has(Number(item.ordem))) {
      return falhaValidacao('ORDEM_ITEM_INVALIDA', `itens.${indice}.ordem`, `A ordem do item ${indice + 1} é inválida.`)
    }
    if (!Number.isInteger(item.quantidade) || Number(item.quantidade) < 1) {
      return falhaValidacao('QUANTIDADE_INVALIDA', `itens.${indice}.quantidade`, `A quantidade do item ${indice + 1} deve ser um número inteiro maior que zero.`)
    }
    if ((item.nomeOuLetra !== undefined && item.nomeOuLetra !== null && typeof item.nomeOuLetra !== 'string') || (nomeOuLetra !== null && (nomeOuLetra.length < 1 || nomeOuLetra.length > 200))) {
      return falhaValidacao('NOME_OU_LETRA_INVALIDO', `itens.${indice}.nomeOuLetra`, `O nome ou letra do item ${indice + 1} deve ter até 200 caracteres.`)
    }
    ids.add(item.produtoId)
    ordens.add(Number(item.ordem))
    itens.push({
      produto_id: item.produtoId,
      ordem: Number(item.ordem),
      quantidade: Number(item.quantidade),
      nome_ou_letra: nomeOuLetra,
    })
  }

  if (opcoes.comercial && (!Number.isInteger(valor.expectedVersion) || Number(valor.expectedVersion) < 1)) {
    return falhaValidacao('VERSAO_INVALIDA', 'expectedVersion', 'Versão do pedido inválida.')
  }

  itens.sort((a, b) => a.ordem - b.ordem)
  return {
    ok: true,
    dados: {
      ...(opcoes.comercial ? { expectedVersion: Number(valor.expectedVersion) } : {}),
      unidade: valor.unidade,
      consultora,
      cliente,
      telefoneNormalizado: telefone.telefoneNormalizado,
      numeroLancamento,
      itens,
    },
  }
}
