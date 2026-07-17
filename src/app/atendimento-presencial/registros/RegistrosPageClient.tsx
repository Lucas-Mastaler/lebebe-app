'use client'

import { useEffect, useState } from 'react'
import { ClipboardList, Plus, RefreshCw, Save, Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DEPARTAMENTOS_INTERESSE,
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
  getResultadoLabel,
  limparNomeCriancaDigitacao,
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

function normalizarProduto(valor: string) {
  return valor.trim().replace(/\s+/g, ' ').slice(0, FICHA_PRODUTO_MAX_CHARS)
}

function gerarIdLocal(prefixo = 'local') {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `${prefixo}-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export default function RegistrosPageClient() {
  const [registros, setRegistros] = useState<RegistroResumo[]>([])
  const [selecionado, setSelecionado] = useState<RegistroDetalhe | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [carregandoDetalhe, setCarregandoDetalhe] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [viradaCartaoDe, setViradaCartaoDe] = useState('')
  const [viradaCartaoAte, setViradaCartaoAte] = useState('')
  const [edicaoAberta, setEdicaoAberta] = useState(false)
  const [fichaEdicao, setFichaEdicao] = useState<FichaDadosRascunho | null>(null)
  const [numeroLancamentoEdicao, setNumeroLancamentoEdicao] = useState('')
  const [viradaCartaoEdicaoInput, setViradaCartaoEdicaoInput] = useState('')
  const [produtoEdicaoDigitado, setProdutoEdicaoDigitado] = useState('')
  const [dataPrevistaEdicaoInputs, setDataPrevistaEdicaoInputs] = useState<Record<string, string>>({})
  const [salvandoEdicao, setSalvandoEdicao] = useState(false)
  const [mensagemEdicao, setMensagemEdicao] = useState<string | null>(null)
  const [erroEdicao, setErroEdicao] = useState<string | null>(null)

  async function carregarRegistros(filtrosOverride?: { de: string; ate: string }) {
    setCarregando(true)
    setErro(null)
    try {
      const params = new URLSearchParams()
      const filtroDe = filtrosOverride?.de ?? viradaCartaoDe
      const filtroAte = filtrosOverride?.ate ?? viradaCartaoAte
      if (filtroDe.trim()) params.set('viradaCartaoDe', filtroDe.trim())
      if (filtroAte.trim()) params.set('viradaCartaoAte', filtroAte.trim())
      const query = params.toString()
      const response = await fetch(`/api/atendimento-presencial/atendimentos${query ? `?${query}` : ''}`, { cache: 'no-store' })
      const data = (await response.json()) as ApiListaResponse
      if (!response.ok || !data.ok) throw new Error(data.message ?? 'Erro ao carregar registros')
      setRegistros(data.registros ?? [])
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Erro ao carregar registros')
    } finally {
      setCarregando(false)
    }
  }

  async function carregarDetalhe(id: string, options?: { preservarMensagemEdicao?: boolean }) {
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
        podeEditar: data.podeEditar ?? false,
        motivoBloqueio: data.motivoBloqueio ?? null,
        limiteEdicaoEm: data.limiteEdicaoEm ?? null,
      })
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

  useEffect(() => {
    void carregarRegistros()
    // Busca inicial da tela; filtros de virada continuam acionados pelo botao Buscar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium uppercase text-slate-500">ATENDIMENTO PRESENCIAL</p>
            <h1 className="mt-2 text-2xl font-semibold text-slate-950 sm:text-3xl">Registros de Atendimentos</h1>
          </div>
          <Button type="button" variant="outline" onClick={() => void carregarRegistros()} disabled={carregando} className="h-11 rounded-md">
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

            <div className="mb-4 grid gap-3 rounded-md border border-slate-200 bg-slate-50 p-3">
              <label className="text-sm font-semibold text-slate-700" htmlFor="filtro-virada-cartao-de">
                Virada do cartao
              </label>
              <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto_auto]">
                <input
                  id="filtro-virada-cartao-de"
                  value={viradaCartaoDe}
                  onChange={(event) => setViradaCartaoDe(formatarViradaCartaoInput(event.target.value))}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault()
                      void carregarRegistros()
                    }
                  }}
                  className="min-h-11 flex-1 rounded-md border border-slate-200 bg-white px-3 text-base outline-none focus:border-sky-500"
                  inputMode="numeric"
                  placeholder="De DD/MM"
                  maxLength={5}
                />
                <input
                  id="filtro-virada-cartao-ate"
                  value={viradaCartaoAte}
                  onChange={(event) => setViradaCartaoAte(formatarViradaCartaoInput(event.target.value))}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault()
                      void carregarRegistros()
                    }
                  }}
                  className="min-h-11 flex-1 rounded-md border border-slate-200 bg-white px-3 text-base outline-none focus:border-sky-500"
                  inputMode="numeric"
                  placeholder="Ate DD/MM"
                  maxLength={5}
                />
                <Button type="button" onClick={() => void carregarRegistros()} disabled={carregando} className="h-11 rounded-md">
                  <Search className="h-4 w-4" aria-hidden="true" />
                </Button>
                {(viradaCartaoDe || viradaCartaoAte) && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setViradaCartaoDe('')
                      setViradaCartaoAte('')
                      void carregarRegistros({ de: '', ate: '' })
                    }}
                    className="h-11 rounded-md"
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </Button>
                )}
              </div>
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
                  {formatarViradaCartao(registro.viradaCartaoDia, registro.viradaCartaoMes) && (
                    <p className="text-sm text-slate-600">Virada do cartao {formatarViradaCartao(registro.viradaCartaoDia, registro.viradaCartaoMes)}</p>
                  )}
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
                  {formatarViradaCartao(selecionado.atendimento.viradaCartaoDia, selecionado.atendimento.viradaCartaoMes) && (
                    <p>Virada do cartao {formatarViradaCartao(selecionado.atendimento.viradaCartaoDia, selecionado.atendimento.viradaCartaoMes)}</p>
                  )}
                  {selecionado.podeEditar ? (
                    <Button type="button" variant="outline" className="mt-3 h-10 rounded-md" onClick={() => abrirEdicao(selecionado)}>
                      Editar atendimento
                    </Button>
                  ) : (
                    <p className="mt-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                      {selecionado.motivoBloqueio ?? 'Voce nao possui permissao para editar este atendimento.'}
                    </p>
                  )}
                  {mensagemEdicao && !edicaoAberta && (
                    <p className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{mensagemEdicao}</p>
                  )}
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
                {edicaoAberta && fichaEdicao && (
                  <div className="grid gap-4 rounded-md border border-sky-200 bg-sky-50/50 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-base font-semibold text-slate-950">Editar atendimento</p>
                        <p className="mt-1 text-xs text-slate-600">Versao {selecionado.atendimento.version}</p>
                      </div>
                      <Button type="button" variant="outline" onClick={() => setEdicaoAberta(false)} className="h-9 rounded-md">
                        <X className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    </div>

                    {mensagemEdicao && <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{mensagemEdicao}</p>}
                    {erroEdicao && <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{erroEdicao}</p>}

                    <div className="grid gap-2 rounded-md border border-slate-200 bg-white p-3">
                      <p className="text-xs font-bold uppercase text-slate-500">Somente leitura</p>
                      <p>Cliente: {selecionado.cliente?.nome ?? 'Cliente nao localizada'}</p>
                      <p>Unidade: {resumoSelecionado?.unidadeNome ?? selecionado.atendimento.unidadeId}</p>
                      <p>Consultora: {resumoSelecionado?.consultoraEmail ?? selecionado.atendimento.consultoraUsuarioId}</p>
                    </div>

                    <div className="grid gap-3">
                      <p className="text-sm font-semibold text-slate-800">Criancas</p>
                      {fichaEdicao.criancas.map((crianca) => (
                        <div key={crianca.id} className="grid gap-3 rounded-md border border-slate-200 bg-white p-3">
                          <select
                            value={crianca.situacao}
                            onChange={(event) => atualizarCriancaEdicao(crianca.id, {
                              situacao: event.target.value as SituacaoCrianca,
                              dataPrevistaNascimento: undefined,
                              idadeUnidade: undefined,
                              idadeValor: undefined,
                            })}
                            className="min-h-11 rounded-md border border-slate-200 bg-white px-3 text-base"
                          >
                            {SITUACOES_CRIANCA.map((item) => <option key={item.chave} value={item.chave}>{item.label}</option>)}
                          </select>
                          {crianca.situacao === 'gestacao' && (
                            <input
                              value={dataPrevistaEdicaoInputs[crianca.id] ?? formatarDataISOParaInput(crianca.dataPrevistaNascimento)}
                              onChange={(event) => atualizarDataPrevistaEdicao(crianca.id, event.target.value)}
                              className="min-h-11 rounded-md border border-slate-200 px-3 text-base"
                              placeholder="DD/MM/AAAA"
                            />
                          )}
                          {crianca.situacao === 'ja_nasceu' && (
                            <div className="grid gap-2">
                              <div className="grid grid-cols-2 gap-2">
                                {(['meses', 'anos'] as UnidadeIdadeCrianca[]).map((unidade) => (
                                  <Button key={unidade} type="button" variant={crianca.idadeUnidade === unidade ? 'default' : 'outline'} onClick={() => atualizarCriancaEdicao(crianca.id, { idadeUnidade: unidade, idadeValor: undefined })} className="h-10 rounded-md">
                                    {unidade === 'meses' ? 'Meses' : 'Anos'}
                                  </Button>
                                ))}
                              </div>
                              {crianca.idadeUnidade && (
                                <div className="grid grid-cols-4 gap-2">
                                  {Array.from({ length: crianca.idadeUnidade === 'meses' ? 11 : 6 }, (_, i) => i + 1).map((valor) => (
                                    <Button key={valor} type="button" variant={crianca.idadeValor === valor ? 'default' : 'outline'} onClick={() => atualizarCriancaEdicao(crianca.id, { idadeValor: valor })} className="h-10 rounded-md">
                                      {valor}
                                    </Button>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                          <input
                            value={crianca.nome ?? ''}
                            disabled={crianca.nomeNaoInformado}
                            onChange={(event) => atualizarCriancaEdicao(crianca.id, { nome: limparNomeCriancaDigitacao(event.target.value), nomeNaoInformado: false })}
                            className="min-h-11 rounded-md border border-slate-200 px-3 text-base disabled:bg-slate-100"
                            placeholder="Nome da crianca"
                          />
                          <label className="flex min-h-10 items-center gap-3 text-sm font-semibold text-slate-700">
                            <input
                              type="checkbox"
                              checked={crianca.nomeNaoInformado === true}
                              onChange={(event) => atualizarCriancaEdicao(crianca.id, event.target.checked ? { nome: undefined, nomeNaoInformado: true } : { nomeNaoInformado: false })}
                            />
                            Nao sabe o nome ainda
                          </label>
                          <select
                            value={crianca.sexo ?? ''}
                            onChange={(event) => atualizarCriancaEdicao(crianca.id, { sexo: event.target.value ? event.target.value as SexoCrianca : undefined })}
                            className="min-h-11 rounded-md border border-slate-200 bg-white px-3 text-base"
                          >
                            <option value="">Sexo nao informado</option>
                            {SEXOS_CRIANCA.map((item) => <option key={item.chave} value={item.chave}>{item.label}</option>)}
                          </select>
                          {fichaEdicao.criancas.length > 1 && (
                            <Button type="button" variant="outline" onClick={() => removerCriancaEdicao(crianca.id)} className="h-10 rounded-md">
                              Remover crianca
                            </Button>
                          )}
                        </div>
                      ))}
                      <Button type="button" variant="outline" onClick={adicionarCriancaEdicao} className="h-11 rounded-md">
                        <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
                        Adicionar crianca
                      </Button>
                    </div>

                    <div>
                      <p className="text-sm font-semibold text-slate-800">Departamentos</p>
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        {DEPARTAMENTOS_INTERESSE.map((item) => (
                          <Button key={item.chave} type="button" variant={fichaEdicao.departamentos.includes(item.chave) ? 'default' : 'outline'} onClick={() => alternarDepartamentoEdicao(item.chave)} className="min-h-11 rounded-md">
                            {item.label}
                          </Button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <p className="text-sm font-semibold text-slate-800">Produtos de interesse</p>
                      <div className="mt-2 flex gap-2">
                        <input
                          value={produtoEdicaoDigitado}
                          onChange={(event) => setProdutoEdicaoDigitado(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                              event.preventDefault()
                              adicionarProdutoEdicao()
                            }
                          }}
                          className="min-h-11 flex-1 rounded-md border border-slate-200 px-3 text-base"
                          maxLength={FICHA_PRODUTO_MAX_CHARS}
                        />
                        <Button type="button" onClick={adicionarProdutoEdicao} className="h-11 rounded-md">
                          <Plus className="h-4 w-4" aria-hidden="true" />
                        </Button>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {fichaEdicao.produtosInteresse.map((produto) => (
                          <button key={produto} type="button" onClick={() => atualizarFichaEdicao((atual) => ({ ...atual, produtosInteresse: atual.produtosInteresse.filter((item) => item !== produto) }))} className="inline-flex min-h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold">
                            {produto}
                            <X className="h-4 w-4" aria-hidden="true" />
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <p className="text-sm font-semibold text-slate-800">Resultado</p>
                      <div className="mt-2 grid gap-2">
                        {RESULTADOS_ATENDIMENTO.map((item) => (
                          <Button key={item.chave} type="button" variant={fichaEdicao.resultadoAtendimento === item.chave ? 'default' : 'outline'} onClick={() => {
                            if (item.chave !== 'sim') setNumeroLancamentoEdicao('')
                            atualizarFichaEdicao((atual) => ({ ...atual, resultadoAtendimento: item.chave as ResultadoAtendimento }))
                          }} className="min-h-11 rounded-md">
                            {item.label}
                          </Button>
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
                                <Button key={motivo.chave} type="button" variant={fichaEdicao.motivosResultado.includes(motivo.chave) ? 'default' : 'outline'} onClick={() => alternarMotivoEdicao(motivo.chave)} className="min-h-11 justify-start rounded-md">
                                  {motivo.label}
                                </Button>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {fichaEdicao.motivosResultado.includes('virada_cartao') && (
                      <label className="text-sm font-semibold text-slate-800">
                        Virada do cartao
                        <input
                          value={viradaCartaoEdicaoInput}
                          onChange={(event) => atualizarViradaCartaoEdicao(event.target.value)}
                          className="mt-2 min-h-11 w-full rounded-md border border-slate-200 px-3 text-base"
                          inputMode="numeric"
                          placeholder="DD/MM"
                          maxLength={5}
                        />
                      </label>
                    )}

                    {fichaEdicao.motivosResultado.includes('outro') && (
                      <label className="text-sm font-semibold text-slate-800">
                        Complemento de Outro
                        <input
                          value={fichaEdicao.motivoOutro ?? ''}
                          onChange={(event) => atualizarFichaEdicao((atual) => ({ ...atual, motivoOutro: event.target.value }))}
                          className="mt-2 min-h-11 w-full rounded-md border border-slate-200 px-3 text-base"
                          maxLength={120}
                        />
                      </label>
                    )}

                    <label className="text-sm font-semibold text-slate-800">
                      Observacoes
                      <textarea
                        value={fichaEdicao.observacoes ?? ''}
                        onChange={(event) => atualizarFichaEdicao((atual) => ({ ...atual, observacoes: event.target.value }))}
                        className="mt-2 min-h-32 w-full rounded-md border border-slate-200 px-3 py-2 text-base"
                        maxLength={FICHA_OBSERVACOES_MAX_CHARS}
                      />
                    </label>

                    {fichaEdicao.resultadoAtendimento === 'sim' && (
                      <label className="text-sm font-semibold text-slate-800">
                        Numero do lancamento
                        <input
                          value={numeroLancamentoEdicao}
                          onChange={(event) => setNumeroLancamentoEdicao(event.target.value.replace(/\D/g, '').slice(0, 6))}
                          className="mt-2 min-h-11 w-full rounded-md border border-slate-200 px-3 text-base"
                          inputMode="numeric"
                        />
                      </label>
                    )}

                    <Button type="button" onClick={salvarEdicao} disabled={salvandoEdicao} className="h-11 rounded-md">
                      <Save className="mr-2 h-4 w-4" aria-hidden="true" />
                      {salvandoEdicao ? 'Salvando...' : 'Salvar edicao'}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </aside>
        </div>
      </div>
    </main>
  )
}
