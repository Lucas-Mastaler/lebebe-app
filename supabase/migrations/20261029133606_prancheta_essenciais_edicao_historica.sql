-- Preparacao local para editar respostas essenciais no historico do atendimento.
-- Nao aplicada remotamente nesta tarefa.
BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '30s';

CREATE TABLE public.atendimento_presencial_essenciais_revisoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  historico_id uuid NOT NULL REFERENCES public.atendimento_presencial_historico(id) ON DELETE CASCADE,
  atendimento_id uuid NOT NULL REFERENCES public.atendimento_presencial_atendimentos(id) ON DELETE CASCADE,
  crianca_id uuid NOT NULL,
  produto text NOT NULL CHECK (produto IN (
    'berco', 'comoda', 'roupeiro', 'poltrona', 'kit', 'coleito', 'banheira', 'baba',
    'carrinho', 'bebe_conforto', 'base', 'colchao', 'alimentacao', 'carro', 'montessori', 'carrinho_passeio'
  )),
  resposta_anterior text NOT NULL CHECK (resposta_anterior IN ('sim', 'nao')),
  resposta_nova text NOT NULL CHECK (resposta_nova IN ('sim', 'nao')),
  confirmada_anterior boolean NOT NULL,
  confirmada_nova boolean NOT NULL DEFAULT true CHECK (confirmada_nova),
  executor_id uuid NOT NULL REFERENCES public.usuarios_permitidos(id) ON DELETE RESTRICT,
  registrado_em timestamptz NOT NULL,
  CONSTRAINT atendimento_presencial_essenciais_revisoes_snapshot_fk
    FOREIGN KEY (atendimento_id, crianca_id)
    REFERENCES public.atendimento_presencial_essenciais_snapshots(atendimento_id, crianca_id)
    ON DELETE CASCADE,
  CONSTRAINT atendimento_presencial_essenciais_revisoes_historico_item_unique
    UNIQUE (historico_id, crianca_id, produto)
);

CREATE INDEX atendimento_presencial_essenciais_revisoes_historico_idx
  ON public.atendimento_presencial_essenciais_revisoes(historico_id);
CREATE INDEX atendimento_presencial_essenciais_revisoes_atendimento_idx
  ON public.atendimento_presencial_essenciais_revisoes(atendimento_id, registrado_em DESC);

ALTER TABLE public.atendimento_presencial_essenciais_revisoes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.atendimento_presencial_essenciais_revisoes FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.atendimento_presencial_essenciais_revisoes TO service_role;

