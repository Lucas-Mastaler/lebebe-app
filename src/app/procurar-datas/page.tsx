'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { CalendarCheck, Loader2, MapPin, RefreshCw, Search, Send, TimerReset } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

type OptionLists = {
  tipoBerco?: string[]
  comoda?: string[]
  roupeiro?: string[]
  poltrona?: string[]
  painel?: string[]
}

type AddressResult = {
  ok?: boolean
  lat?: number
  lng?: number
  enderecoCompleto?: string
  display?: string
  display_name?: string
  provider?: string
  cep?: string
  address?: Record<string, string>
}

type Candidate = {
  dateISO: string
  team: string
  frete?: string
  tipo?: string
  isExtra?: boolean
  weekday?: string
  date?: string
  dateDM?: string
  rank?: number
}

type SearchPayload = {
  cep?: string
  tempo?: string
  label?: string
  address?: string
  addressShort?: string
  params?: string
  candidates?: Candidate[]
  searchTime?: string
}

type FormState = {
  logradouro: string
  numero: string
  bairro: string
  cidade: string
  uf: string
  dataInicial: string
  isEncomenda: boolean
  isRural: boolean
  isCondominio: boolean
  tipoBerco: string
  comoda: string
  roupeiro: string
  poltrona: string
  painel: string
}

const initialForm: FormState = {
  logradouro: '',
  numero: '',
  bairro: '',
  cidade: '',
  uf: 'PR',
  dataInicial: '',
  isEncomenda: false,
  isRural: false,
  isCondominio: false,
  tipoBerco: '',
  comoda: '',
  roupeiro: '',
  poltrona: '',
  painel: '',
}

