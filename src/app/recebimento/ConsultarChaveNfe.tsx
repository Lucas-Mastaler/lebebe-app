'use client'

import { useRef, useState } from 'react'
import { Alert, Button, FormField, Input, useAsyncAction } from '@/components/design-system'
import { erroChave, normalizarChave } from '@/lib/recebimento/nfe-chave'
import type { ResultadoDfe } from '@/lib/recebimento/dfe-contract'
import type { ResultadoXml } from '@/lib/recebimento/xml-upload-contract'

export default function ConsultarChaveNfe({ busy, onBusyChange, onImported }: { busy: boolean; onBusyChange: (busy: boolean) => void; onImported: (results: ResultadoXml[]) => void }) {
  const [chave, setChave] = useState('')
  const [error, setError] = useState('')
  const [touched, setTouched] = useState(false)
  const [result, setResult] = useState<ResultadoDfe | null>(null)
  const [liberarEm, setLiberarEm] = useState(0)
  const emCurso = useRef(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function consultar() {
    if (emCurso.current || busy) return
    setTouched(true)
    const validation = erroChave(chave)
    setError(validation)
    if (validation) return
    if (Date.now() < liberarEm) {
      setResult(previous => ({ estado: 'limite', message: `Aguarde mais ${Math.ceil((liberarEm - Date.now()) / 60_000)} minuto(s) antes de consultar.`, resultado: previous?.resultado }))
      return
    }
    emCurso.current = true
    onBusyChange(true)
    setResult(null)
    try {
      const response = await fetch('/api/recebimento/consultar-chave', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chave }) })
      if (response.status === 401 || response.status === 403) {
        setResult({ estado: 'autenticacao', message: 'Você não tem acesso a esta consulta. Verifique sua sessão e permissões.' })
        return
      }
      const body: ResultadoDfe = await response.json()
      if (!body.estado || !body.message) throw new Error('response')
      setResult(body)
      if (body.retryAfter) setLiberarEm(Date.now() + body.retryAfter * 1000)
      if (body.resultado?.banco && body.resultado.banco !== 'erro') onImported([body.resultado])
    } catch {
      setLiberarEm(Date.now() + 60_000)
      setResult({ estado: 'temporario', message: 'A conexão foi interrompida. O resultado não pôde ser confirmado. Aguarde um minuto e consulte a mesma chave para verificar.' })
    } finally { emCurso.current = false; onBusyChange(false) }
  }

  const acao = useAsyncAction(consultar)
  const notaDisponivel = Boolean(result?.resultado && result.resultado.banco !== 'erro')
  function consultarNovaNota() {
    setChave('')
    setError('')
    setTouched(false)
    setResult(null)
    acao.reset()
    inputRef.current?.focus()
  }
  const xml = result?.resultado
  const avisoDrive = xml?.drive === 'existente'
    ? 'Este XML já está no Drive. Não foi necessário enviar outro arquivo.'
    : xml?.error_code === 'drive_conflito'
      ? 'Já existe um XML desta nota no Drive com conteúdo diferente. O arquivo que estava lá foi mantido. Peça ao responsável para conferir os arquivos.'
      : xml?.error_code === 'drive_confirmacao'
        ? 'O XML está no Drive, mas ainda falta confirmar o envio no aplicativo. A nota já pode ser usada no recebimento.'
        : 'Não foi possível concluir o envio do XML ao Drive. A nota já pode ser usada no recebimento. Peça ao responsável para conferir o envio.'
  return <div className="space-y-4">
    <FormField id="chave-nfe" label="Chave de acesso" required error={error || undefined} helper="Digite ou cole os 44 números que aparecem na DANFE. Espaços serão removidos.">
      {field => <Input {...field} ref={inputRef} value={chave} inputMode="numeric" autoComplete="off" disabled={busy} placeholder="44 números da chave de acesso" onBlur={() => { if (chave) { setTouched(true); setError(erroChave(chave)) } }} onChange={event => {
        const value = normalizarChave(event.target.value)
        setChave(value)
        setResult(null)
        // O intervalo vale para a empresa; trocar a chave não o cancela no backend.
        if (touched) setError(erroChave(value))
      }} />}
    </FormField>
    <Alert tone="info">Busque a nota para usá-la em um novo recebimento. O XML também será enviado ao Drive. A consulta não inicia um recebimento.</Alert>
    <div aria-live="polite" className="space-y-3">
      {busy && <p className="text-sm text-muted-foreground">Consultando a nota e preparando o XML…</p>}
      {notaDisponivel && xml ? <>
        <Alert tone="success" title={xml.numero_nf ? `NF ${xml.numero_nf}` : 'Nota disponível'}>
          {xml.banco === 'existente' ? 'Esta nota já está cadastrada e disponível para um novo recebimento.' : 'Nota importada com sucesso! Ela já está disponível para um novo recebimento.'}
        </Alert>
        {xml.drive === 'salvo' ? <Alert tone="success">XML salvo no Drive.</Alert> : <Alert tone="warning" title="Arquivo no Drive">{avisoDrive}</Alert>}
      </> : result && <Alert tone={['resumo', 'manifestacao_necessaria', 'indisponivel', 'limite'].includes(result.estado) ? 'warning' : 'danger'}><p>{result.message}</p></Alert>}
    </div>
    <div className="flex justify-end">{notaDisponivel
      ? <Button type="button" disabled={busy || acao.loading} onClick={consultarNovaNota}>Consultar nova nota</Button>
      : <Button type="button" loading={busy || acao.loading} disabled={busy || acao.loading} onClick={() => { void acao.run() }}>Consultar nota</Button>}
    </div>
  </div>
}
