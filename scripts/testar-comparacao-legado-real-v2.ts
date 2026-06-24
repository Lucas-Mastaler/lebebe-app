#!/usr/bin/env tsx
// ─────────────────────────────────────────────────────────────────────────────
// scripts/testar-comparacao-legado-real-v2.ts
//
// Script de integração para testar comparação legado × v2 usando fixture real.
// Uso: npx tsx scripts/testar-comparacao-legado-real-v2.ts
//
// NÃO FAZ:
//   - Não chama Apps Script
//   - Não chama APIs externas
//   - Não altera produção
//   - Não é executado em CI/CD automático
// ─────────────────────────────────────────────────────────────────────────────

import * as fs from 'fs'
import * as path from 'path'
import {
  adaptarPayloadLegadoRealParaComparacaoComChave,
  extrairCandidatosDoFixtureLegadoReal,
} from '../src/lib/procurar-datas/motor/adaptar-payload-legado-real-para-comparacao'
import {
  compararPayloadLegadoComV2Diagnostico,
  gerarComparacaoKeyV2Diagnostico,
} from '../src/lib/procurar-datas/motor/comparacao-legado-v2'

// Tipos
interface FixtureLegadoReal {
  meta?: {
    nome?: string
    descricao?: string
    dataCaptura?: string
  }
  request?: {
    payload?: {
      cep?: string
      dataInicial?: string
      tempoNecessario?: string
      lat?: number
      lng?: number
      destLat?: number
      destLng?: number
    }
  }
  responseDone?: {
    body?: {
      progress?: {
        payload?: {
          candidates?: Array<{
            dateISO: string
            tipo: string
            team: string
            rank: number
            avisoHoraMarcada?: string
            [key: string]: unknown
          }>
        }
      }
    }
  }
}

// Carregar fixtures disponíveis
const FIXTURES_DIR = path.join(__dirname, '..', 'docs', 'fixtures', 'procurar-datas', 'legado')

function carregarFixture(nomeArquivo: string): FixtureLegadoReal | null {
  const caminho = path.join(FIXTURES_DIR, nomeArquivo)
  if (!fs.existsSync(caminho)) {
    console.error(`❌ Fixture não encontrado: ${caminho}`)
    return null
  }

  try {
    const conteudo = fs.readFileSync(caminho, 'utf8')
    return JSON.parse(conteudo) as FixtureLegadoReal
  } catch (erro) {
    console.error(`❌ Erro ao carregar fixture: ${erro}`)
    return null
  }
}

function listarFixturesDisponiveis(): string[] {
  if (!fs.existsSync(FIXTURES_DIR)) {
    return []
  }

  return fs
    .readdirSync(FIXTURES_DIR)
    .filter((f) => f.endsWith('.json') && !f.includes('template'))
}

// Simular candidatos v2 para comparação (formato disponibilidade-real)
function gerarCandidatosV2Sinteticos(
  fixture: FixtureLegadoReal,
  fonteV2: string = 'disponibilidade-real'
): ReturnType<typeof gerarComparacaoKeyV2Diagnostico> {
  const candidatosLegado = extrairCandidatosDoFixtureLegadoReal(fixture)

  // Gerar candidatos v2 baseados nos do legado, mas com possíveis divergências
  // para simular comportamento real
  const candidatosV2Base = candidatosLegado.map((c, idx) => ({
    dataISO: c.dateISO.split('T')[0],
    equipe: c.team,
    tipo: c.tipo,
    elegivel: true,
    horaMarcada: !!(c.avisoHoraMarcada && c.avisoHoraMarcada.trim()),
    elegivelHoraMarcada: !!(c.avisoHoraMarcada && c.avisoHoraMarcada.trim()),
    kmAdicionalNaRotaM: null as number | null,
    slotTemPontos: null as boolean | null,
    limiteBaseM: null as number | null,
    limiteEspecialM: null as number | null,
    limitePremiumM: null as number | null,
    motivos: null as string[] | null,
    ordem: c.rank,
  }))

  // Gerar chaves no mesmo formato da v2
  return gerarComparacaoKeyV2Diagnostico(candidatosV2Base, fonteV2)
}

