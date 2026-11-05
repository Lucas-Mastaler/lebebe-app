-- D-064: LOCAL. Ativação coordenada somente após adaptar todos os leitores.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
DO $$ BEGIN
 IF to_regprocedure('public.atendimento_presencial_concluir(uuid,integer,uuid,integer,text,jsonb)') IS NULL
 OR to_regprocedure('public.atendimento_presencial_negociacao_associar_atendimento(uuid,uuid,uuid,uuid,integer)') IS NULL
 THEN RAISE EXCEPTION 'dependencias_prancheta_unica_ausentes'; END IF;
END $$;
ALTER TABLE public.atendimento_presencial_atendimentos
 ADD COLUMN natureza text NOT NULL DEFAULT 'presencial' CHECK(natureza IN ('presencial','digital')),
 ADD COLUMN negociacao_origem_id uuid REFERENCES public.atendimento_presencial_negociacoes(id) ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE,
 ADD COLUMN canal_digital text CHECK(canal_digital IN ('whatsapp','telefone','outro')),
 ADD COLUMN canal_digital_outro text,
 ADD COLUMN data_comercial timestamptz,
 ADD COLUMN venda_anulada boolean NOT NULL DEFAULT false,
 ADD CONSTRAINT prancheta_natureza_contexto CHECK((natureza='presencial' AND negociacao_origem_id IS NULL AND canal_digital IS NULL AND data_comercial IS NULL AND NOT venda_anulada)
 OR (natureza='digital' AND negociacao_origem_id IS NOT NULL AND canal_digital IS NOT NULL AND data_comercial IS NOT NULL));
ALTER TABLE public.atendimento_presencial_vendas_digitais ADD COLUMN atendimento_id uuid UNIQUE REFERENCES public.atendimento_presencial_atendimentos(id) ON DELETE RESTRICT;
CREATE INDEX ON public.atendimento_presencial_atendimentos(natureza,unidade_id,iniciado_em DESC) WHERE status='concluido';
CREATE TABLE public.atendimento_presencial_digital_config(id boolean PRIMARY KEY DEFAULT true CHECK(id),ativo boolean NOT NULL DEFAULT false);
INSERT INTO public.atendimento_presencial_digital_config VALUES(true,false);
ALTER TABLE public.atendimento_presencial_digital_config ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.atendimento_presencial_digital_config FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.atendimento_presencial_digital_config TO service_role;

CREATE FUNCTION public.atendimento_presencial_proteger_natureza() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public,pg_temp AS $$
BEGIN
 IF TG_OP='INSERT' THEN
  IF NEW.natureza='digital' AND current_setting('prancheta.contexto_digital',true) IS DISTINCT FROM 'criar' THEN RAISE EXCEPTION 'contexto_digital_protegido' USING ERRCODE='42501'; END IF;
 ELSE
  IF (NEW.natureza,NEW.negociacao_origem_id) IS DISTINCT FROM (OLD.natureza,OLD.negociacao_origem_id) THEN RAISE EXCEPTION 'natureza_imutavel' USING ERRCODE='42501'; END IF;
  IF NEW.natureza='digital' THEN
   IF OLD.venda_anulada THEN RAISE EXCEPTION 'venda_anulada_nao_editavel' USING ERRCODE='23514'; END IF;
   IF NEW.status='concluido' AND NEW.resultado_atendimento IS DISTINCT FROM 'sim' THEN RAISE EXCEPTION 'digital_venda_obrigatoria' USING ERRCODE='23514'; END IF;
   IF NEW.cliente_id IS DISTINCT FROM OLD.cliente_id OR NEW.dados_rascunho->>'tipoAtendimento'='nao_cliente' THEN RAISE EXCEPTION 'digital_identidade_protegida' USING ERRCODE='23514'; END IF;
   IF OLD.status='rascunho' AND NEW.status='concluido' AND (current_setting('prancheta.contexto_digital',true) IS DISTINCT FROM 'concluir' OR NEW.resultado_atendimento IS DISTINCT FROM 'sim') THEN RAISE EXCEPTION 'conclusao_digital_protegida' USING ERRCODE='42501'; END IF;
   IF (NEW.canal_digital,NEW.canal_digital_outro,NEW.data_comercial,NEW.venda_anulada) IS DISTINCT FROM (OLD.canal_digital,OLD.canal_digital_outro,OLD.data_comercial,OLD.venda_anulada)
    AND coalesce(current_setting('prancheta.contexto_digital',true),'') NOT IN ('criar','metadados','anular') THEN RAISE EXCEPTION 'metadados_digitais_protegidos' USING ERRCODE='42501'; END IF;
  END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER atendimento_presencial_natureza_protegida BEFORE INSERT OR UPDATE ON public.atendimento_presencial_atendimentos FOR EACH ROW EXECUTE FUNCTION public.atendimento_presencial_proteger_natureza();

