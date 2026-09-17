'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ShieldCheck, Ban, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { AuditoriaAcesso } from '@/types/supabase'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import PerfilEditor from './_components/PerfilEditor'
import {
  PageContainer, PageHeader, Card, CardHeader, CardContent, Button, IconButton,
  FormField, Input, Badge, Alert, Spinner, ResponsiveTable,
  FilterPanel, FilterFieldGroup, useFilterState,
  Dialog, DialogTrigger, DialogContent, DialogHeader, DialogBody,
  Tabs, TabsContent, SegmentedTabsList, SegmentedTabsTrigger,
} from '@/components/design-system'

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

/** Sentinela para "Sem perfil" — Radix Select não aceita `SelectItem value=""` (mesmo padrão já usado em `/procurar-datas` e `/pos-venda/atendimento-automatico`). */
const SEM_PERFIL = '__SEM_PERFIL__'

/** Mapeamento de tom registrado (lacuna: `Badge` tem só 6 tons; "Acesso total" era roxo ad hoc, sem equivalente direto — `brand` foi o tom mais próximo de um indicador de privilégio elevado, mesmo padrão de mapeamento já aceito em outras telas da fila). */
const ACAO_TONE = (acao: string): 'success' | 'danger' | 'info' => {
  if (acao.includes('SUCESSO') || acao.includes('CRIADO') || acao.includes('DESBLOQUEADO')) return 'success'
  if (acao.includes('FALHA') || acao.includes('BLOQUEADO')) return 'danger'
  return 'info'
}

