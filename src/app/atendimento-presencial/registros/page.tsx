import { redirect } from 'next/navigation'
import { checkModuleAndWindowAccess } from '@/lib/auth/module-access'
import RegistrosPageClient from './RegistrosPageClient'

export const dynamic = 'force-dynamic'

export default async function RegistrosAtendimentosPresenciaisPage() {
  const access = await checkModuleAndWindowAccess('atendimento_presencial_registros')
  if (!access.ok) redirect(access.redirectTo)

  return <RegistrosPageClient />
}
