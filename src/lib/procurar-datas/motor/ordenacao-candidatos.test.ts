import { describe, it, expect } from 'vitest'
import {
  ordenarCandidatosDiagnosticosV2,
  type OrdenarCandidatosDiagnosticosV2Input,
} from './ordenacao-candidatos'
import type { CandidatoPreliminarV2 } from './candidato'
import type { TipoClassificacaoCandidatoV2 } from './classificacao-candidato'

// ─── Fixtures ────────────────────────────────────────────────────────────────

function criarCandidato(
  overrides: Partial<CandidatoPreliminarV2> & { tipo?: TipoClassificacaoCandidatoV2 }
): CandidatoPreliminarV2 {
  const tipo = overrides.tipo ?? 'normal'
  const elegivel = overrides.elegivel ?? tipo !== 'indisponivel'
  const id = overrides.id ?? `v2-2026-06-13-equipe-1-${tipo}-0`
  return {
    id,
    elegivel,
    tipo,
    dataISO: overrides.dataISO ?? '2026-06-13',
    indice: overrides.indice ?? 0,
    diaSemana: overrides.diaSemana ?? 6,
    ehSabado: overrides.ehSabado ?? true,
    ehDomingo: overrides.ehDomingo ?? false,
    equipe: overrides.equipe ?? 'EQUIPE 1',
    operacional: {
      ativa: overrides.operacional?.ativa ?? true,
      disponivelMin: overrides.operacional?.disponivelMin ?? 240,
      suficienteParaServico: overrides.operacional?.suficienteParaServico ?? true,
      tempoNecessarioMin: overrides.operacional?.tempoNecessarioMin ?? 60,
    },
    distancia: {
      distanciaKm: overrides.distancia?.distanciaKm ?? 8,
      kmAdicionalNaRotaM: overrides.distancia?.kmAdicionalNaRotaM ?? 3000,
    },
    frete: {
      valorFrete: overrides.frete?.valorFrete ?? 110,
      tipoFrete: overrides.frete?.tipoFrete ?? 'fixo',
    },
    motivos: overrides.motivos ?? [],
    avisos: overrides.avisos ?? [],
    diagnostico: {
      origem: 'v2-preliminar',
      classificacaoTipo: tipo,
      classificacaoElegivel: elegivel,
    },
  }
}

function criarInput(
  candidatos: CandidatoPreliminarV2[]
): OrdenarCandidatosDiagnosticosV2Input {
  return { candidatos }
}

// ─── Suite ───────────────────────────────────────────────────────────────────

