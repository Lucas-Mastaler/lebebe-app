import { NextResponse } from 'next/server'
import { carregarContextoPedidosPersonalizados, type ContextoPedidosPersonalizados } from './contexto'
import { ehObjeto, ehUuid, jsonErro, lerJsonLimitado, registrarResultado, type ContextoLogPedidos } from './http'
import { ErroArquivoAnexo, EXPIRACAO_URL_ASSINADA_SEGUNDOS, gerarCaminhoAnexo, lerMultipartAnexo } from './anexos-arquivo'
import { verificarAcessoAnexoPedidoPersonalizado } from './anexos-autorizacao'
import { RepositorioAnexos, StorageAnexos, type EscopoAnexo } from './anexos-repositorio'

type Dependencias = {
  carregarContexto: typeof carregarContextoPedidosPersonalizados
  criarRepositorio: (contexto: ContextoPedidosPersonalizados) => RepositorioAnexos
  criarStorage: (contexto: ContextoPedidosPersonalizados) => StorageAnexos
  uuid: () => string
  agora: () => Date
}

const padrao: Dependencias = {
  carregarContexto: carregarContextoPedidosPersonalizados,
  criarRepositorio: (contexto) => new RepositorioAnexos(contexto.supabase),
  criarStorage: (contexto) => new StorageAnexos(contexto.supabase),
  uuid: () => crypto.randomUUID(),
  agora: () => new Date(),
}

function erroArquivo(error: unknown) {
  if (!(error instanceof ErroArquivoAnexo)) return null
  return jsonErro(error.codigo, 'Arquivo ou formulário inválido.', error.status)
}

function erroBanco(error: { code?: string; message?: string }) {
  const codigo = error.message ?? error.code ?? ''
  if (codigo.includes('CONFLITO_VERSAO')) return jsonErro('CONFLITO_VERSAO', 'O pedido foi alterado.', 409)
  if (codigo.includes('SLOT_ANEXO_OCUPADO') || error.code === '23505') return jsonErro('SLOT_ANEXO_OCUPADO', 'O slot já está ocupado.', 409)
  if (codigo.includes('NAO_ENCONTRADO') || codigo.includes('NAO_PERTENCE') || error.code === 'P0002') return jsonErro('ANEXO_NAO_ENCONTRADO', 'Recurso não encontrado.', 404)
  if (codigo.includes('LIMITE_ANEXOS')) return jsonErro('LIMITE_ANEXOS', 'O limite de anexos foi atingido.', 422)
  if (error.code === '42501') return jsonErro('ACESSO_NEGADO', 'Acesso negado.', 403)
  if (error.code === '22023' || error.code === '23514') return jsonErro('DADOS_INVALIDOS', 'Revise os dados informados.', 422)
  return jsonErro('ERRO_INTERNO', 'Não foi possível concluir a operação.', 500)
}

async function contexto(log: ContextoLogPedidos, deps: Dependencias) {
  const acesso = await deps.carregarContexto([
    'pedidos_personalizados_gestao',
    'pedidos_personalizados_novo',
  ])
  if (!acesso.ok) return acesso
  log.usuarioId = acesso.contexto.allowedUser.id
  return acesso
}

async function compensar(repo: RepositorioAnexos, storage: StorageAnexos, caminho: string) {
  const remocao = await storage.remover(caminho)
  if (remocao.ok) return true
  const fila = await repo.enfileirarFalhaAposUpload(caminho)
  if (fila.error) {
    console.error('[pedidos-personalizados]', {
      operacao: 'compensar_upload', resultado: 'erro', codigo: 'FILA_COMPENSACAO_FALHOU',
    })
  }
  return !fila.error
}

function idsValidos(...ids: string[]) { return ids.every(ehUuid) }
function unidades(ctx: ContextoPedidosPersonalizados) { return ctx.unidades.map((item) => item.id) }

