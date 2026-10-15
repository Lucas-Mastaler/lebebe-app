'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Plus, Ruler } from 'lucide-react'
import { toast } from 'sonner'
import {
  Alert,
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  FormErrorSummary,
  Spinner,
} from '@/components/design-system'
import {
  apiFormularioDecorisi,
  carregarArtigosDecorisi,
  ErroApiFormularioDecorisi,
  errosFormularioDecorisi,
  errosArtigoDecorisi,
  formatarCentavosDecorisi,
  montarItensFormularioDecorisi,
  novoArtigoDecorisi,
  preverArtigoDecorisi,
  procurarArteCatalogo,
  type ArtigoFormularioDecorisi,
  type IdentificacaoFormularioDecorisi,
  type OpcoesFormularioDecorisi,
  type PedidoFormularioDecorisi,
} from '@/lib/pedidos-personalizados/decorisi/formulario'
import { LIMITE_ANEXO_BYTES } from '@/lib/pedidos-personalizados/server/anexos-arquivo'
import { AvisoPedidoSalvoFixo } from './AvisoPedidoSalvoFixo'
import { CardProdutoDecorisi } from './CardProdutoDecorisi'

function focarCampo(id: string) {
  const campo = document.getElementById(id)
  campo?.scrollIntoView({ block: 'center' })
  campo?.focus({ preventScroll: true })
}

const BASE = '/api/pedidos-personalizados/decorisi'
const TIPOS_ANEXO = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']

function arquivoAceito(arquivo: File) {
  return arquivo.size >= 1 && arquivo.size <= LIMITE_ANEXO_BYTES && TIPOS_ANEXO.includes(arquivo.type)
}

