// PostgreSQL/WASM descartável, somente fixtures. Sem conexão remota.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
const { PGlite } = await import(pathToFileURL(process.argv[2]).href)
const db = new PGlite()
try {
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated;
    CREATE TABLE atendimento_presencial_clientes(
      id integer PRIMARY KEY, nome text, telefone_informado text,
      telefone_normalizado text, telefone_normalizado_ddi text,
      origem_consultora_nome text, origem_atendimento_id integer,
      version integer DEFAULT 1, updated_at timestamptz DEFAULT now());
    CREATE TABLE atendimento_presencial_atendimentos(
      id integer PRIMARY KEY, cliente_id integer REFERENCES atendimento_presencial_clientes(id),
      consultora_nome text, dados_rascunho jsonb DEFAULT '{}', version integer DEFAULT 1,
      ultima_atividade_em timestamptz DEFAULT '2026-10-09T12:00Z',
      expira_em timestamptz DEFAULT '2026-10-14T12:00Z', updated_at timestamptz DEFAULT now());
    INSERT INTO atendimento_presencial_clientes(id,nome,telefone_informado,telefone_normalizado,telefone_normalizado_ddi,origem_consultora_nome)
      VALUES(1,'LEGADO','41888888888','41888888888','5541888888888',' Ana  C ');
    INSERT INTO atendimento_presencial_atendimentos(id,cliente_id,consultora_nome,dados_rascunho)
      VALUES(1,1,' Ana  Clara ','{"consultoraNome":" ana  clara ","observacoes":"preservar"}');
    CREATE FUNCTION fixture_touch() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.version=OLD.version+1; NEW.updated_at=now(); RETURN NEW; END $$;
    CREATE TRIGGER touch BEFORE UPDATE ON atendimento_presencial_clientes FOR EACH ROW EXECUTE FUNCTION fixture_touch();
    CREATE TRIGGER touch BEFORE UPDATE ON atendimento_presencial_atendimentos FOR EACH ROW EXECUTE FUNCTION fixture_touch();
    CREATE FUNCTION fixture_origem() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN UPDATE atendimento_presencial_clientes SET origem_atendimento_id=NEW.id WHERE id=NEW.cliente_id; RETURN NEW; END $$;
    CREATE TRIGGER trg_atendimento_presencial_clientes_preencher_origem AFTER INSERT OR UPDATE OF consultora_nome,dados_rascunho ON atendimento_presencial_atendimentos FOR EACH ROW EXECUTE FUNCTION fixture_origem();
  `)
  await db.exec(
    readFileSync(
      'supabase/migrations/20261019145305_prancheta_cadastro_filtros_normalizacao.sql',
      'utf8',
    ),
  )
  const atendimento = (
    await db.query('SELECT * FROM atendimento_presencial_atendimentos')
  ).rows[0]
  assert.equal(atendimento.consultora_nome, 'ANA CLARA')
  assert.equal(atendimento.dados_rascunho.consultoraNome, 'ANA CLARA')
  assert.equal(atendimento.dados_rascunho.observacoes, 'preservar')
  assert.equal(atendimento.expira_em.toISOString(), '2026-10-14T12:00:00.000Z')
  assert.equal(
    atendimento.ultima_atividade_em.toISOString(),
    '2026-10-09T12:00:00.000Z',
  )
  const cliente = (
    await db.query('SELECT * FROM atendimento_presencial_clientes')
  ).rows[0]
  assert.equal(cliente.origem_consultora_nome, 'ANA C')
  assert.equal(cliente.origem_atendimento_id, null)
  assert.equal(cliente.telefone_normalizado, '41888888888')
  await db.exec(
    "UPDATE atendimento_presencial_clientes SET nome='NOME CORRIGIDO' WHERE id=1",
  )
  await db.exec(
    "INSERT INTO atendimento_presencial_clientes(id,nome,telefone_informado,telefone_normalizado,telefone_normalizado_ddi) VALUES(2,'CASO RELATADO','(41) 99646-5656','41996465656','5541996465656')",
  )
  for (const telefone of [
    '10996465656',
    '41896465656',
    '4163334444',
    '419964656567',
  ]) {
    await assert.rejects(
      db.query(
        'UPDATE atendimento_presencial_clientes SET telefone_normalizado=$1,telefone_informado=$1 WHERE id=1',
        [telefone],
      ),
      /telefone_cadastro_formato_brasileiro_invalido/,
    )
  }
  await db.exec(
    "UPDATE atendimento_presencial_clientes SET telefone_normalizado='41999999999', telefone_informado='(41) 99999-9999', telefone_normalizado_ddi='5541999999999' WHERE id=1",
  )
  await db.exec(
    'INSERT INTO atendimento_presencial_atendimentos(id,consultora_nome,dados_rascunho) VALUES(2,\'Ana\',\'{"consultoraNome":" ana "}\')',
  )
  assert.equal(
    (
      await db.query(
        'SELECT consultora_nome FROM atendimento_presencial_atendimentos WHERE id=2',
      )
    ).rows[0].consultora_nome,
    'ANA',
  )
  assert.equal(
    (
      await db.query(
        "SELECT has_function_privilege('anon','atendimento_presencial_validar_telefone_cadastro()','EXECUTE') permitido",
      )
    ).rows[0].permitido,
    false,
  )
  assert.equal(
    (
      await db.query(
        "SELECT tgenabled FROM pg_trigger WHERE tgname='trg_atendimento_presencial_clientes_preencher_origem'",
      )
    ).rows[0].tgenabled,
    'O',
  )
  assert.equal(
    (
      await db.query(
        'SELECT count(*)::int quantidade FROM atendimento_presencial_clientes',
      )
    ).rows[0].quantidade,
    2,
  )
  console.log(
    'SQL aprovado: backfill, vínculos/datas preservados, telefones legados, caso relatado, formatos inválidos, escrita canônica e ACL.',
  )
} finally {
  await db.close()
}
