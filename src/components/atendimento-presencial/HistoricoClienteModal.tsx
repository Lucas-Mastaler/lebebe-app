'use client'

import { IndicadorPv } from './ProdutosAtendimento'
import { estruturarProduto, produtoNaoTrabalhado } from '@/lib/atendimento-presencial/produtos'
import { DiagnosticosVendaSgi } from './VendaSgiAtendimento'
import type { ResolucaoVendasSgi } from '@/lib/atendimento-presencial/vendas-sgi-diagnostico'

import { useEffect, useState, type ReactNode } from 'react'
import { ChevronDown, CreditCard, History, Package, RefreshCw, ShoppingBag, Tag } from 'lucide-react'
import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'
import { Alert, Badge, Button, Dialog, DialogBody, DialogContent, DialogHeader } from '@/components/design-system'
import type { BadgeProps } from '@/components/design-system'
import type { HistoricoAtendimentoClienteDTO, HistoricoVendaSgiDTO } from '@/lib/atendimento-presencial/historico-cliente'
import type { HistoricoPedidoPersonalizadoDTO } from '@/lib/pedidos-personalizados/server/historico'
import { requisicaoLimitada } from '@/lib/atendimento-presencial/requisicao-limitada'

export type HistoricoClienteModalCliente = {
  id: string
  nome: string
  telefoneFormatado?: string | null
}

type HistoricoClienteResponse = {
  ok: boolean
  message?: string
  telefoneDisponivel?: boolean
  atendimentos?: HistoricoAtendimentoClienteDTO[]
  vendas?: HistoricoVendaSgiDTO[]
  diagnosticosSgi?: ResolucaoVendasSgi['diagnosticos']
  pedidosPersonalizados?: HistoricoPedidoPersonalizadoDTO[]
  fontesConsultadas?: string[]
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  cliente: HistoricoClienteModalCliente | null
  atendimentoAtualId?: string | null
}

export function montarUrlHistoricoCliente(clienteId: string, atendimentoAtualId?: string | null) {
  const params = new URLSearchParams()
  if (atendimentoAtualId) params.set('atendimentoAtualId', atendimentoAtualId)
  const query = params.toString()
  return `/api/atendimento-presencial/clientes/${clienteId}/historico${query ? `?${query}` : ''}`
}

function formatarDataCurta(valor: string | null) {
  if (!valor) return 'Sem data'
  const data = new Date(valor)
  if (Number.isNaN(data.getTime())) return valor
  return data.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
}

function formatarDinheiro(valor: number | null) {
  if (valor === null || !Number.isFinite(valor)) return 'Valor nao informado'
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor)
}

function HistoricoSecao({
  icon: Icon,
  title,
  subtitle,
  variant,
  children,
}: {
  icon: LucideIcon
  title: string
  subtitle?: string
  variant: 'blue' | 'amber' | 'green' | 'slate'
  children: ReactNode
}) {
  const variants = {
    blue: 'border-sky-100 bg-sky-50/60 text-sky-700',
    amber: 'border-amber-100 bg-amber-50/60 text-amber-700',
    green: 'border-emerald-100 bg-emerald-50/60 text-emerald-700',
    slate: 'border-slate-200 bg-slate-50 text-slate-700',
  } as const

  return (
    <section className={`overflow-hidden rounded-md border p-4 ${variants[variant]}`}>
      <div className="mb-3 flex items-start gap-2">
        <span className="mt-0.5 rounded-md bg-white/80 p-1.5 shadow-sm">
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-bold uppercase tracking-wide text-slate-900 break-words">{title}</h3>
          {subtitle && <p className="text-xs text-slate-600 break-words">{subtitle}</p>}
        </div>
      </div>
      <div className="text-slate-900">{children}</div>
    </section>
  )
}

function HistoricoInfoCard({ label, value, emphasis = false }: { label: string; value: ReactNode; emphasis?: boolean }) {
  return (
    <div className="rounded-xl border border-white bg-white/80 p-3 shadow-sm">
      <p className="text-xs font-semibold text-slate-500">{label}</p>
      <div className={`mt-1 text-sm ${emphasis ? 'font-bold text-slate-950' : 'font-semibold text-slate-800'}`}>{value}</div>
    </div>
  )
}

const HISTORICO_CHIP_TONE: Record<'blue' | 'amber' | 'green' | 'slate', BadgeProps['tone']> = {
  blue: 'info',
  amber: 'warning',
  green: 'success',
  slate: 'neutral',
}

