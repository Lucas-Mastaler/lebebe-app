'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { CreditCard, History, Package, RefreshCw, ShoppingBag, Tag } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { HistoricoAtendimentoClienteDTO, HistoricoVendaSgiDTO } from '@/lib/atendimento-presencial/historico-cliente'

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
  return data.toLocaleDateString('pt-BR')
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
    <div className="rounded-md border border-white/70 bg-white/80 px-3 py-2 shadow-sm">
      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <div className={`mt-1 text-sm ${emphasis ? 'font-bold text-slate-950' : 'font-semibold text-slate-800'}`}>{value}</div>
    </div>
  )
}

function HistoricoChip({ children, variant = 'slate' }: { children: ReactNode; variant?: 'blue' | 'amber' | 'green' | 'slate' }) {
  const variants = {
    blue: 'border-sky-100 bg-sky-50 text-sky-700',
    amber: 'border-amber-100 bg-amber-50 text-amber-700',
    green: 'border-emerald-100 bg-emerald-50 text-emerald-700',
    slate: 'border-slate-200 bg-slate-50 text-slate-700',
  } as const

  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-1 text-xs font-semibold ${variants[variant]}`}>
      {children}
    </span>
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
        const response = await fetch(montarUrlHistoricoCliente(clienteId, atendimentoAtualId), { cache: 'no-store' })
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex flex-col gap-0 overflow-hidden p-0 max-h-[calc(100dvh-32px)] sm:max-h-[90vh] sm:max-w-4xl">
        <DialogHeader className="flex-none border-b border-slate-100 px-4 pb-3 pt-4 pr-10 sm:px-6 sm:pr-12 sm:pt-5">
          <DialogTitle className="text-base">
            Historico da cliente
            {cliente?.nome && <span className="ml-2 font-normal text-slate-500">- {cliente.nome}</span>}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
        <div className="grid gap-5 px-4 pb-6 pt-4 sm:px-6">
          {!cliente && (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Selecione uma cliente para consultar o historico.
            </p>
          )}

          {cliente && (
            <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Historico da cliente</p>
              <div className="mt-1 flex flex-wrap items-end justify-between gap-2">
                <div>
                  <p className="text-base font-bold text-slate-950">{cliente.nome}</p>
                  <p className="text-sm text-slate-600">{cliente.telefoneFormatado ?? 'Telefone nao informado'}</p>
                </div>
                {historicoCarregado?.fontesConsultadas?.length ? (
                  <p className="text-xs font-medium text-slate-500">
                    Fontes: {historicoCarregado.fontesConsultadas.join(', ')}
                  </p>
                ) : null}
              </div>
            </div>
          )}

          {historicoCarregando && <p className="text-sm text-slate-500">Carregando historico...</p>}
          {historicoErro && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              <p>{historicoErro}</p>
              {cliente && (
                <Button type="button" variant="outline" size="sm" onClick={() => setTentativa((valor) => valor + 1)} className="mt-2 h-9 rounded-md">
                  <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
                  Tentar novamente
                </Button>
              )}
            </div>
          )}

          {historicoCarregado && historicoCarregado.telefoneDisponivel === false && (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Cliente sem telefone normalizado. As compras do SGI nao foram consultadas.
            </p>
          )}

          {historicoCarregado && (
            <>
              <HistoricoSecao
                icon={History}
                title="Atendimentos presenciais anteriores"
                subtitle="Registros concluidos no modulo Atendimento Presencial."
                variant="slate"
              >
                {historicoCarregado.atendimentos?.length ? (
                  <div className="grid gap-3">
                    {historicoCarregado.atendimentos.map((item) => (
                      <article key={item.id} className="overflow-hidden rounded-md border border-slate-200 bg-white p-3 shadow-sm break-words">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="font-semibold text-slate-950">{formatarDataCurta(item.data)}</p>
                          <div className="shrink-0 rounded-md border border-sky-100 bg-sky-50 px-3 py-2 text-right">
                            <p className="text-[10px] font-bold uppercase tracking-wide text-sky-700">Venda fechada?</p>
                            <p className="text-sm font-bold text-slate-900">{formatarVendaFechadaHistorico(item.resultado)}</p>
                          </div>
                        </div>
                        <p className="mt-1 text-sm text-slate-600">{item.unidade ?? 'Unidade nao informada'} | {item.consultora ?? 'Consultora nao informada'}</p>
                        <div className="mt-3 grid gap-2 sm:grid-cols-2">
                          <div>
                            <p className="text-[11px] font-bold uppercase text-slate-500">Departamentos</p>
                            <div className="mt-1 flex flex-wrap gap-1.5">
                              {item.departamentos.length ? item.departamentos.map((departamento) => (
                                <HistoricoChip key={departamento} variant="slate">{departamento}</HistoricoChip>
                              )) : <span className="text-sm text-slate-500">Nao informado</span>}
                            </div>
                          </div>
                          <div>
                            <p className="text-[11px] font-bold uppercase text-slate-500">Produtos de interesse</p>
                            <p className="mt-1 text-sm text-slate-700">{item.produtosInteresse.join(', ') || 'Nao informado'}</p>
                          </div>
                        </div>
                        {item.numeroLancamento && <p className="text-sm text-slate-700">Lancamento: {item.numeroLancamento}</p>}
                      </article>
                    ))}
                  </div>
                ) : (
                  <p className="rounded-md border border-dashed border-slate-200 bg-white/80 p-3 text-sm text-slate-500">Nenhum atendimento anterior encontrado.</p>
                )}
              </HistoricoSecao>

              <HistoricoSecao
                icon={ShoppingBag}
                title="Compras anteriores no SGI"
                subtitle="Compras encontradas pelo telefone da cliente."
                variant="blue"
              >
                {historicoCarregado.vendas?.length ? (
                  <div className="grid gap-4">
                    {historicoCarregado.vendas.map((item) => (
                      <article key={item.numeroLancamento} className="overflow-hidden rounded-md border border-slate-200 bg-white p-3 sm:p-4 shadow-sm break-words">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Resumo da compra</p>
                            <h4 className="text-lg font-bold text-slate-950">Lancamento {item.numeroLancamento || 'Nao informado'}</h4>
                          </div>
                          <div className="shrink-0 rounded-md border border-emerald-100 bg-emerald-50 px-3 py-2 text-right">
                            <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-700">Valor total</p>
                            <p className="text-base font-bold text-emerald-800">{formatarDinheiro(item.valorTotal)}</p>
                          </div>
                        </div>

                        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                          <HistoricoInfoCard label="Data" value={formatarDataCurta(item.data)} />
                          <HistoricoInfoCard label="Filial" value={item.filial ?? 'Filial nao informada'} />
                          <HistoricoInfoCard label="Vendedor" value={item.vendedor ?? 'Vendedor nao informado'} />
                          <HistoricoInfoCard label="Status" value={item.status ?? 'Status nao informado'} />
                          <HistoricoInfoCard label="Itens" value={`${item.produtos?.length || item.itens.length || 0} produto(s)`} />
                          <HistoricoInfoCard label="Lancamento" value={item.numeroLancamento || 'Nao informado'} emphasis />
                        </div>

                        <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_1fr]">
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

                        <div className="mt-4 rounded-md border border-slate-200 bg-slate-50/70 p-3">
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
                      </article>
                    ))}
                  </div>
                ) : (
                  <p className="rounded-md border border-dashed border-sky-200 bg-white/80 p-3 text-sm text-slate-500">Nenhuma compra anterior encontrada pelo telefone da cliente.</p>
                )}
              </HistoricoSecao>
            </>
          )}
        </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
