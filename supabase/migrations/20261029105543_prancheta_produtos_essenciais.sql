-- Somente preparação local. NÃO APLICADA. Ativação é uma operação separada.
BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '30s';

CREATE TABLE public.atendimento_presencial_essenciais_config (
 id boolean PRIMARY KEY DEFAULT true CHECK(id), ativo boolean NOT NULL DEFAULT false
);
INSERT INTO public.atendimento_presencial_essenciais_config(id,ativo) VALUES(true,false);
ALTER TABLE public.atendimento_presencial_atendimentos ADD COLUMN versao_essenciais smallint CHECK(versao_essenciais=1);

CREATE TABLE public.atendimento_presencial_essenciais_estado (
 crianca_id uuid NOT NULL REFERENCES public.atendimento_presencial_criancas_cadastro(id),
 produto text NOT NULL, resposta text NOT NULL CHECK(resposta IN ('sim','nao')),
 atendimento_id uuid NOT NULL REFERENCES public.atendimento_presencial_atendimentos(id),
 registrado_em timestamptz NOT NULL, PRIMARY KEY(crianca_id,produto)
);
CREATE INDEX ON public.atendimento_presencial_essenciais_estado(atendimento_id);
CREATE TABLE public.atendimento_presencial_essenciais_snapshots (
 atendimento_id uuid NOT NULL REFERENCES public.atendimento_presencial_atendimentos(id),
 crianca_id uuid NOT NULL REFERENCES public.atendimento_presencial_criancas_cadastro(id),
 cliente_id uuid NOT NULL REFERENCES public.atendimento_presencial_clientes(id),
 nome text NOT NULL, fase integer NOT NULL, respostas jsonb NOT NULL CHECK(jsonb_typeof(respostas)='array'),
 filial text NOT NULL, consultora text NOT NULL,
 registrado_em timestamptz NOT NULL, PRIMARY KEY(atendimento_id,crianca_id)
);
CREATE INDEX ON public.atendimento_presencial_essenciais_snapshots(cliente_id,registrado_em DESC,atendimento_id,crianca_id);
CREATE INDEX ON public.atendimento_presencial_essenciais_snapshots(crianca_id);
CREATE TABLE public.atendimento_presencial_essenciais_eventos (
 atendimento_id uuid NOT NULL, crianca_id uuid NOT NULL, produto text NOT NULL,
 anterior text CHECK(anterior IN ('sim','nao')), resposta text NOT NULL CHECK(resposta IN ('sim','nao')),
 executor_id uuid NOT NULL REFERENCES public.usuarios_permitidos(id), registrado_em timestamptz NOT NULL,
 PRIMARY KEY(atendimento_id,crianca_id,produto),
 FOREIGN KEY(atendimento_id,crianca_id) REFERENCES public.atendimento_presencial_essenciais_snapshots(atendimento_id,crianca_id)
);
CREATE INDEX ON public.atendimento_presencial_essenciais_eventos(crianca_id,produto,registrado_em DESC);
CREATE INDEX ON public.atendimento_presencial_essenciais_eventos(executor_id);

ALTER TABLE public.atendimento_presencial_essenciais_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.atendimento_presencial_essenciais_estado ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.atendimento_presencial_essenciais_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.atendimento_presencial_essenciais_eventos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.atendimento_presencial_essenciais_config, public.atendimento_presencial_essenciais_estado,
 public.atendimento_presencial_essenciais_snapshots, public.atendimento_presencial_essenciais_eventos FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.atendimento_presencial_essenciais_config, public.atendimento_presencial_essenciais_estado,
 public.atendimento_presencial_essenciais_snapshots, public.atendimento_presencial_essenciais_eventos TO service_role;

