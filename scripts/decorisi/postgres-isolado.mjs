// PostgreSQL NATIVO descartável, somente loopback. Não recebe URL de banco externo.
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { pathToFileURL } from 'node:url'

export async function abrirPostgresIsolado() {
  const dependencias = process.env.DECORISI_PG_DEPS
  if (!dependencias || !path.isAbsolute(dependencias)) throw new Error('Defina DECORISI_PG_DEPS com a instalação temporária dos binários PG17.6 e pg.')
  const { default: { Client } } = await import(pathToFileURL(path.join(dependencias, 'pg/lib/index.js')).href)
  const bin = path.join(dependencias, '@embedded-postgres/windows-x64/native/bin')
  const diretorio = await mkdtemp(path.join(tmpdir(), 'decorisi-pg-isolado-'))
  const dados = path.join(diretorio, 'dados')
  const net = await import('node:net')
  const porta = await new Promise((resolve, reject) => {
    const servidor = net.createServer()
    servidor.on('error', reject)
    servidor.listen(0, '127.0.0.1', () => { const p = servidor.address().port; servidor.close(() => resolve(p)) })
  })
  function executar(nome, args) {
    return new Promise((resolve, reject) => {
      const processo = spawn(path.join(bin, `${nome}.exe`), args, { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
      let saida = ''
      processo.stdout.on('data', (v) => { saida += v })
      processo.stderr.on('data', (v) => { saida += v })
      processo.on('error', reject)
      processo.on('exit', (codigo) => codigo === 0 ? resolve(saida) : reject(new Error(`${nome} falhou (${codigo}): ${saida.slice(-1600)}`)))
    })
  }
  let iniciado = false
  const conexoes = new Set()
  async function encerrar() {
    for (const conexao of conexoes) {
      try { await conexao.end() } catch { console.warn('[decorisi/pg17] Falha ao encerrar conexão temporária; pg_ctl encerrará o servidor.') }
    }
    if (iniciado) await executar('pg_ctl', ['-D', dados, '-m', 'fast', '-w', 'stop'])
    // Checagem explícita do alvo antes de qualquer remoção recursiva no Windows.
    const alvo = path.resolve(diretorio), base = path.resolve(tmpdir()) + path.sep
    if (!alvo.startsWith(base) || !path.basename(alvo).startsWith('decorisi-pg-isolado-')) throw new Error('Diretório temporário fora do escopo')
    await rm(alvo, { recursive: true, force: true })
  }
  try {
    await executar('initdb', ['-D', dados, '-U', 'postgres', '-A', 'trust', '--locale=C', '--encoding=UTF8'])
    await executar('pg_ctl', ['-D', dados, '-l', path.join(diretorio, 'postgres.log'), '-o', `-h 127.0.0.1 -p ${porta} -c max_connections=20 -c fsync=off`, '-w', 'start'])
    iniciado = true
    async function conectar(role = 'postgres') {
      const client = new Client({ host: '127.0.0.1', port: porta, user: role, database: 'postgres', application_name: 'decorisi-validacao-isolada', statement_timeout: 15000 })
      await client.connect(); conexoes.add(client)
      return client
    }
    return { conectar, encerrar, porta }
  } catch (erro) { await encerrar(); throw erro }
}
