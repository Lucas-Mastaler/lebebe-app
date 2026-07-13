import { createServiceClient } from '@/lib/supabase/service';
import type { GrupoAgendamento } from '@/lib/google/sheets-service-account';
import { pesquisarDatasV2, type CandidatoFinalPesquisarDatasV2, type PesquisarDatasV2Output } from '@/lib/procurar-datas/motor/pesquisar-datas-v2';
import type { EnderecoValidado, PesquisarDatasRequest, ValidarEnderecoRequest } from '@/lib/procurar-datas/contratos';
import { formatarMinutos, parseMinutos } from '@/lib/procurar-datas/motor/tempo';
import { buscarEnderecoNoGeoCache, normalizarCep, salvarEnderecoNoGeoCache } from '@/lib/procurar-datas/endereco-cache';
import { buscarEnderecoLocationIq } from '@/lib/procurar-datas/locationiq';
import { consultarGoogleGeocodingEnderecoDificil } from '@/lib/procurar-datas/google-geocoding';
import { validarPayloadEndereco } from '@/lib/procurar-datas/validar-endereco-payload';
import { validarEnderecoProviderDireto } from '@/lib/procurar-datas/validar-endereco-resultado';
import { chamarAppsScriptProcurarDatas } from '@/lib/procurar-datas/apps-script';

// ─────────────────────────────────────────────────────────────────────────────
// Tipos públicos
// ─────────────────────────────────────────────────────────────────────────────

export interface CoordenadasMere {
  lat: number;
  lng: number;
  fonte: 'geo_cache' | 'provider';
  origem: 'geo_cache' | 'locationiq' | 'google_geocoding' | 'appsscript' | 'geo_cache_cep_numero' | 'geo_cache_endereco_completo' | 'geo_cache_logradouro_numero' | 'geo_cache_cep_unico';
  estrategia: 'geo_cache_match_seguro' | 'provider_locationiq' | 'provider_google_geocoding' | 'provider_appsscript' | 'cep_numero' | 'endereco_completo' | 'logradouro_numero' | 'cep';
  confidence: number | null;
  provider: string | null;
  geoCacheId: string | null;
  cepResolvido: string | null;
  numeroResolvido: string | null;
  geoCacheHit: boolean;
  geocodingProviderConsultado: boolean;
  geocodingProvider: string | null;
  geoCacheSalvo: boolean;
  geoCacheSaveErro?: string;
}

export type ResultadoGeocod =
  | { ok: true; coordenadas: CoordenadasMere }
  | {
      ok: false;
      motivo: string;
      geoCacheHit?: boolean;
      geocodingProviderConsultado?: boolean;
      geocodingProvider?: string | null;
      geoCacheSalvo?: boolean;
      candidatos?: number;
    };

export interface DatasDisponiveisMere {
  dataISO: string;
  dataBR: string;
  equipe: string;
  tipo: string;
  rank: number;
}

export type AcaoAlteracaoEntregaMere = 'adiantar' | 'postergar';

export interface ResultadoFiltroDatasMere {
  datasExibidas: DatasDisponiveisMere[];
  datasPosteriores: DatasDisponiveisMere[];
  totalMotor: number;
  removidasMesmaData: number;
  removidasContrariasAcao: number;
  semOpcoesParaAcao: boolean;
}

export type ResultadoConsultaDatasMere =
  | { ok: true; datas: DatasDisponiveisMere[]; runId: string; totalCandidatos: number; diagnostico: DiagnosticoConsultaDatasMere }
  | { ok: false; motivo: string; erros?: string[]; diagnostico: DiagnosticoConsultaDatasMere };

export interface DiagnosticoConsultaDatasMere {
  erroCodigo?: string;
  erroMensagem?: string;
  erroStackResumido?: string;
  payloadResumo: Record<string, unknown>;
  payloadCamposPresentes: string[];
  payloadCamposAusentes: string[];
  retornoBrutoResumo?: Record<string, unknown>;
  helperUsado: 'consultarDatasMere';
  rotaOuMotorUsado: 'pesquisarDatasV2';
}

export interface ResultadoExecucaoConsulta {
  estado: 'datas_encontradas' | 'sem_datas' | 'erro_coordenadas' | 'erro_dados' | 'erro_consulta';
  motivo?: string;
  datas?: DatasDisponiveisMere[];
  runId?: string;
  totalCandidatos?: number;
  coordenadas?: CoordenadasMere;
  geoCacheStatus: 'hit' | 'miss' | 'erro';
  geoCacheMotivo?: string;
  geoCacheHit?: boolean;
  geocodingProviderConsultado?: boolean;
  geocodingProvider?: string | null;
  geoCacheSalvo?: boolean;
  erros?: string[];
  diagnostico?: DiagnosticoConsultaDatasMere;
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
  logradouro: string | null;
  cep: string | null;
  numero: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  confidence: string | number | null;
  provider: string | null;
  updated_at: string | null;
};

function normalizarCepSimples(v: string | null | undefined): string {
  return String(v ?? '').replace(/\D/g, '');
}

function normalizarNumeroSimples(v: string | null | undefined): string {
  return String(v ?? '').replace(/\D/g, '');
}

