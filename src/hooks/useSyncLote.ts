'use client'

import { useCallback, useRef, useState } from 'react'
import type { SgiDocumento } from '@/types/sgi'

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type StatusLinha =
  | 'aguardando'
  | 'processando'
  | 'sincronizado'
  | 'cache_valido'
  | 'erro'

export interface LinhaLote {
  numeroLancamento: string
  cliente: string | null
  status: StatusLinha
  erro?: string
}

export interface EstadoLote {
  rodando: boolean
  concluido: boolean
  total: number
  processados: number
  atualIndex: number
  linhas: LinhaLote[]
  forcar: boolean
}

// ─── Helpers internos ─────────────────────────────────────────────────────────

const POLL_INTERVAL_MS = 2000
const POLL_MAX_TENTATIVAS = 30

async function sincronizarVenda(
  numeroLancamento: string,
  forcar: boolean
): Promise<{ jobId: string | null; status: string; resultadoCache?: unknown }> {
  const res = await fetch('/api/sgi/digisac/sincronizar-venda', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ numeroLancamento, forcarAtualizacao: forcar }),
  })
  if (!res.ok) throw new Error(`sincronizar-venda HTTP ${res.status}`)
  return res.json()
}

async function processarFila(jobId: string): Promise<{ status: string }> {
  const res = await fetch('/api/sgi/digisac/processar-fila', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jobId }),
  })
  if (!res.ok) throw new Error(`processar-fila HTTP ${res.status}`)
  return res.json()
}

async function aguardarConclusao(
  jobId: string,
  signal: AbortSignal
): Promise<void> {
  for (let i = 0; i < POLL_MAX_TENTATIVAS; i++) {
    if (signal.aborted) throw new Error('cancelado')
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS))
    if (signal.aborted) throw new Error('cancelado')

    const res = await fetch(`/api/sgi/digisac/sync-status?jobId=${jobId}`)
    if (!res.ok) continue
    const data = await res.json()
    const s: string = data?.status ?? ''
    if (s === 'concluido' || s === 'ignorado_cache_valido') return
    if (s === 'erro') throw new Error(data?.erroMensagem ?? 'Erro na sync')
  }
  throw new Error('Timeout: sync não concluiu em tempo hábil')
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useSyncLote(onVendaProcessada?: () => void) {
  const [estado, setEstado] = useState<EstadoLote>({
    rodando: false,
    concluido: false,
    total: 0,
    processados: 0,
    atualIndex: -1,
    linhas: [],
    forcar: false,
  })

  // Ref para cancelamento via AbortController
  const abortRef = useRef<AbortController | null>(null)

  const atualizar = useCallback(
    (patch: Partial<EstadoLote> | ((prev: EstadoLote) => Partial<EstadoLote>)) => {
      setEstado((prev) => ({
        ...prev,
        ...(typeof patch === 'function' ? patch(prev) : patch),
      }))
    },
    []
  )

  const atualizarLinha = useCallback(
    (index: number, patch: Partial<LinhaLote>) => {
      setEstado((prev) => {
        const linhas = [...prev.linhas]
        linhas[index] = { ...linhas[index], ...patch }
        return { ...prev, linhas }
      })
    },
    []
  )

  const iniciar = useCallback(
    async (vendas: SgiDocumento[], forcar: boolean) => {
      if (!vendas.length) return

      const linhas: LinhaLote[] = vendas.map((v) => ({
        numeroLancamento: v.numero_lancamento,
        cliente: v.cliente,
        status: 'aguardando',
      }))

      abortRef.current = new AbortController()
      const signal = abortRef.current.signal

      atualizar({
        rodando: true,
        concluido: false,
        total: vendas.length,
        processados: 0,
        atualIndex: -1,
        linhas,
        forcar,
      })

      for (let i = 0; i < linhas.length; i++) {
        if (signal.aborted) break

        atualizar((prev) => ({ ...prev, atualIndex: i }))
        atualizarLinha(i, { status: 'processando' })

        const { numeroLancamento } = linhas[i]

        try {
          // 1. Cria/verifica job
          const sync = await sincronizarVenda(numeroLancamento, forcar)

          if (
            sync.status === 'ignorado_cache_valido' ||
            sync.status === 'concluido'
          ) {
            // Cache válido ou já concluído — não precisa processar
            atualizarLinha(i, { status: 'cache_valido' })
          } else if (sync.jobId && sync.status === 'pendente') {
            // 2. Dispara processamento
            await processarFila(sync.jobId)

            // 3. Aguarda conclusão via polling
            await aguardarConclusao(sync.jobId, signal)

            if (!signal.aborted) {
              atualizarLinha(i, { status: 'sincronizado' })
              onVendaProcessada?.()
            }
          } else {
            // Job já em andamento (status 'processando' ou 'pendente' duplicado)
            if (sync.jobId) {
              await aguardarConclusao(sync.jobId, signal)
            }
            atualizarLinha(i, { status: 'sincronizado' })
            onVendaProcessada?.()
          }
        } catch (err) {
          if (signal.aborted) break
          const msg = err instanceof Error ? err.message : String(err)
          atualizarLinha(i, { status: 'erro', erro: msg })
        }

        atualizar((prev) => ({ ...prev, processados: prev.processados + 1 }))
      }

      if (!signal.aborted) {
        atualizar({ rodando: false, concluido: true, atualIndex: -1 })
      }
    },
    [atualizar, atualizarLinha, onVendaProcessada]
  )

  const cancelar = useCallback(() => {
    abortRef.current?.abort()
    atualizar({ rodando: false, atualIndex: -1 })
  }, [atualizar])

  const resetar = useCallback(() => {
    abortRef.current?.abort()
    atualizar({
      rodando: false,
      concluido: false,
      total: 0,
      processados: 0,
      atualIndex: -1,
      linhas: [],
      forcar: false,
    })
  }, [atualizar])

  return { estado, iniciar, cancelar, resetar }
}
