// ─────────────────────────────────────────────────────────────────────────────
// sheets-config.ts
//
// Lê a aba de configurações do backend "Procurar Datas" direto da planilha
// via Google Sheets API v4 (OAuth2).
//
// DÍVIDA TÉCNICA: criarClienteSheets() está duplicado de
// src/lib/google/sheets-service.ts porque a função não é exportada.
// Em refactor futuro, exportar da lib original e reutilizar aqui.
// ─────────────────────────────────────────────────────────────────────────────

import { google } from 'googleapis'
import { OAuth2Client } from 'google-auth-library'

// ─── ID da planilha backend (hardcoded no Apps Script CEP-CONFIG.gs ln 79) ───
const SPREADSHEET_ID = process.env.PROCURAR_DATAS_BACKEND_SHEET_ID
// sheetId numérico da aba de config (constante no Apps Script)
const CONFIG_SHEET_ID = 718532388
// Fallback: nome da aba caso a busca por sheetId falhe
const CONFIG_SHEET_NAME_FALLBACK = 'CONTROLES E CONFIGURAÇÕES (PROCURAR CEP)'

// ─── Secrets: estes campos têm o valor mascarado antes de sair do servidor ───
// Comparação feita em UPPERCASE (normalizado)
const SECRET_KEYS = new Set([
  'API_KEY',
  'MAPS.CO API KEY',
  'LOCATIONIQ API KEY',
  'LOCATIONIQ API KEY (RESERVA)',
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
])

// ─── Linhas de cabeçalho/instrução da planilha a ignorar ─────────────────────
// Comparação feita em UPPERCASE (normalizado)
// Inclui chaves que existem na planilha mas não são relevantes para este fluxo
const LINHAS_IGNORAR = new Set([
  'COLUNA A (PROPRIEDADE)',
  'COLUNA A',
  'COLUNA B (VALOR CORRESPONDENTE)',
  'COLUNA B',
  // Chaves não utilizadas neste fluxo (existem na planilha, mas não devem aparecer na tela)
  'MENSAGEM PARA VIAGEM EM SÁBADO',
  'CUSTO MÉDIO POR MONTADOR',
  'MÉDIA CUSTO VEICULO DIÁRIO',
  'CUSTO TOTAL MÉDIO DIA (EQUIPE + CARRO)',
  'DATA_VERSION',
])

// ─── Tipos de valor por chave ─────────────────────────────────────────────────
// Chaves em UPPERCASE para lookup case-insensitive (igual ao loadFreightParams do AS)
type ConfigTipo =
  | 'text'
  | 'url'
  | 'number'
  | 'distance_m'   // valor em metros — exibir convertido para km com original em parênteses
  | 'distance_km'  // valor já em km
  | 'currency'
  | 'decimal'
  | 'boolean'
  | 'address'
  | 'secret'

