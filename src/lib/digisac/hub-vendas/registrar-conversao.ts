import { createServiceClient } from '@/lib/supabase/service'
import { buscarContatoCompleto } from '@/lib/digisac/contatos'
import { HUB_VENDAS_JANELA_CONVERSAO_MS, type HubVendasLoja } from './constants'
import { finalizarEventoHubVendas, reservarEventoHubVendas } from './eventos'
import type { HubVendasMensagemValidada } from './payload'
import { extrairTelefoneContatoHubVendas } from './telefone'

type SupabaseServiceClient = ReturnType<typeof createServiceClient>
type ConversaoReservadaHubVendas = {
  eventoId: string
}

type HubVendasLeadConversaoRow = {
  id: string
  data_entrada_hub: string
  ciclo_numero: number
  status: string
}

export type ResultadoConversaoHubVendas =
  | { ok: true; processed: true; leadId: string; loja: HubVendasLoja; multipleStores: boolean }
  | { ok: true; ignored: true; reason: string }
  | { ok: false; error: string }

async function buscarLeadCompativel(
  supabase: SupabaseServiceClient,
  variacoesDDI: string[],
  timestampEvento: Date
): Promise<HubVendasLeadConversaoRow | null> {
  const { data, error } = await supabase
    .from('hub_vendas_leads')
    .select('id, data_entrada_hub, ciclo_numero, status')
    .in('telefone_normalizado_ddi', variacoesDDI)
    .lte('data_entrada_hub', timestampEvento.toISOString())
    .in('status', ['aguardando_conversao', 'convertido_organicamente'])
    .order('data_entrada_hub', { ascending: false })
    .limit(5)

  if (error) throw error

  const leads = (data ?? []) as HubVendasLeadConversaoRow[]
  return (
    leads.find((lead) => {
      const entradaMs = new Date(lead.data_entrada_hub).getTime()
      const eventoMs = timestampEvento.getTime()
      return eventoMs >= entradaMs && eventoMs < entradaMs + HUB_VENDAS_JANELA_CONVERSAO_MS
    }) ?? null
  )
}

export async function registrarConversaoHubVendas(
  mensagem: HubVendasMensagemValidada,
  loja: HubVendasLoja,
  supabase = createServiceClient(),
  conversaoReservada?: ConversaoReservadaHubVendas
): Promise<ResultadoConversaoHubVendas> {
  const reserva = conversaoReservada
    ? { reservado: true as const, eventoId: conversaoReservada.eventoId }
    : await reservarEventoHubVendas(supabase, mensagem, 'conversao_loja')
  if (!reserva.reservado) return { ok: true, ignored: true, reason: reserva.motivo }

  try {
    if (!mensagem.contactId) {
      await finalizarEventoHubVendas(supabase, reserva.eventoId, 'erro', { reason: 'contact_id_ausente' })
      return { ok: false, error: 'contact_id_ausente' }
    }

    const contato = await buscarContatoCompleto(mensagem.contactId)
    const telefone = extrairTelefoneContatoHubVendas(contato)

    if (!telefone) {
      await finalizarEventoHubVendas(supabase, reserva.eventoId, 'erro', { reason: 'telefone_invalido' })
      return { ok: false, error: 'telefone_invalido' }
    }

    const lead = await buscarLeadCompativel(supabase, telefone.variacoesDDI, mensagem.timestampEvento)
    if (!lead) {
      await finalizarEventoHubVendas(
        supabase,
        reserva.eventoId,
        'ignorado',
        { reason: 'sem_lead_compativel_na_janela' }
      )
      return { ok: true, ignored: true, reason: 'sem_lead_compativel_na_janela' }
    }

    const { data: rpcData, error } = await supabase.rpc('hub_vendas_registrar_conversao', {
      p_lead_id: lead.id,
      p_loja: loja,
      p_timestamp_evento: mensagem.timestampEvento.toISOString(),
    })

    if (error) throw error

    const resultadoRpc = Array.isArray(rpcData) ? rpcData[0] : rpcData
    if (!resultadoRpc?.atualizado) {
      await finalizarEventoHubVendas(
        supabase,
        reserva.eventoId,
        'ignorado',
        { reason: resultadoRpc?.motivo ?? 'conversao_nao_aplicada' },
        lead.id
      )
      return { ok: true, ignored: true, reason: resultadoRpc?.motivo ?? 'conversao_nao_aplicada' }
    }

    await finalizarEventoHubVendas(
      supabase,
      reserva.eventoId,
      'processado',
      {
        action: 'conversao_registrada',
        loja,
        lojaJaExistia: Boolean(resultadoRpc.loja_ja_existia),
      },
      lead.id
    )

    console.log(`[HUB VENDAS] conversao registrada leadId=${lead.id} loja=${loja} telefone=${telefone.mascaraLog}`)
    return {
      ok: true,
      processed: true,
      leadId: lead.id,
      loja,
      multipleStores: Boolean(resultadoRpc.chamou_mais_de_uma_loja),
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'erro_desconhecido'
    await finalizarEventoHubVendas(supabase, reserva.eventoId, 'erro', { reason: 'erro_registro_conversao' }, null, message)
    console.error(`[HUB VENDAS] erro ao registrar conversao erro=${message}`)
    return { ok: false, error: 'erro_registro_conversao' }
  }
}
