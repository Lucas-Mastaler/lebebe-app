'use client'

import { ResumoProdutos } from '@/components/atendimento-presencial/ProdutosAtendimento'
import { ResumoEssenciais } from './HistoricoEssenciais'
import { VendaSgiAtendimento } from './VendaSgiAtendimento'
import { Alert, Badge, Button, Dialog, DialogBody, DialogContent, DialogHeader, EmptyState, Section, Spinner } from '@/components/design-system'
import { descreverIdadeAproximada } from '@/lib/atendimento-presencial/idade-aproximada'
import { PRODUTOS_ESSENCIAIS } from '@/lib/atendimento-presencial/essenciais'
import { formatarDataISOParaInput, formatarViradaCartao, getDepartamentoLabel, getMotivoLabel, type DepartamentoInteresse } from '@/lib/atendimento-presencial/ficha-schema'
import { descreverContratoHistorico, getMotivoVisitaLabel, normalizarObservacoesRegistro, registroNaoCliente, registroSemTelefone, situacaoVendaRegistro, type RegistroAtendimentoDetalheDTO, type RegistroAtendimentoResumoDTO } from '@/lib/atendimento-presencial/registros'
import { Baby, CalendarDays, ClipboardList, Heart, History, Package, Pencil, Phone, UserRound } from 'lucide-react'

export type DetalheAtendimentoLoadingSummary = Pick<RegistroAtendimentoResumoDTO, 'clienteNome' | 'consultoraNomeManual' | 'unidadeNome' | 'iniciadoEm' | 'resultadoAtendimento' | 'versaoFluxo' | 'tipoAtendimento'>

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  detalhe: RegistroAtendimentoDetalheDTO | null
  carregando: boolean
  erro: string | null
  resumoCarregamento?: DetalheAtendimentoLoadingSummary | null
  unidadeNome?: string
  leituraSomente?: boolean
  onEditar?: (detalhe: RegistroAtendimentoDetalheDTO) => void
  onHistoricoCliente?: (detalhe: RegistroAtendimentoDetalheDTO) => void
  mensagemEdicao?: string | null
  edicaoAberta?: boolean
}