CREATE FUNCTION public.atendimento_presencial_essenciais_produtos(p_fase integer) RETURNS text[]
LANGUAGE sql IMMUTABLE SET search_path=pg_catalog,public,pg_temp AS $$
 SELECT CASE WHEN p_fase=-1 THEN ARRAY['berco','comoda','roupeiro','poltrona','kit','coleito','banheira','baba','carrinho','bebe_conforto','base','colchao']
 WHEN p_fase BETWEEN 0 AND 3 THEN ARRAY['coleito','banheira','poltrona']
 WHEN p_fase BETWEEN 4 AND 8 THEN ARRAY['alimentacao','coleito']
 WHEN p_fase BETWEEN 9 AND 12 THEN ARRAY['carro','montessori','carrinho_passeio'] ELSE ARRAY[]::text[] END
$$;
CREATE FUNCTION public.atendimento_presencial_essenciais_fase(c jsonb,p_data date) RETURNS integer
LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE meses integer; referencia date;
BEGIN
 IF c->>'situacao'='gestacao' OR (c->>'situacao'='presente_outra_pessoa' AND c->>'presenteJaNasceu'='false') THEN RETURN -1; END IF;
 IF NOT (c->>'situacao'='ja_nasceu' OR (c->>'situacao'='presente_outra_pessoa' AND c->>'presenteJaNasceu'='true')) OR c->>'situacao' IS NULL THEN RETURN NULL; END IF;
 IF c ? 'dataReferenciaNascimento' THEN
  referencia:=(c->>'dataReferenciaNascimento')::date;
  meses:=(extract(year from p_data)::int-extract(year from referencia)::int)*12+extract(month from p_data)::int-extract(month from referencia)::int;
 ELSIF c ? 'criancaPermanenteId' THEN RETURN NULL;
 ELSIF c ? 'idadeValor' AND c->>'idadeUnidade' IN ('meses','anos') THEN
  meses:=(c->>'idadeValor')::int*CASE WHEN c->>'idadeUnidade'='anos' THEN 12 ELSE 1 END;
 END IF;
 RETURN CASE WHEN meses>=0 THEN meses ELSE NULL END;
END $$;

CREATE FUNCTION public.atendimento_presencial_validar_essenciais(p jsonb) RETURNS void
LANGUAGE plpgsql SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE cr record; r record; lista text[]:=ARRAY['berco','comoda','roupeiro','poltrona','kit','coleito','banheira','baba','carrinho','bebe_conforto','base','colchao','alimentacao','carro','montessori','carrinho_passeio'];
BEGIN
 IF NOT (p ? 'versaoEssenciais') THEN
  IF p ? 'essenciais' THEN RAISE EXCEPTION 'essenciais_versao_invalida' USING ERRCODE='23514'; END IF;
  RETURN;
 END IF;
 IF p->'versaoEssenciais' IS DISTINCT FROM '1'::jsonb OR jsonb_typeof(coalesce(p->'essenciais','{}')) IS DISTINCT FROM 'object'
  OR jsonb_typeof(p->'criancas') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'essenciais_payload_invalido' USING ERRCODE='23514'; END IF;
 IF jsonb_array_length(p->'criancas')>8 OR (SELECT count(*) FROM jsonb_object_keys(coalesce(p->'essenciais','{}')))>8 THEN RAISE EXCEPTION 'essenciais_payload_invalido' USING ERRCODE='23514'; END IF;
 FOR cr IN SELECT key,value FROM jsonb_each(coalesce(p->'essenciais','{}')) LOOP
  IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(p->'criancas') c WHERE c->>'id'=cr.key) OR jsonb_typeof(cr.value) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'essenciais_crianca_invalida' USING ERRCODE='23514'; END IF;
  FOR r IN SELECT key,value FROM jsonb_each(cr.value) LOOP
   IF NOT r.key=ANY(lista) OR r.value NOT IN ('"sim"'::jsonb,'"nao"'::jsonb) THEN RAISE EXCEPTION 'essenciais_resposta_invalida' USING ERRCODE='23514'; END IF;
  END LOOP;
 END LOOP;
END $$;

