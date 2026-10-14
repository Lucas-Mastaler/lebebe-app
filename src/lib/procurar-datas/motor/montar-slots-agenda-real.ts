import type { SlotInputMapaKmAdicional } from './calcular-mapa-km-adicional-por-slot'
import type { DisponibilidadeEquipeDataV2 } from './disponibilidade'
import { normalizarEquipe } from './equipe'

// Mesmo limite técnico de fontes na pesquisa produtiva e na auditoria.
export const LIMITE_LEITURA_FONTES_V2 = 2000

export function montarSlotsAgendaReal(input: {
  janelaDatas: Array<{ dataISO: string }>
  slotsAlvo?: Array<{ dataISO: string; equipe: string }>
  linhasAgenda: SlotInputMapaKmAdicional['linhasAgenda']
  disponibilidades: DisponibilidadeEquipeDataV2[]
  cacheCoordenadasPorEndereco: Record<string, { lat: number; lng: number }>
  equipe1Ativa: boolean
  equipe2Ativa: boolean
}): SlotInputMapaKmAdicional[] {
  const equipes: string[] = []
  if (input.equipe1Ativa) equipes.push('EQUIPE 1')
  if (input.equipe2Ativa) equipes.push('EQUIPE 2')

  const slots: SlotInputMapaKmAdicional[] = []
  const disponibilidadePorSlot = new Map<string, DisponibilidadeEquipeDataV2>(
    input.disponibilidades.flatMap((disponibilidade) => {
      const equipe = normalizarEquipe(disponibilidade.equipe)
      return equipe
        ? [[`${disponibilidade.dataISO}::${equipe}`, disponibilidade] as const]
        : []
    })
  )
  const alvos = input.slotsAlvo ?? input.janelaDatas.flatMap((dia) => equipes.map((equipe) => ({ dataISO: dia.dataISO, equipe })))
  for (const alvo of alvos) {
    const dataDia = { dataISO: alvo.dataISO }
    const equipe = normalizarEquipe(alvo.equipe) ?? alvo.equipe
    const disponibilidade = disponibilidadePorSlot.get(`${dataDia.dataISO}::${equipe}`)
    slots.push({
      dataISO: dataDia.dataISO,
      equipe,
      linhasAgenda: input.linhasAgenda,
      disponibilidade: disponibilidade
        ? {
            tempoUtilizadoMin: disponibilidade.tempoUtilizadoMin,
            disponivelMin: disponibilidade.disponivelMin,
            capacidadeTotalMin: disponibilidade.capacidadeTotalMin,
          }
        : null,
      cacheCoordenadasPorEndereco: input.cacheCoordenadasPorEndereco,
    })
  }
  return slots
}
