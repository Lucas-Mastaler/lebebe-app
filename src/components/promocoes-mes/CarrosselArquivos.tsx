'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/design-system'
import type { Promocao } from '@/lib/promocoes-mes/repositorio'
import { VisualizadorArquivo } from './VisualizadorArquivo'

type Slide = { chave: string; titulo: string; nome: string; mimeType: string; url: string; posicao: number; total: number }

export function montarSlides(promocoes: Promocao[]): Slide[] {
  return promocoes.flatMap((p) =>
    p.arquivos.filter((a) => a.url).map((a, i) => ({
      chave: a.id, titulo: p.titulo, nome: a.nome, mimeType: a.mimeType, url: a.url!, posicao: i + 1, total: p.arquivos.length,
    })),
  )
}

export function CarrosselArquivos({ promocoes, aoTentarNovamente }: { promocoes: Promocao[]; aoTentarNovamente: () => void }) {
  const slides = montarSlides(promocoes)
  const trilho = useRef<HTMLDivElement>(null)
  const [atual, setAtual] = useState(0)
  const indice = Math.min(atual, Math.max(slides.length - 1, 0))

  const ir = useCallback((destino: number) => {
    const el = trilho.current
    if (!el) return
    el.scrollTo({ left: destino * el.clientWidth, behavior: 'smooth' })
    setAtual(destino)
  }, [])

  useEffect(() => {
    const el = trilho.current
    if (!el) return
    const aoRolar = () => setAtual(Math.round(el.scrollLeft / Math.max(el.clientWidth, 1)))
    el.addEventListener('scroll', aoRolar, { passive: true })
    return () => el.removeEventListener('scroll', aoRolar)
  }, [slides.length])

  if (slides.length === 0) return null
  const slide = slides[indice]

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between gap-2 px-4 py-2">
        <p className="min-w-0 truncate text-sm font-semibold" aria-live="polite">
          {slide.titulo} · {slide.posicao}/{slide.total}
        </p>
        <span className="shrink-0 text-xs text-slate-500">Arquivo {indice + 1} de {slides.length}</span>
      </div>
      <div ref={trilho} className="flex h-[65dvh] snap-x snap-mandatory overflow-x-auto overflow-y-hidden scroll-smooth">
        {slides.map((s, i) => (
          <div key={s.chave} className="h-full w-full shrink-0 snap-center snap-always px-3" aria-hidden={i !== indice}>
            {/* só o slide visível é montado: evita renderizar todos os PDFs de uma vez */}
            {i === indice && (
              <VisualizadorArquivo url={s.url} nome={`${s.titulo} — ${s.nome}`} mimeType={s.mimeType} aoTentarNovamente={aoTentarNovamente} />
            )}
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between gap-2 border-t p-3">
        <Button type="button" variant="secondary" disabled={indice === 0} onClick={() => ir(indice - 1)}><ChevronLeft aria-hidden="true" />Anterior</Button>
        <div className="flex items-center gap-1" aria-hidden="true">
          {slides.length <= 12 && slides.map((s, i) => (
            <span key={s.chave} className={`size-2 rounded-full ${i === indice ? 'bg-primary' : 'bg-slate-300'}`} />
          ))}
        </div>
        <Button type="button" variant="secondary" disabled={indice === slides.length - 1} onClick={() => ir(indice + 1)}>Próxima<ChevronRight aria-hidden="true" /></Button>
      </div>
    </div>
  )
}
