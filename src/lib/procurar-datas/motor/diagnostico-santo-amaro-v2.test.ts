import { describe, expect, it } from 'vitest'
import type { CandidatoPreliminarV2 } from './candidato'
import type { DetalheSlotMapaKmAdicional } from './calcular-mapa-km-adicional-por-slot'
import { recortarCandidatosLegadoEquivalente } from './recortar-candidatos-legado-equivalente'
import { montarDiagnosticoSantoAmaroV2 } from './diagnostico-santo-amaro-v2'

function candidato(dataISO: string, tipo: CandidatoPreliminarV2['tipo']): CandidatoPreliminarV2 {
  return {
    id: `v2-${dataISO}-equipe-1-${tipo}`,
    elegivel: true,
    tipo,
    horaMarcada: false,
    elegivelHoraMarcada: false,
    dataISO,
    indice: 0,
    diaSemana: 5,
    ehSabado: false,
    ehDomingo: false,
    slotTemPontos: true,
    equipe: 'EQUIPE 1',
    operacional: {
      ativa: true,
      disponivelMin: 180,
      suficienteParaServico: true,
      tempoNecessarioMin: 125,
      slotAvailMin: 180,
      serviceMin: 125,
    },
    distancia: {
      distanciaKm: 4.1,
      kmAdicionalNaRotaM: tipo === 'normal' ? 1200 : 6400,
      origemKmAdicional: 'slot',
      chaveSlotKm: `${dataISO}::EQUIPE 1`,
    },
    frete: {
      valorFrete: tipo === 'normal' ? 170 : 270,
      tipoFrete: tipo,
    },
    motivos: [],
    avisos: [],
    limites: {
      limiteBaseM: 2000,
      limiteEspecialM: 8000,
      limitePremiumM: 15000,
    },
    diagnostico: {
      origem: 'v2-preliminar',
      classificacaoTipo: tipo,
      classificacaoElegivel: true,
      horaMarcada: false,
      elegivelHoraMarcada: false,
      motivoHoraMarcada: null,
      horaMarcadaHorasAMais: 2,
      limiteMinimoHoraMarcadaMin: 245,
      horaMarcadaCalculadaPorTempo: true,
    },
  }
}

function detalhe(dataISO: string): DetalheSlotMapaKmAdicional {
  return {
    chave: `${dataISO}::EQUIPE 1`,
    dataISO,
    equipe: 'EQUIPE 1',
    equipeNormalizada: 'EQUIPE 1',
    kmAdicionalNaRotaM: 6400,
    ok: true,
    origemKmAdicionalNaRotaM: 'osrm-table-diagnostico',
    avisos: [],
    erros: [],
    descartados: [],
    parseAgenda: {
      ok: true,
      pontos: [],
      resumo: {
        linhasRecebidas: 2,
        linhasDaData: 2,
        linhasDaEquipe: 2,
        pontosValidos: 2,
        pontosDescartados: 0,
        semEndereco: 0,
        semCoordenadas: 0,
      },
      avisos: [],
      erros: [],
      descartados: [],
    },
    deltaInsercao: {
      ok: true,
      modo: 'matriz-distancia-diagnostico',
      kmAdicionalNaRotaM: 6400,
      origemKmAdicionalNaRotaM: 'matriz-distancia-diagnostico',
      melhorInsercao: { entre: ['origem', 'agenda-1'], deltaM: 6400 },
      candidatosInsercao: [{ entre: ['origem', 'agenda-1'], deltaM: 6400 }],
      pontosRotaBase: [{ id: 'origem', tipo: 'origem', lat: -25.48, lng: -49.26 }],
      resumo: {},
      avisos: [],
      erros: [],
      descartados: [],
    },
  } as unknown as DetalheSlotMapaKmAdicional
}