// Confirmado no Apps Script (CEP-APIBACK.gs ln 362-370 e log ln 386):
// - MAX_EXTRA_METERS, MAX_WEEKDAY_METERS, MAX_SATURDAY_METERS, MAX_EXTRA_DYNAMIC,
//   MAX_EXTRA_PREMIUM → usados com /1000 → valores na planilha são metros (distance_m)
// - MAX_POINT_KM → usado direto → já é km (distance_km)
// - Parâmetros de frete KILOMETRAGEM MÁXIMA → usados direto em calcularFrete(distKm)
//   → já são km (distance_km)
const TIPOS_POR_CHAVE: Record<string, ConfigTipo> = {
  'API_KEY': 'secret',
  'MAPS.CO API KEY': 'secret',
  'LOCATIONIQ API KEY': 'secret',
  'LOCATIONIQ API KEY (RESERVA)': 'secret',
  'SUPABASE_URL': 'secret',
  'SUPABASE_ANON_KEY': 'secret',

  'OSRM BASE URL': 'url',

  'ENDEREÇO DO DEPÓSITO': 'address',
  'ENDEREÇO DA CASA EQP 1': 'address',
  'ENDEREÇO DA CASA EQP 2': 'address',

  'PLANILHA DA AGENDA': 'text',
  'PLANILHA DE TEMPO DISPONIVEL': 'text',
  'PLANILHA DO CEP': 'text',
  'SUPABASE_TABLE': 'text',

  // Metros confirmados (CEP-APIBACK.gs ln 904: MAX_EXTRA_METERS/1000, etc.)
  'KM ADICIONAL MAX NA ROTA': 'distance_m',
  'KM MAXIMO NA SEMANA': 'distance_m',
  'KM MAXIMO NO SÁBADO': 'distance_m',
  'KM ADICIONAL MAX NA ROTA ESPECIAL': 'distance_m',
  'KM ADICIONAL MAX NA ROTA PREMIUM': 'distance_m',

  // Km confirmado (CEP-APIBACK.gs ln 770: if (roughKm <= MAX_POINT_KM * 2))
  'KM MAX ENTRE PONTOS': 'distance_km',

  'DIAS DE PESQUISA NA AGENDA': 'number',

  'VALOR ADICIONAL NA ROTA ESPECIAL': 'currency',
  'VALOR ADICIONAL NA ROTA PREMIUM': 'currency',
  'HORA MARCADA VALOR ADICIONAL': 'currency',

  'HORA MARCADA HORAS A MAIS': 'number',

  'EQUIPE 1 ATIVA?': 'boolean',
  'EQUIPE 2 ATIVA?': 'boolean',

  // Km confirmado (CEP-CONFIG.gs ln 1814: distKm > lim, comparado direto)
  'KILOMETRAGEM MÁXIMA DE VIAGEM': 'distance_km',
  'KILOMETRAGEM MÁXIMA DE VALOR FIXO': 'distance_km',
  'KILOMETRAGEM MÁXIMA DE LONGA CIDADE': 'distance_km',
  'KILOMETRAGEM MÁXIMA DE NÃO VIAGEM': 'distance_km',

  'VALOR SEMANA ATÉ 10KM': 'currency',
  'VALOR SÁBADO ATÉ 10KM': 'currency',
  'FATOR MULTIPLICADOR PARA KILOMETRAGEM EM VIAGEM': 'decimal',
  'MULTIPLICADOR DE KM NÃO VIAGEM': 'decimal',
  'VALOR DIA APÓS 25KM: SEMANA': 'currency',
  'VALOR DIA APÓS 25KM: SÁBADO': 'currency',
  'PREÇO CONDOMINIO ADICIONAL': 'currency',
}

// ─── Grupos: ordem e quais chaves pertencem a cada seção ─────────────────────
// Todas as chaves em UPPERCASE — lookup feito com normalização (igual ao AS)
const GRUPOS: Record<string, string[]> = {
  geral: [
    'PLANILHA DA AGENDA',
    'PLANILHA DE TEMPO DISPONIVEL',
    'PLANILHA DO CEP',
    'SUPABASE_TABLE',
    'DIAS DE PESQUISA NA AGENDA',
    'OSRM BASE URL',
  ],
  rota: [
    'KM ADICIONAL MAX NA ROTA',
    'KM MAXIMO NA SEMANA',
    'KM MAXIMO NO SÁBADO',
    'KM MAX ENTRE PONTOS',
    'KM ADICIONAL MAX NA ROTA ESPECIAL',
    'KM ADICIONAL MAX NA ROTA PREMIUM',
  ],
  candidatos_precos: [
    'VALOR ADICIONAL NA ROTA ESPECIAL',
    'VALOR ADICIONAL NA ROTA PREMIUM',
    'HORA MARCADA HORAS A MAIS',
    'HORA MARCADA VALOR ADICIONAL',
  ],
  equipes: [
    'EQUIPE 1 ATIVA?',
    'EQUIPE 2 ATIVA?',
    'ENDEREÇO DO DEPÓSITO',
    'ENDEREÇO DA CASA EQP 1',
    'ENDEREÇO DA CASA EQP 2',
  ],
  frete: [
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
  ],
  provedores: [
    'API_KEY',
    'MAPS.CO API KEY',
    'LOCATIONIQ API KEY',
    'LOCATIONIQ API KEY (RESERVA)',
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY',
  ],
}

