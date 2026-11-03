import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import assert from 'node:assert/strict'
process.on('uncaughtException', error => { console.error(error.message, error.code); process.exit(1) })
const { PGlite } = await import(pathToFileURL(process.argv[2]).href)
const db = new PGlite()
await db.exec(`
CREATE TABLE atendimento_presencial_atendimentos(id uuid,status text,expira_em timestamptz,consultora_usuario_id uuid,cliente_id uuid,unidade_id uuid);
CREATE TABLE usuarios_permitidos(id uuid,role text,ativo boolean);
CREATE TABLE atendimento_presencial_clientes(id uuid,status text);
CREATE TABLE app_unidades(id uuid,ativo boolean);
CREATE TABLE app_usuarios_unidades(usuario_id uuid,unidade_id uuid);
CREATE TABLE app_modulos(id uuid,chave text,ativo boolean,publico boolean,somente_superadmin boolean);
CREATE TABLE app_permissoes_usuario(modulo_id uuid,usuario_id uuid,permitido boolean);
CREATE TABLE app_usuarios_perfis(usuario_id uuid,perfil_id uuid);
CREATE TABLE app_perfis_acesso(id uuid,chave text,ativo boolean);
CREATE TABLE app_permissoes_perfil(modulo_id uuid,perfil_id uuid,permitido boolean);
`)
const ids=Array.from({length:8},(_,i)=>'10000000-0000-4000-8000-'+String(i+1).padStart(12,'0'))
const [draft,client,unit,owner,executor,profile,module,other]=ids
await db.query("insert into atendimento_presencial_atendimentos values($1,'rascunho',now()+interval '1 day',$2,$3,$4)",[draft,owner,client,unit])
await db.query("insert into usuarios_permitidos values($1,'superadmin',true)",[executor])
await db.query("insert into atendimento_presencial_clientes values($1,'ativo')",[client])
await db.query("insert into app_unidades values($1,true)",[unit])
await db.exec(readFileSync('scripts/prancheta/sql/restaurar-contexto-rascunho-20261103.sql','utf8'))
await db.exec(readFileSync('supabase/migrations/20261103202757_prancheta_rascunho_contexto_autorizacao.sql','utf8'))
let checks=0
async function allowed(){await db.query('select atendimento_presencial_criancas_contexto($1,$2,$3)',[draft,client,executor]);checks++}
async function denied(c=client){await assert.rejects(db.query('select atendimento_presencial_criancas_contexto($1,$2,$3)',[draft,c,executor]),e=>e.code==='42501');checks++}
await allowed()
await denied(other)
await db.query("update usuarios_permitidos set role='user'")
await denied()
await db.query("insert into app_perfis_acesso values($1,'gestao',true)",[profile])
await db.query("insert into app_usuarios_perfis values($1,$2)",[executor,profile])
await db.query("insert into app_usuarios_unidades values($1,$2)",[executor,unit])
await db.query("insert into app_modulos values($1,'atendimento_presencial_ficha',true,false,false)",[module])
await db.query("insert into app_permissoes_perfil values($1,$2,true)",[module,profile])
await allowed()
await db.exec("update app_perfis_acesso set chave='supervisora_loja'")
await allowed()
await db.exec("update app_perfis_acesso set chave='consultora'")
await denied()
await db.query("update atendimento_presencial_atendimentos set consultora_usuario_id=$1",[executor])
await allowed()
await db.query("insert into app_permissoes_usuario values($1,$2,false)",[module,executor])
await denied()
await db.exec("delete from app_permissoes_usuario;delete from app_usuarios_unidades")
await denied()
await db.exec("update usuarios_permitidos set role='superadmin';update atendimento_presencial_atendimentos set expira_em=now()-interval '1 day'")
await denied()
await db.exec("update atendimento_presencial_atendimentos set expira_em=now()+interval '1 day', status='concluido'")
await denied()
await db.exec("update atendimento_presencial_atendimentos set status='rascunho';update app_unidades set ativo=false")
await denied()
await db.exec("update app_unidades set ativo=true;update usuarios_permitidos set ativo=false")
await denied()
await db.exec(readFileSync('scripts/prancheta/sql/restaurar-contexto-rascunho-20261103.sql','utf8'))
checks++
console.log(JSON.stringify({checks,resultado:'aprovado',recuperacao:'funcao anterior restaurada em banco isolado'}))
await db.close()
