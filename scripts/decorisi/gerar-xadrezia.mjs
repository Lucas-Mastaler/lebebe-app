// Lê HTML como texto; não executa scripts do fornecedor nem acessa o banco.
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { extrairReferencias } from './extrair-referencias.mjs'

const [htmlPath, migrationPath] = process.argv.slice(2)
assert(htmlPath && /\d{14}_decorisi_catalogo_xadrezia\.sql$/.test(migrationPath ?? ''), 'Informe HTML e migration gerada pela CLI')
assert.equal((await readFile(migrationPath, 'utf8')).trim(), '', 'Nunca sobrescrever uma migration preenchida ou aplicada')
const html = await readFile(htmlPath, 'utf8')
const db = JSON.parse(await readFile(new URL('../../src/lib/pedidos-personalizados/decorisi/referencias-db.json', import.meta.url)))
assert.deepEqual(extrairReferencias(html).map((r) => [r.referencia, Number(r.repeticaoM)]), db.registros.map((r) => [r.referencia, Number(r.repeticaoM)]), 'Fonte DB divergiu: revisar antes de continuar')
const bloco = html.match(/const\s+modeloRepeticoes\s*=\s*(\{[\s\S]*?\});/)?.[1]
const registros = [...bloco.matchAll(/['"](XP\d+)['"]\s*:\s*\{\s*repeticao\s*:\s*(\d+(?:\.\d+)?)/g)]
  .map((m) => ({ referencia: m[1], repeticaoM: m[2] })).sort((a, b) => a.referencia.localeCompare(b.referencia))
assert.equal(registros.length, 132)
assert.equal(new Set(registros.map((r) => r.referencia)).size, 132)
assert.deepEqual(registros.map((r) => r.referencia), Array.from({ length: 132 }, (_, i) => `XP${String(i + 1).padStart(3, '0')}`))
assert(registros.every((r) => /^\d+(?:\.\d{1,2})?$/.test(r.repeticaoM) && Number(r.repeticaoM) >= 0 && Number(r.repeticaoM) < 1000))
assert.equal([...bloco.matchAll(/['"](?:DB|XP)\d+['"]\s*:/g)].length, 222)
assert(html.includes('Math.floor(10 / (altura + repeticao + 0.05))') && html.includes('faixasPorRolo * 0.62'), 'Especificação da calculadora mudou')
const evidencia = { fonte: 'https://decorisi.com.br/#calculadora', extraidoEm: new Date().toISOString(), sha256: createHash('sha256').update(html).digest('hex'), registros }
await writeFile(new URL('../../src/lib/pedidos-personalizados/decorisi/referencias-xp.json', import.meta.url), JSON.stringify(evidencia, null, 2) + '\n')
const valores = registros.map((r) => `('${r.referencia}',${r.repeticaoM})`).join(',\n')
await writeFile(migrationPath, `-- Xadrezia: XP = catálogo confirmado pelo usuário em 2026-10-13.
-- Fonte ${evidencia.fonte}; SHA256 ${evidencia.sha256}.
-- Mesma calculadora DB/XP: rolo 0,62 x 10m, margem 5cm. Sem novos produtos/preços.
-- Incremental: preserva IDs/valores DB, pedidos, FKs, funções, triggers, grants e RLS.
set local lock_timeout = '5s';
set local statement_timeout = '30s';
do $$ begin
  if (select count(*) from public.pedidos_personalizados_fornecedores where chave='decorisi') <> 1 then
    raise exception 'FORNECEDOR_DECORISI_DIVERGENTE';
  end if;
  if (select count(*) from public.pedidos_personalizados_decorisi_referencias where referencia like 'DB%') <> 90
     or exists(select 1 from public.pedidos_personalizados_decorisi_referencias where referencia like 'XP%') then
    raise exception 'CATALOGO_DECORISI_DIVERGENTE';
  end if;
end $$;
alter table public.pedidos_personalizados_decorisi_referencias
  drop constraint pedidos_personalizados_decorisi_referencias_referencia_check,
  add constraint pedidos_personalizados_decorisi_referencias_referencia_check
  check (referencia ~ '^(DB[78](0[1-9]|[1-3][0-9]|4[0-5])|XP(00[1-9]|0[1-9][0-9]|1[0-2][0-9]|13[0-2]))$');
insert into public.pedidos_personalizados_decorisi_referencias
  (fornecedor_id,referencia,repeticao_m,fonte,fonte_sha256,extraido_em)
select f.id,v.referencia,v.repeticao_m,'${evidencia.fonte}','${evidencia.sha256}','${evidencia.extraidoEm}'::timestamptz
from public.pedidos_personalizados_fornecedores f cross join (values
${valores}
) v(referencia,repeticao_m) where f.chave='decorisi';
do $$ begin
  if (select count(*) from public.pedidos_personalizados_decorisi_referencias where referencia like 'XP%') <> 132 then
    raise exception 'IMPORTACAO_XADREZIA_INCOMPLETA';
  end if;
end $$;
`)
console.info(JSON.stringify({ dbPreservados: 90, xp: registros.length, sha256: evidencia.sha256, migrationPath }))