CREATE FUNCTION public.atendimento_presencial_editar_concluido_com_essenciais(
  p_atendimento_id uuid,
  p_expected_version integer,
  p_usuario_id uuid,
  p_dados jsonb,
  p_numero_lancamento integer,
  p_consultora_nome text,
  p_essenciais jsonb
) RETURNS TABLE(id uuid, version integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
DECLARE
  v_atendimento public.atendimento_presencial_atendimentos%rowtype;
  v_item jsonb;
  v_mudanca jsonb;
  v_mudancas jsonb := '[]'::jsonb;
  v_respostas jsonb;
  v_resposta_anterior text;
  v_confirmada_anterior boolean;
  v_crianca_id uuid;
  v_produto text;
  v_mensagem text;
  v_sem_alteracoes_gerais boolean := false;
  v_id uuid;
  v_version integer;
  v_historico_id uuid;
  v_instante timestamptz := clock_timestamp();
  v_role text;
  v_perfil text;
BEGIN
  SELECT * INTO v_atendimento
  FROM public.atendimento_presencial_atendimentos
  WHERE atendimento_presencial_atendimentos.id = p_atendimento_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'atendimento_not_found' USING ERRCODE = 'P0002'; END IF;
  IF v_atendimento.status <> 'concluido' OR v_atendimento.versao_essenciais IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'essenciais_atendimento_sem_coleta' USING ERRCODE = '23514';
  END IF;
  IF jsonb_typeof(p_essenciais) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'essenciais_edicao_payload_invalido' USING ERRCODE = '23514';
  END IF;
  IF jsonb_array_length(p_essenciais) > 128 THEN
    RAISE EXCEPTION 'essenciais_edicao_payload_invalido' USING ERRCODE = '23514';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_essenciais) AS pedido(value)
    GROUP BY pedido.value->>'localId', pedido.value->>'produto'
    HAVING count(*) > 1
  ) THEN RAISE EXCEPTION 'essenciais_edicao_item_duplicado' USING ERRCODE = '23514'; END IF;

  -- Resolve e bloqueia os snapshots originais antes da edição geral do atendimento.
  -- A rotina não consulta nem atualiza atendimento_presencial_essenciais_estado.
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_essenciais) LOOP
    IF jsonb_typeof(v_item) IS DISTINCT FROM 'object'
      OR (SELECT count(*) FROM jsonb_object_keys(v_item)) <> 4
      OR NOT (v_item ?& ARRAY['localId', 'produto', 'resposta', 'confirmada']::text[])
      OR length(coalesce(v_item->>'localId', '')) NOT BETWEEN 1 AND 80
      OR v_item->>'produto' NOT IN (
        'berco', 'comoda', 'roupeiro', 'poltrona', 'kit', 'coleito', 'banheira', 'baba',
        'carrinho', 'bebe_conforto', 'base', 'colchao', 'alimentacao', 'carro', 'montessori', 'carrinho_passeio'
      )
      OR v_item->>'resposta' NOT IN ('sim', 'nao')
      OR v_item->>'confirmada' IS DISTINCT FROM 'true'
    THEN RAISE EXCEPTION 'essenciais_edicao_payload_invalido' USING ERRCODE = '23514'; END IF;

    BEGIN
      SELECT c.crianca_permanente_id, s.respostas
      INTO STRICT v_crianca_id, v_respostas
      FROM public.atendimento_presencial_criancas c
      JOIN public.atendimento_presencial_essenciais_snapshots s
        ON s.atendimento_id = c.atendimento_id
       AND s.crianca_id = c.crianca_permanente_id
      WHERE c.atendimento_id = p_atendimento_id
        AND c.local_id = v_item->>'localId'
      FOR UPDATE OF s;
    EXCEPTION
      WHEN NO_DATA_FOUND THEN RAISE EXCEPTION 'essenciais_edicao_snapshot_nao_encontrado' USING ERRCODE = '23514';
      WHEN TOO_MANY_ROWS THEN RAISE EXCEPTION 'essenciais_edicao_snapshot_ambiguo' USING ERRCODE = '23514';
    END;

    v_produto := v_item->>'produto';
    SELECT resposta.value->>'resposta', coalesce((resposta.value->>'confirmada')::boolean, false)
    INTO v_resposta_anterior, v_confirmada_anterior
    FROM jsonb_array_elements(v_respostas) AS resposta(value)
    WHERE resposta.value->>'produto' = v_produto
    LIMIT 1;
    IF NOT FOUND OR v_resposta_anterior NOT IN ('sim', 'nao') THEN
      RAISE EXCEPTION 'essenciais_edicao_produto_nao_registrado' USING ERRCODE = '23514';
    END IF;

    IF v_resposta_anterior IS DISTINCT FROM v_item->>'resposta' OR NOT v_confirmada_anterior THEN
      v_mudanca := jsonb_build_object(
        'criancaId', v_crianca_id,
        'localId', v_item->>'localId',
        'produto', v_produto,
        'respostaAnterior', v_resposta_anterior,
        'respostaNova', v_item->>'resposta',
        'confirmadaAnterior', v_confirmada_anterior,
        'confirmadaNova', true
      );
      v_mudancas := v_mudancas || jsonb_build_array(v_mudanca);
    END IF;
  END LOOP;

  BEGIN
    SELECT resultado.id, resultado.version
    INTO v_id, v_version
    FROM public.atendimento_presencial_editar_concluido(
      p_atendimento_id, p_expected_version, p_usuario_id, p_dados, p_numero_lancamento, p_consultora_nome
    ) AS resultado;
  EXCEPTION WHEN SQLSTATE 'P0001' THEN
    GET STACKED DIAGNOSTICS v_mensagem = MESSAGE_TEXT;
    IF v_mensagem <> 'nenhuma_alteracao' THEN RAISE; END IF;
    v_sem_alteracoes_gerais := true;
  END;

  IF v_sem_alteracoes_gerais AND jsonb_array_length(v_mudancas) = 0 THEN
    RAISE EXCEPTION 'nenhuma_alteracao' USING ERRCODE = 'P0001';
  END IF;

  IF v_sem_alteracoes_gerais THEN
    UPDATE public.atendimento_presencial_atendimentos
    SET ultima_atividade_em = now(), expira_em = now(), atualizado_por = p_usuario_id
    WHERE atendimento_presencial_atendimentos.id = p_atendimento_id
    RETURNING atendimento_presencial_atendimentos.id, atendimento_presencial_atendimentos.version
    INTO v_id, v_version;

    SELECT up.role,
      CASE
        WHEN EXISTS (SELECT 1 FROM public.app_usuarios_perfis aup JOIN public.app_perfis_acesso apa ON apa.id = aup.perfil_id WHERE aup.usuario_id = p_usuario_id AND apa.chave = 'supervisora_loja' AND apa.ativo) THEN 'supervisora_loja'
        WHEN EXISTS (SELECT 1 FROM public.app_usuarios_perfis aup JOIN public.app_perfis_acesso apa ON apa.id = aup.perfil_id WHERE aup.usuario_id = p_usuario_id AND apa.chave = 'consultora' AND apa.ativo) THEN 'consultora'
        WHEN EXISTS (SELECT 1 FROM public.app_usuarios_perfis aup JOIN public.app_perfis_acesso apa ON apa.id = aup.perfil_id WHERE aup.usuario_id = p_usuario_id AND apa.chave = 'gestao' AND apa.ativo) THEN 'gestao'
        ELSE NULL
      END
    INTO v_role, v_perfil
    FROM public.usuarios_permitidos up
    WHERE up.id = p_usuario_id AND up.ativo;

    IF v_role IS NULL THEN RAISE EXCEPTION 'executor_invalido' USING ERRCODE = '42501'; END IF;

    INSERT INTO public.atendimento_presencial_historico (
      atendimento_id, usuario_id, perfil, role, acao, origem, snapshot
    ) VALUES (
      p_atendimento_id, p_usuario_id, v_perfil, v_role, 'editado_concluido', 'api',
      jsonb_build_object(
        'versaoAnterior', v_atendimento.version,
        'versaoNova', v_version,
        'camposAlterados', jsonb_build_array('produtosEssenciais'),
        'resultadoAnterior', v_atendimento.resultado_atendimento,
        'resultadoNovo', v_atendimento.resultado_atendimento,
        'numeroLancamentoAlterado', false,
        'viradaCartaoAlterada', false,
        'consultoraNomeAlterado', false,
        'versaoFluxo', to_jsonb(v_atendimento.versao_fluxo),
        'tipoAtendimentoAnterior', v_atendimento.tipo_atendimento,
        'tipoAtendimentoNovo', v_atendimento.tipo_atendimento,
        'essenciaisQtdAlterada', jsonb_array_length(v_mudancas)
      )
    ) RETURNING atendimento_presencial_historico.id INTO v_historico_id;
  ELSE
    SELECT h.id INTO v_historico_id
    FROM public.atendimento_presencial_historico h
    WHERE h.atendimento_id = p_atendimento_id
      AND h.usuario_id = p_usuario_id
      AND h.acao = 'editado_concluido'
      AND h.snapshot->>'versaoNova' = v_version::text
    ORDER BY h.created_at DESC
    LIMIT 1;

    IF v_historico_id IS NULL THEN RAISE EXCEPTION 'historico_edicao_nao_encontrado' USING ERRCODE = 'P0001'; END IF;

    UPDATE public.atendimento_presencial_historico h
    SET snapshot = jsonb_set(
      jsonb_set(
        h.snapshot,
        '{camposAlterados}',
        coalesce(h.snapshot->'camposAlterados', '[]'::jsonb) || '["produtosEssenciais"]'::jsonb,
        true
      ),
      '{essenciaisQtdAlterada}',
      to_jsonb(jsonb_array_length(v_mudancas)),
      true
    )
    WHERE h.id = v_historico_id;
  END IF;

  FOR v_mudanca IN SELECT value FROM jsonb_array_elements(v_mudancas) LOOP
    UPDATE public.atendimento_presencial_essenciais_snapshots s
    SET respostas = (
      SELECT jsonb_agg(
        CASE WHEN resposta.value->>'produto' = v_mudanca->>'produto' THEN
          jsonb_set(
            jsonb_set(resposta.value, '{resposta}', to_jsonb(v_mudanca->>'respostaNova'), true),
            '{confirmada}', 'true'::jsonb, true
          )
        ELSE resposta.value END
        ORDER BY resposta.ordinalidade
      )
      FROM jsonb_array_elements(s.respostas) WITH ORDINALITY AS resposta(value, ordinalidade)
    )
    WHERE s.atendimento_id = p_atendimento_id
      AND s.crianca_id = (v_mudanca->>'criancaId')::uuid;

    -- Os eventos originais registram a coleta na conclusão. Correções feitas
    -- depois ficam na tabela de revisões vinculada ao histórico desta edição.
    INSERT INTO public.atendimento_presencial_essenciais_revisoes (
      historico_id, atendimento_id, crianca_id, produto, resposta_anterior, resposta_nova,
      confirmada_anterior, confirmada_nova, executor_id, registrado_em
    ) VALUES (
      v_historico_id, p_atendimento_id, (v_mudanca->>'criancaId')::uuid, v_mudanca->>'produto',
      v_mudanca->>'respostaAnterior', v_mudanca->>'respostaNova',
      (v_mudanca->>'confirmadaAnterior')::boolean, true, p_usuario_id, v_instante
    );
  END LOOP;

  RETURN QUERY SELECT v_id, v_version;
END
$function$;

REVOKE ALL ON FUNCTION public.atendimento_presencial_editar_concluido_com_essenciais(uuid, integer, uuid, jsonb, integer, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.atendimento_presencial_editar_concluido_com_essenciais(uuid, integer, uuid, jsonb, integer, text, jsonb) TO service_role;

COMMIT;
