// ─────────────────────────────────────────────────────────────────────────────
// motor/parse-agenda-shag.ts
//   Parser puro de linhas da planilha AGENDA (shAg) → PontoAgendaV2[]
//
//   Reproduz fielmente o contrato de coletarPontosDoDia() do CEP-CONFIG.gs:
//   - Filtra por data (YYYY-MM-DD) e equipe normalizada
//   - Extrai endereco da coluna 6 (indice 5) ou fallback via regex em coluna 5
//   - Extrai CEP por regex
//   - Coordenadas injetadas via cache (sem geocoding real, sem I/O)
//   - Pontos sem coordenadas sao descartados com motivo claro (nao silencioso)
//
//   Colunas da planilha real (7 colunas, indices 0-6):
//     [0] Data | [1] (nao usado) | [2] Titulo/Evento | [3] (nao usado)
//     [4] Observacoes | [5] Lugar/Endereco | [6] Equipe
//
// NAO FAZ:
//   - Leitura de planilha, Google Sheets, Apps Script, Supabase, OSRM
//   - Geocoding real (recebe coordenadas via cache injetado)
//   - Nenhuma chamada externa ou I/O
//   - Nao muta o input
//   - Nao cria rota nem integra automaticamente na rota diagnostica v2
// ─────────────────────────────────────────────────────────────────────────────

import { normalizarEquipe } from './equipe'

// ─── Tipos de entrada ─────────────────────────────────────────────────────────

/** Linha bruta da planilha AGENDA (shAg). Array de 7 elementos (indices 0-6). */
export type LinhaAgendaShAgV2 = unknown[]

export type ParsearPontosAgendaDoDiaV2Input = {
  /** Linhas brutas da planilha AGENDA. Cada linha deve ter 7 colunas. */
  linhasAgenda: LinhaAgendaShAgV2[]

  /** Data alvo no formato YYYY-MM-DD. Usada para filtrar pontos do dia. */
  dataAlvoISO: string

  /** Equipe alvo ('EQUIPE 1' ou 'EQUIPE 2'). Filtra apos normalizacao. */
  equipeAlvo: 'EQUIPE 1' | 'EQUIPE 2'

  /**
   * Cache opcional de coordenadas por endereco.
   * Chave: endereco normalizado (string).
   * Valor: coordenadas {lat, lng}.
   * Se nao fornecido ou endereco nao existir no cache, ponto sera descartado
   * com motivo 'sem_coordenadas_cache'.
   */
  cacheCoordenadasPorEndereco?: Record<string, { lat: number; lng: number }>
}

// ─── Tipos de saida ───────────────────────────────────────────────────────────

/** Fonte do endereco extraido. */
export type FonteEnderecoAgendaV2 = 'coluna-endereco' | 'observacoes-regex'

/** Fonte do CEP extraido. */
export type FonteCepAgendaV2 = 'regex-endereco' | 'regex-observacoes' | 'ausente'

/** Ponto de agenda valido, com coordenadas do cache injetado. */
export type PontoAgendaV2 = {
  /** Data no formato YYYY-MM-DD. */
  dataISO: string

  /** Equipe normalizada ('EQUIPE 1' ou 'EQUIPE 2'). */
  equipe: 'EQUIPE 1' | 'EQUIPE 2'

  /** Titulo do evento (coluna 3, indice 2). Pode ser null se vazio. */
  tituloEvento: string | null

  /** Endereco extraido e limpo. */
  endereco: string

  /** Fonte do endereco (coluna 6 ou regex em observacoes). */
  fonteEndereco: FonteEnderecoAgendaV2

  /** Coordenadas injetadas do cache (nao geocodificadas). */
  coordenadas: {
    lat: number
    lng: number
  }

  /** CEP extraido por regex (8 digitos, sem hifen). Null se nao encontrado. */
  cep: string | null

  /** Fonte do CEP. */
  fonteCep: FonteCepAgendaV2

  /** Indice da linha original no array de entrada (para auditoria). */
  indiceLinhaOriginal: number
}

