import { redirect } from 'next/navigation';
import { checkModuleAndWindowAccess } from '@/lib/auth/module-access';
import FinalizacoesAutomaticasPageClient from './PageClient';

export default async function FinalizacoesAutomaticasPage() {
  const access = await checkModuleAndWindowAccess('digisac_finalizacoes_automaticas');
  if (!access.ok) redirect(access.redirectTo);

  return <FinalizacoesAutomaticasPageClient />;
}
