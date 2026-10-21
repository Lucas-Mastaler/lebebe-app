import type { Comparison, FlowDashboard } from './fluxo-lojas'

// Somente a última medição do mesmo escopo autorizado. Pranchetas sempre são as novas.
export function retainLastMeasurement<T extends FlowDashboard>(previous: T | null, incoming: T): T {
  if (!previous || !previous.externo.fetchedAt || incoming.resumo.grupos !== null
    || !['auth_error','rate_limited','timeout','unavailable','invalid_response','partial'].includes(incoming.externo.state)
    || JSON.stringify(previous.filtros) !== JSON.stringify(incoming.filtros)
    || previous.unidades.map(unit=>unit.id).sort().join() !== incoming.unidades.map(unit=>unit.id).sort().join()) return incoming
  const preserve = (row: Comparison, old?: Comparison): Comparison => ({ ...row, grupos: old?.grupos ?? null,
    gruposObservados: old?.gruposObservados ?? 0, cobertura: old?.grupos === null || !old ? 'missing' : 'partial', diferenca: null })
  return { ...incoming, resumo: preserve(incoming.resumo,previous.resumo),
    porFilial: incoming.porFilial.map(row=>preserve(row,previous.porFilial.find(old=>old.chave===row.chave))),
    porHora: incoming.porHora.map(row=>preserve(row,previous.porHora.find(old=>old.chave===row.chave))),
    diario: previous.diario, externo: { ...incoming.externo, fetchedAt: previous.externo.fetchedAt,
      warnings: [...incoming.externo.warnings,'Última medição conhecida, desatualizada; a atualização externa falhou.'] } }
}
