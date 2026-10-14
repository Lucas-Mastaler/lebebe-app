// Execução manual autorizada: localhost + Supabase atual. Nunca integra a suíte automática.
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { writeFile, readFile, mkdir } from 'node:fs/promises'
import nextEnv from '@next/env'
import { createClient } from '@supabase/supabase-js'
import ts from 'typescript'

nextEnv.loadEnvConfig(process.cwd())
assert.equal(process.env.DECORISI_VALIDACAO_REAL_AUTORIZADA, '2026-10-09')
const base = 'http://127.0.0.1:3014'
assert.equal(new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname, 'phsoawbdvhurroryfnok.supabase.co')
const service = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } })
const marker = `TESTE DECORISI ${randomUUID().slice(0, 8)}`
const manifest = { marker, inicio: new Date().toISOString(), usuario: null, pedidos: [], itens: [], anexos: [], caminhos: [], medidas: [], pendencias: [], resultados: [], limpeza: false }
await mkdir('output', { recursive: true })
const manifestPath = process.env.DECORISI_RECUPERAR_MANIFESTO ?? `output/decorisi-real-${marker.split(' ').at(-1)}.json`
if(process.env.DECORISI_RECUPERAR_MANIFESTO) {
  assert.match(manifestPath,/^output\/decorisi-real-[a-f0-9]{8}\.json$/)
  Object.assign(manifest,JSON.parse((await readFile(manifestPath,'utf8')).replace(/^\uFEFF/,'')))
  assert.match(manifest.marker,/^TESTE DECORISI (?:[a-f0-9]{8}|VISUAL 0910)$/)
  for(const path of manifest.caminhos) assert.ok(manifest.pedidos.some(p=>path.startsWith(`${p}/`)))
}
const registrar = () => writeFile(manifestPath, JSON.stringify(manifest, null, 2))
const cookies = new Map()
async function http(path, options = {}, esperado = 200) {
  const headers = new Headers(options.headers)
  if (cookies.size) headers.set('cookie', [...cookies].map(([k,v]) => `${k}=${v}`).join('; '))
  if (options.body && typeof options.body === 'string') headers.set('content-type', 'application/json')
  const r = await fetch(`${base}${path}`, { ...options, headers, redirect: 'manual' })
  for (const value of r.headers.getSetCookie()) { const part = value.split(';')[0]; const i = part.indexOf('='); cookies.set(part.slice(0,i), part.slice(i+1)) }
  assert.ok(r.headers.get('content-type')?.includes('application/json'), `${path}: HTTP ${r.status}; resposta não JSON`)
  const value = await r.json()
  assert.equal(r.status, esperado, `${path}: HTTP ${r.status}; ${value.erro ?? value.message ?? 'resposta inesperada'}`)
  return value
}
async function etapa(nome, fn) { await fn(); manifest.resultados.push(nome); await registrar(); console.info(`[decorisi/real] OK ${nome}`) }
const root = '/api/pedidos-personalizados/decorisi'
let pedidoId, itemId, version, itens, unidade
const pdf = Buffer.from('%PDF-1.4\n% Arte sintetica Decorisi\n1 0 obj<</Type/Catalog>>endobj\n%%EOF')
async function obter() {
  const r = await http(`${root}/pedidos/${pedidoId}`)
  version = r.pedido.version
  for (const i of r.pedido.itens) for (const m of i.medidas) if (!manifest.medidas.includes(m.id)) manifest.medidas.push(m.id)
  await registrar()
  return r.pedido
}
async function enviar(bytes, id, method = 'POST', esperado = 200, key = randomUUID()) {
  const form = new FormData()
  form.set('arquivo', new Blob([bytes], { type: 'application/pdf' }), 'arte-teste.pdf')
  form.set('expectedVersion', String(version)); form.set('slot', '1')
  if (!manifest.anexos.includes(id ?? key)) manifest.anexos.push(id ?? key)
  const path = `${pedidoId}/${itemId}/${id ?? key}/${key}.pdf`
  manifest.caminhos.push(path); await registrar()
  const r = await http(`${root}/pedidos/${pedidoId}/itens/${itemId}/anexos${id ? `/${id}` : ''}`, { method, headers: { 'Idempotency-Key': key }, body: form }, esperado)
  if (r.version) version = r.version
  return { ...r, key, path }
}
async function carregarConsumidor() {
  const dir = `${process.cwd()}/output/decorisi-consumidor-validacao`
  await mkdir(dir, { recursive: true })
  for(const nome of ['storage-fila','anexos-repositorio','anexos-arquivo','http','service']) {
    const origem=nome==='service'?'src/lib/supabase/service.ts':`src/lib/pedidos-personalizados/server/${nome}.ts`
    const source=await readFile(origem,'utf8')
    let js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2020}}).outputText
    js=js.replaceAll("'@/lib/supabase/service'","'./service.mjs'").replaceAll("'next/server'","'next/server.js'")
    for(const dep of ['anexos-arquivo','anexos-repositorio','http']) js=js.replaceAll(`'./${dep}'`,`'./${dep}.mjs'`)
    await writeFile(`${dir}/${nome}.mjs`,js)
  }
  const prefix=`file:///${dir.replaceAll('\\','/')}`
  return {...await import(`${prefix}/storage-fila.mjs`),...await import(`${prefix}/anexos-repositorio.mjs`)}
}
async function limparArquivos() {
  if (!manifest.caminhos.length) return
  const { limparPendenciasStorage, RepositorioAnexos, StorageAnexos } = await carregarConsumidor()
  const repo = new RepositorioAnexos(service)
  const original = repo.carregarPendencias.bind(repo)
  // O consumidor é o existente; restringe a seleção somente aos caminhos desta execução.
  repo.carregarPendencias = async (agora) => { const r = await original(agora, 10000); if (r.error) return r; return { data: r.data.filter(p => manifest.caminhos.includes(p.caminhoObjeto)), error: null } }
  // O relógio do cliente pode estar alguns segundos atrás do timestamp do banco.
  // Selecionar somente os caminhos do manifesto evita antecipar trabalho alheio.
  const pendentes = await service.from('pedidos_personalizados_storage_pendencias').select('proxima_tentativa_em').in('caminho_objeto', manifest.caminhos).is('processado_em', null)
  assert.equal(pendentes.error, null)
  const agora = new Date(Math.max(Date.now(), ...pendentes.data.map(p => Date.parse(p.proxima_tentativa_em))) + 1)
  const r = await limparPendenciasStorage(new Request(`${base}/api/pedidos-personalizados/storage/limpar-pendencias`, { method: 'POST', headers: { authorization: 'Bearer validacao-local' } }), { segredo: () => 'validacao-local', criarRepositorio: () => repo, criarStorage: () => new StorageAnexos(service), agora: () => agora })
  const value = await r.json(); assert.equal(value.falhas, 0)
  const rows = await service.from('pedidos_personalizados_storage_pendencias').select('id,processado_em').in('caminho_objeto', manifest.caminhos)
  assert.equal(rows.error, null)
  manifest.pendencias = rows.data.map(p => p.id)
  assert.ok(rows.data.every(p => p.processado_em))
  for (const path of manifest.caminhos) { const d = await service.storage.from('pedidos-personalizados-anexos').download(path); assert.ok(d.error) }
  await registrar()
}
try {
  if(process.env.DECORISI_RECUPERAR_MANIFESTO) {
    await limparArquivos()
  } else {
  await etapa('não autenticado não acessa opções', async () => { const r = await fetch(`${base}${root}/opcoes`, { redirect:'manual' }); assert.ok([401,307].includes(r.status)) })
  await etapa('sessão técnica real e permissões existentes', async () => {
    await http('/api/auth/agente', { method:'POST', body:JSON.stringify({secret:process.env.AGENT_TEST_BOOTSTRAP_SECRET}) })
    const actor = await service.from('usuarios_permitidos').select('id').eq('email','agente.teste@lebebe.cloud').single(); assert.equal(actor.error,null); manifest.usuario=actor.data.id
    await http('/api/me/permissoes')
  })
  await etapa('acesso controlado, DB90/PF81 e quatro preços SGI', async () => {
    const f = await service.from('pedidos_personalizados_fornecedores').select('disponivel').eq('chave','decorisi').single(); assert.equal(f.data.disponivel,false)
    const op = await http(`${root}/opcoes`); assert.equal(op.db.length,222);assert.equal(op.db.filter(r=>r.referencia.startsWith('DB')).length,90);assert.equal(op.db.filter(r=>r.referencia.startsWith('XP')).length,132); assert.equal(op.pf.length,81)
    assert.deepEqual(op.precos.map(p=>[p.produto_id_sgi,Number(p.preco)]).sort((a,b)=>a[0]-b[0]),[[36565,530],[36566,660],[36567,230],[36568,320]])
    unidade=op.unidades[0].chave
    const db=await http(`${root}/referencias?q=813`); assert.equal(db.db[0].referencia,'DB813')
    const pf=await http(`${root}/referencias?q=200`); assert.equal(pf.pf[0],'PF200')
    const blocked=await anon.from('pedidos_personalizados_decorisi_referencias').select('id'); assert.ok(blocked.error)
  })
  await etapa('rascunho real e replay idempotente', async () => {
    itemId=randomUUID(); const painel=randomUUID(); manifest.itens.push(itemId,painel)
    itens=[{id:itemId,tipo:'PAPEL',classificacao:'CATALOGO',referencia:'DB813',medidas:[{larguraCm:350,alturaCm:270}]},{id:painel,tipo:'PAINEL',classificacao:'CATALOGO',referencia:'PF200',medidas:[{larguraCm:101,alturaCm:101}]}]
    manifest.idempotencyKey=randomUUID(); await registrar()
    const body=JSON.stringify({unidade,consultora:'Teste tecnico',cliente:marker,telefone:'41900000000',idempotencyKey:manifest.idempotencyKey,itens})
    const r=await http(`${root}/pedidos`,{method:'POST',body},201); pedidoId=r.pedidoId; version=r.version; manifest.pedidos.push(pedidoId); await registrar()
    const replay=await http(`${root}/pedidos`,{method:'POST',body}); assert.equal(replay.pedidoId,pedidoId); assert.equal(replay.reutilizado,true)
  })
  await etapa('cotação autoritativa: dois rolos e 1,0201 m²', async () => {
    const q=await http(`/api/pedidos-personalizados/pedidos/${pedidoId}/cotacao`)
    assert.equal(q.cotacao.completa,true); assert.equal(q.cotacao.itens[0].quantidade,'2'); assert.equal(Number(q.cotacao.itens[1].quantidade),1.0201); assert.equal(q.cotacao.totalCentavos,'129462')
  })
  await etapa('edição de medidas, reabertura e conflito de versão', async () => {
    const old=version; itens[0].medidas.push({larguraCm:62,alturaCm:270})
    const r=await http(`${root}/pedidos/${pedidoId}`,{method:'PATCH',body:JSON.stringify({expectedVersion:version,itens})}); version=r.version
    await http(`${root}/pedidos/${pedidoId}`,{method:'PATCH',body:JSON.stringify({expectedVersion:old,itens})},409)
    const p=await obter(); assert.equal(p.itens[0].medidas.length,2); assert.equal(p.itens[0].id,itemId)
  })
  let anexo
  await etapa('upload inválido recusado', async () => { await enviar(Buffer.from('arquivo invalido'),null,'POST',415) })
  await etapa('upload Storage real e replay sem duplicação', async () => {
    const r=await enviar(pdf); anexo=r.anexoId
    const replay=await enviar(pdf,null,'POST',200,r.key); assert.equal(replay.anexoId,anexo)
    const p=await obter(); assert.equal(p.itens[0].anexos.length,1)
  })
  await etapa('abertura assinada privada e acesso público recusado', async () => {
    const r=await http(`${root}/pedidos/${pedidoId}/itens/${itemId}/anexos/${anexo}`)
    const file=await fetch(r.url); assert.equal(file.status,200); assert.deepEqual(Buffer.from(await file.arrayBuffer()),pdf)
    const path=manifest.caminhos.at(-1); const publicUrl=`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/pedidos-personalizados-anexos/${path}`
    assert.notEqual((await fetch(publicUrl)).status,200)
  })
  await etapa('substituição preserva ID e enfileira arquivo antigo', async () => {
    const r=await enviar(Buffer.concat([pdf,Buffer.from('\n% substituido')]),anexo,'PUT'); assert.equal(r.anexoId,anexo)
    const p=await obter(); assert.equal(p.itens[0].anexos[0].id,anexo)
  })
  await etapa('remoção do anexo e consumidor existente no Storage real', async () => {
    const r=await http(`${root}/pedidos/${pedidoId}/itens/${itemId}/anexos/${anexo}`,{method:'DELETE',body:JSON.stringify({expectedVersion:version})}); version=r.version
    await limparArquivos(); assert.equal((await obter()).itens[0].anexos.length,0)
  })
  await etapa('gestão real: filtro Decorisi, detalhes e regressão de fornecedores', async () => {
    const lista = await http(`/api/pedidos-personalizados/pedidos?fornecedor=decorisi&cliente=${encodeURIComponent(marker)}`)
    assert.equal(lista.itens.length,1); assert.equal(lista.itens[0].id,pedidoId)
    const detalhe = await http(`/api/pedidos-personalizados/pedidos/${pedidoId}`)
    assert.equal(detalhe.pedido.decorisiItens.length,2)
    for (const fornecedor of ['moriah_tapetes','lebebe_exclusive']) {
      const vazio=await http(`/api/pedidos-personalizados/pedidos?fornecedor=${fornecedor}&cliente=${encodeURIComponent(marker)}`)
      assert.equal(vazio.itens.length,0)
    }
  })
  await etapa('fechamento real com replay, composição congelada e histórico único', async () => {
    const q=await http(`/api/pedidos-personalizados/pedidos/${pedidoId}/cotacao`)
    const body=JSON.stringify({expectedVersion:version,numeroLancamento:'999999',cotacaoConfirmada:q.cotacao})
    await http(`${root}/pedidos/${pedidoId}/fechar`,{method:'POST',body})
    const replay=await http(`${root}/pedidos/${pedidoId}/fechar`,{method:'POST',body}); assert.equal(replay.reutilizado,true)
    const p=await obter(); assert.equal(p.status,'VENDA FECHADA'); assert.ok(p.itens.every(i=>i.snapshot_comercial))
    await http(`${root}/pedidos/${pedidoId}`,{method:'PATCH',body:JSON.stringify({expectedVersion:version,itens})},422)
    const h=await service.from('pedidos_personalizados_status_historico').select('id').eq('pedido_id',pedidoId); assert.equal(h.error,null); assert.equal(h.data.length,1)
    manifest.historico=h.data.map(e=>e.id); await registrar()
  })
  }
} catch (erro) {
  console.error('[decorisi/real] Falha original:', erro.message)
  throw erro
} finally {
  // Recupera somente eventual criação desta chave/ator/identificação, inclusive resposta perdida.
  if(manifest.usuario && manifest.idempotencyKey) {
    const own=await service.from('pedidos_personalizados_pedidos').select('id,status').eq('created_by',manifest.usuario).eq('idempotency_key',manifest.idempotencyKey).eq('cliente',manifest.marker)
    assert.equal(own.error,null)
    for(const p of own.data) {
      assert.ok(['RASCUNHO','VENDA FECHADA'].includes(p.status)); if(!manifest.pedidos.includes(p.id)) manifest.pedidos.push(p.id)
      // Exclusivamente o registro sintético desta chave, ator e identificação.
      // A composição fechada só é desbloqueada para destruir esta fixture de teste.
      if(p.status==='VENDA FECHADA') {
        const h=await service.from('pedidos_personalizados_status_historico').select('id').eq('pedido_id',p.id); assert.equal(h.error,null)
        manifest.historico=h.data.map(e=>e.id); await registrar()
        if(manifest.historico.length) {
          // Histórico é append-only para o backend. Não ampliar grants para limpar fixtures.
          manifest.limpezaPendente = 'Histórico protegido: exclusão dos IDs deste manifesto exige operador autorizado via MCP.'
          process.exitCode = 1
          await registrar()
          continue
        }
        const liberar=await service.from('pedidos_personalizados_pedidos').update({status:'RASCUNHO'}).eq('id',p.id).eq('created_by',manifest.usuario).eq('cliente',manifest.marker).eq('idempotency_key',manifest.idempotencyKey); assert.equal(liberar.error,null)
      }
      const its=await service.from('pedidos_personalizados_decorisi_itens').select('id').eq('pedido_id',p.id); assert.equal(its.error,null)
      for(const i of its.data) { const d=await service.from('pedidos_personalizados_decorisi_anexos').delete().eq('item_id',i.id); assert.equal(d.error,null) }
      const di=await service.from('pedidos_personalizados_decorisi_itens').delete().in('id',its.data.map(i=>i.id)); assert.equal(di.error,null)
      const dp=await service.from('pedidos_personalizados_pedidos').delete().eq('id',p.id).eq('created_by',manifest.usuario).eq('cliente',manifest.marker); assert.equal(dp.error,null)
    }
    await limparArquivos()
    if(manifest.pendencias.length) { const d=await service.from('pedidos_personalizados_storage_pendencias').delete().in('id',manifest.pendencias).not('processado_em','is',null); assert.equal(d.error,null) }
    manifest.limpeza=!manifest.limpezaPendente
  }
  await registrar()
  if(cookies.size) await http('/api/auth/logout',{method:'POST'})
  console.info(`[decorisi/real] Manifesto sanitizado: ${manifestPath}; limpeza=${manifest.limpeza}`)
}
