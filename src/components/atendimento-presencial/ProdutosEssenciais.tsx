'use client'
import { useState } from 'react'
import { Baby, CheckCircle2, ChevronDown, ChevronUp, Plus } from 'lucide-react'
import { Button } from '@/components/design-system'
import type { FichaCriancaRascunho } from '@/lib/atendimento-presencial/ficha-schema'
import { faseEssenciais, pendenciaEssenciais, PRODUTOS_ESSENCIAIS, produtosEssenciaisDaFase, respostaEssencial, rotuloFaseEssenciais, type EssenciaisRascunho, type EstadoEssenciais, type ProdutoEssencial, type RespostaEssencial } from '@/lib/atendimento-presencial/essenciais'
import { chaveProduto, descricaoProduto, type ProdutoCompativel } from '@/lib/atendimento-presencial/produtos'
import styles from './essenciais.module.css'

type Props = {
  criancas: FichaCriancaRascunho[]; respostas: EssenciaisRascunho; anteriores: EstadoEssenciais; hoje: string;
  carregando: boolean; erro: string | null; erroValidacao?: string; tentar: () => void;
  responder: (crianca: string, produto: ProdutoEssencial, resposta: RespostaEssencial) => void;
  interesses: ProdutoCompativel[]; adicionar: (nome: string) => string | null; confirmarFase: (id: string) => void; historico: () => void;
}

