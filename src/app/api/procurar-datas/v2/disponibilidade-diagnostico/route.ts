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

// ─── ID diagnóstico de fallback ───────────────────────────────────────────────
// Usado somente se a config não retornar um spreadsheetId válido.
// Deve virar config permanente no Supabase/planilha quando disponível.
const PLANILHA_ID_DIAGNOSTICO_FALLBACK = '1H8mFLzEL8XcFh0UX_hOJF-ublRZcdbhwLc7ooNEeJ5U'
const ABA_NOME_DIAGNOSTICO = 'TEMPO DISPONIVEL'
const LIMITE_PADRAO = 200
const AMOSTRA_PADRAO = 20

// ─── Rota ─────────────────────────────────────────────────────────────────────

/**
 * GET /api/procurar-datas/v2/disponibilidade-diagnostico
 *
 * Query params:
 *   ?limite=200   — máximo de linhas de dados a ler (padrão: 200)
 *   ?amostra=20   — quantas disponibilidades parseadas retornar na amostra (padrão: 20)
 */
export async function GET(request: NextRequest) {
  const inicio = Date.now()

  try {
    const acesso = await validarAcessoProcurarDatas()
    if (acesso.response) return acesso.response

    const { searchParams } = new URL(request.url)
    const limite = Math.min(Math.max(parseInt(searchParams.get('limite') ?? '', 10) || LIMITE_PADRAO, 1), 500)
    const tamAmostra = Math.min(Math.max(parseInt(searchParams.get('amostra') ?? '', 10) || AMOSTRA_PADRAO, 1), 100)

    // ── 1. Carregar config para obter planilhaDeTempoDisponivel ──────────────
    let spreadsheetId = PLANILHA_ID_DIAGNOSTICO_FALLBACK
    let origemPlanilhaId: 'config' | 'fallback-diagnostico' = 'fallback-diagnostico'
    let configErro: string | null = null

    const configResult = await buscarConfiguracoesProcurarDatas()
    if (configResult.ok) {
      const idDaConfig = configResult.config.planilhaDeTempoDisponivel?.trim()
      if (idDaConfig && idDaConfig.length > 10) {
        spreadsheetId = idDaConfig
        origemPlanilhaId = 'config'
      } else {
        configErro =
          'planilhaDeTempoDisponivel ausente ou muito curta na config — usando fallback diagnóstico.'
      }
    } else {
      configErro = `Config não carregada (${configResult.erro ?? 'erro desconhecido'}) — usando fallback diagnóstico.`
    }

    const avisos: string[] = [
      'Rota diagnóstica. Não usada pelo frontend.',
      'Não altera produção.',
      'Não substitui Apps Script.',
      'Não altera agenda ou planilha.',
    ]

    if (configErro) avisos.push(configErro)

    // ── 2. Ler planilha ───────────────────────────────────────────────────────
    const leituraResult = await lerPlanilhaTempoDisponivel({
      spreadsheetId,
      abaNome: ABA_NOME_DIAGNOSTICO,
      limite,
    })

    if (!leituraResult.ok) {
      return NextResponse.json(
        {
          ok: false,
          modo: 'diagnostico-planilha-tempo-disponivel',
          origem: {
            tipo: origemPlanilhaId === 'config' ? 'google-sheets' : 'nao-confirmado',
            planilhaId: spreadsheetId,
            abaNome: ABA_NOME_DIAGNOSTICO,
            origemId: origemPlanilhaId,
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

    // ── 4. Parsear disponibilidades ───────────────────────────────────────────
    const parserResult = parsearDisponibilidadeTempoDisponivelV2({
      linhas: conversao.linhas,
    })

    const amostra = parserResult.disponibilidades.slice(0, tamAmostra)

    const duracaoMs = Date.now() - inicio

    return NextResponse.json(
      {
        ok: parserResult.ok,
        modo: 'diagnostico-planilha-tempo-disponivel',
        producaoAfetada: false,
        duracaoMs,
        origem: {
          tipo: 'google-sheets' as const,
          planilhaId: spreadsheetId,
          abaNome: ABA_NOME_DIAGNOSTICO,
          origemId: origemPlanilhaId,
        },
        leitura: {
          ok: true,
          linhasLidas: conversao.linhasLidas,
          cabecalhoEncontrado: conversao.cabecalhoEncontrado,
          cabecalhoReconhecido: conversao.cabecalhoReconhecido,
          linhasConvertidas: conversao.linhasConvertidas,
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
