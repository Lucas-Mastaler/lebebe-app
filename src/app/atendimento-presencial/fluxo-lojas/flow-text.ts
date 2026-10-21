export function differenceText(difference: number | null) {
  if (difference === null) return 'Aguardando contagem completa para comparar'
  if (difference === 0) return 'Mesma quantidade de grupos AlterVision e Pranchetas'
  const count = Math.abs(difference).toLocaleString('pt-BR')
  return difference > 0
    ? `${count} ${difference === 1 ? 'grupo AlterVision' : 'grupos AlterVision'} a mais que Pranchetas`
    : `${count} ${difference === -1 ? 'Prancheta' : 'Pranchetas'} a mais que grupos AlterVision`
}

const warningLabels: Record<string, string> = {
  'Disponibilidade dos dispositivos não confirmada.': 'Ainda não foi possível confirmar se as câmeras funcionaram durante todo o período.',
  'Total diário medido ainda não mapeado; reconciliação indisponível.': 'O total de entradas do dia ainda não está disponível para conferência.',
  'Fluxo ajustado diário ainda não mapeado.': 'O total revisado pela AlterVision ainda não está disponível.',
  'Identificadores externos não reconhecidos foram ignorados; cobertura não confirmada.': 'Alguns dados da AlterVision não puderam ser associados às lojas. A contagem pode estar incompleta.',
  'Medição em cache desatualizada; atualização pendente.': 'Estamos mostrando a última contagem disponível enquanto aguardamos uma atualização.',
  'Última medição conhecida, desatualizada; a atualização externa falhou.': 'Não foi possível atualizar a AlterVision. Estamos mostrando a última contagem disponível, que pode estar desatualizada.',
  'Comparação com Pranchetas filtradas; o fluxo inclui todos os grupos.': 'Os filtros de atendimento foram aplicados às Pranchetas. A AlterVision continua mostrando todos os grupos que entraram nas lojas e nos horários selecionados.',
  'O horário é o início do preenchimento; não comprova o instante de entrada na loja.': 'As Pranchetas aparecem no horário em que o preenchimento começou, que pode ser diferente do horário de entrada na loja.',
  'Há atendimentos concluídos em outro dia; consulte a duração nos registros.': 'Algumas Pranchetas foram concluídas em outro dia. Veja o tempo de preenchimento nos atendimentos.',
  'Total diário medido diverge da soma das horas recebidas.': 'O total de entradas do dia não coincide com a soma das contagens por hora.',
}

export function friendlyWarning(warning: string) {
  return warningLabels[warning] ?? warning
}
