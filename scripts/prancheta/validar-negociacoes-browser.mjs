// Browser -> APIs reais -> PostgreSQL/WASM isolado. Autenticação é fixture local;
// não constitui homologação autenticada em Supabase/Preview. Não lê .env.local.
import assert from 'node:assert/strict'
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs'
import {randomUUID} from 'node:crypto'
import {createServer} from 'vite'
import {chromium} from 'file:///C:/Users/lebeb/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs'
import {criarBancoNegociacoes,clienteSqlIsolado,usuario,unidade,cliente} from './banco-negociacoes-isolado.mjs'
const repo=process.cwd().replaceAll('\\','/'),pasta=repo+'/output/negociacoes-browser',porta=process.argv.includes('--digital-integral')?3258:3257
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
 resolveId(id){if(/\/lib\/atendimento-presencial\/vendas-sgi(?:\.ts)?$/.test(id))return '\0fixture-sgi';if(['next/image','next/link','next/navigation'].includes(id))return '\0'+id;if(/\/lib\/supabase\/service(?:\.ts)?$/.test(id))return '\0fixture-service';if(/\/lib\/auth\/module-access(?:\.ts)?$/.test(id))return '\0fixture-auth';if(/\/lib\/auth\/access-window(?:\.ts)?$/.test(id))return '\0fixture-window'},
 load(id){if(id==='\0fixture-sgi')return 'export async function resolverVendasSgi(){return {vendas:[],diagnosticos:{}}}';if(id==='\0fixture-service')return 'export function createServiceClient(){return globalThis.__negociacoesFixtureService}';if(id==='\0fixture-auth')return `export async function requireModuleAccess(){return {ok:true,allowedUser:{id:'${usuario}',role:'superadmin'}}}`;if(id==='\0fixture-window')return 'export async function checkAccessWindowForUser(){return {ok:true}}';if(id==='\0next/navigation')return 'export function useSearchParams(){return new URLSearchParams(window.location.search)};export function useRouter(){return {push:u=>window.location.assign(u),replace:u=>history.replaceState(null,"",u),refresh:()=>window.location.reload()}}';if(id==='\0next/link')return 'import React from "react";export default function Link(p){return React.createElement("a",p,p.children)}';if(id==='\0next/image')return 'import React from "react";export default function Image({priority,fill,unoptimized,quality,placeholder,blurDataURL,...p}){return React.createElement("img",p)}'},
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
    else if(/^\/api\/atendimento-presencial\/atendimentos\/[^/]+$/.test(url.pathname)){arquivo='/src/app/api/atendimento-presencial/atendimentos/[id]/route.ts';params={id:url.pathname.split('/').pop()}}
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
// Mesmo laboratório do E2E, mantido aberto para avaliação manual. Sem .env/produção.
if(process.argv.includes('--servir')){
 await db.exec('UPDATE atendimento_presencial_digital_config SET ativo=true')
 origemAtiva=randomUUID()
 await db.query("INSERT INTO atendimento_presencial_atendimentos(id,cliente_id,consultora_usuario_id,unidade_id,status,iniciado_em,concluido_em,resultado_atendimento,consultora_nome) VALUES($1,$2,$3,$4,'concluido',now()-interval '14 days',now()-interval '14 days','negociacao','ANA')",[origemAtiva,cliente,usuario,unidade])
 await db.query("INSERT INTO atendimento_presencial_departamentos(atendimento_id,departamento) VALUES($1,'moveis')",[origemAtiva])
 await db.query("INSERT INTO atendimento_presencial_produtos_interesse(atendimento_id,ordem,descricao,quantidade,vendido) VALUES($1,0,'BERCO',1,false)",[origemAtiva])
 for(const [i,resultado] of ['sim','nao','negociacao'].entries()){
  const id=randomUUID()
  await db.query("INSERT INTO atendimento_presencial_atendimentos(id,cliente_id,consultora_usuario_id,unidade_id,status,iniciado_em,concluido_em,resultado_atendimento,consultora_nome,numero_lancamento) VALUES($1,$2,$3,$4,'concluido',now()-interval '2 days',now()-interval '2 days',$5,'ANA',$6)",[id,cliente,usuario,portao,resultado,resultado==='sim'?123000+i:null])
  await db.query("INSERT INTO atendimento_presencial_produtos_interesse(atendimento_id,ordem,descricao,quantidade,vendido) VALUES($1,0,'BERCO',1,$2)",[id,resultado==='sim'])
 }
 console.log(`Laboratório isolado: http://127.0.0.1:${porta}/registros?tab=finalizados`)
 console.log('Dados fictícios em memória. Reiniciar o servidor reinicia os dados. Sem conexão de escrita com produção.')
 await new Promise(()=>{})
}
const browser=await chromium.launch({channel:'msedge',headless:true})
if(process.argv.includes('--digital-integral')){
 let paginaDigital
 try{
  await db.exec('UPDATE atendimento_presencial_digital_config SET ativo=true')
  for(const width of [1366,390]){
   const origem=randomUUID();origemAtiva=origem
   await db.query("INSERT INTO atendimento_presencial_atendimentos(id,cliente_id,consultora_usuario_id,unidade_id,status,iniciado_em,concluido_em,resultado_atendimento,consultora_nome) VALUES($1,$2,$3,$4,'concluido',now()-interval '14 days',now()-interval '14 days','negociacao','ANA')",[origem,cliente,usuario,unidade])
   await db.query("INSERT INTO atendimento_presencial_departamentos(atendimento_id,departamento) VALUES($1,'moveis')",[origem])
   await db.query("INSERT INTO atendimento_presencial_produtos_interesse(atendimento_id,ordem,descricao,quantidade,vendido) VALUES($1,0,'BERCO',1,false)",[origem])
   const bebe=randomUUID()
   await db.query('INSERT INTO atendimento_presencial_criancas_cadastro(id,dados,criado_por) VALUES($1,$2,$3)',[bebe,{situacao:'gestacao',nome:'LORENA'},usuario])
   await db.query('INSERT INTO atendimento_presencial_clientes_criancas(cliente_id,crianca_id,parentesco,criado_por) VALUES($1,$2,$3,$4)',[cliente,bebe,'Mãe',usuario])
   await db.query("INSERT INTO atendimento_presencial_criancas(atendimento_id,ordem,local_id,situacao,nome,nome_nao_informado,crianca_permanente_id,parentesco_vinculo) VALUES($1,1,'bebe','gestacao','LORENA',false,$2,'Mãe')",[origem,bebe])
   const context=await browser.newContext({viewport:{width,height:900}}),page=await context.newPage()
   paginaDigital=page
   page.on('response',async r=>{if(r.url().includes('/api/')&&r.status()>=400)console.error('API ISOLADA',r.status(),r.url(),await r.text())})
   page.on('pageerror',e=>erros.push(e.message));await context.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort())
   await page.goto(`http://127.0.0.1:${porta}/registros?tab=finalizados`,{waitUntil:'networkidle'})
   await page.getByRole('button',{name:/^(Atualizar situação da negociação|Consultar ou corrigir negociação)$/}).click()
   await page.getByRole('button',{name:/^Encerrar negociação/}).click()
   assert.equal(await page.getByRole('button',{name:'Continua em negociação',exact:true}).count(),0)
   await page.getByRole('button',{name:'Venda fechada',exact:true}).click()
   await page.getByRole('button',{name:'Digitalmente / WhatsApp',exact:true}).click()
   await page.getByRole('button',{name:'Confirmar e abrir Prancheta',exact:true}).click()
   await page.waitForURL('**/prancheta?rascunho=*')
   await page.getByRole('heading',{name:'Venda fechada digitalmente',exact:true}).waitFor()
   const id=new URL(page.url()).searchParams.get('rascunho')
   assert.equal((await db.query('SELECT natureza FROM atendimento_presencial_atendimentos WHERE id=$1',[id])).rows[0].natureza,'digital')
   assert.ok(await page.getByRole('button',{name:'Trocar cliente',exact:true}).isDisabled())
   const essenciais=page.locator('#secao-essenciais')
   await essenciais.getByRole('button',{name:'Berço: Sim',exact:true}).waitFor()
   for(const botao of await essenciais.getByRole('button',{name:/: Sim$/}).all()) await botao.click()
   await page.getByPlaceholder('Adicionar produto...', {exact:true}).fill('COMODA')
   await page.getByRole('button',{name:'Adicionar produto',exact:true}).click()
   await page.getByRole('button',{name:'Vendido: COMODA',exact:true}).click()
   await page.locator('#observacoes').fill('Digital com Prancheta única')
   let salvo=false
   for(let tentativa=0;tentativa<40;tentativa++){
    const atual=(await db.query('SELECT dados_rascunho FROM atendimento_presencial_atendimentos WHERE id=$1',[id])).rows[0].dados_rascunho
    if(atual.observacoes==='Digital com Prancheta única'){salvo=true;break}
    await new Promise(r=>setTimeout(r,100))
   }
   assert.ok(salvo,'Autosave digital deve persistir antes da retomada')
   await page.reload({waitUntil:'networkidle'})
   await page.getByRole('heading',{name:'Venda fechada digitalmente',exact:true}).waitFor()
   assert.equal(await page.locator('#observacoes').inputValue(),'Digital com Prancheta única')
   await page.locator('#numero-lancamento').scrollIntoViewIfNeeded()
   assert.equal(await page.getByRole('button',{name:'Negociação',exact:true}).count(),0)
   await page.screenshot({path:`${pasta}/digital-integral-${width}.png`,fullPage:true})
   const secoesDigitais=await page.locator('section[id^="secao-"]').evaluateAll(els=>els.map(el=>el.id))
   await page.getByRole('button',{name:'Venda fechada',exact:true}).click()
   await page.locator('#numero-lancamento').fill(String(84000+width))
   await page.getByRole('button',{name:'Venda fechada',exact:true}).click()
   await page.getByText(/Atendimento concluido e salvo nos registros/).first().waitFor()
   assert.equal((await db.query('SELECT sum(quantidade)::int pv FROM atendimento_presencial_produtos_interesse WHERE atendimento_id=$1 AND vendido',[id])).rows[0].pv,1)
   assert.equal((await db.query('SELECT resultado_atendimento FROM atendimento_presencial_atendimentos WHERE id=$1',[origem])).rows[0].resultado_atendimento,'negociacao')
   assert.equal((await db.query('SELECT count(*)::int n FROM atendimento_presencial_essenciais_snapshots WHERE atendimento_id=$1 AND crianca_id=$2',[id,bebe])).rows[0].n,1)
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth))
   ok(`${width}: jornada digital -> FichaPageClient oficial -> autosave -> conclusão SQL real; identidade, produtos, PV e origem preservados`)
   await page.goto(`http://127.0.0.1:${porta}/registros?tab=finalizados`,{waitUntil:'networkidle'})
   await page.getByRole('button',{name:/^(Atualizar situação da negociação|Consultar ou corrigir negociação)$/}).click()
   await page.getByText('Esta negociação já foi encerrada.', {exact:true}).waitFor()
   assert.equal(await page.getByRole('button',{name:/^Encerrar negociação/}).count(),0)
   assert.equal(await page.getByRole('button',{name:/^Vincular atendimento existente/}).count(),0)
   assert.ok(await page.getByRole('button',{name:/^Registrar nova visita/}).isEnabled())
   await page.getByRole('button',{name:'Ver venda registrada',exact:true}).waitFor()
   await page.getByRole('dialog').evaluate(el=>Promise.all(el.getAnimations({subtree:true}).filter(a=>a.effect.getTiming().iterations!==Infinity).map(a=>a.finished.catch(()=>{}))))
   await page.screenshot({path:`${pasta}/modal-encerrada-referencia-${width}.png`})
   const buscaEncerrada=await context.request.get(`http://127.0.0.1:${porta}/api/atendimento-presencial/negociacoes?modo=atendimentos&origemId=${origem}`)
   assert.equal(buscaEncerrada.status(),409)
   assert.match((await buscaEncerrada.json()).message,/já foi encerrada com venda em/)
   ok(`${width}: encerramento real mostra data e registro antes da busca; vinculação bloqueada no início, nova visita preservada`)
   await page.goto(`http://127.0.0.1:${porta}/registros?editar=${id}`,{waitUntil:'networkidle'})
   await page.locator('#digital-edicao-motivo').fill('Correção sintética pelo formulário oficial')
   await page.locator('#edicao-observacoes').fill('Digital corrigida em histórico')
   await page.getByRole('button',{name:'Salvar edicao',exact:true}).click()
   await page.getByText('Atendimento atualizado.',{exact:true}).first().waitFor()
   assert.equal((await db.query('SELECT observacoes FROM atendimento_presencial_atendimentos WHERE id=$1',[id])).rows[0].observacoes,'Digital corrigida em histórico')
   await page.goto(`http://127.0.0.1:${porta}/registros?tab=finalizados`,{waitUntil:'networkidle'})
   await page.getByRole('button',{name:/^(Atualizar situação da negociação|Consultar ou corrigir negociação)$/}).click()
   await page.getByRole('button',{name:'Ver histórico e registros vinculados',exact:true}).click()
   await page.getByRole('button',{name:'Anular venda digital',exact:true}).click()
   await page.locator('#neg-motivo').fill('Anulação sintética auditada')
   await page.getByRole('button',{name:'Confirmar anulação',exact:true}).click()
   await page.getByText(/Venda digital anulada/).first().waitFor()
   assert.equal((await db.query('SELECT venda_anulada FROM atendimento_presencial_atendimentos WHERE id=$1',[id])).rows[0].venda_anulada,true)
   assert.equal((await db.query('SELECT count(*)::int n FROM atendimento_presencial_essenciais_snapshots WHERE atendimento_id=$1',[id])).rows[0].n,1)
   ok(`${width}: edição oficial e anulação auditadas pela UI preservam crianças e snapshots`)
   const presencial=await context.request.post(`http://127.0.0.1:${porta}/api/atendimento-presencial/negociacoes`,{data:{acao:'retorno',origemId:origem,operacaoId:randomUUID(),unidadeId:unidade,consultora:'ANA'}})
   assert.equal(presencial.status(),200)
   const presencialId=(await presencial.json()).resultado
   await page.goto(`http://127.0.0.1:${porta}/atendimento-presencial/prancheta?rascunho=${presencialId}`,{waitUntil:'networkidle'})
   await page.getByRole('heading',{name:'Prancheta Virtual de Atendimento',exact:true}).waitFor()
   assert.deepEqual(await page.locator('section[id^="secao-"]').evaluateAll(els=>els.map(el=>el.id)),secoesDigitais)
   await page.screenshot({path:`${pasta}/presencial-comparacao-${width}.png`,fullPage:true})
   ok(`${width}: mesmos campos/seções e mesmo FichaPageClient nos dois modos; retorno presencial preservado`)
   await context.close()
  }
  assert.deepEqual(erros,[])
  writeFileSync(pasta+'/digital-integral-resultado.json',JSON.stringify({verificacoes,erros},null,2))
 }catch(e){if(paginaDigital){await paginaDigital.screenshot({path:pasta+'/digital-integral-falha.png',fullPage:true});writeFileSync(pasta+'/digital-integral-falha.html',await paginaDigital.content());console.error(await paginaDigital.locator('[role="alert"]').allTextContents())}throw e}
 finally{await browser.close();await server.close();await db.close()}
 process.exit(0)
}
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
  const abrir=async()=>{await page.goto(`http://127.0.0.1:${porta}/negociacoes?origem=${origem}`,{waitUntil:'networkidle',timeout:120000});await page.getByRole('button',{name:'Atualizar situação da negociação'}).click();await page.getByRole('button',{name:'Registrar uma atualização agora',exact:true}).waitFor()}
  const abrirDigital=async()=>{await page.getByRole('button',{name:'Registrar uma atualização agora',exact:true}).click();await page.getByRole('button',{name:'Venda fechada',exact:true}).click();await page.getByRole('button',{name:'Digitalmente / WhatsApp',exact:true}).click()}
  const historico=()=>page.getByRole('button',{name:'Ver histórico e registros vinculados',exact:true}).click()
  await page.goto(`http://127.0.0.1:${porta}/registros?tab=finalizados`,{waitUntil:'networkidle',timeout:120000})
  const atualizar=page.getByRole('button',{name:/^(Atualizar situação da negociação|Consultar ou corrigir negociação)$/})
  await atualizar.waitFor();const rodape=atualizar.locator('..')
  assert.deepEqual(await rodape.getByRole('button').allTextContents(),['Ver atendimento','Atualizar situação da negociação','Editar atendimento'])
  await rodape.locator('..').screenshot({path:`${pasta}/card-atualizar-${width}.png`})
  consultas.length=0;await atualizar.click();await page.getByRole('button',{name:'Registrar uma atualização agora',exact:true}).waitFor()
  assert.ok(consultas.some(p=>p.startsWith('/api/atendimento-presencial/negociacoes?')&&p.includes(origem)))
  assert.ok(!consultas.some(p=>p.startsWith('/api/atendimento-presencial/atendimentos/')))
  ok(`${width}: botão direto no card, entre Ver e Editar; abre o mesmo fluxo sem carregar a edição`)
  assert.equal(await page.getByRole('dialog').getByRole('button',{name:'Filtrar',exact:true}).count(),0)
  await page.getByRole('dialog').evaluate(el=>Promise.all(el.getAnimations({subtree:true}).filter(a=>a.effect.getTiming().iterations!==Infinity).map(a=>a.finished.catch(()=>{}))))
  await page.screenshot({path:`${pasta}/jornada-${width}.png`});await abrirDigital()
  await page.locator('#neg-lancamento').fill(String(70000+width))
  await page.getByRole('button',{name:'Salvar venda digital',exact:true}).click();await page.getByText(/Marque pelo menos um produto vendido/).waitFor()
  await page.getByRole('button',{name:'Vendido: BERCO',exact:true}).click();await page.getByRole('button',{name:'Aumentar quantidade de BERCO',exact:true}).click()
  await page.getByRole('button',{name:'Produto que não trabalhamos',exact:true}).click()
  await page.screenshot({path:`${pasta}/digital-${width}.png`,fullPage:true})
  await page.getByRole('button',{name:'Salvar rascunho',exact:true}).click();await page.getByText('Rascunho digital salvo.',{exact:true}).waitFor()
  await abrir();await historico();await page.getByRole('button',{name:'Retomar digital',exact:true}).click()
  assert.equal(await page.locator('#neg-lancamento').inputValue(),String(70000+width))
  await page.getByRole('button',{name:'Salvar venda digital',exact:true}).click();await page.getByText('Situação atual: Encerrada com venda',{exact:true}).waitFor();await historico()
  assert.equal((await db.query('SELECT count(*)::int c FROM atendimento_presencial_atendimentos')).rows[0].c,totalVisitas)
  await page.getByRole('button',{name:'Corrigir venda digital',exact:true}).click();await page.locator('#neg-lancamento').fill(String(80000+width));await page.locator('#neg-motivo').fill('Corrigir lançamento de homologação')
  await page.getByRole('button',{name:'Salvar correção digital',exact:true}).click();await page.getByText('Venda digital corrigida.',{exact:true}).waitFor();await historico();await page.getByRole('button',{name:'Anular venda digital',exact:true}).waitFor()
  await page.getByRole('button',{name:'Anular venda digital',exact:true}).click();await page.locator('#neg-motivo').fill('Registro fictício anulado')
  await page.getByRole('button',{name:'Confirmar anulação',exact:true}).click();await page.getByText('Situação atual: Aberta',{exact:true}).waitFor()
  ok(`${width}: digital exige vendido, quantidade, rascunho/reabertura, conclusão sem visita, correção auditada e anulação`)
  await page.getByRole('button',{name:'Registrar uma atualização agora',exact:true}).click();await page.getByRole('button',{name:'Venda fechada',exact:true}).click();await page.getByRole('button',{name:'Presencialmente na loja',exact:true}).click();await page.locator('#neg-filial').selectOption(portao)
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
  for (const resultado of ['sim','nao','negociacao']) {
    const raiz=randomUUID(),alvo=randomUUID();origemAtiva=raiz
    await db.query("INSERT INTO atendimento_presencial_atendimentos(id,cliente_id,consultora_usuario_id,unidade_id,status,resultado_atendimento,iniciado_em,concluido_em,consultora_nome,numero_lancamento) VALUES($1,$2,$3,$4,'concluido','negociacao',now(),now(),'ANA',null),($5,$2,$3,$6,'concluido',$7,now(),now(),'ANA',$8)",[raiz,cliente,usuario,unidade,alvo,portao,resultado,resultado==='sim'?110000+width:null])
    const antes=(await db.query('SELECT count(*)::int c FROM atendimento_presencial_atendimentos')).rows[0].c
    await page.goto(`http://127.0.0.1:${porta}/registros?tab=finalizados`,{waitUntil:'networkidle'})
    await page.getByRole('button',{name:/^(Atualizar situação da negociação|Consultar ou corrigir negociação)$/}).click()
    await page.getByRole('button',{name:'Vincular atendimento existente',exact:true}).click()
    await page.getByRole('button',{name:'Selecionar atendimento',exact:true}).waitFor()
    await page.getByRole('button',{name:'Ver atendimento',exact:true}).click()
    const detalhe=page.getByRole('dialog').last();await detalhe.getByText('CLIENTE HOMOLOGACAO',{exact:true}).first().waitFor()
    assert.equal(await detalhe.getByRole('button',{name:'Editar atendimento',exact:true}).count(),0)
    await detalhe.getByRole('button',{name:'Fechar',exact:true}).click()
    await page.getByRole('button',{name:'Selecionar atendimento',exact:true}).click()
    await page.getByText(resultado==='sim'?'Esta venda encerrará a negociação.':resultado==='nao'?'Este atendimento encerrará a negociação como perdida.':'Este retorno será vinculado e a negociação continuará aberta.',{exact:true}).waitFor()
    await page.screenshot({path:`${pasta}/associar-${resultado}-${width}.png`,fullPage:true})
    await page.getByRole('button',{name:'Confirmar vinculação',exact:true}).click()
    await page.getByText(resultado==='sim'?'Negociação encerrada com venda.':resultado==='nao'?'Negociação encerrada como perdida.':'Retorno vinculado. Negociação continua aberta.',{exact:false}).waitFor()
    await page.getByRole('button',{name:'Ver atendimento associado',exact:true}).waitFor()
    await page.getByRole('dialog').getByRole('button',{name:'Fechar',exact:true}).click()
    await page.getByText(resultado==='sim'?'Encerrada com venda':resultado==='nao'?'Encerrada com perda':'Aberta',{exact:true}).waitFor()
    assert.ok(await page.getByText('Resultado da visita original',{exact:true}).isVisible())
    assert.ok(await page.getByText('Em negociação',{exact:true}).isVisible())
    assert.equal((await db.query('SELECT count(*)::int c FROM atendimento_presencial_atendimentos')).rows[0].c,antes)
    await page.screenshot({path:`${pasta}/card-apos-${resultado}-${width}.png`,fullPage:true})
    ok(`${width}: A/${resultado}, prévia somente leitura, confirmação do efeito, feedback e card atualizado sem recarga; sem nova visita`)
  }
  // Caminho B: perda sem visita e continuação presencial pela Prancheta oficial.
  const raizPerda=randomUUID();origemAtiva=raizPerda
  await db.query("INSERT INTO atendimento_presencial_atendimentos(id,cliente_id,consultora_usuario_id,unidade_id,status,resultado_atendimento,iniciado_em,concluido_em,consultora_nome) VALUES($1,$2,$3,$4,'concluido','negociacao',now(),now(),'ANA')",[raizPerda,cliente,usuario,unidade])
  const visitasAntes=(await db.query('SELECT count(*)::int c FROM atendimento_presencial_atendimentos')).rows[0].c
  await page.goto(`http://127.0.0.1:${porta}/registros?tab=finalizados`,{waitUntil:'networkidle'})
  await page.getByRole('button',{name:/^(Atualizar situação da negociação|Consultar ou corrigir negociação)$/}).click()
  await page.getByRole('button',{name:'Registrar uma atualização agora',exact:true}).click()
  await page.getByRole('button',{name:'Venda perdida',exact:true}).click()
  await page.getByRole('button',{name:'Encerrar sem nova visita',exact:true}).click()
  await page.getByRole('button',{name:'Confirmar e salvar',exact:true}).click()
  await page.getByText('Negociação encerrada como perdida.',{exact:true}).waitFor()
  assert.equal((await db.query('SELECT count(*)::int c FROM atendimento_presencial_atendimentos')).rows[0].c,visitasAntes)
  ok(`${width}: B/perda sem nova visita com motivo, sem duplicar contagem presencial`)
  for(const resultado of ['negociacao','nao']){
    const raiz=randomUUID();origemAtiva=raiz
    await db.query("INSERT INTO atendimento_presencial_atendimentos(id,cliente_id,consultora_usuario_id,unidade_id,status,resultado_atendimento,iniciado_em,concluido_em,consultora_nome) VALUES($1,$2,$3,$4,'concluido','negociacao',now(),now(),'ANA')",[raiz,cliente,usuario,unidade])
    await db.query("INSERT INTO atendimento_presencial_departamentos(atendimento_id,departamento) VALUES($1,'moveis')",[raiz])
    await page.goto(`http://127.0.0.1:${porta}/registros?tab=finalizados`,{waitUntil:'networkidle'})
    await page.getByRole('button',{name:/^(Atualizar situação da negociação|Consultar ou corrigir negociação)$/}).click()
    await page.getByRole('button',{name:'Registrar uma atualização agora',exact:true}).click()
    await page.getByRole('button',{name:resultado==='negociacao'?'Continua em negociação':'Venda perdida',exact:true}).click()
    await page.getByRole('button',{name:resultado==='negociacao'?'Registrar novo atendimento presencial':'Registrar nova visita presencial',exact:true}).click()
    await page.getByRole('button',{name:'Confirmar e abrir Prancheta',exact:true}).click()
    await page.waitForURL('**/prancheta?rascunho=*')
    const id=new URL(page.url()).searchParams.get('rascunho')
    await page.locator('#numero-lancamento').scrollIntoViewIfNeeded()
    await page.getByRole('button',{name:resultado==='negociacao'?'Negociação':'Venda perdida',exact:true}).click()
    await page.getByRole('button',{name:resultado==='negociacao'?'Tá pesquisando':'Sem estoque',exact:true}).click()
    await page.evaluate(()=>window.scrollTo(0,document.documentElement.scrollHeight))
    await page.getByRole('button',{name:'Finalizar atendimento',exact:true}).click()
    await page.getByText(/Atendimento concluido e salvo nos registros/).first().waitFor()
    assert.equal((await db.query('SELECT resultado_atendimento FROM atendimento_presencial_atendimentos WHERE id=$1',[id])).rows[0].resultado_atendimento,resultado)
    assert.equal((await db.query('SELECT count(*)::int c FROM atendimento_presencial_negociacao_encerramentos e JOIN atendimento_presencial_negociacoes n ON n.id=e.negociacao_id WHERE n.origem_id=$1 AND NOT e.anulado',[raiz])).rows[0].c,resultado==='nao'?1:0)
    ok(`${width}: B/retorno presencial ${resultado}, Prancheta oficial concluída; situação comercial correta`)
  }
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth))
  await context.close()
 }
 assert.deepEqual(erros,[]);ok('Desktop/mobile sem exceções JavaScript nem overflow horizontal')
 writeFileSync(pasta+'/resultado.json',JSON.stringify({verificacoes,erros,limite:'Autenticação e cadastros de apoio sintéticos; APIs/RPCs de continuidade e PostgreSQL reais isolados.'},null,2))
}catch(e){if(paginaAtual){await paginaAtual.screenshot({path:pasta+'/falha.png',fullPage:true});writeFileSync(pasta+'/falha.html',await paginaAtual.content())}throw e}
finally{await browser.close();await server.close();await db.close();delete globalThis.__negociacoesFixtureService}
