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

export type MotivoTelefoneRejeitadoHubVendas = 'vazio' | 'internacional' | 'formato_invalido'

export type ResultadoTelefoneBrasilHubVendas =
  | { ddi: string; motivo: null }
  | { ddi: null; motivo: MotivoTelefoneRejeitadoHubVendas }

// DDDs em uso no Brasil (Anatel).
const DDDS_BRASIL = new Set([
  '11', '12', '13', '14', '15', '16', '17', '18', '19',
  '21', '22', '24', '27', '28',
  '31', '32', '33', '34', '35', '37', '38',
  '41', '42', '43', '44', '45', '46', '47', '48', '49',
  '51', '53', '54', '55',
  '61', '62', '63', '64', '65', '66', '67', '68', '69',
  '71', '73', '74', '75', '77', '79',
  '81', '82', '83', '84', '85', '86', '87', '88', '89',
  '91', '92', '93', '94', '95', '96', '97', '98', '99',
])

function telefoneNacionalBrasilValido(nacional: string): boolean {
  if (nacional.length !== 10 && nacional.length !== 11) return false
  if (!DDDS_BRASIL.has(nacional.slice(0, 2))) return false
  const primeiroDigitoAssinante = nacional[2]
  // Celular com 9o digito (11 dígitos) sempre começa com 9; fixo/celular antigo (10) começa com 2-9.
  return nacional.length === 11 ? primeiroDigitoAssinante === '9' : /[2-9]/.test(primeiroDigitoAssinante)
}

/**
 * Normaliza para `55` + DDD + número SEM converter silenciosamente número estrangeiro em brasileiro.
 *
 * Diferente de `normalizarTelefoneDDI` (que prefixa `55` em qualquer número sem `55`), aqui um número
 * sem DDI só é aceito se tiver formato nacional brasileiro válido. Ex.: um celular espanhol
 * `34 6XXXXXXXX` (11 dígitos, sem `55`) NÃO vira `55 34 6XXXXXXXX`: o DDD 34 existe no Brasil, mas
 * celular de 11 dígitos precisa ter `9` na 3ª posição.
 *
 * Limite conhecido: número estrangeiro sem `+`/`00` cujo formato coincida com um nacional brasileiro
 * válido não é distinguível apenas pelos dígitos.
 */
export function normalizarTelefoneBrasilHubVendas(valor: string | null | undefined): ResultadoTelefoneBrasilHubVendas {
  const texto = (valor ?? '').trim()
  const digitos = texto.replace(/\D/g, '')
  if (!digitos) return { ddi: null, motivo: 'vazio' }

  const internacionalExplicito = texto.startsWith('+') || digitos.startsWith('00')
  const semPrefixoInternacional = digitos.startsWith('00') ? digitos.slice(2) : digitos

  let nacional: string
  if (internacionalExplicito) {
    if (!semPrefixoInternacional.startsWith('55')) return { ddi: null, motivo: 'internacional' }
    nacional = semPrefixoInternacional.slice(2)
  } else if (semPrefixoInternacional.startsWith('55') && semPrefixoInternacional.length >= 12) {
    nacional = semPrefixoInternacional.slice(2)
  } else {
    nacional = semPrefixoInternacional
  }

  if (!telefoneNacionalBrasilValido(nacional)) return { ddi: null, motivo: 'formato_invalido' }
  return { ddi: `55${nacional}`, motivo: null }
}

export function extrairTelefoneContatoHubVendas(contato: unknown): TelefoneHubVendas | null {
  const motivosRejeicao: MotivoTelefoneRejeitadoHubVendas[] = []

  for (const telefone of coletarTelefonesContato(contato)) {
    const normalizadoBrasil = normalizarTelefoneBrasilHubVendas(telefone)
    if (normalizadoBrasil.ddi === null) {
      motivosRejeicao.push(normalizadoBrasil.motivo)
      continue
    }
    const ddi = normalizadoBrasil.ddi
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

  if (motivosRejeicao.length > 0) {
    console.warn(`[HUB VENDAS TELEFONE] telefone do contato rejeitado (sem normalizar para Brasil) motivos=${[...new Set(motivosRejeicao)].join(',')}`)
  }
  return null
}
