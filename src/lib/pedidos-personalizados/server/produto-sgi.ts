import { createHash, timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { carregarContextoPedidosPersonalizados } from './contexto'
import { ehObjeto, ehUuid, jsonErro, lerJsonLimitado } from './http'
import {
  RepositorioPedidosPersonalizados,
  type CheckpointProdutoSgi,
  type EtapaIntegracaoProdutoSgi,
  type IntegracaoProdutoSgiRow,
} from './repositorio'

const ETAPAS: readonly EtapaIntegracaoProdutoSgi[] = [
  'NAO_INICIADO',
  'PRODUTO_DUPLICADO',
  'PRODUTO_RENOMEADO',
  'CUSTO_CRIADO',
  'CUSTO_FINALIZADO',
  'PRECO_ATUALIZADO',
  'CONCLUIDO',
]

const STATUS_CHECKPOINT = ['PROCESSANDO', 'ERRO', 'CONCLUIDO'] as const

function textoOpcional(valor: unknown, limite = 500): string | null | undefined {
  if (valor === undefined || valor === null) return valor
  return typeof valor === 'string' && valor.length <= limite ? valor : undefined
}

export function serializarIntegracaoProdutoSgi(row: IntegracaoProdutoSgiRow | null) {
  if (!row) return null
  return {
    status: row.status_integracao,
    etapa: row.etapa,
    nomeProduto: row.nome_produto_sgi,
    custo: Number(row.custo_enviado),
    preco: Number(row.preco_enviado),
    produtoIdSgi: row.produto_id_sgi,
    codigoSgi: row.codigo_sgi,
    tentativas: row.tentativas,
    erroCodigo: row.erro_codigo,
    erroMensagem: row.erro_mensagem,
    solicitadoEm: row.solicitado_em,
    iniciadoEm: row.iniciado_em,
    concluidoEm: row.concluido_em,
    atualizadoEm: row.updated_at,
  }
}

export async function solicitarProdutoSgi(_request: Request, pedidoId: string) {
  if (!ehUuid(pedidoId)) return jsonErro('ID_INVALIDO', 'ID do pedido inválido.', 400)

  const acesso = await carregarContextoPedidosPersonalizados(['pedidos_personalizados_gestao'])
  if (!acesso.ok) return acesso.response

  const repositorio = new RepositorioPedidosPersonalizados(acesso.contexto.supabase)
  const atual = await repositorio.buscarPedidoNoEscopo(
    pedidoId,
    acesso.contexto.unidades.map((unidade) => unidade.id)
  )
  if (atual.error) return jsonErro('ERRO_INTERNO', 'Erro ao processar solicitação.', 500)
  if (!atual.data) return jsonErro('PEDIDO_NAO_ENCONTRADO', 'Pedido não encontrado.', 404)
  if (atual.data.fornecedor?.chave !== 'lebebe_exclusive') {
    return jsonErro('FORNECEDOR_NAO_SUPORTADO', 'A criação no SGI está disponível somente para Lebebe Exclusive.', 422)
  }
  if (atual.data.status !== 'VENDA FECHADA') {
    return jsonErro('STATUS_NAO_ELEGIVEL', 'Feche a venda antes de criar o produto no SGI.', 422)
  }
  if (!/^\d{1,6}$/.test(atual.data.numero_lancamento ?? '')) {
    return jsonErro('NUMERO_LANCAMENTO_OBRIGATORIO', 'Informe o número de lançamento comercial antes de continuar.', 422)
  }

  const resultado = await repositorio.solicitarProdutoSgi(pedidoId, acesso.contexto.allowedUser.id)
  if (resultado.error) {
    const mensagem = resultado.error.message ?? ''
    if (mensagem.includes('STATUS_NAO_ELEGIVEL')) {
      return jsonErro('STATUS_NAO_ELEGIVEL', 'Feche a venda antes de criar o produto no SGI.', 422)
    }
    if (mensagem.includes('ITENS_EXCLUSIVE_OBRIGATORIOS')) {
      return jsonErro('ITENS_EXCLUSIVE_OBRIGATORIOS', 'O pedido precisa ter itens Exclusive válidos.', 422)
    }
    if (mensagem.includes('REVISAO_TECNICA_OBRIGATORIA')) {
      return jsonErro('REVISAO_TECNICA_OBRIGATORIA', 'A duplicação ficou indeterminada e exige revisão técnica antes de repetir.', 409)
    }
    return jsonErro('ERRO_INTERNO', 'Não foi possível solicitar a criação no SGI.', 500)
  }

  console.info('[pedidos-personalizados-sgi]', {
    operacao: resultado.data.tentativas > 0 ? 'repetir' : 'solicitar',
    pedidoId,
    usuarioId: acesso.contexto.allowedUser.id,
    status: resultado.data.status_integracao,
    etapa: resultado.data.etapa,
  })

  return NextResponse.json({
    ok: true,
    produtoSgi: serializarIntegracaoProdutoSgi(resultado.data),
  }, { status: resultado.data.status_integracao === 'CONCLUIDO' ? 200 : 202 })
}

async function tokenWorkerValido(request: Request) {
  const recebido = request.headers.get('authorization')
  if (!recebido?.startsWith('Bearer ')) return false
  const token = recebido.slice('Bearer '.length)
  if (token.length < 32 || token.length > 256) return false
  const tokenHash = createHash('sha256').update(token).digest('hex')
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('pedidos_personalizados_lebebe_exclusive_sgi_worker')
    .select('token_sha256')
    .eq('id', 'exclusive_sgi_worker')
    .eq('ativo', true)
    .maybeSingle()
  if (error || !data?.token_sha256) return false
  const esperadoBuffer = Buffer.from(data.token_sha256, 'utf8')
  const tokenBuffer = Buffer.from(tokenHash, 'utf8')
  return esperadoBuffer.length === tokenBuffer.length && timingSafeEqual(esperadoBuffer, tokenBuffer)
}

async function exigirWorker(request: Request) {
  return await tokenWorkerValido(request)
    ? null
    : jsonErro('NAO_AUTORIZADO', 'Não autorizado.', 401)
}

function serializarTrabalho(row: IntegracaoProdutoSgiRow) {
  return {
    pedidoId: row.pedido_id,
    claimToken: row.claim_token,
    status: row.status_integracao,
    etapa: row.etapa,
    modelo: {
      produtoIdSgi: row.modelo_produto_id_sgi,
      nomeEsperado: row.modelo_nome_esperado,
    },
    nomeProduto: row.nome_produto_sgi,
    custo: Number(row.custo_enviado),
    preco: Number(row.preco_enviado),
    produtoIdSgi: row.produto_id_sgi,
    codigoSgi: row.codigo_sgi,
    procedimentoCustoSgi: row.procedimento_custo_sgi,
    numeroLancamentoEntradaSgi: row.numero_lancamento_entrada_sgi,
    documentoEntradaIdSgi: row.documento_entrada_id_sgi,
    procedimentoFinalizacaoSgi: row.procedimento_finalizacao_sgi,
    tabelaPrecoIdSgi: row.tabela_preco_id_sgi,
    itemTabelaPrecoIdSgi: row.item_tabela_preco_id_sgi,
    tentativa: row.tentativas,
  }
}

export async function reivindicarProdutoSgi(request: Request) {
  const erroAutorizacao = await exigirWorker(request)
  if (erroAutorizacao) return erroAutorizacao

  const repositorio = new RepositorioPedidosPersonalizados(createServiceClient())
  const resultado = await repositorio.reivindicarProdutoSgi()
  if (resultado.error) {
    console.error('[pedidos-personalizados-sgi-worker]', {
      operacao: 'reivindicar',
      codigo: resultado.error.code ?? 'ERRO_BANCO',
    })
    return jsonErro('ERRO_INTERNO', 'Não foi possível obter trabalho.', 500)
  }

  return NextResponse.json({
    ok: true,
    trabalho: resultado.data ? serializarTrabalho(resultado.data) : null,
  })
}

function montarCheckpoint(valor: unknown): CheckpointProdutoSgi | null {
  if (!ehObjeto(valor)) return null
  if (!ehUuid(valor.pedidoId) || !ehUuid(valor.claimToken)) return null
  if (!STATUS_CHECKPOINT.includes(valor.status as typeof STATUS_CHECKPOINT[number])) return null
  if (!ETAPAS.includes(valor.etapa as EtapaIntegracaoProdutoSgi)) return null
  if (valor.eventoDetalhes !== undefined && !ehObjeto(valor.eventoDetalhes)) return null

  const camposTexto = [
    'produtoIdSgi', 'codigoSgi', 'procedimentoCustoSgi', 'numeroLancamentoEntradaSgi',
    'documentoEntradaIdSgi', 'procedimentoFinalizacaoSgi', 'tabelaPrecoIdSgi',
    'itemTabelaPrecoIdSgi', 'erroCodigo', 'erroMensagem',
  ] as const
  for (const campo of camposTexto) {
    const limite = campo === 'erroMensagem' ? 500 : 120
    if (textoOpcional(valor[campo], limite) === undefined && valor[campo] !== undefined) return null
  }

  return {
    pedidoId: valor.pedidoId,
    claimToken: valor.claimToken,
    statusIntegracao: valor.status as CheckpointProdutoSgi['statusIntegracao'],
    etapa: valor.etapa as EtapaIntegracaoProdutoSgi,
    produtoIdSgi: textoOpcional(valor.produtoIdSgi, 120),
    codigoSgi: textoOpcional(valor.codigoSgi, 120),
    procedimentoCustoSgi: textoOpcional(valor.procedimentoCustoSgi, 120),
    numeroLancamentoEntradaSgi: textoOpcional(valor.numeroLancamentoEntradaSgi, 120),
    documentoEntradaIdSgi: textoOpcional(valor.documentoEntradaIdSgi, 120),
    procedimentoFinalizacaoSgi: textoOpcional(valor.procedimentoFinalizacaoSgi, 120),
    tabelaPrecoIdSgi: textoOpcional(valor.tabelaPrecoIdSgi, 120),
    itemTabelaPrecoIdSgi: textoOpcional(valor.itemTabelaPrecoIdSgi, 120),
    erroCodigo: textoOpcional(valor.erroCodigo, 80),
    erroMensagem: textoOpcional(valor.erroMensagem, 500),
    eventoDetalhes: valor.eventoDetalhes as Record<string, unknown> | undefined,
  }
}

export async function registrarCheckpointProdutoSgi(request: Request) {
  const erroAutorizacao = await exigirWorker(request)
  if (erroAutorizacao) return erroAutorizacao

  const corpo = await lerJsonLimitado(request)
  if (!corpo.ok) return corpo.response
  const checkpoint = montarCheckpoint(corpo.valor)
  if (!checkpoint) return jsonErro('PAYLOAD_INVALIDO', 'Checkpoint inválido.', 422)

  const repositorio = new RepositorioPedidosPersonalizados(createServiceClient())
  const resultado = await repositorio.registrarCheckpointProdutoSgi(checkpoint)
  if (resultado.error) {
    const mensagem = resultado.error.message ?? ''
    if (mensagem.includes('CLAIM_INVALIDO')) {
      return jsonErro('CLAIM_INVALIDO', 'O trabalho não pertence mais a este worker.', 409)
    }
    if (mensagem.includes('REGRESSAO_DE_ETAPA')) {
      return jsonErro('REGRESSAO_DE_ETAPA', 'Checkpoint anterior ao estado persistido.', 409)
    }
    console.error('[pedidos-personalizados-sgi-worker]', {
      operacao: 'checkpoint',
      pedidoId: checkpoint.pedidoId,
      etapa: checkpoint.etapa,
      codigo: resultado.error.code ?? 'ERRO_BANCO',
    })
    return jsonErro('ERRO_INTERNO', 'Não foi possível persistir o checkpoint.', 500)
  }

  console.info('[pedidos-personalizados-sgi-worker]', {
    operacao: 'checkpoint',
    pedidoId: checkpoint.pedidoId,
    status: resultado.data.status_integracao,
    etapa: resultado.data.etapa,
  })
  return NextResponse.json({ ok: true, produtoSgi: serializarIntegracaoProdutoSgi(resultado.data) })
}
