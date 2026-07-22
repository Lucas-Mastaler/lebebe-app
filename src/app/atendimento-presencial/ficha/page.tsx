import { redirect } from 'next/navigation'
import { checkModuleAndWindowAccess } from '@/lib/auth/module-access'
import { createServiceClient } from '@/lib/supabase/service'
import {
  carregarPerfilAtendimento,
  listarUnidadesDoContexto,
} from '@/lib/atendimento-presencial/rascunhos'
import type { ContextoAtendimento } from '@/lib/atendimento-presencial/rascunhos-shared'
import FichaPageClient from './FichaPageClient'

export const dynamic = 'force-dynamic'

type SearchParams = Promise<{ rascunho?: string | string[] }>

export default async function FichaAtendimentoPresencialPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const access = await checkModuleAndWindowAccess('atendimento_presencial_ficha')
  if (!access.ok) redirect(access.redirectTo)

  const supabase = createServiceClient()
  const perfil = await carregarPerfilAtendimento(supabase, access.moduleAccess.allowedUser)
  if (perfil === null) redirect('/acesso-negado')

  const unidadesPermitidas = await listarUnidadesDoContexto(supabase, access.moduleAccess.allowedUser, perfil)

  const contextoInicial: ContextoAtendimento = {
    perfil,
    usuarioId: access.moduleAccess.allowedUser.id,
    acessoTotal: access.moduleAccess.acessoTotal,
    unidadesPermitidas,
  }

  const params = await searchParams
  const rascunhoId = typeof params.rascunho === 'string' ? params.rascunho : null
  const unidadeIdInicial = !rascunhoId && unidadesPermitidas.length === 1 ? unidadesPermitidas[0].id : ''

  return (
    <FichaPageClient
      usuarioId={access.moduleAccess.allowedUser.id}
      contextoInicial={contextoInicial}
      unidadeIdInicial={unidadeIdInicial}
    />
  )
}
