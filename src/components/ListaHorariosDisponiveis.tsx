'use client';

import { Clock, RefreshCw, AlertCircle, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

function isHorarioNoturno(horario: string): boolean {
    const [hh] = horario.split(':').map(Number);
    return hh >= 18;
}

interface AgendamentoDigisac {
    id: string;
    scheduledAt: string;
    serviceId: string;
    message?: string;
    status?: string;
}

interface ListaHorariosDisponiveisProps {
    horarios: string[];
    isLoading: boolean;
    error: string | null;
    agendamentosExistentes: AgendamentoDigisac[];
    ultimaPesquisa: {
        dataPesquisar: string;
        horaInicio: string;
        horaFim: string;
    } | null;
    onRecarregar?: () => void;
}

export function ListaHorariosDisponiveis({
    horarios,
    isLoading,
    error,
    agendamentosExistentes,
    ultimaPesquisa,
    onRecarregar,
}: ListaHorariosDisponiveisProps) {
    if (isLoading) {
        return (
            <div className="bg-white rounded-2xl border border-slate-200 card-shadow p-8">
                <div className="flex flex-col items-center justify-center space-y-4">
                    <div className="animate-spin rounded-full h-12 w-12 border-4 border-slate-200 border-t-[#00A5E6]"></div>
                    <p className="text-slate-600">Calculando horários disponíveis...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-white rounded-2xl border border-slate-200 card-shadow p-8">
                <div className="flex flex-col items-center justify-center space-y-4">
                    <AlertCircle className="w-12 h-12 text-red-500" />
                    <p className="text-slate-900 font-semibold">Erro ao carregar horários</p>
                    <p className="text-slate-600 text-sm">{error}</p>
                    {onRecarregar && (
                        <Button
                            onClick={onRecarregar}
                            className="rounded-xl bg-[#00A5E6] hover:bg-[#0090cc] text-white"
                        >
                            <RefreshCw className="w-4 h-4 mr-2" />
                            Tentar novamente
                        </Button>
                    )}
                </div>
            </div>
        );
    }

    if (horarios.length === 0 && !ultimaPesquisa) {
        return (
            <div className="bg-white rounded-2xl border border-slate-200 card-shadow p-8">
                <div className="flex flex-col items-center justify-center space-y-4">
                    <Clock className="w-12 h-12 text-slate-300" />
                    <p className="text-slate-600">Utilize os filtros acima para pesquisar horários disponíveis</p>
                </div>
            </div>
        );
    }

    if (horarios.length === 0 && ultimaPesquisa) {
        return (
            <div className="bg-white rounded-2xl border border-slate-200 card-shadow p-8">
                <div className="flex flex-col items-center justify-center space-y-4">
                    <AlertCircle className="w-12 h-12 text-amber-500" />
                    <p className="text-slate-900 font-semibold">Nenhum horário disponível</p>
                    <p className="text-slate-600 text-sm text-center">
                        Não há horários disponíveis no intervalo selecionado.<br />
                        Tente outro período ou data.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-slate-200 card-shadow">
                <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="bg-[#00A5E6]/10 p-2 rounded-lg">
                            <Calendar className="w-5 h-5 text-[#00A5E6]" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-slate-900">Horários Disponíveis</h3>
                            <p className="text-sm text-slate-600">
                                {horarios.length} horário{horarios.length !== 1 ? 's' : ''} disponível
                                {horarios.length !== 1 ? 'eis' : ''}
                                {ultimaPesquisa && ` • ${formatarData(ultimaPesquisa.dataPesquisar)}`}
                            </p>
                        </div>
                    </div>
                    {onRecarregar && (
                        <Button
                            onClick={onRecarregar}
                            variant="outline"
                            size="sm"
                            className="rounded-lg border-slate-200 hover:bg-slate-50"
                        >
                            <RefreshCw className="w-4 h-4 mr-2" />
                            Atualizar
                        </Button>
                    )}
                </div>

                <div className="p-4">
                    {agendamentosExistentes.length > 0 && (
                        <div className="mb-4 p-3 bg-blue-50 border border-blue-100 rounded-lg">
                            <p className="text-sm text-blue-900">
                                <strong>ℹ️ Intervalo mínimo:</strong> 7 minutos entre agendamentos.{' '}
                                <span className="text-blue-700">
                                    {agendamentosExistentes.length} agendamento{agendamentosExistentes.length !== 1 ? 's' : ''} existente{agendamentosExistentes.length !== 1 ? 's' : ''} no período.
                                </span>
                            </p>
                        </div>
                    )}

                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3">
                        {horarios.map((horario, index) => {
                            const noturno = isHorarioNoturno(horario);
                            return (
                                <div
                                    key={index}
                                    className={cn(
                                        'flex items-center justify-center gap-2 p-3 rounded-xl border-2 transition-all cursor-pointer group',
                                        noturno
                                            ? 'border-red-200 bg-red-50 hover:border-red-400 hover:bg-red-100'
                                            : 'border-slate-200 bg-slate-50 hover:border-[#00A5E6] hover:bg-[#00A5E6]/5'
                                    )}
                                >
                                    <Clock className={cn(
                                        'w-4 h-4 transition-colors',
                                        noturno
                                            ? 'text-red-400 group-hover:text-red-600'
                                            : 'text-slate-400 group-hover:text-[#00A5E6]'
                                    )} />
                                    <span className={cn(
                                        'font-mono font-semibold transition-colors',
                                        noturno
                                            ? 'text-red-600 group-hover:text-red-700'
                                            : 'text-slate-900 group-hover:text-[#00A5E6]'
                                    )}>
                                        {horario}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>


        </div>
    );
}

function formatarData(dataIso: string): string {
    const [ano, mes, dia] = dataIso.split('-');
    return `${dia}/${mes}/${ano}`;
}
