import { haversineKm, type Coordenada } from './distancia'

export type PontoRotaBaseOrdenavel = {
  loc: Coordenada
  addr?: string
  eventTitle?: string
  id?: string
}

export type DiagnosticoOrdenacaoRotaBase = {
  ordemOriginal: string[]
  ordemOtimizada: string[]
  criterioOrdenacao:
    | 'sem-pontos'
    | 'um-ponto'
    | 'greedy-haversine'
    | 'greedy-haversine-two-opt'
  twoOptExecutado: boolean
  twoOptAplicado: boolean
}

export type ResultadoOrdenacaoRotaBase<T extends PontoRotaBaseOrdenavel> = DiagnosticoOrdenacaoRotaBase & {
  pontosOrdenados: T[]
}

function labelPonto(p: PontoRotaBaseOrdenavel): string {
  return p.addr ?? p.eventTitle ?? p.id ?? `${p.loc.lat},${p.loc.lng}`
}

function distanciaHaversineM(a: Coordenada, b: Coordenada): number {
  return Math.round(haversineKm(a, b) * 1000)
}

function distanciaValida(v: number | null): v is number {
  return v !== null && Number.isFinite(v) && v >= 0
}

function distanciaOrdenacao(
  a: Coordenada,
  b: Coordenada,
  calcularDistanciaM?: (de: Coordenada, para: Coordenada) => number | null
): number {
  if (calcularDistanciaM) {
    const d = calcularDistanciaM(a, b)
    if (distanciaValida(d)) return d
  }
  return distanciaHaversineM(a, b)
}

function aplicarTwoOpt<T extends PontoRotaBaseOrdenavel>(
  path: T[],
  origem: Coordenada,
  calcularDistanciaM?: (de: Coordenada, para: Coordenada) => number | null
): boolean {
  const n = path.length
  let aplicou = false

  for (let it = 0; it < 12; it++) {
    let melhorou = false

    for (let i = 0; i < n - 2; i++) {
      for (let k = i + 1; k < n - 1; k++) {
        const a = i === 0 ? origem : path[i - 1].loc
        const b = path[i].loc
        const c = path[k].loc
        const d = path[k + 1].loc

        const atual =
          distanciaOrdenacao(a, b, calcularDistanciaM) +
          distanciaOrdenacao(c, d, calcularDistanciaM)
        const invertido =
          distanciaOrdenacao(a, c, calcularDistanciaM) +
          distanciaOrdenacao(b, d, calcularDistanciaM)

        if (invertido < atual) {
          path.splice(i, k - i + 1, ...path.slice(i, k + 1).reverse())
          melhorou = true
          aplicou = true
        }
      }
    }

    if (!melhorou) break
  }

  return aplicou
}

export function otimizarRotaBaseLegado<T extends PontoRotaBaseOrdenavel>(input: {
  origem: Coordenada
  pontos: T[]
  calcularDistanciaM?: (de: Coordenada, para: Coordenada) => number | null
}): ResultadoOrdenacaoRotaBase<T> {
  const ordemOriginal = input.pontos.map(labelPonto)

  if (input.pontos.length === 0) {
    return {
      pontosOrdenados: [],
      ordemOriginal,
      ordemOtimizada: ['DEPOSITO'],
      criterioOrdenacao: 'sem-pontos',
      twoOptExecutado: false,
      twoOptAplicado: false,
    }
  }

  if (input.pontos.length === 1) {
    return {
      pontosOrdenados: [...input.pontos],
      ordemOriginal,
      ordemOtimizada: ['DEPOSITO', labelPonto(input.pontos[0])],
      criterioOrdenacao: 'um-ponto',
      twoOptExecutado: false,
      twoOptAplicado: false,
    }
  }

  const restantes = input.pontos.map((p, idx) => ({ p, idx }))
  const ordenados: T[] = []
  let atual = input.origem

  while (restantes.length > 0) {
    restantes.sort((a, b) => {
      const da = distanciaHaversineM(atual, a.p.loc)
      const db = distanciaHaversineM(atual, b.p.loc)
      return da === db ? a.idx - b.idx : da - db
    })

    const proximo = restantes.shift()!
    ordenados.push(proximo.p)
    atual = proximo.p.loc
  }

  const twoOptExecutado = ordenados.length > 3
  const twoOptAplicado = twoOptExecutado
    ? aplicarTwoOpt(ordenados, input.origem, input.calcularDistanciaM)
    : false

  return {
    pontosOrdenados: ordenados,
    ordemOriginal,
    ordemOtimizada: ['DEPOSITO', ...ordenados.map(labelPonto)],
    criterioOrdenacao: twoOptExecutado
      ? 'greedy-haversine-two-opt'
      : 'greedy-haversine',
    twoOptExecutado,
    twoOptAplicado,
  }
}
