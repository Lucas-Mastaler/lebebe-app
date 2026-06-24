// ─────────────────────────────────────────────────────────────────────────────
// motor/agenda-real-helper.ts
//   Helper compartilhado para leitura da planilha AGENDA (shAg) em modo diagnóstico.
//   Usado por rotas diagnósticas para expor dados reais de agenda sem afetar produção.
//
// NÃO FAZ:
//   - Não escreve na planilha
//   - Não chama Apps Script, CalendarApp, OSRM
//   - Não altera produção
//   - Não cria rota
// ─────────────────────────────────────────────────────────────────────────────

import { google } from 'googleapis'
import { OAuth2Client } from 'google-auth-library'
import type { LinhaAgendaShAgV2 } from './parse-agenda-shag'

// ─── Constantes da planilha real ─────────────────────────────────────────────

const SPREADSHEET_ID_AGENDA = '1H8mFLzEL8XcFh0UX_hOJF-ublRZcdbhwLc7ooNEeJ5U'
const GID_AGENDA = 14790013 // GID da aba AGENDA
const LIMITE_PADRAO = 2000 // Mais alto que TEMPO DISPONIVEL (agenda tem mais linhas históricas)

// ─── Tipos ───────────────────────────────────────────────────────────────────

export type AgendaRealResult =
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
        limite: number
      }
      leitura: {
        ok: true
        linhasLidas: number
        linhasConvertidas: number
      }
      amostra: LinhaAgendaShAgV2[]
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
        limite: number
      }
      abasDisponiveis?: Array<{ title: string; sheetId: number }>
    }
  | {
      ok: true
      executado: false
      motivo: string
    }

export interface AgendaRealComDadosResult {
  diagnostico: AgendaRealResult
  linhasAgenda: LinhaAgendaShAgV2[]
}

// ─── Funções internas ───────────────────────────────────────────────────────

/**
 * Escapa apóstrofos em nome de aba para uso em range A1.
 * Regra do Google Sheets: apóstrofo simples dentro do nome é duplicado.
 */