function HistoricoChip({ children, variant = 'slate' }: { children: ReactNode; variant?: 'blue' | 'amber' | 'green' | 'slate' }) {
  return <Badge tone={HISTORICO_CHIP_TONE[variant]}>{children}</Badge>
}

function HistoricoToggleDetalhes({ tone = 'primary' }: { tone?: 'primary' | 'amber' }) {
  const toneClass = tone === 'amber' ? 'text-amber-800' : 'text-primary'
  return (
    <span className={`flex items-center justify-end gap-1 text-xs font-semibold ${toneClass}`}>
      <span className="group-open:hidden">Ver detalhes</span>
      <span className="hidden group-open:inline">Recolher detalhes</span>
      <ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden="true" />
    </span>
  )
}

/**
 * SCROLL-BOUNDED-LIST: somente coleções que podem crescer sem limite ganham
 * rolagem própria. O DialogBody continua sendo o scroller que garante acesso
 * ao restante do histórico.
 */
function HistoricoListaLonga({ children }: { children: ReactNode }) {
  return (
    <div className="max-h-[min(24rem,45dvh)] overflow-y-auto overscroll-contain pr-2">
      {children}
    </div>
  )
}

export function formatarVendaFechadaHistorico(resultado: string | null) {
  const normalizado = (resultado ?? '').trim().toLowerCase()
  if (!normalizado) return 'Nao informado'
  if (normalizado === 'sim') return 'Sim'
  if (normalizado === 'nao' || normalizado === 'n\u00e3o') return 'Nao'
  if (normalizado === 'negociacao' || normalizado === 'negocia\u00e7\u00e3o') return 'Em negociacao'
  return resultado
}

