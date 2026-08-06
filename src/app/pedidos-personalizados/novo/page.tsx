import { redirect } from 'next/navigation'
import { checkModuleAndWindowAccess } from '@/lib/auth/module-access'
import NovoPedidoPersonalizadoPageClient from './PageClient'

export const dynamic = 'force-dynamic'

export default async function NovoPedidoPersonalizadoPage() {
  const access = await checkModuleAndWindowAccess('pedidos_personalizados_novo')
  if (!access.ok) redirect(access.redirectTo)

  return <NovoPedidoPersonalizadoPageClient />
}
