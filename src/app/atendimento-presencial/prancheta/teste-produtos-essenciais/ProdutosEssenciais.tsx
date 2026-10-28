'use client'
import { useState } from 'react'
import { Baby, ChevronDown, ChevronUp, Plus } from 'lucide-react'
import type { FichaCriancaRascunho } from '@/lib/atendimento-presencial/ficha-schema'
import { dataAtendimentoLocal } from '@/lib/atendimento-presencial/idade-aproximada'
import { Button } from '@/components/design-system'
import { useLaboratorio } from './LaboratorioContext'
import { estaConfirmado, fase, identidade, PRODUTOS, produtosDaFase, resumo, rotuloFase } from './modelo'
import styles from './essenciais.module.css'

export function ProdutosEssenciais({ criancas, adicionar }: { criancas: FichaCriancaRascunho[]; adicionar: (nome: string) => void }) {
  const lab = useLaboratorio()
  const [recolhido, setRecolhido] = useState(false)
  const participantes = criancas.filter(c => {
    const meses = lab.fases[identidade(c)] ?? fase(c, dataAtendimentoLocal())
    return meses === null || meses <= 12
  })
  if (!participantes.length) return null
  const crianca = participantes.find(c => identidade(c) === lab.selecionada) ?? participantes[0]
  const id = identidade(crianca)
  const meses = lab.fases[id] ?? fase(crianca, dataAtendimentoLocal())
  const produtos = produtosDaFase(meses)
  const respostas = lab.respostas[id] ?? {}
  const contagem = resumo(produtos, respostas, lab.atendimento)
  const pendentes = contagem.total - contagem.respondidos
  const expandido = !recolhido || (lab.erros && (pendentes > 0 || meses === null))
  return <section id="secao-essenciais" tabIndex={-1} className={styles.secao} aria-labelledby="titulo-essenciais" data-essenciais="true">
    <div className={styles.cabecalho}>
      <svg className={styles.icone} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m8 3-5 3 2 4 3-1v7l3 5h2l3-5V9l3 1 2-4-5-3" /><path d="M8 3c0 4 8 4 8 0M10 17h4M12 19h.01" /></svg>
      <div className={styles.titulos}>
        <h3 id="titulo-essenciais">Produtos essenciais — Já possui?</h3>
        {expandido ? <p>Pergunte à cliente se a criança já possui estes itens.</p> : <p className={styles.criancaResumo}><strong>Criança:</strong> {rotuloFase(meses)}</p>}
      </div>
      <button type="button" className={styles.recolher} aria-label={expandido ? 'Recolher produtos essenciais' : 'Expandir produtos essenciais'} aria-expanded={expandido} aria-controls="conteudo-essenciais" onClick={() => setRecolhido(expandido)}>
        {expandido ? <ChevronUp aria-hidden="true" /> : <ChevronDown aria-hidden="true" />}
      </button>
    </div>
    {participantes.length > 1 && <div className={styles.seletor}><label htmlFor="crianca-essenciais">Criança</label><select id="crianca-essenciais" value={id} onChange={e => lab.selecionar(e.target.value)}>{participantes.map(c => <option key={identidade(c)} value={identidade(c)}>{c.nome || 'Nome não informado'}</option>)}</select></div>}
    {!expandido && <div className={styles.totais} aria-live="polite">
      <div><strong>{contagem.respondidos} de {contagem.total}</strong><span>respondidos</span></div>
      <div><strong>{contagem.sim}</strong><span>já possui</span></div>
      <div><strong>{contagem.nao}</strong><span>não possui</span></div>
    </div>}
    {expandido && <div id="conteudo-essenciais">
      <div className={styles.identificacao}><Baby aria-hidden="true" /><div><p><strong>Criança:</strong> {rotuloFase(meses)}</p><p className={styles.nome}>{crianca.nome || 'Nome não informado'}</p><p aria-live="polite">{contagem.respondidos} de {contagem.total} respondidos{pendentes ? ` · ${pendentes} pendente${pendentes > 1 ? 's' : ''}` : ''}</p></div></div>
      {meses === null && <div className={styles.fase}><label htmlFor="fase-essenciais">Confirme a fase atual da criança *</label><select id="fase-essenciais" defaultValue="" onChange={e => { if (e.target.value !== '') lab.selecionarFase(id, Number(e.target.value)) }}><option value="">Selecione a fase</option><option value="-1">Gestação</option>{[0,1,2,3,4,5,6,7,8,9,10,11,12,13].map(m => <option key={m} value={m}>{m === 13 ? 'Acima de 12 meses' : `${m} meses`}</option>)}</select></div>}
      <div className={styles.grade}>
        {produtos.map(produto => {
          const registro = respostas[produto]
          const reconfirmar = registro?.resposta === 'nao' && registro.atendimento !== lab.atendimento
          const erro = lab.erros && !lab.legado && !estaConfirmado(registro, lab.atendimento)
          return <div key={produto} className={`${styles.item} ${erro ? styles.erroItem : ''}`} role="group" aria-label={PRODUTOS[produto]}>
            <div className={styles.linha}><span className={styles.produto}>{PRODUTOS[produto]}</span><div className={styles.opcoes}>{(['sim', 'nao'] as const).map(valor => <button type="button" key={valor} aria-pressed={registro?.resposta === valor} aria-label={`${PRODUTOS[produto]}: ${valor === 'sim' ? 'Sim' : 'Não'}`} className={`${styles.opcao} ${registro?.resposta === valor ? styles.ativa : ''}`} onClick={() => lab.responder(id, produto, valor)}>{valor === 'sim' ? 'Sim' : 'Não'}</button>)}</div></div>
            {(!registro || reconfirmar) && <p className={styles.pendente}>{reconfirmar ? 'Não anterior · confirme novamente' : 'Não informado'}</p>}
            {registro?.resposta === 'nao' && <button type="button" className={styles.interesse} aria-label={`Adicionar ${PRODUTOS[produto]} aos produtos de interesse`} onClick={() => adicionar(PRODUTOS[produto])}><Plus size={12} aria-hidden="true" />Adicionar ao interesse</button>}
          </div>
        })}
      </div>
    </div>}
    {pendentes > 0 && !expandido && <p className={styles.pendente} role="status">{pendentes} pergunta(s) pendente(s), incluindo reconfirmações.</p>}
    {lab.erros && !lab.legado && (pendentes > 0 || meses === null) && <p className={styles.erro} role="alert">{meses === null ? 'Confirme a fase atual para continuar.' : 'Responda ou reconfirme os itens pendentes antes de concluir.'}</p>}
    {lab.legado && <p className={styles.pendente}>Atendimento anterior à implantação: preenchimento não obrigatório.</p>}
    <span className="sr-only">{crianca.nome}. {rotuloFase(meses)}.</span>
    {lab.erros && !expandido && <Button type="button" variant="ghost" onClick={() => setRecolhido(false)}>Conferir respostas</Button>}
  </section>
}
