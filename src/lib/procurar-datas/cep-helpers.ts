export type BuscarCepResultado = {
  cep: string
  logradouro: string
  bairro: string
  cidade: string
  uf: string
  provider: 'viacep' | 'brasilapi'
}

export type BuscarCepSucesso = {
  ok: true
  resultado: BuscarCepResultado
}

export type BuscarCepErro = {
  ok: false
  error: string
}

export type BuscarCepResponse = BuscarCepSucesso | BuscarCepErro

/**
 * Normaliza CEP: remove não-dígitos e formata como 00000-000.
 * Retorna null se o resultado não tiver 8 dígitos.
 */
export function normalizarCep(valor: string): string | null {
  const digitos = String(valor ?? '').replace(/\D/g, '')
  if (digitos.length !== 8) return null
  return `${digitos.slice(0, 5)}-${digitos.slice(5)}`
}

/**
 * Extrai 8 dígitos de um CEP já normalizado ou bruto.
 * Retorna null se não tiver exatamente 8 dígitos.
 */
export function extrairDigitosCep(valor: string): string | null {
  const digitos = String(valor ?? '').replace(/\D/g, '')
  return digitos.length === 8 ? digitos : null
}

type ViaCepResponse = {
  erro?: true | string
  cep?: string
  logradouro?: string
  bairro?: string
  localidade?: string
  uf?: string
}

type BrasilApiCepResponse = {
  cep?: string
  street?: string
  neighborhood?: string
  city?: string
  state?: string
  message?: string
}

/**
 * Consulta ViaCEP para dados textuais do CEP.
 * Retorna BuscarCepResultado ou null se não encontrado ou erro.
 */
export async function consultarViaCep(cep8: string): Promise<BuscarCepResultado | null> {
  try {
    const url = `https://viacep.com.br/ws/${cep8}/json/`
    const resp = await fetch(url, {
      headers: { 'User-Agent': 'LeBebe-App/1.0' },
      signal: AbortSignal.timeout(5000),
    })
    if (!resp.ok) return null
    const json = (await resp.json()) as ViaCepResponse
    if (!json || json.erro) return null
    const uf = String(json.uf ?? '').toUpperCase()
    if (!json.localidade || !uf) return null
    const cepFormatado = normalizarCep(cep8)
    if (!cepFormatado) return null
    return {
      cep: cepFormatado,
      logradouro: String(json.logradouro ?? '').trim(),
      bairro: String(json.bairro ?? '').trim(),
      cidade: String(json.localidade ?? '').trim(),
      uf,
      provider: 'viacep',
    }
  } catch {
    return null
  }
}

/**
 * Consulta BrasilAPI como fallback para dados textuais do CEP.
 * Retorna BuscarCepResultado ou null se não encontrado ou erro.
 */
export async function consultarBrasilApi(cep8: string): Promise<BuscarCepResultado | null> {
  try {
    const url = `https://brasilapi.com.br/api/cep/v2/${cep8}`
    const resp = await fetch(url, {
      headers: { 'User-Agent': 'LeBebe-App/1.0' },
      signal: AbortSignal.timeout(5000),
    })
    if (!resp.ok) return null
    const json = (await resp.json()) as BrasilApiCepResponse
    if (!json || json.message) return null
    const uf = String(json.state ?? '').toUpperCase()
    if (!json.city || !uf) return null
    const cepFormatado = normalizarCep(cep8)
    if (!cepFormatado) return null
    return {
      cep: cepFormatado,
      logradouro: String(json.street ?? '').trim(),
      bairro: String(json.neighborhood ?? '').trim(),
      cidade: String(json.city ?? '').trim(),
      uf,
      provider: 'brasilapi',
    }
  } catch {
    return null
  }
}

/**
 * Busca dados textuais de um CEP usando ViaCEP como primário e BrasilAPI como fallback.
 * Não retorna coordenadas. Não salva no cache. Não chama LocationIQ nem Apps Script.
 */
export async function buscarCep(cepInput: string): Promise<BuscarCepResponse> {
  const cep8 = extrairDigitosCep(cepInput)
  if (!cep8) {
    return { ok: false, error: 'CEP invalido. Informe 8 digitos numericos.' }
  }

  const viacep = await consultarViaCep(cep8)
  if (viacep) return { ok: true, resultado: viacep }

  const brasilapi = await consultarBrasilApi(cep8)
  if (brasilapi) return { ok: true, resultado: brasilapi }

  return { ok: false, error: 'CEP nao encontrado.' }
}
