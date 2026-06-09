# CONTEXTO DO PROJETO — LE BÉBÉ APP

## 1. Objetivo deste documento
Este documento serve como contexto base do projeto para futuras análises, decisões técnicas, sugestões e alterações de código.

A prioridade é:
- reduzir conclusões no chute
- preservar o comportamento atual
- evitar alterações fora do escopo
- forçar validação de banco antes de mudanças
- dar atenção especial ao módulo de recebimento

---

## 2. Visão geral do projeto

O projeto **Le Bébé App** é uma aplicação web fullstack usada para operações de uma loja de produtos infantis.

Existem **2 grandes frentes** no sistema:

### 2.1 Módulo principal
Focado em operação comercial e atendimento:
- dashboard de métricas
- agendamentos
- integração com Digisac
- chamados finalizados
- autenticação e controle de acesso

### 2.2 Módulo de recebimento Matic
Focado em conferência de mercadorias e controle operacional de recebimento:
- importação de NFes
- conferência de itens
- controle de volumes
- localização física no estoque
- divergências
- timer de conferência
- finalização do recebimento
- exportação para Google Sheets
- gestão de OS

Esse módulo é crítico e exige muito cuidado em qualquer alteração.

---

## 3. Stack do projeto

### 3.1 Core
- **Next.js 16.1.4**
- **React 19.2.3**
- **TypeScript 5**

### 3.2 UI / Frontend
- **TailwindCSS 4**
- **Radix UI**
- **Lucide React**
- **class-variance-authority**
- **clsx**
- **tailwind-merge**

### 3.3 Backend / Banco
- **Supabase**
  - Auth
  - PostgreSQL
  - RLS
  - Storage
- API Routes com Next.js

### 3.4 Integrações
- **Digisac API**
- **Google OAuth / Google Sheets**
- **Resend**
- **xml2js**
- **Upstash Redis** para rate limiting em partes do projeto

### 3.5 Utilitários
- **date-fns**
- **recharts**
- **sonner**
- **react-day-picker**

---

## 4. Estrutura geral do projeto

### 4.1 Pastas principais
- `src/app/` → rotas e páginas
- `src/app/api/` → backend/API routes
- `src/components/` → componentes reutilizáveis
- `src/lib/` → integrações, helpers e regras auxiliares
- `src/types/` → tipos
- `supabase/migrations/` → estrutura e evolução do banco

### 4.2 Organização importante
- O projeto usa App Router.
- O backend fica dentro do próprio Next.js.
- O Supabase é parte central da aplicação.
- O módulo de recebimento tem frontend, APIs e migrations próprias.

---

## 5. Módulos principais confirmados

### 5.1 Autenticação
- Login via Supabase Auth
- Middleware faz validações adicionais
- Existem restrições por role e por email
- Há auto-logout em parte do sistema

### 5.2 Dashboard
- Consulta dados agregados
- Exibe métricas, tabelas e gráficos

### 5.3 Agendamentos
- Integração com Digisac
- Criação e consulta de agendamentos
- Atualização por polling em alguns pontos

### 5.4 Chamados finalizados
- Módulo separado dentro da operação

### 5.5 Recebimento Matic
- Módulo operacional restrito
- Maior sensibilidade para alterações

---

## 6. Contexto importante do módulo de recebimento

## 6.1 Objetivo funcional
O módulo de recebimento serve para controlar a entrada de mercadorias no estoque.

Ele permite:
- importar NFes por XML ou por período
- criar recebimentos
- vincular notas
- conferir itens
- controlar volumes por item
- tratar OS separadamente
- registrar divergências
- definir localização final do item
- controlar timer da conferência
- finalizar recebimento
- exportar dados finais para Google Sheets
- salvar aprendizado de SKU/localização

---

## 6.2 Rotas / páginas principais do recebimento
Existe atenção especial porque em análises anteriores apareceu uso de `/recebimento` no singular.  
**Nunca assumir rota sem validar no código.**

Pontos principais já identificados:
- `src/app/recebimento/page.tsx`
- `src/app/recebimento/[id]/page.tsx`
- `src/app/recebimento/[id]/OSItemCard.tsx`

