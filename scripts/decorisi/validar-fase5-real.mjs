// Ensaio autorizado no Supabase atual. Registros ficam no manifesto para limpeza
// exata pelo operador MCP: o backend não recebe DELETE no histórico.
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { writeFile, mkdir } from 'node:fs/promises'
import nextEnv from '@next/env'
import { createClient } from '@supabase/supabase-js'
nextEnv.loadEnvConfig(process.cwd())
assert.equal(process.env.DECORISI_VALIDACAO_FASE5,'2026-10-13')
assert.equal(new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname,'phsoawbdvhurroryfnok.supabase.co')
const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}})
const base='http://127.0.0.1:3014', root='/api/pedidos-personalizados/decorisi'
const marcador=`TESTE DECORISI F5 ${randomUUID().slice(0,8)}`
const manifesto={marcador,inicio:new Date().toISOString(),usuario:null,pedidos:[],itens:[],medidas:[],anexos:[],caminhos:[],historico:[],resultados:[],acessoRevogado:false,limpeza:false}
await mkdir('output',{recursive:true})
const arquivo=`output/decorisi-fase5-${marcador.split(' ').at(-1)}.json`
const salvar=()=>writeFile(arquivo,JSON.stringify(manifesto,null,2))
const cookies=new Map()
async function http(path,init={}) {
  const headers=new Headers(init.headers)
  if(cookies.size) headers.set('cookie',[...cookies].map(([k,v])=>`${k}=${v}`).join('; '))
  if(typeof init.body==='string')headers.set('content-type','application/json')
  const r=await fetch(base+path,{...init,headers,redirect:'manual'})
  for(const c of r.headers.getSetCookie()){const s=c.split(';')[0],i=s.indexOf('=');cookies.set(s.slice(0,i),s.slice(i+1))}
  assert.ok(r.headers.get('content-type')?.includes('application/json'),`${path}: HTTP ${r.status} não JSON`)
  return {status:r.status,body:await r.json()}
}
async function ok(path,init={}){const r=await http(path,init);assert.ok(r.status<300,`${path}: ${r.status} ${r.body.erro??r.body.codigo}`);return r.body}
async function etapa(nome,fn){await fn();manifesto.resultados.push(nome);await salvar();console.info(`[fase5/real] OK ${nome}`)}
async function obter(id){const p=(await ok(`${root}/pedidos/${id}`)).pedido;for(const i of p.itens){if(!manifesto.itens.includes(i.id))manifesto.itens.push(i.id);for(const m of i.medidas)if(!manifesto.medidas.includes(m.id))manifesto.medidas.push(m.id)}await salvar();return p}
async function criar(itens,unidade){const key=randomUUID();const p=await ok(`${root}/pedidos`,{method:'POST',body:JSON.stringify({unidade,consultora:'Teste tecnico',cliente:marcador,telefone:'41900000000',idempotencyKey:key,itens})});manifesto.pedidos.push({id:p.pedidoId,key});await salvar();return obter(p.pedidoId)}
const pdf=Buffer.from('%PDF-1.4\n% arte sintetica fase5\n1 0 obj<</Type/Catalog>>endobj\n%%EOF')
async function upload(p,item,slot=1,substituir){const key=randomUUID(),id=substituir??key;const path=`${p.id}/${item.id}/${id}/${key}.pdf`;manifesto.anexos.push(id);manifesto.caminhos.push(path);await salvar();const form=new FormData();form.set('arquivo',new Blob([pdf],{type:'application/pdf'}),'teste-fase5.pdf');form.set('slot',String(slot));form.set('expectedVersion',String(p.version));const r=await http(`${root}/pedidos/${p.id}/itens/${item.id}/anexos${substituir?'/'+substituir:''}`,{method:substituir?'PUT':'POST',headers:{'Idempotency-Key':key},body:form});return r}
async function fechar(p){const q=(await ok(`/api/pedidos-personalizados/pedidos/${p.id}/cotacao`)).cotacao;await ok(`${root}/pedidos/${p.id}/fechar`,{method:'POST',body:JSON.stringify({expectedVersion:p.version,numeroLancamento:'999998',cotacaoConfirmada:q})});return obter(p.id)}
async function transicao(p,status,campos={}){await ok(`/api/pedidos-personalizados/pedidos/${p.id}/status`,{method:'POST',body:JSON.stringify({expectedVersion:p.version,statusDestino:status,...campos})});return obter(p.id)}
const camposLayout={numeroPedidoCompra:'99998',dataPedidoFornecedor:'2026-10-13',comprador:'Teste'}
const papel={tipo:'PAPEL',classificacao:'CATALOGO',referencia:'DB813',medidas:[{larguraCm:350,alturaCm:270}]}
let principal,unidade,finalidade
try {
  const u=await db.from('usuarios_permitidos').select('id').eq('email','agente.teste@lebebe.cloud').single();assert.equal(u.error,null);manifesto.usuario=u.data.id
  finalidade=`Validação Fase5 ${marcador}`
  const gate=await db.from('pedidos_personalizados_decorisi_testadores').insert({usuario_id:manifesto.usuario,expira_em:new Date(Date.now()+3600000).toISOString(),finalidade});assert.equal(gate.error,null)
  await salvar()
  await etapa('sessão técnica, gate nominativo e quatro produtos',async()=>{
    await ok('/api/auth/agente',{method:'POST',body:JSON.stringify({secret:process.env.AGENT_TEST_BOOTSTRAP_SECRET})})
    const op=await ok(`${root}/opcoes`);assert.equal(op.db.length,222);assert.equal(op.db.filter(r=>r.referencia.startsWith('DB')).length,90);assert.equal(op.db.filter(r=>r.referencia.startsWith('XP')).length,132);assert.equal(op.pf.length,81);assert.deepEqual(op.precos.map(p=>p.produto_id_sgi).sort(),[36565,36566,36567,36568]);unidade=op.unidades[0].chave
    const f=await db.from('pedidos_personalizados_fornecedores').select('disponivel').eq('chave','decorisi').single();assert.equal(f.data.disponivel,false)
  })
  await etapa('quatro tipos reais e personalizado sem anexo recusado',async()=>{
    principal=await criar([papel,{...papel,classificacao:'PERSONALIZADO',descricao:'Arte papel teste'},{tipo:'PAINEL',classificacao:'CATALOGO',referencia:'PF200',medidas:[{larguraCm:101,alturaCm:101}]},{tipo:'PAINEL',classificacao:'PERSONALIZADO',descricao:'Arte painel teste',medidas:[{larguraCm:101,alturaCm:101}]}],unidade)
    const q=(await ok(`/api/pedidos-personalizados/pedidos/${principal.id}/cotacao`)).cotacao;assert.equal(q.completa,false)
    const r=await http(`${root}/pedidos/${principal.id}/fechar`,{method:'POST',body:JSON.stringify({expectedVersion:principal.version,numeroLancamento:'999998',cotacaoConfirmada:q})});assert.ok(r.status>=400)
    for(const i of principal.itens.filter(i=>i.classificacao==='PERSONALIZADO')){assert.equal((await upload(principal,i)).status,200);principal=await obter(principal.id)}
    principal=await fechar(principal);assert.ok(principal.itens.every(i=>i.snapshot_comercial))
  })
  const snapshots=principal.itens.map(i=>i.snapshot_comercial)
  await etapa('transição inválida, versão antiga e avanço concorrente sem histórico duplicado',async()=>{
    const path=`/api/pedidos-personalizados/pedidos/${principal.id}/status`
    assert.equal((await http(path,{method:'POST',body:JSON.stringify({expectedVersion:principal.version,statusDestino:'RECEBIDO',dataRecebimento:'2026-10-13'})})).status,422)
    const params={p_pedido_id:principal.id,p_expected_version:principal.version,p_usuario_id:manifesto.usuario,p_status_destino:'AGUARDANDO LAYOUT',p_numero_pedido_compra:'99998',p_data_pedido_fornecedor:'2026-10-13',p_comprador:'Teste'}
    const r=await Promise.all([db.rpc('transicionar_pedido_personalizado_decorisi',params),db.rpc('transicionar_pedido_personalizado_decorisi',params)])
    assert.equal(r.filter(x=>!x.error).length,1);assert.equal(r.find(x=>x.error).error.code,'P0003');principal=await obter(principal.id)
  })
  await etapa('anexos pós-venda, abertura privada e retorno para correção',async()=>{
    const item=principal.itens.find(i=>i.classificacao==='PERSONALIZADO'),id=item.anexos[0].id
    assert.equal((await upload(principal,item,1,id)).status,200);principal=await obter(principal.id)
    const a=await ok(`${root}/pedidos/${principal.id}/itens/${item.id}/anexos/${id}`);assert.equal((await fetch(a.url)).status,200)
    principal=await transicao(principal,'AGUARDANDO APROVAÇÃO DO CLIENTE');principal=await transicao(principal,'AGUARDANDO LAYOUT')
    assert.ok(principal.itens.filter(i=>i.classificacao==='PERSONALIZADO').every(i=>i.layout_alteracoes===1));assert.deepEqual(principal.itens.map(i=>i.snapshot_comercial),snapshots)
    principal=await transicao(principal,'AGUARDANDO APROVAÇÃO DO CLIENTE');principal=await transicao(principal,'EM PRODUÇÃO',{dataEntrega:'2026-10-20'})
  })
  await etapa('produção/recebido: adicionar permitido; substituição e remoção bloqueadas',async()=>{
    const item=principal.itens[0]
    assert.equal((await upload(principal,item)).status,200);principal=await obter(principal.id)
    const id=principal.itens[0].anexos[0].id
    assert.equal((await upload(principal,item,1,id)).status,409)
    assert.equal((await http(`${root}/pedidos/${principal.id}/itens/${item.id}/anexos/${id}`,{method:'DELETE',body:JSON.stringify({expectedVersion:principal.version})})).status,409)
    principal=await transicao(principal,'RECEBIDO',{dataRecebimento:'2026-10-13'})
    assert.equal((await upload(principal,item,2)).status,200);principal=await obter(principal.id)
    assert.equal((await upload(principal,item,1,id)).status,409)
    assert.deepEqual(principal.itens.map(i=>i.snapshot_comercial),snapshots)
  })
  await etapa('cancelamento em cada status não terminal; terminais protegidos',async()=>{
    for(const origem of ['RASCUNHO','VENDA FECHADA','AGUARDANDO LAYOUT','AGUARDANDO APROVAÇÃO DO CLIENTE','EM PRODUÇÃO']) {
      let p=await criar([papel],unidade)
      if(origem!=='RASCUNHO')p=await fechar(p)
      if(['AGUARDANDO LAYOUT','AGUARDANDO APROVAÇÃO DO CLIENTE','EM PRODUÇÃO'].includes(origem))p=await transicao(p,'AGUARDANDO LAYOUT',camposLayout)
      if(['AGUARDANDO APROVAÇÃO DO CLIENTE','EM PRODUÇÃO'].includes(origem))p=await transicao(p,'AGUARDANDO APROVAÇÃO DO CLIENTE')
      if(origem==='EM PRODUÇÃO')p=await transicao(p,'EM PRODUÇÃO',{dataEntrega:'2026-10-20'})
      p=await transicao(p,'CANCELADO',{justificativa:'Teste sintético autorizado'})
      assert.equal((await http(`/api/pedidos-personalizados/pedidos/${p.id}/status`,{method:'POST',body:JSON.stringify({expectedVersion:p.version,statusDestino:'AGUARDANDO LAYOUT',...camposLayout})})).status,422)
    }
  })
  await etapa('histórico, listagem, filtro e detalhes reais',async()=>{
    const l=await ok(`/api/pedidos-personalizados/pedidos?fornecedor=decorisi&cliente=${encodeURIComponent(marcador)}`);assert.equal(l.itens.length,6)
    for(const p of manifesto.pedidos){const d=(await ok(`/api/pedidos-personalizados/pedidos/${p.id}`)).pedido;const eventos=d.historico;assert.equal(new Set(eventos.map(e=>e.id)).size,eventos.length);manifesto.historico.push(...eventos.map(e=>e.id));assert.equal(d.fornecedor.chave,'decorisi')}
    await salvar()
  })
} catch(e){manifesto.erro=e.message;console.error('[fase5/real]',e.message);process.exitCode=1}
finally {
  if(manifesto.usuario){const r=await db.from('pedidos_personalizados_decorisi_testadores').delete().eq('usuario_id',manifesto.usuario).eq('finalidade',finalidade);assert.equal(r.error,null);manifesto.acessoRevogado=true}
  if(cookies.size)await ok('/api/auth/logout',{method:'POST'})
  await salvar();console.info(`[fase5/real] Manifesto: ${arquivo}; pedidos=${manifesto.pedidos.length}; revogado=${manifesto.acessoRevogado}`)
}
