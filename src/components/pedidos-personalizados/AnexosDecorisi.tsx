'use client'

import { useState } from 'react'
import { CheckCircle2, ExternalLink, FileText, FileUp, RefreshCw, Trash2 } from 'lucide-react'
import { Alert, Button, Dialog, DialogContent, DialogFooter, DialogHeader, Section } from '@/components/design-system'
import type { AnexoFormularioDecorisi } from '@/lib/pedidos-personalizados/decorisi/formulario'

const ACCEPT = '.jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf'
const SLOTS = [1, 2, 3, 4, 5] as const

export type AnexoLocalDecorisi = {
  slot: number
  arquivo: File
  previewUrl: string | null
  anexoId?: string
}

function formatarTamanho(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} KB`
  return `${(bytes / (1024 * 1024)).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} MB`
}

export function AnexosDecorisi({
  artigo,
  ordem,
  bloqueado,
  salvo,
  onArquivo,
  onExcluir,
  onAbrir,
  locais = [],
  onSelecionarLocal,
  onRemoverLocal,
  operacoes = { adicionar: true, substituir: true, remover: true },
  opcional = false,
}: {
  artigo: { anexos: AnexoFormularioDecorisi[] }
  ordem?: number
  bloqueado: boolean
  salvo: boolean
  onArquivo: (arquivo: File, slot: number, anexoId?: string) => Promise<void>
  onExcluir: (id: string) => void
  onAbrir: (id: string) => void
  locais?: readonly AnexoLocalDecorisi[]
  onSelecionarLocal?: (slot: number, arquivo: File, anexoId?: string) => void
  onRemoverLocal?: (slot: number) => void
  operacoes?: { adicionar: boolean; substituir: boolean; remover: boolean }
  opcional?: boolean
}) {
  const [confirmacao, setConfirmacao] = useState<{ slot: number; arquivo: File; anexoId: string } | null>(null)
  const produto = ordem ?? 'deste produto'

  function aplicar(slot: number, arquivo: File, anexoId?: string) {
    if (!salvo && onSelecionarLocal) onSelecionarLocal(slot, arquivo, anexoId)
    else void onArquivo(arquivo, slot, anexoId)
  }

  function escolher(slot: number, arquivo: File) {
    const servidor = artigo.anexos.find((anexo) => anexo.slot === slot)
    if (servidor) setConfirmacao({ slot, arquivo, anexoId: servidor.id })
    else aplicar(slot, arquivo)
  }

  return (
    <Section
      tone="section-2"
      title={opcional ? 'Referência visual (opcional)' : 'Referência visual do papel ou painel'}
      description={opcional
        ? 'Opcional para papel de catálogo. Abra apenas se houver desenho, foto ou layout.'
        : 'Envie desenho, layout, foto ou qualquer referência que ajude a fábrica a compreender o papel de parede ou o painel. Até cinco arquivos JPEG, PNG, WEBP ou PDF, com no máximo 10 MiB cada.'}
      collapsible={opcional}
      defaultCollapsed={opcional && artigo.anexos.length === 0 && locais.length === 0}
      className="mt-4"
    >
      <Alert tone="warning">Quanto mais detalhado for o desenho, layout ou referência enviada, menor será a chance de dúvidas ou divergências na produção.</Alert>
      {!salvo && !onSelecionarLocal && (
        <p className="text-sm text-slate-500">Salve o rascunho e suas alterações antes de gerenciar os arquivos deste produto.</p>
      )}
      {!salvo && onSelecionarLocal && (
        <p className="text-sm text-slate-500">Você pode selecionar os arquivos agora. O envio acontece ao salvar o rascunho.</p>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        {SLOTS.map((slot) => {
          const servidor = artigo.anexos.find((anexo) => anexo.slot === slot)
          const local = locais.find((anexo) => anexo.slot === slot)
          const podeEscolher = !bloqueado && (servidor ? operacoes.substituir : operacoes.adicionar) && (salvo || !!onSelecionarLocal)
          return (
            <div key={slot} className={`rounded-xl border p-4 ${servidor && !local ? 'border-emerald-200 bg-emerald-50/60' : 'border-slate-200 bg-white'}`}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-slate-800">Anexo {slot}</span>
                <span className={`inline-flex items-center gap-1 text-xs font-semibold ${servidor && !local ? 'text-emerald-700' : 'text-slate-500'}`} aria-live="polite">
                  {servidor && !local && <CheckCircle2 className="size-4" aria-hidden="true" />}
                  {local ? 'Selecionado' : servidor ? 'Concluído' : 'Opcional'}
                </span>
              </div>
              {local ? (
                <div className="mt-3 space-y-3">
                  {local.previewUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={local.previewUrl} alt={`Prévia do anexo ${slot}`} className="h-28 w-full rounded-md bg-slate-100 object-contain" />
                  ) : (
                    <div className="flex h-20 items-center justify-center rounded-md bg-slate-100 text-slate-500"><FileText aria-hidden="true" /></div>
                  )}
                  <div className="min-w-0 text-sm">
                    <p className="truncate font-medium text-slate-800" title={local.arquivo.name}>{local.arquivo.name}</p>
                    <p className="text-xs text-slate-500">{local.arquivo.type || 'Arquivo'} · {formatarTamanho(local.arquivo.size)}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {operacoes.substituir && (
                      <label className="inline-flex">
                        <input className="sr-only" type="file" accept={ACCEPT} disabled={!podeEscolher} aria-label={`Substituir anexo ${slot} do produto ${produto}`} onChange={(event) => {
                          const arquivo = event.currentTarget.files?.[0]
                          event.currentTarget.value = ''
                          if (arquivo) escolher(slot, arquivo)
                        }} />
                        <span className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-100 has-[:disabled]:pointer-events-none has-[:disabled]:opacity-50"><RefreshCw className="size-4" />Substituir</span>
                      </label>
                    )}
                    {onRemoverLocal && (
                      <Button type="button" size="sm" variant="ghost" className="min-h-11" disabled={bloqueado} onClick={() => onRemoverLocal(slot)}><Trash2 />Remover</Button>
                    )}
                  </div>
                </div>
              ) : servidor ? (
                <div className="mt-3 space-y-3">
                  <div className="min-w-0 text-sm text-slate-700">
                    <p className="break-all font-medium">{servidor.nome_original}</p>
                    <p className="mt-1 text-xs text-slate-500">{servidor.mime_type} · {formatarTamanho(servidor.tamanho_bytes)}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" size="sm" variant="secondary" className="min-h-11" disabled={bloqueado} onClick={() => onAbrir(servidor.id)}>
                      <ExternalLink />Abrir
                    </Button>
                    {operacoes.substituir && (
                      <label className="inline-flex">
                        <input className="sr-only" type="file" accept={ACCEPT} disabled={!podeEscolher} aria-label={`Substituir anexo ${slot} do produto ${produto}`} onChange={(event) => {
                          const arquivo = event.currentTarget.files?.[0]
                          event.currentTarget.value = ''
                          if (arquivo) escolher(slot, arquivo)
                        }} />
                        <span className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-100 has-[:disabled]:pointer-events-none has-[:disabled]:opacity-50"><RefreshCw className="size-4" />Substituir</span>
                      </label>
                    )}
                    {operacoes.remover && (
                      <Button type="button" size="sm" variant="destructive" className="min-h-11" disabled={bloqueado || !salvo} onClick={() => onExcluir(servidor.id)}>
                        <Trash2 />Remover
                      </Button>
                    )}
                  </div>
                </div>
              ) : (
                <label className="relative mt-3 flex min-h-24 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white p-3 text-center text-sm font-medium text-slate-700 hover:border-sky-400 hover:bg-sky-50 has-[:disabled]:pointer-events-none has-[:disabled]:opacity-50">
                  <FileUp className="mb-2 size-5" aria-hidden="true" />
                  Selecionar arquivo
                  <input className="sr-only" type="file" accept={ACCEPT} disabled={!podeEscolher} aria-label={`Selecionar anexo ${slot} do produto ${produto}`} onChange={(event) => {
                    const arquivo = event.currentTarget.files?.[0]
                    event.currentTarget.value = ''
                    if (arquivo) escolher(slot, arquivo)
                  }} />
                </label>
              )}
            </div>
          )
        })}
      </div>
      <Dialog open={confirmacao !== null} onOpenChange={(aberto) => { if (!aberto) setConfirmacao(null) }}>
        <DialogContent>
          <DialogHeader
            title="Substituir este anexo?"
            description={salvo
              ? 'O arquivo atual será mantido caso a substituição não possa ser concluída.'
              : 'A prévia fica neste slot e o envio ocorre ao salvar o rascunho.'}
          />
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setConfirmacao(null)}>Cancelar</Button>
            <Button type="button" onClick={() => {
              const atual = confirmacao
              setConfirmacao(null)
              if (atual) aplicar(atual.slot, atual.arquivo, atual.anexoId)
            }}>Substituir anexo</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Section>
  )
}
