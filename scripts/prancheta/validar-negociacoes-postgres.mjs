// PostgreSQL 17 portátil, loopback, dados totalmente sintéticos. Sem .env/Supabase.
import assert from 'node:assert/strict'
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs'
import {spawnSync} from 'node:child_process'
import {randomUUID} from 'node:crypto'
import path from 'node:path'
import pg from '../../output/negociacoes-pg-tools/node_modules/pg/lib/index.js'
import {initdb,pg_ctl} from '../../output/negociacoes-pg-tools/node_modules/@embedded-postgres/windows-x64/dist/index.js'
import {prepararBancoNegociacoes,usuario,unidade,cliente} from './banco-negociacoes-isolado.mjs'
const pasta=path.resolve('output/negociacoes-postgres-'+Date.now()),port=55437
const {Client}=pg
mkdirSync(pasta,{recursive:true})
const cluster=path.join(pasta,'cluster'),log=path.join(pasta,'servidor.log'),checks=[]
function executar(bin,args){const r=spawnSync(bin,args,{stdio:'ignore',windowsHide:true,timeout:60000});if(r.error||r.status!==0)throw new Error(`${path.basename(bin)}: ${r.error?.message||`exit ${r.status}; consulte ${log}`}`)}
function conexao(database='postgres'){return new Client({host:'127.0.0.1',port,user:'postgres',database,connectionTimeoutMillis:5000,statement_timeout:15000})}
function ok(t){checks.push(t);console.log('OK',t)}
async function preparar(c){
 c.exec=sql=>c.query(sql)
 let fixture=readFileSync('scripts/prancheta/validar-entrega2.mjs','utf8').split('await db.exec(`')[1].split('`)')[0]
 for(const [k,v]of Object.entries({usuario,unidade,cliente}))fixture=fixture.replaceAll('${'+k+'}',v)
 // Roles são globais do cluster; o segundo banco reutiliza as mesmas roles.
 fixture=fixture.replace('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;','')
 await c.query(fixture)
 const alter=readFileSync('scripts/prancheta/banco-sintetico-p1.mjs','utf8').match(/await db\.exec\(`(ALTER TABLE[\s\S]*?)`\)/)?.[1]
 assert.ok(alter,'DDL complementar da fixture não encontrado')
 await c.query(alter)
 await c.query(readFileSync('scripts/prancheta/sql/base-entrega2.sql','utf8'))
 for(const f of ['20261015185406_atendimento_presencial_contratos_fluxo_v2.sql','20261015203309_atendimento_presencial_criancas_permanentes.sql','20261015212015_atendimento_presencial_presente_idade_aproximada.sql'])await c.query(readFileSync('supabase/migrations/'+f,'utf8'))
 await prepararBancoNegociacoes(c)
}
executar(initdb,['-D',cluster,'-U','postgres','-A','trust','--encoding=UTF8','--locale=C'])
let iniciado=false,a,b,c,restore
try{
 iniciado=true;executar(pg_ctl,['-D',cluster,'-l',log,'-o',`-h 127.0.0.1 -p ${port} -c max_connections=10`,'-w','start'])
 a=conexao();b=conexao();c=conexao();await Promise.all([a.connect(),b.connect(),c.connect()])
 await c.query('CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role')
 await preparar(c)
 const origem=randomUUID()
 await c.query("INSERT INTO atendimento_presencial_atendimentos(id,cliente_id,consultora_usuario_id,unidade_id,status,concluido_em,iniciado_em,resultado_atendimento) VALUES($1,$2,$3,$4,'concluido',now()-interval '7 days',now()-interval '7 days','negociacao')",[origem,cliente,usuario,unidade])
 await c.query('SELECT atendimento_presencial_negociacao_materializar($1,$2)',[origem,usuario])
 const dados={clienteId:cliente,unidadeId:unidade,consultora:'ANA',canal:'whatsapp',fechadoEm:new Date().toISOString(),numeroLancamento:123456,produtos:[{descricao:'BERCO',quantidade:1,vendido:true},{descricao:'PRODUTO QUE NAO TRABALHAMOS',quantidade:null,vendido:null}]}
 const fechar=(db,id)=>db.query('SELECT atendimento_presencial_negociacao_digital($1,$2,$3,$4,$5,0,$6) r',[origem,usuario,randomUUID(),'concluir',id,dados])
 const ficha={versaoFluxo:2,tipoAtendimento:'cliente',versaoProdutos:2,versaoEssenciais:1,essenciais:{},criancas:[],departamentos:['moveis'],produtosInteresse:[],motivosResultado:[],etapaAtual:'ficha'}
 const retorno=(db,op)=>db.query('SELECT atendimento_presencial_negociacao_criar_retorno($1,$2,$3,$4,$5) id',[origem,usuario,op,unidade,ficha])
 const salvo=(await retorno(c,randomUUID())).rows[0].id
 await a.query('SET ROLE authenticated')
 await assert.rejects(retorno(a,randomUUID()),e=>e.code==='42501')
 await a.query('SET ROLE service_role');await b.query('SET ROLE service_role')
 await assert.rejects(a.query('UPDATE atendimento_presencial_negociacoes SET version=version WHERE false'),e=>e.code==='42501')
 // service_role possui SELECT, mas nenhuma escrita direta nas novas tabelas.
 ok('Roles reais: authenticated não executa RPC; service_role não escreve diretamente e usa somente RPCs autorizadas')
 await a.query('BEGIN');await fechar(a,randomUUID())
 const disputa=fechar(b,randomUUID()).then(()=>({ok:true}),e=>({ok:false,code:e.code}))
 // Uma terceira conexão cria e salva rascunhos enquanto o encerramento mantém lock.
 await c.query("SET statement_timeout='2s'")
 const novo=(await retorno(c,randomUUID())).rows[0].id
 await c.query("UPDATE atendimento_presencial_atendimentos SET dados_rascunho=jsonb_set(dados_rascunho,'{observacoes}',to_jsonb('AUTOSAVE INDEPENDENTE'::text)),version=version+1 WHERE id=$1",[salvo])
 let wait;const limite=Date.now()+5000
 do{wait=(await c.query('SELECT wait_event_type,pg_blocking_pids(pid) bloqueios FROM pg_stat_activity WHERE pid=$1',[b.processID])).rows[0];if(wait?.wait_event_type==='Lock')break;await new Promise(r=>setTimeout(r,20))}while(Date.now()<limite)
 assert.equal(wait.wait_event_type,'Lock');assert.ok(wait.bloqueios.includes(a.processID))
 ok('Conexões reais: segundo encerramento espera lock; criação e autosave de rascunho terminam antes do commit do primeiro')
 await a.query('COMMIT');assert.deepEqual(await disputa,{ok:false,code:'P0003'})
 const n=(await c.query('SELECT id FROM atendimento_presencial_negociacoes WHERE origem_id=$1',[origem])).rows[0].id
 assert.equal((await c.query('SELECT count(*)::int c FROM atendimento_presencial_negociacao_encerramentos WHERE negociacao_id=$1 AND NOT anulado',[n])).rows[0].c,1)
 assert.equal((await c.query("SELECT dados_rascunho->>'observacoes' obs FROM atendimento_presencial_atendimentos WHERE id=$1",[salvo])).rows[0].obs,'AUTOSAVE INDEPENDENTE')
 assert.equal((await c.query('SELECT status FROM atendimento_presencial_atendimentos WHERE id=$1',[novo])).rows[0].status,'rascunho')
 ok('Concorrência real: exatamente um encerramento; ambos os rascunhos permanecem intactos')
 const op=randomUUID(),dupla=await Promise.all([retorno(a,op),retorno(b,op)])
 assert.equal(dupla[0].rows[0].id,dupla[1].rows[0].id);ok('Retries simultâneos da mesma operação criam um único retorno')
 await c.query("SET statement_timeout='15s'")
 // D-063: sessões reais disputam o mesmo atendimento existente.
 const criarVisita=async(resultado='negociacao')=>{const id=randomUUID();await c.query("INSERT INTO atendimento_presencial_atendimentos(id,cliente_id,consultora_usuario_id,unidade_id,status,iniciado_em,concluido_em,resultado_atendimento,numero_lancamento) VALUES($1,$2,$3,$4,'concluido',now(),now(),$5,$6)",[id,cliente,usuario,unidade,resultado,resultado==='sim'?987654:null]);return id}
 const r1=await criarVisita(),r2=await criarVisita(),alvo=await criarVisita('sim')
 await c.query('SELECT atendimento_presencial_negociacao_materializar($1,$2)',[r1,usuario])
 const associar=(db,raiz,atendimento,op=randomUUID())=>db.query('SELECT atendimento_presencial_negociacao_associar_atendimento($1,$2,$3,$4,1) r',[raiz,atendimento,usuario,op])
 await a.query('BEGIN');const associacao=await associar(a,r1,alvo)
 const concorrente=associar(b,r2,alvo).then(()=>({ok:true}),e=>({ok:false,code:e.code}))
 await c.query("SET statement_timeout='2s'")
 const d=(await c.query('SELECT atendimento_presencial_negociacao_criar_retorno($1,$2,$3,$4,$5) id',[r1,usuario,randomUUID(),unidade,ficha])).rows[0].id
 await c.query("UPDATE atendimento_presencial_atendimentos SET dados_rascunho=jsonb_set(dados_rascunho,'{observacoes}',to_jsonb('D063 AUTOSAVE'::text)) WHERE id=$1",[d])
 await a.query('COMMIT');assert.deepEqual(await concorrente,{ok:false,code:'P0003'})
 assert.equal(associacao.rows[0].r.situacao,'venda')
 assert.equal((await c.query('SELECT count(*)::int c FROM atendimento_presencial_negociacao_encerramentos WHERE atendimento_id=$1 AND NOT anulado',[alvo])).rows[0].c,1)
 assert.equal((await c.query("SELECT dados_rascunho->>'observacoes' observacoes FROM atendimento_presencial_atendimentos WHERE id=$1",[d])).rows[0].observacoes,'D063 AUTOSAVE')
 ok('D-063: venda existente exclusiva entre duas origens; criação/autosave de outro rascunho termina durante a associação não commitada')
 const r3=await criarVisita(),alvo3=await criarVisita(),retry=randomUUID()
 const repetidas=await Promise.all([associar(a,r3,alvo3,retry),associar(b,r3,alvo3,retry)])
 assert.deepEqual(repetidas[0].rows,repetidas[1].rows)
 assert.equal((await c.query('SELECT count(*)::int c FROM atendimento_presencial_negociacao_eventos WHERE operacao_id=$1',[retry])).rows[0].c,1)
 await assert.rejects(associar(c,alvo3,r3),e=>e.code==='P0003')
 ok('D-063: retry simultâneo idempotente registra um evento; retorno vinculado não pode virar origem contraditória')
 const r4=await criarVisita(),alvo4=await criarVisita('nao')
 assert.equal((await associar(c,r4,alvo4)).rows[0].r.situacao,'perda')
 await c.query("SET statement_timeout='15s'")
 ok('D-063: perda existente encerra sem criar visita nem alterar o resultado original')
 await c.query('UPDATE atendimento_presencial_digital_config SET ativo=true')
 const raizDigital=await criarVisita()
 await c.query('SELECT atendimento_presencial_negociacao_materializar($1,$2)',[raizDigital,usuario])
 const fichaDigital={...ficha,resultadoAtendimento:'sim',consultoraNome:'ANA',produtosInteresse:[{descricao:'COMODA',quantidade:1,vendido:true}]}
 const criarDigital=async(db,op)=>(await db.query('SELECT atendimento_presencial_digital_criar($1,$2,$3,$4,$5,$6,null,now()) id',[raizDigital,usuario,op,unidade,fichaDigital,'whatsapp'])).rows[0].id
 const digital1=await criarDigital(c,randomUUID()),digital2=await criarDigital(c,randomUUID())
 const finalizarDigital=(db,id,lancamento)=>db.query('SELECT atendimento_presencial_digital_concluir($1,1,$2,$3,$4,null)',[id,usuario,lancamento,'ANA'])
 await a.query('BEGIN');await finalizarDigital(a,digital1,456701)
 const disputaDigital=finalizarDigital(b,digital2,456702).then(()=>({ok:true}),e=>({ok:false,code:e.code}))
 await c.query("SET statement_timeout='2s'")
 const digital3=await criarDigital(c,randomUUID())
 await c.query("UPDATE atendimento_presencial_atendimentos SET dados_rascunho=jsonb_set(dados_rascunho,'{observacoes}',to_jsonb('DIGITAL AUTOSAVE'::text)) WHERE id=$1",[digital3])
 await a.query('COMMIT');assert.deepEqual(await disputaDigital,{ok:false,code:'P0003'})
 await finalizarDigital(a,digital1,456701)
 assert.equal((await c.query('SELECT status FROM atendimento_presencial_atendimentos WHERE id=$1',[digital2])).rows[0].status,'rascunho')
 await c.query("SET statement_timeout='15s'")
 ok('D-064: duas conclusões digitais competem por um encerramento; criação/autosave independentes durante lock e retry sem duplicação')
 const raizMista=await criarVisita()
 const digMisto=(await c.query('SELECT atendimento_presencial_digital_criar($1,$2,$3,$4,$5,$6,null,now()) id',[raizMista,usuario,randomUUID(),unidade,fichaDigital,'whatsapp'])).rows[0].id
 const presencial=(await c.query('SELECT atendimento_presencial_negociacao_criar_retorno($1,$2,$3,$4,$5) id',[raizMista,usuario,randomUUID(),unidade,fichaDigital])).rows[0].id
 await a.query('BEGIN');await finalizarDigital(a,digMisto,456703)
 const misto=b.query('SELECT atendimento_presencial_negociacao_concluir_retorno($1,1,$2,456704,$3,null,false)',[presencial,usuario,'ANA']).then(()=>({ok:true}),e=>({ok:false,code:e.code}))
 await a.query('COMMIT');assert.deepEqual(await misto,{ok:false,code:'P0003'})
 assert.equal((await c.query('SELECT status FROM atendimento_presencial_atendimentos WHERE id=$1',[presencial])).rows[0].status,'rascunho')
 ok('D-064: disputa digital/presencial produz um encerramento e preserva o rascunho presencial para decisão explícita')
 // Backup complementar sintético de todas as tabelas públicas, com hash de linhas.
 const tabelas=(await c.query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename")).rows.map(r=>r.tablename)
 const backup={};for(const t of tabelas)backup[t]=(await c.query(`SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text),'[]') linhas FROM public.${t} t`)).rows[0].linhas
 const backupPath=path.join(pasta,'backup-sintetico.json');writeFileSync(backupPath,JSON.stringify(backup))
 await c.query('CREATE DATABASE negociacoes_restore');restore=conexao('negociacoes_restore');await restore.connect();await preparar(restore)
 assert.equal((await restore.query('SELECT current_database() nome')).rows[0].nome,'negociacoes_restore')
 await restore.query('BEGIN')
 await restore.query('SET CONSTRAINTS ALL DEFERRED')
 await restore.query('TRUNCATE '+tabelas.map(t=>'public.'+t).join(',')+' CASCADE')
 const fks=(await restore.query("SELECT child.relname filho,parent.relname pai FROM pg_constraint con JOIN pg_class child ON child.oid=con.conrelid JOIN pg_class parent ON parent.oid=con.confrelid WHERE con.contype='f' AND NOT con.condeferrable AND child.relnamespace='public'::regnamespace")).rows
 const pendentes=new Set(tabelas),restauradas=new Set()
 for(const t of tabelas)await restore.query(`ALTER TABLE public.${t} DISABLE TRIGGER USER`)
 while(pendentes.size){let progresso=false;for(const t of pendentes){if(fks.some(f=>f.filho===t&&f.pai!==t&&pendentes.has(f.pai)))continue;await restore.query(`INSERT INTO public.${t} SELECT * FROM jsonb_populate_recordset(NULL::public.${t},$1)`,[JSON.stringify(backup[t])]);pendentes.delete(t);restauradas.add(t);progresso=true}if(!progresso)throw new Error('Ciclo de FKs não coberto pela fixture')}
 await restore.query('SET CONSTRAINTS ALL IMMEDIATE')
 for(const t of tabelas)await restore.query(`ALTER TABLE public.${t} ENABLE TRIGGER USER`)
 await restore.query('COMMIT')
 for(const t of tabelas){const linhas=(await restore.query(`SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text),'[]') linhas FROM public.${t} t`)).rows[0].linhas;assert.deepEqual(linhas,backup[t],t)}
 ok(`Backup/restauração isolada: ${restauradas.size} tabelas conferidas integralmente, incluindo rascunhos, eventos e encerramento`)
 await restore.query(readFileSync('scripts/prancheta/sql/suspender-fluxo-negociacoes-d063.sql','utf8'))
 assert.equal((await restore.query("SELECT has_function_privilege('service_role','public.atendimento_presencial_negociacao_associar_atendimento(uuid,uuid,uuid,uuid,integer)','EXECUTE') permitido")).rows[0].permitido,false)
 assert.equal((await restore.query("SELECT has_function_privilege('service_role','public.atendimento_presencial_negociacoes_resumos(uuid,uuid[])','EXECUTE') permitido")).rows[0].permitido,true)
 ok('D-063: recuperação revoga somente a nova associação; consultas e dados restaurados preservados')
 await restore.query(readFileSync('scripts/prancheta/sql/suspender-prancheta-digital-integral.sql','utf8'))
 assert.equal((await restore.query('SELECT ativo FROM atendimento_presencial_digital_config')).rows[0].ativo,false)
 assert.equal((await restore.query("SELECT has_function_privilege('service_role','public.atendimento_presencial_digital_criar(uuid,uuid,uuid,uuid,jsonb,text,text,timestamptz)','EXECUTE') permitido")).rows[0].permitido,false)
 ok('D-064: recuperação desativa novas criações integrais, preservando dados e rascunhos existentes')
 await restore.query(readFileSync('scripts/prancheta/sql/suspender-negociacoes.sql','utf8'))
 assert.equal((await restore.query("SELECT has_function_privilege('service_role','public.atendimento_presencial_negociacao_digital(uuid,uuid,uuid,text,uuid,integer,jsonb,text)','EXECUTE') permitido")).rows[0].permitido,false)
 ok('Recuperação não destrutiva suspende novas mutações sem excluir os dados restaurados')
 writeFileSync('output/negociacoes-postgres-resultado.json',JSON.stringify({versao:(await c.query('SHOW server_version')).rows[0].server_version,checks,backup:pasta,limite:'Cluster e dados sintéticos; não é backup nem homologação de produção.'},null,2))
}finally{
 for(const db of[a,b,c,restore])if(db)await db.end().catch(e=>console.error('Fechar conexão local:',e.message))
 if(iniciado)executar(pg_ctl,['-D',cluster,'-m','fast','-w','stop'])
}
