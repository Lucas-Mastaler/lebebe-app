'use client'

import { ClipboardEvent, FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { AlertCircle, ArrowRight, CheckCircle2, Package, Plus, RefreshCw, Ruler, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import {
  Alert,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  FormField,
  Input,
  Section,
  Spinner,
} from '@/components/design-system'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { LIMITE_TAPETES_POR_PEDIDO } from '@/lib/pedidos-personalizados'
import { aplicarMascaraTelefoneBR, extrairDigitosTelefone } from '@/lib/atendimento-presencial/telefone'
import { CardTapete } from './CardTapete'
import { AnexosTapete } from './AnexosTapete'
import { AnexosIniciaisTapete } from './AnexosIniciaisTapete'
import { PreviaMensagem } from './PreviaMensagem'
import { AvisoPedidoSalvoFixo } from './AvisoPedidoSalvoFixo'
import { FormularioLebebeExclusive } from './FormularioLebebeExclusive'
import { BarraResumoPedidoPersonalizado } from './BarraResumoPedidoPersonalizado'
import {
  adicionarTapete,
  associarTapetesCriados,
  avaliarFormulario,
  carregarOpcoesNovoPedido,
  criarEstadoInicial,
  criarTapeteVazio,
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
  telefoneComVariedadeMinima,
  validarArquivoAnexo,
  valorTotalTapetesFormatado,
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

type FornecedorPedido = 'moriah_tapetes' | 'lebebe_exclusive'
type DadosIdentificacao = Pick<EstadoNovoPedido, 'unidade' | 'numeroLancamento' | 'consultora' | 'cliente' | 'telefone'>

function validarIdentificacaoLebebeExclusive(dados: DadosIdentificacao) {
  const erros: Array<{ campo: keyof DadosIdentificacao; mensagem: string }> = []
  if (!dados.unidade) erros.push({ campo: 'unidade', mensagem: 'Selecione a unidade.' })
  if (dados.consultora.trim().length < 2) erros.push({ campo: 'consultora', mensagem: 'Informe a consultora.' })
  if (!dados.cliente.trim()) erros.push({ campo: 'cliente', mensagem: 'Informe o cliente.' })
  if (dados.telefone.replace(/\D/g, '').length < 10) erros.push({ campo: 'telefone', mensagem: 'Informe um telefone válido.' })
  if (dados.numeroLancamento && !/^\d{1,6}$/.test(dados.numeroLancamento)) erros.push({ campo: 'numeroLancamento', mensagem: 'Use até 6 dígitos no lançamento.' })
  return erros
}

function uuidSeguro() {
  return crypto.randomUUID()
}

function CardEstado({ children }: { children: React.ReactNode }) {
  return <Card className="p-6 text-center">{children}</Card>
}

function IdentificacaoPedido({
  opcoes,
  dados,
  bloqueado,
  mensagens,
  onChange,
  onTocar,
  onColarNumeroLancamento,
  onColarTelefone,
}: {
  opcoes: OpcoesNovoPedido
  dados: DadosIdentificacao
  bloqueado: boolean
  mensagens: (campo: string) => string[]
  onChange: (proximos: DadosIdentificacao) => void
  onTocar: (campo: string) => void
  onColarNumeroLancamento: (event: ClipboardEvent<HTMLInputElement>) => void
  onColarTelefone: (event: ClipboardEvent<HTMLInputElement>) => void
}) {
  return (
    <div id="identificacao-pedido" className="scroll-mt-6">
      <Section tone="section-1" icon={<Sparkles className="size-4" />} title="Identificação" description="Dados comerciais do novo pedido.">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <FormField id="unidade" label="Unidade" required error={mensagens('unidade')[0]}>
            {(f) => (
              <Select disabled={bloqueado} value={dados.unidade} onValueChange={(valor) => { onChange({ ...dados, unidade: valor as EstadoNovoPedido['unidade'] }); onTocar('unidade') }}>
                <SelectTrigger id={f.id} className="h-11 w-full" onBlur={() => onTocar('unidade')} aria-invalid={f['aria-invalid']} aria-describedby={f['aria-describedby']}><SelectValue placeholder="Selecione a unidade" /></SelectTrigger>
                <SelectContent>{opcoes.unidades.map((unidade) => <SelectItem key={unidade.chave} value={unidade.chave}>{unidade.nome}</SelectItem>)}</SelectContent>
              </Select>
            )}
          </FormField>
          <FormField id="consultora" label="Consultora" required error={mensagens('consultora')[0]}>
            {(f) => <Input {...f} value={dados.consultora} onChange={(event) => onChange({ ...dados, consultora: event.target.value })} onBlur={() => onTocar('consultora')} maxLength={20} disabled={bloqueado} className="h-11" />}
          </FormField>
          <FormField id="numero-lancamento" label="Número de lançamento" error={mensagens('numeroLancamento')[0]}>
            {(f) => <Input {...f} value={dados.numeroLancamento} onChange={(event) => onChange({ ...dados, numeroLancamento: event.target.value })} onPaste={onColarNumeroLancamento} onBlur={() => onTocar('numeroLancamento')} inputMode="numeric" pattern="[0-9]*" maxLength={6} placeholder="Opcional" disabled={bloqueado} className="h-11" />}
          </FormField>
          <FormField id="cliente" label="Cliente" required error={mensagens('cliente')[0]}>
            {(f) => <Input {...f} value={dados.cliente} onChange={(event) => onChange({ ...dados, cliente: event.target.value })} onBlur={() => onTocar('cliente')} maxLength={40} disabled={bloqueado} className="h-11" />}
          </FormField>
          <FormField id="telefone" label="Telefone do cliente" required error={mensagens('telefone')[0]}>
            {(f) => <Input {...f} value={dados.telefone} onChange={(event) => onChange({ ...dados, telefone: aplicarMascaraTelefoneBR(event.target.value) })} onPaste={onColarTelefone} onBlur={() => onTocar('telefone')} inputMode="tel" autoComplete="tel" placeholder="(41) 99999-9999" disabled={bloqueado} className="h-11" />}
          </FormField>
        </div>
      </Section>
    </div>
  )
}

const OPCOES_FORNECEDOR: ReadonlyArray<{ chave: FornecedorPedido; nome: string; descricao: string; Icone: typeof Sparkles }> = [
  { chave: 'moriah_tapetes', nome: 'Moriah Tapetes', descricao: 'Tapetes personalizados', Icone: Ruler },
  { chave: 'lebebe_exclusive', nome: 'Lebebe Exclusive', descricao: 'Produtos de catálogo', Icone: Package },
]

function EscolhaFornecedor({ fornecedorSelecionado, bloqueado, onEscolher }: { fornecedorSelecionado: FornecedorPedido | null; bloqueado: boolean; onEscolher: (fornecedor: FornecedorPedido) => void }) {
  return (
    <Card>
      <CardContent>
        <h2 id="titulo-fornecedor" className="text-lg font-bold text-slate-900">Escolha o fornecedor</h2>
        {fornecedorSelecionado === null && <p className="mt-1 text-sm text-slate-500">Selecione um fornecedor para continuar o preenchimento do pedido.</p>}
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {OPCOES_FORNECEDOR.map(({ chave, nome, descricao, Icone }) => {
            const ativo = fornecedorSelecionado === chave
            return (
              <Button
                key={chave}
                type="button"
                variant={ativo ? 'primary' : 'secondary'}
                className="min-h-20 justify-start gap-3 px-4 py-3 text-left"
                aria-pressed={ativo}
                disabled={bloqueado}
                onClick={() => onEscolher(chave)}
              >
                <span className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${ativo ? 'bg-white/15 text-white' : 'bg-primary/10 text-primary'}`}><Icone className="size-5" aria-hidden="true" /></span>
                <span className="flex min-w-0 flex-col">
                  <span className="text-base font-semibold">{nome}</span>
                  <span className={`text-xs font-normal ${ativo ? 'text-white/80' : 'text-slate-500'}`}>{descricao}</span>
                </span>
                {ativo && <CheckCircle2 className="ml-auto size-5 shrink-0" aria-hidden="true" />}
              </Button>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

export default function FormularioNovoPedido() {
  const [opcoes, setOpcoes] = useState<OpcoesNovoPedido | null>(null)
  const [fornecedorSelecionado, setFornecedorSelecionado] = useState<FornecedorPedido | null>(null)
  const [trocaFornecedorPendente, setTrocaFornecedorPendente] = useState<FornecedorPedido | null>(null)
  const [exclusiveTemDadosEspecificos, setExclusiveTemDadosEspecificos] = useState(false)
  const [exclusiveBloqueiaTroca, setExclusiveBloqueiaTroca] = useState(false)
  const [exclusiveInstancia, setExclusiveInstancia] = useState(0)
  const [carregando, setCarregando] = useState(true)
  const [erroCarregamento, setErroCarregamento] = useState<string | null>(null)
  const [estado, setEstado] = useState<EstadoNovoPedido>(() => criarEstadoInicial('tapete-inicial'))
  const [alterado, setAlterado] = useState(false)
  const [tentouSalvar, setTentouSalvar] = useState(false)
  const [tentouSalvarExclusive, setTentouSalvarExclusive] = useState(false)
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
  const carregamentoOpcoesIniciadoRef = useRef(false)
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

  useEffect(() => {
    if (carregamentoOpcoesIniciadoRef.current) return
    carregamentoOpcoesIniciadoRef.current = true
    void carregar()
  }, [carregar])

  const avaliacao = useMemo(
    () => opcoes ? avaliarFormulario(estado, opcoes) : null,
    [estado, opcoes]
  )
  const errosTodos = avaliacao?.validacao.erros ?? []
  const erros = errosTodos.filter((item) => tentouSalvar || camposTocados.has(item.campo))
  const errosIdentificacaoExclusive = fornecedorSelecionado === 'lebebe_exclusive' && tentouSalvarExclusive
    ? validarIdentificacaoLebebeExclusive(estado)
    : []
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

  function handleAdicionarTapete() {
    atualizarEstado(adicionarTapete(estado, uuidSeguro()))
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
    const base = erros.filter((item) => item.campo === campo).map((item) => item.mensagem)
    const errosExclusive = errosIdentificacaoExclusive.filter((item) => item.campo === campo).map((item) => item.mensagem)
    if (errosExclusive.length > 0) return [...base, ...errosExclusive]
    if (
      campo === 'telefone'
      && base.length === 0
      && (tentouSalvar || camposTocados.has('telefone'))
      && !telefoneComVariedadeMinima(estado.telefone)
    ) {
      return ['Telefone inválido.']
    }
    return base
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

  function colarTelefone(event: ClipboardEvent<HTMLInputElement>) {
    const texto = event.clipboardData.getData('text')
    if (extrairDigitosTelefone(texto).length <= 11) return
    event.preventDefault()
    atualizarEstado({ ...estado, telefone: texto })
    marcarTocado('telefone')
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
    if (!avaliacao?.validacao.valido || !avaliacao.validacao.dados || !telefoneComVariedadeMinima(estado.telefone)) {
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
    setExclusiveInstancia((atual) => atual + 1)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function solicitarNovoPedido() {
    if (possuiUploadPendente) {
      toast.info('Aguarde a operação de anexo terminar antes de iniciar outro pedido.')
      return
    }
    const exclusiveComAlteracaoNaoSalva = fornecedorSelecionado === 'lebebe_exclusive' && exclusiveTemDadosEspecificos && !exclusiveBloqueiaTroca
    if ((alterado && !salvo) || exclusiveComAlteracaoNaoSalva) setConfirmarNovo(true)
    else iniciarNovoPedido()
  }

  function possuiDadosEspecificosMoriah() {
    const tapeteVazio = criarTapeteVazio('referencia')
    return estado.tapetes.some((tapete) => (
      tapete.tapeteId !== null
      || tapete.anexos.length > 0
      || tapete.anexosLocais.length > 0
      || tapete.existeNoCatalogo !== null
      || tapete.identicoReferencia !== null
      || tapete.dimensao1Metros !== ''
      || tapete.dimensao2Metros !== ''
      || tapete.corIds.length > 0
      || tapete.nomeColecaoCatalogo !== ''
      || tapete.referenciaCatalogo !== ''
      || tapete.observacoes !== ''
      || tapete.formato !== tapeteVazio.formato
      || tapete.tipo !== tapeteVazio.tipo
    ))
  }

  function limparDadosEspecificosMoriah() {
    for (const tapete of estado.tapetes) {
      for (const anexo of tapete.anexosLocais) revogarPreview(anexo.previewUrl)
    }
    setEstado((atual) => ({ ...atual, tapetes: [criarTapeteVazio(uuidSeguro())] }))
    setTentouSalvar(false)
    setCamposTocados(new Set())
    setErroEnvio(null)
    setErrosAnexos({})
    setFalhaParcialAnexos(false)
    setConflitoVersionamento(false)
  }

  function efetivarTrocaFornecedor(proximoFornecedor: FornecedorPedido) {
    if (fornecedorSelecionado === 'moriah_tapetes') limparDadosEspecificosMoriah()
    setTentouSalvarExclusive(false)
    setFornecedorSelecionado(proximoFornecedor)
    setTrocaFornecedorPendente(null)
  }

  function solicitarTrocaFornecedor(proximoFornecedor: FornecedorPedido) {
    if (proximoFornecedor === fornecedorSelecionado) return
    if (fornecedorSelecionado === null) {
      setFornecedorSelecionado(proximoFornecedor)
      return
    }
    const possuiDadosEspecificos = fornecedorSelecionado === 'moriah_tapetes'
      ? possuiDadosEspecificosMoriah()
      : exclusiveTemDadosEspecificos
    if (possuiDadosEspecificos) {
      setTrocaFornecedorPendente(proximoFornecedor)
      return
    }
    efetivarTrocaFornecedor(proximoFornecedor)
  }

  if (carregando) {
    return <CardEstado><div className="mb-3 flex justify-center"><Spinner label="Carregando opções do pedido" /></div><p role="status" className="font-medium text-slate-700">Carregando opções do pedido...</p></CardEstado>
  }

  if (erroCarregamento || !opcoes) {
    return (
      <CardEstado>
        <AlertCircle className="mx-auto mb-3 size-8 text-destructive" />
        <p role="alert" className="font-semibold text-slate-800">{erroCarregamento ?? 'Catálogo indisponível.'}</p>
        <Button type="button" variant="secondary" className="mt-4 min-h-11" onClick={() => void carregar()}><RefreshCw />Tentar novamente</Button>
      </CardEstado>
    )
  }

  if (opcoes.unidades.length === 0) {
    return <CardEstado><AlertCircle className="mx-auto mb-3 size-8 text-amber-500" /><p role="alert" className="font-semibold text-slate-800">Nenhuma unidade está disponível para seu usuário.</p></CardEstado>
  }

  const formularioBloqueado = enviando || !!salvo

  const identificacao = (
    <IdentificacaoPedido
      opcoes={opcoes}
      dados={estado}
      bloqueado={formularioBloqueado || exclusiveBloqueiaTroca}
      mensagens={mensagens}
      onChange={(dados) => atualizarEstado({ ...estado, ...dados })}
      onTocar={marcarTocado}
      onColarNumeroLancamento={colarNumeroLancamento}
      onColarTelefone={colarTelefone}
    />
  )

  const escolhaFornecedor = <EscolhaFornecedor fornecedorSelecionado={fornecedorSelecionado} bloqueado={formularioBloqueado || exclusiveBloqueiaTroca} onEscolher={solicitarTrocaFornecedor} />

  if (fornecedorSelecionado === null) {
    return <div className="space-y-6">{identificacao}{escolhaFornecedor}</div>
  }

  if (fornecedorSelecionado === 'lebebe_exclusive') {
    return (
      <>
        <div className="space-y-6">
          {identificacao}
          {escolhaFornecedor}
          <FormularioLebebeExclusive
            key={exclusiveInstancia}
            opcoes={opcoes}
            identificacaoExterna={estado}
            ocultarIdentificacao
            onDadosEspecificosChange={setExclusiveTemDadosEspecificos}
            onBloqueioTrocaFornecedorChange={setExclusiveBloqueiaTroca}
            onValidacaoIdentificacaoInvalida={() => {
              setTentouSalvarExclusive(true)
              focarPrimeiroErro([])
            }}
            onNovoPedido={solicitarNovoPedido}
          />
        </div>
        <Dialog open={confirmarNovo} onOpenChange={setConfirmarNovo}>
          <DialogContent>
            <DialogHeader title="Descartar dados não salvos?" description="Os campos preenchidos neste pedido serão apagados." />
            <DialogFooter><Button type="button" variant="secondary" onClick={() => setConfirmarNovo(false)}>Continuar preenchendo</Button><Button type="button" variant="destructive" onClick={iniciarNovoPedido}>Descartar e iniciar novo</Button></DialogFooter>
          </DialogContent>
        </Dialog>
        <Dialog open={trocaFornecedorPendente !== null} onOpenChange={(aberto) => { if (!aberto) setTrocaFornecedorPendente(null) }}>
          <DialogContent>
            <DialogHeader title="Trocar fornecedor?" description="Trocar o fornecedor limpará os dados específicos já preenchidos. Deseja continuar?" />
            <DialogFooter><Button type="button" variant="secondary" onClick={() => setTrocaFornecedorPendente(null)}>Cancelar</Button><Button type="button" onClick={() => trocaFornecedorPendente && efetivarTrocaFornecedor(trocaFornecedorPendente)}>Continuar</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    )
  }

  return (
    <>
      <form onSubmit={salvar} className="space-y-6" noValidate>
        {identificacao}
        {escolhaFornecedor}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Ruler className="size-5" aria-hidden="true" /></span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-primary">Moriah Tapetes</p>
              <h2 id="titulo-tapetes" className="text-base font-bold text-slate-900 sm:text-lg">Tapetes personalizados</h2>
            </div>
          </div>
          <Button type="button" variant="secondary" className="min-h-11" disabled={formularioBloqueado || estado.tapetes.length >= LIMITE_TAPETES_POR_PEDIDO} onClick={handleAdicionarTapete}><Plus />Adicionar tapete</Button>
        </div>
        <section aria-labelledby="titulo-tapetes" className="space-y-4">
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
          <Button type="button" variant="secondary" className="min-h-11" disabled={formularioBloqueado || estado.tapetes.length >= LIMITE_TAPETES_POR_PEDIDO} onClick={handleAdicionarTapete}><Plus />Adicionar tapete</Button>
        </section>

        {(erros.length > 0 || avisos.length > 0) && (
          <section aria-live="polite" className="grid gap-3 lg:grid-cols-2">
            {erros.length > 0 && <Alert tone="danger" title="Erros bloqueantes"><ul className="list-disc space-y-1 pl-5">{erros.map((erro, indice) => <li key={`${erro.campo}-${erro.codigo}-${indice}`}>{erro.mensagem}</li>)}</ul></Alert>}
            {avisos.length > 0 && <Alert tone="warning" title="Avisos"><ul className="list-disc space-y-1 pl-5">{avisos.map((aviso, indice) => <li key={`${aviso.campo}-${aviso.codigo}-${indice}`}>{aviso.mensagem}</li>)}</ul></Alert>}
          </section>
        )}

        <PreviaMensagem mensagem={avaliacao?.mensagem ?? null} copiada={copiada} onCopiar={() => void copiarMensagem()} orientacaoObservacoes />

        {erroEnvio && <Alert tone="danger">{erroEnvio}</Alert>}

        {salvo && (
          <>
            <Alert tone="success" title="Pedido salvo">
              <p>Status {salvo.status}; versão {salvo.version}; {salvo.quantidadeTapetes} tapete(s).</p>
              <p className="mt-2">Os dados comerciais foram bloqueados. Agora você pode incluir até dois anexos por tapete.</p>
              <Button asChild type="button" variant="secondary" className="mt-4 min-h-10">
                <Link href="/pedidos-personalizados">Ir para a gestão de pedidos<ArrowRight /></Link>
              </Button>
            </Alert>

            {falhaParcialAnexos && (
              <Alert tone="warning">Pedido salvo. Alguns anexos não foram enviados e podem ser reenviados.</Alert>
            )}

            {conflitoVersionamento && (
              <Alert tone="danger">Este pedido foi alterado por outra pessoa. Recarregue os dados antes de continuar.</Alert>
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
                <Alert key={tapete.chaveLocal} tone="danger">Não foi possível associar o tapete {indice + 1} ao pedido. Nenhum anexo pode ser enviado.</Alert>
              ))}
            </section>
          </>
        )}

        <div className="sticky bottom-0 z-20 flex flex-col gap-2">
          <AvisoPedidoSalvoFixo
            disparo={Boolean(salvo)}
            titulo="Pedido salvo"
            mensagem="O pedido foi salvo com sucesso. Você pode ir para a gestão de pedidos personalizados."
          />

          <BarraResumoPedidoPersonalizado
            quantidadeItens={estado.tapetes.length}
            totalFormatado={valorTotalTapetesFormatado(estado.tapetes, opcoes.produtos)}
            salvando={enviando}
            podeSalvar={!enviando && !salvo}
            rotuloSalvar={enviando ? 'Salvando...' : salvo ? 'Pedido salvo' : 'Salvar orçamento'}
            onNovoPedido={solicitarNovoPedido}
            bloqueadoNovoPedido={enviando || possuiUploadPendente}
          />
        </div>
      </form>

      <Dialog open={confirmarNovo} onOpenChange={setConfirmarNovo}>
        <DialogContent>
          <DialogHeader title="Descartar dados não salvos?" description="Os campos preenchidos neste pedido serão apagados." />
          <DialogFooter><Button type="button" variant="secondary" onClick={() => setConfirmarNovo(false)}>Continuar preenchendo</Button><Button type="button" variant="destructive" onClick={iniciarNovoPedido}>Descartar e iniciar novo</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={trocaFornecedorPendente !== null} onOpenChange={(aberto) => { if (!aberto) setTrocaFornecedorPendente(null) }}>
        <DialogContent>
          <DialogHeader title="Trocar fornecedor?" description="Trocar o fornecedor limpará os dados específicos já preenchidos. Deseja continuar?" />
          <DialogFooter><Button type="button" variant="secondary" onClick={() => setTrocaFornecedorPendente(null)}>Cancelar</Button><Button type="button" onClick={() => trocaFornecedorPendente && efetivarTrocaFornecedor(trocaFornecedorPendente)}>Continuar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
