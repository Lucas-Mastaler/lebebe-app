'use client'

import { useEffect, useState } from 'react'
import { Loader2, Phone, Package, CreditCard, User, Building2, Calendar } from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import type { SgiDocumento, SgiVendaDetalhe } from '@/types/sgi'

function brl(value: number | null | undefined): string {
  if (value == null) return '—'
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatData(iso: string | null | undefined): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  } catch {
    return iso
  }
}

interface ModalDetalheVendaProps {
  venda: SgiDocumento | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ModalDetalheVenda({ venda, open, onOpenChange }: ModalDetalheVendaProps) {
  const [detalhe, setDetalhe] = useState<SgiVendaDetalhe | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !venda?.numero_lancamento) {
      setDetalhe(null)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)

    fetch(`/api/sgi/vendas/${encodeURIComponent(venda.numero_lancamento)}`)
      .then(r => {
        if (!r.ok) throw new Error(`Erro ${r.status}`)
        return r.json()
      })
      .then(data => {
        if (!cancelled) setDetalhe(data)
      })
      .catch(err => {
        if (!cancelled) setError(err.message ?? 'Erro ao carregar detalhe')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [open, venda?.numero_lancamento])

  function Section({ icon: Icon, title, children }: {
    icon: React.ElementType
    title: string
    children: React.ReactNode
  }) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
          <Icon className="w-4 h-4 text-slate-500" />
          <h4 className="text-sm font-semibold text-slate-700">{title}</h4>
        </div>
        {children}
      </div>
    )
  }

  function Row({ label, value }: { label: string; value: React.ReactNode }) {
    return (
      <div className="flex items-start gap-2 text-sm">
        <span className="text-slate-500 min-w-[160px] text-xs">{label}</span>
        <span className="text-slate-800 text-xs font-medium">{value ?? '—'}</span>
      </div>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base">
            Venda #{venda?.numero_lancamento}
            {venda?.cliente && (
              <span className="ml-2 text-slate-500 font-normal text-sm">— {venda.cliente}</span>
            )}
          </DialogTitle>
        </DialogHeader>

        {loading && (
          <div className="space-y-4 py-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-lg" />
            ))}
          </div>
        )}

        {error && (
          <div className="text-sm text-red-600 py-4">{error}</div>
        )}

        {!loading && !error && detalhe && (
          <div className="space-y-6 py-2">
            {/* Dados principais */}
            <Section icon={User} title="Dados da Venda">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-1.5">
                <Row label="Nº Lançamento" value={detalhe.numero_lancamento} />
                <Row label="Nº Documento" value={detalhe.numero_documento} />
                <Row label="Cliente" value={detalhe.cliente} />
                <Row label="Filial" value={detalhe.filial} />
                <Row label="Vendedor" value={detalhe.vendedor} />
                <Row label="Operação" value={detalhe.operacao} />
                <Row label="Status" value={detalhe.status} />
                <Row label="Reserva" value={detalhe.reserva} />
                <Row label="Emissão" value={detalhe.emissao_texto} />
                <Row label="Data fechamento" value={formatData(detalhe.data_fechamento)} />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-1.5 pt-2 border-t border-slate-100 mt-2">
                <Row label="Valor mercadorias" value={brl(detalhe.valor_mercadorias)} />
                <Row label="Valor descontos" value={brl(detalhe.valor_descontos)} />
                <Row label="Desconto %" value={detalhe.percentual_desconto_texto ?? (detalhe.percentual_desconto != null ? `${detalhe.percentual_desconto}%` : '—')} />
                <Row label="Frete" value={brl(detalhe.valor_frete)} />
                <Row label="Valor total" value={<span className="font-bold">{brl(detalhe.valor_total)}</span>} />
                <Row label="Valor pago novo" value={<span className="text-green-700">{brl(detalhe.valor_pago_novo)}</span>} />
                <Row label="Crédito de troca" value={<span className="text-violet-700">{brl(detalhe.valor_credito_troca)}</span>} />
                <Row label="Pendente de pagamento" value={<span className="text-amber-700">{brl(detalhe.valor_pendente_pagamento)}</span>} />
              </div>
            </Section>

            {/* Contatos */}
            <Section icon={Phone} title={`Contatos (${detalhe.contatos_lista.length})`}>
              {detalhe.contatos_lista.length === 0 ? (
                <p className="text-xs text-slate-400">Nenhum contato registrado.</p>
              ) : (
                <div className="space-y-1.5">
                  {detalhe.contatos_lista.map(c => (
                    <div key={c.id} className="flex items-center gap-3 text-xs bg-slate-50 rounded-lg px-3 py-2">
                      <span className="font-mono text-slate-700">{c.telefone_normalizado ?? c.telefone_original ?? '—'}</span>
                      {c.telefone_normalizado_ddi && (
                        <span className="text-slate-400">DDI: {c.telefone_normalizado_ddi}</span>
                      )}
                      {c.principal && (
                        <span className="ml-auto text-xs bg-sky-100 text-sky-700 px-2 py-0.5 rounded-full font-medium">
                          Principal
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Section>

            {/* Produtos */}
            <Section icon={Package} title={`Produtos (${detalhe.produtos.length})`}>
              {detalhe.produtos.length === 0 ? (
                <p className="text-xs text-slate-400">Nenhum produto registrado.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 text-slate-500">
                        <th className="text-left py-1.5 pr-4">Código</th>
                        <th className="text-left py-1.5 pr-4">Produto</th>
                        <th className="text-left py-1.5 pr-4">Local</th>
                        <th className="text-right py-1.5 pr-4">Qtd</th>
                        <th className="text-right py-1.5">Valor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detalhe.produtos.map(p => (
                        <tr key={p.id} className="border-b border-slate-50">
                          <td className="py-1.5 pr-4 font-mono text-slate-600">{p.codigo ?? '—'}</td>
                          <td className="py-1.5 pr-4 max-w-[200px] truncate" title={p.produto ?? undefined}>{p.produto ?? '—'}</td>
                          <td className="py-1.5 pr-4 text-slate-500">{p.local_estocagem ?? '—'}</td>
                          <td className="py-1.5 pr-4 text-right">{p.quantidade_texto ?? p.quantidade ?? '—'}</td>
                          <td className="py-1.5 text-right font-medium">{brl(p.valor_total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Section>

            {/* Pagamentos */}
            <Section icon={CreditCard} title={`Pagamentos (${detalhe.pagamentos.length})`}>
              {detalhe.pagamentos.length === 0 ? (
                <p className="text-xs text-slate-400">Nenhum pagamento registrado.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 text-slate-500">
                        <th className="text-left py-1.5 pr-4">Forma</th>
                        <th className="text-right py-1.5 pr-4">Parcelas</th>
                        <th className="text-right py-1.5 pr-4">%</th>
                        <th className="text-right py-1.5 pr-4">Valor</th>
                        <th className="text-left py-1.5 pr-4">NSU</th>
                        <th className="text-left py-1.5">Autorização</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detalhe.pagamentos.map(p => (
                        <tr key={p.id} className="border-b border-slate-50">
                          <td className="py-1.5 pr-4 max-w-[180px] truncate" title={p.forma_pagamento ?? undefined}>{p.forma_pagamento ?? '—'}</td>
                          <td className="py-1.5 pr-4 text-right">{p.numero_parcelas_texto ?? p.numero_parcelas ?? '—'}</td>
                          <td className="py-1.5 pr-4 text-right">{p.percentual_texto ?? (p.percentual != null ? `${p.percentual}%` : '—')}</td>
                          <td className="py-1.5 pr-4 text-right font-medium">{brl(p.valor)}</td>
                          <td className="py-1.5 pr-4 font-mono text-slate-500">{p.nsu ?? '—'}</td>
                          <td className="py-1.5 font-mono text-slate-500">{p.numero_autorizacao ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Section>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