function isoDatePlus(days: number) {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

function createClientToken() {
  return `app-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function normalizeSelectValue(value?: string) {
  return value || ''
}

async function readJson(response: Response) {
  const data = await response.json().catch(() => null)
  if (!response.ok || data?.ok === false) {
    throw new Error(data?.error || 'Erro ao processar solicitacao.')
  }
  return data
}

export default function ProcurarDatasPage() {
  const [form, setForm] = useState<FormState>(initialForm)
  const [opcoes, setOpcoes] = useState<OptionLists>({})
  const [tempoMapLoaded, setTempoMapLoaded] = useState(false)
  const [tempoNecessario, setTempoNecessario] = useState('')
  const [addressResult, setAddressResult] = useState<AddressResult | null>(null)
  const [searchPayload, setSearchPayload] = useState<SearchPayload | null>(null)
  const [clientToken, setClientToken] = useState('')
  const [phase, setPhase] = useState('Carregando opcoes')
  const [progressText, setProgressText] = useState('')
  const [loadingOptions, setLoadingOptions] = useState(true)
  const [validatingAddress, setValidatingAddress] = useState(false)
  const [calculatingTime, setCalculatingTime] = useState(false)
  const [searching, setSearching] = useState(false)
  const [schedulingIndex, setSchedulingIndex] = useState<number | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const minDate = useMemo(() => isoDatePlus(form.isEncomenda ? 42 : 2), [form.isEncomenda])
  const maxDate = useMemo(() => isoDatePlus(90), [])
  const candidates = searchPayload?.candidates || []

  useEffect(() => {
    setForm((current) => {
      if (current.dataInicial && current.dataInicial >= minDate && current.dataInicial <= maxDate) {
        return current
      }
      return { ...current, dataInicial: minDate }
    })
  }, [minDate, maxDate])

  useEffect(() => {
    let active = true

    async function loadOptions() {
      setLoadingOptions(true)
      setPhase('Carregando opcoes')
      try {
        const response = await fetch('/api/procurar-datas/opcoes')
        const data = await readJson(response)
        if (!active) return
        setOpcoes(data.opcoes || {})
        setTempoMapLoaded(!!data.tempoMap)
        setPhase('Pronto para validar endereco')
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Erro ao carregar opcoes.'
        toast.error(message)
        setPhase('Erro ao carregar opcoes')
      } finally {
        if (active) setLoadingOptions(false)
      }
    }

    loadOptions()

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (!tempoMapLoaded) return
    const hasSelection = form.tipoBerco || form.comoda || form.roupeiro || form.poltrona || form.painel || form.isCondominio
    if (!hasSelection) {
      setTempoNecessario('')
      return
    }

    const timeout = setTimeout(async () => {
      setCalculatingTime(true)
      setPhase('Calculando tempo')
      try {
        const response = await fetch('/api/procurar-datas/calcular-tempo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        })
        const data = await readJson(response)
        setTempoNecessario(data.tempoNecessario || '')
        setPhase(addressResult ? 'Pronto para buscar datas' : 'Pronto para validar endereco')
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Erro ao calcular tempo.'
        toast.error(message)
        setPhase('Erro ao calcular tempo')
      } finally {
        setCalculatingTime(false)
      }
    }, 350)

    return () => clearTimeout(timeout)
  }, [form, tempoMapLoaded, addressResult])

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [])

  function updateForm<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }))
    if (['logradouro', 'numero', 'bairro', 'cidade', 'uf'].includes(String(key))) {
      setAddressResult(null)
      setSearchPayload(null)
      setPhase('Endereco alterado')
    }
  }

  async function validarEndereco() {
    if (!form.logradouro.trim() || !form.bairro.trim() || !form.cidade.trim() || form.uf.trim().length !== 2) {
      toast.error('Informe logradouro, bairro, cidade e UF.')
      return
    }

    setValidatingAddress(true)
    setPhase('Validando endereco')
    setSearchPayload(null)

    try {
      const response = await fetch('/api/procurar-datas/validar-endereco', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await readJson(response)
      const resultado = data.resultado as AddressResult

      if (!resultado?.ok || !resultado.lat || !resultado.lng) {
        setAddressResult(null)
        setPhase('Endereco nao localizado')
        toast.error('Nao foi possivel localizar este endereco com precisao segura.')
        return
      }

      setAddressResult(resultado)
      setPhase(tempoNecessario ? 'Pronto para buscar datas' : 'Calculando tempo')
      toast.success('Endereco validado.')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao validar endereco.'
      toast.error(message)
      setPhase('Erro ao validar endereco')
    } finally {
      setValidatingAddress(false)
    }
  }

  function startPolling(token: string) {
    if (pollRef.current) clearInterval(pollRef.current)

    pollRef.current = setInterval(async () => {
      try {
        const response = await fetch(`/api/procurar-datas/progresso?clientToken=${encodeURIComponent(token)}`)
        const data = await readJson(response)
        const progress = data.progress || {}
        const status = progress.status || ''
        const normais = Array.isArray(progress.normais) ? progress.normais.length : 0
        const extras = Array.isArray(progress.extras) ? progress.extras.length : 0

        if (status) {
          setProgressText(`Status: ${status}${normais || extras ? ` | candidatos: ${normais + extras}` : ''}`)
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Erro no polling.'
        setProgressText(message)
      }
    }, 3000)
  }

  function stopPolling() {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }

  async function pesquisarDatas() {
    if (!addressResult?.lat || !addressResult.lng) {
      toast.error('Valide o endereco antes de pesquisar.')
      return
    }
    if (!tempoNecessario || tempoNecessario === '<--- PREENCHA') {
      toast.error('Selecione os itens para calcular o tempo necessario.')
      return
    }

    const token = createClientToken()
    setClientToken(token)
    setSearching(true)
    setSearchPayload(null)
    setProgressText('')
    setPhase('Buscando datas')
    startPolling(token)

    try {
      const body = {
        ...form,
        clientToken: token,
        tempoNecessario,
        cep: addressResult.cep || '',
        lat: addressResult.lat,
        lng: addressResult.lng,
        destLat: addressResult.lat,
        destLng: addressResult.lng,
        destDisplay: addressResult.enderecoCompleto || addressResult.display || addressResult.display_name || '',
        destProvider: addressResult.provider || '',
        enderecoCompleto: addressResult.enderecoCompleto || addressResult.display || addressResult.display_name || '',
        monthYear: form.dataInicial,
      }

      const response = await fetch('/api/procurar-datas/pesquisar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await readJson(response)
      const payload = data.payload as SearchPayload
      setSearchPayload(payload || null)
      setPhase('Resultados finalizados')
      toast.success('Busca concluida.')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao pesquisar datas.'
      toast.error(message)
      setPhase('Erro ao pesquisar datas')
    } finally {
      stopPolling()
      setSearching(false)
    }
  }

  async function preAgendar(candidate: Candidate, index: number) {
    if (!searchPayload) return
    setSchedulingIndex(index)
    setPhase('Pre-agendando')

    try {
      const response = await fetch('/api/procurar-datas/pre-agendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cand: {
            dateISO: candidate.dateISO,
            team: candidate.team,
            frete: candidate.frete || '',
            tipo: candidate.tipo || '',
          },
          meta: {
            tempo: searchPayload.tempo || tempoNecessario,
            label: searchPayload.label || '',
            address: searchPayload.address || searchPayload.addressShort || '',
            cep: searchPayload.cep || '',
            params: searchPayload.params || '',
          },
        }),
      })
      const data = await readJson(response)
      toast.success(data.titulo ? `Pre-agendado: ${data.titulo}` : 'Pre-agendamento criado.')
      setPhase('Pre-agendamento concluido')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao pre-agendar.'
      toast.error(message)
      setPhase('Erro ao pre-agendar')
    } finally {
      setSchedulingIndex(null)
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-4">
      <div className="flex flex-col gap-2 border-b border-slate-200 pb-4">
        <div className="flex items-center gap-2 text-[#00A5E6]">
          <CalendarCheck className="h-5 w-5" />
          <h1 className="text-xl font-semibold text-slate-900">Procurar Datas</h1>
        </div>
        <p className="text-sm text-slate-500">Fluxo operacional conectado ao motor atual do Apps Script.</p>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <section className="border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Dados da busca</h2>
              <p className="text-xs text-slate-500">Status: {phase}</p>
            </div>
            {loadingOptions && <Loader2 className="h-5 w-5 animate-spin text-[#00A5E6]" />}
          </div>

          <div className="grid gap-3 md:grid-cols-6">
            <label className="md:col-span-3">
              <span className="mb-1 block text-xs font-medium text-slate-600">Logradouro</span>
              <Input value={form.logradouro} onChange={(e) => updateForm('logradouro', e.target.value)} />
            </label>
            <label>
              <span className="mb-1 block text-xs font-medium text-slate-600">Numero</span>
              <Input value={form.numero} onChange={(e) => updateForm('numero', e.target.value)} />
            </label>
            <label className="md:col-span-2">
              <span className="mb-1 block text-xs font-medium text-slate-600">Bairro</span>
              <Input value={form.bairro} onChange={(e) => updateForm('bairro', e.target.value)} />
            </label>
            <label className="md:col-span-3">
              <span className="mb-1 block text-xs font-medium text-slate-600">Cidade</span>
              <Input value={form.cidade} onChange={(e) => updateForm('cidade', e.target.value)} />
            </label>
            <label>
              <span className="mb-1 block text-xs font-medium text-slate-600">UF</span>
              <Input maxLength={2} value={form.uf} onChange={(e) => updateForm('uf', e.target.value.toUpperCase())} />
            </label>
            <div className="md:col-span-2 flex items-end">
              <Button type="button" variant="outline" onClick={validarEndereco} disabled={validatingAddress || loadingOptions} className="w-full">
                {validatingAddress ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
                Validar endereco
              </Button>
            </div>
          </div>

          {addressResult?.ok && (
            <div className="mt-3 border border-sky-100 bg-sky-50 p-3 text-sm text-slate-700">
              <div className="font-medium text-slate-900">{addressResult.enderecoCompleto || addressResult.display || 'Endereco validado'}</div>
              <div className="mt-1 text-xs text-slate-500">
                Lat {Number(addressResult.lat).toFixed(5)}, Lng {Number(addressResult.lng).toFixed(5)}
                {addressResult.provider ? ` | ${addressResult.provider}` : ''}
              </div>
            </div>
          )}

          <div className="mt-5 grid gap-3 md:grid-cols-6">
            <label className="md:col-span-2">
              <span className="mb-1 block text-xs font-medium text-slate-600">Data inicial</span>
              <Input
                type="date"
                min={minDate}
                max={maxDate}
                value={form.dataInicial}
                onChange={(e) => updateForm('dataInicial', e.target.value)}
              />
            </label>
            <label className="flex items-center gap-2 pt-6 text-sm text-slate-700">
              <input type="checkbox" checked={form.isEncomenda} onChange={(e) => updateForm('isEncomenda', e.target.checked)} />
              Encomenda
            </label>
            <label className="flex items-center gap-2 pt-6 text-sm text-slate-700">
              <input type="checkbox" checked={form.isRural} onChange={(e) => updateForm('isRural', e.target.checked)} />
              Area rural
            </label>
            <label className="flex items-center gap-2 pt-6 text-sm text-slate-700 md:col-span-2">
              <input type="checkbox" checked={form.isCondominio} onChange={(e) => updateForm('isCondominio', e.target.checked)} />
              Condominio
            </label>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-5">
            {(['tipoBerco', 'comoda', 'roupeiro', 'poltrona', 'painel'] as const).map((key) => (
              <label key={key}>
                <span className="mb-1 block text-xs font-medium text-slate-600">
                  {key === 'tipoBerco' ? 'Berco / cama' : key.charAt(0).toUpperCase() + key.slice(1)}
                </span>
                <select
                  value={form[key]}
                  onChange={(e) => updateForm(key, e.target.value)}
                  className="h-9 w-full border border-slate-200 bg-white px-3 text-sm outline-none focus:border-[#00A5E6]"
                >
                  <option value="">Selecione</option>
                  {(opcoes[key] || []).map((option) => (
                    <option key={option} value={normalizeSelectValue(option)}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>

          <div className="mt-5 flex flex-col gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 text-sm text-slate-700">
              <TimerReset className="h-4 w-4 text-[#00A5E6]" />
              <span>Tempo necessario:</span>
              <strong className="text-slate-900">{calculatingTime ? 'calculando...' : tempoNecessario || '-'}</strong>
            </div>
            <Button type="button" onClick={pesquisarDatas} disabled={searching || validatingAddress || calculatingTime || !addressResult?.ok}>
              {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Pesquisar datas
            </Button>
          </div>
        </section>

        <aside className="border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <RefreshCw className="h-4 w-4 text-[#00A5E6]" />
            <h2 className="text-base font-semibold text-slate-900">Andamento</h2>
          </div>
          <div className="space-y-2 text-sm">
            {['Validando endereco', 'Calculando tempo', 'Buscando datas', 'Calculando rotas', 'Finalizando resultados'].map((step) => {
              const active = phase.toLowerCase().includes(step.toLowerCase().split(' ')[0])
              return (
                <div key={step} className={`border px-3 py-2 ${active ? 'border-sky-200 bg-sky-50 text-sky-800' : 'border-slate-200 text-slate-500'}`}>
                  {step}
                </div>
              )
            })}
          </div>
          <div className="mt-3 min-h-10 border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
            {progressText || (clientToken ? `Token: ${clientToken}` : 'Aguardando inicio da busca.')}
          </div>
        </aside>
      </div>

      <section className="border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Resultados</h2>
            <p className="text-xs text-slate-500">{candidates.length ? `${candidates.length} data(s) retornada(s)` : 'Nenhuma busca finalizada.'}</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-500">
                <th className="px-3 py-2">Data</th>
                <th className="px-3 py-2">Dia</th>
                <th className="px-3 py-2">Equipe</th>
                <th className="px-3 py-2">Frete</th>
                <th className="px-3 py-2">Tipo</th>
                <th className="px-3 py-2 text-right">Acao</th>
              </tr>
            </thead>
            <tbody>
              {candidates.map((candidate, index) => (
                <tr key={`${candidate.dateISO}-${candidate.team}-${index}`} className="border-b border-slate-100">
                  <td className="px-3 py-3 font-medium text-slate-900">{candidate.dateDM || candidate.date || candidate.dateISO}</td>
                  <td className="px-3 py-3 text-slate-600">{candidate.weekday || '-'}</td>
                  <td className="px-3 py-3 text-slate-600">{candidate.team}</td>
                  <td className="px-3 py-3 text-slate-600">{candidate.frete || '-'}</td>
                  <td className="px-3 py-3 text-slate-600">{candidate.tipo || 'normal'}</td>
                  <td className="px-3 py-3 text-right">
                    <Button type="button" size="sm" onClick={() => preAgendar(candidate, index)} disabled={schedulingIndex !== null}>
                      {schedulingIndex === index ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      Pre-agendar
                    </Button>
                  </td>
                </tr>
              ))}
              {!candidates.length && (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-sm text-slate-500">
                    Os resultados da busca aparecerao aqui.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
