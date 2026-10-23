// Banco PostgreSQL descartável. Nenhum acesso a Supabase ou documentos reais.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
const { PGlite } = await import(pathToFileURL(process.argv[2]).href)
const db = new PGlite()
await db.exec(`
create role authenticated; create role anon;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
create function public.is_matic_user() returns boolean language sql stable as $$ select coalesce(current_setting('request.jwt.claim.email',true),'') in ('lucas@lebebe.com.br','posvenda@lebebe.com.br') $$;
create table nfe(id uuid primary key default gen_random_uuid(),numero_nf text not null unique,data_emissao date not null,peso_total numeric,volumes_total integer,obs text,is_os boolean not null default false,created_at timestamptz not null default now());
create table nfe_itens(id uuid primary key default gen_random_uuid(),nfe_id uuid not null references nfe(id),n_item integer not null,codigo_produto text not null,descricao text not null default '',quantidade integer not null,volumes_por_item integer not null default 1,volumes_previstos_total integer not null,status text not null default 'pendente',unique(nfe_id,n_item));
create table nfe_assistencias(id uuid primary key default gen_random_uuid(),nfe_id uuid not null references nfe(id),os_oc_numero text not null,unique(nfe_id,os_oc_numero));
create table matic_sku(codigo_produto text primary key,volumes_por_item integer not null default 1,ref_meia text,ref_inteira text);
create table recebimento_nfes(recebimento_id uuid,nfe_id uuid references nfe(id),primary key(recebimento_id,nfe_id));
grant usage on schema public,auth to authenticated,anon;
grant select,insert,update on nfe,nfe_itens,nfe_assistencias to authenticated;
grant select on matic_sku to authenticated;
alter table nfe enable row level security; alter table nfe_itens enable row level security; alter table nfe_assistencias enable row level security;
create policy nfe_select on nfe for select using(is_matic_user()); create policy nfe_insert on nfe for insert with check(is_matic_user()); create policy nfe_update on nfe for update using(is_matic_user());
create policy item_select on nfe_itens for select using(is_matic_user()); create policy item_insert on nfe_itens for insert with check(is_matic_user()); create policy item_update on nfe_itens for update using(is_matic_user());
create policy os_select on nfe_assistencias for select using(is_matic_user()); create policy os_insert on nfe_assistencias for insert with check(is_matic_user());
insert into matic_sku values('000123',3,null,null),('sku-interno',4,'00456',null);
`)
await db.exec(readFileSync('supabase/migrations/20261023125155_recebimento_upload_xml_seguro.sql','utf8'))
const nota = {numero_nf:'371272',chave_acesso:'35261000000000000000550010003712721000000010',data_emissao:'2026-10-23',peso_total:10.5,volumes_total:5,obs:'TESTE',is_os:false,itens:[{n_item:1,codigo_produto:'000123',descricao:'TESTE',quantidade:2},{n_item:2,codigo_produto:'456',descricao:'TESTE 2',quantidade:3}],assistencias:['1234','1234','4321']}
const hash='a'.repeat(64)
const login=()=>db.exec(`set role authenticated; set request.jwt.claim.sub='10000000-0000-4000-8000-000000000001'; set request.jwt.claim.email='lucas@lebebe.com.br';`)
const importar=async(n=nota,h=hash)=>(await db.query('select importar_xml_recebimento($1::jsonb,$2) as resultado',[JSON.stringify(n),h])).rows[0].resultado
let checks=0
await login()
const first=await importar();assert.equal(first.banco,'cadastrada');checks++
const itens=(await db.query('select * from nfe_itens order by n_item')).rows
assert.deepEqual(itens.map(i=>[i.n_item,i.codigo_produto,i.quantidade,i.volumes_por_item,i.volumes_previstos_total]),[[1,'000123',2,3,6],[2,'456',3,4,12]]);checks++
assert.equal((await db.query('select count(*)::int n from nfe_assistencias')).rows[0].n,2);checks++
await db.query("update nfe_itens set status='concluido' where n_item=1")
await db.exec('reset role')
await db.query('insert into recebimento_nfes values(gen_random_uuid(),$1)',[first.nfe_id])
await login()
const retry=await importar();assert.equal(retry.banco,'existente');assert.equal(retry.nfe_id,first.nfe_id);checks++
assert.deepEqual((await db.query('select id from nfe_itens order by n_item')).rows.map(i=>i.id),itens.map(i=>i.id));assert.equal((await db.query('select status from nfe_itens where n_item=1')).rows[0].status,'concluido');checks++
await assert.rejects(importar({...nota,chave_acesso:nota.chave_acesso.replace('001000','002000')}),/XML_CONFLITO_IDENTIDADE/);checks++
await assert.rejects(importar(nota,'b'.repeat(64)),/XML_CONFLITO_IDENTIDADE/);checks++
await assert.rejects(importar({...nota,itens:nota.itens.map(i=>({...i,quantidade:7}))}),/XML_CONFLITO_DADOS/);checks++
await db.exec('reset role')
assert.equal((await db.query('select count(*)::int n from recebimento_nfes')).rows[0].n,1);checks++
// Adoção conservadora de nota antiga, sem trocar os IDs dos produtos.
await db.query('update nfe set xml_sha256=null,xml_chave_acesso=null,xml_drive_status=null')
await login();assert.equal((await importar()).banco,'existente');checks++
assert.deepEqual((await db.query('select id from nfe_itens order by n_item')).rows.map(i=>i.id),itens.map(i=>i.id));checks++
// Estouro no segundo item: prova rollback depois de inserir nota e primeiro item.
const nova={...nota,numero_nf:'371273',chave_acesso:nota.chave_acesso.replace('000371272','000371273'),itens:[nota.itens[0],{...nota.itens[1],quantidade:2147483647}]}
await assert.rejects(importar(nova),/out of range/)
assert.equal((await db.query("select count(*)::int n from nfe where numero_nf='371273'")).rows[0].n,0);checks++
await assert.rejects(importar({...nova,itens:[]}),/XML_ITENS_INVALIDOS/);checks++
await assert.rejects(importar({...nova,itens:[nota.itens[0],nota.itens[0]]}),/XML_ITEM_REPETIDO/);checks++
await db.exec("set request.jwt.claim.email='sem-acesso@exemplo.invalid'")
await assert.rejects(importar(),/Acesso negado/);checks++
await db.exec("set request.jwt.claim.email='lucas@lebebe.com.br'; set request.jwt.claim.sub=''")
await assert.rejects(importar(),/Acesso negado/);checks++
await db.exec('reset role; set role anon')
await assert.rejects(importar(),/permission denied/);checks++
await db.exec('reset role')
assert.equal((await db.query("select prosecdef from pg_proc where proname='importar_xml_recebimento'")).rows[0].prosecdef,false);checks++
console.log(`PostgreSQL isolado: ${checks} verificações aprovadas. Transação, repetição, legado, volumes e permissões.`)
await db.close()
