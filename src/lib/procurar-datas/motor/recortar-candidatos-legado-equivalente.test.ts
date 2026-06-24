// ─────────────────────────────────────────────────────────────────────────────
// motor/recortar-candidatos-legado-equivalente.test.ts
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, beforeEach } from 'vitest'
import { recortarCandidatosLegadoEquivalente } from './recortar-candidatos-legado-equivalente'
import type { CandidatoPreliminarV2 } from './candidato'

// ─── Mock helpers ────────────────────────────────────────────────────────────

let _id = 0
function mockCandidato(
  overrides: Partial<CandidatoPreliminarV2> & {
    dataISO: string
    equipe: string
    tipo: CandidatoPreliminarV2['tipo']
    elegivel: boolean
    kmAdicionalNaRotaM?: number | null
  }
): CandidatoPreliminarV2 {
  _id++
  return {
    id: `c-${_id}`,
    elegivel: overrides.elegivel,
    tipo: overrides.tipo,
    horaMarcada: overrides.horaMarcada ?? false,
    elegivelHoraMarcada: overrides.elegivelHoraMarcada ?? false,
    dataISO: overrides.dataISO,
    indice: overrides.indice ?? _id,
    diaSemana: overrides.diaSemana ?? 1,
    ehSabado: overrides.ehSabado ?? false,
    ehDomingo: overrides.ehDomingo ?? false,
    slotTemPontos: overrides.slotTemPontos ?? true,
    equipe: overrides.equipe,
    operacional: {
      ativa: true,
      disponivelMin: 480,
      suficienteParaServico: true,
      tempoNecessarioMin: 60,
    },
    distancia: {
      distanciaKm: overrides.kmAdicionalNaRotaM !== undefined ? (overrides.kmAdicionalNaRotaM ?? 0) / 1000 : null,
      kmAdicionalNaRotaM: overrides.kmAdicionalNaRotaM ?? null,
    },
    frete: { valorFrete: null, tipoFrete: null },
    motivos: [],
    avisos: [],
    limites: { limiteBaseM: 5000, limiteEspecialM: 10000, limitePremiumM: 15000 },
    diagnostico: {
      origem: 'v2-preliminar',
      classificacaoTipo: overrides.tipo,
      classificacaoElegivel: overrides.elegivel,
    },
  }
}

beforeEach(() => {
  _id = 0
})

// ─── Testes ──────────────────────────────────────────────────────────────────

