// ─────────────────────────────────────────────────────────────────────────────
// GET /api/procurar-datas/v2/comparar
//
// Rota diagnóstica de comparação estrutural entre fixtures reais do legado
// e o contrato esperado do v2.
//
// NÃO FAZ:
//   - Não chama Apps Script
//   - Não chama /api/procurar-datas/pesquisar
//   - Não chama OSRM
//   - Não chama Google Calendar
//   - Não consulta Supabase
//   - Não altera produção
//   - Não é usada pelo frontend
//   - Não compara datas finais como se v2 já fosse equivalente operacional
//
// Lê fixtures do sistema de arquivos local (docs/fixtures/procurar-datas/legado/).
// Retorna comparação estrutural de cada fixture disponível.
//
// ACESSO: somente usuários comerciais autorizados (mesmo padrão das rotas atuais).
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse } from 'next/server'
import path from 'path'
import fs from 'fs'
import { validarAcessoProcurarDatas, respostaErroProcurarDatas } from '@/lib/procurar-datas/api'
import { compararFixtureLegadoComContratoV2 } from '@/lib/procurar-datas/motor/comparacao-legado-v2'
import {
  adaptarCandidatoV2ParaContratoLegadoDiagnostico,
  type CandidatoLegadoDiagnosticoV2,
} from '@/lib/procurar-datas/motor/adaptador-candidato-legado'
import type { CandidatoPreliminarV2 } from '@/lib/procurar-datas/motor/candidato'

export const runtime = 'nodejs'
export const maxDuration = 30

const FIXTURES_DISPONIVEIS = [
  'caso-normal-simples-2026-06-12',
  'caso-premium-ou-especial-2026-06-12',
] as const

const DATA_REFERENCIA_ADAPTER_V2 = '2026-06-12'

type TipoCandidatoSintetico = CandidatoPreliminarV2['tipo']

export interface DiagnosticoAdapterV2Comparar {
  executado: true
  modo: 'sintetico'
  aviso: string
  dataReferenciaISO: string
  quantidadeCandidatosAdaptados: number
  tiposDemonstrados: TipoCandidatoSintetico[]
  amostra: CandidatoLegadoDiagnosticoV2[]
}

function carregarFixture(
  nomeFixture: string
): { ok: true; dados: unknown } | { ok: false; erro: string } {
  try {
    const caminhoAbsoluto = path.resolve(
      process.cwd(),
      'docs',
      'fixtures',
      'procurar-datas',
      'legado',
      `${nomeFixture}.json`
    )
    const conteudo = fs.readFileSync(caminhoAbsoluto, 'utf-8')
    return { ok: true, dados: JSON.parse(conteudo) as unknown }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return { ok: false, erro: msg }
  }
}

function criarCandidatoV2Sintetico(
  overrides: Pick<CandidatoPreliminarV2, 'id' | 'tipo' | 'dataISO' | 'indice' | 'diaSemana' | 'ehSabado' | 'ehDomingo' | 'frete' | 'distancia'> &
    Partial<Pick<CandidatoPreliminarV2, 'equipe' | 'elegivel' | 'operacional' | 'motivos' | 'avisos'>>
): CandidatoPreliminarV2 {
  const elegivel = overrides.elegivel ?? true
  const tipo = overrides.tipo

  return {
    id: overrides.id,
    elegivel,
    tipo,
    dataISO: overrides.dataISO,
    indice: overrides.indice,
    diaSemana: overrides.diaSemana,
    ehSabado: overrides.ehSabado,
    ehDomingo: overrides.ehDomingo,
    equipe: overrides.equipe ?? 'EQUIPE 1',
    operacional: overrides.operacional ?? {
      ativa: true,
      disponivelMin: 240,
      suficienteParaServico: true,
      tempoNecessarioMin: 60,
    },
    distancia: overrides.distancia,
    frete: overrides.frete,
    motivos: overrides.motivos ?? [],
    avisos: overrides.avisos ?? [],
    diagnostico: {
      origem: 'v2-preliminar',
      classificacaoTipo: tipo,
      classificacaoElegivel: elegivel,
    },
  }
}

