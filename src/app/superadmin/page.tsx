'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { UsuarioPermitido, AuditoriaAcesso } from '@/types/supabase'
import { registrarAuditoria } from '@/lib/auth/helpers'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

function SuperAdminPageContent() {
  const searchParams = useSearchParams()
  const [usuarios, setUsuarios] = useState<UsuarioPermitido[]>([])
  const [auditoria, setAuditoria] = useState<AuditoriaAcesso[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('usuarios')

  const [novoEmail, setNovoEmail] = useState('')
  const [novaRole, setNovaRole] = useState<'user' | 'superadmin'>('user')
  const [dialogOpen, setDialogOpen] = useState(false)

  const [filtroEmail, setFiltroEmail] = useState('')
  const [filtroAcao, setFiltroAcao] = useState('')

  const [currentUser, setCurrentUser] = useState<string | null>(null)

  useEffect(() => {
    const tab = searchParams.get('tab')
    if (tab === 'usuarios' || tab === 'auditoria') {
      setActiveTab(tab)
    }
  }, [searchParams])

  useEffect(() => {
    loadData()
  }, [activeTab])

  async function loadData() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    setCurrentUser(user?.email || null)

    if (activeTab === 'usuarios') {
      await loadUsuarios()
    } else {
      await loadAuditoria()
    }
  }

  async function loadUsuarios() {
    setLoading(true)
    const supabase = createClient()
    const { data, error } = await supabase
      .from('usuarios_permitidos')
      .select('*')
      .order('created_at', { ascending: false })

    if (!error && data) {
      setUsuarios(data)
    }
    setLoading(false)
  }

  async function loadAuditoria() {
    setLoading(true)
    const supabase = createClient()
    let query = supabase
      .from('auditoria_acessos')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100)

    if (filtroEmail) {
      query = query.ilike('email', `%${filtroEmail}%`)
    }
    if (filtroAcao) {
      query = query.eq('acao', filtroAcao)
    }

    const { data, error } = await query

    if (!error && data) {
      setAuditoria(data)
    }
    setLoading(false)
  }

  async function handleAdicionarUsuario() {
    if (!novoEmail) return

    const supabase = createClient()
    const { error } = await supabase
      .from('usuarios_permitidos')
      .insert({
        email: novoEmail.toLowerCase().trim(),
        role: novaRole,
        ativo: true,
      })

    if (!error) {
      await registrarAuditoria('USUARIO_PERMITIDO_CRIADO', currentUser || undefined, {
        novo_usuario: novoEmail,
        role: novaRole,
      })
      setNovoEmail('')
      setNovaRole('user')
      setDialogOpen(false)
      await loadUsuarios()
    } else {
      alert('Erro ao adicionar usuário: ' + error.message)
    }
  }

  async function handleBloquearUsuario(usuario: UsuarioPermitido) {
    if (usuario.email === 'lucas@lebebe.com.br' || usuario.email === 'robyson@lebebe.com.br') {
      alert('Não é permitido bloquear os superadmins iniciais')
      return
    }

    const confirm = window.confirm(`Deseja bloquear ${usuario.email}?`)
    if (!confirm) return

    const supabase = createClient()
    const { error } = await supabase
      .from('usuarios_permitidos')
      .update({ ativo: false })
      .eq('id', usuario.id)

    if (!error) {
      await registrarAuditoria('USUARIO_BLOQUEADO', currentUser || undefined, {
        usuario_bloqueado: usuario.email,
      })
      await loadUsuarios()
    } else {
      alert('Erro ao bloquear usuário: ' + error.message)
    }
  }

  async function handleDesbloquearUsuario(usuario: UsuarioPermitido) {
    const supabase = createClient()
    const { error } = await supabase
      .from('usuarios_permitidos')
      .update({ ativo: true })
      .eq('id', usuario.id)

    if (!error) {
      await registrarAuditoria('USUARIO_DESBLOQUEADO', currentUser || undefined, {
        usuario_desbloqueado: usuario.email,
      })
      await loadUsuarios()
    } else {
      alert('Erro ao desbloquear usuário: ' + error.message)
    }
  }

  async function handleAlterarRole(usuario: UsuarioPermitido, novaRole: 'user' | 'superadmin') {
    if (usuario.email === 'lucas@lebebe.com.br' || usuario.email === 'robyson@lebebe.com.br') {
      if (novaRole !== 'superadmin') {
        alert('Não é permitido alterar a role dos superadmins iniciais')
        return
      }
    }

    const supabase = createClient()
    const { error } = await supabase
      .from('usuarios_permitidos')
      .update({ role: novaRole })
      .eq('id', usuario.id)

    if (!error) {
      await registrarAuditoria('ROLE_ALTERADA', currentUser || undefined, {
        usuario: usuario.email,
        role_anterior: usuario.role,
        role_nova: novaRole,
      })
      await loadUsuarios()
    } else {
      alert('Erro ao alterar role: ' + error.message)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Superadmin</h1>
          <p className="text-gray-600 mt-2">Gestão de usuários e auditoria do sistema</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="usuarios">Usuários</TabsTrigger>
            <TabsTrigger value="auditoria">Auditoria</TabsTrigger>
          </TabsList>

          <TabsContent value="usuarios">
            <div className="bg-white rounded-lg shadow">
              <div className="p-6 border-b border-gray-200 flex justify-between items-center">
                <h2 className="text-xl font-semibold">Usuários Permitidos</h2>
                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                  <DialogTrigger asChild>
                    <button className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium transition">
                      Adicionar Usuário
                    </button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Adicionar Novo Usuário</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          E-mail
                        </label>
                        <input
                          type="email"
                          value={novoEmail}
                          onChange={(e) => setNovoEmail(e.target.value)}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                          placeholder="usuario@exemplo.com"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Role
                        </label>
                        <select
                          value={novaRole}
                          onChange={(e) => setNovaRole(e.target.value as 'user' | 'superadmin')}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                        >
                          <option value="user">User</option>
                          <option value="superadmin">Superadmin</option>
                        </select>
                      </div>
                      <button
                        onClick={handleAdicionarUsuario}
                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium transition"
                      >
                        Adicionar
                      </button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
              <div className="overflow-x-auto">
                {loading ? (
                  <div className="p-8 text-center text-gray-500">Carregando...</div>
                ) : (
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Email
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Role
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Data de Criação
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Ações
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {usuarios.map((usuario) => (
                        <tr key={usuario.id}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {usuario.email}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            <select
                              value={usuario.role}
                              onChange={(e) => handleAlterarRole(usuario, e.target.value as 'user' | 'superadmin')}
                              className="px-3 py-1 border border-gray-300 rounded-md text-sm"
                              disabled={usuario.email === 'lucas@lebebe.com.br' || usuario.email === 'robyson@lebebe.com.br'}
                            >
                              <option value="user">User</option>
                              <option value="superadmin">Superadmin</option>
                            </select>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              usuario.ativo 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {usuario.ativo ? 'Ativo' : 'Bloqueado'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {format(new Date(usuario.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm space-x-2">
                            {usuario.ativo ? (
                              <button
                                onClick={() => handleBloquearUsuario(usuario)}
                                disabled={usuario.email === 'lucas@lebebe.com.br' || usuario.email === 'robyson@lebebe.com.br'}
                                className="text-red-600 hover:text-red-900 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                Bloquear
                              </button>
                            ) : (
                              <button
                                onClick={() => handleDesbloquearUsuario(usuario)}
                                className="text-green-600 hover:text-green-900"
                              >
                                Desbloquear
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="auditoria">
            <div className="bg-white rounded-lg shadow">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-xl font-semibold mb-4">Auditoria de Acessos</h2>
                <div className="flex gap-4">
                  <input
                    type="text"
                    placeholder="Filtrar por email"
                    value={filtroEmail}
                    onChange={(e) => setFiltroEmail(e.target.value)}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                  />
                  <input
                    type="text"
                    placeholder="Filtrar por ação"
                    value={filtroAcao}
                    onChange={(e) => setFiltroAcao(e.target.value)}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                  />
                  <button
                    onClick={loadAuditoria}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg font-medium transition"
                  >
                    Filtrar
                  </button>
                </div>
              </div>
              <div className="overflow-x-auto">
                {loading ? (
                  <div className="p-8 text-center text-gray-500">Carregando...</div>
                ) : (
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Ação
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Email
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          IP
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Data e Hora
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Metadata
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {auditoria.map((registro) => (
                        <tr key={registro.id}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              registro.acao.includes('SUCESSO') || registro.acao.includes('CRIADO') || registro.acao.includes('DESBLOQUEADO')
                                ? 'bg-green-100 text-green-800'
                                : registro.acao.includes('FALHA') || registro.acao.includes('BLOQUEADO')
                                ? 'bg-red-100 text-red-800'
                                : 'bg-blue-100 text-blue-800'
                            }`}>
                              {registro.acao}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {registro.email || '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {registro.ip || '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {format(new Date(registro.created_at), "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR })}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">
                            {registro.metadata ? JSON.stringify(registro.metadata) : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

export default function SuperAdminPage() {
  return (
    <Suspense fallback={null}>
      <SuperAdminPageContent />
    </Suspense>
  )
}
