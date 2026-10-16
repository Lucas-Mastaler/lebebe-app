// PostgreSQL/WASM isolado. Nao conecta ao Supabase e nao le credenciais.
// Uso: node scripts/prancheta/validar-entrega2.mjs <caminho-absoluto-pglite/dist/index.js>
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { createHash } from 'node:crypto'

const { PGlite } = await import(pathToFileURL(process.argv[2]).href)
const db = new PGlite()
const migrationPath = 'supabase/migrations/20261015185406_atendimento_presencial_contratos_fluxo_v2.sql'
const migration = readFileSync(migrationPath, 'utf8')
const base = readFileSync('scripts/prancheta/sql/base-entrega2.sql', 'utf8')
const usuario = '10000000-0000-4000-8000-000000000001'
const unidade = '10000000-0000-4000-8000-000000000002'
const cliente = '10000000-0000-4000-8000-000000000003'
let numero = 10
let checks = 0
const query = (sql, params = []) => db.query(sql, params)
async function rejeita(sql, params, mensagem) {
  await assert.rejects(query(sql, params), (error) => error.message.includes(mensagem))
  checks++
}
// Fixture sintetica: somente dependencias utilizadas pelas funcoes capturadas via MCP.
await db.exec(`
  CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
  CREATE TABLE usuarios_permitidos(id uuid primary key, role text, ativo boolean);
  CREATE TABLE app_unidades(id uuid primary key, ativo boolean);
  CREATE TABLE app_perfis_acesso(id uuid, chave text, ativo boolean);
  CREATE TABLE app_usuarios_perfis(usuario_id uuid, perfil_id uuid);
  CREATE TABLE app_usuarios_unidades(usuario_id uuid, unidade_id uuid);
  CREATE TABLE app_modulos(id uuid, chave text, ativo boolean, publico boolean, somente_superadmin boolean);
  CREATE TABLE app_permissoes_usuario(modulo_id uuid, usuario_id uuid, permitido boolean);
  CREATE TABLE app_permissoes_perfil(modulo_id uuid, perfil_id uuid, permitido boolean);
  CREATE TABLE atendimento_presencial_clientes(id uuid primary key, status text);
  CREATE TABLE atendimento_presencial_atendimentos(
    id uuid primary key, cliente_id uuid references atendimento_presencial_clientes(id), consultora_usuario_id uuid,
    unidade_id uuid, status text default 'rascunho', draft_client_id uuid, dados_rascunho jsonb,
    iniciado_em timestamptz default now(), ultima_atividade_em timestamptz default now(), expira_em timestamptz default now()+interval '5 days',
    version integer default 1, criado_por uuid, atualizado_por uuid, created_at timestamptz default now(), updated_at timestamptz default now(),
    resultado_atendimento text, motivo_outro text, observacoes text, numero_lancamento integer,
    concluido_em timestamptz, virada_cartao_dia smallint, virada_cartao_mes smallint, consultora_nome text,
    CONSTRAINT atendimento_presencial_atendimentos_conclusao_check CHECK (
      (status='rascunho' AND concluido_em IS NULL AND resultado_atendimento IS NULL AND motivo_outro IS NULL
        AND observacoes IS NULL AND numero_lancamento IS NULL AND virada_cartao_dia IS NULL AND virada_cartao_mes IS NULL)
      OR (status='concluido' AND cliente_id IS NOT NULL AND resultado_atendimento IS NOT NULL AND concluido_em IS NOT NULL
        AND ((resultado_atendimento='sim' AND numero_lancamento IS NOT NULL)
          OR (resultado_atendimento IN ('nao','negociacao') AND numero_lancamento IS NULL)))));
  CREATE TABLE atendimento_presencial_criancas(atendimento_id uuid, ordem integer, local_id text, situacao text, nome text,
    nome_nao_informado boolean, sexo text, data_prevista_nascimento date, idade_unidade text, idade_valor integer);
  CREATE TABLE atendimento_presencial_departamentos(atendimento_id uuid, departamento text, ordem integer);
  CREATE TABLE atendimento_presencial_produtos_interesse(atendimento_id uuid, descricao text, ordem integer);
  CREATE TABLE atendimento_presencial_motivos(atendimento_id uuid, motivo text, complemento text, ordem integer);
  CREATE TABLE atendimento_presencial_historico(atendimento_id uuid, usuario_id uuid, perfil text, role text, acao text, origem text, snapshot jsonb);
  CREATE FUNCTION atendimento_presencial_atendimentos_touch() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN NEW.version := OLD.version + 1; NEW.updated_at := now(); RETURN NEW; END; $$;
  CREATE TRIGGER touch BEFORE UPDATE ON atendimento_presencial_atendimentos FOR EACH ROW EXECUTE FUNCTION atendimento_presencial_atendimentos_touch();
  INSERT INTO usuarios_permitidos VALUES ('${usuario}','superadmin',true);
  INSERT INTO app_unidades VALUES ('${unidade}',true);
  INSERT INTO atendimento_presencial_clientes VALUES ('${cliente}','ativo');
`)
await db.exec(base)
const legado = { consultoraNome: 'Ana', criancas: [], departamentos: ['moveis'], produtosInteresse: [],
  resultadoAtendimento: 'sim', motivosResultado: ['preco'], etapaAtual: 'revisao' }
