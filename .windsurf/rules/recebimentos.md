---
trigger: always_on
---
# RULES ESPECÍFICAS - MÓDULO DE RECEBIMENTO

## 1. Fluxo crítico
Trate o módulo de recebimento como fluxo crítico de operação.
Qualquer mudança deve priorizar:
- estabilidade
- rastreabilidade
- integridade dos dados
- manutenção do comportamento atual

## 2. Antes de mexer em recebimento
Sempre mapear o fluxo completo:
- tela de listagem
- tela de conferência
- modal envolvido
- endpoint chamado
- atualização no banco
- retorno para a UI
- impacto em timer
- impacto em finalização
- impacto em exportação para Google Sheets

## 3. Não alterar regra de conferência no chute
Não alterar sem validação real:
- cálculo de volumes
- volumes por item
- total previsto / total recebido
- item normal vs item OS
- divergência
- finalização
- recálculo
- timer
- auto-pause
- aprendizado do SKU

## 4. Sempre verificar dependências cruzadas
Ao mexer em qualquer parte do recebimento, verificar impacto em:
- listagem
- conferência por item
- conferência de OS
- divergências
- finalização
- Google Sheets
- matic_sku
- permissões/whitelist
- APIs relacionadas

## 5. Não alterar lógica de negócio misturada em UI sem mapear antes
Como esse módulo parece concentrar muita lógica em páginas e rotas:
- não mover regra de lugar sem confirmar todo o encadeamento
- não simplificar fluxo sem verificar efeitos colaterais
- não separar componente só por estética sem necessidade real

## 6. Timer é sensível
Ao mexer no timer:
- validar frontend e backend juntos
- validar regra de pausa/retomada
- validar persistência de tempo total
- validar impacto de polling/inatividade
- nunca mudar sem mapear cenário de aba fechada, reload, inatividade e atualização manual

## 7. Volumes são sensíveis
Ao mexer em volumes:
- validar cálculo atual no código
- validar estrutura no banco via MCP
- validar atualização por item e por volume
- validar recálculo antes de finalizar
- validar diferença entre item normal e OS

## 8. Finalização é sensível
Ao mexer em finalização:
- validar critérios que impedem finalizar
- validar atualização de status
- validar gravação de divergências
- validar atualização em matic_sku
- validar envio para Google Sheets
- validar o que acontece quando a exportação falha

## 9. XML e importação
Ao mexer em importação de NFe:
- não assumir formato do XML
- validar parser real usado
- validar campos extraídos
- validar persistência de NFe, itens e assistências/OS
- deixar explícito o que é limitação do parser atual e o que foi realmente confirmado no código

## 10. Permissões
Não alterar autorização do módulo de recebimento sem validar:
- middleware
- whitelist/email permitido
- validação server-side
- RLS do Supabase
- impacto em usuários já existentes