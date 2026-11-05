-- D-063. Candidato LOCAL: funções aditivas, sem reescrita de registros.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
DO $$ BEGIN
 IF to_regprocedure('public.atendimento_presencial_negociacao_vincular(uuid,uuid,uuid,uuid,integer)') IS NULL
 OR (SELECT md5(replace(prosrc,E'\r\n',E'\n')) FROM pg_proc WHERE oid='public.atendimento_presencial_negociacao_vincular(uuid,uuid,uuid,uuid,integer)'::regprocedure)<>'8fe30fe3e371fae7e3ad58c1d7f53096'
 OR NOT EXISTS(SELECT 1 FROM pg_class WHERE oid='public.atendimento_presencial_negociacao_retornos'::regclass AND relrowsecurity)
 THEN RAISE EXCEPTION 'preflight_negociacoes_divergente'; END IF;
END $$;

CREATE FUNCTION public.atendimento_presencial_negociacoes_leitura(p_executor uuid)
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE papel text;
BEGIN
 SELECT role INTO papel FROM public.usuarios_permitidos WHERE id=p_executor AND ativo;
 IF papel IS NULL THEN RAISE EXCEPTION 'access_denied' USING ERRCODE='42501'; END IF;
 IF papel<>'superadmin' THEN
  IF NOT EXISTS(SELECT 1 FROM public.app_usuarios_unidades v JOIN public.app_unidades u ON u.id=v.unidade_id AND u.ativo WHERE v.usuario_id=p_executor)
  OR NOT EXISTS(SELECT 1 FROM public.app_modulos m LEFT JOIN public.app_permissoes_usuario pu ON pu.modulo_id=m.id AND pu.usuario_id=p_executor
   LEFT JOIN public.app_usuarios_perfis up ON up.usuario_id=p_executor LEFT JOIN public.app_perfis_acesso pa ON pa.id=up.perfil_id AND pa.ativo
   LEFT JOIN public.app_permissoes_perfil pp ON pp.modulo_id=m.id AND pp.perfil_id=pa.id
   WHERE m.chave IN ('atendimento_presencial_clientes','atendimento_presencial_ficha','atendimento_presencial_registros') AND m.ativo AND NOT m.publico AND NOT m.somente_superadmin
   AND (pu.permitido=true OR (pu.permitido IS NULL AND pp.permitido=true))) THEN RAISE EXCEPTION 'access_denied' USING ERRCODE='42501'; END IF;
 END IF;
END $$;

CREATE FUNCTION public.atendimento_presencial_negociacoes_resumos(p_executor uuid,p_origens uuid[])
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
BEGIN
 PERFORM public.atendimento_presencial_negociacoes_leitura(p_executor);
 IF cardinality(p_origens)>100 THEN RAISE EXCEPTION 'limite_resumos' USING ERRCODE='23514'; END IF;
 RETURN coalesce((SELECT jsonb_object_agg(a.id,jsonb_build_object('origemId',coalesce(p.origem_id,a.id),'situacao',CASE WHEN e.id IS NULL THEN 'aberta' WHEN e.tipo='perda' THEN 'perda' ELSE 'venda' END,'canal',e.tipo,'encerradoEm',coalesce(v.concluido_em,d.fechado_em,e.registrado_em),'atendimentoId',e.atendimento_id))
 FROM public.atendimento_presencial_atendimentos a
 LEFT JOIN public.atendimento_presencial_negociacoes n ON n.origem_id=a.id
 LEFT JOIN public.atendimento_presencial_negociacao_retornos r ON r.atendimento_id=a.id AND NOT r.independente
 LEFT JOIN public.atendimento_presencial_negociacoes p ON p.id=r.negociacao_id
 LEFT JOIN public.atendimento_presencial_negociacao_encerramentos e ON e.negociacao_id=coalesce(p.id,n.id) AND NOT e.anulado
 LEFT JOIN public.atendimento_presencial_atendimentos v ON v.id=e.atendimento_id
 LEFT JOIN public.atendimento_presencial_vendas_digitais d ON d.id=e.venda_digital_id
 WHERE a.id=ANY(p_origens) AND a.status='concluido' AND a.resultado_atendimento='negociacao'),'{}');
END $$;

