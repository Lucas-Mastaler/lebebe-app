import { createServiceClient } from '@/lib/supabase/service'
import { registrarAuditoria } from '@/lib/auth/helpers'
import { requireSuperadminUsersAccess } from '@/lib/auth/superadmin-users-access'
import { isUuidList, validarPerfilAtribuivel } from '@/lib/superadmin/usuarios'
import { enviarEmail, gerarHtmlConvite } from '@/lib/email/resend'
import { gerarTokenConvite } from '@/lib/crypto/tokens'
import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'

async function salvarVinculosUsuario({
  supabaseAdmin,
  usuarioId,
  atorId,
  perfil,
  unidadeIds,
  email,
}: {
  supabaseAdmin: SupabaseClient
  usuarioId: string
  atorId: string
  perfil: { id: string; chave: string; nome: string } | null
  unidadeIds: string[]
  email: string
}) {
  if (perfil) {
    const { error } = await supabaseAdmin
      .from('app_usuarios_perfis')
      .upsert(
        {
          usuario_id: usuarioId,
          perfil_id: perfil.id,
          atribuido_por: atorId,
        },
        { onConflict: 'usuario_id' }
      )

    if (error) {
      throw new Error('Erro ao salvar perfil do usuário')
    }
  }

  const { error: deleteUnidadesError } = await supabaseAdmin
    .from('app_usuarios_unidades')
    .delete()
    .eq('usuario_id', usuarioId)

  if (deleteUnidadesError) {
    throw new Error('Erro ao substituir unidades do usuário')
  }

  if (unidadeIds.length > 0) {
    const { error } = await supabaseAdmin
      .from('app_usuarios_unidades')
      .insert(unidadeIds.map((unidadeId) => ({
        usuario_id: usuarioId,
        unidade_id: unidadeId,
        atribuido_por: atorId,
      })))

    if (error) {
      throw new Error('Erro ao salvar unidades do usuário')
    }
  }

  const { error: auditoriaError } = await supabaseAdmin
    .from('app_auditoria_permissoes')
    .insert({
      ator_usuario_id: atorId,
      alvo_usuario_id: usuarioId,
      acao: 'configurar_usuario_convite',
      entidade: 'usuarios_permitidos',
      entidade_id: usuarioId,
      antes: null,
      depois: {
        perfil_id: perfil?.id ?? null,
        unidade_ids: unidadeIds,
      },
      metadata: { usuario_email: email },
    })

  if (auditoriaError) {
    throw new Error('Erro ao auditar vínculos do usuário')
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireSuperadminUsersAccess()

    if (!auth.ok) {
      return auth.response
    }

    const supabaseAdmin = createServiceClient()

    const { email, role, perfilId, unidadeIds } = await request.json()

    if (!email || !role) {
      return NextResponse.json(
        { ok: false, message: 'Email e role são obrigatórios' },
        { status: 400 }
      )
    }

    const emailNormalizado = email.toLowerCase().trim()
    const roleEfetiva = auth.acessoLimitadoUsuarios ? 'user' : role

    if (roleEfetiva !== 'user' && roleEfetiva !== 'superadmin') {
      return NextResponse.json(
        { ok: false, message: 'Role invÃ¡lida' },
        { status: 400 }
      )
    }

    if (auth.acessoLimitadoUsuarios && role !== 'user') {
      return NextResponse.json(
        { ok: false, message: 'Acesso negado para criar superadmin' },
        { status: 403 }
      )
    }

    const unidadeIdsValidos = unidadeIds === undefined || unidadeIds === null
      ? []
      : isUuidList(unidadeIds)
      ? Array.from(new Set(unidadeIds))
      : null

    if (unidadeIdsValidos === null) {
      return NextResponse.json(
        { ok: false, message: 'unidadeIds deve ser uma lista de IDs' },
        { status: 400 }
      )
    }

    if (!emailNormalizado.includes('@')) {
      return NextResponse.json(
        { ok: false, message: 'Email inválido' },
        { status: 400 }
      )
    }

    let perfilValidado: { id: string; chave: string; nome: string; ativo: boolean } | null = null
    if (typeof perfilId === 'string' && perfilId.trim()) {
      const perfilResult = await validarPerfilAtribuivel(
        supabaseAdmin,
        perfilId,
        auth.acessoLimitadoUsuarios
      )

      if (!perfilResult.ok) {
        return NextResponse.json(
          { ok: false, message: perfilResult.message },
          { status: perfilResult.status }
        )
      }

      perfilValidado = perfilResult.perfil
    }

    if (unidadeIdsValidos.length > 0) {
      const { data: unidadesValidas, error: unidadesError } = await supabaseAdmin
        .from('app_unidades')
        .select('id')
        .in('id', unidadeIdsValidos)
        .eq('ativo', true)

      if (unidadesError) {
        console.error('[INVITE] Erro ao validar unidades:', unidadesError)
        return NextResponse.json(
          { ok: false, message: 'Erro ao processar requisiÃ§Ã£o' },
          { status: 500 }
        )
      }

      const idsValidos = new Set((unidadesValidas ?? []).map((u) => u.id))
      if (unidadeIdsValidos.some((unidadeId) => !idsValidos.has(unidadeId))) {
        return NextResponse.json(
          { ok: false, message: 'Uma ou mais unidades sÃ£o invÃ¡lidas ou inativas' },
          { status: 422 }
        )
      }
    }

    const { data: usuarioExistente } = await supabaseAdmin
      .from('usuarios_permitidos')
      .select('id, ativo, role, last_invite_sent_at, invite_status')
      .eq('email', emailNormalizado)
      .single()

    if (usuarioExistente) {
      if (auth.acessoLimitadoUsuarios && usuarioExistente.role === 'superadmin') {
        return NextResponse.json(
          { ok: false, message: 'Acesso negado' },
          { status: 403 }
        )
      }

      if (usuarioExistente.ativo && usuarioExistente.invite_status === 'accepted') {
        return NextResponse.json(
          { ok: false, message: 'Usuário já está cadastrado e ativo no sistema' },
          { status: 400 }
        )
      }

      if (usuarioExistente.last_invite_sent_at) {
        const lastSentAt = new Date(usuarioExistente.last_invite_sent_at)
        const now = new Date()
        const diffSeconds = (now.getTime() - lastSentAt.getTime()) / 1000

        if (diffSeconds < 60) {
          const remainingSeconds = Math.ceil(60 - diffSeconds)
          return NextResponse.json(
            { 
              ok: false, 
              status: 'skipped_recent',
              message: `Convite já enviado recentemente. Aguarde ${remainingSeconds} segundos para reenviar.` 
            },
            { status: 429 }
          )
        }
      }
    }

    console.log(`[INVITE] Gerando token seguro de convite para ${emailNormalizado}`)

    const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') || 'http://localhost:3000'
    const inviteToken = gerarTokenConvite()
    const expiresAt = new Date()
    expiresAt.setHours(expiresAt.getHours() + 24)

    const confirmUrl = `${appUrl}/convite/${inviteToken}`

    if (usuarioExistente) {
      const updatePayload: Record<string, unknown> = {
        ativo: true,
        role: roleEfetiva,
        last_invite_sent_at: new Date().toISOString(),
        invite_status: 'sent',
        invite_token: inviteToken,
        invite_token_expires_at: expiresAt.toISOString(),
        invite_token_used_at: null,
      }

      let updateError = (
        await supabaseAdmin
          .from('usuarios_permitidos')
          .update(updatePayload)
          .eq('email', emailNormalizado)
      ).error

      if (updateError && String(updateError.message || '').includes('invite_token_used_at')) {
        delete updatePayload.invite_token_used_at
        updateError = (
          await supabaseAdmin
            .from('usuarios_permitidos')
            .update(updatePayload)
            .eq('email', emailNormalizado)
        ).error
      }

      if (updateError) {
        console.error('[INVITE] Erro ao atualizar registro existente:', updateError)
        return NextResponse.json(
          { ok: false, message: 'Erro ao atualizar registro de permissão' },
          { status: 500 }
        )
      }

      await registrarAuditoria('USUARIO_PERMITIDO_CRIADO', auth.user.email, {
        novo_usuario: emailNormalizado,
        role: roleEfetiva,
        action: 'reactivated_and_sent',
      }, {
        baseUrl: request.headers.get('origin') || undefined,
      })

      await salvarVinculosUsuario({
        supabaseAdmin,
        usuarioId: usuarioExistente.id,
        atorId: auth.allowedUser!.id,
        perfil: perfilValidado,
        unidadeIds: unidadeIdsValidos,
        email: emailNormalizado,
      })

      console.log(`[RESEND] Enviando email para ${emailNormalizado}`)

      try {
        const htmlEmail = gerarHtmlConvite({
          confirmUrl,
          email: emailNormalizado,
        })

        await enviarEmail({
          to: emailNormalizado,
          subject: 'Convite - le bébé',
          html: htmlEmail,
        })

        console.log(`[RESEND] Email enviado com sucesso para ${emailNormalizado}`)

        await registrarAuditoria('INVITE_EMAIL_SENT', auth.user.email, {
          target_email: emailNormalizado,
          role: roleEfetiva,
        }, {
          baseUrl: request.headers.get('origin') || undefined,
        })
      } catch (emailError: unknown) {
        console.error('[RESEND ERROR]', emailError)
        const errorMessage = emailError instanceof Error ? emailError.message : 'Erro desconhecido'

        await supabaseAdmin
          .from('usuarios_permitidos')
          .update({ invite_status: 'failed' })
          .eq('email', emailNormalizado)

        await registrarAuditoria('INVITE_EMAIL_FAILED', auth.user.email, {
          target_email: emailNormalizado,
          error: errorMessage,
        }, {
          baseUrl: request.headers.get('origin') || undefined,
        })

        return NextResponse.json(
          { ok: false, message: 'Erro ao enviar email: ' + errorMessage },
          { status: 500 }
        )
      }

      return NextResponse.json({
        ok: true,
        status: 'reactivated_and_sent',
        message: `Convite reenviado para ${emailNormalizado}`,
      })
    }

    const insertPayload: Record<string, unknown> = {
      email: emailNormalizado,
      role: roleEfetiva,
      ativo: true,
      last_invite_sent_at: new Date().toISOString(),
      invite_status: 'sent',
      invite_token: inviteToken,
      invite_token_expires_at: expiresAt.toISOString(),
      invite_token_used_at: null,
    }

    const insertResult = await supabaseAdmin
      .from('usuarios_permitidos')
      .insert(insertPayload)
      .select('id')
      .single()

    let insertError = insertResult.error
    let usuarioCriadoId: string | null = insertResult.data?.id ?? null

    if (insertError && String(insertError.message || '').includes('invite_token_used_at')) {
      delete insertPayload.invite_token_used_at
      const retryResult = (
        await supabaseAdmin
          .from('usuarios_permitidos')
          .insert(insertPayload)
          .select('id')
          .single()
      )
      insertError = retryResult.error
      usuarioCriadoId = retryResult.data?.id ?? null
    } else {
      const createdResult = await supabaseAdmin
        .from('usuarios_permitidos')
        .select('id')
        .eq('email', emailNormalizado)
        .single()
      usuarioCriadoId = createdResult.data?.id ?? null
    }

    if (insertError) {
      console.error('[INVITE] Erro ao inserir usuário permitido:', insertError)
      return NextResponse.json(
        { ok: false, message: 'Erro ao criar registro de permissão' },
        { status: 500 }
      )
    }

    if (!usuarioCriadoId) {
      return NextResponse.json(
        { ok: false, message: 'Erro ao criar registro de permissÃ£o' },
        { status: 500 }
      )
    }

    await salvarVinculosUsuario({
      supabaseAdmin,
      usuarioId: usuarioCriadoId,
      atorId: auth.allowedUser!.id,
      perfil: perfilValidado,
      unidadeIds: unidadeIdsValidos,
      email: emailNormalizado,
    })

    console.log(`[RESEND] Enviando email para ${emailNormalizado}`)

    try {
      const htmlEmail = gerarHtmlConvite({
        confirmUrl,
        email: emailNormalizado,
      })

      await enviarEmail({
        to: emailNormalizado,
        subject: 'Convite - le bébé',
        html: htmlEmail,
      })

      console.log(`[RESEND] Email enviado com sucesso para ${emailNormalizado}`)

      await registrarAuditoria('INVITE_EMAIL_SENT', auth.user.email, {
        target_email: emailNormalizado,
        role: roleEfetiva,
      }, {
        baseUrl: request.headers.get('origin') || undefined,
      })
    } catch (emailError: unknown) {
      console.error('[RESEND ERROR]', emailError)
      const errorMessage = emailError instanceof Error ? emailError.message : 'Erro desconhecido'

      await supabaseAdmin
        .from('usuarios_permitidos')
        .update({ invite_status: 'failed' })
        .eq('email', emailNormalizado)

      await registrarAuditoria('INVITE_EMAIL_FAILED', auth.user.email, {
        target_email: emailNormalizado,
        error: errorMessage,
      }, {
        baseUrl: request.headers.get('origin') || undefined,
      })

      return NextResponse.json(
        { ok: false, message: 'Erro ao enviar email: ' + errorMessage },
        { status: 500 }
      )
    }

    await registrarAuditoria('USUARIO_PERMITIDO_CRIADO', auth.user.email, {
      novo_usuario: emailNormalizado,
      role: roleEfetiva,
    }, {
      baseUrl: request.headers.get('origin') || undefined,
    })

    return NextResponse.json({
      ok: true,
      status: 'sent',
      message: `Convite enviado para ${emailNormalizado}. O usuário receberá um email para definir a senha.`,
    })

  } catch (error) {
    console.error('[INVITE] Erro geral:', error)
    return NextResponse.json(
      { ok: false, message: 'Erro ao processar requisição' },
      { status: 500 }
    )
  }
}
