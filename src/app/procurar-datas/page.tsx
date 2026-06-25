'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { CalendarCheck, Loader2, MapPin, Search, Send, TimerReset } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { calcularTempoServicoMinutos, formatarMinutosParaHHMM } from '@/lib/procurar-datas/tempo-servico'
import {
  normalizarLogradouro,
  normalizarBairro,
  normalizarCidade,
  normalizarNumero,
  normalizarUF,
  validarCamposEndereco,
  mensagemErroTempo,
} from '@/lib/procurar-datas/form-helpers'
import type { OpcoesProcurarDatasResponseSucesso, ValidarEnderecoRequest, ValidarEnderecoResponseSucesso, ValorInicialRequest, ValorInicialResponseSucesso, PesquisarDatasRequest, PesquisarDatasResponseSucesso, ProgressoPesquisaResponseSucesso, PreAgendarRequest, PreAgendarResponseSucesso } from '@/lib/procurar-datas/contratos'

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
  daysLeftTxt?: string
  encomenda?: string
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

type FormErrors = {
  logradouro?: string
  numero?: string
  bairro?: string
  cidade?: string
  uf?: string
  dataInicial?: string
  endereco?: string
  tempo?: string
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

function formatDatePlusDays(days: number) {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + days)
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function hhmmToMinutes(hhmm: string) {
  const m = String(hhmm || '').trim().match(/^(\d{1,2}):(\d{2})$/)
  if (!m) return 0
  return Number(m[1]) * 60 + Number(m[2])
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

function extractISODate(value?: string) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})/)
  return match ? { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) } : null
}

function formatDaysLeftFromToday(candidate: Candidate) {
  const parsed = extractISODate(candidate.date || candidate.dateISO)
  if (!parsed) return '-'

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const target = new Date(parsed.year, parsed.month - 1, parsed.day)
  target.setHours(0, 0, 0, 0)

  const diffDays = Math.round((target.getTime() - today.getTime()) / 86400000)
  return diffDays < 0 ? '-' : `${diffDays} d`
}

const SEARCH_UI_TIMEOUT_MS = 7 * 60 * 1000
const ENDPOINTS_PROCURAR_DATAS = {
  pesquisar: '/api/procurar-datas/v2/pesquisar-compat-async',
  progresso: '/api/procurar-datas/v2/progresso-compat',
} as const

