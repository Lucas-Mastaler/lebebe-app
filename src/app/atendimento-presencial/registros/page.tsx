import { ClipboardList } from 'lucide-react'
import { redirect } from 'next/navigation'
import { checkModuleAndWindowAccess } from '@/lib/auth/module-access'

export const dynamic = 'force-dynamic'

export default async function RegistrosAtendimentosPresenciaisPage() {
  const access = await checkModuleAndWindowAccess('atendimento_presencial_registros')
  if (!access.ok) redirect(access.redirectTo)

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <header>
          <p className="text-sm font-medium uppercase text-slate-500">ATENDIMENTO PRESENCIAL</p>
          <h1 className="mt-2 text-2xl font-semibold text-slate-950 sm:text-3xl">
            Registros de Atendimentos
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-600">
            Base inicial da tela de registros presenciais, liberada pelo controle atual de modulos.
          </p>
        </header>

        <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-sky-50 text-sky-600">
              <ClipboardList className="h-6 w-6" aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-950">Modulo em preparacao</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Modulo em preparacao. O acesso a esta tela ja esta configurado corretamente.
              </p>
              <p className="mt-3 text-sm leading-6 text-slate-500">
                Esta fase nao possui filtros, listagem funcional, chamadas de API ou criacao de dados.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}
