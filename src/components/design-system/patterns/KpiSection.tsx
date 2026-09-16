import { cn } from '@/lib/utils'

/** Pattern de seção de KPIs (PKS=A — grade de KPIs no topo, gráfico/conteúdo abaixo). */
export function KpiSection({ kpis, children, className }: { kpis: React.ReactNode; children?: React.ReactNode; className?: string }) {
  return (
    <div className={cn('space-y-4', className)}>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-7">{kpis}</div>
      {children}
    </div>
  )
}
