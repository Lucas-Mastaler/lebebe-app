'use client'
import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Clock3, MousePointer2 } from 'lucide-react'
import { Badge, Button, Card, CardContent } from '@/components/design-system'
import type { Comparison } from '@/lib/atendimento-presencial/fluxo-lojas'

export function FlowChart({ rows, onSelect }: { rows: Comparison[]; onSelect: (row: Comparison) => void }) {
  return <Card className="min-w-0"><CardContent className="p-5 sm:p-6">
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3"><div><h2 className="flex items-center gap-2 text-lg font-bold"><Clock3 className="size-5 text-primary" />O movimento ao longo do dia</h2><p className="mt-1 text-sm text-slate-500">Em quais horários as Pranchetas acompanharam as entradas?</p></div><Badge tone="neutral">{rows[0]?.hora ?? 8}h–{(rows[rows.length - 1]?.hora ?? 21) + 1}h · Brasília</Badge></div>
    <div className="mb-5 flex flex-wrap gap-x-5 gap-y-2 text-xs font-medium" aria-label="Legenda do gráfico">
      <span className="flex items-center gap-2"><span className="h-1 w-5 rounded-full bg-success" />Pranchetas concluídas</span>
      <span className="flex items-center gap-2"><span className="h-1 w-5 rounded-full bg-slate-800" />Grupos AlterVision</span>
    </div>
    <div className="h-72 min-w-0 sm:h-80" role="img" aria-label="Comparativo por hora">
      <ResponsiveContainer width="100%" height="100%" minWidth={1}>
        <ComposedChart data={rows} margin={{ top: 15, right: 15, bottom: 5, left: -20 }} onClick={event => {
          const index = event?.activeTooltipIndex
          if (index !== undefined && rows[Number(index)]) onSelect(rows[Number(index)])
        }}>
          <defs><linearGradient id="flow-pranchetas-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--success)" stopOpacity={0.25} /><stop offset="100%" stopColor="var(--success)" stopOpacity={0.02} /></linearGradient></defs>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 5" vertical={false} /><XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11 }} minTickGap={25} /><YAxis axisLine={false} tickLine={false} allowDecimals={false} tick={{ fontSize: 11 }} />
          <Tooltip content={({ active, payload, label }) => active && payload?.length ? <div className="rounded-xl border bg-white p-4 text-sm shadow-lg"><p className="mb-2 font-bold">{label}</p>{payload.map(item => <p key={String(item.dataKey)} className="flex justify-between gap-6"><span>{item.name}</span><strong>{item.value ?? '—'}</strong></p>)}<p className="mt-2 text-xs text-slate-500">Escolha um horário para ver os atendimentos.</p></div> : null} />
          <Area type="linear" dataKey="total" name="Pranchetas concluídas" fill="url(#flow-pranchetas-fill)" stroke="var(--success)" strokeWidth={3} isAnimationActive={false} />
          <Line type="linear" dataKey="grupos" name="Grupos AlterVision" stroke="var(--color-slate-800)" strokeWidth={3} dot={{ r: 4, fill: 'var(--color-slate-800)', strokeWidth: 2, stroke: 'white' }} activeDot={{ r: 6 }} connectNulls={false} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
    <div className="mt-4 flex items-center gap-2 border-t pt-4 text-xs text-slate-500"><MousePointer2 className="size-4 shrink-0" />Escolha um horário para ver os atendimentos. Espaços na linha indicam que faltam dados; 0 significa que nenhuma entrada foi contada.</div>
    <div className="mt-3 flex gap-2 overflow-x-auto pb-2" aria-label="Selecionar em Comparativo por hora">
      {rows.map(row => <Button key={row.chave} variant="secondary" size="sm" className="min-h-11" onClick={() => onSelect(row)}>{row.label}</Button>)}
    </div>
  </CardContent></Card>
}
