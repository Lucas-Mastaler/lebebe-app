# Módulo de Recebimento

## Gatilho

Carregue esta regra para qualquer alteração que toque: listagem, conferência,
itens, volumes, OS, divergências, timer, recálculo, finalização, cancelamento,
`matic_sku`, exportação para Google Sheets, importação de XML/NFe ou
permissões do módulo de Recebimento.

Pertencer à pasta do módulo não torna toda alteração crítica: trocar o texto
de um botão ou ajustar um label na tela de Recebimento é tarefa pequena e não
exige a checklist completa abaixo — mas confirme que a mudança realmente não
toca cálculo, regra de negócio ou fluxo de dados antes de tratá-la como
simples (`AGENTS.md` §4).

## Pontos de entrada para investigação

Lista **não exaustiva**, só para começar a navegar — não é inventário
completo de arquivos/APIs do módulo, e o código real sempre vence se
divergir dela (`AGENTS.md` §1). Existência confirmada contra o código em
2026-08-10 (Fase C1, absorvido de `CONTEXTO DO PROJETO.MD` §6.2/§6.4, hoje
congelado) — pode ficar desatualizada com o tempo; prefira sempre
`Glob`/`Grep` para o estado real.

Páginas:
- Listagem — `src/app/recebimento/page.tsx`
- Conferência — `src/app/recebimento/[id]/page.tsx`
- Card de item OS — `src/app/recebimento/[id]/OSItemCard.tsx`

APIs:
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

Helpers/autenticação do módulo:
- `src/middleware.ts`
- `src/lib/recebimento/timer-activity.ts`
- `src/lib/google/sheets-service.ts`
- `src/lib/auth/matic-auth.ts` / `src/lib/auth/matic-emails.ts` — whitelist
  de acesso ao módulo

Entidades (nomes confirmados nas migrations em 2026-08-10 — schema completo,
colunas e relações sempre via MCP, conforme `.agents/rules/banco-supabase.md`):
`recebimentos`, `recebimento_nfes`, `recebimento_itens`,
`recebimento_item_volumes`, `recebimento_os`,
`recebimento_problemas_pendentes`, `nfe`, `nfe_itens`, `nfe_assistencias`,
`matic_sku`.

## Pontos frágeis conhecidos

Herdado de `CONTEXTO DO PROJETO.MD` §6.6 (hoje congelado) — merecem atenção
extra sempre que forem mexidos, mas devem ser revalidados no código antes de
qualquer decisão, não tratados como fato permanente:
- whitelist de acesso hardcoded (`matic-emails.ts`)
- risco de dessincronização de volumes
- estado local complexo na tela de conferência
- parser de XML/NFe possivelmente frágil
- ausência de transações explícitas em fluxos multi-step
- timer baseado em polling
- risco de race condition em ações rápidas
- falha de exportação para Google Sheets não bloqueia finalização

## Persistência

O módulo envolve persistência de recebimento, itens, volumes, OS, NFe,
problemas/divergências e aprendizado de SKU/localização. Não trate esta
regra como fonte de verdade de schema: nome real de tabela, coluna, relação
ou constraint deve ser descoberto no código e validado conforme
`.agents/rules/banco-supabase.md` antes de qualquer alteração.

## Regra de negócio sensível — não alterar no chute

Sem validação real no código (e no MCP quando envolver banco):
- cálculo de volumes, volumes por item, total previsto vs. total recebido
- diferença entre item normal e item OS
- exigência de divergência para item incompleto
- timer (pausa automática por inatividade, retomada, persistência)
- recálculo antes da finalização
- critérios que bloqueiam finalização e atualização de status
- aprendizado de SKU/localização em `matic_sku`
- normalização de código de produto
- parser de XML/NFe (formato, campos extraídos, persistência de NFe/itens/OS)
- envio para Google Sheets e comportamento quando a exportação falha

## Timer — sensível

Validar frontend e backend juntos: pausa/retomada, persistência do tempo
total, impacto de polling/inatividade. Nunca mudar sem mapear os cenários de
aba fechada, reload, inatividade e atualização manual.

## Volumes — sensíveis

Validar o cálculo atual no código, a estrutura no banco via MCP, a
atualização por item e por volume, e o recálculo antes de finalizar.

## Finalização — sensível

Validar o que impede finalizar, a atualização de status, a gravação de
divergências, a atualização em `matic_sku`, o envio para Google Sheets e o
comportamento quando essa exportação falha (hoje não bloqueia finalização —
confirmar no código antes de mudar esse comportamento).

## Investigação proporcional

- **Tarefa pequena e localizada** (texto, label, ajuste visual sem mudança
  funcional): confirme primeiro que a mudança realmente não toca fluxo,
  cálculo, persistência ou regra de negócio. Depois, investigue somente o
  arquivo e as dependências imediatas necessárias. Não revise
  automaticamente timer, volumes, finalização, Sheets, OS etc.
- **Tarefa média:** investigue o fluxo diretamente afetado e as dependências
  reais chamadas por ele.
- **Tarefa crítica** — toca volumes, timer, finalização, OS, divergências,
  persistência sensível, parser/importação ou outra regra listada em
  "Regra de negócio sensível": mapeie o fluxo completo relevante e suas
  dependências cruzadas antes de alterar.

Amplie a investigação além do nível inicial só quando houver evidência
concreta de impacto adicional (`AGENTS.md` §5) — não por precaução genérica.

## Cruzamento com outras regras

- Banco/queries/migration/RLS no módulo: seguir `.agents/rules/banco-supabase.md`.
- Nova tela ou sub-rota dentro de Recebimento: seguir
  `.agents/rules/novas-telas-permissoes.md`.
