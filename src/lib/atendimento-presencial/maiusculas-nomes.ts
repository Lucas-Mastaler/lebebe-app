export function maiusculasNomeComCursor(valor: string, inicio: number, fim = inicio) {
  const upper = valor.toLocaleUpperCase('pt-BR')
  const cursorMapeado = (posicao: number) => valor.slice(0, posicao).toLocaleUpperCase('pt-BR').length
  return { valor: upper, inicio: cursorMapeado(inicio), fim: cursorMapeado(fim) }
}
