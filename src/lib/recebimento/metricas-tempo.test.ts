import { describe, expect, it } from 'vitest'
import {
  LIMITE_TEMPO_RECEBIMENTO_HORAS,
  calcularMetricasDeTempo,
  duracaoEmHoras,
  obterDuracaoFinalDoRecebimento,
  tempoValidoParaMetricas,
  timerCorrigidoAplicavel,
} from './metricas-tempo'

// Corte fixo só para os testes — nunca lido de CORTE_TIMER_CORRIGIDO (que
// fica null até a decisão de deploy), justamente para não depender dele.
const CORTE_TESTE = new Date('2026-06-01T00:00:00Z')

/** Recebimento "histórico": data_fim sempre antes do corte de teste. */
function historico(horasWallClock: number, timerSegundosEstranho = 0) {
  const inicio = new Date('2026-01-01T00:00:00Z')
  const fim = new Date(inicio.getTime() + horasWallClock * 60 * 60 * 1000)
  return {
    data_inicio: inicio.toISOString(),
    data_fim: fim.toISOString(),
    timer_segundos_totais: timerSegundosEstranho,
  }
}

/** Recebimento "novo": data_fim sempre depois do corte de teste. */
function novo(wallClockHoras: number, efetivoHoras: number) {
  const inicio = new Date('2026-07-01T00:00:00Z')
  const fim = new Date(inicio.getTime() + wallClockHoras * 60 * 60 * 1000)
  return {
    data_inicio: inicio.toISOString(),
    data_fim: fim.toISOString(),
    timer_segundos_totais: Math.round(efetivoHoras * 60 * 60),
  }
}

describe('tempoValidoParaMetricas', () => {
  it.each([
    [0, true],
    [7.98, true],
    [8, true],
    [11 + 59 / 60 + 59 / 3600, true],
    [LIMITE_TEMPO_RECEBIMENTO_HORAS, true],
    [LIMITE_TEMPO_RECEBIMENTO_HORAS + 1 / 3600, false],
    [13, false],
    [24, false],
  ])('%dh -> válido=%s', (horas, esperado) => {
    expect(tempoValidoParaMetricas(horas)).toBe(esperado)
  })
})

describe('duracaoEmHoras', () => {
  it('calcula a duração em horas entre duas datas', () => {
    expect(duracaoEmHoras('2026-01-01T00:00:00Z', '2026-01-01T08:00:00Z')).toBeCloseTo(8, 5)
  })
})

describe('timerCorrigidoAplicavel', () => {
  it('sem corte definido (null): nunca é aplicável, mesmo para data_fim recente', () => {
    expect(timerCorrigidoAplicavel(novo(10, 2), null)).toBe(false)
  })

  it('com corte definido: aplicável só para data_inicio a partir do corte', () => {
    expect(timerCorrigidoAplicavel(historico(6), CORTE_TESTE)).toBe(false)
    expect(timerCorrigidoAplicavel(novo(10, 2), CORTE_TESTE)).toBe(true)
  })

  it('recebimento criado ANTES do corte mas finalizado DEPOIS: continua histórico (decide por data_inicio, não data_fim)', () => {
    // Ex.: criado às 15h do dia do deploy (corte 18h), finalizado às 20h —
    // parte da vida do recebimento rodou com o timer antigo, então
    // timer_segundos_totais pode já estar contaminado. Classificar pela
    // data_fim marcaria esse caso errado como "novo confiável".
    const inicio = new Date(CORTE_TESTE.getTime() - 3 * 60 * 60 * 1000) // 3h antes do corte
    const fim = new Date(CORTE_TESTE.getTime() + 2 * 60 * 60 * 1000) // 2h depois do corte
    const recebimentoNaTransicao = {
      data_inicio: inicio.toISOString(),
      data_fim: fim.toISOString(),
      timer_segundos_totais: 999999, // valor potencialmente contaminado pelo timer antigo
    }

    expect(timerCorrigidoAplicavel(recebimentoNaTransicao, CORTE_TESTE)).toBe(false)
    // duração usada é o wall-clock (5h), não o timer_segundos_totais contaminado
    expect(obterDuracaoFinalDoRecebimento(recebimentoNaTransicao, CORTE_TESTE)).toBeCloseTo(5, 5)
  })
})

