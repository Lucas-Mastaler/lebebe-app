'use client';

import { useEffect, useState } from 'react';
import { Calendar, ChevronDown, Search, Store } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Button, DateField, FilterFieldGroup, FilterPanel, FormField, Input, useFilterState } from '@/components/design-system';
import { Usuario } from '@/types';
import { DEPARTAMENTOS_FIXOS } from '@/lib/digisac/departamentosFixos';
import { parseBrDate } from '@/lib/design-system/dates';
import { TABLE_PAGE_SIZE } from '@/lib/design-system/pagination';

export interface FiltrosChamadosValores {
  dataUltimoChamadoFechadoInicio: string;
  dataUltimoChamadoFechadoFim: string;
  departmentIds: string[];
  userIds: string[];
  page: number;
  perPage: number;
}

interface FiltrosProps {
  onPesquisar: (filtros: FiltrosChamadosValores) => void;
  onLimpar: () => void;
  isLoading: boolean;
}

interface FiltrosDraft {
  dataInicio: string;
  dataFim: string;
  departmentIds: string[];
  userIds: string[];
}

const FILTROS_VAZIOS: FiltrosDraft = { dataInicio: '', dataFim: '', departmentIds: [], userIds: [] };

function MultiSelectPopover({
  label,
  query,
  onQueryChange,
  selectedCount,
  options,
  isChecked,
  onToggle,
  onClearAll,
  placeholder,
}: {
  label: string;
  query: string;
  onQueryChange: (v: string) => void;
  selectedCount: number;
  options: Array<{ id: string; nome: string }>;
  isChecked: (id: string) => boolean;
  onToggle: (id: string, checked: boolean) => void;
  onClearAll: () => void;
  placeholder: string;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-slate-700">{label}</label>
      <Popover>
        <PopoverTrigger asChild>
          <Button type="button" variant="secondary" className="w-full justify-between">
            <span>{selectedCount === 0 ? 'Todas' : `${selectedCount} selecionada(s)`}</span>
            <ChevronDown className="size-4 opacity-60" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[320px] p-0">
          <div className="sticky top-0 border-b border-slate-100 bg-white p-2">
            <Input
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              onKeyDown={(e) => e.stopPropagation()}
              onKeyUp={(e) => e.stopPropagation()}
              placeholder={placeholder}
            />
          </div>
          <div className="max-h-64 space-y-1 overflow-y-auto p-2">
            <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 hover:bg-slate-50">
              <Checkbox checked={selectedCount === 0} onCheckedChange={() => onClearAll()} />
              <span>Todas</span>
            </label>
            {options.map((opt) => (
              <label key={opt.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 hover:bg-slate-50">
                <Checkbox checked={isChecked(opt.id)} onCheckedChange={(checked) => onToggle(opt.id, checked === true)} />
                <span>{opt.nome}</span>
              </label>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

export function FiltrosChamadosFinalizados({ onPesquisar, onLimpar, isLoading }: FiltrosProps) {
  const filters = useFilterState<FiltrosDraft>(FILTROS_VAZIOS);

  const [usersList, setUsersList] = useState<Usuario[]>([]);
  const [lojaQuery, setLojaQuery] = useState('');
  const [userQuery, setUserQuery] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/users');
        const data = await res.json();
        if (Array.isArray(data)) setUsersList(data.map((u: { id?: string; name?: string; nome?: string }) => ({ id: u.id || '', nome: u.name || u.nome || '' })));
      } catch (e) {
        console.error('Erro ao carregar usuários', e);
      }
    })();
  }, []);

  const isRangeValid =
    filters.draft.dataInicio.length === 10 &&
    parseBrDate(filters.draft.dataInicio) !== null &&
    filters.draft.dataFim.length === 10 &&
    parseBrDate(filters.draft.dataFim) !== null;

  function handleFiltrar() {
    if (!isRangeValid) return;
    filters.apply();
    const valores: FiltrosChamadosValores = {
      dataUltimoChamadoFechadoInicio: filters.draft.dataInicio,
      dataUltimoChamadoFechadoFim: filters.draft.dataFim,
      departmentIds: filters.draft.departmentIds,
      userIds: filters.draft.userIds,
      page: 1,
      perPage: TABLE_PAGE_SIZE,
    };
    console.log('[UI][CHAMADOS] filtros=', valores);
    onPesquisar(valores);
  }

  function handleLimpar() {
    filters.clear();
    setLojaQuery('');
    setUserQuery('');
    onLimpar();
  }

  return (
    <FilterPanel dirty={filters.dirty} onApply={handleFiltrar} onClear={handleLimpar} applyDisabled={!isRangeValid || isLoading}>
      <FilterFieldGroup label="Datas" icon={<Calendar className="size-4 text-slate-400" />}>
        <FormField id="chamados-data-inicio" label="Data do último chamado fechado (início)" required>
          {(f) => <DateField {...f} value={filters.draft.dataInicio} onChange={(v) => filters.setField('dataInicio', v)} />}
        </FormField>
        <FormField id="chamados-data-fim" label="Data do último chamado fechado (fim)" required>
          {(f) => <DateField {...f} value={filters.draft.dataFim} onChange={(v) => filters.setField('dataFim', v)} />}
        </FormField>
      </FilterFieldGroup>

      <FilterFieldGroup label="Loja e consultora" icon={<Store className="size-4 text-slate-400" />}>
        <MultiSelectPopover
          label="Loja (Filial)"
          query={lojaQuery}
          onQueryChange={setLojaQuery}
          selectedCount={filters.draft.departmentIds.length}
          options={DEPARTAMENTOS_FIXOS.filter((d) => d.name.toLowerCase().includes(lojaQuery.toLowerCase())).map((d) => ({ id: d.id, nome: d.name }))}
          isChecked={(id) => filters.draft.departmentIds.includes(id)}
          onToggle={(id, checked) =>
            filters.setField('departmentIds', checked ? [...filters.draft.departmentIds, id] : filters.draft.departmentIds.filter((v) => v !== id))
          }
          onClearAll={() => filters.setField('departmentIds', [])}
          placeholder="Filtrar lojas..."
        />
        <MultiSelectPopover
          label="Consultora (Atendente)"
          query={userQuery}
          onQueryChange={setUserQuery}
          selectedCount={filters.draft.userIds.length}
          options={usersList}
          isChecked={(id) => filters.draft.userIds.includes(id)}
          onToggle={(id, checked) => filters.setField('userIds', checked ? [...filters.draft.userIds, id] : filters.draft.userIds.filter((v) => v !== id))}
          onClearAll={() => filters.setField('userIds', [])}
          placeholder="Filtrar consultoras..."
        />
      </FilterFieldGroup>

      {!isRangeValid && (filters.draft.dataInicio || filters.draft.dataFim) && (
        <p className="text-xs text-slate-500">
          <Search className="mr-1 inline size-3" />
          Informe as duas datas (início e fim) para habilitar a pesquisa.
        </p>
      )}
    </FilterPanel>
  );
}
