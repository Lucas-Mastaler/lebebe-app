'use client'

import { useMemo, useState } from 'react'
import Image from 'next/image'
import { ArrowDown, ArrowUp, BookOpen, ExternalLink, Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { LIMITE_CORES_POR_TAPETE } from '@/lib/pedidos-personalizados'
import { filtrarCores, moverItem } from './novo-pedido-modelo'
import type { CorOpcao } from './novo-pedido-modelo'

type Props = {
  tapeteNumero: number
  cores: readonly CorOpcao[]
  selecionadas: readonly string[]
  disabled?: boolean
  onChange: (ids: string[]) => void
  onLimite: () => void
}

export function SeletorCores({ tapeteNumero, cores, selecionadas, disabled, onChange, onLimite }: Props) {
  const [busca, setBusca] = useState('')
  const [zoom, setZoom] = useState(false)
  const [catalogo, setCatalogo] = useState(false)
  const filtradas = useMemo(() => filtrarCores(cores, busca), [cores, busca])
  const porId = useMemo(() => new Map(cores.map((cor) => [cor.id, cor])), [cores])

  function alternar(id: string) {
    if (selecionadas.includes(id)) {
      onChange(selecionadas.filter((item) => item !== id))
      return
    }
    if (selecionadas.length >= LIMITE_CORES_POR_TAPETE) {
      onLimite()
      return
    }
    onChange([...selecionadas, id])
  }

  return (
    <section aria-labelledby={`cores-tapete-${tapeteNumero}`} className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h4 id={`cores-tapete-${tapeteNumero}`} className="font-semibold text-slate-800">Cores</h4>
          <p className="text-sm text-slate-500">Busque no catálogo e selecione até {LIMITE_CORES_POR_TAPETE} cores.</p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setCatalogo(true)}
          disabled={disabled}
          aria-label="Ver catálogo de tapetes"
        >
          <BookOpen className="size-4" />
          Ver Catálogo
        </Button>
      </div>

      <div className="relative">
        <Search aria-hidden="true" className="absolute left-3 top-3.5 size-4 text-slate-400" />
        <Input
          value={busca}
          onChange={(event) => setBusca(event.target.value)}
          placeholder="Buscar por número, código ou nome"
          className="h-11 pl-9"
          aria-label={`Buscar cores para o tapete ${tapeteNumero}`}
          disabled={disabled}
        />
      </div>

      <div className="max-h-64 overflow-y-auto rounded-xl border border-slate-200 bg-white p-2" role="group" aria-label="Catálogo de cores Moriah">
        {filtradas.length === 0 ? (
          <p className="p-3 text-sm text-slate-500">Nenhuma cor encontrada.</p>
        ) : filtradas.map((cor) => {
          const marcada = selecionadas.includes(cor.id)
          const checkboxId = `tapete-${tapeteNumero}-cor-${cor.id}`
          return (
            <label key={cor.id} htmlFor={checkboxId} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-3 py-2 hover:bg-slate-50">
              <Checkbox
                id={checkboxId}
                checked={marcada}
                disabled={disabled || (!marcada && selecionadas.length >= LIMITE_CORES_POR_TAPETE)}
                onCheckedChange={() => alternar(cor.id)}
              />
              <span className="text-sm text-slate-700">{cor.numero} — {cor.codigo} — {cor.nome}</span>
            </label>
          )
        })}
      </div>

      {selecionadas.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-semibold text-slate-700">Cores selecionadas</p>
          <ol className="space-y-2" aria-label={`Ordem das cores do tapete ${tapeteNumero}`}>
            {selecionadas.map((id, indice) => {
              const cor = porId.get(id)
              if (!cor) return null
              return (
                <li key={id} className="flex min-w-0 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2">
                  <span className="min-w-0 flex-1 text-sm font-medium text-slate-700">
                    {indice + 1}. {cor.numero} — {cor.codigo} — {cor.nome}
                  </span>
                  <Button type="button" variant="ghost" size="icon" className="size-11" disabled={disabled || indice === 0} aria-label={`Mover ${cor.nome} para cima`} onClick={() => onChange(moverItem(selecionadas, indice, -1))}>
                    <ArrowUp />
                  </Button>
                  <Button type="button" variant="ghost" size="icon" className="size-11" disabled={disabled || indice === selecionadas.length - 1} aria-label={`Mover ${cor.nome} para baixo`} onClick={() => onChange(moverItem(selecionadas, indice, 1))}>
                    <ArrowDown />
                  </Button>
                  <Button type="button" variant="ghost" size="icon" className="size-11 text-red-600 hover:text-red-700" disabled={disabled} aria-label={`Remover ${cor.nome}`} onClick={() => alternar(id)}>
                    <X />
                  </Button>
                </li>
              )
            })}
          </ol>
        </div>
      )}

      <p className="text-sm text-slate-500">{selecionadas.length} de {LIMITE_CORES_POR_TAPETE} cores</p>

      <figure className="space-y-1">
        <button
          type="button"
          onClick={() => setZoom(true)}
          className="block w-full cursor-zoom-in overflow-hidden rounded-lg border border-slate-200 bg-white"
          aria-label="Ampliar cartela de cores"
        >
          <Image
            src="/amostras-de-cores-2026.jpg"
            alt="Cartela de cores Moriah"
            width={1024}
            height={726}
            sizes="(max-width: 768px) 100vw, 480px"
            className="h-auto w-full object-contain"
            priority={false}
          />
        </button>
        <figcaption className="text-xs text-slate-500">Clique na imagem para ampliar.</figcaption>
      </figure>

      {zoom && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Cartela de cores ampliada"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setZoom(false)}
        >
          <button
            type="button"
            className="absolute right-4 top-4 inline-flex size-11 items-center justify-center rounded-full bg-white/90 text-slate-800 hover:bg-white"
            aria-label="Fechar"
            onClick={() => setZoom(false)}
          >
            <X />
          </button>
          <Image
            src="/amostras-de-cores-2026.jpg"
            alt="Cartela de cores Moriah"
            width={3072}
            height={2173}
            className="max-h-[90vh] max-w-[90vw] object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {catalogo && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Catálogo de tapetes"
          className="fixed inset-0 z-50 flex flex-col bg-black/80 p-4 sm:p-6"
          onClick={() => setCatalogo(false)}
        >
          <div
            className="relative flex h-full w-full flex-col overflow-hidden rounded-xl bg-white"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-4 py-2">
              <span className="text-sm font-semibold text-slate-800">Catálogo</span>
              <div className="flex items-center gap-2">
                <a
                  href="https://book107992.publuu.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-sm font-medium text-slate-700 hover:bg-slate-100"
                >
                  <ExternalLink className="size-4" />
                  Abrir em nova guia
                </a>
                <button
                  type="button"
                  className="inline-flex size-9 items-center justify-center rounded-md text-slate-700 hover:bg-slate-100"
                  aria-label="Fechar"
                  onClick={() => setCatalogo(false)}
                >
                  <X />
                </button>
              </div>
            </div>
            <iframe
              src="https://book107992.publuu.com/"
              title="Catálogo de tapetes"
              className="h-full w-full flex-1 border-0"
              loading="lazy"
            />
          </div>
        </div>
      )}
    </section>
  )
}
