-- One transaction for both full-item confirmation and individual deltas.
-- SECURITY INVOKER deliberately preserves the existing Matic RLS policies.
create or replace function public.conferir_recebimento_item(
  p_recebimento_id uuid,
  p_item_id uuid,
  p_volume_numero integer default null,
  p_delta integer default null
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_status text;
  v_item public.recebimento_itens%rowtype;
  v_volume public.recebimento_item_volumes%rowtype;
  v_count integer;
  v_previsto bigint;
  v_recebido bigint;
  v_config_valida boolean;
  v_volumes jsonb;
begin
  if not coalesce(public.is_matic_user(), false) then
    raise sqlstate 'PT403' using message = 'Acesso negado';
  end if;
  if (p_volume_numero is null) <> (p_delta is null)
     or (p_delta is not null and (p_delta not in (-1, 1) or p_volume_numero < 1)) then
    raise sqlstate 'PT400' using message = 'Alteração inválida';
  end if;

  -- Lock order is always recebimento -> item -> volumes. Holding the parent
  -- lock also prevents closing/cancelling the receipt during this transaction.
  select r.status into v_status from public.recebimentos r
  where r.id = p_recebimento_id for update;
  if not found then
    raise sqlstate 'PT404' using message = 'Recebimento não encontrado';
  end if;
  if v_status <> 'aberto' then
    raise sqlstate 'PT409' using message = 'Recebimento não está aberto';
  end if;
  select i.* into v_item from public.recebimento_itens i
  where i.id = p_item_id and i.recebimento_id = p_recebimento_id for update;
  if not found then
    raise sqlstate 'PT404' using message = 'Produto não pertence ao recebimento';
  end if;

  perform 1 from public.recebimento_item_volumes v
  where v.recebimento_item_id = p_item_id order by v.volume_numero for update;

  if p_delta is null then
    select count(*), coalesce(sum(v.qtd_prevista), 0),
      coalesce(bool_and(
        v.volume_numero between 1 and v_item.volumes_por_item
        and v.qtd_prevista > 0
        and v.qtd_recebida between 0 and v.qtd_prevista
        and v.qtd_prevista::bigint * v_item.volumes_por_item = v_item.volumes_previstos_total
      ), false)
    into v_count, v_previsto, v_config_valida
    from public.recebimento_item_volumes v where v.recebimento_item_id = p_item_id;

    if v_item.volumes_por_item < 1 or v_item.volumes_previstos_total < 1
       or v_count <> v_item.volumes_por_item
       or v_previsto <> v_item.volumes_previstos_total or not v_config_valida then
      raise sqlstate 'PT422' using message = 'Configuração de volumes inconsistente';
    end if;
    update public.recebimento_item_volumes
    set qtd_recebida = qtd_prevista where recebimento_item_id = p_item_id;
  else
    select v.* into v_volume from public.recebimento_item_volumes v
    where v.recebimento_item_id = p_item_id and v.volume_numero = p_volume_numero;
    if not found then
      raise sqlstate 'PT404' using message = 'Volume não encontrado';
    end if;
    if v_volume.qtd_recebida::bigint + p_delta < 0
       or v_volume.qtd_recebida::bigint + p_delta > v_volume.qtd_prevista then
      raise sqlstate 'PT400' using message = 'Quantidade fora dos limites';
    end if;
    update public.recebimento_item_volumes
    set qtd_recebida = qtd_recebida + p_delta where id = v_volume.id;
  end if;

  select coalesce(sum(v.qtd_recebida), 0),
    coalesce(jsonb_agg(jsonb_build_object(
      'id', v.id, 'volume_numero', v.volume_numero,
      'qtd_prevista', v.qtd_prevista, 'qtd_recebida', v.qtd_recebida
    ) order by v.volume_numero), '[]'::jsonb)
  into v_recebido, v_volumes
  from public.recebimento_item_volumes v where v.recebimento_item_id = p_item_id;

  update public.recebimento_itens set volumes_recebidos_total = v_recebido
  where id = p_item_id and recebimento_id = p_recebimento_id;
  if not found then
    raise sqlstate 'PT403' using message = 'Atualização do produto não permitida';
  end if;

  return jsonb_build_object(
    'volumes', v_volumes,
    'item_total_recebido', v_recebido,
    'item_total_previsto', v_item.volumes_previstos_total,
    'item_status', case
      when v_recebido >= v_item.volumes_previstos_total and v_item.volumes_previstos_total > 0 then 'concluido'
      when v_recebido > 0 then 'parcial' else 'pendente' end
  );
end;
$$;

revoke all on function public.conferir_recebimento_item(uuid, uuid, integer, integer) from public, anon;
grant execute on function public.conferir_recebimento_item(uuid, uuid, integer, integer) to authenticated;
