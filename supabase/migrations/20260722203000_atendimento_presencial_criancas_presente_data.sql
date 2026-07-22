alter table public.atendimento_presencial_criancas
  drop constraint if exists atendimento_presencial_criancas_condicional_check;

alter table public.atendimento_presencial_criancas
  add constraint atendimento_presencial_criancas_condicional_check
  check (
    (situacao = 'gestacao' and idade_unidade is null and idade_valor is null)
    or (situacao = 'ja_nasceu' and data_prevista_nascimento is null and idade_unidade is not null and idade_valor is not null)
    or (situacao = 'presente_outra_pessoa' and idade_unidade is null and idade_valor is null)
    or (situacao = 'nao_informado' and data_prevista_nascimento is null and idade_unidade is null and idade_valor is null)
  );
