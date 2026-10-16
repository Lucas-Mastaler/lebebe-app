// Browser harness isolado: componente real, APIs sinteticas em memoria, sem Supabase/credenciais.
// node scripts/prancheta/homologar-entrega4.mjs; abrir http://127.0.0.1:3203
import { randomUUID } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

const repo = fileURLToPath(new URL('../../', import.meta.url))
const fixtures = new Map()
const evidencias = []
const usuarioId = '00000000-0000-4000-8000-000000000001'
const unidadeId = '00000000-0000-4000-8000-000000000002'
const clienteId = '00000000-0000-4000-8000-000000000003'
const porta = Number(process.env.PRANCHETA_HARNESS_PORT ?? 3203)

function criarFixture(id, modo) {
  const agora = new Date().toISOString()
  const fixture = { modo, id, clienteId: modo === 'inicial' ? null : clienteId, consultoraUsuarioId: usuarioId, unidadeId, status: 'rascunho', draftClientId: randomUUID(),
    dadosRascunho: { consultoraNome: modo === 'inicial' ? '' : 'Consultora Sintetica', criancas: [], departamentos: ['moveis'], produtosInteresse: ['Produto sintetico'],
      versaoFluxo: 2, tipoAtendimento: modo === 'inicial' ? undefined : 'cliente', observacoes: 'Observacao preservada', resultadoAtendimento: undefined, motivosResultado: [], etapaAtual: 'ficha' },
    resultadoAtendimento: null, motivoOutro: null, observacoes: null, numeroLancamento: null, concluidoEm: null,
    iniciadoEm: agora, ultimaAtividadeEm: agora, expiraEm: '2099-01-01T00:00:00.000Z', version: 1,
    criadoPor: usuarioId, atualizadoPor: usuarioId, createdAt: agora, updatedAt: agora, expirado: false }
  fixtures.set(id, fixture)
  return fixture
}

export const server = await createServer({
  configFile: false, root: repo, optimizeDeps: { entries: [], include: ['react', 'react-dom/client', 'lucide-react'] }, server: { host: '127.0.0.1', port: porta, strictPort: true, watch: null },
  resolve: { alias: { '@': `${repo}src` } },
  plugins: [{ name: 'prancheta-next-isolado', enforce: 'pre',
    configureServer(server) { if (globalThis.__pranchetaIntegracaoIsolada) server.middlewares.use(globalThis.__pranchetaIntegracaoIsolada); server.middlewares.use(responder) },
    transform(code, id) {
      // Somente neste harness local: habilitação em memória para testar o caminho de sucesso.
      // Os arquivos da aplicação e os gates SQL/API reais permanecem fechados.
      if (globalThis.__pranchetaIntegracaoIsolada && id.endsWith('/FichaPageClient.tsx')) return code.replace("if (fichaConclusao.versaoFluxo === 2 || fichaConclusao.tipoAtendimento)", 'if (false)')
    },
    resolveId(id) { if (id === 'next/navigation' || id === 'next/link') return `\0${id}` },
    load(id) {
      if (id === '\0next/navigation') return 'export function useRouter(){return {push:(url)=>{window.__pranchetaNavegacoes??=[];window.__pranchetaNavegacoes.push(url)},replace:(url)=>{window.history.replaceState(null,"",url)},refresh:()=>{}}}'
      if (id === '\0next/link') return 'import React from "react";export default function Link(p){return React.createElement("a",p,p.children)}'
    },
  }],
})