export async function uploadAnexo(request: Request, pedidoId: string, tapeteId: string, deps: Dependencias = padrao) {
  const log: ContextoLogPedidos = { rota: '/api/pedidos-personalizados/pedidos/[id]/tapetes/[tapeteId]/anexos', operacao: 'upload_anexo', inicio: Date.now(), pedidoId, tapeteId }
  const acesso = await contexto(log, deps)
  if (!acesso.ok) return acesso.response
  if (!idsValidos(pedidoId, tapeteId)) return jsonErro('ID_INVALIDO', 'ID inválido.', 400)
  const repo = deps.criarRepositorio(acesso.contexto)
  const escopo = await repo.buscarTapeteNoEscopo(pedidoId, tapeteId, unidades(acesso.contexto))
  if (escopo.error) return erroBanco(escopo.error)
  if (!escopo.data) return jsonErro('TAPETE_NAO_ENCONTRADO', 'Recurso não encontrado.', 404)
  if (!verificarAcessoAnexoPedidoPersonalizado(acesso.contexto, escopo.data.pedido)) {
    return jsonErro('TAPETE_NAO_ENCONTRADO', 'Recurso não encontrado.', 404)
  }

  let form
  try { form = await lerMultipartAnexo(request, true) } catch (error) { return erroArquivo(error) ?? jsonErro('PAYLOAD_INVALIDO', 'Payload inválido.', 422) }
  if (escopo.data.pedido.version !== form.expectedVersion) return jsonErro('CONFLITO_VERSAO', 'O pedido foi alterado.', 409)
  const atuais = await repo.listarAnexosTapete(tapeteId)
  if (atuais.error) return erroBanco(atuais.error)
  if (atuais.data.length >= 2 || atuais.data.some((item) => item.slot === form.slot)) return jsonErro('SLOT_ANEXO_OCUPADO', 'O slot já está ocupado.', 409)

  const anexoId = deps.uuid()
  const caminho = gerarCaminhoAnexo({ pedidoId, tapeteId, anexoId, arquivoId: deps.uuid(), extensao: form.arquivo.extensao })
  const storage = deps.criarStorage(acesso.contexto)
  const enviado = await storage.upload(caminho, form.arquivo.bytes, form.arquivo.mimeType)
  if (!enviado.ok) return jsonErro('STORAGE_INDISPONIVEL', 'Falha temporária no armazenamento.', 503)
  const registrado = await repo.registrar({
    p_pedido_id: pedidoId, p_tapete_id: tapeteId, p_expected_version: form.expectedVersion,
    p_slot: form.slot, p_caminho_objeto: caminho, p_nome_original: form.arquivo.nomeOriginal,
    p_mime_type: form.arquivo.mimeType, p_tamanho_bytes: form.arquivo.tamanhoBytes,
    p_usuario_id: acesso.contexto.allowedUser.id,
  })
  if (registrado.error) {
    await compensar(repo, storage, caminho)
    return erroBanco(registrado.error)
  }
  registrarResultado({ ...log, anexoId, slot: form.slot, tamanho: form.arquivo.tamanhoBytes, mime: form.arquivo.mimeType }, 'sucesso', 'ANEXO_CRIADO')
  return NextResponse.json({ ok: true, anexoId, slot: form.slot, nomeOriginal: form.arquivo.nomeOriginal, mime: form.arquivo.mimeType, tamanho: form.arquivo.tamanhoBytes, version: registrado.data.version }, { status: 201 })
}

async function carregarAnexo(anexoId: string, log: ContextoLogPedidos, deps: Dependencias) {
  const acesso = await contexto(log, deps)
  if (!acesso.ok) return { ok: false as const, response: acesso.response }
  if (!ehUuid(anexoId)) return { ok: false as const, response: jsonErro('ID_INVALIDO', 'ID inválido.', 400) }
  const repo = deps.criarRepositorio(acesso.contexto)
  const escopo = await repo.buscarAnexoNoEscopo(anexoId, unidades(acesso.contexto))
  if (escopo.error) return { ok: false as const, response: erroBanco(escopo.error) }
  if (!escopo.data?.anexo) return { ok: false as const, response: jsonErro('ANEXO_NAO_ENCONTRADO', 'Recurso não encontrado.', 404) }
  if (!verificarAcessoAnexoPedidoPersonalizado(acesso.contexto, escopo.data.pedido)) {
    return { ok: false as const, response: jsonErro('ANEXO_NAO_ENCONTRADO', 'Recurso não encontrado.', 404) }
  }
  return { ok: true as const, acesso: acesso.contexto, repo, escopo: escopo.data as EscopoAnexo & { anexo: NonNullable<EscopoAnexo['anexo']> } }
}

export async function abrirAnexo(_request: Request, anexoId: string, deps: Dependencias = padrao) {
  const log: ContextoLogPedidos = { rota: '/api/pedidos-personalizados/anexos/[anexoId]', operacao: 'abrir_anexo', inicio: Date.now(), anexoId }
  const carregado = await carregarAnexo(anexoId, log, deps)
  if (!carregado.ok) return carregado.response
  const url = await deps.criarStorage(carregado.acesso).urlAssinada(carregado.escopo.anexo.caminho_objeto)
  if (!url.ok) return jsonErro('STORAGE_INDISPONIVEL', 'Falha temporária no armazenamento.', 503)
  const expiraEm = new Date(deps.agora().getTime() + EXPIRACAO_URL_ASSINADA_SEGUNDOS * 1000).toISOString()
  registrarResultado(log, 'sucesso', 'URL_ASSINADA_CRIADA')
  return NextResponse.json({ ok: true, url: url.url, expiraEm, nomeOriginal: carregado.escopo.anexo.nome_original, mime: carregado.escopo.anexo.mime_type })
}

