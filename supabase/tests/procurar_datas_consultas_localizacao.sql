-- Executar em transação e reverter integralmente: não deixa consumo fictício.
begin;
do $$
declare
  mes_atual date := date_trunc('month',clock_timestamp() at time zone 'America/Sao_Paulo')::date;
  id_teste uuid;
begin
  insert into public.procurar_datas_localizacao_meses(mes,total) values(mes_atual,9899)
  on conflict(mes) do update set total=9899;
  id_teste := public.procurar_datas_reservar_consulta_localizacao('nominatim');
  if id_teste is null then raise exception 'Reserva 9900 não aceita'; end if;
  if public.procurar_datas_reservar_consulta_localizacao('nominatim') is not null then raise exception 'Excedeu limite'; end if;
  if (select total from public.procurar_datas_localizacao_meses where mes=mes_atual) <> 9900 then raise exception 'Contador incorreto'; end if;
  perform public.procurar_datas_concluir_consulta_localizacao(id_teste,false,429);
  perform public.procurar_datas_concluir_consulta_localizacao(id_teste,true,200);
  if (select estado from public.procurar_datas_localizacao_consultas where id=id_teste) <> 'falha' then raise exception 'Conclusão não idempotente'; end if;
  if date_trunc('month',timestamptz '2026-11-01 02:59:59+00' at time zone 'America/Sao_Paulo')::date <> date '2026-10-01' then raise exception 'Virada antecipada'; end if;
  if date_trunc('month',timestamptz '2026-11-01 03:00:00+00' at time zone 'America/Sao_Paulo')::date <> date '2026-11-01' then raise exception 'Virada atrasada'; end if;
  insert into public.procurar_datas_localizacao_meses(mes,total) values((mes_atual-interval '1 month')::date,9900)
  on conflict(mes) do update set total=9900;
  update public.procurar_datas_localizacao_meses set total=0 where mes=mes_atual;
  if public.procurar_datas_reservar_consulta_localizacao('google-maps-link') is null then raise exception 'Mês anterior bloqueou período atual'; end if;
  if has_function_privilege('anon','public.procurar_datas_reservar_consulta_localizacao(text)','execute') or
     has_function_privilege('authenticated','public.procurar_datas_reservar_consulta_localizacao(text)','execute') then raise exception 'Função exposta ao cliente'; end if;
end;
$$;
select 'limite, idempotencia, virada Sao Paulo, isolamento mensal e ACL aprovados' as resultado;
rollback;
