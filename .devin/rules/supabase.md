---
trigger: always_on
---
# REGRA OBRIGATÓRIA - SUPABASE / BANCO DE DADOS

## 1. Validação obrigatória no MCP
Sempre que a tarefa envolver banco de dados, você DEVE consultar o MCP do Supabase antes de propor ou aplicar mudanças.

## 2. Nunca assumir estrutura
Nunca assuma:
- nome de tabela
- nome de coluna
- tipo de coluna
- foreign key
- índice
- enum
- view
- trigger
- função SQL
- policy RLS
- relacionamento entre tabelas

Tudo isso deve ser validado no MCP do Supabase e no código que consome esses dados.

## 3. Antes de alterar query ou migration
Validar no MCP:
- tabelas reais envolvidas
- colunas reais existentes
- tipos reais
- relacionamentos reais
- constraints
- índices
- policies RLS
- dados esperados pelo frontend/backend

## 4. Antes de alterar persistência
Para qualquer insert, update, delete, select, join ou filtro:
- validar se os campos existem de fato
- validar se o retorno continua compatível com a UI e os types
- validar impacto em RLS e permissões

## 5. Mudanças destrutivas
Nunca propor ou aplicar mudança destrutiva sem avisar claramente:
- drop
- rename
- alteração de tipo
- quebra de compatibilidade
- remoção de coluna
- remoção de tabela
- alteração de constraint
- alteração de policy

## 6. Divergência entre código e banco
Se o código e o banco divergirem:
- não escolher um lado no chute
- apontar claramente a divergência
- mostrar qual parte foi confirmada no MCP
- mostrar qual parte foi confirmada no código
- propor correção conservadora

## 7. Se não consultou o MCP, não conclua
Se você não conseguiu validar no MCP do Supabase, não trate estrutura de banco como fato.

## 8. Usar skill do Supabase
Sempre que utilizar o MCP do Supabase, você DEVE invocar a skill do Supabase para obter instruções específicas e melhores práticas. Use o comando `skill` com o parâmetro `SkillName: "supabase"` antes de realizar qualquer operação com o Supabase.