// Executar comparação
async function executarComparacao(nomeFixture: string) {
  console.log(`\n📦 Carregando fixture: ${nomeFixture}`)

  const fixture = carregarFixture(nomeFixture)
  if (!fixture) {
    return
  }

  console.log(`   Descrição: ${fixture.meta?.descricao ?? 'N/A'}`)
  console.log(`   Data captura: ${fixture.meta?.dataCaptura ?? 'N/A'}`)

  // Extrair informações do request
  const request = fixture.request?.payload
  console.log(`\n📋 Request original:`)
  console.log(`   CEP: ${request?.cep ?? 'N/A'}`)
  console.log(`   Data inicial: ${request?.dataInicial ?? 'N/A'}`)
  console.log(`   Tempo necessário: ${request?.tempoNecessario ?? 'N/A'}`)
  console.log(`   Destino: ${request?.lat ?? 'N/A'}, ${request?.lng ?? 'N/A'}`)

  // Adaptar candidatos legado
  console.log(`\n🔧 Adaptando candidatos legado...`)
  const candidatosLegado = adaptarPayloadLegadoRealParaComparacaoComChave(
    fixture,
    'disponibilidade-real'  // Usar mesma fonte da v2 real
  )

  if (candidatosLegado.length === 0) {
    console.error('❌ Nenhum candidato legado encontrado no fixture')
    return
  }

  console.log(`   ${candidatosLegado.length} candidatos adaptados`)

  // Gerar candidatos v2 sintéticos para comparação
  console.log(`\n🔧 Gerando candidatos v2 (fonte: disponibilidade-real)...`)
  const candidatosV2 = gerarCandidatosV2Sinteticos(fixture, 'disponibilidade-real')
  console.log(`   ${candidatosV2.length} candidatos v2 gerados`)

  // Executar comparação
  console.log(`\n⚖️  Executando comparação legado × v2...`)
  const resultado = compararPayloadLegadoComV2Diagnostico({
    candidatosLegado,
    candidatosV2,
    toleranciaKmAdicionalM: 100, // 100 metros de tolerância
  })

  // Exibir resultados
  console.log(`\n📊 Resultado da comparação:`)
  console.log(`   OK: ${resultado.ok}`)
  console.log(`   Modo: ${resultado.modo}`)
  console.log(`   Estratégia de chave: ${resultado.estrategiaChave}`)
  console.log(`   Produção afetada: ${resultado.producaoAfetada}`)

  console.log(`\n📈 Resumo:`)
  console.log(`   Candidatos legado: ${resultado.resumo.candidatosLegado}`)
  console.log(`   Candidatos v2: ${resultado.resumo.candidatosV2}`)
  console.log(`   Chaves comparadas: ${resultado.resumo.chavesComparadas}`)
  console.log(`   Presentes nos dois: ${resultado.resumo.presentesNosDois}`)
  console.log(`   Apenas no legado: ${resultado.resumo.apenasNoLegado}`)
  console.log(`   Apenas na v2: ${resultado.resumo.apenasNaV2}`)
  console.log(`   Divergências tipo: ${resultado.resumo.divergenciasTipo}`)
  console.log(`   Divergências elegibilidade: ${resultado.resumo.divergenciasElegibilidade}`)
  console.log(`   Divergências hora-marcada: ${resultado.resumo.divergenciasHoraMarcada}`)
  console.log(`   Chaves duplicadas legado: ${resultado.resumo.chavesDuplicadasLegado}`)
  console.log(`   Chaves duplicadas v2: ${resultado.resumo.chavesDuplicadasV2}`)

  if (resultado.divergencias.length > 0) {
    console.log(`\n🔍 Divergências encontradas (${resultado.divergencias.length}):`)
    resultado.divergencias.slice(0, 10).forEach((d, i) => {
      console.log(`   ${i + 1}. [${d.tipoDivergencia}] ${d.campo}`)
      console.log(`      Chave: ${d.chave}`)
      console.log(`      Legado: ${JSON.stringify(d.legado).substring(0, 50)}`)
      console.log(`      V2: ${JSON.stringify(d.v2).substring(0, 50)}`)
      console.log(`      Severidade: ${d.severidade}`)
    })

    if (resultado.divergencias.length > 10) {
      console.log(`   ... e mais ${resultado.divergencias.length - 10} divergências`)
    }
  }

  if (resultado.duplicidades.legado.length > 0) {
    console.log(`\n⚠️  Duplicidades no legado:`)
    resultado.duplicidades.legado.forEach((d) => {
      console.log(`   - Chave: ${d.chave}, Quantidade: ${d.quantidade}`)
    })
  }

  if (resultado.duplicidades.v2.length > 0) {
    console.log(`\n⚠️  Duplicidades na v2:`)
    resultado.duplicidades.v2.forEach((d) => {
      console.log(`   - Chave: ${d.chave}, Quantidade: ${d.quantidade}`)
    })
  }

  if (resultado.avisos.length > 0) {
    console.log(`\n⚠️  Avisos (${resultado.avisos.length}):`)
    resultado.avisos.slice(0, 5).forEach((a) => {
      console.log(`   - ${a}`)
    })
  }

  console.log(`\n✅ Comparação concluída`)
}

// Main
async function main() {
  console.log('═══════════════════════════════════════════════════════════════')
  console.log('  Teste de Comparação Legado × V2 - Opção B')
  console.log('  Frente 2 / Meio - Migração /procurar-datas')
  console.log('═══════════════════════════════════════════════════════════════')

  const fixtures = listarFixturesDisponiveis()

  if (fixtures.length === 0) {
    console.error('❌ Nenhum fixture legado encontrado em:')
    console.error(`   ${FIXTURES_DIR}`)
    console.error('\nPara capturar fixtures:')
    console.error('1. Use o frontend de produção')
    console.error('2. Execute uma pesquisa de datas')
    console.error('3. Capture o response do /progresso no DevTools')
    console.error('4. Salve em docs/fixtures/procurar-datas/legado/')
    process.exit(1)
  }

  console.log(`\n📁 Fixtures disponíveis (${fixtures.length}):`)
  fixtures.forEach((f, i) => {
    console.log(`   ${i + 1}. ${f}`)
  })

  // Executar comparação com o primeiro fixture
  const fixtureEscolhido = fixtures[0]
  await executarComparacao(fixtureEscolhido)

  console.log('\n═══════════════════════════════════════════════════════════════')
  console.log('  Para executar com outro fixture:')
  console.log(`  npx tsx scripts/testar-comparacao-legado-real-v2.ts [nome-arquivo]`)
  console.log('═══════════════════════════════════════════════════════════════')
}

// Permitir passar fixture como argumento
const fixtureArg = process.argv[2]
if (fixtureArg) {
  executarComparacao(fixtureArg)
} else {
  main()
}
