'use client'

import * as React from 'react'
import { BookOpenText, LayoutTemplate, Package, Pencil, Search, Trash2, User } from 'lucide-react'
import {
  Alert,
  Badge,
  Button,
  Combobox,
  DateField,
  EmptyState,
  FilterFieldGroup,
  FilterPanel,
  FormErrorSummary,
  FormField,
  FormPageContent,
  IconButton,
  Input,
  KpiCard,
  LoadingLeBebe,
  PageHeader,
  ResponsiveTable,
  Section,
  useAsyncAction,
  useFilterState,
} from '@/components/design-system'
import { Dialog, DialogContent, DialogHeader, DialogBody, DialogTrigger } from '@/components/design-system/Dialog'
import { MultiSelect } from '@/components/ui/multi-select'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/design-system/Card'
import { Tabs, TabsContent } from '@/components/ui/tabs'
import { SegmentedTabsList, SegmentedTabsTrigger } from '@/components/design-system/SegmentedTabs'
import { ChevronLeft, ChevronRight, Star, Sparkles, LayoutGrid } from 'lucide-react'
import { TABLE_PAGE_SIZE } from '@/lib/design-system/pagination'
import { getSectionToneAt } from '@/lib/design-system/section-tones'
import { cn } from '@/lib/utils'

const MOCK_ROWS = [
  { id: '1', cliente: 'Ana Souza', status: 'Em produção' as const },
  { id: '2', cliente: 'Carlos Lima', status: 'Concluído' as const },
]

function ButtonDemo() {
  const save = useAsyncAction(async () => new Promise<void>((r) => setTimeout(r, 1200)))
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button loading={save.loading} onClick={() => save.run()}>
        {save.success ? 'Salvo!' : 'Salvar pedido'}
      </Button>
      <Button variant="secondary">Secundário</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="destructive">Excluir</Button>
      <IconButton aria-label="Editar" variant="secondary">
        <Pencil className="size-4" />
      </IconButton>
    </div>
  )
}

function FormDemo() {
  const [nome, setNome] = React.useState('')
  const [data, setData] = React.useState('')
  const [tentouSalvar, setTentouSalvar] = React.useState(false)
  const erroNome = tentouSalvar && nome.trim() === '' ? 'Campo obrigatório.' : undefined
  const errors = { nome: erroNome }

  return (
    <div className="space-y-3">
      <FormErrorSummary errors={errors} onFocusField={(f) => document.getElementById(f)?.focus()} />
      <FormField id="ref-nome" label="Nome do cliente" required error={erroNome}>
        {(f) => <Input {...f} value={nome} onChange={(e) => setNome(e.target.value)} />}
      </FormField>
      <FormField id="ref-data" label="Data de entrega" helper="Digite ou use o calendário.">
        {(f) => <DateField {...f} value={data} onChange={setData} />}
      </FormField>
      <Button size="sm" onClick={() => setTentouSalvar(true)}>
        Validar
      </Button>
    </div>
  )
}

function ComboboxDemo() {
  const options = ['Ana Souza', 'Ana Paula Lima', 'Beatriz Alves', 'Carlos Lima']
  const [value, setValue] = React.useState<{ value: string; label: string } | null>(null)
  return (
    <Combobox
      value={value}
      onChange={setValue}
      onSearch={(q) =>
        new Promise((resolve) =>
          setTimeout(() => resolve(options.filter((o) => o.toLowerCase().includes(q.toLowerCase())).map((o) => ({ value: o, label: o }))), 350)
        )
      }
      placeholder="Buscar cliente..."
    />
  )
}

function FilterDemo() {
  const filters = useFilterState({ cliente: '', status: 'todos', dataInicio: '' })
  const [resultCount, setResultCount] = React.useState(2)
  const [filiais, setFiliais] = React.useState<string[]>([])
  const filiaisDemo = ['Bigorrilho', 'Feira', 'Marechal', 'Portão', 'Centro', 'Cabral', 'Juvevê', 'Mercês', 'Batel', 'Água Verde', 'Santa Felicidade', 'Cajuru']
  return (
    <FilterPanel
      dirty={filters.dirty}
      onApply={() => {
        filters.apply()
        setResultCount(filters.draft.cliente ? 1 : 2)
      }}
      onClear={() => {
        filters.clear()
        setResultCount(2)
      }}
    >
      <FilterFieldGroup label="Busca" icon={<Search className="size-4 text-slate-400" />}>
        <Input value={filters.draft.cliente} onChange={(e) => filters.setField('cliente', e.target.value)} placeholder="Cliente" />
        <DateField value={filters.draft.dataInicio} onChange={(v) => filters.setField('dataInicio', v)} placeholder="dd/mm/aaaa" />
        <Select value={filters.draft.status} onValueChange={(v) => filters.setField('status', v)}>
          <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os status</SelectItem>
            <SelectItem value="aberto">Aberto</SelectItem>
            <SelectItem value="fechado">Fechado</SelectItem>
          </SelectContent>
        </Select>
        <MultiSelect options={filiaisDemo} selected={filiais} onChange={setFiliais} placeholder="Selecione filiais..." />
      </FilterFieldGroup>
      <p className="text-xs text-slate-500">
        Mostrando {resultCount} pedidos (só muda ao clicar em Filtrar). Input, DateField e Select
        pertencem à mesma família visual (superfície e borda — `FORM-CONTROL-SURFACE`). O
        MultiSelect é um trigger inteiro clicável e abre por Popover/Portal, então suas opções
        longas rolam fora do recorte do painel. Use
        &quot;Recolher&quot;/&quot;Mostrar filtros&quot; no canto superior direito do painel — o
        painel inicia expandido e nunca se recolhe sozinho; &quot;Filtrar&quot; fica ancorado à
        direita do rodapé (`FLT-ACTION-ALIGN=A`).
      </p>
    </FilterPanel>
  )
}

