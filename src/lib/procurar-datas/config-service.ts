// ─────────────────────────────────────────────────────────────────────────────
// config-service.ts  —  Fase 4
//
// Camada isolada de leitura e normalização das configurações do motor
// "Procurar Datas", com fallback para planilha.
//
// RESPONSABILIDADES:
//   - Ler procurar_datas_config (ativo = true) via buscarConfigsDb()
//   - Normalizar tipos (distance_m → metros, boolean → boolean, etc.)
//   - Fallback para planilha se Supabase estiver vazio ou incompleto
//   - Indicar origem: 'supabase' | 'planilha_fallback' | 'misto' | 'erro'
//   - Listar chaves faltantes no Supabase
//
// NÃO FAZ:
//   - Nenhuma escrita no banco
//   - Nenhuma alteração de schema ou RLS
//   - Nenhuma integração com o motor (Fase 5+)
//   - Não retorna secrets reais (retorna null para is_secret=true)
//
// NOTAS:
//   - Providers de geocoding (LOCATIONIQ, MAPS.CO, API_KEY) vivem na planilha
//     e são lidos pelo Apps Script, não pelo Next.js. O servidor Next não tem
//     essas variáveis de ambiente — por isso não existe bloco "providers" aqui.
//   - TEMPO MAXIMO DE VIAGEM SÁBADO é normalizado para minutos inteiros
//     (ex: "01:00" → 60). Mais seguro para uso futuro pelo motor.
// ─────────────────────────────────────────────────────────────────────────────

import { buscarConfigsDb, ConfigDbRow } from './config-db'
import {
  lerConfiguracoesProcurarDatas,
  ConfigItem,
  ConfigSecoes,
} from './sheets-config'

// ─── Chaves que fazem parte do objeto normalizado ─────────────────────────────
// Em UPPERCASE, igual ao banco. A ordem não importa para lookup.
// Secrets estão EXCLUÍDOS desta lista intencionalmente.

const CHAVES_NORMALIZADAS: ReadonlySet<string> = new Set([
  // Geral
  'PLANILHA DA AGENDA',
  'PLANILHA DE TEMPO DISPONIVEL',
  'PLANILHA DO CEP',
  'SUPABASE_TABLE',
  'DIAS DE PESQUISA NA AGENDA',
  'OSRM BASE URL',
  // Rota
  'KM ADICIONAL MAX NA ROTA',
  'KM MAXIMO NA SEMANA',
  'KM MAXIMO NO SÁBADO',
  'KM MAX ENTRE PONTOS',
  'KM ADICIONAL MAX NA ROTA ESPECIAL',
  'KM ADICIONAL MAX NA ROTA PREMIUM',
  // Candidatos e Preços
  'VALOR ADICIONAL NA ROTA ESPECIAL',
  'VALOR ADICIONAL NA ROTA PREMIUM',
  'HORA MARCADA HORAS A MAIS',
  'HORA MARCADA VALOR ADICIONAL',
  // Equipes
  'EQUIPE 1 ATIVA?',
  'EQUIPE 2 ATIVA?',
  'ENDEREÇO DO DEPÓSITO',
  'ENDEREÇO DA CASA EQP 1',
  'ENDEREÇO DA CASA EQP 2',
  // Coordenadas de origem (para cálculo de distância OSRM/Haversine)
  'LAT DEPOSITO',
  'LNG DEPOSITO',
  'LAT CASA E1',
  'LNG CASA E1',
  'LAT CASA E2',
  'LNG CASA E2',
  // Frete
  'KILOMETRAGEM MÁXIMA DE VIAGEM',
  'KILOMETRAGEM MÁXIMA DE VALOR FIXO',
  'KILOMETRAGEM MÁXIMA DE LONGA CIDADE',
  'KILOMETRAGEM MÁXIMA DE NÃO VIAGEM',
  'VALOR SEMANA ATÉ 10KM',
  'VALOR SÁBADO ATÉ 10KM',
  'FATOR MULTIPLICADOR PARA KILOMETRAGEM EM VIAGEM',
  'MULTIPLICADOR DE KM NÃO VIAGEM',
  'VALOR DIA APÓS 25KM: SEMANA',
  'VALOR DIA APÓS 25KM: SÁBADO',
  'PREÇO CONDOMINIO ADICIONAL',
  'TEMPO MAXIMO DE VIAGEM SÁBADO',
])

