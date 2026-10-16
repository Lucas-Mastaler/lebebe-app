// Um prazo finito permite informar erro e repetir a mesma operação idempotente.
// Abortar o cliente não implica rollback no servidor: preservar draftClientId/version.
export async function requisicaoLimitada(url: string, init: RequestInit = {}, prazoMs = 20000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), prazoMs)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } catch (error) {
    if (controller.signal.aborted) throw new Error('O servidor demorou para responder. Seu preenchimento foi preservado; tente salvar novamente.')
    throw error
  } finally { clearTimeout(timer) }
}
