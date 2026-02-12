"use client";

import { useRef } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { PesquisaChamadosResponse, ChamadoFinalizadoItem } from "@/types";
import { BarraScrollHorizontalFixa } from "@/components/BarraScrollHorizontalFixa";
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

function Badge({ color, children }: { color: "neutral" | "green" | "blue" | "red"; children: React.ReactNode }) {
  const map: Record<string, string> = {
    neutral: "bg-slate-100 text-slate-700 border-slate-200",
    green: "bg-green-100 text-green-700 border-green-200",
    blue: "bg-blue-100 text-blue-700 border-blue-200",
    red: "bg-red-100 text-red-700 border-red-200",
  };
  return (
    <span className={`px-2.5 py-1 text-xs font-medium rounded-full border shadow-sm ${map[color]}`}>{children}</span>
  );
}

export function TabelaChamadosFinalizados({ data, isLoading, error, onPageChange, onVerAgendamentos, observacoes, onSalvarObservacao }: Props) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-6 card-shadow">
        <div className="flex items-center justify-between mb-4">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-6 w-20" />
        </div>
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-2xl border border-red-200 p-6">
        <div className="flex items-center gap-3 text-red-600">
          <span className="text-lg">⚠️</span>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center">
        <p className="text-slate-500">Use os filtros acima para pesquisar chamados.</p>
      </div>
    );
  }

  if ((data.items?.length || 0) === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center">
        <p className="text-slate-500">Nenhum resultado para os filtros selecionados.</p>
      </div>
    );
  }

  const { meta } = data;

  return (
    <>
      <div className="bg-white rounded-2xl border border-slate-200 card-shadow overflow-hidden flex flex-col mb-4">
        <div className="flex items-center justify-between p-4 border-b border-slate-200 flex-shrink-0">
          <h3 className="font-semibold text-slate-900">Resultados</h3>
          <span className="px-3 py-1 bg-slate-100 text-slate-600 text-sm rounded-full">
            {meta.total} {meta.total === 1 ? "item" : "itens"}
          </span>
        </div>

        <div ref={scrollContainerRef} className="flex-1 overflow-x-auto w-full relative scrollbar-hide">
          <div className="min-w-[1200px]">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50 border-b border-slate-200 hover:bg-slate-50">
                  <TableHead className="font-semibold text-slate-700 whitespace-nowrap w-[220px] sticky left-0 top-0 bg-slate-50 z-10">Nome Digisac</TableHead>
                  <TableHead className="font-semibold text-slate-700 whitespace-nowrap w-[150px] sticky top-0 bg-slate-50 z-10">Loja</TableHead>
                  <TableHead className="font-semibold text-slate-700 whitespace-nowrap w-[180px] sticky top-0 bg-slate-50 z-10">Consultora</TableHead>
                  <TableHead className="font-semibold text-slate-700 whitespace-nowrap w-[180px] sticky top-0 bg-slate-50 z-10">Mensagens agendadas</TableHead>
                  <TableHead className="font-semibold text-slate-700 whitespace-nowrap w-[160px] sticky top-0 bg-slate-50 z-10">Status da conversa</TableHead>
                  <TableHead className="font-semibold text-slate-700 whitespace-nowrap w-[240px] sticky top-0 bg-slate-50 z-10">Tags</TableHead>
                  <TableHead className="font-semibold text-slate-700 whitespace-nowrap w-[140px] sticky top-0 bg-slate-50 z-10">Qtd (total)</TableHead>
                  <TableHead className="font-semibold text-slate-700 whitespace-nowrap w-[160px] sticky top-0 bg-slate-50 z-10">Qtd (em aberto)</TableHead>
                  <TableHead className="font-semibold text-slate-700 whitespace-nowrap w-[180px] sticky top-0 bg-slate-50 z-10">Qtd (finalizados)</TableHead>
                  <TableHead className="font-semibold text-slate-700 whitespace-nowrap w-[140px] sticky top-0 bg-slate-50 z-10">Qtd (erro)</TableHead>
                  <TableHead className="font-semibold text-slate-700 whitespace-nowrap w-[220px] sticky top-0 bg-slate-50 z-10">Observação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((item: ChamadoFinalizadoItem) => (
                  <TableRow
                    key={item.contactId}
                    className={`transition-colors border-b last:border-0 ${item.qtdAgendamentosAbertos === 0 ? 'bg-red-50 hover:bg-red-50 border-red-100' : 'hover:bg-slate-50 border-slate-100'}`}
                  >
                    <TableCell className={`whitespace-nowrap font-medium text-slate-700 sticky left-0 z-10 ${item.qtdAgendamentosAbertos === 0 ? 'bg-red-50' : 'bg-white'}`}>
                      {item.nomeDigisac || "-"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{item.loja || '-'}</TableCell>
                    <TableCell className="whitespace-nowrap">{item.consultora || '-'}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      <Button variant="outline" size="sm" className="rounded-xl" onClick={() => onVerAgendamentos(item.contactId, item.nomeDigisac)}>
                        Ver agendamentos
                      </Button>
                    </TableCell>
                    <TableCell>
                      <Badge color={item.statusConversa === 'Aberta' ? 'green' : 'neutral'}>
                        {item.statusConversa}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[240px] truncate" title={item.tags}>{item.tags || '-'}</TableCell>
                    <TableCell>
                      <Badge color="neutral">{item.qtdAgendamentosTotal}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge color="green">{item.qtdAgendamentosAbertos}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge color="blue">{item.qtdAgendamentosFinalizados}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge color="red">{item.qtdAgendamentosErro}</Badge>
                    </TableCell>
                    <TableCell>
                      <CelulaObservacao
                        contactId={item.contactId}
                        valor={observacoes[item.contactId] || ''}
                        onSalvar={onSalvarObservacao}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>

        <div className="flex items-center justify-between p-4 border-t border-slate-200">
          <p className="text-sm text-slate-600">Página {meta.currentPage} de {meta.lastPage}</p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => onPageChange(meta.currentPage - 1)} disabled={meta.currentPage <= 1} className="rounded-xl">
              <ChevronLeft className="w-4 h-4 mr-1" /> Anterior
            </Button>
            <Button variant="outline" size="sm" onClick={() => onPageChange(meta.currentPage + 1)} disabled={meta.currentPage >= meta.lastPage} className="rounded-xl">
              Próxima <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      </div>

      <BarraScrollHorizontalFixa targetRef={scrollContainerRef} bottomOffset={0} />
    </>
  );
}
