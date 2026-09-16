import { DecisionBlock } from '../DecisionBlock'

const STATUSES = [
  { label: 'Pendente', tone: 'amber' },
  { label: 'Em produção', tone: 'violet' },
  { label: 'Concluído', tone: 'emerald' },
  { label: 'Cancelado', tone: 'red' },
] as const

const PILL_CLASSES: Record<string, string> = {
  amber: 'bg-amber-50 text-amber-700 border border-amber-200',
  violet: 'bg-violet-50 text-violet-700 border border-violet-200',
  emerald: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  red: 'bg-red-50 text-red-700 border border-red-200',
}

const DOT_CLASSES: Record<string, string> = {
  amber: 'bg-amber-500',
  violet: 'bg-violet-500',
  emerald: 'bg-emerald-500',
  red: 'bg-red-500',
}

const TAG_CLASSES: Record<string, string> = {
  amber: 'bg-amber-500 text-white',
  violet: 'bg-violet-500 text-white',
  emerald: 'bg-emerald-500 text-white',
  red: 'bg-red-500 text-white',
}

function PillStatuses() {
  return (
    <div className="flex flex-col gap-1.5">
      {STATUSES.map((s) => (
        <span key={s.label} className={`inline-flex w-fit items-center rounded-full px-2.5 py-1 text-[10px] font-semibold ${PILL_CLASSES[s.tone]}`}>
          {s.label}
        </span>
      ))}
    </div>
  )
}

function DotStatuses() {
  return (
    <div className="flex flex-col gap-1.5">
      {STATUSES.map((s) => (
        <span key={s.label} className="inline-flex w-fit items-center gap-1.5 text-[11px] font-medium text-slate-700">
          <span className={`size-1.5 rounded-full ${DOT_CLASSES[s.tone]}`} />
          {s.label}
        </span>
      ))}
    </div>
  )
}

function TagStatuses() {
  return (
    <div className="flex flex-col gap-1.5">
      {STATUSES.map((s) => (
        <span key={s.label} className={`inline-flex w-fit items-center rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${TAG_CLASSES[s.tone]}`}>
          {s.label}
        </span>
      ))}
    </div>
  )
}

export function StatusSection() {
  return (
    <DecisionBlock
      code="STA"
      title="Badges / status"
      description="Como um estado de negócio (pendente, em produção, concluído, cancelado) é comunicado visualmente."
      options={[
        {
          letter: 'A',
          label: 'Pílula suave',
          note: 'Fundo claro + borda + texto colorido — padrão dominante hoje no sistema.',
          content: <PillStatuses />,
        },
        {
          letter: 'B',
          label: 'Ponto + label',
          note: 'Indicador mínimo (ponto colorido) + texto neutro — mais discreto, bom para listas densas.',
          content: <DotStatuses />,
        },
        {
          letter: 'C',
          label: 'Tag sólida',
          note: 'Fundo cheio e alto contraste — chama mais atenção, bom para status críticos.',
          content: <TagStatuses />,
        },
      ]}
    />
  )
}