function montarRangeA1DaAba(abaNome: string): string {
  const abaEscapada = abaNome.replace(/'/g, "''")
  return `'${abaEscapada}'!A:G`
}

async function criarClienteSheets(): Promise<
  { ok: true; sheets: ReturnType<typeof google.sheets> } | { ok: false; erro: string }
> {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET
  const refreshToken = process.env.GOOGLE_OAUTH_REFRESH_TOKEN

  if (!clientId || !clientSecret || !refreshToken) {
    return {
      ok: false,
      erro: 'Variáveis de ambiente Google OAuth não configuradas (GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, GOOGLE_OAUTH_REFRESH_TOKEN).',
    }
  }

  try {
    const oauth2Client = new OAuth2Client({ clientId, clientSecret })
    oauth2Client.setCredentials({ refresh_token: refreshToken })
    const { credentials } = await oauth2Client.refreshAccessToken()
    oauth2Client.setCredentials(credentials)

    const sheets = google.sheets({ version: 'v4', auth: oauth2Client })
    return { ok: true, sheets }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return { ok: false, erro: `Falha ao autenticar com Google Sheets: ${msg}` }
  }
}

// ─── Função principal ───────────────────────────────────────────────────────

/**
 * Lê a planilha AGENDA (shAg) do Google Sheets.
 * Usada por rotas diagnósticas para expor dados reais de agenda sem afetar produção.
 *
 * @param limite Máximo de linhas a processar (padrão: 2000)
 * @param gidAba GID da aba a usar (padrão: GID_AGENDA)
 */
export async function buscarAgendaRealDiagnostica(
  limite: number = LIMITE_PADRAO,
  gidAba?: number
): Promise<AgendaRealResult> {
  const resultado = await buscarAgendaRealDiagnosticaComDados(limite, gidAba)
  return resultado.diagnostico
}

export async function buscarAgendaRealDiagnosticaComDados(
  limite: number = LIMITE_PADRAO,
  gidAba?: number
): Promise<AgendaRealComDadosResult> {
  const gidEfetivo = typeof gidAba === 'number' && Number.isFinite(gidAba) ? gidAba : GID_AGENDA
  // ── 1. Criar cliente Google Sheets ──────────────────────────────────────────
  const clienteResult = await criarClienteSheets()
  if (!clienteResult.ok) {
    return {
      diagnostico: {
        ok: false,
        executado: true,
        erro: clienteResult.erro,
        origem: {
          tipo: 'google-sheets',
          spreadsheetId: SPREADSHEET_ID_AGENDA,
          gid: gidEfetivo,
        },
        parametros: { limite },
      },
      linhasAgenda: [],
    }
  }

  const sheets = clienteResult.sheets

  // ── 2. Buscar metadados para resolver nome da aba pelo gid ─────────────────
  let abaNomeResolvido: string
  try {
    const metadata = await sheets.spreadsheets.get({
      spreadsheetId: SPREADSHEET_ID_AGENDA,
      fields: 'sheets.properties(sheetId,title)',
    })

    const todasAbas = metadata.data.sheets ?? []
    const aba = todasAbas.find((sheet) => sheet.properties?.sheetId === gidEfetivo)

    if (!aba?.properties?.title) {
      const abasDisponiveis = todasAbas
        .filter((s) => s.properties?.title && s.properties?.sheetId !== undefined)
        .map((s) => ({ title: s.properties!.title!, sheetId: s.properties!.sheetId! }))
      return {
        diagnostico: {
          ok: false,
          executado: true,
          erro: `Aba com gid ${gidEfetivo} nao encontrada na planilha ${SPREADSHEET_ID_AGENDA}.`,
          origem: {
            tipo: 'google-sheets',
            spreadsheetId: SPREADSHEET_ID_AGENDA,
            gid: gidEfetivo,
          },
          parametros: { limite },
          abasDisponiveis,
        },
        linhasAgenda: [],
      }
    }

    abaNomeResolvido = aba.properties.title
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return {
      diagnostico: {
        ok: false,
        executado: true,
        erro: `Falha ao buscar metadados da planilha: ${msg}`,
        origem: {
          tipo: 'google-sheets',
          spreadsheetId: SPREADSHEET_ID_AGENDA,
          gid: gidEfetivo,
        },
        parametros: { limite },
      },
      linhasAgenda: [],
    }
  }

  // ── 3. Ler dados da aba AGENDA ─────────────────────────────────────────────
  try {
    const range = montarRangeA1DaAba(abaNomeResolvido)

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID_AGENDA,
      range,
      valueRenderOption: 'FORMATTED_VALUE',
      dateTimeRenderOption: 'FORMATTED_STRING',
    })

    const valores = response.data.values as string[][] | null | undefined
    const tabelaCompleta = valores ?? []

    // Ignora cabeçalho (primeira linha) e aplica limite
    const linhasSemCabecalho = tabelaCompleta.slice(1)
    const linhasLimitadas = linhasSemCabecalho.slice(0, limite)

    // Converte para formato LinhaAgendaShAgV2 (array de arrays)
    const linhasAgenda: LinhaAgendaShAgV2[] = linhasLimitadas.map((linha) =>
      // Garante que cada linha tenha pelo menos 7 elementos (índices 0-6)
      // Preenche elementos ausentes com string vazia
      Array.from({ length: 7 }, (_, i) => linha[i] ?? '')
    )

    return {
      diagnostico: {
        ok: true,
        executado: true,
        origem: {
          tipo: 'google-sheets',
          spreadsheetId: SPREADSHEET_ID_AGENDA,
          gid: gidEfetivo,
          abaNomeResolvido,
          range,
        },
        parametros: { limite },
        leitura: {
          ok: true,
          linhasLidas: tabelaCompleta.length,
          linhasConvertidas: linhasAgenda.length,
        },
        amostra: linhasAgenda.slice(0, 20), // Amostra para debug
      },
      linhasAgenda,
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return {
      diagnostico: {
        ok: false,
        executado: true,
        erro: `Falha ao ler planilha: ${msg}`,
        origem: {
          tipo: 'google-sheets',
          spreadsheetId: SPREADSHEET_ID_AGENDA,
          gid: gidEfetivo,
        },
        parametros: { limite },
      },
      linhasAgenda: [],
    }
  }
}