CREATE FUNCTION public.atendimento_presencial_digital_criar(p_origem uuid,p_executor uuid,p_operacao uuid,p_unidade uuid,p_dados jsonb,p_canal text,p_outro text,p_data timestamptz)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE n uuid; cliente uuid; id uuid; ev public.atendimento_presencial_negociacao_eventos; pedido jsonb;
BEGIN
 PERFORM public.atendimento_presencial_negociacoes_autorizar(p_executor,p_unidade);
 IF NOT EXISTS(SELECT 1 FROM public.atendimento_presencial_digital_config WHERE ativo) THEN RAISE EXCEPTION 'digital_integral_desativado' USING ERRCODE='42501'; END IF;
 IF p_operacao IS NULL OR p_canal NOT IN ('whatsapp','telefone','outro') OR p_canal IS NULL OR p_data IS NULL OR p_data>now() OR (p_canal='outro' AND length(btrim(coalesce(p_outro,''))) NOT BETWEEN 2 AND 120) THEN RAISE EXCEPTION 'digital_contexto_invalido' USING ERRCODE='23514'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_executor::text||':'||p_operacao::text,1));
 n:=public.atendimento_presencial_negociacao_materializar(p_origem,p_executor);
 SELECT cliente_id INTO cliente FROM public.atendimento_presencial_negociacoes WHERE origem_id=p_origem;
 pedido:=jsonb_build_object('origem',p_origem,'unidade',p_unidade,'dados',p_dados,'canal',p_canal,'outro',p_outro,'data',p_data);
 SELECT * INTO ev FROM public.atendimento_presencial_negociacao_eventos WHERE executor_id=p_executor AND operacao_id=p_operacao;
 IF FOUND THEN
  IF ev.acao<>'criar_digital_integral' OR ev.dados->'pedido' IS DISTINCT FROM pedido THEN RAISE EXCEPTION 'operacao_reutilizada' USING ERRCODE='23514'; END IF;
  RETURN (ev.dados->>'atendimentoId')::uuid;
 END IF;
 IF p_dados->>'tipoAtendimento' IS DISTINCT FROM 'cliente' OR p_dados->>'versaoFluxo' IS DISTINCT FROM '2' OR jsonb_typeof(p_dados->'criancas') IS DISTINCT FROM 'array' OR jsonb_typeof(p_dados->'produtosInteresse') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'digital_ficha_invalida' USING ERRCODE='23514'; END IF;
 PERFORM set_config('prancheta.contexto_digital','criar',true);
 INSERT INTO public.atendimento_presencial_atendimentos(cliente_id,consultora_usuario_id,unidade_id,draft_client_id,dados_rascunho,criado_por,atualizado_por,natureza,negociacao_origem_id,canal_digital,canal_digital_outro,data_comercial)
 VALUES(cliente,p_executor,p_unidade,p_operacao,p_dados,p_executor,p_executor,'digital',n,p_canal,nullif(btrim(p_outro),''),p_data) RETURNING atendimento_presencial_atendimentos.id INTO id;
 PERFORM set_config('prancheta.contexto_digital','',true);
 INSERT INTO public.atendimento_presencial_negociacao_eventos(negociacao_id,executor_id,operacao_id,acao,dados) VALUES(n,p_executor,p_operacao,'criar_digital_integral',jsonb_build_object('atendimentoId',id,'pedido',pedido));
 RETURN id;