-- NORMALIZADOR GERADO A PARTIR DA DEFINIÇÃO REAL VERIFICADA NO MCP
DO $$ BEGIN
IF md5(replace(pg_get_functiondef('public.atendimento_presencial_normalizar_payload_ficha(jsonb,boolean)'::regprocedure),chr(13),'')) <> '8a9735109b8012fd49b9b89702ac8747' THEN RAISE EXCEPTION 'preflight_atendimento_presencial_normalizar_payload_ficha_alterado_revisar_migration'; END IF;
IF md5(replace(pg_get_functiondef('public.atendimento_presencial_preparar_referencias(jsonb,date,uuid)'::regprocedure),chr(13),'')) <> 'adb987f3db4a448b6cff6db99af84858' THEN RAISE EXCEPTION 'preflight_atendimento_presencial_preparar_referencias_alterado_revisar_migration'; END IF;
IF md5(replace(pg_get_functiondef('public.atendimento_presencial_efetivar_criancas()'::regprocedure),chr(13),'')) <> 'b3c4391f538b0071feb2c1a7188df278' THEN RAISE EXCEPTION 'preflight_atendimento_presencial_efetivar_criancas_alterado_revisar_migration'; END IF;
IF md5(replace(pg_get_functiondef('public.atendimento_presencial_concluir(uuid,integer,uuid,integer,text,jsonb)'::regprocedure),chr(13),'')) <> '413b8061c30f432b1d564aef1e1b7d72' THEN RAISE EXCEPTION 'preflight_atendimento_presencial_concluir_alterado_revisar_migration'; END IF;
END $$;
CREATE OR REPLACE FUNCTION public.atendimento_presencial_normalizar_pre_essenciais(p_dados jsonb, p_permitir_cliente_id boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
DECLARE c jsonb; originais jsonb; limpos jsonb:='[]'; resultado jsonb; restaurados jsonb:='[]'; i integer:=0; referencia date; lojas jsonb := p_dados->'lojasMotivos'; loja record; produtos_originais jsonb; produtos_v2 boolean := p_dados->'versaoProdutos' = '2'::jsonb;
BEGIN
 PERFORM public.atendimento_presencial_validar_produtos(p_dados);
 produtos_originais := p_dados->'produtosInteresse';
 IF lojas IS NOT NULL THEN
  IF jsonb_typeof(lojas) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'lojas_motivos_invalidas' USING ERRCODE='23514'; END IF;
  FOR loja IN SELECT key, value FROM jsonb_each(lojas) LOOP
   IF loja.key NOT IN ('outra_loja_fisica','outra_loja_internet') OR jsonb_typeof(loja.value) IS DISTINCT FROM 'string' OR char_length(loja.value #>> '{}') > 120 THEN RAISE EXCEPTION 'lojas_motivos_invalidas' USING ERRCODE='23514'; END IF;
  END LOOP;
 END IF;
 p_dados:=p_dados-'lojasMotivos';
 originais:=p_dados->'criancas';
 IF jsonb_typeof(originais)='array' THEN
 FOR c IN SELECT value FROM jsonb_array_elements(originais) LOOP
  IF c ? 'presenteJaNasceu' AND (jsonb_typeof(c->'presenteJaNasceu') IS DISTINCT FROM 'boolean' OR c->>'situacao' IS DISTINCT FROM 'presente_outra_pessoa') THEN RAISE EXCEPTION 'presente_nascimento_invalido' USING ERRCODE='23514'; END IF;
  IF p_dados->>'versaoFluxo'='2' AND c->>'situacao'='presente_outra_pessoa' AND NOT c ? 'presenteJaNasceu' THEN RAISE EXCEPTION 'presente_nascimento_obrigatorio' USING ERRCODE='23514'; END IF;
  IF c ? 'dataReferenciaNascimento' THEN
   IF jsonb_typeof(c->'dataReferenciaNascimento') IS DISTINCT FROM 'string' OR c->>'dataReferenciaNascimento' !~ '^[0-9]{4}-[0-9]{2}-01$' THEN RAISE EXCEPTION 'referencia_invalida' USING ERRCODE='23514'; END IF;
   referencia:=(c->>'dataReferenciaNascimento')::date;
   IF NOT (c->>'situacao'='ja_nasceu' OR (c->>'situacao'='presente_outra_pessoa' AND c->>'presenteJaNasceu'='true')) THEN RAISE EXCEPTION 'referencia_indevida' USING ERRCODE='23514'; END IF;
  END IF;
  IF c->>'situacao'='presente_outra_pessoa' AND c->>'presenteJaNasceu'='true' THEN c:=jsonb_set(c,'{situacao}','"ja_nasceu"'); END IF;
  limpos:=limpos || jsonb_build_array(c-ARRAY['presenteJaNasceu','dataReferenciaNascimento']);
 END LOOP;
 p_dados:=jsonb_set(p_dados,'{criancas}',limpos);
 END IF;
 resultado:=public.atendimento_presencial_normalizar_payload_entrega5(p_dados,p_permitir_cliente_id);
 FOR c IN SELECT value FROM jsonb_array_elements(resultado->'criancas') LOOP
  c:=c || jsonb_build_object('situacao',originais->i->'situacao');
  IF originais->i ? 'presenteJaNasceu' THEN c:=c || jsonb_build_object('presenteJaNasceu',originais->i->'presenteJaNasceu'); END IF;
  IF originais->i ? 'dataReferenciaNascimento' THEN c:=c || jsonb_build_object('dataReferenciaNascimento',originais->i->'dataReferenciaNascimento'); END IF;
  restaurados:=restaurados || jsonb_build_array(c);i:=i+1;
 END LOOP;
 IF lojas IS NOT NULL AND resultado->>'tipoAtendimento' IS DISTINCT FROM 'nao_cliente' THEN
  SELECT coalesce(jsonb_object_agg(key,btrim(value #>> '{}')),'{}'::jsonb) INTO lojas FROM jsonb_each(lojas) WHERE (resultado->'motivosResultado') ? key;
  resultado:=resultado || jsonb_build_object('lojasMotivos',lojas);
 END IF;
 IF produtos_v2 AND resultado->>'tipoAtendimento' IS DISTINCT FROM 'nao_cliente' THEN
   resultado := jsonb_set(resultado,'{produtosInteresse}',produtos_originais) || '{"versaoProdutos":2}'::jsonb;
 END IF;
 RETURN jsonb_set(resultado,'{criancas}',restaurados);
END $function$
;

CREATE OR REPLACE FUNCTION public.atendimento_presencial_normalizar_payload_ficha(p_dados jsonb,p_permitir_cliente_id boolean DEFAULT false) RETURNS jsonb
LANGUAGE plpgsql SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE limpo jsonb; resultado jsonb; c jsonb; criancas jsonb:='[]'; originais jsonb:=p_dados->'criancas';
BEGIN
 PERFORM public.atendimento_presencial_validar_essenciais(p_dados);
 limpo:=p_dados-ARRAY['versaoEssenciais','essenciais'];
 IF p_dados->>'versaoEssenciais'='1' THEN
  FOR c IN SELECT value FROM jsonb_array_elements(originais) LOOP
   IF c->>'idadeUnidade'='meses' AND c->'idadeValor'='0'::jsonb THEN c:=jsonb_set(c,'{idadeValor}','1'); END IF;
   criancas:=criancas || jsonb_build_array(c);
  END LOOP;
  limpo:=jsonb_set(limpo,'{criancas}',criancas);
 END IF;
 resultado:=public.atendimento_presencial_normalizar_pre_essenciais(limpo,p_permitir_cliente_id);
 IF p_dados->>'versaoEssenciais'='1' THEN
  criancas:='[]';
  FOR c IN SELECT value FROM jsonb_array_elements(resultado->'criancas') LOOP
   IF EXISTS(SELECT 1 FROM jsonb_array_elements(originais) x WHERE x->>'id'=c->>'id' AND x->>'idadeUnidade'='meses' AND x->'idadeValor'='0'::jsonb) THEN c:=jsonb_set(c,'{idadeValor}','0'); END IF;
   criancas:=criancas || jsonb_build_array(c);
  END LOOP;
  resultado:=jsonb_set(resultado,'{criancas}',criancas) || jsonb_build_object('versaoEssenciais',1,'essenciais',coalesce(p_dados->'essenciais','{}'));
 END IF;
 RETURN resultado;
END $$;
CREATE OR REPLACE FUNCTION public.atendimento_presencial_preparar_referencias(p_dados jsonb, p_data date, p_cliente uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
DECLARE c jsonb; itens jsonb:='[]'; referencia date;
BEGIN
 IF p_dados->>'versaoFluxo' IS DISTINCT FROM '2' THEN RETURN p_dados; END IF;
 FOR c IN SELECT value FROM jsonb_array_elements(p_dados->'criancas') LOOP
   referencia:=NULL;
   IF c ? 'criancaPermanenteId' THEN
     SELECT cadastro.data_referencia_nascimento INTO referencia FROM public.atendimento_presencial_criancas_cadastro cadastro
     JOIN public.atendimento_presencial_clientes_criancas v ON v.crianca_id=cadastro.id WHERE v.cliente_id=p_cliente AND cadastro.id=(c->>'criancaPermanenteId')::uuid;
   ELSIF c->>'situacao'='ja_nasceu' OR (c->>'situacao'='presente_outra_pessoa' AND c->>'presenteJaNasceu'='true') THEN
     referencia:=date_trunc('month',p_data - make_interval(months => (c->>'idadeValor')::int * CASE WHEN c->>'idadeUnidade'='anos' THEN 12 ELSE 1 END))::date;
   END IF;
   IF p_dados->>'versaoEssenciais'='1' AND (c->>'situacao'='ja_nasceu' OR (c->>'situacao'='presente_outra_pessoa' AND c->>'presenteJaNasceu'='true')) AND c ? 'dataReferenciaNascimento' THEN referencia:=(c->>'dataReferenciaNascimento')::date; END IF;
   c:=c-'dataReferenciaNascimento';
   IF referencia IS NOT NULL THEN c:=c || jsonb_build_object('dataReferenciaNascimento',referencia); END IF;
   itens:=itens || jsonb_build_array(c);
 END LOOP;
 RETURN jsonb_set(p_dados,'{criancas}',itens);
END $function$
;

-- Apenas amplia o intervalo para recém-nascidos; dados existentes não são alterados.
ALTER TABLE public.atendimento_presencial_criancas DROP CONSTRAINT atendimento_presencial_criancas_idade_valor_check;
ALTER TABLE public.atendimento_presencial_criancas ADD CONSTRAINT atendimento_presencial_criancas_idade_valor_check
 CHECK(idade_valor IS NULL OR (idade_unidade='meses' AND idade_valor BETWEEN 0 AND 11) OR (idade_unidade='anos' AND idade_valor BETWEEN 1 AND 6)) NOT VALID;
ALTER TABLE public.atendimento_presencial_criancas VALIDATE CONSTRAINT atendimento_presencial_criancas_idade_valor_check;

CREATE FUNCTION public.atendimento_presencial_proteger_essenciais() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,public,pg_temp AS $$
BEGIN
 IF TG_OP='INSERT' THEN
  IF NEW.dados_rascunho ? 'versaoEssenciais' THEN
   IF NOT coalesce((SELECT ativo FROM public.atendimento_presencial_essenciais_config WHERE id),false) THEN RAISE EXCEPTION 'essenciais_nao_ativados' USING ERRCODE='23514'; END IF;
   NEW.versao_essenciais:=1;
  ELSIF NEW.versao_essenciais IS NOT NULL THEN RAISE EXCEPTION 'essenciais_versao_invalida' USING ERRCODE='23514'; END IF;
 ELSE
  IF NEW.versao_essenciais IS DISTINCT FROM OLD.versao_essenciais OR (NEW.status='rascunho' AND (NEW.dados_rascunho->>'versaoEssenciais') IS DISTINCT FROM (OLD.dados_rascunho->>'versaoEssenciais')) THEN RAISE EXCEPTION 'essenciais_versao_imutavel' USING ERRCODE='23514'; END IF;
 END IF;
 IF NEW.status='rascunho' THEN PERFORM public.atendimento_presencial_validar_essenciais(NEW.dados_rascunho); END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER atendimento_presencial_proteger_essenciais BEFORE INSERT OR UPDATE ON public.atendimento_presencial_atendimentos FOR EACH ROW EXECUTE FUNCTION public.atendimento_presencial_proteger_essenciais();

CREATE FUNCTION public.atendimento_presencial_efetivar_essenciais() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE c jsonb; v_produto text; resposta text; anterior text; fase integer; cadastro uuid; snapshot jsonb; instante timestamptz; confirmou boolean; v_payload jsonb;
BEGIN
 IF OLD.status<>'rascunho' OR NEW.status<>'concluido' OR NEW.versao_essenciais IS DISTINCT FROM 1 OR NEW.tipo_atendimento='nao_cliente' THEN RETURN NEW; END IF;
 IF NEW.cliente_id IS NULL OR NEW.versao_fluxo IS DISTINCT FROM 2 THEN RAISE EXCEPTION 'essenciais_contexto_invalido' USING ERRCODE='23514'; END IF;
 -- A função existente já efetivou as crianças no BEFORE UPDATE. Locks em ordem estável.
 PERFORM 1 FROM public.atendimento_presencial_criancas_cadastro d WHERE d.id IN (SELECT crianca_permanente_id FROM public.atendimento_presencial_criancas WHERE atendimento_id=NEW.id) ORDER BY d.id FOR UPDATE;
 instante:=clock_timestamp();
 -- A conclusão oficial substitui dados_rascunho por um marcador; preservar a evidência a partir do OLD validado.
 v_payload:=public.atendimento_presencial_normalizar_payload_ficha(OLD.dados_rascunho,false);
 v_payload:=public.atendimento_presencial_preparar_referencias(v_payload,(NEW.iniciado_em AT TIME ZONE 'America/Sao_Paulo')::date,NEW.cliente_id);
 FOR c IN SELECT value FROM jsonb_array_elements(v_payload->'criancas') LOOP
  SELECT crianca_permanente_id INTO cadastro FROM public.atendimento_presencial_criancas WHERE atendimento_id=NEW.id AND local_id=c->>'id';
  IF cadastro IS NULL OR NOT EXISTS(SELECT 1 FROM public.atendimento_presencial_clientes_criancas WHERE cliente_id=NEW.cliente_id AND crianca_id=cadastro) THEN RAISE EXCEPTION 'essenciais_vinculo_invalido' USING ERRCODE='42501'; END IF;
  fase:=public.atendimento_presencial_essenciais_fase(c,(NEW.iniciado_em AT TIME ZONE 'America/Sao_Paulo')::date);
  IF fase IS NULL THEN RAISE EXCEPTION 'essenciais_fase_obrigatoria' USING ERRCODE='23514'; END IF;
  UPDATE public.atendimento_presencial_criancas SET data_referencia_nascimento=(c->>'dataReferenciaNascimento')::date WHERE atendimento_id=NEW.id AND local_id=c->>'id';
  UPDATE public.atendimento_presencial_criancas_cadastro SET dados=(CASE WHEN c->>'situacao'='presente_outra_pessoa' THEN jsonb_set(c,'{situacao}',to_jsonb(CASE WHEN c->>'presenteJaNasceu'='true' THEN 'ja_nasceu'::text ELSE 'gestacao'::text END)) ELSE c END)-ARRAY['criancaPermanenteId','vinculoClienteId','parentesco','presenteJaNasceu'],data_referencia_nascimento=(c->>'dataReferenciaNascimento')::date WHERE id=cadastro;
  snapshot:='[]';
  FOREACH v_produto IN ARRAY public.atendimento_presencial_essenciais_produtos(fase) LOOP
   anterior:=NULL; resposta:=NULL;
   SELECT e.resposta INTO anterior FROM public.atendimento_presencial_essenciais_estado e WHERE e.crianca_id=cadastro AND e.produto=v_produto;
   confirmou:=coalesce(v_payload->'essenciais'->(c->>'id'),'{}') ? v_produto;
   resposta:=CASE WHEN confirmou THEN v_payload->'essenciais'->(c->>'id')->>v_produto ELSE anterior END;
   IF resposta IS NULL OR (resposta='nao' AND NOT confirmou) THEN RAISE EXCEPTION 'essenciais_pendentes' USING ERRCODE='23514'; END IF;
   snapshot:=snapshot || jsonb_build_array(jsonb_build_object('produto',v_produto,'resposta',resposta,'confirmada',confirmou));
  END LOOP;
  INSERT INTO public.atendimento_presencial_essenciais_snapshots(atendimento_id,crianca_id,cliente_id,nome,fase,respostas,filial,consultora,registrado_em)
   VALUES(NEW.id,cadastro,NEW.cliente_id,coalesce(c->>'nome','Nome não informado'),fase,snapshot,(SELECT nome FROM public.app_unidades WHERE id=NEW.unidade_id),coalesce(NEW.consultora_nome,''),instante);
  FOR v_produto,resposta IN SELECT value->>'produto',value->>'resposta' FROM jsonb_array_elements(snapshot) WHERE (value->>'confirmada')::boolean LOOP
   anterior:=NULL;
   SELECT e.resposta INTO anterior FROM public.atendimento_presencial_essenciais_estado e WHERE e.crianca_id=cadastro AND e.produto=v_produto;
   INSERT INTO public.atendimento_presencial_essenciais_eventos VALUES(NEW.id,cadastro,v_produto,anterior,resposta,NEW.atualizado_por,instante);
   INSERT INTO public.atendimento_presencial_essenciais_estado VALUES(cadastro,v_produto,resposta,NEW.id,instante)
    ON CONFLICT(crianca_id,produto) DO UPDATE SET resposta=excluded.resposta,atendimento_id=excluded.atendimento_id,registrado_em=excluded.registrado_em;
  END LOOP;
 END LOOP;
 RETURN NEW;
END $$;
CREATE TRIGGER atendimento_presencial_efetivar_essenciais AFTER UPDATE ON public.atendimento_presencial_atendimentos FOR EACH ROW EXECUTE FUNCTION public.atendimento_presencial_efetivar_essenciais();

CREATE FUNCTION public.atendimento_presencial_essenciais_autorizar_cliente(p_cliente uuid,p_executor uuid) RETURNS void
LANGUAGE plpgsql SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE papel text;
BEGIN
 SELECT role INTO papel FROM public.usuarios_permitidos WHERE id=p_executor AND ativo;
 IF papel IS NULL OR NOT EXISTS(SELECT 1 FROM public.atendimento_presencial_clientes WHERE id=p_cliente) THEN RAISE EXCEPTION 'access_denied' USING ERRCODE='42501'; END IF;
 IF papel='superadmin' THEN RETURN; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.app_usuarios_unidades v JOIN public.app_unidades u ON u.id=v.unidade_id AND u.ativo WHERE v.usuario_id=p_executor)
 OR NOT EXISTS(SELECT 1 FROM public.app_modulos m
  LEFT JOIN public.app_permissoes_usuario pu ON pu.modulo_id=m.id AND pu.usuario_id=p_executor
  LEFT JOIN public.app_usuarios_perfis up ON up.usuario_id=p_executor
  LEFT JOIN public.app_perfis_acesso pa ON pa.id=up.perfil_id AND pa.ativo
  LEFT JOIN public.app_permissoes_perfil pp ON pp.modulo_id=m.id AND pp.perfil_id=pa.id
  WHERE m.chave IN ('atendimento_presencial_ficha','atendimento_presencial_registros','atendimento_presencial_clientes') AND m.ativo AND NOT m.publico AND NOT m.somente_superadmin
  AND (pu.permitido=true OR (pu.permitido IS NULL AND pp.permitido=true))) THEN RAISE EXCEPTION 'access_denied' USING ERRCODE='42501'; END IF;
END $$;

CREATE FUNCTION public.atendimento_presencial_ler_essenciais(p_rascunho uuid,p_cliente uuid,p_executor uuid) RETURNS jsonb
LANGUAGE plpgsql SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE resultado jsonb;
BEGIN
 PERFORM public.atendimento_presencial_criancas_contexto(p_rascunho,p_cliente,p_executor);
 SELECT coalesce(jsonb_object_agg(crianca_id,produtos),'{}') INTO resultado FROM (
  SELECT e.crianca_id,jsonb_object_agg(e.produto,jsonb_build_object('resposta',e.resposta,'registradoEm',e.registrado_em,'atendimentoId',e.atendimento_id,'filial',s.filial,'consultora',s.consultora)) produtos
  FROM public.atendimento_presencial_essenciais_estado e JOIN public.atendimento_presencial_clientes_criancas v ON v.crianca_id=e.crianca_id AND v.cliente_id=p_cliente
  JOIN public.atendimento_presencial_essenciais_snapshots s ON s.atendimento_id=e.atendimento_id AND s.crianca_id=e.crianca_id GROUP BY e.crianca_id
 ) q;
 RETURN jsonb_build_object('respostas',resultado);
END $$;

CREATE FUNCTION public.atendimento_presencial_historico_essenciais(p_cliente uuid,p_executor uuid,p_pagina integer DEFAULT 0,p_atendimento uuid DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE resultado jsonb; quantidade integer;
BEGIN
 PERFORM public.atendimento_presencial_essenciais_autorizar_cliente(p_cliente,p_executor);
 IF p_pagina IS NULL OR p_pagina<0 OR p_pagina>10000 THEN RAISE EXCEPTION 'pagina_invalida' USING ERRCODE='23514'; END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object('atendimentoId',atendimento_id,'criancaId',crianca_id,'nome',nome,'fase',fase,'respostas',respostas,'filial',filial,'consultora',consultora,'registradoEm',registrado_em) ORDER BY registrado_em DESC,atendimento_id,crianca_id),'[]'),count(*) INTO resultado,quantidade FROM (
  SELECT * FROM public.atendimento_presencial_essenciais_snapshots WHERE cliente_id=p_cliente AND (p_atendimento IS NULL OR atendimento_id=p_atendimento)
  ORDER BY registrado_em DESC,atendimento_id,crianca_id LIMIT 51 OFFSET p_pagina*50
 ) q;
 IF quantidade>50 THEN resultado:=resultado-50; END IF;
 RETURN jsonb_build_object('historico',resultado,'mais',quantidade>50);
END $$;

DO $$ DECLARE f regprocedure; BEGIN
 FOR f IN SELECT p.oid::regprocedure FROM pg_proc p WHERE p.pronamespace='public'::regnamespace AND
  (p.proname IN ('atendimento_presencial_essenciais_produtos','atendimento_presencial_essenciais_fase','atendimento_presencial_validar_essenciais','atendimento_presencial_normalizar_pre_essenciais','atendimento_presencial_normalizar_payload_ficha','atendimento_presencial_proteger_essenciais','atendimento_presencial_efetivar_essenciais','atendimento_presencial_essenciais_autorizar_cliente','atendimento_presencial_ler_essenciais','atendimento_presencial_historico_essenciais')) LOOP
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated',f);
  EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role',f);
 END LOOP;
END $$;
-- Não habilitar aqui. Após homologação e aprovação, ativar config e flag do app na janela combinada.
COMMIT;
