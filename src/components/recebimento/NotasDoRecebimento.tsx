import { FileText, Package } from 'lucide-react'

export type NotaDoRecebimento = { nfe_id: string; nfe: { numero_nf: string | null; volumes_total: number | null; is_os: boolean | null } | null }

export function NotasDoRecebimento({ notas }: { notas: NotaDoRecebimento[] }) {
  const totalVolumes = notas.reduce((total, nota) => total + (nota.nfe?.volumes_total ?? 0), 0)
  const notasSemVolumes = notas.some(nota => nota.nfe?.volumes_total == null)
  return <section aria-labelledby="resumo-notas" className="rounded-2xl border border-slate-200 bg-white p-4">
    <div className="flex items-start justify-between gap-3">
      <div className="flex items-center gap-2.5"><span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><FileText className="size-5" aria-hidden="true" /></span><div><h3 id="resumo-notas" className="font-bold text-slate-900">Notas fiscais</h3><p className="text-xs text-slate-500">{notas.length} {notas.length === 1 ? 'nota vinculada' : 'notas vinculadas'}</p></div></div>
      {notas.length > 0 && <div className="text-right"><p className="text-lg font-bold tabular-nums text-slate-900">{notasSemVolumes ? '—' : totalVolumes}</p><p className="text-xs text-slate-500">volumes nas notas</p></div>}
    </div>
    {notas.length === 0 ? <p className="mt-3 text-sm text-slate-500">Nenhuma nota vinculada.</p> : <div className="mt-3 grid gap-2 sm:grid-cols-2">{notas.map(({ nfe_id, nfe }) => <div key={nfe_id} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2.5"><div className="min-w-0"><span className="text-sm font-semibold text-slate-800">NF {nfe?.numero_nf || 'não informada'}</span>{nfe?.is_os && <span className="ml-2 rounded-full bg-sky-100 px-2 py-0.5 text-xs font-semibold text-sky-700">OS</span>}</div><span className="flex shrink-0 items-center gap-1 text-xs text-slate-600"><Package className="size-3.5" aria-hidden="true" />{nfe?.volumes_total == null ? 'não informado' : `${nfe.volumes_total} vol.`}</span></div>)}</div>}
    {notasSemVolumes && <p className="mt-2 text-xs text-slate-500">O total não está disponível porque falta o volume de uma ou mais notas.</p>}
    <p className="mt-3 text-xs text-slate-500">Volumes declarados nas notas; a conferência por categoria aparece abaixo.</p>
  </section>
}
