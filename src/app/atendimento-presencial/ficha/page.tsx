import { redirect } from 'next/navigation'
import { checkModuleAndWindowAccess } from '@/lib/auth/module-access'
import FichaPageClient from './FichaPageClient'

export const dynamic = 'force-dynamic'

export default async function FichaAtendimentoPresencialPage() {
  const access = await checkModuleAndWindowAccess('atendimento_presencial_ficha')
  if (!access.ok) redirect(access.redirectTo)

  return <FichaPageClient usuarioId={access.moduleAccess.allowedUser.id} />
}
