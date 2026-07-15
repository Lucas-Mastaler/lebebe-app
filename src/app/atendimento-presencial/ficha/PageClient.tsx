'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { ClipboardList, RefreshCw, Save, WifiOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  carregarCacheRascunho,
  salvarCacheRascunho,
  type RascunhoCache,
} from '@/lib/atendimento-presencial/rascunho-cache'
import type {
  AtendimentoPresencialDTO,
  ConsultoraAtendimento,
  ContextoAtendimento,
  DadosRascunho,
} from '@/lib/atendimento-presencial/rascunhos'

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
  idempotente?: boolean
}

type SyncStatus = 'ocioso' | 'salvando' | 'salvo' | 'sem_conexao' | 'conflito' | 'erro'

type Props = {
  usuarioId: string
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

function gerarDraftClientId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export default function PageClient({ usuarioId }: Props) {
  const [contexto, setContexto] = useState<ContextoAtendimento | null>(null)
  const [consultoras, setConsultoras] = useState<ConsultoraAtendimento[]>([])
  const [rascunhos, setRascunhos] = useState<AtendimentoPresencialDTO[]>([])
  const [unidadeId, setUnidadeId] = useState('')
  const [consultoraUsuarioId, setConsultoraUsuarioId] = useState('')
  const [ativo, setAtivo] = useState<AtendimentoPresencialDTO | null>(null)
  const [notaTecnica, setNotaTecnica] = useState('')
  const [statusSync, setStatusSync] = useState<SyncStatus>('ocioso')
  const [erro, setErro] = useState<string | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [iniciando, setIniciando] = useState(false)
  const saveSeq = useRef(0)
  const primeiraCargaAtivo = useRef(true)
  const ultimoTextoSalvo = useRef('')

  const precisaSelecionarUnidade = (contexto?.unidadesPermitidas.length ?? 0) > 1
  const podeIniciar = useMemo(() => {
    if (!contexto || iniciando) return false
    if (contexto.unidadesPermitidas.length === 0) return false
    if (precisaSelecionarUnidade && !unidadeId) return false
    if (contexto.perfil !== 'consultora' && !consultoraUsuarioId) return false
    return true
  }, [contexto, consultoraUsuarioId, iniciando, precisaSelecionarUnidade, unidadeId])

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

      if (data.contexto?.unidadesPermitidas.length === 1) {
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

  function aplicarRascunho(rascunho: AtendimentoPresencialDTO) {
    setAtivo(rascunho)
    setUnidadeId(rascunho.unidadeId)
    setConsultoraUsuarioId(rascunho.consultoraUsuarioId)
    const cache = carregarCacheRascunho(window.localStorage, usuarioId, rascunho.draftClientId)
    const dados = cache?.sincronizado === false ? cache.dadosRascunho : rascunho.dadosRascunho
    setNotaTecnica(dados.notaTecnica ?? '')
    ultimoTextoSalvo.current = dados.notaTecnica ?? ''
    setStatusSync(cache?.sincronizado === false ? 'sem_conexao' : 'salvo')
    primeiraCargaAtivo.current = true
  }

  async function iniciarRascunho() {
    if (!contexto || !podeIniciar) return
    setIniciando(true)
    setErro(null)
    const draftClientId = gerarDraftClientId()
    const unidadeFinal = unidadeId || contexto.unidadesPermitidas[0]?.id

    try {
      const response = await fetch('/api/atendimento-presencial/atendimentos/rascunhos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          draftClientId,
          unidadeId: unidadeFinal,
          consultoraUsuarioId: contexto.perfil === 'consultora' ? undefined : consultoraUsuarioId,
          dadosRascunho: {},
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

  useEffect(() => {
    if (!ativo) return
    const cache: RascunhoCache = {
      draftClientId: ativo.draftClientId,
      usuarioId,
      atendimentoId: ativo.id,
      version: ativo.version,
      dadosRascunho: { notaTecnica },
      atualizadoEm: new Date().toISOString(),
      sincronizado: false,
    }
    salvarCacheRascunho(window.localStorage, cache)

    if (primeiraCargaAtivo.current) {
      primeiraCargaAtivo.current = false
      return
    }

    if (notaTecnica === ultimoTextoSalvo.current) return

    const seq = ++saveSeq.current
    setStatusSync(navigator.onLine ? 'salvando' : 'sem_conexao')

    const timeout = window.setTimeout(async () => {
      if (!navigator.onLine) {
        setStatusSync('sem_conexao')
        return
      }

      try {
        const dadosRascunho: DadosRascunho = { notaTecnica }
        const response = await fetch(`/api/atendimento-presencial/atendimentos/${ativo.id}/rascunho`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ version: ativo.version, dadosRascunho }),
        })
        const data = (await response.json()) as ApiRascunhoResponse
        if (seq !== saveSeq.current) return

        if (response.status === 409) {
          setStatusSync('conflito')
          return
        }

        if (!response.ok || !data.ok || !data.rascunho) throw new Error(data.message ?? 'Erro ao salvar')

        ultimoTextoSalvo.current = notaTecnica
        setAtivo(data.rascunho)
        setRascunhos((atuais) => atuais.map((item) => item.id === data.rascunho?.id ? data.rascunho : item))
        setStatusSync('salvo')
        salvarCacheRascunho(window.localStorage, {
          draftClientId: data.rascunho.draftClientId,
          usuarioId,
          atendimentoId: data.rascunho.id,
          version: data.rascunho.version,
          dadosRascunho,
          atualizadoEm: new Date().toISOString(),
          sincronizado: true,
        })
      } catch {
        if (seq === saveSeq.current) setStatusSync(navigator.onLine ? 'erro' : 'sem_conexao')
      }
    }, 900)

    return () => window.clearTimeout(timeout)
  }, [ativo, notaTecnica, usuarioId])

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <header>
          <p className="text-sm font-medium uppercase text-slate-500">ATENDIMENTO PRESENCIAL</p>
          <h1 className="mt-2 text-2xl font-semibold text-slate-950 sm:text-3xl">Ficha de Atendimento</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-600">
            Base tecnica para iniciar e recuperar rascunhos.
          </p>
        </header>

        {erro && (
          <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>
        )}

        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-50 text-sky-600">
              <ClipboardList className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-950">Nova ficha</h2>
              <p className="text-sm text-slate-500">
                {contexto?.perfil === 'consultora' ? 'Consultora definida automaticamente.' : 'Selecione a consultora responsavel.'}
              </p>
            </div>
          </div>

          {contexto?.unidadesPermitidas.length === 0 && (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Usuario sem unidade vinculada. Ajuste a configuracao na tela de usuarios.
            </p>
          )}

          {contexto && contexto.unidadesPermitidas.length > 0 && (
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="text-sm font-medium text-slate-700">Unidade</p>
                <div className="mt-2 grid gap-2">
                  {contexto.unidadesPermitidas.map((unidade) => (
                    <button
                      key={unidade.id}
                      type="button"
                      onClick={() => setUnidadeId(unidade.id)}
                      className={[
                        'min-h-12 rounded-md border px-3 py-2 text-left text-sm font-medium',
                        unidadeId === unidade.id
                          ? 'border-sky-500 bg-sky-50 text-sky-700'
                          : 'border-slate-200 bg-white text-slate-700',
                      ].join(' ')}
                    >
                      {unidade.nome}
                    </button>
                  ))}
                </div>
              </div>

              {contexto.perfil !== 'consultora' && (
                <div>
                  <p className="text-sm font-medium text-slate-700">Consultora</p>
                  <div className="mt-2 grid gap-2">
                    {consultoras.length === 0 && (
                      <p className="rounded-md border border-dashed border-slate-200 p-3 text-sm text-slate-500">
                        Nenhuma consultora vinculada as unidades permitidas.
                      </p>
                    )}
                    {consultoras.map((consultora) => (
                      <button
                        key={consultora.id}
                        type="button"
                        onClick={() => setConsultoraUsuarioId(consultora.id)}
                        className={[
                          'min-h-12 rounded-md border px-3 py-2 text-left text-sm font-medium',
                          consultoraUsuarioId === consultora.id
                            ? 'border-sky-500 bg-sky-50 text-sky-700'
                            : 'border-slate-200 bg-white text-slate-700',
                        ].join(' ')}
                      >
                        {consultora.nome}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <Button type="button" onClick={iniciarRascunho} disabled={!podeIniciar} className="mt-5 h-11 rounded-md">
            {iniciando ? 'Iniciando...' : 'Iniciar nova ficha'}
          </Button>
        </section>

        <section className="grid gap-5 lg:grid-cols-[360px_minmax(0,1fr)]">
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold text-slate-950">Rascunhos ativos</h2>
              <Button type="button" variant="outline" onClick={carregarRascunhos} disabled={carregando} className="h-9 rounded-md">
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>

            <div className="space-y-3">
              {carregando && <p className="text-sm text-slate-500">Carregando...</p>}
              {!carregando && rascunhos.length === 0 && (
                <p className="rounded-md border border-dashed border-slate-200 p-4 text-sm text-slate-500">
                  Nenhum rascunho ativo.
                </p>
              )}

              {rascunhos.map((rascunho) => (
                <article key={rascunho.id} className="rounded-lg border border-amber-300 bg-amber-50 p-4">
                  <p className="text-sm font-bold uppercase text-amber-800">RASCUNHO</p>
                  <p className="mt-2 text-sm text-slate-700">Iniciado em: {formatarData(rascunho.iniciadoEm)}</p>
                  <p className="text-sm text-slate-700">Ultima atualizacao: {formatarData(rascunho.ultimaAtividadeEm)}</p>
                  <p className="text-sm text-slate-700">Expira em: {diasRestantes(rascunho.expiraEm)} dias</p>
                  <Button type="button" onClick={() => aplicarRascunho(rascunho)} className="mt-3 h-10 rounded-md">
                    Continuar preenchendo
                  </Button>
                </article>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold text-slate-950">Area tecnica de rascunho</h2>
              <span className="inline-flex items-center gap-2 rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600">
                {statusSync === 'sem_conexao' ? <WifiOff className="h-3.5 w-3.5" aria-hidden="true" /> : <Save className="h-3.5 w-3.5" aria-hidden="true" />}
                {statusSync === 'salvando' && 'Salvando'}
                {statusSync === 'salvo' && 'Salvo'}
                {statusSync === 'sem_conexao' && 'Sem conexao'}
                {statusSync === 'conflito' && 'Conflito'}
                {statusSync === 'erro' && 'Erro'}
                {statusSync === 'ocioso' && 'Ocioso'}
              </span>
            </div>

            {!ativo && (
              <p className="rounded-md border border-dashed border-slate-200 p-6 text-sm text-slate-500">
                Inicie ou continue um rascunho para testar autosave e recuperacao.
              </p>
            )}

            {ativo && (
              <label className="block text-sm font-medium text-slate-700">
                Conteudo tecnico de teste
                <textarea
                  value={notaTecnica}
                  onChange={(event) => setNotaTecnica(event.target.value)}
                  maxLength={1000}
                  className="mt-2 min-h-40 w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-sky-500"
                  placeholder="Texto temporario para validar rascunho e autosave."
                />
              </label>
            )}
          </div>
        </section>
      </div>
    </main>
  )
}
