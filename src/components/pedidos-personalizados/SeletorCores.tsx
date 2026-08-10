'use client'

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import { AlertCircle, Search, X } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { LIMITE_CORES_POR_TAPETE } from '@/lib/pedidos-personalizados'
import { filtrarCores } from './novo-pedido-modelo'
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
  const [avisoLimite, setAvisoLimite] = useState(false)
  const filtradas = useMemo(() => filtrarCores(cores, busca), [cores, busca])

  useEffect(() => {
    if (selecionadas.length < LIMITE_CORES_POR_TAPETE) setAvisoLimite(false)
  }, [selecionadas.length])

  function alternar(id: string) {
    if (selecionadas.includes(id)) {
      onChange(selecionadas.filter((item) => item !== id))
      return
    }
    if (selecionadas.length >= LIMITE_CORES_POR_TAPETE) {
      setAvisoLimite(true)
      onLimite()
      return
    }
    onChange([...selecionadas, id])
  }

  return (
    <section aria-labelledby={`cores-tapete-${tapeteNumero}`} className="space-y-3">
      <div>
        <h4 id={`cores-tapete-${tapeteNumero}`} className="font-semibold text-slate-800">Cores</h4>
        <p className="text-sm text-slate-500">Busque no catálogo e selecione até {LIMITE_CORES_POR_TAPETE} cores.</p>
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

      <div className="max-h-80 overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 sm:max-h-[30rem] lg:max-h-[36rem]" role="group" aria-label="Catálogo de cores Moriah">
        {filtradas.length === 0 ? (
          <p className="p-3 text-sm text-slate-500">Nenhuma cor encontrada.</p>
        ) : <div className="columns-1 gap-1 sm:columns-2 lg:columns-3">{filtradas.map((cor) => {
          const marcada = selecionadas.includes(cor.id)
          const checkboxId = `tapete-${tapeteNumero}-cor-${cor.id}`
          return (
            <label key={cor.id} htmlFor={checkboxId} className="mb-1 flex min-h-11 cursor-pointer items-center gap-3 break-inside-avoid rounded-lg px-3 py-2 hover:bg-slate-50">
              <Checkbox
                id={checkboxId}
                checked={marcada}
                disabled={disabled || (!marcada && selecionadas.length >= LIMITE_CORES_POR_TAPETE)}
                onCheckedChange={() => alternar(cor.id)}
              />
              <span className="text-sm text-slate-700"><span className="font-semibold text-slate-900">{cor.numero} — {cor.nome}</span> — <span className="font-normal">{cor.codigo}</span></span>
            </label>
          )
        })}</div>}
      </div>

      {avisoLimite && (
        <p role="alert" className="flex items-center gap-1.5 text-sm font-medium text-red-600">
          <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
          Máximo de 6 cores por tapete.
        </p>
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
            src="/amostras-de-cores-2026.png"
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
            src="/amostras-de-cores-2026.png"
            alt="Cartela de cores Moriah"
            width={3072}
            height={2173}
            className="max-h-[90vh] max-w-[90vw] object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </section>
  )
}