function TableDemo() {
  return (
    <ResponsiveTable
      columns={[
        { key: 'cliente', header: 'Cliente', render: (r) => r.cliente },
        { key: 'status', header: 'Status', render: (r) => <Badge tone={r.status === 'Concluído' ? 'success' : 'info'}>{r.status}</Badge> },
      ]}
      rows={MOCK_ROWS}
      rowKey={(r) => r.id}
      renderMobileCard={(r) => (
        <div className="flex items-center justify-between">
          <p className="font-semibold text-slate-800">{r.cliente}</p>
          <Badge tone={r.status === 'Concluído' ? 'success' : 'info'}>{r.status}</Badge>
        </div>
      )}
      rowActions={() => (
        <IconButton aria-label="Excluir" variant="ghost" size="sm">
          <Trash2 className="size-3.5 text-red-400" />
        </IconButton>
      )}
    />
  )
}

const WIDE_ROWS = Array.from({ length: 9 }).map((_, i) => ({
  id: String(i),
  cliente: i === 5 ? 'Ana Toledo | Biramar Baby Atacado (2255)' : `Cliente ${i + 1}`,
  loja: 'Unidade Centro',
  consultora: 'Ana Souza',
  descricao: i === 3 ? 'Cliente pediu para reagendar a entrega para depois das 18h, telefone sem sinal durante o dia — confirmar por WhatsApp antes de sair para entrega.' : 'Sem observações adicionais para este registro.',
  total: 12 + i,
  abertos: i === 3 || i === 8 ? 0 : 3,
  finalizados: 8,
  erro: 1,
}))

function WideTableDemo() {
  const [page, setPage] = React.useState(1)
  const lastPage = 3
  return (
    <div className="space-y-2">
      <ResponsiveTable
        columns={[
          { key: 'cliente', header: 'Cliente', width: 'content', render: (r) => r.cliente },
          { key: 'loja', header: 'Loja', width: 'standard', render: (r) => r.loja },
          { key: 'consultora', header: 'Consultora', width: 'standard', render: (r) => r.consultora },
          { key: 'descricao', header: 'Descrição', width: 'fill', render: (r) => r.descricao },
          { key: 'total', header: 'Qtd total', width: 'compact', render: (r) => <Badge tone="neutral">{r.total}</Badge> },
          { key: 'abertos', header: 'Qtd aberto', width: 'compact', render: (r) => <Badge tone="success">{r.abertos}</Badge> },
          { key: 'finalizados', header: 'Qtd finalizados', width: 'compact', render: (r) => <Badge tone="info">{r.finalizados}</Badge> },
          { key: 'erro', header: 'Qtd erro', width: 'compact', render: (r) => <Badge tone="danger">{r.erro}</Badge> },
        ]}
        rows={WIDE_ROWS}
        rowKey={(r) => r.id}
        rowTone={(r) => (r.abertos === 0 ? 'danger' : undefined)}
        firstColumnSticky
        renderMobileCard={(r) => (
          <div>
            <p className="font-semibold text-slate-800">{r.cliente}</p>
            <p className="text-xs text-slate-500">{r.loja} · {r.consultora}</p>
          </div>
        )}
      />
      <div className="flex items-center justify-between text-xs text-slate-500">
        <p>Página {page} de {lastPage} · máx. {TABLE_PAGE_SIZE} registros/página (aqui, 9 de exemplo)</p>
        <div className="flex items-center gap-1.5">
          <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            <ChevronLeft className="size-3.5" /> Anterior
          </Button>
          <Button variant="secondary" size="sm" disabled={page >= lastPage} onClick={() => setPage((p) => p + 1)}>
            Próxima <ChevronRight className="size-3.5" />
          </Button>
        </div>
      </div>
    </div>
  )
}

const INTRINSIC_ROWS = [
  { id: '1', nome: 'Ana', loja: 'Centro', status: 'Ativo' as const },
  { id: '2', nome: 'Carlos Eduardo Lima Ferreira', loja: 'Norte', status: 'Ativo' as const },
  { id: '3', nome: 'Ana Toledo | Biramar Baby Atacado (2255)', loja: 'Sul', status: 'Inativo' as const },
]

/** Demo isolada de NO-CELL-OVERLAP: coluna `content` cresce pelo maior nome real (sem cortar, sem invadir "Loja"), mesmo com nomes de comprimentos bem diferentes. */
function IntrinsicColumnDemo() {
  return (
    <ResponsiveTable
      columns={[
        { key: 'nome', header: 'Nome', width: 'content', render: (r) => r.nome },
        { key: 'loja', header: 'Loja', width: 'standard', render: (r) => r.loja },
        { key: 'status', header: 'Status', width: 'compact', render: (r) => <Badge tone={r.status === 'Ativo' ? 'success' : 'neutral'}>{r.status}</Badge> },
      ]}
      rows={INTRINSIC_ROWS}
      rowKey={(r) => r.id}
      renderMobileCard={(r) => (
        <div>
          <p className="font-semibold text-slate-800">{r.nome}</p>
          <p className="text-xs text-slate-500">{r.loja} · {r.status}</p>
        </div>
      )}
    />
  )
}

function SectionDemo() {
  return (
    <div className="space-y-2">
      {['Dados do cliente', 'Dados do pedido', 'Entrega', 'Preferências', 'Pagamento', 'Observações'].map((title, index) => (
        <Section key={title} tone={getSectionToneAt(index)} collapsible={index === 3} title={title} description={index === 3 ? 'Exemplo de seção extensa recolhível.' : undefined}>
          <p className="text-xs text-slate-600">Sequência {index + 1}: {getSectionToneAt(index)}. O conteúdo permanece preservado ao recolher.</p>
          {index === 3 && (
            <Section title="Produtos" variant="subsection" collapsible>
              <p className="text-xs text-slate-600">Subseção compacta: subordinada à Section principal, com expansão independente.</p>
            </Section>
          )}
        </Section>
      ))}
    </div>
  )
}

