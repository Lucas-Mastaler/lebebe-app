'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { Minus, Plus } from 'lucide-react'
import { Button, LoadingLeBebe } from '@/components/design-system'

const ZOOM_MIN = 1
const ZOOM_MAX = 4
const limitarZoom = (z: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z))

/**
 * Zoom por pinça (touch), Ctrl+roda / pinça do trackpad (desktop), botões +/− e
 * duplo clique. O conteúdo cresce em largura; o scroller rola nos dois eixos.
 * Com zoom 1 só rola na vertical (a troca de slide por swipe horizontal continua livre).
 */
function ZoomArea({ children }: { children: (zoom: number) => ReactNode }) {
  const scroller = useRef<HTMLDivElement>(null)
  const [zoom, setZoom] = useState(1)
  const zoomRef = useRef(1)
  // rolagem a aplicar depois do render para manter o ponto focal sob os dedos/cursor
  const pendente = useRef<{ x: number; y: number } | null>(null)

  const aplicarZoom = useCallback((novo: number, focoX?: number, focoY?: number) => {
    const el = scroller.current
    const alvo = limitarZoom(novo)
    const atual = zoomRef.current
    if (!el || alvo === atual) return
    const rect = el.getBoundingClientRect()
    const fx = focoX === undefined ? el.clientWidth / 2 : focoX - rect.left
    const fy = focoY === undefined ? el.clientHeight / 2 : focoY - rect.top
    const razao = alvo / atual
    pendente.current = alvo === 1
      ? { x: 0, y: (el.scrollTop + fy) * razao - fy }
      : { x: (el.scrollLeft + fx) * razao - fx, y: (el.scrollTop + fy) * razao - fy }
    zoomRef.current = alvo
    setZoom(alvo)
  }, [])

  useLayoutEffect(() => {
    const el = scroller.current
    const p = pendente.current
    if (el && p) { el.scrollLeft = p.x; el.scrollTop = p.y }
    pendente.current = null
  }, [zoom])

  useEffect(() => {
    const el = scroller.current
    if (!el) return
    let distInicial = 0
    let zoomInicial = 1
    const distancia = (t: TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY)
    const aoTocar = (e: TouchEvent) => {
      if (e.touches.length === 2) { distInicial = distancia(e.touches); zoomInicial = zoomRef.current }
    }
    const aoMover = (e: TouchEvent) => {
      if (e.touches.length !== 2 || !distInicial) return
      e.preventDefault() // impede o zoom da página e a troca de slide durante a pinça
      aplicarZoom(zoomInicial * (distancia(e.touches) / distInicial),
        (e.touches[0].clientX + e.touches[1].clientX) / 2, (e.touches[0].clientY + e.touches[1].clientY) / 2)
    }
    const aoSoltar = (e: TouchEvent) => { if (e.touches.length < 2) distInicial = 0 }
    const aoRolar = (e: WheelEvent) => {
      if (!e.ctrlKey) return // sem Ctrl a roda rola o conteúdo normalmente
      e.preventDefault()
      aplicarZoom(zoomRef.current * Math.exp(-e.deltaY * 0.01), e.clientX, e.clientY)
    }
    el.addEventListener('touchstart', aoTocar, { passive: true })
    el.addEventListener('touchmove', aoMover, { passive: false })
    el.addEventListener('touchend', aoSoltar, { passive: true })
    el.addEventListener('touchcancel', aoSoltar, { passive: true })
    el.addEventListener('wheel', aoRolar, { passive: false })
    return () => {
      el.removeEventListener('touchstart', aoTocar)
      el.removeEventListener('touchmove', aoMover)
      el.removeEventListener('touchend', aoSoltar)
      el.removeEventListener('touchcancel', aoSoltar)
      el.removeEventListener('wheel', aoRolar)
    }
  }, [aplicarZoom])

  return (
    <div className="relative h-full">
      <div
        ref={scroller}
        data-zoom-scroller
        onDoubleClick={(e) => aplicarZoom(zoomRef.current > 1 ? 1 : 2, e.clientX, e.clientY)}
        className={`h-full overflow-auto ${zoom > 1 ? 'touch-pan-x touch-pan-y overscroll-contain' : 'touch-pan-y'}`}
      >
        <div style={{ width: `${zoom * 100}%`, height: zoom === 1 ? '100%' : undefined }}>{children(zoom)}</div>
      </div>
      <div className="absolute bottom-2 right-2 flex items-center gap-1 rounded-full bg-background/90 p-1 shadow">
        <Button type="button" variant="secondary" size="icon" aria-label="Diminuir zoom" disabled={zoom <= ZOOM_MIN} onClick={() => aplicarZoom(zoomRef.current / 1.5)}><Minus /></Button>
        <button type="button" aria-label="Zoom 100%" disabled={zoom === 1} onClick={() => aplicarZoom(1)} className="min-w-12 text-xs font-semibold tabular-nums disabled:opacity-60">{Math.round(zoom * 100)}%</button>
        <Button type="button" variant="secondary" size="icon" aria-label="Aumentar zoom" disabled={zoom >= ZOOM_MAX} onClick={() => aplicarZoom(zoomRef.current * 1.5)}><Plus /></Button>
      </div>
    </div>
  )
}

