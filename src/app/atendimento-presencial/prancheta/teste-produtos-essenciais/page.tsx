import { redirect } from 'next/navigation'
import { requireAuthenticatedUser } from '@/lib/auth/api-auth'
import PageClient from './PageClient'

export const dynamic = 'force-dynamic'
export const metadata = {
  title: 'Laboratório — Produtos essenciais',
  robots: { index: false, follow: false },
}

export default async function PaginaExperimentalEssenciais() {
  // Laboratório disponível em produção para qualquer login ativo, sem conceder módulos.
  const auth = await requireAuthenticatedUser({ requireAllowedUser: true, requireActive: true })
  if (!auth.ok) redirect(auth.response.status === 401 ? '/login' : '/acesso-negado')
  return <PageClient />
}
