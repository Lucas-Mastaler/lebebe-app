'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { CriancasCadastradas } from './CriancasCadastradas'
import { ParentescoCriancaField } from './ParentescoCriancaField'
import { requisicaoLimitada } from '@/lib/atendimento-presencial/requisicao-limitada'
import { calcularReferenciaNascimento, criancaJaNasceu, dataAtendimentoLocal, descreverIdadeAproximada } from '@/lib/atendimento-presencial/idade-aproximada'
import { AlertCircle, Baby, Check, ChevronLeft, ClipboardList, History, LoaderCircle, MessageSquareText, Plus, RefreshCw, Save, Search, ShoppingBag, UserRound, X } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  DateField,
  FormField,
  FormErrorSummary,
  FormPageContent,
  Input,
  PageContainer,
  PageHeader,
  Section,
  Spinner,
  Textarea,
} from '@/components/design-system'
import type { SectionTone } from '@/lib/design-system/section-tones'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { HistoricoClienteModal } from '@/components/atendimento-presencial/HistoricoClienteModal'
import { TelefoneClienteRapido } from '@/components/atendimento-presencial/TelefoneClienteRapido'
import { ViradaCartaoField } from '@/components/atendimento-presencial/ViradaCartaoField'
import { VIRADA_CARTAO_OBRIGATORIA } from '@/lib/atendimento-presencial/virada-cartao-input'
import {
  carregarCacheRascunho,
  listarCachesRascunho,
  planejarRecuperacaoRascunho,
  temEntradasLocaisPendentes,
  temDadosIntermediariosRascunho,
  type RascunhoCache,
  type EntradasLocaisRascunho,
  removerCacheRascunho,
  salvarCacheRascunho,
} from '@/lib/atendimento-presencial/rascunho-cache'
import {
  DEPARTAMENTOS_INTERESSE,
  FICHA_CONSULTORA_NOME_MAX_CHARS,
  FICHA_CRIANCAS_MAX_ITENS,
  FICHA_OBSERVACOES_MAX_CHARS,
  FICHA_PRODUTO_MAX_CHARS,
  FICHA_PRODUTOS_MAX_ITENS,
  MOTIVOS_VISITA,
  OBSERVACAO_NAO_FECHAMENTO_MAX_CHARS,
  MOTIVOS_RESULTADO_GRUPOS,
  SEXOS_CRIANCA,
  SITUACOES_CRIANCA,
  converterViradaCartaoInput,
  formatarViradaCartao,
  formatarViradaCartaoInput,
  converterDataInputParaISO,
  criarCriancaRascunho,
  formatarDataISOParaInput,
  limparNomeCriancaDigitacao,
  migrarFichaDadosRascunho,
  normalizarNomeConsultora,
  validarFichaParaConclusao,
  validarNumeroLancamento,
  validarFichaDadosRascunho,
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
  validarPayloadCliente,
  type ClientePresencialDTO,
  type ParentescoCliente,
} from '@/lib/atendimento-presencial/clientes'
import { normalizarTelefone, aplicarMascaraTelefoneBR } from '@/lib/atendimento-presencial/telefone'
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
  field?: string
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
  rascunhoIdInicial: string | null
}

const etapaLabels: Record<FichaEtapa, string> = {
  ficha: 'Prancheta Virtual de Atendimento',
  resultado: 'Resultado',
  revisao: 'Prancheta Virtual de Atendimento',
}

const payloadInicial: FichaDadosRascunho = {
  versaoFluxo: 2,
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

function normalizarProduto(valor: string) {
  return valor.trim().replace(/\s+/g, ' ').slice(0, FICHA_PRODUTO_MAX_CHARS)
}

function criarPayloadInicial(): FichaDadosRascunho {
  return {
    ...payloadInicial,
    criancas: [],
    departamentos: [],
    produtosInteresse: [],
    motivosResultado: [],
  }
}

function StatusSync({ status, onRetry }: { status: SyncStatus; onRetry: () => void }) {
  const texto: Record<SyncStatus, string> = {
    ocioso: 'Aguardando inicio',
    alterado: 'Salvando...',
    aguardando: 'Salvando...',
    salvando: 'Salvando...',
    salvo: 'Rascunho salvo',
    offline: 'Erro ao salvar',
    conflito: 'Erro ao salvar',
    erro: 'Erro ao salvar',
  }
  const tone: Record<SyncStatus, 'neutral' | 'warning' | 'info' | 'success' | 'danger'> = {
    ocioso: 'neutral',
    alterado: 'warning',
    aguardando: 'warning',
    salvando: 'info',
    salvo: 'success',
    offline: 'warning',
    conflito: 'danger',
    erro: 'danger',
  }

  return (
    <div className="flex shrink-0 flex-col items-end gap-1" role="status" aria-live="polite">
      <Badge tone={status === 'offline' ? 'danger' : tone[status]} className="gap-1.5 whitespace-nowrap text-xs">
        {['alterado', 'aguardando', 'salvando'].includes(status) ? <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" />
          : status === 'salvo' ? <Check className="size-3.5" aria-hidden="true" />
            : ['offline', 'erro', 'conflito'].includes(status) ? <AlertCircle className="size-3.5" aria-hidden="true" /> : <Save className="size-3.5" aria-hidden="true" />}
        {texto[status]}
      </Badge>
      {['erro', 'offline'].includes(status) && <button type="button" onClick={onRetry} className="min-h-9 text-xs font-semibold text-primary underline">Tentar novamente</button>}
    </div>
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
        'min-h-12 rounded-md border px-4 py-3 text-left text-sm font-semibold outline-none transition focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:border-ring',
        props.selected ? 'border-primary bg-primary/10 text-primary' : 'border-input bg-input-background text-slate-700',
        props.className ?? '',
      ].join(' ')}
    >
      {props.children}
    </button>
  )
}

/**
 * `Section` oficial (CLR=B/SEC=C) só tem 3 tons — esta ficha tinha 6 cores
 * ad hoc por seção (LACUNA DE DESIGN SYSTEM: sem tom por seção suficiente
 * para diferenciar todos os blocos). Cicla entre os 3 tons oficiais em vez
 * de inventar cor nova (§13/§29).
 */
function SecaoFicha(props: {
  id?: string
  titulo: string
  descricao?: string
  icon: LucideIcon
  tone?: SectionTone
  erro?: string
  children: React.ReactNode
}) {
  const Icon = props.erro ? AlertCircle : props.icon
  return (
    <div id={props.id} className="scroll-mt-28" role="region" tabIndex={-1} aria-describedby={props.erro ? `${props.id}-erro` : undefined}>
      <Section
        title={props.titulo}
        description={props.descricao}
        icon={<Icon className={`size-4 ${props.erro ? 'text-destructive' : ''}`} aria-hidden="true" />}
        tone={props.tone ?? 'section-1'}
        className={props.erro ? 'border border-l-4 border-red-300 border-l-red-400 bg-red-50/70' : undefined}
      >
        {props.erro && (
          <p id={`${props.id}-erro`} role="alert" className="text-xs font-medium text-destructive">
            {props.erro}
          </p>
        )}
        {props.children}
      </Section>
    </div>
  )
}

