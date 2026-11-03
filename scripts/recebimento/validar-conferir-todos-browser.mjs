// Browser fixture of the actual PageClient. No real login/API/database is used.
// node scripts/recebimento/validar-conferir-todos-browser.mjs <test-tools-directory>
import assert from 'node:assert/strict'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { createServer } from 'node:http'
import { resolve } from 'node:path'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const tools = createRequire(resolve(process.argv[2], 'package.json'))
const { build } = tools('esbuild')
const { chromium } = tools('playwright')
const postcss = require('postcss')
const tailwind = require('@tailwindcss/postcss')
const output = resolve('output/recebimento-conferir-todos-validacao')
await mkdir(output, { recursive: true })

const bundle = await build({
  stdin: {
    contents: `import React from 'react'; import {createRoot} from 'react-dom/client';
      import Page from './src/app/recebimento/[id]/PageClient';
      createRoot(document.getElementById('root')).render(<><p style={{padding:8,fontSize:12}}>Teste local com dados sintéticos — sem sessão real</p><Page /></>);`,
    resolveDir: process.cwd(), loader: 'tsx',
  },
  bundle: true, write: false, platform: 'browser', jsx: 'automatic',
  define: { 'process.env.NODE_ENV': '"development"' },
  plugins: [{ name: 'isolated-fixture', setup(b) {
    b.onResolve({ filter: /^next\/navigation$/ }, () => ({ path: 'navigation', namespace: 'fixture' }))
    b.onResolve({ filter: /^(.*\/)?lib\/supabase\/client$/ }, () => ({ path: 'auth', namespace: 'fixture' }))
    b.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: args.path === 'navigation'
      ? `const router={push:()=>{}}; export const useRouter=()=>router; export const useParams=()=>({id:'fixture'});`
      : `import {MATIC_ALLOWED_EMAILS} from '${resolve('src/lib/auth/matic-emails.ts').replaceAll('\\', '/')}'; export const createClient=()=>({auth:{getUser:async()=>({data:{user:{email:MATIC_ALLOWED_EMAILS[0]}}})}});`, loader: 'ts', resolveDir: process.cwd() }))
  } }],
})
const cssSource = (await readFile('src/app/globals.css', 'utf8')).replace('@import "tailwindcss";',
  `@import "tailwindcss" source(none);\n@source "${resolve('src/app/recebimento').replaceAll('\\', '/')}";\n@source "${resolve('src/components').replaceAll('\\', '/')}";`)
const css = (await postcss([tailwind()]).process(cssSource, { from: resolve('src/app/globals.css') })).css

