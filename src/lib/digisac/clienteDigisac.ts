
const BASE_URL = process.env.DIGISAC_BASE_URL;
const TOKEN = process.env.DIGISAC_TOKEN;

export async function fetchDigisac(endpoint: string, options: RequestInit = {}) {
  if (!BASE_URL || !TOKEN) {
    throw new Error('DIGISAC_BASE_URL ou DIGISAC_TOKEN não configurados');
  }

  // Sanitiza endpoint para não duplicar barras ou base
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const url = `${BASE_URL}${cleanEndpoint}`;

  const headers = {
    'Authorization': `Bearer ${TOKEN}`,
    'Accept': 'application/json',
    ...options.headers,
  };

  const finalUrl = new URL(url); // Apenas para log, validando formato

  // Log de debug sem expor token
  console.log(`[DIGISAC] Request: ${options.method || 'GET'} ${finalUrl.pathname}${finalUrl.search}`);

  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 30000); // 30s timeout

    const res = await fetch(url, {
      ...options,
      headers,
      signal: controller.signal,
    });

    clearTimeout(id);

    if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
            console.error(`[DIGISAC] Erro de Autenticação: ${res.status}`);
            throw new Error(`Erro de autenticação Digisac (${res.status})`);
        }
        if (res.status === 429) {
            console.error(`[DIGISAC] Rate Limit Excedido`);
            throw new Error('Digisac Rate Limit');
        }
        const bodyTxt = await res.text().catch(() => 'sem corpo');
        console.error(`[DIGISAC] Erro ${res.status}: ${bodyTxt.substring(0, 200)}`);
        throw new Error(`Erro API Digisac: ${res.status}`);
    }

    return await res.json();
  } catch (error: any) {
    if (error.name === 'AbortError') {
        throw new Error('Digisac Request Timeout (30s)');
    }
    console.error('[DIGISAC] Falha de conexão/fetch:', error.message);
    throw error;
  }
}
