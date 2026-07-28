import type { createServiceClient } from '@/lib/supabase/service'
import type { HubVendasMensagemValidada } from './payload'

type SupabaseServiceClient = ReturnType<typeof createServiceClient>

export type TipoProcessamentoHubVendas = 'entrada_hub' | 'conversao_loja'
export type StatusEventoHubVendas = 'processado' | 'ignorado' | 'erro'

export type ReservaEventoHubVendas =
  | { reservado: true; eventoId: string }
  | { reservado: false; motivo: 'evento_duplicado' }

export async function reservarEventoHubVendas(
  supabase: SupabaseServiceClient,
  mensagem: HubVendasMensagemValidada,
  tipoProcessamento: TipoProcessamentoHubVendas
): Promise<ReservaEventoHubVendas> {
  const { data, error } = await supabase
    .from('hub_vendas_eventos_processados')
    .insert({
      digisac_message_id: mensagem.messageId,
      event: mensagem.event,
      service_id: mensagem.serviceId,
      contact_id: mensagem.contactId,
      ticket_id: mensagem.ticketId,
      tipo_processamento: tipoProcessamento,
      timestamp_evento: mensagem.timestampEvento.toISOString(),
      status: 'processando',
      resultado: {},
    })
    .select('id')
    .single()

  if (error) {
    if (error.code === '23505') {
      return { reservado: false, motivo: 'evento_duplicado' }
    }
    throw error
  }

  return { reservado: true, eventoId: data.id as string }
}

export async function finalizarEventoHubVendas(
  supabase: SupabaseServiceClient,
  eventoId: string,
  status: StatusEventoHubVendas,
  resultado: Record<string, unknown>,
  leadId?: string | null,
  erro?: string | null
) {
  const { error } = await supabase
    .from('hub_vendas_eventos_processados')
    .update({
      status,
      resultado,
      lead_id: leadId ?? null,
      erro: erro ?? null,
      processado_em: new Date().toISOString(),
    })
    .eq('id', eventoId)

  if (error) throw error
}