type LocalDecorisi = {
  artigoId: string
  slot: number
  arquivo: File
  previewUrl: string | null
  anexoId?: string
  chave: string
}
type Cotacao = {
  version: number
  completa: boolean
  totalCentavos: string | null
  itens: Array<{
    itemId: string
    quantidade: string | null
    preco: string | null
    subtotalCentavos: string | null
    pendencias: string[]
  }>
}
type Props = {
  opcoes: OpcoesFormularioDecorisi
  identificacao: IdentificacaoFormularioDecorisi
  onIdentificacao: (dados: IdentificacaoFormularioDecorisi) => void
  onBloqueio: (bloqueado: boolean) => void
  onAlterado: (alterado: boolean) => void
  onErrosIdentificacao: (erros: Record<string, string>) => void
  onNovoPedido: () => void
}
export function FormularioDecorisi({
  opcoes: iniciais,
  identificacao: dadosIdentificacao,
  onIdentificacao,
  onBloqueio,
  onAlterado,
  onErrosIdentificacao,
  onNovoPedido,
}: Props) {
  const identificacao = useMemo(
    () => ({
      unidade: dadosIdentificacao.unidade,
      consultora: dadosIdentificacao.consultora,
      cliente: dadosIdentificacao.cliente,
      telefone: dadosIdentificacao.telefone,
    }),
    [
      dadosIdentificacao.unidade,
      dadosIdentificacao.consultora,
      dadosIdentificacao.cliente,
      dadosIdentificacao.telefone,
    ],
  )
  const [opcoes, setOpcoes] = useState(iniciais)
  const [artigos, setArtigos] = useState<ArtigoFormularioDecorisi[]>([])
  const [geracao, setGeracao] = useState(0)
  const [pedido, setPedido] = useState<{ id: string; version: number } | null>(
    null,
  )
  const [persistido, setPersistido] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [urlAnexo, setUrlAnexo] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [confirmacaoSalvo, setConfirmacaoSalvo] = useState<{ version: number; arquivos: number } | null>(null)
  const [ocorrenciaSalvo, setOcorrenciaSalvo] = useState(0)
  const [tentou, setTentou] = useState(false)
  const [cotacao, setCotacao] = useState<Cotacao | null>(null)
  const [conflito, setConflito] = useState(false)
  const [falhaAbertura, setFalhaAbertura] = useState(false)
  const [somenteLeitura, setSomenteLeitura] = useState(false)
  const [confirmacao, setConfirmacao] = useState<{
    mensagem: string
    executar: () => void
  } | null>(null)
  const [reenvio, setReenvio] = useState(false)
  const trava = useRef(false)
  const inicializado = useRef(false)
  const chave = useRef('')
  const criacaoPendente = useRef<string | null>(null)
  const arquivoPendente = useRef<{
    artigoId: string
    arquivo: File
    slot: number
    anexoId?: string
    chave: string
    version: number
  } | null>(null)
  const [locais, setLocais] = useState<LocalDecorisi[]>([])
  const locaisRef = useRef<LocalDecorisi[]>([])
  const snapshot = JSON.stringify({ identificacao, artigos })
  const alterado = snapshot !== persistido
  const erros = useMemo(
    () =>
      Object.assign(
        errosFormularioDecorisi(artigos, identificacao),
        ...artigos.map((a) => ({
          ...errosArtigoDecorisi(a, opcoes),
          ...(a.produtoRespondido === false
            ? { [`${a.id}-produto`]: 'Escolha o produto.' }
            : a.arteRespondida === false
              ? { [`${a.id}-arte`]: 'Escolha como será a arte.' }
              : {}),
        })),
      ),
    [artigos, identificacao, opcoes],
  )
  const bloqueado =
    ocupado || conflito || somenteLeitura || reenvio || falhaAbertura
  useEffect(() => {
    onBloqueio(bloqueado)
    return () => onBloqueio(false)
  }, [bloqueado, onBloqueio])
  useEffect(() => {
    onAlterado(alterado)
    return () => onAlterado(false)
  }, [alterado, onAlterado])
  useEffect(() => {
    if (tentou) onErrosIdentificacao(erros)
  }, [tentou, erros, onErrosIdentificacao])
  useEffect(() => {
    function sair(e: BeforeUnloadEvent) {
      if (alterado || ocupado || reenvio || locaisRef.current.length) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', sair)
    return () => window.removeEventListener('beforeunload', sair)
  }, [alterado, ocupado, reenvio])
  const recarregar = useCallback(
    async (id: string) => {
      const [r, atuais] = await Promise.all([
        apiFormularioDecorisi<{ pedido: PedidoFormularioDecorisi }>(
          `${BASE}/pedidos/${id}`,
        ),
        apiFormularioDecorisi<OpcoesFormularioDecorisi>(`${BASE}/opcoes`),
      ])
      const dados = r.pedido
      const cabecalho = {
        unidade:
          atuais.unidades.find((u) => u.id === dados.unidade_id)?.chave ?? '',
        consultora: dados.consultora,
        cliente: dados.cliente,
        telefone: dados.telefone_normalizado,
      }
      const itens = carregarArtigosDecorisi(dados, atuais)
      setFalhaAbertura(false)
      setOpcoes(atuais)
      setArtigos(itens)
      setGeracao((valor) => valor + 1)
      onIdentificacao(cabecalho)
      setPedido({ id: dados.id, version: dados.version })
      setPersistido(
        JSON.stringify({ identificacao: cabecalho, artigos: itens }),
      )
      setConflito(false)
      setSomenteLeitura(dados.status !== 'RASCUNHO')
      const q = await apiFormularioDecorisi<{ cotacao: Cotacao }>(
        `/api/pedidos-personalizados/pedidos/${id}/cotacao`,
      )
      setCotacao(q.cotacao)
      return { id: dados.id, version: dados.version }
    },
    [onIdentificacao],
  )
  async function executar(acao: () => Promise<void>) {
    if (trava.current) return
    trava.current = true
    setOcupado(true)
    setErro(null)
    try {
      await acao()
    } catch (e) {
      setErro(
        e instanceof ErroApiFormularioDecorisi
          ? e.message
          : 'A operação não foi confirmada. Verifique sua conexão e tente novamente.',
      )
      if (e instanceof ErroApiFormularioDecorisi && e.status === 409)
        setConflito(true)
    } finally {
      trava.current = false
      setOcupado(false)
    }
  }
  function definirLocais(proximo: LocalDecorisi[]) {
    locaisRef.current = proximo
    setLocais(proximo)
  }
  function removerLocal(artigoId: string, slot: number) {
    const anterior = locaisRef.current.find((item) => item.artigoId === artigoId && item.slot === slot)
    if (anterior?.previewUrl) URL.revokeObjectURL(anterior.previewUrl)
    definirLocais(locaisRef.current.filter((item) => !(item.artigoId === artigoId && item.slot === slot)))
  }
  function selecionarLocal(artigoId: string, slot: number, arquivo: File, anexoId?: string) {
    if (!arquivoAceito(arquivo)) {
      setErro('Escolha JPEG, PNG, WEBP ou PDF, com até 10 MiB.')
      return
    }
    setErro(null)
    const anterior = locaisRef.current.find((item) => item.artigoId === artigoId && item.slot === slot)
    if (anterior?.previewUrl) URL.revokeObjectURL(anterior.previewUrl)
    definirLocais([
      ...locaisRef.current.filter((item) => !(item.artigoId === artigoId && item.slot === slot)),
      {
        artigoId,
        slot,
        arquivo,
        previewUrl: arquivo.type.startsWith('image/') ? URL.createObjectURL(arquivo) : null,
        anexoId,
        chave: crypto.randomUUID(),
      },
    ])
  }
  useEffect(() => () => {
    for (const local of locaisRef.current) if (local.previewUrl) URL.revokeObjectURL(local.previewUrl)
  }, [])
  async function transmitirArquivo(params: { pedidoId: string; version: number; artigoId: string; arquivo: File; slot: number; anexoId?: string; chave: string }) {
    if (!arquivoAceito(params.arquivo)) {
      const invalido = new ErroApiFormularioDecorisi(422, 'ARQUIVO_INVALIDO', 'Escolha JPEG, PNG, WEBP ou PDF, com até 10 MiB.')
      setErro(invalido.message)
      throw invalido
    }
    const form = new FormData()
    form.set('arquivo', params.arquivo)
    form.set('slot', String(params.slot))
    form.set('expectedVersion', String(params.version))
    const url = `${BASE}/pedidos/${params.pedidoId}/itens/${params.artigoId}/anexos${params.anexoId ? `/${params.anexoId}` : ''}`
    const resposta = await apiFormularioDecorisi<{ version?: number }>(url, {
      method: params.anexoId ? 'PUT' : 'POST',
      headers: { 'Idempotency-Key': params.chave },
      body: form,
    })
    return typeof resposta.version === 'number' ? resposta.version : params.version
  }
  useEffect(() => {
    if (inicializado.current) return
    inicializado.current = true
    chave.current = crypto.randomUUID()
    const id = new URL(window.location.href).searchParams.get('decorisiPedido')
    if (id) {
      setFalhaAbertura(true)
      void executar(async () => {
        await recarregar(id)
      })
    } else {
      const iniciais = [novoArtigoDecorisi()]
      setArtigos(iniciais)
      setPersistido(JSON.stringify({ identificacao, artigos: iniciais }))
    }
    // Inicialização única. Reabrir é feito explicitamente pelo usuário.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  function mudarArtigo(proximo: ArtigoFormularioDecorisi) {
    const existente = procurarArteCatalogo(artigos, proximo)
    if (existente) {
      setAviso(
        'Essa referência já está no pedido. Adicione as paredes ao produto destacado.',
      )
      document.getElementById(`decorisi-${existente}`)?.focus()
      return false
    }
    setArtigos((lista) => lista.map((a) => (a.id === proximo.id ? proximo : a)))
    setCotacao(null)
    return true
  }
  async function salvar() {
    setTentou(true)
    onErrosIdentificacao(erros)
    if (Object.keys(erros).length) {
      focarCampo(Object.keys(erros)[0])
      return
    }
    await executar(async () => {
      const itens = montarItensFormularioDecorisi(artigos)
      let id = pedido?.id
      if (!pedido) {
        const corpo =
          criacaoPendente.current ??
          JSON.stringify({
            ...identificacao,
            itens,
            idempotencyKey: chave.current,
          })
        criacaoPendente.current = corpo
        try {
          const r = await apiFormularioDecorisi<{
            pedidoId: string
            version: number
          }>(`${BASE}/pedidos`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: corpo,
          })
          id = r.pedidoId
          setPedido({ id, version: r.version })
          criacaoPendente.current = null
          setReenvio(false)
          const url = new URL(window.location.href)
          url.searchParams.set('decorisiPedido', id)
          window.history.replaceState(null, '', url)
        } catch (e) {
          // Erros de transporte/servidor podem ocorrer depois de COMMIT. Congelar payload.
          if (!(e instanceof ErroApiFormularioDecorisi) || e.status >= 500) {
            setReenvio(true)
          } else {
            criacaoPendente.current = null
          }
          throw e
        }
      } else {
        try {
          await apiFormularioDecorisi(`${BASE}/pedidos/${pedido.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              expectedVersion: pedido.version,
              identificacao,
              itens,
            }),
          })
        } catch (e) {
          if (!(e instanceof ErroApiFormularioDecorisi) || e.status >= 500)
            setConflito(true)
          throw e
        }
      }
      const carregado = await recarregar(id!)
      let version = carregado.version
      const fila = [...locaisRef.current]
      for (const local of fila) {
        arquivoPendente.current = {
          artigoId: local.artigoId,
          arquivo: local.arquivo,
          slot: local.slot,
          anexoId: local.anexoId,
          chave: local.chave,
          version,
        }
        try {
          version = await transmitirArquivo({
            pedidoId: carregado.id,
            version,
            artigoId: local.artigoId,
            arquivo: local.arquivo,
            slot: local.slot,
            anexoId: local.anexoId,
            chave: local.chave,
          })
          arquivoPendente.current = null
          setReenvio(false)
          setPedido({ id: carregado.id, version })
          removerLocal(local.artigoId, local.slot)
        } catch (e) {
          if (!(e instanceof ErroApiFormularioDecorisi) || e.status >= 500) setReenvio(true)
          else {
            arquivoPendente.current = null
            setReenvio(false)
          }
          throw e
        }
      }
      if (fila.length) await recarregar(carregado.id)
      setAviso(null)
      setConfirmacaoSalvo({ version, arquivos: fila.length })
      setOcorrenciaSalvo((atual) => atual + 1)
      toast.success('Orçamento salvo como rascunho.')
    })
  }
  async function enviarArquivo(
    artigoId: string,
    arquivo: File,
    slot: number,
    anexoId?: string,
  ) {
    if (!pedido) return
    if (alterado) {
      setErro('Salve as alterações antes de enviar um anexo.')
      return
    }
    if (!arquivoAceito(arquivo)) {
      setErro('Escolha JPEG, PNG, WEBP ou PDF, com até 10 MiB.')
      return
    }
    const pendente = arquivoPendente.current ?? {
      artigoId,
      arquivo,
      slot,
      anexoId,
      chave: crypto.randomUUID(),
      version: pedido.version,
    }
    arquivoPendente.current = pendente
    await executar(async () => {
      try {
        await transmitirArquivo({
          pedidoId: pedido.id,
          version: pendente.version,
          artigoId: pendente.artigoId,
          arquivo: pendente.arquivo,
          slot: pendente.slot,
          anexoId: pendente.anexoId,
          chave: pendente.chave,
        })
        arquivoPendente.current = null
        setReenvio(false)
        removerLocal(pendente.artigoId, pendente.slot)
        await recarregar(pedido.id)
        setAviso('Anexo salvo.')
      } catch (e) {
        if (!(e instanceof ErroApiFormularioDecorisi) || e.status >= 500) {
          setReenvio(true)
        } else {
          arquivoPendente.current = null
          setReenvio(false)
        }
        throw e
      }
    })
  }
  function abrirAnexo(artigoId: string, id: string) {
    if (trava.current || !pedido) return
    const janela = window.open('about:blank', '_blank')
    if (janela) janela.opener = null
    void executar(async () => {
      try {
        const r = await apiFormularioDecorisi<{ url: string }>(
          `${BASE}/pedidos/${pedido.id}/itens/${artigoId}/anexos/${id}`,
        )
        if (janela) janela.location.href = r.url
        else setUrlAnexo(r.url)
      } catch (e) {
        janela?.close()
        throw e
      }
    })
  }
  function removerAnexo(artigoId: string, id: string) {
    setConfirmacao({
      mensagem: 'Remover este anexo do produto?',
      executar: () =>
        void executar(async () => {
          await apiFormularioDecorisi(
            `${BASE}/pedidos/${pedido!.id}/itens/${artigoId}/anexos/${id}`,
            {
              method: 'DELETE',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ expectedVersion: pedido!.version }),
            },
          )
          await recarregar(pedido!.id)
        }),
    })
  }
  function removerProduto(id: string) {
    if (artigos.length <= 1) {
      setAviso('Mantenha ao menos um produto no pedido.')
      return
    }
    setConfirmacao({
      mensagem:
        'Remover este produto e seus anexos? A remoção será confirmada ao salvar o rascunho.',
      executar: () => {
        for (const local of locaisRef.current.filter((item) => item.artigoId === id)) {
          if (local.previewUrl) URL.revokeObjectURL(local.previewUrl)
        }
        definirLocais(locaisRef.current.filter((item) => item.artigoId !== id))
        setArtigos((itens) => itens.filter((a) => a.id !== id))
        setCotacao(null)
      },
    })
  }
  const previas = artigos.map((a) => preverArtigoDecorisi(a, opcoes))
  const total =
    artigos.every((a) => a.produtoRespondido !== false && a.arteRespondida !== false) &&
    previas.every((p) => p.subtotal !== undefined) && previas.length
      ? previas.reduce((s, p) => s + BigInt(p.subtotal!), BigInt(0)).toString()
      : null
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Ruler className="size-5" aria-hidden="true" />
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">Decorisi</p>
            <h2 className="text-base font-bold text-slate-900 sm:text-lg">
              Produtos e medidas · {artigos.length}/10
            </h2>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            className="min-h-11"
            disabled={ocupado || reenvio || conflito || falhaAbertura}
            onClick={() => {
              if (alterado)
                setConfirmacao({
                  mensagem:
                    'Iniciar outro pedido e descartar as alterações locais? O rascunho já salvo será preservado.',
                  executar: onNovoPedido,
                })
              else onNovoPedido()
            }}
          >
            Novo pedido
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="min-h-11"
            disabled={bloqueado || artigos.length >= 10}
            onClick={() => {
              setArtigos((a) => [...a, novoArtigoDecorisi()])
              setCotacao(null)
            }}
          >
            <Plus aria-hidden="true" />Adicionar produto
          </Button>
        </div>
      </div>
      {urlAnexo && (
        <Alert tone="info">
          <a
            href={urlAnexo}
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            Abrir anexo autorizado
          </a>
        </Alert>
      )}
      {erro && <Alert tone="danger">{erro}</Alert>}
      {aviso && <Alert tone="info">{aviso}</Alert>}
      {tentou && <FormErrorSummary errors={erros} onFocusField={focarCampo} />}
      {falhaAbertura && (
        <Alert tone="warning">
          Não foi possível carregar o rascunho.
          <Button
            type="button"
            disabled={ocupado}
            onClick={() =>
              void executar(async () => {
                await recarregar(
                  new URL(window.location.href).searchParams.get(
                    'decorisiPedido',
                  )!,
                )
              })
            }
          >
            Tentar abrir novamente
          </Button>
        </Alert>
      )}
      {conflito && (
        <Alert tone="warning">
          O pedido pode ter sido alterado. Recarregue para conferir a versão
          salva.
          <Button
            type="button"
            variant="secondary"
            disabled={ocupado}
            onClick={() =>
              setConfirmacao({
                mensagem:
                  'Recarregar o pedido e descartar as alterações locais?',
                executar: () =>
                  void executar(async () => {
                    await recarregar(pedido!.id)
                  }),
              })
            }
          >
            Recarregar pedido
          </Button>
        </Alert>
      )}
      {reenvio && (
        <Alert tone="warning">
          O último envio não foi confirmado. Os dados foram preservados para
          repetir a mesma operação.
          <Button
            type="button"
            disabled={ocupado}
            onClick={() => {
              const a = arquivoPendente.current
              if (a)
                void enviarArquivo(a.artigoId, a.arquivo, a.slot, a.anexoId)
              else void salvar()
            }}
          >
            Verificar e repetir envio
          </Button>
        </Alert>
      )}
      {somenteLeitura && (
        <Alert tone="info">
          Este pedido já saiu de rascunho e está disponível somente para
          consulta.
        </Alert>
      )}
      {artigos.map((a, i) => (
        <CardProdutoDecorisi
          key={`${a.id}-${geracao}`}
          artigo={a}
          ordem={i + 1}
          opcoes={opcoes}
          bloqueado={bloqueado}
          salvo={!!pedido && !alterado}
          erros={erros}
          tentouSalvar={tentou}
          onChange={mudarArtigo}
          onConfirmar={(mensagem, executar) =>
            setConfirmacao({ mensagem, executar })
          }
          onRemover={() => removerProduto(a.id)}
          onArquivo={(f, s, id) => enviarArquivo(a.id, f, s, id)}
          onExcluirAnexo={(id) => removerAnexo(a.id, id)}
          onAbrirAnexo={(id) => abrirAnexo(a.id, id)}
          locais={locais.filter((item) => item.artigoId === a.id)}
          onSelecionarLocal={(slot, arquivo, anexoId) => selecionarLocal(a.id, slot, arquivo, anexoId)}
          onRemoverLocal={(slot) => removerLocal(a.id, slot)}
        />
      ))}
      <Button
        type="button"
        variant="secondary"
        className="min-h-11"
        disabled={bloqueado || artigos.length >= 10}
        onClick={() => {
          setArtigos((a) => [...a, novoArtigoDecorisi()])
          setCotacao(null)
        }}
      >
        <Plus aria-hidden="true" />Adicionar produto
      </Button>
      {confirmacaoSalvo && (
        <Alert tone="success" title="Orçamento salvo">
          <p>Status RASCUNHO; versão {confirmacaoSalvo.version}; {artigos.length} produto(s). A venda ainda não foi fechada.</p>
          {confirmacaoSalvo.arquivos > 0 && <p className="mt-2">Os arquivos selecionados foram enviados.</p>}
          <Button asChild type="button" variant="secondary" className="mt-4 min-h-10">
            <Link href="/pedidos-personalizados">Ir para a gestão de pedidos<ArrowRight /></Link>
          </Button>
        </Alert>
      )}
      <div className="sticky bottom-0 z-20 flex flex-col gap-2">
        <AvisoPedidoSalvoFixo
          key={ocorrenciaSalvo}
          disparo={confirmacaoSalvo !== null}
          titulo="Pedido salvo"
          mensagem="O pedido foi salvo com sucesso. Você pode ir para a gestão de pedidos personalizados."
        />
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-background p-4 shadow-lg">
        <div aria-live="polite">
          <p className="font-bold">
            Total estimado:{' '}
            {total ? formatarCentavosDecorisi(total) : 'Complete as pendências'}
          </p>
          {pedido && (
            <p className="text-xs text-muted-foreground">
              Rascunho salvo · versão {pedido.version} ·{' '}
              <a className="underline" href={`?decorisiPedido=${pedido.id}`}>
                Reabrir rascunho
              </a>
            </p>
          )}
          {cotacao && !alterado && (
            <p className="text-sm">
              Cotação do servidor:{' '}
              {cotacao.completa && cotacao.totalCentavos
                ? formatarCentavosDecorisi(cotacao.totalCentavos)
                : 'Pendente de informações para o fechamento'}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            disabled={bloqueado}
            onClick={() =>
              void executar(async () => {
                const atuais =
                  await apiFormularioDecorisi<OpcoesFormularioDecorisi>(
                    `${BASE}/opcoes`,
                  )
                setOpcoes(atuais)
                if (pedido && !alterado) {
                  const q = await apiFormularioDecorisi<{ cotacao: Cotacao }>(
                    `/api/pedidos-personalizados/pedidos/${pedido.id}/cotacao`,
                  )
                  setCotacao(q.cotacao)
                }
                setAviso('Preços atualizados. Confira os subtotais.')
              })
            }
          >
            Atualizar preços
          </Button>
          <Button
            type="button"
            disabled={bloqueado || !artigos.length}
            onClick={() => void salvar()}
          >
            {ocupado ? <Spinner label="Salvando pedido" /> : null}Salvar
            rascunho
          </Button>
        </div>
      </div>
      </div>
      <Dialog
        open={confirmacao !== null}
        onOpenChange={(aberto) => {
          if (!aberto) setConfirmacao(null)
        }}
      >
        <DialogContent>
          <DialogHeader
            title="Confirmar alteração"
            description={confirmacao?.mensagem}
          />
          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setConfirmacao(null)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                const acao = confirmacao?.executar
                setConfirmacao(null)
                acao?.()
              }}
            >
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