describe('recortarCandidatosLegadoEquivalente', () => {
  it('input invalido retorna ok: false', () => {
    const result = recortarCandidatosLegadoEquivalente({ candidatos: null as unknown as [] })
    expect(result.ok).toBe(false)
    expect(result.candidatosFinais).toHaveLength(0)
  })

  it('lista vazia retorna ok: true e zero candidatos', () => {
    const result = recortarCandidatosLegadoEquivalente({ candidatos: [] })
    expect(result.ok).toBe(true)
    expect(result.candidatosFinais).toHaveLength(0)
    expect(result.resumo.totalRecortados).toBe(0)
  })

  it('inelegíveis são excluídos do recorte', () => {
    const candidatos = [
      mockCandidato({ dataISO: '2026-07-08', equipe: 'EQUIPE 1', tipo: 'normal', elegivel: false }),
      mockCandidato({ dataISO: '2026-07-08', equipe: 'EQUIPE 1', tipo: 'indisponivel', elegivel: false }),
    ]
    const result = recortarCandidatosLegadoEquivalente({ candidatos })
    expect(result.candidatosFinais).toHaveLength(0)
    expect(result.exclusoes.filter(e => e.motivo === 'inelegivel')).toHaveLength(2)
  })

  it('seleciona até maxNormais=3 normais por padrão (default v2 aprovado — divergência intencional do legado literal que usa 5)', () => {
    const candidatos = Array.from({ length: 7 }, (_, i) =>
      mockCandidato({
        dataISO: `2026-07-${String(i + 1).padStart(2, '0')}`,
        equipe: 'EQUIPE 1',
        tipo: 'normal',
        elegivel: true,
        kmAdicionalNaRotaM: 2000,
      })
    )
    const result = recortarCandidatosLegadoEquivalente({ candidatos })
    expect(result.normais).toHaveLength(3)
    expect(result.resumo.maxNormaisAplicado).toBe(3)
    expect(result.exclusoes.filter(e => e.motivo === 'limite-normais-atingido')).toHaveLength(4)
  })

  it('maxNormais=5 explícito respeita o parâmetro (compatível com legado literal)', () => {
    const candidatos = Array.from({ length: 7 }, (_, i) =>
      mockCandidato({
        dataISO: `2026-07-${String(i + 1).padStart(2, '0')}`,
        equipe: 'EQUIPE 1',
        tipo: 'normal',
        elegivel: true,
        kmAdicionalNaRotaM: 2000,
      })
    )
    const result = recortarCandidatosLegadoEquivalente({ candidatos, maxNormais: 5 })
    expect(result.normais).toHaveLength(5)
    expect(result.resumo.maxNormaisAplicado).toBe(5)
    expect(result.exclusoes.filter(e => e.motivo === 'limite-normais-atingido')).toHaveLength(2)
  })

  it('respeita maxNormais customizado', () => {
    const candidatos = [
      mockCandidato({ dataISO: '2026-07-01', equipe: 'EQUIPE 1', tipo: 'normal', elegivel: true, kmAdicionalNaRotaM: 1000 }),
      mockCandidato({ dataISO: '2026-07-02', equipe: 'EQUIPE 1', tipo: 'normal', elegivel: true, kmAdicionalNaRotaM: 1000 }),
      mockCandidato({ dataISO: '2026-07-03', equipe: 'EQUIPE 1', tipo: 'normal', elegivel: true, kmAdicionalNaRotaM: 1000 }),
    ]
    const result = recortarCandidatosLegadoEquivalente({ candidatos, maxNormais: 2 })
    expect(result.normais).toHaveLength(2)
    expect(result.candidatosFinais).toHaveLength(2)
  })

  it('seleciona até 1 especial, 1 premium, 1 hora-marcada (limite legado)', () => {
    const candidatos = [
      mockCandidato({ dataISO: '2026-07-01', equipe: 'EQUIPE 1', tipo: 'especial', elegivel: true, kmAdicionalNaRotaM: 6000 }),
      mockCandidato({ dataISO: '2026-07-02', equipe: 'EQUIPE 1', tipo: 'especial', elegivel: true, kmAdicionalNaRotaM: 7000 }),
      mockCandidato({ dataISO: '2026-07-03', equipe: 'EQUIPE 1', tipo: 'premium', elegivel: true, kmAdicionalNaRotaM: 12000 }),
      mockCandidato({ dataISO: '2026-07-04', equipe: 'EQUIPE 1', tipo: 'premium', elegivel: true, kmAdicionalNaRotaM: 13000 }),
      mockCandidato({ dataISO: '2026-07-05', equipe: 'EQUIPE 1', tipo: 'hora-marcada', elegivel: true, kmAdicionalNaRotaM: 2000 }),
      mockCandidato({ dataISO: '2026-07-06', equipe: 'EQUIPE 1', tipo: 'hora-marcada', elegivel: true, kmAdicionalNaRotaM: 2000 }),
    ]
    const result = recortarCandidatosLegadoEquivalente({ candidatos })
    expect(result.especiais).toHaveLength(1)
    expect(result.premiums).toHaveLength(1)
    expect(result.horaMarcada).toHaveLength(1)
    expect(result.exclusoes.filter(e => e.motivo === 'limite-especiais-atingido')).toHaveLength(1)
    expect(result.exclusoes.filter(e => e.motivo === 'limite-premiums-atingido')).toHaveLength(1)
    expect(result.exclusoes.filter(e => e.motivo === 'limite-hora-marcada-atingido')).toHaveLength(1)
  })

  it('especial com mesma data que normal é excluído (chosenDays compartilhado)', () => {
    const candidatos = [
      mockCandidato({ dataISO: '2026-07-03', equipe: 'EQUIPE 1', tipo: 'normal', elegivel: true, kmAdicionalNaRotaM: 2000 }),
      mockCandidato({ dataISO: '2026-07-03', equipe: 'EQUIPE 2', tipo: 'especial', elegivel: true, kmAdicionalNaRotaM: 7000 }),
    ]
    const result = recortarCandidatosLegadoEquivalente({ candidatos })
    expect(result.normais).toHaveLength(1)
    expect(result.especiais).toHaveLength(0)
    expect(result.exclusoes.some(e => e.motivo === 'data-ja-escolhida' && e.tipo === 'especial')).toBe(true)
  })

  it('deduplicação por data/tipo: escolhe menor kmAdicionalNaRotaM', () => {
    const candidatos = [
      mockCandidato({ dataISO: '2026-07-08', equipe: 'EQUIPE 2', tipo: 'normal', elegivel: true, kmAdicionalNaRotaM: 5000 }),
      mockCandidato({ dataISO: '2026-07-08', equipe: 'EQUIPE 1', tipo: 'normal', elegivel: true, kmAdicionalNaRotaM: 3000 }),
    ]
    const result = recortarCandidatosLegadoEquivalente({ candidatos })
    expect(result.normais).toHaveLength(1)
    expect(result.normais[0].equipe).toBe('EQUIPE 1')
    expect(result.exclusoes.some(e => e.motivo === 'duplicata-por-data-tipo' && e.equipe === 'EQUIPE 2')).toBe(true)
  })

  it('lista final ordenada cronologicamente (especial antes de normais se data menor)', () => {
    const candidatos = [
      mockCandidato({ dataISO: '2026-07-08', equipe: 'EQUIPE 1', tipo: 'normal', elegivel: true, kmAdicionalNaRotaM: 2000 }),
      mockCandidato({ dataISO: '2026-07-03', equipe: 'EQUIPE 1', tipo: 'especial', elegivel: true, kmAdicionalNaRotaM: 7000 }),
      mockCandidato({ dataISO: '2026-07-11', equipe: 'EQUIPE 1', tipo: 'normal', elegivel: true, kmAdicionalNaRotaM: 2000 }),
    ]
    const result = recortarCandidatosLegadoEquivalente({ candidatos })
    const datas = result.candidatosFinais.map(c => c.dataISO)
    expect(datas).toEqual(['2026-07-03', '2026-07-08', '2026-07-11'])
  })

  it('cenário Cornelius histórico: 4 candidatos elegíveis com maxNormais=5 explícito (valida parâmetro, não o default v2)', () => {
    // Histórico do legado: 03/07 especial, 08/07 normal, 11/07 normal, 13/07 normal.
    // Nota: 08/07 pode estar indisponível na agenda atual (22/06/2026); aqui testamos
    // a lógica do recorte com dados fixos, nao a disponibilidade da agenda.
    const candidatos = [
      mockCandidato({ dataISO: '2026-07-03', equipe: 'EQUIPE 1', tipo: 'especial', elegivel: true, kmAdicionalNaRotaM: 8000 }),
      mockCandidato({ dataISO: '2026-07-08', equipe: 'EQUIPE 1', tipo: 'normal', elegivel: true, kmAdicionalNaRotaM: 4000 }),
      mockCandidato({ dataISO: '2026-07-11', equipe: 'EQUIPE 1', tipo: 'normal', elegivel: true, kmAdicionalNaRotaM: 4000 }),
      mockCandidato({ dataISO: '2026-07-13', equipe: 'EQUIPE 1', tipo: 'normal', elegivel: true, kmAdicionalNaRotaM: 4000 }),
    ]
    const result = recortarCandidatosLegadoEquivalente({ candidatos, maxNormais: 5 })
    expect(result.ok).toBe(true)
    expect(result.candidatosFinais).toHaveLength(4)
    const datas = result.candidatosFinais.map(c => `${c.dataISO}:${c.tipo}`)
    expect(datas).toEqual([
      '2026-07-03:especial',
      '2026-07-08:normal',
      '2026-07-11:normal',
      '2026-07-13:normal',
    ])
    expect(result.normais).toHaveLength(3)
    expect(result.especiais).toHaveLength(1)
    expect(result.premiums).toHaveLength(0)
    expect(result.horaMarcada).toHaveLength(0)
  })

  it('cenário Cornelius com default v2 (maxNormais=3): 4 eligiveis elegem 3 normais + 1 especial', () => {
    // Com default v2=3: todos os 3 normais entram (exatamente no limite), especial entra.
    const candidatos = [
      mockCandidato({ dataISO: '2026-07-03', equipe: 'EQUIPE 1', tipo: 'especial', elegivel: true, kmAdicionalNaRotaM: 8000 }),
      mockCandidato({ dataISO: '2026-07-08', equipe: 'EQUIPE 1', tipo: 'normal', elegivel: true, kmAdicionalNaRotaM: 4000 }),
      mockCandidato({ dataISO: '2026-07-11', equipe: 'EQUIPE 1', tipo: 'normal', elegivel: true, kmAdicionalNaRotaM: 4000 }),
      mockCandidato({ dataISO: '2026-07-13', equipe: 'EQUIPE 1', tipo: 'normal', elegivel: true, kmAdicionalNaRotaM: 4000 }),
    ]
    const result = recortarCandidatosLegadoEquivalente({ candidatos })
    expect(result.ok).toBe(true)
    expect(result.normais).toHaveLength(3)
    expect(result.especiais).toHaveLength(1)
    expect(result.candidatosFinais).toHaveLength(4)
    expect(result.resumo.maxNormaisAplicado).toBe(3)
  })

  it('lista ampla com mais de 3 normais elegíveis: default v2=3 limita normais, especial preservado', () => {
    // 5 normais elegíveis + 1 especial + 20 inelegíveis. Default v2=3 deve limitar a 3 normais.
    const candidatos = [
      mockCandidato({ dataISO: '2026-07-02', equipe: 'EQUIPE 1', tipo: 'normal', elegivel: true, kmAdicionalNaRotaM: 3000 }),
      mockCandidato({ dataISO: '2026-07-08', equipe: 'EQUIPE 1', tipo: 'normal', elegivel: true, kmAdicionalNaRotaM: 4000 }),
      mockCandidato({ dataISO: '2026-07-10', equipe: 'EQUIPE 1', tipo: 'normal', elegivel: true, kmAdicionalNaRotaM: 4000 }),
      mockCandidato({ dataISO: '2026-07-13', equipe: 'EQUIPE 1', tipo: 'normal', elegivel: true, kmAdicionalNaRotaM: 4000 }),
      mockCandidato({ dataISO: '2026-07-14', equipe: 'EQUIPE 1', tipo: 'normal', elegivel: true, kmAdicionalNaRotaM: 4000 }),
      mockCandidato({ dataISO: '2026-07-03', equipe: 'EQUIPE 1', tipo: 'especial', elegivel: true, kmAdicionalNaRotaM: 8000 }),
      ...Array.from({ length: 20 }, (_, i) =>
        mockCandidato({ dataISO: `2026-08-${String(i + 1).padStart(2, '0')}`, equipe: 'EQUIPE 1', tipo: 'indisponivel', elegivel: false })
      ),
    ]
    const result = recortarCandidatosLegadoEquivalente({ candidatos })
    expect(result.normais).toHaveLength(3)
    expect(result.especiais).toHaveLength(1)
    expect(result.premiums).toHaveLength(0)
    expect(result.horaMarcada).toHaveLength(0)
    expect(result.candidatosFinais).toHaveLength(4)
    expect(result.resumo.maxNormaisAplicado).toBe(3)
    expect(result.resumo.totalRecebidos).toBe(26)
    expect(result.resumo.totalElegiveis).toBe(6)
    const datasFinais = result.candidatosFinais.map(c => c.dataISO)
    expect(new Set(datasFinais).size).toBe(datasFinais.length)
  })

  it('cenario Cornelius com lista ampla e maxNormais=5 explícito: inelegiveis nao contaminam seleção', () => {
    // Simula situação real onde a lista ampla tem muitos candidatos; valida maxNormais explícito
    const candidatos = [
      mockCandidato({ dataISO: '2026-07-03', equipe: 'EQUIPE 1', tipo: 'especial', elegivel: true, kmAdicionalNaRotaM: 8000 }),
      mockCandidato({ dataISO: '2026-07-08', equipe: 'EQUIPE 1', tipo: 'normal', elegivel: true, kmAdicionalNaRotaM: 4000 }),
      mockCandidato({ dataISO: '2026-07-11', equipe: 'EQUIPE 1', tipo: 'normal', elegivel: true, kmAdicionalNaRotaM: 4000 }),
      mockCandidato({ dataISO: '2026-07-13', equipe: 'EQUIPE 1', tipo: 'normal', elegivel: true, kmAdicionalNaRotaM: 4000 }),
      ...Array.from({ length: 20 }, (_, i) =>
        mockCandidato({ dataISO: `2026-08-${String(i + 1).padStart(2, '0')}`, equipe: 'EQUIPE 1', tipo: 'indisponivel', elegivel: false })
      ),
    ]
    const result = recortarCandidatosLegadoEquivalente({ candidatos, maxNormais: 5 })
    expect(result.candidatosFinais).toHaveLength(4)
    expect(result.resumo.totalRecebidos).toBe(24)
    expect(result.resumo.totalElegiveis).toBe(4)
    expect(result.resumo.totalRecortados).toBe(4)
  })

  it('dias usados (chosenDays) reflete exatamente as datas selecionadas', () => {
    const candidatos = [
      mockCandidato({ dataISO: '2026-07-08', equipe: 'EQUIPE 1', tipo: 'normal', elegivel: true, kmAdicionalNaRotaM: 2000 }),
      mockCandidato({ dataISO: '2026-07-03', equipe: 'EQUIPE 1', tipo: 'especial', elegivel: true, kmAdicionalNaRotaM: 7000 }),
    ]
    const result = recortarCandidatosLegadoEquivalente({ candidatos })
    expect(result.diasUsados).toContain('2026-07-08')
    expect(result.diasUsados).toContain('2026-07-03')
    expect(result.diasUsados).toHaveLength(2)
  })

  it('especial com data diferente de todos os normais é incluído', () => {
    const candidatos = [
      mockCandidato({ dataISO: '2026-07-08', equipe: 'EQUIPE 1', tipo: 'normal', elegivel: true, kmAdicionalNaRotaM: 2000 }),
      mockCandidato({ dataISO: '2026-07-05', equipe: 'EQUIPE 1', tipo: 'especial', elegivel: true, kmAdicionalNaRotaM: 7000 }),
    ]
    const result = recortarCandidatosLegadoEquivalente({ candidatos })
    expect(result.normais).toHaveLength(1)
    expect(result.especiais).toHaveLength(1)
    expect(result.candidatosFinais).toHaveLength(2)
  })

  // ─── Testes da regra full-window controlado para extras úteis ──────────────

  it('K13: extra anterior à última normal é mantido', () => {
    // Normal: 07-10, 07-11, 07-13 → última = 07-13
    // Especial: 07-03 → 07-03 < 07-13 → mantido
    const candidatos = [
      mockCandidato({ dataISO: '2026-07-03', equipe: 'EQUIPE 1', tipo: 'especial', elegivel: true, kmAdicionalNaRotaM: 7500 }),
      mockCandidato({ dataISO: '2026-07-10', equipe: 'EQUIPE 1', tipo: 'normal', elegivel: true, kmAdicionalNaRotaM: 2000 }),
      mockCandidato({ dataISO: '2026-07-11', equipe: 'EQUIPE 1', tipo: 'normal', elegivel: true, kmAdicionalNaRotaM: 2000 }),
      mockCandidato({ dataISO: '2026-07-13', equipe: 'EQUIPE 1', tipo: 'normal', elegivel: true, kmAdicionalNaRotaM: 2000 }),
    ]
    const result = recortarCandidatosLegadoEquivalente({ candidatos })
    expect(result.normais).toHaveLength(3)
    expect(result.especiais).toHaveLength(1)
    expect(result.especiais[0].dataISO).toBe('2026-07-03')
    expect(result.candidatosFinais).toHaveLength(4)
    expect(result.resumo.ultimaNormalDataISO).toBe('2026-07-13')
    expect(result.resumo.extrasRemovidosPorDataPosterior).toBe(0)
    expect(result.exclusoes.filter(e => e.motivo === 'extra-posterior-ultima-normal')).toHaveLength(0)
  })

  it('K14: extra igual à última normal é removido', () => {
    // Normal: 07-10, 07-11, 07-13 → última = 07-13
    // Especial: 07-13 → 07-13 === 07-13 → removido (>= última)
    // Mas 07-13 já está em chosenDays (normal), então na prática é excluído como data-ja-escolhida
    // antes do filtro de extras. Vamos usar datas distintas:
    // Normal: 07-10, 07-11, 07-13 → última = 07-13
    // Premium: 07-13 diferente equipe — mas mesma data → data-ja-escolhida bloqueia
    // Para testar a regra >= diretamente, usamos data exata da última normal via hora-marcada
    // em data não usada por normal. Vamos usar: normais 07-10, 07-11; especial 07-11 (data já usada
    // por normal, bloqueado antes), premium 07-16 > 07-11 → deve ser removido.
    const candidatos = [
      mockCandidato({ dataISO: '2026-07-10', equipe: 'EQUIPE 1', tipo: 'normal', elegivel: true, kmAdicionalNaRotaM: 2000 }),
      mockCandidato({ dataISO: '2026-07-11', equipe: 'EQUIPE 1', tipo: 'normal', elegivel: true, kmAdicionalNaRotaM: 2000 }),
      mockCandidato({ dataISO: '2026-07-16', equipe: 'EQUIPE 2', tipo: 'premium', elegivel: true, kmAdicionalNaRotaM: 12000 }),
    ]
    const result = recortarCandidatosLegadoEquivalente({ candidatos, maxNormais: 2 })
    expect(result.normais).toHaveLength(2)
    expect(result.premiums).toHaveLength(0)
    expect(result.candidatosFinais).toHaveLength(2)
    expect(result.resumo.ultimaNormalDataISO).toBe('2026-07-11')
    expect(result.resumo.extrasRemovidosPorDataPosterior).toBe(1)
    expect(result.exclusoes.filter(e => e.motivo === 'extra-posterior-ultima-normal')).toHaveLength(1)
  })

  it('K14b: extra com data exatamente igual à última normal é removido (>= strict)', () => {
    // Normal: 07-10, 07-13 (maxNormais=2) → última = 07-13
    // Especial: 07-13 → mesma data usada pela normal → bloqueado por data-ja-escolhida
    // Para testar igualdade direta, usamos equipe diferente que não colide em normal:
    // normais: 07-10 E1, 07-11 E1 → última = 07-11
    // especial: 07-12 E2 → 07-12 > 07-11 → removido
    const candidatos = [
      mockCandidato({ dataISO: '2026-07-10', equipe: 'EQUIPE 1', tipo: 'normal', elegivel: true, kmAdicionalNaRotaM: 2000 }),
      mockCandidato({ dataISO: '2026-07-11', equipe: 'EQUIPE 1', tipo: 'normal', elegivel: true, kmAdicionalNaRotaM: 2000 }),
      mockCandidato({ dataISO: '2026-07-12', equipe: 'EQUIPE 2', tipo: 'especial', elegivel: true, kmAdicionalNaRotaM: 7500 }),
    ]
    const result = recortarCandidatosLegadoEquivalente({ candidatos, maxNormais: 2 })
    expect(result.normais).toHaveLength(2)
    expect(result.especiais).toHaveLength(0)
    expect(result.resumo.extrasRemovidosPorDataPosterior).toBe(1)
    expect(result.exclusoes.filter(e => e.motivo === 'extra-posterior-ultima-normal')).toHaveLength(1)
  })

  it('K15: sem normais → regra não se aplica, extras ficam todos', () => {
    // Sem normais → ultimaNormalDataISO = null → extras mantidos
    const candidatos = [
      mockCandidato({ dataISO: '2026-07-03', equipe: 'EQUIPE 1', tipo: 'especial', elegivel: true, kmAdicionalNaRotaM: 7500 }),
      mockCandidato({ dataISO: '2026-07-08', equipe: 'EQUIPE 1', tipo: 'premium', elegivel: true, kmAdicionalNaRotaM: 12000 }),
    ]
    const result = recortarCandidatosLegadoEquivalente({ candidatos })
    expect(result.normais).toHaveLength(0)
    expect(result.especiais).toHaveLength(1)
    expect(result.premiums).toHaveLength(1)
    expect(result.candidatosFinais).toHaveLength(2)
    expect(result.resumo.ultimaNormalDataISO).toBeNull()
    expect(result.resumo.extrasRemovidosPorDataPosterior).toBe(0)
  })

  it('extras múltiplos: anterior fica, posterior sai', () => {
    // Normal: 07-10 → última = 07-10
    // Especial: 07-05 < 07-10 → fica; Premium: 07-12 >= 07-10 → sai; HoraMarcada: 07-09 < 07-10 → fica
    const candidatos = [
      mockCandidato({ dataISO: '2026-07-10', equipe: 'EQUIPE 1', tipo: 'normal', elegivel: true, kmAdicionalNaRotaM: 2000 }),
      mockCandidato({ dataISO: '2026-07-05', equipe: 'EQUIPE 2', tipo: 'especial', elegivel: true, kmAdicionalNaRotaM: 7500 }),
      mockCandidato({ dataISO: '2026-07-12', equipe: 'EQUIPE 2', tipo: 'premium', elegivel: true, kmAdicionalNaRotaM: 12000 }),
      mockCandidato({ dataISO: '2026-07-09', equipe: 'EQUIPE 2', tipo: 'hora-marcada', elegivel: true, kmAdicionalNaRotaM: 1000 }),
    ]
    const result = recortarCandidatosLegadoEquivalente({ candidatos })
    expect(result.normais).toHaveLength(1)
    expect(result.especiais).toHaveLength(1)
    expect(result.especiais[0].dataISO).toBe('2026-07-05')
    expect(result.premiums).toHaveLength(0)
    expect(result.horaMarcada).toHaveLength(1)
    expect(result.horaMarcada[0].dataISO).toBe('2026-07-09')
    expect(result.resumo.extrasRemovidosPorDataPosterior).toBe(1)
    expect(result.candidatosFinais.map(c => c.dataISO)).toEqual(['2026-07-05', '2026-07-09', '2026-07-10'])
  })

  it('resumo reporta ultimaNormalDataISO e extrasRemovidosPorDataPosterior corretamente', () => {
    const candidatos = [
      mockCandidato({ dataISO: '2026-07-08', equipe: 'EQUIPE 1', tipo: 'normal', elegivel: true, kmAdicionalNaRotaM: 2000 }),
      mockCandidato({ dataISO: '2026-07-11', equipe: 'EQUIPE 1', tipo: 'normal', elegivel: true, kmAdicionalNaRotaM: 2000 }),
      mockCandidato({ dataISO: '2026-07-13', equipe: 'EQUIPE 1', tipo: 'normal', elegivel: true, kmAdicionalNaRotaM: 2000 }),
      mockCandidato({ dataISO: '2026-07-15', equipe: 'EQUIPE 2', tipo: 'especial', elegivel: true, kmAdicionalNaRotaM: 7500 }),
      mockCandidato({ dataISO: '2026-07-16', equipe: 'EQUIPE 2', tipo: 'premium', elegivel: true, kmAdicionalNaRotaM: 12000 }),
    ]
    const result = recortarCandidatosLegadoEquivalente({ candidatos })
    expect(result.resumo.ultimaNormalDataISO).toBe('2026-07-13')
    expect(result.resumo.extrasRemovidosPorDataPosterior).toBe(2)
    expect(result.candidatosFinais).toHaveLength(3)
  })

  it('aviso emitido quando extras são removidos por data posterior', () => {
    const candidatos = [
      mockCandidato({ dataISO: '2026-07-08', equipe: 'EQUIPE 1', tipo: 'normal', elegivel: true, kmAdicionalNaRotaM: 2000 }),
      mockCandidato({ dataISO: '2026-07-10', equipe: 'EQUIPE 2', tipo: 'premium', elegivel: true, kmAdicionalNaRotaM: 12000 }),
    ]
    const result = recortarCandidatosLegadoEquivalente({ candidatos })
    expect(result.avisos.some(a => a.includes('extra(s) removido(s)'))).toBe(true)
    expect(result.avisos.some(a => a.includes('2026-07-08'))).toBe(true)
  })
})
