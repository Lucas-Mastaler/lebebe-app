import { pathToFileURL } from 'node:url'
import { createClient } from '@supabase/supabase-js'
import { executarBackfillProtocolos } from '../src/lib/digisac/hub-vendas/backfill-protocolos.ts'

async function executarPrincipal() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const digisacBaseUrl = process.env.DIGISAC_BASE_URL
  const digisacToken = process.env.DIGISAC_TOKEN
  if (!supabaseUrl || !serviceRoleKey || !digisacBaseUrl || !digisacToken) {
    throw new Error('Variaveis Supabase/Digisac obrigatorias nao configuradas')
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const resultado = await executarBackfillProtocolos({
    listarFilas: async () => {
      const { data, error } = await supabase
        .from('hub_vendas_recuperacao_fila')
        .select('id,digisac_ticket_id')
        .is('digisac_protocolo', null)
        .not('digisac_ticket_id', 'is', null)
        .order('created_at', { ascending: true })
      if (error) throw error
      return data ?? []
    },
    buscarTicket: async (ticketId) => {
      const response = await fetch(`${digisacBaseUrl.replace(/\/$/, '')}/tickets/${encodeURIComponent(ticketId)}`, {
        headers: { Authorization: `Bearer ${digisacToken}`, Accept: 'application/json' },
        signal: AbortSignal.timeout(30_000),
      })
      if (!response.ok) throw new Error(`digisac_http_${response.status}`)
      return response.json()
    },
    salvarProtocolo: async (filaId, ticketId, protocolo) => {
      const { data, error } = await supabase
        .from('hub_vendas_recuperacao_fila')
        .update({ digisac_protocolo: protocolo })
        .eq('id', filaId)
        .eq('digisac_ticket_id', ticketId)
        .is('digisac_protocolo', null)
        .select('id')
      if (error) throw error
      if (!data?.length) throw new Error('fila_nao_atualizada')
    },
  })

  if (resultado.falhas.length > 0) {
    console.log('[LOG] [BACKFILL PROTOCOLO] Pendencias:')
    for (const falha of resultado.falhas) {
      console.log(`[LOG] filaId=${falha.filaId} ticketId=${falha.ticketId} motivo=${falha.motivo}`)
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  executarPrincipal().catch((error) => {
    const mensagem = error instanceof Error ? error.message : String(error)
    console.error(`[LOG] [BACKFILL PROTOCOLO] ERRO: ${mensagem.slice(0, 300)}`)
    process.exitCode = 1
  })
}