/** Motivo de descarte de um ponto. */
export type MotivoDescarteAgendaV2 =
  | 'data_diferente'
  | 'equipe_diferente'
  | 'sem_endereco'
  | 'sem_coordenadas_cache'
  | 'equipe_invalida'
  | 'data_invalida'
  | 'linha_incompleta'

/** Ponto descartado, com motivo para auditoria. */
export type PontoAgendaDescartadoV2 = {
  /** Indice da linha original no array de entrada. */
  indiceLinhaOriginal: number

  /** Motivo do descarte. */
  motivo: MotivoDescarteAgendaV2

  /** Descricao adicional para debug. */
  descricao: string

  /** Dados brutos que foram parseados (para auditoria). */
  dadosBrutos: {
    data?: unknown
    titulo?: unknown
    observacoes?: unknown
    endereco?: unknown
    equipe?: unknown
  }
}

export type ResumoParseAgendaV2 = {
  linhasRecebidas: number
  linhasDaData: number
  linhasDaEquipe: number
  pontosValidos: number
  pontosDescartados: number
  semEndereco: number
  semCoordenadas: number
}

export type ParsearPontosAgendaDoDiaV2Output = {
  ok: boolean
  pontos: PontoAgendaV2[]
  descartados: PontoAgendaDescartadoV2[]
  avisos: string[]
  erros: string[]
  resumo: ResumoParseAgendaV2
}

// ─── Helpers internos ─────────────────────────────────────────────────────────

/**
 * Normaliza uma data para YYYY-MM-DD.
 * Suporta: Date object, string D/M/YYYY, string DD/MM/YYYY HH:mm:ss,
 * string YYYY-MM-DD.
 * Retorna null se nao for possivel parsear.
 */
function normalizarDataParaISO(input: unknown): string | null {
  if (input instanceof Date && !isNaN(input.getTime())) {
    const y = input.getFullYear()
    const m = String(input.getMonth() + 1).padStart(2, '0')
    const d = String(input.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }

  if (typeof input !== 'string') return null

  const s = input.trim()

  // Formato: YYYY-MM-DD
  const mIso = s.match(/^\d{4}-\d{2}-\d{2}$/)
  if (mIso) return s

  // Formato: D/M/YYYY, DD/MM/YYYY ou com horario HH:mm:ss
  const mBr = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?$/)
  if (mBr) {
    const [, d, m, y] = mBr
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  }

  return null
}

/**
 * Extrai endereco da linha.
 * Fonte primaria: coluna 6 (indice 5).
 * Fonte secundaria: coluna 5 (indice 4) via regex ENDERECO:.
 * Retorna { endereco, fonte } ou null se nao encontrar.
 */
export function extrairEnderecoAgendaShAgV2(linha: LinhaAgendaShAgV2): {
  endereco: string
  fonte: FonteEnderecoAgendaV2
} | null {
  // Coluna 6 (indice 5) - fonte primaria
  const colEndereco = linha[5]
  if (colEndereco && String(colEndereco).trim()) {
    let addr = String(colEndereco).trim()
    addr = limparEndereco(addr)
    if (addr) {
      return { endereco: addr, fonte: 'coluna-endereco' }
    }
  }

  // Coluna 5 (indice 4) - observacoes, fonte secundaria via regex
  const colObs = linha[4]
  if (colObs && String(colObs).trim()) {
    const obs = String(colObs)

    // Regex 1: ENDERECO: seguido de qualquer conteudo ate \n\n, \nMAIUSCULA: ou fim
    const m1 = obs.match(/ENDERECO:[^0-9a-zA-Z]*([\s\S]+?)(?:\n\n|\n[A-Z0-9]+:|$)/i)
    if (m1) {
      let addr = m1[1].trim()
      addr = limparEndereco(addr)
      if (addr) {
        return { endereco: addr, fonte: 'observacoes-regex' }
      }
    }

    // Regex 2 (fallback): ENDERECO: seguido de numero + CEP formato #####-###
    const m2 = obs.match(/ENDERECO:[^0-9]*(\d+.*?\d{5}-\d{3})/i)
    if (m2) {
      let addr = m2[1].trim()
      addr = limparEndereco(addr)
      if (addr) {
        return { endereco: addr, fonte: 'observacoes-regex' }
      }
    }
  }

  return null
}

