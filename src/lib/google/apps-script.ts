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
// 2.5 – Reparo de double-encoding UTF-8
// ─────────────────────────────────────────────────────────

/**
 * Detecta e corrige strings com double-encoding UTF-8.
 * Padrão: bytes UTF-8 interpretados como Latin-1, ex: "SÃ¡bado" → "Sábado"
 * Aplica recursivamente em objetos e arrays.
 */
function repararDoubleEncodingUTF8(valor: any): any {
  if (valor === null || valor === undefined) return valor;

  if (typeof valor === "string") {
    return repararStringUTF8(valor);
  }

  if (Array.isArray(valor)) {
    return valor.map((item) => repararDoubleEncodingUTF8(item));
  }

  if (typeof valor === "object") {
    const resultado: Record<string, any> = {};
    for (const chave of Object.keys(valor)) {
      resultado[chave] = repararDoubleEncodingUTF8(valor[chave]);
    }
    return resultado;
  }

  return valor;
}

/**
 * Corrige uma string individual com possível double-encoding UTF-8.
 * Converte para bytes Latin-1, depois decodifica como UTF-8.
 * Se a decodificação produzir resultado válido (mais curto), usa o resultado corrigido.
 */
function repararStringUTF8(str: string): string {
  if (!str) return str;

  // Regex que detecta padrões comuns de double-encoding UTF-8
  // Ã seguido de caractere Latin-1 indica bytes C3 xx interpretados errado
  const padraoDoubleEncoding = /[\u00C0-\u00DF][\u0080-\u00BF]/;

  if (!padraoDoubleEncoding.test(str)) {
    return str; // String limpa, sem double-encoding
  }

  try {
    // Converter string para bytes Latin-1, depois decodificar como UTF-8
    const bytes = Buffer.from(str, "latin1");
    const decoded = bytes.toString("utf8");

    // Validação: string decodificada deve ser mais curta (menos bytes por caractere)
    // e não deve conter caracteres de substituição (U+FFFD)
    if (decoded.length < str.length && !decoded.includes("\uFFFD")) {
      return decoded;
    }
  } catch {
    // Se falhar, retornar original
  }

  return str;
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
  const scriptId = process.env.GOOGLE_APPS_SCRIPT_ID_CEP; // Fallback
  
  if (!deploymentId && !scriptId) {
    console.error("[APPS SCRIPT SERVICE] ❌ Nenhum ID configurado (DEPLOYMENT_ID ou SCRIPT_ID)");
    return {
      sucesso: false,
      erro: "Script ID ou Deployment ID não configurado no servidor."
    };
  }

  try {
    const scriptClient = await criarClienteAppsScript();

    console.log(`[APPS SCRIPT SERVICE] Chamando Apps Script API...`);
    console.log(`[APPS SCRIPT SERVICE] Deployment ID: ${deploymentId || 'não configurado'}`);
    console.log(`[APPS SCRIPT SERVICE] Script ID (fallback): ${scriptId || 'não configurado'}`);
    console.log(`[APPS SCRIPT SERVICE] Função: ${nomeFuncao}`);
    console.log(`[APPS SCRIPT SERVICE] Dev Mode: ${devMode}`);

    // Tentar com Deployment ID primeiro (recomendado)
    const idParaUsar = deploymentId || scriptId;
    console.log(`[APPS SCRIPT SERVICE] Usando ID: ${idParaUsar}`);

    const response = await scriptClient.scripts.run({
      scriptId: idParaUsar!,
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

    const resultadoBruto = response.data.response?.result;
    console.log(`[APPS SCRIPT SERVICE] ✅ Execução bem-sucedida`);

    // ─── Reparo de double-encoding UTF-8 ───
    // Corrige padrão "SÃ¡bado" → "Sábado" (UTF-8 bytes lidos como Latin-1)
    const resultado = repararDoubleEncodingUTF8(resultadoBruto);

    console.log(`[APPS SCRIPT SERVICE] Resultado (pós-reparo UTF-8):`, JSON.stringify(resultado));

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
