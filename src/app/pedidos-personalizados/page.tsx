import { redirect } from 'next/navigation'
import { checkModuleAndWindowAccess } from '@/lib/auth/module-access'
import PedidosPersonalizadosPageClient from './PageClient'

export const dynamic = 'force-dynamic'

export default async function PedidosPersonalizadosPage() {
  const access = await checkModuleAndWindowAccess('pedidos_personalizados_gestao')
  if (!access.ok) redirect(access.redirectTo)
  return <PedidosPersonalizadosPageClient />
}
