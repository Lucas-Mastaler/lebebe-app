'use client'
import { useEffect, useRef, useState } from 'react'
import { ParentescoCriancaField } from './ParentescoCriancaField'
import { IdadeCriancaSelector } from './IdadeCriancaSelector'
import { Alert, Button, Card, CardContent, FormField, Input } from '@/components/design-system'
import { descreverInformacaoNascimento, opcoesCriancasDisponiveis, selecionarCriancaCadastrada, type CriancaReutilizavel } from '@/lib/atendimento-presencial/criancas-permanentes'
import type { FichaCriancaRascunho } from '@/lib/atendimento-presencial/ficha-schema'
import { criancaJaNasceu } from '@/lib/atendimento-presencial/idade-aproximada'

type Props = {
  clienteId: string
  rascunhoId: string | null
  selecionadas: FichaCriancaRascunho[]
  sincronizar: () => Promise<unknown>
  selecionar: (crianca: FichaCriancaRascunho) => void
  cadastrar: () => void
}
export function CriancasCadastradas({ clienteId, rascunhoId, selecionadas, sincronizar, selecionar, cadastrar }: Props) {
  const [permanentes, setPermanentes] = useState<CriancaReutilizavel[]>([])
  const [historicas, setHistoricas] = useState<CriancaReutilizavel[]>([])
  const [aberto, setAberto] = useState(true)
  const [opcoes, setOpcoes] = useState(false)
  const [confirmando, setConfirmando] = useState<CriancaReutilizavel | null>(null)
  const [revisando, setRevisando] = useState(false)
  const raizRef = useRef<HTMLDivElement>(null)
  const dadosOriginaisRef = useRef<FichaCriancaRascunho | null>(null)
  const [parentesco, setParentesco] = useState('')
  const [nome, setNome] = useState('')
  const [associarId, setAssociarId] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [carregando, setCarregando] = useState(false)
  const emCurso = useRef(false)
  const geracao = useRef(0)
  const disponiveis = opcoesCriancasDisponiveis(permanentes, selecionadas, clienteId)
  const limite = selecionadas.length >= 8
  const informacaoNascimento = confirmando ? descreverInformacaoNascimento(confirmando) : ''
  const separadorInformacao = informacaoNascimento.indexOf(':')

  useEffect(() => {
    if (!confirmando?.id) return
    const frame = window.requestAnimationFrame(() => {
      const bloco = document.getElementById('confirmacao-crianca-historica')
      bloco?.focus({ preventScroll: true })
      bloco?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [confirmando?.id])

  useEffect(() => {
    const controller = new AbortController()
    const atual = ++geracao.current
    setPermanentes([]); setHistoricas([]); setConfirmando(null); setErro(null); setAberto(true); setOpcoes(false)
    if (!rascunhoId) return () => { controller.abort() }
    setCarregando(true)
    // A lista exige o cliente já sincronizado no rascunho para impedir BOLA.
    void (async () => {
      try {
        await sincronizar()
        if (atual !== geracao.current) return
        const response = await fetch(`/api/atendimento-presencial/clientes/${clienteId}/criancas?rascunhoId=${rascunhoId}`, { cache: 'no-store', signal: controller.signal })
        const data = await response.json()
        if (atual !== geracao.current) return
        if (!response.ok || !data.ok) throw new Error(data.message ?? 'Não foi possível carregar as crianças.')
        setPermanentes(data.permanentes); setHistoricas(data.historicas)
      } catch (error) {
        if (atual === geracao.current && !controller.signal.aborted) setErro(error instanceof Error ? error.message : 'Não foi possível carregar as crianças.')
      } finally { if (atual === geracao.current) setCarregando(false) }
    })()
    return () => { controller.abort(); geracao.current = atual + 1 }
    // A mudança de cliente/rascunho inicia outra consulta; funções do formulário mudam a cada edição.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clienteId, rascunhoId])

  async function confirmar() {
    if (!confirmando || !rascunhoId || emCurso.current || limite) return
    if (parentesco.trim().length < 2) { setErro('Confirme o parentesco.'); return }
    emCurso.current = true; setOcupado(true); setErro(null)
    const atual = geracao.current
    try {
      await sincronizar()
      if (atual !== geracao.current) return
      const response = await fetch(`/api/atendimento-presencial/clientes/${clienteId}/criancas`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rascunhoId, origemId: confirmando.id, parentesco: parentesco.trim(), dados: { ...confirmando.dados, nome: nome.trim() || undefined, nomeNaoInformado: nome.trim() ? false : confirmando.dados.nomeNaoInformado }, associarId: associarId || null }) })
      const data = await response.json()
      if (atual !== geracao.current) return
      if (!response.ok || !data.ok) throw new Error(data.message ?? 'Não foi possível confirmar a criança.')
      // Uma resposta perdida é recuperada pela correspondência única na repetição, sem novo cadastro.
      setPermanentes(data.permanentes); setHistoricas(data.historicas); setConfirmando(null)
      const confirmado = (data.permanentes as CriancaReutilizavel[]).find((item) => item.id === data.confirmadoId)
      if (confirmado) { selecionar(selecionarCriancaCadastrada(confirmado, clienteId)); setAberto(false); setOpcoes(false) }
      else setAberto(true)
    } catch (error) { if (atual === geracao.current) setErro(error instanceof Error ? error.message : 'Não foi possível confirmar a criança.') }
    finally { emCurso.current = false; if (atual === geracao.current) setOcupado(false) }
  }

  return <div ref={raizRef} tabIndex={-1} className="grid gap-3">
    {erro && <Alert tone="danger">{erro}</Alert>}
    {carregando && <p role="status">Carregando crianças cadastradas…</p>}
    {aberto && !carregando && <div className="grid gap-4">
      <div className="grid gap-2" role="group" aria-label="Crianças cadastradas">
      <h3 className="font-semibold">Crianças cadastradas</h3>
      {disponiveis.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma outra criança cadastrada.</p>}
      {disponiveis.map((item) => <Card key={item.id} className="shadow-none" data-crianca-opcao="permanente"><Button type="button" variant="ghost" className="h-auto min-h-12 w-full justify-between whitespace-normal rounded-2xl p-3 text-left hover:bg-primary/5 focus-visible:ring-inset" aria-label={`Selecionar ${item.dados.nome || 'Nome não informado'} — ${item.parentesco}`} disabled={limite || ocupado} onClick={() => { selecionar(selecionarCriancaCadastrada(item, clienteId)); setAberto(false); setOpcoes(false) }}>
        <span className="min-w-0 space-y-1">
          <span role="heading" aria-level={4} className="block break-words text-sm font-semibold text-slate-950">{item.dados.nome || 'Nome não informado'}</span>
          <span className="block text-sm text-muted-foreground">{item.parentesco || 'Parentesco não informado'}</span>
          <span className="block text-xs text-muted-foreground">{descreverInformacaoNascimento(item)}</span>
        </span>
        <span className="shrink-0 text-sm font-semibold text-primary">Selecionar →</span>
      </Button></Card>)}
      </div>
      {historicas.length > 0 && <div className="grid gap-2 border-t border-slate-200 pt-3" role="group" aria-label="Sugestões históricas">
        <div><h3 className="text-sm font-semibold text-slate-950">Sugestões históricas</h3><p className="mt-1 text-xs text-muted-foreground">Confirme os dados antes de reutilizar.</p></div>
        {historicas.map((item) => <Card key={item.id} className={confirmando?.id === item.id ? "border-primary shadow-none" : "shadow-none"} data-crianca-opcao="historica"><Button type="button" variant="ghost" className="h-auto min-h-12 w-full justify-between whitespace-normal rounded-2xl p-3 text-left hover:bg-primary/5 focus-visible:ring-inset" aria-pressed={confirmando?.id === item.id} aria-label={`Confirmar ${item.dados.nome || 'Nome não informado'} — ${descreverInformacaoNascimento(item)}`} disabled={limite || ocupado} onClick={() => { if (confirmando?.id === item.id) return; dadosOriginaisRef.current = item.dados; setConfirmando(item); setNome(item.dados.nome ?? ''); setParentesco(''); setAssociarId(''); setErro(null); setRevisando(false); setAberto(false); setOpcoes(false) }}>
          <span className="min-w-0 space-y-1">
            <span role="heading" aria-level={4} className="block break-words text-sm font-semibold text-slate-950">{item.dados.nome || 'Nome não informado'}</span>
            <span className="block text-xs text-muted-foreground">{item.dados.idadeValor && item.dados.idadeUnidade ? `Idade informada: ${item.dados.idadeValor} ${item.dados.idadeUnidade}` : descreverInformacaoNascimento(item)}</span>
            <span className="block text-xs text-muted-foreground">Atendimento em {item.registradoEm.slice(0, 10).split('-').reverse().join('/')}</span>
            <span className="block text-xs text-muted-foreground">Registro {item.atendimentoId?.slice(0, 8)}</span>
          </span>
          <span className="shrink-0 text-sm font-semibold text-primary">Selecionar →</span>
        </Button></Card>)}
      </div>}
    </div>}
    {confirmando && <Card id="confirmacao-crianca-historica" tabIndex={-1} className="scroll-mt-32 scroll-mb-48"><CardContent className="grid gap-3 p-4">
      <h3 className="font-semibold">Confirmar criança histórica</h3>
      <p className="font-semibold text-primary"><strong className="text-foreground">{confirmando.dados.nome || 'Nome não informado'}</strong> selecionada. Complete os dados abaixo e confirme o cadastro.</p>
      <div className="space-y-2 text-sm">
        <p>{separadorInformacao >= 0 ? <><strong>{informacaoNascimento.slice(0, separadorInformacao + 1)}</strong>{informacaoNascimento.slice(separadorInformacao + 1)}</> : informacaoNascimento}</p>
        <p>O cadastro será salvo mesmo se este atendimento não for concluído.</p>
      </div>
      {(!dadosOriginaisRef.current?.nome || revisando) && <FormField id="historica-nome" label="Nome" helper="Opcional">{(field) => <Input {...field} value={nome} maxLength={80} disabled={ocupado || !!associarId} onChange={(e) => setNome(e.target.value)} />}</FormField>}
      {confirmando.dados.situacao === 'presente_outra_pessoa' && (dadosOriginaisRef.current?.presenteJaNasceu === undefined || revisando) && <FormField id="historica-presente-nasceu" label="Já nasceu?" required>{(field) => <select {...field} className="w-full rounded-md border p-2" disabled={ocupado || !!associarId} value={confirmando.dados.presenteJaNasceu === undefined ? '' : String(confirmando.dados.presenteJaNasceu)} onChange={(e) => setConfirmando({ ...confirmando, dados: { ...confirmando.dados, presenteJaNasceu: e.target.value === '' ? undefined : e.target.value === 'true', idadeUnidade: undefined, idadeValor: undefined, dataPrevistaNascimento: undefined, dataReferenciaNascimento: undefined } })}><option value="">Selecione</option><option value="true">Sim</option><option value="false">Não</option></select>}</FormField>}
      {criancaJaNasceu(confirmando.dados) && (!dadosOriginaisRef.current?.idadeUnidade || !dadosOriginaisRef.current?.idadeValor || revisando) && <div className="grid gap-3">
        <p className="text-sm font-semibold text-slate-700">Idade informada *</p>
        <IdadeCriancaSelector unidade={confirmando.dados.idadeUnidade} valor={confirmando.dados.idadeValor} disabled={ocupado || !!associarId} onChange={(idade) => setConfirmando({ ...confirmando, dados: { ...confirmando.dados, ...idade } })} />
      </div>}
      {revisando && confirmando.dados.dataPrevistaNascimento && <FormField id="historica-previsao" label="Previsão informada" helper="Opcional; não representa nascimento confirmado">{(field) => <Input {...field} type="date" value={confirmando.dados.dataPrevistaNascimento} disabled={ocupado || !!associarId} onChange={(e) => setConfirmando({ ...confirmando, dados: { ...confirmando.dados, dataPrevistaNascimento: e.target.value || undefined } })} />}</FormField>}
      <ParentescoCriancaField id="historica-parentesco" value={parentesco} disabled={ocupado} error={erro === 'Confirme o parentesco.' ? erro : undefined} onChange={(valor) => { setParentesco(valor); setErro(null) }} />
      <Button type="button" variant="ghost" size="sm" disabled={ocupado} onClick={() => setRevisando(!revisando)}>{revisando ? 'Recolher revisão opcional' : 'Revisar dados ou associar a cadastro existente'}</Button>
      {revisando && permanentes.length > 0 && <FormField id="historica-associar" label="Associar a cadastro existente" helper="Opcional; somente se você reconhece a mesma criança">
        {(field) => <select {...field} className="w-full rounded-md border p-2" value={associarId} disabled={ocupado} onChange={(e) => { setAssociarId(e.target.value); const item = permanentes.find((p) => p.id === e.target.value); if (item) setParentesco(item.parentesco ?? '') }}>
          <option value="">Criar cadastro desta criança histórica</option>{permanentes.map((p) => <option key={p.id} value={p.id}>{p.dados.nome || 'Nome não informado'} — {p.parentesco} — {descreverInformacaoNascimento(p)}</option>)}
        </select>}
      </FormField>}
      <div className="flex flex-wrap gap-2"><Button type="button" loading={ocupado} disabled={limite} onClick={() => void confirmar()}>Confirmar cadastro</Button><Button type="button" variant="ghost" disabled={ocupado} onClick={() => { setConfirmando(null); setAberto(true); window.requestAnimationFrame(() => raizRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })) }}>Cancelar</Button></div>
    </CardContent></Card>}
    {!confirmando && <Button type="button" variant="secondary" disabled={limite || ocupado} onClick={() => {
      if (permanentes.length || historicas.length) setOpcoes(!opcoes)
      else cadastrar()
    }}>{limite ? 'Limite de oito crianças atingido' : 'Adicionar outra criança'}</Button>}
    {opcoes && <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      <Button type="button" variant="secondary" className="min-h-12 w-full" onClick={() => { setAberto(true); setOpcoes(false) }}>Crianças cadastradas</Button>
      <Button type="button" variant="secondary" className="min-h-12 w-full" onClick={() => { cadastrar(); setOpcoes(false); setAberto(false) }}>Cadastrar nova criança</Button>
    </div>}
  </div>
}
