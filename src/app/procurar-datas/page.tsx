'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { CalendarCheck, Loader2, MapPin, Search, Send, TimerReset } from 'lucide-react'
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
  avisoHoraMarcada?: string
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

type ProgressStatus = 'idle' | 'queued' | 'running' | 'done' | 'error'

type SearchProgress = {
  status?: ProgressStatus | string
  normais?: Candidate[]
  extras?: Candidate[]
  payload?: SearchPayload
  error?: string
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

function getTipoLabel(tipo?: string) {
  switch (tipo) {
    case 'especial':
      return 'Especial'
    case 'premium':
      return 'Premium'
    case 'hora-marcada':
    case 'hora marcada':
      return 'Hora marcada'
    case 'normal':
    default:
      return 'Normal'
  }
}

function getTipoBadgeClass(tipo?: string) {
  switch (tipo) {
    case 'especial':
      return 'border-violet-200 bg-violet-50 text-violet-700'
    case 'premium':
      return 'border-amber-200 bg-amber-50 text-amber-700'
    case 'hora-marcada':
    case 'hora marcada':
      return 'border-orange-200 bg-orange-50 text-orange-700'
    case 'normal':
    default:
      return 'border-emerald-200 bg-emerald-50 text-emerald-700'
  }
}

function formatElapsed(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, '0')
  const seconds = (totalSeconds % 60).toString().padStart(2, '0')
  return `${minutes}:${seconds}`
}

const SEARCH_UI_TIMEOUT_MS = 10 * 60 * 1000

function isNormalCandidate(candidate: Candidate) {
  return (candidate.tipo || 'normal') === 'normal'
}

function isHoraMarcadaCandidate(candidate: Candidate) {
  const tipo = String(candidate.tipo || '').toLowerCase()
  return tipo === 'hora-marcada' || tipo === 'hora marcada'
}

function optionStatus(found: boolean, done: boolean) {
  if (found) return 'encontrado'
  return done ? 'nao encontrado' : 'aguardando'
}

function progressStepClass(state: 'done' | 'active' | 'pending' | 'error') {
  if (state === 'done') return 'border-emerald-200 bg-emerald-50 text-emerald-800'
  if (state === 'active') return 'border-sky-200 bg-sky-50 text-sky-800'
  if (state === 'error') return 'border-red-200 bg-red-50 text-red-800'
  return 'border-slate-200 bg-slate-50 text-slate-500'
}

