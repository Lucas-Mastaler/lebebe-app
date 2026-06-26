import type { EnderecoValidado, ValidarEnderecoRequest } from './contratos'
import {
  normalizarCep,
  normalizarLogradouroParaComparacao,
  normalizarTexto,
} from './endereco-cache'

export type ResultadoValidacaoEnderecoProvider =
  | { ok: true }
  | { ok: false; motivo: string }

const UF_NOMES: Record<string, string> = {
  AC: 'ACRE',
  AL: 'ALAGOAS',
  AP: 'AMAPA',
  AM: 'AMAZONAS',
  BA: 'BAHIA',
  CE: 'CEARA',
  DF: 'DISTRITO FEDERAL',
  ES: 'ESPIRITO SANTO',
  GO: 'GOIAS',
  MA: 'MARANHAO',
  MT: 'MATO GROSSO',
  MS: 'MATO GROSSO DO SUL',
  MG: 'MINAS GERAIS',
  PA: 'PARA',
  PB: 'PARAIBA',
  PR: 'PARANA',
  PE: 'PERNAMBUCO',
  PI: 'PIAUI',
  RJ: 'RIO DE JANEIRO',
  RN: 'RIO GRANDE DO NORTE',
  RS: 'RIO GRANDE DO SUL',
  RO: 'RONDONIA',
  RR: 'RORAIMA',
  SC: 'SANTA CATARINA',
  SP: 'SAO PAULO',
  SE: 'SERGIPE',
  TO: 'TOCANTINS',
}

function extrairAddress(resultado: EnderecoValidado): Record<string, unknown> {
  return typeof resultado.address === 'object' && resultado.address !== null
    ? resultado.address as Record<string, unknown>
    : {}
}

function textoResultado(resultado: EnderecoValidado): string {
  return [
    resultado.enderecoCompleto,
    resultado.display,
    resultado.display_name,
    resultado.formatted_address,
  ]
    .map((v) => String(v ?? ''))
    .filter(Boolean)
    .join(' ')
}

function cepResultado(resultado: EnderecoValidado): string {
  const address = extrairAddress(resultado)
  return normalizarCep(
    String(
      resultado.cep ??
        resultado.postcode ??
        resultado.postal_code ??
        address.postcode ??
        ''
    )
  )
}

function cidadeResultado(resultado: EnderecoValidado): string {
  const address = extrairAddress(resultado)
  return normalizarTexto(
    String(
      resultado.cidade ??
        resultado.city ??
        address.city ??
        address.town ??
        address.municipality ??
        address.county ??
        ''
    )
  )
}

function ufResultado(resultado: EnderecoValidado): string {
  const address = extrairAddress(resultado)
  return normalizarTexto(
    String(
      resultado.uf ??
        resultado.state_code ??
        address.state_code ??
        resultado.state ??
        address.state ??
        ''
    )
  )
    .replace(/^BR-/, '')
    .replace(/^BR\s+/, '')
}

function logradouroResultado(resultado: EnderecoValidado): string {
  const address = extrairAddress(resultado)
  return normalizarLogradouroParaComparacao(
    String(resultado.logradouro ?? resultado.road ?? address.road ?? '')
  )
}

function textoContemCidadeOuUf(resultado: EnderecoValidado, valor: string): boolean {
  const esperado = normalizarTexto(valor)
  return !!esperado && normalizarTexto(textoResultado(resultado)).includes(esperado)
}

function logradouroCompativel(form: ValidarEnderecoRequest, resultado: EnderecoValidado): boolean {
  const logradouroProvider = logradouroResultado(resultado)
  if (!logradouroProvider) return true

  const logradouroForm = normalizarLogradouroParaComparacao(form.logradouro)
  if (!logradouroForm) return false
  if (logradouroProvider === logradouroForm) return true
  if (logradouroProvider.includes(logradouroForm) || logradouroForm.includes(logradouroProvider)) return true

  const tokens = logradouroForm.split(/\s+/).filter((token) => token.length >= 4)
  return tokens.length > 0 && tokens.some((token) => logradouroProvider.includes(token))
}

export function validarEnderecoProviderDireto(
  resultado: EnderecoValidado,
  form: ValidarEnderecoRequest
): ResultadoValidacaoEnderecoProvider {
  const lat = Number(resultado.lat)
  const lng = Number(resultado.lng)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { ok: false, motivo: 'coordenadas_invalidas' }
  }

  const cepForm = normalizarCep(String(form.cep ?? ''))
  const cepProvider = cepResultado(resultado)
  if (cepForm && cepProvider && cepForm !== cepProvider) {
    return { ok: false, motivo: 'cep_mismatch' }
  }

  const cidadeForm = normalizarTexto(form.cidade)
  const cidadeProvider = cidadeResultado(resultado)
  if (!cidadeProvider && !textoContemCidadeOuUf(resultado, cidadeForm)) {
    return { ok: false, motivo: 'cidade_ausente' }
  }
  if (cidadeProvider && cidadeProvider !== cidadeForm) {
    return { ok: false, motivo: 'cidade_mismatch' }
  }

  const ufForm = normalizarTexto(form.uf)
  const ufProvider = ufResultado(resultado)
  if (!ufProvider && !textoContemCidadeOuUf(resultado, ufForm)) {
    return { ok: false, motivo: 'uf_ausente' }
  }
  if (ufProvider && ufProvider !== ufForm && ufProvider !== UF_NOMES[ufForm]) {
    return { ok: false, motivo: 'uf_mismatch' }
  }

  if (!logradouroCompativel(form, resultado)) {
    return { ok: false, motivo: 'logradouro_mismatch' }
  }

  return { ok: true }
}
