import { Package, User, ShoppingCart, Truck } from 'lucide-react'
import { DecisionBlock } from '../DecisionBlock'
import { FixedRuleBlock } from '../FixedRuleBlock'
import { Section } from '@/components/design-system/Section'
import type { SectionTone } from '@/lib/design-system/section-tones'

function MiniField({ label }: { label: string }) {
  return (
    <div>
      <p className="text-[9px] text-slate-400">{label}</p>
      <div className="mt-0.5 h-5 rounded border border-slate-200 bg-white" />
    </div>
  )
}

const SEC_DEMO_SECTIONS: Array<{ tone: SectionTone; icon: React.ElementType; title: string; fields: string[] }> = [
  { tone: 'section-1', icon: User, title: 'Dados do cliente', fields: ['Nome', 'Telefone'] },
  { tone: 'section-2', icon: ShoppingCart, title: 'Dados do pedido', fields: ['Produto', 'Quantidade'] },
  { tone: 'section-3', icon: Truck, title: 'Entrega', fields: ['Endereço', 'Previsão'] },
]

/** Demonstração com o componente `Section` OFICIAL (não uma cópia local) — mesmo mini-formulário usado durante a comparação A/B/C, agora só com a opção aprovada (SEC=C). Empilhado verticalmente (não depende de breakpoint de viewport para caber num card estreito — mesmo cuidado de D-017). */
function SecOfficialDemo() {
  return (
    <div className="space-y-2">
      {SEC_DEMO_SECTIONS.map(({ tone, icon: Icon, title, fields }) => (
        <Section key={title} tone={tone} icon={<Icon className="size-3.5" />} title={title}>
          <div className="grid grid-cols-2 gap-1.5">
            {fields.map((f) => (
              <MiniField key={f} label={f} />
            ))}
          </div>
        </Section>
      ))}
    </div>
  )
}

function CardA() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <p className="text-xs font-bold text-slate-900">Pedido #4821</p>
      <p className="mt-1 text-[11px] text-slate-500">Ana Souza · Unidade Centro</p>
      <div className="mt-2 h-px bg-slate-100" />
      <p className="mt-2 text-[11px] text-slate-600">Prazo: 12/09 · Em produção</p>
    </div>
  )
}

function CardB() {
  return (
    <div className="rounded-xl bg-white p-3 shadow-md">
      <p className="text-xs font-bold text-slate-900">Pedido #4821</p>
      <p className="mt-1 text-[11px] text-slate-500">Ana Souza · Unidade Centro</p>
      <div className="mt-2 h-px bg-slate-100" />
      <p className="mt-2 text-[11px] text-slate-600">Prazo: 12/09 · Em produção</p>
    </div>
  )
}

function CardC() {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="flex items-center gap-1.5 border-b border-slate-100 bg-[#00A5E6]/5 px-3 py-2">
        <Package className="size-3.5 text-[#00A5E6]" />
        <p className="text-xs font-bold text-slate-900">Pedido #4821</p>
      </div>
      <div className="p-3">
        <p className="text-[11px] text-slate-500">Ana Souza · Unidade Centro</p>
        <p className="mt-2 text-[11px] text-slate-600">Prazo: 12/09 · Em produção</p>
      </div>
    </div>
  )
}

export function ContainersSection() {
  return (
    <div className="space-y-10">
      <DecisionBlock
        code="CRD"
        title="Cards / containers"
        description="Como um bloco de conteúdo (card, seção) se apresenta — o container mais usado no sistema inteiro."
        options={[
          {
            letter: 'A',
            label: 'Bordado atual',
            note: 'Borda 1px + shadow-sm — padrão dominante hoje.',
            content: <CardA />,
          },
          {
            letter: 'B',
            label: 'Flat elevado',
            note: 'Sem borda, só sombra média — mais "flutuante".',
            content: <CardB />,
          },
          {
            letter: 'C',
            label: 'Com cabeçalho tonal',
            note: 'Faixa de cabeçalho com tom da marca separando título do conteúdo.',
            content: <CardC />,
          },
        ]}
      />
      <FixedRuleBlock
        code="SEC"
        title="Separação de seções por cor"
        rule="Surface levemente tintada + acento lateral + divisor no header — a cor reforça, a estrutura já separa sozinha."
        fixedValue="C"
        note="Auditado a partir de /inteligencia-comercial (ModalDetalheVenda → componente Section, já aprovado em produção). Componente oficial: src/components/design-system/Section.tsx, tons de src/lib/design-system/section-tones.ts (CLR=B). Mesmo mini-formulário usado durante a comparação A/B/C, agora só a opção aprovada."
        content={<SecOfficialDemo />}
      />
    </div>
  )
}
