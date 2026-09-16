import { ChevronDown, Search, SlidersHorizontal, TrendingUp } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { DecisionBlock } from '../DecisionBlock'
import { ResponsivePreview } from '../ResponsivePreview'

const ROWS = [
  { cliente: 'Ana Souza', pedido: '#4821', status: 'Em produção', valor: 'R$ 1.240,00' },
  { cliente: 'Carlos Lima', pedido: '#4822', status: 'Aguardando', valor: 'R$ 890,00' },
  { cliente: 'Beatriz Alves', pedido: '#4823', status: 'Concluído', valor: 'R$ 2.150,00' },
]

function statusTone(status: string) {
  if (status === 'Concluído') return 'bg-emerald-50 text-emerald-700'
  if (status === 'Aguardando') return 'bg-amber-50 text-amber-700'
  return 'bg-sky-50 text-sky-700'
}

// --- KPI -------------------------------------------------------------

function KpiA() {
  return (
    <div className="grid grid-cols-2 gap-2">
      {[{ l: 'Pedidos hoje', v: '24' }, { l: 'Em atraso', v: '3' }].map((k) => (
        <div key={k.l} className="rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm">
          <p className="text-[10px] text-slate-500">{k.l}</p>
          <p className="text-lg font-bold text-slate-900">{k.v}</p>
        </div>
      ))}
    </div>
  )
}

function KpiB() {
  return (
    <div className="grid grid-cols-2 gap-2">
      {[
        { l: 'Pedidos hoje', v: '24', delta: '+12%', up: true },
        { l: 'Em atraso', v: '3', delta: '-8%', up: false },
      ].map((k) => (
        <div key={k.l} className="rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-[10px] text-slate-500">{k.l}</p>
            <TrendingUp className={`size-3 ${k.up ? 'text-emerald-500' : 'rotate-180 text-red-500'}`} />
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <p className="text-lg font-bold text-slate-900">{k.v}</p>
            <span className={`text-[10px] font-semibold ${k.up ? 'text-emerald-600' : 'text-red-600'}`}>{k.delta}</span>
          </div>
        </div>
      ))}
    </div>
  )
}

function KpiC() {
  return (
    <div className="flex divide-x divide-slate-200 rounded-xl border border-slate-200 bg-white">
      {[{ l: 'Pedidos hoje', v: '24' }, { l: 'Em atraso', v: '3' }].map((k) => (
        <div key={k.l} className="flex-1 px-2.5 py-2 text-center">
          <p className="text-[10px] text-slate-500">{k.l}</p>
          <p className="text-base font-bold text-slate-900">{k.v}</p>
        </div>
      ))}
    </div>
  )
}

// --- Tabela / listagem (com mobile) -----------------------------------

function TableDesktop() {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Cliente</TableHead>
          <TableHead>Pedido</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Valor</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {ROWS.map((r) => (
          <TableRow key={r.pedido}>
            <TableCell className="text-xs">{r.cliente}</TableCell>
            <TableCell className="text-xs">{r.pedido}</TableCell>
            <TableCell>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusTone(r.status)}`}>{r.status}</span>
            </TableCell>
            <TableCell className="text-xs">{r.valor}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function MobileScroll() {
  return (
    <div className="overflow-x-auto">
      <table className="w-[420px] text-[10px]">
        <thead>
          <tr className="border-b border-slate-200 text-slate-500">
            <th className="px-1.5 py-1 text-left">Cliente</th>
            <th className="px-1.5 py-1 text-left">Pedido</th>
            <th className="px-1.5 py-1 text-left">Status</th>
            <th className="px-1.5 py-1 text-left">Valor</th>
          </tr>
        </thead>
        <tbody>
          {ROWS.map((r) => (
            <tr key={r.pedido} className="border-b border-slate-100">
              <td className="px-1.5 py-1.5">{r.cliente}</td>
              <td className="px-1.5 py-1.5">{r.pedido}</td>
              <td className="px-1.5 py-1.5">
                <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${statusTone(r.status)}`}>{r.status}</span>
              </td>
              <td className="px-1.5 py-1.5">{r.valor}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-1 text-center text-[9px] italic text-slate-400">← arraste para o lado →</p>
    </div>
  )
}

