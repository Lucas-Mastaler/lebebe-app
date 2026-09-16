/**
 * Escala tipográfica oficial do Design System v1 (TYP=B — decisão já
 * aprovada, igual ao que o sistema já usa hoje). Não são tokens CSS novos:
 * a escala de tamanho já é a do Tailwind, isto só nomeia os papéis
 * semânticos para não repetir a combinação de classes em cada tela.
 */
export const typography = {
  pageTitle: 'text-xl font-bold tracking-tight text-slate-900 sm:text-2xl',
  sectionTitle: 'text-lg font-bold text-slate-900',
  cardTitle: 'text-base font-semibold text-slate-900',
  body: 'text-sm text-slate-700',
  secondaryBody: 'text-sm text-slate-500',
  label: 'text-sm font-medium text-slate-700',
  helper: 'text-xs text-slate-500',
  caption: 'text-xs text-slate-400',
  kpiValue: 'text-2xl font-bold text-slate-900',
  eyebrow: 'text-xs font-semibold uppercase tracking-wider text-primary',
} as const

export type TypographyRole = keyof typeof typography
