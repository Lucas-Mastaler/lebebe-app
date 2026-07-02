'use client';

import { useState } from 'react';
import { VacuoAtivoResponse } from '@/types';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Skeleton } from '@/components/ui/skeleton';

interface CardVacuoAtivoProps {
  data: VacuoAtivoResponse | null;
  isLoading: boolean;
  error: string | null;
}

function formatarTaxa(valor: number | null): string {
  if (valor === null) return '—';
  return valor.toFixed(1).replace('.', ',') + '%';
}

function corTaxa(valor: number | null): string {
  if (valor === null) return 'text-slate-400';
  if (valor <= 30) return 'text-green-600';
  if (valor <= 50) return 'text-orange-500';
  return 'text-red-600';
}

export function CardVacuoAtivo({ data, isLoading, error }: CardVacuoAtivoProps) {
  const [mostrarAvaliados, setMostrarAvaliados] = useState(false);

  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-4 card-shadow flex flex-col gap-1 min-w-[200px]">
        <Skeleton className="h-4 w-32 mb-2" />
        <Skeleton className="h-8 w-20" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-2xl border border-red-200 p-4 card-shadow flex flex-col gap-1 min-w-[200px]">
        <div className="flex items-center gap-1">
          <h4 className="text-xs font-medium text-slate-500 leading-tight">Taxa de vácuo ativo</h4>
        </div>
        <span className="text-sm text-red-600">Erro ao carregar</span>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const valorExibicao = data.limiteExcedido ? '—' : formatarTaxa(data.taxaVacuoAtivo);
  const cor = data.limiteExcedido ? 'text-slate-400' : corTaxa(data.taxaVacuoAtivo);

  let subtexto = '';
  if (data.limiteExcedido) {
    subtexto = data.mensagem ?? 'Limite excedido';
  } else if (data.calculado) {
    subtexto = `${data.chamadosEmVacuo} vácuos de ${data.chamadosAtivosElegiveis} chamados ativos elegíveis`;
  } else if (data.chamadosAtivosElegiveis === 0) {
    subtexto = 'Sem chamados elegíveis no período';
  }

  const avaliados = data.chamadosAvaliados ?? [];

  return (
    <TooltipProvider>
      <div className="bg-white rounded-2xl border border-slate-200 p-4 card-shadow flex flex-col gap-1 min-w-[200px]">
        <div className="flex items-center gap-1">
          <h4 className="text-xs font-medium text-slate-500 leading-tight">Taxa de vácuo ativo</h4>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="text-slate-400 hover:text-slate-600 cursor-help"
                aria-label="Informação sobre Taxa de vácuo ativo"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 16v-4" />
                  <path d="M12 8h.01" />
                </svg>
              </button>
            </TooltipTrigger>
            <TooltipContent className="max-w-[260px]">
              <p>Percentual de chamados iniciados ativamente pela loja em que o cliente não respondeu dentro de 24 horas após a abertura do chamado.</p>
            </TooltipContent>
          </Tooltip>
        </div>
        <span className={`text-2xl font-bold ${cor}`}>
          {valorExibicao}
        </span>
        {subtexto && (
          <span className="text-xs text-slate-500 leading-tight">{subtexto}</span>
        )}
        {avaliados.length > 0 && (
          <div className="mt-1">
            <button
              type="button"
              onClick={() => setMostrarAvaliados(v => !v)}
              className="text-[10px] text-indigo-500 hover:text-indigo-700"
            >
              {mostrarAvaliados ? 'Ocultar chamados avaliados' : 'Ver chamados avaliados'}
            </button>
            {mostrarAvaliados && (
              <div className="mt-1 max-h-40 overflow-y-auto space-y-0.5">
                {avaliados.map((c) => (
                  <div key={c.ticketId} className="flex items-center gap-2 text-[10px] leading-tight">
                    {c.ticketHistoryUrl ? (
                      <a
                        href={c.ticketHistoryUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono text-indigo-500 hover:text-indigo-700 hover:underline"
                      >
                        {c.protocol ?? '—'}
                      </a>
                    ) : (
                      <span className="font-mono text-slate-600">{c.protocol ?? '—'}</span>
                    )}
                    <span className={c.statusVacuo === 'respondido_em_24h' ? 'text-green-600' : 'text-red-500'}>
                      {c.statusVacuo === 'respondido_em_24h' ? 'Respondido em 24h' : 'Vácuo'}
                    </span>
                    <span className="text-slate-400">({c.mensagensClienteEm24h} msg cliente)</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