describe('montarDiagnosticoSantoAmaroV2', () => {
  it('explica slots alvo antes/depois do recorte sem inventar filtro early legado', () => {
    const candidatos = [
      candidato('2026-07-02', 'especial'),
      candidato('2026-07-10', 'normal'),
      candidato('2026-07-25', 'normal'),
      candidato('2026-07-31', 'normal'),
      candidato('2026-08-05', 'normal'),
    ]
    const recorte = recortarCandidatosLegadoEquivalente({ candidatos })

    const diagnostico = montarDiagnosticoSantoAmaroV2({
      disponibilidadePorJanela: {
        ok: true,
        datas: [
          {
            dataISO: '2026-07-02',
            indice: 0,
            diaSemana: 4,
            ehSabado: false,
            ehDomingo: false,
            equipes: [
              {
                equipe: 'EQUIPE 1',
                disponivelMin: 180,
                suficienteParaServico: true,
                ativa: true,
                motivoIndisponibilidade: null,
              },
            ],
          },
        ],
        avisos: [],
      },
      candidatosAntesRecorte: candidatos,
      recorte,
      detalhesPorSlot: [detalhe('2026-07-02'), detalhe('2026-07-16')],
    })

    const slots = diagnostico.slots as Array<Record<string, unknown>>
    const slot0207 = slots.find((slot) => slot.dataISO === '2026-07-02') as {
      candidato: { entrouAntesRecorte: boolean; entrouDepoisRecorte: boolean }
      filtroEarlyHaversine: { aplicadoNaV2: boolean; resultado: string }
      osrmDelta: { melhorInsercao: unknown }
    }
    const slot1607 = slots.find((slot) => slot.dataISO === '2026-07-16') as {
      candidato: { gerado: boolean; entrouDepoisRecorte: boolean }
      osrmDelta: { melhorInsercao: unknown }
      classificacao: { tipo: string | null }
    }
    const slot0508 = slots.find((slot) => slot.dataISO === '2026-08-05') as {
      candidato: {
        entrouAntesRecorte: boolean
        entrouDepoisRecorte: boolean
        motivosRemocaoRecorte: string[]
        excluidoNoRecorte: boolean
        motivoRemovidoPorMaxNormal: { motivo: string } | null
      }
    }
    const recorteDiagnostico = diagnostico.recorte as {
      candidatosSelecionados: Array<{ dataISO: string; tipo: string }>
      exclusoesPorDataAlvo: Array<{ dataISO: string; exclusoes: Array<{ motivo: string }> }>
    }

    expect(slots.map((slot) => slot.dataISO)).toEqual([
      '2026-07-02',
      '2026-07-10',
      '2026-07-16',
      '2026-07-24',
      '2026-07-25',
      '2026-07-31',
      '2026-08-05',
      '2026-08-08',
    ])
    expect(slot0207.candidato.entrouAntesRecorte).toBe(true)
    expect(slot0207.candidato.entrouDepoisRecorte).toBe(true)
    expect(slot0207.filtroEarlyHaversine).toEqual({
      aplicadoNaV2: false,
      distanciaRetaKm: null,
      limiteUsadoM: null,
      resultado: 'indisponivel-na-v2',
      pendencia:
        'O caminho v2 lido nao calcula filtro early Haversine/ancora do legado; a classificacao usa kmAdicionalNaRotaM por slot.',
    })
    expect(slot0207.osrmDelta.melhorInsercao).not.toBeNull()
    expect(slot1607.candidato.gerado).toBe(false)
    expect(slot1607.candidato.entrouDepoisRecorte).toBe(false)
    expect(slot1607.classificacao.tipo).toBeNull()
    expect(slot1607.osrmDelta.melhorInsercao).not.toBeNull()
    expect(slot0508.candidato.entrouAntesRecorte).toBe(true)
    expect(slot0508.candidato.entrouDepoisRecorte).toBe(false)
    expect(slot0508.candidato.excluidoNoRecorte).toBe(true)
    expect(slot0508.candidato.motivosRemocaoRecorte).toContain('limite-normais-atingido')
    expect(slot0508.candidato.motivoRemovidoPorMaxNormal?.motivo).toBe('limite-normais-atingido')
    expect(recorteDiagnostico.candidatosSelecionados.map((c) => `${c.dataISO}:${c.tipo}`)).toEqual([
      '2026-07-02:especial',
      '2026-07-10:normal',
      '2026-07-25:normal',
      '2026-07-31:normal',
    ])
    expect(recorteDiagnostico.exclusoesPorDataAlvo.find((item) => item.dataISO === '2026-08-05')?.exclusoes[0].motivo).toBe(
      'limite-normais-atingido'
    )
  })
})