type FiltrosAuditoria = { email: string; acao: string }
const FILTROS_AUDITORIA_VAZIOS: FiltrosAuditoria = { email: '', acao: '' }

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

  const filtrosAuditoria = useFilterState<FiltrosAuditoria>(FILTROS_AUDITORIA_VAZIOS)

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
      await loadAuditoria(filtrosAuditoria.applied)
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

  async function loadAuditoria(valores: FiltrosAuditoria) {
    setLoading(true)
    const supabase = createClient()
    let query = supabase
      .from('auditoria_acessos')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100)

    if (valores.email) {
      query = query.ilike('email', `%${valores.email}%`)
    }
    if (valores.acao) {
      query = query.eq('acao', valores.acao)
    }

    const { data, error } = await query

    if (!error && data) {
      setAuditoria(data)
    }
    setLoading(false)
  }

  function aplicarFiltrosAuditoria() {
    filtrosAuditoria.apply()
    void loadAuditoria(filtrosAuditoria.draft)
  }

  function limparFiltrosAuditoria() {
    filtrosAuditoria.clear()
    void loadAuditoria(FILTROS_AUDITORIA_VAZIOS)
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
    <PageContainer>
      <PageHeader
        icon={<ShieldCheck className="size-6" />}
        eyebrow="Superadmin"
        title="Superadmin"
        description="Gestão de usuários e auditoria do sistema"
      />

      <div className="mt-6">
        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          <SegmentedTabsList className="mb-6">
            <SegmentedTabsTrigger value="usuarios">Usuários</SegmentedTabsTrigger>
            {acessoTotal && <SegmentedTabsTrigger value="perfis">Perfis</SegmentedTabsTrigger>}
            {acessoTotal && <SegmentedTabsTrigger value="auditoria">Auditoria</SegmentedTabsTrigger>}
          </SegmentedTabsList>

          <TabsContent value="usuarios">
            <Card>
              <CardHeader
                title="Usuários Permitidos"
                action={
                  <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                    <DialogTrigger asChild>
                      <Button>Adicionar Usuário</Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader title="Adicionar Novo Usuário" />
                      <DialogBody>
                        <div className="space-y-4">
                          <FormField id="novo-email" label="E-mail">
                            {(f) => (
                              <Input
                                id={f.id}
                                type="email"
                                value={novoEmail}
                                onChange={(e) => setNovoEmail(e.target.value)}
                                disabled={addingUser}
                                placeholder="usuario@exemplo.com"
                              />
                            )}
                          </FormField>

                          {acessoTotal && (
                            <FormField id="nova-role" label="Role">
                              {(f) => (
                                <Select value={novaRole} onValueChange={(v) => setNovaRole(v as 'user' | 'superadmin')} disabled={addingUser}>
                                  <SelectTrigger id={f.id} className="w-full">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="user">User</SelectItem>
                                    <SelectItem value="superadmin">Superadmin</SelectItem>
                                  </SelectContent>
                                </Select>
                              )}
                            </FormField>
                          )}

                          <FormField id="novo-perfil" label="Perfil">
                            {(f) => (
                              <Select
                                value={novoPerfilId || SEM_PERFIL}
                                onValueChange={(v) => setNovoPerfilId(v === SEM_PERFIL ? '' : v)}
                                disabled={addingUser}
                              >
                                <SelectTrigger id={f.id} className="w-full">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value={SEM_PERFIL}>Sem perfil</SelectItem>
                                  {perfisDisponiveis.map((perfil) => (
                                    <SelectItem key={perfil.id} value={perfil.id}>
                                      {perfil.nome}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                          </FormField>

                          <div>
                            <p className="mb-2 text-sm font-medium text-slate-700">Unidades</p>
                            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                              {unidadesDisponiveis.map((unidade) => (
                                <label key={unidade.id} className="flex items-center gap-2 text-sm text-slate-700">
                                  <input
                                    type="checkbox"
                                    checked={novasUnidadesIds.includes(unidade.id)}
                                    onChange={() => toggleNovaUnidade(unidade.id)}
                                    disabled={addingUser}
                                    className="rounded border-slate-300 text-primary focus:ring-primary/40"
                                  />
                                  {unidade.nome}
                                </label>
                              ))}
                            </div>
                          </div>

                          {addUserError && <Alert tone="danger">{addUserError}</Alert>}
                          {addUserSuccess && <Alert tone="success">{addUserSuccess}</Alert>}

                          <Button
                            onClick={handleAdicionarUsuario}
                            disabled={!novoEmail}
                            loading={addingUser}
                            className="w-full"
                          >
                            Adicionar
                          </Button>
                        </div>
                      </DialogBody>
                    </DialogContent>
                  </Dialog>
                }
              />
              <CardContent>
                <ResponsiveTable<UsuarioComPerfil>
                  columns={[
                    { key: 'email', header: 'Email', render: (u) => u.email },
                    {
                      key: 'role',
                      header: 'Role',
                      width: 'compact',
                      render: (u) => {
                        const isProtegido = EMAILS_PROTEGIDOS.includes(u.email)
                        return acessoTotal ? (
                          <Select value={u.role} onValueChange={(v) => handleAlterarRole(u, v as 'user' | 'superadmin')} disabled={isProtegido}>
                            <SelectTrigger className="h-8 w-full min-w-[130px] text-sm">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="user">User</SelectItem>
                              <SelectItem value="superadmin">Superadmin</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <span className="text-slate-700">{u.role === 'superadmin' ? 'Superadmin' : 'User'}</span>
                        )
                      },
                    },
                    {
                      key: 'perfil',
                      header: 'Perfil',
                      render: (u) => {
                        if (u.role === 'superadmin') {
                          return <Badge tone="brand">Acesso total</Badge>
                        }
                        const isPerfilLoading = perfilLoadingId === u.id
                        const perfilOrfao = u.perfil && !perfisDisponiveis.some((p) => p.id === u.perfil?.id)
                        return (
                          <div className="flex items-center gap-2">
                            <Select
                              value={u.perfil?.id ?? SEM_PERFIL}
                              onValueChange={(v) => {
                                if (v === SEM_PERFIL) return
                                handleAtribuirPerfil(u, v)
                              }}
                              disabled={isPerfilLoading}
                            >
                              <SelectTrigger className="h-8 w-full min-w-[140px] text-sm">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value={SEM_PERFIL}>Sem perfil</SelectItem>
                                {perfilOrfao && u.perfil && (
                                  <SelectItem value={u.perfil.id} disabled>
                                    {u.perfil.nome}
                                  </SelectItem>
                                )}
                                {perfisDisponiveis.map((p) => (
                                  <SelectItem key={p.id} value={p.id}>
                                    {p.nome}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {u.perfil && (
                              <IconButton
                                variant="ghost"
                                aria-label="Remover perfil"
                                title="Remover perfil"
                                disabled={isPerfilLoading}
                                onClick={() => handleRemoverPerfil(u)}
                              >
                                <X className="size-3.5" />
                              </IconButton>
                            )}
                            {isPerfilLoading && <Spinner size={14} />}
                          </div>
                        )
                      },
                    },
                    {
                      key: 'unidades',
                      header: 'Unidades',
                      render: (u) => (
                        <div className="flex items-center gap-2">
                          <span className="max-w-[220px] truncate">
                            {u.unidades.length > 0 ? u.unidades.map((un) => un.nome).join(', ') : 'Sem unidade'}
                          </span>
                          <button
                            type="button"
                            onClick={() => abrirDialogUnidades(u)}
                            disabled={!acessoTotal && u.role === 'superadmin'}
                            className="text-xs font-medium text-primary hover:text-primary/80 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Editar
                          </button>
                        </div>
                      ),
                    },
                    {
                      key: 'status',
                      header: 'Status',
                      width: 'compact',
                      render: (u) => <Badge tone={u.ativo ? 'success' : 'danger'}>{u.ativo ? 'Ativo' : 'Bloqueado'}</Badge>,
                    },
                    {
                      key: 'criado',
                      header: 'Data de Criação',
                      width: 'compact',
                      render: (u) => format(new Date(u.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }),
                    },
                  ]}
                  rows={usuarios}
                  rowKey={(u) => u.id}
                  firstColumnSticky
                  loading={loading}
                  emptyTitle="Nenhum usuário encontrado"
                  rowActions={(u) => {
                    const isProtegido = EMAILS_PROTEGIDOS.includes(u.email)
                    return u.ativo ? (
                      <IconButton
                        variant="ghost"
                        aria-label="Bloquear usuário"
                        title="Bloquear"
                        disabled={isProtegido}
                        className="text-red-600 hover:bg-red-100"
                        onClick={() => handleBloquearUsuario(u)}
                      >
                        <Ban className="size-4" />
                      </IconButton>
                    ) : (
                      <Button variant="secondary" size="sm" onClick={() => handleDesbloquearUsuario(u)}>
                        Desbloquear
                      </Button>
                    )
                  }}
                  renderMobileCard={(u) => (
                    <div className="space-y-1.5 text-sm">
                      <p className="font-medium text-slate-800">{u.email}</p>
                      <div className="flex flex-wrap items-center gap-1">
                        <Badge tone={u.ativo ? 'success' : 'danger'}>{u.ativo ? 'Ativo' : 'Bloqueado'}</Badge>
                        {u.role === 'superadmin' && <Badge tone="brand">Acesso total</Badge>}
                      </div>
                      <p className="text-xs text-slate-500">
                        {u.role === 'superadmin' ? 'Superadmin' : (u.perfil?.nome ?? 'Sem perfil')}
                      </p>
                      <p className="text-xs text-slate-500">
                        {u.unidades.length > 0 ? u.unidades.map((un) => un.nome).join(', ') : 'Sem unidade'}
                      </p>
                      <p className="text-xs text-slate-400">
                        Criado: {format(new Date(u.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </p>
                    </div>
                  )}
                />
              </CardContent>
            </Card>
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
              <DialogHeader title="Editar Unidades" />
              <DialogBody>
                <div className="space-y-4">
                  <p className="text-sm text-slate-600">{unidadesDialogUsuario?.email}</p>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {unidadesDisponiveis.map((unidade) => (
                      <label key={unidade.id} className="flex items-center gap-2 text-sm text-slate-700">
                        <input
                          type="checkbox"
                          checked={unidadesSelecionadas.includes(unidade.id)}
                          onChange={() => toggleUnidadeSelecionada(unidade.id)}
                          disabled={savingUnidades}
                          className="rounded border-slate-300 text-primary focus:ring-primary/40"
                        />
                        {unidade.nome}
                      </label>
                    ))}
                  </div>
                  <Button onClick={handleSalvarUnidades} loading={savingUnidades} className="w-full">
                    Salvar unidades
                  </Button>
                </div>
              </DialogBody>
            </DialogContent>
          </Dialog>

          <TabsContent value="perfis">
            {acessoTotal ? <PerfilEditor /> : null}
          </TabsContent>

          <TabsContent value="auditoria">
            <Card>
              <CardHeader title="Auditoria de Acessos" />
              <CardContent>
                <FilterPanel dirty={filtrosAuditoria.dirty} onApply={aplicarFiltrosAuditoria} onClear={limparFiltrosAuditoria}>
                  <FilterFieldGroup label="Filtros">
                    <FormField id="filtro-email" label="Email">
                      {(f) => (
                        <Input
                          id={f.id}
                          placeholder="Filtrar por email"
                          value={filtrosAuditoria.draft.email}
                          onChange={(e) => filtrosAuditoria.setField('email', e.target.value)}
                        />
                      )}
                    </FormField>
                    <FormField id="filtro-acao" label="Ação">
                      {(f) => (
                        <Input
                          id={f.id}
                          placeholder="Filtrar por ação"
                          value={filtrosAuditoria.draft.acao}
                          onChange={(e) => filtrosAuditoria.setField('acao', e.target.value)}
                        />
                      )}
                    </FormField>
                  </FilterFieldGroup>
                </FilterPanel>

                <div className="mt-6">
                  <ResponsiveTable<AuditoriaAcesso>
                    columns={[
                      {
                        key: 'acao',
                        header: 'Ação',
                        width: 'compact',
                        render: (registro) => <Badge tone={ACAO_TONE(registro.acao)}>{registro.acao}</Badge>,
                      },
                      { key: 'email', header: 'Email', render: (registro) => registro.email || '-' },
                      { key: 'ip', header: 'IP', width: 'compact', render: (registro) => registro.ip || '-' },
                      {
                        key: 'data',
                        header: 'Data e Hora',
                        width: 'compact',
                        render: (registro) => format(new Date(registro.created_at), "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR }),
                      },
                      {
                        key: 'metadata',
                        header: 'Metadata',
                        className: 'max-w-xs truncate',
                        render: (registro) => (registro.metadata ? JSON.stringify(registro.metadata) : '-'),
                      },
                    ]}
                    rows={auditoria}
                    rowKey={(registro) => registro.id}
                    loading={loading}
                    emptyTitle="Nenhum registro de auditoria encontrado"
                    renderMobileCard={(registro) => (
                      <div className="space-y-1.5 text-sm">
                        <Badge tone={ACAO_TONE(registro.acao)}>{registro.acao}</Badge>
                        <p className="font-medium text-slate-800">{registro.email || '-'}</p>
                        <p className="text-xs text-slate-500">
                          {registro.ip || '-'} • {format(new Date(registro.created_at), "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR })}
                        </p>
                        {registro.metadata && (
                          <p className="truncate text-xs text-slate-400">{JSON.stringify(registro.metadata)}</p>
                        )}
                      </div>
                    )}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </PageContainer>
  )
}