function normalizarTextoGeoCache(v: string | null | undefined): string {
  return String(v ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizarLogradouroGeoCache(v: string | null | undefined): string {
  return normalizarTextoGeoCache(v).replace(/^(AV|AVENIDA|R|RUA|AL|ALAMEDA|TRAV|TRAVESSA|ROD|RODOVIA|EST|ESTRADA)\s+/, '');
}

function termoLogradouroBuscaMere(v: string | null | undefined): string {
  return String(v ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/^(av\.?|avenida|r\.?|rua|al\.?|alameda|trav\.?|travessa|rod\.?|rodovia|est\.?|estrada)\s+/i, '')
    .trim();
}

function coordenadasValidasMere(row: GeoCacheRow): boolean {
  const lat = Number(row.lat);
  const lng = Number(row.lng);
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180 &&
    !(lat === 0 && lng === 0)
  );
}

function ordenarCandidatosGeoCache(rows: GeoCacheRow[]): GeoCacheRow[] {
  return rows
    .filter(coordenadasValidasMere)
    .sort((a, b) => {
      const confA = Number(a.confidence);
      const confB = Number(b.confidence);
      const safeConfA = Number.isFinite(confA) ? confA : -1;
      const safeConfB = Number.isFinite(confB) ? confB : -1;
      if (safeConfA !== safeConfB) return safeConfB - safeConfA;
      const timeA = a.updated_at ? Date.parse(a.updated_at) : 0;
      const timeB = b.updated_at ? Date.parse(b.updated_at) : 0;
      if (timeA !== timeB) return timeB - timeA;
      return a.chave_endereco.localeCompare(b.chave_endereco);
    });
}

function camposCidadeUfCompativeis(row: GeoCacheRow, decomposto: EnderecoDecomposto): boolean {
  const cidadeAlvo = normalizarTextoGeoCache(decomposto.cidade);
  const ufAlvo = normalizarTextoGeoCache(decomposto.uf);
  const cidadeRow = normalizarTextoGeoCache(row.cidade);
  const ufRow = normalizarTextoGeoCache(row.uf);
  if (cidadeAlvo && cidadeRow && cidadeAlvo !== cidadeRow) return false;
  if (ufAlvo && ufRow && ufAlvo !== ufRow) return false;
  return true;
}

function rowBateNumero(row: GeoCacheRow, decomposto: EnderecoDecomposto): boolean {
  const numeroAlvo = normalizarNumeroSimples(decomposto.numero);
  const numeroRow = normalizarNumeroSimples(row.numero);
  return Boolean(numeroAlvo && numeroRow && numeroAlvo === numeroRow);
}

function rowBateLogradouro(row: GeoCacheRow, decomposto: EnderecoDecomposto): boolean {
  const logradouroAlvo = normalizarLogradouroGeoCache(decomposto.logradouro);
  const logradouroRow = normalizarLogradouroGeoCache(row.logradouro);
  return Boolean(logradouroAlvo && logradouroRow && logradouroAlvo === logradouroRow);
}

function rowBateEnderecoCompleto(row: GeoCacheRow, enderecoCompleto: string): boolean {
  const alvo = normalizarTextoGeoCache(enderecoCompleto);
  const rowEndereco = normalizarTextoGeoCache(row.endereco_completo);
  return Boolean(alvo && rowEndereco && alvo === rowEndereco);
}

function montarCoordenadasMere(
  row: GeoCacheRow,
  decomposto: EnderecoDecomposto,
  origem: CoordenadasMere['origem'],
  estrategia: CoordenadasMere['estrategia']
): CoordenadasMere {
  return {
    lat: Number(row.lat),
    lng: Number(row.lng),
    fonte: 'geo_cache',
    origem,
    estrategia,
    confidence: row.confidence !== null ? Number(row.confidence) : null,
    provider: row.provider ?? null,
    geoCacheId: row.chave_endereco,
    cepResolvido: normalizarCepSimples(row.cep) || normalizarCepSimples(decomposto.cep) || null,
    numeroResolvido: row.numero ?? decomposto.numero,
    geoCacheHit: true,
    geocodingProviderConsultado: false,
    geocodingProvider: null,
    geoCacheSalvo: false,
  };
}

type ResultadoEstrategiaGeoCache =
  | { ok: true; coordenadas: CoordenadasMere }
  | { ok: false; motivo: string; candidatos?: number };

function escolherUnicoSeguro(rows: GeoCacheRow[], motivoAmbiguo: string): GeoCacheRow | ResultadoEstrategiaGeoCache | null {
  const validos = ordenarCandidatosGeoCache(rows);
  if (rows.length > 0 && validos.length === 0) return { ok: false, motivo: 'geo_cache_lat_lng_invalidos', candidatos: rows.length };
  if (validos.length === 0) return null;
  if (validos.length > 1) return { ok: false, motivo: motivoAmbiguo, candidatos: validos.length };
  return validos[0];
}

/**
 * Busca coordenadas do endereço do cliente no geo_cache.
 * Estratégia (em ordem):
 *   1. CEP + número, com cidade/UF quando disponíveis
 *   2. Endereço completo normalizado
 *   3. Logradouro + número + cidade + UF
 *   4. CEP apenas, somente com candidato único seguro
 * Não faz geocodificação externa.
 */
// Mantido temporariamente como referencia do caminho antigo de cache-only.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function geocodificarEnderecoMereGeoCacheLegado(
  enderecoCompleto: string
): Promise<ResultadoGeocod> {
  if (!enderecoCompleto || enderecoCompleto.trim().length < 5) {
    return { ok: false, motivo: 'endereco_completo_ausente' };
  }

  const decomposto = decomporEnderecoCompleto(enderecoCompleto);
  const cepNorm = normalizarCepSimples(decomposto.cep);
  const db = createServiceClient();

  const SELECT_COLS = 'chave_endereco,lat,lng,endereco_completo,logradouro,cep,numero,bairro,cidade,uf,confidence,provider,updated_at';

  // Estratégia 1: CEP + número
  if (cepNorm && decomposto.numero) {
    const { data, error } = await db
      .from('geo_cache')
      .select(SELECT_COLS)
      .eq('cep', cepNorm)
      .eq('numero', decomposto.numero)
      .order('updated_at', { ascending: false })
      .limit(10);

    if (error) return { ok: false, motivo: `geo_cache_erro_cep_numero: ${error.message}` };

    const rows = ((data ?? []) as GeoCacheRow[]).filter((row) => camposCidadeUfCompativeis(row, decomposto));
    const escolhido = escolherUnicoSeguro(rows, 'geo_cache_ambiguo');
    if (escolhido && 'ok' in escolhido) return escolhido;
    if (escolhido) {
      return { ok: true, coordenadas: montarCoordenadasMere(escolhido, decomposto, 'geo_cache_cep_numero', 'cep_numero') };
    }
  }

  // Estrategia 2: endereco completo normalizado.
  const enderecoBusca = enderecoCompleto.trim();
  const trechoSeguro = enderecoBusca.split(',').map((p) => p.trim()).filter(Boolean).slice(0, 3).join('%');
  if (trechoSeguro) {
    const { data, error } = await db
      .from('geo_cache')
      .select(SELECT_COLS)
      .ilike('endereco_completo', `%${trechoSeguro}%`)
      .order('updated_at', { ascending: false })
      .limit(20);

    if (error) return { ok: false, motivo: `geo_cache_erro_endereco_completo: ${error.message}` };

    const rows = ((data ?? []) as GeoCacheRow[]).filter((row) => rowBateEnderecoCompleto(row, enderecoCompleto));
    const escolhido = escolherUnicoSeguro(rows, 'geo_cache_ambiguo');
    if (escolhido && 'ok' in escolhido) return escolhido;
    if (escolhido) {
      return { ok: true, coordenadas: montarCoordenadasMere(escolhido, decomposto, 'geo_cache_endereco_completo', 'endereco_completo') };
    }
  }

  // Estrategia 3: logradouro + numero + cidade + UF.
  const logradouroBusca = termoLogradouroBuscaMere(decomposto.logradouro);
  if (logradouroBusca && decomposto.numero && decomposto.cidade && decomposto.uf) {
    const { data, error } = await db
      .from('geo_cache')
      .select(SELECT_COLS)
      .ilike('logradouro', `%${logradouroBusca}%`)
      .eq('numero', decomposto.numero)
      .ilike('cidade', decomposto.cidade)
      .eq('uf', decomposto.uf.toUpperCase())
      .order('updated_at', { ascending: false })
      .limit(20);

    if (error) return { ok: false, motivo: `geo_cache_erro_logradouro_numero: ${error.message}` };

    const rows = ((data ?? []) as GeoCacheRow[]).filter((row) => (
      rowBateLogradouro(row, decomposto) &&
      rowBateNumero(row, decomposto) &&
      camposCidadeUfCompativeis(row, decomposto)
    ));
    const escolhido = escolherUnicoSeguro(rows, 'geo_cache_ambiguo');
    if (escolhido && 'ok' in escolhido) return escolhido;
    if (escolhido) {
      return { ok: true, coordenadas: montarCoordenadasMere(escolhido, decomposto, 'geo_cache_logradouro_numero', 'logradouro_numero') };
    }
  }

  // Estrategia 4: CEP apenas, somente quando houver candidato unico seguro.
  if (cepNorm) {
    const { data, error } = await db
      .from('geo_cache')
      .select(SELECT_COLS)
      .eq('cep', cepNorm)
      .order('updated_at', { ascending: false })
      .limit(10);

    if (error) return { ok: false, motivo: `geo_cache_erro_cep: ${error.message}` };

    const rows = ((data ?? []) as GeoCacheRow[]).filter((row) => camposCidadeUfCompativeis(row, decomposto));
    const escolhido = escolherUnicoSeguro(rows, 'geo_cache_ambiguo');
    if (escolhido && 'ok' in escolhido) return escolhido;
    if (escolhido) {
      return { ok: true, coordenadas: montarCoordenadasMere(escolhido, decomposto, 'geo_cache_cep_unico', 'cep') };
    }
  }

  return {
    ok: false,
    motivo: cepNorm ? 'geo_cache_nao_resolvido' : 'geo_cache_sem_cep',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Validação de campos mínimos
// ─────────────────────────────────────────────────────────────────────────────

type GeocodificarEnderecoMereOptions = {
  sessaoId?: string;
};

function coordenadasValidasEndereco(resultado: EnderecoValidado): boolean {
  const lat = Number(resultado.lat);
  const lng = Number(resultado.lng);
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180 &&
    !(lat === 0 && lng === 0)
  );
}

function motivoControladoProvider(motivo: string): string {
  if (motivo === 'coordenadas_invalidas' || motivo === 'coordenada_invalida') return 'geo_cache_lat_lng_invalidos';
  if (motivo.includes('ambiguo')) return 'geocoding_resultado_ambiguo';
  if (motivo.includes('mismatch') || motivo.includes('incompativel') || motivo.includes('ausente')) return 'geocoding_resultado_ambiguo';
  return 'geocoding_provider_falhou';
}

export function montarPayloadEnderecoMere(enderecoCompleto: string): ValidarEnderecoRequest | null {
  if (!enderecoCompleto || enderecoCompleto.trim().length < 5) return null;

  const decomposto = decomporEnderecoCompleto(enderecoCompleto);
  return {
    logradouro: decomposto.logradouro ?? undefined,
    numero: decomposto.numero ?? undefined,
    bairro: decomposto.bairro ?? undefined,
    cidade: decomposto.cidade ?? undefined,
    uf: decomposto.uf ?? undefined,
    cep: decomposto.cep ? normalizarCep(decomposto.cep) : undefined,
    enderecoCompleto,
  };
}

function montarCoordenadasMereDeResultado(params: {
  resultado: EnderecoValidado;
  form: ValidarEnderecoRequest;
  fonte: CoordenadasMere['fonte'];
  origem: CoordenadasMere['origem'];
  estrategia: CoordenadasMere['estrategia'];
  geoCacheHit: boolean;
  geocodingProviderConsultado: boolean;
  geocodingProvider: string | null;
  geoCacheSalvo: boolean;
  geoCacheId: string | null;
  geoCacheSaveErro?: string;
}): CoordenadasMere {
  const provider = String(params.resultado.provider ?? params.geocodingProvider ?? params.origem);
  return {
    lat: Number(params.resultado.lat),
    lng: Number(params.resultado.lng),
    fonte: params.fonte,
    origem: params.origem,
    estrategia: params.estrategia,
    confidence: typeof params.resultado.confidence === 'number' ? params.resultado.confidence : null,
    provider,
    geoCacheId: params.geoCacheId,
    cepResolvido: normalizarCep(String(params.resultado.cep ?? params.form.cep ?? '')) || null,
    numeroResolvido: String(params.form.numero ?? '').trim() || null,
    geoCacheHit: params.geoCacheHit,
    geocodingProviderConsultado: params.geocodingProviderConsultado,
    geocodingProvider: params.geocodingProvider,
    geoCacheSalvo: params.geoCacheSalvo,
    geoCacheSaveErro: params.geoCacheSaveErro,
  };
}

async function salvarCacheMere(
  form: ValidarEnderecoRequest,
  resultado: EnderecoValidado,
  provider: string,
  sessaoId?: string
): Promise<{ ok: true; chaveEndereco: string } | { ok: false; erro: string }> {
  const cacheSave = await salvarEnderecoNoGeoCache(form, { ...resultado, provider });
  if (cacheSave.ok) {
    console.log(`[posvenda-webhook] geo_cache salvo sessaoId=${sessaoId ?? '-'} provider=${provider} confidence=${resultado.confidence ?? '-'} chave=${cacheSave.chaveEndereco}`);
  } else {
    console.warn(`[posvenda-webhook] geo_cache save falhou sessaoId=${sessaoId ?? '-'} provider=${provider} motivo=${cacheSave.erro}`);
  }
  return cacheSave;
}

export async function geocodificarEnderecoMere(
  enderecoCompleto: string,
  options: GeocodificarEnderecoMereOptions = {}
): Promise<ResultadoGeocod> {
  const form = montarPayloadEnderecoMere(enderecoCompleto);
  if (!form) {
    return { ok: false, motivo: 'endereco_incompleto_para_geocoding', geoCacheHit: false, geocodingProviderConsultado: false, geocodingProvider: null, geoCacheSalvo: false };
  }

  const cepLog = normalizarCep(form.cep) || '-';
  const cidadeLog = String(form.cidade ?? '-');
  const ufLog = String(form.uf ?? '-').toUpperCase();
  console.log(`[posvenda-webhook] resolvendo coordenadas mere sessaoId=${options.sessaoId ?? '-'} cep=${cepLog} cidade=${cidadeLog} uf=${ufLog}`);

  const validacaoPayload = validarPayloadEndereco(form);
  if (validacaoPayload) {
    return { ok: false, motivo: 'endereco_incompleto_para_geocoding', geoCacheHit: false, geocodingProviderConsultado: false, geocodingProvider: null, geoCacheSalvo: false };
  }

  try {
    const cache = await buscarEnderecoNoGeoCache(form);
    if (cache.status === 'hit') {
      const enderecoCache = String(cache.resultado.enderecoCompleto ?? cache.resultado.display ?? cache.resultado.display_name ?? '').slice(0, 140);
      console.log(
        `[posvenda-webhook] geo_cache candidato usado sessaoId=${options.sessaoId ?? '-'} cep=${normalizarCep(form.cep) || '-'} numero=${form.numero ?? '-'} cidade=${form.cidade ?? '-'} uf=${String(form.uf ?? '-').toUpperCase()} lat=${Number(cache.resultado.lat).toFixed(6)} lng=${Number(cache.resultado.lng).toFixed(6)} confidence=${cache.resultado.confidence ?? '-'} provider=${cache.resultado.providerOriginal ?? cache.resultado.provider ?? '-'} enderecoCache="${enderecoCache}"`
      );
      return {
        ok: true,
        coordenadas: montarCoordenadasMereDeResultado({
          resultado: cache.resultado,
          form,
          fonte: 'geo_cache',
          origem: 'geo_cache',
          estrategia: 'geo_cache_match_seguro',
          geoCacheHit: true,
          geocodingProviderConsultado: false,
          geocodingProvider: null,
          geoCacheSalvo: false,
          geoCacheId: String(cache.resultado.chaveEndereco ?? '') || null,
        }),
      };
    }

    if (cache.motivo === 'coordenadas_invalidas') {
      return { ok: false, motivo: 'geo_cache_lat_lng_invalidos', geoCacheHit: false, geocodingProviderConsultado: false, geocodingProvider: null, geoCacheSalvo: false };
    }
    if (cache.motivo === 'cache_ambiguo') {
      return { ok: false, motivo: 'geocoding_resultado_ambiguo', geoCacheHit: false, geocodingProviderConsultado: false, geocodingProvider: null, geoCacheSalvo: false };
    }
    if (cache.motivo === 'confidence_baixa') {
      console.warn(`[posvenda-webhook] geo_cache rejeitado sessaoId=${options.sessaoId ?? '-'} motivo=confidence_baixa confidence=${cache.confidence ?? '-'} estrategia=geo_cache_match_seguro`);
      console.log(`[posvenda-webhook] geo_cache insuficiente, tentando provider sessaoId=${options.sessaoId ?? '-'} motivo=confidence_baixa`);
    }

    console.log(`[posvenda-webhook] geo_cache miss, tentando provider existente sessaoId=${options.sessaoId ?? '-'} motivo=${cache.motivo}`);
  } catch (error) {
    const motivo = error instanceof Error ? error.message : String(error);
    console.warn(`[posvenda-webhook] geo_cache erro, tentando provider existente sessaoId=${options.sessaoId ?? '-'} motivo=${motivo}`);
  }

  const locationIq = await buscarEnderecoLocationIq(form);
  if (locationIq.status === 'success') {
    if (!coordenadasValidasEndereco(locationIq.resultado)) {
      return { ok: false, motivo: 'geo_cache_lat_lng_invalidos', geoCacheHit: false, geocodingProviderConsultado: true, geocodingProvider: 'locationiq', geoCacheSalvo: false };
    }
    console.log(`[posvenda-webhook] geocoding provider sucesso sessaoId=${options.sessaoId ?? '-'} provider=locationiq lat=${Number(locationIq.resultado.lat).toFixed(5)} lng=${Number(locationIq.resultado.lng).toFixed(5)}`);
    const cacheSave = await salvarCacheMere(form, locationIq.resultado, 'locationiq', options.sessaoId);
    return {
      ok: true,
      coordenadas: montarCoordenadasMereDeResultado({
        resultado: locationIq.resultado,
        form,
        fonte: 'provider',
        origem: 'locationiq',
        estrategia: 'provider_locationiq',
        geoCacheHit: false,
        geocodingProviderConsultado: true,
        geocodingProvider: 'locationiq',
        geoCacheSalvo: cacheSave.ok,
        geoCacheId: cacheSave.ok ? cacheSave.chaveEndereco : null,
        geoCacheSaveErro: cacheSave.ok ? undefined : cacheSave.erro,
      }),
    };
  }

  const google = await consultarGoogleGeocodingEnderecoDificil(form, { permitirEnderecoComum: true });
  if (google.status === 'success') {
    if (!coordenadasValidasEndereco(google.resultado)) {
      return { ok: false, motivo: 'geo_cache_lat_lng_invalidos', geoCacheHit: false, geocodingProviderConsultado: true, geocodingProvider: 'google_geocoding', geoCacheSalvo: false };
    }
    console.log(`[posvenda-webhook] geocoding provider sucesso sessaoId=${options.sessaoId ?? '-'} provider=google_geocoding lat=${Number(google.resultado.lat).toFixed(5)} lng=${Number(google.resultado.lng).toFixed(5)}`);
    const cacheSave = await salvarCacheMere(form, google.resultado, 'google_geocoding', options.sessaoId);
    return {
      ok: true,
      coordenadas: montarCoordenadasMereDeResultado({
        resultado: google.resultado,
        form,
        fonte: 'provider',
        origem: 'google_geocoding',
        estrategia: 'provider_google_geocoding',
        geoCacheHit: false,
        geocodingProviderConsultado: true,
        geocodingProvider: 'google_geocoding',
        geoCacheSalvo: cacheSave.ok,
        geoCacheId: cacheSave.ok ? cacheSave.chaveEndereco : null,
        geoCacheSaveErro: cacheSave.ok ? undefined : cacheSave.erro,
      }),
    };
  }

  try {
    const resultado = await chamarAppsScriptProcurarDatas<EnderecoValidado>('LookupCompletoPorEndereco', [form], {
      rota: 'validar-endereco-mere',
    });
    const validacaoAppsScript = validarEnderecoProviderDireto(resultado, form);
    if (!validacaoAppsScript.ok) {
      return { ok: false, motivo: motivoControladoProvider(validacaoAppsScript.motivo), geoCacheHit: false, geocodingProviderConsultado: true, geocodingProvider: 'appsscript', geoCacheSalvo: false };
    }
    if (!coordenadasValidasEndereco(resultado)) {
      return { ok: false, motivo: 'geo_cache_lat_lng_invalidos', geoCacheHit: false, geocodingProviderConsultado: true, geocodingProvider: 'appsscript', geoCacheSalvo: false };
    }
    console.log(`[posvenda-webhook] geocoding provider sucesso sessaoId=${options.sessaoId ?? '-'} provider=appsscript lat=${Number(resultado.lat).toFixed(5)} lng=${Number(resultado.lng).toFixed(5)}`);
    const cacheSave = await salvarCacheMere(form, resultado, 'appsscript', options.sessaoId);
    return {
      ok: true,
      coordenadas: montarCoordenadasMereDeResultado({
        resultado,
        form,
        fonte: 'provider',
        origem: 'appsscript',
        estrategia: 'provider_appsscript',
        geoCacheHit: false,
        geocodingProviderConsultado: true,
        geocodingProvider: 'appsscript',
        geoCacheSalvo: cacheSave.ok,
        geoCacheId: cacheSave.ok ? cacheSave.chaveEndereco : null,
        geoCacheSaveErro: cacheSave.ok ? undefined : cacheSave.erro,
      }),
    };
  } catch (error) {
    const motivo = error instanceof Error ? error.message : String(error);
    console.warn(`[posvenda-webhook] geocoding provider falhou sessaoId=${options.sessaoId ?? '-'} provider=appsscript motivo=${motivo}`);
  }

  return { ok: false, motivo: 'geocoding_provider_falhou', geoCacheHit: false, geocodingProviderConsultado: true, geocodingProvider: 'appsscript', geoCacheSalvo: false };
}

export type ValidacaoCamposMere =
  | { ok: true }
  | { ok: false; motivo: string; camposFaltando: string[] };

const TEMPO_NECESSARIO_RE = /^(\d{1,2}):([0-5]\d)$/;

function normalizarTempoServicoMere(valor: unknown): string | null {
  const raw = String(valor ?? '').trim();
  if (!raw) return null;

  const minutosParseados = parseMinutos(raw);
  if (minutosParseados > 0) {
    return formatarMinutos(minutosParseados);
  }

  const minMatch = raw.match(/^(\d{1,4})\s*(?:min|mins|minuto|minutos)$/i);
  if (minMatch) {
    const minutos = Number(minMatch[1]);
    return minutos > 0 ? formatarMinutos(minutos) : null;
  }

  const numeroMatch = raw.match(/^\d{1,4}$/);
  if (numeroMatch) {
    const minutos = Number(raw);
    return minutos > 0 ? formatarMinutos(minutos) : null;
  }

  return null;
}

export function resolverTempoServicoGrupoMere(grupo: GrupoAgendamento): string | null {
  const candidatos: unknown[] = [
    grupo.tempo_servico,
    ...grupo.eventos.map((evento) => evento.tempo_servico),
    ...grupo.itens_originais.map((item) => item.tempo_servico),
  ];

  for (const candidato of candidatos) {
    const normalizado = normalizarTempoServicoMere(candidato);
    if (normalizado) return normalizado;
  }

  return null;
}

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
    const tempo = resolverTempoServicoGrupoMere(params.grupo);
    if (!tempo || !TEMPO_NECESSARIO_RE.test(tempo)) {
      faltando.push('tempo_servico');
    }
  }
  if (!params.coordenadas) {
    faltando.push('coordenadas_destino');
  }

  if (faltando.length > 0) {
    const motivo = faltando.includes('tempo_servico')
      ? 'tempo_servico_indisponivel'
      : 'dados_insuficientes_consulta_datas';
    return { ok: false, motivo, camposFaltando: faltando };
  }
  return { ok: true };
}

