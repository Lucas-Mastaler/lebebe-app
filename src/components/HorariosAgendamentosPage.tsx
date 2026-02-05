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
            // 1) Montar ranges UTC (real e com folga)
            const range = montarRangeUtcComFolga(dataPesquisar, horaInicio, horaFim);

            // 2) Buscar agendamentos com folga
            const agendamentos = await buscarAgendamentosDigisac(
                SERVICE_ID,
                range.startBuscaUtcIso,
                range.endBuscaUtcIso
            );

            setAgendamentosExistentes(agendamentos);

            // 3) Gerar horários disponíveis validando conflitos
            const horariosCalculados = gerarHorariosDisponiveis(
                dataPesquisar,
                horaInicio,
                horaFim,
                agendamentos
            );

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

// ═══════════════════════════════════════════════════════════════
// Constantes
// ═══════════════════════════════════════════════════════════════
const SERVICE_ID = '4af28025-c210-4336-a560-785d2fb8a778';
const INTERVALO_MIN_MS = 7 * 60 * 1000;   // 7 minutos em ms
const FOLGA_MS = 6 * 60 * 1000 + 59 * 1000; // 6min59s em ms

// ═══════════════════════════════════════════════════════════════
// converterBRParaUtcIso
// Monta string ISO com offset -03:00 e converte para UTC.
// Exemplo: "2026-02-05", "16:29" → "2026-02-05T19:29:00.000Z"
// ═══════════════════════════════════════════════════════════════
function converterBRParaUtcIso(dataPesquisar: string, horaHHMM: string): string {
    const isoBR = `${dataPesquisar}T${horaHHMM}:00-03:00`;
    const utcIso = new Date(isoBR).toISOString();
    console.log(`[TZ] BR ${dataPesquisar} ${horaHHMM} → UTC ${utcIso}`);
    return utcIso;
}

// ═══════════════════════════════════════════════════════════════
// montarRangeUtcComFolga
// Retorna o range real (para gerar candidatos) e o range com
// folga de ±6min59s (para buscar no Digisac e pegar conflitos
// que estejam na borda).
// ═══════════════════════════════════════════════════════════════
function montarRangeUtcComFolga(dataPesquisar: string, horaInicio: string, horaFim: string) {
    const startUtcIso = converterBRParaUtcIso(dataPesquisar, horaInicio);
    const endUtcIso = converterBRParaUtcIso(dataPesquisar, horaFim);

    const startBuscaUtcIso = new Date(new Date(startUtcIso).getTime() - FOLGA_MS).toISOString();
    const endBuscaUtcIso = new Date(new Date(endUtcIso).getTime() + FOLGA_MS).toISOString();

    console.log(`[RANGE] Intervalo real  (UTC): ${startUtcIso}  →  ${endUtcIso}`);
    console.log(`[RANGE] Intervalo busca (UTC): ${startBuscaUtcIso}  →  ${endBuscaUtcIso}`);
    console.log(`[RANGE] Intervalo real  (BR) : ${dataPesquisar} ${horaInicio}  →  ${dataPesquisar} ${horaFim}`);

    return { startUtcIso, endUtcIso, startBuscaUtcIso, endBuscaUtcIso };
}

// ═══════════════════════════════════════════════════════════════
// buscarAgendamentosDigisac
// GET /api/digisac/schedule com serviceId + between (com folga)
// ═══════════════════════════════════════════════════════════════
async function buscarAgendamentosDigisac(
    serviceId: string,
    startBuscaUtcIso: string,
    endBuscaUtcIso: string
): Promise<AgendamentoDigisac[]> {
    const params = new URLSearchParams({
        'where[serviceId]': serviceId,
        'where[scheduledAt][$between][0]': startBuscaUtcIso,
        'where[scheduledAt][$between][1]': endBuscaUtcIso,
        'page': '1',
        'perPage': '200',
    });

    const url = `/api/digisac/schedule?${params.toString()}`;

    console.log(`[API] GET ${url}`);

    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(`Erro ao buscar agendamentos: ${response.status}`);
    }

    const data = await response.json();
    const items: AgendamentoDigisac[] = data.items || [];

    console.log(`[API] Agendamentos retornados: ${items.length}`);

    return items;
}

