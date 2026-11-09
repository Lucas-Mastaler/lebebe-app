'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Eye, Megaphone, Pencil, Plus, Trash2, X } from 'lucide-react'
import {
  Alert,
  Badge,
  Button,
  ConfirmDialog,
  DateField,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  FormField,
  Input,
  PageContainer,
  PageHeader,
  ResponsiveTable,
} from '@/components/design-system'
import { CarrosselArquivos } from '@/components/promocoes-mes/CarrosselArquivos'
import { dateToIso, parseBrDate } from '@/lib/design-system/dates'
import type { Promocao } from '@/lib/promocoes-mes/repositorio'
import type { SituacaoPromocao } from '@/lib/promocoes-mes/vigencia'

const MAX_ARQUIVOS = 10
const LIMITE_BYTES = 10_485_760
const TIPOS_ACEITOS = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']

const SITUACAO: Record<SituacaoPromocao, { rotulo: string; tone: 'success' | 'info' | 'neutral' }> = {
  VIGENTE: { rotulo: 'Vigente', tone: 'success' },
  FUTURA: { rotulo: 'Futura', tone: 'info' },
  ENCERRADA: { rotulo: 'Encerrada', tone: 'neutral' },
}

function isoParaBr(iso: string) {
  const [a, m, d] = iso.split('-')
  return `${d}/${m}/${a}`
}

function brParaIso(br: string) {
  const data = parseBrDate(br)
  return data ? dateToIso(data) : null
}

type Rascunho = { id: string | null; titulo: string; inicio: string; fim: string; existentes: Promocao['arquivos']; removidos: string[]; novos: File[] }
const RASCUNHO_VAZIO: Rascunho = { id: null, titulo: '', inicio: '', fim: '', existentes: [], removidos: [], novos: [] }

async function mensagemDeErro(resposta: Response, padrao: string) {
  const corpo = await resposta.json().catch(() => null)
  return typeof corpo?.message === 'string' ? corpo.message : padrao
}

