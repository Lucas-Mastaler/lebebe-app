/**
 * Observação (somente log) de eventos de conexão ("service") do Digisac.
 * Não altera nenhum fluxo: serve para descobrir o formato real dos eventos.
 */

const CHAVES_SENSIVEIS = /qr|token|secret|senha|password|authorization|key|session|cookie/i;
const MAX_PROFUNDIDADE = 4;
const MAX_TEXTO = 120;

function sanitizar(valor: unknown, profundidade = 0): unknown {
  if (valor === null || typeof valor === 'number' || typeof valor === 'boolean') return valor;
  if (typeof valor === 'string') {
    const semNumeros = valor.replace(/\d{8,}/g, (m) => `${m.slice(0, 2)}***${m.slice(-2)}`);
    return semNumeros.length > MAX_TEXTO ? `${semNumeros.slice(0, MAX_TEXTO)}...(${valor.length})` : semNumeros;
  }
  if (profundidade >= MAX_PROFUNDIDADE) return '[profundo]';
  if (Array.isArray(valor)) return valor.slice(0, 5).map((v) => sanitizar(v, profundidade + 1));
  if (typeof valor === 'object') {
    const saida: Record<string, unknown> = {};
    for (const [chave, v] of Object.entries(valor as Record<string, unknown>)) {
      saida[chave] = CHAVES_SENSIVEIS.test(chave) ? '[omitido]' : sanitizar(v, profundidade + 1);
    }
    return saida;
  }
  return String(valor);
}

export function ehEventoService(payload: unknown): boolean {
  const evento = (payload as { event?: unknown } | null)?.event;
  return typeof evento === 'string' && evento.toLowerCase().startsWith('service');
}

/** Loga eventos de service (payload sanitizado) e só o nome dos demais eventos que não são mensagem. */
export function registrarEventoDigisacNaoMensagem(origem: string, payload: unknown): void {
  try {
    const evento = (payload as { event?: unknown } | null)?.event;
    if (typeof evento !== 'string' || evento === 'message.created') return;
    if (ehEventoService(payload)) {
      const texto = JSON.stringify(sanitizar((payload as { data?: unknown }).data)).slice(0, 3000);
      console.log(`[digisac-service-evento] origem=${origem} evento=${evento} data=${texto}`);
    } else {
      console.log(`[digisac-service-evento] origem=${origem} evento_ignorado=${evento}`);
    }
  } catch {
    // Observação nunca pode afetar o webhook.
  }
}
