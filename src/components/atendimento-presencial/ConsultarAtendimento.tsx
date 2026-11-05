'use client'
import { useRef, useState } from 'react'
import { Button } from '@/components/design-system'
import { DetalhesAtendimentoDialog } from './DetalhesAtendimentoDialog'
import type { RegistroAtendimentoDetalheDTO } from '@/lib/atendimento-presencial/registros'
import { ShoppingCart } from 'lucide-react'
import { AcaoNegociacao } from './AcaoNegociacao'

export function ConsultarAtendimento({ id, label = 'Ver atendimento', apresentacao, descricao }: { id: string; label?: string; apresentacao?: 'card'; descricao?: string }) {
  const [aberto, setAberto] = useState(false), [carregando, setCarregando] = useState(false)
  const [detalhe, setDetalhe] = useState<RegistroAtendimentoDetalheDTO | null>(null), [erro, setErro] = useState<string | null>(null)
  const pedido = useRef(0)
  async function consultar() {
    const ticket = ++pedido.current; setAberto(true); setCarregando(true); setErro(null); setDetalhe(null)
    try { const r = await fetch(`/api/atendimento-presencial/atendimentos/${id}`, { cache: 'no-store' }); const b = await r.json(); if (!r.ok || !b.ok) throw new Error(b.message || 'Atendimento indisponível.'); if (ticket === pedido.current) setDetalhe(b) }
    catch (e) { if (ticket === pedido.current) setErro(e instanceof Error ? e.message : 'Falha na consulta.') }
    finally { if (ticket === pedido.current) setCarregando(false) }
  }
  return <>{apresentacao === 'card' ? <AcaoNegociacao titulo={label} descricao={descricao || ''} icone={ShoppingCart} destaque onClick={() => void consultar()} /> : <Button variant="secondary" size="sm" onClick={() => void consultar()}>{label}</Button>}<DetalhesAtendimentoDialog open={aberto} onOpenChange={setAberto} detalhe={detalhe} carregando={carregando} erro={erro} leituraSomente ocultarAtualizacaoComercial /></>
}
