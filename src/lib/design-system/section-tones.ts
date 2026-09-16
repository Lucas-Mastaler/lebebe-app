/**
 * CLR=B (paleta auxiliar de seções, aprovada) — três matizes distintos e
 * suaves, derivados da Color Foundation oficial da marca Le Bébé (ver
 * `docs/design-system/foundations.md`, "Brand Foundation"):
 *   section-1 → família AZUL da marca (Tailwind `blue`, não `sky` —
 *     `sky` é o que `info` já usa; `blue` é visualmente mais "royal/
 *     índigo", perceptivelmente distinto).
 *   section-2 → família CIANO/azul-claro da marca (Tailwind `cyan`).
 *   section-3 → família AMARELO da estrela da marca (Tailwind `yellow`,
 *     não `amber` — `amber` é o que `warning` já usa).
 * Validado por cor computada (não só nome de token) contra os 4 estados
 * semânticos antes de virar oficial — ver DECISOES.md D-041. Um tom
 * anterior (sky/emerald/amber) foi usado e descartado por coincidir
 * exatamente com info/success/warning (D-038); um segundo experimento
 * (`STN=A/B/C`, cores neutras/frias sem relação com a marca) foi criado
 * e depois retirado (D-041) quando o usuário decidiu por uma direção de
 * MARCA em vez de uma paleta genérica.
 *
 * Continuam semanticamente reservadas `success`/`warning`/`destructive`/
 * `info` — `section-*` nunca as substitui, e são tons de ORGANIZAÇÃO,
 * sem vínculo fixo a nenhum assunto específico (a tela escolhe qual tom
 * usar para qual bloco).
 */
export type SectionTone = 'section-1' | 'section-2' | 'section-3'

export interface SectionToneClasses {
  surface: string
  border: string
  accentBar: string
  icon: string
  title: string
  divider: string
}

export const SECTION_TONES: SectionTone[] = ['section-1', 'section-2', 'section-3']

/**
 * Resolve a sequência decorativa oficial de `Section` sem espalhar
 * aritmética de módulo nas telas. Tons com semântica própria continuam
 * sendo escolhidos explicitamente pelo consumidor.
 */
export function getSectionToneAt(index: number): SectionTone {
  return SECTION_TONES[((index % SECTION_TONES.length) + SECTION_TONES.length) % SECTION_TONES.length]
}

export const SECTION_TONE_CLASSES: Record<SectionTone, SectionToneClasses> = {
  'section-1': {
    surface: 'bg-blue-50/60',
    border: 'border-blue-200',
    accentBar: 'border-l-blue-500',
    icon: 'text-blue-600',
    title: 'text-blue-800',
    divider: 'border-blue-100',
  },
  'section-2': {
    surface: 'bg-cyan-50/60',
    border: 'border-cyan-200',
    accentBar: 'border-l-cyan-500',
    icon: 'text-cyan-600',
    title: 'text-cyan-800',
    divider: 'border-cyan-100',
  },
  'section-3': {
    // Amarelo da estrela: acento/borda vivos ("solar"), mas título/ícone
    // em neutro (não `yellow-800`) — tratamento deliberado para não
    // parecer `warning` (que usa texto colorido em âmbar). Ver D-041.
    surface: 'bg-yellow-50/70',
    border: 'border-yellow-300',
    accentBar: 'border-l-yellow-400',
    icon: 'text-slate-700',
    title: 'text-slate-800',
    divider: 'border-yellow-200',
  },
}
