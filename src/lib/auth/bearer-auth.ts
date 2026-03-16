import { NextRequest } from "next/server";

// ─────────────────────────────────────────────────────────
// Autenticação via Bearer Token para APIs Internas
// ─────────────────────────────────────────────────────────

export interface ValidacaoBearerResult {
  valido: boolean;
  erro?: string;
}

/**
 * Valida autenticação Bearer token para APIs internas.
 * 
 * Usado pelas rotas:
 * - POST /api/google/apps-script/executar
 * - POST /api/google/calendar/reagendar-cliente
 * 
 * @param request - NextRequest
 * @param nomeApi - Nome da API para logs (ex: "APPS SCRIPT API", "REAGENDAMENTO API")
 * @returns { valido: boolean, erro?: string }
 */
export function validarBearerToken(
  request: NextRequest,
  nomeApi: string = "API"
): ValidacaoBearerResult {
  const authHeader = request.headers.get("authorization");
  const tokenEsperado = process.env.APPS_SCRIPT_API_TOKEN;

  if (!tokenEsperado) {
    console.error(`[${nomeApi}] ❌ APPS_SCRIPT_API_TOKEN não configurado no servidor`);
    return {
      valido: false,
      erro: "Configuração de autenticação ausente no servidor",
    };
  }

  if (!authHeader) {
    console.error(`[${nomeApi}] ❌ Header Authorization ausente`);
    return {
      valido: false,
      erro: "Token Bearer inválido ou ausente",
    };
  }

  if (authHeader !== `Bearer ${tokenEsperado}`) {
    console.error(`[${nomeApi}] ❌ Token Bearer inválido`);
    console.error(`[${nomeApi}] ❌ Header recebido (primeiros 20 chars): ${authHeader.substring(0, 20)}...`);
    return {
      valido: false,
      erro: "Token Bearer inválido ou ausente",
    };
  }

  console.log(`[${nomeApi}] ✓ Autenticação Bearer válida`);
  return {
    valido: true,
  };
}
