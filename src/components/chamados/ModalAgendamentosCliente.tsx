'use client';

import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogBody,
} from '@/components/design-system/Dialog';
import { Badge, ResponsiveTable, type ResponsiveTableColumn } from '@/components/design-system';
import { Skeleton } from '@/components/ui/skeleton';
import { AgendamentoContatoItem } from '@/types';

interface Props {
  contactId: string | null;
  nomeDigisac?: string | null;
  open: boolean;
  onClose: () => void;
}

/**
 * Status do agendamento — mesmo mapeamento de tom já usado pela tabela
 * principal da tela (`TabelaChamadosFinalizados`: aberto=success,
 * finalizado=info, erro=danger), agora via `Badge` oficial em vez de
 * classes de cor soltas.
 */
function statusTone(status: string): 'danger' | 'info' | 'success' {
  if (status === 'error' || status === 'canceled') return 'danger';
  if (status === 'done') return 'info';
  return 'success';
}

function statusLabel(item: AgendamentoContatoItem): string {
  if (item.statusLabel) return item.statusLabel;
  if (item.status === 'error' || item.status === 'canceled') return 'Erro';
  if (item.status === 'done') return 'Finalizado';
  return 'Agendado';
}

export function ModalAgendamentosCliente({ contactId, nomeDigisac, open, onClose }: Props) {
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<AgendamentoContatoItem[]>([]);

  useEffect(() => {
    if (!open || !contactId) return;

    console.log(`[UI][MODAL] contactId=${contactId} carregando agendamentos`);
    setLoading(true);
    setItems([]);

    (async () => {
      try {
        const res = await fetch(`/api/chamados-finalizados/agendamentos?contactId=${contactId}`);
        const data = await res.json();
        setItems(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error('Falha ao carregar agendamentos do cliente', e);
      } finally {
        setLoading(false);
      }
    })();
  }, [open, contactId]);

  const columns: ResponsiveTableColumn<AgendamentoContatoItem>[] = [
    { key: 'idx', header: '#', width: 'compact', render: (item) => items.indexOf(item) + 1 },
    { key: 'message', header: 'Texto agendamento', width: 'fill', render: (item) => <div className="whitespace-pre-wrap break-words">{item.message || '-'}</div> },
    { key: 'status', header: 'Status', width: 'compact', render: (item) => <Badge tone={statusTone(item.status)}>{statusLabel(item)}</Badge> },
    { key: 'createdAt', header: 'Criado em', width: 'compact', render: (item) => item.createdAt || '-' },
    { key: 'scheduledAt', header: 'Executado em', width: 'compact', render: (item) => item.scheduledAt || '-' },
    { key: 'notes', header: 'Comentário', width: 'wide', render: (item) => item.notes || '-' },
  ];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent
        className="max-w-[90vw] sm:max-w-[90vw] max-h-[80vh] rounded-2xl"
        style={{ maxWidth: '90vw', width: '90vw', maxHeight: '80vh' }}
      >
        <DialogHeader
          title={`Agendamentos do cliente — ${(nomeDigisac || '').trim() ? (nomeDigisac || '').trim() : '(Sem nome no Digisac)'}`}
        />

        <DialogBody className="p-2">
          {loading ? (
            <div className="space-y-3">
              {[...Array(6)].map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="py-8 text-center text-slate-500">Nenhum agendamento encontrado.</div>
          ) : (
            <div>
              <ResponsiveTable
                columns={columns}
                rows={items}
                rowKey={(item) => item.id}
                renderMobileCard={(item) => (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <Badge tone={statusTone(item.status)}>{statusLabel(item)}</Badge>
                    </div>
                    <p className="whitespace-pre-wrap break-words text-sm text-slate-700">{item.message || '-'}</p>
                    <p className="text-xs text-slate-500">Criado em {item.createdAt || '-'} · Executado em {item.scheduledAt || '-'}</p>
                    {item.notes && <p className="text-xs text-slate-500">Comentário: {item.notes}</p>}
                  </div>
                )}
              />
              <div className="mt-3 text-xs text-slate-500">
                Legenda: erro = <Badge tone="danger">erro</Badge> · agendado = <Badge tone="success">agendado</Badge> · finalizado = <Badge tone="info">finalizado</Badge>
              </div>
            </div>
          )}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