APIs relacionadas:
- `src/app/api/recebimento/route.ts`
- `src/app/api/recebimento/[id]/route.ts`
- `src/app/api/recebimento/[id]/finalizar/route.ts`
- `src/app/api/recebimento/[id]/cancelar/route.ts`
- `src/app/api/recebimento/[id]/timer/route.ts`
- `src/app/api/recebimento/[id]/check-inactivity/route.ts`
- `src/app/api/recebimento/[id]/item/[itemId]/route.ts`
- `src/app/api/recebimento/[id]/item/[itemId]/volume/[volumeNumero]/route.ts`
- `src/app/api/recebimento/[id]/os/[osNumero]/route.ts`
- `src/app/api/recebimento/[id]/recalcular/route.ts`
- `src/app/api/recebimento/importar-xml/route.ts`
- `src/app/api/recebimento/problemas-pendentes/route.ts`

---

## 6.3 Fluxo funcional resumido do recebimento

### Lista
- valida acesso
- carrega recebimentos
- filtra por data/NF
- exibe tabs
- permite criar recebimento
- permite importar NFe
- leva para conferência

### Conferência
- carrega recebimento e itens
- separa itens normais e OS
- mostra volumes previstos/recebidos
- permite registrar local
- permite registrar divergência
- controla timer
- faz polling
- permite finalizar
- permite cancelar

### Finalização
- valida recebimento aberto
- exige itens completos ou com divergência
- recalcula dados antes de fechar
- atualiza `matic_sku`
- envia dados para Google Sheets
- fecha recebimento
- opcionalmente registra problemas pendentes

---

## 6.4 Estrutura de dados relevante do recebimento
Principais entidades identificadas:

- `recebimentos`
- `recebimento_nfes`
- `recebimento_itens`
- `recebimento_item_volumes`
- `recebimento_os`
- `recebimento_problemas_pendentes`
- `nfe`
- `nfe_itens`
- `nfe_assistencias`
- `matic_sku`

### Observação crítica
Antes de qualquer mudança em banco, queries, joins, migrations, colunas, relações ou RLS:
**consultar obrigatoriamente o MCP do Supabase**.

---

## 6.5 Regras de negócio já levantadas para recebimento
Essas regras precisam ser tratadas como sensíveis e sempre revalidadas no código antes de alterar:

- whitelist rígida de acesso ao módulo
- controle de volumes por item
- separação entre item normal e item OS
- normalização de códigos de produto
- exigência de divergência para item incompleto
- timer com pausa automática por inatividade
- recálculo antes da finalização
- aprendizado de SKU/localização em `matic_sku`
- export para Google Sheets sem necessariamente bloquear finalização

---

## 6.6 Pontos frágeis já identificados no recebimento
Esses pontos merecem atenção sempre que forem mexidos:

- whitelist hardcoded
- risco de dessincronização de volumes
- estado local complexo na tela de conferência
- parser XML possivelmente frágil
- ausência de transações explícitas em fluxos multi-step
- timer baseado em polling
- risco de race condition em ações rápidas
- falha de exportação para Sheets não bloqueia finalização

---

## 7. Integrações importantes

### 7.1 Supabase
Usado para:
- autenticação
- banco PostgreSQL
- RLS
- base principal da aplicação

Clientes já esperados no projeto:
- browser client
- server client
- service role client

### 7.2 Digisac
Usado para:
- contatos
- departamentos
- usuários
- agendamentos
- chamados

### 7.3 Google Sheets
Usado principalmente no recebimento para exportação de dados finalizados.

### 7.4 Resend
Presente para emails transacionais.

---

## 8. Diretrizes obrigatórias para futuras análises e alterações

## 8.1 Regra geral
- Trabalhar somente no que foi pedido.
- Não fazer refactors paralelos.
- Não alterar comportamento fora do escopo.
- Não inventar estrutura, regra, fluxo, payload, arquivo ou integração.

## 8.2 Antes de alterar qualquer coisa
Sempre validar:
- arquivo principal envolvido
- componentes filhos
- hooks usados
- services usados
- API route / server action
- acesso ao banco
- impacto no retorno da UI
- impacto em permissão/autorização

## 8.3 Banco de dados
Se a tarefa envolver banco, é obrigatório:
- consultar o **MCP do Supabase**
- validar tabelas reais
- validar colunas reais
- validar tipos reais
- validar relacionamentos reais
- validar policies RLS
- validar constraints
- validar impacto em queries e UI

### Regra dura
Nunca assumir:
- nome de tabela
- nome de coluna
- tipo de coluna
- foreign key
- índice
- enum
- trigger
- função SQL
- view
- policy

Tudo isso deve ser validado no MCP.

## 8.4 Mudança mínima viável
- Sempre preferir a menor alteração possível.
- Preservar o comportamento atual no restante do fluxo.
- Não reorganizar código por estética sem pedido.

## 8.5 Tratamento de incerteza
Quando algo não puder ser confirmado:
- marcar explicitamente como **não confirmado no código**
- não tratar hipótese como fato

