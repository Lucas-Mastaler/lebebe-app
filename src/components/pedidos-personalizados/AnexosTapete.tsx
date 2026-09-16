'use client'

import { useState } from 'react'
import { CheckCircle2, ExternalLink, FileUp, RefreshCw, Trash2 } from 'lucide-react'
import { Button, Card, CardContent, CardHeader, Dialog, DialogContent, DialogFooter, DialogHeader } from '@/components/design-system'
import type { AnexoFormulario, TapeteFormulario } from './novo-pedido-modelo'

type OperacaoAnexo = {
  chaveLocal: string
  slot: 1 | 2
  tipo: 'upload' | 'substituicao' | 'remocao' | 'abertura'
}

type Confirmacao =
  | { tipo: 'substituir'; anexo: AnexoFormulario; arquivo: File }
  | { tipo: 'remover'; anexo: AnexoFormulario }

type Props = {
  tapete: TapeteFormulario
  ordem: number
  bloqueado: boolean
  operacao: OperacaoAnexo | null
  errosPorSlot: Partial<Record<1 | 2, string>>
  onUpload: (slot: 1 | 2, arquivo: File) => Promise<void>
  onAbrir: (anexo: AnexoFormulario) => Promise<void>
  onSubstituir: (anexo: AnexoFormulario, arquivo: File) => Promise<void>
  onRemover: (anexo: AnexoFormulario) => Promise<void>
  podeAdicionar?: boolean
  podeSubstituir?: boolean
  podeRemover?: boolean
}

const ACCEPT = '.jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf'

function formatarTamanho(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} KB`
  return `${(bytes / (1024 * 1024)).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} MB`
}

export function AnexosTapete({
  tapete,
  ordem,
  bloqueado,
  operacao,
  errosPorSlot,
  onUpload,
  onAbrir,
  onSubstituir,
  onRemover,
  podeAdicionar = true,
  podeSubstituir = true,
  podeRemover = true,
}: Props) {
  const [confirmacao, setConfirmacao] = useState<Confirmacao | null>(null)

  function ocupado(slot: 1 | 2) {
    return tapete.anexos.find((anexo) => anexo.slot === slot) ?? null
  }

  function estaProcessando(slot: 1 | 2) {
    return operacao?.chaveLocal === tapete.chaveLocal && operacao.slot === slot
  }

  async function confirmar() {
    if (!confirmacao) return
    const atual = confirmacao
    setConfirmacao(null)
    if (atual.tipo === 'substituir') await onSubstituir(atual.anexo, atual.arquivo)
    else await onRemover(atual.anexo)
  }

  return (
    <Card>
      <CardHeader title={`Anexos do tapete ${ordem}`} description="Até dois arquivos JPEG, PNG, WEBP ou PDF, com no máximo 10 MB cada." />
      <CardContent>
        <div className="grid gap-3 lg:grid-cols-2">
          {([1, 2] as const).map((slot) => {
            const anexo = ocupado(slot)
            const processando = estaProcessando(slot)
            const erro = errosPorSlot[slot]
            return (
              <div key={slot} className={`rounded-xl border p-4 ${anexo ? 'border-emerald-200 bg-emerald-50/60' : 'border-slate-200 bg-slate-50'}`}>
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold text-slate-800">Slot {slot}</p>
                  <span className={`inline-flex items-center gap-1 text-xs font-semibold ${anexo ? 'text-emerald-700' : 'text-slate-500'}`} aria-live="polite">
                    {anexo && !processando && <CheckCircle2 className="size-4" aria-hidden="true" />}
                    {processando ? 'Processando...' : anexo ? 'Concluído' : 'Aguardando arquivo'}
                  </span>
                </div>

                {anexo ? (
                  <div className="mt-3 space-y-3">
                    <div className="min-w-0 text-sm text-slate-700">
                      <p className="break-all font-medium">{anexo.nomeOriginal}</p>
                      <p className="mt-1 text-xs text-slate-500">{anexo.mime} · {formatarTamanho(anexo.tamanho)}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" size="sm" variant="secondary" loading={processando && operacao?.tipo === 'abertura'} disabled={bloqueado} onClick={() => void onAbrir(anexo)}>
                        <ExternalLink />
                        Abrir
                      </Button>
                      <label className="relative inline-flex">
                        <input
                          className="sr-only"
                          type="file"
                          accept={ACCEPT}
                          disabled={bloqueado || !podeSubstituir}
                          aria-label={`Substituir anexo do slot ${slot} do tapete ${ordem}`}
                          onChange={(event) => {
                            const arquivo = event.currentTarget.files?.[0]
                            event.currentTarget.value = ''
                            if (arquivo) setConfirmacao({ tipo: 'substituir', anexo, arquivo })
                          }}
                        />
                        <span className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-100 aria-disabled:pointer-events-none aria-disabled:opacity-50" aria-disabled={bloqueado || !podeSubstituir}>
                          <RefreshCw className="size-4" />Substituir
                        </span>
                      </label>
                      <Button type="button" size="sm" variant="destructive" loading={processando && operacao?.tipo === 'remocao'} disabled={bloqueado || !podeRemover} onClick={() => setConfirmacao({ tipo: 'remover', anexo })}>
                        <Trash2 />
                        Remover
                      </Button>
                    </div>
                  </div>
                ) : (
                  <label className="relative mt-3 flex min-h-24 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white p-3 text-center text-sm font-medium text-slate-700 hover:border-sky-400 hover:bg-sky-50 has-[:disabled]:pointer-events-none has-[:disabled]:opacity-50">
                    {processando ? <RefreshCw className="mb-2 size-5 animate-spin" /> : <FileUp className="mb-2 size-5" />}
                    {processando ? 'Enviando...' : `Enviar arquivo no slot ${slot}`}
                    <input
                      className="sr-only"
                      type="file"
                      accept={ACCEPT}
                      disabled={bloqueado || !podeAdicionar}
                      aria-label={`Enviar anexo no slot ${slot} do tapete ${ordem}`}
                      onChange={(event) => {
                        const arquivo = event.currentTarget.files?.[0]
                        event.currentTarget.value = ''
                        if (arquivo) void onUpload(slot, arquivo)
                      }}
                    />
                  </label>
                )}
                {erro && <p role="alert" className="mt-2 text-sm font-medium text-red-600">{erro}</p>}
              </div>
            )
          })}
        </div>
      </CardContent>

      <Dialog open={confirmacao !== null} onOpenChange={(aberto) => { if (!aberto) setConfirmacao(null) }}>
        <DialogContent>
          <DialogHeader
            title={confirmacao?.tipo === 'remover' ? 'Remover este anexo?' : 'Substituir este anexo?'}
            description={confirmacao?.tipo === 'remover'
              ? 'O anexo deixará de aparecer no pedido e a remoção física será processada com segurança pelo sistema.'
              : 'O arquivo atual será mantido caso a substituição não possa ser concluída.'}
            className="bg-gradient-to-r from-slate-50 to-sky-50"
          />
          <DialogFooter className="border-t bg-slate-50 px-6 py-4">
            <Button type="button" variant="secondary" onClick={() => setConfirmacao(null)}>Cancelar</Button>
            <Button type="button" variant={confirmacao?.tipo === 'remover' ? 'destructive' : 'primary'} onClick={() => void confirmar()}>
              {confirmacao?.tipo === 'remover' ? 'Remover anexo' : 'Substituir anexo'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
