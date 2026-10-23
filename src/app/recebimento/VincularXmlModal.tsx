'use client'

import { useRef, useState } from 'react'
import { UploadCloud } from 'lucide-react'
import { Alert, Button, Dialog, DialogBody, DialogContent, DialogHeader, FormField, Input } from '@/components/design-system'
import { XML_MAX_BYTES, XML_MAX_FILES, type ResultadoXml } from '@/lib/recebimento/xml-upload-contract'

export default function VincularXmlModal({ onClose, onImported }: { onClose: () => void; onImported: () => void }) {
  const [files, setFiles] = useState<File[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [results, setResults] = useState<ResultadoXml[]>([])
  const [progress, setProgress] = useState(0)
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const concluido = results.length === files.length && results.length > 0 && results.every(result => result.status === 'ok')

  function selecionar(selected: File[]) {
    setResults([])
    setFiles(selected)
    setError(selected.length > XML_MAX_FILES ? 'Selecione no máximo 10 arquivos por vez.'
      : selected.some(file => !/\.xml$/i.test(file.name)) ? 'Todos os arquivos devem ter extensão .xml.'
      : selected.some(file => !file.size || file.size > XML_MAX_BYTES) ? 'Cada XML deve ter até 2 MB e não pode estar vazio.' : '')
  }

  async function importar() {
    if (busy) return
    if (!files.length || error) { setError(error || 'Selecione pelo menos um arquivo XML.'); return }
    setBusy(true)
    setResults([])
    setProgress(0)
    let cadastrou = false
    try {
      for (const [index, file] of files.entries()) {
        let result: ResultadoXml
        try {
          const form = new FormData()
          form.append('xml', file)
          const response = await fetch('/api/recebimento/importar-xml', { method: 'POST', body: form })
          const body = await response.json()
          if (!response.ok || !body.results?.[0]) {
            result = { file: file.name, status: 'erro', banco: 'erro', drive: 'nao_enviado', error: response.status === 401 || response.status === 403 ? 'Você não tem acesso a esta importação. Verifique sua sessão e permissões.' : 'Não foi possível importar este arquivo. Tente novamente com o mesmo XML.' }
          } else result = body.results[0]
        } catch {
          result = { file: file.name, status: 'erro', banco: 'erro', drive: 'nao_enviado', error: 'A conexão foi interrompida. O resultado não pôde ser confirmado. Envie o mesmo XML para verificar e concluir.' }
        }
        cadastrou ||= result.banco !== 'erro'
        setResults(previous => [...previous, result])
        setProgress(index + 1)
      }
    } finally {
      setBusy(false)
      if (cadastrou) onImported()
    }
  }

  return (
    <Dialog open onOpenChange={open => { if (!open && !busy) onClose() }}>
      <DialogContent className="max-w-lg">
        <DialogHeader title="Vincular XML" description="Cadastre a nota e seus produtos para continuar no Novo recebimento." />
        <DialogBody className="space-y-4">
          <FormField id="xml-recebimento" label="Arquivos XML" required error={error || undefined} helper="Até 10 arquivos por vez, com até 2 MB cada.">
            {field => (
              <div
                role="group"
                aria-label="Área para arrastar arquivos XML"
                aria-disabled={busy}
                className={`flex flex-col items-center gap-3 rounded-lg border-2 border-dashed px-4 py-6 text-center transition-colors ${dragging && !busy ? 'border-primary bg-primary/5' : 'border-border bg-muted/20'} ${busy ? 'opacity-60' : ''}`}
                onDragOver={event => { event.preventDefault(); if (!busy) setDragging(true) }}
                onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false) }}
                onDrop={event => {
                  event.preventDefault()
                  event.stopPropagation()
                  setDragging(false)
                  if (!busy) selecionar(Array.from(event.dataTransfer.files))
                }}
              >
                <UploadCloud className="size-7 text-muted-foreground" aria-hidden="true" />
                <p className="text-sm font-medium">{dragging && !busy ? 'Solte os arquivos aqui' : 'Arrastar arquivos'}</p>
                <p className="text-xs text-muted-foreground">Selecione um ou vários arquivos XML de NF-e</p>
                <Input ref={inputRef} id={field.id} className="sr-only" tabIndex={-1} type="file" multiple accept=".xml,application/xml,text/xml" disabled={busy} aria-invalid={field['aria-invalid']} aria-describedby={field['aria-describedby']} onChange={event => selecionar(Array.from(event.target.files ?? []))} />
                <Button type="button" variant="secondary" disabled={busy} onClick={() => inputRef.current?.click()}>Selecionar arquivos</Button>
                {files.length > 0 && <ul aria-label="Arquivos selecionados" className="w-full space-y-1 text-left text-xs text-muted-foreground">{files.map((file, index) => <li key={index} className="break-all">{file.name}</li>)}</ul>}
              </div>
            )}
          </FormField>
          <Alert tone="info">O XML será salvo na pasta operacional do Drive e poderá ser processado pela automação existente do SGI. O upload não cria um recebimento.</Alert>
          <div aria-live="polite" className="space-y-3">
            {busy && <p className="text-sm text-muted-foreground">Processando arquivo {Math.min(progress + 1, files.length)} de {files.length}…</p>}
            {results.map((result, index) => (
              <Alert key={index} tone={result.status === 'ok' ? 'success' : result.status === 'parcial' ? 'warning' : 'danger'}>
                <p className="break-all font-medium">{result.file}{result.numero_nf ? ` — NF ${result.numero_nf}` : ''}</p>
                {result.status === 'ok' ? <p>Nota vinculada no aplicativo e disponível para novos recebimentos. {result.drive === 'existente' ? 'O XML já estava no Drive.' : 'XML salvo no Drive.'}</p> : <>
                  {result.status === 'parcial' && <p>A nota está cadastrada e disponível no Novo recebimento. A gravação no Drive ainda precisa ser concluída.</p>}
                  <p>{result.error}</p>
                </>}
              </Alert>
            ))}
          </div>
        </DialogBody>
        <div className="flex shrink-0 justify-end gap-3 border-t border-border px-6 py-4">
          <Button variant="secondary" disabled={busy} onClick={onClose}>Fechar</Button>
          {!concluido && <Button loading={busy} disabled={busy || !files.length || Boolean(error)} onClick={importar}>{results.length ? 'Tentar novamente' : 'Confirmar importação'}</Button>}
        </div>
      </DialogContent>
    </Dialog>
  )
}
