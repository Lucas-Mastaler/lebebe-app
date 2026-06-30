'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { Eye, RefreshCcw, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

type PreAgendamentoResumo = {
  id: string
  createdAt: string
  dataPreAgendada: string | null
  tipoResultado: string | null
  status: string
  erroMensagem: string | null
}

type AuditoriaItem = {
  id: string
  createdAt: string
  usuarioEmail: string
  cep: string | null
  numeroResidencia: string | null
  bairro: string | null
  cidade: string | null
  uf: string | null
  tempoNecessario: string | null
  valorInicialMinimo: number | null
  fretesResultados: string[]
  resultadosQuantidade: number
  status: string
  duracaoMs: number | null
  preAgendamento: PreAgendamentoResumo | null
  preAgendamentosQuantidade: number
}

type PesquisaDetalhe = {
  id: string
  created_at: string
  usuario_id: string | null
  usuario_email: string
  client_token: string | null
  run_id: string | null
  motor_versao: string
  origem: string
  cep: string | null
  numero_residencia: string | null
  logradouro: string | null
  bairro: string | null
  cidade: string | null
  uf: string | null
  endereco_completo: string | null
  latitude: number | string | null
  longitude: number | string | null
  parametros_json: Record<string, unknown>
  resultados_json: unknown
  status: string
  erro_mensagem: string | null
  duracao_ms: number | null
  started_at: string | null
  finished_at: string | null
}

type PreAgendamentoDetalhe = {
  id: string
  created_at: string
  pesquisa_auditoria_id: string | null
  usuario_id: string | null
  usuario_email: string
  client_token: string | null
  run_id: string | null
  data_pre_agendada: string | null
  tipo_resultado: string | null
  resultado_escolhido_json: unknown
  payload_pre_agendamento_json: unknown
  status: string
  erro_mensagem: string | null
}

type ListagemResponse = {
  ok: true
  items: AuditoriaItem[]
  total: number
  page: number
  limit: number
}

type DetalheResponse = {
  ok: true
  pesquisa: PesquisaDetalhe
  preAgendamentos: PreAgendamentoDetalhe[]
}

type Filtros = {
  dataInicial: string
  dataFinal: string
  email: string
  cep: string
  cidade: string
  uf: string
  status: string
  tevePreAgendamento: string
  dataPreAgendada: string
}

const LIMIT = 20

function dataIsoLocal(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function filtrosIniciais(): Filtros {
  const hoje = new Date()
  const inicio = new Date()
  inicio.setDate(hoje.getDate() - 7)

  return {
    dataInicial: dataIsoLocal(inicio),
    dataFinal: dataIsoLocal(hoje),
    email: '',
    cep: '',
    cidade: '',
    uf: '',
    status: '',
    tevePreAgendamento: 'todos',
    dataPreAgendada: '',
  }
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'America/Sao_Paulo',
  }).format(date)
}

