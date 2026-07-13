'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { CalendarCheck, CheckCircle2, Edit, Loader2, Search, Send, TimerReset, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { calcularTempoServicoMinutos, formatarMinutosParaHHMM } from '@/lib/procurar-datas/tempo-servico'
import { formatarDataBrasileira } from '@/lib/procurar-datas/formatar-apresentacao'
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
import { compararEnderecoCEPComGeocodificacao, type ResultadoComparacaoEndereco } from '@/lib/procurar-datas/comparar-endereco'

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
  clientToken?: string
  runId?: string
}

type EstadoCep = 'aguardando_input' | 'consultando' | 'encontrado' | 'nao_encontrado' | 'confirmado'

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

type AddressValidationError = {
  status?: number
  title: string
  description: string
  message: string
}

type ProcurarDatasHttpError = Error & {
  status?: number
  payload?: unknown
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
    const error = new Error(data?.error || 'Erro ao processar solicitacao.') as ProcurarDatasHttpError
    error.status = response.status
    error.payload = data
    throw error
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
  const [valorInicialNumerico, setValorInicialNumerico] = useState<number | null>(null)
  const [addressValidationError, setAddressValidationError] = useState<AddressValidationError | null>(null)
  const [addressValidationReviewMode, setAddressValidationReviewMode] = useState(false)
  const [formErrors, setFormErrors] = useState<FormErrors>({})
  const [loadingOptions, setLoadingOptions] = useState(true)
  const [cepInput, setCepInput] = useState('')
  const [estadoCep, setEstadoCep] = useState<EstadoCep>('aguardando_input')
  const [loadingCep, setLoadingCep] = useState(false)
  const [validatingAddress, setValidatingAddress] = useState(false)
  const [cepSemLogradouro, setCepSemLogradouro] = useState(false)
  const [cepSemBairro, setCepSemBairro] = useState(false)
  const [calculatingTime, setCalculatingTime] = useState(false)
  const [calculatingValorInicial, setCalculatingValorInicial] = useState(false)
  const [searching, setSearching] = useState(false)
  const [schedulingIndex, setSchedulingIndex] = useState<number | null>(null)
  const [pesquisaAuditoriaId, setPesquisaAuditoriaId] = useState<string | null>(null)
  const [addressDivergencia, setAddressDivergencia] = useState<ResultadoComparacaoEndereco | null>(null)
  const cepInputRef = useRef<HTMLInputElement | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const activeSearchTokenRef = useRef('')
  const searchStartedAtRef = useRef(0)
  const currentRunIdRef = useRef<string | null>(null)

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
  const addressRevisionUnlocked = !!addressValidationError || addressValidationReviewMode

  const cepBloqueado =
    searching ||
    loadingCep ||
    (!addressRevisionUnlocked && (estadoCep === 'encontrado' || estadoCep === 'confirmado'))
  const numeroBloqueado = searching || loadingCep || (!addressRevisionUnlocked && estadoCep === 'confirmado')
  const logradouroBloqueado =
    searching ||
    estadoCep === 'aguardando_input' ||
    estadoCep === 'consultando' ||
    estadoCep === 'nao_encontrado' ||
    (estadoCep === 'encontrado' && !cepSemLogradouro) ||
    (estadoCep === 'confirmado' && !addressRevisionUnlocked) ||
    (estadoCep === 'confirmado' && addressRevisionUnlocked && !cepSemLogradouro)
  const bairroBloqueado =
    searching ||
    estadoCep === 'aguardando_input' ||
    estadoCep === 'consultando' ||
    estadoCep === 'nao_encontrado' ||
    (estadoCep === 'encontrado' && !cepSemBairro) ||
    (estadoCep === 'confirmado' && !addressRevisionUnlocked) ||
    (estadoCep === 'confirmado' && addressRevisionUnlocked && !cepSemBairro)
  const cidadeUfBloqueado =
    searching ||
    estadoCep === 'aguardando_input' ||
    estadoCep === 'consultando' ||
    estadoCep === 'nao_encontrado' ||
    estadoCep === 'encontrado' ||
    estadoCep === 'confirmado'

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
      setValorInicialNumerico(null)
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
        if (active) {
          setValorInicial(resultado.valorFormatado || resultado.valorFmt || '')
          setValorInicialNumerico(typeof resultado.valor === 'number' ? resultado.valor : null)
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Erro ao calcular valor inicial.'
        if (active) {
          setValorInicial('')
          setValorInicialNumerico(null)
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

  function resetEstadoCepEEndereco() {
    setEstadoCep('aguardando_input')
    setAddressValidationError(null)
    setAddressValidationReviewMode(false)
    setAddressResult(null)
    setAddressConfirmed(false)
    setAddressConfirmedResult(null)
    setAddressDivergencia(null)
    setSearchPayload(null)
    setValorInicial('')
    setValorInicialNumerico(null)
    setProgressStatus('idle')
    setProgressSnapshot(null)
    setSearchError('')
    setElapsedSeconds(0)
    setCepSemLogradouro(false)
    setCepSemBairro(false)
    stopPolling()
    stopTimer()
  }

  const camposEndereco = ['logradouro', 'numero', 'bairro', 'cidade', 'uf']

  function limparResultadoValidacao(options: { preservarRevisaoEndereco?: boolean } = {}) {
    setAddressValidationError(null)
    if (!options.preservarRevisaoEndereco) setAddressValidationReviewMode(false)
    setAddressResult(null)
    setAddressConfirmed(false)
    setAddressConfirmedResult(null)
    setAddressDivergencia(null)
    setSearchPayload(null)
    setValorInicial('')
    setValorInicialNumerico(null)
    setProgressStatus('idle')
    setProgressSnapshot(null)
    setSearchError('')
    setElapsedSeconds(0)
    stopPolling()
    stopTimer()
  }

  function updateForm<K extends keyof FormState>(key: K, value: FormState[K]) {
    const nextValue = normalizeValue(key, value)
    setForm((current) => ({ ...current, [key]: nextValue }))
    setFormErrors((current) => {
      const next = { ...current }
      delete next[key as keyof FormErrors]
      if (camposEndereco.includes(String(key))) {
        delete next.endereco
      }
      return next
    })
    if (camposEndereco.includes(String(key))) {
      limparResultadoValidacao({ preservarRevisaoEndereco: addressValidationReviewMode })
      setPhase('Endereco alterado')
      if (estadoCep === 'confirmado') {
        setEstadoCep('encontrado')
      }
    }
  }

  async function buscarCepHandler() {
    const digitos = cepInput.replace(/\D/g, '')
    if (digitos.length !== 8) {
      toast.error('CEP invalido. Informe 8 digitos numericos.')
      return
    }
    if (!form.numero.trim()) {
      toast.error('Informe o numero antes de pesquisar o CEP.')
      return
    }
    setLoadingCep(true)
    setAddressValidationError(null)
    setAddressValidationReviewMode(false)
    setEstadoCep('consultando')
    setFormErrors((current) => { const next = { ...current }; delete next.endereco; return next })
    try {
      const response = await fetch('/api/procurar-datas/buscar-cep', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cep: cepInput }),
      })
      const data = await response.json() as { ok: boolean; resultado?: { cep: string; logradouro: string; bairro: string; cidade: string; uf: string }; error?: string }
      if (!data.ok || !data.resultado) {
        setEstadoCep('nao_encontrado')
        setPhase('CEP nao encontrado')
        return
      }
      const r = data.resultado
      setForm((current) => ({
        ...current,
        logradouro: normalizarLogradouro(r.logradouro || ''),
        bairro: normalizarBairro(r.bairro || ''),
        cidade: normalizarCidade(r.cidade || ''),
        uf: normalizarUF(r.uf || ''),
      }))
      const logradouroVeio = !!(r.logradouro && r.logradouro.trim())
      const bairroVeio = !!(r.bairro && r.bairro.trim())
      setCepSemLogradouro(!logradouroVeio)
      setCepSemBairro(!bairroVeio)
      setEstadoCep('encontrado')
      setPhase('CEP encontrado')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao consultar CEP.'
      toast.error(message)
      setEstadoCep('aguardando_input')
      setPhase('Erro ao consultar CEP')
    } finally {
      setLoadingCep(false)
    }
  }

  async function confirmarEnderecoCep() {
    setEstadoCep('confirmado')
    setPhase('Validando localizacao')
    await validarEndereco()
  }

  function rejeitarEnderecoCep() {
    setCepInput('')
    setForm((current) => ({ ...current, logradouro: '', bairro: '', cidade: '', uf: 'PR' }))
    resetEstadoCepEEndereco()
    setPhase('Pronto para validar endereco')
  }

  function ajustarEndereco() {
    setCepInput('')
    setForm((current) => ({ ...current, logradouro: '', bairro: '', cidade: '', uf: 'PR', numero: '' }))
    resetEstadoCepEEndereco()
    setEstadoCep('aguardando_input')
    setPhase('Pronto para validar endereco')
    toast.success('Endereco reiniciado. Preencha CEP e numero novamente.')
  }

  function limparEstadosDependentesDeCoordenada() {
    setAddressResult(null)
    setAddressConfirmed(false)
    setAddressConfirmedResult(null)
    setAddressDivergencia(null)
    setSearchPayload(null)
    setValorInicial('')
    setValorInicialNumerico(null)
    setProgressStatus('idle')
    setProgressSnapshot(null)
    setSearchError('')
    setElapsedSeconds(0)
    setPesquisaAuditoriaId(null)
    currentRunIdRef.current = null
    stopPolling()
    stopTimer()
  }

  function revisarEnderecoAposErro() {
    setAddressValidationError(null)
    setAddressValidationReviewMode(true)
    limparEstadosDependentesDeCoordenada()
    setEstadoCep('encontrado')
    setPhase('Revise CEP e endereco')
  }

  function pesquisarOutroCepAposErro() {
    setAddressValidationError(null)
    setAddressValidationReviewMode(false)
    setCepInput('')
    setForm((current) => ({ ...current, logradouro: '', bairro: '', cidade: '', uf: 'PR' }))
    limparEstadosDependentesDeCoordenada()
    setEstadoCep('aguardando_input')
    setCepSemLogradouro(false)
    setCepSemBairro(false)
    setPhase('Pronto para validar endereco')
    requestAnimationFrame(() => cepInputRef.current?.focus())
  }

  function montarEnderecoFormatadoParaMaps(form: FormState, cep?: string): string {
    const partes: string[] = []
    if (form.logradouro) partes.push(form.logradouro)
    if (form.numero) partes.push(form.numero)
    if (form.bairro) partes.push(form.bairro)
    if (form.cidade) partes.push(form.cidade)
    if (form.uf) partes.push(form.uf)
    if (cep) partes.push(cep)
    return partes.join(' - ')
  }

  function montarLinkComparacaoGoogleMaps(lat: number, lng: number, enderecoFormatado: string): string {
    return `https://www.google.com/maps/dir/${lat},${lng}/${encodeURIComponent(enderecoFormatado)}`
  }

  async function validarEndereco() {
    const { ok, errors } = validarCamposEndereco(form)
    if (!ok) {
      setFormErrors((current) => ({ ...current, ...errors }))
      toast.error('Preencha os campos obrigatorios do endereco.')
      return
    }

    setValidatingAddress(true)
    setAddressValidationError(null)
    setAddressValidationReviewMode(false)
    setPhase('Validando endereco')
    setSearchPayload(null)
    setAddressConfirmed(false)
    setAddressConfirmedResult(null)
    setAddressDivergencia(null)
    setValorInicial('')
    setValorInicialNumerico(null)
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
      const body: ValidarEnderecoRequest = {
        ...form,
        cep: cepInput,
      }
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

      const comparacao = compararEnderecoCEPComGeocodificacao(
        { bairro: form.bairro, cidade: form.cidade, uf: form.uf },
        resultado.address,
      )

      if (comparacao.divergencia === 'nenhuma') {
        confirmarLocal(resultado)
      } else {
        setAddressDivergencia(comparacao)
        setPhase('Endereco validado — confirmar divergencia')
        toast.info('Endereco validado. Confirme se o local esta correto.')
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao validar endereco.'
      const status = (error as ProcurarDatasHttpError).status
      if (status === 422) {
        limparEstadosDependentesDeCoordenada()
        setAddressValidationError({
          status,
          title: 'Nao conseguimos validar esse endereco com seguranca',
          description: 'Confira se o CEP corresponde ao logradouro, bairro e numero informados.',
          message,
        })
        setPhase('Revise CEP e endereco')
        toast.error(message)
        return
      }
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
          setSearchPayload({
            ...payload,
            clientToken: activeSearchTokenRef.current,
            runId: currentRunIdRef.current || activeSearchTokenRef.current,
          })
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

  function confirmarLocal(resultado: AddressResult) {
    setAddressConfirmed(true)
    setAddressConfirmedResult(resultado)
    setAddressDivergencia(null)
    setPhase('Local confirmado')
    toast.success('Local confirmado.')
    const dataInput = document.getElementById('dataInicial') as HTMLInputElement | null
    if (dataInput) dataInput.focus()
  }

  function confirmarEndereco() {
    if (!addressResult?.ok || !addressResult.lat || !addressResult.lng) {
      toast.error('Valide o endereco antes de confirmar.')
      return
    }
    confirmarLocal(addressResult)
  }

  function revisarEnderecoDivergente() {
    setAddressDivergencia(null)
    setAddressConfirmed(false)
    setAddressConfirmedResult(null)
    setSearchPayload(null)
    setValorInicial('')
    setValorInicialNumerico(null)
    setProgressStatus('idle')
    setProgressSnapshot(null)
    setSearchError('')
    setElapsedSeconds(0)
    stopPolling()
    stopTimer()
    setEstadoCep('encontrado')
    setPhase('Revise CEP e endereco')
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
        valorInicialMinimo: valorInicialNumerico ?? undefined,
      }

      const response = await fetch(endpoints.pesquisar, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = (await readJson(response)) as PesquisarDatasResponseSucesso & { pesquisaAuditoriaId?: string; runId?: string }
      if (activeSearchTokenRef.current !== token) return
      const startedToken = data.clientToken || token
      activeSearchTokenRef.current = startedToken
      
      // Guardar ID da auditoria operacional e runId se retornados
      if (data.pesquisaAuditoriaId) {
        setPesquisaAuditoriaId(data.pesquisaAuditoriaId)
      }
      if (data.runId) {
        currentRunIdRef.current = data.runId
      }
      
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
    currentRunIdRef.current = null
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
      const body: PreAgendarRequest & { pesquisaAuditoriaId?: string; clientToken?: string; runId?: string } = {
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
        // Incluir dados para vincular com auditoria da pesquisa
        ...(pesquisaAuditoriaId && { pesquisaAuditoriaId }),
        ...(searchPayload.clientToken && { clientToken: searchPayload.clientToken }),
        ...(searchPayload.runId && { runId: searchPayload.runId }),
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
                  <td className="px-3 py-3 font-medium text-slate-900">{formatarDataBrasileira(candidate.date || candidate.dateISO)}</td>
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
            <p className="mt-1">AVISO: SE FOR VENDA SHOWROOM FALAR COM PÓS VENDA SOBRE DATA PRA DESMONTAR E MONTAR.</p>
          </div>

          <div className="grid gap-3 md:grid-cols-6">
            <label className="md:col-span-2">
              <span className="mb-1 block text-xs font-medium text-slate-600">CEP</span>
              <Input
                ref={cepInputRef}
                disabled={cepBloqueado}
                value={cepInput}
                onChange={(e) => {
                  const raw = e.target.value.replace(/\D/g, '').slice(0, 8)
                  const fmt = raw.length > 5 ? raw.slice(0, 5) + '-' + raw.slice(5) : raw
                  setCepInput(fmt)
                  if (addressValidationReviewMode) {
                    setAddressValidationError(null)
                    limparEstadosDependentesDeCoordenada()
                    setEstadoCep('aguardando_input')
                    setPhase('CEP alterado')
                    return
                  }
                  if (estadoCep !== 'aguardando_input') {
                    rejeitarEnderecoCep()
                  }
                }}
                placeholder="00000-000"
                maxLength={9}
              />
            </label>
            <label>
              <span className="mb-1 block text-xs font-medium text-slate-600">Numero</span>
              <Input
                disabled={numeroBloqueado}
                value={form.numero}
                onChange={(e) => updateForm('numero', e.target.value)}
                placeholder="Apenas numeros"
              />
              {formErrors.numero && <span className="mt-1 block text-xs text-red-600">{formErrors.numero}</span>}
            </label>
            <div className="md:col-span-2 flex items-end">
              <Button
                type="button"
                variant="outline"
                onClick={buscarCepHandler}
                disabled={loadingCep || searching || (!addressRevisionUnlocked && (estadoCep === 'encontrado' || estadoCep === 'confirmado')) || cepInput.replace(/\D/g, '').length !== 8 || !form.numero.trim()}
                className="w-full"
              >
                {loadingCep ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                Pesquisar CEP
              </Button>
            </div>
          </div>

          <div className="mt-3 grid gap-3 md:grid-cols-6">
            <label className="md:col-span-3">
              <span className="mb-1 block text-xs font-medium text-slate-600">Logradouro</span>
              <Input
                disabled={logradouroBloqueado}
                readOnly={logradouroBloqueado}
                value={form.logradouro}
                onChange={(e) => updateForm('logradouro', e.target.value)}
                className={`${formErrors.logradouro ? 'border-red-500 focus:border-red-500' : ''} ${logradouroBloqueado ? 'bg-slate-50/50' : ''}`}
              />
              {formErrors.logradouro && <span className="mt-1 block text-xs text-red-600">{formErrors.logradouro}</span>}
            </label>
            <label className="md:col-span-2">
              <span className="mb-1 block text-xs font-medium text-slate-600">Bairro</span>
              <Input
                disabled={bairroBloqueado}
                readOnly={bairroBloqueado}
                value={form.bairro}
                onChange={(e) => updateForm('bairro', e.target.value)}
                className={`${formErrors.bairro ? 'border-red-500 focus:border-red-500' : ''} ${bairroBloqueado ? 'bg-slate-50/50' : ''}`}
              />
              {formErrors.bairro && <span className="mt-1 block text-xs text-red-600">{formErrors.bairro}</span>}
            </label>
            <label className="md:col-span-3">
              <span className="mb-1 block text-xs font-medium text-slate-600">Cidade</span>
              <Input
                disabled={cidadeUfBloqueado}
                readOnly={cidadeUfBloqueado}
                value={form.cidade}
                onChange={(e) => updateForm('cidade', e.target.value)}
                className={`${formErrors.cidade ? 'border-red-500 focus:border-red-500' : ''} ${cidadeUfBloqueado ? 'bg-slate-50/50' : ''}`}
              />
              {formErrors.cidade && <span className="mt-1 block text-xs text-red-600">{formErrors.cidade}</span>}
            </label>
            <label>
              <span className="mb-1 block text-xs font-medium text-slate-600">UF</span>
              <Input
                disabled={cidadeUfBloqueado}
                readOnly={cidadeUfBloqueado}
                maxLength={2}
                value={form.uf}
                onChange={(e) => updateForm('uf', e.target.value)}
                className={`${formErrors.uf ? 'border-red-500 focus:border-red-500' : ''} ${cidadeUfBloqueado ? 'bg-slate-50/50' : ''}`}
              />
              {formErrors.uf && <span className="mt-1 block text-xs text-red-600">{formErrors.uf}</span>}
            </label>
            <div className="md:col-span-2 flex items-end">
              {addressResult?.ok ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={ajustarEndereco}
                  disabled={searching}
                  className="w-full"
                >
                  <Edit className="h-4 w-4" />
                  Ajustar endereco
                </Button>
              ) : null}
            </div>
          </div>

          {estadoCep === 'encontrado' && (cepSemLogradouro || cepSemBairro) && (
            <div className="mt-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
              {cepSemLogradouro && cepSemBairro
                ? 'Este CEP é geral da cidade. Preencha logradouro e bairro para continuar.'
                : cepSemLogradouro
                  ? 'Este CEP não trouxe o logradouro. Preencha o logradouro para continuar.'
                  : 'Este CEP não trouxe o bairro. Preencha o bairro para continuar.'}
            </div>
          )}

          {estadoCep === 'nao_encontrado' && (
            <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              CEP nao encontrado. Confira o CEP digitado ou tente outro CEP.
            </div>
          )}

          {estadoCep === 'encontrado' && (
            <div className="mt-3 rounded-md border border-sky-200 bg-sky-50 p-3">
              <p className="text-sm font-medium text-slate-800">O CEP é desse endereço?</p>
              <p className="mt-1 text-sm font-medium text-slate-900">
                {form.logradouro && form.numero ? `${form.logradouro}, ${form.numero}` : form.logradouro || form.numero || ''}
              </p>
              <p className="text-xs text-slate-600">
                {[form.bairro, `${form.cidade}/${form.uf}`].filter(Boolean).join(' — ')}
              </p>
              <div className="mt-3 flex gap-2">
                <Button type="button" size="sm" onClick={confirmarEnderecoCep} disabled={validatingAddress || searching}>
                  {validatingAddress ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  Endereço correto
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={rejeitarEnderecoCep} disabled={validatingAddress || searching}>
                  <XCircle className="h-4 w-4" />
                  Não é esse endereço
                </Button>
              </div>
            </div>
          )}

          {addressValidationError && (
            <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900">
              <div className="font-semibold">{addressValidationError.title}</div>
              <p className="mt-1 text-red-800">{addressValidationError.description}</p>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <Button
                  type="button"
                  size="sm"
                  onClick={revisarEnderecoAposErro}
                  disabled={searching || validatingAddress}
                  className="bg-red-700 text-white hover:bg-red-800"
                >
                  <Edit className="h-4 w-4" />
                  Revisar CEP e endereco
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={pesquisarOutroCepAposErro}
                  disabled={searching || validatingAddress}
                  className="border-red-200 bg-white text-red-800 hover:bg-red-50"
                >
                  <Search className="h-4 w-4" />
                  Pesquisar outro CEP
                </Button>
              </div>
            </div>
          )}

          {estadoCep === 'confirmado' && !addressResult?.ok && !addressValidationError && !addressValidationReviewMode && (
            <div className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
              {validatingAddress ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Validando localização...
                </span>
              ) : (
                <span className="font-medium">Endereco textual confirmado.</span>
              )}
            </div>
          )}

          {formErrors.endereco && !addressResult?.ok && (
            <div className="mt-3 text-xs font-semibold text-red-600">{formErrors.endereco}</div>
          )}

          {addressResult?.ok && (
            <div className="mt-4 rounded-lg border border-sky-100 bg-sky-50 p-4 text-sm text-slate-700">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="flex-1">
                  <div className="text-xs font-semibold text-slate-500 uppercase">Endereco localizado</div>
                  <div className="mt-1 font-medium text-slate-900">
                    {form.logradouro && form.numero ? `${form.logradouro}, ${form.numero}` : form.logradouro || form.numero || ''}
                  </div>
                  <div className="mt-1 text-xs text-slate-600">
                    {form.bairro} — {form.cidade}/{form.uf}
                  </div>
                  <div className="mt-2 text-xs text-slate-500">Coordenada validada com sucesso.</div>
                  {addressConfirmed && addressConfirmedResult?.ok && (
                    <div className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
                      <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
                      Local confirmado
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  {addressResult.lat && addressResult.lng && (
                    <a
                      href={montarLinkComparacaoGoogleMaps(addressResult.lat, addressResult.lng, montarEnderecoFormatadoParaMaps(form, addressResult.cep))}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-medium text-sky-700 hover:text-sky-900 hover:underline"
                    >
                      Comparar no Google Maps
                    </a>
                  )}
                  {!addressConfirmed && addressDivergencia && (
                    <Button type="button" size="sm" onClick={confirmarEndereco} disabled={validatingAddress || searching}>
                      Confirmar este local
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}

          {addressDivergencia && !addressConfirmed && (
            <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
              {addressDivergencia.divergencia === 'bairro' && (
                <p>
                  O bairro pesquisado foi <strong>{form.bairro}</strong>, mas a localizacao encontrada retornou <strong>{addressDivergencia.bairroProvider}</strong>. Este local esta correto?
                </p>
              )}
              {addressDivergencia.divergencia === 'cidade' && (
                <p className="font-medium">
                  A cidade pesquisada foi <strong>{form.cidade}</strong>, mas a localizacao encontrada retornou <strong>{addressDivergencia.cidadeProvider}</strong>. Este local esta correto?
                </p>
              )}
              {addressDivergencia.divergencia === 'uf' && (
                <p className="font-medium">
                  A UF pesquisada foi <strong>{form.uf}</strong>, mas a localizacao encontrada retornou <strong>{addressDivergencia.ufProvider}</strong>. Este local esta correto?
                </p>
              )}
              <div className="mt-3 flex gap-2">
                <Button type="button" size="sm" onClick={confirmarEndereco} disabled={validatingAddress || searching}>
                  <CheckCircle2 className="h-4 w-4" />
                  Sim, confirmar local
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={revisarEnderecoDivergente} disabled={validatingAddress || searching}>
                  <XCircle className="h-4 w-4" />
                  Nao, revisar endereco
                </Button>
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
