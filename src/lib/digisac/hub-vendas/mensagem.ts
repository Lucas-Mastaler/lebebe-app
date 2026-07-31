import { HUB_VENDAS_LOJAS, HUB_VENDAS_SERVICE_ID_PARA_LOJA, type HubVendasLoja } from './constants'

const NOMES_INVALIDOS = new Set([
  'cliente',
  'contato',
  'sem nome',
  'nao informado',
  'não informado',
  'desconhecido',
  'unknown',
  'undefined',
  'null',
])

export type ResultadoNomeHubVendas = {
  nomeCompleto: string | null
  primeiroNome: string | null
  origemNome: OrigemNomeHubVendas
  fallbackNome: boolean
  nomeBrutoSanitizado: string | null
  campoOrigem?: string | null
}

export type OrigemNomeHubVendas =
  | 'lead_persistido'
  | 'contato_hub'
  | 'perfil_whatsapp'
  | 'contato_destino_existente'
  | 'contato_destino_criado'
  | 'lead_origem'
  | 'contato_existente'
  | 'contato_criado'
  | 'indisponivel'

export type FonteNomeHubVendas = {
  nomeBruto: string | null | undefined
  origem: OrigemNomeHubVendas
  campo?: string | null
}

export type ValidacaoTextoFinalHubVendas = {
  ok: boolean
  placeholdersPendentes: string[]
}

