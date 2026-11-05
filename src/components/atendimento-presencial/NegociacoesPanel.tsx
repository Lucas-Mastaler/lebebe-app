'use client'
import { useRef, useState } from 'react'
import { ArrowLeft, CalendarDays, Check, Monitor, Pencil, Phone, RefreshCw, Trash2, Save, Search, ShoppingCart, UserRound } from 'lucide-react'
import styles from './NegociacoesPanel.module.css'
import { AcaoNegociacao } from './AcaoNegociacao'
import { NegociacaoJornada } from './NegociacaoJornada'
import { ConsultarAtendimento } from './ConsultarAtendimento'
import { EVENTO_NEGOCIACAO } from './SituacaoNegociacao'
import { Alert, Button, Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, FilterFieldGroup, FilterPanel, FormField, Input, Section, Textarea } from '@/components/design-system'
import { ProdutosAtendimento, ResumoProdutos } from './ProdutosAtendimento'
import { MOTIVOS_VENDA_PERDIDA, type FichaDadosRascunho } from '@/lib/atendimento-presencial/ficha-schema'
import { mensagemAtualizacao, type VendaDigital } from '@/lib/atendimento-presencial/negociacoes'
import type { ProdutoAtendimento } from '@/lib/atendimento-presencial/produtos'

type Digital = { atendimento_id?: string | null; numero_lancamento?: number | null; id: string; version: number; status: string; dados: VendaDigital }
type Evento = { id: string; acao: string; registrado_em: string; dados?: { motivo?: string; anterior?: Digital; novo?: Digital; atendimentoId?: string; vendaId?: string } }
type Retorno = { id: string; concluidoEm: string; resultado: string; filial: string; consultora: string; independente: boolean }
type Linha = { encerradoEm?: string | null; atendimentoId?: string | null; rascunhos?: number; origem_id: string; negociacao_id: string | null; cliente_id: string; nome: string; telefone_informado: string | null; filial: string; consultora_nome: string; iniciado_em: string; situacao: string; canal_encerramento: string | null; version: number; digitais: Digital[]; interesses?: ProdutoAtendimento[]; eventos?: Evento[]; retornos?: Retorno[] }
type Filtros = { nome: string; telefone: string; de: string; ate: string; situacao: string; canal: string }
const INICIAL: Filtros = { nome: '', telefone: '', de: '', ate: '', situacao: 'aberta', canal: '' }
const EVENTOS: Record<string, string> = { vincular_atendimento: 'Atendimento existente vinculado', criar_digital_integral: 'Prancheta digital iniciada', digital_integral_concluir: 'Venda digital concluída', digital_integral_corrigir: 'Ficha digital corrigida', digital_integral_correcao_motivo: 'Correção digital justificada', digital_integral_anular: 'Venda digital anulada', criar_retorno: 'Retorno iniciado', concluir_retorno: 'Visita de retorno registrada', vincular: 'Venda presencial vinculada', desvincular: 'Vínculo removido', corrigir_vinculo: 'Vínculo corrigido', perda: 'Negociação encerrada como perda', digital_rascunho: 'Rascunho digital salvo', digital_concluir: 'Venda digital concluída', digital_corrigir: 'Venda digital corrigida', digital_anular: 'Venda digital anulada' }
const fichaInicial = (): FichaDadosRascunho => ({ criancas: [], departamentos: [], motivosResultado: [], produtosInteresse: [], versaoProdutos: 2, etapaAtual: 'ficha' })
function dataLocal(valor: string | Date) { const data = new Date(valor); return new Date(data.getTime() - data.getTimezoneOffset() * 60000).toISOString().slice(0, 16) }

