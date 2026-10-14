-- Fase 4: metadados Decorisi e compensação pela fila privada já existente.
alter table public.pedidos_personalizados_decorisi_anexos add column arquivo_sha256 text check (arquivo_sha256 ~ '^[a-f0-9]{64}$');

create function public.decorisi_enfileirar_anexo_removido() returns trigger language plpgsql security invoker set search_path=pg_catalog,public as $$
begin
  if TG_OP='DELETE' or old.path is distinct from new.path then
    insert into public.pedidos_personalizados_storage_pendencias(bucket_id,caminho_objeto,motivo)
    values(old.bucket,old.path,case when TG_OP='DELETE' then 'REMOCAO_ANEXO' else 'SUBSTITUICAO' end)
    on conflict(bucket_id,caminho_objeto) where processado_em is null do nothing;
  end if;
  return null;
end $$;
create trigger decorisi_limpar_anexo after update or delete on public.pedidos_personalizados_decorisi_anexos for each row execute function public.decorisi_enfileirar_anexo_removido();

-- Preparar primeiro garante compensação durável mesmo se o processo morrer após upload.
create function public.decorisi_preparar_anexo(p_pedido uuid,p_item uuid,p_usuario uuid,p_version integer,p_dados jsonb) returns jsonb language plpgsql security invoker set search_path=pg_catalog,public as $$
declare v_p public.pedidos_personalizados_pedidos%rowtype; v_a public.pedidos_personalizados_decorisi_anexos%rowtype; v_id uuid:=(p_dados->>'id')::uuid; v_path text:=p_dados->>'caminho_objeto'; v_ext text; v_prazo timestamptz;
begin
 select p.* into v_p from public.pedidos_personalizados_pedidos p join public.pedidos_personalizados_fornecedores f on f.id=p.fornecedor_id and f.chave='decorisi' and f.disponivel where p.id=p_pedido for update of p;
 if not found then raise exception 'PEDIDO_NAO_ENCONTRADO' using errcode='P0002'; end if;
 perform public.decorisi_exigir_escopo(p_usuario,v_p.unidade_id);
 if v_p.status<>'RASCUNHO' then raise exception 'COMPOSICAO_DECORISI_BLOQUEADA' using errcode='23514'; end if;
 if not exists(select 1 from public.pedidos_personalizados_decorisi_itens where id=p_item and pedido_id=p_pedido) then raise exception 'ITEM_DECORISI_INVALIDO' using errcode='22023'; end if;
 v_ext:=case p_dados->>'mime_type' when 'image/jpeg' then 'jpg' when 'image/png' then 'png' when 'image/webp' then 'webp' when 'application/pdf' then 'pdf' end;
 if v_id is null or v_ext is null or v_path is null or v_path !~ ('^'||p_pedido||'/'||p_item||'/'||v_id||'/[a-f0-9-]{36}\.'||v_ext||'$') or coalesce(p_dados->>'arquivo_sha256','') !~ '^[a-f0-9]{64}$' or coalesce((p_dados->>'slot')::int,0) not between 1 and 5 or coalesce((p_dados->>'tamanho_bytes')::bigint,0) not between 1 and 10485760 or length(coalesce(p_dados->>'nome_original','')) not between 1 and 255 or p_dados->>'nome_original' ~ '[/\\]' then raise exception 'ANEXO_DECORISI_INVALIDO' using errcode='22023'; end if;
 select * into v_a from public.pedidos_personalizados_decorisi_anexos where id=v_id;
 if found and (v_a.item_id<>p_item or v_a.slot<>(p_dados->>'slot')::int) then raise exception 'ANEXO_DECORISI_INVALIDO' using errcode='22023'; end if;
 if found and v_a.path=v_path then
   if v_a.arquivo_sha256 is distinct from p_dados->>'arquivo_sha256' or v_a.slot<>(p_dados->>'slot')::int or v_a.nome_original is distinct from p_dados->>'nome_original' or v_a.mime_type is distinct from p_dados->>'mime_type' or v_a.tamanho_bytes<>(p_dados->>'tamanho_bytes')::bigint then raise exception 'IDEMPOTENCY_PAYLOAD_DIVERGENTE' using errcode='22023'; end if;
   return jsonb_build_object('version',v_p.version,'reutilizado',true,'anexoId',v_id);
 end if;
 if p_version is null or v_p.version<>p_version then raise exception 'CONFLITO_VERSAO' using errcode='P0003'; end if;
 if (p_dados->>'substituir')::boolean is distinct from (v_a.id is not null) then raise exception 'ANEXO_DECORISI_INVALIDO' using errcode='22023'; end if;
 if exists(select 1 from public.pedidos_personalizados_decorisi_anexos where item_id=p_item and slot=(p_dados->>'slot')::int and id<>v_id) then raise exception 'SLOT_DECORISI_OCUPADO' using errcode='23514'; end if;
 insert into public.pedidos_personalizados_storage_pendencias(bucket_id,caminho_objeto,motivo,proxima_tentativa_em)
 values('pedidos-personalizados-anexos',v_path,'FALHA_APOS_UPLOAD',now()+interval '24 hours')
 on conflict(bucket_id,caminho_objeto) where processado_em is null do nothing;
 select proxima_tentativa_em into v_prazo from public.pedidos_personalizados_storage_pendencias where bucket_id='pedidos-personalizados-anexos' and caminho_objeto=v_path and processado_em is null for update;
 -- Uma reserva vencida pode estar com o consumidor; não ressuscitar esse objeto.
 if v_prazo is null or v_prazo<=now()+interval '5 minutes' then raise exception 'RESERVA_ANEXO_EXPIRADA' using errcode='23514'; end if;
 return jsonb_build_object('version',v_p.version,'reutilizado',false,'anexoId',v_id);
