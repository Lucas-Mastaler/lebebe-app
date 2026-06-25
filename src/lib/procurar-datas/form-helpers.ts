type FormErrors = {
  logradouro?: string
  numero?: string
  bairro?: string
  cidade?: string
  uf?: string
  dataInicial?: string
  endereco?: string
  tempo?: string
}

type EnderecoForm = {
  logradouro: string
  numero: string
  bairro: string
  cidade: string
  uf: string
}

export function normalizarLogradouro(valor: string): string {
  return valor
    .replace(/[^A-Za-z0-9\s.,\-/%ªº'áàâãéêíóôõúçÁÀÂÃÉÊÍÓÔÕÚÇ]/g, '')
    .replace(/\s+/g, ' ')
    .toUpperCase()
}

export function normalizarBairro(valor: string): string {
  return valor
    .replace(/[^A-Za-z0-9\s.,\-/%ªº'áàâãéêíóôõúçÁÀÂÃÉÊÍÓÔÕÚÇ]/g, '')
    .replace(/\s+/g, ' ')
    .toUpperCase()
}

export function normalizarCidade(valor: string): string {
  return valor
    .replace(/[^A-Za-z\s.\-áàâãéêíóôõúçÁÀÂÃÉÊÍÓÔÕÚÇ]/g, '')
    .replace(/\s+/g, ' ')
    .toUpperCase()
}

export function normalizarNumero(valor: string): string {
  return valor.replace(/\D/g, '').trim()
}

export function normalizarUF(valor: string): string {
  return valor.replace(/[^a-zA-Z]/g, '').toUpperCase().slice(0, 2)
}

export function validarCamposEndereco(form: EnderecoForm): { ok: boolean; errors: FormErrors } {
  const errors: FormErrors = {}

  if (!form.logradouro.trim() || form.logradouro.trim().length <= 2) {
    errors.logradouro = 'Informe o logradouro.'
  }

  if (!form.bairro.trim() || form.bairro.trim().length < 2) {
    errors.bairro = 'Informe o bairro.'
  }

  if (!form.cidade.trim() || form.cidade.trim().length <= 2) {
    errors.cidade = 'Informe a cidade.'
  }

  if (!form.uf.trim() || form.uf.trim().length !== 2) {
    errors.uf = 'Informe a UF com 2 letras.'
  }

  return { ok: Object.keys(errors).length === 0, errors }
}

export function mensagemErroTempo(tempoNecessario: string, tempoTooLong: boolean): string | null {
  if (!tempoNecessario || tempoNecessario === '00:00') {
    return 'Selecione ao menos um servico para calcular o tempo.'
  }
  if (tempoTooLong) {
    return 'Tempo necessario acima do limite de 06:30.'
  }
  return null
}
