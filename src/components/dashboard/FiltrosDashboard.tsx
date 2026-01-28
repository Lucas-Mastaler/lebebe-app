'use client';

import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Button as UIButton } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Usuario } from '@/types';
import { DEPARTAMENTOS_FIXOS } from '@/lib/digisac/departamentosFixos';

interface FiltrosProps {
  onPesquisar: (filtros: {
    dataInicio: string;
    dataFim: string;
    departmentIds: string[];
    userIds: string[];
  }) => void;
  isLoading: boolean;
}

function parseDate(dateStr: string): Date | undefined {
  const parts = dateStr.split('/');
  if (parts.length !== 3) return undefined;
  const [day, month, year] = parts.map(Number);
  if (!day || !month || !year || year < 1900 || year > 2100) return undefined;
  const date = new Date(year, month - 1, day);
  if (isNaN(date.getTime())) return undefined;
  return date;
}

function formatDateToInput(date: Date | undefined): string {
  if (!date) return '';
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

export function FiltrosDashboard({ onPesquisar, isLoading }: FiltrosProps) {
  const [isOpen, setIsOpen] = useState(true);

  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [inicioOpen, setInicioOpen] = useState(false);
  const [fimOpen, setFimOpen] = useState(false);

  const [selectedDepartmentIds, setSelectedDepartmentIds] = useState<string[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [usersList, setUsersList] = useState<Usuario[]>([]);
  const [lojaQuery, setLojaQuery] = useState('');
  const [userQuery, setUserQuery] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/users');
        const data = await res.json();
        if (Array.isArray(data)) setUsersList(data.map((u: any) => ({ id: u.id, nome: u.name || u.nome })));
      } catch (e) {
        console.error('[DASHBOARD] Erro ao carregar usuários', e);
      }
    })();
  }, []);

  const isRangeValid =
    dataInicio.length === 10 && parseDate(dataInicio) !== undefined &&
    dataFim.length === 10 && parseDate(dataFim) !== undefined;

  const handlePesquisar = () => {
    if (!isRangeValid) return;
    const filtros = {
      dataInicio,
      dataFim,
      departmentIds: selectedDepartmentIds,
      userIds: selectedUserIds,
    };
    onPesquisar(filtros);
  };

  const makeHandleDateSelect = (setter: (v: string) => void, closer: (v: boolean) => void) => (date: Date | undefined) => {
    setter(formatDateToInput(date));
    closer(false);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 card-shadow">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <div className="p-4 flex items-center justify-between border-b border-slate-200">
          <div>
            <h3 className="font-semibold text-slate-900">Filtros</h3>
            <p className="text-slate-500 text-sm">Selecione os critérios para buscar</p>
          </div>
          <CollapsibleTrigger className="p-2 rounded-xl hover:bg-slate-100">
            {isOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </CollapsibleTrigger>
        </div>

        <CollapsibleContent>
          <div className="p-4 space-y-4">
            {/* Datas */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-slate-600 mb-1">Data início</label>
                <div className="flex gap-2">
                  <Popover open={inicioOpen} onOpenChange={setInicioOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start">
                        {dataInicio || 'dd/mm/aaaa'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="p-0">
                      <Calendar
                        mode="single"
                        selected={parseDate(dataInicio)}
                        onSelect={makeHandleDateSelect(setDataInicio, setInicioOpen)}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              <div>
                <label className="block text-sm text-slate-600 mb-1">Data fim</label>
                <div className="flex gap-2">
                  <Popover open={fimOpen} onOpenChange={setFimOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start">
                        {dataFim || 'dd/mm/aaaa'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="p-0">
                      <Calendar
                        mode="single"
                        selected={parseDate(dataFim)}
                        onSelect={makeHandleDateSelect(setDataFim, setFimOpen)}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            </div>

            {/* Linha única Loja e Consultora (multi-seleção) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-slate-600 mb-1">Loja (Filial)</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <UIButton variant="outline" className="w-full justify-between rounded-xl">
                      <span>
                        {selectedDepartmentIds.length === 0 ? 'Todas' : `${selectedDepartmentIds.length} selecionada(s)`}
                      </span>
                      <ChevronDown className="w-4 h-4 opacity-60" />
                    </UIButton>
                  </PopoverTrigger>
                  <PopoverContent className="w-[320px] p-0">
                    <div className="p-2 border-b border-slate-100 sticky top-0 bg-white">
                      <Input
                        value={lojaQuery}
                        onChange={(e) => setLojaQuery(e.target.value)}
                        onKeyDown={(e) => e.stopPropagation()}
                        onKeyUp={(e) => e.stopPropagation()}
                        placeholder="Filtrar lojas..."
                        className="rounded-xl border-slate-200 focus:ring-[#00A5E6] focus:ring-2"
                      />
                    </div>
                    <div className="max-h-64 overflow-y-auto p-2 space-y-1">
                      <label className="flex items-center gap-2 px-2 py-1 rounded hover:bg-slate-50 cursor-pointer">
                        <input
                          type="checkbox"
                          className="accent-[#00A5E6]"
                          checked={selectedDepartmentIds.length === 0}
                          onChange={() => setSelectedDepartmentIds([])}
                        />
                        <span>Todas</span>
                      </label>
                      {DEPARTAMENTOS_FIXOS
                        .filter(d => d.name.toLowerCase().includes(lojaQuery.toLowerCase()))
                        .map((d) => {
                          const checked = selectedDepartmentIds.includes(d.id);
                          return (
                            <label key={d.id} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-slate-50 cursor-pointer">
                              <input
                                type="checkbox"
                                className="accent-[#00A5E6]"
                                checked={checked}
                                onChange={(e) => {
                                  setSelectedDepartmentIds((prev) => {
                                    if (e.target.checked) return [...prev, d.id];
                                    return prev.filter((id) => id !== d.id);
                                  });
                                }}
                              />
                              <span>{d.name}</span>
                            </label>
                          );
                        })}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <label className="block text-sm text-slate-600 mb-1">Consultora (Atendente)</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <UIButton variant="outline" className="w-full justify-between rounded-xl">
                      <span>
                        {selectedUserIds.length === 0 ? 'Todas' : `${selectedUserIds.length} selecionada(s)`}
                      </span>
                      <ChevronDown className="w-4 h-4 opacity-60" />
                    </UIButton>
                  </PopoverTrigger>
                  <PopoverContent className="w-[320px] p-0">
                    <div className="p-2 border-b border-slate-100 sticky top-0 bg-white">
                      <Input
                        value={userQuery}
                        onChange={(e) => setUserQuery(e.target.value)}
                        onKeyDown={(e) => e.stopPropagation()}
                        onKeyUp={(e) => e.stopPropagation()}
                        placeholder="Filtrar consultoras..."
                        className="rounded-xl border-slate-200 focus:ring-[#00A5E6] focus:ring-2"
                      />
                    </div>
                    <div className="max-h-64 overflow-y-auto p-2 space-y-1">
                      <label className="flex items-center gap-2 px-2 py-1 rounded hover:bg-slate-50 cursor-pointer">
                        <input
                          type="checkbox"
                          className="accent-[#00A5E6]"
                          checked={selectedUserIds.length === 0}
                          onChange={() => setSelectedUserIds([])}
                        />
                        <span>Todas</span>
                      </label>
                      {usersList
                        .filter(u => (u.nome || '').toLowerCase().includes(userQuery.toLowerCase()))
                        .map((u) => {
                          const checked = selectedUserIds.includes(u.id);
                          return (
                            <label key={u.id} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-slate-50 cursor-pointer">
                              <input
                                type="checkbox"
                                className="accent-[#00A5E6]"
                                checked={checked}
                                onChange={(e) => {
                                  setSelectedUserIds((prev) => {
                                    if (e.target.checked) return [...prev, u.id];
                                    return prev.filter((id) => id !== u.id);
                                  });
                                }}
                              />
                              <span>{u.nome}</span>
                            </label>
                          );
                        })}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <Button onClick={handlePesquisar} disabled={!isRangeValid || isLoading} className="w-full rounded-xl">
              <Search className="w-4 h-4 mr-2" /> PESQUISAR
            </Button>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
