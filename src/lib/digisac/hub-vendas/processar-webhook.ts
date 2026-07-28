import {
  HUB_VENDAS_SERVICE_ID,
  HUB_VENDAS_SERVICE_ID_PARA_LOJA,
  HUB_VENDAS_SERVICE_IDS_MONITORADOS,
} from './constants'
import { pareceSaudacaoHubVendas, validarMensagemDigisac } from './payload'
import { registrarConversaoHubVendas } from './registrar-conversao'
import { registrarEntradaHubVendas } from './registrar-entrada'

export type ResultadoWebhookHubVendas =
  | { ok: true; ignored: true; reason: string }
  | { ok: true; processed: true; kind: 'entrada_hub' | 'conversao_loja' }
  | { ok: false; error: string }

export async function processarWebhookHubVendas(rawPayload: unknown): Promise<ResultadoWebhookHubVendas> {
  const mensagem = validarMensagemDigisac(rawPayload)
  if (!mensagem) {
    return { ok: true, ignored: true, reason: 'evento_fora_do_formato_monitorado' }
  }

  if (!HUB_VENDAS_SERVICE_IDS_MONITORADOS.has(mensagem.serviceId)) {
    return { ok: true, ignored: true, reason: 'conexao_nao_monitorada' }
  }

  if (mensagem.serviceId === HUB_VENDAS_SERVICE_ID) {
    if (
      mensagem.data.isFromMe !== true ||
      mensagem.data.sent !== true ||
      mensagem.data.origin !== 'user' ||
      mensagem.data.isFromBot === true ||
      !mensagem.texto.trim() ||
      !pareceSaudacaoHubVendas(mensagem.texto)
    ) {
      return { ok: true, ignored: true, reason: 'nao_e_saudacao_hub' }
    }

    const resultado = await registrarEntradaHubVendas(mensagem)
    if (!resultado.ok) return resultado
    if ('ignored' in resultado) return resultado
    return { ok: true, processed: true, kind: 'entrada_hub' }
  }

  const loja = HUB_VENDAS_SERVICE_ID_PARA_LOJA.get(mensagem.serviceId)
  if (!loja) {
    return { ok: true, ignored: true, reason: 'loja_desconhecida' }
  }

  if (mensagem.data.isFromMe !== false || mensagem.data.isFromBot === true) {
    return { ok: true, ignored: true, reason: 'nao_e_mensagem_cliente_loja' }
  }

  const resultado = await registrarConversaoHubVendas(mensagem, loja)
  if (!resultado.ok) return resultado
  if ('ignored' in resultado) return resultado
  return { ok: true, processed: true, kind: 'conversao_loja' }
}
