import { ChevronRight, PackageSearch, Plus } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DecisionBlock } from '../DecisionBlock'

function HeaderA() {
  return (
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex items-start gap-2.5">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#00A5E6] text-white">
          <PackageSearch className="size-4" />
        </span>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[#00A5E6]">Pedidos personalizados</p>
          <h2 className="text-base font-bold text-slate-900">Gestão de pedidos</h2>
          <p className="text-xs text-slate-500">Consulte, revise e atualize pedidos.</p>
        </div>
      </div>
      <button className="flex items-center gap-1 rounded-md bg-[#00A5E6] px-2.5 py-1.5 text-xs font-medium text-white">
        <Plus className="size-3.5" />
        Novo
      </button>
    </header>
  )
}

function HeaderB() {
  return (
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 className="text-base font-bold text-slate-900">Gestão de pedidos</h2>
        <p className="text-xs text-slate-500">Consulte, revise e atualize pedidos.</p>
      </div>
      <button className="flex items-center gap-1 rounded-md bg-[#00A5E6] px-2.5 py-1.5 text-xs font-medium text-white">
        <Plus className="size-3.5" />
        Novo
      </button>
    </header>
  )
}

function HeaderC() {
  return (
    <header className="space-y-2">
      <nav className="flex items-center gap-1 text-[10px] text-slate-400">
        <span>Início</span>
        <ChevronRight className="size-3" />
        <span className="font-medium text-slate-600">Pedidos personalizados</span>
      </nav>
      <h2 className="text-base font-bold text-slate-900">Gestão de pedidos</h2>
      <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5">
        <span className="text-[11px] text-slate-500">3 filtros ativos</span>
        <button className="flex items-center gap-1 rounded-md bg-[#00A5E6] px-2.5 py-1 text-xs font-medium text-white">
          <Plus className="size-3.5" />
          Novo
        </button>
      </div>
    </header>
  )
}

const tabItems = [
  { value: 'abertos', label: 'Abertos' },
  { value: 'producao', label: 'Em produção' },
  { value: 'finalizados', label: 'Finalizados' },
]

function TabsA() {
  return (
    <Tabs defaultValue="abertos">
      <TabsList>
        {tabItems.map((t) => (
          <TabsTrigger key={t.value} value={t.value}>
            {t.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  )
}

function TabsB() {
  return (
    <Tabs defaultValue="abertos">
      <TabsList className="h-auto gap-4 rounded-none bg-transparent p-0">
        {tabItems.map((t) => (
          <TabsTrigger
            key={t.value}
            value={t.value}
            className="rounded-none border-b-2 border-transparent bg-transparent px-0.5 pb-2 text-slate-500 shadow-none data-[state=active]:border-[#00A5E6] data-[state=active]:bg-transparent data-[state=active]:text-[#00A5E6] data-[state=active]:shadow-none"
          >
            {t.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  )
}

function TabsC() {
  return (
    <Tabs defaultValue="abertos">
      <TabsList className="h-auto w-full gap-0 rounded-full bg-[#00A5E6]/10 p-1">
        {tabItems.map((t) => (
          <TabsTrigger
            key={t.value}
            value={t.value}
            className="flex-1 rounded-full data-[state=active]:bg-[#00A5E6] data-[state=active]:text-white data-[state=active]:shadow-none"
          >
            {t.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  )
}

export function NavigationSection() {
  return (
    <div className="space-y-10">
      <DecisionBlock
        code="HDR"
        title="Page header"
        description="Composição de título, descrição e ação principal no topo de uma página."
        options={[
          {
            letter: 'A',
            label: 'Atual (badge + eyebrow)',
            note: 'Ícone em badge sólido + categoria acima do título — padrão de /pedidos-personalizados.',
            content: <HeaderA />,
          },
          {
            letter: 'B',
            label: 'Simples',
            note: 'Só título + descrição + ação, sem badge de ícone — padrão do dashboard/chamados-finalizados.',
            content: <HeaderB />,
          },
          {
            letter: 'C',
            label: 'Com breadcrumb + barra de ações',
            note: 'Trilha de navegação acima do título; ações e contexto de filtro em barra própria abaixo.',
            content: <HeaderC />,
          },
        ]}
      />

      <DecisionBlock
        code="TAB"
        title="Tabs / navegação de seção"
        description="Como alternar entre visões dentro da mesma página (ex.: Abertos / Em produção / Finalizados)."
        options={[
          {
            letter: 'A',
            label: 'Pills (atual)',
            note: 'Componente Tabs já existente — fundo neutro, aba ativa em card branco.',
            content: <TabsA />,
          },
          {
            letter: 'B',
            label: 'Underline',
            note: 'Texto simples com linha inferior na aba ativa — padrão hoje em Recebimento (custom).',
            content: <TabsB />,
          },
          {
            letter: 'C',
            label: 'Segmentado tonal',
            note: 'Controle segmentado cheio, aba ativa preenchida com a cor de marca.',
            content: <TabsC />,
          },
        ]}
      />
    </div>
  )
}
