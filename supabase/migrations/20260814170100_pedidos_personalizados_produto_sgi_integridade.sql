-- Impede conclusão ou avanço de etapa sem os identificadores mínimos
-- persistidos das mutações já realizadas no SGI.

alter table public.pedidos_personalizados_lebebe_exclusive_sgi
  add constraint pp_lex_sgi_custo_criado_check check (
    etapa not in ('CUSTO_CRIADO', 'CUSTO_FINALIZADO', 'PRECO_ATUALIZADO', 'CONCLUIDO')
    or (
      procedimento_custo_sgi is not null
      and numero_lancamento_entrada_sgi is not null
      and documento_entrada_id_sgi is not null
    )
  ),
  add constraint pp_lex_sgi_preco_atualizado_check check (
    etapa not in ('PRECO_ATUALIZADO', 'CONCLUIDO')
    or (
      tabela_preco_id_sgi = '3'
      and item_tabela_preco_id_sgi is not null
    )
  );
