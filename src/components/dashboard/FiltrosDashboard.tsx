'use client'

import { useEffect, useMemo, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Button,
  DateField,
  FilterFieldGroup,
  FilterPanel,
  FormField,
  Input,
  useFilterState,
} from '@/components/design-system'
import { Usuario, ServicoDigisacDashboard } from '@/types'
import { DEPARTAMENTOS_FIXOS } from '@/lib/digisac/departamentosFixos'

interface DashboardFilters {
  dataInicio: string
  dataFim: string
  departmentIds: string[]
  userIds: string[]
  serviceIds: string[]
}

interface FiltrosProps {
  onPesquisar: (filtros: DashboardFilters) => void
  isLoading: boolean
}

const EMPTY_FILTERS: DashboardFilters = {
  dataInicio: '',
  dataFim: '',
  departmentIds: [],
  userIds: [],
  serviceIds: [],
}

interface MultiSelectFilterProps {
  id: string
  value: string[]
  options: Array<{ id: string; label: string }>
  onChange: (value: string[]) => void
  placeholder: string
  searchPlaceholder: string
  disabled?: boolean
}

/** Composição local para a lacuna documentada de multi-select com busca. */
function MultiSelectFilter({ id, value, options, onChange, placeholder, searchPlaceholder, disabled }: MultiSelectFilterProps) {
  const [query, setQuery] = useState('')
  const filteredOptions = useMemo(
    () => options.filter((option) => option.label.toLowerCase().includes(query.toLowerCase())),
    [options, query]
  )

  function toggleOption(optionId: string, checked: boolean) {
    onChange(checked ? [...value, optionId] : value.filter((selectedId) => selectedId !== optionId))
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button id={id} type="button" variant="secondary" className="w-full justify-between border border-input bg-input-background font-normal text-foreground hover:bg-input-background" disabled={disabled}>
          <span>{value.length === 0 ? placeholder : `${value.length} selecionada(s)`}</span>
          <ChevronDown className="size-4 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-0" align="start">
        <div className="border-b border-slate-100 p-2">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => event.stopPropagation()}
            onKeyUp={(event) => event.stopPropagation()}
            placeholder={searchPlaceholder}
          />
        </div>
        <div className="max-h-64 space-y-1 overflow-y-auto p-2">
          <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 hover:bg-slate-50">
            <Checkbox checked={value.length === 0} onCheckedChange={() => onChange([])} />
            <span>Todas</span>
          </label>
          {filteredOptions.map((option) => {
            const checked = value.includes(option.id)
            return (
              <label key={option.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 hover:bg-slate-50">
                <Checkbox checked={checked} onCheckedChange={(nextChecked) => toggleOption(option.id, nextChecked === true)} />
                <span>{option.label}</span>
              </label>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}

export function FiltrosDashboard({ onPesquisar, isLoading }: FiltrosProps) {
  const filters = useFilterState(EMPTY_FILTERS)
  const [usersList, setUsersList] = useState<Usuario[]>([])
  const [servicosList, setServicosList] = useState<ServicoDigisacDashboard[]>([])
  const [isLoadingServicos, setIsLoadingServicos] = useState(false)

  useEffect(() => {
    ;(async () => {
      try {
        const response = await fetch('/api/users')
        const data = await response.json()
        if (Array.isArray(data)) {
          setUsersList(data.map((user: { id?: string; name?: string; nome?: string }) => ({ id: user.id || '', nome: user.name || user.nome || '' })))
        }
      } catch (error) {
        console.error('[DASHBOARD] Erro ao carregar usuários', error)
      }
    })()

    ;(async () => {
      setIsLoadingServicos(true)
      try {
        const response = await fetch('/api/dashboard/estatisticas/servicos')
        if (!response.ok) throw new Error(`Erro ${response.status}`)
        const data = await response.json()
        if (Array.isArray(data.servicos)) setServicosList(data.servicos)
      } catch (error) {
        console.error('[DASHBOARD] Erro ao carregar conexões Digisac', error)
      } finally {
        setIsLoadingServicos(false)
      }
    })()
  }, [])

  const isRangeValid = filters.draft.dataInicio.length === 10 && filters.draft.dataFim.length === 10
  const departmentOptions = useMemo(() => DEPARTAMENTOS_FIXOS.map((department) => ({ id: department.id, label: department.name })), [])
  const userOptions = useMemo(() => usersList.map((user) => ({ id: user.id, label: user.nome || '' })), [usersList])
  const serviceOptions = useMemo(() => servicosList.map((service) => ({ id: service.id, label: service.name })), [servicosList])

  function handleApply() {
    filters.apply()
    onPesquisar(filters.draft)
  }

  function handleClear() {
    filters.clear()
    onPesquisar(EMPTY_FILTERS)
  }

  return (
    <FilterPanel
      title="Filtros"
      dirty={filters.dirty}
      onApply={handleApply}
      onClear={handleClear}
      applyDisabled={!isRangeValid || isLoading}
    >
      <FilterFieldGroup label="Período">
        <FormField id="dashboard-data-inicio" label="Data início" required>
          {(fieldProps) => <DateField value={filters.draft.dataInicio} onChange={(value) => filters.setField('dataInicio', value)} {...fieldProps} />}
        </FormField>
        <FormField id="dashboard-data-fim" label="Data fim" required>
          {(fieldProps) => <DateField value={filters.draft.dataFim} onChange={(value) => filters.setField('dataFim', value)} {...fieldProps} />}
        </FormField>
      </FilterFieldGroup>

      <FilterFieldGroup label="Abrangência">
        <FormField id="dashboard-loja" label="Loja (Filial)">
          {({ id }) => (
            <MultiSelectFilter
              id={id}
              value={filters.draft.departmentIds}
              options={departmentOptions}
              onChange={(value) => filters.setField('departmentIds', value)}
              placeholder="Todas"
              searchPlaceholder="Filtrar lojas..."
            />
          )}
        </FormField>
        <FormField id="dashboard-consultora" label="Consultora (Atendente)">
          {({ id }) => (
            <MultiSelectFilter
              id={id}
              value={filters.draft.userIds}
              options={userOptions}
              onChange={(value) => filters.setField('userIds', value)}
              placeholder="Todas"
              searchPlaceholder="Filtrar consultoras..."
            />
          )}
        </FormField>
        <FormField id="dashboard-conexao" label="Conexão/Número">
          {({ id }) => (
            <MultiSelectFilter
              id={id}
              value={filters.draft.serviceIds}
              options={serviceOptions}
              onChange={(value) => filters.setField('serviceIds', value)}
              placeholder="Todas"
              searchPlaceholder="Filtrar conexões..."
              disabled={isLoadingServicos}
            />
          )}
        </FormField>
      </FilterFieldGroup>
    </FilterPanel>
  )
}
