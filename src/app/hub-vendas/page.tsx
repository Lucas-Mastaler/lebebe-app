import { redirect } from 'next/navigation'
import {
  acessoHubVendasPermiteGerenciamento,
  checkHubVendasViewAndWindowAccess,
} from '@/lib/auth/module-access'
import PageClient from './PageClient'

export default async function HubVendasGestaoPage() {
  const access = await checkHubVendasViewAndWindowAccess()
  if (!access.ok) redirect(access.redirectTo)

  return <PageClient podeGerenciar={acessoHubVendasPermiteGerenciamento(access.moduleAccess)} />
}