// ═══════════════════════════════════════════════════════════════
// Helpers de conversão UTC ↔ BR (offset fixo -03:00)
// ═══════════════════════════════════════════════════════════════
function utcMsParaBRHHMM(utcMs: number): string {
    // BR = UTC - 3h  →  criamos Date deslocado e usamos getUTC*
    const brShifted = new Date(utcMs - 3 * 60 * 60 * 1000);
    return `${String(brShifted.getUTCHours()).padStart(2, '0')}:${String(brShifted.getUTCMinutes()).padStart(2, '0')}`;
}

// ═══════════════════════════════════════════════════════════════
// existeConflito
// Retorna o agendamento conflitante (em UTC ms) se abs < 7min.
// ═══════════════════════════════════════════════════════════════
function existeConflito(
    candidatoUtcMs: number,
    agendamentosUtcMs: number[]
): { agendamentoConflitanteUtcMs: number } | null {
    for (const agMs of agendamentosUtcMs) {
        if (Math.abs(candidatoUtcMs - agMs) < INTERVALO_MIN_MS) {
            return { agendamentoConflitanteUtcMs: agMs };
        }
    }
    return null;
}

// ═══════════════════════════════════════════════════════════════
// gerarHorariosDisponiveis
// Gera candidatos de 7 em 7 min dentro do range real,
// empurrando para frente quando houver conflito.
// Trabalha inteiramente em UTC ms para evitar erros de TZ.
// ═══════════════════════════════════════════════════════════════
function gerarHorariosDisponiveis(
    dataPesquisar: string,
    horaInicio: string,
    horaFim: string,
    agendamentos: AgendamentoDigisac[]
): string[] {
    // Limites reais em UTC ms
    const startUtcMs = new Date(`${dataPesquisar}T${horaInicio}:00-03:00`).getTime();
    const endUtcMs = new Date(`${dataPesquisar}T${horaFim}:00-03:00`).getTime();

    // Agendamentos em UTC ms, ordenados
    const agendamentosUtcMs = agendamentos
        .map(ag => new Date(ag.scheduledAt).getTime())
        .sort((a, b) => a - b);

    console.log(`[SLOTS] Agendamentos existentes (${agendamentosUtcMs.length}):`);
    agendamentosUtcMs.forEach(ms => {
        console.log(`   - ${utcMsParaBRHHMM(ms)} (BR)  |  ${new Date(ms).toISOString()} (UTC)`);
    });

    const horariosSugeridos: string[] = [];
    let candidatoUtcMs = startUtcMs;
    let iteracoes = 0;
    const MAX_ITER = 5000; // segurança contra loop infinito

    while (candidatoUtcMs <= endUtcMs && iteracoes < MAX_ITER) {
        iteracoes++;
        const conflito = existeConflito(candidatoUtcMs, agendamentosUtcMs);

        if (!conflito) {
            // Sem conflito → adicionar horário
            const horarioBR = utcMsParaBRHHMM(candidatoUtcMs);
            horariosSugeridos.push(horarioBR);
            candidatoUtcMs += INTERVALO_MIN_MS;
        } else {
            // Com conflito → empurrar para agendamentoConflitante + 7min
            const empurradoUtcMs = conflito.agendamentoConflitanteUtcMs + INTERVALO_MIN_MS;
            const candidatoBR = utcMsParaBRHHMM(candidatoUtcMs);
            const conflitanteBR = utcMsParaBRHHMM(conflito.agendamentoConflitanteUtcMs);
            const empurradoBR = utcMsParaBRHHMM(empurradoUtcMs);
            console.log(`[SLOTS] Conflito: candidato ${candidatoBR} × agendamento ${conflitanteBR} → empurrando para ${empurradoBR}`);
            candidatoUtcMs = empurradoUtcMs;
        }
    }

    console.log(`[SLOTS] Total de horários disponíveis: ${horariosSugeridos.length}`);

    return horariosSugeridos;
}
