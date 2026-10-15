import { NextResponse } from 'next/server'
import { pesquisarReferenciasPf } from '../decorisi/catalogo'
import { validarItensDecorisi } from '../decorisi/validacao'
import type { IdentificacaoDecorisiRpc } from '../decorisi/tipos'
import { carregarContextoPedidosPersonalizados, type ContextoPedidosPersonalizados } from './contexto'
import { RepositorioDecorisi } from './decorisi-repositorio'
import { backendDecorisiHabilitado, expiracaoDecorisiLocal } from './decorisi-local'
import { ehObjeto, ehUuid, jsonErro, lerJsonLimitado, mapearErroBanco, registrarResultado } from './http'

type Operacao = 'opcoes' | 'referencias' | 'criar' | 'obter' | 'atualizar' | 'cotar' | 'fechar'
export type DependenciasDecorisi = {
  habilitado: (request: Request) => boolean
  carregarContexto: typeof carregarContextoPedidosPersonalizados
  criarRepositorio: (contexto: ContextoPedidosPersonalizados) => RepositorioDecorisi
}
const padrao: DependenciasDecorisi = {
  habilitado: backendDecorisiHabilitado,
  carregarContexto: carregarContextoPedidosPersonalizados,
  criarRepositorio: (ctx) => new RepositorioDecorisi(ctx.supabase),
}

function identificacaoDecorisi(v: Record<string, unknown>, ctx: ContextoPedidosPersonalizados): IdentificacaoDecorisiRpc {
  const unidade = ctx.unidades.find((u) => u.chave === v.unidade)
  if (!unidade) throw new Error('UNIDADE_DECORISI_NAO_PERMITIDA')
  if (typeof v.consultora !== 'string' || v.consultora.trim().length < 2 || v.consultora.trim().length > 20 || typeof v.cliente !== 'string' || !v.cliente.trim() || v.cliente.trim().length > 40 || typeof v.telefone !== 'string') throw new Error('DADOS_DECORISI_INVALIDOS')
  const telefone = v.telefone.replace(/\D/g, '')
  if (!/^\d{10,11}$/.test(telefone) || telefone.startsWith('00')) throw new Error('TELEFONE_DECORISI_INVALIDO')
  return { unidade_id: unidade.id, consultora: v.consultora.trim(), cliente: v.cliente.trim(), telefone_normalizado: telefone }
}

