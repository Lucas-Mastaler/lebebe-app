'use client'

import { useRef, useState } from 'react'
import { Button } from '@/components/design-system'
import { ComemoracaoPv } from '@/components/atendimento-presencial/ComemoracaoPv'
import { useComemoracaoPv } from '@/components/atendimento-presencial/useComemoracaoPv'

export default function PreviewPvBatidoPage() {
  const [pecas, setPecas] = useState(6)
  const [preparando, setPreparando] = useState(false)
  const rodada = useRef(0)
  const { comemoracao, prepararSom, confirmarVenda, fecharComemoracao } = useComemoracaoPv()

  async function demonstrar() {
    setPreparando(true)
    try {
      await prepararSom()
      confirmarVenda({ id: `preview-${++rodada.current}`, status: 'concluido', resultadoAtendimento: 'sim' }, {
        versaoProdutos: 2, criancas: [], departamentos: [], motivosResultado: [], etapaAtual: 'ficha',
        produtosInteresse: [{ descricao: 'PRODUTO DE DEMONSTRAÇÃO', quantidade: pecas, vendido: true }],
      })
    } finally { setPreparando(false) }
  }

  return <main className="grid min-h-dvh place-items-center bg-cyan-50 p-6">
    <div className="w-full min-w-0 max-w-md space-y-5 rounded-2xl border border-cyan-200 bg-white p-6 text-center shadow-sm">
      <h1 className="text-2xl font-bold text-slate-900">Prévia: PV batido</h1>
      <p className="text-sm text-slate-600">Demonstração local. Não cria nem altera atendimentos. O som dura 1,5 segundo; a comemoração fecha após 5 segundos.</p>
      <div className="flex flex-wrap justify-center gap-2" aria-label="Peças vendidas na demonstração">
        {[5, 6, 7].map(valor => <Button type="button" key={valor} variant={pecas === valor ? 'primary' : 'secondary'} aria-pressed={pecas === valor} onClick={() => setPecas(valor)}>{valor} peças</Button>)}
      </div>
      <Button type="button" className="min-h-12 w-full whitespace-normal" loading={preparando} onClick={() => void demonstrar()}>Ver comemoração com som</Button>
    </div>
    {comemoracao && <ComemoracaoPv dados={comemoracao} onFechar={fecharComemoracao} />}
  </main>
}
