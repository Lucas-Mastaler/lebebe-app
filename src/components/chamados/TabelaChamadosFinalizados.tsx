"use client";

import { Alert, Badge, Button, Card, CardContent, CardHeader, EmptyState, ResponsiveTable, type ResponsiveTableColumn } from "@/components/design-system";
import { ChevronLeft, ChevronRight, Inbox, SearchX } from "lucide-react";
import { PesquisaChamadosResponse, ChamadoFinalizadoItem } from "@/types";
import { CelulaObservacao } from "@/components/chamados/CelulaObservacao";

interface Props {
  data: PesquisaChamadosResponse | null;
  isLoading: boolean;
  error: string | null;
  onPageChange: (page: number) => void;
  onVerAgendamentos: (contactId: string, nomeDigisac: string | null | undefined) => void;
  observacoes: Record<string, string>;
  onSalvarObservacao: (contactId: string, observacao: string) => Promise<void>;
}

function statusTone(status: string): 'success' | 'neutral' {
  return status === 'Aberta' ? 'success' : 'neutral';
}

function DesktopMobileValue({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-slate-400">{label}</p>
      <div className="text-sm text-slate-700">{value}</div>
    </div>
  );
}

export function TabelaChamadosFinalizados({ data, isLoading, error, onPageChange, onVerAgendamentos, observacoes, onSalvarObservacao }: Props) {
  if (error) {
    return (
      <Alert tone="danger" title="Não foi possível pesquisar os chamados.">
        {error}
      </Alert>
    );
  }

  if (!isLoading && !data) {
    return <EmptyState icon={<Inbox className="size-5" />} title="Nenhuma pesquisa realizada" description="Use os filtros acima para pesquisar chamados." />;
  }

  if (!isLoading && data && (data.items?.length || 0) === 0) {
    return <EmptyState icon={<SearchX className="size-5" />} title="Nenhum resultado" description="Nenhum resultado para os filtros selecionados." />;
  }

  const meta = data?.meta;

  const columns: ResponsiveTableColumn<ChamadoFinalizadoItem>[] = [
    { key: 'nomeDigisac', header: 'Nome Digisac', width: 'content', className: 'font-medium text-slate-700', render: (item) => item.nomeDigisac || '-' },
    { key: 'loja', header: 'Loja', width: 'standard', render: (item) => item.loja || '-' },
    { key: 'consultora', header: 'Consultora', width: 'standard', render: (item) => item.consultora || '-' },
    {
      key: 'mensagens',
      header: 'Mensagens agendadas',
      width: 'compact',
      render: (item) => (
        <Button variant="secondary" size="sm" onClick={() => onVerAgendamentos(item.contactId, item.nomeDigisac)}>
          Ver agendamentos
        </Button>
      ),
    },
    {
      key: 'statusConversa',
      header: 'Status da conversa',
      width: 'compact',
      render: (item) => <Badge tone={statusTone(item.statusConversa)}>{item.statusConversa}</Badge>,
    },
    { key: 'tags', header: 'Tags', width: 'wide', render: (item) => <span title={item.tags}>{item.tags || '-'}</span> },
    { key: 'total', header: 'Qtd (total)', width: 'compact', render: (item) => <Badge tone="neutral">{item.qtdAgendamentosTotal}</Badge> },
    { key: 'abertos', header: 'Qtd (em aberto)', width: 'compact', render: (item) => <Badge tone="success">{item.qtdAgendamentosAbertos}</Badge> },
    { key: 'finalizados', header: 'Qtd (finalizados)', width: 'compact', render: (item) => <Badge tone="info">{item.qtdAgendamentosFinalizados}</Badge> },
    { key: 'erro', header: 'Qtd (erro)', width: 'compact', render: (item) => <Badge tone="danger">{item.qtdAgendamentosErro}</Badge> },
    {
      key: 'observacao',
      header: 'Observação',
      width: 'standard',
      render: (item) => <CelulaObservacao contactId={item.contactId} valor={observacoes[item.contactId] || ''} onSalvar={onSalvarObservacao} />,
    },
  ];

  return (
    <div className="space-y-4">
      <Card>
        {!isLoading && meta && (
          <CardHeader
            title="Resultados"
            action={
              <Badge tone="neutral">
                {meta.total} {meta.total === 1 ? 'item' : 'itens'}
              </Badge>
            }
          />
        )}
        <CardContent className="p-0 sm:p-0">
          <div className="p-3">
            <ResponsiveTable<ChamadoFinalizadoItem>
              columns={columns}
              rows={data?.items ?? []}
              rowKey={(item) => item.contactId}
              rowTone={(item) => (item.qtdAgendamentosAbertos === 0 ? 'dangerSubtle' : undefined)}
              stickyHeader
              firstColumnSticky
              loading={isLoading}
              renderMobileCard={(item) => (
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-slate-800">{item.nomeDigisac || '-'}</p>
                    <Badge tone={statusTone(item.statusConversa)}>{item.statusConversa}</Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <DesktopMobileValue label="Loja" value={item.loja || '-'} />
                    <DesktopMobileValue label="Consultora" value={item.consultora || '-'} />
                    <DesktopMobileValue label="Tags" value={item.tags || '-'} />
                    <DesktopMobileValue
                      label="Agendamentos"
                      value={
                        <div className="flex flex-wrap gap-1">
                          <Badge tone="neutral">total {item.qtdAgendamentosTotal}</Badge>
                          <Badge tone="success">aberto {item.qtdAgendamentosAbertos}</Badge>
                          <Badge tone="info">final. {item.qtdAgendamentosFinalizados}</Badge>
                          <Badge tone="danger">erro {item.qtdAgendamentosErro}</Badge>
                        </div>
                      }
                    />
                  </div>
                  <div>
                    <p className="mb-1 text-[10px] uppercase tracking-wide text-slate-400">Observação</p>
                    <CelulaObservacao contactId={item.contactId} valor={observacoes[item.contactId] || ''} onSalvar={onSalvarObservacao} />
                  </div>
                  <Button variant="secondary" size="sm" className="w-full" onClick={() => onVerAgendamentos(item.contactId, item.nomeDigisac)}>
                    Ver agendamentos
                  </Button>
                </div>
              )}
            />
          </div>
        </CardContent>
      </Card>

      {!isLoading && meta && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-600">
            Página {meta.currentPage} de {meta.lastPage}
          </p>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => onPageChange(meta.currentPage - 1)} disabled={meta.currentPage <= 1}>
              <ChevronLeft className="size-4" />
              Anterior
            </Button>
            <Button variant="secondary" size="sm" onClick={() => onPageChange(meta.currentPage + 1)} disabled={meta.currentPage >= meta.lastPage}>
              Próxima
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
