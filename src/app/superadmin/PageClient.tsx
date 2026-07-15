'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { AuditoriaAcesso } from '@/types/supabase'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import PerfilEditor from './_components/PerfilEditor'

type PerfilResumido = {
  id: string
  chave: string
  nome: string
  ativo: boolean
}

type UnidadeResumida = {
  id: string
  chave: string
  nome: string
  ativo: boolean
  ordem: number | null
}

type UsuarioComPerfil = {
  id: string
  email: string
  role: 'user' | 'superadmin'
  ativo: boolean
  created_at: string
  perfil: PerfilResumido | null
  unidades: UnidadeResumida[]
}

const EMAILS_PROTEGIDOS = ['lucas@lebebe.com.br', 'robyson@lebebe.com.br']
type SuperAdminTab = 'usuarios' | 'perfis' | 'auditoria'

export default function SuperAdminPageClient({
  initialTab,
  acessoTotal,
}: {
  initialTab: SuperAdminTab
  acessoTotal: boolean
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [usuarios, setUsuarios] = useState<UsuarioComPerfil[]>([])
  const [perfisDisponiveis, setPerfisDisponiveis] = useState<PerfilResumido[]>([])
  const [unidadesDisponiveis, setUnidadesDisponiveis] = useState<UnidadeResumida[]>([])
  const [auditoria, setAuditoria] = useState<AuditoriaAcesso[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<SuperAdminTab>(initialTab)

  const [novoEmail, setNovoEmail] = useState('')
  const [novaRole, setNovaRole] = useState<'user' | 'superadmin'>('user')
  const [novoPerfilId, setNovoPerfilId] = useState('')
  const [novasUnidadesIds, setNovasUnidadesIds] = useState<string[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [addingUser, setAddingUser] = useState(false)
  const [addUserError, setAddUserError] = useState('')
  const [addUserSuccess, setAddUserSuccess] = useState('')

  const [perfilLoadingId, setPerfilLoadingId] = useState<string | null>(null)
  const [unidadesDialogUsuario, setUnidadesDialogUsuario] = useState<UsuarioComPerfil | null>(null)
  const [unidadesSelecionadas, setUnidadesSelecionadas] = useState<string[]>([])
  const [savingUnidades, setSavingUnidades] = useState(false)

  const [filtroEmail, setFiltroEmail] = useState('')
  const [filtroAcao, setFiltroAcao] = useState('')

  useEffect(() => {
    const tab = searchParams.get('tab')
    if (tab === 'usuarios' || (acessoTotal && (tab === 'auditoria' || tab === 'perfis'))) {
      setActiveTab(tab)
    } else if (tab && tab !== 'usuarios') {
      router.replace('/superadmin?tab=usuarios')
    }
  }, [acessoTotal, router, searchParams])

  useEffect(() => {
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab])

  async function loadData() {
    if (activeTab === 'usuarios') {
      await Promise.all([loadUsuarios(), loadPerfisDisponiveis(), loadUnidades()])
    } else if (activeTab === 'auditoria' && acessoTotal) {
      await loadAuditoria()
    } else {
      setLoading(false)
    }
  }

  function handleTabChange(tab: string) {
    if (tab !== 'usuarios' && !acessoTotal) {
      router.push('/superadmin?tab=usuarios')
      return
    }
    if (tab === 'usuarios' || tab === 'perfis' || tab === 'auditoria') {
      setActiveTab(tab)
      router.push(`/superadmin?tab=${tab}`)
    }
  }

  async function loadUsuarios() {
    setLoading(true)
    try {
      const res = await fetch('/api/superadmin/usuarios')
      const data = await res.json()
      if (data.ok) {
        setUsuarios(data.usuarios)
      }
    } finally {
      setLoading(false)
    }
  }

  async function loadPerfisDisponiveis() {
    try {
      const res = await fetch('/api/superadmin/usuarios/perfis-disponiveis')
      const data = await res.json()
      if (data.ok) {
        setPerfisDisponiveis(data.perfis)
      }
    } catch {
      // perfis ficam vazios; UI degrada graciosamente
    }
  }

  async function loadUnidades() {
    try {
      const res = await fetch('/api/superadmin/unidades')
      const data = await res.json()
      if (data.ok) {
        setUnidadesDisponiveis(data.unidades)
      }
    } catch {
      // unidades ficam vazias; UI degrada graciosamente
    }
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
    if (addingUser) return

    setAddingUser(true)
    setAddUserError('')
    setAddUserSuccess('')

    try {
      const response = await fetch('/api/superadmin/adicionar-usuario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: novoEmail.toLowerCase().trim(),
          role: acessoTotal ? novaRole : 'user',
          perfilId: novoPerfilId || null,
          unidadeIds: novasUnidadesIds,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setAddUserError(data.message || 'Erro ao adicionar usuário')
        setAddingUser(false)
        return
      }

      setAddUserSuccess(data.message || 'Convite enviado com sucesso!')
      setNovoEmail('')
      setNovaRole('user')
      setNovoPerfilId('')
      setNovasUnidadesIds([])

      await loadUsuarios()

      setTimeout(() => {
        setDialogOpen(false)
        setAddUserSuccess('')
      }, 2000)

    } catch (error: unknown) {
      const mensagem = error instanceof Error ? error.message : 'Erro desconhecido'
      setAddUserError('Erro ao processar requisição: ' + mensagem)
    } finally {
      setAddingUser(false)
    }
  }

  async function handleBloquearUsuario(usuario: UsuarioComPerfil) {
    if (EMAILS_PROTEGIDOS.includes(usuario.email)) {
      alert('Não é permitido bloquear os superadmins iniciais')
      return
    }

    const confirm = window.confirm(`Deseja bloquear ${usuario.email}?`)
    if (!confirm) return

    try {
      const response = await fetch(`/api/superadmin/usuarios/${usuario.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ativo: false }),
      })

      const data = await response.json()

      if (!response.ok) {
        alert(data.message || 'Erro ao bloquear usuário')
        return
      }

      await loadUsuarios()
    } catch (error: unknown) {
      const mensagem = error instanceof Error ? error.message : 'Erro desconhecido'
      alert('Erro ao bloquear usuário: ' + mensagem)
    }
  }

  async function handleDesbloquearUsuario(usuario: UsuarioComPerfil) {
    try {
      const response = await fetch(`/api/superadmin/usuarios/${usuario.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ativo: true }),
      })

      const data = await response.json()

      if (!response.ok) {
        alert(data.message || 'Erro ao desbloquear usuário')
        return
      }

      await loadUsuarios()
    } catch (error: unknown) {
      const mensagem = error instanceof Error ? error.message : 'Erro desconhecido'
      alert('Erro ao desbloquear usuário: ' + mensagem)
    }
  }

  async function handleAlterarRole(usuario: UsuarioComPerfil, role: 'user' | 'superadmin') {
    if (EMAILS_PROTEGIDOS.includes(usuario.email) && role !== 'superadmin') {
      alert('Não é permitido alterar a role dos superadmins iniciais')
      return
    }

    try {
      const response = await fetch(`/api/superadmin/usuarios/${usuario.id}/role`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      })

      const data = await response.json()

      if (!response.ok) {
        alert(data.message || 'Erro ao alterar role')
        return
      }

      await loadUsuarios()
    } catch (error: unknown) {
      const mensagem = error instanceof Error ? error.message : 'Erro desconhecido'
      alert('Erro ao alterar role: ' + mensagem)
    }
  }

  async function handleAtribuirPerfil(usuario: UsuarioComPerfil, perfilId: string) {
    setPerfilLoadingId(usuario.id)
    try {
      const response = await fetch(`/api/superadmin/usuarios/${usuario.id}/perfil`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ perfilId }),
      })

      const data = await response.json()

      if (!response.ok) {
        alert(data.message || 'Erro ao atribuir perfil')
        return
      }

      await loadUsuarios()
    } catch (error: unknown) {
      const mensagem = error instanceof Error ? error.message : 'Erro desconhecido'
      alert('Erro ao atribuir perfil: ' + mensagem)
    } finally {
      setPerfilLoadingId(null)
    }
  }

  async function handleRemoverPerfil(usuario: UsuarioComPerfil) {
    const confirm = window.confirm(`Remover perfil de ${usuario.email}?`)
    if (!confirm) return

    setPerfilLoadingId(usuario.id)
    try {
      const response = await fetch(`/api/superadmin/usuarios/${usuario.id}/perfil`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (!response.ok) {
        alert(data.message || 'Erro ao remover perfil')
        return
      }

      await loadUsuarios()
    } catch (error: unknown) {
      const mensagem = error instanceof Error ? error.message : 'Erro desconhecido'
      alert('Erro ao remover perfil: ' + mensagem)
    } finally {
      setPerfilLoadingId(null)
    }
  }

  function toggleNovaUnidade(unidadeId: string) {
    setNovasUnidadesIds((atuais) =>
      atuais.includes(unidadeId)
        ? atuais.filter((id) => id !== unidadeId)
        : [...atuais, unidadeId]
    )
  }

  function abrirDialogUnidades(usuario: UsuarioComPerfil) {
    setUnidadesDialogUsuario(usuario)
    setUnidadesSelecionadas(usuario.unidades.map((u) => u.id))
  }

  function toggleUnidadeSelecionada(unidadeId: string) {
    setUnidadesSelecionadas((atuais) =>
      atuais.includes(unidadeId)
        ? atuais.filter((id) => id !== unidadeId)
        : [...atuais, unidadeId]
    )
  }

  async function handleSalvarUnidades() {
    if (!unidadesDialogUsuario) return

    setSavingUnidades(true)
    try {
      const response = await fetch(`/api/superadmin/usuarios/${unidadesDialogUsuario.id}/unidades`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ unidadeIds: unidadesSelecionadas }),
      })

      const data = await response.json()

      if (!response.ok) {
        alert(data.message || 'Erro ao salvar unidades')
        return
      }

      setUnidadesDialogUsuario(null)
      setUnidadesSelecionadas([])
      await loadUsuarios()
    } catch (error: unknown) {
      const mensagem = error instanceof Error ? error.message : 'Erro desconhecido'
      alert('Erro ao salvar unidades: ' + mensagem)
    } finally {
      setSavingUnidades(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Superadmin</h1>
          <p className="text-gray-600 mt-2">Gestão de usuários e auditoria do sistema</p>
        </div>

        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="usuarios">Usuários</TabsTrigger>
            {acessoTotal && <TabsTrigger value="perfis">Perfis</TabsTrigger>}
            {acessoTotal && <TabsTrigger value="auditoria">Auditoria</TabsTrigger>}
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
                          disabled={addingUser}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none disabled:bg-gray-100 disabled:cursor-not-allowed"
                          placeholder="usuario@exemplo.com"
                        />
                      </div>
                      {acessoTotal && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Role
                        </label>
                        <select
                          value={novaRole}
                          onChange={(e) => setNovaRole(e.target.value as 'user' | 'superadmin')}
                          disabled={addingUser}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none disabled:bg-gray-100 disabled:cursor-not-allowed"
                        >
                          <option value="user">User</option>
                          <option value="superadmin">Superadmin</option>
                        </select>
                      </div>
                      )}

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Perfil
                        </label>
                        <select
                          value={novoPerfilId}
                          onChange={(e) => setNovoPerfilId(e.target.value)}
                          disabled={addingUser}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none disabled:bg-gray-100 disabled:cursor-not-allowed"
                        >
                          <option value="">Sem perfil</option>
                          {perfisDisponiveis.map((perfil) => (
                            <option key={perfil.id} value={perfil.id}>
                              {perfil.nome}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Unidades
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {unidadesDisponiveis.map((unidade) => (
                            <label key={unidade.id} className="flex items-center gap-2 text-sm text-gray-700">
                              <input
                                type="checkbox"
                                checked={novasUnidadesIds.includes(unidade.id)}
                                onChange={() => toggleNovaUnidade(unidade.id)}
                                disabled={addingUser}
                                className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                              />
                              {unidade.nome}
                            </label>
                          ))}
                        </div>
                      </div>

                      {addUserError && (
                        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                          {addUserError}
                        </div>
                      )}

                      {addUserSuccess && (
                        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">
                          {addUserSuccess}
                        </div>
                      )}

                      <button
                        onClick={handleAdicionarUsuario}
                        disabled={addingUser || !novoEmail}
                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        {addingUser ? (
                          <>
                            <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                            </svg>
                            Enviando...
                          </>
                        ) : (
                          'Adicionar'
                        )}
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
                          Perfil
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Unidades
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
                      {usuarios.map((usuario) => {
                        const isProtegido = EMAILS_PROTEGIDOS.includes(usuario.email)
                        const isPerfilLoading = perfilLoadingId === usuario.id
                        return (
                          <tr key={usuario.id}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {usuario.email}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                              {acessoTotal ? (
                                <select
                                  value={usuario.role}
                                  onChange={(e) => handleAlterarRole(usuario, e.target.value as 'user' | 'superadmin')}
                                  className="px-3 py-1 border border-gray-300 rounded-md text-sm"
                                  disabled={isProtegido}
                                >
                                  <option value="user">User</option>
                                  <option value="superadmin">Superadmin</option>
                                </select>
                              ) : (
                                <span className="text-gray-700">
                                  {usuario.role === 'superadmin' ? 'Superadmin' : 'User'}
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                              {usuario.role === 'superadmin' ? (
                                <span className="px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                                  Acesso total
                                </span>
                              ) : (
                                <div className="flex items-center gap-2">
                                  <select
                                    value={usuario.perfil?.id ?? ''}
                                    onChange={(e) => {
                                      const val = e.target.value
                                      if (val === '') return
                                      handleAtribuirPerfil(usuario, val)
                                    }}
                                    disabled={isPerfilLoading}
                                    className="px-3 py-1 border border-gray-300 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed min-w-[140px]"
                                  >
                                    <option value="">Sem perfil</option>
                                    {perfisDisponiveis.map((p) => (
                                      <option key={p.id} value={p.id}>
                                        {p.nome}
                                      </option>
                                    ))}
                                  </select>
                                  {usuario.perfil && (
                                    <button
                                      onClick={() => handleRemoverPerfil(usuario)}
                                      disabled={isPerfilLoading}
                                      title="Remover perfil"
                                      className="text-gray-400 hover:text-red-600 disabled:opacity-50 disabled:cursor-not-allowed text-xs"
                                    >
                                      ✕
                                    </button>
                                  )}
                                  {isPerfilLoading && (
                                    <svg className="animate-spin h-4 w-4 text-indigo-500" fill="none" viewBox="0 0 24 24">
                                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                                    </svg>
                                  )}
                                </div>
                              )}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-700 min-w-[180px]">
                              <div className="flex items-center gap-2">
                                <span className="max-w-[220px] truncate">
                                  {usuario.unidades.length > 0
                                    ? usuario.unidades.map((u) => u.nome).join(', ')
                                    : 'Sem unidade'}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => abrirDialogUnidades(usuario)}
                                  disabled={!acessoTotal && usuario.role === 'superadmin'}
                                  className="text-indigo-600 hover:text-indigo-900 text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  Editar
                                </button>
                              </div>
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
                                  disabled={isProtegido}
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
                        )
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </TabsContent>

          <Dialog
            open={unidadesDialogUsuario !== null}
            onOpenChange={(open) => {
              if (!open) {
                setUnidadesDialogUsuario(null)
                setUnidadesSelecionadas([])
              }
            }}
          >
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Editar Unidades</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="text-sm text-gray-600">
                  {unidadesDialogUsuario?.email}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {unidadesDisponiveis.map((unidade) => (
                    <label key={unidade.id} className="flex items-center gap-2 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        checked={unidadesSelecionadas.includes(unidade.id)}
                        onChange={() => toggleUnidadeSelecionada(unidade.id)}
                        disabled={savingUnidades}
                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      {unidade.nome}
                    </label>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={handleSalvarUnidades}
                  disabled={savingUnidades}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {savingUnidades ? 'Salvando...' : 'Salvar unidades'}
                </button>
              </div>
            </DialogContent>
          </Dialog>

          <TabsContent value="perfis">
            {acessoTotal ? <PerfilEditor /> : null}
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
