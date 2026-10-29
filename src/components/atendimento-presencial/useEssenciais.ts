'use client'
import { useEffect, useState } from 'react'
import type { EstadoEssenciais } from '@/lib/atendimento-presencial/essenciais'
import { requisicaoLimitada } from '@/lib/atendimento-presencial/requisicao-limitada'

export function useEssenciais(clienteId: string | null, rascunhoId: string | undefined, habilitado: boolean, clientePersistido: boolean) {
  const chave = habilitado && clienteId && rascunhoId ? `${clienteId}/${rascunhoId}` : ''
  const [estado, setEstado] = useState<{ chave: string; respostas: EstadoEssenciais; erro: string | null }>({ chave: '', respostas: {}, erro: null })
  const [tentativa, setTentativa] = useState(0)
  useEffect(() => {
    // A autorização da RPC exige o vínculo já confirmado pelo autosave.
    if (!chave || !clientePersistido) return
    const abort = new AbortController()
    requisicaoLimitada(`/api/atendimento-presencial/clientes/${clienteId}/essenciais?rascunhoId=${rascunhoId}`, { signal: abort.signal })
      .then(async response => {
        const data = await response.json()
        if (!response.ok || !data.ok) throw new Error(data.message ?? 'Não foi possível carregar os produtos essenciais.')
        if (!abort.signal.aborted) setEstado({ chave, respostas: data.respostas, erro: null })
      })
      .catch(error => { if (!abort.signal.aborted) setEstado({ chave, respostas: {}, erro: error instanceof Error ? error.message : 'Falha ao consultar essenciais.' }) })
    return () => abort.abort()
  }, [chave, clienteId, rascunhoId, clientePersistido, tentativa])
  return {
    anteriores: chave && estado.chave === chave ? estado.respostas : {},
    carregando: Boolean(chave && (!clientePersistido || estado.chave !== chave)),
    erro: chave && estado.chave === chave ? estado.erro : null,
    tentar: () => { setEstado({ chave: '', respostas: {}, erro: null }); setTentativa(t => t + 1) },
  }
}
