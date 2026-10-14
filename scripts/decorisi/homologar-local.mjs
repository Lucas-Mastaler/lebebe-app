// Sessão local nominativa. Não modifica .env, perfil, módulos ou disponibilidade global.
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { spawn } from 'node:child_process'
import nextEnv from '@next/env'
import { createClient } from '@supabase/supabase-js'

nextEnv.loadEnvConfig(process.cwd())
const args = process.argv.slice(2)
const email = args[args.indexOf('--email') + 1]
const horas = Number(args.includes('--horas') ? args[args.indexOf('--horas') + 1] : 2)
assert.ok(args.includes('--email') && email?.includes('@'), 'Informe --email do usuário já autorizado no aplicativo.')
assert.ok(Number.isInteger(horas) && horas >= 1 && horas <= 8, '--horas deve estar entre 1 e 8.')
assert.ok(process.env.VERCEL_ENV !== 'production', 'Este script só pode iniciar homologação local.')
assert.equal(new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname, 'phsoawbdvhurroryfnok.supabase.co')
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
const usuario = await db.from('usuarios_permitidos').select('id,ativo').eq('email', email).single()
assert.equal(usuario.error, null, 'Usuário não encontrado.')
assert.equal(usuario.data.ativo, true, 'Usuário inativo.')
const id = usuario.data.id
if (args.includes('--revogar')) {
  const acesso = await db.from('pedidos_personalizados_decorisi_testadores').select('finalidade').eq('usuario_id',id).maybeSingle()
  assert.equal(acesso.error,null)
  if (acesso.data) {
    assert.ok(acesso.data.finalidade.startsWith('Homologação local Decorisi '), 'Não revogar acesso criado por outra finalidade.')
    const r = await db.from('pedidos_personalizados_decorisi_testadores').delete().eq('usuario_id',id).eq('finalidade',acesso.data.finalidade)
    assert.equal(r.error,null)
  }
  console.info('Acesso de homologação local revogado.')
  process.exit(0)
}
const fornecedor = await db.from('pedidos_personalizados_fornecedores').select('disponivel').eq('chave','decorisi').single()
assert.equal(fornecedor.error, null)
assert.equal(fornecedor.data.disponivel, false, 'O fornecedor deve permanecer globalmente desativado.')
// Sonda somente leitura: ID aleatório inexistente, nunca cria/transiciona pedidos.
const sonda = await db.rpc('transicionar_pedido_personalizado_decorisi', { p_pedido_id: randomUUID(), p_expected_version: 1, p_usuario_id: id, p_status_destino: 'RECEBIDO' })
assert.equal(sonda.error?.code, 'P0002', 'Aplique e valide a migration Fase 5 pelo procedimento autorizado antes da homologação.')
const existente = await db.from('pedidos_personalizados_decorisi_testadores').select('usuario_id').eq('usuario_id', id).maybeSingle()
assert.equal(existente.error, null)
assert.equal(existente.data, null, 'Já existe acesso temporário: não será sobrescrito.')
const finalidade = `Homologação local Decorisi ${randomUUID()}`
const expira = new Date(Date.now() + horas * 3600000).toISOString()
let iniciado = false
let servidor
let prazo
let encerrando = false
async function revogar() {
  const r = await db.from('pedidos_personalizados_decorisi_testadores').delete().eq('usuario_id',id).eq('finalidade',finalidade)
  assert.equal(r.error,null,'Falha na revogação; o acesso expirará no prazo registrado.')
}
async function encerrar() {
  if (encerrando) return
  encerrando = true
  // A revogação ocorre antes de encerrar o servidor; não depende da árvore de processos.
  try { if (iniciado) await revogar() } catch (e) { console.error(e.message); process.exitCode = 1 }
  servidor?.kill()
}
process.once('SIGINT', encerrar)
process.once('SIGTERM', encerrar)
try {
  const r = await db.from('pedidos_personalizados_decorisi_testadores').insert({ usuario_id:id, expira_em:expira, finalidade })
  assert.equal(r.error,null)
  iniciado = true
  prazo = setTimeout(() => { void encerrar() }, horas * 3600000)
  console.info(`Homologação local até ${expira}. Encerrar com Ctrl+C revoga este acesso. Nenhuma permissão de módulo/unidade foi ampliada.`)
  servidor = spawn(process.execPath, ['node_modules/next/dist/bin/next','dev','--hostname','127.0.0.1','--port','3014'], { stdio:'inherit', windowsHide:true, env:{ ...process.env, PEDIDOS_DECORISI_BACKEND:'true' } })
  await new Promise((resolve,reject) => { servidor.once('error',reject); servidor.once('exit',resolve) })
} finally { clearTimeout(prazo); await encerrar() }
