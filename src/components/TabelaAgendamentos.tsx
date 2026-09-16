'use client'

import { useMemo, useState } from 'react'
import { Badge, Button, Dialog, DialogBody, DialogContent, DialogHeader, EmptyState, KpiCard, ResponsiveTable } from '@/components/design-system'
import type { Agendamento, PesquisaResponse } from '@/types'

interface TabelaAgendamentosProps {
  data: PesquisaResponse | null
  isLoading: boolean
  error: string | null
  clienteNomeFiltro: string
  onPageChange: (page: number) => void
}

const STATUS_TONES = {
  info: 'info',
  success: 'success',
  destructive: 'danger',
} as const

function TextCell({ text, onViewFull }: { text: string; onViewFull: (content: string) => void }) {
  if (!text) return <span className="text-muted-foreground">—</span>

  return (
    <Button type="button" variant="ghost" size="sm" className="h-auto max-w-full justify-start p-0 text-left font-normal whitespace-normal hover:text-primary" onClick={() => onViewFull(text)}>
      <span className="line-clamp-2">{text}</span>
    </Button>
  )
}

function MobileAgendamentoCard({ item, onViewFull }: { item: Agendamento; onViewFull: (content: string) => void }) {
  const statusTone = STATUS_TONES[item.statusBadgeVariant] ?? 'neutral'
  return (
    <div className="space-y-2 text-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0"><p className="font-semibold text-foreground">{item.nomeWhatsapp || item.nomeDigisac || '—'}</p><p className="text-xs text-muted-foreground">{item.loja || '—'} · {item.consultora || '—'}</p></div>
        <Badge tone={statusTone}>{item.statusLabel}</Badge>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs"><div><p className="text-muted-foreground">Agendado</p><p>{item.agendadoDia} {item.agendadoHora || ''}</p></div><div><p className="text-muted-foreground">Status chamado</p><Badge tone={item.statusChamado === 'Aberto' ? 'warning' : 'neutral'}>{item.statusChamado || '—'}</Badge></div><div><p className="text-muted-foreground">Abrir ticket?</p><p>{item.abrirTicketLabel}</p></div><div><p className="text-muted-foreground">Notificar?</p><p>{item.notificarLabel}</p></div></div>
      {item.mensagemAgendada && <TextCell text={item.mensagemAgendada} onViewFull={onViewFull} />}
    </div>
  )
}

export function TabelaAgendamentos({ data, isLoading, error, clienteNomeFiltro, onPageChange }: TabelaAgendamentosProps) {
  const [modalContent, setModalContent] = useState<string | null>(null)
  const filteredItems = useMemo(() => {
    const items = data?.items ?? []
    if (!clienteNomeFiltro.trim()) return items
    const searchTerm = clienteNomeFiltro.toLowerCase().trim()
    return items.filter((item) => item.nomeWhatsapp?.toLowerCase().includes(searchTerm) || item.nomeDigisac?.toLowerCase().includes(searchTerm))
  }, [data?.items, clienteNomeFiltro])

  if (!data && !isLoading && !error) {
    return <EmptyState title="Faça uma pesquisa para ver os agendamentos" description="Preencha ao menos um período completo e clique em Filtrar." />
  }

  const columns = [
    { key: 'loja', header: 'Loja', width: 'content' as const, render: (item: Agendamento) => item.loja || '—' },
    { key: 'consultora', header: 'Consultora', width: 'standard' as const, render: (item: Agendamento) => item.consultora || '—' },
    { key: 'nomeWhatsapp', header: 'Nome WhatsApp', width: 'content' as const, render: (item: Agendamento) => item.nomeWhatsapp || '—' },
    { key: 'nomeDigisac', header: 'Nome Digisac', width: 'content' as const, render: (item: Agendamento) => item.nomeDigisac || '—' },
    { key: 'mensagem', header: 'Mensagem agendada', width: 'fill' as const, render: (item: Agendamento) => <TextCell text={item.mensagemAgendada} onViewFull={setModalContent} /> },
    { key: 'comentario', header: 'Comentário', width: 'wide' as const, render: (item: Agendamento) => <TextCell text={item.comentario} onViewFull={setModalContent} /> },
    { key: 'tags', header: 'Tags', width: 'wide' as const, render: (item: Agendamento) => <TextCell text={item.tags} onViewFull={setModalContent} /> },
    { key: 'status', header: 'Status', width: 'compact' as const, render: (item: Agendamento) => <Badge tone={STATUS_TONES[item.statusBadgeVariant] ?? 'neutral'}>{item.statusLabel}</Badge> },
    { key: 'statusChamado', header: 'Status chamado', width: 'compact' as const, render: (item: Agendamento) => <Badge tone={item.statusChamado === 'Aberto' ? 'warning' : 'neutral'}>{item.statusChamado || '—'}</Badge> },
    { key: 'ultimoChamado', header: 'Último chamado fechado', width: 'compact' as const, render: (item: Agendamento) => item.ultimoChamadoFechado || '—' },
    { key: 'abrirTicket', header: 'Abrir ticket?', width: 'compact' as const, render: (item: Agendamento) => item.abrirTicketLabel },
    { key: 'notificar', header: 'Notificar?', width: 'compact' as const, render: (item: Agendamento) => item.notificarLabel },
    { key: 'agendadoDia', header: 'Agendado (dia)', width: 'compact' as const, render: (item: Agendamento) => item.agendadoDia },
    { key: 'agendadoHora', header: 'Agendado (hora)', width: 'compact' as const, render: (item: Agendamento) => item.agendadoHora || '—' },
    { key: 'criadoEm', header: 'Criado em', width: 'compact' as const, render: (item: Agendamento) => item.criadoEm },
    { key: 'atualizadoEm', header: 'Atualizado em', width: 'compact' as const, render: (item: Agendamento) => item.atualizadoEm },
  ]

  return (
    <div className="space-y-4">
      {data && <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold text-foreground">Resultados</h2><KpiCard className="w-36" label="Agendamentos" value={data.meta.total} /></div>}
      <ResponsiveTable
        columns={columns}
        rows={filteredItems}
        rowKey={(item) => item.id}
        firstColumnSticky
        loading={isLoading}
        error={error ?? undefined}
        emptyTitle={clienteNomeFiltro ? 'Nenhum resultado para o nome informado' : 'Nenhum resultado para os filtros selecionados'}
        renderMobileCard={(item) => <MobileAgendamentoCard item={item} onViewFull={setModalContent} />}
      />
      {data && data.meta.lastPage > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
          <span>Página {data.meta.currentPage} de {data.meta.lastPage}</span>
          <div className="flex items-center gap-2"><Button variant="secondary" size="sm" onClick={() => onPageChange(data.meta.currentPage - 1)} disabled={data.meta.currentPage <= 1}>Anterior</Button><Button variant="secondary" size="sm" onClick={() => onPageChange(data.meta.currentPage + 1)} disabled={data.meta.currentPage >= data.meta.lastPage}>Próxima</Button></div>
        </div>
      )}
      <Dialog open={modalContent !== null} onOpenChange={(open) => { if (!open) setModalContent(null) }}>
        <DialogContent className="max-w-2xl"><DialogHeader title="Visualização completa" description="Conteúdo completo do agendamento" /><DialogBody><p className="leading-relaxed whitespace-pre-wrap text-foreground">{modalContent}</p></DialogBody></DialogContent>
      </Dialog>
    </div>
  )
}
