// ─────────────────────────────────────────────────────────────────────────────
// motor/janela-datas.ts  —  Geração pura da janela bruta de datas (sem I/O)
//
// Recebe data inicial (YYYY-MM-DD) e quantidade de dias de pesquisa,
// retorna lista cronológica de datas com flags de sábado/domingo.
//
// NÃO FAZ:
//   - Consulta agenda, disponibilidade, ranking, OSRM, Supabase, Apps Script
//   - Nenhuma alteração em APIs existentes ou frontend
//   - Não filtra candidatos finais
// ─────────────────────────────────────────────────────────────────────────────

// ─── Tipos ───────────────────────────────────────────────────────────────────

/** Entrada para geração da janela de datas. */
export interface GerarJanelaDatasPesquisaV2Input {
  dataInicialISO: string | null
  diasPesquisaAgenda: number
}

/** Item individual da janela de datas. */
export interface DataJanelaPesquisaV2 {
  dataISO: string
  indice: number
  diaSemana: number
  ehSabado: boolean
  ehDomingo: boolean
}

/** Resultado da geração da janela de datas. */
export interface JanelaDatasPesquisaV2 {
  ok: boolean
  datas: DataJanelaPesquisaV2[]
  avisos: string[]
}

// ─── Constantes ──────────────────────────────────────────────────────────────

const LIMITE_MAXIMO_DIAS = 180
const REGEX_DATA_ISO = /^(\d{4})-(\d{2})-(\d{2})$/

// ─── Função principal ────────────────────────────────────────────────────────

/**
 * Gera uma janela cronológica de datas a partir da data inicial.
 *
 * Regras:
 *   - dataInicialISO deve estar no formato YYYY-MM-DD
 *   - diasPesquisaAgenda deve ser um inteiro > 0
 *   - Limite máximo de segurança: 180 dias
 *   - Decimais são arredondados para baixo
 *   - A data inicial é incluída com índice 0
 *   - Cada item marca ehSabado (diaSemana === 6) e ehDomingo (diaSemana === 0)
 *   - Ordem é estritamente cronológica
 *
 * Não lança erros. Campos problemáticos são sinalizados via `avisos`.
 * Não muta o objeto de entrada.
 * Totalmente determinístico — usa UTC para evitar deslocamento por timezone.
 */
export function gerarJanelaDatasPesquisaV2(
  input: GerarJanelaDatasPesquisaV2Input
): JanelaDatasPesquisaV2 {
  const avisos: string[] = []

  // 1. Validar data inicial
  if (!input.dataInicialISO || typeof input.dataInicialISO !== 'string') {
    return {
      ok: false,
      datas: [],
      avisos: ['Data inicial ausente.'],
    }
  }

  const match = input.dataInicialISO.match(REGEX_DATA_ISO)
  if (!match) {
    return {
      ok: false,
      datas: [],
      avisos: ['Data inicial inválida. Use formato YYYY-MM-DD.'],
    }
  }

  const ano = Number(match[1])
  const mes = Number(match[2])
  const dia = Number(match[3])

  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) {
    return {
      ok: false,
      datas: [],
      avisos: ['Data inicial inválida.'],
    }
  }

  // 2. Validar quantidade de dias
  let dias = input.diasPesquisaAgenda

  if (!Number.isFinite(dias) || dias <= 0) {
    return {
      ok: false,
      datas: [],
      avisos: ['Quantidade de dias deve ser maior que zero.'],
    }
  }

  if (!Number.isInteger(dias)) {
    dias = Math.floor(dias)
    avisos.push('Quantidade de dias decimal foi arredondada para baixo.')
  }

  if (dias > LIMITE_MAXIMO_DIAS) {
    dias = LIMITE_MAXIMO_DIAS
    avisos.push(`Quantidade de dias limitada a ${LIMITE_MAXIMO_DIAS} para segurança.`)
  }

  // 3. Gerar datas (uso de UTC para evitar deslocamento por timezone)
  const datas: DataJanelaPesquisaV2[] = []

  for (let i = 0; i < dias; i++) {
    const d = new Date(Date.UTC(ano, mes - 1, dia + i))
    const y = d.getUTCFullYear()
    const m = d.getUTCMonth() + 1
    const dd = d.getUTCDate()
    const dataISO = `${y}-${String(m).padStart(2, '0')}-${String(dd).padStart(2, '0')}`
    const diaSemana = d.getUTCDay()

    datas.push({
      dataISO,
      indice: i,
      diaSemana,
      ehSabado: diaSemana === 6,
      ehDomingo: diaSemana === 0,
    })
  }

  return {
    ok: true,
    datas,
    avisos,
  }
}
