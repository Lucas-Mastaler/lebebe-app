import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAuthenticatedUser } from "@/lib/auth/api-auth";

export const runtime = "nodejs";

// ─────────────────────────────────────────────────────────
// Rota TEMPORÁRIA para setup único do Google OAuth
// ─────────────────────────────────────────────────────────
// IMPORTANTE: Esta rota deve ser REMOVIDA após copiar o token
// Acesso restrito apenas para superadmin
// ─────────────────────────────────────────────────────────

export async function GET() {
  try {
    // ─────────────────────────────────────────────────────────
    // 1.0 – Verificar autenticação
    // ─────────────────────────────────────────────────────────
    const auth = await requireAuthenticatedUser({
      requireAllowedUser: true,
      requireActive: true,
      requiredRole: 'superadmin',
    });

    if (!auth.ok) {
      return auth.response;
    }

    console.log(`[SETUP TOKEN] Acesso autorizado para: ${auth.email}`);
    const supabase = await createClient();

    // ─────────────────────────────────────────────────────────
    // 2.0 – Buscar tokens capturados
    // ─────────────────────────────────────────────────────────
    const { data: tokens, error: tokenError } = await supabase
      .from('google_oauth_setup')
      .select('*')
      .order('captured_at', { ascending: false });

    if (tokenError) {
      return NextResponse.json(
        { 
          error: "Erro ao buscar tokens",
          message: "Verifique se a tabela google_oauth_setup existe.",
          details: tokenError.message
        },
        { status: 500 }
      );
    }

    if (!tokens || tokens.length === 0) {
      return NextResponse.json(
        { 
          success: false,
          message: "Nenhum token capturado ainda.",
          instructions: [
            "1. Remova o acesso do app na sua conta Google (https://myaccount.google.com/permissions)",
            "2. Faça logout do app",
            "3. Faça login novamente com Google",
            "4. O Google vai pedir consentimento novamente",
            "5. Após login bem-sucedido, acesse esta rota novamente"
          ]
        },
        { status: 200 }
      );
    }

    // ─────────────────────────────────────────────────────────
    // 3.0 – Processar tokens encontrados
    // ─────────────────────────────────────────────────────────
    const tokensProcessados = tokens.map(token => {
      const temRefreshToken = !!token.provider_refresh_token;
      
      return {
        user_email: token.user_email,
        captured_at: token.captured_at,
        has_refresh_token: temRefreshToken,
        refresh_token: temRefreshToken ? token.provider_refresh_token : null,
        access_token_preview: token.provider_token 
          ? `${token.provider_token.substring(0, 20)}...` 
          : null,
        notes: token.notes,
        status: temRefreshToken ? "✅ Pronto para usar" : "⚠️ Token não capturado"
      };
    });

    const tokenValido = tokensProcessados.find(t => t.has_refresh_token);

    // ─────────────────────────────────────────────────────────
    // 4.0 – Retornar resultado
    // ─────────────────────────────────────────────────────────
    return NextResponse.json(
      {
        success: true,
        token_encontrado: !!tokenValido,
        instrucoes: tokenValido 
          ? [
              "✅ Refresh token capturado com sucesso!",
              "",
              "📋 PRÓXIMOS PASSOS:",
              "1. Copie o valor de 'refresh_token' abaixo",
              "2. Adicione no .env.local e Vercel:",
              "   GOOGLE_OAUTH_REFRESH_TOKEN=<valor_copiado>",
              "3. Execute o SQL de cleanup para deletar a tabela:",
              "   DROP TABLE google_oauth_setup;",
              "4. Remova ou comente este arquivo:",
              "   src/app/api/google/setup-token/route.ts",
              "5. Remova a captura automática do callback:",
              "   src/app/auth/callback/route.ts (linhas 31-67)"
            ]
          : [
              "⚠️ Nenhum refresh token válido encontrado.",
              "",
              "POSSÍVEIS CAUSAS:",
              "1. O Google não retornou o refresh_token",
              "2. Configuração OAuth incorreta (falta access_type=offline)",
              "3. Usuário já tinha dado consentimento antes",
              "",
              "SOLUÇÃO:",
              "1. Remova o acesso do app na conta Google:",
              "   https://myaccount.google.com/permissions",
              "2. Faça logout do app",
              "3. Faça login novamente",
              "4. O Google vai pedir consentimento de novo",
              "5. Acesse esta rota novamente"
            ],
        tokens: tokensProcessados,
        refresh_token: tokenValido?.refresh_token || null,
        total_tentativas: tokens.length
      },
      { 
        status: 200,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
          'Pragma': 'no-cache'
        }
      }
    );

  } catch (error: unknown) {
    console.error("[SETUP TOKEN] Erro crítico:", error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return NextResponse.json(
      { 
        error: "Erro interno",
        message: errorMessage 
      },
      { status: 500 }
    );
  }
}
