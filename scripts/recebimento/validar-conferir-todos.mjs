// Isolated PostgreSQL test. No Supabase project, credentials or real data.
// node scripts/recebimento/validar-conferir-todos.mjs <path-to-pglite-module>
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'

const modulo = await import(pathToFileURL(resolve(process.argv[2])).href)
const native = process.argv[3] === '--native'
const Client = modulo.Client ?? modulo.default?.Client
// Native mode connects only to the disposable local cluster started by the test.
const port = Number(process.argv[4] ?? 55439)
assert.ok(Number.isInteger(port) && port >= 1024 && port <= 65535)
const config = { host: '127.0.0.1', port, user: 'postgres', database: 'postgres', connectionTimeoutMillis: 5000 }
const client = native ? new Client(config) : null
if (client) await client.connect()
const db = client ? {
  exec: sql => client.query(sql),
  query: (sql, params) => client.query(sql, params),
  close: () => client.end(),
} : new modulo.PGlite()
let testes = 0
const rec = '10000000-0000-4000-8000-000000000001'
const outro = '10000000-0000-4000-8000-000000000002'
const item = '20000000-0000-4000-8000-000000000001'
const sql = await readFile(new URL('../../supabase/migrations/20261103125021_recebimento_conferir_todos.sql', import.meta.url), 'utf8')

