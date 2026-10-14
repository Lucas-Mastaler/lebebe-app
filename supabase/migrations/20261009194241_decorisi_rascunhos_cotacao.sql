-- Todas as rotinas são SECURITY INVOKER, apenas service_role; autorização
-- de módulo/janela e propriedade do rascunho também é exigida pelo backend.
create function public.decorisi_exigir_escopo(p_usuario uuid,p_unidade uuid) returns void language plpgsql security invoker set search_path=pg_catalog,public as $$
begin
  if not exists(select 1 from public.usuarios_permitidos u where u.id=p_usuario and u.ativo and
    (u.role='superadmin' or exists(select 1 from public.app_usuarios_unidades a where a.usuario_id=u.id and a.unidade_id=p_unidade)))
    or not exists(select 1 from public.app_unidades where id=p_unidade and ativo and chave in ('bigorrilho','portao','marechal','feira')) then
    raise exception 'ACESSO_NEGADO' using errcode='42501';
  end if;
end $$;

create function public.decorisi_vincular_produtos_sgi() returns void language plpgsql security invoker set search_path=pg_catalog,public as $$
begin
  -- Não lê nem escreve no SGI: exige onboarding já feito pelo worker existente.
  if (select count(*) from public.sgi_produtos_cache c join (values (36565,'19075'),(36566,'19076'),(36567,'19077'),(36568,'19078')) v(id,codigo) on c.produto_id_sgi=v.id and c.codigo=v.codigo where c.ativo is true and c.fora_linha is false and c.preco>0 and c.preco::text not in ('NaN','Infinity','-Infinity'))<>4 then
    raise exception 'CACHE_DECORISI_INCOMPLETO' using errcode='23514';
  end if;
  update public.pedidos_personalizados_produtos p set produto_id_sgi=v.id
  from public.pedidos_personalizados_fornecedores f, (values (36565,'19075'),(36566,'19076'),(36567,'19077'),(36568,'19078')) v(id,codigo)
  where p.fornecedor_id=f.id and f.chave='decorisi' and p.codigo=v.codigo;
end $$;

