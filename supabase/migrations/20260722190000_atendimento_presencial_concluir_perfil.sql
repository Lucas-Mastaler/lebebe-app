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
  v_tem_acesso_ficha boolean;
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

  if v_executor_role = 'superadmin' then
    null;
  else
    select exists (
      select 1
      from public.app_modulos am
      left join public.app_permissoes_usuario apu
        on apu.modulo_id = am.id
       and apu.usuario_id = p_usuario_id
      left join public.app_usuarios_perfis aup
        on aup.usuario_id = p_usuario_id
      left join public.app_perfis_acesso apa
        on apa.id = aup.perfil_id
       and apa.ativo = true
      left join public.app_permissoes_perfil app
        on app.modulo_id = am.id
       and app.perfil_id = apa.id
      where am.chave = 'atendimento_presencial_ficha'
        and am.ativo = true
        and am.publico = false
        and am.somente_superadmin = false
        and (
          apu.permitido = true
          or (apu.permitido is null and app.permitido = true)
        )
    ) into v_tem_acesso_ficha;

    if not v_tem_acesso_ficha then
      raise exception 'perfil_executor_invalido' using errcode = '42501';
    end if;

    if not exists (
      select 1
      from public.app_usuarios_unidades auu
      where auu.usuario_id = p_usuario_id
        and auu.unidade_id = v_row.unidade_id
    ) then
      raise exception 'access_denied' using errcode = '42501';
    end if;
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

