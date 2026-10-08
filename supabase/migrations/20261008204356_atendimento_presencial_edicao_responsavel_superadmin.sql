-- Corrige somente a elegibilidade do responsavel superadmin na edicao.
do $precondition$
begin
  if md5(pg_get_functiondef('public.atendimento_presencial_editar_concluido(uuid,integer,uuid,jsonb,integer,text)'::regprocedure)) <> '3e317a8eb18cecde008586ed8961f479' then
    raise exception 'Definicao da RPC de edicao divergiu da versao auditada; revise antes de aplicar.';
  end if;
end;
$precondition$;

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
$function$
