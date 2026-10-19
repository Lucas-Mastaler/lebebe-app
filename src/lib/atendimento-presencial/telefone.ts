export type ResultadoNormalizacaoTelefone = {
  telefoneInformado: string | null
  digitos: string
  telefoneNormalizado: string | null
  telefoneNormalizadoDDI: string | null
  valido: boolean
  motivoInvalido: string | null
}

export function extrairDigitosTelefone(valor: string | null | undefined) {
  return (valor ?? '').replace(/\D/g, '')
}

export function normalizarTelefone(valor: string | null | undefined): ResultadoNormalizacaoTelefone {
  const telefoneInformado = typeof valor === 'string' && valor.trim() ? valor.trim() : null
  const digitos = extrairDigitosTelefone(valor)

  if (!digitos) {
    return {
      telefoneInformado,
      digitos,
      telefoneNormalizado: null,
      telefoneNormalizadoDDI: null,
      valido: false,
      motivoInvalido: 'telefone_vazio',
    }
  }

  const telefoneSemDDI = digitos.startsWith('55') && digitos.length > 11 ? digitos.slice(2) : digitos

  if (telefoneSemDDI.length < 10) {
    return {
      telefoneInformado,
      digitos,
      telefoneNormalizado: null,
      telefoneNormalizadoDDI: null,
      valido: false,
      motivoInvalido: 'digitos_insuficientes',
    }
  }

  if (telefoneSemDDI.length > 11) {
    return {
      telefoneInformado,
      digitos,
      telefoneNormalizado: null,
      telefoneNormalizadoDDI: null,
      valido: false,
      motivoInvalido: 'digitos_excedentes',
    }
  }

  const ddd = telefoneSemDDI.slice(0, 2)
  if (ddd === '00') {
    return {
      telefoneInformado,
      digitos,
      telefoneNormalizado: null,
      telefoneNormalizadoDDI: null,
      valido: false,
      motivoInvalido: 'ddd_invalido',
    }
  }

  return {
    telefoneInformado,
    digitos,
    telefoneNormalizado: telefoneSemDDI,
    telefoneNormalizadoDDI: `55${telefoneSemDDI}`,
    valido: true,
    motivoInvalido: null,
  }
}

export function validarTelefone(valor: string | null | undefined) {
  return normalizarTelefone(valor).valido
}

// Validação de novas escritas do cadastro presencial; leitores legados e outros
// módulos mantêm o contrato do normalizador acima.
const DDDS_BR = new Set('11 12 13 14 15 16 17 18 19 21 22 24 27 28 31 32 33 34 35 37 38 41 42 43 44 45 46 47 48 49 51 53 54 55 61 62 63 64 65 66 67 68 69 71 73 74 75 77 79 81 82 83 84 85 86 87 88 89 91 92 93 94 95 96 97 98 99'.split(' '))

export function normalizarTelefoneClienteBR(valor: string | null | undefined): ResultadoNormalizacaoTelefone {
  const resultado = normalizarTelefone(valor)
  if (!resultado.valido) return resultado
  const nacional = resultado.telefoneNormalizado!
  const motivo = !DDDS_BR.has(nacional.slice(0, 2)) ? 'ddd_invalido'
    : !/^(?:[2-5][0-9]{7}|9[0-9]{8})$/.test(nacional.slice(2)) ? 'formato_brasileiro_invalido' : null
  return motivo ? { ...resultado, valido: false, motivoInvalido: motivo } : resultado
}

export function mensagemTelefoneCliente(valor: string | null | undefined) {
  const resultado = normalizarTelefoneClienteBR(valor)
  if (resultado.valido) return null
  if (resultado.motivoInvalido === 'ddd_invalido') return 'Informe um DDD brasileiro existente.'
  if (resultado.motivoInvalido === 'digitos_excedentes') return 'Há dígitos a mais. Revise o telefone completo, sem ramal.'
  return 'Informe DDD e celular com 9 dígitos iniciado em 9, ou fixo com 8 dígitos iniciado em 2, 3, 4 ou 5.'
}

// Mantém todo o conteúdo excedente para que a validação possa apontá-lo.
export function mascararTelefoneClienteBR(valor: string | null | undefined) {
  const digitos = extrairDigitosTelefone(valor)
  const nacional = digitos.startsWith('55') && digitos.length > 11 ? digitos.slice(2) : digitos
  return nacional.length > 11 ? (valor ?? '') : aplicarMascaraTelefoneBR(valor)
}

export function formatarTelefone(valor: string | null | undefined) {
  const normalizado = normalizarTelefone(valor)
  const telefone = normalizado.telefoneNormalizado

  if (!telefone) return ''

  if (telefone.length === 10) {
    return `(${telefone.slice(0, 2)}) ${telefone.slice(2, 6)}-${telefone.slice(6)}`
  }

  return `(${telefone.slice(0, 2)}) ${telefone.slice(2, 7)}-${telefone.slice(7)}`
}

export function mascararTelefoneParaLog(valor: string | null | undefined) {
  const digitos = extrairDigitosTelefone(valor)
  if (!digitos) return 'telefone_ausente'

  const ultimos = digitos.slice(-4)
  return `***${ultimos}`
}

export function normalizarDigitosTelefoneNacionalVisual(valor: string | null | undefined) {
  const digitos = extrairDigitosTelefone(valor)
  const semDDI = digitos.startsWith('55') && digitos.length > 11 ? digitos.slice(2) : digitos
  return semDDI.slice(0, 11)
}

export function aplicarMascaraTelefoneBR(valor: string | null | undefined) {
  const digitos = normalizarDigitosTelefoneNacionalVisual(valor)

  if (!digitos) return ''
  if (digitos.length <= 2) return `(${digitos}`

  const ddd = digitos.slice(0, 2)
  const numero = digitos.slice(2)

  if (numero.length <= 4) return `(${ddd}) ${numero}`

  if (digitos.length <= 10) {
    return `(${ddd}) ${numero.slice(0, 4)}-${numero.slice(4)}`
  }

  return `(${ddd}) ${numero.slice(0, 5)}-${numero.slice(5)}`
}
