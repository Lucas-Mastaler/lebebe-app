import { AlertTriangle } from 'lucide-react'
import { Button } from './Button'

/** Alterações não salvas (UNS=B — indicador inline + Descartar, sem modal). Só renderize quando `dirty` for true. */
export interface UnsavedChangesNoticeProps {
  onDiscard: () => void
  discardLabel?: string
}

export function UnsavedChangesNotice({ onDiscard, discardLabel = 'Descartar' }: UnsavedChangesNoticeProps) {
  return (
    <div className="flex items-center gap-2">
      <span className="flex items-center gap-1 text-xs font-semibold text-amber-600">
        <AlertTriangle className="size-3.5" />
        Alterações não salvas
      </span>
      <Button type="button" variant="destructive" size="sm" onClick={onDiscard}>
        {discardLabel}
      </Button>
    </div>
  )
}
