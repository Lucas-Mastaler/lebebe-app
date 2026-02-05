export function deveDesconectarPorHorario(role: string, ultimoLogoutAutomatico?: string): boolean {
  if (role === 'superadmin') {
    return false
  }

  const agoraBRT = new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' })
  const dataAtualBRT = new Date(agoraBRT)
  
  const horaAtualBRT = dataAtualBRT.getHours()
  const minutosAtuaisBRT = dataAtualBRT.getMinutes()
  
  const hoje = dataAtualBRT.toISOString().split('T')[0]
  
  const horarioAtualEmMinutos = horaAtualBRT * 60 + minutosAtuaisBRT
  const horarioLogoutEmMinutos = 19 * 60
  
  if (horarioAtualEmMinutos < horarioLogoutEmMinutos) {
    return false
  }
  
  if (!ultimoLogoutAutomatico) {
    return true
  }
  
  const dataUltimoLogout = new Date(ultimoLogoutAutomatico)
  const diaUltimoLogout = dataUltimoLogout.toISOString().split('T')[0]
  
  return diaUltimoLogout !== hoje
}

export function getHorarioBRT(): string {
  return new Date().toLocaleString('pt-BR', { 
    timeZone: 'America/Sao_Paulo',
    dateStyle: 'short',
    timeStyle: 'medium'
  })
}
