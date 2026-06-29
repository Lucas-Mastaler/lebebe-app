import { redirect } from 'next/navigation'
import { checkModuleAndWindowAccess } from '@/lib/auth/module-access'

export default async function PosVendaPage() {
  const access = await checkModuleAndWindowAccess('pos_venda')
  if (!access.ok) redirect(access.redirectTo)

  redirect('/pos-venda/importar-nfe')
}
