'use client'

import { useEffect, useState } from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DEPARTAMENTOS_FIXOS } from '@/lib/digisac/departamentosFixos'
import { parseBrDate } from '@/lib/design-system/dates'
import { DateField, FilterFieldGroup, FilterPanel, FormField, Input, useFilterState } from '@/components/design-system'
import type { Departamento, FiltrosPesquisa, Usuario } from '@/types'

interface FiltrosAgendamentosProps {
  departamentos: Departamento[]
  hasResults: boolean
  clienteNomeFiltro: string
  onClienteNomeChange: (value: string) => void
  onPesquisar: (filtros: FiltrosPesquisa) => void
  onLimpar: () => void
  isLoading: boolean
}

const statusOptions = [
  { value: 'scheduled', label: 'Agendado' },
  { value: 'done', label: 'Finalizado' },
  { value: 'error', label: 'Erro' },
]

const INITIAL_FILTERS = {
  dataAgendamentoInicio: '',
  dataAgendamentoFim: '',
  dataCriacaoInicio: '',
  dataCriacaoFim: '',
  departmentId: '',
  userId: '',
  status: '',
  conversaAberta: 'all',
}

function isCompleteDateRange(start: string, end: string) {
  return Boolean(parseBrDate(start) && parseBrDate(end))
}

export function FiltrosAgendamentos({
  departamentos,
  hasResults,
  clienteNomeFiltro,
  onClienteNomeChange,
  onPesquisar,
  onLimpar,
  isLoading,
}: FiltrosAgendamentosProps) {
  // Mantém o contrato e o carregamento já existentes; a lista exibida segue a fonte fixa atual.
  void departamentos
  const [usersList, setUsersList] = useState<Usuario[]>([])
  const filters = useFilterState(INITIAL_FILTERS)
  const agendamentoValido = isCompleteDateRange(filters.draft.dataAgendamentoInicio, filters.draft.dataAgendamentoFim)
  const criacaoValida = isCompleteDateRange(filters.draft.dataCriacaoInicio, filters.draft.dataCriacaoFim)
  const canSearch = agendamentoValido || criacaoValida

  useEffect(() => {
    async function fetchUsers() {
      try {
        const response = await fetch('/api/users')
        const data = await response.json()
        if (Array.isArray(data)) {
          setUsersList(data.map((user: { id?: string; name?: string; nome?: string }) => ({
            id: user.id || '',
            nome: user.name || user.nome || '',
          })))
        }
      } catch (err) {
        console.error('Erro ao buscar usuários:', err)
      }
    }
    fetchUsers()
  }, [])

  function handlePesquisar() {
    if (!canSearch) return
    filters.apply()
    const draft = filters.draft
    onPesquisar({
      dataAgendamentoInicio: agendamentoValido ? draft.dataAgendamentoInicio : undefined,
      dataAgendamentoFim: agendamentoValido ? draft.dataAgendamentoFim : undefined,
      dataCriacaoInicio: criacaoValida ? draft.dataCriacaoInicio : undefined,
      dataCriacaoFim: criacaoValida ? draft.dataCriacaoFim : undefined,
      departmentId: draft.departmentId === 'all' ? undefined : draft.departmentId || undefined,
      userId: draft.userId === 'all' ? undefined : draft.userId || undefined,
      status: draft.status === 'all' ? undefined : (draft.status ? [draft.status] : undefined),
      conversaAberta: draft.conversaAberta === 'all' ? 'all' : draft.conversaAberta as 'yes' | 'no',
      page: 1,
      perPage: 20,
    })
  }

  function handleClear() {
    filters.clear()
    onClienteNomeChange('')
    onLimpar()
  }

  return (
    <FilterPanel
      dirty={filters.dirty}
      onApply={handlePesquisar}
      onClear={handleClear}
      applyDisabled={!canSearch || isLoading}
    >
      <FilterFieldGroup label="Período">
        <FormField id="data-agendamento-inicio" label="Data do agendamento (início)">
          {(field) => <DateField {...field} value={filters.draft.dataAgendamentoInicio} onChange={(value) => filters.setField('dataAgendamentoInicio', value)} />}
        </FormField>
        <FormField id="data-agendamento-fim" label="Data do agendamento (fim)">
          {(field) => <DateField {...field} value={filters.draft.dataAgendamentoFim} onChange={(value) => filters.setField('dataAgendamentoFim', value)} />}
        </FormField>
        <FormField id="data-criacao-inicio" label="Data de criação (início)">
          {(field) => <DateField {...field} value={filters.draft.dataCriacaoInicio} onChange={(value) => filters.setField('dataCriacaoInicio', value)} />}
        </FormField>
        <FormField id="data-criacao-fim" label="Data de criação (fim)">
          {(field) => <DateField {...field} value={filters.draft.dataCriacaoFim} onChange={(value) => filters.setField('dataCriacaoFim', value)} />}
        </FormField>
      </FilterFieldGroup>

      <FilterFieldGroup label="Critérios">
        <FormField id="filial" label="Filial">
          {(field) => (
            <Select value={filters.draft.departmentId} onValueChange={(value) => filters.setField('departmentId', value)}>
              <SelectTrigger id={field.id}><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {DEPARTAMENTOS_FIXOS.map((department) => <SelectItem key={department.id} value={department.id}>{department.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
        </FormField>
        <FormField id="atendente" label="Atendente">
          {(field) => (
            <Select value={filters.draft.userId} onValueChange={(value) => filters.setField('userId', value)}>
              <SelectTrigger id={field.id}><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {usersList.length > 0 ? usersList.map((user) => <SelectItem key={user.id} value={user.id}>{user.nome}</SelectItem>) : <SelectItem value="loading" disabled>Carregando...</SelectItem>}
              </SelectContent>
            </Select>
          )}
        </FormField>
        <FormField id="status" label="Status">
          {(field) => (
            <Select value={filters.draft.status} onValueChange={(value) => filters.setField('status', value)}>
              <SelectTrigger id={field.id}><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {statusOptions.map((status) => <SelectItem key={status.value} value={status.value}>{status.label}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
        </FormField>
        <FormField id="conversa-aberta" label="Possui conversa aberta?">
          {(field) => (
            <Select value={filters.draft.conversaAberta} onValueChange={(value) => filters.setField('conversaAberta', value)}>
              <SelectTrigger id={field.id}><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent><SelectItem value="all">Todos</SelectItem><SelectItem value="yes">Sim</SelectItem><SelectItem value="no">Não</SelectItem></SelectContent>
            </Select>
          )}
        </FormField>
      </FilterFieldGroup>

      <FilterFieldGroup label="Resultado atual">
        <FormField id="cliente-nome" label="Nome do cliente">
          {(field) => <Input {...field} value={clienteNomeFiltro} onChange={(event) => onClienteNomeChange(event.target.value)} placeholder="Filtrar por nome do cliente..." disabled={!hasResults} />}
        </FormField>
      </FilterFieldGroup>

      {!canSearch && (
        <p className="text-sm text-warning">Preencha pelo menos um intervalo de datas completo (Agendamento ou Criação) para pesquisar.</p>
      )}
    </FilterPanel>
  )
}