end $$;

create function public.decorisi_registrar_anexo(p_pedido uuid,p_item uuid,p_usuario uuid,p_version integer,p_dados jsonb) returns jsonb language plpgsql security invoker set search_path=pg_catalog,public as $$
declare v_resultado jsonb; v_version integer;
begin
 v_resultado:=public.decorisi_preparar_anexo(p_pedido,p_item,p_usuario,p_version,p_dados);
 if (v_resultado->>'reutilizado')::boolean then return v_resultado; end if;
 if (p_dados->>'substituir')::boolean then
  update public.pedidos_personalizados_decorisi_anexos set path=p_dados->>'caminho_objeto',nome_original=p_dados->>'nome_original',mime_type=p_dados->>'mime_type',tamanho_bytes=(p_dados->>'tamanho_bytes')::int,arquivo_sha256=p_dados->>'arquivo_sha256',updated_by=p_usuario,updated_at=now() where id=(p_dados->>'id')::uuid and item_id=p_item;
 else
 insert into public.pedidos_personalizados_decorisi_anexos(id,item_id,slot,bucket,path,nome_original,mime_type,tamanho_bytes,arquivo_sha256,created_by,updated_by)
 values((p_dados->>'id')::uuid,p_item,(p_dados->>'slot')::int,'pedidos-personalizados-anexos',p_dados->>'caminho_objeto',p_dados->>'nome_original',p_dados->>'mime_type',(p_dados->>'tamanho_bytes')::bigint,p_dados->>'arquivo_sha256',p_usuario,p_usuario);
 end if;
 update public.pedidos_personalizados_storage_pendencias set processado_em=now(),updated_at=now() where bucket_id='pedidos-personalizados-anexos' and caminho_objeto=p_dados->>'caminho_objeto' and processado_em is null;
 select version into v_version from public.pedidos_personalizados_pedidos where id=p_pedido;
 return jsonb_build_object('version',v_version,'anexoId',p_dados->>'id','reutilizado',false);
end $$;

create function public.decorisi_remover_anexo(p_pedido uuid,p_item uuid,p_usuario uuid,p_version integer,p_anexo uuid) returns jsonb language plpgsql security invoker set search_path=pg_catalog,public as $$
declare v_p public.pedidos_personalizados_pedidos%rowtype; v_version integer;
begin
 select p.* into v_p from public.pedidos_personalizados_pedidos p join public.pedidos_personalizados_fornecedores f on f.id=p.fornecedor_id and f.chave='decorisi' and f.disponivel where p.id=p_pedido for update of p;
 if not found then raise exception 'PEDIDO_NAO_ENCONTRADO' using errcode='P0002'; end if;
 perform public.decorisi_exigir_escopo(p_usuario,v_p.unidade_id);
 if v_p.status<>'RASCUNHO' then raise exception 'COMPOSICAO_DECORISI_BLOQUEADA' using errcode='23514'; end if;
 if not exists(select 1 from public.pedidos_personalizados_decorisi_itens where id=p_item and pedido_id=p_pedido) then raise exception 'ITEM_DECORISI_INVALIDO' using errcode='22023'; end if;
 if not exists(select 1 from public.pedidos_personalizados_decorisi_anexos where id=p_anexo and item_id=p_item) then return jsonb_build_object('version',v_p.version,'reutilizado',true); end if;
 if p_version is null or v_p.version<>p_version then raise exception 'CONFLITO_VERSAO' using errcode='P0003'; end if;
 delete from public.pedidos_personalizados_decorisi_anexos where id=p_anexo and item_id=p_item;
 select version into v_version from public.pedidos_personalizados_pedidos where id=p_pedido;
 return jsonb_build_object('version',v_version,'reutilizado',false);
end $$;

revoke all on function public.decorisi_enfileirar_anexo_removido(),public.decorisi_preparar_anexo(uuid,uuid,uuid,integer,jsonb),public.decorisi_registrar_anexo(uuid,uuid,uuid,integer,jsonb),public.decorisi_remover_anexo(uuid,uuid,uuid,integer,uuid) from public,anon,authenticated;
grant execute on function public.decorisi_enfileirar_anexo_removido(),public.decorisi_preparar_anexo(uuid,uuid,uuid,integer,jsonb),public.decorisi_registrar_anexo(uuid,uuid,uuid,integer,jsonb),public.decorisi_remover_anexo(uuid,uuid,uuid,integer,uuid) to service_role;
