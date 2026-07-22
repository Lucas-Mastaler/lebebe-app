'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { AlertCircle, Baby, Check, ChevronLeft, ChevronRight, ClipboardList, History, MessageSquareText, Plus, RefreshCw, Save, Search, ShoppingBag, UserRound, WifiOff, X } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { HistoricoClienteModal } from '@/components/atendimento-presencial/HistoricoClienteModal'
import { TelefoneClienteRapido } from '@/components/atendimento-presencial/TelefoneClienteRapido'
import {
  carregarCacheRascunho,
  removerCacheRascunho,
  salvarCacheRascunho,
} from '@/lib/atendimento-presencial/rascunho-cache'
import {
  DEPARTAMENTOS_INTERESSE,
  FICHA_CONSULTORA_NOME_MAX_CHARS,
  FICHA_ETAPAS,
  FICHA_OBSERVACOES_MAX_CHARS,
  FICHA_PRODUTO_MAX_CHARS,
  FICHA_PRODUTOS_MAX_ITENS,
  FICHA_TOTAL_ETAPAS,
  MOTIVOS_RESULTADO_GRUPOS,
  RESULTADOS_ATENDIMENTO,
  SEXOS_CRIANCA,
  SITUACOES_CRIANCA,
  converterViradaCartaoInput,
  formatarViradaCartao,
  formatarViradaCartaoInput,
  converterDataInputParaISO,
  criarCriancaRascunho,
  formatarDataISOParaInput,
  formatarDataPrevistaInput,
  getDepartamentoLabel,
  getMotivoLabel,
  getResultadoLabel,
  limparNomeCriancaDigitacao,
  migrarFichaDadosRascunho,
  normalizarNomeConsultora,
  validarFichaParaConclusao,
  validarNomeConsultora,
  type DepartamentoInteresse,
  type FichaCriancaRascunho,
  type FichaDadosRascunho,
  type FichaEtapa,
  type MotivoResultado,
  type ResultadoAtendimento,
  type SexoCrianca,
  type SituacaoCrianca,
  type UnidadeIdadeCrianca,
} from '@/lib/atendimento-presencial/ficha-schema'
import {
  AutosaveSerialQueue,
  serializarPayloadAutosave,
  type AutosavePayload,
  type AutosaveSaveResult,
  type AutosaveStatus,
} from '@/lib/atendimento-presencial/autosave-fila'
import {
  PARENTESCOS_CLIENTE,
  getParentescoLabel,
  type ClientePresencialDTO,
  type ParentescoCliente,
} from '@/lib/atendimento-presencial/clientes'
import { aplicarMascaraTelefoneBR } from '@/lib/atendimento-presencial/telefone'
import {
  type AtendimentoPresencialDTO,
  type ContextoAtendimento,
} from '@/lib/atendimento-presencial/rascunhos-shared'

type ApiRascunhoResponse = {
  ok: boolean
  message?: string
  rascunho?: AtendimentoPresencialDTO
}

type ApiConcluirResponse = {
  ok: boolean
  message?: string
  field?: string
  atendimento?: AtendimentoPresencialDTO
}

type ApiClientesResponse = {
  ok: boolean
  message?: string
  clientes?: Array<ClientePresencialDTO & { correspondenciaExataTelefone?: boolean }>
  cliente?: ClientePresencialDTO
  clienteExistente?: boolean
}

type ErroValidacaoFicha = {
  sectionId: string
  fieldId?: string
  message: string
}

type SyncStatus = 'ocioso' | AutosaveStatus

type Props = {
  usuarioId: string
  contextoInicial: ContextoAtendimento
  unidadeIdInicial: string
}

const etapaLabels: Record<FichaEtapa, string> = {
  ficha: 'Ficha de Atendimento',
  resultado: 'Resultado',
  revisao: 'Revisao',
}

const payloadInicial: FichaDadosRascunho = {
  criancas: [],
  departamentos: [],
  produtosInteresse: [],
  motivosResultado: [],
  etapaAtual: 'ficha',
}

function telefoneFormatadoDaCliente(cliente: ClientePresencialDTO | null) {
  return cliente?.telefoneFormatado ?? ''
}

function gerarIdLocal(prefixo = 'local') {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `${prefixo}-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function indexEtapa(etapa: FichaEtapa) {
  return Math.max(FICHA_ETAPAS.indexOf(etapa), 0)
}

function proximaEtapa(etapa: FichaEtapa) {
  return FICHA_ETAPAS[Math.min(indexEtapa(etapa) + 1, FICHA_ETAPAS.length - 1)]
}

function etapaAnterior(etapa: FichaEtapa) {
  return FICHA_ETAPAS[Math.max(indexEtapa(etapa) - 1, 0)]
}

function normalizarProduto(valor: string) {
  return valor.trim().replace(/\s+/g, ' ').slice(0, FICHA_PRODUTO_MAX_CHARS)
}

const ID_CRIANCA_INICIAL = 'crianca-inicial'

function criarPayloadInicial(): FichaDadosRascunho {
  return {
    ...payloadInicial,
    criancas: [criarCriancaRascunho(ID_CRIANCA_INICIAL)],
    departamentos: [],
    produtosInteresse: [],
    motivosResultado: [],
  }
}

function StatusSync({ status }: { status: SyncStatus }) {
  const texto: Record<SyncStatus, string> = {
    ocioso: 'Ocioso',
    alterado: 'Alterado',
    aguardando: 'Aguardando',
    salvando: 'Salvando',
    salvo: 'Salvo',
    offline: 'Offline',
    conflito: 'Conflito',
    erro: 'Erro',
  }

  return (
    <span className="inline-flex min-h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700">
      {status === 'offline' ? <WifiOff className="h-4 w-4" aria-hidden="true" /> : <Save className="h-4 w-4" aria-hidden="true" />}
      {texto[status]}
    </span>
  )
}

function OpcaoButton(props: {
  selected: boolean
  children: React.ReactNode
  onClick: () => void
  className?: string
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      aria-pressed={props.selected}
      onClick={props.onClick}
      disabled={props.disabled}
      className={[
        'min-h-12 rounded-md border px-4 py-3 text-left text-sm font-semibold outline-none transition focus-visible:ring-2 focus-visible:ring-sky-500',
        props.selected ? 'border-sky-600 bg-sky-50 text-sky-800' : 'border-slate-200 bg-white text-slate-700',
        props.className ?? '',
      ].join(' ')}
    >
      {props.children}
    </button>
  )
}

type VariantSecao = 'azul' | 'rosa' | 'amarelo' | 'lilas' | 'verde' | 'laranja'

const variantSecaoClasses: Record<VariantSecao, { section: string; iconWrap: string; icon: string; title: string; descricao: string }> = {
  azul: {
    section: 'border-blue-200 bg-blue-50/60',
    iconWrap: 'border-blue-200 bg-white',
    icon: 'text-blue-700',
    title: 'text-blue-950',
    descricao: 'text-blue-600/70',
  },
  rosa: {
    section: 'border-pink-200 bg-pink-50/60',
    iconWrap: 'border-pink-200 bg-white',
    icon: 'text-pink-700',
    title: 'text-pink-950',
    descricao: 'text-pink-600/70',
  },
  amarelo: {
    section: 'border-amber-200 bg-amber-50/60',
    iconWrap: 'border-amber-200 bg-white',
    icon: 'text-amber-700',
    title: 'text-amber-950',
    descricao: 'text-amber-600/70',
  },
  lilas: {
    section: 'border-violet-200 bg-violet-50/60',
    iconWrap: 'border-violet-200 bg-white',
    icon: 'text-violet-700',
    title: 'text-violet-950',
    descricao: 'text-violet-600/70',
  },
  verde: {
    section: 'border-emerald-200 bg-emerald-50/60',
    iconWrap: 'border-emerald-200 bg-white',
    icon: 'text-emerald-700',
    title: 'text-emerald-950',
    descricao: 'text-emerald-600/70',
  },
  laranja: {
    section: 'border-orange-200 bg-orange-50/60',
    iconWrap: 'border-orange-200 bg-white',
    icon: 'text-orange-700',
    title: 'text-orange-950',
    descricao: 'text-orange-600/70',
  },
}

function SecaoFicha(props: {
  id?: string
  titulo: string
  descricao?: string
  icon: LucideIcon
  variant?: VariantSecao
  erro?: string
  children: React.ReactNode
}) {
  const Icon = props.icon
  const v = props.variant ? variantSecaoClasses[props.variant] : null
  return (
    <section
      id={props.id}
      className={`scroll-mt-28 rounded-md border p-4 sm:p-5 ${props.erro ? 'border-red-300 bg-red-50/70' : v ? v.section : 'border-slate-200 bg-slate-50/60'}`}
    >
      <div className="mb-4 flex items-start gap-3">
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md border ${props.erro ? 'border-red-200 bg-white' : v ? v.iconWrap : 'border-slate-200 bg-white'}`}>
          {props.erro ? (
            <AlertCircle className="h-4 w-4 text-red-700" aria-hidden="true" />
          ) : (
            <Icon className={`h-4 w-4 ${v ? v.icon : 'text-sky-700'}`} aria-hidden="true" />
          )}
        </span>
        <div>
          <h2 className={`text-lg font-semibold ${props.erro ? 'text-red-950' : v ? v.title : 'text-slate-950'}`}>{props.titulo}</h2>
          {props.descricao && <p className={`mt-1 text-sm ${props.erro ? 'text-red-700' : v ? v.descricao : 'text-slate-500'}`}>{props.descricao}</p>}
          {props.erro && <p className="mt-2 text-sm font-semibold text-red-700">{props.erro}</p>}
        </div>
      </div>
      <div className="grid gap-4">{props.children}</div>
    </section>
  )
}

