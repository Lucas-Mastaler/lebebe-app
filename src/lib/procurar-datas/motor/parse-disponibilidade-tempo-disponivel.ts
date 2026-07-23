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
  /** Data de referência no formato YYYY-MM-DD. Usada para inferir o ano quando a planilha retorna datas sem ano (DD/MM ou DD/MM (texto)). Se omitida e uma linha vier sem ano, a linha será ignorada com erro. */
  dataInicialISO?: string
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
 * Valida se uma data YYYY-MM-DD é real (inclui bissexto).
 * Usa construção manual sem ambiguidade de timezone.
 */
function isDataValida(yyyy: number, mm: number, dd: number): boolean {
  if (mm < 1 || mm > 12) return false
  if (dd < 1 || dd > 31) return false
  const diasPorMes = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  const ehBissexto = (yyyy % 4 === 0 && yyyy % 100 !== 0) || (yyyy % 400 === 0)
  const maxDias = mm === 2 && ehBissexto ? 29 : diasPorMes[mm - 1]
  return dd <= maxDias
}

/**
 * Converte data para YYYY-MM-DD. Suporta:
 *   - DD/MM/YYYY → retorna direto (ano informado)
 *   - DD/MM ou DD/MM (texto) → extrai DD/MM, usa dataInicialISO para inferir ano
 *   - Date object → fonte secundária
 *
 * Regras de inferência de ano (quando DD/MM sem ano):
 *   1. Usa o ano de dataInicialISO.
 *   2. Monta candidata YYYY-MM-DD.
 *   3. Se candidata < dataInicialISO, usa ano seguinte.
 *   4. Se dataInicialISO ausente → retorna null (erro controlado).
 */
function parsearDataCompleta(input: unknown, dataInicialISO: string | undefined): string | null {
  if (typeof input !== 'string') {
    if (input instanceof Date && !isNaN(input.getTime())) {
      const y = input.getFullYear()
      const m = String(input.getMonth() + 1).padStart(2, '0')
      const d = String(input.getDate()).padStart(2, '0')
      return `${y}-${m}-${d}`
    }
    return null
  }

  const s = input.trim()

  // ── Formato 1: DD/MM/YYYY (ano explícito) ──
  const mFull = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (mFull) {
    const dd = Number(mFull[1])
    const mm = Number(mFull[2])
    const yyyy = Number(mFull[3])
    if (isDataValida(yyyy, mm, dd)) {
      return `${mFull[3]}-${mFull[2]}-${mFull[1]}`
    }
    return null
  }

  // ── Formato 2: DD/MM ou DD/MM (texto) ──
  const mSemAno = s.match(/^(\d{2})\/(\d{2})(?:\s*\(.*\))?$/)
  if (mSemAno) {
    if (!dataInicialISO) return null // sem referência, não dá para inferir

    const dd = Number(mSemAno[1])
    const mm = Number(mSemAno[2])
    const refMatch = dataInicialISO.match(/^(\d{4})-(\d{2})-(\d{2})$/)
    if (!refMatch) return null

    const refYYYY = Number(refMatch[1])
    const refMM = Number(refMatch[2])
    const refDD = Number(refMatch[3])

    // Validação básica de dataInicialISO
    if (!isDataValida(refYYYY, refMM, refDD)) return null

    // Candidata com o ano de referência
    let yyyy = refYYYY
    if (!isDataValida(yyyy, mm, dd)) return null

    // Monta strings para comparação lexicográfica (YYYY-MM-DD)
    const candidata = `${String(yyyy).padStart(4, '0')}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`
    if (candidata < dataInicialISO) {
      yyyy += 1
      if (!isDataValida(yyyy, mm, dd)) return null
      return `${String(yyyy).padStart(4, '0')}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`
    }
    return candidata
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

    const dataISO = parsearDataCompleta(linha.data, input.dataInicialISO)
    if (dataISO === null) {
      const raw = String(linha.data ?? '')
      const semAno = /^\d{2}\/\d{2}(?:\s*\(.*\))?$/.test(raw.trim())
      if (semAno && !input.dataInicialISO) {
        erros.push(`Linha ${idx}: data sem ano e dataInicialISO ausente — "${raw}"`)
      } else {
        erros.push(`Linha ${idx}: data inválida — "${raw}"`)
      }
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
    const tempoUtilizadoInformado =
      linha.tempoUtilizado !== null &&
      linha.tempoUtilizado !== undefined &&
      String(linha.tempoUtilizado).trim() !== ''
    const tempoUtilizadoMin = tempoUtilizadoInformado && validarTempoDisponivel(linha.tempoUtilizado)
      ? parseMinutos(linha.tempoUtilizado)
      : null
    if (tempoUtilizadoInformado && tempoUtilizadoMin === null) {
      avisos.push(
        `Linha ${idx}: tempo utilizado inválido — consistência espacial será tratada de forma conservadora.`
      )
    }
    const capacidadeTotalMin =
      tempoUtilizadoMin === null ? null : tempoUtilizadoMin + disponivelMin

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
          tempoUtilizadoMin,
          capacidadeTotalMin,
          ativa: statusParsed.ativa,
          motivoIndisponibilidade: statusParsed.motivoIndisponibilidade,
        })
      }
    } else {
      mapaDedup.set(key, {
        dataISO,
        equipe,
        disponivelMin,
        tempoUtilizadoMin,
        capacidadeTotalMin,
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
