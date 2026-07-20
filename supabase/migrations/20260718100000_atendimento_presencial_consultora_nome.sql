-- Adiciona coluna consultora_nome para persistir o nome da consultora informado manualmente.
-- A coluna e nullable para manter compatibilidade com registros legados.
-- A validacao de obrigatoriedade e feita nas RPCs de concluir e editar, nao via constraint.

alter table public.atendimento_presencial_atendimentos
  add column if not exists consultora_nome text;

alter table public.atendimento_presencial_atendimentos
  drop constraint if exists atendimento_presencial_atendimentos_consultora_nome_check,
  add constraint atendimento_presencial_atendimentos_consultora_nome_check
  check (
    consultora_nome is null
    or (
      char_length(btrim(consultora_nome)) between 2 and 30
      and btrim(consultora_nome) ~ '^[A-Za-z\xC0-\xD6\xD8-\xF6\xF8-\xFF]+( [A-Za-z\xC0-\xD6\xD8-\xF6\xF8-\xFF]+)*$'
    )
  );

-- Recria normalizar_payload_ficha para incluir consultoraNome e permitir dataPrevistaNascimento para presente_outra_pessoa.

create or replace function public.atendimento_presencial_normalizar_payload_ficha(
  p_dados jsonb,
  p_permitir_cliente_id boolean default false
)
returns jsonb
language plpgsql
set search_path = pg_catalog, public, pg_temp
as $$
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
$$;

revoke all on function public.atendimento_presencial_normalizar_payload_ficha(jsonb, boolean)
  from public, anon, authenticated;
grant execute on function public.atendimento_presencial_normalizar_payload_ficha(jsonb, boolean)
  to service_role;

-- Recria atendimento_presencial_concluir com parametro p_consultora_nome
-- e permite dataPrevistaNascimento para presente_outra_pessoa.

drop function if exists public.atendimento_presencial_concluir(uuid, integer, uuid, integer);

create or replace function public.atendimento_presencial_concluir(
  p_atendimento_id uuid,
  p_expected_version integer,
  p_usuario_id uuid,
  p_numero_lancamento integer default null,
  p_consultora_nome text default null
)
returns table(id uuid, version integer)
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
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
  v_executor_perfil text;
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

  if v_row.status <> 'rascunho' then
    raise exception 'atendimento_not_draft' using errcode = 'P0001';
  end if;

  if v_row.version <> p_expected_version then
    raise exception 'version_conflict' using errcode = 'P0003';
  end if;

  if v_row.expira_em <= now() then
    raise exception 'rascunho_expirado' using errcode = 'P0004';
  end if;

  select up.role
    into v_executor_role
    from public.usuarios_permitidos up
    where up.id = p_usuario_id
      and up.ativo = true;

  if v_executor_role is null then
    raise exception 'executor_invalido' using errcode = '42501';
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

  if v_executor_role <> 'superadmin' and v_executor_perfil is null then
    raise exception 'perfil_executor_invalido' using errcode = '42501';
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

  if v_executor_role = 'superadmin' then
    null;
  elsif v_tem_perfil_supervisora then
    if not exists (
      select 1
      from public.app_usuarios_unidades auu
      where auu.usuario_id = p_usuario_id
        and auu.unidade_id = v_row.unidade_id
    ) then
      raise exception 'access_denied' using errcode = '42501';
    end if;
  elsif v_tem_perfil_gestao then
    if not exists (
      select 1
      from public.app_usuarios_unidades auu
      where auu.usuario_id = p_usuario_id
        and auu.unidade_id = v_row.unidade_id
    ) then
      raise exception 'access_denied' using errcode = '42501';
    end if;
  elsif v_tem_perfil_consultora then
    if v_row.consultora_usuario_id <> p_usuario_id then
      raise exception 'access_denied' using errcode = '42501';
    end if;
    if not exists (
      select 1
      from public.app_usuarios_unidades auu
      where auu.usuario_id = p_usuario_id
        and auu.unidade_id = v_row.unidade_id
    ) then
      raise exception 'access_denied' using errcode = '42501';
    end if;
  else
    raise exception 'access_denied' using errcode = '42501';
  end if;

  if v_row.cliente_id is null then
    raise exception 'cliente_obrigatoria' using errcode = '23514';
  end if;

  if not exists (
    select 1
    from public.atendimento_presencial_clientes apc
    where apc.id = v_row.cliente_id
      and apc.status = 'ativo'
  ) then
    raise exception 'cliente_inativa' using errcode = '23514';
  end if;

  v_payload := public.atendimento_presencial_normalizar_payload_ficha(v_row.dados_rascunho, false);
  v_resultado := v_payload->>'resultadoAtendimento';
  v_motivo_outro := v_payload->>'motivoOutro';
  v_observacoes := v_payload->>'observacoes';
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
    idade_valor
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
      when item.value->>'situacao' in ('gestacao', 'presente_outra_pessoa') and item.value ? 'dataPrevistaNascimento'
      then (item.value->>'dataPrevistaNascimento')::date
      else null
    end,
    case when item.value->>'situacao' = 'ja_nasceu' then item.value->>'idadeUnidade' else null end,
    case when item.value->>'situacao' = 'ja_nasceu' then (item.value->>'idadeValor')::integer else null end
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
    status = 'concluido',
    dados_rascunho = jsonb_build_object('schema', 'atendimento_presencial_concluido_v2'),
    resultado_atendimento = v_resultado,
    motivo_outro = v_motivo_outro,
    observacoes = v_observacoes,
    numero_lancamento = v_numero_lancamento,
    virada_cartao_dia = nullif(v_payload->>'viradaCartaoDia', '')::smallint,
    virada_cartao_mes = nullif(v_payload->>'viradaCartaoMes', '')::smallint,
    consultora_nome = v_consultora_nome,
    concluido_em = now(),
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
    'concluido',
    'api',
    jsonb_build_object(
      'resultadoAtendimento', v_resultado,
      'numeroLancamento', v_numero_lancamento,
      'version', v_updated_version,
      'viradaCartao', (v_payload->>'viradaCartaoDia') is not null,
      'consultoraNome', v_consultora_nome,
      'quantidadeCriancas', jsonb_array_length(v_payload->'criancas'),
      'quantidadeDepartamentos', jsonb_array_length(v_payload->'departamentos'),
      'quantidadeProdutosInteresse', jsonb_array_length(v_payload->'produtosInteresse'),
      'quantidadeMotivosResultado', jsonb_array_length(v_payload->'motivosResultado')
    )
  );

  return query select v_updated_id, v_updated_version;
