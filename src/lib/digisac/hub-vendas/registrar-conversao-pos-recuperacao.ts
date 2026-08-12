import { createServiceClient } from '@/lib/supabase/service'
import { buscarContatoCompleto } from '@/lib/digisac/contatos'
import type { HubVendasLoja } from './constants'
import { finalizarEventoHubVendas } from './eventos'
import type { HubVendasMensagemValidada } from './payload'
import { extrairTelefoneContatoHubVendas } from './telefone'

type SupabaseServiceClient = ReturnType<typeof createServiceClient>
type ConversaoPosRecuperacaoReservada = {
  eventoId: string
}

export type ResultadoConversaoPosRecuperacaoHubVendas =
  | { ok: true; processed: true; leadId: string; loja: HubVendasLoja }
  | { ok: true; ignored: true; reason: string }
  | { ok: false; error: string }

type HubVendasLeadRecuperacaoRow = {
  id: string
  data_recuperacao_enviada: string
}

/** Janela pos-recuperacao: 24h a partir de data_recuperacao_enviada, independente da janela organica. */
const JANELA_POS_RECUPERACAO_MS = 24 * 60 * 60 * 1000

type BuscaLeadRecuperacaoCompativel =
  | { lead: HubVendasLeadRecuperacaoRow; motivo: null }
  | { lead: null; motivo: 'lead_recuperacao_nao_encontrado' | 'fora_janela_pos_recuperacao' }

async function buscarLeadRecuperacaoCompativel(
  supabase: SupabaseServiceClient,
  variacoesDDI: string[],
  timestampEvento: Date
): Promise<BuscaLeadRecuperacaoCompativel> {
  const { data, error } = await supabase
    .from('hub_vendas_leads')
    .select('id, data_recuperacao_enviada')
    .in('telefone_normalizado_ddi', variacoesDDI)
    .eq('status', 'recuperacao_enviada')
    .not('data_recuperacao_enviada', 'is', null)
    .order('data_recuperacao_enviada', { ascending: false })
    .limit(5)

  if (error) throw error

  const leads = (data ?? []) as HubVendasLeadRecuperacaoRow[]
  const eventoMs = timestampEvento.getTime()
  const leadDentroDaJanela = leads.find((lead) => {
    const inicioMs = new Date(lead.data_recuperacao_enviada).getTime()
    return eventoMs >= inicioMs && eventoMs < inicioMs + JANELA_POS_RECUPERACAO_MS
  })

  if (leadDentroDaJanela) return { lead: leadDentroDaJanela, motivo: null }
  if (leads.length > 0) return { lead: null, motivo: 'fora_janela_pos_recuperacao' }
  return { lead: null, motivo: 'lead_recuperacao_nao_encontrado' }
}

/**
 * Registra a conversao de um lead que respondeu apos a mensagem de recuperacao ter sido
 * enviada (status 'recuperacao_enviada'), dentro da janela independente de 24h contada a
 * partir de data_recuperacao_enviada. Caminho separado da conversao organica: nao reutiliza
 * a janela nem o matching de registrar-conversao.ts, apenas a mesma checagem de remetente
 * (isFromMe === false) ja aplicada pelo chamador antes de invocar esta funcao.
 */
export async function registrarConversaoPosRecuperacaoHubVendas(
  mensagem: HubVendasMensagemValidada,
  loja: HubVendasLoja,
  supabase: SupabaseServiceClient,
  conversaoReservada: ConversaoPosRecuperacaoReservada
): Promise<ResultadoConversaoPosRecuperacaoHubVendas> {
  const eventoId = conversaoReservada.eventoId

  try {
    if (!mensagem.contactId) {
      await finalizarEventoHubVendas(supabase, eventoId, 'erro', { reason: 'contact_id_ausente' })
      return { ok: false, error: 'contact_id_ausente' }
    }

    const contato = await buscarContatoCompleto(mensagem.contactId)
    const telefone = extrairTelefoneContatoHubVendas(contato)

    if (!telefone) {
      await finalizarEventoHubVendas(supabase, eventoId, 'erro', { reason: 'telefone_invalido' })
      return { ok: false, error: 'telefone_invalido' }
    }

    const busca = await buscarLeadRecuperacaoCompativel(supabase, telefone.variacoesDDI, mensagem.timestampEvento)
    if (!busca.lead) {
      await finalizarEventoHubVendas(supabase, eventoId, 'ignorado', { reason: busca.motivo })
      console.log(
        `[HUB VENDAS] resposta pos-recuperacao sem lead compativel motivo=${busca.motivo} telefone=${telefone.mascaraLog}`
      )
      return { ok: true, ignored: true, reason: busca.motivo }
    }

    const { data: rpcData, error } = await supabase.rpc('hub_vendas_registrar_conversao_pos_recuperacao', {
      p_lead_id: busca.lead.id,
      p_timestamp_evento: mensagem.timestampEvento.toISOString(),
    })

    if (error) throw error

    const resultadoRpc = Array.isArray(rpcData) ? rpcData[0] : rpcData

    if (!resultadoRpc?.atualizado) {
      const motivo = resultadoRpc?.motivo ?? 'conversao_pos_recuperacao_nao_aplicada'
      await finalizarEventoHubVendas(supabase, eventoId, 'ignorado', { reason: motivo }, busca.lead.id)
      console.log(
        `[HUB VENDAS] resposta pos-recuperacao nao aplicada leadId=${busca.lead.id} motivo=${motivo} telefone=${telefone.mascaraLog}`
      )
      return { ok: true, ignored: true, reason: motivo }
    }

    await finalizarEventoHubVendas(supabase, eventoId, 'processado', { action: 'recuperado', loja }, busca.lead.id)
    console.log(`[HUB VENDAS] convertido apos recuperacao leadId=${busca.lead.id} loja=${loja} telefone=${telefone.mascaraLog}`)

    return { ok: true, processed: true, leadId: busca.lead.id, loja }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'erro_desconhecido'
    await finalizarEventoHubVendas(
      supabase,
      eventoId,
      'erro',
      { reason: 'erro_registro_conversao_pos_recuperacao' },
      null,
      message
    )
    console.error(`[HUB VENDAS] falha ao registrar conversao pos-recuperacao erro=${message}`)
    return { ok: false, error: 'erro_registro_conversao_pos_recuperacao' }
  }
}
