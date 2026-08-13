import { NextResponse } from 'next/server'
import { podeTransicionarStatus } from '../status-fluxo'
import { carregarContextoPedidosPersonalizados, type ContextoPedidosPersonalizados } from './contexto'
import { ehUuid, jsonErro, lerJsonLimitado, registrarResultado, type ContextoLogPedidos } from './http'
import { RepositorioPedidosPersonalizados } from './repositorio'
import { validarTransicaoStatus } from './validacao-api'

type Dependencias = {
  carregarContexto: typeof carregarContextoPedidosPersonalizados
  criarRepositorio: (contexto: ContextoPedidosPersonalizados) => RepositorioPedidosPersonalizados
}

const padrao: Dependencias = {
  carregarContexto: carregarContextoPedidosPersonalizados,
  criarRepositorio: (contexto) => new RepositorioPedidosPersonalizados(contexto.supabase),
}

function erroTransicao(error: { code?: string; message?: string }) {
  const detalhe = error.message ?? error.code ?? ''
  if (detalhe.includes('CONFLITO_VERSAO') || error.code === 'P0003') {
    return jsonErro('CONFLITO_VERSAO', 'Este pedido foi alterado por outra pessoa. Recarregue os dados antes de continuar.', 409)
  }
  if (detalhe.includes('PEDIDO_NAO_ENCONTRADO') || error.code === 'P0002') {
    return jsonErro('PEDIDO_NAO_ENCONTRADO', 'Pedido nao encontrado.', 404)
  }
  if (detalhe.includes('ANEXO_LAYOUT_OBRIGATORIO')) {
    return jsonErro('ANEXO_LAYOUT_OBRIGATORIO', 'Adicione ao menos um anexo antes de continuar.', 422)
  }
  if (detalhe.includes('CAMPOS_PRODUCAO_OBRIGATORIOS')) {
    return jsonErro('CAMPOS_PRODUCAO_OBRIGATORIOS', 'Informe pedido de compra, data do pedido ao fornecedor e comprador.', 422)
  }
  if (detalhe.includes('CAMPOS_LAYOUT_OBRIGATORIOS')) {
    return jsonErro('CAMPOS_LAYOUT_OBRIGATORIOS', 'Informe pedido de compra, data do pedido ao fornecedor e comprador.', 422)
  }
  if (detalhe.includes('NUMERO_LANCAMENTO_OBRIGATORIO')) {
    return jsonErro('NUMERO_LANCAMENTO_OBRIGATORIO', 'Informe um número de lançamento válido antes de fechar a venda.', 422)
  }
  if (detalhe.includes('DATA_ENTREGA_OBRIGATORIA')) {
    return jsonErro('DATA_ENTREGA_OBRIGATORIA', 'Informe a previsão de data de entrega do fornecedor.', 422)
  }
  if (detalhe.includes('JUSTIFICATIVA_CANCELAMENTO_OBRIGATORIA')) {
    return jsonErro('JUSTIFICATIVA_CANCELAMENTO_OBRIGATORIA', 'Informe a justificativa do cancelamento.', 422)
  }
  if (detalhe.includes('TRANSICAO_STATUS_INVALIDA')) {
    return jsonErro('TRANSICAO_STATUS_INVALIDA', 'Esta transicao de status nao e permitida.', 422)
  }
  if (error.code === '42501' || detalhe.includes('USUARIO_INVALIDO')) {
    return jsonErro('ACESSO_NEGADO', 'Acesso negado.', 403)
  }
  return jsonErro('ERRO_INTERNO', 'Nao foi possivel alterar o status.', 500)
}

