'use client'
import { useEffect, useState } from 'react'
import { Alert, Button } from '@/components/design-system'
import { dataAtendimentoLocal } from '@/lib/atendimento-presencial/idade-aproximada'
import type { FichaCriancaRascunho } from '@/lib/atendimento-presencial/ficha-schema'
import { criarCrianca, criarSimulador, CONTEXTO, ID } from './simulador'
import { confirmar, fase, identidade, primeiraPendente, PRODUTOS, produtosDaFase, type Evento, type Produto, type Resposta, type Respostas } from './modelo'
import { LaboratorioContext } from './LaboratorioContext'
import FichaExperimental from './FichaExperimental'

const CENARIOS = [
  ['gestacao', 'Gestação', -1], ['2', '2 meses', 2], ['5', '5 meses', 5], ['9', '9 meses', 9], ['13', 'Acima de 12 meses', 13],
  ['duas', 'Duas crianças', -1], ['incerta', 'Fase desconhecida', null],
] as const
export default function PageClient() {
  const [simulador, setSimulador] = useState(criarSimulador)
  const [cenario, setCenario] = useState('gestacao')
  const [montagem, setMontagem] = useState(0)
  const [rodada, setRodada] = useState(1)
  const [respostas, setRespostas] = useState<Respostas>({})
  const [eventos, setEventos] = useState<Evento[]>([])
  const [fases, setFases] = useState<Record<string, number>>({})
  const [selecionada, selecionar] = useState('')
  const [erros, setErros] = useState(false)
  const [legado, setLegado] = useState(false)
  const [mensagem, setMensagem] = useState('')
  const [navegador] = useState(() => ({ push: (url: string) => setMensagem(`Navegação simulada: ${url}. Você continua no laboratório.`), replace: () => {}, refresh: () => {} }))
  const atendimento = `atendimento-${rodada}`
  useEffect(() => {
    simulador.definirAoNovoAtendimento(() => { setRodada(v => v + 1); setErros(false) })
    return () => simulador.definirAoNovoAtendimento()
  }, [simulador])
  function preparar(valor: string, proximaRodada = rodada, unidade = simulador.atual.unidadeId) {
    const item = CENARIOS.find(c => c[0] === valor) ?? CENARIOS[0]
    const criancas = [criarCrianca(item[2])]
    if (valor === 'duas') criancas.push(criarCrianca(5, 2))
    simulador.storage.clear()
    simulador.preparar(criancas, unidade)
    setCenario(valor); setRodada(proximaRodada); setMontagem(v => v + 1); setErros(false); setMensagem(''); selecionar('')
  }
  function responder(id: string, produto: Produto, resposta: Resposta) {
    setRespostas(anteriores => confirmar(anteriores, id, produto, resposta, atendimento))
    setEventos(anteriores => [...anteriores, { crianca: id, produto, anterior: respostas[id]?.[produto]?.resposta, resposta, atendimento, instante: new Date().toISOString() }])
  }
  function validar(criancas: FichaCriancaRascunho[]) {
    const pendente = legado ? undefined : primeiraPendente(criancas, respostas, atendimento, fases, dataAtendimentoLocal())
    setErros(!!pendente)
    if (pendente) selecionar(identidade(pendente))
    return !pendente
  }
  function preencherExemplo() {
    const criancas = simulador.atual.dadosRascunho.criancas
    let novas = respostas
    const novosEventos: Evento[] = []
    for (const c of criancas) produtosDaFase(fases[identidade(c)] ?? fase(c, dataAtendimentoLocal())).forEach((p, i) => {
      const resposta = i < 5 ? 'sim' : 'nao'
      novosEventos.push({ crianca: identidade(c), produto: p, anterior: novas[identidade(c)]?.[p]?.resposta, resposta, atendimento, instante: new Date().toISOString() })
      novas = confirmar(novas, identidade(c), p, resposta, atendimento)
    })
    setRespostas(novas); setEventos(e => [...e, ...novosEventos]); setErros(false)
  }
  return <LaboratorioContext.Provider value={{ simulador, respostas, eventos, atendimento, legado, fases, selecionarFase: (id, meses) => setFases(f => ({ ...f, [id]: meses })), responder, selecionada, selecionar, erros, validar, navegador }}>
    <aside className="mx-auto mb-6 max-w-6xl space-y-3 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-4" aria-label="Painel de simulação">
      <div><h1 className="text-lg font-bold text-slate-900">Laboratório — Produtos essenciais</h1><p className="text-sm text-slate-600">Dados fictícios somente em memória. Atualizar esta página reinicia a simulação. Não utilizar em atendimentos reais.</p></div>
      <div className="flex flex-wrap items-end gap-3">
        <label className="grid gap-1 text-sm font-medium">Cenário<select aria-label="Cenário de simulação" value={cenario} onChange={e => { setFases({}); preparar(e.target.value) }} className="min-h-10 rounded-md border bg-white px-2">{CENARIOS.map(([valor, texto]) => <option key={valor} value={valor}>{texto}</option>)}</select></label>
        <label className="grid gap-1 text-sm font-medium">Filial fictícia<select aria-label="Filial fictícia" value={simulador.atual.unidadeId} onChange={e => preparar(cenario, rodada, e.target.value)} className="min-h-10 rounded-md border bg-white px-2">{CONTEXTO.unidadesPermitidas.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}</select></label>
        <Button type="button" variant="secondary" onClick={() => {
          const criancas = structuredClone(simulador.atual.dadosRascunho.criancas)
          const unidade = simulador.atual.unidadeId
          simulador.storage.clear(); simulador.preparar(criancas, unidade)
          setRodada(v => v + 1); setMontagem(v => v + 1); setErros(false); setMensagem(''); selecionar('')
        }}>Próximo atendimento</Button>
        <Button type="button" variant="secondary" onClick={preencherExemplo}>Preencher exemplo</Button>
        <Button type="button" variant="secondary" onClick={() => setMensagem(validar(simulador.atual.dadosRascunho.criancas) ? 'Essenciais válidos para este atendimento simulado.' : 'Há perguntas ou reconfirmações pendentes.')}>Validar essenciais</Button>
        <Button type="button" variant="ghost" onClick={() => { const novo = criarSimulador(); setSimulador(novo); setRespostas({}); setEventos([]); setFases({}); setRodada(1); setCenario('gestacao'); setMontagem(v => v + 1); setErros(false); setLegado(false); setMensagem(''); selecionar('') }}>Reiniciar tudo</Button>
      </div>
      <div className="flex flex-wrap items-center gap-4 text-sm"><strong>Atendimento simulado {rodada}</strong><label className="flex items-center gap-2"><input type="checkbox" checked={legado} onChange={e => { setLegado(e.target.checked); setErros(false) }} />Anterior à implantação</label><span>{eventos.length} evento(s) no histórico fictício</span></div>
      {mensagem && <Alert tone="info">{mensagem}</Alert>}
      <details><summary className="cursor-pointer text-sm font-medium">Histórico de respostas e reconfirmações</summary><div className="mt-2 max-h-48 overflow-auto text-xs">{eventos.length ? <ol className="space-y-1">{eventos.map((e, i) => <li key={i}>{e.atendimento} · {e.crianca.endsWith('2') ? 'Segunda criança' : 'Bebê demonstração'} · {PRODUTOS[e.produto]}: {e.anterior ?? 'não informado'} → {e.resposta}{e.anterior === e.resposta ? ' (reconfirmação)' : ''}</li>)}</ol> : <p>Nenhuma resposta registrada.</p>}</div></details>
    </aside>
    <div data-prancheta-reproduzida="true"><FichaExperimental key={montagem} usuarioId={ID.usuario} contextoInicial={CONTEXTO} unidadeIdInicial={simulador.atual.unidadeId} rascunhoIdInicial={simulador.atual.id} /></div>
  </LaboratorioContext.Provider>
}