const novo = { ...legado, versaoFluxo: 2, tipoAtendimento: 'cliente', motivosResultado: [] }
const visita = { ...novo, tipoAtendimento: 'nao_cliente', motivoVisita: 'outros' }
async function rascunho(dados, clienteId = cliente) {
  const id = `20000000-0000-4000-8000-${String(numero++).padStart(12, '0')}`
  await query(`INSERT INTO atendimento_presencial_atendimentos(id, cliente_id, consultora_usuario_id, unidade_id, dados_rascunho, criado_por, atualizado_por)
    VALUES ($1,$2,$3,$4,$5,$3,$3)`, [id, clienteId, usuario, unidade, dados])
  return id
}
async function row(id) { return (await query('select * from atendimento_presencial_atendimentos where id=$1', [id])).rows[0] }
const concluirSql = 'select * from atendimento_presencial_concluir($1,$2,$3,$4,null)'
async function concluir(id, lancamento = 22, executor = usuario, version = 1) {
  return query(concluirSql, [id, version, executor, lancamento])
}
const antigo = await rascunho(legado)
await concluir(antigo)
const antes = await row(antigo)
const legadoNormalizadoAntes = (await query('select atendimento_presencial_normalizar_payload_ficha($1,false) dados', [legado])).rows[0].dados
await db.exec(migration)
const depois = await row(antigo)
for (const key of Object.keys(antes)) assert.deepEqual(depois[key], antes[key])
assert.equal(depois.versao_fluxo, null)
checks++
// Guardas impedem reaplicacao e preservam o estado.
await assert.rejects(db.exec(migration), /preflight_/)
await db.exec('ROLLBACK')
checks++
for (const role of ['anon', 'authenticated']) {
  for (const fn of ['atendimento_presencial_normalizar_payload_ficha(jsonb,boolean)',
    'atendimento_presencial_concluir(uuid,integer,uuid,integer,text)',
    'atendimento_presencial_editar_concluido(uuid,integer,uuid,jsonb,integer,text)']) {
    const result = await query('select has_function_privilege($1,$2,\'EXECUTE\') permitido', [role, fn])
    assert.equal(result.rows[0].permitido, false)
    checks++
  }
}
const normalizar = async (dados) => (await query('select atendimento_presencial_normalizar_payload_ficha($1,false) dados', [dados])).rows[0].dados
assert.deepEqual(await normalizar(legado), legadoNormalizadoAntes)
checks++
const idBloqueado = await rascunho(visita)
await rejeita(concluirSql, [idBloqueado, 1, usuario, null], 'fluxo_v2_nao_liberado')
assert.equal((await row(idBloqueado)).status, 'rascunho')
// Habilitacao exclusivamente nesta instancia sintetica; artefato de producao continua false.
await db.exec('CREATE OR REPLACE FUNCTION atendimento_presencial_fluxo_v2_habilitado() RETURNS boolean LANGUAGE sql AS $$ SELECT true $$;')
assert.equal((await normalizar(novo)).motivosResultado.length, 0)
assert.equal((await normalizar({ ...novo, motivosResultado: ['outro','virada_cartao'] })).motivoOutro, null)
checks++
for (const motivoVisita of ['entrega_mercadoria','entregador_uber_eats','vendedor_ambulante','pedido_informacao','curriculo_entrevista','panfleto','representante','outros']) {
  const id = await rascunho({ ...visita, motivoVisita, criancas: [{ situacao: 'ja_nasceu' }], motivosResultado: ['outro'] })
  await concluir(id, null)
  const atendimento = await row(id)
  assert.equal(atendimento.cliente_id, null)
  assert.equal(atendimento.resultado_atendimento, null)
  assert.equal(atendimento.numero_lancamento, null)
  assert.equal(atendimento.motivo_visita, motivoVisita)
  for (const tabela of ['criancas','departamentos','produtos_interesse','motivos']) {
    assert.equal((await query(`select count(*)::int n from atendimento_presencial_${tabela} where atendimento_id=$1`, [id])).rows[0].n, 0)
  }
  checks++
}
for (const resultadoAtendimento of ['sim','nao','negociacao']) {
  const dados = { ...novo, resultadoAtendimento, motivosResultado: resultadoAtendimento === 'sim' ? [] : ['preco'], observacaoNaoFechamento: 'x'.repeat(300) }
  const id = await rascunho(dados)
  await concluir(id, resultadoAtendimento === 'sim' ? 22 : null)
  const atendimento = await row(id)
  assert.equal(atendimento.resultado_atendimento, resultadoAtendimento)
  assert.equal(atendimento.observacao_nao_fechamento, resultadoAtendimento === 'sim' ? null : 'x'.repeat(300))
  const alterado = { ...dados, clienteId: cliente, observacoes: 'Edicao sintetica', observacaoNaoFechamento: '' }
  await query('select * from atendimento_presencial_editar_concluido($1,2,$2,$3,$4,null)', [id, usuario, alterado, resultadoAtendimento === 'sim' ? 22 : null])
  assert.equal((await row(id)).observacao_nao_fechamento, null)
  checks++
}
for (const tamanho of [0, 300, 301]) {
  const dados = { ...novo, resultadoAtendimento: 'nao', motivosResultado: ['preco'], observacaoNaoFechamento: 'x'.repeat(tamanho) }
  if (tamanho > 300) await rejeita('select atendimento_presencial_normalizar_payload_ficha($1,false)', [dados], 'observacao_nao_fechamento_invalida')
  else { await normalizar(dados); checks++ }
}
for (const dados of [{ ...novo, versaoFluxo: '2' }, { ...novo, tipoAtendimento: 'x' }, { ...visita, motivoVisita: 'x' },
  { ...visita, motivoVisita: null }, { ...novo, observacaoNaoFechamento: 3 }, { ...legado, tipoAtendimento: 'cliente' },
  { ...novo, resultadoAtendimento: 'nao' }, { ...novo, resultadoAtendimento: 'negociacao' }]) {
  await assert.rejects(normalizar(dados)); checks++
}
const falha = await rascunho(novo)
await rejeita(concluirSql, [falha, 1, usuario, null], 'numero_lancamento_obrigatorio')
await rejeita(concluirSql, [falha, 9, usuario, 22], 'version_conflict')
await rejeita(concluirSql, [falha, 1, '30000000-0000-4000-8000-000000000001', 22], 'executor_invalido')
assert.equal((await row(falha)).status, 'rascunho')
// Falha apos exclusoes/insercoes precisa restaurar tudo (atomicidade da RPC).
await db.exec(`CREATE FUNCTION falhar_historico() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'falha_sintetica'; END; $$;
CREATE TRIGGER falhar BEFORE INSERT ON atendimento_presencial_historico FOR EACH ROW EXECUTE FUNCTION falhar_historico();`)
await rejeita(concluirSql, [falha,1,usuario,22], 'falha_sintetica')
assert.equal((await row(falha)).status, 'rascunho')
assert.equal((await query('select count(*)::int n from atendimento_presencial_departamentos where atendimento_id=$1',[falha])).rows[0].n, 0)
await db.exec('DROP TRIGGER falhar ON atendimento_presencial_historico')
// Executor ativo sem acesso, depois com modulo mas fora da unidade.
const semAcesso = '30000000-0000-4000-8000-000000000002'
await query("insert into usuarios_permitidos values ($1,'user',true)", [semAcesso])
await rejeita(concluirSql, [falha,1,semAcesso,22], 'perfil_executor_invalido')
await db.exec(`INSERT INTO app_modulos VALUES ('${semAcesso}','atendimento_presencial_ficha',true,false,false);
  INSERT INTO app_permissoes_usuario VALUES ('${semAcesso}','${semAcesso}',true);`)
