import { redirect } from 'next/navigation'
import { checkModuleAndWindowAccess } from '@/lib/auth/module-access'
import RegistrosPageClient from './RegistrosPageClient'

export const dynamic = 'force-dynamic'

export default async function RegistrosAtendimentosPresenciaisPage() {
  const acessoRegistros = await checkModuleAndWindowAccess('atendimento_presencial_registros')
  const acessoRascunhos = await checkModuleAndWindowAccess('atendimento_presencial_ficha')

  if (!acessoRegistros.ok && !acessoRascunhos.ok) {
    const foraDoHorario = acessoRegistros.redirectTo === '/fora-do-horario' || acessoRascunhos.redirectTo === '/fora-do-horario'
    redirect(foraDoHorario ? '/fora-do-horario' : acessoRegistros.redirectTo)
  }

  return (
    <RegistrosPageClient
      podeVerRegistros={acessoRegistros.ok}
      podeVerRascunhos={acessoRascunhos.ok}
    />
  )
}