create function public.decorisi_salvar_itens(p_pedido uuid,p_usuario uuid,p_itens jsonb) returns void language plpgsql security invoker set search_path=pg_catalog,public as $$
declare v_p public.pedidos_personalizados_pedidos%rowtype; v_item jsonb; v_medida jsonb; v_id uuid; v_produto uuid; v_ref uuid; v_codigo text; v_ordem integer:=0; v_ordem_medida integer;
begin
  select * into v_p from public.pedidos_personalizados_pedidos where id=p_pedido for update;
  if not found then raise exception 'PEDIDO_NAO_ENCONTRADO' using errcode='P0002'; end if;
  perform public.decorisi_exigir_escopo(p_usuario,v_p.unidade_id);
  if v_p.status<>'RASCUNHO' then raise exception 'COMPOSICAO_DECORISI_BLOQUEADA' using errcode='23514'; end if;
  if jsonb_typeof(p_itens) is distinct from 'array' or jsonb_array_length(p_itens) not between 1 and 10 then raise exception 'LIMITE_ITENS_DECORISI' using errcode='22023'; end if;
  if exists(select 1 from jsonb_array_elements(p_itens) x where x->>'id' is not null group by (x->>'id')::uuid having count(*)>1) then raise exception 'ID_ITEM_DECORISI_DUPLICADO' using errcode='22023'; end if;
  -- A fila durável de limpeza recebe os arquivos na mesma transação (Fase 4).
  delete from public.pedidos_personalizados_decorisi_anexos a using public.pedidos_personalizados_decorisi_itens i
  where a.item_id=i.id and i.pedido_id=p_pedido and not exists(select 1 from jsonb_array_elements(p_itens) x where x->>'id'=i.id::text);
  delete from public.pedidos_personalizados_decorisi_itens i where i.pedido_id=p_pedido and not exists(select 1 from jsonb_array_elements(p_itens) x where x->>'id'=i.id::text);
  -- Evita colisões dos índices parciais durante reordenação/troca de referências.
  update public.pedidos_personalizados_decorisi_itens set referencia_db_id=null,referencia_pf=null where pedido_id=p_pedido;
  for v_item in select value from jsonb_array_elements(p_itens) loop
    v_ordem:=v_ordem+1;
    if jsonb_typeof(v_item)<>'object' or v_item->>'tipo' is null or v_item->>'tipo' not in ('PAPEL','PAINEL') or v_item->>'classificacao' is null or v_item->>'classificacao' not in ('CATALOGO','PERSONALIZADO') then raise exception 'ITEM_DECORISI_INVALIDO' using errcode='22023'; end if;
    v_id:=coalesce((v_item->>'id')::uuid,gen_random_uuid());
    if exists(select 1 from public.pedidos_personalizados_decorisi_itens where id=v_id and pedido_id<>p_pedido) then raise exception 'ITEM_DECORISI_INVALIDO' using errcode='22023'; end if;
    v_codigo:=case when v_item->>'tipo'='PAPEL' then case when v_item->>'classificacao'='CATALOGO' then '19075' else '19076' end else case when v_item->>'classificacao'='CATALOGO' then '19077' else '19078' end end;
    select id into v_produto from public.pedidos_personalizados_produtos where fornecedor_id=v_p.fornecedor_id and codigo=v_codigo and ativo;
    v_ref:=null;
    if v_item->>'tipo'='PAPEL' and nullif(v_item->>'referencia','') is not null then
      select id into v_ref from public.pedidos_personalizados_decorisi_referencias where fornecedor_id=v_p.fornecedor_id and referencia=v_item->>'referencia' and ativo;
      if v_ref is null then raise exception 'REFERENCIA_DECORISI_INVALIDA' using errcode='22023'; end if;
    end if;
    insert into public.pedidos_personalizados_decorisi_itens(id,pedido_id,ordem,tipo,classificacao,produto_id,referencia_db_id,referencia_pf,descricao,observacoes,created_by,updated_by)
    values(v_id,p_pedido,v_ordem,v_item->>'tipo',v_item->>'classificacao',v_produto,v_ref,case when v_item->>'tipo'='PAINEL' then v_item->>'referencia' end,nullif(btrim(v_item->>'descricao'),''),nullif(btrim(v_item->>'observacoes'),''),p_usuario,p_usuario)
    on conflict(id) do update set ordem=excluded.ordem,tipo=excluded.tipo,classificacao=excluded.classificacao,produto_id=excluded.produto_id,referencia_db_id=excluded.referencia_db_id,referencia_pf=excluded.referencia_pf,descricao=excluded.descricao,observacoes=excluded.observacoes,updated_by=p_usuario,updated_at=now();
    if jsonb_typeof(v_item->'medidas') is distinct from 'array' or jsonb_array_length(v_item->'medidas')>20 then raise exception 'LIMITE_MEDIDAS_DECORISI' using errcode='22023'; end if;
    delete from public.pedidos_personalizados_decorisi_medidas where item_id=v_id;
    v_ordem_medida:=0;
    for v_medida in select value from jsonb_array_elements(v_item->'medidas') loop
      v_ordem_medida:=v_ordem_medida+1;
      if jsonb_typeof(v_medida)<>'object' or coalesce(v_medida->>'larguraCm','1') !~ '^[0-9]+$' or coalesce(v_medida->>'alturaCm','1') !~ '^[0-9]+$' then raise exception 'MEDIDA_DECORISI_INVALIDA' using errcode='22023'; end if;
      insert into public.pedidos_personalizados_decorisi_medidas(item_id,ordem,largura_cm,altura_cm,ambiente)
      values(v_id,v_ordem_medida,(v_medida->>'larguraCm')::integer,(v_medida->>'alturaCm')::integer,nullif(btrim(v_medida->>'ambiente'),''));
    end loop;
  end loop;
end $$;

