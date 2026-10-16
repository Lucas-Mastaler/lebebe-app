-- Ativação operacional autorizada em D-024; não é migration nem altera tabelas/dados.
-- Executar somente após publicar o candidato compatível e conferir o projeto.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
DO $$ BEGIN
 IF md5(replace((SELECT prosrc FROM pg_proc WHERE oid=to_regprocedure('public.atendimento_presencial_concluir(uuid,integer,uuid,integer,text)')),E'\r\n',E'\n')) IS DISTINCT FROM 'f69b9a8542829f5b0db427b15b67fcb0'
 OR md5(replace((SELECT prosrc FROM pg_proc WHERE oid=to_regprocedure('public.atendimento_presencial_editar_concluido(uuid,integer,uuid,jsonb,integer,text)')),E'\r\n',E'\n')) IS DISTINCT FROM 'eddbaf03019a83a2de139dc085028fcb'
 OR md5(replace((SELECT prosrc FROM pg_proc WHERE oid=to_regprocedure('public.atendimento_presencial_normalizar_payload_ficha(jsonb,boolean)')),E'\r\n',E'\n')) IS DISTINCT FROM '88f9661c36f54d86f95ed552d982bf05'
 THEN RAISE EXCEPTION 'contratos_p1_divergentes'; END IF;
 IF public.atendimento_presencial_fluxo_v2_habilitado() OR public.atendimento_presencial_criancas_habilitado()
 THEN RAISE EXCEPTION 'ativacao_ja_realizada'; END IF;
END $$;
CREATE OR REPLACE FUNCTION public.atendimento_presencial_fluxo_v2_habilitado() RETURNS boolean LANGUAGE sql SECURITY INVOKER SET search_path=pg_catalog,public,pg_temp AS $$ SELECT true; $$;
CREATE OR REPLACE FUNCTION public.atendimento_presencial_criancas_habilitado() RETURNS boolean LANGUAGE sql SECURITY INVOKER SET search_path=pg_catalog,public,pg_temp AS $$ SELECT true $$;
COMMIT;
-- CREATE OR REPLACE conserva owner/ACL; nenhuma concessão adicional.