function validarEtapa(params: {
  etapa: FichaEtapa
  ficha: FichaDadosRascunho
  clienteSelecionada: ClientePresencialDTO | null
}): ErroValidacaoFicha[] {
  const { etapa, ficha, clienteSelecionada } = params
  const erros: ErroValidacaoFicha[] = []
  if (etapa === 'ficha') {
    if (!clienteSelecionada) {
      erros.push({ sectionId: 'secao-cliente', fieldId: 'busca-cliente', message: 'Selecione uma cliente.' })
    }
    const consultoraNomeNormalizado = normalizarNomeConsultora(ficha.consultoraNome)
    if (!consultoraNomeNormalizado || !validarNomeConsultora(consultoraNomeNormalizado)) {
      erros.push({ sectionId: 'secao-consultora-nome', fieldId: 'consultora-nome', message: 'Informe o nome da consultora (apenas letras e espacos, 2 a 30 caracteres).' })
    }
    for (const crianca of ficha.criancas) {
      if (crianca.situacao === 'gestacao' && crianca.dataPrevistaNascimento && !/^\d{4}-\d{2}-\d{2}$/.test(crianca.dataPrevistaNascimento)) {
        erros.push({ sectionId: 'secao-crianca', fieldId: `data-prevista-${crianca.id}`, message: 'Revise a data prevista de nascimento.' })
      }
      if (crianca.situacao === 'presente_outra_pessoa' && crianca.dataPrevistaNascimento && !/^\d{4}-\d{2}-\d{2}$/.test(crianca.dataPrevistaNascimento)) {
        erros.push({ sectionId: 'secao-crianca', fieldId: `data-prevista-${crianca.id}`, message: 'Revise a data prevista de nascimento.' })
      }
      if (crianca.situacao === 'ja_nasceu') {
        if (crianca.idadeUnidade === 'meses' && (!crianca.idadeValor || crianca.idadeValor < 1 || crianca.idadeValor > 11)) {
          erros.push({ sectionId: 'secao-crianca', message: 'Informe idade valida em meses.' })
        }
        if (crianca.idadeUnidade === 'anos' && (!crianca.idadeValor || crianca.idadeValor < 1 || crianca.idadeValor > 6)) {
          erros.push({ sectionId: 'secao-crianca', message: 'Informe idade valida em anos.' })
        }
        if (!crianca.idadeUnidade) erros.push({ sectionId: 'secao-crianca', message: 'Informe a idade da crianca.' })
      }
    }
  }
  if (etapa === 'resultado') {
    if (!ficha.resultadoAtendimento) erros.push({ sectionId: 'secao-resultado-fechamento', message: 'Selecione o resultado do atendimento.' })
    if (ficha.motivosResultado.length === 0) erros.push({ sectionId: 'secao-resultado-produto', message: 'Selecione pelo menos um motivo.' })
    if (ficha.motivosResultado.includes('virada_cartao') && !formatarViradaCartao(ficha.viradaCartaoDia, ficha.viradaCartaoMes)) {
      erros.push({ sectionId: 'secao-resultado-condicao', fieldId: 'virada-cartao', message: 'Informe o dia e o mes da virada do cartao.' })
    }
    if (ficha.motivosResultado.includes('outro') && !ficha.motivoOutro?.trim()) {
      erros.push({ sectionId: 'secao-resultado-outro', fieldId: 'motivo-outro', message: 'Informe o complemento de Outro.' })
    }
  }
  return erros
}

function primeiroErroPorSecao(erros: ErroValidacaoFicha[], sectionId: string) {
  return erros.find((erro) => erro.sectionId === sectionId)?.message
}

