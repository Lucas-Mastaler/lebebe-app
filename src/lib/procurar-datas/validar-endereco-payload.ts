import type { ValidarEnderecoRequest } from './contratos'

export function validarPayloadEndereco(body: ValidarEnderecoRequest): string | null {
  const logradouro = String(body.logradouro ?? '').trim()
  const numero = String(body.numero ?? '').trim()
  const bairro = String(body.bairro ?? '').trim()
  const cidade = String(body.cidade ?? '').trim()
  const uf = String(body.uf ?? '').trim()

  if (!logradouro || !numero || !bairro || !cidade || !uf) {
    return 'Informe logradouro, numero, bairro, cidade e UF.'
  }

  return null
}
