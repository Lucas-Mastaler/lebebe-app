import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { pathToFileURL } from 'node:url'
import { existsSync, readFileSync } from 'node:fs'
import { GET, POST } from './route'
import { createServiceClient } from '@/lib/supabase/service'
import { requireModuleAccess } from '@/lib/auth/module-access'
import { checkAccessWindowForUser } from '@/lib/auth/access-window'
import { requireAtendimentoPresencialHistoricoAccess } from '@/lib/atendimento-presencial/api-auth'
import { carregarPerfilAtendimento, listarUnidadesDoContexto } from '@/lib/atendimento-presencial/rascunhos'
vi.mock('@/lib/supabase/service', () => ({ createServiceClient: vi.fn() }))
vi.mock('@/lib/auth/module-access', () => ({ requireModuleAccess: vi.fn() }))
vi.mock('@/lib/auth/access-window', () => ({ checkAccessWindowForUser: vi.fn() }))
vi.mock('@/lib/atendimento-presencial/api-auth', () => ({ requireAtendimentoPresencialHistoricoAccess: vi.fn() }))
vi.mock('@/lib/atendimento-presencial/rascunhos', async original => ({ ...await original<object>(), carregarPerfilAtendimento: vi.fn(), listarUnidadesDoContexto: vi.fn() }))
type Banco = { exec: (sql: string) => Promise<unknown>; query: (sql: string, args?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>; close: () => Promise<void> }
const usuario = '10000000-0000-4000-8000-000000000001', unidade = '10000000-0000-4000-8000-000000000002', cliente = '10000000-0000-4000-8000-000000000003'
let db: Banco
let origem: string
let vendaId: string
let contador = 10
// Runtime de integração opcional, sem acrescentar dependência ao aplicativo.
// CI executa esta suíte quando PRANCHETA_PGLITE_RUNTIME apontar ao PGlite instalado.
const runtimeSql = process.env.PRANCHETA_PGLITE_RUNTIME ?? `${process.cwd()}/output/recebimento-conferir-todos-tools/node_modules/@electric-sql/pglite/dist/index.js`
const uuid = () => `20000000-0000-4000-8000-${String(contador++).padStart(12, '0')}`
const pedido = (body: unknown) => POST(new Request('http://local/api/atendimento-presencial/negociacoes', { method: 'POST', body: JSON.stringify(body) }))
const digital = () => ({ clienteId: cliente, negociacaoId: origem, unidadeId: unidade, consultora: 'ANA', canal: 'whatsapp', fechadoEm: new Date().toISOString(), numeroLancamento: contador++, produtos: [{ descricao: 'BERCO', quantidade: 2, vendido: true }], observacoes: '' })
async function contar(tabela: string) { return (await db.query(`select count(*)::int c from ${tabela}`)).rows[0].c }
beforeAll(async () => {
  const modulo = pathToFileURL(`${process.cwd()}/scripts/prancheta/banco-sintetico-p1.mjs`).href
  const { criarBancoP1 } = await import(/* @vite-ignore */ modulo)
  db = await criarBancoP1(runtimeSql) as Banco
  await db.exec("alter table atendimento_presencial_clientes add column nome text default 'CLIENTE TESTE';alter table atendimento_presencial_clientes add column telefone_informado text;alter table atendimento_presencial_clientes add column telefone_normalizado text;alter table app_unidades add column nome text default 'Marechal';alter table atendimento_presencial_atendimentos alter column id set default gen_random_uuid()")
  await db.exec('alter table atendimento_presencial_produtos_interesse add column quantidade integer;alter table atendimento_presencial_produtos_interesse add column vendido boolean')
  await db.exec("alter table atendimento_presencial_clientes add column telefone_normalizado_ddi text; update atendimento_presencial_clientes set telefone_informado='41999999999'; alter table atendimento_presencial_atendimentos add column versao_produtos smallint; alter table atendimento_presencial_atendimentos add column telefone_recusa_confirmada boolean; alter table atendimento_presencial_atendimentos add column telefone_desfecho text; alter table atendimento_presencial_atendimentos add column motivo_visita_outro text; alter table atendimento_presencial_criancas add constraint atendimento_presencial_criancas_idade_valor_check check(idade_valor is null or idade_valor>=1)")
  await db.exec(readFileSync('scripts/prancheta/sql/essenciais-base-referencia.sql', 'utf8'))
  await db.exec(readFileSync('supabase/migrations/20261029105543_prancheta_produtos_essenciais.sql', 'utf8'))
  await db.exec('create or replace function atendimento_presencial_fluxo_v2_habilitado() returns boolean language sql as $$select true$$;create or replace function atendimento_presencial_criancas_habilitado() returns boolean language sql as $$select true$$;update atendimento_presencial_essenciais_config set ativo=true')
  await db.exec(readFileSync('supabase/migrations/20261104131151_prancheta_negociacoes.sql', 'utf8'))
  // Reproduz o DEFAULT PRIVILEGES produtivo antes de validar a correção aditiva.
  await db.exec('GRANT ALL ON atendimento_presencial_negociacoes,atendimento_presencial_negociacao_retornos,atendimento_presencial_vendas_digitais,atendimento_presencial_negociacao_encerramentos,atendimento_presencial_negociacao_eventos TO service_role')
  await db.exec(readFileSync('supabase/migrations/20261104175043_prancheta_negociacoes_acl_service.sql', 'utf8'))
  await db.exec(readFileSync('supabase/migrations/20261104180238_prancheta_negociacoes_marcador_produto.sql', 'utf8'))
}, 30000)
afterAll(async () => { if (db) await db.close() })
beforeEach(async () => {
  vi.clearAllMocks()
  const acesso = { ok: true, allowedUser: { id: usuario, role: 'superadmin' } }
  vi.mocked(requireModuleAccess).mockResolvedValue(acesso as never)
  vi.mocked(requireAtendimentoPresencialHistoricoAccess).mockResolvedValue(acesso as never)
  vi.mocked(checkAccessWindowForUser).mockResolvedValue({ ok: true } as never)
  vi.mocked(carregarPerfilAtendimento).mockResolvedValue('superadmin')
  vi.mocked(listarUnidadesDoContexto).mockResolvedValue([{ id: unidade, chave: 'marechal', nome: 'Marechal' }])
  vi.mocked(createServiceClient).mockReturnValue({ from: (table: string) => {
    if (!['atendimento_presencial_atendimentos','atendimento_presencial_criancas','atendimento_presencial_departamentos','atendimento_presencial_produtos_interesse'].includes(table)) throw new Error(`Tabela inesperada: ${table}`)
    const filtros: { coluna: string; valor: unknown }[] = []
    let ordem = ''
    const executar = async () => ({ data: (await db.query(`select * from ${table}${filtros.length ? ' where ' + filtros.map((f, i) => `${f.coluna}=$${i + 1}`).join(' and ') : ''}${ordem ? ` order by ${ordem}` : ''}`, filtros.map(f => f.valor))).rows, error: null })
    const chain = { select: () => chain, eq: (coluna: string, valor: unknown) => { if (!['id','status','atendimento_id'].includes(coluna)) throw new Error(coluna); filtros.push({ coluna, valor }); return chain }, order: (coluna: string) => { if (coluna !== 'ordem') throw new Error(coluna); ordem = coluna; return chain }, single: async () => { const r = await executar(); return { data: r.data[0], error: null } }, then: (resolve: (v: unknown) => unknown, reject: (r: unknown) => unknown) => executar().then(resolve, reject) }
    return chain
  }, rpc: async (name: string, args: Record<string, unknown>) => {
    try { const keys = Object.keys(args); const r = await db.query(`select public.${name}(${keys.map((k, i) => `${k} => $${i + 1}`).join(',')}) resultado`, Object.values(args)); return { data: r.rows[0].resultado, error: null } }
    catch (e) { const erro = e as { code: string; message: string }; console.error('[SQL SINTETICO]', erro.message, JSON.stringify(args.p_dados)); return { data: null, error: { code: erro.code, message: erro.message } } }
  } } as never)
  origem = uuid(); vendaId = uuid()
  await db.query("insert into atendimento_presencial_atendimentos(id,cliente_id,consultora_usuario_id,unidade_id,status,iniciado_em,concluido_em,resultado_atendimento) values($1,$2,$3,$4,'concluido',now()-interval '14 days',now()-interval '14 days','negociacao')", [origem, cliente, usuario, unidade])
})

describe.skipIf(!existsSync(runtimeSql))('API e PostgreSQL isolado de negociações (runtime SQL opcional)', () => {
  it('conclui digital com marcador informativo sem contá-lo como produto vendido', async () => {
    const dados = digital()
    const response = await pedido({ acao: 'concluir', origemId: origem, operacaoId: uuid(), id: vendaId, version: 0, dados: { ...dados, produtos: [...dados.produtos, { descricao: 'PRODUTO QUE NAO TRABALHAMOS', quantidade: null, vendido: null }] } })
    expect(response.status).toBe(200)
    const row = (await db.query('select dados from atendimento_presencial_vendas_digitais where id=$1', [vendaId])).rows[0]
    expect((row.dados as { produtos: unknown[] }).produtos).toEqual([...dados.produtos, { descricao: 'PRODUTO QUE NAO TRABALHAMOS', quantidade: null, vendido: null }])
  })
  it('retorna negociação antiga antes de materializar e pagina no servidor', async () => {
    const antes = await contar('atendimento_presencial_negociacoes')
    const response = await GET(new Request(`http://local?origemId=${origem}&situacao=aberta`))
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ total: 1, negociacoes: [{ origem_id: origem, negociacao_id: null, situacao: 'aberta' }] })
    expect(await contar('atendimento_presencial_negociacoes')).toBe(antes)
  })
  it('recusa digital sem vendido e preserva contagens presenciais', async () => {
    const total = await contar('atendimento_presencial_atendimentos')
    const dados = digital()
    expect((await pedido({ acao: 'concluir', origemId: origem, operacaoId: uuid(), id: vendaId, version: 0, dados: { ...dados, produtos: [] } })).status).toBe(422)
    expect((await pedido({ acao: 'concluir', origemId: origem, operacaoId: uuid(), id: vendaId, version: 0, dados })).status).toBe(200)
    expect(await contar('atendimento_presencial_atendimentos')).toBe(total)
  })
  it('grava e reabre rascunhos digitais distintos da mesma negociação', async () => {
    for (const id of [uuid(), uuid()]) expect((await pedido({ acao: 'rascunho', origemId: origem, operacaoId: uuid(), id, version: 0, dados: digital() })).status).toBe(200)
    const response = await GET(new Request(`http://local?origemId=${origem}`))
    const json = await response.json()
    expect(json.negociacoes[0].digitais).toHaveLength(2)
    expect(json.negociacoes[0].situacao).toBe('aberta')
  })
  it('corrige lançamento/produtos e anula com auditoria, reabrindo negociação', async () => {
    const dados = digital()
    const r = await pedido({ acao: 'concluir', origemId: origem, operacaoId: uuid(), id: vendaId, version: 0, dados })
    const { resultado } = await r.json()
    expect(r.status).toBe(200)
    const corrigida = await pedido({ acao: 'corrigir', origemId: origem, operacaoId: uuid(), id: vendaId, version: resultado.version, motivo: 'Corrigir itens e lançamento', dados: { ...dados, numeroLancamento: contador++, produtos: [{ descricao: 'COMODA', quantidade: 3, vendido: true }] } })
    expect(corrigida.status).toBe(200)
    const atual = await corrigida.json()
    expect((await pedido({ acao: 'anular', origemId: origem, operacaoId: uuid(), id: vendaId, version: atual.resultado.version, motivo: '', dados: {} })).status).toBe(422)
    expect((await pedido({ acao: 'anular', origemId: origem, operacaoId: uuid(), id: vendaId, version: atual.resultado.version, motivo: 'Registro indevido', dados: {} })).status).toBe(200)
    const json = await (await GET(new Request(`http://local?origemId=${origem}`))).json()
    expect(json.negociacoes[0].situacao).toBe('aberta')
    expect(json.negociacoes[0].eventos).toHaveLength(3)
    expect(json.negociacoes[0].digitais[0]).toMatchObject({ status: 'anulado', dados: { produtos: [{ quantidade: 3 }] } })
  })
  it('apenas um dos dois encerramentos concorrentes enviados é efetivado', async () => {
    const respostas = await Promise.all([uuid(), uuid()].map(id => pedido({ acao: 'concluir', origemId: origem, operacaoId: uuid(), id, version: 0, dados: digital() })))
    expect(respostas.map(r => r.status).sort()).toEqual([200, 409])
  })
  it('idempotência repete a operação, sem duplicar venda ou aceitar outro pedido', async () => {
    const body = { acao: 'concluir', origemId: origem, operacaoId: uuid(), id: vendaId, version: 0, dados: digital() }
    expect((await pedido(body)).status).toBe(200)
    expect((await pedido(body)).status).toBe(200)
    expect((await pedido({ ...body, dados: { ...body.dados, numeroLancamento: 999999 } })).status).toBe(422)
  })
  it('cliente diferente é recusada no banco mesmo com dados válidos na API', async () => {
    expect((await pedido({ acao: 'concluir', origemId: origem, operacaoId: uuid(), id: vendaId, version: 0, dados: { ...digital(), clienteId: uuid() } })).status).toBe(422)
  })
  it('nega módulo e janela antes de executar SQL', async () => {
    vi.mocked(requireModuleAccess).mockResolvedValue({ ok: false, response: new Response(null, { status: 403 }) } as never)
    expect((await pedido({})).status).toBe(403)
    vi.mocked(requireModuleAccess).mockResolvedValue({ ok: true, allowedUser: { id: usuario, role: 'superadmin' } } as never)
    vi.mocked(checkAccessWindowForUser).mockResolvedValue({ ok: false } as never)
    expect((await pedido({})).status).toBe(403)
  })
  it('cria dois retornos pela API em filiais diferentes sem exclusividade e sem copiar resultado', async () => {
    const outra = uuid()
    await db.query("insert into app_unidades(id,ativo,nome) values($1,true,'Portão')", [outra])
    const ids: string[] = []
    for (const unidadeId of [unidade, outra]) {
      const r = await pedido({ acao: 'retorno', origemId: origem, operacaoId: uuid(), unidadeId, consultora: 'ANA' })
      expect(r.status).toBe(200)
      ids.push((await r.json()).resultado)
    }
    expect(ids[0]).not.toBe(ids[1])
    const rows = (await db.query('select id,status,dados_rascunho from atendimento_presencial_atendimentos where id=any($1::uuid[])', [ids])).rows
    expect(rows).toHaveLength(2)
    for (const row of rows) expect(row).toMatchObject({ status: 'rascunho', dados_rascunho: { essenciais: {}, motivosResultado: [] } })
    await db.query("update atendimento_presencial_atendimentos set expira_em=now() where id=$1", [ids[0]])
    expect((await db.query('select expira_em>now() vigente from atendimento_presencial_atendimentos where id=$1', [ids[1]])).rows[0].vigente).toBe(true)
  })
  it('vincula venda entre filiais sem criar visita e corrige vínculo transacionalmente', async () => {
    const outra = uuid(), origemCorreta = uuid(), venda = uuid()
    await db.query("insert into app_unidades(id,ativo,nome) values($1,true,'Portão')", [outra])
    await db.query("insert into atendimento_presencial_atendimentos(id,cliente_id,consultora_usuario_id,unidade_id,status,iniciado_em,concluido_em,resultado_atendimento) values($1,$2,$3,$4,'concluido',now()-interval '7 days',now()-interval '7 days','negociacao')", [origemCorreta, cliente, usuario, unidade])
    await db.query("insert into atendimento_presencial_atendimentos(id,cliente_id,consultora_usuario_id,unidade_id,status,iniciado_em,concluido_em,resultado_atendimento,numero_lancamento) values($1,$2,$3,$4,'concluido',now(),now(),'sim',$5)", [venda, cliente, usuario, outra, contador++])
    const total = await contar('atendimento_presencial_atendimentos')
    expect((await pedido({ acao: 'vincular', origemId: origem, operacaoId: uuid(), vendaId: venda, version: 1 })).status).toBe(200)
    expect((await pedido({ acao: 'corrigir_vinculo', origemId: origem, novaOrigemId: origemCorreta, operacaoId: uuid(), version: 2, novaVersion: 1, motivo: 'Selecionada negociação incorreta' })).status).toBe(200)
    expect(await contar('atendimento_presencial_atendimentos')).toBe(total)
    const velha = await (await GET(new Request(`http://local?origemId=${origem}`))).json()
    const correta = await (await GET(new Request(`http://local?origemId=${origemCorreta}`))).json()
    expect(velha.negociacoes[0].situacao).toBe('aberta')
    expect(correta.negociacoes[0].situacao).toBe('venda')
  })
  it('perda sem retorno não cria visita e dispensa essenciais', async () => {
    const total = await contar('atendimento_presencial_atendimentos')
    expect((await pedido({ acao: 'perda', origemId: origem, operacaoId: uuid(), version: 1, dados: { motivo: 'nao_respondeu', observacoes: 'Não retornou' } })).status).toBe(200)
    expect(await contar('atendimento_presencial_atendimentos')).toBe(total)
    const r = await (await GET(new Request(`http://local?origemId=${origem}`))).json()
    expect(r.negociacoes[0].situacao).toBe('perda')
  })
  it('conclui um retorno e preserva o outro; exige confirmação para conclusão independente', async () => {
    const ids: string[] = []
    for (let i = 0; i < 2; i++) {
      const r = await pedido({ acao: 'retorno', origemId: origem, operacaoId: uuid(), unidadeId: unidade, consultora: 'ANA' })
      expect(r.status).toBe(200)
      ids.push((await r.json()).resultado)
    }
    const dados = { versaoFluxo: 2, tipoAtendimento: 'cliente', versaoProdutos: 2, versaoEssenciais: 1, essenciais: {}, criancas: [], departamentos: ['moveis'], produtosInteresse: [{ descricao: 'BERCO', quantidade: 1, vendido: true }], motivosResultado: [], resultadoAtendimento: 'sim', consultoraNome: 'ANA', etapaAtual: 'ficha' }
    await db.query('update atendimento_presencial_atendimentos set dados_rascunho=$2 where id=$1', [ids[0], dados])
    const v1 = (await db.query('select version from atendimento_presencial_atendimentos where id=$1', [ids[0]])).rows[0].version
    await db.query('select atendimento_presencial_negociacao_concluir_retorno($1,$2,$3,$4,null,null,false)', [ids[0], v1, usuario, contador++])
    expect((await db.query('select status from atendimento_presencial_atendimentos where id=$1', [ids[1]])).rows[0].status).toBe('rascunho')
    await db.query('update atendimento_presencial_atendimentos set dados_rascunho=$2 where id=$1', [ids[1], { ...dados, observacoes: 'Preenchimento preservado' }])
    const v2 = (await db.query('select version from atendimento_presencial_atendimentos where id=$1', [ids[1]])).rows[0].version
    await expect(db.query('select atendimento_presencial_negociacao_concluir_retorno($1,$2,$3,$4,null,null,false)', [ids[1], v2, usuario, contador++])).rejects.toMatchObject({ message: 'negociacao_encerrada_confirmar_independente' })
    await db.query('select atendimento_presencial_negociacao_concluir_retorno($1,$2,$3,$4,null,null,true)', [ids[1], v2, usuario, contador++])
    expect((await db.query('select status,observacoes from atendimento_presencial_atendimentos where id=$1', [ids[1]])).rows[0]).toMatchObject({ status: 'concluido', observacoes: 'Preenchimento preservado' })
    const n = (await db.query('select id from atendimento_presencial_negociacoes where origem_id=$1', [origem])).rows[0].id
    expect((await db.query('select count(*)::int c from atendimento_presencial_negociacao_encerramentos where negociacao_id=$1 and not anulado', [n])).rows[0].c).toBe(1)
    expect((await db.query('select resultado_atendimento from atendimento_presencial_atendimentos where id=$1', [origem])).rows[0].resultado_atendimento).toBe('negociacao')
  })
  it('conta e pagina antes de retornar resultados, inclusive ao combinar filtros', async () => {
    const outroCliente = uuid()
    await db.query("insert into atendimento_presencial_clientes(id,status,nome,telefone_normalizado) values($1,'ativo','PAGINACAO NEGOCIACAO','41987654321')", [outroCliente])
    for (let i = 0; i < 23; i++) await db.query("insert into atendimento_presencial_atendimentos(id,cliente_id,consultora_usuario_id,unidade_id,status,resultado_atendimento,concluido_em) values($1,$2,$3,$4,'concluido','negociacao',now())", [uuid(), outroCliente, usuario, unidade])
    const buscar = async (pagina: number) => (await GET(new Request(`http://local?clienteId=${outroCliente}&situacao=aberta&nome=PAGINACAO&telefone=41987654321&pagina=${pagina}`))).json()
    const p1 = await buscar(1), p2 = await buscar(2)
    expect(p1.total).toBe(23); expect(p1.negociacoes).toHaveLength(20)
    expect(p2.total).toBe(23); expect(p2.negociacoes).toHaveLength(3)
    expect(new Set([...p1.negociacoes, ...p2.negociacoes].map(n => n.origem_id)).size).toBe(23)
    expect((await GET(new Request('http://local?de=2026-02-31'))).status).toBe(400)
  })
  it('protege dados da visita original e recusa duplicação de digital na conclusão presencial', async () => {
    const dados = digital()
    expect((await pedido({ acao: 'concluir', origemId: origem, operacaoId: uuid(), id: vendaId, version: 0, dados })).status).toBe(200)
    await expect(db.query("update atendimento_presencial_atendimentos set resultado_atendimento='sim' where id=$1", [origem])).rejects.toMatchObject({ code: '23514' })
    const visita = uuid()
    await db.query('insert into atendimento_presencial_atendimentos(id,cliente_id,consultora_usuario_id,unidade_id,dados_rascunho) values($1,$2,$3,$4,$5)', [visita, cliente, usuario, unidade, { criancas: [], essenciais: {}, versaoEssenciais: 1 }])
    await expect(db.query("update atendimento_presencial_atendimentos set status='concluido',resultado_atendimento='sim',numero_lancamento=$2 where id=$1", [visita, dados.numeroLancamento])).rejects.toMatchObject({ message: 'venda_digital_existente' })
    expect((await db.query('select status from atendimento_presencial_atendimentos where id=$1', [visita])).rows[0].status).toBe('rascunho')
  })
  it('autosave e exclusão/expiração de um retorno não alteram outro', async () => {
    const criar = async () => (await (await pedido({ acao: 'retorno', origemId: origem, operacaoId: uuid(), unidadeId: unidade, consultora: 'ANA' })).json()).resultado
    const a = await criar(), b = await criar()
    await db.query("update atendimento_presencial_atendimentos set dados_rascunho=jsonb_set(dados_rascunho,'{observacoes}',to_jsonb('AUTOSAVE A'::text)),version=version+1 where id=$1", [a])
    await db.query("update atendimento_presencial_atendimentos set dados_rascunho=jsonb_set(dados_rascunho,'{observacoes}',to_jsonb('AUTOSAVE B'::text)),version=version+1 where id=$1", [b])
    await db.query('delete from atendimento_presencial_atendimentos where id=$1', [a])
    expect((await db.query("select dados_rascunho->>'observacoes' obs,status from atendimento_presencial_atendimentos where id=$1", [b])).rows[0]).toMatchObject({ obs: 'AUTOSAVE B', status: 'rascunho' })
  })
  it('RLS/ACL bloqueiam acesso direto e deixam somente RPCs ao serviço', async () => {
    const rows = (await db.query("select c.relname,c.relrowsecurity,has_table_privilege('authenticated',c.oid,'SELECT') consulta,has_table_privilege('service_role',c.oid,'INSERT') escrita from pg_class c where c.relname in ('atendimento_presencial_negociacoes','atendimento_presencial_negociacao_retornos','atendimento_presencial_vendas_digitais','atendimento_presencial_negociacao_encerramentos','atendimento_presencial_negociacao_eventos')")).rows
    expect(rows).toHaveLength(5)
    for (const row of rows) expect(row).toMatchObject({ relrowsecurity: true, consulta: false, escrita: false })
    const functions = (await db.query("select p.proname,p.prosecdef,has_function_privilege('authenticated',p.oid,'EXECUTE') acesso from pg_proc p where p.proname like 'atendimento_presencial_negociac%' and p.prorettype<>'trigger'::regtype")).rows
    expect(functions.length).toBeGreaterThan(8)
    for (const row of functions) expect(row).toMatchObject({ prosecdef: row.proname !== 'atendimento_presencial_negociacoes_autorizar', acesso: false })
  })
  it('consulta compartilhada não concede alteração de digital a outra consultora ou gestão', async () => {
    const dados = digital()
    const concluida = await (await pedido({ acao: 'concluir', origemId: origem, operacaoId: uuid(), id: vendaId, version: 0, dados })).json()
    const modulo = uuid()
    await db.query("insert into app_modulos(id,chave,ativo,publico,somente_superadmin) values($1,'atendimento_presencial_registros',true,false,false)", [modulo])
    for (const perfil of ['consultora', 'gestao', 'supervisora_loja']) {
      const executor = uuid(), perfilId = uuid(), outra = uuid()
      await db.query("insert into usuarios_permitidos values($1,'user',true)", [executor])
      await db.query('insert into app_perfis_acesso values($1,$2,true)', [perfilId, perfil])
      await db.query('insert into app_usuarios_perfis values($1,$2)', [executor, perfilId])
      await db.query('insert into app_permissoes_usuario values($1,$2,true)', [modulo, executor])
      await db.query("insert into app_unidades(id,ativo,nome) values($1,true,'Outra filial')", [outra])
      await db.query('insert into app_usuarios_unidades values($1,$2)', [executor, outra])
      const consulta = (await db.query('select atendimento_presencial_negociacoes_buscar($1,1,$2) r', [executor, { origemId: origem }])).rows[0].r as { negociacoes: unknown[] }
      expect(consulta.negociacoes).toHaveLength(1)
      await expect(db.query('select atendimento_presencial_negociacao_digital($1,$2,$3,$4,$5,$6,$7,$8)', [origem, executor, uuid(), 'corrigir', vendaId, concluida.resultado.version, dados, 'Não autorizado'])).rejects.toMatchObject({ code: '42501' })
      if (perfil === 'supervisora_loja') {
        await db.query('insert into app_usuarios_unidades values($1,$2)', [executor, unidade])
        await db.query('select atendimento_presencial_negociacao_digital($1,$2,$3,$4,$5,$6,$7,$8)', [origem, executor, uuid(), 'corrigir', vendaId, concluida.resultado.version, dados, 'Supervisão autorizada'])
      }
    }
  })
  it('suspensão de emergência conserva dados/consulta e permite reativação explícita', async () => {
    expect((await pedido({ acao: 'rascunho', origemId: origem, operacaoId: uuid(), id: vendaId, version: 0, dados: digital() })).status).toBe(200)
    const tabelas = ['atendimento_presencial_negociacoes','atendimento_presencial_vendas_digitais','atendimento_presencial_negociacao_encerramentos','atendimento_presencial_negociacao_eventos']
    const antes = await Promise.all(tabelas.map(contar))
    const funcoes = (await db.query("select p.oid::regprocedure::text assinatura from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'atendimento_presencial_negociacao_%' and p.prorettype<>'trigger'::regtype")).rows
    await db.exec(readFileSync('scripts/prancheta/sql/suspender-negociacoes.sql', 'utf8'))
    expect((await db.query("select has_function_privilege('service_role','public.atendimento_presencial_negociacao_digital(uuid,uuid,uuid,text,uuid,integer,jsonb,text)','EXECUTE') permitido")).rows[0].permitido).toBe(false)
    expect(await Promise.all(tabelas.map(contar))).toEqual(antes)
    expect((await GET(new Request(`http://local?origemId=${origem}`))).status).toBe(200)
    for (const f of funcoes) await db.exec(`GRANT EXECUTE ON FUNCTION ${f.assinatura} TO service_role`)
    expect((await db.query("select has_function_privilege('service_role','public.atendimento_presencial_negociacao_digital(uuid,uuid,uuid,text,uuid,integer,jsonb,text)','EXECUTE') permitido")).rows[0].permitido).toBe(true)
  })
})
