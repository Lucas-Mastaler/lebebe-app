-- Associação calculada; não altera cadastros, documentos nem indicadores.
-- PENDÊNCIA SEPARADA: UNIQUE(numero_lancamento) e upsert global do importador
-- podem sobrescrever documentos de filiais diferentes. A janela não recupera
-- documentos perdidos. Não alterar essa chave nesta entrega.
CREATE OR REPLACE FUNCTION public.atendimento_presencial_resolver_vendas_sgi(
  p_cliente_id uuid,
  p_usuario_id uuid,
  p_perfil text,
  p_unidades uuid[],
  p_variacoes_telefone text[] DEFAULT '{}',
  p_atendimento_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER
SET search_path = pg_catalog, public
SET statement_timeout = '5s'
AS $function$
WITH unidades AS MATERIALIZED (
  SELECT id, CASE chave
    WHEN 'bigorrilho' THEN 'LEBEBE BIGORRILHO'
    WHEN 'portao' THEN 'LEBEBE PORTÃO'
    WHEN 'marechal' THEN 'LEBEBE MARECHAL'
    WHEN 'feira' THEN 'LEBEBE FEIRA'
  END filial FROM public.app_unidades
), cliente AS MATERIALIZED (
  SELECT c.*, upper(regexp_replace(btrim(c.nome), '\s+', ' ', 'g')) nome_comparacao,
    coalesce(t.contradicao, false) telefone_contraditorio,t.telefone_base
  FROM public.atendimento_presencial_clientes c
  LEFT JOIN LATERAL (
    SELECT (array_agg(nacional ORDER BY ordem) FILTER (WHERE length(nacional) BETWEEN 10 AND 11 AND left(nacional,2)<>'00'))[1] telefone_base,
    count(DISTINCT nacional) > 1 OR bool_or(
      left(nacional,2) <> ALL(string_to_array('11 12 13 14 15 16 17 18 19 21 22 24 27 28 31 32 33 34 35 37 38 41 42 43 44 45 46 47 48 49 51 53 54 55 61 62 63 64 65 66 67 68 69 71 73 74 75 77 79 81 82 83 84 85 86 87 88 89 91 92 93 94 95 96 97 98 99',' '))
      OR substr(nacional,3) !~ '^([2-5][0-9]{7}|9[0-9]{8})$'
    ) contradicao
    FROM (
      SELECT CASE WHEN length(digitos)>11 AND left(digitos,2)='55' THEN substr(digitos,3) ELSE digitos END nacional,ordem
      FROM (
        SELECT regexp_replace(v,'[^0-9]','','g') digitos,ordem
        FROM unnest(ARRAY[c.telefone_normalizado,c.telefone_normalizado_ddi,c.telefone_informado]) WITH ORDINALITY t(v,ordem)
        WHERE nullif(btrim(v),'') IS NOT NULL
      ) n
    ) n
  ) t ON true
  WHERE c.id=p_cliente_id
), globais AS MATERIALIZED (
  -- Nunca restringir candidatos concorrentes pelo acesso do solicitante.
  SELECT a.id,a.cliente_id,a.consultora_usuario_id,a.unidade_id,a.numero_lancamento,
    (a.iniciado_em AT TIME ZONE 'America/Sao_Paulo')::date dia, u.filial
  FROM public.atendimento_presencial_atendimentos a
  JOIN unidades u ON u.id=a.unidade_id
  WHERE a.status='concluido' AND a.resultado_atendimento='sim'
), alvos AS MATERIALIZED (
  SELECT a.* FROM globais a
  WHERE a.cliente_id=p_cliente_id
    -- Histórico comercial compartilhado; detalhe conserva o escopo do registro.
    AND (p_atendimento_id IS NULL OR (
      a.id=p_atendimento_id
      AND (p_perfil='superadmin' OR a.unidade_id=ANY(p_unidades))
      AND (p_perfil<>'consultora' OR a.consultora_usuario_id=p_usuario_id)
    ))
    AND p_perfil IN ('superadmin','gestao','supervisora_loja','consultora')
), pares AS MATERIALIZED (
  SELECT a.*, d.id documento_id,d.filial filial_sgi,d.data_fechamento,
    d.numero_documento,d.numero_lancamento_original,d.cliente nome_sgi,
    d.telefone_principal,d.telefone_normalizado,d.contatos,
    i.status importacao_status,i.total_erros,
    count(d.id) OVER (PARTITION BY a.id) documentos,
    (d.data_fechamento AT TIME ZONE 'America/Sao_Paulo')::date dia_venda
  FROM alvos a
  LEFT JOIN public.sgi_documentos_saida d ON d.numero_lancamento=a.numero_lancamento::text
  LEFT JOIN public.sgi_importacoes_documentos_saida i ON i.id=d.importacao_id
), decisoes AS MATERIALIZED (
  SELECT p.*, CASE
    WHEN c.id IS NULL OR c.status<>'ativo' OR nullif(btrim(c.nome),'') IS NULL
      OR p.numero_lancamento IS NULL OR p.dia IS NULL THEN 'dados_insuficientes'
    WHEN p.filial IS NULL THEN 'filial_incompativel'
    WHEN p.documento_id IS NULL THEN 'aguardando_sgi'
    WHEN p.documentos<>1 THEN 'documento_ambiguo'
    WHEN p.filial_sgi IS DISTINCT FROM p.filial THEN 'filial_incompativel'
    WHEN p.importacao_status IS DISTINCT FROM 'concluido' OR p.total_erros IS DISTINCT FROM 0 THEN 'importacao_pendente'
    WHEN nullif(btrim(p.numero_documento),'') IS NULL THEN 'documento_invalido'
    WHEN nullif(p.numero_lancamento_original,'') IS NOT NULL
      AND regexp_replace(p.numero_lancamento_original,'[^0-9]','','g')<>p.numero_lancamento::text THEN 'documento_inconsistente'
    WHEN p.dia_venda IS NULL THEN 'dados_insuficientes'
    WHEN abs(p.dia-p.dia_venda)>2 THEN 'data_fora_janela'
    WHEN EXISTS (
      SELECT 1 FROM globais g
      WHERE g.numero_lancamento=p.numero_lancamento AND g.filial=p.filial
        AND abs(g.dia-p.dia_venda)<=2 AND g.cliente_id IS DISTINCT FROM p_cliente_id
    ) THEN 'identidade_ambigua'
    WHEN c.telefone_contraditorio THEN 'identidade_contraditoria'
    WHEN upper(btrim(p.nome_sgi))='SEM CLIENTE' THEN
      CASE WHEN nullif(btrim(p.telefone_principal),'') IS NOT NULL
        OR nullif(btrim(p.telefone_normalizado),'') IS NOT NULL
        OR nullif(btrim(p.contatos),'') IS NOT NULL
        OR EXISTS (SELECT 1 FROM public.sgi_documentos_saida_contatos t WHERE t.documento_saida_id=p.documento_id)
        THEN 'identidade_contraditoria' ELSE 'associado' END
    -- Documentos identificados só complementam o detalhe, nunca são reatribuídos.
    WHEN upper(regexp_replace(btrim(p.nome_sgi),'\s+',' ','g'))=c.nome_comparacao
      AND (c.telefone_base=ANY(p_variacoes_telefone) OR (c.telefone_base IS NULL AND cardinality(p_variacoes_telefone)=0))
      AND NOT EXISTS (
        SELECT 1 FROM public.sgi_documentos_saida_contatos t
        WHERE t.documento_saida_id=p.documento_id
          AND NOT (coalesce(t.telefone_normalizado,'')=ANY(p_variacoes_telefone)
            OR coalesce(t.telefone_normalizado_ddi,'')=ANY(p_variacoes_telefone))
      )
      AND (nullif(btrim(p.telefone_normalizado),'') IS NULL OR p.telefone_normalizado=ANY(p_variacoes_telefone))
      AND (nullif(btrim(p.telefone_principal),'') IS NULL
        OR regexp_replace(p.telefone_principal,'[^0-9]','','g')=ANY(p_variacoes_telefone))
      THEN 'ja_identificada'
    ELSE 'identidade_contraditoria'
  END motivo
  FROM pares p LEFT JOIN cliente c ON true
), por_telefone AS (
  SELECT DISTINCT t.documento_saida_id id,'telefone'::text origem
  FROM public.sgi_documentos_saida_contatos t
  JOIN public.sgi_documentos_saida d ON d.id=t.documento_saida_id
  JOIN public.sgi_importacoes_documentos_saida i ON i.id=d.importacao_id AND i.status='concluido' AND i.total_erros=0
  JOIN unidades u ON u.filial=d.filial
  WHERE p_atendimento_id IS NULL
    -- As variantes vieram de uma leitura anterior na API. Não usar telefone
    -- antigo se o cadastro mudou antes deste snapshot SQL.
    AND EXISTS (SELECT 1 FROM cliente WHERE status='ativo' AND telefone_base=ANY(p_variacoes_telefone))
    AND (t.telefone_normalizado=ANY(p_variacoes_telefone) OR t.telefone_normalizado_ddi=ANY(p_variacoes_telefone))
    AND p_perfil IN ('superadmin','gestao','supervisora_loja','consultora')
), ids AS (
  SELECT id,min(origem) origem FROM (
    SELECT id,origem FROM por_telefone
    UNION ALL
    SELECT documento_id,CASE WHEN motivo='ja_identificada' THEN 'sgi' ELSE 'prancheta' END
    FROM decisoes WHERE motivo='associado' OR (motivo='ja_identificada' AND p_atendimento_id IS NOT NULL)
  ) t GROUP BY id
), selecionadas AS MATERIALIZED (
  SELECT d.*, ids.origem FROM ids JOIN public.sgi_documentos_saida d USING(id)
  ORDER BY d.data_fechamento DESC NULLS LAST,d.id LIMIT 10
), produtos AS (
  SELECT p.documento_saida_id,
    jsonb_agg(jsonb_build_object('nome',p.produto,'quantidade',p.quantidade,'valorTotal',p.valor_total,
      'departamento',p.departamento_classificado,'subgrupo',p.subgrupo_classificado) ORDER BY p.id) lista,
    array_agg(DISTINCT p.departamento_classificado) FILTER (WHERE p.departamento_classificado IS NOT NULL
      AND p.departamento_classificado NOT IN ('Nao classificado','Não classificado')) departamentos
  FROM public.sgi_documentos_saida_produtos p JOIN selecionadas d ON d.id=p.documento_saida_id
  WHERE nullif(btrim(p.produto),'') IS NOT NULL GROUP BY p.documento_saida_id
), pagamentos AS (
  SELECT p.documento_saida_id,
    jsonb_agg(jsonb_build_object('forma',p.forma_pagamento,'valor',p.valor,'parcelas',p.numero_parcelas) ORDER BY p.id) lista,
    array_agg(DISTINCT p.forma_pagamento) FILTER (WHERE p.forma_pagamento IS NOT NULL) formas
  FROM public.sgi_documentos_saida_pagamentos p JOIN selecionadas d ON d.id=p.documento_saida_id
  GROUP BY p.documento_saida_id
)
SELECT jsonb_build_object(
  'vendas', coalesce((SELECT jsonb_agg(jsonb_build_object(
    'documentoId',d.id,'numeroDocumento',d.numero_documento,'numeroLancamento',d.numero_lancamento,
    'origemAssociacao',d.origem,'data',d.data_fechamento,'filial',d.filial,'vendedor',d.vendedor,'status',d.status,
    'valorTotal',d.valor_total,'produtos',coalesce(p.lista,'[]'::jsonb),'departamentos',coalesce(to_jsonb(p.departamentos),'[]'::jsonb),
    'itens',coalesce((SELECT jsonb_agg(coalesce(x->>'quantidade','1')||'x '||(x->>'nome')) FROM jsonb_array_elements(p.lista) x),'[]'::jsonb),
    'pagamentos',coalesce(pg.lista,'[]'::jsonb),'formasPagamento',coalesce(to_jsonb(pg.formas),'[]'::jsonb)
  ) ORDER BY d.data_fechamento DESC NULLS LAST,d.id)
  FROM selecionadas d LEFT JOIN produtos p ON p.documento_saida_id=d.id LEFT JOIN pagamentos pg ON pg.documento_saida_id=d.id),'[]'::jsonb),
  -- Somente contagens dos alvos autorizados. Nunca devolver IDs de concorrentes.
  'diagnosticos',coalesce((SELECT jsonb_object_agg(motivo,n) FROM (
    SELECT motivo,count(DISTINCT id) n FROM decisoes
    WHERE (p_perfil='superadmin' OR unidade_id=ANY(p_unidades))
      AND (p_perfil<>'consultora' OR consultora_usuario_id=p_usuario_id)
    GROUP BY motivo
  ) t),'{}'::jsonb)
);
$function$;

REVOKE ALL ON FUNCTION public.atendimento_presencial_resolver_vendas_sgi(uuid,uuid,text,uuid[],text[],uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.atendimento_presencial_resolver_vendas_sgi(uuid,uuid,text,uuid[],text[],uuid) TO service_role;
COMMENT ON FUNCTION public.atendimento_presencial_resolver_vendas_sgi(uuid,uuid,text,uuid[],text[],uuid)
IS 'Leitura backend: identidade por cadastro da Prancheta, lançamento+filial e +/-2 dias SP. APIs devem autenticar e fornecer escopo verificado. Sem escrita ou cron.';