/**
 * Comparação permanente: Section tones (CLR=B, derivadas da marca) ×
 * cores semânticas (info/warning/success/destructive) — mantém visível a
 * validação de que "brand blue/cyan ≠ info" e "brand yellow ≠ warning"
 * continuam distintas mesmo após a paleta virar oficial (Brand
 * Foundation, D-042). Pares por RISCO real: section-1 (azul) e section-2
 * (ciano) contra `info` (ambos são "família azul"); section-3 (amarelo)
 * contra `warning` (ambos são "família amarela/âmbar"). `success` e
 * `destructive` entram só como referência — nenhuma section usa
 * verde/vermelho.
 */
function SectionVsSemanticDemo() {
  const pairs: Array<{
    tone: 'section-1' | 'section-2' | 'section-3'
    toneLabel: string
    semanticTone: 'info' | 'warning'
    semanticLabel: string
    alertTitle: string
    alertBody: string
  }> = [
    { tone: 'section-1', toneLabel: 'Section 1 — azul da marca', semanticTone: 'info', semanticLabel: 'Info', alertTitle: 'Informação', alertBody: 'Este campo será utilizado na próxima etapa.' },
    { tone: 'section-2', toneLabel: 'Section 2 — ciano da marca', semanticTone: 'info', semanticLabel: 'Info', alertTitle: 'Informação', alertBody: 'Este campo será utilizado na próxima etapa.' },
    { tone: 'section-3', toneLabel: 'Section 3 — amarelo da estrela', semanticTone: 'warning', semanticLabel: 'Warning', alertTitle: 'Atenção', alertBody: 'Existem informações que precisam de revisão.' },
  ]

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2">
        {pairs.map((p, i) => (
          <React.Fragment key={`${p.tone}-${i}`}>
            <div>
              <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">{p.toneLabel} (organização, CLR=B)</p>
              <Section tone={p.tone} title="Dados do cliente" description="Informações cadastrais e contato.">
                <div className="h-5 rounded border border-slate-200 bg-white" />
              </Section>
            </div>
            <div>
              <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">{p.semanticLabel} (estado/feedback)</p>
              <Alert tone={p.semanticTone} title={p.alertTitle}>
                {p.alertBody}
              </Alert>
            </div>
          </React.Fragment>
        ))}
      </div>

      <div>
        <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">
          Referência: success/destructive (nenhuma section usa essas famílias)
        </p>
        <div className="space-y-2">
          <Alert tone="success" title="Dados salvos">As alterações foram salvas com sucesso.</Alert>
          <Alert tone="danger" title="Não foi possível salvar">Ocorreu um erro ao processar a solicitação.</Alert>
        </div>
      </div>

      <div>
        <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">
          Tudo junto — organização (Section) vs. estado (Alert/Badge)
        </p>
        <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <Section tone="section-1" title="Section 1 — azul">
            <p className="text-xs text-slate-600">Bloco de organização — não é feedback.</p>
          </Section>
          <Section tone="section-2" title="Section 2 — ciano">
            <p className="text-xs text-slate-600">Bloco de organização — não é feedback.</p>
          </Section>
          <Section tone="section-3" title="Section 3 — amarelo">
            <p className="text-xs text-slate-600">Bloco de organização — não é feedback.</p>
          </Section>
          <Alert tone="info">Info — estado/feedback.</Alert>
          <Alert tone="success">Success — estado/feedback.</Alert>
          <Alert tone="warning">Warning — estado/feedback.</Alert>
          <Alert tone="danger">Error — estado/feedback.</Alert>
          <div className="flex flex-wrap gap-1.5 pt-1">
            <Badge tone="info">info</Badge>
            <Badge tone="success">success</Badge>
            <Badge tone="warning">warning</Badge>
            <Badge tone="danger">danger</Badge>
          </div>
        </div>
      </div>
    </div>
  )
}

function InputSurfaceDemo() {
  return (
    <div className="grid grid-cols-2 gap-2 rounded-lg bg-slate-100 p-3 sm:grid-cols-3">
      <div>
        <p className="mb-1 text-[10px] text-slate-500">Normal</p>
        <Input placeholder="Nome do cliente" />
      </div>
      <div>
        <p className="mb-1 text-[10px] text-slate-500">Focus (clique aqui)</p>
        <Input placeholder="Clique para focar" />
      </div>
      <div>
        <p className="mb-1 text-[10px] text-slate-500">Erro</p>
        <Input aria-invalid defaultValue="valor inválido" />
      </div>
      <div>
        <p className="mb-1 text-[10px] text-slate-500">Disabled</p>
        <Input disabled defaultValue="Bloqueado" />
      </div>
      <div>
        <p className="mb-1 text-[10px] text-slate-500">Readonly</p>
        <Input readOnly defaultValue="Somente leitura" />
      </div>
      <div>
        <p className="mb-1 text-[10px] text-slate-500">Textarea</p>
        <textarea
          defaultValue="Observações"
          className="border-input bg-input-background flex min-h-9 w-full rounded-md border px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
        />
      </div>
    </div>
  )
}

function FilterGridDemo({ count }: { count: number }) {
  return (
    <div>
      <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">{count} filtro{count !== 1 ? 's' : ''}</p>
      <FilterFieldGroup label={`${count} campo${count !== 1 ? 's' : ''} visível${count !== 1 ? 'is' : ''}`}>
        {Array.from({ length: count }).map((_, i) => (
          <div key={i}>
            <label className="mb-1 block text-xs font-medium text-slate-700">Campo {i + 1}</label>
            <Input placeholder="..." />
          </div>
        ))}
      </FilterFieldGroup>
    </div>
  )
}

