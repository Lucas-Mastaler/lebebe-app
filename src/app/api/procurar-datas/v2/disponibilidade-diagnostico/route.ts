// ─────────────────────────────────────────────────────────────────────────────
// GET /api/procurar-datas/v2/disponibilidade-diagnostico
//
// Rota diagnóstica isolada: lê a planilha real TEMPO DISPONIVEL via Google
// Sheets API, converte as linhas brutas e valida o parser puro
// parsearDisponibilidadeTempoDisponivelV2().
//
// NÃO FAZ:
//   - Não escreve na planilha
//   - Não chama Apps Script
//   - Não chama obterDisponibilidadeEquipe()
//   - Não chama CalendarApp
//   - Não altera produção
//   - Não integra no frontend
//   - Não altera /api/procurar-datas/v2/diagnostico
//   - Não recalcula disponibilidade
//
// ACESSO: somente usuários comerciais autorizados (mesmo padrão das rotas atuais).
// ─────────────────────────────────────────────────────────────────────────────

import { type NextRequest, NextResponse } from 'next/server'
import { validarAcessoProcurarDatas, respostaErroProcurarDatas } from '@/lib/procurar-datas/api'
import { buscarConfiguracoesProcurarDatas } from '@/lib/procurar-datas/config-service'
import { lerPlanilhaTempoDisponivel } from '@/lib/procurar-datas/google-sheets-tempo-disponivel'
import { converterTabelaTempoDisponivel } from '@/lib/procurar-datas/motor/leitor-sheets-tempo-disponivel'
import { parsearDisponibilidadeTempoDisponivelV2 } from '@/lib/procurar-datas/motor/parse-disponibilidade-tempo-disponivel'

export const runtime = 'nodejs'
export const maxDuration = 30

// ─── Constantes diagnósticas confirmadas manualmente ────────────────────────
//
// ATENÇÃO: a config (planilhaDeTempoDisponivel) armazena o NOME LÓGICO da
// planilha (ex: 'TEMPO DISPONIVEL POR EQUIPE'), não o spreadsheetId real.
// O ID real abaixo foi confirmado manualmente pelo usuário a partir da URL:
//   https://docs.google.com/spreadsheets/d/1H8mFLzEL8XcFh0UX_hOJF-ublRZcdbhwLc7ooNEeJ5U
//
// Futuramente deve virar uma config normalizada com o ID real,
// não o nome lógico da planilha.
const SPREADSHEET_ID_TEMPO_DISPONIVEL = '1H8mFLzEL8XcFh0UX_hOJF-ublRZcdbhwLc7ooNEeJ5U'
const GID_TEMPO_DISPONIVEL = 65861376
const LIMITE_PADRAO = 200
const AMOSTRA_PADRAO = 20

// ─── Rota ─────────────────────────────────────────────────────────────────────

/**
 * GET /api/procurar-datas/v2/disponibilidade-diagnostico
 *
 * Query params:
 *   ?limite=200           — máximo de linhas de dados a processar (padrão: 200)
 *   ?amostra=20           — quantas disponibilidades parseadas retornar na amostra (padrão: 20)
 *   ?dataInicialISO=YYYY-MM-DD — data de referência para inferir ano de datas DD/MM (padrão: hoje)
 */
