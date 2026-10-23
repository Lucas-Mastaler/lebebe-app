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

await db.exec(readFileSync('supabase/migrations/20261023152859_recebimento_email_anexos.sql','utf8'))
const hash='a'.repeat(64)
const origem=n=>n.toString(16).padStart(64,'0')
function nota(numero=371272) {
 const base='3526100000000000000055001'+String(numero).padStart(9,'0')+'100000001'
 let soma=0;for(let i=42,p=2;i>=0;i--,p=p===9?2:p+1)soma+=Number(base[i])*p
 const dv=11-soma%11;const chave=base+(dv>=10?0:dv)
 return {numero_nf:String(numero),chave_acesso:chave,data_emissao:'2026-10-23',peso_total:10.5,volumes_total:5,obs:'TESTE',is_os:false,itens:[{n_item:1,codigo_produto:'000123',descricao:'TESTE',quantidade:2},{n_item:2,codigo_produto:'456',descricao:'TESTE 2',quantidade:3}],assistencias:['1234']}
}
const login=()=>db.exec("set role authenticated; set request.jwt.claim.sub='10000000-0000-4000-8000-000000000001'; set request.jwt.claim.email='lucas@lebebe.com.br';")
const importar=async(n=nota(),o=origem(1),h=hash)=>(await db.query('select importar_anexo_email_recebimento($1,$2::jsonb,$3) resultado',[o,JSON.stringify(n),h])).rows[0].resultado
const scalar=async(sql)=>(await db.query(sql)).rows[0].n
let checks=0
await login()
const novo=await importar();assert.equal(novo.banco,'cadastrada');checks++
assert.equal(await scalar('select count(*)::int n from nfe'),1);checks++
assert.equal(await scalar('select count(*)::int n from nfe_itens'),2);checks++
assert.equal(await scalar('select count(*)::int n from nfe_email_anexos'),1);checks++
const ids=JSON.stringify((await db.query('select id from nfe_itens order by n_item')).rows)
assert.equal((await importar()).banco,'existente');checks++
assert.equal(JSON.stringify((await db.query('select id from nfe_itens order by n_item')).rows),ids);checks++
assert.equal((await importar(nota(),origem(2),'b'.repeat(64))).banco,'existente');checks++
assert.equal(await scalar('select count(*)::int n from nfe'),1);checks++
assert.equal(await scalar('select count(*)::int n from nfe_email_anexos'),2);checks++
assert.equal(JSON.stringify((await db.query('select id from nfe_itens order by n_item')).rows),ids);checks++
// Mesma chave já vinculada manualmente: não muda o conteúdo fiscal nem IDs.
await db.query('select importar_xml_recebimento($1::jsonb,$2)',[JSON.stringify(nota(371273)),hash])
assert.equal((await importar(nota(371273),origem(3))).banco,'existente');checks++
// Falha no segundo item deve desfazer nota, primeiro item e comprovante.
const quebrada=nota(371274);quebrada.itens[1].quantidade=2147483648
await assert.rejects(importar(quebrada,origem(4)));checks++
assert.equal(await scalar("select count(*)::int n from nfe where numero_nf='371274'"),0);checks++
assert.equal(await scalar(`select count(*)::int n from nfe_email_anexos where origem_sha256='${origem(4)}'`),0);checks++
await assert.rejects(importar(nota(371275),origem(1)),/XML_CONFLITO/);checks++
assert.equal(await scalar("select count(*)::int n from nfe where numero_nf='371275'"),0);checks++
// Simula um registro legado com zeros, sem chave, e SKU/status aprendidos.
const legado=nota(371276)
const leg=(await db.query('select importar_xml_recebimento($1::jsonb,$2) r',[JSON.stringify(legado),hash])).rows[0].r
await db.query("update nfe set numero_nf='000371276',xml_chave_acesso=null,xml_sha256=null where id=$1",[leg.nfe_id])
await db.query("update nfe_itens set status='conferido',volumes_por_item=99 where nfe_id=$1",[leg.nfe_id])
const legAntes=JSON.stringify((await db.query('select * from nfe_itens where nfe_id=$1 order by n_item',[leg.nfe_id])).rows)
const adotada=await importar(legado,origem(6));assert.equal(adotada.nfe_id,leg.nfe_id);checks++
assert.equal(adotada.numero_nf,'000371276');checks++
assert.equal(JSON.stringify((await db.query('select * from nfe_itens where nfe_id=$1 order by n_item',[leg.nfe_id])).rows),legAntes);checks++
// Divergência no legado não ganha comprovante e não adota chave.
await db.query('update nfe set xml_chave_acesso=null,xml_sha256=null where id=$1',[leg.nfe_id])
const divergente=nota(371276);divergente.itens[0].descricao='OUTRO'
await assert.rejects(importar(divergente,origem(7)),/XML_CONFLITO_DADOS/);checks++
assert.equal(await scalar(`select count(*)::int n from nfe_email_anexos where origem_sha256='${origem(7)}'`),0);checks++
// Permissões da tabela e RPC não ampliam acesso para outros perfis.
await db.exec("set request.jwt.claim.email='sem-acesso@exemplo.invalid'")
assert.equal(await scalar('select count(*)::int n from nfe_email_anexos'),0);checks++
await assert.rejects(importar(nota(371277),origem(8)),/Acesso negado/);checks++
await assert.rejects(db.query('insert into nfe_email_anexos(origem_sha256,nfe_id) values($1,$2)',[origem(9),novo.nfe_id]),/row-level security/);checks++
await db.exec('reset role; set role anon')
await assert.rejects(db.query('select * from nfe_email_anexos'),/permission denied/);checks++
await assert.rejects(importar(),/permission denied/);checks++
await db.exec('reset role')
assert.equal((await db.query("select prosecdef from pg_proc where proname='importar_anexo_email_recebimento'")).rows[0].prosecdef,false);checks++
console.log(`PostgreSQL isolado: ${checks} verificações do e-mail aprovadas. Atomicidade, repetição, chave fiscal, legado e RLS.`)
await db.close()
