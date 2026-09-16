import { DecisionBlock } from '../DecisionBlock'
import { FixedRuleBlock } from '../FixedRuleBlock'

interface Tone {
  label: string
  surface: string
  border: string
  accent: string
  text: string
}

function ToneChip({ tone }: { tone: Tone }) {
  return (
    <div className={`rounded-lg border p-2 text-[10px] ${tone.surface} ${tone.border}`}>
      <p className={`font-semibold ${tone.text}`}>{tone.label}</p>
      <div className={`mt-1 h-1.5 w-8 rounded-full ${tone.accent}`} />
    </div>
  )
}

function PaletteCluster({ tones }: { tones: Tone[] }) {
  return (
    <div className="grid grid-cols-3 gap-1.5">
      {tones.map((t) => (
        <ToneChip key={t.label} tone={t} />
      ))}
    </div>
  )
}

function RadiusCluster({ radius }: { radius: string }) {
  return (
    <div className="flex flex-col gap-2">
      <div className={`border border-slate-300 bg-white p-2 text-[11px] text-slate-600 ${radius}`}>Card de exemplo</div>
      <div className="flex items-center gap-2">
        <span className={`bg-[#00A5E6] px-2.5 py-1 text-[11px] font-medium text-white ${radius}`}>Botão</span>
        <span className={`border border-slate-300 bg-slate-50 px-2 py-1 text-[11px] text-slate-500 ${radius}`}>Campo</span>
        <span className={`bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 ${radius}`}>Tag</span>
      </div>
    </div>
  )
}

function ShadowCard({ className, note }: { className: string; note: string }) {
  return (
    <div className="space-y-2">
      <div className={`rounded-xl bg-white p-3 text-[11px] text-slate-600 ${className}`}>Bloco de conteúdo</div>
      <div className={`rounded-xl bg-white p-3 text-[11px] text-slate-600 ${className}`}>Outro bloco</div>
      <p className="text-[10px] text-slate-400">{note}</p>
    </div>
  )
}

function TypeSample({ h1, body, label }: { h1: string; body: string; label: string }) {
  return (
    <div className="space-y-1.5">
      <p className={`font-bold text-slate-900 ${h1}`}>Gestão de pedidos</p>
      <p className={`text-slate-600 ${body}`}>Consulte, revise e atualize pedidos no seu escopo.</p>
      <p className={`font-medium text-slate-700 ${label}`}>Nome do cliente</p>
    </div>
  )
}

function DensitySample({ pad, gap, rowPad }: { pad: string; gap: string; rowPad: string }) {
  return (
    <div className={`rounded-lg border border-slate-200 bg-white ${pad}`}>
      <div className={`flex flex-col ${gap}`}>
        <div className={`rounded border border-slate-200 bg-slate-50 text-[11px] text-slate-600 ${rowPad}`}>Linha de item 1</div>
        <div className={`rounded border border-slate-200 bg-slate-50 text-[11px] text-slate-600 ${rowPad}`}>Linha de item 2</div>
      </div>
    </div>
  )
}

