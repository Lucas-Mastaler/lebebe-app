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
  | { ok: true; filtros: { colecao: string | null; descricao: string | null; referencia: string | null } }
  | { ok: false; mensagem: string } {
  const colecao = normalizarBuscaCatalogo(url.searchParams.get('colecao') ?? '') || null
  const descricao = normalizarBuscaCatalogo(url.searchParams.get('descricao') ?? '') || null
  const referencia = normalizarBuscaReferencia(url.searchParams.get('referencia') ?? '') || null
  if (![colecao, descricao, referencia].some((valor) => valor !== null && valor.length >= 3)) {
    return { ok: false, mensagem: 'Informe ao menos 3 caracteres em um dos filtros.' }
  }
  if ([colecao, descricao, referencia].some((valor) => valor !== null && valor.length < 3)) {
    return { ok: false, mensagem: 'Cada filtro preenchido deve ter ao menos 3 caracteres úteis.' }
  }
  return { ok: true, filtros: { colecao, descricao, referencia } }
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
  | { ok: false; codigo: string; mensagem: string; campo?: string } {
  if (!ehObjeto(valor) || Object.keys(valor).some((campo) => !CAMPOS_COMUNS.has(campo))) {
    return { ok: false, codigo: 'PAYLOAD_INVALIDO', mensagem: 'Payload inválido.' }
  }
  if (
    valor.fornecedor !== 'lebebe_exclusive'
    || typeof valor.unidade !== 'string'
    || typeof valor.consultora !== 'string'
    || typeof valor.cliente !== 'string'
    || typeof valor.telefone !== 'string'
    || !Array.isArray(valor.itens)
  ) return { ok: false, codigo: 'PAYLOAD_INVALIDO', mensagem: 'Revise a identificação e os itens.' }

  const consultora = normalizarConsultora(valor.consultora)
  const cliente = normalizarCliente(valor.cliente)
  const telefone = normalizarTelefone(valor.telefone)
  const numeroLancamento = typeof valor.numeroLancamento === 'string' || valor.numeroLancamento == null
    ? normalizarNumeroLancamento(valor.numeroLancamento as string | null | undefined)
    : '__INVALIDO__'

  if (consultora.length < 2 || consultora.length > 20) {
    return { ok: false, codigo: 'CONSULTORA_INVALIDA', mensagem: 'Informe uma consultora válida.', campo: 'consultora' }
  }
  if (cliente.length < 1 || cliente.length > 40) {
    return { ok: false, codigo: 'CLIENTE_INVALIDO', mensagem: 'Informe um cliente válido.', campo: 'cliente' }
  }
  if (!telefone.valido || !telefone.telefoneNormalizado) {
    return { ok: false, codigo: 'TELEFONE_INVALIDO', mensagem: 'Informe um telefone válido.', campo: 'telefone' }
  }
  if (numeroLancamento === '__INVALIDO__' || (numeroLancamento !== null && !NUMERO_LANCAMENTO.test(numeroLancamento))) {
    return { ok: false, codigo: 'NUMERO_LANCAMENTO_INVALIDO', mensagem: 'Use até 6 dígitos no lançamento.', campo: 'numeroLancamento' }
  }
  if (valor.itens.length < 1) {
    return { ok: false, codigo: 'ITENS_OBRIGATORIOS', mensagem: 'Selecione ao menos um produto.', campo: 'itens' }
  }

  const ids = new Set<string>()
  const ordens = new Set<number>()
  const itens: ItemPedidoLebebeExclusiveRpc[] = []
  for (const [indice, item] of valor.itens.entries()) {
    if (!ehObjeto(item) || Object.keys(item).some((campo) => !['produtoId', 'ordem', 'quantidade', 'nomeOuLetra'].includes(campo))) {
      return { ok: false, codigo: 'ITEM_PEDIDO_INVALIDO', mensagem: 'Revise o produto selecionado.', campo: `itens.${indice}` }
    }
    const nomeOuLetra = typeof item.nomeOuLetra === 'string' ? item.nomeOuLetra.trim() : null
    if (
      !ehUuid(item.produtoId)
      || !Number.isInteger(item.ordem)
      || Number(item.ordem) < 1
      || Number(item.ordem) > valor.itens.length
      || !Number.isInteger(item.quantidade)
      || Number(item.quantidade) < 1
      || (item.nomeOuLetra !== undefined && item.nomeOuLetra !== null && typeof item.nomeOuLetra !== 'string')
      || (nomeOuLetra !== null && (nomeOuLetra.length < 1 || nomeOuLetra.length > 200))
      || ids.has(item.produtoId)
      || ordens.has(Number(item.ordem))
    ) return { ok: false, codigo: 'ITEM_PEDIDO_INVALIDO', mensagem: 'Revise quantidade, ordem e nome/letra.', campo: `itens.${indice}` }
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
    return { ok: false, codigo: 'VERSAO_INVALIDA', mensagem: 'Versão do pedido inválida.' }
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
