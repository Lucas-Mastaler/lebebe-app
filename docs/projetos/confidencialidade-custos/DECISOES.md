# Decisões — Confidencialidade de custos

## D-001 — Dois perfis não veem custo interno

- Data: 2026-10-26
- Decisão: `consultora` e `supervisora_loja` não visualizam nem recebem custo interno. Os demais perfis e o superadmin permanecem autorizados. Preço de venda, desconto, frete cobrado e total do pedido não entram nessa restrição.
- Motivo/contexto: pedido explícito da auditoria. As chaves foram confirmadas em `app_perfis_acesso`.
- Impacto: regra permanente em `.agents/rules/confidencialidade-custos.md`. A Fase 2 aplica essa decisão na API e na Gestão de Pedidos Personalizados.
- Status: APROVADA

## D-002 — Corrigir na API, sem migration

- Data: 2026-10-26
- Decisão proposta: omitir os campos na serialização e na consulta da API de Pedidos Personalizados, que usa service role. Não alterar RLS nem colunas. A tela só deixa de renderizar o que a API já não envia.
- Motivo/contexto: as tabelas de pedidos já têm RLS sem policy e sem grant para `anon`/`authenticated`. O vazamento atual passa pela API, que contorna a RLS com service role.
- Impacto: Fase 2 do `PLANO.md`. Autorizada e implementada em 2026-10-26. Sem migration, sem alteração de RLS e sem mudança nos valores armazenados.
- Status: APROVADA

## D-003 — Falha de autorização omite o custo

- Data: 2026-10-26
- Decisão: perfil ausente, inativo, inválido ou consulta de perfil com erro não libera custo. Superadmin continua autorizado por `acessoTotal`, mesmo com perfil nulo. A interface também esconde o custo enquanto `usePermissoes` carrega ou falha.
- Motivo/contexto: pedido explícito da Fase 2. A autorização vem do servidor, não de um perfil enviado pelo navegador.
- Impacto: `podeVerCustoInterno` só é verdadeiro para superadmin ou para um perfil identificado fora de `consultora` e `supervisora_loja`.
- Status: APROVADA
