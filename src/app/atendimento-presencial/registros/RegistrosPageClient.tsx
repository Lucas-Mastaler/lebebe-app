'use client'

import { useEffect, useState } from 'react'
import { ClipboardList, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getMotivoLabel, getResultadoLabel } from '@/lib/atendimento-presencial/ficha-schema'
import {
  normalizarObservacoesRegistro,
  type RegistroAtendimentoDetalheDTO,
  type RegistroAtendimentoResumoDTO,
} from '@/lib/atendimento-presencial/registros'

type RegistroResumo = RegistroAtendimentoResumoDTO
type RegistroDetalhe = RegistroAtendimentoDetalheDTO

type ApiListaResponse = {
  ok: boolean
  message?: string
  registros?: RegistroResumo[]
}

type ApiDetalheResponse = {
  ok: boolean
  message?: string
} & Partial<RegistroDetalhe>

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

export default function RegistrosPageClient() {
  const [registros, setRegistros] = useState<RegistroResumo[]>([])
  const [selecionado, setSelecionado] = useState<RegistroDetalhe | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [carregandoDetalhe, setCarregandoDetalhe] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function carregarRegistros() {
    setCarregando(true)
    setErro(null)
    try {
      const response = await fetch('/api/atendimento-presencial/atendimentos', { cache: 'no-store' })
      const data = (await response.json()) as ApiListaResponse
      if (!response.ok || !data.ok) throw new Error(data.message ?? 'Erro ao carregar registros')
      setRegistros(data.registros ?? [])
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Erro ao carregar registros')
    } finally {
      setCarregando(false)
    }
  }

  async function carregarDetalhe(id: string) {
    setCarregandoDetalhe(true)
    setErro(null)
    try {
      const response = await fetch(`/api/atendimento-presencial/atendimentos/${id}`, { cache: 'no-store' })
      const data = (await response.json()) as ApiDetalheResponse
      if (!response.ok || !data.ok || !data.atendimento) throw new Error(data.message ?? 'Erro ao carregar atendimento')
      setSelecionado({
        atendimento: data.atendimento,
        cliente: data.cliente ?? null,
        criancas: data.criancas ?? [],
        departamentos: data.departamentos ?? [],
        produtosInteresse: data.produtosInteresse ?? [],
        motivos: data.motivos ?? [],
        historico: data.historico ?? [],
      })
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Erro ao carregar atendimento')
    } finally {
      setCarregandoDetalhe(false)
    }
  }

  useEffect(() => {
    void carregarRegistros()
  }, [])

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium uppercase text-slate-500">ATENDIMENTO PRESENCIAL</p>
            <h1 className="mt-2 text-2xl font-semibold text-slate-950 sm:text-3xl">Registros de Atendimentos</h1>
          </div>
          <Button type="button" variant="outline" onClick={carregarRegistros} disabled={carregando} className="h-11 rounded-md">
            <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
            Atualizar
          </Button>
        </header>

        {erro && <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(340px,420px)]">
          <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-sky-50 text-sky-600">
                <ClipboardList className="h-5 w-5" aria-hidden="true" />
              </div>
              <h2 className="text-lg font-semibold text-slate-950">Concluidos</h2>
            </div>

            <div className="grid gap-3">
              {carregando && <p className="text-sm text-slate-500">Carregando...</p>}
              {!carregando && registros.length === 0 && (
                <p className="rounded-md border border-dashed border-slate-200 p-4 text-sm text-slate-500">Nenhum atendimento concluido encontrado.</p>
              )}
              {registros.map((registro) => (
                <button
                  key={registro.id}
                  type="button"
                  onClick={() => void carregarDetalhe(registro.id)}
                  className="rounded-md border border-slate-200 bg-white p-4 text-left outline-none transition hover:border-sky-300 focus-visible:ring-2 focus-visible:ring-sky-500"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="font-semibold text-slate-950">{registro.clienteNome}</p>
                      <p className="text-sm text-slate-600">{registro.unidadeNome} - {registro.consultoraEmail}</p>
                    </div>
                    <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
                      {getResultadoLabel(registro.resultadoAtendimento ?? undefined)}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-slate-600">Concluido em {formatarData(registro.concluidoEm)}</p>
                  {registro.numeroLancamento && <p className="text-sm text-slate-600">Lancamento {registro.numeroLancamento}</p>}
                </button>
              ))}
            </div>
          </section>

          <aside className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-950">Detalhe</h2>
            {carregandoDetalhe && <p className="mt-4 text-sm text-slate-500">Carregando atendimento...</p>}
            {!carregandoDetalhe && !selecionado && (
              <p className="mt-4 rounded-md border border-dashed border-slate-200 p-4 text-sm text-slate-500">Selecione um atendimento para consultar os dados salvos.</p>
            )}
            {!carregandoDetalhe && selecionado && (
              <div className="mt-4 grid gap-4 text-sm text-slate-700">
                <div>
                  <p className="text-xs font-bold uppercase text-slate-500">Resultado</p>
                  <p className="font-semibold text-slate-950">{getResultadoLabel(selecionado.atendimento.resultadoAtendimento ?? undefined)}</p>
                  {selecionado.atendimento.numeroLancamento && <p>Lancamento {selecionado.atendimento.numeroLancamento}</p>}
                </div>
                <div>
                  <p className="text-xs font-bold uppercase text-slate-500">Cliente</p>
                  {selecionado.cliente ? (
                    <>
                      <p className="font-semibold text-slate-950">{selecionado.cliente.nome}</p>
                      {selecionado.cliente.telefone && <p>{selecionado.cliente.telefone}</p>}
                    </>
                  ) : (
                    <p>Cliente nao localizada</p>
                  )}
                </div>
                <div>
                  <p className="text-xs font-bold uppercase text-slate-500">Departamentos</p>
                  <p>{selecionado.departamentos.map((item) => item.departamento).join(', ') || 'Nao informado'}</p>
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
                          <p className="font-semibold text-slate-950">{crianca.nome || crianca.situacao}</p>
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
              </div>
            )}
          </aside>
        </div>
      </div>
    </main>
  )
}
