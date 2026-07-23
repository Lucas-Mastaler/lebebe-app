import type { DisponibilidadeEquipeDataV2 } from './disponibilidade'
import type { ResumoParseAgendaV2 } from './parse-agenda-shag'

export type EstadoConsistenciaEspacialSlotV2 =
  | 'com-pontos-validos'
  | 'dia-realmente-vazio'
  | 'rota-simples-com-carregamento'
  | 'ocupado-sem-pontos'
  | 'agenda-sem-endereco'
  | 'evento-desconhecido-sem-endereco'
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
  eventosOperacionaisNaoEspaciais: number
  tempoOperacionalNaoEspacialMin: number
  eventosDesconhecidosSemEndereco: number
  tempoDesconhecidoSemEnderecoMin: number
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
    eventosOperacionaisNaoEspaciais: input.resumoAgenda.eventosOperacionaisNaoEspaciais ?? 0,
    tempoOperacionalNaoEspacialMin: input.resumoAgenda.tempoOperacionalNaoEspacialMin ?? 0,
    eventosDesconhecidosSemEndereco: input.resumoAgenda.eventosDesconhecidosSemEndereco ?? 0,
    tempoDesconhecidoSemEnderecoMin: input.resumoAgenda.tempoDesconhecidoSemEnderecoMin ?? 0,
  }

  if (input.resumoAgenda.semCoordenadas > 0) {
    return {
      ...base,
      estado: 'agenda-sem-coordenadas',
      motivo: 'Ha agendamento real com endereco, mas sem coordenadas resolvidas.',
      rotaSimplesPermitida: false,
      bloqueado: true,
    }
  }

  if (input.resumoAgenda.semEndereco > 0) {
    return {
      ...base,
      estado: base.eventosDesconhecidosSemEndereco > 0
        ? 'evento-desconhecido-sem-endereco'
        : 'agenda-sem-endereco',
      motivo: 'Ha evento real sem endereco espacialmente utilizavel e sem classificacao operacional segura.',
      rotaSimplesPermitida: false,
      bloqueado: true,
    }
  }

  if (input.resumoAgenda.pontosValidos > 0) {
    return {
      ...base,
      estado: 'com-pontos-validos',
      motivo: 'Agenda e disponibilidade possuem evidencia espacial suficiente.',
      rotaSimplesPermitida: false,
      bloqueado: false,
    }
  }

  if (tempoUtilizadoMin === null) {
    return {
      ...base,
      estado: 'capacidade-indeterminada',
      motivo: 'Tempo utilizado nao confirmado; nao e seguro presumir dia vazio.',
      rotaSimplesPermitida: false,
      bloqueado: true,
    }
  }

  if (tempoUtilizadoMin > 0) {
    if (base.eventosOperacionaisNaoEspaciais > 0 && base.eventosDesconhecidosSemEndereco === 0) {
      return {
        ...base,
        estado: 'rota-simples-com-carregamento',
        motivo: 'Tempo utilizado explicado por evento operacional sem rota; rota simples permitida sem criar ponto artificial.',
        rotaSimplesPermitida: true,
        bloqueado: false,
      }
    }

    return {
      ...base,
      estado: 'ocupado-sem-pontos',
      motivo: 'Disponibilidade parcial indica trabalho no dia, mas a agenda nao fornece os pontos.',
      rotaSimplesPermitida: false,
      bloqueado: true,
    }
  }

  return {
    ...base,
    estado: 'dia-realmente-vazio',
    motivo: 'Tempo utilizado igual a zero e nenhuma evidencia de agendamento no slot.',
    rotaSimplesPermitida: true,
    bloqueado: false,
  }
}