function removerAcentos(valor: string): string {
  return valor.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

function normalizarEspacos(valor: string): string {
  return valor.replace(/\s+/g, ' ').trim()
}

function normalizarComparacao(valor: string): string {
  return removerAcentos(normalizarEspacos(valor)).toLowerCase()
}

function pareceTelefoneOuDocumento(valor: string, telefoneNormalizadoDDI?: string | null): boolean {
  const digits = valor.replace(/\D/g, '')
  if (!digits) return false
  const telefoneDigits = String(telefoneNormalizadoDDI ?? '').replace(/\D/g, '')
  if (telefoneDigits && digits === telefoneDigits) return true
  if (digits.length >= 10 && digits.length <= 13 && digits.length >= valor.replace(/\s+/g, '').length - 4) return true
  if (digits.length === 11 || digits.length === 14) return true
  return false
}

function formatarCapitalizacaoNome(nome: string): string {
  const lower = nome.toLocaleLowerCase('pt-BR')
  return lower.charAt(0).toLocaleUpperCase('pt-BR') + lower.slice(1)
}

function extrairPrimeiraPalavra(valor: string): string | null {
  const match = normalizarEspacos(valor).match(/[\p{L}][\p{L}'-]*/u)
  return match?.[0] ?? null
}

function nomeCompletoValido(valor: string, telefoneNormalizadoDDI?: string | null): string | null {
  const nome = normalizarEspacos(valor)
  if (!extrairPrimeiroNomeValidoHubVendas(nome, telefoneNormalizadoDDI)) return null
  return nome
}

export function extrairPrimeiroNomeValidoHubVendas(
  nomeBruto: string | null | undefined,
  telefoneNormalizadoDDI?: string | null
): string | null {
  const nome = normalizarEspacos(String(nomeBruto ?? ''))
  if (!nome || nome.length > 80) return null

  const comparacao = normalizarComparacao(nome)
  if (NOMES_INVALIDOS.has(comparacao)) return null
  if (pareceTelefoneOuDocumento(nome, telefoneNormalizadoDDI)) return null
  if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(nome)) return null
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(nome)) return null
  if (!/\p{L}/u.test(nome)) return null
  if (/digisac|whatsapp|lead hub vendas/i.test(nome)) return null

  const primeiraPalavra = extrairPrimeiraPalavra(nome)
  if (!primeiraPalavra || primeiraPalavra.length < 2 || primeiraPalavra.length > 30) return null
  if (!/\p{L}/u.test(primeiraPalavra)) return null
  if (NOMES_INVALIDOS.has(normalizarComparacao(primeiraPalavra))) return null

  return formatarCapitalizacaoNome(primeiraPalavra)
}

export function mascararNomeBrutoHubVendas(nomeBruto: string | null | undefined): string | null {
  const nome = normalizarEspacos(String(nomeBruto ?? ''))
  if (!nome) return null
  const primeira = extrairPrimeiraPalavra(nome)
  if (!primeira) return `[sem-letras:${nome.length}]`
  return `${primeira.charAt(0)}***[${nome.split(' ').length}p/${nome.length}]`
}

export function resolverNomeMensagemHubVendas(params: {
  nomeBruto: string | null | undefined
  origemNome: ResultadoNomeHubVendas['origemNome']
  telefoneNormalizadoDDI?: string | null
}): ResultadoNomeHubVendas {
  const primeiroNome = extrairPrimeiroNomeValidoHubVendas(params.nomeBruto, params.telefoneNormalizadoDDI)
  const nomeCompleto = primeiroNome ? nomeCompletoValido(String(params.nomeBruto ?? ''), params.telefoneNormalizadoDDI) : null
  return {
    nomeCompleto,
    primeiroNome,
    origemNome: primeiroNome ? params.origemNome : 'indisponivel',
    fallbackNome: !primeiroNome,
    nomeBrutoSanitizado: mascararNomeBrutoHubVendas(params.nomeBruto),
  }
}

export function resolverNomeClienteHubVendas(params: {
  fontes: FonteNomeHubVendas[]
  telefoneNormalizadoDDI?: string | null
}): ResultadoNomeHubVendas {
  let primeiroSanitizado: string | null = null

  for (const fonte of params.fontes) {
    if (!primeiroSanitizado) primeiroSanitizado = mascararNomeBrutoHubVendas(fonte.nomeBruto)
    const primeiroNome = extrairPrimeiroNomeValidoHubVendas(fonte.nomeBruto, params.telefoneNormalizadoDDI)
    if (!primeiroNome) continue

    return {
      nomeCompleto: nomeCompletoValido(String(fonte.nomeBruto ?? ''), params.telefoneNormalizadoDDI),
      primeiroNome,
      origemNome: fonte.origem,
      fallbackNome: false,
      nomeBrutoSanitizado: mascararNomeBrutoHubVendas(fonte.nomeBruto),
      campoOrigem: fonte.campo ?? null,
    }
  }

  return {
    nomeCompleto: null,
    primeiroNome: null,
    origemNome: 'indisponivel',
    fallbackNome: true,
    nomeBrutoSanitizado: primeiroSanitizado,
    campoOrigem: null,
  }
}

export function obterNomeExibicaoLojaHubVendas(params: {
  serviceId?: string | null
  loja?: HubVendasLoja | null
  fallback?: string | null
}): string {
  const loja = params.loja ?? (params.serviceId ? HUB_VENDAS_SERVICE_ID_PARA_LOJA.get(params.serviceId) : null)
  if (loja) return HUB_VENDAS_LOJAS[loja].nomeExibicao

  const fallback = normalizarComparacao(params.fallback ?? '')
  if (fallback.includes('portao')) return HUB_VENDAS_LOJAS.portao.nomeExibicao
  if (fallback.includes('bigorrilho')) return HUB_VENDAS_LOJAS.bigorrilho.nomeExibicao
  if (fallback.includes('hauer') || fallback.includes('marechal')) return HUB_VENDAS_LOJAS.hauer_marechal.nomeExibicao
  return 'Le Bébé'
}

export function montarMensagemRecuperacaoHubVendas(params: {
  template: string
  nome: string | null
  lojaExibicao: string
}): string {
  let texto = params.template.replaceAll('[LOJA]', params.lojaExibicao)

  if (params.nome) {
    texto = texto.replaceAll('[NOME]', params.nome)
  } else {
    texto = texto
      .replace(/Olá,\s*\[NOME\]!/gi, 'Olá!')
      .replace(/,\s*\[NOME\]/g, '')
      .replaceAll('[NOME]', '')
  }

  return texto
    .replace(/[ \t]+$/gm, '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function validarTextoFinalHubVendas(texto: string): ValidacaoTextoFinalHubVendas {
  const pendentes = new Set<string>()
  const placeholders = texto.match(/\[[A-Z_]+\]/g) ?? []
  for (const placeholder of placeholders) {
    pendentes.add(placeholder)
  }
  if (/\bundefined\b/i.test(texto)) pendentes.add('undefined')
  if (/\bnull\b/i.test(texto)) pendentes.add('null')

  return {
    ok: pendentes.size === 0,
    placeholdersPendentes: Array.from(pendentes).sort(),
  }
}