function formatDate(value: string | null | undefined) {
  if (!value) return '-'
  const date = new Date(`${value}T12:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' }).format(date)
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function asResultados(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.filter((item): item is Record<string, unknown> => item !== null && typeof item === 'object' && !Array.isArray(item))
    : []
}

function texto(value: unknown) {
  if (value === null || value === undefined || value === '') return '-'
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function Campo({ label, value }: { label: string; value: unknown }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase text-slate-500">{label}</dt>
      <dd className="mt-1 break-words text-sm text-slate-900">{texto(value)}</dd>
    </div>
  )
}

function Secao({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-700">{title}</h3>
      {children}
    </section>
  )
}

function JsonResumo({ value }: { value: unknown }) {
  const record = asRecord(value)
  const entries = Object.entries(record).slice(0, 12)

  if (entries.length === 0) {
    return <p className="text-sm text-slate-500">Sem dados resumidos.</p>
  }

  return (
    <dl className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {entries.map(([key, val]) => (
        <Campo key={key} label={key} value={val} />
      ))}
    </dl>
  )
}

export default function PageClient() {
  const [filtros, setFiltros] = useState<Filtros>(() => filtrosIniciais())
  const [items, setItems] = useState<AuditoriaItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [detalhe, setDetalhe] = useState<DetalheResponse | null>(null)
  const [detalheLoading, setDetalheLoading] = useState(false)
  const [detalheOpen, setDetalheOpen] = useState(false)

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / LIMIT)), [total])

  const carregar = useCallback(async (pagina: number, filtrosAtuais: Filtros) => {
    setLoading(true)
    setError(null)

    const params = new URLSearchParams()
    params.set('page', String(pagina))
    params.set('limit', String(LIMIT))
    Object.entries(filtrosAtuais).forEach(([key, value]) => {
      if (value && value !== 'todos') params.set(key, value)
    })

    try {
      const res = await fetch(`/api/procurar-datas/auditoria?${params.toString()}`)
      if (!res.ok) throw new Error(`Erro ${res.status}`)
      const data = await res.json() as ListagemResponse
      setItems(data.items)
      setTotal(data.total)
      setPage(data.page)
    } catch (err) {
      setItems([])
      setTotal(0)
      setError(err instanceof Error ? err.message : 'Erro ao consultar auditoria')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    carregar(1, filtros)
  }, [carregar])

  async function abrirDetalhe(id: string) {
    setDetalheOpen(true)
    setDetalhe(null)
    setDetalheLoading(true)

    try {
      const res = await fetch(`/api/procurar-datas/auditoria?id=${encodeURIComponent(id)}`)
      if (!res.ok) throw new Error(`Erro ${res.status}`)
      const data = await res.json() as DetalheResponse
      setDetalhe(data)
    } catch {
      setDetalhe(null)
    } finally {
      setDetalheLoading(false)
    }
  }

  function atualizarFiltro<K extends keyof Filtros>(key: K, value: Filtros[K]) {
    setFiltros((current) => ({ ...current, [key]: value }))
  }

  function pesquisar() {
    carregar(1, filtros)
  }

  function limpar() {
    const novos = filtrosIniciais()
    setFiltros(novos)
    carregar(1, novos)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">AUDITORIA PROCURAR DATAS</h1>
        <p className="mt-1 text-sm text-slate-600">Consulta operacional read-only de pesquisas e pré-agendamentos.</p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 card-shadow">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4 xl:grid-cols-8">
          <label className="space-y-1">
            <span className="text-xs font-medium text-slate-600">Data inicial</span>
            <Input type="date" value={filtros.dataInicial} onChange={(e) => atualizarFiltro('dataInicial', e.target.value)} />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-medium text-slate-600">Data final</span>
            <Input type="date" value={filtros.dataFinal} onChange={(e) => atualizarFiltro('dataFinal', e.target.value)} />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-medium text-slate-600">Usuário/email</span>
            <Input value={filtros.email} onChange={(e) => atualizarFiltro('email', e.target.value)} placeholder="email" />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-medium text-slate-600">CEP</span>
            <Input value={filtros.cep} onChange={(e) => atualizarFiltro('cep', e.target.value)} placeholder="00000000" />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-medium text-slate-600">Cidade</span>
            <Input value={filtros.cidade} onChange={(e) => atualizarFiltro('cidade', e.target.value)} placeholder="Cidade" />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-medium text-slate-600">UF</span>
            <Input value={filtros.uf} onChange={(e) => atualizarFiltro('uf', e.target.value.toUpperCase().slice(0, 2))} placeholder="PR" />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-medium text-slate-600">Status</span>
            <select className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm" value={filtros.status} onChange={(e) => atualizarFiltro('status', e.target.value)}>
              <option value="">Todos</option>
              <option value="success">success</option>
              <option value="error">error</option>
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-xs font-medium text-slate-600">Pré-agendamento</span>
            <select className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm" value={filtros.tevePreAgendamento} onChange={(e) => atualizarFiltro('tevePreAgendamento', e.target.value)}>
              <option value="todos">Todos</option>
              <option value="sim">Sim</option>
              <option value="nao">Não</option>
            </select>
          </label>
          <label className="space-y-1 md:col-span-2">
            <span className="text-xs font-medium text-slate-600">Data pré-agendada</span>
            <Input type="date" value={filtros.dataPreAgendada} onChange={(e) => atualizarFiltro('dataPreAgendada', e.target.value)} />
          </label>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={pesquisar} disabled={loading}>
            <Search className="h-4 w-4" />
            Pesquisar
          </Button>
          <Button variant="outline" onClick={limpar} disabled={loading}>
            <RefreshCcw className="h-4 w-4" />
            Limpar
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white card-shadow">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-4">
          <h2 className="font-semibold text-slate-900">Resultados</h2>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-600">{total} registros</span>
        </div>

        {error ? (
          <div className="p-6 text-sm text-red-600">{error}</div>
        ) : loading ? (
          <div className="p-6 text-sm text-slate-500">Carregando...</div>
        ) : items.length === 0 ? (
          <div className="p-6 text-sm text-slate-500">Nenhum registro encontrado.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[1180px] w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="px-3 py-2 text-left">Data/hora</th>
                  <th className="px-3 py-2 text-left">Usuário</th>
                  <th className="px-3 py-2 text-left">CEP</th>
                  <th className="px-3 py-2 text-left">Número</th>
                  <th className="px-3 py-2 text-left">Bairro</th>
                  <th className="px-3 py-2 text-left">Cidade/UF</th>
                  <th className="px-3 py-2 text-left">Tempo</th>
                  <th className="px-3 py-2 text-left">Valores</th>
                  <th className="px-3 py-2 text-center">Resultados</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-left">Pré-agendamento</th>
                  <th className="px-3 py-2 text-right">Detalhe</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, index) => (
                  <tr key={item.id} className={`border-b last:border-0 ${index % 2 === 0 ? 'bg-white' : 'bg-sky-50/40'}`}>
                    <td className="px-3 py-2 whitespace-nowrap">{formatDateTime(item.createdAt)}</td>
                    <td className="px-3 py-2">{item.usuarioEmail}</td>
                    <td className="px-3 py-2">{item.cep ?? '-'}</td>
                    <td className="px-3 py-2">{item.numeroResidencia ?? '-'}</td>
                    <td className="px-3 py-2">{item.bairro ?? '-'}</td>
                    <td className="px-3 py-2">{item.cidade ?? '-'} / {item.uf ?? '-'}</td>
                    <td className="px-3 py-2">{item.tempoNecessario ?? '-'}</td>
                    <td className="px-3 py-2">{item.fretesResultados.length > 0 ? item.fretesResultados.join(', ') : texto(item.valorInicialMinimo)}</td>
                    <td className="px-3 py-2 text-center">{item.resultadosQuantidade}</td>
                    <td className="px-3 py-2">{item.status}</td>
                    <td className="px-3 py-2">
                      {item.preAgendamento
                        ? `${formatDate(item.preAgendamento.dataPreAgendada)} · ${item.preAgendamento.tipoResultado ?? '-'}`
                        : 'Não'}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Button variant="outline" size="sm" onClick={() => abrirDetalhe(item.id)}>
                        <Eye className="h-4 w-4" />
                        Ver
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex items-center justify-between border-t border-slate-200 p-4 text-sm text-slate-600">
          <span>Página {page} de {totalPages}</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={loading || page <= 1} onClick={() => carregar(page - 1, filtros)}>Anterior</Button>
            <Button variant="outline" size="sm" disabled={loading || page >= totalPages} onClick={() => carregar(page + 1, filtros)}>Próxima</Button>
          </div>
        </div>
      </div>

      <Dialog open={detalheOpen} onOpenChange={setDetalheOpen}>
        <DialogContent className="!w-[94vw] !max-w-none max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalhe da pesquisa</DialogTitle>
            <DialogDescription>Dados operacionais salvos na auditoria da busca.</DialogDescription>
          </DialogHeader>

          {detalheLoading ? (
            <p className="text-sm text-slate-500">Carregando detalhe...</p>
          ) : detalhe?.pesquisa ? (
            <DetalhePesquisa detalhe={detalhe} />
          ) : (
            <p className="text-sm text-red-600">Não foi possível carregar o detalhe.</p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function DetalhePesquisa({ detalhe }: { detalhe: DetalheResponse }) {
  const pesquisa = detalhe.pesquisa
  const parametros = asRecord(pesquisa.parametros_json)
  const resultados = asResultados(pesquisa.resultados_json)

  return (
    <div className="space-y-6">
      <Secao title="Dados gerais">
        <dl className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <Campo label="ID da pesquisa" value={pesquisa.id} />
          <Campo label="Timestamp" value={formatDateTime(pesquisa.created_at)} />
          <Campo label="Usuário" value={pesquisa.usuario_email} />
          <Campo label="Client token" value={pesquisa.client_token} />
          <Campo label="Run ID" value={pesquisa.run_id} />
          <Campo label="Status" value={pesquisa.status} />
          <Campo label="Duração" value={pesquisa.duracao_ms ? `${pesquisa.duracao_ms} ms` : null} />
          <Campo label="Motor" value={pesquisa.motor_versao} />
          <Campo label="Origem" value={pesquisa.origem} />
        </dl>
      </Secao>

      <Secao title="Endereço">
        <dl className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <Campo label="CEP" value={pesquisa.cep} />
          <Campo label="Número" value={pesquisa.numero_residencia} />
          <Campo label="Logradouro" value={pesquisa.logradouro} />
          <Campo label="Bairro" value={pesquisa.bairro} />
          <Campo label="Cidade" value={pesquisa.cidade} />
          <Campo label="UF" value={pesquisa.uf} />
          <Campo label="Endereço completo" value={pesquisa.endereco_completo} />
          <Campo label="Latitude" value={pesquisa.latitude} />
          <Campo label="Longitude" value={pesquisa.longitude} />
        </dl>
      </Secao>

      <Secao title="Parâmetros usados">
        <dl className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <Campo label="Data inicial" value={parametros.dataInicial} />
          <Campo label="Encomenda" value={parametros.encomenda} />
          <Campo label="Área rural" value={parametros.areaRural} />
          <Campo label="Condomínio" value={parametros.condominio} />
          <Campo label="Berço/cama" value={parametros.bercoCama} />
          <Campo label="Cômoda" value={parametros.comoda} />
          <Campo label="Roupeiro" value={parametros.roupeiro} />
          <Campo label="Poltrona" value={parametros.poltrona} />
          <Campo label="Painel" value={parametros.painel} />
          <Campo label="Tempo necessário" value={parametros.tempoNecessario} />
          <Campo label="Valor inicial mínimo" value={parametros.valorInicialMinimo} />
        </dl>
      </Secao>

      <Secao title="Resultados exibidos">
        {resultados.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhum resultado salvo.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="min-w-[820px] w-full text-sm">
              <thead>
                <tr className="bg-slate-50">
                  <th className="px-3 py-2 text-left">Data</th>
                  <th className="px-3 py-2 text-left">Dia</th>
                  <th className="px-3 py-2 text-left">Equipe</th>
                  <th className="px-3 py-2 text-left">Tipo</th>
                  <th className="px-3 py-2 text-left">Frete/valor</th>
                  <th className="px-3 py-2 text-left">Faltam</th>
                  <th className="px-3 py-2 text-left">Encomenda</th>
                  <th className="px-3 py-2 text-left">Rank</th>
                </tr>
              </thead>
              <tbody>
                {resultados.map((resultado, index) => (
                  <tr key={`${texto(resultado.date)}-${index}`} className="border-t border-slate-200">
                    <td className="px-3 py-2">{texto(resultado.date ?? resultado.dateDM ?? resultado.dateISO)}</td>
                    <td className="px-3 py-2">{texto(resultado.weekday)}</td>
                    <td className="px-3 py-2">{texto(resultado.team)}</td>
                    <td className="px-3 py-2">{texto(resultado.tipo)}</td>
                    <td className="px-3 py-2">{texto(resultado.frete ?? resultado.valor)}</td>
                    <td className="px-3 py-2">{texto(resultado.daysLeftTxt)}</td>
                    <td className="px-3 py-2">{texto(resultado.encomenda)}</td>
                    <td className="px-3 py-2">{texto(resultado.rank)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Secao>

      <Secao title="Pré-agendamento vinculado">
        {detalhe.preAgendamentos.length === 0 ? (
          <p className="text-sm text-slate-500">Sem pré-agendamento vinculado.</p>
        ) : (
          <div className="space-y-4">
            {detalhe.preAgendamentos.map((pre) => (
              <div key={pre.id} className="rounded-lg border border-slate-200 p-4">
                <dl className="grid grid-cols-1 gap-3 md:grid-cols-4">
                  <Campo label="Data escolhida" value={formatDate(pre.data_pre_agendada)} />
                  <Campo label="Tipo" value={pre.tipo_resultado} />
                  <Campo label="Status" value={pre.status} />
                  <Campo label="Criado em" value={formatDateTime(pre.created_at)} />
                </dl>
                <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <div>
                    <h4 className="mb-2 text-sm font-semibold text-slate-700">Resultado escolhido</h4>
                    <JsonResumo value={pre.resultado_escolhido_json} />
                  </div>
                  <div>
                    <h4 className="mb-2 text-sm font-semibold text-slate-700">Payload resumido</h4>
                    <JsonResumo value={pre.payload_pre_agendamento_json} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Secao>
    </div>
  )
}