export function situacaoAtendimentoHistorico(resultado: string | null): { label: string; tone: BadgeProps['tone'] } {
  const valor = (resultado ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase()
  if (valor === 'sim') return { label: 'Venda fechada', tone: 'success' }
  if (valor === 'nao') return { label: 'Venda perdida', tone: 'danger' }
  if (['negociacao', 'em negociacao', 'ainda em negociacao'].includes(valor)) return { label: 'Em negociação', tone: 'warning' }
  return { label: resultado && valor !== 'nao informado' ? resultado : 'Não informada', tone: 'neutral' }
}

export function HistoricoAtendimentoCard({ item }: { item: HistoricoAtendimentoClienteDTO }) {
  const situacao = situacaoAtendimentoHistorico(item.resultado)
  return (
    <article className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white p-3 shadow-sm break-words sm:p-4">
      <details className="group">
        <summary className="cursor-pointer list-none rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-primary [&::-webkit-details-marker]:hidden">
          <div className="rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/10 via-white to-info/10 p-3 sm:p-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-[1.2fr_1.1fr_1fr_1.25fr_1fr_auto] sm:items-center">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wide text-primary">Data de conclusão do atendimento</p>
                <p className="mt-1 font-bold text-slate-950">{formatarDataCurta(item.data)}</p>
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Situação da venda</p>
                <div className="mt-1"><Badge tone={situacao.tone}>{situacao.label}</Badge></div>
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Filial</p>
                <p className="mt-1 break-words text-sm font-semibold text-slate-800">{item.unidade || 'Não informada'}</p>
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Consultora do atendimento</p>
                <p className="mt-1 break-words text-sm font-semibold text-slate-800">{item.consultora || 'Não informada'}</p>
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Lançamento informado</p>
                <p className="mt-1 break-words text-sm font-bold text-slate-950">{item.numeroLancamento ?? 'Não informado'}</p>
              </div>
              <div className="col-span-2 flex items-center justify-end gap-1 text-xs font-semibold text-primary sm:col-span-1">
                <HistoricoToggleDetalhes />
              </div>
            </div>
          </div>
        </summary>

        <div className="pt-3">
          <section className="rounded-md border border-amber-100 bg-amber-50/60 p-3">
            <h5 className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-amber-800">
              <Tag className="size-4 shrink-0" aria-hidden="true" />Departamentos de interesse
            </h5>
            <div className="flex flex-wrap gap-1.5">
              {item.departamentos.length ? item.departamentos.map(departamento => (
                <HistoricoChip key={departamento} variant="amber">{departamento}</HistoricoChip>
              )) : <p className="text-sm text-slate-600">Não informados</p>}
            </div>
          </section>

          <section className="mt-3 min-w-0 rounded-md border border-sky-100 bg-sky-50/60 p-3">
            <h5 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-sky-800">
              <Package className="size-4 shrink-0" aria-hidden="true" />Produtos de interesse
            </h5>
            <p className="mt-1 text-xs text-slate-600">Informações registradas na Prancheta, independentes dos itens oficiais do SGI.</p>
            {item.produtosInteresse.length ? (
              <ul className="mt-3 grid gap-2">
                {item.produtosInteresse.map((produto, index) => {
                  const registro = estruturarProduto(produto)
                  const naoTrabalhado = produtoNaoTrabalhado(produto)
                  return (
                    <li key={index} className="min-w-0 rounded-md border border-sky-100 bg-white p-3">
                      <p className="break-words text-sm font-semibold text-slate-900">{registro.descricao}</p>
                      {naoTrabalhado ? <p className="mt-1 text-xs text-slate-600">Produto que não trabalhamos. Não entra no cálculo de peças vendidas.</p> : (
                        <dl className="mt-2 flex flex-wrap gap-x-6 gap-y-2 text-sm">
                          <div><dt className="text-xs text-slate-500">Quantidade</dt><dd className="font-semibold text-slate-800">{registro.quantidade ?? 'Não informada'}</dd></div>
                          <div><dt className="mb-1 text-xs text-slate-500">Venda do item</dt><dd><Badge tone={registro.vendido === null ? 'neutral' : registro.vendido ? 'success' : 'warning'}>{registro.vendido === null ? 'Não informada' : registro.vendido ? 'Vendido' : 'Não vendido'}</Badge></dd></div>
                        </dl>
                      )}
                    </li>
                  )
                })}
              </ul>
            ) : <p className="mt-3 text-sm text-slate-600">Nenhum produto de interesse informado.</p>}
          </section>

          <section className="mt-3 rounded-md border border-slate-200 bg-slate-50/70 p-3">
            <h5 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-700">Peças vendidas na Prancheta (PV)</h5>
            <IndicadorPv produtos={item.produtosInteresse} versaoProdutos={item.versaoProdutos} />
          </section>
        </div>
      </details>
    </article>
  )
}

export function HistoricoClienteModal({ open, onOpenChange, cliente, atendimentoAtualId }: Props) {
  const clienteId = cliente?.id ?? null
  const clienteNome = cliente?.nome ?? null
  const clienteTelefone = cliente?.telefoneFormatado ?? null
  const [historicoCliente, setHistoricoCliente] = useState<HistoricoClienteResponse | null>(null)
  const [historicoClienteId, setHistoricoClienteId] = useState<string | null>(null)
  const [historicoCarregando, setHistoricoCarregando] = useState(false)
  const [historicoErro, setHistoricoErro] = useState<string | null>(null)
  const [tentativa, setTentativa] = useState(0)

  useEffect(() => {
    if (!open) return

    let cancelado = false

    void Promise.resolve().then(async () => {
      if (cancelado) return

      setHistoricoCliente(null)
      setHistoricoClienteId(null)
      setHistoricoErro(null)

      if (!clienteId) {
        setHistoricoCarregando(false)
        return
      }

      setHistoricoCarregando(true)

      try {
        const response = await requisicaoLimitada(montarUrlHistoricoCliente(clienteId, atendimentoAtualId), { cache: 'no-store' })
        const data = (await response.json()) as HistoricoClienteResponse
        if (!response.ok || !data.ok) throw new Error(data.message ?? 'Erro ao carregar historico da cliente')
        if (!cancelado) {
          setHistoricoCliente(data)
          setHistoricoClienteId(clienteId)
        }
      } catch (error) {
        if (!cancelado) {
          setHistoricoErro(error instanceof Error ? error.message : 'Erro ao carregar historico da cliente')
        }
      } finally {
        if (!cancelado) setHistoricoCarregando(false)
      }
    })

    return () => {
      cancelado = true
    }
  }, [open, clienteId, clienteNome, clienteTelefone, atendimentoAtualId, tentativa])

  const historicoCarregado = historicoCliente && historicoClienteId === cliente?.id ? historicoCliente : null
  const rotulosFontes: Record<string, string> = { atendimento_presencial: 'Prancheta Virtual', sgi_documentos_saida: 'SGI', pedidos_personalizados: 'Pedidos personalizados' }
  const fontes = historicoCarregado?.fontesConsultadas?.map(fonte => rotulosFontes[fonte]).filter(Boolean) ?? []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader
          title={
            <>
              Histórico da cliente
              {cliente?.nome && <span className="ml-2 font-normal text-slate-500">- {cliente.nome}</span>}
            </>
          }
        />

        <DialogBody className="grid auto-rows-max content-start gap-5">
          {!cliente && <Alert tone="warning">Selecione uma cliente para consultar o historico.</Alert>}

          {cliente && (
            <div className="rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/10 via-white to-info/10 px-4 py-4 sm:px-5">
              <p className="text-xs font-bold uppercase tracking-wide text-primary">Histórico da cliente</p>
              <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-xl font-bold leading-tight text-slate-950">{cliente.nome}</p>
                  <p className="mt-1 text-sm text-slate-600">{cliente.telefoneFormatado ?? 'Telefone não informado'}</p>
                </div>
                {fontes.length ? (
                  <p className="text-xs font-medium text-slate-500">
                    Fontes: {fontes.join(', ')}
                  </p>
                ) : null}
              </div>
            </div>
          )}

          {historicoCarregando && <p className="text-sm text-slate-500">Carregando historico...</p>}
          {historicoErro && (
            <Alert tone="danger">
              <p>{historicoErro}</p>
              {cliente && (
                <Button type="button" variant="secondary" size="sm" onClick={() => setTentativa((valor) => valor + 1)} className="mt-2">
                  <RefreshCw className="size-4" aria-hidden="true" />
                  Tentar novamente
                </Button>
              )}
            </Alert>
          )}

          {historicoCarregado && historicoCarregado.telefoneDisponivel === false && (
            <Alert tone="warning">
              Telefone ausente ou incompleto. As compras identificadas pela Prancheta continuam disponíveis neste cadastro.
            </Alert>
          )}

          {historicoCarregado && (
            <>
              <DiagnosticosVendaSgi diagnosticos={historicoCarregado.diagnosticosSgi} />
              <HistoricoSecao
                icon={History}
                title="Atendimentos presenciais anteriores"
                subtitle="Registros concluídos na Prancheta Virtual. Quantidades e vendas dos itens refletem o que foi preenchido no atendimento."
                variant="blue"
              >
                {historicoCarregado.atendimentos?.length ? (
                  <HistoricoListaLonga>
                    <div className="grid gap-3">
                      {historicoCarregado.atendimentos.map(item => <HistoricoAtendimentoCard key={item.id} item={item} />)}
                    </div>
                  </HistoricoListaLonga>
                ) : (
                  <p className="rounded-md border border-dashed border-slate-200 bg-white/80 p-3 text-sm text-slate-500">Nenhum atendimento anterior encontrado.</p>
                )}
              </HistoricoSecao>

              <HistoricoSecao
                icon={ShoppingBag}
                title="Compras anteriores no SGI"
                subtitle="Compras identificadas pelo telefone ou pela Prancheta."
                variant="blue"
              >
                {historicoCarregado.vendas?.length ? (
                  <HistoricoListaLonga>
                    <div className="grid gap-4">
                      {historicoCarregado.vendas.map((item) => (
                        <details key={item.documentoId ?? item.numeroLancamento} className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm break-words">
                          <summary className="cursor-pointer list-none rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-primary [&::-webkit-details-marker]:hidden">
                            <div className="rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/10 via-white to-info/10 p-3 sm:p-4">
                              <div className="grid grid-cols-2 gap-3 sm:grid-cols-[1.1fr_1fr_1fr_1fr_auto] sm:items-center">
                                <div className="min-w-0">
                                  <p className="text-[10px] font-bold uppercase tracking-wide text-primary">Data da compra</p>
                                  <p className="mt-1 font-bold text-slate-950">{formatarDataCurta(item.data)}</p>
                                </div>
                                <div className="min-w-0">
                                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Filial</p>
                                  <p className="mt-1 break-words text-sm font-semibold text-slate-800">{item.filial ?? 'Filial não informada'}</p>
                                </div>
                                <div className="min-w-0">
                                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Lançamento</p>
                                  <p className="mt-1 break-words text-sm font-bold text-slate-950">{item.numeroLancamento || 'Não informado'}</p>
                                  {item.origemAssociacao === 'prancheta' && <Badge tone="info">Identificada pela Prancheta</Badge>}
                                </div>
                                <div className="min-w-0 rounded-xl border border-white bg-white/80 px-3 py-2 shadow-sm sm:text-right">
                                  <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-700">Valor total</p>
                                  <p className="mt-1 font-bold text-emerald-800">{formatarDinheiro(item.valorTotal)}</p>
                                </div>
                                <div className="col-span-2 sm:col-span-1"><HistoricoToggleDetalhes /></div>
                              </div>
                            </div>
                          </summary>

                          <div className="space-y-4 p-3 sm:p-4">
                            <div className="rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/10 via-white to-info/10 p-4 sm:p-5">
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div className="min-w-0 flex-1">
                                  <p className="text-xs font-bold uppercase tracking-wide text-primary">Resumo da compra</p>
                                  <h4 className="mt-1 text-lg font-bold text-slate-950">Lançamento {item.numeroLancamento || 'Não informado'}</h4>
                                  {item.origemAssociacao === 'prancheta' && <Badge tone="info">Identificada pela Prancheta</Badge>}
                                </div>
                                <div className="shrink-0 rounded-xl border border-white bg-white/80 px-3 py-2 text-right shadow-sm">
                                  <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-700">Valor total</p>
                                  <p className="text-base font-bold text-emerald-800">{formatarDinheiro(item.valorTotal)}</p>
                                </div>
                              </div>

                              <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                                <HistoricoInfoCard label="Data" value={formatarDataCurta(item.data)} />
                                <HistoricoInfoCard label="Filial" value={item.filial ?? 'Filial não informada'} />
                                <HistoricoInfoCard label="Vendedor" value={item.vendedor ?? 'Vendedor não informado'} />
                                <HistoricoInfoCard label="Status" value={item.status ?? 'Status não informado'} />
                                <HistoricoInfoCard label="Itens" value={`${item.produtos?.length || item.itens.length || 0} produto(s)`} />
                                <HistoricoInfoCard label="Lançamento" value={item.numeroLancamento || 'Não informado'} emphasis />
                              </div>
                            </div>

                            <div className="grid gap-3 lg:grid-cols-[1fr_1fr]">
                          <div className="rounded-md border border-amber-100 bg-amber-50/60 p-3">
                            <div className="mb-2 flex items-center gap-2">
                              <Tag className="h-4 w-4 text-amber-700" aria-hidden="true" />
                              <p className="text-xs font-bold uppercase tracking-wide text-slate-700">Departamentos</p>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {item.departamentos?.length ? item.departamentos.map((departamento) => (
                                <HistoricoChip key={departamento} variant="amber">{departamento}</HistoricoChip>
                              )) : <span className="text-sm text-slate-500">Nao informado</span>}
                            </div>
                          </div>

                          <div className="rounded-md border border-emerald-100 bg-emerald-50/60 p-3">
                            <div className="mb-2 flex items-center gap-2">
                              <CreditCard className="h-4 w-4 text-emerald-700" aria-hidden="true" />
                              <p className="text-xs font-bold uppercase tracking-wide text-slate-700">Forma de pagamento</p>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {item.formasPagamento.length ? item.formasPagamento.map((forma) => (
                                <HistoricoChip key={forma} variant="green">{forma}</HistoricoChip>
                              )) : <span className="text-sm text-slate-500">Nao informado</span>}
                            </div>
                          </div>
                        </div>

                            <div className="rounded-md border border-slate-200 bg-slate-50/70 p-3">
                          <div className="mb-3 flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <Package className="h-4 w-4 text-slate-600" aria-hidden="true" />
                              <p className="text-xs font-bold uppercase tracking-wide text-slate-700">Itens/produtos</p>
                            </div>
                            <span className="text-xs font-medium text-slate-500">{item.produtos?.length || item.itens.length || 0} item(ns)</span>
                          </div>

                          {item.produtos?.length ? (
                            <div className="min-w-0 overflow-x-auto">
                              <table className="w-full min-w-[360px] text-sm">
                                <thead>
                                  <tr className="border-b border-slate-200 text-left text-[11px] uppercase tracking-wide text-slate-500">
                                    <th className="py-2 pr-3">Produto</th>
                                    <th className="py-2 pr-3">Depto.</th>
                                    <th className="py-2 pr-3 text-right">Qtd</th>
                                    <th className="py-2 text-right">Valor</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {item.produtos.map((produto, index) => (
                                    <tr key={`${item.numeroLancamento}-${produto.nome}-${index}`} className="border-b border-slate-100 last:border-0">
                                      <td className="py-2 pr-3 font-medium text-slate-900">
                                        <span className="line-clamp-2">{produto.nome}</span>
                                        {produto.subgrupo && <span className="mt-0.5 block text-xs font-normal text-slate-500">{produto.subgrupo}</span>}
                                      </td>
                                      <td className="py-2 pr-3">
                                        {produto.departamento ? <HistoricoChip variant="slate">{produto.departamento}</HistoricoChip> : <span className="text-xs text-slate-400">Nao informado</span>}
                                      </td>
                                      <td className="py-2 pr-3 text-right font-medium text-slate-700">{produto.quantidade ?? '-'}</td>
                                      <td className="py-2 text-right font-semibold text-slate-900">{formatarDinheiro(produto.valorTotal)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          ) : (
                            <p className="text-sm text-slate-500">{item.itens.join(', ') || 'Nao informado'}</p>
                          )}
                            </div>
                          </div>
                        </details>
                      ))}
                    </div>
                  </HistoricoListaLonga>
                ) : (
                  <p className="rounded-md border border-dashed border-sky-200 bg-white/80 p-3 text-sm text-slate-500">Nenhuma compra anterior identificada pelo telefone ou pela Prancheta.</p>
                )}
              </HistoricoSecao>

              {historicoCarregado.pedidosPersonalizados && (
                <HistoricoSecao
                  icon={Package}
                  title="Pedidos personalizados"
                  subtitle="Pedidos Moriah encontrados pelo telefone normalizado da cliente."
                  variant="amber"
                >
                  {historicoCarregado.pedidosPersonalizados.length ? (
                    <HistoricoListaLonga>
                      <div className="grid gap-3">
                        {historicoCarregado.pedidosPersonalizados.map((pedido) => (
                          <details key={pedido.id} className="group overflow-hidden rounded-2xl border border-amber-200 bg-white shadow-sm">
                            <summary className="cursor-pointer list-none rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-primary [&::-webkit-details-marker]:hidden">
                              <div className="rounded-2xl border border-amber-100 bg-amber-50/60 p-3 sm:p-4">
                                <div className="grid grid-cols-2 gap-3 sm:grid-cols-[1.1fr_1fr_1fr_1fr_1fr_auto] sm:items-center">
                                  <div className="min-w-0">
                                    <p className="text-[10px] font-bold uppercase tracking-wide text-amber-800">Data do pedido</p>
                                    <p className="mt-1 font-bold text-slate-950">{formatarDataCurta(pedido.createdAt)}</p>
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Status</p>
                                    <p className="mt-1 break-words text-sm font-semibold text-slate-800">{pedido.status}</p>
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Filial</p>
                                    <p className="mt-1 break-words text-sm font-semibold text-slate-800">{pedido.unidade}</p>
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Lançamento</p>
                                    <p className="mt-1 break-words text-sm font-semibold text-slate-800">{pedido.numeroLancamento ?? 'Não informado'}</p>
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Pedido de compra</p>
                                    <p className="mt-1 break-words text-sm font-semibold text-slate-800">{pedido.numeroPedidoCompra ?? 'Não informado'}</p>
                                  </div>
                                  <div className="col-span-2 sm:col-span-1"><HistoricoToggleDetalhes tone="amber" /></div>
                                </div>
                              </div>
                            </summary>

                            <div className="space-y-3 p-3 sm:p-4">
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                  <p className="font-bold text-slate-950">{formatarDataCurta(pedido.createdAt)} · {pedido.unidade}</p>
                                  <p className="mt-1 text-sm text-slate-600">{pedido.status}</p>
                                </div>
                                <Button asChild type="button" size="sm" variant="secondary">
                                  <Link href={`/pedidos-personalizados?pedidoId=${pedido.id}`}>Abrir detalhe</Link>
                                </Button>
                              </div>
                              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                                <HistoricoInfoCard label="Lançamento" value={pedido.numeroLancamento ?? 'Não informado'} />
                                <HistoricoInfoCard label="Pedido de compra" value={pedido.numeroPedidoCompra ?? 'Não informado'} />
                                <HistoricoInfoCard label="Tapetes" value={pedido.quantidadeTapetes} />
                                <HistoricoInfoCard label="Pedido ao fornecedor" value={formatarDataCurta(pedido.dataPedidoFornecedor)} />
                                <HistoricoInfoCard label="Data de entrega" value={formatarDataCurta(pedido.dataEntrega)} />
                              </div>
                            </div>
                          </details>
                        ))}
                      </div>
                    </HistoricoListaLonga>
                  ) : (
                    <p className="rounded-md border border-dashed border-amber-200 bg-white/80 p-3 text-sm text-slate-500">Nenhum pedido personalizado encontrado pelo telefone da cliente.</p>
                  )}
                </HistoricoSecao>
              )}
            </>
          )}
        </DialogBody>
      </DialogContent>
    </Dialog>
  )
}
