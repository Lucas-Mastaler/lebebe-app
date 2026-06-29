import { createServiceClient } from '@/lib/supabase/service'
import { requireAuthenticatedUser } from '@/lib/auth/api-auth'
import { NextResponse } from 'next/server'
import type {
  AppModulo,
  AppPermissaoUsuario,
  AppPermissaoPerfil,
  AppJanelaAcessoUsuario,
  AppJanelaAcessoPerfil,
  TipoJanelaPerfil,
} from '@/types/supabase'

export const runtime = 'nodejs'

type OrigemPermissao = 'superadmin' | 'usuario' | 'perfil'

type ModuloPermitido = {
  id: string
  chave: string
  nome: string
  rotaBase: string | null
  categoria: string | null
  publico: boolean
  somenteSuperadmin: boolean
  origem: OrigemPermissao
}

type JanelaUsuario = {
  id: string
  diasSemana: number[]
  horaInicio: string
  horaFim: string
  timezone: string
  ativo: boolean
}

type JanelaPerfil = {
  id: string
  tipo: TipoJanelaPerfil
  ativo: boolean
  horaInicio: string | null
  horaFim: string | null
  timezone: string
}

type PerfilAtual = {
  id: string
  chave: string
  nome: string
} | null

type PermissoesResponse = {
  ok: true
  usuario: {
    id: string
    email: string
    role: string
    ativo: boolean
  }
  perfilAtual: PerfilAtual
  modulosPermitidos: ModuloPermitido[]
  chavesPermitidas: string[]
  janelasAcesso: {
    perfil: JanelaPerfil[]
    usuario: JanelaUsuario[]
  }
  acessoTotal: boolean
}

type ModuloRow = Pick<AppModulo, 'id' | 'chave' | 'nome' | 'rota_base' | 'categoria' | 'publico' | 'somente_superadmin' | 'ativo'>

