import { NextRequest, NextResponse } from "next/server";
import { executarAppsScript, isFuncaoPermitida } from "@/lib/google/apps-script";
import { AppsScriptExecutePayload, AppsScriptExecuteResponse } from "@/types";
import { validarBearerToken } from "@/lib/auth/bearer-auth";

export const runtime = "nodejs";

// ─────────────────────────────────────────────────────────
// 2.0 – Validação do payload de entrada
// ─────────────────────────────────────────────────────────

function validarPayload(body: any): { valido: boolean; erro?: string; payload?: AppsScriptExecutePayload } {
  const { 
    logradouro, numero, bairro, cidade, uf, cep,
    enderecoCompleto, 
    tempoNecessario, 
    isRural, 
    isCondominio, 
    dataInicial 
  } = body;

  // ─────────────────────────────────────────────────────────
  // 1.0 – Validar endereço (estruturado OU completo)
  // ─────────────────────────────────────────────────────────
  const temEnderecoEstruturado = logradouro || numero || bairro || cidade || uf || cep;
  const temEnderecoCompleto = enderecoCompleto && typeof enderecoCompleto === "string" && enderecoCompleto.trim();

  if (!temEnderecoEstruturado && !temEnderecoCompleto) {
    return { 
      valido: false, 
      erro: "Endereço não fornecido. Envie campos estruturados (logradouro, numero, bairro, cidade, uf, cep) OU enderecoCompleto." 
    };
  }

  // ─────────────────────────────────────────────────────────
  // 2.0 – Validar tempoNecessario
  // ─────────────────────────────────────────────────────────
  if (!tempoNecessario || typeof tempoNecessario !== "string") {
    return { valido: false, erro: "Campo 'tempoNecessario' é obrigatório e deve ser string." };
  }

  const rgxTempo = /^\d{1,2}:\d{2}$/;
  if (!rgxTempo.test(tempoNecessario)) {
    return { valido: false, erro: "Campo 'tempoNecessario' deve estar no formato HH:MM (ex: 00:30)." };
  }

  // ─────────────────────────────────────────────────────────
  // 3.0 – Validar campos opcionais
  // ─────────────────────────────────────────────────────────
  if (isRural !== undefined && typeof isRural !== "boolean") {
    return { valido: false, erro: "Campo 'isRural' deve ser boolean." };
  }

  if (isCondominio !== undefined && typeof isCondominio !== "boolean") {
    return { valido: false, erro: "Campo 'isCondominio' deve ser boolean." };
  }

  if (dataInicial !== undefined && typeof dataInicial !== "string") {
    return { valido: false, erro: "Campo 'dataInicial' deve ser string." };
  }

  if (dataInicial) {
    // Validar formato YYYY-MM-DD
    const rgxDate = /^\d{4}-\d{2}-\d{2}$/;
    if (!rgxDate.test(dataInicial)) {
      return { valido: false, erro: "Campo 'dataInicial' deve estar no formato YYYY-MM-DD (ex: 2026-04-15)." };
    }

    // Validar range D+2 a D+90
    const dataObj = new Date(dataInicial + 'T00:00:00');
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const minDate = new Date(hoje);
    minDate.setDate(hoje.getDate() + 2);

    const maxDate = new Date(hoje);
    maxDate.setDate(hoje.getDate() + 90);

    if (dataObj < minDate || dataObj > maxDate) {
      const minStr = minDate.toISOString().split('T')[0];
      const maxStr = maxDate.toISOString().split('T')[0];
      return { 
        valido: false, 
        erro: `Campo 'dataInicial' deve estar entre ${minStr} (D+2) e ${maxStr} (D+90).` 
      };
    }
  }

  // ─────────────────────────────────────────────────────────
  // 4.0 – Normalizar strings (UTF-8 seguro)
  // ─────────────────────────────────────────────────────────
  const normalizeString = (val: any): string => {
    if (!val) return "";
    return String(val).trim().normalize("NFC"); // NFC = Canonical Decomposition + Canonical Composition
  };

  // ─────────────────────────────────────────────────────────
  // 5.0 – Montar payload normalizado
  // ─────────────────────────────────────────────────────────
  return {
    valido: true,
    payload: {
      // Endereço estruturado (se fornecido)
      logradouro: normalizeString(logradouro) || undefined,
      numero: normalizeString(numero) || undefined,
      bairro: normalizeString(bairro) || undefined,
      cidade: normalizeString(cidade) || undefined,
      uf: normalizeString(uf) || undefined,
      cep: normalizeString(cep) || undefined,
      
      // Endereço completo (fallback)
      enderecoCompleto: normalizeString(enderecoCompleto) || undefined,
      
      // Parâmetros de serviço
      tempoNecessario: normalizeString(tempoNecessario),
      isRural: isRural ?? false,
      isCondominio: isCondominio ?? false,
      dataInicial: normalizeString(dataInicial) || undefined
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
    const validacaoAuth = validarBearerToken(request, "APPS SCRIPT API");
    if (!validacaoAuth.valido) {
      return NextResponse.json(
        { ok: false, error: validacaoAuth.erro || "Não autorizado" } as AppsScriptExecuteResponse,
        { status: 401 }
      );
    }

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
