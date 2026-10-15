import { createHash } from 'node:crypto'
import { NextResponse } from 'next/server'
import { operacoesAnexoGestao } from '../status-fluxo'
import {
  carregarContextoPedidosPersonalizados,
  type ContextoPedidosPersonalizados,
} from './contexto'
import { RepositorioDecorisi } from './decorisi-repositorio'
import { backendDecorisiHabilitado } from './decorisi-local'
import { StorageAnexos } from './anexos-repositorio'
import {
  BUCKET_ANEXOS_PEDIDOS,
  ErroArquivoAnexo,
  gerarCaminhoAnexo,
  lerMultipartAnexo,
} from './anexos-arquivo'
import {
  ehObjeto,
  ehUuid,
  jsonErro,
  lerJsonLimitado,
  mapearErroBanco,
  registrarResultado,
} from './http'

export class RepositorioAnexosDecorisi {
  constructor(
    private readonly supabase: ContextoPedidosPersonalizados['supabase'],
  ) {}
  async executar(
    nome: 'preparar' | 'registrar' | 'remover',
    pedido: string,
    item: string,
    usuario: string,
    version: number,
    dados: Record<string, unknown> | string,
  ) {
    return this.supabase.rpc(`decorisi_${nome}_anexo`, {
      p_pedido: pedido,
      p_item: item,
      p_usuario: usuario,
      p_version: version,
      ...(typeof dados === 'string' ? { p_anexo: dados } : { p_dados: dados }),
    })
  }
  async anexo(item: string, id: string) {
    return this.supabase
      .from('pedidos_personalizados_decorisi_anexos')
      .select('path')
      .eq('item_id', item)
      .eq('id', id)
      .maybeSingle()
  }
  async conferirArquivo(caminho: string, sha: string) {
    const { data, error } = await this.supabase.storage
      .from(BUCKET_ANEXOS_PEDIDOS)
      .download(caminho)
    return (
      !error &&
      !!data &&
      createHash('sha256')
        .update(Buffer.from(await data.arrayBuffer()))
        .digest('hex') === sha
    )
  }
}
export type DependenciasAnexosDecorisi = {
  habilitado: (request: Request) => boolean
  contexto: typeof carregarContextoPedidosPersonalizados
  pedido: (ctx: ContextoPedidosPersonalizados) => RepositorioDecorisi
  anexos: (ctx: ContextoPedidosPersonalizados) => RepositorioAnexosDecorisi
  storage: (ctx: ContextoPedidosPersonalizados) => StorageAnexos
}
const padrao: DependenciasAnexosDecorisi = {
  habilitado: backendDecorisiHabilitado,
  contexto: carregarContextoPedidosPersonalizados,
  pedido: (ctx) => new RepositorioDecorisi(ctx.supabase),
  anexos: (ctx) => new RepositorioAnexosDecorisi(ctx.supabase),
  storage: (ctx) => new StorageAnexos(ctx.supabase),
}

