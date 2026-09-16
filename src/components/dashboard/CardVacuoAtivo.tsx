'use client';

import { useState } from 'react';
import { VacuoAtivoResponse } from '@/types';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Alert, Button, Card, CardContent, KpiCard } from '@/components/design-system';
import { CircleGauge } from 'lucide-react';

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
      <KpiCard className="max-w-sm" label="Taxa de vácuo ativo" loading />
    );
  }

  if (error) {
    return (
      <Alert tone="danger" title="Não foi possível carregar a taxa de vácuo ativo">
        {error}
      </Alert>
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
      <Card className="max-w-sm">
        <CardContent className="space-y-2">
          <KpiCard
            className="border-0 p-0 shadow-none"
            label="Taxa de vácuo ativo"
            value={<span className={cor}>{valorExibicao}</span>}
            icon={
              <Tooltip>
                <TooltipTrigger asChild>
                  <span tabIndex={0} aria-label="Informação sobre Taxa de vácuo ativo">
                    <CircleGauge className="size-4" />
                  </span>
                </TooltipTrigger>
                <TooltipContent className="max-w-[260px]">
                  <p>Percentual de chamados iniciados ativamente pela loja em que o cliente não respondeu dentro de 24 horas após a abertura do chamado.</p>
                </TooltipContent>
              </Tooltip>
            }
          />
          {subtexto && <p className="text-xs leading-tight text-slate-500">{subtexto}</p>}
        {avaliados.length > 0 && (
          <div className="mt-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setMostrarAvaliados(v => !v)}
            >
              {mostrarAvaliados ? 'Ocultar chamados avaliados' : 'Ver chamados avaliados'}
            </Button>
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
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}
