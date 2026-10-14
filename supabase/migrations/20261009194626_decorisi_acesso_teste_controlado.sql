-- Acesso temporário e nominativo; fornecedor continua indisponível globalmente.
create table public.pedidos_personalizados_decorisi_testadores (
 usuario_id uuid primary key references public.usuarios_permitidos(id) on delete cascade,
 expira_em timestamptz not null,
 finalidade text not null check (char_length(finalidade) between 1 and 200)
);
alter table public.pedidos_personalizados_decorisi_testadores enable row level security;
revoke all on public.pedidos_personalizados_decorisi_testadores from public,anon,authenticated;
grant select,insert,update,delete on public.pedidos_personalizados_decorisi_testadores to service_role;

create function public.decorisi_fornecedor_para_usuario(p_usuario uuid) returns jsonb
language sql stable security invoker set search_path=pg_catalog,public as $$
 select jsonb_build_object('id',f.id)
 from public.pedidos_personalizados_fornecedores f
 where f.chave='decorisi'
 and exists(select 1 from public.usuarios_permitidos u where u.id=p_usuario and u.ativo)
 and (f.disponivel or exists(select 1 from public.pedidos_personalizados_decorisi_testadores t where t.usuario_id=p_usuario and t.expira_em>now()));
$$;
revoke all on function public.decorisi_fornecedor_para_usuario(uuid) from public,anon,authenticated;
grant execute on function public.decorisi_fornecedor_para_usuario(uuid) to service_role;

-- Altera somente o predicado de disponibilidade das três rotinas Decorisi.
-- Fail-closed se a definição aplicada divergir da versão revisada.
do $$
declare v_def text; v_novo text; v_assinatura text; v_antigo text; v_substituto text;
begin
 for v_assinatura,v_antigo,v_substituto in select * from (values
 ('public.criar_pedido_personalizado_decorisi(uuid,uuid,uuid,text,text,text,jsonb)',
  'where chave=''decorisi'' and disponivel;',
  'where chave=''decorisi'' and public.decorisi_fornecedor_para_usuario(p_usuario_id) is not null;'),
 ('public.decorisi_preparar_anexo(uuid,uuid,uuid,integer,jsonb)',
  'and f.disponivel where p.id=p_pedido',
  'and public.decorisi_fornecedor_para_usuario(p_usuario) is not null where p.id=p_pedido'),
 ('public.decorisi_remover_anexo(uuid,uuid,uuid,integer,uuid)',
  'and f.disponivel where p.id=p_pedido',
  'and public.decorisi_fornecedor_para_usuario(p_usuario) is not null where p.id=p_pedido')
 ) v(assinatura,antigo,substituto) loop
  select pg_get_functiondef(v_assinatura::regprocedure) into v_def;
  v_novo:=replace(v_def,v_antigo,v_substituto);
  if v_novo=v_def then raise exception 'DEFINICAO_DECORISI_DIVERGENTE: %',v_assinatura; end if;
  execute v_novo;
 end loop;
end $$;
