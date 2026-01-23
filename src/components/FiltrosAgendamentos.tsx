'use client';

import { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { Departamento, Usuario, FiltrosPesquisa } from '@/types';
import { DEPARTAMENTOS_FIXOS } from '@/lib/digisac/departamentosFixos';

interface FiltrosAgendamentosProps {
    departamentos: Departamento[];
    usuarios: Usuario[];
    hasResults: boolean;
    clienteNomeFiltro: string;
    onClienteNomeChange: (value: string) => void;
    onPesquisar: (filtros: FiltrosPesquisa) => void;
    isLoading: boolean;
}

// Mask for date input dd/mm/aaaa
function formatDateInput(value: string): string {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 2) return numbers;
    if (numbers.length <= 4) return `${numbers.slice(0, 2)}/${numbers.slice(2)}`;
    return `${numbers.slice(0, 2)}/${numbers.slice(2, 4)}/${numbers.slice(4, 8)}`;
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



const statusOptions = [
    { value: 'scheduled', label: 'Agendado' },
    { value: 'done', label: 'Finalizado' },
    { value: 'error', label: 'Erro' },
];

export function FiltrosAgendamentos({
    departamentos,
    usuarios,
    hasResults,
    clienteNomeFiltro,
    onClienteNomeChange,
    onPesquisar,
    isLoading,
}: FiltrosAgendamentosProps) {
    useEffect(() => {
        console.log('[FRONT] FiltrosAgendamentos montado. Departamentos props:', departamentos);
        console.log('[FRONT] Usando DEPARTAMENTOS_FIXOS:', DEPARTAMENTOS_FIXOS);
    }, [departamentos]);

    const [isOpen, setIsOpen] = useState(true);

    // Range 1: Agendamento (scheduledAt)
    const [dataAgendamentoInicio, setDataAgendamentoInicio] = useState('');
    const [dataAgendamentoFim, setDataAgendamentoFim] = useState('');
    const [agendamentoInicioOpen, setAgendamentoInicioOpen] = useState(false);
    const [agendamentoFimOpen, setAgendamentoFimOpen] = useState(false);

    // Range 2: Criação (createdAt)
    const [dataCriacaoInicio, setDataCriacaoInicio] = useState('');
    const [dataCriacaoFim, setDataCriacaoFim] = useState('');
    const [criacaoInicioOpen, setCriacaoInicioOpen] = useState(false);
    const [criacaoFimOpen, setCriacaoFimOpen] = useState(false);

    const [departmentId, setDepartmentId] = useState<string>('');
    const [userId, setUserId] = useState<string>('');
    const [status, setStatus] = useState<string>('');
    const [usersList, setUsersList] = useState<Usuario[]>([]);

    // Novos Filtros Ticket
    const [conversaAberta, setConversaAberta] = useState<string>('all');

    useEffect(() => {
        async function fetchUsers() {
            try {
                const res = await fetch('/api/users');
                const data = await res.json();
                if (Array.isArray(data)) {
                    // Map API 'name' to 'nome' to match Usuario type
                    setUsersList(data.map((u: any) => ({ ...u, nome: u.name || u.nome })));
                }
            } catch (err) {
                console.error('Erro ao buscar usuários:', err);
            }
        }
        fetchUsers();
    }, []);

    // Validação
    const isRangeAgendamentoValid =
        dataAgendamentoInicio.length === 10 && parseDate(dataAgendamentoInicio) !== undefined &&
        dataAgendamentoFim.length === 10 && parseDate(dataAgendamentoFim) !== undefined;

    const isRangeCriacaoValid =
        dataCriacaoInicio.length === 10 && parseDate(dataCriacaoInicio) !== undefined &&
        dataCriacaoFim.length === 10 && parseDate(dataCriacaoFim) !== undefined;

    // Se o user preencher uma data parcial do ultimo chamado, avisar?
    // Regra principal: Pelo menos um range "Core" (Agendamento ou Criação) deve ser valido.
    const canSearch = isRangeAgendamentoValid || isRangeCriacaoValid;

    const handlePesquisar = () => {
        if (!canSearch) return;

        console.log('[FRONT] Filtros:', { dataAgendamentoInicio, dataAgendamentoFim, dataCriacaoInicio, dataCriacaoFim });

        const filtros: FiltrosPesquisa = {
            dataAgendamentoInicio: isRangeAgendamentoValid ? dataAgendamentoInicio : undefined,
            dataAgendamentoFim: isRangeAgendamentoValid ? dataAgendamentoFim : undefined,
            dataCriacaoInicio: isRangeCriacaoValid ? dataCriacaoInicio : undefined,
            dataCriacaoFim: isRangeCriacaoValid ? dataCriacaoFim : undefined,
            departmentId: departmentId === 'all' ? undefined : departmentId || undefined,
            userId: userId === 'all' ? undefined : userId || undefined,
            status: status === 'all' ? undefined : (status ? [status] : undefined),

            // Novos Filtros
            conversaAberta: conversaAberta === 'all' ? 'all' : (conversaAberta as 'yes' | 'no'),

            page: 1,
            perPage: 30,
        };

        console.log('[PESQUISA] payload:', filtros);
        onPesquisar(filtros);
    };

    // Date Selection Handlers
    const makeHandleDateSelect = (setter: (v: string) => void, closer: (v: boolean) => void) => (date: Date | undefined) => {
        setter(formatDateToInput(date));
        closer(false);
    };

    return (
        <div className="space-y-4">
            <Collapsible open={isOpen} onOpenChange={setIsOpen}>
                <div className="bg-white rounded-2xl border border-slate-200 card-shadow">
                    <CollapsibleTrigger asChild>
                        <button className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors rounded-t-2xl">
                            <h3 className="font-semibold text-slate-900">Filtros</h3>
                            {isOpen ? <ChevronUp className="w-5 h-5 text-slate-500" /> : <ChevronDown className="w-5 h-5 text-slate-500" />}
                        </button>
                    </CollapsibleTrigger>

                    <CollapsibleContent>
                        <div className="px-4 pb-4 border-t border-slate-100 flex flex-col gap-4 pt-4">

                            {/* Linha 1: 4 Datas (Agendamento Inicio/Fim | Criação Inicio/Fim) */}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                {/* Agendamento Inicio */}
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-700">Data do agendamento (início)</label>
                                    <Popover open={agendamentoInicioOpen} onOpenChange={setAgendamentoInicioOpen}>
                                        <PopoverTrigger asChild>
                                            <div className="relative">
                                                <Input value={dataAgendamentoInicio} onChange={(e) => setDataAgendamentoInicio(formatDateInput(e.target.value))} placeholder="dd/mm/aaaa" maxLength={10} className="rounded-xl border-slate-200 focus:ring-[#00A5E6] focus:ring-2 pr-10" />
                                                <button type="button" onClick={() => setAgendamentoInicioOpen(!agendamentoInicioOpen)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">📅</button>
                                            </div>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0" align="start">
                                            <Calendar mode="single" selected={parseDate(dataAgendamentoInicio)} onSelect={makeHandleDateSelect(setDataAgendamentoInicio, setAgendamentoInicioOpen)} initialFocus />
                                        </PopoverContent>
                                    </Popover>
                                </div>
                                {/* Agendamento Fim */}
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-700">Data do agendamento (fim)</label>
                                    <Popover open={agendamentoFimOpen} onOpenChange={setAgendamentoFimOpen}>
                                        <PopoverTrigger asChild>
                                            <div className="relative">
                                                <Input value={dataAgendamentoFim} onChange={(e) => setDataAgendamentoFim(formatDateInput(e.target.value))} placeholder="dd/mm/aaaa" maxLength={10} className="rounded-xl border-slate-200 focus:ring-[#00A5E6] focus:ring-2 pr-10" />
                                                <button type="button" onClick={() => setAgendamentoFimOpen(!agendamentoFimOpen)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">📅</button>
                                            </div>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0" align="start">
                                            <Calendar mode="single" selected={parseDate(dataAgendamentoFim)} onSelect={makeHandleDateSelect(setDataAgendamentoFim, setAgendamentoFimOpen)} initialFocus />
                                        </PopoverContent>
                                    </Popover>
                                </div>
                                {/* Criação Inicio */}
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-700">Data de criação (início)</label>
                                    <Popover open={criacaoInicioOpen} onOpenChange={setCriacaoInicioOpen}>
                                        <PopoverTrigger asChild>
                                            <div className="relative">
                                                <Input value={dataCriacaoInicio} onChange={(e) => setDataCriacaoInicio(formatDateInput(e.target.value))} placeholder="dd/mm/aaaa" maxLength={10} className="rounded-xl border-slate-200 focus:ring-[#00A5E6] focus:ring-2 pr-10" />
                                                <button type="button" onClick={() => setCriacaoInicioOpen(!criacaoInicioOpen)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">📅</button>
                                            </div>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0" align="start">
                                            <Calendar mode="single" selected={parseDate(dataCriacaoInicio)} onSelect={makeHandleDateSelect(setDataCriacaoInicio, setCriacaoInicioOpen)} initialFocus />
                                        </PopoverContent>
                                    </Popover>
                                </div>
                                {/* Criação Fim */}
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-700">Data de criação (fim)</label>
                                    <Popover open={criacaoFimOpen} onOpenChange={setCriacaoFimOpen}>
                                        <PopoverTrigger asChild>
                                            <div className="relative">
                                                <Input value={dataCriacaoFim} onChange={(e) => setDataCriacaoFim(formatDateInput(e.target.value))} placeholder="dd/mm/aaaa" maxLength={10} className="rounded-xl border-slate-200 focus:ring-[#00A5E6] focus:ring-2 pr-10" />
                                                <button type="button" onClick={() => setCriacaoFimOpen(!criacaoFimOpen)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">📅</button>
                                            </div>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0" align="start">
                                            <Calendar mode="single" selected={parseDate(dataCriacaoFim)} onSelect={makeHandleDateSelect(setDataCriacaoFim, setCriacaoFimOpen)} initialFocus />
                                        </PopoverContent>
                                    </Popover>
                                </div>
                            </div>

                            {/* Linha 2: Filial | Atendente | Status */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full">
                                {/* Filial */}
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-700">Filial</label>
                                    <Select
                                        value={departmentId}
                                        onValueChange={(val) => {
                                            console.log('[FRONT] Filial alterada:', val);
                                            setDepartmentId(val);
                                        }}
                                    >
                                        <SelectTrigger className="w-full rounded-xl border-slate-200 focus:ring-[#00A5E6] focus:ring-2">
                                            <SelectValue placeholder="Selecione..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">Todas</SelectItem>
                                            {DEPARTAMENTOS_FIXOS.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* Atendente */}
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-700">Atendente</label>
                                    <Select value={userId} onValueChange={setUserId}>
                                        <SelectTrigger className="w-full rounded-xl border-slate-200 focus:ring-[#00A5E6] focus:ring-2">
                                            <SelectValue placeholder="Selecione..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">Todos</SelectItem>
                                            {usersList.length > 0 ? (
                                                usersList.map(u => <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>)
                                            ) : (
                                                <SelectItem value="loading" disabled>Carregando...</SelectItem>
                                            )}
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* Status */}
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-700">Status</label>
                                    <Select value={status} onValueChange={setStatus}>
                                        <SelectTrigger className="w-full rounded-xl border-slate-200 focus:ring-[#00A5E6] focus:ring-2">
                                            <SelectValue placeholder="Selecione..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">Todos</SelectItem>
                                            {statusOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            {/* Linha 3: Filtros Ticket (Possui Aberto) */}
                            <div className="grid grid-cols-1 gap-4 w-full">
                                {/* Possui conversa aberta? */}
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-700">Possui conversa aberta?</label>
                                    <Select value={conversaAberta} onValueChange={setConversaAberta}>
                                        <SelectTrigger className="w-full rounded-xl border-slate-200 focus:ring-[#00A5E6] focus:ring-2">
                                            <SelectValue placeholder="Selecione..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">Todos</SelectItem>
                                            <SelectItem value="yes">Sim</SelectItem>
                                            <SelectItem value="no">Não</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            {/* Linha 4: Cliente Nome */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-700">Client nome</label>
                                <div className="relative">
                                    <Input
                                        value={clienteNomeFiltro}
                                        onChange={(e) => onClienteNomeChange(e.target.value)}
                                        placeholder="Filtrar por nome do cliente..."
                                        disabled={!hasResults}
                                        className={cn(
                                            'rounded-xl border-slate-200 focus:ring-[#00A5E6] focus:ring-2 focus:border-[#00A5E6] pr-10',
                                            !hasResults && 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                        )}
                                    />
                                    {clienteNomeFiltro && hasResults && (
                                        <button type="button" onClick={() => onClienteNomeChange('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                                            <X className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Validação Feedback */}
                            {!canSearch && (
                                <p className="text-sm text-amber-600 bg-amber-50 p-2 rounded-lg">
                                    Preencha pelo menos um intervalo de datas completo (Agendamento ou Criação) para pesquisar.
                                </p>
                            )}

                            {/* Linha 5: Botão PESQUISAR (Full Width) */}
                            <Button
                                onClick={handlePesquisar}
                                disabled={!canSearch || isLoading}
                                className="w-full rounded-xl bg-[#00A5E6] hover:bg-[#0090cc] text-white font-medium h-12 text-base shadow-sm mt-2"
                            >
                                {isLoading ? 'Pesquisando...' : (
                                    <>
                                        <Search className="w-5 h-5 mr-2" />
                                        PESQUISAR
                                    </>
                                )}
                            </Button>
                        </div>
                    </CollapsibleContent>
                </div>
            </Collapsible>
        </div>
    );
}