// ─── Tipos públicos ───────────────────────────────────────────────────────────

export type OrigemConfig = 'supabase' | 'planilha_fallback' | 'misto' | 'erro'

/**
 * Objeto normalizado com valores prontos para consumo futuro pelo motor.
 *
 * Conversões aplicadas:
 *   distance_m  → number em metros (ex: "5000" → 5000)
 *   distance_km → number em km     (ex: "8"    → 8)
 *   currency    → number           (ex: "400"  → 400)
 *   decimal     → number           (ex: "1.15" → 1.15)
 *   number      → number inteiro   (ex: "100"  → 100)
 *   boolean     → boolean          (ex: "SIM"  → true)
 *   address/text/url → string trim
 *   TEMPO MAXIMO DE VIAGEM SÁBADO → minutos inteiros (ex: "01:00" → 60)
 */
export interface ConfigNormalizada {
  // Geral
  planilhaDaAgenda: string
  planilhaDeTempoDisponivel: string
  planilhaDoCep: string
  supabaseTable: string
  diasPesquisaAgenda: number
  osrmBaseUrl: string

  // Rota — metros
  kmAdicionalMaxNaRotaM: number
  kmMaximoNaSemanaM: number
  kmMaximoNoSabadoM: number
  kmAdicionalMaxNaRotaEspecialM: number
  kmAdicionalMaxNaRotaPremiumM: number
  // Rota — km
  kmMaxEntrePontosKm: number

  // Candidatos e Preços
  valorAdicionalRotaEspecial: number
  valorAdicionalRotaPremium: number
  horaMarcadaHorasAMais: number
  horaMarcadaValorAdicional: number

  // Equipes
  equipe1Ativa: boolean
  equipe2Ativa: boolean
  enderecoDeposito: string
  enderecoCasaEqp1: string
  enderecoCasaEqp2: string
  // Coordenadas de origem (para cálculo de distância)
  latDeposito: number
  lngDeposito: number
  latCasaE1: number
  lngCasaE1: number
  latCasaE2: number
  lngCasaE2: number

  // Frete — km
  kmMaxViagem: number
  kmMaxValorFixo: number
  kmMaxLongaCidade: number
  kmMaxNaoViagem: number
  // Frete — valores monetários
  valorSemanaAte10km: number
  valorSabadoAte10km: number
  valorDiaApos25kmSemana: number
  valorDiaApos25kmSabado: number
  precoCondominioAdicional: number
  // Frete — multiplicadores
  fatorMultiplicadorKmViagem: number
  multiplicadorKmNaoViagem: number
  // Frete — tempo em minutos
  tempoMaximoViagemSabadoMin: number
}

export interface ConfigServiceResult {
  ok: true
  origem: OrigemConfig
  faltantesNoSupabase: string[]
  usandoFallbackPlanilha: boolean
  lido_em: string
  config: ConfigNormalizada
}

export interface ConfigServiceErro {
  ok: false
  erro: string
  origemErro: 'supabase' | 'planilha' | 'ambos'
}

export type ConfigServiceResponse = ConfigServiceResult | ConfigServiceErro

// ─── Normalização interna ─────────────────────────────────────────────────────

function parseNumber(valor: string | null, chave: string): number | null {
  if (!valor) return null
  const limpo = valor.trim().replace(',', '.')
  const n = parseFloat(limpo)
  if (isNaN(n)) {
    console.warn(`[CONFIG-SERVICE] Valor não numérico para "${chave}": "${valor}"`)
    return null
  }
  return n
}

function parseBoolean(valor: string | null, chave: string): boolean | null {
  if (!valor) return null
  const upper = valor.trim().toUpperCase()
  if (['SIM', 'S', 'YES', 'Y', 'TRUE', '1', 'ATIVO', 'ATIVA'].includes(upper)) return true
  if (['NÃO', 'NAO', 'N', 'NO', 'FALSE', '0', 'INATIVO', 'INATIVA'].includes(upper)) return false
  console.warn(`[CONFIG-SERVICE] Valor booleano desconhecido para "${chave}": "${valor}"`)
  return null
}

