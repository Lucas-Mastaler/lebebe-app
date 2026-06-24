// ─────────────────────────────────────────────────────────────────────────────
// scripts/diagnostico-osrm-table.ts
//   Script manual para testar conectividade real com OSRM Table API.
//
//   Proposito:
//     Validar que o adaptador criarBuscarMatrizOSRMTableDiagnosticoV2 funciona
//     com o servidor OSRM real (router.project-osrm.org ou outro).
//
//   Execucao manual:
//     npx tsx scripts/diagnostico-osrm-table.ts --baseUrl=https://router.project-osrm.org --timeoutMs=7000
//
//   IMPORTANTE:
//     - Nao roda automaticamente (nao e chamado por testes, rotas ou CI).
//     - Nao altera dados, banco, Sheets, Supabase, Apps Script.
//     - Nao faz geocoding.
//     - Usa pontos publicos de Curitiba (nao dados de clientes).
//     - Pode falhar se o endpoint OSRM estiver indisponivel ou bloquear CORS/limites.
//
//   Coordenadas usadas (publicas):
//     - Praça Tiradentes:  lat -25.4284, lng -49.2733
//     - Jardim Botanico:   lat -25.4420, lng -49.2407
//     - Parque Barigui:    lat -25.4235, lng -49.3076
//
//   OBSERVACAO:
//     OSRM internamente usa lng,lat, mas este script passa {lat,lng} porque
//     o cliente ja faz a conversao.
// ─────────────────────────────────────────────────────────────────────────────

import { criarBuscarMatrizOSRMTableDiagnosticoV2 } from '../src/lib/procurar-datas/motor/osrm-table-client-diagnostico'
import type { Coordenada } from '../src/lib/procurar-datas/motor/distancia'

// ─── Coordenadas publicas de Curitiba ───────────────────────────────────────

const PONTOS_CURITIBA: Coordenada[] = [
  { lat: -25.4284, lng: -49.2733 }, // Praça Tiradentes
  { lat: -25.442, lng: -49.2407 },  // Jardim Botanico
  { lat: -25.4235, lng: -49.3076 }, // Parque Barigui
]

// ─── Parse de argumentos CLI simples ─────────────────────────────────────────

function parseArgs(): { baseUrl: string; timeoutMs: number } {
  const args = process.argv.slice(2)

  let baseUrl = 'https://router.project-osrm.org'
  let timeoutMs = 7000

  for (const arg of args) {
    if (arg.startsWith('--baseUrl=')) {
      baseUrl = arg.slice('--baseUrl='.length)
    }
    if (arg.startsWith('--timeoutMs=')) {
      const val = parseInt(arg.slice('--timeoutMs='.length), 10)
      if (!isNaN(val) && val > 0) timeoutMs = val
    }
  }

  return { baseUrl, timeoutMs }
}

// ─── Helper de log ───────────────────────────────────────────────────────────

function log(msg: string, extra?: unknown) {
  const ts = new Date().toISOString()
  if (extra !== undefined) {
    console.log(`[${ts}] ${msg}`, extra)
  } else {
    console.log(`[${ts}] ${msg}`)
  }
}

// ─── Função principal ─────────────────────────────────────────────────────────

async function main() {
  console.log('\n══════════════════════════════════════════════════════════════════')
  console.log('  Diagnostico OSRM Table API')
  console.log('══════════════════════════════════════════════════════════════════\n')

  const { baseUrl, timeoutMs } = parseArgs()

  log('Configuracao', { baseUrl, timeoutMs, pontos: PONTOS_CURITIBA.length })

  // Cria cliente com fetch real (global)
  const buscarMatriz = criarBuscarMatrizOSRMTableDiagnosticoV2({
    baseUrl,
    fetchImpl: fetch,
    timeoutMs,
    log: (msg, extra) => log(`[OSRM] ${msg}`, extra),
  })

  log('Chamando OSRM Table API...')

  const inicio = Date.now()
  let resultado: { distances: (number | null)[][] } | null = null
  let erro: Error | null = null

  try {
    resultado = await buscarMatriz(PONTOS_CURITIBA)
  } catch (e) {
    erro = e instanceof Error ? e : new Error(String(e))
  }

  const duracaoMs = Date.now() - inicio

  console.log('\n──────────────────────────────────────────────────────────────────')
  console.log('  Resultado')
  console.log('──────────────────────────────────────────────────────────────────')

  log('Latencia total', { duracaoMs: `${duracaoMs}ms` })

  if (erro) {
    log('❌ ERRO', erro.message)
    console.log('\nDiagnostico finalizado com erro.\n')
    process.exit(1)
  }

  if (!resultado) {
    log('❌ ERRO INESPERADO', 'Resultado nulo sem erro')
    console.log('\nDiagnostico finalizado com erro.\n')
    process.exit(1)
  }

  log('✅ SUCESSO', {
    linhasRecebidas: resultado.distances.length,
  })

  // Analise da matriz
  const dists = resultado.distances
  const n = dists.length

  let totalCelulas = 0
  let totalNulos = 0
  let totalValidos = 0
  let soma = 0
  let min: number | null = null
  let max: number | null = null

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      totalCelulas++
      const v = dists[i][j]
      if (v === null) {
        totalNulos++
      } else {
        totalValidos++
        soma += v
        if (min === null || v < min) min = v
        if (max === null || v > max) max = v
      }
    }
  }

  log('Estatisticas da matriz', {
    dimensao: `${n}x${n}`,
    totalCelulas,
    totalValidos,
    totalNulos,
    somaMetros: soma,
    mediaMetros: totalValidos > 0 ? Math.round(soma / totalValidos) : null,
    minMetros: min,
    maxMetros: max,
  })

  log('Matriz de distancias (metros)', dists)

  // Validacao simples
  const errosValidacao: string[] = []
  if (dists.length !== PONTOS_CURITIBA.length) {
    errosValidacao.push(`Tamanho da matriz (${dists.length}) difere do numero de pontos (${PONTOS_CURITIBA.length})`)
  }
  for (let i = 0; i < dists.length; i++) {
    if (!Array.isArray(dists[i])) {
      errosValidacao.push(`Linha ${i} nao e array`)
    } else if (dists[i].length !== PONTOS_CURITIBA.length) {
      errosValidacao.push(`Linha ${i} tem tamanho ${dists[i].length}, esperado ${PONTOS_CURITIBA.length}`)
    }
  }

  if (errosValidacao.length > 0) {
    log('⚠️  ALERTAS DE VALIDACAO', errosValidacao)
  } else {
    log('✅ Formato da matriz valido')
  }

  console.log('\n──────────────────────────────────────────────────────────────────')
  console.log('  Diagnostico finalizado com sucesso.')
  console.log('──────────────────────────────────────────────────────────────────\n')
}

main().catch((e) => {
  console.error('Falha nao tratada:', e)
  process.exit(1)
})
