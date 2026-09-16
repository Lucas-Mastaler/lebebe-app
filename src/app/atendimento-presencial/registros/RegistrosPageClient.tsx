'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ClipboardList, History, Loader2, Pencil, Plus, RefreshCw, Save, X } from 'lucide-react'
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
import {
  DEPARTAMENTOS_INTERESSE,
  FICHA_CONSULTORA_NOME_MAX_CHARS,
  FICHA_OBSERVACOES_MAX_CHARS,
  FICHA_PRODUTO_MAX_CHARS,
  FICHA_PRODUTOS_MAX_ITENS,
  MOTIVOS_RESULTADO_GRUPOS,
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
  consultorasDisponiveis?: never[]
}

type ApiListaResponse = {
  ok: boolean
  message?: string
  registros?: RegistroResumo[]
  consultoras?: Array<{ nome: string }>
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

function formatarVendaFechadaRegistro(resultado: ResultadoAtendimento | null | undefined) {
  if (resultado === 'sim') return 'Sim'
  if (resultado === 'nao') return 'Nao'
  if (resultado === 'negociacao') return 'Em negociacao'
  return 'Nao informado'
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
  clienteNome: '',
  consultora: '',
  viradaCartaoDe: '',
  viradaCartaoAte: '',
}

type Props = {
  podeVerRegistros: boolean
  podeVerRascunhos: boolean
}

export default function RegistrosPageClient({ podeVerRegistros, podeVerRascunhos }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [registros, setRegistros] = useState<RegistroResumo[]>([])
  const [paginaRegistros, setPaginaRegistros] = useState(1)
  const [totalRegistros, setTotalRegistros] = useState(0)
  const [selecionado, setSelecionado] = useState<RegistroDetalhe | null>(null)
  const [carregando, setCarregando] = useState(false)
  const [carregandoDetalhe, setCarregandoDetalhe] = useState(false)
  const [carregandoEdicaoId, setCarregandoEdicaoId] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const filtrosFinalizados = useFilterState(FILTROS_FINALIZADOS_INICIAL)
  const [consultorasFinalizados, setConsultorasFinalizados] = useState<Array<{ nome: string }>>([])
  const [edicaoAberta, setEdicaoAberta] = useState(false)
  const [fichaEdicao, setFichaEdicao] = useState<FichaDadosRascunho | null>(null)
  const [numeroLancamentoEdicao, setNumeroLancamentoEdicao] = useState('')
  const [viradaCartaoEdicaoInput, setViradaCartaoEdicaoInput] = useState('')
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
    de?: string
    ate?: string
    clienteNome?: string
    consultora?: string
    page?: number
  }) {
    setCarregando(true)
    setErro(null)
    try {
      const params = new URLSearchParams()
      const filtroDe = filtrosOverride?.de ?? filtrosFinalizados.applied.viradaCartaoDe
      const filtroAte = filtrosOverride?.ate ?? filtrosFinalizados.applied.viradaCartaoAte
      const filtroCliente = filtrosOverride?.clienteNome ?? filtrosFinalizados.applied.clienteNome
      const filtroConsultora = filtrosOverride?.consultora ?? filtrosFinalizados.applied.consultora
      const pagina = filtrosOverride?.page ?? paginaRegistros
      if (filtroDe.trim()) params.set('viradaCartaoDe', filtroDe.trim())
      if (filtroAte.trim()) params.set('viradaCartaoAte', filtroAte.trim())
      if (filtroCliente.trim()) params.set('clienteNome', filtroCliente.trim())
      if (filtroConsultora.trim()) params.set('consultora', filtroConsultora.trim())
      params.set('page', String(pagina))
      const query = params.toString()
      const response = await fetch(`/api/atendimento-presencial/atendimentos${query ? `?${query}` : ''}`, { cache: 'no-store' })
      const data = (await response.json()) as ApiListaResponse
      if (!response.ok || !data.ok) throw new Error(data.message ?? 'Erro ao carregar registros')
      setRegistros(data.registros ?? [])
      setConsultorasFinalizados(data.consultoras ?? [])
      setPaginaRegistros(data.page ?? pagina)
      setTotalRegistros(data.total ?? 0)
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Erro ao carregar registros')
    } finally {
      setCarregando(false)
    }
  }

  function aplicarFiltrosFinalizados() {
    filtrosFinalizados.apply()
    void carregarRegistros({
      de: filtrosFinalizados.draft.viradaCartaoDe,
      ate: filtrosFinalizados.draft.viradaCartaoAte,
      clienteNome: filtrosFinalizados.draft.clienteNome.trim().replace(/\s+/g, ' '),
      consultora: filtrosFinalizados.draft.consultora,
      page: 1,
    })
  }

  function limparFiltrosFinalizados() {
    filtrosFinalizados.clear()
    void carregarRegistros({ de: '', ate: '', clienteNome: '', consultora: '', page: 1 })
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
    setErro(null)
    try {
      const detalhe = await buscarDetalhe(id)
      setSelecionado(detalhe)
      setEdicaoAberta(false)
      setFichaEdicao(null)
      if (!options?.preservarMensagemEdicao) setMensagemEdicao(null)
      setErroEdicao(null)
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Erro ao carregar atendimento')
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

  const resumoSelecionado = selecionado ? registros.find((registro) => registro.id === selecionado.atendimento.id) : null

  function abrirEdicao(detalhe: RegistroDetalhe) {
    const ficha = normalizarDetalheParaFichaEdicao(detalhe)
    setFichaEdicao(ficha)
    setNumeroLancamentoEdicao(detalhe.atendimento.numeroLancamento ? String(detalhe.atendimento.numeroLancamento) : '')
    setViradaCartaoEdicaoInput(formatarViradaCartao(ficha.viradaCartaoDia, ficha.viradaCartaoMes))
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
    atualizarFichaEdicao((atual) => {
      const selecionado = atual.motivosResultado.includes(chave)
      const motivosResultado = selecionado
        ? atual.motivosResultado.filter((item) => item !== chave)
        : [...atual.motivosResultado, chave]
      if (selecionado && chave === 'virada_cartao') setViradaCartaoEdicaoInput('')
      return {
        ...atual,
        motivosResultado,
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

  async function carregarRascunhos() {
    if (!podeVerRascunhos) return
    setCarregandoRascunhos(true)
    setErroRascunhos(null)
    try {
      const response = await fetch('/api/atendimento-presencial/atendimentos/rascunhos', { cache: 'no-store' })
      const data = (await response.json()) as ApiListaRascunhosResponse
      if (!response.ok || !data.ok) throw new Error(data.message ?? 'Erro ao carregar rascunhos')
      setRascunhos(data.rascunhos ?? [])
      setContextoRascunhos(data.contexto ?? null)
    } catch (error) {
      setErroRascunhos(error instanceof Error ? error.message : 'Erro ao carregar rascunhos')
    } finally {
      setCarregandoRascunhos(false)
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
    if (tabAtual === 'finalizados' && podeVerRegistros) {
      void carregarRegistros()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabAtual, podeVerRegistros])

  useEffect(() => {
    if (tabAtual === 'rascunhos' && podeVerRascunhos) {
      void carregarRascunhos()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabAtual, podeVerRascunhos])

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
          {podeVerRegistros && <SegmentedTabsTrigger value="finalizados">Atendimentos finalizados</SegmentedTabsTrigger>}
          {podeVerRascunhos && <SegmentedTabsTrigger value="rascunhos">Rascunhos</SegmentedTabsTrigger>}
        </SegmentedTabsList>

        <TabsContent value="finalizados">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(340px,420px)]">
            <Card>
              <CardHeader icon={<ClipboardList className="size-4" aria-hidden="true" />} title="Concluídos" />
              <CardContent className="space-y-4">
                <FilterPanel
                  dirty={filtrosFinalizados.dirty}
                  onApply={aplicarFiltrosFinalizados}
                  onClear={limparFiltrosFinalizados}
                  applyDisabled={carregando}
                >
                  <FilterFieldGroup label="Cliente e consultora">
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
                    <FormField id="filtro-consultora" label="Consultora">
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
                  </FilterFieldGroup>

                  <FilterFieldGroup label="Virada do cartão">
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
                </FilterPanel>

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
                    <Card key={registro.id}>
                      <button
                        type="button"
                        onClick={() => void carregarDetalhe(registro.id)}
                        className="w-full text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                      >
                        <CardHeader
                          title={registro.clienteNome}
                          description={`${registro.unidadeNome} - ${registro.consultoraEmail}`}
                          action={<span className="shrink-0 rounded-md border border-sky-100 bg-white/70 px-3 py-2 text-right">
                            <span className="block text-[10px] font-bold uppercase tracking-wide text-sky-700">Venda fechada?</span>
                            <span className="block text-sm font-bold text-slate-900">{formatarVendaFechadaRegistro(registro.resultadoAtendimento)}</span>
                          </span>}
                        />
                        <CardContent className="space-y-1">
                          {registro.consultoraNomeManual && <p className="text-sm text-slate-600">Consultora: {registro.consultoraNomeManual}</p>}
                          <p className="text-sm text-slate-600">Concluido em {formatarData(registro.concluidoEm)}</p>
                          {registro.numeroLancamento && <p className="text-sm text-slate-600">Lancamento {registro.numeroLancamento}</p>}
                          {formatarViradaCartao(registro.viradaCartaoDia, registro.viradaCartaoMes) && <p className="text-sm text-slate-600">Virada do cartao {formatarViradaCartao(registro.viradaCartaoDia, registro.viradaCartaoMes)}</p>}
                        </CardContent>
                      </button>
                      <div className="px-4 pb-4">
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

            <Card className="h-fit">
              <CardHeader icon={<ClipboardList className="size-4" aria-hidden="true" />} title="Detalhe" />
              <CardContent className="space-y-4 text-sm text-slate-700">
                {carregandoDetalhe && (
                  <div role="status" className="p-4 text-center">
                    <Spinner label="Carregando atendimento" />
                  </div>
                )}
                {!carregandoDetalhe && !selecionado && (
                  <EmptyState
                    icon={<ClipboardList className="size-5" aria-hidden="true" />}
                    title="Nenhum atendimento selecionado"
                    description="Selecione um atendimento para consultar os dados salvos."
                  />
                )}
                {!carregandoDetalhe && selecionado && (
                  <>
                    <div>
                      <p className="text-xs font-bold uppercase text-slate-500">Venda fechada?</p>
                      <p className="font-semibold text-slate-950">{formatarVendaFechadaRegistro(selecionado.atendimento.resultadoAtendimento)}</p>
                      {selecionado.atendimento.numeroLancamento && <p>Lancamento {selecionado.atendimento.numeroLancamento}</p>}
                      {formatarViradaCartao(selecionado.atendimento.viradaCartaoDia, selecionado.atendimento.viradaCartaoMes) && (
                        <p>Virada do cartao {formatarViradaCartao(selecionado.atendimento.viradaCartaoDia, selecionado.atendimento.viradaCartaoMes)}</p>
                      )}
                      {selecionado.podeEditar ? (
                        <Button type="button" variant="secondary" className="mt-3" onClick={() => abrirEdicao(selecionado)}>
                          Editar atendimento
                        </Button>
                      ) : (
                        <Alert tone="info" className="mt-3">
                          {selecionado.motivoBloqueio ?? 'Voce nao possui permissao para editar este atendimento.'}
                        </Alert>
                      )}
                      {mensagemEdicao && !edicaoAberta && (
                        <Alert tone="success" className="mt-3">{mensagemEdicao}</Alert>
                      )}
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase text-slate-500">Cliente</p>
                      {selecionado.cliente ? (
                        <>
                          <p className="font-semibold text-slate-950">{selecionado.cliente.nome}</p>
                          {selecionado.cliente.telefone && <p>{selecionado.cliente.telefone}</p>}
                          <Button type="button" variant="secondary" onClick={abrirHistoricoClienteSelecionada} className="mt-3">
                            <History className="size-4" aria-hidden="true" />
                            Ver historico
                          </Button>
                        </>
                      ) : (
                        <p>Cliente nao localizada</p>
                      )}
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase text-slate-500">Nome da consultora</p>
                      <p>{selecionado.atendimento.consultoraNomeManual ?? 'Nao informado'}</p>
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase text-slate-500">Departamentos</p>
                      <p>{selecionado.departamentos.map((item) => getDepartamentoLabel(item.departamento as DepartamentoInteresse)).join(', ') || 'Nao informado'}</p>
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase text-slate-500">Produtos</p>
                      <p>{selecionado.produtosInteresse.map((item) => item.descricao).join(', ') || 'Nao informado'}</p>
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase text-slate-500">Motivos</p>
                      <p>{selecionado.motivos.map((item) => item.motivo === 'outro' && item.complemento ? `${getMotivoLabel(item.motivo)}: ${item.complemento}` : getMotivoLabel(item.motivo)).join(', ')}</p>
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase text-slate-500">Criancas</p>
                      {selecionado.criancas.length === 0 ? (
                        <p>Nao informado</p>
                      ) : (
                        <div className="mt-2 grid gap-2">
                          {selecionado.criancas.map((crianca) => (
                            <div key={crianca.id} className="rounded-md border border-slate-200 p-3">
                              <p className="font-semibold text-slate-950">{crianca.nome || (crianca.nome_nao_informado ? 'Nome nao informado' : crianca.situacao)}</p>
                              <p>{crianca.idade_valor ? `${crianca.idade_valor} ${crianca.idade_unidade}` : crianca.data_prevista_nascimento || crianca.sexo || 'Sem detalhe adicional'}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase text-slate-500">Observacoes</p>
                      <p className="whitespace-pre-wrap">{normalizarObservacoesRegistro(selecionado.atendimento) ?? 'Sem observacoes'}</p>
                    </div>
                    {selecionado.historico.length > 0 && (
                      <div>
                        <p className="text-xs font-bold uppercase text-slate-500">Historico</p>
                        <div className="mt-2 grid gap-2">
                          {selecionado.historico.map((item) => {
                            const campos = Array.isArray(item.snapshot?.camposAlterados) ? item.snapshot.camposAlterados.join(', ') : null
                            return (
                              <div key={item.id} className="rounded-md border border-slate-200 bg-slate-50 p-3">
                                <p className="font-semibold text-slate-900">{item.acao === 'editado_concluido' ? 'Atendimento editado' : 'Atendimento concluido'}</p>
                                <p>{formatarData(item.created_at)}</p>
                                <p>{item.perfil ?? item.role ?? 'Perfil nao informado'}</p>
                                {campos && <p>Campos alterados: {campos}</p>}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="rascunhos">
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
              {rascunhos.map((rascunho) => {
                const unidade = contextoRascunhos?.unidadesPermitidas.find((item) => item.id === rascunho.unidadeId)
                return (
                  <Card key={rascunho.id} className="min-w-0 border-amber-300 p-4">
                    <div className="flex min-w-0 flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                      <p className="min-w-0 break-words text-base font-semibold text-slate-950">{nomeClienteRascunho(rascunho.clienteNome)}</p>
                      <Badge tone="warning">Rascunho</Badge>
                    </div>
                    <div className="mt-2 grid gap-1 text-sm text-slate-600">
                      <p className="break-words">
                        Consultora: <span className="font-medium text-slate-800">{nomeConsultoraRascunho(rascunho.consultoraNome)}</span>
                      </p>
                      <p className="break-words">
                        Unidade: <span className="font-medium text-slate-800">{unidade?.nome ?? rascunho.unidadeId}</span>
                      </p>
                      <p>Ultima atualizacao: {formatarData(rascunho.ultimaAtividadeEm)}</p>
                      <p>Expira em: {diasRestantes(rascunho.expiraEm)} dias</p>
                    </div>
                    <Button
                      type="button"
                      onClick={() => router.push(`/atendimento-presencial/ficha?rascunho=${rascunho.id}`)}
                      size="lg"
                      className="mt-3 w-full"
                    >
                      Continuar atendimento
                    </Button>
                  </Card>
                )
              })}
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
        <DialogContent className="max-w-2xl">
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
                  <p>Cliente: {selecionado.cliente?.nome ?? 'Cliente nao localizada'}</p>
                  <p>Unidade: {resumoSelecionado?.unidadeNome ?? selecionado.atendimento.unidadeId}</p>
                  <p>Consultora: {resumoSelecionado?.consultoraEmail ?? selecionado.atendimento.consultoraUsuarioId}</p>
                  <p>Nome da consultora: {selecionado.atendimento.consultoraNomeManual ?? 'Nao informado'}</p>
                </div>

                <Section title="Dados da ficha" tone="section-1" collapsible>
                <Section title="Identificação e crianças" variant="subsection" collapsible>
                <FormField id="edicao-consultora-nome" label="Nome da consultora">
                  {(field) => (
                    <Input
                      {...field}
                      value={fichaEdicao.consultoraNome ?? ''}
                      onChange={(event) => atualizarFichaEdicao((atual) => ({ ...atual, consultoraNome: event.target.value }))}
                      onBlur={(event) => atualizarFichaEdicao((atual) => ({ ...atual, consultoraNome: normalizarNomeConsultora(event.target.value) }))}
                      maxLength={FICHA_CONSULTORA_NOME_MAX_CHARS}
                      placeholder="Digite o nome da consultora"
                    />
                  )}
                </FormField>

                <div className="grid gap-3">
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
                        {(crianca.situacao === 'gestacao' || crianca.situacao === 'presente_outra_pessoa') && (
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
                        {crianca.situacao === 'ja_nasceu' && (
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
                </div>
                </Section>

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
                        atualizarFichaEdicao((atual) => ({ ...atual, resultadoAtendimento: item.chave as ResultadoAtendimento }))
                      }}>
                        {item.label}
                      </OpcaoButton>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-sm font-semibold text-slate-800">Motivos</p>
                  <div className="mt-3 grid gap-4">
                    {MOTIVOS_RESULTADO_GRUPOS.map((grupo) => (
                      <div key={grupo.chave}>
                        <p className="mb-2 text-base font-semibold text-slate-800">{grupo.label}</p>
                        <div className="grid gap-2">
                          {grupo.motivos.map((motivo) => (
                            <OpcaoButton key={motivo.chave} selected={fichaEdicao.motivosResultado.includes(motivo.chave)} onClick={() => alternarMotivoEdicao(motivo.chave)}>
                              {motivo.label}
                            </OpcaoButton>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {fichaEdicao.motivosResultado.includes('virada_cartao') && (
                  <FormField id="edicao-virada-cartao" label="Virada do cartao">
                    {(field) => (
                      <Input
                        {...field}
                        value={viradaCartaoEdicaoInput}
                        onChange={(event) => atualizarViradaCartaoEdicao(event.target.value)}
                        inputMode="numeric"
                        placeholder="DD/MM"
                        maxLength={5}
                      />
                    )}
                  </FormField>
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

                <Section title="Observações" variant="subsection" collapsible>
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
