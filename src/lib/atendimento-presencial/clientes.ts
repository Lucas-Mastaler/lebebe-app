import { formatarTelefone, normalizarTelefone } from './telefone'
import { extrairDigitosTelefone } from './telefone'

export const PARENTESCOS_CLIENTE = [
  { chave: 'mae', label: 'Mãe' },
  { chave: 'pai', label: 'Pai' },
  { chave: 'avo_masculino', label: 'Avô' },
  { chave: 'avo_feminino', label: 'Avó' },
  { chave: 'tio', label: 'Tio' },
  { chave: 'tia', label: 'Tia' },
  { chave: 'irmao', label: 'Irmão' },
  { chave: 'irma', label: 'Irmã' },
  { chave: 'padrinho', label: 'Padrinho' },
  { chave: 'madrinha', label: 'Madrinha' },
  { chave: 'amigo', label: 'Amigo' },
  { chave: 'amiga', label: 'Amiga' },
  { chave: 'outro', label: 'Outro' },
] as const

export type ParentescoCliente = (typeof PARENTESCOS_CLIENTE)[number]['chave']

const parentescosValidos = new Set<string>(PARENTESCOS_CLIENTE.map((item) => item.chave))

export type ClientePresencialRow = {
  id: string
  nome: string
  telefone_informado: string | null
  telefone_normalizado: string | null
  telefone_normalizado_ddi: string | null
  parentesco: ParentescoCliente
  parentesco_outro: string | null
  status: 'ativo' | 'inativo'
  version: number
  origem_consultora_nome?: string | null
  origem_consultora_usuario_id?: string | null
  origem_unidade_id?: string | null
  origem_atendimento_id?: string | null
  created_at: string
  updated_at: string
}

export type OrigemClientePresencialDTO = {
  consultoraNome: string | null
  consultoraUsuarioId: string | null
  unidadeId: string | null
  unidadeNome?: string | null
  atendimentoId: string | null
}

export type ClientePresencialDTO = {
  id: string
  nome: string
  telefone: string | null
  telefoneFormatado: string | null
  parentesco: ParentescoCliente
  parentescoLabel: string
  parentescoOutro: string | null
  status: 'ativo' | 'inativo'
  version: number
  origem: OrigemClientePresencialDTO
  criadoEm: string
  atualizadoEm: string
}

export type ResultadoValidacaoCliente =
  | {
      ok: true
      nome: string
      telefoneInformado: string | null
      telefoneNormalizado: string | null
      telefoneNormalizadoDDI: string | null
      parentesco: ParentescoCliente
      parentescoOutro: string | null
    }
  | {
      ok: false
      message: string
      field: 'nome' | 'telefone' | 'parentesco' | 'parentescoOutro' | 'payload'
    }

export type ResultadoAtualizacaoTelefoneCliente =
  | {
      ok: true
      telefoneInformado: string | null
      telefoneNormalizado: string | null
      telefoneNormalizadoDDI: string | null
      version: number
    }
  | {
      ok: false
      message: string
      field: 'telefone' | 'version' | 'payload'
    }

export function normalizarNomeCliente(valor: unknown) {
  if (typeof valor !== 'string') return ''
  return valor.trim().replace(/\s+/g, ' ')
}

export function validarPayloadCliente(body: unknown): ResultadoValidacaoCliente {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return { ok: false, field: 'payload', message: 'Payload invalido' }
  }

  const payload = body as Record<string, unknown>
  const nome = normalizarNomeCliente(payload.nome)
  if (nome.length < 2 || nome.length > 120) {
    return { ok: false, field: 'nome', message: 'Nome deve ter entre 2 e 120 caracteres' }
  }

  if (typeof payload.parentesco !== 'string' || !parentescosValidos.has(payload.parentesco)) {
    return { ok: false, field: 'parentesco', message: 'Parentesco invalido' }
  }

  const parentesco = payload.parentesco as ParentescoCliente
  const parentescoOutro = typeof payload.parentescoOutro === 'string'
    ? payload.parentescoOutro.trim().replace(/\s+/g, ' ')
    : ''

  if (parentesco === 'outro' && (parentescoOutro.length < 2 || parentescoOutro.length > 60)) {
    return {
      ok: false,
      field: 'parentescoOutro',
      message: 'Informe o complemento do parentesco',
    }
  }

  if (parentesco !== 'outro' && parentescoOutro.length > 0) {
    return {
      ok: false,
      field: 'parentescoOutro',
      message: 'Complemento permitido apenas para Outro',
    }
  }

  const telefoneBruto = typeof payload.telefone === 'string' ? payload.telefone.trim() : ''
  const telefone = telefoneBruto ? normalizarTelefone(telefoneBruto) : null

  if (telefone && !telefone.valido) {
    return { ok: false, field: 'telefone', message: 'Telefone invalido' }
  }

  return {
    ok: true,
    nome,
    telefoneInformado: telefoneBruto || null,
    telefoneNormalizado: telefone?.telefoneNormalizado ?? null,
    telefoneNormalizadoDDI: telefone?.telefoneNormalizadoDDI ?? null,
    parentesco,
    parentescoOutro: parentesco === 'outro' ? parentescoOutro : null,
  }
}

