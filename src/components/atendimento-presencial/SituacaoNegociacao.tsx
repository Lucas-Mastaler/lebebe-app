'use client'
import { useEffect, useRef, useState } from 'react'
import { Badge } from '@/components/design-system'
import type { ResumoNegociacao } from '@/lib/atendimento-presencial/negociacoes'

export const EVENTO_NEGOCIACAO = 'prancheta-negociacao-atualizada'
export function useSituacoesNegociacoes(origens: string[]) {
  const chave = origens.join(',')
  const [resumos, setResumos] = useState<Record<string, ResumoNegociacao>>({})
  const [erro, setErro] = useState('')
  const versao = useRef(0)
  useEffect(() => {
    const controller = new AbortController()
    if (!chave) return
    async function carregar() {
      const ticket = ++versao.current
      try {
        const r = await fetch(`/api/atendimento-presencial/negociacoes?origens=${encodeURIComponent(chave)}`, { cache: 'no-store', signal: controller.signal })
        const body = await r.json()
        if (!r.ok || !body.ok) throw new Error(body.message || 'Situação comercial indisponível.')
        if (!controller.signal.aborted && ticket === versao.current) { setResumos(body.resumos); setErro('') }
      } catch (e) { if (!controller.signal.aborted && ticket === versao.current) setErro(e instanceof Error ? e.message : 'Situação comercial indisponível.') }
    }
    const atualizar = () => { void carregar() }
    void carregar(); window.addEventListener(EVENTO_NEGOCIACAO, atualizar)
    return () => { controller.abort(); window.removeEventListener(EVENTO_NEGOCIACAO, atualizar) }
  }, [chave])
  return { resumos, erro }
}
export function SituacaoAtualNegociacao({ resumo, erro }: { resumo?: ResumoNegociacao; erro?: string }) {
  return <div className="space-y-1 text-xs" aria-live="polite"><p className="font-semibold text-slate-600">Situação atual da negociação</p>{resumo ? <><Badge tone={resumo.situacao === 'venda' ? 'success' : resumo.situacao === 'perda' ? 'danger' : 'warning'}>{resumo.situacao === 'venda' ? 'Encerrada com venda' : resumo.situacao === 'perda' ? 'Encerrada com perda' : 'Aberta'}</Badge>{resumo.encerradoEm && <p className="text-slate-500">{resumo.canal === 'presencial' ? 'Venda vinculada' : 'Encerramento'}: {new Date(resumo.encerradoEm).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</p>}</> : <p className="text-slate-500">{erro || 'Consultando situação atual…'}</p>}</div>
}
