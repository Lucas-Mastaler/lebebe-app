/** Estado da evidência diagnóstica; não altera a classificação do motor. */
export function classificarEstadoRecalculoSlot(input: {
  fontesCompletas: boolean
  disponibilidadeConfirmada: boolean
  candidatoPresente: boolean
  calculoOk: boolean
  kmAdicionalNaRotaM: number | null
  filtroEarlyDescartado: boolean
  elegivel: boolean
}): 'elegivel' | 'rejeitado' | 'inconclusivo' {
  if (!input.fontesCompletas || !input.disponibilidadeConfirmada || !input.candidatoPresente || !input.calculoOk) {
    return 'inconclusivo'
  }
  // O filtro pode comprovar rejeição sem que o delta precise ser calculado.
  if (input.filtroEarlyDescartado) return 'rejeitado'
  if (input.kmAdicionalNaRotaM === null || !Number.isFinite(input.kmAdicionalNaRotaM)) return 'inconclusivo'
  return input.elegivel ? 'elegivel' : 'rejeitado'
}
