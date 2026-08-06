'use client'

import { useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { AVISO_MUITAS_CORES, LIMITE_CORES_POR_TAPETE } from '@/lib/pedidos-personalizados'
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

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-500">{selecionadas.length} de {LIMITE_CORES_POR_TAPETE} cores</p>
        {selecionadas.length >= 7 && (
          <p role="status" className="max-w-md rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            {AVISO_MUITAS_CORES}
          </p>
        )}
      </div>

      <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-600">
        Cartela visual da Moriah ainda não adicionada ao sistema.
      </p>
    </section>
  )
}
