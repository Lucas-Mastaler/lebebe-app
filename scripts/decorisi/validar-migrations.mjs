// Executa exclusivamente em um PostgreSQL WASM descartável, sem rede e sem env de produção.
// Dependência temporária: npm install --prefix <diretorio-temporario> @electric-sql/pglite
// DECORISI_PGLITE_MODULE=<caminho absoluto para dist/index.js> node scripts/decorisi/validar-migrations.mjs
import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import ts from 'typescript'
const nativo = process.env.DECORISI_PG_DEPS
let db
if (nativo) {
  const { abrirPostgresIsolado } = await import('./postgres-isolado.mjs')
  const { prepararSchemaEquivalente, inserirDadosSinteticos } = await import('./schema-isolado.mjs')
  const pg = await abrirPostgresIsolado()
  try {
    const client = await pg.conectar()
    await prepararSchemaEquivalente(client)
    await inserirDadosSinteticos(client)
    db = { query: (sql, params) => client.query(sql, params), exec: (sql) => client.query(sql), close: () => pg.encerrar() }
  } catch (erro) { await pg.encerrar(); throw erro }
} else {
  const modulo = process.env.DECORISI_PGLITE_MODULE
  if (!modulo) throw new Error('Defina DECORISI_PG_DEPS ou DECORISI_PGLITE_MODULE; nunca usar conexão de produção.')
  const { PGlite } = await import(pathToFileURL(modulo).href)
  db = new PGlite()
}
const usuario = '10000000-0000-4000-8000-000000000001', unidade = '20000000-0000-4000-8000-000000000001'
const source = await readFile(new URL('../../src/lib/pedidos-personalizados/decorisi/calculos.ts', import.meta.url), 'utf8')
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText
const calculos = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`)
let testes = 0
async function verificar(nome, fn) { await fn(); testes++; console.info(`[decorisi/sql] OK ${nome}`) }
async function valor(sql, params = []) { return (await db.query(sql, params)).rows[0]?.valor }
async function falha(sql, params, trecho) { await assert.rejects(db.query(sql, params), (e) => e.message.includes(trecho)) }
async function criar(itens, chave = crypto.randomUUID(), user = usuario, unit = unidade) {
  return valor('select criar_pedido_personalizado_decorisi($1,$2,$3,$4,$5,$6,$7) valor', [user,chave,unit,'Teste técnico','Cliente sintético','41999999999',JSON.stringify(itens)])
}
async function cotar(id) { return valor('select cotar_pedido_personalizado_decorisi($1,$2) valor',[id,usuario]) }
async function fechar(p, cotacao) { return valor('select fechar_pedido_personalizado_decorisi($1,$2,$3,$4,$5) valor',[p.pedidoId,usuario,p.version,'123',JSON.stringify(cotacao)]) }
const papel = { tipo:'PAPEL',classificacao:'CATALOGO',referencia:'DB701',medidas:[{larguraCm:186,alturaCm:328}] }
try {
  if (!nativo) await db.exec(await readFile(new URL('./fixture-isolada.sql', import.meta.url),'utf8'))
  const moriahAntes = await valor("select to_jsonb(c) valor from sgi_produtos_cache c where produto_id_sgi=39744")
  const migrations = (await readdir(new URL('../../supabase/migrations/', import.meta.url))).filter((f) => /_decorisi_.*\.sql$/.test(f)).sort()
  for (const nome of migrations) {
    let anterior
    let pedidoExistente
    if (nome.includes('catalogo_xadrezia')) {
      await db.exec("update pedidos_personalizados_fornecedores set disponivel=true where chave='decorisi'; select decorisi_vincular_produtos_sgi();")
      pedidoExistente = await criar([papel])
      await db.exec("update pedidos_personalizados_fornecedores set disponivel=false where chave='decorisi'")
      anterior = await valor("select jsonb_build_object('db',(select jsonb_agg(to_jsonb(r) order by referencia) from pedidos_personalizados_decorisi_referencias r), 'pedido',(select to_jsonb(p) from pedidos_personalizados_pedidos p where id=$1), 'itens',(select jsonb_agg(to_jsonb(i)) from pedidos_personalizados_decorisi_itens i where pedido_id=$1)) valor",[pedidoExistente.pedidoId])
    }
    await db.exec(await readFile(new URL(`../../supabase/migrations/${nome}`, import.meta.url),'utf8'))
    console.info(`[decorisi/sql] migration aplicada SOMENTE no banco descartável: ${nome}`)
    if (anterior) {
      const depois = await valor("select jsonb_build_object('db',(select jsonb_agg(to_jsonb(r) order by referencia) from pedidos_personalizados_decorisi_referencias r where referencia like 'DB%'), 'pedido',(select to_jsonb(p) from pedidos_personalizados_pedidos p where id=$1), 'itens',(select jsonb_agg(to_jsonb(i)) from pedidos_personalizados_decorisi_itens i where pedido_id=$1)) valor",[pedidoExistente.pedidoId])
      assert.deepEqual(depois,anterior)
      testes++
      console.info('[decorisi/sql] OK migration preserva DB e pedido anterior integralmente')
    }
  }
  await verificar('90 referências e 12 repetições zero; fornecedor preservado indisponível', async () => {
    assert.equal(await valor("select count(*)::int valor from pedidos_personalizados_decorisi_referencias where referencia like 'DB%'"),90)
    assert.equal(await valor("select count(*)::int valor from pedidos_personalizados_decorisi_referencias where repeticao_m=0 and referencia like 'DB%'"),12)
    assert.equal(await valor("select disponivel valor from pedidos_personalizados_fornecedores where chave='decorisi'"),false)
    const fonte=JSON.parse(await readFile(new URL('../../src/lib/pedidos-personalizados/decorisi/referencias-db.json',import.meta.url),'utf8'))
    const importadas=(await db.query("select referencia,repeticao_m::text repeticao,fonte,fonte_sha256,extraido_em from pedidos_personalizados_decorisi_referencias where referencia like 'DB%' order by referencia")).rows
    assert.deepEqual(importadas.map((r)=>({referencia:r.referencia,repeticaoM:Number(r.repeticao)})),fonte.registros.map((r)=>({referencia:r.referencia,repeticaoM:Number(r.repeticaoM)})))
    assert(importadas.every((r)=>r.fonte_sha256===fonte.sha256 && r.fonte===fonte.fonte && new Date(r.extraido_em).toISOString()===fonte.extraidoEm))
  })
  await verificar('gate impede criação antes da ativação', async () => { await assert.rejects(criar([papel]), /FORNECEDOR_INDISPONIVEL/) })
  await verificar('teste nominativo expira sem disponibilizar fornecedor globalmente', async () => {
    assert.equal(await valor('select decorisi_fornecedor_para_usuario($1) valor',[usuario]),null)
    await db.query("insert into pedidos_personalizados_decorisi_testadores(usuario_id,expira_em,finalidade) values($1,now()+interval '1 hour','Teste sintetico')",[usuario])
    assert.ok(await valor('select decorisi_fornecedor_para_usuario($1) valor',[usuario]))
    assert.equal(await valor("select disponivel valor from pedidos_personalizados_fornecedores where chave='decorisi'"),false)
    const teste=await criar([papel]); assert.ok(teste.pedidoId)
    await db.query("update pedidos_personalizados_decorisi_testadores set expira_em=now()-interval '1 minute' where usuario_id=$1",[usuario])
    assert.equal(await valor('select decorisi_fornecedor_para_usuario($1) valor',[usuario]),null)
    await assert.rejects(criar([papel]),/FORNECEDOR_INDISPONIVEL/)
    await db.query('delete from pedidos_personalizados_decorisi_testadores where usuario_id=$1',[usuario])
  })
  // Ativação apenas da fixture descartável, necessária para exercitar as rotinas.
  await db.exec("update pedidos_personalizados_fornecedores set disponivel=true where chave='decorisi'; select decorisi_vincular_produtos_sgi();")
  const p = await criar([papel])
  await verificar('Xadrezia: 132 XP íntegros, persistência catálogo/personalizado e cálculo por repetição', async () => {
    const fonte = JSON.parse(await readFile(new URL('../../src/lib/pedidos-personalizados/decorisi/referencias-xp.json', import.meta.url), 'utf8'))
    const refs = (await db.query("select referencia,repeticao_m::text repeticao from pedidos_personalizados_decorisi_referencias where referencia like 'XP%' order by referencia")).rows
    assert.equal(refs.length,132)
    assert.deepEqual(refs.map((r)=>[r.referencia,Number(r.repeticao)]),fonte.registros.map((r)=>[r.referencia,Number(r.repeticaoM)]))
    for (const classificacao of ['CATALOGO','PERSONALIZADO']) {
      const pedido = await criar([{...papel,classificacao,referencia:'XP001',descricao:classificacao==='PERSONALIZADO'?'Alterar linha azul':null,medidas:[{larguraCm:350,alturaCm:270}]}])
      const item = (await db.query('select i.id,r.referencia,r.repeticao_m from pedidos_personalizados_decorisi_itens i join pedidos_personalizados_decorisi_referencias r on r.id=i.referencia_db_id where pedido_id=$1',[pedido.pedidoId])).rows[0]
      assert.equal(item.referencia,'XP001')
      const calculo = (await db.query('select calcular_item_decorisi($1) valor',[item.id])).rows[0].valor
      assert.equal(Number(calculo.quantidade),Number(calculos.calcularPapelDecorisi([{larguraCm:350,alturaCm:270}],50).quantidade))
    }
    await assert.rejects(criar([{...papel,referencia:'XP133'}]), /REFERENCIA_DECORISI_INVALIDA/)
    await assert.rejects(criar([{...papel,tipo:'PAINEL',referencia:'XP001'}]), /check constraint/)
  })
  await verificar('quatro produtos SGI: código, preço atual, unidade e subtotal por arte',async()=>{
    const a=await criar([
      {...papel,medidas:[{larguraCm:62,alturaCm:995}]},
      {...papel,classificacao:'PERSONALIZADO',descricao:'Arte sintética A',medidas:[{larguraCm:62,alturaCm:995}]},
      {tipo:'PAINEL',classificacao:'CATALOGO',referencia:'PF200',medidas:[{larguraCm:100,alturaCm:100}]},
      {tipo:'PAINEL',classificacao:'PERSONALIZADO',descricao:'Arte sintética B',medidas:[{larguraCm:101,alturaCm:101}]},
    ])
    for(const item of (await db.query("select id from pedidos_personalizados_decorisi_itens where pedido_id=$1 and classificacao='PERSONALIZADO'",[a.pedidoId])).rows) {
      const anexo=crypto.randomUUID()
      await db.query('insert into pedidos_personalizados_decorisi_anexos(id,item_id,slot,bucket,path,nome_original,mime_type,tamanho_bytes,created_by,updated_by) values($1,$2,1,$3,$4,$5,$6,10,$7,$7)',[anexo,item.id,'pedidos-personalizados-anexos',`${a.pedidoId}/${item.id}/${anexo}/${crypto.randomUUID()}.pdf`,'teste.pdf','application/pdf',usuario])
    }
    const q=await cotar(a.pedidoId)
    assert.equal(q.completa,true)
    assert.deepEqual(q.itens.map((i)=>i.produtoIdSgi),[36565,36566,36567,36568])
    assert.deepEqual(q.itens.map((i)=>i.codigo),['19075','19076','19077','19078'])
    assert.deepEqual(q.itens.map((i)=>i.unidade),['ROLO','ROLO','M2','M2'])
    assert.deepEqual(q.itens.map((i)=>Number(i.preco)),[10.01,12.34,23.45,32.10])
    assert.equal(q.totalCentavos,'7855')
  })
  await verificar('persistência de produto, referência e medidas', async () => {
    assert.equal(await valor('select count(*)::int valor from pedidos_personalizados_decorisi_medidas m join pedidos_personalizados_decorisi_itens i on i.id=m.item_id where i.pedido_id=$1',[p.pedidoId]),1)
    const q=await cotar(p.pedidoId); assert.equal(q.itens[0].quantidade,'1'); assert.equal(q.totalCentavos,'1001'); assert.equal(q.completa,true)
  })
  await verificar('idempotência de criação e rejeição de conteúdo divergente', async () => {
    const chave=crypto.randomUUID(), a=await criar([papel],chave), b=await criar([papel],chave)
    assert.equal(a.pedidoId,b.pedidoId); assert.equal(b.reutilizado,true)
    await assert.rejects(criar([{...papel,referencia:'DB702'}],chave),/IDEMPOTENCY_PAYLOAD_DIVERGENTE/)
  })
  await verificar('unidade não autorizada rejeitada inclusive no SQL', async () => { await assert.rejects(criar([papel],crypto.randomUUID(),'10000000-0000-4000-8000-000000000002'), /ACESSO_NEGADO/) })
  await verificar('RLS e privilégios negam acesso direto e execução a authenticated/anon', async () => {
    for (const role of ['authenticated','anon']) {
      await db.exec(`set role ${role}`)
      try {
        await falha('select * from pedidos_personalizados_decorisi_itens',[],'permission denied')
        await falha('select cotar_pedido_personalizado_decorisi($1,$2)',[p.pedidoId,usuario],'permission denied')
      } finally { await db.exec('reset role') }
    }
  })
  await verificar('falha de atualização é atômica e conserva versão/itens', async () => {
    await falha('select atualizar_pedido_personalizado_decorisi($1,$2,1,$3)',[p.pedidoId,usuario,JSON.stringify([{...papel,medidas:[{larguraCm:-1,alturaCm:1}]}])],'MEDIDA_DECORISI_INVALIDA')
    assert.equal((await cotar(p.pedidoId)).version,1); assert.equal((await cotar(p.pedidoId)).totalCentavos,'1001')
  })
  await verificar('versão antiga e ID de item de outro pedido rejeitados', async () => {
    const itemId=await valor('select id valor from pedidos_personalizados_decorisi_itens where pedido_id=$1',[p.pedidoId])
    await falha('select atualizar_pedido_personalizado_decorisi($1,$2,0,$3)',[p.pedidoId,usuario,JSON.stringify([papel])],'CONFLITO_VERSAO')
    const outro=await criar([papel])
    await falha('select atualizar_pedido_personalizado_decorisi($1,$2,1,$3)',[outro.pedidoId,usuario,JSON.stringify([{...papel,id:itemId}])],'ITEM_DECORISI_INVALIDO')
  })
  await verificar('edição de rascunho preserva ID do card, reordena e atualiza identificação', async () => {
    const a=await criar([papel]), id=await valor('select id valor from pedidos_personalizados_decorisi_itens where pedido_id=$1',[a.pedidoId])
    const atualizado=await valor('select atualizar_pedido_personalizado_decorisi($1,$2,1,$3,$4) valor',[a.pedidoId,usuario,JSON.stringify([{...papel,id,medidas:[{larguraCm:187,alturaCm:328}]}]),JSON.stringify({unidade_id:unidade,consultora:'Outra consultora',cliente:'Outro teste',telefone_normalizado:'41988888888'})])
    assert.equal(atualizado.version,2)
    assert.equal(await valor('select id valor from pedidos_personalizados_decorisi_itens where pedido_id=$1',[a.pedidoId]),id)
    assert.equal((await cotar(a.pedidoId)).itens[0].quantidade,'2')
    assert.equal(await valor('select cliente valor from pedidos_personalizados_pedidos where id=$1',[a.pedidoId]),'Outro teste')
  })
  await verificar('cotação incompleta não fecha; painel personalizado sem PF permitido mas exige anexo', async () => {
    const a=await criar([{tipo:'PAINEL',classificacao:'PERSONALIZADO',descricao:'Arte nova',medidas:[{larguraCm:101,alturaCm:101}]}])
    const q=await cotar(a.pedidoId); assert.equal(q.completa,false); assert(q.itens[0].pendencias.includes('ANEXO_PERSONALIZACAO_OBRIGATORIO'))
    assert.equal((await fechar(a,q)).erro,'COTACAO_INCOMPLETA')
    const b=await criar([{tipo:'PAINEL',classificacao:'CATALOGO',referencia:'PF280',medidas:[]}]); assert.equal((await cotar(b.pedidoId)).completa,false)
  })
  await verificar('corte exato de 10m, largura inteira e ausência de faixas válidas', async () => {
    const limite=await criar([{...papel,medidas:[{larguraCm:62,alturaCm:995}]}])
    assert.equal((await cotar(limite.pedidoId)).itens[0].quantidade,'1')
    const excedido=await criar([{...papel,medidas:[{larguraCm:62,alturaCm:996}]}])
    const q=await cotar(excedido.pedidoId)
    assert.equal(q.completa,false); assert(q.itens[0].pendencias.includes('ALTURA_EXCEDE_ROLO_DECORISI'))
    assert.equal((await fechar(excedido,q)).erro,'COTACAO_INCOMPLETA')
    await assert.rejects(criar([{...papel,medidas:[{larguraCm:2147483648,alturaCm:1}]}]),/out of range/)
  })
  await verificar('mudança de preço exige nova confirmação, sem gravação parcial', async () => {
    const q=await cotar(p.pedidoId)
    await db.exec("update sgi_produtos_cache set preco=11.02 where produto_id_sgi=36565")
    const resultado=await fechar(p,q); assert.equal(resultado.erro,'COTACAO_ALTERADA'); assert.equal(resultado.cotacao.totalCentavos,'1102')
    assert.equal(await valor('select status valor from pedidos_personalizados_pedidos where id=$1',[p.pedidoId]),'RASCUNHO')
    assert.equal(await valor('select snapshot_comercial valor from pedidos_personalizados_decorisi_itens where pedido_id=$1',[p.pedidoId]),null)
  })
  await verificar('fechamento congela preço, é idempotente e preserva histórico único', async () => {
    const q=await cotar(p.pedidoId), fechado=await fechar(p,q)
    assert.equal(fechado.version,2); assert.equal((await fechar(p,q)).reutilizado,true)
    await db.exec('update sgi_produtos_cache set preco=12.03 where produto_id_sgi=36565')
    assert.equal((await cotar(p.pedidoId)).totalCentavos,'1102')
    assert.equal(await valor('select count(*)::int valor from pedidos_personalizados_status_historico where pedido_id=$1',[p.pedidoId]),1)
    await falha('select atualizar_pedido_personalizado_decorisi($1,$2,2,$3)',[p.pedidoId,usuario,JSON.stringify([papel])],'COMPOSICAO_DECORISI_BLOQUEADA')
  })
  await verificar('caminho genérico não pode fechar sem snapshot', async () => {
    const a=await criar([papel]); await falha("update pedidos_personalizados_pedidos set status='VENDA FECHADA' where id=$1",[a.pedidoId],'COTACAO_DECORISI_OBRIGATORIA')
  })
  await verificar('preços ausentes, zero, inativos, NaN e fora de linha bloqueiam fechamento', async () => {
    const a=await criar([papel])
    for (const alteracao of ["preco=null","preco=0","preco='NaN'","preco=12,ativo=false","ativo=true,fora_linha=true"]) {
      await db.exec(`update sgi_produtos_cache set ${alteracao} where produto_id_sgi=36565`)
      assert((await cotar(a.pedidoId)).itens[0].pendencias.includes('PRECO_DECORISI_INDISPONIVEL'))
    }
    await db.exec('update sgi_produtos_cache set preco=10.01,ativo=true,fora_linha=false where produto_id_sgi=36565')
  })
  await verificar('mesma referência de catálogo não pode ser dois cards', async () => { await assert.rejects(criar([papel,papel]), /decorisi_catalogo_db_unico/) })
  await verificar('SQL direto rejeita referências, FKs, limites, dimensões e produto de outro fornecedor',async()=>{
    for(const referencia of ['DB700','DB746','DB800','DB846','PF200']) await assert.rejects(criar([{...papel,referencia}]),/REFERENCIA_DECORISI_INVALIDA/)
    for(const referencia of ['PF199','PF281','DB701']) await assert.rejects(criar([{tipo:'PAINEL',classificacao:'CATALOGO',referencia,medidas:[]}]),/check constraint/)
    await assert.rejects(criar(Array.from({length:11},()=>papel)),/LIMITE_ITENS_DECORISI/)
    await assert.rejects(criar([{...papel,medidas:Array.from({length:21},()=>({larguraCm:1,alturaCm:1}))}]),/LIMITE_MEDIDAS_DECORISI/)
    const a=await criar([papel]),item=await valor('select id valor from pedidos_personalizados_decorisi_itens where pedido_id=$1',[a.pedidoId])
    await falha('update pedidos_personalizados_decorisi_itens set produto_id=$1 where id=$2',['00000000-0000-4000-8000-000000000001',item],'PRODUTO_DECORISI_INVALIDO')
    await falha('update pedidos_personalizados_decorisi_medidas set largura_cm=0 where item_id=$1',[item],'check constraint')
    await falha('update pedidos_personalizados_decorisi_medidas set item_id=$1 where item_id=$2',[crypto.randomUUID(),item],'COMPOSICAO_DECORISI_BLOQUEADA')
    await falha('update pedidos_personalizados_decorisi_referencias set repeticao_m=-1 where referencia=$1',['DB701'],'check constraint')
    await falha('update pedidos_personalizados_decorisi_referencias set repeticao_m=0.001 where referencia=$1',['DB701'],'check constraint')
    if(nativo) await falha('update pedidos_personalizados_decorisi_itens set produto_id=$1 where id=$2',['40000000-0000-4000-8000-000000000001',item],'PRODUTO_DECORISI_INVALIDO')
  })
  await verificar('artes distintas e personalizações não compartilham o ceil de rolos',async()=>{
    const parcial={...papel,medidas:[{larguraCm:62,alturaCm:100}]}
    const q=await cotar((await criar([parcial,{...parcial,referencia:'DB702'}])).pedidoId)
    assert.deepEqual(q.itens.map((i)=>i.quantidade),['1','1']); assert.equal(q.totalCentavos,'2002')
    const personalizadas=await cotar((await criar([{...parcial,classificacao:'PERSONALIZADO',descricao:'Arte A'},{...parcial,classificacao:'PERSONALIZADO',descricao:'Arte B'}])).pedidoId)
    assert.deepEqual(personalizadas.itens.map((i)=>i.quantidade),['1','1']); assert.equal(personalizadas.itens.length,2)
  })
  await verificar('anexo próprio libera personalização, respeita 5 slots, incrementa versão e protege último anexo', async () => {
    const a=await criar([{tipo:'PAINEL',classificacao:'PERSONALIZADO',descricao:'Arte sintética',medidas:[{larguraCm:101,alturaCm:101}]}])
    const item=await valor('select id valor from pedidos_personalizados_decorisi_itens where pedido_id=$1',[a.pedidoId])
    const inserir=async(slot,anexo=crypto.randomUUID(),prefixo=a.pedidoId)=>db.query('insert into pedidos_personalizados_decorisi_anexos(id,item_id,slot,bucket,path,nome_original,mime_type,tamanho_bytes,created_by,updated_by) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$9)',[anexo,item,slot,'pedidos-personalizados-anexos',`${prefixo}/${item}/${anexo}/${crypto.randomUUID()}.pdf`,'teste.pdf','application/pdf',10,usuario])
    await assert.rejects(inserir(1,crypto.randomUUID(),crypto.randomUUID()),/CAMINHO_ANEXO_INVALIDO/)
    const primeiro=crypto.randomUUID(); await inserir(1,primeiro)
    const q=await cotar(a.pedidoId); assert.equal(q.completa,true); assert.equal(q.version,2)
    const fechado=await fechar({...a,version:2},q); assert.equal(fechado.ok,true)
    await falha('delete from pedidos_personalizados_decorisi_anexos where id=$1',[primeiro],'ANEXO_PERSONALIZACAO_OBRIGATORIO')
    for(let slot=2;slot<=5;slot++) await inserir(slot)
    await assert.rejects(inserir(6),/check constraint/)
    await db.query("update pedidos_personalizados_pedidos set status='EM PRODUÇÃO' where id=$1",[a.pedidoId])
    await falha('delete from pedidos_personalizados_decorisi_anexos where id=$1',[primeiro],'ANEXO_DECORISI_BLOQUEADO')
  })
  await verificar('mudança de repetição exige nova cotação e não altera snapshot antigo', async () => {
    const a=await criar([{...papel,referencia:'DB813'}]),q=await cotar(a.pedidoId)
    await db.exec("update pedidos_personalizados_decorisi_referencias set repeticao_m=0.40,versao=versao+1 where referencia='DB813'")
    assert.equal((await fechar(a,q)).erro,'COTACAO_ALTERADA')
    await db.exec("update pedidos_personalizados_decorisi_referencias set repeticao_m=0.39,versao=versao+1 where referencia='DB813'")
  })
  await verificar('paridade SQL/TypeScript em 120 artes: papel com alturas variadas e painel exato', async () => {
    for (let k=1;k<=120;k++) {
      const medidas=[{larguraCm:62+k*3,alturaCm:101+k},{larguraCm:101+k,alturaCm:101+k},{larguraCm:k,alturaCm:250+k}]
      const painel=k%2===0, ref=k%3===0?'DB813':'DB701', repeticao=ref==='DB813'?39:0
      const a=await criar([{tipo:painel?'PAINEL':'PAPEL',classificacao:'CATALOGO',referencia:painel?'PF200':ref,medidas}])
      const q=await cotar(a.pedidoId), esperado=painel?calculos.calcularPainelDecorisi(medidas):calculos.calcularPapelDecorisi(medidas,repeticao)
      assert.equal(q.itens[0].quantidade,esperado.quantidade)
      assert.equal(q.totalCentavos,calculos.subtotalDecorisiCentavos(esperado.quantidade,painel?'23.45':'10.01'))
    }
  })
  await verificar('cache Moriah e quantidade de produtos Exclusive preservados', async () => {
    assert.deepEqual(await valor('select to_jsonb(c) valor from sgi_produtos_cache c where produto_id_sgi=39744'),moriahAntes)
    assert.equal(await valor("select count(*)::int valor from pedidos_personalizados_produtos p join pedidos_personalizados_fornecedores f on f.id=p.fornecedor_id where f.chave='lebebe_exclusive'"),nativo ? 1 : 0)
  })
  await verificar('paridade TS/SQL em limites inteiros e 20 alturas; arredondamento de meio centavo',async()=>{
    const casos=[
      {tipo:'PAPEL',referencia:'DB701',medidas:Array.from({length:20},(_,i)=>({larguraCm:2147483647-i,alturaCm:100+i}))},
      {tipo:'PAINEL',referencia:'PF280',medidas:[{larguraCm:2147483647,alturaCm:2147483647}]},
      {tipo:'PAPEL',referencia:'DB701',medidas:[{larguraCm:186,alturaCm:328}]},
      {tipo:'PAPEL',referencia:'DB701',medidas:[{larguraCm:186,alturaCm:329}]},
    ]
    for(const caso of casos) {
      const q=await cotar((await criar([{...caso,classificacao:'CATALOGO'}])).pedidoId)
      const painel=caso.tipo==='PAINEL',esperado=painel?calculos.calcularPainelDecorisi(caso.medidas):calculos.calcularPapelDecorisi(caso.medidas,0)
      assert.equal(q.itens[0].quantidade,esperado.quantidade)
      assert.equal(q.totalCentavos,calculos.subtotalDecorisiCentavos(esperado.quantidade,painel?'23.45':'10.01'))
    }
    await db.exec('update sgi_produtos_cache set preco=0.50 where produto_id_sgi=36567')
    const q=await cotar((await criar([{tipo:'PAINEL',classificacao:'CATALOGO',referencia:'PF200',medidas:[{larguraCm:1,alturaCm:100}]}])).pedidoId)
    assert.equal(q.itens[0].quantidade,'0.0100'); assert.equal(q.totalCentavos,'1')
  })
  const transicionar = (id, version, destino, campos = {}) => db.query(
    'select * from transicionar_pedido_personalizado_decorisi($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',
    [id,version,usuario,destino,campos.compra ?? null,campos.data ?? null,campos.comprador ?? null,campos.entrega ?? null,campos.recebimento ?? null,campos.justificativa ?? null])
  await verificar('papel catálogo sem anexo dispensa layout; versão e histórico únicos', async () => {
    const a=await criar([papel]); const q=await cotar(a.pedidoId); await fechar(a,q)
    let version=a.version+1
    const destinos=['EM PRODUÇÃO','RECEBIDO']
    for(const destino of destinos) {
      const campos={compra:'123',data:'2026-10-09',comprador:'Teste',entrega:'2026-10-20',recebimento:'2026-10-09'}
      const r=await transicionar(a.pedidoId,version,destino,campos); assert.equal(r.rows[0].version,++version)
      await assert.rejects(transicionar(a.pedidoId,version-1,destino,campos),/CONFLITO_VERSAO/)
    }
    assert.equal(await valor('select count(*)::int valor from pedidos_personalizados_status_historico where pedido_id=$1',[a.pedidoId]),3)
    await assert.rejects(transicionar(a.pedidoId,version,'CANCELADO',{justificativa:'Teste'}),/TRANSICAO_STATUS_INVALIDA/)
  })
  await verificar('retorno de layout preserva snapshots e conta apenas personalizações',async()=>{
    const a=await criar([papel,{tipo:'PAINEL',classificacao:'PERSONALIZADO',descricao:'Arte teste',medidas:[{larguraCm:100,alturaCm:100}]}])
    const item=await valor("select id valor from pedidos_personalizados_decorisi_itens where pedido_id=$1 and classificacao='PERSONALIZADO'",[a.pedidoId])
    const anexo=crypto.randomUUID()
    await db.query('insert into pedidos_personalizados_decorisi_anexos(id,item_id,slot,bucket,path,nome_original,mime_type,tamanho_bytes,created_by,updated_by) values($1,$2,1,$3,$4,$5,$6,10,$7,$7)',[anexo,item,'pedidos-personalizados-anexos',`${a.pedidoId}/${item}/${anexo}/${crypto.randomUUID()}.pdf`,'teste.pdf','application/pdf',usuario])
    const q=await cotar(a.pedidoId); await fechar({...a,version:q.version},q)
    const snapshot=await valor('select snapshot_comercial valor from pedidos_personalizados_decorisi_itens where id=$1',[item])
    let version=q.version+1
    await transicionar(a.pedidoId,version++,'AGUARDANDO LAYOUT',{compra:'123',data:'2026-10-09',comprador:'Teste'})
    await transicionar(a.pedidoId,version++,'AGUARDANDO APROVAÇÃO DO CLIENTE')
    await transicionar(a.pedidoId,version++,'AGUARDANDO LAYOUT')
    assert.deepEqual(await valor('select snapshot_comercial valor from pedidos_personalizados_decorisi_itens where id=$1',[item]),snapshot)
    assert.equal(await valor('select layout_alteracoes valor from pedidos_personalizados_decorisi_itens where id=$1',[item]),1)
    assert.equal(await valor("select layout_alteracoes valor from pedidos_personalizados_decorisi_itens where pedido_id=$1 and classificacao='CATALOGO'",[a.pedidoId]),0)
    await falha("update pedidos_personalizados_decorisi_itens set descricao='Alterada',layout_alteracoes=layout_alteracoes+1 where id=$1",[item],'COMPOSICAO_DECORISI_BLOQUEADA')
  })
  await verificar('cancelamento de rascunho e validação de versão nula',async()=>{
    const a=await criar([papel])
    await assert.rejects(transicionar(a.pedidoId,null,'CANCELADO',{justificativa:'Teste'}),/CONFLITO_VERSAO/)
    await assert.rejects(transicionar(a.pedidoId,a.version,'CANCELADO'),/JUSTIFICATIVA/)
    await transicionar(a.pedidoId,a.version,'CANCELADO',{justificativa:'Teste sintético'})
  })

  for (const [nome,itens,dispensa] of [
    ['vários papéis catálogo',[papel,{...papel,referencia:'DB702'}],true],
    ['papel personalizado',[{...papel,classificacao:'PERSONALIZADO',descricao:'Arte teste'}],false],
    ['painel Fofura',[{tipo:'PAINEL',classificacao:'CATALOGO',referencia:'PF200',medidas:papel.medidas}],false],
    ['painel personalizado',[{tipo:'PAINEL',classificacao:'PERSONALIZADO',descricao:'Arte teste',medidas:papel.medidas}],false],
    ['papel misto',[papel,{...papel,classificacao:'PERSONALIZADO',descricao:'Arte teste'}],false],
    ['papel e painel',[papel,{tipo:'PAINEL',classificacao:'CATALOGO',referencia:'PF200',medidas:papel.medidas}],false],
  ]) await verificar('nova regra: '+nome,async()=>{
    const a=await criar(itens);
    const personalizados=(await db.query("select id from pedidos_personalizados_decorisi_itens where pedido_id=$1 and classificacao='PERSONALIZADO'",[a.pedidoId])).rows;
    for(const item of personalizados){
      const id=crypto.randomUUID();
      await db.query('insert into pedidos_personalizados_decorisi_anexos(id,item_id,slot,bucket,path,nome_original,mime_type,tamanho_bytes,created_by,updated_by) values($1,$2,1,$3,$4,$5,$6,10,$7,$7)',[id,item.id,'pedidos-personalizados-anexos',a.pedidoId+'/'+item.id+'/'+id+'/'+crypto.randomUUID()+'.pdf','teste.pdf','application/pdf',usuario]);
    }
    const q=await cotar(a.pedidoId);await fechar({...a,version:q.version},q);
    let version=q.version+1;
    const campos={compra:'123',data:'2026-10-09',comprador:'Teste',entrega:'2026-10-20',recebimento:'2026-10-09'};
    await assert.rejects(transicionar(a.pedidoId,version,dispensa?'AGUARDANDO LAYOUT':'EM PRODUÇÃO',campos),/TRANSICAO_STATUS_INVALIDA/);
    if(dispensa) await assert.rejects(transicionar(a.pedidoId,version,'AGUARDANDO APROVAÇÃO DO CLIENTE',campos),/TRANSICAO_STATUS_INVALIDA/);
    for(const destino of dispensa?['EM PRODUÇÃO','RECEBIDO']:['AGUARDANDO LAYOUT','AGUARDANDO APROVAÇÃO DO CLIENTE','EM PRODUÇÃO','RECEBIDO']) {
      await transicionar(a.pedidoId,version++,destino,campos);
      await assert.rejects(transicionar(a.pedidoId,version-2,destino,campos),/CONFLITO_VERSAO/);
    }
    const historico=(await db.query('select status_novo from pedidos_personalizados_status_historico where pedido_id=$1 order by version_nova',[a.pedidoId])).rows.map(r=>r.status_novo);
    assert.deepEqual(historico,dispensa?['VENDA FECHADA','EM PRODUÇÃO','RECEBIDO']:['VENDA FECHADA','AGUARDANDO LAYOUT','AGUARDANDO APROVAÇÃO DO CLIENTE','EM PRODUÇÃO','RECEBIDO']);
  });
  console.info(`[decorisi/sql] ${testes} cenários aprovados; PostgreSQL isolado descartável; produção não acessada.`)
} catch (erro) {
  console.error('[decorisi/sql] FALHA', { mensagem: erro.message, codigo: erro.code, posicao: erro.position, contexto: erro.where })
  process.exitCode = 1
} finally { await db.close() }
