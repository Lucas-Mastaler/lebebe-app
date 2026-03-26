import { google } from "googleapis";
import { OAuth2Client } from "google-auth-library";

// ─────────────────────────────────────────────────────────
// 1.0 – Configuração e Autenticação OAuth 2.0 (Usuário)
// ─────────────────────────────────────────────────────────

async function criarClienteSheets() {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_OAUTH_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(
      "Variáveis GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET e GOOGLE_OAUTH_REFRESH_TOKEN são obrigatórias."
    );
  }

  const oauth2Client = new OAuth2Client({
    clientId: clientId,
    clientSecret: clientSecret,
  });

  oauth2Client.setCredentials({
    refresh_token: refreshToken,
  });

  try {
    const { credentials } = await oauth2Client.refreshAccessToken();
    oauth2Client.setCredentials(credentials);
    console.log("[SHEETS SERVICE] ✓ Access token obtido com sucesso");
  } catch (error: any) {
    console.error("[SHEETS SERVICE] ❌ Erro ao fazer refresh do access_token:", error.message);
    throw new Error("Falha ao renovar access token. Verifique o refresh_token.");
  }

  return google.sheets({ version: "v4", auth: oauth2Client });
}

// ─────────────────────────────────────────────────────────
// 2.0 – Dados do Recebimento
// ─────────────────────────────────────────────────────────

export interface DadosRecebimentoPlanilha {
  carimbo: string;
  quem_finalizou: string;
  horario_inicio: string;
  horario_fim: string;
  tempo_total_formatado: string;
  quantidade_chapas: number;
  motorista_ajudou: string;
  quantos_kilos: number;
  quantos_volumes: number;
  problemas_recebimento: string;
  numero_nfs: string;
  problema_proximos_carregamentos: string;
  outros_problemas: string;
}

// ─────────────────────────────────────────────────────────
// 3.0 – Enviar dados para a planilha
// ─────────────────────────────────────────────────────────

const SHEET_NAME = 'Recebimentos';

const HEADERS = [
  'Carimbo de data/hora',
  'Quem finalizou',
  'Horário início do recebimento',
  'Horário fim do recebimento',
  'Tempo total',
  'Quantidade de chapas',
  'Motorista ajudou?',
  'Quantos kilos?',
  'Quantos volumes?',
  'Problemas do recebimento',
  'Números das NF recebidas',
  'Algum problema que deve ser resolvido nos próximos carregamentos?',
  'Outros tipos de problemas',
];

function formatarTempo(segundos: number): string {
  const horas = Math.floor(segundos / 3600);
  const minutos = Math.floor((segundos % 3600) / 60);
  const secs = segundos % 60;
  return `${String(horas).padStart(2, '0')}:${String(minutos).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export interface EnviarPlanilhaResult {
  sucesso: boolean;
  erro?: string;
}

export async function enviarRecebimentoParaPlanilha(
  dados: DadosRecebimentoPlanilha
): Promise<EnviarPlanilhaResult> {
  const spreadsheetId = process.env.GOOGLE_SHEET_RECEBIMENTO_ID;

  if (!spreadsheetId) {
    console.error('[SHEETS SERVICE] ❌ GOOGLE_SHEET_RECEBIMENTO_ID não configurada');
    return { sucesso: false, erro: 'GOOGLE_SHEET_RECEBIMENTO_ID não configurada no servidor' };
  }

  console.log('[SHEETS SERVICE] Iniciando envio para Google Sheets...');
  console.log('[SHEETS SERVICE] Spreadsheet ID:', spreadsheetId);
  console.log('[SHEETS SERVICE] Dados:', JSON.stringify(dados, null, 2));

  try {
    const sheets = await criarClienteSheets();

    // Verificar se a aba existe, se não, criar com cabeçalhos
    const spreadsheet = await sheets.spreadsheets.get({
      spreadsheetId,
    });

    const abaExiste = spreadsheet.data.sheets?.some(
      (s) => s.properties?.title === SHEET_NAME
    );

    if (!abaExiste) {
      console.log(`[SHEETS SERVICE] Aba '${SHEET_NAME}' não encontrada, criando...`);
      
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [
            {
              addSheet: {
                properties: { title: SHEET_NAME },
              },
            },
          ],
        },
      });

      // Adicionar cabeçalhos
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${SHEET_NAME}!A1`,
        valueInputOption: 'RAW',
        requestBody: {
          values: [HEADERS],
        },
      });

      console.log(`[SHEETS SERVICE] ✓ Aba '${SHEET_NAME}' criada com cabeçalhos`);
    }

    // Montar linha de dados
    const row = [
      dados.carimbo,
      dados.quem_finalizou,
      dados.horario_inicio,
      dados.horario_fim,
      dados.tempo_total_formatado,
      dados.quantidade_chapas,
      dados.motorista_ajudou,
      dados.quantos_kilos,
      dados.quantos_volumes,
      dados.problemas_recebimento,
      dados.numero_nfs,
      dados.problema_proximos_carregamentos,
      dados.outros_problemas,
    ];

    // Adicionar linha na planilha
    const appendResult = await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${SHEET_NAME}!A:M`,
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      requestBody: {
        values: [row],
      },
    });

    console.log('[SHEETS SERVICE] ✓ Dados enviados com sucesso para a planilha');
    console.log('[SHEETS SERVICE] Range atualizado:', appendResult.data.updates?.updatedRange);

    return { sucesso: true };

  } catch (error: any) {
    const mensagem = error.message || String(error);
    console.error('[SHEETS SERVICE] ❌ Erro ao enviar para planilha:', mensagem);
    
    if (error.response?.data?.error) {
      console.error('[SHEETS SERVICE] Detalhes:', JSON.stringify(error.response.data.error));
    }

    return { sucesso: false, erro: mensagem };
  }
}
