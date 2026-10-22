'use client'

import * as React from 'react'
import { Check, ChevronDown, ChevronUp, Search, SlidersHorizontal, X } from 'lucide-react'
import { Badge } from './Badge'
import { Button } from './Button'
import { FormField, type FormFieldRenderProps } from './FormField'
import { FilterPanelVariantContext, useFilterPanelVariant, type FilterPanelVariant } from './filterPanelVariant'
import { cn } from '@/lib/utils'
import { createInitialFilterState, filterReducer, isDirty, type FilterValues } from '@/lib/design-system/filters'

/**
 * `v2` = FLT=B, padrão oficial desde 2026-10-22 (D-058, aprovado): seções em
 * blocos com título forte à esquerda, rótulos sem "(opcional)", campos
 * alinhados pelo topo e contagem de filtros aplicados no cabeçalho. `v1`
 * (FLT=A) continua disponível via `variant="v1"` só como escape.
 */
export { useFilterPanelVariant, type FilterPanelVariant } from './filterPanelVariant'

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
  /** Default `v2` (FLT=B, D-058). `v1` só como escape. */
  variant?: FilterPanelVariant
  /** Só `v2`, opcional: filtros já aplicados (`countActiveFilters(applied, valoresIniciais)`). Omitido = sem contador. Visível com o painel recolhido. */
  activeCount?: number
  children: React.ReactNode
  className?: string
}

