import { redirect } from 'next/navigation';
import { checkModuleAndWindowAccess } from '@/lib/auth/module-access';
import { HorariosAgendamentosPage } from '@/components/HorariosAgendamentosPage';

export default async function Page() {
    const access = await checkModuleAndWindowAccess('horarios_agendamentos');
    if (!access.ok) redirect(access.redirectTo);

    return <HorariosAgendamentosPage />;
}