/**
 * Limpa e normaliza o endereco.
 * Remove quebras de linha, espacos duplicados, virgulas multiplas.
 * Remove prefixo ENDERECO: se presente.
 */
function limparEndereco(addr: string): string {
  let limpo = addr
    .replace(/\n/g, ', ')
    .replace(/\s+/g, ' ')
    .replace(/,+/g, ',')
    .trim()

  if (limpo.toUpperCase().startsWith('ENDERECO:')) {
    limpo = limpo.substring(9).trim()
  }

  return limpo
}

/**
 * Extrai CEP do endereco usando regex.
 * Retorna CEP com 8 digitos (sem hifen) ou null.
 */
function extrairCep(endereco: string): string | null {
  const m = endereco.match(/\b(\d{5})-?(\d{3})\b/)
  if (m) {
    return m[1] + m[2]
  }
  return null
}

/**
 * Normaliza o endereco para usar como chave no cache.
 * Remove espacos extras, converte para lowercase, normaliza espacos apos virgula.
 */
export function normalizarChaveEnderecoAgendaV2(endereco: string): string {
  return endereco
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/,\s*/g, ', ') // virgula seguida de espaco unico
    .replace(/,\s+,/g, ',') // remove virgulas duplas
    .trim()
}

// ─── Funcao principal ───────────────────────────────────────────────────────

/**
 * Parser puro de linhas da planilha AGENDA (shAg) para pontos de agenda.
 *
 * Regras (fiel ao coletarPontosDoDia do CEP-CONFIG.gs):
 *   - Filtra por dataAlvoISO (compara YYYY-MM-DD)
 *   - Filtra por equipeAlvo (apos normalizarEquipe)
 *   - Extrai endereco da coluna 6 ou via regex em observacoes (coluna 5)
 *   - Coordenadas vem de cacheCoordenadasPorEndereco (sem geocoding)
 *   - Extrai CEP por regex
 *   - Pontos sem coordenadas sao descartados com motivo (nao silencioso)
 *   - Pontos sem endereco sao descartados
 *   - Preserva indice da linha original para auditoria
 *
 * Nao faz:
 *   - Nao le planilha, nao chama Google Sheets
 *   - Nao geocodifica (recebe coordenadas via cache)
 *   - Nao chama Supabase, OSRM, Apps Script
 *   - Nao muta o input
 */