END $$;

CREATE FUNCTION public.atendimento_presencial_digital_concluir(p_atendimento_id uuid,p_expected_version integer,p_usuario_id uuid,p_numero_lancamento integer,p_consultora_nome text,p_confirmacao_telefone jsonb DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE a public.atendimento_presencial_atendimentos; n public.atendimento_presencial_negociacoes; referencia uuid;
BEGIN
 SELECT * INTO a FROM public.atendimento_presencial_atendimentos WHERE id=p_atendimento_id FOR UPDATE;
 IF p_expected_version IS NULL OR p_expected_version<1 THEN RAISE EXCEPTION 'version_invalida' USING ERRCODE='23514'; END IF;
 IF a.id IS NULL OR a.natureza<>'digital' THEN RAISE EXCEPTION 'digital_inexistente' USING ERRCODE='23514'; END IF;
 PERFORM public.atendimento_presencial_negociacoes_autorizar(p_usuario_id,a.unidade_id);
 SELECT * INTO n FROM public.atendimento_presencial_negociacoes WHERE id=a.negociacao_origem_id FOR NO KEY UPDATE;
 IF a.status='concluido' THEN
  IF EXISTS(SELECT 1 FROM public.atendimento_presencial_vendas_digitais WHERE atendimento_id=a.id AND status='concluido') THEN RETURN jsonb_build_object('atendimentoId',a.id); END IF;
  RAISE EXCEPTION 'digital_estado_invalido' USING ERRCODE='P0003';
 END IF;
 IF a.cliente_id IS DISTINCT FROM n.cliente_id OR a.dados_rascunho->>'resultadoAtendimento' IS DISTINCT FROM 'sim' OR a.dados_rascunho->>'tipoAtendimento' IS DISTINCT FROM 'cliente' OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(a.dados_rascunho->'produtosInteresse') p WHERE p->'vendido'='true') THEN RAISE EXCEPTION 'digital_venda_obrigatoria' USING ERRCODE='23514'; END IF;
 IF EXISTS(SELECT 1 FROM public.atendimento_presencial_negociacao_encerramentos WHERE negociacao_id=n.id AND NOT anulado) THEN RAISE EXCEPTION 'negociacao_encerrada_digital' USING ERRCODE='P0003'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(a.unidade_id::text||':'||p_numero_lancamento::text,0));
 IF EXISTS(SELECT 1 FROM public.atendimento_presencial_atendimentos WHERE status='concluido' AND NOT venda_anulada AND unidade_id=a.unidade_id AND numero_lancamento=p_numero_lancamento) OR EXISTS(SELECT 1 FROM public.atendimento_presencial_vendas_digitais WHERE status='concluido' AND unidade_id=a.unidade_id AND numero_lancamento=p_numero_lancamento) THEN RAISE EXCEPTION 'lancamento_ja_utilizado' USING ERRCODE='23514'; END IF;
 PERFORM set_config('prancheta.contexto_digital','concluir',true);
 PERFORM public.atendimento_presencial_concluir(a.id,p_expected_version,p_usuario_id,p_numero_lancamento,p_consultora_nome,p_confirmacao_telefone);
 PERFORM set_config('prancheta.contexto_digital','',true);
 INSERT INTO public.atendimento_presencial_vendas_digitais(negociacao_id,cliente_id,unidade_id,responsavel_id,status,dados,numero_lancamento,fechado_em,concluido_em,atendimento_id)
 VALUES(n.id,a.cliente_id,a.unidade_id,p_usuario_id,'concluido',jsonb_build_object('formato','prancheta_integral','atendimentoId',a.id,'canal',a.canal_digital),p_numero_lancamento,a.data_comercial,now(),a.id) RETURNING id INTO referencia;
 INSERT INTO public.atendimento_presencial_negociacao_encerramentos(negociacao_id,tipo,venda_digital_id,executor_id) VALUES(n.id,'digital',referencia,p_usuario_id);
 UPDATE public.atendimento_presencial_negociacoes SET version=version+1 WHERE id=n.id;
 INSERT INTO public.atendimento_presencial_negociacao_eventos(negociacao_id,executor_id,operacao_id,acao,dados) VALUES(n.id,p_usuario_id,a.id,'digital_integral_concluir',jsonb_build_object('atendimentoId',a.id,'digitalId',referencia));
 RETURN jsonb_build_object('atendimentoId',a.id);