create function public.criar_pedido_personalizado_decorisi(p_usuario_id uuid,p_idempotency_key uuid,p_unidade_id uuid,p_consultora text,p_cliente text,p_telefone_normalizado text,p_itens jsonb) returns jsonb language plpgsql security invoker set search_path=pg_catalog,public as $$
declare v_p public.pedidos_personalizados_pedidos%rowtype; v_fornecedor uuid; v_hash text;
begin
  perform public.decorisi_exigir_escopo(p_usuario_id,p_unidade_id);
  if p_idempotency_key is null or p_telefone_normalizado is null or p_telefone_normalizado !~ '^[0-9]{10,11}$' or left(p_telefone_normalizado,2)='00' then raise exception 'DADOS_DECORISI_INVALIDOS' using errcode='22023'; end if;
  v_hash:=encode(sha256(convert_to(jsonb_build_object('unidade',p_unidade_id,'consultora',p_consultora,'cliente',p_cliente,'telefone',p_telefone_normalizado,'itens',p_itens)::text,'UTF8')),'hex');
  perform pg_advisory_xact_lock(hashtextextended(p_usuario_id::text||':'||p_idempotency_key::text,0));
  select * into v_p from public.pedidos_personalizados_pedidos where created_by=p_usuario_id and idempotency_key=p_idempotency_key;
  if found then
    if v_p.decorisi_criacao_hash is distinct from v_hash then raise exception 'IDEMPOTENCY_PAYLOAD_DIVERGENTE' using errcode='22023'; end if;
    return jsonb_build_object('pedidoId',v_p.id,'version',v_p.version,'reutilizado',true);
  end if;
  select id into v_fornecedor from public.pedidos_personalizados_fornecedores where chave='decorisi' and disponivel;
  if v_fornecedor is null then raise exception 'FORNECEDOR_INDISPONIVEL' using errcode='23514'; end if;
  insert into public.pedidos_personalizados_pedidos(fornecedor_id,unidade_id,consultora,cliente,telefone_normalizado,idempotency_key,created_by,updated_by,decorisi_criacao_hash)
  values(v_fornecedor,p_unidade_id,p_consultora,p_cliente,p_telefone_normalizado,p_idempotency_key,p_usuario_id,p_usuario_id,v_hash) returning * into v_p;
  perform public.decorisi_salvar_itens(v_p.id,p_usuario_id,p_itens);
  return jsonb_build_object('pedidoId',v_p.id,'version',v_p.version,'reutilizado',false);
end $$;

create function public.atualizar_pedido_personalizado_decorisi(p_pedido_id uuid,p_usuario_id uuid,p_expected_version integer,p_itens jsonb,p_identificacao jsonb default null) returns jsonb language plpgsql security invoker set search_path=pg_catalog,public as $$
declare v_p public.pedidos_personalizados_pedidos%rowtype;
begin
  select * into v_p from public.pedidos_personalizados_pedidos where id=p_pedido_id for update;
  if not found then raise exception 'PEDIDO_NAO_ENCONTRADO' using errcode='P0002'; end if;
  perform public.decorisi_exigir_escopo(p_usuario_id,v_p.unidade_id);
  if p_expected_version is null or v_p.version<>p_expected_version then raise exception 'CONFLITO_VERSAO' using errcode='P0003'; end if;
  perform public.decorisi_salvar_itens(p_pedido_id,p_usuario_id,p_itens);
  if p_identificacao is not null then
    if jsonb_typeof(p_identificacao)<>'object' or p_identificacao->>'consultora' is null or p_identificacao->>'cliente' is null or p_identificacao->>'telefone_normalizado' is null or p_identificacao->>'telefone_normalizado' !~ '^[0-9]{10,11}$' or left(p_identificacao->>'telefone_normalizado',2)='00' then raise exception 'DADOS_DECORISI_INVALIDOS' using errcode='22023'; end if;
    perform public.decorisi_exigir_escopo(p_usuario_id,(p_identificacao->>'unidade_id')::uuid);
    update public.pedidos_personalizados_pedidos set unidade_id=(p_identificacao->>'unidade_id')::uuid,consultora=p_identificacao->>'consultora',cliente=p_identificacao->>'cliente',telefone_normalizado=p_identificacao->>'telefone_normalizado' where id=p_pedido_id;
  end if;
  update public.pedidos_personalizados_pedidos set version=version+1,updated_by=p_usuario_id where id=p_pedido_id;
  return jsonb_build_object('pedidoId',p_pedido_id,'version',(select version from public.pedidos_personalizados_pedidos where id=p_pedido_id));
end $$;

