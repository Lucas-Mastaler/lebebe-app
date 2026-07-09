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
  confidence: number | null;
  provider: string | null;
  geoCacheId: string | null;
  cepResolvido: string | null;
  numeroResolvido: string | null;
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

export interface ResultadoExecucaoConsulta {
  estado: 'datas_encontradas' | 'sem_datas' | 'erro_coordenadas' | 'erro_dados' | 'erro_consulta';
  motivo?: string;
  datas?: DatasDisponiveisMere[];
  runId?: string;
  totalCandidatos?: number;
  coordenadas?: CoordenadasMere;
  geoCacheStatus: 'hit' | 'miss' | 'erro';
  geoCacheMotivo?: string;
  erros?: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Parser de endereço completo (sem dependência externa)
// ─────────────────────────────────────────────────────────────────────────────

export interface EnderecoDecomposto {
  logradouro: string | null;
  numero: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  cep: string | null;
}

/**
 * Extrai CEP, número, cidade e UF de um endereço completo em formato livre.
 * Exemplos suportados:
 *   "Rua Fulano, 201, Portão, Curitiba, PR - 81320-260"
 *   "Rua Fulano, 201, Portão, Curitiba - PR, 81320-260, Brasil"
 * Não lança erros. Campos não encontrados retornam null.
 */
export function decomporEnderecoCompleto(endereco: string): EnderecoDecomposto {
  if (!endereco || endereco.trim().length === 0) {
    return { logradouro: null, numero: null, bairro: null, cidade: null, uf: null, cep: null };
  }

  const cepMatch = endereco.match(/\b(\d{5})[\-\s]?(\d{3})\b/);
  const cep = cepMatch ? `${cepMatch[1]}${cepMatch[2]}` : null;

  const partes = endereco
    .replace(/\bBrasil\b/gi, '')
    .replace(/\b\d{5}[\-\s]?\d{3}\b/, '')
    .split(/,|\s+-\s+/)
    .map((p) => p.trim())
    .filter(Boolean);

  const logradouro = partes[0] ?? null;

  const numeroMatch = partes[1]?.match(/^\d+[A-Za-z]?$/) ? partes[1] : null;
  const numero = numeroMatch ?? (partes[0]?.match(/,\s*(\d+[A-Za-z]?)/) ? partes[0].match(/,\s*(\d+[A-Za-z]?)/)![1] : null);

  const ufMatch = endereco.match(/\b([A-Z]{2})\b(?:\s*[-,]|\s*\d{5}|$)/g);
  const uf = ufMatch ? ufMatch[ufMatch.length - 1].replace(/[^A-Z]/g, '') : null;

  const bairro = partes[2] && !partes[2].match(/^\d/) ? partes[2] : null;

  let cidade: string | null = null;
  for (let i = partes.length - 1; i >= 1; i--) {
    const p = partes[i].replace(/\s*-\s*[A-Z]{2}$/, '').trim();
    if (p.length > 2 && !p.match(/^\d/) && !/^[A-Z]{2}$/.test(p) && p !== bairro) {
      cidade = p;
      break;
    }
  }

  return { logradouro, numero, bairro, cidade, uf, cep };
}

// ─────────────────────────────────────────────────────────────────────────────
// Geocodificação via cache (sem chamada externa)
// ─────────────────────────────────────────────────────────────────────────────

type GeoCacheRow = {
  chave_endereco: string;
  lat: string | number;
  lng: string | number;
  endereco_completo: string | null;
  cep: string | null;
  numero: string | null;
  cidade: string | null;
  uf: string | null;
  confidence: string | number | null;
  provider: string | null;
};

function normalizarCepSimples(v: string | null | undefined): string {
  return String(v ?? '').replace(/\D/g, '');
}

/**
 * Seleciona melhor candidato do geo_cache.
 * Prioridade: maior confidence → cidade/UF compatível → numero compatível.
 */
function selecionarMelhorCandidato(
  rows: GeoCacheRow[],
  decomposto: EnderecoDecomposto
): GeoCacheRow | null {
  const validos = rows.filter((r) => {
    const lat = Number(r.lat);
    const lng = Number(r.lng);
    return Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0 && lng !== 0;
  });
  if (validos.length === 0) return null;
  if (validos.length === 1) return validos[0];

  const cidadeNorm = (v: string | null) =>
    String(v ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim();

  const cidadeAlvo = cidadeNorm(decomposto.cidade);
  const ufAlvo = String(decomposto.uf ?? '').toUpperCase().trim();
  const numeroAlvo = String(decomposto.numero ?? '').replace(/\D/g, '');

  const scored = validos.map((r) => {
    let score = 0;
    const conf = Number(r.confidence);
    if (Number.isFinite(conf)) score += conf * 10;
    if (cidadeAlvo && cidadeNorm(r.cidade) === cidadeAlvo) score += 5;
    if (ufAlvo && String(r.uf ?? '').toUpperCase().trim() === ufAlvo) score += 3;
    if (numeroAlvo && String(r.numero ?? '').replace(/\D/g, '') === numeroAlvo) score += 4;
    return { row: r, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored[0].row;
}

/**
 * Busca coordenadas do endereço do cliente no geo_cache.
 * Estratégia (em ordem):
 *   1. CEP + número → busca direta, desambigua por cidade/UF/confidence
 *   2. CEP apenas → desambigua por numero/cidade/UF
 *   3. Transfere para humano com motivo claro
 * Não faz geocodificação externa.
 */
export async function geocodificarEnderecoMere(
  enderecoCompleto: string
): Promise<ResultadoGeocod> {
  if (!enderecoCompleto || enderecoCompleto.trim().length < 5) {
    return { ok: false, motivo: 'endereco_completo_ausente' };
  }

  const decomposto = decomporEnderecoCompleto(enderecoCompleto);
  const cepNorm = normalizarCepSimples(decomposto.cep);
  const db = createServiceClient();

  const SELECT_COLS = 'chave_endereco,lat,lng,endereco_completo,cep,numero,cidade,uf,confidence,provider';

  // Estratégia 1: CEP + número
  if (cepNorm && decomposto.numero) {
    const { data, error } = await db
      .from('geo_cache')
      .select(SELECT_COLS)
      .eq('cep', cepNorm)
      .limit(10);

    if (error) return { ok: false, motivo: `geo_cache_erro: ${error.message}` };

    const rows = (data ?? []) as GeoCacheRow[];
    const melhor = selecionarMelhorCandidato(rows, decomposto);
    if (melhor) {
      return {
        ok: true,
        coordenadas: {
          lat: Number(melhor.lat),
          lng: Number(melhor.lng),
          fonte: 'geo_cache',
          confidence: melhor.confidence !== null ? Number(melhor.confidence) : null,
          provider: melhor.provider ?? null,
          geoCacheId: melhor.chave_endereco,
          cepResolvido: cepNorm,
          numeroResolvido: decomposto.numero,
        },
      };
    }
  }

  // Estratégia 2: CEP apenas (sem número)
  if (cepNorm) {
    const { data, error } = await db
      .from('geo_cache')
      .select(SELECT_COLS)
      .eq('cep', cepNorm)
      .limit(10);

    if (error) return { ok: false, motivo: `geo_cache_erro_cep: ${error.message}` };

    const rows = (data ?? []) as GeoCacheRow[];
    const melhor = selecionarMelhorCandidato(rows, decomposto);
    if (melhor) {
      return {
        ok: true,
        coordenadas: {
          lat: Number(melhor.lat),
          lng: Number(melhor.lng),
          fonte: 'geo_cache',
          confidence: melhor.confidence !== null ? Number(melhor.confidence) : null,
          provider: melhor.provider ?? null,
          geoCacheId: melhor.chave_endereco,
          cepResolvido: cepNorm,
          numeroResolvido: decomposto.numero,
        },
      };
    }
  }

  return {
    ok: false,
    motivo: cepNorm ? 'geo_cache_miss_cep' : 'geo_cache_sem_cep',
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

/**
 * Executa o fluxo completo de consulta de datas para a Mère:
 * geocodificar → validar → consultar → retornar resultado estruturado.
 * Projetado para ser chamado diretamente no webhook, sem HTTP.
 * Não altera agenda, Calendar, planilha, nem o motor.
 */
export async function executarConsultaDatasMere(params: {
  grupo: GrupoAgendamento | null | undefined;
  dataDesejadaISO: string | undefined;
  sessaoId: string;
}): Promise<ResultadoExecucaoConsulta> {
  const { grupo, dataDesejadaISO, sessaoId } = params;

  if (!grupo || !dataDesejadaISO) {
    return {
      estado: 'erro_dados',
      motivo: 'grupo_ou_data_ausente',
      geoCacheStatus: 'miss',
      geoCacheMotivo: 'dados_insuficientes',
    };
  }

  // 1. Geocodificar
  const enderecoCompleto = grupo.endereco_completo ?? '';
  const geocod = await geocodificarEnderecoMere(enderecoCompleto);

  if (!geocod.ok) {
    console.log(`[posvenda-webhook] geo_cache miss sessaoId=${sessaoId} motivo=${geocod.motivo}`);
    return {
      estado: 'erro_coordenadas',
      motivo: geocod.motivo,
      geoCacheStatus: geocod.motivo.startsWith('geo_cache_erro') ? 'erro' : 'miss',
      geoCacheMotivo: geocod.motivo,
    };
  }

  const { coordenadas } = geocod;
  console.log(
    `[posvenda-webhook] geo_cache hit sessaoId=${sessaoId} cep=${coordenadas.cepResolvido ?? '-'} confidence=${coordenadas.confidence ?? '-'}`
  );

  // 2. Validar campos obrigatórios
  const validacao = validarCamposConsultaMere({ dataDesejadaISO, grupo, coordenadas });
  if (!validacao.ok) {
    return {
      estado: 'erro_dados',
      motivo: validacao.motivo,
      coordenadas,
      geoCacheStatus: 'hit',
      erros: validacao.camposFaltando,
    };
  }

  // 3. Executar consulta
  console.log(`[posvenda-webhook] iniciando consulta datas sessaoId=${sessaoId} data=${dataDesejadaISO}`);
  const resultado = await consultarDatasMere(grupo, dataDesejadaISO, coordenadas);

  if (!resultado.ok) {
    console.log(`[posvenda-webhook] consulta datas erro sessaoId=${sessaoId} motivo=${resultado.motivo}`);
    return {
      estado: 'erro_consulta',
      motivo: resultado.motivo,
      coordenadas,
      geoCacheStatus: 'hit',
      erros: resultado.erros ?? [],
    };
  }

  console.log(`[posvenda-webhook] consulta datas sucesso sessaoId=${sessaoId} total=${resultado.datas.length}`);

  if (resultado.datas.length === 0) {
    return {
      estado: 'sem_datas',
      runId: resultado.runId,
      totalCandidatos: resultado.totalCandidatos,
      coordenadas,
      geoCacheStatus: 'hit',
    };
  }

  return {
    estado: 'datas_encontradas',
    datas: resultado.datas,
    runId: resultado.runId,
    totalCandidatos: resultado.totalCandidatos,
    coordenadas,
    geoCacheStatus: 'hit',
  };
}