try {
  await db.exec(`
    create role anon; create role authenticated;
    create table public.recebimentos(id uuid primary key, status text not null);
    create table public.recebimento_itens(
      id uuid primary key, recebimento_id uuid not null references public.recebimentos(id),
      volumes_por_item integer not null, volumes_previstos_total integer not null,
      volumes_recebidos_total integer not null, divergencia_tipo text,
      divergencia_obs text, avaria_foto_url text
    );
    create table public.recebimento_item_volumes(
      id uuid primary key default gen_random_uuid(),
      recebimento_item_id uuid not null references public.recebimento_itens(id),
      volume_numero integer not null, qtd_prevista integer not null, qtd_recebida integer not null,
      unique(recebimento_item_id, volume_numero)
    );
    create function public.is_matic_user() returns boolean language sql stable as
      $$ select coalesce(current_setting('test.matic_user', true), 'false') = 'true' $$;
    grant usage on schema public to authenticated, anon;
    grant select, update on public.recebimentos, public.recebimento_itens, public.recebimento_item_volumes to authenticated;
    alter table public.recebimentos enable row level security;
    alter table public.recebimento_itens enable row level security;
    alter table public.recebimento_item_volumes enable row level security;
    create policy matic on public.recebimentos using(public.is_matic_user()) with check(public.is_matic_user());
    create policy matic on public.recebimento_itens using(public.is_matic_user()) with check(public.is_matic_user());
    create policy matic on public.recebimento_item_volumes using(public.is_matic_user()) with check(public.is_matic_user());
  `)
  await db.exec(sql)

  async function reset({ quantidade = 10, volumes = 3, recebidos = [0, 0, 0], status = 'aberto' } = {}) {
    await db.exec(`reset role; truncate public.recebimento_item_volumes, public.recebimento_itens, public.recebimentos cascade`)
    await db.query('insert into public.recebimentos values ($1,$2),($3,$2)', [rec, status, outro])
    await db.query(`insert into public.recebimento_itens values($1,$2,$3,$4,$5,'avaria','Observação preservada','foto-teste')`,
      [item, rec, volumes, quantidade * volumes, recebidos.reduce((a, b) => a + b, 0)])
    for (let i = 1; i <= volumes; i++) {
      await db.query(`insert into public.recebimento_item_volumes(recebimento_item_id,volume_numero,qtd_prevista,qtd_recebida) values($1,$2,$3,$4)`,
        [item, i, quantidade, recebidos[i - 1] ?? 0])
    }
    await db.exec(`set role authenticated; set test.matic_user = 'true'`)
  }
  async function call(volume = null, delta = null, id = rec) {
    const res = await db.query('select public.conferir_recebimento_item($1,$2,$3,$4) as resultado', [id, item, volume, delta])
    return res.rows[0].resultado
  }
  async function total() {
    return (await db.query('select volumes_recebidos_total from public.recebimento_itens where id=$1', [item])).rows[0].volumes_recebidos_total
  }
  async function test(nome, fn) {
    await fn()
    testes++
    console.log(`OK ${nome}`)
  }
  async function rejeita(code, fn = () => call()) {
    await assert.rejects(fn, err => err.code === code)
  }

  for (const recebidos of [[0, 0, 0], [2, 5, 9], [10, 10, 10]]) {
    await test(`10 unidades × 3 volumes, inicial ${recebidos}`, async () => {
      await reset({ recebidos })
      const r = await call()
      assert.equal(r.item_total_recebido, 30)
      assert.equal(r.item_status, 'concluido')
      assert.deepEqual(r.volumes.map(v => v.qtd_recebida), [10, 10, 10])
      assert.equal(await total(), 30)
      assert.deepEqual(await call(), r) // Idempotence.
      const row = (await db.query('select divergencia_tipo,divergencia_obs,avaria_foto_url from public.recebimento_itens')).rows[0]
      assert.deepEqual(row, { divergencia_tipo: 'avaria', divergencia_obs: 'Observação preservada', avaria_foto_url: 'foto-teste' })
    })
  }
  await test('um volume e ajuste individual após conferência completa', async () => {
    await reset({ quantidade: 7, volumes: 1, recebidos: [2] })
    assert.equal((await call()).item_total_recebido, 7)
    assert.equal((await call(1, -1)).item_total_recebido, 6)
    assert.equal((await call(1, 1)).item_total_recebido, 7)
    await rejeita('PT400', () => call(1, 1))
  })
  await test('quantidade agrupada usa configuração do item, não quantidade de uma NF', async () => {
    await reset({ quantidade: 17, volumes: 2 })
    const r = await call()
    assert.equal(r.item_total_recebido, 34)
    assert.deepEqual(r.volumes.map(v => v.qtd_recebida), [17, 17])
    const soma = (await db.query('select sum(qtd_recebida)::int as soma from public.recebimento_item_volumes')).rows[0].soma
    assert.equal(soma, await total()) // Same source used by recalculation/finalization.
  })
  for (const status of ['fechado', 'cancelado']) {
    await test(`rejeita recebimento ${status}`, async () => {
      await reset({ status }); await rejeita('PT409'); assert.equal(await total(), 0)
    })
  }
  await test('rejeita produto de outro recebimento', async () => {
    await reset(); await rejeita('PT404', () => call(null, null, outro)); assert.equal(await total(), 0)
  })
  await test('rejeita usuário sem acesso mesmo em chamada direta à função', async () => {
    await reset(); await db.exec(`set test.matic_user = 'false'`); await rejeita('PT403')
  })
  await test('anon não tem EXECUTE e função é SECURITY INVOKER', async () => {
    await reset(); await db.exec('reset role; set role anon'); await rejeita('42501')
    await db.exec('reset role')
    const fn = (await db.query(`select prosecdef from pg_proc where oid='public.conferir_recebimento_item(uuid,uuid,integer,integer)'::regprocedure`)).rows[0]
    assert.equal(fn.prosecdef, false)
  })
  const invalidos = [
    ['volume ausente', 'delete from public.recebimento_item_volumes where volume_numero=2'],
    ['numeração incorreta', 'update public.recebimento_item_volumes set volume_numero=4 where volume_numero=3'],
    ['quantidade prevista divergente', 'update public.recebimento_item_volumes set qtd_prevista=9 where volume_numero=2'],
    ['quantidade recebida acima do limite', 'update public.recebimento_item_volumes set qtd_recebida=11 where volume_numero=2'],
    ['quantidade recebida negativa', 'update public.recebimento_item_volumes set qtd_recebida=-1 where volume_numero=2'],
    ['total previsto inconsistente', 'update public.recebimento_itens set volumes_previstos_total=29'],
    ['nenhum volume', 'delete from public.recebimento_item_volumes'],
    ['volume por item zero', 'update public.recebimento_itens set volumes_por_item=0'],
  ]
  for (const [nome, comando] of invalidos) {
    await test(`bloqueia ${nome} sem gravação parcial`, async () => {
      await reset(); await db.exec(`reset role; ${comando}; set role authenticated`)
      await rejeita('PT422'); assert.equal(await total(), 0)
    })
  }
  await test('rollback dos volumes se atualizar o total falhar', async () => {
    await reset({ recebidos: [2, 5, 9] })
    await db.exec(`reset role;
      create function public.falha_teste() returns trigger language plpgsql as $$ begin raise exception 'falha injetada'; end $$;
      create trigger falha_teste before update on public.recebimento_itens for each row execute function public.falha_teste();
      set role authenticated`)
    await rejeita('P0001')
    assert.equal(await total(), 16)
    const rows = (await db.query('select qtd_recebida from public.recebimento_item_volumes order by volume_numero')).rows
    assert.deepEqual(rows.map(v => v.qtd_recebida), [2, 5, 9])
    await db.exec('reset role; drop trigger falha_teste on public.recebimento_itens; drop function public.falha_teste()')
  })
  await test('delta inválido, volume ausente e limite inferior', async () => {
    await reset()
    await rejeita('PT400', () => call(1, -1))
    await rejeita('PT400', () => call(1, 2))
    await rejeita('PT400', () => call(null, 1))
    await rejeita('PT404', () => call(4, 1))
  })
  if (native) {
    async function concorrente(primeira, segunda) {
      const outroClient = new Client(config)
      await outroClient.connect()
      try {
        await outroClient.query(`set role authenticated; set test.matic_user = 'true'`)
        await db.exec('begin')
        await primeira()
        // Monitor as the owner of this disposable cluster; the RPC above and
        // the competing connection still execute with authenticated + RLS.
        await db.exec('reset role')
        let terminou = false
        const esperando = outroClient.query('select public.conferir_recebimento_item($1,$2,$3,$4) as resultado',
          [rec, item, ...segunda]).then(r => { terminou = true; return r.rows[0].resultado })
        // Observe PostgreSQL's actual lock wait, not a timing-only assertion.
        let bloqueado = false
        for (let tentativa = 0; tentativa < 100; tentativa++) {
          const locks = await db.query(`select count(*)::int as n from pg_stat_activity where pid=$1 and wait_event_type='Lock'`, [outroClient.processID])
          if (locks.rows[0].n > 0) { bloqueado = true; break }
          await new Promise(resolve => setTimeout(resolve, 10))
        }
        assert.equal(bloqueado, true, 'segunda conexão deve aguardar o bloqueio da primeira')
        assert.equal(terminou, false)
        await db.exec('set role authenticated')
        await db.exec('commit')
        return await esperando
      } finally {
        await db.exec('rollback')
        await outroClient.end()
      }
    }
    await test('duas conexões: conferir todos seguido de -1 aguarda lock e termina em 29', async () => {
      await reset()
      const r = await concorrente(() => call(), [1, -1])
      assert.equal(r.item_total_recebido, 29)
      assert.equal(await total(), 29)
    })
    await test('duas conexões: +1 seguido de conferir todos aguarda lock e termina em 30', async () => {
      await reset()
      const r = await concorrente(() => call(1, 1), [null, null])
      assert.equal(r.item_total_recebido, 30)
      assert.equal(await total(), 30)
    })
  }
  console.log(`${testes} cenários PostgreSQL aprovados (${native ? 'cluster local descartável, com duas conexões' : 'banco isolado em memória'}).`)
} finally {
  await db.close()
}