// Conjunto plano de todas as chaves mapeadas em UPPERCASE (para detectar "Outros")
const CHAVES_MAPEADAS_UPPER = new Set(Object.values(GRUPOS).flat())

// ─── Tipos públicos exportados ────────────────────────────────────────────────
export interface ConfigItem {
  chave: string
  valor: string
  tipo: ConfigTipo
}

export interface ConfigSecoes {
  geral: ConfigItem[]
  rota: ConfigItem[]
  candidatos_precos: ConfigItem[]
  equipes: ConfigItem[]
  frete: ConfigItem[]
  provedores: ConfigItem[]
  outros: ConfigItem[]
}

export interface ConfigProcurarDatasResult {
  ok: true
  origem: 'planilha'
  lido_em: string
  secoes: ConfigSecoes
}

export interface ConfigProcurarDatasErro {
  ok: false
  erro: string
}

export type ConfigProcurarDatasResponse =
  | ConfigProcurarDatasResult
  | ConfigProcurarDatasErro

// ─── Helpers internos ─────────────────────────────────────────────────────────

function mascarar(valor: string): string {
  if (!valor || valor.length <= 4) return '***'
  return '***...' + valor.slice(-4)
}

// Duplicado de sheets-service.ts — ver DÍVIDA TÉCNICA acima
async function criarClienteSheets() {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET
  const refreshToken = process.env.GOOGLE_OAUTH_REFRESH_TOKEN

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(
      'Variáveis GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET e GOOGLE_OAUTH_REFRESH_TOKEN são obrigatórias.'
    )
  }

  const oauth2Client = new OAuth2Client({ clientId, clientSecret })
  oauth2Client.setCredentials({ refresh_token: refreshToken })

  try {
    const { credentials } = await oauth2Client.refreshAccessToken()
    oauth2Client.setCredentials(credentials)
    console.log('[SHEETS CONFIG] ✓ Access token obtido com sucesso')
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('[SHEETS CONFIG] ❌ Erro ao fazer refresh do access_token:', msg)
    throw new Error('Falha ao renovar access token. Verifique o refresh_token.')
  }

  return google.sheets({ version: 'v4', auth: oauth2Client })
}

// ─── Função principal exportada ───────────────────────────────────────────────

