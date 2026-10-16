import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { carregarPerfilAtendimento, listarUnidadesDoContexto, requireAtendimentoPresencialFichaAccess } from '@/lib/atendimento-presencial/rascunhos'
import { CONSULTORAS_RECENTES_LIMITE, CONSULTORAS_RECENTES_PAGINA, nomesConsultorasRecentes } from '@/lib/atendimento-presencial/consultoras-recentes'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  try {
    const auth = await requireAtendimentoPresencialFichaAccess()
    if (!auth.ok) return auth.response
    const supabase = createServiceClient()
    const perfil = await carregarPerfilAtendimento(supabase, auth.allowedUser)
    if (!perfil) return NextResponse.json({ ok: false, message: 'Perfil nao encontrado' }, { status: 403 })
    const unidades = await listarUnidadesDoContexto(supabase, auth.allowedUser, perfil)
    const unidadeId = new URL(request.url).searchParams.get('unidadeId')
    if (!unidadeId || !unidades.some((unidade) => unidade.id === unidadeId)) {
      return NextResponse.json({ ok: false, message: 'Unidade nao autorizada' }, { status: 403 })
    }

    // Paginar até quatro distintos ou fim: repetição não esconde nomes mais antigos.
    // Índices existentes por login/data e unidade/data; nenhum rascunho é fonte.
    let nomes: string[] = []
    for (let offset = 0; ; offset += CONSULTORAS_RECENTES_PAGINA) {
      const { data, error } = await supabase.from('atendimento_presencial_atendimentos')
        .select('consultora_nome')
        .eq('consultora_usuario_id', auth.allowedUser.id)
        .eq('unidade_id', unidadeId)
        .eq('status', 'concluido')
        .not('consultora_nome', 'is', null)
        .order('concluido_em', { ascending: false, nullsFirst: false })
        .order('id', { ascending: false })
        .range(offset, offset + CONSULTORAS_RECENTES_PAGINA - 1)
      if (error) throw error
      nomes = nomesConsultorasRecentes([
        ...nomes.map((consultora_nome) => ({ consultora_nome })), ...(data ?? []),
      ])
      if (nomes.length === CONSULTORAS_RECENTES_LIMITE || (data ?? []).length < CONSULTORAS_RECENTES_PAGINA) break
    }
    return NextResponse.json({ ok: true, nomes }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    console.error('[PRANCHETA CONSULTORAS RECENTES] Falha na consulta:', error)
    return NextResponse.json({ ok: false, message: 'Nao foi possivel carregar as ultimas consultoras.' }, { status: 500 })
  }
}