export default function FichaPageClient({ usuarioId, contextoInicial, unidadeIdInicial }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [contexto] = useState<ContextoAtendimento>(contextoInicial)
  const [unidadeId, setUnidadeId] = useState(unidadeIdInicial)
  const [ativo, setAtivo] = useState<AtendimentoPresencialDTO | null>(null)
  const [ficha, setFicha] = useState<FichaDadosRascunho>(() => criarPayloadInicial())
  const [clienteSelecionada, setClienteSelecionada] = useState<ClientePresencialDTO | null>(null)
  const [buscaCliente, setBuscaCliente] = useState('')
  const [clientesEncontradas, setClientesEncontradas] = useState<ClientePresencialDTO[]>([])
  const [buscandoCliente, setBuscandoCliente] = useState(false)
  const [novoCliente, setNovoCliente] = useState({
    nome: '',
    telefone: '',
    parentesco: '' as ParentescoCliente | '',
    parentescoOutro: '',
  })
  const [dataPrevistaInputs, setDataPrevistaInputs] = useState<Record<string, string>>({})
  const [viradaCartaoInput, setViradaCartaoInput] = useState('')
  const [produtoDigitado, setProdutoDigitado] = useState('')
  const [statusSync, setStatusSync] = useState<SyncStatus>('ocioso')
  const [erro, setErro] = useState<string | null>(null)
  const [erroCriacao, setErroCriacao] = useState<string | null>(null)
  const [erroEtapa, setErroEtapa] = useState<string | null>(null)
  const [errosValidacao, setErrosValidacao] = useState<ErroValidacaoFicha[]>([])
  const [numeroLancamento, setNumeroLancamento] = useState('')
  const [concluindo, setConcluindo] = useState(false)
  const [mensagemConclusao, setMensagemConclusao] = useState<string | null>(null)
  const [carregandoRascunhoInicial, setCarregandoRascunhoInicial] = useState(() => {
    if (typeof window === 'undefined') return false
    return new URLSearchParams(window.location.search).has('rascunho')
  })
  const [erroRascunhoInicial, setErroRascunhoInicial] = useState<string | null>(null)
  const [iniciando, setIniciando] = useState(false)
  const [iniciandoNovoAtendimento, setIniciandoNovoAtendimento] = useState(false)
  const [onlineTick, setOnlineTick] = useState(0)
  const [historicoAberto, setHistoricoAberto] = useState(false)
  const [telefoneClienteEdicao, setTelefoneClienteEdicao] = useState('')
  const [erroTelefone, setErroTelefone] = useState<string | null>(null)
  const [salvandoTelefone, setSalvandoTelefone] = useState(false)
  const autosaveQueueRef = useRef<AutosaveSerialQueue | null>(null)
  const fichaRef = useRef(ficha)
  const telefoneDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const telefoneRequestRef = useRef(0)
  const telefoneClienteSincronizadoRef = useRef('')
  const clienteSelecionadaRef = useRef<ClientePresencialDTO | null>(null)
  const mountedRef = useRef(false)
  const concluindoRef = useRef(false)
  const draftClientIdRef = useRef<string | null>(null)
  const tentativaUnidadeRef = useRef('')
  const tentativaNomeRef = useRef('')
  const autoIniciandoRef = useRef(false)
  const novoAtendimentoRef = useRef(false)
  fichaRef.current = ficha
  clienteSelecionadaRef.current = clienteSelecionada

  const etapaAtual = ficha.etapaAtual
  const etapaNumero = indexEtapa(etapaAtual) + 1
  const etapaLabelAtual = etapaLabels[etapaAtual]
  const unidadesParaSelecao = useMemo(() => contexto?.unidadesPermitidas ?? [], [contexto])

  const consultoraNomeNormalizado = useMemo(() => normalizarNomeConsultora(ficha.consultoraNome), [ficha.consultoraNome])
  const paramRascunho = searchParams?.get('rascunho') ?? null

  const rascunhoIdParam = useMemo(() => {
    if (paramRascunho) return paramRascunho
    if (typeof window !== 'undefined') {
      return new URLSearchParams(window.location.search).get('rascunho') ?? null
    }
    return null
  }, [paramRascunho])

  const podeCriarRascunho = useMemo(() => {
    if (!contexto || iniciando || ativo) return false
    if (unidadesParaSelecao.length === 0) return false
    if (!unidadeId || !unidadesParaSelecao.some((unidade) => unidade.id === unidadeId)) return false
    if (!consultoraNomeNormalizado || !validarNomeConsultora(consultoraNomeNormalizado)) return false
    if (rascunhoIdParam) return false
    return true
  }, [ativo, contexto, iniciando, consultoraNomeNormalizado, unidadeId, unidadesParaSelecao, rascunhoIdParam])

  const errosEtapaAtual = useMemo(() => validarEtapa({ etapa: etapaAtual, ficha, clienteSelecionada }), [etapaAtual, ficha, clienteSelecionada])

  const mensagemContinuar = useMemo(() => {
    if (etapaAtual === 'ficha' && !ativo) {
      if (iniciando) return 'Salvando rascunho...'
      if (erroCriacao) return erroCriacao
      if (!unidadeId) return 'Selecione a filial.'
      if (!consultoraNomeNormalizado || !validarNomeConsultora(consultoraNomeNormalizado)) {
        return 'Informe o nome da consultora.'
      }
      return 'Aguardando criacao do rascunho...'
    }
    if (errosEtapaAtual.length > 0) return errosEtapaAtual[0].message
    return ''
  }, [etapaAtual, ativo, iniciando, erroCriacao, unidadeId, consultoraNomeNormalizado, errosEtapaAtual])

  function atualizarFicha(mutator: (atual: FichaDadosRascunho) => FichaDadosRascunho) {
    setFicha((atual) => mutator(atual))
  }

  async function carregarClientePorId(clienteId: string | null) {
    if (!clienteId) {
      setClienteSelecionada(null)
      return
    }

    try {
      const response = await fetch(`/api/atendimento-presencial/clientes/${clienteId}`, { cache: 'no-store' })
      const data = (await response.json()) as ApiClientesResponse
      if (response.ok && data.ok && data.cliente) setClienteSelecionada(data.cliente)
    } catch {
      setClienteSelecionada(null)
    }
  }

  useEffect(() => {
    if (!rascunhoIdParam) return
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    if (!UUID_RE.test(rascunhoIdParam)) {
      setErroRascunhoInicial('ID do rascunho invalido')
      setCarregandoRascunhoInicial(false)
      return
    }

    let cancelled = false
    async function carregar() {
      setCarregandoRascunhoInicial(true)
      setErroRascunhoInicial(null)
      setErro(null)
      try {
        const response = await fetch(`/api/atendimento-presencial/atendimentos/${rascunhoIdParam}/rascunho`, { cache: 'no-store' })
        const data = (await response.json()) as ApiRascunhoResponse
        if (!response.ok || !data.ok || !data.rascunho) throw new Error(data.message ?? 'Erro ao carregar rascunho')
        if (cancelled) return
        aplicarRascunho(data.rascunho)
      } catch (error) {
        if (!cancelled) setErroRascunhoInicial(error instanceof Error ? error.message : 'Erro ao carregar rascunho')
      } finally {
        if (!cancelled) setCarregandoRascunhoInicial(false)
      }
    }
    void carregar()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rascunhoIdParam])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      autosaveQueueRef.current?.stop()
      autosaveQueueRef.current = null
      if (telefoneDebounceRef.current) clearTimeout(telefoneDebounceRef.current)
    }
  }, [])

  useEffect(() => {
    const cliente = clienteSelecionadaRef.current
    const sincronizacao = `${cliente?.id ?? ''}:${cliente?.version ?? ''}`
    if (telefoneClienteSincronizadoRef.current === sincronizacao) return
    telefoneClienteSincronizadoRef.current = sincronizacao
    setTelefoneClienteEdicao(telefoneFormatadoDaCliente(cliente))
    setErroTelefone(null)
    if (telefoneDebounceRef.current) {
      clearTimeout(telefoneDebounceRef.current)
      telefoneDebounceRef.current = null
    }
  }, [clienteSelecionada?.id, clienteSelecionada?.version])

  useEffect(() => {
    const unidadeValida = !!unidadeId && unidadesParaSelecao.some((unidade) => unidade.id === unidadeId)
    const nomeValido = !!consultoraNomeNormalizado && validarNomeConsultora(consultoraNomeNormalizado)
    const pode =
      !ativo &&
      !iniciando &&
      !concluindo &&
      !carregandoRascunhoInicial &&
      !rascunhoIdParam &&
      unidadeValida &&
      nomeValido
    if (!pode) return
    if (autoIniciandoRef.current) return
    if (tentativaUnidadeRef.current === unidadeId && tentativaNomeRef.current === consultoraNomeNormalizado) return
    autoIniciandoRef.current = true
    tentativaUnidadeRef.current = unidadeId
    tentativaNomeRef.current = consultoraNomeNormalizado
    if (!draftClientIdRef.current) draftClientIdRef.current = gerarIdLocal('draft')
    const draftId = draftClientIdRef.current
    void iniciarRascunho(draftId).finally(() => {
      autoIniciandoRef.current = false
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ativo, iniciando, concluindo, carregandoRascunhoInicial, rascunhoIdParam, unidadeId, unidadesParaSelecao, consultoraNomeNormalizado])

  useEffect(() => {
    setErroCriacao(null)
    const nomeNormalizado = normalizarNomeConsultora(ficha.consultoraNome)
    if (!unidadeId || !nomeNormalizado || !validarNomeConsultora(nomeNormalizado)) {
      tentativaUnidadeRef.current = ''
      tentativaNomeRef.current = ''
    }
  }, [unidadeId, ficha.consultoraNome])

  useEffect(() => {
    function handleOnline() {
      setOnlineTick((valor) => valor + 1)
    }
    window.addEventListener('online', handleOnline)
    return () => window.removeEventListener('online', handleOnline)
  }, [])

  function montarPayloadAutosave(
    fichaAtual = fichaRef.current,
    clienteAtual = clienteSelecionadaRef.current
  ): AutosavePayload {
    return {
      dadosRascunho: migrarFichaDadosRascunho(fichaAtual),
      clienteId: clienteAtual?.id ?? null,
    }
  }

  function salvarCacheLocalRascunho(params: {
    rascunho: AtendimentoPresencialDTO
    payload: AutosavePayload
    sincronizado: boolean
    version?: number
  }) {
    salvarCacheRascunho(window.localStorage, {
      draftClientId: params.rascunho.draftClientId,
      usuarioId,
      atendimentoId: params.rascunho.id,
      version: params.version ?? autosaveQueueRef.current?.getVersion() ?? params.rascunho.version,
      dadosRascunho: params.payload.dadosRascunho,
      atualizadoEm: new Date().toISOString(),
      sincronizado: params.sincronizado,
    })
  }

  function aplicarRascunhoSalvo(params: {
    rascunho: AtendimentoPresencialDTO
    payload: AutosavePayload
    sincronizado: boolean
  }) {
    if (!mountedRef.current) return
    setAtivo(params.rascunho)
    setErro(null)
    salvarCacheLocalRascunho({
      rascunho: params.rascunho,
      payload: params.payload,
      version: params.rascunho.version,
      sincronizado: params.sincronizado,
    })
  }

  function criarFilaAutosave(rascunho: AtendimentoPresencialDTO, payloadSalvoSerializado: string) {
    autosaveQueueRef.current?.stop()
    autosaveQueueRef.current = new AutosaveSerialQueue({
      draftId: rascunho.draftClientId,
      initialVersion: rascunho.version,
      initialRascunho: rascunho,
      initialSavedPayload: payloadSalvoSerializado,
      save: async ({ payload, expectedVersion }): Promise<AutosaveSaveResult> => {
        const response = await fetch(`/api/atendimento-presencial/atendimentos/${rascunho.id}/rascunho`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            version: expectedVersion,
            dadosRascunho: payload.dadosRascunho,
            clienteId: payload.clienteId,
          }),
        })
        const data = (await response.json()) as ApiRascunhoResponse
        if (!response.ok || !data.ok || !data.rascunho) {
          return {
            ok: false,
            status: response.status,
            message: data.message ?? 'Erro ao salvar',
            rascunho: data.rascunho ?? null,
          }
        }
        return { ok: true, rascunho: data.rascunho }
      },
      onStatus: (status) => {
        if (mountedRef.current) setStatusSync(status)
      },
      onSaved: ({ payload, rascunho: rascunhoSalvo }) => {
        aplicarRascunhoSalvo({ rascunho: rascunhoSalvo, payload, sincronizado: true })
      },
      onConflict: ({ payload, servidor, payloadIgual }) => {
        if (!mountedRef.current) return
        salvarCacheLocalRascunho({ rascunho: servidor ?? rascunho, payload, sincronizado: false })
        if (!payloadIgual) setErro('Conflito de versao. Recarregue o rascunho para comparar com a versao do servidor.')
      },
      onLog: (message) => console.log(message),
      getOnline: () => navigator.onLine,
    })
  }

  function aplicarRascunho(rascunho: AtendimentoPresencialDTO) {
    setAtivo(rascunho)
    setUnidadeId(rascunho.unidadeId)
    const cache = carregarCacheRascunho(window.localStorage, usuarioId, rascunho.draftClientId)
    const usarCache = cache?.sincronizado === false && (cache.version ?? 0) >= rascunho.version
    const dados = usarCache ? cache.dadosRascunho : rascunho.dadosRascunho
    const payload = migrarFichaDadosRascunho(dados)
    if (payload.criancas.length === 0) {
      payload.criancas = [criarCriancaRascunho(gerarIdLocal('crianca'))]
    }
    const payloadServidor = {
      dadosRascunho: migrarFichaDadosRascunho(rascunho.dadosRascunho),
      clienteId: rascunho.clienteId,
    }
    const payloadAtual = {
      dadosRascunho: payload,
      clienteId: usarCache ? rascunho.clienteId : rascunho.clienteId,
    }
    criarFilaAutosave(rascunho, serializarPayloadAutosave(payloadServidor))
    setFicha(payload)
    setDataPrevistaInputs(Object.fromEntries(payload.criancas.map((crianca) => [crianca.id, formatarDataISOParaInput(crianca.dataPrevistaNascimento)])))
    setViradaCartaoInput(formatarViradaCartao(payload.viradaCartaoDia, payload.viradaCartaoMes))
    setErrosValidacao([])
    setErroEtapa(null)
    if (usarCache) salvarCacheLocalRascunho({ rascunho, payload: payloadAtual, sincronizado: false, version: rascunho.version })
    setStatusSync(usarCache ? 'offline' : 'salvo')
    setNumeroLancamento('')
    setMensagemConclusao(null)
    void carregarClientePorId(rascunho.clienteId)
  }

  async function aplicarRascunhoCriado(rascunho: AtendimentoPresencialDTO) {
    setAtivo(rascunho)
    setUnidadeId(rascunho.unidadeId)

    const payloadServidor: AutosavePayload = {
      dadosRascunho: migrarFichaDadosRascunho(rascunho.dadosRascunho),
      clienteId: rascunho.clienteId,
    }
    criarFilaAutosave(rascunho, serializarPayloadAutosave(payloadServidor))

    setErroCriacao(null)
    setMensagemConclusao(null)
    setErroEtapa(null)
    setErrosValidacao([])

    const fila = autosaveQueueRef.current
    let dadosRascunhoFinais = payloadServidor.dadosRascunho
    if (fila) {
      const payloadAtual = montarPayloadAutosave()
      if (serializarPayloadAutosave(payloadAtual) !== serializarPayloadAutosave(payloadServidor)) {
        const resultado = await fila.flushNow(payloadAtual)
        if (resultado.ok && resultado.rascunho) {
          dadosRascunhoFinais = migrarFichaDadosRascunho(resultado.rascunho.dadosRascunho)
        } else {
          dadosRascunhoFinais = payloadAtual.dadosRascunho
        }
      }
    }

    const consultoraNomeAtual = fichaRef.current.consultoraNome
    setFicha({
      ...dadosRascunhoFinais,
      consultoraNome: consultoraNomeAtual ?? dadosRascunhoFinais.consultoraNome,
    })
    setDataPrevistaInputs(Object.fromEntries(dadosRascunhoFinais.criancas.map((crianca) => [crianca.id, formatarDataISOParaInput(crianca.dataPrevistaNascimento)])))
    setViradaCartaoInput(formatarViradaCartao(dadosRascunhoFinais.viradaCartaoDia, dadosRascunhoFinais.viradaCartaoMes))
  }

  async function iniciarRascunho(draftClientId?: string) {
    if (!contexto || !podeCriarRascunho) {
      return
    }
    setIniciando(true)
    setErroCriacao(null)

    const draftClientIdFinal = draftClientId || draftClientIdRef.current || gerarIdLocal('draft')
    if (!draftClientIdRef.current) draftClientIdRef.current = draftClientIdFinal

    const unidadeFinal = unidadeId || unidadesParaSelecao[0]?.id
    const consultoraNomeFinal = normalizarNomeConsultora(ficha.consultoraNome)
    const clienteIdFinal = clienteSelecionada?.id ?? null

    const dadosRascunhoEnviados: FichaDadosRascunho = {
      ...ficha,
      consultoraNome: consultoraNomeFinal,
    }
    const payloadEnviado: AutosavePayload = {
      dadosRascunho: migrarFichaDadosRascunho(dadosRascunhoEnviados),
      clienteId: clienteIdFinal,
    }

    try {
      const response = await fetch('/api/atendimento-presencial/atendimentos/rascunhos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          draftClientId: draftClientIdFinal,
          unidadeId: unidadeFinal,
          dadosRascunho: payloadEnviado.dadosRascunho,
          clienteId: clienteIdFinal,
        }),
      })
      const data = (await response.json()) as ApiRascunhoResponse
      if (!response.ok || !data.ok || !data.rascunho) {
        throw new Error(data.message ?? 'Erro ao criar rascunho')
      }

      await aplicarRascunhoCriado(data.rascunho)
    } catch (error) {
      setErroCriacao(error instanceof Error ? error.message : 'Erro ao criar rascunho')
    } finally {
      setIniciando(false)
    }
  }

  function atualizarTelefoneCliente(valor: string) {
    const telefone = aplicarMascaraTelefoneBR(valor)
    setErroTelefone(null)

    if (!clienteSelecionada) {
      setNovoCliente((atual) => ({ ...atual, telefone }))
      return
    }

    const cliente = clienteSelecionada
    setTelefoneClienteEdicao(telefone)
    setClienteSelecionada((atual) => atual ? {
      ...atual,
      telefone: telefone || null,
      telefoneFormatado: telefone || null,
    } : atual)

    if (telefoneDebounceRef.current) clearTimeout(telefoneDebounceRef.current)
    const requestId = telefoneRequestRef.current + 1
    telefoneRequestRef.current = requestId
    telefoneDebounceRef.current = setTimeout(() => {
      void salvarTelefoneCliente(cliente, telefone, requestId)
    }, 800)
  }

  async function salvarTelefoneCliente(cliente: ClientePresencialDTO, telefone: string, requestId: number) {
    setSalvandoTelefone(true)
    try {
      const response = await fetch(`/api/atendimento-presencial/clientes/${cliente.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telefone: telefone || null,
          version: cliente.version,
        }),
      })
      const data = (await response.json()) as ApiClientesResponse
      if (requestId !== telefoneRequestRef.current) return
      if (!response.ok || !data.ok || !data.cliente) {
        throw new Error(data.message ?? 'Erro ao atualizar telefone')
      }
      setClienteSelecionada(data.cliente)
      setTelefoneClienteEdicao(data.cliente.telefoneFormatado ?? '')
    } catch (error) {
      if (requestId === telefoneRequestRef.current) {
        setErroTelefone(error instanceof Error ? error.message : 'Erro ao atualizar telefone')
      }
    } finally {
      if (requestId === telefoneRequestRef.current) setSalvandoTelefone(false)
    }
  }

  async function buscarClientes() {
    const termo = buscaCliente.trim()
    if (termo.length < 2) {
      setClientesEncontradas([])
      return
    }
    setBuscandoCliente(true)
    setErro(null)
    try {
      const response = await fetch(`/api/atendimento-presencial/clientes?q=${encodeURIComponent(termo)}&limit=10`, { cache: 'no-store' })
      const data = (await response.json()) as ApiClientesResponse
      if (!response.ok || !data.ok) throw new Error(data.message ?? 'Erro ao buscar clientes')
      setClientesEncontradas(data.clientes ?? [])
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Erro ao buscar clientes')
    } finally {
      setBuscandoCliente(false)
    }
  }

  function selecionarCliente(cliente: ClientePresencialDTO) {
    setClienteSelecionada(cliente)
    setBuscaCliente('')
    setClientesEncontradas([])
    atualizarFicha((atual) => ({
      ...atual,
      cliente: {
        parentesco: cliente.parentesco,
        parentescoOutro: cliente.parentescoOutro ?? undefined,
      },
    }))
  }

  async function cadastrarCliente() {
    if (!novoCliente.parentesco) {
      setErroEtapa('Selecione o parentesco da cliente.')
      return
    }
    setErroEtapa(null)
    setErro(null)
    try {
      const response = await fetch('/api/atendimento-presencial/clientes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(novoCliente),
      })
      const data = (await response.json()) as ApiClientesResponse
      if (!response.ok || !data.ok || !data.cliente) throw new Error(data.message ?? 'Erro ao cadastrar cliente')
      selecionarCliente(data.cliente)
      setNovoCliente({ nome: '', telefone: '', parentesco: '', parentescoOutro: '' })
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Erro ao cadastrar cliente')
    }
  }

  function trocarCliente() {
    setClienteSelecionada(null)
    setHistoricoAberto(false)
    atualizarFicha((atual) => ({ ...atual, cliente: undefined }))
  }

  async function recarregarRascunhoDoServidor() {
    if (!ativo) return
    setErro(null)
    try {
      const response = await fetch(`/api/atendimento-presencial/atendimentos/${ativo.id}/rascunho`, { cache: 'no-store' })
      const data = (await response.json()) as ApiRascunhoResponse
      if (!response.ok || !data.ok || !data.rascunho) throw new Error(data.message ?? 'Erro ao recarregar rascunho')
      aplicarRascunho(data.rascunho)
      setStatusSync('salvo')
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Erro ao recarregar rascunho')
    }
  }

  function irParaEtapa(etapa: FichaEtapa) {
    setErroEtapa(null)
    setErrosValidacao([])
    atualizarFicha((atual) => ({ ...atual, etapaAtual: etapa }))
  }

  function scrollParaErro(erro: ErroValidacaoFicha) {
    const section = document.getElementById(erro.sectionId)
    section?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    if (!erro.fieldId) return
    const fieldId = erro.fieldId
    window.setTimeout(() => {
      const field = document.getElementById(fieldId)
      if (field instanceof HTMLElement) field.focus()
    }, 250)
  }

  function etapaParaErro(erro: ErroValidacaoFicha): FichaEtapa {
    if (erro.sectionId.includes('resultado')) return 'resultado'
    if (erro.sectionId.includes('revisao')) return 'revisao'
    return 'ficha'
  }

  function navegarParaErro(erro: ErroValidacaoFicha) {
    const etapaErro = etapaParaErro(erro)
    if (etapaErro !== etapaAtual) {
      setFicha((atual) => ({ ...atual, etapaAtual: etapaErro }))
      window.setTimeout(() => scrollParaErro(erro), 80)
      return
    }
    scrollParaErro(erro)
  }

  function registrarErrosValidacao(erros: ErroValidacaoFicha[]) {
    setErrosValidacao(erros)
    setErroEtapa(erros.length === 1 ? erros[0].message : 'Revise os campos destacados antes de continuar.')
    if (erros[0]) navegarParaErro(erros[0])
  }

  function erroSecao(sectionId: string) {
    return primeiroErroPorSecao(errosValidacao, sectionId)
  }

  function avancar() {
    if (!ativo) {
      setErroEtapa('Rascunho nao criado. Preencha filial e consultora para iniciar o atendimento.')
      return
    }
    const erros = validarEtapa({ etapa: etapaAtual, ficha, clienteSelecionada })
    if (erros.length > 0) {
      registrarErrosValidacao(erros)
      return
    }
    setErroEtapa(null)
    setErrosValidacao([])
    irParaEtapa(proximaEtapa(etapaAtual))
  }

  function voltar() {
    setErroEtapa(null)
    setErrosValidacao([])
    irParaEtapa(etapaAnterior(etapaAtual))
  }

  function adicionarCrianca() {
    const crianca = criarCriancaRascunho(gerarIdLocal('crianca'))
    atualizarFicha((atual) => ({
      ...atual,
      criancas: [...atual.criancas, crianca],
    }))
  }

  function atualizarCrianca(id: string, patch: Partial<FichaCriancaRascunho>) {
    atualizarFicha((atual) => ({
      ...atual,
      criancas: atual.criancas.map((crianca) => crianca.id === id ? { ...crianca, ...patch } : crianca),
    }))
  }

  function removerCrianca(id: string) {
    atualizarFicha((atual) => ({
      ...atual,
      criancas: atual.criancas.filter((crianca) => crianca.id !== id),
    }))
    setDataPrevistaInputs((atual) => {
      const proximo = { ...atual }
      delete proximo[id]
      return proximo
    })
  }

  function atualizarDataPrevistaCrianca(id: string, valor: string) {
    const formatada = formatarDataPrevistaInput(valor)
    const dataISO = converterDataInputParaISO(formatada)
    setDataPrevistaInputs((atual) => ({ ...atual, [id]: formatada }))
    atualizarCrianca(id, { dataPrevistaNascimento: dataISO || undefined })
  }

  function atualizarNomeCrianca(id: string, valor: string) {
    atualizarCrianca(id, { nome: limparNomeCriancaDigitacao(valor), nomeNaoInformado: false })
  }

  function marcarNomeNaoInformado(id: string) {
    atualizarCrianca(id, { nome: undefined, nomeNaoInformado: true })
  }

  function atualizarViradaCartao(valor: string) {
    const formatada = formatarViradaCartaoInput(valor)
    const convertida = converterViradaCartaoInput(formatada)
    setViradaCartaoInput(formatada)
    atualizarFicha((atual) => ({
      ...atual,
      viradaCartaoDia: convertida?.dia,
      viradaCartaoMes: convertida?.mes,
    }))
  }

  function alternarDepartamento(chave: DepartamentoInteresse) {
    atualizarFicha((atual) => {
      const selecionado = atual.departamentos.includes(chave)
      return {
        ...atual,
        departamentos: selecionado
          ? atual.departamentos.filter((item) => item !== chave)
          : [...atual.departamentos, chave],
      }
    })
  }

  function adicionarProduto() {
    const produto = normalizarProduto(produtoDigitado)
    if (!produto) return
    atualizarFicha((atual) => {
      const jaExiste = atual.produtosInteresse.some((item) => item.toLocaleLowerCase('pt-BR') === produto.toLocaleLowerCase('pt-BR'))
      if (jaExiste || atual.produtosInteresse.length >= FICHA_PRODUTOS_MAX_ITENS) return atual
      return { ...atual, produtosInteresse: [...atual.produtosInteresse, produto] }
    })
    setProdutoDigitado('')
  }

  function alternarMotivo(chave: MotivoResultado) {
    atualizarFicha((atual) => {
      const selecionado = atual.motivosResultado.includes(chave)
      const motivosResultado = selecionado
        ? atual.motivosResultado.filter((item) => item !== chave)
        : [...atual.motivosResultado, chave]
      if (selecionado && chave === 'virada_cartao') setViradaCartaoInput('')
      return {
        ...atual,
        motivosResultado,
        motivoOutro: selecionado && chave === 'outro' ? undefined : atual.motivoOutro,
        viradaCartaoDia: selecionado && chave === 'virada_cartao' ? undefined : atual.viradaCartaoDia,
        viradaCartaoMes: selecionado && chave === 'virada_cartao' ? undefined : atual.viradaCartaoMes,
      }
    })
  }

  function erroConclusaoParaSecao(field: string | undefined, message: string): ErroValidacaoFicha {
    if (field === 'consultoraNome') return { sectionId: 'secao-consultora-nome', fieldId: 'consultora-nome', message }
    if (field === 'clienteId') return { sectionId: 'secao-cliente', fieldId: 'busca-cliente', message }
    if (field === 'criancas') return { sectionId: 'secao-crianca', message }
    if (field === 'departamentos') return { sectionId: 'secao-departamentos', message }
    if (field === 'resultadoAtendimento') return { sectionId: 'secao-resultado-fechamento', message }
    if (field === 'motivosResultado') return { sectionId: 'secao-resultado-produto', message }
    if (field === 'motivoOutro') return { sectionId: 'secao-resultado-outro', fieldId: 'motivo-outro', message }
    if (field === 'viradaCartao') return { sectionId: 'secao-resultado-condicao', fieldId: 'virada-cartao', message }
    if (field === 'numeroLancamento') return { sectionId: 'secao-revisao-lancamento', fieldId: 'numero-lancamento', message }
    return { sectionId: etapaAtual === 'revisao' ? 'secao-revisao' : `secao-${etapaAtual}`, message }
  }

  async function garantirRascunhoSalvoAntesDeConcluir() {
    if (!ativo || !autosaveQueueRef.current) return null
    const fila = autosaveQueueRef.current
    const payload = montarPayloadAutosave()
    fila.cancelDebounce()
    salvarCacheLocalRascunho({ rascunho: ativo, payload, sincronizado: false })
    console.log(`[AUTOSAVE] conclusao aguardando autosave draft=${ativo.draftClientId.slice(0, 8)}`)
    const resultado = await fila.flushNow(payload)
    if (!resultado.ok) {
      if (resultado.status === 'conflito') {
        throw new Error('Conflito de versao. Recarregue o rascunho antes de concluir.')
      }
      if (resultado.status === 'offline') {
        throw new Error('Sem conexao. Sincronize o rascunho antes de concluir.')
      }
      throw new Error(resultado.message)
    }
    return resultado.rascunho
  }

  async function novoAtendimento() {
    if (novoAtendimentoRef.current || iniciando || concluindo) return
    novoAtendimentoRef.current = true
    setIniciandoNovoAtendimento(true)
    setErro(null)
    setErroEtapa(null)
    try {
      if (ativo && autosaveQueueRef.current) {
        const salvo = await garantirRascunhoSalvoAntesDeConcluir()
        if (!salvo) throw new Error('Rascunho nao encontrado')
      }
      autosaveQueueRef.current?.stop()
      autosaveQueueRef.current = null
      setAtivo(null)
      setFicha(criarPayloadInicial())
      setClienteSelecionada(null)
      setBuscaCliente('')
      setClientesEncontradas([])
      setNovoCliente({
        nome: '',
        telefone: '',
        parentesco: '' as ParentescoCliente | '',
        parentescoOutro: '',
      })
      setTelefoneClienteEdicao('')
      setErroTelefone(null)
      setDataPrevistaInputs({})
      setViradaCartaoInput('')
      setErrosValidacao([])
      setErroEtapa(null)
      setErro(null)
      setErroCriacao(null)
      setProdutoDigitado('')
      setNumeroLancamento('')
      setStatusSync('ocioso')
      setMensagemConclusao(null)
      setErroRascunhoInicial(null)
      setCarregandoRascunhoInicial(false)
      telefoneClienteSincronizadoRef.current = ''
      draftClientIdRef.current = null
      tentativaUnidadeRef.current = ''
      tentativaNomeRef.current = ''

      if (unidadesParaSelecao.length === 1) {
        setUnidadeId(unidadesParaSelecao[0].id)
      } else {
        setUnidadeId('')
      }

      if (typeof window !== 'undefined' && window.location.search) {
        void router.replace('/atendimento-presencial/ficha', { scroll: false })
      }
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Erro ao salvar rascunho atual')
    } finally {
      novoAtendimentoRef.current = false
      setIniciandoNovoAtendimento(false)
    }
  }

  async function verRascunhos() {
    if (ativo && autosaveQueueRef.current) {
      const payload = montarPayloadAutosave()
      autosaveQueueRef.current.cancelDebounce()
      try {
        await autosaveQueueRef.current.flushNow(payload)
      } catch {
        // segue navegacao mesmo se falhar
      }
    }
    router.push('/atendimento-presencial/registros?tab=rascunhos')
  }

  async function concluirAtendimento() {
    if (!ativo || concluindoRef.current) return
    concluindoRef.current = true
    const validacao = validarFichaParaConclusao({
      ficha,
      clienteId: clienteSelecionada?.id ?? null,
      numeroLancamento,
    })
    if (!validacao.ok) {
      const erroValidacao = erroConclusaoParaSecao(validacao.field, validacao.message)
      registrarErrosValidacao([erroValidacao])
      concluindoRef.current = false
      return
    }

    setConcluindo(true)
    setErro(null)
    setErroEtapa(null)
    setMensagemConclusao(null)
    try {
      const rascunhoSalvo = await garantirRascunhoSalvoAntesDeConcluir()
      if (!rascunhoSalvo) throw new Error('Rascunho nao encontrado')
      const consultoraNomeNormalizado = normalizarNomeConsultora(ficha.consultoraNome)
      atualizarFicha((atual) => ({ ...atual, consultoraNome: consultoraNomeNormalizado }))
      const response = await fetch(`/api/atendimento-presencial/atendimentos/${rascunhoSalvo.id}/concluir`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          version: rascunhoSalvo.version,
          numeroLancamento: validacao.numeroLancamento,
          consultoraNome: consultoraNomeNormalizado,
        }),
      })
      const data = (await response.json()) as ApiConcluirResponse
      if (!response.ok || !data.ok || !data.atendimento) {
        throw new Error(data.message ?? 'Erro ao concluir atendimento')
      }

      removerCacheRascunho(window.localStorage, usuarioId, rascunhoSalvo.draftClientId)
      autosaveQueueRef.current?.stop()
      autosaveQueueRef.current = null
      setAtivo(null)
      setFicha(criarPayloadInicial())
      setClienteSelecionada(null)
      setBuscaCliente('')
      setClientesEncontradas([])
      setDataPrevistaInputs({})
      setViradaCartaoInput('')
      setErrosValidacao([])
      setProdutoDigitado('')
      setNumeroLancamento('')
      setStatusSync('ocioso')
      setMensagemConclusao('Atendimento concluido e salvo nos registros.')
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Erro ao concluir atendimento')
    } finally {
      concluindoRef.current = false
      autosaveQueueRef.current?.resume()
      setConcluindo(false)
    }
  }

  useEffect(() => {
    const fila = autosaveQueueRef.current
    if (!ativo || !fila) return
    const payload: AutosavePayload = {
      dadosRascunho: migrarFichaDadosRascunho(ficha),
      clienteId: clienteSelecionada?.id ?? null,
    }
    const payloadSerializado = serializarPayloadAutosave(payload)
    const sincronizado = payloadSerializado === fila.getLastSavedPayload()
    salvarCacheRascunho(window.localStorage, {
      draftClientId: ativo.draftClientId,
      usuarioId,
      atendimentoId: ativo.id,
      version: fila.getVersion(),
      dadosRascunho: payload.dadosRascunho,
      atualizadoEm: new Date().toISOString(),
      sincronizado,
    })

    if (concluindoRef.current) return
    if (sincronizado) {
      setStatusSync('salvo')
      return
    }

    setStatusSync(navigator.onLine ? 'alterado' : 'offline')
    fila.enqueue(payload)
  }, [ativo, clienteSelecionada?.id, ficha, onlineTick, usuarioId])

  const unidadeAtual = contexto?.unidadesPermitidas.find((unidade) => unidade.id === unidadeId)

  return (
    <main className="min-h-screen bg-slate-50 px-3 pb-28 pt-5 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-3xl flex-col gap-5">
        <header className="flex flex-col gap-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Atendimento presencial</p>
              <h1 className="mt-1 text-2xl font-semibold text-slate-950">Ficha de Atendimento</h1>
            </div>
            <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                variant="outline"
                onClick={novoAtendimento}
                disabled={iniciandoNovoAtendimento || iniciando || concluindo || carregandoRascunhoInicial}
                className="h-10 w-full shrink-0 rounded-md sm:w-auto"
              >
                <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
                {iniciandoNovoAtendimento ? 'Salvando...' : 'Novo Atendimento'}
              </Button>
              <Button type="button" variant="outline" onClick={verRascunhos} className="h-10 shrink-0 rounded-md">
                <ClipboardList className="mr-2 h-4 w-4" aria-hidden="true" />
                Ver rascunhos
              </Button>
            </div>
          </div>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-700">Etapa {etapaNumero} de {FICHA_TOTAL_ETAPAS}</p>
              <p className="text-sm text-slate-500">{etapaLabelAtual}</p>
            </div>
            <StatusSync status={statusSync} />
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-200" aria-hidden="true">
            <div className="h-full rounded-full bg-sky-600" style={{ width: `${(etapaNumero / FICHA_TOTAL_ETAPAS) * 100}%` }} />
          </div>
        </header>

        {(erro || erroCriacao) && (
          <div className="grid gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            <p>{erro ?? erroCriacao}</p>
            {erroCriacao && !iniciando && (
              <Button type="button" variant="outline" onClick={() => void iniciarRascunho(draftClientIdRef.current ?? undefined)} className="h-10 justify-self-start rounded-md bg-white">
                <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
                Tentar novamente
              </Button>
            )}
            {statusSync === 'conflito' && (
              <Button type="button" variant="outline" onClick={recarregarRascunhoDoServidor} className="h-10 justify-self-start rounded-md bg-white">
                <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
                Recarregar versao do servidor
              </Button>
            )}
          </div>
        )}
        {erroEtapa && <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">{erroEtapa}</p>}
        {mensagemConclusao && <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{mensagemConclusao}</p>}

        {carregandoRascunhoInicial && (
          <section className="grid gap-4 rounded-lg border border-slate-200 bg-white p-6 text-center shadow-sm">
            <p className="text-sm font-semibold text-slate-700">Carregando rascunho...</p>
          </section>
        )}

        {erroRascunhoInicial && (
          <section className="grid gap-4 rounded-lg border border-red-200 bg-red-50 p-4 shadow-sm sm:p-6">
            <p className="text-sm text-red-700">{erroRascunhoInicial}</p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={() => void novoAtendimento()} className="h-10 rounded-md bg-white">
                Novo atendimento
              </Button>
              <Button type="button" variant="outline" onClick={() => void verRascunhos()} className="h-10 rounded-md bg-white">
                Ver rascunhos
              </Button>
            </div>
          </section>
        )}

        {(etapaAtual === 'ficha' || ativo) && !carregandoRascunhoInicial && !erroRascunhoInicial && (
          <section className="grid gap-5 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
            {etapaAtual === 'ficha' && (
              <SecaoFicha
                id="secao-unidade"
                titulo="Unidade"
                descricao={!ativo ? 'Selecione a unidade do atendimento.' : 'Unidade do atendimento. Para alterar, use o botao Novo atendimento.'}
                icon={ClipboardList}
                variant="azul"
              >
                <div className="grid gap-2">
                  {unidadesParaSelecao.map((unidade) => (
                    <OpcaoButton
                      key={unidade.id}
                      selected={unidadeAtual?.id === unidade.id}
                      onClick={() => {
                        if (!ativo && !iniciando) setUnidadeId(unidade.id)
                      }}
                      disabled={!!ativo || iniciando}
                    >
                      {unidade.nome}
                    </OpcaoButton>
                  ))}
                </div>
                {iniciando && !ativo && (
                  <p className="text-sm font-semibold text-sky-700">Criando rascunho...</p>
                )}
              </SecaoFicha>
            )}

            {etapaAtual === 'ficha' && (
              <SecaoFicha
                id="secao-consultora-nome"
                titulo="Nome da consultora"
                descricao="Informe o nome da consultora responsavel pelo atendimento."
                icon={UserRound}
                variant="azul"
                erro={erroSecao('secao-consultora-nome')}
              >
                <label className="text-sm font-semibold text-slate-700">
                  Nome da consultora
                  <input
                    id="consultora-nome"
                    value={ficha.consultoraNome ?? ''}
                    onChange={(event) => atualizarFicha((atual) => ({ ...atual, consultoraNome: event.target.value }))}
                    onBlur={(event) => atualizarFicha((atual) => ({ ...atual, consultoraNome: normalizarNomeConsultora(event.target.value) }))}
                    className="mt-2 min-h-12 w-full rounded-md border border-slate-200 px-3 text-base outline-none focus:border-sky-500"
                    maxLength={FICHA_CONSULTORA_NOME_MAX_CHARS}
                    placeholder="Digite o nome da consultora"
                  />
                </label>
              </SecaoFicha>
            )}

            {etapaAtual === 'ficha' && (
              <SecaoFicha
                id="secao-cliente"
                titulo="Cliente"
                descricao={!clienteSelecionada ? 'Busque por nome ou telefone, ou cadastre uma nova cliente.' : undefined}
                icon={UserRound}
                variant="azul"
                erro={erroSecao('secao-cliente')}
              >
                {clienteSelecionada && (
                  <div className="rounded-lg border border-sky-200 bg-sky-50 p-4">
                    <p className="text-xs font-bold uppercase text-sky-700">Cliente vinculada</p>
                    <p className="mt-2 text-base font-semibold text-slate-950">{clienteSelecionada.nome}</p>
                    {clienteSelecionada.telefoneFormatado && <p className="text-sm text-slate-700">{clienteSelecionada.telefoneFormatado}</p>}
                    <p className="text-sm text-slate-700">{clienteSelecionada.parentescoLabel}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button type="button" variant="outline" onClick={trocarCliente} className="h-10 rounded-md">
                        Trocar cliente
                      </Button>
                      <Button type="button" variant="outline" onClick={() => setHistoricoAberto(true)} className="h-10 rounded-md">
                        <History className="mr-2 h-4 w-4" aria-hidden="true" />
                        Ver historico
                      </Button>
                    </div>
                  </div>
                )}

                {!clienteSelecionada && (
                  <>
                    <div>
                      <label className="text-sm font-semibold text-slate-700" htmlFor="busca-cliente">Buscar por nome ou telefone</label>
                      <div className="mt-2 flex gap-2">
                        <input
                          id="busca-cliente"
                          value={buscaCliente}
                          onChange={(event) => setBuscaCliente(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                              event.preventDefault()
                              void buscarClientes()
                            }
                          }}
                          className="min-h-12 flex-1 rounded-md border border-slate-200 px-3 text-base outline-none focus:border-sky-500"
                          placeholder="Nome ou telefone"
                        />
                        <Button type="button" onClick={buscarClientes} disabled={buscandoCliente} className="h-12 rounded-md">
                          <Search className="h-4 w-4" aria-hidden="true" />
                        </Button>
                      </div>
                    </div>

                    {clientesEncontradas.length > 0 && (
                      <div className="grid gap-2">
                        {clientesEncontradas.map((cliente) => (
                          <button
                            key={cliente.id}
                            type="button"
                            onClick={() => selecionarCliente(cliente)}
                            className="rounded-md border border-slate-200 bg-white p-4 text-left outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                          >
                            <p className="font-semibold text-slate-950">{cliente.nome}</p>
                            <p className="text-sm text-slate-600">{cliente.telefoneFormatado ?? 'Sem telefone'}</p>
                            <p className="text-sm text-slate-600">{cliente.parentescoLabel}</p>
                          </button>
                        ))}
                      </div>
                    )}

                    <div className="rounded-lg border border-slate-200 p-4">
                      <h3 className="text-base font-semibold text-slate-950">Nova cliente</h3>
                      <div className="mt-4 grid gap-4">
                        <label className="text-sm font-semibold text-slate-700">
                          Nome
                          <input
                            value={novoCliente.nome}
                            onChange={(event) => setNovoCliente((atual) => ({ ...atual, nome: event.target.value }))}
                            className="mt-2 min-h-12 w-full rounded-md border border-slate-200 px-3 text-base outline-none focus:border-sky-500"
                            maxLength={120}
                          />
                        </label>
                        <label className="text-sm font-semibold text-slate-700">
                          Telefone opcional
                          <input
                            value={novoCliente.telefone}
                            onChange={(event) => atualizarTelefoneCliente(event.target.value)}
                            className="mt-2 min-h-12 w-full rounded-md border border-slate-200 px-3 text-base outline-none focus:border-sky-500"
                            inputMode="tel"
                            placeholder="(41) 99999-9999"
                          />
                        </label>
                        <div>
                          <p className="text-sm font-semibold text-slate-700">Parentesco</p>
                          <div className="mt-2 grid grid-cols-2 gap-2">
                            {PARENTESCOS_CLIENTE.map((item) => (
                              <OpcaoButton
                                key={item.chave}
                                selected={novoCliente.parentesco === item.chave}
                                onClick={() => setNovoCliente((atual) => ({ ...atual, parentesco: item.chave }))}
                              >
                                {item.label}
                              </OpcaoButton>
                            ))}
                          </div>
                        </div>
                        {novoCliente.parentesco === 'outro' && (
                          <label className="text-sm font-semibold text-slate-700">
                            Complemento
                            <input
                              value={novoCliente.parentescoOutro}
                              onChange={(event) => setNovoCliente((atual) => ({ ...atual, parentescoOutro: event.target.value }))}
                              className="mt-2 min-h-12 w-full rounded-md border border-slate-200 px-3 text-base outline-none focus:border-sky-500"
                              maxLength={60}
                            />
                          </label>
                        )}
                        <Button type="button" onClick={cadastrarCliente} className="h-12 rounded-md">
                          Cadastrar e vincular
                        </Button>
                      </div>
                    </div>
                  </>
                )}
              </SecaoFicha>
            )}

            {etapaAtual === 'ficha' && (
              <SecaoFicha
                id="secao-crianca"
                titulo="Dados da crianca"
                descricao="Registre uma ou mais criancas quando a cliente informar."
                icon={Baby}
                variant="rosa"
                erro={erroSecao('secao-crianca')}
              >
                {ficha.criancas.map((crianca, index) => (
                  <div key={crianca.id} className="rounded-lg border border-slate-200 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="font-semibold text-slate-950">Crianca {index + 1}</h3>
                      {ficha.criancas.length > 1 && (
                        <Button type="button" variant="outline" onClick={() => removerCrianca(crianca.id)} className="h-9 rounded-md">
                          <X className="h-4 w-4" aria-hidden="true" />
                        </Button>
                      )}
                    </div>
                    <div className="mt-4 grid gap-4">
                      <div>
                        <label className="text-sm font-semibold text-slate-700" htmlFor={`situacao-${crianca.id}`}>Situacao</label>
                        <Select
                          value={crianca.situacao}
                          onValueChange={(value) => {
                            setDataPrevistaInputs((atual) => ({ ...atual, [crianca.id]: '' }))
                            atualizarCrianca(crianca.id, { situacao: value as SituacaoCrianca, idadeUnidade: undefined, idadeValor: undefined, dataPrevistaNascimento: undefined })
                          }}
                        >
                          <SelectTrigger id={`situacao-${crianca.id}`} className="mt-2 min-h-12 w-full rounded-md border border-slate-200 text-base">
                            <SelectValue placeholder="Selecione a situacao" />
                          </SelectTrigger>
                          <SelectContent position="popper" className="max-h-60">
                            {SITUACOES_CRIANCA.map((item) => (
                              <SelectItem key={item.chave} value={item.chave}>
                                {item.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      {(crianca.situacao === 'gestacao' || crianca.situacao === 'presente_outra_pessoa') && (
                        <label className="text-sm font-semibold text-slate-700">
                          Data prevista de nascimento
                          <input
                            id={`data-prevista-${crianca.id}`}
                            type="text"
                            inputMode="numeric"
                            placeholder="DD/MM/AAAA"
                            value={dataPrevistaInputs[crianca.id] ?? formatarDataISOParaInput(crianca.dataPrevistaNascimento)}
                            onChange={(event) => atualizarDataPrevistaCrianca(crianca.id, event.target.value)}
                            className="mt-2 min-h-12 w-full rounded-md border border-slate-200 px-3 text-base outline-none focus:border-sky-500"
                          />
                        </label>
                      )}
                      {crianca.situacao === 'ja_nasceu' && (
                        <div className="grid gap-3">
                          <p className="text-sm font-semibold text-slate-700">Idade</p>
                          <div className="grid grid-cols-2 gap-2">
                            {(['meses', 'anos'] as UnidadeIdadeCrianca[]).map((unidade) => (
                              <OpcaoButton key={unidade} selected={crianca.idadeUnidade === unidade} onClick={() => atualizarCrianca(crianca.id, { idadeUnidade: unidade, idadeValor: undefined })}>
                                {unidade === 'meses' ? 'Meses' : 'Anos'}
                              </OpcaoButton>
                            ))}
                          </div>
                          {crianca.idadeUnidade && (
                            <div className="grid grid-cols-4 gap-2">
                              {Array.from({ length: crianca.idadeUnidade === 'meses' ? 11 : 6 }, (_, i) => i + 1).map((valor) => (
                                <OpcaoButton key={valor} selected={crianca.idadeValor === valor} onClick={() => atualizarCrianca(crianca.id, { idadeValor: valor })} className="text-center">
                                  {valor}
                                </OpcaoButton>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                      <label className="text-sm font-semibold text-slate-700">
                        Nome da crianca
                        <input
                          id={`nome-crianca-${crianca.id}`}
                          value={crianca.nome ?? ''}
                          disabled={crianca.nomeNaoInformado}
                          onChange={(event) => atualizarNomeCrianca(crianca.id, event.target.value)}
                          className="mt-2 min-h-12 w-full rounded-md border border-slate-200 px-3 text-base outline-none focus:border-sky-500 disabled:bg-slate-100"
                          maxLength={80}
                        />
                      </label>
                      <label className="flex min-h-11 items-center gap-3 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700">
                        <input
                          type="checkbox"
                          checked={crianca.nomeNaoInformado === true}
                          onChange={(event) => {
                            if (event.target.checked) marcarNomeNaoInformado(crianca.id)
                            else atualizarCrianca(crianca.id, { nomeNaoInformado: false })
                          }}
                          className="h-4 w-4"
                        />
                        Nao sabe o nome ainda
                      </label>
                      <div>
                        <p className="text-sm font-semibold text-slate-700">Sexo</p>
                        <div className="mt-2 grid gap-2">
                          {SEXOS_CRIANCA.map((item) => (
                            <OpcaoButton key={item.chave} selected={crianca.sexo === item.chave} onClick={() => atualizarCrianca(crianca.id, { sexo: item.chave as SexoCrianca })}>
                              {item.label}
                            </OpcaoButton>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                <Button type="button" variant="outline" onClick={adicionarCrianca} className="h-12 rounded-md">
                  <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
                  Adicionar outra crianca
                </Button>
              </SecaoFicha>
            )}

            {etapaAtual === 'ficha' && (
              <>
                <SecaoFicha
                  id="secao-departamentos"
                  titulo="Departamentos"
                  descricao="Selecione as areas de interesse informadas pela cliente."
                  icon={ClipboardList}
                  variant="amarelo"
                  erro={erroSecao('secao-departamentos')}
                >
                  <p className="text-sm font-semibold text-slate-700">Departamentos</p>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {DEPARTAMENTOS_INTERESSE.map((item) => (
                      <OpcaoButton key={item.chave} selected={ficha.departamentos.includes(item.chave)} onClick={() => alternarDepartamento(item.chave)}>
                        {item.label}
                      </OpcaoButton>
                    ))}
                  </div>
                </SecaoFicha>

                <SecaoFicha
                  id="secao-produtos"
                  titulo="Produtos de interesse"
                  descricao="Registre produtos em texto livre quando a cliente citar itens especificos."
                  icon={ShoppingBag}
                  variant="lilas"
                  erro={erroSecao('secao-produtos')}
                >
                  <label className="text-sm font-semibold text-slate-700" htmlFor="produto-interesse">Produtos de interesse</label>
                  <div className="mt-2 flex gap-2">
                    <input
                      id="produto-interesse"
                      value={produtoDigitado}
                      onChange={(event) => setProdutoDigitado(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault()
                          adicionarProduto()
                        }
                      }}
                      className="min-h-12 flex-1 rounded-md border border-slate-200 px-3 text-base outline-none focus:border-sky-500"
                      maxLength={FICHA_PRODUTO_MAX_CHARS}
                      enterKeyHint="done"
                    />
                    <Button type="button" onClick={adicionarProduto} className="h-12 rounded-md">
                      <Plus className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {ficha.produtosInteresse.map((produto) => (
                      <button
                        key={produto}
                        type="button"
                        onClick={() => atualizarFicha((atual) => ({ ...atual, produtosInteresse: atual.produtosInteresse.filter((item) => item !== produto) }))}
                        className="inline-flex min-h-10 items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-700"
                      >
                        {produto}
                        <X className="h-4 w-4" aria-hidden="true" />
                      </button>
                    ))}
                  </div>
                </SecaoFicha>
              </>
            )}

            {etapaAtual === 'resultado' && (
              <div className="grid gap-6">
                <SecaoFicha
                  id="secao-resultado-fechamento"
                  titulo="Fechamento"
                  descricao="Informe o desfecho comercial do atendimento."
                  icon={Check}
                  variant="azul"
                  erro={erroSecao('secao-resultado-fechamento')}
                >
                  <div className="grid gap-2">
                    {RESULTADOS_ATENDIMENTO.map((item) => (
                      <OpcaoButton
                        key={item.chave}
                        selected={ficha.resultadoAtendimento === item.chave}
                        onClick={() => {
                          if (item.chave !== 'sim') setNumeroLancamento('')
                          atualizarFicha((atual) => ({ ...atual, resultadoAtendimento: item.chave as ResultadoAtendimento }))
                        }}
                      >
                        {item.label}
                      </OpcaoButton>
                    ))}
                  </div>
                </SecaoFicha>

                <SecaoFicha
                  id="secao-resultado-produto"
                  titulo="Motivos"
                  descricao="Selecione os fatores citados pela cliente."
                  icon={ClipboardList}
                  variant="amarelo"
                  erro={erroSecao('secao-resultado-produto')}
                >
                  <p className="text-sm font-semibold text-slate-700">
                    {ficha.resultadoAtendimento === 'sim' && 'Principais motivos para o fechamento'}
                    {ficha.resultadoAtendimento === 'nao' && 'Principais motivos para o nao fechamento'}
                    {ficha.resultadoAtendimento === 'negociacao' && 'Principais fatores que influenciam a decisao'}
                    {!ficha.resultadoAtendimento && 'Principais motivos'}
                  </p>
                  <div className="mt-3 grid gap-4">
                    {MOTIVOS_RESULTADO_GRUPOS.map((grupo) => (
                      <div key={grupo.chave}>
                        <p className="mb-2 text-base font-semibold text-slate-800">{grupo.label}</p>
                        <div className="grid gap-2">
                          {grupo.motivos.map((motivo) => (
                            <OpcaoButton key={motivo.chave} selected={ficha.motivosResultado.includes(motivo.chave)} onClick={() => alternarMotivo(motivo.chave)}>
                              {motivo.label}
                            </OpcaoButton>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </SecaoFicha>

                {ficha.motivosResultado.includes('virada_cartao') && (
                  <SecaoFicha
                    id="secao-resultado-condicao"
                    titulo="Condicao comercial"
                    descricao="Registre a data de virada do cartao informada pela cliente."
                    icon={ShoppingBag}
                    variant="laranja"
                    erro={erroSecao('secao-resultado-condicao')}
                  >
                    <label className="text-sm font-semibold text-slate-700">
                      Virada do cartao
                      <input
                        id="virada-cartao"
                        value={viradaCartaoInput}
                        onChange={(event) => atualizarViradaCartao(event.target.value)}
                        className="mt-2 min-h-12 w-full rounded-md border border-slate-200 px-3 text-base outline-none focus:border-sky-500"
                        inputMode="numeric"
                        placeholder="DD/MM"
                        maxLength={5}
                      />
                    </label>
                    <p className="text-xs text-slate-500">Use somente dia e mes, sem ano.</p>
                  </SecaoFicha>
                )}

                {ficha.motivosResultado.includes('outro') && (
                  <SecaoFicha
                    id="secao-resultado-outro"
                    titulo="Outro motivo"
                    descricao="Complemente o motivo quando Outro for selecionado."
                    icon={MessageSquareText}
                    variant="verde"
                    erro={erroSecao('secao-resultado-outro')}
                  >
                    <label className="text-sm font-semibold text-slate-700">
                      Complemento
                      <input
                        id="motivo-outro"
                        value={ficha.motivoOutro ?? ''}
                        onChange={(event) => atualizarFicha((atual) => ({ ...atual, motivoOutro: event.target.value }))}
                        className="mt-2 min-h-12 w-full rounded-md border border-slate-200 px-3 text-base outline-none focus:border-sky-500"
                        maxLength={120}
                      />
                    </label>
                  </SecaoFicha>
                )}
              </div>
            )}

            {etapaAtual === 'ficha' && (
              <SecaoFicha
                id="secao-observacoes"
                titulo="Observacoes sobre esse atendimento"
                descricao="Registre preferencias, duvidas, objecoes ou informacoes importantes para um proximo contato."
                icon={MessageSquareText}
                variant="verde"
                erro={erroSecao('secao-observacoes')}
              >
                <label className="text-sm font-semibold text-slate-700">
                  Observacoes
                  <textarea
                    value={ficha.observacoes ?? ''}
                    onChange={(event) => atualizarFicha((atual) => ({ ...atual, observacoes: event.target.value }))}
                    className="mt-2 min-h-44 w-full rounded-md border border-slate-200 px-3 py-3 text-base outline-none focus:border-sky-500"
                    maxLength={FICHA_OBSERVACOES_MAX_CHARS}
                  />
                </label>
                <p className="text-right text-xs text-slate-500">{(ficha.observacoes ?? '').length}/{FICHA_OBSERVACOES_MAX_CHARS}</p>
              </SecaoFicha>
            )}

            {etapaAtual === 'revisao' && (
              <div id="secao-revisao" className="grid gap-4 scroll-mt-28">
                <div>
                  <h2 className="text-lg font-semibold text-slate-950">Revisao</h2>
                  <p className="mt-1 text-sm text-slate-500">Confira os dados antes de continuar depois.</p>
                </div>
                {[
                  { titulo: 'Unidade', valor: unidadeAtual?.nome ?? 'Nao informada', etapa: 'ficha' as FichaEtapa },
                  { titulo: 'Nome da consultora', valor: ficha.consultoraNome || 'Nao informado', etapa: 'ficha' as FichaEtapa },
                  { titulo: 'Cliente', valor: clienteSelecionada?.nome ?? 'Nao vinculada', etapa: 'ficha' as FichaEtapa },
                  { titulo: 'Telefone', valor: clienteSelecionada?.telefoneFormatado ?? 'Nao informado', etapa: 'ficha' as FichaEtapa },
                  { titulo: 'Parentesco', valor: clienteSelecionada ? getParentescoLabel(clienteSelecionada.parentesco, clienteSelecionada.parentescoOutro) : 'Nao informado', etapa: 'ficha' as FichaEtapa },
                  { titulo: 'Criancas', valor: ficha.criancas.length ? `${ficha.criancas.length} registrada(s)` : 'Nao informado', etapa: 'ficha' as FichaEtapa },
                  { titulo: 'Departamentos', valor: ficha.departamentos.map(getDepartamentoLabel).join(', ') || 'Nao informado', etapa: 'ficha' as FichaEtapa },
                  { titulo: 'Produtos', valor: ficha.produtosInteresse.join(', ') || 'Nao informado', etapa: 'ficha' as FichaEtapa },
                  { titulo: 'Resultado', valor: getResultadoLabel(ficha.resultadoAtendimento), etapa: 'resultado' as FichaEtapa },
                  { titulo: 'Motivos', valor: ficha.motivosResultado.map(getMotivoLabel).join(', ') || 'Nao informado', etapa: 'resultado' as FichaEtapa },
                  { titulo: 'Virada do cartao', valor: formatarViradaCartao(ficha.viradaCartaoDia, ficha.viradaCartaoMes) || 'Nao informado', etapa: 'resultado' as FichaEtapa },
                  { titulo: 'Observacoes', valor: ficha.observacoes || 'Sem observacoes', etapa: 'ficha' as FichaEtapa },
                ].map((item) => (
                  <div key={item.titulo} className="rounded-lg border border-slate-200 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-bold text-slate-700">{item.titulo}</p>
                      <Button type="button" variant="outline" onClick={() => irParaEtapa(item.etapa)} className="h-9 rounded-md">
                        Editar
                      </Button>
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{item.valor}</p>
                  </div>
                ))}
                <p className="rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-800">
                  Ao concluir, o rascunho sera convertido em registro definitivo.
                </p>
                {ficha.resultadoAtendimento === 'sim' && (
                  <label id="secao-revisao-lancamento" className="scroll-mt-28 text-sm font-semibold text-slate-700">
                    Numero do lancamento
                    <input
                      id="numero-lancamento"
                      value={numeroLancamento}
                      onChange={(event) => setNumeroLancamento(event.target.value.replace(/\D/g, '').slice(0, 6))}
                      className="mt-2 min-h-12 w-full rounded-md border border-slate-200 px-3 text-base outline-none focus:border-sky-500"
                      inputMode="numeric"
                      placeholder="Informe o lancamento"
                    />
                  </label>
                )}
                {errosValidacao.length > 0 && (
                  <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                    <p className="font-semibold">Revise os campos abaixo antes de concluir:</p>
                    <div className="mt-3 grid gap-2">
                      {errosValidacao.map((item, index) => (
                        <button
                          key={`revisao-${item.sectionId}-${item.fieldId ?? index}`}
                          type="button"
                          onClick={() => navegarParaErro(item)}
                          className="rounded-md border border-red-200 bg-white px-3 py-2 text-left font-semibold text-red-700"
                        >
                          {item.message}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <Button type="button" onClick={concluirAtendimento} disabled={concluindo} className="h-12 rounded-md">
                  {concluindo ? 'Concluindo...' : 'Concluir atendimento'}
                </Button>
              </div>
            )}

            {errosValidacao.length > 0 && etapaAtual !== 'revisao' && (
              <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                <p className="font-semibold">Revise os campos abaixo.</p>
                <div className="mt-3 grid gap-2">
                  {errosValidacao.map((item, index) => (
                    <button
                      key={`${item.sectionId}-${item.fieldId ?? index}`}
                      type="button"
                      onClick={() => navegarParaErro(item)}
                      className="rounded-md border border-red-200 bg-white px-3 py-2 text-left font-semibold text-red-700"
                    >
                      {item.message}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <TelefoneClienteRapido
              value={clienteSelecionada ? telefoneClienteEdicao : novoCliente.telefone}
              onChange={atualizarTelefoneCliente}
              erro={erroTelefone}
              loading={salvandoTelefone}
              compact={etapaAtual === 'ficha' && !clienteSelecionada}
            />
          </section>
        )}
      </div>

      {!carregandoRascunhoInicial && !erroRascunhoInicial && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 px-3 py-3 shadow-lg backdrop-blur">
          <div className="mx-auto flex max-w-3xl flex-col gap-2">
            {mensagemContinuar && (
              <p className="text-center text-xs font-medium text-slate-600">{mensagemContinuar}</p>
            )}
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={voltar} disabled={etapaAtual === 'ficha'} className="h-12 flex-1 rounded-md">
                <ChevronLeft className="mr-2 h-4 w-4" aria-hidden="true" />
                Voltar
              </Button>
              {etapaAtual === 'revisao' ? (
                <Button type="button" onClick={concluirAtendimento} disabled={!ativo || concluindo || errosEtapaAtual.length > 0} className="h-12 flex-1 rounded-md">
                  <Check className="mr-2 h-4 w-4" aria-hidden="true" />
                  {concluindo ? 'Concluindo...' : 'Concluir'}
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={avancar}
                  disabled={!ativo || iniciando || errosEtapaAtual.length > 0}
                  className="h-12 flex-1 rounded-md"
                >
                  {iniciando ? 'Salvando...' : 'Continuar'}
                  {!iniciando && <ChevronRight className="ml-2 h-4 w-4" aria-hidden="true" />}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      <HistoricoClienteModal
        open={historicoAberto}
        onOpenChange={setHistoricoAberto}
        cliente={clienteSelecionada ? {
          id: clienteSelecionada.id,
          nome: clienteSelecionada.nome,
          telefoneFormatado: clienteSelecionada.telefoneFormatado,
        } : null}
        atendimentoAtualId={ativo?.id ?? null}
      />
    </main>
  )
}
