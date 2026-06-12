// ─────────────────────────────────────────────────────────────────────────────
// motor/parse-disponibilidade-tempo-disponivel.ts
//   Parser puro de linhas da planilha TEMPO DISPONIVEL → DisponibilidadeEquipeDataV2[]
//
// Converte linhas brutas (formato confirmado: DD/MM/YYYY, HH:MM, status texto)
// para o tipo DisponibilidadeEquipeDataV2 consumido por filtrarDisponibilidadePorJanelaV2.
//
// Colunas da planilha real (confirmadas):
//   DATA | EQUIPE | TEMPO UTILIZADO | TEMPO DISPONÍVEL | TEMPO EXCEDIDO | STATUS
//
// NÃO FAZ:
//   - Leitura de planilha, Google Sheets, Apps Script, Supabase, OSRM, Google Calendar
//   - Nenhuma chamada externa ou I/O
//   - Não muta o input
//   - Não cria rota nem integra na rota diagnóstica v2
// ─────────────────────────────────────────────────────────────────────────────

import { normalizarEquipe } from './equipe'
import { parseMinutos } from './tempo'
import type { DisponibilidadeEquipeDataV2 } from './disponibilidade'

// ─── Tipos de entrada ─────────────────────────────────────────────────────────

/** Linha bruta da planilha TEMPO DISPONIVEL. Todos os campos são unknown para aceitar qualquer valor retornado pelo Sheets. */
export type LinhaTempoDisponivelV2 = {
  data: unknown
  equipe: unknown
  tempoUtilizado?: unknown
  tempoDisponivel: unknown
  tempoExcedido?: unknown
  status?: unknown
}

export type ParsearDisponibilidadeTempoDisponivelV2Input = {
  linhas: LinhaTempoDisponivelV2[]
}

// ─── Tipos de saída ───────────────────────────────────────────────────────────

export type ParsearDisponibilidadeTempoDisponivelV2Resumo = {
  linhasRecebidas: number
  linhasValidas: number
  linhasIgnoradas: number
  disponiveis: number
  agendasFechadas: number
  excedidas: number
}

export type ParsearDisponibilidadeTempoDisponivelV2Output = {
  ok: boolean
  disponibilidades: DisponibilidadeEquipeDataV2[]
  avisos: string[]
  erros: string[]
  resumo: ParsearDisponibilidadeTempoDisponivelV2Resumo
}

// ─── Helpers internos ─────────────────────────────────────────────────────────

/**
 * Converte data no formato DD/MM/YYYY para YYYY-MM-DD.
 * Aceita também Date objects (fonte secundária).
 * Não usa new Date("DD/MM/YYYY") para evitar inversão de mês/dia entre ambientes.
 * Retorna null se o formato for inválido.
 */
function parsearDataDDMMYYYY(input: unknown): string | null {
  if (typeof input === 'string') {
    const m = input.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
    if (m) {
      const dd = m[1]
      const mm = m[2]
      const yyyy = m[3]
      const d = Number(dd)
      const mo = Number(mm)
      const y = Number(yyyy)
      if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31 && y >= 1000 && y <= 9999) {
        return `${yyyy}-${mm}-${dd}`
      }
    }
    return null
  }

  if (input instanceof Date && !isNaN(input.getTime())) {
    const y = input.getFullYear()
    const m = String(input.getMonth() + 1).padStart(2, '0')
    const d = String(input.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }

  return null
}

/**
 * Verifica se o campo tempoDisponivel tem formato aceito para parse.
 * Aceita: string "HH:MM" ou "H:MM", Date object, number >= 0.
 * Rejeita: texto livre, null, undefined, string vazia, boolean.
 */
function validarTempoDisponivel(input: unknown): boolean {
  if (input instanceof Date) return !isNaN(input.getTime())
  if (typeof input === 'number') return Number.isFinite(input) && input >= 0
  if (typeof input === 'string') return /^\d{1,2}:\d{2}$/.test(input.trim())
  return false
}

/**
 * Normaliza texto de status para comparação: lowercase + sem acentos.
 * Ex: "Disponível" → "disponivel", "AGENDA FECHADA" → "agenda fechada".
 */
