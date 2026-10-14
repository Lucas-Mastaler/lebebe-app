import { ErroLocalizacaoMaps, extrairLocalizacaoMaps, validarUrlGoogleMaps, type LocalizacaoMaps } from './localizacao-maps'

/** Somente redirecionamentos HTTP. Não executa JS, raspa HTML nem consulta serviços pagos. */
export async function resolverLinkMaps(entrada: string, fetchImpl: typeof fetch = fetch): Promise<LocalizacaoMaps> {
  const direto = extrairLocalizacaoMaps(entrada)
  if (direto) return direto
  let url = validarUrlGoogleMaps(entrada.trim())
  if (url.hostname !== 'maps.app.goo.gl') {
    throw new ErroLocalizacaoMaps('coordenadas-nao-identificadas', 'Esse link não informa um ponto exato. Abra o lugar no Google Maps e copie as coordenadas, ou peça outro link ao cliente.', 422)
  }
  const signal = AbortSignal.timeout(8000)
  const visitadas = new Set<string>()
  for (let etapa = 0; etapa < 6; etapa++) {
    validarUrlGoogleMaps(url.href)
    if (visitadas.has(url.href)) throw new ErroLocalizacaoMaps('redirecionamento-circular', 'O link possui redirecionamentos repetidos.')
    visitadas.add(url.href)
    let response: Response
    try { response = await fetchImpl(url.href, { redirect: 'manual', signal, cache: 'no-store' }) }
    catch { throw new ErroLocalizacaoMaps('falha-resolucao', 'Não foi possível resolver o link. Tente novamente ou copie as coordenadas diretamente.', 502) }
    await response.body?.cancel()
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location')
      if (!location) throw new ErroLocalizacaoMaps('falha-resolucao', 'O redirecionamento não informou o destino.', 502)
      const proxima = validarUrlGoogleMaps(new URL(location, url).href)
      const ponto = extrairLocalizacaoMaps(proxima.href)
      if (ponto) return ponto
      url = proxima
      continue
    }
    if (!response.ok) throw new ErroLocalizacaoMaps('falha-resolucao', 'O Google Maps não conseguiu abrir esse link. Confira o link ou copie as coordenadas.', 502)
    throw new ErroLocalizacaoMaps('coordenadas-nao-identificadas', 'Não conseguimos identificar esse lugar pelo link curto. Abra-o no Google Maps e copie as coordenadas do local, ou peça ao cliente um link de um único lugar.', 422)
  }
  throw new ErroLocalizacaoMaps('redirecionamentos-excedidos', 'O link excedeu o limite técnico de redirecionamentos. Copie as coordenadas diretamente.')
}
