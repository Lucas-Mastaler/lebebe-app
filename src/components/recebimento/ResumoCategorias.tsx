'use client'

import { useEffect, useState } from 'react'
import { Archive, Baby, BedDouble, Boxes, Check, CircleCheck, DoorClosed, Grid2X2, Layers3, PanelsTopLeft, Table2 } from 'lucide-react'
import { Badge, Progress } from '@/components/design-system'
import { isDescricaoVolumeAvulso } from '@/lib/recebimento/volume-avulso'
import { CATEGORIAS, classificarDescricao, normalizarDescricao, resumirCategorias, type Categoria, type DecisoesCategoria, type ItemCategoria } from '@/lib/recebimento/categorias'

const ICONES: Record<Categoria, typeof Boxes> = {
  roupeiro: DoorClosed, comoda: Archive, berco: Baby, cama: BedDouble,
  prateleira: Layers3, mesa: Table2, painel: PanelsTopLeft, revisar: Grid2X2,
}

const ESTILOS: Record<Categoria, { icone: string; barra: string }> = {
  roupeiro: { icone: 'bg-blue-100 text-blue-700', barra: '[&_[role=progressbar]>div]:bg-blue-600' },
  comoda: { icone: 'bg-teal-100 text-teal-700', barra: '[&_[role=progressbar]>div]:bg-teal-600' },
  berco: { icone: 'bg-green-100 text-green-700', barra: '[&_[role=progressbar]>div]:bg-green-600' },
  cama: { icone: 'bg-violet-100 text-violet-700', barra: '[&_[role=progressbar]>div]:bg-violet-600' },
  prateleira: { icone: 'bg-amber-100 text-amber-700', barra: '[&_[role=progressbar]>div]:bg-amber-600' },
  mesa: { icone: 'bg-orange-100 text-orange-700', barra: '[&_[role=progressbar]>div]:bg-orange-600' },
  painel: { icone: 'bg-indigo-100 text-indigo-700', barra: '[&_[role=progressbar]>div]:bg-indigo-600' },
  revisar: { icone: 'bg-slate-100 text-slate-700', barra: '[&_[role=progressbar]>div]:bg-slate-500' },
}

function percentualConferido(conferidos: number, previstos: number) {
  if (previstos <= 0) return 0
  const valor = Math.min(100, Math.max(0, conferidos / previstos * 100))
  return conferidos < previstos && valor >= 99.95 ? 99.9 : Math.round(valor * 10) / 10
}

function formatarPercentual(valor: number) {
  return valor.toLocaleString('pt-BR', { maximumFractionDigits: 1 })
}

