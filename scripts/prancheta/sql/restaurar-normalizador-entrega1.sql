-- Recuperacao apenas com autorizacao explicita. Restaura definicao anterior da funcao.
-- Nao executar depois de novas migrations que alterem este normalizador.
DO $recuperacao$
BEGIN
  IF (SELECT md5(replace(prosrc, E'\r\n', E'\n')) FROM pg_proc
      WHERE oid = 'public.atendimento_presencial_normalizar_payload_ficha(jsonb,boolean)'::regprocedure)
      IS DISTINCT FROM 'cd942ee2f2e617ca5a77003b280bfae4' THEN
    RAISE EXCEPTION 'normalizador_alterado_revalidar_antes_de_restaurar';
  END IF;
END;
$recuperacao$;

CREATE OR REPLACE FUNCTION public.atendimento_presencial_normalizar_payload_ficha(p_dados jsonb, p_permitir_cliente_id boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
declare
  v_resultado text;
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

  if jsonb_array_length(p_dados->'motivosResultado') = 0 or jsonb_array_length(p_dados->'motivosResultado') > 24 then
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
        'idadeValor'
      )
    ) then
      raise exception 'crianca_chave_invalida' using errcode = '23514';
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
  );
exception
  when invalid_text_representation or numeric_value_out_of_range then
    raise exception 'dados_rascunho_invalidos' using errcode = '23514';
end;
$function$;

REVOKE ALL ON FUNCTION public.atendimento_presencial_normalizar_payload_ficha(jsonb, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.atendimento_presencial_normalizar_payload_ficha(jsonb, boolean) TO service_role;

