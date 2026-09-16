import { cn } from '@/lib/utils'

/** Ação principal no mobile (MOB=A — barra fixa no rodapé). Só aparece abaixo do breakpoint `md`; no desktop a ação fica onde o layout normal já colocaria (ex. dentro do `PageHeader`). */
export function MobileActionBar({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white p-3 shadow-[0_-4px_12px_-4px_rgba(15,23,42,0.1)] md:hidden', className)}>
      {children}
    </div>
  )
}
