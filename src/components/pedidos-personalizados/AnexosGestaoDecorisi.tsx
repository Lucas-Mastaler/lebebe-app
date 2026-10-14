'use client'

import { useRef, useState } from 'react'
import { Alert, Button, Dialog, DialogContent, DialogFooter, DialogHeader } from '@/components/design-system'
import { apiFormularioDecorisi, ErroApiFormularioDecorisi } from '@/lib/pedidos-personalizados/decorisi/formulario'
import { operacoesAnexoGestao } from '@/lib/pedidos-personalizados/status-fluxo'
import { AnexosDecorisi } from './AnexosDecorisi'
import type { DecorisiItemDetalhe, PedidoDetalhe } from './gestao-modelo'

type UploadPendente = { arquivo: File; slot: number; id?: string; chave: string; version: number }

export function AnexosGestaoDecorisi({ pedido, item, onAtualizado }: {
  pedido: PedidoDetalhe
  item: DecorisiItemDetalhe
  onAtualizado: () => Promise<void>
}) {
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState('')
  const [remover, setRemover] = useState<string | null>(null)
  const [reenvio, setReenvio] = useState(false)
  const [url, setUrl] = useState<string | null>(null)
  const trava = useRef(false)
  const pendente = useRef<UploadPendente | null>(null)
  const base = `/api/pedidos-personalizados/decorisi/pedidos/${pedido.id}/itens/${item.id}/anexos`
  async function executar(acao: () => Promise<void>) {
    if (trava.current) return
    trava.current = true; setOcupado(true); setErro('')
    try { await acao() } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível concluir a operação.')
      if (e instanceof ErroApiFormularioDecorisi && e.status === 409) await onAtualizado().catch(() => setErro('Recarregue o pedido para obter a versão atual.'))
    } finally { trava.current = false; setOcupado(false) }
  }
  async function enviar(arquivo: File, slot: number, id?: string) {
    await executar(async () => {
      const upload = pendente.current ?? { arquivo, slot, id, chave: crypto.randomUUID(), version: pedido.version }
      pendente.current = upload
      const form = new FormData()
      form.set('arquivo', upload.arquivo); form.set('slot', String(upload.slot)); form.set('expectedVersion', String(upload.version))
      try {
        await apiFormularioDecorisi(`${base}${upload.id ? `/${upload.id}` : ''}`, { method: upload.id ? 'PUT' : 'POST', headers: { 'Idempotency-Key': upload.chave }, body: form })
        pendente.current = null; setReenvio(false)
        await onAtualizado()
      } catch (e) {
        const incerto = !(e instanceof ErroApiFormularioDecorisi) || e.status >= 500
        if (!incerto) pendente.current = null
        setReenvio(incerto)
        throw e
      }
    })
  }
  function abrir(id: string) {
    if (trava.current) return
    const janela = window.open('about:blank', '_blank')
    if (janela) janela.opener = null
    void executar(async () => {
      try {
        const r = await apiFormularioDecorisi<{ url: string }>(`${base}/${id}`)
        if (janela) janela.location.href = r.url
        else setUrl(r.url)
      } catch (e) { janela?.close(); throw e }
    })
  }
  return <>
    {erro && <Alert tone="danger" title="Anexo não concluído">{erro}</Alert>}
    {reenvio && <Alert tone="warning" title="Confirmação pendente">Repita o mesmo envio para confirmar o resultado sem duplicar o arquivo.<Button disabled={ocupado} onClick={() => { const p = pendente.current; if (p) void enviar(p.arquivo, p.slot, p.id) }}>Confirmar envio</Button></Alert>}
    {url && <a href={url} target="_blank" rel="noopener noreferrer">Abrir anexo autorizado</a>}
    <AnexosDecorisi artigo={{ anexos: item.anexos.map(a => ({ id: a.id, slot: a.slot, nome_original: a.nomeOriginal, mime_type: a.mime, tamanho_bytes: a.tamanho })) }} bloqueado={ocupado || reenvio} salvo operacoes={operacoesAnexoGestao(pedido.status)} onArquivo={enviar} onAbrir={abrir} onExcluir={setRemover} />
    <Dialog open={remover !== null} onOpenChange={aberto => { if (!aberto && !ocupado) setRemover(null) }}>
      <DialogContent><DialogHeader title="Remover anexo?" description="O arquivo será removido deste produto." /><DialogFooter><Button variant="secondary" disabled={ocupado} onClick={() => setRemover(null)}>Cancelar</Button><Button variant="destructive" loading={ocupado} onClick={() => void executar(async () => { await apiFormularioDecorisi(`${base}/${remover}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ expectedVersion: pedido.version }) }); setRemover(null); await onAtualizado() })}>Remover</Button></DialogFooter></DialogContent>
    </Dialog>
  </>
}
