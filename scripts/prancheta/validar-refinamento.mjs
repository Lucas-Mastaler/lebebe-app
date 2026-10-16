// Somente PostgreSQL/WASM efêmero e fixtures. Sem credenciais ou acesso remoto.
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {criarBancoP1,usuario,unidade,cliente} from './banco-sintetico-p1.mjs'
process.on('uncaughtException', error => { console.error(error.message, error.where ?? ''); process.exit(1) })
const runtime=process.argv[2] ?? 'C:/Users/lebeb/AppData/Local/Temp/prancheta-entrega2-sql-runtime/node_modules/@electric-sql/pglite/dist/index.js'
const db=await criarBancoP1(runtime)
try {
 await db.exec(`ALTER TABLE atendimento_presencial_clientes ADD COLUMN telefone_informado text, ADD COLUMN telefone_normalizado text, ADD COLUMN telefone_normalizado_ddi text;
 ALTER TABLE atendimento_presencial_motivos ADD CONSTRAINT atendimento_presencial_motivos_motivo_check CHECK (motivo IN ('preco','outro','virada_cartao','prazo_entrega','conversar_outra_pessoa','aguardar_nascimento'));
 ALTER TABLE atendimento_presencial_motivos ADD CONSTRAINT atendimento_presencial_motivos_complemento_check CHECK ((motivo='outro' AND complemento IS NOT NULL) OR (motivo<>'outro' AND complemento IS NULL));`)
 const historico='20000000-0000-4000-8000-000000000019'
 await db.query("insert into atendimento_presencial_atendimentos(id,cliente_id,consultora_usuario_id,unidade_id,status,resultado_atendimento,numero_lancamento,concluido_em,dados_rascunho) values($1,$2,$3,$4,'concluido','sim',22,now(),'{}')",[historico,cliente,usuario,unidade])
 const antes=(await db.query('select * from atendimento_presencial_atendimentos where id=$1',[historico])).rows[0]
 // Mesmos defaults/forma pg_get_functiondef da produção; fixtures nunca habilitam banco remoto.
 const migration=readFileSync('supabase/migrations/20261016215502_prancheta_refinamento_funcional.sql','utf8')
 await db.exec(migration)
 const depois=(await db.query('select * from atendimento_presencial_atendimentos where id=$1',[historico])).rows[0]
 assert.equal(depois.telefone_recusa_confirmada,null)
 for(const key of Object.keys(antes))assert.deepEqual(depois[key],antes[key])
 await db.exec(`CREATE OR REPLACE FUNCTION atendimento_presencial_fluxo_v2_habilitado() RETURNS boolean LANGUAGE sql AS $$ SELECT true $$;
 CREATE OR REPLACE FUNCTION atendimento_presencial_criancas_habilitado() RETURNS boolean LANGUAGE sql AS $$ SELECT true $$;`)
 const base={versaoFluxo:2,tipoAtendimento:'cliente',consultoraNome:'Ana',criancas:[],departamentos:['moveis'],produtosInteresse:['Produto que não trabalhamos'],resultadoAtendimento:'nao',motivosResultado:['outra_loja_fisica','outra_loja_internet'],lojasMotivos:{outra_loja_fisica:'Loja Física',outra_loja_internet:'Loja Internet'},etapaAtual:'resultado'}
 let n=20,checks=1
 const draft=async(dados=base)=>{const id=`20000000-0000-4000-8000-${String(n++).padStart(12,'0')}`;await db.query('insert into atendimento_presencial_atendimentos(id,cliente_id,consultora_usuario_id,unidade_id,dados_rascunho,criado_por,atualizado_por) values($1,$2,$3,$4,$5,$3,$3)',[id,cliente,usuario,unidade,dados]);return id}
 const confirmation=(id,version=1)=>({atendimentoId:id,version,clienteId:cliente,solicitadoERecusado:true})
 const concluir=(id,c=null,version=1,lancamento=null)=>db.query('select * from atendimento_presencial_concluir($1,$2,$3,$4,null,$5)',[id,version,usuario,lancamento,c])
 const reject=async(p,pattern)=>{await assert.rejects(p,pattern);checks++}
 const id=await draft()
 await reject(concluir(id),/telefone_recusa_obrigatoria/)
 await reject(concluir(id,confirmation('20000000-0000-4000-8000-000000000099')),/telefone_recusa_obrigatoria/)
 await reject(concluir(id,confirmation(id,2)),/telefone_recusa_obrigatoria/)
 await reject(concluir(id,{...confirmation(id),clienteId:usuario}),/telefone_recusa_obrigatoria/)
 await concluir(id,confirmation(id));checks++
 const row=(await db.query('select * from atendimento_presencial_atendimentos where id=$1',[id])).rows[0]
 assert.equal(row.telefone_recusa_confirmada,true);checks++
 assert.deepEqual((await db.query('select motivo,complemento from atendimento_presencial_motivos where atendimento_id=$1 order by ordem',[id])).rows,[{motivo:'outra_loja_fisica',complemento:'Loja Física'},{motivo:'outra_loja_internet',complemento:'Loja Internet'}]);checks++
 await reject(concluir(id,confirmation(id)),/atendimento_not_draft/)
 const id2=await draft();await reject(concluir(id2,confirmation(id)),/telefone_recusa_obrigatoria/)
 await db.query("update atendimento_presencial_clientes set telefone_informado='+55 (41) 99999-9999' where id=$1",[cliente])
 await concluir(id2);assert.equal((await db.query('select telefone_recusa_confirmada from atendimento_presencial_atendimentos where id=$1',[id2])).rows[0].telefone_recusa_confirmada,false);checks++
 // Edição mantém ambos os complementos e recusa original; retirar um motivo remove seu dado.
 await db.query('select * from atendimento_presencial_editar_concluido($1,2,$2,$3,null,null)',[id,usuario,{...base,clienteId:cliente,lojasMotivos:{outra_loja_fisica:'Nova loja',outra_loja_internet:'Internet editada'}}]);checks++
 assert.equal((await db.query("select complemento from atendimento_presencial_motivos where atendimento_id=$1 and motivo='outra_loja_internet'",[id])).rows[0].complemento,'Internet editada');checks++
 await db.query('select * from atendimento_presencial_editar_concluido($1,3,$2,$3,null,null)',[id,usuario,{...base,clienteId:cliente,motivosResultado:['outra_loja_fisica']}]);
 assert.equal((await db.query('select count(*)::int n from atendimento_presencial_motivos where atendimento_id=$1',[id])).rows[0].n,1);checks++
 for(const motivoVisita of ['acompanhante_separado','pedido_informacao','ambulante_entregador_ifood_panfleto','entrega_mercadoria','curriculo','representante','outros','entregador_uber_eats','curriculo_entrevista','panfleto']){
   const visita=await draft({...base,tipoAtendimento:'nao_cliente',motivoVisita});await concluir(visita)
   const v=(await db.query('select cliente_id,telefone_recusa_confirmada from atendimento_presencial_atendimentos where id=$1',[visita])).rows[0];assert.equal(v.cliente_id,null);assert.equal(v.telefone_recusa_confirmada,null);checks++
 }
 for(const motivosResultado of [['cor_diferente','nao_coube_quarto','sem_estoque','produto_caro','frete_caro','nao_respondeu','prazo_entrega'],['virada_cartao','sem_medidas','ganhar_presente','conversar_outra_pessoa','pesquisando','aguardar_nascimento','inicio_gestacao'],['preco']]){
   const novo=await draft({...base,motivosResultado,...(motivosResultado.includes('virada_cartao') ? {viradaCartaoDia:10,viradaCartaoMes:11} : {})});await concluir(novo);checks++
 }
 const venda=await draft({...base,resultadoAtendimento:'sim',motivosResultado:[]});await concluir(venda,null,1,12);checks++
 for(const [tel,valid] of [['',false],['+55 (41) 99999-9999',true],['4199999999',true],['0099999999',false],['4199',false]]){
   assert.equal((await db.query('select atendimento_presencial_telefone_valido($1) valido',[tel])).rows[0].valido,valid);checks++
 }
 for(const role of ['anon','authenticated'])assert.equal((await db.query("select has_function_privilege($1,'atendimento_presencial_concluir(uuid,integer,uuid,integer,text,jsonb)','EXECUTE') permitido",[role])).rows[0].permitido,false)
 await assert.rejects(db.exec(migration),/preflight_refinamento_ja_aplicado/);await db.exec('ROLLBACK');checks++
 console.log(`${checks} grupos SQL aprovados: motivos/lojas/edição, telefone/versão/cliente/retentativa, visitas/legado/ACL, venda fechada e preflight.`)
} finally {await db.close()}
