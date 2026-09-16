/**
 * Máscaras e formatos de entrada — MSK=C (formatação progressiva em tempo
 * real, sem separadores fixos aparecendo antes da hora). Cada máscara
 * separa claramente:
 *   - `digitsOnly` / normalização: o valor que deve ser enviado/persistido;
 *   - `format*`: o valor exibido no campo enquanto o usuário digita.
 * Colar um valor já formatado deve ser normalizado antes de reaplicar a
 * máscara — por isso todo `format*` recebe a entrada crua (já pode ter
 * pontuação) e remove o que não interessa antes de formatar de novo.
 */

export function onlyDigits(value: string): string {
  return value.replace(/\D/g, '')
}

export function formatCpf(value: string): string {
  const d = onlyDigits(value).slice(0, 11)
  if (d.length > 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
  if (d.length > 6) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`
  if (d.length > 3) return `${d.slice(0, 3)}.${d.slice(3)}`
  return d
}

export function formatCnpj(value: string): string {
  const d = onlyDigits(value).slice(0, 14)
  if (d.length > 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`
  if (d.length > 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`
  if (d.length > 5) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`
  if (d.length > 2) return `${d.slice(0, 2)}.${d.slice(2)}`
  return d
}

export function formatPhone(value: string): string {
  const d = onlyDigits(value).slice(0, 11)
  if (d.length > 10) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
  if (d.length > 6) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  if (d.length > 2) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  return d
}

export function formatCep(value: string): string {
  const d = onlyDigits(value).slice(0, 8)
  if (d.length > 5) return `${d.slice(0, 5)}-${d.slice(5)}`
  return d
}

/** Recebe dígitos representando centavos (ex.: "12345" = R$ 123,45). */
export function formatCurrencyFromCents(value: string): string {
  const d = onlyDigits(value)
  const cents = d === '' ? 0 : parseInt(d, 10)
  const reais = (cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return `R$ ${reais}`
}

export function parseCurrencyToCents(display: string): number {
  return parseInt(onlyDigits(display) || '0', 10)
}

export function formatPercentage(value: string): string {
  const cleaned = value.replace(/[^\d,]/g, '')
  return cleaned === '' ? '' : `${cleaned}%`
}

export function formatDateBr(value: string): string {
  const d = onlyDigits(value).slice(0, 8)
  if (d.length > 4) return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`
  if (d.length > 2) return `${d.slice(0, 2)}/${d.slice(2)}`
  return d
}

export function formatTime(value: string): string {
  const d = onlyDigits(value).slice(0, 4)
  if (d.length > 2) return `${d.slice(0, 2)}:${d.slice(2)}`
  return d
}

export function formatQuantity(value: string): string {
  const d = onlyDigits(value)
  return d === '' ? '' : String(parseInt(d, 10))
}

export function formatDecimal(value: string): string {
  return value.replace(/[^\d,]/g, '').replace(/(,.*),/g, '$1')
}

export interface MaskReferenceRow {
  tipo: string
  exibicao: string
  digitado: string
  normalizado: string
}

/** Recomendação técnica — não é uma decisão aprovada automaticamente por si só; ver `docs/design-system/interaction-standards.md`. */
export const MASK_REFERENCE: MaskReferenceRow[] = [
  { tipo: 'CPF', exibicao: '000.000.000-00', digitado: 'só números', normalizado: 'string de 11 dígitos' },
  { tipo: 'CNPJ', exibicao: '00.000.000/0000-00', digitado: 'só números', normalizado: 'string de 14 dígitos' },
  { tipo: 'Telefone', exibicao: '(00) 00000-0000', digitado: 'só números', normalizado: 'string de 10-11 dígitos com DDD' },
  { tipo: 'CEP', exibicao: '00000-000', digitado: 'só números', normalizado: 'string de 8 dígitos' },
  { tipo: 'Moeda', exibicao: 'R$ 1.234,56', digitado: 'dígitos da direita para a esquerda', normalizado: 'number em centavos' },
  { tipo: 'Percentual', exibicao: '12,5%', digitado: 'números + vírgula', normalizado: 'number (a decidir 0-100 ou 0-1)' },
  { tipo: 'Data', exibicao: 'dd/mm/aaaa', digitado: 'só números ou calendário', normalizado: 'ISO 8601 (aaaa-mm-dd)' },
  { tipo: 'Hora', exibicao: 'hh:mm', digitado: 'só números', normalizado: 'string HH:mm (24h)' },
  { tipo: 'Quantidade', exibicao: '12', digitado: 'só números inteiros', normalizado: 'number inteiro' },
  { tipo: 'Decimal', exibicao: '12,5', digitado: 'números + vírgula', normalizado: 'number (ponto internamente)' },
]
