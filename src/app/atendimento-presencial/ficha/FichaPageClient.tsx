'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Baby, Check, ChevronLeft, ChevronRight, ClipboardList, MessageSquareText, Plus, RefreshCw, Save, Search, ShoppingBag, UserRound, WifiOff, X } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  carregarCacheRascunho,
  removerCacheRascunho,
  salvarCacheRascunho,
} from '@/lib/atendimento-presencial/rascunho-cache'
import {
  DEPARTAMENTOS_INTERESSE,
  FICHA_ETAPAS,
  FICHA_OBSERVACOES_MAX_CHARS,
  FICHA_PRODUTO_MAX_CHARS,
  FICHA_PRODUTOS_MAX_ITENS,
  FICHA_TOTAL_ETAPAS,
  MOTIVOS_RESULTADO_GRUPOS,
  RESULTADOS_ATENDIMENTO,
  SEXOS_CRIANCA,
  SITUACOES_CRIANCA,
  converterDataInputParaISO,
  criarCriancaRascunho,
  formatarDataISOParaInput,
  formatarDataPrevistaInput,
  getDepartamentoLabel,
  getMotivoLabel,
  getResultadoLabel,
  limparNomeCriancaDigitacao,
  migrarFichaDadosRascunho,
  validarFichaParaConclusao,
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
  filtrarConsultorasPorUnidade,
  filtrarUnidadesPorConsultora,
  type AtendimentoPresencialDTO,
  type ConsultoraAtendimento,
  type ContextoAtendimento,
} from '@/lib/atendimento-presencial/rascunhos-shared'

type ApiListarRascunhosResponse = {
  ok: boolean
  message?: string
  rascunhos?: AtendimentoPresencialDTO[]
  contexto?: ContextoAtendimento
  consultorasDisponiveis?: ConsultoraAtendimento[]
}

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

type SyncStatus = 'ocioso' | AutosaveStatus

