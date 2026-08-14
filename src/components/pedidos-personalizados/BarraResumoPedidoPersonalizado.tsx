'use client'

import type { ReactNode } from 'react'
import { Loader2, RefreshCw, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'

type Props = {
  quantidadeItens: number
  totalFormatado: string
  salvando: boolean
  podeSalvar: boolean
  bloqueadoNovoPedido?: boolean
  rotuloSalvar: string
  onNovoPedido?: () => void
  tipoBotaoSalvar?: 'submit' | 'button'
  onSalvar?: () => void
  /** Ação extra exibida à esquerda do botão "Novo pedido" (ex.: alternar visualização de selecionados no Lebebe Exclusive). */
  acaoSecundaria?: ReactNode
}

/**
 * Barra fixa de resumo (itens + total + ações) usada tanto pelo fluxo Moriah
 * quanto pelo Lebebe Exclusive na criação de pedido, para que os dois
 * fornecedores compartilhem exatamente a mesma linguagem visual. Cada
 * chamador continua responsável pelo próprio cálculo de itens/total e pela
 * própria lógica de salvar — este componente só apresenta os valores já
 * prontos.
 */
export function BarraResumoPedidoPersonalizado({
  quantidadeItens,
  totalFormatado,
  salvando,
  podeSalvar,
  bloqueadoNovoPedido = false,
  rotuloSalvar,
  onNovoPedido,
  tipoBotaoSalvar = 'submit',
  onSalvar,
  acaoSecundaria,
}: Props) {
  return (
    <div className="sticky bottom-0 z-10 flex flex-col gap-3 rounded-t-2xl border-t border-slate-200 bg-slate-50/95 p-3 shadow-[0_-6px_16px_-8px_rgba(15,23,42,0.15)] backdrop-blur sm:flex-row sm:items-center sm:justify-between sm:p-4">
      <p className="text-center text-sm font-bold text-slate-900 sm:text-left sm:text-base">Itens selecionados: {quantidadeItens} · Total: {totalFormatado}</p>
      <div className="flex gap-2">
        {acaoSecundaria}
        {onNovoPedido && (
          <Button type="button" variant="outline" className="min-h-12 flex-1 sm:flex-none" disabled={bloqueadoNovoPedido} onClick={onNovoPedido}>
            <RefreshCw />Novo pedido
          </Button>
        )}
        <Button
          type={tipoBotaoSalvar}
          className="min-h-12 flex-1 sm:flex-none"
          disabled={!podeSalvar}
          onClick={tipoBotaoSalvar === 'button' ? onSalvar : undefined}
        >
          {salvando ? <Loader2 className="animate-spin" /> : <Save />}
          {rotuloSalvar}
        </Button>
      </div>
    </div>
  )
}