function fixture(status = 'aberto') {
  return {
    id: 'fixture', status, data_inicio: '2026-11-03T10:00:00Z', periodo_inicio: '2026-11-03', periodo_fim: '2026-11-03',
    motorista: 'Motorista sintético', nfes: [], pausas: [], total_previsto: 30, total_recebido: 0,
    timer_rodando: false, timer_segundos_totais: 0, timer_ultima_acao: null,
    itens: [{ id: 'produto', recebimento_id: 'fixture', nfe_item_id: 'nf-item', volumes_por_item: 3,
      volumes_previstos_total: 30, volumes_recebidos_total: 0, status_calculado: 'pendente',
      sku_descricao: 'Produto de teste com descrição longa para conferir o cabeçalho no celular',
      sku_corredor_sugerido: 'A', sku_prateleira_sugerida: '1', sku_nivel_sugerido: '2',
      divergencia_tipo: 'avaria', divergencia_obs: 'Preservar esta observação', avaria_foto_url: 'foto-sintetica',
      is_os: false, sku_existe: true, nf_sources: ['1001', '1002'],
      nfe_item: { codigo_produto: 'TESTE', descricao: 'Produto sintético', quantidade: 4, volumes_por_item: 3 },
      recebimento_item_volumes: [1, 2, 3].map(n => ({ id: 'vol-' + n, volume_numero: n, qtd_prevista: 10, qtd_recebida: 0 })),
    }],
  }
}
let state = fixture()
let posts = 0
let delay = 0
let failure = null
let failRead = false
let commitOnFailure = false
function resultado() {
  const item = state.itens[0]
  return { volumes: item.recebimento_item_volumes, item_total_recebido: item.volumes_recebidos_total,
    item_total_previsto: item.volumes_previstos_total, item_status: item.status_calculado, pausa_criada: null }
}
function complete() {
  const item = state.itens[0]
  item.recebimento_item_volumes.forEach(v => { v.qtd_recebida = v.qtd_prevista })
  item.volumes_recebidos_total = state.total_recebido = 30
  item.status_calculado = 'concluido'
}
const server = createServer(async (req, res) => {
  if (req.url === '/fixture.js') { res.setHeader('Content-Type', 'text/javascript'); return res.end(bundle.outputFiles[0].text) }
  if (req.url === '/fixture.css') { res.setHeader('Content-Type', 'text/css'); return res.end(css) }
  if (req.url.startsWith('/api/')) {
    res.setHeader('Content-Type', 'application/json')
    if (req.url === '/api/recebimento/fixture' && req.method === 'GET') {
      if (failRead) { res.statusCode = 503; return res.end('{}') }
      return res.end(JSON.stringify(state))
    }
    if (req.method === 'POST' && /conferir-todos|\/volume\//.test(req.url)) {
      posts++
      await new Promise(resolve => setTimeout(resolve, delay))
      if (failure) {
        if (commitOnFailure) complete()
        res.statusCode = failure
        return res.end(JSON.stringify({ error: failure === 422 ? 'Revise a configuração dos volumes deste produto antes de conferir.' : 'Falha sintética' }))
      }
      if (req.url.endsWith('conferir-todos')) complete()
      else {
        let body = ''
        for await (const chunk of req) body += chunk
        const delta = JSON.parse(body).delta
        const item = state.itens[0]
        const n = Number(req.url.split('/').at(-1))
        item.recebimento_item_volumes[n - 1].qtd_recebida += delta
        item.volumes_recebidos_total = state.total_recebido = item.recebimento_item_volumes.reduce((a, v) => a + v.qtd_recebida, 0)
        item.status_calculado = item.volumes_recebidos_total === 30 ? 'concluido' : 'parcial'
      }
      return res.end(JSON.stringify(resultado()))
    }
    return res.end('{}')
  }
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/fixture.css"></head><body style="padding:12px;background:#f8fafc"><div id="root"></div><script src="/fixture.js"></script></body></html>')
})
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true })
const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
const erros = []
page.on('pageerror', error => erros.push(error.message))
const url = `http://127.0.0.1:${server.address().port}`
async function load() {
  await page.goto(url)
  await page.getByRole('button', { name: /Conferir todos os volumes/ }).waitFor()
}
async function habilitado(locator) { assert.equal(await locator.isDisabled(), false) }
const conferir = () => page.getByRole('button', { name: /Conferir todos os volumes/ })
try {
  await load()
  await page.screenshot({ path: resolve(output, 'mobile-antes.png'), fullPage: true })
  delay = 500
  await conferir().evaluate(el => { el.click(); el.click() })
  await page.getByText('Conferindo…', { exact: true }).waitFor()
  assert.equal(await page.getByRole('button', { name: 'Finalizar', exact: true }).isDisabled(), true)
  assert.equal(await page.getByRole('button', { name: 'Local', exact: true }).isDisabled(), true)
  await page.getByText('Conferido', { exact: true }).waitFor()
  assert.equal(posts, 1)
  assert.equal(await page.getByText('10/10', { exact: true }).count(), 3)
  assert.equal(state.itens[0].divergencia_tipo, 'avaria')
  await page.screenshot({ path: resolve(output, 'mobile-conferido.png'), fullPage: true })
  await page.reload()
  await page.getByText('Conferido', { exact: true }).waitFor()
  await page.getByRole('button', { name: '−', exact: true }).first().click()
  await page.getByText('9/10', { exact: true }).waitFor()
  await habilitado(conferir())
  console.log('OK mobile: duplo clique, loading, bloqueios, 3×10/10, reload e ajuste -1')

  state = fixture(); failure = 422; delay = 0; posts = 0
  await load(); await conferir().click()
  await page.getByRole('alert').filter({ hasText: 'Revise a configuração' }).waitFor()
  await habilitado(conferir())
  assert.equal(state.total_recebido, 0)
  console.log('OK erro de validação preserva quantidade e libera nova tentativa')

  state = fixture(); failure = 503; failRead = true; commitOnFailure = true; posts = 0
  failRead = false; await load(); failRead = true; await conferir().click()
  await page.getByRole('button', { name: 'Consultar novamente' }).waitFor()
  assert.equal(await conferir().isDisabled(), true)
  assert.equal(await page.getByRole('button', { name: 'Finalizar', exact: true }).isDisabled(), true)
  assert.equal(posts, 1)
  failRead = false
  await page.getByRole('button', { name: 'Consultar novamente' }).click()
  await page.getByText('Conferido', { exact: true }).waitFor()
  assert.equal(posts, 1)
  console.log('OK gravação confirmada após falha: bloqueia até consultar servidor, sem repetir POST')

  failure = null; commitOnFailure = false; state = fixture()
  await page.setViewportSize({ width: 1280, height: 900 })
  await load()
  await page.screenshot({ path: resolve(output, 'desktop-antes.png'), fullPage: true })
  await conferir().click(); await page.getByText('Conferido', { exact: true }).waitFor()
  await page.screenshot({ path: resolve(output, 'desktop-conferido.png'), fullPage: true })
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
  for (const status of ['fechado', 'cancelado']) {
    state = fixture(status); await page.reload(); await page.getByText('Conferência', { exact: true }).waitFor()
    assert.equal(await conferir().count(), 0)
  }
  assert.deepEqual(erros, [])
  console.log('OK desktop, ocultação fechado/cancelado e ausência de erros JavaScript')
  await writeFile(resolve(output, 'browser-result.json'), JSON.stringify({ passed: true, pageErrors: erros, synthetic: true }, null, 2))
} finally {
  await browser.close()
  await new Promise(resolve => server.close(resolve))
}
