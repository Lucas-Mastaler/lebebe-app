import { redirect } from 'next/navigation'
import { checkModuleAndWindowAccess } from '@/lib/auth/module-access'
import PageClient from './PageClient'
import { carregarPerfilAtendimento } from '@/lib/atendimento-presencial/rascunhos'
import { createServiceClient } from '@/lib/supabase/service'
export const dynamic = 'force-dynamic'
export default async function FlowPage() {
  const access = await checkModuleAndWindowAccess('atendimento_presencial_fluxo_lojas')
  if (!access.ok) redirect(access.redirectTo)
  const perfil = await carregarPerfilAtendimento(createServiceClient(), access.moduleAccess.allowedUser)
  if (!perfil || !['superadmin', 'gestao', 'supervisora_loja'].includes(perfil)) redirect('/acesso-negado')
  return <PageClient />
}
