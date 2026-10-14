import { readFile } from 'node:fs/promises'

// Metadados obtidos por SELECT no MCP; nunca contém linhas de produção.
export async function prepararSchemaEquivalente(client) {
  const m = JSON.parse(await readFile(new URL('./schema-referencia.json', import.meta.url), 'utf8'))
  const id = (s) => `"${s.replaceAll('"', '""')}"`
  await client.query('create role anon login; create role authenticated login; create role service_role login bypassrls; create schema auth; grant usage on schema public,auth to anon,authenticated,service_role;')
  for (const f of m.authFuncoes) await client.query(f.def)
  for (const t of m.tabelas) {
    if (t.colunas.some((c) => c.identity)) throw new Error(`Identity não reproduzida: ${t.nome}`)
    await client.query(`create table public.${id(t.nome)} (${t.colunas.map((c) => `${id(c.nome)} ${c.tipo}${c.generated ? ` generated always as (${c.default}) stored` : c.default ? ` default ${c.default}` : ''}${c.notNull ? ' not null' : ''}`).join(',')})`)
  }
  for (const c of m.constraints) await client.query(`alter table public.${id(c.tabela)} add constraint ${id(c.nome)} ${c.def}`)
  for (const sql of m.indices) await client.query(sql)
  for (const f of m.funcoes) await client.query(f.def)
  // Repõe as ACLs efetivas dos helpers e RPCs existentes sem depender dos defaults locais.
  const funcoes = (await client.query("select p.oid::regprocedure::text assinatura,p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'")).rows
  for (const f of funcoes) {
    const original = m.funcoes.find((x) => x.proname === f.proname)
    if (!original) continue
    await client.query(`revoke all on function ${f.assinatura} from public,anon,authenticated,service_role`)
    for (const role of ['public','anon','authenticated','service_role']) {
      if (original.acl.includes(role === 'public' ? '{=X/' : `${role}=X/`)) await client.query(`grant execute on function ${f.assinatura} to ${role}`)
    }
  }
  for (const t of m.triggers) await client.query(t.def)
  for (const p of m.policies) await client.query(`create policy ${id(p.policyname)} on public.${id(p.tablename)} as ${p.permissive} for ${p.cmd} to ${p.roles.map(id).join(',')}${p.qual ? ` using (${p.qual})` : ''}${p.with_check ? ` with check (${p.with_check})` : ''}`)
  for (const t of m.tabelas) if (t.rls) await client.query(`alter table public.${id(t.nome)} enable row level security`)
  for (const g of m.grants) await client.query(`grant ${g.privilegio} on public.${id(g.tabela)} to ${id(g.role)}`)
  return m
}

export async function inserirDadosSinteticos(client) {
  await client.query(`
    insert into usuarios_permitidos(id,email,role,ativo) values
      ('10000000-0000-4000-8000-000000000001','admin@example.test','superadmin',true),
      ('10000000-0000-4000-8000-000000000002','outro@example.test','user',true),
      ('10000000-0000-4000-8000-000000000003','editor@example.test','user',true);
    insert into app_unidades(id,chave,nome,ativo) values
      ('20000000-0000-4000-8000-000000000001','bigorrilho','Unidade sintética A',true),
      ('20000000-0000-4000-8000-000000000002','portao','Unidade sintética B',true);
    insert into app_usuarios_unidades(usuario_id,unidade_id) values
      ('10000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000002'),
      ('10000000-0000-4000-8000-000000000003','20000000-0000-4000-8000-000000000001');
    insert into pedidos_personalizados_fornecedores(id,chave,nome,ordem,disponivel) values
      ('30000000-0000-4000-8000-000000000001','decorisi','Decorisi',3,false),
      ('30000000-0000-4000-8000-000000000002','moriah_tapetes','Moriah',1,true),
      ('30000000-0000-4000-8000-000000000003','lebebe_exclusive','Exclusive',2,true);
    insert into sgi_produtos_cache(produto_id_sgi,codigo,preco,ativo,fora_linha,ultima_validacao_sgi) values
      (36565,'19075',10.01,true,false,now()),(36566,'19076',12.34,true,false,now()),
      (36567,'19077',23.45,true,false,now()),(36568,'19078',32.10,true,false,now()),
      (39744,'21157',99.99,true,false,now());
    insert into pedidos_personalizados_produtos(id,fornecedor_id,codigo,descricao,ordem,produto_id_sgi) values
      ('40000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000002','MORIAH_TESTE','Tapete sintético',1,39744),
      ('40000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000003','EXCLUSIVE_TESTE','Produto sintético',1,null);
    insert into pedidos_personalizados_lebebe_exclusive_catalogo(produto_id,colecao,referencia,preco_unitario,custo_unitario,colecao_busca,descricao_busca,referencia_busca,linha_origem,arquivo_origem_sha256) values
      ('40000000-0000-4000-8000-000000000002','Teste','TESTE',10,5,'teste','produto sintetico','teste',2,repeat('A',64));
  `)
}