export async function lerConfiguracoesProcurarDatas(): Promise<ConfigProcurarDatasResponse> {
  if (!SPREADSHEET_ID) {
    return {
      ok: false,
      erro: 'Variável de ambiente PROCURAR_DATAS_BACKEND_SHEET_ID não configurada no servidor.',
    }
  }

  let sheets: Awaited<ReturnType<typeof criarClienteSheets>>
  try {
    sheets = await criarClienteSheets()
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    return { ok: false, erro: `Falha na autenticação Google: ${msg}` }
  }

  // 1. Descobrir o nome da aba pelo sheetId numérico
  let nomeAba: string
  try {
    const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID })
    const aba = meta.data.sheets?.find(
      (s) => s.properties?.sheetId === CONFIG_SHEET_ID
    )
    if (aba?.properties?.title) {
      nomeAba = aba.properties.title
      console.log(`[SHEETS CONFIG] ✓ Aba encontrada pelo sheetId: "${nomeAba}"`)
    } else {
      // Fallback: tentar pelo nome
      const abaFallback = meta.data.sheets?.find(
        (s) => s.properties?.title === CONFIG_SHEET_NAME_FALLBACK
      )
      if (abaFallback?.properties?.title) {
        nomeAba = abaFallback.properties.title
        console.warn(
          `[SHEETS CONFIG] ⚠ sheetId ${CONFIG_SHEET_ID} não encontrado, usando fallback pelo nome: "${nomeAba}"`
        )
      } else {
        return {
          ok: false,
          erro: `Aba de configuração não encontrada na planilha (sheetId=${CONFIG_SHEET_ID}, fallback="${CONFIG_SHEET_NAME_FALLBACK}").`,
        }
      }
    }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('[SHEETS CONFIG] ❌ Erro ao obter metadados da planilha:', msg)
    return {
      ok: false,
      erro: `Erro ao acessar a planilha. Verifique se o token tem permissão de leitura. Detalhe: ${msg}`,
    }
  }

  // 2. Ler todas as linhas da coluna A:B
  // mapaOriginal: chave original da planilha → valor
  // mapaUpper: chave.toUpperCase() → chave original (para lookup normalizado)
  let mapaOriginal: Record<string, string>
  let mapaUpper: Record<string, string> // upperKey → chaveOriginal
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${nomeAba}!A:B`,
      valueRenderOption: 'FORMATTED_VALUE',
    })

    const linhas = res.data.values ?? []
    mapaOriginal = {}
    mapaUpper = {}
    for (const linha of linhas) {
      const chaveRaw = (linha[0] ?? '').toString().trim()
      const valor = (linha[1] ?? '').toString().trim()
      if (!chaveRaw) continue
      const upper = chaveRaw.toUpperCase()
      // Ignorar linhas de cabeçalho/instrução da planilha
      if (LINHAS_IGNORAR.has(upper)) continue
      mapaOriginal[chaveRaw] = valor
      mapaUpper[upper] = chaveRaw
    }
    console.log(`[SHEETS CONFIG] ✓ ${Object.keys(mapaOriginal).length} chaves lidas da planilha`)
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('[SHEETS CONFIG] ❌ Erro ao ler valores da aba:', msg)
    return {
      ok: false,
      erro: `Erro ao ler a aba de configuração. Detalhe: ${msg}`,
    }
  }

  // 3. Montar ConfigItem para uma chave canônica (UPPERCASE do GRUPOS)
  // Exibe a chave como está no GRUPOS (mais legível), valor lookup via normalização
  function buildItem(chaveCanonica: string): ConfigItem {
    const upper = chaveCanonica.toUpperCase()
    const chaveOriginal = mapaUpper[upper]          // chave real na planilha
    const valorRaw = chaveOriginal != null ? (mapaOriginal[chaveOriginal] ?? '') : ''
    const tipo: ConfigTipo = TIPOS_POR_CHAVE[upper] ?? 'text'
    const valor = SECRET_KEYS.has(upper) ? mascarar(valorRaw) : valorRaw
    return { chave: chaveCanonica, valor, tipo }
  }

  // 4. Construir seções
  const secoes: ConfigSecoes = {
    geral: [],
    rota: [],
    candidatos_precos: [],
    equipes: [],
    frete: [],
    provedores: [],
    outros: [],
  }

  for (const [grupo, chaves] of Object.entries(GRUPOS) as Array<[keyof Omit<ConfigSecoes, 'outros'>, string[]]>) {
    for (const chave of chaves) {
      // Incluir mesmo se a chave não existir na planilha (valor vazio)
      secoes[grupo].push(buildItem(chave))
    }
  }

  // 5. Chaves da planilha não mapeadas → seção "outros"
  // Compara UPPERCASE das chaves originais com o conjunto mapeado
  for (const [chaveOriginal, valorRaw] of Object.entries(mapaOriginal)) {
    const upper = chaveOriginal.toUpperCase()
    if (!CHAVES_MAPEADAS_UPPER.has(upper)) {
      const tipo: ConfigTipo = TIPOS_POR_CHAVE[upper] ?? 'text'
      const valor = SECRET_KEYS.has(upper) ? mascarar(valorRaw) : valorRaw
      secoes.outros.push({ chave: chaveOriginal, valor, tipo })
    }
  }

  return {
    ok: true,
    origem: 'planilha',
    lido_em: new Date().toISOString(),
    secoes,
  }
}
