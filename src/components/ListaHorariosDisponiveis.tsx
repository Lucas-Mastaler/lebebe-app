'use client';

import { Clock, RefreshCw, AlertCircle, Calendar } from 'lucide-react';
import { Alert, Button, Card, CardContent, CardHeader, EmptyState, KpiCard, SkeletonRows } from '@/components/design-system';
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
            <Card><CardContent><SkeletonRows rows={5} /><p className="mt-4 text-sm text-muted-foreground">Calculando horários disponíveis...</p></CardContent></Card>
        );
    }

    if (error) {
        return (
            <Card><CardContent className="space-y-4"><Alert tone="danger" title="Erro ao carregar horários">{error}</Alert>{onRecarregar && <Button onClick={onRecarregar}><RefreshCw className="size-4" />Tentar novamente</Button>}</CardContent></Card>
        );
    }

    if (horarios.length === 0 && !ultimaPesquisa) {
        return (
            <Card><EmptyState icon={<Clock className="size-5" />} title="Consulte os horários disponíveis" description="Defina a data e o período, depois clique em Filtrar." /></Card>
        );
    }

    if (horarios.length === 0 && ultimaPesquisa) {
        return (
            <Card><EmptyState icon={<AlertCircle className="size-5" />} title="Nenhum horário disponível" description="Não há horários no intervalo selecionado. Tente outro período ou data." /></Card>
        );
    }

    return (
        <div className="space-y-4">
            <Card>
                <CardHeader icon={<Calendar className="size-5" />} title="Horários disponíveis" description={ultimaPesquisa ? formatarData(ultimaPesquisa.dataPesquisar) : undefined} action={onRecarregar && <Button onClick={onRecarregar} variant="secondary" size="sm"><RefreshCw className="size-4" />Atualizar</Button>} />
                <CardContent className="space-y-4">
                    <KpiCard className="w-fit min-w-36" label="Disponíveis" value={horarios.length} icon={<Clock className="size-4" />} />
                    {agendamentosExistentes.length > 0 && (
                        <Alert tone="info" title="Intervalo mínimo">7 minutos entre agendamentos. {agendamentosExistentes.length} agendamento{agendamentosExistentes.length !== 1 ? 's' : ''} existente{agendamentosExistentes.length !== 1 ? 's' : ''} no período.</Alert>
                    )}

                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3">
                        {horarios.map((horario, index) => {
                            const noturno = isHorarioNoturno(horario);
                            return (
                                <div
                                    key={index}
                                    className={cn(
                                        'flex items-center justify-center gap-2 rounded-md border p-3 transition-colors',
                                        noturno
                                            ? 'border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/15'
                                            : 'border-border bg-muted/40 hover:border-primary hover:bg-primary/5'
                                    )}
                                >
                                    <Clock className={cn(
                                        'size-4 transition-colors',
                                        noturno
                                            ? 'text-destructive'
                                            : 'text-muted-foreground'
                                    )} />
                                    <span className={cn(
                                        'font-mono font-semibold',
                                        noturno
                                            ? 'text-destructive'
                                            : 'text-foreground'
                                    )}>
                                        {horario}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </CardContent>
            </Card>


        </div>
    );
}

function formatarData(dataIso: string): string {
    const [ano, mes, dia] = dataIso.split('-');
    return `${dia}/${mes}/${ano}`;
}
