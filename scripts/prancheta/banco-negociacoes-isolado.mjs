// Dependências e dados sintéticos. Não lê .env nem cria cliente Supabase real.
import { readFileSync } from 'node:fs'
import { criarBancoP1, usuario, unidade, cliente } from './banco-sintetico-p1.mjs'
export { usuario, unidade, cliente }
export async function criarBancoNegociacoes() {
 const db=await criarBancoP1('C:/le-bebe/output/recebimento-conferir-todos-tools/node_modules/@electric-sql/pglite/dist/index.js')
 await prepararBancoNegociacoes(db)
 return db
}
export async function prepararBancoNegociacoes(db) {
 await db.exec(`ALTER TABLE atendimento_presencial_atendimentos ALTER COLUMN id SET DEFAULT gen_random_uuid();
 ALTER TABLE app_unidades ADD COLUMN nome text DEFAULT 'Marechal';ALTER TABLE app_unidades ADD COLUMN chave text DEFAULT 'marechal';
 ALTER TABLE atendimento_presencial_clientes ADD COLUMN nome text DEFAULT 'CLIENTE HOMOLOGACAO';
 ALTER TABLE atendimento_presencial_clientes ADD COLUMN telefone_informado text DEFAULT '41988887777';
 ALTER TABLE atendimento_presencial_clientes ADD COLUMN telefone_normalizado text DEFAULT '41988887777';
 ALTER TABLE atendimento_presencial_clientes ADD COLUMN telefone_normalizado_ddi text DEFAULT '5541988887777';
 ALTER TABLE atendimento_presencial_clientes ADD COLUMN parentesco_outro text;
 ALTER TABLE atendimento_presencial_atendimentos ADD COLUMN versao_produtos smallint;
 ALTER TABLE atendimento_presencial_atendimentos ADD COLUMN telefone_recusa_confirmada boolean;
 ALTER TABLE atendimento_presencial_atendimentos ADD COLUMN telefone_desfecho text;
 ALTER TABLE atendimento_presencial_atendimentos ADD COLUMN motivo_visita_outro text;
 ALTER TABLE atendimento_presencial_historico ADD COLUMN created_at timestamptz DEFAULT now();
 ALTER TABLE atendimento_presencial_historico ADD COLUMN id uuid DEFAULT gen_random_uuid() UNIQUE;
 ALTER TABLE atendimento_presencial_departamentos ADD COLUMN id uuid DEFAULT gen_random_uuid() UNIQUE;
 ALTER TABLE atendimento_presencial_produtos_interesse ADD COLUMN id uuid DEFAULT gen_random_uuid() UNIQUE;
 ALTER TABLE atendimento_presencial_motivos ADD COLUMN id uuid DEFAULT gen_random_uuid() UNIQUE;
 ALTER TABLE atendimento_presencial_produtos_interesse ADD COLUMN quantidade integer;
 ALTER TABLE atendimento_presencial_produtos_interesse ADD COLUMN vendido boolean;
 ALTER TABLE atendimento_presencial_criancas ADD CONSTRAINT atendimento_presencial_criancas_idade_valor_check CHECK(idade_valor IS NULL OR idade_valor>=1);`)
 await db.exec(readFileSync('scripts/prancheta/sql/essenciais-base-referencia.sql','utf8'))
 await db.exec(readFileSync('supabase/migrations/20261029105543_prancheta_produtos_essenciais.sql','utf8'))
 const edicaoProdutos=readFileSync('supabase/migrations/20261020193639_prancheta_produtos_pv.sql','utf8').match(/CREATE OR REPLACE FUNCTION public\.atendimento_presencial_editar_concluido[\s\S]*?\$function\$;/)?.[0]
 if(!edicaoProdutos)throw new Error('RPC oficial de edição de produtos ausente na fixture')
 await db.exec(edicaoProdutos)
 await db.exec(readFileSync('supabase/migrations/20261029133606_prancheta_essenciais_edicao_historica.sql','utf8'))
 await db.exec(`CREATE OR REPLACE FUNCTION atendimento_presencial_fluxo_v2_habilitado() RETURNS boolean LANGUAGE sql AS $$SELECT true$$;
 CREATE OR REPLACE FUNCTION atendimento_presencial_criancas_habilitado() RETURNS boolean LANGUAGE sql AS $$SELECT true$$;
 UPDATE atendimento_presencial_essenciais_config SET ativo=true;`)
 await db.exec(readFileSync('supabase/migrations/20261104131151_prancheta_negociacoes.sql','utf8'))
 await db.exec(readFileSync('supabase/migrations/20261104175043_prancheta_negociacoes_acl_service.sql','utf8'))
 await db.exec(readFileSync('supabase/migrations/20261104180238_prancheta_negociacoes_marcador_produto.sql','utf8'))
 await db.exec(readFileSync('supabase/migrations/20261104193112_prancheta_negociacoes_fluxo_explicito.sql','utf8'))
 await db.exec(readFileSync('supabase/migrations/20261105130000_prancheta_unica_digital.sql','utf8'))
}