function arredondarCoordenada(valor: number): number {
  return Math.round(valor * 1000000) / 1000000;
}

function camposPresentesPayload(payload: PesquisarDatasRequest): string[] {
  const presentes: string[] = [];
  if (payload.dataInicial) presentes.push('dataInicial');
  if (payload.tempoNecessario) presentes.push('tempoNecessario');
  if (payload.enderecoCompleto) presentes.push('enderecoCompleto');
  if (typeof payload.destLat === 'number' && Number.isFinite(payload.destLat)) presentes.push('destLat');
  if (typeof payload.destLng === 'number' && Number.isFinite(payload.destLng)) presentes.push('destLng');
  if (typeof payload.isRural === 'boolean') presentes.push('isRural');
  if (typeof payload.isCondominio === 'boolean') presentes.push('isCondominio');
  return presentes;
}

function camposAusentesPayload(payload: PesquisarDatasRequest): string[] {
  const obrigatorios = ['dataInicial', 'tempoNecessario', 'enderecoCompleto', 'destLat', 'destLng'];
  const presentes = new Set(camposPresentesPayload(payload));
  return obrigatorios.filter((campo) => !presentes.has(campo));
}

function resumirPayloadConsultaDatasMere(
  payload: PesquisarDatasRequest,
  grupo: GrupoAgendamento,
  coordenadas: CoordenadasMere
): Record<string, unknown> {
  const endereco = decomporEnderecoCompleto(grupo.endereco_completo ?? '');
  return {
    dataInicialISO: payload.dataInicial,
    tempoNecessario: payload.tempoNecessario,
    enderecoCompletoPresente: Boolean(payload.enderecoCompleto),
    cep: endereco.cep ?? coordenadas.cepResolvido,
    numero: endereco.numero ?? coordenadas.numeroResolvido,
    cidade: endereco.cidade,
    uf: endereco.uf,
    latitude_resolvida: arredondarCoordenada(coordenadas.lat),
    longitude_resolvida: arredondarCoordenada(coordenadas.lng),
    geo_cache_id: coordenadas.geoCacheId,
    geo_cache_status: 'hit',
    geo_cache_origem: coordenadas.origem,
    geo_cache_estrategia: coordenadas.estrategia,
    geo_cache_hit: coordenadas.geoCacheHit,
    geocoding_provider_consultado: coordenadas.geocodingProviderConsultado,
    geocoding_provider: coordenadas.geocodingProvider,
    geo_cache_salvo: coordenadas.geoCacheSalvo,
    equipe: grupo.equipe_agenda || null,
    isRural: payload.isRural,
    isCondominio: payload.isCondominio,
  };
}

