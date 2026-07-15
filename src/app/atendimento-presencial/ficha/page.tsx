import { redirect } from 'next/navigation'
import { checkModuleAndWindowAccess } from '@/lib/auth/module-access'
import PageClient from './PageClient'

export const dynamic = 'force-dynamic'

export default async function FichaAtendimentoPresencialPage() {
  const access = await checkModuleAndWindowAccess('atendimento_presencial_ficha')
  if (!access.ok) redirect(access.redirectTo)

  return <PageClient usuarioId={access.moduleAccess.allowedUser.id} />
}
