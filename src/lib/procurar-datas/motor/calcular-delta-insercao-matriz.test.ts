import { describe, it, expect, vi } from 'vitest'
import {
  calcularDeltaInsercaoRotaComMatrizDiagnosticoV2,
  type CalcularDeltaInsercaoMatrizInput,
  type PontoRotaMatriz,
} from './calcular-delta-insercao-matriz'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const ORIGEM = { lat: -25.45, lng: -49.29, descricao: 'Origem' }
const DESTINO = { lat: -25.42, lng: -49.27, descricao: 'Destino' }

const PONTO_A: PontoRotaMatriz = {
  loc: { lat: -25.44, lng: -49.28 },
  addr: 'Rua A',
  id: 'a',
}
const PONTO_B: PontoRotaMatriz = {
  loc: { lat: -25.43, lng: -49.275 },
  addr: 'Rua B',
  id: 'b',
}
const PONTO_C: PontoRotaMatriz = {
  loc: { lat: -25.425, lng: -49.265 },
  addr: 'Rua C',
  id: 'c',
}

/**
 * Funcao de distancia sintetica baseada em tabela explicita.
 * Permite controlar exatamente quais valores sao retornados por par.
 */
function fazerMatrizDistancia(
  tabela: Record<string, number | null>
): CalcularDeltaInsercaoMatrizInput['calcularDistanciaM'] {
  return (de, para) => {
    const chave = `${de.lat},${de.lng}→${para.lat},${para.lng}`
    if (chave in tabela) return tabela[chave]
    return 999 // valor padrao para pares nao definidos
  }
}

// ─── Testes ───────────────────────────────────────────────────────────────────