export function ResumoCategorias({ itens }: { itens: ItemCategoria[] }) {
  const [decisoes, setDecisoes] = useState<DecisoesCategoria>({})
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [falhaInicial, setFalhaInicial] = useState(false)
  const [salvando, setSalvando] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/recebimento/categorias').then(async res => {
      if (!res.ok) throw new Error('Não foi possível carregar as classificações salvas.')
      setDecisoes(await res.json())
    }).catch((err: Error) => { setErro(err.message); setFalhaInicial(true) }).finally(() => setCarregando(false))
  }, [])

  async function classificar(descricao: string, categoria: Categoria) {
    setErro('')
    setSalvando(descricao)
    try {
      const res = await fetch('/api/recebimento/categorias', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ descricao, categoria }) })
      if (!res.ok) throw new Error('Não foi possível salvar a classificação. Tente novamente.')
      setDecisoes(prev => ({ ...prev, [normalizarDescricao(descricao)]: categoria }))
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao salvar classificação.')
    } finally {
      setSalvando(null)
    }
  }

  if (carregando) return <p className="py-6 text-center text-sm text-slate-500" role="status">Carregando categorias...</p>
  if (falhaInicial) return <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{erro}</p>

  const totais = resumirCategorias(itens, decisoes)
  const categorias = (Object.keys(CATEGORIAS) as Categoria[]).filter(c => totais[c].quantidade || totais[c].previstos || totais[c].semQuantidade)
  const revisar = [...new Set(itens.filter(i => !isDescricaoVolumeAvulso(i.descricao) && classificarDescricao(i.descricao, decisoes) === 'revisar').map(i => i.descricao))]
  const descricoes = [...new Set(itens.filter(i => i.descricao && !isDescricaoVolumeAvulso(i.descricao)).map(i => i.descricao))]
  const moveis = categorias.reduce((total, categoria) => total + totais[categoria].quantidade, 0)
  const semQuantidade = categorias.reduce((total, categoria) => total + totais[categoria].semQuantidade, 0)
  const previstos = categorias.reduce((total, categoria) => total + totais[categoria].previstos, 0)
  const conferidos = categorias.reduce((total, categoria) => total + totais[categoria].conferidos, 0)
  const percentual = percentualConferido(conferidos, previstos)

  function seletor(descricao: string) {
    return <label className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-600">
      <span>Categoria</span>
      <select value={classificarDescricao(descricao, decisoes)} disabled={salvando !== null} onChange={e => void classificar(descricao, e.target.value as Categoria)} className="min-h-11 min-w-0 max-w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800 disabled:opacity-50">
        {(Object.keys(CATEGORIAS) as Categoria[]).map(c => <option value={c} key={c}>{CATEGORIAS[c]}</option>)}
      </select>
      {salvando === descricao && <span role="status">Salvando...</span>}
    </label>
  }

  return <div className="space-y-4">
    <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 sm:p-5">
      <div className="flex items-center gap-3 sm:gap-4">
        <CircleCheck className="size-9 shrink-0 text-emerald-600 sm:size-10" aria-hidden="true" />
        <div className="min-w-0 flex-1"><p className="text-base font-bold tabular-nums text-slate-900 sm:text-lg">{conferidos} de {previstos} volumes conferidos</p><p className="mt-0.5 text-sm text-slate-600">{moveis} móveis previstos{semQuantidade > 0 ? ' · há itens sem quantidade confiável' : ''}</p></div>
        <Badge tone="success" className="shrink-0 text-sm tabular-nums">{formatarPercentual(percentual)}%</Badge>
      </div>
      <Progress className="mt-4 [&_[role=progressbar]]:h-2.5" value={percentual} label="Volumes conferidos no resumo" tone="success" />
    </div>
    {erro && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{erro}</p>}
    {categorias.length === 0 && <p className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">Nenhum móvel identificado neste resumo.</p>}
    <div className="space-y-2.5">{categorias.map(c => {
      const total = totais[c]
      const Icone = ICONES[c]
      const estilo = ESTILOS[c]
      const progresso = percentualConferido(total.conferidos, total.previstos)
      const concluido = total.previstos > 0 && total.conferidos >= total.previstos
      return <section key={c} className="rounded-xl border border-slate-200 bg-white p-3 sm:p-4">
        <div className="flex items-center gap-3 sm:gap-4">
          <span className={`flex size-11 shrink-0 items-center justify-center rounded-xl sm:size-12 ${estilo.icone}`}><Icone className="size-5 sm:size-6" aria-hidden="true" /></span>
          <div className="min-w-0 flex-1 sm:w-[34%] sm:flex-none"><h5 className="text-sm font-bold leading-tight text-slate-900 sm:text-base">{CATEGORIAS[c]}</h5><p className="mt-1 text-xs tabular-nums text-slate-600 sm:text-sm">{total.quantidade} {total.quantidade === 1 ? 'móvel previsto' : 'móveis previstos'}</p>{total.semQuantidade > 0 && <p className="mt-1 text-xs text-amber-800">{total.semQuantidade} item(ns) sem quantidade confiável.</p>}</div>
          <Badge tone={concluido ? 'success' : 'warning'} className="shrink-0 tabular-nums sm:hidden">{concluido && <Check className="mr-1 size-3.5" aria-hidden="true" />}{formatarPercentual(progresso)}%</Badge>
          <div className="hidden min-w-0 flex-1 border-l border-slate-200 pl-4 sm:block"><p className="text-sm text-slate-600"><strong className="tabular-nums text-slate-800">{total.conferidos} / {total.previstos}</strong> volumes conferidos</p><Progress className={`mt-2 ${estilo.barra}`} value={progresso} label={`Volumes conferidos: ${CATEGORIAS[c]}`} /></div>
          <Badge tone={concluido ? 'success' : 'warning'} className="hidden shrink-0 tabular-nums sm:inline-flex">{concluido && <Check className="mr-1 size-3.5" aria-hidden="true" />}{formatarPercentual(progresso)}%</Badge>
        </div>
        <div className="mt-3 sm:hidden"><p className="text-xs text-slate-600"><strong className="tabular-nums text-slate-800">{total.conferidos} / {total.previstos}</strong> volumes conferidos</p><Progress className={`mt-1.5 ${estilo.barra}`} value={progresso} label={`Volumes conferidos: ${CATEGORIAS[c]}`} /></div>
      </section>
    })}</div>
    <p className="text-xs leading-relaxed text-slate-500">A quantidade de móveis é a prevista. Volumes conferidos podem incluir itens com divergência.</p>
    {revisar.length > 0 && <section className="rounded-xl border border-amber-200 bg-amber-50 p-3"><h4 className="text-sm font-bold text-amber-900">Itens para revisar ({revisar.length})</h4>{revisar.map(descricao => <div key={descricao} className="border-t border-amber-200 py-3 first:border-0"><p className="text-sm text-slate-800">{descricao || 'Sem descrição'}</p>{descricao && seletor(descricao)}</div>)}</section>}
    <details className="rounded-xl border border-slate-200 bg-slate-50"><summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-slate-700">Revisar classificações</summary><div className="px-4 pb-2">{descricoes.filter(d => classificarDescricao(d, decisoes) !== 'revisar').map(descricao => <div key={descricao} className="border-t border-slate-200 py-3"><p className="text-sm text-slate-700">{descricao}</p>{seletor(descricao)}</div>)}</div></details>
  </div>
}

export function HistoricoCategorias() {
  const [itens, setItens] = useState<ItemCategoria[] | null>(null)
  const [erro, setErro] = useState('')
  useEffect(() => { fetch('/api/recebimento/categorias/historico').then(async r => { if (!r.ok) throw new Error('Não foi possível carregar o histórico.'); setItens(await r.json()) }).catch((e: Error) => setErro(e.message)) }, [])
  return <section className="rounded-xl border bg-white p-4"><h3 className="mb-2 font-bold">Histórico por categoria</h3><p className="mb-3 text-sm text-slate-600">Recebimentos fechados; assistências e volumes avulsos não contam como móveis.</p>{erro ? <p role="alert">{erro}</p> : itens ? <ResumoCategorias itens={itens} /> : <p>Carregando histórico...</p>}</section>
}
