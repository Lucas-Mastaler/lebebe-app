'use client'

import * as React from 'react'
import { FlaskConical, ListChecks } from 'lucide-react'
import { SelectionProvider, useAllSelections } from './_lab/selection-context'
import { CATEGORIES, OPEN_DECISIONS, decisionsByCategory, type CategoryId } from './_lab/registry'
import { SummaryPanel } from './_lab/SummaryPanel'
import { FoundationsSection } from './_lab/sections/foundations'
import { ActionsSection } from './_lab/sections/actions'
import { FormsSection } from './_lab/sections/forms'
import { NavigationSection } from './_lab/sections/navigation'
import { ContainersSection } from './_lab/sections/containers'
import { DataSection } from './_lab/sections/data'
import { FeedbackSection } from './_lab/sections/feedback'
import { StatusSection } from './_lab/sections/status'
import { PatternsSection } from './_lab/sections/patterns'
import { BehaviorSection } from './_lab/sections/behavior'
import { OfficialReference } from './_lab/OfficialReference'

const SECTION_COMPONENTS: Record<CategoryId, React.ComponentType> = {
  A: FoundationsSection,
  B: ActionsSection,
  C: FormsSection,
  D: NavigationSection,
  E: ContainersSection,
  F: DataSection,
  G: FeedbackSection,
  H: StatusSection,
  I: PatternsSection,
  J: BehaviorSection,
}

function CategoryNav() {
  return (
    <nav
      aria-label="Categorias de decisão"
      className="sticky top-0 z-20 -mx-3 flex gap-1.5 overflow-x-auto border-b border-slate-200 bg-[#F7FAFC]/95 px-3 py-2.5 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8"
    >
      <a
        href="#referencia-oficial"
        className="shrink-0 rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100"
      >
        ✓ Referência oficial
      </a>
      {CATEGORIES.map((c) => (
        <a
          key={c.id}
          href={`#categoria-${c.id}`}
          className="shrink-0 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-[#00A5E6] hover:text-[#00A5E6]"
        >
          {c.id}. {c.title}
        </a>
      ))}
      <a
        href="#minhas-escolhas"
        className="ml-auto flex shrink-0 items-center gap-1 rounded-full bg-[#00A5E6] px-3 py-1.5 text-xs font-semibold text-white"
      >
        <ListChecks className="size-3.5" />
        Minhas escolhas
      </a>
    </nav>
  )
}

function ProgressPill() {
  const { selections, hydrated } = useAllSelections()
  if (!hydrated) return null
  const answered = OPEN_DECISIONS.filter((d) => selections[d.code]).length
  return (
    <a
      href="#minhas-escolhas"
      className="fixed bottom-4 right-4 z-30 flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white shadow-lg transition hover:bg-slate-800 sm:bottom-6 sm:right-6"
    >
      <ListChecks className="size-4" />
      {answered}/{OPEN_DECISIONS.length} escolhidas
    </a>
  )
}

function CategoryBlock({ id, title, subtitle }: { id: CategoryId; title: string; subtitle: string }) {
  const Component = SECTION_COMPONENTS[id]
  const decisions = decisionsByCategory(id)
  const fixedCount = decisions.filter((d) => d.kind === 'fixed').length
  const openCount = decisions.length - fixedCount
  return (
    <section id={`categoria-${id}`} className="scroll-mt-24">
      <div className="mb-6 flex items-baseline gap-3 border-b-2 border-slate-900 pb-2">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-sm font-bold text-white">{id}</span>
        <div>
          <h2 className="text-xl font-bold text-slate-900">{title}</h2>
          <p className="text-sm text-slate-500">
            {subtitle} ·{' '}
            {fixedCount > 0 && (
              <>
                {fixedCount} regra{fixedCount !== 1 ? 's' : ''} aprovada{fixedCount !== 1 ? 's' : ''}
                {openCount > 0 ? ' + ' : ''}
              </>
            )}
            {openCount > 0 && (
              <>
                {openCount} decis{openCount !== 1 ? 'ões' : 'ão'} aberta{openCount !== 1 ? 's' : ''}
              </>
            )}
          </p>
        </div>
      </div>
      <Component />
    </section>
  )
}

function LabContent() {
  return (
    <div className="mx-auto w-full max-w-6xl px-3 pb-24 pt-4 sm:px-6 sm:pt-6 lg:px-8">
      <header className="mb-6 space-y-3">
        <div className="flex items-start gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-white">
            <FlaskConical className="size-5" />
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[#00A5E6]">Design System · Laboratório</p>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Design System Lab</h1>
          </div>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
          <strong>Design System v1 aprovado.</strong> Todas as 18 decisões visuais e as 17 decisões de comportamento
          abaixo já foram escolhidas e viraram o padrão oficial — ver a seção{' '}
          <a href="#referencia-oficial" className="font-medium underline underline-offset-2">Referência oficial</a>, os
          componentes reais em <code className="rounded bg-white px-1 py-0.5 text-xs">src/components/design-system/</code> e a
          documentação em <code className="rounded bg-white px-1 py-0.5 text-xs">docs/design-system/</code>. As categorias A–J
          abaixo continuam como <strong>registro histórico</strong> de como cada escolha foi comparada — nenhuma tela
          existente do sistema foi migrada ainda.
        </div>
        <p className="text-sm text-slate-600">
          Cada decisão abaixo mostra a alternativa escolhida em destaque. Sua seleção fica salva neste navegador e é
          resumida no final da página, na área <a href="#minhas-escolhas" className="font-medium text-[#00A5E6] underline underline-offset-2">Minhas escolhas</a>.
        </p>
        <p className="text-sm text-slate-600">
          Na categoria <strong>J. Comportamento e Interação</strong>, existem dois tipos de item: cartões{' '}
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">verdes, marcados APROVADA</span>{' '}
          são regras que não têm alternativas (ex. filtros sempre manuais). Os demais são as 17 decisões A/B/C já
          respondidas pelo usuário.
        </p>
      </header>

      <OfficialReference />

      <div className="h-8" />

      <CategoryNav />

      <div className="mt-8 space-y-14">
        {CATEGORIES.map((c) => (
          <CategoryBlock key={c.id} id={c.id} title={c.title} subtitle={c.subtitle} />
        ))}

        <SummaryPanel />
      </div>

      <ProgressPill />
    </div>
  )
}

export default function DesignSystemLabClient() {
  return (
    <SelectionProvider>
      <LabContent />
    </SelectionProvider>
  )
}
