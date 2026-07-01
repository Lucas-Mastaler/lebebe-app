'use client';

import { EstatisticasDigisacTotais } from '@/types';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Skeleton } from '@/components/ui/skeleton';

function formatarTempo(segundos: number): string {
  if (!segundos || segundos <= 0) return '—';
  const h = Math.floor(segundos / 3600);
  const m = Math.floor((segundos % 3600) / 60);
  const s = Math.floor(segundos % 60);
  if (h > 0) return `${h}h ${m}min`;
  if (m > 0) return `${m}min ${s}s`;
  return `${s}s`;
}

function formatarRelacao(valor: number | null): string {
  if (valor === null) return '—';
  return valor.toFixed(2).replace('.', ',');
}

function corRelacao(valor: number | null): string {
  if (valor === null) return 'text-slate-400';
  const arredondado = Math.round(valor * 100) / 100;
  if (arredondado <= 1.5) return 'text-green-600';
  if (arredondado <= 1.74) return 'text-orange-500';
  return 'text-red-600';
}

interface CardConfig {
  titulo: string;
  valor: string;
  cor?: string;
  tooltip: string;
}

interface CardsEstatisticasDigisacProps {
  totais: EstatisticasDigisacTotais | null;
  isLoading: boolean;
  error: string | null;
}

export function CardsEstatisticasDigisac({ totais, isLoading, error }: CardsEstatisticasDigisacProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {[...Array(7)].map((_, i) => (
          <div key={i} className="bg-white rounded-2xl border border-slate-200 p-4 card-shadow">
            <Skeleton className="h-4 w-24 mb-2" />
            <Skeleton className="h-8 w-16" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-2xl border border-red-200 p-4">
        <div className="flex items-center gap-3 text-red-600">
          <span className="text-lg">⚠️</span>
          <p className="text-sm">Erro ao carregar estatísticas Digisac: {error}</p>
        </div>
      </div>
    );
  }

  if (!totais) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-4 text-center">
        <p className="text-slate-500 text-sm">Use os filtros acima para carregar as estatísticas Digisac.</p>
      </div>
    );
  }

  const cards: CardConfig[] = [
    {
      titulo: 'Mensagens enviadas',
      valor: totais.mensagensEnviadas.toLocaleString('pt-BR'),
      tooltip: 'Quantidade total de mensagens enviadas pela plataforma conforme o período e filtros selecionados.',
    },
    {
      titulo: 'Mensagens recebidas',
      valor: totais.mensagensRecebidas.toLocaleString('pt-BR'),
      tooltip: 'Quantidade total de mensagens recebidas conforme o período e filtros selecionados.',
    },
    {
      titulo: 'Relação envio x recebimento',
      valor: formatarRelacao(totais.relacaoEnvioRecebimento),
      cor: corRelacao(totais.relacaoEnvioRecebimento),
      tooltip: 'Índice calculado dividindo mensagens enviadas por mensagens recebidas. Valores mais altos indicam maior volume de mensagens enviadas em relação às recebidas.',
    },
    {
      titulo: 'Tempo médio de chamado',
      valor: formatarTempo(totais.tempoMedioChamadoSegundos),
      tooltip: 'Média do tempo de duração dos chamados, desde a abertura até o fechamento, conforme os filtros selecionados.',
    },
    {
      titulo: 'Média do 1º tempo de espera',
      valor: formatarTempo(totais.mediaPrimeiroTempoEsperaSegundos),
      tooltip: 'Tempo entre a primeira mensagem do cliente e a primeira resposta humana do atendente, sem contar respostas automáticas de bot.',
    },
    {
      titulo: 'Média do 1º tempo de espera após bot',
      valor: formatarTempo(totais.mediaPrimeiroTempoEsperaAposBotSegundos),
      tooltip: 'Tempo entre a finalização do atendimento pelo bot e a primeira mensagem humana enviada pelo atendente.',
    },
    {
      titulo: 'Tempo médio de espera',
      valor: formatarTempo(totais.tempoMedioEsperaSegundos),
      tooltip: 'Média do tempo de espera dos chamados considerando transferências, conforme os filtros selecionados.',
    },
  ];

  return (
    <TooltipProvider>
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {cards.map((card, i) => (
          <div
            key={i}
            className="bg-white rounded-2xl border border-slate-200 p-4 card-shadow flex flex-col gap-1"
          >
            <div className="flex items-center gap-1">
              <h4 className="text-xs font-medium text-slate-500 leading-tight">{card.titulo}</h4>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="text-slate-400 hover:text-slate-600 cursor-help"
                    aria-label={`Informação sobre ${card.titulo}`}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <path d="M12 16v-4" />
                      <path d="M12 8h.01" />
                    </svg>
                  </button>
                </TooltipTrigger>
                <TooltipContent className="max-w-[260px]">
                  <p>{card.tooltip}</p>
                </TooltipContent>
              </Tooltip>
            </div>
            <span className={`text-2xl font-bold ${card.cor ?? 'text-slate-900'}`}>
              {card.valor}
            </span>
          </div>
        ))}
      </div>
    </TooltipProvider>
  );
}
