'use client'

import { ClipboardEvent, FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlertCircle, CheckCircle2, Loader2, Plus, RefreshCw, Save, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { LIMITE_TAPETES_POR_PEDIDO } from '@/lib/pedidos-personalizados'
import { CardTapete } from './CardTapete'
import { AnexosTapete } from './AnexosTapete'
import { AnexosIniciaisTapete } from './AnexosIniciaisTapete'
import { PreviaMensagem } from './PreviaMensagem'
import {
  adicionarTapete,
  associarTapetesCriados,
  avaliarFormulario,
  carregarOpcoesNovoPedido,
  criarEstadoInicial,
  ehErroHttpNovoPedido,
  enviarNovoPedido,
  enviarAnexo,
  gerarIdempotencyKey,
  montarPayloadCriacao,
  moverItem,
  removerTapete,
  removerAnexoApi,
  solicitarUrlAnexo,
  substituirAnexo,
  deveAvisarDadosNaoSalvos,
  validarArquivoAnexo,
} from './novo-pedido-modelo'
import type {
  AnexoFormulario,
  EstadoNovoPedido,
  OpcoesNovoPedido,
  RespostaCriacao,
  TapeteFormulario,
} from './novo-pedido-modelo'

type OperacaoAnexo = {
  chaveLocal: string
  slot: 1 | 2
  tipo: 'upload' | 'substituicao' | 'remocao' | 'abertura'
}

function uuidSeguro() {
  return crypto.randomUUID()
}

function CardEstado({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">{children}</div>
}

export default function FormularioNovoPedido() {
  const [opcoes, setOpcoes] = useState<OpcoesNovoPedido | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erroCarregamento, setErroCarregamento] = useState<string | null>(null)
  const [estado, setEstado] = useState<EstadoNovoPedido>(() => criarEstadoInicial('tapete-inicial'))
  const [alterado, setAlterado] = useState(false)
  const [tentouSalvar, setTentouSalvar] = useState(false)
  const [camposTocados, setCamposTocados] = useState<Set<string>>(() => new Set())
  const [enviando, setEnviando] = useState(false)
  const [erroEnvio, setErroEnvio] = useState<string | null>(null)
  const [salvo, setSalvo] = useState<RespostaCriacao | null>(null)
  const [operacaoAnexo, setOperacaoAnexo] = useState<OperacaoAnexo | null>(null)
  const [errosAnexos, setErrosAnexos] = useState<Record<string, string>>({})
  const [falhaParcialAnexos, setFalhaParcialAnexos] = useState(false)
  const [conflitoVersionamento, setConflitoVersionamento] = useState(false)
  const [confirmarNovo, setConfirmarNovo] = useState(false)
  const [copiada, setCopiada] = useState(false)
  const enviandoRef = useRef(false)
  const operacaoAnexoRef = useRef(false)
  const idempotencyKeyRef = useRef('')
  const urlsPreviewRef = useRef(new Set<string>())

  useEffect(() => {
    idempotencyKeyRef.current = gerarIdempotencyKey()
    const urls = urlsPreviewRef.current
    return () => {
      for (const url of urls) URL.revokeObjectURL(url)
      urls.clear()
    }
  }, [])

  const carregar = useCallback(async () => {
    setCarregando(true)
    setErroCarregamento(null)
    try {
      const dados = await carregarOpcoesNovoPedido()
      setOpcoes(dados)
    } catch (erro) {
      setErroCarregamento(ehErroHttpNovoPedido(erro) ? erro.mensagem : 'Não foi possível carregar as opções. Tente novamente.')
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => { void carregar() }, [carregar])

  const avaliacao = useMemo(
    () => opcoes ? avaliarFormulario(estado, opcoes) : null,
    [estado, opcoes]
  )
  const errosTodos = avaliacao?.validacao.erros ?? []
  const erros = errosTodos.filter((item) => tentouSalvar || camposTocados.has(item.campo))
  const avisos = avaliacao?.validacao.avisos ?? []
  const possuiUploadPendente = operacaoAnexo !== null || estado.tapetes.some((tapete) => tapete.anexosLocais.length > 0)
  const deveAvisarSaida = deveAvisarDadosNaoSalvos(alterado, !!salvo, possuiUploadPendente)

  useEffect(() => {
    if (!deveAvisarSaida) return
    const avisar = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', avisar)
    return () => window.removeEventListener('beforeunload', avisar)
  }, [deveAvisarSaida])

  function atualizarEstado(proximo: EstadoNovoPedido) {
    setEstado(proximo)
    setAlterado(true)
    setErroEnvio(null)
    setCopiada(false)
  }

  function atualizarTapete(indice: number, tapete: TapeteFormulario) {
    const tapetes = [...estado.tapetes]
    tapetes[indice] = tapete
    atualizarEstado({ ...estado, tapetes })
  }

  function revogarPreview(url: string | null) {
    if (!url) return
    URL.revokeObjectURL(url)
    urlsPreviewRef.current.delete(url)
  }

  function selecionarAnexoInicial(indice: number, slot: 1 | 2, arquivo: File) {
    const erro = validarArquivoAnexo(arquivo)
    if (erro) {
      toast.error(erro)
      return
    }
    const atual = estado.tapetes[indice]
    const anterior = atual.anexosLocais.find((item) => item.slot === slot)
    revogarPreview(anterior?.previewUrl ?? null)
    const previewUrl = arquivo.type.startsWith('image/') ? URL.createObjectURL(arquivo) : null
    if (previewUrl) urlsPreviewRef.current.add(previewUrl)
    atualizarTapete(indice, {
      ...atual,
      anexosLocais: [
        ...atual.anexosLocais.filter((item) => item.slot !== slot),
        { slot, arquivo, previewUrl, estado: 'selecionado' as const, erro: null },
      ].sort((a, b) => a.slot - b.slot),
    })
  }

  function removerAnexoInicial(indice: number, slot: 1 | 2) {
    const atual = estado.tapetes[indice]
    revogarPreview(atual.anexosLocais.find((item) => item.slot === slot)?.previewUrl ?? null)
    atualizarTapete(indice, { ...atual, anexosLocais: atual.anexosLocais.filter((item) => item.slot !== slot) })
  }

  function atualizarEstadoAnexoInicial(chaveLocal: string, slot: 1 | 2, estadoAnexo: 'selecionado' | 'enviando' | 'falhou', erro: string | null) {
    setEstado((atual) => ({
      ...atual,
      tapetes: atual.tapetes.map((tapete) => tapete.chaveLocal === chaveLocal
        ? { ...tapete, anexosLocais: tapete.anexosLocais.map((item) => item.slot === slot ? { ...item, estado: estadoAnexo, erro } : item) }
        : tapete),
    }))
  }

  async function enviarUmAnexoInicial(pedidoId: string, tapete: TapeteFormulario, slot: 1 | 2, version: number) {
    const local = tapete.anexosLocais.find((item) => item.slot === slot)
    if (!tapete.tapeteId || !local) return version
    atualizarEstadoAnexoInicial(tapete.chaveLocal, slot, 'enviando', null)
    try {
      const resposta = await enviarAnexo({
        pedidoId,
        tapeteId: tapete.tapeteId,
        slot,
        arquivo: local.arquivo,
        expectedVersion: version,
      })
      revogarPreview(local.previewUrl)
      setEstado((atual) => ({
        ...atual,
        tapetes: atual.tapetes.map((item) => item.chaveLocal === tapete.chaveLocal ? {
          ...item,
          anexosLocais: item.anexosLocais.filter((anexo) => anexo.slot !== slot),
          anexos: [...item.anexos.filter((anexo) => anexo.slot !== slot), {
            anexoId: resposta.anexoId,
            slot: resposta.slot,
            nomeOriginal: resposta.nomeOriginal,
            mime: resposta.mime,
            tamanho: resposta.tamanho,
            createdAt: resposta.createdAt ?? null,
          }].sort((a, b) => a.slot - b.slot),
        } : item),
      }))
      setSalvo((atual) => atual ? { ...atual, version: resposta.version } : atual)
      return resposta.version
    } catch (erro) {
      const mensagem = ehErroHttpNovoPedido(erro) ? erro.mensagem : 'Não foi possível enviar este anexo. Tente novamente.'
      atualizarEstadoAnexoInicial(tapete.chaveLocal, slot, 'falhou', mensagem)
      registrarErroAnexo(tapete.chaveLocal, slot, mensagem)
      setFalhaParcialAnexos(true)
      if (ehErroHttpNovoPedido(erro) && erro.status === 409) setConflitoVersionamento(true)
      throw erro
    }
  }

  async function enviarAnexosIniciais(resposta: RespostaCriacao, tapetes: TapeteFormulario[]) {
    let version = resposta.version
    let houveFalha = false
    for (const tapete of tapetes) {
      for (const local of [...tapete.anexosLocais].sort((a, b) => a.slot - b.slot)) {
        try {
          version = await enviarUmAnexoInicial(resposta.pedidoId, tapete, local.slot, version)
        } catch (erro) {
          houveFalha = true
          if (ehErroHttpNovoPedido(erro) && erro.status === 409) return
        }
      }
    }
    setFalhaParcialAnexos(houveFalha)
    if (!houveFalha && tapetes.some((tapete) => tapete.anexosLocais.length > 0)) toast.success('Anexos iniciais enviados.')
  }

  async function reenviarAnexoInicial(tapete: TapeteFormulario, slot: 1 | 2) {
    if (!salvo || operacaoAnexoRef.current || conflitoVersionamento) return
    operacaoAnexoRef.current = true
    setOperacaoAnexo({ chaveLocal: tapete.chaveLocal, slot, tipo: 'upload' })
    try {
      await enviarUmAnexoInicial(salvo.pedidoId, tapete, slot, salvo.version)
      setFalhaParcialAnexos(estado.tapetes.some((item) => item.anexosLocais.some((anexo) => anexo.estado === 'falhou' && !(item.chaveLocal === tapete.chaveLocal && anexo.slot === slot))))
      toast.success(`Anexo do slot ${slot} enviado.`)
    } catch (erro) {
      toast.error(ehErroHttpNovoPedido(erro) ? erro.mensagem : 'Não foi possível reenviar o anexo.')
    } finally {
      operacaoAnexoRef.current = false
      setOperacaoAnexo(null)
    }
  }

  function mensagens(campo: string) {
    return erros.filter((item) => item.campo === campo).map((item) => item.mensagem)
  }

  function marcarTocado(campo: string) {
    setCamposTocados((atuais) => {
      if (atuais.has(campo)) return atuais
      const proximos = new Set(atuais)
      proximos.add(campo)
      return proximos
    })
  }

  function colarNumeroLancamento(event: ClipboardEvent<HTMLInputElement>) {
    event.preventDefault()
    atualizarEstado({ ...estado, numeroLancamento: event.clipboardData.getData('text') })
    marcarTocado('numeroLancamento')
  }

  function focarPrimeiroErro(problemas: typeof errosTodos) {
    window.setTimeout(() => {
      const primeiro = document.querySelector<HTMLElement>('[aria-invalid="true"]')
      if (primeiro) {
        primeiro.focus()
        primeiro.scrollIntoView({ behavior: 'smooth', block: 'center' })
        return
      }
      const erroTapete = problemas.find((item) => item.campo.startsWith('tapetes.'))
      const indice = erroTapete ? Number(erroTapete.campo.split('.')[1]) : -1
      document.getElementById(indice >= 0 ? `tapete-${indice + 1}` : 'identificacao-pedido')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 0)
  }

  async function salvar(event: FormEvent) {
    event.preventDefault()
    if (!opcoes || enviandoRef.current || salvo) return
    setTentouSalvar(true)
    setErroEnvio(null)
    if (!avaliacao?.validacao.valido || !avaliacao.validacao.dados) {
      toast.error('Revise os campos indicados antes de salvar.')
      focarPrimeiroErro(errosTodos)
      return
    }

    enviandoRef.current = true
    setEnviando(true)
    try {
      if (!idempotencyKeyRef.current) idempotencyKeyRef.current = gerarIdempotencyKey()
      const resposta = await enviarNovoPedido(montarPayloadCriacao(estado, idempotencyKeyRef.current, opcoes))
      const tapetesAssociados = associarTapetesCriados(estado.tapetes, resposta.tapetes)
      if (!tapetesAssociados) {
        throw { status: 503, codigo: 'ASSOCIACAO_TAPETES_INVALIDA', mensagem: 'O pedido foi salvo, mas os tapetes ainda não puderam ser confirmados. Tente novamente com a mesma chave de envio.' }
      }
      setEstado((atual) => ({ ...atual, tapetes: tapetesAssociados }))
      setSalvo(resposta)
      setAlterado(false)
      toast.success(resposta.reutilizado ? 'Pedido recuperado sem duplicação.' : 'Pedido personalizado salvo.')
      await enviarAnexosIniciais(resposta, tapetesAssociados)
    } catch (erro) {
      const mensagem = ehErroHttpNovoPedido(erro) ? erro.mensagem : 'Falha de rede. Tente novamente com o mesmo pedido.'
      setErroEnvio(mensagem)
      toast.error(mensagem)
    } finally {
      enviandoRef.current = false
      setEnviando(false)
    }
  }

  function chaveErroAnexo(chaveLocal: string, slot: 1 | 2) {
    return `${chaveLocal}:${slot}`
  }

  function atualizarAnexoLocal(chaveLocal: string, anexo: AnexoFormulario | null, slot: 1 | 2) {
    setEstado((atual) => ({
      ...atual,
      tapetes: atual.tapetes.map((tapete) => tapete.chaveLocal === chaveLocal
        ? {
          ...tapete,
          anexos: anexo
            ? [...tapete.anexos.filter((item) => item.slot !== slot), anexo].sort((a, b) => a.slot - b.slot)
            : tapete.anexos.filter((item) => item.slot !== slot),
        }
        : tapete),
    }))
  }

  function registrarErroAnexo(chaveLocal: string, slot: 1 | 2, mensagem: string) {
    setErrosAnexos((atuais) => ({ ...atuais, [chaveErroAnexo(chaveLocal, slot)]: mensagem }))
  }

  function limparErroAnexo(chaveLocal: string, slot: 1 | 2) {
    setErrosAnexos((atuais) => {
      const proximos = { ...atuais }
      delete proximos[chaveErroAnexo(chaveLocal, slot)]
      return proximos
    })
  }

  function tratarErroAnexo(erro: unknown, chaveLocal: string, slot: 1 | 2, ehFalhaEnvio = false) {
    const mensagem = ehErroHttpNovoPedido(erro) ? erro.mensagem : 'Não foi possível concluir a operação agora. Tente novamente.'
    if (ehErroHttpNovoPedido(erro) && erro.status === 409) setConflitoVersionamento(true)
    if (ehFalhaEnvio) setFalhaParcialAnexos(true)
    registrarErroAnexo(chaveLocal, slot, mensagem)
    toast.error(mensagem)
  }

  async function executarOperacaoAnexo(
    operacao: OperacaoAnexo,
    acao: () => Promise<void>,
    ehFalhaEnvio = false
  ) {
    if (operacaoAnexoRef.current || conflitoVersionamento) return
    operacaoAnexoRef.current = true
    setOperacaoAnexo(operacao)
    limparErroAnexo(operacao.chaveLocal, operacao.slot)
    try {
      await acao()
    } catch (erro) {
      tratarErroAnexo(erro, operacao.chaveLocal, operacao.slot, ehFalhaEnvio)
    } finally {
      operacaoAnexoRef.current = false
      setOperacaoAnexo(null)
    }
  }

  async function fazerUpload(tapete: TapeteFormulario, slot: 1 | 2, arquivo: File) {
    if (!salvo || !tapete.tapeteId || tapete.anexos.some((anexo) => anexo.slot === slot)) return
    const erroArquivo = validarArquivoAnexo(arquivo)
    if (erroArquivo) {
      registrarErroAnexo(tapete.chaveLocal, slot, erroArquivo)
      toast.error(erroArquivo)
      return
    }
    await executarOperacaoAnexo({ chaveLocal: tapete.chaveLocal, slot, tipo: 'upload' }, async () => {
      const resposta = await enviarAnexo({
        pedidoId: salvo.pedidoId,
        tapeteId: tapete.tapeteId!,
        slot,
        arquivo,
        expectedVersion: salvo.version,
      })
      atualizarAnexoLocal(tapete.chaveLocal, {
        anexoId: resposta.anexoId,
        slot: resposta.slot,
        nomeOriginal: resposta.nomeOriginal,
        mime: resposta.mime,
        tamanho: resposta.tamanho,
        createdAt: resposta.createdAt ?? null,
      }, slot)
      setSalvo((atual) => atual ? { ...atual, version: resposta.version } : atual)
      setFalhaParcialAnexos(false)
      toast.success(`Anexo do slot ${slot} enviado.`)
    }, true)
  }

  async function abrirAnexo(tapete: TapeteFormulario, anexo: AnexoFormulario) {
    await executarOperacaoAnexo({ chaveLocal: tapete.chaveLocal, slot: anexo.slot, tipo: 'abertura' }, async () => {
      const { url } = await solicitarUrlAnexo(anexo.anexoId)
      const novaAba = window.open(url, '_blank', 'noopener,noreferrer')
      if (!novaAba) toast.error('O navegador bloqueou a nova aba. Permita pop-ups e tente novamente.')
    })
  }

  async function fazerSubstituicao(tapete: TapeteFormulario, anexo: AnexoFormulario, arquivo: File) {
    if (!salvo) return
    const erroArquivo = validarArquivoAnexo(arquivo)
    if (erroArquivo) {
      registrarErroAnexo(tapete.chaveLocal, anexo.slot, erroArquivo)
      toast.error(erroArquivo)
      return
    }
    await executarOperacaoAnexo({ chaveLocal: tapete.chaveLocal, slot: anexo.slot, tipo: 'substituicao' }, async () => {
      const resposta = await substituirAnexo({ anexoId: anexo.anexoId, arquivo, expectedVersion: salvo.version })
      atualizarAnexoLocal(tapete.chaveLocal, {
        anexoId: resposta.anexoId,
        slot: resposta.slot,
        nomeOriginal: resposta.nomeOriginal,
        mime: resposta.mime,
        tamanho: resposta.tamanho,
        createdAt: resposta.createdAt ?? anexo.createdAt,
      }, anexo.slot)
      setSalvo((atual) => atual ? { ...atual, version: resposta.version } : atual)
      toast.success(`Anexo do slot ${anexo.slot} substituído.`)
    }, true)
  }

  async function fazerRemocao(tapete: TapeteFormulario, anexo: AnexoFormulario) {
    if (!salvo) return
    await executarOperacaoAnexo({ chaveLocal: tapete.chaveLocal, slot: anexo.slot, tipo: 'remocao' }, async () => {
      const resposta = await removerAnexoApi({ anexoId: anexo.anexoId, expectedVersion: salvo.version })
      atualizarAnexoLocal(tapete.chaveLocal, null, anexo.slot)
      setSalvo((atual) => atual ? { ...atual, version: resposta.version } : atual)
      toast.success('Anexo removido. A limpeza física será processada com segurança pelo sistema.')
    })
  }

  async function copiarMensagem() {
    if (!avaliacao?.mensagem) return
    try {
      await navigator.clipboard.writeText(avaliacao.mensagem)
      setCopiada(true)
      toast.success('Mensagem copiada.')
    } catch {
      toast.error('Não foi possível copiar a mensagem.')
    }
  }

  function iniciarNovoPedido() {
    for (const tapete of estado.tapetes) {
      for (const anexo of tapete.anexosLocais) revogarPreview(anexo.previewUrl)
    }
    setEstado(criarEstadoInicial(uuidSeguro()))
    idempotencyKeyRef.current = gerarIdempotencyKey()
    setAlterado(false)
    setTentouSalvar(false)
    setCamposTocados(new Set())
    setErroEnvio(null)
    setSalvo(null)
    setOperacaoAnexo(null)
    setErrosAnexos({})
    setFalhaParcialAnexos(false)
    setConflitoVersionamento(false)
    setCopiada(false)
    setConfirmarNovo(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function solicitarNovoPedido() {
    if (possuiUploadPendente) {
      toast.info('Aguarde a operação de anexo terminar antes de iniciar outro pedido.')
      return
    }
    if (alterado && !salvo) setConfirmarNovo(true)
    else iniciarNovoPedido()
  }

  if (carregando) {
    return <CardEstado><Loader2 className="mx-auto mb-3 size-8 animate-spin text-[#00A5E6]" /><p role="status" className="font-medium text-slate-700">Carregando opções do pedido...</p></CardEstado>
  }

  if (erroCarregamento || !opcoes) {
    return (
      <CardEstado>
        <AlertCircle className="mx-auto mb-3 size-8 text-red-500" />
        <p role="alert" className="font-semibold text-slate-800">{erroCarregamento ?? 'Catálogo indisponível.'}</p>
        <Button type="button" variant="outline" className="mt-4 min-h-11" onClick={() => void carregar()}><RefreshCw />Tentar novamente</Button>
      </CardEstado>
    )
  }

  if (opcoes.unidades.length === 0) {
    return <CardEstado><AlertCircle className="mx-auto mb-3 size-8 text-amber-500" /><p role="alert" className="font-semibold text-slate-800">Nenhuma unidade está disponível para seu usuário.</p></CardEstado>
  }

  const formularioBloqueado = enviando || !!salvo

  return (
    <>
      <form onSubmit={salvar} className="space-y-6" noValidate>
        <section id="identificacao-pedido" className="scroll-mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6" aria-labelledby="titulo-identificacao">
          <div className="mb-5 flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl bg-sky-50 text-[#00A5E6]"><Sparkles /></span>
            <div><h2 id="titulo-identificacao" className="text-lg font-bold text-slate-900">Identificação</h2><p className="text-sm text-slate-500">Dados comerciais do novo pedido.</p></div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="unidade" className="mb-1.5 block text-sm font-medium text-slate-700">Unidade *</label>
              <Select disabled={formularioBloqueado} value={estado.unidade} onValueChange={(valor) => { atualizarEstado({ ...estado, unidade: valor as EstadoNovoPedido['unidade'] }); marcarTocado('unidade') }}>
                <SelectTrigger id="unidade" className="h-11 w-full" onBlur={() => marcarTocado('unidade')} aria-invalid={mensagens('unidade').length > 0} aria-describedby={mensagens('unidade').length > 0 ? 'unidade-erro' : undefined}><SelectValue placeholder="Selecione a unidade" /></SelectTrigger>
                <SelectContent>{opcoes.unidades.map((unidade) => <SelectItem key={unidade.chave} value={unidade.chave}>{unidade.nome}</SelectItem>)}</SelectContent>
              </Select>
              {mensagens('unidade')[0] && <p id="unidade-erro" role="alert" className="mt-1 text-sm text-red-600">{mensagens('unidade')[0]}</p>}
            </div>
            <div>
              <label htmlFor="numero-lancamento" className="mb-1.5 block text-sm font-medium text-slate-700">Número de lançamento</label>
              <Input id="numero-lancamento" value={estado.numeroLancamento} onChange={(event) => atualizarEstado({ ...estado, numeroLancamento: event.target.value })} onPaste={colarNumeroLancamento} onBlur={() => marcarTocado('numeroLancamento')} inputMode="numeric" pattern="[0-9]*" maxLength={6} placeholder="Opcional" disabled={formularioBloqueado} aria-invalid={mensagens('numeroLancamento').length > 0} aria-describedby={mensagens('numeroLancamento').length > 0 ? 'numero-lancamento-erro' : undefined} className="h-11" />
              {mensagens('numeroLancamento')[0] && <p id="numero-lancamento-erro" role="alert" className="mt-1 text-sm text-red-600">{mensagens('numeroLancamento')[0]}</p>}
            </div>
            <div>
              <label htmlFor="consultora" className="mb-1.5 block text-sm font-medium text-slate-700">Consultora *</label>
              <Input id="consultora" value={estado.consultora} onChange={(event) => atualizarEstado({ ...estado, consultora: event.target.value })} onBlur={() => marcarTocado('consultora')} maxLength={20} disabled={formularioBloqueado} aria-invalid={mensagens('consultora').length > 0} aria-describedby={mensagens('consultora').length > 0 ? 'consultora-erro' : undefined} className="h-11" />
              {mensagens('consultora')[0] && <p id="consultora-erro" role="alert" className="mt-1 text-sm text-red-600">{mensagens('consultora')[0]}</p>}
            </div>
            <div>
              <label htmlFor="cliente" className="mb-1.5 block text-sm font-medium text-slate-700">Cliente *</label>
              <Input id="cliente" value={estado.cliente} onChange={(event) => atualizarEstado({ ...estado, cliente: event.target.value })} onBlur={() => marcarTocado('cliente')} maxLength={40} disabled={formularioBloqueado} aria-invalid={mensagens('cliente').length > 0} aria-describedby={mensagens('cliente').length > 0 ? 'cliente-erro' : undefined} className="h-11" />
              {mensagens('cliente')[0] && <p id="cliente-erro" role="alert" className="mt-1 text-sm text-red-600">{mensagens('cliente')[0]}</p>}
            </div>
          </div>
        </section>

        <section aria-labelledby="titulo-tapetes" className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div><h2 id="titulo-tapetes" className="text-xl font-bold text-slate-900">Tapetes</h2><p className="text-sm text-slate-500">Revise todos antes de salvar. {estado.tapetes.length} de {LIMITE_TAPETES_POR_PEDIDO}.</p></div>
            <Button type="button" variant="outline" className="min-h-11" disabled={formularioBloqueado || estado.tapetes.length >= LIMITE_TAPETES_POR_PEDIDO} onClick={() => atualizarEstado(adicionarTapete(estado, uuidSeguro()))}><Plus />Adicionar tapete</Button>
          </div>
          {estado.tapetes.map((tapete, indice) => (
            <div key={tapete.chaveLocal}>
              <CardTapete
                tapete={tapete}
                indice={indice}
                total={estado.tapetes.length}
                produtos={opcoes.produtos}
                cores={opcoes.cores}
                erros={erros}
                camposTocados={camposTocados}
                tentouSalvar={tentouSalvar}
                disabled={formularioBloqueado}
                onChange={(proximo) => atualizarTapete(indice, proximo)}
                onMover={(direcao) => atualizarEstado({ ...estado, tapetes: moverItem(estado.tapetes, indice, direcao) })}
                onRemover={() => {
                  tapete.anexosLocais.forEach((item) => revogarPreview(item.previewUrl))
                  atualizarEstado(removerTapete(estado, tapete.chaveLocal))
                }}
                onLimiteCores={() => toast.error('Selecione no máximo 6 cores.')}
                onTocar={marcarTocado}
              />
              {(!salvo || tapete.anexosLocais.length > 0) && (
                <AnexosIniciaisTapete
                  tapete={tapete}
                  ordem={indice + 1}
                  bloqueado={enviando || operacaoAnexo !== null || conflitoVersionamento}
                  onSelecionar={(slot, arquivo) => selecionarAnexoInicial(indice, slot, arquivo)}
                  onRemover={(slot) => removerAnexoInicial(indice, slot)}
                  onReenviar={(slot) => void reenviarAnexoInicial(tapete, slot)}
                />
              )}
            </div>
          ))}
        </section>

        {(erros.length > 0 || avisos.length > 0) && (
          <section aria-live="polite" className="grid gap-3 lg:grid-cols-2">
            {erros.length > 0 && <div className="rounded-xl border border-red-200 bg-red-50 p-4"><h2 className="font-semibold text-red-800">Erros bloqueantes</h2><ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-red-700">{erros.map((erro, indice) => <li key={`${erro.campo}-${erro.codigo}-${indice}`}>{erro.mensagem}</li>)}</ul></div>}
            {avisos.length > 0 && <div className="rounded-xl border border-amber-200 bg-amber-50 p-4"><h2 className="font-semibold text-amber-900">Avisos</h2><ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-800">{avisos.map((aviso, indice) => <li key={`${aviso.campo}-${aviso.codigo}-${indice}`}>{aviso.mensagem}</li>)}</ul></div>}
          </section>
        )}

        <PreviaMensagem mensagem={avaliacao?.mensagem ?? null} copiada={copiada} onCopiar={() => void copiarMensagem()} />

        {erroEnvio && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">{erroEnvio}</div>}

        {salvo && (
          <>
            <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5" aria-labelledby="pedido-salvo-titulo">
              <div className="flex gap-3"><CheckCircle2 className="mt-0.5 size-6 shrink-0 text-emerald-600" /><div><h2 id="pedido-salvo-titulo" className="font-bold text-emerald-900">Pedido salvo</h2><p className="mt-1 text-sm text-emerald-800">Status {salvo.status}; versão {salvo.version}; {salvo.quantidadeTapetes} tapete(s).</p><p className="mt-2 text-sm text-emerald-800">Os dados comerciais foram bloqueados. Agora você pode incluir até dois anexos por tapete.</p></div></div>
            </section>

            {falhaParcialAnexos && (
              <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-medium text-amber-900">
                Pedido salvo. Alguns anexos não foram enviados e podem ser reenviados.
              </div>
            )}

            {conflitoVersionamento && (
              <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
                Este pedido foi alterado por outra pessoa. Recarregue os dados antes de continuar.
              </div>
            )}

            <section className="space-y-4" aria-labelledby="titulo-anexos-pedido">
              <div>
                <h2 id="titulo-anexos-pedido" className="text-xl font-bold text-slate-900">Anexos</h2>
                <p className="text-sm text-slate-500">A versão do pedido é atualizada após cada alteração.</p>
              </div>
              {estado.tapetes.map((tapete, indice) => tapete.tapeteId ? (
                <AnexosTapete
                  key={tapete.chaveLocal}
                  tapete={tapete}
                  ordem={indice + 1}
                  bloqueado={operacaoAnexo !== null || conflitoVersionamento}
                  operacao={operacaoAnexo}
                  errosPorSlot={{
                    1: errosAnexos[chaveErroAnexo(tapete.chaveLocal, 1)],
                    2: errosAnexos[chaveErroAnexo(tapete.chaveLocal, 2)],
                  }}
                  onUpload={(slot, arquivo) => fazerUpload(tapete, slot, arquivo)}
                  onAbrir={(anexo) => abrirAnexo(tapete, anexo)}
                  onSubstituir={(anexo, arquivo) => fazerSubstituicao(tapete, anexo, arquivo)}
                  onRemover={(anexo) => fazerRemocao(tapete, anexo)}
                />
              ) : (
                <div key={tapete.chaveLocal} role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                  Não foi possível associar o tapete {indice + 1} ao pedido. Nenhum anexo pode ser enviado.
                </div>
              ))}
            </section>
          </>
        )}

        <div className="sticky bottom-3 z-10 flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-lg backdrop-blur sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" className="min-h-12" disabled={enviando || possuiUploadPendente} onClick={solicitarNovoPedido}><RefreshCw />Novo pedido</Button>
          <Button type="submit" className="min-h-12" disabled={enviando || !!salvo}>
            {enviando ? <Loader2 className="animate-spin" /> : <Save />}
            {enviando ? 'Salvando...' : salvo ? 'Pedido salvo' : 'Salvar pedido'}
          </Button>
        </div>
      </form>

      <Dialog open={confirmarNovo} onOpenChange={setConfirmarNovo}>
        <DialogContent>
          <DialogHeader><DialogTitle>Descartar dados não salvos?</DialogTitle><DialogDescription>Os campos preenchidos neste pedido serão apagados.</DialogDescription></DialogHeader>
          <DialogFooter><Button type="button" variant="outline" onClick={() => setConfirmarNovo(false)}>Continuar preenchendo</Button><Button type="button" variant="destructive" onClick={iniciarNovoPedido}>Descartar e iniciar novo</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
