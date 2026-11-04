import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { requireAtendimentoPresencialHistoricoAccess } from '@/lib/atendimento-presencial/api-auth'
import { requireModuleAccess } from '@/lib/auth/module-access'
import { checkAccessWindowForUser } from '@/lib/auth/access-window'
import { carregarPerfilAtendimento, listarUnidadesDoContexto, isUuid, serializarAtendimentoPresencial, requireAtendimentoPresencialFichaAccess, type AtendimentoPresencialRow } from '@/lib/atendimento-presencial/rascunhos'
import { normalizarTelefone } from '@/lib/atendimento-presencial/telefone'
import { prepararFichaRetorno, validarVendaDigital } from '@/lib/atendimento-presencial/negociacoes'
import { normalizarDetalheParaFichaEdicao, type RegistroAtendimentoDetalheDTO } from '@/lib/atendimento-presencial/registros'
import { normalizarNomeConsultora } from '@/lib/atendimento-presencial/ficha-schema'

export const runtime = 'nodejs'
const erro = (message: string, status: number, field?: string) => NextResponse.json({ ok: false, message, ...(field ? { field } : {}) }, { status })

export async function GET(request: Request) {
  const auth = await requireAtendimentoPresencialHistoricoAccess()
  if (!auth.ok) return auth.response
  const supabase = createServiceClient()
  const perfil = await carregarPerfilAtendimento(supabase, auth.allowedUser)
  if (!perfil) return erro('Perfil não encontrado.', 403)
  const unidades = await listarUnidadesDoContexto(supabase, auth.allowedUser, perfil)
  if (!unidades.length) return erro('Nenhuma filial autorizada.', 403)
  const params = new URL(request.url).searchParams
  if (params.get('telefone')) { const telefone = normalizarTelefone(params.get('telefone')); if (telefone.valido) params.set('telefone', telefone.telefoneNormalizado!) }
  const pagina = Number(params.get('pagina') ?? 1)
  if (!Number.isSafeInteger(pagina) || pagina < 1) return erro('Página inválida.', 400)
  for (const campo of ['origemId', 'clienteId']) if (params.get(campo) && !isUuid(params.get(campo))) return erro('Identificador inválido.', 400)
  for (const campo of ['de', 'ate']) {
    const valor = params.get(campo)
    if (valor && (!/^\d{4}-\d{2}-\d{2}$/.test(valor) || !Number.isFinite(Date.parse(`${valor}T12:00:00Z`)) || new Date(`${valor}T12:00:00Z`).toISOString().slice(0, 10) !== valor)) return erro('Período inválido.', 400)
  }
  const { data, error } = await supabase.rpc('atendimento_presencial_negociacoes_buscar', {
    p_executor: auth.allowedUser.id, p_pagina: pagina, p_filtros: Object.fromEntries(params),
  })
  if (error) {
    console.error('[NEGOCIACOES GET]', { code: error.code })
    if (error.code === '42501') return erro('Sem permissão para consultar negociações.', 403)
    if (['23514', '22P02', '22007', '22008'].includes(error.code)) return erro('Revise os filtros da consulta.', 400)
    return erro(error.code === 'PGRST202' ? 'A estrutura de negociações ainda não está instalada neste ambiente.' : 'Não foi possível consultar as negociações.', 503)
  }
  const mutacao = await autorizarMutacao()
  const ficha = await requireAtendimentoPresencialFichaAccess()
  return NextResponse.json({ ok: true, ...data, unidades, podeGerir: mutacao.ok, podeCriarRetorno: ficha.ok }, { headers: { 'Cache-Control': 'private, no-store' } })
}

async function autorizarMutacao() {
  for (const chave of ['atendimento_presencial_ficha', 'atendimento_presencial_registros'] as const) {
    const auth = await requireModuleAccess(chave)
    if (!auth.ok) {
      if (auth.response.status === 401 || auth.response.status >= 500) return auth
      continue
    }
    const janela = await checkAccessWindowForUser({ usuarioId: auth.allowedUser.id, role: auth.allowedUser.role as 'user' | 'superadmin' })
    if (!janela.ok) return { ok: false as const, response: erro('Fora da janela de acesso.', 403) }
    return auth
  }
  return { ok: false as const, response: erro('Sem permissão para atualizar negociações.', 403) }
}