function formatarData(valor: string | null | undefined) {
  if (!valor) return 'Não informado'
  return new Date(valor).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function rotuloPerfilHistorico(perfil?: string | null, role?: string | null) {
  const rotulos: Record<string, string> = {
    consultora: 'Consultora',
    supervisora_loja: 'Supervisora de loja',
    gestao: 'Gestão',
    superadmin: 'Superadministrador',
    user: 'Usuário',
  }
  const valor = perfil?.trim()
  if (valor) return { titulo: 'Perfil do usuário:', valor: rotulos[valor] ?? valor.replaceAll('_', ' ') }

  const funcao = role?.trim()
  if (funcao) return { titulo: 'Função no sistema:', valor: rotulos[funcao] ?? funcao.replaceAll('_', ' ') }
  return { titulo: 'Perfil do usuário:', valor: 'Não informado' }
}

function LinhaHistorico({ texto }: { texto: string }) {
  const separador = texto.indexOf(':')
  if (separador < 0) return <>{texto}</>
  return <><strong>{texto.slice(0, separador + 1)}</strong>{texto.slice(separador + 1)}</>
}

export function DetalhesAtendimentoDialog({ open, onOpenChange, detalhe, carregando, erro, resumoCarregamento, unidadeNome, leituraSomente = false, onEditar, onHistoricoCliente, mensagemEdicao, edicaoAberta = false }: Props) {
  const atendimento = detalhe?.atendimento
  const viradaCartao = formatarViradaCartao(atendimento?.viradaCartaoDia, atendimento?.viradaCartaoMes)
  const naoCliente = atendimento ? registroNaoCliente(atendimento) : resumoCarregamento ? registroNaoCliente(resumoCarregamento) : false
  const titulo = detalhe?.cliente?.nome ? `Atendimento — ${detalhe.cliente.nome}` : detalhe ? 'Atendimento — Não cliente' : resumoCarregamento?.clienteNome ? `Atendimento — ${resumoCarregamento.clienteNome}` : 'Atendimento'

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="w-[96vw] max-w-[96vw] max-h-[90dvh] sm:max-w-[72rem]">
      <DialogHeader title={titulo} description="Dados salvos deste atendimento" />
      <DialogBody className="space-y-4 bg-slate-50/70 text-sm text-slate-700 sm:space-y-5">
        {erro && <Alert tone="danger">Não foi possível carregar os dados completos: {erro}</Alert>}
        {carregando && <div className="space-y-4">
          {resumoCarregamento && <div className="rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/10 via-white to-info/10 p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wide text-primary">Resumo do atendimento</p><p className="mt-1 text-lg font-bold text-slate-950">{resumoCarregamento.clienteNome}</p></div><Badge tone={registroNaoCliente(resumoCarregamento) ? 'neutral' : situacaoVendaRegistro(resumoCarregamento.resultadoAtendimento).tone}>{registroNaoCliente(resumoCarregamento) ? 'Não cliente' : situacaoVendaRegistro(resumoCarregamento.resultadoAtendimento).label}</Badge></div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3"><Info label="Consultora do atendimento" value={resumoCarregamento.consultoraNomeManual ?? 'Não informada'} /><Info label="Filial" value={resumoCarregamento.unidadeNome} /><Info label="Início" value={formatarData(resumoCarregamento.iniciadoEm)} /></div>
          </div>}
          <div role="status" className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 text-slate-600"><Spinner label="Carregando dados completos do atendimento" /><span>Buscando ficha, interesses e histórico…</span></div>
        </div>}
        {!carregando && !detalhe && !erro && <EmptyState icon={<ClipboardList className="size-5" aria-hidden="true" />} title="Nenhum atendimento selecionado" description="Selecione um atendimento para consultar os dados salvos." />}
        {!carregando && detalhe && <>
          <div className="rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/10 via-white to-info/10 p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wide text-primary">Resumo do atendimento</p><p className="mt-1 text-lg font-bold text-slate-950">{detalhe.cliente?.nome ?? 'Atendimento sem cliente vinculado'}</p></div><div className="flex flex-wrap gap-2"><Badge tone={naoCliente ? 'neutral' : situacaoVendaRegistro(atendimento!.resultadoAtendimento).tone}>{naoCliente ? 'Não cliente' : situacaoVendaRegistro(atendimento!.resultadoAtendimento).label}</Badge>{!naoCliente && <Badge tone="brand">Cliente</Badge>}</div></div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3"><Info label="Consultora do atendimento" value={atendimento!.consultoraNomeManual ?? 'Não informada'} /><Info label="Filial" value={unidadeNome ?? atendimento!.unidadeId} /><Info label="Início" value={formatarData(atendimento!.iniciadoEm)} /></div>
            <div className="mt-3 flex flex-wrap items-center gap-2">{atendimento!.numeroLancamento && <Badge tone="info">Lançamento {atendimento!.numeroLancamento}</Badge>}{formatarViradaCartao(atendimento!.viradaCartaoDia, atendimento!.viradaCartaoMes) && <Badge tone="neutral">Virada do cartão · {formatarViradaCartao(atendimento!.viradaCartaoDia, atendimento!.viradaCartaoMes)}</Badge>}<span className="text-xs text-slate-500">Salvo em {formatarData(atendimento!.concluidoEm)}</span></div>
            {!leituraSomente && <div className="mt-4 flex flex-wrap items-center gap-3">{detalhe.podeEditar && onEditar ? <Button type="button" onClick={() => onEditar(detalhe)}><Pencil className="size-4" aria-hidden="true" />Editar atendimento</Button> : <Alert tone="info" className="py-2">{detalhe.motivoBloqueio ?? 'Você não possui permissão para editar este atendimento.'}</Alert>}{mensagemEdicao && !edicaoAberta && <Alert tone="success" className="py-2">{mensagemEdicao}</Alert>}</div>}
          </div>
          <div className="columns-1 gap-4 xl:columns-2">
            {!naoCliente && (detalhe.vendaSgi || Object.keys(detalhe.diagnosticosSgi ?? {}).length > 0) && <VendaSgiAtendimento venda={detalhe.vendaSgi} diagnosticos={detalhe.diagnosticosSgi} />}
            {naoCliente ? <Section className="mb-4 inline-block w-full break-inside-avoid" title="Dados da visita" description="Informações registradas pela consultora" icon={<CalendarDays className="size-4" aria-hidden="true" />} tone="section-1"><div className="rounded-lg border border-white bg-white/80 p-3"><p className="text-xs font-semibold text-slate-500">Motivo da visita</p><p className="mt-1 font-semibold text-slate-900">{getMotivoVisitaLabel(atendimento!.motivoVisita)}</p>{atendimento!.motivoVisita === 'outros' && atendimento!.motivoVisitaOutro && <p className="mt-1 text-sm text-slate-700">{atendimento!.motivoVisitaOutro}</p>}</div></Section> : <Section className="mb-4 inline-block w-full break-inside-avoid" title="Cliente" description="Cadastro vinculado ao atendimento" icon={<UserRound className="size-4" aria-hidden="true" />} tone="section-1">{registroSemTelefone({ ...atendimento!, clienteTelefone: detalhe.cliente?.telefone ?? null }) && <Alert tone="warning" title="Sem telefone cadastrado" />}{detalhe.cliente ? <><p className="text-base font-semibold text-slate-950">{detalhe.cliente.nome}</p><p className="flex items-center gap-2 text-slate-600"><Phone className="size-4 text-slate-400" aria-hidden="true" />{detalhe.cliente.telefone ?? 'Sem telefone'}</p>{onHistoricoCliente && !leituraSomente && <Button type="button" variant="secondary" onClick={() => onHistoricoCliente(detalhe)}><History className="size-4" aria-hidden="true" />Ver histórico da cliente</Button>}</> : <p className="text-slate-600">Cliente não localizada.</p>}</Section>}
            {!naoCliente && detalhe.criancas.length > 0 && <Section className="mb-4 inline-block w-full break-inside-avoid" title="Crianças" description={`${detalhe.criancas.length} vinculada${detalhe.criancas.length === 1 ? '' : 's'} à ficha`} icon={<Baby className="size-4" aria-hidden="true" />} tone="section-2"><div className="grid gap-2 sm:grid-cols-2">{detalhe.criancas.map(crianca => <article key={crianca.id} className="rounded-xl border border-white bg-white/85 p-3 shadow-sm"><p className="font-semibold text-slate-950">{crianca.nome || (crianca.nome_nao_informado ? 'Nome não informado' : crianca.situacao)}</p>{crianca.parentesco_vinculo && <p className="mt-1 text-sm text-slate-600"><strong>Parentesco:</strong> {crianca.parentesco_vinculo}</p>}{crianca.data_referencia_nascimento ? <div className="mt-2 rounded-lg bg-sky-50 px-3 py-2"><p className="font-semibold text-slate-900">{descreverIdadeAproximada(crianca.data_referencia_nascimento)}</p><p className="text-xs text-slate-600">Referência estimada: {formatarDataISOParaInput(crianca.data_referencia_nascimento)}</p></div> : <p className="mt-1 text-sm text-slate-600">{crianca.idade_valor ? `Idade informada: ${crianca.idade_valor} ${crianca.idade_unidade}` : crianca.data_prevista_nascimento ? `Previsão informada: ${formatarDataISOParaInput(crianca.data_prevista_nascimento)}` : crianca.sexo || 'Sem detalhe adicional'}</p>}</article>)}</div></Section>}
            {!!detalhe.essenciais?.length && <div className="mb-4 inline-block w-full break-inside-avoid"><ResumoEssenciais itens={detalhe.essenciais} /></div>}
            {!naoCliente && <Section className="mb-4 inline-block w-full break-inside-avoid" title="Departamentos e produtos" description="Interesses registrados no atendimento" icon={<Package className="size-4" aria-hidden="true" />} tone="section-3"><div><p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Departamentos</p><div className="flex flex-wrap gap-2">{detalhe.departamentos.length ? detalhe.departamentos.map(item => <Badge key={item.id} tone="brand">{getDepartamentoLabel(item.departamento as DepartamentoInteresse)}</Badge>) : <p className="text-slate-500">Nenhum departamento informado.</p>}</div></div><ResumoProdutos produtos={detalhe.produtosInteresse.map(p => ({ descricao: p.descricao, quantidade: p.quantidade ?? null, vendido: p.vendido ?? null }))} versaoProdutos={atendimento!.versaoProdutos} /></Section>}
            <Section className="mb-4 inline-block w-full break-inside-avoid" title="Observações" description="Anotações registradas neste atendimento" icon={<ClipboardList className="size-4" aria-hidden="true" />} tone="section-1">{atendimento!.observacaoNaoFechamento != null && <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-3"><p className="text-xs font-semibold text-amber-900">Observação de não fechamento</p><p className="mt-1 whitespace-pre-wrap text-slate-700">{atendimento!.observacaoNaoFechamento || 'Sem observação'}</p></div>}<p className="whitespace-pre-wrap rounded-lg border border-white bg-white/80 p-3 text-slate-700">{normalizarObservacoesRegistro(atendimento!) ?? 'Sem observações'}</p></Section>
            {!naoCliente && <Section className="mb-4 inline-block w-full break-inside-avoid" title="Motivos" description="Razões registradas para o resultado" icon={<Heart className="size-4" aria-hidden="true" />} tone="section-2">{detalhe.motivos.length > 0 ? <div className="flex flex-wrap gap-2">{detalhe.motivos.map(item => {
              const rotulo = `${getMotivoLabel(item.motivo)}${item.motivo === 'virada_cartao' && viradaCartao ? ` (${viradaCartao})` : ''}`
              return <Badge key={item.id} tone="warning">{item.complemento ? `${rotulo}: ${item.complemento}` : rotulo}</Badge>
            })}</div> : <p className="text-slate-500">Nenhum motivo adicional informado.</p>}</Section>}
            {detalhe.historico.length > 0 && <Section className="mb-4 inline-block w-full break-inside-avoid" title="Histórico" description={`${detalhe.historico.length} registro${detalhe.historico.length === 1 ? '' : 's'} de alteração`} icon={<History className="size-4" aria-hidden="true" />} tone="section-3"><div className="space-y-3 border-l-2 border-primary/20 pl-4">{detalhe.historico.map(item => { const camposBrutos = Array.isArray(item.snapshot?.camposAlterados) ? item.snapshot.camposAlterados : []; const campos = camposBrutos.map(campo => campo === 'produtosEssenciais' ? 'Produtos essenciais' : String(campo)).join(', ') || null; const editado = item.acao === 'editado_concluido'; const acesso = rotuloPerfilHistorico(item.perfil, item.role); return <article key={item.id} className="relative rounded-xl border border-slate-200 bg-white p-3 shadow-sm before:absolute before:-left-[1.35rem] before:top-4 before:size-2.5 before:rounded-full before:border-2 before:border-primary before:bg-white"><div className="flex flex-wrap items-center justify-between gap-2"><Badge tone={editado ? 'info' : 'success'}>{editado ? 'Atendimento editado' : 'Atendimento concluído'}</Badge><time className="text-xs text-slate-500">{formatarData(item.created_at)}</time></div><p className="mt-2 text-xs text-slate-600"><strong>{acesso.titulo}</strong> {acesso.valor}</p>{campos && <p className="mt-1 text-sm"><strong>Campos alterados:</strong> {campos}</p>}{item.essenciaisAlterados?.map((alteracao, index) => { const nomeCrianca = detalhe.essenciais?.find(snapshot => snapshot.criancaId === alteracao.criancaId)?.nome || 'Criança'; const nomeProduto = PRODUTOS_ESSENCIAIS[alteracao.produto as keyof typeof PRODUTOS_ESSENCIAIS] ?? alteracao.produto; const anterior = `${alteracao.respostaAnterior === 'sim' ? 'Sim' : 'Não'}${alteracao.confirmadaAnterior ? ' confirmado' : ' (não confirmado)'}`; const novo = alteracao.respostaAnterior === alteracao.respostaNova ? `${alteracao.respostaNova === 'sim' ? 'Sim' : 'Não'} reconfirmado` : alteracao.respostaNova === 'sim' ? 'Sim' : 'Não'; return <p key={`${alteracao.criancaId}:${alteracao.produto}:${index}`} className="mt-1 rounded-lg bg-pink-50 px-3 py-2 text-sm text-slate-700"><strong>{nomeCrianca} · {nomeProduto}:</strong> {anterior} → {novo}</p> })}{descreverContratoHistorico(item.snapshot).map((linha, index) => <p key={index} className="mt-1 whitespace-pre-wrap text-sm text-slate-600"><LinhaHistorico texto={linha} /></p>)}</article> })}</div></Section>}
          </div>
        </>}
      </DialogBody>
    </DialogContent>
  </Dialog>
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-white bg-white/80 p-3"><p className="text-xs font-semibold text-slate-500">{label}</p><p className="mt-1 font-semibold text-slate-900">{value}</p></div>
}
