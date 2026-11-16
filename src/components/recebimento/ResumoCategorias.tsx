'use client'
import { useEffect, useState } from 'react'
import { isDescricaoVolumeAvulso } from '@/lib/recebimento/volume-avulso'
import { CATEGORIAS, classificarDescricao, normalizarDescricao, resumirCategorias, type Categoria, type DecisoesCategoria, type ItemCategoria } from '@/lib/recebimento/categorias'

export function ResumoCategorias({ itens }: { itens: ItemCategoria[] }) {
  const [decisoes, setDecisoes] = useState<DecisoesCategoria>({})
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [falhaInicial, setFalhaInicial] = useState(false)
  useEffect(() => {
    fetch('/api/recebimento/categorias').then(async res => {
      if (!res.ok) throw new Error('Não foi possível carregar as classificações salvas.')
      setDecisoes(await res.json())
    }).catch((err: Error) => { setErro(err.message); setFalhaInicial(true) }).finally(() => setCarregando(false))
  }, [])
  async function classificar(descricao: string, categoria: Categoria) {
    setErro('')
    try {
      const res = await fetch('/api/recebimento/categorias', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ descricao, categoria }) })
      if (!res.ok) throw new Error('Não foi possível salvar a classificação.')
      setDecisoes(prev => ({ ...prev, [normalizarDescricao(descricao)]: categoria }))
    } catch (err) { setErro(err instanceof Error ? err.message : 'Erro ao salvar classificação.') }
  }
  if (carregando) return <p>Carregando categorias...</p>
  if (falhaInicial) return <p role="alert" className="text-red-700">{erro}</p>
  const totais = resumirCategorias(itens, decisoes)
  const revisar = [...new Set(itens.filter(i => !isDescricaoVolumeAvulso(i.descricao) && classificarDescricao(i.descricao, decisoes) === 'revisar').map(i => i.descricao))]
  const descricoes = [...new Set(itens.filter(i => i.descricao && !isDescricaoVolumeAvulso(i.descricao)).map(i => i.descricao))]
  return <div className="space-y-3">
    <p className="text-xs text-slate-600">Móveis são quantidades previstas. Volumes conferidos podem incluir itens com divergência.</p>
    {erro && <p role="alert" className="text-red-700">{erro}</p>}
    <div className="space-y-2">{(Object.keys(CATEGORIAS) as Categoria[]).filter(c => totais[c].quantidade || totais[c].previstos || totais[c].semQuantidade).map(c => <div key={c} className="rounded-lg bg-slate-50 p-3">
      <div className="font-semibold text-slate-800">{CATEGORIAS[c]}</div>
      <div className="text-sm text-slate-600">{totais[c].quantidade} móveis previstos · {totais[c].conferidos} / {totais[c].previstos} volumes conferidos</div>
      {totais[c].semQuantidade > 0 && <p className="text-xs text-amber-700">{totais[c].semQuantidade} item(ns) sem quantidade confiável.</p>}
    </div>)}</div>
    <details><summary className="cursor-pointer text-sm font-medium">Revisar classificações</summary>{descricoes.filter(d => classificarDescricao(d, decisoes) !== 'revisar').map(descricao => <div key={descricao} className="border-t py-2"><p className="text-sm">{descricao}</p><label className="text-xs">Classificar como <select value={classificarDescricao(descricao, decisoes)} onChange={e => classificar(descricao, e.target.value as Categoria)} className="ml-2 rounded border p-1">{(Object.keys(CATEGORIAS) as Categoria[]).map(c => <option value={c} key={c}>{CATEGORIAS[c]}</option>)}</select></label></div>)}</details>
    {revisar.length > 0 && <div><h4 className="font-semibold">Itens para revisar</h4>{revisar.map(descricao => <div key={descricao} className="border-t py-2"><p className="text-sm">{descricao || 'Sem descrição'}</p>{descricao && <label className="text-xs">Classificar como <select defaultValue="revisar" onChange={e => classificar(descricao, e.target.value as Categoria)} className="ml-2 rounded border p-1">{(Object.keys(CATEGORIAS) as Categoria[]).map(c => <option value={c} key={c}>{CATEGORIAS[c]}</option>)}</select></label>}</div>)}</div>}
  </div>
}

export function HistoricoCategorias() {
  const [itens, setItens] = useState<ItemCategoria[] | null>(null)
  const [erro, setErro] = useState('')
  useEffect(() => { fetch('/api/recebimento/categorias/historico').then(async r => { if (!r.ok) throw new Error('Não foi possível carregar o histórico.') ; setItens(await r.json()) }).catch((e: Error) => setErro(e.message)) }, [])
  return <section className="rounded-xl border bg-white p-4"><h3 className="mb-2 font-bold">Histórico por categoria</h3><p className="mb-3 text-sm text-slate-600">Recebimentos fechados; assistências e volumes avulsos não contam como móveis.</p>{erro ? <p role="alert">{erro}</p> : itens ? <ResumoCategorias itens={itens} /> : <p>Carregando histórico...</p>}</section>
}