create function public.calcular_item_decorisi(p_item uuid) returns jsonb language plpgsql stable security invoker set search_path=pg_catalog,public as $$
declare v_i record; v_g record; v_pendencias jsonb:='[]'; v_num numeric:=0; v_den numeric:=1; v_faixas integer; v_comprimento bigint; v_area numeric; v_quantidade numeric; v_subtotal numeric; v_grupos jsonb:='[]';
begin
  select i.*,p.codigo,p.produto_id_sgi,p.ativo as produto_ativo,c.codigo as codigo_cache,c.preco,c.ativo,c.fora_linha,c.ultima_validacao_sgi,r.referencia,r.repeticao_m,r.versao as referencia_versao,r.ativo as referencia_ativa
  into v_i from public.pedidos_personalizados_decorisi_itens i
  join public.pedidos_personalizados_produtos p on p.id=i.produto_id
  left join public.sgi_produtos_cache c on c.produto_id_sgi=p.produto_id_sgi
  left join public.pedidos_personalizados_decorisi_referencias r on r.id=i.referencia_db_id where i.id=p_item;
  if not found then raise exception 'ITEM_DECORISI_INVALIDO' using errcode='22023'; end if;
  if v_i.snapshot_comercial is not null then return v_i.snapshot_comercial; end if;
  if not v_i.produto_ativo or v_i.ativo is distinct from true or v_i.fora_linha is distinct from false or v_i.preco is null or v_i.preco<=0 or v_i.preco::text in ('NaN','Infinity','-Infinity') or v_i.codigo_cache is distinct from v_i.codigo or v_i.produto_id_sgi is distinct from (case v_i.codigo when '19075' then 36565 when '19076' then 36566 when '19077' then 36567 when '19078' then 36568 end) then
    v_pendencias:=v_pendencias||'"PRECO_DECORISI_INDISPONIVEL"'::jsonb;
  end if;
  if v_i.tipo='PAPEL' and (v_i.referencia is null or not v_i.referencia_ativa) or v_i.tipo='PAINEL' and v_i.classificacao='CATALOGO' and v_i.referencia_pf is null then v_pendencias:=v_pendencias||'"REFERENCIA_DECORISI_OBRIGATORIA"'::jsonb; end if;
  if v_i.classificacao='PERSONALIZADO' then
    if v_i.descricao is null then v_pendencias:=v_pendencias||'"DESCRICAO_PERSONALIZACAO_OBRIGATORIA"'::jsonb; end if;
    if not exists(select 1 from public.pedidos_personalizados_decorisi_anexos where item_id=p_item) then v_pendencias:=v_pendencias||'"ANEXO_PERSONALIZACAO_OBRIGATORIO"'::jsonb; end if;
  end if;
  if not exists(select 1 from public.pedidos_personalizados_decorisi_medidas where item_id=p_item) or exists(select 1 from public.pedidos_personalizados_decorisi_medidas where item_id=p_item and (altura_cm is null or largura_cm is null)) then
    v_pendencias:=v_pendencias||'"MEDIDAS_DECORISI_OBRIGATORIAS"'::jsonb;
  elsif v_i.tipo='PAINEL' then
    select sum(largura_cm::numeric*altura_cm::numeric) into v_area from public.pedidos_personalizados_decorisi_medidas where item_id=p_item;
    v_quantidade:=round(v_area/10000,4);
  elsif v_i.referencia is not null then
    for v_g in select altura_cm,sum(largura_cm::numeric) as largura from public.pedidos_personalizados_decorisi_medidas where item_id=p_item group by altura_cm order by altura_cm loop
      v_comprimento:=v_g.altura_cm::bigint+(v_i.repeticao_m*100)::bigint+5;
      v_faixas:=1000/v_comprimento;
      if v_faixas<1 then v_pendencias:=v_pendencias||'"ALTURA_EXCEDE_ROLO_DECORISI"'::jsonb; exit; end if;
      v_num:=v_num*(v_faixas*62)+v_g.largura*v_den;
      v_den:=v_den*(v_faixas*62);
      v_grupos:=v_grupos||jsonb_build_array(jsonb_build_object('alturaCm',v_g.altura_cm,'larguraCm',v_g.largura::text,'comprimentoFaixaCm',v_comprimento,'faixasPorRolo',v_faixas));
    end loop;
    -- div/mod são exatos: ceil(num/den) com divisão numeric poderia arredondar junto ao inteiro.
    v_quantidade:=div(v_num,v_den)+case when mod(v_num,v_den)>0 then 1 else 0 end;
  end if;
  if jsonb_array_length(v_pendencias)=0 then v_subtotal:=round(v_quantidade*v_i.preco*100); end if;
  return jsonb_build_object('itemId',v_i.id,'ordem',v_i.ordem,'tipo',v_i.tipo,'classificacao',v_i.classificacao,'referencia',coalesce(v_i.referencia,v_i.referencia_pf),'referenciaVersao',v_i.referencia_versao,'repeticaoM',v_i.repeticao_m::text,'produtoIdSgi',v_i.produto_id_sgi,'codigo',v_i.codigo,'unidade',case when v_i.tipo='PAPEL' then 'ROLO' else 'M2' end,'quantidade',v_quantidade::text,'preco',v_i.preco::text,'subtotalCentavos',v_subtotal::text,'precoValidadoEm',v_i.ultima_validacao_sgi,'versaoCalculo',1,'grupos',v_grupos,'pendencias',v_pendencias);
