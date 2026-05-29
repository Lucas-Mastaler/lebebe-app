'use client'

import { useState } from 'react'
import { Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { SgiFiltros } from '@/types/sgi'

interface FiltrosSGIProps {
  onPesquisar: (filtros: SgiFiltros) => void
  isLoading?: boolean
}

const EMPTY: SgiFiltros = {
  dataInicio: '',
  dataFim: '',
  cliente: '',
  telefone: '',
  filial: '',
  vendedor: '',
  operacao: '',
  status: '',
  numeroLancamento: '',
  page: 1,
}

export function FiltrosSGI({ onPesquisar, isLoading }: FiltrosSGIProps) {
  const [form, setForm] = useState<SgiFiltros>(EMPTY)

  function set(field: keyof SgiFiltros, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  function handlePesquisar() {
    onPesquisar({ ...form, page: 1 })
  }

  function handleLimpar() {
    setForm(EMPTY)
    onPesquisar({ ...EMPTY })
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handlePesquisar()
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Filtros</p>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-500">Data início</label>
          <Input
            type="date"
            value={form.dataInicio ?? ''}
            onChange={e => set('dataInicio', e.target.value)}
            onKeyDown={handleKeyDown}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-500">Data fim</label>
          <Input
            type="date"
            value={form.dataFim ?? ''}
            onChange={e => set('dataFim', e.target.value)}
            onKeyDown={handleKeyDown}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-500">Nº Lançamento</label>
          <Input
            placeholder="ex: 28598"
            value={form.numeroLancamento ?? ''}
            onChange={e => set('numeroLancamento', e.target.value)}
            onKeyDown={handleKeyDown}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-500">Cliente</label>
          <Input
            placeholder="Nome do cliente"
            value={form.cliente ?? ''}
            onChange={e => set('cliente', e.target.value)}
            onKeyDown={handleKeyDown}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-500">Telefone</label>
          <Input
            placeholder="ex: 41999999999"
            value={form.telefone ?? ''}
            onChange={e => set('telefone', e.target.value)}
            onKeyDown={handleKeyDown}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-500">Filial</label>
          <Input
            placeholder="ex: Bigorrilho"
            value={form.filial ?? ''}
            onChange={e => set('filial', e.target.value)}
            onKeyDown={handleKeyDown}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-500">Vendedor</label>
          <Input
            placeholder="Nome do vendedor"
            value={form.vendedor ?? ''}
            onChange={e => set('vendedor', e.target.value)}
            onKeyDown={handleKeyDown}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-500">Operação</label>
          <Input
            placeholder="ex: Venda Comercial"
            value={form.operacao ?? ''}
            onChange={e => set('operacao', e.target.value)}
            onKeyDown={handleKeyDown}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-500">Status</label>
          <Input
            placeholder="ex: Finalizado"
            value={form.status ?? ''}
            onChange={e => set('status', e.target.value)}
            onKeyDown={handleKeyDown}
          />
        </div>
      </div>

      <div className="flex items-center gap-2 pt-1">
        <Button onClick={handlePesquisar} disabled={isLoading} size="sm">
          <Search className="w-4 h-4" />
          {isLoading ? 'Buscando...' : 'Pesquisar'}
        </Button>
        <Button variant="outline" onClick={handleLimpar} disabled={isLoading} size="sm">
          <X className="w-4 h-4" />
          Limpar
        </Button>
      </div>
    </div>
  )
}
