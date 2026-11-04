import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { criarBancoP1, usuario, unidade, cliente } from './banco-sintetico-p1.mjs'
process.on('uncaughtException', e => { console.error(e.message,e.code,e.where??''); process.exit(1) })
const db = await criarBancoP1(process.argv[2] ?? 'C:/le-bebe/output/recebimento-conferir-todos-tools/node_modules/@electric-sql/pglite/dist/index.js')
const q = (sql,args=[]) => db.query(sql,args)
let checks=0
await db.exec('ALTER TABLE atendimento_presencial_atendimentos ALTER COLUMN id SET DEFAULT gen_random_uuid()')
await db.exec(readFileSync('supabase/migrations/20261104131151_prancheta_negociacoes.sql','utf8'))
const origem='20000000-0000-4000-8000-000000000001'
await q("insert into atendimento_presencial_atendimentos(id,cliente_id,consultora_usuario_id,unidade_id,status,concluido_em,resultado_atendimento) values($1,$2,$3,$4,'concluido',now(),'negociacao')",[origem,cliente,usuario,unidade])
const n=(await q('select atendimento_presencial_negociacao_materializar($1,$2) id',[origem,usuario])).rows[0].id
const a='30000000-0000-4000-8000-000000000001', b='30000000-0000-4000-8000-000000000002'
const payload={versaoFluxo:2,tipoAtendimento:'cliente',consultoraNome:'ANA',criancas:[],departamentos:['moveis'],produtosInteresse:[],motivosResultado:[],etapaAtual:'ficha'}
const criar=op=>q('select atendimento_presencial_negociacao_criar_retorno($1,$2,$3,$4,$5) id',[origem,usuario,op,unidade,payload])
const primeiro=(await criar(a)).rows[0].id, segundo=(await criar(b)).rows[0].id
assert.notEqual(primeiro,segundo);checks++
assert.equal((await criar(a)).rows[0].id,primeiro);checks++
assert.equal((await q('select count(*)::int c from atendimento_presencial_negociacao_retornos where negociacao_id=$1',[n])).rows[0].c,2);checks++
await q('delete from atendimento_presencial_atendimentos where id=$1',[primeiro])
assert.equal((await q('select count(*)::int c from atendimento_presencial_atendimentos where id=$1',[segundo])).rows[0].c,1);checks++
const venda='40000000-0000-4000-8000-000000000001',op='50000000-0000-4000-8000-000000000001'
const dados={clienteId:cliente,unidadeId:unidade,consultora:'ANA',canal:'whatsapp',fechadoEm:new Date().toISOString(),numeroLancamento:123,produtos:[{descricao:'BERCO',quantidade:2,vendido:true}]}
const digital=(acao,version,body=dados,operacao=op,motivo=null)=>q('select atendimento_presencial_negociacao_digital($1,$2,$3,$4,$5,$6,$7,$8) r',[origem,usuario,operacao,acao,venda,version,body,motivo])
await assert.rejects(digital('concluir',0,{...dados,produtos:[]}),e=>e.code==='23514');checks++
const resultado=(await digital('concluir',0)).rows[0].r
assert.equal(resultado.status,'concluido');checks++
assert.deepEqual((await digital('concluir',0)).rows[0].r,resultado);checks++
assert.equal((await q('select count(*)::int c from atendimento_presencial_atendimentos')).rows[0].c,2);checks++
assert.equal((await q('select status from atendimento_presencial_atendimentos where id=$1',[segundo])).rows[0].status,'rascunho');checks++
const novo=(await digital('corrigir',resultado.version,{...dados,numeroLancamento:124},'50000000-0000-4000-8000-000000000002','Corrigir lançamento')).rows[0].r
assert.equal(novo.version,resultado.version+1);checks++
await digital('anular',novo.version,{},'50000000-0000-4000-8000-000000000003','Venda registrada indevidamente')
assert.equal((await q('select count(*)::int c from atendimento_presencial_negociacao_encerramentos where negociacao_id=$1 and not anulado',[n])).rows[0].c,0);checks++
assert.equal((await q('select count(*)::int c from atendimento_presencial_negociacao_eventos where negociacao_id=$1',[n])).rows[0].c,5);checks++
console.log(JSON.stringify({checks,resultado:'aprovado',ambiente:'PostgreSQL/WASM sintetico',limite:'somente RPCs implementadas; não comprova aplicação completa'}))
await db.close()