function validarEtapa(params: {
  etapa: FichaEtapa
  ficha: FichaDadosRascunho
  clienteSelecionada: ClientePresencialDTO | null
  dataPrevistaInputs?: Record<string, string>
}): ErroValidacaoFicha[] {
  const { etapa, ficha, clienteSelecionada } = params
  const erros: ErroValidacaoFicha[] = []
  if (etapa === 'ficha') {
    const consultoraNomeNormalizado = normalizarNomeConsultora(ficha.consultoraNome)
    if (!consultoraNomeNormalizado || !validarNomeConsultora(consultoraNomeNormalizado)) {
      erros.push({ sectionId: 'secao-consultora-nome', fieldId: 'consultora-nome', message: 'Informe o nome da consultora (apenas letras e espacos, 2 a 30 caracteres).' })
    }
    if (!ficha.tipoAtendimento) erros.push({ sectionId: 'secao-tipo', message: 'Selecione o tipo de atendimento.' })
    if (ficha.tipoAtendimento === 'nao_cliente' && !ficha.motivoVisita) erros.push({ sectionId: 'secao-visita', message: 'Selecione o motivo da visita.' })
    if (ficha.tipoAtendimento === 'cliente' && !clienteSelecionada) {
      erros.push({ sectionId: 'secao-cliente', fieldId: 'busca-cliente', message: 'Selecione uma cliente.' })
    }
    if (ficha.tipoAtendimento !== 'cliente') return erros
    for (const crianca of ficha.criancas) {
      if (ficha.versaoFluxo === 2 && !crianca.criancaPermanenteId && (crianca.parentesco?.trim().length ?? 0) < 2) erros.push({ sectionId: 'secao-crianca', fieldId: `parentesco-crianca-${crianca.id}`, message: 'Informe o parentesco da criança com a cliente.' })
      const dataDigitada = params.dataPrevistaInputs?.[crianca.id]
      if (dataDigitada && !converterDataInputParaISO(dataDigitada)) {
        erros.push({ sectionId: 'secao-crianca', fieldId: `data-prevista-${crianca.id}`, message: 'Revise a data prevista de nascimento.' })
      }
      if (crianca.situacao === 'gestacao' && crianca.dataPrevistaNascimento && !/^\d{4}-\d{2}-\d{2}$/.test(crianca.dataPrevistaNascimento)) {
        erros.push({ sectionId: 'secao-crianca', fieldId: `data-prevista-${crianca.id}`, message: 'Revise a data prevista de nascimento.' })
      }
      if (crianca.situacao === 'presente_outra_pessoa' && crianca.dataPrevistaNascimento && !/^\d{4}-\d{2}-\d{2}$/.test(crianca.dataPrevistaNascimento)) {
        erros.push({ sectionId: 'secao-crianca', fieldId: `data-prevista-${crianca.id}`, message: 'Revise a data prevista de nascimento.' })
      }
      if (crianca.situacao === 'presente_outra_pessoa' && crianca.presenteJaNasceu === undefined) erros.push({ sectionId: 'secao-crianca', fieldId: `presente-nasceu-${crianca.id}`, message: 'Informe se a criança já nasceu.' })
      if (criancaJaNasceu(crianca)) {
        if (crianca.idadeUnidade === 'meses' && (!crianca.idadeValor || crianca.idadeValor < 1 || crianca.idadeValor > 11)) {
          erros.push({ sectionId: 'secao-crianca', fieldId: `idade-${crianca.id}`, message: 'Informe idade valida em meses.' })
        }
        if (crianca.idadeUnidade === 'anos' && (!crianca.idadeValor || crianca.idadeValor < 1 || crianca.idadeValor > 6)) {
          erros.push({ sectionId: 'secao-crianca', fieldId: `idade-${crianca.id}`, message: 'Informe idade valida em anos.' })
        }
        if (!crianca.idadeUnidade) erros.push({ sectionId: 'secao-crianca', fieldId: `idade-${crianca.id}`, message: 'Informe a idade da crianca.' })
      }
    }
    if (!ficha.departamentos.length) erros.push({ sectionId: 'secao-departamentos', message: 'Selecione ao menos um departamento.' })
  }
  if (etapa === 'resultado') {
    if (!ficha.resultadoAtendimento) erros.push({ sectionId: 'secao-resultado-fechamento', message: 'Selecione o resultado do atendimento.' })
    if (ficha.motivosResultado.length === 0) erros.push({ sectionId: 'secao-resultado-produto', message: 'Selecione pelo menos um motivo.' })
    if (ficha.motivosResultado.includes('virada_cartao') && !formatarViradaCartao(ficha.viradaCartaoDia, ficha.viradaCartaoMes)) {
      erros.push({ sectionId: 'secao-resultado-condicao', fieldId: 'virada-cartao', message: VIRADA_CARTAO_OBRIGATORIA })
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

export default function FichaPageClient({ usuarioId, contextoInicial, unidadeIdInicial, rascunhoIdInicial }: Props) {
  const router = useRouter()
  const [consultorasRecentes, setConsultorasRecentes] = useState<string[]>([])
  const [erroSugestoes, setErroSugestoes] = useState<string | null>(null)
  const [contexto] = useState<ContextoAtendimento>(contextoInicial)
  const [unidadeId, setUnidadeId] = useState(unidadeIdInicial)
  const [ativo, setAtivo] = useState<AtendimentoPresencialDTO | null>(null)
  const [ficha, setFicha] = useState<FichaDadosRascunho>(() => criarPayloadInicial())
  const [clienteSelecionada, setClienteSelecionada] = useState<ClientePresencialDTO | null>(null)
  const [clienteId, setClienteId] = useState<string | null>(null)
  const clienteIdRef = useRef<string | null>(null)
  const clienteRequestRef = useRef(0)
  const [erroCadastro, setErroCadastro] = useState<{ field: string; message: string } | null>(null)
  const [cadastrandoCliente, setCadastrandoCliente] = useState(false)
  const cadastroEmCursoRef = useRef(false)
  const [erroCliente, setErroCliente] = useState<string | null>(null)
  const [telefonePendente, setTelefonePendente] = useState<EntradasLocaisRascunho['telefonePendente']>(null)
  const [erroCache, setErroCache] = useState(false)
  const [cachesRecuperaveis, setCachesRecuperaveis] = useState<RascunhoCache[]>([])
  const [conflitoLocal, setConflitoLocal] = useState<{ cache: RascunhoCache; servidor: AtendimentoPresencialDTO } | null>(null)
  const conflitoLocalRef = useRef(false)
  const editorIdRef = useRef<string | null>(null)
  const cacheRecuperadoRef = useRef<RascunhoCache | null>(null)
  const [saindo, setSaindo] = useState(false)
  const [buscaCliente, setBuscaCliente] = useState('')
  const [clientesEncontradas, setClientesEncontradas] = useState<ClientePresencialDTO[]>([])
  const [duplicidade, setDuplicidade] = useState<{ telefone: string; cliente: ClientePresencialDTO | null; ambiguo: boolean } | null>(null)
  const [erroDuplicidade, setErroDuplicidade] = useState<string | null>(null)
  const [conferindoDuplicidade, setConferindoDuplicidade] = useState(false)
  const duplicidadeGeracaoRef = useRef(0)
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
  const [erroConclusao, setErroConclusao] = useState<string | null>(null)
  const [erroCriacao, setErroCriacao] = useState<string | null>(null)
  const [erroEtapa, setErroEtapa] = useState<string | null>(null)
  const [errosValidacao, setErrosValidacao] = useState<ErroValidacaoFicha[]>([])
  const [numeroLancamento, setNumeroLancamento] = useState('')
  const [concluindo, setConcluindo] = useState(false)
  const [rodapeVisivel, setRodapeVisivel] = useState(false)
  const [mensagemConclusao, setMensagemConclusao] = useState<string | null>(null)
  const [rascunhoEncerrado, setRascunhoEncerrado] = useState<string | null>(null)
  const [carregandoRascunhoInicial, setCarregandoRascunhoInicial] = useState(false)
  const [erroRascunhoInicial, setErroRascunhoInicial] = useState<string | null>(null)
  const [iniciando, setIniciando] = useState(false)
  const [iniciandoNovoAtendimento, setIniciandoNovoAtendimento] = useState(false)
  const [onlineTick, setOnlineTick] = useState(0)
  const [historicoAberto, setHistoricoAberto] = useState(false)
  const [telefoneClienteEdicao, setTelefoneClienteEdicao] = useState('')
  const [erroTelefone, setErroTelefone] = useState<string | null>(null)
  const [salvandoTelefone, setSalvandoTelefone] = useState(false)
  const autosaveQueueRef = useRef<AutosaveSerialQueue | null>(null)
  const formContentRef = useRef<HTMLDivElement | null>(null)
  const actionBarRef = useRef<HTMLDivElement | null>(null)
  const [actionBarHeight, setActionBarHeight] = useState(0)
  const fichaRef = useRef(ficha)
  const telefoneDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const telefoneRequestRef = useRef(0)
  const telefoneSaveRef = useRef<Promise<void> | null>(null)
  const telefoneClienteSincronizadoRef = useRef('')
  const clienteSelecionadaRef = useRef<ClientePresencialDTO | null>(null)
  const mountedRef = useRef(false)
  const concluindoRef = useRef(false)
  const focoCriancaSelecionadaRef = useRef<string | null>(null)
  const draftClientIdRef = useRef<string | null>(null)
  const tentativaUnidadeRef = useRef('')
  const tentativaNomeRef = useRef('')
  const autoIniciandoRef = useRef(false)
  const criacaoPromiseRef = useRef<Promise<AtendimentoPresencialDTO | null> | null>(null)
  const novoAtendimentoRef = useRef(false)
  fichaRef.current = ficha
  clienteSelecionadaRef.current = clienteSelecionada
  const entradasLocais: EntradasLocaisRascunho = { novoCliente, dataPrevistaInputs, viradaCartaoInput, produtoDigitado, numeroLancamento, telefonePendente }
  const entradasLocaisRef = useRef(entradasLocais)
  entradasLocaisRef.current = entradasLocais
  const ativoRef = useRef(ativo)
  ativoRef.current = ativo
  const unidadeIdRef = useRef(unidadeId)
  unidadeIdRef.current = unidadeId
  const persistirLocalRef = useRef<() => void>(() => undefined)
  const pendenciasLocais = temEntradasLocaisPendentes(entradasLocais) || temDadosIntermediariosRascunho(ficha)

  function definirClienteId(id: string | null) {
    clienteIdRef.current = id
    setClienteId(id)
  }

  function obterEditorId() {
    if (!editorIdRef.current) editorIdRef.current = gerarIdLocal('editor')
    return editorIdRef.current
  }

  function carregarCacheLocal(draftClientId: string, editorId?: string) {
    try {
      return carregarCacheRascunho(window.localStorage, usuarioId, draftClientId, editorId)
    } catch {
      setErroCache(true)
      return null
    }
  }

  function restaurarEntradasLocais(entradas?: EntradasLocaisRascunho) {
    const dados = fichaRef.current
    const valores = entradas ?? {
      novoCliente: { nome: '', telefone: '', parentesco: '' as const, parentescoOutro: '' },
      dataPrevistaInputs: Object.fromEntries(dados.criancas.map((crianca) => [crianca.id, formatarDataISOParaInput(crianca.dataPrevistaNascimento)])),
      viradaCartaoInput: formatarViradaCartao(dados.viradaCartaoDia, dados.viradaCartaoMes),
      produtoDigitado: '', numeroLancamento: '', telefonePendente: null,
    }
    entradasLocaisRef.current = valores
    setNovoCliente(valores.novoCliente)
    setDataPrevistaInputs(valores.dataPrevistaInputs)
    setViradaCartaoInput(valores.viradaCartaoInput)
    setProdutoDigitado(valores.produtoDigitado)
    setNumeroLancamento(valores.numeroLancamento)
    setTelefonePendente(valores.telefonePendente)
  }

  // Revisão legada volta à primeira etapa sem apagar dados.
  const etapaAtual = ficha.etapaAtual === 'resultado' && ficha.tipoAtendimento === 'cliente'
    && (ficha.resultadoAtendimento === 'nao' || ficha.resultadoAtendimento === 'negociacao') ? 'resultado' : 'ficha'
  const etapaNumero = etapaAtual === 'resultado' ? 2 : 1
  const camposComerciaisVisiveis = ficha.tipoAtendimento === 'cliente'
  const etapaLabelAtual = etapaLabels[etapaAtual]
  const unidadesParaSelecao = useMemo(() => contexto?.unidadesPermitidas ?? [], [contexto])

  useEffect(() => {
    const id = focoCriancaSelecionadaRef.current
    if (!id) return
    const card = document.getElementById(id)
    if (!card) return
    focoCriancaSelecionadaRef.current = null
    const frame = window.requestAnimationFrame(() => {
      card.style.scrollMarginTop = '8rem'
      card.style.scrollMarginBottom = `${(actionBarRef.current?.offsetHeight ?? 160) + 24}px`
      card.focus({ preventScroll: true })
      card.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [ficha.criancas])

  useEffect(() => {
    const viewport = window.visualViewport
    let alturaSemTeclado = window.innerHeight
    const atualizarRodape = () => {
      const mobile = window.innerWidth < 640
      const alturaVisivel = viewport?.height ?? window.innerHeight
      const editando = document.activeElement?.matches('input, textarea, [contenteditable="true"]')
      if (!editando) alturaSemTeclado = window.innerHeight
      const tecladoAberto = mobile && editando && alturaSemTeclado - alturaVisivel > 150
      const percurso = document.documentElement.scrollHeight - window.innerHeight
      setRodapeVisivel(!tecladoAberto && (!mobile || percurso <= 0 || window.scrollY >= percurso * 0.8))
    }
    atualizarRodape()
    window.addEventListener('scroll', atualizarRodape, { passive: true })
    window.addEventListener('resize', atualizarRodape)
    document.addEventListener('focusin', atualizarRodape)
    document.addEventListener('focusout', atualizarRodape)
    viewport?.addEventListener('resize', atualizarRodape)
    const observer = new ResizeObserver(atualizarRodape)
    observer.observe(document.documentElement)
    return () => {
      window.removeEventListener('scroll', atualizarRodape)
      window.removeEventListener('resize', atualizarRodape)
      document.removeEventListener('focusin', atualizarRodape)
      document.removeEventListener('focusout', atualizarRodape)
      viewport?.removeEventListener('resize', atualizarRodape)
      observer.disconnect()
    }
  }, [])

  useEffect(() => {
    if (!mensagemConclusao) return
    const id = toast.success(mensagemConclusao, { duration: 3000, position: 'top-center' })
    window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })
    const timeout = window.setTimeout(() => {
      setMensagemConclusao(null)
    }, 3000)
    return () => { window.clearTimeout(timeout); toast.dismiss(id) }
  }, [mensagemConclusao])

  useEffect(() => {
    const actionBar = actionBarRef.current
    if (!actionBar) return
    const updateHeight = () => setActionBarHeight(actionBar.getBoundingClientRect().height)
    updateHeight()
    const observer = new ResizeObserver(updateHeight)
    observer.observe(actionBar)
    return () => observer.disconnect()
  }, [carregandoRascunhoInicial, erroRascunhoInicial])

  useEffect(() => {
    const controller = new AbortController()
    setConsultorasRecentes([])
    setErroSugestoes(null)
    if (!unidadeId) return () => controller.abort()
    void (async () => {
      try {
        const response = await fetch(`/api/atendimento-presencial/consultoras-recentes?unidadeId=${encodeURIComponent(unidadeId)}`, { signal: controller.signal, cache: 'no-store' })
        const data = await response.json() as { ok: boolean; nomes?: string[]; message?: string }
        if (!response.ok || !data.ok) throw new Error(data.message ?? 'Não foi possível carregar as últimas consultoras.')
        if (!controller.signal.aborted) setConsultorasRecentes(data.nomes ?? [])
      } catch (error) {
        if (!controller.signal.aborted) setErroSugestoes(error instanceof Error ? error.message : 'Não foi possível carregar as últimas consultoras.')
      }
    })()
    return () => controller.abort()
  }, [usuarioId, unidadeId, mensagemConclusao])

  const consultoraNomeNormalizado = useMemo(() => normalizarNomeConsultora(ficha.consultoraNome), [ficha.consultoraNome])
  const rascunhoIdParam = rascunhoIdInicial === rascunhoEncerrado ? null : rascunhoIdInicial

  const podeCriarRascunho = useMemo(() => {
    if (!contexto || iniciando || ativo) return false
    if (unidadesParaSelecao.length === 0) return false
    if (!unidadeId || !unidadesParaSelecao.some((unidade) => unidade.id === unidadeId)) return false
    if (!consultoraNomeNormalizado || !validarNomeConsultora(consultoraNomeNormalizado)) return false
    if (rascunhoIdParam) return false
    return true
  }, [ativo, contexto, iniciando, consultoraNomeNormalizado, unidadeId, unidadesParaSelecao, rascunhoIdParam])


  function atualizarFicha(mutator: (atual: FichaDadosRascunho) => FichaDadosRascunho) {
    setMensagemConclusao(null)
    setFicha((atual) => mutator(atual))
  }

  async function carregarClientePorId(id: string | null) {
    const requestId = ++clienteRequestRef.current
    setClienteSelecionada(null)
    setErroCliente(null)
    if (!id) return
    try {
      const response = await fetch(`/api/atendimento-presencial/clientes/${id}`, { cache: 'no-store' })
      const data = (await response.json()) as ApiClientesResponse
      if (!response.ok || !data.ok || !data.cliente) throw new Error('Cliente indisponivel')
      if (requestId === clienteRequestRef.current && clienteIdRef.current === id) setClienteSelecionada(data.cliente)
    } catch {
      if (requestId === clienteRequestRef.current) setErroCliente('Nao foi possivel carregar a cliente. O vinculo foi preservado; tente novamente.')
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
        const response = await requisicaoLimitada(`/api/atendimento-presencial/atendimentos/${rascunhoIdParam}/rascunho`, { cache: 'no-store' })
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
      persistirLocalRef.current()
      const fila = autosaveQueueRef.current
      // A copia local independe da conclusao da requisicao durante a saida.
      if (fila && !conflitoLocalRef.current) void fila.flushNow(montarPayloadAutosave()).finally(() => { if (!mountedRef.current) fila.stop() })
      if (telefoneDebounceRef.current) clearTimeout(telefoneDebounceRef.current)
    }
  }, [])

  useEffect(() => {
    const cliente = clienteSelecionadaRef.current
    const sincronizacao = cliente?.id ?? ''
    if (telefoneClienteSincronizadoRef.current === sincronizacao) return
    telefoneClienteSincronizadoRef.current = sincronizacao
    const pendente = entradasLocaisRef.current.telefonePendente
    setTelefoneClienteEdicao(pendente && pendente.clienteId === cliente?.id ? pendente.valor : telefoneFormatadoDaCliente(cliente))
    setErroTelefone(null)
    if (telefoneDebounceRef.current) {
      clearTimeout(telefoneDebounceRef.current)
      telefoneDebounceRef.current = null
    }
  }, [clienteSelecionada?.id])

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
  }, [ativo, iniciando, concluindo, carregandoRascunhoInicial, rascunhoIdParam, unidadeId, unidadesParaSelecao, consultoraNomeNormalizado, onlineTick])

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
      tentativaUnidadeRef.current = ''
      tentativaNomeRef.current = ''
      setOnlineTick((valor) => valor + 1)
    }
    window.addEventListener('online', handleOnline)
    return () => window.removeEventListener('online', handleOnline)
  }, [])

  function montarPayloadAutosave(
    fichaAtual = fichaRef.current
  ): AutosavePayload {
    const entradas = entradasLocaisRef.current
    const dados = { ...fichaAtual, ...(fichaAtual.entradasFormulario || temEntradasLocaisPendentes(entradas) ? { entradasFormulario: entradas } : {}) }
    const validacao = validarFichaDadosRascunho(dados)
    return {
      // Falha de validacao deve ser rejeitada pela API, nunca virar um formulario vazio.
      dadosRascunho: validacao.ok ? validacao.dados : dados,
      clienteId: clienteIdRef.current,
    }
  }

  function salvarCacheLocalRascunho(params: {
    rascunho: AtendimentoPresencialDTO
    payload: AutosavePayload
    sincronizado: boolean
    version?: number
  }) {
    persistirCacheLocal(params.rascunho, params.payload, params.version, params.sincronizado)
  }

  function persistirCacheLocal(rascunho = ativoRef.current, payload = montarPayloadAutosave(), version?: number, sincronizado?: boolean) {
    if (conflitoLocalRef.current) return
    if (!rascunho && !fichaRef.current.consultoraNome && !clienteIdRef.current && !temEntradasLocaisPendentes(entradasLocaisRef.current)
      && JSON.stringify(fichaRef.current) === JSON.stringify(criarPayloadInicial())) return
    if (!draftClientIdRef.current) draftClientIdRef.current = gerarIdLocal('draft')
    const fila = autosaveQueueRef.current
    const confirmado = sincronizado ?? (!!fila && serializarPayloadAutosave(payload) === fila.getLastSavedPayload() && !fila.hasPending())
    try {
      const ok = salvarCacheRascunho(window.localStorage, {
        draftClientId: rascunho?.draftClientId ?? draftClientIdRef.current,
        usuarioId, atendimentoId: rascunho?.id ?? null,
        version: version ?? fila?.getVersion() ?? rascunho?.version ?? null,
        clienteId: clienteIdRef.current, unidadeId: unidadeIdRef.current, editorId: obterEditorId(),
        dadosRascunho: fichaRef.current, entradasLocais: entradasLocaisRef.current,
        basesRecuperacao: fila?.getBasesRecuperacao(),
        atualizadoEm: new Date().toISOString(),
        sincronizado: confirmado,
      })
      if (ok && cacheRecuperadoRef.current) {
        // A copia recuperada ja esta preservada neste editor; evita conflitos falsos na proxima retomada.
        salvarCacheRascunho(window.localStorage, { ...cacheRecuperadoRef.current, arquivado: true })
        cacheRecuperadoRef.current = null
      }
      if (mountedRef.current) setErroCache(!ok)
    } catch {
      if (mountedRef.current) setErroCache(true)
    }
  }
  persistirLocalRef.current = () => persistirCacheLocal()

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
      payload: montarPayloadAutosave(),
      version: params.rascunho.version,
      sincronizado: params.sincronizado && serializarPayloadAutosave(montarPayloadAutosave()) === autosaveQueueRef.current?.getLastSavedPayload(),
    })
  }

  function criarFilaAutosave(rascunho: AtendimentoPresencialDTO, payloadSalvoSerializado: string, recoveryBases?: string[]) {
    autosaveQueueRef.current?.stop()
    autosaveQueueRef.current = new AutosaveSerialQueue({
      draftId: rascunho.draftClientId,
      initialVersion: rascunho.version,
      initialRascunho: rascunho,
      initialSavedPayload: payloadSalvoSerializado,
      recoveryBases,
      save: async ({ payload, expectedVersion }): Promise<AutosaveSaveResult> => {
        const response = await requisicaoLimitada(`/api/atendimento-presencial/atendimentos/${rascunho.id}/rascunho`, {
          method: 'PATCH',
          keepalive: true,
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
        salvarCacheLocalRascunho({ rascunho, payload, sincronizado: false })
        if (servidor) {
          const cache = carregarCacheLocal(rascunho.draftClientId, obterEditorId())
          if (cache) { conflitoLocalRef.current = true; setConflitoLocal({ cache, servidor }) }
        }
        if (!payloadIgual && !servidor) setErro('Nao foi possivel recuperar o rascunho. Tente carregar novamente.')
      },
      onLog: (message) => console.log(message),
      getOnline: () => navigator.onLine,
    })
  }

  function aplicarRascunho(rascunho: AtendimentoPresencialDTO, cacheEscolhido?: RascunhoCache | null) {
    const cache = cacheEscolhido === undefined ? carregarCacheLocal(rascunho.draftClientId) : cacheEscolhido
    const recuperacao = planejarRecuperacaoRascunho(cache, rascunho)
    if (recuperacao.conflito && cache) {
      autosaveQueueRef.current?.stop()
      conflitoLocalRef.current = true
      setConflitoLocal({ cache, servidor: rascunho })
      setStatusSync('conflito')
      return
    }
    conflitoLocalRef.current = false
    setConflitoLocal(null)
    setAtivo(rascunho)
    ativoRef.current = rascunho
    draftClientIdRef.current = rascunho.draftClientId
    setUnidadeId(rascunho.unidadeId)
    const dados = recuperacao.usarCache && cache ? cache.dadosRascunho : migrarFichaDadosRascunho(rascunho.dadosRascunho)
    cacheRecuperadoRef.current = recuperacao.usarCache ? cache : null
    criarFilaAutosave(rascunho, serializarPayloadAutosave({ dadosRascunho: rascunho.dadosRascunho, clienteId: rascunho.clienteId }), recuperacao.usarCache ? cache?.basesRecuperacao : undefined)
    fichaRef.current = dados
    setFicha(dados)
    definirClienteId(recuperacao.clienteId)
    setDataPrevistaInputs(Object.fromEntries(dados.criancas.map((crianca) => [crianca.id, formatarDataISOParaInput(crianca.dataPrevistaNascimento)])))
    setViradaCartaoInput(formatarViradaCartao(dados.viradaCartaoDia, dados.viradaCartaoMes))
    setNumeroLancamento('')
    setErrosValidacao([])
    setErroEtapa(null)
    setMensagemConclusao(null)
    restaurarEntradasLocais(recuperacao.usarCache && cache?.entradasLocais ? cache.entradasLocais : dados.entradasFormulario)
    const alterado = serializarPayloadAutosave(montarPayloadAutosave()) !== autosaveQueueRef.current?.getLastSavedPayload()
    setStatusSync(alterado ? 'salvando' : 'salvo')
    void carregarClientePorId(recuperacao.clienteId)
  }

  async function recuperarCache(cache: RascunhoCache) {
    if (cache.atendimentoId) {
      router.push(`/atendimento-presencial/prancheta?rascunho=${cache.atendimentoId}`)
      return
    }
    draftClientIdRef.current = cache.draftClientId
    cacheRecuperadoRef.current = cache
    fichaRef.current = cache.dadosRascunho
    setFicha(cache.dadosRascunho)
    setUnidadeId(cache.unidadeId ?? '')
    definirClienteId(cache.clienteId ?? null)
    restaurarEntradasLocais(cache.entradasLocais)
    setCachesRecuperaveis([])
    void carregarClientePorId(cache.clienteId ?? null)
  }

  function resolverConflitoLocal(usarLocal: boolean) {
    if (!conflitoLocal) return
    const { cache, servidor } = conflitoLocal
    // Escolha explicita: preserva a outra copia e usa a versao atual como base.
    salvarCacheRascunho(window.localStorage, { ...cache, arquivado: true })
    conflitoLocalRef.current = false
    setConflitoLocal(null)
    editorIdRef.current = gerarIdLocal('editor')
    aplicarRascunho(servidor, usarLocal ? { ...cache, version: servidor.version } : null)
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

    // Nao reaplicar snapshots: o usuario pode ter continuado digitando durante o POST.
    draftClientIdRef.current = rascunho.draftClientId
    const fila = autosaveQueueRef.current
    persistirCacheLocal(rascunho)
    if (fila) await fila.flushNow(montarPayloadAutosave())
  }

  function iniciarRascunho(draftClientId?: string) {
    if (criacaoPromiseRef.current) return criacaoPromiseRef.current
    const promise = criarRascunhoNoServidor(draftClientId).finally(() => { criacaoPromiseRef.current = null })
    criacaoPromiseRef.current = promise
    return promise
  }

  async function criarRascunhoNoServidor(draftClientId?: string): Promise<AtendimentoPresencialDTO | null> {
    if (!contexto || !podeCriarRascunho) {
      return null
    }
    setIniciando(true)
    setErroCriacao(null)

    const draftClientIdFinal = draftClientId || draftClientIdRef.current || gerarIdLocal('draft')
    if (!draftClientIdRef.current) draftClientIdRef.current = draftClientIdFinal

    const unidadeFinal = unidadeId || unidadesParaSelecao[0]?.id
    const consultoraNomeFinal = normalizarNomeConsultora(ficha.consultoraNome)
    const clienteIdFinal = clienteIdRef.current

    const dadosRascunhoEnviados: FichaDadosRascunho = {
      ...ficha,
      consultoraNome: consultoraNomeFinal,
    }
    const payloadEnviado: AutosavePayload = {
      dadosRascunho: montarPayloadAutosave(dadosRascunhoEnviados).dadosRascunho,
      clienteId: clienteIdFinal,
    }

    try {
      const response = await requisicaoLimitada('/api/atendimento-presencial/atendimentos/rascunhos', {
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
      return data.rascunho
    } catch (error) {
      setErroCriacao(error instanceof Error ? error.message : 'Erro ao criar rascunho')
      return null
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
    setTelefonePendente({ clienteId: cliente.id, valor: telefone })
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
    const anterior = telefoneSaveRef.current
    let liberar!: () => void
    const atual = new Promise<void>((resolve) => { liberar = resolve })
    telefoneSaveRef.current = atual
    await anterior
    setSalvandoTelefone(true)
    try {
      if (requestId !== telefoneRequestRef.current || clienteIdRef.current !== cliente.id) return
      const versaoAtual = clienteSelecionadaRef.current?.version ?? cliente.version
      const response = await fetch(`/api/atendimento-presencial/clientes/${cliente.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telefone: telefone || null, version: versaoAtual }),
      })
      const data = (await response.json()) as ApiClientesResponse
      if (clienteIdRef.current !== cliente.id) return
      if (data.cliente) {
        // Mesmo uma resposta antiga atualiza a versao, mas nao substitui o texto mais recente.
        const pendente = entradasLocaisRef.current.telefonePendente
        const dto = requestId === telefoneRequestRef.current ? data.cliente : {
          ...data.cliente, telefone: pendente?.valor ?? null, telefoneFormatado: pendente?.valor ?? null,
        }
        clienteSelecionadaRef.current = dto
        setClienteSelecionada(dto)
      }
      if (requestId !== telefoneRequestRef.current) return
      if (!response.ok || !data.ok || !data.cliente) throw new Error(data.message ?? 'Erro ao atualizar telefone')
      setTelefonePendente(null)
      setErroTelefone(null)
      setTelefoneClienteEdicao(data.cliente.telefoneFormatado ?? '')
    } catch (error) {
      if (requestId === telefoneRequestRef.current && mountedRef.current) {
        setErroTelefone(error instanceof Error ? error.message : 'Erro ao atualizar telefone')
      }
    } finally {
      liberar()
      if (telefoneSaveRef.current === atual) telefoneSaveRef.current = null
      if (requestId === telefoneRequestRef.current && mountedRef.current) setSalvandoTelefone(false)
    }
  }

  async function descartarEdicaoTelefone() {
    const id = telefonePendente?.clienteId
    if (!id) return
    if (telefoneDebounceRef.current) clearTimeout(telefoneDebounceRef.current)
    const requestId = ++telefoneRequestRef.current
    // Uma requisicao ja enviada pode ter sido aceita. Releia o cadastro apos sua resposta.
    await telefoneSaveRef.current
    if (requestId !== telefoneRequestRef.current) return
    setTelefonePendente(null)
    setSalvandoTelefone(false)
    setErroTelefone(null)
    await carregarClientePorId(id)
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
      if ((!response.ok || !data.ok) && response.status < 500) {
        registrarErrosValidacao([{ sectionId: 'secao-cliente', fieldId: 'busca-cliente', message: data.message ?? 'Revise a busca.' }])
        return
      }
      if (!response.ok || !data.ok) throw new Error(data.message ?? 'Erro ao buscar clientes')
      setClientesEncontradas(data.clientes ?? [])
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Erro ao buscar clientes')
    } finally {
      setBuscandoCliente(false)
    }
  }

  function selecionarCliente(cliente: ClientePresencialDTO) {
    const clienteAnterior = clienteIdRef.current
    ++clienteRequestRef.current
    definirClienteId(cliente.id)
    setErroCliente(null)
    setClienteSelecionada(cliente)
    setBuscaCliente('')
    setClientesEncontradas([])
    atualizarFicha((atual) => ({
      ...atual,
      cliente: undefined,
      criancas: clienteAnterior && clienteAnterior !== cliente.id ? [] : atual.criancas.filter((crianca) => !crianca.vinculoClienteId || crianca.vinculoClienteId === cliente.id),
    }))
  }

  async function consultarDuplicidade(telefone: string, signal?: AbortSignal) {
    const normalizado = normalizarTelefone(telefone)
    if (!normalizado.valido || !normalizado.telefoneNormalizado) return null
    const response = await fetch(`/api/atendimento-presencial/clientes?telefoneExato=${encodeURIComponent(normalizado.telefoneNormalizado)}`, { cache: 'no-store', signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(20000)]) : AbortSignal.timeout(20000) })
    const data = await response.json() as ApiClientesResponse & { ambiguo?: boolean }
    if (!response.ok || !data.ok) throw new Error(data.message ?? 'Não foi possível conferir o telefone. Tente novamente antes de cadastrar.')
    const clientes = data.clientes ?? []
    return { telefone: normalizado.telefoneNormalizado, cliente: clientes.length === 1 ? clientes[0] : null, ambiguo: Boolean(data.ambiguo) || clientes.length > 1 }
  }

  useEffect(() => {
    const geracao = ++duplicidadeGeracaoRef.current
    const controller = new AbortController()
    setDuplicidade(null)
    setErroDuplicidade(null)
    setConferindoDuplicidade(false)
    if (clienteId || !normalizarTelefone(novoCliente.telefone).valido) return () => controller.abort()
    const timer = window.setTimeout(() => {
      setConferindoDuplicidade(true)
      void consultarDuplicidade(novoCliente.telefone, controller.signal).then((resultado) => {
        if (geracao === duplicidadeGeracaoRef.current && !controller.signal.aborted) setDuplicidade(resultado)
      }).catch((error) => {
        if (geracao === duplicidadeGeracaoRef.current && !controller.signal.aborted) setErroDuplicidade(error instanceof Error ? error.message : 'Não foi possível conferir o telefone.')
      }).finally(() => {
        if (geracao === duplicidadeGeracaoRef.current && !controller.signal.aborted) setConferindoDuplicidade(false)
      })
    }, 500)
    return () => { window.clearTimeout(timer); controller.abort() }
  }, [novoCliente.telefone, clienteId])

  async function cadastrarCliente() {
    if (cadastroEmCursoRef.current) return
    const validacao = validarPayloadCliente({ nome: novoCliente.nome, telefone: novoCliente.telefone })
    if (!validacao.ok) {
      setErroCadastro(validacao)
      window.requestAnimationFrame(() => document.getElementById(`nova-cliente-${validacao.field === 'parentescoOutro' ? 'parentesco-outro' : validacao.field}`)?.focus())
      return
    }
    cadastroEmCursoRef.current = true
    setCadastrandoCliente(true)
    setErroCadastro(null)
    setErro(null)
    try {
      const geracao = duplicidadeGeracaoRef.current
      const resultado = await consultarDuplicidade(novoCliente.telefone)
      if (!mountedRef.current || geracao !== duplicidadeGeracaoRef.current) return
      setDuplicidade(resultado)
      setErroDuplicidade(null)
      if (resultado?.cliente || resultado?.ambiguo) return
      const response = await fetch('/api/atendimento-presencial/clientes', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nome: novoCliente.nome, telefone: novoCliente.telefone }),
      })
      const data = (await response.json()) as ApiClientesResponse
      if (!mountedRef.current || geracao !== duplicidadeGeracaoRef.current) return
      if (!response.ok || !data.ok || !data.cliente) {
        if (data.field) {
          setErroCadastro({ field: data.field, message: data.message ?? 'Revise o campo informado.' })
          document.getElementById(`nova-cliente-${data.field === 'parentescoOutro' ? 'parentesco-outro' : data.field}`)?.focus()
          return
        }
        throw new Error(data.message ?? 'Erro ao cadastrar cliente')
      }
      if (data.clienteExistente) {
        setDuplicidade({ telefone: normalizarTelefone(novoCliente.telefone).telefoneNormalizado ?? '', cliente: data.cliente, ambiguo: false })
        return
      }
      selecionarCliente(data.cliente)
      setNovoCliente({ nome: '', telefone: '', parentesco: '', parentescoOutro: '' })
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Erro ao cadastrar cliente')
    } finally {
      cadastroEmCursoRef.current = false
      setCadastrandoCliente(false)
    }
  }

  function trocarCliente() {
    if (telefonePendente) { setErroTelefone('Salve ou descarte a edicao do telefone antes de trocar a cliente.'); return }
    ++clienteRequestRef.current
    definirClienteId(null)
    setErroCliente(null)
    setClienteSelecionada(null)
    setHistoricoAberto(false)
    atualizarFicha((atual) => ({ ...atual, cliente: undefined, criancas: [] }))
  }

  async function recarregarRascunhoDoServidor() {
    if (!ativo) return
    setErro(null)
    try {
      const response = await fetch(`/api/atendimento-presencial/atendimentos/${ativo.id}/rascunho`, { cache: 'no-store' })
      const data = (await response.json()) as ApiRascunhoResponse
      if (!response.ok || !data.ok || !data.rascunho) throw new Error(data.message ?? 'Erro ao recarregar rascunho')
      aplicarRascunho(data.rascunho)
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Erro ao recarregar rascunho')
    }
  }

  function irParaEtapa(etapa: FichaEtapa) {
    setErroConclusao(null)
    setErroEtapa(null)
    setErrosValidacao([])
    atualizarFicha((atual) => ({ ...atual, etapaAtual: etapa }))
    window.requestAnimationFrame(() => formContentRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  function revelarAlvo(id: string, fallbackId?: string) {
    window.requestAnimationFrame(() => {
      const container = document.getElementById(id) ?? (fallbackId ? document.getElementById(fallbackId) : null)
      if (!container) return
      const alvo = container.matches('input, textarea, button, select, [tabindex]') ? container : container.querySelector<HTMLElement>('input:not(:disabled), textarea:not(:disabled), button:not(:disabled), select:not(:disabled), [tabindex]') ?? container
      alvo.style.scrollMarginTop = '8rem'
      alvo.style.scrollMarginBottom = `${(actionBarRef.current?.offsetHeight ?? 160) + 24}px`
      if (!alvo.matches('input, textarea, button, select, a[href], [tabindex]')) alvo.tabIndex = -1
      alvo.focus({ preventScroll: true })
      alvo.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
  }

  function mostrarErroConclusao(message: string) {
    setErroConclusao(message)
    revelarAlvo('alerta-geral-prancheta', 'alerta-conflito-prancheta')
  }

  function scrollParaErro(erro: ErroValidacaoFicha) {
    revelarAlvo(erro.fieldId ?? erro.sectionId, erro.sectionId)
  }

  function etapaParaErro(erro: ErroValidacaoFicha): FichaEtapa {
    if (erro.sectionId.includes('resultado') && erro.sectionId !== 'secao-resultado-fechamento') return 'resultado'
    return 'ficha'
  }

  function navegarParaErro(erro: ErroValidacaoFicha) {
    const etapaErro = etapaParaErro(erro)
    if (etapaErro !== etapaAtual) {
      setFicha((atual) => ({ ...atual, etapaAtual: etapaErro }))
      window.requestAnimationFrame(() => scrollParaErro(erro))
      return
    }
    scrollParaErro(erro)
  }

  function registrarErrosValidacao(erros: ErroValidacaoFicha[]) {
    setErrosValidacao(erros)
    setErroEtapa(erros.length === 1 ? erros[0].message : 'Revise os campos destacados antes de continuar.')
    if (erros[0]) navegarParaErro(erros[0])
  }

  const valoresErro = useMemo(() => ({
    'secao-unidade': unidadeId,
    'secao-consultora-nome': ficha.consultoraNome,
    'secao-tipo': ficha.tipoAtendimento,
    'secao-visita': ficha.motivoVisita,
    'secao-cliente': clienteSelecionada?.id,
    'secao-crianca': JSON.stringify([ficha.criancas, dataPrevistaInputs]),
    'secao-departamentos': JSON.stringify(ficha.departamentos),
    'secao-produtos': JSON.stringify(ficha.produtosInteresse),
    'secao-observacoes': ficha.observacoes,
    'secao-resultado-fechamento': ficha.resultadoAtendimento,
    'secao-resultado-produto': JSON.stringify(ficha.motivosResultado),
    'secao-resultado-condicao': viradaCartaoInput,
    'secao-resultado-outro': ficha.motivoOutro,
    'secao-resultado-observacao': ficha.observacaoNaoFechamento,
    'secao-lancamento': numeroLancamento,
  }), [unidadeId, ficha, clienteSelecionada, dataPrevistaInputs, viradaCartaoInput, numeroLancamento])
  const valoresErroAnteriores = useRef(valoresErro)
  useEffect(() => {
    const anteriores = valoresErroAnteriores.current
    valoresErroAnteriores.current = valoresErro
    const invalidos = [
      ...validarEtapa({ etapa: 'ficha', ficha, clienteSelecionada, dataPrevistaInputs }),
      ...validarEtapa({ etapa: 'resultado', ficha, clienteSelecionada }),
    ]
    setErrosValidacao((atuais) => {
      const restantes = atuais.filter((item) => {
        const chave = item.sectionId as keyof typeof valoresErro
        if (valoresErro[chave] === anteriores[chave]) return true
        if (chave === 'secao-lancamento') return !validarNumeroLancamento(numeroLancamento).ok
        return invalidos.some((invalido) => invalido.sectionId === chave)
      })
      return restantes.length === atuais.length ? atuais : restantes
    })
  }, [valoresErro, ficha, clienteSelecionada, numeroLancamento, dataPrevistaInputs])
  useEffect(() => {
    if (errosValidacao.length === 0) setErroEtapa(null)
  }, [errosValidacao])
  const cadastroAnterior = useRef(novoCliente)
  useEffect(() => {
    const anterior = cadastroAnterior.current
    cadastroAnterior.current = novoCliente
    if (!erroCadastro) return
    const field = erroCadastro.field as keyof typeof novoCliente
    if (anterior[field] !== novoCliente[field]) {
      const validacao = validarPayloadCliente({ nome: novoCliente.nome, telefone: novoCliente.telefone })
      if (validacao.ok || validacao.field !== field) setErroCadastro(null)
    }
  }, [novoCliente, erroCadastro])

  function erroSecao(sectionId: string) {
    return primeiroErroPorSecao(errosValidacao, sectionId)
  }

  function escolherResultado(resultado: ResultadoAtendimento) {
    const proximaFicha: FichaDadosRascunho = { ...ficha, versaoFluxo: 2, resultadoAtendimento: resultado }
    atualizarFicha(() => proximaFicha)
    const erros = validarEtapa({ etapa: 'ficha', ficha: proximaFicha, clienteSelecionada, dataPrevistaInputs })
    if (!unidadeId) erros.unshift({ sectionId: 'secao-unidade', message: 'Selecione a unidade.' })
    if (erros.length) return registrarErrosValidacao(erros)
    if (resultado === 'sim') void concluirAtendimento(proximaFicha)
    else irParaEtapa('resultado')
  }

  function voltar() { irParaEtapa('ficha') }

  function adicionarCrianca() {
    if (fichaRef.current.criancas.length >= FICHA_CRIANCAS_MAX_ITENS) {
      setErroEtapa('O atendimento permite no maximo oito criancas.')
      return
    }
    const crianca = criarCriancaRascunho(gerarIdLocal('crianca'))
    atualizarFicha((atual) => ({
      ...atual,
      criancas: atual.criancas.length >= FICHA_CRIANCAS_MAX_ITENS ? atual.criancas : [...atual.criancas, crianca],
    }))
  }

  function atualizarCrianca(id: string, patch: Partial<FichaCriancaRascunho>) {
    if (patch.idadeValor !== undefined) {
      const anterior = fichaRef.current.criancas.find((c) => c.id === id)
      const unidade = patch.idadeUnidade ?? anterior?.idadeUnidade
      if (unidade && patch.idadeValor > 0) patch = { ...patch, dataReferenciaNascimento: calcularReferenciaNascimento(dataAtendimentoLocal(ativo?.iniciadoEm), unidade, patch.idadeValor) }
    } else if (Object.hasOwn(patch, 'idadeUnidade') || Object.hasOwn(patch, 'situacao') || Object.hasOwn(patch, 'presenteJaNasceu')) patch = { ...patch, dataReferenciaNascimento: undefined }
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

  function atualizarDataPrevistaCrianca(id: string, valorFormatado: string) {
    const dataISO = converterDataInputParaISO(valorFormatado)
    setDataPrevistaInputs((atual) => ({ ...atual, [id]: valorFormatado }))
    atualizarCrianca(id, { dataPrevistaNascimento: dataISO || undefined })
  }

  function atualizarNomeCrianca(id: string, valor: string) {
    atualizarCrianca(id, { nome: limparNomeCriancaDigitacao(valor), nomeNaoInformado: false })
  }

  function marcarNomeNaoInformado(id: string) {
    atualizarCrianca(id, { nome: undefined, nomeNaoInformado: true })
  }

  function limparErroViradaCartao() {
    const restantes = errosValidacao.filter((item) => item.fieldId !== 'virada-cartao')
    if (restantes.length === errosValidacao.length) return
    setErrosValidacao(restantes)
    setErroEtapa(restantes.length === 0 ? null : restantes.length === 1 ? restantes[0].message : 'Revise os campos destacados antes de continuar.')
  }

  function atualizarNumeroLancamento(valor: string) {
    setNumeroLancamento(valor)
    const validacao = validarNumeroLancamento(valor)
    const tinhaErro = errosValidacao.some((item) => item.fieldId === 'numero-lancamento')
    if (!tinhaErro) return
    const restantes = errosValidacao.filter((item) => item.fieldId !== 'numero-lancamento')
    const erros = validacao.ok ? restantes : [...restantes, erroConclusaoParaSecao(validacao.field, validacao.message)]
    setErrosValidacao(erros)
    setErroEtapa(erros.length === 0 ? null : erros.length === 1 ? erros[0].message : 'Revise os campos destacados antes de continuar.')
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
    if (convertida) limparErroViradaCartao()
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
    if (chave === 'virada_cartao' && ficha.motivosResultado.includes(chave)) limparErroViradaCartao()
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
    if (field === 'unidadeId') return { sectionId: 'secao-unidade', message }
    if (field === 'tipoAtendimento') return { sectionId: 'secao-tipo', message }
    if (field === 'motivoVisita') return { sectionId: 'secao-visita', message }
    if (field === 'observacaoNaoFechamento') return { sectionId: 'secao-resultado-observacao', fieldId: 'observacao-nao-fechamento', message }
    if (field === 'observacoes') return { sectionId: 'secao-observacoes', fieldId: 'observacoes', message }
    if (field === 'produtosInteresse') return { sectionId: 'secao-produtos', message }
    if (field === 'consultoraNome') return { sectionId: 'secao-consultora-nome', fieldId: 'consultora-nome', message }
    if (field === 'clienteId') return { sectionId: 'secao-cliente', fieldId: 'busca-cliente', message }
    if (field === 'criancas') return { sectionId: 'secao-crianca', message }
    if (field === 'departamentos') return { sectionId: 'secao-departamentos', message }
    if (field === 'resultadoAtendimento') return { sectionId: 'secao-tipo', message }
    if (field === 'motivosResultado') return { sectionId: 'secao-resultado-produto', message }
    if (field === 'motivoOutro') return { sectionId: 'secao-resultado-outro', fieldId: 'motivo-outro', message }
    if (field === 'viradaCartao') return { sectionId: 'secao-resultado-condicao', fieldId: 'virada-cartao', message }
    if (field === 'numeroLancamento') return { sectionId: 'secao-lancamento', fieldId: 'numero-lancamento', message }
    return { sectionId: `secao-${etapaAtual}`, message }
  }

  async function garantirRascunhoSalvoAntesDeConcluir() {
    if (conflitoLocalRef.current) throw new Error('Resolva o conflito antes de continuar.')
    if (telefonePendente) throw new Error('Confirme a atualizacao do telefone antes de continuar.')
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
      setRascunhoEncerrado(rascunhoIdInicial)
      setFicha(criarPayloadInicial())
      definirClienteId(null)
      setTelefonePendente(null)
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
      setErroConclusao(null)
      setErroRascunhoInicial(null)
      setCarregandoRascunhoInicial(false)
      telefoneClienteSincronizadoRef.current = ''
      draftClientIdRef.current = null
      ativoRef.current = null
      setCachesRecuperaveis([])
      tentativaUnidadeRef.current = ''
      tentativaNomeRef.current = ''

      if (unidadesParaSelecao.length === 1) {
        setUnidadeId(unidadesParaSelecao[0].id)
      } else {
        setUnidadeId('')
      }

      if (typeof window !== 'undefined' && window.location.search) {
        void router.replace('/atendimento-presencial/prancheta', { scroll: false })
      }
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Erro ao salvar rascunho atual')
    } finally {
      novoAtendimentoRef.current = false
      setIniciandoNovoAtendimento(false)
    }
  }

  async function tentarSalvarNovamente() {
    if (conflitoLocalRef.current) return
    if (!ativo) { await iniciarRascunho(); return }
    const resultado = await autosaveQueueRef.current?.flushNow(montarPayloadAutosave())
    if (resultado && !resultado.ok) setErro(resultado.message)
  }

  async function verRascunhos() {
    if (saindo) return
    setSaindo(true)
    try {
      persistirCacheLocal()
      if (conflitoLocalRef.current) throw new Error('Resolva o conflito antes de sair.')
      if (telefonePendente) throw new Error('O telefone ainda nao foi confirmado. Tente salvar novamente.')
      if (!ativo && (criacaoPromiseRef.current || podeCriarRascunho)) {
        const criado = await (criacaoPromiseRef.current ?? iniciarRascunho())
        if (!criado) throw new Error('Não foi possível salvar o atendimento. O preenchimento foi preservado; tente salvar novamente.')
      }
      if (autosaveQueueRef.current) {
        const resultado = await autosaveQueueRef.current.flushNow(montarPayloadAutosave())
        if (!resultado.ok) throw new Error(resultado.message)
      } else if (ficha.consultoraNome || clienteId) {
        throw new Error('O rascunho ainda nao foi criado. Aguarde ou tente novamente; a copia local foi mantida quando disponivel.')
      }
      router.push('/atendimento-presencial/registros?tab=rascunhos')
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Nao foi possivel confirmar o salvamento.')
    } finally {
      setSaindo(false)
    }
  }

  async function concluirAtendimento(fichaConclusao: FichaDadosRascunho = ficha) {
    if (concluindoRef.current) return
    concluindoRef.current = true
    setConcluindo(true)
    setErroConclusao(null)
    const errosIniciais = validarEtapa({ etapa: 'ficha', ficha: fichaConclusao, clienteSelecionada, dataPrevistaInputs })
    if (!unidadeId) errosIniciais.unshift({ sectionId: 'secao-unidade', message: 'Selecione a unidade.' })
    if (errosIniciais.length) {
      registrarErrosValidacao(errosIniciais)
      concluindoRef.current = false
      setConcluindo(false)
      return
    }
    const validacao = validarFichaParaConclusao({
      ficha: { ...fichaConclusao, versaoFluxo: 2 },
      clienteId: clienteIdRef.current,
      numeroLancamento,
    })
    if (!validacao.ok) {
      const erroValidacao = erroConclusaoParaSecao(validacao.field, validacao.message)
      registrarErrosValidacao([erroValidacao])
      concluindoRef.current = false
      setConcluindo(false)
      return
    }

    if (!ativo) {
      mostrarErroConclusao('Aguarde a criação do rascunho antes de concluir.')
      concluindoRef.current = false
      setConcluindo(false)
      return
    }
    setErro(null)
    setErroEtapa(null)
    setErrosValidacao([])
    setMensagemConclusao(null)
    try {
      const rascunhoSalvo = await garantirRascunhoSalvoAntesDeConcluir()
      if (!rascunhoSalvo) throw new Error('Rascunho nao encontrado')
      const consultoraNomeNormalizado = normalizarNomeConsultora(ficha.consultoraNome)
      atualizarFicha((atual) => ({ ...atual, consultoraNome: consultoraNomeNormalizado }))
      const response = await requisicaoLimitada(`/api/atendimento-presencial/atendimentos/${rascunhoSalvo.id}/concluir`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          version: rascunhoSalvo.version,
          numeroLancamento: validacao.numeroLancamento,
          consultoraNome: consultoraNomeNormalizado,
        }),
      })
      const data = (await response.json()) as ApiConcluirResponse
      if (!response.ok || !data.ok || !data.atendimento || data.atendimento.status !== 'concluido' || data.atendimento.id !== rascunhoSalvo.id) {
        if (data.field) {
          registrarErrosValidacao([erroConclusaoParaSecao(data.field, data.message ?? 'Revise o campo informado.')])
          return
        }
        throw new Error(data.message ?? 'Erro ao concluir atendimento')
      }

      removerCacheRascunho(window.localStorage, usuarioId, rascunhoSalvo.draftClientId)
      autosaveQueueRef.current?.stop()
      autosaveQueueRef.current = null
      setAtivo(null)
      ativoRef.current = null
      draftClientIdRef.current = null
      definirClienteId(null)
      setTelefonePendente(null)
      setFicha(criarPayloadInicial())
      fichaRef.current = criarPayloadInicial()
      ++clienteRequestRef.current
      ++telefoneRequestRef.current
      setNovoCliente({ nome: '', telefone: '', parentesco: '', parentescoOutro: '' })
      setTelefoneClienteEdicao('')
      setErroTelefone(null)
      telefoneClienteSincronizadoRef.current = ''
      tentativaUnidadeRef.current = ''
      tentativaNomeRef.current = ''
      cacheRecuperadoRef.current = null
      setCachesRecuperaveis([])
      setHistoricoAberto(false)
      if (window.location.search) void router.replace('/atendimento-presencial/prancheta', { scroll: false })
      setUnidadeId(unidadesParaSelecao.length === 1 ? unidadesParaSelecao[0].id : '')
      setClienteSelecionada(null)
      setBuscaCliente('')
      setClientesEncontradas([])
      setDataPrevistaInputs({})
      setViradaCartaoInput('')
      setErrosValidacao([])
      setProdutoDigitado('')
      setNumeroLancamento('')
      setStatusSync('ocioso')
      setErroConclusao(null)
      setMensagemConclusao('Atendimento concluido e salvo nos registros.')
      setRascunhoEncerrado(rascunhoIdInicial)
    } catch (error) {
      mostrarErroConclusao(error instanceof Error ? error.message : 'Erro ao concluir atendimento')
    } finally {
      concluindoRef.current = false
      autosaveQueueRef.current?.resume()
      setConcluindo(false)
    }
  }

  useEffect(() => {
    const fila = autosaveQueueRef.current
    if (!ativo || !fila || conflitoLocalRef.current || concluindoRef.current) return
    const payload = montarPayloadAutosave()
    if (serializarPayloadAutosave(payload) === fila.getLastSavedPayload() && !fila.hasPending()) return
    fila.enqueue(payload)
  // A confirmacao de PATCH nao e uma nova edicao.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ativo?.id, clienteId, ficha, onlineTick, novoCliente, dataPrevistaInputs, viradaCartaoInput, produtoDigitado, numeroLancamento, telefonePendente])

  useEffect(() => {
    if (carregandoRascunhoInicial || erroRascunhoInicial || conflitoLocalRef.current) return
    const temConteudo = !!ativo || !!ficha.consultoraNome || !!clienteId || pendenciasLocais
      || ficha.criancas.some((crianca) => !!crianca.nome || !!crianca.sexo || !!crianca.dataPrevistaNascimento || !!crianca.idadeUnidade)
    if (temConteudo) persistirLocalRef.current()
  }, [ativo, ficha, clienteId, novoCliente, dataPrevistaInputs, viradaCartaoInput, produtoDigitado, numeroLancamento, telefonePendente, pendenciasLocais, carregandoRascunhoInicial, erroRascunhoInicial])

  useEffect(() => {
    if (!rascunhoIdInicial) {
      try {
        const caches = listarCachesRascunho(window.localStorage, usuarioId).filter((cache) => !cache.sincronizado && !cache.arquivado)
        setCachesRecuperaveis(caches.filter((cache, i) => caches.findIndex((item) => item.draftClientId === cache.draftClientId) === i))
      } catch {
        setErroCache(true)
      }
    }
    function preservarSaida() {
      persistirLocalRef.current()
      const fila = autosaveQueueRef.current
      if (fila && !conflitoLocalRef.current) void fila.flushNow(montarPayloadAutosave())
    }
    function ocultar() { if (document.visibilityState === 'hidden') preservarSaida() }
    window.addEventListener('pagehide', preservarSaida)
    document.addEventListener('visibilitychange', ocultar)
    return () => {
      window.removeEventListener('pagehide', preservarSaida)
      document.removeEventListener('visibilitychange', ocultar)
    }
  }, [usuarioId, rascunhoIdInicial])

  const unidadeAtual = contexto?.unidadesPermitidas.find((unidade) => unidade.id === unidadeId)
  const filaAtual = autosaveQueueRef.current
  const alteracoesNaoConfirmadas = !!filaAtual && (filaAtual.hasPending()
    || serializarPayloadAutosave(montarPayloadAutosave()) !== filaAtual.getLastSavedPayload())
  const statusVisivel: SyncStatus = conflitoLocal ? 'conflito' : erroCriacao || (erroCache && alteracoesNaoConfirmadas) || ['offline', 'erro', 'conflito'].includes(statusSync)
    ? 'erro'
    : iniciando || alteracoesNaoConfirmadas ? 'salvando' : ativo ? 'salvo' : 'ocioso'

  return (
    <PageContainer>
      <FormPageContent ref={formContentRef} className="max-w-3xl space-y-5" style={actionBarHeight ? { paddingBottom: `${actionBarHeight + 24}px` } : undefined}>
        <PageHeader
          eyebrow="Atendimento presencial"
          title="Prancheta Virtual de Atendimento"
          action={
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
              <Button
                type="button"
                variant="secondary"
                onClick={novoAtendimento}
                disabled={iniciandoNovoAtendimento || iniciando || concluindo || carregandoRascunhoInicial}
                loading={iniciandoNovoAtendimento}
                className="w-full sm:w-auto"
              >
                <Plus className="size-4" aria-hidden="true" />
                Novo Atendimento
              </Button>
              <Button type="button" variant="ghost" onClick={verRascunhos} disabled={saindo} loading={saindo} className="w-full sm:w-auto">
                <ClipboardList className="size-4" aria-hidden="true" />
                Ver rascunhos
              </Button>
            </div>
          }
        />

        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-700">Etapa {etapaNumero} de {2}</p>
            <p className="text-sm text-slate-500">{etapaLabelAtual}</p>
          </div>
          <StatusSync status={statusVisivel} onRetry={() => erroCriacao ? void iniciarRascunho(draftClientIdRef.current ?? undefined) : tentarSalvarNovamente()} />
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-slate-200" aria-hidden="true">
          <div className="h-full rounded-full bg-primary" style={{ width: `${(etapaNumero / 2) * 100}%` }} />
        </div>

        {(erroConclusao || erro || erroCriacao) && !conflitoLocal && (
          <Alert id="alerta-geral-prancheta" tabIndex={-1} className="scroll-mt-32 outline-none focus-visible:ring-2 focus-visible:ring-destructive/40" tone="danger">
            <p>{erroConclusao ?? erro ?? erroCriacao}</p>
            {erroCriacao && !iniciando && (
              <Button type="button" variant="secondary" size="sm" onClick={() => void iniciarRascunho(draftClientIdRef.current ?? undefined)} className="mt-2">
                <RefreshCw className="size-4" aria-hidden="true" />
                Tentar novamente
              </Button>
            )}
            {statusSync === 'conflito' && (
              <Button type="button" variant="secondary" size="sm" onClick={recarregarRascunhoDoServidor} className="mt-2">
                <RefreshCw className="size-4" aria-hidden="true" />
                Recarregar versao do servidor
              </Button>
            )}
          </Alert>
        )}
        {telefonePendente && erroTelefone && !conflitoLocal && <Alert tone="danger">Nao foi possivel atualizar o telefone no cadastro. O texto permanece no rascunho.
          <Button type="button" variant="secondary" size="sm" disabled={!clienteSelecionada || salvandoTelefone} onClick={() => clienteSelecionada && void salvarTelefoneCliente(clienteSelecionada, telefonePendente.valor, ++telefoneRequestRef.current)}>Tentar salvar telefone</Button>
          <Button type="button" variant="ghost" size="sm" onClick={descartarEdicaoTelefone}>Descartar edicao do telefone</Button>
        </Alert>}
        {erroCliente && !conflitoLocal && <Alert tone="warning">{erroCliente}
          <Button type="button" variant="secondary" size="sm" onClick={() => void carregarClientePorId(clienteIdRef.current)}>Carregar cliente novamente</Button>
          <Button type="button" variant="ghost" size="sm" onClick={trocarCliente}>Trocar cliente</Button>
        </Alert>}
        {conflitoLocal && <Alert id="alerta-conflito-prancheta" tabIndex={-1} tone="danger">
          <p>Este rascunho foi alterado em outra sessao. Escolha qual versao deseja continuar.</p>
          <Button type="button" variant="secondary" size="sm" onClick={() => resolverConflitoLocal(true)}>Continuar com alteracoes locais</Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => resolverConflitoLocal(false)}>Continuar com versao do servidor</Button>
        </Alert>}
        {!ativo && !conflitoLocal && cachesRecuperaveis.length > 0 && <div hidden aria-hidden="true"><Alert tone="info">
          <p>Existem alteracoes locais recuperaveis neste navegador.</p>
          {cachesRecuperaveis.map((cache) => <Button key={cache.draftClientId} type="button" variant="secondary" size="sm" onClick={() => void recuperarCache(cache)}>Retomar copia local ({new Date(cache.atualizadoEm).toLocaleString('pt-BR')})</Button>)}
        </Alert></div>}
        {!conflitoLocal && <FormErrorSummary
          errors={Object.fromEntries(errosValidacao.map((item) => [item.fieldId ?? item.sectionId, item.message]))}
          onFocusField={(field) => {
            const item = errosValidacao.find((erro) => (erro.fieldId ?? erro.sectionId) === field)
            if (item) navegarParaErro(item)
          }}
        />}
        {erroEtapa && errosValidacao.length === 0 && !conflitoLocal && <Alert tone="warning">{erroEtapa}</Alert>}

        {carregandoRascunhoInicial && (
          <Card className="p-6">
            <div className="flex flex-col items-center gap-2 text-center">
              <Spinner label="Carregando rascunho" />
              <p className="text-sm font-semibold text-slate-700">Carregando rascunho...</p>
            </div>
          </Card>
        )}

        {erroRascunhoInicial && (
          <Alert tone="danger">
            <p>{erroRascunhoInicial}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button type="button" variant="secondary" size="sm" onClick={() => void novoAtendimento()}>
                Novo atendimento
              </Button>
              <Button type="button" variant="secondary" size="sm" onClick={() => void verRascunhos()}>
                Ver rascunhos
              </Button>
            </div>
          </Alert>
        )}

        {(etapaAtual === 'ficha' || ativo) && !carregandoRascunhoInicial && !erroRascunhoInicial && !conflitoLocal && (
          <div className="grid gap-5">
            {etapaAtual === 'ficha' && (
              <SecaoFicha
                id="secao-unidade"
                erro={erroSecao('secao-unidade')}
                titulo="Unidade"
                descricao={!ativo ? 'Selecione a unidade do atendimento.' : 'Unidade do atendimento. Para alterar, use o botao Novo atendimento.'}
                icon={ClipboardList}
                tone="section-1"
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
                  <p className="flex items-center gap-1.5 text-sm font-semibold text-primary">
                    <Spinner label="Criando rascunho" />
                    Criando rascunho...
                  </p>
                )}
              </SecaoFicha>
            )}

            {etapaAtual === 'ficha' && (
              <SecaoFicha
                id="secao-consultora-nome"
                titulo="Nome da consultora"
                descricao="Informe o nome da consultora responsavel pelo atendimento."
                icon={UserRound}
                tone="section-1"
                erro={erroSecao('secao-consultora-nome')}
              >
                <FormField id="consultora-nome" label="Nome da consultora" required error={erroSecao('secao-consultora-nome')}>
                  {(f) => (
                    <Input
                      {...f}
                      value={ficha.consultoraNome ?? ''}
                      onChange={(event) => atualizarFicha((atual) => ({ ...atual, consultoraNome: event.target.value }))}
                      onBlur={(event) => atualizarFicha((atual) => ({ ...atual, consultoraNome: normalizarNomeConsultora(event.target.value) }))}
                      className="h-12 text-base"
                      maxLength={FICHA_CONSULTORA_NOME_MAX_CHARS}
                      placeholder="Digite o nome da consultora"
                    />
                  )}
                </FormField>
                {consultorasRecentes.length > 0 && <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground">Últimas consultoras</p>
                  <div className="flex flex-wrap gap-2">
                    {consultorasRecentes.map((nome) => <Button key={nome} type="button" variant="secondary" size="sm"
                      onClick={() => atualizarFicha((atual) => ({ ...atual, consultoraNome: nome }))}>{nome}</Button>)}
                  </div>
                </div>}
                {erroSugestoes && <p role="status" className="text-xs text-muted-foreground">{erroSugestoes} Você pode digitar o nome normalmente.</p>}
              </SecaoFicha>
            )}

            {etapaAtual === 'ficha' && <>
              <SecaoFicha id="secao-tipo" titulo="Tipo de atendimento" icon={UserRound} erro={erroSecao('secao-tipo')}>
                <div className="grid grid-cols-2 gap-2">
                  {([{ chave: 'cliente', label: 'Cliente' }, { chave: 'nao_cliente', label: 'Não cliente' }] as const).map((item) => (
                    <OpcaoButton key={item.chave} selected={ficha.tipoAtendimento === item.chave} onClick={() => {
                      setErro(null)
                      setErrosValidacao([])
                      setErroEtapa(null)
                      atualizarFicha((atual) => ({ ...atual, versaoFluxo: 2, tipoAtendimento: item.chave }))
                    }}>{item.label}</OpcaoButton>
                  ))}
                </div>
              </SecaoFicha>
              {ficha.tipoAtendimento === 'nao_cliente' && (
                <SecaoFicha id="secao-visita" titulo="Motivo da visita" icon={ClipboardList} erro={erroSecao('secao-visita')}>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {MOTIVOS_VISITA.map((item) => <OpcaoButton key={item.chave} selected={ficha.motivoVisita === item.chave}
                      onClick={() => atualizarFicha((atual) => ({ ...atual, motivoVisita: item.chave }))}>{item.label}</OpcaoButton>)}
                  </div>
                </SecaoFicha>
              )}
            </>}

            {etapaAtual === 'ficha' && camposComerciaisVisiveis && (
              <SecaoFicha
                id="secao-cliente"
                titulo="Cliente"
                descricao={clienteId && !clienteSelecionada ? 'O vinculo da cliente esta preservado enquanto seu cadastro e carregado.' : !clienteSelecionada ? 'Busque por nome ou telefone, ou cadastre uma nova cliente.' : undefined}
                icon={UserRound}
                tone="section-1"
                erro={erroSecao('secao-cliente')}
              >
                {clienteSelecionada && (
                  <Card className="border-info/40 bg-info/10">
                    <CardContent className="p-4">
                      <p className="text-xs font-bold uppercase text-sky-700">Cliente vinculada</p>
                      <p className="mt-2 text-base font-semibold text-slate-950">{clienteSelecionada.nome}</p>
                      {clienteSelecionada.telefoneFormatado && <p className="text-sm text-slate-700">{clienteSelecionada.telefoneFormatado}</p>}
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button type="button" variant="secondary" size="sm" onClick={trocarCliente}>
                          Trocar cliente
                        </Button>
                        <Button type="button" variant="secondary" size="sm" onClick={() => setHistoricoAberto(true)}>
                          <History className="size-4" aria-hidden="true" />
                          Ver historico
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {!clienteSelecionada && !clienteId && (
                  <>
                    <div>
                      <label className="text-sm font-semibold text-slate-700" htmlFor="busca-cliente">Buscar por nome ou telefone</label>
                      <div className="mt-2 flex gap-2">
                        <Input
                          id="busca-cliente"
                          aria-invalid={!!erroSecao('secao-cliente')}
                          aria-describedby={erroSecao('secao-cliente') ? 'secao-cliente-erro' : undefined}
                          value={buscaCliente}
                          onChange={(event) => setBuscaCliente(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                              event.preventDefault()
                              void buscarClientes()
                            }
                          }}
                          className="h-12 flex-1 text-base"
                          placeholder="Nome ou telefone"
                        />
                        <Button type="button" onClick={buscarClientes} disabled={buscandoCliente} loading={buscandoCliente} size="lg" className="px-4">
                          <Search className="size-4" aria-hidden="true" />
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
                            className="rounded-md border border-input bg-input-background p-4 text-left outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:border-ring"
                          >
                            <p className="font-semibold text-slate-950">{cliente.nome}</p>
                            <p className="text-sm text-slate-600">{cliente.telefoneFormatado ?? 'Sem telefone'}</p>
                          </button>
                        ))}
                      </div>
                    )}

                    <Card>
                      <CardContent className="p-4">
                        <h3 className="text-base font-semibold text-slate-950">Nova cliente</h3>
                        <div className="mt-4 grid gap-4">
                          <FormField id="nova-cliente-nome" label="Nome" required error={erroCadastro?.field === 'nome' ? erroCadastro.message : undefined}>
                            {(f) => (
                              <Input
                                {...f}
                                value={novoCliente.nome}
                                disabled={cadastrandoCliente}
                                onChange={(event) => setNovoCliente((atual) => ({ ...atual, nome: event.target.value }))}
                                className="h-12 text-base"
                                maxLength={120}
                              />
                            )}
                          </FormField>
                          <FormField id="nova-cliente-telefone" label="Telefone" error={erroCadastro?.field === 'telefone' ? erroCadastro.message : undefined}>
                            {(f) => (
                              <Input
                                {...f}
                                value={novoCliente.telefone}
                                disabled={cadastrandoCliente}
                                onChange={(event) => atualizarTelefoneCliente(event.target.value)}
                                className="h-12 text-base"
                                inputMode="tel"
                                placeholder="(41) 99999-9999"
                              />
                            )}
                          </FormField>
                          {conferindoDuplicidade && <p role="status" className="text-sm text-muted-foreground">Conferindo telefone…</p>}
                          {erroDuplicidade && <Alert tone="danger">{erroDuplicidade}</Alert>}
                          {duplicidade?.ambiguo && <Alert tone="warning">Não foi possível identificar um cadastro único para este telefone. Revise o telefone ou busque o cliente antes de cadastrar.</Alert>}
                          {duplicidade?.cliente && duplicidade.telefone === normalizarTelefone(novoCliente.telefone).telefoneNormalizado && <Alert tone="info">
                            <p>Cliente já cadastrado: {duplicidade.cliente.nome}.</p>
                            <Button type="button" variant="secondary" className="mt-2 min-h-12" disabled={cadastrandoCliente} onClick={() => { if (duplicidade.cliente) selecionarCliente(duplicidade.cliente) }}>Usar cadastro existente</Button>
                          </Alert>}
                          <Button type="button" onClick={cadastrarCliente} disabled={cadastrandoCliente || conferindoDuplicidade || !!duplicidade?.cliente || !!duplicidade?.ambiguo} loading={cadastrandoCliente} size="lg" className="h-12">
                            Cadastrar e vincular
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </>
                )}
              </SecaoFicha>
            )}

            {etapaAtual === 'ficha' && camposComerciaisVisiveis && (
              <SecaoFicha
                id="secao-crianca"
                titulo="Dados da crianca"
                descricao="Registre uma ou mais criancas quando a cliente informar."
                icon={Baby}
                tone="section-2"
                erro={erroSecao('secao-crianca')}
              >
                {ficha.criancas.map((crianca, index) => (
                  crianca.criancaPermanenteId ? <Card key={crianca.id} id={`crianca-selecionada-${crianca.id}`} tabIndex={-1} className="border-primary/30 bg-primary/5" data-crianca-selecionada><CardContent className="grid gap-2 p-3">
                    <div className="flex items-start justify-between gap-3"><h3 className="min-w-0 break-words text-sm font-semibold text-slate-950">{crianca.nome || 'Nome não informado'}</h3><div className="flex shrink-0 items-center gap-1"><span role="status" className="flex items-center gap-1 text-xs font-semibold text-primary"><Check className="size-3.5" aria-hidden="true" />Selecionada</span><Button type="button" variant="ghost" size="icon" className="min-h-11 min-w-11" aria-label={`Remover seleção de ${crianca.nome || 'criança sem nome informado'}`} onClick={() => removerCrianca(crianca.id)}><X className="size-4" aria-hidden="true" /></Button></div></div>
                    <p className="text-sm text-muted-foreground">{crianca.parentesco}</p>
                    {crianca.dataReferenciaNascimento ? <div data-idade-estimada><p className="text-base font-semibold text-slate-950">{descreverIdadeAproximada(crianca.dataReferenciaNascimento)}</p><p className="text-xs text-muted-foreground">Referência estimada: {formatarDataISOParaInput(crianca.dataReferenciaNascimento)}</p></div> : <p className="text-sm text-muted-foreground">{crianca.dataPrevistaNascimento ? `Previsão informada: ${formatarDataISOParaInput(crianca.dataPrevistaNascimento)}` : crianca.idadeValor ? `Idade informada: ${crianca.idadeValor} ${crianca.idadeUnidade}` : 'Nascimento não informado'}</p>}
                  </CardContent></Card> :
                  <Card key={crianca.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between gap-3">
                        <h3 className="font-semibold text-slate-950">Crianca {index + 1}</h3>
                        {ficha.criancas.length > 0 && (
                          <Button type="button" variant="ghost" size="icon" onClick={() => removerCrianca(crianca.id)} aria-label={`Remover crianca ${index + 1}`}>
                            <X className="size-4" aria-hidden="true" />
                          </Button>
                        )}
                      </div>
                      <div className="mt-4 grid gap-4">
                        {ficha.versaoFluxo === 2 && <ParentescoCriancaField id={`parentesco-crianca-${crianca.id}`} value={crianca.parentesco ?? ''} error={errosValidacao.find((item) => item.fieldId === `parentesco-crianca-${crianca.id}`)?.message} onChange={(parentesco) => atualizarCrianca(crianca.id, { parentesco })} />}
                        <FormField id={`situacao-${crianca.id}`} label="Situacao" required>
                          {(f) => (
                            <Select
                              value={crianca.situacao}
                              onValueChange={(value) => {
                                setDataPrevistaInputs((atual) => ({ ...atual, [crianca.id]: '' }))
                                atualizarCrianca(crianca.id, { situacao: value as SituacaoCrianca, presenteJaNasceu: undefined, idadeUnidade: undefined, idadeValor: undefined, dataPrevistaNascimento: undefined })
                              }}
                            >
                              <SelectTrigger id={f.id} className="h-12 w-full text-base" aria-invalid={f['aria-invalid']} aria-describedby={f['aria-describedby']}>
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
                          )}
                        </FormField>
                        {crianca.situacao === 'presente_outra_pessoa' && <FormField id={`presente-nasceu-${crianca.id}`} label="Já nasceu?" required error={errosValidacao.find((item) => item.fieldId === `presente-nasceu-${crianca.id}`)?.message}>{(field) => <div {...field} tabIndex={-1} className="flex gap-2">{[true, false].map((nasceu) => <OpcaoButton key={String(nasceu)} selected={crianca.presenteJaNasceu === nasceu} onClick={() => atualizarCrianca(crianca.id, { presenteJaNasceu: nasceu, idadeUnidade: undefined, idadeValor: undefined, dataPrevistaNascimento: undefined })}>{nasceu ? 'Sim' : 'Não'}</OpcaoButton>)}</div>}</FormField>}
                        {(crianca.situacao === 'gestacao' || (crianca.situacao === 'presente_outra_pessoa' && crianca.presenteJaNasceu === false)) && (
                          <FormField id={`data-prevista-${crianca.id}`} label="Data prevista de nascimento" error={errosValidacao.find((item) => item.fieldId === `data-prevista-${crianca.id}`)?.message}>
                            {(f) => (
                              <DateField
                                {...f}
                                value={dataPrevistaInputs[crianca.id] ?? formatarDataISOParaInput(crianca.dataPrevistaNascimento)}
                                onChange={(display) => atualizarDataPrevistaCrianca(crianca.id, display)}
                              />
                            )}
                          </FormField>
                        )}
                        {criancaJaNasceu(crianca) && (
                          <div id={`idade-${crianca.id}`} tabIndex={-1} className="grid gap-3" aria-describedby={errosValidacao.some((item) => item.fieldId === `idade-${crianca.id}`) ? `idade-${crianca.id}-erro` : undefined}>
                            <p className="text-sm font-semibold text-slate-700">Idade aproximada *</p>
                            {crianca.dataReferenciaNascimento && <div data-idade-estimada><p className="text-base font-semibold text-slate-950">{descreverIdadeAproximada(crianca.dataReferenciaNascimento)}</p><p className="text-xs text-muted-foreground">Referência estimada: {formatarDataISOParaInput(crianca.dataReferenciaNascimento)}</p></div>}
                            {errosValidacao.find((item) => item.fieldId === `idade-${crianca.id}`) && <p id={`idade-${crianca.id}-erro`} role="alert" className="text-xs text-destructive">{errosValidacao.find((item) => item.fieldId === `idade-${crianca.id}`)?.message}</p>}
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
                        <FormField id={`nome-crianca-${crianca.id}`} label="Nome da crianca" helper="Opcional">
                          {(f) => (
                            <Input
                              {...f}
                              value={crianca.nome ?? ''}
                              disabled={crianca.nomeNaoInformado}
                              onChange={(event) => atualizarNomeCrianca(crianca.id, event.target.value)}
                              className="h-12 text-base"
                              maxLength={80}
                            />
                          )}
                        </FormField>
                        <label className="flex min-h-11 items-center gap-3 rounded-md border border-input bg-input-background px-3 text-sm font-semibold text-slate-700">
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
                    </CardContent>
                  </Card>
                ))}
                {clienteId ? <CriancasCadastradas key={clienteId} clienteId={clienteId} rascunhoId={ativo?.id ?? null} selecionadas={ficha.criancas} sincronizar={garantirRascunhoSalvoAntesDeConcluir} cadastrar={adicionarCrianca} selecionar={(crianca) => {
                  if (fichaRef.current.criancas.length >= FICHA_CRIANCAS_MAX_ITENS || fichaRef.current.criancas.some((c) => c.criancaPermanenteId === crianca.criancaPermanenteId)) return
                  focoCriancaSelecionadaRef.current = `crianca-selecionada-${crianca.id}`
                  atualizarFicha((atual) => ({ ...atual, criancas: atual.criancas.length >= FICHA_CRIANCAS_MAX_ITENS || atual.criancas.some((c) => c.criancaPermanenteId === crianca.criancaPermanenteId) ? atual.criancas : [...atual.criancas, crianca] }))
                }} /> : <Button type="button" variant="secondary" disabled={ficha.criancas.length >= FICHA_CRIANCAS_MAX_ITENS} onClick={adicionarCrianca} size="lg" className="h-12">
                  <Plus className="size-4" aria-hidden="true" />
                  {ficha.criancas.length >= FICHA_CRIANCAS_MAX_ITENS ? 'Limite de oito criancas atingido' : 'Adicionar outra crianca'}
                </Button>}
              </SecaoFicha>
            )}

            {etapaAtual === 'ficha' && camposComerciaisVisiveis && (
              <>
                <SecaoFicha
                  id="secao-departamentos"
                  titulo="Departamentos"
                  descricao="Selecione as areas de interesse informadas pela cliente."
                  icon={ClipboardList}
                  tone="section-3"
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
                  tone="section-2"
                  erro={erroSecao('secao-produtos')}
                >
                  <label className="text-sm font-semibold text-slate-700" htmlFor="produto-interesse">Produtos de interesse</label>
                  <div className="mt-2 flex gap-2">
                    <Input
                      id="produto-interesse"
                      value={produtoDigitado}
                      onChange={(event) => setProdutoDigitado(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault()
                          adicionarProduto()
                        }
                      }}
                      className="h-12 flex-1 text-base"
                      maxLength={FICHA_PRODUTO_MAX_CHARS}
                      enterKeyHint="done"
                    />
                    <Button type="button" onClick={adicionarProduto} size="lg" className="px-4">
                      <Plus className="size-4" aria-hidden="true" />
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
                <p className="font-semibold">{ficha.resultadoAtendimento === 'negociacao' ? 'Negociação' : 'Venda perdida'}</p>
                <SecaoFicha id="secao-resultado-observacao" titulo="Observação de não fechamento" icon={MessageSquareText} erro={erroSecao('secao-resultado-observacao')}>
                  <FormField id="observacao-nao-fechamento" label="Observação de não fechamento" error={erroSecao('secao-resultado-observacao')} helper="Até 300 caracteres">
                    {(f) => <Textarea {...f} value={ficha.observacaoNaoFechamento ?? ''} onChange={(event) => {
                      const valor = event.target.value
                      if (Array.from(valor).length <= OBSERVACAO_NAO_FECHAMENTO_MAX_CHARS) atualizarFicha((atual) => ({ ...atual, observacaoNaoFechamento: valor }))
                    }} />}
                  </FormField>
                  <p className="text-xs text-muted-foreground">{Array.from(ficha.observacaoNaoFechamento ?? '').length}/300</p>
                </SecaoFicha>

                <SecaoFicha
                  id="secao-resultado-produto"
                  titulo="Motivos"
                  descricao="Selecione os fatores citados pela cliente."
                  icon={ClipboardList}
                  tone="section-3"
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
                    tone="section-2"
                    erro={erroSecao('secao-resultado-condicao')}
                  >
                    <ViradaCartaoField
                      id="virada-cartao"
                      value={viradaCartaoInput}
                      onChange={atualizarViradaCartao}
                      error={erroSecao('secao-resultado-condicao')}
                      className="h-12 text-base"
                    />
                  </SecaoFicha>
                )}

                {ficha.motivosResultado.includes('outro') && (
                  <SecaoFicha
                    id="secao-resultado-outro"
                    titulo="Outro motivo"
                    descricao="Complemente o motivo quando Outro for selecionado."
                    icon={MessageSquareText}
                    tone="section-1"
                    erro={erroSecao('secao-resultado-outro')}
                  >
                    <FormField id="motivo-outro" label="Complemento" required error={erroSecao('secao-resultado-outro')}>
                      {(f) => (
                        <Input
                          {...f}
                          value={ficha.motivoOutro ?? ''}
                          onChange={(event) => atualizarFicha((atual) => ({ ...atual, motivoOutro: event.target.value }))}
                          className="h-12 text-base"
                          maxLength={120}
                        />
                      )}
                    </FormField>
                  </SecaoFicha>
                )}
              </div>
            )}

            {etapaAtual === 'ficha' && camposComerciaisVisiveis && (
              <SecaoFicha
                id="secao-observacoes"
                titulo="Observacoes sobre esse atendimento"
                descricao="Registre preferencias, duvidas, objecoes ou informacoes importantes para um proximo contato."
                icon={MessageSquareText}
                tone="section-2"
                erro={erroSecao('secao-observacoes')}
              >
                <FormField id="observacoes" label="Observacoes" helper="Opcional">
                  {(f) => (
                    <Textarea
                      {...f}
                      value={ficha.observacoes ?? ''}
                      onChange={(event) => atualizarFicha((atual) => ({ ...atual, observacoes: event.target.value }))}
                      className="min-h-44 text-base"
                      maxLength={FICHA_OBSERVACOES_MAX_CHARS}
                    />
                  )}
                </FormField>
                <p className="text-right text-xs text-slate-500">{(ficha.observacoes ?? '').length}/{FICHA_OBSERVACOES_MAX_CHARS}</p>
              </SecaoFicha>
            )}

            {etapaAtual === 'ficha' && camposComerciaisVisiveis && (
                  <div id="secao-lancamento" className="scroll-mt-28">
                    <FormField id="numero-lancamento" label="Numero do lancamento" helper="Obrigatório somente quando a venda for fechada." required={ficha.resultadoAtendimento === 'sim'} error={erroSecao('secao-lancamento')}>
                      {(f) => (
                        <Input
                          {...f}
                          value={numeroLancamento}
                          onChange={(event) => atualizarNumeroLancamento(event.target.value)}
                          onBlur={() => {
                            if (!numeroLancamento) return
                            const validacao = validarNumeroLancamento(numeroLancamento)
                            if (!validacao.ok) setErrosValidacao((atuais) => [
                              ...atuais.filter((item) => item.fieldId !== 'numero-lancamento'),
                              erroConclusaoParaSecao(validacao.field, validacao.message),
                            ])
                          }}
                          className="h-12 text-base"
                          inputMode="numeric"
                          placeholder="Informe o lancamento"
                        />
                      )}
                    </FormField>
                  </div>
            )}

            {camposComerciaisVisiveis && <TelefoneClienteRapido
              value={clienteSelecionada ? telefoneClienteEdicao : novoCliente.telefone}
              onChange={atualizarTelefoneCliente}
              erro={erroTelefone}
              loading={salvandoTelefone}
              disabled={cadastrandoCliente || (!!clienteId && !clienteSelecionada)}
              compact={etapaAtual === 'ficha' && !clienteSelecionada}
            />}
            {camposComerciaisVisiveis && telefonePendente && !salvandoTelefone && !erroTelefone && <div className="flex flex-wrap justify-end gap-2 text-xs">
              <Button type="button" variant="ghost" size="sm" disabled={!clienteSelecionada} onClick={() => clienteSelecionada && void salvarTelefoneCliente(clienteSelecionada, telefonePendente.valor, ++telefoneRequestRef.current)}>Confirmar telefone no cadastro</Button>
              <Button type="button" variant="ghost" size="sm" onClick={descartarEdicaoTelefone}>Descartar edicao do telefone</Button>
            </div>}
          </div>
        )}
      </FormPageContent>

      {!carregandoRascunhoInicial && !erroRascunhoInicial && (
        <div ref={actionBarRef} data-prancheta-rodape inert={!rodapeVisivel} aria-hidden={!rodapeVisivel} style={{ visibility: rodapeVisivel ? 'visible' : 'hidden' }} className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 px-3 py-3 shadow-lg backdrop-blur">
          <div className="mx-auto flex max-w-3xl flex-col gap-2">
            <div className="grid gap-2 sm:flex">
              {etapaAtual === 'resultado' && <Button type="button" variant="secondary" onClick={voltar} disabled={concluindo} size="lg"><ChevronLeft className="size-4" aria-hidden="true" />Voltar</Button>}
              {mensagemConclusao ? (
                <Button type="button" disabled className="min-h-12 flex-1 bg-success text-white disabled:opacity-100"><Check className="size-4" aria-hidden="true" />Atendimento concluído</Button>
              ) : etapaAtual === 'ficha' && camposComerciaisVisiveis ? (
                <>
                  <Button type="button" onClick={() => escolherResultado('sim')} disabled={concluindo} loading={concluindo} className="min-h-12 flex-1"><Check className="size-4" aria-hidden="true" />Venda fechada</Button>
                  <Button type="button" variant="secondary" onClick={() => escolherResultado('negociacao')} disabled={concluindo} className="min-h-12 flex-1"><MessageSquareText className="size-4" aria-hidden="true" />Negociação</Button>
                  <Button type="button" variant="secondary" onClick={() => escolherResultado('nao')} disabled={concluindo} className="min-h-12 flex-1"><X className="size-4" aria-hidden="true" />Venda perdida</Button>
                </>
              ) : (
                <Button type="button" onClick={() => void concluirAtendimento()} disabled={concluindo} loading={concluindo} className="min-h-12 flex-1"><Check className="size-4" aria-hidden="true" />Finalizar atendimento</Button>
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
    </PageContainer>
  )
}
