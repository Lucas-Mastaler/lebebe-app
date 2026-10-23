export function chaveValida(chave: string): boolean {
  if (!/^\d{44}$/.test(chave)) return false
  let soma = 0
  for (let i = 42, peso = 2; i >= 0; i--, peso = peso === 9 ? 2 : peso + 1) soma += Number(chave[i]) * peso
  const resto = 11 - soma % 11
  return Number(chave[43]) === (resto >= 10 ? 0 : resto)
}


export function normalizarChave(chave: string): string { return chave.replace(/\s/g, '') }

export function erroChave(chave: string): string {
  if (!/^\d{44}$/.test(chave)) return 'Informe os 44 números da chave de acesso.'
  if (!chaveValida(chave)) return 'A chave não passou na verificação. Confira os números da DANFE.'
  if (chave.slice(20, 22) !== '55') return 'Informe a chave de uma NF-e modelo 55.'
  return ''
}