end;
$$;

revoke all on function public.atendimento_presencial_concluir(uuid, integer, uuid, integer, text)
  from public, anon, authenticated;
grant execute on function public.atendimento_presencial_concluir(uuid, integer, uuid, integer, text)
  to service_role;

-- Recria atendimento_presencial_editar_concluido com parametro p_consultora_nome
-- e permite dataPrevistaNascimento para presente_outra_pessoa.

drop function if exists public.atendimento_presencial_editar_concluido(uuid, integer, uuid, jsonb, integer);

create or replace function public.atendimento_presencial_editar_concluido(
  p_atendimento_id uuid,
  p_expected_version integer,
  p_usuario_id uuid,
  p_dados jsonb,
  p_numero_lancamento integer default null,
  p_consultora_nome text default null
)
returns table(id uuid, version integer)
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
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

  v_payload := public.atendimento_presencial_normalizar_payload_ficha(p_dados, true);
  v_resultado := v_payload->>'resultadoAtendimento';
  v_motivo_outro := v_payload->>'motivoOutro';
  v_observacoes := v_payload->>'observacoes';
  v_cliente_id := coalesce(nullif(v_payload->>'clienteId', '')::uuid, v_row.cliente_id);
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

  if not exists (
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
        'idade_valor', c.idade_valor
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
            when item.value->>'situacao' in ('gestacao', 'presente_outra_pessoa') and item.value ? 'dataPrevistaNascimento'
            then to_jsonb((item.value->>'dataPrevistaNascimento')::date)
            else 'null'::jsonb
          end,
        'idade_unidade', case when item.value->>'situacao' = 'ja_nasceu' then item.value->>'idadeUnidade' else null end,
        'idade_valor', case when item.value->>'situacao' = 'ja_nasceu' then (item.value->>'idadeValor')::integer else null end
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
    idade_valor
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
      when item.value->>'situacao' in ('gestacao', 'presente_outra_pessoa') and item.value ? 'dataPrevistaNascimento'
      then (item.value->>'dataPrevistaNascimento')::date
      else null
    end,
    case when item.value->>'situacao' = 'ja_nasceu' then item.value->>'idadeUnidade' else null end,
    case when item.value->>'situacao' = 'ja_nasceu' then (item.value->>'idadeValor')::integer else null end
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
    dados_rascunho = jsonb_build_object('schema', 'atendimento_presencial_concluido_v2', 'editadoConcluido', true),
    resultado_atendimento = v_resultado,
    motivo_outro = v_motivo_outro,
    observacoes = v_observacoes,
    numero_lancamento = v_numero_lancamento,
    virada_cartao_dia = nullif(v_payload->>'viradaCartaoDia', '')::smallint,
    virada_cartao_mes = nullif(v_payload->>'viradaCartaoMes', '')::smallint,
    consultora_nome = v_consultora_nome,
    ultima_atividade_em = now(),
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
$$;

revoke all on function public.atendimento_presencial_editar_concluido(uuid, integer, uuid, jsonb, integer, text)
  from public, anon, authenticated;
grant execute on function public.atendimento_presencial_editar_concluido(uuid, integer, uuid, jsonb, integer, text)
  to service_role;