export function FoundationsSection() {
  return (
    <div className="space-y-10">
      <DecisionBlock
        code="RAD"
        title="Radius"
        description="Quanto as bordas são arredondadas, do card ao botão."
        options={[
          {
            letter: 'A',
            label: 'Compacto (6px)',
            note: 'Visual mais denso e "de ferramenta operacional".',
            content: <RadiusCluster radius="rounded-[6px]" />,
          },
          {
            letter: 'B',
            label: 'Atual (12px)',
            note: 'O que /pedidos-personalizados já usa hoje.',
            content: <RadiusCluster radius="rounded-[12px]" />,
          },
          {
            letter: 'C',
            label: 'Suave (20px)',
            note: 'Visual mais amigável/arredondado.',
            content: <RadiusCluster radius="rounded-[20px]" />,
          },
        ]}
      />

      <DecisionBlock
        code="SHD"
        title="Sombra / elevação"
        description="Como um card se distingue do fundo: borda, sombra ou contorno colorido."
        options={[
          {
            letter: 'A',
            label: 'Flat com borda',
            note: 'Sem sombra — só uma borda de 1px. Padrão hoje no dashboard/tabelas.',
            content: <ShadowCard className="border border-slate-200" note="border, sem box-shadow" />,
          },
          {
            letter: 'B',
            label: 'Sombra suave',
            note: 'Leve elevação — padrão hoje em /pedidos-personalizados.',
            content: <ShadowCard className="border border-slate-100 shadow-sm" note="border sutil + shadow-sm" />,
          },
          {
            letter: 'C',
            label: 'Contorno com glow',
            note: 'Sem sombra tradicional — anel colorido sutil da marca.',
            content: <ShadowCard className="ring-1 ring-[#00A5E6]/15 shadow-[0_0_0_1px_rgba(0,165,230,0.08)]" note="ring + glow da cor de marca" />,
          },
        ]}
      />

      <DecisionBlock
        code="TYP"
        title="Tipografia"
        description="Escala de tamanhos entre título de página, corpo de texto e labels."
        options={[
          {
            letter: 'A',
            label: 'Compacta',
            note: 'Mais informação por tela — foco em densidade operacional.',
            content: <TypeSample h1="text-lg" body="text-xs" label="text-xs" />,
          },
          {
            letter: 'B',
            label: 'Atual',
            note: 'h1 text-2xl/3xl — o que o sistema já usa hoje.',
            content: <TypeSample h1="text-xl sm:text-2xl" body="text-sm" label="text-sm" />,
          },
          {
            letter: 'C',
            label: 'Editorial',
            note: 'Hierarquia mais generosa, mais respiro entre elementos.',
            content: <TypeSample h1="text-2xl sm:text-3xl" body="text-base leading-relaxed" label="text-sm" />,
          },
        ]}
      />

      <DecisionBlock
        code="SPC"
        title="Densidade / espaçamento"
        description="Quanto de espaço em branco existe entre blocos, linhas e campos."
        options={[
          {
            letter: 'A',
            label: 'Compacta',
            note: 'Menos espaço, mais itens visíveis por tela — bom para uso operacional intenso.',
            content: <DensitySample pad="p-2" gap="gap-1.5" rowPad="px-2 py-1" />,
          },
          {
            letter: 'B',
            label: 'Confortável (atual)',
            note: 'O equilíbrio já usado hoje na maior parte do sistema.',
            content: <DensitySample pad="p-3" gap="gap-2.5" rowPad="px-3 py-2" />,
          },
          {
            letter: 'C',
            label: 'Espaçosa',
            note: 'Mais respiro — reduz sensação de aglomeração, ocupa mais tela.',
            content: <DensitySample pad="p-4" gap="gap-4" rowPad="px-4 py-3" />,
          },
        ]}
      />

      <FixedRuleBlock
        code="CLR"
        title="Paleta auxiliar de seções"
        rule="Três matizes distintos e suaves derivados da Color Foundation da marca (azul/ciano/amarelo da estrela) para organizar assuntos/seções/formulários — não substituem cores semânticas."
        fixedValue="B"
        note="section-1 = família azul (Tailwind blue, não sky — sky é o que info já usa); section-2 = família ciano (Tailwind cyan); section-3 = família amarelo da estrela (Tailwind yellow, não amber — amber é o que warning já usa). Tokens em src/lib/design-system/section-tones.ts. Validado por cor computada contra os 4 estados semânticos — ver docs/design-system/foundations.md, 'Brand Foundation', e DECISOES.md D-041."
        content={
          <PaletteCluster
            tones={[
              { label: 'section-1 (azul)', surface: 'bg-blue-50/60', border: 'border-blue-200', accent: 'bg-blue-500', text: 'text-blue-800' },
              { label: 'section-2 (ciano)', surface: 'bg-cyan-50/60', border: 'border-cyan-200', accent: 'bg-cyan-500', text: 'text-cyan-800' },
              { label: 'section-3 (amarelo)', surface: 'bg-yellow-50/70', border: 'border-yellow-300', accent: 'bg-yellow-400', text: 'text-slate-800' },
            ]}
          />
        }
      />
    </div>
  )
}