export function validarAtualizacaoTelefoneCliente(body: unknown): ResultadoAtualizacaoTelefoneCliente {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return { ok: false, field: 'payload', message: 'Payload invalido' }
  }

  const payload = body as Record<string, unknown>
  const version = Number(payload.version)
  if (!Number.isInteger(version) || version < 1) {
    return { ok: false, field: 'version', message: 'Versao esperada invalida' }
  }

  if (payload.telefone !== null && typeof payload.telefone !== 'string') {
    return { ok: false, field: 'telefone', message: 'Telefone invalido' }
  }

  const telefoneInformado = typeof payload.telefone === 'string' ? payload.telefone.trim() : ''
  const telefone = telefoneInformado ? normalizarTelefone(telefoneInformado) : null

  if (telefone && !telefone.valido) {
    return { ok: false, field: 'telefone', message: 'Telefone invalido' }
  }

  return {
    ok: true,
    telefoneInformado: telefoneInformado || null,
    telefoneNormalizado: telefone?.telefoneNormalizado ?? null,
    telefoneNormalizadoDDI: telefone?.telefoneNormalizadoDDI ?? null,
    version,
  }
}

export function getParentescoLabel(parentesco: ParentescoCliente, parentescoOutro?: string | null) {
  if (parentesco === 'outro' && parentescoOutro) return `Outro: ${parentescoOutro}`
  return PARENTESCOS_CLIENTE.find((item) => item.chave === parentesco)?.label ?? parentesco
}

export function serializarClientePresencial(
  row: ClientePresencialRow,
  origemExtras?: { unidadeNome?: string | null }
): ClientePresencialDTO {
  return {
    id: row.id,
    nome: row.nome,
    telefone: row.telefone_informado,
    telefoneFormatado: row.telefone_normalizado ? formatarTelefone(row.telefone_normalizado) : null,
    parentesco: row.parentesco,
    parentescoLabel: getParentescoLabel(row.parentesco, row.parentesco_outro),
    parentescoOutro: row.parentesco_outro,
    status: row.status,
    version: row.version,
    origem: {
      consultoraNome: row.origem_consultora_nome ?? null,
      consultoraUsuarioId: row.origem_consultora_usuario_id ?? null,
      unidadeId: row.origem_unidade_id ?? null,
      unidadeNome: origemExtras?.unidadeNome ?? null,
      atendimentoId: row.origem_atendimento_id ?? null,
    },
    criadoEm: row.created_at,
    atualizadoEm: row.updated_at,
  }
}

export function normalizarTermoBusca(valor: string | null) {
  return (valor ?? '').trim().replace(/\s+/g, ' ')
}

export function normalizarTermosBuscaNome(valor: string | null | undefined) {
  return normalizarTermoBusca(typeof valor === 'string' ? valor : null)
    .split(' ')
    .map((termo) => termo.trim())
    .filter(Boolean)
}

export function normalizarTrechoBuscaTelefone(valor: string | null | undefined) {
  const digitos = extrairDigitosTelefone(valor)
  if (!digitos) return ''
  if (digitos.startsWith('55') && digitos.length > 11) return digitos.slice(2)
  return digitos.slice(0, 11)
}

export type TipoBuscaCliente = 'vazia' | 'nome' | 'telefone' | 'mista_invalida'

export function detectarTipoBuscaCliente(valor: string | null | undefined): TipoBuscaCliente {
  const termo = normalizarTermoBusca(typeof valor === 'string' ? valor : null)
  if (!termo) return 'vazia'

  const temLetra = /[A-Za-zÀ-ÿ]/.test(termo)
  const temDigito = /\d/.test(termo)

  if (temLetra && temDigito) return 'mista_invalida'
  if (temLetra) return 'nome'
  if (temDigito) return 'telefone'
  return 'vazia'
}

export function escaparTermoIlike(valor: string) {
  return valor.replace(/[\\%_]/g, (match) => `\\${match}`)
}