await rejeita(concluirSql, [falha,1,semAcesso,22], 'access_denied')
await query('insert into app_usuarios_unidades values ($1,$2)', [semAcesso, unidade])
await query("update atendimento_presencial_clientes set status='inativo' where id=$1", [cliente])
await rejeita(concluirSql, [falha,1,usuario,22], 'cliente_inativa')
await query("update atendimento_presencial_clientes set status='ativo' where id=$1", [cliente])
const semCliente = await rascunho(novo, null)
await rejeita(concluirSql,[semCliente,1,usuario,22],'cliente_obrigatoria')
// Visita pode ser editada sem cliente, com historico dos novos campos.
const visitaEditada = await rascunho(visita, null)
await concluir(visitaEditada, null)
await query('select * from atendimento_presencial_editar_concluido($1,2,$2,$3,null,null)',
  [visitaEditada,usuario,{ ...visita, motivoVisita: 'representante' }])
assert.equal((await row(visitaEditada)).motivo_visita, 'representante')
const historicoVisita = (await query("select snapshot from atendimento_presencial_historico where atendimento_id=$1 and acao='editado_concluido'",[visitaEditada])).rows[0].snapshot
assert.equal(historicoVisita.motivoVisitaNovo,'representante')
await rejeita('select * from atendimento_presencial_editar_concluido($1,3,$2,$3,null,null)',
  [visitaEditada,semAcesso,visita],'access_denied')
