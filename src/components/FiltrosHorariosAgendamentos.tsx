'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Checkbox } from '@/components/ui/checkbox';

interface FiltrosHorariosAgendamentosProps {
    onPesquisar: (dataPesquisar: string, horaInicio: string, horaFim: string) => void;
    isLoading: boolean;
}

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

function formatDateToISO(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function formatTimeInput(value: string): string {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 2) return numbers;
    return `${numbers.slice(0, 2)}:${numbers.slice(2, 4)}`;
}

function isValidTime(timeStr: string): boolean {
    if (timeStr.length !== 5) return false;
    const [hh, mm] = timeStr.split(':').map(Number);
    return hh >= 0 && hh <= 23 && mm >= 0 && mm <= 59;
}

export function FiltrosHorariosAgendamentos({
    onPesquisar,
    isLoading,
}: FiltrosHorariosAgendamentosProps) {
    const [isOpen, setIsOpen] = useState(true);
    
    const [dataPesquisar, setDataPesquisar] = useState('');
    const [dataPopoverOpen, setDataPopoverOpen] = useState(false);
    
    const [horaInicio, setHoraInicio] = useState('07:00');
    const [horaFim, setHoraFim] = useState('20:59');
    const [diaTodo, setDiaTodo] = useState(true);

    const isDataValida = dataPesquisar.length === 10 && parseDate(dataPesquisar) !== undefined;
    const isHoraInicioValida = isValidTime(horaInicio);
    const isHoraFimValida = isValidTime(horaFim);
    
    const canSearch = isDataValida && isHoraInicioValida && isHoraFimValida;

    const handlePesquisar = () => {
        if (!canSearch) return;

        const dateObj = parseDate(dataPesquisar);
        if (!dateObj) return;

        const dataIso = formatDateToISO(dateObj);
        const horaInicioFinal = diaTodo ? '07:00' : horaInicio;
        const horaFimFinal = diaTodo ? '20:59' : horaFim;

        console.log('🔍 Iniciando pesquisa com filtros:');
        console.log('   Data (BR):', dataPesquisar, '→', dataIso);
        console.log('   Hora início:', horaInicioFinal);
        console.log('   Hora fim:', horaFimFinal);
        console.log('   Dia todo:', diaTodo);

        onPesquisar(dataIso, horaInicioFinal, horaFimFinal);
    };

    const handleDiaTodoChange = (checked: boolean) => {
        setDiaTodo(checked);
        if (checked) {
            setHoraInicio('07:00');
            setHoraFim('20:59');
        }
    };

    const handleDateSelect = (date: Date | undefined) => {
        setDataPesquisar(formatDateToInput(date));
        setDataPopoverOpen(false);
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
                            
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-700">Data a pesquisar</label>
                                    <Popover open={dataPopoverOpen} onOpenChange={setDataPopoverOpen}>
                                        <PopoverTrigger asChild>
                                            <div className="relative">
                                                <Input
                                                    value={dataPesquisar}
                                                    onChange={(e) => setDataPesquisar(formatDateInput(e.target.value))}
                                                    placeholder="dd/mm/aaaa"
                                                    maxLength={10}
                                                    className="rounded-xl border-slate-200 focus:ring-[#00A5E6] focus:ring-2 pr-10"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setDataPopoverOpen(!dataPopoverOpen)}
                                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                                                >
                                                    📅
                                                </button>
                                            </div>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0" align="start">
                                            <Calendar
                                                mode="single"
                                                selected={parseDate(dataPesquisar)}
                                                onSelect={handleDateSelect}
                                                initialFocus
                                            />
                                        </PopoverContent>
                                    </Popover>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-700">Hora início</label>
                                    <Input
                                        value={horaInicio}
                                        onChange={(e) => setHoraInicio(formatTimeInput(e.target.value))}
                                        placeholder="HH:mm"
                                        maxLength={5}
                                        disabled={diaTodo}
                                        className="rounded-xl border-slate-200 focus:ring-[#00A5E6] focus:ring-2 disabled:bg-slate-100 disabled:text-slate-500"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-700">Hora fim</label>
                                    <Input
                                        value={horaFim}
                                        onChange={(e) => setHoraFim(formatTimeInput(e.target.value))}
                                        placeholder="HH:mm"
                                        maxLength={5}
                                        disabled={diaTodo}
                                        className="rounded-xl border-slate-200 focus:ring-[#00A5E6] focus:ring-2 disabled:bg-slate-100 disabled:text-slate-500"
                                    />
                                </div>
                            </div>

                            <div className="flex items-center space-x-2">
                                <Checkbox
                                    id="diaTodo"
                                    checked={diaTodo}
                                    onCheckedChange={handleDiaTodoChange}
                                    className="rounded border-slate-300 data-[state=checked]:bg-[#00A5E6] data-[state=checked]:border-[#00A5E6]"
                                />
                                <label
                                    htmlFor="diaTodo"
                                    className="text-sm font-medium text-slate-700 cursor-pointer"
                                >
                                    Dia todo (07:00 - 20:59)
                                </label>
                            </div>

                            {!canSearch && (
                                <p className="text-sm text-amber-600 bg-amber-50 p-2 rounded-lg">
                                    {!isDataValida && 'Preencha uma data válida. '}
                                    {!isHoraInicioValida && 'Hora início inválida. '}
                                    {!isHoraFimValida && 'Hora fim inválida.'}
                                </p>
                            )}

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
