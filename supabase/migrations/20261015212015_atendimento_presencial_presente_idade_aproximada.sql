-- Somente preparação local; depende das Entregas 2 e 5. Sem backfill.
BEGIN;
SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='30s';
DO $$ BEGIN
 IF to_regclass('public.atendimento_presencial_criancas_cadastro') IS NULL THEN RAISE EXCEPTION 'preflight_entrega5_pendente'; END IF;
 IF public.atendimento_presencial_fluxo_v2_habilitado() OR public.atendimento_presencial_criancas_habilitado() THEN RAISE EXCEPTION 'preflight_gate_aberto'; END IF;
 IF (SELECT md5(pg_get_constraintdef(oid)) FROM pg_constraint WHERE conrelid='public.atendimento_presencial_criancas'::regclass AND conname='atendimento_presencial_criancas_condicional_check') IS DISTINCT FROM '82fee75474261e98eee9f3ccb6d01661' THEN RAISE EXCEPTION 'preflight_constraint_crianca_divergente'; END IF;
 IF md5(replace((select prosrc from pg_proc where oid='public.atendimento_presencial_normalizar_payload_ficha(jsonb,boolean)'::regprocedure),E'\r\n',E'\n')) IS DISTINCT FROM 'eba3f1f2b44957b54496c3b6ec9f9deb' THEN RAISE EXCEPTION 'preflight_normalizar_payload_ficha_divergente'; END IF;
 IF md5(replace((select prosrc from pg_proc where oid='public.atendimento_presencial_concluir(uuid,integer,uuid,integer,text)'::regprocedure),E'\r\n',E'\n')) IS DISTINCT FROM '7293cc748d23bdf02ef3acf3ea612222' THEN RAISE EXCEPTION 'preflight_concluir_divergente'; END IF;
 IF md5(replace((select prosrc from pg_proc where oid='public.atendimento_presencial_editar_concluido(uuid,integer,uuid,jsonb,integer,text)'::regprocedure),E'\r\n',E'\n')) IS DISTINCT FROM 'cdbddeee161af606d398d0ca9c744742' THEN RAISE EXCEPTION 'preflight_editar_concluido_divergente'; END IF;
END $$;
ALTER TABLE public.atendimento_presencial_criancas ADD COLUMN presente_ja_nasceu boolean, ADD COLUMN data_referencia_nascimento date;
ALTER TABLE public.atendimento_presencial_criancas_cadastro ADD COLUMN data_referencia_nascimento date;
ALTER TABLE public.atendimento_presencial_criancas_cadastro ADD CONSTRAINT cadastro_referencia_dia_check CHECK(data_referencia_nascimento IS NULL OR extract(day FROM data_referencia_nascimento)=1);
-- Preserva integralmente os ramos legados. Amplia somente Presente com nascimento explícito.
ALTER TABLE public.atendimento_presencial_criancas DROP CONSTRAINT atendimento_presencial_criancas_condicional_check;
ALTER TABLE public.atendimento_presencial_criancas ADD CONSTRAINT atendimento_presencial_criancas_condicional_check CHECK(
 (situacao='gestacao' AND idade_unidade IS NULL AND idade_valor IS NULL)
 OR (situacao='ja_nasceu' AND data_prevista_nascimento IS NULL AND idade_unidade IS NOT NULL AND idade_valor IS NOT NULL)
 OR (situacao='presente_outra_pessoa' AND (
   ((presente_ja_nasceu IS NULL OR presente_ja_nasceu=false) AND idade_unidade IS NULL AND idade_valor IS NULL)
   OR (presente_ja_nasceu=true AND data_prevista_nascimento IS NULL AND idade_unidade IS NOT NULL AND idade_valor IS NOT NULL)))
 OR (situacao='nao_informado' AND data_prevista_nascimento IS NULL AND idade_unidade IS NULL AND idade_valor IS NULL));
ALTER TABLE public.atendimento_presencial_criancas ADD CONSTRAINT crianca_referencia_check CHECK(
 (presente_ja_nasceu IS NULL OR situacao='presente_outra_pessoa') AND
 (data_referencia_nascimento IS NULL OR (extract(day FROM data_referencia_nascimento)=1 AND
 (situacao='ja_nasceu' OR (situacao='presente_outra_pessoa' AND presente_ja_nasceu=true)))));

