'use client'

import { EditarClienteDialog } from '@/components/atendimento-presencial/EditarClienteDialog'
import { FormEvent, useEffect, useMemo, useState } from 'react'
import { Baby, ChevronLeft, ChevronRight, History, PackageCheck, Phone, Search, UserPlus, Users } from 'lucide-react'
import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  EmptyState,
  FilterFieldGroup,
  FilterField,
  FilterPanel,
  FormField,
  Input,
  PageContainer,
  PageHeader,
  Spinner,
  useFilterState,
} from '@/components/design-system'
import { countActiveFilters } from '@/lib/design-system/filters'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { MultiSelect } from '@/components/ui/multi-select'
import { HistoricoClienteModal, type HistoricoClienteModalCliente } from '@/components/atendimento-presencial/HistoricoClienteModal'
import { type ClientePresencialDTO } from '@/lib/atendimento-presencial/clientes'
import { mascararTelefoneClienteBR } from '@/lib/atendimento-presencial/telefone'
import { FASES_FILTRO_ESSENCIAIS, type CorrespondenciaEssencialCliente } from '@/lib/atendimento-presencial/filtro-essenciais-clientes'
import { PRODUTOS_ESSENCIAIS } from '@/lib/atendimento-presencial/essenciais'

type ApiClientesResponse = {
  ok: boolean
  message?: string
  clientes?: Array<ClientePresencialDTO & { correspondenciaExataTelefone?: boolean; essenciaisCorrespondentes?: CorrespondenciaEssencialCliente[] }>
  consultoras?: Array<{ nome: string }>
  meta?: {
    page: number
    pageSize: number
    total: number
    totalPages: number
  }
}

type ApiCriarClienteResponse = {
  ok: boolean
  message?: string
  cliente?: ClientePresencialDTO
  clienteExistente?: boolean
}

const FILTROS_CLIENTES_INICIAL = {
  busca: '',
  consultora: '',
  produtosEssenciais: [] as string[],
  situacaoEssencial: '',
  faseEssencial: '',
}

