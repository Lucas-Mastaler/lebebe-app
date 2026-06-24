// ─────────────────────────────────────────────────────────────────────────────
// google-sheets-tempo-disponivel.ts
//   Leitura isolada da planilha TEMPO DISPONIVEL via Google Sheets API v4.
//   Usa as mesmas credenciais OAuth2 do projeto (GOOGLE_OAUTH_CLIENT_ID, etc).
//
// NÃO FAZ:
//   - Não escreve na planilha
//   - Não chama Apps Script
//   - Não chama CalendarApp
//   - Não altera produção
// ─────────────────────────────────────────────────────────────────────────────

import { google } from 'googleapis'
import { OAuth2Client } from 'google-auth-library'

export type LerPlanilhaTempoDisponivelInput = {
  spreadsheetId: string
  gid: number
}

export type LerPlanilhaTempoDisponivelResult =
  | {
      ok: true
      tabela: string[][]
      planilhaId: string
      gid: number
      abaNomeResolvido: string
      range: string
    }
  | { ok: false; erro: string }

/**
 * Escapa apóstrofos em nome de aba para uso em range A1.
 * Regra do Google Sheets: apóstrofo simples dentro do nome é duplicado.
 */
function montarRangeA1DaAba(abaNome: string): string {
  const abaEscapada = abaNome.replace(/'/g, "''")
  return `'${abaEscapada}'!A:F`
}

export async function lerPlanilhaTempoDisponivel(
  input: LerPlanilhaTempoDisponivelInput
): Promise<LerPlanilhaTempoDisponivelResult> {
  const { spreadsheetId, gid } = input

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

    // ── 1. Buscar metadados para resolver nome da aba pelo gid/sheetId ──
    const metadata = await sheets.spreadsheets.get({
      spreadsheetId,
      fields: 'sheets.properties(sheetId,title)',
    })

    const aba = metadata.data.sheets?.find(
      (sheet) => sheet.properties?.sheetId === gid
    )

    if (!aba?.properties?.title) {
      return {
        ok: false,
        erro: `Aba com gid ${gid} não encontrada na planilha ${spreadsheetId}.`,
      }
    }

    const abaNomeResolvido = aba.properties.title

    // ── 2. Montar range A1 escapado e ler valores ──
    const range = montarRangeA1DaAba(abaNomeResolvido)

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
      valueRenderOption: 'FORMATTED_VALUE',
      dateTimeRenderOption: 'FORMATTED_STRING',
    })

    const valores = response.data.values as string[][] | null | undefined

    return {
      ok: true,
      tabela: valores ?? [],
      planilhaId: spreadsheetId,
      gid,
      abaNomeResolvido,
      range,
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return { ok: false, erro: `Falha ao ler planilha: ${msg}` }
  }
}
