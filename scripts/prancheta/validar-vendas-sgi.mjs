// PostgreSQL em memória e dados sintéticos. Não conecta ao Supabase/VPS.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
const { PGlite } = await import(pathToFileURL(process.argv[2] ?? 'C:/Users/lebeb/AppData/Local/Temp/prancheta-entrega2-sql-runtime/node_modules/@electric-sql/pglite/dist/index.js').href)
const db = new PGlite()
const migration = readFileSync('supabase/migrations/20261021211003_atendimento_presencial_resolver_vendas_sgi.sql','utf8')
const ajusteTelefone = readFileSync('supabase/migrations/20261021211542_atendimento_presencial_sgi_telefone_escopo_unidades.sql','utf8')
const ajusteSnapshot = readFileSync('supabase/migrations/20261021212454_atendimento_presencial_sgi_telefone_snapshot.sql','utf8')
const historicoCompartilhado = readFileSync('supabase/migrations/20261022140458_atendimento_presencial_sgi_historico_compartilhado.sql','utf8')
const id = n => `10000000-0000-4000-8000-${String(n).padStart(12,'0')}`
const cliente=id(1), outro=id(2), unidade=id(3), outraUnidade=id(4), usuario=id(5), outroUsuario=id(6), atendimento=id(7), documento=id(8), importacao=id(9)
await db.exec(`
CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
CREATE TABLE app_unidades(id uuid PRIMARY KEY,chave text);
CREATE TABLE atendimento_presencial_clientes(id uuid PRIMARY KEY,nome text,status text,telefone_informado text,telefone_normalizado text,telefone_normalizado_ddi text);
CREATE TABLE atendimento_presencial_atendimentos(id uuid PRIMARY KEY,cliente_id uuid,consultora_usuario_id uuid,unidade_id uuid,numero_lancamento int,iniciado_em timestamptz,status text,resultado_atendimento text);
CREATE TABLE sgi_importacoes_documentos_saida(id uuid PRIMARY KEY,status text,total_erros int);
CREATE TABLE sgi_documentos_saida(id uuid PRIMARY KEY,importacao_id uuid,numero_lancamento text,numero_lancamento_original text,numero_documento text,cliente text,filial text,data_fechamento timestamptz,telefone_principal text,telefone_normalizado text,contatos text,vendedor text,status text,valor_total numeric);
CREATE TABLE sgi_documentos_saida_contatos(id uuid PRIMARY KEY,documento_saida_id uuid,telefone_normalizado text,telefone_normalizado_ddi text);
CREATE TABLE sgi_documentos_saida_produtos(id uuid PRIMARY KEY,documento_saida_id uuid,produto text,quantidade numeric,valor_total numeric,departamento_classificado text,subgrupo_classificado text);
CREATE TABLE sgi_documentos_saida_pagamentos(id uuid PRIMARY KEY,documento_saida_id uuid,forma_pagamento text,valor numeric,numero_parcelas int);
GRANT USAGE ON SCHEMA public TO service_role;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO service_role;
ALTER TABLE atendimento_presencial_atendimentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE atendimento_presencial_clientes ENABLE ROW LEVEL SECURITY;
`)
await db.exec(migration)
await db.exec(ajusteTelefone)
await db.exec(ajusteSnapshot)
await db.exec(historicoCompartilhado)
await db.exec(historicoCompartilhado) // reexecução idempotente
const q = (sql,args=[])=>db.query(sql,args)
async function reset() {
  await db.exec('TRUNCATE app_unidades,atendimento_presencial_clientes,atendimento_presencial_atendimentos,sgi_importacoes_documentos_saida,sgi_documentos_saida,sgi_documentos_saida_contatos,sgi_documentos_saida_produtos,sgi_documentos_saida_pagamentos')
  await q('INSERT INTO app_unidades VALUES($1,\'bigorrilho\'),($2,\'portao\')',[unidade,outraUnidade])
  await q("INSERT INTO atendimento_presencial_clientes VALUES($1,'ANA','ativo',null,null,null),($2,'LARISSA','ativo',null,null,null)",[cliente,outro])
  await q("INSERT INTO atendimento_presencial_atendimentos VALUES($1,$2,$3,$4,30225,'2026-10-20 15:00-03','concluido','sim')",[atendimento,cliente,usuario,unidade])
  await q("INSERT INTO sgi_importacoes_documentos_saida VALUES($1,'concluido',0)",[importacao])
  await q("INSERT INTO sgi_documentos_saida VALUES($1,$2,'30225','30.225','14005','SEM CLIENTE','LEBEBE BIGORRILHO','2026-10-20 16:00-03',null,null,null,'CONSULTORA','Finalizado',49.80)",[documento,importacao])
  await q("INSERT INTO sgi_documentos_saida_produtos VALUES($1,$2,'PRODUTO',2,49.80,'ENXOVAL','A')",[id(10),documento])
  await q("INSERT INTO sgi_documentos_saida_pagamentos VALUES($1,$2,'PIX',49.80,1)",[id(11),documento])
}
async function resolver({atendimentoId=null,perfil='gestao',unidades=[unidade],user=usuario,variacoes=[]}={}) {
  return (await q('SELECT atendimento_presencial_resolver_vendas_sgi($1,$2,$3,$4,$5,$6) r',[cliente,user,perfil,unidades,variacoes,atendimentoId])).rows[0].r
}
let checks=0
async function teste(nome,fn) { await reset(); await fn(); checks++; console.log('OK',nome) }
const motivo = async esperado => { const r=await resolver(); assert.equal(r.vendas.length,0); assert.equal(r.diagnosticos[esperado],1) }
await teste('sem telefone: cadastro, detalhes e valores oficiais',async()=>{
  const r=await resolver(); assert.equal(r.vendas.length,1); assert.equal(r.vendas[0].documentoId,documento); assert.equal(r.vendas[0].origemAssociacao,'prancheta'); assert.equal(r.vendas[0].valorTotal,49.8); assert.equal(r.vendas[0].produtos[0].quantidade,2); assert.equal(r.vendas[0].pagamentos[0].valor,49.8)
  assert.deepEqual((await resolver({atendimentoId:atendimento})).vendas,r.vendas)
})
await teste('telefone válido é complementar',async()=>{await q("UPDATE atendimento_presencial_clientes SET telefone_informado='+55 (41) 91234-5678',telefone_normalizado='41912345678',telefone_normalizado_ddi='5541912345678' WHERE id=$1",[cliente]); assert.equal((await resolver()).vendas.length,1)})
await teste('telefone contraditório bloqueia',async()=>{await q("UPDATE atendimento_presencial_clientes SET telefone_normalizado='41912345678',telefone_informado='41987654321' WHERE id=$1",[cliente]); await motivo('identidade_contraditoria')})
await teste('telefone inválido não é corrigido',async()=>{await q("UPDATE atendimento_presencial_clientes SET telefone_informado='123' WHERE id=$1",[cliente]); await motivo('identidade_contraditoria')})
for(const dias of [-2,0,2,-3,3]) await teste(`janela calendário ${dias}`,async()=>{
  await q("UPDATE atendimento_presencial_atendimentos SET iniciado_em='2026-10-20 00:01-03'::timestamptz + $1::int * interval '1 day'",[dias])
  assert.equal((await resolver()).vendas.length,Math.abs(dias)<=2?1:0)
  if(Math.abs(dias)>2) await motivo('data_fora_janela')
})
await teste('virada UTC usa calendário de São Paulo',async()=>{await q("UPDATE atendimento_presencial_atendimentos SET iniciado_em='2026-10-23 02:59Z'"); assert.equal((await resolver()).vendas.length,1)})
await teste('sem data',async()=>{await q('UPDATE sgi_documentos_saida SET data_fechamento=null'); await motivo('dados_insuficientes')})
await teste('sem lançamento',async()=>{await q('UPDATE atendimento_presencial_atendimentos SET numero_lancamento=null'); await motivo('dados_insuficientes')})
await teste('filial diferente bloqueia mesmo data e lançamento',async()=>{await q("UPDATE sgi_documentos_saida SET filial='LEBEBE PORTÃO'"); await motivo('filial_incompativel')})
await teste('sem mapeamento filial',async()=>{await q("UPDATE app_unidades SET chave='pos_venda' WHERE id=$1",[unidade]); await motivo('filial_incompativel')})
await teste('documento inválido',async()=>{await q("UPDATE sgi_documentos_saida SET numero_documento=''"); await motivo('documento_invalido')})
await teste('identificador original inconsistente',async()=>{await q("UPDATE sgi_documentos_saida SET numero_lancamento_original='555'"); await motivo('documento_inconsistente')})
await teste('Prancheta antes da importação e venda histórica',async()=>{await q('DELETE FROM sgi_documentos_saida'); await motivo('aguardando_sgi'); await reset(); await q("UPDATE atendimento_presencial_atendimentos SET iniciado_em='2020-01-01 15:00-03'"); await q("UPDATE sgi_documentos_saida SET data_fechamento='2020-01-01 16:00-03'"); assert.equal((await resolver()).vendas.length,1)})
await teste('correção posterior da Prancheta',async()=>{await q('UPDATE atendimento_presencial_atendimentos SET numero_lancamento=1'); await motivo('aguardando_sgi'); await q('UPDATE atendimento_presencial_atendimentos SET numero_lancamento=30225'); assert.equal((await resolver()).vendas.length,1)})
for(const status of ['processando','erro']) await teste(`importação ${status}`,async()=>{await q('UPDATE sgi_importacoes_documentos_saida SET status=$1',[status]); await motivo('importacao_pendente'); await q("UPDATE sgi_importacoes_documentos_saida SET status='concluido'"); assert.equal((await resolver()).vendas.length,1)})
await teste('concluído com erros não libera',async()=>{await q('UPDATE sgi_importacoes_documentos_saida SET total_erros=1'); await motivo('importacao_pendente')})
await teste('dois clientes, concorrente de outro usuário invisível bloqueia',async()=>{await q('INSERT INTO atendimento_presencial_atendimentos SELECT $1,$2,$3,unidade_id,numero_lancamento,iniciado_em,status,resultado_atendimento FROM atendimento_presencial_atendimentos',[id(12),outro,outroUsuario]); const r=await resolver({perfil:'consultora'}); assert.equal(r.vendas.length,0); assert.equal(r.diagnosticos.identidade_ambigua,1); assert.equal(JSON.stringify(r).includes(outro),false)})
await teste('mesmo cliente em vários atendimentos deduplica',async()=>{await q('INSERT INTO atendimento_presencial_atendimentos SELECT $1,cliente_id,consultora_usuario_id,unidade_id,numero_lancamento,iniciado_em,status,resultado_atendimento FROM atendimento_presencial_atendimentos',[id(12)]); assert.equal((await resolver()).vendas.length,1)})
await teste('mesmo lançamento em outra filial não conflita com atendimento correto',async()=>{await q('INSERT INTO atendimento_presencial_atendimentos SELECT $1,$2,consultora_usuario_id,$3,numero_lancamento,iniciado_em,status,resultado_atendimento FROM atendimento_presencial_atendimentos',[id(12),outro,outraUnidade]); assert.equal((await resolver()).vendas.length,1)})
await teste('duplicidade observável de documentos bloqueia',async()=>{await q('INSERT INTO sgi_documentos_saida SELECT $1,importacao_id,numero_lancamento,numero_lancamento_original,numero_documento,cliente,filial,data_fechamento,telefone_principal,telefone_normalizado,contatos,vendedor,status,valor_total FROM sgi_documentos_saida',[id(13)]); assert.equal((await resolver()).vendas.length,0); assert.equal((await resolver()).diagnosticos.documento_ambiguo,1)})
await teste('cliente inativo',async()=>{await q("UPDATE atendimento_presencial_clientes SET status='inativo' WHERE id=$1",[cliente]); await motivo('dados_insuficientes')})
await teste('nome preenchido obrigatório',async()=>{await q("UPDATE atendimento_presencial_clientes SET nome='' WHERE id=$1",[cliente]); await motivo('dados_insuficientes')})
await teste('nome diferente em venda identificada não sobrescreve cadastro',async()=>{await q("UPDATE sgi_documentos_saida SET cliente='LARISSA'"); const r=await resolver({atendimentoId:atendimento}); assert.equal(r.vendas.length,0); assert.equal(r.diagnosticos.identidade_contraditoria,1); assert.equal((await q('SELECT nome FROM atendimento_presencial_clientes WHERE id=$1',[cliente])).rows[0].nome,'ANA')})
await teste('venda já identificada: telefone preservado e detalhe seguro',async()=>{await q("UPDATE atendimento_presencial_clientes SET telefone_normalizado='41912345678' WHERE id=$1",[cliente]); await q("UPDATE sgi_documentos_saida SET cliente='ANA'"); await q("INSERT INTO sgi_documentos_saida_contatos VALUES($1,$2,'41912345678','5541912345678')",[id(14),documento]); const variacoes=['41912345678','5541912345678']; assert.equal((await resolver({variacoes})).vendas[0].origemAssociacao,'telefone'); assert.equal((await resolver({atendimentoId:atendimento,variacoes})).vendas[0].origemAssociacao,'sgi')})
await teste('SEM CLIENTE com contatos não é complementado',async()=>{await q("UPDATE sgi_documentos_saida SET telefone_principal='41912345678'"); await motivo('identidade_contraditoria')})
await teste('telefone legado compartilhado não exige atendimento próprio nem venda fechada na Prancheta',async()=>{
  await q("UPDATE atendimento_presencial_atendimentos SET resultado_atendimento='negociacao',numero_lancamento=null")
  await q("UPDATE sgi_documentos_saida SET cliente='ANA'")
  await q("UPDATE atendimento_presencial_clientes SET telefone_normalizado='41912345678' WHERE id=$1",[cliente])
  await q("INSERT INTO sgi_documentos_saida_contatos VALUES($1,$2,'41912345678','5541912345678')",[id(14),documento])
  assert.equal((await resolver({perfil:'consultora',variacoes:['41912345678']})).vendas.length,1)
  assert.equal((await resolver({perfil:'consultora',unidades:[outraUnidade],variacoes:['41912345678']})).vendas.length,1)
  assert.equal((await resolver({perfil:'consultora',user:outroUsuario,variacoes:['41912345678']})).vendas.length,1)
  await q('DELETE FROM atendimento_presencial_atendimentos')
  assert.equal((await resolver({perfil:'consultora',user:outroUsuario,unidades:[],variacoes:['41912345678']})).vendas.length,1)
})
await teste('histórico compartilhado não libera detalhe de outra unidade ou consultora',async()=>{
  assert.equal((await resolver({unidades:[outraUnidade]})).vendas.length,1)
  assert.equal((await resolver({perfil:'consultora',user:outroUsuario})).vendas.length,1)
  assert.equal((await resolver({atendimentoId:atendimento,unidades:[outraUnidade]})).vendas.length,0)
  assert.equal((await resolver({atendimentoId:atendimento,perfil:'consultora',user:outroUsuario})).vendas.length,0)
  assert.equal((await resolver({perfil:'desconhecido'})).vendas.length,0)
})
await teste('Portão consulta Bigorrilho sem telefone ou metadados restritos',async()=>{
  const r=await resolver({perfil:'consultora',user:outroUsuario,unidades:[outraUnidade]})
  assert.equal(r.vendas[0].filial,'LEBEBE BIGORRILHO')
  assert.deepEqual(r.diagnosticos,{})
  for(const restrito of [atendimento,usuario,unidade,'consultora_usuario_id','iniciado_em','observacoes']) assert.equal(JSON.stringify(r).includes(restrito),false)
})
await teste('Bigorrilho consulta Portão e reúne compras das duas filiais',async()=>{
  await q('INSERT INTO atendimento_presencial_atendimentos SELECT $1,cliente_id,$2,$3,30226,iniciado_em,status,resultado_atendimento FROM atendimento_presencial_atendimentos',[id(12),outroUsuario,outraUnidade])
  await q("INSERT INTO sgi_documentos_saida SELECT $1,importacao_id,'30226','30226','14006',cliente,'LEBEBE PORTÃO',data_fechamento,telefone_principal,telefone_normalizado,contatos,vendedor,status,valor_total FROM sgi_documentos_saida",[id(13)])
  const r=await resolver({perfil:'consultora'})
  assert.equal(r.vendas.length,2)
  assert.deepEqual(new Set(r.vendas.map(v=>v.filial)),new Set(['LEBEBE BIGORRILHO','LEBEBE PORTÃO']))
  assert.deepEqual(r.diagnosticos,{associado:1})
})
await teste('ambiguidade global de origem oculta bloqueia sem diagnóstico restrito',async()=>{
  await q('INSERT INTO atendimento_presencial_atendimentos SELECT $1,$2,consultora_usuario_id,unidade_id,numero_lancamento,iniciado_em,status,resultado_atendimento FROM atendimento_presencial_atendimentos',[id(12),outro])
  const r=await resolver({perfil:'consultora',user:outroUsuario,unidades:[outraUnidade]})
  assert.deepEqual(r,{vendas:[],diagnosticos:{}})
})
await teste('superadmin autorizado e atendimento exato',async()=>{assert.equal((await resolver({perfil:'superadmin',unidades:[]})).vendas.length,1); assert.equal((await resolver({atendimentoId:id(55)})).vendas.length,0)})
await teste('deduplicação telefone e Prancheta, limite após união',async()=>{
  await q("UPDATE atendimento_presencial_clientes SET telefone_normalizado='41912345678' WHERE id=$1",[cliente])
  // Simula contato legado sobre o documento: caminho telefone prevalece, uma venda.
  await q("INSERT INTO sgi_documentos_saida_contatos VALUES($1,$2,'41912345678',null)",[id(14),documento]); assert.equal((await resolver({variacoes:['41912345678']})).vendas.length,1)
  await q('DELETE FROM sgi_documentos_saida_contatos')
  for(let n=0;n<12;n++) {
    await q("INSERT INTO sgi_documentos_saida SELECT $1,importacao_id,($2::int)::text,($2::int)::text,numero_documento,cliente,filial,data_fechamento + $3::int*interval '1 minute',telefone_principal,telefone_normalizado,contatos,vendedor,status,valor_total FROM sgi_documentos_saida WHERE id=$4",[id(100+n),40000+n,n,documento])
    await q('INSERT INTO atendimento_presencial_atendimentos SELECT $1,cliente_id,consultora_usuario_id,unidade_id,$2,iniciado_em,status,resultado_atendimento FROM atendimento_presencial_atendimentos WHERE id=$3',[id(200+n),40000+n,atendimento])
  }
  const r=await resolver(); assert.equal(r.vendas.length,10); assert.equal(r.vendas[0].numeroLancamento,'40011'); assert.equal(new Set(r.vendas.map(v=>v.documentoId)).size,10)
})
await teste('telefone alterado após leitura da API não usa variantes antigas',async()=>{
  await q("UPDATE atendimento_presencial_clientes SET telefone_normalizado='41987654321' WHERE id=$1",[cliente])
  await q("UPDATE sgi_documentos_saida SET cliente='ANA'")
  await q("INSERT INTO sgi_documentos_saida_contatos VALUES($1,$2,'41912345678','5541912345678')",[id(14),documento])
  const variacoes=['41912345678','5541912345678']
  assert.equal((await resolver({variacoes})).vendas.length,0)
  assert.equal((await resolver({atendimentoId:atendimento,variacoes})).diagnosticos.identidade_contraditoria,1)
})
await teste('reexecuções não escrevem; reimportação aguarda e recupera',async()=>{
  const antes=(await q("SELECT jsonb_agg(t) x FROM (SELECT * FROM sgi_documentos_saida) t")).rows
  const r=await resolver(); assert.deepEqual(await resolver(),r); assert.deepEqual((await q("SELECT jsonb_agg(t) x FROM (SELECT * FROM sgi_documentos_saida) t")).rows,antes)
  await q("UPDATE sgi_importacoes_documentos_saida SET status='processando'"); await q('DELETE FROM sgi_documentos_saida_produtos'); await motivo('importacao_pendente'); await q("INSERT INTO sgi_documentos_saida_produtos VALUES($1,$2,'PRODUTO NOVO',1,49.80,'ENXOVAL','A')",[id(10),documento]); await q("UPDATE sgi_importacoes_documentos_saida SET status='concluido'"); assert.equal((await resolver()).vendas[0].produtos[0].nome,'PRODUTO NOVO')
})
await teste('ACL backend apenas, INVOKER, STABLE e SELECT sob service_role',async()=>{
  const acl=(await q("SELECT has_function_privilege('anon',oid,'execute') anon,has_function_privilege('authenticated',oid,'execute') authenticated,has_function_privilege('service_role',oid,'execute') service,prosecdef,provolatile FROM pg_proc WHERE proname='atendimento_presencial_resolver_vendas_sgi'")).rows[0]
  assert.deepEqual(acl,{anon:false,authenticated:false,service:true,prosecdef:false,provolatile:'s'})
  await db.exec('SET ROLE authenticated'); await assert.rejects(resolver(),/permission denied/); await db.exec('RESET ROLE')
  await db.exec('SET ROLE service_role'); assert.equal((await resolver()).vendas.length,1); await db.exec('RESET ROLE')
})
await teste('histórico entre filiais preserva integralmente cadastros e dados comerciais',async()=>{
  const tabelas=['atendimento_presencial_clientes','atendimento_presencial_atendimentos','sgi_documentos_saida','sgi_documentos_saida_produtos','sgi_documentos_saida_pagamentos','sgi_documentos_saida_contatos']
  const snapshots=async()=>Promise.all(tabelas.map(t=>q(`SELECT jsonb_agg(t ORDER BY id) dados FROM ${t} t`).then(r=>r.rows)))
  const antes=await snapshots()
  await resolver({perfil:'consultora',user:outroUsuario,unidades:[outraUnidade]})
  await resolver({perfil:'consultora',user:outroUsuario,unidades:[outraUnidade],atendimentoId:atendimento})
  assert.deepEqual(await snapshots(),antes)
})
console.log(JSON.stringify({cenarios:checks,resultado:'aprovado',ambiente:'PostgreSQL isolado, dados sintéticos'}))
await db.close()