type Props = {
  usuarioId: string
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

function formatarData(valor: string) {
  return new Date(valor).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function diasRestantes(expiraEm: string) {
  const diff = new Date(expiraEm).getTime() - Date.now()
  return Math.max(Math.ceil(diff / 86_400_000), 0)
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

function criarPayloadInicial(): FichaDadosRascunho {
  return {
    ...payloadInicial,
    criancas: [criarCriancaRascunho(gerarIdLocal('crianca'))],
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
}) {
  return (
    <button
      type="button"
      aria-pressed={props.selected}
      onClick={props.onClick}
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

type VariantSecao = 'azul' | 'rosa' | 'amarelo' | 'lilas' | 'verde'

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
}

function SecaoFicha(props: {
  titulo: string
  descricao?: string
  icon: LucideIcon
  variant?: VariantSecao
  children: React.ReactNode
}) {
  const Icon = props.icon
  const v = props.variant ? variantSecaoClasses[props.variant] : null
  return (
    <section className={`rounded-md border p-4 sm:p-5 ${v ? v.section : 'border-slate-200 bg-slate-50/60'}`}>
      <div className="mb-4 flex items-start gap-3">
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md border ${v ? v.iconWrap : 'border-slate-200 bg-white'}`}>
          <Icon className={`h-4 w-4 ${v ? v.icon : 'text-sky-700'}`} aria-hidden="true" />
        </span>
        <div>
          <h2 className={`text-lg font-semibold ${v ? v.title : 'text-slate-950'}`}>{props.titulo}</h2>
          {props.descricao && <p className={`mt-1 text-sm ${v ? v.descricao : 'text-slate-500'}`}>{props.descricao}</p>}
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
}) {
  const { etapa, ficha, clienteSelecionada } = params
  if (etapa === 'ficha') {
    if (!clienteSelecionada) return 'Selecione ou cadastre uma cliente para continuar.'
    for (const crianca of ficha.criancas) {
      if (crianca.situacao === 'gestacao' && crianca.dataPrevistaNascimento && !/^\d{4}-\d{2}-\d{2}$/.test(crianca.dataPrevistaNascimento)) {
        return 'Revise a data prevista de nascimento.'
      }
      if (crianca.situacao === 'ja_nasceu') {
        if (crianca.idadeUnidade === 'meses' && (!crianca.idadeValor || crianca.idadeValor < 1 || crianca.idadeValor > 11)) {
          return 'Informe idade valida em meses.'
        }
        if (crianca.idadeUnidade === 'anos' && (!crianca.idadeValor || crianca.idadeValor < 1 || crianca.idadeValor > 6)) {
          return 'Informe idade valida em anos.'
        }
        if (!crianca.idadeUnidade) return 'Informe a idade da crianca.'
      }
    }
  }
  if (etapa === 'resultado') {
    if (!ficha.resultadoAtendimento) return 'Selecione o resultado do atendimento.'
    if (ficha.motivosResultado.length === 0) return 'Selecione ao menos um motivo.'
    if (ficha.motivosResultado.includes('outro') && !ficha.motivoOutro?.trim()) return 'Informe o complemento de Outro.'
  }
  return null
}

export default function FichaPageClient({ usuarioId }: Props) {
  const [contexto, setContexto] = useState<ContextoAtendimento | null>(null)
  const [consultoras, setConsultoras] = useState<ConsultoraAtendimento[]>([])
  const [rascunhos, setRascunhos] = useState<AtendimentoPresencialDTO[]>([])
  const [unidadeId, setUnidadeId] = useState('')
  const [consultoraUsuarioId, setConsultoraUsuarioId] = useState('')
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
  const [produtoDigitado, setProdutoDigitado] = useState('')
  const [statusSync, setStatusSync] = useState<SyncStatus>('ocioso')
  const [erro, setErro] = useState<string | null>(null)
  const [erroEtapa, setErroEtapa] = useState<string | null>(null)
  const [numeroLancamento, setNumeroLancamento] = useState('')
  const [concluindo, setConcluindo] = useState(false)
  const [mensagemConclusao, setMensagemConclusao] = useState<string | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [iniciando, setIniciando] = useState(false)
  const [onlineTick, setOnlineTick] = useState(0)
  const autosaveQueueRef = useRef<AutosaveSerialQueue | null>(null)
  const mountedRef = useRef(false)
  const concluindoRef = useRef(false)

  const etapaAtual = ficha.etapaAtual
  const etapaNumero = ativo ? indexEtapa(etapaAtual) + 2 : 1
  const etapaLabelAtual = ativo ? etapaLabels[etapaAtual] : 'Filial e consultora'
  const unidadesParaSelecao = useMemo(() => {
    if (!contexto) return []
    if (contexto.perfil === 'consultora') return contexto.unidadesPermitidas
    return filtrarUnidadesPorConsultora({
      unidades: contexto.unidadesPermitidas,
      consultoras,
      consultoraUsuarioId,
    })
  }, [consultoraUsuarioId, consultoras, contexto])
  const consultorasParaSelecao = useMemo(() => {
    if (!contexto || contexto.perfil === 'consultora') return []
    return filtrarConsultorasPorUnidade({ consultoras, unidadeId })
  }, [consultoras, contexto, unidadeId])
  const consultoraSelecionada = consultoras.find((consultora) => consultora.id === consultoraUsuarioId)
  const consultoraSemUnidade = contexto?.perfil !== 'consultora' && Boolean(consultoraUsuarioId) && (consultoraSelecionada?.unidadeIds.length ?? 0) === 0
  const precisaSelecionarUnidade = unidadesParaSelecao.length > 1

  const podeIniciar = useMemo(() => {
    if (!contexto || iniciando) return false
    if (unidadesParaSelecao.length === 0) return false
    if (consultoraSemUnidade) return false
    if (precisaSelecionarUnidade && !unidadeId) return false
    if (contexto.perfil !== 'consultora' && !consultoraUsuarioId) return false
    return true
  }, [consultoraSemUnidade, consultoraUsuarioId, contexto, iniciando, precisaSelecionarUnidade, unidadeId, unidadesParaSelecao.length])

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

  async function carregarRascunhos() {
    setCarregando(true)
    setErro(null)
    try {
      const response = await fetch('/api/atendimento-presencial/atendimentos/rascunhos', { cache: 'no-store' })
      const data = (await response.json()) as ApiListarRascunhosResponse
      if (!response.ok || !data.ok) throw new Error(data.message ?? 'Erro ao carregar rascunhos')

      setContexto(data.contexto ?? null)
      setConsultoras(data.consultorasDisponiveis ?? [])
      setRascunhos(data.rascunhos ?? [])
      setMensagemConclusao(null)

      if (data.contexto?.perfil === 'consultora' && data.contexto.unidadesPermitidas.length === 1) {
        setUnidadeId(data.contexto.unidadesPermitidas[0].id)
      }
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Erro ao carregar rascunhos')
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    void carregarRascunhos()
  }, [])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      autosaveQueueRef.current?.stop()
      autosaveQueueRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!contexto || ativo) return
    if (contexto.perfil === 'consultora' && contexto.unidadesPermitidas.length === 1) {
      setUnidadeId(contexto.unidadesPermitidas[0].id)
    }
  }, [ativo, contexto])

  useEffect(() => {
    if (!contexto || ativo || contexto.perfil === 'consultora') return
    if (!consultoraUsuarioId) return

    const unidadesValidas = filtrarUnidadesPorConsultora({
      unidades: contexto.unidadesPermitidas,
      consultoras,
      consultoraUsuarioId,
    })
    if (unidadeId && !unidadesValidas.some((unidade) => unidade.id === unidadeId)) {
      setUnidadeId('')
      return
    }
    if (!unidadeId && unidadesValidas.length === 1) setUnidadeId(unidadesValidas[0].id)
  }, [ativo, consultoraUsuarioId, consultoras, contexto, unidadeId])

  useEffect(() => {
    if (!contexto || ativo || contexto.perfil === 'consultora') return
    if (!unidadeId || !consultoraUsuarioId) return
    if (!consultoraSelecionada?.unidadeIds.includes(unidadeId)) setConsultoraUsuarioId('')
  }, [ativo, consultoraSelecionada, consultoraUsuarioId, contexto, unidadeId])

  useEffect(() => {
    function handleOnline() {
      setOnlineTick((valor) => valor + 1)
    }
    window.addEventListener('online', handleOnline)
    return () => window.removeEventListener('online', handleOnline)
  }, [])

  function montarPayloadAutosave(
    fichaAtual = ficha,
    clienteAtual = clienteSelecionada
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
    setRascunhos((atuais) => atuais.map((item) => item.id === params.rascunho.id ? params.rascunho : item))
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
        if (servidor) setRascunhos((atuais) => atuais.map((item) => item.id === servidor.id ? servidor : item))
      },
      onLog: (message) => console.log(message),
      getOnline: () => navigator.onLine,
    })
  }

  function aplicarRascunho(rascunho: AtendimentoPresencialDTO) {
    setAtivo(rascunho)
    setUnidadeId(rascunho.unidadeId)
    setConsultoraUsuarioId(rascunho.consultoraUsuarioId)
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
    if (usarCache) salvarCacheLocalRascunho({ rascunho, payload: payloadAtual, sincronizado: false, version: rascunho.version })
    setStatusSync(usarCache ? 'offline' : 'salvo')
    setNumeroLancamento('')
    setMensagemConclusao(null)
    void carregarClientePorId(rascunho.clienteId)
  }

  async function iniciarRascunho() {
    if (!contexto || !podeIniciar) return
    setIniciando(true)
    setErro(null)
    const draftClientId = gerarIdLocal('draft')
    const unidadeFinal = unidadeId || unidadesParaSelecao[0]?.id
    const dadosRascunho = criarPayloadInicial()

    try {
      const response = await fetch('/api/atendimento-presencial/atendimentos/rascunhos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          draftClientId,
          unidadeId: unidadeFinal,
          consultoraUsuarioId: contexto.perfil === 'consultora' ? undefined : consultoraUsuarioId,
          dadosRascunho,
        }),
      })
      const data = (await response.json()) as ApiRascunhoResponse
      if (!response.ok || !data.ok || !data.rascunho) {
        throw new Error(data.message ?? 'Erro ao iniciar rascunho')
      }

      setRascunhos((atuais) => [data.rascunho!, ...atuais.filter((item) => item.id !== data.rascunho?.id)])
      aplicarRascunho(data.rascunho)
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Erro ao iniciar rascunho')
    } finally {
      setIniciando(false)
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
    atualizarFicha((atual) => ({ ...atual, etapaAtual: etapa }))
  }

  function avancar() {
    const erroValidacao = validarEtapa({ etapa: etapaAtual, ficha, clienteSelecionada })
    if (erroValidacao) {
      setErroEtapa(erroValidacao)
      return
    }
    setErroEtapa(null)
    irParaEtapa(proximaEtapa(etapaAtual))
  }

  function voltar() {
    setErroEtapa(null)
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
    atualizarCrianca(id, { nome: limparNomeCriancaDigitacao(valor) })
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
      return {
        ...atual,
        motivosResultado: selecionado
          ? atual.motivosResultado.filter((item) => item !== chave)
          : [...atual.motivosResultado, chave],
        motivoOutro: selecionado && chave === 'outro' ? undefined : atual.motivoOutro,
      }
    })
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

  async function concluirAtendimento() {
    if (!ativo || concluindoRef.current) return
    concluindoRef.current = true
    const validacao = validarFichaParaConclusao({
      ficha,
      clienteId: clienteSelecionada?.id ?? null,
      numeroLancamento,
    })
    if (!validacao.ok) {
      setErroEtapa(validacao.message)
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
      const response = await fetch(`/api/atendimento-presencial/atendimentos/${rascunhoSalvo.id}/concluir`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          version: rascunhoSalvo.version,
          numeroLancamento: validacao.numeroLancamento,
        }),
      })
      const data = (await response.json()) as ApiConcluirResponse
      if (!response.ok || !data.ok || !data.atendimento) {
        throw new Error(data.message ?? 'Erro ao concluir atendimento')
      }

      removerCacheRascunho(window.localStorage, usuarioId, rascunhoSalvo.draftClientId)
      autosaveQueueRef.current?.stop()
      autosaveQueueRef.current = null
      setRascunhos((atuais) => atuais.filter((item) => item.id !== rascunhoSalvo.id))
      setAtivo(null)
      setFicha(criarPayloadInicial())
      setClienteSelecionada(null)
      setBuscaCliente('')
      setClientesEncontradas([])
      setDataPrevistaInputs({})
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
  const consultoraAtual = contexto?.perfil === 'consultora'
    ? { nome: 'Consultora autenticada' }
    : consultoras.find((consultora) => consultora.id === consultoraUsuarioId)

  return (
    <main className="min-h-screen bg-slate-50 px-3 pb-28 pt-5 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-3xl flex-col gap-5">
        <header className="flex flex-col gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Atendimento presencial</p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-950">Ficha de Atendimento</h1>
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

        {erro && (
          <div className="grid gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            <p>{erro}</p>
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

        {!ativo && (
          <section className="grid gap-5 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-slate-950">Nova ficha</h2>
              <p className="mt-1 text-sm text-slate-500">
                Selecione a unidade e consultora quando necessario para iniciar o rascunho.
              </p>
            </div>

            {contexto?.unidadesPermitidas.length === 0 && (
              <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                Usuario sem unidade vinculada. Ajuste a configuracao na tela de usuarios.
              </p>
            )}

            {contexto && contexto.unidadesPermitidas.length > 0 && (
              <div className="grid gap-5">
                {contexto.perfil !== 'consultora' && (
                  <div>
                    <p className="text-sm font-semibold text-slate-700">Consultora</p>
                    <div className="mt-2 grid gap-2">
                      {consultorasParaSelecao.length === 0 && (
                        <p className="rounded-md border border-dashed border-slate-200 p-3 text-sm text-slate-500">
                          {unidadeId ? 'Nenhuma consultora disponivel para esta unidade.' : 'Nenhuma consultora vinculada as unidades permitidas.'}
                        </p>
                      )}
                      {consultorasParaSelecao.map((consultora) => (
                        <OpcaoButton key={consultora.id} selected={consultoraUsuarioId === consultora.id} onClick={() => setConsultoraUsuarioId(consultora.id)}>
                          {consultora.nome}
                        </OpcaoButton>
                      ))}
                    </div>
                    {consultoraSemUnidade && (
                      <p className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                        Esta consultora nao possui unidade vinculada. Configure o vinculo na tela de usuarios antes de iniciar a ficha.
                      </p>
                    )}
                  </div>
                )}

                <div>
                  <p className="text-sm font-semibold text-slate-700">Unidade</p>
                  <div className="mt-2 grid gap-2">
                    {unidadesParaSelecao.length === 0 && (
                      <p className="rounded-md border border-dashed border-slate-200 p-3 text-sm text-slate-500">
                        {consultoraUsuarioId ? 'Nenhuma unidade vinculada a consultora selecionada.' : 'Nenhuma unidade disponivel.'}
                      </p>
                    )}
                    {unidadesParaSelecao.map((unidade) => (
                      <OpcaoButton key={unidade.id} selected={unidadeId === unidade.id} onClick={() => setUnidadeId(unidade.id)}>
                        {unidade.nome}
                      </OpcaoButton>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <Button type="button" onClick={iniciarRascunho} disabled={!podeIniciar} className="mt-5 h-12 w-full rounded-md">
              {iniciando ? 'Iniciando...' : 'Iniciar nova ficha'}
            </Button>

            <div className="mt-6 border-t border-slate-100 pt-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-base font-semibold text-slate-950">Rascunhos ativos</h2>
                <Button type="button" variant="outline" onClick={carregarRascunhos} disabled={carregando} className="h-10 rounded-md">
                  <RefreshCw className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
              <div className="grid gap-3">
                {carregando && <p className="text-sm text-slate-500">Carregando...</p>}
                {!carregando && rascunhos.length === 0 && (
                  <p className="rounded-md border border-dashed border-slate-200 p-4 text-sm text-slate-500">Nenhum rascunho ativo.</p>
                )}
                {rascunhos.map((rascunho) => (
                  <article key={rascunho.id} className="rounded-lg border border-amber-300 bg-amber-50 p-4">
                    <p className="text-sm font-bold uppercase text-amber-800">RASCUNHO</p>
                    <p className="mt-2 text-sm text-slate-700">Iniciado em: {formatarData(rascunho.iniciadoEm)}</p>
                    <p className="text-sm text-slate-700">Ultima atualizacao: {formatarData(rascunho.ultimaAtividadeEm)}</p>
                    <p className="text-sm text-slate-700">Expira em: {diasRestantes(rascunho.expiraEm)} dias</p>
                    <Button type="button" onClick={() => aplicarRascunho(rascunho)} className="mt-3 h-11 w-full rounded-md">
                      Continuar preenchendo
                    </Button>
                  </article>
                ))}
              </div>
            </div>
          </section>
        )}

        {ativo && (
          <section className="grid gap-5 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
            {etapaAtual === 'ficha' && (
              <SecaoFicha
                titulo="Cliente"
                descricao={!clienteSelecionada ? 'Busque por nome ou telefone, ou cadastre uma nova cliente.' : undefined}
                icon={UserRound}
                variant="azul"
              >
                {clienteSelecionada && (
                  <div className="rounded-lg border border-sky-200 bg-sky-50 p-4">
                    <p className="text-xs font-bold uppercase text-sky-700">Cliente vinculada</p>
                    <p className="mt-2 text-base font-semibold text-slate-950">{clienteSelecionada.nome}</p>
                    {clienteSelecionada.telefoneFormatado && <p className="text-sm text-slate-700">{clienteSelecionada.telefoneFormatado}</p>}
                    <p className="text-sm text-slate-700">{clienteSelecionada.parentescoLabel}</p>
                    <Button type="button" variant="outline" onClick={trocarCliente} className="mt-3 h-10 rounded-md">
                      Trocar cliente
                    </Button>
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
                            onChange={(event) => setNovoCliente((atual) => ({ ...atual, telefone: aplicarMascaraTelefoneBR(event.target.value) }))}
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
                titulo="Dados da crianca"
                descricao="Registre uma ou mais criancas quando a cliente informar."
                icon={Baby}
                variant="rosa"
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
                      {crianca.situacao === 'gestacao' && (
                        <label className="text-sm font-semibold text-slate-700">
                          Data prevista de nascimento
                          <input
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
                          value={crianca.nome ?? ''}
                          onChange={(event) => atualizarNomeCrianca(crianca.id, event.target.value)}
                          className="mt-2 min-h-12 w-full rounded-md border border-slate-200 px-3 text-base outline-none focus:border-sky-500"
                          maxLength={80}
                        />
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
                  titulo="Departamentos"
                  descricao="Selecione as areas de interesse informadas pela cliente."
                  icon={ClipboardList}
                  variant="amarelo"
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
                  titulo="Produtos de interesse"
                  descricao="Registre produtos em texto livre quando a cliente citar itens especificos."
                  icon={ShoppingBag}
                  variant="lilas"
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
                <div>
                  <h2 className="text-lg font-semibold text-slate-950">Houve fechamento?</h2>
                  <p className="mt-1 text-sm text-slate-500">A conclusao comercial sera implementada depois.</p>
                </div>
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
                <div>
                  <p className="text-sm font-semibold text-slate-700">
                    {ficha.resultadoAtendimento === 'sim' && 'Principais motivos para o fechamento'}
                    {ficha.resultadoAtendimento === 'nao' && 'Principais motivos para o nao fechamento'}
                    {ficha.resultadoAtendimento === 'negociacao' && 'Principais fatores que influenciam a decisao'}
                    {!ficha.resultadoAtendimento && 'Principais motivos'}
                  </p>
                  <div className="mt-3 grid gap-4">
                    {MOTIVOS_RESULTADO_GRUPOS.map((grupo) => (
                      <div key={grupo.chave}>
                        <p className="mb-2 text-xs font-bold uppercase text-slate-500">{grupo.label}</p>
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
                  {ficha.motivosResultado.includes('outro') && (
                    <label className="mt-4 block text-sm font-semibold text-slate-700">
                      Complemento de Outro
                      <input
                        value={ficha.motivoOutro ?? ''}
                        onChange={(event) => atualizarFicha((atual) => ({ ...atual, motivoOutro: event.target.value }))}
                        className="mt-2 min-h-12 w-full rounded-md border border-slate-200 px-3 text-base outline-none focus:border-sky-500"
                        maxLength={120}
                      />
                    </label>
                  )}
                </div>
              </div>
            )}

            {etapaAtual === 'ficha' && (
              <SecaoFicha
                titulo="Observacoes sobre esse atendimento"
                descricao="Registre preferencias, duvidas, objecoes ou informacoes importantes para um proximo contato."
                icon={MessageSquareText}
                variant="verde"
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
              <div className="grid gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-slate-950">Revisao</h2>
                  <p className="mt-1 text-sm text-slate-500">Confira os dados antes de continuar depois.</p>
                </div>
                {[
                  { titulo: 'Unidade', valor: unidadeAtual?.nome ?? 'Nao informada', etapa: 'ficha' as FichaEtapa },
                  { titulo: 'Consultora', valor: consultoraAtual?.nome ?? 'Nao informada', etapa: 'ficha' as FichaEtapa },
                  { titulo: 'Cliente', valor: clienteSelecionada?.nome ?? 'Nao vinculada', etapa: 'ficha' as FichaEtapa },
                  { titulo: 'Telefone', valor: clienteSelecionada?.telefoneFormatado ?? 'Nao informado', etapa: 'ficha' as FichaEtapa },
                  { titulo: 'Parentesco', valor: clienteSelecionada ? getParentescoLabel(clienteSelecionada.parentesco, clienteSelecionada.parentescoOutro) : 'Nao informado', etapa: 'ficha' as FichaEtapa },
                  { titulo: 'Criancas', valor: ficha.criancas.length ? `${ficha.criancas.length} registrada(s)` : 'Nao informado', etapa: 'ficha' as FichaEtapa },
                  { titulo: 'Departamentos', valor: ficha.departamentos.map(getDepartamentoLabel).join(', ') || 'Nao informado', etapa: 'ficha' as FichaEtapa },
                  { titulo: 'Produtos', valor: ficha.produtosInteresse.join(', ') || 'Nao informado', etapa: 'ficha' as FichaEtapa },
                  { titulo: 'Resultado', valor: getResultadoLabel(ficha.resultadoAtendimento), etapa: 'resultado' as FichaEtapa },
                  { titulo: 'Motivos', valor: ficha.motivosResultado.map(getMotivoLabel).join(', ') || 'Nao informado', etapa: 'resultado' as FichaEtapa },
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
                  <label className="text-sm font-semibold text-slate-700">
                    Numero do lancamento
                    <input
                      value={numeroLancamento}
                      onChange={(event) => setNumeroLancamento(event.target.value.replace(/\D/g, '').slice(0, 6))}
                      className="mt-2 min-h-12 w-full rounded-md border border-slate-200 px-3 text-base outline-none focus:border-sky-500"
                      inputMode="numeric"
                      placeholder="Informe o lancamento"
                    />
                  </label>
                )}
                <Button type="button" onClick={concluirAtendimento} disabled={concluindo} className="h-12 rounded-md">
                  {concluindo ? 'Concluindo...' : 'Concluir atendimento'}
                </Button>
              </div>
            )}
          </section>
        )}
      </div>

      {ativo && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 px-3 py-3 shadow-lg backdrop-blur">
          <div className="mx-auto flex max-w-3xl gap-2">
            <Button type="button" variant="outline" onClick={voltar} disabled={etapaAtual === 'ficha'} className="h-12 flex-1 rounded-md">
              <ChevronLeft className="mr-2 h-4 w-4" aria-hidden="true" />
              Voltar
            </Button>
            {etapaAtual === 'revisao' ? (
              <Button type="button" onClick={concluirAtendimento} disabled={concluindo} className="h-12 flex-1 rounded-md">
                <Check className="mr-2 h-4 w-4" aria-hidden="true" />
                {concluindo ? 'Concluindo...' : 'Concluir'}
              </Button>
            ) : (
              <Button type="button" onClick={avancar} className="h-12 flex-1 rounded-md">
                Continuar
                <ChevronRight className="ml-2 h-4 w-4" aria-hidden="true" />
              </Button>
            )}
          </div>
        </div>
      )}
    </main>
  )
}