async function responder(req, res, next) {
  const url = new URL(req.url, 'http://127.0.0.1:3203')
  const json = (status, body) => { res.statusCode = status; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(body)) }
  if (url.pathname === '/api/atendimento-presencial/consultoras-recentes') return json(200, { ok: true, nomes: ['Ana Clara', 'Beatriz', 'Carla', 'Daniela'] })
  if (url.pathname === '/evidencias') return json(200, evidencias)
  if (url.pathname === '/') {
    const id = url.searchParams.get('rascunho') ?? randomUUID()
    if (!fixtures.has(id)) criarFixture(id, url.searchParams.get('modo') ?? 'inicial')
    const contexto = { perfil: 'gestao', usuarioId, acessoTotal: false, unidadesPermitidas: [{ id: unidadeId, chave: 'sintetica', nome: 'UNIDADE SINTETICA' }] }
    if (url.searchParams.get('unidades') === 'duas') contexto.unidadesPermitidas.push({ id: '00000000-0000-4000-8000-000000000004', chave: 'segunda', nome: 'SEGUNDA UNIDADE' })
    const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/src/app/globals.css"><title>Prancheta — homologacao sintetica</title></head><body><div id="root" class="p-4 sm:p-6"></div><script>window.__pranchetaFixture = ${JSON.stringify({ usuarioId, contextoInicial: contexto, unidadeIdInicial: contexto.unidadesPermitidas.length === 1 ? unidadeId : '', rascunhoIdInicial: url.searchParams.get('modo') === 'novo' ? null : id })};</script><script type="module">import React from 'react';import {createRoot} from 'react-dom/client';import Ficha from '/src/app/atendimento-presencial/prancheta/FichaPageClient.tsx';import {Toaster} from 'sonner';createRoot(document.getElementById('root')).render(React.createElement(React.Fragment,null,React.createElement(Ficha,window.__pranchetaFixture),React.createElement(Toaster,{richColors:true})));</script></body></html>`
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    return res.end(await server.transformIndexHtml(req.url, html))
  }
  if (!url.pathname.startsWith('/api/')) return next()
  evidencias.push({ acao: 'request', method: req.method, path: url.pathname })
  let body
  if (req.method !== 'GET') {
    try { const chunks = []; for await (const chunk of req) chunks.push(chunk); body = JSON.parse(Buffer.concat(chunks).toString()) }
    catch { return json(400, { ok: false, message: 'JSON invalido' }) }
  }
  const criancasPath = url.pathname.match(/^\/api\/atendimento-presencial\/clientes\/([^/]+)\/criancas$/)
  if (criancasPath) {
    const fixture = fixtures.get(body?.rascunhoId ?? url.searchParams.get('rascunhoId'))
    if (!fixture || fixture.clienteId !== criancasPath[1]) return json(403, { ok: false, message: 'Cliente fora do rascunho sintético' })
    if (!fixture.cadastros) {
      fixture.cadastros = fixture.modo === 'sem-criancas' ? [] : [
        { id: '50000000-0000-4000-8000-000000000001', clienteId, origem: 'permanente', parentesco: 'Filha', dados: { id: 'alice-local', situacao: 'ja_nasceu', nome: 'Alice', idadeUnidade: 'anos', idadeValor: 2 }, registradoEm: '2025-10-15' },
        { id: '50000000-0000-4000-8000-000000000002', clienteId, origem: 'permanente', parentesco: 'Sobrinho', dados: { id: 'pedro-local', situacao: 'nao_informado', nome: 'Pedro' }, registradoEm: '2026-10-15' },
      ]
      fixture.historicas = fixture.modo === 'sem-criancas' ? [] : [1,2].map((n) => ({ id: `60000000-0000-4000-8000-00000000000${n}`, clienteId, origem: 'historica', parentesco: null, dados: { id: `historica-${n}`, nome: 'Maria', situacao: 'ja_nasceu', idadeUnidade: 'anos', idadeValor: n }, registradoEm: `202${n+3}-10-15`, atendimentoId: `70000000-0000-4000-8000-00000000000${n}` }))
      fixture.confirmacoes = new Map()
    }
    let confirmadoId
    if (req.method === 'POST') {
      confirmadoId = fixture.confirmacoes.get(body.origemId)
      if (!confirmadoId) {
        const historica = fixture.historicas.find((h) => h.id === body.origemId)
        if (!historica) return json(403, { ok: false, message: 'Origem fora do cliente sintético' })
        confirmadoId = body.associarId || randomUUID()
        if (!body.associarId) fixture.cadastros.push({ ...historica, id: confirmadoId, origem: 'permanente', dados: body.dados, parentesco: body.parentesco })
        fixture.historicas = fixture.historicas.filter((h) => h.id !== body.origemId)
        fixture.confirmacoes.set(body.origemId, confirmadoId)
      }
    }
    return json(200, { ok: true, permanentes: fixture.cadastros, historicas: fixture.historicas, confirmadoId })
  }
  if (url.pathname === '/api/atendimento-presencial/atendimentos/rascunhos' && req.method === 'POST') {
    const fixture = criarFixture(randomUUID(), 'inicial')
    fixture.draftClientId = body.draftClientId
    fixture.dadosRascunho = body.dadosRascunho
    fixture.clienteId = body.clienteId
    return json(200, { ok: true, rascunho: fixture })
  }
  if (url.pathname === '/api/atendimento-presencial/clientes') {
    const cliente = { id: clienteId, nome: body?.nome ?? 'Cliente Sintetica', telefone: '(41) 98888-1234', telefoneFormatado: '(41) 98888-1234',
      parentesco: body?.parentesco ?? 'mae', parentescoLabel: 'Mae', parentescoOutro: body?.parentescoOutro ?? null,
      status: 'ativo', version: 1, origem: {}, criadoEm: '', atualizadoEm: '' }
    if (url.searchParams.has('telefoneExato')) return json(200, { ok: true, ambiguo: false, clientes: url.searchParams.get('telefoneExato') === '41988881234' ? [cliente] : [] })
    return json(200, req.method === 'POST' ? { ok: true, cliente } : { ok: true, clientes: [cliente] })
  }
  if (url.pathname === `/api/atendimento-presencial/clientes/${clienteId}`) return json(200, { ok: true, cliente: {
    id: clienteId, nome: 'Cliente Sintetica', telefone: '(41) 98888-1234', telefoneFormatado: '(41) 98888-1234', parentesco: 'mae', parentescoLabel: 'Mae',
    parentescoOutro: null, status: 'ativo', version: 1, origem: {}, criadoEm: '', atualizadoEm: '',
  } })
  const partes = url.pathname.match(/^\/api\/atendimento-presencial\/atendimentos\/([^/]+)\/(rascunho|concluir)$/)
  const fixture = partes && fixtures.get(partes[1])
  if (!fixture) return json(404, { ok: false, message: 'API fora do cenario sintetico' })
  if (req.method === 'GET') return json(200, { ok: true, rascunho: fixture })
  if ((body.expectedVersion ?? body.version) !== fixture.version) return json(409, { ok: false, message: 'Conflito de versao', rascunho: fixture })
  if (partes[2] === 'rascunho') {
    fixture.dadosRascunho = body.dadosRascunho; fixture.clienteId = body.clienteId; fixture.version++
    evidencias.push({ acao: 'autosave', numeroEmEdicao: body.dadosRascunho.entradasFormulario?.numeroLancamento, version: fixture.version })
    return json(200, { ok: true, rascunho: fixture })
  }
  return json(409, { ok: false, message: 'Conclusão proibida no harness da Entrega 4' })

}

await server.listen()
console.log(`Harness sintetico sem banco: http://127.0.0.1:${porta} (?modo=inicial, ?modo=cliente ou ?modo=sem-criancas)`)