---

## 9. Regras específicas para o módulo de recebimento

### 9.1 Fluxo crítico
Tratar o recebimento como fluxo crítico de operação.

### 9.2 Antes de mexer em recebimento
Sempre mapear impacto em:
- listagem
- conferência
- OS
- divergências
- timer
- finalização
- `matic_sku`
- Google Sheets
- permissões
- APIs relacionadas

### 9.3 Não alterar no chute
Nunca alterar sem validação real:
- cálculo de volumes
- volumes por item
- total previsto / total recebido
- timer
- auto-pause
- divergência
- finalização
- lógica de OS
- aprendizado de SKU
- importação XML

### 9.4 Timer é sensível
Qualquer mudança no timer deve considerar:
- frontend
- backend
- persistência
- polling
- pausa por inatividade
- reload
- aba fechada
- retomada

### 9.5 Volumes são sensíveis
Qualquer mudança em volumes deve considerar:
- item normal
- item OS
- recálculo
- sincronização com banco
- atualização da UI
- impacto na finalização

### 9.6 Finalização é sensível
Qualquer mudança em finalização deve considerar:
- critérios de bloqueio
- status
- divergências
- atualização de `matic_sku`
- envio para planilha
- falhas de integração

---

## 10. Formato esperado de resposta técnica antes de editar
Antes de propor ou aplicar alterações, a análise deve ser organizada assim:

### 1. Entendimento do pedido
Resumo curto do que foi solicitado.

### 2. Arquivos realmente envolvidos
Listar apenas o que foi confirmado no código.

### 3. Diagnóstico confirmado
O que foi realmente validado.

### 4. Hipóteses / pontos não confirmados
Separar claramente.

### 5. Validação no MCP do Supabase
Quando houver banco envolvido, listar:
- tabelas validadas
- colunas validadas
- relações validadas
- constraints/policies relevantes

### 6. Plano mínimo de alteração
A menor mudança possível para resolver o pedido.

### 7. Impactos esperados
O que pode ser afetado.

### 8. O que não será alterado
Deixar claro o que permanece intacto.

---

## 11. Checklists obrigatórios

### 11.1 Checklist geral antes de editar
- [ ] Li os arquivos realmente envolvidos
- [ ] Confirmei o fluxo no código
- [ ] Não estou ampliando o escopo
- [ ] Vou fazer a menor alteração possível
- [ ] Não estou fazendo refactor paralelo
- [ ] Vou listar exatamente o que mudou

### 11.2 Checklist obrigatório de banco
- [ ] Consultei o MCP do Supabase
- [ ] Validei tabelas reais
- [ ] Validei colunas reais
- [ ] Validei relacionamentos reais
- [ ] Validei impacto em query e UI
- [ ] Validei impacto em auth/RLS, se aplicável

### 11.3 Checklist extra para recebimento
- [ ] Validei impacto em volumes
- [ ] Validei impacto em timer
- [ ] Validei impacto em OS
- [ ] Validei impacto em divergências
- [ ] Validei impacto em finalização
- [ ] Validei impacto em `matic_sku`
- [ ] Validei impacto em Google Sheets

---

## 12. Arquivos mais importantes para investigar primeiro
Esses são bons pontos de entrada para futuras análises:

1. `src/middleware.ts`
2. `src/app/recebimento/page.tsx`
3. `src/app/recebimento/[id]/page.tsx`
4. `src/app/api/recebimento/route.ts`
5. `src/app/api/recebimento/[id]/finalizar/route.ts`
6. `src/lib/recebimento/timer-activity.ts`
7. `src/lib/google/sheets-service.ts`
8. `src/lib/auth/matic-auth.ts`
9. `src/lib/auth/matic-emails.ts`
10. `supabase/migrations/009_recebimento_matic.sql`
11. `package.json`

---

## 13. Preferências do usuário para respostas técnicas
Ao responder sobre código e programação:
- usar linguagem mais simples e prática
- focar mais na lógica do que em termos complexos
- quando gerar código, organizar por sessões numeradas
- incluir logs para acompanhar execução
- seguir boas práticas
- usar nomes de funções em Português-BR quando fizer sentido
- avisar diretamente quando houver algo errado
- não inventar quando houver dúvida

---

## 14. Observação final
Este contexto serve como base inicial, mas **nenhuma análise futura deve tratar este documento como substituto da leitura real do código e da validação no MCP do Supabase**.

Ele existe para orientar melhor as decisões, não para autorizar conclusões no chute.