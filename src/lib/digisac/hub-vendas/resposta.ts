import { createServiceClient } from '@/lib/supabase/service'

type SupabaseServiceClient = ReturnType<typeof createServiceClient>

type FilaRecuperacaoResposta = {
  id: string
  lead_id: string
  conexao_destino_id: string
  digisac_ticket_id: string | null
  status: string
}

export async function registrarLogRespostaRecuperacaoHubVendas({
  supabase = createServiceClient(),
  ticketId,
  serviceId,
}: {
  supabase?: SupabaseServiceClient
  ticketId: string | null
  serviceId: string
}): Promise<{ encontrada: boolean; filaId?: string; leadId?: string }> {
  if (!ticketId) return { encontrada: false }

  const { data, error } = await supabase
    .from('hub_vendas_recuperacao_fila')
    .select('id, lead_id, conexao_destino_id, digisac_ticket_id, status')
    .eq('digisac_ticket_id', ticketId)
    .eq('status', 'enviado')
    .limit(1)

  if (error) throw error
  const fila = ((data ?? []) as FilaRecuperacaoResposta[])[0]
  if (!fila) return { encontrada: false }

  console.log(
    `[HUB VENDAS] resposta recebida em ticket de recuperacao filaId=${fila.id} leadId=${fila.lead_id} conexao=${serviceId} ticketCorrelacionado=true`
  )

  return { encontrada: true, filaId: fila.id, leadId: fila.lead_id }
}