export async function executarApiDecorisi(request: Request, operacao: Operacao, pedidoId?: string, deps: DependenciasDecorisi = padrao): Promise<Response> {
  const log = { rota: new URL(request.url).pathname, operacao: `decorisi_${operacao}`, inicio: Date.now(), pedidoId }
  // Flag desligado não expõe referências, schema, preço ou existência de pedido.
  if (!deps.habilitado(request)) return jsonErro('FORNECEDOR_INDISPONIVEL', 'Fornecedor indisponível.', 404)
  const acesso = await deps.carregarContexto(operacao === 'criar' ? ['pedidos_personalizados_novo'] : ['pedidos_personalizados_gestao', 'pedidos_personalizados_novo'])
  if (!acesso.ok) return acesso.response
  const ctx = acesso.contexto, repo = deps.criarRepositorio(ctx)
  try {
    const expiracaoLocal = operacao === 'opcoes' ? expiracaoDecorisiLocal(request) : undefined
    if (expiracaoLocal) {
      // Só após autenticação, módulo, janela e unidades já validados pelo contexto.
      const homologacao = await repo.homologacaoLocal(ctx.allowedUser.id, expiracaoLocal)
      if (homologacao.error) return mapearErroBanco(homologacao.error)
    }
    const fornecedor = await repo.disponivel(ctx.allowedUser.id)
    if (fornecedor.error) return mapearErroBanco(fornecedor.error)
    if (!fornecedor.data) return jsonErro('FORNECEDOR_INDISPONIVEL', 'Fornecedor indisponível.', 404)
    if (operacao === 'opcoes') {
      const [referencias, precos] = await Promise.all([repo.referencias(''), repo.precos()])
      if (referencias.error || precos.error) return mapearErroBanco(referencias.error ?? precos.error!)
      return NextResponse.json({ ok: true, db: referencias.data, pf: pesquisarReferenciasPf(''), precos: precos.data, unidades: ctx.unidades })
    }
    if (operacao === 'referencias') {
      const termo = (new URL(request.url).searchParams.get('q') ?? '').trim().toUpperCase()
      if (!/^[A-Z0-9]{0,5}$/.test(termo)) return jsonErro('DADOS_INVALIDOS', 'Pesquisa inválida.', 422)
      const resultado = await repo.referencias(termo)
      if (resultado.error) return mapearErroBanco(resultado.error)
      return NextResponse.json({ ok: true, db: resultado.data, pf: pesquisarReferenciasPf(termo) })
    }
    if (operacao !== 'criar') {
      if (!ehUuid(pedidoId)) return jsonErro('ID_INVALIDO', 'ID inválido.', 400)
      const pedido = await repo.pedido(pedidoId, ctx.unidades.map((u) => u.id))
      if (pedido.error) return mapearErroBanco(pedido.error)
      if (!pedido.data || ctx.moduloAutorizado !== 'pedidos_personalizados_gestao' && pedido.data.created_by !== ctx.allowedUser.id) return jsonErro('PEDIDO_NAO_ENCONTRADO', 'Pedido não encontrado.', 404)
      if (operacao === 'obter') return NextResponse.json({ ok: true, pedido: pedido.data })
      if (operacao === 'cotar') {
        const cotacao = await repo.cotar(pedidoId, ctx.allowedUser.id)
        if (cotacao.error) return mapearErroBanco(cotacao.error)
        return NextResponse.json({ ok: true, cotacao: cotacao.data })
      }
    }
    const corpo = await lerJsonLimitado(request)
    if (!corpo.ok) return corpo.response
    if (!ehObjeto(corpo.valor)) return jsonErro('DADOS_INVALIDOS', 'Dados inválidos.', 422)
    const v = corpo.valor
    if (operacao === 'criar') {
      const dados = identificacaoDecorisi(v, ctx)
      if (!ehUuid(v.idempotencyKey)) throw new Error('DADOS_DECORISI_INVALIDOS')
      const resultado = await repo.criar({ p_usuario_id: ctx.allowedUser.id, p_idempotency_key: v.idempotencyKey, p_unidade_id: dados.unidade_id, p_consultora: dados.consultora, p_cliente: dados.cliente, p_telefone_normalizado: dados.telefone_normalizado, p_itens: validarItensDecorisi(v.itens) })
      if (resultado.error) return mapearErroBanco(resultado.error)
      registrarResultado(log, 'sucesso', 'RASCUNHO_DECORISI_CRIADO')
      return NextResponse.json({ ok: true, ...resultado.data }, { status: resultado.data?.reutilizado ? 200 : 201 })
    }
    if (typeof v.expectedVersion !== 'number' || !Number.isInteger(v.expectedVersion) || v.expectedVersion < 1 || v.expectedVersion >= 2147483647) throw new Error('VERSAO_DECORISI_INVALIDA')
    const id = pedidoId as string
    if (operacao === 'atualizar') {
      if (v.identificacao !== undefined && !ehObjeto(v.identificacao)) throw new Error('DADOS_DECORISI_INVALIDOS')
      const identificacao = ehObjeto(v.identificacao) ? identificacaoDecorisi(v.identificacao, ctx) : null
      const resultado = await repo.atualizar(id, ctx.allowedUser.id, v.expectedVersion, validarItensDecorisi(v.itens), identificacao)
      if (resultado.error) return mapearErroBanco(resultado.error)
      registrarResultado(log, 'sucesso', 'RASCUNHO_DECORISI_ATUALIZADO')
      return NextResponse.json({ ok: true, ...resultado.data })
    }
    if (typeof v.numeroLancamento !== 'string' || !/^\d{1,6}$/.test(v.numeroLancamento) || !ehObjeto(v.cotacaoConfirmada)) throw new Error('COTACAO_DECORISI_INVALIDA')
    const resultado = await repo.fechar(id, ctx.allowedUser.id, v.expectedVersion, v.numeroLancamento, v.cotacaoConfirmada)
    if (resultado.error) return mapearErroBanco(resultado.error)
    if (resultado.data?.ok === false) {
      registrarResultado(log, 'erro_validacao', resultado.data.erro)
      return NextResponse.json(resultado.data, { status: resultado.data.erro === 'COTACAO_ALTERADA' ? 409 : 422 })
    }
    registrarResultado(log, 'sucesso', 'VENDA_DECORISI_FECHADA')
    return NextResponse.json({ ok: true, ...resultado.data })
  } catch (erro) {
    const codigo = erro instanceof Error && /^[A-Z_]+$/.test(erro.message) ? erro.message : 'ERRO_INTERNO'
    registrarResultado(log, codigo === 'ERRO_INTERNO' ? 'erro' : 'erro_validacao', codigo)
    if (codigo === 'UNIDADE_DECORISI_NAO_PERMITIDA') return jsonErro('ACESSO_NEGADO', 'Unidade não permitida.', 403)
    return jsonErro(codigo, codigo === 'ERRO_INTERNO' ? 'Não foi possível processar Decorisi.' : 'Revise os dados do pedido Decorisi.', codigo === 'ERRO_INTERNO' ? 500 : 422)
  }
}
