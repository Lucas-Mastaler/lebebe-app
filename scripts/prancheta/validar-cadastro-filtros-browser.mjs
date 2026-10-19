// UI real, APIs/identidades sintéticas locais. Não acessa Supabase ou produção.
import assert from 'node:assert/strict'
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import { chromium } from 'file:///C:/Users/lebeb/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs'

const repo = fileURLToPath(new URL('../../', import.meta.url))
const unidade = {
  id: '00000000-0000-4000-8000-000000000002',
  nome: 'FILIAL SINTÉTICA',
}
let cliente = {
  id: 'cliente-sintetica',
  nome: 'CLIENTE SINTÉTICA',
  telefone: '41888888888',
  telefoneFormatado: '(41) 88888-8888',
  version: 1,
  parentesco: 'mae',
  parentescoLabel: 'Mãe',
  status: 'ativo',
  origem: {},
  criadoEm: '',
  atualizadoEm: '',
}
const requests = []
const server = await createServer({
  configFile: false,
  root: repo,
  optimizeDeps: {
    entries: [],
    exclude: ['next', 'next/link', 'next/navigation'],
    include: ['react', 'react-dom/client', 'lucide-react'],
  },
  server: { host: '127.0.0.1', port: 3218, strictPort: true, watch: null },
  resolve: { alias: { '@': `${repo}src` } },
  plugins: [
    {
      name: 'cadastro-lista-isolada',
      enforce: 'pre',
      configureServer(s) {
        s.middlewares.use(responder)
      },
      resolveId(id) {
        if (id === 'next/navigation' || id === 'next/link') return '\0' + id
      },
      load(id) {
        if (id === '\0next/navigation')
          return 'export function useSearchParams(){return new URLSearchParams(window.location.search)};export function useRouter(){return {push:(url)=>{window.__navegou=url},replace:()=>{},refresh:()=>{}}}'
        if (id === '\0next/link')
          return 'import React from "react";export default function Link(p){return React.createElement("a",p,p.children)}'
      },
    },
  ],
})
async function responder(req, res, next) {
  const url = new URL(req.url, 'http://localhost')
  const json = (body, status = 200) => {
    res.statusCode = status
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify(body))
  }
  if (url.pathname === '/') {
    const modulo =
      url.searchParams.get('tela') === 'clientes'
        ? '/src/app/atendimento-presencial/clientes/PageClient.tsx'
        : '/src/app/atendimento-presencial/registros/RegistrosPageClient.tsx'
    const html = `<!doctype html><html lang="pt-BR"><head><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/src/app/globals.css"></head><body><div id="root" class="p-4 sm:p-6"></div><script type="module">import React from 'react';import{createRoot}from'react-dom/client';import Tela from '${modulo}';createRoot(document.getElementById('root')).render(React.createElement(Tela,{podeVerRegistros:true,podeVerRascunhos:true}));</script></body></html>`
    res.setHeader('Content-Type', 'text/html')
    res.end(await server.transformIndexHtml(req.url, html))
    return
  }
  if (!url.pathname.startsWith('/api/')) return next()
  requests.push({ path: url.pathname, query: url.search, method: req.method })
  const clientes = await server.ssrLoadModule(
    '/src/lib/atendimento-presencial/clientes.ts',
  )
  if (
    url.pathname === '/api/atendimento-presencial/clientes' &&
    req.method === 'GET'
  )
    return json({
      ok: true,
      clientes: [cliente],
      consultoras: [],
      meta: { page: 1, total: 1, totalPages: 1, pageSize: 20 },
    })
  if (
    url.pathname === '/api/atendimento-presencial/clientes/' + cliente.id &&
    req.method === 'PATCH'
  ) {
    const chunks = []
    for await (const c of req) chunks.push(c)
    const payload = JSON.parse(Buffer.concat(chunks).toString())
    const validacao = clientes.validarAtualizacaoCliente(payload)
    if (!validacao.ok) return json(validacao, 422)
    if (payload.version !== cliente.version)
      return json({ ok: false, message: 'Conflito de versão', cliente }, 409)
    cliente = {
      ...cliente,
      nome: validacao.campos.nome ?? cliente.nome,
      version: cliente.version + 1,
    }
    return json({ ok: true, cliente })
  }
  if (url.pathname.endsWith('/rascunhos')) {
    const filtro = await server.ssrLoadModule(
      '/src/lib/atendimento-presencial/filtros-listagem.ts',
    )
    const rows = Array.from({ length: 24 }, (_, i) => ({
      id: 'rascunho-' + i,
      clienteNome: 'CLIENTE PENDENTE ' + i,
      clienteCadastroPendente: true,
      clienteTelefone: '41996465656',
      consultoraNome: 'ANA',
      unidadeId: unidade.id,
      tipoAtendimento: null,
      ultimaAtividadeEm: '2026-10-19T13:00Z',
      expiraEm: '2099-01-01T00:00Z',
    }))
    const filtrados = rows.filter((row) =>
      filtro.correspondeNome(
        row.clienteNome,
        url.searchParams.get('clienteNome') ?? '',
      ),
    )
    const page = Number(url.searchParams.get('page') ?? 1)
    return json({
      ok: true,
      rascunhos: filtrados.slice((page - 1) * 20, page * 20),
      total: filtrados.length,
      page,
      consultorasDisponiveis: [{ nome: 'ANA' }],
      contexto: { unidadesPermitidas: [unidade] },
    })
  }
  if (url.pathname === '/api/atendimento-presencial/atendimentos')
    return json({
      ok: true,
      registros: [],
      consultoras: [{ nome: 'ANA' }],
      unidades: [unidade],
      total: 0,
      clientesUnicos: 0,
      visitasNaoClientes: 0,
    })
  return json({ ok: false, message: 'Fora do cenário sintético' }, 404)
}

