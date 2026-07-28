import { createServiceClient } from '@/lib/supabase/service'
import {
  HUB_VENDAS_SERVICE_ID,
  HUB_VENDAS_SERVICE_ID_PARA_LOJA,
  HUB_VENDAS_SERVICE_IDS_MONITORADOS,
} from './constants'
import { finalizarEventoHubVendas, reservarEventoHubVendas, type TipoProcessamentoHubVendas } from './eventos'
import { pareceSaudacaoHubVendas, validarMensagemDigisac } from './payload'
import { registrarConversaoHubVendas } from './registrar-conversao'
import { registrarEntradaHubVendas } from './registrar-entrada'

export type ResultadoWebhookHubVendas =
  | { ok: true; ignored: true; reason: string }
  | { ok: true; processed: true; kind: 'entrada_hub' | 'conversao_loja' }
  | { ok: false; error: string }

const TIPOS_ENTRADA_HUB_SUPORTADOS = new Set(['chat', 'interactive', 'button'])
const TIPOS_CONVERSAO_LOJA_SUPORTADOS = new Set(['chat'])

let envMismatchAvisado = false

function obterTipoMensagem(tipo: unknown): string {
  return typeof tipo === 'string' && tipo.trim() ? tipo.trim() : ''
}

function motivoFormatoInvalido(rawPayload: unknown): string {
  const payload = rawPayload && typeof rawPayload === 'object' ? rawPayload as Record<string, unknown> : null
  const data = payload?.data && typeof payload.data === 'object' ? payload.data as Record<string, unknown> : null

  if (payload?.event !== 'message.created') return 'evento_nao_suportado'
  if (!data?.id) return 'message_id_ausente'
  return 'service_id_nao_monitorado'
}

function logIgnorado(reason: string, contexto: Record<string, unknown>) {
  console.log(`[HUB VENDAS] Evento ignorado ${JSON.stringify({ reason, ...contexto })}`)
}

function validarServiceIdVendasEnv() {
  const serviceIdEnv = process.env.DIGISAC_SERVICE_ID_VENDAS
  if (!envMismatchAvisado && serviceIdEnv && serviceIdEnv !== HUB_VENDAS_SERVICE_ID) {
    envMismatchAvisado = true
    console.warn(
      `[HUB VENDAS] DIGISAC_SERVICE_ID_VENDAS difere da constante Hub/Vendas env=${serviceIdEnv} constante=${HUB_VENDAS_SERVICE_ID}`
    )
  }
}

function validarServiceRoleConfigurada(): ResultadoWebhookHubVendas | null {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('[HUB VENDAS] Supabase service client nao configurado para processamento server-side')
    return { ok: false, error: 'supabase_service_client_nao_configurado' }
  }

  return null
}

async function finalizarIgnorado(
  supabase: ReturnType<typeof createServiceClient>,
  eventoId: string,
  reason: string
) {
  await finalizarEventoHubVendas(supabase, eventoId, 'ignorado', { reason })
}

export async function processarWebhookHubVendas(rawPayload: unknown): Promise<ResultadoWebhookHubVendas> {
  console.log('[HUB VENDAS] Handler iniciado')
  validarServiceIdVendasEnv()

  const mensagem = validarMensagemDigisac(rawPayload)
  if (!mensagem) {
    const reason = motivoFormatoInvalido(rawPayload)
    logIgnorado(reason, {})
    return { ok: true, ignored: true, reason }
  }

  const contextoLog = {
    messageId: mensagem.messageId,
    serviceId: mensagem.serviceId,
    type: obterTipoMensagem(mensagem.data.type),
  }

  if (!HUB_VENDAS_SERVICE_IDS_MONITORADOS.has(mensagem.serviceId)) {
    logIgnorado('service_id_nao_monitorado', contextoLog)
    return { ok: true, ignored: true, reason: 'service_id_nao_monitorado' }
  }

  const erroConfig = validarServiceRoleConfigurada()
  if (erroConfig) return erroConfig

  const supabase = createServiceClient()
  const tipoProcessamento: TipoProcessamentoHubVendas =
    mensagem.serviceId === HUB_VENDAS_SERVICE_ID ? 'entrada_hub' : 'conversao_loja'
  const reserva = await reservarEventoHubVendas(supabase, mensagem, tipoProcessamento)
  if (!reserva.reservado) {
    logIgnorado(reserva.motivo, contextoLog)
    return { ok: true, ignored: true, reason: reserva.motivo }
  }

  const ignorarReservado = async (reason: string): Promise<ResultadoWebhookHubVendas> => {
    await finalizarIgnorado(supabase, reserva.eventoId, reason)
    logIgnorado(reason, contextoLog)
    return { ok: true, ignored: true, reason }
  }

  if (mensagem.serviceId === HUB_VENDAS_SERVICE_ID) {
    if (mensagem.data.isComment === true) return ignorarReservado('comentario')
    if (mensagem.data.visible === false || mensagem.data.isFromBot === true) return ignorarReservado('mensagem_invisivel')

    const tipo = obterTipoMensagem(mensagem.data.type)
    if (!TIPOS_ENTRADA_HUB_SUPORTADOS.has(tipo)) return ignorarReservado('tipo_nao_suportado')

    if (!mensagem.texto.trim()) return ignorarReservado('sem_texto_util')

    if (
      mensagem.data.isFromMe !== true ||
      mensagem.data.sent !== true ||
      mensagem.data.origin !== 'user' ||
      !pareceSaudacaoHubVendas(mensagem.texto)
    ) return ignorarReservado('nao_e_saudacao')

    const resultado = await registrarEntradaHubVendas(mensagem, supabase, { eventoId: reserva.eventoId })
    if (!resultado.ok) return resultado
    if ('ignored' in resultado) return resultado
    return { ok: true, processed: true, kind: 'entrada_hub' }
  }

  const loja = HUB_VENDAS_SERVICE_ID_PARA_LOJA.get(mensagem.serviceId)
  if (!loja) {
    return ignorarReservado('service_id_nao_monitorado')
  }

  if (mensagem.data.isComment === true) return ignorarReservado('comentario')
  if (mensagem.data.visible === false || mensagem.data.isFromBot === true) return ignorarReservado('mensagem_invisivel')

  const tipo = obterTipoMensagem(mensagem.data.type)
  if (!TIPOS_CONVERSAO_LOJA_SUPORTADOS.has(tipo)) return ignorarReservado('tipo_nao_suportado')

  if (!mensagem.texto.trim()) return ignorarReservado('sem_texto_util')

  if (mensagem.data.isFromMe !== false) return ignorarReservado('nao_e_conversao')

  const resultado = await registrarConversaoHubVendas(mensagem, loja, supabase, { eventoId: reserva.eventoId })
  if (!resultado.ok) return resultado
  if ('ignored' in resultado) return resultado
  return { ok: true, processed: true, kind: 'conversao_loja' }
}
