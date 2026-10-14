// Após limpeza relacional exata pelo MCP, consome somente caminhos dos manifestos.
import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import nextEnv from '@next/env'
import { createClient } from '@supabase/supabase-js'
nextEnv.loadEnvConfig(process.cwd())
const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}})
const dir=pathToFileURL(`${process.cwd()}/output/decorisi-consumidor-validacao/`).href
const {limparPendenciasStorage}=await import(`${dir}storage-fila.mjs`)
const {RepositorioAnexos,StorageAnexos}=await import(`${dir}anexos-repositorio.mjs`)
for(const arquivo of process.argv.slice(2)) {
  assert.match(arquivo,/^output\/decorisi-fase5-[a-f0-9]{8}\.json$/)
  const m=JSON.parse(await readFile(arquivo,'utf8'));assert.match(m.marcador,/^TESTE DECORISI F5 [a-f0-9]{8}$/)
  const ids=m.pedidos.map(p=>p.id)
  const pedidos=await db.from('pedidos_personalizados_pedidos').select('id').in('id',ids);assert.equal(pedidos.error,null);assert.equal(pedidos.data.length,0,'Limpar registros pelo MCP antes do Storage.')
  for(const caminho of m.caminhos)assert.ok(ids.some(id=>caminho.startsWith(id+'/')))
  if(m.caminhos.length) {
    const pendentes=await db.from('pedidos_personalizados_storage_pendencias').select('proxima_tentativa_em').in('caminho_objeto',m.caminhos).is('processado_em',null);assert.equal(pendentes.error,null)
    const agora=new Date(Math.max(Date.now(),...pendentes.data.map(p=>Date.parse(p.proxima_tentativa_em)))+1)
    const repo=new RepositorioAnexos(db),original=repo.carregarPendencias.bind(repo)
    repo.carregarPendencias=async data=>{const r=await original(data,10000);return r.error?r:{data:r.data.filter(p=>m.caminhos.includes(p.caminhoObjeto)),error:null}}
    const r=await limparPendenciasStorage(new Request('http://127.0.0.1/limpeza',{method:'POST',headers:{authorization:'Bearer validacao-local'}}),{segredo:()=> 'validacao-local',criarRepositorio:()=>repo,criarStorage:()=>new StorageAnexos(db),agora:()=>agora})
    assert.equal((await r.json()).falhas,0)
    const filas=await db.from('pedidos_personalizados_storage_pendencias').select('id,processado_em').in('caminho_objeto',m.caminhos);assert.equal(filas.error,null);assert.ok(filas.data.every(p=>p.processado_em))
    m.pendencias=filas.data.map(p=>p.id)
    for(const caminho of new Set(m.caminhos)){const r=await db.storage.from('pedidos-personalizados-anexos').download(caminho);assert.ok(r.error)}
    if(m.pendencias.length){const r=await db.from('pedidos_personalizados_storage_pendencias').delete().in('id',m.pendencias).not('processado_em','is',null);assert.equal(r.error,null)}
  }
  const itens=await db.from('pedidos_personalizados_decorisi_itens').select('id').in('pedido_id',ids);assert.equal(itens.error,null);assert.equal(itens.data.length,0)
  const eventos=await db.from('pedidos_personalizados_status_historico').select('id').in('pedido_id',ids);assert.equal(eventos.error,null);assert.equal(eventos.data.length,0)
  m.limpeza=true;m.limpoEm=new Date().toISOString();await writeFile(arquivo,JSON.stringify(m,null,2));console.info(`Limpeza confirmada: ${arquivo}`)
}