// Adaptador PostgREST mínimo para executar as APIs reais no PostgreSQL isolado.
// Somente tabelas/colunas SQL simples; chamadas externas não são encaminhadas.
export function clienteSqlIsolado(db) {
 const identifier=v=>{if(!/^[a-z_][a-z0-9_]*$/i.test(v))throw new Error('Identificador SQL de fixture inválido');return '"'+v+'"'}
 return {
  rpc:async(name,args)=>{
   if(!/^atendimento_presencial_[a-z_]+$/.test(name))throw new Error('RPC fora da fixture')
   try {const keys=Object.keys(args);const r=await db.query(`SELECT public.${identifier(name)}(${keys.map((k,i)=>`${identifier(k)}=>$${i+1}`).join(',')}) resultado`,Object.values(args));return {data:r.rows[0]?.resultado,error:null}}
   catch(e){return {data:null,error:{code:e.code,message:e.message}}}
  },
  from:table=>{
   if(!/^(atendimento_presencial_|app_|usuarios_permitidos$)/.test(table))throw new Error('Tabela fora da fixture')
   identifier(table)
   const filtros=[],values=[];let projection='*',sort='',limit='',mutation=null
   const run=async()=>{
    try{
     const args=[...values],cond=filtros.length?' WHERE '+filtros.join(' AND '):''
     let sql
     if(mutation){const entries=Object.entries(mutation);const updates=entries.map(([k,v])=>{args.push(v);return `${identifier(k)}=$${args.length}`});sql=`UPDATE ${identifier(table)} SET ${updates.join(',')}${cond} RETURNING *`}
     else sql=`SELECT * FROM ${identifier(table)}${cond}${sort}${limit}`
     const r=await db.query(sql,args)
     if(table==='app_usuarios_perfis'&&projection.includes('app_perfis_acesso'))for(const row of r.rows)row.app_perfis_acesso=(await db.query('SELECT * FROM app_perfis_acesso WHERE id=$1',[row.perfil_id])).rows[0]
     if(table==='app_usuarios_unidades'&&projection.includes('app_unidades'))for(const row of r.rows)row.app_unidades=(await db.query('SELECT * FROM app_unidades WHERE id=$1',[row.unidade_id])).rows[0]
     return {data:r.rows,error:null}
    }catch(e){return {data:null,error:{code:e.code,message:e.message}}}
   }
   const chain={
    select:p=>{projection=p||'*';return chain},update:v=>{mutation=v;return chain},
    eq:(k,v)=>{values.push(v);filtros.push(`${identifier(k)}=$${values.length}`);return chain},
    neq:(k,v)=>{values.push(v);filtros.push(`${identifier(k)}<>$${values.length}`);return chain},
    in:(k,v)=>{values.push(v);filtros.push(`${identifier(k)}=ANY($${values.length})`);return chain},
    order:(k,options)=>{sort=` ORDER BY ${identifier(k)} ${options?.ascending===false?'DESC':'ASC'}`;return chain},
    limit:n=>{if(!Number.isInteger(n)||n<0)throw new Error('Limite inválido');limit=` LIMIT ${n}`;return chain},
    range:(a,b)=>{if(!Number.isInteger(a)||!Number.isInteger(b)||a<0||b<a)throw new Error('Página inválida');limit=` LIMIT ${b-a+1} OFFSET ${a}`;return chain},
    single:async()=>{const r=await run();return {...r,data:r.data?.[0]||null}},maybeSingle:async()=>{const r=await run();return {...r,data:r.data?.[0]||null}},
    then:(resolve,reject)=>run().then(resolve,reject)
   };return chain
  }
 }
}
