'use client'

import { useCallback, useEffect, useRef, useState, type DragEvent, type FormEvent } from 'react'
import {
  CalendarDays,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  Eye,
  FileText,
  Flag,
  Image as ImageIcon,
  Megaphone,
  Pencil,
  Plus,
  Save,
  Search,
  Trash2,
  Type,
  UploadCloud,
  X,
} from 'lucide-react'
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
  FilterFieldGroup,
  FilterPanel,
  FormField,
  Input,
  PageContainer,
  PageHeader,
  ResponsiveTable,
  useFilterState,
} from '@/components/design-system'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CarrosselArquivos } from '@/components/promocoes-mes/CarrosselArquivos'
import { dateToIso, parseBrDate } from '@/lib/design-system/dates'
import { countActiveFilters } from '@/lib/design-system/filters'
import type { Promocao } from '@/lib/promocoes-mes/repositorio'
import type { SituacaoPromocao } from '@/lib/promocoes-mes/vigencia'

const MAX_ARQUIVOS = 10
const LIMITE_BYTES = 10_485_760
const TIPOS_ACEITOS = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
const TITULO_MAX = 120
const POR_PAGINA = 10

const SITUACAO: Record<SituacaoPromocao, { rotulo: string; tone: 'success' | 'info' | 'neutral' }> = {
  VIGENTE: { rotulo: 'Vigente', tone: 'success' },
  FUTURA: { rotulo: 'Futura', tone: 'info' },
  ENCERRADA: { rotulo: 'Encerrada', tone: 'neutral' },
}

const FILTROS_INICIAL = { titulo: '', inicio: '', fim: '', situacao: '' as '' | SituacaoPromocao }
type Filtros = typeof FILTROS_INICIAL

function isoParaBr(iso: string) {
  const [a, m, d] = iso.split('-')
  return `${d}/${m}/${a}`
}

function brParaIso(br: string) {
  const data = parseBrDate(br)
  return data ? dateToIso(data) : null
}

