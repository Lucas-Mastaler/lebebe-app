'use client';

import { EstatisticasDigisacDiario } from '@/types';
import { Skeleton } from '@/components/ui/skeleton';
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
      <div className="bg-white rounded-2xl border border-slate-200 p-4 card-shadow h-[360px] flex flex-col">
        <Skeleton className="h-6 w-64 mb-3" />
        <div className="flex-1">
          <Skeleton className="h-full w-full" />
        </div>
      </div>
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
    <div className="bg-white rounded-2xl border border-slate-200 p-4 card-shadow h-[360px] flex flex-col">
      <h3 className="font-semibold text-slate-900 mb-3">Mensagens enviadas x recebidas por dia</h3>

      <div className="flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="data" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="enviadas" name="Enviadas" fill="#0EA5E9" radius={[6, 6, 0, 0]} />
            <Bar dataKey="recebidas" name="Recebidas" fill="#10B981" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="flex items-center justify-center gap-6 text-sm text-slate-600 mt-2">
        <div className="flex items-center gap-2">
          <span className="inline-block w-4 h-4 rounded-sm" style={{ backgroundColor: '#0EA5E9' }} />
          <span>ENVIADAS</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block w-4 h-4 rounded-sm" style={{ backgroundColor: '#10B981' }} />
          <span>RECEBIDAS</span>
        </div>
      </div>
    </div>
  );
}
