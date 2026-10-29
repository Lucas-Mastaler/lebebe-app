'use client'
import { useEffect, useState } from 'react'
import { Button } from '@/components/design-system'
import { ESSENCIAIS_HABILITADOS, PRODUTOS_ESSENCIAIS, rotuloFaseEssenciais, type SnapshotEssenciais } from '@/lib/atendimento-presencial/essenciais'
import { requisicaoLimitada } from '@/lib/atendimento-presencial/requisicao-limitada'

export function ResumoEssenciais({ itens }: { itens: SnapshotEssenciais[] }) {
  if (!itens.length) return null
  return <section aria-label="Histórico de produtos essenciais" className="space-y-3 rounded-xl border border-pink-200 bg-pink-50/50 p-4">
    <h3 className="font-semibold">Produtos essenciais — respostas no atendimento</h3>
    {itens.map(item => <article key={`${item.atendimentoId}/${item.criancaId}`} className="rounded-lg bg-white p-3 text-sm">
      <p><strong>{item.nome || 'Nome não informado'}</strong> · {rotuloFaseEssenciais(item.fase)}</p>
      <p className="text-xs text-slate-600">{new Date(item.registradoEm).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })} · {item.filial} · {item.consultora}</p>
      {item.respostas.length ? <ul className="mt-2 space-y-1">{item.respostas.map(r => <li key={r.produto}><strong>{PRODUTOS_ESSENCIAIS[r.produto]}:</strong> {r.resposta === 'sim' ? 'Sim' : 'Não'}{r.confirmada ? ' · confirmado neste atendimento' : ' · resposta anterior'}</li>)}</ul> : <p>Sem questionário para esta fase.</p>}
    </article>)}
  </section>
}

export function HistoricoEssenciaisCliente({ clienteId }: { clienteId: string }) {
  const [estado, setEstado] = useState<{ clienteId: string; itens: SnapshotEssenciais[]; mais: boolean }>({ clienteId: '', itens: [], mais: false })
  const [pagina, setPagina] = useState(0)
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [tentativa, setTentativa] = useState(0)
  useEffect(() => {
    if (!ESSENCIAIS_HABILITADOS) return
    const abort = new AbortController()
    requisicaoLimitada(`/api/atendimento-presencial/clientes/${clienteId}/essenciais?pagina=${pagina}`, { signal: abort.signal })
      .then(async response => {
        const data = await response.json()
        if (!response.ok || !data.ok) throw new Error(data.message ?? 'Falha ao consultar respostas anteriores.')
        if (!abort.signal.aborted) { setEstado(atual => ({ clienteId, itens: pagina && atual.clienteId === clienteId ? [...atual.itens, ...data.historico] : data.historico, mais: data.mais })); setErro('') }
      }).catch(error => { if (!abort.signal.aborted) setErro(error instanceof Error ? error.message : 'Falha ao consultar essenciais.') })
      .finally(() => { if (!abort.signal.aborted) setCarregando(false) })
    return () => abort.abort()
  }, [clienteId, pagina, tentativa])
  if (!ESSENCIAIS_HABILITADOS) return null
  return <div className="my-4">{erro ? <div role="alert"><p>{erro}</p><Button type="button" variant="secondary" onClick={() => { setCarregando(true); setTentativa(t => t + 1) }}>Tentar novamente</Button></div> : estado.clienteId !== clienteId || carregando ? <p role="status">Carregando produtos essenciais…</p> : <>
    <ResumoEssenciais itens={estado.itens} />
    {estado.mais && <Button type="button" variant="secondary" onClick={() => { setCarregando(true); setPagina(p => p + 1) }}>Consultar respostas mais antigas</Button>}
  </>}</div>
}
