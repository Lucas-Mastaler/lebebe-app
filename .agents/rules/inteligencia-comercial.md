# Inteligência Comercial

## Gatilho

Carregue esta regra para qualquer tarefa que toque indicadores, dashboards
ou cálculos de Inteligência Comercial.

## Fonte operacional primária

O SGI é a fonte operacional primária para auditoria dos dados.

## Ordem de investigação em caso de divergência

Quando houver divergência de números, investigue nesta ordem antes de
concluir onde está o erro:
1. relatório original no SGI
2. HTML bruto capturado
3. parser
4. JSON processado
5. importador
6. Supabase
7. API do aplicativo
8. cálculo e exibição no frontend

## Regra de exclusão

O bloco sem cliente deve ser ignorado integralmente nos cálculos, salvo
decisão explícita do usuário que altere essa regra.

## Antes de alterar qualquer indicador

Validar: filtros, status, operações, devoluções, pagamentos, crédito de
troca, pendência, frete, descontos, ticket médio e a exclusão de registros
sem cliente.
