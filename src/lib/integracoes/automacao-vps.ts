const TIMEOUT_MS = 10_000

export interface ResultadoDisparo {
  sucesso: boolean
  erro?: string
}

export async function dispararAutomacaoBaixaEncomendas(
  recebimentoId: string,
  finalizadoEm: string,
  usuarioEmail: string
): Promise<ResultadoDisparo> {
  const url = process.env.AUTOMACAO_VPS_URL
  const token = process.env.AUTOMACAO_VPS_TOKEN

  if (!url || !token) {
    console.warn('[LOG][VPS] ⚠️ AUTOMACAO_VPS_URL ou AUTOMACAO_VPS_TOKEN ausente. Gatilho não enviado.')
    return { sucesso: false, erro: 'ENV ausente' }
  }

  const payload = {
    evento: 'recebimento_finalizado',
    recebimentoId,
    finalizadoEm,
    usuarioEmail,
  }

  console.log(`[LOG][VPS] Iniciando envio do gatilho para recebimento ${recebimentoId}...`)

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })

    if (!response.ok) {
      const texto = await response.text().catch(() => '')
      console.error(`[LOG][VPS] ❌ Resposta com erro: status=${response.status} body=${texto}`)
      return { sucesso: false, erro: `HTTP ${response.status}` }
    }

    console.log(`[LOG][VPS] ✅ Gatilho enviado com sucesso para recebimento ${recebimentoId}`)
    return { sucesso: true }
  } catch (err) {
    const mensagem = err instanceof Error ? err.message : String(err)
    console.error(`[LOG][VPS] ❌ Erro ao enviar gatilho: ${mensagem}`)
    return { sucesso: false, erro: mensagem }
  } finally {
    clearTimeout(timeoutId)
  }
}
