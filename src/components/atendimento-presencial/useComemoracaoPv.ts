'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { FichaDadosRascunho } from '@/lib/atendimento-presencial/ficha-schema'
import { calcularPv, META_PV } from '@/lib/atendimento-presencial/produtos'
import { SomPv } from '@/lib/atendimento-presencial/som-pv'

export type DadosComemoracaoPv = { atendimentoId: string; pv: number }

export function useComemoracaoPv() {
  const [comemoracao, setComemoracao] = useState<DadosComemoracaoPv | null>(null)
  const [som] = useState(() => new SomPv())
  const exibidos = useRef(new Set<string>())
  useEffect(() => () => som.encerrar(), [som])

  const prepararSom = useCallback(() => som.preparar(), [som])
  const fecharComemoracao = useCallback(() => { som.parar(); setComemoracao(null) }, [som])
  const confirmarVenda = useCallback((atendimento: { id: string; status: string; resultadoAtendimento: string | null }, dadosSalvos: FichaDadosRascunho) => {
    const pv = calcularPv(dadosSalvos.produtosInteresse, dadosSalvos.versaoProdutos).valor
    if (atendimento.status !== 'concluido' || atendimento.resultadoAtendimento !== 'sim' || pv < META_PV || exibidos.current.has(atendimento.id)) return false
    exibidos.current.add(atendimento.id)
    som.tocar()
    setComemoracao({ atendimentoId: atendimento.id, pv })
    return true
  }, [som])

  return { comemoracao, prepararSom, confirmarVenda, fecharComemoracao }
}