export default function PromocoesDoMesPageClient() {
  const [promocoes, setPromocoes] = useState<Promocao[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erroLista, setErroLista] = useState<string | undefined>()
  const [rascunho, setRascunho] = useState<Rascunho | null>(null)
  const [erros, setErros] = useState<Record<string, string>>({})
  const [erroForm, setErroForm] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [visualizando, setVisualizando] = useState<Promocao | null>(null)
  const [excluindo, setExcluindo] = useState<Promocao | null>(null)
  const [excluindoEmAndamento, setExcluindoEmAndamento] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)
  const seletor = useRef<HTMLInputElement>(null)

  const carregar = useCallback(async () => {
    try {
      const resposta = await fetch('/api/promocoes-mes', { cache: 'no-store' })
      if (!resposta.ok) throw new Error(await mensagemDeErro(resposta, 'Não foi possível carregar as promoções.'))
      const corpo = await resposta.json()
      setPromocoes(corpo.promocoes)
      setErroLista(undefined)
    } catch (e) {
      setErroLista(e instanceof Error ? e.message : 'Não foi possível carregar as promoções.')
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => { void carregar() }, [carregar])

  function abrirNovo() {
    setRascunho({ ...RASCUNHO_VAZIO })
    setErros({})
    setErroForm(null)
  }

  function abrirEdicao(p: Promocao) {
    setRascunho({ id: p.id, titulo: p.titulo, inicio: isoParaBr(p.inicio), fim: isoParaBr(p.fim), existentes: p.arquivos, removidos: [], novos: [] })
    setErros({})
    setErroForm(null)
  }

  function adicionarArquivos(lista: FileList | null) {
    if (!lista || !rascunho) return
    const novos = [...rascunho.novos]
    const novosErros: string[] = []
    for (const arquivo of Array.from(lista)) {
      if (!TIPOS_ACEITOS.includes(arquivo.type)) { novosErros.push(`"${arquivo.name}" não é PDF, JPG, PNG ou WebP.`); continue }
      if (arquivo.size > LIMITE_BYTES) { novosErros.push(`"${arquivo.name}" excede 10 MB.`); continue }
      if (arquivo.size === 0) { novosErros.push(`"${arquivo.name}" está vazio.`); continue }
      novos.push(arquivo)
    }
    const totalAposAdicionar = rascunho.existentes.length - rascunho.removidos.length + novos.length
    if (totalAposAdicionar > MAX_ARQUIVOS) novosErros.push(`Máximo de ${MAX_ARQUIVOS} arquivos por promoção.`)
    else setRascunho({ ...rascunho, novos })
    setErros((atual) => ({ ...atual, arquivos: novosErros.join(' ') }))
    if (seletor.current) seletor.current.value = ''
  }

  function validar(r: Rascunho) {
    const e: Record<string, string> = {}
    if (!r.titulo.trim()) e.titulo = 'Informe o título.'
    const inicio = brParaIso(r.inicio)
    const fim = brParaIso(r.fim)
    if (!inicio) e.inicio = 'Informe a data de início.'
    if (!fim) e.fim = 'Informe a data final.'
    if (inicio && fim && fim < inicio) e.fim = 'A data final não pode ser anterior à inicial.'
    if (r.existentes.length - r.removidos.length + r.novos.length < 1) e.arquivos = 'Anexe ao menos um arquivo.'
    return { e, inicio, fim }
  }

  async function salvar() {
    if (!rascunho) return
    const { e, inicio, fim } = validar(rascunho)
    setErros(e)
    setErroForm(null)
    if (Object.keys(e).length > 0 || !inicio || !fim) return
    const form = new FormData()
    form.set('titulo', rascunho.titulo.trim())
    form.set('inicio', inicio)
    form.set('fim', fim)
    rascunho.novos.forEach((arquivo) => form.append('arquivos', arquivo))
    rascunho.removidos.forEach((id) => form.append('remover', id))
    setSalvando(true)
    try {
      const resposta = await fetch(rascunho.id ? `/api/promocoes-mes/${rascunho.id}` : '/api/promocoes-mes', {
        method: rascunho.id ? 'PATCH' : 'POST',
        body: form,
      })
      if (!resposta.ok) throw new Error(await mensagemDeErro(resposta, 'Não foi possível salvar a promoção.'))
      setRascunho(null)
      setAviso(rascunho.id ? 'Promoção atualizada.' : 'Promoção cadastrada.')
      await carregar()
    } catch (erro) {
      setErroForm(erro instanceof Error ? erro.message : 'Não foi possível salvar a promoção.')
    } finally {
      setSalvando(false)
    }
  }

  async function visualizar(p: Promocao) {
    try {
      const resposta = await fetch(`/api/promocoes-mes/${p.id}`, { cache: 'no-store' })
      if (!resposta.ok) throw new Error(await mensagemDeErro(resposta, 'Não foi possível abrir os arquivos.'))
      setVisualizando((await resposta.json()).promocao)
    } catch (erro) {
      setErroLista(erro instanceof Error ? erro.message : 'Não foi possível abrir os arquivos.')
    }
  }

  async function confirmarExclusao() {
    if (!excluindo) return
    setExcluindoEmAndamento(true)
    try {
      const resposta = await fetch(`/api/promocoes-mes/${excluindo.id}`, { method: 'DELETE' })
      if (!resposta.ok) throw new Error(await mensagemDeErro(resposta, 'Não foi possível excluir a promoção.'))
      const corpo = await resposta.json()
      setAviso(corpo.objetosPendentes > 0
        ? 'Promoção excluída, mas alguns arquivos ficaram pendentes de remoção no Storage e foram registrados para correção.'
        : 'Promoção excluída.')
      setExcluindo(null)
      await carregar()
    } catch (erro) {
      setErroLista(erro instanceof Error ? erro.message : 'Não foi possível excluir a promoção.')
      setExcluindo(null)
    } finally {
      setExcluindoEmAndamento(false)
    }
  }

  const periodo = (p: Promocao) => `${isoParaBr(p.inicio)} a ${isoParaBr(p.fim)}`
  const situacaoBadge = (p: Promocao) => <Badge tone={SITUACAO[p.situacao].tone}>{SITUACAO[p.situacao].rotulo}</Badge>
  const totalArquivos = rascunho ? rascunho.existentes.length - rascunho.removidos.length + rascunho.novos.length : 0

  return (
    <PageContainer>
      <div className="mx-auto max-w-5xl space-y-6">
        <PageHeader
          icon={<Megaphone className="size-6" aria-hidden="true" />}
          title="Promoções do Mês"
          description="Cadastre as promoções que as consultoras veem na Prancheta Virtual durante a vigência."
          action={<Button type="button" onClick={abrirNovo}><Plus aria-hidden="true" />Adicionar</Button>}
        />
        {aviso && <Alert tone="success" title={aviso} />}
        <ResponsiveTable
          columns={[
            { key: 'titulo', header: 'Título', width: 'wide', render: (p) => p.titulo },
            { key: 'inicio', header: 'Início', width: 'compact', render: (p) => isoParaBr(p.inicio) },
            { key: 'fim', header: 'Fim', width: 'compact', render: (p) => isoParaBr(p.fim) },
            { key: 'situacao', header: 'Situação', width: 'compact', render: situacaoBadge },
            { key: 'arquivos', header: 'Arquivos', width: 'compact', render: (p) => p.arquivos.length },
          ]}
          rows={promocoes}
          rowKey={(p) => p.id}
          loading={carregando}
          error={erroLista}
          emptyTitle="Nenhuma promoção cadastrada"
          emptyDescription='Use "Adicionar" para cadastrar a primeira.'
          rowActions={(p) => (
            <div className="flex justify-end gap-1">
              <Button type="button" size="sm" variant="ghost" aria-label={`Visualizar ${p.titulo}`} onClick={() => void visualizar(p)}><Eye aria-hidden="true" />Visualizar</Button>
              <Button type="button" size="sm" variant="ghost" aria-label={`Editar ${p.titulo}`} onClick={() => abrirEdicao(p)}><Pencil aria-hidden="true" />Editar</Button>
              <Button type="button" size="sm" variant="destructive" aria-label={`Excluir ${p.titulo}`} onClick={() => setExcluindo(p)}><Trash2 aria-hidden="true" />Excluir</Button>
            </div>
          )}
          renderMobileCard={(p) => (
            <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <p className="min-w-0 break-words font-semibold">{p.titulo}</p>
                {situacaoBadge(p)}
              </div>
              <p className="text-sm text-slate-600">{periodo(p)} · {p.arquivos.length} arquivo(s)</p>
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" variant="secondary" onClick={() => void visualizar(p)}><Eye aria-hidden="true" />Visualizar</Button>
                <Button type="button" size="sm" variant="secondary" onClick={() => abrirEdicao(p)}><Pencil aria-hidden="true" />Editar</Button>
                <Button type="button" size="sm" variant="destructive" onClick={() => setExcluindo(p)}><Trash2 aria-hidden="true" />Excluir</Button>
              </div>
            </div>
          )}
        />
      </div>

      <Dialog open={rascunho !== null} onOpenChange={(aberto) => { if (!aberto && !salvando) setRascunho(null) }}>
        <DialogContent className="w-[calc(100vw-1rem)] max-w-xl">
          <DialogHeader title={rascunho?.id ? 'Editar promoção' : 'Nova promoção'} description="Informe o título, a vigência e os arquivos (PDF ou imagem, até 10 MB cada)." />
          {rascunho && (
            <DialogBody className="space-y-4">
              {erroForm && <Alert tone="danger" title="Não foi possível salvar">{erroForm}</Alert>}
              <FormField id="promo-titulo" label="Título" required error={erros.titulo}>
                {(props) => <Input {...props} value={rascunho.titulo} maxLength={120} onChange={(ev) => setRascunho({ ...rascunho, titulo: ev.target.value })} />}
              </FormField>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField id="promo-inicio" label="Início da vigência" required error={erros.inicio}>
                  {(props) => <DateField {...props} value={rascunho.inicio} onChange={(v) => setRascunho({ ...rascunho, inicio: v })} />}
                </FormField>
                <FormField id="promo-fim" label="Fim da vigência" required error={erros.fim}>
                  {(props) => <DateField {...props} value={rascunho.fim} onChange={(v) => setRascunho({ ...rascunho, fim: v })} />}
                </FormField>
              </div>
              <FormField id="promo-arquivos" label="Arquivos" required helper={`${totalArquivos} de ${MAX_ARQUIVOS} arquivos`} error={erros.arquivos}>
                {(props) => (
                  <div className="space-y-2">
                    <input
                      {...props}
                      ref={seletor}
                      type="file"
                      multiple
                      accept={TIPOS_ACEITOS.join(',')}
                      className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary/10 file:px-3 file:py-2 file:font-semibold file:text-primary"
                      onChange={(ev) => adicionarArquivos(ev.target.files)}
                    />
                    <ul className="space-y-1 text-sm">
                      {rascunho.existentes.filter((a) => !rascunho.removidos.includes(a.id)).map((a) => (
                        <li key={a.id} className="flex items-center justify-between gap-2 rounded-md bg-slate-50 px-3 py-1.5">
                          <span className="min-w-0 truncate">{a.nome}</span>
                          <Button type="button" size="sm" variant="ghost" aria-label={`Remover ${a.nome}`} onClick={() => setRascunho({ ...rascunho, removidos: [...rascunho.removidos, a.id] })}><X aria-hidden="true" /></Button>
                        </li>
                      ))}
                      {rascunho.novos.map((arquivo, i) => (
                        <li key={`${arquivo.name}-${i}`} className="flex items-center justify-between gap-2 rounded-md bg-slate-50 px-3 py-1.5">
                          <span className="min-w-0 truncate">{arquivo.name} <span className="text-slate-500">(novo)</span></span>
                          <Button type="button" size="sm" variant="ghost" aria-label={`Remover ${arquivo.name}`} onClick={() => setRascunho({ ...rascunho, novos: rascunho.novos.filter((_, j) => j !== i) })}><X aria-hidden="true" /></Button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </FormField>
            </DialogBody>
          )}
          <DialogFooter className="border-t p-4">
            <Button type="button" variant="ghost" disabled={salvando} onClick={() => setRascunho(null)}>Cancelar</Button>
            <Button type="button" loading={salvando} onClick={() => void salvar()}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={visualizando !== null} onOpenChange={(aberto) => { if (!aberto) setVisualizando(null) }}>
        <DialogContent className="w-[calc(100vw-1rem)] max-w-3xl max-h-[95dvh]">
          <DialogHeader title={visualizando?.titulo ?? 'Promoção'} description={visualizando ? `${periodo(visualizando)} · ${SITUACAO[visualizando.situacao].rotulo}` : undefined} />
          {visualizando && <CarrosselArquivos promocoes={[visualizando]} aoTentarNovamente={() => void visualizar(visualizando)} />}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={excluindo !== null}
        onOpenChange={(aberto) => { if (!aberto && !excluindoEmAndamento) setExcluindo(null) }}
        title="Excluir promoção?"
        description={excluindo ? `"${excluindo.titulo}" e seus ${excluindo.arquivos.length} arquivo(s) serão removidos. Esta ação não pode ser desfeita.` : undefined}
        confirmLabel="Excluir"
        loading={excluindoEmAndamento}
        onConfirm={() => void confirmarExclusao()}
      />
    </PageContainer>
  )
}
