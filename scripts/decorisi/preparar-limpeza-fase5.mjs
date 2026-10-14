// Gera SQL revisável por IDs comprovados. Não executa exclusões nem DDL.
import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import nextEnv from '@next/env'
import { createClient } from '@supabase/supabase-js'
nextEnv.loadEnvConfig(process.cwd())
const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}})
const uuid=/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/
const quote=v=>{assert.match(v,uuid);return `'${v}'`}
let sql='begin;\n'
for(const arquivo of process.argv.slice(2)) {
  assert.match(arquivo,/^output\/decorisi-fase5-[a-f0-9]{8}\.json$/)
  const m=JSON.parse(await readFile(arquivo,'utf8'));assert.match(m.marcador,/^TESTE DECORISI F5 [a-f0-9]{8}$/)
  assert.equal(m.usuario,'d8dc1209-20bb-40ec-ada3-668880ccff36')
  m.historico=[]
  for(const p of m.pedidos) {
    const r=await db.from('pedidos_personalizados_pedidos').select('id,cliente,created_by,idempotency_key').eq('id',p.id).single();assert.equal(r.error,null)
    assert.equal(r.data.cliente,m.marcador);assert.equal(r.data.created_by,m.usuario);assert.equal(r.data.idempotency_key,p.key)
    const itens=await db.from('pedidos_personalizados_decorisi_itens').select('id').eq('pedido_id',p.id);assert.equal(itens.error,null)
    const itemIds=itens.data.map(i=>i.id);assert.ok(itemIds.every(id=>m.itens.includes(id)))
    const anexos=await db.from('pedidos_personalizados_decorisi_anexos').select('id,path').in('item_id',itemIds);assert.equal(anexos.error,null)
    assert.ok(anexos.data.every(a=>m.caminhos.includes(a.path)))
    const historico=await db.from('pedidos_personalizados_status_historico').select('id').eq('pedido_id',p.id);assert.equal(historico.error,null)
    m.historico.push(...historico.data.map(h=>h.id))
    const id=quote(p.id)
    sql+=`do $$ begin if not exists(select 1 from public.pedidos_personalizados_pedidos where id=${id} and cliente='${m.marcador}' and created_by=${quote(m.usuario)} and idempotency_key=${quote(p.key)}) then raise exception 'FIXTURE_DIVERGENTE'; end if; end $$;\n`
    if(historico.data.length)sql+=`delete from public.pedidos_personalizados_status_historico where pedido_id=${id} and id in (${historico.data.map(h=>quote(h.id)).join(',')});\n`
    sql+=`update public.pedidos_personalizados_pedidos set status='RASCUNHO' where id=${id} and cliente='${m.marcador}';\n`
    if(anexos.data.length)sql+=`delete from public.pedidos_personalizados_decorisi_anexos where id in (${anexos.data.map(a=>quote(a.id)).join(',')}) and item_id in (${itemIds.map(quote).join(',')});\n`
    sql+=`delete from public.pedidos_personalizados_decorisi_itens where pedido_id=${id} and id in (${itemIds.map(quote).join(',')});\ndelete from public.pedidos_personalizados_pedidos where id=${id} and cliente='${m.marcador}';\n`
  }
  await writeFile(arquivo,JSON.stringify(m,null,2))
}
sql+='commit;\n'
await writeFile('output/decorisi-fase5-limpeza-exata.sql',sql)
console.info('SQL de limpeza exata gerado, sem execução.')
