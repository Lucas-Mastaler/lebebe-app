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

export type OrigemNomeContatoDigisac =
  | 'contato_hub'
  | 'perfil_whatsapp'
  | 'contato_destino_existente'
  | 'contato_destino_criado'

export type CandidatoNomeContatoDigisac = {
  nomeBruto: string
  origem: OrigemNomeContatoDigisac
  campo: string
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
  return extrairCandidatosNomeContatoDigisac(contato, 'contato_hub')[0]?.nomeBruto ?? null
}

export function extrairCandidatosNomeContatoDigisac(
  contato: unknown,
  origemPadrao: Exclude<OrigemNomeContatoDigisac, 'perfil_whatsapp'> = 'contato_hub'
): CandidatoNomeContatoDigisac[] {
  const record = asRecord(contato)
  const data = asRecord(record?.data)
  const candidatos: CandidatoNomeContatoDigisac[] = []

  const adicionar = (nomeBruto: string | null, origem: OrigemNomeContatoDigisac, campo: string) => {
    if (!nomeBruto) return
    if (candidatos.some((item) => item.nomeBruto === nomeBruto)) return
    candidatos.push({ nomeBruto, origem, campo })
  }

  adicionar(asString(record?.firstName), origemPadrao, 'firstName')
  adicionar(asString(record?.name), origemPadrao, 'name')
  adicionar(asString(record?.displayName), origemPadrao, 'displayName')
  adicionar(asString(record?.alternativeName), origemPadrao, 'alternativeName')
  adicionar(asString(record?.internalName), origemPadrao, 'internalName')
  adicionar(asString(record?.pushName), 'perfil_whatsapp', 'pushName')
  adicionar(asString(record?.profileName), 'perfil_whatsapp', 'profileName')
  adicionar(asString(record?.contactName), 'perfil_whatsapp', 'contactName')

  adicionar(asString(data?.firstName), origemPadrao, 'data.firstName')
  adicionar(asString(data?.name), origemPadrao, 'data.name')
  adicionar(asString(data?.displayName), origemPadrao, 'data.displayName')
  adicionar(asString(data?.alternativeName), origemPadrao, 'data.alternativeName')
  adicionar(asString(data?.internalName), origemPadrao, 'data.internalName')
  adicionar(asString(data?.pushName), 'perfil_whatsapp', 'data.pushName')
  adicionar(asString(data?.profileName), 'perfil_whatsapp', 'data.profileName')
  adicionar(asString(data?.contactName), 'perfil_whatsapp', 'data.contactName')

  return candidatos
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