CREATE FUNCTION public.atendimento_presencial_negociacoes_candidatos(p_executor uuid,p_origem uuid,p_pagina integer DEFAULT 1,p_filtros jsonb DEFAULT '{}')
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE origem public.atendimento_presencial_atendimentos; resultado jsonb; total bigint;
BEGIN
 PERFORM public.atendimento_presencial_negociacoes_leitura(p_executor);
 SELECT * INTO origem FROM public.atendimento_presencial_atendimentos WHERE id=p_origem AND status='concluido' AND resultado_atendimento='negociacao';
 IF origem.id IS NULL OR origem.cliente_id IS NULL THEN RAISE EXCEPTION 'origem_invalida' USING ERRCODE='23514'; END IF;
 IF p_pagina<1 OR p_pagina>100000 OR jsonb_typeof(p_filtros) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'filtros_invalidos' USING ERRCODE='23514'; END IF;
 WITH candidatos AS (
  SELECT a.id,a.iniciado_em,a.concluido_em,a.resultado_atendimento,a.consultora_nome,u.nome filial,a.unidade_id,a.numero_lancamento,
   CASE WHEN EXISTS(SELECT 1 FROM public.atendimento_presencial_negociacao_retornos r WHERE r.atendimento_id=a.id)
    OR EXISTS(SELECT 1 FROM public.atendimento_presencial_negociacao_encerramentos e WHERE e.atendimento_id=a.id AND NOT e.anulado)
    OR EXISTS(SELECT 1 FROM public.atendimento_presencial_negociacoes n WHERE n.origem_id=a.id)
    THEN 'Este atendimento já pertence a uma negociação.' ELSE NULL END bloqueio
  FROM public.atendimento_presencial_atendimentos a JOIN public.atendimento_presencial_clientes c ON c.id=a.cliente_id JOIN public.app_unidades u ON u.id=a.unidade_id
  WHERE a.cliente_id=origem.cliente_id AND a.status='concluido' AND a.id<>origem.id AND a.iniciado_em>=origem.iniciado_em AND a.resultado_atendimento IN ('sim','nao','negociacao')
   AND (nullif(p_filtros->>'nome','') IS NULL OR c.nome ILIKE '%'||(p_filtros->>'nome')||'%')
   AND (nullif(p_filtros->>'telefone','') IS NULL OR c.telefone_normalizado LIKE '%'||regexp_replace(p_filtros->>'telefone','[^0-9]','','g')||'%')
   AND (nullif(p_filtros->>'de','') IS NULL OR (a.iniciado_em AT TIME ZONE 'America/Sao_Paulo')::date>=(p_filtros->>'de')::date)
   AND (nullif(p_filtros->>'ate','') IS NULL OR (a.iniciado_em AT TIME ZONE 'America/Sao_Paulo')::date<=(p_filtros->>'ate')::date)
   AND (nullif(p_filtros->>'unidadeId','') IS NULL OR a.unidade_id=(p_filtros->>'unidadeId')::uuid)
   AND (nullif(p_filtros->>'resultado','') IS NULL OR a.resultado_atendimento=p_filtros->>'resultado')
 ), pagina AS (SELECT * FROM candidatos ORDER BY iniciado_em DESC,id LIMIT 20 OFFSET (p_pagina-1)*20)
 SELECT (SELECT count(*) FROM candidatos),coalesce(jsonb_agg(to_jsonb(p) ORDER BY iniciado_em DESC,id),'[]') INTO total,resultado FROM pagina p;
 RETURN jsonb_build_object('atendimentos',resultado,'total',total,'pagina',p_pagina,'pageSize',20,'filiais',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'nome',nome) ORDER BY nome),'[]') FROM public.app_unidades WHERE ativo));
END $$;

