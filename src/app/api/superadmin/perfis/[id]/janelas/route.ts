import { createServiceClient } from '@/lib/supabase/service'
import { requireAuthenticatedUser } from '@/lib/auth/api-auth'
import { NextResponse } from 'next/server'
import type { TipoJanelaPerfil } from '@/types/supabase'

export const runtime = 'nodejs'

const TIPOS_VALIDOS: TipoJanelaPerfil[] = ['seg_sex', 'sabado', 'domingo']

const DEFAULT_TIMEZONE = 'America/Sao_Paulo'

type JanelaResponse = {
  id: string | null
  tipo: TipoJanelaPerfil
  ativo: boolean
  horaInicio: string | null
  horaFim: string | null
  timezone: string
}

function defaultJanelasAusentes(tiposPresentes: Set<TipoJanelaPerfil>): JanelaResponse[] {
  return TIPOS_VALIDOS.filter((t) => !tiposPresentes.has(t)).map((tipo) => ({
    id: null,
    tipo,
    ativo: false,
    horaInicio: null,
    horaFim: null,
    timezone: DEFAULT_TIMEZONE,
  }))
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuthenticatedUser({
      requireAllowedUser: true,
      requireActive: true,
      requiredRole: 'superadmin',
    })

    if (!auth.ok) {
      return auth.response
    }

    const { id } = await params

    if (!id?.trim()) {
      return NextResponse.json(
        { ok: false, message: 'ID do perfil é obrigatório' },
        { status: 400 }
      )
    }

    const supabaseAdmin = createServiceClient()

    const { data: perfil, error: perfilError } = await supabaseAdmin
      .from('app_perfis_acesso')
      .select('id, chave, nome, ativo')
      .eq('id', id)
      .single()

    if (perfilError || !perfil) {
      return NextResponse.json(
        { ok: false, message: 'Perfil não encontrado' },
        { status: 404 }
      )
    }

    const { data: janelasRaw, error: janelasError } = await supabaseAdmin
      .from('app_janelas_acesso_perfil')
      .select('id, tipo, ativo, hora_inicio, hora_fim, timezone')
      .eq('perfil_id', id)

    if (janelasError) {
      console.error('[SUPERADMIN PERFIS JANELAS GET] Erro ao buscar janelas:', janelasError)
      return NextResponse.json(
        { ok: false, message: 'Erro ao processar requisição' },
        { status: 500 }
      )
    }

    const janelas: JanelaResponse[] = (janelasRaw ?? []).map((j) => ({
      id: j.id,
      tipo: j.tipo as TipoJanelaPerfil,
      ativo: j.ativo,
      horaInicio: j.hora_inicio,
      horaFim: j.hora_fim,
      timezone: j.timezone,
    }))

    const tiposPresentes = new Set(janelas.map((j) => j.tipo))
    const janelasCompletas = [
      ...janelas,
      ...defaultJanelasAusentes(tiposPresentes),
    ].sort((a, b) => TIPOS_VALIDOS.indexOf(a.tipo) - TIPOS_VALIDOS.indexOf(b.tipo))

    return NextResponse.json({
      ok: true,
      perfil: { id: perfil.id, chave: perfil.chave, nome: perfil.nome, ativo: perfil.ativo },
      janelas: janelasCompletas,
    })

  } catch (error) {
    console.error('[SUPERADMIN PERFIS JANELAS GET] Erro geral:', error)
    return NextResponse.json(
      { ok: false, message: 'Erro ao processar requisição' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuthenticatedUser({
      requireAllowedUser: true,
      requireActive: true,
      requiredRole: 'superadmin',
    })

    if (!auth.ok) {
      return auth.response
    }

    const { id } = await params

    if (!id?.trim()) {
      return NextResponse.json(
        { ok: false, message: 'ID do perfil é obrigatório' },
        { status: 400 }
      )
    }

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { ok: false, message: 'Payload inválido' },
        { status: 400 }
      )
    }

    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      return NextResponse.json(
        { ok: false, message: 'Payload inválido' },
        { status: 400 }
      )
    }

    const { janelas } = body as Record<string, unknown>

    if (!Array.isArray(janelas) || janelas.length === 0) {
      return NextResponse.json(
        { ok: false, message: 'janelas deve ser array não vazio' },
        { status: 400 }
      )
    }

    // Validar cada janela
    for (const item of janelas) {
      if (typeof item !== 'object' || item === null) {
        return NextResponse.json(
          { ok: false, message: 'Cada janela deve ser um objeto' },
          { status: 400 }
        )
      }

      const j = item as Record<string, unknown>

      if (!TIPOS_VALIDOS.includes(j.tipo as TipoJanelaPerfil)) {
        return NextResponse.json(
          { ok: false, message: `tipo inválido: ${j.tipo}. Use seg_sex, sabado ou domingo` },
          { status: 400 }
        )
      }

      if (typeof j.ativo !== 'boolean') {
        return NextResponse.json(
          { ok: false, message: 'ativo deve ser boolean' },
          { status: 400 }
        )
      }

      if (j.ativo === true) {
        if (typeof j.horaInicio !== 'string' || !j.horaInicio.trim()) {
          return NextResponse.json(
            { ok: false, message: `horaInicio é obrigatório quando ativo=true (tipo: ${j.tipo})` },
            { status: 400 }
          )
        }
        if (typeof j.horaFim !== 'string' || !j.horaFim.trim()) {
          return NextResponse.json(
            { ok: false, message: `horaFim é obrigatório quando ativo=true (tipo: ${j.tipo})` },
            { status: 400 }
          )
        }
        if (j.horaFim <= j.horaInicio) {
          return NextResponse.json(
            { ok: false, message: `horaFim deve ser maior que horaInicio (tipo: ${j.tipo})` },
            { status: 400 }
          )
        }
      }
    }

    // Verificar tipos duplicados no payload
    const tiposNoPayload = janelas.map((j) => (j as Record<string, unknown>).tipo as string)
    if (new Set(tiposNoPayload).size !== tiposNoPayload.length) {
      return NextResponse.json(
        { ok: false, message: 'Tipos duplicados no payload' },
        { status: 400 }
      )
    }

    const supabaseAdmin = createServiceClient()

    const { data: perfil, error: perfilError } = await supabaseAdmin
      .from('app_perfis_acesso')
      .select('id, chave, nome, ativo')
      .eq('id', id)
      .single()

    if (perfilError || !perfil) {
      return NextResponse.json(
        { ok: false, message: 'Perfil não encontrado' },
        { status: 404 }
      )
    }

    if (!perfil.ativo) {
      return NextResponse.json(
        { ok: false, message: 'Não é possível editar janelas de perfil inativo' },
        { status: 422 }
      )
    }

    // Snapshot anterior para auditoria
    const { data: janelasAntes } = await supabaseAdmin
      .from('app_janelas_acesso_perfil')
      .select('tipo, ativo, hora_inicio, hora_fim, timezone')
      .eq('perfil_id', id)

    const rows = janelas.map((item) => {
      const j = item as {
        tipo: TipoJanelaPerfil
        ativo: boolean
        horaInicio?: string | null
        horaFim?: string | null
        timezone?: string
      }
      return {
        perfil_id: id,
        tipo: j.tipo,
        ativo: j.ativo,
        hora_inicio: j.ativo ? j.horaInicio ?? null : null,
        hora_fim: j.ativo ? j.horaFim ?? null : null,
        timezone: typeof j.timezone === 'string' && j.timezone.trim() ? j.timezone : DEFAULT_TIMEZONE,
      }
    })

    const { error: upsertError } = await supabaseAdmin
      .from('app_janelas_acesso_perfil')
      .upsert(rows, { onConflict: 'perfil_id,tipo' })

    if (upsertError) {
      console.error('[SUPERADMIN PERFIS JANELAS PUT] Erro ao salvar janelas:', upsertError)
      return NextResponse.json(
        { ok: false, message: 'Erro ao processar requisição' },
        { status: 500 }
      )
    }

    await supabaseAdmin
      .from('app_auditoria_permissoes')
      .insert({
        ator_usuario_id: auth.allowedUser!.id,
        alvo_usuario_id: null,
        acao: 'atualizar_janelas_perfil',
        entidade: 'app_janelas_acesso_perfil',
        entidade_id: perfil.id,
        antes: { janelas: janelasAntes ?? [] },
        depois: {
          janelas: rows.map((r) => ({
            tipo: r.tipo,
            ativo: r.ativo,
            hora_inicio: r.hora_inicio,
            hora_fim: r.hora_fim,
          })),
        },
        metadata: { perfil_chave: perfil.chave, perfil_nome: perfil.nome },
      })

    return NextResponse.json({
      ok: true,
      message: 'Janelas atualizadas com sucesso',
    })

  } catch (error) {
    console.error('[SUPERADMIN PERFIS JANELAS PUT] Erro geral:', error)
    return NextResponse.json(
      { ok: false, message: 'Erro ao processar requisição' },
      { status: 500 }
    )
  }
}
