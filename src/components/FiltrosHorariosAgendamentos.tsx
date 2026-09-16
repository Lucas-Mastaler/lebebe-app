'use client';

import { useEffect, useRef, useState } from 'react';
import { Clock } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Alert, Button, DateField, FilterFieldGroup, FilterPanel, FormField, Input, useFilterState } from '@/components/design-system';
import { cn } from '@/lib/utils';

interface FiltrosHorariosAgendamentosProps {
    onPesquisar: (dataPesquisar: string, horaInicio: string, horaFim: string) => void;
    onLimpar: () => void;
    isLoading: boolean;
}

function formatTimeInput(value: string): string {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 2) return numbers;
    return `${numbers.slice(0, 2)}:${numbers.slice(2, 4)}`;
}

function parseDate(dateStr: string): Date | undefined {
    const parts = dateStr.split('/');
    if (parts.length !== 3) return undefined;
    const [day, month, year] = parts.map(Number);
    if (!day || !month || !year || year < 1900 || year > 2100) return undefined;
    const date = new Date(year, month - 1, day);
    if (Number.isNaN(date.getTime())) return undefined;
    return date;
}

function formatDateToISO(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
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
    return parsed.getFullYear() === hoje.getFullYear() && parsed.getMonth() === hoje.getMonth() && parsed.getDate() === hoje.getDate();
}

function obterHorarioAtualMais1Min(): string {
    const now = new Date();
    const totalMin = now.getHours() * 60 + now.getMinutes() + 1;
    return `${String(Math.floor(totalMin / 60)).padStart(2, '0')}:${String(totalMin % 60).padStart(2, '0')}`;
}

const HORAS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTOS = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));
const INITIAL_FILTERS = { dataPesquisar: '', horaInicio: '09:00', horaFim: '19:00', diaTodo: true };

function SeletorHorario({ value, onChange, onBlur, disabled, id, 'aria-invalid': ariaInvalid, 'aria-describedby': ariaDescribedBy }: { value: string; onChange: (value: string) => void; onBlur?: () => void; disabled?: boolean; id: string; 'aria-invalid': boolean; 'aria-describedby'?: string }) {
    const [open, setOpen] = useState(false);
    const horaRef = useRef<HTMLDivElement>(null);
    const minRef = useRef<HTMLDivElement>(null);
    const [hh, mm] = value.split(':');
    const horaAtual = hh || '07';
    const minutoAtual = mm || '00';

    useEffect(() => {
        if (!open) return;
        const timeout = window.setTimeout(() => {
            horaRef.current?.children[Number(horaAtual)]?.scrollIntoView({ block: 'center' });
            minRef.current?.children[Number(minutoAtual)]?.scrollIntoView({ block: 'center' });
        }, 50);
        return () => window.clearTimeout(timeout);
    }, [open, horaAtual, minutoAtual]);

    return (
        <div className="relative">
            <Input id={id} value={value} onChange={(event) => onChange(formatTimeInput(event.target.value))} onBlur={onBlur} placeholder="HH:mm" maxLength={5} disabled={disabled} aria-invalid={ariaInvalid} aria-describedby={ariaDescribedBy} className="pr-10" />
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild><Button type="button" variant="ghost" size="icon" aria-label="Selecionar horário" disabled={disabled} className="absolute top-0 right-0 size-9"><Clock className="size-4" /></Button></PopoverTrigger>
                <PopoverContent className="w-52 p-0" align="start">
                    <div className="flex border-b border-border px-3 py-2 text-center text-xs font-semibold text-muted-foreground"><span className="w-1/2">Hora</span><span className="w-1/2">Min.</span></div>
                    <div className="flex h-52"><div ref={horaRef} className="w-1/2 overflow-y-auto border-r border-border">{HORAS.map((hora) => <button key={hora} type="button" onClick={() => onChange(`${hora}:${minutoAtual}`)} className={cn('w-full py-1.5 text-sm transition-colors hover:bg-primary/10', hora === horaAtual ? 'bg-primary/15 font-semibold text-primary' : 'text-foreground')}>{hora}</button>)}</div><div ref={minRef} className="w-1/2 overflow-y-auto">{MINUTOS.map((minuto) => <button key={minuto} type="button" onClick={() => onChange(`${horaAtual}:${minuto}`)} className={cn('w-full py-1.5 text-sm transition-colors hover:bg-primary/10', minuto === minutoAtual ? 'bg-primary/15 font-semibold text-primary' : 'text-foreground')}>{minuto}</button>)}</div></div>
                    <div className="flex justify-end border-t border-border p-2"><Button type="button" size="sm" onClick={() => setOpen(false)}>OK</Button></div>
                </PopoverContent>
            </Popover>
        </div>
    );
}

