'use client'
import { useState } from 'react'
import { CheckCheck, ChevronDown, ChevronUp, FileSearch, Info } from 'lucide-react'
import { Badge, Button, Card, CardContent, ResponsiveTable } from '@/components/design-system'
import { friendlyWarning } from './flow-text'
import type { FlowDashboard } from '@/lib/atendimento-presencial/fluxo-lojas'

const value = (number: number | null) => number === null ? '—' : number.toLocaleString('pt-BR')
export function FlowAudit({ data }: { data: FlowDashboard }) {
  const [open, setOpen] = useState(false)
  const [page, setPage] = useState(1)
  const pages = Math.max(1, Math.ceil(data.diario.length / 20))
  const currentPage = Math.min(page, pages)
  const dailyRows = data.diario.slice((currentPage - 1) * 20, currentPage * 20)
  const mismatches = data.diario.filter(day => day.divergente).length
  return <section aria-label="Conferência das fontes"><Card>
    <CardContent className="p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-4"><div className="flex items-center gap-3"><span className="rounded-xl bg-primary/10 p-3 text-primary"><FileSearch className="size-5" /></span><div><h2 className="text-lg font-bold">De onde vêm os números?</h2><p className="mt-1 text-sm text-slate-500">Confira as contagens disponíveis e os totais de cada dia.</p></div></div><Button variant="secondary" className="min-h-11" aria-expanded={open} aria-controls="flow-daily-audit" onClick={() => setOpen(!open)}>{open ? <ChevronUp /> : <ChevronDown />}{open ? 'Fechar conferência' : 'Conferir dados por dia'}</Button></div>
      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <div className="rounded-xl bg-slate-50 p-4"><p className="mb-2 flex items-center gap-2 text-sm font-semibold"><CheckCheck className="size-4 text-primary" />Horários com contagem disponível</p><p className="text-xl font-bold tabular-nums">{data.resumo.horasComDado}<span className="text-sm font-normal text-slate-500"> / {data.resumo.horasEsperadas} horários esperados</span></p><p className="mt-1 text-xs text-slate-500">Cada hora de cada loja e de cada dia é contada separadamente. A hora atual ainda pode estar em andamento.</p></div>
        <div className="rounded-xl bg-slate-50 p-4"><p className="mb-2 text-sm font-semibold">Conferência dos totais do dia</p><Badge tone={mismatches ? 'warning' : 'neutral'}>{mismatches ? `${mismatches} diferença(s) nos totais` : 'Nenhuma diferença encontrada'}</Badge><p className="mt-2 text-xs text-slate-500">Comparamos o total do dia com a soma das contagens por hora. Se faltarem dados, ainda não é possível concluir.</p></div>
        <div className="rounded-xl bg-slate-50 p-4"><p className="mb-2 flex items-center gap-2 text-sm font-semibold"><Info className="size-4 text-primary" />Como interpretar</p><p className="text-xs leading-relaxed text-slate-600">A AlterVision conta grupos que entram na loja. Cada grupo pode ter mais de uma pessoa. As Pranchetas são contadas pelo horário em que o preenchimento começou. Uma diferença não significa, por si só, falta de registro.</p></div>
      </div>
      {(data.externo.warnings.length > 0 || data.avisos.length > 0) && <ul className="mt-4 space-y-1 text-xs text-slate-500">{[...data.externo.warnings, ...data.avisos].map(warning => <li key={warning}>• {friendlyWarning(warning)}</li>)}</ul>}
      {open && <div id="flow-daily-audit" className="mt-5 space-y-3 border-t pt-5"><p className="text-sm text-slate-600">Estes totais incluem o dia inteiro, também antes das 8h e depois das 22h. O total revisado pela AlterVision é mostrado apenas para consulta e não substitui a contagem usada nos gráficos.</p><ResponsiveTable firstColumnSticky rows={dailyRows} rowKey={day => `${day.unidadeId}/${day.dia}`} columns={[
        { key: 'dia', header: 'Dia / filial', render: day => <div><strong>{day.dia.split('-').reverse().join('/')}</strong><p className="text-xs text-slate-500">{data.unidades.find(unit => unit.id === day.unidadeId)?.nome}</p></div> },
        { key: 'medido', header: 'Grupos no dia', render: day => value(day.medido) },
        { key: 'horas', header: 'Total das contagens por hora', render: day => value(day.somaHoraria) },
        { key: 'ajustado', header: 'Total revisado pela AlterVision', render: day => value(day.ajustado) },
        { key: 'status', header: 'Conferência', render: day => <Badge tone={day.divergente ? 'warning' : day.medido === null || day.somaHoraria === null ? 'neutral' : 'success'}>{day.divergente ? 'Os totais não coincidem' : day.medido === null || day.somaHoraria === null ? 'Faltam dados para comparar' : 'Totais iguais'}</Badge> },
      ]} renderMobileCard={day => <div className="space-y-2 text-sm"><strong>{day.dia.split('-').reverse().join('/')} · {data.unidades.find(unit => unit.id === day.unidadeId)?.nome}</strong><p>Grupos no dia: {value(day.medido)} · Contagem por hora: {value(day.somaHoraria)}</p><p>Total revisado pela AlterVision: {value(day.ajustado)}</p><Badge tone={day.divergente ? 'warning' : 'neutral'}>{day.divergente ? 'Os totais não coincidem' : day.medido === null || day.somaHoraria === null ? 'Faltam dados para comparar' : 'Totais iguais'}</Badge></div>} />{pages > 1 && <div className="flex flex-wrap items-center justify-end gap-3"><span className="text-xs text-slate-500">Conferência diária · {currentPage} de {pages}</span><Button variant="secondary" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>Anterior</Button><Button variant="secondary" disabled={currentPage >= pages} onClick={() => setPage(currentPage + 1)}>Próxima</Button></div>}</div>}
    </CardContent>
  </Card></section>
}