function parseTempoMinutos(valor: string | null, chave: string): number | null {
  if (!valor) return null
  const match = valor.trim().match(/^(\d{1,2}):(\d{2})$/)
  if (!match) {
    console.warn(`[CONFIG-SERVICE] Formato HH:MM inválido para "${chave}": "${valor}"`)
    return null
  }
  const horas = parseInt(match[1], 10)
  const minutos = parseInt(match[2], 10)
  if (minutos > 59) {
    console.warn(`[CONFIG-SERVICE] Minutos fora do range para "${chave}": "${valor}"`)
    return null
  }
  return horas * 60 + minutos
}

function parseString(valor: string | null): string | null {
  if (!valor) return null
  const trimmed = valor.trim()
  return trimmed.length > 0 ? trimmed : null
}

/**
 * Normaliza um valor bruto (string) de acordo com o tipo da chave.
 * Retorna null se o valor for inválido ou ausente.
 * Nunca retorna valor de secrets (is_secret=true → sempre null).
 */
function normalizarValor(
  chaveUpper: string,
  valorTipo: string,
  valor: string | null,
  isSecret: boolean
): string | number | boolean | null {
  if (isSecret) return null
  if (!valor || valor.trim() === '') return null

  // Override por chave específica — TEMPO MAXIMO sempre como HH:MM → minutos
  if (chaveUpper === 'TEMPO MAXIMO DE VIAGEM SÁBADO') {
    return parseTempoMinutos(valor, chaveUpper)
  }

  switch (valorTipo) {
    case 'distance_m':
    case 'distance_km':
    case 'currency':
    case 'decimal':
      return parseNumber(valor, chaveUpper)
    case 'number':
      return parseNumber(valor, chaveUpper)
    case 'boolean':
      return parseBoolean(valor, chaveUpper)
    case 'text':
    case 'url':
    case 'address':
      return parseString(valor)
    default:
      return parseString(valor)
  }
}

// ─── Converter ConfigSecoes da planilha em mapa flat ─────────────────────────

function secoesParaMapa(secoes: ConfigSecoes): Map<string, ConfigItem> {
  const mapa = new Map<string, ConfigItem>()
  const todasSecoes = [
    secoes.geral,
    secoes.rota,
    secoes.candidatos_precos,
    secoes.equipes,
    secoes.frete,
    secoes.provedores,
    secoes.outros,
  ]
  for (const secao of todasSecoes) {
    for (const item of secao) {
      mapa.set(item.chave.toUpperCase(), item)
    }
  }
  return mapa
}

// ─── Montagem do objeto normalizado ──────────────────────────────────────────

interface FonteValor {
  valor: string | number | boolean | null
  tipo: string
  origem: 'supabase' | 'planilha'
}

/**
 * Resolve o valor final de uma chave, priorizando Supabase.
 * Retorna também a fonte usada para registro de origem.
 */
function resolverValor(
  chaveUpper: string,
  mapaDb: Map<string, ConfigDbRow>,
  mapaPlanilha: Map<string, ConfigItem> | null
): FonteValor {
  const dbRow = mapaDb.get(chaveUpper)

  if (dbRow && !dbRow.is_secret && dbRow.valor !== null && dbRow.valor.trim() !== '') {
    const normalizado = normalizarValor(chaveUpper, dbRow.valor_tipo, dbRow.valor, false)
    if (normalizado !== null) {
      return { valor: normalizado, tipo: dbRow.valor_tipo, origem: 'supabase' }
    }
    // Valor inválido no banco → tenta planilha
    console.warn(`[CONFIG-SERVICE] Valor inválido no banco para "${chaveUpper}", tentando planilha`)
  }

  // Fallback para planilha
  if (mapaPlanilha) {
    const planilhaItem = mapaPlanilha.get(chaveUpper)
    if (planilhaItem && planilhaItem.valor && planilhaItem.tipo !== 'secret') {
      const normalizado = normalizarValor(chaveUpper, planilhaItem.tipo, planilhaItem.valor, false)
      if (normalizado !== null) {
        return { valor: normalizado, tipo: planilhaItem.tipo, origem: 'planilha' }
      }
    }
  }

  return { valor: null, tipo: dbRow?.valor_tipo ?? 'text', origem: 'supabase' }
}

/**
 * Monta o ConfigNormalizada a partir do mapa de fontes resolvidas.
 * Usa type assertion — todos os campos foram validados antes nesta função.
 */
