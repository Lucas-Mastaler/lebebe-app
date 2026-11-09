'use client'

import { useEffect, useRef, useState } from 'react'
import { Button, LoadingLeBebe } from '@/components/design-system'

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
          const larguraAlvo = Math.max(container.clientWidth, 280)
          const base = pagina.getViewport({ scale: 1 })
          const escala = larguraAlvo / base.width
          const viewport = pagina.getViewport({ scale: escala * Math.min(window.devicePixelRatio || 1, 2) })
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
    <div className="relative h-full">
      {carregando && <div className="absolute inset-0 flex items-center justify-center"><LoadingLeBebe /></div>}
      {/* pan-y: rolar o PDF na vertical não dispara a troca de slide */}
      <div ref={raiz} className="h-full touch-pan-y overflow-y-auto overscroll-contain p-1" />
    </div>
  )
}

export function VisualizadorArquivo({ url, nome, mimeType, aoTentarNovamente }: Props) {
  const [urlComFalha, setUrlComFalha] = useState<string | null>(null)
  if (urlComFalha === url) return <Falha aoTentarNovamente={aoTentarNovamente} />
  if (mimeType === 'application/pdf') {
    return <PdfPaginas url={url} nome={nome} aoFalhar={() => setUrlComFalha(url)} />
  }
  return (
    <div className="h-full overflow-auto">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt={nome} className="mx-auto h-auto max-h-full w-auto max-w-full object-contain" onError={() => setUrlComFalha(url)} />
    </div>
  )
}
