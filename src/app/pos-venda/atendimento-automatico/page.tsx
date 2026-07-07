import { redirect } from 'next/navigation'
import { checkModuleAndWindowAccess } from '@/lib/auth/module-access'
import PageClient from './PageClient'

export default async function AtendimentoAutomaticoPage() {
  const access = await checkModuleAndWindowAccess('pos_venda_atendimento_automatico')
  if (!access.ok) redirect(access.redirectTo)

  return <PageClient />
}
