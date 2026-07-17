export function nomeClienteRascunho(nome: string | null | undefined) {
  return nome?.trim() || 'Cliente ainda não informado'
}

export function nomeConsultoraRascunho(nome: string | null | undefined) {
  return nome?.trim() || 'Consultora não identificada'
}