describe('obterDuracaoFinalDoRecebimento — histórico (antes do corte, ou sem corte definido)', () => {
  it('usa wall-clock (data_fim - data_inicio), nunca timer_segundos_totais', () => {
    const rec = historico(6, /* timer_segundos_totais estranho */ 999999)
    expect(obterDuracaoFinalDoRecebimento(rec, CORTE_TESTE)).toBeCloseTo(6, 5)
  })

  it('valor estranho/zerado em timer_segundos_totais não substitui silenciosamente a fonte histórica', () => {
    const contaminado = historico(6, 0) // timer nunca acumulou nada, mas isso é irrelevante para histórico
    expect(obterDuracaoFinalDoRecebimento(contaminado, CORTE_TESTE)).toBeCloseTo(6, 5)
  })

  it('sem CORTE_TIMER_CORRIGIDO definido (null): todo recebimento é tratado como histórico', () => {
    const recNovo = novo(10, 2) // data_fim recente, mas sem corte configurado
    expect(obterDuracaoFinalDoRecebimento(recNovo, null)).toBeCloseTo(10, 5) // usa wall-clock, não os 2h efetivos
  })
})

describe('obterDuracaoFinalDoRecebimento — timer novo (a partir do corte)', () => {
  it('wall-clock 10h / efetivo 2h -> métrica usa 2h', () => {
    expect(obterDuracaoFinalDoRecebimento(novo(10, 2), CORTE_TESTE)).toBeCloseTo(2, 5)
  })

  it('wall-clock 15h / efetivo 3h -> métrica usa 3h (não os 15h)', () => {
    expect(obterDuracaoFinalDoRecebimento(novo(15, 3), CORTE_TESTE)).toBeCloseTo(3, 5)
  })
})

describe('calcularMetricasDeTempo — histórico', () => {
  it('6h wall-clock entra como 6h', () => {
    const r = calcularMetricasDeTempo([historico(6)], CORTE_TESTE)
    expect(r.quantidadeValida).toBe(1)
    expect(r.tempoMedio).toBeCloseTo(6, 5)
  })

  it('exatamente 12h entra', () => {
    const r = calcularMetricasDeTempo([historico(12)], CORTE_TESTE)
    expect(r.quantidadeValida).toBe(1)
  })

  it('12h + 1s é excluído', () => {
    const r = calcularMetricasDeTempo([historico(12 + 1 / 3600)], CORTE_TESTE)
    expect(r.quantidadeValida).toBe(0)
    expect(r.quantidadeExcluida).toBe(1)
  })

  it('77h é excluído', () => {
    const r = calcularMetricasDeTempo([historico(77)], CORTE_TESTE)
    expect(r.quantidadeValida).toBe(0)
    expect(r.quantidadeExcluida).toBe(1)
  })
})

describe('calcularMetricasDeTempo — timer novo', () => {
  it('wall-clock 10h / efetivo 2h -> métrica = 2h', () => {
    const r = calcularMetricasDeTempo([novo(10, 2)], CORTE_TESTE)
    expect(r.quantidadeValida).toBe(1)
    expect(r.tempoMedio).toBeCloseTo(2, 5)
  })

  it('wall-clock 15h / efetivo 3h -> métrica = 3h e NÃO é excluído', () => {
    const r = calcularMetricasDeTempo([novo(15, 3)], CORTE_TESTE)
    expect(r.quantidadeValida).toBe(1)
    expect(r.quantidadeExcluida).toBe(0)
    expect(r.tempoMedio).toBeCloseTo(3, 5)
  })

  it('wall-clock 8h / efetivo 13h -> excluído porque o efetivo ultrapassa 12h (mesmo com wall-clock < 12h)', () => {
    const r = calcularMetricasDeTempo([novo(8, 13)], CORTE_TESTE)
    expect(r.quantidadeValida).toBe(0)
    expect(r.quantidadeExcluida).toBe(1)
  })

  it('exatamente 12h efetivas: incluído', () => {
    const r = calcularMetricasDeTempo([novo(20, 12)], CORTE_TESTE)
    expect(r.quantidadeValida).toBe(1)
  })

  it('12h + 1s efetivas: excluído', () => {
    const r = calcularMetricasDeTempo([novo(20, 12 + 1 / 3600)], CORTE_TESTE)
    expect(r.quantidadeValida).toBe(0)
    expect(r.quantidadeExcluida).toBe(1)
  })
})

