// Preparação local: nunca executa SQL ou chama Supabase/SGI.
import { createHash } from 'node:crypto'
import { writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

export function extrairReferencias(html) {
  const bloco = html.match(/const\s+modeloRepeticoes\s*=\s*(\{[\s\S]*?\});/)?.[1]
  if (!bloco) throw new Error('Objeto modeloRepeticoes ausente na fonte')
  const registros = [...bloco.matchAll(/['"](DB\d{3})['"]\s*:\s*\{\s*repeticao\s*:\s*(\d+(?:\.\d+)?)/g)]
    .map((m) => ({ referencia: m[1], repeticaoM: m[2] })).sort((a, b) => a.referencia.localeCompare(b.referencia))
  const esperadas = [700, 800].flatMap((serie) => Array.from({ length: 45 }, (_, i) => `DB${serie + i + 1}`))
  if (registros.length !== 90 || new Set(registros.map((r) => r.referencia)).size !== 90 || registros.some((r, i) => r.referencia !== esperadas[i] || !/^\d+(?:\.\d{1,2})?$/.test(r.repeticaoM))) {
    throw new Error('Integridade do catálogo DB divergente: revisar fonte antes de importar')
  }
  return registros
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const response = await fetch('https://decorisi.com.br/')
  if (!response.ok) throw new Error(`Fonte Decorisi HTTP ${response.status}`)
  const html = await response.text()
  const registros = extrairReferencias(html)
  const evidencia = { fonte: 'https://decorisi.com.br/#calculadora', extraidoEm: new Date().toISOString(), sha256: createHash('sha256').update(html).digest('hex'), registros }
  await writeFile(new URL('../../src/lib/pedidos-personalizados/decorisi/referencias-db.json', import.meta.url), JSON.stringify(evidencia, null, 2) + '\n')
  console.info(`[decorisi] ${registros.length} referências extraídas; ${registros.filter((r) => Number(r.repeticaoM) === 0).length} repetições zero; SHA256 ${evidencia.sha256}`)
}
