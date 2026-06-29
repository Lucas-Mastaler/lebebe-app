import { redirect } from 'next/navigation'
import { checkModuleAccess } from '@/lib/auth/module-access'

export default async function PosVendaPage() {
  const access = await checkModuleAccess('pos_venda')
  if (!access.ok) redirect('/acesso-negado')

  redirect('/pos-venda/importar-nfe')
}
