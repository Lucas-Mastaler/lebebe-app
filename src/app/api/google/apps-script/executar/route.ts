import { NextRequest, NextResponse } from "next/server";
import { executarAppsScript, isFuncaoPermitida } from "@/lib/google/apps-script";
import { AppsScriptExecutePayload, AppsScriptExecuteResponse } from "@/types";

export const runtime = "nodejs";

// ─────────────────────────────────────────────────────────
// 1.0 – Validação de autenticação (Bearer token interno)
// ─────────────────────────────────────────────────────────

function validarAutenticacao(request: NextRequest): boolean {
  const authHeader = request.headers.get("authorization");
  const tokenEsperado = process.env.APPS_SCRIPT_API_TOKEN;

  if (!tokenEsperado) {
    console.error("[APPS SCRIPT API] ❌ APPS_SCRIPT_API_TOKEN não configurado");
    return false;
  }

  if (authHeader !== `Bearer ${tokenEsperado}`) {
    console.error("[APPS SCRIPT API] ❌ Token inválido ou ausente");
    return false;
  }

  return true;
}

// ─────────────────────────────────────────────────────────
// 2.0 – Validação do payload de entrada
// ─────────────────────────────────────────────────────────

function validarPayload(body: any): { valido: boolean; erro?: string; payload?: AppsScriptExecutePayload } {
  const { enderecoCompleto, tempoNecessario, isRural, isCondominio, monthYear } = body;

  if (!enderecoCompleto || typeof enderecoCompleto !== "string") {
    return { valido: false, erro: "Campo 'enderecoCompleto' é obrigatório e deve ser string." };
  }

  if (!tempoNecessario || typeof tempoNecessario !== "string") {
    return { valido: false, erro: "Campo 'tempoNecessario' é obrigatório e deve ser string." };
  }

  const rgxTempo = /^\d{2}:\d{2}$/;
  if (!rgxTempo.test(tempoNecessario)) {
    return { valido: false, erro: "Campo 'tempoNecessario' deve estar no formato HH:MM (ex: 00:30)." };
  }

  if (isRural !== undefined && typeof isRural !== "boolean") {
    return { valido: false, erro: "Campo 'isRural' deve ser boolean." };
  }

  if (isCondominio !== undefined && typeof isCondominio !== "boolean") {
    return { valido: false, erro: "Campo 'isCondominio' deve ser boolean." };
  }

  if (monthYear !== undefined && typeof monthYear !== "string") {
    return { valido: false, erro: "Campo 'monthYear' deve ser string." };
  }

  if (monthYear) {
    const rgxMonth = /^\d{4}-\d{2}$/;
    if (!rgxMonth.test(monthYear)) {
      return { valido: false, erro: "Campo 'monthYear' deve estar no formato YYYY-MM (ex: 2026-04)." };
    }
  }

  return {
    valido: true,
    payload: {
      enderecoCompleto,
      tempoNecessario,
      isRural: isRural ?? false,
      isCondominio: isCondominio ?? false,
      monthYear: monthYear ?? undefined
    }
  };
}

// ─────────────────────────────────────────────────────────
// 3.0 – Route Handler (POST)
// ─────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const horarioInicio = new Date().toISOString();
  console.log(`[APPS SCRIPT API] ========================================`);
  console.log(`[APPS SCRIPT API] Requisição recebida em ${horarioInicio}`);

  try {
    // 3.1 – Validar autenticação
    if (!validarAutenticacao(request)) {
      return NextResponse.json(
        { ok: false, error: "Não autorizado" } as AppsScriptExecuteResponse,
        { status: 401 }
      );
    }

    console.log("[APPS SCRIPT API] ✓ Autenticação válida");

    // 3.2 – Parse do body
    let body: any;
    try {
      body = await request.json();
    } catch (parseError) {
      console.error("[APPS SCRIPT API] ❌ Erro ao fazer parse do JSON:", parseError);
      return NextResponse.json(
        { ok: false, error: "JSON inválido" } as AppsScriptExecuteResponse,
        { status: 400 }
      );
    }

    console.log("[APPS SCRIPT API] Payload recebido:", JSON.stringify(body));

    // 3.3 – Validar payload
    const validacao = validarPayload(body);
    if (!validacao.valido) {
      console.error("[APPS SCRIPT API] ❌ Validação falhou:", validacao.erro);
      return NextResponse.json(
        { ok: false, error: validacao.erro } as AppsScriptExecuteResponse,
        { status: 400 }
      );
    }

    console.log("[APPS SCRIPT API] ✓ Payload válido");

    // 3.4 – Nome da função (fixo por enquanto, mas preparado para expansão)
    const nomeFuncao = "apiProcurarDatasPorEndereco";

    if (!isFuncaoPermitida(nomeFuncao)) {
      console.error("[APPS SCRIPT API] ❌ Função não permitida:", nomeFuncao);
      return NextResponse.json(
        { ok: false, error: "Função não permitida" } as AppsScriptExecuteResponse,
        { status: 403 }
      );
    }

    console.log("[APPS SCRIPT API] ✓ Função permitida:", nomeFuncao);

    // 3.5 – Executar Apps Script
    console.log("[APPS SCRIPT API] Chamando Apps Script...");
    const resultado = await executarAppsScript({
      nomeFuncao: nomeFuncao,
      parametros: [validacao.payload],
      devMode: false
    });

    // 3.6 – Processar resultado
    if (!resultado.sucesso) {
      console.error("[APPS SCRIPT API] ❌ Erro retornado do Apps Script:", resultado.erro);
      return NextResponse.json(
        { ok: false, error: resultado.erro } as AppsScriptExecuteResponse,
        { status: 500 }
      );
    }

    console.log("[APPS SCRIPT API] ✅ Execução bem-sucedida");
    console.log("[APPS SCRIPT API] Resultado:", JSON.stringify(resultado.resultado));

    return NextResponse.json(
      { ok: true, resultado: resultado.resultado } as AppsScriptExecuteResponse,
      { status: 200 }
    );

  } catch (error: any) {
    console.error("[APPS SCRIPT API] ❌ Erro crítico:", error);
    console.error("[APPS SCRIPT API] Stack:", error.stack);

    return NextResponse.json(
      { ok: false, error: "Erro interno do servidor" } as AppsScriptExecuteResponse,
      { status: 500 }
    );
  }
}
