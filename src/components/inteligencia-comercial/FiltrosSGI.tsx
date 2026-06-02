'use client'

import { useState, useEffect } from 'react'
import { Search, X, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { MultiSelect } from '@/components/ui/multi-select'
import type { SgiFiltros } from '@/types/sgi'

interface FiltrosSGIProps {
  onPesquisar: (filtros: SgiFiltros) => void
  isLoading?: boolean
}

interface FilterOptions {
  filiais: string[]
  operacoes: string[]
  status: string[]
  vendedores: string[]
}

// Default dates: inicio = 2026-01-01, fim = yesterday
const getYesterday = () => {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return d.toISOString().split('T')[0]
}

const DEFAULT_INICIO = '2026-01-01'
const DEFAULT_FIM = getYesterday()

const EMPTY: SgiFiltros = {
  dataInicio: DEFAULT_INICIO,
  dataFim: DEFAULT_FIM,
  cliente: '',
  telefone: '',
  filiais: [],
  vendedores: [],
  operacoes: [],
  status: [],
  numeroLancamento: '',
  page: 1,
}

export function FiltrosSGI({ onPesquisar, isLoading }: FiltrosSGIProps) {
  const [form, setForm] = useState<SgiFiltros>(EMPTY)
  const [options, setOptions] = useState<FilterOptions>({
    filiais: [],
    operacoes: [],
    status: [],
    vendedores: [],
  })
  const [loadingOptions, setLoadingOptions] = useState(true)
  const [dateError, setDateError] = useState<string | null>(null)

  useEffect(() => {
    async function loadOptions() {
      try {
        const res = await fetch('/api/sgi/filtros')
        if (!res.ok) throw new Error('Erro ao carregar opções')
        const data = await res.json()
        setOptions(data)
      } catch (err) {
        console.error('[FiltrosSGI] Erro ao carregar opções:', err)
      } finally {
        setLoadingOptions(false)
      }
    }
    loadOptions()
  }, [])

  function setField<K extends keyof SgiFiltros>(field: K, value: SgiFiltros[K]) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  function handleNumeroLancamentoChange(value: string) {
    const numbersOnly = value.replace(/\D/g, '').slice(0, 6)
    setField('numeroLancamento', numbersOnly)
  }

  function handleClienteChange(value: string) {
    const normalized = value.replace(/\s+/g, ' ').trim().slice(0, 20)
    setField('cliente', normalized)
  }

  function handleTelefoneChange(value: string) {
    const numbersOnly = value.replace(/\D/g, '').slice(0, 11)
    setField('telefone', numbersOnly)
  }

  function formatTelefoneDisplay(value: string): string {
    const nums = value.replace(/\D/g, '')
    if (nums.length === 0) return ''
    if (nums.length <= 2) return `(${nums}`
    if (nums.length <= 7) return `(${nums.slice(0, 2)}) ${nums.slice(2)}`
    return `(${nums.slice(0, 2)}) ${nums.slice(2, 7)}-${nums.slice(7, 11)}`
  }

  function validateDates(): boolean {
    const { dataInicio, dataFim } = form
    if (!dataInicio || !dataFim) return true

    const inicio = new Date(dataInicio)
    const fim = new Date(dataFim)
    const minDate = new Date(DEFAULT_INICIO)
    const maxDate = new Date(DEFAULT_FIM)

    if (inicio < minDate) {
      setDateError('Data início não pode ser anterior a 01/01/2026')
      return false
    }
    if (fim > maxDate) {
      setDateError('Data fim não pode ser maior que ontem')
      return false
    }
    if (inicio > fim) {
      setDateError('Data início não pode ser maior que data fim')
      return false
    }

    setDateError(null)
    return true
  }

  function handlePesquisar() {
    if (!validateDates()) return
    onPesquisar({ ...form, page: 1 })
  }

  function handleLimpar() {
    setForm(EMPTY)
    setDateError(null)
    onPesquisar({ ...EMPTY })
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handlePesquisar()
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Filtros</p>

      <div className="space-y-3">
        {/* First row: dates and simple inputs */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-500">Data início</label>
            <Input
              type="date"
              min={DEFAULT_INICIO}
              max={DEFAULT_FIM}
              value={form.dataInicio ?? ''}
              onChange={e => { setField('dataInicio', e.target.value); validateDates() }}
              onKeyDown={handleKeyDown}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-500">Data fim</label>
            <Input
              type="date"
              min={DEFAULT_INICIO}
              max={DEFAULT_FIM}
              value={form.dataFim ?? ''}
              onChange={e => { setField('dataFim', e.target.value); validateDates() }}
              onKeyDown={handleKeyDown}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-500">Nº Lançamento</label>
            <Input
              placeholder="ex: 28598"
              value={form.numeroLancamento ?? ''}
              onChange={e => handleNumeroLancamentoChange(e.target.value)}
              onKeyDown={handleKeyDown}
              maxLength={6}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-500">Cliente</label>
            <Input
              placeholder="Nome do cliente"
              value={form.cliente ?? ''}
              onChange={e => handleClienteChange(e.target.value)}
              onKeyDown={handleKeyDown}
              maxLength={20}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-500">Telefone</label>
            <Input
              placeholder="(41) 99999-9999"
              value={formatTelefoneDisplay(form.telefone ?? '')}
              onChange={e => handleTelefoneChange(e.target.value)}
              onKeyDown={handleKeyDown}
              maxLength={15}
            />
            <p className="text-[10px] text-slate-400">
              Digite apenas DDD + número, sem código do país. Ex.: 41999999999
            </p>
          </div>
        </div>

        {/* Second row: multi-select filters - flex to occupy full line */}
        <div className="flex flex-wrap gap-3">
          <div className="flex flex-col gap-1 min-w-[140px] flex-1">
            <label className="text-xs text-slate-500">Filial</label>
            {loadingOptions ? (
              <div className="h-9 bg-slate-100 rounded-md animate-pulse" />
            ) : (
              <MultiSelect
                options={options.filiais}
                selected={form.filiais ?? []}
                onChange={v => setField('filiais', v)}
                placeholder="Selecione filiais..."
              />
            )}
          </div>

          <div className="flex flex-col gap-1 min-w-[140px] flex-1">
            <label className="text-xs text-slate-500">Vendedor</label>
            {loadingOptions ? (
              <div className="h-9 bg-slate-100 rounded-md animate-pulse" />
            ) : (
              <MultiSelect
                options={options.vendedores}
                selected={form.vendedores ?? []}
                onChange={v => setField('vendedores', v)}
                placeholder="Selecione vendedores..."
              />
            )}
          </div>

          <div className="flex flex-col gap-1 min-w-[140px] flex-1">
            <label className="text-xs text-slate-500">Operação</label>
            {loadingOptions ? (
              <div className="h-9 bg-slate-100 rounded-md animate-pulse" />
            ) : (
              <MultiSelect
                options={options.operacoes}
                selected={form.operacoes ?? []}
                onChange={v => setField('operacoes', v)}
                placeholder="Selecione operações..."
              />
            )}
          </div>

          <div className="flex flex-col gap-1 min-w-[140px] flex-1">
            <label className="text-xs text-slate-500">Status</label>
            {loadingOptions ? (
              <div className="h-9 bg-slate-100 rounded-md animate-pulse" />
            ) : (
              <MultiSelect
                options={options.status}
                selected={form.status ?? []}
                onChange={v => setField('status', v)}
                placeholder="Selecione status..."
              />
            )}
          </div>
        </div>
      </div>

      {dateError && (
        <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">
          <AlertCircle className="w-3.5 h-3.5" />
          {dateError}
        </div>
      )}

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
