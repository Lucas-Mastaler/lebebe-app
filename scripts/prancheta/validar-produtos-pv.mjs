// PostgreSQL/WASM efêmero, fixtures sintéticas. Nenhum acesso ou escrita remota.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { criarBancoP1, usuario, unidade, cliente } from './banco-sintetico-p1.mjs'
process.on('uncaughtException', error => { console.error(error.message, error.where ?? '', error.position ?? ''); process.exit(1) })

const runtime = process.argv[2] ?? 'C:/Users/lebeb/AppData/Local/Temp/prancheta-entrega2-sql-runtime/node_modules/@electric-sql/pglite/dist/index.js'
const db = await criarBancoP1(runtime)
let checks = 0
const check = (actual, expected) => { assert.deepEqual(actual, expected); checks++ }
const q = (sql, params = []) => db.query(sql, params)
const rejeita = async (sql, params, erro) => { await assert.rejects(q(sql, params), erro); checks++ }
try {
  await db.exec(`ALTER TABLE atendimento_presencial_clientes ADD COLUMN telefone_informado text, ADD COLUMN telefone_normalizado text, ADD COLUMN telefone_normalizado_ddi text;
    ALTER TABLE atendimento_presencial_atendimentos ADD COLUMN telefone_recusa_confirmada boolean, ADD COLUMN telefone_desfecho text;
    ALTER TABLE atendimento_presencial_produtos_interesse ADD COLUMN id uuid DEFAULT gen_random_uuid() PRIMARY KEY, ADD COLUMN created_at timestamptz DEFAULT now();
    CREATE UNIQUE INDEX uq_atendimento_presencial_produtos_descricao ON atendimento_presencial_produtos_interesse(atendimento_id,lower(descricao));
    DROP FUNCTION atendimento_presencial_concluir(uuid,integer,uuid,integer,text);
    CREATE FUNCTION atendimento_presencial_telefone_valido(p_telefone text) RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path=pg_catalog AS $$ WITH d AS (SELECT regexp_replace(coalesce(p_telefone,''),'[^0-9]','','g') t), n AS (SELECT CASE WHEN length(t)>11 AND left(t,2)='55' THEN substr(t,3) ELSE t END t FROM d) SELECT length(t) BETWEEN 10 AND 11 AND left(t,2)<>'00' FROM n $$;`)
  // pg_get_functiondef foi capturado em LF; neutralizar autocrlf do checkout no fixture.
  await db.exec(readFileSync('scripts/prancheta/sql/produtos-base-real.sql', 'utf8').replace(/\r\n/g, '\n'))
  await db.exec(`CREATE OR REPLACE FUNCTION atendimento_presencial_fluxo_v2_habilitado() RETURNS boolean LANGUAGE sql AS $$ SELECT true $$;
    CREATE OR REPLACE FUNCTION atendimento_presencial_criancas_habilitado() RETURNS boolean LANGUAGE sql AS $$ SELECT true $$;`)
  await q("UPDATE atendimento_presencial_clientes SET telefone_informado='(41) 99999-9999' WHERE id=$1", [cliente])
  const base = { versaoFluxo: 2, tipoAtendimento: 'cliente', consultoraNome: 'Ana', criancas: [], departamentos: ['moveis'], produtosInteresse: ['Berço', 'berco'], resultadoAtendimento: 'sim', motivosResultado: [], etapaAtual: 'ficha' }
  let numero = 1
  async function draft(dados) {
    const id = `30000000-0000-4000-8000-${String(numero++).padStart(12,'0')}`
    await q('INSERT INTO atendimento_presencial_atendimentos(id,cliente_id,consultora_usuario_id,unidade_id,dados_rascunho,criado_por,atualizado_por) VALUES($1,$2,$3,$4,$5,$3,$3)', [id,cliente,usuario,unidade,dados])
    return id
  }
  const concluir = (id, version = 1, executor = usuario) => q('SELECT * FROM atendimento_presencial_concluir($1,$2,$3,22,null,null)', [id,version,executor])
  const editar = (id, version, dados) => q('SELECT * FROM atendimento_presencial_editar_concluido($1,$2,$3,$4,22,null)',[id,version,usuario,dados])
  const produtos = async id => (await q('SELECT * FROM atendimento_presencial_produtos_interesse WHERE atendimento_id=$1 ORDER BY ordem',[id])).rows
  const antigo = await draft(base)
  await concluir(antigo)
  const antes = await produtos(antigo)
  const migration = readFileSync('supabase/migrations/20261020193639_prancheta_produtos_pv.sql','utf8')
  await db.exec(migration)
  const depois = await produtos(antigo)
  for (let i=0;i<antes.length;i++) { const {quantidade,vendido,...original}=depois[i]; check(original,antes[i]); check([quantidade,vendido],[null,null]) }
  check((await q('SELECT versao_produtos FROM atendimento_presencial_atendimentos WHERE id=$1',[antigo])).rows[0].versao_produtos,null)
  await editar(antigo,2,{...base,observacoes:'Somente observação'})
  check(await produtos(antigo),depois) // IDs/datas/grafia não recriados.
  const estruturados = { ...base, versaoProdutos:2, produtosInteresse:[{descricao:'BERÇO',quantidade:1,vendido:true},{descricao:'CÔMODA',quantidade:1,vendido:true},{descricao:'POLTRONA',quantidade:2,vendido:false},{descricao:'NANINHA',quantidade:1,vendido:true},{descricao:'PRODUTO QUE NÃO TRABALHAMOS',quantidade:null,vendido:null}] }
  const novo = await draft(estruturados)
  await rejeita('UPDATE atendimento_presencial_atendimentos SET dados_rascunho=$2 WHERE id=$1',[novo,base],/produtos_cliente_antigo/)
  await rejeita('SELECT * FROM atendimento_presencial_concluir($1,99,$2,22,null,null)',[novo,usuario],/version_conflict/)
  await rejeita('SELECT * FROM atendimento_presencial_concluir($1,1,$2,22,null,null)',[novo,'10000000-0000-4000-8000-000000000099'],/executor_invalido/)
  await concluir(novo)
  check((await produtos(novo)).map(({descricao,quantidade,vendido})=>({descricao,quantidade,vendido})),estruturados.produtosInteresse)
  check(Number((await q('SELECT sum(quantidade) pv FROM atendimento_presencial_produtos_interesse WHERE atendimento_id=$1 AND vendido',[novo])).rows[0].pv),3)
  await rejeita('SELECT * FROM atendimento_presencial_editar_concluido($1,2,$2,$3,22,null)',[novo,usuario,base],/produtos_cliente_antigo/)
  const itensAntes = await produtos(novo)
  await editar(novo,2,{...estruturados,observacoes:'Preserva os itens'})
  check(await produtos(novo),itensAntes)
  const editados={...estruturados,produtosInteresse:estruturados.produtosInteresse.map((p,i)=>i===0?{...p,quantidade:3}:p)}
  await editar(novo,3,editados)
  check((await produtos(novo))[0].quantidade,3)
  const repetidos = { ...editados, produtosInteresse: editados.produtosInteresse.map((p,i) => i===1 ? {...p,descricao:'BERÇO',vendido:false} : p) }
  await editar(novo,4,repetidos)
  check((await produtos(novo)).slice(0,2).map(({descricao,quantidade,vendido})=>({descricao,quantidade,vendido})),repetidos.produtosInteresse.slice(0,2))
  const repetidoDraft=await draft(repetidos)
  await concluir(repetidoDraft)
  check((await produtos(repetidoDraft)).map(({descricao,quantidade,vendido})=>({descricao,quantidade,vendido})),repetidos.produtosInteresse)
  check((await q("SELECT to_regclass('public.uq_atendimento_presencial_produtos_descricao') indice")).rows[0].indice,null)
  await rejeita('SELECT atendimento_presencial_normalizar_payload_ficha($1,false)',[{...base,produtosInteresse:['Berço','BERÇO']}],/produto_duplicado/)

  const legadoNovo={...base,versaoProdutos:2,produtosInteresse:base.produtosInteresse.map(descricao=>({descricao,quantidade:null,vendido:null}))}
  const legadoItens=await produtos(antigo)
  await editar(antigo,3,legadoNovo)
  check(await produtos(antigo),legadoItens)
  for(const produto of [{descricao:'x',quantidade:0,vendido:false},{descricao:'x',quantidade:1.5,vendido:false},{descricao:'x',quantidade:2147483648,vendido:false},{descricao:'x',quantidade:null,vendido:true},{descricao:'PRODUTO QUE NÃO TRABALHAMOS',quantidade:1,vendido:true},{descricao:'x',quantidade:1}]) {
    await rejeita('SELECT atendimento_presencial_normalizar_payload_ficha($1,false)',[{...estruturados,produtosInteresse:[produto]}],/produto/)
  }
  const rollbackId=await draft(estruturados)
  // Falha após escrita dos filhos prova atomicidade da conclusão.
  await db.exec(`CREATE FUNCTION fixture_falhar_historico() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fixture_rollback'; END $$;
    CREATE TRIGGER fixture_falhar_historico BEFORE INSERT ON atendimento_presencial_historico FOR EACH ROW EXECUTE FUNCTION fixture_falhar_historico();`)
  await rejeita('SELECT * FROM atendimento_presencial_concluir($1,1,$2,22,null,null)',[rollbackId,usuario],/fixture_rollback/)
  check(await produtos(rollbackId),[])
  check((await q('SELECT status,version FROM atendimento_presencial_atendimentos WHERE id=$1',[rollbackId])).rows[0],{status:'rascunho',version:1})
  await db.exec('DROP TRIGGER fixture_falhar_historico ON atendimento_presencial_historico')
  await concluir(rollbackId)
  for(const role of ['anon','authenticated']) check((await q("SELECT has_function_privilege($1,'public.atendimento_presencial_validar_produtos(jsonb)','EXECUTE') permitido",[role])).rows[0].permitido,false)
  await assert.rejects(db.exec(migration),/preflight_/); await db.exec('ROLLBACK'); checks++
  console.log(`${checks} verificações Produtos/PV aprovadas em PostgreSQL isolado.`)
} finally { await db.close() }
