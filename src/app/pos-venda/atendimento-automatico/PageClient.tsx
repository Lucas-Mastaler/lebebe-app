'use client'

import { useState, useEffect, useCallback } from 'react'
import { Bot, Ban, Unlock, Square, RefreshCw, Search } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  PageContainer, PageHeader, FilterPanel, FilterFieldGroup, useFilterState, FormField,
  Input, Button, IconButton, Badge, Alert, ResponsiveTable,
} from '@/components/design-system'

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

/**
 * Mapeamento para os tons semânticos do Badge oficial (STA=A) — o DS tem 6
 * tons (`neutral`/`success`/`warning`/`danger`/`info`/`brand`), a tela
 * original tinha 6 cores ad hoc distintas (incluindo laranja e roxo, que o
 * DS não tem). `pausado_humano` e `bloqueado_24h` acabam dividindo o tom
 * `warning` — lacuna registrada, mesmo padrão já aceito para `Section` (só
 * 3 tons) em `/atendimento-presencial/ficha`.
 */
const STATUS_TONE: Record<string, 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'brand'> = {
  ativa: 'success',
  pausado_humano: 'warning',
  transferido_humano: 'info',
  bloqueado_24h: 'warning',
  bloqueado_permanente: 'danger',
  finalizado: 'neutral',
}

type FiltrosAtendimentoAutomatico = {
  status: string
  tipoSolicitacao: string
  busca: string
}

const FILTROS_VAZIOS: FiltrosAtendimentoAutomatico = { status: '', tipoSolicitacao: '', busca: '' }

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

