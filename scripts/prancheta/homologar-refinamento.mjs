// Componente real -> HTTP de fixture -> PostgreSQL/WASM real, efêmero.
// Adaptador substitui autenticação/API externas somente neste processo de teste.
import {randomUUID} from 'node:crypto'
import {criarBancoP1} from './banco-sintetico-p1.mjs'
const runtime=process.argv[2] ?? 'C:/Users/lebeb/AppData/Local/Temp/prancheta-entrega2-sql-runtime/node_modules/@electric-sql/pglite/dist/index.js'
export const db=await criarBancoP1(runtime)
await db.exec(`ALTER TABLE atendimento_presencial_clientes ADD COLUMN telefone_informado text, ADD COLUMN telefone_normalizado text, ADD COLUMN telefone_normalizado_ddi text;
ALTER TABLE atendimento_presencial_motivos ADD CONSTRAINT atendimento_presencial_motivos_motivo_check CHECK (motivo IN ('preco','outro','virada_cartao','prazo_entrega','conversar_outra_pessoa','aguardar_nascimento'));
ALTER TABLE atendimento_presencial_motivos ADD CONSTRAINT atendimento_presencial_motivos_complemento_check CHECK ((motivo='outro' AND complemento IS NOT NULL) OR (motivo<>'outro' AND complemento IS NULL));`)
await db.exec((await import('node:fs')).readFileSync('supabase/migrations/20261016215502_prancheta_refinamento_funcional.sql','utf8'))
const usuario='00000000-0000-4000-8000-000000000001',unidade='00000000-0000-4000-8000-000000000002',cliente='00000000-0000-4000-8000-000000000003'
await db.exec(`INSERT INTO usuarios_permitidos VALUES('${usuario}','superadmin',true);INSERT INTO app_unidades VALUES('${unidade}',true);INSERT INTO atendimento_presencial_clientes (id,status,parentesco) VALUES('${cliente}','ativo','mae');CREATE UNIQUE INDEX fixture_draft_client_id ON atendimento_presencial_atendimentos(draft_client_id);
CREATE OR REPLACE FUNCTION atendimento_presencial_fluxo_v2_habilitado() RETURNS boolean LANGUAGE sql AS $$ SELECT true $$;
CREATE OR REPLACE FUNCTION atendimento_presencial_criancas_habilitado() RETURNS boolean LANGUAGE sql AS $$ SELECT true $$;`)
for(const idade of [1,2]) {
 const atendimentoId=randomUUID()
 await db.query("insert into atendimento_presencial_atendimentos(id,cliente_id,consultora_usuario_id,unidade_id,status,resultado_atendimento,numero_lancamento,concluido_em,dados_rascunho) values($1,$2,$3,$4,'concluido','sim',22,now(),'{}')",[atendimentoId,cliente,usuario,unidade])
 await db.query("insert into atendimento_presencial_criancas(id,atendimento_id,local_id,ordem,situacao,nome,idade_unidade,idade_valor) values($1,$2,$3,1,'ja_nasceu','MARIA SINTETICA','anos',$4)",[randomUUID(),atendimentoId,'maria-'+idade,idade])
}
export const requests=[]
let telefoneFixture=null, versaoCliente=1, falhaConclusao=false
function dto(row){return {id:row.id,clienteId:row.cliente_id,consultoraUsuarioId:row.consultora_usuario_id,unidadeId:row.unidade_id,status:row.status,draftClientId:row.draft_client_id,dadosRascunho:row.dados_rascunho,version:row.version,iniciadoEm:row.iniciado_em,ultimaAtividadeEm:row.ultima_atividade_em,expiraEm:row.expira_em,resultadoAtendimento:row.resultado_atendimento,concluidoEm:row.concluido_em,numeroLancamento:row.numero_lancamento,expirado:false}}
globalThis.__pranchetaIntegracaoIsolada=async(req,res,next)=>{
 const url=new URL(req.url,'http://127.0.0.1:3207')
 const draftRoute=url.pathname.match(/\/atendimentos\/([^/]+)\/(rascunho|concluir)$/)
 const criancas=url.pathname.match(/\/clientes\/([^/]+)\/criancas$/)
 const criar=url.pathname==='/api/atendimento-presencial/atendimentos/rascunhos' && req.method==='POST'
 if(url.pathname==='/') {
   if(url.searchParams.get('falha')==='503')falhaConclusao=true
   res.setHeader('Content-Type','text/html; charset=utf-8')
   res.end('<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/src/app/globals.css"><title>Prancheta sintética local</title></head><body><div id="root" class="p-4 sm:p-6"></div><script type="module" src="/scripts/prancheta/refinamento-entry.jsx"></script></body></html>')
   return
 }
 if(url.pathname==='/api/atendimento-presencial/clientes' || url.pathname==='/api/atendimento-presencial/clientes/'+cliente) {
   if(req.method==='PATCH') {
     const chunks=[];for await(const c of req)chunks.push(c)
     const entrada=JSON.parse(Buffer.concat(chunks).toString());telefoneFixture=entrada.telefone||null;versaoCliente++
     await db.query('update atendimento_presencial_clientes set telefone_informado=$1 where id=$2',[telefoneFixture,cliente])
   }
   res.setHeader('Content-Type','application/json'); const c={id:cliente,nome:'CLIENTE SINTETICA',telefone:telefoneFixture,telefoneFormatado:telefoneFixture,parentesco:'mae',parentescoLabel:'Mãe',status:'ativo',version:versaoCliente};res.end(JSON.stringify(url.pathname.endsWith(cliente)?{ok:true,cliente:c}:{ok:true,clientes:[c]}));return
 }
 if(url.pathname==='/refinamento-evidencias') {
   const rows=(await db.query('select id,status,version,telefone_recusa_confirmada,tipo_atendimento,resultado_atendimento,dados_rascunho from atendimento_presencial_atendimentos order by created_at')).rows
   res.setHeader('Content-Type','application/json');res.end(JSON.stringify({requests,rows}));return
 }
 if(!url.pathname.startsWith('/api/atendimento-presencial/'))return next()
 if(!draftRoute&&!criar&&!criancas)return next()
 const json=(status,body)=>{res.statusCode=status;res.setHeader('Content-Type','application/json');res.end(JSON.stringify(body))}
 let body={};if(req.method!=='GET'){try{const chunks=[];for await(const c of req)chunks.push(c);body=JSON.parse(Buffer.concat(chunks).toString())}catch{return json(400,{ok:false})}}
 requests.push({method:req.method,path:url.pathname})
 try{
  if(criar){
   const existing=(await db.query('select * from atendimento_presencial_atendimentos where draft_client_id=$1',[body.draftClientId])).rows[0]
   if(existing)return json(200,{ok:true,rascunho:dto(existing)})
   const row=(await db.query('insert into atendimento_presencial_atendimentos(id,draft_client_id,cliente_id,consultora_usuario_id,unidade_id,dados_rascunho,criado_por,atualizado_por,iniciado_em) values($1,$2,$3,$4,$5,$6,$4,$4,\'2026-10-15T12:00:00Z\') returning *',[randomUUID(),body.draftClientId,body.clienteId,usuario,body.unidadeId,body.dadosRascunho])).rows[0]
   return json(200,{ok:true,rascunho:dto(row)})
  }
  if(criancas){
   const args=[body.rascunhoId??url.searchParams.get('rascunhoId'),criancas[1],usuario]
   let confirmadoId
   if(req.method==='POST')confirmadoId=(await db.query('select atendimento_presencial_confirmar_crianca($1,$2,$3,$4,$5,$6,$7) id',[...args,body.origemId,body.parentesco,body.dados,body.associarId??null])).rows[0].id
   const data=(await db.query('select atendimento_presencial_listar_criancas($1,$2,$3) dados',args)).rows[0].dados
   return json(200,{ok:true,...data,confirmadoId})
  }
  const id=draftRoute[1];let row=(await db.query('select * from atendimento_presencial_atendimentos where id=$1',[id])).rows[0]
  if(!row)return json(404,{ok:false,message:'Rascunho sintético não encontrado'})
  if(req.method==='GET')return json(200,{ok:true,rascunho:dto(row)})
  if(draftRoute[2]==='rascunho'){
   if(row.status!=='rascunho'||row.version!==body.version)return json(409,{ok:false,message:'Conflito de versão',rascunho:dto(row)})
   row=(await db.query('update atendimento_presencial_atendimentos set dados_rascunho=$1,cliente_id=$2,atualizado_por=$3 where id=$4 AND version=$5 AND status=\'rascunho\' returning *',[body.dadosRascunho,body.clienteId,usuario,id,body.version])).rows[0]
   if(!row){const atual=(await db.query('select * from atendimento_presencial_atendimentos where id=$1',[id])).rows[0];return json(409,{ok:false,message:'Conflito de versão',rascunho:dto(atual)})}
   return json(200,{ok:true,rascunho:dto(row)})
  }
  if(falhaConclusao){falhaConclusao=false;return json(503,{ok:false,message:'Falha sintética de API; dados preservados'})}
  await db.query('select * from atendimento_presencial_concluir($1,$2,$3,$4,$5,$6)',[id,body.version,usuario,body.numeroLancamento,body.consultoraNome,body.confirmacaoTelefone??null])
  row=(await db.query('select * from atendimento_presencial_atendimentos where id=$1',[id])).rows[0]
  return json(200,{ok:true,atendimento:dto(row)})
 }catch(error){return json(error.code==='42501'?403:422,{ok:false,message:error.message})}
}
process.env.PRANCHETA_HARNESS_PORT=process.env.PRANCHETA_REFINAMENTO_PORT ?? '3219'
export const {server}=await import('./homologar-entrega4.mjs')