export async function executarAnexoDecorisi(
  request: Request,
  pedidoId: string,
  itemId: string,
  anexoId?: string,
  deps = padrao,
): Promise<Response> {
  const log = {
    rota: new URL(request.url).pathname,
    operacao: `decorisi_anexo_${request.method}`,
    inicio: Date.now(),
    pedidoId,
  }
  if (!deps.habilitado(request))
    return jsonErro('FORNECEDOR_INDISPONIVEL', 'Fornecedor indisponível.', 404)
  const acesso = await deps.contexto([
    'pedidos_personalizados_gestao',
    'pedidos_personalizados_novo',
  ])
  if (!acesso.ok) return acesso.response
  const ctx = acesso.contexto,
    repo = deps.pedido(ctx),
    anexos = deps.anexos(ctx),
    storage = deps.storage(ctx)
  try {
    if (
      !ehUuid(pedidoId) ||
      !ehUuid(itemId) ||
      (anexoId !== undefined && !ehUuid(anexoId))
    )
      return jsonErro('ID_INVALIDO', 'Identificação inválida.', 400)
    const disponivel = await repo.disponivel(ctx.allowedUser.id)
    if (disponivel.error) return mapearErroBanco(disponivel.error)
    if (!disponivel.data)
      return jsonErro(
        'FORNECEDOR_INDISPONIVEL',
        'Fornecedor indisponível.',
        404,
      )
    const resultado = await repo.pedido(
      pedidoId,
      ctx.unidades.map((u) => u.id),
    )
    if (resultado.error) return mapearErroBanco(resultado.error)
    const pedido = resultado.data
    const itens = pedido?.itens as unknown as Array<{ id: string }> | undefined
    if (
      !pedido ||
      !itens?.some((i) => i.id === itemId) ||
      (ctx.moduloAutorizado !== 'pedidos_personalizados_gestao' &&
        pedido.created_by !== ctx.allowedUser.id)
    )
      return jsonErro('PEDIDO_NAO_ENCONTRADO', 'Pedido não encontrado.', 404)
    if (request.method === 'GET' && anexoId) {
      const anexo = await anexos.anexo(itemId, anexoId)
      if (anexo.error) return mapearErroBanco(anexo.error)
      if (!anexo.data)
        return jsonErro('ANEXO_NAO_ENCONTRADO', 'Anexo não encontrado.', 404)
      const url = await storage.urlAssinada(anexo.data.path)
      return url.ok
        ? NextResponse.json(
            { ok: true, url: url.url },
            { headers: { 'Cache-Control': 'no-store' } },
          )
        : jsonErro(
            'STORAGE_INDISPONIVEL',
            'Não foi possível abrir o anexo.',
            503,
          )
    }
    const operacoes = operacoesAnexoGestao(pedido.status)
    const permitido = request.method === 'DELETE' ? operacoes.remover
      : request.method === 'PUT' ? operacoes.substituir : operacoes.adicionar
    if (!permitido)
      return jsonErro(
        'COMPOSICAO_DECORISI_BLOQUEADA',
        'Este pedido não pode ser editado.',
        409,
      )
    if (request.method === 'DELETE' && anexoId) {
      const corpo = await lerJsonLimitado(request)
      if (!corpo.ok) return corpo.response
      const v = corpo.valor
      if (
        !ehObjeto(v) ||
        !Number.isInteger(v.expectedVersion) ||
        Number(v.expectedVersion) < 1
      )
        return jsonErro(
          'EXPECTED_VERSION_INVALIDA',
          'Recarregue o pedido.',
          422,
        )
      const r = await anexos.executar(
        'remover',
        pedidoId,
        itemId,
        ctx.allowedUser.id,
        Number(v.expectedVersion),
        anexoId,
      )
      return r.error
        ? mapearErroBanco(r.error)
        : NextResponse.json({ ok: true, ...r.data })
    }
    const chave = request.headers.get('Idempotency-Key')
    if (!ehUuid(chave))
      return jsonErro(
        'IDEMPOTENCY_KEY_INVALIDA',
        'Não foi possível identificar o envio.',
        422,
      )
    const form = await lerMultipartAnexo(request, true, 5)
    const id = anexoId ?? chave
    const caminho = gerarCaminhoAnexo({
      pedidoId,
      tapeteId: itemId,
      anexoId: id,
      arquivoId: chave,
      extensao: form.arquivo.extensao,
    })
    const sha = createHash('sha256')
      .update(Buffer.from(form.arquivo.bytes))
      .digest('hex')
    const dados = {
      id,
      slot: form.slot,
      caminho_objeto: caminho,
      nome_original: form.arquivo.nomeOriginal,
      mime_type: form.arquivo.mimeType,
      tamanho_bytes: form.arquivo.tamanhoBytes,
      arquivo_sha256: sha,
      substituir: !!anexoId,
    }
    const preparado = await anexos.executar(
      'preparar',
      pedidoId,
      itemId,
      ctx.allowedUser.id,
      form.expectedVersion,
      dados,
    )
    if (preparado.error) return mapearErroBanco(preparado.error)
    if (preparado.data.reutilizado)
      return NextResponse.json({ ok: true, ...preparado.data })
    const upload = await storage.upload(
      caminho,
      form.arquivo.bytes,
      form.arquivo.mimeType,
    )
    // Um timeout pode ter gravado o objeto. Conferir conteúdo permite replay seguro sem upsert.
    if (!upload.ok && !(await anexos.conferirArquivo(caminho, sha)))
      return jsonErro(
        'UPLOAD_PENDENTE',
        'O envio não foi confirmado. Tente novamente com o mesmo arquivo.',
        503,
      )
    const registrado = await anexos.executar(
      'registrar',
      pedidoId,
      itemId,
      ctx.allowedUser.id,
      form.expectedVersion,
      dados,
    )
    // Nunca apagar aqui: uma resposta perdida pode corresponder a um COMMIT aceito.
    // A reserva durável só continua pendente quando não há metadado confirmado.
    if (registrado.error) return mapearErroBanco(registrado.error)
    registrarResultado(log, 'sucesso', 'ANEXO_DECORISI_SALVO')
    return NextResponse.json({ ok: true, ...registrado.data })
  } catch (erro) {
    if (erro instanceof ErroArquivoAnexo)
      return jsonErro(
        erro.codigo,
        'Revise o arquivo: JPEG, PNG, WEBP ou PDF, até 10 MiB.',
        erro.status,
      )
    registrarResultado(log, 'erro', 'ANEXO_DECORISI_INDISPONIVEL')
    return jsonErro(
      'ANEXO_DECORISI_INDISPONIVEL',
      'A operação não foi confirmada. Recarregue o pedido antes de tentar novamente.',
      503,
    )
  }
}
