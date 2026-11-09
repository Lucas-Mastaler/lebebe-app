'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Megaphone } from 'lucide-react'
import { Button, Dialog, DialogContent, DialogHeader, DialogTrigger, LoadingLeBebe } from '@/components/design-system'
import { CarrosselArquivos, montarSlides } from '@/components/promocoes-mes/CarrosselArquivos'
import type { Promocao } from '@/lib/promocoes-mes/repositorio'

type Estado = { tipo: 'carregando' } | { tipo: 'erro' } | { tipo: 'ok'; hoje: string; promocoes: Promocao[] }

export function PromocoesMesDialog() {
  const [aberto, setAberto] = useState(false)
  const [estado, setEstado] = useState<Estado>({ tipo: 'carregando' })

  const ultima = useRef<{ assinatura: string; em: number } | null>(null)

  const carregar = useCallback(async (forcar = true) => {
    try {
      const resposta = await fetch('/api/promocoes-mes/vigentes', { cache: 'no-store' })
      const corpo = await resposta.json().catch(() => null)
      if (!resposta.ok || !corpo?.ok) throw new Error('falha')
      const assinatura = `${corpo.hoje}|${(corpo.promocoes as Promocao[]).map((p) => `${p.id}:${p.arquivos.map((a) => a.id).join(',')}`).join(';')}`
      const anterior = ultima.current
      // Sem mudança e links ainda frescos (válidos por 15 min): não recarrega o visualizador.
      if (!forcar && anterior && anterior.assinatura === assinatura && Date.now() - anterior.em < 10 * 60 * 1000) return
      ultima.current = { assinatura, em: Date.now() }
      setEstado({ tipo: 'ok', hoje: corpo.hoje, promocoes: corpo.promocoes })
    } catch {
      if (forcar) setEstado({ tipo: 'erro' })
    }
  }, [])

  // Sempre reconsulta ao abrir (a vigência é calculada no servidor, sem cache local).
  useEffect(() => {
    if (!aberto) return
    setEstado({ tipo: 'carregando' })
    void carregar()
  }, [aberto, carregar])

  // Modal aberto na virada do dia ou aba que volta ao foco: reconsulta.
  useEffect(() => {
    if (!aberto) return
    const atualizar = () => { if (document.visibilityState === 'visible') void carregar(false) }
    document.addEventListener('visibilitychange', atualizar)
    window.addEventListener('focus', atualizar)
    const timer = window.setInterval(atualizar, 5 * 60 * 1000)
    return () => {
      document.removeEventListener('visibilitychange', atualizar)
      window.removeEventListener('focus', atualizar)
      window.clearInterval(timer)
    }
  }, [aberto, carregar])

  const semArquivos = estado.tipo === 'ok' && montarSlides(estado.promocoes).length === 0

  return <Dialog open={aberto} onOpenChange={setAberto}>
    <DialogTrigger asChild><Button type="button" variant="secondary" className="min-h-12 w-full"><Megaphone className="size-5" aria-hidden="true" />Promoções do Mês</Button></DialogTrigger>
    <DialogContent className="w-[calc(100vw-1rem)] max-w-3xl max-h-[95dvh]">
      <DialogHeader title="Promoções do Mês" description="Consulte as promoções vigentes hoje." />
      {estado.tipo === 'carregando' && <div className="flex min-h-48 items-center justify-center"><LoadingLeBebe /></div>}
      {estado.tipo === 'erro' && (
        <div role="alert" className="space-y-3 p-4">
          <p>Não foi possível carregar as promoções.</p>
          <Button type="button" variant="secondary" onClick={() => { setEstado({ tipo: 'carregando' }); void carregar() }}>Tentar novamente</Button>
        </div>
      )}
      {semArquivos && <p className="p-6 text-center">Nenhuma promoção vigente no momento.</p>}
      {estado.tipo === 'ok' && !semArquivos && (
        <CarrosselArquivos key={estado.hoje} promocoes={estado.promocoes} aoTentarNovamente={() => void carregar()} />
      )}
    </DialogContent>
  </Dialog>
}
