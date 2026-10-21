'use client'
import { ArrowRight, ClipboardCheck, Store, Users } from 'lucide-react'
import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts'
import { Badge, Button, Card, CardContent } from '@/components/design-system'
import type { Comparison, FlowDashboard } from '@/lib/atendimento-presencial/fluxo-lojas'
import styles from './FlowOverview.module.css'
import { differenceText } from './flow-text'

const number = (value: number | null) => value === null ? '—' : value.toLocaleString('pt-BR')

function ComparisonBar({ row }: { row: Comparison }) {
  const max = Math.max(row.grupos ?? 0, row.total, 1)
  return <div className="space-y-3" aria-label={`Comparação de ${row.label}`}>
    <div><div className="mb-1 flex justify-between text-xs"><span>Grupos AlterVision</span><strong>{number(row.grupos)}</strong></div><div className="h-2.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-slate-800" style={{ width: `${(row.grupos ?? 0) / max * 100}%` }} /></div></div>
    <div><div className="mb-1 flex justify-between text-xs"><span>Pranchetas concluídas</span><strong>{number(row.total)}</strong></div><div className="flex h-2.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full bg-chart-1" style={{ width: `${row.clientes / max * 100}%` }} /><div className="h-full bg-chart-5" style={{ width: `${row.naoClientes / max * 100}%` }} /></div></div>
  </div>
}

export function FlowOverview({ data, loading, onUnit }: { data: FlowDashboard; loading: boolean; onUnit: (id: string) => void }) {
  const summary = data.resumo
  const composition = [{ name: 'Clientes', value: summary.clientes, color: 'var(--chart-1)' }, { name: 'Não clientes', value: summary.naoClientes, color: 'var(--chart-5)' }]
  return <div className="space-y-6">
    <section aria-label="Resumo do movimento" className={styles.summary}>
      <Card className="relative border-slate-300"><CardContent className={styles.summaryContent}>
        <div className="flex items-center justify-between"><span className="text-sm font-semibold text-slate-600">Entradas nas lojas</span><span className="rounded-xl bg-slate-100 p-2"><Users className="size-5 text-slate-700" /></span></div>
        <div><p className={`${styles.metric} text-slate-900`}>{number(summary.grupos)}</p><p className="mt-1 text-sm text-slate-600">grupos contados pela AlterVision</p></div>
        <div className="flex flex-wrap items-center gap-2 border-t pt-2"><Badge tone={summary.cobertura === 'complete' ? 'success' : 'warning'}>{summary.cobertura === 'complete' ? 'Contagem completa' : 'Contagem ainda incompleta'}</Badge><span className="text-xs text-slate-500">Uma entrada pode reunir mais de uma pessoa.</span></div>
      </CardContent></Card>
      <Card className="border-emerald-200 bg-success/5"><CardContent className={styles.summaryContent}>
        <div className="flex items-center justify-between"><span className="text-sm font-semibold text-emerald-800">Pranchetas preenchidas</span><span className="rounded-xl bg-success/10 p-2"><ClipboardCheck className="size-5 text-emerald-700" /></span></div>
        <div><p className={`${styles.metric} text-emerald-800`}>{number(summary.total)}</p><p className="mt-1 text-sm text-emerald-800">Atendimentos concluídos no período filtrado</p></div>
        <p className="border-t border-emerald-200 pt-2 text-sm font-medium text-emerald-900">{differenceText(summary.diferenca)}</p>
      </CardContent></Card>
      <Card className={styles.composition}><CardContent className={styles.summaryContent}><h2 className="text-sm font-semibold text-slate-700">Pranchetas por tipo de atendimento</h2>
        <div className={styles.compositionBody}>
        <div className={styles.ring} role="img" aria-label={`Composição: ${summary.clientes} Clientes e ${summary.naoClientes} Não clientes`}>
          <ResponsiveContainer width="100%" height="100%" minWidth={1}><PieChart><Pie data={summary.total ? composition : [{ name: 'Sem registros', value: 1, color: 'var(--muted)' }]} dataKey="value" innerRadius={37} outerRadius={51} paddingAngle={summary.clientes && summary.naoClientes ? 4 : 0} stroke="none" startAngle={90} endAngle={-270} isAnimationActive={false}>{(summary.total ? composition : [{ color: 'var(--muted)' }]).map((item, index) => <Cell key={index} fill={item.color} />)}</Pie></PieChart></ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"><strong className="text-2xl tabular-nums">{number(summary.total)}</strong><span className="text-xs text-slate-500">Pranchetas</span></div>
        </div>
        <div className="space-y-2"><div className="rounded-xl bg-info/5 p-2"><span className="flex items-center gap-1.5 text-xs text-sky-800"><span className="size-2 rounded-full bg-chart-1" />Clientes</span><strong className="mt-1 block text-2xl text-sky-800">{number(summary.clientes)}</strong></div><div className="rounded-xl bg-warning/5 p-2"><span className="flex items-center gap-1.5 text-xs text-amber-800"><span className="size-2 rounded-full bg-chart-5" />Não clientes</span><strong className="mt-1 block text-2xl text-amber-800">{number(summary.naoClientes)}</strong></div></div>
        </div>
      </CardContent></Card>
    </section>
    <section aria-label="Comparativo por filial" className="space-y-3">
      <div><h2 className="text-lg font-bold">Entradas e Pranchetas por filial</h2><p className="mt-1 text-sm text-slate-500">Compare quantos grupos entraram e quantas Pranchetas foram preenchidas em cada loja.</p></div>
      <div className={`grid gap-4 ${data.porFilial.length > 1 ? 'lg:grid-cols-3' : ''}`}>{data.porFilial.map(row => <Card key={row.chave}><CardContent className="space-y-5 p-5">
        <div className="flex items-center justify-between"><h3 className="flex items-center gap-2 font-bold"><Store className="size-4 text-primary" />{row.label}</h3><Badge tone={row.cobertura === 'complete' ? 'success' : 'warning'}>{row.cobertura === 'complete' ? 'Contagem completa' : 'Contagem ainda incompleta'}</Badge></div>
        <div className="grid grid-cols-2 divide-x"><div><p className="text-3xl font-bold tabular-nums">{number(row.grupos)}</p><p className="mt-1 text-xs text-slate-500">grupos entraram</p></div><div className="pl-5"><p className="text-3xl font-bold tabular-nums text-emerald-700">{number(row.total)}</p><p className="mt-1 text-xs text-slate-500">Pranchetas concluídas</p></div></div>
        <ComparisonBar row={row} />
        <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm font-semibold" aria-label={`Tipos de atendimento em ${row.label}`}><span className="flex items-center gap-2 text-sky-800"><span className="size-3 rounded-sm bg-chart-1" />Clientes: {number(row.clientes)}</span><span className="flex items-center gap-2 text-amber-800"><span className="size-3 rounded-sm bg-chart-5" />Não clientes: {number(row.naoClientes)}</span></div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-3"><p className="text-sm font-medium text-slate-700">{differenceText(row.diferenca)}</p><Button variant="secondary" size="sm" disabled={loading} onClick={() => onUnit(row.unidadeId ?? '')}>Ver {row.label}<ArrowRight className="size-3" /></Button></div>
      </CardContent></Card>)}</div>
    </section>
  </div>
}