export async function GET(request: NextRequest) {
  const inicio = Date.now()

  try {
    const acesso = await validarAcessoProcurarDatas()
    if (acesso.response) return acesso.response

    const { searchParams } = new URL(request.url)
    const limite = Math.min(Math.max(parseInt(searchParams.get('limite') ?? '', 10) || LIMITE_PADRAO, 1), 500)
    const tamAmostra = Math.min(Math.max(parseInt(searchParams.get('amostra') ?? '', 10) || AMOSTRA_PADRAO, 1), 100)

    // ── 0. Resolver dataInicialISO ─────────────────────────────────────────────
    const dataInicialParam = searchParams.get('dataInicialISO')?.trim()
    const hoje = new Date()
    const hojeISO = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`
    const dataInicialISO = /^\d{4}-\d{2}-\d{2}$/.test(dataInicialParam ?? '') ? dataInicialParam! : hojeISO
    const origemDataInicialISO: 'query' | 'diagnostico-hoje' = dataInicialParam && /^\d{4}-\d{2}-\d{2}$/.test(dataInicialParam) ? 'query' : 'diagnostico-hoje'

    // ── 1. Carregar config — obter nome lógico para diagnóstico ───────────────
    //
    // NOTA: planilhaDeTempoDisponivel retorna o NOME LÓGICO da planilha
    // (ex: 'TEMPO DISPONIVEL POR EQUIPE'), não o spreadsheetId real.
    // O spreadsheetId real é sempre SPREADSHEET_ID_TEMPO_DISPONIVEL (constante).
    const spreadsheetId = SPREADSHEET_ID_TEMPO_DISPONIVEL
    let nomeLogicoConfig: string | null = null
    let origemId: 'fallback-diagnostico-confirmado' | 'fallback-diagnostico' =
      'fallback-diagnostico-confirmado'
    let configErro: string | null = null

    const configResult = await buscarConfiguracoesProcurarDatas()
    if (configResult.ok) {
      nomeLogicoConfig = configResult.config.planilhaDeTempoDisponivel?.trim() || null
    } else {
      configErro = `Config não carregada (${configResult.erro ?? 'erro desconhecido'}) — spreadsheetId real usado via constante diagnóstica.`
      origemId = 'fallback-diagnostico'
    }

    const avisos: string[] = [
      'Rota diagnóstica. Não usada pelo frontend.',
      'Não altera produção.',
      'Não substitui Apps Script.',
      'Não altera agenda ou planilha.',
    ]

    if (configErro) avisos.push(configErro)

    // ── 2. Ler planilha (resolve nome de aba pelo gid/sheetId) ────────────────
    // Range físico: colunas completas A:F (sem limitar linhas na Sheets API).
    // O ?limite da query restringe apenas o processamento/parser/response.
    const leituraResult = await lerPlanilhaTempoDisponivel({
      spreadsheetId,
      gid: GID_TEMPO_DISPONIVEL,
    })

    if (!leituraResult.ok) {
      return NextResponse.json(
        {
          ok: false,
          modo: 'diagnostico-planilha-tempo-disponivel',
          origem: {
            tipo: 'google-sheets' as const,
            origemId,
            nomeLogicoConfig,
            spreadsheetId,
            gid: GID_TEMPO_DISPONIVEL,
            abaNomeResolvido: null,
            range: null,
          },
          leitura: { ok: false, erro: leituraResult.erro },
          avisos,
          duracaoMs: Date.now() - inicio,
        },
        { status: 200 }
      )
    }

    // ── 3. Converter tabela para LinhaTempoDisponivelV2[] ────────────────────
    const conversao = converterTabelaTempoDisponivel(leituraResult.tabela)
    if (conversao.avisos.length > 0) {
      avisos.push(...conversao.avisos)
    }

    // ── 4. Parsear disponibilidades (limitadas pelo query param ?limite) ───────
    const linhasLimitadas = conversao.linhas.slice(0, limite)
    const parserResult = parsearDisponibilidadeTempoDisponivelV2({
      linhas: linhasLimitadas,
      dataInicialISO,
    })

    const amostra = parserResult.disponibilidades.slice(0, tamAmostra)

    const duracaoMs = Date.now() - inicio

    return NextResponse.json(
      {
        ok: parserResult.ok,
        modo: 'diagnostico-planilha-tempo-disponivel',
        producaoAfetada: false,
        duracaoMs,
        parametros: {
          dataInicialISO,
          origemDataInicialISO,
          limite,
          tamAmostra,
        },
        origem: {
          tipo: 'google-sheets' as const,
          origemId,
          nomeLogicoConfig,
          spreadsheetId,
          gid: GID_TEMPO_DISPONIVEL,
          abaNomeResolvido: leituraResult.abaNomeResolvido,
          range: leituraResult.range,
        },
        leitura: {
          ok: true,
          linhasLidas: conversao.linhasLidas,
          cabecalhoEncontrado: conversao.cabecalhoEncontrado,
          cabecalhoReconhecido: conversao.cabecalhoReconhecido,
          linhasConvertidas: conversao.linhasConvertidas,
          gid: leituraResult.gid,
          range: leituraResult.range,
        },
        parser: {
          ok: parserResult.ok,
          resumo: parserResult.resumo,
          avisos: parserResult.avisos,
          erros: parserResult.erros,
        },
        amostra,
        tamAmostra,
        avisos,
      },
      { status: 200 }
    )
  } catch (error: unknown) {
    console.error('[PROCURAR-DATAS][v2/disponibilidade-diagnostico] erro:', error)
    return respostaErroProcurarDatas(error)
  }
}
