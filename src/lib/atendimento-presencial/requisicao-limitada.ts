// Um prazo finito permite informar erro e repetir a mesma operação idempotente.
// Abortar o cliente não implica rollback no servidor: preservar draftClientId/version.
export async function requisicaoLimitada(url: string, init: RequestInit = {}, prazoMs = 20000, mensagemPrazo = 'O servidor demorou para responder. Seu preenchimento foi preservado; tente salvar novamente.') {
  const controller = new AbortController()
  const cancelar = () => controller.abort()
  if (init.signal?.aborted) cancelar()
  else init.signal?.addEventListener('abort', cancelar, { once: true })
  let prazoEsgotado = false
  const timer = setTimeout(() => { prazoEsgotado = true; controller.abort() }, prazoMs)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } catch (error) {
    if (prazoEsgotado) throw new Error(mensagemPrazo)
    throw error
  } finally { clearTimeout(timer); init.signal?.removeEventListener('abort', cancelar) }
}

// Erros nativos do navegador não são instruções úteis para a consultora.
export function mensagemErroRequisicao(error: unknown, alternativa: string) {
  if (!(error instanceof Error)) return alternativa
  if (['TypeError', 'SyntaxError', 'AbortError', 'TimeoutError'].includes(error.name)) return alternativa
  return error.message || alternativa
}
