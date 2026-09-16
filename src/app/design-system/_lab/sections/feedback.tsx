import { AlertTriangle, CheckCircle2, Inbox, Info, Loader2, XCircle } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { DecisionBlock } from '../DecisionBlock'

const STATES = [
  { kind: 'success', Icon: CheckCircle2, text: 'Pedido salvo com sucesso.' },
  { kind: 'warning', Icon: AlertTriangle, text: 'Prazo próximo do vencimento.' },
  { kind: 'error', Icon: XCircle, text: 'Não foi possível salvar o pedido.' },
  { kind: 'info', Icon: Info, text: 'Este pedido está no fluxo Lebebe Exclusive.' },
] as const

function AlertsBorder() {
  const tone: Record<string, string> = {
    success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    warning: 'border-amber-200 bg-amber-50 text-amber-800',
    error: 'border-red-200 bg-red-50 text-red-700',
    info: 'border-sky-200 bg-sky-50 text-sky-800',
  }
  return (
    <div className="space-y-1.5">
      {STATES.map((s) => (
        <div key={s.kind} className={`flex items-center gap-1.5 rounded-md border px-2 py-1.5 text-[10px] ${tone[s.kind]}`}>
          <s.Icon className="size-3 shrink-0" />
          {s.text}
        </div>
      ))}
    </div>
  )
}

function AlertsSolid() {
  const tone: Record<string, string> = {
    success: 'bg-emerald-100 text-emerald-800',
    warning: 'bg-amber-100 text-amber-800',
    error: 'bg-red-100 text-red-800',
    info: 'bg-sky-100 text-sky-800',
  }
  return (
    <div className="space-y-1.5">
      {STATES.map((s) => (
        <div key={s.kind} className={`flex items-center gap-1.5 rounded-md px-2 py-1.5 text-[10px] font-medium ${tone[s.kind]}`}>
          <s.Icon className="size-3 shrink-0" />
          {s.text}
        </div>
      ))}
    </div>
  )
}

function AlertsCard() {
  const bar: Record<string, string> = {
    success: 'bg-emerald-500 text-emerald-600',
    warning: 'bg-amber-500 text-amber-600',
    error: 'bg-red-500 text-red-600',
    info: 'bg-sky-500 text-sky-600',
  }
  return (
    <div className="space-y-1.5">
      {STATES.map((s) => {
        const [barColor, textColor] = bar[s.kind].split(' ')
        return (
          <div key={s.kind} className="flex items-center gap-1.5 overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm">
            <span className={`h-full w-1 self-stretch ${barColor}`} />
            <s.Icon className={`size-3 shrink-0 ${textColor}`} />
            <span className="py-1.5 pr-2 text-[10px] text-slate-700">{s.text}</span>
          </div>
        )
      })}
    </div>
  )
}

function EmptyMinimal() {
  return (
    <div className="flex flex-col items-center gap-1 py-4 text-center">
      <Inbox className="size-5 text-slate-300" />
      <p className="text-[10px] text-slate-500">Nenhum pedido encontrado.</p>
    </div>
  )
}

function EmptyCta() {
  return (
    <div className="flex flex-col items-center gap-2 py-4 text-center">
      <span className="flex size-9 items-center justify-center rounded-full bg-[#00A5E6]/10">
        <Inbox className="size-4 text-[#00A5E6]" />
      </span>
      <div>
        <p className="text-[11px] font-semibold text-slate-800">Nenhum pedido encontrado</p>
        <p className="text-[10px] text-slate-500">Ajuste os filtros ou crie um novo pedido.</p>
      </div>
      <button className="rounded-md bg-[#00A5E6] px-2.5 py-1 text-[10px] font-medium text-white">Novo pedido</button>
    </div>
  )
}

function EmptyCompact() {
  return (
    <div className="flex items-center gap-1.5 rounded-md border border-dashed border-slate-300 px-2 py-1.5">
      <Inbox className="size-3 text-slate-400" />
      <p className="text-[10px] text-slate-500">Nenhum resultado para os filtros atuais.</p>
    </div>
  )
}

function LoadingMinimal() {
  return (
    <div className="mt-2 space-y-1.5">
      <Skeleton className="h-2.5 w-3/4" />
      <Skeleton className="h-2.5 w-full" />
      <Skeleton className="h-2.5 w-2/3" />
    </div>
  )
}

function LoadingSpinner() {
  return (
    <div className="mt-2 flex flex-col items-center gap-1 py-3">
      <Loader2 className="size-4 animate-spin text-[#00A5E6]" />
      <p className="text-[10px] text-slate-400">Carregando...</p>
    </div>
  )
}

function LoadingRows() {
  return (
    <div className="mt-2 space-y-1">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex items-center gap-2 rounded border border-slate-100 px-1.5 py-1">
          <Skeleton className="h-2 w-1/3" />
          <Skeleton className="h-2 w-1/4" />
          <Skeleton className="h-2 w-1/5" />
        </div>
      ))}
    </div>
  )
}

export function FeedbackSection() {
  return (
    <div className="space-y-10">
      <DecisionBlock
        code="FBK"
        title="Alerts / feedback"
        description="Mensagens de sucesso, aviso, erro e informação — os 4 estados juntos, para comparar o conjunto."
        options={[
          { letter: 'A', label: 'Borda + fundo claro', note: 'Borda fina colorida — padrão hoje na Ficha de Atendimento.', content: <AlertsBorder /> },
          { letter: 'B', label: 'Fundo cheio', note: 'Fundo mais saturado, sem borda — padrão hoje em Recebimento.', content: <AlertsSolid /> },
          { letter: 'C', label: 'Cartão neutro + barra lateral', note: 'Base neutra (branco), cor só na barra lateral e no ícone.', content: <AlertsCard /> },
        ]}
      />

      <DecisionBlock
        code="EST"
        title="Empty state / loading"
        description="Como comunicar 'sem resultados' e 'carregando' — dois estados junto no mesmo option, por decisão."
        options={[
          {
            letter: 'A',
            label: 'Minimalista',
            note: 'Ícone pequeno + texto centralizado; loading em skeleton simples.',
            content: (
              <div>
                <EmptyMinimal />
                <div className="mt-2 border-t border-slate-100 pt-2">
                  <LoadingMinimal />
                </div>
              </div>
            ),
          },
          {
            letter: 'B',
            label: 'Com CTA',
            note: 'Ícone em círculo tonal + texto + ação; loading em spinner central.',
            content: (
              <div>
                <EmptyCta />
                <div className="mt-2 border-t border-slate-100 pt-2">
                  <LoadingSpinner />
                </div>
              </div>
            ),
          },
          {
            letter: 'C',
            label: 'Compacto inline',
            note: 'Uma linha só, sem grande espaço vertical; loading imita linhas da tabela.',
            content: (
              <div>
                <EmptyCompact />
                <div className="mt-2 border-t border-slate-100 pt-2">
                  <LoadingRows />
                </div>
              </div>
            ),
          },
        ]}
      />
    </div>
  )
}
