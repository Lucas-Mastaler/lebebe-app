'use client'
import { ChevronRight, type LucideIcon } from 'lucide-react'
import { Button } from '@/components/design-system'

export function AcaoNegociacao({ titulo, descricao, icone: Icon, destaque = false, destrutiva = false, disabled, onClick }: {
  titulo: string; descricao: string; icone: LucideIcon; destaque?: boolean; destrutiva?: boolean; disabled?: boolean; onClick: () => void
}) {
  return <Button aria-label={titulo} variant={destaque ? 'primary' : 'secondary'} disabled={disabled} onClick={onClick}
    className={`h-auto min-h-24 w-full min-w-0 justify-start gap-3 whitespace-normal rounded-xl border px-4 py-3 text-left shadow-none sm:px-5 ${destaque ? 'border-blue-500 bg-blue-500 text-white hover:bg-blue-600' : 'border-blue-200 bg-white text-blue-900 hover:bg-blue-50'}`}>
    <span className={`flex size-12 shrink-0 items-center justify-center rounded-xl ${destrutiva ? 'bg-rose-50 text-rose-600' : 'bg-sky-100 text-blue-600'}`}><Icon className="size-6" aria-hidden="true" /></span>
    <span className="min-w-0 flex-1"><span className="block text-base font-bold leading-snug sm:text-lg">{titulo}</span><span className={`mt-1 block text-sm font-normal leading-snug ${destaque ? 'text-white' : 'text-slate-600'}`}>{descricao}</span></span>
    <ChevronRight className="size-5 shrink-0" aria-hidden="true" />
  </Button>
}
