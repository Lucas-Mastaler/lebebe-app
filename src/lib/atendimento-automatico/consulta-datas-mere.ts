import { createServiceClient } from '@/lib/supabase/service';
import type { GrupoAgendamento } from '@/lib/google/sheets-service-account';
import { pesquisarDatasV2, type CandidatoFinalPesquisarDatasV2, type PesquisarDatasV2Output } from '@/lib/procurar-datas/motor/pesquisar-datas-v2';
import type { PesquisarDatasRequest } from '@/lib/procurar-datas/contratos';

// ─────────────────────────────────────────────────────────────────────────────
// Tipos públicos
// ─────────────────────────────────────────────────────────────────────────────

export interface CoordenadasMere {
  lat: number;
  lng: number;
  fonte: 'geo_cache';
}

export type ResultadoGeocod =
  | { ok: true; coordenadas: CoordenadasMere }
  | { ok: false; motivo: string };

export interface DatasDisponiveisMere {
  dataISO: string;
  dataBR: string;
  equipe: string;
  tipo: string;
  rank: number;
}

export type ResultadoConsultaDatasMere =
  | { ok: true; datas: DatasDisponiveisMere[]; runId: string; totalCandidatos: number }
  | { ok: false; motivo: string; erros?: string[] };

// ─────────────────────────────────────────────────────────────────────────────
// Geocodificação via cache (sem chamada externa)
// ─────────────────────────────────────────────────────────────────────────────

type GeoCacheRow = {
  lat: string | number;
  lng: string | number;
  endereco_completo: string | null;
};

/**
 * Busca coordenadas do endereço do cliente no geo_cache via enderecoCompleto.
 * Só retorna hit se houver exatamente 1 linha com lat/lng válidos.
 * Não faz geocodificação externa.
 */
