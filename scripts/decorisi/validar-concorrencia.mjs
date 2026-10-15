// Duas sessões TCP independentes + observador, somente PG17.6 descartável.
import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import { abrirPostgresIsolado } from './postgres-isolado.mjs'
import { prepararSchemaEquivalente, inserirDadosSinteticos } from './schema-isolado.mjs'

const pg = await abrirPostgresIsolado()
const usuario = '10000000-0000-4000-8000-000000000001'
const editor = '10000000-0000-4000-8000-000000000003'
const unidade = '20000000-0000-4000-8000-000000000001'
const papel = { tipo: 'PAPEL', classificacao: 'CATALOGO', referencia: 'DB701', medidas: [{ larguraCm: 186, alturaCm: 328 }] }
let testes = 0
async function valor(c, sql, params = []) { return (await c.query(sql, params)).rows[0]?.valor }
const criar = (c, itens = [papel], chave = crypto.randomUUID()) => valor(c, 'select criar_pedido_personalizado_decorisi($1,$2,$3,$4,$5,$6,$7) valor', [usuario,chave,unidade,'Teste técnico','Cliente sintético','41999999999',JSON.stringify(itens)])
const cotar = (c,p) => valor(c,'select cotar_pedido_personalizado_decorisi($1,$2) valor',[p.pedidoId,usuario])
const editar = (c,p,itens=[papel],user=usuario) => valor(c,'select atualizar_pedido_personalizado_decorisi($1,$2,$3,$4) valor',[p.pedidoId,user,p.version,JSON.stringify(itens)])
const fechar = (c,p,q) => valor(c,'select fechar_pedido_personalizado_decorisi($1,$2,$3,$4,$5) valor',[p.pedidoId,usuario,p.version,'123',JSON.stringify(q)])
async function verificar(nome, fn) { await fn(); testes++; console.info(`[decorisi/pg17] OK ${nome}`) }
// Não depende de um delay para presumir concorrência: observa o bloqueio real no servidor.
async function esperarLock(observador, pid) {
  const fim = Date.now()+4000
  while (Date.now()<fim) {
    if (await valor(observador,"select wait_event_type='Lock' valor from pg_stat_activity where pid=$1",[pid])) return
    await new Promise((r)=>setTimeout(r,20))
  }
  throw new Error(`Sessão ${pid} não entrou em espera de lock`)
}
async function preservarFornecedores(c) {
  return valor(c,`select jsonb_build_object(
    'fornecedores',(select jsonb_agg(to_jsonb(f) order by f.id) from pedidos_personalizados_fornecedores f where chave<>'decorisi'),
    'produtos',(select jsonb_agg(to_jsonb(p) order by p.id) from pedidos_personalizados_produtos p join pedidos_personalizados_fornecedores f on f.id=p.fornecedor_id where f.chave<>'decorisi'),
    'pedidos',(select jsonb_agg(to_jsonb(p)-'decorisi_criacao_hash' order by p.id) from pedidos_personalizados_pedidos p join pedidos_personalizados_fornecedores f on f.id=p.fornecedor_id where f.chave<>'decorisi'),
    'tapetes',(select jsonb_agg(to_jsonb(t) order by id) from pedidos_personalizados_moriah_tapetes t),
    'exclusive',(select jsonb_agg(to_jsonb(i) order by id) from pedidos_personalizados_lebebe_exclusive_itens i),
    'cache',(select to_jsonb(c) from sgi_produtos_cache c where produto_id_sgi=39744)
  ) valor`)
}
async function criarLegados(c) {
  const m = (await c.query('select * from criar_pedido_personalizado_moriah($1,$2,$3,$4,$5,$6,$7::jsonb)',[usuario,crypto.randomUUID(),'30000000-0000-4000-8000-000000000002',unidade,'Teste','Cliente sintético',JSON.stringify([{ordem:1,tipo:'CATALOGO',formato:'REDONDO',dimensao_1_cm:100,area_cobrada_centesimos_m2:100,produto_id:'40000000-0000-4000-8000-000000000001',nome_colecao_catalogo:'Teste',referencia_catalogo:'TESTE'}])])).rows[0]
  const e = (await c.query('select * from criar_pedido_personalizado_lebebe_exclusive($1,$2,$3,$4,$5,$6,$7,$8,$9)',[usuario,crypto.randomUUID(),'30000000-0000-4000-8000-000000000003',unidade,'Teste','Cliente sintético','41999999999',null,JSON.stringify([{ordem:1,produto_id:'40000000-0000-4000-8000-000000000002',quantidade:2}])])).rows[0]
  return [m,e]
}
try {
  const admin=await pg.conectar()
  const versao=await valor(admin,"select current_setting('server_version') valor")
  assert.match(versao,/^17\.6(?:\s|$)/); console.info(`[decorisi/pg17] PostgreSQL ${versao}, somente loopback`)
  const manifesto=await prepararSchemaEquivalente(admin)
  await inserirDadosSinteticos(admin)
  await criarLegados(admin)
  const antes=await preservarFornecedores(admin)
  const funcoesAntes=(await admin.query("select oid::regprocedure::text assinatura,md5(pg_get_functiondef(oid)) hash from pg_proc where proname in ('criar_pedido_personalizado_moriah','criar_pedido_personalizado_lebebe_exclusive','transicionar_pedido_personalizado') order by 1")).rows
  for (const nome of (await readdir(new URL('../../supabase/migrations/',import.meta.url))).filter((n)=>/_decorisi_.*\.sql$/.test(n)).sort()) {
    await admin.query(await readFile(new URL(`../../supabase/migrations/${nome}`,import.meta.url),'utf8'))
    console.info(`[decorisi/pg17] migration OK: ${nome}`)
  }
  await verificar('schema real reproduzido: 18 tabelas, constraints, índices, triggers, policies e RPCs',async()=>{
    assert.equal(manifesto.tabelas.length,18)
    assert.deepEqual(await preservarFornecedores(admin),antes)
    assert.deepEqual((await admin.query("select oid::regprocedure::text assinatura,md5(pg_get_functiondef(oid)) hash from pg_proc where proname in ('criar_pedido_personalizado_moriah','criar_pedido_personalizado_lebebe_exclusive','transicionar_pedido_personalizado') order by 1")).rows,funcoesAntes)
  })
  await admin.query("update pedidos_personalizados_fornecedores set disponivel=true where chave='decorisi'")
  const a=await pg.conectar('service_role'),b=await pg.conectar('service_role')
  const pidA=await valor(a,'select pg_backend_pid() valor'),pidB=await valor(b,'select pg_backend_pid() valor')
  assert.notEqual(pidA,pidB); console.info(`[decorisi/pg17] sessões independentes: ${pidA}, ${pidB}`)
  await verificar('duas edições de medidas por usuários diferentes: segunda rejeitada por versão',async()=>{
    const p=await criar(a)
    await a.query('begin'); await editar(a,p,[{...papel,medidas:[{larguraCm:187,alturaCm:328}]}])
    const segunda=editar(b,p,[{...papel,medidas:[{larguraCm:999,alturaCm:328}]}],editor).then(()=>({sucesso:true}),(e)=>({erro:e.message}))
    await esperarLock(admin,pidB); await a.query('commit')
    assert.match((await segunda).erro,/CONFLITO_VERSAO/)
    assert.equal((await cotar(a,p)).itens[0].quantidade,'2')
  })
  await verificar('edição em andamento invalida fechamento antigo',async()=>{
    const p=await criar(a),q=await cotar(a,p)
    await a.query('begin'); await editar(a,p)
    const tentativa=fechar(b,p,q).then(()=>null,(e)=>e.message)
    await esperarLock(admin,pidB); await a.query('commit')
    assert.match(await tentativa,/CONFLITO_VERSAO/)
    assert.equal(await valor(a,'select status valor from pedidos_personalizados_pedidos where id=$1',[p.pedidoId]),'RASCUNHO')
  })
  await verificar('dois fechamentos simultâneos: snapshot e histórico uma única vez',async()=>{
    const p=await criar(a),q=await cotar(a,p)
    await a.query('begin'); const primeiro=await fechar(a,p,q)
    const segundo=fechar(b,p,q)
    await esperarLock(admin,pidB); await a.query('commit')
    assert.equal(primeiro.reutilizado,false); assert.equal((await segundo).reutilizado,true)
    assert.equal(await valor(a,'select count(*)::int valor from pedidos_personalizados_status_historico where pedido_id=$1',[p.pedidoId]),1)
  })
  await verificar('fechamento em andamento bloqueia edição; composição vendida preservada',async()=>{
    const p=await criar(a),q=await cotar(a,p)
    await a.query('begin'); await fechar(a,p,q)
    const tentativa=editar(b,p).then(()=>null,(e)=>e.message)
    await esperarLock(admin,pidB); await a.query('commit')
    assert.match(await tentativa,/CONFLITO_VERSAO|COMPOSICAO_DECORISI_BLOQUEADA/)
    assert.equal((await cotar(a,p)).totalCentavos,q.totalCentavos)
    await assert.rejects(a.query("update pedidos_personalizados_decorisi_itens set snapshot_comercial='{}' where pedido_id=$1",[p.pedidoId]),/COMPOSICAO_DECORISI_BLOQUEADA|SNAPSHOT_DECORISI_IMUTAVEL/)
    assert.equal((await cotar(a,p)).totalCentavos,q.totalCentavos)
  })
  await verificar('criação simultânea com mesma chave converge para um pedido',async()=>{
    const chave=crypto.randomUUID()
    await a.query('begin'); const p=await criar(a,[papel],chave)
    const repetido=criar(b,[papel],chave)
    await esperarLock(admin,pidB); await a.query('commit')
    assert.equal((await repetido).pedidoId,p.pedidoId)
    assert.equal(await valor(a,'select count(*)::int valor from pedidos_personalizados_pedidos where created_by=$1 and idempotency_key=$2',[usuario,chave]),1)
  })
  await verificar('resposta perdida após COMMIT: reconexão e replay não duplicam fechamento',async()=>{
    const p=await criar(a),q=await cotar(a,p),conexao=await pg.conectar('service_role')
    await conexao.query('begin'); await fechar(conexao,p,q); await conexao.query('commit'); await conexao.end()
    // O cliente descarta a resposta e repete por outra conexão, como após timeout de transporte.
    assert.equal((await fechar(b,p,q)).reutilizado,true)
    assert.equal(await valor(a,'select count(*)::int valor from pedidos_personalizados_status_historico where pedido_id=$1',[p.pedidoId]),1)
  })
  await verificar('timeout real esperando lock: retry depois do COMMIT reutiliza fechamento',async()=>{
    const p=await criar(a),q=await cotar(a,p)
    await a.query('begin'); await fechar(a,p,q)
    await b.query("set statement_timeout='150ms'")
    try { await assert.rejects(fechar(b,p,q),(e)=>e.code==='57014') }
    finally { await b.query("set statement_timeout='15s'"); await a.query('commit') }
    assert.equal((await fechar(b,p,q)).reutilizado,true)
    assert.equal(await valor(a,'select count(*)::int valor from pedidos_personalizados_status_historico where pedido_id=$1',[p.pedidoId]),1)
  })
  await verificar('preço não confirmado: cotação vê versão COMMIT; fechamento espera atualização e exige reconfirmação',async()=>{
    const p=await criar(a),q=await cotar(a,p)
    await b.query('begin'); await b.query('update sgi_produtos_cache set preco=11.02 where produto_id_sgi=36565')
    assert.equal((await cotar(a,p)).totalCentavos,q.totalCentavos)
    const tentativa=fechar(a,p,q)
    await esperarLock(admin,pidA); await b.query('commit')
    const resposta=await tentativa
    assert.equal(resposta.erro,'COTACAO_ALTERADA'); assert.equal(resposta.cotacao.totalCentavos,'1102')
    await admin.query('update sgi_produtos_cache set preco=10.01 where produto_id_sgi=36565')
  })
  await verificar('preço atualizado depois do lock não muda snapshot vendido',async()=>{
    const p=await criar(a),q=await cotar(a,p)
    await a.query('begin'); await fechar(a,p,q)
    const atualizar=b.query('update sgi_produtos_cache set preco=12.03 where produto_id_sgi=36565')
    await esperarLock(admin,pidB); await a.query('commit'); await atualizar
    assert.equal((await cotar(a,p)).totalCentavos,q.totalCentavos)
    await admin.query('update sgi_produtos_cache set preco=10.01 where produto_id_sgi=36565')
  })
  await verificar('repetição alterada concorrente exige reconfirmação',async()=>{
    const p=await criar(a,[{...papel,referencia:'DB813'}]),q=await cotar(a,p)
    await b.query('begin'); await b.query("update pedidos_personalizados_decorisi_referencias set repeticao_m=0.40,versao=versao+1 where referencia='DB813'")
    const tentativa=fechar(a,p,q)
    await esperarLock(admin,pidA); await b.query('commit')
    assert.equal((await tentativa).erro,'COTACAO_ALTERADA')
  })
  await verificar('falha no segundo snapshot faz rollback de snapshots, status, versão e histórico',async()=>{
    const p=await criar(a,[papel,{...papel,referencia:'DB702'}]),q=await cotar(a,p)
    await admin.query("create function teste_falha_snapshot() returns trigger language plpgsql as $$ begin if new.ordem=2 and new.snapshot_comercial is not null then raise exception 'FALHA_SINTETICA'; end if; return new; end $$; create trigger teste_falha before update on pedidos_personalizados_decorisi_itens for each row execute function teste_falha_snapshot()")
    try { await assert.rejects(fechar(a,p,q),/FALHA_SINTETICA/) } finally { await admin.query('drop trigger teste_falha on pedidos_personalizados_decorisi_itens; drop function teste_falha_snapshot()') }
    assert.equal(await valor(a,'select count(*)::int valor from pedidos_personalizados_decorisi_itens where pedido_id=$1 and snapshot_comercial is not null',[p.pedidoId]),0)
    assert.equal(await valor(a,'select count(*)::int valor from pedidos_personalizados_status_historico where pedido_id=$1',[p.pedidoId]),0)
    assert.equal((await cotar(a,p)).version,1)
    assert.equal(await valor(a,'select status valor from pedidos_personalizados_pedidos where id=$1',[p.pedidoId]),'RASCUNHO')
  })
  await verificar('transições simultâneas: uma versão e um evento operacional',async()=>{
    const p=await criar(a),q=await cotar(a,p); await fechar(a,p,q)
    const sql='select * from transicionar_pedido_personalizado_decorisi($1,$2,$3,$4,$5,$6,$7,$8)'
    const params=[p.pedidoId,p.version+1,usuario,'EM PRODUÇÃO','123','2026-10-09','Teste','2026-10-20']
    await a.query('begin'); await a.query(sql,params)
    const concorrente=b.query(sql,params).then(()=>null,e=>e.message)
    await esperarLock(admin,pidB); await a.query('commit')
    assert.match(await concorrente,/CONFLITO_VERSAO/)
    assert.equal(await valor(a,'select count(*)::int valor from pedidos_personalizados_status_historico where pedido_id=$1',[p.pedidoId]),2)
    assert.equal(await valor(a,'select version valor from pedidos_personalizados_pedidos where id=$1',[p.pedidoId]),p.version+2)
  })
  await verificar('ACL e RLS de todas as novas tabelas e funções negam anon/authenticated',async()=>{
    const tabelas=['referencias','itens','medidas','anexos','testadores']
    for (const role of ['anon','authenticated']) {
      const c=await pg.conectar(role)
      for (const tabela of tabelas) await assert.rejects(c.query(`select * from pedidos_personalizados_decorisi_${tabela}`),/permission denied/)
      const privilegios=(await admin.query("select p.oid::regprocedure::text assinatura,has_function_privilege($1,p.oid,'EXECUTE') permitido from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and (p.proname like '%decorisi%' or p.proname='decorisi_salvar_itens')",[role])).rows
      assert(privilegios.length>8); assert(privilegios.every((p)=>!p.permitido))
    }
    assert.equal(await valor(admin,"select count(*)::int valor from pg_class where relname like 'pedidos_personalizados_decorisi_%' and relkind='r' and relrowsecurity"),5)
  })
  await verificar('vínculos SGI rejeitam NaN e código trocado',async()=>{
    for (const alteracao of ["preco='NaN'","preco=10.01,codigo='ERRADO'"]) {
      await admin.query(`update sgi_produtos_cache set ${alteracao} where produto_id_sgi=36565`)
      await assert.rejects(a.query('select decorisi_vincular_produtos_sgi()'),/CACHE_DECORISI_INCOMPLETO/)
      const p=await criar(a)
      assert.equal((await cotar(a,p)).completa,false)
    }
    await admin.query("update sgi_produtos_cache set preco=10.01,codigo='19075' where produto_id_sgi=36565")
  })
  await verificar('ID SGI incompatível no produto local bloqueia cotação; escopo protege outros fornecedores',async()=>{
    const p=await criar(a)
    await admin.query("update pedidos_personalizados_produtos set produto_id_sgi=null where codigo='19076'; update pedidos_personalizados_produtos set produto_id_sgi=36566 where codigo='19075'")
    assert.equal((await cotar(a,p)).completa,false)
    // Desfaz a corrupção proposital da fixture; não pede à migration que repare
    // silenciosamente uma troca incompatível, que pode colidir na FK única.
    await admin.query("update pedidos_personalizados_produtos set produto_id_sgi=null where codigo in ('19075','19076'); select decorisi_vincular_produtos_sgi()")
    const outro=await valor(a,"select p.id valor from pedidos_personalizados_pedidos p join pedidos_personalizados_fornecedores f on f.id=p.fornecedor_id where f.chave='moriah_tapetes' limit 1")
    await assert.rejects(cotar(a,{pedidoId:outro}),/PEDIDO_NAO_ENCONTRADO/)
    await assert.rejects(fechar(a,{pedidoId:outro,version:1},{}),/PEDIDO_NAO_ENCONTRADO/)
    await assert.rejects(editar(a,{pedidoId:outro,version:1}),/PRODUTO_DECORISI_INVALIDO|REFERENCIA_DECORISI_INVALIDA/)
    const desautorizado='10000000-0000-4000-8000-000000000002'
    for(const sql of [
      'select cotar_pedido_personalizado_decorisi($1,$2)',
      'select atualizar_pedido_personalizado_decorisi($1,$2,1,\'[]\')',
      'select fechar_pedido_personalizado_decorisi($1,$2,1,\'123\',\'{}\')',
    ]) await assert.rejects(a.query(sql,[p.pedidoId,desautorizado]),/ACESSO_NEGADO/)
  })

  await verificar('duas transições diretas concorrentes: uma versão e um histórico',async()=>{
    const p=await criar(a),q=await cotar(a,p);await fechar(a,p,q);
    const sql="select * from transicionar_pedido_personalizado_decorisi($1,$2,$3,'EM PRODUÇÃO','123','2026-10-09','Teste','2026-10-20')";
    const params=[p.pedidoId,q.version+1,usuario];
    await a.query('begin');await a.query(sql,params);
    const segunda=b.query(sql,params).then(()=>null,e=>e.message);
    await esperarLock(admin,pidB);await a.query('commit');
    assert.match(await segunda,/CONFLITO_VERSAO/);
    assert.equal(await valor(a,"select count(*)::int valor from pedidos_personalizados_status_historico where pedido_id=$1 and status_novo='EM PRODUÇÃO'",[p.pedidoId]),1);
    assert.equal(await valor(a,"select count(*)::int valor from pedidos_personalizados_status_historico where pedido_id=$1 and status_novo in ('AGUARDANDO LAYOUT','AGUARDANDO APROVAÇÃO DO CLIENTE')",[p.pedidoId]),0);
  });
  await verificar('Moriah/Exclusive preservados; criação e status legados continuam funcionais',async()=>{
    assert.deepEqual(await preservarFornecedores(admin),antes)
    const pedidos=await criarLegados(a)
    for(const p of pedidos) {
      const resultado=await a.query("select * from transicionar_pedido_personalizado($1,1,$2,'VENDA FECHADA','123')",[p.pedido_id,usuario])
      assert.equal(resultado.rows[0].version,2)
    }
  })
  console.info(`[decorisi/pg17] ${testes} cenários aprovados; banco encerrado e removido ao final.`)
} catch (erro) {
  console.error('[decorisi/pg17] FALHA',{mensagem:erro.message,codigo:erro.code,contexto:erro.where})
  process.exitCode=1
} finally { await pg.encerrar() }
