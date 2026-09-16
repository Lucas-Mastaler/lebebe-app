import type * as React from 'react'
import { XIcon } from 'lucide-react'
import {
  Dialog,
  DialogTrigger,
  DialogPortal,
  DialogOverlay,
  DialogFooter,
  DialogDescription,
  DialogContent as UiDialogContent,
  DialogClose,
  DialogTitle as UiDialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

/**
 * Dialog/Modal oficial (MOD=A). Resolve NO-OVERLAP estruturalmente: o
 * botão fechar não é mais posicionado em `absolute` sobre o título (causa
 * raiz do bug relatado em `/chamados-finalizados` — ver DECISOES.md
 * NO-OVERLAP). `DialogHeader` é uma linha flex: título/descrição em
 * `min-w-0 flex-1` (encolhe e quebra linha, nunca é coberto) e o botão
 * fechar em `shrink-0` na mesma linha (sempre reserva o próprio espaço,
 * geometricamente impossível de sobrepor o título). O header também fica
 * FORA da área de scroll (`DialogBody` é quem rola) — não depende de
 * `position: sticky`/`z-index` para permanecer visível, então não há
 * disputa de camada entre o fundo do header e o botão fechar.
 */

export { Dialog, DialogTrigger, DialogPortal, DialogOverlay, DialogFooter, DialogDescription, DialogClose }

export type DialogContentProps = React.ComponentProps<typeof UiDialogContent>

export function DialogContent({ className, children, ...props }: DialogContentProps) {
  return (
    <UiDialogContent
      showCloseButton={false}
      className={cn('flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden p-0', className)}
      {...props}
    >
      {children}
    </UiDialogContent>
  )
}

export interface DialogHeaderProps {
  title: React.ReactNode
  description?: React.ReactNode
  className?: string
  titleClassName?: string
  closeLabel?: string
  children?: React.ReactNode
}

export function DialogHeader({ title, description, className, titleClassName, closeLabel = 'Fechar', children }: DialogHeaderProps) {
  return (
    <div className={cn('flex shrink-0 items-start justify-between gap-4 border-b border-slate-100 bg-white px-6 py-4', className)}>
      <div className="min-w-0 flex-1">
        <UiDialogTitle className={cn('text-lg leading-snug font-semibold break-words text-slate-900', titleClassName)}>
          {title}
        </UiDialogTitle>
        {description && <DialogDescription className="mt-1">{description}</DialogDescription>}
        {children}
      </div>
      <DialogClose
        className="shrink-0 rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none"
        aria-label={closeLabel}
      >
        <XIcon className="h-4 w-4" />
      </DialogClose>
    </div>
  )
}

export function DialogBody({ className, children }: { className?: string; children?: React.ReactNode }) {
  return <div className={cn('min-h-0 flex-1 overflow-y-auto px-6 py-4', className)}>{children}</div>
}
