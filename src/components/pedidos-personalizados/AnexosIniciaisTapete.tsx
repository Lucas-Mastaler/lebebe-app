'use client'

import { FileText, FileUp, ImageIcon, Loader2, RotateCcw, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { AnexoLocalFormulario, TapeteFormulario } from './novo-pedido-modelo'

const ACCEPT = '.jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf'

type Props = {
  tapete: TapeteFormulario
  ordem: number
  bloqueado: boolean
  onSelecionar: (slot: 1 | 2, arquivo: File) => void
  onRemover: (slot: 1 | 2) => void
  onReenviar: (slot: 1 | 2) => void
}

function formatarTamanho(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} KB`
  return `${(bytes / (1024 * 1024)).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} MB`
}

function estadoDoAnexo(anexo: AnexoLocalFormulario) {
  if (anexo.estado === 'enviando') return 'Enviando...'
  if (anexo.estado === 'falhou') return 'Falha no envio'
  return 'Selecionado'
}

export function AnexosIniciaisTapete({ tapete, ordem, bloqueado, onSelecionar, onRemover, onReenviar }: Props) {
  return (
    <section className="mt-4 rounded-xl border border-dashed border-sky-200 bg-sky-50/50 p-4" aria-labelledby={`anexos-iniciais-${tapete.chaveLocal}`}>
      <div className="mb-3 space-y-2">
        <h4 id={`anexos-iniciais-${tapete.chaveLocal}`} className="font-semibold text-slate-900">Layout fornecido pelo designer, arquiteto ou cliente</h4>
        <p className="text-sm text-slate-600">
          Envie, sempre que disponíveis: desenho, layout, croqui, referência visual, projeto feito por arquiteto ou designer,
          imagem enviada pelo cliente, desenho feito pelo próprio cliente, ou qualquer outro arquivo que ajude a fábrica a
          compreender exatamente o tapete solicitado. Selecione até dois arquivos antes de salvar — o envio ocorrerá em
          sequência após a criação do pedido.
        </p>
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Quanto mais detalhado for o desenho, layout ou referência enviada, menor será a chance de dúvidas ou divergências na produção.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {([1, 2] as const).map((slot) => {
          const local = tapete.anexosLocais.find((item) => item.slot === slot)
          const enviado = tapete.anexos.find((item) => item.slot === slot)
          return (
            <div key={slot} className="rounded-lg border border-slate-200 bg-white p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-slate-800">Anexo {slot}</span>
                <span className="text-xs text-slate-500" aria-live="polite">{enviado ? 'Concluído' : local ? estadoDoAnexo(local) : 'Opcional'}</span>
              </div>
              {local ? (
                <div className="mt-3 space-y-3">
                  {local.previewUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={local.previewUrl} alt={`Prévia do anexo do slot ${slot}`} className="h-28 w-full rounded-md object-contain bg-slate-100" />
                  ) : (
                    <div className="flex h-20 items-center justify-center rounded-md bg-slate-100 text-slate-500"><FileText aria-hidden="true" /></div>
                  )}
                  <div className="min-w-0 text-sm">
                    <p className="truncate font-medium text-slate-800" title={local.arquivo.name}>{local.arquivo.name}</p>
                    <p className="text-xs text-slate-500">{local.arquivo.type} · {formatarTamanho(local.arquivo.size)}</p>
                    {local.erro && <p role="alert" className="mt-1 text-xs font-medium text-red-600">{local.erro}</p>}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <label className="inline-flex">
                      <input className="sr-only" type="file" accept={ACCEPT} disabled={bloqueado || local.estado === 'enviando'} aria-label={`Substituir seleção do slot ${slot} do tapete ${ordem}`} onChange={(event) => {
                        const arquivo = event.currentTarget.files?.[0]
                        event.currentTarget.value = ''
                        if (arquivo) onSelecionar(slot, arquivo)
                      }} />
                      <span className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-100"><RotateCcw className="size-4" />Substituir</span>
                    </label>
                    {local.estado === 'falhou' && tapete.tapeteId && (
                      <Button type="button" size="sm" variant="outline" disabled={bloqueado} onClick={() => onReenviar(slot)}><RotateCcw />Tentar novamente</Button>
                    )}
                    <Button type="button" size="sm" variant="ghost" disabled={bloqueado || local.estado === 'enviando'} onClick={() => onRemover(slot)}><Trash2 />Remover</Button>
                  </div>
                </div>
              ) : enviado ? (
                <div className="mt-3 flex items-center gap-2 text-sm text-emerald-700"><ImageIcon aria-hidden="true" /><span className="truncate">{enviado.nomeOriginal}</span></div>
              ) : (
                <label className="mt-3 flex min-h-20 cursor-pointer flex-col items-center justify-center rounded-md border border-dashed border-slate-300 p-3 text-center text-sm font-medium text-slate-700 hover:border-sky-400 hover:bg-sky-50 has-[:disabled]:pointer-events-none has-[:disabled]:opacity-50">
                  <FileUp className="mb-1 size-5" aria-hidden="true" />Selecionar arquivo
                  <input className="sr-only" type="file" accept={ACCEPT} disabled={bloqueado} aria-label={`Selecionar anexo do slot ${slot} do tapete ${ordem}`} onChange={(event) => {
                    const arquivo = event.currentTarget.files?.[0]
                    event.currentTarget.value = ''
                    if (arquivo) onSelecionar(slot, arquivo)
                  }} />
                </label>
              )}
              {local?.estado === 'enviando' && <div className="mt-2 flex items-center gap-2 text-xs text-sky-700"><Loader2 className="size-4 animate-spin" />Envio serial em andamento</div>}
            </div>
          )
        })}
      </div>
    </section>
  )
}