end $$;

create function public.cotar_pedido_personalizado_decorisi(p_pedido_id uuid,p_usuario_id uuid) returns jsonb language plpgsql stable security invoker set search_path=pg_catalog,public as $$
declare v_p public.pedidos_personalizados_pedidos%rowtype; v_itens jsonb; v_total numeric; v_completo boolean;
begin
  select p.* into v_p from public.pedidos_personalizados_pedidos p join public.pedidos_personalizados_fornecedores f on f.id=p.fornecedor_id and f.chave='decorisi' where p.id=p_pedido_id;
  if not found then raise exception 'PEDIDO_NAO_ENCONTRADO' using errcode='P0002'; end if;
  perform public.decorisi_exigir_escopo(p_usuario_id,v_p.unidade_id);
  select coalesce(jsonb_agg(public.calcular_item_decorisi(id) order by ordem),'[]') into v_itens from public.pedidos_personalizados_decorisi_itens where pedido_id=p_pedido_id;
  select jsonb_array_length(v_itens)>0 and coalesce(bool_and(jsonb_array_length(x->'pendencias')=0),false),sum((x->>'subtotalCentavos')::numeric) into v_completo,v_total from jsonb_array_elements(v_itens) x;
  return jsonb_build_object('pedidoId',v_p.id,'version',v_p.version,'completa',v_completo,'itens',v_itens,'totalCentavos',case when v_completo then v_total::text end);
end $$;

create function public.fechar_pedido_personalizado_decorisi(p_pedido_id uuid,p_usuario_id uuid,p_expected_version integer,p_numero_lancamento text,p_cotacao_confirmada jsonb) returns jsonb language plpgsql security invoker set search_path=pg_catalog,public as $$
declare v_p public.pedidos_personalizados_pedidos%rowtype; v_cotacao jsonb; v_item jsonb; v_evento uuid;
begin
  select p.* into v_p from public.pedidos_personalizados_pedidos p join public.pedidos_personalizados_fornecedores f on f.id=p.fornecedor_id and f.chave='decorisi' where p.id=p_pedido_id for update of p;
  if not found then raise exception 'PEDIDO_NAO_ENCONTRADO' using errcode='P0002'; end if;
  perform public.decorisi_exigir_escopo(p_usuario_id,v_p.unidade_id);
  if v_p.status='VENDA FECHADA' and v_p.version=p_expected_version+1 and v_p.numero_lancamento=p_numero_lancamento then
    v_cotacao:=public.cotar_pedido_personalizado_decorisi(p_pedido_id,p_usuario_id);
    if v_cotacao-'version' = p_cotacao_confirmada-'version' then return jsonb_build_object('pedidoId',p_pedido_id,'version',v_p.version,'reutilizado',true); end if;
  end if;
  if p_expected_version is null or v_p.version<>p_expected_version then raise exception 'CONFLITO_VERSAO' using errcode='P0003'; end if;
  if v_p.status<>'RASCUNHO' then raise exception 'COMPOSICAO_DECORISI_BLOQUEADA' using errcode='23514'; end if;
  if p_numero_lancamento is null or p_numero_lancamento !~ '^[0-9]{1,6}$' then raise exception 'NUMERO_LANCAMENTO_OBRIGATORIO' using errcode='22023'; end if;
  -- Ordem fixa de locks; nenhuma alteração de preço/referência entre cotação e snapshot.
  perform 1 from public.pedidos_personalizados_produtos where id in (select produto_id from public.pedidos_personalizados_decorisi_itens where pedido_id=p_pedido_id) order by id for share;
  perform 1 from public.sgi_produtos_cache where produto_id_sgi in (select p.produto_id_sgi from public.pedidos_personalizados_produtos p join public.pedidos_personalizados_decorisi_itens i on i.produto_id=p.id where i.pedido_id=p_pedido_id) order by produto_id_sgi for share;
  perform 1 from public.pedidos_personalizados_decorisi_referencias where id in (select referencia_db_id from public.pedidos_personalizados_decorisi_itens where pedido_id=p_pedido_id) order by id for share;
  v_cotacao:=public.cotar_pedido_personalizado_decorisi(p_pedido_id,p_usuario_id);
  if not (v_cotacao->>'completa')::boolean then return jsonb_build_object('ok',false,'erro','COTACAO_INCOMPLETA','cotacao',v_cotacao); end if;
  if p_cotacao_confirmada is distinct from v_cotacao then return jsonb_build_object('ok',false,'erro','COTACAO_ALTERADA','cotacao',v_cotacao); end if;
  for v_item in select value from jsonb_array_elements(v_cotacao->'itens') loop
    update public.pedidos_personalizados_decorisi_itens set snapshot_comercial=v_item,updated_by=p_usuario_id,updated_at=now() where id=(v_item->>'itemId')::uuid;
  end loop;
  update public.pedidos_personalizados_pedidos set status='VENDA FECHADA',numero_lancamento=p_numero_lancamento,version=version+1,updated_by=p_usuario_id where id=p_pedido_id;
  insert into public.pedidos_personalizados_status_historico(pedido_id,status_anterior,status_novo,usuario_id,unidade_id,version_anterior,version_nova) values(p_pedido_id,'RASCUNHO','VENDA FECHADA',p_usuario_id,v_p.unidade_id,v_p.version,v_p.version+1) returning id into v_evento;
  return jsonb_build_object('ok',true,'pedidoId',p_pedido_id,'version',v_p.version+1,'eventoId',v_evento,'reutilizado',false);
