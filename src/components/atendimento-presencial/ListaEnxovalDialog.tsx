'use client'

import { useRef, useState } from 'react'
import { BookOpen } from 'lucide-react'
import { Button, Dialog, DialogContent, DialogHeader, DialogTrigger } from '@/components/design-system'
import { LISTAS_ENXOVAL } from '@/lib/atendimento-presencial/listas-enxoval'

export function ListaEnxovalDialog() {
  const [aberto, setAberto] = useState(false)
  const [estacao, setEstacao] = useState<keyof typeof LISTAS_ENXOVAL>('verao')
  const [pagina, setPagina] = useState(0)
  const [falha, setFalha] = useState(false)
  const [tentativa, setTentativa] = useState(0)
  const corpo = useRef<HTMLDivElement>(null)
  const lista = LISTAS_ENXOVAL[estacao]
  function navegar(proxima: number) {
    setPagina(proxima)
    setFalha(false)
    corpo.current?.scrollTo({ top: 0 })
  }
  return <Dialog open={aberto} onOpenChange={setAberto}>
    <DialogTrigger asChild><Button type="button" variant="secondary" className="min-h-12 w-full"><BookOpen className="size-5" aria-hidden="true" />Ver lista de enxoval</Button></DialogTrigger>
    <DialogContent className="w-[calc(100vw-1rem)] max-w-3xl max-h-[95dvh]">
      <DialogHeader title="Lista de enxoval" description="Consulte o material de Verão ou Inverno." />
      <div className="flex gap-2 px-4" aria-label="Estação">
        {(Object.keys(LISTAS_ENXOVAL) as Array<keyof typeof LISTAS_ENXOVAL>).map(chave => <Button key={chave} type="button" variant={chave === estacao ? 'primary' : 'secondary'} aria-pressed={chave === estacao} onClick={() => { setEstacao(chave); navegar(0) }}>{LISTAS_ENXOVAL[chave].nome}</Button>)}
      </div>
      <div ref={corpo} className="min-h-0 flex-1 overflow-y-auto p-3">
        {aberto && <>
          {falha ? <div role="alert" className="space-y-3"><p>Não foi possível carregar esta página.</p><Button type="button" variant="secondary" onClick={() => { setTentativa(t => t + 1); setFalha(false) }}>Tentar novamente</Button></div>
            // PNG original: mantém leitura/zoom e não solicita páginas não visitadas.
            // eslint-disable-next-line @next/next/no-img-element
            : <img key={`${estacao}-${pagina}-${tentativa}`} src={`${lista.paginas[pagina]}${tentativa ? `?tentativa=${tentativa}` : ''}`} alt={`Lista de enxoval ${lista.nome}, página ${pagina + 1} de ${lista.paginas.length}`} width={1080} height={1920} className="h-auto w-full" onError={() => setFalha(true)} />}
        </>}
      </div>
      <div className="grid gap-2 border-t p-3">
        <div className="flex items-center justify-between gap-2"><Button type="button" variant="secondary" disabled={pagina === 0} onClick={() => navegar(pagina - 1)}>Anterior</Button><span className="text-sm" aria-live="polite">{pagina + 1} de {lista.paginas.length}</span><Button type="button" variant="secondary" disabled={pagina === lista.paginas.length - 1} onClick={() => navegar(pagina + 1)}>Próxima</Button></div>
        <a className="text-center text-sm font-semibold underline" href={lista.paginas[pagina]} target="_blank" rel="noopener noreferrer">Abrir imagem original</a>
      </div>
    </DialogContent>
  </Dialog>
}
