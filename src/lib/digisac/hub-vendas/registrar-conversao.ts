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
  | {
      ok: true
      processed: true
      leadId: string
      loja: HubVendasLoja
      multipleStores: boolean
      resultadoSemantico: 'primeira_conversao' | 'loja_adicional'
    }
  | { ok: true; ignored: true; reason: string }
  | { ok: false; error: string }

type BuscaLeadCompativel =
  | { lead: HubVendasLeadConversaoRow; motivo: null }
  | { lead: null; motivo: 'lead_compativel_nao_encontrado' | 'fora_janela_conversao' }

type ErroTecnicoHubVendas = {
  erro: string
  resultado: {
    reason: 'erro_registro_conversao'
    operacao: string
    codigo: string | null
    mensagem: string | null
  }
  log: string
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? value as Record<string, unknown> : null
}

function sanitizarMensagemErro(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null
  return value
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '[email]')
    .replace(/\+?\d[\d\s().-]{7,}\d/g, '[numero]')
    .slice(0, 240)
}

function sanitizarCodigoErro(value: unknown): string | null {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_]+$/.test(value)) return null
  return value.slice(0, 40)
}

function normalizarErroTecnico(error: unknown, operacao: string): ErroTecnicoHubVendas {
  const record = asRecord(error)
  const codigo = sanitizarCodigoErro(record?.code) ?? sanitizarCodigoErro(record?.status) ?? null
  const mensagem = sanitizarMensagemErro(record?.message) ?? sanitizarMensagemErro(error instanceof Error ? error.message : null)
  const erro = codigo === '42702'
    ? 'postgres_42702_coluna_ambigua'
    : codigo
      ? `supabase_${codigo}`
      : `${operacao}_falhou`

  return {
    erro,
    resultado: {
      reason: 'erro_registro_conversao',
      operacao,
      codigo,
      mensagem,
    },
    log: `operacao=${operacao} codigo=${codigo ?? 'n/a'}`,
  }
}

async function buscarLeadCompativel(
  supabase: SupabaseServiceClient,
  variacoesDDI: string[],
  timestampEvento: Date
): Promise<BuscaLeadCompativel> {
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
  const eventoMs = timestampEvento.getTime()
  const leadDentroDaJanela = leads.find((lead) => {
    const entradaMs = new Date(lead.data_entrada_hub).getTime()
    return eventoMs >= entradaMs && eventoMs < entradaMs + HUB_VENDAS_JANELA_CONVERSAO_MS
  })

  if (leadDentroDaJanela) return { lead: leadDentroDaJanela, motivo: null }
  if (leads.length > 0) return { lead: null, motivo: 'fora_janela_conversao' }
  return { lead: null, motivo: 'lead_compativel_nao_encontrado' }
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

    const buscaLead = await buscarLeadCompativel(supabase, telefone.variacoesDDI, mensagem.timestampEvento)
    const lead = buscaLead.lead
    if (!lead) {
      await finalizarEventoHubVendas(
        supabase,
        reserva.eventoId,
        'ignorado',
        { reason: buscaLead.motivo }
      )
      return { ok: true, ignored: true, reason: buscaLead.motivo }
    }

    const { data: rpcData, error } = await supabase.rpc('hub_vendas_registrar_conversao', {
      p_lead_id: lead.id,
      p_loja: loja,
      p_timestamp_evento: mensagem.timestampEvento.toISOString(),
    })

    if (error) throw error

    const resultadoRpc = Array.isArray(rpcData) ? rpcData[0] : rpcData
    const resultadoSemantico = String(resultadoRpc?.resultado_semantico ?? resultadoRpc?.motivo ?? '')

    if (resultadoSemantico === 'loja_ja_registrada') {
      await finalizarEventoHubVendas(
        supabase,
        reserva.eventoId,
        'ignorado',
        {
          reason: 'loja_ja_registrada',
          loja,
          quantidadeLojas: resultadoRpc?.quantidade_lojas ?? null,
        },
        lead.id
      )
      console.log(`[HUB VENDAS] loja ja registrada leadId=${lead.id} loja=${loja} telefone=${telefone.mascaraLog}`)
      return { ok: true, ignored: true, reason: 'loja_ja_registrada' }
    }

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
        action: resultadoSemantico || 'conversao_registrada',
        loja,
        lojaJaExistia: Boolean(resultadoRpc.loja_ja_existia),
        quantidadeLojas: resultadoRpc.quantidade_lojas ?? null,
      },
      lead.id
    )

    if (resultadoSemantico === 'loja_adicional') {
      console.log(
        `[HUB VENDAS] loja adicional registrada leadId=${lead.id} loja=${loja} quantidadeLojas=${resultadoRpc.quantidade_lojas ?? 'n/a'} telefone=${telefone.mascaraLog}`
      )
    } else {
      console.log(`[HUB VENDAS] primeira conversao registrada leadId=${lead.id} loja=${loja} telefone=${telefone.mascaraLog}`)
    }

    return {
      ok: true,
      processed: true,
      leadId: lead.id,
      loja,
      multipleStores: Boolean(resultadoRpc.chamou_mais_de_uma_loja),
      resultadoSemantico: resultadoSemantico === 'loja_adicional' ? 'loja_adicional' : 'primeira_conversao',
    }
  } catch (error) {
    const erroTecnico = normalizarErroTecnico(error, 'rpc_hub_vendas_registrar_conversao')
    await finalizarEventoHubVendas(
      supabase,
      reserva.eventoId,
      'erro',
      erroTecnico.resultado,
      null,
      erroTecnico.erro
    )
    console.error(`[HUB VENDAS] Falha ao registrar conversao ${erroTecnico.log}`)
    return { ok: false, error: 'erro_registro_conversao' }
  }
}
