import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import DevV2PesquisarCompatClient from './DevV2PesquisarCompatClient'

/**
 * Página interna de dev para validar o polling compatível simulado v2.
 *
 * Proteção:
 * - Já passa pelo middleware de /procurar-datas/:path* (autenticação Supabase + usuário ativo).
 * - Adicionalmente restringe a superadmin, seguindo o padrão de /superadmin e /configuracoes.
 *
 * Não altera produção, frontend principal, rotas legadas, motor, orquestrador, Apps Script
 * nem banco. Consome apenas as rotas v2 paralelas já existentes.
 */
export default async function DevV2PesquisarCompatPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user?.email) {
    redirect('/login')
  }

  const { data: usuarioPermitido } = await supabase
    .from('usuarios_permitidos')
    .select('role')
    .eq('email', user.email.toLowerCase())
    .single()

  if (usuarioPermitido?.role !== 'superadmin') {
    redirect('/inicio')
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Dev v2 / Procurar datas</h1>
        <p className="text-slate-600 mt-1">
          Validação interna do polling compatível simulado: <code>pesquisar-compat-async</code> + <code>progresso-compat</code>.
        </p>
      </div>

      <DevV2PesquisarCompatClient />
    </div>
  )
}