function resumirRetornoMotor(resultado: PesquisarDatasV2Output): Record<string, unknown> {
  return {
    ok: resultado.ok,
    erros: resultado.erros ?? [],
    entradaNormalizada: resultado.entradaNormalizada
      ? {
          dataInicialISO: resultado.entradaNormalizada.dataInicialISO,
          tempoNecessarioMin: resultado.entradaNormalizada.tempoNecessarioMin,
          temCoordenadasDestino: resultado.entradaNormalizada.temCoordenadasDestino,
          isRural: resultado.entradaNormalizada.isRural,
          isCondominio: resultado.entradaNormalizada.isCondominio,
          avisos: resultado.entradaNormalizada.avisos,
        }
      : null,
    resumo: {
      totalRecebidos: resultado.resultadoFinal.resumo.totalRecebidos,
      totalElegiveis: resultado.resultadoFinal.resumo.totalElegiveis,
      totalRecortados: resultado.resultadoFinal.resumo.totalRecortados,
      totalCandidatosFinais: resultado.resultadoFinal.candidatosFinais.length,
    },
  };
}

function stackResumido(err: Error): string {
  return (err.stack ?? err.message).split('\n').slice(0, 3).join(' | ').substring(0, 500);
}

function montarDiagnosticoConsultaDatasMere(params: {
  payload: PesquisarDatasRequest;
  grupo: GrupoAgendamento;
  coordenadas: CoordenadasMere;
  erroCodigo?: string;
  erroMensagem?: string;
  erroStackResumido?: string;
  retornoBrutoResumo?: Record<string, unknown>;
}): DiagnosticoConsultaDatasMere {
  return {
    erroCodigo: params.erroCodigo,
    erroMensagem: params.erroMensagem,
    erroStackResumido: params.erroStackResumido,
    payloadResumo: resumirPayloadConsultaDatasMere(params.payload, params.grupo, params.coordenadas),
    payloadCamposPresentes: camposPresentesPayload(params.payload),
    payloadCamposAusentes: camposAusentesPayload(params.payload),
    retornoBrutoResumo: params.retornoBrutoResumo,
    helperUsado: 'consultarDatasMere',
    rotaOuMotorUsado: 'pesquisarDatasV2',
  };
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
  const tempoServico = resolverTempoServicoGrupoMere(grupo);
  const endereco = montarPayloadEnderecoMere(grupo.endereco_completo ?? '');
  return {
    dataInicial: dataDesejadaISO,
    tempoNecessario: tempoServico ?? '',
    enderecoCompleto: grupo.endereco_completo,
    logradouro: endereco?.logradouro,
    numero: endereco?.numero,
    bairro: endereco?.bairro,
    cidade: endereco?.cidade,
    uf: endereco?.uf,
    cep: endereco?.cep,
    destLat: coordenadas.lat,
    destLng: coordenadas.lng,
    destDisplay: grupo.endereco_completo,
    destProvider: coordenadas.provider ?? coordenadas.origem,
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
export function formatarOpcoesDatasParaCliente(datas: DatasDisponiveisMere[], incluirManterDataAtual: boolean = false): string {
  const linhas = datas.map((d) => {
    const diaSemana = isoParaDiaSemana(d.dataISO);
    const label = diaSemana ? `${d.dataBR} (${diaSemana})` : d.dataBR;
    return `${d.rank} - ${label}`;
  });

  if (incluirManterDataAtual) {
    const numeroManter = datas.length + 1;
    linhas.push(`${numeroManter} - Manter mesma data atual`);
  }

  const totalOpcoes = incluirManterDataAtual ? datas.length + 1 : datas.length;
  const numeros = Array.from({ length: totalOpcoes }, (_, i) => i + 1).join(', ');

  return `Encontrei algumas possibilidades para sua entrega:\n\n${linhas.join('\n')}\n\nQual dessas opções fica melhor para você? Responda com o número desejado (${numeros}).`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Execução da consulta completa
// ─────────────────────────────────────────────────────────────────────────────

function dataISOValidaLocal(dataISO: string | null | undefined): dataISO is string {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(dataISO ?? ''));
}

function renumerarDatasMere(datas: DatasDisponiveisMere[]): DatasDisponiveisMere[] {
  return datas.map((data, idx) => ({ ...data, rank: idx + 1 }));
}

export function filtrarDatasDisponiveisPorAcaoMere(params: {
  datas: DatasDisponiveisMere[];
  dataAtualISO: string | null | undefined;
  acao: AcaoAlteracaoEntregaMere | null | undefined;
}): ResultadoFiltroDatasMere {
  const { datas, dataAtualISO, acao } = params;
  const totalMotor = datas.length;
  let removidasMesmaData = 0;
  let removidasContrariasAcao = 0;

  if (!dataISOValidaLocal(dataAtualISO)) {
    return {
      datasExibidas: renumerarDatasMere(datas),
      datasPosteriores: [],
      totalMotor,
      removidasMesmaData,
      removidasContrariasAcao,
      semOpcoesParaAcao: datas.length === 0,
    };
  }

  const semMesmaData = datas.filter((data) => {
    if (data.dataISO === dataAtualISO) {
      removidasMesmaData += 1;
      return false;
    }
    return true;
  });
  const datasPosteriores = renumerarDatasMere(semMesmaData.filter((data) => data.dataISO > dataAtualISO));

  const datasFiltradas = semMesmaData.filter((data) => {
    if (acao === 'adiantar') {
      const manter = data.dataISO < dataAtualISO;
      if (!manter) removidasContrariasAcao += 1;
      return manter;
    }
    if (acao === 'postergar') {
      const manter = data.dataISO > dataAtualISO;
      if (!manter) removidasContrariasAcao += 1;
      return manter;
    }
    return true;
  });

  const datasExibidas = renumerarDatasMere(datasFiltradas);
  return {
    datasExibidas,
    datasPosteriores,
    totalMotor,
    removidasMesmaData,
    removidasContrariasAcao,
    semOpcoesParaAcao: datasExibidas.length === 0,
  };
}

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
  coordenadas: CoordenadasMere,
  options: { sessaoId?: string } = {}
): Promise<ResultadoConsultaDatasMere> {
  const runId = gerarRunId();
  const payload = montarPayloadConsultaDatasMere(grupo, dataDesejadaISO, coordenadas);
  const endereco = montarPayloadEnderecoMere(grupo.endereco_completo ?? '');

  console.log(
    `[posvenda-webhook] payload consulta datas mere sessaoId=${options.sessaoId ?? '-'} cep=${endereco?.cep ?? '-'} enderecoCompleto="${String(payload.enderecoCompleto ?? '').slice(0, 140)}" logradouro="${endereco?.logradouro ?? '-'}" numero=${endereco?.numero ?? '-'} bairro="${endereco?.bairro ?? '-'}" cidade=${endereco?.cidade ?? '-'} uf=${endereco?.uf ?? '-'} destLat=${Number(coordenadas.lat).toFixed(6)} destLng=${Number(coordenadas.lng).toFixed(6)} dataInicial=${payload.dataInicial} tempoNecessario=${payload.tempoNecessario} tempoNecessarioMin=${parseMinutos(payload.tempoNecessario ?? '')} condominio=${payload.isCondominio} rural=${payload.isRural} encomenda=false valorInicial=- coordenadas_origem=${coordenadas.origem} geo_cache_estrategia=${coordenadas.estrategia} geo_cache_confidence=${coordenadas.confidence ?? '-'} geocoding_provider_consultado=${coordenadas.geocodingProviderConsultado} geocoding_provider=${coordenadas.geocodingProvider ?? '-'} geo_cache_salvo=${coordenadas.geoCacheSalvo}`
  );

  let resultado: PesquisarDatasV2Output;
  try {
    resultado = await pesquisarDatasV2(payload);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const erro = err instanceof Error ? err : new Error(msg);
    return {
      ok: false,
      motivo: 'excecao_pesquisar_v2',
      erros: [msg],
      diagnostico: montarDiagnosticoConsultaDatasMere({
        payload,
        grupo,
        coordenadas,
        erroCodigo: 'excecao_pesquisar_v2',
        erroMensagem: msg,
        erroStackResumido: stackResumido(erro),
      }),
    };
  }

  if (!resultado.ok) {
    const retornoBrutoResumo = resumirRetornoMotor(resultado);
    const erroMensagem = (resultado.erros ?? []).join('; ') || 'Motor v2 retornou ok=false.';
    return {
      ok: false,
      motivo: 'motor_v2_retornou_erro',
      erros: resultado.erros ?? [],
      diagnostico: montarDiagnosticoConsultaDatasMere({
        payload,
        grupo,
        coordenadas,
        erroCodigo: 'motor_v2_retornou_erro',
        erroMensagem,
        retornoBrutoResumo,
      }),
    };
  }

  const candidatos = resultado.resultadoFinal.candidatosFinais;
  const datas = extrairDatasDisponiveisElegiveis(candidatos);

  return {
    ok: true,
    datas,
    runId,
    totalCandidatos: resultado.resultadoFinal.resumo.totalElegiveis,
    diagnostico: montarDiagnosticoConsultaDatasMere({
      payload,
      grupo,
      coordenadas,
      retornoBrutoResumo: resumirRetornoMotor(resultado),
    }),
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
  const geocod = await geocodificarEnderecoMere(enderecoCompleto, { sessaoId });

  if (!geocod.ok) {
    console.log(`[posvenda-webhook] coordenadas nao resolvidas motivo=${geocod.motivo} sessaoId=${sessaoId}`);
    return {
      estado: 'erro_coordenadas',
      motivo: geocod.motivo,
      geoCacheStatus: geocod.motivo.startsWith('geo_cache_erro') ? 'erro' : 'miss',
      geoCacheMotivo: geocod.motivo,
      geoCacheHit: geocod.geoCacheHit ?? false,
      geocodingProviderConsultado: geocod.geocodingProviderConsultado ?? false,
      geocodingProvider: geocod.geocodingProvider ?? null,
      geoCacheSalvo: geocod.geoCacheSalvo ?? false,
    };
  }

  const { coordenadas } = geocod;
  if (coordenadas.geoCacheHit) {
    console.log(
      `[posvenda-webhook] geo_cache hit sessaoId=${sessaoId} origem=${coordenadas.origem} estrategia=${coordenadas.estrategia} cep=${coordenadas.cepResolvido ?? '-'} confidence=${coordenadas.confidence ?? '-'}`
    );
  }

  // 2. Validar campos obrigatórios
  const validacao = validarCamposConsultaMere({ dataDesejadaISO, grupo, coordenadas });
  if (!validacao.ok) {
    return {
      estado: 'erro_dados',
      motivo: validacao.motivo,
      coordenadas,
      geoCacheStatus: coordenadas.geoCacheHit ? 'hit' : 'miss',
      geoCacheHit: coordenadas.geoCacheHit,
      geocodingProviderConsultado: coordenadas.geocodingProviderConsultado,
      geocodingProvider: coordenadas.geocodingProvider,
      geoCacheSalvo: coordenadas.geoCacheSalvo,
      erros: validacao.camposFaltando,
      diagnostico: montarDiagnosticoConsultaDatasMere({
        payload: montarPayloadConsultaDatasMere(grupo, dataDesejadaISO, coordenadas),
        grupo,
        coordenadas,
        erroCodigo: validacao.motivo,
        erroMensagem: `Campos ausentes ou invalidos: ${validacao.camposFaltando.join(', ')}`,
      }),
    };
  }

  // 3. Executar consulta
  console.log(`[posvenda-webhook] iniciando consulta datas sessaoId=${sessaoId} data=${dataDesejadaISO}`);
  const resultado = await consultarDatasMere(grupo, dataDesejadaISO, coordenadas, { sessaoId });

  if (!resultado.ok) {
    console.log(`[posvenda-webhook] consulta datas erro sessaoId=${sessaoId} motivo=${resultado.motivo}`);
    return {
      estado: 'erro_consulta',
      motivo: resultado.motivo,
      coordenadas,
      geoCacheStatus: coordenadas.geoCacheHit ? 'hit' : 'miss',
      geoCacheHit: coordenadas.geoCacheHit,
      geocodingProviderConsultado: coordenadas.geocodingProviderConsultado,
      geocodingProvider: coordenadas.geocodingProvider,
      geoCacheSalvo: coordenadas.geoCacheSalvo,
      erros: resultado.erros ?? [],
      diagnostico: resultado.diagnostico,
    };
  }

  console.log(`[posvenda-webhook] consulta datas sucesso sessaoId=${sessaoId} total=${resultado.datas.length}`);

  if (resultado.datas.length === 0) {
    return {
      estado: 'sem_datas',
      runId: resultado.runId,
      totalCandidatos: resultado.totalCandidatos,
      coordenadas,
      geoCacheStatus: coordenadas.geoCacheHit ? 'hit' : 'miss',
      geoCacheHit: coordenadas.geoCacheHit,
      geocodingProviderConsultado: coordenadas.geocodingProviderConsultado,
      geocodingProvider: coordenadas.geocodingProvider,
      geoCacheSalvo: coordenadas.geoCacheSalvo,
      diagnostico: resultado.diagnostico,
    };
  }

  return {
    estado: 'datas_encontradas',
    datas: resultado.datas,
    runId: resultado.runId,
    totalCandidatos: resultado.totalCandidatos,
    coordenadas,
    geoCacheStatus: coordenadas.geoCacheHit ? 'hit' : 'miss',
    geoCacheHit: coordenadas.geoCacheHit,
    geocodingProviderConsultado: coordenadas.geocodingProviderConsultado,
    geocodingProvider: coordenadas.geocodingProvider,
    geoCacheSalvo: coordenadas.geoCacheSalvo,
    diagnostico: resultado.diagnostico,
  };
}