end $$;

-- A assinatura antiga de transição não é alterada. Esta proteção fecha o caminho
-- genérico que, sem a nova cotação, poderia aceitar RASCUNHO -> VENDA FECHADA.
create function public.decorisi_proteger_fechamento() returns trigger language plpgsql security invoker set search_path=pg_catalog,public as $$
begin
  if new.status='VENDA FECHADA' and old.status='RASCUNHO' and exists(select 1 from public.pedidos_personalizados_fornecedores where id=new.fornecedor_id and chave='decorisi') then
    if not exists(select 1 from public.pedidos_personalizados_decorisi_itens where pedido_id=new.id) or exists(select 1 from public.pedidos_personalizados_decorisi_itens where pedido_id=new.id and snapshot_comercial is null) then
      raise exception 'COTACAO_DECORISI_OBRIGATORIA' using errcode='23514';
    end if;
  end if;
  return new;
end $$;
create trigger decorisi_fechamento before update on public.pedidos_personalizados_pedidos for each row execute function public.decorisi_proteger_fechamento();

revoke all on function public.decorisi_exigir_escopo(uuid,uuid),public.decorisi_vincular_produtos_sgi(),public.decorisi_salvar_itens(uuid,uuid,jsonb),public.criar_pedido_personalizado_decorisi(uuid,uuid,uuid,text,text,text,jsonb),public.atualizar_pedido_personalizado_decorisi(uuid,uuid,integer,jsonb,jsonb),public.calcular_item_decorisi(uuid),public.cotar_pedido_personalizado_decorisi(uuid,uuid),public.fechar_pedido_personalizado_decorisi(uuid,uuid,integer,text,jsonb),public.decorisi_proteger_fechamento() from public,anon,authenticated;
grant execute on function public.decorisi_exigir_escopo(uuid,uuid),public.decorisi_vincular_produtos_sgi(),public.decorisi_salvar_itens(uuid,uuid,jsonb),public.criar_pedido_personalizado_decorisi(uuid,uuid,uuid,text,text,text,jsonb),public.atualizar_pedido_personalizado_decorisi(uuid,uuid,integer,jsonb,jsonb),public.calcular_item_decorisi(uuid),public.cotar_pedido_personalizado_decorisi(uuid,uuid),public.fechar_pedido_personalizado_decorisi(uuid,uuid,integer,text,jsonb),public.decorisi_proteger_fechamento() to service_role;

