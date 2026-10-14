-- Local somente. Não ativa o fornecedor, não carrega preços nem altera fornecedores existentes.
create table public.pedidos_personalizados_decorisi_referencias (
  id uuid primary key default gen_random_uuid(),
  fornecedor_id uuid not null references public.pedidos_personalizados_fornecedores(id) on delete restrict,
  referencia text not null check (referencia ~ '^DB[78](0[1-9]|[1-3][0-9]|4[0-5])$'),
  repeticao_m numeric not null check (repeticao_m >= 0 and repeticao_m < 1000 and repeticao_m * 100 = trunc(repeticao_m * 100)),
  ativo boolean not null default true,
  versao integer not null default 1 check (versao > 0),
  fonte text not null,
  fonte_sha256 text not null check (fonte_sha256 ~ '^[a-f0-9]{64}$'),
  extraido_em timestamptz not null,
  updated_at timestamptz not null default now(),
  unique (fornecedor_id, referencia)
);

create table public.pedidos_personalizados_decorisi_itens (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references public.pedidos_personalizados_pedidos(id) on delete cascade,
  ordem integer not null check (ordem between 1 and 10),
  tipo text not null check (tipo in ('PAPEL','PAINEL')),
  classificacao text not null check (classificacao in ('CATALOGO','PERSONALIZADO')),
  produto_id uuid not null references public.pedidos_personalizados_produtos(id) on delete restrict,
  referencia_db_id uuid references public.pedidos_personalizados_decorisi_referencias(id) on delete restrict,
  referencia_pf text check (referencia_pf ~ '^PF2([0-7][0-9]|80)$'),
  descricao text check (char_length(descricao) between 1 and 500),
  observacoes text check (char_length(observacoes) between 1 and 500),
  layout_alteracoes integer not null default 0 check (layout_alteracoes >= 0),
  snapshot_comercial jsonb,
  created_by uuid not null references public.usuarios_permitidos(id) on delete restrict,
  updated_by uuid not null references public.usuarios_permitidos(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (pedido_id, ordem) deferrable initially deferred,
  check ((tipo = 'PAPEL' and referencia_pf is null) or (tipo = 'PAINEL' and referencia_db_id is null))
);
create index decorisi_itens_produto_idx on public.pedidos_personalizados_decorisi_itens(produto_id);
create index decorisi_itens_referencia_idx on public.pedidos_personalizados_decorisi_itens(referencia_db_id);
create unique index decorisi_catalogo_db_unico on public.pedidos_personalizados_decorisi_itens(pedido_id, referencia_db_id) where classificacao='CATALOGO' and tipo='PAPEL';
create unique index decorisi_catalogo_pf_unico on public.pedidos_personalizados_decorisi_itens(pedido_id, referencia_pf) where classificacao='CATALOGO' and tipo='PAINEL';

create table public.pedidos_personalizados_decorisi_medidas (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.pedidos_personalizados_decorisi_itens(id) on delete cascade,
  ordem integer not null check (ordem between 1 and 20),
  ambiente text check (char_length(ambiente) between 1 and 80),
  largura_cm integer check (largura_cm > 0),
  altura_cm integer check (altura_cm > 0),
  unique (item_id, ordem) deferrable initially deferred
);
create table public.pedidos_personalizados_decorisi_anexos (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.pedidos_personalizados_decorisi_itens(id) on delete restrict,
  slot integer not null check (slot between 1 and 5),
  bucket text not null check (bucket = 'pedidos-personalizados-anexos'),
  path text not null unique check (path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|jpeg|png|webp|pdf)$'),
  nome_original text not null check (char_length(nome_original) between 1 and 255),
  mime_type text not null check (mime_type in ('image/jpeg','image/png','image/webp','application/pdf')),
  tamanho_bytes integer not null check (tamanho_bytes between 1 and 10485760),
  created_by uuid not null references public.usuarios_permitidos(id) on delete restrict,
  updated_by uuid not null references public.usuarios_permitidos(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (item_id, slot)
);

alter table public.pedidos_personalizados_pedidos add column decorisi_criacao_hash text;

-- Segurança segue o contrato do módulo: somente backend com service_role.
alter table public.pedidos_personalizados_decorisi_referencias enable row level security;
alter table public.pedidos_personalizados_decorisi_itens enable row level security;
alter table public.pedidos_personalizados_decorisi_medidas enable row level security;
alter table public.pedidos_personalizados_decorisi_anexos enable row level security;
revoke all on public.pedidos_personalizados_decorisi_referencias, public.pedidos_personalizados_decorisi_itens, public.pedidos_personalizados_decorisi_medidas, public.pedidos_personalizados_decorisi_anexos from public, anon, authenticated;
grant select, insert, update, delete on public.pedidos_personalizados_decorisi_referencias, public.pedidos_personalizados_decorisi_itens, public.pedidos_personalizados_decorisi_medidas, public.pedidos_personalizados_decorisi_anexos to service_role;

-- Cadastra as quatro opções locais sem inventar cache/preço. Os vínculos SGI serão
-- preenchidos por rotina explícita apenas depois do onboarding do cache existente.
insert into public.pedidos_personalizados_produtos(fornecedor_id,codigo,descricao,ordem)
select f.id, v.codigo, v.descricao, v.ordem
from public.pedidos_personalizados_fornecedores f
cross join (values ('19075','Papel de catálogo',1),('19076','Papel personalizado',2),('19077','Painel Fofura',3),('19078','Painel personalizado',4)) v(codigo,descricao,ordem)
where f.chave='decorisi';

create function public.decorisi_validar_relacao_item() returns trigger language plpgsql security invoker set search_path=pg_catalog,public as $$
declare v_fornecedor uuid; v_codigo text;
begin
  select p.fornecedor_id into v_fornecedor from public.pedidos_personalizados_pedidos p
  join public.pedidos_personalizados_fornecedores f on f.id=p.fornecedor_id and f.chave='decorisi'
  where p.id=new.pedido_id;
  v_codigo := case when new.tipo='PAPEL' then case when new.classificacao='CATALOGO' then '19075' else '19076' end else case when new.classificacao='CATALOGO' then '19077' else '19078' end end;
  if v_fornecedor is null or not exists(select 1 from public.pedidos_personalizados_produtos where id=new.produto_id and fornecedor_id=v_fornecedor and codigo=v_codigo and ativo) then
    raise exception 'PRODUTO_DECORISI_INVALIDO' using errcode='23514';
  end if;
  if new.referencia_db_id is not null and not exists(select 1 from public.pedidos_personalizados_decorisi_referencias where id=new.referencia_db_id and fornecedor_id=v_fornecedor and ativo) then
    raise exception 'REFERENCIA_DECORISI_INVALIDA' using errcode='23514';
  end if;
  return new;
end $$;
create trigger decorisi_item_relacoes before insert or update on public.pedidos_personalizados_decorisi_itens for each row execute function public.decorisi_validar_relacao_item();

create function public.decorisi_proteger_composicao() returns trigger language plpgsql security invoker set search_path=pg_catalog,public as $$
declare v_pedido uuid; v_status text;
begin
  if tg_table_name='pedidos_personalizados_decorisi_medidas' then
    select pedido_id into v_pedido from public.pedidos_personalizados_decorisi_itens where id=case when tg_op='DELETE' then old.item_id else new.item_id end;
    -- No cascade da remoção de item, o trigger do item já validou e travou
    -- o cabeçalho em RASCUNHO; a linha do item já não está visível aqui.
    if tg_op='DELETE' and v_pedido is null then return old; end if;
  else v_pedido:=case when tg_op='DELETE' then old.pedido_id else new.pedido_id end;
  end if;
  select status into v_status from public.pedidos_personalizados_pedidos where id=v_pedido for update;
  if v_status is distinct from 'RASCUNHO' then raise exception 'COMPOSICAO_DECORISI_BLOQUEADA' using errcode='23514'; end if;
  if tg_op='UPDATE' then
    if tg_table_name='pedidos_personalizados_decorisi_itens' then
      if old.pedido_id<>new.pedido_id or old.snapshot_comercial is not null and new.snapshot_comercial is distinct from old.snapshot_comercial then
        raise exception 'SNAPSHOT_DECORISI_IMUTAVEL' using errcode='23514';
      end if;
    elsif old.item_id<>new.item_id then
      raise exception 'ITEM_DECORISI_INVALIDO' using errcode='23514';
    end if;
  end if;
  if tg_op='DELETE' then return old; end if; return new;
end $$;
create trigger decorisi_item_composicao before insert or update or delete on public.pedidos_personalizados_decorisi_itens for each row execute function public.decorisi_proteger_composicao();
create trigger decorisi_medida_composicao before insert or update or delete on public.pedidos_personalizados_decorisi_medidas for each row execute function public.decorisi_proteger_composicao();
revoke all on function public.decorisi_validar_relacao_item(), public.decorisi_proteger_composicao() from public, anon, authenticated;
grant execute on function public.decorisi_validar_relacao_item(), public.decorisi_proteger_composicao() to service_role;

create function public.decorisi_proteger_anexo() returns trigger language plpgsql security invoker set search_path=pg_catalog,public as $$
declare v_i public.pedidos_personalizados_decorisi_itens%rowtype; v_p public.pedidos_personalizados_pedidos%rowtype; v_id uuid; v_path text;
begin
  v_id:=case when tg_op='DELETE' then old.item_id else new.item_id end;
  select * into v_i from public.pedidos_personalizados_decorisi_itens where id=v_id;
  select * into v_p from public.pedidos_personalizados_pedidos where id=v_i.pedido_id for update;
  if v_p.status='CANCELADO' or v_p.status in ('EM PRODUÇÃO','RECEBIDO') and tg_op<>'INSERT' then raise exception 'ANEXO_DECORISI_BLOQUEADO' using errcode='23514'; end if;
  if tg_op='UPDATE' and old.item_id<>new.item_id then raise exception 'ITEM_DECORISI_INVALIDO' using errcode='23514'; end if;
  if tg_op='DELETE' and v_p.status<>'RASCUNHO' and v_i.classificacao='PERSONALIZADO' and (select count(*) from public.pedidos_personalizados_decorisi_anexos where item_id=v_id)<=1 then raise exception 'ANEXO_PERSONALIZACAO_OBRIGATORIO' using errcode='23514'; end if;
  if tg_op<>'DELETE' then
    v_path:=new.path;
    if split_part(v_path,'/',1)<>v_p.id::text or split_part(v_path,'/',2)<>v_i.id::text or split_part(v_path,'/',3)<>new.id::text
      or new.mime_type='image/jpeg' and v_path !~ '\.jpg$' or new.mime_type='image/png' and v_path !~ '\.png$' or new.mime_type='image/webp' and v_path !~ '\.webp$' or new.mime_type='application/pdf' and v_path !~ '\.pdf$' then raise exception 'CAMINHO_ANEXO_INVALIDO' using errcode='23514'; end if;
  end if;
  -- Cada mutação de metadados invalida cotações concorrentes, com lock do cabeçalho.
  update public.pedidos_personalizados_pedidos set version=version+1,updated_at=now() where id=v_p.id;
  if tg_op='DELETE' then return old; end if; return new;
end $$;
create trigger decorisi_anexo_protecao before insert or update or delete on public.pedidos_personalizados_decorisi_anexos for each row execute function public.decorisi_proteger_anexo();
revoke all on function public.decorisi_proteger_anexo() from public,anon,authenticated;
grant execute on function public.decorisi_proteger_anexo() to service_role;