function isNormalCandidate(candidate: Candidate) {
  return (candidate.tipo || 'normal') === 'normal'
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
  const [addressConfirmed, setAddressConfirmed] = useState(false)
  const [addressConfirmedResult, setAddressConfirmedResult] = useState<AddressResult | null>(null)
  const [searchPayload, setSearchPayload] = useState<SearchPayload | null>(null)
  const [phase, setPhase] = useState('Carregando opcoes')
  const [progressSnapshot, setProgressSnapshot] = useState<SearchProgress | null>(null)
  const [progressStatus, setProgressStatus] = useState<ProgressStatus>('idle')
  const [searchError, setSearchError] = useState('')
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [valorInicial, setValorInicial] = useState('')
  const [formErrors, setFormErrors] = useState<FormErrors>({})
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
  const serviceLocked = !addressConfirmed || addressConfirmedResult?.ok !== true
  const formLocked = serviceLocked || searching
  const tempoMinutes = hhmmToMinutes(tempoNecessario)
  const tempoTooLong = tempoMinutes > 390
  const progressDone = progressStatus === 'done'

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
        const data = (await readJson(response)) as OpcoesProcurarDatasResponseSucesso
        if (!active) return
        setOpcoes(data.opcoes || {})
        setTempoMapLoaded(true)
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
    const hasSelection = form.tipoBerco || form.comoda || form.roupeiro || form.poltrona || form.painel
    if (!hasSelection) {
      setTempoNecessario('')
      return
    }

    const minutosBase = calcularTempoServicoMinutos({
      berco: form.tipoBerco,
      comoda: form.comoda,
      roupeiro: form.roupeiro,
      poltrona: form.poltrona,
      painel: form.painel,
    })
    if (minutosBase <= 0) {
      setTempoNecessario('')
      return
    }
    const minutos = minutosBase + (form.isCondominio ? 10 : 0)
    setCalculatingTime(false)
    setTempoNecessario(formatarMinutosParaHHMM(minutos))
    setPhase('Pronto para buscar datas')
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
        const body: ValorInicialRequest = {
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
        }
        const response = await fetch('/api/procurar-datas/valor-inicial', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        const data = (await readJson(response)) as ValorInicialResponseSucesso
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

  function normalizeValue<K extends keyof FormState>(key: K, value: FormState[K]): FormState[K] {
    if (typeof value !== 'string') return value
    switch (key) {
      case 'logradouro':
        return normalizarLogradouro(value) as FormState[K]
      case 'bairro':
        return normalizarBairro(value) as FormState[K]
      case 'cidade':
        return normalizarCidade(value) as FormState[K]
      case 'numero':
        return normalizarNumero(value) as FormState[K]
      case 'uf':
        return normalizarUF(value) as FormState[K]
      default:
        return value
    }
  }

  function updateForm<K extends keyof FormState>(key: K, value: FormState[K]) {
    const nextValue = normalizeValue(key, value)
    setForm((current) => ({ ...current, [key]: nextValue }))
    setFormErrors((current) => {
      const next = { ...current }
      delete next[key as keyof FormErrors]
      if (['logradouro', 'numero', 'bairro', 'cidade', 'uf'].includes(String(key))) {
        delete next.endereco
      }
      return next
    })
    if (['logradouro', 'numero', 'bairro', 'cidade', 'uf'].includes(String(key))) {
      setAddressResult(null)
      setAddressConfirmed(false)
      setAddressConfirmedResult(null)
      setSearchPayload(null)
      setValorInicial('')
      setProgressStatus('idle')
      setProgressSnapshot(null)
      setSearchError('')
      setElapsedSeconds(0)
      setPhase('Endereco alterado')
      stopPolling()
      stopTimer()
    }
  }

  async function validarEndereco() {
    const { ok, errors } = validarCamposEndereco(form)
    if (!ok) {
      setFormErrors((current) => ({ ...current, ...errors }))
      toast.error('Preencha os campos obrigatorios do endereco.')
      return
    }

    setValidatingAddress(true)
    setPhase('Validando endereco')
    setSearchPayload(null)
    setAddressConfirmed(false)
    setAddressConfirmedResult(null)
    setValorInicial('')
    setFormErrors((current) => {
      const next = { ...current }
      delete next.logradouro
      delete next.numero
      delete next.bairro
      delete next.cidade
      delete next.uf
      return next
    })

    try {
      const body: ValidarEnderecoRequest = form
      const response = await fetch('/api/procurar-datas/validar-endereco', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = (await readJson(response)) as ValidarEnderecoResponseSucesso
      const resultado = data.resultado as AddressResult

      if (!resultado?.ok || !resultado.lat || !resultado.lng) {
        setAddressResult(null)
        setPhase('Endereco nao localizado')
        toast.error('Nao foi possivel localizar este endereco com precisao segura.')
        return
      }

      setAddressResult(resultado)
      setAddressConfirmed(false)
      setAddressConfirmedResult(null)
      setPhase('Endereco validado')
      toast.success('Endereco validado. Confirme o local para continuar.')
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

  function startPolling(token: string, endpointProgresso: string) {
    if (pollRef.current) clearInterval(pollRef.current)

    const poll = async () => {
      if (activeSearchTokenRef.current !== token) return
      if (searchStartedAtRef.current && Date.now() - searchStartedAtRef.current > SEARCH_UI_TIMEOUT_MS) {
        finalizarBuscaComErro('A busca está demorando mais que o normal. A tela parou de acompanhar, mas o processamento pode continuar em segundo plano. Tente novamente em alguns instantes.')
        return
      }
      try {
        const response = await fetch(`${endpointProgresso}?clientToken=${encodeURIComponent(token)}`)
        const data = (await readJson(response)) as ProgressoPesquisaResponseSucesso
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
    pollRef.current = setInterval(poll, 5000)
  }

  function stopPolling() {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }

  function confirmarEndereco() {
    if (!addressResult?.ok || !addressResult.lat || !addressResult.lng) {
      toast.error('Valide o endereco antes de confirmar.')
      return
    }
    setAddressConfirmed(true)
    setAddressConfirmedResult(addressResult)
    setPhase('Local confirmado')
    toast.success('Local confirmado.')
    const dataInput = document.getElementById('dataInicial') as HTMLInputElement | null
    if (dataInput) dataInput.focus()
  }

  async function pesquisarDatas() {
    const nextErrors: FormErrors = {}
    if (!addressConfirmed || !addressConfirmedResult?.ok || !addressConfirmedResult.lat || !addressConfirmedResult.lng) {
      nextErrors.endereco = 'Valide e confirme o endereco antes de pesquisar.'
    }
    if (!form.dataInicial) {
      nextErrors.dataInicial = 'Informe a data inicial.'
    }
    const tempoError = mensagemErroTempo(tempoNecessario, tempoTooLong)
    if (tempoError) {
      nextErrors.tempo = tempoError
    }
    if (Object.keys(nextErrors).length > 0) {
      setFormErrors((current) => ({ ...current, ...nextErrors }))
      toast.error('Preencha os dados obrigatorios antes de pesquisar.')
      return
    }

    const confirmed = addressConfirmedResult
    if (!confirmed || !confirmed.lat || !confirmed.lng) {
      setFormErrors((current) => ({ ...current, endereco: 'Valide e confirme o endereco antes de pesquisar.' }))
      toast.error('Valide e confirme o endereco antes de pesquisar.')
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
      const endpoints = ENDPOINTS_PROCURAR_DATAS
      const body: PesquisarDatasRequest = {
        ...form,
        clientToken: token,
        tempoNecessario,
        cep: confirmed.cep || '',
        lat: confirmed.lat,
        lng: confirmed.lng,
        destLat: confirmed.lat,
        destLng: confirmed.lng,
        destDisplay: confirmed.enderecoCompleto || confirmed.display || confirmed.display_name || '',
        destProvider: confirmed.provider || '',
        enderecoCompleto: confirmed.enderecoCompleto || confirmed.display || confirmed.display_name || '',
        monthYear: form.dataInicial,
      }

      const response = await fetch(endpoints.pesquisar, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = (await readJson(response)) as PesquisarDatasResponseSucesso
      if (activeSearchTokenRef.current !== token) return
      const startedToken = data.clientToken || token
      activeSearchTokenRef.current = startedToken
      setProgressStatus('queued')
      setPhase('Buscando datas')
      startPolling(startedToken, endpoints.progresso)
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
    setPhase(addressConfirmedResult?.ok ? 'Pronto para buscar datas' : 'Pronto para validar endereco')
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
      const body: PreAgendarRequest = {
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
      }
      const response = await fetch('/api/procurar-datas/pre-agendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = (await readJson(response)) as PreAgendarResponseSucesso
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
        <table className="w-full min-w-[900px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-500">
              <th className="px-3 py-2">Data</th>
              <th className="px-3 py-2">Dia</th>
              <th className="px-3 py-2">Faltam</th>
              <th className="px-3 py-2">Equipe</th>
              <th className="px-3 py-2">Frete</th>
              <th className="px-3 py-2">Tipo</th>
              <th className="px-3 py-2">Encomenda</th>
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
                  <td className="px-3 py-3 text-slate-600">{formatDaysLeftFromToday(candidate)}</td>
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
                  <td className="px-3 py-3 text-slate-600">{candidate.encomenda || '-'}</td>
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
                <td colSpan={8} className="px-3 py-8 text-center text-sm text-slate-500">
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
        <p className="text-sm text-slate-500">Fluxo operacional para pesquisa de datas disponiveis.</p>
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

          <div className="mb-4 rounded-md border border-amber-300 bg-amber-50 p-3 text-xs font-bold text-amber-900">
            <p>AVISO: SE FOR ENCOMENDA, UTILIZAR 42 DIAS OU MAIS ({formatDatePlusDays(42)}).</p>
            <p className="mt-1">AVISO: SE FOR VENDE SHOWROOM FALAR COM PÓS VENDA DATA PRA DESMONTAR E MONTAR.</p>
          </div>

          <div className="grid gap-3 md:grid-cols-6">
            <label className="md:col-span-3">
              <span className="mb-1 block text-xs font-medium text-slate-600">Logradouro</span>
              <Input
                disabled={searching}
                value={form.logradouro}
                onChange={(e) => updateForm('logradouro', e.target.value)}
                className={formErrors.logradouro ? 'border-red-500 focus:border-red-500' : ''}
              />
              {formErrors.logradouro && <span className="mt-1 block text-xs text-red-600">{formErrors.logradouro}</span>}
            </label>
            <label>
              <span className="mb-1 block text-xs font-medium text-slate-600">Numero</span>
              <Input
                disabled={searching}
                value={form.numero}
                onChange={(e) => updateForm('numero', e.target.value)}
                placeholder="Apenas numeros"
              />
              {formErrors.numero && <span className="mt-1 block text-xs text-red-600">{formErrors.numero}</span>}
            </label>
            <label className="md:col-span-2">
              <span className="mb-1 block text-xs font-medium text-slate-600">Bairro</span>
              <Input
                disabled={searching}
                value={form.bairro}
                onChange={(e) => updateForm('bairro', e.target.value)}
                className={formErrors.bairro ? 'border-red-500 focus:border-red-500' : ''}
              />
              {formErrors.bairro && <span className="mt-1 block text-xs text-red-600">{formErrors.bairro}</span>}
            </label>
            <label className="md:col-span-3">
              <span className="mb-1 block text-xs font-medium text-slate-600">Cidade</span>
              <Input
                disabled={searching}
                value={form.cidade}
                onChange={(e) => updateForm('cidade', e.target.value)}
                className={formErrors.cidade ? 'border-red-500 focus:border-red-500' : ''}
              />
              {formErrors.cidade && <span className="mt-1 block text-xs text-red-600">{formErrors.cidade}</span>}
            </label>
            <label>
              <span className="mb-1 block text-xs font-medium text-slate-600">UF</span>
              <Input
                disabled={searching}
                maxLength={2}
                value={form.uf}
                onChange={(e) => updateForm('uf', e.target.value)}
                className={formErrors.uf ? 'border-red-500 focus:border-red-500' : ''}
              />
              {formErrors.uf && <span className="mt-1 block text-xs text-red-600">{formErrors.uf}</span>}
            </label>
            <div className="md:col-span-2 flex items-end">
              <Button type="button" variant="outline" onClick={validarEndereco} disabled={validatingAddress || searching} className="w-full">
                {validatingAddress ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
                Validar endereco
              </Button>
            </div>
          </div>

          {formErrors.endereco && !addressResult?.ok && (
            <div className="mt-3 text-xs font-semibold text-red-600">{formErrors.endereco}</div>
          )}

          {addressResult?.ok && (
            <div className="mt-4 rounded-lg border border-sky-100 bg-sky-50 p-4 text-sm text-slate-700">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="font-medium text-slate-900">{addressResult.enderecoCompleto || addressResult.display || 'Endereco validado'}</div>
                  <div className="mt-1 text-xs text-slate-500">
                    Lat {Number(addressResult.lat).toFixed(5)}, Lng {Number(addressResult.lng).toFixed(5)}
                    {addressResult.provider ? ` | ${addressResult.provider}` : ''}
                  </div>
                  {addressConfirmed && addressConfirmedResult?.ok && (
                    <div className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
                      <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
                      Local confirmado
                    </div>
                  )}
                </div>
                {!addressConfirmed && (
                  <Button type="button" size="sm" onClick={confirmarEndereco} disabled={validatingAddress || searching}>
                    Confirmar este local
                  </Button>
                )}
              </div>
            </div>
          )}

          {serviceLocked && (
            <div className="mt-4 rounded-lg border border-dashed border-sky-200 bg-sky-50/70 p-4 text-sm text-sky-800">
              Valide e confirme o endereco para liberar data inicial, valor inicial, opcoes de servico e pesquisa de datas.
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
                id="dataInicial"
                type="date"
                min={minDate}
                max={maxDate}
                value={form.dataInicial}
                onChange={(e) => {
                  updateForm('dataInicial', e.target.value)
                  setFormErrors((current) => {
                    const next = { ...current }
                    delete next.dataInicial
                    return next
                  })
                }}
                className={formErrors.dataInicial ? 'border-red-500 focus:border-red-500' : ''}
              />
              {formErrors.dataInicial && <span className="mt-1 block text-xs text-red-600">{formErrors.dataInicial}</span>}
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
                {formErrors.tempo && (
                  <div className="mt-2 text-xs font-semibold text-red-700">{formErrors.tempo}</div>
                )}
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
              disabled={searching || validatingAddress || calculatingTime}
            >
              {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              {searching ? 'Pesquisando...' : 'Pesquisar datas'}
            </Button>
          </div>
          </fieldset>
        </section>
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Resultados</h2>
            <p className="text-xs text-slate-500">
              {candidates.length
                ? `${normalCandidates.length} recomendada(s) e ${extraCandidates.length} outra(s) opcoes`
                : 'Nenhuma busca finalizada.'}
            </p>
            {(searching || progressDone || searchError) && (
              <p className={`mt-1 text-xs ${searchError ? 'text-red-700' : progressDone ? 'text-emerald-700' : 'text-slate-500'}`}>
                {searchError
                  ? searchError
                  : progressDone
                    ? `Pesquisa concluida em ${formatElapsed(elapsedSeconds)}`
                    : `Tempo total da pesquisa: ${formatElapsed(elapsedSeconds)}`}
              </p>
            )}
          </div>
          <div className="flex gap-2">
            {(searching || progressStatus === 'error') && (
              <Button type="button" variant="outline" size="sm" onClick={editarFiltros}>
                Editar filtros
              </Button>
            )}
            {progressDone && (
              <Button type="button" variant="outline" size="sm" onClick={novaBusca}>
                Nova busca
              </Button>
            )}
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
