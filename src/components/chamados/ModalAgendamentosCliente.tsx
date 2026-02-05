'use client';

import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { AgendamentoContatoItem } from '@/types';

interface Props {
  contactId: string | null;
  nomeDigisac?: string | null;
  open: boolean;
  onClose: () => void;
}

/**
 * =========================================================
 * 1) CLASSES DO BADGE (mais forte)
 * =========================================================
 */
function statusClasses(status: string) {
  if (status === 'error' || status === 'canceled') return 'text-red-800 bg-red-100 border-red-300';
  if (status === 'done') return 'text-blue-800 bg-blue-100 border-blue-300';
  return 'text-green-800 bg-green-100 border-green-300';
}

/**
 * =========================================================
 * 2) FUNDO DA LINHA INTEIRA (mais forte)
 * =========================================================
 */
function rowStatusBgClasses(status: string) {
  if (status === 'error' || status === 'canceled') return 'bg-red-100 hover:bg-red-200';
  if (status === 'done') return 'bg-blue-100 hover:bg-blue-200';
  return 'bg-green-100 hover:bg-green-200';
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

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent
        className="max-w-[90vw] sm:max-w-[90vw] max-h-[80vh] rounded-2xl grid grid-rows-[auto,1fr] overflow-y-auto"
        style={{ maxWidth: '90vw', width: '90vw', maxHeight: '80vh' }}
      >
        {/* HEADER: fixo, sólido, sem “vazar”, e sem brigar com o X */}
        <DialogHeader className="sticky top-0 z-50 bg-white border-b border-slate-200 shadow-sm pr-12">
          <DialogTitle className="text-lg font-semibold text-slate-900 whitespace-pre-wrap break-words">
            Agendamentos do cliente — {(nomeDigisac || '').trim() ? (nomeDigisac || '').trim() : '(Sem nome no Digisac)'}
          </DialogTitle>
        </DialogHeader>

        <div className="p-2">
          {loading ? (
            <div className="space-y-3">
              {[...Array(6)].map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="py-8 text-center text-slate-500">Nenhum agendamento encontrado.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm table-fixed border border-slate-200 border-collapse">
                <thead>
                  <tr className="text-left text-slate-700 bg-slate-100">
                    <th className="px-3 py-2 w-12 border border-slate-200">#</th>
                    <th className="px-3 py-2 w-[70%] border border-slate-200">Texto agendamento</th>
                    <th className="px-3 py-2 w-28 border border-slate-200">Status</th>
                    <th className="px-3 py-2 border border-slate-200">Criado em</th>
                    <th className="px-3 py-2 border border-slate-200">Executado em</th>
                    <th className="px-3 py-2 border border-slate-200">Comentário</th>
                  </tr>
                </thead>

                <tbody>
                  {items.map((it, idx) => (
                    <tr
                      key={it.id}
                      className={`align-top transition-colors ${rowStatusBgClasses(it.status)}`}
                    >
                      {/* bg-transparent garante que o bg do TR apareça sempre */}
                      <td className="px-3 py-2 text-slate-700 whitespace-nowrap border border-slate-200 bg-transparent">
                        {idx + 1}
                      </td>

                      <td className="px-3 py-2 w-[70%] border border-slate-200 bg-transparent">
                        <div className="whitespace-pre-wrap break-words">{it.message || '-'}</div>
                      </td>

                      <td className="px-3 py-2 whitespace-nowrap border border-slate-200 bg-transparent">
                        <span className={`px-2 py-0.5 rounded border text-xs ${statusClasses(it.status)}`}>
                          {(it.statusLabel || ((() => {
                            const st = it.status || 'scheduled';
                            if (st === 'error' || st === 'canceled') return 'Erro';
                            if (st === 'done') return 'Finalizado';
                            return 'Agendado';
                          })()))}
                        </span>
                      </td>

                      <td className="px-3 py-2 whitespace-nowrap border border-slate-200 bg-transparent">
                        {it.createdAt || '-'}
                      </td>

                      <td className="px-3 py-2 whitespace-nowrap border border-slate-200 bg-transparent">
                        {it.scheduledAt || '-'}
                      </td>

                      <td className="px-3 py-2 border border-slate-200 bg-transparent">
                        {it.notes || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="mt-3 text-xs text-slate-500">
                Legenda: erro = vermelho · agendado = verde · finalizado = azul
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
