'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, ChevronUp, Search, Clock } from 'lucide-react';
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
import { cn } from '@/lib/utils';

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

function obterHojeBR(): Date {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function isHoje(dateStr: string): boolean {
    const parsed = parseDate(dateStr);
    if (!parsed) return false;
    const hoje = obterHojeBR();
    return parsed.getFullYear() === hoje.getFullYear()
        && parsed.getMonth() === hoje.getMonth()
        && parsed.getDate() === hoje.getDate();
}

function obterHorarioAtualMais1Min(): string {
    const now = new Date();
    const totalMin = now.getHours() * 60 + now.getMinutes() + 1;
    const hh = Math.floor(totalMin / 60);
    const mm = totalMin % 60;
    return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

// Gera lista de horas (0-23)
const HORAS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
// Gera lista de minutos (0-59)
const MINUTOS = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));

function SeletorHorario({
    value,
    onChange,
    disabled,
}: {
    value: string;
    onChange: (val: string) => void;
    disabled?: boolean;
}) {
    const [open, setOpen] = useState(false);
    const horaRef = useRef<HTMLDivElement>(null);
    const minRef = useRef<HTMLDivElement>(null);

    const [hh, mm] = value.split(':');
    const horaAtual = hh || '07';
    const minutoAtual = mm || '00';

    useEffect(() => {
        if (open) {
            // Scroll para hora e minuto selecionados
            setTimeout(() => {
                const horaIdx = parseInt(horaAtual);
                const minIdx = parseInt(minutoAtual);
                if (horaRef.current) {
                    const el = horaRef.current.children[horaIdx] as HTMLElement;
                    el?.scrollIntoView({ block: 'center' });
                }
                if (minRef.current) {
                    const el = minRef.current.children[minIdx] as HTMLElement;
                    el?.scrollIntoView({ block: 'center' });
                }
            }, 50);
        }
    }, [open, horaAtual, minutoAtual]);

    const handleSelectHora = (h: string) => {
        onChange(`${h}:${minutoAtual}`);
    };

    const handleSelectMinuto = (m: string) => {
        onChange(`${horaAtual}:${m}`);
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <div className="relative">
                    <Input
                        value={value}
                        onChange={(e) => onChange(formatTimeInput(e.target.value))}
                        placeholder="HH:mm"
                        maxLength={5}
                        disabled={disabled}
                        className="rounded-xl border-slate-200 focus:ring-[#00A5E6] focus:ring-2 disabled:bg-slate-100 disabled:text-slate-500 pr-10"
                    />
                    <button
                        type="button"
                        onClick={() => { if (!disabled) setOpen(!open); }}
                        disabled={disabled}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 disabled:opacity-50"
                    >
                        <Clock className="w-4 h-4" />
                    </button>
                </div>
            </PopoverTrigger>
            <PopoverContent className="w-[200px] p-0" align="start">
                <div className="flex border-b border-slate-100 px-3 py-2">
                    <span className="text-xs font-semibold text-slate-500 w-1/2 text-center">Hora</span>
                    <span className="text-xs font-semibold text-slate-500 w-1/2 text-center">Min</span>
                </div>
                <div className="flex h-[200px]">
                    <div ref={horaRef} className="w-1/2 overflow-y-auto border-r border-slate-100 scrollbar-thin">
                        {HORAS.map(h => (
                            <button
                                key={h}
                                type="button"
                                onClick={() => handleSelectHora(h)}
                                className={cn(
                                    'w-full text-center py-1.5 text-sm hover:bg-[#00A5E6]/10 transition-colors',
                                    h === horaAtual ? 'bg-[#00A5E6]/15 text-[#00A5E6] font-semibold' : 'text-slate-700'
                                )}
                            >
                                {h}
                            </button>
                        ))}
                    </div>
                    <div ref={minRef} className="w-1/2 overflow-y-auto scrollbar-thin">
                        {MINUTOS.map(m => (
                            <button
                                key={m}
                                type="button"
                                onClick={() => handleSelectMinuto(m)}
                                className={cn(
                                    'w-full text-center py-1.5 text-sm hover:bg-[#00A5E6]/10 transition-colors',
                                    m === minutoAtual ? 'bg-[#00A5E6]/15 text-[#00A5E6] font-semibold' : 'text-slate-700'
                                )}
                            >
                                {m}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="border-t border-slate-100 p-2 flex justify-end">
                    <Button
                        size="sm"
                        onClick={() => setOpen(false)}
                        className="rounded-lg bg-[#00A5E6] hover:bg-[#0090cc] text-white text-xs h-7 px-3"
                    >
                        OK
                    </Button>
                </div>
            </PopoverContent>
        </Popover>
    );
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

    const hoje = obterHojeBR();

    const isDataValida = (() => {
        if (dataPesquisar.length !== 10) return false;
        const parsed = parseDate(dataPesquisar);
        if (!parsed) return false;
        // Não permitir datas passadas
        const hojeSemHora = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
        const parsedSemHora = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
        return parsedSemHora >= hojeSemHora;
    })();

    const isDataPassada = (() => {
        if (dataPesquisar.length !== 10) return false;
        const parsed = parseDate(dataPesquisar);
        if (!parsed) return false;
        const hojeSemHora = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
        const parsedSemHora = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
        return parsedSemHora < hojeSemHora;
    })();

    const isHoraInicioValida = isValidTime(horaInicio);
    const isHoraFimValida = isValidTime(horaFim);
    
    const canSearch = isDataValida && isHoraInicioValida && isHoraFimValida;

    const handlePesquisar = () => {
        if (!canSearch) return;

        const dateObj = parseDate(dataPesquisar);
        if (!dateObj) return;

        const dataIso = formatDateToISO(dateObj);
        let horaInicioFinal = diaTodo ? '07:00' : horaInicio;
        const horaFimFinal = diaTodo ? '20:59' : horaFim;

        // Se for hoje, ajustar horaInicio para horário atual + 1 minuto
        if (isHoje(dataPesquisar)) {
            const horarioMinimo = obterHorarioAtualMais1Min();
            if (horaInicioFinal < horarioMinimo) {
                console.log(`⏰ Dia atual: ajustando hora início de ${horaInicioFinal} para ${horarioMinimo}`);
                horaInicioFinal = horarioMinimo;
            }
        }

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
                                                disabled={(date) => date < hoje}
                                                initialFocus
                                            />
                                        </PopoverContent>
                                    </Popover>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-700">Hora início</label>
                                    <SeletorHorario
                                        value={horaInicio}
                                        onChange={setHoraInicio}
                                        disabled={diaTodo}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-700">Hora fim</label>
                                    <SeletorHorario
                                        value={horaFim}
                                        onChange={setHoraFim}
                                        disabled={diaTodo}
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

                            {isHoje(dataPesquisar) && (
                                <p className="text-sm text-blue-600 bg-blue-50 p-2 rounded-lg">
                                    ℹ️ Pesquisa do dia atual: horários já passados serão automaticamente excluídos.
                                </p>
                            )}

                            {isDataPassada && (
                                <p className="text-sm text-red-600 bg-red-50 p-2 rounded-lg">
                                    ⚠️ Não é possível pesquisar datas passadas. Selecione hoje ou uma data futura.
                                </p>
                            )}

                            {!canSearch && !isDataPassada && (
                                <p className="text-sm text-amber-600 bg-amber-50 p-2 rounded-lg">
                                    {dataPesquisar.length < 10 && 'Preencha uma data válida. '}
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
