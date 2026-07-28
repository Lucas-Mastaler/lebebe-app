import { normalizarTelefone as normalizarTelefoneDigisac, normalizarTelefoneDDI } from '@/lib/digisac/sgi-sync'
import { gerarVariacoesTelefone } from '@/lib/digisac/sgi-sync'
import {
  mascararTelefoneParaLog,
  normalizarTelefone as validarTelefoneAtendimento,
} from '@/lib/atendimento-presencial/telefone'

type ContatoRecord = Record<string, unknown>

export type TelefoneHubVendas = {
  telefoneNormalizado: string
  telefoneNormalizadoDDI: string
  variacoesDDI: string[]
  mascaraLog: string
}

function asRecord(value: unknown): ContatoRecord | null {
  return value && typeof value === 'object' ? (value as ContatoRecord) : null
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function coletarTelefonesContato(contato: unknown): string[] {
  const record = asRecord(contato)
  const data = asRecord(record?.data)
  const candidatos: unknown[] = [
    record?.number,
    record?.phone,
    record?.mobilePhone,
    record?.telephone,
    data?.number,
    data?.phone,
    data?.mobilePhone,
    data?.telephone,
  ]

  const phones = record?.phones ?? data?.phones
  if (Array.isArray(phones)) {
    for (const item of phones) {
      if (typeof item === 'string') {
        candidatos.push(item)
      } else {
        const phoneRecord = asRecord(item)
        candidatos.push(phoneRecord?.number, phoneRecord?.phone, phoneRecord?.value)
      }
    }
  }

  return candidatos
    .map((valor) => asString(valor))
    .filter((valor): valor is string => Boolean(valor))
}

export function extrairNomeContatoDigisac(contato: unknown): string | null {
  const record = asRecord(contato)
  const data = asRecord(record?.data)
  return (
    asString(record?.name) ??
    asString(record?.internalName) ??
    asString(data?.name) ??
    asString(data?.internalName)
  )
}

export function extrairTelefoneContatoHubVendas(contato: unknown): TelefoneHubVendas | null {
  for (const telefone of coletarTelefonesContato(contato)) {
    const ddi = normalizarTelefoneDDI(telefone)
    const nacional = normalizarTelefoneDigisac(ddi)
    const validacao = validarTelefoneAtendimento(ddi)
    if (!validacao.valido || !validacao.telefoneNormalizadoDDI || !validacao.telefoneNormalizado) {
      continue
    }

    const variacoesDDI = Array.from(
      new Set(
        gerarVariacoesTelefone(ddi)
          .map((variacao) => validarTelefoneAtendimento(normalizarTelefoneDDI(variacao)).telefoneNormalizadoDDI)
          .filter((valor): valor is string => Boolean(valor))
      )
    )

    return {
      telefoneNormalizado: validacao.telefoneNormalizado || nacional,
      telefoneNormalizadoDDI: validacao.telefoneNormalizadoDDI,
      variacoesDDI,
      mascaraLog: mascararTelefoneParaLog(validacao.telefoneNormalizadoDDI),
    }
  }

  return null
}