export async function transicionarStatus(
  request: Request,
  pedidoId: string,
  deps: Dependencias = padrao
) {
  const log: ContextoLogPedidos = {
    rota: '/api/pedidos-personalizados/pedidos/[id]/status',
    operacao: 'transicionar_status',
    inicio: Date.now(),
    pedidoId,
  }
  const acesso = await deps.carregarContexto(['pedidos_personalizados_gestao'])
  if (!acesso.ok) return acesso.response
  log.usuarioId = acesso.contexto.allowedUser.id
  if (!ehUuid(pedidoId)) return jsonErro('ID_INVALIDO', 'ID do pedido invalido.', 400)

  const corpo = await lerJsonLimitado(request)
  if (!corpo.ok) return corpo.response
  const validacao = validarTransicaoStatus(corpo.valor)
  if (!validacao.ok) return jsonErro(validacao.codigo, validacao.mensagem, 422)

  const repo = deps.criarRepositorio(acesso.contexto)
  const atual = await repo.buscarPedidoNoEscopo(pedidoId, acesso.contexto.unidades.map((item) => item.id))
  if (atual.error) return erroTransicao(atual.error)
  if (!atual.data) return jsonErro('PEDIDO_NAO_ENCONTRADO', 'Pedido nao encontrado.', 404)
  const fornecedor = atual.data.fornecedor?.chave
  if (!fornecedor || !podeTransicionarStatus(atual.data.status, validacao.dados.statusDestino, fornecedor)) {
    return jsonErro('TRANSICAO_STATUS_INVALIDA', 'Esta transicao de status nao e permitida.', 422)
  }

  const numeroPedidoCompra = validacao.dados.numeroPedidoCompra ?? atual.data.numero_pedido_compra
  const dataPedidoFornecedor = validacao.dados.dataPedidoFornecedor ?? atual.data.data_pedido_fornecedor
  const comprador = validacao.dados.comprador ?? atual.data.comprador
  const dataEntrega = validacao.dados.dataEntrega ?? atual.data.data_entrega
  if (atual.data.status === 'RASCUNHO'
      && validacao.dados.statusDestino === 'VENDA FECHADA'
      && !/^\d{1,6}$/.test(atual.data.numero_lancamento ?? '')) {
    return jsonErro(
      'NUMERO_LANCAMENTO_OBRIGATORIO',
      'Informe um número de lançamento válido antes de fechar a venda.',
      422
    )
  }
  if (atual.data.status === 'VENDA FECHADA'
      && ['AGUARDANDO LAYOUT', 'EM PRODUÇÃO'].includes(validacao.dados.statusDestino)
      && (!numeroPedidoCompra || !dataPedidoFornecedor || !comprador)) {
    return jsonErro(
      'CAMPOS_LAYOUT_OBRIGATORIOS',
      'Informe pedido de compra, data do pedido ao fornecedor e comprador.',
      422
    )
  }
  if (validacao.dados.statusDestino === 'EM PRODUÇÃO' && !dataEntrega) {
    return jsonErro(
      'DATA_ENTREGA_OBRIGATORIA',
      'Informe a previsão de data de entrega do fornecedor.',
      422
    )
  }
  if (validacao.dados.statusDestino === 'RECEBIDO' && !validacao.dados.dataRecebimento) {
    return jsonErro('DATA_RECEBIMENTO_OBRIGATORIA', 'Informe a data de recebimento.', 422)
  }

  const resultado = await repo.transicionarStatus({
    p_pedido_id: pedidoId,
    p_expected_version: validacao.dados.expectedVersion,
    p_usuario_id: acesso.contexto.allowedUser.id,
    p_status_destino: validacao.dados.statusDestino,
    p_numero_pedido_compra: ['AGUARDANDO LAYOUT', 'EM PRODUÇÃO'].includes(validacao.dados.statusDestino) ? numeroPedidoCompra : null,
    p_data_pedido_fornecedor: ['AGUARDANDO LAYOUT', 'EM PRODUÇÃO'].includes(validacao.dados.statusDestino) ? dataPedidoFornecedor : null,
    p_comprador: ['AGUARDANDO LAYOUT', 'EM PRODUÇÃO'].includes(validacao.dados.statusDestino) ? comprador : null,
    p_data_entrega: validacao.dados.statusDestino === 'EM PRODUÇÃO'
      ? dataEntrega
      : validacao.dados.statusDestino === 'RECEBIDO'
        ? validacao.dados.dataRecebimento
        : null,
    p_justificativa: validacao.dados.justificativa,
  })
  if (resultado.error) return erroTransicao(resultado.error)

  registrarResultado(log, 'sucesso', 'STATUS_ALTERADO')
  return NextResponse.json({
    ok: true,
    pedidoId,
    eventoId: resultado.data.evento_id,
    status: resultado.data.status,
    version: resultado.data.version,
  })
}

export type { Dependencias as DependenciasApiStatus }
