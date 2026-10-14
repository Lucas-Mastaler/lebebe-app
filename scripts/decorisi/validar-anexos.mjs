import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import { abrirPostgresIsolado } from './postgres-isolado.mjs'
import {
  prepararSchemaEquivalente,
  inserirDadosSinteticos,
} from './schema-isolado.mjs'
const pg = await abrirPostgresIsolado()
let testes = 0
async function verificar(nome, fn) {
  await fn()
  testes++
  console.info(`[decorisi/anexos/sql] OK ${nome}`)
}
try {
  const db = await pg.conectar()
  await prepararSchemaEquivalente(db)
  await inserirDadosSinteticos(db)
  for (const n of (
    await readdir(new URL('../../supabase/migrations/', import.meta.url))
  )
    .filter((n) => /_decorisi_.*\.sql$/.test(n))
    .sort())
    await db.query(
      await readFile(
        new URL(`../../supabase/migrations/${n}`, import.meta.url),
        'utf8',
      ),
    )
  await db.query(
    "update pedidos_personalizados_fornecedores set disponivel=true where chave='decorisi'",
  )
  const usuario = '10000000-0000-4000-8000-000000000001',
    unidade = '20000000-0000-4000-8000-000000000001'
  const itens = [
    {
      id: crypto.randomUUID(),
      tipo: 'PAINEL',
      classificacao: 'PERSONALIZADO',
      descricao: 'Arte sintética',
      medidas: [{ larguraCm: 101, alturaCm: 101 }],
    },
    {
      id: crypto.randomUUID(),
      tipo: 'PAPEL',
      classificacao: 'CATALOGO',
      referencia: 'DB701',
      medidas: [],
    },
  ]
  const p = (
    await db.query(
      'select criar_pedido_personalizado_decorisi($1,$2,$3,$4,$5,$6,$7) r',
      [
        usuario,
        crypto.randomUUID(),
        unidade,
        'Teste',
        'Sintético',
        '41999999999',
        JSON.stringify(itens),
      ],
    )
  ).rows[0].r
  let version = 1
  const anexo = crypto.randomUUID()
  let dados = {
    id: anexo,
    slot: 5,
    caminho_objeto: `${p.pedidoId}/${itens[0].id}/${anexo}/${crypto.randomUUID()}.pdf`,
    nome_original: 'arte.pdf',
    mime_type: 'application/pdf',
    tamanho_bytes: 12,
    arquivo_sha256: 'a'.repeat(64),
    substituir: false,
  }
  async function rpc(
    op,
    d = dados,
    v = version,
    user = usuario,
    item = itens[0].id,
  ) {
    return (
      await db.query(`select decorisi_${op}_anexo($1,$2,$3,$4,$5) r`, [
        p.pedidoId,
        item,
        user,
        v,
        JSON.stringify(d),
      ])
    ).rows[0].r
  }
  async function pendente(path) {
    return (
      await db.query(
        'select * from pedidos_personalizados_storage_pendencias where caminho_objeto=$1 and processado_em is null',
        [path],
      )
    ).rows
  }
  await verificar(
    'preparação durável, replay da reserva e nenhuma versão alterada antes do upload',
    async () => {
      await rpc('preparar')
      await rpc('preparar')
      assert.equal((await pendente(dados.caminho_objeto)).length, 1)
      assert.equal(
        (
          await db.query(
            'select version from pedidos_personalizados_pedidos where id=$1',
            [p.pedidoId],
          )
        ).rows[0].version,
        1,
      )
    },
  )
  await verificar(
    'registro cancela compensação atomicamente; replay não duplica nem altera versão',
    async () => {
      assert.equal((await rpc('registrar')).version, 2)
      version = 2
      assert.equal((await pendente(dados.caminho_objeto)).length, 0)
      const r = await rpc('registrar', dados, 1)
      assert.equal(r.reutilizado, true)
      assert.equal(r.version, 2)
      await assert.rejects(
        rpc('preparar', { ...dados, arquivo_sha256: 'b'.repeat(64) }, 1),
        /IDEMPOTENCY_PAYLOAD_DIVERGENTE/,
      )
    },
  )
  await verificar(
    'autorização, item fora do pedido, versão antiga, slot 6, path e limite de tamanho',
    async () => {
      const novo = { ...dados, id: crypto.randomUUID(), substituir: false }
      await assert.rejects(
        rpc('preparar', dados, version, '10000000-0000-4000-8000-000000000002'),
        /ACESSO_NEGADO/,
      )
      await assert.rejects(
        rpc('preparar', dados, version, usuario, crypto.randomUUID()),
        /ITEM_DECORISI_INVALIDO/,
      )
      for (const invalido of [
        { ...dados, slot: 6 },
        { ...dados, tamanho_bytes: 10485761 },
        { ...dados, caminho_objeto: 'outro.pdf' },
      ])
        await assert.rejects(
          rpc('preparar', invalido),
          /ANEXO_DECORISI_INVALIDO/,
        )
      await assert.rejects(
        rpc(
          'preparar',
          {
            ...novo,
            caminho_objeto: `${p.pedidoId}/${itens[0].id}/${novo.id}/${crypto.randomUUID()}.pdf`,
          },
          1,
        ),
        /CONFLITO_VERSAO/,
      )
    },
  )
  await verificar(
    'substituição preserva ID, agenda somente arquivo antigo e invalida cotação',
    async () => {
      const antigo = dados.caminho_objeto
      dados = {
        ...dados,
        caminho_objeto: `${p.pedidoId}/${itens[0].id}/${anexo}/${crypto.randomUUID()}.pdf`,
        arquivo_sha256: 'b'.repeat(64),
        substituir: true,
      }
      await rpc('preparar')
      assert.equal((await rpc('registrar')).version, 3)
      version = 3
      assert.equal((await pendente(antigo)).length, 1)
      assert.equal((await pendente(dados.caminho_objeto)).length, 0)
      assert.equal(
        (
          await db.query(
            'select id from pedidos_personalizados_decorisi_anexos where item_id=$1',
            [itens[0].id],
          )
        ).rows[0].id,
        anexo,
      )
    },
  )
  await verificar(
    'edição mantém anexos; remoção de produto agenda arquivo e retorna versão real',
    async () => {
      let r = (
        await db.query(
          'select atualizar_pedido_personalizado_decorisi($1,$2,$3,$4) r',
          [p.pedidoId, usuario, version, JSON.stringify(itens)],
        )
      ).rows[0].r
      assert.equal(r.version, 4)
      version = 4
      assert.equal(
        (
          await db.query(
            'select count(*)::int n from pedidos_personalizados_decorisi_anexos where item_id=$1',
            [itens[0].id],
          )
        ).rows[0].n,
        1,
      )
      r = (
        await db.query(
          'select atualizar_pedido_personalizado_decorisi($1,$2,$3,$4) r',
          [p.pedidoId, usuario, version, JSON.stringify([itens[1]])],
        )
      ).rows[0].r
      assert.equal(r.version, 6)
      assert.equal((await pendente(dados.caminho_objeto)).length, 1)
    },
  )
  await verificar(
    'reserva vencida não pode disputar arquivo com consumidor de limpeza',
    async () => {
      const novo = crypto.randomUUID()
      const d = {
        ...dados,
        id: novo,
        slot: 1,
        substituir: false,
        caminho_objeto: `${p.pedidoId}/${itens[1].id}/${novo}/${crypto.randomUUID()}.pdf`,
      }
      await rpc('preparar', d, 6, usuario, itens[1].id)
      await db.query(
        'update pedidos_personalizados_storage_pendencias set proxima_tentativa_em=now() where caminho_objeto=$1',
        [d.caminho_objeto],
      )
      await assert.rejects(
        rpc('registrar', d, 6, usuario, itens[1].id),
        /RESERVA_ANEXO_EXPIRADA/,
      )
    },
  )
  await verificar(
    'remoção idempotente, rollback de item inválido e ACL das RPCs',
    async () => {
      const aid = crypto.randomUUID()
      const d = {
        ...dados,
        id: aid,
        slot: 2,
        substituir: false,
        caminho_objeto: `${p.pedidoId}/${itens[1].id}/${aid}/${crypto.randomUUID()}.pdf`,
      }
      await rpc('preparar', d, 6, usuario, itens[1].id)
      await rpc('registrar', d, 6, usuario, itens[1].id)
      await assert.rejects(
        db.query('select atualizar_pedido_personalizado_decorisi($1,$2,7,$3)', [
          p.pedidoId,
          usuario,
          JSON.stringify([
            {
              ...itens[0],
              id: crypto.randomUUID(),
              medidas: [{ larguraCm: 0, alturaCm: 1 }],
            },
          ]),
        ]),
      )
      assert.equal((await pendente(d.caminho_objeto)).length, 0)
      assert.equal(
        (
          await db.query(
            'select count(*)::int n from pedidos_personalizados_decorisi_anexos where id=$1',
            [aid],
          )
        ).rows[0].n,
        1,
      )
      const remover = () =>
        db.query('select decorisi_remover_anexo($1,$2,$3,7,$4) r', [
          p.pedidoId,
          itens[1].id,
          usuario,
          aid,
        ])
      assert.equal((await remover()).rows[0].r.version, 8)
      assert.equal((await remover()).rows[0].r.reutilizado, true)
      assert.equal((await pendente(d.caminho_objeto)).length, 1)
      for (const role of ['anon', 'authenticated']) {
        await db.query(`set role ${role}`)
        try {
          await assert.rejects(
            rpc('preparar', d, 8, usuario, itens[1].id),
            /permission denied/,
          )
        } finally {
          await db.query('reset role')
        }
      }
    },
  )
  await verificar(
    'dois registros concorrentes: lock real, conflito e compensação do perdedor',
    async () => {
      const criarDados = (slot) => {
        const id = crypto.randomUUID()
        return {
          ...dados,
          id,
          slot,
          substituir: false,
          caminho_objeto: `${p.pedidoId}/${itens[1].id}/${id}/${crypto.randomUUID()}.pdf`,
        }
      }
      const a = criarDados(1),
        b = criarDados(2)
      await rpc('preparar', a, 8, usuario, itens[1].id)
      await rpc('preparar', b, 8, usuario, itens[1].id)
      const c1 = await pg.conectar(),
        c2 = await pg.conectar()
      const sql = 'select decorisi_registrar_anexo($1,$2,$3,8,$4) r'
      const args = (d) => [p.pedidoId, itens[1].id, usuario, JSON.stringify(d)]
      await c1.query('begin')
      let pendenteB
      try {
        await c1.query(sql, args(a))
        pendenteB = c2.query(sql, args(b)).then(
          (r) => ({ r }),
          (e) => ({ e }),
        )
        let bloqueado = false
        for (let i = 0; i < 100; i++) {
          const r = await db.query(
            'select wait_event_type from pg_stat_activity where pid=$1',
            [c2.processID],
          )
          if (r.rows[0]?.wait_event_type === 'Lock') {
            bloqueado = true
            break
          }
          await new Promise((r) => setTimeout(r, 20))
        }
        assert.equal(
          bloqueado,
          true,
          'segunda conexão deve aguardar lock no cabeçalho',
        )
        await c1.query('commit')
        assert.equal((await pendenteB).e?.code, 'P0003')
        assert.equal((await pendente(a.caminho_objeto)).length, 0)
        assert.equal((await pendente(b.caminho_objeto)).length, 1)
      } finally {
        await c1.query('rollback')
        if (pendenteB) await pendenteB
      }
    },
  )
  console.info(
    `[decorisi/anexos/sql] ${testes} cenários aprovados; nenhum Storage remoto utilizado.`,
  )
} finally {
  await pg.encerrar()
}
