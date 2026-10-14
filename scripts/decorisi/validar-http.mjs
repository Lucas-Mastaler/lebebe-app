// PostgREST oficial local + PostgreSQL nativo descartável. JWTs exclusivamente sintéticos.
import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { createHmac, randomBytes } from 'node:crypto'
import net from 'node:net'
import path from 'node:path'
import ts from 'typescript'
import { PostgrestClient } from '@supabase/postgrest-js'
import { abrirPostgresIsolado } from './postgres-isolado.mjs'
import { prepararSchemaEquivalente, inserirDadosSinteticos } from './schema-isolado.mjs'

const bin=process.env.DECORISI_POSTGREST_BIN
if(!bin || !path.isAbsolute(bin)) throw new Error('Defina DECORISI_POSTGREST_BIN com o binário oficial temporário; nenhuma URL externa é aceita.')
const pg=await abrirPostgresIsolado()
let processo,erroProcesso,saida='',testes=0
const segredo=randomBytes(48).toString('hex')
function jwt(role,exp=Math.floor(Date.now()/1000)+300) {
  const dados=[{alg:'HS256',typ:'JWT'},{role,exp}].map((v)=>Buffer.from(JSON.stringify(v)).toString('base64url')).join('.')
  return `${dados}.${createHmac('sha256',segredo).update(dados).digest('base64url')}`
}
async function verificar(nome,fn) { await fn(); testes++; console.info(`[decorisi/http] OK ${nome}`) }
try {
  const admin=await pg.conectar()
  await prepararSchemaEquivalente(admin); await inserirDadosSinteticos(admin)
  for(const nome of (await readdir(new URL('../../supabase/migrations/',import.meta.url))).filter((n)=>/_decorisi_.*\.sql$/.test(n)).sort()) await admin.query(await readFile(new URL(`../../supabase/migrations/${nome}`,import.meta.url),'utf8'))
  const porta=await new Promise((resolve,reject)=>{
    const s=net.createServer();s.on('error',reject);s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p))})
  })
  processo=spawn(bin,[],{windowsHide:true,stdio:['ignore','ignore','pipe'],env:{...process.env,
    PATH:`${path.join(process.env.DECORISI_PG_DEPS,'@embedded-postgres/windows-x64/native/bin')}${path.delimiter}${process.env.PATH ?? ''}`,
    PGRST_DB_URI:`postgresql://postgres@127.0.0.1:${pg.porta}/postgres`,PGRST_DB_SCHEMAS:'public',PGRST_DB_ANON_ROLE:'anon',
    PGRST_JWT_SECRET:segredo,PGRST_SERVER_HOST:'127.0.0.1',PGRST_SERVER_PORT:String(porta),PGRST_LOG_LEVEL:'error',
  }})
  processo.on('error',(e)=>{erroProcesso=e})
  processo.stderr.on('data',(v)=>{saida=(saida+v).slice(-1500)})
  const base=`http://127.0.0.1:${porta}`
  let pronto=false
  for(let i=0;i<150;i++) {
    if(erroProcesso) throw erroProcesso
    if(processo.exitCode!==null) throw new Error(`PostgREST encerrou (${processo.exitCode}): ${saida}`)
    try { if((await fetch(base)).ok) { pronto=true;break } } catch { /* Readiness: servidor ainda inicializando. */ }
    await new Promise((r)=>setTimeout(r,50))
  }
  if(!pronto) throw new Error(`PostgREST não iniciou: ${saida}`)
  // Executa a classe real do repositório; o único import da fonte é type-only.
  const source=await readFile(new URL('../../src/lib/pedidos-personalizados/server/decorisi-repositorio.ts',import.meta.url),'utf8')
  const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2020}}).outputText
  const {RepositorioDecorisi}=await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`)
  const service=new PostgrestClient(base,{headers:{Authorization:`Bearer ${jwt('service_role')}`}})
  const repo=new RepositorioDecorisi(service)
  const usuario='10000000-0000-4000-8000-000000000001',unidade='20000000-0000-4000-8000-000000000001'
  const parametros={p_usuario_id:usuario,p_idempotency_key:crypto.randomUUID(),p_unidade_id:unidade,p_consultora:'Teste',p_cliente:'Cliente sintético',p_telefone_normalizado:'41999999999',p_itens:[{tipo:'PAPEL',classificacao:'CATALOGO',referencia:'DB701',medidas:[{larguraCm:186,alturaCm:328}]}]}
  await verificar('gate de fornecedor e pesquisa DB pelo repositório real',async()=>{
    assert.equal((await repo.disponivel(usuario)).data,null)
    const r=await repo.referencias('813');assert.equal(r.error,null);assert.equal(r.data.length,1);assert.equal(r.data[0].referencia,'DB813')
  })
  await admin.query("update pedidos_personalizados_fornecedores set disponivel=true where chave='decorisi'")
  let pedido
  await verificar('RPC de criação e replay HTTP devolvem o mesmo pedido',async()=>{
    const r=await repo.criar(parametros);assert.equal(r.error,null,JSON.stringify(r.error));pedido=r.data
    const replay=await repo.criar(parametros);assert.equal(replay.error,null);assert.equal(replay.data.pedidoId,pedido.pedidoId);assert.equal(replay.data.reutilizado,true)
  })
  let item
  await verificar('consulta aninhada itens/medidas/anexos, filtro de fornecedor e escopo de unidades',async()=>{
    const r=await repo.pedido(pedido.pedidoId,[unidade]);assert.equal(r.error,null,JSON.stringify(r.error))
    assert.equal(r.data.itens.length,1);item=r.data.itens[0];assert.equal(item.medidas[0].largura_cm,186);assert.deepEqual(item.anexos,[])
    for(const unidades of [[],['20000000-0000-4000-8000-000000000002']]) {
      const fora=await repo.pedido(pedido.pedidoId,unidades);assert.equal(fora.error,null);assert.equal(fora.data,null)
    }
    const legado=(await admin.query("insert into pedidos_personalizados_pedidos(fornecedor_id,unidade_id,consultora,cliente,idempotency_key,created_by,updated_by) values('30000000-0000-4000-8000-000000000002',$1,'Teste','Cliente sintético',$2,$3,$3) returning id",[unidade,crypto.randomUUID(),usuario])).rows[0]
    const outro=await repo.pedido(legado.id,[unidade]);assert.equal(outro.error,null);assert.equal(outro.data,null)
  })
  await verificar('edição HTTP mantém ID e rejeita versão antiga',async()=>{
    const itens=[{...parametros.p_itens[0],id:item.id,medidas:[{larguraCm:187,alturaCm:328}]}]
    const r=await repo.atualizar(pedido.pedidoId,usuario,1,itens);assert.equal(r.error,null);assert.equal(r.data.version,2)
    const antigo=await repo.atualizar(pedido.pedidoId,usuario,1,itens);assert.equal(antigo.error.code,'P0003')
    pedido.version=2
  })
  await verificar('cotação autoritativa, preço alterado, fechamento e histórico congelado por HTTP',async()=>{
    const q=await repo.cotar(pedido.pedidoId,usuario);assert.equal(q.error,null);assert.equal(q.data.totalCentavos,'2002')
    await admin.query('update sgi_produtos_cache set preco=11.02 where produto_id_sgi=36565')
    const alterada=await repo.fechar(pedido.pedidoId,usuario,2,'123',q.data);assert.equal(alterada.error,null);assert.equal(alterada.data.erro,'COTACAO_ALTERADA')
    const fechar=await repo.fechar(pedido.pedidoId,usuario,2,'123',alterada.data.cotacao);assert.equal(fechar.error,null);assert.equal(fechar.data.version,3)
    assert.equal((await repo.fechar(pedido.pedidoId,usuario,2,'123',alterada.data.cotacao)).data.reutilizado,true)
    await admin.query('update sgi_produtos_cache set preco=99.99 where produto_id_sgi=36565')
    assert.equal((await repo.cotar(pedido.pedidoId,usuario)).data.totalCentavos,'2204')
  })
  await verificar('JWT inválido/expirado e roles anon/authenticated bloqueiam tabelas e RPCs',async()=>{
    for(const token of ['invalido',jwt('service_role',1)]) {
      const r=await fetch(`${base}/pedidos_personalizados_decorisi_referencias`,{headers:{Authorization:`Bearer ${token}`}});assert.equal(r.status,401)
    }
    for(const role of ['anon','authenticated']) {
      const client=new PostgrestClient(base,{headers:{Authorization:`Bearer ${jwt(role)}`}})
      const r=await client.from('pedidos_personalizados_decorisi_itens').select('*');assert(r.error);assert.equal(r.data,null)
      const rpc=await client.rpc('cotar_pedido_personalizado_decorisi',{p_pedido_id:pedido.pedidoId,p_usuario_id:usuario});assert(rpc.error);assert.equal(rpc.data,null)
    }
  })
  console.info(`[decorisi/http] ${testes} cenários aprovados. PostgREST local; sem GoTrue, gateway ou Storage Supabase.`)
} catch(erro) {
  console.error('[decorisi/http] FALHA',{mensagem:erro.message,codigo:erro.code});process.exitCode=1
} finally {
  if(processo && processo.exitCode===null) {const fim=once(processo,'exit');processo.kill();await fim}
  await pg.encerrar()
}
