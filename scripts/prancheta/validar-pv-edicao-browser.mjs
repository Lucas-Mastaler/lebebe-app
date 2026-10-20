// Tela real de Registros, respostas HTTP sintéticas. Não acessa banco/produção.
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import { chromium } from 'file:///C:/Users/lebeb/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs'

const repo = fileURLToPath(new URL('../../', import.meta.url))
const server = await createServer({
  configFile: false, root: repo, esbuild: { jsx: 'automatic' },
  define: { 'process.env.NEXT_PUBLIC_PRANCHETA_PRODUTOS_V2': JSON.stringify('0') },
  resolve: { alias: { '@': `${repo}src` } },
  optimizeDeps: { entries: [], include: ['react', 'react-dom/client', 'lucide-react'], exclude: ['next/navigation', 'next/image'] },
  server: { host: '127.0.0.1', port: 3226, strictPort: true, watch: null },
  plugins: [{
    name: 'registros-sinteticos', enforce: 'pre',
    resolveId(id) { if (['next/navigation', 'next/image'].includes(id)) return '\0' + id },
    load(id) {
      if (id === '\0next/navigation') return 'export function useSearchParams(){return new URLSearchParams(location.search)};export function useRouter(){return {push:()=>{},replace:()=>{},refresh:()=>{}}}'
      if (id === '\0next/image') return 'import React from "react";export default function Image({src,alt,className}){return React.createElement("img",{src,alt,className})}'
    },
    configureServer(s) {
      s.middlewares.use(async (req, res, next) => {
        if (req.url !== '/') return next()
        res.setHeader('Content-Type', 'text/html')
        res.end(await server.transformIndexHtml('/', `<!doctype html><html lang="pt-BR"><head><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/src/app/globals.css"></head><body><div id="root"></div><script type="module">import React from 'react';import{createRoot}from'react-dom/client';import Tela from '/src/app/atendimento-presencial/registros/RegistrosPageClient.tsx';createRoot(document.getElementById('root')).render(React.createElement(Tela,{podeVerRegistros:true,podeVerRascunhos:false}));</script></body></html>`))
      })
    },
  }],
})
await server.listen()
const browser = await chromium.launch({ channel: 'msedge', headless: true })
const erros = []
try {
  for (const caso of ['sucesso', 'erro', 'sem-alteracoes', 'ja-fechada', 'pv-menor', 'versao-divergente', 'consulta-falhou', 'legado']) {
    const context = await browser.newContext({ viewport: { width: 390, height: 900 } })
    const page = await context.newPage()
    page.on('pageerror', e => erros.push(e.message))
    const atendimento = { id: 'sintetico', clienteId: 'cliente-sintetica', status: 'concluido', version: 1, versaoFluxo: 2, versaoProdutos: caso === 'legado' ? null : 2, tipoAtendimento: 'cliente', consultoraNomeManual: 'ANA', resultadoAtendimento: caso === 'ja-fechada' ? 'sim' : 'negociacao', numeroLancamento: 123, concluidoEm: '2026-10-20T18:00:00Z', iniciadoEm: '2026-10-20T17:00:00Z' }
    const detalhe = { atendimento, cliente: { id: 'cliente-sintetica', nome: 'CLIENTE SINTÉTICA', telefone: '41988888888' }, criancas: [], departamentos: [{ id: 'dep', departamento: 'enxoval' }], produtosInteresse: [{ id: 'produto', descricao: 'PV', quantidade: 5, vendido: true }], motivos: [], historico: [], podeEditar: true }
    let patchPendente
    let enviado
    await page.route('**/api/**', async route => {
      const req = route.request()
      const url = new URL(req.url())
      const json = body => route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) })
      if (url.pathname.endsWith('/sintetico')) {
        if (req.method() === 'PATCH') { enviado = req.postDataJSON(); patchPendente = route; return }
        if (enviado && caso === 'consulta-falhou') return route.fulfill({ status: 500, contentType: 'application/json', body: '{"ok":false,"message":"Falha sintética na consulta"}' })
        return json({ ok: true, ...detalhe })
      }
      return json({ ok: true, registros: [{ ...atendimento, clienteNome: 'CLIENTE SINTÉTICA', consultoraNomeManual: 'ANA', departamentos: ['enxoval'] }], consultoras: [], unidades: [], total: 1 })
    })
    await page.goto('http://127.0.0.1:3226')
    await page.getByRole('button', { name: 'Editar atendimento', exact: true }).click()
    const editor = page.getByRole('dialog')
    await editor.getByRole('button', { name: 'Sim', exact: true }).click()
    await editor.getByLabel('Numero do lancamento', { exact: false }).fill('123')
    await Promise.all([page.waitForRequest(req => req.method() === 'PATCH'), editor.getByRole('button', { name: 'Salvar edicao', exact: true }).click()])
    assert.ok(patchPendente, 'O formulário deve enviar o PATCH')
    assert.equal(await page.getByRole('heading', { name: 'Parabéns, PV batido!' }).count(), 0)
    if (caso === 'erro') await patchPendente.fulfill({ status: 500, contentType: 'application/json', body: '{"ok":false,"message":"Falha sintética ao salvar"}' })
    else {
      atendimento.version = caso === 'versao-divergente' ? 3 : 2
      atendimento.resultadoAtendimento = 'sim'
      if (caso === 'pv-menor') detalhe.produtosInteresse[0].quantidade = 4
      await patchPendente.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, version: 2, semAlteracoes: caso === 'sem-alteracoes' }) })
    }
    if (caso === 'sucesso') {
      await page.getByRole('heading', { name: 'Parabéns, PV batido!' }).waitFor()
      await page.getByText('Você fechou a venda com 5 peças. 100% da referência de 5.').waitFor()
      await page.getByRole('button', { name: 'Continuar', exact: true }).click()
      await page.reload()
      await page.getByRole('button', { name: 'Editar atendimento', exact: true }).waitFor()
    } else if (caso === 'erro') await editor.getByText('Falha sintética ao salvar').waitFor()
    else if (caso === 'sem-alteracoes') await editor.getByText('Nao houve mudancas para salvar.').waitFor()
    else await editor.waitFor({ state: 'detached' })
    assert.equal(await page.getByRole('heading', { name: 'Parabéns, PV batido!' }).count(), 0)
    await context.close()
  }
  assert.deepEqual(erros, [])
  console.log('Registros real com APIs sintéticas: 8 cenários aprovados; animação somente após PATCH e consulta confirmados, sem repetição por recarga.')
} finally {
  await browser.close()
  await server.close()
}
