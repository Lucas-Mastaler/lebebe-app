const TIPOS_DIVERGENCIA_VALIDOS = new Set(['faltou', 'sobrou', 'avaria'])

export function possuiDivergenciaValida(tipo: string | null | undefined): boolean {
  return !!tipo && TIPOS_DIVERGENCIA_VALIDOS.has(tipo)
}

export function registroPodeFinalizar(
  volumesRecebidos: number,
  volumesPrevistos: number,
  divergenciaTipo: string | null | undefined
): boolean {
  return volumesRecebidos >= volumesPrevistos || possuiDivergenciaValida(divergenciaTipo)
}
