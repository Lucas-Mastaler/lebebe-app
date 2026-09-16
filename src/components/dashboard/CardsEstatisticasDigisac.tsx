'use client';

import { EstatisticasDigisacTotais } from '@/types';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Alert, EmptyState, KpiCard, KpiSection } from '@/components/design-system';
import { MessageCircle, MessagesSquare, Timer } from 'lucide-react';

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
  icon: React.ReactNode;
}

interface CardsEstatisticasDigisacProps {
  totais: EstatisticasDigisacTotais | null;
  isLoading: boolean;
  error: string | null;
}

export function CardsEstatisticasDigisac({ totais, isLoading, error }: CardsEstatisticasDigisacProps) {
  if (isLoading) {
    return (
      <KpiSection kpis={
        <>
        {[...Array(7)].map((_, i) => (
          <KpiCard key={i} label="Carregando estatística" loading />
        ))}
        </>
      } />
    );
  }

  if (error) {
    return (
      <Alert tone="danger" title="Não foi possível carregar as estatísticas Digisac">
        {error}
      </Alert>
    );
  }

  if (!totais) {
    return (
      <EmptyState
        icon={<MessagesSquare className="size-5" />}
        title="Estatísticas Digisac ainda não carregadas"
        description="Use os filtros acima para consultar as métricas do período."
      />
    );
  }

  const cards: CardConfig[] = [
    {
      titulo: 'Mensagens enviadas',
      valor: totais.mensagensEnviadas.toLocaleString('pt-BR'),
      tooltip: 'Quantidade total de mensagens enviadas pela plataforma conforme o período e filtros selecionados.',
      icon: <MessageCircle className="size-4" />,
    },
    {
      titulo: 'Mensagens recebidas',
      valor: totais.mensagensRecebidas.toLocaleString('pt-BR'),
      tooltip: 'Quantidade total de mensagens recebidas conforme o período e filtros selecionados.',
      icon: <MessagesSquare className="size-4" />,
    },
    {
      titulo: 'Relação envio x recebimento',
      valor: formatarRelacao(totais.relacaoEnvioRecebimento),
      cor: corRelacao(totais.relacaoEnvioRecebimento),
      tooltip: 'Índice calculado dividindo mensagens enviadas por mensagens recebidas. Valores mais altos indicam maior volume de mensagens enviadas em relação às recebidas.',
      icon: <MessagesSquare className="size-4" />,
    },
    {
      titulo: 'Tempo médio de chamado',
      valor: formatarTempo(totais.tempoMedioChamadoSegundos),
      tooltip: 'Média do tempo de duração dos chamados, desde a abertura até o fechamento, conforme os filtros selecionados.',
      icon: <Timer className="size-4" />,
    },
    {
      titulo: 'Média do 1º tempo de espera',
      valor: formatarTempo(totais.mediaPrimeiroTempoEsperaSegundos),
      tooltip: 'Tempo entre a primeira mensagem do cliente e a primeira resposta humana do atendente, sem contar respostas automáticas de bot.',
      icon: <Timer className="size-4" />,
    },
    {
      titulo: 'Média do 1º tempo de espera após bot',
      valor: formatarTempo(totais.mediaPrimeiroTempoEsperaAposBotSegundos),
      tooltip: 'Tempo entre a finalização do atendimento pelo bot e a primeira mensagem humana enviada pelo atendente.',
      icon: <Timer className="size-4" />,
    },
    {
      titulo: 'Tempo médio de espera',
      valor: formatarTempo(totais.tempoMedioEsperaSegundos),
      tooltip: 'Média do tempo de espera dos chamados considerando transferências, conforme os filtros selecionados.',
      icon: <Timer className="size-4" />,
    },
  ];

  return (
    <TooltipProvider>
      <KpiSection kpis={
        <>
        {cards.map((card, i) => (
          <KpiCard
            key={i}
            label={card.titulo}
            value={<span className={card.cor}>{card.valor}</span>}
            icon={
              <Tooltip>
                <TooltipTrigger asChild>
                  <span tabIndex={0} aria-label={`Informação sobre ${card.titulo}`}>
                    {card.icon}
                  </span>
                </TooltipTrigger>
                <TooltipContent className="max-w-[260px]">
                  <p>{card.tooltip}</p>
                </TooltipContent>
              </Tooltip>
            }
          />
        ))}
        </>
      } />
    </TooltipProvider>
  );
}
