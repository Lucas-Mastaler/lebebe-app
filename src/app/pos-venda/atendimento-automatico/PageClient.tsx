'use client'

import { useState, useEffect, useCallback } from 'react'
import { Bot, Ban, Unlock, Square, RefreshCw, Search } from 'lucide-react'

function mascararMensagem(msg: string | null): string {
  if (!msg) return '-'
  const digitos = msg.replace(/\D/g, '')
  if (digitos.length === 11 || digitos.length === 14) {
    return '[documento informado]'
  }
  return msg
}

type Sessao = {
  id: string
  digisac_ticket_id: string
  digisac_contact_id: string | null
  telefone: string | null
  cliente_nome: string | null
  status: string
  estado: string
  tipo_solicitacao: string | null
  documento_informado: string | null
  pausa_ate: string | null
  bloqueio_permanente: boolean
  chamou_procurar_datas: boolean
  alterou_agenda: boolean
  motivo_falha: string | null
  ultima_mensagem_cliente: string | null
  ultima_mensagem_bot: string | null
  ultima_mensagem_em: string | null
  metadata: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

type AgendamentoEncontrado = {
  filial_venda: string
  nome_cliente: string
  pedido_venda: string
  data_agenda_google: string
  status_estoque: string
  quanto_tempo_entrega: string
  produtos_pendentes: string
  endereco_cliente: string
  produtos_lancamento: string
  equipe_agenda: string
  pendente_pagamento: string
  cpf_mascarado: string
  tempo_servico: string
  evento_id: string
  calendar_id: string
}

type EventoGrupo = {
  pedido_venda: string
  evento_id: string
  calendar_id: string
  tempo_servico: string
  equipe_agenda: string
  data_agenda_google: string
  endereco_cliente: string
}

type GrupoAgendamento = {
  indice: number
  nome_cliente: string
  cpf_mascarado: string
  data_entrega: string
  endereco_completo: string
  endereco_curto: string
  pedidos_venda: string[]
  produtos: string[]
  tempo_para_entrega: string
  tempo_servico: string
  equipe_agenda: string
  pendente_pagamento: string
  status_estoque: string
  produtos_pendentes: string
  eventos: EventoGrupo[]
  itens_originais: AgendamentoEncontrado[]
}

function resumoPedido(metadata: Record<string, unknown> | null): string {
  if (!metadata) return '-'
  const status = metadata.busca_agenda_status as string | undefined
  if (status === 'erro') return 'Erro na busca'
  if (status === 'nao_encontrado') return 'Não encontrado'
  const totalRegistros = metadata.total_agendamentos_encontrados as number | undefined
  const totalGrupos = metadata.total_grupos_agendamento as number | undefined
  const grupos = metadata.grupos_agendamento as GrupoAgendamento[] | undefined
  if (!totalRegistros || !grupos || grupos.length === 0) return '-'
  if (totalGrupos === 1) {
    const grupo = grupos[0]
    const pedidos = grupo.pedidos_venda.join(', ') || '-'
    return `1 entrega • ${totalRegistros} pedido(s) • Pedidos: ${pedidos} • ${grupo.nome_cliente || '-'} • ${grupo.data_entrega || '-'}`
  }
  return `${totalGrupos} entregas encontradas • escolha necessária`
}

function detalhesPedido(metadata: Record<string, unknown> | null): string {
  if (!metadata) return ''
  const status = metadata.busca_agenda_status as string | undefined
  if (status === 'erro') {
    const erro = metadata.busca_agenda_erro as string | undefined
    return `Erro: ${erro || ''}`
  }
  const grupos = metadata.grupos_agendamento as GrupoAgendamento[] | undefined
  if (!grupos || grupos.length === 0) return ''
  return grupos
    .map(
      (g, i) =>
        `#${i + 1}: Pedidos: ${g.pedidos_venda.join(', ') || '-'} | Data: ${g.data_entrega || '-'} | Endereco: ${g.endereco_curto || '-'} | Produtos: ${g.produtos.slice(0, 3).join('; ') || '-'} | Estoque: ${g.status_estoque || '-'} | Pagamento: ${g.pendente_pagamento || '-'} | Equipe: ${g.equipe_agenda || '-'}`
    )
    .join('\n')
}

function resumoSituacao(metadata: Record<string, unknown> | null): string {
  if (!metadata) return ''
  const totalRegistros = metadata.total_agendamentos_encontrados as number | undefined
  const totalGrupos = metadata.total_grupos_agendamento as number | undefined
  const grupoSelecionado = metadata.grupo_agendamento_selecionado as number | undefined
  const pedidoConfirmado = metadata.pedido_confirmado as boolean | undefined
  const partes: string[] = []
  if (totalRegistros !== undefined) partes.push(`${totalRegistros} registro(s)`)
  if (totalGrupos !== undefined) partes.push(`${totalGrupos} entrega(s)`)
  if (grupoSelecionado !== undefined && grupoSelecionado !== null) partes.push(`grupo ${grupoSelecionado}`)
  const motivoPedidoNegado = metadata.motivo_pedido_negado as string | undefined
  if (motivoPedidoNegado) partes.push('pedido negado')
  const retentativaDocumento = metadata.documento_retentativa_mascarado as string | undefined
  if (retentativaDocumento) partes.push(`novo doc: ${retentativaDocumento}`)
  if (pedidoConfirmado === true) partes.push('confirmado')
  if (pedidoConfirmado === false) partes.push('não confirmado')
  const acao = metadata.acao_alteracao as string | undefined
  if (acao) partes.push(acao)
  const enderecoConfirmado = metadata.endereco_confirmado as boolean | undefined
  if (enderecoConfirmado === true) partes.push('end. confirmado')
  if (enderecoConfirmado === false && acao) partes.push('end. pendente')
  const dataDesejadaBr = metadata.data_desejada_br as string | undefined
  if (dataDesejadaBr) partes.push(`data: ${dataDesejadaBr}`)
  const motivoBloqueio = (metadata.motivo_bloqueio_acao ?? metadata.motivo_bloqueio_data ?? metadata.motivo_bloqueio_endereco) as string | undefined
  if (motivoBloqueio) partes.push(`bloqueio: ${motivoBloqueio}`)
  const consultaStatus = metadata.consulta_datas_status as string | undefined
  if (consultaStatus) partes.push(`consulta: ${consultaStatus}`)
  const totalDatas = metadata.total_datas_disponiveis as number | undefined
  if (typeof totalDatas === 'number') partes.push(`${totalDatas} data(s)`)
  const opcaoSelecionadaBr = metadata.data_opcao_selecionada_br as string | undefined
  if (opcaoSelecionadaBr) partes.push(`selecionada: ${opcaoSelecionadaBr}`)
  const confirmacaoReagendamentoPendente = metadata.confirmacao_reagendamento_pendente as boolean | undefined
  if (confirmacaoReagendamentoPendente === true) partes.push('conf. reagendamento pendente')
  const dataOriginalBr = metadata.data_original_br as string | undefined
  const dataNovaBr = metadata.data_nova_br as string | undefined
  if (dataOriginalBr && dataNovaBr) partes.push(`${dataOriginalBr} -> ${dataNovaBr}`)
  const calendarWriteStatus = metadata.calendar_write_status as string | undefined
  if (calendarWriteStatus) partes.push(`calendar: ${calendarWriteStatus}`)
  const calendarEventosTotal = metadata.calendar_eventos_total as number | undefined
  if (typeof calendarEventosTotal === 'number') partes.push(`${calendarEventosTotal} evento(s)`)
  const calendarErros = metadata.calendar_erros as unknown[] | undefined
  if (calendarErros && calendarErros.length > 0) partes.push(`${calendarErros.length} erro(s) calendar`)
  const motivoTransferencia = metadata.motivo_transferencia_humano as string | undefined
  if (motivoTransferencia) partes.push(`motivo: ${motivoTransferencia}`)
  return partes.join(' • ')
}

const STATUS_COLORS: Record<string, string> = {
  ativa: 'bg-green-100 text-green-800',
  pausado_humano: 'bg-yellow-100 text-yellow-800',
  transferido_humano: 'bg-purple-100 text-purple-800',
  bloqueado_24h: 'bg-orange-100 text-orange-800',
  bloqueado_permanente: 'bg-red-100 text-red-800',
  finalizado: 'bg-slate-100 text-slate-600',
}

export function PageClient() {
  const [sessoes, setSessoes] = useState<Sessao[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filtroStatus, setFiltroStatus] = useState('')
  const [filtroSolicitacao, setFiltroSolicitacao] = useState('')
  const [busca, setBusca] = useState('')
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (filtroStatus) params.set('status', filtroStatus)
      if (filtroSolicitacao) params.set('tipo_solicitacao', filtroSolicitacao)
      if (busca) params.set('busca', busca)

      const res = await fetch(`/api/pos-venda/atendimento-automatico/listar?${params.toString()}`)
      if (!res.ok) throw new Error('Erro ao carregar sessoes')
      const data = await res.json()
      setSessoes(data.sessoes ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
    } finally {
      setLoading(false)
    }
  }, [filtroStatus, filtroSolicitacao, busca])

  useEffect(() => {
    carregar()
  }, [carregar])

  async function executarAcao(sessaoId: string, acao: string) {
    setActionLoading(`${sessaoId}-${acao}`)
    try {
      const res = await fetch(`/api/pos-venda/atendimento-automatico/${sessaoId}/${acao}`, {
        method: 'POST',
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.message ?? 'Erro ao executar acao')
      }
      await carregar()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
    } finally {
      setActionLoading(null)
    }
  }

  function formatarData(data: string | null): string {
    if (!data) return '-'
    return new Date(data).toLocaleString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="w-[95vw] max-w-none mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Bot className="w-7 h-7 text-[#00A5E6]" />
            <div>
              <h1 className="text-xl font-bold text-slate-800">Atendimento Automatico Pos-Venda</h1>
              <p className="text-sm text-slate-500">Bot Mere - Fase 1A (sem resposta automatica)</p>
            </div>
          </div>
          <button
            onClick={carregar}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors text-sm font-medium disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </button>
        </div>

        {/* Filtros */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-500">Status</label>
              <select
                value={filtroStatus}
                onChange={(e) => setFiltroStatus(e.target.value)}
                className="px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 bg-white"
              >
                <option value="">Todos</option>
                <option value="ativa">Ativa</option>
                <option value="pausado_humano">Pausado (Humano)</option>
                <option value="transferido_humano">Transferido Humano</option>
                <option value="bloqueado_24h">Bloqueado 24h</option>
                <option value="bloqueado_permanente">Bloqueado Permanente</option>
                <option value="finalizado">Finalizado</option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-500">Solicitacao</label>
              <select
                value={filtroSolicitacao}
                onChange={(e) => setFiltroSolicitacao(e.target.value)}
                className="px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 bg-white"
              >
                <option value="">Todas</option>
                <option value="confirmar_entrega">Confirmar Entrega</option>
                <option value="alterar_entrega">Alterar Entrega</option>
              </select>
            </div>

            <div className="flex flex-col gap-1 flex-1 min-w-[200px]">
              <label className="text-xs font-medium text-slate-500">Busca (telefone/ticket)</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Buscar por telefone ou ticket..."
                  className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 bg-white"
                />
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Tabela */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-slate-400 text-sm">Carregando...</div>
          ) : sessoes.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-sm">Nenhuma sessao encontrada</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Status</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Estado</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Solicitacao</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Telefone</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Ticket</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Pedido</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Situação</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Resposta Sugerida</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Ult. Msg Cliente</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Documento</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Pausa Ate</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Criado</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Acoes</th>
                  </tr>
                </thead>
                <tbody>
                  {sessoes.map((s) => (
                    <tr key={s.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[s.status] ?? 'bg-slate-100 text-slate-600'}`}>
                          {s.status}
                        </span>
                        {s.bloqueio_permanente && (
                          <span className="ml-1 inline-block px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                            bloqueado
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{s.estado}</td>
                      <td className="px-4 py-3 text-slate-600">{s.tipo_solicitacao ?? '-'}</td>
                      <td className="px-4 py-3 text-slate-600">{s.telefone ?? '-'}</td>
                      <td className="px-4 py-3 text-slate-400 text-xs font-mono">{s.digisac_ticket_id?.substring(0, 12) ?? '-'}</td>
                      <td className="px-4 py-3 text-slate-600 max-w-[220px] truncate whitespace-pre-line" title={detalhesPedido(s.metadata)}>
                        {resumoPedido(s.metadata)}
                      </td>
                      <td className="px-4 py-3 text-slate-600 max-w-[180px] truncate" title={resumoSituacao(s.metadata)}>
                        {resumoSituacao(s.metadata) || '-'}
                      </td>
                      <td className="px-4 py-3 text-slate-600 max-w-[220px]">
                        <div className="truncate" title={String(s.metadata?.resposta_sugerida ?? '')}>
                          {String(s.metadata?.resposta_sugerida ?? '-')}
                        </div>
                        <div className="flex items-center gap-1 mt-1">
                          <span className="text-[10px] uppercase tracking-wide text-slate-400">
                            {String(s.metadata?.resposta_sugerida_tipo ?? '-')}
                          </span>
                          {s.metadata?.resposta_automatica_enviada === true && (
                            <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-100 text-green-700">
                              auto
                            </span>
                          )}
                          {s.metadata?.resposta_automatica_enviada === false && (
                            <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-500">
                              sugerida
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-600 max-w-[200px] truncate" title={mascararMensagem(s.ultima_mensagem_cliente)}>
                        {mascararMensagem(s.ultima_mensagem_cliente)}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {s.documento_informado
                          ? `${s.documento_informado.substring(0, 3)}***`
                          : '-'}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{formatarData(s.pausa_ate)}</td>
                      <td className="px-4 py-3 text-slate-600">{formatarData(s.created_at)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          {s.status !== 'finalizado' && (
                            <button
                              onClick={() => executarAcao(s.id, 'parar')}
                              disabled={actionLoading === `${s.id}-parar`}
                              title="Parar atendimento"
                              className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-500 disabled:opacity-50"
                            >
                              <Square className="w-4 h-4" />
                            </button>
                          )}
                          {s.status !== 'bloqueado_24h' && s.status !== 'bloqueado_permanente' && s.status !== 'finalizado' && (
                            <button
                              onClick={() => executarAcao(s.id, 'bloquear-24h')}
                              disabled={actionLoading === `${s.id}-bloquear-24h`}
                              title="Bloquear 24h"
                              className="p-1.5 rounded-lg hover:bg-orange-100 text-orange-600 disabled:opacity-50"
                            >
                              <Ban className="w-4 h-4" />
                            </button>
                          )}
                          {!s.bloqueio_permanente && s.status !== 'finalizado' && (
                            <button
                              onClick={() => executarAcao(s.id, 'bloquear-cliente')}
                              disabled={actionLoading === `${s.id}-bloquear-cliente`}
                              title="Bloquear cliente permanentemente"
                              className="p-1.5 rounded-lg hover:bg-red-100 text-red-600 disabled:opacity-50"
                            >
                              <Ban className="w-4 h-4" />
                            </button>
                          )}
                          {(s.bloqueio_permanente || s.status === 'bloqueado_24h') && (
                            <button
                              onClick={() => executarAcao(s.id, 'desbloquear-cliente')}
                              disabled={actionLoading === `${s.id}-desbloquear-cliente`}
                              title="Desbloquear cliente"
                              className="p-1.5 rounded-lg hover:bg-green-100 text-green-600 disabled:opacity-50"
                            >
                              <Unlock className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default PageClient
