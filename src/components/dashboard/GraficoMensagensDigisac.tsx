'use client';

import { EstatisticasDigisacDiario } from '@/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/design-system';
import { ChartColumnIncreasing } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface GraficoMensagensDigisacProps {
  diario: EstatisticasDigisacDiario[];
  isLoading: boolean;
  error: string | null;
}

export function GraficoMensagensDigisac({ diario, isLoading, error }: GraficoMensagensDigisacProps) {
  if (isLoading) {
    return (
      <Card className="h-[360px]">
        <CardHeader icon={<ChartColumnIncreasing className="size-4" />} title="Mensagens por dia" />
        <CardContent className="flex h-[calc(100%-53px)] flex-col">
          <Skeleton className="mb-3 h-6 w-64" />
          <div className="flex-1">
          <Skeleton className="h-full w-full" />
        </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return null;
  }

  if (!diario || diario.length === 0) {
    return null;
  }

  const chartData = diario.map((d) => ({
    data: d.data,
    enviadas: d.mensagensEnviadas,
    recebidas: d.mensagensRecebidas,
  }));

  return (
    <Card className="h-[360px]">
      <CardHeader
        icon={<ChartColumnIncreasing className="size-4" />}
        title="Mensagens enviadas x recebidas por dia"
      />

      <CardContent className="flex h-[calc(100%-53px)] flex-col">
      <div className="flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="data" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="enviadas" name="Enviadas" fill="var(--chart-1)" radius={[6, 6, 0, 0]} />
            <Bar dataKey="recebidas" name="Recebidas" fill="var(--chart-2)" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="flex items-center justify-center gap-6 text-sm text-slate-600 mt-2">
        <div className="flex items-center gap-2">
          <span className="inline-block size-4 rounded-sm bg-chart-1" />
          <span>ENVIADAS</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block size-4 rounded-sm bg-chart-2" />
          <span>RECEBIDAS</span>
        </div>
      </div>
      </CardContent>
    </Card>
  );
}