function LayoutShellPreview({ label, gutter }: { label: string; gutter: string }) {
  return (
    <div>
      <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">
        {label} · gutter {gutter}
      </p>
      <div className="flex overflow-hidden rounded-lg border border-slate-300 bg-white">
        <div className="w-6 shrink-0 bg-slate-800" title="Sidebar" />
        <div className="flex-1 bg-amber-100/60" style={{ padding: `4px ${gutter === '32px' ? 10 : gutter === '24px' ? 8 : 6}px` }}>
          <div className="space-y-1 rounded bg-white p-1.5 shadow-sm">
            <div className="h-2 w-1/2 rounded bg-slate-800" />
            <div className="h-1.5 w-full rounded bg-sky-100" />
            <div className="grid grid-cols-3 gap-1">
              <div className="h-3 rounded bg-slate-100" />
              <div className="h-3 rounded bg-slate-100" />
              <div className="h-3 rounded bg-slate-100" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function FormPageWidthDemo() {
  return (
    <div className="rounded-xl border border-dashed border-emerald-300 bg-white p-3">
      <p className="mb-3 text-center text-[10px] font-semibold uppercase tracking-wide text-slate-400">PageContainer full-width</p>
      <FormPageContent className="space-y-3 rounded-lg border border-emerald-200 bg-emerald-50/40 p-3">
        <p className="text-xs font-bold text-slate-900">Novo cadastro</p>
        <Section tone="section-1" title="Identificação" description="Mesmo eixo do header e das sections.">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {['Cliente', 'Unidade', 'Telefone'].map((label) => (
              <label key={label} className="space-y-1 text-xs font-medium text-slate-700">
                {label}
                <Input defaultValue={label === 'Cliente' ? 'Ana Souza' : ''} placeholder={label} />
              </label>
            ))}
          </div>
        </Section>
        <Section tone="section-2" title="Preferências">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {['Categoria', 'Prazo', 'Responsável'].map((label) => (
              <label key={label} className="space-y-1 text-xs font-medium text-slate-700">
                {label}
                <Input placeholder={label} />
              </label>
            ))}
          </div>
        </Section>
      </FormPageContent>
    </div>
  )
}

interface BrandSwatch {
  name: string
  role: string
  usage: string
  varName: string
  style?: React.CSSProperties
  className?: string
  darkText?: boolean
}

const BRAND_SWATCHES: BrandSwatch[] = [
  { name: 'Azul da marca', role: 'primary / dominante', usage: 'Ações primárias, links, itens ativos de navegação, foco, ícones importantes.', varName: '--color-brand', style: { background: 'var(--color-brand)' } },
  { name: 'Azul forte', role: 'apoio / contraste', usage: 'Reforço quando o azul padrão precisa de mais contraste (texto sobre claro, ícones de destaque).', varName: '--color-brand-strong', style: { background: 'var(--color-brand-strong)' } },
  { name: 'Ciano', role: 'secondary brand accent', usage: 'Accents secundários, ícones, surfaces leves, section-2.', varName: '--color-brand-secondary', style: { background: 'var(--color-brand-secondary)' } },
  { name: 'Amarelo da estrela', role: 'accent de marca', usage: 'Pequenos destaques, marcador de item especial — nunca cor dominante.', varName: '--color-brand-accent', darkText: true, style: { background: 'var(--color-brand-accent)' } },
  { name: 'Azul muito claro (ice)', role: 'surface leve', usage: 'Fundo sutil para destacar um bloco sem competir com o conteúdo.', varName: '--color-brand-light', darkText: true, style: { background: 'var(--color-brand-light)' }, className: 'border border-sky-100' },
  { name: 'Background', role: 'fundo da aplicação', usage: 'Cinza muito claro e frio — base neutra por trás de tudo.', varName: '--background', darkText: true, className: 'bg-background border border-slate-200' },
  { name: 'Surface (branco)', role: 'cards, menu, dialogs', usage: 'Superfície principal de conteúdo — a maioria da tela.', varName: '--card', darkText: true, className: 'bg-white border border-slate-200' },
  { name: 'Border / neutro', role: 'bordas, divisores', usage: 'Cinza azulado discreto — nunca chama atenção sozinho.', varName: '--border', darkText: true, className: 'bg-border border border-slate-300' },
  { name: 'Foreground', role: 'texto principal', usage: 'Azul-marinho/cinza muito escuro — legibilidade, não é uma cor "de marca" per se.', varName: '--foreground', style: { background: 'var(--foreground)' } },
]

function BrandPaletteDemo() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {BRAND_SWATCHES.map((s) => (
        <div key={s.name} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className={cn('flex h-16 items-end p-2', s.className)} style={s.style}>
            <code className={cn('rounded bg-black/10 px-1 py-0.5 text-[9px] font-mono', s.darkText ? 'text-slate-700' : 'text-white')}>
              {s.varName}
            </code>
          </div>
          <div className="p-2">
            <p className="text-xs font-semibold text-slate-800">{s.name}</p>
            <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">{s.role}</p>
            <p className="mt-1 text-[10px] text-slate-500">{s.usage}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

function BrandApplicationsDemo() {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button size="sm">Ação primary (azul)</Button>
        <Button size="sm" variant="secondary">Secondary</Button>
        <a href="#" className="text-sm font-medium text-primary underline-offset-2 hover:underline" onClick={(e) => e.preventDefault()}>
          Link de exemplo
        </a>
        <span className="flex items-center gap-1.5 rounded-md bg-primary/10 px-2.5 py-1.5 text-sm font-medium text-primary">
          <LayoutGrid className="size-3.5" /> Item ativo (nav)
        </span>
        <Badge tone="neutral">badge neutro</Badge>
        <span className="inline-flex items-center gap-1 rounded-full bg-yellow-50 px-2 py-0.5 text-xs font-semibold text-slate-700 ring-1 ring-yellow-300">
          <Star className="size-3 fill-yellow-400 text-yellow-500" /> destaque
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <p className="mb-1 text-[10px] text-slate-500">Input (foco conversa com o azul — clique para ver)</p>
          <Input placeholder="Nome do cliente" />
        </div>
        <Card>
          <CardHeader icon={<User className="size-4" />} title="Ana Souza" description="Unidade Centro" />
          <CardContent className="text-xs text-slate-500">Card padrão — surface branca, borda neutra.</CardContent>
          <CardFooter><Button variant="secondary" size="sm">Ver histórico</Button></CardFooter>
        </Card>
      </div>

      <div className="space-y-2">
        <Section tone="section-1" icon={<User className="size-3.5" />} title="Section azul">
          <p className="text-xs text-slate-600">Accent vivo, surface muito clara, texto em tom de marca.</p>
        </Section>
        <Section tone="section-2" icon={<Sparkles className="size-3.5" />} title="Section ciano">
          <p className="text-xs text-slate-600">Apoio/intermediário — mesmo tratamento estrutural, tom mais claro.</p>
        </Section>
        <Section tone="section-3" icon={<Star className="size-3.5" />} title="Section amarela (estrela)">
          <p className="text-xs text-slate-600">Acento de marca — texto neutro (não amarelo) para não parecer alerta.</p>
        </Section>
      </div>
    </div>
  )
}

function BrandIntensityDemo() {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <div className="rounded-xl border border-blue-200 bg-blue-50 p-3">
        <p className="text-xs font-bold uppercase tracking-wide text-blue-700">Azul — presença forte</p>
        <p className="mt-1 text-xs text-slate-600">Ações, links, navegação. É a cor que a marca &quot;fala&quot; o tempo todo.</p>
      </div>
      <div className="rounded-xl border border-cyan-200 bg-cyan-50 p-3">
        <p className="text-xs font-bold uppercase tracking-wide text-cyan-700">Ciano — apoio</p>
        <p className="mt-1 text-xs text-slate-600">Intermediário — reforça a identidade sem competir com o azul principal.</p>
      </div>
      <div className="rounded-xl border border-yellow-300 bg-yellow-50 p-3">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-700">Amarelo — detalhe</p>
        <p className="mt-1 text-xs text-slate-600">Acento pontual. Deve ser percebido, nunca dominar a tela.</p>
      </div>
    </div>
  )
}

/** Preview pequeno, próximo de uma tela real, comprovando azul+ciano+amarelo funcionando juntos — não é uma tela operacional nova. */
function BrandScreenPreviewDemo() {
  return (
    <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4">
      <PageHeader
        icon={<Package className="size-5" />}
        eyebrow="Exemplo"
        title="Pedidos"
        description="Prévia da identidade da marca aplicada a uma composição real."
        action={
          <span className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-yellow-50 px-2 py-0.5 text-[10px] font-semibold text-slate-700 ring-1 ring-yellow-300">
              <Star className="size-3 fill-yellow-400 text-yellow-500" /> 3 destaques
            </span>
            <Button size="sm">Novo pedido</Button>
          </span>
        }
      />
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
        <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">Filtros</p>
        <div className="flex flex-wrap gap-2">
          <Input placeholder="Buscar cliente" className="max-w-[220px]" />
          <Button size="sm" variant="secondary">Filtrar</Button>
        </div>
      </div>
      <div className="space-y-2">
        <Section tone="section-1" icon={<User className="size-3.5" />} title="Dados do cliente">
          <p className="text-xs text-slate-600">Ana Souza · (11) 90000-0000</p>
        </Section>
        <Section tone="section-2" icon={<Sparkles className="size-3.5" />} title="Dados do pedido">
          <p className="text-xs text-slate-600">Berço montessoriano · 1 un.</p>
        </Section>
        <Section tone="section-3" icon={<Star className="size-3.5" />} title="Entrega (destaque)">
          <p className="text-xs text-slate-600">Rua das Flores, 123 · previsão 20/09</p>
        </Section>
      </div>
    </div>
  )
}

function NoOverlapDialogDemo() {
  const [openShort, setOpenShort] = React.useState(false)
  const [openLong, setOpenLong] = React.useState(false)
  const [openTall, setOpenTall] = React.useState(false)
  return (
    <div className="flex flex-wrap gap-2">
      <Dialog open={openShort} onOpenChange={setOpenShort}>
        <DialogTrigger asChild>
          <Button variant="secondary" size="sm">Abrir — título curto</Button>
        </DialogTrigger>
        <DialogContent className="max-w-md">
          <DialogHeader title="Agendamentos do cliente" description="Título curto — caso comum." />
          <DialogBody>
            <p className="text-xs text-slate-500">O botão fechar nunca disputa espaço com o título: ele fica numa coluna própria (`shrink-0`) na mesma linha flex, o título fica em `min-w-0 flex-1`.</p>
          </DialogBody>
        </DialogContent>
      </Dialog>
      <Dialog open={openLong} onOpenChange={setOpenLong}>
        <DialogTrigger asChild>
          <Button variant="secondary" size="sm">Abrir — título longo</Button>
        </DialogTrigger>
        <DialogContent className="max-w-md">
          <DialogHeader title="Agendamentos do cliente — Maria Aparecida de Souza Nascimento Oliveira Pereira da Silva Santos" />
          <DialogBody>
            <p className="text-xs text-slate-500">Título longo: quebra linha (`break-words`), empurra a altura do header, nunca passa por baixo do X — reproduz o bug real relatado em `/chamados-finalizados` (ver DECISOES.md, NO-OVERLAP).</p>
          </DialogBody>
        </DialogContent>
      </Dialog>
      <Dialog open={openTall} onOpenChange={setOpenTall}>
        <DialogTrigger asChild>
          <Button variant="secondary" size="sm">Abrir — conteúdo alto</Button>
        </DialogTrigger>
        <DialogContent className="max-w-md">
          <DialogHeader title="Dialog alto com body rolável" description="Header e fechar ficam fora da rolagem." />
          <DialogBody className="space-y-3">
            {Array.from({ length: 18 }, (_, index) => <p key={index} className="rounded-md bg-slate-50 p-3 text-xs text-slate-600">Conteúdo demonstrativo {index + 1}: o scroll acontece somente no corpo principal do Dialog.</p>)}
          </DialogBody>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function ShowcaseBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">{title}</p>
      {children}
    </div>
  )
}

export function OfficialReference() {
  return (
    <section id="referencia-oficial" className="scroll-mt-24 space-y-8 rounded-2xl border-2 border-emerald-200 bg-emerald-50/30 p-4 sm:p-6">
      <div className="flex items-start gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-600 text-white">
          <BookOpenText className="size-5" />
        </span>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">Design System v1 · Referência oficial</p>
          <h2 className="text-xl font-bold text-slate-900">Componentes e padrões aprovados, ao vivo</h2>
          <p className="text-sm text-slate-600">
            Tudo abaixo usa os componentes reais de <code className="rounded bg-white px-1 py-0.5 text-xs">src/components/design-system/</code> — não é
            mockup de comparação. Documentação completa em <code className="rounded bg-white px-1 py-0.5 text-xs">docs/design-system/</code>.
          </p>
        </div>
      </div>

      <div className="rounded-2xl border-2 border-blue-200 bg-blue-50/30 p-4 sm:p-6">
        <div className="mb-1 flex items-center gap-2">
          <Star className="size-4 fill-yellow-400 text-yellow-500" />
          <p className="text-xs font-bold uppercase tracking-wide text-blue-700">Brand Foundation — cores da marca Le Bébé</p>
        </div>
        <p className="mb-4 text-xs text-slate-600">
          Azul dominante, branco/cinza como base, ciano de apoio, amarelo da estrela como acento pontual. Fonte: tokens já
          declarados em <code className="rounded bg-white px-1 py-0.5">globals.css</code> (&quot;Le Bébé Custom Colors&quot;) e{' '}
          <code className="rounded bg-white px-1 py-0.5">public/logo.png</code> — ver{' '}
          <code className="rounded bg-white px-1 py-0.5">docs/design-system/foundations.md</code>, &quot;Brand Foundation&quot;.
        </p>
        <ShowcaseBlock title="Paleta">
          <BrandPaletteDemo />
        </ShowcaseBlock>
        <div className="mt-4">
          <ShowcaseBlock title="Intensidade — azul forte, ciano apoio, amarelo detalhe">
            <BrandIntensityDemo />
          </ShowcaseBlock>
        </div>
        <div className="mt-4">
          <ShowcaseBlock title="Aplicações reais">
            <BrandApplicationsDemo />
          </ShowcaseBlock>
        </div>
        <div className="mt-4">
          <ShowcaseBlock title="Prévia de composição real (não é uma tela operacional nova)">
            <BrandScreenPreviewDemo />
          </ShowcaseBlock>
        </div>
      </div>

      <PageHeader
        icon={<Package className="size-5" />}
        eyebrow="Exemplo"
        title="Gestão de pedidos"
        description="PageHeader oficial (HDR=A)."
        action={<Button size="sm">Novo pedido</Button>}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <ShowcaseBlock title="Ações (BTN=B) — loading bloqueia reenvio (SAV=A)">
          <ButtonDemo />
        </ShowcaseBlock>

        <ShowcaseBlock title="Status (STA=A) e Feedback (FBK=A)">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="success">Concluído</Badge>
            <Badge tone="warning">Pendente</Badge>
            <Badge tone="danger">Cancelado</Badge>
            <Badge tone="info">Em produção</Badge>
          </div>
          <div className="mt-2">
            <Alert tone="danger" title="Não foi possível salvar as alterações.">
              Tente novamente. (banner de servidor — nunca é erro de campo)
            </Alert>
          </div>
        </ShowcaseBlock>

        <ShowcaseBlock title="Containers (CRD=C) + KPI (KPI=B)">
          <div className="grid grid-cols-2 gap-3">
            <KpiCard label="Pedidos hoje" value="24" delta={{ value: '+12%', direction: 'up' }} />
            <KpiCard label="Em atraso" value="3" delta={{ value: '-8%', direction: 'down' }} />
          </div>
          <Card className="mt-3">
            <CardHeader icon={<User className="size-4" />} title="Ana Souza" description="Unidade Centro" />
            <CardContent className="text-xs text-slate-500">Prazo: 12/09 · Em produção</CardContent>
          </Card>
        </ShowcaseBlock>

        <ShowcaseBlock title="Navegação (TAB=C)">
          <Tabs defaultValue="a">
            <SegmentedTabsList>
              <SegmentedTabsTrigger value="a">Abertos</SegmentedTabsTrigger>
              <SegmentedTabsTrigger value="b">Finalizados</SegmentedTabsTrigger>
            </SegmentedTabsList>
            <TabsContent value="a" className="pt-2 text-xs text-slate-500">
              Conteúdo da aba Abertos.
            </TabsContent>
            <TabsContent value="b" className="pt-2 text-xs text-slate-500">
              Conteúdo da aba Finalizados.
            </TabsContent>
          </Tabs>
        </ShowcaseBlock>

        <ShowcaseBlock title="Formulário (INP=A, REQ=C, VAL=C, ERR ajustado, DAT=A com ícone)">
          <FormDemo />
        </ShowcaseBlock>

        <ShowcaseBlock title="Superfície do campo (INP=A — ajuste de fundo)">
          <InputSurfaceDemo />
        </ShowcaseBlock>

        <ShowcaseBlock title="Combobox (CMB=B) — busca ao vivo, diferente de filtro de tela">
          <ComboboxDemo />
        </ShowcaseBlock>

        <ShowcaseBlock title="Filtros (FLT=A, FLT-EXEC=MANUAL, FLT-CLR=C, FLT-COLLAPSE=A)">
          <FilterDemo />
        </ShowcaseBlock>

        <ShowcaseBlock title="Empty state (EST=B)">
          <EmptyState title="Nenhum pedido encontrado" description="Ajuste os filtros ou crie um novo pedido." action={<Button size="sm">Novo pedido</Button>} />
        </ShowcaseBlock>

        <ShowcaseBlock title="Loading de marca — estrela SVG animada">
          <div className="flex flex-wrap items-end justify-center gap-5 rounded-2xl border bg-card p-5">
            {[20, 24, 32, 48, 64, 96, 128].map((size) => (
              <div key={size} className="flex flex-col items-center gap-2 text-xs text-muted-foreground">
                <LoadingLeBebe size={size} label={`Carregando (${size} pixels)`} />
                <span>{size}px</span>
              </div>
            ))}
          </div>
        </ShowcaseBlock>
      </div>

      <ShowcaseBlock title="Listagem (TBL=B — cards no mobile, ROW=A — ações sempre visíveis)">
        <TableDemo />
      </ShowcaseBlock>

      <div className="rounded-2xl border border-sky-100 bg-sky-50/30 p-4">
        <p className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-500">
          Filtros ocupam toda a largura da linha (regra global, 2026-09-12)
        </p>
        <p className="mb-4 text-xs text-slate-600">
          Flexbox (<code className="rounded bg-white px-1 py-0.5">flex-wrap</code> + <code className="rounded bg-white px-1 py-0.5">flex-1</code>,
          mínimo 220px por campo) — nenhuma combinação deixa &quot;buraco&quot; de coluna vazia, inclusive a última linha incompleta
          (CSS Grid <code className="rounded bg-white px-1 py-0.5">auto-fit</code> foi testado e descartado por não resolver esse caso — ver DECISOES.md D-025).
        </p>
        <div className="space-y-4">
          <FilterGridDemo count={2} />
          <FilterGridDemo count={3} />
          <FilterGridDemo count={5} />
        </div>
      </div>

      <div>
        <p className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-500">
          Column sizing — NO-CELL-OVERLAP / intrinsic (&quot;content&quot;) (regra global, 2026-09-14)
        </p>
        <p className="mb-3 text-xs text-slate-600">
          &quot;Nome&quot; usa o papel <code className="rounded bg-white px-1 py-0.5">content</code> — cresce pelo maior nome real
          (curto, médio, bem longo), nunca corta/trunca, e nunca invade &quot;Loja&quot; ao lado (bug real corrigido, achado em{' '}
          <code className="rounded bg-white px-1 py-0.5">/chamados-finalizados</code>: <em>&quot;Ana Toledo | Biramar Baby Atacado
          (2255)&quot;</em> pintava sobre a coluna seguinte). A tabela cresce horizontalmente quando necessário — o scroll absorve
          o aumento, sem largura fixa por exemplo específico.
        </p>
        <IntrinsicColumnDemo />
      </div>

      <div>
        <p className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-500">
          Tabela larga: sticky column opaca, zebra dentro do row-state + column sizing (regras globais, revisadas em 2026-09-14)
        </p>
        <p className="mb-3 text-xs text-slate-600">
          8 colunas — role a tabela abaixo para o lado (scrollbar, trackpad, ou clique e arraste numa célula não interativa; o
          cursor vira <code className="rounded bg-white px-1 py-0.5">grab</code>/<code className="rounded bg-white px-1 py-0.5">grabbing</code>).
          Primeira coluna (<code className="rounded bg-white px-1 py-0.5">content</code>, cresce pelo nome real — repare a linha
          com nome longo) fica fixa horizontalmente. <strong>TABLE-VIEWPORT-CLIP:</strong> a silhueta (borda + radius) pertence à
          janela visível — role totalmente para a esquerda, para o meio e para a direita: os 4 cantos continuam nítidos em
          qualquer posição. <strong>TABLE-STICKY-OPAQUE:</strong> a primeira coluna é 100% opaca em qualquer posição de scroll —
          nenhum texto das outras colunas &quot;fantasma&quot; através dela; a superfície da célula sticky acompanha o zebra/estado da
          própria linha, com um divisor sutil na borda direita só quando há overflow de verdade.{' '}
          <strong>Row tones — zebra dentro do row-state:</strong> duas linhas (sem agendamento em aberto) usam{' '}
          <code className="rounded bg-white px-1 py-0.5">rowTone=&quot;danger&quot;</code> — repare que elas NÃO ficam com a
          mesma cor: a família <code className="rounded bg-white px-1 py-0.5">danger</code> resolve duas intensidades
          (base/alternate) pela mesma paridade que o zebra normal usaria, então o destaque de estado convive com a
          orientação visual entre registros; hover continua funcionando em qualquer linha, inclusive na coluna sticky.
          É uma decisão explícita da tela, não uma consequência automática de nenhum Badge.{' '}
          <strong>Column sizing:</strong> &quot;Descrição&quot; usa <code className="rounded bg-white px-1 py-0.5">fill</code> (absorve o
          espaço restante) enquanto as colunas de quantidade usam <code className="rounded bg-white px-1 py-0.5">compact</code> —
          compare a largura de &quot;Descrição&quot; com &quot;Qtd total&quot;.{' '}
          <strong>Paginação:</strong> máximo {TABLE_PAGE_SIZE} registros por página, aplicado no backend.
        </p>
        <WideTableDemo />
      </div>

      <div>
        <p className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-500">
          Seções temáticas — CLR=B + SEC=C (aprovadas em 2026-09-12)
        </p>
        <p className="mb-3 text-xs text-slate-600">
          Três tons auxiliares suaves (<code className="rounded bg-white px-1 py-0.5">section-1/2/3</code>, CLR=B) + surface
          tintada leve + acento lateral + divisor no header (SEC=C) — auditado a partir de{' '}
          <code className="rounded bg-white px-1 py-0.5">/inteligencia-comercial</code>. Componente:{' '}
          <code className="rounded bg-white px-1 py-0.5">Section</code>. As cores não substituem success/warning/danger/info —
          são só apoio de organização, sem significado de negócio fixo.
        </p>
        <SectionDemo />
      </div>

      <div className="rounded-2xl border-2 border-amber-200 bg-amber-50/30 p-4">
        <p className="mb-1 text-xs font-bold uppercase tracking-wide text-amber-700">
          Section tones × cores semânticas — brand ≠ estado (validação permanente)
        </p>
        <p className="mb-3 text-xs text-slate-600">
          Brand blue/cyan (<code className="rounded bg-white px-1 py-0.5">section-1</code>/<code className="rounded bg-white px-1 py-0.5">section-2</code>)
          não são <code className="rounded bg-white px-1 py-0.5">info</code>; brand yellow
          (<code className="rounded bg-white px-1 py-0.5">section-3</code>) não é <code className="rounded bg-white px-1 py-0.5">warning</code> — mesmo
          famílias próximas, papéis semânticos permanecem independentes (ver DECISOES.md D-042). Componentes reais
          (<code className="rounded bg-white px-1 py-0.5">Section</code>, <code className="rounded bg-white px-1 py-0.5">Alert</code>,{' '}
          <code className="rounded bg-white px-1 py-0.5">Badge</code>), conteúdo equivalente nos dois lados.
        </p>
        <SectionVsSemanticDemo />
      </div>

      <div>
        <p className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-500">
          Modal sem sobreposição (NO-OVERLAP, regra global, 2026-09-12)
        </p>
        <p className="mb-3 text-xs text-slate-600">
          O botão fechar nunca é posicionado por cima do título — título e X dividem a mesma linha flex, cada um com sua
          própria região reservada. Teste com título curto e título bem longo (o caso real que causava sobreposição em{' '}
          <code className="rounded bg-white px-1 py-0.5">/chamados-finalizados</code> → Ver agendamentos).
        </p>
        <NoOverlapDialogDemo />
      </div>

      <div>
        <div className="mb-3 flex items-center gap-2">
          <LayoutTemplate className="size-4 text-emerald-700" />
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Layout / Page Shell — PageContainer oficial</p>
        </div>
        <p className="mb-3 text-xs text-slate-600">
          A página usa 100% da área útil após a Sidebar, com gutters oficiais — não uma largura fixa nem um{' '}
          <code className="rounded bg-white px-1 py-0.5">max-width</code> pequeno. Mesmo eixo horizontal para header, filtros,
          KPIs, tabs, alerts, cards e tabela.
        </p>
        <div className="grid gap-4 sm:grid-cols-3">
          <LayoutShellPreview label="Desktop (≥1024px)" gutter="32px" />
          <LayoutShellPreview label="Tablet (640–1023px)" gutter="24px" />
          <LayoutShellPreview label="Mobile (<640px)" gutter="16px" />
        </div>
        <p className="mt-2 text-[11px] text-slate-500">
          Componente: <code className="rounded bg-white px-1 py-0.5">src/components/design-system/patterns/PageContainer.tsx</code>. Detalhe em{' '}
          <code className="rounded bg-white px-1 py-0.5">docs/design-system/foundations.md</code>, &quot;Layout / Page Shell&quot;.
        </p>
      </div>

      <div>
        <p className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-500">FORM-PAGE-WIDTH — conteúdo de formulário centralizado</p>
        <p className="mb-3 text-xs text-slate-600">
          O shell continua full-width; somente a área de formulário usa <code className="rounded bg-white px-1 py-0.5">FormPageContent</code>,
          com <code className="rounded bg-white px-1 py-0.5">w-full max-w-6xl mx-auto</code>. Em mobile e tablet ela ocupa naturalmente
          todo o espaço disponível; em desktop largo centraliza o formulário sem limitar tabelas ou listagens vizinhas.
        </p>
        <FormPageWidthDemo />
      </div>

      <div className="rounded-xl border border-emerald-200 bg-white p-3 text-sm text-slate-700">
        <p className="font-semibold text-slate-900">Interaction Standards (regras de comportamento aprovadas)</p>
        <ul className="mt-1.5 list-disc space-y-1 pl-5 text-xs text-slate-600">
          <li><strong>Filtros:</strong> alterar campo não consulta; só o clique em &quot;Filtrar&quot; executa. Limpar já reconsulta e mantém o painel aberto.</li>
          <li><strong>Validação:</strong> erro só aparece ao sair do campo tocado; some em tempo real assim que corrigido.</li>
          <li><strong>Erros:</strong> resumo no topo + inline no campo para validação; banner separado para erro de servidor.</li>
          <li><strong>Salvar:</strong> botão em loading fica bloqueado — nunca permite duplo envio.</li>
          <li><strong>Datas:</strong> sempre digitação manual + ícone de calendário — nunca só um dos dois.</li>
          <li><strong>Alterações não salvas:</strong> indicador inline + Descartar, sem modal.</li>
          <li><strong>Ações destrutivas:</strong> confirmação padrão via modal.</li>
          <li><strong>Tabelas largas:</strong> overflow horizontal aceita scrollbar, trackpad, touch <strong>e</strong> arrastar com o mouse — nenhum método exclui os demais; nunca intercepta cliques em elementos interativos; só ativa quando há overflow de verdade.</li>
          <li><strong>Modais:</strong> header nunca sobrepõe o botão fechar (NO-OVERLAP) — reservado por layout, não por z-index.</li>
          <li><strong>Tabelas — sem scroll interno:</strong> a página rola verticalmente; a tabela não tem scrollbar vertical própria.</li>
          <li><strong>Paginação:</strong> {TABLE_PAGE_SIZE} registros por página, aplicado no backend — filtrar/limpar sempre volta para a página 1.</li>
          <li><strong>Linhas alternadas:</strong> zebra sutil por padrão; um estado específico da tela substitui o zebra daquela linha (nunca mistura).</li>
        </ul>
        <p className="mt-2 text-xs text-slate-500">
          Lista completa em <code className="rounded bg-slate-100 px-1 py-0.5">docs/design-system/interaction-standards.md</code>.
        </p>
      </div>
    </section>
  )
}