export function PageClient() {
  const [sessoes, setSessoes] = useState<Sessao[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const filtros = useFilterState<FiltrosAtendimentoAutomatico>(FILTROS_VAZIOS)

  const buscar = useCallback(async (valores: FiltrosAtendimentoAutomatico) => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (valores.status) params.set('status', valores.status)
      if (valores.tipoSolicitacao) params.set('tipo_solicitacao', valores.tipoSolicitacao)
      if (valores.busca) params.set('busca', valores.busca)

      const res = await fetch(`/api/pos-venda/atendimento-automatico/listar?${params.toString()}`)
      if (!res.ok) throw new Error('Erro ao carregar sessoes')
      const data = await res.json()
      setSessoes(data.sessoes ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
    } finally {
      setLoading(false)
    }
  }, [])

  const carregar = useCallback(() => buscar(filtros.applied), [buscar, filtros.applied])

  useEffect(() => {
    carregar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function aplicarFiltros() {
    filtros.apply()
    void buscar(filtros.draft)
  }

  function limparFiltros() {
    filtros.clear()
    void buscar(FILTROS_VAZIOS)
  }

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

  return (
    <PageContainer>
      <PageHeader
        icon={<Bot className="size-6" />}
        eyebrow="Pós-venda"
        title="Atendimento Automático Pós-Venda"
        description="Bot Mere — Fase 1A (sem resposta automática)"
        action={
          <Button variant="secondary" onClick={carregar} loading={loading}>
            <RefreshCw className="size-4" />
            Atualizar
          </Button>
        }
      />

      <div className="mt-6">
        <FilterPanel dirty={filtros.dirty} onApply={aplicarFiltros} onClear={limparFiltros}>
          <FilterFieldGroup label="Filtros">
            <FormField id="filtro-status" label="Status">
              {(f) => (
                <Select value={filtros.draft.status || 'TODOS'} onValueChange={(v) => filtros.setField('status', v === 'TODOS' ? '' : v)}>
                  <SelectTrigger id={f.id} className="w-full" aria-invalid={f['aria-invalid']}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TODOS">Todos</SelectItem>
                    <SelectItem value="ativa">Ativa</SelectItem>
                    <SelectItem value="pausado_humano">Pausado (Humano)</SelectItem>
                    <SelectItem value="transferido_humano">Transferido Humano</SelectItem>
                    <SelectItem value="bloqueado_24h">Bloqueado 24h</SelectItem>
                    <SelectItem value="bloqueado_permanente">Bloqueado Permanente</SelectItem>
                    <SelectItem value="finalizado">Finalizado</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </FormField>

            <FormField id="filtro-solicitacao" label="Solicitação">
              {(f) => (
                <Select value={filtros.draft.tipoSolicitacao || 'TODAS'} onValueChange={(v) => filtros.setField('tipoSolicitacao', v === 'TODAS' ? '' : v)}>
                  <SelectTrigger id={f.id} className="w-full" aria-invalid={f['aria-invalid']}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TODAS">Todas</SelectItem>
                    <SelectItem value="confirmar_entrega">Confirmar Entrega</SelectItem>
                    <SelectItem value="alterar_entrega">Alterar Entrega</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </FormField>

            <FormField id="busca" label="Busca (telefone/ticket)">
              {(f) => (
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    id={f.id}
                    aria-invalid={f['aria-invalid']}
                    value={filtros.draft.busca}
                    onChange={(e) => filtros.setField('busca', e.target.value)}
                    placeholder="Buscar por telefone ou ticket..."
                    className="pl-9"
                  />
                </div>
              )}
            </FormField>
          </FilterFieldGroup>
        </FilterPanel>
      </div>

      {error && (
        <Alert tone="danger" className="mt-4">
          {error}
        </Alert>
      )}

      <div className="mt-6">
        <ResponsiveTable<Sessao>
          columns={[
            {
              key: 'status',
              header: 'Status',
              width: 'compact',
              render: (s) => (
                <div className="flex flex-wrap items-center gap-1">
                  <Badge tone={STATUS_TONE[s.status] ?? 'neutral'}>{s.status}</Badge>
                  {s.bloqueio_permanente && <Badge tone="danger">bloqueado</Badge>}
                </div>
              ),
            },
            { key: 'estado', header: 'Estado', width: 'compact', render: (s) => s.estado },
            { key: 'tipo_solicitacao', header: 'Solicitação', width: 'compact', render: (s) => s.tipo_solicitacao ?? '-' },
            { key: 'telefone', header: 'Telefone', width: 'compact', render: (s) => s.telefone ?? '-' },
            {
              key: 'ticket',
              header: 'Ticket',
              width: 'compact',
              className: 'font-mono text-xs text-slate-400',
              render: (s) => s.digisac_ticket_id?.substring(0, 12) ?? '-',
            },
            {
              key: 'pedido',
              header: 'Pedido',
              className: 'max-w-[220px] truncate whitespace-pre-line',
              render: (s) => <span title={detalhesPedido(s.metadata)}>{resumoPedido(s.metadata)}</span>,
            },
            {
              key: 'situacao',
              header: 'Situação',
              className: 'max-w-[180px] truncate',
              render: (s) => <span title={resumoSituacao(s.metadata)}>{resumoSituacao(s.metadata) || '-'}</span>,
            },
            {
              key: 'resposta_sugerida',
              header: 'Resposta Sugerida',
              className: 'max-w-[220px]',
              render: (s) => (
                <div>
                  <div className="truncate" title={String(s.metadata?.resposta_sugerida ?? '')}>
                    {String(s.metadata?.resposta_sugerida ?? '-')}
                  </div>
                  <div className="mt-1 flex items-center gap-1">
                    <span className="text-[10px] uppercase tracking-wide text-slate-400">
                      {String(s.metadata?.resposta_sugerida_tipo ?? '-')}
                    </span>
                    {s.metadata?.resposta_automatica_enviada === true && <Badge tone="success">auto</Badge>}
                    {s.metadata?.resposta_automatica_enviada === false && <Badge tone="neutral">sugerida</Badge>}
                  </div>
                </div>
              ),
            },
            {
              key: 'ultima_mensagem_cliente',
              header: 'Ult. Msg Cliente',
              className: 'max-w-[200px] truncate',
              render: (s) => <span title={mascararMensagem(s.ultima_mensagem_cliente)}>{mascararMensagem(s.ultima_mensagem_cliente)}</span>,
            },
            {
              key: 'documento',
              header: 'Documento',
              width: 'compact',
              render: (s) => (s.documento_informado ? `${s.documento_informado.substring(0, 3)}***` : '-'),
            },
            { key: 'pausa_ate', header: 'Pausa Até', width: 'compact', render: (s) => formatarData(s.pausa_ate) },
            { key: 'criado', header: 'Criado', width: 'compact', render: (s) => formatarData(s.created_at) },
          ]}
          rows={sessoes}
          rowKey={(s) => s.id}
          firstColumnSticky
          loading={loading}
          emptyTitle="Nenhuma sessão encontrada"
          rowActions={(s) => (
            <div className="flex items-center justify-end gap-1">
              {s.status !== 'finalizado' && (
                <IconButton
                  variant="ghost"
                  aria-label="Parar atendimento"
                  title="Parar atendimento"
                  loading={actionLoading === `${s.id}-parar`}
                  onClick={() => executarAcao(s.id, 'parar')}
                >
                  <Square className="size-4" />
                </IconButton>
              )}
              {s.status !== 'bloqueado_24h' && s.status !== 'bloqueado_permanente' && s.status !== 'finalizado' && (
                <IconButton
                  variant="ghost"
                  aria-label="Bloquear 24h"
                  title="Bloquear 24h"
                  loading={actionLoading === `${s.id}-bloquear-24h`}
                  className="text-orange-600 hover:bg-orange-100"
                  onClick={() => executarAcao(s.id, 'bloquear-24h')}
                >
                  <Ban className="size-4" />
                </IconButton>
              )}
              {!s.bloqueio_permanente && s.status !== 'finalizado' && (
                <IconButton
                  variant="ghost"
                  aria-label="Bloquear cliente permanentemente"
                  title="Bloquear cliente permanentemente"
                  loading={actionLoading === `${s.id}-bloquear-cliente`}
                  className="text-red-600 hover:bg-red-100"
                  onClick={() => executarAcao(s.id, 'bloquear-cliente')}
                >
                  <Ban className="size-4" />
                </IconButton>
              )}
              {(s.bloqueio_permanente || s.status === 'bloqueado_24h') && (
                <IconButton
                  variant="ghost"
                  aria-label="Desbloquear cliente"
                  title="Desbloquear cliente"
                  loading={actionLoading === `${s.id}-desbloquear-cliente`}
                  className="text-green-600 hover:bg-green-100"
                  onClick={() => executarAcao(s.id, 'desbloquear-cliente')}
                >
                  <Unlock className="size-4" />
                </IconButton>
              )}
            </div>
          )}
          renderMobileCard={(s) => (
            <div className="space-y-1.5 text-sm">
              <div className="flex flex-wrap items-center gap-1">
                <Badge tone={STATUS_TONE[s.status] ?? 'neutral'}>{s.status}</Badge>
                {s.bloqueio_permanente && <Badge tone="danger">bloqueado</Badge>}
              </div>
              <p className="font-medium text-slate-800">{s.telefone ?? '-'}</p>
              <p className="text-xs text-slate-500">
                {s.estado} • {s.tipo_solicitacao ?? '-'}
              </p>
              <p className="text-xs text-slate-500" title={detalhesPedido(s.metadata)}>
                {resumoPedido(s.metadata)}
              </p>
              {resumoSituacao(s.metadata) && <p className="text-xs text-slate-500">{resumoSituacao(s.metadata)}</p>}
              <p className="text-xs text-slate-500" title={mascararMensagem(s.ultima_mensagem_cliente)}>
                Msg: {mascararMensagem(s.ultima_mensagem_cliente)}
              </p>
              <p className="text-xs text-slate-400">
                Criado: {formatarData(s.created_at)} • Pausa até: {formatarData(s.pausa_ate)}
              </p>
            </div>
          )}
        />
      </div>
    </PageContainer>
  )
}

export default PageClient