function montarObjeto(
  fontes: Map<string, FonteValor>
): ConfigNormalizada {
  const s = (chave: string) => (fontes.get(chave)?.valor as string) ?? ''
  const n = (chave: string) => (fontes.get(chave)?.valor as number) ?? 0
  const b = (chave: string) => (fontes.get(chave)?.valor as boolean) ?? false

  return {
    // Geral
    planilhaDaAgenda: s('PLANILHA DA AGENDA'),
    planilhaDeTempoDisponivel: s('PLANILHA DE TEMPO DISPONIVEL'),
    planilhaDoCep: s('PLANILHA DO CEP'),
    supabaseTable: s('SUPABASE_TABLE'),
    diasPesquisaAgenda: n('DIAS DE PESQUISA NA AGENDA'),
    osrmBaseUrl: s('OSRM BASE URL'),
    // Rota — metros
    kmAdicionalMaxNaRotaM: n('KM ADICIONAL MAX NA ROTA'),
    kmMaximoNaSemanaM: n('KM MAXIMO NA SEMANA'),
    kmMaximoNoSabadoM: n('KM MAXIMO NO SÁBADO'),
    kmAdicionalMaxNaRotaEspecialM: n('KM ADICIONAL MAX NA ROTA ESPECIAL'),
    kmAdicionalMaxNaRotaPremiumM: n('KM ADICIONAL MAX NA ROTA PREMIUM'),
    // Rota — km
    kmMaxEntrePontosKm: n('KM MAX ENTRE PONTOS'),
    // Candidatos
    valorAdicionalRotaEspecial: n('VALOR ADICIONAL NA ROTA ESPECIAL'),
    valorAdicionalRotaPremium: n('VALOR ADICIONAL NA ROTA PREMIUM'),
    horaMarcadaHorasAMais: n('HORA MARCADA HORAS A MAIS'),
    horaMarcadaValorAdicional: n('HORA MARCADA VALOR ADICIONAL'),
    // Equipes
    equipe1Ativa: b('EQUIPE 1 ATIVA?'),
    equipe2Ativa: b('EQUIPE 2 ATIVA?'),
    enderecoDeposito: s('ENDEREÇO DO DEPÓSITO'),
    enderecoCasaEqp1: s('ENDEREÇO DA CASA EQP 1'),
    enderecoCasaEqp2: s('ENDEREÇO DA CASA EQP 2'),
    // Coordenadas de origem
    latDeposito: n('LAT DEPOSITO'),
    lngDeposito: n('LNG DEPOSITO'),
    latCasaE1: n('LAT CASA E1'),
    lngCasaE1: n('LNG CASA E1'),
    latCasaE2: n('LAT CASA E2'),
    lngCasaE2: n('LNG CASA E2'),
    // Frete — km
    kmMaxViagem: n('KILOMETRAGEM MÁXIMA DE VIAGEM'),
    kmMaxValorFixo: n('KILOMETRAGEM MÁXIMA DE VALOR FIXO'),
    kmMaxLongaCidade: n('KILOMETRAGEM MÁXIMA DE LONGA CIDADE'),
    kmMaxNaoViagem: n('KILOMETRAGEM MÁXIMA DE NÃO VIAGEM'),
    // Frete — moeda
    valorSemanaAte10km: n('VALOR SEMANA ATÉ 10KM'),
    valorSabadoAte10km: n('VALOR SÁBADO ATÉ 10KM'),
    valorDiaApos25kmSemana: n('VALOR DIA APÓS 25KM: SEMANA'),
    valorDiaApos25kmSabado: n('VALOR DIA APÓS 25KM: SÁBADO'),
    precoCondominioAdicional: n('PREÇO CONDOMINIO ADICIONAL'),
    // Frete — multiplicadores
    fatorMultiplicadorKmViagem: n('FATOR MULTIPLICADOR PARA KILOMETRAGEM EM VIAGEM'),
    multiplicadorKmNaoViagem: n('MULTIPLICADOR DE KM NÃO VIAGEM'),
    // Frete — tempo
    tempoMaximoViagemSabadoMin: n('TEMPO MAXIMO DE VIAGEM SÁBADO'),
  }
}

// ─── Função principal exportada ───────────────────────────────────────────────

