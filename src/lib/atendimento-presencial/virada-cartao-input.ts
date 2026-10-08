import { converterViradaCartaoInput, formatarViradaCartaoInput } from './ficha-schema'

export const VIRADA_CARTAO_OBRIGATORIA = 'Informe o dia e o mês da virada do cartão (DD/MM), sem ano.'

export function validarViradaCartaoInput(valor: string): string | undefined {
  if (!valor) return VIRADA_CARTAO_OBRIGATORIA
  if (!/^\d{2}\/\d{2}$/.test(valor)) return 'Complete o dia e o mês no formato DD/MM, sem ano.'
  if (!converterViradaCartaoInput(valor)) return 'Data inválida. Ajuste o dia e o mês para uma data válida (DD/MM), sem ano.'
}

export function prepararViradaCartaoInput(valor: string): { valor: string; erro?: string } {
  const digitos = valor.replace(/\D/g, '')
  if (digitos.length > 4) return { valor, erro: 'Use somente dia e mês (DD/MM), sem ano.' }
  const dia = Number(digitos.slice(0, 2))
  const mes = Number(digitos.slice(2))
  if (digitos.length >= 2 && (dia < 1 || dia > 31)) {
    return { valor, erro: 'Dia inválido. Digite um dia de 01 a 31.' }
  }
  if (digitos.length === 4 && (mes < 1 || mes > 12)) {
    return { valor, erro: 'Mês inválido. Digite um mês de 01 a 12.' }
  }
  return { valor: formatarViradaCartaoInput(valor) }
}
