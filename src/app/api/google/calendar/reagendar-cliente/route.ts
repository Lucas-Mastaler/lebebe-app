import { NextRequest, NextResponse } from "next/server";
import {
  reagendarEventoCliente,
  validarPayloadReagendamento,
} from "@/lib/google/reagendamento-helper";
import {
  ReagendarClientePayload,
  ReagendarClienteError,
} from "@/types/reagendamento";
import { validarBearerToken } from "@/lib/auth/bearer-auth";

// ─────────────────────────────────────────────────────────
// POST /api/google/calendar/reagendar-cliente
// ─────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  console.log(`[API REAGENDAMENTO] ========================================`);
  console.log(`[API REAGENDAMENTO] Nova requisição de reagendamento recebida`);
  console.log(`[API REAGENDAMENTO] Timestamp: ${new Date().toISOString()}`);

  try {
    // ─────────────────────────────────────────────────────────
    // 1.0 – Verificar autenticação Bearer
    // ─────────────────────────────────────────────────────────
    const validacaoAuth = validarBearerToken(request, "API REAGENDAMENTO");
    if (!validacaoAuth.valido) {
      console.error(`[API REAGENDAMENTO] ❌ Autenticação falhou`);
      return NextResponse.json(
        {
          ok: false,
          erro: "Não autorizado",
          detalhes: validacaoAuth.erro || "Token Bearer inválido ou ausente.",
        } as ReagendarClienteError,
        { status: 401 }
      );
    }

    // ─────────────────────────────────────────────────────────
    // 2.0 – Parsear e validar payload
    // ─────────────────────────────────────────────────────────
    let body: any;
    
    try {
      body = await request.json();
      console.log(`[API REAGENDAMENTO] Payload recebido:`);
      console.log(`[API REAGENDAMENTO] - eventoId: ${body.eventoId}`);
      console.log(`[API REAGENDAMENTO] - calendarIdAtual: ${body.calendarIdAtual}`);
      console.log(`[API REAGENDAMENTO] - calendarIdNovo: ${body.calendarIdNovo}`);
      console.log(`[API REAGENDAMENTO] - dataOriginal: ${body.dataOriginal}`);
      console.log(`[API REAGENDAMENTO] - novaData: ${body.novaData}`);
      console.log(`[API REAGENDAMENTO] - nomeCliente: ${body.nomeCliente}`);
      console.log(`[API REAGENDAMENTO] - pedidoVenda: ${body.pedidoVenda}`);
    } catch (parseError: any) {
      console.error(`[API REAGENDAMENTO] ❌ Erro ao parsear JSON:`, parseError.message);
      return NextResponse.json(
        {
          ok: false,
          erro: "JSON inválido",
          detalhes: "O corpo da requisição não é um JSON válido.",
        } as ReagendarClienteError,
        { status: 400 }
      );
    }

    // ─────────────────────────────────────────────────────────
    // 3.0 – Validar campos obrigatórios
    // ─────────────────────────────────────────────────────────
    const validacao = validarPayloadReagendamento(body);

    if (!validacao.valido) {
      console.error(`[API REAGENDAMENTO] ❌ Payload inválido:`);
      validacao.erros.forEach((erro) => {
        console.error(`[API REAGENDAMENTO]   - ${erro}`);
      });

      return NextResponse.json(
        {
          ok: false,
          erro: "Payload inválido",
          detalhes: validacao.erros.join("; "),
        } as ReagendarClienteError,
        { status: 400 }
      );
    }

    console.log(`[API REAGENDAMENTO] ✓ Payload validado com sucesso`);

    // ─────────────────────────────────────────────────────────
    // 4.0 – Executar reagendamento
    // ─────────────────────────────────────────────────────────
    console.log(`[API REAGENDAMENTO] Iniciando processo de reagendamento...`);

    const payload: ReagendarClientePayload = body;
    const resultado = await reagendarEventoCliente(payload);

    console.log(`[API REAGENDAMENTO] ✅ Reagendamento executado com sucesso`);
    console.log(`[API REAGENDAMENTO] Modo: ${resultado.modo}`);
    console.log(`[API REAGENDAMENTO] Evento novo: ${resultado.eventoNovoId}`);
    console.log(`[API REAGENDAMENTO] Evento histórico: ${resultado.eventoHistoricoId}`);
    console.log(`[API REAGENDAMENTO] ========================================`);

    return NextResponse.json(resultado, { status: 200 });

  } catch (error: any) {
    // ─────────────────────────────────────────────────────────
    // 5.0 – Tratamento de erros
    // ─────────────────────────────────────────────────────────
    console.error(`[API REAGENDAMENTO] ========================================`);
    console.error(`[API REAGENDAMENTO] ❌ ERRO CRÍTICO NO REAGENDAMENTO`);
    console.error(`[API REAGENDAMENTO] Mensagem: ${error.message}`);
    console.error(`[API REAGENDAMENTO] Stack:`, error.stack);
    console.error(`[API REAGENDAMENTO] ========================================`);

    let mensagemErro = "Erro interno ao processar reagendamento.";
    let detalhes = error.message;

    if (error.message.includes("não encontrado")) {
      return NextResponse.json(
        {
          ok: false,
          erro: "Evento não encontrado",
          detalhes: error.message,
        } as ReagendarClienteError,
        { status: 404 }
      );
    }

    if (error.message.includes("access token") || error.message.includes("refresh")) {
      mensagemErro = "Erro de autenticação com Google Calendar";
      detalhes = "Verifique as credenciais OAuth do sistema.";
    }

    return NextResponse.json(
      {
        ok: false,
        erro: mensagemErro,
        detalhes: detalhes,
      } as ReagendarClienteError,
      { status: 500 }
    );
  }
}