CREATE FUNCTION public.atendimento_presencial_preparar_referencias(p_dados jsonb,p_data date,p_cliente uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public,pg_temp AS $$
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
   c:=c-'dataReferenciaNascimento';
   IF referencia IS NOT NULL THEN c:=c || jsonb_build_object('dataReferenciaNascimento',referencia); END IF;
   itens:=itens || jsonb_build_array(c);
 END LOOP;
 RETURN jsonb_set(p_dados,'{criancas}',itens);
END $$;

CREATE FUNCTION public.atendimento_presencial_cadastro_referencia() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public,pg_temp AS $$
BEGIN
 NEW.data_referencia_nascimento:=(NEW.dados->>'dataReferenciaNascimento')::date;
 -- Presente é contexto do atendimento, não atributo permanente da identidade.
 IF NEW.dados->>'situacao'='presente_outra_pessoa' AND NEW.dados ? 'presenteJaNasceu' THEN
   NEW.dados:=jsonb_set(NEW.dados,'{situacao}',to_jsonb(CASE WHEN NEW.dados->>'presenteJaNasceu'='true' THEN 'ja_nasceu'::text ELSE 'gestacao'::text END))-'presenteJaNasceu';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER atendimento_presencial_cadastro_referencia BEFORE INSERT ON public.atendimento_presencial_criancas_cadastro FOR EACH ROW EXECUTE FUNCTION public.atendimento_presencial_cadastro_referencia();

CREATE OR REPLACE FUNCTION public.atendimento_presencial_normalizar_payload_entrega5(p_dados jsonb, p_permitir_cliente_id boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
declare
  v_resultado text;
  v_versao integer;
  v_tipo text;
  v_visita text;
  v_nao_fechamento text;
  v_motivo_outro text;
  v_observacoes text;
  v_virada_dia smallint;
  v_virada_mes smallint;
  v_tem_virada_cartao boolean;
  v_crianca jsonb;
  v_data_text text;
  v_data_prevista date;
  v_consultora_nome text;
begin
  if p_dados is null or jsonb_typeof(p_dados) <> 'object' then
    raise exception 'dados_rascunho_invalidos' using errcode = '23514';
  end if;

  if pg_column_size(p_dados) > 16384 then
    raise exception 'dados_tamanho_excedido' using errcode = '23514';
  end if;

  -- Entradas intermediarias pertencem ao rascunho, nunca ao registro definitivo.
  -- Remover apenas da variavel local: a origem persistida permanece intacta ate concluir.
  if p_dados ? 'entradasFormulario' then
    if jsonb_typeof(p_dados->'entradasFormulario') <> 'object' then
      raise exception 'entradas_formulario_invalidas' using errcode = '23514';
    end if;
    p_dados := p_dados - 'entradasFormulario';
  end if;


  if p_dados ? 'versaoFluxo' then
    if p_dados->'versaoFluxo' is distinct from '2'::jsonb then
      raise exception 'versao_fluxo_invalida' using errcode = '23514';
    end if;
    v_versao := 2;
    v_tipo := p_dados->>'tipoAtendimento';
    if v_tipo is null or v_tipo not in ('cliente', 'nao_cliente') then
      raise exception 'tipo_atendimento_invalido' using errcode = '23514';
    end if;
    if p_dados ? 'motivoVisita' and (jsonb_typeof(p_dados->'motivoVisita') <> 'string'
      or p_dados->>'motivoVisita' not in ('entrega_mercadoria','entregador_uber_eats','vendedor_ambulante','pedido_informacao','curriculo_entrevista','panfleto','representante','outros')) then
      raise exception 'motivo_visita_invalido' using errcode = '23514';
    end if;
    if p_dados ? 'observacaoNaoFechamento' and (jsonb_typeof(p_dados->'observacaoNaoFechamento') <> 'string'
      or char_length(p_dados->>'observacaoNaoFechamento') > 300) then
      raise exception 'observacao_nao_fechamento_invalida' using errcode = '23514';
    end if;
    v_visita := case when v_tipo = 'nao_cliente' then p_dados->>'motivoVisita' end;
    v_nao_fechamento := case when v_tipo = 'cliente' and p_dados->>'resultadoAtendimento' in ('nao','negociacao')
      then nullif(btrim(p_dados->>'observacaoNaoFechamento'), '') end;
    p_dados := p_dados - array['versaoFluxo','tipoAtendimento','motivoVisita','observacaoNaoFechamento'];
    -- Motivos ocultos de venda fechada nao sao efetivados.
    if v_tipo = 'cliente' and p_dados->>'resultadoAtendimento' = 'sim' then
      p_dados := (p_dados - array['motivoOutro','viradaCartaoDia','viradaCartaoMes'])
        || jsonb_build_object('motivosResultado', '[]'::jsonb);
    end if;
  elsif p_dados ?| array['tipoAtendimento','motivoVisita','observacaoNaoFechamento'] then
    raise exception 'versao_fluxo_obrigatoria' using errcode = '23514';
  end if;

  if exists (
    select 1
    from jsonb_object_keys(p_dados) as chave(valor)
    where chave.valor not in (
      'clienteId',
      'cliente',
      'consultoraNome',
      'criancas',
      'departamentos',
      'produtosInteresse',
      'resultadoAtendimento',
      'motivosResultado',
      'motivoOutro',
      'viradaCartaoDia',
      'viradaCartaoMes',
      'observacoes',
      'etapaAtual',
      'notaTecnica'
    )
    or (chave.valor = 'clienteId' and not p_permitir_cliente_id)
  ) then
    raise exception 'dados_rascunho_chave_invalida' using errcode = '23514';
  end if;


  if v_tipo = 'nao_cliente' then
    if v_visita is null then raise exception 'motivo_visita_obrigatorio' using errcode = '23514'; end if;
    -- Nao efetivar nenhum dado do ramo comercial temporariamente oculto.
    return jsonb_build_object('versaoFluxo', 2, 'tipoAtendimento', v_tipo, 'motivoVisita', v_visita,
      'consultoraNome', p_dados->>'consultoraNome', 'criancas', '[]'::jsonb,
      'departamentos', '[]'::jsonb, 'produtosInteresse', '[]'::jsonb, 'motivosResultado', '[]'::jsonb);
  end if;

  if p_permitir_cliente_id and p_dados ? 'clienteId' then
    if jsonb_typeof(p_dados->'clienteId') <> 'string'
      or not ((p_dados->>'clienteId') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
    then
      raise exception 'cliente_id_invalido' using errcode = '23514';
    end if;
  end if;

  if jsonb_typeof(p_dados->'resultadoAtendimento') is distinct from 'string' then
    raise exception 'resultado_obrigatorio' using errcode = '23514';
  end if;

  if not p_permitir_cliente_id and jsonb_typeof(p_dados->'etapaAtual') is distinct from 'string' then
    raise exception 'etapa_invalida' using errcode = '23514';
  end if;

  if p_permitir_cliente_id
    and p_dados ? 'etapaAtual'
    and jsonb_typeof(p_dados->'etapaAtual') <> 'string'
  then
    raise exception 'etapa_invalida' using errcode = '23514';
  end if;

  if p_dados ? 'notaTecnica' and jsonb_typeof(p_dados->'notaTecnica') <> 'string' then
    raise exception 'nota_tecnica_invalida' using errcode = '23514';
  end if;

  if p_dados ? 'motivoOutro' and jsonb_typeof(p_dados->'motivoOutro') <> 'string' then
    raise exception 'motivo_outro_invalido' using errcode = '23514';
  end if;

  if p_dados ? 'observacoes' and jsonb_typeof(p_dados->'observacoes') <> 'string' then
    raise exception 'observacoes_invalidas' using errcode = '23514';
  end if;

  if p_dados ? 'consultoraNome' then
    if jsonb_typeof(p_dados->'consultoraNome') <> 'string' then
      raise exception 'consultora_nome_invalido' using errcode = '23514';
    end if;
    v_consultora_nome := nullif(regexp_replace(btrim(p_dados->>'consultoraNome'), '[[:space:]]+', ' ', 'g'), '');
    if v_consultora_nome is not null then
      if char_length(v_consultora_nome) < 2 or char_length(v_consultora_nome) > 30 then
        raise exception 'consultora_nome_invalido' using errcode = '23514';
      end if;
      if v_consultora_nome !~ '^[A-Za-z\xC0-\xD6\xD8-\xF6\xF8-\xFF]+( [A-Za-z\xC0-\xD6\xD8-\xF6\xF8-\xFF]+)*$' then
        raise exception 'consultora_nome_invalido' using errcode = '23514';
      end if;
    end if;
  end if;

  if jsonb_typeof(p_dados->'criancas') is distinct from 'array' then
    raise exception 'criancas_invalidas' using errcode = '23514';
  end if;

  if jsonb_typeof(p_dados->'departamentos') is distinct from 'array' then
    raise exception 'departamentos_invalidos' using errcode = '23514';
  end if;

  if jsonb_typeof(p_dados->'produtosInteresse') is distinct from 'array' then
    raise exception 'produtos_invalidos' using errcode = '23514';
  end if;

  if jsonb_typeof(p_dados->'motivosResultado') is distinct from 'array' then
    raise exception 'motivos_invalidos' using errcode = '23514';
  end if;

  if jsonb_array_length(p_dados->'criancas') > 8 then
    raise exception 'criancas_limite_excedido' using errcode = '23514';
  end if;

  if jsonb_array_length(p_dados->'departamentos') = 0 or jsonb_array_length(p_dados->'departamentos') > 6 then
    raise exception 'departamento_obrigatorio' using errcode = '23514';
  end if;

  if jsonb_array_length(p_dados->'produtosInteresse') > 20 then
    raise exception 'produtos_limite_excedido' using errcode = '23514';
  end if;

  if (jsonb_array_length(p_dados->'motivosResultado') = 0 and not (coalesce(v_versao, 1) = 2 and p_dados->>'resultadoAtendimento' = 'sim')) or jsonb_array_length(p_dados->'motivosResultado') > 24 then
    raise exception 'motivo_obrigatorio' using errcode = '23514';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_dados->'departamentos') as item(value)
    where jsonb_typeof(item.value) <> 'string'
      or item.value #>> '{}' not in ('p_pesada', 'moveis', 'p_leve', 'enxoval', 'decoracao', 'roupinhas')
  ) then
    raise exception 'departamento_invalido' using errcode = '23514';
  end if;

  if (
    select count(*) <> count(distinct item.value #>> '{}')
    from jsonb_array_elements(p_dados->'departamentos') as item(value)
  ) then
    raise exception 'departamento_duplicado' using errcode = '23514';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_dados->'produtosInteresse') as item(value)
    where jsonb_typeof(item.value) <> 'string'
      or char_length(btrim(item.value #>> '{}')) not between 1 and 80
  ) then
    raise exception 'produto_invalido' using errcode = '23514';
  end if;

  if (
    select count(*) <> count(distinct lower(btrim(item.value #>> '{}')))
    from jsonb_array_elements(p_dados->'produtosInteresse') as item(value)
  ) then
    raise exception 'produto_duplicado' using errcode = '23514';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_dados->'motivosResultado') as item(value)
    where jsonb_typeof(item.value) <> 'string'
      or item.value #>> '{}' not in (
        'qualidade_produto',
        'design_aparencia',
        'cor_acabamento',
        'tamanho_medidas',
        'produto_disponivel',
        'produto_indisponivel',
        'variedade_produtos',
        'preco',
        'desconto',
        'condicao_pagamento',
        'brinde',
        'frete',
        'montagem',
        'prazo_entrega',
        'virada_cartao',
        'necessidade_imediata',
        'aguardar_nascimento',
        'ainda_pesquisando',
        'comparacao_concorrente',
        'conversar_outra_pessoa',
        'sem_orcamento',
        'indecisao_produtos',
        'confianca_loja',
        'atendimento',
        'outro'
      )
  ) then
    raise exception 'motivo_invalido' using errcode = '23514';
  end if;

  if (
    select count(*) <> count(distinct item.value #>> '{}')
    from jsonb_array_elements(p_dados->'motivosResultado') as item(value)
  ) then
    raise exception 'motivo_duplicado' using errcode = '23514';
  end if;

  v_tem_virada_cartao := coalesce((p_dados->'motivosResultado') ? 'virada_cartao', false);

  if v_tem_virada_cartao then
    if not (p_dados ? 'viradaCartaoDia') or not (p_dados ? 'viradaCartaoMes') then
      raise exception 'virada_cartao_obrigatoria' using errcode = '23514';
    end if;

    if jsonb_typeof(p_dados->'viradaCartaoDia') <> 'number'
      or jsonb_typeof(p_dados->'viradaCartaoMes') <> 'number'
      or not ((p_dados->>'viradaCartaoDia') ~ '^[0-9]+$')
      or not ((p_dados->>'viradaCartaoMes') ~ '^[0-9]+$')
    then
      raise exception 'virada_cartao_invalida' using errcode = '23514';
    end if;

    v_virada_dia := (p_dados->>'viradaCartaoDia')::smallint;
    v_virada_mes := (p_dados->>'viradaCartaoMes')::smallint;

    if v_virada_mes not between 1 and 12
      or v_virada_dia not between 1 and 31
      or (v_virada_mes in (4, 6, 9, 11) and v_virada_dia > 30)
      or (v_virada_mes = 2 and v_virada_dia > 29)
    then
      raise exception 'virada_cartao_invalida' using errcode = '23514';
    end if;
  elsif (p_dados ? 'viradaCartaoDia') or (p_dados ? 'viradaCartaoMes') then
    raise exception 'virada_cartao_indevida' using errcode = '23514';
  end if;

  for v_crianca in select value from jsonb_array_elements(p_dados->'criancas') as item(value) loop
    if jsonb_typeof(v_crianca) <> 'object' then
      raise exception 'crianca_invalida' using errcode = '23514';
    end if;

    if exists (
      select 1
      from jsonb_object_keys(v_crianca) as chave(valor)
      where chave.valor not in (
        'id',
        'situacao',
        'nome',
        'nomeNaoInformado',
        'sexo',
        'dataPrevistaNascimento',
        'idadeUnidade',
        'idadeValor', 'criancaPermanenteId', 'vinculoClienteId', 'parentesco'
      )
    ) then
      raise exception 'crianca_chave_invalida' using errcode = '23514';
    end if;

    if v_crianca ? 'criancaPermanenteId' and (
      jsonb_typeof(v_crianca->'criancaPermanenteId') is distinct from 'string'
      or (v_crianca->>'criancaPermanenteId') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      or jsonb_typeof(v_crianca->'vinculoClienteId') is distinct from 'string'
      or (v_crianca->>'vinculoClienteId') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') then
      raise exception 'vinculo_invalido' using errcode='23514';
    end if;
    if v_crianca ? 'parentesco' and (jsonb_typeof(v_crianca->'parentesco') is distinct from 'string' or char_length(btrim(v_crianca->>'parentesco')) not between 2 and 60) then
      raise exception 'parentesco_invalido' using errcode='23514';
    end if;
    if jsonb_typeof(v_crianca->'id') is distinct from 'string'
      or char_length(btrim(v_crianca->>'id')) not between 4 and 80
    then
      raise exception 'crianca_id_invalido' using errcode = '23514';
    end if;

    if v_crianca->>'situacao' not in ('gestacao', 'ja_nasceu', 'presente_outra_pessoa', 'nao_informado') then
      raise exception 'crianca_situacao_invalida' using errcode = '23514';
    end if;

    if v_crianca ? 'nome' and jsonb_typeof(v_crianca->'nome') <> 'string' then
      raise exception 'crianca_nome_invalido' using errcode = '23514';
    end if;

    if v_crianca ? 'nome' and char_length(btrim(v_crianca->>'nome')) > 80 then
      raise exception 'crianca_nome_invalido' using errcode = '23514';
    end if;

    if v_crianca ? 'nomeNaoInformado' and jsonb_typeof(v_crianca->'nomeNaoInformado') <> 'boolean' then
      raise exception 'crianca_nome_nao_informado_invalido' using errcode = '23514';
    end if;

    if coalesce((v_crianca->>'nomeNaoInformado')::boolean, false)
      and nullif(btrim(coalesce(v_crianca->>'nome', '')), '') is not null
    then
      raise exception 'crianca_nome_nao_informado_invalido' using errcode = '23514';
    end if;

    if v_crianca ? 'sexo'
      and (
        jsonb_typeof(v_crianca->'sexo') <> 'string'
        or v_crianca->>'sexo' not in ('menina', 'menino', 'nao_informado', 'prefere_nao_informar')
      )
    then
      raise exception 'crianca_sexo_invalido' using errcode = '23514';
    end if;

    if v_crianca->>'situacao' = 'gestacao' then
      if v_crianca ? 'idadeUnidade' or v_crianca ? 'idadeValor' then
        raise exception 'crianca_idade_indevida' using errcode = '23514';
      end if;
      if v_crianca ? 'dataPrevistaNascimento' then
        if jsonb_typeof(v_crianca->'dataPrevistaNascimento') <> 'string'
          or v_crianca->>'dataPrevistaNascimento' !~ '^\d{4}-\d{2}-\d{2}$'
        then
          raise exception 'crianca_data_invalida' using errcode = '23514';
        end if;
        v_data_text := v_crianca->>'dataPrevistaNascimento';
        begin
          v_data_prevista := v_data_text::date;
        exception when others then
          raise exception 'crianca_data_invalida' using errcode = '23514';
        end;
        if to_char(v_data_prevista, 'YYYY-MM-DD') <> v_data_text then
          raise exception 'crianca_data_invalida' using errcode = '23514';
        end if;
      end if;
    elsif v_crianca->>'situacao' = 'ja_nasceu' then
      if v_crianca ? 'dataPrevistaNascimento' then
        raise exception 'crianca_data_indevida' using errcode = '23514';
      end if;
      if jsonb_typeof(v_crianca->'idadeUnidade') is distinct from 'string'
        or v_crianca->>'idadeUnidade' not in ('meses', 'anos')
        or jsonb_typeof(v_crianca->'idadeValor') is distinct from 'number'
        or (v_crianca->>'idadeValor') !~ '^[0-9]+$'
        or (
          v_crianca->>'idadeUnidade' = 'meses'
          and (v_crianca->>'idadeValor')::integer not between 1 and 11
        )
        or (
          v_crianca->>'idadeUnidade' = 'anos'
          and (v_crianca->>'idadeValor')::integer not between 1 and 6
        )
      then
        raise exception 'crianca_idade_invalida' using errcode = '23514';
      end if;
    elsif v_crianca->>'situacao' = 'presente_outra_pessoa' then
      if v_crianca ? 'idadeUnidade' or v_crianca ? 'idadeValor' then
        raise exception 'crianca_idade_indevida' using errcode = '23514';
      end if;
      if v_crianca ? 'dataPrevistaNascimento' then
        if jsonb_typeof(v_crianca->'dataPrevistaNascimento') <> 'string'
          or v_crianca->>'dataPrevistaNascimento' !~ '^\d{4}-\d{2}-\d{2}$'
        then
          raise exception 'crianca_data_invalida' using errcode = '23514';
        end if;
        v_data_text := v_crianca->>'dataPrevistaNascimento';
        begin
          v_data_prevista := v_data_text::date;
        exception when others then
          raise exception 'crianca_data_invalida' using errcode = '23514';
        end;
        if to_char(v_data_prevista, 'YYYY-MM-DD') <> v_data_text then
          raise exception 'crianca_data_invalida' using errcode = '23514';
        end if;
      end if;
    else
      if v_crianca ? 'dataPrevistaNascimento'
        or v_crianca ? 'idadeUnidade'
        or v_crianca ? 'idadeValor'
      then
        raise exception 'crianca_dados_condicionais_invalidos' using errcode = '23514';
      end if;
    end if;
  end loop;

  v_resultado := p_dados->>'resultadoAtendimento';
  v_motivo_outro := nullif(btrim(coalesce(p_dados->>'motivoOutro', '')), '');
  v_observacoes := nullif(btrim(coalesce(p_dados->>'observacoes', '')), '');

  if v_resultado not in ('sim', 'nao', 'negociacao') then
    raise exception 'resultado_obrigatorio' using errcode = '23514';
  end if;

  if v_observacoes is not null and char_length(v_observacoes) > 2000 then
    raise exception 'observacoes_limite_excedido' using errcode = '23514';
  end if;

  if v_motivo_outro is not null and char_length(v_motivo_outro) > 120 then
    raise exception 'motivo_outro_limite_excedido' using errcode = '23514';
  end if;

  if (p_dados->'motivosResultado') ? 'outro' and v_motivo_outro is null then
    raise exception 'motivo_outro_obrigatorio' using errcode = '23514';
  end if;

  if not ((p_dados->'motivosResultado') ? 'outro') and v_motivo_outro is not null then
    raise exception 'motivo_outro_indevido' using errcode = '23514';
  end if;

  return jsonb_build_object(
    'schema',
    'atendimento_presencial_concluido_v2',
    'clienteId',
    case when p_permitir_cliente_id and p_dados ? 'clienteId' then p_dados->>'clienteId' else null end,
    'consultoraNome',
    v_consultora_nome,
    'resultadoAtendimento',
    v_resultado,
    'motivosResultado',
    p_dados->'motivosResultado',
    'motivoOutro',
    v_motivo_outro,
    'viradaCartaoDia',
    v_virada_dia,
    'viradaCartaoMes',
    v_virada_mes,
    'observacoes',
    v_observacoes,
    'criancas',
    p_dados->'criancas',
    'departamentos',
    p_dados->'departamentos',
    'produtosInteresse',
    p_dados->'produtosInteresse'
  ) || case when v_versao = 2 then jsonb_build_object('versaoFluxo', 2, 'tipoAtendimento', v_tipo,
    'observacaoNaoFechamento', v_nao_fechamento) else '{}'::jsonb end;
exception
  when invalid_text_representation or numeric_value_out_of_range then
    raise exception 'dados_rascunho_invalidos' using errcode = '23514';
end;
$function$;
CREATE OR REPLACE FUNCTION public.atendimento_presencial_normalizar_payload_ficha(p_dados jsonb,p_permitir_cliente_id boolean DEFAULT false) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public,pg_temp AS $wrapper$
DECLARE c jsonb; originais jsonb; limpos jsonb:='[]'; resultado jsonb; restaurados jsonb:='[]'; i integer:=0; referencia date;
BEGIN
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
 RETURN jsonb_set(resultado,'{criancas}',restaurados);
END $wrapper$;
REVOKE ALL ON FUNCTION public.atendimento_presencial_normalizar_payload_entrega5(jsonb,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.atendimento_presencial_normalizar_payload_entrega5(jsonb,boolean) TO service_role;

CREATE OR REPLACE FUNCTION public.atendimento_presencial_concluir(p_atendimento_id uuid, p_expected_version integer, p_usuario_id uuid, p_numero_lancamento integer DEFAULT NULL::integer, p_consultora_nome text DEFAULT NULL::text)
 RETURNS TABLE(id uuid, version integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
declare
  v_row public.atendimento_presencial_atendimentos%rowtype;
  v_payload jsonb;
  v_resultado text;
  v_motivo_outro text;
  v_observacoes text;
  v_numero_lancamento integer;
  v_consultora_nome text;
  v_executor_role text;
  v_tem_perfil_consultora boolean;
  v_tem_perfil_supervisora boolean;
  v_tem_perfil_gestao boolean;
  v_tem_acesso_ficha boolean;
  v_executor_perfil text;
  v_updated_id uuid;
  v_updated_version integer;
begin
  select * into v_row from public.atendimento_presencial_atendimentos apa where apa.id = p_atendimento_id for update;
  if not found then raise exception 'atendimento_not_found' using errcode = 'P0002'; end if;
  if v_row.status <> 'rascunho' then raise exception 'atendimento_not_draft' using errcode = 'P0001'; end if;
  if v_row.version <> p_expected_version then raise exception 'version_conflict' using errcode = 'P0003'; end if;
  if v_row.expira_em <= now() then raise exception 'rascunho_expirado' using errcode = 'P0004'; end if;

  select up.role into v_executor_role from public.usuarios_permitidos up where up.id = p_usuario_id and up.ativo = true;
  if v_executor_role is null then raise exception 'executor_invalido' using errcode = '42501'; end if;

  select
    exists (select 1 from public.app_usuarios_perfis aup join public.app_perfis_acesso apa on apa.id = aup.perfil_id where aup.usuario_id = p_usuario_id and apa.chave = 'consultora' and apa.ativo = true),
    exists (select 1 from public.app_usuarios_perfis aup join public.app_perfis_acesso apa on apa.id = aup.perfil_id where aup.usuario_id = p_usuario_id and apa.chave = 'supervisora_loja' and apa.ativo = true),
    exists (select 1 from public.app_usuarios_perfis aup join public.app_perfis_acesso apa on apa.id = aup.perfil_id where aup.usuario_id = p_usuario_id and apa.chave = 'gestao' and apa.ativo = true)
  into v_tem_perfil_consultora, v_tem_perfil_supervisora, v_tem_perfil_gestao;

  v_executor_perfil := case when v_tem_perfil_supervisora then 'supervisora_loja' when v_tem_perfil_consultora then 'consultora' when v_tem_perfil_gestao then 'gestao' else null end;

  if not exists (select 1 from public.app_unidades au where au.id = v_row.unidade_id and au.ativo = true) then raise exception 'unidade_inativa' using errcode = '23514'; end if;
  if not exists (select 1 from public.usuarios_permitidos up where up.id = v_row.consultora_usuario_id and up.ativo = true) then raise exception 'consultora_inativa' using errcode = '23514'; end if;

  if v_executor_role = 'superadmin' then
    null;
  else
    select exists (
      select 1
      from public.app_modulos am
      left join public.app_permissoes_usuario apu on apu.modulo_id = am.id and apu.usuario_id = p_usuario_id
      left join public.app_usuarios_perfis aup on aup.usuario_id = p_usuario_id
      left join public.app_perfis_acesso apa on apa.id = aup.perfil_id and apa.ativo = true
      left join public.app_permissoes_perfil app on app.modulo_id = am.id and app.perfil_id = apa.id
      where am.chave = 'atendimento_presencial_ficha'
        and am.ativo = true
        and am.publico = false
        and am.somente_superadmin = false
        and (apu.permitido = true or (apu.permitido is null and app.permitido = true))
    ) into v_tem_acesso_ficha;
    if not v_tem_acesso_ficha then raise exception 'perfil_executor_invalido' using errcode = '42501'; end if;
    if not exists (select 1 from public.app_usuarios_unidades auu where auu.usuario_id = p_usuario_id and auu.unidade_id = v_row.unidade_id) then raise exception 'access_denied' using errcode = '42501'; end if;
  end if;

  if v_row.dados_rascunho->'versaoFluxo' = '2'::jsonb and not public.atendimento_presencial_fluxo_v2_habilitado() then
    raise exception 'fluxo_v2_nao_liberado' using errcode = '42501';
  end if;
  if not (v_row.dados_rascunho @> '{"versaoFluxo":2,"tipoAtendimento":"nao_cliente"}'::jsonb) then
  if v_row.cliente_id is null then raise exception 'cliente_obrigatoria' using errcode = '23514'; end if;
  if not exists (select 1 from public.atendimento_presencial_clientes apc where apc.id = v_row.cliente_id and apc.status = 'ativo') then raise exception 'cliente_inativa' using errcode = '23514'; end if;

  end if;

  v_payload := public.atendimento_presencial_normalizar_payload_ficha(v_row.dados_rascunho, false);
  v_payload:=public.atendimento_presencial_preparar_referencias(v_payload,(v_row.iniciado_em AT TIME ZONE 'America/Sao_Paulo')::date,v_row.cliente_id);
  v_resultado := v_payload->>'resultadoAtendimento';
  v_motivo_outro := v_payload->>'motivoOutro';
  v_observacoes := v_payload->>'observacoes';
  v_consultora_nome := nullif(regexp_replace(btrim(coalesce(p_consultora_nome, v_payload->>'consultoraNome')), '[[:space:]]+', ' ', 'g'), '');

  if v_consultora_nome is null or char_length(v_consultora_nome) < 2 then raise exception 'consultora_nome_obrigatorio' using errcode = '23514'; end if;
  if char_length(v_consultora_nome) > 30 then raise exception 'consultora_nome_invalido' using errcode = '23514'; end if;
  if v_consultora_nome !~ '^[A-Za-z\xC0-\xD6\xD8-\xF6\xF8-\xFF]+( [A-Za-z\xC0-\xD6\xD8-\xF6\xF8-\xFF]+)*$' then raise exception 'consultora_nome_invalido' using errcode = '23514'; end if;

  if v_resultado = 'sim' then
    if p_numero_lancamento is null or p_numero_lancamento < 1 or p_numero_lancamento > 999999 then raise exception 'numero_lancamento_obrigatorio' using errcode = '23514'; end if;
    v_numero_lancamento := p_numero_lancamento;
  else
    if p_numero_lancamento is not null then raise exception 'numero_lancamento_indevido' using errcode = '23514'; end if;
    v_numero_lancamento := null;
  end if;

  delete from public.atendimento_presencial_criancas where atendimento_id = p_atendimento_id;
  delete from public.atendimento_presencial_departamentos where atendimento_id = p_atendimento_id;
  delete from public.atendimento_presencial_produtos_interesse where atendimento_id = p_atendimento_id;
  delete from public.atendimento_presencial_motivos where atendimento_id = p_atendimento_id;

  insert into public.atendimento_presencial_criancas (atendimento_id, ordem, local_id, situacao, nome, nome_nao_informado, sexo, data_prevista_nascimento, idade_unidade, idade_valor, presente_ja_nasceu, data_referencia_nascimento)
  select p_atendimento_id, item.ord::integer, nullif(btrim(item.value->>'id'), ''), item.value->>'situacao', case when coalesce((item.value->>'nomeNaoInformado')::boolean, false) then null else nullif(btrim(coalesce(item.value->>'nome', '')), '') end, coalesce((item.value->>'nomeNaoInformado')::boolean, false), nullif(item.value->>'sexo', ''), case when item.value->>'situacao' in ('gestacao', 'presente_outra_pessoa') and item.value->>'presenteJaNasceu' IS DISTINCT FROM 'true' and item.value ? 'dataPrevistaNascimento' then (item.value->>'dataPrevistaNascimento')::date else null end, case when (item.value->>'situacao' = 'ja_nasceu' OR (item.value->>'situacao'='presente_outra_pessoa' AND item.value->>'presenteJaNasceu'='true')) then item.value->>'idadeUnidade' else null end, case when (item.value->>'situacao' = 'ja_nasceu' OR (item.value->>'situacao'='presente_outra_pessoa' AND item.value->>'presenteJaNasceu'='true')) then (item.value->>'idadeValor')::integer else null end, (item.value->>'presenteJaNasceu')::boolean, (item.value->>'dataReferenciaNascimento')::date
  from jsonb_array_elements(v_payload->'criancas') with ordinality as item(value, ord);

  insert into public.atendimento_presencial_departamentos (atendimento_id, departamento, ordem)
  select p_atendimento_id, item.value #>> '{}', item.ord::integer from jsonb_array_elements(v_payload->'departamentos') with ordinality as item(value, ord);

  insert into public.atendimento_presencial_produtos_interesse (atendimento_id, descricao, ordem)
  select p_atendimento_id, btrim(item.value #>> '{}'), item.ord::integer from jsonb_array_elements(v_payload->'produtosInteresse') with ordinality as item(value, ord);

  insert into public.atendimento_presencial_motivos (atendimento_id, motivo, complemento, ordem)
  select p_atendimento_id, item.value #>> '{}', case when item.value #>> '{}' = 'outro' then v_motivo_outro else null end, item.ord::integer from jsonb_array_elements(v_payload->'motivosResultado') with ordinality as item(value, ord);

  update public.atendimento_presencial_atendimentos apa set status = 'concluido', cliente_id = case when v_payload->>'tipoAtendimento' = 'nao_cliente' then null else apa.cliente_id end, versao_fluxo = (v_payload->>'versaoFluxo')::smallint, tipo_atendimento = v_payload->>'tipoAtendimento', motivo_visita = v_payload->>'motivoVisita', observacao_nao_fechamento = v_payload->>'observacaoNaoFechamento', dados_rascunho = jsonb_build_object('schema', 'atendimento_presencial_concluido_v2'), resultado_atendimento = v_resultado, motivo_outro = v_motivo_outro, observacoes = v_observacoes, numero_lancamento = v_numero_lancamento, virada_cartao_dia = nullif(v_payload->>'viradaCartaoDia', '')::smallint, virada_cartao_mes = nullif(v_payload->>'viradaCartaoMes', '')::smallint, consultora_nome = v_consultora_nome, concluido_em = now(), ultima_atividade_em = now(), expira_em = now(), atualizado_por = p_usuario_id where apa.id = p_atendimento_id returning apa.id, apa.version into v_updated_id, v_updated_version;

  insert into public.atendimento_presencial_historico (atendimento_id, usuario_id, perfil, role, acao, origem, snapshot)
  values (p_atendimento_id, p_usuario_id, v_executor_perfil, v_executor_role, 'concluido', 'api', jsonb_build_object('versaoFluxo', v_payload->'versaoFluxo', 'tipoAtendimento', v_payload->>'tipoAtendimento', 'motivoVisita', v_payload->>'motivoVisita', 'observacaoNaoFechamento', v_payload->>'observacaoNaoFechamento', 'resultadoAtendimento', v_resultado, 'numeroLancamento', v_numero_lancamento, 'version', v_updated_version, 'viradaCartao', (v_payload->>'viradaCartaoDia') is not null, 'consultoraNome', v_consultora_nome, 'quantidadeCriancas', jsonb_array_length(v_payload->'criancas'), 'quantidadeDepartamentos', jsonb_array_length(v_payload->'departamentos'), 'quantidadeProdutosInteresse', jsonb_array_length(v_payload->'produtosInteresse'), 'quantidadeMotivosResultado', jsonb_array_length(v_payload->'motivosResultado')));

  return query select v_updated_id, v_updated_version;
end;
$function$;
CREATE OR REPLACE FUNCTION public.atendimento_presencial_editar_concluido(p_atendimento_id uuid, p_expected_version integer, p_usuario_id uuid, p_dados jsonb, p_numero_lancamento integer DEFAULT NULL::integer, p_consultora_nome text DEFAULT NULL::text)
 RETURNS TABLE(id uuid, version integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
declare
  v_row public.atendimento_presencial_atendimentos%rowtype;
  v_payload jsonb;
  v_resultado text;
  v_motivo_outro text;
  v_observacoes text;
  v_numero_lancamento integer;
  v_cliente_id uuid;
  v_consultora_nome text;
  v_executor_role text;
  v_tem_perfil_consultora boolean;
  v_tem_perfil_supervisora boolean;
  v_tem_perfil_gestao boolean;
  v_executor_perfil text;
  v_executor_unidade boolean;
  v_old_criancas jsonb;
  v_old_departamentos jsonb;
  v_old_produtos jsonb;
  v_old_motivos jsonb;
  v_new_criancas jsonb;
  v_new_departamentos jsonb;
  v_new_produtos jsonb;
  v_new_motivos jsonb;
  v_campos_alterados text[] := array[]::text[];
  v_updated_id uuid;
  v_updated_version integer;
begin
  select *
    into v_row
    from public.atendimento_presencial_atendimentos apa
    where apa.id = p_atendimento_id
    for update;

  if not found then
    raise exception 'atendimento_not_found' using errcode = 'P0002';
  end if;

  if v_row.status <> 'concluido' then
    raise exception 'atendimento_nao_concluido' using errcode = 'P0001';
  end if;

  if v_row.version <> p_expected_version then
    raise exception 'version_conflict' using errcode = 'P0003';
  end if;

  select up.role
    into v_executor_role
    from public.usuarios_permitidos up
    where up.id = p_usuario_id
      and up.ativo = true;

  if v_executor_role is null then
    raise exception 'executor_invalido' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.app_unidades au
    where au.id = v_row.unidade_id
      and au.ativo = true
  ) then
    raise exception 'unidade_inativa' using errcode = '23514';
  end if;

  if not exists (
    select 1
    from public.usuarios_permitidos up
    where up.id = v_row.consultora_usuario_id
      and up.ativo = true
  ) then
    raise exception 'consultora_inativa' using errcode = '23514';
  end if;

  -- Atendimentos criados por superadmin seguem a mesma excecao da conclusao.
  -- A autorizacao de quem executa a edicao continua sendo verificada abaixo.
  if not exists (
    select 1
    from public.usuarios_permitidos up
    where up.id = v_row.consultora_usuario_id
      and up.ativo = true
      and up.role = 'superadmin'
  ) then
    if not exists (
      select 1
      from public.app_usuarios_perfis aup
      join public.app_perfis_acesso apa on apa.id = aup.perfil_id
      where aup.usuario_id = v_row.consultora_usuario_id
        and apa.chave = 'consultora'
        and apa.ativo = true
    ) then
      raise exception 'consultora_perfil_invalido' using errcode = '23514';
    end if;

    if not exists (
      select 1
      from public.app_usuarios_unidades auu
      where auu.usuario_id = v_row.consultora_usuario_id
        and auu.unidade_id = v_row.unidade_id
    ) then
      raise exception 'consultora_unidade_invalida' using errcode = '23514';
    end if;

  end if;

  select
    exists (
      select 1
      from public.app_usuarios_perfis aup
      join public.app_perfis_acesso apa on apa.id = aup.perfil_id
      where aup.usuario_id = p_usuario_id
        and apa.chave = 'consultora'
        and apa.ativo = true
    ),
    exists (
      select 1
      from public.app_usuarios_perfis aup
      join public.app_perfis_acesso apa on apa.id = aup.perfil_id
      where aup.usuario_id = p_usuario_id
        and apa.chave = 'supervisora_loja'
        and apa.ativo = true
    ),
    exists (
      select 1
      from public.app_usuarios_perfis aup
      join public.app_perfis_acesso apa on apa.id = aup.perfil_id
      where aup.usuario_id = p_usuario_id
        and apa.chave = 'gestao'
        and apa.ativo = true
    )
  into v_tem_perfil_consultora, v_tem_perfil_supervisora, v_tem_perfil_gestao;

  v_executor_perfil := case
    when v_tem_perfil_supervisora then 'supervisora_loja'
    when v_tem_perfil_consultora then 'consultora'
    when v_tem_perfil_gestao then 'gestao'
    else null
  end;

  select exists (
    select 1
    from public.app_usuarios_unidades auu
    where auu.usuario_id = p_usuario_id
      and auu.unidade_id = v_row.unidade_id
  ) into v_executor_unidade;

  if v_executor_role = 'superadmin' then
    null;
  elsif v_tem_perfil_supervisora and v_executor_unidade then
    null;
  elsif v_tem_perfil_consultora
    and v_row.consultora_usuario_id = p_usuario_id
    and v_executor_unidade
    and v_row.concluido_em >= now() - interval '3 days'
  then
    null;
  else
    raise exception 'access_denied' using errcode = '42501';
  end if;

  if (v_row.versao_fluxo = 2 or p_dados->'versaoFluxo' = '2'::jsonb) and not public.atendimento_presencial_fluxo_v2_habilitado() then
    raise exception 'fluxo_v2_nao_liberado' using errcode = '42501';
  end if;
  if coalesce(v_row.versao_fluxo, 1) <> coalesce((p_dados->>'versaoFluxo')::integer, 1) then
    raise exception 'versao_fluxo_imutavel' using errcode = '23514';
  end if;
  v_payload := public.atendimento_presencial_normalizar_payload_ficha(p_dados, true);
  v_resultado := v_payload->>'resultadoAtendimento';
  v_motivo_outro := v_payload->>'motivoOutro';
  v_observacoes := v_payload->>'observacoes';
  v_cliente_id := case when v_payload->>'tipoAtendimento' = 'nao_cliente' then null else coalesce(nullif(v_payload->>'clienteId', '')::uuid, v_row.cliente_id) end;
  v_consultora_nome := nullif(regexp_replace(btrim(coalesce(p_consultora_nome, v_payload->>'consultoraNome')), '[[:space:]]+', ' ', 'g'), '');

  if v_consultora_nome is null or char_length(v_consultora_nome) < 2 then
    raise exception 'consultora_nome_obrigatorio' using errcode = '23514';
  end if;

  if char_length(v_consultora_nome) > 30 then
    raise exception 'consultora_nome_invalido' using errcode = '23514';
  end if;

  if v_consultora_nome !~ '^[A-Za-z\xC0-\xD6\xD8-\xF6\xF8-\xFF]+( [A-Za-z\xC0-\xD6\xD8-\xF6\xF8-\xFF]+)*$' then
    raise exception 'consultora_nome_invalido' using errcode = '23514';
  end if;

  if v_payload->>'tipoAtendimento' is distinct from 'nao_cliente' and not exists (
    select 1
    from public.atendimento_presencial_clientes apc
    where apc.id = v_cliente_id
      and apc.status = 'ativo'
  ) then
    raise exception 'cliente_inativa' using errcode = '23514';
  end if;

  if v_resultado = 'sim' then
    if p_numero_lancamento is null or p_numero_lancamento < 1 or p_numero_lancamento > 999999 then
      raise exception 'numero_lancamento_obrigatorio' using errcode = '23514';
    end if;
    v_numero_lancamento := p_numero_lancamento;
  else
    if p_numero_lancamento is not null then
      raise exception 'numero_lancamento_indevido' using errcode = '23514';
    end if;
    v_numero_lancamento := null;
  end if;

  -- Editor antigo conserva vínculos por local_id, sem mudar cadastro permanente.
  select jsonb_set(v_payload,'{criancas}',coalesce(jsonb_agg(item.value ||
    case when c.crianca_permanente_id is not null then jsonb_build_object('criancaPermanenteId',c.crianca_permanente_id,'vinculoClienteId',v_row.cliente_id,'parentesco',c.parentesco_vinculo) || jsonb_strip_nulls(jsonb_build_object('dataReferenciaNascimento',CASE WHEN item.value ? 'dataReferenciaNascimento' THEN item.value->'dataReferenciaNascimento' WHEN item.value->>'situacao'=c.situacao AND item.value->>'idadeUnidade' IS NOT DISTINCT FROM c.idade_unidade AND (item.value->>'idadeValor')::int IS NOT DISTINCT FROM c.idade_valor THEN to_jsonb(c.data_referencia_nascimento) END,'presenteJaNasceu',CASE WHEN item.value->>'situacao'='presente_outra_pessoa' THEN coalesce(item.value->'presenteJaNasceu',to_jsonb(c.presente_ja_nasceu)) END)) else '{}'::jsonb end order by item.ord),'[]'::jsonb)) into v_payload
    from jsonb_array_elements(v_payload->'criancas') with ordinality item(value,ord)
    left join public.atendimento_presencial_criancas c on c.atendimento_id=p_atendimento_id and c.local_id=item.value->>'id';
  if exists (select 1 from jsonb_array_elements(v_payload->'criancas') item where item ? 'criancaPermanenteId' and
    (item->>'vinculoClienteId' is distinct from v_cliente_id::text or not exists (
      select 1 from public.atendimento_presencial_clientes_criancas v where v.cliente_id=v_cliente_id and v.crianca_id=(item->>'criancaPermanenteId')::uuid))) then
    raise exception 'vinculo_invalido' using errcode='42501';
  end if;
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'ordem', c.ordem,
        'local_id', c.local_id,
        'situacao', c.situacao,
        'nome', c.nome,
        'nome_nao_informado', c.nome_nao_informado,
        'sexo', c.sexo,
        'data_prevista_nascimento', c.data_prevista_nascimento,
        'idade_unidade', c.idade_unidade,
        'idade_valor', c.idade_valor, 'presente_ja_nasceu',c.presente_ja_nasceu,'data_referencia_nascimento',c.data_referencia_nascimento
      )
      order by c.ordem
    ),
    '[]'::jsonb
  )
  into v_old_criancas
  from public.atendimento_presencial_criancas c
  where c.atendimento_id = p_atendimento_id;

  select coalesce(jsonb_agg(jsonb_build_object('ordem', d.ordem, 'departamento', d.departamento) order by d.ordem), '[]'::jsonb)
  into v_old_departamentos
  from public.atendimento_presencial_departamentos d
  where d.atendimento_id = p_atendimento_id;

  select coalesce(jsonb_agg(jsonb_build_object('ordem', p.ordem, 'descricao', p.descricao) order by p.ordem), '[]'::jsonb)
  into v_old_produtos
  from public.atendimento_presencial_produtos_interesse p
  where p.atendimento_id = p_atendimento_id;

  select coalesce(jsonb_agg(jsonb_build_object('ordem', m.ordem, 'motivo', m.motivo, 'complemento', m.complemento) order by m.ordem), '[]'::jsonb)
  into v_old_motivos
  from public.atendimento_presencial_motivos m
  where m.atendimento_id = p_atendimento_id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'ordem', item.ord::integer,
        'local_id', nullif(btrim(item.value->>'id'), ''),
        'situacao', item.value->>'situacao',
        'nome', case when coalesce((item.value->>'nomeNaoInformado')::boolean, false) then null else nullif(btrim(coalesce(item.value->>'nome', '')), '') end,
        'nome_nao_informado', coalesce((item.value->>'nomeNaoInformado')::boolean, false),
        'sexo', nullif(item.value->>'sexo', ''),
        'data_prevista_nascimento',
          case
            when item.value->>'situacao' in ('gestacao', 'presente_outra_pessoa') and item.value->>'presenteJaNasceu' IS DISTINCT FROM 'true' and item.value ? 'dataPrevistaNascimento'
            then to_jsonb((item.value->>'dataPrevistaNascimento')::date)
            else 'null'::jsonb
          end,
        'idade_unidade', case when (item.value->>'situacao' = 'ja_nasceu' OR (item.value->>'situacao'='presente_outra_pessoa' AND item.value->>'presenteJaNasceu'='true')) then item.value->>'idadeUnidade' else null end,
        'idade_valor', case when (item.value->>'situacao' = 'ja_nasceu' OR (item.value->>'situacao'='presente_outra_pessoa' AND item.value->>'presenteJaNasceu'='true')) then (item.value->>'idadeValor')::integer else null end, 'presente_ja_nasceu',(item.value->>'presenteJaNasceu')::boolean,'data_referencia_nascimento',(item.value->>'dataReferenciaNascimento')::date
      )
      order by item.ord
    ),
    '[]'::jsonb
  )
  into v_new_criancas
  from jsonb_array_elements(v_payload->'criancas') with ordinality as item(value, ord);

  select coalesce(jsonb_agg(jsonb_build_object('ordem', item.ord::integer, 'departamento', item.value #>> '{}') order by item.ord), '[]'::jsonb)
  into v_new_departamentos
  from jsonb_array_elements(v_payload->'departamentos') with ordinality as item(value, ord);

  select coalesce(jsonb_agg(jsonb_build_object('ordem', item.ord::integer, 'descricao', btrim(item.value #>> '{}')) order by item.ord), '[]'::jsonb)
  into v_new_produtos
  from jsonb_array_elements(v_payload->'produtosInteresse') with ordinality as item(value, ord);

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'ordem', item.ord::integer,
        'motivo', item.value #>> '{}',
        'complemento', case when item.value #>> '{}' = 'outro' then v_motivo_outro else null end
      )
      order by item.ord
    ),
    '[]'::jsonb
  )
  into v_new_motivos
  from jsonb_array_elements(v_payload->'motivosResultado') with ordinality as item(value, ord);

  if v_cliente_id is distinct from v_row.cliente_id then
    v_campos_alterados := array_append(v_campos_alterados, 'cliente');
  end if;
  if v_resultado is distinct from v_row.resultado_atendimento then
    v_campos_alterados := array_append(v_campos_alterados, 'resultadoAtendimento');
  end if;
  if v_motivo_outro is distinct from v_row.motivo_outro then
    v_campos_alterados := array_append(v_campos_alterados, 'motivoOutro');
  end if;
  if v_observacoes is distinct from v_row.observacoes then
    v_campos_alterados := array_append(v_campos_alterados, 'observacoes');
  end if;
  if v_numero_lancamento is distinct from v_row.numero_lancamento then
    v_campos_alterados := array_append(v_campos_alterados, 'numeroLancamento');
  end if;
  if nullif(v_payload->>'viradaCartaoDia', '')::smallint is distinct from v_row.virada_cartao_dia
    or nullif(v_payload->>'viradaCartaoMes', '')::smallint is distinct from v_row.virada_cartao_mes
  then
    v_campos_alterados := array_append(v_campos_alterados, 'viradaCartao');
  end if;
  if v_consultora_nome is distinct from v_row.consultora_nome then
    v_campos_alterados := array_append(v_campos_alterados, 'consultoraNome');
  end if;
  if v_old_criancas is distinct from v_new_criancas then
    v_campos_alterados := array_append(v_campos_alterados, 'criancas');
  end if;
  if v_old_departamentos is distinct from v_new_departamentos then
    v_campos_alterados := array_append(v_campos_alterados, 'departamentos');
  end if;
  if v_old_produtos is distinct from v_new_produtos then
    v_campos_alterados := array_append(v_campos_alterados, 'produtosInteresse');
  end if;
  if v_old_motivos is distinct from v_new_motivos then
    v_campos_alterados := array_append(v_campos_alterados, 'motivosResultado');
  end if;

  if v_row.tipo_atendimento is distinct from v_payload->>'tipoAtendimento'
    or v_row.motivo_visita is distinct from v_payload->>'motivoVisita'
    or v_row.observacao_nao_fechamento is distinct from v_payload->>'observacaoNaoFechamento' then
    v_campos_alterados := array_append(v_campos_alterados, 'contratoFluxo');
  end if;
  if array_length(v_campos_alterados, 1) is null then
    raise exception 'nenhuma_alteracao' using errcode = 'P0001';
  end if;

  delete from public.atendimento_presencial_criancas where atendimento_id = p_atendimento_id;
  delete from public.atendimento_presencial_departamentos where atendimento_id = p_atendimento_id;
  delete from public.atendimento_presencial_produtos_interesse where atendimento_id = p_atendimento_id;
  delete from public.atendimento_presencial_motivos where atendimento_id = p_atendimento_id;

  insert into public.atendimento_presencial_criancas (
    atendimento_id,
    ordem,
    local_id,
    situacao,
    nome,
    nome_nao_informado,
    sexo,
    data_prevista_nascimento,
    idade_unidade,
    idade_valor, crianca_permanente_id, parentesco_vinculo, presente_ja_nasceu, data_referencia_nascimento
  )
  select
    p_atendimento_id,
    item.ord::integer,
    nullif(btrim(item.value->>'id'), ''),
    item.value->>'situacao',
    case when coalesce((item.value->>'nomeNaoInformado')::boolean, false) then null else nullif(btrim(coalesce(item.value->>'nome', '')), '') end,
    coalesce((item.value->>'nomeNaoInformado')::boolean, false),
    nullif(item.value->>'sexo', ''),
    case
      when item.value->>'situacao' in ('gestacao', 'presente_outra_pessoa') and item.value->>'presenteJaNasceu' IS DISTINCT FROM 'true' and item.value ? 'dataPrevistaNascimento'
      then (item.value->>'dataPrevistaNascimento')::date
      else null
    end,
    case when (item.value->>'situacao' = 'ja_nasceu' OR (item.value->>'situacao'='presente_outra_pessoa' AND item.value->>'presenteJaNasceu'='true')) then item.value->>'idadeUnidade' else null end,
    case when (item.value->>'situacao' = 'ja_nasceu' OR (item.value->>'situacao'='presente_outra_pessoa' AND item.value->>'presenteJaNasceu'='true')) then (item.value->>'idadeValor')::integer else null end,
    (item.value->>'criancaPermanenteId')::uuid, item.value->>'parentesco', (item.value->>'presenteJaNasceu')::boolean, (item.value->>'dataReferenciaNascimento')::date
  from jsonb_array_elements(v_payload->'criancas') with ordinality as item(value, ord);

  insert into public.atendimento_presencial_departamentos (atendimento_id, departamento, ordem)
  select p_atendimento_id, item.value #>> '{}', item.ord::integer
  from jsonb_array_elements(v_payload->'departamentos') with ordinality as item(value, ord);

  insert into public.atendimento_presencial_produtos_interesse (atendimento_id, descricao, ordem)
  select p_atendimento_id, btrim(item.value #>> '{}'), item.ord::integer
  from jsonb_array_elements(v_payload->'produtosInteresse') with ordinality as item(value, ord);

  insert into public.atendimento_presencial_motivos (atendimento_id, motivo, complemento, ordem)
  select
    p_atendimento_id,
    item.value #>> '{}',
    case when item.value #>> '{}' = 'outro' then v_motivo_outro else null end,
    item.ord::integer
  from jsonb_array_elements(v_payload->'motivosResultado') with ordinality as item(value, ord);

  update public.atendimento_presencial_atendimentos apa
  set
    cliente_id = v_cliente_id,
    versao_fluxo = (v_payload->>'versaoFluxo')::smallint,
    tipo_atendimento = v_payload->>'tipoAtendimento',
    motivo_visita = v_payload->>'motivoVisita',
    observacao_nao_fechamento = v_payload->>'observacaoNaoFechamento',
    dados_rascunho = jsonb_build_object('schema', 'atendimento_presencial_concluido_v2', 'editadoConcluido', true),
    resultado_atendimento = v_resultado,
    motivo_outro = v_motivo_outro,
    observacoes = v_observacoes,
    numero_lancamento = v_numero_lancamento,
    virada_cartao_dia = nullif(v_payload->>'viradaCartaoDia', '')::smallint,
    virada_cartao_mes = nullif(v_payload->>'viradaCartaoMes', '')::smallint,
    consultora_nome = v_consultora_nome,
    ultima_atividade_em = now(),
    expira_em = now(),
    atualizado_por = p_usuario_id
  where apa.id = p_atendimento_id
  returning apa.id, apa.version
  into v_updated_id, v_updated_version;

  insert into public.atendimento_presencial_historico (
    atendimento_id,
    usuario_id,
    perfil,
    role,
    acao,
    origem,
    snapshot
  )
  values (
    p_atendimento_id,
    p_usuario_id,
    v_executor_perfil,
    v_executor_role,
    'editado_concluido',
    'api',
    jsonb_build_object(
      'versaoAnterior', v_row.version,
      'versaoNova', v_updated_version,
      'camposAlterados', to_jsonb(v_campos_alterados),
      'resultadoAnterior', v_row.resultado_atendimento,
      'resultadoNovo', v_resultado,
      'numeroLancamentoAlterado', v_numero_lancamento is distinct from v_row.numero_lancamento,
      'viradaCartaoAlterada',
        nullif(v_payload->>'viradaCartaoDia', '')::smallint is distinct from v_row.virada_cartao_dia
        or nullif(v_payload->>'viradaCartaoMes', '')::smallint is distinct from v_row.virada_cartao_mes,
      'consultoraNomeAlterado', v_consultora_nome is distinct from v_row.consultora_nome,
      'versaoFluxo', v_payload->'versaoFluxo',
      'tipoAtendimentoAnterior', v_row.tipo_atendimento,
      'tipoAtendimentoNovo', v_payload->>'tipoAtendimento',
      'motivoVisitaAnterior', v_row.motivo_visita,
      'motivoVisitaNovo', v_payload->>'motivoVisita',
      'observacaoNaoFechamentoAnterior', v_row.observacao_nao_fechamento,
      'observacaoNaoFechamentoNova', v_payload->>'observacaoNaoFechamento',
      'quantidadeCriancasAnterior', jsonb_array_length(v_old_criancas),
      'quantidadeCriancasNova', jsonb_array_length(v_new_criancas),
      'quantidadeDepartamentosAnterior', jsonb_array_length(v_old_departamentos),
      'quantidadeDepartamentosNova', jsonb_array_length(v_new_departamentos),
      'quantidadeProdutosInteresseAnterior', jsonb_array_length(v_old_produtos),
      'quantidadeProdutosInteresseNova', jsonb_array_length(v_new_produtos),
      'quantidadeMotivosResultadoAnterior', jsonb_array_length(v_old_motivos),
      'quantidadeMotivosResultadoNova', jsonb_array_length(v_new_motivos)
    )
  );

  return query select v_updated_id, v_updated_version;
end;
$function$;
CREATE OR REPLACE FUNCTION public.atendimento_presencial_efetivar_criancas() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE item jsonb; cadastro uuid; relacao text;
BEGIN
  IF OLD.status <> 'rascunho' OR NEW.status <> 'concluido' OR NEW.versao_fluxo IS DISTINCT FROM 2 OR NEW.tipo_atendimento <> 'cliente' THEN RETURN NEW; END IF;
  IF NOT public.atendimento_presencial_criancas_habilitado() THEN RAISE EXCEPTION 'criancas_nao_homologadas' USING ERRCODE='23514'; END IF;
  PERFORM 1 FROM public.atendimento_presencial_clientes WHERE id=NEW.cliente_id AND status='ativo' FOR UPDATE;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(OLD.dados_rascunho->'criancas') c GROUP BY c->>'id' HAVING count(*)>1)
    OR EXISTS (SELECT 1 FROM jsonb_array_elements(OLD.dados_rascunho->'criancas') c WHERE c ? 'criancaPermanenteId' GROUP BY c->>'criancaPermanenteId' HAVING count(*)>1)
  THEN RAISE EXCEPTION 'crianca_duplicada' USING ERRCODE='23514'; END IF;
  FOR item IN SELECT value FROM jsonb_array_elements(OLD.dados_rascunho->'criancas') LOOP
    item:=(public.atendimento_presencial_preparar_referencias(jsonb_build_object('versaoFluxo',2,'criancas',jsonb_build_array(item)),(OLD.iniciado_em AT TIME ZONE 'America/Sao_Paulo')::date,NEW.cliente_id)->'criancas')->0;
    cadastro := NULL; relacao := NULL;
    IF item ? 'criancaPermanenteId' THEN
      IF item->>'vinculoClienteId' IS DISTINCT FROM NEW.cliente_id::text THEN RAISE EXCEPTION 'vinculo_invalido' USING ERRCODE='42501'; END IF;
      SELECT crianca_id,parentesco INTO cadastro,relacao FROM public.atendimento_presencial_clientes_criancas WHERE cliente_id=NEW.cliente_id AND crianca_id=(item->>'criancaPermanenteId')::uuid;
      IF cadastro IS NULL THEN RAISE EXCEPTION 'vinculo_invalido' USING ERRCODE='42501'; END IF;
    ELSE
      relacao := item->>'parentesco';
      IF relacao IS NULL OR char_length(btrim(relacao)) NOT BETWEEN 2 AND 60 THEN RAISE EXCEPTION 'parentesco_invalido' USING ERRCODE='23514'; END IF;
      INSERT INTO public.atendimento_presencial_criancas_cadastro(dados,criado_por) VALUES(item - ARRAY['criancaPermanenteId','vinculoClienteId','parentesco'],NEW.atualizado_por) RETURNING id INTO cadastro;
      INSERT INTO public.atendimento_presencial_clientes_criancas(cliente_id,crianca_id,parentesco,criado_por) VALUES(NEW.cliente_id,cadastro,relacao,NEW.atualizado_por);
    END IF;
    UPDATE public.atendimento_presencial_criancas SET crianca_permanente_id=cadastro,parentesco_vinculo=relacao,data_referencia_nascimento=(item->>'dataReferenciaNascimento')::date,presente_ja_nasceu=(item->>'presenteJaNasceu')::boolean WHERE atendimento_id=NEW.id AND local_id=item->>'id';
  END LOOP;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.atendimento_presencial_preparar_referencias(jsonb,date,uuid),public.atendimento_presencial_cadastro_referencia() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.atendimento_presencial_preparar_referencias(jsonb,date,uuid),public.atendimento_presencial_cadastro_referencia() TO service_role;
COMMIT;