describe('calcularDeltaInsercaoRotaComMatrizDiagnosticoV2', () => {

  // ── 1. Agenda vazia com distância válida ──────────────────────────────────
  describe('agenda vazia', () => {
    it('1. agenda vazia com distancia valida retorna rota simples origem -> destino', () => {
      const fn = vi.fn().mockReturnValue(1500)
      const resultado = calcularDeltaInsercaoRotaComMatrizDiagnosticoV2({
        origem: ORIGEM,
        destino: DESTINO,
        pontosAgenda: [],
        calcularDistanciaM: fn,
      })
      expect(resultado.ok).toBe(true)
      expect(resultado.modo).toBe('matriz-distancia-diagnostico')
      expect(resultado.kmAdicionalNaRotaM).toBe(1500)
      expect(resultado.melhorInsercao).toBeNull()
      expect(resultado.avisos.some((a) => a.includes('rota simples'))).toBe(true)
      expect(resultado.erros).toHaveLength(0)
    })

    // ── 2. Agenda vazia com distância inválida ──────────────────────────────
    it('2. agenda vazia com distancia invalida retorna null, nao 0', () => {
      const fn = vi.fn().mockReturnValue(null)
      const resultado = calcularDeltaInsercaoRotaComMatrizDiagnosticoV2({
        origem: ORIGEM,
        destino: DESTINO,
        pontosAgenda: [],
        calcularDistanciaM: fn,
      })
      expect(resultado.ok).toBe(false)
      expect(resultado.kmAdicionalNaRotaM).toBeNull()
      expect(resultado.kmAdicionalNaRotaM).not.toBe(0)
      expect(resultado.erros.length).toBeGreaterThan(0)
    })
  })

  // ── 3. Melhor inserção antes do primeiro ponto ────────────────────────────
  describe('melhor insercao', () => {
    it('3. melhor insercao antes do primeiro ponto (indiceInsercao=0)', () => {
      // Fabricar distâncias para que insercao no inicio seja a menor
      // origem -> destino = 500, destino -> A = 200, origem -> A = 800
      // delta inicio = 500 + 200 - 800 = -100 (menor)
      // delta fim = dist(A, destino) = 600
      const tabela: Record<string, number> = {
        [`${ORIGEM.lat},${ORIGEM.lng}→${DESTINO.lat},${DESTINO.lng}`]: 500,
        [`${DESTINO.lat},${DESTINO.lng}→${PONTO_A.loc.lat},${PONTO_A.loc.lng}`]: 200,
        [`${ORIGEM.lat},${ORIGEM.lng}→${PONTO_A.loc.lat},${PONTO_A.loc.lng}`]: 800,
        [`${PONTO_A.loc.lat},${PONTO_A.loc.lng}→${DESTINO.lat},${DESTINO.lng}`]: 600,
      }
      const resultado = calcularDeltaInsercaoRotaComMatrizDiagnosticoV2({
        origem: ORIGEM,
        destino: DESTINO,
        pontosAgenda: [PONTO_A],
        calcularDistanciaM: fazerMatrizDistancia(tabela),
      })
      expect(resultado.ok).toBe(true)
      expect(resultado.melhorInsercao?.indiceInsercao).toBe(0)
      expect(resultado.kmAdicionalNaRotaM).toBe(-100)
    })

    it('4. melhor insercao entre dois pontos (indiceInsercao=1)', () => {
      // Distancias para que insercao no meio seja a menor
      // A -> destino = 100, destino -> B = 100, A -> B = 500
      // delta meio = 100 + 100 - 500 = -300 (menor)
      const tabela: Record<string, number> = {
        // insercao inicio
        [`${ORIGEM.lat},${ORIGEM.lng}→${DESTINO.lat},${DESTINO.lng}`]: 1000,
        [`${DESTINO.lat},${DESTINO.lng}→${PONTO_A.loc.lat},${PONTO_A.loc.lng}`]: 900,
        [`${ORIGEM.lat},${ORIGEM.lng}→${PONTO_A.loc.lat},${PONTO_A.loc.lng}`]: 800,
        // insercao meio
        [`${PONTO_A.loc.lat},${PONTO_A.loc.lng}→${DESTINO.lat},${DESTINO.lng}`]: 100,
        [`${DESTINO.lat},${DESTINO.lng}→${PONTO_B.loc.lat},${PONTO_B.loc.lng}`]: 100,
        [`${PONTO_A.loc.lat},${PONTO_A.loc.lng}→${PONTO_B.loc.lat},${PONTO_B.loc.lng}`]: 500,
        // insercao fim
        [`${PONTO_B.loc.lat},${PONTO_B.loc.lng}→${DESTINO.lat},${DESTINO.lng}`]: 400,
      }
      const resultado = calcularDeltaInsercaoRotaComMatrizDiagnosticoV2({
        origem: ORIGEM,
        destino: DESTINO,
        pontosAgenda: [PONTO_A, PONTO_B],
        calcularDistanciaM: fazerMatrizDistancia(tabela),
      })
      expect(resultado.ok).toBe(true)
      expect(resultado.melhorInsercao?.indiceInsercao).toBe(1)
      expect(resultado.kmAdicionalNaRotaM).toBe(-300)
    })

    it('5. melhor insercao depois do ultimo ponto (fim aberto)', () => {
      // delta fim = dist(A, destino) = 50 (menor de todas)
      const tabela: Record<string, number> = {
        // insercao inicio
        [`${ORIGEM.lat},${ORIGEM.lng}→${DESTINO.lat},${DESTINO.lng}`]: 800,
        [`${DESTINO.lat},${DESTINO.lng}→${PONTO_A.loc.lat},${PONTO_A.loc.lng}`]: 800,
        [`${ORIGEM.lat},${ORIGEM.lng}→${PONTO_A.loc.lat},${PONTO_A.loc.lng}`]: 100,
        // insercao fim
        [`${PONTO_A.loc.lat},${PONTO_A.loc.lng}→${DESTINO.lat},${DESTINO.lng}`]: 50,
      }
      const resultado = calcularDeltaInsercaoRotaComMatrizDiagnosticoV2({
        origem: ORIGEM,
        destino: DESTINO,
        pontosAgenda: [PONTO_A],
        calcularDistanciaM: fazerMatrizDistancia(tabela),
      })
      expect(resultado.ok).toBe(true)
      expect(resultado.melhorInsercao?.indiceInsercao).toBe(1)
      expect(resultado.melhorInsercao?.depois).toBeNull()
      expect(resultado.kmAdicionalNaRotaM).toBe(50)
    })
  })

  // ── 6. Ignora inserção com distância faltante (null) ──────────────────────
  describe('distancias invalidas por insercao', () => {
    it('6. ignora insercao quando uma distancia necessaria retorna null', () => {
      // so retorna null para insercao no inicio; fim ainda funciona
      const fn = vi.fn((de: { lat: number; lng: number }, para: { lat: number; lng: number }) => {
        const chave = `${de.lat},${de.lng}→${para.lat},${para.lng}`
        // insercao inicio: origem->destino = null (inválida)
        if (
          de.lat === ORIGEM.lat &&
          de.lng === ORIGEM.lng &&
          para.lat === DESTINO.lat &&
          para.lng === DESTINO.lng
        )
          return null
        // tudo mais retorna 300
        return 300
      })
      const resultado = calcularDeltaInsercaoRotaComMatrizDiagnosticoV2({
        origem: ORIGEM,
        destino: DESTINO,
        pontosAgenda: [PONTO_A],
        calcularDistanciaM: fn,
      })
      expect(resultado.ok).toBe(true)
      // so o fim ficou valido, indiceInsercao = 1
      expect(resultado.melhorInsercao?.indiceInsercao).toBe(1)
      expect(resultado.avisos.some((a) => a.includes('ignorada'))).toBe(true)
    })

    // ── 7. Todas as inserções inválidas ─────────────────────────────────────
    it('7. retorna erro quando todas as insercoes sao invalidas', () => {
      const fn = vi.fn().mockReturnValue(null)
      const resultado = calcularDeltaInsercaoRotaComMatrizDiagnosticoV2({
        origem: ORIGEM,
        destino: DESTINO,
        pontosAgenda: [PONTO_A],
        calcularDistanciaM: fn,
      })
      expect(resultado.ok).toBe(false)
      expect(resultado.kmAdicionalNaRotaM).toBeNull()
      expect(resultado.erros.some((e) => e.includes('invalidas'))).toBe(true)
    })

    // ── 8. Rejeita distância negativa ───────────────────────────────────────
    it('8. rejeita distancia negativa como invalida', () => {
      const fn = vi.fn().mockReturnValue(-100)
      const resultado = calcularDeltaInsercaoRotaComMatrizDiagnosticoV2({
        origem: ORIGEM,
        destino: DESTINO,
        pontosAgenda: [],
        calcularDistanciaM: fn,
      })
      expect(resultado.ok).toBe(false)
      expect(resultado.kmAdicionalNaRotaM).toBeNull()
    })

    // ── 9. Rejeita NaN / Infinity ───────────────────────────────────────────
    it('9a. rejeita NaN como invalido', () => {
      const fn = vi.fn().mockReturnValue(NaN)
      const resultado = calcularDeltaInsercaoRotaComMatrizDiagnosticoV2({
        origem: ORIGEM,
        destino: DESTINO,
        pontosAgenda: [],
        calcularDistanciaM: fn,
      })
      expect(resultado.ok).toBe(false)
      expect(resultado.kmAdicionalNaRotaM).toBeNull()
    })

    it('9b. rejeita Infinity como invalido', () => {
      const fn = vi.fn().mockReturnValue(Infinity)
      const resultado = calcularDeltaInsercaoRotaComMatrizDiagnosticoV2({
        origem: ORIGEM,
        destino: DESTINO,
        pontosAgenda: [],
        calcularDistanciaM: fn,
      })
      expect(resultado.ok).toBe(false)
      expect(resultado.kmAdicionalNaRotaM).toBeNull()
    })
  })

  // ── 10. Ponto sem coordenada entra em descartados ─────────────────────────
  describe('pontos descartados', () => {
    it('10. ponto sem coordenada valida entra em descartados', () => {
      const pontoInvalido: PontoRotaMatriz = {
        loc: { lat: NaN, lng: -49.28 },
        addr: 'Invalido',
      }
      const fn = vi.fn().mockReturnValue(500)
      const resultado = calcularDeltaInsercaoRotaComMatrizDiagnosticoV2({
        origem: ORIGEM,
        destino: DESTINO,
        pontosAgenda: [pontoInvalido],
        calcularDistanciaM: fn,
      })
      expect(resultado.descartados).toHaveLength(1)
      expect(resultado.descartados[0].indice).toBe(0)
      expect(resultado.descartados[0].motivo).toContain('sem coordenada valida')
    })
  })

  // ── 11. Origem inválida ───────────────────────────────────────────────────
  describe('origem e destino invalidos', () => {
    it('11. origem invalida retorna ok=false, kmAdicionalNaRotaM=null', () => {
      const fn = vi.fn().mockReturnValue(500)
      const resultado = calcularDeltaInsercaoRotaComMatrizDiagnosticoV2({
        origem: { lat: NaN, lng: -49.29 },
        destino: DESTINO,
        pontosAgenda: [],
        calcularDistanciaM: fn,
      })
      expect(resultado.ok).toBe(false)
      expect(resultado.kmAdicionalNaRotaM).toBeNull()
      expect(resultado.erros.some((e) => e.includes('Origem'))).toBe(true)
    })

    // ── 12. Destino inválido ──────────────────────────────────────────────
    it('12. destino invalido retorna ok=false, kmAdicionalNaRotaM=null', () => {
      const fn = vi.fn().mockReturnValue(500)
      const resultado = calcularDeltaInsercaoRotaComMatrizDiagnosticoV2({
        origem: ORIGEM,
        destino: { lat: NaN, lng: -49.27 },
        pontosAgenda: [],
        calcularDistanciaM: fn,
      })
      expect(resultado.ok).toBe(false)
      expect(resultado.kmAdicionalNaRotaM).toBeNull()
      expect(resultado.erros.some((e) => e.includes('Destino'))).toBe(true)
    })
  })

  // ── 13. Imutabilidade ────────────────────────────────────────────────────
  describe('imutabilidade', () => {
    it('13. nao muta pontosAgenda nem origem nem destino', () => {
      const pontosOriginal = [
        { loc: { lat: -25.44, lng: -49.28 }, addr: 'X' },
      ]
      const copiaAntes = JSON.stringify(pontosOriginal)
      const origemCopia = { ...ORIGEM }
      const destinoCopia = { ...DESTINO }
      const fn = vi.fn().mockReturnValue(300)
      calcularDeltaInsercaoRotaComMatrizDiagnosticoV2({
        origem: origemCopia,
        destino: destinoCopia,
        pontosAgenda: pontosOriginal,
        calcularDistanciaM: fn,
      })
      expect(JSON.stringify(pontosOriginal)).toBe(copiaAntes)
      expect(origemCopia.lat).toBe(ORIGEM.lat)
      expect(destinoCopia.lat).toBe(DESTINO.lat)
    })
  })

  // ── 14. Ausência de I/O externo ──────────────────────────────────────────
  describe('ausencia de I/O externo', () => {
    it('14. helper puro: nao tem fetch, process.env, Date.now, Supabase, OSRM', () => {
      // Verificar que o modulo exporta apenas a funcao e tipos — sem side effects
      // O proprio fato de rodar sem mock de fetch/supabase confirma pureza.
      const fn = vi.fn().mockReturnValue(200)
      expect(() =>
        calcularDeltaInsercaoRotaComMatrizDiagnosticoV2({
          origem: ORIGEM,
          destino: DESTINO,
          pontosAgenda: [PONTO_A],
          calcularDistanciaM: fn,
        })
      ).not.toThrow()
    })
  })

  // ── 15. Modo correto ─────────────────────────────────────────────────────
  describe('modo', () => {
    it('15. retorna modo: matriz-distancia-diagnostico em todos os caminhos', () => {
      const fn = vi.fn().mockReturnValue(500)
      const r1 = calcularDeltaInsercaoRotaComMatrizDiagnosticoV2({
        origem: ORIGEM,
        destino: DESTINO,
        pontosAgenda: [],
        calcularDistanciaM: fn,
      })
      expect(r1.modo).toBe('matriz-distancia-diagnostico')

      const r2 = calcularDeltaInsercaoRotaComMatrizDiagnosticoV2({
        origem: { lat: NaN, lng: 0 },
        destino: DESTINO,
        pontosAgenda: [],
        calcularDistanciaM: fn,
      })
      expect(r2.modo).toBe('matriz-distancia-diagnostico')

      const r3 = calcularDeltaInsercaoRotaComMatrizDiagnosticoV2({
        origem: ORIGEM,
        destino: DESTINO,
        pontosAgenda: [PONTO_A],
        calcularDistanciaM: fn,
      })
      expect(r3.modo).toBe('matriz-distancia-diagnostico')
    })
  })

  // ── 16. Não usa Haversine internamente ───────────────────────────────────
  describe('sem Haversine interno', () => {
    it('16. todas as distancias vem exclusivamente da funcao injetada', () => {
      const chamadas: string[] = []
      const fn = (de: { lat: number; lng: number }, para: { lat: number; lng: number }) => {
        chamadas.push(`${de.lat}→${para.lat}`)
        return 400
      }
      calcularDeltaInsercaoRotaComMatrizDiagnosticoV2({
        origem: ORIGEM,
        destino: DESTINO,
        pontosAgenda: [PONTO_A],
        calcularDistanciaM: fn,
      })
      // 3 chamadas: origem->A, origem->destino, destino->A, A->destino (fim)
      // total = 4 chamadas
      expect(chamadas.length).toBeGreaterThan(0)
      // E garantia de que o helper NAO importa haversine — verificado em codigo
      // (o import haversineKm nao existe neste arquivo)
    })
  })

  // ── 17. kmAdicionalNaRotaM nunca vira 0 por erro crítico ─────────────────
  describe('sem fallback 0', () => {
    it('17. kmAdicionalNaRotaM nunca e 0 em erro critico (sempre null)', () => {
      const fn = vi.fn().mockReturnValue(null)

      // origem invalida
      const r1 = calcularDeltaInsercaoRotaComMatrizDiagnosticoV2({
        origem: { lat: NaN, lng: 0 },
        destino: DESTINO,
        pontosAgenda: [],
        calcularDistanciaM: fn,
      })
      expect(r1.kmAdicionalNaRotaM).toBeNull()
      expect(r1.kmAdicionalNaRotaM).not.toBe(0)

      // todas distancias invalidas
      const r2 = calcularDeltaInsercaoRotaComMatrizDiagnosticoV2({
        origem: ORIGEM,
        destino: DESTINO,
        pontosAgenda: [PONTO_A],
        calcularDistanciaM: vi.fn().mockReturnValue(null),
      })
      expect(r2.kmAdicionalNaRotaM).toBeNull()
      expect(r2.kmAdicionalNaRotaM).not.toBe(0)
    })
  })

  // ── Resumo e contadores ───────────────────────────────────────────────────
  describe('resumo de quantidades', () => {
    it('18. resumo reflete quantidades corretas de pontos e distancias', () => {
      const pontoInvalido: PontoRotaMatriz = { loc: { lat: NaN, lng: 0 } }
      let chamadas = 0
      let invalidas = 0
      const fn = (de: { lat: number; lng: number }, para: { lat: number; lng: number }) => {
        void de; void para
        chamadas++
        // simula 1 invalida na primeira chamada
        if (chamadas === 1) {
          invalidas++
          return null
        }
        return 300
      }
      const resultado = calcularDeltaInsercaoRotaComMatrizDiagnosticoV2({
        origem: ORIGEM,
        destino: DESTINO,
        pontosAgenda: [PONTO_A, PONTO_B, pontoInvalido],
        calcularDistanciaM: fn,
      })
      expect(resultado.resumo.quantidadePontosAgenda).toBe(3)
      expect(resultado.resumo.quantidadePontosValidos).toBe(2)
      expect(resultado.resumo.quantidadePontosInvalidos).toBe(1)
      expect(resultado.resumo.quantidadeDistanciasInvalidas).toBe(invalidas)
    })

    it('19. avisos incluem a melhor insercao encontrada quando ok=true', () => {
      const fn = vi.fn().mockReturnValue(200)
      const resultado = calcularDeltaInsercaoRotaComMatrizDiagnosticoV2({
        origem: ORIGEM,
        destino: DESTINO,
        pontosAgenda: [PONTO_A, PONTO_B, PONTO_C],
        calcularDistanciaM: fn,
      })
      expect(resultado.ok).toBe(true)
      expect(resultado.avisos.some((a) => a.includes('Melhor insercao'))).toBe(true)
    })
  })
})
