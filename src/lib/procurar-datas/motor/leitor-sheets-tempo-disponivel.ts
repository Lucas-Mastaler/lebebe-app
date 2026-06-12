// ─────────────────────────────────────────────────────────────────────────────
// motor/leitor-sheets-tempo-disponivel.ts
//   Helper puro: converte matriz tabular (string[][]) da planilha TEMPO DISPONIVEL
//   em LinhaTempoDisponivelV2[] compatível com parsearDisponibilidadeTempoDisponivelV2.
//
// Colunas esperadas (cabeçalho confirmado):
//   DATA | EQUIPE | TEMPO UTILIZADO | TEMPO DISPONÍVEL | TEMPO EXCEDIDO | STATUS
//
// NÃO FAZ:
//   - Não lê Google Sheets
//   - Não chama Apps Script, Supabase, OSRM ou qualquer I/O
//   - Não muta a entrada
//   - Não cria rota
// ─────────────────────────────────────────────────────────────────────────────

import type { LinhaTempoDisponivelV2 } from './parse-disponibilidade-tempo-disponivel'

// ─── Constantes de cabeçalho ──────────────────────────────────────────────────

/** Índices esperados das colunas (0-based). Usados para mapear a matriz. */
export const COLUNAS_TEMPO_DISPONIVEL = {
  DATA: 0,
  EQUIPE: 1,
  TEMPO_UTILIZADO: 2,
  TEMPO_DISPONIVEL: 3,
  TEMPO_EXCEDIDO: 4,
  STATUS: 5,
} as const

/** Nomes canônicos de cabeçalho da planilha TEMPO DISPONIVEL (confirmados). */
export const CABECALHO_ESPERADO: ReadonlyArray<string> = [
  'DATA',
  'EQUIPE',
  'TEMPO UTILIZADO',
  'TEMPO DISPONÍVEL',
  'TEMPO EXCEDIDO',
  'STATUS',
]

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type ConverterTabelaTempoDisponivelOutput = {
  linhas: LinhaTempoDisponivelV2[]
  cabecalhoEncontrado: string[]
  cabecalhoReconhecido: boolean
  linhasLidas: number
  linhasConvertidas: number
  avisos: string[]
}

// ─── Helpers internos ─────────────────────────────────────────────────────────

/**
 * Normaliza string de cabeçalho para comparação: uppercase, sem acentos, trim.
 * Ex: "Tempo Disponível" → "TEMPO DISPONIVEL"
 */
function normalizarCabecalho(s: string): string {
  return s
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

/**
 * Verifica se uma linha de cabeçalho corresponde às colunas esperadas (tolerante a acento/case).
 */
function detectarCabecalho(linha: string[]): boolean {
  if (linha.length < 4) return false
  const normalizado = linha.map(normalizarCabecalho)
  return (
    normalizado[COLUNAS_TEMPO_DISPONIVEL.DATA].includes('DATA') &&
    normalizado[COLUNAS_TEMPO_DISPONIVEL.EQUIPE].includes('EQUIPE') &&
    (normalizado[COLUNAS_TEMPO_DISPONIVEL.TEMPO_DISPONIVEL].includes('DISPONIVEL') ||
      normalizado[COLUNAS_TEMPO_DISPONIVEL.TEMPO_DISPONIVEL].includes('DISPONÍVEL'))
  )
}

// ─── Função principal ─────────────────────────────────────────────────────────

/**
 * Converte a matriz tabular retornada pela Sheets API v4 (array de arrays de strings)
 * para LinhaTempoDisponivelV2[].
 *
 * Regras:
 *   - A primeira linha é tratada como cabeçalho e ignorada como dado.
 *   - Linhas com menos de 4 colunas são ignoradas.
 *   - Colunas ausentes resultam em string vazia (não lança erro).
 *   - Não muta a entrada.
 *   - Sem I/O.
 */
export function converterTabelaTempoDisponivel(
  tabela: string[][]
): ConverterTabelaTempoDisponivelOutput {
  const avisos: string[] = []

  if (!Array.isArray(tabela) || tabela.length === 0) {
    return {
      linhas: [],
      cabecalhoEncontrado: [],
      cabecalhoReconhecido: false,
      linhasLidas: 0,
      linhasConvertidas: 0,
      avisos: ['Tabela vazia ou não é um array.'],
    }
  }

  const primeiraLinha = tabela[0].map((c) => String(c ?? '').trim())
  const cabecalhoReconhecido = detectarCabecalho(primeiraLinha)

  if (!cabecalhoReconhecido) {
    avisos.push(
      `Cabeçalho não reconhecido: [${primeiraLinha.join(' | ')}]. Esperado: [${CABECALHO_ESPERADO.join(' | ')}]. Conversão continuará com mapeamento por índice.`
    )
  }

  // Linhas de dados: pular cabeçalho (índice 0)
  const linhasDados = tabela.slice(1)
  const linhas: LinhaTempoDisponivelV2[] = []

  for (const linha of linhasDados) {
    const cel = (idx: number): string => String(linha[idx] ?? '').trim()

    linhas.push({
      data: cel(COLUNAS_TEMPO_DISPONIVEL.DATA),
      equipe: cel(COLUNAS_TEMPO_DISPONIVEL.EQUIPE),
      tempoUtilizado: cel(COLUNAS_TEMPO_DISPONIVEL.TEMPO_UTILIZADO),
      tempoDisponivel: cel(COLUNAS_TEMPO_DISPONIVEL.TEMPO_DISPONIVEL),
      tempoExcedido: cel(COLUNAS_TEMPO_DISPONIVEL.TEMPO_EXCEDIDO),
      status: cel(COLUNAS_TEMPO_DISPONIVEL.STATUS),
    })
  }

  return {
    linhas,
    cabecalhoEncontrado: primeiraLinha,
    cabecalhoReconhecido,
    linhasLidas: linhasDados.length,
    linhasConvertidas: linhas.length,
    avisos,
  }
}
