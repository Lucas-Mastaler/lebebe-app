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
