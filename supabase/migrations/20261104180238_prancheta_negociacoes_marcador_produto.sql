-- Correção compatível; não altera registros existentes nem ACLs da RPC.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
CREATE OR REPLACE FUNCTION public.atendimento_presencial_negociacao_digital(p_origem uuid,p_executor uuid,p_operacao uuid,p_acao text,p_id uuid,p_version integer,p_dados jsonb,p_motivo text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE n public.atendimento_presencial_negociacoes; v public.atendimento_presencial_vendas_digitais; anterior jsonb; e public.atendimento_presencial_negociacao_eventos; item jsonb; unidade uuid; resultado jsonb; papel text; perfil text; pedido jsonb:=p_dados;
BEGIN
 PERFORM public.atendimento_presencial_negociacoes_autorizar(p_executor);
 IF p_acao NOT IN ('rascunho','concluir','corrigir','anular') OR p_id IS NULL OR p_operacao IS NULL THEN RAISE EXCEPTION 'digital_operacao_invalida' USING ERRCODE='23514'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_executor::text||':'||p_operacao::text,1));
 n.id:=public.atendimento_presencial_negociacao_materializar(p_origem,p_executor); SELECT * INTO n FROM public.atendimento_presencial_negociacoes WHERE id=n.id;
 IF p_acao<>'rascunho' THEN SELECT * INTO n FROM public.atendimento_presencial_negociacoes WHERE id=n.id FOR NO KEY UPDATE; END IF;
 SELECT * INTO e FROM public.atendimento_presencial_negociacao_eventos WHERE executor_id=p_executor AND operacao_id=p_operacao;
 IF FOUND THEN
  IF e.negociacao_id<>n.id OR e.acao<>('digital_'||p_acao) OR e.dados->>'id' IS DISTINCT FROM p_id::text OR e.dados->'pedido' IS DISTINCT FROM pedido THEN RAISE EXCEPTION 'operacao_reutilizada' USING ERRCODE='23514'; END IF;
  RETURN e.dados->'resultado';
 END IF;
 SELECT * INTO v FROM public.atendimento_presencial_vendas_digitais WHERE id=p_id FOR UPDATE;
 IF v.id IS NOT NULL THEN
  IF v.negociacao_id<>n.id OR v.version<>p_version THEN RAISE EXCEPTION 'version_conflict' USING ERRCODE='P0003'; END IF;
  SELECT role INTO papel FROM public.usuarios_permitidos WHERE id=p_executor;
  SELECT min(p.chave) INTO perfil FROM public.app_usuarios_perfis a JOIN public.app_perfis_acesso p ON p.id=a.perfil_id AND p.ativo WHERE a.usuario_id=p_executor;
  IF papel<>'superadmin' THEN
   PERFORM public.atendimento_presencial_negociacoes_autorizar(p_executor,v.unidade_id);
   IF perfil='consultora' AND (v.responsavel_id<>p_executor OR (v.status<>'rascunho' AND v.concluido_em<now()-interval '3 days')) THEN RAISE EXCEPTION 'access_denied' USING ERRCODE='42501'; END IF;
   IF v.status<>'rascunho' AND perfil NOT IN ('consultora','supervisora_loja') THEN RAISE EXCEPTION 'access_denied' USING ERRCODE='42501'; END IF;
  END IF;
 END IF;
 anterior:=to_jsonb(v);
 IF p_acao='anular' THEN
  IF v.id IS NULL OR v.status<>'concluido' OR length(btrim(coalesce(p_motivo,''))) NOT BETWEEN 2 AND 2000 THEN RAISE EXCEPTION 'digital_anulacao_invalida' USING ERRCODE='23514'; END IF;
  UPDATE public.atendimento_presencial_vendas_digitais SET status='anulado',version=version+1,atualizado_em=now() WHERE id=v.id RETURNING * INTO v;
  UPDATE public.atendimento_presencial_negociacao_encerramentos SET anulado=true WHERE venda_digital_id=v.id AND NOT anulado;
 ELSE
  unidade:=(p_dados->>'unidadeId')::uuid;
  PERFORM public.atendimento_presencial_negociacoes_autorizar(p_executor,unidade);
  IF jsonb_typeof(p_dados) IS DISTINCT FROM 'object' OR pg_column_size(p_dados)>16384 OR p_dados->>'clienteId' IS DISTINCT FROM n.cliente_id::text THEN RAISE EXCEPTION 'digital_cliente_invalido' USING ERRCODE='23514'; END IF;
  p_dados:=jsonb_set(p_dados,'{negociacaoId}',to_jsonb(n.id::text));
  IF v.id IS NOT NULL AND v.status='anulado' THEN RAISE EXCEPTION 'digital_anulada' USING ERRCODE='23514'; END IF;
  IF p_acao='corrigir' AND (v.id IS NULL OR v.status<>'concluido' OR length(btrim(coalesce(p_motivo,''))) NOT BETWEEN 2 AND 2000) THEN RAISE EXCEPTION 'digital_correcao_invalida' USING ERRCODE='23514'; END IF;
  IF p_acao IN ('rascunho','concluir') AND v.id IS NOT NULL AND v.status<>'rascunho' THEN RAISE EXCEPTION 'digital_ja_concluida' USING ERRCODE='P0003'; END IF;
  IF p_acao<>'rascunho' THEN
   IF p_dados->>'canal' NOT IN ('whatsapp','telefone','outro') OR p_dados->>'canal' IS NULL OR length(btrim(coalesce(p_dados->>'consultora',''))) NOT BETWEEN 2 AND 30 OR (p_dados->>'consultora') !~ '^[A-Z]+( [A-Z]+)*$' OR length(coalesce(p_dados->>'observacoes',''))>2000
    OR (p_dados->>'numeroLancamento')::integer NOT BETWEEN 1 AND 999999 OR p_dados->>'numeroLancamento' IS NULL
    OR (p_dados->>'fechadoEm')::timestamptz>now() OR p_dados->>'fechadoEm' IS NULL
    OR (p_dados->>'fechadoEm')::timestamptz<(SELECT iniciado_em FROM public.atendimento_presencial_atendimentos WHERE id=n.origem_id)
    OR jsonb_typeof(p_dados->'produtos') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'digital_dados_invalidos' USING ERRCODE='23514'; END IF;
   IF p_dados->>'canal'='outro' AND length(btrim(coalesce(p_dados->>'canalOutro','')))<2 THEN RAISE EXCEPTION 'digital_canal_obrigatorio' USING ERRCODE='23514'; END IF;
   IF jsonb_array_length(p_dados->'produtos')>20 OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(p_dados->'produtos') p WHERE p->'vendido'='true') THEN RAISE EXCEPTION 'digital_produto_vendido_obrigatorio' USING ERRCODE='23514'; END IF;
   FOR item IN SELECT value FROM jsonb_array_elements(p_dados->'produtos') LOOP
    -- Marcador informativo reutilizado da Prancheta: não é um item vendido.
    IF upper(item->>'descricao') IN ('PRODUTO QUE NAO TRABALHAMOS','PRODUTO QUE NÃO TRABALHAMOS') AND item->'quantidade'='null'::jsonb AND item->'vendido'='null'::jsonb THEN CONTINUE; END IF;
    IF jsonb_typeof(item) IS DISTINCT FROM 'object' OR length(btrim(coalesce(item->>'descricao',''))) NOT BETWEEN 1 AND 80 OR jsonb_typeof(item->'vendido') IS DISTINCT FROM 'boolean' THEN RAISE EXCEPTION 'digital_produto_invalido' USING ERRCODE='23514'; END IF;
    IF item->'vendido'='true' AND (jsonb_typeof(item->'quantidade') IS DISTINCT FROM 'number' OR (item->>'quantidade') !~ '^[1-9][0-9]*$' OR (item->>'quantidade')::numeric>2147483647) THEN RAISE EXCEPTION 'digital_quantidade_invalida' USING ERRCODE='23514'; END IF;
    IF item->'vendido'='true' AND upper(item->>'descricao') IN ('PRODUTO QUE NAO TRABALHAMOS','PRODUTO QUE NÃO TRABALHAMOS') THEN RAISE EXCEPTION 'digital_produto_invalido' USING ERRCODE='23514'; END IF;
   END LOOP;
   IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_dados->'produtos') p GROUP BY p->>'descricao' HAVING count(*)>1) THEN RAISE EXCEPTION 'digital_produto_duplicado' USING ERRCODE='23514'; END IF;
   PERFORM pg_advisory_xact_lock(hashtextextended(unidade::text||':'||(p_dados->>'numeroLancamento'),0));
   IF EXISTS(SELECT 1 FROM public.atendimento_presencial_atendimentos WHERE unidade_id=unidade AND numero_lancamento=(p_dados->>'numeroLancamento')::integer AND status='concluido' AND resultado_atendimento='sim') THEN RAISE EXCEPTION 'venda_presencial_existente' USING ERRCODE='23514'; END IF;
   IF p_acao='concluir' AND EXISTS(SELECT 1 FROM public.atendimento_presencial_negociacao_encerramentos WHERE negociacao_id=n.id AND NOT anulado) THEN RAISE EXCEPTION 'negociacao_encerrada' USING ERRCODE='P0003'; END IF;
  END IF;
  IF v.id IS NULL THEN
   IF p_version<>0 OR p_acao='corrigir' THEN RAISE EXCEPTION 'version_conflict' USING ERRCODE='P0003'; END IF;
   INSERT INTO public.atendimento_presencial_vendas_digitais(id,negociacao_id,cliente_id,unidade_id,responsavel_id,dados) VALUES(p_id,n.id,n.cliente_id,unidade,p_executor,p_dados) RETURNING * INTO v;
  END IF;
  UPDATE public.atendimento_presencial_vendas_digitais SET dados=p_dados,unidade_id=unidade,version=version+1,atualizado_em=now(),
   status=CASE WHEN p_acao='rascunho' THEN 'rascunho' ELSE 'concluido' END,
   concluido_em=CASE WHEN p_acao='rascunho' THEN NULL ELSE coalesce(concluido_em,now()) END,
   numero_lancamento=CASE WHEN p_acao='rascunho' THEN NULL ELSE (p_dados->>'numeroLancamento')::integer END,
   fechado_em=CASE WHEN p_acao='rascunho' THEN NULL ELSE (p_dados->>'fechadoEm')::timestamptz END WHERE id=v.id RETURNING * INTO v;
  IF p_acao='concluir' THEN INSERT INTO public.atendimento_presencial_negociacao_encerramentos(negociacao_id,tipo,venda_digital_id,executor_id) VALUES(n.id,'digital',v.id,p_executor); END IF;
 END IF;
 IF p_acao<>'rascunho' THEN UPDATE public.atendimento_presencial_negociacoes SET version=version+1 WHERE id=n.id; END IF;
 resultado:=jsonb_build_object('id',v.id,'version',v.version,'status',v.status);
 INSERT INTO public.atendimento_presencial_negociacao_eventos(negociacao_id,executor_id,operacao_id,acao,dados)
 VALUES(n.id,p_executor,p_operacao,'digital_'||p_acao,jsonb_build_object('id',v.id,'pedido',pedido,'anterior',anterior,'novo',to_jsonb(v),'motivo',p_motivo,'resultado',resultado));
 RETURN resultado;
END $$;
COMMIT;
