'use client'


import { calcularReferenciaNascimento, criancaJaNasceu, dataAtendimentoLocal, descreverIdadeAproximada } from '@/lib/atendimento-presencial/idade-aproximada'

import { FiltrosAdicionaisAtendimento } from '@/components/atendimento-presencial/FiltrosAdicionaisAtendimento'
import { FILTROS_ADICIONAIS, type FiltrosAdicionais } from '@/lib/atendimento-presencial/filtros-listagem'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Baby, CalendarDays, ClipboardList, Eye, Heart, History, Loader2, Package, Pencil, Phone, Plus, RefreshCw, Save, UserRound, X } from 'lucide-react'
import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  DateField,
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  EmptyState,
  FilterFieldGroup,
  FilterPanel,
  FormField,
  Input,
  PageContainer,
  PageHeader,
  Section,
  SegmentedTabsList,
  SegmentedTabsTrigger,
  Spinner,
  Tabs,
  TabsContent,
  Textarea,
  useFilterState,
} from '@/components/design-system'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { HistoricoClienteModal, type HistoricoClienteModalCliente } from '@/components/atendimento-presencial/HistoricoClienteModal'
import { ViradaCartaoField } from '@/components/atendimento-presencial/ViradaCartaoField'
import { validarViradaCartaoInput } from '@/lib/atendimento-presencial/virada-cartao-input'
import {
  DEPARTAMENTOS_INTERESSE,
  FICHA_CONSULTORA_NOME_MAX_CHARS,
  FICHA_OBSERVACOES_MAX_CHARS,
  FICHA_PRODUTO_MAX_CHARS,
  FICHA_PRODUTOS_MAX_ITENS,
  motivosParaEdicao,
  MOTIVOS_LOJA,
  MOTIVOS_VISITA,
  RESULTADOS_ATENDIMENTO,
  SEXOS_CRIANCA,
  SITUACOES_CRIANCA,
  converterDataInputParaISO,
  converterViradaCartaoInput,
  formatarViradaCartao,
  formatarDataISOParaInput,
  formatarDataPrevistaInput,
  formatarViradaCartaoInput,
  getDepartamentoLabel,
  getMotivoLabel,
  limparNomeCriancaDigitacao,
  normalizarNomeConsultora,
  validarFichaParaConclusao,
  type DepartamentoInteresse,
  type FichaCriancaRascunho,
  type FichaDadosRascunho,
  type MotivoResultado,
  type ResultadoAtendimento,
  type SexoCrianca,
  type SituacaoCrianca,
  type UnidadeIdadeCrianca,
} from '@/lib/atendimento-presencial/ficha-schema'
import {
  SITUACOES_VENDA,
  situacaoVendaRegistro,
  descreverContratoHistorico,
  getMotivoVisitaLabel,
  registroNaoCliente,
  registroSemTelefone,
  montarPayloadEdicaoAtendimento,
  normalizarDetalheParaFichaEdicao,
  normalizarObservacoesRegistro,
  type RegistroAtendimentoDetalheDTO,
  type RegistroAtendimentoResumoDTO,
} from '@/lib/atendimento-presencial/registros'
import {
  nomeClienteRascunho,
  nomeConsultoraRascunho,
} from '@/lib/atendimento-presencial/rascunho-display'
import {
  type AtendimentoPresencialDTO,
  type ContextoAtendimento,
} from '@/lib/atendimento-presencial/rascunhos-shared'
import { TABLE_PAGE_SIZE } from '@/lib/design-system/pagination'

type RegistroResumo = RegistroAtendimentoResumoDTO
type RegistroDetalhe = RegistroAtendimentoDetalheDTO

type ApiListaRascunhosResponse = {
  ok: boolean
  message?: string
  rascunhos?: AtendimentoPresencialDTO[]
  contexto?: ContextoAtendimento
  total?: number
  page?: number
  consultorasDisponiveis?: Array<{ nome: string }>
}

type ApiListaResponse = {
  ok: boolean
  message?: string
  clientesUnicos?: number
  visitasNaoClientes?: number
  registros?: RegistroResumo[]
  consultoras?: Array<{ nome: string }>
  unidades?: Array<{ id: string; nome: string }>
  page?: number
  total?: number
}

type ApiDetalheResponse = {
  ok: boolean
  message?: string
} & Partial<RegistroDetalhe>

type ApiEdicaoResponse = {
  ok: boolean
  message?: string
  field?: string
  version?: number | null
  semAlteracoes?: boolean
}

function formatarData(valor: string | null) {
  if (!valor) return 'Nao informado'
  return new Date(valor).toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
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

function normalizarProduto(valor: string) {
  return valor.trim().replace(/\s+/g, ' ').slice(0, FICHA_PRODUTO_MAX_CHARS)
}

function gerarIdLocal(prefixo = 'local') {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `${prefixo}-${Date.now()}-${Math.random().toString(16).slice(2)}`
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
        'min-h-11 rounded-md border px-4 py-2 text-left text-sm font-semibold outline-none transition focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:border-ring',
        props.selected ? 'border-primary bg-primary/10 text-primary' : 'border-input bg-input-background text-slate-700',
        props.className ?? '',
      ].join(' ')}
    >
      {props.children}
    </button>
  )
}

const FILTROS_FINALIZADOS_INICIAL = {
  ...FILTROS_ADICIONAIS,
  clienteNome: '',
  consultora: '',
  unidadeId: '',
  situacaoVenda: '',
  viradaCartaoDe: '',
  viradaCartaoAte: '',
}


function resumoFiltros(valores: Record<string, string | string[]>, unidades: Array<{id: string; nome: string}>) {
  const rotulos: Record<string, string> = { clienteNome: 'Cliente', consultora: 'Consultora do atendimento', unidadeId: 'Filial', situacaoVenda: 'Situação', viradaCartaoDe: 'Virada de', viradaCartaoAte: 'Virada até', atendimentoDe: 'Período de', atendimentoAte: 'Período até', tipoAtendimento: 'Tipo', telefoneCliente: 'Telefone', numeroLancamento: 'Lançamento', contato: 'Telefone disponível', departamentos: 'Departamentos', motivos: 'Motivos', motivoVisita: 'Visita', vinculoCliente: 'Cliente vinculado', expiracao: 'Expiração' }
  const texto = Object.entries(valores).filter(([,valor]) => Array.isArray(valor) ? valor.length : Boolean(valor)).map(([chave, valor]) => {
    let label = Array.isArray(valor) ? valor.map(v => chave === 'departamentos' ? getDepartamentoLabel(v as DepartamentoInteresse) : getMotivoLabel(v as MotivoResultado)).join(', ') : valor
    if (chave === 'unidadeId') label = unidades.find(u => u.id === valor)?.nome ?? 'Filial selecionada'
    if (chave === 'situacaoVenda') label = situacaoVendaRegistro(String(valor)).label
    if (chave === 'motivoVisita') label = getMotivoVisitaLabel(String(valor))
    if (chave === 'tipoAtendimento') label = valor === 'cliente' ? 'Cliente' : valor === 'nao_cliente' ? 'Não cliente' : 'Tipo não informado'
    if (chave === 'contato') label = valor === 'com' ? 'Com telefone' : 'Sem telefone'
    if (chave === 'vinculoCliente') label = valor === 'com' ? 'Com cliente vinculado' : 'Sem cliente vinculado'
    if (chave === 'expiracao') label = 'Próximas 24 horas'
    return (rotulos[chave] ?? chave) + ': ' + label
  }).join(' · ')
  return texto || 'Todos os registros autorizados, sem filtros adicionais.'
}

function guardarEstadoLista(chave: string, estado: object) {
  try { sessionStorage.setItem('prancheta-lista-' + chave, JSON.stringify(estado)) }
  catch { console.warn('[PRANCHETA LISTA] Estado de navegação indisponível nesta sessão.') }
}
function lerEstadoLista(chave: string): { filtros?: object; adicionais?: object; page?: number } | null {
  try {
    const estado = JSON.parse(sessionStorage.getItem('prancheta-lista-' + chave) ?? 'null')
    if (!estado || typeof estado !== 'object') return null
    return { ...estado, page: Number.isInteger(estado.page) && estado.page > 0 ? estado.page : 1 }
  } catch { console.warn('[PRANCHETA LISTA] Não foi possível recuperar os filtros.'); return null }
}
function restaurarFiltros<T extends object>(base: T, valor: object | undefined): T {
  const novo = { ...base }
  if (!valor || typeof valor !== 'object') return novo
  for (const chave of Object.keys(base) as Array<keyof T>) {
    const campo = (valor as T)[chave]
    if (typeof campo === 'string' && typeof base[chave] === 'string' || Array.isArray(campo) && Array.isArray(base[chave]) && campo.every(v => typeof v === 'string')) novo[chave] = campo
  }
  return novo
}
function guardarPosicaoLista() {
  try { sessionStorage.setItem('prancheta-lista-posicao', String(window.scrollY)) }
  catch { console.warn('[PRANCHETA LISTA] Posição não pôde ser preservada.') }
}
function restaurarPosicaoLista() {
  try {
    const valor = sessionStorage.getItem('prancheta-lista-posicao')
    if (valor !== null) {
      sessionStorage.removeItem('prancheta-lista-posicao')
      requestAnimationFrame(() => requestAnimationFrame(() => window.scrollTo(0, Number(valor) || 0)))
    }
  } catch { console.warn('[PRANCHETA LISTA] Posição não pôde ser restaurada.') }
}

type Props = {
  podeVerRegistros: boolean
  podeVerRascunhos: boolean
}

