'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, History, Search, UserPlus, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { HistoricoClienteModal, type HistoricoClienteModalCliente } from '@/components/atendimento-presencial/HistoricoClienteModal'
import { PARENTESCOS_CLIENTE, type ClientePresencialDTO, type ParentescoCliente } from '@/lib/atendimento-presencial/clientes'
import { aplicarMascaraTelefoneBR } from '@/lib/atendimento-presencial/telefone'

type ApiClientesResponse = {
  ok: boolean
  message?: string
  clientes?: Array<ClientePresencialDTO & { correspondenciaExataTelefone?: boolean }>
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

const parentescoInicial: ParentescoCliente = 'mae'

export default function PageClient() {
  const [busca, setBusca] = useState('')
  const [buscaAplicada, setBuscaAplicada] = useState('')
  const [consultoraOrigem, setConsultoraOrigem] = useState('')
  const [consultoras, setConsultoras] = useState<Array<{ nome: string }>>([])
  const [clientes, setClientes] = useState<Array<ClientePresencialDTO & { correspondenciaExataTelefone?: boolean }>>([])
  const [pagina, setPagina] = useState(1)
  const [totalClientes, setTotalClientes] = useState(0)
  const [totalPaginas, setTotalPaginas] = useState(1)
  const [buscando, setBuscando] = useState(false)
  const [erroBusca, setErroBusca] = useState<string | null>(null)

  const [nome, setNome] = useState('')
  const [telefone, setTelefone] = useState('')
  const [parentesco, setParentesco] = useState<ParentescoCliente>(parentescoInicial)
  const [parentescoOutro, setParentescoOutro] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erroCadastro, setErroCadastro] = useState<string | null>(null)
  const [feedbackCadastro, setFeedbackCadastro] = useState<string | null>(null)
  const [historicoAberto, setHistoricoAberto] = useState(false)
  const [historicoCliente, setHistoricoCliente] = useState<HistoricoClienteModalCliente | null>(null)

  const podeEnviar = useMemo(() => {
    if (salvando) return false
    if (nome.trim().length < 2) return false
    if (parentesco === 'outro' && parentescoOutro.trim().length < 2) return false
    return true
  }, [nome, parentesco, parentescoOutro, salvando])

  async function buscarClientes(event?: FormEvent, options?: { page?: number; busca?: string; consultora?: string }) {
    event?.preventDefault()
    const page = options?.page ?? 1
    const termo = options?.busca ?? busca
    const consultora = options?.consultora ?? consultoraOrigem

    setBuscando(true)
    setErroBusca(null)
    setFeedbackCadastro(null)

    try {
      const params = new URLSearchParams()
      if (termo.trim()) params.set('q', termo.trim())
      if (consultora.trim()) params.set('consultoraOrigem', consultora.trim())
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
      setBuscaAplicada(termo)
    } catch (error) {
      setErroBusca(error instanceof Error ? error.message : 'Erro ao buscar clientes')
      setClientes([])
    } finally {
      setBuscando(false)
    }
  }

  useEffect(() => {
    void buscarClientes(undefined, { page: 1, busca: '', consultora: '' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
          parentesco,
          parentescoOutro: parentesco === 'outro' ? parentescoOutro : undefined,
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
        setParentesco(parentescoInicial)
        setParentescoOutro('')
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

  function alterarConsultoraOrigem(valor: string) {
    setConsultoraOrigem(valor)
    void buscarClientes(undefined, { page: 1, busca: buscaAplicada, consultora: valor })
  }

  function mudarPagina(proximaPagina: number) {
    if (proximaPagina < 1 || proximaPagina > totalPaginas || buscando) return
    void buscarClientes(undefined, { page: proximaPagina, busca: buscaAplicada, consultora: consultoraOrigem })
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <header>
          <p className="text-sm font-medium uppercase text-slate-500">ATENDIMENTO PRESENCIAL</p>
          <h1 className="mt-2 text-2xl font-semibold text-slate-950 sm:text-3xl">Clientes</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-600">
            Busca e cadastro inicial de clientes presenciais.
          </p>
        </header>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_420px]">
          <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-50 text-sky-600">
                <Search className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-slate-950">Buscar cliente</h2>
                <p className="text-sm text-slate-500">Use nome ou telefone.</p>
              </div>
            </div>

            <form className="grid gap-3" onSubmit={(event) => void buscarClientes(event, { page: 1, busca })}>
              <div className="flex flex-col gap-3 sm:flex-row">
              <Input
                value={busca}
                onChange={(event) => setBusca(event.target.value)}
                placeholder="Nome ou telefone"
                inputMode="search"
                className="h-11"
              />
              <Button type="submit" className="h-11 rounded-md sm:w-36" disabled={buscando}>
                {buscando ? 'Buscando...' : 'Buscar'}
              </Button>
              </div>
              <label className="text-sm font-medium text-slate-700">
                Consultora de origem
                <select
                  value={consultoraOrigem}
                  onChange={(event) => alterarConsultoraOrigem(event.target.value)}
                  className="mt-1 h-11 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:border-sky-500"
                >
                  <option value="">Todas</option>
                  {consultoras.map((consultora) => (
                    <option key={consultora.nome} value={consultora.nome}>{consultora.nome}</option>
                  ))}
                </select>
              </label>
            </form>

            {erroBusca && (
              <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {erroBusca}
              </p>
            )}

            <div className="mt-5 space-y-3">
              {clientes.length === 0 && !erroBusca && !buscando && (
                <div className="rounded-lg border border-dashed border-slate-200 p-6 text-sm text-slate-500">
                  Nenhuma cliente encontrada.
                </div>
              )}

              {clientes.map((cliente) => (
                <article key={cliente.id} className="rounded-lg border border-slate-200 p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h3 className="text-base font-semibold text-slate-950">{cliente.nome}</h3>
                      <p className="text-sm text-slate-600">{cliente.parentescoLabel}</p>
                    </div>
                    {cliente.correspondenciaExataTelefone && (
                      <span className="rounded-md bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">
                        telefone encontrado
                      </span>
                    )}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-sm text-slate-500">
                    <span>{cliente.telefoneFormatado ?? 'Sem telefone'}</span>
                    <span>Atualizada em {new Date(cliente.atualizadoEm).toLocaleDateString('pt-BR')}</span>
                  </div>
                  <div className="mt-3 grid gap-1 text-sm text-slate-600 sm:grid-cols-2">
                    <p>Consultora origem: <span className="font-medium text-slate-800">{cliente.origem.consultoraNome ?? 'Nao identificado'}</span></p>
                    <p>Filial origem: <span className="font-medium text-slate-800">{cliente.origem.unidadeNome ?? 'Nao identificado'}</span></p>
                  </div>
                  <Button type="button" variant="outline" onClick={() => abrirHistoricoCliente(cliente)} className="mt-3 h-10 rounded-md">
                    <History className="mr-2 h-4 w-4" aria-hidden="true" />
                    Ver historico
                  </Button>
                </article>
              ))}
            </div>

            <div className="mt-5 flex flex-col gap-3 border-t border-slate-100 pt-4 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
              <p>{totalClientes} cliente{totalClientes === 1 ? '' : 's'} - pagina {pagina} de {totalPaginas}</p>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => mudarPagina(pagina - 1)} disabled={buscando || pagina <= 1} className="h-10 rounded-md">
                  <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                  Voltar
                </Button>
                <Button type="button" variant="outline" onClick={() => mudarPagina(pagina + 1)} disabled={buscando || pagina >= totalPaginas} className="h-10 rounded-md">
                  Avancar
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-50 text-sky-600">
                <UserPlus className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-slate-950">Cadastrar cliente</h2>
                <p className="text-sm text-slate-500">Telefone e opcional.</p>
              </div>
            </div>

            <form className="space-y-4" onSubmit={cadastrarCliente}>
              <label className="block text-sm font-medium text-slate-700">
                Nome
                <Input
                  value={nome}
                  onChange={(event) => setNome(event.target.value)}
                  className="mt-1 h-11"
                  placeholder="Nome da cliente"
                  autoComplete="off"
                />
              </label>

              <label className="block text-sm font-medium text-slate-700">
                Telefone
                <Input
                  value={telefone}
                  onChange={(event) => setTelefone(aplicarMascaraTelefoneBR(event.target.value))}
                  className="mt-1 h-11"
                  placeholder="(41) 99999-9999"
                  inputMode="tel"
                  autoComplete="off"
                />
              </label>

              <div>
                <p className="text-sm font-medium text-slate-700">Parentesco</p>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {PARENTESCOS_CLIENTE.map((item) => (
                    <button
                      key={item.chave}
                      type="button"
                      onClick={() => setParentesco(item.chave)}
                      className={[
                        'min-h-11 rounded-md border px-3 py-2 text-sm font-medium transition-colors',
                        parentesco === item.chave
                          ? 'border-sky-500 bg-sky-50 text-sky-700'
                          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
                      ].join(' ')}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              {parentesco === 'outro' && (
                <label className="block text-sm font-medium text-slate-700">
                  Complemento
                  <Input
                    value={parentescoOutro}
                    onChange={(event) => setParentescoOutro(event.target.value)}
                    className="mt-1 h-11"
                    placeholder="Informe o parentesco"
                    autoComplete="off"
                  />
                </label>
              )}

              {erroCadastro && (
                <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {erroCadastro}
                </p>
              )}

              {feedbackCadastro && (
                <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                  {feedbackCadastro}
                </p>
              )}

              <Button type="submit" className="h-11 w-full rounded-md" disabled={!podeEnviar}>
                <Users className="h-4 w-4" aria-hidden="true" />
                {salvando ? 'Salvando...' : 'Salvar cliente'}
              </Button>
            </form>
          </section>
        </div>
      </div>
      <HistoricoClienteModal
        open={historicoAberto}
        onOpenChange={setHistoricoAberto}
        cliente={historicoCliente}
      />
    </main>
  )
}
