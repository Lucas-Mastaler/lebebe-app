'use client'

import {
  ShoppingCart, Banknote, CheckCircle2, ArrowLeftRight,
  Clock, Truck, Percent, Receipt, BarChart3
} from 'lucide-react'
import { KpiCard } from '@/components/design-system'
import type { SgiCards } from '@/types/sgi'

function brl(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function pct(value: number): string {
  return `${value.toFixed(2).replace('.', ',')}%`
}

interface CardItem {
  label: string
  value: string
  icon: React.ElementType
  color: string
  title?: string
  tooltip?: string
}

interface CardsSGIProps {
  cards: SgiCards | null
  isLoading?: boolean
}

export function CardsSGI({ cards, isLoading }: CardsSGIProps) {
  const items: CardItem[] = cards
    ? [
        {
          label: 'Total de vendas',
          value: cards.total_vendas.toLocaleString('pt-BR'),
          icon: ShoppingCart,
          color: 'text-sky-600 bg-sky-50',
        },
        {
          label: 'Valor total',
          value: brl(cards.valor_total),
          icon: Banknote,
          color: 'text-emerald-600 bg-emerald-50',
        },
        {
          label: 'Valor recebido',
          value: brl(cards.valor_pago_novo),
          icon: CheckCircle2,
          color: 'text-green-600 bg-green-50',
          tooltip: 'Valor efetivamente recebido na venda em dinheiro, cartão, PIX, boleto ou link de pagamento. Não considera crédito de troca como novo recebimento.',
        },
        {
          label: 'Crédito de troca',
          value: brl(cards.valor_credito_troca),
          icon: ArrowLeftRight,
          color: 'text-violet-600 bg-violet-50',
        },
        {
          label: 'Pendente de pagamento',
          value: brl(cards.valor_pendente_pagamento),
          icon: Clock,
          color: 'text-amber-600 bg-amber-50',
        },
        {
          label: 'Frete total',
          value: brl(cards.valor_frete),
          icon: Truck,
          color: 'text-slate-600 bg-slate-50',
        },
        {
          label: 'Desconto médio',
          value: pct(cards.percentual_desconto_medio),
          icon: Percent,
          color: 'text-orange-600 bg-orange-50',
        },
        {
          label: 'Ticket médio',
          value: brl(cards.ticket_medio),
          icon: Receipt,
          color: 'text-teal-600 bg-teal-50',
        },
        {
          label: 'Finalizadas',
          value: cards.total_finalizadas.toLocaleString('pt-BR'),
          icon: BarChart3,
          color: 'text-blue-600 bg-blue-50',
        },
      ]
    : []

  if (!cards && !isLoading) return null

  const displayItems: CardItem[] = isLoading
    ? Array.from({ length: 9 }, (_, index) => ({ label: `Carregando ${index + 1}`, value: '', icon: ShoppingCart, color: '' }))
    : items

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {displayItems.map(item => {
        const Icon = item.icon
        return (
          <KpiCard
            key={item.label}
            label={isLoading ? '' : item.label}
            value={item.value}
            loading={isLoading}
            icon={<Icon className={`size-4 ${item.color.split(' ')[0]}`} />}
            title={item.tooltip ?? item.title}
          />
        )
      })}
    </div>
  )
}