function criarCandidatosV2SinteticosParaAdapter(): CandidatoPreliminarV2[] {
  return [
    criarCandidatoV2Sintetico({
      id: 'v2-sintetico-2026-06-23-equipe-1-normal',
      tipo: 'normal',
      dataISO: '2026-06-23',
      indice: 1,
      diaSemana: 2,
      ehSabado: false,
      ehDomingo: false,
      distancia: { distanciaKm: 8, kmAdicionalNaRotaM: 3000 },
      frete: { valorFrete: 110, tipoFrete: 'fixo' },
    }),
    criarCandidatoV2Sintetico({
      id: 'v2-sintetico-2026-06-30-equipe-1-premium',
      tipo: 'premium',
      dataISO: '2026-06-30',
      indice: 2,
      diaSemana: 2,
      ehSabado: false,
      ehDomingo: false,
      distancia: { distanciaKm: 24, kmAdicionalNaRotaM: 12000 },
      frete: { valorFrete: 320, tipoFrete: 'premium' },
      motivos: ['Candidato sintetico para demonstrar adapter premium.'],
    }),
    criarCandidatoV2Sintetico({
      id: 'v2-sintetico-2026-07-24-equipe-1-especial',
      tipo: 'especial',
      dataISO: '2026-07-24',
      indice: 3,
      diaSemana: 5,
      ehSabado: false,
      ehDomingo: false,
      distancia: { distanciaKm: 18, kmAdicionalNaRotaM: 8000 },
      frete: { valorFrete: 220, tipoFrete: 'especial' },
      motivos: ['Candidato sintetico para demonstrar adapter especial.'],
    }),
    criarCandidatoV2Sintetico({
      id: 'v2-sintetico-2026-07-25-equipe-2-hora-marcada',
      tipo: 'hora-marcada',
      dataISO: '2026-07-25',
      indice: 4,
      diaSemana: 6,
      ehSabado: true,
      ehDomingo: false,
      equipe: 'EQUIPE 2',
      distancia: { distanciaKm: 12, kmAdicionalNaRotaM: 5000 },
      frete: { valorFrete: 200, tipoFrete: 'hora-marcada' },
      avisos: ['Hora marcada ainda nao foi verificada por fixture real.'],
    }),
  ]
}

export function gerarDiagnosticoAdapterV2Comparar(): DiagnosticoAdapterV2Comparar {
  const candidatosSinteticos = criarCandidatosV2SinteticosParaAdapter()
  const amostra = candidatosSinteticos.map((candidato, index) =>
    adaptarCandidatoV2ParaContratoLegadoDiagnostico({
      candidato,
      rank: index + 1,
      dataReferenciaISO: DATA_REFERENCIA_ADAPTER_V2,
    })
  )

  return {
    executado: true,
    modo: 'sintetico',
    aviso:
      'Candidatos v2 adaptados sao sinteticos/diagnosticos. Nao comparam equivalencia operacional real.',
    dataReferenciaISO: DATA_REFERENCIA_ADAPTER_V2,
    quantidadeCandidatosAdaptados: amostra.length,
    tiposDemonstrados: candidatosSinteticos.map((candidato) => candidato.tipo),
    amostra,
  }
}

/**
 * GET /api/procurar-datas/v2/comparar
 *
 * Lê as fixtures reais/controladas do legado do sistema de arquivos local
 * e retorna a comparação estrutural de cada uma.
 *
 * Modo: "fixtures" — não chama Apps Script, não compara equivalência operacional final.
 */
export async function GET() {
  try {
    const acesso = await validarAcessoProcurarDatas()
    if (acesso.response) return acesso.response

    const comparacoes: ReturnType<typeof compararFixtureLegadoComContratoV2>[] = []
    const errosCarregamento: string[] = []

    for (const nomeFixture of FIXTURES_DISPONIVEIS) {
      const resultado = carregarFixture(nomeFixture)
      if (!resultado.ok) {
        errosCarregamento.push(
          `Falha ao carregar fixture "${nomeFixture}": ${resultado.erro}`
        )
        continue
      }
      comparacoes.push(
        compararFixtureLegadoComContratoV2({
          nomeFixture,
          fixtureLegado: resultado.dados,
        })
      )
    }

    const todasOk = comparacoes.length > 0 && comparacoes.every((c) => c.ok)
    const diagnosticoAdapterV2 = gerarDiagnosticoAdapterV2Comparar()

    return NextResponse.json(
      {
        ok: todasOk,
        versao: 'v2-comparar',
        modo: 'fixtures',
        producaoAfetada: false,
        comparacoes: comparacoes.map((c) => ({
          nomeFixture: c.nomeFixture,
          ok: c.ok,
          resumo: c.resumo,
          contratoLegado: c.contratoLegado,
          diferencas: c.diferencas,
          avisos: c.avisos,
        })),
        diagnosticoAdapterV2,
        errosCarregamento,
        avisos: [
          'diagnosticoAdapterV2 usa candidatos v2 sinteticos apenas para demonstrar formato adaptado ao contrato legado.',
          'Nao ha comparacao operacional final entre datas reais do legado e candidatos v2.',
          'v2 ainda nao usa disponibilidade real nem OSRM real neste bloco.',
          'Hora marcada ainda nao foi verificada por fixture real.',
          'Comparação estrutural baseada em fixtures. Não chama Apps Script e não compara equivalência operacional final.',
          'Fixtures carregadas do sistema de arquivos local (docs/fixtures/procurar-datas/legado/).',
          'v2 ainda usa disponibilidade sintética, Haversine diagnóstico e não consulta agenda real.',
          'Esta rota é diagnóstica. Não é usada pelo frontend e não substitui o motor legado.',
        ],
      },
      { status: 200 }
    )
  } catch (error: unknown) {
    console.error('[PROCURAR-DATAS][v2/comparar] erro:', error)
    return respostaErroProcurarDatas(error)
  }
}