checks++
// Registros legados continuam editaveis, sem promover versao.
await query('select * from atendimento_presencial_editar_concluido($1,2,$2,$3,22,null)',
  [antigo,usuario,{ ...legado, clienteId: cliente, observacoes: 'Legado editado' }])
assert.equal((await row(antigo)).versao_fluxo, null)
checks++
const v2final = await rascunho(novo)
await concluir(v2final)
await rejeita('select * from atendimento_presencial_editar_concluido($1,2,$2,$3,22,null)',
  [v2final,usuario,{ ...legado, clienteId: cliente }], 'versao_fluxo_imutavel')
await db.exec('CREATE OR REPLACE FUNCTION atendimento_presencial_fluxo_v2_habilitado() RETURNS boolean LANGUAGE sql AS $$ SELECT false $$;')
await rejeita('update atendimento_presencial_atendimentos set versao_fluxo=null, tipo_atendimento=null where id=$1', [v2final], 'fluxo_v2_nao_liberado')
// Recuperacao conserva colunas/dados e restaura as tres funcoes capturadas.
await db.exec(readFileSync('scripts/prancheta/sql/recuperar-entrega2.sql','utf8'))
for (const match of base.matchAll(/CREATE OR REPLACE FUNCTION public\.(\w+)\([\s\S]*?AS \$function\$([\s\S]*?)\$function\$/g)) {
  const hash = createHash('md5').update(match[2].replace(/\r\n/g,'\n')).digest('hex')
  const result = await query('select md5(replace(prosrc,E\'\\r\\n\',E\'\\n\')) hash from pg_proc where proname=$1', [match[1]])
  assert.equal(result.rows[0].hash, hash)
  checks++
}
assert.equal((await row(v2final)).versao_fluxo, 2)
await rejeita('update atendimento_presencial_atendimentos set consultora_nome=\'Bia\' where id=$1',[v2final],'fluxo_v2_nao_liberado')
await db.close()
console.log(`Entrega 2: ${checks} verificacoes SQL aprovadas em PostgreSQL isolado; nenhuma conexao externa.`)
