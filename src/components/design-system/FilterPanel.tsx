'use client'

import * as React from 'react'
import { ChevronDown, ChevronUp, Search, X } from 'lucide-react'
import { Button } from './Button'
import { cn } from '@/lib/utils'
import { createInitialFilterState, filterReducer, isDirty, type FilterValues } from '@/lib/design-system/filters'

/**
 * `useFilterState` é a única forma pretendida de guardar estado de
 * filtro no Design System v1: `setField` só altera o rascunho — a
 * listagem real deve observar `applied`, nunca `draft`. Isso é o que
 * torna FLT-EXEC=MANUAL estrutural, não uma convenção que cada tela
 * pode esquecer de seguir.
 */
export function useFilterState<T extends FilterValues>(initial: T) {
  const [state, dispatch] = React.useReducer(filterReducer<T>, createInitialFilterState(initial))

  return {
    draft: state.draft,
    applied: state.applied,
    dirty: isDirty(state),
    setField: <K extends keyof T>(field: K, value: T[K]) => dispatch({ type: 'SET_FIELD', field, value }),
    apply: () => dispatch({ type: 'APPLY' }),
    clear: () => dispatch({ type: 'CLEAR', emptyValues: initial }),
  }
}

/**
 * Painel de filtros oficial (FLT=A — seções agrupadas). Renderiza os campos via `children`; nunca dispara `onApply` sozinho.
 *
 * **Colapsável (FLT-COLLAPSE=A, 2026-09-15):** o painel pode ser recolhido/reaberto pelo próprio
 * usuário para ganhar espaço visual depois de aplicar os filtros desejados — comportamento puramente
 * de apresentação, gerenciado internamente pelo componente (`expanded`, iniciado em `true`). Recolher
 * NUNCA limpa/descarta `draft`/`applied` nem dispara `onApply`/`onClear` sozinho, e o painel nunca se
 * recolhe sozinho depois de filtrar — só uma ação explícita do usuário (clique no botão de
 * expandir/recolher) muda esse estado. "Limpar" continua sempre acessível (mesmo recolhido, é uma
 * ação de baixo risco e útil sem precisar reabrir o painel); os campos, o botão "Filtrar" e o aviso de
 * filtro alterado somem apenas visualmente quando recolhido, sem perder o valor do `draft`.
 *
 * **Ação alinhada à direita (FLT-ACTION-ALIGN=A, 2026-09-15):** "Filtrar" (a ação principal do
 * painel) fica ancorado ao final/direita da área de ações do rodapé, independente do número de
 * campos — nunca numa célula vazia da grid de filtros. O aviso de "filtro alterado" (quando houver)
 * é uma ação secundária e fica antes do botão principal, mas dentro do mesmo grupo alinhado à
 * direita (`justify-end`); em telas estreitas o grupo pode quebrar linha (`flex-wrap`), mas nunca
 * volta ao canto esquerdo por acidente de layout.
 */
export interface FilterPanelProps {
  title?: string
  dirty: boolean
  onApply: () => void
  onClear: () => void
  /** Desabilita o botão Filtrar (ex.: campo obrigatório ainda incompleto/inválido) — não impede alterar os campos, só a execução. */
  applyDisabled?: boolean
  children: React.ReactNode
  className?: string
}

export function FilterPanel({ title = 'Filtros', dirty, onApply, onClear, applyDisabled, children, className }: FilterPanelProps) {
  const [expanded, setExpanded] = React.useState(true)
  const titleId = React.useId()
  const contentId = React.useId()

  return (
    <section aria-labelledby={titleId} className={cn('overflow-hidden rounded-2xl border border-sky-200 bg-white', className)}>
      <div className={cn('flex flex-wrap items-center justify-between gap-3 border-b border-sky-100 bg-sky-50/80 px-4 py-3 sm:px-5', expanded && 'mb-4')}>
        <h2 id={titleId} className="font-bold text-slate-900">{title}</h2>
        <div className="flex items-center gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onClear}>
            <X className="size-3.5" />
            Limpar
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setExpanded((atual) => !atual)}
            aria-expanded={expanded}
            aria-controls={contentId}
          >
            {expanded ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
            {expanded ? 'Recolher' : 'Mostrar filtros'}
          </Button>
        </div>
      </div>
      {expanded && (
        <div id={contentId} className="px-4 pb-4 sm:px-5 sm:pb-5">
          <div className="space-y-4">{children}</div>
          <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
            {dirty && <span className="rounded-full bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700">Filtro alterado — clique em Filtrar</span>}
            <Button type="button" onClick={onApply} disabled={applyDisabled}>
              <Search className="size-4" />
              Filtrar
            </Button>
          </div>
        </div>
      )}
    </section>
  )
}

/**
 * Layout de campos (regra global, achada no piloto de
 * `/chamados-finalizados`, 2026-09-12): os campos visíveis distribuem
 * TODA a largura disponível da linha — nunca deixam "buraco" vazio
 * quando há poucos campos.
 *
 * Flexbox (`flex-wrap` + `flex: 1 1 220px` por campo), não CSS Grid
 * `auto-fit`: testado e descartado — `grid-template-columns:
 * repeat(auto-fit, minmax(220px, 1fr))` usa o MESMO número de colunas em
 * todas as linhas (o grid inteiro compartilha um único template), então
 * uma última linha incompleta (ex.: 5º campo sozinho) fica com células
 * vazias em vez de esticar — exatamente o "buraco" que essa regra deveria
 * eliminar. Flexbox resolve isso porque cada linha (`flex line`) faz sua
 * própria distribuição de `flex-grow`, independente das outras.
 *
 * 220px de largura mínima: base já confortável para `Input`/`DateField`/
 * `Combobox` (abaixo disso o texto do multi-select "N selecionada(s)"
 * começa a truncar). Um controle pequeno (checkbox/switch) pode manter
 * tamanho natural dentro do próprio campo — o slot ao redor dele
 * participa do layout normalmente, só o conteúdo interno não precisa
 * esticar.
 */
export function FilterFieldGroup({ label, icon, children }: { label: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-1.5">
        {icon}
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</h3>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        {React.Children.map(children, (child) => (
          <div className="min-w-[220px] flex-1">{child}</div>
        ))}
      </div>
    </div>
  )
}