function normalizarTextoStatus(input: unknown): string {
  return String(input ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

type StatusParsed = {
  ativa: boolean
  motivoIndisponibilidade: string | null
  aviso: string | null
}

/**
 * Converte o campo STATUS em ativa/motivoIndisponibilidade.
 * Status reconhecidos: "disponível", "agenda fechada", "excedeu".
 * Status vazio: derivado de disponivelMin.
 */
function parsearStatusLinha(statusRaw: unknown, disponivelMin: number, idx: number): StatusParsed {
  const s = normalizarTextoStatus(statusRaw)

  if (s === 'disponivel') {
    return { ativa: true, motivoIndisponibilidade: null, aviso: null }
  }

  if (s === 'agenda fechada') {
    return { ativa: false, motivoIndisponibilidade: 'agenda fechada', aviso: null }
  }

  if (s === 'excedeu') {
    return { ativa: false, motivoIndisponibilidade: 'excedeu', aviso: null }
  }

  if (s === '') {
    if (disponivelMin > 0) {
      return {
        ativa: true,
        motivoIndisponibilidade: null,
        aviso: `Linha ${idx}: status ausente com tempo disponível > 0 — considerada ativa.`,
      }
    }
    return {
      ativa: false,
      motivoIndisponibilidade: 'sem tempo disponível',
      aviso: `Linha ${idx}: status ausente com tempo disponível = 0 — considerada inativa.`,
    }
  }

  return {
    ativa: false,
    motivoIndisponibilidade: s,
    aviso: `Linha ${idx}: status desconhecido "${String(statusRaw ?? '')}" — considerada inativa.`,
  }
}

/**
 * Retorna true se os três campos essenciais da linha são todos vazios.
 * Linhas completamente vazias são ignoradas sem registrar erro.
 */
function isLinhaVazia(linha: LinhaTempoDisponivelV2): boolean {
  const semData =
    linha.data === null || linha.data === undefined || String(linha.data).trim() === ''
  const semEquipe =
    linha.equipe === null || linha.equipe === undefined || String(linha.equipe).trim() === ''
  const semTempo =
    linha.tempoDisponivel === null ||
    linha.tempoDisponivel === undefined ||
    String(linha.tempoDisponivel).trim() === ''
  return semData && semEquipe && semTempo
}

// ─── Função principal ─────────────────────────────────────────────────────────

/**
 * Converte linhas brutas da planilha TEMPO DISPONIVEL em DisponibilidadeEquipeDataV2[].
 *
 * Regras:
 *   - Data no formato DD/MM/YYYY (principal) ou Date object (secundário)
 *   - Equipe via normalizarEquipe() — EQUIPE 1 ou EQUIPE 2
 *   - Tempo disponível: string "HH:MM", Date ou number (fração de dia)
 *   - Status: "disponível" | "agenda fechada" | "excedeu" | vazio (derivado do tempo)
 *   - Linhas completamente vazias: ignoradas sem erro
 *   - Linhas com campo inválido: ignoradas com registro em erros[]
 *   - Duplicidade dataISO+equipe: mantém maior disponivelMin, aviso em avisos[]
 *   - Ordem de entrada preservada
 *   - Não muta input
 *   - Sem I/O externo
 */
export function parsearDisponibilidadeTempoDisponivelV2(
  input: ParsearDisponibilidadeTempoDisponivelV2Input
): ParsearDisponibilidadeTempoDisponivelV2Output {
  const avisos: string[] = []
  const erros: string[] = []

  if (!Array.isArray(input.linhas)) {
    return {
      ok: false,
      disponibilidades: [],
      avisos: [],
      erros: ['Campo "linhas" ausente ou não é um array.'],
      resumo: {
        linhasRecebidas: 0,
        linhasValidas: 0,
        linhasIgnoradas: 0,
        disponiveis: 0,
        agendasFechadas: 0,
        excedidas: 0,
      },
    }
  }

  let linhasIgnoradas = 0
  let linhasValidas = 0

  const mapaDedup = new Map<string, DisponibilidadeEquipeDataV2>()

  for (let i = 0; i < input.linhas.length; i++) {
    const linha = input.linhas[i]
    const idx = i + 1

    if (isLinhaVazia(linha)) {
      linhasIgnoradas++
      continue
    }

    const dataISO = parsearDataDDMMYYYY(linha.data)
    if (dataISO === null) {
      erros.push(`Linha ${idx}: data inválida — "${String(linha.data ?? '')}"`)
      linhasIgnoradas++
      continue
    }

    const equipe = normalizarEquipe(linha.equipe)
    if (equipe === null) {
      erros.push(`Linha ${idx}: equipe inválida — "${String(linha.equipe ?? '')}"`)
      linhasIgnoradas++
      continue
    }

    if (!validarTempoDisponivel(linha.tempoDisponivel)) {
      erros.push(`Linha ${idx}: tempo disponível inválido — "${String(linha.tempoDisponivel ?? '')}"`)
      linhasIgnoradas++
      continue
    }
    const disponivelMin = parseMinutos(linha.tempoDisponivel)

    const statusParsed = parsearStatusLinha(linha.status, disponivelMin, idx)
    if (statusParsed.aviso) avisos.push(statusParsed.aviso)

    linhasValidas++

    const key = `${dataISO}|${equipe}`
    const existente = mapaDedup.get(key)

    if (existente !== undefined) {
      avisos.push(
        `Linha ${idx}: duplicidade detectada para ${equipe} em ${dataISO}. Mantido maior disponivelMin.`
      )
      if (disponivelMin > existente.disponivelMin) {
        mapaDedup.set(key, {
          dataISO,
          equipe,
          disponivelMin,
          ativa: statusParsed.ativa,
          motivoIndisponibilidade: statusParsed.motivoIndisponibilidade,
        })
      }
    } else {
      mapaDedup.set(key, {
        dataISO,
        equipe,
        disponivelMin,
        ativa: statusParsed.ativa,
        motivoIndisponibilidade: statusParsed.motivoIndisponibilidade,
      })
    }
  }

  const disponibilidades = Array.from(mapaDedup.values())

  const disponiveis = disponibilidades.filter((d) => d.ativa).length
  const agendasFechadas = disponibilidades.filter(
    (d) => d.motivoIndisponibilidade === 'agenda fechada'
  ).length
  const excedidas = disponibilidades.filter(
    (d) => d.motivoIndisponibilidade === 'excedeu'
  ).length

  return {
    ok: true,
    disponibilidades,
    avisos,
    erros,
    resumo: {
      linhasRecebidas: input.linhas.length,
      linhasValidas,
      linhasIgnoradas,
      disponiveis,
      agendasFechadas,
      excedidas,
    },
  }
}