export function NegociacoesPanel({ origemId, clienteId, vendaId, triggerClassName, situacaoAtual }: { origemId?: string; clienteId?: string; vendaId?: string; triggerClassName?: string; situacaoAtual?: string }) {
  const [aberto, setAberto] = useState(false)
  const [linhas, setLinhas] = useState<Linha[]>([])
  const [selecionada, setSelecionada] = useState<Linha | null>(null)
  const [filtros, setFiltros] = useState(INICIAL)
  const [aplicados, setAplicados] = useState(INICIAL)
  const [pagina, setPagina] = useState(1)
  const [total, setTotal] = useState(0)
  const [unidades, setUnidades] = useState<{ id: string; nome: string }[]>([])
  const [gerir, setGerir] = useState(false)
  const [podeCriarRetorno, setPodeCriarRetorno] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const busy = useRef(false)
  const [erro, setErro] = useState('')
  const [mensagem, setMensagem] = useState('')
  const [modo, setModo] = useState('')
  const [unidade, setUnidade] = useState('')
  const [consultora, setConsultora] = useState('')
  const [canal, setCanal] = useState('whatsapp')
  const [canalOutro, setCanalOutro] = useState('')
  const [data, setData] = useState('')
  const [lancamento, setLancamento] = useState('')
  const [observacoes, setObservacoes] = useState('')
  const [motivo, setMotivo] = useState('')
  const [motivoPerda, setMotivoPerda] = useState('nao_respondeu')
  const [ficha, setFicha] = useState(fichaInicial)
  const [digitado, setDigitado] = useState('')
  const [digital, setDigital] = useState<{ id: string; version: number }>({ id: '', version: 0 })
  const operacao = useRef('')
  const [opcoesCorrecao, setOpcoesCorrecao] = useState<Linha[]>([])
  const [novaOrigem, setNovaOrigem] = useState('')
  const [paginaCorrecao, setPaginaCorrecao] = useState(1)
  const [totalCorrecao, setTotalCorrecao] = useState(0)
  const requisicao = useRef(0)
  const [associadoId, setAssociadoId] = useState('')
  const associacaoPedido = useRef('')

  async function carregar(page = 1, filtro = aplicados) {
    const ticket = ++requisicao.current
    setErro('')
    const params = new URLSearchParams({ ...filtro, pagina: String(page), ...(origemId ? { origemId } : {}), ...(clienteId ? { clienteId } : {}) })
    try {
      const resposta = await fetch(`/api/atendimento-presencial/negociacoes?${params}`, { cache: 'no-store' })
      const body = await resposta.json()
      if (!resposta.ok || !body.ok) throw new Error(body.message || 'Não foi possível consultar.')
      if (ticket !== requisicao.current) return
      if (origemId && !body.negociacoes?.length) throw new Error('Esta negociação não está disponível para consulta. Atualize os registros e tente novamente.')
      setLinhas(body.negociacoes); setTotal(body.total); setPagina(page); setUnidades(body.unidades); setGerir(body.podeGerir); setPodeCriarRetorno(body.podeCriarRetorno)
      if (origemId && body.negociacoes[0]) setSelecionada(body.negociacoes[0])
    } catch (e) { if (ticket === requisicao.current) setErro(e instanceof Error ? e.message : 'Falha na consulta.') }
  }

  function escolher(linha: Linha, acao: string, existente?: Digital) {
    if (existente?.atendimento_id && acao === 'corrigir') { window.location.assign(`/atendimento-presencial/registros?editar=${encodeURIComponent(existente.atendimento_id)}`); return }
    setSelecionada(linha); setModo(acao); setErro(''); setMensagem(''); setMotivo('')
    setUnidade(existente?.dados.unidadeId || unidades[0]?.id || '')
    setConsultora(existente?.dados.consultora || linha.consultora_nome || '')
    setDigital({ id: existente?.id || crypto.randomUUID(), version: existente?.version || 0 })
    setCanal(existente?.dados.canal || 'whatsapp'); setCanalOutro(existente?.dados.canalOutro || '')
    setData(dataLocal(existente?.dados.fechadoEm || new Date()))
    setLancamento(String(existente?.dados.numeroLancamento || '')); setObservacoes(existente?.dados.observacoes || '')
    setFicha({ ...fichaInicial(), produtosInteresse: existente?.dados.produtos || linha.interesses || [] })
    operacao.current = crypto.randomUUID()
    if (acao === 'corrigir_vinculo') {
      setNovaOrigem(''); setOpcoesCorrecao([])
      void carregarCorrecao(linha, 1)
    }
  }

  async function prepararAtualizacao(linha: Linha, acao: string) {
    if (acao === 'retorno') { escolher(linha, acao); return }
    setErro('')
    try {
      const r = await fetch('/api/atendimento-presencial/negociacoes?origemId=' + linha.origem_id, {cache:'no-store'})
      const b = await r.json()
      if (!r.ok || !b.ok || !b.negociacoes?.[0]) throw new Error(b.message || 'Não foi possível conferir a situação atual. Tente novamente.')
      const atual = b.negociacoes[0] as Linha
      setSelecionada(atual)
      if (atual.situacao !== 'aberta') { setModo('jornada'); setErro('Esta negociação já foi encerrada. Consulte o registro indicado abaixo.'); return }
      escolher(atual, acao)
    } catch(e) { setErro(e instanceof Error ? e.message : 'Não foi possível conferir a negociação.') }
  }

  async function carregarCorrecao(linha: Linha, page: number) {
    try {
      const r = await fetch(`/api/atendimento-presencial/negociacoes?clienteId=${linha.cliente_id}&situacao=aberta&pagina=${page}`)
      const body = await r.json()
      if (!r.ok || !body.ok) throw new Error(body.message || 'Não foi possível consultar os vínculos.')
      setOpcoesCorrecao(body.negociacoes.filter((n: Linha) => n.origem_id !== linha.origem_id)); setPaginaCorrecao(page); setTotalCorrecao(body.total); setNovaOrigem('')
    } catch (e) { setErro(e instanceof Error ? e.message : 'Não foi possível consultar os vínculos.') }
  }

  async function verHistorico(linha: Linha) {
    escolher(linha, 'historico')
    try { const r = await fetch(`/api/atendimento-presencial/negociacoes?origemId=${linha.origem_id}`); const body = await r.json(); if (!r.ok || !body.ok) throw new Error(body.message); setSelecionada(body.negociacoes[0] || linha) }
    catch (e) { setErro(e instanceof Error ? e.message : 'Falha ao carregar histórico.') }
  }

  async function executar(acao: string, atendimentoId?: string) {
    if (!selecionada || busy.current) return false
    busy.current = true; setOcupado(true); setErro(''); setMensagem('')
    try {
      const dados = { clienteId: selecionada.cliente_id, negociacaoId: selecionada.negociacao_id || selecionada.origem_id,
        unidadeId: unidade, consultora, canal, canalOutro, fechadoEm: data ? new Date(data).toISOString() : '',
        numeroLancamento: lancamento, produtos: ficha.produtosInteresse, observacoes }
      const body = { origemId: selecionada.origem_id, operacaoId: operacao.current, acao, version: ['rascunho', 'concluir', 'corrigir', 'anular'].includes(acao) ? digital.version : selecionada.version,
        id: digital.id, vendaId, atendimentoId: atendimentoId || selecionada.digitais.find(d => d.id === digital.id)?.atendimento_id, canal, canalOutro, dataComercial: data ? new Date(data).toISOString() : '', unidadeId: unidade, consultora, motivo, novaOrigemId: novaOrigem, novaVersion: opcoesCorrecao.find(n => n.origem_id === novaOrigem)?.version,
        dados: acao === 'perda' ? { motivo: motivoPerda, observacoes } : acao === 'desvincular' ? { motivo } : dados }
      const response = await fetch('/api/atendimento-presencial/negociacoes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const resposta = await response.json()
      if (!response.ok || !resposta.ok) {
        if (resposta.contextoNegociacao) { setSelecionada(atual => atual ? {...atual,...resposta.contextoNegociacao} : atual); if (resposta.contextoNegociacao.situacao !== 'aberta') setModo('jornada') }
        throw new Error(resposta.message || 'Não foi possível salvar.')
      }
      window.dispatchEvent(new CustomEvent(EVENTO_NEGOCIACAO, { detail: { origemId: selecionada.origem_id } }))
      if (acao === 'retorno' || acao === 'digital_integral') { window.location.assign(`/atendimento-presencial/prancheta?rascunho=${encodeURIComponent(resposta.resultado)}`); return true }
      if (acao === 'rascunho') setDigital({ id: resposta.resultado.id, version: resposta.resultado.version })
      else setModo(origemId ? 'jornada' : '')
      setAssociadoId(resposta.resultado?.atendimentoId || (acao === 'vincular' ? vendaId || '' : ''))
      operacao.current = crypto.randomUUID(); setMensagem(resposta.message || mensagemAtualizacao(acao, resposta.resultado)); await carregar(pagina)
      return true
    } catch (e) { setErro(e instanceof Error ? e.message : 'Não foi possível salvar. Seus dados foram preservados.'); return false }
    finally { busy.current = false; setOcupado(false) }
  }

  function acoesDeCorrecao(linha: Linha, cards = false) {
    if (cards) return gerir ? <>
      {linha.canal_encerramento === 'presencial' && <><AcaoNegociacao titulo="Corrigir vínculo da venda" descricao="Selecione a negociação correta para esta venda." icone={Pencil} onClick={() => escolher(linha, 'corrigir_vinculo')} /><AcaoNegociacao titulo="Desvincular venda desta negociação" descricao="Remove apenas o vínculo e mantém a venda registrada." icone={Trash2} destrutiva onClick={() => escolher(linha, 'desvincular')} /></>}
      {linha.digitais.filter(d => d.status === 'concluido').map(d => <div key={d.id} className="contents"><AcaoNegociacao titulo="Corrigir dados da venda" descricao="Ajuste lançamento, produtos ou observações." icone={Pencil} onClick={() => escolher(linha, 'corrigir', d)} /><AcaoNegociacao titulo="Anular venda digital" descricao="Use somente se a venda foi registrada por engano." icone={Trash2} destrutiva onClick={() => escolher(linha, 'anular', d)} /></div>)}
    </> : null
    return gerir ? (<div className="flex flex-wrap gap-2">{linha.canal_encerramento === 'presencial' && <><Button variant="secondary" onClick={() => escolher(linha, 'corrigir_vinculo')}>Corrigir vínculo da venda</Button><Button variant="secondary" onClick={() => escolher(linha, 'desvincular')}>Desvincular venda desta negociação</Button></>}{linha.digitais.map(d => <div key={d.id} className="flex flex-wrap gap-2">{d.status !== 'anulado' && <Button variant="secondary" onClick={() => escolher(linha, d.status === 'rascunho' ? 'digital' : 'corrigir', d)}>{d.status === 'rascunho' ? 'Retomar digital' : 'Corrigir venda digital'}</Button>}{d.status === 'concluido' && <Button variant="secondary" onClick={() => escolher(linha, 'anular', d)}>Anular venda digital</Button>}</div>)}</div>) : null
  }

  const modalDigital = modo === 'digital' || modo === 'corrigir'
  return <>
    <Button variant="secondary" size="lg" className={triggerClassName} onClick={() => { setModo(origemId ? 'jornada' : ''); setSelecionada(null); setMensagem(''); setAssociadoId(''); associacaoPedido.current = ''; operacao.current = ''; setAberto(true); const f = origemId ? { ...INICIAL, situacao: '' } : INICIAL; setFiltros(f); setAplicados(f); void carregar(1, f) }}>{origemId && <RefreshCw className="size-4 shrink-0" aria-hidden="true" />}{vendaId ? 'Vincular negociação anterior' : origemId ? ((situacaoAtual || selecionada?.situacao) && (situacaoAtual || selecionada?.situacao) !== 'aberta' ? 'Consultar ou corrigir negociação' : 'Atualizar situação da negociação') : 'Consultar negociações'}</Button>
    <Dialog open={aberto} onOpenChange={value => { if (!ocupado) setAberto(value) }}>
      <DialogContent aria-describedby={undefined} className={`w-[96vw] ${modo === 'jornada' && selecionada?.situacao !== 'aberta' ? 'max-w-6xl sm:max-w-6xl' : 'max-w-4xl sm:max-w-4xl'} [&_select]:min-h-11 [&_select]:w-full [&_select]:rounded-lg [&_select]:border [&_select]:bg-background [&_select]:p-2 ${modalDigital ? styles.digital : ''}`}><DialogHeader titleClassName={modo === 'jornada' && selecionada?.situacao !== 'aberta' ? 'text-xl font-bold sm:text-2xl' : undefined} className={modalDigital ? styles.header : undefined} title={modalDigital && selecionada ? <span className={styles.titulo}><span className={styles.carrinho}><ShoppingCart aria-hidden="true" /></span><span>{modo === 'corrigir' ? 'Corrigir venda digital' : 'Venda fechada digital'}<span className={styles.cliente}><UserRound aria-hidden="true" />{selecionada.nome}</span><span className={styles.canal}><Monitor aria-hidden="true" />Fechamento digital</span></span></span> : modo && selecionada ? `${modo === 'anular' ? 'Venda digital' : selecionada.situacao !== 'aberta' ? 'Consultar ou corrigir negociação' : 'Atualizar negociação'} · ${selecionada.nome}` : 'Continuidade de negociações'} />
        <DialogBody className={`space-y-4 ${modalDigital ? styles.body : ''}`}>
          {erro && <Alert tone="danger">{erro}</Alert>}{mensagem && <Alert tone="success">{mensagem}{associadoId && <div className="mt-2"><ConsultarAtendimento id={associadoId} label="Ver atendimento associado" /></div>}</Alert>}
          {modo === 'jornada' && !selecionada && !erro && <p role="status">Carregando negociação…</p>}
          {!modo ? <>
            <FilterPanel dirty={JSON.stringify(filtros) !== JSON.stringify(aplicados)} onApply={() => { setAplicados(filtros); void carregar(1, filtros) }} onClear={() => { setFiltros(INICIAL); setAplicados(INICIAL); void carregar(1, INICIAL) }}>
              <FilterFieldGroup label="Cliente" icon={<Search />} description="Confirme a cliente antes de vincular."><Input aria-label="Nome da cliente" value={filtros.nome} onChange={e => setFiltros({ ...filtros, nome: e.target.value })} /></FilterFieldGroup>
              <FilterFieldGroup label="Telefone" icon={<Phone />} description="Telefone com DDD; a seleção é explícita."><Input aria-label="Telefone da cliente" value={filtros.telefone} onChange={e => setFiltros({ ...filtros, telefone: e.target.value })} /></FilterFieldGroup>
              <FilterFieldGroup label="Período e situação" icon={<CalendarDays />} description="Data da negociação original."><Input aria-label="Desde" type="date" value={filtros.de} onChange={e => setFiltros({ ...filtros, de: e.target.value })} /><Input aria-label="Até" type="date" value={filtros.ate} onChange={e => setFiltros({ ...filtros, ate: e.target.value })} /><select aria-label="Situação da negociação" value={filtros.situacao} onChange={e => setFiltros({ ...filtros, situacao: e.target.value })}><option value="">Todas</option><option value="aberta">Aberta</option><option value="venda">Encerrada com venda</option><option value="perda">Encerrada com perda</option></select></FilterFieldGroup>
            <FilterFieldGroup label="Canal de encerramento" icon={<Phone />} description="Presencial, digital ou perda sem venda."><select aria-label="Canal de encerramento" value={filtros.canal} onChange={e => setFiltros({ ...filtros, canal: e.target.value })}><option value="">Todos</option><option value="presencial">Presencial</option><option value="digital">Digital</option><option value="perda">Perda sem venda</option></select></FilterFieldGroup></FilterPanel>

            <p>{total} negociações encontradas</p>
            {linhas.map(linha => <Section key={linha.origem_id} title={`${linha.nome} · ${linha.filial}`} description={`${new Date(linha.iniciado_em).toLocaleDateString('pt-BR')} · ${linha.consultora_nome} · ${linha.telefone_informado || 'Sem telefone'}`}>
              <Button variant="secondary" size="sm" onClick={() => void verHistorico(linha)}>Ver histórico da negociação</Button><p className="font-semibold">{linha.situacao === 'aberta' ? 'Negociação aberta' : linha.situacao === 'venda' ? 'Encerrada com venda' : 'Encerrada com perda'}</p>
              {gerir && <div className="mt-3 flex flex-wrap gap-2">{linha.situacao === 'aberta' && <>{vendaId ? <Button onClick={() => escolher(linha, 'vincular')}>Selecionar esta negociação</Button> : <>{podeCriarRetorno && <Button onClick={() => escolher(linha, 'retorno')}>Registrar retorno presencial</Button>}<Button variant="secondary" onClick={() => escolher(linha, 'preparar_digital')}>Fechar venda digital</Button><Button variant="secondary" onClick={() => escolher(linha, 'perda')}>Encerrar como perda</Button></>}</>}{linha.canal_encerramento === 'presencial' && <><Button variant="secondary" onClick={() => escolher(linha, 'corrigir_vinculo')}>Corrigir vínculo da venda</Button><Button variant="secondary" onClick={() => escolher(linha, 'desvincular')}>Desvincular venda desta negociação</Button></>}</div>}
              {linha.digitais.map(d => <div key={d.id} className="mt-3 rounded-lg border p-3"><p>Venda digital · {d.status} · {d.dados.canal} · lançamento {d.numero_lancamento || d.dados.numeroLancamento || 'a informar'}</p>{gerir && d.status !== 'anulado' && <Button variant="secondary" onClick={() => escolher(linha, d.status === 'rascunho' ? 'digital' : 'corrigir', d)}>{d.status === 'rascunho' ? 'Retomar digital' : 'Corrigir venda digital'}</Button>}{gerir && d.status === 'concluido' && <Button variant="secondary" onClick={() => escolher(linha, 'anular', d)}>Anular venda digital</Button>}</div>)}
            </Section>)}
            <div className="flex items-center justify-between"><Button variant="secondary" disabled={pagina <= 1} onClick={() => void carregar(pagina - 1)}>Anterior</Button><span>Página {pagina}</span><Button variant="secondary" disabled={pagina * 20 >= total} onClick={() => void carregar(pagina + 1)}>Próxima</Button></div>
          </> : selecionada && <>
            {modo === 'jornada' ? <NegociacaoJornada origem={selecionada} gerir={gerir} podeRetorno={podeCriarRetorno} ocupado={ocupado} escolher={acao => void prepararAtualizacao(selecionada, acao)} associar={id => { if (associacaoPedido.current !== id || !operacao.current) { associacaoPedido.current = id; operacao.current = crypto.randomUUID() } return executar('associar', id) }} historico={() => void verHistorico(selecionada)} acoesCorrecao={acoesDeCorrecao(selecionada, true)} /> : <>
            {modo === 'historico' && acoesDeCorrecao(selecionada)}
            {!modalDigital && <Alert tone="info">{selecionada.nome} · {selecionada.telefone_informado || 'Sem telefone'} · origem {selecionada.filial}. Confira se esta é a negociação correta.</Alert>}
            {modalDigital && <details className={styles.responsavel}><summary>{unidades.find(u => u.id === unidade)?.nome} · {consultora} · {canal === 'whatsapp' ? 'WhatsApp' : canal === 'telefone' ? 'Telefone' : 'Outro canal'} — ajustar responsáveis/canal</summary>
              <div className="mt-3 grid gap-3 sm:grid-cols-2"><FormField id="neg-filial" label="Filial responsável" required>{field => <select {...field} value={unidade} onChange={e => setUnidade(e.target.value)}>{unidades.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}</select>}</FormField><FormField id="neg-consultora" label="Consultora responsável" required>{field => <Input {...field} maxLength={30} value={consultora} onChange={e => setConsultora(e.target.value)} />}</FormField><FormField id="neg-canal" label="Canal digital" required>{field => <select {...field} value={canal} onChange={e => setCanal(e.target.value)}><option value="whatsapp">WhatsApp</option><option value="telefone">Telefone</option><option value="outro">Outro contato remoto</option></select>}</FormField>{canal === 'outro' && <FormField id="neg-outro" label="Qual canal?" required>{field => <Input {...field} value={canalOutro} onChange={e => setCanalOutro(e.target.value)} />}</FormField>}</div></details>}
            {['retorno', 'preparar_digital'].includes(modo) && <>
              <FormField id="neg-filial" label="Filial responsável" required>{field => <select {...field} value={unidade} onChange={e => setUnidade(e.target.value)} className="min-h-11 w-full rounded-lg border p-2">{unidades.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}</select>}</FormField>
              <FormField id="neg-consultora" label="Consultora responsável" required>{field => <Input {...field} maxLength={30} value={consultora} onChange={e => setConsultora(e.target.value)} />}</FormField>
            </>}
            {modo === 'preparar_digital' && <><FormField id="neg-data-digital" label="Data/hora da venda" required>{field => <Input {...field} type="datetime-local" value={data} onChange={e => setData(e.target.value)} />}</FormField><FormField id="neg-canal-digital" label="Canal" required>{field => <select {...field} value={canal} onChange={e => setCanal(e.target.value)}><option value="whatsapp">WhatsApp</option><option value="telefone">Telefone</option><option value="outro">Outro contato remoto</option></select>}</FormField>{canal === 'outro' && <FormField id="neg-canal-digital-outro" label="Qual canal?" required>{field => <Input {...field} value={canalOutro} onChange={e => setCanalOutro(e.target.value)} />}</FormField>}<p>Continue na Prancheta para confirmar crianças, essenciais e os produtos vendidos.</p></>}
            {['digital', 'corrigir'].includes(modo) && <>
              <FormField id="neg-data" label="Data/hora do fechamento" required>{field => <Input {...field} type="datetime-local" value={data} onChange={e => setData(e.target.value)} />}</FormField>
              <FormField id="neg-lancamento" label="Número do lançamento" required>{field => <Input {...field} inputMode="numeric" value={lancamento} onChange={e => setLancamento(e.target.value)} />}</FormField>
              <ProdutosAtendimento apresentacaoDigital ficha={ficha} atualizar={update => setFicha(atual => update(atual))} digitado={digitado} setDigitado={setDigitado} />
            </>}
            {modo === 'perda' && <FormField id="neg-perda" label="Motivo da perda" required>{field => <select {...field} value={motivoPerda} onChange={e => setMotivoPerda(e.target.value)}>{MOTIVOS_VENDA_PERDIDA.map(m => <option key={m.chave} value={m.chave}>{m.label}</option>)}</select>}</FormField>}
            {['digital', 'corrigir', 'perda'].includes(modo) && <FormField id="neg-observacoes" label="Observações">{field => <Textarea {...field} value={observacoes} maxLength={modo === 'perda' ? 300 : 2000} onChange={e => setObservacoes(e.target.value)} />}</FormField>}
            {['corrigir', 'anular', 'desvincular', 'corrigir_vinculo'].includes(modo) && <FormField id="neg-motivo" label="Motivo da correção/anulação" required>{field => <Textarea {...field} value={motivo} maxLength={2000} onChange={e => setMotivo(e.target.value)} />}</FormField>}
            {modo === 'anular' && <Alert tone="warning">Anular esta venda fará a negociação voltar a ficar aberta. A venda ficará identificada como anulada no histórico. Crianças e respostas de Produtos Essenciais serão mantidas. Informe o motivo antes de confirmar.</Alert>}
            {modo === 'desvincular' && <Alert tone="warning">A venda e o atendimento serão mantidos. Apenas a ligação com esta negociação será removida, e ela voltará a ficar aberta. Informe o motivo antes de confirmar.</Alert>}
            {modo === 'corrigir_vinculo' && <Alert tone="warning">Você vai transferir o vínculo desta venda para outra negociação da mesma cliente. A venda não será duplicada. Confira a negociação correta e informe o motivo.</Alert>}
            {modo === 'corrigir_vinculo' && <FormField id="neg-vinculo-correto" label="Negociação correta da mesma cliente" required>{field => <select {...field} value={novaOrigem} onChange={e => setNovaOrigem(e.target.value)}><option value="">Selecione e confira a negociação</option>{opcoesCorrecao.map(n => <option key={n.origem_id} value={n.origem_id}>{n.filial} · {new Date(n.iniciado_em).toLocaleDateString('pt-BR')} · {n.consultora_nome}</option>)}</select>}</FormField>}
            {modo === 'corrigir_vinculo' && totalCorrecao > 20 && <div className="flex items-center justify-between gap-2"><Button variant="secondary" disabled={paginaCorrecao <= 1} onClick={() => void carregarCorrecao(selecionada, paginaCorrecao - 1)}>Vínculos anteriores</Button><span>Página {paginaCorrecao}</span><Button variant="secondary" disabled={paginaCorrecao * 20 >= totalCorrecao} onClick={() => void carregarCorrecao(selecionada, paginaCorrecao + 1)}>Mais vínculos</Button></div>}
            {selecionada.digitais.filter(d => d.status === 'concluido').map(d => <Section key={d.id} title="Venda digital registrada"><>{d.atendimento_id ? <ConsultarAtendimento id={d.atendimento_id} label="Ver Prancheta digital completa" /> : <ResumoProdutos produtos={d.dados.produtos || []} versaoProdutos={2} />}</></Section>)}
            {modo === 'historico' && !!selecionada.retornos?.length && <Section title="Retornos presenciais">{selecionada.retornos.map(r => <article key={r.id} className="rounded-lg border p-3"><p className="font-semibold">{r.filial} · {r.consultora}</p><p>{new Date(r.concluidoEm).toLocaleString('pt-BR')} · {r.resultado === 'sim' ? 'Venda fechada' : r.resultado === 'nao' ? 'Venda perdida' : 'Em negociação'}{r.independente ? ' · Visita independente' : ''}</p></article>)}</Section>}
            {modo === 'historico' && <Section title="Histórico da negociação">{selecionada.eventos?.length ? selecionada.eventos.map(e => <article key={e.id} className="space-y-2 rounded-lg border bg-white p-3"><p className="font-semibold">{EVENTOS[e.acao] || 'Atualização da negociação'}</p><p>{new Date(e.registrado_em).toLocaleString('pt-BR')}</p>{(e.dados?.atendimentoId || e.dados?.vendaId) && <ConsultarAtendimento id={(e.dados.atendimentoId || e.dados.vendaId)!} />}{e.dados?.motivo && <p>Motivo: {e.dados.motivo}</p>}{e.dados?.novo?.dados && <p>{e.dados.novo.dados.consultora} · {e.dados.novo.dados.canal} · lançamento {e.dados.anterior?.dados?.numeroLancamento || 'Não informado'} → {e.dados.novo.dados.numeroLancamento}</p>}{e.dados?.novo?.dados?.produtos && <ResumoProdutos produtos={e.dados.novo.dados.produtos} versaoProdutos={2} />}</article>) : <p>O atendimento original ainda não possui atualizações comerciais.</p>}</Section>}
          </>}
          </>}
        </DialogBody>
        {modo === 'jornada' && selecionada?.situacao !== 'aberta' && <DialogFooter className="mx-6 border-t border-blue-100 py-3"><Button variant="secondary" className="border border-blue-200 bg-white px-6 text-blue-700" onClick={() => setAberto(false)}>Fechar</Button></DialogFooter>}
        {modalDigital ? <DialogFooter className={styles.footer}><Button disabled={ocupado} onClick={() => void executar(modo === 'digital' ? 'concluir' : 'corrigir')}><Check aria-hidden="true" />{ocupado ? 'Salvando…' : modo === 'corrigir' ? 'Salvar correção digital' : 'Salvar venda digital'}</Button>{modo === 'digital' && <Button variant="secondary" disabled={ocupado} onClick={() => void executar('rascunho')}><Save aria-hidden="true" />Salvar rascunho</Button>}<Button variant="secondary" disabled={ocupado} onClick={() => setModo(origemId ? 'jornada' : '')}><ArrowLeft aria-hidden="true" />Voltar</Button></DialogFooter> : modo && modo !== 'jornada' && <DialogFooter className="gap-2 p-4"><Button variant="secondary" disabled={ocupado} onClick={() => setModo(origemId ? 'jornada' : '')}>Voltar</Button><Button disabled={ocupado} onClick={() => void executar(modo === 'preparar_digital' ? 'digital_integral' : modo)} className={modo === 'historico' ? 'hidden' : undefined}> {ocupado ? 'Salvando…' : ['retorno', 'preparar_digital'].includes(modo) ? 'Confirmar e abrir Prancheta' : modo === 'anular' ? 'Confirmar anulação' : modo === 'desvincular' ? 'Confirmar desvinculação' : modo === 'corrigir_vinculo' ? 'Confirmar correção do vínculo' : 'Confirmar e salvar'}</Button></DialogFooter>}
      </DialogContent>
    </Dialog>
  </>
}