export async function substituirAnexo(request: Request, anexoId: string, deps: Dependencias = padrao) {
  const log: ContextoLogPedidos = { rota: '/api/pedidos-personalizados/anexos/[anexoId]', operacao: 'substituir_anexo', inicio: Date.now(), anexoId }
  const carregado = await carregarAnexo(anexoId, log, deps)
  if (!carregado.ok) return carregado.response
  let form
  try { form = await lerMultipartAnexo(request, false) } catch (error) { return erroArquivo(error) ?? jsonErro('PAYLOAD_INVALIDO', 'Payload inválido.', 422) }
  if (carregado.escopo.pedido.version !== form.expectedVersion) return jsonErro('CONFLITO_VERSAO', 'O pedido foi alterado.', 409)
  const caminho = gerarCaminhoAnexo({ pedidoId: carregado.escopo.pedido.id, tapeteId: carregado.escopo.tapete.id, anexoId, arquivoId: deps.uuid(), extensao: form.arquivo.extensao })
  const storage = deps.criarStorage(carregado.acesso)
  const enviado = await storage.upload(caminho, form.arquivo.bytes, form.arquivo.mimeType)
  if (!enviado.ok) return jsonErro('STORAGE_INDISPONIVEL', 'Falha temporária no armazenamento.', 503)
  const resultado = await carregado.repo.substituir({
    p_pedido_id: carregado.escopo.pedido.id, p_anexo_id: anexoId, p_expected_version: form.expectedVersion,
    p_caminho_objeto: caminho, p_nome_original: form.arquivo.nomeOriginal, p_mime_type: form.arquivo.mimeType,
    p_tamanho_bytes: form.arquivo.tamanhoBytes, p_usuario_id: carregado.acesso.allowedUser.id,
  })
  if (resultado.error) { await compensar(carregado.repo, storage, caminho); return erroBanco(resultado.error) }
  registrarResultado({ ...log, tamanho: form.arquivo.tamanhoBytes, mime: form.arquivo.mimeType }, 'sucesso', 'ANEXO_SUBSTITUIDO')
  return NextResponse.json({ ok: true, anexoId, slot: carregado.escopo.anexo.slot, nomeOriginal: form.arquivo.nomeOriginal, mime: form.arquivo.mimeType, tamanho: form.arquivo.tamanhoBytes, createdAt: carregado.escopo.anexo.created_at, version: resultado.data.version })
}

export async function removerAnexo(request: Request, anexoId: string, deps: Dependencias = padrao) {
  const log: ContextoLogPedidos = { rota: '/api/pedidos-personalizados/anexos/[anexoId]', operacao: 'remover_anexo', inicio: Date.now(), anexoId }
  const carregado = await carregarAnexo(anexoId, log, deps)
  if (!carregado.ok) return carregado.response
  const corpo = await lerJsonLimitado(request)
  if (!corpo.ok) return corpo.response
  if (!ehObjeto(corpo.valor) || !Number.isInteger(corpo.valor.expectedVersion) || Number(corpo.valor.expectedVersion) < 1) return jsonErro('PAYLOAD_INVALIDO', 'Payload inválido.', 422)
  if (carregado.escopo.pedido.version !== corpo.valor.expectedVersion) {
    return jsonErro('CONFLITO_VERSAO', 'O pedido foi alterado.', 409)
  }
  const resultado = await carregado.repo.remover({ p_pedido_id: carregado.escopo.pedido.id, p_anexo_id: anexoId, p_expected_version: corpo.valor.expectedVersion, p_usuario_id: carregado.acesso.allowedUser.id })
  if (resultado.error) return erroBanco(resultado.error)
  const caminho = String(resultado.data.caminho_enfileirado)
  const removido = await deps.criarStorage(carregado.acesso).remover(caminho)
  if (removido.ok) await carregado.repo.marcarProcessadoPorCaminho(caminho, deps.agora().toISOString())
  registrarResultado(log, 'sucesso', 'ANEXO_REMOVIDO')
  return NextResponse.json({ ok: true, anexoId, version: resultado.data.version })
}

export type { Dependencias as DependenciasApiAnexos }