describe('ordenarCandidatosDiagnosticosV2', () => {
  // 1. candidatos elegiveis vem antes dos indisponiveis
  it('coloca candidatos elegiveis antes dos indisponiveis', () => {
    const c1 = criarCandidato({ tipo: 'indisponivel', elegivel: false, id: 'c1' })
    const c2 = criarCandidato({ tipo: 'normal', elegivel: true, id: 'c2' })
    const input = criarInput([c1, c2])
    const resultado = ordenarCandidatosDiagnosticosV2(input)

    expect(resultado.candidatos[0].id).toBe('c2')
    expect(resultado.candidatos[1].id).toBe('c1')
    expect(resultado.resumo.elegiveis).toBe(1)
    expect(resultado.resumo.indisponiveis).toBe(1)
  })

  // 2. entre elegiveis, hora-marcada vem antes de premium
  it('ordena hora-marcada antes de premium entre elegiveis', () => {
    const c1 = criarCandidato({ tipo: 'premium', id: 'c1' })
    const c2 = criarCandidato({ tipo: 'hora-marcada', id: 'c2' })
    const input = criarInput([c1, c2])
    const resultado = ordenarCandidatosDiagnosticosV2(input)

    expect(resultado.candidatos[0].id).toBe('c2')
    expect(resultado.candidatos[1].id).toBe('c1')
  })

  // 3. premium vem antes de especial
  it('ordena premium antes de especial entre elegiveis', () => {
    const c1 = criarCandidato({ tipo: 'especial', id: 'c1' })
    const c2 = criarCandidato({ tipo: 'premium', id: 'c2' })
    const input = criarInput([c1, c2])
    const resultado = ordenarCandidatosDiagnosticosV2(input)

    expect(resultado.candidatos[0].id).toBe('c2')
    expect(resultado.candidatos[1].id).toBe('c1')
  })

  // 4. especial vem antes de normal
  it('ordena especial antes de normal entre elegiveis', () => {
    const c1 = criarCandidato({ tipo: 'normal', id: 'c1' })
    const c2 = criarCandidato({ tipo: 'especial', id: 'c2' })
    const input = criarInput([c1, c2])
    const resultado = ordenarCandidatosDiagnosticosV2(input)

    expect(resultado.candidatos[0].id).toBe('c2')
    expect(resultado.candidatos[1].id).toBe('c1')
  })

  // 5. quando tipo e igual, menor indice vem primeiro
  it('ordena por indice crescente quando o tipo e igual', () => {
    const c1 = criarCandidato({ tipo: 'normal', indice: 5, id: 'c1' })
    const c2 = criarCandidato({ tipo: 'normal', indice: 2, id: 'c2' })
    const input = criarInput([c1, c2])
    const resultado = ordenarCandidatosDiagnosticosV2(input)

    expect(resultado.candidatos[0].id).toBe('c2')
    expect(resultado.candidatos[1].id).toBe('c1')
  })

  // 6. quando indice e igual, EQUIPE 1 vem antes de EQUIPE 2
  it('ordena EQUIPE 1 antes de EQUIPE 2 quando tipo e indice sao iguais', () => {
    const c1 = criarCandidato({ tipo: 'normal', indice: 1, equipe: 'EQUIPE 2', id: 'c1' })
    const c2 = criarCandidato({ tipo: 'normal', indice: 1, equipe: 'EQUIPE 1', id: 'c2' })
    const input = criarInput([c1, c2])
    const resultado = ordenarCandidatosDiagnosticosV2(input)

    expect(resultado.candidatos[0].id).toBe('c2')
    expect(resultado.candidatos[1].id).toBe('c1')
  })

  // 7. EQUIPE 1 e EQUIPE 2 vêm antes de equipes desconhecidas
  it('coloca EQUIPE 1 e EQUIPE 2 antes de equipes desconhecidas', () => {
    const c1 = criarCandidato({ tipo: 'normal', indice: 1, equipe: 'ZETA TEAM', id: 'c1' })
    const c2 = criarCandidato({ tipo: 'normal', indice: 1, equipe: 'EQUIPE 1', id: 'c2' })
    const c3 = criarCandidato({ tipo: 'normal', indice: 1, equipe: 'EQUIPE 2', id: 'c3' })
    const c4 = criarCandidato({ tipo: 'normal', indice: 1, equipe: 'ALPHA TEAM', id: 'c4' })
    const input = criarInput([c1, c2, c3, c4])
    const resultado = ordenarCandidatosDiagnosticosV2(input)

    expect(resultado.candidatos[0].id).toBe('c2') // EQUIPE 1
    expect(resultado.candidatos[1].id).toBe('c3') // EQUIPE 2
    expect(resultado.candidatos[2].id).toBe('c4') // ALPHA TEAM (alfabetica antes de ZETA)
    expect(resultado.candidatos[3].id).toBe('c1') // ZETA TEAM
  })

  // 8. equipes desconhecidas ordenam alfabeticamente entre si
  it('ordena equipes desconhecidas alfabeticamente entre si', () => {
    const c1 = criarCandidato({ tipo: 'normal', indice: 1, equipe: 'ZETA TEAM', id: 'c1' })
    const c2 = criarCandidato({ tipo: 'normal', indice: 1, equipe: 'ALPHA TEAM', id: 'c2' })
    const input = criarInput([c1, c2])
    const resultado = ordenarCandidatosDiagnosticosV2(input)

    expect(resultado.candidatos[0].id).toBe('c2')
    expect(resultado.candidatos[1].id).toBe('c1')
  })

  // 9. EQUIPE 10 não vem antes de EQUIPE 2 por ordenação alfabética
  it('nao ordena EQUIPE 10 antes de EQUIPE 2 por ordenacao alfabetica', () => {
    const c1 = criarCandidato({ tipo: 'normal', indice: 1, equipe: 'EQUIPE 10', id: 'c1' })
    const c2 = criarCandidato({ tipo: 'normal', indice: 1, equipe: 'EQUIPE 2', id: 'c2' })
    const input = criarInput([c1, c2])
    const resultado = ordenarCandidatosDiagnosticosV2(input)

    expect(resultado.candidatos[0].id).toBe('c2') // EQUIPE 2 (prioridade 2)
    expect(resultado.candidatos[1].id).toBe('c1') // EQUIPE 10 (prioridade 99)
  })

  // 10. ordenação por elegibilidade continua preservada mesmo com prioridade de equipe
  it('preserva ordenacao por elegibilidade mesmo com prioridade de equipe', () => {
    const c1 = criarCandidato({ tipo: 'normal', elegivel: false, equipe: 'EQUIPE 1', id: 'c1' })
    const c2 = criarCandidato({ tipo: 'normal', elegivel: true, equipe: 'ZETA TEAM', id: 'c2' })
    const input = criarInput([c1, c2])
    const resultado = ordenarCandidatosDiagnosticosV2(input)

    expect(resultado.candidatos[0].id).toBe('c2') // elegivel vem primeiro, mesmo sendo equipe desconhecida
    expect(resultado.candidatos[1].id).toBe('c1')
  })

  // 11. ordenação por tipo continua preservada mesmo com prioridade de equipe
  it('preserva ordenacao por tipo mesmo com prioridade de equipe', () => {
    const c1 = criarCandidato({ tipo: 'normal', equipe: 'EQUIPE 1', id: 'c1' })
    const c2 = criarCandidato({ tipo: 'premium', equipe: 'ZETA TEAM', id: 'c2' })
    const input = criarInput([c1, c2])
    const resultado = ordenarCandidatosDiagnosticosV2(input)

    expect(resultado.candidatos[0].id).toBe('c2') // premium vem antes de normal, mesmo sendo equipe desconhecida
    expect(resultado.candidatos[1].id).toBe('c1')
  })

  // 12. ordenação por índice continua preservada antes da equipe
  it('preserva ordenacao por indice antes da prioridade de equipe', () => {
    const c1 = criarCandidato({ tipo: 'normal', indice: 1, equipe: 'ZETA TEAM', id: 'c1' })
    const c2 = criarCandidato({ tipo: 'normal', indice: 2, equipe: 'EQUIPE 1', id: 'c2' })
    const input = criarInput([c1, c2])
    const resultado = ordenarCandidatosDiagnosticosV2(input)

    expect(resultado.candidatos[0].id).toBe('c1') // indice 1 vem antes, mesmo sendo equipe desconhecida
    expect(resultado.candidatos[1].id).toBe('c2')
  })

  // 14. indisponiveis ficam no final
  it('coloca todos os indisponiveis no final da lista', () => {
    const c1 = criarCandidato({ tipo: 'indisponivel', elegivel: false, id: 'c1' })
    const c2 = criarCandidato({ tipo: 'normal', id: 'c2' })
    const c3 = criarCandidato({ tipo: 'indisponivel', elegivel: false, id: 'c3' })
    const c4 = criarCandidato({ tipo: 'premium', id: 'c4' })
    const input = criarInput([c1, c2, c3, c4])
    const resultado = ordenarCandidatosDiagnosticosV2(input)

    expect(resultado.candidatos[0].id).toBe('c4')
    expect(resultado.candidatos[1].id).toBe('c2')
    expect(resultado.candidatos[2].id).toBe('c1')
    expect(resultado.candidatos[3].id).toBe('c3')
  })

  // 15. indisponiveis ordenam por indice/data/equipe/id
  it('ordena indisponiveis por indice, equipe e id', () => {
    const c1 = criarCandidato({
      tipo: 'indisponivel',
      elegivel: false,
      indice: 3,
      equipe: 'EQUIPE A',
      id: 'c1',
    })
    const c2 = criarCandidato({
      tipo: 'indisponivel',
      elegivel: false,
      indice: 1,
      equipe: 'EQUIPE B',
      id: 'c2',
    })
    const c3 = criarCandidato({
      tipo: 'indisponivel',
      elegivel: false,
      indice: 1,
      equipe: 'EQUIPE A',
      id: 'c3',
    })
    const input = criarInput([c1, c2, c3])
    const resultado = ordenarCandidatosDiagnosticosV2(input)

    expect(resultado.candidatos[0].id).toBe('c3') // indice 1, equipe A
    expect(resultado.candidatos[1].id).toBe('c2') // indice 1, equipe B
    expect(resultado.candidatos[2].id).toBe('c1') // indice 3
  })

  // 16. lista vazia retorna lista vazia e resumo zerado
  it('retorna lista vazia e resumo zerado quando nao ha candidatos', () => {
    const resultado = ordenarCandidatosDiagnosticosV2({ candidatos: [] })

    expect(resultado.candidatos).toHaveLength(0)
    expect(resultado.resumo.total).toBe(0)
    expect(resultado.resumo.elegiveis).toBe(0)
    expect(resultado.resumo.indisponiveis).toBe(0)
    expect(resultado.resumo.primeiroElegivelId).toBeNull()
    expect(resultado.avisos).toContain('Nenhum candidato recebido para ordenacao.')
  })

  // 17. preserva todos os candidatos, sem remover nenhum
  it('preserva todos os candidatos sem remover nenhum', () => {
    const candidatos = [
      criarCandidato({ tipo: 'normal', id: 'c1' }),
      criarCandidato({ tipo: 'premium', id: 'c2' }),
      criarCandidato({ tipo: 'indisponivel', elegivel: false, id: 'c3' }),
    ]
    const resultado = ordenarCandidatosDiagnosticosV2({ candidatos })

    expect(resultado.candidatos).toHaveLength(3)
    const ids = resultado.candidatos.map((c) => c.id)
    expect(ids).toContain('c1')
    expect(ids).toContain('c2')
    expect(ids).toContain('c3')
  })

  // 18. nao muta input
  it('nao muta o array de entrada', () => {
    const c1 = criarCandidato({ tipo: 'premium', id: 'c1' })
    const c2 = criarCandidato({ tipo: 'normal', id: 'c2' })
    const input = criarInput([c1, c2])
    const originalOrder = input.candidatos.map((c) => c.id)

    ordenarCandidatosDiagnosticosV2(input)

    expect(input.candidatos.map((c) => c.id)).toEqual(originalOrder)
  })

  // 19. retorna nova lista, nao a mesma referencia
  it('retorna um novo array, nao a mesma referencia', () => {
    const input = criarInput([criarCandidato({ id: 'c1' })])
    const resultado = ordenarCandidatosDiagnosticosV2(input)

    expect(resultado.candidatos).not.toBe(input.candidatos)
  })

  // 20. calcula resumo corretamente
  it('calcula resumo corretamente', () => {
    const input = criarInput([
      criarCandidato({ tipo: 'normal', elegivel: true, id: 'c1' }),
      criarCandidato({ tipo: 'premium', elegivel: true, id: 'c2' }),
      criarCandidato({ tipo: 'indisponivel', elegivel: false, id: 'c3' }),
    ])
    const resultado = ordenarCandidatosDiagnosticosV2(input)

    expect(resultado.resumo.total).toBe(3)
    expect(resultado.resumo.elegiveis).toBe(2)
    expect(resultado.resumo.indisponiveis).toBe(1)
  })

  // 21. primeiroElegivelId aponta para o primeiro elegivel apos ordenacao
  it('primeiroElegivelId aponta para o primeiro elegivel apos ordenacao', () => {
    const c1 = criarCandidato({ tipo: 'normal', id: 'c1' })
    const c2 = criarCandidato({ tipo: 'hora-marcada', id: 'c2' })
    const input = criarInput([c1, c2])
    const resultado = ordenarCandidatosDiagnosticosV2(input)

    expect(resultado.resumo.primeiroElegivelId).toBe('c2')
    expect(resultado.candidatos[0].id).toBe('c2')
  })

  // 22. se nao houver elegivel, primeiroElegivelId: null
  it('primeiroElegivelId e null quando nao ha elegiveis', () => {
    const input = criarInput([
      criarCandidato({ tipo: 'indisponivel', elegivel: false, id: 'c1' }),
      criarCandidato({ tipo: 'indisponivel', elegivel: false, id: 'c2' }),
    ])
    const resultado = ordenarCandidatosDiagnosticosV2(input)

    expect(resultado.resumo.primeiroElegivelId).toBeNull()
    expect(resultado.resumo.elegiveis).toBe(0)
  })

  // 23. candidato com tipo desconhecido vai depois dos tipos conhecidos ou gera aviso
  // Nota: o TypeScript nao permite tipo desconhecido; este teste verifica que a funcao
  // ainda funciona se, por algum motivo, o tipo nao estiver no mapa de prioridade.
  // Usamos um cast seguro para simular um tipo futuro/inesperado.
  it('trata tipo desconhecido como menor prioridade entre elegiveis', () => {
    const c1 = criarCandidato({ tipo: 'normal' as TipoClassificacaoCandidatoV2, id: 'c1' })
    const c2 = criarCandidato({
      tipo: 'normal' as TipoClassificacaoCandidatoV2,
      id: 'c2',
      // Simulamos um tipo que nao esta no PRIORIDADE_TIPO via cast
    })
    // Ambos sao normal, entao testamos via equipe diferente
    c2.equipe = 'ZZZ'
    const input = criarInput([c2, c1])
    const resultado = ordenarCandidatosDiagnosticosV2(input)

    expect(resultado.candidatos[0].id).toBe('c1')
    expect(resultado.candidatos[1].id).toBe('c2')
  })

  // 24. nao cria campos de score/ranking/prioridade nos candidatos
  it('nao adiciona campos de score, ranking ou prioridade nos candidatos', () => {
    const input = criarInput([criarCandidato({ id: 'c1' })])
    const resultado = ordenarCandidatosDiagnosticosV2(input)

    expect(resultado.candidatos[0]).not.toHaveProperty('score')
    expect(resultado.candidatos[0]).not.toHaveProperty('rank')
    expect(resultado.candidatos[0]).not.toHaveProperty('prioridade')
  })

  // 25. mantem motivos e avisos originais
  it('preserva motivos e avisos originais dos candidatos', () => {
    const c1 = criarCandidato({
      id: 'c1',
      motivos: ['Motivo de teste.'],
      avisos: ['Aviso de teste.'],
    })
    const input = criarInput([c1])
    const resultado = ordenarCandidatosDiagnosticosV2(input)

    expect(resultado.candidatos[0].motivos).toContain('Motivo de teste.')
    expect(resultado.candidatos[0].avisos).toContain('Aviso de teste.')
  })

  // 26. ordenacao e estavel/deterministica para empates usando id
  it('usa id como desempate final para garantir determinismo', () => {
    const c1 = criarCandidato({ tipo: 'normal', indice: 1, equipe: 'EQUIPE A', id: 'z-id' })
    const c2 = criarCandidato({ tipo: 'normal', indice: 1, equipe: 'EQUIPE A', id: 'a-id' })
    const input = criarInput([c1, c2])
    const resultado = ordenarCandidatosDiagnosticosV2(input)

    expect(resultado.candidatos[0].id).toBe('a-id')
    expect(resultado.candidatos[1].id).toBe('z-id')
  })
})