export default function PageClient() {
  const [clienteEdicao, setClienteEdicao] = useState<ClientePresencialDTO | null>(null)
  const filtros = useFilterState(FILTROS_CLIENTES_INICIAL)
  const [consultoras, setConsultoras] = useState<Array<{ nome: string }>>([])
  const [clientes, setClientes] = useState<Array<ClientePresencialDTO & { correspondenciaExataTelefone?: boolean; essenciaisCorrespondentes?: CorrespondenciaEssencialCliente[] }>>([])
  const [pagina, setPagina] = useState(1)
  const [totalClientes, setTotalClientes] = useState(0)
  const [totalPaginas, setTotalPaginas] = useState(1)
  const [buscando, setBuscando] = useState(false)
  const [erroBusca, setErroBusca] = useState<string | null>(null)

  const [nome, setNome] = useState('')
  const [telefone, setTelefone] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erroCadastro, setErroCadastro] = useState<string | null>(null)
  const [feedbackCadastro, setFeedbackCadastro] = useState<string | null>(null)
  const [historicoAberto, setHistoricoAberto] = useState(false)
  const [historicoCliente, setHistoricoCliente] = useState<HistoricoClienteModalCliente | null>(null)

  const podeEnviar = useMemo(() => {
    if (salvando) return false
    if (nome.trim().length < 2) return false
    return true
  }, [nome, salvando])

  async function buscarClientes(options?: { page?: number; busca?: string; consultora?: string; produtosEssenciais?: string[]; situacaoEssencial?: string; faseEssencial?: string }) {
    const page = options?.page ?? 1
    const termo = options?.busca ?? filtros.applied.busca
    const consultora = options?.consultora ?? filtros.applied.consultora
    const produtosEssenciais = options?.produtosEssenciais ?? filtros.applied.produtosEssenciais
    const situacaoEssencial = options?.situacaoEssencial ?? filtros.applied.situacaoEssencial
    const faseEssencial = options?.faseEssencial ?? filtros.applied.faseEssencial

    setBuscando(true)
    setErroBusca(null)
    setFeedbackCadastro(null)

    try {
      const params = new URLSearchParams()
      if (termo.trim()) params.set('q', termo.trim())
      if (consultora.trim()) params.set('consultoraOrigem', consultora.trim())
      if (produtosEssenciais.length) params.set('produtosEssenciais', produtosEssenciais.join(','))
      if (situacaoEssencial) params.set('situacaoEssencial', situacaoEssencial)
      if (faseEssencial) params.set('faseEssencial', faseEssencial)
      params.set('page', String(page))
      params.set('pageSize', '20')

      const response = await fetch(`/api/atendimento-presencial/clientes?${params.toString()}`, {
        cache: 'no-store',
      })
      const data = (await response.json()) as ApiClientesResponse

      if (!response.ok || !data.ok) {
        throw new Error(data.message ?? 'Erro ao buscar clientes')
      }

      setClientes(data.clientes ?? [])
      setConsultoras(data.consultoras ?? [])
      setPagina(data.meta?.page ?? page)
      setTotalClientes(data.meta?.total ?? data.clientes?.length ?? 0)
      setTotalPaginas(data.meta?.totalPages ?? 1)
    } catch (error) {
      setErroBusca(error instanceof Error ? error.message : 'Erro ao buscar clientes')
      setClientes([])
    } finally {
      setBuscando(false)
    }
  }

  useEffect(() => {
    void buscarClientes({ page: 1, ...FILTROS_CLIENTES_INICIAL })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function aplicarFiltros(event?: FormEvent) {
    event?.preventDefault()
    filtros.apply()
    void buscarClientes({ page: 1, ...filtros.draft })
  }

  function limparFiltros() {
    filtros.clear()
    void buscarClientes({ page: 1, ...FILTROS_CLIENTES_INICIAL })
  }

  async function cadastrarCliente(event: FormEvent) {
    event.preventDefault()
    if (!podeEnviar) return

    setSalvando(true)
    setErroCadastro(null)
    setFeedbackCadastro(null)

    try {
      const response = await fetch('/api/atendimento-presencial/clientes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome,
          telefone: telefone.trim() || undefined,
        }),
      })
      const data = (await response.json()) as ApiCriarClienteResponse

      if (!response.ok || !data.ok || !data.cliente) {
        throw new Error(data.message ?? 'Erro ao cadastrar cliente')
      }

      setFeedbackCadastro(
        data.clienteExistente
          ? 'Cliente existente localizada pelo telefone informado.'
          : 'Cliente cadastrada com sucesso.'
      )
      setClientes((atuais) => {
        const semDuplicar = atuais.filter((cliente) => cliente.id !== data.cliente?.id)
        return [data.cliente!, ...semDuplicar]
      })
      setTotalClientes((atual) => atual + (data.clienteExistente ? 0 : 1))

      if (!data.clienteExistente) {
        setNome('')
        setTelefone('')
      }
    } catch (error) {
      setErroCadastro(error instanceof Error ? error.message : 'Erro ao cadastrar cliente')
    } finally {
      setSalvando(false)
    }
  }

  function abrirHistoricoCliente(cliente: ClientePresencialDTO) {
    setHistoricoCliente({
      id: cliente.id,
      nome: cliente.nome,
      telefoneFormatado: cliente.telefoneFormatado,
    })
    setHistoricoAberto(true)
  }

  function mudarPagina(proximaPagina: number) {
    if (proximaPagina < 1 || proximaPagina > totalPaginas || buscando) return
    void buscarClientes({ page: proximaPagina, ...filtros.applied })
  }

  return (
    <PageContainer>
      <div className="flex flex-col gap-6">
        <PageHeader
          icon={<Users className="size-6" aria-hidden="true" />}
          eyebrow="Atendimento presencial"
          title="Clientes"
          description="Busca e cadastro inicial de clientes presenciais."
        />

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_420px] lg:items-start">
          <div className="flex flex-col gap-5">
            <FilterPanel title="Buscar cliente" activeCount={countActiveFilters(filtros.applied, FILTROS_CLIENTES_INICIAL)} dirty={filtros.dirty} onApply={aplicarFiltros} onClear={limparFiltros} applyDisabled={buscando}>
              <FilterFieldGroup label="Cliente e consultora" icon={<Users />} description="Busque pelo nome ou telefone e filtre pela consultora de origem.">
                <FormField id="filtro-busca-cliente" label="Nome ou telefone">
                  {(field) => (
                    <Input
                      {...field}
                      value={filtros.draft.busca}
                      onChange={(event) => filtros.setField('busca', event.target.value)}
                      placeholder="Nome ou telefone"
                      inputMode="search"
                    />
                  )}
                </FormField>
                <FormField id="filtro-consultora-origem" label="Consultora de origem">
                  {(field) => (
                    <Select
                      value={filtros.draft.consultora || 'all'}
                      onValueChange={(value) => filtros.setField('consultora', value === 'all' ? '' : value)}
                    >
                      <SelectTrigger id={field.id} className="w-full"><SelectValue placeholder="Todas" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas</SelectItem>
                        {consultoras.map((consultora) => (
                          <SelectItem key={consultora.nome} value={consultora.nome}>{consultora.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </FormField>
              </FilterFieldGroup>
              <FilterFieldGroup label="Produtos essenciais" icon={<PackageCheck />} description="Busque pela resposta atual da criança. Atendimentos antigos não alteram esse estado.">
                <FilterField id="filtro-produto-essencial-cliente" label="Produtos" active={filtros.draft.produtosEssenciais.length > 0}>
                  {(field) => (
                    <MultiSelect
                      id={field.id}
                      aria-describedby={field['aria-describedby']}
                      options={Object.keys(PRODUTOS_ESSENCIAIS)}
                      selected={filtros.draft.produtosEssenciais}
                      onChange={(produtos) => {
                        filtros.setField('produtosEssenciais', produtos)
                        if (!produtos.length) {
                          filtros.setField('situacaoEssencial', '')
                          filtros.setField('faseEssencial', '')
                        }
                      }}
                      placeholder="Todos os produtos"
                      ariaLabel="Produtos essenciais"
                      getOptionLabel={(value) => PRODUTOS_ESSENCIAIS[value as keyof typeof PRODUTOS_ESSENCIAIS]}
                      compactSummary
                    />
                  )}
                </FilterField>
                <FilterField id="filtro-situacao-essencial-cliente" label="Resposta atual" active={Boolean(filtros.draft.situacaoEssencial)}>
                  {(field) => <Select disabled={!filtros.draft.produtosEssenciais.length} value={filtros.draft.situacaoEssencial || 'all'} onValueChange={(value) => filtros.setField('situacaoEssencial', value === 'all' ? '' : value)}>
                    <SelectTrigger id={field.id} className="w-full"><SelectValue placeholder="Todas" /></SelectTrigger>
                    <SelectContent><SelectItem value="all">Todas</SelectItem><SelectItem value="sim">Sim</SelectItem><SelectItem value="nao">Não</SelectItem><SelectItem value="nao_informado">Não informado</SelectItem></SelectContent>
                  </Select>}
                </FilterField>
                <FilterField id="filtro-fase-essencial-cliente" label="Fase atual" active={Boolean(filtros.draft.faseEssencial)}>
                  {(field) => <Select disabled={!filtros.draft.produtosEssenciais.length} value={filtros.draft.faseEssencial || 'all'} onValueChange={(value) => filtros.setField('faseEssencial', value === 'all' ? '' : value)}>
                    <SelectTrigger id={field.id} className="w-full"><SelectValue placeholder="Todas" /></SelectTrigger>
                    <SelectContent><SelectItem value="all">Todas</SelectItem>{FASES_FILTRO_ESSENCIAIS.map((fase) => <SelectItem key={fase.chave} value={fase.chave}>{fase.label}</SelectItem>)}</SelectContent>
                  </Select>}
                </FilterField>
              </FilterFieldGroup>
            </FilterPanel>

            <Card>
              <CardHeader
                icon={<Search className="size-4" aria-hidden="true" />}
                title="Clientes encontradas"
                description={`${totalClientes} cliente${totalClientes === 1 ? '' : 's'}`}
              />
              <CardContent className="space-y-3">
                {erroBusca && <Alert tone="danger">{erroBusca}</Alert>}

                {buscando && (
                  <div role="status" className="rounded-md border border-dashed border-slate-200 p-8 text-center">
                    <Spinner label="Buscando clientes" />
                  </div>
                )}

                {!buscando && !erroBusca && clientes.length === 0 && (
                  <EmptyState
                    icon={<Users className="size-5" aria-hidden="true" />}
                    title="Nenhuma cliente encontrada"
                    description="Ajuste a busca ou cadastre uma nova cliente."
                  />
                )}

                {!buscando &&
                  clientes.map((cliente) => (
                    <Card key={cliente.id}>
                      <CardHeader
                        title={cliente.nome}
                        action={cliente.correspondenciaExataTelefone ? <Badge tone="success">Telefone encontrado</Badge> : undefined}
                      />
                      <CardContent>
                      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-slate-500">
                        <Phone className="size-3.5" aria-hidden="true" />
                        <span>{cliente.telefoneFormatado ?? 'Sem telefone'}</span>
                        <span>Atualizada em {new Date(cliente.atualizadoEm).toLocaleDateString('pt-BR')}</span>
                      </div>
                      <div className="mt-3 grid gap-1 text-sm text-slate-600 sm:grid-cols-2">
                        <p>Consultora origem: <span className="font-medium text-slate-800">{cliente.origem.consultoraNome ?? 'Não identificado'}</span></p>
                        <p>Filial origem: <span className="font-medium text-slate-800">{cliente.origem.unidadeNome ?? 'Não identificado'}</span></p>
                      </div>
                      {!!cliente.essenciaisCorrespondentes?.length && <div className="mt-3 rounded-lg border border-pink-200 bg-pink-50/70 p-3">
                        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-pink-800"><Baby className="size-3.5" aria-hidden="true" />Correspondências atuais de Produtos Essenciais</p>
                        <ul className="mt-2 space-y-2 text-sm">{cliente.essenciaisCorrespondentes.map((item) => <li key={`${item.criancaId}:${item.produto}`} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-slate-700">
                          <span className="font-semibold">{item.criancaNome}</span><span>·</span><span>{item.produtoNome}</span><Badge tone={item.resposta === 'sim' ? 'success' : item.resposta === 'nao' ? 'danger' : 'neutral'}>{item.resposta === 'sim' ? 'Sim' : item.resposta === 'nao' ? 'Não' : 'Não informado'}</Badge><span className="text-xs text-slate-500">{item.faseLabel}{item.registradoEm ? ` · confirmado em ${new Date(item.registradoEm).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}` : ''}</span>
                        </li>)}</ul>
                      </div>}
                      </CardContent>
                      <CardFooter className="flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-end"><Button type="button" variant="secondary" className="w-full sm:w-auto" onClick={() => setClienteEdicao(cliente)}>Editar cliente</Button>
                      <Button type="button" variant="secondary" onClick={() => abrirHistoricoCliente(cliente)} className="w-full sm:w-auto">
                        <History className="size-4" aria-hidden="true" />
                        Ver histórico
                      </Button>
                      </CardFooter>
                    </Card>
                  ))}
              </CardContent>
              <CardFooter className="flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-slate-600">Página {pagina} de {totalPaginas}</p>
                <div className="flex gap-2">
                  <Button type="button" variant="secondary" onClick={() => mudarPagina(pagina - 1)} disabled={buscando || pagina <= 1}>
                    <ChevronLeft className="size-4" aria-hidden="true" />
                    Voltar
                  </Button>
                  <Button type="button" variant="secondary" onClick={() => mudarPagina(pagina + 1)} disabled={buscando || pagina >= totalPaginas}>
                    Avançar
                    <ChevronRight className="size-4" aria-hidden="true" />
                  </Button>
                </div>
              </CardFooter>
            </Card>
          </div>

          <Card className="h-fit">
            <CardHeader icon={<UserPlus className="size-4" aria-hidden="true" />} title="Cadastrar cliente" description="Telefone é opcional." />
            <CardContent>
              <form className="space-y-4" onSubmit={cadastrarCliente}>
                <FormField id="cadastro-nome" label="Nome" required>
                  {(field) => (
                    <Input
                      {...field}
                      value={nome}
                      onChange={(event) => setNome(event.target.value)}
                      placeholder="Nome da cliente"
                      autoComplete="off"
                    />
                  )}
                </FormField>

                <FormField id="cadastro-telefone" label="Telefone" helper="Opcional">
                  {(field) => (
                    <Input
                      {...field}
                      value={telefone}
                      onChange={(event) => setTelefone(mascararTelefoneClienteBR(event.target.value))}
                      placeholder="(41) 99999-9999"
                      inputMode="tel"
                      autoComplete="off"
                    />
                  )}
                </FormField>

                {erroCadastro && <Alert tone="danger">{erroCadastro}</Alert>}
                {feedbackCadastro && <Alert tone="success">{feedbackCadastro}</Alert>}

                <Button type="submit" className="w-full" loading={salvando} disabled={!podeEnviar}>
                  <Users className="size-4" aria-hidden="true" />
                  {salvando ? 'Salvando...' : 'Salvar cliente'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
      {clienteEdicao && <EditarClienteDialog key={clienteEdicao.id} cliente={clienteEdicao} onClose={() => setClienteEdicao(null)} onSaved={(atualizada) => { setClientes(atuais => atuais.map(item => item.id === atualizada.id ? atualizada : item)); setClienteEdicao(atualizada) }} />}
      <HistoricoClienteModal open={historicoAberto} onOpenChange={setHistoricoAberto} cliente={historicoCliente} />
    </PageContainer>
  )
}