function MobileCards() {
  return (
    <div className="space-y-1.5">
      {ROWS.map((r) => (
        <div key={r.pedido} className="rounded-lg border border-slate-200 p-1.5">
          <div className="flex items-center justify-between">
            <p className="font-semibold text-slate-800">{r.cliente}</p>
            <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${statusTone(r.status)}`}>{r.status}</span>
          </div>
          <p className="mt-0.5 text-slate-500">{r.pedido} · {r.valor}</p>
        </div>
      ))}
    </div>
  )
}

function MobileExpandable() {
  return (
    <div className="space-y-1">
      {ROWS.map((r, i) => (
        <details key={r.pedido} open={i === 0} className="rounded-lg border border-slate-200 [&_summary::-webkit-details-marker]:hidden">
          <summary className="flex cursor-pointer list-none items-center justify-between px-1.5 py-1.5">
            <span className="font-semibold text-slate-800">{r.cliente}</span>
            <ChevronDown className="size-3 text-slate-400" />
          </summary>
          <div className="space-y-0.5 border-t border-slate-100 px-1.5 py-1.5 text-slate-500">
            <p>Pedido: {r.pedido}</p>
            <p>Valor: {r.valor}</p>
            <span className={`inline-block rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${statusTone(r.status)}`}>{r.status}</span>
          </div>
        </details>
      ))}
    </div>
  )
}

// --- Filtros ------------------------------------------------------------

function FiltersA() {
  return (
    <div className="space-y-2 rounded-xl border border-sky-100 bg-sky-50/40 p-2.5">
      <div className="flex items-center gap-1.5">
        <Search className="size-3 text-slate-400" />
        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Busca</p>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        <input placeholder="Cliente" className="h-6 rounded border border-slate-300 bg-white px-1.5 text-[10px]" />
        <input placeholder="Pedido" className="h-6 rounded border border-slate-300 bg-white px-1.5 text-[10px]" />
      </div>
      <div className="flex items-center gap-1.5 pt-1">
        <SlidersHorizontal className="size-3 text-slate-400" />
        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Status</p>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        <input placeholder="Status" className="h-6 rounded border border-slate-300 bg-white px-1.5 text-[10px]" />
        <input placeholder="Data" className="h-6 rounded border border-slate-300 bg-white px-1.5 text-[10px]" />
      </div>
    </div>
  )
}

function FiltersB() {
  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-slate-200 bg-white p-1.5">
      <div className="flex h-6 flex-1 items-center gap-1 rounded border border-slate-300 px-1.5">
        <Search className="size-3 text-slate-400" />
        <input placeholder="Buscar..." className="w-full text-[10px] outline-none" />
      </div>
      <select className="h-6 rounded border border-slate-300 px-1 text-[10px]">
        <option>Status</option>
      </select>
      <button className="h-6 rounded bg-[#00A5E6] px-2 text-[10px] font-medium text-white">Filtrar</button>
    </div>
  )
}

function FiltersC() {
  return (
    <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-1.5">
      <span className="text-[10px] text-slate-500">Mostrando 24 pedidos</span>
      <Popover>
        <PopoverTrigger asChild>
          <button className="flex items-center gap-1 rounded-md border border-slate-300 px-2 py-1 text-[10px] font-medium text-slate-700">
            <SlidersHorizontal className="size-3" />
            Filtros
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-56 p-3 text-xs">
          <p className="mb-2 text-[10px] font-semibold uppercase text-slate-500">Filtrar por</p>
          <div className="space-y-1.5">
            <input placeholder="Cliente" className="h-7 w-full rounded border border-slate-300 px-2 text-[11px]" />
            <input placeholder="Status" className="h-7 w-full rounded border border-slate-300 px-2 text-[11px]" />
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}

export function DataSection() {
  return (
    <div className="space-y-10">
      <DecisionBlock
        code="KPI"
        title="Cards de KPI"
        description="Como um número-chave (KPI) é exibido no topo de uma tela."
        options={[
          { letter: 'A', label: 'Atual', note: 'Label pequeno + número grande — padrão de hoje no dashboard.', content: <KpiA /> },
          { letter: 'B', label: 'Com variação', note: 'Inclui ícone e indicador de tendência (%) frente ao período anterior.', content: <KpiB /> },
          { letter: 'C', label: 'Faixa compacta', note: 'KPIs lado a lado em uma única faixa — menos espaço vertical.', content: <KpiC /> },
        ]}
      />

      <DecisionBlock
        code="TBL"
        title="Tabela / listagem"
        description="Como a mesma tabela se comporta no mobile — não é só reduzir, é reorganizar. Desktop é a mesma tabela nas 3 opções; o que muda é o mobile."
        options={[
          {
            letter: 'A',
            label: 'Scroll horizontal',
            note: 'Estratégia dominante hoje no sistema (dashboard, chamados, hub-vendas, recebimento).',
            content: <ResponsivePreview desktop={<TableDesktop />} mobile={<MobileScroll />} />,
          },
          {
            letter: 'B',
            label: 'Cards no mobile',
            note: 'Cada linha vira um card empilhado — já usado no catálogo de produtos de /pedidos-personalizados.',
            content: <ResponsivePreview desktop={<TableDesktop />} mobile={<MobileCards />} />,
          },
          {
            letter: 'C',
            label: 'Linhas resumidas expansíveis',
            note: 'Resumo por linha, expande ao tocar para ver os detalhes completos.',
            content: <ResponsivePreview desktop={<TableDesktop />} mobile={<MobileExpandable />} />,
          },
        ]}
      />

      <DecisionBlock
        code="FLT"
        title="Filtros"
        description="Como os campos de filtro de uma listagem são apresentados."
        options={[
          {
            letter: 'A',
            label: 'Seções agrupadas',
            note: 'Filtros sempre visíveis, agrupados por categoria — padrão de /pedidos-personalizados.',
            content: <FiltersA />,
          },
          {
            letter: 'B',
            label: 'Barra compacta',
            note: 'Tudo em uma linha só — busca + selects + botão, mais compacto.',
            content: <FiltersB />,
          },
          {
            letter: 'C',
            label: 'Painel colapsável',
            note: 'Filtros escondidos por padrão, abrem em um painel ao clicar — view principal fica mais limpa.',
            content: <FiltersC />,
          },
        ]}
      />
    </div>
  )
}
