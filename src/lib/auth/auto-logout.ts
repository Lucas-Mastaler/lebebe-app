/**
 * Retorna a data/hora atual em BRT (America/Sao_Paulo).
 * Usa Intl.DateTimeFormat para extrair partes sem depender de toISOString (que volta pra UTC).
 */
function getAgoraBRT(): { ano: number; mes: number; dia: number; hora: number; minuto: number; dataStr: string } {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  const parts = formatter.formatToParts(new Date())
  const get = (type: string) => parts.find(p => p.type === type)?.value || '0'

  const ano = Number(get('year'))
  const mes = Number(get('month'))
  const dia = Number(get('day'))
  const hora = Number(get('hour'))
  const minuto = Number(get('minute'))
  const dataStr = `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`

  return { ano, mes, dia, hora, minuto, dataStr }
}

/**
 * Verifica se, pelo horário BRT atual, o usuário não-superadmin
 * deveria estar deslogado (passou das 19h e não foi desconectado hoje).
 * 
 * @param role - role do usuário
 * @param cookieLogoutDate - valor do cookie 'auto_logout_date' (formato YYYY-MM-DD) ou undefined
 * @returns true se deve forçar logout
 */
export function deveDesconectarPorHorario(role: string, cookieLogoutDate?: string): boolean {
  if (role === 'superadmin') {
    return false
  }

  const { hora, minuto, dataStr: hojeBRT } = getAgoraBRT()
  const horarioAtualEmMinutos = hora * 60 + minuto
  const horarioLogoutEmMinutos = 19 * 60

  // Antes das 19h BRT → não desconectar
  if (horarioAtualEmMinutos < horarioLogoutEmMinutos) {
    return false
  }

  // Depois das 19h BRT: verificar se o cookie indica que já foi deslogado HOJE
  if (cookieLogoutDate === hojeBRT) {
    return false
  }

  // Passou das 19h e não foi deslogado hoje → deve desconectar
  return true
}

/**
 * Retorna a data BRT de hoje no formato YYYY-MM-DD (para gravar no cookie).
 */
export function getDataHojeBRT(): string {
  return getAgoraBRT().dataStr
}

export function getHorarioBRT(): string {
  return new Date().toLocaleString('pt-BR', { 
    timeZone: 'America/Sao_Paulo',
    dateStyle: 'short',
    timeStyle: 'medium'
  })
}