export function parsearPontosAgendaDoDiaV2(
  input: ParsearPontosAgendaDoDiaV2Input
): ParsearPontosAgendaDoDiaV2Output {
  const pontos: PontoAgendaV2[] = []
  const descartados: PontoAgendaDescartadoV2[] = []
  const avisos: string[] = []
  const erros: string[] = []

  let linhasDaData = 0
  let linhasDaEquipe = 0
  let semEndereco = 0
  let semCoordenadas = 0

  const cache = input.cacheCoordenadasPorEndereco ?? {}

  for (let i = 0; i < input.linhasAgenda.length; i++) {
    const linha = input.linhasAgenda[i]

    // Verifica se linha tem pelo menos 7 colunas
    if (!Array.isArray(linha) || linha.length < 7) {
      descartados.push({
        indiceLinhaOriginal: i,
        motivo: 'linha_incompleta',
        descricao: `Linha nao e array ou tem menos de 7 colunas (tem: ${Array.isArray(linha) ? linha.length : 'nao-array'})`,
        dadosBrutos: { data: linha?.[0], titulo: linha?.[2], observacoes: linha?.[4], endereco: linha?.[5], equipe: linha?.[6] },
      })
      continue
    }

    // Extrai e normaliza data
    const dataRaw = linha[0]
    const dataISO = normalizarDataParaISO(dataRaw)

    if (!dataISO) {
      descartados.push({
        indiceLinhaOriginal: i,
        motivo: 'data_invalida',
        descricao: `Nao foi possivel parsear data: ${JSON.stringify(dataRaw)}`,
        dadosBrutos: { data: dataRaw, titulo: linha[2], observacoes: linha[4], endereco: linha[5], equipe: linha[6] },
      })
      continue
    }

    // Filtra por data
    if (dataISO !== input.dataAlvoISO) {
      continue // Nao conta como descarte, apenas ignora (outro dia)
    }
    linhasDaData++

    // Extrai e normaliza equipe
    const equipeRaw = linha[6]
    const equipe = normalizarEquipe(equipeRaw)

    if (!equipe) {
      descartados.push({
        indiceLinhaOriginal: i,
        motivo: 'equipe_invalida',
        descricao: `Equipe nao reconhecida: ${JSON.stringify(equipeRaw)}`,
        dadosBrutos: { data: dataRaw, titulo: linha[2], observacoes: linha[4], endereco: linha[5], equipe: equipeRaw },
      })
      continue
    }

    // Filtra por equipe
    if (equipe !== input.equipeAlvo) {
      continue // Nao conta como descarte, apenas ignora (outra equipe)
    }
    linhasDaEquipe++

    // Extrai endereco
    const extracao = extrairEnderecoAgendaShAgV2(linha)

    if (!extracao) {
      semEndereco++
      descartados.push({
        indiceLinhaOriginal: i,
        motivo: 'sem_endereco',
        descricao: 'Coluna 6 vazia e regex em observacoes nao encontrou ENDERECO:',
        dadosBrutos: { data: dataRaw, titulo: linha[2], observacoes: linha[4], endereco: linha[5], equipe: equipeRaw },
      })
      continue
    }

    const { endereco, fonte: fonteEndereco } = extracao

    // Extrai CEP do endereco
    const cep = extrairCep(endereco)
    const fonteCep: FonteCepAgendaV2 = cep ? 'regex-endereco' : 'ausente'

    // Busca coordenadas no cache injetado
    const chaveCache = normalizarChaveEnderecoAgendaV2(endereco)
    const coordenadas = cache[chaveCache]

    if (!coordenadas) {
      semCoordenadas++
      descartados.push({
        indiceLinhaOriginal: i,
        motivo: 'sem_coordenadas_cache',
        descricao: `Endereco nao encontrado no cache injetado: "${endereco}" (chave: "${chaveCache}")`,
        dadosBrutos: { data: dataRaw, titulo: linha[2], observacoes: linha[4], endereco: linha[5], equipe: equipeRaw },
      })
      continue
    }

    // Extrai titulo do evento
    const tituloRaw = linha[2]
    const tituloEvento = tituloRaw && String(tituloRaw).trim() ? String(tituloRaw).trim() : null

    // Ponto valido - adiciona
    pontos.push({
      dataISO,
      equipe,
      tituloEvento,
      endereco,
      fonteEndereco,
      coordenadas,
      cep,
      fonteCep,
      indiceLinhaOriginal: i,
    })
  }

  const resumo: ResumoParseAgendaV2 = {
    linhasRecebidas: input.linhasAgenda.length,
    linhasDaData,
    linhasDaEquipe,
    pontosValidos: pontos.length,
    pontosDescartados: descartados.length,
    semEndereco,
    semCoordenadas,
  }

  // Avisos informativos
  if (semEndereco > 0) {
    avisos.push(`${semEndereco} ponto(s) descartado(s) por falta de endereco (coluna 6 vazia e sem ENDERECO: nas observacoes)`)
  }
  if (semCoordenadas > 0) {
    avisos.push(`${semCoordenadas} ponto(s) descartado(s) por falta de coordenadas no cache injetado`)
  }
  if (pontos.length === 0 && input.linhasAgenda.length > 0) {
    avisos.push('Nenhum ponto valido encontrado para a data/equipe solicitada')
  }

  const ok = pontos.length > 0 || (input.linhasAgenda.length === 0)

  return {
    ok,
    pontos,
    descartados,
    avisos,
    erros,
    resumo,
  }
}
