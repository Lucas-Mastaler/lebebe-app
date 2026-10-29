// PostgreSQL/WASM efêmero. Sem credenciais ou conexão ao Supabase.
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { criarBancoP1, usuario, unidade, cliente } from './banco-sintetico-p1.mjs'
process.on('uncaughtException', error => { console.error(error.message, error.where ?? ''); process.exit(1) })
const runtime = process.argv[2] ?? 'C:/Users/lebeb/AppData/Local/Temp/prancheta-entrega2-sql-runtime/node_modules/@electric-sql/pglite/dist/index.js'
const db = await criarBancoP1(runtime)
const q = (sql, args = []) => db.query(sql, args)
let checks = 0
const ok = valor => { assert.ok(valor); checks++ }
const falha = async (sql, args, erro) => { await assert.rejects(q(sql, args), e => e.message.includes(erro)); checks++ }
try {
  await db.exec(`
    ALTER TABLE app_unidades ADD COLUMN nome text DEFAULT 'Filial teste';
    ALTER TABLE atendimento_presencial_clientes ADD COLUMN telefone_informado text DEFAULT '41999999999';
    ALTER TABLE atendimento_presencial_clientes ADD COLUMN telefone_normalizado text;
    ALTER TABLE atendimento_presencial_clientes ADD COLUMN telefone_normalizado_ddi text;
    ALTER TABLE atendimento_presencial_atendimentos ADD COLUMN versao_produtos smallint;
    ALTER TABLE atendimento_presencial_atendimentos ADD COLUMN telefone_recusa_confirmada boolean;
    ALTER TABLE atendimento_presencial_atendimentos ADD COLUMN telefone_desfecho text;
    ALTER TABLE atendimento_presencial_atendimentos ADD COLUMN motivo_visita_outro text;
    ALTER TABLE atendimento_presencial_produtos_interesse ADD COLUMN quantidade integer;
    ALTER TABLE atendimento_presencial_produtos_interesse ADD COLUMN vendido boolean;
    ALTER TABLE atendimento_presencial_criancas ADD CONSTRAINT atendimento_presencial_criancas_idade_valor_check CHECK(idade_valor IS NULL OR idade_valor>=1);
  `)
  await db.exec(readFileSync('scripts/prancheta/sql/essenciais-base-referencia.sql', 'utf8'))
  await db.exec(readFileSync('supabase/migrations/20261028193311_prancheta_produtos_essenciais.sql', 'utf8'))
  await db.exec(`CREATE OR REPLACE FUNCTION atendimento_presencial_fluxo_v2_habilitado() RETURNS boolean LANGUAGE sql AS $$SELECT true$$;
    CREATE OR REPLACE FUNCTION atendimento_presencial_criancas_habilitado() RETURNS boolean LANGUAGE sql AS $$SELECT true$$;`)
  const base = { versaoFluxo: 2, tipoAtendimento: 'cliente', versaoProdutos: 2, consultoraNome: 'ANA', departamentos: ['moveis'], produtosInteresse: [], motivosResultado: [], resultadoAtendimento: 'sim', etapaAtual: 'ficha', criancas: [] }
  const nova = { id: 'bebe-teste', situacao: 'gestacao', nome: 'BEBE', parentesco: 'Mãe' }
  let numero = 500
  async function criar(dados, unidadeId = unidade, usuarioId = usuario) {
    const id = `20000000-0000-4000-8000-${String(numero++).padStart(12, '0')}`
    await q(`INSERT INTO atendimento_presencial_atendimentos(id,cliente_id,consultora_usuario_id,unidade_id,dados_rascunho,iniciado_em,criado_por,atualizado_por) VALUES($1,$2,$3,$4,$5,'2026-10-28T12:00:00Z',$3,$3)`, [id, cliente, usuarioId, unidadeId, dados])
    return id
  }
  const concluir = id => q('select * from atendimento_presencial_concluir($1,1,$2,22,null,null)', [id, usuario])
  const dados = (crianca, respostas) => ({ ...base, versaoEssenciais: 1, criancas: [crianca], essenciais: { [crianca.id]: respostas } })
  await assert.rejects(criar(dados(nova, {})), /essenciais_nao_ativados/); checks++
  const legado = await criar(base)
  await concluir(legado)
  ok((await q('select count(*)::int n from atendimento_presencial_essenciais_snapshots')).rows[0].n === 0)
  await db.exec('UPDATE atendimento_presencial_essenciais_config SET ativo=true')
  const lista = (await q('select atendimento_presencial_essenciais_produtos(-1) p')).rows[0].p
  ok(lista.length === 12)
  for (const [fase, qtd] of [[0,3],[3,3],[4,2],[8,2],[9,3],[12,3],[13,0]]) ok((await q('select cardinality(atendimento_presencial_essenciais_produtos($1)) n',[fase])).rows[0].n === qtd)
  const pendente = await criar(dados(nova, {}))
  await falha('select * from atendimento_presencial_concluir($1,1,$2,22,null,null)', [pendente, usuario], 'essenciais_pendentes')
  ok((await q('select status from atendimento_presencial_atendimentos where id=$1',[pendente])).rows[0].status === 'rascunho')
  ok((await q('select count(*)::int n from atendimento_presencial_criancas_cadastro')).rows[0].n === 0)
  const a = await criar(dados(nova, Object.fromEntries(lista.map(p => [p, p === 'banheira' ? 'nao' : 'sim']))))
  await concluir(a)
  const permanente = (await q('select crianca_permanente_id id from atendimento_presencial_criancas where atendimento_id=$1',[a])).rows[0].id
  ok(!!permanente)
  ok((await q('select count(*)::int n from atendimento_presencial_essenciais_eventos where atendimento_id=$1',[a])).rows[0].n === 12)
  const nascido = { ...nova, situacao: 'ja_nasceu', idadeUnidade: 'meses', idadeValor: 0, dataReferenciaNascimento: '2026-10-01', criancaPermanenteId: permanente, vinculoClienteId: cliente }
  const b = await criar(dados(nascido, {}))
  await falha('select * from atendimento_presencial_concluir($1,1,$2,22,null,null)', [b, usuario], 'essenciais_pendentes')
  // Reconfirma o Não diretamente, preservando Sim herdado e o produto entre fases.
  await q('update atendimento_presencial_atendimentos set dados_rascunho=$2 where id=$1',[b,dados(nascido,{ banheira:'nao' })])
  await q('select * from atendimento_presencial_concluir($1,2,$2,22,null,null)',[b,usuario])
  const snapshotB = (await q('select respostas from atendimento_presencial_essenciais_snapshots where atendimento_id=$1',[b])).rows[0].respostas
  ok(snapshotB.find(p=>p.produto==='coleito').resposta === 'sim')
  ok(snapshotB.find(p=>p.produto==='coleito').confirmada === false)
  ok(snapshotB.find(p=>p.produto==='banheira').confirmada === true)
  ok((await q("select to_char(data_referencia_nascimento,'YYYY-MM-DD') referencia from atendimento_presencial_criancas where atendimento_id=$1",[b])).rows[0].referencia === '2026-10-01')
  ok((await q('select anterior,resposta from atendimento_presencial_essenciais_eventos where atendimento_id=$1',[b])).rows[0].anterior === 'nao')
  const c = await criar(dados(nascido, { banheira:'sim' }))
  await concluir(c)
  const d = await criar(dados(nascido, { banheira:'nao' }))
  await concluir(d)
  ok((await q("select resposta from atendimento_presencial_essenciais_estado where crianca_id=$1 and produto='banheira'",[permanente])).rows[0].resposta === 'nao')
  ok((await q('select respostas from atendimento_presencial_essenciais_snapshots where atendimento_id=$1',[c])).rows[0].respostas.find(p=>p.produto==='banheira').resposta === 'sim')
  await falha('select * from atendimento_presencial_concluir($1,1,$2,22,null,null)',[d,usuario],'atendimento_not_draft')
  const desconhecida = await criar(dados({ ...nova, situacao:'nao_informado' },{}))
  await falha('select * from atendimento_presencial_concluir($1,1,$2,22,null,null)',[desconhecida,usuario],'essenciais_fase_obrigatoria')
  const maior = await criar(dados({ ...nascido, idadeValor:2, idadeUnidade:'anos', dataReferenciaNascimento:'2024-10-01' },{}))
  await concluir(maior)
  ok((await q('select respostas from atendimento_presencial_essenciais_snapshots where atendimento_id=$1',[maior])).rows[0].respostas.length === 0)
  const historico = (await q('select atendimento_presencial_historico_essenciais($1,$2) h',[cliente,usuario])).rows[0].h
  ok(historico.historico.length >= 5)
  ok(historico.historico.some(x=>x.atendimentoId===a && x.fase===-1 && x.respostas.length===12))
  const leitura = await criar(dados(nascido,{}))
  ok((await q('select atendimento_presencial_ler_essenciais($1,$2,$3) r',[leitura,cliente,usuario])).rows[0].r.respostas[permanente].coleito.resposta === 'sim')
  await falha('select atendimento_presencial_ler_essenciais($1,$2,$3)',[leitura,cliente,'10000000-0000-4000-8000-000000009999'],'access_denied')
  await falha('update atendimento_presencial_atendimentos set dados_rascunho=$2 where id=$1',[leitura,base],'essenciais_versao_imutavel')
  await falha('select atendimento_presencial_normalizar_payload_ficha($1,false)',[{ ...dados(nova,{}), essenciais:{ alheia:{coleito:'sim'} } }],'essenciais_crianca_invalida')
  await falha('select atendimento_presencial_normalizar_payload_ficha($1,false)',[dados(nova,{inventado:'sim'})],'essenciais_resposta_invalida')
  // Uma falha na segunda criança reverte também o estado e a evidência da primeira.
  const antes = (await q("select md5(string_agg(row_to_json(e)::text,'' order by crianca_id,produto)) hash from atendimento_presencial_essenciais_estado e")).rows[0].hash
  const duas = await criar({ ...dados(nascido,{banheira:'sim'}), criancas:[nascido,{id:'outra-crianca',situacao:'nao_informado',parentesco:'Neta'}] })
  await falha('select * from atendimento_presencial_concluir($1,1,$2,22,null,null)',[duas,usuario],'essenciais_fase_obrigatoria')
  ok((await q("select md5(string_agg(row_to_json(e)::text,'' order by crianca_id,produto)) hash from atendimento_presencial_essenciais_estado e")).rows[0].hash === antes)
  ok((await q('select count(*)::int n from atendimento_presencial_essenciais_snapshots where atendimento_id=$1',[duas])).rows[0].n === 0)
  // Outra filial recebe apenas o resumo de essenciais, sem liberar o detalhe operacional.
  const leitor='10000000-0000-4000-8000-000000009001', filial='10000000-0000-4000-8000-000000009002', modulo='10000000-0000-4000-8000-000000009003'
  await q("insert into usuarios_permitidos values($1,'user',true)",[leitor])
  await q("insert into app_unidades(id,ativo,nome) values($1,true,'Outra filial')",[filial])
  await q('insert into app_usuarios_unidades values($1,$2)',[leitor,filial])
  await q("insert into app_modulos values($1,'atendimento_presencial_clientes',true,false,false)",[modulo])
  await q('insert into app_permissoes_usuario values($1,$2,true)',[modulo,leitor])
  const compartilhado=(await q('select atendimento_presencial_historico_essenciais($1,$2) h',[cliente,leitor])).rows[0].h.historico
  ok(compartilhado.some(x=>x.atendimentoId===a))
  ok(!('observacoes' in compartilhado[0]) && !('dadosRascunho' in compartilhado[0]))
  await falha('select atendimento_presencial_ler_essenciais($1,$2,$3)',[leitura,cliente,leitor],'access_denied')
  await q('update usuarios_permitidos set ativo=false where id=$1',[leitor])
  await falha('select atendimento_presencial_historico_essenciais($1,$2)',[cliente,leitor],'access_denied')
  const acl = (await q("select has_function_privilege('anon','atendimento_presencial_ler_essenciais(uuid,uuid,uuid)','EXECUTE') a, has_table_privilege('authenticated','atendimento_presencial_essenciais_estado','SELECT') t,has_function_privilege('service_role','atendimento_presencial_ler_essenciais(uuid,uuid,uuid)','EXECUTE') s")).rows[0]
  ok(!acl.a && !acl.t && acl.s)
  mkdirSync('output/essenciais-integracao',{recursive:true})
  writeFileSync('output/essenciais-integracao/sql-resultado.json',JSON.stringify({checks,isolado:true,migrationRemota:false},null,2))
  console.log(`${checks} verificações de integração em PostgreSQL isolado aprovadas.`)
} finally { await db.close() }
