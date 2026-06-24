// ─────────────────────────────────────────────────────────────────────────────
// aplicar-mapa-km-adicional-por-slot-em-candidatos.test.ts
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest'
import {
  aplicarMapaKmAdicionalPorSlotEmCandidatosDiagnosticoV2,
  type CandidatoDiagnosticoParaAplicacaoMapa,
  type AplicarMapaKmAdicionalPorSlotEmCandidatosInput,
} from './aplicar-mapa-km-adicional-por-slot-em-candidatos'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function candidato(
  dataISO: string,
  equipe: string,
  kmAdicionalNaRotaM: number | null = null,
  extra: Record<string, unknown> = {}
): CandidatoDiagnosticoParaAplicacaoMapa {
  return { dataISO, equipe, kmAdicionalNaRotaM, tipo: 'normal', elegivel: true, ...extra }
}

function monta(
  candidatos: CandidatoDiagnosticoParaAplicacaoMapa[],
  mapa: Record<string, number | null>
): AplicarMapaKmAdicionalPorSlotEmCandidatosInput {
  return { candidatos, mapaKmAdicionalPorSlot: mapa }
}

// ─── Testes ───────────────────────────────────────────────────────────────────

describe('aplicarMapaKmAdicionalPorSlotEmCandidatosDiagnosticoV2', () => {

  // 1. Candidato com chave no mapa recebe km correto
  it('1. candidato com chave no mapa recebe kmAdicionalNaRotaM do mapa', () => {
    const r = aplicarMapaKmAdicionalPorSlotEmCandidatosDiagnosticoV2(monta(
      [candidato('2026-06-29', 'EQUIPE 1', 0)],
      { '2026-06-29::EQUIPE 1': 4481 }
    ))

    expect(r.ok).toBe(true)
    expect(r.candidatos[0].kmAdicionalNaRotaM).toBe(4481)
    expect(r.candidatos[0].kmAdicionalAplicadoPorMapaSlot).toBe(true)
    expect(r.candidatos[0].origemKmAdicionalNaRotaM).toBe('mapa-slot-diagnostico')
    expect(r.candidatos[0].slotKeyKmAdicional).toBe('2026-06-29::EQUIPE 1')
    expect(r.contadores.candidatosComKmAplicado).toBe(1)
  })

  // 2. Dois candidatos com datas diferentes recebem valores diferentes
  it('2. candidatos com datas diferentes recebem valores diferentes do mapa', () => {
    const r = aplicarMapaKmAdicionalPorSlotEmCandidatosDiagnosticoV2(monta(
      [
        candidato('2026-07-01', 'EQUIPE 1', 0),
        candidato('2026-07-02', 'EQUIPE 1', 0),
      ],
      {
        '2026-07-01::EQUIPE 1': 5997,
        '2026-07-02::EQUIPE 1': 3100,
      }
    ))

    expect(r.candidatos[0].kmAdicionalNaRotaM).toBe(5997)
    expect(r.candidatos[1].kmAdicionalNaRotaM).toBe(3100)
    expect(r.contadores.candidatosComKmAplicado).toBe(2)
  })

  // 3. Duas equipes na mesma data recebem valores diferentes
  it('3. equipes diferentes na mesma data recebem valores diferentes', () => {
    const r = aplicarMapaKmAdicionalPorSlotEmCandidatosDiagnosticoV2(monta(
      [
        candidato('2026-06-29', 'EQUIPE 1', 0),
        candidato('2026-06-29', 'EQUIPE 2', 0),
      ],
      {
        '2026-06-29::EQUIPE 1': 1000,
        '2026-06-29::EQUIPE 2': 2000,
      }
    ))

    expect(r.candidatos[0].kmAdicionalNaRotaM).toBe(1000)
    expect(r.candidatos[1].kmAdicionalNaRotaM).toBe(2000)
  })

  // 4. Candidato sem chave no mapa não recebe km global
  it('4. candidato sem chave no mapa nao recebe km global', () => {
    const r = aplicarMapaKmAdicionalPorSlotEmCandidatosDiagnosticoV2(monta(
      [candidato('2026-06-30', 'EQUIPE 1', 500)],
      { '2026-06-29::EQUIPE 1': 4481 }
    ))

    expect(r.candidatos[0].kmAdicionalNaRotaM).toBe(500)
    expect(r.candidatos[0].kmAdicionalAplicadoPorMapaSlot).toBe(false)
    expect(r.candidatos[0].origemKmAdicionalNaRotaM).toBe('sem-chave-no-mapa')
    expect(r.contadores.candidatosSemChaveNoMapa).toBe(1)
    expect(r.contadores.candidatosComKmAplicado).toBe(0)
  })

  // 5. Candidato sem dataISO nao recebe km
  it('5. candidato com dataISO vazia nao recebe km global', () => {
    const r = aplicarMapaKmAdicionalPorSlotEmCandidatosDiagnosticoV2(monta(
      [candidato('', 'EQUIPE 1', 100)],
      { '2026-06-29::EQUIPE 1': 4481 }
    ))

    expect(r.candidatos[0].kmAdicionalNaRotaM).toBe(100)
    expect(r.candidatos[0].kmAdicionalAplicadoPorMapaSlot).toBe(false)
    expect(r.candidatos[0].origemKmAdicionalNaRotaM).toBe('sem-data-equipe')
    expect(r.contadores.candidatosSemDataOuEquipe).toBe(1)
  })

  // 6. Candidato com equipe inválida nao recebe km
  it('6. candidato com equipe invalida nao recebe km global', () => {
    const r = aplicarMapaKmAdicionalPorSlotEmCandidatosDiagnosticoV2(monta(
      [candidato('2026-06-29', 'EQUIPE INVALIDA', 100)],
      { '2026-06-29::EQUIPE 1': 4481 }
    ))

    expect(r.candidatos[0].kmAdicionalNaRotaM).toBe(100)
    expect(r.candidatos[0].origemKmAdicionalNaRotaM).toBe('sem-data-equipe')
    expect(r.contadores.candidatosSemDataOuEquipe).toBe(1)
  })

  // 7. Equipe com sufixo "(sintético)" é normalizada corretamente
  it('7. equipe com sufixo "(sintetico)" eh normalizada corretamente para busca no mapa', () => {
    const r = aplicarMapaKmAdicionalPorSlotEmCandidatosDiagnosticoV2(monta(
      [candidato('2026-06-29', 'EQUIPE 1 (sintético)', 0)],
      { '2026-06-29::EQUIPE 1': 7777 }
    ))

    expect(r.candidatos[0].kmAdicionalNaRotaM).toBe(7777)
    expect(r.candidatos[0].kmAdicionalAplicadoPorMapaSlot).toBe(true)
  })

  // 8. kmAdicionalNaRotaDiagnosticoM absurdo no candidato nao contamina
  it('8. valor absurdo preexistente no candidato eh substituido pelo mapa — isolamento', () => {
    const r = aplicarMapaKmAdicionalPorSlotEmCandidatosDiagnosticoV2(monta(
      [candidato('2026-06-29', 'EQUIPE 1', 999999)],
      { '2026-06-29::EQUIPE 1': 3500 }
    ))

    expect(r.candidatos[0].kmAdicionalNaRotaM).toBe(3500)
    expect(r.candidatos[0].kmAdicionalAplicadoPorMapaSlot).toBe(true)
  })

  // 9. Preserva demais campos do candidato
  it('9. preserva demais campos do candidato apos aplicacao', () => {
    const r = aplicarMapaKmAdicionalPorSlotEmCandidatosDiagnosticoV2(monta(
      [candidato('2026-06-29', 'EQUIPE 1', 0, { tipo: 'especial', elegivel: true, motivos: ['a'], avisos: ['b'] })],
      { '2026-06-29::EQUIPE 1': 5000 }
    ))

    const c = r.candidatos[0]
    expect(c.tipo).toBe('especial')
    expect(c.elegivel).toBe(true)
    expect(c.motivos).toEqual(['a'])
    expect(c.avisos).toEqual(['b'])
    expect(c.kmAdicionalNaRotaM).toBe(5000)
  })

  // 10. Contadores corretos — mix de aplicado, sem chave e sem data
  it('10. contadores refletem corretamente mix de resultados', () => {
    const r = aplicarMapaKmAdicionalPorSlotEmCandidatosDiagnosticoV2(monta(
      [
        candidato('2026-06-29', 'EQUIPE 1', 0),    // com chave
        candidato('2026-06-30', 'EQUIPE 1', 0),    // sem chave
        candidato('', 'EQUIPE 1', 0),               // sem data
        candidato('2026-07-01', 'EQUIPE 2', 0),    // com chave
      ],
      {
        '2026-06-29::EQUIPE 1': 4481,
        '2026-07-01::EQUIPE 2': 5997,
      }
    ))

    expect(r.contadores.candidatosRecebidos).toBe(4)
    expect(r.contadores.candidatosComSlotKey).toBe(3)
    expect(r.contadores.candidatosComKmAplicado).toBe(2)
    expect(r.contadores.candidatosSemChaveNoMapa).toBe(1)
    expect(r.contadores.candidatosSemDataOuEquipe).toBe(1)
  })

  // 11. Mapa vazio — nenhum candidato recebe km
  it('11. mapa vazio — nenhum candidato recebe km por mapa', () => {
    const r = aplicarMapaKmAdicionalPorSlotEmCandidatosDiagnosticoV2(monta(
      [
        candidato('2026-06-29', 'EQUIPE 1', 111),
        candidato('2026-06-30', 'EQUIPE 2', 222),
      ],
      {}
    ))

    expect(r.candidatos[0].kmAdicionalNaRotaM).toBe(111)
    expect(r.candidatos[1].kmAdicionalNaRotaM).toBe(222)
    expect(r.contadores.candidatosComKmAplicado).toBe(0)
    expect(r.contadores.candidatosSemChaveNoMapa).toBe(2)
  })

  // 12. Lista de candidatos vazia — retorna ok e contadores zerados
  it('12. lista vazia de candidatos retorna ok:true com contadores zerados', () => {
    const r = aplicarMapaKmAdicionalPorSlotEmCandidatosDiagnosticoV2(monta(
      [],
      { '2026-06-29::EQUIPE 1': 4481 }
    ))

    expect(r.ok).toBe(true)
    expect(r.candidatos).toHaveLength(0)
    expect(r.contadores.candidatosRecebidos).toBe(0)
    expect(r.contadores.candidatosComKmAplicado).toBe(0)
  })

  // 13. Modo sempre é o correto
  it('13. modo sempre e "aplicacao-mapa-km-por-slot-em-candidatos-diagnostico"', () => {
    const r = aplicarMapaKmAdicionalPorSlotEmCandidatosDiagnosticoV2(monta([], {}))
    expect(r.modo).toBe('aplicacao-mapa-km-por-slot-em-candidatos-diagnostico')
  })

  // 14. Avisos contêm texto de diagnóstico
  it('14. avisos sempre contêm texto de diagnostico', () => {
    const r = aplicarMapaKmAdicionalPorSlotEmCandidatosDiagnosticoV2(monta([], {}))
    expect(r.avisos[0]).toContain('diagnostico')
  })

  // 15. Chave no mapa com valor null — não aplica, registra aviso
  it('15. chave no mapa com valor null nao aplica km', () => {
    const r = aplicarMapaKmAdicionalPorSlotEmCandidatosDiagnosticoV2(monta(
      [candidato('2026-06-29', 'EQUIPE 1', 300)],
      { '2026-06-29::EQUIPE 1': null }
    ))

    expect(r.candidatos[0].kmAdicionalNaRotaM).toBe(300)
    expect(r.candidatos[0].kmAdicionalAplicadoPorMapaSlot).toBe(false)
    expect(r.contadores.candidatosSemChaveNoMapa).toBe(1)
    expect(r.contadores.candidatosComKmAplicado).toBe(0)
  })

  // 16. SlotKey é exposto corretamente em cada candidato
  it('16. slotKeyKmAdicional é exposto corretamente', () => {
    const r = aplicarMapaKmAdicionalPorSlotEmCandidatosDiagnosticoV2(monta(
      [candidato('2026-06-29', 'EQUIPE 2', 0)],
      { '2026-06-29::EQUIPE 2': 8000 }
    ))

    expect(r.candidatos[0].slotKeyKmAdicional).toBe('2026-06-29::EQUIPE 2')
  })

  // 17. Equipe normalizada via variante (EQP 1)
  it('17. equipe no formato EQP 1 eh normalizada e encontra chave no mapa', () => {
    const r = aplicarMapaKmAdicionalPorSlotEmCandidatosDiagnosticoV2(monta(
      [candidato('2026-06-29', 'EQP 1', 0)],
      { '2026-06-29::EQUIPE 1': 6000 }
    ))

    expect(r.candidatos[0].kmAdicionalNaRotaM).toBe(6000)
    expect(r.candidatos[0].kmAdicionalAplicadoPorMapaSlot).toBe(true)
  })

  // 18. slotKeyKmAdicional é null quando sem data/equipe
  it('18. slotKeyKmAdicional eh null quando candidato nao tem data/equipe valida', () => {
    const r = aplicarMapaKmAdicionalPorSlotEmCandidatosDiagnosticoV2(monta(
      [candidato('', 'EQUIPE 1', 0)],
      { '2026-06-29::EQUIPE 1': 4481 }
    ))

    expect(r.candidatos[0].slotKeyKmAdicional).toBeNull()
  })
})
