import { Plus, Trash2 } from 'lucide-react'
import { DecisionBlock } from '../DecisionBlock'

function SolidSystem() {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button className="rounded-md bg-[#00A5E6] px-3 py-1.5 text-xs font-medium text-white transition hover:bg-[#0090cc]">Salvar pedido</button>
      <button className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50">Secundário</button>
      <button className="rounded-md px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-100">Ghost</button>
      <button className="rounded-md bg-red-500 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-red-600">Excluir</button>
      <button aria-label="Adicionar" className="flex size-8 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-600 transition hover:bg-slate-50">
        <Plus className="size-4" />
      </button>
    </div>
  )
}

function TonalSystem() {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button className="rounded-lg bg-[#00A5E6] px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-[#0090cc]">Salvar pedido</button>
      <button className="rounded-lg bg-[#00A5E6]/10 px-3 py-1.5 text-xs font-semibold text-[#00A5E6] transition hover:bg-[#00A5E6]/15">Secundário</button>
      <button className="rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-500 transition hover:bg-slate-100">Ghost</button>
      <button className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-100">Excluir</button>
      <button aria-label="Adicionar" className="flex size-8 items-center justify-center rounded-full bg-[#00A5E6]/10 text-[#00A5E6] transition hover:bg-[#00A5E6]/15">
        <Plus className="size-4" />
      </button>
    </div>
  )
}

function PillSystem() {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button className="rounded-full bg-[#00A5E6] px-4 py-1.5 text-xs font-bold text-white shadow-sm transition hover:bg-[#0090cc]">Salvar pedido</button>
      <button className="rounded-full border-2 border-[#00A5E6] px-4 py-1.5 text-xs font-bold text-[#00A5E6] transition hover:bg-[#00A5E6]/5">Secundário</button>
      <button className="rounded-full px-4 py-1.5 text-xs font-bold text-slate-600 underline-offset-4 transition hover:underline">Ghost</button>
      <button className="rounded-full border-2 border-red-500 px-4 py-1.5 text-xs font-bold text-red-600 transition hover:bg-red-50">
        <Trash2 className="mr-1 inline size-3" />
        Excluir
      </button>
      <button aria-label="Adicionar" className="flex size-8 items-center justify-center rounded-full border-2 border-[#00A5E6] text-[#00A5E6] transition hover:bg-[#00A5E6]/5">
        <Plus className="size-4" />
      </button>
    </div>
  )
}

export function ActionsSection() {
  return (
    <DecisionBlock
      code="BTN"
      title="Sistema de botões"
      description="Primary, secondary, ghost, destructive e icon button — sempre mostrados juntos, como um conjunto coerente."
      options={[
        {
          letter: 'A',
          label: 'Sólido atual',
          note: 'O que o componente Button (shadcn) já implementa hoje.',
          content: <SolidSystem />,
        },
        {
          letter: 'B',
          label: 'Tonal suave',
          note: 'Primary continua sólido; secundário/destrutivo ganham fundo suave (tonal) em vez de contorno.',
          content: <TonalSystem />,
        },
        {
          letter: 'C',
          label: 'Contornado / pill',
          note: 'Formato arredondado total (pill) e contornos mais grossos — personalidade de marca mais marcada.',
          content: <PillSystem />,
        },
      ]}
    />
  )
}
