import { NextResponse } from 'next/server'
import type { ProblemaPedidoPersonalizado } from '../tipos'

export const LIMITE_CORPO_JSON_BYTES = 256 * 1024

export type ErroBanco = {
  code?: string
  message?: string
}

export type ContextoLogPedidos = {
  rota: string
  operacao: string
  inicio: number
  usuarioId?: string
  pedidoId?: string
  tapeteId?: string
  anexoId?: string
  slot?: number
  tamanho?: number
  mime?: string
  quantidade?: number
  unidade?: string
}

export function jsonErro(
  erro: string,
  mensagem: string,
  status: number,
  extra?: Record<string, unknown>
) {
  return NextResponse.json({ ok: false, erro, mensagem, ...extra }, { status })
}

export async function lerJsonLimitado(request: Request): Promise<
  | { ok: true; valor: unknown }
  | { ok: false; response: NextResponse }
> {
  const contentLength = Number(request.headers.get('content-length'))
  if (Number.isFinite(contentLength) && contentLength > LIMITE_CORPO_JSON_BYTES) {
    return {
      ok: false,
      response: jsonErro('CORPO_EXCEDIDO', 'O corpo da requisição excede o limite permitido.', 413),
    }
  }

  let texto: string
  try {
    texto = await request.text()
  } catch {
    return { ok: false, response: jsonErro('PAYLOAD_INVALIDO', 'Payload inválido.', 400) }
  }

  if (Buffer.byteLength(texto, 'utf8') > LIMITE_CORPO_JSON_BYTES) {
    return {
      ok: false,
      response: jsonErro('CORPO_EXCEDIDO', 'O corpo da requisição excede o limite permitido.', 413),
    }
  }

  try {
    return { ok: true, valor: JSON.parse(texto) as unknown }
  } catch {
    return { ok: false, response: jsonErro('PAYLOAD_INVALIDO', 'Payload inválido.', 400) }
  }
}

export function ehObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor)
}

export function ehUuid(valor: unknown): valor is string {
  return typeof valor === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(valor)
}

export function possuiAlgumCampo(
  objeto: Record<string, unknown>,
  campos: readonly string[]
) {
  return campos.some((campo) => Object.prototype.hasOwnProperty.call(objeto, campo))
}

export function respostaProblemasDominio(
  problemas: readonly ProblemaPedidoPersonalizado[]
) {
  return jsonErro(
    'DADOS_INVALIDOS',
    'Revise os dados informados.',
    422,
    { problemas: problemas.map(({ codigo, campo, mensagem }) => ({ codigo, campo, mensagem })) }
  )
}

export function codigoEstavelErroBanco(error: ErroBanco) {
  const mensagem = error.message ?? ''
  if (error.code === 'P0003' || mensagem.includes('CONFLITO_VERSAO')) {
    return 'CONFLITO_VERSAO'
  }
  if (
    error.code === 'P0002'
    || mensagem.includes('PEDIDO_NAO_ENCONTRADO')
    || mensagem.includes('TAPETE_NAO_PERTENCE_AO_PEDIDO')
  ) {
    return 'PEDIDO_NAO_ENCONTRADO'
  }
  if (error.code === '42501' || mensagem.includes('USUARIO_INVALIDO')) {
    return 'ACESSO_NEGADO'
  }
  if (mensagem.includes('EDICAO_COMERCIAL_BLOQUEADA')) {
    return 'EDICAO_COMERCIAL_BLOQUEADA'
  }
  if (
    error.code === '22023'
    || error.code === '23514'
    || mensagem.includes('INVALIDO')
    || mensagem.includes('LIMITE_')
    || mensagem.includes('DUPLICADA')
  ) {
    return 'DADOS_INVALIDOS'
  }
  if (error.code === '23505') return 'CONFLITO_RECURSO'
  return 'ERRO_INTERNO'
}

export function mapearErroBanco(error: ErroBanco): NextResponse {
  const codigo = codigoEstavelErroBanco(error)
  if (codigo === 'CONFLITO_VERSAO') {
    return jsonErro(codigo, 'Este pedido foi alterado por outra pessoa. Recarregue os dados antes de continuar.', 409)
  }
  if (codigo === 'PEDIDO_NAO_ENCONTRADO') {
    return jsonErro(codigo, 'Pedido não encontrado.', 404)
  }
  if (codigo === 'ACESSO_NEGADO') {
    return jsonErro(codigo, 'Acesso negado.', 403)
  }
  if (codigo === 'EDICAO_COMERCIAL_BLOQUEADA') {
    return jsonErro(
      codigo,
      'Os dados comerciais não podem ser alterados neste status.',
      422
    )
  }
  if (codigo === 'DADOS_INVALIDOS') {
    return jsonErro(codigo, 'Revise os dados informados.', 422)
  }
  if (codigo === 'CONFLITO_RECURSO') {
    return jsonErro(codigo, 'O recurso já existe.', 409)
  }
  return jsonErro(codigo, 'Erro ao processar requisição.', 500)
}

export function registrarResultado(
  contexto: ContextoLogPedidos,
  resultado: 'sucesso' | 'erro',
  codigo: string
) {
  console.info('[pedidos-personalizados]', {
    rota: contexto.rota,
    operacao: contexto.operacao,
    usuarioId: contexto.usuarioId ?? null,
    pedidoId: contexto.pedidoId ?? null,
    tapeteId: contexto.tapeteId ?? null,
    anexoId: contexto.anexoId ?? null,
    slot: contexto.slot ?? null,
    tamanho: contexto.tamanho ?? null,
    mime: contexto.mime ?? null,
    quantidade: contexto.quantidade ?? null,
    unidade: contexto.unidade ?? null,
    duracaoMs: Math.max(Date.now() - contexto.inicio, 0),
    resultado,
    codigo,
  })
}