describe('calcularMetricasDeTempo — mistura histórico + timer novo', () => {
  it('histórico válido (6h) + histórico contaminado (77h) + novo (efetivo 3h) + novo (efetivo 5h) => total 14h, média 14/3', () => {
    const recebimentos = [
      historico(6),
      historico(77),
      novo(15, 3),
      novo(6, 5),
    ]

    const r = calcularMetricasDeTempo(recebimentos, CORTE_TESTE)

    expect(r.quantidadeValida).toBe(3)
    expect(r.quantidadeExcluida).toBe(1)
    expect(r.tempoTotal).toBeCloseTo(14, 5)
    expect(r.tempoMedio).toBeCloseTo(14 / 3, 5)
  })
})

describe('correção manual — prioridade máxima sobre timer novo e histórico', () => {
  it('recebimento histórico com correção manual válida usa a duração manual, não o wall-clock', () => {
    // timer_segundos_totais já foi sobrescrito pela finalização com o valor manual (7h30).
    const rec = { ...historico(17), timer_segundos_totais: 7.5 * 3600, tempo_correcao_manual: true }
    expect(obterDuracaoFinalDoRecebimento(rec, CORTE_TESTE)).toBeCloseTo(7.5, 5)
  })

  it('recebimento com correção manual válida não é excluído por causa do valor automático antigo (17h > 12h)', () => {
    const rec = { ...novo(17, 17), timer_segundos_totais: 7.5 * 3600, tempo_correcao_manual: true }
    const r = calcularMetricasDeTempo([rec], CORTE_TESTE)
    expect(r.quantidadeValida).toBe(1)
    expect(r.quantidadeExcluida).toBe(0)
    expect(r.tempoMedio).toBeCloseTo(7.5, 5)
  })

  it('exemplo do pedido: automático 17h, operador informa 08:00-15:30 (7h30) -> métrica = 7h30, não excluído', () => {
    const rec = { ...novo(17, 17), timer_segundos_totais: 7.5 * 3600, tempo_correcao_manual: true }
    const r = calcularMetricasDeTempo([rec], CORTE_TESTE)
    expect(r.tempoTotal).toBeCloseTo(7.5, 5)
    expect(r.quantidadeExcluida).toBe(0)
  })
})

describe('calcularMetricasDeTempo — casos gerais', () => {
  it('ignora recebimentos sem data_fim (ainda abertos)', () => {
    const resultado = calcularMetricasDeTempo(
      [{ data_inicio: '2026-01-01T00:00:00Z', data_fim: null, timer_segundos_totais: 0 }, historico(5)],
      CORTE_TESTE
    )
    expect(resultado.quantidadeValida).toBe(1)
    expect(resultado.tempoMedio).toBeCloseTo(5, 5)
  })

  it('lista vazia não quebra e retorna médias zeradas', () => {
    const resultado = calcularMetricasDeTempo([], CORTE_TESTE)
    expect(resultado.tempoMedio).toBe(0)
    expect(resultado.tempoTotal).toBe(0)
    expect(resultado.quantidadeValida).toBe(0)
    expect(resultado.quantidadeExcluida).toBe(0)
  })
})