export function FiltrosHorariosAgendamentos({ onPesquisar, onLimpar, isLoading }: FiltrosHorariosAgendamentosProps) {
    const filters = useFilterState(INITIAL_FILTERS);
    const [dateTouched, setDateTouched] = useState(false);
    const [startTouched, setStartTouched] = useState(false);
    const [endTouched, setEndTouched] = useState(false);
    const hoje = obterHojeBR();
    const selectedDate = parseDate(filters.draft.dataPesquisar);
    const isDataValida = Boolean(selectedDate && selectedDate >= hoje);
    const isDataPassada = Boolean(selectedDate && selectedDate < hoje);
    const isHoraInicioValida = isValidTime(filters.draft.horaInicio);
    const isHoraFimValida = isValidTime(filters.draft.horaFim);
    const canSearch = isDataValida && isHoraInicioValida && isHoraFimValida;
    const dateError = !isDataValida ? (isDataPassada ? 'Selecione hoje ou uma data futura.' : 'Preencha uma data válida.') : undefined;

    function handlePesquisar() {
        if (!canSearch || !selectedDate) return;
        filters.apply();
        let horaInicio = filters.draft.diaTodo ? '09:00' : filters.draft.horaInicio;
        const horaFim = filters.draft.diaTodo ? '19:00' : filters.draft.horaFim;
        if (isHoje(filters.draft.dataPesquisar)) {
            const horarioMinimo = obterHorarioAtualMais1Min();
            if (horaInicio < horarioMinimo) horaInicio = horarioMinimo;
        }
        onPesquisar(formatDateToISO(selectedDate), horaInicio, horaFim);
    }

    function handleDiaTodoChange(checked: boolean) {
        filters.setField('diaTodo', checked);
        if (checked) {
            filters.setField('horaInicio', '09:00');
            filters.setField('horaFim', '19:00');
        }
    }

    function handleClear() {
        filters.clear();
        setDateTouched(false);
        setStartTouched(false);
        setEndTouched(false);
        onLimpar();
    }

    return (
        <FilterPanel dirty={filters.dirty} onApply={handlePesquisar} onClear={handleClear} applyDisabled={!canSearch || isLoading}>
            <FilterFieldGroup label="Período">
                <FormField id="data-pesquisar" label="Data a pesquisar" required error={dateTouched ? dateError : undefined}>{(field) => <DateField {...field} value={filters.draft.dataPesquisar} onChange={(value) => filters.setField('dataPesquisar', value)} onBlur={() => setDateTouched(true)} min={hoje} />}</FormField>
                <FormField id="hora-inicio" label="Hora início" required error={startTouched && !isHoraInicioValida ? 'Informe um horário válido.' : undefined}>{(field) => <SeletorHorario {...field} value={filters.draft.horaInicio} onChange={(value) => filters.setField('horaInicio', value)} onBlur={() => setStartTouched(true)} disabled={filters.draft.diaTodo} />}</FormField>
                <FormField id="hora-fim" label="Hora fim" required error={endTouched && !isHoraFimValida ? 'Informe um horário válido.' : undefined}>{(field) => <SeletorHorario {...field} value={filters.draft.horaFim} onChange={(value) => filters.setField('horaFim', value)} onBlur={() => setEndTouched(true)} disabled={filters.draft.diaTodo} />}</FormField>
            </FilterFieldGroup>
            <div className="flex items-center gap-2"><Checkbox id="diaTodo" checked={filters.draft.diaTodo} onCheckedChange={handleDiaTodoChange} /><label htmlFor="diaTodo" className="text-sm font-medium text-foreground">Dia todo (09:00 - 19:00)</label></div>
            {isHoje(filters.draft.dataPesquisar) && <Alert tone="info">Pesquisa do dia atual: horários já passados serão automaticamente excluídos.</Alert>}
        </FilterPanel>
    );
}