END $$;
REVOKE ALL ON FUNCTION public.atendimento_presencial_proteger_natureza(),public.atendimento_presencial_digital_criar(uuid,uuid,uuid,uuid,jsonb,text,text,timestamptz),public.atendimento_presencial_digital_concluir(uuid,integer,uuid,integer,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.atendimento_presencial_digital_criar(uuid,uuid,uuid,uuid,jsonb,text,text,timestamptz),public.atendimento_presencial_digital_concluir(uuid,integer,uuid,integer,text,jsonb) TO service_role;
-- Reutilizar as buscas D-063, agora restringindo candidatos a visitas físicas.
DO $$ DECLARE corpo text; BEGIN
 SELECT pg_get_functiondef(oid) INTO corpo FROM pg_proc WHERE oid='public.atendimento_presencial_negociacoes_candidatos(uuid,uuid,integer,jsonb)'::regprocedure;
 IF position('WHERE a.cliente_id=origem.cliente_id' in corpo)=0 THEN RAISE EXCEPTION 'preflight_candidatos_divergente'; END IF;
 EXECUTE replace(corpo,'WHERE a.cliente_id=origem.cliente_id','WHERE a.natureza=''presencial'' AND a.cliente_id=origem.cliente_id');
END $$;

CREATE FUNCTION public.atendimento_presencial_digital_anular(p_atendimento uuid,p_executor uuid,p_version integer,p_operacao uuid,p_motivo text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE a public.atendimento_presencial_atendimentos; v public.atendimento_presencial_vendas_digitais; n uuid; ev public.atendimento_presencial_negociacao_eventos;
BEGIN
 SELECT * INTO a FROM public.atendimento_presencial_atendimentos WHERE id=p_atendimento FOR UPDATE;
 IF a.id IS NULL OR a.natureza<>'digital' OR a.status<>'concluido' THEN RAISE EXCEPTION 'digital_invalida' USING ERRCODE='23514'; END IF;
 PERFORM public.atendimento_presencial_negociacoes_autorizar(p_executor,a.unidade_id);
 -- Mesmas restrições da edição digital: consultora autora ou supervisão da filial.
 IF p_executor<>a.consultora_usuario_id AND NOT EXISTS(SELECT 1 FROM public.usuarios_permitidos WHERE id=p_executor AND role='superadmin') AND NOT EXISTS(SELECT 1 FROM public.app_usuarios_perfis up JOIN public.app_perfis_acesso p ON p.id=up.perfil_id AND p.ativo JOIN public.app_usuarios_unidades u ON u.usuario_id=up.usuario_id WHERE up.usuario_id=p_executor AND p.chave='supervisora_loja' AND u.unidade_id=a.unidade_id) THEN RAISE EXCEPTION 'access_denied' USING ERRCODE='42501'; END IF;
 IF p_operacao IS NULL OR length(btrim(coalesce(p_motivo,''))) NOT BETWEEN 2 AND 2000 THEN RAISE EXCEPTION 'motivo_obrigatorio' USING ERRCODE='23514'; END IF;
 PERFORM 1 FROM public.atendimento_presencial_negociacoes WHERE id=a.negociacao_origem_id FOR NO KEY UPDATE;
 SELECT * INTO ev FROM public.atendimento_presencial_negociacao_eventos WHERE executor_id=p_executor AND operacao_id=p_operacao;
 IF FOUND THEN
  IF ev.acao<>'digital_integral_anular' OR ev.dados->>'atendimentoId' IS DISTINCT FROM a.id::text OR ev.dados->>'motivo' IS DISTINCT FROM p_motivo THEN RAISE EXCEPTION 'operacao_reutilizada' USING ERRCODE='23514'; END IF;
  RETURN ev.dados;
 END IF;
 IF a.version IS DISTINCT FROM p_version OR a.venda_anulada THEN RAISE EXCEPTION 'version_conflict' USING ERRCODE='P0003'; END IF;
 SELECT * INTO v FROM public.atendimento_presencial_vendas_digitais WHERE atendimento_id=a.id FOR UPDATE;
 IF v.id IS NULL OR v.status<>'concluido' THEN RAISE EXCEPTION 'referencia_digital_invalida' USING ERRCODE='23514'; END IF;
 PERFORM set_config('prancheta.contexto_digital','anular',true);
 UPDATE public.atendimento_presencial_atendimentos SET venda_anulada=true,atualizado_por=p_executor WHERE id=a.id;
 PERFORM set_config('prancheta.contexto_digital','',true);
 UPDATE public.atendimento_presencial_vendas_digitais SET status='anulado',version=version+1,atualizado_em=now() WHERE id=v.id;
 UPDATE public.atendimento_presencial_negociacao_encerramentos SET anulado=true WHERE venda_digital_id=v.id AND NOT anulado;
 UPDATE public.atendimento_presencial_negociacoes SET version=version+1 WHERE id=a.negociacao_origem_id;
 INSERT INTO public.atendimento_presencial_negociacao_eventos(negociacao_id,executor_id,operacao_id,acao,dados) VALUES(a.negociacao_origem_id,p_executor,p_operacao,'digital_integral_anular',jsonb_build_object('atendimentoId',a.id,'motivo',p_motivo));
 -- Estado atual, vínculos e snapshots essenciais são evidências, não estorno de estoque.
 RETURN jsonb_build_object('atendimentoId',a.id);
END $$;
REVOKE ALL ON FUNCTION public.atendimento_presencial_digital_anular(uuid,uuid,integer,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.atendimento_presencial_digital_anular(uuid,uuid,integer,uuid,text) TO service_role;

CREATE FUNCTION public.atendimento_presencial_digital_revisao() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
BEGIN
 IF OLD.natureza='digital' AND OLD.status='concluido' AND NEW.status='concluido' AND NOT NEW.venda_anulada THEN
  IF OLD.venda_anulada THEN RAISE EXCEPTION 'venda_anulada_nao_editavel' USING ERRCODE='23514'; END IF;
  UPDATE public.atendimento_presencial_vendas_digitais SET unidade_id=NEW.unidade_id,numero_lancamento=NEW.numero_lancamento,fechado_em=NEW.data_comercial,version=version+1,atualizado_em=now() WHERE atendimento_id=NEW.id;
  INSERT INTO public.atendimento_presencial_negociacao_eventos(negociacao_id,executor_id,operacao_id,acao,dados) VALUES(NEW.negociacao_origem_id,NEW.atualizado_por,gen_random_uuid(),'digital_integral_corrigir',jsonb_build_object('atendimentoId',NEW.id,'version',NEW.version));
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER atendimento_presencial_digital_revisao AFTER UPDATE ON public.atendimento_presencial_atendimentos FOR EACH ROW EXECUTE FUNCTION public.atendimento_presencial_digital_revisao();
REVOKE ALL ON FUNCTION public.atendimento_presencial_digital_revisao() FROM PUBLIC,anon,authenticated;
-- Impedir edição pelo contrato reduzido quando a fonte é a Prancheta integral.
DO $$ DECLARE corpo text; BEGIN
 SELECT pg_get_functiondef(oid) INTO corpo FROM pg_proc WHERE oid='public.atendimento_presencial_negociacao_digital(uuid,uuid,uuid,text,uuid,integer,jsonb,text)'::regprocedure;
 IF position('SELECT * INTO v FROM public.atendimento_presencial_vendas_digitais WHERE id=p_id FOR UPDATE;' in corpo)=0 THEN RAISE EXCEPTION 'preflight_digital_divergente'; END IF;
 EXECUTE replace(corpo,'SELECT * INTO v FROM public.atendimento_presencial_vendas_digitais WHERE id=p_id FOR UPDATE;', 'SELECT * INTO v FROM public.atendimento_presencial_vendas_digitais WHERE id=p_id FOR UPDATE; IF v.atendimento_id IS NOT NULL OR (v.id IS NULL AND EXISTS(SELECT 1 FROM public.atendimento_presencial_digital_config WHERE ativo)) THEN RAISE EXCEPTION ''usar_prancheta_integral'' USING ERRCODE=''23514''; END IF;');
END $$;
-- D-060: conclusões oficiais não devem bloquear FK de criação de outro rascunho.
DO $$ DECLARE corpo text; BEGIN
 SELECT pg_get_functiondef(oid) INTO corpo FROM pg_proc WHERE oid='public.atendimento_presencial_efetivar_criancas()'::regprocedure;
 IF position('status=''ativo'' FOR UPDATE' in corpo)=0 THEN RAISE EXCEPTION 'preflight_lock_criancas_divergente'; END IF;
 EXECUTE replace(corpo,'status=''ativo'' FOR UPDATE','status=''ativo'' FOR NO KEY UPDATE');
 SELECT pg_get_functiondef(oid) INTO corpo FROM pg_proc WHERE oid='public.atendimento_presencial_concluir(uuid,integer,uuid,integer,text,jsonb)'::regprocedure;
 IF position('WHERE apc.id=v_row.cliente_id FOR SHARE' in corpo)=0 THEN RAISE EXCEPTION 'preflight_lock_cliente_divergente'; END IF;
 EXECUTE replace(corpo,'WHERE apc.id=v_row.cliente_id FOR SHARE','WHERE apc.id=v_row.cliente_id FOR NO KEY UPDATE');
END $$;

CREATE FUNCTION public.atendimento_presencial_digital_editar(p_atendimento_id uuid,p_expected_version integer,p_usuario_id uuid,p_dados jsonb,p_numero_lancamento integer,p_consultora_nome text,p_essenciais jsonb,p_metadados jsonb,p_motivo text)
RETURNS TABLE(id uuid,version integer) LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $fn$
DECLARE a public.atendimento_presencial_atendimentos; data_venda timestamptz; canal text; outro text;
BEGIN
 SELECT * INTO a FROM public.atendimento_presencial_atendimentos WHERE atendimento_presencial_atendimentos.id=p_atendimento_id FOR UPDATE;
 IF a.id IS NULL OR a.natureza<>'digital' OR a.status<>'concluido' OR a.venda_anulada OR a.version IS DISTINCT FROM p_expected_version THEN RAISE EXCEPTION 'version_conflict' USING ERRCODE='P0003'; END IF;
 IF length(btrim(coalesce(p_motivo,''))) NOT BETWEEN 2 AND 2000 THEN RAISE EXCEPTION 'motivo_obrigatorio' USING ERRCODE='23514'; END IF;
 canal:=coalesce(p_metadados->>'canal',a.canal_digital);outro:=coalesce(p_metadados->>'outro',a.canal_digital_outro);data_venda:=coalesce((p_metadados->>'data')::timestamptz,a.data_comercial);
 IF canal NOT IN ('whatsapp','telefone','outro') OR data_venda>now() OR (canal='outro' AND length(btrim(coalesce(outro,''))) NOT BETWEEN 2 AND 120) THEN RAISE EXCEPTION 'digital_contexto_invalido' USING ERRCODE='23514'; END IF;
 BEGIN
  IF jsonb_array_length(p_essenciais)>0 THEN
   PERFORM public.atendimento_presencial_editar_concluido_com_essenciais(a.id,p_expected_version,p_usuario_id,p_dados,p_numero_lancamento,p_consultora_nome,p_essenciais);
  ELSE
   PERFORM public.atendimento_presencial_editar_concluido(a.id,p_expected_version,p_usuario_id,p_dados,p_numero_lancamento,p_consultora_nome);
  END IF;
 EXCEPTION WHEN SQLSTATE 'P0001' THEN IF SQLERRM<>'nenhuma_alteracao' THEN RAISE; END IF;
 END;
 PERFORM set_config('prancheta.contexto_digital','metadados',true);
 UPDATE public.atendimento_presencial_atendimentos SET canal_digital=canal,canal_digital_outro=outro,data_comercial=data_venda,atualizado_por=p_usuario_id WHERE atendimento_presencial_atendimentos.id=a.id;
 PERFORM set_config('prancheta.contexto_digital','',true);
 INSERT INTO public.atendimento_presencial_negociacao_eventos(negociacao_id,executor_id,operacao_id,acao,dados) VALUES(a.negociacao_origem_id,p_usuario_id,gen_random_uuid(),'digital_integral_correcao_motivo',jsonb_build_object('atendimentoId',a.id,'motivo',p_motivo,'anterior',jsonb_build_object('canal',a.canal_digital,'outro',a.canal_digital_outro,'data',a.data_comercial),'novo',p_metadados));
 RETURN QUERY SELECT t.id,t.version FROM public.atendimento_presencial_atendimentos t WHERE t.id=a.id;
END $fn$;
REVOKE ALL ON FUNCTION public.atendimento_presencial_digital_editar(uuid,integer,uuid,jsonb,integer,text,jsonb,jsonb,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.atendimento_presencial_digital_editar(uuid,integer,uuid,jsonb,integer,text,jsonb,jsonb,text) TO service_role;


-- Informação de contexto: rascunhos não são encerramentos nem exclusividade.
DO $contexto$ DECLARE corpo text; BEGIN
 SELECT pg_get_functiondef(oid) INTO corpo FROM pg_proc WHERE oid='public.atendimento_presencial_negociacoes_resumos(uuid,uuid[])'::regprocedure;
 IF position('''atendimentoId'',e.atendimento_id' in corpo)=0 THEN RAISE EXCEPTION 'preflight_resumo_divergente'; END IF;
 EXECUTE replace(corpo,'''atendimentoId'',e.atendimento_id', '''atendimentoId'',coalesce(e.atendimento_id,d.atendimento_id),''rascunhos'',(SELECT count(*) FROM public.atendimento_presencial_atendimentos rd WHERE rd.status=''rascunho'' AND rd.expira_em>now() AND (rd.negociacao_origem_id=coalesce(p.id,n.id) OR EXISTS(SELECT 1 FROM public.atendimento_presencial_negociacao_retornos rr WHERE rr.atendimento_id=rd.id AND rr.negociacao_id=coalesce(p.id,n.id))))+(SELECT count(*) FROM public.atendimento_presencial_vendas_digitais rleg WHERE rleg.negociacao_id=coalesce(p.id,n.id) AND rleg.status=''rascunho'' AND rleg.atendimento_id IS NULL)');
END $contexto$;

COMMIT;
