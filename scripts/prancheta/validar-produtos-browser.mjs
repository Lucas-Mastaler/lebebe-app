// Componentes reais; estado e atendimento sintéticos locais. Não é E2E autenticado.
import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import { chromium } from 'file:///C:/Users/lebeb/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs'

const repo = fileURLToPath(new URL('../../', import.meta.url))
const server = await createServer({
  configFile: false, root: repo,
  esbuild: { jsx: 'automatic' },
  optimizeDeps: { entries: [], include: ['react', 'react-dom/client', 'lucide-react'], exclude: ['next/image'] },
  resolve: { alias: { '@': `${repo}src` } },
  server: { host: '127.0.0.1', port: process.argv.includes('--servir') ? 3224 : 3225, strictPort: true, watch: null },
  // Em Vite só substitui o otimizador de imagem do Next; o BrandLogo/PNG são reais.
  plugins: [{name:'next-image-fixture',enforce:'pre',resolveId(id){if(id==='next/image')return '\0next-image-fixture'},load(id){if(id==='\0next-image-fixture')return `import React from 'react';export default function Image({src,alt,fill,sizes,className}){return React.createElement('img',{src,alt,sizes,className,style:fill?{position:'absolute',height:'100%',width:'100%',inset:0}:undefined})}`}}, { name: 'produtos-fixture', configureServer(s) {
    s.middlewares.use(async (req, res, next) => {
      const path = req.url?.split('?')[0]
      if (path === '/fixture/concluir') {
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ id: 'atendimento-sintetico', status: 'concluido', resultadoAtendimento: 'sim' }))
        return
      }
      if (path !== '/' && path !== '/preview-pv-batido') return next()
      if (path === '/preview-pv-batido') {
        const html = `<!doctype html><html lang="pt-BR"><head><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/src/app/globals.css"></head><body><main id="root"></main><script type="module">import React from 'react';import{createRoot}from'react-dom/client';import Preview from '/src/app/preview-pv-batido/page.tsx';createRoot(document.getElementById('root')).render(React.createElement(Preview));</script></body></html>`
        res.setHeader('Content-Type', 'text/html')
        res.end(await server.transformIndexHtml(req.url, html))
        return
      }
      const html = `<!doctype html><html lang="pt-BR"><head><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/src/app/globals.css"></head><body><main id="root" class="mx-auto max-w-2xl p-3"></main><script type="module">
        import React, {useState} from 'react';import {ShoppingBag} from 'lucide-react';import{createRoot}from'react-dom/client';
        import{ProdutosAtendimento}from'/src/components/atendimento-presencial/ProdutosAtendimento.tsx';import{ListaEnxovalDialog}from'/src/components/atendimento-presencial/ListaEnxovalDialog.tsx';
        import{Section}from'/src/components/design-system/Section.tsx';
        import{ComemoracaoPv}from'/src/components/atendimento-presencial/ComemoracaoPv.tsx';
        import{useComemoracaoPv}from'/src/components/atendimento-presencial/useComemoracaoPv.ts';
        function Tela(){const modo=new URLSearchParams(location.search).get('modo') ?? ${process.argv.includes('--servir') ? "'referencia'" : 'null'};const inicial=modo==='referencia'?[{descricao:'BERÇO',quantidade:1,vendido:true},{descricao:'CÔMODA',quantidade:1,vendido:true},{descricao:'POLTRONA',quantidade:2,vendido:false},{descricao:'NANINHA',quantidade:1,vendido:true}]:modo==='legado'?['Berço','berco']:modo==='limite'?Array.from({length:20},(_,i)=>({descricao:'PRODUTO '+i,quantidade:1,vendido:false})):[];const[ficha,setFicha]=useState({criancas:[],departamentos:[],motivosResultado:[],etapaAtual:'ficha',...(modo==='legado'?{}:{versaoProdutos:2}),produtosInteresse:inicial,resultadoAtendimento:modo==='referencia'?'sim':'negociacao'});const[digitado,setDigitado]=useState('');window.fixtureFicha=ficha;
        const{comemoracao,prepararSom,confirmarVenda,fecharComemoracao}=useComemoracaoPv();window.fixtureEditar=(atendimento,dados,resultadoAnterior)=>confirmarVenda(atendimento,dados,{resultadoAnterior});
        async function concluir(){void prepararSom();const dados=structuredClone(ficha);const response=await fetch('/fixture/concluir',{method:'POST'});if(!response.ok)return;const atendimento=await response.json();window.fixtureUltimo={atendimento,dados};confirmarVenda(atendimento,dados)}
        return React.createElement(React.Fragment,null,React.createElement('form',{onSubmit:e=>{e.preventDefault();window.fixtureSubmit=true}},React.createElement(Section,{title:'Departamentos'},'Departamentos'),React.createElement(ListaEnxovalDialog),React.createElement(Section,{title:'Produtos de interesse',description:'Registre produtos em texto livre quando a cliente citar itens específicos.',tone:'section-2',icon:React.createElement(ShoppingBag,{size:20})},React.createElement(ProdutosAtendimento,{ficha,atualizar:setFicha,digitado,setDigitado})),React.createElement('div',{className:'mt-4'},React.createElement(Section,{title:'Observações sobre esse atendimento',tone:'section-2'},React.createElement('label',null,'Observação',React.createElement('input',{'aria-label':'Observação',defaultValue:'PREENCHIMENTO PRESERVADO',className:'mt-2 w-full rounded-lg border bg-white p-3'})))),React.createElement('button',{type:'button',onClick:concluir},'Simular finalização'),React.createElement('button',{type:'button',onClick:()=>confirmarVenda(window.fixtureUltimo.atendimento,window.fixtureUltimo.dados)},'Repetir resposta')),comemoracao&&React.createElement(ComemoracaoPv,{dados:comemoracao,onFechar:fecharComemoracao}));}createRoot(document.getElementById('root')).render(React.createElement(Tela));
      </script></body></html>`
      res.setHeader('Content-Type', 'text/html')
      res.end(await server.transformIndexHtml(req.url, html))
    })
  } }],
})
await server.listen()
if (process.argv.includes('--servir')) {
  console.log('Prévia local com dados sintéticos, sem gravar no banco: http://localhost:3224')
  await new Promise(() => {})
}
const browser = await chromium.launch({ headless: true, channel: 'msedge' })
const erros = []
const resultados = []
mkdirSync('output/produtos-pv', { recursive: true })
try {
  for (const width of [320, 390, 1366]) {
    const context = await browser.newContext({ viewport: { width, height: 900 } })
    const page = await context.newPage()
    page.on('pageerror', e => erros.push(e.message))
    await page.goto('http://127.0.0.1:3225')
    const entrada = page.getByLabel('Produtos de interesse', { exact: true })
    await entrada.fill('  berço  ')
    assert.equal(await entrada.inputValue(), '  BERÇO  ')
    await entrada.press('Enter')
    await page.getByRole('button', { name: 'Adicionar produto', exact: true }).click()
    assert.equal(await page.evaluate(() => window.fixtureFicha.produtosInteresse[0].quantidade), 1)
    await page.getByRole('button', { name: 'Vendido: BERÇO', exact: true }).click()
    await entrada.fill('berco')
    await entrada.press('Enter')
    assert.deepEqual(await page.evaluate(() => window.fixtureFicha.produtosInteresse), [{ descricao: 'BERÇO', quantidade: 2, vendido: true }])
    const plus = page.getByRole('button', { name: 'Aumentar quantidade de BERÇO', exact: true })
    await plus.click({ clickCount: 2 })
    assert.equal(await page.evaluate(() => window.fixtureFicha.produtosInteresse[0].quantidade), 4)
    await plus.click()
    await page.getByText('PV: 5', { exact: true }).waitFor()
    const barra = page.getByRole('progressbar')
    const verde = await barra.locator('div').evaluate(el => getComputedStyle(el).backgroundColor)
    assert.ok((await barra.locator('div').getAttribute('class')).includes('bg-emerald-600'))
    await plus.click()
    await page.getByText('120%', { exact: true }).waitFor()
    await plus.click()
    await page.getByText('140%', { exact: true }).waitFor()
    assert.equal(await barra.locator('div').evaluate(el => el.style.width), '100%')
    await page.getByRole('button', { name: 'Diminuir quantidade de BERÇO', exact: true }).click({clickCount:2})
    await page.getByRole('button', { name: 'Diminuir quantidade de BERÇO', exact: true }).click()
    assert.ok((await barra.locator('div').getAttribute('class')).includes('bg-red-600'))
    assert.notEqual(await barra.locator('div').evaluate(el => getComputedStyle(el).backgroundColor), verde)
    await page.getByRole('button', { name: 'Vendido: BERÇO', exact: true }).click()
    await page.getByText('PV: 0', { exact: true }).waitFor()
    assert.equal(await page.evaluate(() => window.fixtureFicha.produtosInteresse[0].quantidade), 4)
    await page.getByRole('button', { name: 'Vendido: BERÇO', exact: true }).click()
    await entrada.fill('POLTRONA COM NOME MUITO LONGO SEM SOBREPOR OS CONTROLES')
    await entrada.press('Enter')
    // Edição permite duplicar; inclusão continua incrementando a primeira linha.
    const nomeLongo = 'POLTRONA COM NOME MUITO LONGO SEM SOBREPOR OS CONTROLES'
    await page.getByRole('button', {name:`Editar nome de ${nomeLongo}, linha 2`,exact:true}).click()
    const editar = page.getByLabel('Nome do produto na linha 2',{exact:true})
    await editar.fill('  berço   ')
    await editar.press('Enter')
    await entrada.fill(' berco ')
    await entrada.press('Enter')
    assert.deepEqual(await page.evaluate(()=>window.fixtureFicha.produtosInteresse),[{descricao:'BERÇO',quantidade:5,vendido:true},{descricao:'BERÇO',quantidade:1,vendido:false}])
    await page.getByRole('button',{name:'Editar nome de BERÇO, linha 2',exact:true}).click()
    await editar.fill('CANCELAR')
    await editar.press('Escape')
    assert.equal(await page.evaluate(()=>window.fixtureFicha.produtosInteresse[1].descricao),'BERÇO')
    await page.getByRole('button',{name:'Editar nome de BERÇO, linha 2',exact:true}).click()
    await editar.fill('   ')
    await editar.press('Enter')
    assert.ok(await page.getByRole('alert').isVisible())
    await editar.fill(nomeLongo)
    await entrada.click()
    assert.equal(await page.evaluate(()=>window.fixtureFicha.produtosInteresse[1].descricao),nomeLongo)
    assert.equal(await page.getByRole('button',{name:'Vendido: BERÇO',exact:true}).textContent(),'Vendido')
    assert.equal(await page.getByRole('button',{name:`Vendido: ${nomeLongo}`,exact:true}).textContent(),'Marcar')
    const ordem = await page.evaluate(()=>{
      const entrada = document.querySelector('input[placeholder="Adicionar produto..."]')
      const toolbar = [...document.querySelectorAll('button')].find(el=>el.textContent==='PV')
      const header = [...document.querySelectorAll('span')].find(el=>el.textContent==='Vendido')
      return Boolean(entrada.compareDocumentPosition(toolbar)&Node.DOCUMENT_POSITION_FOLLOWING)&&Boolean(toolbar.compareDocumentPosition(header)&Node.DOCUMENT_POSITION_FOLLOWING)
    })
    assert.ok(ordem)
    await page.getByRole('button', { name: 'Produto que não trabalhamos', exact: true }).click()
    assert.equal(await page.getByRole('button', { name: 'Vendido: PRODUTO QUE NÃO TRABALHAMOS', exact: true }).count(), 0)
    assert.ok(await page.getByText(/Há produtos marcados como vendidos/).isVisible())
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    const alvos = await page.getByRole('button', { name: /quantidade de|Vendido:|Remover/ }).evaluateAll(nodes => nodes.filter(n => !n.disabled).map(n => ({ w:n.getBoundingClientRect().width,h:n.getBoundingClientRect().height })))
    assert.ok(alvos.every(a => a.w >= 44 && a.h >= 44), JSON.stringify(alvos))
    await page.screenshot({ path: `output/produtos-pv/produtos-${width}.png`, fullPage: true })
    await page.getByRole('button', { name: 'Remover POLTRONA COM NOME MUITO LONGO SEM SOBREPOR OS CONTROLES', exact: true }).click()
    assert.equal(await page.evaluate(() => window.fixtureFicha.produtosInteresse.some(p => p.descricao.startsWith('POLTRONA'))), false)
    assert.equal(await page.evaluate(() => window.fixtureFicha.produtosInteresse[0].quantidade), 5)
    const antes = await page.evaluate(() => JSON.stringify(window.fixtureFicha))
    const imagens = []
    page.on('request', req => { if (req.url().includes('/listas-enxoval/')) imagens.push(req.url()) })
    await page.getByRole('button', { name: 'Ver lista de enxoval', exact: true }).click()
    const dialog = page.getByRole('dialog')
    const img = dialog.getByRole('img')
    await img.evaluate(el => el.decode())
    assert.equal(imagens.length, 1)
    for (const estacao of ['Verão', 'Inverno']) {
      await dialog.getByRole('button', { name: estacao, exact: true }).click()
      for (let pagina=1;pagina<=4;pagina++) {
        await dialog.getByRole('img', { name: `Lista de enxoval ${estacao}, página ${pagina} de 4` }).evaluate(el => el.decode())
        assert.ok((await dialog.getByRole('link', { name:'Abrir imagem original' }).getAttribute('href')).endsWith(`-${pagina}.png`))
        if(pagina<4) await dialog.getByRole('button', { name:'Próxima', exact:true }).click()
      }
      assert.ok(await dialog.getByRole('button', { name:'Próxima', exact:true }).isDisabled())
    }
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    await page.screenshot({path:`output/produtos-pv/enxoval-${width}.png`})
    await page.keyboard.press('Escape')
    assert.equal(await page.evaluate(() => JSON.stringify(window.fixtureFicha)), antes)
    assert.equal(await page.getByLabel('Observação', {exact:true}).inputValue(), 'PREENCHIMENTO PRESERVADO')
    assert.equal(await page.evaluate(() => window.fixtureSubmit ?? false),false)
    assert.ok(await page.getByRole('button',{name:'Ver lista de enxoval',exact:true}).evaluate(el=>el===document.activeElement))
    if (width === 390) {
      await page.route('**/listas-enxoval/inverno-4.png', route => route.abort())
      await page.getByRole('button', { name: 'Ver lista de enxoval', exact: true }).click()
      await dialog.getByText('Não foi possível carregar esta página.').waitFor()
      await page.unroute('**/listas-enxoval/inverno-4.png')
      await dialog.getByRole('button', { name: 'Tentar novamente', exact: true }).click()
      await dialog.getByRole('img').evaluate(el => el.decode())
      assert.equal(await page.evaluate(() => JSON.stringify(window.fixtureFicha)), antes)
      await page.keyboard.press('Escape')
    }
    await page.goto('http://127.0.0.1:3225')
    const atalhoPv = page.getByRole('button', { name: 'PV', exact: true })
    await atalhoPv.click()
    await atalhoPv.click()
    assert.deepEqual(await page.evaluate(() => window.fixtureFicha.produtosInteresse), [{ descricao: 'PV', quantidade: 2, vendido: false }])
    await page.getByRole('button', { name: 'Vendido: PV', exact: true }).click()
    await page.getByText('PV: 2', { exact: true }).waitFor()
    const enxoval = await page.getByRole('button', { name: 'Ver lista de enxoval', exact: true }).boundingBox()
    const produtos = await page.getByRole('heading', { name: 'Produtos de interesse', exact: true }).boundingBox()
    assert.ok(enxoval.y + enxoval.height <= produtos.y)
    assert.ok(enxoval.width >= Math.min(width - 24, 600))
    await page.goto('http://127.0.0.1:3225?modo=legado')
    await page.getByText('PV não informado',{exact:true}).waitFor()
    await page.getByLabel('Produtos de interesse',{exact:true}).fill('BERCO')
    await page.getByLabel('Produtos de interesse',{exact:true}).press('Enter')
    assert.deepEqual(await page.evaluate(()=>window.fixtureFicha.produtosInteresse),[{descricao:'Berço',quantidade:1,vendido:null},{descricao:'berco',quantidade:null,vendido:null}])
    await page.goto('http://127.0.0.1:3225?modo=limite')
    await page.getByLabel('Produtos de interesse',{exact:true}).fill('produto 0')
    await page.getByLabel('Produtos de interesse',{exact:true}).press('Enter')
    assert.equal(await page.evaluate(()=>window.fixtureFicha.produtosInteresse[0].quantidade),2)
    await page.getByLabel('Produtos de interesse',{exact:true}).fill('produto extra')
    await page.getByLabel('Produtos de interesse',{exact:true}).press('Enter')
    await page.getByRole('alert').waitFor()
    assert.equal(await page.evaluate(()=>window.fixtureFicha.produtosInteresse.length),20)
    await page.goto('http://127.0.0.1:3225?modo=referencia')
    await page.getByText('PV: 3', { exact: true }).waitFor()
    assert.equal(await page.getByRole('button', { name: /^Remover / }).count(), 4)
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    await page.screenshot({ path: `output/produtos-pv/referencia-${width}.png`, fullPage: true })
    resultados.push({width,produtos:true,enxoval:true,legado:true,limites:true,overflow:false})
    await context.close()
  }
  const edicaoContext = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const edicaoPage = await edicaoContext.newPage()
  edicaoPage.on('pageerror', e => erros.push(e.message))
  await edicaoPage.goto('http://127.0.0.1:3225')
  await edicaoPage.getByRole('button', { name: 'PV', exact: true }).waitFor()
  const casos = [
    { anterior: 'negociacao', resultado: 'sim', versao: 2, quantidade: 5, esperado: true },
    { anterior: 'nao', resultado: 'sim', versao: 2, quantidade: 6, esperado: true },
    { anterior: 'sim', resultado: 'sim', versao: 2, quantidade: 5, esperado: false },
    { anterior: 'negociacao', resultado: 'negociacao', versao: 2, quantidade: 5, esperado: false },
    { anterior: 'negociacao', resultado: 'sim', quantidade: 5, esperado: false },
    { anterior: 'negociacao', resultado: 'sim', versao: 2, quantidade: 4, esperado: false },
    { anterior: 'negociacao', resultado: 'sim', versao: 2, quantidade: 5, status: 'rascunho', esperado: false },
  ]
  for (const [i, caso] of casos.entries()) {
    const dados = { atendimento: { id: 'edicao-' + i, status: caso.status ?? 'concluido', resultadoAtendimento: caso.resultado }, ficha: { versaoProdutos: caso.versao, produtosInteresse: [{ descricao: 'PV', quantidade: caso.quantidade, vendido: true }] }, anterior: caso.anterior }
    const confirmar = () => edicaoPage.evaluate(d => window.fixtureEditar(d.atendimento, d.ficha, d.anterior), dados)
    assert.equal(await confirmar(), caso.esperado)
    if (caso.esperado) {
      await edicaoPage.getByRole('heading', { name: 'Parabéns, PV batido!' }).waitFor()
      assert.equal(await confirmar(), false)
      await edicaoPage.getByRole('button', { name: 'Continuar', exact: true }).click()
      await edicaoPage.getByRole('dialog').waitFor({ state: 'detached' })
    } else assert.equal(await edicaoPage.getByRole('dialog').count(), 0)
  }
  await edicaoContext.close()
  const context = await browser.newContext({viewport:{width:390,height:844}})
  await context.addInitScript(()=>{
    const Original=window.AudioContext
    window.fixtureSom=[]
    window.AudioContext=class extends Original {
      createOscillator(){const node=super.createOscillator();const inicio=node.start.bind(node);const fim=node.stop.bind(node);const setFrequency=node.frequency.setValueAtTime.bind(node.frequency);node.frequency.setValueAtTime=(nota,t)=>{window.fixtureSom.push({tipo:'nota',nota,tempo:t});return setFrequency(nota,t)};node.start=t=>{window.fixtureSom.push({tipo:'inicio',tempo:t});inicio(t)};node.stop=t=>{window.fixtureSom.push({tipo:'fim',tempo:t});fim(t)};return node}
    }
  })
  const page=await context.newPage()
  page.on('pageerror',e=>erros.push(e.message))
  let respostaPendente
  await page.route('**/fixture/concluir',route=>{respostaPendente=route})
  await page.goto('http://127.0.0.1:3225?modo=referencia')
  async function iniciar(){respostaPendente=null;await Promise.all([page.waitForRequest('**/fixture/concluir'),page.getByRole('button',{name:'Simular finalização',exact:true}).click()]);assert.equal(await page.getByRole('dialog').count(),0)}
  async function responder(status,resultado='sim',id='sucesso'){await respostaPendente.fulfill({status,contentType:'application/json',body:JSON.stringify({id,status:'concluido',resultadoAtendimento:resultado})})}
  await iniciar()
  await responder(200,'sim','abaixo')
  await page.waitForFunction(()=>window.fixtureUltimo?.atendimento.id==='abaixo')
  assert.equal(await page.getByRole('dialog').count(),0)
  await page.getByRole('button',{name:'Aumentar quantidade de BERÇO',exact:true}).click({clickCount:2})
  await iniciar()
  await responder(500)
  assert.equal(await page.getByRole('dialog').count(),0)
  await iniciar()
  await responder(200,'negociacao','negociacao')
  await page.waitForFunction(()=>window.fixtureUltimo?.atendimento.id==='negociacao')
  assert.equal(await page.getByRole('dialog').count(),0)
  await iniciar()
  const inicio=Date.now()
  await responder(200)
  const dialog=page.getByRole('dialog')
  await dialog.getByRole('heading',{name:'Parabéns, PV batido!'}).waitFor()
  await dialog.getByText('Você fechou a venda com 5 peças. 100% da referência de 5.').waitFor()
  await dialog.getByRole('img',{name:'Le Bébé',exact:true}).evaluate(el=>el.decode())
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth))
  await dialog.getByRole('heading').evaluate(el=>new Promise(resolve=>{const parent=el.closest('[class*="content"]');const animation=parent.getAnimations()[0];if(animation)animation.finished.then(resolve);else resolve()}))
  assert.equal(await dialog.getByRole('heading').evaluate(el=>getComputedStyle(el).color),'rgb(255, 255, 255)')
  assert.ok((await dialog.getByRole('button',{name:'Fechar',exact:true}).boundingBox()).y<24)
  await page.screenshot({path:'output/produtos-pv/comemoracao-390.png'})
  await dialog.waitFor({state:'detached',timeout:6500})
  assert.ok(Date.now()-inicio>=4900&&Date.now()-inicio<6500)
  const som=await page.evaluate(()=>window.fixtureSom)
  assert.deepEqual(som.filter(n=>n.tipo==='nota').map(n=>n.nota),[523.25,659.25,783.99])
  const comeco=som.find(n=>n.tipo==='inicio').tempo
  assert.ok(som.filter(n=>n.tipo==='fim').every(n=>Math.abs(n.tempo-comeco-1.5)<0.001))
  await page.getByRole('button',{name:'Repetir resposta',exact:true}).click()
  assert.equal(await page.getByRole('dialog').count(),0)
  await page.reload()
  assert.equal(await page.getByRole('dialog').count(),0)
  await page.goto('http://127.0.0.1:3225/preview-pv-batido')
  await page.getByRole('button',{name:'Ver comemoração com som',exact:true}).click()
  await dialog.getByText('Você fechou a venda com 6 peças. 120% da referência de 5.').waitFor()
  await page.keyboard.press('Escape')
  await dialog.waitFor({state:'detached'})
  assert.ok((await page.evaluate(()=>window.fixtureSom)).some(n=>n.tipo==='fim'&&n.tempo===undefined),'Fechar interrompe as notas antes do término')
  await page.getByRole('button',{name:'7 peças',exact:true}).click()
  await page.getByRole('button',{name:'Ver comemoração com som',exact:true}).click()
  await dialog.getByText('Você fechou a venda com 7 peças. 140% da referência de 5.').waitFor()
  await dialog.getByRole('button',{name:'Continuar',exact:true}).click()
  await dialog.waitFor({state:'detached'})
  await page.setViewportSize({width:1366,height:900})
  await page.getByRole('button',{name:'Ver comemoração com som',exact:true}).click()
  await dialog.waitFor()
  assert.ok(Math.abs((await dialog.boundingBox()).width-1366)<1)
  await page.screenshot({path:'output/produtos-pv/comemoracao-1366.png'})
  await page.keyboard.press('Escape')
  await dialog.waitFor({state:'detached'})
  await context.close()
  const bloqueado=await browser.newContext({viewport:{width:320,height:800},reducedMotion:'reduce'})
  await bloqueado.addInitScript(()=>{window.AudioContext=class {constructor(){throw new DOMException('Bloqueado para teste','NotAllowedError')}}})
  const estatico=await bloqueado.newPage()
  estatico.on('pageerror',e=>erros.push(e.message))
  await estatico.goto('http://127.0.0.1:3225/preview-pv-batido')
  await estatico.getByRole('button',{name:'Ver comemoração com som',exact:true}).click()
  await estatico.getByRole('dialog').waitFor()
  assert.ok(await estatico.getByRole('dialog').locator('span').evaluateAll(nodes=>nodes.every(node=>getComputedStyle(node).animationName==='none')))
  assert.ok(await estatico.evaluate(()=>document.documentElement.scrollWidth<=innerWidth))
  await estatico.screenshot({path:'output/produtos-pv/comemoracao-estatica-320.png'})
  await estatico.getByRole('button',{name:'Fechar',exact:true}).click()
  await estatico.getByRole('dialog').waitFor({state:'detached'})
  await bloqueado.close()
  assert.deepEqual(erros,[])
  writeFileSync('output/produtos-pv/browser.json',JSON.stringify({resultados,erros},null,2))
  console.log('UI sintética aprovada em 320/390/1366px: produtos, edição/duplicados, PV sem teto, oito PNGs; comemoração após resposta confirmada, som de 1,5s, fechamento, bloqueio de áudio e redução de movimento. Sem overflow/erros JS.')
} finally { await browser.close(); await server.close() }