function tamanhoLegivel(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`
}

function diasEntre(inicioIso: string, fimIso: string) {
  const [a1, m1, d1] = inicioIso.split('-').map(Number)
  const [a2, m2, d2] = fimIso.split('-').map(Number)
  return Math.round((Date.UTC(a2, m2 - 1, d2) - Date.UTC(a1, m1 - 1, d1)) / 86_400_000) + 1
}

function situacaoDe(inicio: string, fim: string, hoje: string): SituacaoPromocao {
  if (hoje < inicio) return 'FUTURA'
  if (hoje > fim) return 'ENCERRADA'
  return 'VIGENTE'
}

type Rascunho = { id: string | null; titulo: string; inicio: string; fim: string; existentes: Promocao['arquivos']; removidos: string[]; novos: File[] }
const RASCUNHO_VAZIO: Rascunho = { id: null, titulo: '', inicio: '', fim: '', existentes: [], removidos: [], novos: [] }

type Meta = { page: number; pageSize: number; total: number; totalPages: number }
const META_INICIAL: Meta = { page: 1, pageSize: POR_PAGINA, total: 0, totalPages: 1 }

async function mensagemDeErro(resposta: Response, padrao: string) {
  const corpo = await resposta.json().catch(() => null)
  return typeof corpo?.message === 'string' ? corpo.message : padrao
}

function IconeArquivo({ mimeType }: { mimeType: string }) {
  const pdf = mimeType === 'application/pdf'
  return (
    <span className={`grid size-9 shrink-0 place-items-center rounded-lg ${pdf ? 'bg-rose-50 text-rose-600' : 'bg-sky-50 text-sky-600'}`}>
      {pdf ? <FileText className="size-4" aria-hidden="true" /> : <ImageIcon className="size-4" aria-hidden="true" />}
    </span>
  )
}

function LinhaArquivo({ nome, mimeType, tamanhoBytes, novo, onRemover }: { nome: string; mimeType: string; tamanhoBytes: number; novo?: boolean; onRemover: () => void }) {
  return (
    <li className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
      <IconeArquivo mimeType={mimeType} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-slate-800">{nome}</p>
        <p className="text-xs text-slate-500">{mimeType === 'application/pdf' ? 'PDF' : 'Imagem'} · {tamanhoLegivel(tamanhoBytes)}</p>
      </div>
      {novo && <Badge tone="info">Novo</Badge>}
      <Button type="button" size="sm" variant="ghost" aria-label={`Remover ${nome}`} onClick={onRemover}><X aria-hidden="true" /></Button>
    </li>
  )
}

export default function PromocoesDoMesPageClient() {
  const [promocoes, setPromocoes] = useState<Promocao[]>([])
  const [meta, setMeta] = useState<Meta>(META_INICIAL)
  const [hoje, setHoje] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [erroLista, setErroLista] = useState<string | undefined>()
  const filtros = useFilterState<Filtros>(FILTROS_INICIAL)
  const [errosFiltro, setErrosFiltro] = useState<Record<string, string>>({})
  const [rascunho, setRascunho] = useState<Rascunho | null>(null)
  const [erros, setErros] = useState<Record<string, string>>({})
  const [erroForm, setErroForm] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [arrastando, setArrastando] = useState(false)
  const [visualizando, setVisualizando] = useState<Promocao | null>(null)
  const [excluindo, setExcluindo] = useState<Promocao | null>(null)
  const [excluindoEmAndamento, setExcluindoEmAndamento] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)
  const seletor = useRef<HTMLInputElement>(null)
  // filtros/página efetivamente em uso na tela (a edição do painel só vale depois de "Filtrar")
  const consultaAtual = useRef<{ filtros: Filtros; page: number }>({ filtros: FILTROS_INICIAL, page: 1 })

  const carregar = useCallback(async (f: Filtros, page: number) => {
    consultaAtual.current = { filtros: f, page }
    setCarregando(true)
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(POR_PAGINA) })
      if (f.titulo.trim()) params.set('titulo', f.titulo.trim())
      const inicio = brParaIso(f.inicio)
      const fim = brParaIso(f.fim)
      if (inicio) params.set('inicioDe', inicio)
      if (fim) params.set('fimAte', fim)
      if (f.situacao) params.set('situacao', f.situacao)
      const resposta = await fetch(`/api/promocoes-mes?${params}`, { cache: 'no-store' })
      if (!resposta.ok) throw new Error(await mensagemDeErro(resposta, 'Não foi possível carregar as promoções.'))
      const corpo = await resposta.json()
      // excluiu o último item da última página: volta para a página anterior
      if (corpo.promocoes.length === 0 && corpo.meta.total > 0 && page > 1) {
        await carregar(f, corpo.meta.totalPages)
        return
      }
      setPromocoes(corpo.promocoes)
      setMeta(corpo.meta)
      setHoje(corpo.hoje ?? '')
      setErroLista(undefined)
    } catch (e) {
      setErroLista(e instanceof Error ? e.message : 'Não foi possível carregar as promoções.')
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => { void carregar(FILTROS_INICIAL, 1) }, [carregar])

  const recarregar = () => carregar(consultaAtual.current.filtros, consultaAtual.current.page)

  function aplicarFiltros(event?: FormEvent) {
    event?.preventDefault()
    const e: Record<string, string> = {}
    const { inicio, fim } = filtros.draft
    if (inicio && !brParaIso(inicio)) e.inicio = 'Data inválida.'
    if (fim && !brParaIso(fim)) e.fim = 'Data inválida.'
    setErrosFiltro(e)
    if (Object.keys(e).length > 0) return
    filtros.apply()
    void carregar(filtros.draft, 1)
  }

  function limparFiltros() {
    setErrosFiltro({})
    filtros.clear()
    void carregar(FILTROS_INICIAL, 1)
  }

  function mudarPagina(proxima: number) {
    if (proxima < 1 || proxima > meta.totalPages || carregando) return
    void carregar(consultaAtual.current.filtros, proxima)
  }

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

  function adicionarArquivos(lista: FileList | File[] | null) {
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

  function soltarArquivos(ev: DragEvent<HTMLLabelElement>) {
    ev.preventDefault()
    setArrastando(false)
    adicionarArquivos(ev.dataTransfer.files)
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
      await recarregar()
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
      await recarregar()
    } catch (erro) {
      setErroLista(erro instanceof Error ? erro.message : 'Não foi possível excluir a promoção.')
      setExcluindo(null)
    } finally {
      setExcluindoEmAndamento(false)
    }
  }

  const periodo = (p: Promocao) => `${isoParaBr(p.inicio)} a ${isoParaBr(p.fim)}`
  const situacaoBadge = (p: Promocao) => <Badge tone={SITUACAO[p.situacao].tone}>{SITUACAO[p.situacao].rotulo}</Badge>
  const existentesVisiveis = rascunho ? rascunho.existentes.filter((a) => !rascunho.removidos.includes(a.id)) : []
  const totalArquivos = rascunho ? existentesVisiveis.length + rascunho.novos.length : 0

  // resumo da vigência digitada, para a pessoa conferir antes de salvar
  const resumoVigencia = (() => {
    if (!rascunho || !hoje) return null
    const inicio = brParaIso(rascunho.inicio)
    const fim = brParaIso(rascunho.fim)
    if (!inicio || !fim || fim < inicio) return null
    const dias = diasEntre(inicio, fim)
    return { situacao: situacaoDe(inicio, fim, hoje), dias }
  })()

  const temFiltroAplicado = countActiveFilters(filtros.applied, FILTROS_INICIAL) > 0
  const inicioRegistro = meta.total === 0 ? 0 : (meta.page - 1) * meta.pageSize + 1
  const fimRegistro = Math.min(meta.page * meta.pageSize, meta.total)

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

        <FilterPanel
          activeCount={countActiveFilters(filtros.applied, FILTROS_INICIAL)}
          dirty={filtros.dirty}
          onApply={aplicarFiltros}
          onClear={limparFiltros}
          applyDisabled={carregando}
        >
          <FilterFieldGroup label="Promoção" icon={<Search />} description="Busque pelo título da promoção.">
            <FormField id="filtro-promo-titulo" label="Título">
              {(field) => (
                <Input
                  {...field}
                  value={filtros.draft.titulo}
                  onChange={(ev) => filtros.setField('titulo', ev.target.value)}
                  placeholder="Parte do título"
                  maxLength={TITULO_MAX}
                  inputMode="search"
                />
              )}
            </FormField>
          </FilterFieldGroup>
          <FilterFieldGroup label="Vigência" icon={<CalendarRange />} description="Promoções que começam a partir de uma data e/ou terminam até outra.">
            <FormField id="filtro-promo-inicio" label="Início a partir de" error={errosFiltro.inicio}>
              {(field) => <DateField {...field} value={filtros.draft.inicio} onChange={(v) => filtros.setField('inicio', v)} />}
            </FormField>
            <FormField id="filtro-promo-fim" label="Fim até" error={errosFiltro.fim}>
              {(field) => <DateField {...field} value={filtros.draft.fim} onChange={(v) => filtros.setField('fim', v)} />}
            </FormField>
          </FilterFieldGroup>
          <FilterFieldGroup label="Situação" icon={<Flag />} description="Vigente, futura ou encerrada, conforme a data de hoje.">
            <FormField id="filtro-promo-situacao" label="Situação">
              {(field) => (
                <Select value={filtros.draft.situacao || 'all'} onValueChange={(v) => filtros.setField('situacao', v === 'all' ? '' : (v as SituacaoPromocao))}>
                  <SelectTrigger id={field.id} className="w-full"><SelectValue placeholder="Todas" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    <SelectItem value="VIGENTE">Vigente</SelectItem>
                    <SelectItem value="FUTURA">Futura</SelectItem>
                    <SelectItem value="ENCERRADA">Encerrada</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </FormField>
          </FilterFieldGroup>
        </FilterPanel>

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
          emptyTitle={temFiltroAplicado ? 'Nenhuma promoção encontrada' : 'Nenhuma promoção cadastrada'}
          emptyDescription={temFiltroAplicado ? 'Ajuste ou limpe os filtros para ver outras promoções.' : 'Use "Adicionar" para cadastrar a primeira.'}
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

        {!erroLista && meta.total > 0 && (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-600">
              {inicioRegistro}–{fimRegistro} de {meta.total} promoç{meta.total === 1 ? 'ão' : 'ões'} · Página {meta.page} de {meta.totalPages}
            </p>
            <div className="flex gap-2">
              <Button type="button" variant="secondary" onClick={() => mudarPagina(meta.page - 1)} disabled={carregando || meta.page <= 1}>
                <ChevronLeft className="size-4" aria-hidden="true" />
                Anterior
              </Button>
              <Button type="button" variant="secondary" onClick={() => mudarPagina(meta.page + 1)} disabled={carregando || meta.page >= meta.totalPages}>
                Próxima
                <ChevronRight className="size-4" aria-hidden="true" />
              </Button>
            </div>
          </div>
        )}
      </div>

      <Dialog open={rascunho !== null} onOpenChange={(aberto) => { if (!aberto && !salvando) setRascunho(null) }}>
        <DialogContent className="w-[calc(100vw-1rem)] max-w-xl">
          <DialogHeader
            className="bg-gradient-to-br from-primary/10 via-white to-white"
            title={
              <span className="flex items-center gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm">
                  <Megaphone className="size-5" aria-hidden="true" />
                </span>
                <span>{rascunho?.id ? 'Editar promoção' : 'Nova promoção'}</span>
              </span>
            }
            description="Informe o título, a vigência e os arquivos (PDF ou imagem, até 10 MB cada)."
          />
          {rascunho && (
            <DialogBody className="space-y-5 bg-slate-50/60">
              {erroForm && <Alert tone="danger" title="Não foi possível salvar">{erroForm}</Alert>}

              <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800"><Type className="size-4 text-primary" aria-hidden="true" />Identificação</h3>
                <FormField id="promo-titulo" label="Título" required error={erros.titulo} helper={`${rascunho.titulo.length}/${TITULO_MAX} caracteres`}>
                  {(props) => <Input {...props} value={rascunho.titulo} maxLength={TITULO_MAX} placeholder="Ex.: Black Friday Matic" onChange={(ev) => setRascunho({ ...rascunho, titulo: ev.target.value })} />}
                </FormField>
              </section>

              <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800"><CalendarDays className="size-4 text-primary" aria-hidden="true" />Vigência</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField id="promo-inicio" label="Início da vigência" required error={erros.inicio}>
                    {(props) => <DateField {...props} value={rascunho.inicio} onChange={(v) => setRascunho({ ...rascunho, inicio: v })} />}
                  </FormField>
                  <FormField id="promo-fim" label="Fim da vigência" required error={erros.fim}>
                    {(props) => <DateField {...props} value={rascunho.fim} onChange={(v) => setRascunho({ ...rascunho, fim: v })} />}
                  </FormField>
                </div>
                {resumoVigencia && (
                  <p className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
                    <Badge tone={SITUACAO[resumoVigencia.situacao].tone}>{SITUACAO[resumoVigencia.situacao].rotulo}</Badge>
                    {resumoVigencia.dias} dia{resumoVigencia.dias === 1 ? '' : 's'} de vigência, contando o primeiro e o último dia.
                  </p>
                )}
              </section>

              <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                  <UploadCloud className="size-4 text-primary" aria-hidden="true" />Arquivos
                  <span className="ml-auto text-xs font-normal text-slate-500">{totalArquivos} de {MAX_ARQUIVOS}</span>
                </h3>
                <FormField id="promo-arquivos" label="Arquivos da promoção" required error={erros.arquivos}>
                  {(props) => (
                    <label
                      htmlFor={props.id}
                      onDragOver={(ev) => { ev.preventDefault(); setArrastando(true) }}
                      onDragLeave={() => setArrastando(false)}
                      onDrop={soltarArquivos}
                      className={`flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors focus-within:ring-2 focus-within:ring-primary/40 ${arrastando ? 'border-primary bg-primary/10' : 'border-slate-300 bg-slate-50 hover:border-primary/60 hover:bg-primary/5'}`}
                    >
                      <UploadCloud className="size-7 text-primary" aria-hidden="true" />
                      <span className="text-sm font-semibold text-slate-800">Clique para escolher ou arraste os arquivos</span>
                      <span className="text-xs text-slate-500">PDF, JPG, PNG ou WebP · até 10 MB cada</span>
                      <input
                        {...props}
                        ref={seletor}
                        type="file"
                        multiple
                        accept={TIPOS_ACEITOS.join(',')}
                        className="sr-only"
                        onChange={(ev) => adicionarArquivos(ev.target.files)}
                      />
                    </label>
                  )}
                </FormField>
                {totalArquivos > 0 && (
                  <ul className="space-y-2">
                    {existentesVisiveis.map((a) => (
                      <LinhaArquivo key={a.id} nome={a.nome} mimeType={a.mimeType} tamanhoBytes={a.tamanhoBytes} onRemover={() => setRascunho({ ...rascunho, removidos: [...rascunho.removidos, a.id] })} />
                    ))}
                    {rascunho.novos.map((arquivo, i) => (
                      <LinhaArquivo key={`${arquivo.name}-${i}`} nome={arquivo.name} mimeType={arquivo.type} tamanhoBytes={arquivo.size} novo onRemover={() => setRascunho({ ...rascunho, novos: rascunho.novos.filter((_, j) => j !== i) })} />
                    ))}
                  </ul>
                )}
              </section>
            </DialogBody>
          )}
          <DialogFooter className="border-t bg-white p-4">
            <Button type="button" variant="ghost" disabled={salvando} onClick={() => setRascunho(null)}>Cancelar</Button>
            <Button type="button" loading={salvando} onClick={() => void salvar()}><Save aria-hidden="true" />Salvar</Button>
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
