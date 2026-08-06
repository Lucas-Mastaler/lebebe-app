const CONTROLES_SEM_QUEBRA_LINHA = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g
const TODOS_CONTROLES = /[\u0000-\u001F\u007F-\u009F]/g

function removerControlesLinhaUnica(valor: string): string {
  return valor.replace(TODOS_CONTROLES, '')
}

function normalizarLinhaUnica(valor: string): string {
  return removerControlesLinhaUnica(valor).normalize('NFC').trim().replace(/\s+/g, ' ')
}

export function normalizarConsultora(valor: string): string {
  return normalizarLinhaUnica(valor).toLocaleUpperCase('pt-BR')
}

export function normalizarCliente(valor: string): string {
  return normalizarLinhaUnica(valor).toLocaleUpperCase('pt-BR')
}

export function normalizarIdentificadorNumericoOpcional(valor: string | null | undefined): string | null {
  const normalizado = valor?.trim() ?? ''
  return normalizado || null
}

export function normalizarNumeroLancamento(valor: string | null | undefined): string | null {
  return normalizarIdentificadorNumericoOpcional(valor)
}

export function normalizarNumeroPedidoCompra(valor: string | null | undefined): string | null {
  return normalizarIdentificadorNumericoOpcional(valor)
}

export function normalizarComprador(valor: string | null | undefined): string | null {
  const normalizado = normalizarLinhaUnica(valor ?? '').toLocaleUpperCase('pt-BR')
  return normalizado || null
}

export function normalizarNomeColecaoCatalogo(valor: string | null | undefined): string | null {
  const normalizado = normalizarLinhaUnica(valor ?? '').toLocaleUpperCase('pt-BR')
  return normalizado || null
}

export function normalizarReferenciaCatalogo(valor: string | null | undefined): string | null {
  const normalizado = removerControlesLinhaUnica(valor ?? '').normalize('NFC').trim().toLocaleUpperCase('pt-BR')
  return normalizado || null
}

export function normalizarObservacoes(valor: string | null | undefined): string | null {
  const normalizado = (valor ?? '').replace(CONTROLES_SEM_QUEBRA_LINHA, '').normalize('NFC').trim()
  return normalizado || null
}
