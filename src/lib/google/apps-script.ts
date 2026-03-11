import { google } from "googleapis";
import { OAuth2Client } from "google-auth-library";

// ─────────────────────────────────────────────────────────
// 1.0 – Configuração e Autenticação OAuth 2.0 (Usuário)
// ─────────────────────────────────────────────────────────

async function criarClienteAppsScript() {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_OAUTH_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(
      "Variáveis GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET e GOOGLE_OAUTH_REFRESH_TOKEN são obrigatórias."
    );
  }

  console.log("[APPS SCRIPT SERVICE] Criando OAuth2Client...");

  const oauth2Client = new OAuth2Client({
    clientId: clientId,
    clientSecret: clientSecret,
  });

  oauth2Client.setCredentials({
    refresh_token: refreshToken,
  });

  console.log("[APPS SCRIPT SERVICE] ✓ OAuth2Client configurado com refresh_token");

  try {
    console.log("[APPS SCRIPT SERVICE] Obtendo access_token via refresh...");
    const { credentials } = await oauth2Client.refreshAccessToken();
    oauth2Client.setCredentials(credentials);
    console.log("[APPS SCRIPT SERVICE] ✓ Access token obtido com sucesso");
    console.log(`[APPS SCRIPT SERVICE] Token expira em: ${new Date(credentials.expiry_date || 0).toISOString()}`);
  } catch (error: any) {
    console.error("[APPS SCRIPT SERVICE] ❌ Erro ao fazer refresh do access_token:", error.message);
    throw new Error("Falha ao renovar access token. Verifique o refresh_token.");
  }

  return google.script({ version: "v1", auth: oauth2Client });
}

// ─────────────────────────────────────────────────────────
// 2.0 – Lista de funções permitidas
// ─────────────────────────────────────────────────────────

const FUNCOES_PERMITIDAS = [
  "apiProcurarDatasPorEndereco"
] as const;

type FuncaoPermitida = typeof FUNCOES_PERMITIDAS[number];

export function isFuncaoPermitida(funcao: string): funcao is FuncaoPermitida {
  return FUNCOES_PERMITIDAS.includes(funcao as FuncaoPermitida);
}

// ─────────────────────────────────────────────────────────
// 3.0 – Executar função no Apps Script
// ─────────────────────────────────────────────────────────

export interface ExecutarAppsScriptParams {
  nomeFuncao: string;
  parametros: any[];
  devMode?: boolean;
}

export interface ExecutarAppsScriptResult {
  sucesso: boolean;
  resultado?: any;
  erro?: string;
}

export async function executarAppsScript(
  params: ExecutarAppsScriptParams
): Promise<ExecutarAppsScriptResult> {
  const { nomeFuncao, parametros, devMode = false } = params;

  console.log(`[APPS SCRIPT SERVICE] ========================================`);
  console.log(`[APPS SCRIPT SERVICE] Iniciando execução da função: ${nomeFuncao}`);
  console.log(`[APPS SCRIPT SERVICE] Parâmetros recebidos:`, JSON.stringify(parametros));

  if (!isFuncaoPermitida(nomeFuncao)) {
    console.error(`[APPS SCRIPT SERVICE] ❌ Função não permitida: ${nomeFuncao}`);
    return {
      sucesso: false,
      erro: `Função '${nomeFuncao}' não está na lista de funções permitidas.`
    };
  }

  const deploymentId = process.env.GOOGLE_APPS_SCRIPT_DEPLOYMENT_ID_CEP;
  if (!deploymentId) {
    console.error("[APPS SCRIPT SERVICE] ❌ GOOGLE_APPS_SCRIPT_DEPLOYMENT_ID_CEP não configurado");
    return {
      sucesso: false,
      erro: "Deployment ID não configurado no servidor."
    };
  }

  try {
    const scriptClient = await criarClienteAppsScript();

    console.log(`[APPS SCRIPT SERVICE] Chamando Apps Script API...`);
    console.log(`[APPS SCRIPT SERVICE] Deployment ID: ${deploymentId}`);
    console.log(`[APPS SCRIPT SERVICE] Função: ${nomeFuncao}`);
    console.log(`[APPS SCRIPT SERVICE] Dev Mode: ${devMode}`);

    const response = await scriptClient.scripts.run({
      scriptId: deploymentId,
      requestBody: {
        function: nomeFuncao,
        parameters: parametros,
        devMode: devMode
      }
    });

    console.log(`[APPS SCRIPT SERVICE] ✅ Resposta recebida do Apps Script`);

    if (response.data.error) {
      const errorDetails = response.data.error.details || [];
      const errorMessage = errorDetails.length > 0 
        ? errorDetails[0].errorMessage || "Erro desconhecido"
        : response.data.error.message || "Erro desconhecido";

      console.error(`[APPS SCRIPT SERVICE] ❌ Erro retornado pela função:`, errorMessage);
      console.error(`[APPS SCRIPT SERVICE] Detalhes completos:`, JSON.stringify(response.data.error));

      return {
        sucesso: false,
        erro: errorMessage
      };
    }

    const resultado = response.data.response?.result;
    console.log(`[APPS SCRIPT SERVICE] ✅ Execução bem-sucedida`);
    console.log(`[APPS SCRIPT SERVICE] Resultado:`, JSON.stringify(resultado));

    return {
      sucesso: true,
      resultado: resultado
    };

  } catch (error: any) {
    console.error(`[APPS SCRIPT SERVICE] ❌ Exceção ao executar Apps Script:`, error);
    console.error(`[APPS SCRIPT SERVICE] Stack:`, error.stack);

    let mensagemErro = "Erro ao executar função no Apps Script.";

    if (error.response?.data?.error) {
      mensagemErro = error.response.data.error.message || mensagemErro;
    } else if (error.message) {
      mensagemErro = error.message;
    }

    return {
      sucesso: false,
      erro: mensagemErro
    };
  }
}
