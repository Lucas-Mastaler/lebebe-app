import type { DisponibilidadeEquipeDataV2 } from './disponibilidade'
import type { ResumoParseAgendaV2 } from './parse-agenda-shag'

export type EstadoConsistenciaEspacialSlotV2 =
  | 'com-pontos-validos'
  | 'dia-realmente-vazio'
  | 'ocupado-sem-pontos'
  | 'agenda-sem-endereco'
  | 'agenda-sem-coordenadas'
  | 'capacidade-indeterminada'

export type ConsistenciaEspacialSlotV2 = {
  estado: EstadoConsistenciaEspacialSlotV2
  motivo: string
  rotaSimplesPermitida: boolean
  bloqueado: boolean
  tempoUtilizadoMin: number | null
  disponivelMin: number | null
  capacidadeTotalMin: number | null
  linhasDaData: number
  linhasDaEquipe: number
  pontosValidos: number
  semEndereco: number
  semCoordenadas: number
}

export function avaliarConsistenciaEspacialSlotV2(input: {
  disponibilidade?: Pick<
    DisponibilidadeEquipeDataV2,
    'tempoUtilizadoMin' | 'disponivelMin' | 'capacidadeTotalMin'
  > | null
  resumoAgenda: ResumoParseAgendaV2
}): ConsistenciaEspacialSlotV2 {
  const tempoUtilizadoMin = Number.isFinite(input.disponibilidade?.tempoUtilizadoMin)
    ? input.disponibilidade?.tempoUtilizadoMin ?? null
    : null
  const disponivelMin = Number.isFinite(input.disponibilidade?.disponivelMin)
    ? input.disponibilidade?.disponivelMin ?? null
    : null
  const capacidadeTotalMin = Number.isFinite(input.disponibilidade?.capacidadeTotalMin)
    ? input.disponibilidade?.capacidadeTotalMin ?? null
    : tempoUtilizadoMin !== null && disponivelMin !== null
      ? tempoUtilizadoMin + disponivelMin
      : null
  const base = {
    tempoUtilizadoMin,
    disponivelMin,
    capacidadeTotalMin,
    linhasDaEquipe: input.resumoAgenda.linhasDaEquipe,
    linhasDaData: input.resumoAgenda.linhasDaData,
    pontosValidos: input.resumoAgenda.pontosValidos,
    semEndereco: input.resumoAgenda.semEndereco,
    semCoordenadas: input.resumoAgenda.semCoordenadas,
  }

  if (input.resumoAgenda.semCoordenadas > 0) {
    return {
      ...base,
      estado: 'agenda-sem-coordenadas',
      motivo: 'Há agendamento real com endereço, mas sem coordenadas resolvidas.',
      rotaSimplesPermitida: false,
      bloqueado: true,
    }
  }

  if (input.resumoAgenda.semEndereco > 0) {
    return {
      ...base,
      estado: 'agenda-sem-endereco',
      motivo: 'Há agendamento real sem endereço espacialmente utilizável.',
      rotaSimplesPermitida: false,
      bloqueado: true,
    }
  }

  if (input.resumoAgenda.pontosValidos > 0) {
    return {
      ...base,
      estado: 'com-pontos-validos',
      motivo: 'Agenda e disponibilidade possuem evidência espacial suficiente.',
      rotaSimplesPermitida: false,
      bloqueado: false,
    }
  }

  if (tempoUtilizadoMin === null) {
    return {
      ...base,
      estado: 'capacidade-indeterminada',
      motivo: 'Tempo utilizado não confirmado; não é seguro presumir dia vazio.',
      rotaSimplesPermitida: false,
      bloqueado: true,
    }
  }

  if (tempoUtilizadoMin > 0) {
    return {
      ...base,
      estado: 'ocupado-sem-pontos',
      motivo: 'Disponibilidade parcial indica trabalho no dia, mas a agenda não fornece os pontos.',
      rotaSimplesPermitida: false,
      bloqueado: true,
    }
  }

  return {
    ...base,
    estado: 'dia-realmente-vazio',
    motivo: 'Tempo utilizado igual a zero e nenhuma evidência de agendamento no slot.',
    rotaSimplesPermitida: true,
    bloqueado: false,
  }
}