type Props = {
  url: string
  nome: string
  mimeType: string
  /** Pede novos links (URLs assinadas expiram). Chamado ao "Tentar novamente". */
  aoTentarNovamente: () => void
}

function Falha({ aoTentarNovamente }: { aoTentarNovamente: () => void }) {
  return (
    <div role="alert" className="flex h-full flex-col items-center justify-center gap-3 p-4 text-center">
      <p className="text-sm">Não foi possível carregar este arquivo.</p>
      <Button type="button" variant="secondary" onClick={aoTentarNovamente}>Tentar novamente</Button>
    </div>
  )
}

function PdfPaginas({ url, nome, aoFalhar }: { url: string; nome: string; aoFalhar: () => void }) {
  const raiz = useRef<HTMLDivElement>(null)
  const [carregando, setCarregando] = useState(true)
  // ref: a identidade de aoFalhar muda a cada render e não pode reiniciar a renderização do PDF
  const aoFalharRef = useRef(aoFalhar)
  useEffect(() => { aoFalharRef.current = aoFalhar })

  useEffect(() => {
    let cancelado = false
    const container = raiz.current
    if (!container) return
    container.replaceChildren()
    setCarregando(true)
    ;(async () => {
      try {
        const resposta = await fetch(url)
        if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`)
        const dados = new Uint8Array(await resposta.arrayBuffer())
        const pdfjs = await import('pdfjs-dist')
        pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()
        const pdf = await pdfjs.getDocument({ data: dados }).promise
        for (let n = 1; n <= pdf.numPages; n++) {
          if (cancelado) return
          const pagina = await pdf.getPage(n)
          const base0 = container.closest<HTMLElement>('[data-zoom-scroller]') ?? container
          const larguraAlvo = Math.max(base0.clientWidth, 280)
          const base = pagina.getViewport({ scale: 1 })
          const escala = larguraAlvo / base.width
          // resolução extra para o zoom não ficar borrado, limitada para não estourar memória no celular
          const fatorPixels = Math.min(Math.max(window.devicePixelRatio || 1, 1) * 1.5, 3)
          const viewport = pagina.getViewport({ scale: escala * Math.min(fatorPixels, 1800 / Math.max(larguraAlvo, 1)) })
          const canvas = document.createElement('canvas')
          canvas.width = Math.floor(viewport.width)
          canvas.height = Math.floor(viewport.height)
          canvas.style.width = '100%'
          canvas.style.height = 'auto'
          canvas.className = 'mb-2 block bg-white shadow-sm'
          canvas.setAttribute('role', 'img')
          canvas.setAttribute('aria-label', `${nome}, página ${n} de ${pdf.numPages}`)
          const contexto = canvas.getContext('2d')
          if (!contexto) throw new Error('canvas')
          await pagina.render({ canvasContext: contexto, canvas, viewport }).promise
          if (cancelado) return
          container.appendChild(canvas)
          if (n === 1) setCarregando(false)
        }
        setCarregando(false)
      } catch (erro) {
        if (!cancelado) {
          console.error('[PROMOCOES MES] falha ao exibir PDF', erro)
          aoFalharRef.current()
        }
      }
    })()
    return () => { cancelado = true }
  }, [url, nome])

  return (
    <div className="relative min-h-full">
      {carregando && <div className="absolute inset-0 flex items-center justify-center"><LoadingLeBebe /></div>}
      <div ref={raiz} className="p-1" />
    </div>
  )
}

export function VisualizadorArquivo({ url, nome, mimeType, aoTentarNovamente }: Props) {
  const [urlComFalha, setUrlComFalha] = useState<string | null>(null)
  if (urlComFalha === url) return <Falha aoTentarNovamente={aoTentarNovamente} />
  if (mimeType === 'application/pdf') {
    return <ZoomArea>{() => <PdfPaginas url={url} nome={nome} aoFalhar={() => setUrlComFalha(url)} />}</ZoomArea>
  }
  return (
    <ZoomArea>
      {(zoom) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={nome} draggable={false} className={zoom === 1 ? 'mx-auto block h-auto max-h-full w-auto max-w-full object-contain' : 'block h-auto w-full max-w-none'} onError={() => setUrlComFalha(url)} />
      )}
    </ZoomArea>
  )
}
