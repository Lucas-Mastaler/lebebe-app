'use client';

import { useState, useCallback } from 'react';
import { FiltrosHorariosAgendamentos } from './FiltrosHorariosAgendamentos';
import { ListaHorariosDisponiveis } from './ListaHorariosDisponiveis';

interface AgendamentoDigisac {
    id: string;
    scheduledAt: string;
    serviceId: string;
    message?: string;
    status?: string;
}

export function HorariosAgendamentosPage() {
    const [horariosDisponiveis, setHorariosDisponiveis] = useState<string[]>([]);
    const [agendamentosExistentes, setAgendamentosExistentes] = useState<AgendamentoDigisac[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [ultimaPesquisa, setUltimaPesquisa] = useState<{
        dataPesquisar: string;
        horaInicio: string;
        horaFim: string;
    } | null>(null);

    const handlePesquisar = useCallback(async (
        dataPesquisar: string,
        horaInicio: string,
        horaFim: string
    ) => {
        setIsLoading(true);
        setError(null);
        setHorariosDisponiveis([]);

        try {
            console.log('🔍 Pesquisando horários disponíveis');
            console.log('📅 Data (BR):', dataPesquisar);
            console.log('⏰ Intervalo (BR):', `${horaInicio} - ${horaFim}`);

            const startUtcIso = converterBRParaUtcIso(dataPesquisar, horaInicio);
            const endUtcIso = converterBRParaUtcIso(dataPesquisar, horaFim);

            console.log('🌍 Intervalo (UTC):', `${startUtcIso} - ${endUtcIso}`);

            const agendamentos = await buscarAgendamentos(startUtcIso, endUtcIso);
            
            console.log('📊 Agendamentos encontrados:', agendamentos.length);
            
            setAgendamentosExistentes(agendamentos);

            const horariosCalculados = gerarHorariosSugeridos(
                horaInicio,
                horaFim,
                agendamentos,
                dataPesquisar
            );

            console.log('✅ Horários disponíveis calculados:', horariosCalculados.length);
            
            setHorariosDisponiveis(horariosCalculados);
            setUltimaPesquisa({ dataPesquisar, horaInicio, horaFim });

        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Erro ao pesquisar horários';
            setError(errorMessage);
            console.error('❌ Erro na pesquisa:', errorMessage);
        } finally {
            setIsLoading(false);
        }
    }, []);

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-slate-900">HORÁRIOS AGENDAMENTOS</h1>
                <p className="text-slate-600 mt-1">Consulta de horários disponíveis</p>
            </div>

            <FiltrosHorariosAgendamentos
                onPesquisar={handlePesquisar}
                isLoading={isLoading}
            />

            <ListaHorariosDisponiveis
                horarios={horariosDisponiveis}
                isLoading={isLoading}
                error={error}
                agendamentosExistentes={agendamentosExistentes}
                ultimaPesquisa={ultimaPesquisa}
                onRecarregar={ultimaPesquisa ? () => handlePesquisar(
                    ultimaPesquisa.dataPesquisar,
                    ultimaPesquisa.horaInicio,
                    ultimaPesquisa.horaFim
                ) : undefined}
            />
        </div>
    );
}

function converterBRParaUtcIso(dataPesquisar: string, hora: string): string {
    const [ano, mes, dia] = dataPesquisar.split('-').map(Number);
    const [hh, mm] = hora.split(':').map(Number);
    
    const dataBR = new Date(ano, mes - 1, dia, hh, mm, 0, 0);
    
    const offsetBR = -3 * 60;
    const offsetLocal = dataBR.getTimezoneOffset();
    const diffMinutes = offsetBR - offsetLocal;
    
    const dataUTC = new Date(dataBR.getTime() - diffMinutes * 60000);
    
    return dataUTC.toISOString();
}

async function buscarAgendamentos(
    startUtcIso: string,
    endUtcIso: string
): Promise<AgendamentoDigisac[]> {
    const serviceId = '4af28025-c210-4336-a560-785d2fb8a778';
    
    const params = new URLSearchParams({
        'where[serviceId]': serviceId,
        'where[scheduledAt][$between][0]': startUtcIso,
        'where[scheduledAt][$between][1]': endUtcIso,
        'page': '1',
        'perPage': '100'
    });

    const url = `/api/digisac/schedule?${params.toString()}`;
    
    console.log('🔗 Buscando agendamentos:', url);

    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(`Erro ao buscar agendamentos: ${response.status}`);
    }

    const data = await response.json();
    
    return data.items || [];
}

function gerarHorariosSugeridos(
    horaInicioBR: string,
    horaFimBR: string,
    agendamentos: AgendamentoDigisac[],
    dataPesquisar: string
): string[] {
    const [anoData, mesData, diaData] = dataPesquisar.split('-').map(Number);
    const [hhInicio, mmInicio] = horaInicioBR.split(':').map(Number);
    const [hhFim, mmFim] = horaFimBR.split(':').map(Number);

    const inicioBRMs = new Date(anoData, mesData - 1, diaData, hhInicio, mmInicio, 0).getTime();
    const fimBRMs = new Date(anoData, mesData - 1, diaData, hhFim, mmFim, 0).getTime();

    const agendamentosMs = agendamentos.map(ag => {
        const dataUtc = new Date(ag.scheduledAt);
        const offsetBR = -3 * 60;
        const offsetLocal = dataUtc.getTimezoneOffset();
        const diffMinutes = offsetBR - offsetLocal;
        const dataBR = new Date(dataUtc.getTime() + diffMinutes * 60000);
        return dataBR.getTime();
    }).sort((a, b) => a - b);

    console.log('📍 Agendamentos existentes (BR):');
    agendamentosMs.forEach(ms => {
        const d = new Date(ms);
        console.log(`   - ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`);
    });

    const intervaloMinimo = 7 * 60 * 1000;
    const horariosSugeridos: string[] = [];
    let candidatoMs = inicioBRMs;

    while (candidatoMs <= fimBRMs) {
        const conflito = existeConflito(candidatoMs, agendamentosMs, intervaloMinimo);
        
        if (!conflito) {
            const d = new Date(candidatoMs);
            const horarioFormatado = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
            horariosSugeridos.push(horarioFormatado);
            candidatoMs += intervaloMinimo;
        } else {
            const proximoHorarioLivre = conflito.agendamentoConflitante + intervaloMinimo;
            console.log(`   ⚠️ Conflito em ${new Date(candidatoMs).getHours()}:${new Date(candidatoMs).getMinutes()} -> ajustando para ${new Date(proximoHorarioLivre).getHours()}:${new Date(proximoHorarioLivre).getMinutes()}`);
            candidatoMs = proximoHorarioLivre;
        }
    }

    return horariosSugeridos;
}

function existeConflito(
    candidatoMs: number,
    agendamentosMs: number[],
    intervaloMinimo: number
): { agendamentoConflitante: number } | null {
    for (const agMs of agendamentosMs) {
        const distancia = Math.abs(candidatoMs - agMs);
        if (distancia < intervaloMinimo) {
            return { agendamentoConflitante: agMs };
        }
    }
    return null;
}