export default function RegistrosPageClient({ podeVerRegistros, podeVerRascunhos }: Props) {
  const router = useRouter()
  const restauracaoLida = useRef(false)
  const registrosRequest = useRef(0)
  const rascunhosRequest = useRef(0)
  const novosFiltros = useFilterState(FILTROS_ADICIONAIS)
  const filtrosRascunhos = useFilterState({ ...FILTROS_ADICIONAIS, clienteNome: '', consultora: '', unidadeId: '' })
  const [paginaRascunhos, setPaginaRascunhos] = useState(1)
  const [totalRascunhos, setTotalRascunhos] = useState(0)
  const [consultorasRascunhos, setConsultorasRascunhos] = useState<Array<{ nome: string }>>([])
  const [contagens, setContagens] = useState({ clientesUnicos: 0, visitasNaoClientes: 0 })
  const searchParams = useSearchParams()
  const [registros, setRegistros] = useState<RegistroResumo[]>([])
  const [paginaRegistros, setPaginaRegistros] = useState(1)
  const [totalRegistros, setTotalRegistros] = useState(0)
  const [selecionado, setSelecionado] = useState<RegistroDetalhe | null>(null)
  const [detalheAberto, setDetalheAberto] = useState(false)
  const [resumoCarregamento, setResumoCarregamento] = useState<RegistroResumo | null>(null)
  const [erroDetalhe, setErroDetalhe] = useState<string | null>(null)
  const [carregando, setCarregando] = useState(false)
  const [carregandoDetalhe, setCarregandoDetalhe] = useState(false)
  const [carregandoEdicaoId, setCarregandoEdicaoId] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const filtrosFinalizados = useFilterState(FILTROS_FINALIZADOS_INICIAL)
  const [consultorasFinalizados, setConsultorasFinalizados] = useState<Array<{ nome: string }>>([])
  const [unidadesFinalizados, setUnidadesFinalizados] = useState<Array<{ id: string; nome: string }>>([])
  const [edicaoAberta, setEdicaoAberta] = useState(false)
  const [fichaEdicao, setFichaEdicao] = useState<FichaDadosRascunho | null>(null)
  const [numeroLancamentoEdicao, setNumeroLancamentoEdicao] = useState('')
  const [viradaCartaoEdicaoInput, setViradaCartaoEdicaoInput] = useState('')
  const [mostrarErroViradaCartaoEdicao, setMostrarErroViradaCartaoEdicao] = useState(false)
  const [produtoEdicaoDigitado, setProdutoEdicaoDigitado] = useState('')
  const [dataPrevistaEdicaoInputs, setDataPrevistaEdicaoInputs] = useState<Record<string, string>>({})
  const [salvandoEdicao, setSalvandoEdicao] = useState(false)
  const [mensagemEdicao, setMensagemEdicao] = useState<string | null>(null)
  const [erroEdicao, setErroEdicao] = useState<string | null>(null)
  const [historicoAberto, setHistoricoAberto] = useState(false)
  const [historicoCliente, setHistoricoCliente] = useState<HistoricoClienteModalCliente | null>(null)
  const [rascunhos, setRascunhos] = useState<AtendimentoPresencialDTO[]>([])
  const [contextoRascunhos, setContextoRascunhos] = useState<ContextoAtendimento | null>(null)
  const [carregandoRascunhos, setCarregandoRascunhos] = useState(false)
  const [erroRascunhos, setErroRascunhos] = useState<string | null>(null)

  async function carregarRegistros(filtrosOverride?: {
    adicionais?: FiltrosAdicionais
    de?: string
    ate?: string
    clienteNome?: string
    consultora?: string
    situacaoVenda?: string
    unidadeId?: string
    page?: number
  }) {
    const requestId = ++registrosRequest.current
    setCarregando(true)
    setErro(null)
    try {
      const params = new URLSearchParams()
      const filtroDe = filtrosOverride?.de ?? filtrosFinalizados.applied.viradaCartaoDe
      const filtroAte = filtrosOverride?.ate ?? filtrosFinalizados.applied.viradaCartaoAte
      const filtroCliente = filtrosOverride?.clienteNome ?? filtrosFinalizados.applied.clienteNome
      const filtroConsultora = filtrosOverride?.consultora ?? filtrosFinalizados.applied.consultora
      const filtroUnidade = filtrosOverride?.unidadeId ?? filtrosFinalizados.applied.unidadeId
      const filtroSituacao = filtrosOverride?.situacaoVenda ?? filtrosFinalizados.applied.situacaoVenda
      const pagina = filtrosOverride?.page ?? paginaRegistros
      if (filtroDe.trim()) params.set('viradaCartaoDe', filtroDe.trim())
      if (filtroAte.trim()) params.set('viradaCartaoAte', filtroAte.trim())
      if (filtroCliente.trim()) params.set('clienteNome', filtroCliente.trim())
      if (filtroConsultora.trim()) params.set('consultora', filtroConsultora.trim())
      if (filtroUnidade) params.set('unidadeId', filtroUnidade)
      if (filtroSituacao) params.set('situacaoVenda', filtroSituacao)
      const adicionais = filtrosOverride?.adicionais ?? novosFiltros.applied
      for (const [key, value] of Object.entries(adicionais)) {
        if (Array.isArray(value)) value.forEach(item => params.append(key, item))
        else if (value) params.set(key, value)
      }
      params.set('page', String(pagina))
      const query = params.toString()
      const response = await fetch(`/api/atendimento-presencial/atendimentos${query ? `?${query}` : ''}`, { cache: 'no-store' })
      const data = (await response.json()) as ApiListaResponse
      if (!response.ok || !data.ok) throw new Error(data.message ?? 'Erro ao carregar registros')
      if (requestId !== registrosRequest.current) return
      setContagens({ clientesUnicos: data.clientesUnicos ?? 0, visitasNaoClientes: data.visitasNaoClientes ?? 0 })
      setRegistros(data.registros ?? [])
      setConsultorasFinalizados(data.consultoras ?? [])
      setUnidadesFinalizados(data.unidades ?? [])
      setPaginaRegistros(data.page ?? pagina)
      setTotalRegistros(data.total ?? 0)
      restaurarPosicaoLista()
      guardarEstadoLista('salvos', { filtros: { ...filtrosFinalizados.applied, clienteNome: filtroCliente, consultora: filtroConsultora, unidadeId: filtroUnidade, situacaoVenda: filtroSituacao, viradaCartaoDe: filtroDe, viradaCartaoAte: filtroAte }, adicionais, page: data.page ?? pagina })
    } catch (error) {
      if (requestId === registrosRequest.current) setErro(error instanceof Error ? error.message : 'Erro ao carregar registros')
    } finally {
      if (requestId === registrosRequest.current) setCarregando(false)
    }
  }

  function aplicarFiltrosFinalizados() {
    novosFiltros.apply()
    filtrosFinalizados.apply()
    void carregarRegistros({
      adicionais: novosFiltros.draft,
      de: filtrosFinalizados.draft.viradaCartaoDe,
      ate: filtrosFinalizados.draft.viradaCartaoAte,
      clienteNome: filtrosFinalizados.draft.clienteNome.trim().replace(/\s+/g, ' '),
      consultora: filtrosFinalizados.draft.consultora,
      unidadeId: filtrosFinalizados.draft.unidadeId,
      situacaoVenda: filtrosFinalizados.draft.situacaoVenda,
      page: 1,
    })
  }

  function limparFiltrosFinalizados() {
    novosFiltros.clear()
    filtrosFinalizados.clear()
    void carregarRegistros({ adicionais: FILTROS_ADICIONAIS, de: '', ate: '', clienteNome: '', consultora: '', unidadeId: '', situacaoVenda: '', page: 1 })
  }

  async function buscarDetalhe(id: string): Promise<RegistroDetalhe> {
    const response = await fetch(`/api/atendimento-presencial/atendimentos/${id}`, { cache: 'no-store' })
    const data = (await response.json()) as ApiDetalheResponse
    if (!response.ok || !data.ok || !data.atendimento) throw new Error(data.message ?? 'Erro ao carregar atendimento')
    return {
      atendimento: data.atendimento,
      cliente: data.cliente ?? null,
      criancas: data.criancas ?? [],
      departamentos: data.departamentos ?? [],
      produtosInteresse: data.produtosInteresse ?? [],
      motivos: data.motivos ?? [],
      historico: data.historico ?? [],
      podeEditar: data.podeEditar ?? false,
      motivoBloqueio: data.motivoBloqueio ?? null,
      limiteEdicaoEm: data.limiteEdicaoEm ?? null,
    }
  }

  async function carregarDetalhe(id: string, options?: { preservarMensagemEdicao?: boolean }) {
    setCarregandoDetalhe(true)
    setErroDetalhe(null)
    setErro(null)
    try {
      const detalhe = await buscarDetalhe(id)
      setSelecionado(detalhe)
      setResumoCarregamento(null)
      setEdicaoAberta(false)
      setFichaEdicao(null)
      if (!options?.preservarMensagemEdicao) setMensagemEdicao(null)
      setErroEdicao(null)
    } catch (error) {
      const mensagem = error instanceof Error ? error.message : 'Erro ao carregar atendimento'
      setErroDetalhe(mensagem)
      setErro(mensagem)
    } finally {
      setCarregandoDetalhe(false)
    }
  }

  async function editarAtendimentoCard(id: string) {
    setCarregandoEdicaoId(id)
    setErro(null)
    try {
      const detalhe = await buscarDetalhe(id)
      setSelecionado(detalhe)
      abrirEdicao(detalhe)
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Erro ao carregar atendimento')
    } finally {
      setCarregandoEdicaoId(null)
    }
  }

  async function verAtendimento(id: string) {
    setResumoCarregamento(registros.find((registro) => registro.id === id) ?? null)
    setDetalheAberto(true)
    setSelecionado(null)
    await carregarDetalhe(id)
  }

  const selecionadoNaoCliente = selecionado ? registroNaoCliente(selecionado.atendimento) : false

  const resumoSelecionado = selecionado ? registros.find((registro) => registro.id === selecionado.atendimento.id) : null

  function abrirEdicao(detalhe: RegistroDetalhe) {
    const ficha = normalizarDetalheParaFichaEdicao(detalhe)
    setFichaEdicao(ficha)
    setNumeroLancamentoEdicao(detalhe.atendimento.numeroLancamento ? String(detalhe.atendimento.numeroLancamento) : '')
    setViradaCartaoEdicaoInput(formatarViradaCartao(ficha.viradaCartaoDia, ficha.viradaCartaoMes))
    setMostrarErroViradaCartaoEdicao(false)
    setDataPrevistaEdicaoInputs(Object.fromEntries(
      ficha.criancas.map((crianca) => [crianca.id, formatarDataISOParaInput(crianca.dataPrevistaNascimento)])
    ))
    setProdutoEdicaoDigitado('')
    setMensagemEdicao(null)
    setErroEdicao(null)
    setEdicaoAberta(true)
  }

  function abrirHistoricoClienteSelecionada() {
    if (!selecionado?.cliente) return
    setHistoricoCliente({
      id: selecionado.cliente.id,
      nome: selecionado.cliente.nome,
      telefoneFormatado: selecionado.cliente.telefone,
    })
    setHistoricoAberto(true)
  }

  function atualizarFichaEdicao(mutator: (atual: FichaDadosRascunho) => FichaDadosRascunho) {
    setFichaEdicao((atual) => atual ? mutator(atual) : atual)
  }

  function atualizarCriancaEdicao(id: string, patch: Partial<FichaCriancaRascunho>) {
    if (patch.idadeValor !== undefined) {
      const anterior=fichaEdicao?.criancas.find((c)=>c.id===id)
      const unidade=patch.idadeUnidade ?? anterior?.idadeUnidade
      if (unidade && patch.idadeValor>0) patch={...patch,dataReferenciaNascimento:calcularReferenciaNascimento(dataAtendimentoLocal(selecionado?.atendimento.iniciadoEm),unidade,patch.idadeValor)}
    } else if (Object.hasOwn(patch,'situacao') || Object.hasOwn(patch,'idadeUnidade') || Object.hasOwn(patch,'presenteJaNasceu')) patch={...patch,dataReferenciaNascimento:undefined}
    atualizarFichaEdicao((atual) => ({
      ...atual,
      criancas: atual.criancas.map((crianca) => crianca.id === id ? { ...crianca, ...patch } : crianca),
    }))
  }

  function adicionarCriancaEdicao() {
    const id = gerarIdLocal('crianca')
    atualizarFichaEdicao((atual) => ({
      ...atual,
      criancas: [...atual.criancas, { id, situacao: 'gestacao' }],
    }))
    setDataPrevistaEdicaoInputs((atual) => ({ ...atual, [id]: '' }))
  }

  function removerCriancaEdicao(id: string) {
    atualizarFichaEdicao((atual) => ({
      ...atual,
      criancas: atual.criancas.filter((crianca) => crianca.id !== id),
    }))
    setDataPrevistaEdicaoInputs((atual) => {
      const proximo = { ...atual }
      delete proximo[id]
      return proximo
    })
  }

  function atualizarDataPrevistaEdicao(id: string, valor: string) {
    const formatada = formatarDataPrevistaInput(valor)
    const dataISO = converterDataInputParaISO(formatada)
    setDataPrevistaEdicaoInputs((atual) => ({ ...atual, [id]: formatada }))
    atualizarCriancaEdicao(id, { dataPrevistaNascimento: dataISO || undefined })
  }

  function alternarDepartamentoEdicao(chave: DepartamentoInteresse) {
    atualizarFichaEdicao((atual) => {
      const selecionado = atual.departamentos.includes(chave)
      return {
        ...atual,
        departamentos: selecionado
          ? atual.departamentos.filter((item) => item !== chave)
          : [...atual.departamentos, chave],
      }
    })
  }

  function adicionarProdutoEdicao() {
    const produto = normalizarProduto(produtoEdicaoDigitado)
    if (!produto) return
    atualizarFichaEdicao((atual) => {
      const jaExiste = atual.produtosInteresse.some((item) => item.toLocaleLowerCase('pt-BR') === produto.toLocaleLowerCase('pt-BR'))
      if (jaExiste || atual.produtosInteresse.length >= FICHA_PRODUTOS_MAX_ITENS) return atual
      return { ...atual, produtosInteresse: [...atual.produtosInteresse, produto] }
    })
    setProdutoEdicaoDigitado('')
  }

  function atualizarViradaCartaoEdicao(valor: string) {
    const formatada = formatarViradaCartaoInput(valor)
    const convertida = converterViradaCartaoInput(formatada)
    setViradaCartaoEdicaoInput(formatada)
    atualizarFichaEdicao((atual) => ({
      ...atual,
      viradaCartaoDia: convertida?.dia,
      viradaCartaoMes: convertida?.mes,
    }))
  }

  function alternarMotivoEdicao(chave: MotivoResultado) {
    if (chave === 'virada_cartao') setMostrarErroViradaCartaoEdicao(false)
    atualizarFichaEdicao((atual) => {
      const selecionado = atual.motivosResultado.includes(chave)
      const motivosResultado = selecionado
        ? atual.motivosResultado.filter((item) => item !== chave)
        : [...atual.motivosResultado, chave]
      if (selecionado && chave === 'virada_cartao') setViradaCartaoEdicaoInput('')
      return {
        ...atual,
        motivosResultado,
        lojasMotivos: Object.fromEntries(Object.entries(atual.lojasMotivos ?? {}).filter(([key]) => motivosResultado.includes(key as MotivoResultado))),
        motivoOutro: selecionado && chave === 'outro' ? undefined : atual.motivoOutro,
        viradaCartaoDia: selecionado && chave === 'virada_cartao' ? undefined : atual.viradaCartaoDia,
        viradaCartaoMes: selecionado && chave === 'virada_cartao' ? undefined : atual.viradaCartaoMes,
      }
    })
  }

  async function salvarEdicao() {
    if (!selecionado || !fichaEdicao || salvandoEdicao) return
    setErroEdicao(null)
    setMensagemEdicao(null)

    const validacao = validarFichaParaConclusao({
      ficha: fichaEdicao,
      clienteId: selecionado.atendimento.clienteId,
      numeroLancamento: numeroLancamentoEdicao,
    })
    if (!validacao.ok) {
      if (validacao.field === 'viradaCartao') {
        setMostrarErroViradaCartaoEdicao(true)
        return
      }
      setErroEdicao(validacao.message)
      return
    }

    setSalvandoEdicao(true)
    try {
      const payload = montarPayloadEdicaoAtendimento({
        detalhe: selecionado,
        ficha: fichaEdicao,
        numeroLancamento: validacao.numeroLancamento,
      })
      const response = await fetch(`/api/atendimento-presencial/atendimentos/${selecionado.atendimento.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = (await response.json()) as ApiEdicaoResponse
      if (!response.ok || !data.ok) throw new Error(data.message ?? 'Erro ao salvar edicao')
      if (data.semAlteracoes) {
        setMensagemEdicao(data.message ?? 'Nao houve mudancas para salvar.')
        return
      }
      setEdicaoAberta(false)
      await carregarDetalhe(selecionado.atendimento.id, { preservarMensagemEdicao: true })
      await carregarRegistros()
      setMensagemEdicao('Atendimento atualizado.')
    } catch (error) {
      setErroEdicao(error instanceof Error ? error.message : 'Erro ao salvar edicao')
    } finally {
      setSalvandoEdicao(false)
    }
  }

  async function carregarRascunhos(page = paginaRascunhos, filtros = filtrosRascunhos.applied) {
    const requestId = ++rascunhosRequest.current
    if (!podeVerRascunhos) return
    setCarregandoRascunhos(true)
    setErroRascunhos(null)
    try {
      const params = new URLSearchParams({ page: String(page) })
      for (const [key, value] of Object.entries(filtros)) {
        if (Array.isArray(value)) value.forEach(item => params.append(key, item))
        else if (value) params.set(key, value)
      }
      const response = await fetch('/api/atendimento-presencial/atendimentos/rascunhos?' + params, { cache: 'no-store' })
      const data = (await response.json()) as ApiListaRascunhosResponse
      if (!response.ok || !data.ok) throw new Error(data.message ?? 'Erro ao carregar rascunhos')
      if (requestId !== rascunhosRequest.current) return
      setTotalRascunhos(data.total ?? 0)
      setPaginaRascunhos(data.page ?? page)
      setConsultorasRascunhos(data.consultorasDisponiveis ?? [])
      setRascunhos(data.rascunhos ?? [])
      guardarEstadoLista('rascunhos', { filtros, page: data.page ?? page })
      setContextoRascunhos(data.contexto ?? null)
      restaurarPosicaoLista()
    } catch (error) {
      if (requestId === rascunhosRequest.current) setErroRascunhos(error instanceof Error ? error.message : 'Erro ao carregar rascunhos')
    } finally {
      if (requestId === rascunhosRequest.current) setCarregandoRascunhos(false)
    }
  }

  const abasPermitidas = useMemo(() => {
    const abas: string[] = []
    if (podeVerRegistros) abas.push('finalizados')
    if (podeVerRascunhos) abas.push('rascunhos')
    return abas
  }, [podeVerRegistros, podeVerRascunhos])

  const tabPadrao = abasPermitidas[0] ?? ''

  const tabAtual = useMemo(() => {
    const param = searchParams?.get('tab') ?? ''
    if (abasPermitidas.includes(param)) return param
    return tabPadrao
  }, [searchParams, abasPermitidas, tabPadrao])

  function navegarParaTab(valor: string) {
    if (!abasPermitidas.includes(valor)) return
    router.push(`/atendimento-presencial/registros?tab=${valor}`, { scroll: false })
  }

  useEffect(() => {
    const param = searchParams?.get('tab') ?? ''
    if (param && abasPermitidas.includes(param)) return
    if (tabPadrao && param !== tabPadrao) {
      router.replace(`/atendimento-presencial/registros?tab=${tabPadrao}`, { scroll: false })
    }
  }, [searchParams, abasPermitidas, tabPadrao, router])

  useEffect(() => {
    if (!restauracaoLida.current) {
      restauracaoLida.current = true
      const salvo = lerEstadoLista('salvos')
      const rascunho = lerEstadoLista('rascunhos')
      const baseSalvos = restaurarFiltros(FILTROS_FINALIZADOS_INICIAL, salvo?.filtros)
      const adicionaisSalvos = restaurarFiltros(FILTROS_ADICIONAIS, salvo?.adicionais)
      const baseRascunhos = restaurarFiltros({ ...FILTROS_ADICIONAIS, clienteNome: '', consultora: '', unidadeId: '' }, rascunho?.filtros)
      for (const chave of Object.keys(baseSalvos) as Array<keyof typeof baseSalvos>) filtrosFinalizados.setField(chave, baseSalvos[chave])
      for (const chave of Object.keys(adicionaisSalvos) as Array<keyof typeof adicionaisSalvos>) novosFiltros.setField(chave, adicionaisSalvos[chave])
      for (const chave of Object.keys(baseRascunhos) as Array<keyof typeof baseRascunhos>) filtrosRascunhos.setField(chave, baseRascunhos[chave])
      filtrosFinalizados.apply(); novosFiltros.apply(); filtrosRascunhos.apply()
      setPaginaRegistros(salvo?.page ?? 1); setPaginaRascunhos(rascunho?.page ?? 1)
      if (tabAtual === 'finalizados' && podeVerRegistros) void carregarRegistros({ ...baseSalvos, de: baseSalvos.viradaCartaoDe, ate: baseSalvos.viradaCartaoAte, adicionais: adicionaisSalvos, page: salvo?.page ?? 1 })
      if (tabAtual === 'rascunhos' && podeVerRascunhos) void carregarRascunhos(rascunho?.page ?? 1, baseRascunhos)
      return
    }
    if (tabAtual === 'finalizados' && podeVerRegistros) void carregarRegistros()
    if (tabAtual === 'rascunhos' && podeVerRascunhos) void carregarRascunhos()
    // Apenas navegação carrega a lista; digitar filtros nunca dispara consulta.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabAtual, podeVerRegistros, podeVerRascunhos])

  return (
    <PageContainer className="space-y-6">
      <PageHeader
        icon={<ClipboardList className="size-6" aria-hidden="true" />}
        eyebrow="Atendimento presencial"
        title="Registros de atendimentos"
        action={podeVerRegistros ? (
          <Button type="button" variant="secondary" onClick={() => void carregarRegistros()} disabled={carregando}>
            <RefreshCw className="size-4" aria-hidden="true" />
            Atualizar
          </Button>
        ) : undefined}
      />

      {erro && <Alert tone="danger">{erro}</Alert>}

      <Tabs value={tabAtual} onValueChange={navegarParaTab} className="gap-4">
        <SegmentedTabsList className="w-fit">
          {podeVerRegistros && <SegmentedTabsTrigger value="finalizados">Atendimentos Salvos</SegmentedTabsTrigger>}
          {podeVerRascunhos && <SegmentedTabsTrigger value="rascunhos">Rascunhos</SegmentedTabsTrigger>}
        </SegmentedTabsList>

        <TabsContent value="finalizados">
          <div className="grid gap-5">
            <Card>
              <CardHeader icon={<ClipboardList className="size-4" aria-hidden="true" />} title="Concluídos" />
              <CardContent className="space-y-4">
                <FilterPanel
                  dirty={filtrosFinalizados.dirty || novosFiltros.dirty}
                  onApply={aplicarFiltrosFinalizados}
                  onClear={limparFiltrosFinalizados}
                  applyDisabled={carregando}
                >
                  <FilterFieldGroup label="Cliente, consultora e filial">
                    <FormField id="filtro-cliente-nome" label="Cliente">
                      {(field) => (
                        <Input
                          {...field}
                          value={filtrosFinalizados.draft.clienteNome}
                          onChange={(event) => filtrosFinalizados.setField('clienteNome', event.target.value)}
                          inputMode="search"
                          placeholder="Pesquisar por nome"
                        />
                      )}
                    </FormField>
                    <FormField id="filtro-consultora" label="Consultora do atendimento">
                      {(field) => (
                        <Select
                          value={filtrosFinalizados.draft.consultora || 'all'}
                          onValueChange={(value) => filtrosFinalizados.setField('consultora', value === 'all' ? '' : value)}
                        >
                          <SelectTrigger id={field.id} className="w-full"><SelectValue placeholder="Todas" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Todas</SelectItem>
                            {consultorasFinalizados.map((consultora) => (
                              <SelectItem key={consultora.nome} value={consultora.nome}>{consultora.nome}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </FormField>
                    <FormField id="filtro-situacao-venda" label="Situação da Venda">
                      {(field) => (
                        <Select value={filtrosFinalizados.draft.situacaoVenda || 'all'} onValueChange={(value) => filtrosFinalizados.setField('situacaoVenda', value === 'all' ? '' : value)}>
                          <SelectTrigger id={field.id} className="w-full"><SelectValue placeholder="Todas" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Todas</SelectItem>
                            {SITUACOES_VENDA.map((item) => <SelectItem key={item.chave} value={item.chave}>{item.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      )}
                    </FormField>
                    <FormField id="filtro-filial" label="Filial">
                      {(field) => (
                        <Select
                          value={filtrosFinalizados.draft.unidadeId || 'all'}
                          onValueChange={(value) => filtrosFinalizados.setField('unidadeId', value === 'all' ? '' : value)}
                        >
                          <SelectTrigger id={field.id} className="w-full"><SelectValue placeholder="Todas" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Todas</SelectItem>
                            {unidadesFinalizados.map((unidade) => (
                              <SelectItem key={unidade.id} value={unidade.id}>{unidade.nome}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </FormField>
                  </FilterFieldGroup>

                  <FilterFieldGroup label="Virada do cartão" className="border-t border-slate-200 pt-4">
                    <FormField id="filtro-virada-cartao-de" label="De" helper="DD/MM">
                      {(field) => (
                        <Input
                          {...field}
                          value={filtrosFinalizados.draft.viradaCartaoDe}
                          onChange={(event) => filtrosFinalizados.setField('viradaCartaoDe', formatarViradaCartaoInput(event.target.value))}
                          inputMode="numeric"
                          placeholder="DD/MM"
                          maxLength={5}
                        />
                      )}
                    </FormField>
                    <FormField id="filtro-virada-cartao-ate" label="Até" helper="DD/MM">
                      {(field) => (
                        <Input
                          {...field}
                          value={filtrosFinalizados.draft.viradaCartaoAte}
                          onChange={(event) => filtrosFinalizados.setField('viradaCartaoAte', formatarViradaCartaoInput(event.target.value))}
                          inputMode="numeric"
                          placeholder="DD/MM"
                          maxLength={5}
                        />
                      )}
                    </FormField>
                  </FilterFieldGroup>
                  <FiltrosAdicionaisAtendimento value={novosFiltros.draft} onChange={(campo, valor) => novosFiltros.setField(campo, valor)} />
                </FilterPanel>
                <p className="text-sm text-muted-foreground">{resumoFiltros({ ...filtrosFinalizados.applied, ...novosFiltros.applied }, unidadesFinalizados)}</p>
                <p role="status" className="text-sm font-semibold">{totalRegistros} atendimentos · {contagens.clientesUnicos} clientes únicos · {contagens.visitasNaoClientes} visitas de Não clientes</p>

                <div className="grid gap-3">
                  {carregando && (
                    <div role="status" className="rounded-md border border-dashed border-slate-200 p-8 text-center">
                      <Spinner label="Carregando registros" />
                    </div>
                  )}
                  {!carregando && registros.length === 0 && (
                    <EmptyState
                      icon={<ClipboardList className="size-5" aria-hidden="true" />}
                      title="Nenhum atendimento concluído encontrado"
                      description="Ajuste os filtros ou aguarde novos atendimentos serem concluídos."
                    />
                  )}
                  {registros.map((registro) => (
                    <Card key={registro.id} className="overflow-hidden border-sky-200 shadow-sm transition-shadow hover:shadow-md">
                      <button
                        type="button"
                        onClick={() => void verAtendimento(registro.id)}
                        className="block w-full text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                      >
                        <CardHeader
                          title={registro.clienteNome}
                          description={registro.unidadeNome}
                          action={<span className="shrink-0 rounded-md border border-sky-100 bg-white/70 px-3 py-2 text-right">
                            <span className="block text-[10px] font-bold uppercase tracking-wide text-sky-700">{registroNaoCliente(registro) ? 'Tipo' : 'Situação da Venda'}</span>
                            <Badge tone={registroNaoCliente(registro) ? 'neutral' : situacaoVendaRegistro(registro.resultadoAtendimento).tone}>{registroNaoCliente(registro) ? 'Não cliente' : situacaoVendaRegistro(registro.resultadoAtendimento).label}</Badge>
                          </span>}
                        />
                        <CardContent className="space-y-3 pt-0">
                          {registroSemTelefone(registro) && <p className="rounded-lg border border-destructive/30 bg-red-50 px-3 py-2 text-sm font-bold text-destructive">Sem telefone cadastrado</p>}
                          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                            <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3">
                              <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500"><UserRound className="size-3.5" aria-hidden="true" />Consultora do atendimento</p>
                              <p className="mt-1 font-semibold text-slate-900">{registro.consultoraNomeManual || 'Não informada'}</p>
                            </div>
                            {registroNaoCliente(registro) ? (
                              <div className="rounded-xl border border-sky-200 bg-sky-50/80 p-3">
                                <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-sky-800"><Heart className="size-3.5" aria-hidden="true" />Motivo da visita</p>
                                <p className="mt-1 font-semibold text-slate-900">{getMotivoVisitaLabel(registro.motivoVisita)}</p>
                              </div>
                            ) : (
                              <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3">
                                <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500"><CalendarDays className="size-3.5" aria-hidden="true" />Início do atendimento</p>
                                <p className="mt-1 font-semibold text-slate-900">{formatarData(registro.iniciadoEm ?? null)}</p>
                              </div>
                            )}
                            <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3">
                              <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500"><History className="size-3.5" aria-hidden="true" />Salvo em</p>
                              <p className="mt-1 font-semibold text-slate-900">{formatarData(registro.concluidoEm)}</p>
                            </div>
                            {!registroNaoCliente(registro) && registro.clienteTelefone && (
                              <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3">
                                <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500"><Phone className="size-3.5" aria-hidden="true" />Telefone</p>
                                <p className="mt-1 font-semibold text-slate-900">{registro.clienteTelefone}</p>
                              </div>
                            )}
                            {registro.numeroLancamento && (
                              <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3">
                                <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500"><ClipboardList className="size-3.5" aria-hidden="true" />Número do lançamento</p>
                                <p className="mt-1 font-semibold text-slate-900">{registro.numeroLancamento}</p>
                              </div>
                            )}
                            {formatarViradaCartao(registro.viradaCartaoDia, registro.viradaCartaoMes) && (
                              <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3">
                                <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500"><CalendarDays className="size-3.5" aria-hidden="true" />Virada do cartão</p>
                                <p className="mt-1 font-semibold text-slate-900">{formatarViradaCartao(registro.viradaCartaoDia, registro.viradaCartaoMes)}</p>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </button>
                      <div className="grid gap-2 border-t border-slate-100 bg-slate-50/60 px-4 py-3 sm:grid-cols-2">
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => void verAtendimento(registro.id)}
                          disabled={carregandoDetalhe}
                          size="lg"
                          className="w-full"
                        >
                          <Eye className="size-4" aria-hidden="true" />
                          Ver atendimento
                        </Button>
                        <Button
                          type="button"
                          onClick={() => void editarAtendimentoCard(registro.id)}
                          disabled={carregandoEdicaoId === registro.id}
                          size="lg"
                          className="w-full"
                        >
                          {carregandoEdicaoId === registro.id ? (
                            <>
                              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                              Carregando...
                            </>
                          ) : (
                            <>
                              <Pencil className="size-4" aria-hidden="true" />
                              Editar atendimento
                            </>
                          )}
                        </Button>
                      </div>
                    </Card>
                  ))}
                  {totalRegistros > TABLE_PAGE_SIZE && (
                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3 text-sm text-slate-600">
                      <span>Página {paginaRegistros} de {Math.ceil(totalRegistros / TABLE_PAGE_SIZE)}</span>
                      <div className="flex gap-2">
                        <Button type="button" variant="secondary" size="sm" disabled={carregando || paginaRegistros === 1} onClick={() => void carregarRegistros({ page: paginaRegistros - 1 })}>Anterior</Button>
                        <Button type="button" variant="secondary" size="sm" disabled={carregando || paginaRegistros >= Math.ceil(totalRegistros / TABLE_PAGE_SIZE)} onClick={() => void carregarRegistros({ page: paginaRegistros + 1 })}>Próxima</Button>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Dialog open={detalheAberto} onOpenChange={setDetalheAberto}>
              <DialogContent className="w-[96vw] max-w-[96vw] max-h-[90dvh] sm:max-w-[72rem]">
                <DialogHeader
                  title={selecionado?.cliente?.nome ? `Atendimento — ${selecionado.cliente.nome}` : selecionado ? 'Atendimento — Não cliente' : 'Atendimento'}
                  description="Dados salvos deste atendimento"
                />
                <DialogBody className="space-y-4 bg-slate-50/70 text-sm text-slate-700 sm:space-y-5">
                {erroDetalhe && <Alert tone="danger">Não foi possível carregar os dados completos: {erroDetalhe}</Alert>}
                {carregandoDetalhe && (
                  <div className="space-y-4">
                    {resumoCarregamento && (
                      <div className="rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/10 via-white to-info/10 p-4 sm:p-5">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-xs font-bold uppercase tracking-wide text-primary">Resumo do atendimento</p>
                            <p className="mt-1 text-lg font-bold text-slate-950">{resumoCarregamento.clienteNome}</p>
                          </div>
                          <Badge tone={registroNaoCliente(resumoCarregamento) ? 'neutral' : situacaoVendaRegistro(resumoCarregamento.resultadoAtendimento).tone}>
                            {registroNaoCliente(resumoCarregamento) ? 'Não cliente' : situacaoVendaRegistro(resumoCarregamento.resultadoAtendimento).label}
                          </Badge>
                        </div>
                        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                          <div className="rounded-xl border border-white bg-white/80 p-3"><p className="text-xs font-semibold text-slate-500">Consultora do atendimento</p><p className="mt-1 font-semibold text-slate-900">{resumoCarregamento.consultoraNomeManual ?? 'Não informada'}</p></div>
                          <div className="rounded-xl border border-white bg-white/80 p-3"><p className="text-xs font-semibold text-slate-500">Filial</p><p className="mt-1 font-semibold text-slate-900">{resumoCarregamento.unidadeNome}</p></div>
                          <div className="rounded-xl border border-white bg-white/80 p-3"><p className="text-xs font-semibold text-slate-500">Início</p><p className="mt-1 font-semibold text-slate-900">{formatarData(resumoCarregamento.iniciadoEm ?? null)}</p></div>
                        </div>
                      </div>
                    )}
                    <div role="status" className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 text-slate-600">
                      <Spinner label="Carregando dados completos do atendimento" />
                      <span>Buscando ficha, interesses e histórico…</span>
                    </div>
                  </div>
                )}
                {!carregandoDetalhe && !selecionado && !erroDetalhe && (
                  <EmptyState
                    icon={<ClipboardList className="size-5" aria-hidden="true" />}
                    title="Nenhum atendimento selecionado"
                    description="Selecione um atendimento para consultar os dados salvos."
                  />
                )}
                {!carregandoDetalhe && selecionado && (
                  <>
                    <div className="rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/10 via-white to-info/10 p-4 sm:p-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-bold uppercase tracking-wide text-primary">Resumo do atendimento</p>
                          <p className="mt-1 text-lg font-bold text-slate-950">{selecionado.cliente?.nome ?? 'Atendimento sem cliente vinculado'}</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Badge tone={selecionadoNaoCliente ? 'neutral' : situacaoVendaRegistro(selecionado.atendimento.resultadoAtendimento).tone}>
                            {selecionadoNaoCliente ? 'Não cliente' : situacaoVendaRegistro(selecionado.atendimento.resultadoAtendimento).label}
                          </Badge>
                          {!selecionadoNaoCliente && <Badge tone="brand">Cliente</Badge>}
                        </div>
                      </div>
                      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        <div className="rounded-xl border border-white bg-white/80 p-3"><p className="text-xs font-semibold text-slate-500">Consultora do atendimento</p><p className="mt-1 font-semibold text-slate-900">{selecionado.atendimento.consultoraNomeManual ?? 'Não informada'}</p></div>
                        <div className="rounded-xl border border-white bg-white/80 p-3"><p className="text-xs font-semibold text-slate-500">Filial</p><p className="mt-1 font-semibold text-slate-900">{resumoSelecionado?.unidadeNome ?? selecionado.atendimento.unidadeId}</p></div>
                        <div className="rounded-xl border border-white bg-white/80 p-3"><p className="text-xs font-semibold text-slate-500">Início</p><p className="mt-1 font-semibold text-slate-900">{formatarData(selecionado.atendimento.iniciadoEm ?? null)}</p></div>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        {selecionado.atendimento.numeroLancamento && <Badge tone="info">Lançamento {selecionado.atendimento.numeroLancamento}</Badge>}
                        {formatarViradaCartao(selecionado.atendimento.viradaCartaoDia, selecionado.atendimento.viradaCartaoMes) && <Badge tone="neutral">Virada do cartão · {formatarViradaCartao(selecionado.atendimento.viradaCartaoDia, selecionado.atendimento.viradaCartaoMes)}</Badge>}
                        <span className="text-xs text-slate-500">Salvo em {formatarData(selecionado.atendimento.concluidoEm ?? null)}</span>
                      </div>
                      <div className="mt-4 flex flex-wrap items-center gap-3">
                        {selecionado.podeEditar ? (
                          <Button type="button" onClick={() => abrirEdicao(selecionado)}>
                            <Pencil className="size-4" aria-hidden="true" />
                            Editar atendimento
                          </Button>
                        ) : (
                          <Alert tone="info" className="py-2">{selecionado.motivoBloqueio ?? 'Você não possui permissão para editar este atendimento.'}</Alert>
                        )}
                        {mensagemEdicao && !edicaoAberta && <Alert tone="success" className="py-2">{mensagemEdicao}</Alert>}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                      {selecionadoNaoCliente ? (
                        <Section title="Dados da visita" description="Informações registradas pela consultora" icon={<CalendarDays className="size-4" aria-hidden="true" />} tone="section-1">
                          <div className="rounded-lg border border-white bg-white/80 p-3">
                            <p className="text-xs font-semibold text-slate-500">Motivo da visita</p>
                            <p className="mt-1 font-semibold text-slate-900">{getMotivoVisitaLabel(selecionado.atendimento.motivoVisita)}</p>
                          </div>
                        </Section>
                      ) : (
                        <>
                          <Section title="Cliente" description="Cadastro vinculado ao atendimento" icon={<UserRound className="size-4" aria-hidden="true" />} tone="section-1">
                            {registroSemTelefone({ ...selecionado.atendimento, clienteTelefone: selecionado.cliente?.telefone ?? null }) && <Alert tone="warning" title="Sem telefone cadastrado" />}
                            {selecionado.cliente ? (
                              <>
                                <p className="text-base font-semibold text-slate-950">{selecionado.cliente.nome}</p>
                                <p className="flex items-center gap-2 text-slate-600"><Phone className="size-4 text-slate-400" aria-hidden="true" />{selecionado.cliente.telefone ?? 'Sem telefone'}</p>
                                <Button type="button" variant="secondary" onClick={abrirHistoricoClienteSelecionada}>
                                  <History className="size-4" aria-hidden="true" />
                                  Ver histórico da cliente
                                </Button>
                              </>
                            ) : <p className="text-slate-600">Cliente não localizada.</p>}
                          </Section>
                          {selecionado.criancas.length > 0 && (
                            <Section title="Crianças" description={`${selecionado.criancas.length} vinculada${selecionado.criancas.length === 1 ? '' : 's'} à ficha`} icon={<Baby className="size-4" aria-hidden="true" />} tone="section-2">
                              <div className="grid gap-2 sm:grid-cols-2">
                                {selecionado.criancas.map((crianca) => (
                                  <article key={crianca.id} className="rounded-xl border border-white bg-white/85 p-3 shadow-sm">
                                    <p className="font-semibold text-slate-950">{crianca.nome || (crianca.nome_nao_informado ? 'Nome não informado' : crianca.situacao)}</p>
                                    {crianca.parentesco_vinculo && <p className="mt-1 text-sm text-slate-600"><strong>Parentesco:</strong> {crianca.parentesco_vinculo}</p>}
                                    {crianca.data_referencia_nascimento ? (
                                      <div className="mt-2 rounded-lg bg-sky-50 px-3 py-2">
                                        <p className="font-semibold text-slate-900">{descreverIdadeAproximada(crianca.data_referencia_nascimento)}</p>
                                        <p className="text-xs text-slate-600">Referência estimada: {formatarDataISOParaInput(crianca.data_referencia_nascimento)}</p>
                                      </div>
                                    ) : (
                                      <p className="mt-1 text-sm text-slate-600">{crianca.idade_valor ? `Idade informada: ${crianca.idade_valor} ${crianca.idade_unidade}` : crianca.data_prevista_nascimento ? `Previsão informada: ${formatarDataISOParaInput(crianca.data_prevista_nascimento)}` : crianca.sexo || 'Sem detalhe adicional'}</p>
                                    )}
                                  </article>
                                ))}
                              </div>
                            </Section>
                          )}
                          <Section title="Departamentos e produtos" description="Interesses registrados no atendimento" icon={<Package className="size-4" aria-hidden="true" />} tone="section-3">
                            <div>
                              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Departamentos</p>
                              <div className="flex flex-wrap gap-2">{selecionado.departamentos.length ? selecionado.departamentos.map((item) => <Badge key={item.id} tone="brand">{getDepartamentoLabel(item.departamento as DepartamentoInteresse)}</Badge>) : <p className="text-slate-500">Nenhum departamento informado.</p>}</div>
                            </div>
                            {selecionado.produtosInteresse.length > 0 && <div className="border-t border-slate-200 pt-3"><p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Produtos de interesse</p><ul className="grid gap-1 sm:grid-cols-2">{selecionado.produtosInteresse.map((item) => <li key={item.id} className="rounded-lg border border-white bg-white/80 px-3 py-2 font-medium text-slate-800">{item.descricao}</li>)}</ul></div>}
                          </Section>
                        </>
                      )}
                      <Section title="Observações" description="Anotações registradas neste atendimento" icon={<ClipboardList className="size-4" aria-hidden="true" />} tone="section-1">
                        {selecionado.atendimento.observacaoNaoFechamento != null && <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-3"><p className="text-xs font-semibold text-amber-900">Observação de não fechamento</p><p className="mt-1 whitespace-pre-wrap text-slate-700">{selecionado.atendimento.observacaoNaoFechamento || 'Sem observação'}</p></div>}
                        <p className="whitespace-pre-wrap rounded-lg border border-white bg-white/80 p-3 text-slate-700">{normalizarObservacoesRegistro(selecionado.atendimento) ?? 'Sem observações'}</p>
                      </Section>
                      {!selecionadoNaoCliente && (
                        <Section title="Motivos" description="Razões registradas para o resultado" icon={<Heart className="size-4" aria-hidden="true" />} tone="section-2">
                          {selecionado.motivos.length > 0 ? <div className="flex flex-wrap gap-2">{selecionado.motivos.map((item) => <Badge key={item.id} tone="warning">{item.complemento ? `${getMotivoLabel(item.motivo)}: ${item.complemento}` : getMotivoLabel(item.motivo)}</Badge>)}</div> : <p className="text-slate-500">Nenhum motivo adicional informado.</p>}
                        </Section>
                      )}
                      {selecionado.historico.length > 0 && (
                        <Section title="Histórico" description={`${selecionado.historico.length} registro${selecionado.historico.length === 1 ? '' : 's'} de alteração`} icon={<History className="size-4" aria-hidden="true" />} tone="section-3">
                          <div className="space-y-3 border-l-2 border-primary/20 pl-4">
                            {selecionado.historico.map((item) => {
                              const campos = Array.isArray(item.snapshot?.camposAlterados) ? item.snapshot.camposAlterados.join(', ') : null
                              const editado = item.acao === 'editado_concluido'
                              return (
                                <article key={item.id} className="relative rounded-xl border border-slate-200 bg-white p-3 shadow-sm before:absolute before:-left-[1.35rem] before:top-4 before:size-2.5 before:rounded-full before:border-2 before:border-primary before:bg-white">
                                  <div className="flex flex-wrap items-center justify-between gap-2"><Badge tone={editado ? 'info' : 'success'}>{editado ? 'Atendimento editado' : 'Atendimento concluído'}</Badge><time className="text-xs text-slate-500">{formatarData(item.created_at)}</time></div>
                                  <p className="mt-2 text-xs font-semibold text-slate-500">{item.perfil ?? item.role ?? 'Perfil não informado'}</p>
                                  {campos && <p className="mt-1 text-sm"><strong>Campos alterados:</strong> {campos}</p>}
                                  {descreverContratoHistorico(item.snapshot).map((linha, index) => <p key={index} className="mt-1 whitespace-pre-wrap text-sm text-slate-600">{linha}</p>)}
                                </article>
                              )
                            })}
                          </div>
                        </Section>
                      )}
                    </div>
                  </>
                )}
                </DialogBody>
              </DialogContent>
            </Dialog>
          </div>
        </TabsContent>

        <TabsContent value="rascunhos"><FilterPanel dirty={filtrosRascunhos.dirty} applyDisabled={carregandoRascunhos} onApply={() => { filtrosRascunhos.apply(); void carregarRascunhos(1, filtrosRascunhos.draft) }} onClear={() => { filtrosRascunhos.clear(); void carregarRascunhos(1, { ...FILTROS_ADICIONAIS, clienteNome: '', consultora: '', unidadeId: '' }) }}>
                <FilterFieldGroup label="Cliente, consultora e filial">
                  <FormField id="rascunho-cliente" label="Cliente ou cadastro pendente">{props => <Input {...props} value={filtrosRascunhos.draft.clienteNome} onChange={e => filtrosRascunhos.setField('clienteNome', e.target.value)} />}</FormField>
                  <FormField id="rascunho-consultora" label="Consultora do atendimento">{props => <Select value={filtrosRascunhos.draft.consultora || 'all'} onValueChange={v => filtrosRascunhos.setField('consultora', v === 'all' ? '' : v)}><SelectTrigger {...props} className="w-full min-w-0"><SelectValue placeholder="Todas" /></SelectTrigger><SelectContent><SelectItem value="all">Todas</SelectItem>{consultorasRascunhos.map(o => <SelectItem key={o.nome} value={o.nome}>{o.nome}</SelectItem>)}</SelectContent></Select>}</FormField>
                  <FormField id="rascunho-filial" label="Filial">{props => <Select value={filtrosRascunhos.draft.unidadeId || 'all'} onValueChange={v => filtrosRascunhos.setField('unidadeId', v === 'all' ? '' : v)}><SelectTrigger {...props} className="w-full min-w-0"><SelectValue placeholder="Todas" /></SelectTrigger><SelectContent><SelectItem value="all">Todas</SelectItem>{contextoRascunhos?.unidadesPermitidas.map(o => <SelectItem key={o.id} value={o.id}>{o.nome}</SelectItem>)}</SelectContent></Select>}</FormField>
                </FilterFieldGroup>
                <FiltrosAdicionaisAtendimento rascunhos value={filtrosRascunhos.draft} onChange={(campo, valor) => filtrosRascunhos.setField(campo, valor)} />
              </FilterPanel>
          <Card>
            <CardHeader icon={<ClipboardList className="size-4" aria-hidden="true" />} title="Rascunhos em andamento" />
            <CardContent className="space-y-3">
              {carregandoRascunhos && (
                <div role="status" className="p-4 text-center">
                  <Spinner label="Carregando rascunhos" />
                </div>
              )}
              {erroRascunhos && <Alert tone="danger">{erroRascunhos}</Alert>}
              {!carregandoRascunhos && !erroRascunhos && rascunhos.length === 0 && (
                <EmptyState
                  icon={<ClipboardList className="size-5" aria-hidden="true" />}
                  title="Nenhum rascunho ativo"
                />
              )}
              <p className="text-sm text-muted-foreground">{resumoFiltros(filtrosRascunhos.applied, contextoRascunhos?.unidadesPermitidas ?? [])}</p>
              <p role="status" className="text-sm font-semibold">{totalRascunhos} rascunhos encontrados · Página {paginaRascunhos} de {Math.max(1, Math.ceil(totalRascunhos / TABLE_PAGE_SIZE))}</p>
              {!carregandoRascunhos && !erroRascunhos && rascunhos.map((rascunho) => {
                const unidade = contextoRascunhos?.unidadesPermitidas.find((item) => item.id === rascunho.unidadeId)
                return (
                  <Card key={rascunho.id} className="min-w-0 border-amber-300 p-4">
                    <div className="flex min-w-0 flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                      <p className="min-w-0 break-words text-base font-semibold text-slate-950">{nomeClienteRascunho(rascunho.clienteNome)}</p>{rascunho.clienteCadastroPendente && <Badge tone="neutral">Cadastro pendente</Badge>}
                      <Badge tone="warning">Rascunho</Badge>
                    </div>
                    <div className="mt-2 grid gap-1 text-sm text-slate-600">
                      <p><strong>Tipo:</strong> {rascunho.tipoAtendimento === 'nao_cliente' ? 'Não cliente' : rascunho.tipoAtendimento === 'cliente' ? 'Cliente' : 'Tipo não informado'}</p>
                      {rascunho.tipoAtendimento !== 'nao_cliente' && <p><strong>Telefone:</strong> {rascunho.clienteTelefone || 'Sem telefone'}</p>}
                      <p className="break-words">
                        <strong>Consultora do atendimento:</strong> <span className="font-medium text-slate-800">{nomeConsultoraRascunho(rascunho.consultoraNome)}</span>
                      </p>
                      <p className="break-words">
                        <strong>Filial:</strong> <span className="font-medium text-slate-800">{unidade?.nome ?? rascunho.unidadeId}</span>
                      </p>
                      <p><strong>Última atividade:</strong> {formatarData(rascunho.ultimaAtividadeEm)}</p>
                      <p><strong>Expira em:</strong> {diasRestantes(rascunho.expiraEm)} dias</p>
                    </div>
                    <Button
                      type="button"
                      onClick={() => { guardarPosicaoLista(); router.push(`/atendimento-presencial/prancheta?rascunho=${rascunho.id}`) }}
                      size="lg"
                      className="mt-3 w-full"
                    >
                      Continuar atendimento
                    </Button>
                  </Card>
                )
              })}
              <div className="flex justify-end gap-2"><Button variant="secondary" disabled={carregandoRascunhos || paginaRascunhos <= 1} onClick={() => void carregarRascunhos(paginaRascunhos - 1)}>Anterior</Button><Button variant="secondary" disabled={carregandoRascunhos || paginaRascunhos * TABLE_PAGE_SIZE >= totalRascunhos} onClick={() => void carregarRascunhos(paginaRascunhos + 1)}>Próxima</Button></div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <HistoricoClienteModal
        open={historicoAberto}
        onOpenChange={setHistoricoAberto}
        cliente={historicoCliente}
      />

      <Dialog open={edicaoAberta} onOpenChange={(open) => { if (!open) setEdicaoAberta(false) }}>
        <DialogContent className="w-[96vw] max-w-[96vw] max-h-[90dvh] sm:max-w-[80rem]">
          <DialogHeader
            title={
              <>
                Editar atendimento
                {selecionado?.cliente?.nome && <span className="ml-2 font-normal text-slate-500">- {selecionado.cliente.nome}</span>}
              </>
            }
            description={selecionado ? `Versao ${selecionado.atendimento.version}` : undefined}
          />

          <DialogBody className="space-y-4">
            {(carregandoDetalhe || !selecionado) && (
              <div role="status" className="p-4 text-center">
                <Spinner label="Carregando atendimento" />
              </div>
            )}

            {!carregandoDetalhe && selecionado && !selecionado.podeEditar && (
              <Alert tone="info">
                {selecionado.motivoBloqueio ?? 'Voce nao possui permissao para editar este atendimento.'}
              </Alert>
            )}

            {!carregandoDetalhe && selecionado && selecionado.podeEditar && fichaEdicao && (
              <>
                {mensagemEdicao && <Alert tone="success">{mensagemEdicao}</Alert>}
                {erroEdicao && <Alert tone="danger">{erroEdicao}</Alert>}

                <div className="grid gap-1 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm">
                  <p className="text-xs font-bold uppercase text-slate-500">Somente leitura</p>
                  <p>{selecionadoNaoCliente ? 'Não cliente' : `Cliente: ${selecionado.cliente?.nome ?? 'Cliente nao localizada'}`}</p>
                  <p>Unidade: {resumoSelecionado?.unidadeNome ?? selecionado.atendimento.unidadeId}</p>
                  <p>Consultora do atendimento: {selecionado.atendimento.consultoraNomeManual ?? 'Não informada'}</p>

                </div>

                <Section title="Dados da ficha" tone="section-1" collapsible>
                <Section title="Identificação e crianças" variant="subsection" collapsible>
                <FormField id="edicao-consultora-nome" label="Consultora do atendimento">
                  {(field) => (
                    <Input
                      {...field}
                      value={fichaEdicao.consultoraNome ?? ''}
                      onChange={(event) => atualizarFichaEdicao((atual) => ({ ...atual, consultoraNome: event.target.value.toLocaleUpperCase('pt-BR') }))}
                      onBlur={(event) => atualizarFichaEdicao((atual) => ({ ...atual, consultoraNome: normalizarNomeConsultora(event.target.value) }))}
                      maxLength={FICHA_CONSULTORA_NOME_MAX_CHARS}
                      placeholder="Digite o nome da consultora"
                    />
                  )}
                </FormField>

                {!selecionadoNaoCliente && <div className="grid gap-3">
                  <p className="text-sm font-semibold text-slate-800">Criancas</p>
                  {fichaEdicao.criancas.map((crianca) => (
                    <Card key={crianca.id} className="p-3">
                      <div className="grid gap-3">
                        <FormField id={`edicao-situacao-${crianca.id}`} label="Situacao">
                          {(field) => (
                            <Select
                              value={crianca.situacao}
                              onValueChange={(value) => atualizarCriancaEdicao(crianca.id, {
                                situacao: value as SituacaoCrianca,
                                presenteJaNasceu: undefined,
                                dataPrevistaNascimento: undefined,
                                idadeUnidade: undefined,
                                idadeValor: undefined,
                              })}
                            >
                              <SelectTrigger id={field.id}><SelectValue placeholder="Selecione a situacao" /></SelectTrigger>
                              <SelectContent position="popper" className="max-h-60">
                                {SITUACOES_CRIANCA.map((item) => <SelectItem key={item.chave} value={item.chave}>{item.label}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          )}
                        </FormField>
                        {crianca.situacao === 'presente_outra_pessoa' && <FormField id={`edicao-presente-nasceu-${crianca.id}`} label="Já nasceu?" required>{(field)=><div {...field} className="flex gap-2">{[true,false].map((nasceu)=><OpcaoButton key={String(nasceu)} selected={crianca.presenteJaNasceu===nasceu} onClick={()=>atualizarCriancaEdicao(crianca.id,{presenteJaNasceu:nasceu,idadeUnidade:undefined,idadeValor:undefined,dataPrevistaNascimento:undefined})}>{nasceu?'Sim':'Não'}</OpcaoButton>)}</div>}</FormField>}
                        {(crianca.situacao === 'gestacao' || (crianca.situacao === 'presente_outra_pessoa' && crianca.presenteJaNasceu === false)) && (
                          <FormField id={`edicao-data-prevista-${crianca.id}`} label="Data prevista de nascimento">
                            {(field) => (
                              <DateField
                                {...field}
                                value={dataPrevistaEdicaoInputs[crianca.id] ?? formatarDataISOParaInput(crianca.dataPrevistaNascimento)}
                                onChange={(display) => atualizarDataPrevistaEdicao(crianca.id, display)}
                              />
                            )}
                          </FormField>
                        )}
                        {criancaJaNasceu(crianca) && (
                          <div className="grid gap-2">
                            <div className="grid grid-cols-2 gap-2">
                              {(['meses', 'anos'] as UnidadeIdadeCrianca[]).map((unidade) => (
                                <OpcaoButton key={unidade} selected={crianca.idadeUnidade === unidade} onClick={() => atualizarCriancaEdicao(crianca.id, { idadeUnidade: unidade, idadeValor: undefined })}>
                                  {unidade === 'meses' ? 'Meses' : 'Anos'}
                                </OpcaoButton>
                              ))}
                            </div>
                            {crianca.idadeUnidade && (
                              <div className="grid grid-cols-4 gap-2">
                                {Array.from({ length: crianca.idadeUnidade === 'meses' ? 11 : 6 }, (_, i) => i + 1).map((valor) => (
                                  <OpcaoButton key={valor} selected={crianca.idadeValor === valor} onClick={() => atualizarCriancaEdicao(crianca.id, { idadeValor: valor })} className="text-center">
                                    {valor}
                                  </OpcaoButton>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                        <FormField id={`edicao-nome-crianca-${crianca.id}`} label="Nome da crianca" helper="Opcional">
                          {(field) => (
                            <Input
                              {...field}
                              value={crianca.nome ?? ''}
                              disabled={crianca.nomeNaoInformado}
                              onChange={(event) => atualizarCriancaEdicao(crianca.id, { nome: limparNomeCriancaDigitacao(event.target.value), nomeNaoInformado: false })}
                              placeholder="Nome da crianca"
                            />
                          )}
                        </FormField>
                        <label className="flex min-h-10 items-center gap-3 rounded-md border border-input bg-input-background px-3 text-sm font-semibold text-slate-700">
                          <input
                            type="checkbox"
                            checked={crianca.nomeNaoInformado === true}
                            onChange={(event) => atualizarCriancaEdicao(crianca.id, event.target.checked ? { nome: undefined, nomeNaoInformado: true } : { nomeNaoInformado: false })}
                            className="h-4 w-4"
                          />
                          Nao sabe o nome ainda
                        </label>
                        <FormField id={`edicao-sexo-${crianca.id}`} label="Sexo" helper="Opcional">
                          {(field) => (
                            <Select
                              value={crianca.sexo ?? 'nao_informado'}
                              onValueChange={(value) => atualizarCriancaEdicao(crianca.id, { sexo: value === 'nao_informado' ? undefined : value as SexoCrianca })}
                            >
                              <SelectTrigger id={field.id}><SelectValue placeholder="Sexo nao informado" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="nao_informado">Sexo nao informado</SelectItem>
                                {SEXOS_CRIANCA.map((item) => <SelectItem key={item.chave} value={item.chave}>{item.label}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          )}
                        </FormField>
                        {fichaEdicao.criancas.length > 1 && (
                          <Button type="button" variant="secondary" onClick={() => removerCriancaEdicao(crianca.id)}>
                            Remover crianca
                          </Button>
                        )}
                      </div>
                    </Card>
                  ))}
                  <Button type="button" variant="secondary" onClick={adicionarCriancaEdicao}>
                    <Plus className="size-4" aria-hidden="true" />
                    Adicionar crianca
                  </Button>
                </div>}
                </Section>

                {!selecionadoNaoCliente && <>
                <Section title="Necessidades" variant="subsection" collapsible>
                <div>
                  <p className="text-sm font-semibold text-slate-800">Departamentos</p>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {DEPARTAMENTOS_INTERESSE.map((item) => (
                      <OpcaoButton key={item.chave} selected={fichaEdicao.departamentos.includes(item.chave)} onClick={() => alternarDepartamentoEdicao(item.chave)}>
                        {item.label}
                      </OpcaoButton>
                    ))}
                  </div>
                </div>

                </Section>

                <Section title="Produtos" variant="subsection" collapsible>
                  <p className="text-sm font-semibold text-slate-800">Produtos de interesse</p>
                  <div className="mt-2 flex gap-2">
                    <Input
                      value={produtoEdicaoDigitado}
                      onChange={(event) => setProdutoEdicaoDigitado(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault()
                          adicionarProdutoEdicao()
                        }
                      }}
                      className="flex-1"
                      maxLength={FICHA_PRODUTO_MAX_CHARS}
                    />
                    <Button type="button" onClick={adicionarProdutoEdicao}>
                      <Plus className="size-4" aria-hidden="true" />
                    </Button>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {fichaEdicao.produtosInteresse.map((produto) => (
                      <button key={produto} type="button" onClick={() => atualizarFichaEdicao((atual) => ({ ...atual, produtosInteresse: atual.produtosInteresse.filter((item) => item !== produto) }))} className="inline-flex min-h-10 items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-700">
                        {produto}
                        <X className="size-4" aria-hidden="true" />
                      </button>
                    ))}
                  </div>
                </Section>

                <Section title="Resultado e condições" variant="subsection" collapsible>
                <div>
                  <p className="text-sm font-semibold text-slate-800">Resultado</p>
                  <div className="mt-2 grid gap-2">
                    {RESULTADOS_ATENDIMENTO.map((item) => (
                      <OpcaoButton key={item.chave} selected={fichaEdicao.resultadoAtendimento === item.chave} onClick={() => {
                        if (item.chave !== 'sim') setNumeroLancamentoEdicao('')
                        atualizarFichaEdicao((atual) => ({ ...atual, resultadoAtendimento: item.chave as ResultadoAtendimento,
                          ...(atual.resultadoAtendimento !== item.chave ? { motivosResultado: [], lojasMotivos: undefined, motivoOutro: undefined, viradaCartaoDia: undefined, viradaCartaoMes: undefined } : {}) }))
                      }}>
                        {item.label}
                      </OpcaoButton>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-sm font-semibold text-slate-800">Motivos</p>
                  <div className="mt-3 grid gap-4">
                    {motivosParaEdicao(fichaEdicao).map(motivo => <OpcaoButton key={motivo.chave} selected={fichaEdicao.motivosResultado.includes(motivo.chave)} onClick={() => alternarMotivoEdicao(motivo.chave)}>{motivo.label}</OpcaoButton>)}
                  </div>
                </div>

                {MOTIVOS_LOJA.filter(motivo => fichaEdicao.motivosResultado.includes(motivo)).map(motivo => <FormField key={motivo} id={'edicao-loja-' + motivo} label={motivo === 'outra_loja_fisica' ? 'Nome da loja física' : 'Nome da loja na internet'} helper="Opcional">{field => <Input {...field} maxLength={120} value={fichaEdicao.lojasMotivos?.[motivo] ?? ''} onChange={event => atualizarFichaEdicao(atual => ({ ...atual, lojasMotivos: { ...atual.lojasMotivos, [motivo]: event.target.value } }))} />}</FormField>)}
                {fichaEdicao.motivosResultado.includes('virada_cartao') && (
                  <ViradaCartaoField
                    id="edicao-virada-cartao"
                    value={viradaCartaoEdicaoInput}
                    onChange={atualizarViradaCartaoEdicao}
                    error={mostrarErroViradaCartaoEdicao ? validarViradaCartaoInput(viradaCartaoEdicaoInput) : undefined}
                  />
                )}

                {fichaEdicao.motivosResultado.includes('outro') && (
                  <FormField id="edicao-motivo-outro" label="Complemento de Outro">
                    {(field) => (
                      <Input
                        {...field}
                        value={fichaEdicao.motivoOutro ?? ''}
                        onChange={(event) => atualizarFichaEdicao((atual) => ({ ...atual, motivoOutro: event.target.value }))}
                        maxLength={120}
                      />
                    )}
                  </FormField>
                )}
                </Section>

                </>}
                {selecionadoNaoCliente && (
                  <FormField id="edicao-motivo-visita" label="Motivo da visita">
                    {(field) => (
                      <Select value={fichaEdicao.motivoVisita} onValueChange={(value) => atualizarFichaEdicao((atual) => ({ ...atual, motivoVisita: value as FichaDadosRascunho['motivoVisita'] }))}>
                        <SelectTrigger id={field.id} className="w-full"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {MOTIVOS_VISITA.map((item) => <SelectItem key={item.chave} value={item.chave}>{item.label}</SelectItem>)}
                          {fichaEdicao.motivoVisita && !MOTIVOS_VISITA.some(item => item.chave === fichaEdicao.motivoVisita) && <SelectItem value={fichaEdicao.motivoVisita}>{getMotivoVisitaLabel(fichaEdicao.motivoVisita)} (histórico)</SelectItem>}
                        </SelectContent>
                      </Select>
                    )}
                  </FormField>
                )}
                <Section title="Observações" variant="subsection" collapsible>
                {fichaEdicao.versaoFluxo === 2 && !selecionadoNaoCliente && (
                  <FormField id="edicao-observacao-nao-fechamento" label="Observação de não fechamento" helper="Opcional, até 300 caracteres">
                    {(field) => <Textarea {...field} value={fichaEdicao.observacaoNaoFechamento ?? ''} onChange={(event) => atualizarFichaEdicao((atual) => ({ ...atual, observacaoNaoFechamento: event.target.value }))} />}
                  </FormField>
                )}
                <FormField id="edicao-observacoes" label="Observacoes">
                  {(field) => (
                    <Textarea
                      {...field}
                      value={fichaEdicao.observacoes ?? ''}
                      onChange={(event) => atualizarFichaEdicao((atual) => ({ ...atual, observacoes: event.target.value }))}
                      className="min-h-32"
                      maxLength={FICHA_OBSERVACOES_MAX_CHARS}
                    />
                  )}
                </FormField>

                {fichaEdicao.resultadoAtendimento === 'sim' && (
                  <FormField id="edicao-numero-lancamento" label="Numero do lancamento">
                    {(field) => (
                      <Input
                        {...field}
                        value={numeroLancamentoEdicao}
                        onChange={(event) => setNumeroLancamentoEdicao(event.target.value.replace(/\D/g, '').slice(0, 6))}
                        inputMode="numeric"
                      />
                    )}
                  </FormField>
                )}
                </Section>

                </Section>
                <Button type="button" onClick={salvarEdicao} loading={salvandoEdicao} className="w-full">
                  <Save className="size-4" aria-hidden="true" />
                  {salvandoEdicao ? 'Salvando...' : 'Salvar edicao'}
                </Button>
              </>
            )}
          </DialogBody>
        </DialogContent>
      </Dialog>
    </PageContainer>
  )
}