export function ProdutosEssenciais(props: Props) {
  const [recolhido, setRecolhido] = useState(false)
  const [selecionada, setSelecionada] = useState('')
  const [feedback, setFeedback] = useState('')
  const c = props.criancas.find(c => c.id === selecionada) ?? props.criancas[0]
  if (!c) return null
  const meses = faseEssenciais(c, props.hoje)
  const produtos = produtosEssenciaisDaFase(meses)
  const linhas = produtos.map(p => ({ produto: p, ...respostaEssencial(c, p, props.respostas, props.anteriores) }))
  const sim = linhas.filter(l => l.resposta === 'sim').length
  const nao = linhas.filter(l => l.resposta === 'nao').length
  const respondidos = linhas.filter(l => l.confirmada).length
  const expandido = !recolhido || !!props.erroValidacao
  return <section id="secao-essenciais" tabIndex={-1} className={styles.secao} aria-labelledby="titulo-essenciais">
    <div className={styles.cabecalho}>
      <svg className={styles.icone} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m8 3-5 3 2 4 3-1v7l3 5h2l3-5V9l3 1 2-4-5-3" /><path d="M8 3c0 4 8 4 8 0M10 17h4M12 19h.01" /></svg>
      <div className={styles.titulos}><h3 id="titulo-essenciais">Produtos essenciais — Já possui?</h3>
        <p>{expandido ? 'Pergunte à cliente se a criança já possui estes itens.' : `${c.nome || 'Nome não informado'} · ${rotuloFaseEssenciais(meses)}`}</p></div>
      <button type="button" className={styles.recolher} aria-label={expandido ? 'Recolher produtos essenciais' : 'Expandir produtos essenciais'} aria-expanded={expandido} aria-controls="conteudo-essenciais" onClick={() => setRecolhido(!recolhido)}>{expandido ? <ChevronUp /> : <ChevronDown />}</button>
    </div>
    {props.criancas.length > 1 && <div className={styles.seletor}><label htmlFor="crianca-essenciais">Criança</label><select id="crianca-essenciais" value={c.id} onChange={e => { setSelecionada(e.target.value); setFeedback('') }}>{props.criancas.map(cr => <option key={cr.id} value={cr.id}>{cr.nome || 'Nome não informado'}{pendenciaEssenciais([cr], props.respostas, props.anteriores, props.hoje) ? ' · pendente' : ''}</option>)}</select></div>}
    {props.carregando && <p role="status">Carregando respostas anteriores…</p>}
    {props.erro && <div role="alert"><p>{props.erro}</p><Button type="button" variant="secondary" onClick={props.tentar}>Tentar novamente</Button></div>}
    {!props.carregando && !props.erro && <>
      {!expandido && meses !== null && meses <= 12 && <div className={styles.totais}><div><strong>{respondidos} de {produtos.length}</strong><span>respondidos</span></div><div><strong>{sim}</strong><span>já possui</span></div><div><strong>{nao}</strong><span>não possui</span></div></div>}
      {!expandido && meses === null && <p>Confirme gestação ou idade para apresentar os produtos.</p>}
      {!expandido && meses !== null && meses > 12 && <p>Sem questionário para esta faixa.</p>}
      {expandido && <div id="conteudo-essenciais">
        <div className={styles.identificacao}><Baby aria-hidden="true" /><div><p><strong>Criança:</strong> {rotuloFaseEssenciais(meses)}</p><p className={styles.nome}>{c.nome || 'Nome não informado'}</p>{meses !== null && meses <= 12 && <p aria-live="polite">{respondidos} de {produtos.length} respondidos</p>}</div></div>
        {c.dataPrevistaNascimento && meses === -1 && c.dataPrevistaNascimento < props.hoje && <p role="status" className={styles.pendente}>A previsão de nascimento já passou. Confirme se a criança já nasceu.</p>}
        {meses === null && <div><p>Confirme gestação ou idade antes de apresentar os produtos.</p><Button type="button" variant="secondary" onClick={() => props.confirmarFase(c.id)}>Confirmar fase da criança</Button></div>}
        {meses !== null && meses > 12 && <p>Não há perguntas para esta faixa. As respostas anteriores continuam disponíveis no histórico.</p>}
        <div className={styles.grade}>{linhas.map(l => <div key={l.produto} className={styles.item} role="group" aria-label={PRODUTOS_ESSENCIAIS[l.produto]}>
          <div className={styles.linha}><span className={styles.produto}>{PRODUTOS_ESSENCIAIS[l.produto]}</span><div className={styles.opcoes}>{(['sim', 'nao'] as const).map(valor => <button type="button" key={valor} aria-pressed={l.resposta === valor} aria-label={`${PRODUTOS_ESSENCIAIS[l.produto]}: ${valor === 'sim' ? 'Sim' : 'Não'}`} className={`${styles.opcao} ${l.resposta === valor ? styles.ativa : ''}`} onClick={() => props.responder(c.id, l.produto, valor)}>{valor === 'sim' ? 'Sim' : 'Não'}</button>)}</div></div>
          {l.anterior && !props.respostas[c.id]?.[l.produto] && <details className={styles.pendente}><summary>{l.anterior.resposta === 'nao' ? 'Não anterior · confirme novamente' : 'Sim informado anteriormente'}</summary><p>{l.anterior.consultora} · {l.anterior.filial} · {new Date(l.anterior.registradoEm).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</p></details>}
          {l.resposta === 'nao' && (props.interesses.some(item => chaveProduto(descricaoProduto(item)) === chaveProduto(PRODUTOS_ESSENCIAIS[l.produto]))
            ? <span className={styles.interesseAdicionado} role="status"><CheckCircle2 size={14} aria-hidden="true" />Adicionado aos interesses</span>
            : <button type="button" className={styles.interesseProduto} onClick={() => setFeedback(props.adicionar(PRODUTOS_ESSENCIAIS[l.produto]) ?? '')}><Plus size={14} aria-hidden="true" />Adicionar aos interesses</button>)}
        </div>)}</div>
      </div>}
      <button type="button" className={styles.interesse} onClick={props.historico}>Consultar respostas anteriores</button>
    </>}
    {feedback && <p role="status" aria-live="polite">{feedback}</p>}
    {props.erroValidacao && <p role="alert" className={styles.erro}>{props.erroValidacao}</p>}
  </section>
}