export async function geocodificarEnderecoMere(
  enderecoCompleto: string
): Promise<ResultadoGeocod> {
  if (!enderecoCompleto || enderecoCompleto.trim().length < 5) {
    return { ok: false, motivo: 'endereco_completo_ausente' };
  }

  const db = createServiceClient();
  const normalizado = enderecoCompleto
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ');

  const { data, error } = await db
    .from('geo_cache')
    .select('lat,lng,endereco_completo')
    .ilike('endereco_completo', `%${normalizado.substring(0, 60)}%`)
    .limit(5);

  if (error) return { ok: false, motivo: `geo_cache_erro: ${error.message}` };
  if (!data || data.length === 0) return { ok: false, motivo: 'geo_cache_miss' };

  const rows = data as GeoCacheRow[];
  const validos = rows.filter((r) => {
    const lat = Number(r.lat);
    const lng = Number(r.lng);
    return Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0 && lng !== 0;
  });

  if (validos.length !== 1) {
    return { ok: false, motivo: validos.length === 0 ? 'geo_cache_sem_coords' : 'geo_cache_ambiguo' };
  }

  return {
    ok: true,
    coordenadas: {
      lat: Number(validos[0].lat),
      lng: Number(validos[0].lng),
      fonte: 'geo_cache',
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Validação de campos mínimos
// ─────────────────────────────────────────────────────────────────────────────

export type ValidacaoCamposMere =
  | { ok: true }
  | { ok: false; motivo: string; camposFaltando: string[] };

const TEMPO_NECESSARIO_RE = /^(\d{1,2}):([0-5]\d)$/;

/**
 * Verifica se todos os campos obrigatórios para chamar pesquisarDatasV2 estão presentes.
 */
export function validarCamposConsultaMere(params: {
  dataDesejadaISO: string | undefined;
  grupo: GrupoAgendamento | null | undefined;
  coordenadas: CoordenadasMere | null | undefined;
}): ValidacaoCamposMere {
  const faltando: string[] = [];

  if (!params.dataDesejadaISO || !/^\d{4}-\d{2}-\d{2}$/.test(params.dataDesejadaISO)) {
    faltando.push('data_desejada_iso');
  }
  if (!params.grupo) {
    faltando.push('grupo_selecionado');
  } else {
    if (!params.grupo.endereco_completo || params.grupo.endereco_completo.trim().length < 5) {
      faltando.push('endereco_completo');
    }
    const tempo = params.grupo.tempo_servico?.trim() ?? '';
    if (!tempo || !TEMPO_NECESSARIO_RE.test(tempo)) {
      faltando.push('tempo_servico');
    }
  }
  if (!params.coordenadas) {
    faltando.push('coordenadas_destino');
  }

  if (faltando.length > 0) {
    return { ok: false, motivo: 'dados_insuficientes_consulta_datas', camposFaltando: faltando };
  }
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// Montagem do payload
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Monta o PesquisarDatasRequest a partir dos dados da sessão Mère.
 * Não inventa dados ausentes.
 */
export function montarPayloadConsultaDatasMere(
  grupo: GrupoAgendamento,
  dataDesejadaISO: string,
  coordenadas: CoordenadasMere
): PesquisarDatasRequest {
  return {
    dataInicial: dataDesejadaISO,
    tempoNecessario: grupo.tempo_servico.trim(),
    enderecoCompleto: grupo.endereco_completo,
    destLat: coordenadas.lat,
    destLng: coordenadas.lng,
    isRural: false,
    isCondominio: false,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Formatação de candidatos para o cliente
// ─────────────────────────────────────────────────────────────────────────────

const DIAS_SEMANA_PT: Record<number, string> = {
  0: 'domingo',
  1: 'segunda-feira',
  2: 'terça-feira',
  3: 'quarta-feira',
  4: 'quinta-feira',
  5: 'sexta-feira',
  6: 'sábado',
};

function isoParaBR(iso: string): string {
  const [ano, mes, dia] = iso.split('-');
  return `${dia}/${mes}/${ano}`;
}

function isoParaDiaSemana(iso: string): string {
  const [ano, mes, dia] = iso.split('-').map(Number);
  const d = new Date(ano, mes - 1, dia);
  return DIAS_SEMANA_PT[d.getDay()] ?? '';
}

/**
 * Converte candidatos do motor v2 em DatasDisponiveisMere.
 * Filtra apenas elegíveis, máximo 3.
 */
export function extrairDatasDisponiveisElegiveis(
  candidatos: CandidatoFinalPesquisarDatasV2[]
): DatasDisponiveisMere[] {
  return candidatos
    .filter((c) => c.elegivel)
    .slice(0, 3)
    .map((c, idx) => ({
      dataISO: c.dataISO,
      dataBR: isoParaBR(c.dataISO),
      equipe: c.equipe,
      tipo: c.tipo,
      rank: idx + 1,
    }));
}

/**
 * Formata mensagem para o cliente com até 3 opções de data.
 */
export function formatarOpcoesDatasParaCliente(datas: DatasDisponiveisMere[]): string {
  const linhas = datas.map((d) => {
    const diaSemana = isoParaDiaSemana(d.dataISO);
    const label = diaSemana ? `${d.dataBR} (${diaSemana})` : d.dataBR;
    return `${d.rank} - ${label}`;
  });
  return `Encontrei algumas possibilidades para sua entrega:\n\n${linhas.join('\n')}\n\nQual dessas opções fica melhor para você? Responda com o número desejado (${datas.map((d) => d.rank).join(', ')}).`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Execução da consulta completa
// ─────────────────────────────────────────────────────────────────────────────

let _runCounter = 0;

function gerarRunId(): string {
  _runCounter = (_runCounter + 1) % 99999;
  return `mere-${Date.now()}-${_runCounter}`;
}

/**
 * Executa pesquisarDatasV2 e retorna datas disponíveis formatadas.
 * Não altera agenda, não faz pre-agendamento, não escreve na planilha.
 */
export async function consultarDatasMere(
  grupo: GrupoAgendamento,
  dataDesejadaISO: string,
  coordenadas: CoordenadasMere
): Promise<ResultadoConsultaDatasMere> {
  const runId = gerarRunId();
  const payload = montarPayloadConsultaDatasMere(grupo, dataDesejadaISO, coordenadas);

  let resultado: PesquisarDatasV2Output;
  try {
    resultado = await pesquisarDatasV2(payload);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, motivo: `excecao_pesquisar_v2: ${msg}` };
  }

  if (!resultado.ok) {
    return {
      ok: false,
      motivo: 'motor_v2_retornou_erro',
      erros: resultado.erros ?? [],
    };
  }

  const candidatos = resultado.resultadoFinal.candidatosFinais;
  const datas = extrairDatasDisponiveisElegiveis(candidatos);

  return {
    ok: true,
    datas,
    runId,
    totalCandidatos: resultado.resultadoFinal.resumo.totalElegiveis,
  };
}
