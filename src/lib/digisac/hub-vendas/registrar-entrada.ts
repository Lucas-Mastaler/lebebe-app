import { createServiceClient } from '@/lib/supabase/service'
import { buscarContatoCompleto } from '@/lib/digisac/contatos'
import { HUB_VENDAS_CICLO_MS } from './constants'
import { finalizarEventoHubVendas, reservarEventoHubVendas } from './eventos'
import type { HubVendasMensagemValidada } from './payload'
import { extrairNomeContatoDigisac, extrairTelefoneContatoHubVendas } from './telefone'

type SupabaseServiceClient = ReturnType<typeof createServiceClient>
type EntradaReservadaHubVendas = {
  eventoId: string
}

type HubVendasLeadRow = {
  id: string
  ciclo_numero: number
  data_entrada_hub: string
}

export type ResultadoEntradaHubVendas =
  | { ok: true; processed: true; leadId: string; cicloNumero: number; repeated: boolean }
  | { ok: true; ignored: true; reason: string }
  | { ok: false; error: string }

async function buscarLeadMaisRecentePorTelefone(
  supabase: SupabaseServiceClient,
  variacoesDDI: string[]
): Promise<HubVendasLeadRow | null> {
  const { data, error } = await supabase
    .from('hub_vendas_leads')
    .select('id, ciclo_numero, data_entrada_hub')
    .in('telefone_normalizado_ddi', variacoesDDI)
    .order('ciclo_numero', { ascending: false })
    .order('data_entrada_hub', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  return (data as HubVendasLeadRow | null) ?? null
}

export async function registrarEntradaHubVendas(
  mensagem: HubVendasMensagemValidada,
  supabase = createServiceClient(),
  entradaReservada?: EntradaReservadaHubVendas
): Promise<ResultadoEntradaHubVendas> {
  const reserva = entradaReservada
    ? { reservado: true as const, eventoId: entradaReservada.eventoId }
    : await reservarEventoHubVendas(supabase, mensagem, 'entrada_hub')
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

    const leadAnterior = await buscarLeadMaisRecentePorTelefone(supabase, telefone.variacoesDDI)
    if (leadAnterior) {
      const entradaAnteriorMs = new Date(leadAnterior.data_entrada_hub).getTime()
      const novaEntradaMs = mensagem.timestampEvento.getTime()

      if (novaEntradaMs < entradaAnteriorMs + HUB_VENDAS_CICLO_MS) {
        await finalizarEventoHubVendas(
          supabase,
          reserva.eventoId,
          'ignorado',
          { reason: 'saudacao_repetida_mesmo_ciclo', cicloNumero: leadAnterior.ciclo_numero },
          leadAnterior.id
        )
        console.log(`[HUB VENDAS] saudacao repetida no mesmo ciclo leadId=${leadAnterior.id} telefone=${telefone.mascaraLog}`)
        return {
          ok: true,
          processed: true,
          leadId: leadAnterior.id,
          cicloNumero: leadAnterior.ciclo_numero,
          repeated: true,
        }
      }
    }

    const cicloNumero = (leadAnterior?.ciclo_numero ?? 0) + 1
    const nomeContato = extrairNomeContatoDigisac(contato)

    const { data: leadCriado, error } = await supabase
      .from('hub_vendas_leads')
      .insert({
        telefone_normalizado_ddi: telefone.telefoneNormalizadoDDI,
        telefone_normalizado: telefone.telefoneNormalizado,
        ciclo_numero: cicloNumero,
        data_entrada_hub: mensagem.timestampEvento.toISOString(),
        digisac_message_id_saudacao: mensagem.messageId,
        digisac_contact_id_hub: mensagem.contactId,
        digisac_ticket_id_hub: mensagem.ticketId,
        nome_contato_hub: nomeContato,
        status: 'aguardando_conversao',
      })
      .select('id, ciclo_numero')
      .single()

    if (error) throw error

    await finalizarEventoHubVendas(
      supabase,
      reserva.eventoId,
      'processado',
      { action: 'lead_criado', cicloNumero },
      leadCriado.id as string
    )

    console.log(`[HUB VENDAS] entrada registrada leadId=${leadCriado.id} ciclo=${cicloNumero} telefone=${telefone.mascaraLog}`)
    return {
      ok: true,
      processed: true,
      leadId: leadCriado.id as string,
      cicloNumero,
      repeated: false,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'erro_desconhecido'
    await finalizarEventoHubVendas(supabase, reserva.eventoId, 'erro', { reason: 'erro_registro_entrada' }, null, message)
    console.error(`[HUB VENDAS] erro ao registrar entrada erro=${message}`)
    return { ok: false, error: 'erro_registro_entrada' }
  }
}