/**
 * Lê e normaliza as configurações do motor "Procurar Datas".
 *
 * Fluxo de fallback:
 *   1. Lê Supabase (procurar_datas_config WHERE ativo = true)
 *   2. Se banco vazio → usa planilha como fallback completo
 *   3. Se banco parcialmente incompleto → misto (Supabase + planilha por chave)
 *   4. Se Supabase falha → tenta planilha; se planilha também falha → erro claro
 *
 * Não escreve nada. Não altera schema. Não chama o motor.
 */
export async function buscarConfiguracoesProcurarDatas(): Promise<ConfigServiceResponse> {
  const lido_em = new Date().toISOString()

  // ─── 1. Ler Supabase ──────────────────────────────────────────────────────
  let mapaDb: Map<string, ConfigDbRow>
  let erroDb = false

  try {
    mapaDb = await buscarConfigsDb()
    console.log(`[CONFIG-SERVICE] Supabase: ${mapaDb.size} chaves ativas`)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[CONFIG-SERVICE] Erro ao ler Supabase:', msg)
    mapaDb = new Map()
    erroDb = true
  }

  // Verificar se banco tem pelo menos uma das chaves esperadas (não secrets)
  // Um banco "vazio" para fins de fallback é aquele sem nenhuma chave da lista
  const chavesNoDb = new Set(
    [...mapaDb.keys()].filter((k) => CHAVES_NORMALIZADAS.has(k))
  )
  const bancoVazio = chavesNoDb.size === 0

  // ─── 2. Ler planilha se necessário ───────────────────────────────────────
  // Carrega a planilha se: banco vazio, banco com erro, ou para completar faltantes
  let mapaPlanilha: Map<string, ConfigItem> | null = null
  let erroPlanilha = false

  const precisaPlanilha = bancoVazio || erroDb || chavesNoDb.size < CHAVES_NORMALIZADAS.size

  if (precisaPlanilha) {
    try {
      const resultado = await lerConfiguracoesProcurarDatas()
      if (resultado.ok) {
        mapaPlanilha = secoesParaMapa(resultado.secoes)
        console.log(`[CONFIG-SERVICE] Planilha: ${mapaPlanilha.size} chaves lidas`)
      } else {
        console.error('[CONFIG-SERVICE] Planilha retornou erro:', resultado.erro)
        erroPlanilha = true
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[CONFIG-SERVICE] Erro ao ler planilha:', msg)
      erroPlanilha = true
    }
  }

  // ─── 3. Falha total ────────────────────────────────────────────────────────
  if (bancoVazio && erroPlanilha) {
    return {
      ok: false,
      erro: erroDb
        ? 'Supabase inacessível e planilha também inacessível.'
        : 'Banco vazio e planilha inacessível.',
      origemErro: erroDb ? 'ambos' : 'planilha',
    }
  }

  // ─── 4. Resolver cada chave + registrar origem ────────────────────────────
  const fontes = new Map<string, FonteValor>()
  const faltantesNoSupabase: string[] = []

  for (const chave of CHAVES_NORMALIZADAS) {
    const fonte = resolverValor(chave, mapaDb, mapaPlanilha)
    fontes.set(chave, fonte)

    if (fonte.origem === 'planilha') {
      faltantesNoSupabase.push(chave)
    }
  }

  // ─── 5. Determinar origem geral ───────────────────────────────────────────
  let origem: OrigemConfig

  if (erroDb && !erroPlanilha) {
    origem = 'planilha_fallback'
  } else if (bancoVazio) {
    origem = 'planilha_fallback'
  } else if (faltantesNoSupabase.length === 0) {
    origem = 'supabase'
  } else {
    origem = 'misto'
  }

  // ─── 6. Montar objeto normalizado ─────────────────────────────────────────
  const config = montarObjeto(fontes)

  console.log(
    `[CONFIG-SERVICE] Origem: ${origem}` +
      (faltantesNoSupabase.length > 0
        ? ` | Faltantes no Supabase (${faltantesNoSupabase.length}): ${faltantesNoSupabase.join(', ')}`
        : '')
  )

  return {
    ok: true,
    origem,
    faltantesNoSupabase,
    usandoFallbackPlanilha: faltantesNoSupabase.length > 0 || bancoVazio || erroDb,
    lido_em,
    config,
  }
}
