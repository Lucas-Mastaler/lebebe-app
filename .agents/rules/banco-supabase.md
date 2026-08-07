# Banco de dados / Supabase

## Gatilho

Carregue esta regra sempre que a tarefa tocar: schema, tabela, coluna, tipo,
enum, migration, foreign key, join, view, índice, trigger, função SQL,
constraint, RLS, policy, persistência (insert/update/delete/select) ou
qualquer comportamento que dependa do estado real do banco.

Não é preciso carregá-la para uma alteração puramente de UI/texto que não
toca query, tipo gerado a partir do banco ou chamada ao Supabase.

## Regra central

Nunca assuma estrutura do banco a partir do código, de uma migration antiga
ou de memória de tarefa anterior. Valide o estado real via MCP do Supabase
antes de alterar ou de concluir qualquer coisa sobre o schema.

Nunca assumir sem validar no MCP:
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

## Antes de alterar query, migration ou persistência

Validar no MCP:
- tabelas e colunas reais envolvidas, com tipos reais
- relacionamentos, constraints e índices
- policies RLS aplicáveis
- se o retorno continua compatível com a UI e os types consumidos

Para insert/update/delete/select/join/filtro: confirmar que os campos usados
existem de fato e que o impacto em RLS/permissões foi considerado.

## Mudanças destrutivas

Nunca propor ou aplicar sem avisar claramente: drop, rename, alteração de
tipo, quebra de compatibilidade, remoção de coluna/tabela, alteração de
constraint ou de policy.

## Divergência entre código e banco

Não escolher um lado no chute. Apontar a divergência, mostrar o que foi
confirmado no MCP e o que foi confirmado no código, e propor a correção mais
conservadora.

## Se o MCP não estiver disponível

Não tratar estrutura de banco como fato. Marcar a validação como pendente e
informar exatamente o que precisa ser verificado antes de prosseguir com
qualquer alteração que dependa dela.

## Skill oficial

Ao operar o MCP do Supabase (migrations, queries, advisors, performance),
use a skill oficial `supabase` (`.agents/skills/supabase/SKILL.md`) para o
procedimento técnico, e `supabase-postgres-best-practices` quando a tarefa
envolver otimização de query, índice, lock ou schema. Esta regra não repete
o conteúdo técnico dessas skills — ela define apenas a exigência de negócio
do projeto (validar antes de assumir).

## Proporcionalidade

Uma leitura pontual em tabela já conhecida (gatilho de risco contido, ver
`AGENTS.md` §4) ainda exige validar a estrutura real no MCP, mas não eleva
sozinha a tarefa inteira a crítica. Schema, migration ou RLS sempre elevam a
tarefa a crítica — investigação completa conforme `AGENTS.md` §5.
