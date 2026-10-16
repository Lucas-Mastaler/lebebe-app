// Banco PostgreSQL/WASM efêmero. Somente fixtures; sem conexão/credenciais remotas.
import {readFileSync} from 'node:fs'
import {pathToFileURL} from 'node:url'
export const usuario='10000000-0000-4000-8000-000000000001'
export const unidade='10000000-0000-4000-8000-000000000002'
export const cliente='10000000-0000-4000-8000-000000000003'
export async function criarBancoP1(runtime) {
 const {PGlite}=await import(pathToFileURL(runtime).href);const db=new PGlite()
 const teste=readFileSync('scripts/prancheta/validar-entrega2.mjs','utf8')
 let fixture=teste.split('await db.exec(`')[1].split('`)')[0]
 for(const [key,value] of Object.entries({usuario,unidade,cliente}))fixture=fixture.replaceAll('${'+key+'}',value)
 await db.exec(fixture)
 await db.exec(`ALTER TABLE atendimento_presencial_criancas ADD COLUMN id uuid DEFAULT gen_random_uuid() PRIMARY KEY;
 ALTER TABLE atendimento_presencial_clientes ADD COLUMN parentesco text;
 ALTER TABLE atendimento_presencial_criancas ADD CONSTRAINT atendimento_presencial_criancas_condicional_check CHECK(
 (situacao='gestacao' AND idade_unidade IS NULL AND idade_valor IS NULL) OR (situacao='ja_nasceu' AND data_prevista_nascimento IS NULL AND idade_unidade IS NOT NULL AND idade_valor IS NOT NULL)
 OR (situacao='presente_outra_pessoa' AND idade_unidade IS NULL AND idade_valor IS NULL) OR (situacao='nao_informado' AND data_prevista_nascimento IS NULL AND idade_unidade IS NULL AND idade_valor IS NULL));`)
 await db.exec(readFileSync('scripts/prancheta/sql/base-entrega2.sql','utf8'))
 for(const path of ['20261015185406_atendimento_presencial_contratos_fluxo_v2.sql','20261015203309_atendimento_presencial_criancas_permanentes.sql','20261015212015_atendimento_presencial_presente_idade_aproximada.sql'])await db.exec(readFileSync(`supabase/migrations/${path}`,'utf8'))
 return db
}
