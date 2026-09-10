---
name: autenticacao-tecnica-agentes
description: "Use quando uma tarefa exigir validação visual, browser test/E2E, screenshot, rota protegida ou teste autenticado no Preview do Le Bébé App. Ensina o acesso técnico sem login Google e sem alterar permissões. NÃO use para correções puramente estáticas, typecheck, lint ou tarefas que não abrem a aplicação."
metadata:
  author: le-bebe-app
  version: "1.0.0"
---

# Autenticação técnica para agentes

Use este procedimento somente quando a tarefa realmente precisar abrir ou
testar uma área autenticada. O ambiente padrão é **Preview**, nunca
Production.

## Escolha do acesso ao Preview

- **Codex visual:** quando o MCP da Vercel estiver disponível, prefira o
  mecanismo oficial de Shareable Access temporário para o deployment
  protegido. Não persista nem registre a URL temporária.
- **Codex HTTP:** para uma requisição protegida, use `vercel curl` quando ele
  estiver disponível e for adequado ao teste.
- **Claude ou browser externo:** se não houver Shareable Access via MCP, leia
  o Protection Bypass for Automation no secret store seguro do ambiente e
  envie-o no header `x-vercel-protection-bypass`. Nunca coloque o valor em
  código, Git, documentação, logs ou mensagens.

Não desative Vercel Authentication, não mude a proteção do deployment e não
use uma credencial de bypass fora do secret store autorizado.

## Sessão da aplicação

Depois de ultrapassar a proteção da Vercel:

1. Abra `/agente` no mesmo contexto de browser.
2. Obtenha `AGENT_TEST_BOOTSTRAP_SECRET` no secret store do ambiente e use-o
   somente no formulário.
3. Deixe o Supabase criar a sessão normal em cookies.
4. Preserve esse mesmo contexto/cookies para navegar e validar a tarefa.
5. Se necessário, confirme a sessão em `/api/me/permissoes`.

Não tente login Google como alternativa ao fluxo técnico.

## Limites de permissão

A conta técnica é `agente.teste@lebebe.cloud`, com role `user` e perfil
`consultora`. Ela só recebe os módulos atuais desse perfil; não é
superadmin. Se a rota ou a ação exigir módulo indisponível, informe o bloqueio
e pare — nunca amplie permissões, troque perfil ou altere usuário para concluir
um teste.

## Produção e segurança

O bootstrap é permitido somente fora de Production. Em Production, `/agente`
deve continuar retornando 404; não tente habilitá-lo nem contorná-lo.

Nunca persista senha, segredo de bypass, token de acesso/refresh do Supabase,
cookie, service role ou URL temporária. Ao relatar a validação, descreva só o
método utilizado e o resultado, sem valores de credenciais.
