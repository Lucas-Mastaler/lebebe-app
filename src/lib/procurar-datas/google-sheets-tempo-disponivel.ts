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
  abaNome: string
  limite: number
}

export type LerPlanilhaTempoDisponivelResult =
  | { ok: true; tabela: string[][]; planilhaId: string; abaNome: string }
  | { ok: false; erro: string }

export async function lerPlanilhaTempoDisponivel(
  input: LerPlanilhaTempoDisponivelInput
): Promise<LerPlanilhaTempoDisponivelResult> {
  const { spreadsheetId, abaNome, limite } = input

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

    // Ler cabeçalho + até `limite` linhas de dados (linha 1 = cabeçalho)
    const range = `${abaNome}!A1:F${limite + 1}`

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
      abaNome,
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return { ok: false, erro: `Falha ao ler planilha: ${msg}` }
  }
}
