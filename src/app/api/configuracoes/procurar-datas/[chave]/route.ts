import { NextResponse } from 'next/server'
import { requireModuleAccess } from '@/lib/auth/module-access'
import { editarConfigDb } from '@/lib/procurar-datas/config-db'
import { validarValorConfig } from '@/lib/procurar-datas/validar-config'
import { CHAVES_EDITAVEIS_FASE3 } from '@/lib/procurar-datas/chaves-editaveis'

// Re-exportar para uso em outros módulos se necessário
export { CHAVES_EDITAVEIS_FASE3 }

export const runtime = 'nodejs'

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/configuracoes/procurar-datas/[chave]
//
// Edita o campo `valor` de uma configuração no Supabase (Fase 3).
//
// REGRAS:
//   - Apenas usuarios com acesso ao modulo configuracoes_procurar_datas
//   - Apenas chaves da whitelist CHAVES_EDITAVEIS_FASE3 (em chaves-editaveis.ts)
//   - Não edita: secrets, chaves técnicas, chaves ausentes do banco
//   - Validação de tipo antes de salvar
//   - Registra auditoria: EDITADO_MANUALMENTE / tela
//   - Motor de busca NÃO é afetado
// ─────────────────────────────────────────────────────────────────────────────

interface PatchBody {
  valor: string
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ chave: string }> }
) {
  try {
    const auth = await requireModuleAccess('configuracoes_procurar_datas')

    if (!auth.ok) {
      return auth.response
    }

    // 1. Decodificar chave da URL
    const { chave: chaveParam } = await params
    const chaveUpper = decodeURIComponent(chaveParam).toUpperCase().trim()

    // 2. Verificar whitelist
    if (!CHAVES_EDITAVEIS_FASE3.has(chaveUpper)) {
      return NextResponse.json(
        { error: 'Chave não editável', message: `"${chaveUpper}" não faz parte das configurações editáveis nesta fase.` },
        { status: 403 }
      )
    }

    // 3. Ler body
    let body: PatchBody
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Body inválido', message: 'Envie JSON com campo "valor".' }, { status: 400 })
    }

    if (typeof body.valor !== 'string') {
      return NextResponse.json({ error: 'Campo obrigatório', message: 'Campo "valor" é obrigatório.' }, { status: 400 })
    }

    // 4. Buscar valor_tipo do banco para validação
    const { createServiceClient } = await import('@/lib/supabase/service')
    const db = createServiceClient()
    const { data: linhaDb, error: errBusca } = await db
      .from('procurar_datas_config')
      .select('valor_tipo, is_secret, ativo')
      .eq('chave_upper', chaveUpper)
      .maybeSingle()

    if (errBusca) {
      return NextResponse.json({ error: 'Erro ao consultar banco', message: errBusca.message }, { status: 500 })
    }

    if (!linhaDb) {
      return NextResponse.json(
        { error: 'Chave não encontrada', message: `"${chaveUpper}" não existe no banco. Importe as configurações da planilha primeiro.` },
        { status: 404 }
      )
    }

    if (!linhaDb.ativo) {
      return NextResponse.json({ error: 'Chave inativa', message: `"${chaveUpper}" está inativa.` }, { status: 409 })
    }

    if (linhaDb.is_secret) {
      return NextResponse.json({ error: 'Proibido', message: 'Secrets não podem ser editados.' }, { status: 403 })
    }

    // 5. Validar e normalizar valor
    const validacao = validarValorConfig(chaveUpper, linhaDb.valor_tipo as string, body.valor)
    if (!validacao.ok) {
      return NextResponse.json(
        { error: 'Valor inválido', message: validacao.erro },
        { status: 422 }
      )
    }

    // 6. Salvar no banco + auditoria
    const resultado = await editarConfigDb(chaveUpper, validacao.valorNormalizado, auth.email)

    if (!resultado.ok) {
      const httpStatus = resultado.status === 404 ? 404 : resultado.status === 400 ? 400 : 500
      return NextResponse.json({ error: 'Erro ao salvar', message: resultado.erro }, { status: httpStatus })
    }

    return NextResponse.json(resultado, { status: 200 })
  } catch (error: unknown) {
    console.error('[PATCH CONFIG] Erro crítico:', error)
    const message = error instanceof Error ? error.message : 'Erro desconhecido'
    return NextResponse.json({ error: 'Erro interno', message }, { status: 500 })
  }
}
