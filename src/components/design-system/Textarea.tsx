import { cn } from '@/lib/utils'

/** Textarea oficial (INP=A — mesmo visual bordado do Input; superfície `bg-input-background`, ver `Input.tsx`). */
export function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      data-slot="ds-textarea"
      className={cn(
        'placeholder:text-muted-foreground border-input bg-input-background flex min-h-16 w-full rounded-md border px-3 py-2 text-sm shadow-xs outline-none transition-[color,box-shadow] disabled:cursor-not-allowed disabled:opacity-50',
        'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
        'aria-invalid:ring-destructive/20 aria-invalid:border-destructive',
        'read-only:bg-muted read-only:text-muted-foreground',
        className
      )}
      {...props}
    />
  )
}
