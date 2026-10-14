-- Cota operacional interna; não representa franquia de nenhum provedor.
create table public.procurar_datas_localizacao_meses (
  mes date primary key check (extract(day from mes) = 1),
  total integer not null default 0 check (total between 0 and 9900)
);
create table public.procurar_datas_localizacao_consultas (
  id uuid primary key default gen_random_uuid(),
  mes date not null references public.procurar_datas_localizacao_meses(mes),
  provedor text not null check (provedor in ('nominatim','google-maps-link','locationiq','google-geocoding','viacep','brasilapi','appsscript-endereco')),
  estado text not null default 'iniciada' check (estado in ('iniciada','sucesso','falha')),
  iniciada_em timestamptz not null default clock_timestamp(),
  concluida_em timestamptz,
  http_status integer
);
create index procurar_datas_localizacao_consultas_mes_idx on public.procurar_datas_localizacao_consultas(mes, provedor);
alter table public.procurar_datas_localizacao_meses enable row level security;
alter table public.procurar_datas_localizacao_consultas enable row level security;
revoke all on public.procurar_datas_localizacao_meses, public.procurar_datas_localizacao_consultas from public, anon, authenticated;
grant select, insert, update on public.procurar_datas_localizacao_meses, public.procurar_datas_localizacao_consultas to service_role;

create function public.procurar_datas_reservar_consulta_localizacao(p_provedor text)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  v_mes date := date_trunc('month', clock_timestamp() at time zone 'America/Sao_Paulo')::date;
  v_id uuid;
begin
  if p_provedor not in ('nominatim','google-maps-link','locationiq','google-geocoding','viacep','brasilapi','appsscript-endereco') then
    raise exception 'Provedor de localização inválido';
  end if;
  insert into public.procurar_datas_localizacao_meses(mes) values(v_mes) on conflict do nothing;
  -- UPDATE trava a mesma linha entre instâncias e reavalia o predicado após concorrência.
  update public.procurar_datas_localizacao_meses set total = total + 1 where mes = v_mes and total < 9900;
  if not found then return null; end if;
  insert into public.procurar_datas_localizacao_consultas(mes, provedor) values(v_mes, p_provedor) returning id into v_id;
  return v_id;
end;
$$;
create function public.procurar_datas_concluir_consulta_localizacao(p_id uuid, p_sucesso boolean, p_http_status integer default null)
returns void language sql security invoker set search_path = '' as $$
  update public.procurar_datas_localizacao_consultas
  set estado = case when p_sucesso then 'sucesso' else 'falha' end,
      concluida_em = clock_timestamp(), http_status = p_http_status
  where id = p_id and estado = 'iniciada';
$$;
create function public.procurar_datas_resumo_consultas_localizacao()
returns jsonb language sql stable security invoker set search_path = '' as $$
  with periodo as (
    select date_trunc('month', current_timestamp at time zone 'America/Sao_Paulo')::date as mes
  ), provedores as (
    select c.provedor, count(*) as total,
      count(*) filter(where estado = 'falha') as falhas,
      count(*) filter(where estado = 'iniciada') as pendentes
    from public.procurar_datas_localizacao_consultas c, periodo p where c.mes = p.mes group by c.provedor
  )
  select jsonb_build_object('mes',p.mes,'limite',9900,'total',coalesce(m.total,0),
    'restantes',9900-coalesce(m.total,0),'proximoReinicio',(p.mes+interval '1 month')::date,
    'provedores',coalesce((select jsonb_agg(to_jsonb(pr) order by pr.provedor) from provedores pr),'[]'::jsonb))
  from periodo p left join public.procurar_datas_localizacao_meses m on m.mes = p.mes;
$$;
revoke all on function public.procurar_datas_reservar_consulta_localizacao(text), public.procurar_datas_concluir_consulta_localizacao(uuid,boolean,integer), public.procurar_datas_resumo_consultas_localizacao() from public, anon, authenticated;
grant execute on function public.procurar_datas_reservar_consulta_localizacao(text), public.procurar_datas_concluir_consulta_localizacao(uuid,boolean,integer), public.procurar_datas_resumo_consultas_localizacao() to service_role;