export async function POST(request: Request) {
  const auth = await autorizarMutacao()
  if (!auth.ok) return auth.response
  let valor: unknown
  try { valor = await request.json() } catch { return erro('Pedido inválido.', 400) }
  if (!valor || typeof valor !== 'object' || Array.isArray(valor)) return erro('Pedido inválido.', 400)
  const p = valor as Record<string, unknown>
  if (!isUuid(p.origemId) || !isUuid(p.operacaoId)) return erro('Identifique a negociação e a operação.', 422)
  const supabase = createServiceClient()
  let rpc: string
  let args: Record<string, unknown>
  if (p.acao === 'retorno') {
    const fichaAccess = await requireAtendimentoPresencialFichaAccess()
    if (!fichaAccess.ok) return fichaAccess.response
    if (!isUuid(p.unidadeId) || typeof p.consultora !== 'string' || !normalizarNomeConsultora(p.consultora)) return erro('Confirme a filial e a consultora do retorno.', 422)
    const resultados = await Promise.all([
      supabase.from('atendimento_presencial_atendimentos').select('*').eq('id', p.origemId).eq('status', 'concluido').single(),
      supabase.from('atendimento_presencial_criancas').select('*').eq('atendimento_id', p.origemId).order('ordem'),
      supabase.from('atendimento_presencial_departamentos').select('*').eq('atendimento_id', p.origemId).order('ordem'),
      supabase.from('atendimento_presencial_produtos_interesse').select('*').eq('atendimento_id', p.origemId).order('ordem'),
    ])
    if (resultados.some(r => r.error)) return erro('Não foi possível preparar o retorno.', 503)
    if (!resultados[0].data) return erro('Atendimento de origem não encontrado.', 404)
    const atendimento = serializarAtendimentoPresencial(resultados[0].data as AtendimentoPresencialRow)
    if (atendimento.resultadoAtendimento !== 'negociacao') return erro('Selecione um atendimento em negociação.', 422)
    const detalhe = { atendimento, criancas: resultados[1].data, departamentos: resultados[2].data, produtosInteresse: resultados[3].data, motivos: [] } as Pick<RegistroAtendimentoDetalheDTO, 'atendimento' | 'criancas' | 'departamentos' | 'produtosInteresse' | 'motivos'>
    const ficha = prepararFichaRetorno(normalizarDetalheParaFichaEdicao(detalhe))
    ficha.consultoraNome = normalizarNomeConsultora(p.consultora)
    rpc = 'atendimento_presencial_negociacao_criar_retorno'
    args = { p_origem: p.origemId, p_executor: auth.allowedUser.id, p_operacao: p.operacaoId, p_unidade: p.unidadeId, p_dados: ficha }
  } else if (p.acao === 'corrigir_vinculo') {
    if (!isUuid(p.novaOrigemId) || !Number.isInteger(p.version) || !Number.isInteger(p.novaVersion) || typeof p.motivo !== 'string' || p.motivo.trim().length < 2) return erro('Selecione a negociação correta e informe o motivo.', 422)
    rpc = 'atendimento_presencial_negociacao_corrigir_vinculo'
    args = { p_origem: p.origemId, p_nova_origem: p.novaOrigemId, p_executor: auth.allowedUser.id, p_operacao: p.operacaoId, p_version: p.version, p_nova_version: p.novaVersion, p_motivo: p.motivo }
  } else if (p.acao === 'perda' || p.acao === 'desvincular') {
    if (!Number.isInteger(p.version) || !p.dados || typeof p.dados !== 'object' || Array.isArray(p.dados)) return erro('Revise o motivo e a versão.', 422)
    rpc = 'atendimento_presencial_negociacao_encerrar'
    args = { p_origem: p.origemId, p_executor: auth.allowedUser.id, p_operacao: p.operacaoId, p_version: p.version, p_acao: p.acao, p_dados: p.dados }
  } else if (p.acao === 'vincular') {
    if (!isUuid(p.vendaId) || !Number.isInteger(p.version)) return erro('Identifique a venda e a versão.', 422)
    rpc = 'atendimento_presencial_negociacao_vincular'
    args = { p_origem: p.origemId, p_venda: p.vendaId, p_executor: auth.allowedUser.id, p_operacao: p.operacaoId, p_version: p.version }
  } else if (['rascunho', 'concluir', 'corrigir', 'anular'].includes(String(p.acao))) {
    if (!isUuid(p.id) || !Number.isInteger(p.version) || Number(p.version) < 0) return erro('Identifique a venda digital e sua versão.', 422)
    let dados: unknown = p.dados
    if (p.acao === 'concluir' || p.acao === 'corrigir') {
      const validacao = validarVendaDigital(dados)
      if (!validacao.ok) return erro(validacao.message, 422, validacao.field)
      dados = validacao.dados
    }
    if (p.acao === 'anular' || p.acao === 'corrigir') {
      if (typeof p.motivo !== 'string' || p.motivo.trim().length < 2 || p.motivo.length > 2000) return erro('Informe o motivo da alteração.', 422, 'motivo')
    }
    if (!dados || typeof dados !== 'object' || Array.isArray(dados)) return erro('Revise os dados da venda digital.', 422)
    rpc = 'atendimento_presencial_negociacao_digital'
    args = { p_origem: p.origemId, p_executor: auth.allowedUser.id, p_operacao: p.operacaoId, p_acao: p.acao, p_id: p.id, p_version: p.version, p_dados: dados, p_motivo: p.motivo ?? null }
  } else {
    return erro('Operação não disponível.', 422)
  }
  const { data, error } = await supabase.rpc(rpc, args)
  if (error) {
    console.error('[NEGOCIACOES POST]', { action: p.acao, code: error.code, origem: p.origemId })
    if (error.code === '42501') return erro('Sem permissão para esta operação.', 403)
    if (error.code === 'P0003' || error.code === '23505') return erro('A negociação foi atualizada ou já possui encerramento. Seus dados foram preservados; consulte o estado atual.', 409)
    if (['23514', '22P02', '22007', '22008', '22003'].includes(error.code)) return erro('Os dados não são compatíveis com esta negociação. Revise a cliente, a venda e o lançamento.', 422)
    return erro('Não foi possível salvar a operação.', 503)
  }
  return NextResponse.json({ ok: true, resultado: data }, { headers: { 'Cache-Control': 'private, no-store' } })
}
