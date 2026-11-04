// Browser -> APIs reais -> PostgreSQL/WASM isolado. Autenticação é fixture local;
// não constitui homologação autenticada em Supabase/Preview. Não lê .env.local.
import assert from 'node:assert/strict'
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs'
import {randomUUID} from 'node:crypto'
import {createServer} from 'vite'
import {chromium} from 'file:///C:/Users/lebeb/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs'
import {criarBancoNegociacoes,clienteSqlIsolado,usuario,unidade,cliente} from './banco-negociacoes-isolado.mjs'
const repo=process.cwd().replaceAll('\\','/'),pasta=repo+'/output/negociacoes-browser',porta=3257
mkdirSync(pasta,{recursive:true})
const db=await criarBancoNegociacoes(),portao=randomUUID()
globalThis.__negociacoesFixtureService=clienteSqlIsolado(db)
await db.query("INSERT INTO app_unidades(id,ativo,nome,chave) VALUES($1,true,'Portão','portao')",[portao])
const contexto={perfil:'superadmin',usuarioId:usuario,acessoTotal:true,unidadesPermitidas:[{id:unidade,chave:'marechal',nome:'Marechal'},{id:portao,chave:'portao',nome:'Portão'}],consultoras:[]}
const erros=[],verificacoes=[]
let origemAtiva
const consultas=[]
const ok=t=>{verificacoes.push(t);console.log('OK',t)}
writeFileSync(repo+'/output/negociacoes-global.css',readFileSync(repo+'/src/app/globals.css','utf8').replace('@import "tailwindcss";','@import "tailwindcss" source(none);').replace('@import "tw-animate-css";','@import "tw-animate-css";\n@source "../src";'))
const server=await createServer({configFile:false,root:repo,envDir:pasta+'/sem-env',cacheDir:'output/negociacoes-vite',define:{'process.env':JSON.stringify({NEXT_PUBLIC_PRANCHETA_PRODUTOS_V2:'1',NEXT_PUBLIC_PRANCHETA_ESSENCIAIS_V1:'1'})},esbuild:{jsx:'automatic'},optimizeDeps:{entries:[],exclude:['next/image','next/link','next/navigation'],include:['react','react-dom/client','lucide-react','sonner']},resolve:{alias:{'@':repo+'/src'}},server:{host:'127.0.0.1',port:porta,strictPort:true,watch:null},plugins:[{name:'negociacoes-isoladas',enforce:'pre',
 resolveId(id){if(['next/image','next/link','next/navigation'].includes(id))return '\0'+id;if(/\/lib\/supabase\/service(?:\.ts)?$/.test(id))return '\0fixture-service';if(/\/lib\/auth\/module-access(?:\.ts)?$/.test(id))return '\0fixture-auth';if(/\/lib\/auth\/access-window(?:\.ts)?$/.test(id))return '\0fixture-window'},
 load(id){if(id==='\0fixture-service')return 'export function createServiceClient(){return globalThis.__negociacoesFixtureService}';if(id==='\0fixture-auth')return `export async function requireModuleAccess(){return {ok:true,allowedUser:{id:'${usuario}',role:'superadmin'}}}`;if(id==='\0fixture-window')return 'export async function checkAccessWindowForUser(){return {ok:true}}';if(id==='\0next/navigation')return 'export function useSearchParams(){return new URLSearchParams(window.location.search)};export function useRouter(){return {push:u=>window.location.assign(u),replace:u=>history.replaceState(null,"",u),refresh:()=>window.location.reload()}}';if(id==='\0next/link')return 'import React from "react";export default function Link(p){return React.createElement("a",p,p.children)}';if(id==='\0next/image')return 'import React from "react";export default function Image({priority,fill,unoptimized,quality,placeholder,blurDataURL,...p}){return React.createElement("img",p)}'},
 configureServer(vite){vite.middlewares.use(async(req,res,next)=>{const url=new URL(req.url,`http://127.0.0.1:${porta}`)
  try{
   if(url.pathname.startsWith('/api/')){
    const partes=[];for await(const p of req)partes.push(p);const body=partes.length?Buffer.concat(partes).toString():undefined
    const request=new Request(url,{method:req.method,...(body?{body,headers:{'Content-Type':'application/json'}}:{})})
    let arquivo,params={},response
    const atendimento=url.pathname.match(/\/atendimentos\/([^/]+)\/(rascunho|concluir)$/)
    const crianca=url.pathname.match(/\/clientes\/([^/]+)\/(criancas|essenciais)$/)
    consultas.push(url.pathname+url.search)
    if(url.pathname==='/api/atendimento-presencial/negociacoes')arquivo='/src/app/api/atendimento-presencial/negociacoes/route.ts'
    else if(url.pathname==='/api/atendimento-presencial/atendimentos')response=Response.json({ok:true,registros:[{id:origemAtiva,clienteId:cliente,clienteNome:'CLIENTE HOMOLOGACAO',clienteTelefone:'41988887777',consultoraUsuarioId:usuario,consultoraEmail:'',consultoraNomeManual:'ANA',unidadeId:unidade,unidadeNome:'Marechal',resultadoAtendimento:'negociacao',numeroLancamento:null,viradaCartaoDia:null,viradaCartaoMes:null,iniciadoEm:new Date().toISOString(),concluidoEm:new Date().toISOString(),departamentos:['moveis'],observacoes:'Negociação de teste',criancasNomes:[]}],total:1,page:1,clientesUnicos:1,visitasNaoClientes:0,consultoras:[{nome:'ANA'}],unidades:contexto.unidadesPermitidas})
    else if(atendimento){arquivo=`/src/app/api/atendimento-presencial/atendimentos/[id]/${atendimento[2]}/route.ts`;params={id:atendimento[1]}}
    else if(crianca){arquivo=`/src/app/api/atendimento-presencial/clientes/[id]/${crianca[2]}/route.ts`;params={id:crianca[1]}}
    else if(url.pathname.endsWith('/consultoras-recentes'))response=Response.json({ok:true,nomes:['ANA']})
    else if(url.pathname===`/api/atendimento-presencial/clientes/${cliente}`){arquivo='/src/app/api/atendimento-presencial/clientes/[id]/route.ts';params={id:cliente}}
    else throw new Error('API não prevista na fixture: '+url.pathname)
    if(arquivo){const modulo=await vite.ssrLoadModule(arquivo);response=await modulo[req.method](request,{params:Promise.resolve(params)})}
    res.statusCode=response.status;res.setHeader('Content-Type','application/json');return res.end(await response.text())
   }
   if(!['/negociacoes','/registros','/atendimento-presencial/prancheta'].includes(url.pathname))return next()
   const ficha=url.pathname.includes('/prancheta'),props=ficha?{usuarioId:usuario,contextoInicial:contexto,unidadeIdInicial:'',rascunhoIdInicial:url.searchParams.get('rascunho')}:{origemId:url.searchParams.get('origem')}
   const registros=url.pathname==='/registros';if(registros)Object.assign(props,{podeVerRegistros:true,podeVerRascunhos:false})
   const componente=registros?"import Page from '/src/app/atendimento-presencial/registros/RegistrosPageClient.tsx'":ficha?"import Page from '/src/app/atendimento-presencial/prancheta/FichaPageClient.tsx'":"import {NegociacoesPanel as Page} from '/src/components/atendimento-presencial/NegociacoesPanel.tsx'"
   const html=`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" href="data:,"><link rel="stylesheet" href="/output/negociacoes-global.css"></head><body><div id="root" class="p-4 sm:p-6"></div><script type="module">import React from 'react';import{createRoot}from'react-dom/client';${componente};import{Toaster}from'sonner';createRoot(document.getElementById('root')).render(React.createElement(React.Fragment,null,React.createElement(Page,${JSON.stringify(props)}),React.createElement(Toaster)));</script></body></html>`
   res.setHeader('Content-Type','text/html;charset=utf-8');res.end(await vite.transformIndexHtml(req.url,html))
  }catch(e){console.error('FIXTURE HTTP',url.pathname,e.message);res.statusCode=500;res.setHeader('Content-Type','application/json');res.end(JSON.stringify({ok:false,message:e.message}))}
 })}
}]})
await server.listen()
const browser=await chromium.launch({channel:'msedge',headless:true})
let paginaAtual
try{
 for(const width of [1366,390]){
  const origem=randomUUID()
  origemAtiva=origem
  await db.query("INSERT INTO atendimento_presencial_atendimentos(id,cliente_id,consultora_usuario_id,unidade_id,status,iniciado_em,concluido_em,resultado_atendimento,consultora_nome) VALUES($1,$2,$3,$4,'concluido',now()-interval '14 days',now()-interval '14 days','negociacao','ANA')",[origem,cliente,usuario,unidade])
  await db.query("INSERT INTO atendimento_presencial_produtos_interesse(atendimento_id,ordem,descricao,quantidade,vendido) VALUES($1,0,'BERCO',1,false)",[origem])
  await db.query("INSERT INTO atendimento_presencial_departamentos(atendimento_id,departamento) VALUES($1,'moveis')",[origem])
  const totalVisitas=(await db.query('SELECT count(*)::int c FROM atendimento_presencial_atendimentos')).rows[0].c
  const context=await browser.newContext({viewport:{width,height:900}}),page=await context.newPage();paginaAtual=page
  page.on('pageerror',e=>erros.push(e.message));page.on('dialog',d=>d.accept())
  await context.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort())
  const abrir=async()=>{await page.goto(`http://127.0.0.1:${porta}/negociacoes?origem=${origem}`,{waitUntil:'networkidle',timeout:120000});await page.getByRole('button',{name:'Atualizar situação da negociação'}).click();await page.getByRole('button',{name:'Fechar venda digital',exact:true}).waitFor()}
  await page.goto(`http://127.0.0.1:${porta}/registros?tab=finalizados`,{waitUntil:'networkidle',timeout:120000})
  const atualizar=page.getByRole('button',{name:'Atualizar situação da negociação',exact:true})
  await atualizar.waitFor();const rodape=atualizar.locator('..')
  assert.deepEqual(await rodape.getByRole('button').allTextContents(),['Ver atendimento','Atualizar situação da negociação','Editar atendimento'])
  await rodape.locator('..').screenshot({path:`${pasta}/card-atualizar-${width}.png`})
  consultas.length=0;await atualizar.click();await page.getByRole('button',{name:'Fechar venda digital',exact:true}).waitFor()
  assert.ok(consultas.some(p=>p.startsWith('/api/atendimento-presencial/negociacoes?')&&p.includes(origem)))
  assert.ok(!consultas.some(p=>p.startsWith('/api/atendimento-presencial/atendimentos/')))
  ok(`${width}: botão direto no card, entre Ver e Editar; abre o mesmo fluxo sem carregar a edição`)
  await page.getByRole('button',{name:'Fechar venda digital',exact:true}).click()
  await page.locator('#neg-lancamento').fill(String(70000+width))
  await page.getByRole('button',{name:'Salvar venda digital',exact:true}).click();await page.getByText(/Marque pelo menos um produto vendido/).waitFor()
  await page.getByRole('button',{name:'Vendido: BERCO',exact:true}).click();await page.getByRole('button',{name:'Aumentar quantidade de BERCO',exact:true}).click()
  await page.getByRole('button',{name:'Produto que não trabalhamos',exact:true}).click()
  await page.screenshot({path:`${pasta}/digital-${width}.png`,fullPage:true})
  await page.getByRole('button',{name:'Salvar rascunho',exact:true}).click();await page.getByText('Rascunho digital salvo.',{exact:true}).waitFor()
  await abrir();await page.getByRole('button',{name:'Retomar digital',exact:true}).click()
  assert.equal(await page.locator('#neg-lancamento').inputValue(),String(70000+width))
  await page.getByRole('button',{name:'Salvar venda digital',exact:true}).click();await page.locator('p').filter({hasText:/^Encerrada com venda$/}).waitFor()
  assert.equal((await db.query('SELECT count(*)::int c FROM atendimento_presencial_atendimentos')).rows[0].c,totalVisitas)
  await page.getByRole('button',{name:'Corrigir venda digital',exact:true}).click();await page.locator('#neg-lancamento').fill(String(80000+width));await page.locator('#neg-motivo').fill('Corrigir lançamento de homologação')
  await page.getByRole('button',{name:'Salvar correção digital',exact:true}).click();await page.getByRole('button',{name:'Anular venda digital',exact:true}).waitFor()
  await page.getByRole('button',{name:'Anular venda digital',exact:true}).click();await page.locator('#neg-motivo').fill('Registro fictício anulado')
  await page.getByRole('button',{name:'Confirmar anulação',exact:true}).click();await page.getByText('Negociação aberta',{exact:true}).waitFor()
  ok(`${width}: digital exige vendido, quantidade, rascunho/reabertura, conclusão sem visita, correção auditada e anulação`)
  await page.getByRole('button',{name:'Registrar retorno presencial',exact:true}).click();await page.locator('#neg-filial').selectOption(portao)
  await page.getByRole('button',{name:'Confirmar e abrir Prancheta',exact:true}).click();await page.waitForURL('**/prancheta?rascunho=*')
  await page.getByRole('button',{name:'Vendido: BERCO',exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'Vendido: BERCO',exact:true}).getAttribute('aria-pressed'),'false')
  await page.screenshot({path:`${pasta}/retorno-${width}.png`,fullPage:true})
  const rascunho=new URL(page.url()).searchParams.get('rascunho')
  const retorno=(await db.query('SELECT dados_rascunho,unidade_id FROM atendimento_presencial_atendimentos WHERE id=$1',[rascunho])).rows[0]
  assert.equal(retorno.unidade_id,portao);assert.equal(retorno.dados_rascunho.produtosInteresse[0].vendido,false)
  await page.getByRole('button',{name:'Aumentar quantidade de BERCO',exact:true}).click()
  await page.getByRole('button',{name:'Vendido: BERCO',exact:true}).click()
  await page.locator('#numero-lancamento').scrollIntoViewIfNeeded()
  await page.getByRole('button',{name:'Venda fechada',exact:true}).click()
  await page.locator('#numero-lancamento').fill(String(90000+width))
  await page.getByRole('button',{name:'Venda fechada',exact:true}).click()
  await page.getByText(/Atendimento concluido e salvo nos registros/).first().waitFor({timeout:15000})
  const final=(await db.query('SELECT status,resultado_atendimento FROM atendimento_presencial_atendimentos WHERE id=$1',[rascunho])).rows[0]
  assert.deepEqual(final,{status:'concluido',resultado_atendimento:'sim'})
  assert.equal((await db.query('SELECT resultado_atendimento FROM atendimento_presencial_atendimentos WHERE id=$1',[origem])).rows[0].resultado_atendimento,'negociacao')
  ok(`${width}: retorno em outra filial usa Prancheta oficial, prefill sem venda antiga, conclusão vinculada preserva origem`)
  // Outro rascunho continua permitido mesmo após encerramento comercial.
  const outro=await context.request.post(`http://127.0.0.1:${porta}/api/atendimento-presencial/negociacoes`,{data:{acao:'retorno',origemId:origem,operacaoId:randomUUID(),unidadeId:unidade,consultora:'ANA'}})
  assert.equal(outro.status(),200);const outroId=(await outro.json()).resultado
  await page.goto(`http://127.0.0.1:${porta}/atendimento-presencial/prancheta?rascunho=${outroId}`,{waitUntil:'networkidle'})
  await page.getByRole('button',{name:'Aumentar quantidade de BERCO',exact:true}).click();await page.getByRole('button',{name:'Vendido: BERCO',exact:true}).click()
  await page.locator('#observacoes').fill('Rascunho independente preservado')
  await page.locator('#numero-lancamento').scrollIntoViewIfNeeded()
  await page.getByRole('button',{name:'Venda fechada',exact:true}).click();await page.locator('#numero-lancamento').fill(String(92000+width));await page.getByRole('button',{name:'Venda fechada',exact:true}).click()
  await page.getByRole('heading',{name:'Negociação já encerrada',exact:true}).waitFor()
  await page.screenshot({path:`${pasta}/independente-${width}.png`,fullPage:true})
  await page.getByRole('button',{name:'Registrar atendimento independente',exact:true}).click();await page.getByText(/Atendimento concluido e salvo nos registros/).first().waitFor()
  assert.equal((await db.query('SELECT observacoes FROM atendimento_presencial_atendimentos WHERE id=$1',[outroId])).rows[0].observacoes,'Rascunho independente preservado')
  assert.equal((await db.query('SELECT count(*)::int c FROM atendimento_presencial_negociacao_encerramentos e JOIN atendimento_presencial_negociacoes n ON n.id=e.negociacao_id WHERE n.origem_id=$1 AND NOT e.anulado',[origem])).rows[0].c,1)
  ok(`${width}: segundo rascunho preservado; confirmação explícita registra visita independente sem duplicar encerramento`)
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth))
  await context.close()
 }
 assert.deepEqual(erros,[]);ok('Desktop/mobile sem exceções JavaScript nem overflow horizontal')
 writeFileSync(pasta+'/resultado.json',JSON.stringify({verificacoes,erros,limite:'Autenticação e cadastros de apoio sintéticos; APIs/RPCs de continuidade e PostgreSQL reais isolados.'},null,2))
}catch(e){if(paginaAtual){await paginaAtual.screenshot({path:pasta+'/falha.png',fullPage:true});writeFileSync(pasta+'/falha.html',await paginaAtual.content())}throw e}
finally{await browser.close();await server.close();await db.close();delete globalThis.__negociacoesFixtureService}