function progressStepMark(state: 'done' | 'active' | 'pending' | 'error') {
  if (state === 'done') return '[OK]'
  if (state === 'active') return '[~]'
  if (state === 'error') return '[!]'
  return '[ ]'
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
  const [phase, setPhase] = useState('Carregando opcoes')
  const [progressSnapshot, setProgressSnapshot] = useState<SearchProgress | null>(null)
  const [progressStatus, setProgressStatus] = useState<ProgressStatus>('idle')
  const [searchError, setSearchError] = useState('')
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [valorInicial, setValorInicial] = useState('')
  const [loadingOptions, setLoadingOptions] = useState(true)
  const [validatingAddress, setValidatingAddress] = useState(false)
  const [calculatingTime, setCalculatingTime] = useState(false)
  const [calculatingValorInicial, setCalculatingValorInicial] = useState(false)
  const [searching, setSearching] = useState(false)
  const [schedulingIndex, setSchedulingIndex] = useState<number | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const activeSearchTokenRef = useRef('')
  const searchStartedAtRef = useRef(0)

  const minDate = useMemo(() => isoDatePlus(form.isEncomenda ? 42 : 2), [form.isEncomenda])
  const maxDate = useMemo(() => isoDatePlus(90), [])
  const candidates = searchPayload?.candidates || []
  const normalCandidates = candidates.filter(isNormalCandidate).slice(0, 3)
  const extraCandidates = candidates.filter((candidate) => !isNormalCandidate(candidate))
  const progressPayloadCandidates = progressSnapshot?.payload?.candidates || []
  const progressSourceCandidates = progressPayloadCandidates.length
    ? progressPayloadCandidates
    : [...(progressSnapshot?.normais || []), ...(progressSnapshot?.extras || [])]
  const progressNormalCount = Math.min(progressSourceCandidates.filter(isNormalCandidate).length, 3)
  const progressEspecialFound = progressSourceCandidates.some((candidate) => candidate.tipo === 'especial')
  const progressPremiumFound = progressSourceCandidates.some((candidate) => candidate.tipo === 'premium')
  const progressHoraMarcadaFound = progressSourceCandidates.some(isHoraMarcadaCandidate)
  const serviceLocked = !addressResult?.ok
  const formLocked = serviceLocked || searching
  const showProgressBlock = progressStatus !== 'idle' || searching || !!searchError
  const progressDone = progressStatus === 'done'
  const progressError = progressStatus === 'error'
  const progressSteps = [
    {
      label: 'Endereco validado',
      detail: addressResult?.ok ? 'Confirmado' : 'Pendente',
      state: addressResult?.ok ? 'done' : progressError ? 'error' : 'pending',
    },
    {
      label: 'Tempo calculado',
      detail: tempoNecessario && tempoNecessario !== '<--- PREENCHA' ? tempoNecessario : 'Pendente',
      state: tempoNecessario && tempoNecessario !== '<--- PREENCHA' ? 'done' : progressError ? 'error' : 'pending',
    },
    {
      label: 'Buscando datas',
      detail: `${progressNormalCount}/3 normais encontrados`,
      state: progressError ? 'error' : progressDone || progressNormalCount >= 3 ? 'done' : searching ? 'active' : 'pending',
    },
    {
      label: 'Outras opcoes',
      detail: `Especial: ${optionStatus(progressEspecialFound, progressDone)} | Premium: ${optionStatus(progressPremiumFound, progressDone)} | Hora marcada: ${optionStatus(progressHoraMarcadaFound, progressDone)}`,
      state: progressError
        ? 'error'
        : progressDone
          ? 'done'
          : progressNormalCount >= 3
            ? 'active'
            : 'pending',
    },
    {
      label: 'Finalizando resultados',
      detail: progressDone ? 'Pesquisa concluida' : 'Aguardando resultado final',
      state: progressError ? 'error' : progressDone ? 'done' : progressNormalCount >= 3 && searching ? 'active' : 'pending',
    },
  ] as const

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
    if (!addressResult?.ok) {
      setTempoNecessario('')
      return
    }
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
    if (!addressResult?.ok || !addressResult.lat || !addressResult.lng) {
      setValorInicial('')
      return
    }

    let active = true
    const timeout = setTimeout(async () => {
      setCalculatingValorInicial(true)
      try {
        const response = await fetch('/api/procurar-datas/valor-inicial', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            cep: addressResult.cep || '',
            lat: addressResult.lat,
            lng: addressResult.lng,
            destLat: addressResult.lat,
            destLng: addressResult.lng,
            destDisplay: addressResult.enderecoCompleto || addressResult.display || addressResult.display_name || '',
            destProvider: addressResult.provider || '',
            enderecoCompleto: addressResult.enderecoCompleto || addressResult.display || addressResult.display_name || '',
            isRural: form.isRural,
            isCondominio: form.isCondominio,
          }),
        })
        const data = await readJson(response)
        const resultado = data.resultado || {}
        if (active) setValorInicial(resultado.valorFormatado || resultado.valorFmt || '')
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Erro ao calcular valor inicial.'
        if (active) {
          setValorInicial('')
          toast.error(message)
        }
      } finally {
        if (active) setCalculatingValorInicial(false)
      }
    }, 300)

    return () => {
      active = false
      clearTimeout(timeout)
    }
  }, [addressResult, form.isRural, form.isCondominio])

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  function updateForm<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }))
    if (['logradouro', 'numero', 'bairro', 'cidade', 'uf'].includes(String(key))) {
      setAddressResult(null)
      setSearchPayload(null)
      setValorInicial('')
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
      setPhase('Endereco validado')
      toast.success('Endereco validado.')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao validar endereco.'
      toast.error(message)
      setPhase('Erro ao validar endereco')
    } finally {
      setValidatingAddress(false)
    }
  }

  function startTimer() {
    if (timerRef.current) clearInterval(timerRef.current)
    setElapsedSeconds(0)
    timerRef.current = setInterval(() => {
      setElapsedSeconds((current) => current + 1)
    }, 1000)
  }

  function stopTimer() {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }

  function finalizarBuscaComErro(message: string) {
    activeSearchTokenRef.current = ''
    setSearchError(message)
    setProgressStatus('error')
    setPhase('Erro ao pesquisar datas')
    setSearching(false)
    stopPolling()
    stopTimer()
  }

  function startPolling(token: string) {
    if (pollRef.current) clearInterval(pollRef.current)

    const poll = async () => {
      if (activeSearchTokenRef.current !== token) return
      if (searchStartedAtRef.current && Date.now() - searchStartedAtRef.current > SEARCH_UI_TIMEOUT_MS) {
        finalizarBuscaComErro('A busca demorou demais e foi interrompida na tela. Tente novamente ou ajuste os filtros.')
        return
      }
      try {
        const response = await fetch(`/api/procurar-datas/progresso?clientToken=${encodeURIComponent(token)}`)
        const data = await readJson(response)
        const progress = (data.progress || {}) as SearchProgress
        const status = (progress.status || 'waiting') as ProgressStatus | string

        if (activeSearchTokenRef.current !== token) return
        setProgressSnapshot(progress)

        if (status) {
          if (status === 'queued' || status === 'running' || status === 'done' || status === 'error') {
            setProgressStatus(status)
          }
        }

        if (status === 'done') {
          const rootCandidates = (progress as SearchProgress & { candidates?: Candidate[] }).candidates
          const payload = progress.payload || (Array.isArray(rootCandidates) ? { candidates: rootCandidates } : null)
          if (!payload || !Array.isArray(payload.candidates) || payload.candidates.length === 0) {
            finalizarBuscaComErro('A busca terminou, mas nao retornou resultados validos. Verifique logs pelo token.')
            return
          }
          setSearchPayload(payload)
          setPhase('Resultados finalizados')
          setSearching(false)
          stopPolling()
          stopTimer()
          toast.success('Busca concluida.')
        }

        if (status === 'error') {
          finalizarBuscaComErro(progress.error || 'Erro ao pesquisar datas.')
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Erro no polling.'
        if (activeSearchTokenRef.current === token) {
          finalizarBuscaComErro(message)
        }
      }
    }

    void poll()
    pollRef.current = setInterval(poll, 3000)
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
    stopPolling()
    stopTimer()
    activeSearchTokenRef.current = token
    searchStartedAtRef.current = Date.now()
    setSearching(true)
    setSearchPayload(null)
    setProgressSnapshot(null)
    setSearchError('')
    setProgressStatus('queued')
    setPhase('Iniciando pesquisa')
    startTimer()

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
      if (activeSearchTokenRef.current !== token) return
      const startedToken = data.clientToken || token
      activeSearchTokenRef.current = startedToken
      setProgressStatus('queued')
      setPhase('Buscando datas')
      startPolling(startedToken)
    } catch (error) {
      if (activeSearchTokenRef.current !== token) return
      const message = error instanceof Error ? error.message : 'Erro ao pesquisar datas.'
      finalizarBuscaComErro(message)
      toast.error(message)
    }
  }

  function editarFiltros() {
    activeSearchTokenRef.current = ''
    searchStartedAtRef.current = 0
    setSearching(false)
    setProgressStatus('idle')
    setProgressSnapshot(null)
    setSearchError('')
    setElapsedSeconds(0)
    setPhase(addressResult?.ok ? 'Pronto para buscar datas' : 'Pronto para validar endereco')
    stopPolling()
    stopTimer()
  }

  function novaBusca() {
    editarFiltros()
    setSearchPayload(null)
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

  function renderCandidatesTable(data: Candidate[], emptyText: string, indexOffset = 0) {
    return (
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
            {data.map((candidate, index) => {
              const actionIndex = indexOffset + index
              return (
                <tr key={`${candidate.dateISO}-${candidate.team}-${candidate.tipo || 'normal'}-${index}`} className="border-b border-slate-100">
                  <td className="px-3 py-3 font-medium text-slate-900">{candidate.dateDM || candidate.date || candidate.dateISO}</td>
                  <td className="px-3 py-3 text-slate-600">{candidate.weekday || '-'}</td>
                  <td className="px-3 py-3 text-slate-600">{candidate.team}</td>
                  <td className="px-3 py-3 text-slate-600">{candidate.frete || '-'}</td>
                  <td className="px-3 py-3 text-slate-600">
                    <span className={`inline-flex items-center border px-2 py-0.5 text-xs font-medium ${getTipoBadgeClass(candidate.tipo)}`}>
                      {getTipoLabel(candidate.tipo)}
                    </span>
                    {candidate.avisoHoraMarcada && (
                      <div className="mt-1 text-xs text-orange-700">{candidate.avisoHoraMarcada}</div>
                    )}
                  </td>
                  <td className="px-3 py-3 text-right">
                    <Button type="button" size="sm" onClick={() => preAgendar(candidate, actionIndex)} disabled={schedulingIndex !== null}>
                      {schedulingIndex === actionIndex ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      Pre-agendar
                    </Button>
                  </td>
                </tr>
              )
            })}
            {!data.length && (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-sm text-slate-500">
                  {emptyText}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    )
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

      <div className="space-y-4">
        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
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
              <Input disabled={searching} value={form.logradouro} onChange={(e) => updateForm('logradouro', e.target.value)} />
            </label>
            <label>
              <span className="mb-1 block text-xs font-medium text-slate-600">Numero</span>
              <Input disabled={searching} value={form.numero} onChange={(e) => updateForm('numero', e.target.value)} />
            </label>
            <label className="md:col-span-2">
              <span className="mb-1 block text-xs font-medium text-slate-600">Bairro</span>
              <Input disabled={searching} value={form.bairro} onChange={(e) => updateForm('bairro', e.target.value)} />
            </label>
            <label className="md:col-span-3">
              <span className="mb-1 block text-xs font-medium text-slate-600">Cidade</span>
              <Input disabled={searching} value={form.cidade} onChange={(e) => updateForm('cidade', e.target.value)} />
            </label>
            <label>
              <span className="mb-1 block text-xs font-medium text-slate-600">UF</span>
              <Input disabled={searching} maxLength={2} value={form.uf} onChange={(e) => updateForm('uf', e.target.value.toUpperCase())} />
            </label>
            <div className="md:col-span-2 flex items-end">
              <Button type="button" variant="outline" onClick={validarEndereco} disabled={validatingAddress || loadingOptions || searching} className="w-full">
                {validatingAddress ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
                Validar endereco
              </Button>
            </div>
          </div>

          {addressResult?.ok && (
            <div className="mt-4 rounded-lg border border-sky-100 bg-sky-50 p-4 text-sm text-slate-700">
              <div className="font-medium text-slate-900">{addressResult.enderecoCompleto || addressResult.display || 'Endereco validado'}</div>
              <div className="mt-1 text-xs text-slate-500">
                Lat {Number(addressResult.lat).toFixed(5)}, Lng {Number(addressResult.lng).toFixed(5)}
                {addressResult.provider ? ` | ${addressResult.provider}` : ''}
              </div>
            </div>
          )}

          {serviceLocked && (
            <div className="mt-4 rounded-lg border border-dashed border-sky-200 bg-sky-50/70 p-4 text-sm text-sky-800">
              Valide o endereco para liberar data inicial, valor inicial, opcoes de servico e pesquisa de datas.
            </div>
          )}

          <fieldset
            disabled={formLocked || validatingAddress}
            aria-disabled={formLocked || validatingAddress}
            className={`mt-5 rounded-lg border border-slate-200 p-4 transition ${formLocked ? 'bg-slate-50 opacity-60' : 'bg-white'}`}
          >
          <div className="grid gap-3 md:grid-cols-6">
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

          <div className="mt-5 flex flex-col gap-3 border-t border-slate-200 pt-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="grid flex-1 gap-3 sm:grid-cols-2">
              <div>
                <span className="mb-1 block text-xs font-medium text-slate-600">Tempo necessario</span>
                <div className="flex h-10 items-center gap-2 border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700">
                  <TimerReset className="h-4 w-4 text-[#00A5E6]" />
                  <strong className="text-slate-900">{calculatingTime ? 'calculando...' : tempoNecessario || '-'}</strong>
                </div>
              </div>
              <div>
                <span className="mb-1 block text-xs font-medium text-slate-600">Valor inicial (minimo)</span>
                <Input
                  readOnly
                  tabIndex={-1}
                  aria-readonly="true"
                  value={calculatingValorInicial ? 'Calculando...' : valorInicial}
                  placeholder="-"
                  className="bg-slate-50 font-semibold text-slate-700"
                />
                <div className="mt-1 text-xs text-slate-500">Estimativa minima para dia de semana. Pode variar conforme data/equipe.</div>
              </div>
            </div>
            <Button
              type="button"
              onClick={pesquisarDatas}
              disabled={searching || validatingAddress || calculatingTime || !addressResult?.ok || !tempoNecessario || tempoNecessario === '<--- PREENCHA'}
            >
              {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              {searching ? 'Pesquisando...' : 'Pesquisar datas'}
            </Button>
          </div>
          </fieldset>
        </section>
      </div>

      {showProgressBlock && (
        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Progresso da pesquisa</h2>
              <p className="text-xs text-slate-500">Tempo total: {formatElapsed(elapsedSeconds)}</p>
            </div>
            <div className="flex gap-2">
              {(searching || progressStatus === 'error') && (
                <Button type="button" variant="outline" size="sm" onClick={editarFiltros}>
                  Editar filtros
                </Button>
              )}
              {progressStatus === 'done' && (
                <Button type="button" variant="outline" size="sm" onClick={novaBusca}>
                  Nova busca
                </Button>
              )}
            </div>
          </div>

          <div className="mt-4 grid gap-2 md:grid-cols-5">
            {progressSteps.map((step) => (
              <div
                key={step.label}
                className={`min-h-24 border px-3 py-2 text-sm ${progressStepClass(step.state)}`}
              >
                <div className="flex items-center gap-2 font-semibold">
                  <span>{progressStepMark(step.state)}</span>
                  <span>{step.label}</span>
                </div>
                <div className="mt-2 text-xs leading-relaxed opacity-80">{step.detail}</div>
                {step.state === 'active' && (
                  <Loader2 className="mt-2 h-4 w-4 animate-spin" />
                )}
              </div>
            ))}
          </div>

          <div className="mt-3 rounded border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
            {searchError ? (
              <div className="text-red-700">{searchError}</div>
            ) : progressDone ? (
              <div className="text-emerald-700">Pesquisa concluida.</div>
            ) : (
              <div className="text-slate-600">
                A pesquisa esta em andamento. Os resultados aparecerao automaticamente quando a busca terminar.
              </div>
            )}
          </div>
        </section>
      )}

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Resultados</h2>
            <p className="text-xs text-slate-500">
              {candidates.length
                ? `${normalCandidates.length} recomendada(s) e ${extraCandidates.length} outra(s) opcoes`
                : 'Nenhuma busca finalizada.'}
            </p>
          </div>
        </div>

        <div className="space-y-5">
          <div>
            <div className="mb-2 flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-slate-900">Datas recomendadas</h3>
              <span className="text-xs text-slate-500">Ate 3 normais</span>
            </div>
            {renderCandidatesTable(normalCandidates, 'As datas recomendadas aparecerao aqui.')}
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-slate-900">Outras opcoes</h3>
              <span className="text-xs text-slate-500">Especial, premium e hora marcada</span>
            </div>
            {renderCandidatesTable(extraCandidates, 'Nenhuma outra opcao retornada.', normalCandidates.length)}
          </div>
        </div>
      </section>
    </div>
  )
}
