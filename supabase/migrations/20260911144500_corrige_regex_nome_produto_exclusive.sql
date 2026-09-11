-- A primeira migration serializou barras invertidas em excesso no padrão
-- PostgreSQL. O padrão abaixo aceita os dois nomes válidos do fluxo:
-- inicial (filial + cliente) e final (filial + lançamento + cliente).
alter table public.pedidos_personalizados_lebebe_exclusive_sgi
  drop constraint pp_lex_sgi_nome_check,
  add constraint pp_lex_sgi_nome_check check (
    nome_produto_sgi = btrim(nome_produto_sgi)
    and char_length(nome_produto_sgi) <= 120
    and nome_produto_sgi ~ '^LEBEBE EXCLUSIVE \(.+\)$'
  );
