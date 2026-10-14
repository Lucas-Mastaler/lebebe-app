import type { FreteCandidatoLegadoInput } from './adaptar-saida-v2-para-legado'
import { calcularFrete, type EtapaCalculoFrete } from './frete'
import type { MemoriaFreteCandidatoV1 } from './memoria-frete'
import type { CandidatoFinalPesquisarDatasV2 } from './pesquisar-datas-v2'
import type { FreteInput, FreteParams } from './types'

type TipoFreteLegado = NonNullable<FreteInput['tipo']>

export interface MontarFretesLegadoPorDistKmInput {
  candidatos: CandidatoFinalPesquisarDatasV2[]
  distKm: number | null | undefined
  isRural: boolean
  isCondominio: boolean
  params: FreteParams
  valorAdicionalEspecial: number
  valorAdicionalPremium: number
  horaMarcadaValorAdicional: number
}

export interface MontarFretesLegadoPorDistKmOutput {
  fretes: FreteCandidatoLegadoInput[]
  avisos: string[]
  memorias: MemoriaFreteCandidatoV1[]
}

function extrairDataBase(dataISO: string): string {
  return dataISO.split('T')[0] ?? dataISO
}

function obterDiaSemana(dataISO: string): number | null {
  const match = extrairDataBase(dataISO).match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return null
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))).getUTCDay()
}

function normalizarTipoFrete(tipo: string): TipoFreteLegado | null {
  if (
    tipo === 'normal' ||
    tipo === 'especial' ||
    tipo === 'premium' ||
    tipo === 'hora-marcada'
  ) {
    return tipo
  }
  return null
}

export function montarFretesLegadoPorDistKm(
  input: MontarFretesLegadoPorDistKmInput
): MontarFretesLegadoPorDistKmOutput {
  const avisos: string[] = []
  const fretes: FreteCandidatoLegadoInput[] = []
  const memorias: MemoriaFreteCandidatoV1[] = []

  if (!Number.isFinite(input.distKm) || input.distKm == null || input.distKm < 0) {
    avisos.push('distKm deposito -> destino ausente ou invalido; fretes legados nao foram montados.')
    return { fretes, avisos, memorias }
  }

  for (const candidato of input.candidatos) {
    const tipo = normalizarTipoFrete(candidato.tipo)
    if (!tipo) {
      avisos.push(
        `tipo de candidato desconhecido para frete (${candidato.tipo}) em ${extrairDataBase(candidato.dataISO)} / ${candidato.equipe}.`
      )
      continue
    }

    const diaSemana = obterDiaSemana(candidato.dataISO)
    if (diaSemana === null) {
      avisos.push(`data invalida para calcular frete em ${candidato.dataISO} / ${candidato.equipe}.`)
      continue
    }

    const entradaFrete: FreteInput = {
      distKm: input.distKm,
      isSabado: diaSemana === 6,
      isRural: input.isRural,
      isCondominio: input.isCondominio,
      params: { ...input.params },
      tipo,
      valorAdicionalEspecial: input.valorAdicionalEspecial,
      valorAdicionalPremium: input.valorAdicionalPremium,
      horaMarcadaValorAdicional: input.horaMarcadaValorAdicional,
    }
    const etapas: EtapaCalculoFrete[] = []
    const frete = calcularFrete(entradaFrete, etapas)
    memorias.push({ dataISO: extrairDataBase(candidato.dataISO), equipe: candidato.equipe, tipo: candidato.tipo, entrada: entradaFrete, etapas, resultado: frete })

    fretes.push({
      dataISO: candidato.dataISO,
      equipe: candidato.equipe,
      tipo: candidato.tipo,
      rank: candidato.rank,
      frete: frete.valorFormatado,
    })
  }

  return { fretes, avisos, memorias }
}
