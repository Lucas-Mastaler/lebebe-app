-- D-060: candidato LOCAL. Aplicação remota exige autorização e preflight atualizado.
-- Rascunhos nunca têm unicidade por cliente/negociação.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
CREATE TABLE public.atendimento_presencial_negociacoes (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 origem_id uuid NOT NULL UNIQUE REFERENCES public.atendimento_presencial_atendimentos(id) ON DELETE RESTRICT,
 cliente_id uuid NOT NULL REFERENCES public.atendimento_presencial_clientes(id) ON DELETE RESTRICT,
 version integer NOT NULL DEFAULT 1 CHECK(version>0),
 criado_por uuid NOT NULL REFERENCES public.usuarios_permitidos(id),
 criado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.atendimento_presencial_negociacoes(cliente_id,criado_em DESC);
CREATE TABLE public.atendimento_presencial_negociacao_retornos (
 atendimento_id uuid PRIMARY KEY REFERENCES public.atendimento_presencial_atendimentos(id) ON DELETE CASCADE,
 negociacao_id uuid NOT NULL REFERENCES public.atendimento_presencial_negociacoes(id) ON DELETE RESTRICT,
 independente boolean NOT NULL DEFAULT false,
 criado_por uuid NOT NULL REFERENCES public.usuarios_permitidos(id),
 criado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.atendimento_presencial_negociacao_retornos(negociacao_id);
CREATE TABLE public.atendimento_presencial_vendas_digitais (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 negociacao_id uuid NOT NULL REFERENCES public.atendimento_presencial_negociacoes(id) ON DELETE RESTRICT,
 cliente_id uuid NOT NULL REFERENCES public.atendimento_presencial_clientes(id) ON DELETE RESTRICT,
 unidade_id uuid NOT NULL REFERENCES public.app_unidades(id) ON DELETE RESTRICT,
 responsavel_id uuid NOT NULL REFERENCES public.usuarios_permitidos(id),
 status text NOT NULL DEFAULT 'rascunho' CHECK(status IN ('rascunho','concluido','anulado')),
 version integer NOT NULL DEFAULT 1 CHECK(version>0),
 dados jsonb NOT NULL DEFAULT '{}' CHECK(jsonb_typeof(dados)='object' AND pg_column_size(dados)<=16384),
 numero_lancamento integer CHECK(numero_lancamento BETWEEN 1 AND 999999),
 fechado_em timestamptz,
 concluido_em timestamptz,
 criado_em timestamptz NOT NULL DEFAULT now(),
 atualizado_em timestamptz NOT NULL DEFAULT now(),
 CHECK(status='rascunho' OR (numero_lancamento IS NOT NULL AND fechado_em IS NOT NULL))
);
CREATE INDEX ON public.atendimento_presencial_vendas_digitais(negociacao_id);
CREATE UNIQUE INDEX ON public.atendimento_presencial_vendas_digitais(unidade_id,numero_lancamento) WHERE status='concluido';
CREATE TABLE public.atendimento_presencial_negociacao_encerramentos (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 negociacao_id uuid NOT NULL REFERENCES public.atendimento_presencial_negociacoes(id) ON DELETE RESTRICT,
 tipo text NOT NULL CHECK(tipo IN ('presencial','digital','perda')),
 atendimento_id uuid REFERENCES public.atendimento_presencial_atendimentos(id) ON DELETE RESTRICT,
 venda_digital_id uuid REFERENCES public.atendimento_presencial_vendas_digitais(id) ON DELETE RESTRICT,
 anulado boolean NOT NULL DEFAULT false,
 dados jsonb NOT NULL DEFAULT '{}' CHECK(jsonb_typeof(dados)='object' AND pg_column_size(dados)<=16384),
 executor_id uuid NOT NULL REFERENCES public.usuarios_permitidos(id),
 registrado_em timestamptz NOT NULL DEFAULT now(),
 CHECK((tipo='presencial' AND atendimento_id IS NOT NULL AND venda_digital_id IS NULL)
 OR (tipo='digital' AND atendimento_id IS NULL AND venda_digital_id IS NOT NULL)
 OR (tipo='perda' AND venda_digital_id IS NULL))
);
CREATE UNIQUE INDEX ON public.atendimento_presencial_negociacao_encerramentos(negociacao_id) WHERE NOT anulado;
CREATE UNIQUE INDEX ON public.atendimento_presencial_negociacao_encerramentos(atendimento_id) WHERE NOT anulado AND atendimento_id IS NOT NULL;
CREATE UNIQUE INDEX ON public.atendimento_presencial_negociacao_encerramentos(venda_digital_id) WHERE NOT anulado AND venda_digital_id IS NOT NULL;
CREATE TABLE public.atendimento_presencial_negociacao_eventos (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 negociacao_id uuid NOT NULL REFERENCES public.atendimento_presencial_negociacoes(id) ON DELETE RESTRICT,
 executor_id uuid NOT NULL REFERENCES public.usuarios_permitidos(id),
 operacao_id uuid NOT NULL,
 acao text NOT NULL,
 dados jsonb NOT NULL CHECK(jsonb_typeof(dados)='object' AND pg_column_size(dados)<=65536),
 registrado_em timestamptz NOT NULL DEFAULT now(),
 UNIQUE(executor_id,operacao_id)
);
CREATE INDEX ON public.atendimento_presencial_negociacao_eventos(negociacao_id,registrado_em DESC);
DO $seguranca$
DECLARE tabela text;
BEGIN
 FOREACH tabela IN ARRAY ARRAY['atendimento_presencial_negociacoes','atendimento_presencial_negociacao_retornos','atendimento_presencial_vendas_digitais','atendimento_presencial_negociacao_encerramentos','atendimento_presencial_negociacao_eventos'] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',tabela);
  EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated',tabela);
  -- Escritas futuras somente pelas RPCs transacionais, nunca diretamente pela API.
  EXECUTE format('GRANT SELECT ON public.%I TO service_role',tabela);
 END LOOP;
END $seguranca$;

-- A identidade do executor vem da sessão autenticada na API; não aceitar do cliente.
CREATE FUNCTION public.atendimento_presencial_negociacoes_autorizar(p_executor uuid,p_unidade uuid DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE papel text;
BEGIN
 SELECT role INTO papel FROM public.usuarios_permitidos WHERE id=p_executor AND ativo;
 IF papel IS NULL THEN RAISE EXCEPTION 'access_denied' USING ERRCODE='42501'; END IF;
 IF p_unidade IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.app_unidades WHERE id=p_unidade AND ativo) THEN RAISE EXCEPTION 'unidade_inativa' USING ERRCODE='42501'; END IF;
 IF papel='superadmin' THEN RETURN; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.app_usuarios_unidades v JOIN public.app_unidades u ON u.id=v.unidade_id AND u.ativo WHERE v.usuario_id=p_executor AND (p_unidade IS NULL OR u.id=p_unidade))
 OR NOT EXISTS(SELECT 1 FROM public.app_modulos m
 LEFT JOIN public.app_permissoes_usuario pu ON pu.modulo_id=m.id AND pu.usuario_id=p_executor
 LEFT JOIN public.app_usuarios_perfis up ON up.usuario_id=p_executor
 LEFT JOIN public.app_perfis_acesso pa ON pa.id=up.perfil_id AND pa.ativo
 LEFT JOIN public.app_permissoes_perfil pp ON pp.modulo_id=m.id AND pp.perfil_id=pa.id
 WHERE m.chave IN ('atendimento_presencial_ficha','atendimento_presencial_registros') AND m.ativo AND NOT m.publico AND NOT m.somente_superadmin
 AND (pu.permitido=true OR (pu.permitido IS NULL AND pp.permitido=true))) THEN RAISE EXCEPTION 'access_denied' USING ERRCODE='42501'; END IF;
END $$;

CREATE FUNCTION public.atendimento_presencial_negociacao_materializar(p_origem uuid,p_executor uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE a public.atendimento_presencial_atendimentos; resultado uuid;
BEGIN
 PERFORM public.atendimento_presencial_negociacoes_autorizar(p_executor);
 SELECT * INTO a FROM public.atendimento_presencial_atendimentos WHERE id=p_origem FOR SHARE;
 IF a.id IS NULL OR a.status<>'concluido' OR a.resultado_atendimento<>'negociacao' OR a.cliente_id IS NULL OR NOT EXISTS(SELECT 1 FROM public.atendimento_presencial_clientes WHERE id=a.cliente_id AND status='ativo') THEN RAISE EXCEPTION 'negociacao_origem_invalida' USING ERRCODE='23514'; END IF;
 SELECT id INTO resultado FROM public.atendimento_presencial_negociacoes WHERE origem_id=a.id AND cliente_id=a.cliente_id;
 IF resultado IS NULL THEN
  INSERT INTO public.atendimento_presencial_negociacoes(origem_id,cliente_id,criado_por) VALUES(a.id,a.cliente_id,p_executor) ON CONFLICT(origem_id) DO NOTHING;
  SELECT id INTO resultado FROM public.atendimento_presencial_negociacoes WHERE origem_id=a.id AND cliente_id=a.cliente_id;
 END IF;
 IF resultado IS NULL THEN RAISE EXCEPTION 'negociacao_cliente_divergente' USING ERRCODE='23514'; END IF;
 RETURN resultado;
END $$;

CREATE FUNCTION public.atendimento_presencial_negociacao_vincular(p_origem uuid,p_venda uuid,p_executor uuid,p_operacao uuid,p_version integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE n public.atendimento_presencial_negociacoes; a public.atendimento_presencial_atendimentos; repetida public.atendimento_presencial_negociacao_eventos; fechamento uuid;
BEGIN
 PERFORM public.atendimento_presencial_negociacoes_autorizar(p_executor);
 n.id:=public.atendimento_presencial_negociacao_materializar(p_origem,p_executor); SELECT * INTO n FROM public.atendimento_presencial_negociacoes WHERE id=n.id FOR NO KEY UPDATE;
 SELECT * INTO repetida FROM public.atendimento_presencial_negociacao_eventos WHERE executor_id=p_executor AND operacao_id=p_operacao;
 IF FOUND THEN
  IF repetida.negociacao_id<>n.id OR repetida.acao<>'vincular' OR repetida.dados->>'vendaId' IS DISTINCT FROM p_venda::text THEN RAISE EXCEPTION 'operacao_reutilizada' USING ERRCODE='23514'; END IF;
  RETURN repetida.dados;
 END IF;
 IF n.version<>p_version THEN RAISE EXCEPTION 'version_conflict' USING ERRCODE='P0003'; END IF;
 IF EXISTS(SELECT 1 FROM public.atendimento_presencial_negociacao_encerramentos WHERE negociacao_id=n.id AND NOT anulado) THEN RAISE EXCEPTION 'negociacao_encerrada' USING ERRCODE='P0003'; END IF;
 SELECT * INTO a FROM public.atendimento_presencial_atendimentos WHERE id=p_venda FOR UPDATE;
 IF a.id IS NULL OR a.status<>'concluido' OR a.resultado_atendimento<>'sim' OR a.cliente_id IS DISTINCT FROM n.cliente_id OR a.iniciado_em<(SELECT iniciado_em FROM public.atendimento_presencial_atendimentos WHERE id=n.origem_id) THEN RAISE EXCEPTION 'venda_incompativel' USING ERRCODE='23514'; END IF;
 IF EXISTS(SELECT 1 FROM public.atendimento_presencial_negociacao_encerramentos WHERE atendimento_id=a.id AND NOT anulado) THEN RAISE EXCEPTION 'venda_ja_vinculada' USING ERRCODE='P0003'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(a.unidade_id::text||':'||a.numero_lancamento::text,0));
 IF EXISTS(SELECT 1 FROM public.atendimento_presencial_negociacao_encerramentos e JOIN public.atendimento_presencial_atendimentos v ON v.id=e.atendimento_id WHERE NOT e.anulado AND v.unidade_id=a.unidade_id AND v.numero_lancamento=a.numero_lancamento)
 OR EXISTS(SELECT 1 FROM public.atendimento_presencial_vendas_digitais WHERE unidade_id=a.unidade_id AND numero_lancamento=a.numero_lancamento AND status='concluido') THEN RAISE EXCEPTION 'lancamento_ja_utilizado' USING ERRCODE='23514'; END IF;
 INSERT INTO public.atendimento_presencial_negociacao_encerramentos(negociacao_id,tipo,atendimento_id,executor_id) VALUES(n.id,'presencial',a.id,p_executor) RETURNING id INTO fechamento;
 UPDATE public.atendimento_presencial_negociacoes SET version=version+1 WHERE id=n.id;
 INSERT INTO public.atendimento_presencial_negociacao_eventos(negociacao_id,executor_id,operacao_id,acao,dados) VALUES(n.id,p_executor,p_operacao,'vincular',jsonb_build_object('vendaId',a.id,'encerramentoId',fechamento));
 RETURN jsonb_build_object('vendaId',a.id,'encerramentoId',fechamento);
END $$;

-- Idempotência por tentativa, jamais por cliente ou negociação.
CREATE FUNCTION public.atendimento_presencial_negociacao_criar_retorno(p_origem uuid,p_executor uuid,p_operacao uuid,p_unidade uuid,p_dados jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE negociacao uuid; cliente uuid; atendimento uuid; repetida public.atendimento_presencial_negociacao_eventos; limpo jsonb;
BEGIN
 PERFORM public.atendimento_presencial_negociacoes_autorizar(p_executor,p_unidade);
 -- Serializa somente retries da MESMA operação, nunca outros rascunhos.
 PERFORM pg_advisory_xact_lock(hashtextextended(p_executor::text||':'||p_operacao::text,1));
 negociacao:=public.atendimento_presencial_negociacao_materializar(p_origem,p_executor);
 SELECT cliente_id INTO cliente FROM public.atendimento_presencial_negociacoes WHERE id=negociacao;
 -- Não consulta encerramentos nem outros rascunhos: todos permanecem independentes.
 SELECT * INTO repetida FROM public.atendimento_presencial_negociacao_eventos WHERE executor_id=p_executor AND operacao_id=p_operacao;
 IF FOUND THEN
  IF repetida.negociacao_id<>negociacao OR repetida.acao<>'criar_retorno' OR repetida.dados->'pedido' IS DISTINCT FROM jsonb_build_object('unidade',p_unidade,'dados',p_dados) THEN RAISE EXCEPTION 'operacao_reutilizada' USING ERRCODE='23514'; END IF;
  RETURN (repetida.dados->>'atendimentoId')::uuid;
 END IF;
 -- Rascunho ainda não tem resultado: não executar o normalizador de conclusão.
 IF jsonb_typeof(p_dados) IS DISTINCT FROM 'object' OR pg_column_size(p_dados)>16384
 OR jsonb_typeof(p_dados->'criancas') IS DISTINCT FROM 'array'
 OR jsonb_typeof(p_dados->'produtosInteresse') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'retorno_invalido' USING ERRCODE='23514'; END IF;
 limpo:=p_dados;
 IF limpo->>'tipoAtendimento' IS DISTINCT FROM 'cliente' OR limpo->>'versaoFluxo' IS DISTINCT FROM '2' THEN RAISE EXCEPTION 'retorno_invalido' USING ERRCODE='23514'; END IF;
 INSERT INTO public.atendimento_presencial_atendimentos(cliente_id,consultora_usuario_id,unidade_id,draft_client_id,dados_rascunho,iniciado_em,ultima_atividade_em,expira_em,criado_por,atualizado_por)
 VALUES(cliente,p_executor,p_unidade,p_operacao,limpo,now(),now(),now()+interval '5 days',p_executor,p_executor) RETURNING id INTO atendimento;
 INSERT INTO public.atendimento_presencial_negociacao_retornos(atendimento_id,negociacao_id,criado_por) VALUES(atendimento,negociacao,p_executor);
 INSERT INTO public.atendimento_presencial_negociacao_eventos(negociacao_id,executor_id,operacao_id,acao,dados) VALUES(negociacao,p_executor,p_operacao,'criar_retorno',jsonb_build_object('atendimentoId',atendimento,'pedido',jsonb_build_object('unidade',p_unidade,'dados',p_dados)));
 RETURN atendimento;
END $$;

REVOKE ALL ON FUNCTION public.atendimento_presencial_negociacoes_autorizar(uuid,uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.atendimento_presencial_negociacao_materializar(uuid,uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.atendimento_presencial_negociacao_vincular(uuid,uuid,uuid,uuid,integer) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.atendimento_presencial_negociacao_criar_retorno(uuid,uuid,uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.atendimento_presencial_negociacoes_autorizar(uuid,uuid),public.atendimento_presencial_negociacao_materializar(uuid,uuid),public.atendimento_presencial_negociacao_vincular(uuid,uuid,uuid,uuid,integer),public.atendimento_presencial_negociacao_criar_retorno(uuid,uuid,uuid,uuid,jsonb) TO service_role;

CREATE FUNCTION public.atendimento_presencial_negociacao_digital(p_origem uuid,p_executor uuid,p_operacao uuid,p_acao text,p_id uuid,p_version integer,p_dados jsonb,p_motivo text DEFAULT NULL)
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
REVOKE ALL ON FUNCTION public.atendimento_presencial_negociacao_digital(uuid,uuid,uuid,text,uuid,integer,jsonb,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.atendimento_presencial_negociacao_digital(uuid,uuid,uuid,text,uuid,integer,jsonb,text) TO service_role;

CREATE FUNCTION public.atendimento_presencial_negociacoes_buscar(p_executor uuid,p_pagina integer DEFAULT 1,p_filtros jsonb DEFAULT '{}')
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE resultado jsonb; total bigint; papel text;
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
 IF p_pagina<1 OR p_pagina>100000 OR jsonb_typeof(p_filtros) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'filtros_invalidos' USING ERRCODE='23514'; END IF;
 WITH candidatos AS (
  SELECT a.id AS origem_id,n.id AS negociacao_id,coalesce(n.version,1) version,a.cliente_id,c.nome,c.telefone_informado,
   a.iniciado_em,a.consultora_nome,u.nome filial,a.unidade_id,
   CASE WHEN e.id IS NULL THEN 'aberta' WHEN e.tipo='perda' THEN 'perda' ELSE 'venda' END situacao,e.tipo canal_encerramento,
   e.registrado_em encerrado_em,e.atendimento_id venda_id
  FROM public.atendimento_presencial_atendimentos a JOIN public.atendimento_presencial_clientes c ON c.id=a.cliente_id
  JOIN public.app_unidades u ON u.id=a.unidade_id
  LEFT JOIN public.atendimento_presencial_negociacoes n ON n.origem_id=a.id
  LEFT JOIN public.atendimento_presencial_negociacao_encerramentos e ON e.negociacao_id=n.id AND NOT e.anulado
  WHERE a.status='concluido' AND a.resultado_atendimento='negociacao'
   AND NOT EXISTS(SELECT 1 FROM public.atendimento_presencial_negociacao_retornos r WHERE r.atendimento_id=a.id AND NOT r.independente)
   AND (nullif(p_filtros->>'origemId','') IS NULL OR a.id=(p_filtros->>'origemId')::uuid)
   AND (nullif(p_filtros->>'clienteId','') IS NULL OR a.cliente_id=(p_filtros->>'clienteId')::uuid)
   AND (nullif(p_filtros->>'nome','') IS NULL OR c.nome ILIKE '%'||(p_filtros->>'nome')||'%')
   AND (nullif(p_filtros->>'telefone','') IS NULL OR c.telefone_normalizado LIKE '%'||regexp_replace(p_filtros->>'telefone','[^0-9]','','g')||'%')
   AND (nullif(p_filtros->>'de','') IS NULL OR (a.iniciado_em AT TIME ZONE 'America/Sao_Paulo')::date>=(p_filtros->>'de')::date)
   AND (nullif(p_filtros->>'ate','') IS NULL OR (a.iniciado_em AT TIME ZONE 'America/Sao_Paulo')::date<=(p_filtros->>'ate')::date)
 ), filtrados AS (
  SELECT * FROM candidatos WHERE (nullif(p_filtros->>'situacao','') IS NULL OR situacao=p_filtros->>'situacao')
   AND (nullif(p_filtros->>'canal','') IS NULL OR canal_encerramento=p_filtros->>'canal')
 ), paginados AS (SELECT * FROM filtrados ORDER BY iniciado_em DESC,origem_id LIMIT 20 OFFSET (p_pagina-1)*20)
 SELECT (SELECT count(*) FROM filtrados),coalesce(jsonb_agg(to_jsonb(p) || jsonb_build_object(
  'interesses',coalesce((SELECT jsonb_agg(jsonb_build_object('descricao',i.descricao,'quantidade',i.quantidade,'vendido',false) ORDER BY i.ordem) FROM public.atendimento_presencial_produtos_interesse i WHERE i.atendimento_id=p.origem_id AND i.vendido IS DISTINCT FROM true),'[]'::jsonb),
  'digitais',coalesce((SELECT jsonb_agg(to_jsonb(d) ORDER BY d.criado_em DESC) FROM public.atendimento_presencial_vendas_digitais d WHERE d.negociacao_id=p.negociacao_id AND (d.status<>'rascunho' OR d.responsavel_id=p_executor OR papel='superadmin' OR EXISTS(SELECT 1 FROM public.app_usuarios_perfis up JOIN public.app_perfis_acesso pa ON pa.id=up.perfil_id AND pa.ativo JOIN public.app_usuarios_unidades au ON au.usuario_id=up.usuario_id AND au.unidade_id=d.unidade_id WHERE up.usuario_id=p_executor AND pa.chave<>'consultora'))),'[]'::jsonb),
  'retornos',CASE WHEN nullif(p_filtros->>'origemId','') IS NOT NULL THEN coalesce((SELECT jsonb_agg(jsonb_build_object('id',v.id,'concluidoEm',v.concluido_em,'resultado',v.resultado_atendimento,'filial',u.nome,'consultora',v.consultora_nome,'independente',r.independente) ORDER BY v.concluido_em DESC) FROM public.atendimento_presencial_negociacao_retornos r JOIN public.atendimento_presencial_atendimentos v ON v.id=r.atendimento_id AND v.status='concluido' JOIN public.app_unidades u ON u.id=v.unidade_id WHERE r.negociacao_id=p.negociacao_id),'[]'::jsonb) ELSE '[]'::jsonb END,
  'eventos',CASE WHEN nullif(p_filtros->>'origemId','') IS NOT NULL THEN coalesce((SELECT jsonb_agg(to_jsonb(ev) ORDER BY ev.registrado_em DESC) FROM public.atendimento_presencial_negociacao_eventos ev WHERE ev.negociacao_id=p.negociacao_id AND (ev.acao NOT IN ('digital_rascunho','criar_retorno') OR ev.executor_id=p_executor OR papel='superadmin')),'[]'::jsonb) ELSE '[]'::jsonb END
 ) ORDER BY p.iniciado_em DESC,p.origem_id),'[]'::jsonb) INTO total,resultado FROM paginados p;
 RETURN jsonb_build_object('negociacoes',resultado,'total',total,'pagina',p_pagina,'pageSize',20);
END $$;
REVOKE ALL ON FUNCTION public.atendimento_presencial_negociacoes_buscar(uuid,integer,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.atendimento_presencial_negociacoes_buscar(uuid,integer,jsonb) TO service_role;

CREATE FUNCTION public.atendimento_presencial_negociacao_concluir_retorno(p_atendimento_id uuid,p_expected_version integer,p_usuario_id uuid,p_numero_lancamento integer DEFAULT NULL,p_consultora_nome text DEFAULT NULL,p_confirmacao_telefone jsonb DEFAULT NULL,p_independente boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE r public.atendimento_presencial_negociacao_retornos; n public.atendimento_presencial_negociacoes; a public.atendimento_presencial_atendimentos; retorno record;
BEGIN
 PERFORM public.atendimento_presencial_negociacoes_autorizar(p_usuario_id);
 SELECT * INTO r FROM public.atendimento_presencial_negociacao_retornos WHERE atendimento_id=p_atendimento_id;
 IF r.atendimento_id IS NULL THEN RAISE EXCEPTION 'retorno_nao_encontrado' USING ERRCODE='23514'; END IF;
 SELECT * INTO n FROM public.atendimento_presencial_negociacoes WHERE id=r.negociacao_id FOR NO KEY UPDATE;
 SELECT * INTO a FROM public.atendimento_presencial_atendimentos WHERE id=p_atendimento_id FOR UPDATE;
 IF a.cliente_id IS DISTINCT FROM n.cliente_id THEN RAISE EXCEPTION 'negociacao_cliente_divergente' USING ERRCODE='23514'; END IF;
 IF NOT p_independente AND NOT r.independente AND EXISTS(SELECT 1 FROM public.atendimento_presencial_negociacao_encerramentos WHERE negociacao_id=n.id AND NOT anulado) THEN RAISE EXCEPTION 'negociacao_encerrada_confirmar_independente' USING ERRCODE='P0003'; END IF;
 -- Reutiliza validações, permissões, controle de versão e triggers oficiais.
 SELECT * INTO retorno FROM public.atendimento_presencial_concluir(p_atendimento_id,p_expected_version,p_usuario_id,p_numero_lancamento,p_consultora_nome,p_confirmacao_telefone);
 IF p_independente OR r.independente THEN
  UPDATE public.atendimento_presencial_negociacao_retornos SET independente=true WHERE atendimento_id=a.id;
 ELSE
  SELECT * INTO a FROM public.atendimento_presencial_atendimentos WHERE id=p_atendimento_id;
  IF a.resultado_atendimento IN ('sim','nao') THEN
   INSERT INTO public.atendimento_presencial_negociacao_encerramentos(negociacao_id,tipo,atendimento_id,executor_id) VALUES(n.id,CASE WHEN a.resultado_atendimento='sim' THEN 'presencial' ELSE 'perda' END,a.id,p_usuario_id);
   UPDATE public.atendimento_presencial_negociacoes SET version=version+1 WHERE id=n.id;
  END IF;
 END IF;
 INSERT INTO public.atendimento_presencial_negociacao_eventos(negociacao_id,executor_id,operacao_id,acao,dados)
 VALUES(n.id,p_usuario_id,a.id,'concluir_retorno',jsonb_build_object('atendimentoId',a.id,'independente',p_independente OR r.independente));
 RETURN jsonb_build_object('id',retorno.id,'version',retorno.version);
END $$;

CREATE FUNCTION public.atendimento_presencial_negociacao_encerrar(p_origem uuid,p_executor uuid,p_operacao uuid,p_version integer,p_acao text,p_dados jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE n public.atendimento_presencial_negociacoes; e public.atendimento_presencial_negociacao_eventos; c public.atendimento_presencial_negociacao_encerramentos; motivo text;
BEGIN
 PERFORM public.atendimento_presencial_negociacoes_autorizar(p_executor);
 n.id:=public.atendimento_presencial_negociacao_materializar(p_origem,p_executor); SELECT * INTO n FROM public.atendimento_presencial_negociacoes WHERE id=n.id FOR NO KEY UPDATE;
 SELECT * INTO e FROM public.atendimento_presencial_negociacao_eventos WHERE executor_id=p_executor AND operacao_id=p_operacao;
 IF FOUND THEN
  IF e.negociacao_id<>n.id OR e.acao<>p_acao OR e.dados->'pedido' IS DISTINCT FROM p_dados THEN RAISE EXCEPTION 'operacao_reutilizada' USING ERRCODE='23514'; END IF;
  RETURN e.dados;
 END IF;
 IF n.version<>p_version THEN RAISE EXCEPTION 'version_conflict' USING ERRCODE='P0003'; END IF;
 SELECT * INTO c FROM public.atendimento_presencial_negociacao_encerramentos WHERE negociacao_id=n.id AND NOT anulado;
 IF p_acao='perda' THEN
  IF c.id IS NOT NULL THEN RAISE EXCEPTION 'negociacao_encerrada' USING ERRCODE='P0003'; END IF;
  motivo:=p_dados->>'motivo';
  IF motivo IS NULL OR motivo NOT IN ('cor_diferente','nao_coube_quarto','sem_estoque','produto_caro','frete_caro','outra_loja_fisica','outra_loja_internet','nao_respondeu','prazo_entrega','cliente_retira') OR length(coalesce(p_dados->>'observacoes',''))>300 THEN RAISE EXCEPTION 'motivo_perda_invalido' USING ERRCODE='23514'; END IF;
  INSERT INTO public.atendimento_presencial_negociacao_encerramentos(negociacao_id,tipo,dados,executor_id) VALUES(n.id,'perda',p_dados,p_executor);
 ELSIF p_acao='desvincular' THEN
  IF c.id IS NULL OR c.tipo<>'presencial' OR length(btrim(coalesce(p_dados->>'motivo','')))<2 THEN RAISE EXCEPTION 'correcao_vinculo_invalida' USING ERRCODE='23514'; END IF;
  UPDATE public.atendimento_presencial_negociacao_encerramentos SET anulado=true WHERE id=c.id;
 ELSE RAISE EXCEPTION 'operacao_invalida' USING ERRCODE='23514'; END IF;
 UPDATE public.atendimento_presencial_negociacoes SET version=version+1 WHERE id=n.id;
 INSERT INTO public.atendimento_presencial_negociacao_eventos(negociacao_id,executor_id,operacao_id,acao,dados) VALUES(n.id,p_executor,p_operacao,p_acao,jsonb_build_object('pedido',p_dados,'encerramentoAnterior',to_jsonb(c)));
 RETURN jsonb_build_object('version',n.version+1);
END $$;
REVOKE ALL ON FUNCTION public.atendimento_presencial_negociacao_concluir_retorno(uuid,integer,uuid,integer,text,jsonb,boolean),public.atendimento_presencial_negociacao_encerrar(uuid,uuid,uuid,integer,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.atendimento_presencial_negociacao_concluir_retorno(uuid,integer,uuid,integer,text,jsonb,boolean),public.atendimento_presencial_negociacao_encerrar(uuid,uuid,uuid,integer,text,jsonb) TO service_role;

CREATE FUNCTION public.atendimento_presencial_negociacao_corrigir_vinculo(p_origem uuid,p_nova_origem uuid,p_executor uuid,p_operacao uuid,p_version integer,p_nova_version integer,p_motivo text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE antiga uuid; nova uuid; venda uuid; dados jsonb; anterior public.atendimento_presencial_negociacao_eventos;
BEGIN
 PERFORM public.atendimento_presencial_negociacoes_autorizar(p_executor);
 IF p_origem=p_nova_origem OR length(btrim(coalesce(p_motivo,''))) NOT BETWEEN 2 AND 2000 THEN RAISE EXCEPTION 'correcao_vinculo_invalida' USING ERRCODE='23514'; END IF;
 antiga:=public.atendimento_presencial_negociacao_materializar(p_origem,p_executor);
 nova:=public.atendimento_presencial_negociacao_materializar(p_nova_origem,p_executor);
 PERFORM 1 FROM public.atendimento_presencial_negociacoes WHERE id IN (antiga,nova) ORDER BY id FOR NO KEY UPDATE;
 SELECT * INTO anterior FROM public.atendimento_presencial_negociacao_eventos WHERE executor_id=p_executor AND operacao_id=p_operacao;
 IF FOUND THEN
  IF anterior.acao<>'corrigir_vinculo' OR anterior.negociacao_id<>antiga OR anterior.dados->>'novaOrigem' IS DISTINCT FROM p_nova_origem::text THEN RAISE EXCEPTION 'operacao_reutilizada' USING ERRCODE='23514'; END IF;
  RETURN anterior.dados;
 END IF;
 SELECT atendimento_id INTO venda FROM public.atendimento_presencial_negociacao_encerramentos WHERE negociacao_id=antiga AND NOT anulado AND tipo='presencial';
 IF venda IS NULL THEN RAISE EXCEPTION 'vinculo_nao_encontrado' USING ERRCODE='23514'; END IF;
 PERFORM public.atendimento_presencial_negociacao_encerrar(p_origem,p_executor,gen_random_uuid(),p_version,'desvincular',jsonb_build_object('motivo',p_motivo));
 dados:=public.atendimento_presencial_negociacao_vincular(p_nova_origem,venda,p_executor,gen_random_uuid(),p_nova_version);
 INSERT INTO public.atendimento_presencial_negociacao_eventos(negociacao_id,executor_id,operacao_id,acao,dados) VALUES(antiga,p_executor,p_operacao,'corrigir_vinculo',dados||jsonb_build_object('novaOrigem',p_nova_origem,'motivo',p_motivo));
 RETURN dados;
END $$;
REVOKE ALL ON FUNCTION public.atendimento_presencial_negociacao_corrigir_vinculo(uuid,uuid,uuid,uuid,integer,integer,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.atendimento_presencial_negociacao_corrigir_vinculo(uuid,uuid,uuid,uuid,integer,integer,text) TO service_role;

CREATE FUNCTION public.atendimento_presencial_negociacao_proteger_visita()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public,pg_temp AS $$
BEGIN
 -- Também protege a conclusão presencial normal contra duplicar venda digital.
 IF NEW.status='concluido' AND NEW.resultado_atendimento='sim' AND NEW.numero_lancamento IS NOT NULL
 AND (OLD.status IS DISTINCT FROM NEW.status OR OLD.numero_lancamento IS DISTINCT FROM NEW.numero_lancamento OR OLD.unidade_id IS DISTINCT FROM NEW.unidade_id) THEN
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.unidade_id::text||':'||NEW.numero_lancamento::text,0));
  IF EXISTS(SELECT 1 FROM public.atendimento_presencial_vendas_digitais WHERE unidade_id=NEW.unidade_id AND numero_lancamento=NEW.numero_lancamento AND status='concluido') THEN
   RAISE EXCEPTION 'venda_digital_existente' USING ERRCODE='23514';
  END IF;
 END IF;
 IF OLD.status='concluido' AND (NEW.cliente_id IS DISTINCT FROM OLD.cliente_id OR NEW.resultado_atendimento IS DISTINCT FROM OLD.resultado_atendimento)
 AND (EXISTS(SELECT 1 FROM public.atendimento_presencial_negociacoes WHERE origem_id=OLD.id)
 OR EXISTS(SELECT 1 FROM public.atendimento_presencial_negociacao_retornos WHERE atendimento_id=OLD.id AND NOT independente)
 OR EXISTS(SELECT 1 FROM public.atendimento_presencial_negociacao_encerramentos WHERE atendimento_id=OLD.id AND NOT anulado)) THEN
  RAISE EXCEPTION 'negociacao_visita_vinculada_use_atualizacao_comercial' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER atendimento_presencial_negociacao_proteger_visita BEFORE UPDATE ON public.atendimento_presencial_atendimentos FOR EACH ROW EXECUTE FUNCTION public.atendimento_presencial_negociacao_proteger_visita();
REVOKE ALL ON FUNCTION public.atendimento_presencial_negociacao_proteger_visita() FROM PUBLIC,anon,authenticated;
COMMIT;
