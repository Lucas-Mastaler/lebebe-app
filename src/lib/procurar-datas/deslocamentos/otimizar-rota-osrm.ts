export type MatrizNumerica = (number | null)[][]

export type OtimizarRotaDeslocamentosInput = {
  distances: MatrizNumerica
  durations?: MatrizNumerica
  quantidadeParadas: number
}

export type OtimizarRotaDeslocamentosOutput =
  | {
      ok: true
      ordemParadas: number[]
      distanciaTotalM: number
      duracaoTotalSegundos: number | null
      avisos: string[]
    }
  | {
      ok: false
      erro: string
      avisos: string[]
    }

function valorSegmento(matriz: MatrizNumerica | undefined, de: number, para: number): number | null {
  const valor = matriz?.[de]?.[para]
  return typeof valor === 'number' && Number.isFinite(valor) && valor >= 0 ? valor : null
}

function custoOrdem(distances: MatrizNumerica, ordemParadas: number[]): number | null {
  let total = 0
  let anterior = 0
  for (const parada of ordemParadas) {
    const matrizIndice = parada + 1
    const trecho = valorSegmento(distances, anterior, matrizIndice)
    if (trecho == null) return null
    total += trecho
    anterior = matrizIndice
  }
  return total
}

function somarDuracao(durations: MatrizNumerica | undefined, ordemParadas: number[]): number | null {
  if (!durations) return null
  let total = 0
  let anterior = 0
  for (const parada of ordemParadas) {
    const matrizIndice = parada + 1
    const trecho = valorSegmento(durations, anterior, matrizIndice)
    if (trecho == null) return null
    total += trecho
    anterior = matrizIndice
  }
  return total
}

function ordemVizinhoMaisProximo(distances: MatrizNumerica, quantidadeParadas: number): number[] | null {
  const naoVisitados = new Set(Array.from({ length: quantidadeParadas }, (_, i) => i))
  const ordem: number[] = []
  let atualMatrizIndice = 0

  while (naoVisitados.size > 0) {
    let melhorParada: number | null = null
    let melhorDistancia = Infinity
    for (const parada of naoVisitados) {
      const matrizIndice = parada + 1
      const distancia = valorSegmento(distances, atualMatrizIndice, matrizIndice)
      if (distancia == null) continue
      if (distancia < melhorDistancia) {
        melhorDistancia = distancia
        melhorParada = parada
      }
    }
    if (melhorParada == null) return null
    ordem.push(melhorParada)
    naoVisitados.delete(melhorParada)
    atualMatrizIndice = melhorParada + 1
  }

  return ordem
}

function aplicarDoisOpt(distances: MatrizNumerica, ordemInicial: number[]): number[] {
  let ordem = [...ordemInicial]
  let melhorCusto = custoOrdem(distances, ordem)
  if (melhorCusto == null) return ordem

  for (let iteracao = 0; iteracao < 20; iteracao++) {
    let melhorou = false
    for (let i = 0; i < ordem.length - 1; i++) {
      for (let k = i + 1; k < ordem.length; k++) {
        const candidata = [
          ...ordem.slice(0, i),
          ...ordem.slice(i, k + 1).reverse(),
          ...ordem.slice(k + 1),
        ]
        const custo = custoOrdem(distances, candidata)
        if (custo != null && custo < melhorCusto) {
          ordem = candidata
          melhorCusto = custo
          melhorou = true
        }
      }
    }
    if (!melhorou) break
  }

  return ordem
}

export function otimizarRotaDeslocamentosPorMatrizOSRM(
  input: OtimizarRotaDeslocamentosInput
): OtimizarRotaDeslocamentosOutput {
  const avisos: string[] = []
  const totalPontos = input.quantidadeParadas + 1
  if (input.quantidadeParadas < 1) {
    return { ok: false, erro: 'sem_paradas', avisos }
  }
  if (!Array.isArray(input.distances) || input.distances.length !== totalPontos) {
    return { ok: false, erro: 'matriz_distancias_invalida', avisos }
  }

  const inicial = ordemVizinhoMaisProximo(input.distances, input.quantidadeParadas)
  if (!inicial) {
    return { ok: false, erro: 'matriz_distancias_sem_rota_completa', avisos }
  }

  const ordemParadas = aplicarDoisOpt(input.distances, inicial)
  const distanciaTotalM = custoOrdem(input.distances, ordemParadas)
  if (distanciaTotalM == null) {
    return { ok: false, erro: 'matriz_distancias_sem_rota_completa', avisos }
  }

  const duracaoTotalSegundos = somarDuracao(input.durations, ordemParadas)
  if (input.durations && duracaoTotalSegundos == null) {
    avisos.push('Duracao OSRM indisponivel para ao menos um trecho da ordem escolhida.')
  }

  return {
    ok: true,
    ordemParadas,
    distanciaTotalM: Math.round(distanciaTotalM),
    duracaoTotalSegundos: duracaoTotalSegundos == null ? null : Math.round(duracaoTotalSegundos),
    avisos,
  }
}
