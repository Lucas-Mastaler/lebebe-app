// ─────────────────────────────────────────────────────────────────────────────
// motor/disponibilidade.ts  —  Filtro puro de disponibilidade por equipe/data (sem I/O)
//
// Recebe janela bruta de datas e disponibilidades sintéticas por equipe,
// retorna janela enriquecida com flags de suficiência, sem consultar planilha.
//
// NÃO FAZ:
//   - Consulta agenda, planilha, Supabase, OSRM, Apps Script, Google Calendar
//   - Nenhuma alteração em APIs existentes ou frontend
//   - Não gera candidatos finais nem aplica ranking
// ─────────────────────────────────────────────────────────────────────────────

import { normalizarEquipe } from './equipe'
import type { DataJanelaPesquisaV2 } from './janela-datas'

// ─── Tipos ───────────────────────────────────────────────────────────────────

/** Disponibilidade bruta de uma equipe em uma data (sintética ou real). */
export interface DisponibilidadeEquipeDataV2 {
  dataISO: string
  equipe: string
  disponivelMin: number
  /** Tempo já consumido no dia, conforme a fonte oficial de disponibilidade. */
  tempoUtilizadoMin?: number | null
  /** Capacidade oficial derivada da própria linha (utilizado + disponível). */
  capacidadeTotalMin?: number | null
  ativa?: boolean
  motivoIndisponibilidade?: string | null
}

/** Equipe disponível enriquecida com análise de suficiência. */
export interface EquipeDisponivelV2 {
  equipe: string
  disponivelMin: number
  suficienteParaServico: boolean
  ativa: boolean
  motivoIndisponibilidade: string | null
}

/** Data da janela enriquecida com equipes disponíveis. */
export interface DataDisponivelV2 {
  dataISO: string
  indice: number
  diaSemana: number
  ehSabado: boolean
  ehDomingo: boolean
  equipes: EquipeDisponivelV2[]
}

/** Entrada para filtragem de disponibilidade. */
export interface FiltrarDisponibilidadePorJanelaV2Input {
  janela: DataJanelaPesquisaV2[]
  disponibilidades: DisponibilidadeEquipeDataV2[]
  tempoNecessarioMin: number | null
}

/** Resultado da filtragem de disponibilidade. */
export interface DisponibilidadeJanelaV2 {
  ok: boolean
  datas: DataDisponivelV2[]
  avisos: string[]
}

// ─── Função principal ────────────────────────────────────────────────────────

/**
 * Filtra e enriquece disponibilidades por equipe dentro da janela de datas.
 *
 * Regras:
 *   - Janela vazia → ok: false
 *   - Agrupa disponibilidades por dataISO
 *   - Normaliza equipe via normalizarEquipe()
 *   - Ignora equipes que não normalizam (com aviso)
 *   - Equipe inativa aparece no resultado com suficienteParaServico: false
 *   - suficienteParaServico = disponivelMin >= tempoNecessarioMin (quando tempo válido)
 *   - tempoNecessarioMin: null → suficienteParaServico: false + aviso
 *   - Datas sem disponibilidade aparecem com equipes: []
 *   - Ordem cronológica preservada; equipes ordenadas por nome
 *   - Duplicidade de mesma equipe/data: mantém maior disponivelMin + aviso
 *   - Disponibilidades fora da janela são ignoradas (com aviso se houver)
 *
 * Não lança erros. Problemas são sinalizados via `avisos`.
 * Não muta os objetos de entrada.
 * Totalmente determinístico — sem I/O, sem logs.
 */
export function filtrarDisponibilidadePorJanelaV2(
  input: FiltrarDisponibilidadePorJanelaV2Input
): DisponibilidadeJanelaV2 {
  const avisos: string[] = []

  // 1. Validar janela
  if (!input.janela || input.janela.length === 0) {
    return {
      ok: false,
      datas: [],
      avisos: ['Janela de datas vazia.'],
    }
  }

  // 2. Construir conjunto de datas da janela para lookup O(1)
  const datasDaJanela = new Set(input.janela.map((d) => d.dataISO))

  // 3. Agrupar disponibilidades por dataISO (ignorando equipes inválidas e datas fora da janela)
  const porData = new Map<string, Map<string, { maxMin: number; ativa: boolean; motivo: string | null; duplicado: boolean }>>()

  for (const disp of input.disponibilidades) {
    // Ignorar disponibilidades fora da janela
    if (!datasDaJanela.has(disp.dataISO)) {
      continue
    }

    const equipeNormalizada = normalizarEquipe(disp.equipe)
    if (!equipeNormalizada) {
      avisos.push(`Equipe "${disp.equipe}" ignorada — não foi possível normalizar.`)
      continue
    }

    if (!porData.has(disp.dataISO)) {
      porData.set(disp.dataISO, new Map())
    }

    const porEquipe = porData.get(disp.dataISO)!

    if (porEquipe.has(equipeNormalizada)) {
      // Duplicidade: manter maior disponivelMin
      const existente = porEquipe.get(equipeNormalizada)!
      if (disp.disponivelMin > existente.maxMin) {
        existente.maxMin = disp.disponivelMin
      }
      // Se algum registro marcar inativa, marca inativa
      if (disp.ativa === false) {
        existente.ativa = false
      }
      existente.duplicado = true
    } else {
      porEquipe.set(equipeNormalizada, {
        maxMin: disp.disponivelMin,
        ativa: disp.ativa !== false, // default true se ausente
        motivo: disp.motivoIndisponibilidade ?? null,
        duplicado: false,
      })
    }
  }

  if (porData.size === 0) {
    avisos.push('Nenhuma disponibilidade válida encontrada para as datas da janela.')
  }

  // 4. Montar resultado preservando ordem da janela
  const datas: DataDisponivelV2[] = []

  const tempoNulo = input.tempoNecessarioMin === null || !Number.isFinite(input.tempoNecessarioMin)
  if (tempoNulo) {
    avisos.push('Tempo necessário ausente ou inválido. Todas as equipes serão marcadas como insuficientes.')
  }

  const tempoMin = tempoNulo ? 0 : input.tempoNecessarioMin!

  for (const dia of input.janela) {
    const equipesMap = porData.get(dia.dataISO)
    const equipes: EquipeDisponivelV2[] = []

    if (equipesMap) {
      // Ordenar por nome de equipe
      const equipesOrdenadas = Array.from(equipesMap.entries()).sort((a, b) =>
        a[0].localeCompare(b[0])
      )

      for (const [nome, info] of equipesOrdenadas) {
        const suficiente = !tempoNulo && info.ativa && info.maxMin >= tempoMin

        equipes.push({
          equipe: nome,
          disponivelMin: info.maxMin,
          suficienteParaServico: suficiente,
          ativa: info.ativa,
          motivoIndisponibilidade: info.motivo,
        })
      }

      // Aviso de duplicidade
      for (const [nome, info] of equipesOrdenadas) {
        if (info.duplicado) {
          avisos.push(`Duplicidade detectada para ${nome} em ${dia.dataISO}. Usado maior disponivelMin.`)
        }
      }
    }

    datas.push({
      dataISO: dia.dataISO,
      indice: dia.indice,
      diaSemana: dia.diaSemana,
      ehSabado: dia.ehSabado,
      ehDomingo: dia.ehDomingo,
      equipes,
    })
  }

  return {
    ok: true,
    datas,
    avisos,
  }
}
