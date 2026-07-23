// ─────────────────────────────────────────────────────────────────────────────
// motor/disponibilidade-real-helper.ts
//   Helper compartilhado para leitura e parse da disponibilidade real
//   da planilha TEMPO DISPONIVEL. Usado por rotas diagnósticas.
//
// NÃO FAZ:
//   - Não escreve na planilha
//   - Não chama Apps Script, CalendarApp, OSRM, Supabase
//   - Não altera produção
//   - Não cria rota
// ─────────────────────────────────────────────────────────────────────────────

import { lerPlanilhaTempoDisponivel } from '../google-sheets-tempo-disponivel'
import { converterTabelaTempoDisponivel } from './leitor-sheets-tempo-disponivel'
import { parsearDisponibilidadeTempoDisponivelV2 } from './parse-disponibilidade-tempo-disponivel'
import type { DisponibilidadeEquipeDataV2 } from './disponibilidade'
import type { MedidorPerformanceV2 } from './performance-diagnostico-v2'

// ─── Constantes da planilha real ─────────────────────────────────────────────

const SPREADSHEET_ID_TEMPO_DISPONIVEL = '1H8mFLzEL8XcFh0UX_hOJF-ublRZcdbhwLc7ooNEeJ5U'
const GID_TEMPO_DISPONIVEL = 65861376
const LIMITE_PADRAO = 200

// ─── Tipos ───────────────────────────────────────────────────────────────────

export type DisponibilidadeRealResult =
  | {
      ok: true
      executado: true
      origem: {
        tipo: 'google-sheets'
        spreadsheetId: string
        gid: number
        abaNomeResolvido: string
        range: string
      }
      parametros: {
        dataInicialISO: string
        origemDataInicialISO: 'entrada' | 'diagnostico-hoje'
        limite: number
      }
      leitura: {
        ok: true
        linhasLidas: number
        linhasConvertidas: number
        cabecalhoReconhecido: boolean
        linhasDisponiveis: number
        truncada: boolean
      }
      parser: {
        ok: boolean
        resumo: {
          linhasRecebidas: number
          linhasValidas: number
          linhasIgnoradas: number
          disponiveis: number
          agendasFechadas: number
          excedidas: number
        }
        avisos: string[]
        erros: string[]
      }
      amostra: DisponibilidadeEquipeDataV2[]
    }
  | {
      ok: false
      executado: true
      erro: string
      origem?: {
        tipo: 'google-sheets'
        spreadsheetId: string
        gid: number
      }
      parametros?: {
        dataInicialISO: string
        origemDataInicialISO: 'entrada' | 'diagnostico-hoje'
      }
    }
  | {
      ok: true
      executado: false
      motivo: string
    }

export interface DisponibilidadeRealComDadosResult {
  diagnostico: DisponibilidadeRealResult
  disponibilidades: DisponibilidadeEquipeDataV2[]
}

// ─── Função principal ───────────────────────────────────────────────────────

/**
 * Lê e parseia a disponibilidade real da planilha TEMPO DISPONIVEL.
 * Usada por rotas diagnósticas para expor dados reais sem afetar produção.
 *
 * @param dataInicialISO Data de referência para inferir ano de datas DD/MM (YYYY-MM-DD)
 * @param limite Máximo de linhas a processar (padrão: 200)
 * @param tamAmostra Quantas disponibilidades retornar na amostra (padrão: 20)
 * @param dataInicialOrigem Origem da dataInicialISO ('entrada' ou 'diagnostico-hoje')
 */
export async function buscarDisponibilidadeRealDiagnostica(
  dataInicialISO: string,
  limite: number = LIMITE_PADRAO,
  tamAmostra: number = 20,
  dataInicialOrigem: 'entrada' | 'diagnostico-hoje' = 'diagnostico-hoje'
): Promise<DisponibilidadeRealResult> {
  const resultado = await buscarDisponibilidadeRealDiagnosticaComDados(
    dataInicialISO,
    limite,
    tamAmostra,
    dataInicialOrigem
  )

  return resultado.diagnostico
}

export async function buscarDisponibilidadeRealDiagnosticaComDados(
  dataInicialISO: string,
  limite: number = LIMITE_PADRAO,
  tamAmostra: number = 20,
  dataInicialOrigem: 'entrada' | 'diagnostico-hoje' = 'diagnostico-hoje',
  medidorPerformance?: MedidorPerformanceV2
): Promise<DisponibilidadeRealComDadosResult> {
  // ── 1. Ler planilha ───────────────────────────────────────────────────────
  const leituraResult = await (medidorPerformance?.medirAsync('google-sheets-disponibilidade-leitura', () =>
    lerPlanilhaTempoDisponivel({
      spreadsheetId: SPREADSHEET_ID_TEMPO_DISPONIVEL,
      gid: GID_TEMPO_DISPONIVEL,
    })
  ) ?? lerPlanilhaTempoDisponivel({
    spreadsheetId: SPREADSHEET_ID_TEMPO_DISPONIVEL,
    gid: GID_TEMPO_DISPONIVEL,
  }))

  if (!leituraResult.ok) {
    return {
      diagnostico: {
        ok: false,
        executado: true,
        erro: leituraResult.erro,
        origem: {
          tipo: 'google-sheets',
          spreadsheetId: SPREADSHEET_ID_TEMPO_DISPONIVEL,
          gid: GID_TEMPO_DISPONIVEL,
        },
        parametros: {
          dataInicialISO,
          origemDataInicialISO: dataInicialOrigem,
        },
      },
      disponibilidades: [],
    }
  }

  // ── 2. Converter tabela para LinhaTempoDisponivelV2[] ────────────────────
  const inicioParseMs = typeof performance !== 'undefined' ? performance.now() : Date.now()
  const conversao = converterTabelaTempoDisponivel(leituraResult.tabela)

  // ── 3. Limitar linhas antes do parser ─────────────────────────────────────
  const linhasLimitadas = conversao.linhas.slice(0, limite)

  // ── 4. Parsear disponibilidades ────────────────────────────────────────────
  const parserResult = parsearDisponibilidadeTempoDisponivelV2({
    linhas: linhasLimitadas,
    dataInicialISO,
  })
  medidorPerformance?.registrarEtapa(
    'google-sheets-disponibilidade-parse',
    (typeof performance !== 'undefined' ? performance.now() : Date.now()) - inicioParseMs,
    linhasLimitadas.length
  )

  const amostra = parserResult.disponibilidades.slice(0, tamAmostra)

  return {
    diagnostico: {
      ok: true,
      executado: true,
      origem: {
        tipo: 'google-sheets',
        spreadsheetId: leituraResult.planilhaId,
        gid: leituraResult.gid,
        abaNomeResolvido: leituraResult.abaNomeResolvido,
        range: leituraResult.range,
      },
      parametros: {
        dataInicialISO,
        origemDataInicialISO: dataInicialOrigem,
        limite,
      },
      leitura: {
        ok: true,
        linhasLidas: conversao.linhasLidas,
        linhasConvertidas: conversao.linhasConvertidas,
        cabecalhoReconhecido: conversao.cabecalhoReconhecido,
        linhasDisponiveis: conversao.linhas.length,
        truncada: conversao.linhas.length > linhasLimitadas.length,
      },
      parser: {
        ok: parserResult.ok,
        resumo: parserResult.resumo,
        avisos: parserResult.avisos,
        erros: parserResult.erros,
      },
      amostra,
    },
    disponibilidades: parserResult.disponibilidades,
  }
}