export async function GET() {
  try {
    const auth = await requireAuthenticatedUser({
      requireAllowedUser: true,
      requireActive: true,
    })

    if (!auth.ok) {
      return auth.response
    }

    const allowedUser = auth.allowedUser!
    const supabaseAdmin = createServiceClient()

    const { data: todosModulos, error: modulosError } = await supabaseAdmin
      .from('app_modulos')
      .select('id, chave, nome, rota_base, categoria, publico, somente_superadmin, ativo')
      .eq('ativo', true)
      .order('ordem', { ascending: true, nullsFirst: false })
      .order('nome', { ascending: true })

    if (modulosError) {
      console.error('[ME PERMISSOES] Erro ao buscar módulos:', modulosError)
      return NextResponse.json(
        { ok: false, message: 'Erro ao processar requisição' },
        { status: 500 }
      )
    }

    const modulos: ModuloRow[] = todosModulos ?? []

    const usuario = {
      id: allowedUser.id,
      email: allowedUser.email,
      role: allowedUser.role,
      ativo: allowedUser.ativo,
    }

    if (allowedUser.role === 'superadmin') {
      const modulosPermitidos: ModuloPermitido[] = modulos.map((m) => ({
        id: m.id,
        chave: m.chave,
        nome: m.nome,
        rotaBase: m.rota_base,
        categoria: m.categoria,
        publico: m.publico,
        somenteSuperadmin: m.somente_superadmin,
        origem: 'superadmin' as OrigemPermissao,
      }))

      const resposta: PermissoesResponse = {
        ok: true,
        usuario,
        perfilAtual: null,
        modulosPermitidos,
        chavesPermitidas: modulosPermitidos.map((m) => m.chave),
        janelasAcesso: { perfil: [], usuario: [] },
        acessoTotal: true,
      }

      return NextResponse.json(resposta)
    }

    // Buscar perfil, exceções individuais e janelas em paralelo
    const [
      perfilResult,
      excecaoResult,
      janelaUsuarioResult,
    ] = await Promise.all([
      supabaseAdmin
        .from('app_usuarios_perfis')
        .select('perfil_id, app_perfis_acesso!inner(id, chave, nome, ativo)')
        .eq('usuario_id', allowedUser.id)
        .single(),

      supabaseAdmin
        .from('app_permissoes_usuario')
        .select('modulo_id, permitido')
        .eq('usuario_id', allowedUser.id),

      supabaseAdmin
        .from('app_janelas_acesso_usuario')
        .select('id, dias_semana, hora_inicio, hora_fim, timezone, ativo')
        .eq('usuario_id', allowedUser.id),
    ])

    if (excecaoResult.error) {
      console.error('[ME PERMISSOES] Erro ao buscar exceções individuais:', excecaoResult.error)
      return NextResponse.json(
        { ok: false, message: 'Erro ao processar requisição' },
        { status: 500 }
      )
    }

    if (janelaUsuarioResult.error) {
      console.error('[ME PERMISSOES] Erro ao buscar janelas do usuário:', janelaUsuarioResult.error)
      return NextResponse.json(
        { ok: false, message: 'Erro ao processar requisição' },
        { status: 500 }
      )
    }

    // Exceções individuais: modulo_id -> boolean
    const excecaoMap = new Map<string, boolean>(
      (excecaoResult.data ?? []).map(
        (p: Pick<AppPermissaoUsuario, 'modulo_id' | 'permitido'>) => [p.modulo_id, p.permitido]
      )
    )

    // Janelas do usuário (todas, ativas e inativas — para consulta futura de bloqueio)
    const janelasUsuario: JanelaUsuario[] = (janelaUsuarioResult.data ?? []).map(
      (j: Pick<AppJanelaAcessoUsuario, 'id' | 'dias_semana' | 'hora_inicio' | 'hora_fim' | 'timezone' | 'ativo'>) => ({
        id: j.id,
        diasSemana: j.dias_semana,
        horaInicio: j.hora_inicio,
        horaFim: j.hora_fim,
        timezone: j.timezone,
        ativo: j.ativo,
      })
    )

    // Perfil ativo do usuário (null se não tiver ou se perfil estiver inativo)
    type PerfilRow = { id: string; chave: string; nome: string; ativo: boolean }
    const perfilRaw = perfilResult.data as { perfil_id: string; app_perfis_acesso: PerfilRow } | null
    const perfilInfo = perfilRaw?.app_perfis_acesso
    const perfilAtivo = perfilInfo?.ativo === true ? perfilInfo : null

    let perfilAtual: PerfilAtual = null
    let permissoesPerfil: Map<string, boolean> = new Map()
    let janelasPerfil: JanelaPerfil[] = []

    if (perfilAtivo) {
      perfilAtual = {
        id: perfilAtivo.id,
        chave: perfilAtivo.chave,
        nome: perfilAtivo.nome,
      }

      const [permPerfilResult, janelaPerfilResult] = await Promise.all([
        supabaseAdmin
          .from('app_permissoes_perfil')
          .select('modulo_id, permitido')
          .eq('perfil_id', perfilAtivo.id),

        supabaseAdmin
          .from('app_janelas_acesso_perfil')
          .select('id, tipo, ativo, hora_inicio, hora_fim, timezone')
          .eq('perfil_id', perfilAtivo.id),
      ])

      if (permPerfilResult.error) {
        console.error('[ME PERMISSOES] Erro ao buscar permissões do perfil:', permPerfilResult.error)
        return NextResponse.json(
          { ok: false, message: 'Erro ao processar requisição' },
          { status: 500 }
        )
      }

      if (janelaPerfilResult.error) {
        console.error('[ME PERMISSOES] Erro ao buscar janelas do perfil:', janelaPerfilResult.error)
        return NextResponse.json(
          { ok: false, message: 'Erro ao processar requisição' },
          { status: 500 }
        )
      }

      permissoesPerfil = new Map(
        (permPerfilResult.data ?? []).map(
          (p: Pick<AppPermissaoPerfil, 'modulo_id' | 'permitido'>) => [p.modulo_id, p.permitido]
        )
      )

      janelasPerfil = (janelaPerfilResult.data ?? []).map(
        (j: Pick<AppJanelaAcessoPerfil, 'id' | 'tipo' | 'ativo' | 'hora_inicio' | 'hora_fim' | 'timezone'>) => ({
          id: j.id,
          tipo: j.tipo,
          ativo: j.ativo,
          horaInicio: j.hora_inicio,
          horaFim: j.hora_fim,
          timezone: j.timezone,
        })
      )
    }

    // Resolver permissão efetiva por módulo
    // Regras (em ordem de precedência):
    //   1. somente_superadmin=true -> bloquear sempre
    //   2. exceção individual em app_permissoes_usuario -> prevalece
    //   3. permissão do perfil ativo -> usa app_permissoes_perfil
    //   4. sem perfil ou sem linha no perfil -> bloquear
    const modulosPermitidos: ModuloPermitido[] = []

    for (const m of modulos) {
      if (m.somente_superadmin) continue

      let permitido = false
      let origem: OrigemPermissao = 'perfil'

      if (excecaoMap.has(m.id)) {
        permitido = excecaoMap.get(m.id) === true
        origem = 'usuario'
      } else if (permissoesPerfil.has(m.id)) {
        permitido = permissoesPerfil.get(m.id) === true
        origem = 'perfil'
      }
      // sem exceção e sem perfil -> permitido permanece false

      if (permitido) {
        modulosPermitidos.push({
          id: m.id,
          chave: m.chave,
          nome: m.nome,
          rotaBase: m.rota_base,
          categoria: m.categoria,
          publico: m.publico,
          somenteSuperadmin: m.somente_superadmin,
          origem,
        })
      }
    }

    const resposta: PermissoesResponse = {
      ok: true,
      usuario,
      perfilAtual,
      modulosPermitidos,
      chavesPermitidas: modulosPermitidos.map((m) => m.chave),
      janelasAcesso: {
        perfil: janelasPerfil,
        usuario: janelasUsuario,
      },
      acessoTotal: false,
    }

    return NextResponse.json(resposta)

  } catch (error) {
    console.error('[ME PERMISSOES] Erro geral:', error)
    return NextResponse.json(
      { ok: false, message: 'Erro ao processar requisição' },
      { status: 500 }
    )
  }
}