export function FilterPanel({ title = 'Filtros', dirty, onApply, onClear, applyDisabled, variant = 'v2', activeCount, children, className }: FilterPanelProps) {
  const [expanded, setExpanded] = React.useState(true)
  const titleId = React.useId()
  const contentId = React.useId()

  const toggle = (
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
  )

  if (variant === 'v2') {
    return (
      <FilterPanelVariantContext.Provider value="v2">
        <section aria-labelledby={titleId} className={cn('overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs', className)}>
          <div className={cn('flex flex-wrap items-center justify-between gap-3 bg-sky-50/80 px-4 py-3 sm:px-5', expanded && 'border-b border-slate-200')}>
            <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <SlidersHorizontal className="size-4" aria-hidden="true" />
              </span>
              <h2 id={titleId} className="text-base font-bold text-slate-900">{title}</h2>
              {activeCount === undefined ? null : activeCount > 0 ? (
                <Badge tone="brand">{activeCount} {activeCount === 1 ? 'filtro aplicado' : 'filtros aplicados'}</Badge>
              ) : (
                <span className="text-xs text-slate-500">Nenhum filtro aplicado</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={onClear}>
                <X className="size-3.5" />
                Limpar filtros
              </Button>
              {toggle}
            </div>
          </div>
          {expanded && (
            <>
              <div id={contentId} className="space-y-3 p-3 sm:p-4">{children}</div>
              <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 bg-slate-50/70 px-4 py-3 sm:px-5">
                {dirty && <span className="rounded-full bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700">Filtro alterado — clique em Filtrar</span>}
                <Button type="button" onClick={onApply} disabled={applyDisabled}>
                  <Search className="size-4" />
                  Filtrar
                </Button>
              </div>
            </>
          )}
        </section>
      </FilterPanelVariantContext.Provider>
    )
  }

  return (
    <section aria-labelledby={titleId} className={cn('overflow-hidden rounded-2xl border border-sky-200 bg-white', className)}>
      <div className={cn('flex flex-wrap items-center justify-between gap-3 border-b border-sky-100 bg-sky-50/80 px-4 py-3 sm:px-5', expanded && 'mb-4')}>
        <h2 id={titleId} className="font-bold text-slate-900">{title}</h2>
        <div className="flex items-center gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onClear}>
            <X className="size-3.5" />
            Limpar
          </Button>
          {toggle}
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
export function FilterFieldGroup({
  label,
  icon,
  description,
  children,
  className,
  prominent = false,
}: {
  label: string
  icon?: React.ReactNode
  /** Só `v2`: frase curta abaixo do título dizendo o que a seção filtra. */
  description?: string
  children: React.ReactNode
  className?: string
  /** Só `v1` — em `v2` toda seção já tem o mesmo peso visual. */
  prominent?: boolean
}) {
  const variant = useFilterPanelVariant()
  const titleId = React.useId()

  if (variant === 'v2') {
    return (
      <div
        role="group"
        aria-labelledby={titleId}
        className={cn('rounded-xl border border-slate-200 bg-slate-50/60 p-3 sm:p-4 lg:grid lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-6', className)}
      >
        <div className="mb-3 flex items-start gap-2.5 lg:mb-0 lg:pt-1">
          {icon && (
            <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-white text-primary ring-1 ring-slate-200 [&_svg]:size-3.5 [&_svg]:text-primary!" aria-hidden="true">
              {icon}
            </span>
          )}
          <div className="min-w-0">
            <h3 id={titleId} className="text-sm font-bold text-slate-900">{label}</h3>
            {description && <p className="mt-0.5 text-xs leading-snug text-slate-500">{description}</p>}
          </div>
        </div>
        <div className="flex flex-wrap items-start gap-x-3 gap-y-4">
          {React.Children.toArray(children).map((child, index) => (
            <div
              key={React.isValidElement(child) && child.key != null ? child.key : index}
              className="min-w-[220px] flex-1 has-[[data-filter-chips]]:min-w-fit"
            >
              {child}
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className={className}>
      <div className={cn('mb-2 flex items-center gap-1.5', prominent && 'border-b border-sky-100 pb-2')}>
        {icon}
        <h3 className={cn('uppercase tracking-wide', prominent ? 'text-sm font-bold text-slate-700' : 'text-xs font-semibold text-slate-500')}>{label}</h3>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        {React.Children.map(children, (child) => (
          <div className="min-w-[220px] flex-1">{child}</div>
        ))}
      </div>
    </div>
  )
}

/**
 * Campo de filtro. Em `v2`: rótulo em `font-semibold` escuro, sem o sufixo
 * "(opcional)" (todo filtro já é opcional por natureza), ponto da marca
 * quando o campo tem valor (`active`) e `hint` curto abaixo do controle —
 * sem desalinhar os vizinhos, porque a linha alinha pelo topo. Dentro de um
 * painel `v1` cai exatamente no `FormField` de antes (`hint` vira `helper`).
 */
export interface FilterFieldProps {
  id: string
  label: string
  hint?: string
  active?: boolean
  children: (fieldProps: FormFieldRenderProps) => React.ReactNode
}

export function FilterField({ id, label, hint, active = false, children }: FilterFieldProps) {
  const variant = useFilterPanelVariant()
  if (variant === 'v1') {
    return (
      <FormField id={id} label={label} helper={hint}>
        {children}
      </FormField>
    )
  }

  const hintId = hint ? `${id}-hint` : undefined
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="flex min-w-0 items-center gap-1.5 text-sm font-semibold text-slate-800">
        <span className="truncate">{label}</span>
        {active && <span className="size-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />}
      </label>
      {children({ id, 'aria-invalid': false, 'aria-describedby': hintId })}
      {hint && (
        <p id={hintId} className="text-xs text-slate-500">
          {hint}
        </p>
      )}
    </div>
  )
}

/**
 * Escolha única curta em chips (FLT=B, D-058) — para filtros com até ~3
 * opções curtas, onde um `Select` esconde atrás de um clique o que caberia
 * à vista. Teclado segue o padrão de `radiogroup`: Tab entra no item
 * marcado, setas trocam a opção. Listas longas continuam em `Select`/
 * `Combobox`/`MultiSelect`.
 */
export interface FilterChipsOption {
  value: string
  label: string
}

export interface FilterChipsProps {
  id?: string
  value: string
  onChange: (value: string) => void
  options: readonly FilterChipsOption[]
  'aria-label': string
  'aria-describedby'?: string
  className?: string
}

export function FilterChips({ id, value, onChange, options, className, ...aria }: FilterChipsProps) {
  const refs = React.useRef<Array<HTMLButtonElement | null>>([])
  const selectedIndex = options.findIndex((option) => option.value === value)
  const focusableIndex = selectedIndex >= 0 ? selectedIndex : 0

  function handleKeyDown(event: React.KeyboardEvent<HTMLButtonElement>, index: number) {
    const step = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0
    if (!step) return
    event.preventDefault()
    const next = (index + step + options.length) % options.length
    onChange(options[next].value)
    refs.current[next]?.focus()
  }

  return (
    <div id={id} role="radiogroup" data-filter-chips="" className={cn('flex flex-wrap gap-1.5', className)} {...aria}>
      {options.map((option, index) => {
        const selected = index === selectedIndex
        return (
          <button
            key={option.value}
            ref={(element) => {
              refs.current[index] = element
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={index === focusableIndex ? 0 : -1}
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className={cn(
              'inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-sm font-medium shadow-xs outline-none transition-[color,background-color,border-color,box-shadow]',
              'focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50',
              selected ? 'border-primary bg-primary/10 text-sky-800' : 'border-input bg-input-background text-slate-700 hover:bg-slate-50'
            )}
          >
            {selected && <Check className="size-3.5" aria-hidden="true" />}
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
