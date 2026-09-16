import { ChevronRight, Plus, Search, SlidersHorizontal } from 'lucide-react'
import { DecisionBlock } from '../DecisionBlock'

const ROWS = [
  { cliente: 'Ana Souza', status: 'Em produção' },
  { cliente: 'Carlos Lima', status: 'Aguardando' },
]

function MiniStatus({ status }: { status: string }) {
  const tone = status === 'Aguardando' ? 'bg-amber-50 text-amber-700' : 'bg-sky-50 text-sky-700'
  return <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${tone}`}>{status}</span>
}

// --- PLS: pattern de listagem completa ---------------------------------

function ListPatternA() {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold text-slate-900">Pedidos</p>
        <button className="flex items-center gap-1 rounded-md bg-[#00A5E6] px-2 py-1 text-[10px] font-medium text-white">
          <Plus className="size-3" />
          Novo
        </button>
      </div>
      <div className="grid grid-cols-2 gap-1.5 rounded-lg border border-sky-100 bg-sky-50/40 p-2">
        <input placeholder="Cliente" className="h-6 rounded border border-slate-300 bg-white px-1.5 text-[10px]" />
        <input placeholder="Status" className="h-6 rounded border border-slate-300 bg-white px-1.5 text-[10px]" />
      </div>
      <div className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
        {ROWS.map((r) => (
          <div key={r.cliente} className="flex items-center justify-between px-2 py-1.5 text-[10px]">
            <span className="text-slate-700">{r.cliente}</span>
            <MiniStatus status={r.status} />
          </div>
        ))}
      </div>
    </div>
  )
}

function ListPatternB() {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold text-slate-900">Pedidos</p>
        <button className="flex items-center gap-1 rounded-md bg-[#00A5E6] px-2 py-1 text-[10px] font-medium text-white">
          <Plus className="size-3" />
          Novo
        </button>
      </div>
      <div className="flex items-center gap-1.5 rounded-md border border-slate-200 p-1">
        <Search className="size-3 text-slate-400" />
        <input placeholder="Buscar..." className="flex-1 text-[10px] outline-none" />
        <button className="rounded bg-[#00A5E6] px-2 py-0.5 text-[10px] font-medium text-white">Filtrar</button>
      </div>
      <div className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
        {ROWS.map((r) => (
          <div key={r.cliente} className="flex items-center justify-between px-2 py-1.5 text-[10px]">
            <span className="text-slate-700">{r.cliente}</span>
            <MiniStatus status={r.status} />
          </div>
        ))}
      </div>
    </div>
  )
}

function ListPatternC() {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold text-slate-900">Pedidos</p>
        <div className="flex items-center gap-1.5">
          <button className="flex items-center gap-1 rounded-md border border-slate-300 px-2 py-1 text-[10px] font-medium text-slate-600">
            <SlidersHorizontal className="size-3" />
            Filtros
          </button>
          <button className="flex items-center gap-1 rounded-md bg-[#00A5E6] px-2 py-1 text-[10px] font-medium text-white">
            <Plus className="size-3" />
            Novo
          </button>
        </div>
      </div>
      <div className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
        {ROWS.map((r) => (
          <div key={r.cliente} className="flex items-center justify-between px-2 py-1.5 text-[10px]">
            <span className="text-slate-700">{r.cliente}</span>
            <MiniStatus status={r.status} />
          </div>
        ))}
      </div>
    </div>
  )
}

// --- PFM: pattern de formulário completo --------------------------------

function FormPatternA() {
  return (
    <div className="space-y-2">
      <p className="text-xs font-bold text-slate-900">Novo pedido</p>
      {['Identificação', 'Fornecedor', 'Anexos'].map((s) => (
        <div key={s} className="rounded-lg border border-slate-200 p-2">
          <p className="mb-1 text-[10px] font-semibold text-slate-700">{s}</p>
          <div className="h-5 rounded border border-slate-200 bg-slate-50" />
        </div>
      ))}
    </div>
  )
}

function FormPatternB() {
  return (
    <div className="space-y-2">
      <p className="text-xs font-bold text-slate-900">Novo pedido</p>
      <div className="grid grid-cols-2 gap-1.5">
        {['Identificação', 'Fornecedor', 'Anexos', 'Revisão'].map((s) => (
          <div key={s} className="rounded-lg border border-slate-200 p-1.5">
            <p className="mb-1 text-[9px] font-semibold text-slate-700">{s}</p>
            <div className="h-4 rounded border border-slate-200 bg-slate-50" />
          </div>
        ))}
      </div>
    </div>
  )
}

function FormPatternC() {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold text-slate-900">Novo pedido</p>
        <span className="text-[9px] text-slate-500">Etapa 2 de 3</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-slate-200">
        <div className="h-full w-2/3 rounded-full bg-[#00A5E6]" />
      </div>
      <div className="rounded-lg border border-slate-200 p-2">
        <p className="mb-1 text-[10px] font-semibold text-slate-700">Fornecedor</p>
        <div className="h-5 rounded border border-slate-200 bg-slate-50" />
      </div>
      <div className="flex justify-between">
        <button className="rounded border border-slate-300 px-2 py-1 text-[9px] text-slate-600">Voltar</button>
        <button className="rounded bg-[#00A5E6] px-2 py-1 text-[9px] font-medium text-white">
          Próximo
          <ChevronRight className="ml-0.5 inline size-2.5" />
        </button>
      </div>
    </div>
  )
}

// --- PKS: pattern de seção de KPIs ---------------------------------------

function KpiPatternA() {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-1.5">
        {['24', '3', 'R$ 12k'].map((v, i) => (
          <div key={i} className="rounded-lg border border-slate-200 bg-white p-1.5 text-center">
            <p className="text-sm font-bold text-slate-900">{v}</p>
          </div>
        ))}
      </div>
      <div className="flex h-12 items-end gap-1 rounded-lg border border-slate-200 bg-white p-2">
        {[40, 70, 55, 90, 60].map((h, i) => (
          <div key={i} className="flex-1 rounded-t bg-[#00A5E6]/60" style={{ height: `${h}%` }} />
        ))}
      </div>
    </div>
  )
}

function KpiPatternB() {
  return (
    <div className="flex gap-2">
      <div className="flex w-16 shrink-0 flex-col gap-1.5">
        {['24', '3', 'R$ 12k'].map((v, i) => (
          <div key={i} className="rounded-lg border border-slate-200 bg-white p-1.5 text-center">
            <p className="text-xs font-bold text-slate-900">{v}</p>
          </div>
        ))}
      </div>
      <div className="flex flex-1 items-end gap-1 rounded-lg border border-slate-200 bg-white p-2">
        {[40, 70, 55, 90, 60].map((h, i) => (
          <div key={i} className="flex-1 rounded-t bg-[#00A5E6]/60" style={{ height: `${h}%` }} />
        ))}
      </div>
    </div>
  )
}

function KpiPatternC() {
  return (
    <div className="space-y-2">
      <div className="flex gap-1 rounded-full bg-[#00A5E6]/10 p-0.5 text-[9px] font-medium">
        <span className="flex-1 rounded-full bg-white py-1 text-center shadow-sm">Operacional</span>
        <span className="flex-1 py-1 text-center text-slate-500">Financeiro</span>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        {['24 pedidos', '3 atrasados'].map((v) => (
          <div key={v} className="rounded-lg border border-slate-200 bg-white p-1.5 text-center text-[10px] font-semibold text-slate-800">
            {v}
          </div>
        ))}
      </div>
    </div>
  )
}

export function PatternsSection() {
  return (
    <div className="space-y-10">
      <DecisionBlock
        code="PLS"
        title="Pattern: listagem completa"
        description="Header + filtros + linhas + ação, como um bloco só — não peças isoladas."
        options={[
          { letter: 'A', label: 'Filtros sempre visíveis', note: 'Tudo exposto de uma vez — mais previsível, ocupa mais espaço.', content: <ListPatternA /> },
          { letter: 'B', label: 'Barra compacta', note: 'Filtro simplificado em uma linha — mais espaço para os dados.', content: <ListPatternB /> },
          { letter: 'C', label: 'Filtros colapsáveis', note: 'Filtros escondidos por padrão — view inicial mais limpa.', content: <ListPatternC /> },
        ]}
      />

      <DecisionBlock
        code="PFM"
        title="Pattern: formulário completo"
        description="Como um formulário longo é organizado na página inteira."
        options={[
          { letter: 'A', label: 'Coluna única', note: 'Uma seção após a outra, scroll vertical — como a Ficha de Atendimento.', content: <FormPatternA /> },
          { letter: 'B', label: 'Cards por seção', note: 'Seções em grid, várias visíveis ao mesmo tempo — como /pedidos-personalizados/novo.', content: <FormPatternB /> },
          { letter: 'C', label: 'Wizard por etapas', note: 'Um passo por vez, com barra de progresso — reduz carga cognitiva.', content: <FormPatternC /> },
        ]}
      />

      <DecisionBlock
        code="PKS"
        title="Pattern: seção de KPIs"
        description="Como KPIs e gráfico se relacionam na mesma seção de uma página."
        options={[
          { letter: 'A', label: 'KPIs em cima, gráfico embaixo', note: 'Padrão atual do dashboard.', content: <KpiPatternA /> },
          { letter: 'B', label: 'KPIs ao lado do gráfico', note: 'Coluna estreita de números + gráfico ocupando o restante.', content: <KpiPatternB /> },
          { letter: 'C', label: 'KPIs por contexto (abas)', note: 'Troca o conjunto de métricas exibido por abas — bom quando há muitos KPIs.', content: <KpiPatternC /> },
        ]}
      />
    </div>
  )
}
