const ROTULOS_TIPO_ALERTA: Record<string, string> = {
  automacao_pausada_automatica: 'Automação pausada',
  conexao_pausada_automatica: 'Loja pausada',
  erro_envio: 'Erro de envio',
  resultado_incerto: 'Resultado incerto',
  analise_manual: 'Análise manual',
  reserva_liberada: 'Reserva liberada',
  envio_travado: 'Envio travado',
  retry_agendado: 'Nova tentativa agendada',
  falha_recorrente_conexao: 'Falha recorrente na loja',
  cron_falhou: 'Rotina automática falhou',
  resumo_diario: 'Resumo diário',
  teste_manual: 'Alerta de teste',
}

const ROTULOS_STATUS_ALERTA: Record<string, string> = {
  enviado: 'Enviado',
  falha: 'Falha',
}

function humanizarIdentificador(valor: string): string {
  const texto = valor.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim()
  if (!texto) return valor
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

export function rotuloTipoAlertaHubVendas(tipo: string): string {
  return ROTULOS_TIPO_ALERTA[tipo] ?? humanizarIdentificador(tipo)
}

export function rotuloStatusAlertaHubVendas(status: string): string {
  return ROTULOS_STATUS_ALERTA[status] ?? humanizarIdentificador(status)
}

export function tomStatusAlertaHubVendas(status: string): 'success' | 'danger' | 'neutral' {
  if (status === 'enviado') return 'success'
  if (status === 'falha') return 'danger'
  return 'neutral'
}
