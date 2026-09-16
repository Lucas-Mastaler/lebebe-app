import { cn } from '@/lib/utils'

export interface LoadingLeBebeProps {
  /** Largura e altura do ícone. Números são interpretados como pixels. */
  size?: number | string
  /** Texto anunciado por leitores de tela. */
  label?: string
  className?: string
}

/**
 * Indicador de carregamento de marca em SVG. Complementa `Spinner`: o spinner
 * continua sendo o padrão compacto para ações pontuais (LDG=A).
 */
export function LoadingLeBebe({ size = 48, label = 'Carregando', className }: LoadingLeBebeProps) {
  return (
    <svg
      aria-label={label}
      className={cn('lb-loading-star text-primary', className)}
      height={size}
      role="status"
      viewBox="0 0 96 96"
      width={size}
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>{label}</title>
      <path className="lb-loading-star-halo fill-primary/20" d="M48 7 58.5 35.5 89 37 65.5 56.5 73.5 87 48 69 22.5 87l8-30.5L7 37l30.5-1.5L48 7Z" />
      <path className="fill-primary" d="M48 7 58.5 35.5 89 37 65.5 56.5 73.5 87 48 69 22.5 87l8-30.5L7 37l30.5-1.5L48 7Z" />
      <g transform="translate(8 8) scale(.8333)">
        <path className="lb-loading-star-core fill-[var(--accent)]" d="M48 7 58.5 35.5 89 37 65.5 56.5 73.5 87 48 69 22.5 87l8-30.5L7 37l30.5-1.5L48 7Z" />
      </g>
      <g className="lb-loading-star-sparkles fill-current" aria-hidden="true">
        <path className="lb-loading-star-sparkle lb-loading-star-sparkle-a" d="M48 0v7m-3.5-3.5h7" stroke="currentColor" strokeLinecap="round" strokeWidth="2.5" />
        <path className="lb-loading-star-sparkle lb-loading-star-sparkle-b" d="m82 16 2.5 5 5 2.5-5 2.5-2.5 5-2.5-5-5-2.5 5-2.5 2.5-5Z" />
        <path className="lb-loading-star-sparkle lb-loading-star-sparkle-c" d="m13 67 2 4 4 2-4 2-2 4-2-4-4-2 4-2 2-4Z" />
      </g>
    </svg>
  )
}