await server.listen()
const browser = await chromium.launch({ channel: 'msedge', headless: true })
const erros = []
let fichaServer
try {
  const context = await browser.newContext({
    viewport: { width: 390, height: 900 },
  })
  const page = await context.newPage()
  page.on('pageerror', (error) => erros.push(error.message))
  await page.goto('http://127.0.0.1:3218/?tela=clientes')
  await page
    .getByRole('button', { name: 'Editar cliente', exact: true })
    .click()
  await page
    .getByText('Telefone existente precisa de revisão.', { exact: false })
    .waitFor()
  await page.locator('#editar-cliente-nome').fill('CLIENTE CORRIGIDA')
  await page
    .getByRole('button', { name: 'Salvar cliente', exact: true })
    .last()
    .click()
  await page.getByText('Cliente atualizada.', { exact: true }).waitFor()
  assert.equal(cliente.nome, 'CLIENTE CORRIGIDA')
  assert.equal(cliente.telefone, '41888888888')
  await page.screenshot({
    path: 'output/cadastro-editor-mobile.png',
    fullPage: true,
  })
  await page.getByRole('button', { name: 'Fechar', exact: true }).last().click()
  await page.goto('http://127.0.0.1:3218/?tab=rascunhos')
  await page.getByText('24 rascunhos encontrados', { exact: false }).waitFor()
  const antes = requests.length
  await page.locator('#rascunho-cliente').fill('PENDENTE')
  await page.waitForTimeout(300)
  assert.equal(requests.length, antes, 'digitar não consulta')
  await page.getByRole('button', { name: 'Filtrar', exact: true }).click()
  await page.getByRole('button', { name: 'Próxima', exact: true }).click()
  await page.getByText('CLIENTE PENDENTE 20', { exact: true }).waitFor()
  assert.ok(await page.getByText('Cadastro pendente', { exact: true }).count())
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  )
  await page.screenshot({
    path: 'output/cadastro-rascunhos-mobile.png',
    fullPage: true,
  })
  await page.reload()
  await page.getByText('CLIENTE PENDENTE 20', { exact: true }).waitFor()
  assert.equal(await page.locator('#rascunho-cliente').inputValue(), 'PENDENTE')
  await page.setViewportSize({ width: 1366, height: 900 })
  await page.goto('http://127.0.0.1:3218/?tab=finalizados')
  await page.getByText('clientes únicos', { exact: false }).waitFor()
  await page
    .getByRole('button', { name: 'Todos os departamentos', exact: true })
    .click()
  await page.getByText('MOVEIS', { exact: true }).click()
  await page.keyboard.press('Escape')
  await page
    .locator('[data-radix-popper-content-wrapper]')
    .waitFor({ state: 'detached' })
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  )
  await page.screenshot({
    path: 'output/cadastro-filtros-desktop.png',
    fullPage: true,
  })

  // Reproduz o cadastro relatado na Prancheta real, com validação compartilhada
  // no servidor sintético e sem finalizar atendimento.
  process.env.PRANCHETA_HARNESS_PORT = '3219'
  fichaServer = (await import('./homologar-entrega4.mjs')).server
  const validadores = await server.ssrLoadModule(
    '/src/lib/atendimento-presencial/clientes.ts',
  )
  let vinculada = null
  await page.route(
    (url) => url.pathname === '/api/atendimento-presencial/clientes',
    async (route) => {
      if (route.request().method() !== 'POST') return route.continue()
      const payload = route.request().postDataJSON()
      assert.equal(validadores.validarPayloadCliente(payload).ok, true)
      vinculada = {
        ...cliente,
        id: '00000000-0000-4000-8000-000000000003',
        nome: payload.nome,
        telefone: payload.telefone,
        telefoneFormatado: payload.telefone,
        version: 1,
      }
      return route.fulfill({ json: { ok: true, cliente: vinculada } })
    },
  )
  await page.route(
    '**/api/atendimento-presencial/clientes/00000000-0000-4000-8000-000000000003',
    async (route) => {
      if (route.request().method() === 'PATCH') {
        const body = route.request().postDataJSON()
        assert.equal(validadores.validarAtualizacaoCliente(body).ok, true)
        vinculada = {
          ...vinculada,
          nome: body.nome ?? vinculada.nome,
          version: vinculada.version + 1,
        }
      }
      return route.fulfill({ json: { ok: true, cliente: vinculada } })
    },
  )
  await page.goto('http://127.0.0.1:3219/?modo=novo')
  await page.locator('#consultora-nome').fill('ana')
  await page.getByRole('button', { name: 'Cliente', exact: true }).click()
  await page.locator('#nova-cliente-nome').fill('CASO SINTÉTICO')
  await page.locator('#telefone-cliente-rapido').fill('41 99646-5656')
  await page
    .getByRole('button', { name: 'Cadastrar e vincular', exact: true })
    .click()
  await page.getByText('Cliente vinculada', { exact: true }).waitFor()
  assert.equal(vinculada.telefone, '(41) 99646-5656')
  await page
    .getByRole('button', { name: 'Editar cliente', exact: true })
    .click()
  await page.locator('#editar-cliente-nome').fill('CASO CORRIGIDO')
  await page
    .getByRole('button', { name: 'Salvar cliente', exact: true })
    .click()
  await page.getByText('Cliente atualizada.', { exact: true }).waitFor()
  assert.equal(vinculada.id, '00000000-0000-4000-8000-000000000003')
  assert.equal(vinculada.nome, 'CASO CORRIGIDO')
  await page.screenshot({
    path: 'output/cadastro-prancheta-editor.png',
    fullPage: true,
  })
  assert.deepEqual(erros, [])
  writeFileSync(
    'output/cadastro-browser.json',
    JSON.stringify(
      {
        cadastroRelatadoNaPrancheta: true,
        editorVinculadoNaPrancheta: true,
        editorNomeSemAlterarTelefone: true,
        filtrosManuais: true,
        paginaERestauracao: true,
        multiselect: true,
        semOverflow: true,
        erros,
      },
      null,
      2,
    ),
  )
  console.log(
    'Browser sintético aprovado: editor, telefone legado, filtros manuais, paginação/retorno, multiselect, 390px/1366px, zero erros JS.',
  )
} catch (error) {
  const page = browser.contexts()[0]?.pages()[0]
  if (page)
    await page.screenshot({
      path: 'output/cadastro-browser-falha.png',
      fullPage: true,
    })
  throw error
} finally {
  await browser.close()
  if (fichaServer) await fichaServer.close()
  await server.close()
}