CREATE FUNCTION public.atendimento_presencial_negociacao_associar_atendimento(p_origem uuid,p_atendimento uuid,p_executor uuid,p_operacao uuid,p_version integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE n public.atendimento_presencial_negociacoes; a public.atendimento_presencial_atendimentos; ev public.atendimento_presencial_negociacao_eventos; resultado jsonb; chave uuid;
BEGIN
 PERFORM public.atendimento_presencial_negociacoes_autorizar(p_executor);
 IF p_origem IS NULL OR p_atendimento IS NULL OR p_operacao IS NULL OR p_version IS NULL OR p_version<1 THEN RAISE EXCEPTION 'associacao_invalida' USING ERRCODE='23514'; END IF;
 -- Só associações definitivas usam estes locks, em ordem estável, nunca rascunhos.
 FOR chave IN SELECT DISTINCT x FROM unnest(ARRAY[p_origem,p_atendimento]) x ORDER BY x LOOP
  PERFORM pg_advisory_xact_lock(hashtextextended(chave::text,2));
 END LOOP;
 IF EXISTS(SELECT 1 FROM public.atendimento_presencial_negociacao_retornos WHERE atendimento_id=p_origem AND NOT independente) THEN RAISE EXCEPTION 'origem_ja_associada' USING ERRCODE='P0003'; END IF;
 n.id:=public.atendimento_presencial_negociacao_materializar(p_origem,p_executor);
 SELECT * INTO n FROM public.atendimento_presencial_negociacoes WHERE id=n.id FOR NO KEY UPDATE;
 SELECT * INTO ev FROM public.atendimento_presencial_negociacao_eventos WHERE executor_id=p_executor AND operacao_id=p_operacao;
 IF FOUND THEN
  IF ev.negociacao_id<>n.id OR NOT ((ev.acao='vincular' AND ev.dados->>'vendaId'=p_atendimento::text) OR (ev.acao='vincular_atendimento' AND ev.dados->>'atendimentoId'=p_atendimento::text)) THEN RAISE EXCEPTION 'operacao_reutilizada' USING ERRCODE='23514'; END IF;
  IF ev.acao='vincular' THEN RETURN jsonb_build_object('atendimentoId',p_atendimento,'resultado','sim','situacao','venda'); END IF;
  RETURN ev.dados->'resultado';
 END IF;
 IF n.version<>p_version OR EXISTS(SELECT 1 FROM public.atendimento_presencial_negociacao_encerramentos WHERE negociacao_id=n.id AND NOT anulado) THEN RAISE EXCEPTION 'negociacao_atualizada' USING ERRCODE='P0003'; END IF;
 SELECT * INTO a FROM public.atendimento_presencial_atendimentos WHERE id=p_atendimento FOR UPDATE;
 IF a.id IS NULL OR a.id=p_origem OR a.cliente_id IS DISTINCT FROM n.cliente_id OR a.status<>'concluido' OR a.resultado_atendimento IS NULL OR a.resultado_atendimento NOT IN ('sim','nao','negociacao') OR a.iniciado_em<(SELECT iniciado_em FROM public.atendimento_presencial_atendimentos WHERE id=p_origem) THEN RAISE EXCEPTION 'atendimento_incompativel' USING ERRCODE='23514'; END IF;
 IF EXISTS(SELECT 1 FROM public.atendimento_presencial_negociacao_retornos WHERE atendimento_id=a.id)
 OR EXISTS(SELECT 1 FROM public.atendimento_presencial_negociacoes WHERE origem_id=a.id)
 OR EXISTS(SELECT 1 FROM public.atendimento_presencial_negociacao_encerramentos WHERE atendimento_id=a.id AND NOT anulado) THEN RAISE EXCEPTION 'atendimento_ja_associado' USING ERRCODE='P0003'; END IF;
 IF a.resultado_atendimento='sim' THEN
  PERFORM public.atendimento_presencial_negociacao_vincular(p_origem,a.id,p_executor,p_operacao,p_version);
  RETURN jsonb_build_object('atendimentoId',a.id,'resultado','sim','situacao','venda');
 END IF;
 IF a.resultado_atendimento='nao' THEN
  INSERT INTO public.atendimento_presencial_negociacao_encerramentos(negociacao_id,tipo,atendimento_id,executor_id) VALUES(n.id,'perda',a.id,p_executor);
 ELSE
  INSERT INTO public.atendimento_presencial_negociacao_retornos(atendimento_id,negociacao_id,criado_por) VALUES(a.id,n.id,p_executor);
 END IF;
 UPDATE public.atendimento_presencial_negociacoes SET version=version+1 WHERE id=n.id;
 resultado:=jsonb_build_object('atendimentoId',a.id,'resultado',a.resultado_atendimento,'situacao',CASE WHEN a.resultado_atendimento='nao' THEN 'perda' ELSE 'aberta' END);
 INSERT INTO public.atendimento_presencial_negociacao_eventos(negociacao_id,executor_id,operacao_id,acao,dados) VALUES(n.id,p_executor,p_operacao,'vincular_atendimento',jsonb_build_object('atendimentoId',a.id,'resultado',resultado));
 RETURN resultado;
END $$;

REVOKE ALL ON FUNCTION public.atendimento_presencial_negociacoes_leitura(uuid),public.atendimento_presencial_negociacoes_resumos(uuid,uuid[]),public.atendimento_presencial_negociacoes_candidatos(uuid,uuid,integer,jsonb),public.atendimento_presencial_negociacao_associar_atendimento(uuid,uuid,uuid,uuid,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.atendimento_presencial_negociacoes_leitura(uuid),public.atendimento_presencial_negociacoes_resumos(uuid,uuid[]),public.atendimento_presencial_negociacoes_candidatos(uuid,uuid,integer,jsonb),public.atendimento_presencial_negociacao_associar_atendimento(uuid,uuid,uuid,uuid,integer) TO service_role;
COMMIT;
