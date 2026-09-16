/**
 * Datas e períodos — DAT=A (digitação manual com máscara dd/mm/aaaa),
 * complementado pelo ajuste aprovado: o campo aceita digitação livre E
 * abertura de calendário pelo ícone — nunca só um dos dois. Este módulo é
 * só a lógica pura de parse/validação; o componente `DateField` cuida do
 * ícone/calendário/acessibilidade.
 */
import { formatDateBr, onlyDigits } from './masks'

export { formatDateBr }

export interface DateFieldLimits {
  min?: Date
  max?: Date
}

/** `dd/mm/aaaa` -> `Date` local (meia-noite), ou `null` se incompleto/inválido. */
export function parseBrDate(display: string): Date | null {
  const d = onlyDigits(display)
  if (d.length !== 8) return null
  const day = parseInt(d.slice(0, 2), 10)
  const month = parseInt(d.slice(2, 4), 10)
  const year = parseInt(d.slice(4, 8), 10)
  if (month < 1 || month > 12 || day < 1) return null
  const date = new Date(year, month - 1, day)
  const valid = date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
  return valid ? date : null
}

export function dateToBr(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `${day}/${month}/${date.getFullYear()}`
}

export function dateToIso(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export interface DateValidationResult {
  ok: boolean
  message?: string
}

export function validateSingleDate(display: string, limits: DateFieldLimits = {}): DateValidationResult {
  if (onlyDigits(display).length === 0) return { ok: true }
  const parsed = parseBrDate(display)
  if (!parsed) return { ok: false, message: 'Data inválida.' }
  if (limits.min && parsed < limits.min) return { ok: false, message: `Data não pode ser anterior a ${dateToBr(limits.min)}.` }
  if (limits.max && parsed > limits.max) return { ok: false, message: `Data não pode ser posterior a ${dateToBr(limits.max)}.` }
  return { ok: true }
}

export function validateDateRange(startDisplay: string, endDisplay: string, limits: DateFieldLimits = {}): DateValidationResult {
  const start = validateSingleDate(startDisplay, limits)
  if (!start.ok) return start
  const end = validateSingleDate(endDisplay, limits)
  if (!end.ok) return end
  const startDate = parseBrDate(startDisplay)
  const endDate = parseBrDate(endDisplay)
  if (startDate && endDate && endDate < startDate) {
    return { ok: false, message: 'A data final não pode ser anterior à data inicial.' }
  }
  return { ok: true }
}
